// R382 (issue #13, korak R169 iz §13) — API: detajl + prehodi/urejanje priložnosti.
// ---------------------------------------------------------------------------
// GET   — detajl priložnosti (lead, stranka, pretvorjeni projekt — §13
//         convertedProjectId);
// PATCH — DVE dejanji (discipliniran vnos, kanon R378 /api/production/[id]):
//           1. { action: 'transition', to, razlogIzgube?, nazivProjekta? } —
//              prehod PO MATRIKI §13 (crm-pipeline EN VIR):
//                • LOST zahteva razlogIzgube (400 brez — §13 loss reason);
//                • ACCEPTED je TRANSAKCIJSKA PRETVORBA: zahteva stranko
//                  (409 brez) + nazivProjekta (400 brez) → Projekt nastane
//                  V ISTI TRANSAKCIJI + convertedProjectId se zapiše
//                  (UNIQUE — pretvorba ENKRATNA) + reviziji
//                  OPPORTUNITY_CONVERTED in PROJECT_CREATED ATOMSKI;
//           2. { action: 'update', ...polja } — CRM podatki (samo živi
//              stage-i; ACCEPTED/LOST = zamrznjena zgodovina, 409).
//         RBAC: canManageCustomers (customers.write — R156 precedens).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { canManageCustomers, actorIdOf } from '@/lib/access'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'
import {
  CrmStoreError,
  naloziOpportunity,
  posodobiOpportunityVTx,
  prehodOpportunityVTx,
  revizijskiKontekst,
} from '@/lib/crm-store'
import { OPPORTUNITY_STAGES } from '@/lib/crm-pipeline'

const MAXNAZIV = 200
const MAXOPIS = 2000
const MAXRAZLOG = 500

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
    const opp = await naloziOpportunity(id)
    if (!opp) {
      return NextResponse.json({ error: 'Priložnost ne obstaja' }, { status: 404 })
    }

    return NextResponse.json({
      opportunity: {
        id: opp.id,
        leadId: opp.leadId,
        lead: opp.lead,
        customerId: opp.customerId,
        customer: opp.customer,
        naziv: opp.naziv,
        opis: opp.opis,
        // Decimal → number na DTO meji (kanon R380):
        ocenjenaVrednost: opp.ocenjenaVrednost?.toNumber() ?? null,
        stage: opp.stage,
        verjetnost: opp.verjetnost,
        razlogIzgube: opp.razlogIzgube,
        convertedProjectId: opp.convertedProjectId,
        convertedProject: opp.convertedProject,
        createdAt: opp.createdAt,
        updatedAt: opp.updatedAt,
      },
    })
  } catch (error) {
    logWithCorrelation('opportunities.get.id', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri branju priložnosti', correlationId },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const zavrnjeno = zapisOmejitev(request, 'opportunities')
  if (zavrnjeno) return zavrnjeno

  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (!canManageCustomers(auth)) {
    return forbidden('Priložnosti urejajo uporabniki s pravico customers.write (prijava).')
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
      if (!(OPPORTUNITY_STAGES as readonly string[]).includes(to)) {
        return NextResponse.json(
          {
            error: `Neznan ciljni stage priložnosti '${to}' (§13 lifecycle: ${OPPORTUNITY_STAGES.join(' → ')}).`,
          },
          { status: 400 },
        )
      }
      const razlogIzgube = parseOptionalText(body.razlogIzgube, 'razlogIzgube', MAXRAZLOG)
      if (!razlogIzgube.ok) return NextResponse.json({ error: razlogIzgube.error }, { status: 400 })
      const nazivProjekta = parseOptionalText(body.nazivProjekta, 'nazivProjekta', MAXNAZIV)
      if (!nazivProjekta.ok) return NextResponse.json({ error: nazivProjekta.error }, { status: 400 })

      const izhod = await db.$transaction(async (tx) =>
        prehodOpportunityVTx(tx, {
          opportunityId: id,
          to,
          razlogIzgube: razlogIzgube.value ?? null,
          nazivProjekta: nazivProjekta.value ?? null,
          actorId: actorIdOf(auth),
          now,
          revizija,
        }),
      )

      return NextResponse.json(izhod)
    }

    if (action === 'update') {
      const naziv = parseOptionalText(body.naziv, 'naziv', MAXNAZIV)
      if (!naziv.ok) return NextResponse.json({ error: naziv.error }, { status: 400 })
      const opis = parseOptionalText(body.opis, 'opis', MAXOPIS)
      if (!opis.ok) return NextResponse.json({ error: opis.error }, { status: 400 })

      const customerId =
        body.customerId === undefined
          ? undefined
          : typeof body.customerId === 'string' && body.customerId.trim() !== ''
            ? body.customerId.trim()
            : null

      // Ocenjena vrednost/verjetnost gresta NEOBDELANI v plast — tip in domeno
      // validira TAM (EN VIR pravil).
      const ocenjenaVrednost: unknown = body.ocenjenaVrednost
      const verjetnost: unknown = body.verjetnost

      const izhod = await db.$transaction(async (tx) =>
        posodobiOpportunityVTx(tx, {
          opportunityId: id,
          naziv: naziv.value ?? undefined,
          opis: opis.value ?? null,
          ocenjenaVrednost: ocenjenaVrednost as number | null | undefined,
          verjetnost: verjetnost as number | null | undefined,
          customerId,
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
    logWithCorrelation('opportunities.patch.id', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri posodabljanju priložnosti', correlationId },
      { status: 500 },
    )
  }
}
