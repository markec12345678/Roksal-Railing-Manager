// R164 — izvoz seznama projektov (dashboard "Projekti" kartica) v CSV.
// ---------------------------------------------------------------------------
// Projektna kartica na dashboardu je doslej imela SAMO zaslonski pogled —
// tedenski pregled cevovoda (načrtovano → v teku → zaključeno), mail-merge po
// strankah in arhiviranje v Excel niso imela podatkovnega izvoza. To je
// manjkajoči steber družine izvozov: vodja (R163) = dnevni pregled, CRM
// (R159) = stranke, ponudbe (R161) = sledenje ponudb — projekti = CELOTEN
// cevovod po projektu. Enak vzorec kot nagibi-csv (R157), punch-csv (R158),
// crm-csv (R159), ekipa (R160), ponudbe-csv (R161), audit-csv (R162),
// vodja-csv (R163): BOM za Excel, escape navedkov (RFC 4180), deterministično
// ime datoteke.
//
// Ločilo: vejica (,) — usklajeno z družino; vsa besedilna polja citirana
// (narekovaj podvojen).
//
// Načela:
//  • Determinizem: ista vhodna polja → enak izhod (brez Math.random/Date.now
//    v sami funkciji). Izvoz NE vsebuje "dan do montaže" čipa, ker je ta
//    odvisen od trenutka ("Danes" v CSV-ju odprt prihodnji mesec bi bil
//    neresnica) — namesto tega izvozi IZVORNO resnico čipa: datum montaže
//    (DD.MM.YYYY). Datum v imenu datoteke prihaja kot parameter (todayStamp).
//  • Iskrenost: status se preslika v ISTA besedila, ki jih vidi UI
//    (PROJEKTI_STATUS_LABELS — en vir resnice za izvoz in zaslonsko značko;
//    dashboard-tab je REFAKTORIRAN na to konstanto, precedens R161 ponudbe);
//    neznana vrednost → fail-closed TypeError, ne tiho ugibanje.
//    Null polja (stranka/naslov/datum) → prazen stolpec (nikoli 'null'
//    besedilo, nikoli '—' izmišljivina v podatkih).
//  • Fail-closed: ne-polje, manjkajoč naziv, neznan status, neveljaven datum
//    (strukturna validacija mesec 01–12, dan 01–31 — vzorec '2026-13-99',
//    vrzel ujeta v testih), ne-niz v besedilnem polju → TypeError.

export type ProjektiStatus = 'NACRTOVANO' | 'V_TEKU' | 'ZAKLJUCENO' | 'USTAVLJENO' | 'ZA_MONTAZO' | 'V_IZDELAVI' | 'MONTIRANO'

/** Isti besedili kot statusLabels v dashboard-tab.tsx (en vir resnice za izvoz in UI —
 *  dashboard-tab je refaktoriran na to konstanto) IN z boss-report-pdf.ts STATUS_SL
 *  (E2E R164: baza vsebuje tudi MONTIRANO — fail-closed izvoz je ujel, da je UI
 *  statusLabels imel samo 4 od 7 statusov iz prisma enum ProjectStatus). */
export const PROJEKTI_STATUS_LABELS: Record<ProjektiStatus, string> = {
  NACRTOVANO: 'Načrtovano',
  V_TEKU: 'V teku',
  ZA_MONTAZO: 'Za montažo',
  V_IZDELAVI: 'V izdelavi',
  MONTIRANO: 'Montirano',
  ZAKLJUCENO: 'Zaključeno',
  USTAVLJENO: 'Ustavljeno',
}

export interface ProjektiCsvRow {
  nazivProjekta: string
  status: string
  strankaIme: string | null
  strankaNaslov: string | null
  datumMontaze: string | null
}

const CSV_HEADER = 'Naziv projekta,Status,Stranka,Naslov,Datum montaže'

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
    throw new TypeError(`buildProjektiCsv: neveljaven datum v polju ${polje}: ${String(iso)}`)
  }
  return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`
}

/** Prikaz datuma za izvoz: DD.MM.YYYY iz ISO (date-only ali polni ISO z uro).
 *  Brez Date API-ja za date-only → 100 % deterministično neodvisno od TZ. */
function formatDatum(iso: string, polje: string): string {
  const only = dateOnlyIso(iso, polje)
  return `${only.slice(8, 10)}.${only.slice(5, 7)}.${only.slice(0, 4)}`
}

/** Besedilni stolpec: string → citiran, null → prazen (nikoli 'null'). */
function textField(value: string | null, polje: string): string {
  if (value === null) return ''
  if (typeof value !== 'string') {
    throw new TypeError(`buildProjektiCsv: polje ${polje} mora biti niz ali null: ${String(value)}`)
  }
  return quoteField(value)
}

export function buildProjektiCsv(rows: readonly ProjektiCsvRow[]): { csv: string; vrstic: number } {
  if (!Array.isArray(rows)) {
    throw new TypeError('buildProjektiCsv: pričakovano polje projektov')
  }
  const lines = rows.map((r) => {
    if (typeof r.nazivProjekta !== 'string' || r.nazivProjekta.trim() === '') {
      throw new TypeError(`buildProjektiCsv: manjka nazivProjekta: ${String(r.nazivProjekta)}`)
    }
    const statusLabel = PROJEKTI_STATUS_LABELS[r.status as ProjektiStatus]
    if (statusLabel === undefined) {
      throw new TypeError(`buildProjektiCsv: neznan status projekta: ${String(r.status)}`)
    }
    const montaza = r.datumMontaze === null ? '' : formatDatum(r.datumMontaze, 'datumMontaze')
    return [
      quoteField(r.nazivProjekta),
      quoteField(statusLabel),
      textField(r.strankaIme, 'strankaIme'),
      textField(r.strankaNaslov, 'strankaNaslov'),
      montaza,
    ].join(',')
  })
  // BOM (\uFEFF) za Excel UTF-8 prepoznavo — enako kot družina izvozov.
  const csv = '\uFEFF' + CSV_HEADER + (lines.length > 0 ? '\n' + lines.join('\n') : '')
  return { csv, vrstic: lines.length }
}

/** Deterministično ime datoteke: projekti_<YYYY-MM-DD>.csv */
export function projektiCsvFilename(isoDatum: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDatum)) {
    throw new TypeError('projektiCsvFilename: pričakovan ISO datum (YYYY-MM-DD)')
  }
  return `projekti_${isoDatum}.csv`
}

/** Slovenska sklanjatev za aria-label gumba: 1/21/31 … projekt, 2/22 … projekta,
 *  3/4/23/24 … projekti, ostale (5–11, 12–14, 15–20 …) projektov.
 *  Deterministično, testirano. */
export function projektiLabel(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError(`projektiLabel: pričakovano ne-negativno celo število: ${String(n)}`)
  }
  const enice = n % 10
  const zadnjiDve = n % 100
  if (enice === 1 && zadnjiDve !== 11) return `${n} projekt`
  if (enice === 2 && zadnjiDve !== 12) return `${n} projekta`
  if ((enice === 3 || enice === 4) && zadnjiDve !== 13 && zadnjiDve !== 14) {
    return `${n} projekti`
  }
  return `${n} projektov`
}
