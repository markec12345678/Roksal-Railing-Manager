// ---------------------------------------------------------------------------
// R297 (P2, 'izvozi' družina — 27. člen) — OPREMA CIKEL CSV iz logistike
// (logistics-tab). CSV BRAT PDF R266 (vzorec R284→R285/R291/R292/R293/R295/
// R296): izvozi TOČNO tisto resnico, ki jo OPREMA — ŽIVLJENJSKI CIKL PDF
// izriše — WYSIWYG po konstrukciji.
//
// EN VIR resnice (NIČ dvojnega — vse primitivne izpeljave UVOŽENE):
//  • vrstice + preverba + sort + agregat = opremaCikelPregled (UVOŽENA iz
//    PDF brata R266 — ISTA fail-verbose preverba z indeksom krivca, ISTA
//    podvojen-id obramba, ISTI NAZIV ASC referenčni red f(MNOŽICA), ISTI
//    povzetek kot KPI/sklep/mini-vrstica/toast);
//  • Datum = cenikDatumIso (UVOŽEN iz cenik-pdf — ISTI izpis DD. MM. YYYY
//    kot PDF tabela stolpca 5/6/7);
//  • kosov beseda = kosBeseda (UVOŽENA — ISTA beseda kot PDF KPI/sklep).
//
// Struktura CSV (ravnina — PDF autoTable tabela je že ravninska):
//  • podatkovne vrstice: Oprema · Tip · Status · Lokacija · Zadnji pregled ·
//    Naslednji pregled · Kalibracija · Rezervacije — ISTI 8 stolpcev
//    VERBATIM kot PDF autoTable head; celice = ISTI iskreni prikazi kot PDF
//    ('—' odpad, 'ni zabeležen' nezabeležen, kalibracija 4 veje: 'ne zahteva'
//    / 'potečena DD. MM. YYYY' / 'do DD. MM. YYYY · potrdilo' / 'manjka rok');
//  • meta vrstice po podatkih (kanon R172→R296): prazna ločilna + Obseg +
//    KPI števci + Sklep (VERBATIM PDF sklepni niz) + 'Izvoženo ob'
//    (kanonični ISO 8601);
//  • PRAZEN SEZNAM NI VELJAVEN vhod (fail-closed mirror PDF brata R266:
//    'prazen seznam ne nastaja dokumenta'); komponenta pokrije 0 kosov z
//    iskrenim toastom ŠE PRED klicem (ISTI gate kot PDF brat) — lib dvakrat
//    brani: TypeError z razlogom.
//
// Načela (družinska pravila):
//  • Fail-closed: ne-polje / pokvaren now → TypeError (indeks krivca VEDNO v
//    sporočilu — nikoli tiho spregledano); per-vnos preverba = EN VIR
//    opremaCikelPregled (tudi podvojen id).
//  • Determinizem: `now` pride KOT parameter (jedro ne bere ure — F4);
//    vrstice v ISTEM vrstnem redu kot opremaCikelPregled (NAZIV ASC,
//    izenačba id ASC — f(MNOŽICA), nikoli vrstni red odgovora).
//  • Format: BOM + '\n' zaključki + citiranje besedilnih celic (vzorec
//    vodja-csv / R285 / R286 / R291 / R292 / R293 / R295 / R296 — vsak lib
//    nosi lasten 3-vrstični citiraj).
// ---------------------------------------------------------------------------

import {
  opremaCikelPregled,
  kosBeseda,
  type OpremaCikelVnos,
} from './oprema-cikel-pdf'
import { cenikDatumIso } from './cenik-pdf'
import { todayStamp } from './csv-export'

/** Glava tabele (8 stolpcev — VERBATIM PDF autoTable head R266). */
export const OPREMA_CIKEL_CSV_GLAVA = [
  'Oprema',
  'Tip',
  'Status',
  'Lokacija',
  'Zadnji pregled',
  'Naslednji pregled',
  'Kalibracija',
  'Rezervacije',
] as const

/** Citiranje besedilnih polj (narekovaj podvojen) — vzorec vodja-csv/R293. */
function citiraj(v: string): string {
  return `"${v.replace(/"/g, '""')}"`
}

/** Vrstice CSV (brez BOM) — podatkovne + meta (kanon R172→R296). Vrstice v
 *  NAZIV ASC referenčnem redu opremaCikelPregled (EN VIR brata — f(MNOŽICA)).
 *  `now` = žig resnica + ime (F4). */
