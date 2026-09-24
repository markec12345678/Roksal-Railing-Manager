/**
 * R121 — PDF renderer za dokumente (issue #7, Problem 6).
 *
 * Kanonična pot: canonical data (DB vrstice) → renderer → PDF bajti →
 * SHA-256 → object storage → DocumentVersion. Renderer je ČISTA funkcija
 * vhodov — ni DB klicev, ni globine AI, ni naključja; enak vhod = enak
 * PDF (razen datum izdaje, ki je del vsebine dokumenta).
 *
 * Vrstni red dokumenta (vse iz kanoničnih podatkov projekta):
 *   1. Glava (navy pas) + tip dokumenta + številka/ID
 *   2. Meta tabela (projekt, stranka, status, datum montaže, izdal, datum)
 *   3. Telo po tipu:
 *      – TEHNICNI_LIST: tehnični parametri + meritve (dolžina × višina)
 *      – PRIMOPREDAJA: potek predaje + podpisni bloki (monter/stranka)
 *      – E_RACUN: finančni povzetek izdaje (osnova, DDV, skupaj), če obstaja
 *      – ZAPISNIK_NAVORA: tabela navorov/popravkov (punch items)
 *   4. Noga: ID dokumenta + opomba o izvoru podatkov
 */
import { jsPDF } from 'jspdf'
import { createHash } from 'node:crypto'
import { registerSloPdfFonts } from '@/lib/pdf-sl-font'

const COLORS = {
  navy: [29, 43, 62] as [number, number, number],
  amber: [245, 158, 11] as [number, number, number],
  dark: [17, 24, 39] as [number, number, number],
  gray: [107, 114, 128] as [number, number, number],
  lightGray: [229, 231, 235] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
}

export type DocumentTypeValue = 'TEHNICNI_LIST' | 'PRIMOPREDAJA' | 'E_RACUN' | 'ZAPISNIK_NAVORA'

export const DOCUMENT_TITLES: Record<DocumentTypeValue, string> = {
  TEHNICNI_LIST: 'Tehnični list',
  PRIMOPREDAJA: 'Primerjalni zapisnik o predaji-vzetju',
  E_RACUN: 'Račun (povzetek)',
  ZAPISNIK_NAVORA: 'Zapisnik o navorih',
}

export interface DocumentPdfInput {
  tipDokumenta: DocumentTypeValue
  /** ID Document vrstice — gre v glavo in nogo (sledljivost). */
  documentId: string
  /** Verzija artefakta (1, 2 …) — gre v nogo. */
  version: number
  /** Datum izdaje (ISO) — del VSEBINE, ne meta rendererja. */
  datumIzdaje: string
  project: {
    naziv: string
    status: string
    datumMontaze?: string | null
    opombe?: string | null
    projectDataJson?: string | null
  }
  customer: { ime: string; naslov?: string | null; telefon?: string | null; email?: string | null }
  /** Kdo je dokument izdal (ime vloge/osebe iz seje). */
  actor: string
  measurements: Array<{ dolzinaMm: number; visinaMm: number; createdAt: Date }>
  punchItems: Array<{ naslov: string; opomba: string | null; status: string }>
  invoice: { stevilka: string; osnova: number; ddv: number; skupaj: number } | null
}

