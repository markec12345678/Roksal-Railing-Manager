// ---------------------------------------------------------------------------
// R236 (P1-c 'izvozi' družina — PDF dimenzija, 3. člen) — DOBAVITELJI PDF IZ
// Material → Dobavitelji. CSV obstaja od R233; ta lib je njegov PRAVI PDF
// brat (vzorec zaloga-pdf R234 / naročilnica-pdf R235: ROKSAL glava, KPI,
// autoTable, noge, bajtni determinizem).
//
// ENA RESNICA z zaslonom in CSV (WYSIWYG — brat iz ISTEGA vira):
//  • stolpci tabele = TOČNO ISTI prerez kot CSV R233 (Naziv, Status, Kontakt,
//    Telefon, Email, Dobavni rok (dni), Popust (%), Št. cen, Št. naročil);
//  • Status 'Aktiven/Neaktiven' = ISTA resnica kot pika + title na kartici
//    (R144) — `s.aktivna ? 'Aktiven' : 'Neaktiven'`;
//  • manjkajoči _count (starejši hint, sekanc med deployema) = PRAZNI celici
//    — NIKOLI izmišljen 0 (fail-closed, CSV R233 / R227 'producers brez polja
//    = brez oznake' vzorec);
//  • kontakt/telefon/email manjkajo → PRAZNA celica (nič izmišljenega);
//  • KPI škatle se RAČUNAJO IZ obveznih polj vrstic (skupaj/aktivni/
//    neaktivni) — dokument vedno notranje skladen; števci cen/naročil NISO
//    KPI (manjkajoči _count bi lažno učinkoval kot '0 cen' — neizpodbitno
//    R204 pravilo: neizznane vrednosti ne gredo v povzetke).
//
// Načela (družinska pravila):
//  • Fail-closed: pokvaren vnos → TypeError (naziv ne-prazen, aktivna boolean,
//    dobavniRok/popust končna ne-negativna števila — indeks krivca v
//    sporočilu). PRAZEN SEZNAM ne nastaja dokumenta (R232/R233/R234/R235
//    družina: ni prazne datoteke; komponenta pokaže iskren toast).
//  • Determinizem: `now` pride KOT parameter; doc.setCreationDate(now) +
//    doc.setFileId(FNV-1a) — enak vhod = bajtno enak PDF (document-pdf R121
//    100× pravilo; zaloga/naročilnica/dobavitelji = ISTA družina).
//  • CLIENT-safe: uvozi ga material-intelligence-tab (client) — node:crypto
//    NE sme v client bundle (lekcija R234); FNV-1a = čista JS (zasebna kopija
//    zaloga-pdf vzorca — dokumentirana duplikacija različnih runtimes, LASTNI
//    soli 0x21–0x24 — ID drv po libu, ne kolizija med brati).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { todayStamp } from './csv-export'
import { zalogaPovzetekCasOznaka } from './zaloga-povzetek'

// ---------- barve (USKLAJENO z boss-report/zaloga-pdf/naročilnica — ISTI dokumenti družina) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const GREEN: [number, number, number] = [22, 163, 74] // roksal-green (R144 pika 'Aktiven')
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

/** Client-safe prerez dobavitelja za PDF (ISTI prerez kot CSV R233 v
 *  material-intelligence-tab — _count opcijsko, ISTA strogost: manjkajoči
 *  števec = prazna celica, NIKOLI 0). */
export interface DobaviteljPdfVnos {
  naziv: string
  aktivna: boolean
  kontakt?: string | null
  telefon?: string | null
  email?: string | null
  dobavniRok: number
  popust: number
  _count?: { materialPrices?: number; orders?: number }
}

export interface DobaviteljiPdfOptions {
  /** Referenčni trenutek (žig + CreationDate + fileId + ime) — KOT PARAMETER
   *  (determinizem, vzorec R203/R204/R167). */
  now: Date
}

/** Fail-closed preverba dobavitelja (obvezna polja = ISTA kot CSV R233 vrstica;
 *  opcijska polja so string|null|undefined — manjkajoče = prazna celica). */
