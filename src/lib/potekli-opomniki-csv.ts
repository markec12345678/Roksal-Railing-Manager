// ---------------------------------------------------------------------------
// R332 (59. člen issue #1 'izvozi' družina) — POTEKLI OPOMNIKI CSV iz CRM
// taba. CSV brat PDF-ju R252 (potekli-opomniki-pdf) — vzorec R330/R331/R297
// (projekti-termini-csv / ponudbe-spomniki-csv: LOČEN lib ki UVAŽA projekcijo
// PDF brata — EN VIR):
//
// EN VIR resnice (NIČ podvojenih pravil):
//  • vhod = ISTO polje kot PDF brat (PotekelOpomnikVnos — ISTI klicatelj
//    CrmTab, ISTI izbor customers.filter(opomnikStatus === 'POTEKEL'));
//  • preverba + akcijski sort + agregat = preveriPotekliVnos + sortirajPotekle
//    + potekliPovzetek (UVOŽENI iz PDF brata — fail-closed podedovana: prazen
//    seznam, pokvaren vnos z indeksom krivca, POTEKEL pravica — NIČ tihe
//    degradacije; ISTA sekvenca kot buildPotekliOpomnikiPdfDoc);
//  • vrstice = ISTA preslikava celic kot PDF autoTable body (ime/naslov trim,
//    telefon '—' iskren odpad, opomnik po cenikDatumIso EN VIR, dni prek po
//    potekelDniPrek EN VIR — ≥ 1 monotona, opis '—' iskren odpad);
//  • glava = VERBATIM PDF autoTable head (6 stolpcev);
//  • sklep = VERBATIM PDF sklepni niz (ISTI segmenti kot doc.text R252 —
//    poteklih/najstarejši/povprečno + akcijski red + vir) — testi pinajo
//    dobesedne segmente PROTI PDF VIRU (anti-divergenca, vzorec R330/R331).
//
// Format (družina R297/R301/R330/R331): BOM + vrstice z '\n' zaključki, BREZ
// trailing '\n'; meta vrstice kanon R172→R296 (Obseg / KPI trio ISTI izpisi /
// Sklep / Izvoženo ob). Ime datoteke: Potekli-opomniki-YYYY-MM-DD.csv
// (bratska simetrija z PDF imenom R252 — EN now za žig IN ime, lekcija
// R121/R235).
// ---------------------------------------------------------------------------

import {
  preveriPotekliVnos,
  sortirajPotekle,
  potekliPovzetek,
  potekelDniPrek,
  type PotekelOpomnikVnos,
  type PotekliPovzetek,
} from './potekli-opomniki-pdf'
import { cenikDatumIso } from './cenik-pdf'
import { todayStamp } from './csv-export'

/** Glava tabele (6 stolpcev — VERBATIM PDF autoTable head R252). */
export const POTEKLI_OPOMNIKI_CSV_GLAVA = [
  'Stranka',
  'Naslov',
  'Telefon',
  'Opomnik',
  'Dni prek',
  'Opis',
] as const

/** Citiranje besedilnih polj (narekovaj podvojen) — vzorec
 *  oprema-cikel-csv R297 / projekti-termini-csv R330 / ponudbe-spomniki-csv
 *  R331. */
function citiraj(v: string): string {
  return `"${v.replace(/"/g, '""')}"`
}

/** ENA podatkovna vrstica (ISTI celici kot PDF autoTable body R252). `now` =
 *  DNI resnica (potekelDniPrek EN VIR — monotona: klik je kasneje od fetch-a,
 *  za POTEKEL vnos NIKOLI 'prek 0 dni'). */
export function potekliOpomnikiCsvVrstica(p: PotekelOpomnikVnos, now: Date): string {
  if (!p || typeof p !== 'object') {
    throw new TypeError('potekliOpomnikiCsvVrstica: pričakovan vnos (PotekelOpomnikVnos)')
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('potekliOpomnikiCsvVrstica: pričakovan veljaven now: Date')
  }
  return (
    [
      p.ime.trim(),
      p.naslov.trim(),
      p.telefon ?? '—',
      cenikDatumIso(p.opomnikDatum),
      String(potekelDniPrek(p, now)),
      p.opomnikOpis ?? '—',
    ] as string[]
  )
    .map(citiraj)
    .join(',')
}