/** Tehnični parametri iz kanoničnega projectData JSON (tolerantno). */
function parseProjectData(json: string | null | undefined): Record<string, unknown> {
  if (!json) return {}
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function labelFor(value: unknown): string {
  return value == null || value === '' ? '—' : String(value)
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Blok glave z navy pasom; vrne y po glavi. */
function header(doc: jsPDF, input: DocumentPdfInput): number {
  const width = doc.internal.pageSize.getWidth()
  doc.setFillColor(...COLORS.navy)
  doc.rect(0, 0, width, 26, 'F')
  doc.setFillColor(...COLORS.amber)
  doc.rect(0, 26, width, 1.2, 'F')

  doc.setTextColor(...COLORS.white)
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(16)
  doc.text('ROKSAL', 14, 12)
  doc.setFontSize(9)
  doc.setFont('Roboto', 'normal')
  doc.text('Ograje in kovinska galanterija', 14, 18)

  doc.setFont('Roboto', 'bold')
  doc.setFontSize(12)
  doc.text(DOCUMENT_TITLES[input.tipDokumenta], width - 14, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8)
  doc.text(`Dokument ${input.documentId} · verzija v${input.version}`, width - 14, 18, { align: 'right' })
  return 36
}

/** Meta tabela; vrne y po tabeli. */
function metaSection(doc: jsPDF, y: number, input: DocumentPdfInput): number {
  const rows: [string, string][] = [
    ['Projekt', labelFor(input.project.naziv)],
    ['Stranka', labelFor(input.customer.ime)],
    ['Naslov', labelFor(input.customer.naslov)],
    ['Kontakt', [input.customer.telefon, input.customer.email].filter(Boolean).join(' · ') || '—'],
    ['Status projekta', labelFor(input.project.status)],
    ['Datum montaže', formatDate(input.project.datumMontaze)],
    ['Datum izdaje', formatDate(input.datumIzdaje)],
    ['Izdal', labelFor(input.actor)],
  ]
  doc.setFontSize(9)
  rows.forEach(([label, value], i) => {
    const rowY = y + i * 6.5
    doc.setFont('Roboto', 'bold')
    doc.setTextColor(...COLORS.gray)
    doc.text(label, 14, rowY)
    doc.setFont('Roboto', 'normal')
    doc.setTextColor(...COLORS.dark)
    doc.text(value, 62, rowY, { maxWidth: 120 })
  })
  return y + rows.length * 6.5 + 6
}

function sectionTitle(doc: jsPDF, y: number, title: string): number {
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...COLORS.dark)
  doc.text(title, 14, y)
  doc.setDrawColor(...COLORS.amber)
  doc.setLineWidth(0.5)
  doc.line(14, y + 1.5, doc.internal.pageSize.getWidth() - 14, y + 1.5)
  return y + 7
}

function techSection(doc: jsPDF, y: number, input: DocumentPdfInput): number {
  const data = parseProjectData(input.project.projectDataJson)
  let cursor = sectionTitle(doc, y, 'TEHNIČNI PARAMETRI')
  const params: [string, string][] = [
    ['Dolžina', data.lengthCm != null ? `${data.lengthCm} cm` : '—'],
    ['Višina', data.heightCm != null ? `${data.heightCm} cm` : '—'],
    ['Tip montaže', labelFor(data.mountType)],
    ['Stil ograje', labelFor(data.railingStyle)],
    ['Barva (RAL)', data.colorName ? `${data.colorName}${data.colorHex ? ` · ${data.colorHex}` : ''}` : '—'],
  ]
  doc.setFontSize(9)
  params.forEach(([label, value], i) => {
    const rowY = cursor + i * 6
    doc.setFont('Roboto', 'bold')
    doc.setTextColor(...COLORS.gray)
    doc.text(label, 14, rowY)
    doc.setFont('Roboto', 'normal')
    doc.setTextColor(...COLORS.dark)
    doc.text(value, 62, rowY)
  })
  cursor += params.length * 6 + 4

  if (input.measurements.length > 0) {
    cursor = sectionTitle(doc, cursor, 'MERITVE')
    doc.setFontSize(9)
    input.measurements.slice(0, 12).forEach((m, i) => {
      const rowY = cursor + i * 6
      doc.setFont('Roboto', 'normal')
      doc.setTextColor(...COLORS.dark)
      doc.text(
        `${i + 1}.  dolžina ${(m.dolzinaMm / 1000).toFixed(3).replace('.', ',')} m  ·  višina ${(m.visinaMm / 1000).toFixed(3).replace('.', ',')} m`,
        14,
        rowY,
      )
      doc.setTextColor(...COLORS.gray)
      doc.text(formatDate(m.createdAt), doc.internal.pageSize.getWidth() - 14, rowY, { align: 'right' })
    })
    cursor += Math.min(input.measurements.length, 12) * 6
  }
  return cursor
}

function primopredajaSection(doc: jsPDF, y: number, input: DocumentPdfInput): number {
  let cursor = sectionTitle(doc, y, 'POTEK PREDAJE')
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.dark)
  const lines = [
    `Projekt ${input.project.naziv} je bil predan naročniku.`,
    'Izvedena montaža ograje je bila pregledana; delovanje in uglašenost',
    'sta bila preverjena v prisotnosti naročnika. Odsotnost pripomb',
    'v zapisniku pomeni brezhibno predajo.',
  ]
  lines.forEach((line, i) => {
    doc.text(line, 14, cursor + i * 5.5)
  })
  cursor += lines.length * 5.5 + 10

  if (input.project.opombe) {
    cursor = sectionTitle(doc, cursor, 'OPOMBE')
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.dark)
    doc.text(doc.splitTextToSize(input.project.opombe, 170), 14, cursor)
    cursor += 14
  }

  cursor = sectionTitle(doc, cursor, 'PODPISI')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.gray)
  doc.text('Monter (ime in podpis): ______________________________', 14, cursor)
  doc.text('Naročnik (ime in podpis): ______________________________', 14, cursor + 14)
  doc.text(`Kraj in datum: ______________  ·  ${formatDate(input.datumIzdaje)}`, 14, cursor + 28)
  return cursor + 34
}

