// Roksal Field - API: Računi (FURS layer)
// PREDRACUN | RACUN | PREDPLACILNI — slovenski zakonski podatki (ZDDV-1, 37. člen):
// zaporedna številka "2026-NNN", datum izdaje, DDV 22 % (oz. 9,5 % / 0 %),
// rok plačila, snapshot kupca in postavk (račun je pravno-aktiven dokument,
// zato se postavke zaradi kasnejših sprememb projekta ne spreminjajo).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import { hasPermission, lacksPermission, assertProjectAccess, AccessDeniedError } from '@/lib/access'
import type { SessionPayload } from '@/lib/session'
import { allocateDocumentNumber, createWithNumber } from '@/lib/numbering'
import { auditInTx, audit } from '@/lib/audit'
import { actorIdOf } from '@/lib/access'

const DDV_STOPLNJE = [22, 9.5, 0] as const
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/**
 * §10 (R135) — uradni računi = KONKRETNA dovoljenja (invoices.*).
 * POST → invoices.create · PATCH → invoices.issue / invoices.cancel ·
 * DELETE (osnutek) → invoices.create · GET → invoices.read.
 * R126 (issue #5 §3): API ključ ni izjema — servisni ključ ne dela z uradnimi
 * dokumenti (katalog dovoljenj apikey zato ne vsebuje nobenega invoices.*).
 */
function denyUnlessInvoice(
  auth: import('@/lib/auth').AuthContext,
  permission: 'invoices.create' | 'invoices.issue' | 'invoices.cancel'
): NextResponse | null {
  if (auth.kind === 'apikey') {
    return forbidden('Računi so uradni dokumenti — API ključ nima dostopa.')
  }
  if (lacksPermission(auth, permission)) {
    return forbidden(`Računi so uradni dokumenti — potrebna je pravica ${permission}.`)
  }
  return null
}

const postavkaSchema = z.object({
  opis: z.string().min(1, 'Opis postavke je obvezen').max(300),
  kolicina: z.number().positive('Količina mora biti pozitivna').max(100000),
  enota: z.string().min(1).max(20).default('kos'),
  cenaNaEnoto: z.number().min(0).max(1000000),
  ddvStopnja: z
    .number()
    .refine((v) => (DDV_STOPLNJE as readonly number[]).includes(v), {
      message: 'DDV stopnja mora biti 22, 9.5 ali 0',
    })
    .default(22),
})

const kupecSchema = z.object({
  ime: z.string().min(1).max(200),
  naslov: z.string().max(300).default(''),
  telefon: z.string().max(50).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  davcnaSt: z.string().max(20).optional().nullable(),
})

const createInvoiceSchema = z.object({
  projectId: z.string().min(1, 'ID projekta je obvezen'),
  tip: z.enum(['PREDRACUN', 'RACUN', 'PREDPLACILNI']).default('RACUN'),
  postavke: z.array(postavkaSchema).min(1, 'Račun potrebuje vsaj eno postavko').max(100),
  rokPlacilaDni: z.number().int().min(0).max(365).default(8),
  datumStoritve: z.string().datetime().optional().nullable(),
  opombe: z.string().max(1000).optional().nullable(),
})

const updateInvoiceSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['OSNUTEK', 'IZDAN', 'PLACAN', 'STORNIRAN']).optional(),
  postavke: z.array(postavkaSchema).min(1).max(100).optional(),
  rokPlacilaDni: z.number().int().min(0).max(365).optional(),
  opombe: z.string().max(1000).optional().nullable(),
  datumStoritve: z.string().datetime().optional().nullable(),
})

/** Izračun vsot iz postavk — edini vir resnice (zaupanje klientu ne velja pri DDV). */
function computeTotals(postavke: Array<{ kolicina: number; cenaNaEnoto: number; ddvStopnja: number }>) {
  let osnova = 0
  let ddv = 0
  for (const p of postavke) {
    const vrstica = round2(p.kolicina * p.cenaNaEnoto)
    osnova += vrstica
    ddv += round2(vrstica * (p.ddvStopnja / 100))
  }
  osnova = round2(osnova)
  ddv = round2(ddv)
  return { osnova, ddv, znesek: round2(osnova + ddv) }
}

