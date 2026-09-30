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
//
// 🆕 R324 (52. člen issue #1 IZVOZI družina) — EN VIR kontrakt DVIGNJEN za
// celo izvozno družino dnevnega pregleda (vzorec preveriZmogljivostPregled-
// ZaIzvoz + ZMOGLJIVOST_IZVOZ_GLAVE R323): glave (VODJA_KPI_GLAVE +
// VODJA_TERMINI_GLAVE), vhodna validacija (preveriVodjaIzvozVhod —
// sporočila VERBATIM, kje = ime graditelja), števci/zneski/ura
// (preveriVodjaStevilo / preveriVodjaZnesek / formatUraVodja), KPI vrstice
// (vodjaKpiVrstice — 17 arhivskih meritev + prihodki, ISTI vrstni red) in
// Vir niz (VODJA_VIR_NIZ). CSV izhod ostane BAJTNO nespremenjen (arhivska
// stabilnost R163 — nič nove meta vrstice); PDF brat (vodja-dnevni-pdf)
// uvaža ISTO resnico — CSV in PDF ne moreta divergirati po konstrukciji.

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
  // R224 — sedmi signalec: artikli brez vpisane nabavne cene (v arhivu tudi
  // ko je 0 — ISTA arhivska resnica kot ostala opozorilna števca).
  brezDobavitelja: number
  // R228 — NOVA tema: zamujena dobava (odprta naročila z izrecno pretečenim
  // datumom dobave — v arhivu tudi ko je 0, IZVOŽENO = ZASLON).
  zamujeneDobave: number
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
 *  datum iz glave. Polje je torej tehnika, ne trditev o lokalnem času.
 *  🆕 R324: EN VIR za celo družino — kje = ime graditelja (sporočilo VERBATIM). */
export function formatUraVodja(iso: string, kje: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso)
  if (!m) {
    throw new TypeError(`${kje}: neveljaven datumZacetek termina: ${String(iso)}`)
  }
  return `${m[4]}:${m[5]}`
}

/** 🆕 R324 — EN VIR glave izvozne družine (vzorec ZMOGLJIVOST_IZVOZ_GLAVE
 *  R323): KPI tabela (Sekcija · Kazalnik · Vrednost) + termini tabela (Čas ·
 *  Projekt · Stranka · Ekipa · Status). CSV citira (quoteField), PDF brat
 *  (vodja-dnevni-pdf) uporablja surove nize v autoTable head — ISTI niz,
 *  NIČ podvojenih glav. */
export const VODJA_KPI_GLAVE = ['Sekcija', 'Kazalnik', 'Vrednost'] as const
export const VODJA_TERMINI_GLAVE = ['Čas', 'Projekt', 'Stranka', 'Ekipa', 'Status'] as const

/** 🆕 R324 — Vir niz družine (vzorec AUDIT_VIR_NIZ R318 / ZMOGLJIVOST_VIR_NIZ
 *  R323). CSV arhivska oblika R163 ostaja BAJTNO nespremenjena (nič nove
 *  meta vrstice) — vir niz nosi PDF brat v sklepni vrstici; kontrakt živi
 *  TUKAJ (EN VIR za celo družino). */
export const VODJA_VIR_NIZ = 'DNEVNI_PREGLED_VODJE — isti HEAD = bajtno identičen izvoz'

function quoteField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

/** 🆕 R324 — EN VIR števec (celoštevilska ne-negativna resnica; vzorec
 *  counter R163 — sporočilo VERBATIM, kje = ime graditelja). */
export function preveriVodjaStevilo(v: number, ime: string, kje: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v) || v < 0) {
    throw new TypeError(`${kje}: pričakovano ne-negativno celo število za ${ime}: ${String(v)}`)
  }
  return v
}

/** 🆕 R324 — EN VIR znesek (končna numerična resnica; vzorec money R163). */
export function preveriVodjaZnesek(v: number, ime: string, kje: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new TypeError(`${kje}: pričakovano končen znesek za ${ime}: ${String(v)}`)
  }
  return v
}

/** 🆕 R324 — EN VIR vhodna validacija izvozne družine dnevnega pregleda
 *  (dvignjena iz buildVodjaCsv — vzorec preveriZmogljivostPregledZaIzvoz
 *  R323): sporočila VERBATIM, kje = ime graditelja. Pokvaren vhod ne more
 *  postati lažno poročilo v NITI enem potrošniku družine. */
