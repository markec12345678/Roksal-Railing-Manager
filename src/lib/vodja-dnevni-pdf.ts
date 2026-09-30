// ---------------------------------------------------------------------------
// R324 — 52. člen issue #1 (IZVOZI družina): izvoz DNEVNEGA pregleda vodje
// kot DETERMINISTIČNI PDF (tisk za pisarno/revizijo — bralcu brez Excela).
// PDF BRAT dnevnemu CSV R163 (vzorec R318 audit-pdf / R321 zmogljivost-pdf:
// LOČEN lib — jsPDF teža NE obremenjuje brata vodja-csv, ki je čist podatkovni
// lib). Mesečni PDF (runda M) ostaja svoja zgodba — ta dokument je DNEVNI
// arhiv: KPI + opozorila + prihodki + današnji termini, TAKO KOT jih vidi
// vodja na kartici (kanon IZVOŽENO = ZASLON R163).
//
// EN VIR resnice (NIČ dvojnega — vse primitivne izpeljave UVOŽENE iz brata):
//  • vhod = POSREDOVANA resnica { kpi, termini, prihodki, danesIso } — ISTI
//    vhod kot CSV brat (komponenta: vodjaIzvozVhod — EN preslikava, dva
//    potrošnika); PDF NIKOLI ne izmišlja ali ponovno meri podatkov;
//  • KPI vrstice = vodjaKpiVrstice (UVOŽENE — 17 arhivskih meritev +
//    prihodki, ISTI vrstni red kot CSV; fail-closed števci/zneski brezplačno);
//  • glavi = VODJA_KPI_GLAVE + VODJA_TERMINI_GLAVE (UVOŽENI — ISTA stolpca
//    kot CSV; PDF in CSV ne moreta divergirati po konstrukciji — vzorec
//    ZMOGLJIVOST_IZVOZ_GLAVE R323);
//  • EUR prikaz = formatEurCsv (UVOŽEN — ISTI izraz kot CSV in zaslon);
//  • ura = formatUraVodja (UVOŽENA — ISTI slice kot CSV);
//  • status besedila = terminStatusLabel (UVOŽENA — ISTI fallback 'Načrtovano'
//    kot značke na zaslonu);
//  • vhodna validacija = preveriVodjaIzvozVhod (UVOŽENA — sporočila VERBATIM,
//    kje = 'buildVodjaDnevniPdfDoc'; pokvaren vhod je odklonjen na ISTI način
//    v CSV in PDF — NIČ podvojenih pravil);
//  • Vir niz = VODJA_VIR_NIZ (UVOŽEN — sklepna vrstica dokumenta; CSV arhivska
//    oblika R163 ostaja bajtno nespremenjena — kontrakt živi v bratu).
//
// Struktura dokumenta (družinski vzorec R318/R320/R321):
//  • ROKSAL glava (navy pas + naslov DNEVNI PREGLED VODJE + iskren podnaslov
//    'deterministični izvoz — EN VIR resnica' — brez lažnih časovnih žigov);
//    datum (DD.MM.YYYY, čisto stringovno iz danesIso — ISTI izraz kot CSV
//    glava) je del PODATKOVNE resnice (referenčni dan arhiva), ne izvoza;
//  • KPI ×4 (IZRAČUNANI iz vhoda — NIČ trdo kodiranih): Danes termini (navy),
//    Prihodek (plačano) (navy — formatEurCsv), Zapadlo (rdeč, če > 0 —
//    iskren alarm; formatEurCsv + števec — ISTA sestavljena vrednost kot
//    CSV vrstica), Potekli opomniki (amber, če > 0 — iskren alarm);
//  • tabela Arhiv meritev (glava VODJA_KPI_GLAVE — ENA vrstica = ENA
//    meritev, ISTA ravnina kot CSV vrstice; Sekcija bold navy);
//  • tabela Današnji termini (glava VODJA_TERMINI_GLAVE — ISTI stolpci kot
//    kartica; PRAZNA veja = iskren niz 'Brez terminov za ta datum.' — nič
//    izmišljenih vrstic);
//  • sklepna vrstica: Vir (VODJA_VIR_NIZ).
//
// Determinizem (kanon 46.–51. člen — 'isti HEAD + ISTI vhod = bajtno
// identičen dokument'): vsebina NE nosi časa izvoza (referenčni datum pride
// kot parameter danesIso); format PDF pa ZAHTEVA CreationDate metadata →
// KANONSKI fiksni žig VODJA_PDF_ZIG_FIKSNI (formatna lastnost, NIČ podatkovne
// resnice) kot privzeti `now` (parametriziran SAMO za teste — produkcija
// kliče brez argumenta; LEKCIJA R317 4: fail-closed testi z null); fileId =
// čista JS FNV-1a nad kanonizirano serijalizacijo resnice (danesIso + vsi
// KPI + prihodki + termini — VSE je del resnice; ISTI vrstni red kot vhod,
// nič re-sorta) z LASTNIMI soli 0xcd–0xd0 (register: 0xb0–0xc0 prejšnje,
// 0xc1–0xc4 audit-pdf R318, 0xc5–0xc8 končna-pdf R320, 0xc9–0xcc
// zmogljivost-pdf R321 — ista semena v dveh libih NE smejo dati isti ID).
//
// Fail-closed: ne-objekt vhod / ne-objekt kpi / ne-polja / nemogoč datum /
// negativen števec / ne-končen znesek / pokvaren now / pokvaren options →
// TypeError z imenom graditelja (kanon R299/R302/R306/R318 — niz preživi
// minifikacijo, identifikatorji ne). Obrnjena regresija: PDF funkcij NI v
// bratu vodja-csv (cikel in duplikat tiran — ena definicija, EN lib; r318
// lekcija 1); validacija je ENA (brat) — NIČ podvojenih pravil v družini.
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import {
  formatEurCsv,
  formatUraVodja,
  preveriVodjaIzvozVhod,
  terminStatusLabel,
  VODJA_KPI_GLAVE,
  VODJA_TERMINI_GLAVE,
  VODJA_VIR_NIZ,
  vodjaKpiVrstice,
} from './vodja-csv'
import type { VodjaKpi, VodjaPrihodekRow, VodjaTerminCsvRow } from './vodja-csv'

