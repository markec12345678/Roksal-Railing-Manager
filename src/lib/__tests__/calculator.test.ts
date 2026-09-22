// Roksal Railing Manager — testi izračunskega jedra
// ---------------------------------------------------------------------------
// Projekt doslej ni imel nobenega testa (`package.json` ni imel `test` skripte).
// Ti testi pokrivajo tri napake, ki so bile najdene z zagonom same kode, in
// delujejo kot varovalka, da se ne vrnejo:
//
//   1. `calculateMaterialTotal` — `Math.floor(L/S)+1` je podštelo stebre, kadar L
//      ni bil večkratnik S: L=4000, S=1500 → 3 stebri → 2000 mm razponi (33 % čez
//      maksimum sistema). Stebri bi bili naročeni na napačen razmik.
//   2. `calculateGlassBalustrade` — formula σ = 6·w·L²/(8·t²) je zamenjala vodoravni
//      razpon z višino konzole. Za vsak vhod je vrnila napetost 30–70× nad trdnostjo
//      stekla (8437 MPa za 8 mm), torej `isSafe = false` in priporočilo 24/25 mm
//      neodvisno od obtežbe, višine in razpona.
//   3. `checkCompliance` — pri padcu ≤ 1 m je zahtevala samo 900 mm višine, kar je
//      pod predpisanim minimumom 1000 mm za balkone.
//
// Zagon: `npm test` (vitest).

import { describe, expect, it } from 'vitest'
import {
  applyReserve,
  calculateAkontacija,
  calculateDDV,
  calculateEqualSpacing,
  calculateGlassBalustrade,
  calculateLaborCost,
  calculateMaterialTotal,
  checkCompliance,
  formatEUR,
  formatSI,
} from '../calculator'

/** Segments helper — a straight run is the common case. */
const seg = (lengthMm: number, heightMm = 1000): { lengthMm: number; heightMm: number; type: 'level' } => ({
  lengthMm,
  heightMm,
  type: 'level' as const,
})

const materialTotal = (lengthMm: number, postSpacingMm = 1500) =>
  calculateMaterialTotal({
    segments: [seg(lengthMm)],
    profileSifra: 'ALU-CLASSIC',
    profili: [],
    postSpacingMm,
  })

// ══════════════════════════════════════════════════════════════════════════════
// 1. RAZMIK STEBROV — nikoli nad maksimumom sistema
// ══════════════════════════════════════════════════════════════════════════════