export function preveriVodjaIzvozVhod(
  input: {
    kpi: VodjaKpi
    termini: readonly VodjaTerminCsvRow[]
    prihodki: readonly VodjaPrihodekRow[]
    danesIso: string
  },
  kje: string,
): void {
  const { kpi, termini, prihodki, danesIso } = input
  if (kpi === null || typeof kpi !== 'object' || Array.isArray(kpi)) {
    throw new TypeError(`${kje}: pričakovan objekt kpi`)
  }
  if (!Array.isArray(termini)) {
    throw new TypeError(`${kje}: pričakovano polje terminov`)
  }
  if (!Array.isArray(prihodki)) {
    throw new TypeError(`${kje}: pričakovano polje prihodkov`)
  }
  if (typeof danesIso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(danesIso)) {
    throw new TypeError(`${kje}: pričakovan referenčni datum danes (YYYY-MM-DD)`)
  }
  // Strukturna validacija referenčnega datuma (vzorec R161: "2026-13-99").
  const mesec = Number(danesIso.slice(5, 7))
  const dan = Number(danesIso.slice(8, 10))
  if (mesec < 1 || mesec > 12 || dan < 1 || dan > 31) {
    throw new TypeError(`${kje}: nemogoč referenčni datum: ${danesIso}`)
  }
}

/** 🆕 R324 — EN VIR KPI vrstice dnevnega pregleda: 17 arhivskih meritev
 *  (Danes ×3, Ta mesec ×6, Opozorila ×5, Skupno ×3) + prihodki po mesecih —
 *  ISTI vrstni red kot CSV brat (kanon IZVOŽENO = ZASLON R163: vrednosti so
 *  že prikazne — formatEurCsv / String(counter)). CSV jih citira v strojne
 *  vrstice, PDF jih riše v autoTable — ena definicija, dva potrošnika. */
export interface VodjaKpiVrstica {
  sekcija: string
  kazalnik: string
  vrednost: string
}

export function vodjaKpiVrstice(
  kpi: VodjaKpi,
  prihodki: readonly VodjaPrihodekRow[],
  kje: string,
): VodjaKpiVrstica[] {
  const vrstice: VodjaKpiVrstica[] = []
  const s = (sekcija: string, kazalnik: string, vrednost: string): void => {
    vrstice.push({ sekcija, kazalnik, vrednost })
  }
  // Danes
  s('Danes', 'Termini', String(preveriVodjaStevilo(kpi.danasTermini, 'danasTermini', kje)))
  s('Danes', 'V teku', String(preveriVodjaStevilo(kpi.danasVpripravi, 'danasVpripravi', kje)))
  s('Danes', 'Zaključeni', String(preveriVodjaStevilo(kpi.danasZakljuceni, 'danasZakljuceni', kje)))
  // Ta mesec
  s('Ta mesec', 'Prihodek (plačano)', formatEurCsv(preveriVodjaZnesek(kpi.mesecniPrihodek, 'mesecniPrihodek', kje)))
  s('Ta mesec', 'Marža (25%)', formatEurCsv(preveriVodjaZnesek(kpi.mesecnaMarza, 'mesecnaMarza', kje)))
  s('Ta mesec', 'Projektov', String(preveriVodjaStevilo(kpi.mesecnoProjektov, 'mesecnoProjektov', kje)))
  s('Ta mesec', 'Ure', String(preveriVodjaStevilo(kpi.mesecnoUr, 'mesecnoUr', kje)))
  s('Ta mesec', 'Odprto (izdano)', formatEurCsv(preveriVodjaZnesek(kpi.odprtoZnesek, 'odprtoZnesek', kje)))
  s(
    'Ta mesec',
    'Zapadlo',
    `${formatEurCsv(preveriVodjaZnesek(kpi.zapadloZnesek, 'zapadloZnesek', kje))} (${preveriVodjaStevilo(kpi.zapadloSt, 'zapadloSt', kje)})`,
  )
  // Opozorila (tudi ničelne vrednosti — arhivska resnica)
  s('Opozorila', 'Potekli opomniki', String(preveriVodjaStevilo(kpi.potekliOpomniki, 'potekliOpomniki', kje)))
  s('Opozorila', 'Nizka zaloga', String(preveriVodjaStevilo(kpi.nizkaZaloga, 'nizkaZaloga', kje)))
  s('Opozorila', 'Odprta naročila', String(preveriVodjaStevilo(kpi.odprtaNarocila, 'odprtaNarocila', kje)))
  // R224 — sedmi signalec (IZVOŽENO = ZASLON: tudi ko je 0 — arhivska resnica)
  s('Opozorila', 'Brez dobavitelja', String(preveriVodjaStevilo(kpi.brezDobavitelja, 'brezDobavitelja', kje)))
  // R228 — nova tema: zamujena dobava (IZVOŽENO = ZASLON: tudi ko je 0 —
  // arhivska resnica; ISTO besedilo dimenzije kot zaslon)
  s('Opozorila', 'Zamujena dobava', String(preveriVodjaStevilo(kpi.zamujeneDobave, 'zamujeneDobave', kje)))
  // Skupno
  s('Skupno', 'Projektov', String(preveriVodjaStevilo(kpi.skupajProjektov, 'skupajProjektov', kje)))
  s('Skupno', 'Strank', String(preveriVodjaStevilo(kpi.skupajStrank, 'skupajStrank', kje)))
  s('Skupno', 'Skupni LTV', formatEurCsv(preveriVodjaZnesek(kpi.skupniLTV, 'skupniLTV', kje)))
  // Prihodki po mesecih (isti podatki kot stolpčni graf na zaslonu)
  for (const p of prihodki) {
    if (p === null || typeof p !== 'object' || typeof p.label !== 'string' || p.label.trim() === '') {
      throw new TypeError(`${kje}: prihodek vrstica potrebuje label`)
    }
    s('Prihodki', p.label, formatEurCsv(preveriVodjaZnesek(p.eur, 'prihodki', kje)))
  }
  return vrstice
}

