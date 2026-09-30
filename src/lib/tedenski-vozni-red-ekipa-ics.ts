// ---------------------------------------------------------------------------
// R299 (P1, 'izvozi' družina — 29. člen) — TEDENSKI VOZNI RED ICS PO EKIPAH
// iz logistike (logistics-tab). IZPELJANI BRAT ICS R298 (ki je brat PDF
// R256 + CSV R292): NASLEDNJIH 7 DNI FILTRIRANO NA ENO EKIPO — član ekipe
// uvozi SAMO svoje termine (telefon ne dobi tuje napake; vodja pa lahko
// primerja datoteke med ekipami). ISTA koledarska resnica kot R298 —
// WYSIWYG po konstrukciji (isti razgled, isti DTEND/STATUS kanon R139/R172).
//
// EN VIR resnice (NIČ dvojnega — vse primitivne izpeljave UVOŽENE):
//  • ICS mašinerija = tedenskiVozniRedIcsVrstice / tedenskiVozniRedIcs
//    (UVOŽENA iz R298 — ČETRTI potrošnik ISTEGA razgleda: strip R292 +
//    CSV R292 + ICS R298 + ekipa-filtri R299; okno/validacija/sort/status
//    VSE UVOŽENO, nič znova — nova opcija oblika R299: PRODID/UID predpona/
//    X-ROKSAL-EKIPA/obseg dodatek kot PARAMETRI, brez opcij bajtno R298);
//  • ekipa = VozniRedTermin.ekipa (ne-prazen niz ALI null — preverja
//    preveriVozniRedTermin; filter je TOČEN nizovni primerjava — NIKOLI
//    trim/normalizacija: vir VERBATIM, izmišljena ujemanja ne obstajajo);
//  • seznem ekip = tedenskiEkipaImena (spodaj) — enaka okna resnica;
//  • hash UID predpone = fnv1a32Hex (UVOŽEN iz quote-repro — čista,
//    odvisnost-brez FNV-1a; DOKUMENTIRANA ponovna raba obstoječega ENA vira
//    namesto četrte kopije algoritma).
//
// Domain pravilo (DOKUMENTIRANA divergenca od R298 osnovnega ICS):
//  • R298: PRAZNO okno = VELJAVEN vhod (0 VEVENT — okno VEDNO obstaja);
//  • R299: izvoz OBSTAJA samo za ekipa Z vsaj enim terminom V OKNU —
//    neznana/prazna ekipa → TypeError (iskrena vrata; ekipa brez dela v
//    tednu NIMA datoteke, komponenta pokaže fail-closed toast). Tako je
//    vsak izvožen per-ekipa ICS SAMODEJNO ≥ 1 VEVENT (ni prazne datoteke).
//
// UID trki (sočasni uvoz več datotek v isti telefon):
//  • R298 osnovni: vozni-red-<nnn>-<DTSTART>@roksal;
//  • R299 ekipa:   vozni-red-ekipa-<hash8>-<nnn>-<DTSTART>@roksal —
//    hash8 = fnv1a32Hex(ekipa) — DVE različni ekipi NIKOLI isti predpona
//    (različen niz → različen FNV-1a v praksi; dokumentirano), ekipa datoteka
//    pa se od osnovne razlikuje ŽE po predponi 'vozni-red-ekipa-' — trije
//    vzporedni uvozi (osnovni + dve ekipi) se ne obnašajo kot isti dogodek.
//
// Načela (družinska pravila):
//  • Fail-closed: ne-polje / pokvaren vnos (uvožen pregled — indeks krivca
//    VEDNO v sporočilu) / pokvaren now / ne-niz ekipa / prazna ekipa /
//    NEZNANA ekipa (z imenom v sporočilu) → TypeError (nikoli tiho
//    spregledano).
//  • Determinizem: `now` KOT parameter (okno + DTSTAMP + ime datoteke, F4);
//    ekipa seznam = f(množica) (UTF-16 < ASC po kanonu R245/R250 — NIKOLI
//    localeCompare); vrstice znotraj dneva = sortirajVozniRed (premešan
//    odgovor = bajtno ISTI ICS).
// ---------------------------------------------------------------------------

import { tedenskiVozniRedIcs } from './tedenski-vozni-red-ics'
import {
  tedenskiOknoDnevi,
  tedenskiPregledPovzetek,
  type TedenskiPregledPovzetek,
} from './tedenski-vozni-red-pdf'
import { preveriVozniRedTermin, type VozniRedTermin } from './logistika-vozni-red-pdf'
import { fnv1a32Hex } from './quote-repro'
import { todayStamp } from './csv-export'

/** PRODID (RFC 5545 §3.7.3) — identifikator generatorja (konstanta;
 *  LASTNI koledar izpeljanega brata — NIČ podedovanega PRODID-a R298). */
export const TEDENSKI_EKIPA_ICS_PRODID = '-//Roksal//Tedenski vozni red po ekipah//SL'

/** Determinističen slug za ime datoteke: presledki → '-', znaki izven
 *  črk/številk/-' izpuščeni (čšž ostanejo — \p{L} je Unicode razred, NIKOLI
 *  ASCII-rez), prazen rezultat = 'ekipa' (iskrena oznaka, ne izmišljeno
 *  ime). Čista projekcija IMENA — vir NIČ. */
export function tedenskiEkipaSlug(ekipa: string): string {
  if (typeof ekipa !== 'string') {
    throw new TypeError('tedenskiEkipaSlug: pričakovan niz ekipa')
  }
  const slug = ekipa
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug.length > 0 ? slug : 'ekipa'
}

