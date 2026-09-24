/**
 * MEASUREMENT SDK testi (issue #2 §13) — sintetične slike, determinizem,
 * pariteta samodejno/ročno, zakon o neizmišljevanju dimenzij.
 */
import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { detectFeatures, buildSession, resolveScale, mapToGeometry, MEASUREMENT_CONSTANTS } from '../index'
import type { ScaleReference } from '../types'
import type { ImageBuffer } from '@/lib/viz/types'

// ── Sintetična slika (deterministična, brez canvasa) ─────────────────────────

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

/** Svetla slika s temno ograjo: 2 horizontalna pasu + N vertikalnih stebrov. */
function syntheticBalcony(
  w = 960,
  h = 640,
  opts?: { yTop?: number; yBottom?: number; x0?: number; x1?: number; postCount?: number },
): ImageBuffer {
  const yTop = opts?.yTop ?? 0.3
  const yBottom = opts?.yBottom ?? 0.62
  const x0 = opts?.x0 ?? 0.1
  const x1 = opts?.x1 ?? 0.9
  const postCount = opts?.postCount ?? 5
  const img: ImageBuffer = { data: new Uint8ClampedArray(w * h * 4), w, h }
  fillRect(img, 0, 0, w, h, [215, 218, 222]) // svetlo ozadje (nebo/stena)
  const dark: [number, number, number] = [35, 38, 42]
  // horizontalni pasovi (zgornja + spodnja linija ograje), debelina ~4 px
  const tPx = 4
  fillRect(img, x0 * w, yTop * h - tPx, x1 * w, yTop * h + tPx, dark)
  fillRect(img, x0 * w, yBottom * h - tPx, x1 * w, yBottom * h + tPx, dark)
  // vertikalni stebri znotraj pasu
  for (let i = 0; i < postCount; i++) {
    const x = x0 + ((i + 1) * (x1 - x0)) / (postCount + 1)
    fillRect(img, x * w - 3, yTop * h, x * w + 3, yBottom * h, dark)
  }
  return img
}

function blankImage(w = 480, h = 320): ImageBuffer {
  const img: ImageBuffer = { data: new Uint8ClampedArray(w * h * 4), w, h }
  fillRect(img, 0, 0, w, h, [200, 200, 200])
  return img
}

// referenca preko celotne širine slike = 5000 mm → merilo 5000 mm/enoto
const REF: ScaleReference = {
  p1: { x: 0.0, y: 0.8 },
  p2: { x: 1.0, y: 0.8 },
  knownMm: 5000,
  kind: 'user-known-measure',
}

const TOL = 0.02 // 2 % slike ≈ toleranca detekcije

// ── 1. Detekcija ──────────────────────────────────────────────────────────────

describe('detekcija (Sobel + Hough, brez AI)', () => {
  it('zazna raven balkon: 1 run, pravi stebri, kotniki pričakovani', () => {
    const img = syntheticBalcony()
    const { features, metrics } = detectFeatures({ frames: [img] })
    expect(features).not.toBeNull()
    if (!features) return
    expect(features.runs).toHaveLength(1)
    const run = features.runs[0]
    expect(Math.abs(run.yTop - 0.3)).toBeLessThan(TOL)
    expect(Math.abs(run.yBottom - 0.62)).toBeLessThan(TOL)
    expect(Math.abs(run.x0 - 0.1)).toBeLessThan(TOL)
    expect(Math.abs(run.x1 - 0.9)).toBeLessThan(TOL)
    // stebri: 5 notranjih pričakovanih (0.233, 0.366, 0.5, 0.633, 0.766)
    expect(features.posts.length).toBe(5)
    for (let i = 0; i < 5; i++) {
      const expected = 0.1 + ((i + 1) * 0.8) / 6
      expect(Math.abs(features.posts[i].x - expected)).toBeLessThan(TOL)
    }
    expect(features.corners).not.toBeNull()
    // metrike: močne črte, dobra pokritost, konsistentni razmaki
    expect(metrics.lineCoverage).toBeGreaterThan(0.7)
    expect(metrics.postSpacingConsistency).toBeGreaterThan(0.8)
    expect(metrics.lineSupportTop).toBeGreaterThan(0.5)
  })

  it('unifomna slika brez ograje → INSUFFICIENT_DATA (features null)', () => {
    const { features, metrics } = detectFeatures({ frames: [blankImage()] })
    expect(features).toBeNull()
    expect(metrics.frames).toBe(1)
  })

  it('temporalna stabilnost: 2 identična frame-a → 1.0', () => {
    const img = syntheticBalcony()
    const { metrics } = detectFeatures({ frames: [img, img] })
    expect(metrics.frames).toBe(2)
    expect(metrics.temporalStability).toBeGreaterThan(0.99)
  })

  it('temporalna stabilnost: premaknjen frame → < 1 (objektivno)', () => {
    const img = syntheticBalcony()
    const shifted = syntheticBalcony(960, 640, { yTop: 0.34, yBottom: 0.66 })
    const { metrics } = detectFeatures({ frames: [img, shifted] })
    expect(metrics.temporalStability).toBeLessThan(1)
    expect(metrics.temporalStability).toBeGreaterThanOrEqual(0)
  })

  it('velika slika (1920×1280) → delovna ločljivost 480, detekcija deluje', () => {
    const img = syntheticBalcony(1920, 1280)
    const { features } = detectFeatures({ frames: [img] })
    expect(features).not.toBeNull()
    expect(Math.abs(features!.runs[0].yTop - 0.3)).toBeLessThan(TOL)
  })
})

