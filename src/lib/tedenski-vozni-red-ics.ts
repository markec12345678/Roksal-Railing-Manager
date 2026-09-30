// ---------------------------------------------------------------------------
// R298 (P1, 'izvozi' družina — 28. člen) — TEDENSKI VOZNI RED ICS iz
// logistike (logistics-tab). ICS BRAT PDF R256 + CSV R292: naslednjih 7 dni
// montaž kot RFC 5545 iCalendar — EKIPA uvozi razpored V TELEFON (Google
// Calendar / Outlook / koledarska aplikacija) in termini se pojavijo med
// svojimi dogodki. ISTA koledarska resnica kot PDF sekcije IN CSV ravnina —
// WYSIWYG po konstrukciji.
//
// EN VIR resnice (NIČ dvojnega — vse primitivne izpeljave UVOŽENE):
//  • dnevi + vrstice = tedenskiRazgled (UVOŽEN iz CSV brata R292 — TRETJI
//    potrošnik ISTEGA razgleda: zasonski strip R292, CSV R292, ICS R298;
//    okno 7 dni = tedenskiOknoDnevi, imena dni = tedenskiDanIme, pregled
//    vnosa = preveriVozniRedTermin, red znotraj dneva = sortirajVozniRed,
//    povzetek = tedenskiPregledPovzetek — VSE UVOŽENO, nič znova);
//  • čas dogodka = ISTA izpeljava kot stolpec 'Čas': datumZacetka/
//    datumKonca sta UTC ISO (kanon R168/R256 — 'API vedno izda ISO');
//    ICS DTSTART/DTEND 'YYYYMMDDTHHMMSSZ' je ISTA projekcija ISTEGA
//    trenutka v Basic obliko z 'Z' oznako (nikoli preslikava v drug pas —
//    'Z' pomeni dobesedno isti trenutek, koledarska aplikacija izriše v
//    uporabnikovem pasu);
//  • status besedilo = SCHEDULE_TERMINI_STATUS_LABELS (UVOŽENO — ISTI
//    VERBATIM label kot PDF autoTable IN CSV stolpec);
//  • obseg meta = cenikDatumIso (UVOŽEN — ISTI izpis 'DD.MM.YYYY' kot PDF
//    naslov okna IN CSV meta vrstica Obseg).
//
// Struktura ICS (RFC 5545): VCALENDAR 2.0 + VEVENT na termin v oknu.
//  • DTSTART;TZID NE obstaja in UTC 'Z' NE izmišljuje ure — datumZacetka
//    IMA resnično uro (za razliko od koledarja pregledov R296, kjer vir ima
//    SAMO datum in je dogodek celodnevni VALUE=DATE);
//  • DTEND = ISTA semantika kot ICS družina R139/R172 (termin-domna):
//    (1) datumKonca ≠ null → resnično vpisan konec; (2) sicer predvideneUre
//    ≥ 1 → DTSTART + ure (PREDVIDENO trajanje dela — dokumentirana
//    projekcija, ISTA kot R172 icsKonec — obe datoteki v istem telefonu
//    ne smeta kazati dveh različnih koncev istega termina); (3) sicer
//    DTSTART (zero-length marker — konec vir NE pozna, NIKOLI izmišljen);
//  • STATUS = ISTA preslikava kot R139/R172 (Preklicano → CANCELLED,
//    Preloženo → TENTATIVE, ostalo → CONFIRMED) + X-ROKSAL-STATUS VERBATIM
//    (obba resnici — RFC enum za koledarsko aplikacijo, X- za vir);
//  • SUMMARY = projekt (ali '—' — iskrena null resnica, ISTA kot stolpec
//    PDF/CSV bratje);
//  • DESCRIPTION = 'Status: … · Ekipa: … · Stranka: … · Čas: … ·
//    Predvidene ure: …' (ISTI iskreni prikazi kot CSV stolpci: '—' za
//    manjkajoče, ure '—' ko null, Čas = vozniRedCasOkno);
//  • LOCATION = lokacija (ali '—');
//  • X-ROKSAL-OBSEG = ISTI obseg izpis kot CSV meta vrstica 'Obseg'
//    (koledarski potrošnik ne more izpeljati okna — izkazano na ravni
//    koledarja; ICS analog CSV meta kanona R172/R291);
//  • UID determinističen: vozni-red-<nnn>-<DTSTART>@roksal (nnn = 1-based
//    indeks v koledarskem redu — f(množica); vir NE nosi id-ja, zato red +
//    začetek namesto id-ja; prostor '@roksal' = ISTA domna kot R139/R172,
//    LOČEN predpona od obeh — ni trkov ob sočasnom uvozu);
//  • DTSTAMP iz `now` KOT PARAMETER (jedro ne bere ure — F4).
//
// Odstopki od CSV-družinske oblike (DOKUMENTIRANA razloga — nič tihega;
// ISTI odstotki kot R296 brat):
//  • BREZ BOM + CRLF zaključki (RFC 5545 §3.1; CSV bratje BOM + '\n' za
//    Excel — drugačen potrošnik, drugačna konvencija);
//  • ZAVIJANJE vrstic: RFC 5545 §3.1 — fizična vrstica največ 75 oktetov,
//    nadaljevanje = CRLF + presledek; štejejo se OKTETI (UTF-8), ne znaki
//    — čšž se NIKOLI ne preseka na polovici (mašinerija UVOŽENA iz R296).
//
// PRAZNO OKNO: VELJAVEN vhod (VCALENDAR z 0 VEVENT — 'ta teden ni dela' JE
// resnica okna; DOMAIN pravilo tedenske družine R256/R292 — okno VEDNO
// obstaja, tudi ko je prazno). To je DOKUMENTIRANA divergenca od koledarja
// pregledov R296 (tam prazen koledar = TypeError — koledar brez vnosa NE
// obstaja). Komponenta pri 0 terminov NEOBJAVLJA datoteke (fail-closed
// toast, R250/R291/R292 vzorec) — iskrena vrata na obeh straneh.
//
// Načela (družinska pravila):
//  • Fail-closed: ne-polje / pokvaren vnos (uvožen pregled — indeks krivca
//    VEDNO v sporočilu) / pokvaren now → TypeError (nikoli tiho
//    spregledano).
//  • Determinizem: `now` KOT parameter; dnevi v ISTEM vrstnem redu kot
//    okno, vrstice znotraj dneva = sortirajVozniRed (f(množica) — premešan
//    odgovor = bajtno ISTI ICS).
// ---------------------------------------------------------------------------

