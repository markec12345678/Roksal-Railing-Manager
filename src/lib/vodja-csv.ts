// R163 — izvoz dnevnega pregleda vodje v CSV.
// ---------------------------------------------------------------------------
// Kartica "Pregled za vodjo" (vodja-dashboard.tsx) je imela doslej SAMO
// zaslonski pogled in mesečni PDF. Dnevni arhiv (status ob določenem dnevu:
// KPI, opozorila in današnji termini) ni imel podatkovnega izvoza — vodja ga
// lahko zdaj shrani / pošlje / uvozi v Excel. Enak vzorec kot nagibi-csv
// (R157), punch-csv (R158), crm-csv (R159), ponudbe-csv (R161), audit-csv (R162):
// BOM za Excel, escape navedkov (RFC 4180), deterministično ime datoteke.
//
// Ločilo: vejica (,) — usklajeno z novejšo družino izvozov; vsa besedilna
// polja citirana (narekovaj podvojen).
//
// Načela:
//  • IZVOŽENO = ZASLON: vsaka vrednost je natanko tista, ki jo vidi vodja na
//    kartici (isti KPI, ISTA besedila statusov, ISTI EUR format). Nič ni
//    izmišljenega: opozorilni števci gredo v izvoz tudi, ko so 0 (za zaslon
//    se skrijejo — v arhivu je "0 opozoril" prava meritev, ne šum).
//  • Determinizem: ista vhodna polja → enak izhod (brez Math.random/Date.now
//    v sami funkciji). Referenčni datum (danes, YYYY-MM-DD) pride KOT
//    PARAMETER — tudi v imenu datoteke. EUR oblikovanje je čisto
//    stringovno (Math.round + grupiranje tisočic s piko = sl-SI način brez
//    odvisnosti od ICU).
//  • Fail-closed: manjkajoč/neznan vnos → TypeError, ne tiho ugibanje.
//    IZJEMA (dokumentirana): status termina — UI ima nameren fallback
//    ("Načrtovano" za vse, kar ni ZAKLJUCENO/V_TEKU; sintetizirani termini
//    iz projekta nosijo projektne statuse). Izvoz replicira zaslon TAKO KOT
//    JE — sprememba UI fallbacka je ločena produktna odločitev.

export type VodjaTerminStatus = 'ZAKLJUCENO' | 'V_TEKU' | 'NACRTOVANO'

/** ISTA besedila kot značke v "Današnji termini" (vodja-dashboard.tsx).
 *  Znan status → preslikava; neznan → 'Načrtovano' (ISTI fallback kot UI,
 *  glej glavo). Status je string, ker sintetizirani termini nosijo projektne
 *  statuse — izvoz je zrcalo zaslona, ne sheme baze. */
export function terminStatusLabel(status: string): string {
  if (status === 'ZAKLJUCENO') return 'Zaključeno'
  if (status === 'V_TEKU') return 'V teku'
  return 'Načrtovano'
}

export interface VodjaKpi {
  danasTermini: number
  danasZakljuceni: number
  danasVpripravi: number
  mesecnoProjektov: number
  mesecniPrihodek: number
  mesecnaMarza: number
  mesecnoUr: number
  odprtoZnesek: number
  zapadloZnesek: number
  zapadloSt: number
  potekliOpomniki: number
  nizkaZaloga: number
  odprtaNarocila: number
  skupajProjektov: number
  skupajStrank: number
  skupniLTV: number
}

export interface VodjaTerminCsvRow {
  datumZacetka: string
  status: string
  project: { nazivProjekta: string; customer: { ime?: string | null } | null }
  crew: { naziv: string } | null
}

export interface VodjaPrihodekRow {
  label: string
  eur: number
}

/** EUR oblikovanje = ISTI prikaz kot formatEUR na zaslonu
 *  (toLocaleString('sl-SI', 0 decimalk) + ' €'), samo deterministično:
 *  Math.round + grupiranje tisočic s piko. sl-SI za 0 decimalk uporablja
 *  piko kot ločilo tisočic — identično. */
