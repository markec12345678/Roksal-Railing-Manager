// ---------------------------------------------------------------------------
// R296 (P1, 'izvozi' družina — 26. člen) — KOLEDAR PREGLEDOV ICS iz CRM
// (crm-tab). ICS BRAT PDF R253 + CSV R295: koledar pregledov kot RFC 5545
// iCalendar datoteka — stranka/pisarna ga uvozi V KOLEDARSKO APLIKACIJO
// (Google Calendar / Outlook / telefon) in pregledi se pojavijo med svojimi
// dogodki. ISTA koledarska resnica kot PDF tabela IN CSV ravnina — WYSIWYG po
// konstrukciji.
//
// EN VIR resnice (NIČ dvojnega — vse primitivne izpeljave UVOŽENE):
//  • vrstice/dogodki = sortirajKoledar (UVOŽENA iz PDF brata R253 — ISTI
//    koledarski red: opomnikDatum ASC najbližji prvi, izenačba ime ASC);
//  • preverba vnosa = preveriKoledarVnos (UVOŽENA — ISTI fail-closed
//    kontrakt: ne-prazno ime/naslov, ISO opomnikDatum, status VERBATIM
//    AKTIVEN|POTEKEL — 'NI' vnos = pokvaren vir, NIKOLI tiho spregledan);
//  • agregat = koledarPovzetek (UVOŽEN — ISTI trikot kot PDF KPI, CSV meta,
//    F2 mini-vrstica IN toast);
//  • datum projekcija = ISTA regex izpeljava kot cenikDatumIso (cenik-pdf):
//    '^(\d{4})-(\d{2})-(\d{2})' nad ISTIM virom opomnikDatum — ICS Basic
//    format YYYYMMDD je ICS-specifična projekcija ISTEGA datuma (nič drugega
//    datuma, nič drugega vira).
//
// Struktura ICS (RFC 5545): VCALENDAR 2.0 + VEVENT na vpisani pregled.
//  • DTSTART;VALUE=DATE = opomnikDatum (celodnevni dogodek — vir IMA samo
//    datum, NIKOLI izmišljeno uro: iskrena projekcija podatkovne resnice);
//  • DTEND;VALUE=DATE = naslednji dan (RFC 5545: DTEND DATE je ekskluziven —
//    naslednji dan pomeni 'isti celoten dan');
//  • SUMMARY = 'Pregled: <ime>' (iskrena oznaka kaj dogodek je);
//  • LOCATION = naslov; DESCRIPTION = status · dni-do · telefon · opis
//    ('—' za manjkajoče — ISTI iskren null prikaz kot PDF/CSV bratje);
//  • X-ROKSAL-STATUS = opomnikStatus VERBATIM iz API-ja (X- properties so
//    RFC-legalen prostor za aplikacijske resnice — RFC STATUS semantiko
//    NIZAMISLJIMO: AKTIVEN/POTEKEL nista RFC STATUS vrednosti in ne bosta);
//  • UID/DTSTAMP deterministična: UID iz (indeks v koledarskem redu, datum),
//    DTSTAMP iz `now` KOT PARAMETER (jedro ne bere ure — F4).
//
// Odstopki od CSV-družinske oblike (DOKUMENTIRANA razloga — nič tihega):
//  • BREZ BOM: CSV bratje pišejo BOM za Excel; koledarski potrošniki
//    (Google/Outlook/Apple) pričakujejo čist UTF-8 brez BOM — drugačen
//    potrošnik, drugačna konvencija;
//  • CRLF zaključki vrstic (RFC 5545 §3.1 zahteva CRLF; CSV bratje '\n' za
//    Excel);
//  • ZAVIJANJE vrstic: RFC 5545 §3.1 — fizična vrstica največ 75 oktetov,
//    nadaljevanje = CRLF + presledek; zavijanje šteje OKTETE (UTF-8), ne
//    znakov — čšž več-bajtni znak se NIKOLI ne preseka na polovici.
//
// Načela (družinska pravila):
//  • Fail-closed: prazen koledar / ne-polje / pokvaren now → TypeError
//    ('prazen koledar ne nastaja datoteke — družina: ni prazne datoteke');
//    per-vnos preveriKoledarVnos z indeksom krivca.
//  • Determinizem: `now` KOT parameter; vrstni red = f(MNOŽICA) prek
//    sortirajKoledar (isti vnos = bajtno isti ICS, vedno).
// ---------------------------------------------------------------------------