export function opremaCikelCsvVrstice(
  oprema: readonly OpremaCikelVnos[],
  now: Date,
): string[] {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('opremaCikelCsvVrstice: pričakovan veljaven now: Date')
  }
  if (!Array.isArray(oprema)) {
    throw new TypeError('opremaCikelCsvVrstice: pričakovano polje opreme (OpremaCikelVnos[])')
  }
  if (oprema.length === 0) {
    throw new TypeError(
      'opremaCikelCsvVrstice: prazen seznam opreme ne nastaja datoteke (družina R266: ni prazne datoteke — komponenta pokaže iskren toast)',
    )
  }
  const { vrste, povzetek } = opremaCikelPregled(oprema)
  const vrstice: string[] = [OPREMA_CIKEL_CSV_GLAVA.map(citiraj).join(',')]
  for (const v of vrste) {
    vrstice.push(
      [
        v.naziv,
        v.tip,
        v.status,
        v.lokacija ?? '—',
        v.zadnjiPregled !== null
          ? cenikDatumIso(v.zadnjiPregled)
          : v.pregledNezabelezen
            ? 'ni zabeležen'
            : '—',
        v.naslednjiPregled !== null ? cenikDatumIso(v.naslednjiPregled) : '—',
        // Kalibracija — 4 iskrene veje (R145 deterministika — VERBATIM PDF
        // celica): potečena (RED, akcija) / manjka rok (AMBER) / 'do …' (+
        // potrdilo, čist podatek) / 'ne zahteva' (nemerska — NI alarm).
        v.kalNeZahteva
          ? 'ne zahteva'
          : v.kalPotecena
            ? `potečena ${cenikDatumIso(v.kalRok!)}`
            : v.kalRok !== null
              ? `do ${cenikDatumIso(v.kalRok)}${v.kalPotrdilo !== null ? ` · ${v.kalPotrdilo}` : ''}`
              : 'manjka rok',
        String(v.rezervacije),
      ]
        .map(citiraj)
        .join(','),
    )
  }
  // --- meta vrstice (kanon R172→R296) ---
  vrstice.push('')
  vrstice.push(
    [
      'Obseg',
      'Vsa oprema iz /api/equipment (polna resnica — tudi upokojena/izgubljena; NAZIV ASC referenčni red)',
    ]
      .map(citiraj)
      .join(','),
  )
  vrstice.push(['Kosov', String(povzetek.oprem)].map(citiraj).join(','))
  vrstice.push(['Pregled zapadel', String(povzetek.pregledZapadel)].map(citiraj).join(','))
  vrstice.push(['Pregled nezabeležen', String(povzetek.pregledNezabelezen)].map(citiraj).join(','))
  vrstice.push(['Kalibracija potečena', String(povzetek.kalPotecena)].map(citiraj).join(','))
  vrstice.push(['Manjka kal. rok', String(povzetek.kalManjkaRok)].map(citiraj).join(','))
  vrstice.push(
    [
      'Sklep',
      `${povzetek.oprem} ${kosBeseda(povzetek.oprem)} · merskih ${povzetek.merskih} (kalibracija pogoj) · zapadel pregled ${povzetek.pregledZapadel} (akcija) · nezabeležen ${povzetek.pregledNezabelezen} (iskreno neznano — interval brez zapisa) · kalibracija potečena ${povzetek.kalPotecena} (akcija) · manjka kal. rok ${povzetek.kalManjkaRok} · brez vpisane lokacije ${povzetek.brezLokacije} (poimenovano) · rezervacij ${povzetek.rezervacij} · statusi: na voljo ${povzetek.naVoljo} / v uporabi ${povzetek.vUporabi} / v servisu ${povzetek.vServisu} / izgubljeno ${povzetek.izgubljeno} / upokojeno ${povzetek.upokojeno} (referenčni pregled — VSA oprema) · vir = /api/equipment (polna resnica, paginacija do 10.000 kosov).`,
    ]
      .map(citiraj)
      .join(','),
  )
  vrstice.push(['Izvoženo ob', now.toISOString()].map(citiraj).join(','))
  return vrstice
}

/** Celoten CSV niz: BOM + vrstice ('\n' zaključki — vzorec R186/R285/R286/R291/R292/R293/R295/R296). */
export function opremaCikelCsv(
  oprema: readonly OpremaCikelVnos[],
  now: Date,
): { csv: string; vrstic: number } {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('opremaCikelCsv: pričakovan veljaven now: Date')
  }
  const lines = opremaCikelCsvVrstice(oprema, now)
  return { csv: '\uFEFF' + lines.join('\n'), vrstic: lines.length }
}

/** Deterministično ime datoteke: Oprema-cikel-YYYY-MM-DD.csv
 *  (družinski vzorec — referenčni datum pride KOT parameter, F4; brat PDF
 *  imena R266). */
export function opremaCikelCsvFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('opremaCikelCsvFilename: pričakovan veljaven now: Date')
  }
  return `Oprema-cikel-${todayStamp(now)}.csv`
}
