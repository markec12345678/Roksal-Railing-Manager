// Roksal Field — PDF zapisnik terenskega pregleda (runda R)
//
// Monter na terenu izpolni zapisnik (zavihek Terenski pregled) in z enim
// klikom izvozi uradni PDF — zapisnik gre po e-pošti/WhatsApp vodji ali
// arhivu. Struktura dokumenta:
//   1. Glava (navy pas + logotip) + meta podatki projekta + napredek %
//   2. OBJEKT IN PRITRDITEV — tip/oblika/pritrditev/podlaga + priporočeni
//      mozniki (podlaga določa moznike!) + RAL barva prahu
//   3. MERE — razponi/dolžina/višina/stopnice + orientacijski izračun
//   4. OVIRE IN DOSTOP
//   5. FOTO KONTROLNI SEZNAM — ✓ posneto / ✗ manjka (dokazljivost!)
//   6. S SEBOJ PRINESTI — orodje + material + opozorila (s koškicami)
//   7. OPOMBE + podpisna polja (monter / vodja montaže)
//
// Fonti: Roboto subset latin-ext (šumniki!) — glej `pdf-sl-font.ts`.

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from '@/lib/pdf-sl-font'

const COLORS = {
  navy: [29, 43, 62] as [number, number, number],
  amber: [245, 158, 11] as [number, number, number],
  dark: [17, 24, 39] as [number, number, number],
  gray: [107, 114, 128] as [number, number, number],
  lightGray: [229, 231, 235] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
}

export interface SurveyPdfInput {
  projectNaziv: string
  customerName: string | null
  monterName: string | null
  datumMontaze?: string | null
  /** že razrešene oznake iz UI-ja (izvorne konstante ostanejo v zavihku) */
  tipObjekta: string
  oblika: string
  pritrditev: string
  podlaga: string
  anchorText: string
  ralLabel: string | null
  mere: { label: string; value: string }[]
  izracun: string | null
  ovireLabel: string
  dvigalo: boolean
  dostopOpomba: string | null
  foto: { label: string; opis: string; posneto: boolean }[]
  bringList: { kind: 'base' | 'material' | 'warn'; text: string; reason: string }[]
  opombe: string | null
  zakljuceno: boolean
  completion: number
}

/** Ime datoteke: zapisnik-teren-{projekt}-{datum}.pdf (brez šumnikov/Presledki) */
export function surveyPdfFilename(projectNaziv: string): string {
  const slug = projectNaziv
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const dan = new Date().toISOString().slice(0, 10)
  return `zapisnik-teren-${slug || 'projekt'}-${dan}.pdf`
}

function section(doc: jsPDF, y: number, title: string): number {
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...COLORS.dark)
  doc.text(title, 14, y)
  doc.setDrawColor(...COLORS.amber)
  doc.setLineWidth(0.5)
  doc.line(14, y + 1.5, doc.internal.pageSize.getWidth() - 14, y + 1.5)
  return y + 6
}

