// ---------------------------------------------------------------------------
// R330 (57. člen issue #1 'izvozi' družina) — PROJEKTI — TERMINI PREGLED CSV
// iz Logistike. CSV brat PDF-ju R265 (projekti-termini-pdf) — vzorec R297
// (oprema-cikel-csv: LOČEN lib, ki UVAŽA projekcijo PDF brata — EN VIR):
//
// EN VIR resnice (NIČ podvojenih pravil):
//  • vhod = ISTA polja kot PDF brat (ProjektiTerminiProjektVnos ×
//    ProjektiTerminiTerminVnos — isti klicatelj logistics-tab);
//  • preverba + JOIN + agregacija + sort = projektiTerminiPregled (UVOŽENA
//    iz PDF brata — fail-closed ×6 skupin podedovana: prazen projekti/
//    termini, 5 znanih statusov, ISO datumi, končne cele ure ≥ 0 ALI null,
//    podvojen projekt id, vsi termini tujci — NIČ tihe degradacije);
//  • vrstice = ISTA preslikava celic kot PDF autoTable body (stranka '—',
//    ure '—' kadar nič ne šteje v vsoto, obdobje prvi → zadnji po
//    cenikDatumIso EN VIR) — WYSIWYG bajtno dokazljivo;
//  • glava = VERBATIM PDF autoTable head (8 stolpcev);
//  • sklep = VERBATIM PDF sklepni niz (ISTI segmenti kot doc.text R265) —
//    testi pinajo dobesedne segmente PROTI PDF VIRU (anti-divergenca).
//
// Format (družina R297/R301): BOM + vrstice z '\n' zaključki, BREZ trailing
// '\n'; meta vrstice kanon R172→R296 (Obseg / števci / Sklep / Izvoženo ob).
// Ime datoteke: Projekti-termini-YYYY-MM-DD.csv (bratska simetrija z PDF
// imenom R265 — EN now za žig IN ime, lekcija R121/R235).
// ---------------------------------------------------------------------------

import {
  projektiTerminiPregled,
  projektBeseda,
  type ProjektTerminiVrsta,
  type ProjektiTerminiPovzetek,
  type ProjektiTerminiProjektVnos,
  type ProjektiTerminiTerminVnos,
} from './projekti-termini-pdf'
import { terminBeseda } from './termini-prikaz'
import { cenikDatumIso } from './cenik-pdf'
import { todayStamp } from './csv-export'

/** Glava tabele (8 stolpcev — VERBATIM PDF autoTable head R265). */
export const PROJEKTI_TERMINI_CSV_GLAVA = [
  'Projekt',
  'Stranka',
  'Terminov',
  'Načrtovano',
  'V teku',
  'Zaključeno',
  'Ur',
  'Obdobje',
] as const

/** Citiranje besedilnih polj (narekovaj podvojen) — vzorec oprema-cikel-csv
 *  R297 / vodja-csv. */
function citiraj(v: string): string {
  return `"${v.replace(/"/g, '""')}"`
}

/** Sklep (VERBATIM PDF sklepni niz R265 — ISTI segmenti kot doc.text) iz
 *  povzetka EN VIR. Ločena funkcija (vzorec konfliktiSklep R301): testi jo
 *  pinajo dobesedno PROTI PDF VIRU. */
export function projektiTerminiCsvSklep(povzetek: ProjektiTerminiPovzetek): string {
  if (!povzetek || typeof povzetek !== 'object') {
    throw new TypeError('projektiTerminiCsvSklep: pričakovan povzetek (ProjektiTerminiPovzetek)')
  }
  return `${povzetek.zTermini} ${projektBeseda(povzetek.zTermini)} z vpisanimi termini od ${povzetek.projektov} · brez termina ${povzetek.brezTermina} (od tega s planirano montažo ${povzetek.planBrezTermina}) · ${povzetek.terminov} ${terminBeseda(povzetek.terminov)} · predvidenih ur ${povzetek.ur} (brez ure ${povzetek.brezUre} — izključene iz vsote) · preklicanih ${povzetek.preklicanih} (ure preklicanih izključene iz vsote) · preloženih ${povzetek.prelozenih} (ure v vsoti) · obdobje = prvi → zadnji vpisani termin · terminov brez ujemajočega projekta ${povzetek.sirotTerminov} (poimenovano) · vir = /api/schedules (vsi termini) × /api/projects.`
}

