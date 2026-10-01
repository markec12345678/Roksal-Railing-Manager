// ---------------------------------------------------------------------------
// R329 — 56. člen issue #1 (IZVOZI družina): izvoz PRIMERJAVE DOBAVITELJEV
// kot DETERMINISTIČNI PDF (arhivski tisk za naročanje/revizijo — bralcu
// brez Excela). PDF BRAT CSV-ju R328 (vzorec R318 audit-pdf / R320 končna /
// R321 zmogljivost / R324 dnevni / R327 zgodovina-cen: LOČEN lib — jsPDF
// teža NE obremenjuje brata cena-dobavitelji, ki je čist podatkovni lib).
//
// EN VIR resnice (NIČ dvojnega — vse primitivne izpeljave UVOŽENE iz brata):
//  • vhod = POSREDOVANA resnica CenaZgodovinaPregled — ISTI vhod kot CSV
//    brat (panel: EN pregled, TRIje potrošniki: zaslon + CSV + PDF); PDF
//    NIKOLI ne izmišlja ali ponovno meri podatkov;
//  • agregacija = buildCenaDobavitelje (UVOŽENA — ISTA projekcija po
//    dobaviteljih, ISTA validacija ×6 skupin podedovana; globlja validacija
//    ostaja ENA v bratu — NIČ podvojenih pravil v družini);
//  • podatkovne vrstice = cenaDobaviteljiVrstice (UVOŽENE — ISTA preslikava
//    kot CSV strojne vrstice; WYSIWYG bajtno dokazljivo v testih);
//  • glave = CENA_DOBAVITELJI_CSV_GLAVE (UVOŽENE — ISTA stolpca kot CSV,
//    ISTI stolpci kot tabelska resnica na zaslonu panela; PDF in CSV ne
//    moreta divergirati po konstrukciji);
//  • sklep = cenaDobaviteljiSklep (UVOŽEN — ENA preslikava: zaslon + CSV
//    meta + PDF sklepna vrstica, vzorec cenaZgoSklep R327 — ČETRTI
//    potrošnik sklepa);
//  • vir niz = CENA_DOBAVITELJI_VIR_NIZ (UVOŽEN — sklepna vrstica
//    dokumenta; CSV arhivska oblika R328 ostaja bajtno nespremenjena —
//    kontrakt živi v bratu).
//
// Struktura dokumenta (družinski vzorec R327 zgodovina-cen):
//  • ROKSAL glava (navy pas + naslov PRIMERJAVA DOBAVITELJEV + iskren
//    podnaslov 'deterministični izvoz — EN VIR resnica' — brez lažnih
//    časovnih žigov);
//  • KPI ×4 (IZRAČUNANI iz vhoda — NIČ trdo kodiranih): Dobaviteljev
//    (navy), Parov material × dobavitelj (navy — kontrolna vsota brati
//    sama), Narašča (rdeč, če > 0 — iskren alarm stroškov; ISTI števec kot
//    CSV stolpec Narašča), Pada (navy); stabilni in prvi vpisi povedani v
//    sklepu (iskrena ničelna veja brez izmišljenih števil);
//  • tabela Primerjava po dobaviteljih (glava CENA_DOBAVITELJI_CSV_GLAVE —
//    ENA vrstica = EN dobavitelj, ISTA ravnina kot CSV vrstice prek
//    cenaDobaviteljiVrstice; PRAZNA veja nemogoča — panel skrije gumba
//    brez podatkov, PDF pa vseeno brani fail-closed prek EN VIR validacije
//    brata);
//  • sklepni vrstici: Sklep (cenaDobaviteljiSklep) + Vir
//    (CENA_DOBAVITELJI_VIR_NIZ).
//
// Determinizem (kanon 46.–56. člen — 'isti HEAD + ISTI vhod = bajtno
// identičen dokument'): vsebina NE nosi časa izvoza (primerjava NIMA
// referenčnega dneva — filename brez datuma, bratska simetrija z
// primerjava-dobaviteljev.csv); format PDF pa ZAHTEVA CreationDate
// metadata → KANONSKI fiksni žig DOBAVITELJI_PDF_ZIG_FIKSNI (formatna
// lastnost, NIČ podatkovne resnice) kot privzeti `now` (parametriziran
// SAMO za teste — produkcija kliče brez argumenta; LEKCIJA R317 4:
// fail-closed testi z null); fileId = čista JS FNV-1a nad kanonizirano
// serijalizacijo PROJEKCIJE (vsi dobavitelji z vsemi števci + kontrolna
// vsota parov — VSE je del resnice; ISTI vrstni red kot vhod [sortiran v
// bratu po nazivu, nato supplierId UTF-16] — nič re-sorta) z LASTNIMI
// soli 0xd5–0xd8 (register: 0xb0–0xc0 prejšnje, 0xc1–0xc4 audit-pdf R318,
// 0xc5–0xc8 končna-pdf R320, 0xc9–0xcc zmogljivost-pdf R321, 0xcd–0xd0
// vodja-dnevni-pdf R324, 0xd1–0xd4 cena-zgodovina-pdf R327 — ista semena v
// dveh libih NE smejo dati isti ID).
//
// Fail-closed: ne-objekt pregled / brez seznama pari / pokvaren now /
// pokvaren options → TypeError/Error z imenom graditelja (kanon
// R299/R302/R306/R318 — niz preživi minifikacijo, identifikatorji ne);
// validacija pregleda je ENA v bratu (buildCenaDobavitelje ×6 skupin) —
// NIČ podvojenih pravil v družini. Obrnjena regresija: PDF funkcij NI v
// bratu cena-dobavitelji (cikel in duplikat tiran — ena definicija, EN
// lib; r318 lekcija 1).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import {
  buildCenaDobavitelje,
  cenaDobaviteljiSklep,
  cenaDobaviteljiVrstice,
  CENA_DOBAVITELJI_CSV_GLAVE,
  CENA_DOBAVITELJI_VIR_NIZ,
} from './cena-dobavitelji'
import type { CenaDobaviteljVrstica, CenaDobaviteljiPregled } from './cena-dobavitelji'
import type { CenaZgodovinaPregled } from './cena-zgodovina'

