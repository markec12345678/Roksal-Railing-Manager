/**
 * S+8 testi — PRODUCT SDK: MASKA + MATERIAL + INVARIANTA (spec §7, §8, §11, §12).
 *
 * KRITIČNO (P0 iz S+7): maska mora ostati NEODVISNA od barve produkta —
 * maska opisuje KJE JE produkt, ne KAKŠNE BARVE je. WHITE/temna/tekstura
 * → ISTA exact alpha iz FenceLayout (ne globalni prag svetlosti!).
 */
import { describe, it, expect } from 'vitest'
import { buildFenceLayout } from '../geometry'
import { getProductDefinition } from '../catalog'
import { layoutMask } from '../mask'
import { resolveMaterial } from '../material'
import { verifyProductIdentity } from '../invariants'
import { renderProductFence } from '../render'
import type { FenceConfiguration, ProductDefinition } from '../types'

function defOf(id: string): ProductDefinition {
  const def = getProductDefinition(id)
  if (!def) throw new Error(`manjka definicija ${id}`)
  return def
}

function config(over: Partial<FenceConfiguration> = {}): FenceConfiguration {
  return {
    productId: 'roksal.woodcore.polna-128',
    orientation: 'horizontal',
    spanMm: 1600,
    heightMm: 1000,
    gapMm: 20,
    ...over,
  }
}

describe('maska: neodvisna od barve (P0 — svetli izdelki)', () => {
  it('WHITE (svetel) in ANTRACIT (temen) material → BAJTNO identična maska', () => {
    const def = defOf('roksal.woodcore.polna-128')
    const c = config()
    const lay = buildFenceLayout(c, { definition: def })
    // maska sploh ne sprejme materiala — vhod je samo geometrija
    const m1 = layoutMask(lay, { outWidthPx: 640, outHeightPx: 400 })
    const m2 = layoutMask(lay, { outWidthPx: 640, outHeightPx: 400 })
    expect(Buffer.from(m1.data)).toEqual(Buffer.from(m2.data))
    //White render: barva je popolnoma druga, maska ISTA
    const white = renderProductFence({
      definition: def,
      config: c,
      material: { measuredRgb: [244, 242, 236] },
      outWidthPx: 640,
      outHeightPx: 400,
    })
    const dark = renderProductFence({
      definition: def,
      config: c,
      material: { measuredRgb: [58, 62, 66] },
      outWidthPx: 640,
      outHeightPx: 400,
    })
    let whiteSum = 0
    let darkSum = 0
    for (let i = 0; i < white.image.data.length; i += 4) whiteSum += white.image.data[i]
    for (let i = 0; i < dark.image.data.length; i += 4) darkSum += dark.image.data[i]
    expect(Math.abs(whiteSum - darkSum)).toBeGreaterThan(1_000_000) // barvi sta različni
    // maska iz layout-a neodvisna — renderefska geometrija ista
    const mWhite = layoutMask(white.layout, { outWidthPx: 640, outHeightPx: 400 })
    expect(Buffer.from(mWhite.data)).toEqual(Buffer.from(m1.data))
  })

  it('maska pokriva ploskvice + vrzeli so transparentne (exact alpha)', () => {
    const def = defOf('roksal.woodcore.polna-128')
    const lay = buildFenceLayout(config(), { definition: def })
    const m = layoutMask(lay, { outWidthPx: 320, outHeightPx: 200 })
    expect(m.w).toBe(320)
    expect(m.h).toBe(200)
    let white = 0
    let black = 0
    for (let i = 0; i < m.data.length; i += 4) {
      if (m.data[i] === 255) white++
      else if (m.data[i] === 0) black++
      else throw new Error('maska mora biti binarna (exact alpha iz geometrije)')
    }
    expect(white).toBeGreaterThan(0)
    expect(black).toBeGreaterThan(0)
    // pokritost ≈ faceWidth/(face+gap) = 128/148 ≈ 86.5 %
    const coverage = white / (white + black)
    expect(coverage).toBeGreaterThan(0.8)
    expect(coverage).toBeLessThan(0.93)
  })

  it('maska vsebuje stebre (konstrukcija je del produkta)', () => {
    const def = defOf('roksal.woodcore.polna-128')
    const lay = buildFenceLayout(config({ posts: { widthMm: 80, positionsMm: [0, 1600] } }), { definition: def })
    const m = layoutMask(lay, { outWidthPx: 320, outHeightPx: 200 })
    // pri stebru x=0 (središče 0, širina 80) je maska bela do ~80mm → ~16 px
    let col0 = 0
    for (let y = 0; y < m.h; y++) if (m.data[(y * m.w + 2) * 4] === 255) col0++
    expect(col0).toBe(m.h) // celoten stolpec pri stebru bel
  })
})

