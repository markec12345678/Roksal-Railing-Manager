// ---------------------------------------------------------------------------
// R331 (58. člen issue #1 'izvozi' družina) — PONUDBE — SPOMNIŠKI PREGLED CSV
// iz CRM taba (kartica Ponudbe — sledenje, quote-followup.tsx). CSV brat
// PDF-ju R267 (ponudbe-spomniki-pdf) — vzorec R330/R297 (projekti-termini-csv
// / oprema-cikel-csv: LOČEN lib ki UVAŽA projekcijo PDF brata — EN VIR):
//
// EN VIR resnice (NIČ podvojenih pravil):
//  • vhod = ISTO polje kot PDF brat (PonudbaSpomnikiVnos — isti klicatelj
//    quote-followup, FRESH fetch /api/projects ob kliku);
//  • preverba + projekcija + akcijski sort + povzetek = ponudbeSpomnikiPregled
//    (UVOŽENA iz PDF brata — fail-closed podedovana: prazen seznam, 4 znanih
//    statusov, dealLocked boolean, ISO nizi ALI null, podvojen id — NIČ tihe
//    degradacije);
//  • vrstice = ISTA preslikava celic kot PDF autoTable body (status = label
//    R161, spomnik/montaža po cenikDatumIso EN VIR, '—' iskren odpad,
//    podpisano 'podpisano'/'odprto');
//  • glava = VERBATIM PDF autoTable head (8 stolpcev);
//  • sklep = VERBATIM PDF sklepu (ISTI segmenti kot doc.text R267 —
//    stanjeSklep oznake + statusi R161) — testi pinajo dobesedne segmente
//    PROTI PDF VIRU (anti-divergenca, vzorec R330).
//
// RAZLIKA OD R161 IZVOZA (iskrena ločnica — obe poimenovani): R161
// 'Izvozi CSV' = prikazani seznam (state, prvih 12 odprtih); TA izvoz =
// POLNA resnica vloge (FRESH fetch, VSE ponudbe — tudi podpisane; akcijski
// red po sortirajPonudbeSpomniki) — ISTA resnica kot PDF brat.
//
// Format (družina R297/R301/R330): BOM + vrstice z '\n' zaključki, BREZ
// trailing '\n'; meta vrstice kanon R172→R296 (Obseg / števci / Sklep /
// Izvoženo ob). Ime datoteke: Ponudbe-spomniki-YYYY-MM-DD.csv (bratska
// simetrija z PDF imenom R267 — EN now za žig IN ime, lekcija R121/R235).
// ---------------------------------------------------------------------------

import {
  ponudbeSpomnikiPregled,
  type PonudbaSpomnikiVrsta,
  type PonudbaSpomnikiPovzetek,
  type PonudbaSpomnikiVnos,
} from './ponudbe-spomniki-pdf'
import { PONUDBE_STATUS_LABELS, ponudbeLabel } from './ponudbe-csv'
import { cenikDatumIso } from './cenik-pdf'
import { todayStamp } from './csv-export'

/** Glava tabele (8 stolpcev — VERBATIM PDF autoTable head R267). */
export const PONUDBE_SPOMNIKI_CSV_GLAVA = [
  'Projekt',
  'Stranka',
  'Status',
  'Spomnik',
  'Stanje',
  'Opomba',
  'Montaža',
  'Podpis',
] as const

/** Citiranje besedilnih polj (narekovaj podvojen) — vzorec
 *  oprema-cikel-csv R297 / projekti-termini-csv R330. */
function citiraj(v: string): string {
  return `"${v.replace(/"/g, '""')}"`
}

/** Stanje oznake za sklep (VERBATIM stanjeSklep R267 — privatna kopija z
 *  ANTI-DIVERGENCO testi pinano proti PDF viru; NIKOLI tiho sprememba). */
function stanjeSklep(stanje: string): string {
  switch (stanje) {
    case 'Zapadel':
      return 'Zapadel spomnik (akcija)'
    case 'Danes':
      return 'spomnik danes (akcija)'
    case 'Kmalu':
      return 'kmalu (1–3 dni)'
    case 'Planirano':
      return 'planirano'
    case 'Brez spomnika':
      return 'brez spomnika (iskren odpad — akcija)'
    default:
      throw new TypeError(`stanjeSklep: neznano stanje spomnika, ne ${String(stanje)}`)
  }
}

/** ENA podatkovna vrstica (ISTI celici kot PDF autoTable body R267). */
export function ponudbeSpomnikiCsvVrstica(v: PonudbaSpomnikiVrsta): string {
  if (!v || typeof v !== 'object') {
    throw new TypeError('ponudbeSpomnikiCsvVrstica: pričakovana vrsta (PonudbaSpomnikiVrsta)')
  }
  return (
    [
      v.naziv,
      v.stranka ?? '—',
      v.status,
      v.spomnik !== null ? cenikDatumIso(v.spomnik) : '—',
      v.stanje,
      v.opomba ?? '—',
      v.montaza !== null ? cenikDatumIso(v.montaza) : '—',
      v.podpisano ? 'podpisano' : 'odprto',
    ] as string[]
  )
    .map(citiraj)
    .join(',')
}

/** Sklep (VERBATIM PDF sklepni niz R267 — ISTI segmenti kot doc.text) iz
 *  vrst + povzetka EN VIR. Ločena funkcija (vzorec konfliktiSklep R301 /
 *  projektiTerminiCsvSklep R330): testi jo pinajo dobesedno PROTI PDF VIRU. */
