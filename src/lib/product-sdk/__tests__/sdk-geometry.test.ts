/**
 * S+8 testi — PRODUCT SDK: GEOMETRIJA (spec §9, §22 unit).
 * buildFenceLayout = SOURCE-OF-TRUTH: board count/spacing/cut, posts, rails,
 * caps, fasteners, bounds, warnings. Vse iz kataloga + čiste aritmetike.
 */
import { describe, it, expect } from 'vitest'
import { buildFenceLayout } from '../geometry'
import { getProductDefinition } from '../catalog'
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

describe('geometry: board aritmetika (source-of-truth)', () => {
  it('boardCount = ceil(span / (face+gap)); zadnja deska odrezana', () => {
    const def = defOf('roksal.woodcore.romb-67')
    const lay = buildFenceLayout(config(), { definition: def })
    const pitch = 67 + 8
    expect(lay.boardCount).toBe(Math.ceil(1000 / pitch))
    expect(lay.boardCount).toBe(14) // 1000/75 = 13.33 → 14
    const last = lay.boards[lay.boardCount - 1]
    expect(last.cut).toBe(true)
    expect(last.visibleMm).toBeLessThan(67)
    // vsi ostali polni
    for (const b of lay.boards.slice(0, -1)) {
      expect(b.visibleMm).toBe(67)
      expect(b.cut).toBe(false)
    }
    // zaporedni startMm = index × pitch
    lay.boards.forEach((b, i) => expect(b.startMm).toBeCloseTo(i * pitch, 6))
  })

  it('FenceLayout EKSPPLICITNO vsebuje boards/posts/rails/caps/fasteners/bounds/warnings (§9)', () => {
    const def = defOf('roksal.woodcore.romb-67')
    const lay = buildFenceLayout(config(), { definition: def })
    expect(Array.isArray(lay.boards)).toBe(true)
    expect(Array.isArray(lay.posts)).toBe(true)
    expect(Array.isArray(lay.rails)).toBe(true)
    expect(Array.isArray(lay.caps)).toBe(true)
    expect(Array.isArray(lay.fasteners)).toBe(true)
    expect(lay.bounds).toEqual({ widthMm: 3200, heightMm: 1000 })
    expect(Array.isArray(lay.warnings)).toBe(true)
    expect(lay.definitionId).toBe('roksal.woodcore.romb-67')
  })

  it('gap izven katalog priporočila → odkrito opozorilo (ni tiho popravljeno)', () => {
    const def = defOf('roksal.woodcore.romb-67')
    const lay = buildFenceLayout(config({ gapMm: 50 }), { definition: def })
    expect(lay.warnings.some((w) => w.includes('izven priporočila'))).toBe(true)
  })

  it('nepodprta orientacija → odkrito opozorilo', () => {
    const def = defOf('roksal.woodcore.polna-100') // samo vertical
    const lay = buildFenceLayout(config({ productId: def.id, orientation: 'horizontal' }), { definition: def })
    expect(lay.warnings.some((w) => w.includes('NE podpira orientacije'))).toBe(true)
  })

  it('neveljavna konfiguracija → javna napaka (ni tišega popravljanja)', () => {
    const def = defOf('roksal.woodcore.romb-67')
    expect(() => buildFenceLayout(config({ spanMm: 0 }), { definition: def })).toThrow()
    expect(() => buildFenceLayout(config({ heightMm: -5 }), { definition: def })).toThrow()
    expect(() => buildFenceLayout(config({ gapMm: -1 }), { definition: def })).toThrow()
  })

  it('rights=rejected → render geometrije NI dovoljen', () => {
    const def = defOf('roksal.woodcore.romb-67')
    const rejected: ProductDefinition = { ...def, rights: 'rejected' }
    expect(() => buildFenceLayout(config(), { definition: rejected })).toThrow(/rejected/)
  })
})

