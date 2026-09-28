// ---------------------------------------------------------------------------
// R234 (P1-c 'izvozi' družina — PDF dimenzija) — Stanje zaloge PDF izvoz iz
// Material → Zaloga. 'izvozi' družina ima po R233 CSV povsod po Materialu
// (vodja R228, Zaloga R136/R226, Naročila R140/R231/R232, Dobavitelji R233) —
// PDF je NASLEDNJA dimenzija (vzorec boss-report-pdf: ROKSAL glava, KPI
// škatle, autoTable, noge na vseh straneh).
//
// ENA RESNICA z zaslonom in CSV (WYSIWYG):
//  • stolpci tabele = TOČNO ISTI prerez kot CSV R136/R226 (Šifra, Naziv, Tip,
//    Enota, Zaloga, Min. zaloga, Nizka, Brez dobavitelja);
//  • 'Nizka' = kolicinaZaloga <= minimalnaZaloga (ISTA formula kot CSV R136
//    in čip 'pod' R219);
//  • 'Brez dobavitelja' = _count?.prices === 0 DOBESLEDNO (ISTA strogost kot
//    CSV stolpec R226 / čip R221 / žig R227 — manjkajoči števec NIKOLI ni
//    'DA', brez ?? 0 / <= 0; fail-closed konservativno);
//  • KPI škatle se RAČUNAJO iz posredovanih vrstic (vidni/pod/na/brez) —
//    dokument je vedno notranje skladen z tabelo (komponenta NE more
//    posredovati razhajajočih števcev).
//
// Načela (družinska pravila):
//  • Fail-closed: pokvaren vnos → TypeError (količine so FIZIČNE vrednosti,
//    ne-prazni naziv/šifra/enota/tip; neveljaven čip → TypeError). PRAZEN
//    SEZNAM ne nastaja dokumenta (TypeError — R232/R233 družina: ni prazne
//    datoteke; komponenta pokaže iskren toast 'Ni artiklov za izvoz.').
//  • Determinizem: `now` pride KOT parameter (vzorec R203/R204/R167); PDF je
//    bajtno determinističen — doc.setCreationDate(now) + doc.setFileId(dID)
//    (vzorec document-pdf R121: enak vhod = bajtno enak dokument). RAZLIKA:
//    ta lib je CLIENT (uvozi ga inventory-tab) — node:crypto NE pride v
//    poštev (document-pdf je strežniški); ID = čista JS FNV-1a (deterministično
//    per vhod, nič Math.random — jsPDF privzeti ID je naključen!).
//  • Brez izmišljenih podatkov: dokument NE IZMIŠLJA cen (cenaEur je pogosto
//    null, ocenjene vrednosti NE gredo v dokumente — R204 pravilo); filtrski
//    kontekst se navede LE, če je dejansko aktiven ('Vse' → brez omembe —
//    R227 pravilo brez izmišljenega konteksta).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { todayStamp } from './csv-export'
import { zalogaPovzetekBeseda, zalogaPovzetekCasOznaka } from './zaloga-povzetek'

// ---------- barve (USKLAJENO z boss-report-pdf — ISTI dokumenti družina) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const RED: [number, number, number] = [220, 38, 38]
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

/** Client-safe prerez artikla inventarja za PDF (ISTI prerez kot CSV
 *  R136/R226 v inventory-tab — _count opcijsko, ISTA strogost). */
export interface ZalogaPdfArtikel {
  sifraMateriala: string
  naziv: string
  tip: string
  enota: string
  kolicinaZaloga: number
  minimalnaZaloga: number
  _count?: { prices?: number }
}

export interface ZalogaPdfOptions {
  /** Referenčni trenutek (žig + CreationDate + fileId) — KOT PARAMETER
   *  (determinizem, vzorec zaloga-povzetek R204 / meritve-csv R203). */
  now: Date
  /** Opcijska oznaka filtra tipa (npr. 'WPC') — LE če dejansko aktiven;
   *  'Vse'/null/undefined → brez omembe (R227: brez izmišljenega konteksta). */
  kategorija?: string | null
  /** Opcijska oznaka aktivnega čipa (R219/R220/R221) — LE če dejansko
   *  aktiven; neznana vrednost → TypeError (fail-closed). */
  cip?: 'pod' | 'na' | 'brez' | null
}

