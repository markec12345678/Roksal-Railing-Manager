// ---------------------------------------------------------------------------
// R304 (P1, 'izvozi' družina — 34. člen) — VODJA TEDENSKI CSV PO EKIPAH iz
// logistike (logistics-tab). CSV BRAT PDF po ekipah R303 (vzorec bratstva
// R301→R302: pregled → CSV dokaz → PDF tisk; tu PDF R303 → CSV R304): ISTA
// koledarska resnica, ampak ENA VRSTICA NA TERMIN z Ekipa STOLPCEM namesto
// PDF sekcij — vodja filtrira/razvršča po ekipi v Excelu (Ekipe PDF = tisk
// na en pogled, Ekipe CSV = strojna resnica za obdelavo). WYSIWYG po
// konstrukciji.
//
// EN VIR resnice (NIČ dvojnega — vse primitivne izpeljave UVOŽENE):
//  • pregled = tedenskiEkipaPregled (UVOŽENA iz brata R303 — ISTO okno
//    tedenskiOknoDnevi, ISTI ekipa seznam tedenskiEkipaImena R299 [UNIQUE,
//    ASC UTF-16, null izključeni], ISTA uvožena preverba preveriVozniRedTermin
//    z indeksom krivca, ISTI sort sortirajVozniRed [čas ASC, izenačba
//    projekt ASC, null ZADNJI], ISTA particija okna z iskrenim brez-ekipe
//    števcem);
//  • sklep = tedenskiEkipaPdfSklep (UVOŽEN iz brata R303 — ŠTIRI potrošniki
//    ENEGA niza: PDF sklepna vrstica + PDF/toast komponente + CSV meta
//    vrstica 'Sklep' + CSV/toast komponente — NIKOLI dvojno besedilo);
//  • Čas v celicah = vozniRedCasOkno (UVOŽEN iz R255 — ISTI 'HH:MM' ali
//    'HH:MM–HH:MM' kot Tedenski CSV brat R292 'Čas' stolpec);
//  • Dan/Dan v tednu = ISO dan začetka + tedenskiDanIme (UVOŽEN iz R256 —
//    ISTI fiksni slovenski seznam, getUTCDay čista UTC aritmetika; RAVNINSKA
//    resnica po vzorcu R292: strojni ISO + človeško ime ločena stolpca za
//    Excel filtriranje);
//  • statusi v celicah = SCHEDULE_TERMINI_STATUS_LABELS (UVOŽENI — ISTI
//    VERBATIM prikazi kot bratje R292/R301/R303);
//  • 'Načrtovane ure' meta = tedenskiUreKpi (UVOŽEN iz R256 — ISTI javni
//    kontrakt 'brez ure = spodnja meja, NIKOLI lažno popolna');
//  • datum v Obseg vrstici = cenikDatumIso (UVOŽEN — ISTI izpis DD. MM. YYYY
//    okna kot meta bratje R292/R296/R297/R301).
//
// Struktura CSV (ravnina — vsak TERMIN = ena vrstica; Ekipa stolpec nadomešča
// PDF sekcije):
//  • podatkovne vrstice (9 stolpcev): Ekipa (VERBATIM — vir nič pretvorbe) ·
//    Dan (ISO YYYY-MM-DD začetka — strojna resnica) · Dan v tednu (slovensko
//    ime) · Čas (vozniRedCasOkno) · Projekt · Stranka · Status · Ure ·
//    Lokacija. Null polja → '—' (iskrena null resnica — R227 strogost,
//    ISTO kot PDF brat R303 sekcije);
//  • meta vrstice po podatkih (kanon R172→R296): prazna ločilna + Obseg
//    (okno — ISTI izpis kot bratje) + Ekip + Terminov po ekipah +
//    Načrtovane ure ('≥' resnica) + pogojno 'Brez ure (izključene iz
//    vsote)' + pogojno 'Preklicani (viden odpad)' + pogojno 'Brez ekipe
//    (brez sekcije — viden odpad)' [iskren brez-ekipe števec — termini brez
//    ekipe NISO vrstice (ekipa '—' ne obstaja, princip R299/R303), ampak
//    NISO tiho izgubljeni] + 'Terminov skupaj v oknu' + Sklep (UVOŽEN
//    tedenskiEkipaPdfSklep — ISTO besedilo kot PDF sklep IN toast) +
//    'Izvoženo ob' (kanonični ISO 8601);
//  • 0 EKIP NI VELJAVEN vhod (fail-closed mirror brata R303 + družine
//    R266/R297/R301/R302: 'ni prazne datoteke'); komponenta pokrije prazno
//    okno IN 0 ekip z iskrenim toastom ŠE PRED klicem — lib dvakrat brani:
//    TypeError z razlogom.
//
// Načela (družinska pravila):
//  • Fail-closed: ne-polje / pokvaren vnos (uvožen pregled — indeks krivca
//    VEDNO v sporočilu) / pokvaren now / 0 ekip → TypeError (nikoli tiho
//    spregledano).
//  • Determinizem: `now` KOT parameter (F4 — jedro ne bere ure; komponenta
//    poda tedenskiRazgledNow = ENA izpeljava časa za pregled + CSV + ime,
//    lekcija R121/R235); vrstice v ISTEM vrstnem redu kot tedenskiEkipaPregled
//    (skupine ASC UTF-16, termini sortirajVozniRed — f(MNOŽICA), premešan
//    odgovor = bajtno ISTI CSV).
//  • Format: BOM + '\n' zaključki + citiranje besedilnih celic (vzorec
//    vodja-csv / R285 / R286 / R291 / R292 / R293 / R295 / R296 / R297 /
//    R301 — vsak lib nosi lasten 3-vrstični citiraj).
//  • CLIENT-safe: čisti klientski lib (uvozi ga logistics-tab) — NIČ
//    strežniške domene, NIČ baznega uvoza (čista izpeljava brata R303).
// ---------------------------------------------------------------------------

