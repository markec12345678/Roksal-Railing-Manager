/**
 * R395 — PDF renderer za PONUDBO (issue #13, korak R172 iz §16 — SIGNATURE +
 * DOCUMENT CHAIN).
 *
 * Kanonična pot (ista kot document-pdf.ts, kanon R121):
 *   kanonična verzija ponudbe (QuoteVersion — strežniško izračunane
 *   postavke) → renderer → PDF bajti → SHA-256 → object storage →
 *   DocumentVersion (tip PONUDBA) → SignatureAudit (deal-lock).
 *
 * Renderer je ČISTA funkcija vhodov — ni DB klicev, ni naključja; enak vhod
 * = bajtno enak PDF = enak SHA-256 (pravilo 100×, kanon R294: trije viri
 * nedeterminizma v jsPDF so poprljeni z vsebino — /CreationDate ← datum
 * izdaje, trailer /ID ← sha256(identiteta), modificationDate se ne zapisuje).
 *
 * §16 LAŽNI PDF NE OBSTOJA: do R395 je klient generiral svoj PDF
 * (signature-quote.tsx — izpis za tisk) in poslal poljuben pdfHash; strežnik
 * si je zapisal klientovo/sintetično vrednost. Od R395 je PONUDBA PDF
 * IZKLJUČNO strežniški artefakt — postavke/seštevki v njem izhajajo IZKLJUČNO
 * iz nespremenljive QuoteVersion (§3) — klient nima vpliva na podpisano
 * vsebino.
 */
import { jsPDF } from 'jspdf'
import { createHash } from 'node:crypto'
import { GROUP_LABEL, type BomGroup, type QuoteItem } from '@/lib/quote'

const COLORS = {
  navy: [29, 43, 62] as [number, number, number],
  amber: [245, 158, 11] as [number, number, number],
  dark: [17, 24, 39] as [number, number, number],
  gray: [107, 114, 128] as [number, number, number],
  lightGray: [229, 231, 235] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
}

export interface QuotePdfInput {
  /** ID Document vrstice (zabojnik PONUDBA) — glava + noga (sledljivost). */
  documentId: string
  /** Verzija artefakta (1, 2 …) — noga. */
  version: number
  /** Datum izdaje (ISO) — del VSEBINE (determinizem, kanon R294). */
  datumIzdaje: string
  quoteVersion: {
    id: string
    versionNumber: number
    status: string
    inputHash: string
    subtotal: number
    vat: number
    total: number
    currency: string
    lines: QuoteItem[]
  }
  project: { naziv: string; status: string }
  customer: { ime: string; naslov?: string | null; telefon?: string | null; email?: string | null } | null
  /** Številka VEZANE verzije cenika (dokaz provenance denarja, §4). */
  priceBookVersionNumber: number | null
  /** Kdo je PDF izdal (ime vloge/osebe iz seje). */
  actor: string
}

function labelFor(value: unknown): string {
  return value == null || value === '' ? '—' : String(value)
}

function money(x: number, currency: string): string {
  return `${x.toFixed(2).replace('.', ',')} ${currency}`
}

