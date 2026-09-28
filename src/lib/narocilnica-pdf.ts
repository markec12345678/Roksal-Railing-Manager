// ---------------------------------------------------------------------------
// R235 (P1-c 'izvozi' družina — PDF dimenzija, 2. člen) — NAROČILNICA PDF IZ
// NAROČILA (Material → Naročila, per kartica). Tekstovna naročilnica obstaja
// od R206 (buildNarocilnicaIzNarocila — odložišče za e-pošto/SMS); ta lib je
// njen PRAVI PDF brat (priloga dobavitelju — vzorec zaloga-pdf R234: ROKSAL
// glava, KPI, autoTable, noge, bajtni determinizem).
//
// ENA RESNICA z tekstovno naročilnico (WYSIWYG — brata iz ISTEGA vira):
//  • validacija je POVSEM delegirana na buildNarocilnicaIzNarocila(order,
//    {now}) — pokvaren vnos vrže ISTO TypeError sporočilo v OBEH bratih
//    (PDF ne more obstajati, kjer tekstovna naročilnica ne more — in obratno);
//  • tabela nosi TOČNO ISTA dejstva per postavko kot besedilne vrstice
//    `{i+1}. {naziv}: {količina} {enota}` (Št./Naziv/Količina/Enota);
//  • sklepnа vrstica uporablja ISTO sklanjatev (narociloPostavkaBeseda) in
//    ISTI časovni žig (zalogaPovzetekCasOznaka) kot 2. vrstica tekstovne;
//  • BREZ VREDNOSTI IZ UI (družinsko pravilo R204/R206): dokument NE IZMIŠLJA
//    cen (v dokumentu ni znaka € — cenaEur je pogosto null, manjkajoče in
//    realne vrednosti bi se v skupnem dokumentu zmešale).
//
// Načela (družinska pravila):
//  • Fail-closed: pokvaren vnos → TypeError (delegirano); naročilo BREZ
//    postavk ne nastaja dokumenta (strežnik zahteva ≥1 — R206 pravilo).
//  • Determinizem: `now` pride KOT parameter; doc.setCreationDate(now) +
//    doc.setFileId(FNV-1a) — enak vhod = bajtno enak PDF (document-pdf R121,
//    zaloga-pdf R234 100× pravilo).
//  • CLIENT-safe: uvozi ga material-intelligence-tab (client) — node:crypto
//    NE sme v client bundle (lekcija R234); FNV-1a = čista JS (zasebna
//    kopija zaloga-pdf vzorca — dokumentirana duplikacija različnih runtimes).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { todayStamp } from './csv-export'
import {
  buildNarocilnicaIzNarocila,
  narociloPostavkaBeseda,
  zalogaPovzetekCasOznaka,
  type NarociloZaDokument,
} from './zaloga-povzetek'

// ---------- barve (USKLAJENO z boss-report/zaloga-pdf — ISTI dokumenti družina) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

export interface NarocilnicaPdfOptions {
  /** Referenčni trenutek (žig + CreationDate + fileId + ime datoteke) — KOT
   *  PARAMETER (determinizem; komponenta poda EN now za dokument IN ime). */
  now: Date
}

/** Determinističen slug iz naziva dobavitelja (IME DATOTEKE, ne dokument):
 *  š→s č→c ž→z, male črke, ne-alfanumerik → '-', zloženi '-', brez robnih '-'.
 *  Čista funkcija — enak naziv = enak slug (nič naključja). */
export function dobaviteljSlug(naziv: string): string {
  if (typeof naziv !== 'string' || naziv.trim() === '') {
    throw new TypeError('dobaviteljSlug: pričakovan ne-prazen naziv dobavitelja')
  }
  const preslikano = naziv
    .trim()
    .toLowerCase()
    .replace(/š/g, 's')
    .replace(/č/g, 'c')
    .replace(/ž/g, 'z')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
  if (preslikano === '') {
    throw new TypeError('dobaviteljSlug: naziv brez uporabnih znakov (a-z, 0-9)')
  }
  return preslikano
}

/** Ime datoteke — `narocilnica-{dobavitelj}-{YYYY-MM-DD}.pdf` (ISTI dan kot
 *  todayStamp CSV izvozov; deterministično glede na (order, now)). */
export function narocilnicaPdfFilename(order: NarociloZaDokument, now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('narocilnicaPdfFilename: pričakovan veljaven now: Date')
  }
  const dobavitelj =
    typeof order?.supplier?.naziv === 'string' ? order.supplier.naziv.trim() : ''
  if (dobavitelj === '') {
    throw new TypeError('narocilnicaPdfFilename: naročilo mora imeti ne-praznega dobavitelja')
  }
  return `narocilnica-${dobaviteljSlug(dobavitelj)}-${todayStamp(now)}.pdf`
}

