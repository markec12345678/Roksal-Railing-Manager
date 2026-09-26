// R162 — izvoz revizijske sledi (audit trail) v CSV.
// ---------------------------------------------------------------------------
// Revizijska sled je pravno pomembna podatkovna baza (kdo, kaj, kdaj, iz
// katerega IP — docs/PODATKI.md), a je bila doslej vidna SAMO na zaslonu
// (audit-trail-dialog, zadnjih 100 vpisov). Za arhiviranje, skladnostne
// preglede in pisarniško obdelavo (Excel/filtriranje po uporabniku/IP) je
// potreben podatkovni izvoz. Enak vzorec kot ponudbe-csv (R161), ekipa-csv
// (R160), crm-csv (R159), punch-csv (R158) in nagibi-csv (R157).
//
// Ločilo: vejica (,) — usklajeno z novejšo družino izvozov; vsa besedilna
// polja citirana po RFC 4180 (narekovaj podvojen).
//
// Načela:
//  • IZVOŽENO = ZASLON: dialog prikazuje Čas, Akcijo, uporabnika (ime ·
//    vloga), povzetek razlike ter razširjeno staro/novo stanje. Izvoz vsebuje
//    TOČNO te podatke (userAgent dialog NE prikazuje — tudi izvoz ga ne).
//  • Iskrenost: sistemski dogodek (brez uporabnika) → stolpci Uporabnik/
//    Vloga/E-pošta PRAZNI (podatkovna resnica za filtriranje v Excelu; oznako
//    "sistemski dogodek" izriše UI, izvoz ne izmišljuje besedila). Neznana
//    akcija/prazen niz → fail-closed TypeError, ne tiho ugibanje.
//  • Determinizem: ista vhodna polja → enak izhod (datum v imenu datoteke
//    prihaja kot parameter; v sami funkciji ni ura/naključja). Časovni žig
//    se formatira prek Date + sl-SI (isti vzorec kot formatCas v dialogu).
//  • Fail-closed: neveljaven časovni žig/ne-polje → TypeError.

export interface AuditCsvRow {
  id: string
  akcija: string
  oldValue: string | null
  newValue: string | null
  ipAddress: string | null
  timestamp: string
  user: { ime: string; email: string; vloga: string } | null
}

export const AUDIT_CSV_HEADER =
  'Čas,Akcija,Uporabnik,Vloga,E-pošta,IP,Staro stanje,Novo stanje'

function quoteField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

/** ISO časovni žig → sl prikaz (DD. MM. YYYY HH.MM — ISTI Intl klici kot
 * formatCas v audit-trail-dialogu, da je izvoženi čas = zaslonski čas).
 * Neveljaven → fail-closed TypeError. */
export function formatAuditCas(ts: string, polje = 'timestamp'): string {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) {
    throw new TypeError(`buildAuditCsv: neveljaven časovni žig v polju ${polje}: ${String(ts)}`)
  }
  return (
    d.toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
  )
}

/** Slovenska sklanjatev za aria-label: 1/21/31 vpis, 2/22 vpisa,
 * 3/4/23/24 vpisi, 5–11/12–14/15–20 vpisov (isti matrični vzorec kot
 * ponudbeLabel). Fail-closed na ne-celih/ne-finite številih. */
export function revizijaLabel(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError(`revizijaLabel: pričakovano necelo/negativno število: ${String(n)}`)
  }
  const n10 = n % 10
  const n100 = n % 100
  if (n100 >= 11 && n100 <= 14) return `${n} vpisov`
  if (n10 === 1) return `${n} vpis`
  if (n10 === 2) return `${n} vpisa`
  if (n10 === 3 || n10 === 4) return `${n} vpisi`
  return `${n} vpisov`
}

export function buildAuditCsv(
  rows: readonly AuditCsvRow[],
): { csv: string; vrstic: number } {
  if (!Array.isArray(rows)) {
    throw new TypeError('buildAuditCsv: pričakovano polje revizijskih vpisov')
  }
  const lines = rows.map((r) => {
    if (typeof r.akcija !== 'string' || r.akcija.trim() === '') {
      throw new TypeError(`buildAuditCsv: neveljavna akcija: ${String(r.akcija)}`)
    }
    if (r.user !== null && (typeof r.user !== 'object' || typeof r.user.ime !== 'string')) {
      throw new TypeError('buildAuditCsv: neveljaven uporabnik (pričakovano null ali objekt z imenom)')
    }
    if (r.ipAddress !== null && typeof r.ipAddress !== 'string') {
      throw new TypeError(`buildAuditCsv: neveljaven IP: ${String(r.ipAddress)}`)
    }
    if (r.oldValue !== null && typeof r.oldValue !== 'string') {
      throw new TypeError('buildAuditCsv: oldValue mora biti null ali niz')
    }
    if (r.newValue !== null && typeof r.newValue !== 'string') {
      throw new TypeError('buildAuditCsv: newValue mora biti null ali niz')
    }
    const celice = [
      formatAuditCas(r.timestamp),
      r.akcija,
      r.user?.ime ?? '',
      r.user?.vloga ?? '',
      r.user?.email ?? '',
      r.ipAddress ?? '',
      r.oldValue ?? '',
      r.newValue ?? '',
    ]
    return celice.map(quoteField).join(',')
  })
  // BOM (\uFEFF) za Excel UTF-8 prepoznavo — enako kot ostala izvozna družina.
  const csv = '\uFEFF' + AUDIT_CSV_HEADER + (lines.length > 0 ? '\n' + lines.join('\n') : '')
  return { csv, vrstic: lines.length }
}

/** Deterministično ime datoteke: revizija_<projectId>_<YYYY-MM-DD>.csv
 * (sled je vezana na projekt — dialog pošilja ?projectId=). Datum ima
 * strukturno validacijo (mesec 01–12, dan 01–31) — isti vzorec kot
 * ponudbe-csv (R161): "2026-13-99" → fail-closed, ne samo regex-oblika. */
export function auditCsvFilename(projectId: string, isoDatum: string): string {
  if (typeof projectId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(projectId)) {
    throw new TypeError('auditCsvFilename: pričakovan projectId (1–64 znakov: črke, cifre, _ ali -)')
  }
  if (typeof isoDatum !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDatum)) {
    throw new TypeError('auditCsvFilename: pričakovan ISO datum (YYYY-MM-DD)')
  }
  const mesec = Number(isoDatum.slice(5, 7))
  const dan = Number(isoDatum.slice(8, 10))
  if (mesec < 1 || mesec > 12 || dan < 1 || dan > 31) {
    throw new TypeError(`auditCsvFilename: neveljaven ISO datum (mesec 01–12, dan 01–31): ${isoDatum}`)
  }
  return `revizija_${projectId}_${isoDatum}.csv`
}