/** ENA podatkovna vrstica (ISTI celici kot PDF autoTable body R265). */
export function projektiTerminiCsvVrstica(v: ProjektTerminiVrsta): string {
  if (!v || typeof v !== 'object') {
    throw new TypeError('projektiTerminiCsvVrstica: pričakovana vrsta (ProjektTerminiVrsta)')
  }
  return (
    [
      v.naziv,
      v.stranka ?? '—',
      String(v.terminov),
      String(v.nacrtovano),
      String(v.vTeku),
      String(v.zakljuceno),
      v.ure !== null ? String(v.ure) : '—',
      v.prvi === v.zadnji ? cenikDatumIso(v.prvi) : `${cenikDatumIso(v.prvi)} → ${cenikDatumIso(v.zadnji)}`,
    ] as string[]
  )
    .map(citiraj)
    .join(',')
}

/** Vrstice CSV (brez BOM) — podatkovne + meta (kanon R172→R296). Vrstice v
 *  NAZIV ASC referenčnem redu projektiTerminiPregled (EN VIR brata —
 *  f(MNOŽICA), izenačba id ASC). `now` = žig resnica + ime (F4). */
export function projektiTerminiCsvVrstice(
  projekti: readonly ProjektiTerminiProjektVnos[],
  termini: readonly ProjektiTerminiTerminVnos[],
  now: Date,
): string[] {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('projektiTerminiCsvVrstice: pričakovan veljaven now: Date')
  }
  // Fail-closed preverba + JOIN + agregacija + sort = EN VIR PDF brata
  // (prazen projekti/termini, podvojen id, tujci, pokvaren status/ure/ISO →
  // TypeError z indeksom krivca — podedovano, NIČ podvojenih pravil).
  const { vrste, povzetek } = projektiTerminiPregled(projekti, termini)
  const vrstice: string[] = [PROJEKTI_TERMINI_CSV_GLAVA.map(citiraj).join(',')]
  for (const v of vrste) {
    vrstice.push(projektiTerminiCsvVrstica(v))
  }
  // --- meta vrstice (kanon R172→R296) ---
  vrstice.push('')
  vrstice.push(
    [
      'Obseg',
      'Vsi projekti z vsaj enim ujemajočim terminom — presek /api/schedules (vsi termini) × /api/projects (NAZIV ASC referenčni red)',
    ]
      .map(citiraj)
      .join(','),
  )
  vrstice.push(['Projektov', String(povzetek.projektov)].map(citiraj).join(','))
  vrstice.push(['Z termini', String(povzetek.zTermini)].map(citiraj).join(','))
  vrstice.push(['Brez termina', String(povzetek.brezTermina)].map(citiraj).join(','))
  vrstice.push(['Plan. brez termina', String(povzetek.planBrezTermina)].map(citiraj).join(','))
  vrstice.push(['Terminov', String(povzetek.terminov)].map(citiraj).join(','))
  vrstice.push(['Preklicanih', String(povzetek.preklicanih)].map(citiraj).join(','))
  vrstice.push(['Preloženih', String(povzetek.prelozenih)].map(citiraj).join(','))
  vrstice.push(['Brez ure', String(povzetek.brezUre)].map(citiraj).join(','))
  vrstice.push(['Predvidenih ur', String(povzetek.ur)].map(citiraj).join(','))
  vrstice.push(['Sirot terminov', String(povzetek.sirotTerminov)].map(citiraj).join(','))
  vrstice.push(['Sklep', projektiTerminiCsvSklep(povzetek)].map(citiraj).join(','))
  vrstice.push(['Izvoženo ob', now.toISOString()].map(citiraj).join(','))
  return vrstice
}

/** Celoten CSV niz: BOM + vrstice ('\n' zaključki — vzorec R186/R285/R286/
 *  R291/R292/R293/R295/R296/R297/R301). */
export function projektiTerminiCsv(
  projekti: readonly ProjektiTerminiProjektVnos[],
  termini: readonly ProjektiTerminiTerminVnos[],
  now: Date,
): { csv: string; vrstic: number } {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('projektiTerminiCsv: pričakovan veljaven now: Date')
  }
  const lines = projektiTerminiCsvVrstice(projekti, termini, now)
  return { csv: '\uFEFF' + lines.join('\n'), vrstic: lines.length }
}

/** Deterministično ime datoteke: Projekti-termini-YYYY-MM-DD.csv
 *  (bratska simetrija z PDF imenom R265; referenčni datum pride KOT
 *  parameter, F4). */
export function projektiTerminiCsvFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('projektiTerminiCsvFilename: pričakovan veljaven now: Date')
  }
  return `Projekti-termini-${todayStamp(now)}.csv`
}
