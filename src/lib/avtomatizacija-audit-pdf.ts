// ---------------------------------------------------------------------------
// R318 — 48. člen issue #1 (IZVOZI družina): izvoz avtomatizacijskega audita
// kot DETERMINISTIČNI PDF (Deliverable 4 kot tisk za pisarno/revizijo —
// bralcu brez Excela). PDF BRAT pregledu R314 + CSV R317 (vzorec
// R302 konflikti: izvozi TOČNO tisto resnico, ki jo zaslon izreče in CSV
// pokaže kot strojne vrstice — WYSIWYG po konstrukciji).
//
// EN VIR resnice (NIČ dvojnega — vse primitivne izpeljave UVOŽENE):
//  • pregled = avtomatizacijaPregled (UVOŽEN iz brata R314 — ISTA validacija
//    fail-closed brezplačno: območja/razredi/poti/opombe; NIČ podvojenih
//    pravil; vrstni red vrstic = ISTI vrstni red kot audit);
//  • glava tabele = AUDIT_CSV_GLAVE (UVOŽENA iz CSV brata R317 — ISTIH 5
//    stolpcev VERBATIM; PDF in CSV NE moreta divergirati po konstrukciji —
//    vzorec KONFLIKTI_CSV_GLAVA R302);
//  • sklep = pregled.sklep (UVOŽEN — ISTI niz kot žig na zaslonu + CSV meta
//    + testi; ŠTIRI potrošniki ENEGA niza);
//  • vir niz = AUDIT_VIR_NIZ (UVOŽEN iz CSV brata R318 refactor — ISTI niz v
//    CSV 'Vir;' meta vrstici IN PDF sklepni vrstici);
//  • razred prikazno = RAZRED_PRIKAZNO (UVOŽEN — ISTI prikazni nizi kot
//    zaslon + CSV).
//
// Struktura dokumenta (družinski vzorec R302/R250/R257):
//  • ROKSAL glava (navy pas + naslov AVTOMATIZACIJSKI AUDIT + iskren podnaslov
//    'deterministični izvoz — EN VIR resnica' — brez lažnih časovnih žigov);
//  • KPI ×4: Območij (navy — obseg resnice), DETERMINISTIČNO (navy — jedro),
//    AI-OPCIJSKO (amber — neobvezna izboljšava), AI-OBVEZNO (rdeč, če > 0 —
//    iskren alarm; vse tri številke IZRAČUNANE iz pregled.poRazredu — NIČ
//    trdo kodiranih);
//  • tabela audit vrstic (ENA vrstica = ENO območje — ISTA ravnina kot CSV):
//    Območje · Razred (prikazno, bold navy) · Implementacije (pipe-joined)
//    · Dokazi (testi) (pipe-joined) · Opomba (verbatim, linebreak);
//  • sklepna vrstica: Sklep (pregled.sklep VERBATIM, zavita prek
//    splitTextToSize — vsebina verbatim, samo vizualni prelom) + Vir
//    (AUDIT_VIR_NIZ) — ISTA meta resnica kot CSV brat.
//
// Determinizem (kanon 46./47. člen — 'isti HEAD = bajtno identična
// datoteka'): vsebina NE nosi časa (brez časovnih žigov v vsebini — čas bi
// uničil determinizem); format PDF pa ZAHTEVA CreationDate metadata →
// KANONSKI fiksni žig AUDIT_PDF_ZIG_FIKSNI (formatna lastnost, NIČ
// podatkovne resnice) kot privzeti `now` (parametriziran SAMO za teste —
// produkcija kliče brez argumenta; LEKCIJA R317 4: undefined sproži
// privzeti parameter, zato fail-closed testi z null); fileId = čista JS
// FNV-1a nad kanonizirano serijalizacijo pregleda (pregled je kanon
// f(audita) — vrstni red vrstic = vrstni red audita) z LASTNIMI soli
// 0xc1–0xc4 (register: 0xb9–0xbc konflikti R302, 0xb0–0xc0 zasedeni —
// ista semena v dveh libih NE smejo dati isti ID).
//
// Fail-closed: ne-polje / prazen audit / pokvaren now / notranja
// neskladja zip → TypeError z imenom graditelja (kanon R299/R302/R306 —
// niz preživi minifikacijo, identifikatorji ne). Pokvaren audit ne more
// postati lažno poročilo — validacija gre PREK pregleda (EN VIR).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import {
  avtomatizacijaPregled,
  AUDIT_CSV_GLAVE,
  AUDIT_VIR_NIZ,
} from './avtomatizacija-pregled'
import type { VrstaAudita } from './avtomatizacija-audit'
import { AVTOMATIZACIJA_AUDIT } from './avtomatizacija-audit'