function racunSection(doc: jsPDF, y: number, input: DocumentPdfInput): number {
  let cursor = sectionTitle(doc, y, 'FINANČNI POVZETEK')
  doc.setFontSize(9)
  if (!input.invoice) {
    doc.setFont('Roboto', 'normal')
    doc.setTextColor(...COLORS.gray)
    doc.text('Za ta projekt še ni izdanih računov — povzetek ni na voljo.', 14, cursor)
    return cursor + 6
  }
  const rows: [string, string][] = [
    ['Račun', input.invoice.stevilka],
    ['Osnova (brez DDV)', `${input.invoice.osnova.toFixed(2).replace('.', ',')} EUR`],
    ['DDV 22 %', `${input.invoice.ddv.toFixed(2).replace('.', ',')} EUR`],
    ['SKUPAJ', `${input.invoice.skupaj.toFixed(2).replace('.', ',')} EUR`],
  ]
  rows.forEach(([label, value], i) => {
    const rowY = cursor + i * 6.5
    doc.setFont('Roboto', i === 3 ? 'bold' : 'normal')
    doc.setTextColor(...(i === 3 ? COLORS.dark : COLORS.gray))
    doc.text(label, 14, rowY)
    doc.setTextColor(...COLORS.dark)
    doc.text(value, doc.internal.pageSize.getWidth() - 14, rowY, { align: 'right' })
  })
  return cursor + rows.length * 6.5 + 4
}

function punchSection(doc: jsPDF, y: number, input: DocumentPdfInput): number {
  let cursor = sectionTitle(doc, y, 'NAVORI / POPRAVKI')
  doc.setFontSize(9)
  if (input.punchItems.length === 0) {
    doc.setFont('Roboto', 'normal')
    doc.setTextColor(...COLORS.gray)
    doc.text('Ni odprtih navorov.', 14, cursor)
    return cursor + 6
  }
  input.punchItems.slice(0, 14).forEach((p, i) => {
    const rowY = cursor + i * 7
    doc.setFont('Roboto', 'bold')
    doc.setTextColor(...COLORS.dark)
    doc.text(`${i + 1}. ${p.naslov}`, 14, rowY)
    doc.setFont('Roboto', 'normal')
    doc.setTextColor(p.status === 'open' ? 220 : 22, p.status === 'open' ? 38 : 163, p.status === 'open' ? 38 : 74)
    doc.text(`[${p.status}]`, doc.internal.pageSize.getWidth() - 14, rowY, { align: 'right' })
    if (p.opomba) {
      doc.setTextColor(...COLORS.gray)
      doc.text(doc.splitTextToSize(p.opomba, 160)[0] ?? '', 18, rowY + 4.5)
    }
  })
  return cursor + Math.min(input.punchItems.length, 14) * 7
}

/** Noga na vseh straneh (sledljivost + izvor podatkov). */
function footer(doc: jsPDF, input: DocumentPdfInput): void {
  const pages = doc.getNumberOfPages()
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...COLORS.gray)
    doc.text(
      `Dokument ${input.documentId} · v${input.version} · generiran iz kanoničnih podatkov projekta (en vir resnice)`,
      14,
      height - 8,
    )
    doc.text(`Stran ${i}/${pages}`, width - 14, height - 8, { align: 'right' })
  }
}

/** Generiraj PDF bajte (Buffer) iz kanoničnih vhodov. */
export function generateDocumentPdf(input: DocumentPdfInput): Buffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  registerSloPdfFonts(doc)
  // DETERMINIZEM (pravilo 100×): trije viri nedeterminizma v jsPDF so
  // poprljani z vsebino, ne s trenutkom generiranja:
  //   1. /CreationDate ← datum izdaje (del vsebine dokumenta),
  //   2. trailer /ID ← sha256(identiteta dokumenta), ne Math.random,
  //   3. (modificationDate se ne zapisuje, če ni nastavljen posebej).
  // Enak vhod = bajtno enak PDF = enak SHA-256 (dokazano document-pdf.test.ts).
  const creation = new Date(input.datumIzdaje)
  doc.setCreationDate(creation)
  doc.setFileId(createHash('sha256').update(`${input.documentId}|${input.version}|${input.datumIzdaje}`).digest('hex').slice(0, 32))

  let y = header(doc, input)
  y = metaSection(doc, y, input)
  switch (input.tipDokumenta) {
    case 'TEHNICNI_LIST':
      y = techSection(doc, y, input)
      break
    case 'PRIMOPREDAJA':
      y = primopredajaSection(doc, y, input)
      break
    case 'E_RACUN':
      y = racunSection(doc, y, input)
      break
    case 'ZAPISNIK_NAVORA':
      y = punchSection(doc, y, input)
      break
  }
  footer(doc, input)
  return Buffer.from(doc.output('arraybuffer'))
}