// ---------- barve (ISTI dokumenti družina — usklajeno z R318/R320/R321) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const RED: [number, number, number] = [220, 38, 38] // zaloga-pdf R120 red (iskren alarm)
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

/** Kanonski fiksni žig CreationDate (determinizem — kanon 46.–51. člen).
 *  Format PDF zahteva CreationDate; vsebina NE nosi časa. NIČ podatkovne
 *  resnice — samo formatna lastnost dokumenta. */
export const VODJA_PDF_ZIG_FIKSNI = new Date(Date.UTC(2026, 0, 1, 0, 0, 0))

export interface VodjaDnevniPdfOptions {
  /** Formatni žig CreationDate — PRIVZETO kanonski fiksni žig (determinizem:
   *  produkcija kliče brez argumenta = isti HEAD + isti vhod → bajtno
   *  identičen PDF). Parametriziran SAMO za teste (kanon pregled). */
  now?: Date
}

/** Determinističen file-ID (32 hex) — čista JS FNV-1a; LASTNI soli 0xcd–0xd0. */
function fnv1aHex(seed: string, salt: number): string {
  let h = 0x811c9dc5 ^ salt
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function deterministichenId(seed: string): string {
  return (
    fnv1aHex(seed, 0xcd) +
    fnv1aHex(seed, 0xce) +
    fnv1aHex(seed, 0xcf) +
    fnv1aHex(seed, 0xd0)
  )
}

/** Kanoniziran seed resnice — danesIso + vsi KPI + prihodki + termini SO del
 *  resnice; serijalizacija = določevalna funkcija vsebine (ISTI vrstni red
 *  kot vhod — nič re-sorta). */
function resnicaSeed(input: {
  kpi: VodjaKpi
  termini: readonly VodjaTerminCsvRow[]
  prihodki: readonly VodjaPrihodekRow[]
  danesIso: string
}): string {
  const k = input.kpi
  const kpiDel = [
    k.danasTermini, k.danasZakljuceni, k.danasVpripravi,
    k.mesecnoProjektov, k.mesecniPrihodek, k.mesecnaMarza, k.mesecnoUr,
    k.odprtoZnesek, k.zapadloZnesek, k.zapadloSt,
    k.potekliOpomniki, k.nizkaZaloga, k.odprtaNarocila,
    k.brezDobavitelja, k.zamujeneDobave,
    k.skupajProjektov, k.skupajStrank, k.skupniLTV,
  ].join(';')
  const prihodkiDel = input.prihodki.map((p) => `${p.label}@${p.eur}`).join(';')
  const terminiDel = input.termini
    .map(
      (t) =>
        `${t.datumZacetka}#${t.status}@${t.project.nazivProjekta}|${t.project.customer?.ime ?? ''}|${t.crew?.naziv ?? ''}`,
    )
    .join(';')
  return `D:${input.danesIso}|K:${kpiDel}|P:${prihodkiDel}|T:${terminiDel}`
}

function sectionTitle(doc: jsPDF, y: number, text: string): number {
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...NAVY)
  doc.text(text, 14, y)
  doc.setDrawColor(...AMBER)
  doc.setLineWidth(0.8)
  doc.line(14, y + 1.8, 14 + doc.getTextWidth(text), y + 1.8)
  doc.setLineWidth(0.2)
  return y + 6
}