export function preveriDobaviteljPdfVnos(s: DobaviteljPdfVnos, i: number): void {
  if (!s || typeof s !== 'object') {
    throw new TypeError(`preveriDobaviteljPdfVnos (${i}): pričakovan dobavitelj (DobaviteljPdfVnos)`)
  }
  if (typeof s.naziv !== 'string' || s.naziv.trim() === '') {
    throw new TypeError(`preveriDobaviteljPdfVnos (${i}): naziv mora biti ne-prazen niz, ne ${String(s.naziv)}`)
  }
  if (typeof s.aktivna !== 'boolean') {
    throw new TypeError(`preveriDobaviteljPdfVnos (${i}): aktivna mora biti boolean, ne ${String(s.aktivna)}`)
  }
  for (const k of ['dobavniRok', 'popust'] as const) {
    const v = s[k]
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new TypeError(
        `preveriDobaviteljPdfVnos (${i}): ${k} mora biti ne-negativno končno število, ne ${String(v)}`,
      )
    }
  }
  for (const k of ['kontakt', 'telefon', 'email'] as const) {
    const v = s[k]
    if (v !== undefined && v !== null && typeof v !== 'string') {
      throw new TypeError(`preveriDobaviteljPdfVnos (${i}): ${k} mora biti niz, null ali manjkajoč, ne ${String(v)}`)
    }
  }
}

/** Sklanjatev '1 dobavitelj / 2 dobavitelja / 3-4 dobavitelji / 5+
 *  dobaviteljev' — vzorec zalogaPovzetekBeseda (R204) / narociloPostavkaBeseda
 *  (R206). Fail-closed na ne-celih/negativnih. */
export function dobaviteljBeseda(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError(
      `dobaviteljBeseda: pričakovano ne-negativno celo število, ne ${String(n)}`,
    )
  }
  if (n === 1) return 'dobavitelj'
  if (n === 2) return 'dobavitelja'
  if (n === 3 || n === 4) return 'dobavitelji'
  return 'dobaviteljev'
}

/** Ime datoteke — `dobavitelji-YYYY-MM-DD.pdf` (ISTI dan kot todayStamp CSV
 *  izvoza R233 `Dobavitelji-…`; deterministično glede na `now`). */
export function dobaviteljiPdfFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('dobaviteljiPdfFilename: pričakovan veljaven now: Date')
  }
  return `dobavitelji-${todayStamp(now)}.pdf`
}

/** Determinističen file-ID (32 hex) iz semena — čista JS FNV-1a (CLIENT-safe;
 *  LASTNI soli 0x21–0x24: vsak PDF lib družine ima svoje — zaloga 0x01–04,
 *  naročilnica 0x11–14 — ista semena v dveh libih NE smejo dati isti ID). */
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
    fnv1aHex(seed, 0x21) +
    fnv1aHex(seed, 0x22) +
    fnv1aHex(seed, 0x23) +
    fnv1aHex(seed, 0x24)
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

/** KPI polje — ISTI vzorec kot zaloga-pdf/naročilnica/boss-report kpiBox. */
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

/** Prazna celica za manjkajoče opcijsko polje — '' (NIKOLI izmišljen 0 /
 *  '—' — CSV R233 vzorec; Excel prikaže prazno, resnica ostane resnica). */
function celica(v: string | null | undefined): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** Zgradi DOBAVITELJE DOKUMENT (brez shranjevanja) — vrne jsPDF instanco
 *  (testi berejo doc.output('arraybuffer') → bajtni dokazi). */