export function generateSurveyPdf(input: SurveyPdfInput): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  registerSloPdfFonts(doc)
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  let y = 0

  // ── Glava — navy pas ─────────────────────────────────────────────────────
  doc.setFillColor(...COLORS.navy)
  doc.rect(0, 0, pageW, 26, 'F')
  doc.setFillColor(...COLORS.amber)
  doc.rect(14, 7, 12, 12, 'F')
  doc.setTextColor(...COLORS.white)
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(16)
  doc.text('R', 18, 16)
  doc.setFontSize(13)
  doc.text('ZAPISNIK O TERENSKEM PREGLEDU', 30, 13)
  doc.setFontSize(9)
  doc.setFont('Roboto', 'normal')
  doc.text('ROKSAL d.o.o. Kranj · montaža ograj', 30, 20)
  doc.setFontSize(8)
  doc.text(new Date().toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' }), pageW - 14, 13, { align: 'right' })
  y = 32

  // ── Meta podatki ─────────────────────────────────────────────────────────
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.dark)
  const left = [
    `Projekt: ${input.projectNaziv}`,
    `Stranka: ${input.customerName ?? '—'}`,
    `Monter: ${input.monterName ?? '—'}`,
  ]
  const right = [
    `Status pregleda: ${input.zakljuceno ? 'ZAKLJUČEN' : 'ODPRT (v postopku)'}`,
    `Datum montaže: ${input.datumMontaze ? new Date(input.datumMontaze).toLocaleDateString('sl-SI') : '—'}`,
    `Datum izpisa: ${new Date().toLocaleDateString('sl-SI')}`,
  ]
  left.forEach((line, i) => doc.text(line, 14, y + i * 5))
  right.forEach((line, i) => doc.text(line, pageW / 2 + 6, y + i * 5))
  y += left.length * 5 + 3

  // Napredek — bar
  doc.setFillColor(...COLORS.lightGray)
  doc.rect(14, y, pageW - 28, 3, 'F')
  doc.setFillColor(...COLORS.amber)
  doc.rect(14, y, ((pageW - 28) * Math.min(100, Math.max(0, input.completion))) / 100, 3, 'F')
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.gray)
  doc.text(`Dokončanost zapisnika: ${input.completion}%`, pageW - 14, y - 1.5, { align: 'right' })
  y += 8

  // ── 1 · Objekt in pritrditev ─────────────────────────────────────────────
  y = section(doc, y, 'OBJEKT IN PRITRDITEV')
  autoTable(doc, {
    startY: y,
    body: [
      ['Tip objekta', input.tipObjekta],
      ['Oblika tlorisa', input.oblika],
      ['Pritrditev', input.pritrditev],
      ['Podlaga', input.podlaga],
      ['Priporočeni mozniki', input.anchorText],
      ['RAL barva prahu', input.ralLabel ?? 'ni izbrana'],
    ],
    theme: 'grid',
    styles: { font: 'Roboto', fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', fillColor: [244, 246, 249], cellWidth: 55 } },
    margin: { left: 14, right: 14 },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7

  // ── 2 · Mere ─────────────────────────────────────────────────────────────
  if (input.mere.length > 0 || input.izracun) {
    y = section(doc, y, 'MERE OBJEKTA')
    const body = input.mere.map((m) => [m.label, m.value])
    if (input.izracun) body.push(['Orientacijski izračun', input.izracun])
    autoTable(doc, {
      startY: y,
      body,
      theme: 'grid',
      styles: { font: 'Roboto', fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', fillColor: [244, 246, 249], cellWidth: 55 } },
      margin: { left: 14, right: 14 },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7
  }

  // ── 3 · Ovire in dostop ──────────────────────────────────────────────────
  y = section(doc, y, 'OVIRE IN DOSTOP')
  autoTable(doc, {
    startY: y,
    body: [
      ['Ovire', input.ovireLabel],
      ['Dvigalo na voljo', input.dvigalo ? 'DA' : 'NE — plan ročnega dviga!'],
      ['Dostop / dvig materiala', input.dostopOpomba ?? '—'],
    ],
    theme: 'grid',
    styles: { font: 'Roboto', fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', fillColor: [244, 246, 249], cellWidth: 55 } },
    margin: { left: 14, right: 14 },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7

  // ── 4 · Foto kontrolni seznam ────────────────────────────────────────────
  if (y > 230) { doc.addPage(); y = 20 }
  y = section(doc, y, `FOTO KONTROLNI SEZNAM (${input.foto.filter((f) => f.posneto).length}/${input.foto.length} posneto)`)
  autoTable(doc, {
    startY: y,
    head: [['#', 'Točka', 'Kaj zajeti', 'Status']],
    body: input.foto.map((f, i) => [String(i + 1), f.label, f.opis, f.posneto ? 'POSNETO' : 'MANJKA']),
    theme: 'grid',
    styles: { font: 'Roboto', fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: COLORS.navy, fontSize: 9, font: 'Roboto' },
    columnStyles: {
      0: { cellWidth: 8 },
      3: { cellWidth: 22, fontStyle: 'bold', halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        data.cell.styles.textColor = data.row.raw?.[3] === 'POSNETO' ? COLORS.green : COLORS.red
      }
    },
    margin: { left: 14, right: 14 },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7

  // ── 5 · S seboj prinesti ─────────────────────────────────────────────────
  if (y > 230) { doc.addPage(); y = 20 }
  y = section(doc, y, 'S SEBOJ PRINESTI')
  autoTable(doc, {
    startY: y,
    head: [['', 'Točka', 'Razlog']],
    body: input.bringList.map((i) => ['[  ]', i.text, i.reason]),
    theme: 'grid',
    styles: { font: 'Roboto', fontSize: 8.5, cellPadding: 1.8 },
    headStyles: { fillColor: COLORS.navy, fontSize: 9, font: 'Roboto' },
    columnStyles: { 0: { cellWidth: 8, halign: 'center', fontSize: 11 } },
    didParseCell: (data) => {
      const item = input.bringList[data.row.index]
      if (data.section === 'body' && item?.kind === 'warn') {
        // opozorila — svetlo jantarjeva vrstica + temno rdeč tekst, hitro skeniranje
        data.cell.styles.fillColor = [254, 243, 199]
        if (data.column.index === 1) data.cell.styles.textColor = [153, 27, 27]
      }
      if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.fontStyle = 'bold'
      }
    },
    margin: { left: 14, right: 14 },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7

  // ── 6 · Opombe ───────────────────────────────────────────────────────────
  if (input.opombe) {
    if (y > 240) { doc.addPage(); y = 20 }
    y = section(doc, y, 'OPOMBE')
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.dark)
    const lines = doc.splitTextToSize(input.opombe, pageW - 28)
    doc.text(lines, 14, y)
    y += lines.length * 4.5 + 6
  }

  // ── Podpisi ──────────────────────────────────────────────────────────────
  if (y > 250) { doc.addPage(); y = 20 }
  y = Math.max(y + 6, 250)
  doc.setDrawColor(...COLORS.gray)
  doc.setLineWidth(0.3)
  const colW = (pageW - 28) / 2
  doc.line(14, y, 14 + colW - 8, y)
  doc.line(pageW - 14 - colW + 8, y, pageW - 14, y)
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...COLORS.gray)
  doc.text('Monter (podpis)', 14, y + 4)
  doc.text('Vodja montaže (podpis)', pageW - 14 - colW + 8, y + 4)
  doc.text(`Kraj in datum: ${new Date().toLocaleDateString('sl-SI')}`, 14, y + 12)

  // ── Noga na vseh straneh ─────────────────────────────────────────────────
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...COLORS.gray)
    doc.text('Roksal Field Manager · terenski pregled — dokument je bil generiran avtomatsko', 14, pageH - 7)
    doc.text(`Stran ${p}/${total}`, pageW - 14, pageH - 7, { align: 'right' })
  }

  doc.save(surveyPdfFilename(input.projectNaziv))
}
