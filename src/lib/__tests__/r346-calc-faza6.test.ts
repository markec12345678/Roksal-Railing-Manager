// R346 — dekompozicija calculator-tab FAZA 6: zbiranje in nalaganje vhodov
// (vzorec R325 pdf-exports / R345 calculations: closure dostop do stanja →
// eksplicitni args objekti).
// ---------------------------------------------------------------------------
//  • calculator/inputs.ts — collectCurrentInputs (Record za predloge/zgodovino)
//    in applyInputs (nalaganje nazaj prek eksplicitnih nastavljalcev) izluščeni
//    VERBATIM iz taba; komponenta podaja stanja in nastavljalce, modul logiko;
//  • determinizem: isti vhod = bajtno isti zapis (čista funkcija, NIČ časa,
//    NIČ I/O, NIČ React notranjosti);
//  • tab žičenje: args objekta vhodnaStanja()/nastavljalci() + 4 klicne mesto
//    (saveTemplate, zgodovina collect ×2 + loadTemplate/loadFromHistory).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  collectCurrentInputs,
  applyInputs,
  type VhodnaStanja,
  type NastavljalciVhodov,
} from '@/components/roksal/calculator/inputs'

const TAB = join(process.cwd(), 'src/components/roksal/calculator-tab.tsx')
const INPUTS = join(process.cwd(), 'src/components/roksal/calculator/inputs.ts')

const tab = readFileSync(TAB, 'utf8')
const inputs = readFileSync(INPUTS, 'utf8')

/** Pomožnica: poln args objekt stanj (privzete vrednosti taba, prenosljive po načinih). */
function stanja(over: Partial<VhodnaStanja> = {}): VhodnaStanja {
  return {
    profileType: 'classic', effectiveTotalLength: '3.0', slatWidth: '80', maxGap: '100', postCount: '',
    holeCount: '8', holeDepthMm: '120', holeDiameterMm: '14', temperature: '20', anchorType: 'hilti-hit',
    heightAboveGround: '10', terrainCategory: 'II', windSpeedMs: '25', railingAreaM2: '6', railingType: 'slatted',
    balTotalLength: '3.0', balWidth: '40', balMaxGap: '110', balPostSpacing: '1500', rezervaPctBaluster: 10,
    angHorizontalLength: '2.5', angRakeAngle: '35', angWidth: '40', angMaxGap: '110',
    selectedProfileSifra: '', segments: [{ lengthMm: 3000, heightMm: 1100, type: 'level' }],
    urnaPostavka: '35', stUr: '8', stMonterjev: '2', transport: '50',
    rezervaPctMaterial: 10, ddvPct: 22, akontacijaPct: 0,
    compGap: '90', compHeight: '1100', compPostSpacing: '1500', compLoadCategory: 'A', compDropHeight: '0',
    cncStockLength: '6000', cncSawBlade: '3', cncSegments: [{ lengthMm: '1200', count: '2', label: 'A' }],
    windLocLat: '46.2389', windLocLon: '14.3556', windLocHeight: '10',
    windLocTerrain: 'II', windLocArea: '6', windLocType: 'slatted',
    glassInput: { spanMm: 1200, heightMm: 1100, loadKnPerM: 1.0, glassType: 'laminated' },
    ...over,
  }
}