/** Ekipa z vsaj enim terminom v 7-dnevnem oknu (danes + 6, UTC) — UNIQUE,
 *  ASC po UTF-16 < (kanon R245/R250 — NIKOLI localeCompare), null ekipe
 *  IZKLJUČENE ('—' na zaslonu = brez ekipe, NI ekipa z imenom '—').
 *  Fail-closed: ne-polje / pokvaren vnos (uvožen preveriVozniRedTermin) /
 *  pokvaren now → TypeError. f(množica) — premešan odgovor = ISTI seznam. */
export function tedenskiEkipaImena(
  vnosi: readonly VozniRedTermin[],
  now: Date,
): string[] {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('tedenskiEkipaImena: pričakovan veljaven now: Date')
  }
  if (!Array.isArray(vnosi)) {
    throw new TypeError('tedenskiEkipaImena: pričakovano polje terminov (VozniRedTermin[])')
  }
  vnosi.forEach((t, i) => preveriVozniRedTermin(t, i))
  const okno = new Set(tedenskiOknoDnevi(now))
  const imena = new Set<string>()
  for (const t of vnosi) {
    if (!okno.has(t.datumZacetka.slice(0, 10))) continue
    if (t.ekipa !== null) imena.add(t.ekipa)
  }
  return Array.from(imena).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

/** Vrstice V OKNU za ekipa — filter EN VIR (TOČEN nizovni primerjava).
 *  Notranji (vnosi ŽE pregledani prek tedenskiEkipaImena). */
function filtrirajEkipa(vnosi: readonly VozniRedTermin[], ekipa: string, now: Date): VozniRedTermin[] {
  const okno = new Set(tedenskiOknoDnevi(now))
  return vnosi.filter((t) => t.ekipa === ekipa && okno.has(t.datumZacetka.slice(0, 10)))
}

export interface TedenskiEkipaIcsRezultat {
  /** Celoten ICS niz (CRLF, brez BOM — ISTA konvencija kot R298). */
  ics: string
  /** Število VEVENT (≥ 1 — domain pravilo: neznana/prazna ekipa NE gre
   *  skozi; glej glavo). */
  dogodki: number
  /** Ekipa VERBATIM (isto ime kot vhod — VIR NIČ). */
  ime: string
  /** Povzetek FILTRIRANEGA okna (uvožen tedenskiPregledPovzetek nad
   *  filtrirano množico — WYSIWYG toast/ezno resnica). */
  pov: TedenskiPregledPovzetek
}

/** Zgradi TEDENSKI VOZNI RED ICS ZA ENO EKIPO — naslednjih 7 dni, samo
 *  termini te ekipe. Fail-closed: ekipa mora biti ne-prazen niz IN znana
 *  (tedenskiEkipaImena — vsaj 1 termin v oknu), sicer TypeError z imenom.
 *  `now` KOT parameter (F4). */
export function tedenskiEkipaIcs(
  vnosi: readonly VozniRedTermin[],
  ekipa: string,
  now: Date,
): TedenskiEkipaIcsRezultat {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('tedenskiEkipaIcs: pričakovan veljaven now: Date')
  }
  if (!Array.isArray(vnosi)) {
    throw new TypeError('tedenskiEkipaIcs: pričakovano polje terminov (VozniRedTermin[])')
  }
  if (typeof ekipa !== 'string' || ekipa.length === 0) {
    throw new TypeError(
      `tedenskiEkipaIcs: ekipa mora biti ne-prazen niz, ne ${String(ekipa)}`,
    )
  }
  const znane = tedenskiEkipaImena(vnosi, now)
  if (!znane.includes(ekipa)) {
    throw new TypeError(
      `tedenskiEkipaIcs: neznana ekipa (brez termina v naslednjih 7 dneh): ${ekipa}`,
    )
  }
  const filtrirani = filtrirajEkipa(vnosi, ekipa, now)
  const pov = tedenskiPregledPovzetek(filtrirani, now)
  if (pov === null) {
    // Nedosegljivo po preverbi znane ekipe (domain pravilo — glej glavo);
    // fail-closed obramba, ne tiho prazna datoteka.
    throw new TypeError(
      `tedenskiEkipaIcs: ekipa ${ekipa} ima 0 terminov v oknu (neusklajena preverba — abort)`,
    )
  }
  const { ics, dogodki } = tedenskiVozniRedIcs(filtrirani, now, {
    prodid: TEDENSKI_EKIPA_ICS_PRODID,
    obsegDodatek: ` · Ekipa: ${ekipa}`,
    uidPredpona: `vozni-red-ekipa-${fnv1a32Hex(ekipa)}-`,
    xEkipa: ekipa,
  })
  return { ics, dogodki, ime: ekipa, pov }
}

/** Deterministično ime datoteke: Tedenski-vozni-red-<slug>-YYYY-MM-DD.ics
 *  (družinski vzorec — referenčni datum pride KOT parameter, F4; bratje
 *  R256/R292/R298). Slug = tedenskiEkipaSlug (determinističen). */
export function tedenskiEkipaIcsFilename(ekipa: string, now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('tedenskiEkipaIcsFilename: pričakovan veljaven now: Date')
  }
  if (typeof ekipa !== 'string' || ekipa.length === 0) {
    throw new TypeError(
      `tedenskiEkipaIcsFilename: ekipa mora biti ne-prazen niz, ne ${String(ekipa)}`,
    )
  }
  return `Tedenski-vozni-red-${tedenskiEkipaSlug(ekipa)}-${todayStamp(now)}.ics`
}
