// R350 — dekompozicija measurements-tab FAZA 7: seznam meritev PDF izvoz
// (vzorec FAZA 5/R348 CSV gradniki + kalkulator FAZA 2/R325 pdf-exports +
// lib/meritve-teren-pdf r269 build/generate razcep: čisti buildXDoc gradnik
// + tanka generate wrapper z doc.save).
// ---------------------------------------------------------------------------
// Motiv: handleExportPDF je nosil 85-vrstični inline jsPDF gradnik (glava +
// povzetek + autoTable tabela + noga) ZNOTREJ komponente — zadnji veliki
// inline izvozni gradnik v tabu (CSV družina je EN VIR od R348, teren
// fetch+prune od R349).
//
// Načela:
//  • IZVOŽENO = ZASLON: isti fallbacki kot UI (oznaka || lokacija ||
//    `Meritev #xxxx`, tipMeritveLabels / statusLabels jedra, kot || '—');
//  • VERBATIM premik: telesa gradnika NESPREMENJENA — izvoženi PDF je
//    bajtno enak (font standard helvetica — GLIFNA RESNICA obstoječa,
//    izven FAZA kontrakta; kandidat za naslednjo rundu prek
//    registerSloPdfFonts vzorca r269, če lastnik želi);
//  • determinizem: čist gradnik nad izrecnimi vhodi — izvozeni časovni žig
//    (noga) je VHOD izvozenoOb: Date, ime datoteke je klicateljeva resnica
//    (VERBATIM toISOString().slice(0, 10) vzorec ostane v klicatelju);
//  • povzetek številke = klicateljeva izpeljava (totalLength/avgHeight/
//    totalArea/statusCounts — ISTA resnica kot KPI kartice, WYSIWYG).
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { slCasDolgo, slDatumKratko } from '@/lib/csv-export'
import { formatDimension, formatM2 } from './format'
import { statusLabels, tipMeritveLabels } from './labels'
import type { MeasurementStatus, TipMeritve } from './shared'

// ── Determinističen fileId (kanon document-pdf R121 / meritve-teren r269;
//    vzorec meritve-teren-pdf.ts VERBATIM, NOVI soli 0xd9–0xdc) ──
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
    fnv1aHex(seed, 0xd9) +
    fnv1aHex(seed, 0xda) +
    fnv1aHex(seed, 0xdb) +
    fnv1aHex(seed, 0xdc)
  )
}

/** Izsek client vmesnika Measurement (measurements-tab.tsx / shared.ts) —
 *  samo polja, ki jih 9-stolpčna tabela potrebuje. */
export interface SeznamPdfMeritev {
  id: string
  oznaka?: string | null
  lokacija?: string | null
  tipMeritve?: TipMeritve | null
  status?: MeasurementStatus | null
  segmentId?: string | null
  dolzinaMm: number
  visinaMm: number
  kot?: number | null
  createdAt: string
}

/** Statusi povzetka (R154 — okvirni prikaz, ne poslovna matematika). */
export interface SeznamPdfStatusi {
  OSNUTEK: number
  POTRJENA: number
  ARHIVIRANA: number
}

/** Vhodi gradnika — vse klicateljeve resnice (povzetek KPI + tabela + noga). */
export interface SeznamPdfArgs {
  measurements: readonly SeznamPdfMeritev[]
  projectName: string
  totalLength: number
  avgHeight: number
  stSegmentov: number
  najdalsaDolzinaMm: number | null
  totalArea: number
  statusCounts: SeznamPdfStatusi
  izvozenoOb: Date
}

/** Zgradi PDF dokument seznam meritev (čist gradnik — brez save, brez
 *  stranskih učinkov; determinizem: enak vhod = bajtno enak dokument). */
