// ---------------------------------------------------------------------------
// R321 — 50. člen issue #1 (IZVOZI družina): izvoz meritev zmogljivosti kot
// DETERMINISTIČNI PDF (Deliverable 6 kot tisk za pisarno/revizijo — bralcu,
// ki ne bere konzole). PDF brat zaslona R312 (vzorec R318 audit-pdf / R320
// končna-pdf: LOČEN lib — jsPDF teža NE obremenjuje brata zmogljivost-
// pregled, ki je jedrni merilni lib).
//
// EN VIR resnice (NIČ dvojnega — vse primitivne izpeljave UVOŽENE ali
// posredovane):
//  • resnica = ZmogljivostPregled (posredovan OD poklicatelja — meritev se
//    izvede ENKRAT v brskalniku, R312 kontrakt 'izris šele v brskalniku';
//    PDF je ČISTA projekcija že izmerjene resnice, NIKOLI ne meri znova —
//    drugi tek bi izkazal druge čase in lažno dvojno resnico);
//  • sklep = pregled.sklep VERBATIM (TRETJI potrošnik ENEGA niza — zaslon
//    zmogljivost-sklep + testi + PDF; NIČ dvojnega sklepa, vzorec R311);
//  • časi prikazno = formatirajMs (UVOŽEN iz brata R321 — ISTI izraz kot
//    zaslon vrstice; zaslon in PDF ne moreta divergirati po konstrukciji,
//    vzorec AUDIT_CSV_GLAVE R317);
//  • 🆕 R323 (51. člen): glave tabele = ZMOGLJIVOST_IZVOZ_GLAVE (UVOŽENE iz
//    brata — CSV brat R322 nosi ISTI niz → stolpci PDF/CSV NE moreta
//    divergirati po konstrukciji; vrednosti BAJTNO nespremenjene od R321);
//  • 🆕 R323 (51. člen): fail-closed validacija = preveriZmogljivostPregled-
//    ZaIzvoz (UVOŽENA iz brata — EN VIR pravila za celo izvozno družino;
//    sporočila verbatim — kje = 'buildZmogljivostPdfDoc');
//  • 'na tej napravi' kontekst = pregled.sklep verbatim (iskrena strojna
//    odvisnost — PDF NE pretendira na univerzalnost).
//
// Struktura dokumenta (družinski vzorec R318/R320/R302):
//  • ROKSAL glava (navy pas + naslov MERITVE ZMOGLJIVOSTI + iskren podnaslov
//    'deterministični izvoz — EN VIR resnica' — brez lažnih časovnih žigov);
//  • KPI ×4: Operacij (navy), Iteracij (navy), Preverjenih (navy — vsi izhodi
//    vseh iteracij preverjeni), Enota 'ms' (kurzorna resnica — IZRAČUNANE iz
//    pregled, NIČ trdo kodiranih);
//  • tabela: meritve po operacijah (ENA vrstica = ENA operacija — ISTA
//    ravnina kot zaslon vrstice): Operacija · Opis · Modul · Iteracij ·
//    Najmanj · Mediana · Najvec (ms, formatirajMs EN VIR);
//  • sklepna vrstica: Sklep (pregled.sklep VERBATIM, zavita prek
//    splitTextToSize — vsebina verbatim, samo vizualni prelom).
//
// Determinizem (kanon 46./47./48./49. člen): vsebina NE nosi časa (brez
// časovnih žigov izvoza v vsebini — čas bi uničil determinizem); format PDF
// pa ZAHTEVA
// CreationDate metadata → KANONSKI fiksni žig ZMOGLJIVOST_PDF_ZIG_FIKSNI
// (formatna lastnost, NIČ podatkovne resnice) kot privzeti `now`
// (parametriziran SAMO za teste — produkcija kliče brez argumenta; LEKCIJA
// R317 4: fail-closed testi z null); fileId = čista JS FNV-1a nad
// kanonizirano serijalizacijo resnice (id + iteracij + časi — meritve SO
// del resnice; isti HEAD + ista meritev = bajtno identičen PDF) z LASTNIMI
// soli 0xc9–0xcc (register: 0xb0–0xc0 prejšnje, 0xc1–0xc4 audit-pdf R318,
// 0xc5–0xc8 končna-pdf R320 — ista semena v dveh libih NE smejo dati isti ID).
//
// Fail-closed: 🆕 R322 — validacija EN VIR iz brata (preveriZmogljivost-
// PregledZaIzvoz: ne-objekt pregled / prazne meritve / meritev brez
// kontrakta / preverjeno !== true / zip usklajenost) + pokvaren now /
// pokvaren options → TypeError z imenom graditelja (kanon
// R299/R302/R306/R318). Pokvarena meritev ne more postati lažno poročilo —
// preverjeno !== true pomeni, da je merjenje ALI javno padlo (izmeriZmogljivost
// fail-closed) ALI je vhod ročno pokvaren (PDF ga odkloni). Obrnjena
// regresija: PDF funkcij NI v zmogljivost-pregled libu (cikel in duplikat
// tiran — ena definicija, EN lib; r318 lekcija 1); validacija je ENA
// (brat) — NIČ podvojenih pravil v družini (R322).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import {
  formatirajMs,
  preveriZmogljivostPregledZaIzvoz,
  ZMOGLJIVOST_IZVOZ_GLAVE,
} from './zmogljivost-pregled'
import type { ZmogljivostPregled } from './zmogljivost-pregled'

