// ---------------------------------------------------------------------------
// R327 — 54. člen issue #1 (IZVOZI družina): izvoz ZGODOVINE CEN MATERIALA
// kot DETERMINISTIČNI PDF (arhivski tisk za naročanje/revizijo — bralcu
// brez Excela). PDF BRAT CSV-ju R326 (vzorec R318 audit-pdf / R320 končna /
// R321 zmogljivost / R324 dnevni vodja: LOČEN lib — jsPDF teža NE
// obremenjuje brata cena-zgodovina, ki je čist podatkovni lib).
//
// EN VIR resnice (NIČ dvojnega — vse primitivne izpeljave UVOŽENE iz brata):
//  • vhod = POSREDOVANA resnica CenaZgodovinaPregled — ISTI vhod kot CSV
//    brat (panel: EN pregled, dva potrošnika); PDF NIKOLI ne izmišlja ali
//    ponovno meri podatkov;
//  • podatkovne vrstice parov = cenaParVrstice (UVOŽENE — ISTA preslikava
//    kot CSV strojne vrstice; WYSIWYG bajtno dokazljivo v testih);
//  • glavi = CENA_ZGODOVINA_CSV_GLAVE + CENA_ZGODOVINA_TIMELINE_GLAVE
//    (UVOŽENI — ISTA stolpca kot CSV, ISTI stolpci kot časovna tabela na
//    zaslonu panela; PDF in CSV ne moreta divergirati po konstrukciji);
//  • smer besedila = CENA_SMER_NIZ (UVOŽENO — isti vir kot CSV celica IN
//    panel pripoved);
//  • sklep = cenaZgoSklep (UVOŽEN — ENA preslikava pregleda: zaslon + CSV
//    meta + PDF sklepna vrstica, vzorec AUDIT_VIR_NIZ R318 — ČETRTI
//    potrošnik sklepa);
//  • vir niz = CENA_ZGO_VIR_NIZ (UVOŽEN — sklepna vrstica dokumenta; CSV
//    arhivska oblika R326 ostaja bajtno nespremenjena — kontrakt živi v
//    bratu).
//
// Struktura dokumenta (družinski vzorec R324 dnevni pregled):
//  • ROKSAL glava (navy pas + naslov ZGODOVINA CEN MATERIALA + iskren
//    podnaslov 'deterministični izvoz — EN VIR resnica' — brez lažnih
//    časovnih žigov);
//  • KPI ×4 (IZRAČUNANI iz vhoda — NIČ trdo kodiranih): Pari (navy),
//    Cenovnih vrstic (navy), Narašča (rdeč, če > 0 — iskren alarm stroškov;
//    ISTI števec kot CSV smer narašča prek CENA_SMER_NIZ), Pada (navy); stabilni in prvi
//    vpisi povedani v sklepu (iskrena ničelna veja brez izmišljenih števil);
//  • tabela Pregled parov (glava CENA_ZGODOVINA_CSV_GLAVE — ENA vrstica =
//    EN odločitveni sklop, ISTA ravnina kot CSV vrstice prek
//    cenaParVrstice; PRAZNA veja nemogoča — panel skrije gumb brez podatkov,
//    PDF pa vseeno brani fail-closed prek EN VIR validacije brata);
//  • tabela Časovna vrstica (glava ['Artikel','Dobavitelj',...CENA_ZGO_
//    TIMELINE_GLAVE] — sestavljena iz EN VIR konstant, nič podvojenih
//    besedil; ISTI izrazi rezanja in '—' fallback kot zaslon panela —
//    WYSIWYG);
//  • sklepni vrstici: Sklep (cenaZgoSklep) + Vir (CENA_ZGO_VIR_NIZ).
//
// Determinizem (kanon 46.–53. člen — 'isti HEAD + ISTI vhod = bajtno
// identičen dokument'): vsebina NE nosi časa izvoza (zgodovina cen NIMA
// referenčnega dneva — za razliko od dnevnega pregleda R324 ni datumskega
// dela resnice, zato je tudi filename brez datuma); format PDF pa ZAHTEVA
// CreationDate metadata → KANONSKI fiksni žig CENA_PDF_ZIG_FIKSNI
// (formatna lastnost, NIČ podatkovne resnice) kot privzeti `now`
// (parametriziran SAMO za teste — produkcija kliče brez argumenta; LEKCIJA
// R317 4: fail-closed testi z null); fileId = čista JS FNV-1a nad
// kanonizirano serijalizacijo resnice (vsi pari z vsemi časovniškimi
// vrsticami + vsi števci pregleda — VSE je del resnice; ISTI vrstni red kot
// vhod, nič re-sorta) z LASTNIMI soli 0xd1–0xd4 (register: 0xb0–0xc0
// prejšnje, 0xc1–0xc4 audit-pdf R318, 0xc5–0xc8 končna-pdf R320, 0xc9–0xcc
// zmogljivost-pdf R321, 0xcd–0xd0 vodja-dnevni-pdf R324 — ista semena v
// dveh libih NE smejo dati isti ID).
//
// Fail-closed: ne-objekt pregled / brez seznama pari / pokvaren now /
// pokvaren options → TypeError/Error z imenom graditelja (kanon
// R299/R302/R306/R318 — niz preživi minifikacijo, identifikatorji ne);
// globlja validacija pregleda je ENA v bratu (buildCenaZgodovina) — NIČ
// podvojenih pravil v družini. Obrnjena regresija: PDF funkcij NI v bratu
// cena-zgodovina (cikel in duplikat tiran — ena definicija, EN lib;
// r318 lekcija 1).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import {
  cenaParVrstice,
  cenaZgoSklep,
  CENA_SMER_NIZ,
  CENA_ZGODOVINA_CSV_GLAVE,
  CENA_ZGODOVINA_TIMELINE_GLAVE,
  CENA_ZGO_VIR_NIZ,
} from './cena-zgodovina'
import type { CenaParZgodovina, CenaZgodovinaPregled } from './cena-zgodovina'