export function ponudbeSpomnikiCsvSklep(
  vrste: readonly PonudbaSpomnikiVrsta[],
  povzetek: PonudbaSpomnikiPovzetek,
): string {
  if (!Array.isArray(vrste)) {
    throw new TypeError('ponudbeSpomnikiCsvSklep: pričakovano polje vrst (PonudbaSpomnikiVrsta[])')
  }
  if (!povzetek || typeof povzetek !== 'object') {
    throw new TypeError('ponudbeSpomnikiCsvSklep: pričakovan povzetek (PonudbaSpomnikiPovzetek)')
  }
  const stanjaSklep = ['Zapadel', 'Danes', 'Kmalu', 'Planirano', 'Brez spomnika']
    .map((s) => `${stanjeSklep(s)} ${vrste.filter((v) => !v.podpisano && v.stanje === s).length}`)
    .join(' · ')
  return `${povzetek.ponudb} ${ponudbeLabel(povzetek.ponudb)} · odprtih ${povzetek.odprtih} (akcijska cona) · podpisanih ${povzetek.podpisanih} (zgodovinska cona) · odprte: ${stanjaSklep} · statusi: ${PONUDBE_STATUS_LABELS.NACRTOVANO} ${povzetek.nacrtovanih} / ${PONUDBE_STATUS_LABELS.V_TEKU} ${povzetek.vTeku} / ${PONUDBE_STATUS_LABELS.ZAKLJUCENO} ${povzetek.zakljucenih} / ${PONUDBE_STATUS_LABELS.USTAVLJENO} ${povzetek.ustavljenih} (referenčni pregled — VSE ponudbe, tudi podpisane) · vir = /api/projects (resnica vloge — polna resnica, ne samo viden seznam).`
}

/** Vrstice CSV (brez BOM) — podatkovne + meta (kanon R172→R296). Vrstice v
 *  akcijskem redu ponudbeSpomnikiPregled (EN VIR brata — f(MNOŽICA)):
 *  odprte najstarejši spomnik prvi, podpisane zgodovina na dnu. `now` =
 *  DANES resnica (stanja spomnika) + žig + ime (F4). */
export function ponudbeSpomnikiCsvVrstice(
  ponudbe: readonly PonudbaSpomnikiVnos[],
  now: Date,
): string[] {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('ponudbeSpomnikiCsvVrstice: pričakovan veljaven now: Date')
  }
  // Fail-closed preverba + projekcija + sort + povzetek = EN VIR PDF brata
  // (prazen seznam, pokvaren status/dealLocked/ISO, podvojen id → TypeError
  // z indeksom krivca — podedovano, NIČ podvojenih pravil).
  const { vrste, povzetek } = ponudbeSpomnikiPregled(ponudbe, now)
  const vrstice: string[] = [PONUDBE_SPOMNIKI_CSV_GLAVA.map(citiraj).join(',')]
  for (const v of vrste) {
    vrstice.push(ponudbeSpomnikiCsvVrstica(v))
  }
  // --- meta vrstice (kanon R172→R296) ---
  vrstice.push('')
  vrstice.push(
    [
      'Obseg',
      'Vse ponudbe iz /api/projects — polna resnica, tudi podpisane (akcijski red: odprte najstarejši spomnik prvi — podpisane zgodovina na dnu)',
    ]
      .map(citiraj)
      .join(','),
  )
  vrstice.push(['Ponudb', String(povzetek.ponudb)].map(citiraj).join(','))
  vrstice.push(['Odprtih', String(povzetek.odprtih)].map(citiraj).join(','))
  vrstice.push(['Podpisanih', String(povzetek.podpisanih)].map(citiraj).join(','))
  vrstice.push(['Zapadel spomnik (odprte)', String(povzetek.zapadelOprtih)].map(citiraj).join(','))
  vrstice.push(['Spomnik danes (odprte)', String(povzetek.danesOprtih)].map(citiraj).join(','))
  vrstice.push(['Kmalu 1–3 dni (odprte)', String(povzetek.kmaluOprtih)].map(citiraj).join(','))
  vrstice.push(['Odprtih brez spomnika', String(povzetek.brezSpomnikaOprtih)].map(citiraj).join(','))
  vrstice.push(['Načrtovano', String(povzetek.nacrtovanih)].map(citiraj).join(','))
  vrstice.push(['V teku', String(povzetek.vTeku)].map(citiraj).join(','))
  vrstice.push(['Zaključeno', String(povzetek.zakljucenih)].map(citiraj).join(','))
  vrstice.push(['Ustavljeno', String(povzetek.ustavljenih)].map(citiraj).join(','))
  vrstice.push(['Sklep', ponudbeSpomnikiCsvSklep(vrste, povzetek)].map(citiraj).join(','))
  vrstice.push(['Izvoženo ob', now.toISOString()].map(citiraj).join(','))
  return vrstice
}

/** Celoten CSV niz: BOM + vrstice ('\n' zaključki — vzorec R186/R285/R286/
 *  R291/R292/R293/R295/R296/R297/R301/R330). */
export function ponudbeSpomnikiCsv(
  ponudbe: readonly PonudbaSpomnikiVnos[],
  now: Date,
): { csv: string; vrstic: number } {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('ponudbeSpomnikiCsv: pričakovan veljaven now: Date')
  }
  const lines = ponudbeSpomnikiCsvVrstice(ponudbe, now)
  return { csv: '\uFEFF' + lines.join('\n'), vrstic: lines.length }
}

/** Deterministično ime datoteke: Ponudbe-spomniki-YYYY-MM-DD.csv
 *  (bratska simetrija z PDF imenom R267; referenčni datum pride KOT
 *  parameter, F4). */
export function ponudbeSpomnikiCsvFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('ponudbeSpomnikiCsvFilename: pričakovan veljaven now: Date')
  }
  return `Ponudbe-spomniki-${todayStamp(now)}.csv`
}
