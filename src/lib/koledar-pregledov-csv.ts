// ---------------------------------------------------------------------------
// R295 (P1-f, 'izvozi' družina — 25. člen) — KOLEDAR PREGLEDOV CSV iz CRM
// (crm-tab). CSV BRAT PDF R253 (vzorec R284→R285/R291/R292/R293): izvozi
// TOČNO tisto resnico, ki jo KOLEDAR PREGLEDOV PDF izriše — WYSIWYG po
// konstrukciji.
//
// EN VIR resnice (NIČ dvojnega — vse primitivne izpeljave UVOŽENE):
//  • vrstice = sortirajKoledar (UVOŽENA iz PDF brata R253 — ISTI koledarski
//    red: opomnikDatum ASC najbližji prvi, izenačba ime ASC navadno <);
//  • preverba vnosa = preveriKoledarVnos (UVOŽENA — ISTI fail-closed
//    kontrakt: ne-prazno ime/naslov, ISO opomnikDatum, status VERBATIM
//    AKTIVEN|POTEKEL — 'NI' vnos = pokvaren vir, NIKOLI tiho spregledan);
//  • Datum = cenikDatumIso (UVOŽEN iz cenik-pdf — ISTI izpis DD. MM. YYYY
//    kot PDF tabela stolpec 4);
//  • 'Dni do' = koledarDniDo (UVOŽENA — ISTA formula Math.floor(diff /
//    86400000) z now KOT PARAMETROM; negativen = prek — iskren klik
//    resnica, PDF RED bold pariteta);
//  • agregat = koledarPovzetek (UVOŽEN — ISTI trikot kot PDF KPI IN toast).
//
// Struktura CSV (ravnina — PDF autoTable tabela je že ravninska):
//  • podatkovne vrstice: Stranka · Naslov · Telefon · Datum · Status ·
//    'Dni do' · Opis — ISTI 7 stolpcev VERBATIM kot PDF autoTable head;
//    telefon/opis null → '—' (ISTI iskren null prikaz kot PDF);
//  • meta vrstice po podatkih (kanon R172/R291/R292/R293): prazna ločilna +
//    Obseg + Pregledov + 'V tem tednu' + Poteklih + Sklep (VERBATIM PDF
//    sklepni niz) + 'Izvoženo ob' (kanonični ISO 8601 — vzorec
//    R286/R291/R292/R293);
//  • PRAZEN KOLEDAR NI VELJAVEN vhod (fail-closed mirror PDF brata R253:
//    'prazen koledar ne nastaja dokumenta — družina: ni prazne datoteke');
//    komponenta pokrije 0 vpisanih z iskrenim toastom ŠE PRED klicem (ISTI
//    gate kot PDF brat) — lib dvakrat brani: TypeError z razlogom.
//
// Načela (družinska pravila):
//  • Fail-closed: ne-polje vnosi / pokvaren vnos / pokvaren now → TypeError
//    (indeks krivca VEDNO v sporočilu — nikoli tiho spregledano).
//  • Determinizem: `now` pride KOT parameter (jedro ne bere ure — F4);
//    vrstice v ISTEM vrstnem redu kot sortirajKoledar (f(MNOŽICA) — lib NE
//    zaupa vrstnemu redu odgovora, EN VIR sort iz PDF brata).
//  • Format: BOM + '\n' zaključki + citiranje besedilnih celic (vzorec
//    vodja-csv / R285 / R286 / R291 / R292 / R293 — vsak lib nosi lasten
//    3-vrstični citiraj).
// ---------------------------------------------------------------------------

import {
  preveriKoledarVnos,
  sortirajKoledar,
  koledarPovzetek,
  koledarDniDo,
  type KoledarPregledVnos,
} from './koledar-pregledov-pdf'
import { cenikDatumIso } from './cenik-pdf'
import { todayStamp } from './csv-export'

/** Glava tabele (7 stolpcev — VERBATIM PDF autoTable head R253). */
export const KOLEDAR_PREGLEDOV_CSV_GLAVA = [
  'Stranka',
  'Naslov',
  'Telefon',
  'Datum',
  'Status',
  'Dni do',
  'Opis',
] as const

