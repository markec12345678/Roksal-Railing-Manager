// R325 — dekompozicija calculator-tab FAZA 2: PDF izvozi (5 funkcij —
// predloga vrtanja / materialni list / razrezni list CNC / vetrno poročilo /
// steklena balustrada) izluščeni iz calculator-tab.tsx (vrstice 918–1452).
// REFAKTOR interno sestavljene strukture (kanon R319/R321): telesa so
// VERBATIM, edina sprememba = closure dostop do stanja zamenjan z
// eksplicitnimi args objekti (dependency injection — funkcije so čiste
// projekcije POSREDOVANEGA stanja). Tipa CncSegment + GlassType sta se
// preselila iz telesa komponente (uporaba: stanje + PDF + JSX).
// Brez 'use client' — del client drevesa (kanon R319/R321).
// R352 — GLIFNI POPRAVEK (r269/R351 vzorec): standard helvetica (WinAnsi —
// č/š/ž NE renderirata: 'Širina palice' → artefakt, 'Število letvev' →
// pokvarjeno) → registerSloPdfFonts (Roboto subset latin-ext, 23 KB na
// varianto, base64 v lib/pdf-sl-font-data) + setFont Roboto na VSEH 29
// mestih (5 gradnikov). ENA vsebinska sprememba izvoza — iskreno
// dokumentirana (r269/R351 kanon): izvoženi PDF-i se SPROTI spremenijo
// (vgrajeni fonti + pravilni šumniki v glavah/povzetkih/tabelah/nogah);
// vsebina (številke, izračuni, oznake) ostane NESPREMENJENA — kalkulator
// jedro (@/lib/calculator) NIČ. Časovni žigi (new Date/Date.now) so
// OBSTOJEČA klicateljeva resnica tega modula (izven r350/R351
// build/generate kontrakta) — izven obsega tega poprava.

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { toast } from 'sonner'
import { registerSloPdfFonts } from '@/lib/pdf-sl-font'
import {
  applyReserve,
  calculateAkontacija,
  calculateDDV,
  calculateLaborCost,
  formatSI,
  type CncCutResult,
  type EqualSpacingResult,
  type GlassCalcResult,
  type MaterialTotalResult,
  type WindLocationResult,
} from '@/lib/calculator'
import { slDatumKratko } from '@/lib/csv-export'
import type { CalculatorImportData } from '@/app/page'
import {
  podlagaLabels,
  podlagaSidraLabel,
  railingTypeLabels,
  ralNarociloNames,
  riskLabels,
  type RailingType,
  type TerrainCategory,
} from './shared'

// R325 — preseljena iz telesa CalculatorTab (vrstica 163): tip za CNC odseke
// (stanje cncSegments + PDF razrezni list + JSX editor).
export type CncSegment = { lengthMm: string; count: string; label: string }

// R325 — preseljena iz telesa CalculatorTab (vrstica 184): tip stekla
// (stanje glassInput + PDF specifikacija + JSX izbira).
export type GlassType = 'single' | 'laminated' | 'tempered'

