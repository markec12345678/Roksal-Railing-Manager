// ---------------------------------------------------------------------------
// R256 (P1-f, 'izvozi' družina — 12. člen) — TEDENSKI VOZNI RED MONTAŽ PDF iz
// logistike (logistics-tab). Vzorec logistika-vozni-red-pdf R255 / koledar-
// pregledov-pdf R253: ROKSAL glava, KPI trio, sekcije po dnevih, autoTable,
// noge, bajtni determinizem.
//
// LOČEN dokument od vozno reda R255 (enojna kronološka vrstica — terenski
// list): ta dokument je RAZGLED PO DNEVIH za PIŠARNO/vodstvo — naslednjih
// 7 dni (danes + 6), ENA sekcija na dan, tako da planer vidi porazdelitev
// dela po tednu NA EN POGLED (kateri dnevi so polni, kateri prazni).
// ENA resnica z zaslonom (WYSIWYG — brat ISTEGA vira):
//  • vir podatkov = ISTI DTO kot vozni red R255 (VozniRedTermin —
//    normalizirajTermin v LogisticsTab) — route NIČ (client+lib only);
//  • okno = naslednjih 7 dni: UTC datum termina (slice(0,10) ISO niza)
//    MORA biti med danes..danes+6 (UTC — ISTI princip kot UTC rez časa
//    R255: determinizem čez pasove, NIKOLI locale-odvisni izpis); termini
//    PRETEKLI ali BOLJ KOT 6 dni naprej NISO v razgledu (to je poimenovana
//    resnica dokumenta — TEDENSKI, ne 'vsi');
//  • status = VERBATIM iz API-ja (5 znanih — preveriVozniRedTermin R255,
//    NIKOLI izračunan v klientu); neznan → TypeError z indeksom krivca;
//  • preklicani termini so VIDNO (RED bold — iskren odpad, ekipa/planer
//    ve, kaj je odpadlo; NIKOLI tiho izpuščeni iz razgleda);
//  • sort = dan ASC, znotraj dneva sortirajVozniRed (datumZacetka ASC =
//    čas ASC, izenačba projekt ASC, null projekt ZADNJI — ISTA izpeljava
//    kot R255, NIČ dvojnega sortiranja).
//
// Načela (družinska pravila — ISTA kot vozni red R255):
//  • Fail-closed: PRAZNO OKNO ne nastaja dokumenta (komponenta pokaže
//    iskren toast 'Ni terminov v naslednjih 7 dneh'); pokvaren vnos →
//    TypeError z indeksom krivca.
//  • Determinizem: `now` KOT parameter (žig + okno + CreationDate + fileId
//    + ime); doc.setCreationDate(now) + doc.setFileId(FNV-1a) — enak vhod
//    = bajtno enak PDF (R121 100×).
//  • CLIENT-safe: čista JS FNV-1a; LASTNI soli **0x75–0x78** (register:
//    prihodki 0x61–64, opomnik 0x65–68, potekli 0x69–6c, koledar 0x6d–0x70,
//    vozni red 0x71–0x74 → tedenski 0x75–0x78 — ista semena v dveh libih
//    NE smejo dati isti ID).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { todayStamp } from './csv-export'
import { zalogaPovzetekCasOznaka } from './zaloga-povzetek'
import { cenikDatumIso } from './cenik-pdf'
import {
  preveriVozniRedTermin,
  sortirajVozniRed,
  type VozniRedTermin,
} from './logistika-vozni-red-pdf'
import { SCHEDULE_TERMINI_STATUS_LABELS } from './termini-prikaz'

// ---------- barve (ISTI dokumenti družina — 0 novih hex) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const GREEN: [number, number, number] = [22, 163, 74] // roksal-green (prihodki R250)
const RED: [number, number, number] = [220, 38, 38] // zaloga-pdf R120 red
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

/** Dnevi tedna — FIKSEN slovenski seznam (getUTCDay() → indeks). NIKOLI
 *  locale-odvisen izpis datuma (odvisen od nastavitev stroja — bajtni
 *  determinizem družine). getUTCDay je čista UTC aritmetika. */
const TEDEN_DNEVI = ['Nedelja', 'Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota'] as const

/** Ime dneva iz ISO datuma (YYYY-MM-DD) — UTC interpretacija (getUTCDay),
 *  ime iz fiksnega seznama (determinizem čez pasove in locale). */
export function tedenskiDanIme(danIso: string): string {
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(danIso)
  if (!m) {
    throw new TypeError(`tedenskiDanIme: pričakovan ISO datum YYYY-MM-DD, ne ${String(danIso)}`)
  }
  const d = new Date(`${danIso}T00:00:00.000Z`)
  return TEDEN_DNEVI[d.getUTCDay()]
}

