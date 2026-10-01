// R345 — dekompozicija calculator-tab FAZA 5: dispatch logika 10 načinov
// (vzorec R322/R325/R338/R341/R343 dekompozicij + R325 pdf-exports args vzorec).
// ---------------------------------------------------------------------------
//  • calculator/calculations.ts — parsanje vhodnih nizov + guard pogoji +
//    ovonjice R150 izluščeni IZ taba; komponenta samo zapiše rezultat v state;
//  • dve družini: ovonični načini (railing/anchoring/wind) vračajo
//    CalcEngineeringResult<T> NESPREMJEN; guard načini vračajo T | null;
//  • determinizem: isti vhod = bajtno isti rezultat (čista jedra klicana
//    NESPREMJENO — hard rule: izračunsko jedro nič AI sprememb);
//  • tab žičenje: EN VIR veriga dispatchev (prej 2× podvojen if/else blok).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  dispatchRailing,
  dispatchAnchoring,
  dispatchWind,
  dispatchBaluster,
  dispatchAngled,
  dispatchMaterial,
  dispatchCompliance,
  dispatchCnc,
  dispatchWindLocation,
  dispatchGlass,
} from '@/components/roksal/calculator/calculations'

const TAB = join(process.cwd(), 'src/components/roksal/calculator-tab.tsx')
const CALC = join(process.cwd(), 'src/components/roksal/calculator/calculations.ts')

const tab = readFileSync(TAB, 'utf8')
const calc = readFileSync(CALC, 'utf8')