import { tedenskiRazgled } from './tedenski-vozni-red-csv'
import {
  vozniRedCasOkno,
  type VozniRedTermin,
} from './logistika-vozni-red-pdf'
import { SCHEDULE_TERMINI_STATUS_LABELS } from './termini-prikaz'
import { cenikDatumIso } from './cenik-pdf'
import {
  icsBesedilo,
  icsZigUtc,
  utf8Okteti,
  zavijVrstico,
} from './koledar-pregledov-ics'
// R298 — DTEND izpeljava IZ ISTEGA vira kot R172 (icsUtc — EN VIR projekcije
// ure v Basic UTC; nič dvojnega tretje kopije).
import { icsUtc } from './ics'
import { todayStamp } from './csv-export'

/** PRODID (RFC 5545 §3.7.3) — identifikator generatorja (konstanta;
 *  družinski vzorec R296 — LASTNI koledar, NIČ podedovanega PRODID-a). */
export const TEDENSKI_VOZNI_RED_ICS_PRODID = '-//Roksal//Tedenski vozni red//SL'

// R299 — 29. člen 'izvozi' družine: OPCIJE za izpeljane brate (per-ekipa ICS
// — tedenski-vozni-red-ekipa-ics). ADDITIVE: brez opcij je izhod BAJTNO
// ISTI kot R298 (vsi testi R298 ostajajo zeleni — 0 pin premikov).
export interface TedenskiVozniRedIcsOpcije {
  /** PRODID zamenjava (izpeljani brat nosi LASTNI PRODID — RFC §3.7.3). */
  prodid?: string
  /** Dodatek k X-ROKSAL-OBSEG vsebini (npr. ' · Ekipa: …' — izpeljana
   *  resnica izvoza; RFC X- prostor). */
  obsegDodatek?: string
  /** UID predpona zamenjava (privzeti 'vozni-red-'; izpeljani brat nosi
   *  ločen predpona — ni trkov ob sočasnem uvozu obeh datotek). */
  uidPredpona?: string
  /** X-ROKSAL-EKIPA VERBATIM (novo VCALENDAR X- polje — samo izpeljani
   *  bratje; R298 osnovni ICS je ekipa-nevrstni in ga NE nosi). */
  xEkipa?: string
}

