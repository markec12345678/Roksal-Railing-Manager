// ---------------------------------------------------------------------------
// R257 (P1-f, 'izvozi' družina — 13. člen) — NAROČILA PREGLED PDF iz
// Material → Naročila (material-intelligence-tab). Vzorec prihodki-pdf R250
// / tedenski-vozni-red-pdf R256: ROKSAL glava, KPI, autoTable, noge, bajtni
// determinizem.
//
// LOČEN dokument od CSV R140/R232 (ta ostaja NESPREMENJEN — vrstica per
// postavka za Excel) in od per-naročilo naročilnice R235 (dokument ZA
// DOBAVITELJA iz postavk): naročila pregled je AGREGATNA resnica za pisarno
// — ENA vrstica per NAROČILO (datum, dobavitelj, status, obljubljena dobava,
// št. postavk, vrednost, žig preteklenga roka, opomba). DVE iskreni resnici
// vsako svoje dokumento (R255/R256 vzorec): CSV = vrstica per postavka,
// PDF = vrstica per naročilo — legenda na zaslonu pove razliko.
//
// ENA RESNICA z zaslonom (WYSIWYG — brat iz ISTEGA vira):
//  • vir podatkov = GET /api/material-orders (ISTI odgovor, ki ga orders
//    zavihek že izriše; ISTI DTO kot CSV R232) — route NIČ (client+lib
//    only — izvoz je potrošnik obstoječe resnice);
//  • status = VERBATIM iz API-ja, samo 5 znanih (kanon prisma schema
//    MaterialOrder.status: OSNUTEK | POSLANO | POTRJENO | DOBLJENO |
//    PREKlicANO) — neznan status = pokvaren vir → TypeError z indeksom
//    krivca, NIKOLI tiho (vozni red R255 vzorec);
//  • 'odprto' = ENA definicija pomena: ODPRTI_STATUSI_NAROCIL iz
//    zamujena-dobava R228 (IMPORT, nič dvojnega seznama — EN VIR);
//  • 'Pretekel rok' = ISTI lib jeZamujenaDobava R228 kot badge R229 / CSV
//    R231 / zvonček / Domov / vodja — zaprta stanja, manjkajoča/pokvarena
//    obljuba NIKOLI 'DA' (fail-closed); `danas` je IZRECEN argument
//    (determinizem: isti vhod + isti dan = isti izid; polnoč — ISTI
//    danasZamude kot badge IN CSV: ENA resnica za zaslon, CSV IN PDF);
//  • vrednost = skupajCena (številka iz API-ja — NIKOLI izmišljena);
//    PDF piše računovodsko natančno (2 decimalki, znesekNiz družina), zaslon
//    zaokroženo toFixed(0) — ISTA številka, dva prikaza vsako svoje
//    dokumento (prihodki R250 vzorec);
//  • preklicana naročila so VIDNA (iskren odpad, vozni red R255/R256 vzorec)
//    a IZKLJUČENA iz vrednostne vsote (preklic ni denarni tok — prihodki
//    'stornirani izključeni iz zneskov' vzorec) in poimenovana v sklepu;
//  • manjkajoča dobava/opomba = '—' / prazna celica (iskrena null resnica —
//    nič izmišljenega, R233/R227 strogost).
//
// Načela (družinska pravila):
//  • Fail-closed: pokvaren vnos → TypeError (dobavitelj ne-prazen niz, status
//    iz 5 znanih, ISO datumi, skupajCena končno ne-negativna, items polje
//    objektov — indeks krivca v sporočilu). PRAZEN SEZNAM ne nastaja
//    dokumenta (družina: ni prazne datoteke; komponenta pokaže iskren toast).
//  • Determinizem: `now` pride KOT parameter; doc.setCreationDate(now) +
//    doc.setFileId(FNV-1a) — enak vhod = bajtno enak PDF (document-pdf R121
//    100× pravilo). Sort INTERNI (kronološki ASC, izenačba dobavitelj ASC)
//    PRED vsotami — FP seštevanje je odvisno od vrstnega reda, rezultat je
//    f(MNOŽICA), ne f(vrstni red odgovora) (povprecniRazpon R248 vzorec).
//  • CLIENT-safe: uvozi ga material-intelligence-tab (client) — node:crypto
//    NE sme v client bundle (lekcija R234); čista JS FNV-1a; LASTNI soli
//    **0x79–0x7c** (register: zaloga 0x01–04, naročilnica 0x11–14,
//    dobavitelji 0x21–24, osnutek 0x31–34, cenik 0x41–44, primerjalni
//    0x51–54, prihodki 0x61–64, opomnik 0x65–68, potekli 0x69–6c, koledar
//    0x6d–0x70, vozni red 0x71–74, tedenski 0x75–78 → naročila pregled
//    0x79–7c — ista semena v dveh libih NE smejo dati isti ID).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { todayStamp } from './csv-export'
import { zalogaPovzetekCasOznaka } from './zaloga-povzetek'
import { cenikDatumIso } from './cenik-pdf'
import {
  jeZamujenaDobava,
  ODPRTI_STATUSI_NAROCIL,
} from './zamujena-dobava'