/** Pomožnica: snemalec nastavljalcev — vsak klic zabeleži (ime, vrednost). */
function snemalec(): { s: NastavljalciVhodov; klici: Array<[string, unknown]> } {
  const klici: Array<[string, unknown]> = []
  const s = {} as NastavljalciVhodov
  for (const key of Object.keys({
    setProfileType: 0, setTotalLength: 0, setSlatWidth: 0, setMaxGap: 0, setPostCount: 0,
    setHoleCount: 0, setHoleDepthMm: 0, setHoleDiameterMm: 0, setTemperature: 0, setAnchorType: 0,
    setHeightAboveGround: 0, setTerrainCategory: 0, setWindSpeedMs: 0, setRailingAreaM2: 0, setRailingType: 0,
    setBalTotalLength: 0, setBalWidth: 0, setBalMaxGap: 0, setBalPostSpacing: 0, setRezervaPctBaluster: 0,
    setAngHorizontalLength: 0, setAngRakeAngle: 0, setAngWidth: 0, setAngMaxGap: 0,
    setSelectedProfileSifra: 0, setSegments: 0, setUrnaPostavka: 0, setStUr: 0, setStMonterjev: 0, setTransport: 0,
    setRezervaPctMaterial: 0, setDdvPct: 0, setAkontacijaPct: 0,
    setCompGap: 0, setCompHeight: 0, setCompPostSpacing: 0, setCompLoadCategory: 0, setCompDropHeight: 0,
    setCncStockLength: 0, setCncStockPreset: 0, setCncSawBlade: 0, setCncSegments: 0,
    setWindLocLat: 0, setWindLocLon: 0, setWindLocHeight: 0, setWindLocTerrain: 0, setWindLocArea: 0, setWindLocType: 0,
    setGlassInput: 0,
  })) {
    ;(s as unknown as Record<string, (v: unknown) => void>)[key] = (v: unknown) => klici.push([key, v])
  }
  return { s, klici }
}

describe('r346 calc FAZA 6 — collectCurrentInputs (zbiranje po načinih)', () => {
  it('railing: 5 ključev, totalLength = effectiveTotalLength (uvoz zmaguje)', () => {
    const r = collectCurrentInputs('railing', stanja({ effectiveTotalLength: '4.5', postCount: '2' }))
    expect(r).toEqual({ profileType: 'classic', totalLength: '4.5', slatWidth: '80', maxGap: '100', postCount: '2' })
  })

  it('anchoring + wind: 5 ključev, vrednosti brez pretvorb', () => {
    expect(collectCurrentInputs('anchoring', stanja())).toEqual({
      holeCount: '8', holeDepthMm: '120', holeDiameterMm: '14', temperature: '20', anchorType: 'hilti-hit',
    })
    expect(collectCurrentInputs('wind', stanja())).toEqual({
      heightAboveGround: '10', terrainCategory: 'II', windSpeedMs: '25', railingAreaM2: '6', railingType: 'slatted',
    })
  })

  it('baluster + material: številčna stanja → String(), segmenti → JSON.stringify', () => {
    const bal = collectCurrentInputs('baluster', stanja({ rezervaPctBaluster: 15 }))
    expect(bal).toEqual({
      balTotalLength: '3.0', balWidth: '40', balMaxGap: '110', balPostSpacing: '1500', rezervaPctBaluster: '15',
    })
    const mat = collectCurrentInputs('material', stanja({ selectedProfileSifra: 'WPC-120-A', akontacijaPct: 30 }))
    expect(mat['profileSifra']).toBe('WPC-120-A')
    expect(mat['segments']).toBe(JSON.stringify([{ lengthMm: 3000, heightMm: 1100, type: 'level' }]))
    expect(mat['rezervaPctMaterial']).toBe('10')
    expect(mat['ddvPct']).toBe('22')
    expect(mat['akontacijaPct']).toBe('30')
    expect(mat['urnaPostavka']).toBe('35')
  })

  it('compliance + cnc + windLocation + glass: vsak način svoj zapis', () => {
    expect(collectCurrentInputs('compliance', stanja())).toEqual({
      compGap: '90', compHeight: '1100', compPostSpacing: '1500', compLoadCategory: 'A', compDropHeight: '0',
    })
    const cnc = collectCurrentInputs('cnc', stanja())
    expect(cnc['cncStockLength']).toBe('6000')
    expect(cnc['cncSawBlade']).toBe('3')
    expect(cnc['cncSegments']).toBe(JSON.stringify([{ lengthMm: '1200', count: '2', label: 'A' }]))
    expect(collectCurrentInputs('windLocation', stanja())).toEqual({
      windLocLat: '46.2389', windLocLon: '14.3556', windLocHeight: '10',
      windLocTerrain: 'II', windLocArea: '6', windLocType: 'slatted',
    })
    const glass = collectCurrentInputs('glass', stanja())
    expect(glass).toEqual({ glassSpan: '1200', glassHeight: '1100', glassLoad: '1', glassType: 'laminated' })
  })

  it('determinizem: isti args = bajtno isti JSON zapis (×3 teki)', () => {
    const a = JSON.stringify(collectCurrentInputs('material', stanja()))
    const b = JSON.stringify(collectCurrentInputs('material', stanja()))
    const c = JSON.stringify(collectCurrentInputs('material', stanja()))
    expect(a).toBe(b)
    expect(b).toBe(c)
  })
})