export function buildVodjaCsv(input: {
  kpi: VodjaKpi
  termini: readonly VodjaTerminCsvRow[]
  prihodki: readonly VodjaPrihodekRow[]
  danesIso: string
}): { csv: string; vrstic: number } {
  // 🆕 R324: vhodna validacija EN VIR (preveriVodjaIzvozVhod — sporočila
  // VERBATIM, kje = 'buildVodjaCsv' → bajtno ISTA sporočila kot R163).
  preveriVodjaIzvozVhod(input, 'buildVodjaCsv')
  const { kpi, termini, prihodki, danesIso } = input
  const kje = 'buildVodjaCsv'

  const lines: string[] = []
  // Glava: naslov + datum izvoza (DD.MM.YYYY, čisto stringovno).
  lines.push(
    [
      quoteField('Pregled za vodjo — dnevni izvoz'),
      quoteField(`${danesIso.slice(8, 10)}.${danesIso.slice(5, 7)}.${danesIso.slice(0, 4)}`),
    ].join(','),
  )
  lines.push(VODJA_KPI_GLAVE.map(quoteField).join(','))

  // 🆕 R324: KPI vrstice EN VIR (vodjaKpiVrstice — 17 meritev + prihodki,
  // ISTI vrstni red; citirane v strojne vrstice — bajtno ISTO kot R163).
  for (const v of vodjaKpiVrstice(kpi, prihodki, kje)) {
    lines.push([quoteField(v.sekcija), quoteField(v.kazalnik), quoteField(v.vrednost)].join(','))
  }

  // Današnji termini — ISTI stolpci kot kartica (EN VIR glava VODJA_TERMINI_GLAVE)
  if (termini.length > 0) {
    lines.push(VODJA_TERMINI_GLAVE.map(quoteField).join(','))
    for (const t of termini) {
      if (t === null || typeof t !== 'object') {
        throw new TypeError(`${kje}: termin mora biti objekt`)
      }
      if (
        !t.project ||
        typeof t.project.nazivProjekta !== 'string' ||
        t.project.nazivProjekta.trim() === ''
      ) {
        throw new TypeError(`${kje}: termin potrebuje project.nazivProjekta`)
      }
      const ura = formatUraVodja(t.datumZacetka, kje)
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