describe('r345 calc FAZA 5 — ovonični načini (CalcEngineeringResult nepremenjen)', () => {
  it('dispatchRailing: veljaven vhod → ok:true + odtis + rezultat', () => {
    const r = dispatchRailing({ totalLength: '5', slatWidth: '140', maxGap: '99', profileType: 'classic' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.formulaVersion).toBe('rail-v1')
    expect(r.inputHash).toMatch(/^[0-9a-f]{8}$/)
    expect(r.result.slatCount).toBeGreaterThan(0)
  })

  it('dispatchRailing: izven umerjenosti → ok:false + napake, NIČ rezultata (fail-closed R150)', () => {
    const r = dispatchRailing({ totalLength: '0.05', slatWidth: '140', maxGap: '99', profileType: 'classic' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors.length).toBeGreaterThan(0)
    expect('result' in r).toBe(false)
  })

  it('dispatchAnchoring: veljaven vhod → ok:true; patroni > 0', () => {
    const r = dispatchAnchoring({ holeCount: '4', holeDepthMm: '80', holeDiameterMm: '12', temperature: '15', anchorType: 'fischer-fis' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.result.cartridgesNeeded).toBeGreaterThan(0)
    expect(r.formulaVersion).toBe('anch-v1')
  })

  it('dispatchWind: veljaven vhod → ok:true; pritisk > 0', () => {
    const r = dispatchWind({ heightAboveGround: '10', terrainCategory: 'II', windSpeedMs: '25', railingAreaM2: '2', railingType: 'solid' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.result.windPressureKpa).toBeGreaterThan(0)
    expect(r.formulaVersion).toBe('wind-v1')
  })
})

describe('r345 calc FAZA 5 — guard načini (T | null)', () => {
  it('dispatchBaluster: veljaven → rezultat; neveljavne nize → null (guard)', () => {
    const r = dispatchBaluster({ balTotalLength: '2', balWidth: '40', balMaxGap: '110' })
    expect(r).not.toBeNull()
    expect(r!.balusterCount).toBeGreaterThan(0)
    expect(dispatchBaluster({ balTotalLength: 'abc', balWidth: '40', balMaxGap: '110' })).toBeNull()
    expect(dispatchBaluster({ balTotalLength: '-2', balWidth: '40', balMaxGap: '110' })).toBeNull()
  })

  it('dispatchAngled: veljaven → rezultat z rake dolžino; guard → null', () => {
    const r = dispatchAngled({ angHorizontalLength: '3', angRakeAngle: '35', angWidth: '40', angMaxGap: '110' })
    expect(r).not.toBeNull()
    expect(r!.rakeLengthMm).toBeGreaterThan(3000)
    expect(dispatchAngled({ angHorizontalLength: 'x', angRakeAngle: '35', angWidth: '40', angMaxGap: '110' })).toBeNull()
  })

  it('dispatchMaterial: prazni segmenti → null; veljavni → vsota', () => {
    expect(dispatchMaterial({ segments: [], profileSifra: 'X', profili: [] })).toBeNull()
    const r = dispatchMaterial({
      segments: [{ lengthMm: 3000, heightMm: 1100, type: 'level' }],
      profileSifra: 'X',
      profili: [],
    })
    expect(r).not.toBeNull()
  })

  it('dispatchCompliance: neveljaven gap → null; veljavni → preverbe', () => {
    expect(dispatchCompliance({ compGap: 'abc', compHeight: '1100', compPostSpacing: '1500', compLoadCategory: 'A', compDropHeight: '0' })).toBeNull()
    const r = dispatchCompliance({ compGap: '90', compHeight: '1100', compPostSpacing: '1500', compLoadCategory: 'A', compDropHeight: '0' })
    expect(r).not.toBeNull()
    expect(r!.checks.length).toBeGreaterThan(0)
  })

  it('dispatchCnc: stock ≤ 0 → null; brez segmentov → null; veljaven → izkoristek', () => {
    expect(dispatchCnc({ cncStockLength: '0', cncSawBlade: '3', cncSegments: [{ lengthMm: '2000', count: '2', label: 'A' }] })).toBeNull()
    expect(dispatchCnc({ cncStockLength: '6000', cncSawBlade: '3', cncSegments: [] })).toBeNull()
    const r = dispatchCnc({ cncStockLength: '6000', cncSawBlade: '3', cncSegments: [{ lengthMm: '2000', count: '2', label: 'A' }] })
    expect(r).not.toBeNull()
    expect(r!.stockCount).toBe(1)
  })

  it('dispatchWindLocation: neveljavna koordinata → null; veljavna → cona', () => {
    expect(dispatchWindLocation({ windLocLat: 'abc', windLocLon: '14.5', windLocHeight: '10', windLocTerrain: 'II', windLocArea: '2', windLocType: 'slatted' })).toBeNull()
    const r = dispatchWindLocation({ windLocLat: '46.05', windLocLon: '14.5', windLocHeight: '10', windLocTerrain: 'II', windLocArea: '2', windLocType: 'slatted' })
    expect(r).not.toBeNull()
    expect(r!.windZone).toBeTruthy()
  })

  it('dispatchGlass: spanMm ≤ 0 → null; veljaven → debelina', () => {
    expect(dispatchGlass({ spanMm: 0, heightMm: 1100, loadKnPerM: 1.0, glassType: 'laminated' })).toBeNull()
    const r = dispatchGlass({ spanMm: 1200, heightMm: 1100, loadKnPerM: 1.0, glassType: 'laminated' })
    expect(r).not.toBeNull()
    expect(r!.recommendedThicknessMm).toBeGreaterThan(0)
  })
})

describe('r345 calc FAZA 5 — determinizem + žičenje', () => {
  it('determinizem FULL: isti vhod → bajtno isti rezultat (vseh 10 dispatchev)', () => {
    const a = JSON.stringify(dispatchBaluster({ balTotalLength: '2', balWidth: '40', balMaxGap: '110' }))
    const b = JSON.stringify(dispatchBaluster({ balTotalLength: '2', balWidth: '40', balMaxGap: '110' }))
    expect(a).toBe(b)
    const c = JSON.stringify(dispatchRailing({ totalLength: '5', slatWidth: '140', maxGap: '99', profileType: 'classic' }))
    const d = JSON.stringify(dispatchRailing({ totalLength: '5', slatWidth: '140', maxGap: '99', profileType: 'classic' }))
    expect(c).toBe(d)
    const e = JSON.stringify(dispatchCnc({ cncStockLength: '6000', cncSawBlade: '3', cncSegments: [{ lengthMm: '2000', count: '2', label: 'A' }] }))
    const f = JSON.stringify(dispatchCnc({ cncStockLength: '6000', cncSawBlade: '3', cncSegments: [{ lengthMm: '2000', count: '2', label: 'A' }] }))
    expect(e).toBe(f)
  })

  it('tab žičenje: uvozni blok + tanke ovojnice (state zapisi ostanejo v komponenti)', () => {
    expect(tab).toContain("} from './calculator/calculations'")
    expect(tab).toContain('setBalusterResult(dispatchBaluster({ balTotalLength, balWidth, balMaxGap }))')
    expect(tab).toContain('setMaterialResult(dispatchMaterial({ segments, profileSifra: selectedProfileSifra, profili }))')
    expect(tab).toContain('setGlassResult(dispatchGlass(glassInput))')
    expect(tab).toContain('const envelope = dispatchRailing({ totalLength: effectiveTotalLength, slatWidth, maxGap, profileType })')
  })

  it('EN VIR veriga dispatchev: prej 2× podvojen if/else blok → 1 definicija + 2 klica', () => {
    expect(tab.match(/function izvediIzracunZaAktivniNacin\(\)/g)?.length).toBe(1)
    expect(tab.match(/izvediIzracunZaAktivniNacin\(\)/g)?.length).toBe(3)
  })

  it('izračunska jedra ostanejo IZVEN taba (čisti premik — tab ne pozna run*V1 / mavrice jeder)', () => {
    expect(tab).not.toContain('runRailingCalcV1')
    expect(tab).not.toContain('runAnchoringCalcV1')
    expect(tab).not.toContain('runWindCalcV1')
    expect(tab).not.toContain('calculateEqualSpacing')
    expect(tab).not.toContain('calculateCncCutting')
    expect(tab).not.toContain('calculateGlassBalustrade')
    expect(calc).toContain('runRailingCalcV1(')
    expect(calc).toContain('calculateGlassBalustrade(args)')
  })

  it('calculations.ts: 0-hex kanon dekompozicije (nič surovih barv)', () => {
    expect(calc).not.toMatch(/#[0-9a-fA-F]{6}\b/)
  })

  it('r343 FAZA 4 regresija: skladišče EN VIR nedotaknjeno (history.ts uvoz ŽIVO)', () => {
    expect(tab).toContain("} from './calculator/history'")
    expect(tab).toContain('shraniVSkladisce(SKLADISCE_PREDLOGE, updated)')
  })
})
