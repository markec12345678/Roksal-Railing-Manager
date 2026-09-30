// ---------------------------------------------------------------------------
// R320 — 49. člen issue #1 (IZVOZI družina): izvoz poročila končne
// verifikacije kot DETERMINISTIČNI PDF (Deliverable 7 kot tisk za
// pisarno/revizijo — bralcu brez JSON bralca). PDF brat JSON izvoza R316
// (vzorec R318 audit-pdf: LOČEN lib — jsPDF teža NE obremenjuje brata;
// EN VIR validacija ostane v bratu).
//
// EN VIR resnice (NIČ dvojnega — vse primitivne izpeljave UVOŽENE):
//  • resnica = koncnaVerifikacija (UVOŽEN iz brata R315 — ISTA validacija
//    fail-closed brezplačno: audit/dokazi/kriteriji/plasti; NIČ podvojenih
//    pravil; vrstni red vrstic = ISTI vrstni red kot audit);
//  • sklep = kv.sklep (UVOŽEN — ISTI niz kot zaslon + JSON meta + testi +
//    docs; PETI potrošnik ENEGA niza);
//  • plasti prikazno = v.plasti verbatim (ISTI nizi kot zaslon chips + JSON);
//  • kriteriji = kv.kriteriji verbatim (kriterij/izpeljava/dokaz — ISTI nizi
//    kot zaslon + JSON).
//
// Struktura dokumenta (družinski vzorec R318/R302/R250):
//  • ROKSAL glava (navy pas + naslov KONČNA VERIFIKACIJA + iskren podnaslov
//    'deterministični izvoz — EN VIR resnica' — brez lažnih časovnih žigov);
//  • KPI ×4: Območij (navy — obseg), z dokazi (navy — resnica z vezavo),
//    Kriterijev (navy), AI-OBVEZNO (rdeč, če > 0 — iskren alarm; vse
//    IZRAČUNANE iz kv — NIČ trdo kodiranih);
//  • tabela 1: dokazne plasti po območjih (ENA vrstica = ENO območje — ISTA
//    ravnina kot zaslon vrstice + JSON obmocja): Območje · Razred (prikazno,
//    bold navy) · Plasti (pipe-joined) · Dokaz (opomba verbatim);
//  • tabela 2: sprejemni kriteriji (Kriterij · Izpeljava · Dokaz — verbatim);
//  • sklepna vrstica: Sklep (kv.sklep VERBATIM, zavita prek splitTextToSize
//    — vsebina verbatim, samo vizualni prelom).
//
// Determinizem (kanon 46./47./48. člen — 'isti HEAD = bajtno identična
// datoteka'): vsebina NE nosi časa (brez časovnih žigov v vsebini — čas bi
// uničil determinizem); format PDF pa ZAHTEVA CreationDate metadata →
// KANONSKI fiksni žig KONCNA_PDF_ZIG_FIKSNI (formatna lastnost, NIČ
// podatkovne resnice) kot privzeti `now` (parametriziran SAMO za teste —
// produkcija kliče brez argumenta; LEKCIJA R317 4: fail-closed testi z null);
// fileId = čista JS FNV-1a nad kanonizirano serijalizacijo resnice z
// LASTNIMI soli 0xc5–0xc8 (register: 0xb0–0xc0 prejšnje, 0xc1–0xc4 audit-pdf
// R318 — ista semena v dveh libih NE smejo dati isti ID).
//
// Fail-closed: ne-polje / prazen audit / pokvaren now / notranja neskladja
// zip → TypeError z imenom graditelja (kanon R299/R302/R306). Pokvarjeni
// vhodi ne morejo postati lažno poročilo — validacija gre PREK brata (EN
// VIR). Obrnjena regresija: PDF funkcij NI v koncna-verifikacija libu
// (cikel in duplikat tiran — ena definicija, EN lib; r318 lekcija 1).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import {
  koncnaVerifikacija,
  DOKAZI_AUDITA,
  SPREJEMNI_KRITERIJI,
  type KoncnaVerifikacijaVrstica,
  type SprejemniKriterij,
  type DokazVezava,
} from './koncna-verifikacija'
import type { VrstaAudita } from './avtomatizacija-audit'
import { AVTOMATIZACIJA_AUDIT } from './avtomatizacija-audit'

