/**
 * R119 — CANONICAL CHAIN AUDIT (en vir resnice)
 * ---------------------------------------------------------------------------
 * Dokaz: isti izmerjeni vhod (MeasurementSession) poganja VSE nadaljnje plasti,
 * nič ni preračunano iz drugih virov:
 *
 *   Measurement (server-avtoritativna geometrija)
 *       → fence-engine (panel/vizualizacija pot)
 *       → railing-layout (proizvodna pot: LayoutResult)
 *       → buildQuote (BOM/cena)
 *   in: enak vhod → bajtno identičen rezultat (determinizem).
 *
 * To je test "ONE SOURCE OF TRUTH" iz revizije R119: če katera plast kdaj
 * začne računati svojo geometrijo, ta test pade.
 */
import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { detectFeatures, buildSession, mapToGeometry } from '@/lib/measurement'
import type { ScaleReference } from '@/lib/measurement/types'
import type { ImageBuffer } from '@/lib/viz/types'
import {
  defaultRailingSpec,
  layoutRailing,
  mergeSpec,
  perimeterOf,
  totalRunMm,
  glassAreaM2,
  handrailLengthMm,
} from '@/lib/railing-layout'
import { buildQuote, defaultPriceBook, quoteSummary } from '@/lib/quote'

// ── Sintetični vhod (isti vzorec kot measurement-sdk.test.ts, determinističen) ──

function fillRect(
  img: ImageBuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgb: [number, number, number],
) {
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(img.h, Math.ceil(y1)); y++) {
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(img.w, Math.ceil(x1)); x++) {
      const p = (y * img.w + x) * 4
      img.data[p] = rgb[0]
      img.data[p + 1] = rgb[1]
      img.data[p + 2] = rgb[2]
      img.data[p + 3] = 255
    }
  }
}

function syntheticBalcony(w = 960, h = 640): ImageBuffer {
  const yTop = 0.3
  const yBottom = 0.62
  const x0 = 0.1
  const x1 = 0.9
  const postCount = 5
  const img: ImageBuffer = { data: new Uint8ClampedArray(w * h * 4), w, h }
  fillRect(img, 0, 0, w, h, [215, 218, 222])
  const dark: [number, number, number] = [35, 38, 42]
  const tPx = 4
  fillRect(img, x0 * w, yTop * h - tPx, x1 * w, yTop * h + tPx, dark)
  fillRect(img, x0 * w, yBottom * h - tPx, x1 * w, yBottom * h + tPx, dark)
  for (let i = 0; i < postCount; i++) {
    const x = x0 + ((i + 1) * (x1 - x0)) / (postCount + 1)
    fillRect(img, x * w - 3, yTop * h, x * w + 3, yBottom * h, dark)
  }
  return img
}

/** Referenca čez širino slike = 5000 mm (kot v produkcijskem UI). */
const REF: ScaleReference = {
  p1: { x: 0.0, y: 0.8 },
  p2: { x: 1.0, y: 0.8 },
  knownMm: 5000,
  kind: 'user-known-measure',
}

const sha = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex')

/** Celoten kanonični vhod: enkrat zgrajena, server-avtoritativna seja. */
function buildCanonicalSession() {
  const { features, metrics } = detectFeatures({ frames: [syntheticBalcony()] })
  return buildSession({
    sessionId: 'r119-canonical-chain',
    source: 'automatic',
    detected: { features: features!, metrics },
    reference: REF,
    confirmed: true,
  })
}

