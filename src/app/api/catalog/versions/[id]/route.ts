// R390 (issue #13, korak R170 iz §14) — API: PREHODI VERZIJE KATALOGA.
// ---------------------------------------------------------------------------
// PATCH — discipliniran vnos (kanon R378): {action: 'aktiviraj'|'upokoji'}.
//         aktiviraj: DRAFT → ACTIVE — TRANSAKCIJSKO upokoji prejšnjo ACTIVE
//         (veljavnostDo = now; dve ACTIVE = pokvarjeno stanje → 409).
//         upokoji: ACTIVE → RETIRED (veljavnostDo = now; terminalno).
//         RBAC: canManageCatalog (catalog.manage — vodstvo). Statusni stroj
//         živi v catalog-store; matrika v catalog-domain (EN VIR).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { canManageCatalog } from '@/lib/access'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'
import {
  CatalogStoreError,
  aktivirajVerzijoKatalogaVTx,
  revizijskiKontekst,
  upokojiVerzijoKatalogaVTx,
} from '@/lib/catalog-store'

// PATCH — prehod statusa verzije (aktiviraj/upokoji)
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const zavrnjeno = zapisOmejitev(request, 'catalog')
  if (zavrnjeno) return zavrnjeno

  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (!canManageCatalog(auth)) {
    return forbidden('Verzije kataloga urejajo uporabniki s pravico catalog.manage (vodstvo).')
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
        ? aktivirajVerzijoKatalogaVTx(tx, id, revizijskiKontekst(request, session), now)
        : upokojiVerzijoKatalogaVTx(tx, id, revizijskiKontekst(request, session), now),
    )

    return NextResponse.json({
      verzijaId: verzija.id,
      verzija: verzija.verzija,
      status: verzija.status,
      veljavnostOd: verzija.veljavnostOd.toISOString(),
      veljavnostDo: verzija.veljavnostDo?.toISOString() ?? null,
    })
  } catch (error) {
    if (error instanceof CatalogStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    logWithCorrelation('catalog.versions.patch', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri prehodu verzije kataloga', correlationId },
      { status: 500 },
    )
  }
}