// ── 2. Merilo — ZAKON: brez reference NI dimenzij ─────────────────────────────

describe('merilo (scale) — nikoli ne izmišljuj', () => {
  it('brez reference → scale null + razlog', () => {
    const r = resolveScale(null)
    expect(r.scale).toBeNull()
    expect(r.reason).toContain('referenčne mere')
  })

  it('preveč blizu točki → zavrnjeno z razlogom', () => {
    const r = resolveScale({
      p1: { x: 0.5, y: 0.5 },
      p2: { x: 0.505, y: 0.5 },
      knownMm: 1000,
      kind: 'user-known-measure',
    })
    expect(r.scale).toBeNull()
    expect(r.reason).toContain('preveč blizu')
  })

  it('ne-finite / ne-realistične mm → zavrnjeno', () => {
    expect(
      resolveScale({ p1: { x: 0, y: 0 }, p2: { x: 0.5, y: 0 }, knownMm: NaN, kind: 'user-known-measure' }).scale,
    ).toBeNull()
    expect(
      resolveScale({ p1: { x: 0, y: 0 }, p2: { x: 0.5, y: 0 }, knownMm: -5, kind: 'user-known-measure' }).scale,
    ).toBeNull()
  })

  it('veljavna referenca → natančno merilo knownMm/len', () => {
    const r = resolveScale(REF)
    expect(r.scale).not.toBeNull()
    expect(r.scale!.mmPerUnitX).toBeCloseTo(5000, 6)
    expect(r.scale!.referenceLengthUnits).toBeCloseTo(1.0, 6)
  })
})

// ── 3. Motor: stanja + dimenzije ──────────────────────────────────────────────