/** RFC 5545 §3.8.1.11 STATUS preslikava — ISTA kot logistični R139 +
 *  terminska kartica R172: Preklicano → CANCELLED, Preloženo → TENTATIVE,
 *  ostalo → CONFIRMED (termin-domna kanon — obe obstoječi ICS izvoza ISTEGA
 *  domna uporabljata isto preslikavo; koledarska aplikacija izriše odnos). */
function icsStatus(status: VozniRedTermin['status']): string {
  if (status === 'PREKlicANO') return 'CANCELLED'
  if (status === 'PRELOZENO') return 'TENTATIVE'
  return 'CONFIRMED'
}

/** DTEND — ISTA semantika kot R172 icsKonec (termin-domna kanon):
 *  (1) datumKonca ≠ null → resnično vpisan konec; (2) sicer predvideneUre
 *  ≥ 1 → DTSTART + ure (PREDVIDENO trajanje dela — dokumentirana
 *  projekcija, nič izmišljenega); (3) sicer DTSTART (zero-length marker). */
function icsKonecUtc(t: VozniRedTermin, i: number): string {
  if (t.datumKonca !== null) return icsCasUtc(t.datumKonca, i, 'datumKonca')
  const zacetek = new Date(t.datumZacetka)
  if (
    typeof t.predvideneUre === 'number' &&
    Number.isInteger(t.predvideneUre) &&
    t.predvideneUre > 0
  ) {
    return icsUtc(new Date(zacetek.getTime() + t.predvideneUre * 3_600_000))
  }
  return icsCasUtc(t.datumZacetka, i, 'datumZacetka')
}

/** datumZacetka/datumKonca (UTC ISO 'YYYY-MM-DDTHH:MM…') → ICS Basic UTC
 *  'YYYYMMDDTHHMMSSZ' — ISTA projekcija ISTEGA trenutka (sekunde iz vira,
 *  privzeti '00' ko vir nosi samo minute). Fail-closed: napačna oblika →
 *  TypeError z indeksom krivca. */
function icsCasUtc(iso: string, i: number, polje: 'datumZacetka' | 'datumKonca'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(iso)
  if (!m) {
    throw new TypeError(
      `tedenskiVozniRedIcs (${i}): ${polje} mora biti ISO niz YYYY-MM-DDTHH:MM…, ne ${String(iso)}`,
    )
  }
  const s = m[6] ?? '00'
  return `${m[1]}${m[2]}${m[3]}T${m[4]}${m[5]}${s}Z`
}

/** Vrstice ICS (brez zaključkov) — glava + dogodki + noga, vsaka LOGIČNA
 *  vrstica že zavita v RFC fizične vrstice. `now` = DTSTAMP + okno (F4).
 *  PRAZNO OKNO je VELJAVEN vhod (0 VEVENT — domain pravilo tedenske
 *  družine; glej glavo). R299: opcije za izpeljane brate (per-ekipa ICS —
 *  tedenski-vozni-red-ekipa-ics); brez opcij = bajtno ISTI izhod kot R298. */
