// R382 (issue #13, korak R169 iz §13) — API: detajl + prehodi/urejanje sleada.
// ---------------------------------------------------------------------------
// GET   — detajl sleada + njegove priložnosti (isti prag kot GET /api/leads);
// PATCH — DVE dejanji (discipliniran vnos, kanon R378 /api/production/[id]):
//           1. { action: 'transition', to, pretvorba? } — prehod PO MATRIKI
//              (crm-pipeline EN VIR); to=PRETVORJEN zahteva payload
//              { naziv, customerId?, ocenjenaVrednost?, verjetnost? } —
//              priložnost nastane V ISTI TRANSAKCIJI (LEAD_CONVERTED +
//              OPPORTUNITY_CREATED + atomarna revizija);
//           2. { action: 'update', ...polja } — urejanje kontaktnih podatkov
//              (samo NETERMINALNA stanja — PRETVORJEN/ZAVRNJEN sta zamrznjena
//              zgodovina, 409).
//         RBAC: canManageCustomers (customers.write — R156 precedens CRM).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { canManageCustomers, actorIdOf } from '@/lib/access'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'
import { CrmStoreError, naloziLead, posodobiLeadVTx, prehodLeadaVTx, revizijskiKontekst } from '@/lib/crm-store'
import { LEAD_STATUSES } from '@/lib/crm-pipeline'

const MAXIME = 120
const MAXTELEFON = 60
const MAXEMAIL = 200
const MAXOPOMBE = 2000
const MAXNAZIV = 200
const MAXOPIS = 2000

/** Stroga (fail-closed) pretvorba neobveznega datuma (R156 vzorec). */
function parseOptionalDate(
  raw: unknown,
  field: string,
): { ok: true; value: Date | null | undefined } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, value: raw === null ? null : undefined }
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, error: `Polje "${field}" mora biti ISO datum ali null` }
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) {
    return { ok: false, error: `Polje "${field}" ni veljaven datum` }
  }
  return { ok: true, value: d }
}