describe('R119 — kanonična veriga Measurement → Layout → BOM → Quote', () => {
  it('meritev je VERIFIED in nosi sledljiv izvor merila', () => {
    const session = buildCanonicalSession()
    expect(session.quality.state).toBe('VERIFIED')
    expect(session.geometry).not.toBeNull()
    expect(session.geometry!.totalLengthMm.provenance).toContain('user-known-measure')
    expect(session.geometry!.heightMm.provenance).toContain('user-known-measure')
  })

  it('fence-engine IN railing-layout sevata iz iste meritve (brez drugega vira)', () => {
    const session = buildCanonicalSession()
    const g = session.geometry!

    // Pot A — fence-engine (panel/vizualizacija): mapToGeometry je edini most
    const mapped = mapToGeometry({
      session,
      productId: 'roksal.woodcore.polna-128', // katalogski izdelek iz Product SDK
      orientation: 'horizontal',
      gapMm: 30,
      postWidthMm: 60,
    })
    // fence request SLEDI meritvi: širina = zaokrožena izmerjena dolžina
    expect(mapped.fenceRequest.fenceWidthMm).toBe(Math.round(g.totalLengthMm.valueMm))
    expect(mapped.fenceRequest.fenceHeightMm).toBe(Math.round(g.heightMm.valueMm))

    // Pot B — railing-layout (proizvodnja): perimeter je zgrajen IZ segmentov meritve
    // (ravni balkon: 1 segment = 1 daljica x-osi; L/U bi imel več)
    const points = g.segments.map((s) => ({
      // točka konca segmenta v metrih, z višino iz meritve
      x: (s.startMm + s.lengthMm) / 1000,
      y: 0,
      z: 0,
    }))
    points.unshift({ x: 0, y: 0, z: 0 }) // začetek balkona
    const spec = mergeSpec({})
    const per = perimeterOf(points, false)
    const layout = layoutRailing(per, spec)

    // ⚖ KLJUČNA INVARIANTA: dolžina v proizvodnem layoutu = izmerjena dolžina.
    // (toleranca = zaokroževanje na cel mm)
    const measuredMm = g.totalLengthMm.valueMm
    expect(Math.abs(totalRunMm(layout) - measuredMm)).toBeLessThanOrEqual(2)
    // ⚖ rezalna dolžina roba (proizvodnja) = izmerjena dolžina
    expect(Math.abs(layout.edges[0].fabricationLengthMm - measuredMm)).toBeLessThanOrEqual(2)

    // takeoffPreview izhaja IZ fence-layouta (ni preračunan)
    expect(mapped.takeoffPreview.boardCount).toBe(mapped.layout.boardCount)
    const linear = mapped.layout.boards.reduce((s, b) => s + b.visibleMm, 0) / 1000
    expect(mapped.takeoffPreview.boardsTotalLinearM).toBeCloseTo(Math.round(linear * 100) / 100, 2)
  })

  it('Quote količine so funkcija LayoutResult-a (BOM ne računa svoje geometrije)', () => {
    const session = buildCanonicalSession()
    const g = session.geometry!
    const points = [{ x: 0, y: 0, z: 0 }, ...g.segments.map((s) => ({ x: (s.startMm + s.lengthMm) / 1000, y: 0, z: 0 }))]
    const spec = mergeSpec({ heightMm: Math.round(g.heightMm.valueMm) })
    const layout = layoutRailing(perimeterOf(points, false), spec)
    const quote = buildQuote(layout, spec, defaultPriceBook())

    // runM = dolžina layouta (iz meritve), ne iz drugega vira (money() zaokroži na 2 dec.)
    expect(quote.runM).toBeCloseTo(totalRunMm(layout) / 1000, 2)

    // steklena površina v postavkah = površina iz layouta
    const glassQty = quote.items
      .filter((i) => i.unit === 'm2')
      .reduce((s, i) => s + i.qty, 0)
    if (glassQty > 0) {
      expect(glassQty).toBeCloseTo(glassAreaM2(layout), 4)
    }

    // ročaj: dolžina v postavkah = dolžina iz layouta
    const handrailQty = quote.items
      .filter((i) => i.unit === 'm')
      .reduce((s, i) => s + i.qty, 0)
    expect(handrailQty).toBeGreaterThan(0)
    // (vsota m-postavk ≥ dolžina ročaja — obsega tudi base profil/rubine)
    expect(handrailQty).toBeGreaterThanOrEqual(handrailLengthMm(layout) / 1000 - 0.01)

    // seštevke so notranje konsistentne (BOM → cena)
    const materialSum = quote.items
      .filter((i) => i.group !== 'LABOUR' && i.group !== 'OTHER')
      .reduce((s, i) => s + i.total, 0)
    expect(quote.materialTotal).toBeCloseTo(materialSum, 2)
    const summary = quoteSummary(layout, spec, quote)
    expect(summary.total).toBe(quote.total)
  })

  it('determinizem: enak vhod → bajtno identična veriga (R119: same data → same result)', () => {
    // dve popolnoma ločeni izvedbi verige
    const run = () => {
      const session = buildCanonicalSession()
      const mapped = mapToGeometry({
        session,
        productId: 'roksal.woodcore.polna-128',
        orientation: 'horizontal',
        gapMm: 30,
        postWidthMm: 60,
      })
      const g = session.geometry!
      const points = [{ x: 0, y: 0, z: 0 }, ...g.segments.map((s) => ({ x: (s.startMm + s.lengthMm) / 1000, y: 0, z: 0 }))]
      const spec = mergeSpec({ heightMm: Math.round(g.heightMm.valueMm) })
      const layout = layoutRailing(perimeterOf(points, false), spec)
      const quote = buildQuote(layout, spec, defaultPriceBook())
      return {
        sessionHash: sha(session),
        fenceHash: sha(mapped.layout),
        layoutHash: sha(layout),
        quoteHash: sha(quote),
      }
    }
    const a = run()
    const b = run()
    expect(a.sessionHash).toBe(b.sessionHash)
    expect(a.fenceHash).toBe(b.fenceHash)
    expect(a.layoutHash).toBe(b.layoutHash)
    expect(a.quoteHash).toBe(b.quoteHash)
  })

  it('zakon: brez merila NI proizvodne verige (geometry null → mapToGeometry vrže)', () => {
    const { features, metrics } = detectFeatures({ frames: [syntheticBalcony()] })
    const session = buildSession({
      sessionId: 'r119-no-scale',
      source: 'automatic',
      detected: { features: features!, metrics },
      reference: null, // ⚠ brez referenčne mere
    })
    expect(session.quality.state).toBe('SCALE_REQUIRED')
    expect(session.geometry).toBeNull()
    expect(() =>
      mapToGeometry({
        session,
        productId: 'roksal.woodcore.polna-128',
        orientation: 'horizontal',
        gapMm: 30,
        postWidthMm: 60,
      }),
    ).toThrow(/merilo je obvezno|geometrije/i)
    // proizvodna pot se iz takšne meritve NE sproži (kličoči mora ustaviti na null)
  })
})
