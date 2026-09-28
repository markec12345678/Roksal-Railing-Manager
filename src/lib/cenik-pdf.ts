// ---------------------------------------------------------------------------
// R244 (P1 'izvozi' družina — 5. člen) — CENIK MATERIALA PDF iz Material →
// Dobavitelji → 'Cene materiala'. CSV obstaja sočasno (R244, ISTA runda);
// ta lib je njegov PRAVI PDF brat (vzorec zaloga-pdf R234 / naročilnica-pdf
// R235 / dobavitelji-pdf R236: ROKSAL glava, KPI, autoTable, noge, bajtni
// determinizem).
//
// ENA RESNICA z zaslonom in CSV (WYSIWYG — brat iz ISTEGA vira):
//  • vir podatkov = GET /api/material-prices (brez filtrov) — SAMO trenutno
//    veljavne cene (route filtrira veljavnostDo: null; to je ISTA resnica,
//    ki jo API izpostavi kot 'trenutno veljavno' — v dokumentu je iskren
//    podpis 'samo veljavne cene');
//  • stolpci tabele = TOČNO ISTI prerez kot CSV R244 (Artikel, Šifra, Enota,
//    Dobavitelj, Cena (EUR/enota), Opomba, Vpisan);
//  • manjkajoča opomba = PRAZNA celica — NIKOLI izmišljen '—' (fail-closed,
//    CSV R233/R227 vzorec);
//  • vrstice so sortirane V LIBU (artikel asc → cena asc → dobavitelj asc):
//    bajtni determinizem je odvisen od MNOŽICE vhodov, ne od vrstnega reda
//    odgovora (API sortira po createdAt desc — nov vnos bi prestavil vrstice
//    in prelomil determinizmo istega nabora podatkov);
//  • KPI se RAČUNAJO iz obveznih polj vrstic (cene, artikli, razpon) —
//    notranje skladni; NIKOLI ne mešamo števca artiklov brez cen (ta resnica
//    živi na zaslonu kot R227 žig — cenik dokumentira, KAJ IMA ceno).
//
// Načela (družinska pravila — ISTA kot dobavitelji-pdf R236):
//  • Fail-closed: pokvaren vnos → TypeError (artikel/šifra/enota/dobavitelj
//    ne-prazni nizi, cena končno ne-negativna števila, vpisan ISO-datumski
//    niz — indeks krivca v sporočilu). PRAZEN SEZNAM ne nastaja dokumenta
//    (R232–R236 družina: ni prazne datoteke; komponenta pokaže iskren toast).
//  • Determinizem: `now` pride KOT parameter; doc.setCreationDate(now) +
//    doc.setFileId(FNV-1a) — enak vhod = bajtno enak PDF (document-pdf R121
//    100× pravilo; zaloga/naročilnica/dobavitelji/osnutek/cenik = ISTA
//    družina).
//  • CLIENT-safe: uvozi ga material-intelligence-tab (client) — node:crypto
//    NE sme v client bundle (lekcija R234); FNV-1a = čista JS (zasebna kopija
//    dobavitelji-pdf vzorca — dokumentirana duplikacija različnih runtimes,
//    LASTNI soli 0x41–0x44 — ID drv po libu, ne kolizija med brati:
//    zaloga 0x01–04, naročilnica 0x11–14, dobavitelji 0x21–24, osnutek
//    0x31–34, cenik 0x41–44).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { todayStamp } from './csv-export'
import { zalogaPovzetekCasOznaka } from './zaloga-povzetek'

// ---------- barve (USKLAJENO z boss-report/zaloga/naročilnica/dobavitelji — ISTI dokumenti družina) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const GREEN: [number, number, number] = [22, 163, 74] // roksal-green
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

/** Client-safe prerez ene cenovne vrstice za PDF (ISTI prerez kot CSV R244 v
 *  material-intelligence-tab — vrednosti pridejo iz GET /api/material-prices
 *  (include inventory + supplier); opomba opcijsko = prazna celica). */
export interface CenikPdfVnos {
  artikel: string
  sifra: string
  enota: string
  dobavitelj: string
  cena: number
  opomba?: string | null
  /** Datum vnosa kot `YYYY-MM-DD…` niz (ISO iz JSON odgovora) — izrisan
   *  `DD.MM.YYYY` (čista prevrastava niza, brez časovnih con — determinizem). */
  vpisan: string
}

export interface CenikPdfOptions {
  /** Referenčni trenutek (žig + CreationDate + fileId + ime) — KOT PARAMETER
   *  (determinizem, vzorec R203/R204/R167). */
  now: Date
}

/** ISO-datumski niz (`YYYY-MM-DD…`) → `DD.MM.YYYY` (čisto premikanje znakov,
 *  brez Date razčlenjevanja — determinizem ne VISI na časovni coni). */
export function cenikDatumIso(niz: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(niz)
  if (!m) {
    throw new TypeError(`cenikDatumIso: pričakovan ISO niz YYYY-MM-DD…, ne ${String(niz)}`)
  }
  return `${m[3]}.${m[2]}.${m[1]}`
}