export function buildDobaviteljiPdfDoc(
  dobavitelji: readonly DobaviteljPdfVnos[],
  options: DobaviteljiPdfOptions,
): jsPDF {
  if (!Array.isArray(dobavitelji)) {
    throw new TypeError('buildDobaviteljiPdfDoc: pričakovano polje dobaviteljev (DobaviteljPdfVnos[])')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildDobaviteljiPdfDoc: pričakovane opcije (DobaviteljiPdfOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildDobaviteljiPdfDoc: pričakovan veljaven now: Date')
  }
  // PRAZEN SEZNAM ne nastaja dokumenta (družina: ni prazne datoteke —
  // komponenta pokaže iskren toast 'Ni dobaviteljev za izvoz.').
  if (dobavitelji.length === 0) {
    throw new TypeError(
      'buildDobaviteljiPdfDoc: prazen seznam ne nastaja dokumenta — komponenta pokaže iskren toast (Ni dobaviteljev za izvoz.)',
    )
  }
  dobavitelji.forEach((s, i) => preveriDobaviteljPdfVnos(s, i))

  // KPI se RAČUNAJO iz obveznih polj (notranja skladnost — glej glavo liba).
  const aktivnih = dobavitelji.filter((s) => s.aktivna).length
  const neaktivnih = dobavitelji.length - aktivnih

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / zaloga R234 / naročilnica R235) ----------
  doc.setCreationDate(now)
  doc.setFileId(
    deterministichenId(
      `${now.toISOString()}|${dobavitelji
        .map((s) => `${s.naziv.trim()}:${s.aktivna ? 1 : 0}/${s.dobavniRok}+${s.popust}`)
        .join(',')}`,
    ),
  )

  // ---------- glava (ISTI vzorec kot boss-report/zaloga-pdf/naročilnica) ----------
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
  doc.text('DOBAVITELJI', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })

  // ---------- KPI povzetek (izračun iz vrstic — notranja skladnost) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Povzetek dobaviteljev')
  const bw = 42
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Dobavitelji', String(dobavitelji.length), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Aktivni', String(aktivnih), aktivnih > 0 ? GREEN : NAVY)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Neaktivni', String(neaktivnih), NAVY)
  y += bh + 8

  // ---------- tabela dobaviteljev (ENA resnica = stolpci CSV R233) ----------
  y = sectionTitle(doc, y, `Dobavitelji (${dobavitelji.length})`)
  autoTable(doc, {
    startY: y,
    head: [['Naziv', 'Status', 'Kontakt', 'Telefon', 'Email', 'Dobavni rok (dni)', 'Popust (%)', 'Št. cen', 'Št. naročil']],
    body: dobavitelji.map((s) => [
      s.naziv.trim(),
      s.aktivna ? 'Aktiven' : 'Neaktiven',
      celica(s.kontakt),
      celica(s.telefon),
      celica(s.email),
      String(s.dobavniRok),
      String(s.popust),
      s._count?.materialPrices !== undefined ? String(s._count.materialPrices) : '',
      s._count?.orders !== undefined ? String(s._count.orders) : '',
    ]),
    styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 34 },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
    },
    didParseCell: (data) => {
      // WYSIWYG z R144 piko: 'Aktiven' zeleno bold, 'Neaktiven' sivo (ISTI
      // pomen kot zeleni/sivi žetoni na kartici — brez barve bi status utonil).
      if (data.section === 'body' && data.column.index === 1) {
        if (data.cell.raw === 'Aktiven') {
          data.cell.styles.textColor = GREEN
          data.cell.styles.fontStyle = 'bold'
        } else if (data.cell.raw === 'Neaktiven') {
          data.cell.styles.textColor = GRAY
        }
      }
    },
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 6

  // ---------- sklepna vrstica (ISTA sklanjatev družina + ISTI žig) ----------
  if (y > 255) {
    doc.addPage()
    y = 20
  }
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text(
    `${dobavitelji.length} ${dobaviteljBeseda(dobavitelji.length)} · aktivnih ${aktivnih} · neaktivnih ${neaktivnih}.`,
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

/** Zgeneriraj Dobavitelji PDF (determinističen — enak vhod = bajtno enak
 *  dokument) in ga shrani kot `dobavitelji-YYYY-MM-DD.pdf`. */
export function generateDobaviteljiPdf(
  dobavitelji: readonly DobaviteljPdfVnos[],
  options: DobaviteljiPdfOptions,
): void {
  const doc = buildDobaviteljiPdfDoc(dobavitelji, options)
  doc.save(dobaviteljiPdfFilename(options.now))
}