/** ISO datum (YYYY-MM-DD) za `danes UTC + odmik` dni — čista UTC aritmetika
 *  (Date.UTC + toISOString), determinizem čez pasove (ISTI princip kot UTC
 *  rez časa R255). */
function isoDanUTC(now: Date, odmik: number): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + odmik),
  )
    .toISOString()
    .slice(0, 10)
}

/** Okno tedenskega razgleda — 7 ISO datumov ASC (danes..danes+6, UTC).
 *  IZVOŽENO (testi dokazujejo rob: danes+6 noter, danes+7 ven; mesec/leto
 *  preklop je čista UTC aritmetika — brez robov). */
export function tedenskiOknoDnevi(now: Date): string[] {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('tedenskiOknoDnevi: pričakovan veljaven now: Date')
  }
  return Array.from({ length: 7 }, (_, k) => isoDanUTC(now, k))
}

/** Agregatna izpeljava tedenskega razgleda — ENA resnica za KPI, sklep IN
 *  toast (WYSIWYG). Okno = danes..danes+6 (UTC, tedenskiOknoDnevi). Vrne
 *  null, ko je okno PRAZNO (iskren prazen razgled — komponenta pokaže
 *  toast, NIKOLI prazna datoteka); pokvaren datumZacetka → TypeError z
 *  indeksom krivca (fail-closed — datum je jedro okna, pokvaren = pokvaren
 *  vir, NIKOLI tiho izpuščen). Štetja po SORTIRANEM redu znotraj dneva —
 *  f(množica), ne f(vrstni red odgovora) (FP vzorec R248/R250/R252/R253). */
export interface TedenskiPregledPovzetek {
  /** Št. dni v oknu z vsaj enim terminom (KPI GREEN 'Dni z delom'). */
  dniN: number
  /** Št. terminov v oknu (KPI NAVY 'Terminov'; preklicani šteti — vidni
   *  odpad). */
  terminovN: number
  /** Vsota predvidenih ur samo po vrsticah Z znano uro (KPI AMBER — ISTA
   *  izpeljava kot vozniRedPovzetek R255). */
  nacrtovaneUre: number
  /** Št. vrstic brez znane ure (R168 null — '≥' meja, NIKOLI tiho 0). */
  brezUre: number
  /** Št. preklicanih v oknu (iskren odpad — VIDNO na listu RED bold). */
  preklicanih: number
}

export function tedenskiPregledPovzetek(
  vnosi: readonly VozniRedTermin[],
  now: Date,
): TedenskiPregledPovzetek | null {
  if (!Array.isArray(vnosi)) {
    throw new TypeError('tedenskiPregledPovzetek: pričakovano polje terminov (VozniRedTermin[])')
  }
  const okno = tedenskiOknoDnevi(now)
  const vOknu = new Set(okno)
  let terminovN = 0
  let nacrtovaneUre = 0
  let brezUre = 0
  let preklicanih = 0
  const dni = new Set<string>()
  for (let i = 0; i < vnosi.length; i++) {
    const t = vnosi[i]
    if (
      !t ||
      typeof t !== 'object' ||
      typeof t.datumZacetka !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t.datumZacetka)
    ) {
      throw new TypeError(
        `tedenskiPregledPovzetek (${i}): datumZacetka mora biti ISO niz YYYY-MM-DDTHH:MM… (okno izpeljava), ne ${String(t?.datumZacetka)}`,
      )
    }
    const dan = t.datumZacetka.slice(0, 10)
    if (!vOknu.has(dan)) continue
    terminovN++
    dni.add(dan)
    if (t.status === 'PREKlicANO') preklicanih++
    if (t.predvideneUre === null) brezUre++
    else nacrtovaneUre += t.predvideneUre
  }
  if (terminovN === 0) return null
  return { dniN: dni.size, terminovN, nacrtovaneUre, brezUre, preklicanih }
}

/** KPI vrednost 'Načrtovane ure' — ISTI '≥' signal kot vozniRedUreKpi R255
 *  (brez ure = null → vsota je spodnja meja, NIKOLI lažno popolna). Ločen
 *  podpis (TedenskiPregledPovzetek nima ekipN/zakljucenih), ISTI javni
 *  kontrakt '≥'. */
export function tedenskiUreKpi(
  pov: Pick<TedenskiPregledPovzetek, 'nacrtovaneUre' | 'brezUre'>,
): string {
  return pov.brezUre > 0 ? `≥ ${pov.nacrtovaneUre}` : String(pov.nacrtovaneUre)
}