/** Fail-closed preverba cenovne vrstice (obvezna polja = ISTA kot CSV R244
 *  vrstica; opcijska opomba = string|null|undefined — manjkajoča = prazna
 *  celica). Indeks krivca je VEDNO v sporočilu (družina R236). */
export function preveriCenikPdfVnos(p: CenikPdfVnos, i: number): void {
  if (!p || typeof p !== 'object') {
    throw new TypeError(`preveriCenikPdfVnos (${i}): pričakovana cenovna vrstica (CenikPdfVnos)`)
  }
  for (const [k, v] of [
    ['artikel', p.artikel],
    ['sifra', p.sifra],
    ['enota', p.enota],
    ['dobavitelj', p.dobavitelj],
  ] as const) {
    if (typeof v !== 'string' || v.trim() === '') {
      throw new TypeError(`preveriCenikPdfVnos (${i}): ${k} mora biti ne-prazen niz, ne ${String(v)}`)
    }
  }
  if (typeof p.cena !== 'number' || !Number.isFinite(p.cena) || p.cena < 0) {
    throw new TypeError(`preveriCenikPdfVnos (${i}): cena mora biti končno ne-negativno število, ne ${String(p.cena)}`)
  }
  if (p.opomba !== undefined && p.opomba !== null && typeof p.opomba !== 'string') {
    throw new TypeError(`preveriCenikPdfVnos (${i}): opomba mora biti niz ali null, ne ${typeof p.opomba}`)
  }
  if (typeof p.vpisan !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(p.vpisan)) {
    throw new TypeError(`preveriCenikPdfVnos (${i}): vpisan mora biti ISO niz YYYY-MM-DD…, ne ${String(p.vpisan)}`)
  }
}

/** Sklanjatev 'artikel' za sklepno vrstico (ISTI vzorec kot dobaviteljBeseda
 *  R236 — slovenska sklanjatev: 1 artikel, 2 artikla, 3/4 artikli, 5+ artiklov). */
export function artikelBeseda(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError(
      `artikelBeseda: pričakovano ne-negativno celo število, ne ${String(n)}`,
    )
  }
  if (n === 1) return 'artikel'
  if (n === 2) return 'artikla'
  if (n === 3 || n === 4) return 'artikli'
  return 'artiklov'
}

/** Sklanjatev 'cena' (1 cena, 2 ceni, 3/4 cene, 5+ cen). */
export function cenaBeseda(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError(
      `cenaBeseda: pričakovano ne-negativno celo število, ne ${String(n)}`,
    )
  }
  if (n === 1) return 'cena'
  if (n === 2) return 'ceni'
  if (n === 3 || n === 4) return 'cene'
  return 'cen'
}

/** Determinističen file-ID (32 hex) iz semena — čista JS FNV-1a (CLIENT-safe;
 *  LASTNI soli 0x41–0x44: vsak PDF lib družine ima svoje — zaloga 0x01–04,
 *  naročilnica 0x11–14, dobavitelji 0x21–24, osnutek 0x31–34 — ista semena v
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
    fnv1aHex(seed, 0x41) +
    fnv1aHex(seed, 0x42) +
    fnv1aHex(seed, 0x43) +
    fnv1aHex(seed, 0x44)
  )
}

/** Sort vrstic V LIBU — skupni red (artikel asc → cena asc → dobavitelj asc
 *  → opomba asc): bajtni determinizem = f(MNOŽICA vhodov), ne f(vrstni red
 *  odgovora). localeCompare NE uporabljamo (locale odvisen — navadno <
 *  primerjanje po UTF-16 kodnih točkah je povsod isto). */
