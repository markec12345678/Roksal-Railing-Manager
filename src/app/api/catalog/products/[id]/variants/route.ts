// R390 (issue #13, korak R170 iz §14) — API: VARIANTE PRODUKTA.
// ---------------------------------------------------------------------------
// POST — ustvari varianto produkta (§14 ProductVariant): {sifra, naziv,
//        barvaId?, barvaHex?, povrsina?}. barvaId MORA obstajati v paleti
//        družine (fail-closed 400 s seznamom); barvaHex preverjen proti
//        paleti (NE izmišljen hex — §8). RBAC: canManageCatalog (vodstvo).
//        Seed variant je PRAZEN (colorsCount = števec, ne enumeracija) —
//        vrstice vpiše pisarca prek TE poti.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { canManageCatalog } from '@/lib/access'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'
import { CatalogStoreError, revizijskiKontekst, ustvariVariantoVTx } from '@/lib/catalog-store'

// POST — ustvari varianto (§14 ProductVariant; catalog.manage)
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const zavrnjeno = zapisOmejitev(request, 'catalog')
  if (zavrnjeno) return zavrnjeno

  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (!canManageCatalog(auth)) {
    return forbidden('Variante urejajo uporabniki s pravico catalog.manage (vodstvo).')
  }
  const correlationId = correlationFromRequest(request)

  try {
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const body = telo.telo as Record<string, unknown>

    if (typeof body.sifra !== 'string' || body.sifra.trim().length < 2) {
      return NextResponse.json(
        { error: 'Polje "sifra" je obvezno (min 2 znaka).' },
        { status: 400 },
      )
    }
    if (typeof body.naziv !== 'string' || body.naziv.trim().length < 2) {
      return NextResponse.json(
        { error: 'Polje "naziv" je obvezno (min 2 znaka).' },
        { status: 400 },
      )
    }

    const { id } = await context.params
    // R294 F4: stena ure živi v ruti.
    const now = new Date()
    const session = auth.kind === 'user' ? auth.session : null

    const ustvarjena = await db.$transaction(async (tx) =>
      ustvariVariantoVTx(
        tx,
        id,
        {
          sifra: (body.sifra as string).trim(),
          naziv: (body.naziv as string).trim(),
          barvaId: typeof body.barvaId === 'string' ? body.barvaId.trim() : null,
          barvaHex: typeof body.barvaHex === 'string' ? body.barvaHex.trim() : null,
          povrsina: typeof body.povrsina === 'string' ? body.povrsina : null,
        },
        revizijskiKontekst(request, session),
        now,
      ),
    )

    return NextResponse.json(
      {
        variantaId: ustvarjena.id,
        sifra: ustvarjena.sifra,
        barvaId: ustvarjena.barvaId,
        barvaHex: ustvarjena.barvaHex,
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof CatalogStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    logWithCorrelation('catalog.variants.post', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri ustvarjanju variante', correlationId },
      { status: 500 },
    )
  }
}