import {
  tedenskiEkipaPregled,
  tedenskiEkipaPdfSklep,
} from './tedenski-vozni-red-ekipa-pdf'
import { tedenskiDanIme, tedenskiUreKpi } from './tedenski-vozni-red-pdf'
import { vozniRedCasOkno, type VozniRedTermin } from './logistika-vozni-red-pdf'
import { SCHEDULE_TERMINI_STATUS_LABELS } from './termini-prikaz'
import { cenikDatumIso } from './cenik-pdf'
import { todayStamp } from './csv-export'

/** Glava tabele (9 stolpcev — ENA vrstica = EN termin v oknu; Ekipa STOLPEC
 *  nadomešča PDF sekcije brata R303 — Excel filtrira po ekipi; Dan ISO +
 *  Dan v tednu ločena stolpca — RAVNINSKA resnica po vzorcu R292). */
export const EKIPA_CSV_GLAVA = [
  'Ekipa',
  'Dan',
  'Dan v tednu',
  'Čas',
  'Projekt',
  'Stranka',
  'Status',
  'Ure',
  'Lokacija',
] as const

/** Citiranje besedilnih polj (narekovaj podvojen) — vzorec vodja-csv/R292. */
function citiraj(v: string): string {
  return `"${v.replace(/"/g, '""')}"`
}

/** Vrstice CSV (brez BOM) — podatkovne + meta (kanon R172→R296). Vrstice v
 *  ISTEM vrstnem redu kot tedenskiEkipaPregled (EN VIR brata R303 — skupine
 *  ASC UTF-16, termini sortirajVozniRed; f(MNOŽICA)). `now` = okno + žig
 *  resnica (F4). */