// ---------- barve (ISTI dokumenti družina — usklajeno z R302 konflikti) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const RED: [number, number, number] = [220, 38, 38] // zaloga-pdf R120 red (iskren alarm)
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

/** Kanonski fiksni žig CreationDate (determinizem — kanon 46./47. člen).
 *  Format PDF zahteva CreationDate; vsebina NE nosi časa. NIČ podatkovne
 *  resnice — samo formatna lastnost dokumenta. */
export const AUDIT_PDF_ZIG_FIKSNI = new Date(Date.UTC(2026, 0, 1, 0, 0, 0))

export interface AvtomatizacijaAuditPdfOptions {
  /** Formatni žig CreationDate — PRIVZETO kanonski fiksni žig (determinizem:
   *  produkcija kliče brez argumenta = isti HEAD → bajtno identičen PDF).
   *  Parametriziran SAMO za teste (kanon pregled). */
  now?: Date
}

/** Determinističen file-ID (32 hex) — čista JS FNV-1a; LASTNI soli 0xc1–0xc4. */
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
    fnv1aHex(seed, 0xc1) +
    fnv1aHex(seed, 0xc2) +
    fnv1aHex(seed, 0xc3) +
    fnv1aHex(seed, 0xc4)
  )
}

/** Kanoniziran seed pregleda — pregled je kanon f(audita) (ISTI vrstni red
 *  vrstic kot audit), serijalizacija = določevalna funkcija vsebine. */