describe('calculateMaterialTotal — razmik stebrov (popravek #1)', () => {
  it('L=4000, max 1500 → 4 stebri in 1333 mm razponi (ne 3 stebri / 2000 mm)', () => {
    const r = materialTotal(4000, 1500)
    expect(r.postCount).toBe(4)
    expect(r.perSegment[0].actualPostSpacingMm).toBeCloseTo(1333.3, 0)
    expect(r.perSegment[0].actualPostSpacingMm).toBeLessThanOrEqual(1500)
  })

  it('točni večkratniki ostanejo enaki — L=3000, max 1500 → 3 stebri, 1500 mm', () => {
    const r = materialTotal(3000, 1500)
    expect(r.postCount).toBe(3)
    expect(r.perSegment[0].actualPostSpacingMm).toBe(1500)
  })

  it('L=3100 (nekdaj 1550 mm) zdaj ostane pod maksimumom', () => {
    const r = materialTotal(3100, 1500)
    expect(r.perSegment[0].actualPostSpacingMm).toBeLessThanOrEqual(1500)
    expect(r.postCount).toBe(4)
  })

  it('kratek segment dobi vsaj 2 stebra (začetek in konec)', () => {
    const r = materialTotal(500, 1500)
    expect(r.postCount).toBe(2)
    expect(r.perSegment[0].actualPostSpacingMm).toBe(500)
  })

  it('lastnost: za poljubno dolžino razpon nikoli ne preseže maksimuma', () => {
    for (let L = 300; L <= 12_000; L += 137) {
      for (const S of [800, 1200, 1500]) {
        const r = materialTotal(L, S)
        expect(
          r.perSegment[0].actualPostSpacingMm,
          `L=${L} S=${S} → ${r.perSegment[0].actualPostSpacingMm} mm`,
        ).toBeLessThanOrEqual(S + 0.5)
        expect(r.postCount).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('več segmentov se sešteva, sidra in vijaki sledijo številu stebrov', () => {
    const r = calculateMaterialTotal({
      segments: [seg(4000), seg(1500), seg(2300)],
      profileSifra: 'X',
      profili: [],
      postSpacingMm: 1500,
    })
    const posts = r.perSegment.reduce((a, s) => a + s.postCount, 0)
    expect(r.postCount).toBe(posts)
    expect(r.anchorCount).toBe(posts * 2)
    expect(r.screwCount).toBe(r.balusterCount * 4 + posts * 8)
    r.perSegment.forEach((s) => expect(s.actualPostSpacingMm).toBeLessThanOrEqual(1500.5))
  })

  it('cena profila pride iz kataloga, ne iz trdih številk', () => {
    const profili = [
      {
        sifra: 'ALU-CLASSIC',
        naziv: 'ROKSAL ALU Klasik',
        material: 'Alu',
        kategorija: 'ALU',
        visinaMm: 40,
        sirinaMm: 40,
        cenaM: 32.5,
      },
    ]
    const r = calculateMaterialTotal({
      segments: [seg(3000)],
      profileSifra: 'ALU-CLASSIC',
      profili,
      postSpacingMm: 1500,
    })
    expect(r.selectedProfile?.cenaM).toBe(32.5)
    expect(r.profileCost).toBeCloseTo(r.totalLinearMeters * 32.5, 1)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 2. RAZMIK PALIC — ta izračun je bil že pravilen; testi so varovalka
// ══════════════════════════════════════════════════════════════════════════════

describe('calculateEqualSpacing — razmik palic (regresija)', () => {
  it('L=1000, palica 40, max 110 → 6 palic, razmik 108,6 mm, skladno', () => {
    const r = calculateEqualSpacing({ totalLengthMm: 1000, balusterWidthMm: 40, maxGapMm: 110 })
    expect(r.balusterCount).toBe(6)
    expect(r.actualGapMm).toBeCloseTo(108.6, 1)
    expect(r.isCompliant).toBe(true)
  })

  it('centri palic so za vrtalni šabloni in so simetrični okoli sredine', () => {
    const r = calculateEqualSpacing({ totalLengthMm: 2000, balusterWidthMm: 40, maxGapMm: 110 })
    expect(r.centers).toHaveLength(r.balusterCount)
    const mid = 2000 / 2
    // Prvi in zadnji center sta enako oddaljena od sredine.
    const firstOffset = mid - r.centers[0]
    const lastOffset = r.centers[r.centers.length - 1] - mid
    expect(firstOffset).toBeCloseTo(lastOffset, 1)
    // Centri so naraščajoči in vsi znotraj dolžine.
    r.centers.forEach((c, i) => {
      expect(c).toBeGreaterThan(0)
      expect(c).toBeLessThan(2000)
      if (i > 0) expect(c).toBeGreaterThan(r.centers[i - 1])
    })
  })

  it('lastnost: razmik nikoli ne preseže maksimuma', () => {
    for (let L = 500; L <= 6000; L += 250) {
      for (const w of [20, 40, 60]) {
        const r = calculateEqualSpacing({ totalLengthMm: L, balusterWidthMm: w, maxGapMm: 110 })
        if (r.balusterCount > 0) {
          expect(r.actualGapMm, `L=${L} w=${w}`).toBeLessThanOrEqual(110.0001)
          expect(r.isCompliant).toBe(true)
        }
      }
    }
  })

  it('neveljaven vhod ne vrže izjeme', () => {
    const r = calculateEqualSpacing({ totalLengthMm: 0, balusterWidthMm: 40, maxGapMm: 110 })
    expect(r.balusterCount).toBe(0)
    expect(r.isCompliant).toBe(false)
    expect(r.warnings.length).toBeGreaterThan(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 3. STEKLO — fizikalno smiselne številke (popravek #2)
// ══════════════════════════════════════════════════════════════════════════════

describe('calculateGlassBalustrade — statika stekla (popravek #2)', () => {
  const residential = {
    spanMm: 1200,
    heightMm: 1000,
    loadKnPerM: 0.5,
    glassType: 'tempered' as const,
  }

  it('konzola 0,5 kN/m, h=1000: 12 mm kaljeno da σ ≈ 20,8 MPa (ne 3750 MPa)', () => {
    const r = calculateGlassBalustrade(residential)
    const t12 = r.alternativeThicknesses.find((a) => a.mm === 12)!
    // σ = 6·w·h/t² = 6·0,5·1000/144 = 20,83 MPa
    expect(t12.reason).toContain('20.8')
    expect(r.stressMpa).toBeLessThan(150)
  })

  it('nobena debelina ne sme javiti napetosti nad trdnostjo jekla (stari hrošč: 8437 MPa)', () => {
    for (const glassType of ['tempered', 'laminated', 'single'] as const) {
      const r = calculateGlassBalustrade({ ...residential, glassType })
      r.alternativeThicknesses.forEach((a) => {
        const sigma = Number(a.reason.match(/σ = ([\d.]+)/)?.[1] ?? '0')
        expect(sigma, `${glassType} ${a.mm} mm → ${sigma} MPa`).toBeLessThan(500)
      })
    }
  })

  it('standardna stanovanjska ograja je varna — ne "vedno nevarna"', () => {
    const r = calculateGlassBalustrade(residential)
    expect(r.isSafe).toBe(true)
    expect(r.recommendedThicknessMm).toBe(12)
  })

  it('lepljeno steklo pri 1 m konzoli priporoči 16 mm (tržni standard 16,76 VSG)', () => {
    const r = calculateGlassBalustrade({ ...residential, glassType: 'laminated' })
    expect(r.isSafe).toBe(true)
    expect(r.recommendedThicknessMm).toBe(16)
    expect(r.layers).toBe(2)
  })

  it('debelino določa deformacija, ne napetost — in je sporočena', () => {
    const r = calculateGlassBalustrade(residential)
    expect(r.governing).toBe('deflection')
    expect(r.deflectionOk).toBe(true)
    expect(r.deflectionMm).toBeLessThanOrEqual(r.deflectionLimitMm)
    expect(r.deflectionLimitMm).toBeCloseTo(1000 / 60, 1)
  })

  it('monotonost: debelejše steklo → manjša napetost in manjša deformacija', () => {
    const r = calculateGlassBalustrade(residential)
    const sigmas = r.alternativeThicknesses.map((a) => Number(a.reason.match(/σ = ([\d.]+)/)?.[1] ?? 0))
    for (let i = 1; i < sigmas.length; i++) {
      expect(sigmas[i]).toBeLessThan(sigmas[i - 1])
    }
  })

  it('večja obtežba zahteva debeljše steklo', () => {
    const light = calculateGlassBalustrade({ ...residential, loadKnPerM: 0.36 })
    const heavy = calculateGlassBalustrade({ ...residential, loadKnPerM: 1.5 })
    expect(heavy.recommendedThicknessMm).toBeGreaterThan(light.recommendedThicknessMm)
  })

  it('višja ograja zahteva debeljše steklo', () => {
    const low = calculateGlassBalustrade({ ...residential, heightMm: 900 })
    const high = calculateGlassBalustrade({ ...residential, heightMm: 1300 })
    expect(high.recommendedThicknessMm).toBeGreaterThanOrEqual(low.recommendedThicknessMm)
  })

  it('ekstremna obtežba javi, da ročni izračun ni dovolj', () => {
    const r = calculateGlassBalustrade({ ...residential, loadKnPerM: 3 })
    expect(r.warnings.some((w) => w.includes('statična analiza'))).toBe(true)
  })

  it('enojno (nelepljeno) steklo dobi varnostno opozorilo', () => {
    const r = calculateGlassBalustrade({ ...residential, glassType: 'single' })
    expect(r.warnings.some((w) => w.includes('ni primerno za varovalne ograje'))).toBe(true)
  })

  it('model z stebri: linijsko obtežbo prevzamejo stebri, napetost v steklu je majhna', () => {
    const r = calculateGlassBalustrade({ ...residential, support: 'twoEdges' })
    expect(r.modelNote).toContain('visok nosilec')
    expect(r.stressMpa).toBeLessThan(5)
    expect(r.warnings.some((w) => w.includes('stebri'))).toBe(true)
  })

  it('ničelna obtežba ne podre računa', () => {
    const r = calculateGlassBalustrade({ ...residential, loadKnPerM: 0 })
    expect(Number.isFinite(r.stressMpa)).toBe(true)
    expect(r.isSafe).toBe(true)
    expect(r.maxHeightForThicknessMm).toBe(0)
  })

  it('maxHeightForThicknessMm je smiselna in konsistentna z izbrano debelino', () => {
    const r = calculateGlassBalustrade(residential)
    expect(r.maxHeightForThicknessMm).toBeGreaterThan(500)
    expect(r.maxHeightForThicknessMm).toBeLessThan(3000)
    // Pri priporočeni višini mora biti meja višja od dejanske višine.
    expect(r.maxHeightForThicknessMm).toBeGreaterThanOrEqual(residential.heightMm)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 4. PREDPISI (popravek #3)
// ══════════════════════════════════════════════════════════════════════════════

describe('checkCompliance — predpisi (popravek #3)', () => {
  it('900 mm ni več skladno, tudi pri majhnem padcu', () => {
    const r = checkCompliance({
      gapMm: 100,
      heightMm: 900,
      postSpacingMm: 1400,
      loadCategory: 'A',
      dropHeightMm: 500,
    })
    const height = r.checks.find((c) => c.name === 'Višina ograje')!
    expect(height.passed).toBe(false)
    expect(height.required).toContain('1000mm')
    expect(r.passed).toBe(false)
  })

  it('1000 mm je skladno', () => {
    const r = checkCompliance({
      gapMm: 100,
      heightMm: 1000,
      postSpacingMm: 1400,
      loadCategory: 'A',
      dropHeightMm: 3000,
    })
    expect(r.checks.find((c) => c.name === 'Višina ograje')!.passed).toBe(true)
  })

  it('objekt nad 20 m zahteva 1100 mm', () => {
    const r = checkCompliance({
      gapMm: 100,
      heightMm: 1050,
      postSpacingMm: 1400,
      loadCategory: 'B',
      dropHeightMm: 25_000,
    })
    const height = r.checks.find((c) => c.name === 'Višina ograje')!
    expect(height.required).toContain('1100mm')
    expect(height.passed).toBe(false)
  })

  it('razmik 120 mm med palicami ni skladen (max 110 mm)', () => {
    const r = checkCompliance({
      gapMm: 120,
      heightMm: 1000,
      postSpacingMm: 1400,
      loadCategory: 'A',
    })
    expect(r.checks.find((c) => c.name === 'Razmik med palicami')!.passed).toBe(false)
  })

  it('razmik stebrov 2000 mm (kot ga je računal stari materialTotal) ni skladen', () => {
    const r = checkCompliance({
      gapMm: 100,
      heightMm: 1000,
      postSpacingMm: 2000,
      loadCategory: 'A',
    })
    expect(r.checks.find((c) => c.name === 'Razmik med stebri')!.passed).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 5. Denar in formatiranje
// ══════════════════════════════════════════════════════════════════════════════

describe('formatiranje in denar', () => {
  it('formatSI uporablja slovensko decimalno vejico in piko za tisočice', () => {
    expect(formatSI(1234.5, 2)).toBe('1.234,50')
    expect(formatSI(1234.567, 1)).toBe('1.234,6')
    expect(formatSI(0.5, 1)).toBe('0,5')
    expect(formatSI(1_000_000, 0)).toBe('1.000.000')
  })

  it('formatEUR doda simbol za zneskom', () => {
    expect(formatEUR(1234.56)).toBe('1.234,56 €')
    expect(formatEUR(0)).toBe('0,00 €')
  })

  it('formatSI in formatEUR ne vrneta NaN ali Infinity', () => {
    expect(formatSI(NaN)).toBe('0,00')
    expect(formatSI(Infinity)).toBe('0,00')
    expect(formatEUR(NaN)).toBe('0,00 €')
  })

  it('DDV 22 %', () => {
    const r = calculateDDV(1000, 22)
    expect(r.ddvAmount).toBe(220)
    expect(r.total).toBe(1220)
  })

  it('akontacija in preostanek se seštejeta v skupni znesek', () => {
    const r = calculateAkontacija(2500, 50)
    expect(r.akontacija).toBe(1250)
    expect(r.preostanek).toBe(1250)
    expect(r.akontacija + r.preostanek).toBeCloseTo(r.total, 2)
  })

  it('applyReserve zaokroži navzgor — manjkajoč kos na terenu stane dan', () => {
    expect(applyReserve(10, 5)).toBe(11) // 10,5 → 11
    expect(applyReserve(10, 0)).toBe(10)
    expect(applyReserve(-5, 10)).toBe(0)
    expect(applyReserve(NaN, 10)).toBe(0)
  })

  it('strošek dela: ure × postavka × monterji + transport', () => {
    const r = calculateLaborCost({
      urnaPostavka: 35,
      stUr: 6,
      stMonterjev: 2,
      transport: 40,
    })
    expect(r.cistaDela).toBe(35 * 6 * 2)          // 420 EUR dela brez transporta
    expect(r.delaSkupaj).toBe(35 * 6 * 2 + 40)     // 460 EUR z transportom
    expect(r.predvideniCas).toBe(12)               // 6 ur × 2 monterja
  })
})
