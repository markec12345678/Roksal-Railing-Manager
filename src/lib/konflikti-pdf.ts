// ---------------------------------------------------------------------------
// R302 (P1, 'izvozi' družina — 32. člen) — TEDENSKI KONFLIKTI PDF iz
// logistike (logistics-tab). PDF BRAT pregledu R300 + CSV R301 (vzorec
// R284→R285/R266→R267/R256→R292): izvozi TOČNO tisto resnico, ki jo
// KONFLIKTNA MINI-VRSTICA (30. člen) izreče in jo CSV (31. člen) pokaže kot
// strojne vrstice — PDF pokaže DOKAZ kot TISK za pisarno/revizijo (bralcu
// brez Excela; isti pari, isti čas, isti sklep). WYSIWYG po konstrukciji.
//
// EN VIR resnice (NIČ dvojnega — vse primitivne izpeljave UVOŽENE):
//  • pregled = tedenskiKonflikti (UVOŽEN iz brata R300 — ISTO okno
//    tedenskiOknoDnevi, ISTA uvožena preverba preveriVozniRedTermin z
//    indeksom krivca, ISTA poli-odprto pravila + aktivni statusi
//    STRAŽAR-sinhronizirano zrcalo R142, ISTI pari po sortiranem času ASC
//    f(množica), ISTA skupine ASC po ekipi UTF-16);
//  • glava tabele = KONFLIKTI_CSV_GLAVA (UVOŽENA iz CSV brata R301 — ISTIH
//    10 stolpcev VERBATIM; PDF in CSV NE moreta divergirati po konstrukciji);
//  • Sklep = konfliktiSklep (UVOŽEN iz CSV brata R301 — ISTO besedilo kot
//    rdeč žig mini-vrstice 30. člena + CSV meta vrstica + toast komponente;
//    ŠTIRI potrošniki ENEGA niza);
//  • okno v Obseg vrstici = tedenskiOknoDnevi (UVOŽEN — ISTA UTC aritmetika
//    danes..danes+6 kot cela tedenska družina R256/R292/R298/R299/R300);
//  • datum izpisa = cenikDatumIso (UVOŽEN — ISTI izpis DD. MM. YYYY kot
//    meta bratje R292/R296/R297) + zalogaPovzetekCasOznaka (UVOŽEN — ISTI
//    žig 'osveženo/Generirano' kot PDF bratje R250/R257);
//  • statusi v celicah = SCHEDULE_TERMINI_STATUS_LABELS (UVOŽENI — ISTI
//    VERBATIM prikazi kot CSV brat R301; par členi so po konstrukciji samo
//    aktivni statusi — Navrteno/V teku/Preloženo).
//
// Struktura dokumenta (družinski vzorec R250/R257/R263):
//  • ROKSAL glava (navy pas + naslov TEDENSKI KONFLIKTI EKIP + osveženo);
//  • KPI ×4: Konfliktov (rdeč — konflikti obstajajo po DOMAIN pravilu),
//    Ekip z konflikti (rdeč), Pregledanih terminov (navy — resnica obsega),
//    Okvir 7 dni (navy — DD. MM. – DD. MM. iz tedenskiOknoDnevi);
//  • tabela dokazanih parov (ENA vrstica = EN PAR — ISTA ravnina kot CSV):
//    Ekipa · Dan prekrivanja · za OBA člena Projekt/Začetek (UTC)/Konec
//    (UTC)/Status; Časa = VERBATIM ISO niza iz DTO (strojni ISO za revizijo,
//    nič pretvorbe pasov — ISTO resnico kot CSV brat R301 in ICS bratje
//    R298/R299); dan prekrivanja rdeče bold (dokazani odpad — iskren alarm);
//  • sklepna vrstica: Sklep (konfliktiSklep VERBATIM) + Obseg okna + 'Izvoženo ob'
//    (kanonični ISO 8601) — ISTA meta resnica kot CSV brat.
//
// DOMAIN pravilo (fail-closed mirror družine R266/R297/R301): 0 konfliktov
// (zelen žig — iskrena čistost na zaslonu) NI vhod → TypeError 'ni
// dokazanih konfliktov' (ni prazne datoteke — datoteka nastane ob prvem
// dokazanem prekrivanju; komponenta pokaže iskren toast ŠE PRED klicem —
// lib dvakrat brani). Pokvaren now / ne-polje / pokvaren vnos (uvožen
// pregled — indeks krivca) → TypeError (nikoli tiho spregledano).
//
// Načela (družinska pravila):
//  • Determinizem: `now` KOT parameter (F4 — jedro ne bere ure);
//    doc.setCreationDate(now) + doc.setFileId(FNV-1a) — enak vhod = bajtno
//    enak PDF (document-pdf R121); pregled je že kanon f(množica) (skupine
//    ASC UTF-16, pari čas ASC) — premešan odgovor = bajtno ISTI dokument;
//    seed = kanonizirana serijalizacija pregleda (NIKOLI vrstni red odgovora).
//  • CLIENT-safe: čisti klientski lib (uvozi ga logistics-tab) — čista JS
//    FNV-1a; LASTNI soli **0xb9–0xbc** (register: terenski-zapisni 0xb5–0xb8
//    → konflikti 0xb9–0xbc — ista semena v dveh libih NE smejo dati isti ID).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { tedenskiOknoDnevi } from './tedenski-vozni-red-pdf'
import { cenikDatumIso } from './cenik-pdf'
import { SCHEDULE_TERMINI_STATUS_LABELS } from './termini-prikaz'
import {
  tedenskiKonflikti,
  type TedenskiKonfliktPregled,
} from './tedenski-konflikti'
import { KONFLIKTI_CSV_GLAVA, konfliktiSklep } from './konflikti-csv'
import type { VozniRedTermin } from './logistika-vozni-red-pdf'
import { todayStamp } from './csv-export'
import { zalogaPovzetekCasOznaka } from './zaloga-povzetek'