describe('material: ločen od geometrije, brez generativnega matchinga (§7)', () => {
  it('measuredRgb je dovoljen z ODKRITO neuradno provenanco', () => {
    const def = defOf('roksal.woodcore.romb-67')
    const m = resolveMaterial(def, { colorId: 'amazon-wood', measuredRgb: [72, 53, 40] })
    expect(m.kind).toBe('color')
    expect(m.rgb).toEqual([72, 53, 40])
    expect(m.provenance).toContain('NEURADNO')
  })

  it('colorId brez uradnega hex (approxHex=null) → jasna napaka (ni izmišljen)', () => {
    const def = defOf('roksal.woodcore.romb-67')
    expect(() => resolveMaterial(def, { colorId: 'amazon-wood' })).toThrow(/approxHex=null/)
  })

  it('neznana barva → napaka; neveljaven RGB → napaka', () => {
    const def = defOf('roksal.woodcore.romb-67')
    expect(() => resolveMaterial(def, { colorId: 'to-ne-obstaja' })).toThrow(/ni v paleti/)
    expect(() => resolveMaterial(def, { measuredRgb: [300, 0, 0] })).toThrow(/0–255/)
    expect(() => resolveMaterial(def, {})).toThrow(/material ni razrešen/)
  })

  it('tekstura je dovoljena SAMO ob rights=granted (pravicna vrata, §3)', () => {
    const def = defOf('roksal.woodcore.romb-67') // pending
    const tex = { data: new Uint8ClampedArray(4 * 4 * 4).fill(128), w: 4, h: 4 }
    // rights=pending → tekstura NI dovoljena (tudi če je podana)
    expect(() => resolveMaterial(def, { texture: tex, colorId: 'amazon-wood' })).toThrow(/approxHex=null/)
    // rights=pending → barvna pot z izmerjenim RGB (odkrito neuradno)
    const mc = resolveMaterial(def, { texture: tex, colorId: 'amazon-wood', measuredRgb: [72, 53, 40] })
    expect(mc.kind).toBe('color')
    // rights=granted + obstoječ textureImage asset → tekstura gre skozi
    const granted: ProductDefinition = {
      ...def,
      rights: 'granted',
      material: { ...def.material, textureImage: 'evaluation/roksal-assets/romb-texture.png' },
    }
    const mt = resolveMaterial(granted, { texture: tex, colorId: 'amazon-wood' })
    expect(mt.kind).toBe('texture')
    expect(mt.provenance).toContain('rights granted')
  })
})

describe('invarianta: renderValid (§8)', () => {
  it('validen layout → vse invariante zelene', () => {
    const def = defOf('roksal.woodcore.polna-128')
    const c = config({ colorId: 'rustic-oak', handle: true })
    const lay = buildFenceLayout(c, { definition: def })
    const rep = verifyProductIdentity(def, c, lay)
    expect(rep.renderValid).toBe(true)
    expect(rep.failures).toEqual([])
    const groups = rep.checks.map((x) => x.group)
    expect(groups).toContain('GEOMETRY')
    expect(groups).toContain('PRODUCT')
    expect(groups).toContain('MOUNTING')
  })

  it('ponarejen layout (napačen boardCount) → renderValid=false', () => {
    const def = defOf('roksal.woodcore.polna-128')
    const c = config()
    const lay = buildFenceLayout(c, { definition: def })
    const forged = { ...lay, boardCount: lay.boardCount + 3 }
    const rep = verifyProductIdentity(def, c, forged)
    expect(rep.renderValid).toBe(false)
    expect(rep.failures.some((f) => f.includes('GEOMETRY.boardCount'))).toBe(true)
  })

  it('ponarejen layout (napačen productId) → renderValid=false', () => {
    const def = defOf('roksal.woodcore.polna-128')
    const c = config()
    const lay = buildFenceLayout(c, { definition: def })
    const forged = { ...lay, productId: 'roksal.woodcore.romb-67' }
    const rep = verifyProductIdentity(def, c, forged)
    expect(rep.renderValid).toBe(false)
    expect(rep.failures.some((f) => f.includes('PRODUCT.productId'))).toBe(true)
  })

  it('neznana barva v konfiguraciji → PRODUCT.colorId pade', () => {
    const def = defOf('roksal.woodcore.polna-128')
    const c = config({ colorId: 'forged-color' })
    const lay = buildFenceLayout(c, { definition: def })
    const rep = verifyProductIdentity(def, c, lay)
    expect(rep.renderValid).toBe(false)
    expect(rep.failures.some((f) => f.includes('PRODUCT.colorId'))).toBe(true)
  })
})