import {
  preveriKoledarVnos,
  sortirajKoledar,
  koledarPovzetek,
  koledarDniDo,
  type KoledarPregledVnos,
} from './koledar-pregledov-pdf'
import { todayStamp } from './csv-export'

/** PRODID (RFC 5545 §3.7.3) — identifikator generatorja (konstanta). */
export const KOLEDAR_PREGLEDOV_ICS_PRODID = '-//Roksal//Koledar pregledov//SL'

/** ICS izpustni znaki za TEXT polja (RFC 5545 §3.3.11): poševnica nazaj,
 *  podpičje, vejica, nova vrstica (\n dobeseden par znakov).
 *  R298: IZVOŽENA — ICS brat tedenski-vozni-red-ics uporablja ISTO mašinerijo
 *  (ENA izpeljava, vzorec R295 downloadTextFile — nič dvojnega). */
export function icsBesedilo(v: string): string {
  return v
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Dolžina niza v UTF-8 oktetih (čisto iz code pointov — brez odvisnosti,
 *  izomorfno node/brskalnik; useda za RFC §3.1 zavijanje). R298: IZVOŽENA
 *  (ENA izpeljava zavijanja čez ICS družino). */
export function utf8Okteti(s: string): number {
  let n = 0
  for (const ch of s) {
    const c = ch.codePointAt(0) as number
    n += c <= 0x7f ? 1 : c <= 0x7ff ? 2 : c <= 0xffff ? 3 : 4
  }
  return n
}

/** Zavije LOGIČNO vrstico v RFC 5545 §3.1 fizične vrstice: prva ≤ 75 oktetov,
 *  nadaljevanja ' ' + ≤ 74 oktetov; rez po mejah znakov (čšž nikoli na polovici).
 *  R298: IZVOŽENA (ENA izpeljava zavijanja čez ICS družino). */
export function zavijVrstico(logicna: string): string[] {
  if (utf8Okteti(logicna) <= 75) return [logicna]
  const fyzicne: string[] = []
  let ostane = logicna
  let prva = true
  while (utf8Okteti(ostane) > (prva ? 75 : 74)) {
    const dovoljeno = prva ? 75 : 74
    let vzeto = ''
    let bajtov = 0
    for (const ch of ostane) {
      const b = utf8Okteti(ch)
      if (bajtov + b > dovoljeno) break
      vzeto += ch
      bajtov += b
    }
    fyzicne.push(prva ? vzeto : ' ' + vzeto)
    ostane = ostane.slice(vzeto.length)
    prva = false
  }
  fyzicne.push(prva ? ostane : ' ' + ostane)
  return fyzicne
}

/** opomnikDatum ('YYYY-MM-DD…') → ICS Basic datum 'YYYYMMDD' — ISTA regex
 *  izpeljava kot cenikDatumIso (EN VIR izpeljava, ICS-specifična projekcija). */
function icsDatumBasic(opomnikDatum: string, i: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(opomnikDatum)
  if (!m) {
    throw new TypeError(
      `koledarPregledovIcs (${i}): opomnikDatum mora biti ISO niz YYYY-MM-DD…, ne ${String(opomnikDatum)}`,
    )
  }
  return `${m[1]}${m[2]}${m[3]}`
}

/** Basic datum → naslednji dan (DTEND ekskluziven — RFC 5545 §3.6.1). */
function naslednjiDan(basic: string): string {
  const y = Number(basic.slice(0, 4))
  const m = Number(basic.slice(4, 6))
  const d = Number(basic.slice(6, 8))
  const nasl = new Date(Date.UTC(y, m - 1, d + 1))
  return `${String(nasl.getUTCFullYear()).padStart(4, '0')}${String(nasl.getUTCMonth() + 1).padStart(2, '0')}${String(nasl.getUTCDate()).padStart(2, '0')}`
}

/** now (Date) → ICS UTC 'YYYYMMDDTHHMMSSZ' (DTSTAMP — deterministično iz
 *  parametra, F4). R298: IZVOŽENA — DTSTAMP brata ISTA projekcija ure. */
export function icsZigUtc(now: Date): string {
  const d = String(now.getUTCDate()).padStart(2, '0')
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const h = String(now.getUTCHours()).padStart(2, '0')
  const mi = String(now.getUTCMinutes()).padStart(2, '0')
  const s = String(now.getUTCSeconds()).padStart(2, '0')
  return `${now.getUTCFullYear()}${m}${d}T${h}${mi}${s}Z`
}

/** Vrstice ICS (brez zaključkov) — glava + dogodki + noga, vsaka LOGIČNA
 *  vrstica že zavita v RFC fizične vrstice. `now` = DTSTAMP + 'Dni do'
 *  resnica + ime (F4). */
export function koledarPregledovIcsVrstice(
  vnosi: readonly KoledarPregledVnos[],
  now: Date,
): string[] {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('koledarPregledovIcsVrstice: pričakovan veljaven now: Date')
  }
  if (!Array.isArray(vnosi)) {
    throw new TypeError('koledarPregledovIcsVrstice: pričakovano polje vnosa (KoledarPregledVnos[])')
  }
  if (vnosi.length === 0) {
    throw new TypeError(
      'koledarPregledovIcsVrstice: prazen koledar ne nastaja datoteke (družina R253: ni prazne datoteke — komponenta pokaže iskren toast)',
    )
  }
  const sortirane = sortirajKoledar(vnosi)
  sortirane.forEach((p, i) => preveriKoledarVnos(p, i))
  const zig = icsZigUtc(now)

  const logicne: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${KOLEDAR_PREGLEDOV_ICS_PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]
  sortirane.forEach((p, i) => {
    const datum = icsDatumBasic(p.opomnikDatum, i)
    const opis = [
      `Status: ${p.opomnikStatus}`,
      `Dni do: ${koledarDniDo(p, now)}`,
      `Telefon: ${p.telefon?.trim() ? p.telefon.trim() : '—'}`,
      `Opis: ${p.opomnikOpis?.trim() ? p.opomnikOpis.trim() : '—'}`,
    ].join(' · ')
    logicne.push('BEGIN:VEVENT')
    logicne.push(`UID:pregled-${String(i + 1).padStart(3, '0')}-${datum}@roksal.local`)
    logicne.push(`DTSTAMP:${zig}`)
    logicne.push(`DTSTART;VALUE=DATE:${datum}`)
    logicne.push(`DTEND;VALUE=DATE:${naslednjiDan(datum)}`)
    logicne.push(`SUMMARY:Pregled: ${icsBesedilo(p.ime.trim())}`)
    logicne.push(`LOCATION:${icsBesedilo(p.naslov.trim())}`)
    logicne.push(`DESCRIPTION:${icsBesedilo(opis)}`)
    logicne.push(`X-ROKSAL-STATUS:${p.opomnikStatus}`)
    logicne.push('END:VEVENT')
  })
  logicne.push('END:VCALENDAR')
  return logicne.flatMap(zavijVrstico)
}

/** Celoten ICS niz: čist UTF-8 BREZ BOM + CRLF zaključki (RFC 5545 §3.1;
 *  odstopek od CSV bratov DOKUMENTIRAN v glavi — koledarski potrošniki).
 *  dogodki = število VEVENT (ISTI števec kot koledarPovzetek.preglediN). */
export function koledarPregledovIcs(
  vnosi: readonly KoledarPregledVnos[],
  now: Date,
): { ics: string; dogodki: number } {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('koledarPregledovIcs: pričakovan veljaven now: Date')
  }
  const fyzicne = koledarPregledovIcsVrstice(vnosi, now)
  return { ics: fyzicne.join('\r\n') + '\r\n', dogodki: vnosi.length }
}

/** Deterministično ime datoteke: Koledar-pregledov-YYYY-MM-DD.ics
 *  (družinski vzorec — referenčni datum pride KOT parameter, F4; bratje PDF
 *  R253 / CSV R295). */
export function koledarPregledovIcsFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('koledarPregledovIcsFilename: pričakovan veljaven now: Date')
  }
  return `Koledar-pregledov-${todayStamp(now)}.ics`
}
