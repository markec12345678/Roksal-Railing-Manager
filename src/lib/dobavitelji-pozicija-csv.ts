// ---------------------------------------------------------------------------
// R333 (60. člen issue #1 'izvozi' družina) — DOBAVITELJI — POZICIJA CEN CSV
// iz Material pregleda (material-intelligence-tab, podzavihek Cenik). CSV
// brat PDF-ju R264 (dobavitelji-pozicija-pdf) — vzorec R330/R331/R332/R297
// (projekti-termini-csv / ponudbe-spomniki-csv / potekli-opomniki-csv:
// LOČEN lib ki UVAŽA projekcijo PDF brata — EN VIR):
//
// EN VIR resnice (NIČ podvojenih pravil):
//  • vhod = ISTI polji kot PDF brat (ceny × najboljse — ISTI klicatelj
//    MaterialIntelligenceTab, ISTA izpeljava pridobiPozicijo — EN fetch
//    /api/material-prices, FRESH ob kliku, NIČ nove mreže);
//  • preverba + JOIN + min-invarianta + agregat + sort = dobaviteljiPozicijaCen
//    (UVOŽENA iz PDF brata — fail-closed podedovana: prazen seznam cen,
//    pokvaren vnos z indeksom krivca, ponudba brez ujemajoče best vrstice,
//    cena < bestPrice, bestPrice 0 — NIČ podvojenih pravil; ISTA sekvenca
//    kot buildDobaviteljiPozicijaPdfDoc);
//  • vrstni red = ISTI sort EN VIR (IME ASC navadno < + izenačba id ASC —
//    referenčni pregled, NE rangiranje; sortirajDobaviteljePozicija je že
//    zagnana ZNOTRAJ dobaviteljiPozicijaCen — vrstice so v ISTEM redu kot
//    PDF autoTable body);
//  • celice = ISTI izpisi kot PDF body: ime, številke String, odstotekNiz
//    EN VIR (IZVOŽEN iz PDF brata R333 — 1 decimalna + vejica), '—' iskren
//    odpad pri povprečnem odstotku (vse najnižje = NIČ povprečja prazne
//    množice — NIKOLI izmišljen 0 %);
//  • glava = VERBATIM PDF autoTable head (6 stolpcev);
//  • sklep = VERBATIM PDF sklepni niz (ISTI segmenti kot doc.text R264 —
//    brez alternative/najnižjih/višjih/povprečni odstopek/najširši razpon/
//    brez ujemajoče cene + vir) — testi pinajo dobesedne segmente PROTI
//    PDF VIRU (anti-divergenca, vzorec R330/R331/R332).
//
// Format (družina R297/R301/R330/R331/R332): BOM + vrstice z '\n' zaključki,
// BREZ trailing '\n'; meta vrstice kanon R172→R296 (Obseg / KPI peterica ISTI
// izpisi kot PDF kpiBox petket / Sklep / Izvoženo ob). Ime datoteke:
// Pozicija-dobaviteljev-YYYY-MM-DD.csv (bratska simetrija z PDF imenom R264
// — EN now za žig IN ime, lekcija R121/R235).
// ---------------------------------------------------------------------------

import {
  dobaviteljiPozicijaCen,
  odstotekNiz,
  type PozicijaCenaVnos,
  type PozicijaBestVnos,
  type DobaviteljPozicijaVrsta,
  type DobaviteljiPozicijaPovzetek,
} from './dobavitelji-pozicija-pdf'
import { todayStamp } from './csv-export'

/** Glava tabele (6 stolpcev — VERBATIM PDF autoTable head R264). */
export const POZICIJA_DOBAVITELJEV_CSV_GLAVA = [
  'Dobavitelj',
  'Ponudb',
  'Najnižjih',
  'Višjih',
  'Povprečni odstopek (%)',
  'Najširši razpon (%)',
] as const

/** Citiranje besedilnih polj (narekovaj podvojen) — vzorec
 *  oprema-cikel-csv R297 / projekti-termini-csv R330 / ponudbe-spomniki-csv
 *  R331 / potekli-opomniki-csv R332. */
function citiraj(v: string): string {
  return `"${v.replace(/"/g, '""')}"`
}

/** ENA podatkovna vrstica (ISTI celici kot PDF autoTable body R264):
 *  povprečni odstopek '—' pri vseh najnižjih (iskrena prazna množica),
 *  odstotekNiz EN VIR sicer; najširši razpon VEDNO definiran (0 = vse
 *  najnižje — iskrena resnica). */
export function pozicijaDobaviteljevCsvVrstica(v: DobaviteljPozicijaVrsta): string {
  if (!v || typeof v !== 'object') {
    throw new TypeError('pozicijaDobaviteljevCsvVrstica: pričakovana vrsta (DobaviteljPozicijaVrsta)')
  }
  return (
    [
      v.ime,
      String(v.ponudb),
      String(v.najnizjih),
      String(v.visjih),
      v.povprecniOdstotek !== null ? odstotekNiz(v.povprecniOdstotek) : '—',
      odstotekNiz(v.najsirosiRazpon),
    ] as string[]
  )
    .map(citiraj)
    .join(',')
}

/** Sklep (VERBATIM PDF sklepni niz R264 — ISTI segmenti kot doc.text) iz
 *  povzetka EN VIR. Ločena funkcija (vzorec potekliOpomnikiCsvSklep R332 /
 *  ponudbeSpomnikiCsvSklep R331 / projektiTerminiCsvSklep R330): testi jo
 *  pinajo dobesedno PROTI PDF VIRU. */