export function buildSeznamPdfDoc(args: SeznamPdfArgs): jsPDF {
  const {
    measurements,
    projectName,
    totalLength,
    avgHeight,
    stSegmentov,
    najdalsaDolzinaMm,
    totalArea,
    statusCounts,
    izvozenoOb,
  } = args

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()

  // Glava
  doc.setFillColor(29, 43, 62) // roksal-navy
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('ROKSAL — Seznam meritev', 14, 14)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Projekt: ${projectName}`, 14, 19)

  // Povzetek
  doc.setTextColor(40, 40, 40)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Povzetek', 14, 32)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const summary = [
    `Skupna dolžina: ${formatDimension(totalLength)}`,
    `Povprečna višina: ${formatDimension(Math.round(avgHeight))}`,
    `Število meritev: ${measurements.length}`,
    `Število segmentov: ${stSegmentov}`,
    `Najdaljša meritev: ${najdalsaDolzinaMm !== null ? formatDimension(najdalsaDolzinaMm) : '—'}`,
    `Skupna površina: ${formatM2(totalArea)}`,
    // R154 — statusi so del iskrenega povzetka (ŠT=okvirni prikaz, ne
    // poslovna matematika: dolžine/višine ostanejo nespremenjene)
    `Status — Osnutek: ${statusCounts.OSNUTEK} · Potrjena: ${statusCounts.POTRJENA} · Arhivirana: ${statusCounts.ARHIVIRANA}`,
  ]
  summary.forEach((s, i) => {
    const x = 14 + (i % 2) * (pageW / 2 - 14)
    const y = 38 + Math.floor(i / 2) * 5
    doc.text(s, x, y)
  })

  // Tabela meritev
  autoTable(doc, {
    startY: 56,
    head: [['#', 'Oznaka', 'Tip', 'Status', 'Segment', 'Dolžina', 'Višina', 'Kot', 'Datum']],
    body: measurements.map((m, i) => [
      String(i + 1),
      m.oznaka || m.lokacija || `Meritev #${m.id.slice(-4)}`,
      m.tipMeritve ? tipMeritveLabels[m.tipMeritve] : 'Razdalja',
      statusLabels[(m.status || 'OSNUTEK') as MeasurementStatus],
      m.segmentId || '—',
      formatDimension(m.dolzinaMm),
      formatDimension(m.visinaMm),
      m.kot ? `${m.kot}°` : '—',
      slDatumKratko(new Date(m.createdAt)),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [29, 43, 62], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { cellWidth: 8 },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  })

  // Noga
  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 56
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text(
    `Izvozeno ${slDatumKratko(izvozenoOb)}, ${slCasDolgo(izvozenoOb)} • Roksal Kranj`,
    14,
    Math.min(finalY + 10, doc.internal.pageSize.getHeight() - 10)
  )

  // ENA namerna odstopka od VERBATIM (kanon r269 + document-pdf R121 —
  // 100% determinizem): CreationDate = ekspliciten vhod (izvozenoOb) +
  // setFileId(FNV-1a) — trailer /ID je sicer jsPDF NAKLJUČEN. Čista JS
  // FNV-1a; LASTNI soli **0xd9–0xdc** (register: … meritve-teren 0xa1–0xa4,
  // do sedaj najvišji 0xd8 → pdf-seznam 0xd9–0xdc — ista semena v dveh
  // modulih NE smejo dati isti ID). Vsebinski tokovi (glava/povzetek/
  // tabela/noga) ostanejo bajtno isti; isti izvozni trenutek = bajtno
  // enak dokument.
  doc.setCreationDate(izvozenoOb)
  doc.setFileId(deterministichenId(`${izvozenoOb.toISOString()}|${projectName}|${measurements.length}`))

  return doc
}

/** Tanki wrapper: zgradi + shrani (ime datoteke = klicateljeva resnica).
 *  Klicatelj ohrani lastno UI resnico: guard (prazen seznam) + toasti. */
export function exportSeznamPdf(args: SeznamPdfArgs & { filename: string }): void {
  const doc = buildSeznamPdfDoc(args)
  doc.save(args.filename)
}
