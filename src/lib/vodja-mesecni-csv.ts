// ---------------------------------------------------------------------------
// R335 — 62. člen issue #1 (IZVOZI družina): izvoz MESEČNEGA poročila vodje
// kot DETERMINISTIČNI CSV. CSV brat mesečnemu PDF poročilu (runda M —
// boss-report-pdf, precedens R330–R334: LOČEN lib, ki UVAŽA resnico PDF
// brata — EN VIR, NIČ podvojenih pravil).
//
// EN VIR resnice:
//  • vhod = ISTI ReportData, ki ga PDF brat runda M dobi iz komponente
//    (vodja-dashboard: ENA izpeljava mesecniPregledData — DVA potrošnika:
//    generateMonthlyReport + vodjaMesecniCsv — divergenca nemogoča, vzorec
//    vodjaIzvozVhod R293);
//  • mesecIme + STATUS_SL = UVOŽENA iz PDF brata (ISTI slovenski koledar IN
//    ISTA preslikava statusov — anti-divergenca po konstrukciji);
//  • celice = ISTI izpisi kot PDF: eur/eur0 (formatSlDecimalno EN VIR
//    csv-export — ISTI vir kot PDF R294 lekcija), slDatum (slDatumKratko),
//    zapadli 'Dni zapadlo' = ISTA izpeljava kot PDF body (rok = datumIzdaje
//    + rokPlacilaDni; dni = max(0, floor((generatedAt − rok)/86400000)) —
//    testi pinajo PROTI PDF VIRU, vzorec R330/R331/R332/R334);
//  • glave plačani/zapadli/projekti = VERBATIM PDF autoTable head (testi
//    pinajo glave PROTI PDF VIRU — anti-divergenca); prihodki glava je
//    predstavitvena (PDF riše GRAF brez tabele — CSV nosi ISTI izpisi kot
//    stolpci grafa: label + eur0 vrednost nad stolpcem);
//  • sklep = VERBATIM PDF sklepna vrstica (ISTI segmenti kot doc.text —
//    testi pinajo dobesedne segmente PROTI PDF VIRU);
//  • KPI = ISTI 6 naslovi in izpisi kot PDF kpiBox (zapadlo > 0 →
//    'znesek (števec)', sicer '0 €' — ISTA PDF veja);
//  • meta števci = ISTA resnica kot PDF opozorila (PDF nosi prozo — CSV
//    nosi ISTA števca; nič tihe degradacije, dokumentirano v testih).
//
// Format = kanon R136 toCsv (BOM + podpičje + CRLF + RFC 4180 citiranje —
// vodja blok CSV kanon R317/R334). 'Izvoženo ob' = PODATKOVNI izvoz z
// referenčnim mesecem (kanon R330–R333: čas je del resnice — zapadli 'Dni
// zapadlo' je odvisen od dneva izvoza; NIKOLI izpuščen).
//
// Fail-closed: vhod validiran po imenu polja (TypeError z imenom liba —
// kanon R299/R302/R306: niz preživi minifikacijo). Obrnjena regresija: CSV
// funkcij NI v bratu boss-report-pdf (EN lib — LEKCIJA R318 1).
// ---------------------------------------------------------------------------

import {
  mesecIme,
  STATUS_SL,
  type ReportData,
  type ReportInvoiceRow,
  type ReportProjectRow,
} from './boss-report-pdf'
import { formatSlDecimalno, slDatumKratko, toCsv, type CsvValue } from './csv-export'

// R294 (EN VIR csv-export — ISTI izpisi kot PDF): bajtno iste čiste izpeljave.
const eur = (n: number) => formatSlDecimalno(n, 2, 2) + ' €'
const eur0 = (n: number) => formatSlDecimalno(n, 0, 0) + ' €'

function slDatum(d: Date | string): string {
  return slDatumKratko(new Date(d))
}

/** Glava prihodkov (predstavitvena — PDF riše graf; CSV nosi ISTI izpisi
 *  kot stolpci grafa: label + eur0 vrednost nad stolpcem). */
export const MESECNI_CSV_GLAVE_PRIHODKI = ['Mesec', 'Prihodki'] as const

/** Glava plačanih računov (VERBATIM PDF autoTable head runda M —
 *  anti-divergenca po konstrukciji, testi pinajo vir). */