/** Stroga (fail-closed) pretvorba neobveznega besedila s stropom (R156). */
function parseOptionalText(
  raw: unknown,
  field: string,
  max: number,
): { ok: true; value: string | null | undefined } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, value: raw === null ? null : undefined }
  if (typeof raw !== 'string') {
    return { ok: false, error: `Polje "${field}" mora biti niz ali null` }
  }
  const trimmed = raw.trim()
  if (trimmed.length === 0) return { ok: true, value: null }
  if (trimmed.length > max) {
    return { ok: false, error: `Polje "${field}" presega ${max} znakov` }
  }
  return { ok: true, value: trimmed }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const correlationId = correlationFromRequest(request)
  try {
    const { id } = await params
    const lead = await naloziLead(id)
    if (!lead) {
      return NextResponse.json({ error: 'Slead ne obstaja' }, { status: 404 })
    }

    return NextResponse.json({
      lead: {
        id: lead.id,
        source: lead.source,
        ime: lead.ime,
        telefon: lead.telefon,
        email: lead.email,
        tipPovprasevanja: lead.tipPovprasevanja,
        status: lead.status,
        ownerId: lead.ownerId,
        nextActionAt: lead.nextActionAt,
        opombe: lead.opombe,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
      },
      // Decimal → number na DTO meji (kanon R380 decToPlain):
      opportunities: lead.opportunities.map((o) => ({
        id: o.id,
        naziv: o.naziv,
        stage: o.stage,
        customerId: o.customerId,
        ocenjenaVrednost: o.ocenjenaVrednost?.toNumber() ?? null,
        createdAt: o.createdAt,
      })),
    })
  } catch (error) {
    logWithCorrelation('leads.get.id', correlationId, error)
    return NextResponse.json({ error: 'Napaka pri branju sleada', correlationId }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const zavrnjeno = zapisOmejitev(request, 'leads')
  if (zavrnjeno) return zavrnjeno

  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (!canManageCustomers(auth)) {
    return forbidden('Sleade urejajo uporabniki s pravico customers.write (prijava).')
  }
  const correlationId = correlationFromRequest(request)

  try {
    const { id } = await params
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const body = telo.telo as Record<string, unknown>
    const action = body.action

    const now = new Date()
    const session = auth.kind === 'user' ? auth.session : null
    const revizija = revizijskiKontekst(request, session)

    if (action === 'transition') {
      const to = typeof body.to === 'string' ? body.to : ''
      if (!(LEAD_STATUSES as readonly string[]).includes(to)) {
        return NextResponse.json(
          {
            error: `Neznan ciljni status sleada '${to}' (nabor: ${LEAD_STATUSES.join(', ')}).`,
          },
          { status: 400 },
        )
      }

      // Pretvorba (to=PRETVORJEN) nosi payload priložnosti:
      const pretvorbaRaw = body.pretvorba as Record<string, unknown> | undefined
      const naziv = parseOptionalText(pretvorbaRaw?.naziv, 'pretvorba.naziv', MAXNAZIV)
      if (!naziv.ok) return NextResponse.json({ error: naziv.error }, { status: 400 })
      const opis = parseOptionalText(pretvorbaRaw?.opis, 'pretvorba.opis', MAXOPIS)
      if (!opis.ok) return NextResponse.json({ error: opis.error }, { status: 400 })
      // Ocenjena vrednost/verjetnost gresta NEOBDELANI v plast — tip in
      // domeno validira TAM (EN VIR pravil; string/NaN/3 decimalki → 400).
      const ocenjenaVrednost: unknown = pretvorbaRaw?.ocenjenaVrednost
      const verjetnost: unknown = pretvorbaRaw?.verjetnost
      const customerId =
        typeof pretvorbaRaw?.customerId === 'string' && pretvorbaRaw.customerId.trim() !== ''
          ? pretvorbaRaw.customerId.trim()
          : null

      const izhod = await db.$transaction(async (tx) =>
        prehodLeadaVTx(tx, {
          leadId: id,
          to,
          pretvorba:
            to === 'PRETVORJEN'
              ? {
                  naziv: naziv.value ?? '',
                  customerId,
                  opis: opis.value ?? null,
                  ocenjenaVrednost: ocenjenaVrednost as number | null | undefined,
                  verjetnost: verjetnost as number | null | undefined,
                }
              : undefined,
          actorId: actorIdOf(auth),
          now,
          revizija,
        }),
      )

      return NextResponse.json(izhod)
    }

    if (action === 'update') {
      const ime = parseOptionalText(body.ime, 'ime', MAXIME)
      if (!ime.ok) return NextResponse.json({ error: ime.error }, { status: 400 })
      const telefon = parseOptionalText(body.telefon, 'telefon', MAXTELEFON)
      if (!telefon.ok) return NextResponse.json({ error: telefon.error }, { status: 400 })
      const email = parseOptionalText(body.email, 'email', MAXEMAIL)
      if (!email.ok) return NextResponse.json({ error: email.error }, { status: 400 })
      const opombe = parseOptionalText(body.opombe, 'opombe', MAXOPOMBE)
      if (!opombe.ok) return NextResponse.json({ error: opombe.error }, { status: 400 })
      const nextActionAt = parseOptionalDate(body.nextActionAt, 'nextActionAt')
      if (!nextActionAt.ok) return NextResponse.json({ error: nextActionAt.error }, { status: 400 })

      const source = typeof body.source === 'string' ? body.source : undefined
      const tipPovprasevanja =
        typeof body.tipPovprasevanja === 'string' ? body.tipPovprasevanja : undefined
      const ownerId =
        body.ownerId === undefined
          ? undefined
          : typeof body.ownerId === 'string' && body.ownerId.trim() !== ''
            ? body.ownerId.trim()
            : null

      const izhod = await db.$transaction(async (tx) =>
        posodobiLeadVTx(tx, {
          leadId: id,
          source,
          ime: ime.value ?? undefined,
          telefon: telefon.value ?? null,
          email: email.value ?? null,
          tipPovprasevanja,
          ownerId,
          nextActionAt: nextActionAt.value ?? null,
          opombe: opombe.value ?? null,
          actorId: actorIdOf(auth),
          now,
          revizija,
        }),
      )

      return NextResponse.json(izhod)
    }

    return NextResponse.json(
      { error: "Podprta dejanja: 'transition', 'update'." },
      { status: 400 },
    )
  } catch (error) {
    if (error instanceof CrmStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    logWithCorrelation('leads.patch.id', correlationId, error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju sleada', correlationId }, { status: 500 })
  }
}