describe('r346 calc FAZA 6 — applyInputs (nalaganje prek nastavljalcev)', () => {
  it('railing: guard if-vrednost nastavi, manjkajoč ključ NE kliče setterja', () => {
    const { s, klici } = snemalec()
    applyInputs('railing', { profileType: 'horizontal', totalLength: '5', slatWidth: '90', maxGap: '95' }, s)
    expect(klici).toEqual([
      ['setProfileType', 'horizontal'], ['setTotalLength', '5'], ['setSlatWidth', '90'], ['setMaxGap', '95'],
    ])
    // postCount: undefined → NE nastavljen (VERBATIM guard `!== undefined`)
    const { s: s2, klici: k2 } = snemalec()
    applyInputs('railing', { postCount: '3' }, s2)
    expect(k2).toEqual([['setPostCount', '3']])
  })

  it('baluster: rezerva prek parseFloat/isFinite guardov — neveljavna → NI klica', () => {
    const { s, klici } = snemalec()
    applyInputs('baluster', { balTotalLength: '4', rezervaPctBaluster: '15' }, s)
    expect(klici).toEqual([['setBalTotalLength', '4'], ['setRezervaPctBaluster', 15]])
    const { s: s2, klici: k2 } = snemalec()
    applyInputs('baluster', { rezervaPctBaluster: 'abc' }, s2)
    expect(k2).toEqual([])
    // '0' je NE-prazen niz → truthy → guard gre skozi, parseFloat('0')=0,
    // isFinite(0)=true → setter ZAPOČE z 0 (VERBATIM vedenje izvornega taba)
    const { s: s3, klici: k3 } = snemalec()
    applyInputs('baluster', { rezervaPctBaluster: '0' }, s3)
    expect(k3).toEqual([['setRezervaPctBaluster', 0]])
    // prazen niz '' je edini falsy primer → guard preskoči, NI klica
    const { s: s4, klici: k4 } = snemalec()
    applyInputs('baluster', { rezervaPctBaluster: '' }, s4)
    expect(k4).toEqual([])
  })

  it('material: segmenti JSON guard (sprejemljiv niz, napačen JSON ignoriran) + odstotki', () => {
    const { s, klici } = snemalec()
    applyInputs('material', {
      profileSifra: 'ALU-50',
      segments: JSON.stringify([{ lengthMm: 2000, heightMm: 1000, type: 'level' }]),
      urnaPostavka: '40', stUr: '6', stMonterjev: '3', transport: '80',
      rezervaPctMaterial: '12', ddvPct: '9.5', akontacijaPct: '25',
    }, s)
    expect(klici).toEqual([
      ['setSelectedProfileSifra', 'ALU-50'],
      ['setSegments', [{ lengthMm: 2000, heightMm: 1000, type: 'level' }]],
      ['setUrnaPostavka', '40'], ['setStUr', '6'], ['setStMonterjev', '3'], ['setTransport', '80'],
      ['setRezervaPctMaterial', 12], ['setDdvPct', 9.5], ['setAkontacijaPct', 25],
    ])
    const { s: s2, klici: k2 } = snemalec()
    applyInputs('material', { segments: '{ni json' }, s2)
    expect(k2).toEqual([])
    const { s: s3, klici: k3 } = snemalec()
    applyInputs('material', { segments: '[]' }, s3)
    expect(k3).toEqual([])
  })

  it('cnc: stock length preset (znana → ista, neznana → custom) + segmenti guard', () => {
    const { s, klici } = snemalec()
    applyInputs('cnc', { cncStockLength: '4000', cncSawBlade: '5', cncSegments: '[]' }, s)
    expect(klici).toEqual([['setCncStockLength', '4000'], ['setCncStockPreset', '4000'], ['setCncSawBlade', '5']])
    const { s: s2, klici: k2 } = snemalec()
    applyInputs('cnc', { cncStockLength: '7777' }, s2)
    expect(k2).toEqual([['setCncStockLength', '7777'], ['setCncStockPreset', 'custom']])
    const { s: s3, klici: k3 } = snemalec()
    applyInputs('cnc', { cncSegments: JSON.stringify([{ lengthMm: '800', count: '1', label: '' }]) }, s3)
    expect(k3).toEqual([['setCncSegments', [{ lengthMm: '800', count: '1', label: '' }]]])
  })

  it('windLocation + glass: kastiranje terEnumov; glass nesmiselne številke → privzete vrednosti', () => {
    const { s, klici } = snemalec()
    applyInputs('windLocation', {
      windLocLat: '46.1', windLocLon: '14.8', windLocHeight: '25',
      windLocTerrain: '0', windLocArea: '8', windLocType: 'solid',
    }, s)
    expect(klici).toEqual([
      ['setWindLocLat', '46.1'], ['setWindLocLon', '14.8'], ['setWindLocHeight', '25'],
      ['setWindLocTerrain', '0'], ['setWindLocArea', '8'], ['setWindLocType', 'solid'],
    ])
    const { s: s2, klici: k2 } = snemalec()
    applyInputs('glass', { glassSpan: 'nesmisel', glassLoad: '2.5', glassType: 'tempered' }, s2)
    expect(k2).toEqual([['setGlassInput', {
      spanMm: 1200, heightMm: 1100, loadKnPerM: 2.5, glassType: 'tempered',
    }]])
    const { s: s3, klici: k3 } = snemalec()
    applyInputs('glass', {}, s3)
    expect(k3).toEqual([['setGlassInput', {
      spanMm: 1200, heightMm: 1100, loadKnPerM: 1.0, glassType: 'laminated',
    }]])
  })

  it('okrožni zapis: collect → apply → collect = ista vhodna stanja (EN VIR zanka)', () => {
    const zapis = collectCurrentInputs('baluster', stanja({ rezervaPctBaluster: 20, balTotalLength: '5.5' }))
    const { s, klici } = snemalec()
    applyInputs('baluster', zapis, s)
    expect(klici.length).toBe(5)
    expect(collectCurrentInputs('baluster', stanja({ rezervaPctBaluster: 20, balTotalLength: '5.5' }))).toEqual(zapis)
  })
})