export const MESECNI_CSV_GLAVE_PLACANI = ['Račun', 'Kupec', 'Projekt', 'Plačano', 'Znesek'] as const

/** Glava zapadlih računov (VERBATIM PDF autoTable head runda M —
 *  anti-divergenca po konstrukciji, testi pinajo vir). */
export const MESECNI_CSV_GLAVE_ZAPADLI = ['Račun', 'Kupec', 'Rok plačila', 'Dni zapadlo', 'Znesek'] as const

/** Glava projektov po statusu (VERBATIM PDF autoTable head runda M —
 *  anti-divergenca po konstrukciji, testi pinajo vir). */
export const MESECNI_CSV_GLAVE_PROJEKTI = ['Projekt', 'Stranka', 'Status', 'Cena'] as const

/** Iskren vir niz meta vrstice (vzorec KONCNA_VIR_NIZ R334 / AUDIT_VIR_NIZ
 *  R318). */
export const MESECNI_VIR_NIZ =
  'Mesečno poročilo vodje — ista resnica kot PDF brat (runda M): KPI, prihodki 6 mesecev, plačani in zapadli računi, projekti po statusu'

const STATSI_STEVCA = [
  'prihodekMesec',
  'marza',
  'odprtoZnesek',
  'zapadloZnesek',
  'zapadloSt',
  'projektovNovih',
  'ureMesec',
  'skupajProjektov',
  'skupajStrank',
  'skupniLTV',
  'nizkaZaloga',
  'odprtaNarocila',
  'brezDobavitelja',
  'zamujeneDobave',
  'potekliOpomniki',
] as const

/** Fail-closed preverba celotnega pogleda (po imenu polja — kanon R299). */
function zahtevajPogled(data: ReportData): void {
  if (!data || typeof data !== 'object') {
    throw new TypeError('vodjaMesecniCsv: pričakovano poročilo (ReportData)')
  }
  const mesec = (data as ReportData).mesec
  if (
    !mesec ||
    typeof mesec !== 'object' ||
    !Number.isInteger(mesec.year) ||
    !Number.isInteger(mesec.month) ||
    mesec.month < 0 ||
    mesec.month > 11
  ) {
    throw new TypeError('vodjaMesecniCsv: pričakovan veljaven mesec (year, month 0–11)')
  }
  if (!(data.generatedAt instanceof Date) || Number.isNaN(data.generatedAt.getTime())) {
    throw new TypeError('vodjaMesecniCsv: pričakovan veljaven generatedAt: Date')
  }
  if (!data.stats || typeof data.stats !== 'object') {
    throw new TypeError('vodjaMesecniCsv: pričakovani statistiki (stats)')
  }
  for (const k of STATSI_STEVCA) {
    const v = data.stats[k]
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new TypeError(`vodjaMesecniCsv: pričakovan finiten števec stats.${k}`)
    }
  }
  if (!Array.isArray(data.prihodki6) || data.prihodki6.length !== 6) {
    throw new TypeError('vodjaMesecniCsv: pričakovanih 6 mesecev prihodkov (prihodki6)')
  }
  if (!Array.isArray(data.placaniTaMesec)) {
    throw new TypeError('vodjaMesecniCsv: pričakovana polja plačanih računov (placaniTaMesec)')
  }
  if (!Array.isArray(data.izdaniZapadli)) {
    throw new TypeError('vodjaMesecniCsv: pričakovana polja zapadlih računov (izdaniZapadli)')
  }
  if (!Array.isArray(data.projekti)) {
    throw new TypeError('vodjaMesecniCsv: pričakovana polja projektov (projekti)')
  }
}

/** KPI vrstice ×6 (ISTI naslovi in izpisi kot PDF kpiBox runda M — zapadlo
 *  > 0 → 'znesek (števec)', sicer '0 €' — ISTA PDF veja). */
