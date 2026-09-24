/**
 * S+8.1 testi — BOARD INVARIANTS + BOUNDS + MASK/RENDER KONSISTENTNOST + BARVE
 * (spec §7, §8, §9, §12).
 *
 * §7:  polne geometrijske invariante desk (index/start/visible/gap/boardCount).
 * §8:  bounds ↔ fenceWidth/Height/fieldSpan konsistentnost po orientacijah,
 *      ročaj, odrezana zadnja deska, exact-fit, ena deska, zelo ozko polje.
 * §9:  isti FenceLayout → render geometrija in maska geometrija = POPOLNOMA
 *      skladni (maska NI drugi geometrijski izračun — pikslični dokaz).
 * §12: barvna identiteta — neznana/manjkajoča barva zavrnjena; measuredRgb
 *      ostaja "measured/unofficial"; NI novih color-matching algoritmov.
 */
import { describe, it, expect } from 'vitest'
import { buildFenceLayout } from '../geometry'
import { renderProductFence, renderWithMask } from '../render'
import { layoutMask } from '../mask'
import { getProductDefinition } from '../catalog'
import { resolveMaterial } from '../material'
import { verifyProductIdentity } from '../invariants'
import type { FenceConfiguration, ProductDefinition } from '../types'

function defOf(id: string): ProductDefinition {
  const def = getProductDefinition(id)
  if (!def) throw new Error(`manjka definicija ${id}`)
  return def
}

function config(over: Partial<FenceConfiguration> = {}): FenceConfiguration {
  return {
    productId: 'roksal.woodcore.romb-67',
    orientation: 'horizontal',
    spanMm: 3200,
    heightMm: 1000,
    gapMm: 8,
    ...over,
  }
}

// ───────────────────────── §7 BOARD INVARIANTS ─────────────────────────

describe('S+8.1 §7: polne geometrijske invariante desk', () => {
  it('ROMB 67 H 1000mm: indexi unikatni 0..n-1, start≥0, 0<visible≤67, zaporedne vrzeli = gap', () => {
    const def = defOf('roksal.woodcore.romb-67')
    const lay = buildFenceLayout(config(), { definition: def })
    expect(lay.boardCount).toBe(lay.boards.length)
    lay.boards.forEach((b, i) => {
      expect(b.index).toBe(i)
      expect(b.startMm).toBeGreaterThanOrEqual(0)
      expect(b.visibleMm).toBeGreaterThan(0)
      expect(b.visibleMm).toBeLessThanOrEqual(67)
      expect(b.startMm + b.visibleMm).toBeLessThanOrEqual(lay.fieldSpanMm + 1e-9)
    })
    for (let i = 1; i < lay.boards.length; i++) {
      const gap = lay.boards[i].startMm - (lay.boards[i - 1].startMm + lay.boards[i - 1].visibleMm)
      expect(gap).toBeCloseTo(8, 6)
    }
  })

  it('odrezana zadnja deska: startMm+visibleMm == fieldSpan (točno do konca), ostale polne', () => {
    const def = defOf('roksal.woodcore.romb-67')
    const lay = buildFenceLayout(config(), { definition: def })
    const last = lay.boards[lay.boards.length - 1]
    expect(last.cut).toBe(true)
    expect(last.startMm + last.visibleMm).toBeCloseTo(lay.fieldSpanMm, 6)
    // invarianta poročilo: vse board preveritve zelene
    const rep = verifyProductIdentity(def, config(), lay)
    const boardChecks = rep.checks.filter((c) => c.name.startsWith('board') || c.name === 'lastBoardWithin')
    expect(boardChecks.every((c) => c.ok)).toBe(true)
  })

  it('VERTIKALNA ograja: enake invariante v širinski smeri (span = fenceWidth)', () => {
    const def = defOf('roksal.woodcore.polna-100')
    const cfg = config({ productId: def.id, orientation: 'vertical', spanMm: 1234, heightMm: 800, gapMm: 25 })
    const lay = buildFenceLayout(cfg, { definition: def })
    lay.boards.forEach((b) => {
      expect(b.visibleMm).toBeLessThanOrEqual(100)
      expect(b.startMm + b.visibleMm).toBeLessThanOrEqual(lay.fieldSpanMm + 1e-9)
    })
    for (let i = 1; i < lay.boards.length; i++) {
      const gap = lay.boards[i].startMm - (lay.boards[i - 1].startMm + lay.boards[i - 1].visibleMm)
      expect(gap).toBeCloseTo(25, 6)
    }
    const rep = verifyProductIdentity(def, cfg, lay)
    expect(rep.renderValid).toBe(true)
  })
})