// ---------- barve (ISTI dokumenti družina — usklajeno z R318/R302) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const RED: [number, number, number] = [220, 38, 38] // zaloga-pdf R120 red (iskren alarm)
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

/** Kanonski fiksni žig CreationDate (determinizem — kanon 46./47./48. člen).
 *  Format PDF zahteva CreationDate; vsebina NE nosi časa. NIČ podatkovne
 *  resnice — samo formatna lastnost dokumenta. */
export const KONCNA_PDF_ZIG_FIKSNI = new Date(Date.UTC(2026, 0, 1, 0, 0, 0))

export interface KoncnaVerifikacijaPdfOptions {
  /** Formatni žig CreationDate — PRIVZETO kanonski fiksni žig (determinizem:
   *  produkcija kliče brez argumenta = isti HEAD → bajtno identičen PDF).
   *  Parametriziran SAMO za teste (kanon pregled). */
  now?: Date
}

/** Determinističen file-ID (32 hex) — čista JS FNV-1a; LASTNI soli 0xc5–0xc8. */
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
    fnv1aHex(seed, 0xc5) +
    fnv1aHex(seed, 0xc6) +
    fnv1aHex(seed, 0xc7) +
    fnv1aHex(seed, 0xc8)
  )
}

/** Kanoniziran seed resnice — resnica je kanon f(vhoda) (ISTI vrstni red
 *  vrstic kot audit), serijalizacija = določevalna funkcija vsebine. */