// ---------- barve (ISTI dokumenti družina — usklajeno z R318/R320/R321/R324/R327) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const RED: [number, number, number] = [220, 38, 38] // iskren alarm (narašča)
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

/** Kanonski fiksni žig CreationDate (determinizem — kanon 46.–56. člen).
 *  Format PDF zahteva CreationDate; vsebina NE nosi časa. NIČ podatkovne
 *  resnice — samo formatna lastnost dokumenta. */
export const DOBAVITELJI_PDF_ZIG_FIKSNI = new Date(Date.UTC(2026, 0, 1, 0, 0, 0))

export interface CenaDobaviteljiPdfOptions {
  /** Formatni žig CreationDate — PRIVZETO kanonski fiksni žig (determinizem:
   *  produkcija kliče brez argumenta = isti HEAD + isti vhod → bajtno
   *  identičen PDF). Parametriziran SAMO za teste (kanon pregled). */
  now?: Date
}

/** Determinističen file-ID (32 hex) — čista JS FNV-1a; LASTNI soli 0xd5–0xd8. */
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
    fnv1aHex(seed, 0xd5) +
    fnv1aHex(seed, 0xd6) +
    fnv1aHex(seed, 0xd7) +
    fnv1aHex(seed, 0xd8)
  )
}

/** Kanoniziran seed resnice — celotna PROJEKCIJA (vsi dobavitelji z vsemi
 *  števci + kontrolna vsota parov) JE del resnice; serijalizacija =
 *  določevalna funkcija vsebine (ISTI vrstni red kot vhod — sortiran v
 *  bratu, nič re-sorta). */
function resnicaSeed(pregled: CenaDobaviteljiPregled): string {
  const del = pregled.dobavitelji.map((d) => seedDobavitelja(d)).join(';')
  return `D:${del}|P:${pregled.parov}`
}