const CIP_LABEL: Record<'pod' | 'na' | 'brez', string> = {
  pod: 'pod minimumom',
  na: 'na minimumu',
  brez: 'brez dobavitelja',
}

/** Fail-closed preverba artikla (količine fizične vrednosti; NAROČILNIČNA
 *  omejitev 'nad minimumom' tu NE velja — PDF pokriva VSE vidne artikle,
 *  ISTO množico kot CSV R136). */
export function preveriZalogaPdfArtikel(a: ZalogaPdfArtikel, i: number): void {
  if (!a || typeof a !== 'object') {
    throw new TypeError(`preveriZalogaPdfArtikel (${i}): pričakovan artikel (ZalogaPdfArtikel)`)
  }
  for (const k of ['sifraMateriala', 'naziv', 'tip', 'enota'] as const) {
    const v = a[k]
    if (typeof v !== 'string' || v.trim() === '') {
      throw new TypeError(`preveriZalogaPdfArtikel (${i}): ${k} mora biti ne-prazen niz, ne ${String(v)}`)
    }
  }
  for (const k of ['kolicinaZaloga', 'minimalnaZaloga'] as const) {
    const v = a[k]
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new TypeError(
        `preveriZalogaPdfArtikel (${i}): ${k} mora biti ne-negativno končno število, ne ${String(v)}`,
      )
    }
  }
}

/** Ime datoteke — `zaloga-YYYY-MM-DD.pdf` (ISTI dan kot todayStamp CSV izvoza;
 *  deterministično glede na `now`). */
export function zalogaPdfFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('zalogaPdfFilename: pričakovan veljaven now: Date')
  }
  return `zaloga-${todayStamp(now)}.pdf`
}

/** Determinističen file-ID (32 hex) iz semena — čista JS FNV-1a (CLIENT-safe;
 *  node:crypto NE sme v client bundle). Enako seme = enak ID = bajtno enak
 *  PDF; pokvarjen/naključen ID bi razbil 100× pravilo (document-pdf R121). */
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
    fnv1aHex(seed, 0x01) +
    fnv1aHex(seed, 0x02) +
    fnv1aHex(seed, 0x03) +
    fnv1aHex(seed, 0x04)
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

/** KPI polje — ISTI vzorec kot boss-report kpiBox (svetlo ozadje, label +
 *  velika vrednost; alarmna vrednost rdeča, nevtralna navy). */
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

/** Zgradi DOKUMENT (brez shranjevanja) — vrne jsPDF instanco (testi berejo
 *  doc.output('arraybuffer') → bajtni dokazi). */
