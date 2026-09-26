// R159 — izvoz seznama strank (CRM) v CSV.
// ---------------------------------------------------------------------------
// CRM tab je doslej imel SAMO zaslonski pogled (kanban + filtri + podrobnosti)
// — pisarniška raba (pošiljanje seznama, mail-merge, nadaljnja obdelava v
// Excelu) ni imela podatkovnega izvoza. Enak vzorec kot nagibi-csv (R157) in
// punch-csv (R158): BOM za Excel, escape navedkov, deterministično ime.
//
// Ločilo: vejica (,) — usklajeno z novostjo izvozov (nagibi, zapisnik);
// vsa besedilna polja citirana (RFC 4180, narekovaj podvojen). Starejši izvozi
// (zaloga/računi/logistika, R136) rabijo `;` + decimalno vejico za števila;
// ta izvoz je seznam strank (pretežno besedilo), zato sledi novejši družini.
//
// Načela:
//  • Determinizem: ista vhodna polja → enak izhod (brez Math.random/Date.now
//    v sami funkciji; datum v imenu datoteke prihaja kot parameter).
//  • Iskrenost: status se preslika v ISTA besedila, ki jih vidi UI
//    (Aktiven/Neaktiven/Potencialen/Arhiviran — STATUS_LABELS v crm-tab.tsx);
//    neznana vrednost → fail-closed TypeError, ne tiho ugibanje.
//    Null polja → prazen stolpec (nikoli 'null' besedilo, nikoli '—').
//    Števila (LTV, zaklenjeni, projekti) kot cela števila brez ločil —
//    podatkovno uporabno (Excel izračuni), brez izmišljenih decimalk.

export type CrmStatus = 'AKTIVEN' | 'NEAKTIVEN' | 'POTENCIALEN' | 'ARHIVIRAN'

/** Isti besedili kot STATUS_LABELS v crm-tab.tsx (en vir resnice za izvoz in UI). */
export const CRM_STATUS_LABELS: Record<CrmStatus, string> = {
  AKTIVEN: 'Aktiven',
  NEAKTIVEN: 'Neaktiven',
  POTENCIALEN: 'Potencialen',
  ARHIVIRAN: 'Arhiviran',
}

export interface CrmCsvRow {
  ime: string
  naslov: string
  status: string
  kontaktnaOseba: string | null
  telefon: string | null
  email: string | null
  kategorija: string | null
  opomnikDatum: string | null
  opomnikOpis: string | null
  zadnjiKontakt: string | null
  skupajProjektov: number
  ltv: number
  zaklenjeni: number
  opombeCRM: string | null
}

const CSV_HEADER =
  'Ime,Naslov,Status,Kontaktna oseba,Telefon,E-pošta,Kategorija,Opomnik datum,Opomnik opis,Zadnji kontakt,Projekti,LTV (EUR),Zaklenjeni (EUR),Opombe CRM'

function quoteField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

/** ISO datum → sl prikaz (DD.MM.YYYY). Date-only ISO (YYYY-MM-DD) se obdela
 * brez Date API-ja (100 % deterministično, neodvisno od časovnega pasu);
 * polni ISO z apisuje prek Date in sl-SI locale (isti vzorec kot nagibi/zapisnik). */
function formatDatum(iso: string): string {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (dateOnly) {
    return `${dateOnly[3]}.${dateOnly[2]}.${dateOnly[1]}`
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    throw new TypeError(`buildCrmCsv: neveljaven datum: ${String(iso)}`)
  }
  return d.toLocaleDateString('sl-SI')
}

/** Število → cela števila brez ločil (podatkovni stolpec za Excel). */
function formatEvr(n: number, polje: string): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new TypeError(`buildCrmCsv: neveljavno število v polju ${polje}: ${String(n)}`)
  }
  return String(Math.round(n))
}

export function buildCrmCsv(
  rows: readonly CrmCsvRow[],
): { csv: string; vrstic: number } {
  if (!Array.isArray(rows)) {
    throw new TypeError('buildCrmCsv: pričakovano polje strank')
  }
  const lines = rows.map((r) => {
    if (typeof r.ime !== 'string' || r.ime.trim() === '') {
      throw new TypeError(`buildCrmCsv: neveljaven ime: ${String(r.ime)}`)
    }
    if (typeof r.naslov !== 'string' || r.naslov.trim() === '') {
      throw new TypeError(`buildCrmCsv: neveljaven naslov: ${String(r.naslov)}`)
    }
    const statusLabel = CRM_STATUS_LABELS[r.status as CrmStatus]
    if (statusLabel === undefined) {
      throw new TypeError(`buildCrmCsv: neznani status: ${String(r.status)}`)
    }
    if (typeof r.skupajProjektov !== 'number' || !Number.isFinite(r.skupajProjektov)) {
      throw new TypeError(`buildCrmCsv: neveljaven skupajProjektov: ${String(r.skupajProjektov)}`)
    }
    const opomnikDatum = r.opomnikDatum === null || r.opomnikDatum === '' ? '' : formatDatum(r.opomnikDatum)
    const zadnjiKontakt = r.zadnjiKontakt === null || r.zadnjiKontakt === '' ? '' : formatDatum(r.zadnjiKontakt)
    const celice = [
      r.ime,
      r.naslov,
      statusLabel,
      r.kontaktnaOseba ?? '',
      r.telefon ?? '',
      r.email ?? '',
      r.kategorija ?? '',
      opomnikDatum,
      r.opomnikOpis ?? '',
      zadnjiKontakt,
      String(r.skupajProjektov),
      formatEvr(r.ltv, 'ltv'),
      formatEvr(r.zaklenjeni, 'zaklenjeni'),
      r.opombeCRM ?? '',
    ]
    return celice.map(quoteField).join(',')
  })
  // BOM (\uFEFF) za Excel UTF-8 prepoznavo — enako kot izvozi meritev/nagibov/zapisnika.
  const csv = '\uFEFF' + CSV_HEADER + (lines.length > 0 ? '\n' + lines.join('\n') : '')
  return { csv, vrstic: lines.length }
}

/** Deterministično ime datoteke: crm_stranke_<YYYY-MM-DD>.csv
 * (CRM ni vezan na projekt — globalen seznam strank.) */
export function crmCsvFilename(isoDatum: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDatum)) {
    throw new TypeError('crmCsvFilename: pričakovan ISO datum (YYYY-MM-DD)')
  }
  return `crm_stranke_${isoDatum}.csv`
}