// ---------- barve (ISTI dokumenti družina — usklajeno s prihodki/tedenski) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const GREEN: [number, number, number] = [22, 163, 74] // roksal-green (DOBLJENO značka)
const RED: [number, number, number] = [220, 38, 38] // zaloga-pdf R120 red (PREKlicANO značka / pretekel rok)
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

/** 5 znanih statusov naročila — dobesedni kanon prisma schema MaterialOrder
 *  (linija 'OSNUTEK | POSLANO | POTRJENO | DOBLJENO | PREKlicANO'). ENA
 *  množica; 'odprto' pomeni IZ ODPRTI_STATUSI_NAROCIL (EN VIR zamejena
 *  importom — nič dvojnega seznama). */
const STATUSI_NAROCIL = ['OSNUTEK', 'POSLANO', 'POTRJENO', 'DOBLJENO', 'PREKlicANO'] as const

export type StatusNarocila = (typeof STATUSI_NAROCIL)[number]

/** Client-safe prerez ENE naročilne vrstice (podmnožica MaterialOrder iz
 *  GET /api/material-orders — ISTI odgovor, ki ga orders zavihek izriše).
 *  ENA vrstica = EN naročilo. items pregled samo ŠTEJE (dubino postavk
 *  validira naročilnica R235 — per-order dokument; tu je postavk resnica
 *  števec). */
export interface NarociloPregledVnos {
  /** VERBATIM status iz API-ja (5 znanih — neznan = pokvaren vir). */
  status: string
  /** Skupaj vrednost naročila (EUR; končno ne-negativna). */
  skupajCena: number
  /** ISO niz (YYYY-MM-DD…) — datum naročila. */
  datumNarocila: string
  /** ISO niz ALI null — obljubljeni datum dobave (null = iskrena '—'). */
  datumDobave: string | null
  /** Opomba ALI null/undefined — prazna celica (nič izmišljenega). */
  opombe?: string | null
  /** Dobavitelj (ne-prazen naziv). */
  supplier: { naziv: string }
  /** Postavke (pregled jih samo šteje — polje objektov; dubino čuva
   *  naročilnica R235). */
  items: readonly unknown[]
}

export interface NarocilaPregledPdfOptions {
  /** Referenčni trenutek (žig + CreationDate + fileId + ime) — KOT
   *  PARAMETER (determinizem; vzorec R203/R244/R250). */
  now: Date
  /** Začetek trenutnega dneva (polnoč) za žig preteklenga roka — IZRECEN
   *  argument (jeZamujenaDobava pogodba; ISTI danasZamude kot badge IN CSV
   *  — ENA resnica za zaslon, CSV IN PDF). */
  danas: Date
}

/** Fail-closed preverba naročilne vrstice (obvezna polja + status iz 5
 *  znanih; indeks krivca je VEDNO v sporočilu — družina R236/R250). */
