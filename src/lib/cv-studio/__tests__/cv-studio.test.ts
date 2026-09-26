/**
 * CV STUDIO — testi (issues #10 + #11 §13).
 *
 * Pokritje: raven balkon, stopnice, ovira, temna/svetla/šumna/prazna slika,
 * neveljaven vhod, determinizem (100×), sessionId idempotenca, placement
 * (veljaven/invalid/pravila produkta), projekcija (afina + homografija +
 * fallback), safety chain (CV brez potrditve NI resnica; invalid placement
 * ne pride v BOM verigo).
 */
import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { NormPoint } from '@/lib/measurement'
import { analyzeScene, SceneValidationError } from '../scene'
import { evaluatePlacement, projectPlacement } from '../placement'
import { resolveScale } from '@/lib/measurement/scale'
import { buildSession } from '@/lib/measurement/engine'
import { mapToGeometry, GeometryMappingError } from '@/lib/measurement/geometry'
import type { ImageBuffer } from '@/lib/viz/types'
import type { SceneAnalysis } from '../types'
import {
  brightImage,
  blankImage,
  darkImage,
  noisyBalcony,
  syntheticBalcony,
  syntheticBalconyWithObstacle,
  syntheticStairs,
} from './fixtures'

function sha(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

// ───────────────────────────────────────────────────────────────────────────
// Scene understanding
// ───────────────────────────────────────────────────────────────────────────

describe('analyzeScene — raven balkon', () => {
  const img = syntheticBalcony()
  let analysis: SceneAnalysis
  it('zazna rail + balkonni rob + stebre (PROPOSED)', () => {
    analysis = analyzeScene(img)
    const types = analysis.elements.map((e) => e.type)
    expect(types).toContain('RAILING')
    expect(types).toContain('BALCONY_EDGE')
    const posts = analysis.elements.filter((e) => e.type === 'RAILING_POST')
    expect(posts.length).toBeGreaterThanOrEqual(3)
    for (const e of analysis.elements) {
      expect(['PROPOSED', 'NEEDS_CONFIRMATION']).toContain(e.state)
    }
  })
  it('features so kompatibilne z Measurement SDK (runs/posts/corners)', () => {
    expect(analysis.features).not.toBeNull()
    expect(analysis.features!.runs.length).toBe(1)
    expect(analysis.features!.corners).not.toBeNull()
    expect(analysis.perspectiveHint).toBe(true)
  })
  it('brez mm vrednosti (CV NI vir mer)', () => {
    const json = JSON.stringify(analysis)
    expect(json).not.toContain('valueMm')
    expect(json).not.toContain('mmPerUnit')
  })
  it('quality metrike so izpolnjene', () => {
    expect(analysis.quality.metrics.edgeDensity).toBeGreaterThan(0)
    expect(analysis.quality.usable).toBe(true)
    expect(analysis.quality.reasons).toHaveLength(0)
  })
  it('guidance je iskren (merilo manjka)', () => {
    expect(analysis.guidance.missing).toContain('referenčna mera')
  })
})

describe('analyzeScene — stopnice (diagonalne družine)', () => {
  it('predlaga STAIR + STAIR_EDGE z NEEDS_CONFIRMATION (nikoli potrjeno)', () => {
    const analysis = analyzeScene(syntheticStairs())
    const stairs = analysis.elements.filter((e) => e.type === 'STAIR')
    const edges = analysis.elements.filter((e) => e.type === 'STAIR_EDGE')
    expect(stairs.length).toBeGreaterThanOrEqual(1)
    expect(edges.length).toBeGreaterThanOrEqual(3)
    for (const e of [...stairs, ...edges]) {
      expect(e.state).toBe('NEEDS_CONFIRMATION')
      expect(e.warnings.join(' ')).toMatch(/POTRDI|potrdi/)
    }
  })
})

describe('analyzeScene — ovira', () => {
  it('predlaga OBSTACLE (NEEDS_CONFIRMATION) znotraj pasu', () => {
    const analysis = analyzeScene(syntheticBalconyWithObstacle())
    const obstacles = analysis.elements.filter((e) => e.type === 'OBSTACLE')
    expect(obstacles.length).toBeGreaterThanOrEqual(1)
    expect(obstacles[0].state).toBe('NEEDS_CONFIRMATION')
    const g = obstacles[0].geometry
    expect(g.kind).toBe('bbox')
  })
})

describe('analyzeScene — neuspešni/adversarialni vhodi', () => {
  it('prazna slika: brez elementov, iskreno INSUFFICIENT vodstvo', () => {
    const analysis = analyzeScene(blankImage())
    const auto = analysis.elements.filter((e) => e.type !== 'STAIR' && e.type !== 'STAIR_EDGE')
    expect(auto).toHaveLength(0)
    expect(analysis.features).toBeNull()
    expect(analysis.guidance.seen).toContain('Ni zanesljive')
  })
  it('temna slika: opozorilo, NE blokada (ročni način ostaja odprt)', () => {
    const analysis = analyzeScene(darkImage())
    expect(analysis.quality.brightness).toBeLessThan(0.08)
    expect(analysis.warnings.join(' ')).toContain('temna')
  })
  it('svetla slika: opozorilo, NE blokada', () => {
    const analysis = analyzeScene(brightImage())
    expect(analysis.quality.brightness).toBeGreaterThan(0.92)
    expect(analysis.warnings.join(' ')).toContain('svetla')
  })
  it('šumna slika: deterministična analiza + šum opozorilo', () => {
    const a1 = analyzeScene(noisyBalcony())
    const a2 = analyzeScene(noisyBalcony())
    expect(JSON.stringify(a1)).toBe(JSON.stringify(a2))
    expect(a1.quality.noiseEstimate).toBeGreaterThan(0)
  })
  it('neveljavne dimenzije → SceneValidationError', () => {
    expect(() => analyzeScene({ data: new Uint8ClampedArray(0), w: 0, h: 0 })).toThrow(SceneValidationError)
    const img = syntheticBalcony(100, 100)
    expect(() => analyzeScene({ ...img, data: img.data.slice(0, 10) })).toThrow(SceneValidationError)
  })
  it('sessionId: enak vhod → enak id, drugačen vhod → drugačen id', () => {
    const a = analyzeScene(syntheticBalcony())
    const b = analyzeScene(syntheticBalcony())
    const c = analyzeScene(syntheticBalcony(800, 600))
    expect(a.sessionId).toBe(b.sessionId)
    expect(a.sessionId).not.toBe(c.sessionId)
    expect(a.sessionId).toMatch(/^[0-9a-f]{64}$/)
  })
  it('DETERMINIZEM 100×: bajtno identičen JSON + enak sha256', () => {
    const img = syntheticBalcony()
    const first = JSON.stringify(analyzeScene(img))
    const firstHash = sha(first)
    for (let i = 0; i < 100; i++) {
      const run = JSON.stringify(analyzeScene(img))
      expect(sha(run)).toBe(firstHash)
    }
    // R180 — ekspliciten timeout 60 s: zanka 101× analyzeScene porabi ~14,6 s
    // (nožna meja privzetih 15 s — flaknilo ob vzporednem dev strežniku).
    // TRDITEV NESPREMENJENA (še vedno 100× bajtno identično) — samo zalogovnik.
  }, 60_000)
})

// ───────────────────────────────────────────────────────────────────────────
// PWC Placement Engine (issue #11 §7)
// ───────────────────────────────────────────────────────────────────────────

describe('evaluatePlacement — veljavna postavitev', () => {
  const input = {
    productId: 'roksal.woodcore.romb-67',
    orientation: 'horizontal' as const,
    gapMm: 10,
    postWidthMm: 60,
    fenceWidthMm: 5000,
    fenceHeightMm: 1100,
    posts: { widthMm: 60, positionsMm: [1250, 2500, 3750] },
  }
  it('valid → layout iz fence-engine (en vir resnice)', () => {
    const r = evaluatePlacement(input)
    expect(r.valid).toBe(true)
    expect(r.layout).not.toBeNull()
    expect(r.layout!.boardCount).toBeGreaterThan(0)
    expect(r.layout!.productId).toBe('woodcore-romb-67') // kataloški ključ
    expect(r.algorithmVersion).toMatch(/^pwc-placement@/)
  })
  it('DETERMINIZEM: enak vhod → bajtno enak izhod', () => {
    const a = JSON.stringify(evaluatePlacement(input))
    const b = JSON.stringify(evaluatePlacement(input))
    expect(sha(a)).toBe(sha(b))
  })
})

describe('evaluatePlacement — kršitve pravil produkta', () => {
  it('razmak izven dovoljenega → GAP_OUT_OF_RANGE, brez layouta', () => {
    const r = evaluatePlacement({
      productId: 'roksal.woodcore.romb-67',
      orientation: 'horizontal',
      gapMm: 50, // romb dovoljuje 2..30
      postWidthMm: 60,
      fenceWidthMm: 5000,
      fenceHeightMm: 1100,
    })
    expect(r.valid).toBe(false)
    expect(r.layout).toBeNull()
    expect(r.violations.map((v) => v.code)).toContain('GAP_OUT_OF_RANGE')
    expect(r.reason).toContain('Razmak')
  })
  it('orientacija ni podprta → ORIENTATION_NOT_SUPPORTED', () => {
    const r = evaluatePlacement({
      productId: 'roksal.woodcore.deska-150', // samo horizontalna (terasna)
      orientation: 'vertical',
      gapMm: 10,
      postWidthMm: 60,
      fenceWidthMm: 5000,
      fenceHeightMm: 1100,
    })
    expect(r.valid).toBe(false)
    expect(r.violations.map((v) => v.code)).toContain('ORIENTATION_NOT_SUPPORTED')
  })
  it('kubo (brez katalog max razmaka) brez stebrov → POSTS_REQUIRED', () => {
    const r = evaluatePlacement({
      productId: 'roksal.woodcore.kubo-80-42',
      orientation: 'vertical',
      gapMm: 10,
      postWidthMm: 60,
      fenceWidthMm: 5000,
      fenceHeightMm: 1100,
    })
    expect(r.valid).toBe(false)
    expect(r.violations.map((v) => v.code)).toContain('POSTS_REQUIRED')
  })
  it('kubo z eksplicitnimi stebri → valid', () => {
    const r = evaluatePlacement({
      productId: 'roksal.woodcore.kubo-80-42',
      orientation: 'vertical',
      gapMm: 10,
      postWidthMm: 60,
      fenceWidthMm: 5000,
      fenceHeightMm: 1100,
      posts: { widthMm: 60, positionsMm: [1667, 3333] },
    })
    expect(r.valid).toBe(true)
    expect(r.layout).not.toBeNull()
  })
  it('razmak stebrov presega katalog max → POSTS_INVALID', () => {
    const r = evaluatePlacement({
      productId: 'roksal.woodcore.romb-67', // max H razmak 1450 mm
      orientation: 'horizontal',
      gapMm: 10,
      postWidthMm: 60,
      fenceWidthMm: 5000,
      fenceHeightMm: 1100,
      posts: { widthMm: 60, positionsMm: [1000, 3600] }, // span 1000..3600 = 2600 mm
    })
    expect(r.valid).toBe(false)
    expect(r.violations.map((v) => v.code)).toContain('POSTS_INVALID')
  })
  it('neurejene/duplicirane pozicije → POSTS_INVALID (ni tišega razvrščanja)', () => {
    const r = evaluatePlacement({
      productId: 'roksal.woodcore.romb-67',
      orientation: 'horizontal',
      gapMm: 10,
      postWidthMm: 60,
      fenceWidthMm: 5000,
      fenceHeightMm: 1100,
      posts: { widthMm: 60, positionsMm: [3000, 1250] },
    })
    expect(r.valid).toBe(false)
    expect(r.violations.map((v) => v.code)).toContain('POSTS_INVALID')
  })
  it('neznan produkt → UNKNOWN_PRODUCT', () => {
    const r = evaluatePlacement({
      productId: 'roksal.woodcore.ne-obstaja',
      orientation: 'horizontal',
      gapMm: 10,
      postWidthMm: 60,
      fenceWidthMm: 5000,
      fenceHeightMm: 1100,
    })
    expect(r.valid).toBe(false)
    expect(r.violations.map((v) => v.code)).toContain('UNKNOWN_PRODUCT')
  })
  it('NaN vhod → NON_FINITE_INPUT (fail-closed)', () => {
    const r = evaluatePlacement({
      productId: 'roksal.woodcore.romb-67',
      orientation: 'horizontal',
      gapMm: Number.NaN,
      postWidthMm: 60,
      fenceWidthMm: 5000,
      fenceHeightMm: 1100,
    })
    expect(r.valid).toBe(false)
    expect(r.violations.map((v) => v.code)).toContain('NON_FINITE_INPUT')
  })
  it('širina izven proizvodnega območja → WIDTH_OUT_OF_RANGE', () => {
    const r = evaluatePlacement({
      productId: 'roksal.woodcore.romb-67',
      orientation: 'horizontal',
      gapMm: 10,
      postWidthMm: 60,
      fenceWidthMm: 200,
      fenceHeightMm: 1100,
    })
    expect(r.valid).toBe(false)
    expect(r.violations.map((v) => v.code)).toContain('WIDTH_OUT_OF_RANGE')
  })
  it('ročaj pri profilu brez podpore → HANDLE_NOT_SUPPORTED', () => {
    const r = evaluatePlacement({
      productId: 'roksal.woodcore.romb-67', // ročaj NI podprt
      orientation: 'horizontal',
      gapMm: 10,
      postWidthMm: 60,
      fenceWidthMm: 5000,
      fenceHeightMm: 1100,
      handle: true,
    })
    expect(r.valid).toBe(false)
    expect(r.violations.map((v) => v.code)).toContain('HANDLE_NOT_SUPPORTED')
  })
})

describe('SAFETY CHAIN (issue #11 §13)', () => {
  it('INVALID placement ne pride v BOM verigo (mapToGeometry vrže za isti vhod)', () => {
    const placement = evaluatePlacement({
      productId: 'roksal.woodcore.romb-67',
      orientation: 'horizontal',
      gapMm: 50, // kršitev
      postWidthMm: 60,
      fenceWidthMm: 5000,
      fenceHeightMm: 1100,
    })
    expect(placement.valid).toBe(false)
    expect(placement.layout).toBeNull()
    // ista kršitev v kanonični verigi → GeometryMappingError (BOM ni mogoč)
    const img = syntheticBalcony()
    const detection = { features: analyzeScene(img).features!, metrics: analyzeScene(img).quality.metrics }
    const session = buildSession({
      sessionId: 'chain-test',
      source: 'automatic',
      detected: detection,
      reference: { p1: { x: 0.05, y: 0.5 }, p2: { x: 0.95, y: 0.5 }, knownMm: 5000, kind: 'user-known-measure' },
      confirmed: true,
    })
    expect(() =>
      mapToGeometry({ session, productId: 'roksal.woodcore.romb-67', orientation: 'horizontal', gapMm: 50, postWidthMm: 60 }),
    ).toThrow(GeometryMappingError)
  })
  it('CV zaznave brez potrditve NIKOLI niso VERIFIED resnica', () => {
    const img = syntheticBalcony()
    const analysis = analyzeScene(img)
    const session = buildSession({
      sessionId: analysis.sessionId,
      source: 'automatic',
      detected: { features: analysis.features!, metrics: analysis.quality.metrics },
      reference: null, // brez reference → brez merila
      confirmed: false, // NI potrjeno
    })
    expect(session.quality.state).not.toBe('VERIFIED')
    expect(session.geometry).toBeNull() // brez merila ni geometrije v mm
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Projekcija (issue #11 §8)
// ───────────────────────────────────────────────────────────────────────────

describe('projectPlacement — 2D afina približek', () => {
  const scale = resolveScale({
    p1: { x: 0.05, y: 0.5 },
    p2: { x: 0.95, y: 0.5 },
    knownMm: 6000,
    kind: 'user-known-measure',
  }).scale!
  const segment = { start: { x: 0.1, y: 0.8 }, end: { x: 0.9, y: 0.8 } }

  function setup() {
    const placement = evaluatePlacement({
      productId: 'roksal.woodcore.romb-67',
      orientation: 'horizontal',
      gapMm: 10,
      postWidthMm: 60,
      fenceWidthMm: 4800, // 0.8 × 6000 = točno segment
      fenceHeightMm: 1100,
      posts: { widthMm: 60, positionsMm: [1200, 2400, 3600] },
    })
    expect(placement.valid).toBe(true)
    return projectPlacement({
      layout: placement.layout!,
      orientation: 'horizontal',
      segment,
      scale,
      postsWidthMm: 60,
      postsPositionsMm: [1200, 2400, 3600],
    })
  }

  it('vrne affine-approximation z iskrenim opozorilom', () => {
    const r = setup()
    expect(r.kind).toBe('affine-approximation')
    expect(r.warnings.join(' ')).toContain('PBLIŽEK')
  })
  it('deske se skladajo na segment (dno pri segment y, višje deske zgoraj)', () => {
    const r = setup()
    expect(r.boards.length).toBeGreaterThan(0)
    const bottom = r.boards[0].quad[2] // BR deske 0 (dno)
    expect(Math.abs(bottom.y - segment.start.y)).toBeLessThan(0.02)
    if (r.boards.length > 1) {
      // deska 1 mora biti NAD desko 0 (manjši y)
      expect(r.boards[1].quad[2].y).toBeLessThan(r.boards[0].quad[2].y)
    }
  })
  it('stebri so projekcija podanih pozicij', () => {
    const r = setup()
    expect(r.posts.length).toBe(3)
  })
  it('DETERMINIZEM: enak vhod → bajtno enak izhod', () => {
    const a = JSON.stringify(setup())
    const b = JSON.stringify(setup())
    expect(sha(a)).toBe(sha(b))
  })
  it('brez merila → throw (ni izmišljevanja)', () => {
    const placement = evaluatePlacement({
      productId: 'roksal.woodcore.romb-67',
      orientation: 'horizontal',
      gapMm: 10,
      postWidthMm: 60,
      fenceWidthMm: 4800,
      fenceHeightMm: 1100,
    })
    expect(() =>
      projectPlacement({
        layout: placement.layout!,
        orientation: 'horizontal',
        segment,
        scale: { mmPerUnitX: 0, mmPerUnitY: 0, reference: scale.reference, referenceLengthUnits: 1 },
      }),
    ).toThrow(/merila/)
  })
})

describe('projectPlacement — homografija (potrjeni kotniki)', () => {
  const scale = resolveScale({
    p1: { x: 0.05, y: 0.5 },
    p2: { x: 0.95, y: 0.5 },
    knownMm: 6000,
    kind: 'user-known-measure',
  }).scale!
  const corners: [NormPoint, NormPoint, NormPoint, NormPoint] = [
    { x: 0.1, y: 0.3 },
    { x: 0.9, y: 0.3 },
    { x: 0.9, y: 0.8 },
    { x: 0.1, y: 0.8 },
  ]

  it('vrne homography projekcijo (prava perspektivna preslikava)', () => {
    const placement = evaluatePlacement({
      productId: 'roksal.woodcore.romb-67',
      orientation: 'horizontal',
      gapMm: 10,
      postWidthMm: 60,
      fenceWidthMm: 4800,
      fenceHeightMm: 1100,
      posts: { widthMm: 60, positionsMm: [1200, 2400, 3600] },
    })
    const r = projectPlacement({
      layout: placement.layout!,
      orientation: 'horizontal',
      segment: { start: { x: 0.1, y: 0.8 }, end: { x: 0.9, y: 0.8 } },
      scale,
      corners: corners as never,
      postsWidthMm: 60,
      postsPositionsMm: [1200, 2400, 3600],
    })
    expect(r.kind).toBe('homography')
    expect(r.boards.length).toBeGreaterThan(0)
    // vsi quad-i znotraj slike (0..1 z malo toleranco)
    for (const q of r.boards.map((b) => b.quad)) {
      for (const p of q) {
        expect(p.x).toBeGreaterThanOrEqual(-0.05)
        expect(p.x).toBeLessThanOrEqual(1.05)
        expect(p.y).toBeGreaterThanOrEqual(-0.05)
        expect(p.y).toBeLessThanOrEqual(1.05)
      }
    }
  })
  it('degenerirani kotniki → iskren afina fallback z opozorilom', () => {
    const placement = evaluatePlacement({
      productId: 'roksal.woodcore.romb-67',
      orientation: 'horizontal',
      gapMm: 10,
      postWidthMm: 60,
      fenceWidthMm: 4800,
      fenceHeightMm: 1100,
    })
    const degenerate = [
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
    ]
    const r = projectPlacement({
      layout: placement.layout!,
      orientation: 'horizontal',
      segment: { start: { x: 0.1, y: 0.8 }, end: { x: 0.9, y: 0.8 } },
      scale,
      corners: degenerate as never,
    })
    expect(r.kind).toBe('affine-approximation')
    expect(r.warnings.join(' ')).toContain('degenerirani')
  })
})