/** KPI polje — ISTI vzorec kot audit/zmogljivost/konflikti (družinski kpiBox). */
function kpiBox(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  color: [number, number, number],
): void {
  doc.setFillColor(...LIGHT)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(x, y, w, h, 2, 2, 'FD')
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...GRAY)
  doc.text(label.toUpperCase(), x + 3, y + 5.5)
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...color)
  doc.text(value, x + 3, y + 13)
}

/** Zgradi DNEVNI PREGLED VODJE dokument (brez shranjevanja) — vrne jsPDF
 *  instanco (testi berejo doc.output('arraybuffer') → bajtni dokazi).
 *  Vhod = POSREDOVANA resnica (EN VIR z CSV bratom); options parametriziran
 *  SAMO za teste fail-closed poti (null NE undefined — lekcija R317 4). */
export function buildVodjaDnevniPdfDoc(
  input: {
    kpi: VodjaKpi
    termini: readonly VodjaTerminCsvRow[]
    prihodki: readonly VodjaPrihodekRow[]
    danesIso: string
  },
  options: VodjaDnevniPdfOptions = {},
): jsPDF {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('buildVodjaDnevniPdfDoc: pričakovan vhod (kpi, termini, prihodki, danesIso)')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildVodjaDnevniPdfDoc: pričakovane opcije (VodjaDnevniPdfOptions)')
  }
  const now = options.now ?? VODJA_PDF_ZIG_FIKSNI
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildVodjaDnevniPdfDoc: pričakovan veljaven now: Date')
  }
  // Vhodna validacija EN VIR iz brata (sporočila VERBATIM, kje = graditelj;
  // fail-closed brezplačno — ISTA strogost kot CSV brat, NIČ podvojenih pravil).
  preveriVodjaIzvozVhod(input, 'buildVodjaDnevniPdfDoc')
  const kje = 'buildVodjaDnevniPdfDoc'
  // KPI vrstice EN VIR (validacija števcev/zneskov + prihodkov vključena —
  // ISTI vrstni red kot CSV vrstice).
  const meritve = vodjaKpiVrstice(input.kpi, input.prihodki, kje)
  // KPI ×4 vrednosti IZRAČUNANE iz (že validiranega) vhoda — NIČ trdo.
  const opozorilaSkupaj =
    input.kpi.potekliOpomniki +
    input.kpi.nizkaZaloga +
    input.kpi.odprtaNarocila +
    input.kpi.brezDobavitelja +
    input.kpi.zamujeneDobave

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / R318 / R321) ----------
  doc.setCreationDate(now)
  doc.setFileId(deterministichenId(`${now.toISOString()}|${resnicaSeed(input)}`))

  // ---------- glava (ISTI vzorec kot družinski dokumenti) ----------
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, 210, 26, 'F')
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...AMBER)
  doc.text('ROKSAL', 14, 12)
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text('Roksal d.o.o. — ograje in balustrade', 14, 17.5)
  doc.text('Cesta Republike 14, 4000 Kranj', 14, 22.5)

  doc.setFont('Roboto', 'bold')
  doc.setFontSize(15)
  doc.text('DNEVNI PREGLED VODJE', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text('deterministični izvoz — EN VIR resnica', 196, 19, { align: 'right' })
  // Referenčni dan arhiva (iz resnice danesIso — ISTI izraz kot CSV glava;
  // čisto stringovno, nič Date API-ja).
  doc.setFontSize(8)
  doc.text(
    `Referenčni dan: ${input.danesIso.slice(8, 10)}.${input.danesIso.slice(5, 7)}.${input.danesIso.slice(0, 4)}`,
    196,
    24,
    { align: 'right' },
  )

  // ---------- KPI povzetek (IZRAČUNAN iz vhoda — NIČ trdo) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Povzetek dne')
  const bw = 44
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Danes termini', String(input.kpi.danasTermini), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Prihodek (plačano)', formatEurCsv(input.kpi.mesecniPrihodek), NAVY)
  kpiBox(
    doc,
    14 + 2 * (bw + gap),
    y,
    bw,
    bh,
    'Zapadlo',
    `${formatEurCsv(input.kpi.zapadloZnesek)} (${input.kpi.zapadloSt})`,
    input.kpi.zapadloSt > 0 ? RED : NAVY,
  )
  kpiBox(
    doc,
    14 + 3 * (bw + gap),
    y,
    bw,
    bh,
    'Opozorila skupaj',
    String(opozorilaSkupaj),
    opozorilaSkupaj > 0 ? AMBER : NAVY,
  )
  y += bh + 8

  // ---------- tabela arhivskih meritev (ENA vrstica = ENA meritev — ISTA
  // ravnina kot CSV vrstice; glava EN VIR VODJA_KPI_GLAVE) ----------
  y = sectionTitle(doc, y, `Arhiv meritev (${meritve.length})`)
  autoTable(doc, {
    startY: y,
    head: [[...VODJA_KPI_GLAVE]],
    body: meritve.map((v) => [v.sekcija, v.kazalnik, v.vrednost]),
    styles: { fontSize: 7.2, cellPadding: 1.2, font: 'Roboto', overflow: 'linebreak' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 7.2 },
    columnStyles: {
      0: { cellWidth: 34 },
      1: { cellWidth: 62 },
      2: { cellWidth: 86, halign: 'right' },
    },
    didParseCell: (data) => {
      // WYSIWYG: sekcija (stolpec 0) bold navy — ISTI signal kot skupine na
      // zaslonu (Danes / Ta mesec / Opozorila / Skupno / Prihodki).
      if (data.section === 'body' && data.column.index === 0) {
        data.cell.styles.textColor = NAVY
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 8

  // ---------- tabela današnjih terminov (glava EN VIR VODJA_TERMINI_GLAVE —
  // ISTI stolpci kot kartica; prazna veja = iskren niz, nič izmišljenih vrstic) ----------
  y = sectionTitle(doc, y, `Današnji termini (${input.termini.length})`)
  if (input.termini.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [[...VODJA_TERMINI_GLAVE]],
      body: input.termini.map((t) => [
        formatUraVodja(t.datumZacetka, kje),
        t.project.nazivProjekta,
        t.project.customer?.ime ?? '',
        t.crew?.naziv ?? '',
        terminStatusLabel(t.status),
      ]),
      styles: { fontSize: 7.2, cellPadding: 1.2, font: 'Roboto', overflow: 'linebreak' },
      headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 7.2 },
      columnStyles: {
        0: { cellWidth: 18, halign: 'center' },
        1: { cellWidth: 64 },
        2: { cellWidth: 42 },
        3: { cellWidth: 34 },
        4: { cellWidth: 24, halign: 'center' },
      },
    })
    y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  } else {
    // Iskrena prazna veja (WYSIWYG: zaslon skrije prazen seznam — tisk pove
    // PRAVICO o odsotnosti, nič izmišljenih vrstic).
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...GRAY)
    doc.text('Brez terminov za ta datum.', 14, y + 4)
    y += 8
  }
  y += 4

  // ---------- sklepna vrstica (EN VIR vir niz — družinski kontrakt R324) ----------
  if (y > 248) {
    doc.addPage()
    y = 20
  }
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  const virVrstice = doc.splitTextToSize(`Vir: ${VODJA_VIR_NIZ}`, 182) as string[]
  doc.text(virVrstice, 14, y + 5)

  // ---------- noge na vseh straneh (brez časa — determinizem) ----------
  const strani = doc.getNumberOfPages()
  for (let i = 1; i <= strani; i++) {
    doc.setPage(i)
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(14, 284, 196, 284)
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...GRAY)
    doc.text('Dnevni pregled vodje · Roksal Field Manager v2.5', 14, 289)
    doc.text(`Stran ${i}/${strani}`, 196, 289, { align: 'right' })
  }

  return doc
}