/** Sklep (VERBATIM PDF sklepni niz R252 — ISTI segmenti kot doc.text) iz
 *  povzetka EN VIR. Ločena funkcija (vzorec ponudbeSpomnikiCsvSklep R331 /
 *  projektiTerminiCsvSklep R330): testi jo pinajo dobesedno PROTI PDF VIRU. */
export function potekliOpomnikiCsvSklep(povzetek: PotekliPovzetek): string {
  if (!povzetek || typeof povzetek !== 'object') {
    throw new TypeError('potekliOpomnikiCsvSklep: pričakovan povzetek (PotekliPovzetek)')
  }
  return `${povzetek.potekliN} poteklih opomnikov · najstarejši ${povzetek.najstarejsi} dni prek · povprečno ${povzetek.povprecjeNiz} dni prek · akcijski seznam za pisarno (najstarejši prvi) · vir = opomnikStatus iz CRM.`
}

/** Vrstice CSV (brez BOM) — podatkovne + meta (kanon R172→R296). Vrstice v
 *  akcijskem redu sortirajPotekle (EN VIR brata — f(MNOŽICA)): najstarejši
 *  opomnik prvi, izenačba ime ASC. `now` = DNI resnica + žig + ime (F4). */
export function potekliOpomnikiCsvVrstice(
  vnosi: readonly PotekelOpomnikVnos[],
  now: Date,
): string[] {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('potekliOpomnikiCsvVrstice: pričakovan veljaven now: Date')
  }
  // Fail-closed preverba + akcijski sort + agregat = ISTA sekvenca kot PDF
  // brat buildPotekliOpomnikiPdfDoc (prazen seznam → potekliPovzetek TypeError
  // 'prazen seznam nima najstarejšega opomnika'; pokvaren vnos → TypeError z
  // indeksom krivca — podedovano, NIČ podvojenih pravil).
  if (!Array.isArray(vnosi)) {
    throw new TypeError('potekliOpomnikiCsvVrstice: pričakovano polje poteklih (PotekelOpomnikVnos[])')
  }
  vnosi.forEach((p, i) => preveriPotekliVnos(p, i))
  const sortirane = sortirajPotekle(vnosi)
  const pov = potekliPovzetek(sortirane, now)
  const vrstice: string[] = [POTEKLI_OPOMNIKI_CSV_GLAVA.map(citiraj).join(',')]
  for (const p of sortirane) {
    vrstice.push(potekliOpomnikiCsvVrstica(p, now))
  }
  // --- meta vrstice (kanon R172→R296) — števci = KPI trio ISTI izpisi ---
  vrstice.push('')
  vrstice.push(
    [
      'Obseg',
      'Vse stranke s poteklim opomnikom iz /api/crm — akcijski red: najstarejši prvi (koga kontaktirati prej)',
    ]
      .map(citiraj)
      .join(','),
  )
  vrstice.push(['Poteklih', String(pov.potekliN)].map(citiraj).join(','))
  vrstice.push(['Najstarejši (dni)', String(pov.najstarejsi)].map(citiraj).join(','))
  vrstice.push(['Povprečno (dni)', pov.povprecjeNiz].map(citiraj).join(','))
  vrstice.push(['Sklep', potekliOpomnikiCsvSklep(pov)].map(citiraj).join(','))
  vrstice.push(['Izvoženo ob', now.toISOString()].map(citiraj).join(','))
  return vrstice
}

/** Celoten CSV niz: BOM + vrstice ('\n' zaključki — vzorec R186/R285/R286/
 *  R291/R292/R293/R295/R296/R297/R301/R330/R331). */
export function potekliOpomnikiCsv(
  vnosi: readonly PotekelOpomnikVnos[],
  now: Date,
): { csv: string; vrstic: number } {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('potekliOpomnikiCsv: pričakovan veljaven now: Date')
  }
  const lines = potekliOpomnikiCsvVrstice(vnosi, now)
  return { csv: '\uFEFF' + lines.join('\n'), vrstic: lines.length }
}

/** Deterministično ime datoteke: Potekli-opomniki-YYYY-MM-DD.csv
 *  (bratska simetrija z PDF imenom R252; referenčni datum pride KOT
 *  parameter, F4). */
export function potekliOpomnikiCsvFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('potekliOpomnikiCsvFilename: pričakovan veljaven now: Date')
  }
  return `Potekli-opomniki-${todayStamp(now)}.csv`
}
