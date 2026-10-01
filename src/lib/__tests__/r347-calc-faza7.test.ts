// R347 — dekompozicija calculator-tab FAZA 7: ključni rezultat + shranjevanje
// izračunov EN VIR (vzorec R325/R345/R346: closure dostop do stanja →
// eksplicitni args objekti).
// ---------------------------------------------------------------------------
//  • calculator/history.ts — getCurrentKeyResult (10 načinov + fallback)
//    izluščen VERBATIM iz taba; komponenta podaja rezultate + rezerve +
//    stekleni vhod prek RezultatiNacinov args objekta;
//  • unifikacija stale kopij: "Shrani izračun" gumb je nosil STAREJŠE formate
//    (baluster brez rezerve, material z toFixed(2)€, cnc brez ostanka) — zdaj
//    ISTA resnica kot zgodovina (collectCurrentInputs + getCurrentKeyResult);
//  • POPRAVEK POGREŠE: nalaganje shranjenih izračunov je bilo 3-načinsko
//    (railing/anchoring/wind) — ostalih 7 načinov = tih no-op z toastom;
//    zdaj applyInputs EN VIR (vsi 10 načinov, konsistentno z zgodovino);
//  • determinizem: isti vhod = bajtno isti niz.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getCurrentKeyResult, type RezultatiNacinov } from '@/components/roksal/calculator/history'

const TAB = join(process.cwd(), 'src/components/roksal/calculator-tab.tsx')
const HIST = join(process.cwd(), 'src/components/roksal/calculator/history.ts')

const tab = readFileSync(TAB, 'utf8')
const hist = readFileSync(HIST, 'utf8')

/** Pomožnica: args objekt z vsemi rezultati (null po privzetem, čez po potrebi). */
function rezultati(over: Partial<RezultatiNacinov> = {}): RezultatiNacinov {
  return {
    railingResult: null,
    anchoringResult: null,
    windResult: null,
    balusterResult: null,
    angledResult: null,
    materialResult: null,
    complianceResult: null,
    cncResult: null,
    windLocResult: null,
    glassResult: null,
    rezervaPctBaluster: 10,
    rezervaPctMaterial: 10,
    glassInput: { spanMm: 1200, heightMm: 1100, loadKnPerM: 1.0, glassType: 'laminated' },
    ...over,
  }
}

describe('r347 calc FAZA 7 — getCurrentKeyResult (10 načinov)', () => {
  it('railing + anchoring: osnovna oblika z eno decalko / patroni', () => {
    const r = getCurrentKeyResult('railing', rezultati({
      railingResult: { slatCount: 12, actualGapMm: 98.55, totalSlatsLengthMm: 0, totalGapsLengthMm: 0, isCompliant: true, warnings: [] },
    }))
    expect(r).toBe('12 letvev, razmik 98.5mm')
    const a = getCurrentKeyResult('anchoring', rezultati({
      anchoringResult: { resinVolumeMl: 0, totalResinMl: 240, curingTimeMin: 0, cartridgesNeeded: 3 } as never,
    }))
    expect(a).toBe('240ml smola, 3 patronov')
  })

  it('wind + windLocation: riskLabels EN VIR + cona v windLocation', () => {
    const w = getCurrentKeyResult('wind', rezultati({
      windResult: { windPressureKpa: 0.713, riskLevel: 'MEDIUM' } as never,
    }))
    expect(w).toBe('0.71 kPa, Srednje tveganje')
    const wl = getCurrentKeyResult('windLocation', rezultati({
      windLocResult: { locationDescription: 'Kranj', windZone: '2', riskLevel: 'LOW' } as never,
    }))
    expect(wl).toBe('Kranj — cona 2, Nizko tveganje')
  })

  it('baluster + material: applyReserve + formatEUR (bogatejši kanon zgodovine)', () => {
    const b = getCurrentKeyResult('baluster', rezultati({
      balusterResult: { balusterCount: 20, actualGapMm: 110 } as never,
      rezervaPctBaluster: 15,
    }))
    expect(b).toBe('23 palic (rezerva 15%), razmik 110.0mm')
    const m = getCurrentKeyResult('material', rezultati({
      materialResult: { totalLinearMeters: 12.345, balusterCount: 10, totalCost: 1234.5 } as never,
      rezervaPctMaterial: 10,
    }))
    expect(m).toContain('12.35m profila')
    expect(m).toContain('11 palic')
    // formatEUR kanon (locale oblika) — stale inline je bil surov toFixed(2)€
    expect(m).toContain('1.234,50 €')
    expect(m).not.toContain('1234.50€')
  })

  it('compliance + cnc: delež preverbov + izkoristek z ostankom', () => {
    const c = getCurrentKeyResult('compliance', rezultati({
      complianceResult: { checks: [{ passed: true }, { passed: true }, { passed: false }] } as never,
    }))
    expect(c).toBe('2/3 preverb uspešnih')
    const cn = getCurrentKeyResult('cnc', rezultati({
      cncResult: { stockCount: 2, overallUtilizationPct: 87.44, totalWasteMm: 950 } as never,
    }))
    expect(cn).toBe('2 profilov, izkoristek 87.4%, ostanek 950mm')
  })

  it('glass: sloje/kaljeno/enojno + VARNO/NEVARNO', () => {
    const g1 = getCurrentKeyResult('glass', rezultati({
      glassResult: { recommendedThicknessMm: 16, layers: 2, isSafe: true } as never,
    }))
    expect(g1).toBe('16mm laminirano (2 sloje) — VARNO')
    const g2 = getCurrentKeyResult('glass', rezultati({
      glassResult: { recommendedThicknessMm: 10, layers: 0, isSafe: false } as never,
      glassInput: { spanMm: 1200, heightMm: 1100, loadKnPerM: 1.0, glassType: 'tempered' },
    }))
    expect(g2).toBe('10mm kaljeno — NEVARNO')
    const g3 = getCurrentKeyResult('glass', rezultati({
      glassResult: { recommendedThicknessMm: 8, layers: 0, isSafe: true } as never,
    }))
    expect(g3).toBe('8mm enojno — VARNO')
  })

  it('fallback: vse rezultati null → oznaka načina (modeLabels EN VIR)', () => {
    expect(getCurrentKeyResult('railing', rezultati())).toBe('Razmiki letev')
    expect(getCurrentKeyResult('glass', rezultati())).toBe('Steklena balustrada')
  })

  it('determinizem: isti args = bajtno isti niz (×3 teki)', () => {
    const args = rezultati({
      balusterResult: { balusterCount: 20, actualGapMm: 110 } as never,
      rezervaPctBaluster: 10,
    })
    const a = getCurrentKeyResult('baluster', args)
    const b = getCurrentKeyResult('baluster', args)
    const c = getCurrentKeyResult('baluster', { ...args, rezervaPctBaluster: 10 })
    expect(a).toBe(b)
    expect(b).toBe(c)
  })
})

