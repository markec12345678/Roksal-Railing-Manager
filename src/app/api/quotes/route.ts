// R374 (issue #13, korak R165 iz §32/§2–§4) — API: kanonične ponudbe projekta.
// ---------------------------------------------------------------------------
// POST — izračun in shranitev NOVE verzije ponudbe kot DRAFT:
//   vhod  = { projectId, points, closed?, overridesMm?, spec? } (SAMO
//           geometrija/specifikacija — klient NIKOLI ne pošlje denarja);
//   stroj = naloži AKTIVNO verzijo cenika (EN VIR — getActivePriceBookVersion,
//           ista plast kot /api/quote) → computeQuoteVersion na STREŽNIKU →
//           Quote + QuoteVersion DRAFT (transakcijsko + revizijsko).
//   Brez aktivne knjige → 503 fail-closed (privzete cene niso resnica).
//   Pravice: quotes.create + dostop 'update' do projekta (poslovni zapis).
//
// GET — seznam verzij ponudb projekta (?projectId=; dostop 'read' — ista
//   vrata kot vse projektne rute). Vrača minimalni seznam (brez linesJson —
//   detajl je GET /api/quotes/[id]).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { assertProjectAccess, lacksPermission, actorIdOf, AccessDeniedError } from '@/lib/access'
import { railingLayoutSchema } from '@/lib/validations'
import { PriceBookStoreError, getActivePriceBookVersion } from '@/lib/price-book-store'
import { computeQuoteVersion } from '@/lib/quote-versions'

import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'
import { auditInTx } from '@/lib/audit'

/** Isti vhodi kot /api/quote (railingLayoutSchema) + OBAVEZNI projectId. Brez `prices` — uradna verzija NE sprejme klientovih cen (§4). */
const novaPonudbaSchema = railingLayoutSchema.extend({
  projectId: z.string().min(1, 'projectId je obvezen').max(64),
})

/** Minimalni DTO verzije za seznam (§17 — brez težkih polj). */
interface VersionListItem {
  id: string
  quoteId: string
  versionNumber: number
  status: string
  subtotal: number
  vat: number
  total: number
  currency: string
  inputHash: string
  priceBookVersionId: string
  createdAt: Date
  approvedAt: Date | null
}

export async function GET(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, monterId: true, vodjaId: true, nazivProjekta: true, customerId: true },
    })
    assertProjectAccess(auth, project, 'read')

    const quotes = await db.quote.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { versions: { orderBy: { versionNumber: 'desc' } } },
    })

    const versions: Array<VersionListItem & { quoteStatus: string; projectName: string }> = []
    for (const q of quotes) {
      for (const v of q.versions) {
        versions.push({
          id: v.id,
          quoteId: q.id,
          quoteStatus: q.status,
          projectName: project!.nazivProjekta,
          versionNumber: v.versionNumber,
          status: v.status,
          subtotal: v.subtotal.toNumber(),
          vat: v.vat.toNumber(),
          total: v.total.toNumber(),
          currency: v.currency,
          inputHash: v.inputHash,
          priceBookVersionId: v.priceBookVersionId,
          createdAt: v.createdAt,
          approvedAt: v.approvedAt,
        })
      }
    }
    return NextResponse.json({ projectId, versions })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Quotes GET error:', error)
    return NextResponse.json({ error: 'Napaka pri branju ponudb' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  // R374 — val 2 omejevanja hitrosti na pisanju (WRITE_LIMIT, kind `write`)
  const zavrnjeno = zapisOmejitev(request, 'quotes')
  if (zavrnjeno) return zavrnjeno

  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  // §10 (R135): izdelava ponudb = quotes.create (vse uporabniške vloge;
  // API ključ ponudb NE izdeluje — pogodba MOBILE_SYNC je merjenje/foto).
  if (lacksPermission(auth, 'quotes.create')) {
    return forbidden('Izdelava ponudbe zahteva uporabniško pravico quotes.create.')
  }
  try {
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const parsed = novaPonudbaSchema.safeParse(telo.telo)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Neveljavni podatki', detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
        { status: 400 },
      )
    }
    const { projectId, points, closed, overridesMm, spec } = parsed.data

    // Vrata na ravni vira: verzija ponudbe je poslovni zapis NA projektu.
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, monterId: true, vodjaId: true, customerId: true },
    })
    assertProjectAccess(auth, project, 'update')

    // EN VIR cenika: SAMO aktivna strežniška verzija (brez klientovih cen).
    const active = await getActivePriceBookVersion()
    if (!active) {
      return NextResponse.json(
        { error: 'Ni aktivne verzije cenika — ponudbe ni mogoče izračunati.' },
        { status: 503 },
      )
    }

    // STREŽNIŠKI izračun: vhodi (točke/spec) + aktivna knjiga → postavke +
    // seštevki + inputHash. Klientov denar ne obstaja v tej enačbi.
    // (Zod izpiše overridesMm kot Record<number, number> — po JSON round-trip
    // so ključi stringi; cast je ozek in na enem mestu, enako kot v /api/quote.)
    const inputs = {
      points: points.map((p) => ({ xM: p.xM, yM: p.yM ?? 0, zM: p.zM })),
      closed,
      overridesMm: (overridesMm ?? null) as Record<string, number> | null,
      spec: (spec ?? null) as import('@/lib/railing-layout').DeepPartialSpec | null,
    }
    const computed = computeQuoteVersion(inputs, active.prices)

    const actor = actorIdOf(auth)
    const created = await db.$transaction(async (tx) => {
      const quote = await tx.quote.create({
        data: {
          projectId,
          customerId: project!.customerId,
          status: 'ODPRTA',
          createdById: actor,
        },
      })
      const version = await tx.quoteVersion.create({
        data: {
          quoteId: quote.id,
          versionNumber: 1,
          status: 'DRAFT',
          // Cast v Prisma JSON vhod: objekti SO JSON-varni (zod + lastna sestava);
          // tipovna lupina InputJsonValue ne pozna naših vmesnikov.
          inputsJson: inputs as unknown as Prisma.InputJsonValue,
          linesJson: computed.lines as unknown as Prisma.InputJsonValue,
          subtotal: computed.subtotal,
          vat: computed.vat,
          total: computed.total,
          currency: computed.currency,
          inputHash: computed.inputHash,
          priceBookVersionId: active.id,
          createdById: actor,
        },
      })
      await tx.quote.update({ where: { id: quote.id }, data: { currentVersionId: version.id } })

      // Revizijski vpis ATOMSKO z nastankom (§19): znesek + vezana knjiga.
      await auditInTx(tx, {
        request,
        session: auth.kind === 'user' ? auth.session : null,
        userId: actor,
        projectId,
        akcija: 'QUOTE_VERSION_CREATED',
        oldValue: null,
        newValue: {
          quoteId: quote.id,
          versionId: version.id,
          status: 'DRAFT',
          total: computed.total,
          priceBookVersion: active.version,
          inputHash: computed.inputHash,
        },
      })
      return { quote, version }
    })

    return NextResponse.json(
      {
        success: true,
        quoteId: created.quote.id,
        version: {
          id: created.version.id,
          versionNumber: created.version.versionNumber,
          status: created.version.status,
          subtotal: computed.subtotal,
          vat: computed.vat,
          total: computed.total,
          currency: computed.currency,
          inputHash: computed.inputHash,
          priceBookVersion: { id: active.id, version: active.version },
          runM: computed.runM,
          lines: computed.lines,
          createdAt: created.version.createdAt,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof PriceBookStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    console.error('Quotes POST error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju ponudbe' }, { status: 500 })
  }
}
