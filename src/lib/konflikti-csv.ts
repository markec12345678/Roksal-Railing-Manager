// ---------------------------------------------------------------------------
// R301 (P1, 'izvozi' družina — 31. člen) — TEDENSKI KONFLIKTI CSV iz
// logistike (logistics-tab). CSV BRAT pregledu R300 (vzorec R284→R285/R291/
// R292/R296/R297): izvozi TOČNO tisto resnico, ki jo KONFLIKTNA MINI-VRSTICA
// (30. člen) izreče — dokazane PARE prekrivanj ekipe namesto števca na
// zaslonu. WYSIWYG po konstrukciji.
//
// EN VIR resnice (NIČ dvojnega — vse primitivne izpeljave UVOŽENE):
//  • pregled = tedenskiKonflikti (UVOŽENA iz brata R300 — ISTO okno
//    tedenskiOknoDnevi, ISTA uvožena preverba preveriVozniRedTermin z
//    indeksom krivca, ISTA poli-odprto pravila + aktivni statusi
//    (STRAŽAR-sinhronizirano zrcalo R142), ISTI pari po sortiranem času
//    ASC f(množica), ISTA skupine ASC po ekipi UTF-16);
//  • okno v Obseg vrstici = tedenskiOknoDnevi (UVOŽEN iz tedenski-vozni-
//    red-pdf — ISTA UTC aritmetika danes..danes+6 kot bratje R256/R292/
//    R298/R299/R300);
//  • datum v Obseg vrstici = cenikDatumIso (UVOŽEN — ISTI izpis DD. MM. YYYY
//    kot meta bratje R292/R296/R297);
//  • statusi v celicah = SCHEDULE_TERMINI_STATUS_LABELS (UVOŽENI — ISTI
//    VERBATIM prikazi kot CSV brat R292 'Status' stolpec; par členi so po
//    konstrukciji samo aktivni statusi — Navrteno/V teku/Preloženo);
//  • sklanjatev NI potrebna (pari so konflikti — brez 'terminov' besede v
//    meta; števci so strojne resnice pregleda).
//
// Struktura CSV (ravnina — vsak PAR = ena vrstica dokaza):
//  • podatkovne vrstice (10 stolpcev): Ekipa · Dan prekrivanja (ISO dan
//    ZAČETKA prekrivanja — čez-polnoč par nosi max začetek, resnica
//    brata R300) · za OBA člena para: Projekt · Začetek (UTC) · Konec
//    (UTC) · Status. Časa = VERBATIM ISO niza iz DTO (strojni ISO za
//    revizijo — nič izmišljenega formata, nič pretvorbe pasov; ISTO resnico
//    kot ICS bratje R298/R299 vgrajujejo v DTSTART/DTEND);
//  • meta vrstice po podatkih (kanon R172→R296): prazna ločilna + Obseg
//    (okno — ISTI izpis kot bratje) + Konfliktov (št. parov) + Ekip z
//    konflikti + Pregledanih terminov (resnica obsega pregleda — aktivni,
//    z ekipo, z znanim koncem) + Sklep (ISTO besedilo kot rdeč žig
//    mini-vrstice 30. člena — konfliktiSklep EN VIR za meta + toast) +
//    'Izvoženo ob' (kanonični ISO 8601);
//  • 0 KONFLIKTOV NI VELJAVEN vhod (fail-closed mirror družine R266/R297:
//    'ni prazne datoteke' — zelen žig na zaslonu JE dokaz čistosti, CSV se
//    izvozi ob prvem dokazanem prekrivanju); komponenta pokrije zelen žig
//    IN prazno okno z iskrenim toastom ŠE PRED klicem — lib dvakrat brani:
//    TypeError z razlogom.
//
// Načela (družinska pravila):
//  • Fail-closed: ne-polje / pokvaren vnos (uvožen pregled — indeks krivca
//    VEDNO v sporočilu) / pokvaren now → TypeError (nikoli tiho
//    spregledano); null pregled → TypeError (domain pravilo zgoraj).
//  • Determinizem: `now` pride KOT parameter (jedro ne bere ure — F4;
//    komponenta poda tedenskiRazgledNow = ENA izpeljava časa za pregled +
//    CSV + ime, lekcija R121/R235); vrstice v ISTEM vrstnem redu kot
//    tedenskiKonflikti (skupine ASC UTF-16, pari čas ASC — f(MNOŽICA),
//    premešan odgovor = bajtno ISTI CSV).
//  • Format: BOM + '\n' zaključki + citiranje besedilnih celic (vzorec
//    vodja-csv / R285 / R286 / R291 / R292 / R293 / R295 / R296 / R297 —
//    vsak lib nosi lasten 3-vrstični citiraj).
// ---------------------------------------------------------------------------

import { tedenskiOknoDnevi } from './tedenski-vozni-red-pdf'
import { cenikDatumIso } from './cenik-pdf'
import { SCHEDULE_TERMINI_STATUS_LABELS } from './termini-prikaz'
import {
  tedenskiKonflikti,
  type TedenskiKonfliktPregled,
} from './tedenski-konflikti'
import type { VozniRedTermin } from './logistika-vozni-red-pdf'
import { todayStamp } from './csv-export'

/** Glava tabele (10 stolpcev — ENA vrstica = EN dokazani PAR prekrivanja
 *  iste ekipe; OBA člena para v istem stolpcu-sklopu za Excel filtriranje). */