// ---------- barve (ISTI dokumenti družina — usklajeno z dobičkonost/koledar) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber (obseg/okvir)
const RED: [number, number, number] = [220, 38, 38] // zaloga-pdf R120 red (konflikti — iskren alarm)
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

export interface KonfliktiPdfOptions {
  /** Referenčni trenutek (žig + okvir + CreationDate + fileId + ime) — KOT
   *  PARAMETER (determinizem; vzorec R121/R203/R250/R257/R301). */
  now: Date
}

/** Determinističen file-ID (32 hex) — čista JS FNV-1a; LASTNI soli 0xb9–0xbc. */
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
    fnv1aHex(seed, 0xb9) +
    fnv1aHex(seed, 0xba) +
    fnv1aHex(seed, 0xbb) +
    fnv1aHex(seed, 0xbc)
  )
}

/** Kanoniziran seed pregleda — pregled je ŽE kanon f(množica) (skupine ASC
 *  UTF-16, pari čas ASC po konstrukciji tedenskiKonflikti), serijalizacija
 *  = določevalna funkcija vsebine (premešan vhod → ISTI pregled → ISTI seed). */
function pregledSeed(pregled: TedenskiKonfliktPregled): string {
  return `G:${pregled.skupine
    .map(
      (s) =>
        `${s.ekipa}#${s.pari
          .map((p) => `${p.a.datumZacetka}>${p.b.datumZacetka}@${p.dan}`)
          .join(',')}`,
    )
    .join(';')}|P:${pregled.pregledanih}`
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

/** KPI polje — ISTI vzorec kot dobičkonost/koledar (družinski kpiBox). */
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

/** Zgradi TEDENSKI KONFLIKTI dokument (brez shranjevanja) — vrne jsPDF
 *  instanco (testi berejo doc.output('arraybuffer') → bajtni dokazi).
 *  DOMAIN pravilo: pregled === null (zelen žig — iskrena čistost) → TypeError
 *  (ni prazne datoteke — mirror družine R266/R297/R301). */