// ---------- barve (ISTI dokumenti družina — usklajeno z R318/R320) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

/** Kanonski fiksni žig CreationDate (determinizem — kanon 46.–49. člen).
 *  Format PDF zahteva CreationDate; vsebina NE nosi časa. NIČ podatkovne
 *  resnice — samo formatna lastnost dokumenta. */
export const ZMOGLJIVOST_PDF_ZIG_FIKSNI = new Date(Date.UTC(2026, 0, 1, 0, 0, 0))

export interface ZmogljivostPdfOptions {
  /** Formatni žig CreationDate — PRIVZETO kanonski fiksni žig (determinizem:
   *  produkcija kliče brez argumenta = isti HEAD → bajtno identičen PDF).
   *  Parametriziran SAMO za teste (kanon pregled). */
  now?: Date
}

/** Determinističen file-ID (32 hex) — čista JS FNV-1a; LASTNI soli 0xc9–0xcc. */
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
    fnv1aHex(seed, 0xc9) +
    fnv1aHex(seed, 0xca) +
    fnv1aHex(seed, 0xcb) +
    fnv1aHex(seed, 0xcc)
  )
}

/** Kanoniziran seed resnice — meritve (id + iteracij + časi) SO del resnice;
 *  serijalizacija = določevalna funkcija vsebine (ISTI vrstni red kot
 *  pregled.meritve — nič re-sorta). */