describe('geometry: konstrukcija iz katalogovih pravil', () => {
  it('stebri: eksplicitne pozicije + opozorilo, če presegajo max razmak', () => {
    const def = defOf('roksal.woodcore.romb-67') // maxPostSpacingMm 1450
    const lay = buildFenceLayout(
      config({ posts: { widthMm: 60, positionsMm: [0, 1600, 3200] } }),
      { definition: def },
    )
    expect(lay.posts.map((p) => p.centerMm)).toEqual([0, 1600, 3200])
    expect(lay.posts[0].role).toBe('terminal')
    expect(lay.posts[1].role).toBe('intermediate')
    expect(lay.warnings.some((w) => w.includes('presega katalog max'))).toBe(true)
  })

  it('stebri: izpeljava iz maxPostSpacingMm (deterministično)', () => {
    const def = defOf('roksal.woodcore.romb-67')
    const lay = buildFenceLayout(config({ posts: { widthMm: 60 } }), { definition: def })
    // 3200/1450 → 3 intervali
    expect(lay.posts.length).toBe(4)
    expect(lay.posts[0].centerMm).toBe(0)
    expect(lay.posts[3].centerMm).toBe(3200)
    for (let i = 1; i < lay.posts.length; i++) {
      expect(lay.posts[i].centerMm - lay.posts[i - 1].centerMm).toBeLessThanOrEqual(1450)
    }
  })

  it('KUBO: katalog ne navaja max post razmaka → stebri NISO izpeljani (ni izmišljeni)', () => {
    const def = defOf('roksal.woodcore.kubo-80-42')
    const lay = buildFenceLayout(
      config({ productId: def.id, orientation: 'vertical', spanMm: 2000, heightMm: 1200, gapMm: 20, posts: { widthMm: 60 } }),
      { definition: def },
    )
    expect(lay.posts.length).toBe(0)
    expect(lay.warnings.some((w) => w.includes('NISO izpeljani'))).toBe(true)
  })

  it('vertical: rails iz maxRailSpacingMm; horizontal: brez rails', () => {
    const def = defOf('roksal.woodcore.polna-100') // maxRail 800
    const vLay = buildFenceLayout(
      config({ productId: def.id, orientation: 'vertical', spanMm: 1200, heightMm: 1000 }),
      { definition: def },
    )
    expect(vLay.rails.length).toBeGreaterThanOrEqual(2)
    for (let i = 1; i < vLay.rails.length; i++) {
      expect(vLay.rails[i].centerMm - vLay.rails[i - 1].centerMm).toBeLessThanOrEqual(800)
    }
    // presek cevi NI v katalogu — ni izmišljen
    expect(vLay.rails[0].crossSectionMm).toBeNull()

    const hLay = buildFenceLayout(
      config({ productId: def.id, orientation: 'horizontal' }),
      { definition: def },
    )
    expect(hLay.rails.length).toBe(0)
  })

  it('čepi: rhombus = levi+desni (katalog accessories)', () => {
    const def = defOf('roksal.woodcore.romb-67')
    const lay = buildFenceLayout(config(), { definition: def })
    expect(lay.caps).toEqual([
      { side: 'left', kind: 'cep-romb-levo' },
      { side: 'right', kind: 'cep-romb-desno' },
    ])
  })

  it('vijaki: vidni SAMO pri screwVisibility=visible (podatek iz kataloga)', () => {
    const polna = defOf('roksal.woodcore.polna-128') // visible
    const polnaLay = buildFenceLayout(
      config({ productId: polna.id, posts: { widthMm: 60 } }),
      { definition: polna },
    )
    expect(polnaLay.fasteners.length).toBeGreaterThan(0)
    expect(polnaLay.fasteners.every((f) => f.visible)).toBe(true)
    expect(polnaLay.fasteners.filter((f) => f.type === 'board').length).toBe(
      polnaLay.boardCount * polnaLay.posts.length,
    )

    const romb = defOf('roksal.woodcore.romb-67') // hidden
    const rombLay = buildFenceLayout(config({ posts: { widthMm: 60 } }), { definition: romb })
    expect(rombLay.fasteners.length).toBeGreaterThan(0)
    expect(rombLay.fasteners.every((f) => f.visible)).toBe(false)
  })

  it('ročaj: vijaki vsak 500 mm po katalogu; samo če definicija dovoljuje', () => {
    const def = defOf('roksal.woodcore.polna-128')
    const lay = buildFenceLayout(config({ handle: true }), { definition: def })
    expect(lay.handlePresent).toBe(true)
    expect(lay.handleHeightMm).toBe(92)
    const handleScrews = lay.fasteners.filter((f) => f.type === 'handle')
    // 3200/500 → središča 250, 750, ... 2750 → 6
    expect(handleScrews.length).toBe(6)
    expect(handleScrews[0].atMm[0]).toBe(250)

    const romb = defOf('roksal.woodcore.romb-67') // handle.available=false
    const rombLay = buildFenceLayout(config({ handle: true }), { definition: romb })
    expect(rombLay.handlePresent).toBe(false)
  })
})

describe('geometry: determinizem (isti vhod → isti izhod)', () => {
  it('dva klica = identičen layout (JSON)', () => {
    const def = defOf('roksal.woodcore.polna-128')
    const c = config({ productId: def.id, handle: true, posts: { widthMm: 60 } })
    const a = buildFenceLayout(c, { definition: def })
    const b = buildFenceLayout(c, { definition: def })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