export function buildKonfliktiPdfDoc(
  vnosi: readonly VozniRedTermin[],
  options: KonfliktiPdfOptions,
): jsPDF {
  if (!Array.isArray(vnosi)) {
    throw new TypeError('buildKonfliktiPdfDoc: pričakovano polje terminov (VozniRedTermin[])')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildKonfliktiPdfDoc: pričakovane opcije (KonfliktiPdfOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildKonfliktiPdfDoc: pričakovan veljaven now: Date')
  }
  const pregled = tedenskiKonflikti(vnosi, now)
  if (pregled === null) {
    throw new TypeError(
      'buildKonfliktiPdfDoc: ni dokazanih konfliktov v 7-dnevnem oknu — datoteka se izvozi ob prvem dokazanem prekrivanju (žig na zaslonu je zelen; družina R266/R297/R301: ni prazne datoteke)',
    )
  }

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / dobičkonost R258) ----------
  doc.setCreationDate(now)
  doc.setFileId(deterministichenId(`${now.toISOString()}|${pregledSeed(pregled)}`))

  // ---------- glava (ISTI vzorec kot dobičkonost/koledar) ----------
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
  doc.text('TEDENSKI KONFLIKTI EKIP', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })

  // ---------- KPI povzetek (resnica pregleda — ENA za KPI + tabelo + sklep) ----------
  const okno = tedenskiOknoDnevi(now)
  let y = 33
  y = sectionTitle(doc, y, 'Povzetek konfliktnega pregleda')
  // 4 polja → široki boxi (ISTI layout kot koledar R263 — 59 mm).
  const bw = 44
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Konfliktov', String(pregled.stPrekrivanj), RED)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Ekip z konflikti', String(pregled.skupine.length), RED)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Pregledanih terminov', String(pregled.pregledanih), NAVY)
  kpiBox(doc, 14 + 3 * (bw + gap), y, bw, bh, 'Okvir 7 dni', `${cenikDatumIso(okno[0])} – ${cenikDatumIso(okno[6])}`, NAVY)
  y += bh + 8

  // ---------- tabela dokazanih parov (ENA vrstica = EN PAR — ISTA ravnina kot CSV R301) ----------
  y = sectionTitle(doc, y, `Dokazani pari prekrivanj (${pregled.stPrekrivanj})`)
  const vrsticeTabele: string[][] = []
  for (const skupina of pregled.skupine) {
    for (const par of skupina.pari) {
      vrsticeTabele.push([
        skupina.ekipa,
        par.dan,
        par.a.projekt ?? '—',
        par.a.datumZacetka,
        par.a.datumKonca ?? '—',
        SCHEDULE_TERMINI_STATUS_LABELS[par.a.status],
        par.b.projekt ?? '—',
        par.b.datumZacetka,
        par.b.datumKonca ?? '—',
        SCHEDULE_TERMINI_STATUS_LABELS[par.b.status],
      ])
    }
  }
  autoTable(doc, {
    startY: y,
    head: [[...KONFLIKTI_CSV_GLAVA]],
    body: vrsticeTabele,
    styles: { fontSize: 6.3, cellPadding: 1.2, font: 'Roboto', overflow: 'linebreak' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 6.3 },
    columnStyles: {
      1: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      7: { halign: 'center' },
      8: { halign: 'center' },
      5: { halign: 'center' },
      9: { halign: 'center' },
    },
    didParseCell: (data) => {
      // WYSIWYG: dan prekrivanja (stolpec 1) rdeče bold — DOKAZANI odpad
      // (ISTI signal kot rdeč žig mini-vrstice 30. člena; NIKOLI utišan).
      if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.textColor = RED
        data.cell.styles.fontStyle = 'bold'
      }
      // brez-projekt / brez-konca '—' sivo (iskrena null resnica — R227 strogost).
      if (data.section === 'body' && data.cell.raw === '—') {
        data.cell.styles.textColor = GRAY
      }
    },
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 6

  // ---------- sklepna vrstica (EN VIR konfliktiSklep — ISTO besedilo kot žig + CSV meta + toast) ----------
  if (y > 248) {
    doc.addPage()
    y = 20
  }
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text(konfliktiSklep(pregled), 14, y + 4)
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  doc.text(
    `Obseg okna: ${cenikDatumIso(okno[0])} – ${cenikDatumIso(okno[6])} (danes + 6 dni, UTC) · Pregledanih terminov: ${pregled.pregledanih} · Izvoženo ob ${now.toISOString()}`,
    14,
    y + 9,
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

/** Ime datoteke — `Konflikti-YYYY-MM-DD.pdf` (družinski vzorec; ISTA dnevna
 *  resnica kot CSV brat Konflikti-YYYY-MM-DD.csv; deterministično glede na
 *  `now`; EN now za žig IN ime — lekcija R121/R235). */
export function konfliktiPdfFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('konfliktiPdfFilename: pričakovan veljaven now: Date')
  }
  return `Konflikti-${todayStamp(now)}.pdf`
}

/** Zgeneriraj TEDENSKI KONFLIKTI PDF (determinističen — enak vhod = bajtno
 *  enak dokument) in ga shrani kot `Konflikti-YYYY-MM-DD.pdf`. */
export function generateKonfliktiPdf(
  vnosi: readonly VozniRedTermin[],
  options: KonfliktiPdfOptions,
): void {
  const doc = buildKonfliktiPdfDoc(vnosi, options)
  doc.save(konfliktiPdfFilename(options.now))
}