describe('r347 calc FAZA 7 — unifikacija stale kopij + popravke pogreše', () => {
  it('tab: NI vec lokalne definicije getCurrentKeyResult — modul edini vir', () => {
    expect(tab).not.toContain('function getCurrentKeyResult(')
    expect(hist).toContain('export function getCurrentKeyResult(')
    expect((tab.match(/getCurrentKeyResult\(mode, rezultatiNacinov\(\)\)/g) ?? []).length).toBe(2)
  })

  it('tab: args objekt rezultatiNacinov ×1 definicija + uvoz iz history', () => {
    expect((tab.match(/const rezultatiNacinov = \(\): RezultatiNacinov => \(\{/g) ?? []).length).toBe(1)
    expect(tab).toContain('getCurrentKeyResult,')
    expect(tab).toContain('type RezultatiNacinov,')
  })

  it('tab: stale inline if/else kopija v Shrani izračun gumbu ODSTRANJENA', () => {
    expect(tab).not.toContain("keyResult = `${materialResult.totalCost.toFixed(2)}€`")
    expect(tab).not.toContain('keyResult = `${balusterResult.balusterCount} palic, razmik')
    // istočasno collectCurrentInputs + getCurrentKeyResult sta skupaj v onClick
    const i = tab.indexOf('R347 FAZA 7: EN VIR — prej stale inline kopija')
    const okno = tab.slice(i, i + 400)
    expect(okno).toContain('getCurrentKeyResult(mode, rezultatiNacinov())')
    expect(okno).toContain('collectCurrentInputs(mode, vhodnaStanja())')
  })

  it('POPREVEK pogreše: nalaganje shranjenih izračunov = applyInputs (vsi 10 načinov)', () => {
    // stale 3-načinski inline blok je odstranjen
    expect(tab).not.toContain('// Load saved inputs back')
    expect(tab).not.toContain("setMode('anchoring')\n                    } else if (calc.mode === 'wind')")
    // EN VIR klic je prisoten (setMode + applyInputs + toast)
    const i = tab.indexOf('R347 FAZA 7: EN VIR applyInputs')
    const okno = tab.slice(i, i + 460)
    expect(okno).toContain('setMode(calc.mode)')
    expect(okno).toContain('applyInputs(calc.mode, calc.inputs, nastavljalci())')
  })

  it('FAZA 6 regresija: inputs.ts + args objekta vhodnaStanja/nastavljalci še živi', () => {
    const inputs = readFileSync(join(process.cwd(), 'src/components/roksal/calculator/inputs.ts'), 'utf8')
    expect(inputs).toContain('export function collectCurrentInputs(')
    expect(inputs).toContain('export function applyInputs(')
    expect(tab).toContain('const vhodnaStanja = (): VhodnaStanja => ({')
    expect(tab).toContain('const nastavljalci = (): NastavljalciVhodov => ({')
    expect((tab.match(/collectCurrentInputs\(mode, vhodnaStanja\(\)\)/g) ?? []).length).toBe(3)
  })

  it('history.ts: 0 hex barvnih literalkov (stil = brez novih hex)', () => {
    expect(hist.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull()
  })
})