export function tedenskiVozniRedIcsVrstice(
  vnosi: readonly VozniRedTermin[],
  now: Date,
  opcije?: TedenskiVozniRedIcsOpcije,
): string[] {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('tedenskiVozniRedIcsVrstice: pričakovan veljaven now: Date')
  }
  if (!Array.isArray(vnosi)) {
    throw new TypeError(
      'tedenskiVozniRedIcsVrstice: pričakovano polje terminov (VozniRedTermin[])',
    )
  }
  if (opcije !== undefined && (opcije === null || typeof opcije !== 'object')) {
    throw new TypeError(
      'tedenskiVozniRedIcsVrstice: pričakovane opcije (TedenskiVozniRedIcsOpcije) ALI undefined',
    )
  }
  const prodid = opcije?.prodid ?? TEDENSKI_VOZNI_RED_ICS_PRODID
  if (typeof prodid !== 'string' || prodid.length === 0) {
    throw new TypeError('tedenskiVozniRedIcsVrstice: PRODID mora biti ne-prazen niz')
  }
  const predpona = opcije?.uidPredpona ?? 'vozni-red-'
  if (typeof predpona !== 'string' || predpona.length === 0) {
    throw new TypeError('tedenskiVozniRedIcsVrstice: UID predpona mora biti ne-prazen niz')
  }
  const razgled = tedenskiRazgled(vnosi, now)
  const zig = icsZigUtc(now)

  const logicne: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodid}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-ROKSAL-OBSEG:${icsBesedilo(
      `Naslednjih 7 dni: ${cenikDatumIso(razgled.okno[0])} – ${cenikDatumIso(razgled.okno[6])} (danes + 6 dni, UTC)${
        opcije?.obsegDodatek ?? ''
      }`,
    )}`,
  ]
  // R299 — X-ROKSAL-EKIPA (VERBATIM vir resnica; RFC X- prostor) — samo
  // izpeljani bratje (per-ekipa ICS); R298 osnovni ICS je ekipa-nevrsten.
  if (opcije?.xEkipa !== undefined) {
    if (typeof opcije.xEkipa !== 'string' || opcije.xEkipa.length === 0) {
      throw new TypeError('tedenskiVozniRedIcsVrstice: xEkipa mora biti ne-prazen niz')
    }
    logicne.push(`X-ROKSAL-EKIPA:${icsBesedilo(opcije.xEkipa)}`)
  }
  let n = 0
  for (const dan of razgled.dnevi) {
    for (const t of dan.vrstice) {
      n += 1
      const start = icsCasUtc(t.datumZacetka, n - 1, 'datumZacetka')
      const opis = [
        `Status: ${SCHEDULE_TERMINI_STATUS_LABELS[t.status]}`,
        `Ekipa: ${t.ekipa ?? '—'}`,
        `Stranka: ${t.stranka ?? '—'}`,
        `Čas: ${vozniRedCasOkno(t)}`,
        `Predvidene ure: ${t.predvideneUre === null ? '—' : String(t.predvideneUre)}`,
      ].join(' · ')
      logicne.push('BEGIN:VEVENT')
      logicne.push(`UID:${predpona}${String(n).padStart(3, '0')}-${start}@roksal`)
      logicne.push(`DTSTAMP:${zig}`)
      logicne.push(`DTSTART:${start}`)
      logicne.push(`DTEND:${icsKonecUtc(t, n - 1)}`)
      logicne.push(`SUMMARY:${icsBesedilo(t.projekt ?? '—')}`)
      logicne.push(`LOCATION:${icsBesedilo(t.lokacija ?? '—')}`)
      logicne.push(`DESCRIPTION:${icsBesedilo(opis)}`)
      logicne.push(`STATUS:${icsStatus(t.status)}`)
      logicne.push(`X-ROKSAL-STATUS:${t.status}`)
      logicne.push('END:VEVENT')
    }
  }
  logicne.push('END:VCALENDAR')
  return logicne.flatMap(zavijVrstico)
}

/** Celoten ICS niz: čist UTF-8 BREZ BOM + CRLF zaključki (RFC 5545 §3.1;
 *  odstopek od CSV bratov DOKUMENTIRAN v glavi — koledarski potrošniki).
 *  dogodki = število VEVENT (ISTI števec kot tedenskiRazgled povzetek).
 *  R299: opcije prehajajo naprej (per-ekipa brat); brez = bajtno R298. */
export function tedenskiVozniRedIcs(
  vnosi: readonly VozniRedTermin[],
  now: Date,
  opcije?: TedenskiVozniRedIcsOpcije,
): { ics: string; dogodki: number } {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('tedenskiVozniRedIcs: pričakovan veljaven now: Date')
  }
  const fyzicne = tedenskiVozniRedIcsVrstice(vnosi, now, opcije)
  return { ics: fyzicne.join('\r\n') + '\r\n', dogodki: fyzicne.filter((v) => v === 'BEGIN:VEVENT').length }
}

/** Deterministično ime datoteke: Tedenski-vozni-red-YYYY-MM-DD.ics
 *  (družinski vzorec — referenčni datum pride KOT parameter, F4; bratje
 *  PDF R256 / CSV R292 / ICS R296). */
export function tedenskiVozniRedIcsFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('tedenskiVozniRedIcsFilename: pričakovan veljaven now: Date')
  }
  return `Tedenski-vozni-red-${todayStamp(now)}.ics`
}

/** Oktetna dolžina najdaljše fizične vrstice (RFC §3.1 samopregled — test
 *  dokazuje ≤ 75 na vsaki fizični vrstici IZPELJAVE, ne pričakovanj). */
export function tedenskiVozniRedIcsNajdaljsaVrsticaOkteti(vrstice: readonly string[]): number {
  return vrstice.reduce((m, v) => Math.max(m, utf8Okteti(v)), 0)
}
