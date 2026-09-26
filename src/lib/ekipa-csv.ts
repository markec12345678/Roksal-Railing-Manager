// R160 — izvoz seznama ekipe (življenjski cikl računov) v CSV.
// ---------------------------------------------------------------------------
// Ekipa tab (team-tab.tsx) je doslej imel SAMO zaslonski pogled — pisarniška
// raba (kontaktni seznam za SMS/telefon, arhiv stanja računov, obdelava v
// Excelu) ni imela podatkovnega izvoza. Enak vzorec kot crm-csv (R159),
// punch-csv (R158) in nagibi-csv (R157): BOM za Excel, citiranje po RFC 4180,
// deterministično ime datoteke.
//
// Ločilo: vejica (,) — usklajeno z novejšo družino izvozov (nagibi, zapisnik,
// CRM); vsa besedilna polja citirana (narekovaj podvojen).
//
// Načela:
//  • EN VIR RESNICE: status računa se izračuna z ekipaStatusOf() — ISTA
//    prednost (deaktiviran > zaklenjen > povabilo > aktiven) kot značka v
//    UI; vloga z ROLE_LABEL-i, ki jih vidi UI. Izvoženi navedek = zaslon.
//  • Determinizem: ista vhodna polja → enak izhod (datum v imenu datoteke
//    prihaja kot parameter; v sami funkciji ni ura/naključja).
//  • Iskrenost: neznana vloga → fail-closed TypeError, ne tiho ugibanje.
//    Null polja (telefon, zadnja aktivnost) → prazen stolpec (nikoli 'null'
//    besedilo, nikoli '—'). Datumi → sl-SI prikaz (DD.MM.YYYY).

export interface EkipaLifecycle {
  deactivated: boolean
  locked: boolean
  invited: boolean
  inviteExpired: boolean
}

/** Statusi v ISTIH besedilih kot značke v team-tab.tsx (en vir resnice). */
export const EKIPA_STATUSI = [
  'Deaktiviran',
  'Zaklenjen',
  'Povabilo poteklo',
  'Čaka aktivacijo',
  'Aktiven',
] as const

export type EkipaStatus = (typeof EKIPA_STATUSI)[number]

/** Isti prednostni red kot ternarni niz značke v team-tab.tsx. */
export function ekipaStatusOf(l: EkipaLifecycle): EkipaStatus {
  if (l.deactivated) return 'Deaktiviran'
  if (l.locked) return 'Zaklenjen'
  if (l.invited) return l.inviteExpired ? 'Povabilo poteklo' : 'Čaka aktivacijo'
  return 'Aktiven'
}

/** Isti naslovi kot ROLE_LABEL v team-tab.tsx (en vir resnice za izvoz in UI). */
export const EKIPA_VLOGE: Record<string, string> = {
  ADMIN: 'Admin',
  VODJA: 'Vodja',
  MONTER: 'Monter',
  SKLADISCE: 'Skladišče',
}

export interface EkipaCsvRow {
  ime: string
  email: string
  vloga: string
  lifecycle: EkipaLifecycle
  telefon: string | null
  lastActive: string | null
  createdAt: string
}

const CSV_HEADER =
  'Ime,E-pošta,Vloga,Status,Telefon,Zadnja aktivnost,Ustvarjen'

function quoteField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

/** ISO datum → sl prikaz (DD.MM.YYYY). Polni ISO z apisuje prek Date +
 * sl-SI locale (isti vzorec kot crm/nagibi/zapisnik); neveljaven → fail-closed. */
function formatDatum(iso: string, polje: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    throw new TypeError(`buildEkipaCsv: neveljaven datum v polju ${polje}: ${String(iso)}`)
  }
  return d.toLocaleDateString('sl-SI')
}

export function buildEkipaCsv(
  rows: readonly EkipaCsvRow[],
): { csv: string; vrstic: number } {
  if (!Array.isArray(rows)) {
    throw new TypeError('buildEkipaCsv: pričakovano polje članov ekipe')
  }
  const lines = rows.map((r) => {
    if (typeof r.ime !== 'string' || r.ime.trim() === '') {
      throw new TypeError(`buildEkipaCsv: neveljaven ime: ${String(r.ime)}`)
    }
    if (typeof r.email !== 'string' || r.email.trim() === '') {
      throw new TypeError(`buildEkipaCsv: neveljaven e-poštni naslov: ${String(r.email)}`)
    }
    const vlogaLabel = EKIPA_VLOGE[r.vloga]
    if (vlogaLabel === undefined) {
      throw new TypeError(`buildEkipaCsv: neznana vloga: ${String(r.vloga)}`)
    }
    if (!r.lifecycle || typeof r.lifecycle !== 'object') {
      throw new TypeError('buildEkipaCsv: manjkajoč lifecycle')
    }
    const status = ekipaStatusOf(r.lifecycle)
    const celice = [
      r.ime,
      r.email,
      vlogaLabel,
      status,
      r.telefon ?? '',
      r.lastActive === null || r.lastActive === '' ? '' : formatDatum(r.lastActive, 'lastActive'),
      formatDatum(r.createdAt, 'createdAt'),
    ]
    return celice.map(quoteField).join(',')
  })
  // BOM (\uFEFF) za Excel UTF-8 prepoznavo — enako kot izvozi meritev/nagibov/zapisnika/CRM.
  const csv = '\uFEFF' + CSV_HEADER + (lines.length > 0 ? '\n' + lines.join('\n') : '')
  return { csv, vrstic: lines.length }
}

/** Deterministično ime datoteke: ekipa_<YYYY-MM-DD>.csv
 * (Ekipa ni vezana na projekt — globalen seznam računov, kot CRM stranke.) */
export function ekipaCsvFilename(isoDatum: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDatum)) {
    throw new TypeError('ekipaCsvFilename: pričakovan ISO datum (YYYY-MM-DD)')
  }
  return `ekipa_${isoDatum}.csv`
}