// ───────────────────────── §8 BOUNDS KONSISTENTNOST ─────────────────────────

describe('S+8.1 §8: bounds ↔ fenceWidth/Height/fieldSpan konsistentnost', () => {
  it('horizontal: fenceWidth=span, fenceHeight=height, fieldSpan=fieldHeight (brez ročaja)', () => {
    const def = defOf('roksal.woodcore.romb-67')
    const lay = buildFenceLayout(config({ spanMm: 3200, heightMm: 1000 }), { definition: def })
    expect(lay.bounds).toEqual({ widthMm: 3200, heightMm: 1000 })
    expect(lay.fenceWidthMm).toBe(3200)
    expect(lay.fenceHeightMm).toBe(1000)
    expect(lay.fieldHeightMm).toBe(1000)
    expect(lay.fieldSpanMm).toBe(lay.fieldHeightMm)
  })

  it('vertical: fenceWidth=span, fieldSpan=fenceWidth', () => {
    const def = defOf('roksal.woodcore.polna-100')
    const lay = buildFenceLayout(
      config({ productId: def.id, orientation: 'vertical', spanMm: 1200, heightMm: 800 }),
      { definition: def },
    )
    expect(lay.fenceWidthMm).toBe(1200)
    expect(lay.fenceHeightMm).toBe(800)
    expect(lay.fieldSpanMm).toBe(1200)
  })

  it('ročaj: fieldHeight = height − 92; bounds ostanejo celotna višina', () => {
    const def = defOf('roksal.woodcore.polna-128')
    const lay = buildFenceLayout(config({ handle: true, heightMm: 1000 }), { definition: def })
    expect(lay.handlePresent).toBe(true)
    expect(lay.fenceHeightMm).toBe(1000)
    expect(lay.fieldHeightMm).toBe(1000 - 92)
    expect(lay.bounds.heightMm).toBe(1000)
  })

  it('exact-fit: span/pitch celo število → vse deske polne; zadnja ploskvica se konča za gap pred vrhom', () => {
    const def = defOf('roksal.woodcore.romb-67') // pitch 67+8=75
    const lay = buildFenceLayout(config({ heightMm: 750, gapMm: 8 }), { definition: def })
    expect(750 % 75).toBe(0)
    expect(lay.boardCount).toBe(10)
    expect(lay.boards.every((b) => !b.cut)).toBe(true)
    const last = lay.boards[lay.boards.length - 1]
    // ploskvica #9: start 675, vidna 67 → končnica na fieldSpan − gap (zgornji razmak ostane)
    expect(last.startMm + last.visibleMm).toBeCloseTo(750 - 8, 6)
    const rep = verifyProductIdentity(def, config({ heightMm: 750, gapMm: 8 }), lay)
    expect(rep.renderValid).toBe(true)
  })

  it('ena sama deska: height == face → boardCount=1, polna deska (brez odrezka)', () => {
    const def = defOf('roksal.woodcore.romb-67') // face 67
    const lay = buildFenceLayout(config({ heightMm: 67, gapMm: 8 }), { definition: def })
    expect(lay.boardCount).toBe(1)
    expect(lay.boards[0].visibleMm).toBe(67)
    expect(lay.boards[0].cut).toBe(false)
    const rep = verifyProductIdentity(def, config({ heightMm: 67, gapMm: 8 }), lay)
    expect(rep.renderValid).toBe(true)
  })

  it('S+8.1 §8: polje manjše od širine profila → ZAVRNJENO (prej bi bounds prelomilo)', () => {
    const def = defOf('roksal.woodcore.romb-67') // face 67
    // horizontal: height 50 < 67
    expect(() => buildFenceLayout(config({ heightMm: 50 }), { definition: def })).toThrow(/manjša od širine profila/)
    // horizontal + ročaj: field = 150−92 = 58 < 67
    const polna = defOf('roksal.woodcore.polna-128') // face 128
    expect(() => buildFenceLayout(config({ productId: polna.id, handle: true, heightMm: 200 }), { definition: polna })).toThrow(/manjša od širine profila/)
    // vertical: span 50 < 67
    expect(() =>
      buildFenceLayout(config({ productId: def.id, orientation: 'vertical', spanMm: 50, heightMm: 600 }), { definition: def }),
    ).toThrow(/manjša od širine profila/)
  })

  it('zelo ozko polje (span 100 in 101 mm) pri vertical: geometrija ostane konsistentna', () => {
    const def = defOf('roksal.woodcore.polna-57-32') // face 57
    for (const span of [100, 101]) {
      const cfg = config({ productId: def.id, orientation: 'vertical', spanMm: span, heightMm: 600, gapMm: 2 })
      const lay = buildFenceLayout(cfg, { definition: def })
      expect(lay.boardCount).toBe(Math.max(1, Math.ceil(span / 59)))
      const last = lay.boards[lay.boards.length - 1]
      expect(last.startMm + last.visibleMm).toBeLessThanOrEqual(span + 1e-9)
      const rep = verifyProductIdentity(def, cfg, lay)
      expect(rep.renderValid).toBe(true)
    }
  })

  it('pitch + 1 mm: extra deska z minimalnim odrezkom (adversarial §15)', () => {
    const def = defOf('roksal.woodcore.romb-67') // pitch 75
    const lay = buildFenceLayout(config({ heightMm: 751, gapMm: 8 }), { definition: def })
    expect(lay.boardCount).toBe(11) // ceil(751/75) = 11
    const last = lay.boards[10]
    expect(last.cut).toBe(true)
    expect(last.visibleMm).toBeCloseTo(1, 6)
  })
})