function resnicaSeed(vrstice: readonly KoncnaVerifikacijaVrstica[]): string {
  return `O:${vrstice
    .map((v) => `${v.obmocje}#${v.razredPrikazno}@${v.plasti.join('+')}`)
    .join(';')}`
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

/** KPI polje — ISTI vzorec kot audit-pdf/konflikti/dobičkonost (družinski kpiBox). */
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

/** Zgradi KONČNA VERIFIKACIJA dokument (brez shranjevanja) — vrne jsPDF
 *  instanco (testi berejo doc.output('arraybuffer') → bajtni dokazi).
 *  Privzeti vhodi = EN VIR (parametrizirani SAMO za teste fail-closed poti —
 *  produkcija vedno kliče brez argumentov; null NE undefined — lekcija R317 4). */
export function buildKoncnaVerifikacijaPdfDoc(
  audit: readonly VrstaAudita[] = AVTOMATIZACIJA_AUDIT,
  options: KoncnaVerifikacijaPdfOptions = {},
  dokazi: Readonly<Record<string, DokazVezava>> = DOKAZI_AUDITA,
  kriteriji: readonly SprejemniKriterij[] = SPREJEMNI_KRITERIJI,
): jsPDF {
  if (!Array.isArray(audit)) {
    throw new TypeError('buildKoncnaVerifikacijaPdfDoc: pričakovan audit (seznam vrstic)')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildKoncnaVerifikacijaPdfDoc: pričakovane opcije (KoncnaVerifikacijaPdfOptions)')
  }
  const now = options.now ?? KONCNA_PDF_ZIG_FIKSNI
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildKoncnaVerifikacijaPdfDoc: pričakovan veljaven now: Date')
  }
  // Validacija + WYSIWYG preslikava prek EN VIR graditelja (fail-closed
  // brezplačno — ISTA strogost kot na zaslonu, NIČ podvojenih pravil).
  const kv = koncnaVerifikacija(audit, dokazi, kriteriji)
  // Zip po indeksu z IZRECNO usklajenostno asercijo (vzorec CSV brata R317/
  // PDF brata R318): vrstici si delata ISTI vrstni red (nič prerazporejanja).
  if (kv.vrstice.length !== audit.length) {
    throw new TypeError(
      'buildKoncnaVerifikacijaPdfDoc: notranja neskladja dolžin (resnica vs audit) — fail-closed',
    )
  }
  const vrstice = kv.vrstice
  for (let i = 0; i < audit.length; i++) {
    const v = audit[i]
    const p = vrstice[i]
    if (!p || !v || p.obmocje !== v.obmocje) {
      throw new TypeError(
        `buildKoncnaVerifikacijaPdfDoc: vrstica ${i} ni usklajena z auditom (${String(v?.obmocje)}) — fail-closed`,
      )
    }
  }

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / audit-pdf R318) ----------
  doc.setCreationDate(now)
  doc.setFileId(deterministichenId(`${now.toISOString()}|${resnicaSeed(vrstice)}`))

  // ---------- glava (ISTI vzorec kot audit-pdf R318) ----------
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
  doc.text('KONČNA VERIFIKACIJA', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text('deterministični izvoz — EN VIR resnica', 196, 19, { align: 'right' })

  // ---------- KPI povzetek (številke IZRAČUNANE iz kv — NIČ trdo) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Povzetek verifikacije')
  const bw = 44
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Območij', String(kv.stObmocij), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Z dokazi', String(kv.stObmocijZDokazi), NAVY)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Kriterijev', String(kv.stKriterijev), NAVY)
  kpiBox(
    doc,
    14 + 3 * (bw + gap),
    y,
    bw,
    bh,
    'AI-OBVEZNO',
    String(kv.stAiObveznih),
    kv.stAiObveznih > 0 ? RED : NAVY,
  )
  y += bh + 8

  // ---------- tabela 1: dokazne plasti po območjih (ISTA ravnina kot zaslon + JSON) ----------
  y = sectionTitle(doc, y, `Dokazne plasti po območjih (${kv.stObmocij})`)
  autoTable(doc, {
    startY: y,
    head: [['Območje', 'Razred', 'Plasti', 'Dokaz']],
    body: audit.map((v, i) => [
      vrstice[i].obmocje,
      vrstice[i].razredPrikazno,
      vrstice[i].plasti.join(' | '),
      vrstice[i].opombaDokaza,
    ]),
    styles: { fontSize: 6.3, cellPadding: 1.2, font: 'Roboto', overflow: 'linebreak' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 6.3 },
    columnStyles: {
      0: { cellWidth: 41 },
      1: { cellWidth: 23, halign: 'center' },
      2: { cellWidth: 34 },
      3: { cellWidth: 80 },
    },
    didParseCell: (data) => {
      // WYSIWYG: razred (stolpec 1) bold navy — ISTI signal kot značka na
      // zaslonu (R315 plast chips navy žeton).
      if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.textColor = NAVY
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 6

  // ---------- tabela 2: sprejemni kriteriji (verbatim — ISTI nizi kot zaslon + JSON) ----------
  if (y > 200) {
    doc.addPage()
    y = 20
  }
  y = sectionTitle(doc, y, `Sprejemni kriteriji (${kv.stKriterijev})`)
  autoTable(doc, {
    startY: y,
    head: [['Kriterij', 'Izpeljava', 'Dokaz']],
    body: kv.kriteriji.map((k) => [k.kriterij, k.izpeljava, k.dokaz]),
    styles: { fontSize: 6.3, cellPadding: 1.2, font: 'Roboto', overflow: 'linebreak' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 6.3 },
    columnStyles: {
      0: { cellWidth: 52 },
      1: { cellWidth: 63 },
      2: { cellWidth: 63 },
    },
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 6

  // ---------- sklepna vrstica (EN VIR sklep — PETI potrošnik ENEGA niza) ----------
  if (y > 248) {
    doc.addPage()
    y = 20
  }
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  // Verbatim vsebina, samo vizualni prelom (splitTextToSize — niz ostane ISTI).
  const sklepVrstice = doc.splitTextToSize(kv.sklep, 182) as string[]
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
    doc.text('Končna verifikacija · Roksal Field Manager v2.5', 14, 289)
    doc.text(`Stran ${i}/${strani}`, 196, 289, { align: 'right' })
  }

  return doc
}

/** Deterministično ime datoteke (brez datuma — veza na HEAD je implicitna;
 *  vzorec končna-verifikacija.json, 46. člen). */
export function koncnaVerifikacijaPdfFilename(): string {
  return 'koncna-verifikacija.pdf'
}

/** Zgeneriraj KONČNA VERIFIKACIJA PDF (determinističen — isti HEAD =
 *  bajtno identičen dokument) in ga shrani kot `koncna-verifikacija.pdf`. */
export function generateKoncnaVerifikacijaPdf(): void {
  const doc = buildKoncnaVerifikacijaPdfDoc()
  doc.save(koncnaVerifikacijaPdfFilename())
}
