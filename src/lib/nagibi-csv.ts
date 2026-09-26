// R157 — izvoz zgodovine nagibov (digitalna libela) v CSV.
// ---------------------------------------------------------------------------
// Izvlečeno iz inclinometer-tab.tsx v čisto knjižnico, da je logika testirljiva
// in enaka vzorcem drugih izvozov (meritve: BOM + escape navedkov + 'text/csv').
//
// Načela:
//  • Determinizem: ista vhodna polja → enak izhod (brez Math.random/Date.now
//    v sami funkciji; datum v imenu datoteke prihaja kot parameter).
//  • Iskrenost: brez izmišljenih vrednosti — smer je "Levo-desno" (Y),
//    "Naprej-nazaj" (X), katerakoli druga/null vrednost → PRAZEN stolpec.
//    Kot se formatira z točno 1 decimalko (kot v UI), lokacija se escape-ira.

export interface NagibiCsvRow {
  kotStopinje: number
  smer: string | null
  lokacija: string | null
  createdAt: string
}

export function buildNagibiCsv(
  rows: readonly NagibiCsvRow[],
): { csv: string; vrstic: number } {
  if (!Array.isArray(rows)) {
    throw new TypeError('buildNagibiCsv: pričakovano polje nagibov')
  }
  const header = 'Datum,Ura,Kot (stopinje),Smer,Lokacija'
  const lines = rows.map((r) => {
    if (typeof r.createdAt !== 'string' || Number.isNaN(new Date(r.createdAt).getTime())) {
      throw new TypeError(`buildNagibiCsv: neveljaven createdAt: ${String(r.createdAt)}`)
    }
    if (typeof r.kotStopinje !== 'number' || !Number.isFinite(r.kotStopinje)) {
      throw new TypeError(`buildNagibiCsv: neveljaven kotStopinje: ${String(r.kotStopinje)}`)
    }
    const d = new Date(r.createdAt)
    const datum = d.toLocaleDateString('sl-SI')
    const ura = d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
    const kot = r.kotStopinje.toFixed(1)
    const smer =
      r.smer === 'Y' ? 'Levo-desno' : r.smer === 'X' ? 'Naprej-nazaj' : ''
    const lokacija = (r.lokacija ?? '').replace(/"/g, '""')
    return `${datum},${ura},${kot},"${smer}","${lokacija}"`
  })
  // BOM (\uFEFF) za Excel UTF-8 prepoznavo — enako kot izvoz meritev.
  const csv = '\uFEFF' + header + (lines.length > 0 ? '\n' + lines.join('\n') : '')
  return { csv, vrstic: lines.length }
}

/** Deterministično ime datoteke: nagibi_<projectId>_<YYYY-MM-DD>.csv */
export function nagibiCsvFilename(projectId: string, isoDatum: string): string {
  if (!projectId || !/^\d{4}-\d{2}-\d{2}$/.test(isoDatum)) {
    throw new TypeError('nagibiCsvFilename: pričakovan projectId in ISO datum (YYYY-MM-DD)')
  }
  return `nagibi_${projectId}_${isoDatum}.csv`
}
