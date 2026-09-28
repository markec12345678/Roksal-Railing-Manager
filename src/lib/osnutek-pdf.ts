// ---------------------------------------------------------------------------
// R237 (P1-c 'izvozi' družina — PDF dimenzija, 4. člen) — NAROČILNICA OSNUTEK
// PDF iz Osnutek dialoga (Material → Zaloga → 'Osnutek naročila'). CSV priloga
// obstaja od R205 (narocilnicaCsvVrstice); ta lib je njen PRAVI PDF brat —
// INTERNI dokument za potrditev naročilnega osnutka PRED pošiljanjem
// (razlikuje se od NAROČILNICA R235, ki je priloga dobavitelju iz POSLANEGA/
// sledljivega naročila). Vzorec: zaloga-pdf R234 / naročilnica-pdf R235 /
// dobavitelji-pdf R236 — ROKSAL glava, KPI, autoTable, noge, bajtni
// determinizem.
//
// ENA RESNICA z odložiščem R204 / CSV R205 (WYSIWYG — brat iz ISTEGA vira):
//  • količina 'Naroči' = narociloKolicina(a) — ISTA ENA formula kot odložišče
//    R204 in CSV R205 (max(min − zaloga, min) po preveriArtikel);
//  • stolpci tabele = TOČNO ISTI prerez kot CSV R205 (Šifra, Naziv, Enota,
//    Zaloga, Min. zaloga, Naroči);
//  • BREZ CEN (družinsko pravilo R204/R205/R235): cenaEur je pogosto null,
//    UI-jeva ocena po tipu je izrecno 'demo' približek — ocenjene vrednosti
//    NE gredo v dokument;
//  • opombe nosi LE, če dejansko obstajajo (R206/R227 pravilo — brez
//    izmišljenega konteksta);
//  • KPI škatle se RAČUNAJO iz posredovanih vrstic (postavke / različne
//    enote prek Set) — dokument vedno notranje skladen; SKUPNA količina NI
//    KPI (različne enote se NE smejo seštevati — kos + m = ne-smisel).
//
// Načela (družinska pravila):
//  • Fail-closed: pokvaren artikel ALI artikel NAD minimumom → TypeError
//    (delegirano na narociloKolicina — ISTO preverba kot odložišče/CSV).
//    PRAZEN SEZNAM ne nastaja dokumenta (R232–R236 družina: ni prazne
//    datoteke; dialog gumb je disabled na 0 — ISTA semantika kot CSV sorojec).
//  • Determinizem: `now` pride KOT parameter; doc.setCreationDate(now) +
//    doc.setFileId(FNV-1a, LASTNI soli 0x31–0x34 — 4. lib družine) — enak
//    vhod = bajtno enak PDF (document-pdf R121 100× pravilo).
//  • CLIENT-safe: uvozi ga inventory-tab (client) — node:crypto NE sme v
//    client bundle (lekcija R234); FNV-1a = čista JS (zasebna kopija
//    zaloga-pdf vzorca — dokumentirana duplikacija različnih runtimes).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { todayStamp } from './csv-export'
import {
  narociloKolicina,
  zalogaPovzetekBeseda,
  zalogaPovzetekCasOznaka,
  type ZalogaArtikelZaNarocilo,
} from './zaloga-povzetek'

// ---------- barve (USKLAJENO z boss-report družino — ISTI dokumenti) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

export interface OsnutekPdfOptions {
  /** Referenčni trenutek (žig + CreationDate + fileId + ime) — KOT PARAMETER
   *  (determinizem, vzorec R203/R204/R167). */
  now: Date
  /** Opcijske opombe osnutka (R205 dialog polje) — LE ko dejansko obstajajo;
   *  prazen/blank → brez omembe (R206/R227 pravilo). */
  opombe?: string | null
}

/** Determinističen file-ID (32 hex) iz semena — čista JS FNV-1a (CLIENT-safe;
 *  LASTNI soli 0x31–0x34: zaloga 0x01–04, naročilnica 0x11–14, dobavitelji
 *  0x21–24, osnutek 0x31–34 — vsak lib družine svoje). */
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
    fnv1aHex(seed, 0x31) +
    fnv1aHex(seed, 0x32) +
    fnv1aHex(seed, 0x33) +
    fnv1aHex(seed, 0x34)
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

/** KPI polje — ISTI vzorec kot zaloga-pdf/naročilnica/dobavitelji/boss-report. */
function kpiBox(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  color: [number, number, number]
): void {
  doc.setFillColor(...LIGHT)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(x, y, w, h, 2, 2, 'FD')
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...GRAY)
  doc.text(label.toUpperCase(), x + 3, y + 5.5)
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...color)
  doc.text(value, x + 3, y + 13)
}

/** Ime datoteke — `osnutek-narocilnica-YYYY-MM-DD.pdf` (ISTI dan kot todayStamp
 *  CSV priloge R205 `narocilnica-…csv`; ločen prefix od POSLANE NAROČILNICE
 *  R235 `narocilnica-{dobavitelj}-…` — dva različna dokumenta, dve rabi). */
export function osnutekPdfFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('osnutekPdfFilename: pričakovan veljaven now: Date')
  }
  return `osnutek-narocilnica-${todayStamp(now)}.pdf`
}

/** Zgradi NAROČILNICO OSNUTKA (brez shranjevanja) — vrne jsPDF instanco
 *  (testi berejo doc.output('arraybuffer') → bajtni dokazi).
 *
 *  Fail-closed: validacija per artikel je POVSEM delegirana na
 *  narociloKolicina (preveriArtikel + nad-minimum TypeError — ISTO sporočilo
 *  kot odložišče R204 in CSV R205); ta funkcija DODA samo rendersko logiko. */