/** Determinističen file-ID (32 hex) iz semena — čista JS FNV-1a (CLIENT-safe;
 *  LASTNI soli 0x75–0x78: vsak PDF lib družine ima svoje). */
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
    fnv1aHex(seed, 0x75) +
    fnv1aHex(seed, 0x76) +
    fnv1aHex(seed, 0x77) +
    fnv1aHex(seed, 0x78)
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

/** KPI polje — ISTI vzorec kot vozni red R255 / prihodki R250 družina. */
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

export interface TedenskiVozniRedOptions {
  /** Referenčni trenutek (žig + OKNO + CreationDate + fileId + ime) — KOT
   *  PARAMETER (determinizem; vzorec R203/R244/R250–R255). */
  now: Date
}

/** Zgradi TEDENSKI VOZNI RED MONTAŽ dokument (brez shranjevanja) — vrne jsPDF
 *  instanco (testi berejo doc.output('arraybuffer') → bajtni dokazi). */
export function buildTedenskiVozniRedPdfDoc(
  vnosi: readonly VozniRedTermin[],
  options: TedenskiVozniRedOptions,
): jsPDF {
  if (!Array.isArray(vnosi)) {
    throw new TypeError('buildTedenskiVozniRedPdfDoc: pričakovano polje terminov (VozniRedTermin[])')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildTedenskiVozniRedPdfDoc: pričakovane opcije (TedenskiVozniRedOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildTedenskiVozniRedPdfDoc: pričakovan veljaven now: Date')
  }
  // Fail-closed preverba VSEH vhodov (ne samo okna — pokvaren vnos = pokvaren
  // vir, NIKOLI tiho izpuščen; indeks krivca je VEDNO v sporočilu).
  vnosi.forEach((t, i) => preveriVozniRedTermin(t, i))
  // PRAZNO OKNO ne nastaja dokumenta (družina: ni prazne datoteke —
  // komponenta pokaže iskren toast 'Ni terminov v naslednjih 7 dneh.').
  const okno = tedenskiOknoDnevi(now)
  const vOknu = new Set(okno)
  const skupine: Array<[string, VozniRedTermin[]]> = okno
    .map((dan) => [dan, sortirajVozniRed(vnosi.filter((t) => t.datumZacetka.slice(0, 10) === dan))])
    .filter(([, vr]) => vr.length > 0) as Array<[string, VozniRedTermin[]]>
  if (skupine.length === 0) {
    throw new TypeError(
      'buildTedenskiVozniRedPdfDoc: prazno okno (naslednjih 7 dni) ne nastaja dokumenta — komponenta pokaže iskren toast (Ni terminov v naslednjih 7 dneh.)',
    )
  }
  const pov = tedenskiPregledPovzetek(vnosi, now) as TedenskiPregledPovzetek

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / družina) ----------
  doc.setCreationDate(now)
  doc.setFileId(
    deterministichenId(
      `${now.toISOString()}|${okno.join(',')}|${skupine
        .map(
          ([dan, vr]) =>
            `${dan}:${vr.map((t) => `${t.datumZacetka}/${t.status}/${t.projekt ?? ''}`).join(',')}`,
        )
        .join(';')}`,
    ),
  )

  // ---------- glava (ISTI vzorec kot vozni red R255 / boss-report) ----------
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
  doc.text('TEDENSKI VOZNI RED MONTAŽ', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })

  // ---------- KPI trio (Terminov + Načrtovane ure + Dni z delom — ISTI
  //  barvni jezik kot vozni red R255: skupaj NAVY / delo AMBER / razgled GREEN) ----------
  let y = 33
  y = sectionTitle(doc, y, `Naslednjih 7 dni: ${cenikDatumIso(okno[0])} – ${cenikDatumIso(okno[6])}`)
  const bw = 59
  const bh = 16
  const gap = 2.5
  kpiBox(doc, 14, y, bw, bh, 'Terminov', String(pov.terminovN), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Načrtovane ure', tedenskiUreKpi(pov), AMBER)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Dni z delom', String(pov.dniN), GREEN)
  y += bh + 8

  // ---------- sekcije po dnevih (razgled — ENA sekcija na dan, dnevi ASC
  //  kronološki, znotraj dneva sortirajVozniRed: čas ASC, izenačba projekt
  //  ASC, null ZADNJI) ----------
  for (const [dan, vrstice] of skupine) {
    if (y > 240) {
      doc.addPage()
      y = 20
    }
    y = sectionTitle(doc, y, `${tedenskiDanIme(dan)}, ${cenikDatumIso(dan)} · ${vrstice.length} terminov`)
    autoTable(doc, {
      startY: y,
      head: [['Čas', 'Projekt', 'Stranka', 'Ekipa', 'Status', 'Ure', 'Lokacija']],
      body: vrstice.map((t) => [
        t.datumKonca === null
          ? `${t.datumZacetka.slice(11, 13)}:${t.datumZacetka.slice(14, 16)}`
          : `${t.datumZacetka.slice(11, 13)}:${t.datumZacetka.slice(14, 16)}–${t.datumKonca.slice(11, 13)}:${t.datumKonca.slice(14, 16)}`,
        t.projekt ?? '—',
        t.stranka ?? '—',
        t.ekipa ?? '—',
        SCHEDULE_TERMINI_STATUS_LABELS[t.status],
        t.predvideneUre === null ? '—' : String(t.predvideneUre),
        t.lokacija ?? '—',
      ]),
      styles: { fontSize: 7.5, cellPadding: 1.6, font: 'Roboto' },
      headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 24, halign: 'right' },
        4: { cellWidth: 19, halign: 'center' },
        5: { cellWidth: 11, halign: 'right' },
      },
      didParseCell: (data) => {
        // WYSIWYG z zaslonom: ISTI signal kot vozni red R255 — V_TEKU amber,
        // ZAKLJUČENO green, PREKLIČANO rdeče bold (iskren vidni odpad),
        // PRELOŽENO sivo, NAVRTENO navy; '—' sivo (iskrena null resnica).
        if (data.section === 'body' && data.column.index === 4) {
          const label = String(data.cell.raw ?? '')
          if (label === SCHEDULE_TERMINI_STATUS_LABELS.V_TEKU) {
            data.cell.styles.textColor = AMBER
            data.cell.styles.fontStyle = 'bold'
          } else if (label === SCHEDULE_TERMINI_STATUS_LABELS.ZAKLJUCENO) {
            data.cell.styles.textColor = GREEN
          } else if (label === SCHEDULE_TERMINI_STATUS_LABELS.PREKlicANO) {
            data.cell.styles.textColor = RED
            data.cell.styles.fontStyle = 'bold'
          } else if (label === SCHEDULE_TERMINI_STATUS_LABELS.PRELOZENO) {
            data.cell.styles.textColor = GRAY
          } else if (label === SCHEDULE_TERMINI_STATUS_LABELS.NAVRTENO) {
            data.cell.styles.textColor = NAVY
          }
        }
        if (data.section === 'body' && (data.column.index === 1 || data.column.index === 2 || data.column.index === 3 || data.column.index === 5 || data.column.index === 6)) {
          if (String(data.cell.raw ?? '') === '—') {
            data.cell.styles.textColor = GRAY
          }
        }
      },
    })
    y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
    y += 6
  }

  // ---------- sklepna vrstica (iskren podpis: okno + odpad + vir) ----------
  if (y > 255) {
    doc.addPage()
    y = 20
  }
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text(
    `${pov.dniN} dni · ${pov.terminovN} terminov · ${tedenskiUreKpi(pov)} načrtovanih ur${pov.brezUre > 0 ? ` (${pov.brezUre} brez ure)` : ''} · preklicanih ${pov.preklicanih} · okno = danes + 6 dni (UTC) · po dnevih (razgled) · vir = vidni termini logistike.`,
    14,
    y + 4,
  )

  // ---------- noge na vseh straneh (ISTI vzorec kot boss-report družina) ----------
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

/** Ime datoteke — `Tedenski-vozni-red-YYYY-MM-DD.pdf` (ISTI vzorec kot
 *  vozniRedPdfFilename R255 / koledarPregledovPdfFilename R253; EN now za
 *  žig, OKNO IN ime — lekcija R121/R235). */
export function tedenskiVozniRedPdfFilename(now: Date): string {
  return `Tedenski-vozni-red-${todayStamp(now)}.pdf`
}

/** Zgeneriraj Tedenski vozni red PDF (determinističen — enak vhod = bajtno
 *  enak dokument) in ga shrani kot `Tedenski-vozni-red-YYYY-MM-DD.pdf`. */
export function generateTedenskiVozniRedPdf(
  vnosi: readonly VozniRedTermin[],
  options: TedenskiVozniRedOptions,
): void {
  const doc = buildTedenskiVozniRedPdfDoc(vnosi, options)
  doc.save(tedenskiVozniRedPdfFilename(options.now))
}