// ---------- barve (ISTI dokumenti družina — usklajeno z R318/R320/R321/R324) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const RED: [number, number, number] = [220, 38, 38] // iskren alarm (narašča)
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

/** Kanonski fiksni žig CreationDate (determinizem — kanon 46.–53. člen).
 *  Format PDF zahteva CreationDate; vsebina NE nosi časa. NIČ podatkovne
 *  resnice — samo formatna lastnost dokumenta. */
export const CENA_PDF_ZIG_FIKSNI = new Date(Date.UTC(2026, 0, 1, 0, 0, 0))

export interface CenaZgodovinaPdfOptions {
  /** Formatni žig CreationDate — PRIVZETO kanonski fiksni žig (determinizem:
   *  produkcija kliče brez argumenta = isti HEAD + isti vhod → bajtno
   *  identičen PDF). Parametriziran SAMO za teste (kanon pregled). */
  now?: Date
}

/** Determinističen file-ID (32 hex) — čista JS FNV-1a; LASTNI soli 0xd1–0xd4. */
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
    fnv1aHex(seed, 0xd1) +
    fnv1aHex(seed, 0xd2) +
    fnv1aHex(seed, 0xd3) +
    fnv1aHex(seed, 0xd4)
  )
}

/** Kanoniziran seed resnice — vsi pari (z vsemi časovniškimi vrsticami) +
 *  vsi števci pregleda SO del resnice; serijalizacija = določevalna funkcija
 *  vsebine (ISTI vrstni red kot vhod — nič re-sorta). */
function resnicaSeed(pregled: CenaZgodovinaPregled): string {
  const pariDel = pregled.pari
    .map((p) => seedParga(p))
    .join(';')
  return (
    `P:${pariDel}` +
    `|V:${pregled.vnosov}` +
    `|N:${pregled.narascajo}` +
    `|D:${pregled.padajo}` +
    `|S:${pregled.stabilnih}` +
    `|F:${pregled.prvihVpisov}`
  )
}

