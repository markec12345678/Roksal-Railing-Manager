// R161 — izvoz sledenja ponudb (quote follow-up) v CSV.
// ---------------------------------------------------------------------------
// Kartica "Ponudbe — sledenje" (quote-followup.tsx, v CRM tabu) je doslej
// imela SAMO zaslonski pogled — pisarniška raba (tedenski pregled klicev,
// mail-merge, nadaljnja obdelava v Excelu) ni imela podatkovnega izvoza.
// Enak vzorec kot nagibi-csv (R157), punch-csv (R158) in crm-csv (R159):
// BOM za Excel, escape navedkov (RFC 4180), deterministično ime datoteke.
//
// Ločilo: vejica (,) — usklajeno z novejšo družino izvozov; vsa besedilna
// polja citirana (narekovaj podvojen).
//
// Načela:
//  • Determinizem: ista vhodna polja + ISTI referenčni datum → enak izhod
//    (brez Math.random/Date.now v sami funkciji). "Stanje spomnika" je odvisno
//    od trenutka — zato referenčni datum (danes, YYYY-MM-DD) pride KOT
//    PARAMETER; testi ga dajo fiksno, UI passing današnji dan. Datum v imenu
//    datoteke prav tako prihaja kot parameter (todayStamp()).
//  • Iskrenost: status se preslika v ISTA besedila, ki jih vidi UI
//    (PONUDBE_STATUS_LABELS — en vir resnice za izvoz in zaslonsko značko);
//    neznana vrednost → fail-closed TypeError, ne tiho ugibanje.
//    Null polja → prazen stolpec (nikoli 'null' besedilo, nikoli '—').
//  • "Stanje spomnika" računa na DNEVNI ravni (datum proti datumu, brez ure)
//    — enak pogled kot značka v kartici (zapadlo / danes / kmalu / planirano
//    / brez spomnika). Računanje je čisto stringovno (YYYY-MM-DD primerjava),
//    100 % deterministično neodvisno od časovnega pasu.

export type PonudbaStatus = 'NACRTOVANO' | 'V_TEKU' | 'ZAKLJUCENO' | 'USTAVLJENO'

/** Isti besedili kot STATUS_LABEL v quote-followup.tsx (en vir resnice za izvoz in UI). */
export const PONUDBE_STATUS_LABELS: Record<PonudbaStatus, string> = {
  NACRTOVANO: 'Načrtovano',
  V_TEKU: 'V teku',
  ZAKLJUCENO: 'Zaključeno',
  USTAVLJENO: 'Ustavljeno',
}

export interface PonudbaCsvRow {
  nazivProjekta: string
  stranka: string | null
  status: string
  followUpDate: string | null
  followUpOpomba: string | null
  datumMontaze: string | null
}

const CSV_HEADER = 'Projekt,Stranka,Status,Stanje spomnika,Spomnik datum,Spomnik opomba,Datum montaže'

function quoteField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

/** Iz polnega ISO niza izvleče samo datumski del (YYYY-MM-DD) — deterministično.
 *  Datum-only vhod (YYYY-MM-DD) ostane nespremenjen. Strukturna validacija:
 *  mesec 01–12, dan 01–31 → nemogoči datumi (2026-13-99) so fail-closed. */