export function preveriNarociloPregledVnos(n: NarociloPregledVnos, i: number): void {
  if (!n || typeof n !== 'object') {
    throw new TypeError(`preveriNarociloPregledVnos (${i}): pričakovano naročilo (NarociloPregledVnos)`)
  }
  if (typeof n.status !== 'string' || !(STATUSI_NAROCIL as readonly string[]).includes(n.status)) {
    throw new TypeError(
      `preveriNarociloPregledVnos (${i}): status mora biti eden iz ${STATUSI_NAROCIL.join('/')}, ne ${String(n.status)}`,
    )
  }
  if (!n.supplier || typeof n.supplier !== 'object' || typeof n.supplier.naziv !== 'string' || n.supplier.naziv.trim() === '') {
    throw new TypeError(`preveriNarociloPregledVnos (${i}): supplier.naziv mora biti ne-prazen niz, ne ${String(n.supplier?.naziv)}`)
  }
  if (typeof n.datumNarocila !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(n.datumNarocila)) {
    throw new TypeError(`preveriNarociloPregledVnos (${i}): datumNarocila mora biti ISO niz YYYY-MM-DD…, ne ${String(n.datumNarocila)}`)
  }
  if (n.datumDobave !== null && (typeof n.datumDobave !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(n.datumDobave))) {
    throw new TypeError(`preveriNarociloPregledVnos (${i}): datumDobave mora biti ISO niz YYYY-MM-DD… ali null, ne ${String(n.datumDobave)}`)
  }
  if (typeof n.skupajCena !== 'number' || !Number.isFinite(n.skupajCena) || n.skupajCena < 0) {
    throw new TypeError(`preveriNarociloPregledVnos (${i}): skupajCena mora biti končno ne-negativno število, ne ${String(n.skupajCena)}`)
  }
  if (n.opombe !== undefined && n.opombe !== null && typeof n.opombe !== 'string') {
    throw new TypeError(`preveriNarociloPregledVnos (${i}): opombe mora biti niz, null ali manjkajoč, ne ${String(n.opombe)}`)
  }
  if (!Array.isArray(n.items)) {
    throw new TypeError(`preveriNarociloPregledVnos (${i}): items mora biti polje, ne ${String(n.items)}`)
  }
  for (let j = 0; j < n.items.length; j++) {
    const it = n.items[j]
    if (it === null || typeof it !== 'object') {
      throw new TypeError(`preveriNarociloPregledVnos (${i}): items[${j}] mora biti objekt (pregled šteje postavke), ne ${String(it)}`)
    }
  }
}

/** Znesek kot stabilen niz — točkovna dela na 2 decimalni mesti (ISTI vzorec
 *  kot cenaNiz cenik-pdf R244 / znesekNiz prihodki R250 — računovodsko
 *  berljivo; zaslon zaokrožuje toFixed(0), dokument je natančen). */
function znesekNiz(z: number): string {
  return z.toFixed(2)
}

/** Determinističen file-ID (32 hex) iz semena — čista JS FNV-1a (CLIENT-safe;
 *  LASTNI soli 0x79–0x7c: vsak PDF lib družine ima svoje — ista semena v
 *  dveh libih NE smejo dati isti ID). */
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
    fnv1aHex(seed, 0x79) +
    fnv1aHex(seed, 0x7a) +
    fnv1aHex(seed, 0x7b) +
    fnv1aHex(seed, 0x7c)
  )
}

/** Sort vrstic V LIBU — DATUM NAROČILA ASC (kronološki red nabave), izenačba
 *  dobavitelj ASC (navadno < primerjanje po UTF-16 kodnih točkah — brez
 *  locale-odvisnega primerjanja, R245/R250 vzorec). IZVOŽEN —
 *  determinizem = f(MNOŽICA vhodov), ne f(vrstni red odgovora). */
export function sortirajNarocilaPregled(vnosi: readonly NarociloPregledVnos[]): NarociloPregledVnos[] {
  return [...vnosi].sort((a, b) => {
    const ta = new Date(a.datumNarocila).getTime()
    const tb = new Date(b.datumNarocila).getTime()
    if (ta !== tb) return ta < tb ? -1 : 1
    const na = a.supplier.naziv.trim()
    const nb = b.supplier.naziv.trim()
    if (na !== nb) return na < nb ? -1 : 1
    return 0
  })
}

export interface NarocilaPregledPovzetek {
  /** Št. vseh vrstic (= sortirane.length). */
  vseh: number
  /** Št. odprtih (OSNUTEK + POSLANO + POTRJENO — EN VIR ODPRTI_STATUSI_NAROCIL). */
  odprtih: number
  /** Št. DOBLJENO. */
  dobavljenih: number
  /** Št. PREKlicANO (iskrena resnica — viden odpad, izključen iz vsote). */
  preklicanih: number
  /** Št. odprtih s pretekljeno obljubo (jeZamujenaDobava — EN VIR z badge/CSV). */
  zamujenih: number
  /** Σ skupajCena NE-preklicanih (preklic ni denarni tok — izključen, poimenovan). */
  vrednostNePreklicanih: number
  /** Σ postavk čez vsa naročila (realni agregat — sklepan podpis). */
  postavkSkupaj: number
}

/** Agregatna izpeljava naročil — ENA resnica za PDF KPI, sklep IN toast
 *  (WYSIWYG; ISTI vzorec kot prihodkiPovzetek R250). Sortira interno
 *  (sortirajNarocilaPregled) pred seštevanjem — FP seštevanje je odvisno od
 *  vrstnega reda; rezultat je f(MNOŽICA), ne f(vrstni red odgovora). */
