// R374 (issue #13, korak R165 iz §32/§4) — API: strežniško avtoritativni cenik.
// ---------------------------------------------------------------------------
// GET  — aktivna verzija cenika + postavke (vsak prijavljeni principal; brez
//        aktivne verzije → 503 fail-closed: privzete cene iz kode NISO
//        poslovna resnica, klientu ne lažemo s "cunami brez knjige").
// POST — nova verzija cenika + TAKOJŠNJA aktivacija (permission price.override
//        — pisarna/vodstvo; MONTER/SKLADISCE ne). Validacija fail-closed:
//        whitelist ključev = TOČNO numerični ključi defaultPriceBook; nova
//        verzija mora pokriti VSE ključe. Aktivacija je TRANSAKCIJSKA
//        (prejšnja ACTIVE → RETIRED v isti transakciji — nikoli dve aktivni)
//        in revizijsko sledena ATOMSKO (PRICE_BOOK_VERSION_ACTIVATED).
//
// Klient NIKOLI ne pošlje cene, ki bi šla v uradno verzijo ponudbe: cene
// živijo SAMO tu (EN VIR); /api/quote override je zgolj kalkulatorjev
// PREDogLED (R374).
import { NextResponse } from 'next/server'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { lacksPermission } from '@/lib/access'
import {
  PriceBookStoreError,
  createPriceBookVersion,
  getActivePriceBookVersion,
} from '@/lib/price-book-store'

import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'

export async function GET(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const active = await getActivePriceBookVersion()
    if (!active) {
      // Fail-closed (§4): NI aktivne verzije → ni cen → ni ponudb. Nikoli
      // tihe nadomestitve s privzetimi vrednostmi iz kode.
      return NextResponse.json(
        { error: 'Ni aktivne verzije cenika — kontaktiraj odgovorno osebo.' },
        { status: 503 },
      )
    }
    return NextResponse.json({
      version: {
        id: active.id,
        version: active.version,
        status: active.status,
        currency: active.currency,
      },
      items: active.items,
    })
  } catch (error) {
    if (error instanceof PriceBookStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    console.error('Price book GET error:', error)
    return NextResponse.json({ error: 'Napaka pri branju cenika' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  // R374 — val 2 omejevanja hitrosti na pisanju (WRITE_LIMIT, kind `write`)
  const zavrnjeno = zapisOmejitev(request, 'price-book')
  if (zavrnjeno) return zavrnjeno

  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  // §10 (R135): spreminjanje cenikov = price.override (ADMIN/VODJA; monter
  // in servisni ključ cen NE spreminjata — cenik je vir resnice ponudb).
  if (lacksPermission(auth, 'price.override')) {
    return forbidden('Spreminjanje cenika zahteva pravico price.override.')
  }
  try {
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const body = telo.telo
    const { items, note } = body as { items?: unknown; note?: unknown }

    const created = await createPriceBookVersion({
      items,
      note: typeof note === 'string' ? note : null,
      actorId: auth.kind === 'user' ? auth.session.sub : null,
      request,
      session: auth.kind === 'user' ? auth.session : null,
      // R294 F4: stena ure ŽIVI v ruti (ne v jedru) — en trenutek za celo
      // transakcijo (retire prejšnje + activate nove + revizija).
      now: new Date(),
    })

    return NextResponse.json(
      {
        success: true,
        version: {
          id: created.id,
          version: created.version,
          status: created.status,
          currency: created.currency,
        },
        items: created.items,
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof PriceBookStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    console.error('Price book POST error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju verzije cenika' }, { status: 500 })
  }
}