describe('measurement engine — stanja kakovosti', () => {
  it('detekcija brez reference → SCALE_REQUIRED, geometry NULL (ni izmišljenih mm)', () => {
    const { features, metrics } = detectFeatures({ frames: [syntheticBalcony()] })
    const session = buildSession({
      sessionId: 'test-scale-required',
      source: 'automatic',
      detected: { features: features!, metrics },
      reference: null,
    })
    expect(session.quality.state).toBe('SCALE_REQUIRED')
    expect(session.geometry).toBeNull()
    expect(session.features).not.toBeNull()
    expect(session.quality.guidance.missing).toContain('merilo')
  })

  it('detekcija + referenca → MEASUREMENT_READY z natančnimi dimenzijami', () => {
    const { features, metrics } = detectFeatures({ frames: [syntheticBalcony()] })
    const session = buildSession({
      sessionId: 'test-ready',
      source: 'automatic',
      detected: { features: features!, metrics },
      reference: REF,
    })
    expect(session.quality.state).toBe('MEASUREMENT_READY')
    expect(session.geometry).not.toBeNull()
    const g = session.geometry!
    // pričakovano: run 0.1..0.9 × 5000 mm = 4000 mm
    expect(g.totalLengthMm.valueMm).toBeGreaterThan(3900)
    expect(g.totalLengthMm.valueMm).toBeLessThan(4100)
    // višina: (0.62 − 0.30) × 5000 = 1600 mm
    expect(g.heightMm.valueMm).toBeGreaterThan(1500)
    expect(g.heightMm.valueMm).toBeLessThan(1700)
    expect(g.postCount).toBe(5)
    expect(g.segments).toHaveLength(1)
    // vsaka vrednost ima sledljiv izvor
    expect(g.totalLengthMm.provenance).toContain('user-known-measure')
    expect(g.totalLengthMm.uncertaintyMm).toBeGreaterThan(0)
  })

  it('potrjena meritev → VERIFIED; popravljen ročni vhod brez potrditve → USER_REVIEW_REQUIRED', () => {
    const { features, metrics } = detectFeatures({ frames: [syntheticBalcony()] })
    const base = {
      sessionId: 'test-verified',
      detected: { features: features!, metrics },
      reference: REF,
    }
    const confirmed = buildSession({ ...base, source: 'automatic', confirmed: true })
    expect(confirmed.quality.state).toBe('VERIFIED')

    const manual = buildSession({
      sessionId: 'test-review',
      source: 'hybrid',
      detected: { features: features!, metrics },
      manual: {
        path: [{ x: 0.1, y: 0.62 }, { x: 0.9, y: 0.62 }],
        top: [{ x: 0.1, y: 0.3 }, { x: 0.9, y: 0.3 }],
      },
      reference: REF,
      manualCorrections: 2,
    })
    expect(manual.quality.state).toBe('USER_REVIEW_REQUIRED')
    expect(manual.quality.manualCorrections).toBe(2)
  })

  it('ročni način: L-balkon (4 točke) → 3 segmenti z naraščajočimi startMm', () => {
    const session = buildSession({
      sessionId: 'test-l-shape',
      source: 'manual',
      detected: null,
      manual: {
        path: [{ x: 0.05, y: 0.7 }, { x: 0.45, y: 0.7 }, { x: 0.45, y: 0.45 }, { x: 0.95, y: 0.45 }],
        top: [{ x: 0.05, y: 0.2 }, { x: 0.45, y: 0.2 }, { x: 0.45, y: 0.1 }, { x: 0.95, y: 0.1 }],
      },
      reference: REF,
    })
    expect(session.quality.state).toBe('MEASUREMENT_READY')
    expect(session.geometry!.segments).toHaveLength(3)
    const starts = session.geometry!.segments.map((s) => s.startMm)
    for (let i = 1; i < starts.length; i++) expect(starts[i]).toBeGreaterThan(starts[i - 1])
    const sum = session.geometry!.segments.reduce((s, x) => s + x.lengthMm, 0)
    expect(Math.abs(sum - session.geometry!.totalLengthMm.valueMm)).toBeLessThan(0.01)
  })

  it('napačen ročni vhod (top.length != path.length) → MeasurementValidationError', () => {
    expect(() =>
      buildSession({
        sessionId: 'test-bad',
        source: 'manual',
        detected: null,
        manual: {
          path: [{ x: 0.1, y: 0.6 }, { x: 0.9, y: 0.6 }],
          top: [{ x: 0.1, y: 0.3 }],
        },
        reference: REF,
      }),
    ).toThrowError(/enako število točk/)
  })
})

// ── 4. PARITETA: isti vhod → isti rezultat, ne glede na način ─────────────────

describe('pariteta samodejno ≡ ročno (issue #2 acceptance)', () => {
  it('ročne točke = zaznane vrednosti → IDENTIČNA geometrija (mm)', () => {
    const img = syntheticBalcony()
    const { features, metrics } = detectFeatures({ frames: [img] })
    const run = features!.runs[0]

    const automatic = buildSession({
      sessionId: 'parity-auto',
      source: 'automatic',
      detected: { features: features!, metrics },
      reference: REF,
    })

    const manual = buildSession({
      sessionId: 'parity-manual',
      source: 'manual',
      detected: null,
      manual: {
        path: [{ x: run.x0, y: run.yBottom }, { x: run.x1, y: run.yBottom }],
        top: [{ x: run.x0, y: run.yTop }, { x: run.x1, y: run.yTop }],
        posts: features!.posts.map((p) => ({ x: p.x, y: 0.5 })),
      },
      reference: REF,
    })

    expect(manual.geometry).not.toBeNull()
    expect(automatic.geometry!.totalLengthMm.valueMm).toBe(manual.geometry!.totalLengthMm.valueMm)
    expect(automatic.geometry!.heightMm.valueMm).toBe(manual.geometry!.heightMm.valueMm)
    expect(automatic.geometry!.postPositionsMm).toEqual(manual.geometry!.postPositionsMm)
    expect(automatic.geometry!.postCount).toBe(manual.geometry!.postCount)
  })
})