export function vodjaMesecniCsvKpiVrstice(stats: ReportData['stats']): CsvValue[][] {
  if (!stats || typeof stats !== 'object') {
    throw new TypeError('vodjaMesecniCsvKpiVrstice: pričakovani statistiki (stats)')
  }
  return [
    ['Prihodek (plačano)', eur0(stats.prihodekMesec)],
    ['Marža (25 %)', eur0(stats.marza)],
    ['Odprto (izdano)', eur0(stats.odprtoZnesek)],
    ['Zapadlo', stats.zapadloSt > 0 ? `${eur0(stats.zapadloZnesek)} (${stats.zapadloSt})` : '0 €'],
    ['Novih projektov', String(stats.projektovNovih)],
    ['Ure (koledar)', `${stats.ureMesec} h`],
  ]
}

/** ENA vrstica prihodkov (ISTI izpisi kot stolpci grafa: label + eur0). */
export function vodjaMesecniCsvPrihodekVrstica(p: { label: string; eur: number }): CsvValue[] {
  if (!p || typeof p !== 'object' || typeof p.label !== 'string' || typeof p.eur !== 'number' || !Number.isFinite(p.eur)) {
    throw new TypeError('vodjaMesecniCsvPrihodekVrstica: pričakovan mesec prihodkov (label, eur)')
  }
  return [p.label, eur0(p.eur)]
}

/** ENA vrstica plačanega računa (ISTI celici kot PDF autoTable body). */
export function vodjaMesecniCsvPlacanVrstica(inv: ReportInvoiceRow): CsvValue[] {
  if (!inv || typeof inv !== 'object' || typeof inv.stevilka !== 'string' || typeof inv.znesek !== 'number' || !Number.isFinite(inv.znesek)) {
    throw new TypeError('vodjaMesecniCsvPlacanVrstica: pričakovan račun (ReportInvoiceRow)')
  }
  return [inv.stevilka, inv.kupec || '—', inv.projekt || '—', inv.placanoAt ? slDatum(inv.placanoAt) : '—', eur(inv.znesek)]
}

/** ENA vrstica zapadlega računa (ISTI celici kot PDF autoTable body —
 *  'Dni zapadlo' = ISTA izpeljava kot PDF: rok = datumIzdaje +
 *  rokPlacilaDni; dni = max(0, floor((generatedAt − rok)/86400000))). */
export function vodjaMesecniCsvZapadliVrstica(inv: ReportInvoiceRow, generatedAt: Date): CsvValue[] {
  if (!inv || typeof inv !== 'object' || typeof inv.stevilka !== 'string' || typeof inv.znesek !== 'number' || !Number.isFinite(inv.znesek)) {
    throw new TypeError('vodjaMesecniCsvZapadliVrstica: pričakovan račun (ReportInvoiceRow)')
  }
  if (!(generatedAt instanceof Date) || Number.isNaN(generatedAt.getTime())) {
    throw new TypeError('vodjaMesecniCsvZapadliVrstica: pričakovan veljaven generatedAt: Date')
  }
  const rok = new Date(inv.datumIzdaje)
  rok.setDate(rok.getDate() + inv.rokPlacilaDni)
  const dni = Math.max(0, Math.floor((generatedAt.getTime() - rok.getTime()) / 86400000))
  return [inv.stevilka, inv.kupec || '—', slDatum(rok), String(dni), eur(inv.znesek)]
}

/** ENA vrstica projekta (ISTI celici kot PDF autoTable body — status
 *  prikazno UVOŽEN iz PDF brata STATUS_SL, cena '—' kadar ni vpisana). */
export function vodjaMesecniCsvProjektVrstica(p: ReportProjectRow): CsvValue[] {
  if (!p || typeof p !== 'object' || typeof p.naziv !== 'string' || typeof p.status !== 'string') {
    throw new TypeError('vodjaMesecniCsvProjektVrstica: pričakovan projekt (ReportProjectRow)')
  }
  return [p.naziv, p.stranka || '—', STATUS_SL[p.status] ?? p.status, p.cena != null ? eur(p.cena) : '—']
}

/** Sklep (VERBATIM PDF sklepna vrstica runda M — ISTI segmenti kot
 *  doc.text; ločena funkcija, testi pinajo PROTI PDF VIRU — vzorec
 *  projektiTerminiCsvSklep R330). */
export function vodjaMesecniCsvSklep(data: ReportData): string {
  if (!data || typeof data !== 'object' || !data.stats || typeof data.stats !== 'object') {
    throw new TypeError('vodjaMesecniCsvSklep: pričakovano poročilo (ReportData)')
  }
  const s = data.stats
  return `Skupno stanje: ${s.skupajProjektov} projektov, ${s.skupajStrank} strank, skupni LTV ${eur0(s.skupniLTV)}.`
}

