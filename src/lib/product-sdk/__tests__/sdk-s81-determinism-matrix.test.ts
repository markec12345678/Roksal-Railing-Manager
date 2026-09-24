/**
 * S+8.1 testi — DETERMINIZEM (§14) + ADVERSARIAL MATRIKA (§15) + AI GUARD (§17).
 *
 * §14: isti ProductDefinition + FenceConfiguration + FenceLayout + Material +
 *      resolucija → ≥100 ponovitev: identičen layout, maska, RGBA bajti,
 *      invariante, sha256 checksum. Brez Math.random/Date.now/UUID/seed/AI/omrežja.
 * §15: adversarial vhodi — geometrija (span edge cases), posts (0/1/2, duplikati,
 *      negativni, > span, exact/max+1, neurejene), rails (0/1/2, izven, duplikati,
 *      max+1), produkti (vsi profili v dovoljeni orientaciji + KUBO H MORA pasti),
 *      barve (temna/srednja/svetla/neznana/manjkajoča).
 * §17: AI takeoff NI Product SDK odvisnost — guard dokazuje čist import graf.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { buildFenceLayout } from '../geometry'
import { renderWithMask, renderProductFence } from '../render'
import { getProductDefinition } from '../catalog'
import { verifyProductIdentity } from '../invariants'
import { validateRails, resolveMaxPostSpacingMm } from '../rules'
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
    heightMm: 1100,
    gapMm: 20,
    ...over,
  }
}

// ───────────────────────── §14 DETERMINIZEM ≥100 PONOVITEV ─────────────────────────

describe('S+8.1 §14: determinizem — ≥100 ponovitev, bajtno identično', () => {
  const CASES = [
    { name: 'POLNA128-H+ročaj+stebri', cfg: config({ handle: true, posts: { widthMm: 60 } }), color: [110, 82, 60] as [number, number, number] },
    { name: 'POLNA128-V+cevi', cfg: config({ orientation: 'vertical' as const, spanMm: 1200, heightMm: 900 }), color: [244, 242, 236] as [number, number, number] },
  ]

  for (const c of CASES) {
    it(`${c.name}: 100× identičen layout + maska + RGBA + invariante + checksum`, () => {
      const def = defOf(c.cfg.productId)
      let baseChecksum = ''
      let baseJson = ''
      for (let i = 0; i < 100; i++) {
        const layout = buildFenceLayout(c.cfg, { definition: def })
        const { render, mask } = renderWithMask({
          definition: def,
          config: c.cfg,
          layout,
          material: { measuredRgb: c.color },
          outWidthPx: 320,
          outHeightPx: 240,
        })
        const invariants = verifyProductIdentity(def, c.cfg, layout)
        const layoutJson = JSON.stringify(layout)
        const invJson = JSON.stringify(invariants)
        const layoutHash = createHash('sha256').update(layoutJson).digest('hex')
        const renderHash = createHash('sha256').update(Buffer.from(render.image.data)).digest('hex')
        const maskHash = createHash('sha256').update(Buffer.from(mask.data)).digest('hex')
        const checksum = createHash('sha256')
          .update(`${layoutHash}|${renderHash}|${maskHash}|${invJson}`)
          .digest('hex')
        if (i === 0) {
          baseChecksum = checksum
          baseJson = layoutJson
          expect(invariants.renderValid).toBe(true)
        } else {
          expect(checksum).toBe(baseChecksum)
          expect(layoutJson).toBe(baseJson)
        }
      }
    })
  }

  it('renderProductFence brez podanega layouta: 100× isti RGBA bajti (build inside render je determinističen)', () => {
    const def = defOf('roksal.woodcore.romb-67')
    const cfg = config({ productId: def.id, gapMm: 12 })
    let base = ''
    for (let i = 0; i < 100; i++) {
      const res = renderProductFence({
        definition: def,
        config: cfg,
        material: { measuredRgb: [80, 60, 40] },
        outWidthPx: 240,
        outHeightPx: 180,
      })
      const h = createHash('sha256').update(Buffer.from(res.image.data)).digest('hex')
      if (i === 0) base = h
      expect(h).toBe(base)
    }
  })
})

// ───────────────────────── §15 ADVERSARIAL MATRIKA ─────────────────────────

describe('S+8.1 §15: adversarial matrika — geometrija', () => {
  const romb = defOf('roksal.woodcore.romb-67')

  it('span = 74 / 75 / 76 (vertical, face 67) / exact pitch / pitch+1 / zelo velik span', () => {
    // vertical: deske se zlagajo po ŠIRINI (span) → span edge cases
    const vCases: Array<[number, number]> = [[74, 1], [75, 1], [76, 2]]
    for (const [span, expected] of vCases) {
      const lay = buildFenceLayout(config({ productId: romb.id, orientation: 'vertical', spanMm: span, heightMm: 600, gapMm: 8 }), { definition: romb })
      expect(lay.boardCount).toBe(expected)
      const last = lay.boards[lay.boards.length - 1]
      expect(last.startMm + last.visibleMm).toBeLessThanOrEqual(span + 1e-9)
    }
    // exact pitch: 75×8 = 600 → 8 polnih desk
    const exact = buildFenceLayout(config({ productId: romb.id, heightMm: 600, gapMm: 8 }), { definition: romb })
    expect(exact.boardCount).toBe(8)
    expect(exact.boards.every((b) => !b.cut)).toBe(true)
    // pitch + 1
    const pitchPlus = buildFenceLayout(config({ productId: romb.id, heightMm: 601, gapMm: 8 }), { definition: romb })
    expect(pitchPlus.boardCount).toBe(9)
    expect(pitchPlus.boards[8].cut).toBe(true)
    // zelo velik span (API max 20000): izpeljava še vedno deterministična in validna
    const huge = buildFenceLayout(config({ productId: romb.id, spanMm: 20000 }), { definition: romb })
    expect(huge.posts.length).toBe(0) // brez post zahteve: brez stebrov
    const rep = verifyProductIdentity(romb, config({ productId: romb.id, spanMm: 20000 }), huge)
    expect(rep.renderValid).toBe(true)
  })

  it('height = minimum (100 mm) → veljavna geometrija', () => {
    const lay = buildFenceLayout(config({ productId: romb.id, heightMm: 100 }), { definition: romb })
    expect(lay.boardCount).toBe(2)
    expect(lay.boards.every((b) => b.visibleMm > 0)).toBe(true)
  })

  it('ročaj enabled/disabled — oba deterministična', () => {
    const polna = defOf('roksal.woodcore.polna-128')
    const withHandle = buildFenceLayout(config({ productId: polna.id, handle: true }), { definition: polna })
    const without = buildFenceLayout(config({ productId: polna.id }), { definition: polna })
    expect(withHandle.handlePresent).toBe(true)
    expect(without.handlePresent).toBe(false)
  })
})

describe('S+8.1 §15: adversarial matrika — posts', () => {
  const polna = () => defOf('roksal.woodcore.polna-128') // H max 1100

  it('brez postov / 1 post / 2 posta → veljavno', () => {
    expect(buildFenceLayout(config(), { definition: polna() }).posts).toEqual([])
    expect(buildFenceLayout(config({ posts: { widthMm: 60, positionsMm: [0] } }), { definition: polna() }).posts.length).toBe(1)
    expect(buildFenceLayout(config({ posts: { widthMm: 60, positionsMm: [0, 1100] } }), { definition: polna() }).posts.length).toBe(2)
  })

  it('duplikat / negativna / > span / neurejene / max+1 → VSE zavrnjene', () => {
    expect(() => buildFenceLayout(config({ posts: { widthMm: 60, positionsMm: [0, 0] } }), { definition: polna() })).toThrow(/dupliciran/)
    expect(() => buildFenceLayout(config({ posts: { widthMm: 60, positionsMm: [-1, 1000] } }), { definition: polna() })).toThrow(/izven polja/)
    expect(() => buildFenceLayout(config({ posts: { widthMm: 60, positionsMm: [0, 1601] } }), { definition: polna() })).toThrow(/izven polja/)
    expect(() => buildFenceLayout(config({ posts: { widthMm: 60, positionsMm: [1600, 0] } }), { definition: polna() })).toThrow(/naraščajoče/)
    expect(() => buildFenceLayout(config({ posts: { widthMm: 60, positionsMm: [0, 1101] } }), { definition: polna() })).toThrow(/presega katalog max/)
  })

  it('exact max spacing → veljavno', () => {
    const lay = buildFenceLayout(config({ posts: { widthMm: 60, positionsMm: [0, 1100] } }), { definition: polna() })
    expect(lay.posts.map((p) => p.centerMm)).toEqual([0, 1100])
  })
})

describe('S+8.1 §15: adversarial matrika — rails', () => {
  it('0 cevi (horizontal) / 2+ cevi (vertical izpeljava)', () => {
    const polna = defOf('roksal.woodcore.polna-128')
    expect(buildFenceLayout(config({ productId: polna.id }), { definition: polna }).rails).toEqual([])
    const v = buildFenceLayout(config({ productId: polna.id, orientation: 'vertical', spanMm: 1000, heightMm: 900 }), { definition: polna })
    expect(v.rails.length).toBeGreaterThanOrEqual(2)
  })

  it('ena cev na sredini → veljavna (bounds + brez intervalov)', () => {
    expect(() => validateRails([450], { fieldHeightMm: 900, maxSpacingMm: 1000, orientation: 'vertical' })).not.toThrow()
  })

  it('rail izven bounds / duplikat / max+1 / horizontal z cevmi → zavrnjene', () => {
    expect(() => validateRails([-10, 450], { fieldHeightMm: 900, maxSpacingMm: 1000, orientation: 'vertical' })).toThrow(/izven/)
    expect(() => validateRails([0, 910], { fieldHeightMm: 900, maxSpacingMm: 1000, orientation: 'vertical' })).toThrow(/izven/)
    expect(() => validateRails([100, 100, 500], { fieldHeightMm: 900, maxSpacingMm: 1000, orientation: 'vertical' })).toThrow(/dupliciran/)
    expect(() => validateRails([0, 1001, 1500], { fieldHeightMm: 1500, maxSpacingMm: 1000, orientation: 'vertical' })).toThrow(/presega katalog max/)
    expect(() => validateRails([0, 500], { fieldHeightMm: 900, maxSpacingMm: 1000, orientation: 'horizontal' })).toThrow(/vertical/)
  })
})

describe('S+8.1 §15: adversarial matrika — produkti', () => {
  const PRODUCT_CASES: Array<{ id: string; orientation: 'horizontal' | 'vertical' }> = [
    { id: 'roksal.woodcore.romb-67', orientation: 'horizontal' },
    { id: 'roksal.woodcore.romb-67-vertical', orientation: 'vertical' },
    { id: 'roksal.woodcore.polna-128', orientation: 'horizontal' },
    { id: 'roksal.woodcore.polna-128-vertical', orientation: 'vertical' },
    { id: 'roksal.woodcore.polna-100', orientation: 'vertical' },
    { id: 'roksal.woodcore.polna-57-32', orientation: 'vertical' },
    { id: 'roksal.woodcore.kubo-80-42', orientation: 'vertical' },
    { id: 'roksal.woodcore.deska-150', orientation: 'horizontal' },
  ]

  for (const pc of PRODUCT_CASES) {
    it(`${pc.id} ${pc.orientation} → veljaven layout + renderValid=true`, () => {
      const def = defOf(pc.id)
      const cfg = config({
        productId: def.id,
        orientation: pc.orientation,
        spanMm: pc.orientation === 'vertical' ? 1200 : 2000,
        heightMm: 1000,
        gapMm: Math.min(30, def.board.maxGapMm),
      })
      const lay = buildFenceLayout(cfg, { definition: def })
      const rep = verifyProductIdentity(def, cfg, lay)
      expect(rep.renderValid).toBe(true)
      const res = renderProductFence({
        definition: def,
        config: cfg,
        layout: lay,
        material: { measuredRgb: [110, 82, 60] },
        outWidthPx: 300,
        outHeightPx: 220,
      })
      expect(res.renderValid).toBe(true)
    })
  }

  it('KUBO horizontal → MORA pasti (vertical only)', () => {
    const def = defOf('roksal.woodcore.kubo-80-42')
    expect(() =>
      buildFenceLayout(config({ productId: def.id, orientation: 'horizontal' }), { definition: def }),
    ).toThrow(/NE podpira orientacije/)
  })

  it('POLNA 57/32 horizontal → MORA pasti (vertical only)', () => {
    const def = defOf('roksal.woodcore.polna-57-32')
    expect(() =>
      buildFenceLayout(config({ productId: def.id, orientation: 'horizontal' }), { definition: def }),
    ).toThrow(/NE podpira orientacije/)
  })
})

describe('S+8.1 §15: adversarial matrika — barve', () => {
  it('temna / srednja / svetla → vsi renderji validni, GEOMETRIJA ISTA', () => {
    const def = defOf('roksal.woodcore.polna-128')
    const cfg = config({ productId: def.id })
    const colors: [number, number, number][] = [
      [45, 42, 40], // temna (charcoal)
      [139, 105, 70], // srednja (amazon wood)
      [244, 242, 236], // svetla (white) — S+7 P0
    ]
    let layoutJson = ''
    for (const c of colors) {
      const res = renderProductFence({
        definition: def,
        config: cfg,
        material: { measuredRgb: c },
        outWidthPx: 300,
        outHeightPx: 220,
      })
      expect(res.renderValid).toBe(true)
      if (!layoutJson) layoutJson = JSON.stringify(res.layout)
      else expect(JSON.stringify(res.layout)).toBe(layoutJson)
    }
  })

  it('neznana barva → material zavrnjen; manjkajoča → zavrnjena', () => {
    const def = defOf('roksal.woodcore.polna-128')
    expect(() =>
      renderProductFence({
        definition: def,
        config: config({ productId: def.id, colorId: 'nonexistent' }),
        material: { colorId: 'nonexistent' },
        outWidthPx: 200,
        outHeightPx: 150,
      }),
    ).toThrow(/ni v paleti/)
    expect(() =>
      renderProductFence({ definition: def, config: config({ productId: def.id }), material: {}, outWidthPx: 200, outHeightPx: 150 }),
    ).toThrow(/material ni razrešen/)
  })
})

// ───────────────────────── §17 AI TAKEOFF NI SDK ODVISNOST ─────────────────────────

describe('S+8.1 §17 (posodobljeno v issue #2): AI NI v merilni kritični poti', () => {
  const ROOT = process.cwd()

  it('/api/ai-takeoff NE OBSTAJA več (issue #2: odstranjen, zamenjan z /api/measurement/*)', () => {
    expect(existsSync(join(ROOT, 'src/app/api/ai-takeoff/route.ts'))).toBe(false)
    expect(existsSync(join(ROOT, 'src/components/roksal/ai-takeoff.tsx'))).toBe(false)
  })

  it('/api/measurement rute ne uvozijo AI SDK (merilna kritična pot je deterministična)', () => {
    const routes = [
      'src/app/api/measurement/detect/route.ts',
      'src/app/api/measurement/confirm/route.ts',
      'src/app/api/measurement/products/route.ts',
    ]
    for (const route of routes) {
      const src = readFileSync(join(ROOT, route), 'utf8')
      for (const bad of ['z-ai-web-dev-sdk', 'createVision', 'chat.completions', 'VLM', 'ai-takeoff', 'ar/analyze']) {
        expect({ route, token: bad, hit: src.includes(bad) }).toEqual({ route, token: bad, hit: false })
      }
    }
  })

  it('src/lib/measurement SDK ne uvozi AI SDK, omrežja ali nedeterminizma', () => {
    const files = ['types.ts', 'cv.ts', 'detect.ts', 'scale.ts', 'engine.ts', 'geometry.ts', 'index.ts']
    for (const f of files) {
      const src = readFileSync(join(ROOT, 'src/lib/measurement', f), 'utf8')
      for (const bad of ['z-ai-web-dev-sdk', 'createVision', 'chat.completions', 'VLM', 'Math.random', 'Date.now', 'randomUUID', 'randomBytes', 'fetch(', 'XMLHttpRequest']) {
        expect({ file: f, token: bad, hit: src.includes(bad) }).toEqual({ file: f, token: bad, hit: false })
      }
    }
  })

  it('product-preview route ne uvozi AI SDK (import graf je čist)', () => {
    const src = readFileSync(join(ROOT, 'src/app/api/viz/product-preview/route.ts'), 'utf8')
    for (const bad of ['z-ai-web-dev-sdk', 'createVision', 'chat.completions', 'ai-takeoff', 'ar/analyze']) {
      expect({ token: bad, hit: src.includes(bad) }).toEqual({ token: bad, hit: false })
    }
  })

  it('vsak product-sdk modul ne uvozi AI SDK ali omrežja', () => {
    const files = ['types.ts', 'catalog.ts', 'geometry.ts', 'rules.ts', 'engine.ts', 'mask.ts', 'material.ts', 'render.ts', 'invariants.ts', 'index.ts']
    for (const f of files) {
      const src = readFileSync(join(ROOT, 'src/lib/product-sdk', f), 'utf8')
      for (const bad of ['z-ai-web-dev-sdk', 'createVision', 'chat.completions', 'VLM', 'Math.random', 'Date.now', 'randomUUID', 'randomBytes', 'fetch(', 'XMLHttpRequest']) {
        expect({ file: f, token: bad, hit: src.includes(bad) }).toEqual({ file: f, token: bad, hit: false })
      }
    }
  })
})
