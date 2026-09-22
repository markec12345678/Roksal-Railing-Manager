// Mesečno poročilo za vodjo (runda M) — PDF izvoz iz "Pregled za vodjo".
//
// Vsebina (en A4): KPI povzetek meseca, prihodki po mesecih (stolpčni graf),
// plačani računi meseca, projekti po statusu, zapadli računi, opozorila.
// Font: Roboto subset (šumniki) — isti mehanizem kot račun/zapisnik PDF-i.
// Graf rišemo z jsPDF rect primitivi (brez knjižnic) — enak izgled kot DOM
// graf na vodja pregledu.

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'

// ---------- barve (usklajeno z aplikacijo) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const EMERALD: [number, number, number] = [16, 185, 129]
const RED: [number, number, number] = [220, 38, 38]
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

export interface ReportInvoiceRow {
  stevilka: string
  kupec: string
  projekt: string
  znesek: number
  datumIzdaje: string
  rokPlacilaDni: number
  status: string
  placanoAt: string | null
}

export interface ReportProjectRow {
  naziv: string
  stranka: string
  status: string
  cena: number | null
}

export interface ReportData {
  /** Reportirani mesec (0-based month, kot Date mesec). */
  mesec: { year: number; month: number }
  generatedAt: Date
  stats: {
    prihodekMesec: number
    marza: number
    odprtoZnesek: number
    zapadloZnesek: number
    zapadloSt: number
    projektovNovih: number
    ureMesec: number
    skupajProjektov: number
    skupajStrank: number
    skupniLTV: number
    nizkaZaloga: number
    odprtaNarocila: number
    potekliOpomniki: number
  }
  /** Zadnjih 6 mesecev plačanih računov (label = kratko ime meseca). */
  prihodki6: { label: string; eur: number }[]
  placaniTaMesec: ReportInvoiceRow[]
  izdaniZapadli: ReportInvoiceRow[]
  projekti: ReportProjectRow[]
}

const STATUS_SL: Record<string, string> = {
  NACRTOVANO: 'Načrtovano',
  V_TEKU: 'V teku',
  ZA_MONTAZO: 'Za montažo',
  V_IZDELAVI: 'V izdelavi',
  MONTIRANO: 'Montirano',
  ZAKLJUCENO: 'Zaključeno',
  USTAVLJENO: 'Ustavljeno',
}

const eur = (n: number) =>
  n.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const eur0 = (n: number) =>
  n.toLocaleString('sl-SI', { maximumFractionDigits: 0 }) + ' €'

function slDatum(d: Date | string): string {
  return new Date(d).toLocaleDateString('sl-SI')
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Ime meseca v slovenščini, velika začetnica ("September"). */
export function mesecIme(year: number, month: number): string {
  return capitalize(new Date(year, month, 1).toLocaleDateString('sl-SI', { month: 'long' }))
}

const LAST_AUTOTABLE_Y = (doc: jsPDF): number =>
  (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 0

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

/** KPI polje — svetlo ozadje, label + velika vrednost. */
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

/** Stolpčni graf prihodkov — čisti jsPDF primitivi. */
function chartPrihodki(doc: jsPDF, startY: number, data: { label: string; eur: number }[]): number {
  const left = 14
  const width = 182
  const chartH = 34
  const max = Math.max(...data.map((d) => d.eur), 1)
  const slot = width / data.length
  const barW = Math.min(slot - 10, 22)

  // osnovna črta
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.3)
  doc.line(left, startY + chartH, left + width, startY + chartH)

  data.forEach((d, i) => {
    const cx = left + slot * i + (slot - barW) / 2
    const h = Math.max((d.eur / max) * (chartH - 10), d.eur > 0 ? 4 : 1.5)
    const isCurrent = i === data.length - 1
    doc.setFillColor(...(isCurrent ? AMBER : NAVY))
    doc.rect(cx, startY + chartH - h, barW, h, 'F')
    // vrednost nad stolpcem (samo če > 0)
    if (d.eur > 0) {
      doc.setFont('Roboto', 'bold')
      doc.setFontSize(6.5)
      doc.setTextColor(...NAVY)
      doc.text(eur0(d.eur), cx + barW / 2, startY + chartH - h - 1.5, { align: 'center' })
    }
    // mesec pod stolpcem
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...GRAY)
    doc.text(d.label, cx + barW / 2, startY + chartH + 4, { align: 'center' })
  })

  return startY + chartH + 10
}

/**
 * Zgeneriraj mesečno poročilo PDF (en A4, več strani po potrebi)
 * in ga shrani kot `porocilo-YYYY-MM.pdf`.
 */