export function tedenskiEkipaCsvVrstice(
  vnosi: readonly VozniRedTermin[],
  now: Date,
): string[] {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('tedenskiEkipaCsvVrstice: pričakovan veljaven now: Date')
  }
  if (!Array.isArray(vnosi)) {
    throw new TypeError('tedenskiEkipaCsvVrstice: pričakovano polje terminov (VozniRedTermin[])')
  }
  // EN VIR pregled (uvožen R303 — ISTO okno, ISTI ekipa seznam, ISTI sort,
  // ISTA preverba z indeksom krivca za cel lib).
  const pregled = tedenskiEkipaPregled(vnosi, now)
  if (pregled === null) {
    throw new TypeError(
      'tedenskiEkipaCsvVrstice: ni ekip z termini v 7-dnevnem oknu — datoteka se izvozi, ko ima ekipa vpisan termin (mirror R299/R303; ni prazne datoteke — družina R266/R297/R301/R302/R303)',
    )
  }
  const vrstice: string[] = [EKIPA_CSV_GLAVA.map(citiraj).join(',')]
  for (const skupina of pregled.skupine) {
    for (const t of skupina.termini) {
      const danIso = t.datumZacetka.slice(0, 10)
      vrstice.push(
        [
          skupina.ekipa,
          danIso,
          tedenskiDanIme(danIso),
          vozniRedCasOkno(t),
          t.projekt ?? '—',
          t.stranka ?? '—',
          SCHEDULE_TERMINI_STATUS_LABELS[t.status],
          t.predvideneUre === null ? '—' : String(t.predvideneUre),
          t.lokacija ?? '—',
        ]
          .map(citiraj)
          .join(','),
      )
    }
  }
  // --- meta vrstice (kanon R172→R296; iskrne resnice pregleda) ---
  vrstice.push('')
  vrstice.push(
    [
      'Obseg',
      `Okno naslednjih 7 dni: ${cenikDatumIso(pregled.okno[0])} – ${cenikDatumIso(pregled.okno[6])} (danes + 6 dni, UTC) — vir = ISTI pregled kot Ekipe PDF (tedenskiEkipaPregled).`,
    ]
      .map(citiraj)
      .join(','),
  )
  vrstice.push(['Ekip', String(pregled.skupine.length)].map(citiraj).join(','))
  vrstice.push(['Terminov po ekipah', String(pregled.terminovVEkipah)].map(citiraj).join(','))
  vrstice.push(
    [
      'Načrtovane ure',
      tedenskiUreKpi({ nacrtovaneUre: pregled.nacrtovaneUre, brezUre: pregled.brezUre }),
    ]
      .map(citiraj)
      .join(','),
  )
  if (pregled.brezUre > 0) {
    vrstice.push(
      ['Brez ure (izključene iz vsote)', String(pregled.brezUre)].map(citiraj).join(','),
    )
  }
  if (pregled.preklicanih > 0) {
    vrstice.push(
      ['Preklicani (viden odpad)', String(pregled.preklicanih)].map(citiraj).join(','),
    )
  }
  if (pregled.brezEkipe > 0) {
    vrstice.push(
      ['Brez ekipe (brez sekcije — viden odpad)', String(pregled.brezEkipe)]
        .map(citiraj)
        .join(','),
    )
  }
  vrstice.push(['Terminov skupaj v oknu', String(pregled.terminovSkupaj)].map(citiraj).join(','))
  // Sklep EN VIR (uvožen tedenskiEkipaPdfSklep — ISTO besedilo kot PDF
  // sklepna vrstica IN toast komponente; ŠTIRI potrošniki ENEGA niza).
  vrstice.push(['Sklep', tedenskiEkipaPdfSklep(pregled)].map(citiraj).join(','))
  vrstice.push(['Izvoženo ob', now.toISOString()].map(citiraj).join(','))
  return vrstice
}

/** Celoten CSV niz: BOM + vrstice ('\n' zaključki — vzorec R186/R285/R286/R291/R292/R296/R297/R301). */
export function tedenskiEkipaCsv(
  vnosi: readonly VozniRedTermin[],
  now: Date,
): { csv: string; vrstic: number } {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('tedenskiEkipaCsv: pričakovan veljaven now: Date')
  }
  const lines = tedenskiEkipaCsvVrstice(vnosi, now)
  return { csv: '\uFEFF' + lines.join('\n'), vrstic: lines.length }
}

/** Deterministično ime datoteke: Tedenski-po-ekipah-YYYY-MM-DD.csv (brat PDF
 *  imena R303 — ISTA dnevna resnica, druga končnica; deterministično glede
 *  na `now`; EN now za žig IN ime — lekcija R121/R235). */
export function tedenskiEkipaCsvFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('tedenskiEkipaCsvFilename: pričakovan veljaven now: Date')
  }
  return `Tedenski-po-ekipah-${todayStamp(now)}.csv`
}