export const KONFLIKTI_CSV_GLAVA = [
  'Ekipa',
  'Dan prekrivanja',
  'Termin A projekt',
  'Termin A začetek (UTC)',
  'Termin A konec (UTC)',
  'Termin A status',
  'Termin B projekt',
  'Termin B začetek (UTC)',
  'Termin B konec (UTC)',
  'Termin B status',
] as const

/** Citiranje besedilnih polj (narekovaj podvojen) — vzorec vodja-csv/R293. */
function citiraj(v: string): string {
  return `"${v.replace(/"/g, '""')}"`
}

/** Sklepna resnica pregleda (EN VIR za meta vrstico 'Sklep' IN toast
 *  komponente — WYSIWYG; ISTO besedilo kot RDEČ žig mini-vrstice 30. člena
 *  na zaslonu: kondicionalni žig R256 lekcija 4 — zelen žig = 'Konflikti: 0
 *  …', ta sklep je IZKLJUČNO rdeča veja, klicna stran garantira non-null
 *  pregled). Fail-closed: null pregled → TypeError (nikoli izmišljen sklep). */
export function konfliktiSklep(pregled: TedenskiKonfliktPregled): string {
  if (!pregled || typeof pregled !== 'object' || !Array.isArray(pregled.skupine)) {
    throw new TypeError('konfliktiSklep: pričakovan pregled (TedenskiKonfliktPregled — non-null iz tedenskiKonflikti)')
  }
  return `Konflikti: ${pregled.stPrekrivanj} · ekipe: ${pregled.skupine
    .map((s) => s.ekipa)
    .join(', ')} — dvojne rezervacije v okviru (poli-odprto pravilo).`
}

/** Vrstice CSV (brez BOM) — podatkovne + meta (kanon R172→R296). Vrstice v
 *  ISTEM vrstnem redu kot tedenskiKonflikti (EN VIR brata — f(MNOŽICA)).
 *  `now` = okno + žig resnica (F4). */
export function konfliktiCsvVrstice(
  vnosi: readonly VozniRedTermin[],
  now: Date,
): string[] {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('konfliktiCsvVrstice: pričakovan veljaven now: Date')
  }
  if (!Array.isArray(vnosi)) {
    throw new TypeError('konfliktiCsvVrstice: pričakovano polje terminov (VozniRedTermin[])')
  }
  const pregled = tedenskiKonflikti(vnosi, now)
  if (pregled === null) {
    throw new TypeError(
      'konfliktiCsvVrstice: ni dokazanih konfliktov v 7-dnevnem oknu — datoteka se izvozi ob prvem dokazanem prekrivanju (žig na zaslonu je zelen; družina R266/R297: ni prazne datoteke)',
    )
  }
  const vrstice: string[] = [KONFLIKTI_CSV_GLAVA.map(citiraj).join(',')]
  for (const skupina of pregled.skupine) {
    for (const par of skupina.pari) {
      vrstice.push(
        [
          skupina.ekipa,
          par.dan,
          par.a.projekt ?? '—',
          par.a.datumZacetka,
          par.a.datumKonca ?? '—',
          SCHEDULE_TERMINI_STATUS_LABELS[par.a.status],
          par.b.projekt ?? '—',
          par.b.datumZacetka,
          par.b.datumKonca ?? '—',
          SCHEDULE_TERMINI_STATUS_LABELS[par.b.status],
        ]
          .map(citiraj)
          .join(','),
      )
    }
  }
  // --- meta vrstice (kanon R172→R296) ---
  const okno = tedenskiOknoDnevi(now)
  vrstice.push('')
  vrstice.push(
    [
      'Obseg',
      `Okno naslednjih 7 dni: ${cenikDatumIso(okno[0])} – ${cenikDatumIso(okno[6])} (danes + 6 dni, UTC) — vir = ISTI pregled kot žig na zaslonu (tedenskiKonflikti).`,
    ]
      .map(citiraj)
      .join(','),
  )
  vrstice.push(['Konfliktov', String(pregled.stPrekrivanj)].map(citiraj).join(','))
  vrstice.push(['Ekip z konflikti', String(pregled.skupine.length)].map(citiraj).join(','))
  vrstice.push(['Pregledanih terminov', String(pregled.pregledanih)].map(citiraj).join(','))
  vrstice.push(['Sklep', konfliktiSklep(pregled)].map(citiraj).join(','))
  vrstice.push(['Izvoženo ob', now.toISOString()].map(citiraj).join(','))
  return vrstice
}

/** Celoten CSV niz: BOM + vrstice ('\n' zaključki — vzorec R186/R285/R286/R291/R292/R296/R297). */
export function konfliktiCsv(
  vnosi: readonly VozniRedTermin[],
  now: Date,
): { csv: string; vrstic: number } {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('konfliktiCsv: pričakovan veljaven now: Date')
  }
  const lines = konfliktiCsvVrstice(vnosi, now)
  return { csv: '\uFEFF' + lines.join('\n'), vrstic: lines.length }
}

/** Deterministično ime datoteke: Konflikti-YYYY-MM-DD.csv (družinski vzorec
 *  — referenčni datum pride KOT parameter, F4). */
export function konfliktiCsvFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('konfliktiCsvFilename: pričakovan veljaven now: Date')
  }
  return `Konflikti-${todayStamp(now)}.csv`
}