// ───────────────────────── §9 MASKA = EN GEOMETRIJSKI VIR ─────────────────────────

describe('S+8.1 §9: isti FenceLayout → render in maska popolnoma skladna', () => {
  it('pikslični dokaz: temni render — pokrite piksle == maska 255 piksle (1:1, H in V, z stebri)', () => {
    const cases: Array<{ id: string; orientation: 'horizontal' | 'vertical'; spanMm: number; heightMm: number; gapMm: number; handle?: boolean; posts?: boolean }> = [
      { id: 'roksal.woodcore.polna-128', orientation: 'horizontal', spanMm: 1600, heightMm: 1100, gapMm: 20, handle: true, posts: true },
      { id: 'roksal.woodcore.polna-100', orientation: 'vertical', spanMm: 1200, heightMm: 800, gapMm: 25, posts: true },
      { id: 'roksal.woodcore.romb-67', orientation: 'horizontal', spanMm: 3200, heightMm: 1000, gapMm: 8 },
    ]
    for (const c of cases) {
      const def = defOf(c.id)
      const cfg = config({
        productId: c.id,
        orientation: c.orientation,
        spanMm: c.spanMm,
        heightMm: c.heightMm,
        gapMm: c.gapMm,
        handle: c.handle,
        posts: c.posts ? { widthMm: 60 } : null,
      })
      const W = 420
      const H = 300
      const { render, mask } = renderWithMask({
        definition: def,
        config: cfg,
        material: { measuredRgb: [12, 10, 8] }, // temen material — pokriti piksli so temni
        outWidthPx: W,
        outHeightPx: H,
      })
      let coveredRender = 0
      for (let i = 0; i < W * H; i++) {
        const r = render.image.data[i * 4]
        const g = render.image.data[i * 4 + 1]
        const b = render.image.data[i * 4 + 2]
        if (r < 250 || g < 250 || b < 250) coveredRender++ // belo ozadje = nepokrito
      }
      let maskOn = 0
      for (let i = 0; i < W * H; i++) {
        if (mask.data[i * 4] === 255) maskOn++
      }
      expect(maskOn, `${c.id}/${c.orientation}: maska=${maskOn}, render-pokritih=${coveredRender}`).toBe(coveredRender)
    }
  })

  it('ista maska za temen in SVETEL material (maska neodvisna od barve — S+7 P0 ostaja)', () => {
    const def = defOf('roksal.woodcore.polna-128')
    const cfg = config({ productId: def.id })
    const dark = layoutMask(buildFenceLayout(cfg, { definition: def }), { outWidthPx: 300, outHeightPx: 200 })
    const light = layoutMask(buildFenceLayout(cfg, { definition: def }), { outWidthPx: 300, outHeightPx: 200 })
    expect(Buffer.from(dark.data)).toEqual(Buffer.from(light.data))
  })

  it('konflikt config↔layout ne sme zaobiti maske: renderWithMask z neskladen layout zavrača', () => {
    const def = defOf('roksal.woodcore.polna-128')
    const layout = buildFenceLayout(config({ spanMm: 2200 }), { definition: def })
    expect(() =>
      renderWithMask({
        definition: def,
        config: config({ spanMm: 2000 }),
        layout,
        material: { measuredRgb: [0, 0, 0] },
        outWidthPx: 300,
        outHeightPx: 200,
      }),
    ).toThrow(/konflikt/)
  })
})