function dateOnlyIso(iso: string, polje: string): string {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  const mesec = dateOnly ? Number(dateOnly[2]) : 0
  const dan = dateOnly ? Number(dateOnly[3]) : 0
  if (!dateOnly || mesec < 1 || mesec > 12 || dan < 1 || dan > 31) {
    throw new TypeError(`buildPonudbeCsv: neveljaven datum v polju ${polje}: ${String(iso)}`)
  }
  return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`
}

/** Razlika v dnevih: a − b, oba YYYY-MM-DD (čisto stringovno/deterministično). */
function dniRazlika(a: string, b: string): number {
  const ta = Date.UTC(Number(a.slice(0, 4)), Number(a.slice(5, 7)) - 1, Number(a.slice(8, 10)))
  const tb = Date.UTC(Number(b.slice(0, 4)), Number(b.slice(5, 7)) - 1, Number(b.slice(8, 10)))
  return Math.round((ta - tb) / 86400000)
}

/** Stanje spomnika na dnevni ravni — enaka logika kot barvne značke v kartici:
 *  Zapadel (< danes), Danes (= danes), Kmalu (1–3 dni), Planirano (> 3 dni),
 *  Brez spomnika (null). */
export function stanjeSpomnika(followUpDate: string | null, danesIso: string): string {
  if (followUpDate === null) return 'Brez spomnika'
  const spomnik = dateOnlyIso(followUpDate, 'followUpDate')
  const razlika = dniRazlika(spomnik, danesIso)
  if (razlika < 0) return 'Zapadel'
  if (razlika === 0) return 'Danes'
  if (razlika <= 3) return 'Kmalu'
  return 'Planirano'
}

/** Prikaz datuma za izvoz: DD.MM.YYYY iz ISO (date-only ali polni ISO z uro).
 *  Brez Date API-ja za date-only → 100 % deterministično neodvisno od TZ. */
function formatDatum(iso: string, polje: string): string {
  const only = dateOnlyIso(iso, polje)
  return `${only.slice(8, 10)}.${only.slice(5, 7)}.${only.slice(0, 4)}`
}

export function buildPonudbeCsv(
  rows: readonly PonudbaCsvRow[],
  danesIso: string,
): { csv: string; vrstic: number } {
  if (!Array.isArray(rows)) {
    throw new TypeError('buildPonudbeCsv: pričakovano polje ponudb')
  }
  if (typeof danesIso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(danesIso)) {
    throw new TypeError('buildPonudbeCsv: pričakovan referenčni datum danes (YYYY-MM-DD)')
  }
  const lines = rows.map((r) => {
    if (typeof r.nazivProjekta !== 'string' || r.nazivProjekta.trim() === '') {
      throw new TypeError(`buildPonudbeCsv: manjka nazivProjekta: ${String(r.nazivProjekta)}`)
    }
    const statusLabel = PONUDBE_STATUS_LABELS[r.status as PonudbaStatus]
    if (statusLabel === undefined) {
      throw new TypeError(`buildPonudbeCsv: neznan status ponudbe: ${String(r.status)}`)
    }
    const spomnik = r.followUpDate === null ? '' : formatDatum(r.followUpDate, 'followUpDate')
    const montaza = r.datumMontaze === null ? '' : formatDatum(r.datumMontaze, 'datumMontaze')
    const stanje = stanjeSpomnika(r.followUpDate, danesIso)
    const stranka = r.stranka === null ? '' : quoteField(r.stranka)
    const opomba = r.followUpOpomba === null ? '' : quoteField(r.followUpOpomba)
    return [
      quoteField(r.nazivProjekta),
      stranka,
      quoteField(statusLabel),
      quoteField(stanje),
      spomnik,
      opomba,
      montaza,
    ].join(',')
  })
  // BOM (\uFEFF) za Excel UTF-8 prepoznavo — enako kot družina izvozov.
  const csv = '\uFEFF' + CSV_HEADER + (lines.length > 0 ? '\n' + lines.join('\n') : '')
  return { csv, vrstic: lines.length }
}

/** Deterministično ime datoteke: ponudbe_<YYYY-MM-DD>.csv */
export function ponudbeCsvFilename(isoDatum: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDatum)) {
    throw new TypeError('ponudbeCsvFilename: pričakovan ISO datum (YYYY-MM-DD)')
  }
  return `ponudbe_${isoDatum}.csv`
}

/** Slovenska sklanjatev za aria-label gumba: 1/21/31 … ponudba, 2/22 … ponudbi,
 *  3/4/23/24 … ponudbe, ostale (5–11, 12–14, 15–20 …) ponudb.
 *  Deterministično, testirano. */
export function ponudbeLabel(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError(`ponudbeLabel: pričakovano ne-negativno celo število: ${String(n)}`)
  }
  const enice = n % 10
  const zadnjiDve = n % 100
  if (enice === 1 && zadnjiDve !== 11) return `${n} ponudba`
  if (enice === 2 && zadnjiDve !== 12) return `${n} ponudbi`
  if ((enice === 3 || enice === 4) && zadnjiDve !== 13 && zadnjiDve !== 14) {
    return `${n} ponudbe`
  }
  return `${n} ponudb`
}
