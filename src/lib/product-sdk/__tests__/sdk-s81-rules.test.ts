/**
 * S+8.1 testi — PRAVILA + HARD VALIDACIJA + RIGHTS GATE (spec §2–§6, §10, §11, §13).
 *
 * §2/§3: orientacijsko-specifična montažna pravila (POLNA 128 H=1100/V=1800/over150Cm=1500;
 *        ROMB 67: V NI dokumentiran → null + eksplicitne pozicije; NI fallbacka H↔V).
 * §4/§5: eksplicitne post pozicije = HARD validacija (NaN/∞/negative/>span/duplikati/
 *        neurejene/max+1 → SdkValidationError; exact max → OK).
 * §6:    cevi — bounds/monotonija/duplikati/max/vertical-only; crossSectionMm ostaja null.
 * §10:   renderer ne zaupa konfliktnim vhodom (config↔layout konflikt = hard failure).
 * §11:   rights gate — pending+production → blokiran, pending+evaluation → dovoljen,
 *        rejected → vedno 403, granted → dovoljen. Ekspliciten način, NI NODE_ENV.
 * §13:   KUBO — vertical dovoljen, horizontal zavrnjen, brez izmišljenega max post razmaka.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { buildFenceLayout } from '../geometry'
import { renderProductFence } from '../render'
import { getProductDefinition } from '../catalog'
import {
  evaluateRightsGate,
  resolveRightsMode,
  resolveMaxPostSpacingMm,
  SdkValidationError,
} from '../rules'
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
    spanMm: 2200,
    heightMm: 1100,
    gapMm: 20,
    ...over,
  }
}

// ───────────────────────── §2/§3 ORIENTACIJSKA PRAVILA ─────────────────────────

describe('S+8.1 §2/§3: orientacijsko-specifična montažna pravila', () => {
  it('POLNA 128 horizontal: max post spacing = 1100 (izpeljava sledi)', () => {
    const def = defOf('roksal.woodcore.polna-128')
    expect(resolveMaxPostSpacingMm(def, { orientation: 'horizontal' }, 1100)).toBe(1100)
    const lay = buildFenceLayout(config({ orientation: 'horizontal', posts: { widthMm: 60 } }), { definition: def })
    for (let i = 1; i < lay.posts.length; i++) {
      expect(lay.posts[i].centerMm - lay.posts[i - 1].centerMm).toBeLessThanOrEqual(1100)
    }
  })

  it('POLNA 128 vertical: max post spacing = 1800 — NE horizontalna vrednost (P0 regresija)', () => {
    const def = defOf('roksal.woodcore.polna-128')
    expect(resolveMaxPostSpacingMm(def, { orientation: 'vertical' }, 1100)).toBe(1800)
    const lay = buildFenceLayout(
      config({ orientation: 'vertical', spanMm: 3600, posts: { widthMm: 60, positionsMm: [0, 1800, 3600] } }),
      { definition: def },
    )
    // interval 1800 = natanko max → VELJAVEN (prej bi 1100 pravilo to zavrnilo ali opozorilo)
    expect(lay.posts.map((p) => p.centerMm)).toEqual([0, 1800, 3600])
  })

  it('POLNA 128 verticalOver150Cm: višina > 1500 → efektivni max = 1500', () => {
    const def = defOf('roksal.woodcore.polna-128')
    expect(resolveMaxPostSpacingMm(def, { orientation: 'vertical' }, 1500)).toBe(1800) // natanko 1500: pravilo še ne velja
    expect(resolveMaxPostSpacingMm(def, { orientation: 'vertical' }, 1501)).toBe(1500) // nad 150 cm
    expect(() =>
      buildFenceLayout(
        config({ orientation: 'vertical', spanMm: 3600, heightMm: 1600, posts: { widthMm: 60, positionsMm: [0, 1800, 3600] } }),
        { definition: def },
      ),
    ).toThrow(/presega katalog max 1500/)
  })

  it('POLNA 128 horizontalOver150Cm NE obstaja → visoka horizontalna ograja ostane pri 1100', () => {
    const def = defOf('roksal.woodcore.polna-128')
    expect(resolveMaxPostSpacingMm(def, { orientation: 'horizontal' }, 2000)).toBe(1100)
  })

  it('ROMB 67 vertical: max post NI dokumentiran → null + izpeljava ZAVRNJENA (eksplicitne pozicije obvezne)', () => {
    const def = defOf('roksal.woodcore.romb-67')
    expect(resolveMaxPostSpacingMm(def, { orientation: 'vertical' }, 1100)).toBeNull()
    const lay = buildFenceLayout(
      config({ productId: 'roksal.woodcore.romb-67', orientation: 'vertical', posts: { widthMm: 60 } }),
      { definition: def },
    )
    expect(lay.posts.length).toBe(0)
    expect(lay.warnings.some((w) => w.includes('NISO izpeljani'))).toBe(true)
  })

  it('KRITIČNO (§3): horizontalno pravilo NIKOLI ni fallback za vertical (in obratno)', () => {
    const romb = defOf('roksal.woodcore.romb-67') // H=1450, V=null
    expect(resolveMaxPostSpacingMm(romb, { orientation: 'vertical' }, 1100)).toBeNull()
    const polna57 = defOf('roksal.woodcore.polna-57-32') // V=1500, H=null
    expect(resolveMaxPostSpacingMm(polna57, { orientation: 'horizontal' }, 1100)).toBeNull()
    const polna100 = defOf('roksal.woodcore.polna-100') // V=1800, H=null
    expect(resolveMaxPostSpacingMm(polna100, { orientation: 'horizontal' }, 1100)).toBeNull()
  })

  it('ROMB 67 horizontalWithMidConnection je OHRANJEN kot podatek, a NI samodejen (pogoj ni modeliran)', () => {
    const def = defOf('roksal.woodcore.romb-67')
    // Nič v konfiguraciji ne izraža "mid connection" → pravilo se NE uporabi samodejno.
    expect(resolveMaxPostSpacingMm(def, { orientation: 'horizontal' }, 1100)).toBe(1450)
  })
})

// ───────────────────────── §4/§5 HARD VALIDACIJA POSTOV ─────────────────────────

describe('S+8.1 §4/§5: eksplicitne post pozicije so HARD validirane', () => {
  const def = () => defOf('roksal.woodcore.polna-128') // H max 1100

  it('post < 0 → validation error (NE warning)', () => {
    expect(() =>
      buildFenceLayout(config({ posts: { widthMm: 60, positionsMm: [-100, 1100, 2200] } }), { definition: def() }),
    ).toThrow(SdkValidationError)
    expect(() =>
      buildFenceLayout(config({ posts: { widthMm: 60, positionsMm: [-100, 1100, 2200] } }), { definition: def() }),
    ).toThrow(/izven polja/)
  })

  it('post > span → validation error', () => {
    expect(() =>
      buildFenceLayout(config({ posts: { widthMm: 60, positionsMm: [0, 1100, 2400] } }), { definition: def() }),
    ).toThrow(/izven polja/)
  })

  it('NaN in Infinity → validation error', () => {
    expect(() =>
      buildFenceLayout(config({ posts: { widthMm: 60, positionsMm: [0, NaN, 2200] } }), { definition: def() }),
    ).toThrow(/ni končna/)
    expect(() =>
      buildFenceLayout(config({ posts: { widthMm: 60, positionsMm: [0, Infinity, 2200] } }), { definition: def() }),
    ).toThrow(/ni končna/)
  })

  it('duplicirane pozicije → validation error', () => {
    expect(() =>
      buildFenceLayout(config({ posts: { widthMm: 60, positionsMm: [0, 1100, 1100, 2200] } }), { definition: def() }),
    ).toThrow(/dupliciran/)
  })

  it('neurejene (padajoče) pozicije → validation error (NI tišega razvrščanja)', () => {
    expect(() =>
      buildFenceLayout(config({ posts: { widthMm: 60, positionsMm: [2200, 1100, 0] } }), { definition: def() }),
    ).toThrow(/naraščajoče/)
  })

  it('max + 1 mm → validation error; exact max → VELJAVNO', () => {
    expect(() =>
      buildFenceLayout(config({ posts: { widthMm: 60, positionsMm: [0, 1101, 2200] } }), { definition: def() }),
    ).toThrow(/presega katalog max 1100/)
    const ok = buildFenceLayout(config({ posts: { widthMm: 60, positionsMm: [0, 1100, 2200] } }), { definition: def() })
    expect(ok.posts.map((p) => p.centerMm)).toEqual([0, 1100, 2200])
  })

  it('kadar max NE obstaja: eksplicitne pozicije dovoljene, osnovna geometrijska validacija ostane', () => {
    const kubo = defOf('roksal.woodcore.kubo-80-42') // max post = null
    const ok = buildFenceLayout(
      config({ productId: kubo.id, orientation: 'vertical', spanMm: 2500, posts: { widthMm: 60, positionsMm: [0, 2500] } }),
      { definition: kubo },
    )
    expect(ok.posts.map((p) => p.centerMm)).toEqual([0, 2500])
    // tudi brez katalog max: izven polja ostane napaka
    expect(() =>
      buildFenceLayout(
        config({ productId: kubo.id, orientation: 'vertical', spanMm: 2500, posts: { widthMm: 60, positionsMm: [0, 2600] } }),
        { definition: kubo },
      ),
    ).toThrow(/izven polja/)
  })

  it('brez postov / en post / dva posta → veljavni primeri', () => {
    const noPosts = buildFenceLayout(config(), { definition: def() })
    expect(noPosts.posts).toEqual([])
    const one = buildFenceLayout(config({ posts: { widthMm: 60, positionsMm: [0] } }), { definition: def() })
    expect(one.posts.length).toBe(1)
    expect(one.posts[0].role).toBe('terminal')
    // interval 1100 = natanko katalog max → veljavno
    const two = buildFenceLayout(config({ posts: { widthMm: 60, positionsMm: [0, 1100] } }), { definition: def() })
    expect(two.posts.map((p) => p.role)).toEqual(['terminal', 'terminal'])
  })

  it('NaN spanMm/heightMm/gapMm → validation error (SDK branega ni za API shemo)', () => {
    expect(() => buildFenceLayout(config({ spanMm: NaN }), { definition: def() })).toThrow(/končna/)
    expect(() => buildFenceLayout(config({ heightMm: Infinity }), { definition: def() })).toThrow(/končna/)
    expect(() => buildFenceLayout(config({ gapMm: NaN }), { definition: def() })).toThrow(/končna/)
  })
})

// ───────────────────────── §6 CEVI (RAILS) ─────────────────────────

describe('S+8.1 §6: rail validacija', () => {
  it('izpeljane cevi: znotraj polja, naraščajoče, brez duplikatov, interval ≤ max', () => {
    const def = defOf('roksal.woodcore.polna-128') // maxRail 1000
    const lay = buildFenceLayout(config({ orientation: 'vertical', spanMm: 1200, heightMm: 1900 }), { definition: def })
    expect(lay.rails.length).toBeGreaterThanOrEqual(2)
    for (const r of lay.rails) {
      expect(r.centerMm).toBeGreaterThanOrEqual(0)
      expect(r.centerMm).toBeLessThanOrEqual(lay.fieldHeightMm)
      expect(r.crossSectionMm).toBeNull() // presek NI v katalogu — ostaja null (ni izmišljen)
    }
    for (let i = 1; i < lay.rails.length; i++) {
      const d = lay.rails[i].centerMm - lay.rails[i - 1].centerMm
      expect(d).toBeGreaterThan(0)
      expect(d).toBeLessThanOrEqual(1000)
    }
  })

  it('KUBO: max rail spacing = 1000 (katalog), cevi izpeljane po njem', () => {
    const def = defOf('roksal.woodcore.kubo-80-42')
    const lay = buildFenceLayout(
      config({ productId: def.id, orientation: 'vertical', spanMm: 1200, heightMm: 2000, gapMm: 20 }),
      { definition: def },
    )
    expect(def.mounting.maxRailSpacingMm).toBe(1000)
    for (let i = 1; i < lay.rails.length; i++) {
      expect(lay.rails[i].centerMm - lay.rails[i - 1].centerMm).toBeLessThanOrEqual(1000)
    }
  })

  it('horizontalna ograja ima NULA cevi (invarianta railRules)', () => {
    const def = defOf('roksal.woodcore.polna-128')
    const lay = buildFenceLayout(config({ orientation: 'horizontal' }), { definition: def })
    expect(lay.rails).toEqual([])
  })
})

// ───────────────────────── §10 RENDER ↔ KONFLIKTNI VHODI ─────────────────────────

describe('S+8.1 §10: renderer ne zaupa konfliktnim vhodom (layout je kanoničen)', () => {
  const def = defOf('roksal.woodcore.polna-128')
  const material = { measuredRgb: [110, 82, 60] as [number, number, number] }

  it('config.spanMm ≠ layout.bounds.widthMm → HARD FAILURE (npr. 3000 vs 2800)', () => {
    const layout = buildFenceLayout(config({ spanMm: 2800 }), { definition: def })
    expect(() =>
      renderProductFence({ definition: def, config: config({ spanMm: 3000 }), layout, material, outWidthPx: 400, outHeightPx: 300 }),
    ).toThrow(/konflikt.*spanMm/)
  })

  it('config.gapMm ≠ layout.gapMm → HARD FAILURE (npr. 20 vs 30)', () => {
    const layout = buildFenceLayout(config(), { definition: def })
    expect(() =>
      renderProductFence({ definition: def, config: config({ gapMm: 30 }), layout, material, outWidthPx: 400, outHeightPx: 300 }),
    ).toThrow(/konflikt.*gapMm/)
  })

  it('orientation konflikt → HARD FAILURE', () => {
    const layout = buildFenceLayout(config({ orientation: 'vertical', spanMm: 1200 }), { definition: def })
    expect(() =>
      renderProductFence({
        definition: def,
        config: config({ orientation: 'vertical', spanMm: 1200, heightMm: 1100 }),
        layout,
        material,
        outWidthPx: 400,
        outHeightPx: 300,
      }),
    ).not.toThrow() // isti config → skladno
    expect(() =>
      renderProductFence({ definition: def, config: config(), layout, material, outWidthPx: 400, outHeightPx: 300 }),
    ).toThrow(/konflikt.*orientation/)
  })

  it('skladen config+layout → render OK (layout kanoničen, brez napak)', () => {
    const layout = buildFenceLayout(config(), { definition: def })
    const res = renderProductFence({ definition: def, config: config(), layout, material, outWidthPx: 400, outHeightPx: 300 })
    expect(res.renderValid).toBe(true)
  })
})

// ───────────────────────── §11 RIGHTS GATE ─────────────────────────

describe('S+8.1 §11: rights gate (ekspliciten način, NI NODE_ENV)', () => {
  afterEach(() => {
    delete process.env.ROKSAL_RIGHTS_MODE
  })

  it('pending + production → BLOKIRAN (403)', () => {
    const def = { id: 'x', rights: 'pending' as const }
    const d = evaluateRightsGate(def, 'production')
    expect(d.allowed).toBe(false)
    expect(d.httpStatus).toBe(403)
  })

  it('pending + explicit evaluation mode → DOVOLJEN (odkrito oznaka)', () => {
    const def = { id: 'x', rights: 'pending' as const }
    const d = evaluateRightsGate(def, 'evaluation')
    expect(d.allowed).toBe(true)
    expect(d.httpStatus).toBe(200)
    expect(d.reason).toMatch(/interno development\/evalvacijo/)
  })

  it('rejected → VEDNO blokiran (403) v OBEH načinih', () => {
    const def = { id: 'x', rights: 'rejected' as const }
    expect(evaluateRightsGate(def, 'production').httpStatus).toBe(403)
    expect(evaluateRightsGate(def, 'evaluation').httpStatus).toBe(403)
    expect(evaluateRightsGate(def, 'production').allowed).toBe(false)
    expect(evaluateRightsGate(def, 'evaluation').allowed).toBe(false)
  })

  it('granted → dovoljen v OBEH načinih', () => {
    const def = { id: 'x', rights: 'granted' as const }
    expect(evaluateRightsGate(def, 'production').allowed).toBe(true)
    expect(evaluateRightsGate(def, 'evaluation').allowed).toBe(true)
  })

  it('resolveRightsMode: env ROKSAL_RIGHTS_MODE=production → production; brez → evaluation (razvojni deployment)', () => {
    process.env.ROKSAL_RIGHTS_MODE = 'production'
    expect(resolveRightsMode()).toBe('production')
    delete process.env.ROKSAL_RIGHTS_MODE
    expect(resolveRightsMode()).toBe('evaluation')
    expect(resolveRightsMode('production')).toBe('production')
    expect(resolveRightsMode('evaluation')).toBe('evaluation')
  })

  it('SDK buildFenceLayout ob rights=rejected zavrže ne glede na način (neodvisno od API)', () => {
    const def = { ...defOf('roksal.woodcore.polna-128'), rights: 'rejected' as const }
    expect(() => buildFenceLayout(config(), { definition: def })).toThrow(SdkValidationError)
  })
})

// ───────────────────────── §13 KUBO ─────────────────────────

describe('S+8.1 §13: KUBO 80/42', () => {
  it('vertical → dovoljen; max rail 1000; brez izmišljenega max post razmaka', () => {
    const def = defOf('roksal.woodcore.kubo-80-42')
    const lay = buildFenceLayout(
      config({ productId: def.id, orientation: 'vertical', spanMm: 1200, heightMm: 2000, gapMm: 20 }),
      { definition: def },
    )
    expect(lay.orientation).toBe('vertical')
    expect(lay.rails.length).toBeGreaterThanOrEqual(2)
    expect(resolveMaxPostSpacingMm(def, { orientation: 'vertical' }, 2000)).toBeNull()
    // brez pozicij: stebri NISO izpeljani — nič izmišljenega
    const noExplicit = buildFenceLayout(
      config({ productId: def.id, orientation: 'vertical', spanMm: 1200, heightMm: 2000, gapMm: 20, posts: { widthMm: 60 } }),
      { definition: def },
    )
    expect(noExplicit.posts).toEqual([])
  })

  it('horizontal → ZAVRJEN (vertical only)', () => {
    const def = defOf('roksal.woodcore.kubo-80-42')
    expect(() =>
      buildFenceLayout(config({ productId: def.id, orientation: 'horizontal' }), { definition: def }),
    ).toThrow(/NE podpira orientacije/)
  })
})