export function pozicijaDobaviteljevCsvSklep(povzetek: DobaviteljiPozicijaPovzetek): string {
  if (!povzetek || typeof povzetek !== 'object') {
    throw new TypeError('pozicijaDobaviteljevCsvSklep: pričakovan povzetek (DobaviteljiPozicijaPovzetek)')
  }
  return `${povzetek.dobaviteljev} dobaviteljev · ${povzetek.ponudb} veljavnih ponudb za ${povzetek.artiklov} artiklov · brez alternative ${povzetek.brezAlternative} (samo ena ponudba — ni primerjave) · najnižjih pozicij ${povzetek.najnizjihPozicij} · višjih ${povzetek.visjihPozicij} · povprečni odstopek = razlika % čez višje vrstice ('—' = vse najnižje) · najširši razpon = max razlika % čez vse vrstice · brez ujemajoče cene ${povzetek.brezCeneN} (poimenovano) · vir = /api/material-prices.`
}

/** Vrstice CSV (brez BOM) — podatkovne + meta (kanon R172→R296). Vrstice v
 *  ISTEM referenčnem redu kot PDF body (IME ASC + izenačba id ASC — EN VIR
 *  sort znotraj dobaviteljiPozicijaCen, f(MNOŽICA)). Fail-closed podedovana
 *  iz EN VIR: prazen seznam cen / pokvaren vnos / JOIN / min-invarianta /
 *  bestPrice 0 → TypeError z indeksom krivca (NIČ tihe degradacije).
 *  `now` = žig + ime (EN now — lekcija R121/R235; agregat je časovno
 *  nevtralen — pozicije so razmerja cen, NIKOLI dni). */
export function pozicijaDobaviteljevCsvVrstice(
  ceny: readonly PozicijaCenaVnos[],
  najboljse: readonly PozicijaBestVnos[],
  now: Date,
): string[] {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('pozicijaDobaviteljevCsvVrstice: pričakovan veljaven now: Date')
  }
  // Fail-closed preverba + JOIN + agregat + sort = ISTA sekvenca kot PDF
  // brat buildDobaviteljiPozicijaPdfDoc (prazen seznam cen → TypeError
  // 'prazen seznam cen nima pozicij'; pokvaren vnos → TypeError z indeksom
  // krivca — podedovano, NIČ podvojenih pravil).
  if (!Array.isArray(ceny)) {
    throw new TypeError('pozicijaDobaviteljevCsvVrstice: pričakovano polje cen (PozicijaCenaVnos[])')
  }
  if (!Array.isArray(najboljse)) {
    throw new TypeError('pozicijaDobaviteljevCsvVrstice: pričakovano polje najboljših (PozicijaBestVnos[])')
  }
  const { vrste, povzetek } = dobaviteljiPozicijaCen(ceny, najboljse)
  const vrstice: string[] = [POZICIJA_DOBAVITELJEV_CSV_GLAVA.map(citiraj).join(',')]
  for (const v of vrste) {
    vrstice.push(pozicijaDobaviteljevCsvVrstica(v))
  }
  // --- meta vrstice (kanon R172→R296) — števci = KPI peterica ISTI izpisi
  //     kot PDF kpiBox (Dobaviteljev / Ponudb / Brez alternative / Najnižjih
  //     pozicij / Višjih pozicij) ---
  vrstice.push('')
  vrstice.push(
    [
      'Obseg',
      'Vsi dobavitelji z vsaj eno veljavno ponudbo iz /api/material-prices — referenčni pregled po dobavitelju (IME ASC, ne rangiranje)',
    ]
      .map(citiraj)
      .join(','),
  )
  vrstice.push(['Dobaviteljev', String(povzetek.dobaviteljev)].map(citiraj).join(','))
  vrstice.push(['Ponudb', String(povzetek.ponudb)].map(citiraj).join(','))
  vrstice.push(['Brez alternative', String(povzetek.brezAlternative)].map(citiraj).join(','))
  vrstice.push(['Najnižjih pozicij', String(povzetek.najnizjihPozicij)].map(citiraj).join(','))
  vrstice.push(['Višjih pozicij', String(povzetek.visjihPozicij)].map(citiraj).join(','))
  vrstice.push(['Sklep', pozicijaDobaviteljevCsvSklep(povzetek)].map(citiraj).join(','))
  vrstice.push(['Izvoženo ob', now.toISOString()].map(citiraj).join(','))
  return vrstice
}

/** Celoten CSV niz: BOM + vrstice ('\n' zaključki — vzorec R186/R285/R286/
 *  R291/R292/R293/R295/R296/R297/R301/R330/R331/R332). */
export function pozicijaDobaviteljevCsv(
  ceny: readonly PozicijaCenaVnos[],
  najboljse: readonly PozicijaBestVnos[],
  now: Date,
): { csv: string; vrstic: number } {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('pozicijaDobaviteljevCsv: pričakovan veljaven now: Date')
  }
  const lines = pozicijaDobaviteljevCsvVrstice(ceny, najboljse, now)
  return { csv: '\uFEFF' + lines.join('\n'), vrstic: lines.length }
}

/** Deterministično ime datoteke: Pozicija-dobaviteljev-YYYY-MM-DD.csv
 *  (bratska simetrija z PDF imenom R264; referenčni datum pride KOT
 *  parameter, F4). */
export function pozicijaDobaviteljevCsvFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('pozicijaDobaviteljevCsvFilename: pričakovan veljaven now: Date')
  }
  return `Pozicija-dobaviteljev-${todayStamp(now)}.csv`
}
