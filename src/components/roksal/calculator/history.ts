// R342 — dekompozicija calculator-tab FAZA 4: skladišče zgodovine/predlog
// (vzorec R322/R325/R338/R341 dekompozicijskih rund + R341 modeLabels).
// ---------------------------------------------------------------------------
//  • localStorage ključi — prej 7× podvojeni string literali v tabu
//    ('roksal_calc_templates' ×4, 'roksal_calc_history' ×3) — zdaj EN VIR;
//  • fail-closed nalagalnik (typeof window guard + try/catch JSON.parse —
//    VERBATIM logika obeh useState inicializatorjev, zdaj ENA funkcija);
//  • fail-verbose-varovalo varni zapisovalnik/brisač (try/catch — ista
//    logika kot prej, ENA funkcija namesto 5 kopij plesa);
//  • zmogljivostne omejitve (max 30 zgodovina / max 50 predlog) — prej
//    magic števila .slice(0, N) ×3 + UI besedilo — zdaj EN VIR konstanti;
//  • zgodovinaCsvPodatki — čista gradnja glav + vrstic za 65. člen izvoz
//    (R341 kanon: toCsv + downloadCsvText ostajata v tabu — ta modul poda
//    SAMO PODATKE, mehaniko prenosa ne podvaja).
import { slDatumKratko, slCasDolgo } from '@/lib/csv-export'
import type { HistoryEntry } from './shared'
// R347 FAZA 7: ključni rezultat trenutnega načina = EN VIR (prej function v
// tabu + stale inline kopija v "Shrani izračun" gumbu).
import {
  applyReserve,
  formatEUR,
  type EqualSpacingResult,
  type AngledSpacingResult,
  type MaterialTotalResult,
  type ComplianceResult,
  type CncCutResult,
  type WindLocationResult,
  type GlassCalcResult,
} from '@/lib/calculator'
import { riskLabels, modeLabels, type CalcMode, type CalcResult, type AnchoringResult, type WindResult } from './shared'
// R346 FAZA 6 — GlassVhod tip EN VIR (inputs.ts).
import { type GlassVhod } from './inputs'

// EN VIR skladiščni ključi (prej 7× podvojeni literali v calculator-tab)
export const SKLADISCE_PREDLOGE = 'roksal_calc_templates'
export const SKLADISCE_ZGODOVINA = 'roksal_calc_history'

// EN VIR zmogljivostne omejitve (prej magic števila v slice + UI besedilu)
export const MAX_ZGODOVINA = 30
export const MAX_PREDLOG = 50

/**
 * Fail-closed nalagalnik iz brskalniškega skladišča: izven brskalnika ali ob
 * pokvarenem JSON-u vrne privzeto vrednost (nikoli ne meče — vzorec R339
 * fail-closed parse: pokvaren vhod = praznina, ne napaka).
 */
export function naloziIzSkladisca<T>(kljuc: string, privzeto: T): T {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return privzeto
  }
  try {
    const stored = localStorage.getItem(kljuc)
    if (stored) return JSON.parse(stored) as T
  } catch {
    // ignore
  }
  return privzeto
}

/** Varni zapis v skladišče — quotalimit/privatni način = tiho prezrt (kakor prej). */
export function shraniVSkladisce(kljuc: string, vrednost: unknown): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.setItem(kljuc, JSON.stringify(vrednost))
  } catch {
    // ignore
  }
}

/** Varna brisanje ključa iz skladišča (kakor prej — try/catch). */
export function odstraniIzSkladisca(kljuc: string): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.removeItem(kljuc)
  } catch {
    // ignore
  }
}

/** Glave izvoza zgodovine (65. člen — prej inline v tabu, zdaj EN VIR podatkovni modul). */
export const ZGODOVINA_CSV_GLAVE = [
  'Datum',
  'Način',
  'Ključni rezultat',
  'Projekt',
  'Formula',
  'Odtis vhodov',
  'Vhodni podatki',
] as const

/**
 * Čista gradnja vrstic izvoza zgodovine (65. člen, R341 vrstice VERBATIM —
 * 7 celic v istem vrstnem redu; brez mehanike prenosa, brez toastov —
 * klicatelj (tab) poda resnico, jedro ne ugiba; determinizem: brez časa,
 * razen podatkov, ki jih nosi zgodovina sama).
 */
