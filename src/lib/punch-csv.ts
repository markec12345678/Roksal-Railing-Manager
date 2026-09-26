// R158 — izvoz prejemnega zapisnika (punch list) v CSV.
// ---------------------------------------------------------------------------
// Dopolnitev k obstoječemu PDF zapisniku (jsPDF): CSV je podatkovni izvoz
// (nadaljnja obdelava v Excelu/dnevnikih), enak vzorec kot nagibi-csv (R157)
// in izvoz meritev: BOM za Excel, escape navedkov, deterministično ime.
//
// Načela:
//  • Determinizem: ista vhodna polja → enak izhod (brez Math.random/Date.now
//    v sami funkciji; datum v imenu datoteke prihaja kot parameter).
//  • Iskrenost: status se preslika v ISTA besedila, ki jih vidi UI
//    (Odprto/Rešeno/Napaka — STATUS_META); neznana vrednost → fail-closed
//    TypeError, ne tiho ugibanje. Opomba null → prazen stolpec.

export type PunchStatus = 'open' | 'done' | 'issue'

export interface PunchCsvRow {
  naslov: string
  opomba: string | null
  status: PunchStatus
  createdAt: string
}

export const PUNCH_STATUS_LABELS: Record<PunchStatus, string> = {
  open: 'Odprto',
  done: 'Rešeno',
  issue: 'Napaka',
}

export function buildPunchCsv(
  rows: readonly PunchCsvRow[],
): { csv: string; vrstic: number } {
  if (!Array.isArray(rows)) {
    throw new TypeError('buildPunchCsv: pričakovano polje točk zapisnika')
  }
  const header = 'Datum,Naslov,Status,Opomba'
  const lines = rows.map((r) => {
    if (typeof r.createdAt !== 'string' || Number.isNaN(new Date(r.createdAt).getTime())) {
      throw new TypeError(`buildPunchCsv: neveljaven createdAt: ${String(r.createdAt)}`)
    }
    if (typeof r.naslov !== 'string' || r.naslov.trim() === '') {
      throw new TypeError(`buildPunchCsv: neveljaven naslov: ${String(r.naslov)}`)
    }
    const statusLabel = PUNCH_STATUS_LABELS[r.status as PunchStatus]
    if (statusLabel === undefined) {
      throw new TypeError(`buildPunchCsv: neznani status: ${String(r.status)}`)
    }
    const d = new Date(r.createdAt)
    const datum = d.toLocaleDateString('sl-SI')
    const naslov = r.naslov.replace(/"/g, '""')
    const opomba = (r.opomba ?? '').replace(/"/g, '""')
    return `${datum},"${naslov}","${statusLabel}","${opomba}"`
  })
  // BOM (\uFEFF) za Excel UTF-8 prepoznavo — enako kot izvoz meritev/nagibov.
  const csv = '\uFEFF' + header + (lines.length > 0 ? '\n' + lines.join('\n') : '')
  return { csv, vrstic: lines.length }
}

/** Deterministično ime datoteke: zapisnik_<projectId>_<YYYY-MM-DD>.csv */
export function punchCsvFilename(projectId: string, isoDatum: string): string {
  if (!projectId || !/^\d{4}-\d{2}-\d{2}$/.test(isoDatum)) {
    throw new TypeError('punchCsvFilename: pričakovan projectId in ISO datum (YYYY-MM-DD)')
  }
  return `zapisnik_${projectId}_${isoDatum}.csv`
}
