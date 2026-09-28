// R238 — izvoz PRODAJNE PLOŠČE (deal pipeline) v CSV — zaključek 'izvozi'
// družine (P1-c). ---------------------------------------------------------------------------
// Prodajna plošča (R178 kanban) je bila po R237 EDINA podatkovno-gostota
// površina brez izvoza. Dashboard Projekti CSV (R164) pokriva složbeni
// pregled (naziv/status/stranka/naslov/datum montaže) — plošča pa nosi
// FINANČNO dimenzijo, ki je R164 NIMA: vrednost ponudbe (€), spomnik
// (follow-up datum), podpis (deal lock). To ni dvojnik — to je vodjev
// lijakov prikaz: koliko je v obdelavi, kaj je podpisano, kje spomniki.
//
// Dialekt: PODPIČJE (;) + decimalna vejica pri VREDNOSTI — R136 csvField
// pogodba (Excel SI: vejica je decimalno ločilo, zato `,` razdelilnik ne
// pride v poštev takoj ko je v datoteki številski stolpec). BOM + CRLF
// (RFC 4180) prek toCsv iz csv-export.
//
// Načela (družina R157–R237):
//  • ENA resnica: status besedila = PROJEKTI_STATUS_LABELS (ISTI vir kot
//    dashboard značka + boss-report PDF + R164 izvoz — štirje pogledi, ena
//    resnica); izvoz = TOČNO tisto, kar uporabnik vidi na plošči (isti
//    filter — stranka); podpis = ISTA resnica kot ključavnica na kartici.
//  • Iskrenost: spomnik se izvozi kot IZVORNA resnica — DATUM (DD.MM.YYYY),
//    NIKOLI relativni čip ('zapadel 3 dni' je odvisen od trenutka — R164
//    precedens 'dan do montaže'); manjkajoče polje → PRAZEN stolpec
//    (nikoli 'null', nikoli izmišljen 0).
//  • Fail-closed: ne-polje, manjkajoč naziv, neznan status, neveljaven datum
//    (mesec 01–12, dan 01–31 — strukturna validacija, vzorec R164),
//    ne-številska vrednost, ne-končna vrednost (NaN/∞ — csvField bi tiho
//    vrnil prazno, to je SILENT DEGRADACIJA — tukaj TypeError), ne-logičen
//    podpis → TypeError z indeksom krivca.
//  • Determinizem: brez Date.now/Math.random v libu; datum v imenu datoteke
//    pride kot parameter (todayStamp); ista vhodna polja = ista datoteka.

import { PROJEKTI_STATUS_LABELS, type ProjektiStatus } from './projekti-csv'
import { toCsv, type CsvValue } from './csv-export'

export interface PloscaCsvRow {
  nazivProjekta: string
  status: string
  strankaIme: string | null
  /** Ponudbena vrednost v EUR — ISTA resnica kot znesek na kartici plošče. */
  vrednostEur: number | null
  /** Follow-up spomnik — ISO datum ali polni ISO niz, ali null. */
  spomnik: string | null
  /** Datum montaže — ISO datum ali polni ISO niz, ali null. */
  datumMontaze: string | null
  /** Deal lock — ISTA resnica kot podpis ključavnica na kartici. */
  podpisano: boolean
}

const CSV_HEADER = ['Naziv projekta', 'Status', 'Stranka', 'Vrednost (€)', 'Spomnik', 'Datum montaže', 'Podpisano']

/** Iz polnega ISO niza izvleče samo datumski del (YYYY-MM-DD) — deterministično.
 *  Datum-only vhod (YYYY-MM-DD) ostane nespremenjen. Strukturna validacija:
 *  mesec 01–12, dan 01–31 → nemogoči datumi (2026-13-99) so fail-closed
 *  (vzorec R164 dateOnlyIso — isti standard napake). */
