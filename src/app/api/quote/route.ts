// Roksal — ponudba iz razporeda ograje
// ---------------------------------------------------------------------------
// POST vrne postavke, rezalni seznam in seštevke (material, storitve, popust,
// DDV, skupaj, cena na meter). Cene pridejo iz cenika, ki ga lahko klient
// delno prepiše — tako pisarna in teren računata z istim cenikom.
//
// Vse količine pridejo iz LayoutResult, nikoli niso preračunane znova: število
// panelov v ponudbi je po konstrukciji enako številu panelov v risbi.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticate, unauthorized } from '@/lib/auth'
import { auditAsync } from '@/lib/audit'
import { defaultRailingSpec, layoutRailing, mergeSpec, perimeterOf, type Vec3 } from '@/lib/railing-layout'
import { buildQuote, defaultPriceBook, mergePriceBook, quoteSummary } from '@/lib/quote'
import { quoteSchema } from '@/lib/validations'

export async function POST(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()

  try {
    const body = await request.json().catch(() => null)
    const parsed = quoteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Neveljavni podatki', detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
        { status: 400 },
      )
    }
    const { points, closed, overridesMm, spec: specOverride, prices: priceOverride, projectId } = parsed.data

    const spec = mergeSpec(specOverride ?? {})
    const priceBook = mergePriceBook((priceOverride ?? {}) as Record<string, unknown>)
    const vecs: Vec3[] = points.map((p) => ({ x: p.xM, y: p.yM ?? 0, z: p.zM }))
    const layout = layoutRailing(perimeterOf(vecs, closed, overridesMm ?? {}), spec)
    const quote = buildQuote(layout, spec, priceBook)

    if (auth.kind === 'user') {
      auditAsync({
        request,
        session: auth.session,
        akcija: 'QUOTE_CALCULATED',
        projectId: projectId ?? null,
        newValue: { total: quote.total, runM: quote.runM, lines: quote.items.length },
      })
    }

    return NextResponse.json({
      quote,
      summary: quoteSummary(layout, spec, quote),
      warnings: layout.warnings,
      cutList: quote.cutList,
    })
  } catch (error) {
    console.error('Quote POST error:', error)
    return NextResponse.json({ error: 'Napaka pri izračunu ponudbe' }, { status: 500 })
  }
}

// GET vrne privzeti cenik — vmesnik ga prikaže in pusti urejati.
export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  return NextResponse.json({ prices: defaultPriceBook() })
}
