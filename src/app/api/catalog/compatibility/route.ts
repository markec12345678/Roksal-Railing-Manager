// R390 (issue #13, korak R170 iz §14) — API: KOMPATIBILNOST KOMPONENT.
// ---------------------------------------------------------------------------
// POST — doda kompatibilnost: {productId, kompatibilenProductId? XOR
//        kompatibilenDodatekId?, opis?}. Fail-closed: XOR natanko en cilj
//        (400), produkt samemu sebi (400), manjkajoči cilj (404), duplikat
//        (409). RBAC: canManageCatalog (catalog.manage — vodstvo).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { canManageCatalog } from '@/lib/access'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'
import { CatalogStoreError, dodajKompatibilnostVTx, revizijskiKontekst } from '@/lib/catalog-store'

// POST — dodaj kompatibilnost (§14 Compatibility; catalog.manage)
export async function POST(request: Request) {
  const zavrnjeno = zapisOmejitev(request, 'catalog')
  if (zavrnjeno) return zavrnjeno

  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (!canManageCatalog(auth)) {
    return forbidden('Kompatibilnost urejajo uporabniki s pravico catalog.manage (vodstvo).')
  }
  const correlationId = correlationFromRequest(request)

  try {
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const body = telo.telo as Record<string, unknown>

    const productId = typeof body.productId === 'string' ? body.productId.trim() : ''
    if (!productId) {
      return NextResponse.json({ error: 'Polje "productId" je obvezno.' }, { status: 400 })
    }

    const kompatibilenProductId =
      typeof body.kompatibilenProductId === 'string' && body.kompatibilenProductId.trim() !== ''
        ? body.kompatibilenProductId.trim()
        : null
    const kompatibilenDodatekId =
      typeof body.kompatibilenDodatekId === 'string' && body.kompatibilenDodatekId.trim() !== ''
        ? body.kompatibilenDodatekId.trim()
        : null
    if (!kompatibilenProductId && !kompatibilenDodatekId) {
      return NextResponse.json(
        {
          error:
            'Podati morate NATANKO en cilj: kompatibilenProductId (produkt) ALI kompatibilenDodatekId (dodatek).',
        },
        { status: 400 },
      )
    }

    // R294 F4: stena ure živi v ruti.
    const now = new Date()
    const session = auth.kind === 'user' ? auth.session : null

    const ustvarjena = await db.$transaction(async (tx) =>
      dodajKompatibilnostVTx(
        tx,
        {
          productId,
          kompatibilenProductId,
          kompatibilenDodatekId,
          opis: typeof body.opis === 'string' ? body.opis : null,
        },
        revizijskiKontekst(request, session),
        now,
      ),
    )

    return NextResponse.json(
      {
        kompatibilnostId: ustvarjena.id,
        productId: ustvarjena.productId,
        kompatibilenProductId: ustvarjena.kompatibilenProductId,
        kompatibilenDodatekId: ustvarjena.kompatibilenDodatekId,
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof CatalogStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    logWithCorrelation('catalog.compatibility.post', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri dodajanju kompatibilnosti', correlationId },
      { status: 500 },
    )
  }
}