export function generateMonthlyReport(data: ReportData): void {
  const doc = new jsPDF()
  registerSloPdfFonts(doc)
  const s = data.stats
  const mesecNaziv = `${mesecIme(data.mesec.year, data.mesec.month)} ${data.mesec.year}`

  // ---------- glava ----------
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
  doc.text('MESEČNO POROČILO', 196, 12, { align: 'right' })
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(mesecNaziv, 196, 19, { align: 'right' })

  // ---------- KPI povzetek ----------
  let y = sectionTitle(doc, 33, 'Povzetek meseca')
  const bw = 58
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Prihodek (plačano)', eur0(s.prihodekMesec), EMERALD)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Marža (25 %)', eur0(s.marza), EMERALD)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Odprto (izdano)', eur0(s.odprtoZnesek), NAVY)
  const y2 = y + bh + 3
  kpiBox(doc, 14, y2, bw, bh, 'Zapadlo', s.zapadloSt > 0 ? `${eur0(s.zapadloZnesek)} (${s.zapadloSt})` : '0 €', s.zapadloSt > 0 ? RED : NAVY)
  kpiBox(doc, 14 + bw + gap, y2, bw, bh, 'Novih projektov', String(s.projektovNovih), NAVY)
  kpiBox(doc, 14 + 2 * (bw + gap), y2, bw, bh, 'Ure (koledar)', `${s.ureMesec} h`, NAVY)

  // ---------- graf prihodkov ----------
  y = y2 + bh + 8
  y = sectionTitle(doc, y, 'Prihodki — zadnjih 6 mesecev (plačani računi)')
  y = chartPrihodki(doc, y, data.prihodki6)

  // ---------- plačani računi meseca ----------
  y = sectionTitle(doc, y + 2, `Plačani računi — ${mesecNaziv}`)
  if (data.placaniTaMesec.length === 0) {
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...GRAY)
    doc.text('Ta mesec še ni plačanih računov.', 14, y)
    y += 6
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Račun', 'Kupec', 'Projekt', 'Plačano', 'Znesek']],
      body: data.placaniTaMesec.map((inv) => [
        inv.stevilka,
        inv.kupec || '—',
        inv.projekt || '—',
        inv.placanoAt ? slDatum(inv.placanoAt) : '—',
        eur(inv.znesek),
      ]),
      styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
      headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' },
      },
    })
    y = LAST_AUTOTABLE_Y(doc) + 6
  }

  // ---------- zapadli računi (samo če obstajajo) ----------
  if (data.izdaniZapadli.length > 0) {
    y = sectionTitle(doc, y, 'Zapadli računi — zahtevajo izterjavo')
    autoTable(doc, {
      startY: y,
      head: [['Račun', 'Kupec', 'Rok plačila', 'Dni zapadlo', 'Znesek']],
      body: data.izdaniZapadli.map((inv) => {
        const rok = new Date(inv.datumIzdaje)
        rok.setDate(rok.getDate() + inv.rokPlacilaDni)
        const dni = Math.max(0, Math.floor((data.generatedAt.getTime() - rok.getTime()) / 86400000))
        return [inv.stevilka, inv.kupec || '—', slDatum(rok), String(dni), eur(inv.znesek)]
      }),
      styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
      headStyles: { fillColor: [...RED], textColor: 255, fontSize: 8 },
      columnStyles: {
        3: { halign: 'center' },
        4: { halign: 'right', fontStyle: 'bold' },
      },
    })
    y = LAST_AUTOTABLE_Y(doc) + 6
  }

  // ---------- projekti po statusu ----------
  y = sectionTitle(doc, y, `Projekti — stanje ob izdaji poročila (${data.projekti.length})`)
  autoTable(doc, {
    startY: y,
    head: [['Projekt', 'Stranka', 'Status', 'Cena']],
    body:
      data.projekti.length === 0
        ? [['—', '—', '—', '—']]
        : data.projekti.map((p) => [
            p.naziv,
            p.stranka || '—',
            STATUS_SL[p.status] ?? p.status,
            p.cena != null ? eur(p.cena) : '—',
          ]),
    styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
    columnStyles: { 3: { halign: 'right' } },
  })
  y = LAST_AUTOTABLE_Y(doc) + 6

  // ---------- opozorila ----------
  const opozorila: string[] = []
  if (s.zapadloSt > 0) opozorila.push(`${s.zapadloSt} zapadl(ih) račun(ov) — ${eur0(s.zapadloZnesek)} (pošlji opomnike)`)
  if (s.nizkaZaloga > 0) opozorila.push(`${s.nizkaZaloga} material(ov) z nizko zalogo — naroči pri dobavitelju`)
  if (s.odprtaNarocila > 0) opozorila.push(`${s.odprtaNarocila} odprt(ih) naročil — čaka dobavo`)
  if (s.potekliOpomniki > 0) opozorila.push(`${s.potekliOpomniki} potekl(ih) opomnik(ov) strank v CRM`)
  if (opozorila.length > 0) {
    y = sectionTitle(doc, y, 'Opozorila')
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...RED)
    for (const o of opozorila) {
      if (y > 275) {
        doc.addPage()
        y = 20
      }
      doc.text(`•  ${o}`, 16, y)
      y += 5
    }
  }

  // ---------- sklepna vrstica ----------
  if (y > 255) {
    doc.addPage()
    y = 20
  }
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text(
    `Skupno stanje: ${s.skupajProjektov} projektov, ${s.skupajStrank} strank, skupni LTV ${eur0(s.skupniLTV)}.`,
    14,
    y + 4
  )

  // ---------- noge na vseh straneh ----------
  const strani = doc.getNumberOfPages()
  const genStr = `Generirano ${slDatum(data.generatedAt)} ob ${data.generatedAt.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}`
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

  const mm = String(data.mesec.month + 1).padStart(2, '0')
  doc.save(`porocilo-${data.mesec.year}-${mm}.pdf`)
}