/**
 * Zgrodi deterministični CSV mesečnega poročila vodje. `now` = žig resnica
 * ('Izvoženo ob' — PODATKOVNI izvoz z referenčnim mesecem, kanon R330–R333;
 * zapadli 'Dni zapadlo' je odvisen od dneva — čas je del resnice, NIKOLI
 * izpuščen). EN VIR: `data` = ISTI ReportData kot PDF brat (runda M).
 */
export function vodjaMesecniCsv(data: ReportData, now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('vodjaMesecniCsv: pričakovan veljaven now: Date')
  }
  zahtevajPogled(data)
  const mesecNaziv = `${mesecIme(data.mesec.year, data.mesec.month)} ${data.mesec.year}`
  const s = data.stats
  const vrstice: CsvValue[][] = [
    ['Izvoženo ob', now.toISOString()],
    [], // prazna ločilna vrstica (preglednost v Excelu — kanon R172→R296)
    ...vodjaMesecniCsvKpiVrstice(s),
    [], // prazna ločilna vrstica
    [...MESECNI_CSV_GLAVE_PRIHODKI],
    ...data.prihodki6.map((p) => vodjaMesecniCsvPrihodekVrstica(p)),
    [], // prazna ločilna vrstica
    [...MESECNI_CSV_GLAVE_PLACANI],
    ...data.placaniTaMesec.map((inv) => vodjaMesecniCsvPlacanVrstica(inv)),
    [], // prazna ločilna vrstica
    [...MESECNI_CSV_GLAVE_ZAPADLI],
    ...data.izdaniZapadli.map((inv) => vodjaMesecniCsvZapadliVrstica(inv, data.generatedAt)),
    [], // prazna ločilna vrstica
    [...MESECNI_CSV_GLAVE_PROJEKTI],
    ...(data.projekti.length === 0
      ? [['—', '—', '—', '—'] as CsvValue[]] // PDF pariteta: prazna tabela → ISTA vrstica '—' (runda M)
      : data.projekti.map((p) => vodjaMesecniCsvProjektVrstica(p))),
    [], // prazna ločilna vrstica pred povzetkom (preglednost v Excelu)
    // --- meta povzetek: števci = ISTA resnica kot PDF opozorila (PDF nosi
    //     prozo — CSV nosi ISTA števca) + sklep VERBATIM + vir ---
    ['Plačanih računov', String(data.placaniTaMesec.length)],
    ['Nizka zaloga', String(s.nizkaZaloga)],
    ['Odprta naročila', String(s.odprtaNarocila)],
    ['Brez dobavitelja', String(s.brezDobavitelja)],
    ['Zamujene dobave', String(s.zamujeneDobave)],
    ['Potekli opomniki', String(s.potekliOpomniki)],
    ['Skupaj projektov', String(s.skupajProjektov)],
    ['Skupaj strank', String(s.skupajStrank)],
    ['Skupni LTV', eur0(s.skupniLTV)],
    ['Sklep', vodjaMesecniCsvSklep(data)],
    ['Vir', MESECNI_VIR_NIZ],
  ]
  return toCsv(['Mesečno poročilo vodje', mesecNaziv], vrstice)
}

/** Deterministično ime datoteke: porocilo-YYYY-MM.csv (bratska simetrija z
 *  PDF imenom runda M 'porocilo-YYYY-MM.pdf' — ISTI mesec IZ VHODA, ne iz
 *  ure — datoteka je določena s podatki, NIKOLI s časom klika). */
export function vodjaMesecniCsvFilename(data: ReportData): string {
  if (!data || typeof data !== 'object' || !data.mesec || typeof data.mesec !== 'object') {
    throw new TypeError('vodjaMesecniCsvFilename: pričakovano poročilo (ReportData)')
  }
  const { year, month } = data.mesec
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 0 || month > 11) {
    throw new TypeError('vodjaMesecniCsvFilename: pričakovan veljaven mesec (year, month 0–11)')
  }
  const mm = String(month + 1).padStart(2, '0')
  return `porocilo-${year}-${mm}.csv`
}
