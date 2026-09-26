// R172 — .ics koledarski izvoz PRIKAZANIH terminov z dashboard Termini kartice
// (P1-d iz R171, vzorec CSV izvoza R171 + RFC 5545 iz logistike R139).
// ---------------------------------------------------------------------------
// IZVOŽENO = ZASLON: izvoz vsebuje NATAKO tiste vrstice, ki jih kartica pokaže
// (danes + kasneje v prikaznem vrstnem redu; filter 'Samo moje' je že
// upoštevan v filtriranih vrsticah) — monter si 7-dnevno okno prenese v
// telefonov koledar (Google/Apple/Outlook uvozijo RFC 5545) in vidi ISTO
// resnico, ki jo je videl na kartici.
//
// Načela:
//  • Determinizem: DTSTAMP je izrecni `zdaj` (pečat zadnjega uspešnega branja
//    — ISTI čas kot CSV 'Izvoženo ob', EN VIR RESNICE), UID iz id-ja vnosa,
//    Dan oznaka prek ISTIH funkcij kot zaslon; isti vhod → ista datoteka po
//    bajtih (brez skritih ur, brez naključnih UID-jev).
//  • Iskrenost: manjkajoči podatki → vrstica opisa IZPUŠČENA (nikoli izmišljenih
//    'Ni …'/'null' — vzorec buildTerminShareText R167); brez znane ure →
//    DTEND = DTSTART (zero-length marker — ISTA fallback semantika kot R139
//    'datumKonca || datumZacetka', nikoli izmišljenih '1 uro kasneje');
//    znana predvidena ura → DTEND = DTSTART + ure (predvideno trajanje dela).
//  • Fail-closed: neveljaven vnos/datum/status → TypeError (iste stroge
//    funkcije, ki jih uporablja zaslon — pokvarjen vnos ne more tiho pasti).
//  • UID prostor: 'termin-<id>@roksal' je LOČEN od logističnega
//    'schedule-<id>@roksal' (R139) — če kdo uvozi obe datoteki, ni trkov.

import { icsEscape, icsFold, icsUtc } from '@/lib/ics'
import {
  scheduleTerminiStatusLabel,
  terminDatumLabel,
  type TerminPrikazVnos,
} from '@/lib/termini-prikaz'

/** STATUS preslikava (RFC 5545 §3.8.1.11) — ISTA kot logistični R139:
 *  Preklicano → CANCELLED, Preloženo → TENTATIVE, ostalo → CONFIRMED. */
function icsStatus(status: TerminPrikazVnos['status']): string {
  if (status === 'PREKlicANO') return 'CANCELLED'
  if (status === 'PRELOZENO') return 'TENTATIVE'
  return 'CONFIRMED'
}

/** DTEND: znana predvidena ura → DTSTART + ure (predvideno trajanje dela);
 *  neznana → DTSTART (zero-length marker, nikoli izmišljenega trajanja). */
function icsKonec(vnos: TerminPrikazVnos): string {
  const zacetek = new Date(vnos.datumZacetka)
  if (
    typeof vnos.predvideneUre === 'number' &&
    Number.isInteger(vnos.predvideneUre) &&
    vnos.predvideneUre > 0
  ) {
    return icsUtc(new Date(zacetek.getTime() + vnos.predvideneUre * 3_600_000))
  }
  return icsUtc(zacetek)
}

export interface TerminiIcsOpcije {
  /** Pečat zadnjega uspešnega branja kartice (DTSTAMP; ISTI `zdaj` kot CSV
   *  'Izvoženo ob' — EN VIR RESNICE). Zahtevan: RFC 5545 §3.8.2.3. */
  zdaj: Date
  /** Referenčni čas za Dan oznako v opisu (Danes/Jutri/…) — determinizem. */
  now: Date
}

/** Zgradi celoten VCALENDAR (RFC 5545) iz PRIKAZANIH vrstic. Čista funkcija:
 *  vhod ostane nespremenjen, isti vhod → isti niz po bajtih. */
export function buildTerminiIcs(
  vrstice: readonly TerminPrikazVnos[],
  opcije: TerminiIcsOpcije
): { ics: string; dogodkov: number } {
  if (!Array.isArray(vrstice)) {
    throw new TypeError('buildTerminiIcs: pričakovano polje prikaznih vrstic')
  }
  if (!opcije || typeof opcije !== 'object') {
    throw new TypeError('buildTerminiIcs: pričakovane opcije (TerminiIcsOpcije)')
  }
  if (!(opcije.zdaj instanceof Date) || Number.isNaN(opcije.zdaj.getTime())) {
    throw new TypeError('buildTerminiIcs: pričakovan veljaven zdaj: Date')
  }
  if (!(opcije.now instanceof Date) || Number.isNaN(opcije.now.getTime())) {
    throw new TypeError('buildTerminiIcs: pričakovan veljaven now: Date')
  }

  const dtstamp = icsUtc(opcije.zdaj)
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Roksal Railing Manager//Termini kartica//SL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Roksal termini (7 dni)',
  ]

  for (const v of vrstice) {
    if (!v || typeof v !== 'object' || typeof v.id !== 'string' || v.id.length === 0) {
      throw new TypeError('buildTerminiIcs: pričakovan prikazni vnos (TerminPrikazVnos)')
    }
    // Fail-closed brezplačno: terminDatumLabel/scheduleTerminiStatusLabel/icsUtc
    // vržejo TypeError na pokvarjen vnos — ista strogost kot na zaslonu.
    const dan = terminDatumLabel(v.datumZacetka, opcije.now)
    const status = scheduleTerminiStatusLabel(v.status)

    // Opis: fiksni vrstni red, manjkajoči podatki → vrstica izpuščena
    // (vzorec deljenega besedila R167 — prejemnik vidi samo resnične podatke).
    const opis = [
      `Dan: ${dan}`,
      v.strankaIme ? `Stranka: ${v.strankaIme}` : null,
      v.ekipaIme ? `Ekipa: ${v.ekipaIme}` : null,
      v.monterIme ? `Monter: ${v.monterIme}` : null,
      typeof v.predvideneUre === 'number' && Number.isInteger(v.predvideneUre) && v.predvideneUre >= 0
        ? `Predvidene ure: ${v.predvideneUre}`
        : null,
      `Status: ${status}`,
    ]
      .filter(Boolean)
      .join('\n')

    lines.push(
      'BEGIN:VEVENT',
      `UID:termin-${v.id}@roksal`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${icsUtc(v.datumZacetka)}`,
      `DTEND:${icsKonec(v)}`,
      `SUMMARY:${icsEscape(`Montaža${v.projektIme ? `: ${v.projektIme}` : ''}`)}`,
      `LOCATION:${icsEscape(v.lokacija || v.strankaNaslov || '')}`,
      `DESCRIPTION:${icsEscape(opis)}`,
      `STATUS:${icsStatus(v.status)}`,
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return {
    ics: lines.map(icsFold).join('\r\n') + '\r\n',
    dogodkov: vrstice.length,
  }
}

/** Deterministično ime datoteke: Termini-7-dni_<YYYY-MM-DD>.ics (isti obseg
 *  kot kartica in CSV izvoz R171 — ločeno od logističnega
 *  'roksal-montaze-<datum>.ics' (R139), da se datoteki ne preglasita). */
export function terminiIcsFilename(isoDatum: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDatum)) {
    throw new TypeError(`terminiIcsFilename: pričakovan ISO datum (YYYY-MM-DD), ne ${String(isoDatum)}`)
  }
  return `Termini-7-dni_${isoDatum}.ics`
}