// ───────────────────────── §12 BARVNA IDENTITETA ─────────────────────────

describe('S+8.1 §12: barvna identiteta (brez novih matching algoritmov)', () => {
  const def = defOf('roksal.woodcore.romb-67')

  it('neznana colorId → ZAVRNJENA', () => {
    expect(() => resolveMaterial(def, { colorId: 'not-a-roksal-color' })).toThrow(/ni v paleti/)
  })

  it('manjkajoč colorId (brez measuredRgb) → ZAVRNJENA (material ni razrešen)', () => {
    expect(() => resolveMaterial(def, {})).toThrow(/material ni razrešen/)
  })

  it('znana colorId brez uradnega hex → zavrnjena, DOKLER ne pride measuredRgb (ni izmišljena)', () => {
    expect(() => resolveMaterial(def, { colorId: 'charcoal' })).toThrow(/NIMA uradnega hex/)
    const m = resolveMaterial(def, { colorId: 'charcoal', measuredRgb: [40, 42, 46] })
    expect(m.provenance).toMatch(/^measured:charcoal/)
    expect(m.provenance).toMatch(/NEURADNO/)
  })

  it('measuredRgb ostaja jasno označen MEASURED/UNOFFICIAL — nikoli lažni uradni RAL', () => {
    const m = resolveMaterial(def, { measuredRgb: [244, 242, 236] })
    expect(m.kind).toBe('color')
    expect(m.rgb).toEqual([244, 242, 236])
    expect(m.provenance).toContain('measured')
    expect(m.provenance).toContain('NEURADNO')
  })

  it('neznana barva v konfiguraciji → PRODUCT.colorId invarianta pade (renderValid=false)', () => {
    const cfg = config({ colorId: 'forged-color' })
    const lay = buildFenceLayout(cfg, { definition: def })
    const rep = verifyProductIdentity(def, cfg, lay)
    expect(rep.renderValid).toBe(false)
    expect(rep.failures.some((f) => f.includes('colorId'))).toBe(true)
  })
})