/** Citiranje besedilnih polj (narekovaj podvojen) — vzorec vodja-csv/R293. */
function citiraj(v: string): string {
  return `"${v.replace(/"/g, '""')}"`
}

/** Vrstice CSV (brez BOM) — podatkovne + meta (kanon R172/R291/R292/R293).
 *  Vrstice v koledarskem redu sortirajKoledar (EN VIR brata — najbližji
 *  pregled prvi). `now` = žig + 'Dni do' resnica + ime (F4). */
export function koledarPregledovCsvVrstice(
  vnosi: readonly KoledarPregledVnos[],
  now: Date,
): string[] {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('koledarPregledovCsvVrstice: pričakovan veljaven now: Date')
  }
  if (!Array.isArray(vnosi)) {
    throw new TypeError('koledarPregledovCsvVrstice: pričakovano polje vnosa (KoledarPregledVnos[])')
  }
  if (vnosi.length === 0) {
    throw new TypeError(
      'koledarPregledovCsvVrstice: prazen koledar ne nastaja datoteke (družina R253: ni prazne datoteke — komponenta pokaže iskren toast)',
    )
  }
  const sortirane = sortirajKoledar(vnosi)
  sortirane.forEach((p, i) => preveriKoledarVnos(p, i))
  const pov = koledarPovzetek(vnosi)
  const vrstice: string[] = [KOLEDAR_PREGLEDOV_CSV_GLAVA.map(citiraj).join(',')]
  for (const p of sortirane) {
    vrstice.push(
      [
        p.ime.trim(),
        p.naslov.trim(),
        p.telefon ?? '—',
        cenikDatumIso(p.opomnikDatum),
        p.opomnikStatus,
        String(koledarDniDo(p, now)),
        p.opomnikOpis ?? '—',
      ]
        .map(citiraj)
        .join(','),
    )
  }
  // --- meta vrstice (kanon R172/R291/R292/R293) ---
  vrstice.push('')
  vrstice.push(
    [
      'Obseg',
      'Vse stranke z vpisanim datumom pregleda (AKTIVEN + POTEKEL) — koledarski red',
    ]
      .map(citiraj)
      .join(','),
  )
  vrstice.push(['Pregledov', String(pov.preglediN)].map(citiraj).join(','))
  vrstice.push(['V tem tednu', String(pov.vTemTednu)].map(citiraj).join(','))
  vrstice.push(['Poteklih', String(pov.poteklih)].map(citiraj).join(','))
  vrstice.push(
    [
      'Sklep',
      `${pov.preglediN} vpisanih pregledov · ${pov.vTemTednu} v tem tednu (do 7 dni) · ${pov.poteklih} poteklih · koledarski red (najbližji pregled prvi) · vir = opomnikStatus iz CRM.`,
    ]
      .map(citiraj)
      .join(','),
  )
  vrstice.push(['Izvoženo ob', now.toISOString()].map(citiraj).join(','))
  return vrstice
}

/** Celoten CSV niz: BOM + vrstice ('\n' zaključki — vzorec R186/R285/R286/R291/R292/R293). */
export function koledarPregledovCsv(
  vnosi: readonly KoledarPregledVnos[],
  now: Date,
): { csv: string; vrstic: number } {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('koledarPregledovCsv: pričakovan veljaven now: Date')
  }
  const lines = koledarPregledovCsvVrstice(vnosi, now)
  return { csv: '\uFEFF' + lines.join('\n'), vrstic: lines.length }
}

/** Deterministično ime datoteke: Koledar-pregledov-YYYY-MM-DD.csv
 *  (družinski vzorec — referenčni datum pride KOT parameter, F4; brat PDF
 *  imena R253). */
export function koledarPregledovCsvFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('koledarPregledovCsvFilename: pričakovan veljaven now: Date')
  }
  return `Koledar-pregledov-${todayStamp(now)}.csv`
}