function dateOnlyIso(iso: string, polje: string, indeks: number): string {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  const mesec = dateOnly ? Number(dateOnly[2]) : 0
  const dan = dateOnly ? Number(dateOnly[3]) : 0
  if (!dateOnly || mesec < 1 || mesec > 12 || dan < 1 || dan > 31) {
    throw new TypeError(`buildPloscaCsv: neveljaven datum v polju ${polje} (vrstica ${indeks}): ${String(iso)}`)
  }
  return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`
}

/** Prikaz datuma za izvoz: DD.MM.YYYY iz ISO — brez Date API-ja za date-only
 *  → 100 % deterministično neodvisno od časovnega pasu (vzorec R164). */
function formatDatum(iso: string, polje: string, indeks: number): string {
  const only = dateOnlyIso(iso, polje, indeks)
  return `${only.slice(8, 10)}.${only.slice(5, 7)}.${only.slice(0, 4)}`
}

/** Besedilni stolpec: string → kot je (toCsv citira po potrebi), null →
 *  prazen (nikoli 'null' besedilo), ne-niz → fail-closed. */
function textField(value: string | null, polje: string, indeks: number): CsvValue {
  if (value === null) return ''
  if (typeof value !== 'string') {
    throw new TypeError(`buildPloscaCsv: polje ${polje} (vrstica ${indeks}) mora biti niz ali null: ${String(value)}`)
  }
  return value
}

/** Številski stolpec (€): number → number (toCsv: decimalna vejica, 2
 *  decimalni mesti), null → prazen, NE-number ALI ne-končno → fail-closed
 *  (csvField bi tiho vrnil '' za NaN/∞ — silent degradation je prepovedana). */
function steviloField(value: number | null, indeks: number): CsvValue {
  if (value === null) return ''
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`buildPloscaCsv: vrednostEur (vrstica ${indeks}) mora biti končno število ali null: ${String(value)}`)
  }
  return value
}

/** Podpisani stolpec: boolean → 'DA'/'NE' (iskrena državna resnica — ključavnica
 *  je stanje, ne alarm; drugačen od alarmnih stolpcev 'DA'/prazno), sicer
 *  fail-closed (nikoli tiho pretvarjanje truthy/falsy). */
function logičnoField(value: boolean, indeks: number): CsvValue {
  if (typeof value !== 'boolean') {
    throw new TypeError(`buildPloscaCsv: podpisano (vrstica ${indeks}) mora biti logična vrednost: ${String(value)}`)
  }
  return value ? 'DA' : 'NE'
}

export function buildPloscaCsv(rows: readonly PloscaCsvRow[]): { csv: string; vrstic: number } {
  if (!Array.isArray(rows)) {
    throw new TypeError('buildPloscaCsv: pričakovano polje projektov')
  }
  const data: CsvValue[][] = rows.map((r, i) => {
    if (typeof r.nazivProjekta !== 'string' || r.nazivProjekta.trim() === '') {
      throw new TypeError(`buildPloscaCsv: manjka nazivProjekta (vrstica ${i}): ${String(r.nazivProjekta)}`)
    }
    const statusLabel = PROJEKTI_STATUS_LABELS[r.status as ProjektiStatus]
    if (statusLabel === undefined) {
      throw new TypeError(`buildPloscaCsv: neznan status projekta (vrstica ${i}): ${String(r.status)}`)
    }
    return [
      r.nazivProjekta,
      statusLabel,
      textField(r.strankaIme, 'strankaIme', i),
      steviloField(r.vrednostEur, i),
      r.spomnik === null ? '' : formatDatum(r.spomnik, 'spomnik', i),
      r.datumMontaze === null ? '' : formatDatum(r.datumMontaze, 'datumMontaze', i),
      logičnoField(r.podpisano, i),
    ]
  })
  // toCsv: BOM + CRLF + podpičje + citiranje po RFC 4180 + decimalna vejica.
  const csv = toCsv(CSV_HEADER, data)
  return { csv, vrstic: data.length }
}

/** Deterministično ime datoteke: plosca_<YYYY-MM-DD>.csv (ločen prefix od
 *  projekti_ R164 — dve različni rabi: složbeni pregled vs. prodajni lijak). */
export function ploscaCsvFilename(isoDatum: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDatum)) {
    throw new TypeError('ploscaCsvFilename: pričakovan ISO datum (YYYY-MM-DD)')
  }
  return `plosca_${isoDatum}.csv`
}