export function formatEurCsv(eur: number): string {
  if (typeof eur !== 'number' || !Number.isFinite(eur)) {
    throw new TypeError(`formatEurCsv: pričakovano končno število: ${String(eur)}`)
  }
  const sign = eur < 0 ? '-' : ''
  const celo = Math.abs(Math.round(eur))
  const grouped = String(celo).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}${grouped} €`
}

/** Ura iz ISO niza kot HH:MM (slice, brez Date API-ja → deterministično).
 *  Zaslon prikaže lokalni čas brskalnika; izvoz vzame časovni del ISO zapisa
 *  (UTC) in TO povedno pove: glava izvoza to ne skriva — arhiv je vezan na
 *  datum iz glave. Polje je torej tehnika, ne trditev o lokalnem času. */
function formatUra(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso)
  if (!m) {
    throw new TypeError(`buildVodjaCsv: neveljaven datumZacetek termina: ${String(iso)}`)
  }
  return `${m[4]}:${m[5]}`
}

const SECTION_HEADER = '"Sekcija","Kazalnik","Vrednost"'

function quoteField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function kpiLine(sekcija: string, kazalnik: string, vrednost: string): string {
  return [quoteField(sekcija), quoteField(kazalnik), quoteField(vrednost)].join(',')
}

function counter(v: number, ime: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v) || v < 0) {
    throw new TypeError(`buildVodjaCsv: pričakovano ne-negativno celo število za ${ime}: ${String(v)}`)
  }
  return v
}

function money(v: number, ime: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new TypeError(`buildVodjaCsv: pričakovano končen znesek za ${ime}: ${String(v)}`)
  }
  return v
}

export function buildVodjaCsv(input: {
  kpi: VodjaKpi
  termini: readonly VodjaTerminCsvRow[]
  prihodki: readonly VodjaPrihodekRow[]
  danesIso: string
}): { csv: string; vrstic: number } {
  const { kpi, termini, prihodki, danesIso } = input
  if (kpi === null || typeof kpi !== 'object' || Array.isArray(kpi)) {
    throw new TypeError('buildVodjaCsv: pričakovan objekt kpi')
  }
  if (!Array.isArray(termini)) {
    throw new TypeError('buildVodjaCsv: pričakovano polje terminov')
  }
  if (!Array.isArray(prihodki)) {
    throw new TypeError('buildVodjaCsv: pričakovano polje prihodkov')
  }
  if (typeof danesIso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(danesIso)) {
    throw new TypeError('buildVodjaCsv: pričakovan referenčni datum danes (YYYY-MM-DD)')
  }
  // Strukturna validacija referenčnega datuma (vzorec R161: "2026-13-99").
  const mesec = Number(danesIso.slice(5, 7))
  const dan = Number(danesIso.slice(8, 10))
  if (mesec < 1 || mesec > 12 || dan < 1 || dan > 31) {
    throw new TypeError(`buildVodjaCsv: nemogoč referenčni datum: ${danesIso}`)
  }

  const lines: string[] = []
  // Glava: naslov + datum izvoza (DD.MM.YYYY, čisto stringovno).
  lines.push(
    [
      quoteField('Pregled za vodjo — dnevni izvoz'),
      quoteField(`${danesIso.slice(8, 10)}.${danesIso.slice(5, 7)}.${danesIso.slice(0, 4)}`),
    ].join(','),
  )
  lines.push(SECTION_HEADER)

  // Danes
  lines.push(kpiLine('Danes', 'Termini', String(counter(kpi.danasTermini, 'danasTermini'))))
  lines.push(kpiLine('Danes', 'V teku', String(counter(kpi.danasVpripravi, 'danasVpripravi'))))
  lines.push(kpiLine('Danes', 'Zaključeni', String(counter(kpi.danasZakljuceni, 'danasZakljuceni'))))

  // Ta mesec
  lines.push(kpiLine('Ta mesec', 'Prihodek (plačano)', formatEurCsv(money(kpi.mesecniPrihodek, 'mesecniPrihodek'))))
  lines.push(kpiLine('Ta mesec', 'Marža (25%)', formatEurCsv(money(kpi.mesecnaMarza, 'mesecnaMarza'))))
  lines.push(kpiLine('Ta mesec', 'Projektov', String(counter(kpi.mesecnoProjektov, 'mesecnoProjektov'))))
  lines.push(kpiLine('Ta mesec', 'Ure', String(counter(kpi.mesecnoUr, 'mesecnoUr'))))
  lines.push(kpiLine('Ta mesec', 'Odprto (izdano)', formatEurCsv(money(kpi.odprtoZnesek, 'odprtoZnesek'))))
  lines.push(
    kpiLine(
      'Ta mesec',
      'Zapadlo',
      `${formatEurCsv(money(kpi.zapadloZnesek, 'zapadloZnesek'))} (${counter(kpi.zapadloSt, 'zapadloSt')})`,
    ),
  )

  // Opozorila (tudi ničelne vrednosti — arhivska resnica)
  lines.push(kpiLine('Opozorila', 'Potekli opomniki', String(counter(kpi.potekliOpomniki, 'potekliOpomniki'))))
  lines.push(kpiLine('Opozorila', 'Nizka zaloga', String(counter(kpi.nizkaZaloga, 'nizkaZaloga'))))
  lines.push(kpiLine('Opozorila', 'Odprta naročila', String(counter(kpi.odprtaNarocila, 'odprtaNarocila'))))

  // Skupno
  lines.push(kpiLine('Skupno', 'Projektov', String(counter(kpi.skupajProjektov, 'skupajProjektov'))))
  lines.push(kpiLine('Skupno', 'Strank', String(counter(kpi.skupajStrank, 'skupajStrank'))))
  lines.push(kpiLine('Skupno', 'Skupni LTV', formatEurCsv(money(kpi.skupniLTV, 'skupniLTV'))))

  // Prihodki po mesecih (isti podatki kot stolpčni graf na zaslonu)
  for (const p of prihodki) {
    if (p === null || typeof p !== 'object' || typeof p.label !== 'string' || p.label.trim() === '') {
      throw new TypeError('buildVodjaCsv: prihodek vrstica potrebuje label')
    }
    lines.push(kpiLine('Prihodki', p.label, formatEurCsv(money(p.eur, 'prihodki'))))
  }

  // Današnji termini — ISTI stolpci kot kartica: Čas · Projekt · Stranka · Ekipa · Status
  if (termini.length > 0) {
    lines.push(['Čas', 'Projekt', 'Stranka', 'Ekipa', 'Status'].map(quoteField).join(','))
    for (const t of termini) {
      if (t === null || typeof t !== 'object') {
        throw new TypeError('buildVodjaCsv: termin mora biti objekt')
      }
      if (
        !t.project ||
        typeof t.project.nazivProjekta !== 'string' ||
        t.project.nazivProjekta.trim() === ''
      ) {
        throw new TypeError('buildVodjaCsv: termin potrebuje project.nazivProjekta')
      }
      const ura = formatUra(t.datumZacetka)
      const projekt = t.project.nazivProjekta
      const stranka = t.project.customer?.ime ?? null
      const ekipa = t.crew?.naziv ?? null
      const status = terminStatusLabel(t.status)
      lines.push(
        [
          quoteField(ura),
          quoteField(projekt),
          stranka === null ? '' : quoteField(stranka),
          ekipa === null ? '' : quoteField(ekipa),
          quoteField(status),
        ].join(','),
      )
    }
  }

  const csv = '\uFEFF' + lines.join('\n')
  return { csv, vrstic: lines.length }
}

/** Deterministično ime datoteke: pregled-vodje_<YYYY-MM-DD>.csv */
export function vodjaCsvFilename(isoDatum: string): string {
  if (typeof isoDatum !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDatum)) {
    throw new TypeError('vodjaCsvFilename: pričakovan ISO datum (YYYY-MM-DD)')
  }
  const mesec = Number(isoDatum.slice(5, 7))
  const dan = Number(isoDatum.slice(8, 10))
  if (mesec < 1 || mesec > 12 || dan < 1 || dan > 31) {
    throw new TypeError(`vodjaCsvFilename: nemogoč datum: ${isoDatum}`)
  }
  return `pregled-vodje_${isoDatum}.csv`
}