function seedParga(p: CenaParZgodovina): string {
  const casovnica = p.casovnica
    .map((v) => `${v.cena}@${v.veljavnostOd}#${v.veljavnostDo ?? 'odprta'}@${v.opomba ?? ''}`)
    .join(',')
  return (
    `${p.inventoryId}#${p.supplierId}@${p.artikel}|${p.dobavitelj}` +
    `@${p.trenutna.cena}@${p.prejsnja ? p.prejsnja.cena : 'brez'}` +
    `@${p.deltaEur ?? 'brez'}@${p.deltaOdstotek ?? 'brez'}@${p.smer ?? 'prvi'}` +
    `@${p.zaprtih}[${casovnica}]`
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

/** KPI polje — ISTI vzorec kot audit/zmogljivost/konflikti/dnevni (družinski kpiBox). */
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

/** Zgradi ZGODOVINA CEN MATERIALA dokument (brez shranjevanja) — vrne jsPDF
 *  instanco (testi berejo doc.output('arraybuffer') → bajtni dokazi).
 *  Vhod = POSREDOVANA resnica (EN VIR z CSV bratom); options parametriziran
 *  SAMO za teste fail-closed poti (null NE undefined — lekcija R317 4). */
export function buildCenaZgodovinaPdfDoc(
  pregled: CenaZgodovinaPregled,
  options: CenaZgodovinaPdfOptions = {},
): jsPDF {
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildCenaZgodovinaPdfDoc: pričakovane opcije (CenaZgodovinaPdfOptions)')
  }
  const now = options.now ?? CENA_PDF_ZIG_FIKSNI
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildCenaZgodovinaPdfDoc: pričakovan veljaven now: Date')
  }
  const kje = 'buildCenaZgodovinaPdfDoc'
  // Podatkovne vrstice EN VIR iz brata (validacija oblike pregleda vključena
  // — ISTI fail-closed kot CSV brat: 'pregled mora nositi seznam pari';
  // globlja validacija vrstic je ENA v buildCenaZgodovina — NIČ podvojenih).
  const vrstice = cenaParVrstice(pregled, kje)

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / R318 / R321 / R324) ----------
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
  doc.text('ZGODOVINA CEN MATERIALA', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text('deterministični izvoz — EN VIR resnica', 196, 19, { align: 'right' })

  // ---------- KPI povzetek (IZRAČUNAN iz vhoda — NIČ trdo) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Povzetek')
  const bw = 44
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Pari material × dobavitelj', String(pregled.pari.length), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Cenovnih vrstic', String(pregled.vnosov), NAVY)
  kpiBox(
    doc,
    14 + 2 * (bw + gap),
    y,
    bw,
    bh,
    'Narašča',
    String(pregled.narascajo),
    pregled.narascajo > 0 ? RED : NAVY,
  )
  kpiBox(doc, 14 + 3 * (bw + gap), y, bw, bh, 'Pada', String(pregled.padajo), NAVY)
  y += bh + 8

  // ---------- tabela parov (ENA vrstica = EN odločitveni sklop — ISTA
  // ravnina kot CSV vrstice prek cenaParVrstice; glava EN VIR CSV_GLAVE) ----------
  y = sectionTitle(doc, y, `Pregled parov (${vrstice.length})`)
  autoTable(doc, {
    startY: y,
    head: [[...CENA_ZGODOVINA_CSV_GLAVE]],
    body: vrstice,
    styles: { fontSize: 7.2, cellPadding: 1.2, font: 'Roboto', overflow: 'linebreak' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 7.2 },
    columnStyles: {
      0: { cellWidth: 34 },
      1: { cellWidth: 32 },
      2: { cellWidth: 20, halign: 'right' },
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 18, halign: 'right' },
      5: { cellWidth: 16, halign: 'right' },
      6: { cellWidth: 18, halign: 'center' },
      7: { cellWidth: 24, halign: 'center' },
    },
    didParseCell: (data) => {
      // WYSIWYG: smer (stolpec 6) pripoveduje ISTO kot panel — narašča rdeče
      // (iskren alarm), pada zeleno ni v PDF družini (navy), prvi vpis sivo.
      if (data.section === 'body' && data.column.index === 6) {
        data.cell.styles.textColor =
          data.cell.raw === CENA_SMER_NIZ.narasca ? RED : NAVY
      }
    },
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 8

  // ---------- tabela časovne vrstice (ISTI stolpci kot časovna tabela na
  // zaslonu panela — glava sestavljena iz EN VIR konstant; ISTI izrazi
  // rezanja in '—' fallback kot zaslon — WYSIWYG; prazna veja nemogoča:
  // vsak par nosi NATANKO eno odprto ceno, panel skrije gumb brez podatkov) ----------
  const casovnicnih = pregled.pari.reduce((n, p) => n + p.casovnica.length, 0)
  y = sectionTitle(doc, y, `Časovna vrstica (${casovnicnih})`)
  autoTable(doc, {
    startY: y,
    head: [['Artikel', 'Dobavitelj', ...CENA_ZGODOVINA_TIMELINE_GLAVE]],
    body: pregled.pari.flatMap((p) =>
      p.casovnica.map((v) => [
        p.artikel,
        p.dobavitelj,
        v.cena.toFixed(2),
        v.veljavnostOd.slice(0, 10),
        v.veljavnostDo ? v.veljavnostDo.slice(0, 10) : '—',
        v.opomba ?? '—',
      ]),
    ),
    styles: { fontSize: 7.2, cellPadding: 1.2, font: 'Roboto', overflow: 'linebreak' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 7.2 },
    columnStyles: {
      0: { cellWidth: 36 },
      1: { cellWidth: 36 },
      2: { cellWidth: 22, halign: 'right' },
      3: { cellWidth: 26, halign: 'center' },
      4: { cellWidth: 26, halign: 'center' },
      5: { cellWidth: 36 },
    },
    didParseCell: (data) => {
      // WYSIWYG: odprta cena (Do = '—') pomeni TRENUTNO veljavno — izrazit navy.
      if (data.section === 'body' && data.column.index === 4 && data.cell.raw === '—') {
        data.cell.styles.textColor = NAVY
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 4

  // ---------- sklepni vrstici (EN VIR sklep + vir — družinski kontrakt R327) ----------
  if (y > 240) {
    doc.addPage()
    y = 20
  }
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  const sklepVrstice = doc.splitTextToSize(`Sklep: ${cenaZgoSklep(pregled)}`, 182) as string[]
  doc.text(sklepVrstice, 14, y + 5)
  const virVrstice = doc.splitTextToSize(`Vir: ${CENA_ZGO_VIR_NIZ}`, 182) as string[]
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
    doc.text('Zgodovina cen materiala · Roksal Field Manager v2.5', 14, 289)
    doc.text(`Stran ${i}/${strani}`, 196, 289, { align: 'right' })
  }

  return doc
}

/** Deterministično ime datoteke: zgodovina-cen.pdf — bratska simetrija z
 *  zgodovina-cen.csv (zgodovina cen NIMA referenčnega dneva — datum NI del
 *  resnice, zato filename brez datuma; vzorec 47.–53. člen). */
export function cenaZgodovinaPdfFilename(): string {
  return 'zgodovina-cen.pdf'
}

/** Zgeneriraj ZGODOVINA CEN MATERIALA PDF (determinističen — isti HEAD + isti
 *  vhod = bajtno identičen dokument) in ga shrani kot `zgodovina-cen.pdf`. */
export function generateCenaZgodovinaPdf(pregled: CenaZgodovinaPregled): void {
  const doc = buildCenaZgodovinaPdfDoc(pregled)
  doc.save(cenaZgodovinaPdfFilename())
}