// ── 5. Determinizem 100× ──────────────────────────────────────────────────────

describe('determinizem (issue #2: isti vhod → isti izhod)', () => {
  it('100× detekcija + seja → identičen JSON + enak SHA-256', () => {
    const img = syntheticBalcony()
    const runOnce = () => {
      const { features, metrics } = detectFeatures({ frames: [img] })
      const session = buildSession({
        sessionId: 'det-100',
        source: 'automatic',
        detected: { features: features!, metrics },
        reference: REF,
        confirmed: true,
      })
      return JSON.stringify(session)
    }
    const first = runOnce()
    const h1 = createHash('sha256').update(first).digest('hex')
    for (let i = 0; i < 99; i++) {
      const next = runOnce()
      expect(next).toBe(first)
    }
    const h2 = createHash('sha256').update(first).digest('hex')
    expect(h2).toBe(h1)
  })
})

// ── 6. Geometrijsko mapiranje na fence-engine (EN vir resnice) ────────────────

describe('mapToGeometry (fence-engine)', () => {
  it('seja z geometrijo → FenceLayout + takeoffPreview iz obstoječega engine', () => {
    const { features, metrics } = detectFeatures({ frames: [syntheticBalcony()] })
    const session = buildSession({
      sessionId: 'geom-test',
      source: 'automatic',
      detected: { features: features!, metrics },
      reference: REF,
      confirmed: true,
    })
    const mapped = mapToGeometry({
      session,
      productId: 'roksal.woodcore.polna-128',
      orientation: 'horizontal',
      gapMm: 30,
      postWidthMm: 60,
      colorRgb: [80, 80, 80],
    })
    expect(mapped.fenceRequest.fenceWidthMm).toBe(
      Math.round(session.geometry!.totalLengthMm.valueMm),
    )
    expect(mapped.layout.boardCount).toBeGreaterThanOrEqual(1)
    expect(mapped.takeoffPreview.boardsTotalLinearM).toBeGreaterThan(0)
    expect(mapped.takeoffPreview.postCount).toBe(5)
  })

  it('seja brez geometrije (SCALE_REQUIRED) → GeometryMappingError', () => {
    const { features, metrics } = detectFeatures({ frames: [syntheticBalcony()] })
    const session = buildSession({
      sessionId: 'geom-no-scale',
      source: 'automatic',
      detected: { features: features!, metrics },
      reference: null,
    })
    expect(() =>
      mapToGeometry({
        session,
        productId: 'roksal.woodcore.polna-128',
        orientation: 'horizontal',
        gapMm: 30,
        postWidthMm: 60,
      }),
    ).toThrowError(/merilo je obvezno/)
  })

  it('izven proizvodnega območja (dolžina > 20000 mm) → zavrnjeno', () => {
    const { features, metrics } = detectFeatures({ frames: [syntheticBalcony()] })
    const session = buildSession({
      sessionId: 'geom-huge',
      source: 'automatic',
      detected: { features: features!, metrics },
      reference: { p1: { x: 0, y: 0.8 }, p2: { x: 1, y: 0.8 }, knownMm: 60000, kind: 'user-known-measure' },
    })
    expect(() =>
      mapToGeometry({
        session,
        productId: 'roksal.woodcore.polna-128',
        orientation: 'horizontal',
        gapMm: 30,
        postWidthMm: 60,
      }),
    ).toThrowError(/izven proizvodnega območja/)
  })
})

// ── 7. Konstante ──────────────────────────────────────────────────────────────

describe('konstante', () => {
  it('delovna ločljivost in tolerance so dokumentirane in stabilne', () => {
    expect(MEASUREMENT_CONSTANTS.workMaxDim).toBe(480)
    expect(MEASUREMENT_CONSTANTS.detectionTolerancePx).toBe(1)
    expect(MEASUREMENT_CONSTANTS.maxFrames).toBe(3)
  })
})
