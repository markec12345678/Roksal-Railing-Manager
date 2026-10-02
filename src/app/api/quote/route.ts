// Roksal — ponudba iz razporeda ograje
// ---------------------------------------------------------------------------
// POST vrne postavke, rezalni seznam in seštevke (material, storitve, popust,
// DDV, skupaj, cena na meter).
//
// R374 (issue #13 §4): OSNOVA cenika je STREŽNIŠKO AVTORITATIVNA aktivna
// verzija (getActivePriceBookVersion — ISTA plast kot /api/quotes); klientov
// `prices` override ostaja SAMO kot kalkulatorjev PREDogLED (izračun te rute
// ni uradna verzija ponudbe — ta nastane izključno prek POST /api/quotes,
// ki klientovih cen NE sprejme). Brez aktivne knjige → 503 fail-closed
// (privzete cene iz kode NISO poslovna resnica).
//
// Vse količine pridejo iz LayoutResult, nikoli niso preračunane znova: število
// panelov v ponudbi je po konstrukciji enako številu panelov v risbi.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { lacksPermission } from '@/lib/access'
import { auditAsync } from '@/lib/audit'
import { layoutRailing, mergeSpec, perimeterOf, type Vec3 } from '@/lib/railing-layout'
import { buildQuote, mergePriceBook, quoteSummary } from '@/lib/quote'
import { quoteInputFingerprint } from '@/lib/quote-repro'
import { quoteSchema } from '@/lib/validations'
import { PriceBookStoreError, getActivePriceBookVersion } from '@/lib/price-book-store'

import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'
export async function POST(request: Request) {
  // R190 — val 1 omejevanja hitrosti na pisanju (WRITE_LIMIT, kind `write`)
  const zavrnjeno = zapisOmejitev(request, 'quote')
  if (zavrnjeno) return zavrnjeno
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  // §10 (R135): izračun ponudbe = quotes.create (vse uporabniške vloge;
  // API ključ ne izdeluje ponudb — pogodba MOBILE_SYNC je merjenje/foto).
  if (lacksPermission(auth, 'quotes.create')) {
    return forbidden('Izdelava ponudbe zahteva uporabniško pravico quotes.create.')
  }

  try {
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const parsed = quoteSchema.safeParse(telo.telo)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Neveljavni podatki', detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
        { status: 400 },
      )
    }
    const { points, closed, overridesMm, spec: specOverride, prices: priceOverride, projectId } = parsed.data

    // R374 (§4): OSNOVA = aktivna strežniška verzija cenika (EN VIR — ista
    // plast kot /api/quotes). Klientov override je SAMO predogled kalkulatorja;
    // uradna verzija ponudbe (POST /api/quotes) klientovih cen NE sprejme.
    const active = await getActivePriceBookVersion()
    if (!active) {
      return NextResponse.json(
        { error: 'Ni aktivne verzije cenika — izračun ponudbe ni mogoč (fail-closed).' },
        { status: 503 },
      )
    }

    const spec = mergeSpec(specOverride ?? {})
    const priceBook = mergePriceBook((priceOverride ?? {}) as Record<string, unknown>, active.prices)
    const vecs: Vec3[] = points.map((p) => ({ x: p.xM, y: p.yM ?? 0, z: p.zM }))
    const layout = layoutRailing(perimeterOf(vecs, closed, overridesMm ?? {}), spec)
    const quote = buildQuote(layout, spec, priceBook)

    // R151 (§35): reprodukcija — odtis nad UČINKOVITIMI vhodi (združena
    // specifikacija + združen cenik, točke v vrstnem redu). Isti učinkoviti
    // vhod + ista verzija formule = isti total (dokazljivo brez ugibanja).
    const reproducibility = quoteInputFingerprint({
      points: points.map((p) => ({ xM: p.xM, yM: p.yM ?? 0, zM: p.zM })),
      closed,
      overridesMm: overridesMm ?? {},
      spec,
      prices: priceBook,
    })

    if (auth.kind === 'user') {
      auditAsync({
        request,
        session: auth.session,
        akcija: 'QUOTE_CALCULATED',
        projectId: projectId ?? null,
        newValue: { total: quote.total, runM: quote.runM, lines: quote.items.length, inputHash: reproducibility.inputHash },
      })
    }

    return NextResponse.json({
      quote,
      summary: quoteSummary(layout, spec, quote),
      warnings: layout.warnings,
      cutList: quote.cutList,
      reproducibility,
      priceBookVersion: { id: active.id, version: active.version },
    })
  } catch (error) {
    if (error instanceof PriceBookStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    console.error('Quote POST error:', error)
    return NextResponse.json({ error: 'Napaka pri izračunu ponudbe' }, { status: 500 })
  }
}

// GET vrne OSNOVO cenika za vmesnik — R374: aktivno strežniško verzijo (ne
// več privzetih vrednosti iz kode). Brez aktivne verzije → 503 fail-closed.
export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const active = await getActivePriceBookVersion()
    if (!active) {
      return NextResponse.json(
        { error: 'Ni aktivne verzije cenika — kontaktiraj odgovorno osebo.' },
        { status: 503 },
      )
    }
    return NextResponse.json({
      prices: active.prices,
      priceBookVersion: { id: active.id, version: active.version, status: active.status },
      items: active.items,
    })
  } catch (error) {
    if (error instanceof PriceBookStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    console.error('Quote GET error:', error)
    return NextResponse.json({ error: 'Napaka pri branju cenika' }, { status: 500 })
  }
}