function sortirajCenik(vnosi: readonly CenikPdfVnos[]): CenikPdfVnos[] {
  return [...vnosi].sort((a, b) => {
    if (a.artikel !== b.artikel) return a.artikel < b.artikel ? -1 : 1
    if (a.cena !== b.cena) return a.cena - b.cena
    if (a.dobavitelj !== b.dobavitelj) return a.dobavitelj < b.dobavitelj ? -1 : 1
    const oa = typeof a.opomba === 'string' ? a.opomba : ''
    const ob = typeof b.opomba === 'string' ? b.opomba : ''
    if (oa !== ob) return oa < ob ? -1 : 1
    return 0
  })
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

/** KPI polje — ISTI vzorec kot zaloga-pdf/naročilnica/dobavitelji kpiBox. */
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

/** Prazna celica za manjkajočo opcijsko polje — '' (NIKOLI izmišljen 0 / '—'
 *  — CSV R233/R244 vzorec; Excel prikaže prazno, resnica ostane resnica). */
function celica(v: string | null | undefined): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** Cena kot stabilen niz — točkovna dela na 2 decimalni mesti (EUR na enoto;
 *  String(2.5) = '2.5' bi v tabeli izgledalo kot druga resnica kot 2.50). */
function cenaNiz(c: number): string {
  return c.toFixed(2)
}

/** Zgradi CENIK dokument (brez shranjevanja) — vrne jsPDF instanco (testi
 *  berejo doc.output('arraybuffer') → bajtni dokazi). */
export function buildCenikPdfDoc(
  vnosi: readonly CenikPdfVnos[],
  options: CenikPdfOptions,
): jsPDF {
  if (!Array.isArray(vnosi)) {
    throw new TypeError('buildCenikPdfDoc: pričakovano polje cenovnih vrstic (CenikPdfVnos[])')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildCenikPdfDoc: pričakovane opcije (CenikPdfOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildCenikPdfDoc: pričakovan veljaven now: Date')
  }
  // PRAZEN SEZNAM ne nastaja dokumenta (družina: ni prazne datoteke —
  // komponenta pokaže iskren toast 'Ni vpisanih cen za izvoz.').
  if (vnosi.length === 0) {
    throw new TypeError(
      'buildCenikPdfDoc: prazen seznam ne nastaja dokumenta — komponenta pokaže iskren toast (Ni vpisanih cen za izvoz.)',
    )
  }
  vnosi.forEach((p, i) => preveriCenikPdfVnos(p, i))
  const sortirane = sortirajCenik(vnosi)

  // KPI se RAČUNAJO iz obveznih polj vrstic (notranja skladnost — glej glavo
  // liba): št. različnih artiklov, št. cen, najnižja/najvišja cena.
  const artikli = new Set(sortirane.map((p) => `${p.sifra.trim()}`))
  const ceneVrednosti = sortirane.map((p) => p.cena)
  const najnizja = Math.min(...ceneVrednosti)
  const najvisja = Math.max(...ceneVrednosti)

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / dobavitelji R236) ----------
  doc.setCreationDate(now)
  doc.setFileId(
    deterministichenId(
      `${now.toISOString()}|${sortirane
        .map((p) => `${p.sifra.trim()}:${p.dobavitelj.trim()}/${cenaNiz(p.cena)}`)
        .join(',')}`,
    ),
  )

  // ---------- glava (ISTI vzorec kot boss-report/zaloga/naročilnica/dobavitelji) ----------
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
  doc.text('CENIK MATERIALA', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })

  // ---------- KPI povzetek (izračun iz vrstic — notranja skladnost) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Povzetek cenika')
  const bw = 42
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Artikli', String(artikli.size), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Cene', String(sortirane.length), NAVY)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Najnižja', `${cenaNiz(najnizja)} €`, GREEN)
  kpiBox(doc, 14 + 3 * (bw + gap), y, bw, bh, 'Najvišja', `${cenaNiz(najvisja)} €`, AMBER)
  y += bh + 8

  // ---------- tabela cenika (ENA resnica = stolpci CSV R244) ----------
  y = sectionTitle(doc, y, `Veljavne cene (${sortirane.length})`)
  autoTable(doc, {
    startY: y,
    head: [['Artikel', 'Šifra', 'Enota', 'Dobavitelj', 'Cena (EUR/enota)', 'Opomba', 'Vpisan']],
    body: sortirane.map((p) => [
      p.artikel.trim(),
      p.sifra.trim(),
      p.enota.trim(),
      p.dobavitelj.trim(),
      cenaNiz(p.cena),
      celica(p.opomba),
      cenikDatumIso(p.vpisan),
    ]),
    styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 38 },
      4: { halign: 'right' },
      6: { halign: 'right' },
    },
    didParseCell: (data) => {
      // WYSIWYG z zaslonom: cena zeleno bold (ISTI pomen kot zelena resnica
      // najboljše cene v primerjalnem pogledu API-ja) — brez barve bi ključna
      // številka utonila med vrsticami.
      if (data.section === 'body' && data.column.index === 4) {
        data.cell.styles.textColor = GREEN
        data.cell.styles.fontStyle = 'bold'
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
    `${artikli.size} ${artikelBeseda(artikli.size)} · ${sortirane.length} ${cenaBeseda(sortirane.length)} · samo trenutno veljavne cene (pretečene niso vključene).`,
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

/** Ime datoteke cenika — `Cenik-materiala-YYYY-MM-DD.pdf` (ISTI vzorec kot
 *  dobaviteljiPdfFilename; EN now za žig IN ime — lekcija R121/R235). */
export function cenikPdfFilename(now: Date): string {
  return `Cenik-materiala-${todayStamp(now)}.pdf`
}

/** Zgeneriraj Cenik PDF (determinističen — enak vhod = bajtno enak dokument)
 *  in ga shrani kot `Cenik-materiala-YYYY-MM-DD.pdf`. */
export function generateCenikPdf(
  vnosi: readonly CenikPdfVnos[],
  options: CenikPdfOptions,
): void {
  const doc = buildCenikPdfDoc(vnosi, options)
  doc.save(cenikPdfFilename(options.now))
}