/** Determinističen file-ID (32 hex) iz semena — čista JS FNV-1a (CLIENT-safe;
 *  zasebna kopija zaloga-pdf R234 vzorca — dokumentirana duplikacija:
 *  document-pdf je strežniški crypto, zaloga/naročilnica sta client čisti JS). */
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
    fnv1aHex(seed, 0x11) +
    fnv1aHex(seed, 0x12) +
    fnv1aHex(seed, 0x13) +
    fnv1aHex(seed, 0x14)
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

/** KPI polje — ISTI vzorec kot zaloga-pdf/boss-report kpiBox. */
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

/** Zgradi NAROČILNICO DOKUMENT (brez shranjevanja) — vrne jsPDF instanco
 *  (testi berejo doc.output('arraybuffer') → bajtni dokazi).
 *
 *  Fail-closed: VSA validacija je delegirana na buildNarocilnicaIzNarocila
 *  (ENA resnica — isti TypeError pri obeh bratih); ta funkcija DODA samo
 *  rendersko logiko, ne lastnih pogojev. */
export function buildNarocilnicaPdfDoc(
  order: NarociloZaDokument,
  options: NarocilnicaPdfOptions,
): jsPDF {
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildNarocilnicaPdfDoc: pričakovane opcije (NarocilnicaPdfOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildNarocilnicaPdfDoc: pričakovan veljaven now: Date')
  }
  // ENA RESNICA — delegirana validacija (vrže ISTO sporočilo kot tekstovna
  // naročilnica za vsak pokvaren vhod: objekt/now/dobavitelj/postavke).
  buildNarocilnicaIzNarocila(order, { now })

  const dobavitelj = order.supplier.naziv.trim()
  const postavk = order.items.length

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / zaloga-pdf R234) ----------
  doc.setCreationDate(now)
  doc.setFileId(
    deterministichenId(
      `${now.toISOString()}|${dobavitelj}|${order.items
        .map((p) => `${p.naziv.trim()}:${p.kolicina}${p.enota.trim()}`)
        .join(',')}`,
    ),
  )

  // ---------- glava (ISTI vzorec kot boss-report/zaloga-pdf) ----------
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
  doc.text('NAROČILNICA', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })

  // ---------- dobavitelj (2. vrstica tekstovne naročilnice = ISTI vir) ----------
  let y = 34
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...NAVY)
  doc.text(`Dobavitelj: ${dobavitelj}`, 14, y)
  y += 8

  // ---------- KPI povzetek (izračun iz postavk — notranja skladnost) ----------
  y = sectionTitle(doc, y, 'Povzetek naročila')
  const enote = new Set(order.items.map((p) => p.enota.trim()))
  const bw = 42
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Postavke', String(postavk), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Različne enote', String(enote.size), NAVY)
  y += bh + 8

  // ---------- tabela postavk (ENA resnica = besedilne vrstice R206) ----------
  y = sectionTitle(doc, y, `Postavke (${postavk})`)
  autoTable(doc, {
    startY: y,
    head: [['Št.', 'Naziv', 'Količina', 'Enota']],
    body: order.items.map((p, i) => [
      String(i + 1),
      p.naziv.trim(),
      String(p.kolicina),
      p.enota.trim(),
    ]),
    styles: { fontSize: 9, cellPadding: 1.8, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 9 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 14 },
      2: { halign: 'right', cellWidth: 26 },
      3: { halign: 'center', cellWidth: 22 },
    },
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 6

  // ---------- opomba (LE če dejansko obstaja — R206/R227 pravilo) ----------
  const opombe = typeof order.opombe === 'string' ? order.opombe.trim() : ''
  if (opombe !== '') {
    y = sectionTitle(doc, y, 'Opomba')
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...NAVY)
    const vrstice = doc.splitTextToSize(opombe, 182) as string[]
    doc.text(vrstice, 14, y + 2)
    y += vrstice.length * 4.6 + 4
  }

  // ---------- sklepna vrstica (ISTA sklanjatev + žig kot tekstovna 2. vrstica) ----------
  if (y > 255) {
    doc.addPage()
    y = 20
  }
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text(
    `${postavk} ${narociloPostavkaBeseda(postavk)} · osveženo ${zalogaPovzetekCasOznaka(now)}.`,
    14,
    y + 4,
  )

  // ---------- noge na vseh straneh (ISTI vzorec kot boss-report/zaloga-pdf) ----------
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

/** Zgeneriraj NAROČILNICO PDF (deterministično — enak vhod = bajtno enak
 *  dokument) in jo shrani kot `narocilnica-{dobavitelj}-{YYYY-MM-DD}.pdf`. */
export function generateNarocilnicaPdf(
  order: NarociloZaDokument,
  options: NarocilnicaPdfOptions,
): void {
  const doc = buildNarocilnicaPdfDoc(order, options)
  doc.save(narocilnicaPdfFilename(order, options.now))
}