function seedDobavitelja(d: CenaDobaviteljVrstica): string {
  return (
    `${d.supplierId}#${d.dobavitelj}` +
    `@${d.materialov}@${d.vpisov}@${d.narasca}@${d.pada}` +
    `@${d.stabilna}@${d.prvihVpisov}` +
    `@${d.najnizja.toFixed(2)}@${d.najvisja.toFixed(2)}`
  )
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

/** KPI polje — ISTI vzorec kot audit/zmogljivost/konflikti/dnevni/zgodovina (družinski kpiBox). */
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

/** Zgradi PRIMERJAVA DOBAVITELJEV dokument (brez shranjevanja) — vrne jsPDF
 *  instanco (testi berejo doc.output('arraybuffer') → bajtni dokazi).
 *  Vhod = POSREDOVANA resnica (EN VIR z CSV bratom); options parametriziran
 *  SAMO za teste fail-closed poti (null NE undefined — lekcija R317 4). */
export function buildCenaDobaviteljePdfDoc(
  pregledZgo: CenaZgodovinaPregled,
  options: CenaDobaviteljiPdfOptions = {},
): jsPDF {
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildCenaDobaviteljePdfDoc: pričakovane opcije (CenaDobaviteljiPdfOptions)')
  }
  const now = options.now ?? DOBAVITELJI_PDF_ZIG_FIKSNI
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildCenaDobaviteljePdfDoc: pričakovan veljaven now: Date')
  }
  const kje = 'buildCenaDobaviteljePdfDoc'
  // Projekcija EN VIR iz brata (validacija oblike pregleda vključena — ISTI
  // fail-closed ×6 skupin kot CSV brat; globlja validacija = ENA v bratu —
  // NIČ podvojenih pravil).
  const pregled = buildCenaDobavitelje(pregledZgo, kje)
  const vrstice = cenaDobaviteljiVrstice(pregled, kje)

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / R318 / R321 / R324 / R327) ----------
  doc.setCreationDate(now)
  doc.setFileId(deterministichenId(`${now.toISOString()}|${resnicaSeed(pregled)}`))

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
  doc.text('PRIMERJAVA DOBAVITELJEV', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text('deterministični izvoz — EN VIR resnica', 196, 19, { align: 'right' })

  // ---------- KPI povzetek (IZRAČUNAN iz vhoda — NIČ trdo) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Povzetek')
  const narascaSkupaj = pregled.dobavitelji.reduce((v, d) => v + d.narasca, 0)
  const padaSkupaj = pregled.dobavitelji.reduce((v, d) => v + d.pada, 0)
  const bw = 44
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Dobaviteljev', String(pregled.dobavitelji.length), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Parov material × dobavitelj', String(pregled.parov), NAVY)
  kpiBox(
    doc,
    14 + 2 * (bw + gap),
    y,
    bw,
    bh,
    'Narašča',
    String(narascaSkupaj),
    narascaSkupaj > 0 ? RED : NAVY,
  )
  kpiBox(doc, 14 + 3 * (bw + gap), y, bw, bh, 'Pada', String(padaSkupaj), NAVY)
  y += bh + 8

  // ---------- tabela primerjave (ENA vrstica = EN dobavitelj — ISTA ravnina
  // kot CSV vrstice prek cenaDobaviteljiVrstice; glava EN VIR CSV_GLAVE;
  // WYSIWYG: Narašča > 0 rdeče = iskren alarm stroškov — ISTA barvna
  // resnica kot KPI; Pada > 0 navy) ----------
  y = sectionTitle(doc, y, `Primerjava po dobaviteljih (${vrstice.length})`)
  autoTable(doc, {
    startY: y,
    head: [[...CENA_DOBAVITELJI_CSV_GLAVE]],
    body: vrstice,
    styles: { fontSize: 7.2, cellPadding: 1.2, font: 'Roboto', overflow: 'linebreak' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 7.2 },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 16, halign: 'right' },
      2: { cellWidth: 20, halign: 'right' },
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 15, halign: 'center' },
      5: { cellWidth: 17, halign: 'center' },
      6: { cellWidth: 17, halign: 'center' },
      7: { cellWidth: 21, halign: 'right' },
      8: { cellWidth: 21, halign: 'right' },
    },
    didParseCell: (data) => {
      // WYSIWYG: števec Narašča (stolpec 3) > 0 = iskren alarm stroškov
      // (ISTI rdeči pomen kot KPI in kot smer cela v bratu zgodovina-cen
      // R327); Pada (stolpec 4) > 0 = navy (družinska paleta — pada NI
      // zelen v PDF družini).
      if (data.section === 'body' && data.column.index === 3 && data.cell.raw !== '0') {
        data.cell.styles.textColor = RED
      }
      if (data.section === 'body' && data.column.index === 4 && data.cell.raw !== '0') {
        data.cell.styles.textColor = NAVY
      }
    },
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 4

  // ---------- sklepni vrstici (EN VIR sklep + vir — družinski kontrakt R328) ----------
  if (y > 240) {
    doc.addPage()
    y = 20
  }
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  const sklepVrstice = doc.splitTextToSize(`Sklep: ${cenaDobaviteljiSklep(pregled)}`, 182) as string[]
  doc.text(sklepVrstice, 14, y + 5)
  const virVrstice = doc.splitTextToSize(`Vir: ${CENA_DOBAVITELJI_VIR_NIZ}`, 182) as string[]
  doc.text(virVrstice, 14, y + 5 + sklepVrstice.length * 3.6)

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
    doc.text('Primerjava dobaviteljev · Roksal Field Manager v2.5', 14, 289)
    doc.text(`Stran ${i}/${strani}`, 196, 289, { align: 'right' })
  }

  return doc
}

/** Deterministično ime datoteke: primerjava-dobaviteljev.pdf — bratska
 *  simetrija z primerjava-dobaviteljev.csv (primerjava NIMA referenčnega
 *  dneva — datum NI del resnice, zato filename brez datuma; vzorec
 *  47.–56. člen). */
export function cenaDobaviteljiPdfFilename(): string {
  return 'primerjava-dobaviteljev.pdf'
}

/** Zgeneriraj PRIMERJAVA DOBAVITELJEV PDF (determinističen — isti HEAD + isti
 *  vhod = bajtno identičen dokument) in ga shrani kot
 *  `primerjava-dobaviteljev.pdf`. */
export function generateCenaDobaviteljePdf(pregledZgo: CenaZgodovinaPregled): void {
  const doc = buildCenaDobaviteljePdfDoc(pregledZgo)
  doc.save(cenaDobaviteljiPdfFilename())
}
