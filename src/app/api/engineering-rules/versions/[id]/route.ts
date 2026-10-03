// R393 (issue #13, korak R171 iz §15) — API: PREHODI VERZIJE PRAVILA.
// ---------------------------------------------------------------------------
// PATCH — discipliniran vnos (kanon R378/R390): {action: 'aktiviraj'|'upokoji'}.
//         aktiviraj: DRAFT → ACTIVE — TRANSAKCIJSKO upokoji prejšnjo ACTIVE
//         (veljavnostDo = now; dve ACTIVE = pokvarjeno stanje → 409; partial
//         UNIQUE erv v bazi = zadnja linija). §15 LOČITEV guard še enkrat:
//         uradna overitev (PROJEKTANTSKA/STATISTICNA) brez reviewerId +
//         reviewedAt → 409 — nepreverjeno NE sme postati production compliance
//         truth.
//         upokoji: ACTIVE → RETIRED (veljavnostDo = now; terminalno).
//         RBAC: canManageEngineeringRules (engineering.manage — vodstvo).
//         Statusni stroj živi v engineering-rules-store; matrika v
//         engineering-rules-domain (EN VIR).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { canManageEngineeringRules } from '@/lib/access'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'
import {
  EngineeringRulesStoreError,
  aktivirajVerzijoPravilaVTx,
  revizijskiKontekst,
  upokojiVerzijoPravilaVTx,
} from '@/lib/engineering-rules-store'

// PATCH — prehod statusa verzije pravila (aktiviraj/upokoji)
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const zavrnjeno = zapisOmejitev(request, 'engineering-rules')
  if (zavrnjeno) return zavrnjeno

  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (!canManageEngineeringRules(auth)) {
    return forbidden(
      'Verzije tehničnih pravil urejajo uporabniki s pravico engineering.manage (vodstvo).',
    )
  }
  const correlationId = correlationFromRequest(request)

  try {
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const body = telo.telo as Record<string, unknown>
    const action = typeof body.action === 'string' ? body.action.trim() : ''

    if (action !== 'aktiviraj' && action !== 'upokoji') {
      return NextResponse.json(
        { error: "Polje \"action\" mora biti 'aktiviraj' ali 'upokoji'." },
        { status: 400 },
      )
    }

    const { id } = await context.params
    // R294 F4: stena ure živi v ruti.
    const now = new Date()
    const session = auth.kind === 'user' ? auth.session : null

    const verzija = await db.$transaction(async (tx) =>
      action === 'aktiviraj'
        ? aktivirajVerzijoPravilaVTx(tx, id, revizijskiKontekst(request, session), now)
        : upokojiVerzijoPravilaVTx(tx, id, revizijskiKontekst(request, session), now),
    )

    return NextResponse.json({
      verzijaId: verzija.id,
      verzija: verzija.verzija,
      status: verzija.status,
      veljavnostOd: verzija.veljavnostOd.toISOString(),
      veljavnostDo: verzija.veljavnostDo?.toISOString() ?? null,
    })
  } catch (error) {
    if (error instanceof EngineeringRulesStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    logWithCorrelation('engineering-rules.versions.patch', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri prehodu verzije tehničnega pravila', correlationId },
      { status: 500 },
    )
  }
}