function pregledSeed(
  vrstice: readonly { obmocje: string; razredPrikazno: string; stImplementacij: number; stDokazov: number }[],
): string {
  return `O:${vrstice
    .map((v) => `${v.obmocje}#${v.razredPrikazno}@${v.stImplementacij}+${v.stDokazov}`)
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

/** KPI polje — ISTI vzorec kot konflikti/dobičkonost/koledar (družinski kpiBox). */
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

/** Zgradi AVTOMATIZACIJSKI AUDIT dokument (brez shranjevanja) — vrne jsPDF
 *  instanco (testi berejo doc.output('arraybuffer') → bajtni dokazi).
 *  Privzeti vhod = EN VIR (parametriziran SAMO za teste fail-closed poti —
 *  produkcija vedno kliče brez argumenta; null NE undefined — lekcija R317 4). */
export function buildAvtomatizacijaAuditPdfDoc(
  audit: readonly VrstaAudita[] = AVTOMATIZACIJA_AUDIT,
  options: AvtomatizacijaAuditPdfOptions = {},
): jsPDF {
  if (!Array.isArray(audit)) {
    throw new TypeError('buildAvtomatizacijaAuditPdfDoc: pričakovan audit (seznam vrstic)')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildAvtomatizacijaAuditPdfDoc: pričakovane opcije (AvtomatizacijaAuditPdfOptions)')
  }
  const now = options.now ?? AUDIT_PDF_ZIG_FIKSNI
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildAvtomatizacijaAuditPdfDoc: pričakovan veljaven now: Date')
  }
  // Validacija + WYSIWYG preslikava prek EN VIR graditelja (fail-closed
  // brezplačno — ISTA strogost kot na zaslonu, NIČ podvojenih pravil).
  const pregled = avtomatizacijaPregled(audit)
  // Zip po indeksu z IZRECNO usklajenostno asercijo (vzorec CSV brata R317).
  if (pregled.vrstice.length !== audit.length) {
    throw new TypeError(
      'buildAvtomatizacijaAuditPdfDoc: notranja neskladja dolžin (pregled vs audit) — fail-closed',
    )
  }
  const vrstice = pregled.vrstice
  for (let i = 0; i < audit.length; i++) {
    const v = audit[i]
    const p = vrstice[i]
    if (!p || !v || p.obmocje !== v.obmocje) {
      throw new TypeError(
        `buildAvtomatizacijaAuditPdfDoc: vrstica ${i} ni usklajena z auditom (${String(v?.obmocje)}) — fail-closed`,
      )
    }
  }

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / konflikti R302) ----------
  doc.setCreationDate(now)
  doc.setFileId(deterministichenId(`${now.toISOString()}|${pregledSeed(vrstice)}`))

  // ---------- glava (ISTI vzorec kot konflikti/dobičkonost) ----------
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
  doc.text('AVTOMATIZACIJSKI AUDIT', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text('deterministični izvoz — EN VIR resnica', 196, 19, { align: 'right' })

  // ---------- KPI povzetek (številke IZRAČUNANE iz pregled.poRazredu — NIČ trdo) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Povzetek po razredih')
  const bw = 44
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Območij', String(pregled.stObmocij), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'DETERMINISTIČNO', String(pregled.poRazredu.DETERMINISTICNO), NAVY)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'AI-OPCIJSKO', String(pregled.poRazredu.AI_OPCIJSKO), AMBER)
  kpiBox(
    doc,
    14 + 3 * (bw + gap),
    y,
    bw,
    bh,
    'AI-OBVEZNO',
    String(pregled.poRazredu.AI_ZAHTEVANO),
    pregled.poRazredu.AI_ZAHTEVANO > 0 ? RED : NAVY,
  )
  y += bh + 8

  // ---------- tabela audit vrstic (ENA vrstica = ENO območje — ISTA ravnina kot CSV R317) ----------
  y = sectionTitle(doc, y, `Audit po območjih (§1–§11 — ${pregled.stObmocij})`)
  autoTable(doc, {
    startY: y,
    head: [[...AUDIT_CSV_GLAVE]],
    body: audit.map((v, i) => [
      vrstice[i].obmocje,
      vrstice[i].razredPrikazno,
      v.implementacija.join(' | '),
      v.dokaz.join(' | '),
      vrstice[i].opomba,
    ]),
    styles: { fontSize: 6.3, cellPadding: 1.2, font: 'Roboto', overflow: 'linebreak' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 6.3 },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 36 },
      3: { cellWidth: 34 },
      4: { cellWidth: 52 },
    },
    didParseCell: (data) => {
      // WYSIWYG: razred (stolpec 1) bold navy — ISTI signal kot značka na
      // zaslonu (AVT_AUDIT_ZNACKA) in prikazni niz v CSV bratu.
      if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.textColor = NAVY
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 6

  // ---------- sklepna vrstica (EN VIR sklep + vir niz — ISTO besedilo kot zaslon + CSV meta) ----------
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
  y += 4 + (sklepVrstice.length - 1) * 4.2
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  const virVrstice = doc.splitTextToSize(`Vir: ${AUDIT_VIR_NIZ}`, 182) as string[]
  doc.text(virVrstice, 14, y + 5)

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
    doc.text('Avtomatizacijski audit · Roksal Field Manager v2.5', 14, 289)
    doc.text(`Stran ${i}/${strani}`, 196, 289, { align: 'right' })
  }

  return doc
}

/** Deterministično ime datoteke (brez datuma — veza na HEAD je implicitna;
 *  vzorec avtomatizacija-audit.csv, 47. člen). */
export function avtomatizacijaAuditPdfFilename(): string {
  return 'avtomatizacija-audit.pdf'
}

/** Zgeneriraj AVTOMATIZACIJSKI AUDIT PDF (determinističen — isti HEAD =
 *  bajtno identičen dokument) in ga shrani kot `avtomatizacija-audit.pdf`. */
export function generateAvtomatizacijaAuditPdf(): void {
  const doc = buildAvtomatizacijaAuditPdfDoc()
  doc.save(avtomatizacijaAuditPdfFilename())
}