export function buildOsnutekPdfDoc(
  artikli: readonly ZalogaArtikelZaNarocilo[],
  options: OsnutekPdfOptions,
): jsPDF {
  if (!Array.isArray(artikli)) {
    throw new TypeError('buildOsnutekPdfDoc: pričakovano polje artiklov (ZalogaArtikelZaNarocilo[])')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildOsnutekPdfDoc: pričakovane opcije (OsnutekPdfOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildOsnutekPdfDoc: pričakovan veljaven now: Date')
  }
  // PRAZEN SEZNAM ne nastaja dokumenta (R232–R236 družina — ni prazne
  // datoteke; dialog gumb je disabled na 0, ISTA semantika kot CSV sorojec).
  if (artikli.length === 0) {
    throw new TypeError(
      'buildOsnutekPdfDoc: prazen seznam ne nastaja dokumenta — ni artiklov pod minimalno zalogo za naročilo',
    )
  }
  // ENA RESNICA — delegirana validacija + ENA formula količine (ISTI klic
  // kot CSV R205): pokvaren artikel / artikel nad minimumom → ISTO TypeError.
  const kolicine = artikli.map((a) => narociloKolicina(a))

  // KPI se RAČUNAJO iz vrstic (notranja skladnost; brez skupne količine —
  // različne enote se ne seštevajo).
  const enote = new Set(artikli.map((a) => a.enota.trim()))

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / zaloga R234 / naročilnica R235 / dobavitelji R236) ----------
  doc.setCreationDate(now)
  doc.setFileId(
    deterministichenId(
      `${now.toISOString()}|${artikli
        .map((a, i) => `${a.sifraMateriala.trim()}:${kolicine[i]}/${a.enota.trim()}`)
        .join(',')}`,
    ),
  )

  // ---------- glava (ISTI vzorec kot družina) ----------
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
  doc.text('NAROČILNICA OSNUTEK', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })

  // ---------- podnaslov (interni dokument — pošiljanje gre prek Naročil) ----------
  let y = 33
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...GRAY)
  doc.text('Interni dokument — priprava naročilnega osnutka iz zaloge pod minimumom.', 14, y)
  y += 7

  // ---------- KPI povzetek (izračun iz vrstic — notranja skladnost) ----------
  y = sectionTitle(doc, y, 'Povzetek osnutka')
  const bw = 42
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Postavke', String(artikli.length), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Različne enote', String(enote.size), NAVY)
  y += bh + 8

  // ---------- tabela (ENA resnica = stolpci CSV R205; količina = ISTA formula) ----------
  y = sectionTitle(doc, y, `Postavke (${artikli.length})`)
  autoTable(doc, {
    startY: y,
    head: [['Šifra', 'Naziv', 'Enota', 'Zaloga', 'Min. zaloga', 'Naroči']],
    body: artikli.map((a, i) => [
      a.sifraMateriala.trim(),
      a.naziv.trim(),
      a.enota.trim(),
      String(a.kolicinaZaloga),
      String(a.minimalnaZaloga),
      String(kolicine[i]),
    ]),
    styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 30 },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right', cellWidth: 22 },
    },
    didParseCell: (data) => {
      // 'Naroči' = KLJUČNA kolona dokumenta (odločitev naročila) — navy bold
      // (poudarek pomembnosti, NE alarm — rdeča je rezervirana za zalogovne
      // alarme v zaloga-pdf; ISTI pomen kot navy glava/žetoni na zaslonu).
      if (data.section === 'body' && data.column.index === 5) {
        data.cell.styles.textColor = NAVY
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 6

  // ---------- opomba (LE če dejansko obstaja — R206/R227 pravilo) ----------
  const opombe = typeof options.opombe === 'string' ? options.opombe.trim() : ''
  if (opombe !== '') {
    y = sectionTitle(doc, y, 'Opomba')
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...NAVY)
    const vrstice = doc.splitTextToSize(opombe, 182) as string[]
    doc.text(vrstice, 14, y + 2)
    y += vrstice.length * 4.6 + 4
  }

  // ---------- sklepna vrstica (ISTA sklanjatev + žig kot odložišče/CSV) ----------
  if (y > 255) {
    doc.addPage()
    y = 20
  }
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text(
    `${artikli.length} ${zalogaPovzetekBeseda(artikli.length)} · osveženo ${zalogaPovzetekCasOznaka(now)}.`,
    14,
    y + 4,
  )

  // ---------- noge na vseh straneh (ISTI vzorec kot družina) ----------
  const strani = doc.getNumberOfPages()
  const genStr = `Generirano ${zalogaPovzetekCasOznaka(now)}`
  for (let i = 1; i <= strani; i++) {
    doc.setPage(i)
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(14, 284, 196, 284)
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...GRAY)
    doc.text(`${genStr} · Roksal Field Manager v2.5`, 14, 289)
    doc.text(`Stran ${i}/${strani}`, 196, 289, { align: 'right' })
  }

  return doc
}

/** Zgeneriraj NAROČILNICO OSNUTEK PDF (deterministično — enak vhod = bajtno
 *  enak dokument) in jo shrani kot `osnutek-narocilnica-YYYY-MM-DD.pdf`. */
export function generateOsnutekPdf(
  artikli: readonly ZalogaArtikelZaNarocilo[],
  options: OsnutekPdfOptions,
): void {
  const doc = buildOsnutekPdfDoc(artikli, options)
  doc.save(osnutekPdfFilename(options.now))
}