function qtyFmt(qty: number, unit: string): string {
  // Količine so 3 decimalne natančnosti (kanon m/m²/kos) — brez odvečnih nič.
  const s = Number.isInteger(qty) ? String(qty) : qty.toFixed(3).replace(/0+$/, '').replace('.', ',')
  return `${s} ${unit}`
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()}`
}

/** Blok glave z navy pasom; vrne y po glavi. */
function header(doc: jsPDF, input: QuotePdfInput): number {
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
  doc.text('PONUDBA', width - 14, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8)
  doc.text(`Verzija ponudbe v${input.quoteVersion.versionNumber} · PDF v${input.version}`, width - 14, 18, { align: 'right' })
  return 36
}

/** Meta tabela; vrne y po tabeli. */
function metaSection(doc: jsPDF, y: number, input: QuotePdfInput): number {
  const kontakt = input.customer
    ? [input.customer.telefon, input.customer.email].filter(Boolean).join(' · ') || '—'
    : '—'
  const rows: [string, string][] = [
    ['Projekt', labelFor(input.project.naziv)],
    ['Stranka', labelFor(input.customer?.ime)],
    ['Naslov', labelFor(input.customer?.naslov)],
    ['Kontakt', kontakt],
    ['Status verzije', `${input.quoteVersion.status} (v${input.quoteVersion.versionNumber})`],
    ['Vezana verzija cenika', input.priceBookVersionNumber == null ? '—' : `v${input.priceBookVersionNumber}`],
    ['Izdal', labelFor(input.actor)],
    ['Datum izdaje', fmtDate(input.datumIzdaje)],
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
  if (y > 250) {
    doc.addPage()
    y = 20
  }
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...COLORS.dark)
  doc.text(title, 14, y)
  doc.setDrawColor(...COLORS.amber)
  doc.setLineWidth(0.5)
  doc.line(14, y + 1.5, doc.internal.pageSize.getWidth() - 14, y + 1.5)
  return y + 7
}

/** Tabela postavk, grupirana po skupinah (GROUP_LABEL — EN VIR oznak). */
function linesSection(doc: jsPDF, y: number, input: QuotePdfInput): number {
  let cursor = sectionTitle(doc, y, 'POSTAVKE PONUDBE')
  const width = doc.internal.pageSize.getWidth()
  const lines = input.quoteVersion.lines
  if (lines.length === 0) {
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.gray)
    doc.text('Verzija nima postavk.', 14, cursor)
    return cursor + 6
  }
  // Glava tabele:
  const drawHead = (y0: number) => {
    doc.setFont('Roboto', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.gray)
    doc.text('Šifra', 14, y0)
    doc.text('Naziv', 44, y0)
    doc.text('Kol.', 130, y0)
    doc.text('Cena', 150, y0)
    doc.text('Znesek', width - 14, y0, { align: 'right' })
    doc.setDrawColor(...COLORS.lightGray)
    doc.setLineWidth(0.3)
    doc.line(14, y0 + 1.5, width - 14, y0 + 1.5)
  }
  drawHead(cursor)
  cursor += 6

  const groups = [...new Set(lines.map((l) => l.group))] as BomGroup[]
  for (const g of groups) {
    if (cursor > 258) {
      doc.addPage()
      cursor = 20
      drawHead(cursor)
      cursor += 6
    }
    doc.setFont('Roboto', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.navy)
    doc.text(GROUP_LABEL[g] ?? g, 14, cursor)
    cursor += 5.5
    for (const l of lines.filter((x) => x.group === g)) {
      if (cursor > 270) {
        doc.addPage()
        cursor = 20
        drawHead(cursor)
        cursor += 6
      }
      const det = l.detail ? (doc.splitTextToSize(l.detail, 82)[0] ?? '') : ''
      doc.setFont('Roboto', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...COLORS.dark)
      doc.text(l.code, 14, cursor)
      doc.text(doc.splitTextToSize(l.name, 82)[0] ?? '', 44, cursor)
      if (det) {
        doc.setFontSize(7)
        doc.setTextColor(...COLORS.gray)
        doc.text(det, 44, cursor + 3.5)
        doc.setFontSize(8.5)
        doc.setTextColor(...COLORS.dark)
      }
      doc.text(qtyFmt(l.qty, l.unit), 130, cursor)
      doc.text(l.unitPrice.toFixed(2).replace('.', ','), 150, cursor)
      doc.text(l.total.toFixed(2).replace('.', ','), width - 14, cursor, { align: 'right' })
      cursor += det ? 7 : 5.5
    }
    cursor += 2
  }
  return cursor + 2
}

/** Seštevki — IZKLJUČNO iz verzije (strežniška resnica, §2/§7). */
function totalsSection(doc: jsPDF, y: number, input: QuotePdfInput): number {
  let cursor = sectionTitle(doc, y, 'SEŠTEVKI')
  const width = doc.internal.pageSize.getWidth()
  const rows: [string, string][] = [
    ['Osnova (brez DDV)', money(input.quoteVersion.subtotal, input.quoteVersion.currency)],
    [`DDV (${input.quoteVersion.vat > 0 && input.quoteVersion.subtotal > 0 ? ((input.quoteVersion.vat / input.quoteVersion.subtotal) * 100).toFixed(0) : '—'} %)`, money(input.quoteVersion.vat, input.quoteVersion.currency)],
    ['SKUPAJ', money(input.quoteVersion.total, input.quoteVersion.currency)],
  ]
  rows.forEach(([label, value], i) => {
    const rowY = cursor + i * 6.5
    doc.setFont('Roboto', i === 2 ? 'bold' : 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...(i === 2 ? COLORS.dark : COLORS.gray))
    doc.text(label, 14, rowY)
    doc.setTextColor(...COLORS.dark)
    doc.text(value, width - 14, rowY, { align: 'right' })
  })
  return cursor + rows.length * 6.5 + 4
}

/** §16 PEČAT verige — identiteta verzije ponudbe + dokumenta (pravni dokaz). */
function chainSection(doc: jsPDF, y: number, input: QuotePdfInput): number {
  let cursor = sectionTitle(doc, y, 'PEČAT INTEGRITETE (VERIGA DOKUMENTA)')
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.gray)
  const vrstice = [
    `Verzija ponudbe: ${input.quoteVersion.id} (v${input.quoteVersion.versionNumber})`,
    `Odtis vhodov (inputHash): ${input.quoteVersion.inputHash}`,
    `Dokument: ${input.documentId} · PDF verzija v${input.version}`,
    'PDF bajti so zapečateni z SHA-256 ob izdaji; podpis se veže na TOČNO to',
    'verzijo dokumenta (SignatureAudit → DocumentVersion). Sprememba ponudbe',
    'po podpisu ni mogoča — nova vsebina = nova verzija ponudbe + nov PDF.',
  ]
  vrstice.forEach((v, i) => doc.text(v, 14, cursor + i * 4.5))
  return cursor + vrstice.length * 4.5 + 6
}

/** Podpisni bloki — izpolnita se ob podpisu (deal-lock). */
function signatureSection(doc: jsPDF, y: number, input: QuotePdfInput): number {
  let cursor = sectionTitle(doc, y, 'PODPISI')
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.gray)
  doc.text('Stranka (ime in podpis): ______________________________', 14, cursor)
  doc.text('Monter (ime in podpis): ______________________________', 14, cursor + 14)
  doc.text(`Kraj in datum: ______________  ·  ${fmtDate(input.datumIzdaje)}`, 14, cursor + 28)
  return cursor + 34
}

/** Noga na vseh straneh (sledljivost + izvor podatkov). */
function footer(doc: jsPDF, input: QuotePdfInput): void {
  const pages = doc.getNumberOfPages()
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...COLORS.gray)
    doc.text(
      `Ponudba ${input.documentId} · v${input.version} · generirano iz kanonične verzije ponudbe (strežniška resnica, en vir)`,
      14,
      height - 8,
    )
    doc.text(`Stran ${i}/${pages}`, width - 14, height - 8, { align: 'right' })
  }
}

/** Generiraj PONUDBA PDF bajte (Buffer) iz kanonične verzije ponudbe. */
export function generateQuotePdf(input: QuotePdfInput): Buffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  // DETERMINIZEM (pravilo 100×, kanon document-pdf R294):
  //   1. /CreationDate ← datum izdaje (del vsebine),
  //   2. trailer /ID ← sha256(identiteta dokumenta + verzije ponudbe),
  //   3. modificationDate se ne zapisuje.
  // Enak vhod = bajtno enak PDF = enak SHA-256 (dokaz: r395-document-chain).
  const creation = new Date(input.datumIzdaje)
  doc.setCreationDate(creation)
  doc.setFileId(
    createHash('sha256')
      .update(`${input.documentId}|${input.version}|${input.datumIzdaje}|${input.quoteVersion.id}|${input.quoteVersion.inputHash}`)
      .digest('hex')
      .slice(0, 32),
  )

  let y = header(doc, input)
  y = metaSection(doc, y, input)
  y = linesSection(doc, y, input)
  y = totalsSection(doc, y, input)
  y = chainSection(doc, y, input)
  y = signatureSection(doc, y, input)
  footer(doc, input)
  return Buffer.from(doc.output('arraybuffer'))
}