function resnicaSeed(pregled: ZmogljivostPregled): string {
  return `O:${pregled.meritve
    .map((m) => `${m.id}@${m.iteracij}#${m.najmanj}|${m.mediana}|${m.najvec}`)
    .join(';')}`
}

// 🆕 R323 (51. člen): zasebna preveriMeritev PREMEŠČENA v brat (preveri-
// ZmogljivostPregledZaIzvoz — EN VIR validacija za celo izvozno družino;
// sporočila verbatim, kje = ime graditelja). PDF lib NE nosi več lastnih
// pravil — pokvaren pregled je odklonjen na ISTI način v CSV in PDF.

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

/** KPI polje — ISTI vzorec kot audit-pdf/končna-pdf (družinski kpiBox). */
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

/** Zgradi MERITVE ZMOGLJIVOSTI dokument (brez shranjevanja) — vrne jsPDF
 *  instanco (testi berejo doc.output('arraybuffer') → bajtni dokazi).
 *  Pregled je POSREDOVAN (meritev se izvede ENKRAT v brskalniku — R312
 *  kontrakt); opcije parametrizirane SAMO za teste fail-closed poti
 *  (produkcija kliče brez argumentov; null NE undefined — lekcija R317 4). */
export function buildZmogljivostPdfDoc(
  pregled: ZmogljivostPregled,
  options: ZmogljivostPdfOptions = {},
): jsPDF {
  if (!pregled || typeof pregled !== 'object') {
    throw new TypeError('buildZmogljivostPdfDoc: pričakovan pregled (ZmogljivostPregled)')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildZmogljivostPdfDoc: pričakovane opcije (ZmogljivostPdfOptions)')
  }
  const now = options.now ?? ZMOGLJIVOST_PDF_ZIG_FIKSNI
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildZmogljivostPdfDoc: pričakovan veljaven now: Date')
  }
  // 🆕 R323 (51. člen): validacija EN VIR iz brata (meritve/sklep/skupaj-
  // Iteracij/kontrakt meritve/zip — sporočila verbatim, kje = graditelj).
  preveriZmogljivostPregledZaIzvoz(pregled, 'buildZmogljivostPdfDoc')

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / končna-pdf R320) ----------
  doc.setCreationDate(now)
  doc.setFileId(deterministichenId(`${now.toISOString()}|${resnicaSeed(pregled)}`))

  // ---------- glava (ISTI vzorec kot končna-pdf R320) ----------
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
  doc.text('MERITVE ZMOGLJIVOSTI', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text('deterministični izvoz — EN VIR resnica', 196, 19, { align: 'right' })

  // ---------- KPI povzetek (številke IZRAČUNANE iz pregled — NIČ trdo) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Povzetek merjenja')
  const bw = 44
  const bh = 16
  const gap = 4
  const stPreverjenih = pregled.meritve.filter((m) => m.preverjeno).length
  kpiBox(doc, 14, y, bw, bh, 'Operacij', String(pregled.meritve.length), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Iteracij', String(pregled.skupajIteracij), NAVY)
  kpiBox(
    doc,
    14 + 2 * (bw + gap),
    y,
    bw,
    bh,
    'Preverjenih',
    // fail-closed validacija zgoraj zagotavlja preverjeno === true za VSE —
    // števec je IZRAČUNAN (NIČ trdo kodiranih), brez mrtve alarmne veje.
    `${String(stPreverjenih)}/${String(pregled.meritve.length)}`,
    NAVY,
  )
  kpiBox(doc, 14 + 3 * (bw + gap), y, bw, bh, 'Enota', 'ms', NAVY)
  y += bh + 8

  // ---------- tabela: meritve (ISTA ravnina kot zaslon vrstice) ----------
  y = sectionTitle(doc, y, `Meritve po operacijah (${pregled.meritve.length})`)
  autoTable(doc, {
    startY: y,
    // 🆕 R323 (51. člen): glave EN VIR (ZMOGLJIVOST_IZVOZ_GLAVE iz brata —
    // vrednosti bajtno nespremenjene od R321; CSV brat nosi ISTI niz).
    head: [...ZMOGLJIVOST_IZVOZ_GLAVE].map((g) => [g]),
    body: pregled.meritve.map((m) => [
      m.id,
      m.opis,
      m.modul,
      String(m.iteracij),
      formatirajMs(m.najmanj),
      formatirajMs(m.mediana),
      formatirajMs(m.najvec),
    ]),
    styles: { fontSize: 6.3, cellPadding: 1.2, font: 'Roboto', overflow: 'linebreak' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 6.3 },
    columnStyles: {
      // Širine seštejeta natanko 182 mm (družinski kanon 210 − 2×14).
      // ZNANA DRUŽINSKA LASTNOST (dokumentirana, NE tiho utišana — R320
      // kosmetična opomba): autoTable izpiše konstantno opozorilo '0.22
      // units width could not fit' — strukturni artefakt neodvisen od
      // vsebine (potrjeno z 1-znakovnim vhodom; ista konstanta kot r318 ×10
      // / r319 ×5). Izhod je veljaven (%PDF- + determinizem bajtno).
      0: { cellWidth: 32 },
      1: { cellWidth: 47 },
      2: { cellWidth: 41 },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 16, halign: 'right' },
      5: { cellWidth: 16, halign: 'right' },
      6: { cellWidth: 16, halign: 'right' },
    },
    didParseCell: (data) => {
      // WYSIWYG: operacija id (stolpec 0) bold navy — ISTI signal kot zaslon
      // vrstica (opis font-medium roksal-ink).
      if (data.section === 'body' && data.column.index === 0) {
        data.cell.styles.textColor = NAVY
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 6

  // ---------- sklepna vrstica (EN VIR sklep — TRETJI potrošnik ENEGA niza) ----------
  if (y > 248) {
    doc.addPage()
    y = 20
  }
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  // Verbatim vsebina, samo vizualni prelom (splitTextToSize — niz ostane ISTI).
  const sklepVrstice = doc.splitTextToSize(pregled.sklep, 182) as string[]
  doc.text(sklepVrstice, 14, y + 4)

  // ---------- noge na vseh straneh (brez časa — determinizem) ----------
  const strani = doc.getNumberOfPages()
  for (let i = 1; i <= strani; i++) {
    doc.setPage(i)
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(14, 284, 196, 284)
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...GRAY)
    doc.text('Meritve zmogljivosti · Roksal Field Manager v2.5', 14, 289)
    doc.text(`Stran ${i}/${strani}`, 196, 289, { align: 'right' })
  }

  return doc
}

/** Deterministično ime datoteke (brez datuma — veza na HEAD je implicitna;
 *  vzorec končna-verifikacija.pdf, 49. člen). */
export function zmogljivostPdfFilename(): string {
  return 'zmogljivost-pregled.pdf'
}

/** Zgeneriraj MERITVE ZMOGLJIVOSTI PDF (determinističen — isti HEAD + ista
 *  meritev = bajtno identičen dokument) in ga shrani kot
 *  `zmogljivost-pregled.pdf`. */
export function generateZmogljivostPdf(pregled: ZmogljivostPregled): void {
  const doc = buildZmogljivostPdfDoc(pregled)
  doc.save(zmogljivostPdfFilename())
}
