// R171 — CSV izvoz PRIKAZANIH terminov z dashboard Termini kartice
// (P1-d iz R168/R170). Kontrakt formata: R136/R139 (BOM, podpičje, decimalna
// vejica, CRLF — src/lib/csv-export.ts toCsv).
// ---------------------------------------------------------------------------
// IZVOŽENO = ZASLON: izvoz vsebuje NATAKO tiste vrstice, ki jih kartica
// pokaže (danes + kasneje v prikaznem vrstnem redu; filter 'Samo moje' je že
// upoštevan v filtriranih vrsticah), povzetek je ISTI terminUrPovzetek niz kot
// na kartici (EN VIR RESNICE) in metapodatek 'Izvoženo ob' je ISTI casOznaka
// čas zadnjega uspešnega branja (pečat R170) — prejemnik CSV ve TOČNO, kaj in
// KDAJ je bilo prikazano izvozniku.
//
// Načela:
//  • Determinizem: vse oznake so čiste funkcije z izrecnim now (brez skritih
//    ur); ista vhoda (vrstice, opcije) → ista datoteka po bajtih.
//  • Iskrenost: manjkajoče predvidene ure → PRAZEN stolpec (nikoli izmišljenih
//    '0' — "brez podatka" ≠ "nič ur"); pečat brez znane osvežitve → vrstica
//    IZPUŠČENA (nikoli lažne svežine); obseg filtra je VIDNO zapisan.
//  • Fail-closed: neveljaven datum/status/agregat → TypeError (iste stroge
//    funkcije, ki jih uporablja zaslon — pokvarjen vnos ne more tiho pasti).

import { toCsv, type CsvValue } from '@/lib/csv-export'
import { casOznaka } from '@/lib/osvezitev-fokus'
import {
  scheduleTerminiStatusLabel,
  terminCasLabel,
  terminDatumLabel,
  terminUrPovzetek,
  type TerminPrikazVnos,
  type UrAgregat,
} from '@/lib/termini-prikaz'

/** Stolpci izvoza — sredstvo poročanja (urni list, mesečno poročilo),
 *  zato 'Datum' ABSOLUTEN (dd. mm. llll) in poleg njega 'Dan' s prikazno
 *  oznako (Danes/Jutri/pet, 27. 09.) — zaslon in arhiv sta oba resnična. */
const GLAVE = [
  'Datum',
  'Dan',
  'Ura',
  'Projekt',
  'Stranka',
  'Naslov',
  'Lokacija',
  'Ekipa',
  'Monter',
  'Status',
  'Predvidene ure',
] as const

export interface TerminiCsvOpcije {
  /** Agregat ur nad ISTIMI vrsticami, ki so izvožene (klicatelj ga že ima —
   *  urAgregat useMemo na kartici; EN VIR RESNICE za povzetek). */
  urAgregat: UrAgregat
  /** Čas zadnjega uspešnega branja kartice (pečat R170). null → vrstica
   *  'Izvoženo ob' IZPUŠČENA (nikoli izmišljene svežine). */
  osvezitev: Date | null
  /** Referenčni čas za Dan/Jutri oznake (determinizem — brez skritih ur). */
  now: Date
  /** Ali je bil med prikazom aktiven filter 'Samo moje' (iskren zapis obsega). */
  samoMoje: boolean
}

/** Absolutni datum 'dd. mm. llll' (sl-SI) — ISTI Intl klic kot formatDate v
 *  logistics CSV (R139): arhivski stolpec, ki ostane berljiv tudi jutri. */
function absolutniDatum(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    throw new TypeError(`absolutniDatum: neveljaven datum: ${String(iso)}`)
  }
  return d.toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Zgradi celoten CSV (vključno s povzetkom in metapodatki obsega). Čista
 *  funkcija: vhod ostane nespremenjen, isti vhod → isti niz po bajtih. */
export function buildTerminiCsv(
  vrstice: readonly TerminPrikazVnos[],
  opcije: TerminiCsvOpcije
): { csv: string; vrstic: number } {
  if (!Array.isArray(vrstice)) {
    throw new TypeError('buildTerminiCsv: pričakovano polje prikaznih vrstic')
  }
  if (!opcije || typeof opcije !== 'object') {
    throw new TypeError('buildTerminiCsv: pričakovane opcije (TerminiCsvOpcije)')
  }
  if (!(opcije.now instanceof Date) || Number.isNaN(opcije.now.getTime())) {
    throw new TypeError('buildTerminiCsv: pričakovan veljaven now: Date')
  }
  if (opcije.osvezitev !== null && !(opcije.osvezitev instanceof Date)) {
    throw new TypeError('buildTerminiCsv: osvezitev je lahko Date ali null')
  }
  if (typeof opcije.samoMoje !== 'boolean') {
    throw new TypeError('buildTerminiCsv: pričakovan samoMoje: boolean')
  }

  // Fail-closed brezplačno: oznake (absolutniDatum/terminDatumLabel/
  // terminCasLabel/scheduleTerminiStatusLabel) vržejo TypeError na pokvarjen
  // vnos — ista strogost kot na zaslonu (nikoli izmišljenih vrstic v CSV).
  const podatkovne: CsvValue[][] = vrstice.map((v) => [
    absolutniDatum(v.datumZacetka),
    terminDatumLabel(v.datumZacetka, opcije.now),
    terminCasLabel(v.datumZacetka),
    v.projektIme,
    v.strankaIme,
    v.strankaNaslov,
    v.lokacija,
    v.ekipaIme,
    v.monterIme,
    scheduleTerminiStatusLabel(v.status),
    // manjkajoča ura → prazno polje (csvField(null)) — NIKOLI izmišljenih 0
    v.predvideneUre,
  ])

  // Povzetek: ISTI niz kot na kartici (terminUrPovzetek vrže TypeError na
  // neveljaven agregat — pokvarjen agregat ne more postati lažno poročilo).
  const povzetek = terminUrPovzetek(opcije.urAgregat)

  const meta: CsvValue[][] = [
    [], // prazna ločilna vrstica pred povzetkom (preglednost v Excelu)
    ['Filter', opcije.samoMoje ? 'Samo moje termine' : 'Vsi termini'],
    ['Povzetek', povzetek],
  ]
  if (opcije.osvezitev !== null) {
    meta.push(['Izvoženo ob (čas zadnje osvežitve)', casOznaka(opcije.osvezitev)])
  }

  const csv = toCsv([...GLAVE], [...podatkovne, ...meta])
  return { csv, vrstic: podatkovne.length }
}

/** Deterministično ime datoteke: Termini-7-dni_<YYYY-MM-DD>.csv (obseg izvoza
 *  je 7-dnevno okno kartice — ločeno od logističnega 'Termini-<datum>.csv'
 *  (R139, celoten seznam), da se datoteki ne preglasita med seboj). */
export function terminiCsvFilename(isoDatum: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDatum)) {
    throw new TypeError(`terminiCsvFilename: pričakovan ISO datum (YYYY-MM-DD), ne ${String(isoDatum)}`)
  }
  return `Termini-7-dni_${isoDatum}.csv`
}