export function narocilaPregledPovzetek(
  vnosi: readonly NarociloPregledVnos[],
  danas: Date,
): NarocilaPregledPovzetek {
  if (!Array.isArray(vnosi)) {
    throw new TypeError('narocilaPregledPovzetek: pričakovano polje naročil (NarociloPregledVnos[])')
  }
  if (!(danas instanceof Date) || Number.isNaN(danas.getTime())) {
    throw new TypeError('narocilaPregledPovzetek: pričakovan veljaven danas: Date')
  }
  const sortirane = sortirajNarocilaPregled(vnosi)
  const povzetek: NarocilaPregledPovzetek = {
    vseh: sortirane.length,
    odprtih: 0,
    dobavljenih: 0,
    preklicanih: 0,
    zamujenih: 0,
    vrednostNePreklicanih: 0,
    postavkSkupaj: 0,
  }
  for (const n of sortirane) {
    // 'Odprto' = ENA definicija pomena — IZ ODPRTI_STATUSI_NAROCIL (EN VIR
    // z vodjinim pregledom in badge; nič dvojnega seznama).
    if ((ODPRTI_STATUSI_NAROCIL as readonly string[]).includes(n.status)) {
      povzetek.odprtih += 1
      if (jeZamujenaDobava(n, danas)) povzetek.zamujenih += 1
    }
    if (n.status === 'DOBLJENO') povzetek.dobavljenih += 1
    if (n.status === 'PREKlicANO') {
      povzetek.preklicanih += 1
    } else {
      // Preklic ni denarni tok — izključen iz vsote (poimenovan v KPI/sklepu).
      povzetek.vrednostNePreklicanih += n.skupajCena
    }
    povzetek.postavkSkupaj += n.items.length
  }
  return povzetek
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

/** KPI polje — ISTI vzorec kot prihodki/tedenski (družinski kpiBox). */
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

/** Zgradi NAROČILA PREGLED dokument (brez shranjevanja) — vrne jsPDF instanco
 *  (testi berejo doc.output('arraybuffer') → bajtni dokazi). */
export function buildNarocilaPregledPdfDoc(
  vnosi: readonly NarociloPregledVnos[],
  options: NarocilaPregledPdfOptions,
): jsPDF {
  if (!Array.isArray(vnosi)) {
    throw new TypeError('buildNarocilaPregledPdfDoc: pričakovano polje naročil (NarociloPregledVnos[])')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildNarocilaPregledPdfDoc: pričakovane opcije (NarocilaPregledPdfOptions)')
  }
  const { now, danas } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildNarocilaPregledPdfDoc: pričakovan veljaven now: Date')
  }
  if (!(danas instanceof Date) || Number.isNaN(danas.getTime())) {
    throw new TypeError('buildNarocilaPregledPdfDoc: pričakovan veljaven danas: Date')
  }
  // PRAZEN SEZNAM ne nastaja dokumenta (družina: ni prazne datoteke —
  // komponenta pokaže iskren toast 'Ni naročil za izvoz.').
  if (vnosi.length === 0) {
    throw new TypeError(
      'buildNarocilaPregledPdfDoc: prazen seznam ne nastaja dokumenta — komponenta pokaže iskren toast (Ni naročil za izvoz.)',
    )
  }
  vnosi.forEach((n, i) => preveriNarociloPregledVnos(n, i))
  const sortirane = sortirajNarocilaPregled(vnosi)
  const pov = narocilaPregledPovzetek(sortirane, danas)

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / prihodki R250) ----------
  doc.setCreationDate(now)
  doc.setFileId(
    deterministichenId(
      `${now.toISOString()}|${sortirane
        .map(
          (n) =>
            `${n.datumNarocila}/${n.supplier.naziv.trim()}/${n.status}/${znesekNiz(n.skupajCena)}${n.datumDobave ? `/D${n.datumDobave}` : ''}`,
        )
        .join(',')}`,
    ),
  )

  // ---------- glava (ISTI vzorec kot prihodki/tedenski) ----------
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
  doc.text('NAROČILA — PREGLED', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })

  // ---------- KPI povzetek (izračun iz vrstic — notranja skladnost) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Povzetek naročil')
  // 5 polj → 33 mm boxi v ISTI vrsti (5×33 + 4×4 = 181 ≤ 182) — ISTI layout
  // kot prihodki R250. Signal barve = ISTI jezik kot značke na zaslonu
  // (odprto amber, dobavljeno zeleno, pretekel rok rdeče, preklicano sivo).
  const bw = 33
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Naročil', String(pov.vseh), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Odprtih', String(pov.odprtih), pov.odprtih > 0 ? AMBER : NAVY)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Dobavljenih', String(pov.dobavljenih), pov.dobavljenih > 0 ? GREEN : NAVY)
  kpiBox(doc, 14 + 3 * (bw + gap), y, bw, bh, 'Pretekel rok', String(pov.zamujenih), pov.zamujenih > 0 ? RED : NAVY)
  kpiBox(doc, 14 + 4 * (bw + gap), y, bw, bh, 'Preklicanih', String(pov.preklicanih), GRAY)
  y += bh + 8

  // ---------- tabela naročil (KRONOLOŠKI ASC — nabavni red) ----------
  y = sectionTitle(doc, y, `Naročila (${sortirane.length})`)
  autoTable(doc, {
    startY: y,
    head: [['Datum', 'Dobavitelj', 'Status', 'Dobava', 'Postavk', 'Vrednost (EUR)', 'Pretekel rok', 'Opombe']],
    body: sortirane.map((n) => [
      cenikDatumIso(n.datumNarocila),
      n.supplier.naziv.trim(),
      n.status,
      n.datumDobave ? cenikDatumIso(n.datumDobave) : '—',
      String(n.items.length),
      znesekNiz(n.skupajCena),
      jeZamujenaDobava(n, danas) ? 'DA' : 'NE',
      typeof n.opombe === 'string' ? n.opombe.trim() : '',
    ]),
    styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 20, halign: 'right' },
      3: { cellWidth: 20, halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'center' },
    },
    didParseCell: (data) => {
      // WYSIWYG z zaslonom: DOBLJENO zeleno bold, PREKlicANO rdeče bold (ISTI
      // pomen kot znački R207 — viden odpad, NIKOLI tiho izpuščen); vrednost
      // preklicanega sivo (izključen iz vsote — prihodki 'storniran' vzorec);
      // 'DA' pretekel rok rdeče bold (ISTI alarm kot BadgeZamujenaDobava);
      // manjkajoča dobava '—' sivo (iskrena null resnica).
      if (data.section === 'body' && data.column.index === 2) {
        const s = String(data.cell.raw ?? '')
        if (s === 'DOBLJENO') {
          data.cell.styles.textColor = GREEN
          data.cell.styles.fontStyle = 'bold'
        } else if (s === 'PREKlicANO') {
          data.cell.styles.textColor = RED
          data.cell.styles.fontStyle = 'bold'
        }
      }
      if (data.section === 'body' && data.column.index === 3 && data.cell.raw === '—') {
        data.cell.styles.textColor = GRAY
      }
      if (data.section === 'body' && data.column.index === 5) {
        const status = String(data.row.raw?.[2] ?? '')
        if (status === 'PREKlicANO') {
          data.cell.styles.textColor = GRAY
        }
      }
      if (data.section === 'body' && data.column.index === 6) {
        if (data.cell.raw === 'DA') {
          data.cell.styles.textColor = RED
          data.cell.styles.fontStyle = 'bold'
        }
      }
    },
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 6

  // ---------- sklepna vrstica (iskren podpis — vsote poimenovane) ----------
  if (y > 255) {
    doc.addPage()
    y = 20
  }
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text(
    `${pov.vseh} naročil · odprtih ${pov.odprtih} · dobavljenih ${pov.dobavljenih} · preklicanih ${pov.preklicanih} (izključeni iz vsote) · vrednost ne-preklicanih ${znesekNiz(pov.vrednostNePreklicanih)} EUR · pretekel rok ${pov.zamujenih} · skupaj ${pov.postavkSkupaj} postavk.`,
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

/** Ime datoteke — `Narocila-YYYY-MM-DD.pdf` (sorojenec CSV izvoza R140
 *  `Narocila-…csv`; deterministično glede na `now`; EN now za žig IN ime —
 *  lekcija R121/R235). */
export function narocilaPregledPdfFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('narocilaPregledPdfFilename: pričakovan veljaven now: Date')
  }
  return `Narocila-${todayStamp(now)}.pdf`
}

/** Zgeneriraj Naročila pregled PDF (determinističen — enak vhod = bajtno enak
 *  dokument) in ga shrani kot `Narocila-YYYY-MM-DD.pdf`. */
export function generateNarocilaPregledPdf(
  vnosi: readonly NarociloPregledVnos[],
  options: NarocilaPregledPdfOptions,
): void {
  const doc = buildNarocilaPregledPdfDoc(vnosi, options)
  doc.save(narocilaPregledPdfFilename(options.now))
}