describe('r346 calc FAZA 6 — žičenje taba (EN VIR, brez podvajanj)', () => {
  it('tab: NO enega definicije collectCurrentInputs/applyInputs — modul je edini vir', () => {
    expect(tab).not.toContain('function collectCurrentInputs(')
    expect(tab).not.toContain('function applyInputs(')
    expect((tab.match(/collectCurrentInputs\(mode, vhodnaStanja\(\)\)/g) ?? []).length).toBe(2)
    expect((tab.match(/applyInputs\(tpl\.mode, tpl\.inputs, nastavljalci\(\)\)/g) ?? []).length).toBe(1)
    expect((tab.match(/applyInputs\(entry\.mode, entry\.inputs, nastavljalci\(\)\)/g) ?? []).length).toBe(1)
  })

  it('tab: args objekta vhodnaStanja/nastavljalci (1 definicija vsak) + uvoz iz modula', () => {
    expect((tab.match(/const vhodnaStanja = \(\): VhodnaStanja => \(\{/g) ?? []).length).toBe(1)
    expect((tab.match(/const nastavljalci = \(\): NastavljalciVhodov => \(\{/g) ?? []).length).toBe(1)
    expect(tab).toContain("} from './calculator/inputs'")
    expect(tab).toContain('collectCurrentInputs,')
    expect(tab).toContain('applyInputs,')
  })

  it('inputs.ts: 0 hex barvnih literalkov (stil = brez novih hex)', () => {
    expect(inputs.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull()
  })

  it('FAZA 5 regresija: calculations.ts še živ + dispatchi v tabu ostanejo', () => {
    const calc = readFileSync(join(process.cwd(), 'src/components/roksal/calculator/calculations.ts'), 'utf8')
    expect(calc).toContain('export function dispatchRailing(')
    expect(calc).toContain('export function dispatchGlass(')
    expect(tab).toContain("} from './calculator/calculations'")
  })
})