// ===== PDF: Baluster hole template =====
export function exportBalusterPdf(args: {
  balusterResult: EqualSpacingResult | null
  balTotalLength: string
  balWidth: string
  balMaxGap: string
  rezervaPctBaluster: number
}): void {
  const { balusterResult, balTotalLength, balWidth, balMaxGap, rezervaPctBaluster } = args
  if (!balusterResult) return
  const L = parseFloat(balTotalLength) * 1000
  const W = parseFloat(balWidth)
  const G = parseFloat(balMaxGap)
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  // R352 — slovenski glifi: Roboto subset (kanon r269/R351 — kliči pred
  // prvo setFont; VFS je na dokumentu, registracija je idempotentna).
  registerSloPdfFonts(doc)
  const pageW = doc.internal.pageSize.getWidth()

  // Navy header
  doc.setFillColor(29, 43, 62)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15)
  doc.setFont('Roboto', 'bold')
  doc.text('ROKSAL — Predloga vrtanja', 14, 12)
  doc.setFontSize(9)
  doc.setFont('Roboto', 'normal')
  doc.text('Kranj, Slovenija', 14, 18)
  // Amber accent
  doc.setFillColor(245, 158, 11)
  doc.rect(0, 22, pageW, 1.5, 'F')

  let y = 30
  doc.setTextColor(20, 20, 20)
  doc.setFontSize(11)
  doc.setFont('Roboto', 'bold')
  doc.text('Parameter', 14, y)
  doc.text('Vrednost', 80, y)
  y += 4
  doc.setDrawColor(220, 220, 220)
  doc.line(14, y, pageW - 14, y)
  y += 5
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(10)
  const rows: [string, string][] = [
    ['Skupna dolžina', `${L.toFixed(0)}mm (${(L / 1000).toFixed(2)}m)`],
    ['Širina palice', `${W}mm`],
    ['Maksimalni razmik', `${G}mm`],
    ['Dejanski razmik', `${balusterResult.actualGapMm.toFixed(1)}mm`],
    ['Število palic (brez rezerve)', `${balusterResult.balusterCount} kos`],
    ['Rezerva materiala', `${rezervaPctBaluster}%`],
    ['Število palic (z rezervo)', `${applyReserve(balusterResult.balusterCount, rezervaPctBaluster)} kos`],
    ['Skladnost (SIST EN 1264)', balusterResult.isCompliant ? 'DA ✓' : 'NE ✗'],
  ]
  for (const [k, v] of rows) {
    doc.setTextColor(90, 90, 90)
    doc.text(k, 14, y)
    doc.setTextColor(20, 20, 20)
    doc.text(v, 80, y)
    y += 5
  }

  // Hole template table (centers for drilling)
  y += 4
  doc.setFontSize(11)
  doc.setFont('Roboto', 'bold')
  doc.setTextColor(29, 43, 62)
  doc.text('Pozicije lukenj (centri palic) od prve točke', 14, y)
  y += 3

  autoTable(doc, {
    startY: y,
    head: [['#', 'mm', 'cm', 'm']],
    body: balusterResult.centers.map((c, i) => [
      String(i + 1),
      `${c.toFixed(1)}`,
      `${(c / 10).toFixed(2)}`,
      `${(c / 1000).toFixed(3)}`,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [29, 43, 62], fontSize: 9 },
    bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
    alternateRowStyles: { fillColor: [247, 249, 255] },
    margin: { left: 14, right: 14 },
  })

  // Footer
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text(
    `Datum: ${slDatumKratko(new Date())} — Roksal Railing Manager`,
    14,
    finalY + 10,
  )
  doc.save(`roksal-predloga-vrtanja-${Date.now()}.pdf`)
  toast.success('Predloga PDF izvožena')
}