/** Deterministično ime datoteke: pregled-vodje_<YYYY-MM-DD>.pdf — bratska
 *  simetrija z vodjaCsvFilename (referenčni dan je del resnice). */
export function vodjaDnevniPdfFilename(isoDatum: string): string {
  if (typeof isoDatum !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDatum)) {
    throw new TypeError('vodjaDnevniPdfFilename: pričakovan ISO datum (YYYY-MM-DD)')
  }
  const mesec = Number(isoDatum.slice(5, 7))
  const dan = Number(isoDatum.slice(8, 10))
  if (mesec < 1 || mesec > 12 || dan < 1 || dan > 31) {
    throw new TypeError(`vodjaDnevniPdfFilename: nemogoč datum: ${isoDatum}`)
  }
  return `pregled-vodje_${isoDatum}.pdf`
}

/** Zgeneriraj DNEVNI PREGLED VODJE PDF (determinističen — isti HEAD + isti
 *  vhod = bajtno identičen dokument) in ga shrani kot
 *  `pregled-vodje_<danesIso>.pdf`. */
export function generateVodjaDnevniPdf(input: {
  kpi: VodjaKpi
  termini: readonly VodjaTerminCsvRow[]
  prihodki: readonly VodjaPrihodekRow[]
  danesIso: string
}): void {
  const doc = buildVodjaDnevniPdfDoc(input)
  doc.save(vodjaDnevniPdfFilename(input.danesIso))
}