/**
 * Številčenje (S+9, issue #4 §12): concurrency-safe prek NumberSequence
 * (INSERT … ON CONFLICT … RETURNING v transakciji + retry na P2002, glej
 * src/lib/numbering.ts). Oblika ostane združljiva: "2026-001" | "2026-PR-001".
 * Stara nextStevilka (findFirst + 1) je bila tekmovalna — odstranjena.
 */

export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const correlationId = correlationFromRequest(request)
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    // Resource-level dostop (issue #4 §3): MONTER vidi samo račune svojih
    // projektov; vodstvo/skladišče vse. R126: API ključ nima dostopa do
    // računov (uradni dokumenti) — prej je tukaj spregledal manager preverbo.
    if (auth.kind === 'apikey') {
      return forbidden('Računi so uradni dokumenti — API ključ nima dostopa.')
    }
    // Širina branja: pisarna (users.read: ADMIN/VODJA) ali skladišče
    // (inventory.write) vidi VSE račune; ostali (monter) svoje projekte.
    const seesAll = hasPermission(auth, 'users.read') || hasPermission(auth, 'inventory.write')
    if (!seesAll) {
      // R155 (P1 bug fix — IDOR zaključek): `?projectId=` je prej OBŠEL
      // lastniška vrata — MONTER je s poljubnim tujim projectId prebral
      // račune projekta, ki ga sploh ni videl (filter se je uveljavil SAMO
      // brez parametra). Zdaj isti 404/403 kot sestrske rute: neznani
      // projekt → 404, tuj projekt → 403; svoj projekt → filtrirano branje.
      if (projectId) {
        const project = await db.project.findUnique({ where: { id: projectId } })
        assertProjectAccess(auth, project, 'read')
        const invoices = await db.invoice.findMany({
          where: { projectId },
          include: {
            project: {
              select: { nazivProjekta: true, clientToken: true, customer: { select: { ime: true, naslov: true } } },
            },
          },
          orderBy: { createdAt: 'desc' },
        })
        return NextResponse.json(invoices)
      }
      const uid = auth.session.sub
      const ownProjects = await db.project.findMany({
        where: { OR: [{ monterId: uid }, { vodjaId: uid }] },
        select: { id: true },
      })
      const invoices = await db.invoice.findMany({
        where: { projectId: { in: ownProjects.map((p) => p.id) } },
        include: {
          project: {
            select: { nazivProjekta: true, clientToken: true, customer: { select: { ime: true, naslov: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json(invoices)
    }

    const invoices = await db.invoice.findMany({
      where: projectId ? { projectId } : undefined,
      include: {
        project: {
          select: { nazivProjekta: true, clientToken: true, customer: { select: { ime: true, naslov: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(invoices)
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logWithCorrelation('invoices.get', correlationId, error)
    return NextResponse.json({ error: 'Napaka pri branju računov', correlationId }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  // §10: osnutek računa = invoices.create (vodstvo; uradni dokument).
  const denied = denyUnlessInvoice(auth, 'invoices.create')
  if (denied) return denied
  const actor = actorIdOf(auth)
  const correlationId = correlationFromRequest(request)
  try {
    const body = await request.json()
    const validated = createInvoiceSchema.parse(body)

    // Projekt + kupec (snapshot za račun)
    const project = await db.project.findUnique({
      where: { id: validated.projectId },
      select: {
        nazivProjekta: true,
        customer: { select: { ime: true, naslov: true, telefon: true, email: true } },
      },
    })
    if (!project) {
      return NextResponse.json({ error: 'Projekt ni najden' }, { status: 404 })
    }

    const totals = computeTotals(validated.postavke)

    // Concurrency-safe številčenje + audit v ENI transakciji (retry na P2002).
    const invoice = await createWithNumber(validated.tip, async (tx, stevilka) => {
      const created = await tx.invoice.create({
        data: {
          projectId: validated.projectId,
          tip: validated.tip,
          stevilka,
          rokPlacilaDni: validated.rokPlacilaDni,
          datumStoritve: validated.datumStoritve ? new Date(validated.datumStoritve) : null,
          postavke: JSON.stringify(validated.postavke),
          kupec: JSON.stringify({
            ime: project.customer.ime,
            naslov: project.customer.naslov,
            telefon: project.customer.telefon,
            email: project.customer.email,
          }),
          osnova: totals.osnova,
          ddv: totals.ddv,
          znesek: totals.znesek,
          opombe: validated.opombe ?? null,
          status: 'OSNUTEK',
        },
      })
      await auditInTx(tx, {
        request,
        session: auth.kind === 'user' ? auth.session : null,
        userId: actor,
        projectId: validated.projectId,
        akcija: 'INVOICE_CREATED',
        newValue: { id: created.id, stevilka, tip: validated.tip, znesek: totals.znesek },
      })
      return created
    })
    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Neveljavni podatki' }, { status: 400 })
    }
    logWithCorrelation('invoices.post', correlationId, error)
    return NextResponse.json({ error: 'Napaka pri shranjevanju računa', correlationId }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  // Statusi (IZDAN/PLACAN/STORNIRAN) = finančno pomembna dejanja → §10:
  // izdaja/plačilo = invoices.issue, storno = invoices.cancel. Telo beremo
  // najprej, da vemo, katera pravica velja.
  const bodyPreview = (await request.clone().json().catch(() => ({}))) as { status?: string }
  const denied = denyUnlessInvoice(auth, bodyPreview.status === 'STORNIRAN' ? 'invoices.cancel' : 'invoices.issue')
  if (denied) return denied
  const correlationId = correlationFromRequest(request)
  const actor = actorIdOf(auth)
  try {
    const body = await request.json()
    const validated = updateInvoiceSchema.parse(body)
    const { id, ...data } = validated

    const existing = await db.invoice.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Račun ni najden' }, { status: 404 })
    }

    // IZDAN/PLACAN/STORNIRAN račun je pravno-aktiven → postavke se več ne spreminjajo
    if (existing.status !== 'OSNUTEK' && (data.postavke || data.rokPlacilaDni !== undefined)) {
      return NextResponse.json(
        { error: 'Izdanega računa ni mogoče urejati — uporabi storno in izstavi novega' },
        { status: 409 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (data.status) {
      updateData.status = data.status
      if (data.status === 'PLACAN') updateData.placanoAt = new Date()
      if (data.status === 'STORNIRAN' || data.status === 'IZDAN') updateData.placanoAt = null
    }
    if (data.postavke) {
      const totals = computeTotals(data.postavke)
      updateData.postavke = JSON.stringify(data.postavke)
      updateData.osnova = totals.osnova
      updateData.ddv = totals.ddv
      updateData.znesek = totals.znesek
    }
    if (data.rokPlacilaDni !== undefined) updateData.rokPlacilaDni = data.rokPlacilaDni
    if (data.opombe !== undefined) updateData.opombe = data.opombe
    if (data.datumStoritve !== undefined) {
      updateData.datumStoritve = data.datumStoritve ? new Date(data.datumStoritve) : null
    }

    // Statusna sprememba = kritičen dogodek: update + audit v ISTI transakciji.
    const invoice = data.status
      ? await db.$transaction(async (tx) => {
          const updated = await tx.invoice.update({ where: { id }, data: updateData })
          await auditInTx(tx, {
            request,
            session: auth.kind === 'user' ? auth.session : null,
            userId: actor,
            projectId: existing.projectId,
            akcija: 'INVOICE_STATUS',
            oldValue: existing.status,
            newValue: data.status,
          })
          return updated
        })
      : await db.invoice.update({ where: { id }, data: updateData })
    return NextResponse.json(invoice)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Neveljavni podatki' }, { status: 400 })
    }
    logWithCorrelation('invoices.patch', correlationId, error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju računa', correlationId }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  // Brisanje OSNUTKA računa = ista pravica kot ustvarjanje (invoices.create).
  const denied = denyUnlessInvoice(auth, 'invoices.create')
  if (denied) return denied
  const correlationId = correlationFromRequest(request)
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id je obvezen' }, { status: 400 })
    }
    const existing = await db.invoice.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Račun ni najden' }, { status: 404 })
    }
    // FURS: izdanega računa ne brišemo — samo storno (pravna sled)
    if (existing.status !== 'OSNUTEK') {
      return NextResponse.json(
        { error: 'Izdanega računa ni mogoče brisati — uporabi storno' },
        { status: 409 }
      )
    }
    await db.invoice.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    logWithCorrelation('invoices.delete', correlationId, error)
    return NextResponse.json({ error: 'Napaka pri brisanju računa', correlationId }, { status: 500 })
  }
}