// ===== PDF: Material list =====
export function exportMaterialPdf(args: {
  materialResult: MaterialTotalResult | null
  projectName: string
  rezervaPctMaterial: number
  urnaPostavka: string
  stUr: string
  stMonterjev: string
  transport: string
  ddvPct: number
  akontacijaPct: number
  importedFromMeasurement?: CalculatorImportData | null
}): void {
  const {
    materialResult,
    projectName,
    rezervaPctMaterial,
    urnaPostavka,
    stUr,
    stMonterjev,
    transport,
    ddvPct,
    akontacijaPct,
    importedFromMeasurement,
  } = args
  if (!materialResult) return
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  // R352 — slovenski glifi: Roboto subset (kanon r269/R351 — kliči pred
  // prvo setFont; VFS je na dokumentu, registracija je idempotentna).
  registerSloPdfFonts(doc)
  const pageW = doc.internal.pageSize.getWidth()

  // Navy header
  doc.setFillColor(29, 43, 62)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15)
  doc.setFont('Roboto', 'bold')
  doc.text('ROKSAL — Materialni list', 14, 12)
  doc.setFontSize(9)
  doc.setFont('Roboto', 'normal')
  doc.text('Kranj, Slovenija', 14, 18)
  // Amber accent
  doc.setFillColor(245, 158, 11)
  doc.rect(0, 22, pageW, 1.5, 'F')

  let y = 30
  doc.setTextColor(20, 20, 20)
  doc.setFontSize(10)
  doc.setFont('Roboto', 'normal')
  doc.text(`Profil: ${materialResult.selectedProfile?.naziv ?? '—'} (${materialResult.selectedProfile?.sifra ?? '—'})`, 14, y)
  y += 5
  if (projectName.trim()) {
    doc.text(`Projekt: ${projectName.trim()}`, 14, y)
    y += 5
  }
  doc.text(`Datum: ${slDatumKratko(new Date())}`, 14, y)
  y += 5
  doc.text(`Rezerva materiala: ${rezervaPctMaterial}%`, 14, y)
  y += 5
  // runda S — kontekst terena v materialni list (prava pritrditev + barva)
  if (importedFromMeasurement?.podlaga) {
    doc.text(`Pritrditev (podlaga z terena: ${podlagaLabels[importedFromMeasurement.podlaga] ?? importedFromMeasurement.podlaga}): ${podlagaSidraLabel[importedFromMeasurement.podlaga] ?? 'po meri'}`, 14, y)
    y += 5
  }
  if (importedFromMeasurement?.ralCode) {
    doc.text(`Barva profila: RAL ${importedFromMeasurement.ralCode} (${ralNarociloNames[importedFromMeasurement.ralCode] ?? 'po meri'}) — prašno lakirano`, 14, y)
    y += 5
  }
  y += 2

  // Summary table (z rezervo)
  autoTable(doc, {
    startY: y,
    head: [['Material', 'Brez rezerve', 'Z rezervo', 'Enota']],
    body: [
      ['Letve (zgoraj + spodaj)', `${materialResult.railLinearMeters.toFixed(2)}`, `${materialResult.railLinearMeters.toFixed(2)}`, 'm'],
      ['Palice (linearni metri)', `${materialResult.balusterLinearMeters.toFixed(2)}`, `${materialResult.balusterLinearMeters.toFixed(2)}`, 'm'],
      ['Skupno profil', `${materialResult.totalLinearMeters.toFixed(2)}`, `${materialResult.totalLinearMeters.toFixed(2)}`, 'm'],
      ['Palice (število)', `${materialResult.balusterCount}`, `${applyReserve(materialResult.balusterCount, rezervaPctMaterial)}`, 'kos'],
      ['Stebri', `${materialResult.postCount}`, `${applyReserve(materialResult.postCount, rezervaPctMaterial)}`, 'kos'],
      ['Število letvev (top+bottom)', `${materialResult.railCount}`, `${applyReserve(materialResult.railCount, rezervaPctMaterial)}`, 'kos'],
      ['Vijaki (4/palico + 8/stebro)', `${materialResult.screwCount}`, `${applyReserve(materialResult.screwCount, rezervaPctMaterial)}`, 'kos'],
      ['Sidra (2/stebro)', `${materialResult.anchorCount}`, `${applyReserve(materialResult.anchorCount, rezervaPctMaterial)}`, 'kos'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [29, 43, 62], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [247, 249, 255] },
    margin: { left: 14, right: 14 },
  })

  // Cost breakdown (material)
  const y2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  const labor = calculateLaborCost({
    urnaPostavka: parseFloat(urnaPostavka) || 0,
    stUr: parseFloat(stUr) || 0,
    stMonterjev: parseFloat(stMonterjev) || 0,
    transport: parseFloat(transport) || 0,
  })
  const skupajBrezDdv = materialResult.totalCost + labor.delaSkupaj
  const ddv = calculateDDV(skupajBrezDdv, ddvPct)
  const akon = calculateAkontacija(ddv.total, akontacijaPct)

  autoTable(doc, {
    startY: y2,
    head: [['Postavka', 'Cena (€)']],
    body: [
      ['Profil material', materialResult.profileCost.toFixed(2)],
      ['Stebri (25 €/kos)', materialResult.postsCost.toFixed(2)],
      ['Vijaki (0,10 €/kos)', materialResult.screwsCost.toFixed(2)],
      ['Sidra (1,50 €/kos)', materialResult.anchorsCost.toFixed(2)],
      ['SKUPAJ MATERIAL', materialResult.totalCost.toFixed(2)],
      ['', ''],
      ['Delo (ura × ur × monterji)', labor.cistaDela.toFixed(2)],
      ['Transport', labor.transport.toFixed(2)],
      ['SKUPAJ BREZ DDV', skupajBrezDdv.toFixed(2)],
      [`DDV (${formatSI(ddvPct, 1)}%)`, ddv.ddvAmount.toFixed(2)],
      ['SKUPAJ Z DDV', ddv.total.toFixed(2)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [245, 158, 11], textColor: [29, 43, 62], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      // Bold for SKUPAJ rows
      if (data.cell.raw === 'SKUPAJ MATERIAL' || data.cell.raw === 'SKUPAJ BREZ DDV' || data.cell.raw === 'SKUPAJ Z DDV') {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.textColor = [29, 43, 62]
      }
    },
  })

  // Akontacija (if > 0)
  let afterY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  if (akontacijaPct > 0) {
    const placiloDatum = slDatumKratko(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
    autoTable(doc, {
      startY: afterY + 6,
      head: [['Akontacija', 'Znesek (€)', 'Rok']],
      body: [
        [`Akontacija (${akontacijaPct}%) — ob naročilu`, akon.akontacija.toFixed(2), placiloDatum],
        [`Preostanek (${100 - akontacijaPct}%) — ob prevzemu`, akon.preostanek.toFixed(2), 'ob prevzemu'],
      ],
      theme: 'grid',
      headStyles: { fillColor: [29, 43, 62], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    })
    afterY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  }

  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text('Roksal Railing Manager — orientacijska cena. Končno ponudbo pripravi vodja projekta.', 14, afterY + 10)
  doc.save(`roksal-materialni-list-${Date.now()}.pdf`)
  toast.success('Materialni list PDF izvožen')
}

// ===== PDF: CNC razrezni list =====
export function exportCncPdf(args: {
  cncResult: CncCutResult | null
  cncStockLength: string
  cncSawBlade: string
  cncSegments: CncSegment[]
  projectName: string
}): void {
  const { cncResult, cncStockLength, cncSawBlade, cncSegments, projectName } = args
  if (!cncResult) return
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  // R352 — slovenski glifi: Roboto subset (kanon r269/R351 — kliči pred
  // prvo setFont; VFS je na dokumentu, registracija je idempotentna).
  registerSloPdfFonts(doc)
  const pageW = doc.internal.pageSize.getWidth()

  // Navy header
  doc.setFillColor(29, 43, 62)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15)
  doc.setFont('Roboto', 'bold')
  doc.text('ROKSAL — Razrezni list CNC', 14, 12)
  doc.setFontSize(9)
  doc.setFont('Roboto', 'normal')
  doc.text('Kranj, Slovenija', 14, 18)
  doc.setFillColor(245, 158, 11)
  doc.rect(0, 22, pageW, 1.5, 'F')

  let y = 30
  doc.setTextColor(20, 20, 20)
  doc.setFontSize(10)
  doc.setFont('Roboto', 'normal')
  doc.text(`Dolžina profila: ${cncStockLength}mm`, 14, y)
  y += 5
  doc.text(`Širina reza: ${cncSawBlade}mm`, 14, y)
  y += 5
  if (projectName.trim()) {
    doc.text(`Projekt: ${projectName.trim()}`, 14, y)
    y += 5
  }
  doc.text(`Datum: ${slDatumKratko(new Date())}`, 14, y)
  y += 5
  doc.text(`Število profilov: ${cncResult.stockCount}  ·  Izkoristek: ${cncResult.overallUtilizationPct.toFixed(1)}%  ·  Ostanek: ${cncResult.totalWasteMm}mm`, 14, y)
  y += 7

  // Seznam odsekov
  doc.setFontSize(11)
  doc.setFont('Roboto', 'bold')
  doc.setTextColor(29, 43, 62)
  doc.text('Zahtevani odseki', 14, y)
  y += 4

  autoTable(doc, {
    startY: y,
    head: [['#', 'Labela', 'Dolžina (mm)', 'Število']],
    body: cncSegments
      .filter((s) => s.lengthMm && s.count)
      .map((s, i) => [String(i + 1), s.label || '—', s.lengthMm, s.count]),
    theme: 'grid',
    headStyles: { fillColor: [29, 43, 62], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [247, 249, 255] },
    margin: { left: 14, right: 14 },
  })

  let y2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  doc.setFontSize(11)
  doc.setFont('Roboto', 'bold')
  doc.setTextColor(29, 43, 62)
  doc.text('Razrezni načrt', 14, y2)
  y2 += 4

  const planRows: [string, string, string][] = []
  cncResult.plans.forEach((plan) => {
    const cutsStr = plan.cuts.map((c) => `${c.lengthMm}mm${c.label ? ` (${c.label})` : ''}`).join(', ')
    planRows.push([
      `Profil #${plan.stockIndex}`,
      cutsStr || '—',
      `Ostanek: ${plan.remainingMm}mm (${plan.utilizationPct.toFixed(1)}%)`,
    ])
  })
  autoTable(doc, {
    startY: y2,
    head: [['Profil', 'Rezi', 'Ostanek / Izkoristek']],
    body: planRows,
    theme: 'grid',
    headStyles: { fillColor: [245, 158, 11], textColor: [29, 43, 62], fontSize: 9 },
    bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
    alternateRowStyles: { fillColor: [247, 249, 255] },
    margin: { left: 14, right: 14 },
  })

  // Warnings
  if (cncResult.warnings.length > 0) {
    const y3 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    doc.setFontSize(10)
    doc.setFont('Roboto', 'bold')
    doc.setTextColor(245, 158, 11)
    doc.text('Opozorila', 14, y3)
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(80, 80, 80)
    cncResult.warnings.forEach((w, i) => {
      doc.text(`• ${w}`, 14, y3 + 5 + i * 4)
    })
  }

  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  doc.text('Roksal Railing Manager — razrezni list za CNC operaterja.', 14, finalY + 20)
  doc.save(`roksal-razrezni-list-${Date.now()}.pdf`)
  toast.success('Razrezni list PDF izvožen')
}

// ===== PDF: Veter po lokaciji =====
export function exportWindLocPdf(args: {
  windLocResult: WindLocationResult | null
  windLocLat: string
  windLocLon: string
  windLocHeight: string
  windLocTerrain: TerrainCategory
  windLocArea: string
  windLocType: RailingType
  projectName: string
}): void {
  const {
    windLocResult,
    windLocLat,
    windLocLon,
    windLocHeight,
    windLocTerrain,
    windLocArea,
    windLocType,
    projectName,
  } = args
  if (!windLocResult) return
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  // R352 — slovenski glifi: Roboto subset (kanon r269/R351 — kliči pred
  // prvo setFont; VFS je na dokumentu, registracija je idempotentna).
  registerSloPdfFonts(doc)
  const pageW = doc.internal.pageSize.getWidth()

  // Navy header
  doc.setFillColor(29, 43, 62)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15)
  doc.setFont('Roboto', 'bold')
  doc.text('ROKSAL — Vetrno poročilo', 14, 12)
  doc.setFontSize(9)
  doc.setFont('Roboto', 'normal')
  doc.text('Kranj, Slovenija', 14, 18)
  doc.setFillColor(245, 158, 11)
  doc.rect(0, 22, pageW, 1.5, 'F')

  let y = 30
  doc.setTextColor(20, 20, 20)
  doc.setFontSize(11)
  doc.setFont('Roboto', 'bold')
  doc.text('Lokacija', 14, y)
  y += 5
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(10)
  doc.text(`${windLocResult.locationDescription}`, 14, y)
  y += 5
  doc.text(`GPS: ${windLocLat}, ${windLocLon}`, 14, y)
  y += 5
  doc.text(`Višina nad tlemi: ${windLocHeight}m  ·  Teren: ${windLocTerrain}  ·  Tip: ${railingTypeLabels[windLocType]}  ·  Površina: ${windLocArea}m²`, 14, y)
  y += 8

  autoTable(doc, {
    startY: y,
    head: [['Parameter', 'Vrednost']],
    body: [
      ['Vetrna cona', `Cona ${windLocResult.windZone}`],
      ['Osnovna hitrost vetra', `${windLocResult.basicWindSpeedMs} m/s`],
      ['Osnovni vetrni tlak', `${windLocResult.basicPressureKpa.toFixed(3)} kPa`],
      ['Vrhnji vetrni tlak', `${windLocResult.designPressureKpa.toFixed(3)} kPa`],
      ['Skupna sila na ograjo', `${windLocResult.totalForceKn.toFixed(2)} kN`],
      ['Sila na meter', `${windLocResult.forcePerMeterNm.toFixed(0)} N/m`],
      ['Stopnja tveganja', riskLabels[windLocResult.riskLevel]],
    ],
    theme: 'grid',
    headStyles: { fillColor: [29, 43, 62], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [247, 249, 255] },
    margin: { left: 14, right: 14 },
  })

  let y2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  if (windLocResult.recommendations.length > 0) {
    doc.setFontSize(11)
    doc.setFont('Roboto', 'bold')
    doc.setTextColor(245, 158, 11)
    doc.text('Priporočila', 14, y2)
    y2 += 5
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(60, 60, 60)
    windLocResult.recommendations.forEach((r, i) => {
      const lines = doc.splitTextToSize(`• ${r}`, pageW - 28)
      doc.text(lines, 14, y2 + i * 5)
      y2 += lines.length * 5 - 5
    })
  }

  if (projectName.trim()) {
    y2 += 8
    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    doc.text(`Projekt: ${projectName.trim()}`, 14, y2)
  }

  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text(`Datum: ${slDatumKratko(new Date())} — Roksal Railing Manager (SIST EN 1991-1-4 NA)`, 14, 280)
  doc.save(`roksal-vetrno-porocilo-${Date.now()}.pdf`)
  toast.success('Vetrno poročilo PDF izvoženo')
}

// ===== PDF: Steklena balustrada specifikacija =====
export function exportGlassPdf(args: {
  glassResult: GlassCalcResult | null
  glassInput: {
    spanMm: number
    heightMm: number
    loadKnPerM: number
    glassType: GlassType
  }
  projectName: string
}): void {
  const { glassResult, glassInput, projectName } = args
  if (!glassResult) return
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  // R352 — slovenski glifi: Roboto subset (kanon r269/R351 — kliči pred
  // prvo setFont; VFS je na dokumentu, registracija je idempotentna).
  registerSloPdfFonts(doc)
  const pageW = doc.internal.pageSize.getWidth()

  // Navy header
  doc.setFillColor(29, 43, 62)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15)
  doc.setFont('Roboto', 'bold')
  doc.text('ROKSAL — Steklena balustrada specifikacija', 14, 12)
  doc.setFontSize(9)
  doc.setFont('Roboto', 'normal')
  doc.text('Kranj, Slovenija', 14, 18)
  doc.setFillColor(245, 158, 11)
  doc.rect(0, 22, pageW, 1.5, 'F')

  let y = 30
  doc.setTextColor(20, 20, 20)
  doc.setFontSize(10)
  doc.setFont('Roboto', 'normal')
  const glassTypeLabelsLocal: Record<GlassType, string> = {
    single: 'Enojno steklo',
    laminated: 'Laminirano steklo',
    tempered: 'Kaljeno steklo',
  }
  doc.text(`Tip stekla: ${glassTypeLabelsLocal[glassInput.glassType]}`, 14, y)
  y += 5
  doc.text(`Razpon med stebri: ${glassInput.spanMm}mm`, 14, y)
  y += 5
  doc.text(`Višina stekla: ${glassInput.heightMm}mm`, 14, y)
  y += 5
  doc.text(`Horizontalna obremenitev: ${glassInput.loadKnPerM.toFixed(1)} kN/m`, 14, y)
  y += 8

  autoTable(doc, {
    startY: y,
    head: [['Parameter', 'Vrednost']],
    body: [
      ['Priporočena debelina', `${glassResult.recommendedThicknessMm}mm`],
      ['Napetost v steklu', `${glassResult.stressMpa.toFixed(1)} MPa`],
      ['Dovoljena napetost', `${glassResult.allowableStressMpa} MPa`],
      ['Max razpon za debelino', `${glassResult.maxSpanForThicknessMm}mm`],
      ['Število slojev', glassResult.layers ? `${glassResult.layers}` : '1'],
      ['Varnost', glassResult.isSafe ? 'VARNO ✓' : 'NEVARNO ✗'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [29, 43, 62], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [247, 249, 255] },
    margin: { left: 14, right: 14 },
  })

  let y2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  doc.setFontSize(11)
  doc.setFont('Roboto', 'bold')
  doc.setTextColor(29, 43, 62)
  doc.text('Alternativne debeline', 14, y2)
  y2 += 4
  autoTable(doc, {
    startY: y2,
    head: [['Debelina (mm)', 'Status', 'Razlog']],
    body: glassResult.alternativeThicknesses.map((a) => [
      `${a.mm}`,
      a.safe ? 'VARNO' : 'Tveganje',
      a.reason,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [245, 158, 11], textColor: [29, 43, 62], fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [247, 249, 255] },
    margin: { left: 14, right: 14 },
  })

  let y3 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  if (glassResult.warnings.length > 0) {
    doc.setFontSize(11)
    doc.setFont('Roboto', 'bold')
    doc.setTextColor(245, 158, 11)
    doc.text('Opozorila', 14, y3)
    y3 += 5
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(80, 80, 80)
    glassResult.warnings.forEach((w, i) => {
      const lines = doc.splitTextToSize(`• ${w}`, pageW - 28)
      doc.text(lines, 14, y3 + i * 4)
      y3 += lines.length * 4 - 4
    })
    y3 += 6
  }

  if (glassResult.recommendations.length > 0) {
    doc.setFontSize(11)
    doc.setFont('Roboto', 'bold')
    doc.setTextColor(29, 43, 62)
    doc.text('Priporočila', 14, y3)
    y3 += 5
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(60, 60, 60)
    glassResult.recommendations.forEach((r, i) => {
      const lines = doc.splitTextToSize(`• ${r}`, pageW - 28)
      doc.text(lines, 14, y3 + i * 4)
      y3 += lines.length * 4 - 4
    })
  }

  if (projectName.trim()) {
    y3 += 8
    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    doc.text(`Projekt: ${projectName.trim()}`, 14, y3)
  }

  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text(`Datum: ${slDatumKratko(new Date())} — Roksal Railing Manager (poenostavljena metoda po SIST EN)`, 14, 280)
  doc.save(`roksal-steklena-balustrada-${Date.now()}.pdf`)
  toast.success('Specifikacija stekla PDF izvožena')
}
