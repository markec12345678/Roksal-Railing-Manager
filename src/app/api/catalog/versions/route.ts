// R390 (issue #13, korak R170 iz §14) — API: VERZIJE PRODUKTNEGA KATALOGA.
// ---------------------------------------------------------------------------
// GET  — seznam verzij (administracija; steviloProduktov, intervali).
// POST — ustvari NOVO DRAFT verzijo ({opomba?}). RBAC: canManageCatalog
//        (catalog.manage — vodstvo). Statusni stroj DRAFT → ACTIVE → RETIRED
//        živi v catalog-store (matrika v catalog-domain — EN VIR, ne v ruti);
//        aktivacija/upokojitev prek PATCH /api/catalog/versions/[id].
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { canManageCatalog } from '@/lib/access'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'
import {
  CatalogStoreError,
  revizijskiKontekst,
  seznamVerzij,
  ustvariVerzijoKatalogaVTx,
} from '@/lib/catalog-store'

// GET — seznam verzij kataloga
export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const correlationId = correlationFromRequest(request)
  try {
    const verzije = await seznamVerzij()
    return NextResponse.json(verzije)
  } catch (error) {
    if (error instanceof CatalogStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    logWithCorrelation('catalog.versions.get', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri branju verzij kataloga', correlationId },
      { status: 500 },
    )
  }
}

// POST — ustvari DRAFT verzijo (catalog.manage — vodstvo)
export async function POST(request: Request) {
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
    const opomba = typeof body.opomba === 'string' ? body.opomba.trim() : null

    // R294 F4: stena ure živi v ruti.
    const now = new Date()
    const session = auth.kind === 'user' ? auth.session : null

    const ustvarjena = await db.$transaction(async (tx) =>
      ustvariVerzijoKatalogaVTx(tx, { opomba }, revizijskiKontekst(request, session), now),
    )

    return NextResponse.json(
      {
        verzijaId: ustvarjena.id,
        verzija: ustvarjena.verzija,
        status: ustvarjena.status,
        veljavnostOd: ustvarjena.veljavnostOd.toISOString(),
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof CatalogStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    logWithCorrelation('catalog.versions.post', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri ustvarjanju verzije kataloga', correlationId },
      { status: 500 },
    )
  }
}
