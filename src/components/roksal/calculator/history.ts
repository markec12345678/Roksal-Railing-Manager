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