export function zgodovinaCsvVrstice(history: HistoryEntry[]): string[][] {
  return history.map((h) => [
    `${slDatumKratko(new Date(h.timestamp))}, ${slCasDolgo(new Date(h.timestamp))}`,
    h.modeLabel,
    h.keyResult,
    h.projectName ?? '',
    h.formulaVersion ?? '',
    h.inputHash ?? '',
    JSON.stringify(h.inputs),
  ])
}

/**
 * R347 FAZA 7: rezultati vseh 10 načinov + rezerve + stekleni vhod —
 * eksplicitni args objekt namesto closure dostopa (vzorec R325/R345/R346).
 * Rezultati so ne-null samo za načine, ki so že izračunani.
 */
export interface RezultatiNacinov {
  railingResult: CalcResult | null
  anchoringResult: AnchoringResult | null
  windResult: WindResult | null
  balusterResult: EqualSpacingResult | null
  angledResult: AngledSpacingResult | null
  materialResult: MaterialTotalResult | null
  complianceResult: ComplianceResult | null
  cncResult: CncCutResult | null
  windLocResult: WindLocationResult | null
  glassResult: GlassCalcResult | null
  rezervaPctBaluster: number
  rezervaPctMaterial: number
  glassInput: GlassVhod
}

/**
 * R347 FAZA 7: ključni rezultat trenutnega načina za prikaz v zgodovini in
 * shranjenih izračunih. Telo VERBATIM iz calculator-tab getCurrentKeyResult
 * — samo samostojna imena → polja args objekta `a`; fallback = oznaka načina.
 */
export function getCurrentKeyResult(mode: CalcMode, a: RezultatiNacinov): string {
  if (mode === 'railing' && a.railingResult) {
    return `${a.railingResult.slatCount} letvev, razmik ${a.railingResult.actualGapMm.toFixed(1)}mm`
  } else if (mode === 'anchoring' && a.anchoringResult) {
    return `${a.anchoringResult.totalResinMl}ml smola, ${a.anchoringResult.cartridgesNeeded} patronov`
  } else if (mode === 'wind' && a.windResult) {
    return `${a.windResult.windPressureKpa.toFixed(2)} kPa, ${riskLabels[a.windResult.riskLevel]}`
  } else if (mode === 'baluster' && a.balusterResult) {
    const baseCount = a.balusterResult.balusterCount
    const withReserve = applyReserve(baseCount, a.rezervaPctBaluster)
    return `${withReserve} palic (rezerva ${a.rezervaPctBaluster}%), razmik ${a.balusterResult.actualGapMm.toFixed(1)}mm`
  } else if (mode === 'angled' && a.angledResult) {
    return `${a.angledResult.balusterCount} palic, rake ${(a.angledResult.rakeLengthMm / 1000).toFixed(2)}m, kot ${a.angledResult.rakeAngleDeg.toFixed(1)}°`
  } else if (mode === 'material' && a.materialResult) {
    return `${a.materialResult.totalLinearMeters.toFixed(2)}m profila, ${applyReserve(a.materialResult.balusterCount, a.rezervaPctMaterial)} palic, ${formatEUR(a.materialResult.totalCost)}`
  } else if (mode === 'compliance' && a.complianceResult) {
    const ok = a.complianceResult.checks.filter((c) => c.passed).length
    return `${ok}/${a.complianceResult.checks.length} preverb uspešnih`
  } else if (mode === 'cnc' && a.cncResult) {
    return `${a.cncResult.stockCount} profilov, izkoristek ${a.cncResult.overallUtilizationPct.toFixed(1)}%, ostanek ${a.cncResult.totalWasteMm}mm`
  } else if (mode === 'windLocation' && a.windLocResult) {
    return `${a.windLocResult.locationDescription} — cona ${a.windLocResult.windZone}, ${riskLabels[a.windLocResult.riskLevel]}`
  } else if (mode === 'glass' && a.glassResult) {
    return `${a.glassResult.recommendedThicknessMm}mm ${a.glassResult.layers ? `laminirano (${a.glassResult.layers} sloje)` : a.glassInput.glassType === 'tempered' ? 'kaljeno' : 'enojno'}${a.glassResult.isSafe ? ' — VARNO' : ' — NEVARNO'}`
  }
  return modeLabels[mode]
}