export function buildZalogaPdfDoc(
  artikli: readonly ZalogaPdfArtikel[],
  options: ZalogaPdfOptions,
): jsPDF {
  if (!Array.isArray(artikli)) {
    throw new TypeError('buildZalogaPdfDoc: pričakovano polje artiklov (ZalogaPdfArtikel[])')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildZalogaPdfDoc: pričakovane opcije (ZalogaPdfOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildZalogaPdfDoc: pričakovan veljaven now: Date')
  }
  // Fail-closed čip: neznana vrednost → TypeError (dokument ne laže o kontekstu).
  const cip =
    options.cip === undefined || options.cip === null
      ? null
      : (CIP_LABEL[options.cip] ? (options.cip as 'pod' | 'na' | 'brez') : undefined)
  if (cip === undefined) {
    throw new TypeError(
      `buildZalogaPdfDoc: neznan čip ${String(options.cip)} — dovoljeno: 'pod' | 'na' | 'brez' | null`,
    )
  }
  // PRAZEN SEZNAM ne nastaja dokumenta (R232/R233 družina: ni prazne
  // datoteke — komponenta pokaže iskren toast, gumb ne skriva praznega stanja).
  if (artikli.length === 0) {
    throw new TypeError(
      'buildZalogaPdfDoc: prazen seznam ne nastaja dokumenta — komponenta pokaže iskren toast (Ni artiklov za izvoz.)',
    )
  }
  artikli.forEach((a, i) => preveriZalogaPdfArtikel(a, i))

  // KPI se RAČUNAJO iz vrstic (dokument vedno notranje skladen s tabelo).
  const podMin = artikli.filter((a) => a.kolicinaZaloga <= a.minimalnaZaloga).length
  const naMin = artikli.filter((a) => a.kolicinaZaloga === a.minimalnaZaloga).length
  // R226 strogost: DOBESLEDNO === 0 — manjkajoči števec NIKOLI 'brez'.
  const brez = artikli.filter((a) => a._count?.prices === 0).length

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121; ID = FNV-1a, client-safe) ----------
  doc.setCreationDate(now)
  doc.setFileId(
    deterministichenId(
      `${now.toISOString()}|${artikli.map((a) => `${a.sifraMateriala}:${a.kolicinaZaloga}/${a.minimalnaZaloga}`).join(',')}`,
    ),
  )

  // ---------- glava (ISTI vzorec kot boss-report) ----------
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
  doc.text('STANJE ZALOGE', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })

  // ---------- podnaslov konteksta (LE dejansko aktiven filter) ----------
  const kategorija =
    typeof options.kategorija === 'string' && options.kategorija.trim() !== ''
      ? options.kategorija.trim()
      : null
  const kontekstDel: string[] = []
  if (kategorija) kontekstDel.push(`filter: ${kategorija}`)
  if (cip) kontekstDel.push(`prikaz: ${CIP_LABEL[cip]}`)
  let y = 33
  if (kontekstDel.length > 0) {
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...GRAY)
    doc.text(kontekstDel.join(' · '), 14, y)
    y += 6
  }

  // ---------- KPI povzetek (izračun iz vrstic — notranja skladnost) ----------
  y = sectionTitle(doc, y, 'Povzetek vidnih artiklov')
  const bw = 42
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Vidni artikli', String(artikli.length), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Pod minimumom', String(podMin), podMin > 0 ? RED : NAVY)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Na minimumu', String(naMin), NAVY)
  kpiBox(doc, 14 + 3 * (bw + gap), y, bw, bh, 'Brez dobavitelja', String(brez), brez > 0 ? RED : NAVY)
  y += bh + 8

  // ---------- tabela artiklov (ENA resnica = stolpci CSV R136/R226) ----------
  y = sectionTitle(doc, y, `Artikli (${artikli.length})`)
  autoTable(doc, {
    startY: y,
    head: [['Šifra', 'Naziv', 'Tip', 'Enota', 'Zaloga', 'Min.', 'Nizka', 'Brez dobavitelja']],
    body: artikli.map((a) => [
      a.sifraMateriala.trim(),
      a.naziv.trim(),
      a.tip.trim(),
      a.enota.trim(),
      String(a.kolicinaZaloga),
      String(a.minimalnaZaloga),
      // ISTA formula kot CSV R136 / čip 'pod' R219.
      a.kolicinaZaloga <= a.minimalnaZaloga ? 'DA' : 'NE',
      // ISTA strogost kot CSV R226 / čip R221 / žig R227 — DOBESLEDNO === 0.
      a._count?.prices === 0 ? 'DA' : 'NE',
    ]),
    styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
    columnStyles: {
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'center' },
      7: { halign: 'center' },
    },
    didParseCell: (data) => {
      // Alarmna družina: 'DA' v alarmnih stolpcih rdeče (ISTA družina kot
      // roksal-red chipi na zaslonu — brez barve bi žig utonil).
      if (data.section === 'body' && (data.column.index === 6 || data.column.index === 7)) {
        if (data.cell.raw === 'DA') {
          data.cell.styles.textColor = RED
          data.cell.styles.fontStyle = 'bold'
        }
      }
    },
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 6

  // ---------- sklepna vrstica ----------
  if (y > 255) {
    doc.addPage()
    y = 20
  }
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text(
    `${artikli.length} ${zalogaPovzetekBeseda(artikli.length)} · pod minimumom ${podMin} · na minimumu ${naMin} · brez dobavitelja ${brez}.`,
    14,
    y + 4,
  )

  // ---------- noge na vseh straneh (ISTI vzorec kot boss-report) ----------
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

/** Zgeneriraj Stanje zaloge PDF (determinističen — enak vhod = bajtno enak
 *  dokument) in ga shrani kot `zaloga-YYYY-MM-DD.pdf`. */
export function generateZalogaPdf(
  artikli: readonly ZalogaPdfArtikel[],
  options: ZalogaPdfOptions,
): void {
  const doc = buildZalogaPdfDoc(artikli, options)
  doc.save(zalogaPdfFilename(options.now))
}
