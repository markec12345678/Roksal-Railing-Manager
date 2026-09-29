// ---------------------------------------------------------------------------
// R267 (P1-f, 'izvozi' družina — 23. člen) — PONUDBE — SPOMNIŠKI PREGLED PDF iz
// CRM taba (kartica Ponudbe — sledenje, quote-followup.tsx). Vzorec
// oprema-cikel-pdf R266 / projekti-termini-pdf R265: ROKSAL glava, KPI 5,
// autoTable, sklep, noge, bajtni determinizem.
//
// EN VIR RESNICE (route NIČ — client+lib only):
//  • /api/projects — FRESH fetch VSEH projektov ISTEGA endpointa ob kliku
//    (R244/R245/R264/R265/R266 precedens: FRESH-podatki ob kliku, nič
//    state-a, nič nove mreže) — DOKUMENT = POLNA resnica: VSE ponudbe,
//    TUDI podpisane (dealLocked) — viden seznam kartice je samo odprte
//    (!dealLocked), PDF je referenčni pregled cevi ponudb: akcijska cona
//    (odprte — najstarejši spomnik prvi) + zgodovinska cona (podpisane);
//    vir NOSI celotno ponudbeno resnico: status, spomnik (followUpDate +
//    opomba), montaža, stranka, podpisna zastavica;
//  • STATUSI EN VIR = PONUDBE_STATUS_LABELS iz ponudbe-csv.ts (R161 —
//    IMPORT, NI zasegane kopije; R263 precedens CRM_STATUS_LABELS) — neznan
//    status = pokvaren vir → TypeError z indeksom krivca; prevajalnik +
//    testi zagotavljajo pokritost vseh 4 znanih;
//  • STANJE SPOMNIKA EN VIR = stanjeSpomnika iz ponudbe-csv.ts (R161 —
//    dnevna ravni: Zapadel < danes / Danes / Kmalu 1–3 dni / Planirano > 3
//    dni / Brez spomnika — čisto stringovna primerjava, 100 %
//    deterministično neodvisno od TZ; ISTA funkcija poganja CSV izvoz IN
//    barvne značke kartice — PDF ne more odstopati od zaslona);
//  • SKLANJATEV EN VIR = ponudbeLabel iz ponudbe-csv.ts (R161 — toast IN
//    aria; 1 ponudba / 2 ponudbi / 3-4 ponudbe / 5+ ponudb);
//  • resnica vloge: /api/projects vrne projekty po vlogi (MONTER svoje,
//    vodstvo vse) — dokument je resnica IZVORA, ne izmišljen portfelj;
//    vir poimenoval v sklepu.
//
// ENA RESNICA (WYSIWYG):
//  • ISTA izpeljava ponudbeSpomnikiPregled poganja PDF KPI, tabelo, sklep IN
//    toast — ENA izpeljava (klicatelj jo požene ENKRAT in podaja ISTO
//    resnico naprej, R263/R266 vzorec); mini-vrstica na kartici (state) =
//    ISTA izpeljava čez ISTI prune — dve okni (state vs FRESH fetch), ENA
//    matemtika (state = kar uporabnik vidi; FRESH = polna resnica — obe
//    poimenovani po viru).
//
// Načela (družinska pravila):
//  • Fail-closed: pokvaren vnos → TypeError z indeksom krivca (status 4
//    znanih, dealLocked točno boolean, ISO nizi ALI null, ne-prazne
//    identitete, podvojen id = pokvaren vir). PRAZEN SEZNAM ponudb ne
//    nastaja dokumenta (družina: ni prazne datoteke; komponenta pokaže
//    iskren toast 'Ni vpisanih ponudb.').
//  • Determinizem: `now` KOT parameter; doc.setCreationDate(now) +
//    doc.setFileId(FNV-1a) — enak vhod = bajtno enak PDF (document-pdf R121).
//  • CLIENT-safe: čista JS FNV-1a; LASTNI soli **0x99–0x9c** (register:
//    … oprema-cikel 0x95–0x98 → ponudbe-spomniki 0x99–0x9c — ista semena v
//    dveh libih NE smejo dati isti ID).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { todayStamp } from './csv-export'
import { zalogaPovzetekCasOznaka } from './zaloga-povzetek'
import { cenikDatumIso } from './cenik-pdf'
import { PONUDBE_STATUS_LABELS, ponudbeLabel, stanjeSpomnika, type PonudbaStatus } from './ponudbe-csv'

// ---------- barve (ISTI dokumenti družina — 0 novih hex) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const GREEN: [number, number, number] = [22, 163, 74] // roksal-green
const RED: [number, number, number] = [220, 38, 38] // zaloga-pdf R120 red
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

/** Znana stanja spomnika (EN VIR stanjeSpomnika R161) — akcijski red:
 *  Zapadel (RED, akcija) → Danes (NAVY, akcija) → Kmalu (AMBER) →
 *  Planirano (normalno) → Brez spomnika (sivo — iskren odpad). */
const STANJA = ['Zapadel', 'Danes', 'Kmalu', 'Planirano', 'Brez spomnika'] as const
export type PonudbaStanje = (typeof STANJA)[number]

/** Client-safe prerez ENE ponudbe (podmnožica GET /api/projects DTO).
 *  Status/status zastavice prihajajo VERBATIM (preverja lib fail-closed). */
export interface PonudbaSpomnikiVnos {
  /** ID projekta/ponudbe (ne-prazen — identiteta/izenačba, podvojen =
   *  pokvaren vir). */
  id: string
  /** Naziv projekta (ne-prazen — prikazna resnica). */
  nazivProjekta: string
  /** Stranka ALI null (customer?.ime — '—' na listu, iskren odpad). */
  stranka: string | null
  /** Status VERBATIM iz API-ja — eden izmed 4 znanih (neznan → TypeError). */
  status: PonudbaStatus
  /** Podpisna zastavica (dealLocked — točno boolean; pokvaren vir →
   *  TypeError). true = zgodovinska cona, false = akcijska cona. */
  dealLocked: boolean
  /** ISO niz spomnika (followUpDate) ALI null (brez spomnika — iskreno). */
  followUpDate: string | null
  /** Opomba spomnika ALI null (verbatim — CSV R161 pariteta: brez logike). */
  followUpOpomba: string | null
  /** ISO niz montaže (datumMontaze) ALI null (čist podatek). */
  datumMontaze: string | null
}

export interface PonudbaSpomnikiPdfOptions {
  /** Referenčni trenutek (žig + CreationDate + fileId + ime + DANES za
   *  stanje spomnika) — KOT PARAMETER (determinizem; vzorec R203/R244–R266). */
  now: Date
}

/** Fail-closed preverba ENE ponudbe (indeks krivca VEDNO v sporočilu). */
export function preveriPonudboVnos(o: PonudbaSpomnikiVnos, i: number): void {
  if (!o || typeof o !== 'object') {
    throw new TypeError(`preveriPonudboVnos (${i}): pričakovana ponudba (PonudbaSpomnikiVnos)`)
  }
  if (typeof o.id !== 'string' || o.id.trim() === '') {
    throw new TypeError(`preveriPonudboVnos (${i}): id mora biti ne-prazen niz, ne ${String(o.id)}`)
  }
  if (typeof o.nazivProjekta !== 'string' || o.nazivProjekta.trim() === '') {
    throw new TypeError(`preveriPonudboVnos (${i}): nazivProjekta mora biti ne-prazen niz, ne ${String(o.nazivProjekta)}`)
  }
  if (o.stranka !== null && typeof o.stranka !== 'string') {
    throw new TypeError(`preveriPonudboVnos (${i}): stranka mora biti niz ALI null, ne ${String(o.stranka)}`)
  }
  if (
    typeof o.status !== 'string' ||
    !(Object.keys(PONUDBE_STATUS_LABELS) as string[]).includes(o.status)
  ) {
    throw new TypeError(
      `preveriPonudboVnos (${i}): status mora biti eden izmed 4 znanih (${Object.keys(PONUDBE_STATUS_LABELS).join('/')}), ne ${String(o.status)}`,
    )
  }
  if (typeof o.dealLocked !== 'boolean') {
    throw new TypeError(`preveriPonudboVnos (${i}): dealLocked mora biti boolean, ne ${String(o.dealLocked)}`)
  }
  for (const [ime, v] of [
    ['followUpDate', o.followUpDate],
    ['datumMontaze', o.datumMontaze],
  ] as const) {
    if (v !== null && (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v))) {
      throw new TypeError(`preveriPonudboVnos (${i}): ${ime} mora biti ISO niz YYYY-MM-DD… ALI null, ne ${String(v)}`)
    }
  }
  if (o.followUpOpomba !== null && typeof o.followUpOpomba !== 'string') {
    throw new TypeError(`preveriPonudboVnos (${i}): followUpOpomba mora biti niz ALI null, ne ${String(o.followUpOpomba)}`)
  }
}

/** Sklanjatev stanj za sklep (iskrene oznake — R161 jezik: stanja na dnevni
 *  ravni; akcije poimenovane). */
function stanjeSklep(stanje: PonudbaStanje): string {
  switch (stanje) {
    case 'Zapadel':
      return 'Zapadel spomnik (akcija)'
    case 'Danes':
      return 'spomnik danes (akcija)'
    case 'Kmalu':
      return 'kmalu (1–3 dni)'
    case 'Planirano':
      return 'planirano'
    case 'Brez spomnika':
      return 'brez spomnika (iskren odpad — akcija)'
  }
}

export interface PonudbaSpomnikiVrsta {
  /** ID (identiteta). */
  id: string
  /** Naziv projekta. */
  naziv: string
  /** Stranka ALI null ('—'). */
  stranka: string | null
  /** Status koda (EN VIR — 4 znani). */
  statusKoda: PonudbaStatus
  /** Status oznaka za dokument (PONUDBE_STATUS_LABELS R161). */
  status: string
  /** ISO spomnik ALI null. */
  spomnik: string | null
  /** Stanje spomnika (EN VIR stanjeSpomnika — 5 znanih). */
  stanje: PonudbaStanje
  /** Opomba ALI null ('—'). */
  opomba: string | null
  /** ISO montaža ALI null ('—'). */
  montaza: string | null
  /** Podpisana (dealLocked — zgodovinska cona). */
  podpisano: boolean
}

export interface PonudbaSpomnikiPovzetek {
  /** Št. ponudb (vsi iz /api/projects — POLNA resnica). */
  ponudb: number
  /** Št. odprtih (!dealLocked — akcijska cona). */
  odprtih: number
  /** Št. podpisanih (dealLocked — zgodovinska cona). */
  podpisanih: number
  /** Št. odprtih z zapadelim spomnikom (RED — akcija). */
  zapadelOprtih: number
  /** Št. odprtih s spomnikom danes (NAVY — akcija). */
  danesOprtih: number
  /** Št. odprtih s spomnikom kmalu 1–3 dni (AMBER). */
  kmaluOprtih: number
  /** Št. odprtih brez spomnika (AMBER — akcija: vsaka odprta ponudba dobi
   *  spomnik — R161 raziskava ServiceTrade/Jobber). */
  brezSpomnikaOprtih: number
  /** Per-status številci (vsi 4 znani — referenčna resnica). */
  nacrtovanih: number
  vTeku: number
  zakljucenih: number
  ustavljenih: number
}

/** Spomniški pregled ponudb — ENA resnica za KPI, tabelo, sklep, mini-vrstico
 *  IN toast (WYSIWYG). Fail-verbose preverba VSEH vnosov; podvojen id =
 *  pokvaren vir fail-closed. Vrstica = VSE ponudbe (tudi podpisane). */
export function ponudbeSpomnikiPregled(
  ponudbe: readonly PonudbaSpomnikiVnos[],
  now: Date,
): { vrste: PonudbaSpomnikiVrsta[]; povzetek: PonudbaSpomnikiPovzetek } {
  if (!Array.isArray(ponudbe)) {
    throw new TypeError('ponudbeSpomnikiPregled: pričakovano polje ponudb (PonudbaSpomnikiVnos[])')
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('ponudbeSpomnikiPregled: pričakovan veljaven now: Date')
  }
  if (ponudbe.length === 0) {
    throw new TypeError('ponudbeSpomnikiPregled: prazen seznam ponudb ne nastaja dokumenta — pregled se izvozi, ko je vpisana prva ponudba (fail-closed)')
  }
  ponudbe.forEach((o, i) => preveriPonudboVnos(o, i))

  // Podvojen id = pokvaren vir (dve vrstici za ISTO identiteto bi lažno
  // podvajali KPI in tabelo — fail-closed, NIKOLI tiho združevanje).
  const videni = new Set<string>()
  for (const o of ponudbe) {
    if (videni.has(o.id)) {
      throw new TypeError(`ponudbeSpomnikiPregled: podvojen id ponudbe ${o.id} (pokvaren vir — identiteta mora biti edinstvena)`)
    }
    videni.add(o.id)
  }

  const danesIso = todayStamp(now)
  const vrste: PonudbaSpomnikiVrsta[] = ponudbe.map((o) => ({
    id: o.id,
    naziv: o.nazivProjekta,
    stranka: o.stranka,
    statusKoda: o.status,
    status: PONUDBE_STATUS_LABELS[o.status],
    spomnik: o.followUpDate,
    stanje: stanjeSpomnika(o.followUpDate, danesIso) as PonudbaStanje,
    opomba: o.followUpOpomba,
    montaza: o.datumMontaze,
    podpisano: o.dealLocked,
  }))
  sortirajPonudbeSpomniki(vrste)

  const povzetek: PonudbaSpomnikiPovzetek = {
    ponudb: vrste.length,
    odprtih: vrste.filter((v) => !v.podpisano).length,
    podpisanih: vrste.filter((v) => v.podpisano).length,
    zapadelOprtih: vrste.filter((v) => !v.podpisano && v.stanje === 'Zapadel').length,
    danesOprtih: vrste.filter((v) => !v.podpisano && v.stanje === 'Danes').length,
    kmaluOprtih: vrste.filter((v) => !v.podpisano && v.stanje === 'Kmalu').length,
    brezSpomnikaOprtih: vrste.filter((v) => !v.podpisano && v.stanje === 'Brez spomnika').length,
    nacrtovanih: vrste.filter((v) => v.statusKoda === 'NACRTOVANO').length,
    vTeku: vrste.filter((v) => v.statusKoda === 'V_TEKU').length,
    zakljucenih: vrste.filter((v) => v.statusKoda === 'ZAKLJUCENO').length,
    ustavljenih: vrste.filter((v) => v.statusKoda === 'USTAVLJENO').length,
  }
  return { vrste, povzetek }
}

/** Sort V LIBU — akcijski red: (1) podpisano ASC (odprte = akcijska cona na
 *  vrhu, podpisane = zgodovinska cona na dnu), (2) spomnik ASC z null
 *  ZADNJI (najstarejši zapadel spomnik prvi — brez spomnika iskren konec),
 *  (3) naziv ASC (navadno < po UTF-16 kodnih točkah — brez locale), (4) id
 *  ASC (identiteta — istonaslovni = RAZLIČNI resnici, R260–R266 lekcija).
 *  IZVOŽEN — determinizem = f(MNOŽICA vhodov). Referenčni pregled, NE
 *  rangiranje. */
export function sortirajPonudbeSpomniki(vrste: PonudbaSpomnikiVrsta[]): PonudbaSpomnikiVrsta[] {
  return vrste.sort((a, b) => {
    if (a.podpisano !== b.podpisano) return a.podpisano ? 1 : -1
    const an = a.spomnik === null
    const bn = b.spomnik === null
    if (an !== bn) return an ? 1 : -1
    if (!an && !bn && a.spomnik !== b.spomnik) return a.spomnik! < b.spomnik! ? -1 : 1
    if (a.naziv !== b.naziv) return a.naziv < b.naziv ? -1 : 1
    if (a.id !== b.id) return a.id < b.id ? -1 : 1
    return 0
  })
}

/** Determinističen file-ID (32 hex) — čista JS FNV-1a; LASTNI soli 0x99–0x9c. */
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
    fnv1aHex(seed, 0x99) +
    fnv1aHex(seed, 0x9a) +
    fnv1aHex(seed, 0x9b) +
    fnv1aHex(seed, 0x9c)
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

/** KPI polje — ISTI vzorec kot prihodki/narocila/oprema-cikel družina. */
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

/** Zgradi PONUDBE — SPOMNIŠKI PREGLED dokument (brez shranjevanja) — vrne
 *  jsPDF instanco (testi berejo doc.output('arraybuffer') → bajtni dokazi). */
export function buildPonudbeSpomnikiPdfDoc(
  ponudbe: readonly PonudbaSpomnikiVnos[],
  options: PonudbaSpomnikiPdfOptions,
): jsPDF {
  if (!Array.isArray(ponudbe)) {
    throw new TypeError('buildPonudbeSpomnikiPdfDoc: pričakovano polje ponudb')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildPonudbeSpomnikiPdfDoc: pričakovane opcije (PonudbaSpomnikiPdfOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildPonudbeSpomnikiPdfDoc: pričakovan veljaven now: Date')
  }
  // PRAZEN SEZNAM ponudb ne nastaja dokumenta (družina: ni prazne datoteke —
  // komponenta pokaže iskren toast 'Ni vpisanih ponudb.').
  if (ponudbe.length === 0) {
    throw new TypeError(
      'buildPonudbeSpomnikiPdfDoc: prazen seznam ponudb ne nastaja dokumenta — komponenta pokaže iskren toast (Ni vpisanih ponudb.)',
    )
  }
  const { vrste, povzetek } = ponudbeSpomnikiPregled(ponudbe, now)

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / družina) ----------
  doc.setCreationDate(now)
  // Seed = f(MNOŽICA) — kanoniziran red (po id identitete), NIKOLI vrstni
  // red odgovora (R248/R262/R264/R265/R266 vzorec).
  const kanonPonudbe = [...ponudbe].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  doc.setFileId(
    deterministichenId(
      `${now.toISOString()}|P:${kanonPonudbe
        .map(
          (o) =>
            `${o.id}/${o.status}/${o.dealLocked ? 'p' : 'o'}/${o.followUpDate === null ? 'null' : o.followUpDate}/${o.datumMontaze === null ? 'null' : o.datumMontaze}`,
        )
        .join(',')}`,
    ),
  )

  // ---------- glava (ISTI vzorec kot prihodki/narocila/oprema-cikel) ----------
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
  doc.text('PONUDBE — SPOMNIŠKI PREGLED', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })

  // ---------- KPI 5 (signalni jezik: RED = akcija — zapadel spomnik;
  // NAVY = obseg/danes; AMBER = iskrena luknja — brez spomnika;
  // GREEN = podpisani) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Povzetek spomnikov ponudb')
  const bw = 33
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Ponudb', String(povzetek.ponudb), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Zapadel spomnik', String(povzetek.zapadelOprtih), povzetek.zapadelOprtih > 0 ? RED : GREEN)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Spomnik danes', String(povzetek.danesOprtih), NAVY)
  kpiBox(doc, 14 + 3 * (bw + gap), y, bw, bh, 'Podpisanih', String(povzetek.podpisanih), GREEN)
  kpiBox(doc, 14 + 4 * (bw + gap), y, bw, bh, 'Odprtih brez spomnika', String(povzetek.brezSpomnikaOprtih), povzetek.brezSpomnikaOprtih > 0 ? AMBER : GREEN)
  y += bh + 8

  // ---------- tabela ponudb (akcijski red: odprte najstarejši spomnik
  // prvi — podpisane zgodovina na dnu; VSE ponudbe, tudi podpisane) ----------
  y = sectionTitle(doc, y, `Ponudbe (${vrste.length})`)
  autoTable(doc, {
    startY: y,
    head: [['Projekt', 'Stranka', 'Status', 'Spomnik', 'Stanje', 'Opomba', 'Montaža', 'Podpis']],
    body: vrste.map((v) => [
      v.naziv,
      v.stranka ?? '—',
      v.status,
      v.spomnik !== null ? cenikDatumIso(v.spomnik) : '—',
      v.stanje,
      v.opomba ?? '—',
      v.montaza !== null ? cenikDatumIso(v.montaza) : '—',
      v.podpisano ? 'podpisano' : 'odprto',
    ]),
    styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
    columnStyles: { 7: { halign: 'right' } },
    didParseCell: (data) => {
      // WYSIWYG: zapadel spomnik RED bold (akcija); danes NAVY bold (akcija);
      // kmalu AMBER; brez spomnika sivo (iskren odpad — nič ne trdimo);
      // '—' sivo; podpisano GREEN.
      if (data.section !== 'body') return
      const v = vrste[data.row.index]
      if (!v) return
      const raw = String(data.cell.raw ?? '')
      if (data.column.index === 4) {
        if (v.stanje === 'Zapadel') {
          data.cell.styles.textColor = RED
          data.cell.styles.fontStyle = 'bold'
        } else if (v.stanje === 'Danes') {
          data.cell.styles.textColor = NAVY
          data.cell.styles.fontStyle = 'bold'
        } else if (v.stanje === 'Kmalu') {
          data.cell.styles.textColor = AMBER
        } else if (v.stanje === 'Brez spomnika') {
          data.cell.styles.textColor = GRAY
        }
      }
      if (data.column.index === 7 && v.podpisano) data.cell.styles.textColor = GREEN
      if ((data.column.index === 1 || data.column.index === 3 || data.column.index === 5 || data.column.index === 6) && raw === '—') {
        data.cell.styles.textColor = GRAY
      }
    },
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 6

  // ---------- sklepna vrstica (iskren podpis — cone + akcije poimenovane) ----------
  if (y > 255) {
    doc.addPage()
    y = 20
  }
  const stanjaSklep = STANJA.map((s) => `${stanjeSklep(s)} ${vrste.filter((v) => !v.podpisano && v.stanje === s).length}`).join(' · ')
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text(
    `${povzetek.ponudb} ${ponudbeLabel(povzetek.ponudb)} · odprtih ${povzetek.odprtih} (akcijska cona) · podpisanih ${povzetek.podpisanih} (zgodovinska cona) · odprte: ${stanjaSklep} · statusi: ${PONUDBE_STATUS_LABELS.NACRTOVANO} ${povzetek.nacrtovanih} / ${PONUDBE_STATUS_LABELS.V_TEKU} ${povzetek.vTeku} / ${PONUDBE_STATUS_LABELS.ZAKLJUCENO} ${povzetek.zakljucenih} / ${PONUDBE_STATUS_LABELS.USTAVLJENO} ${povzetek.ustavljenih} (referenčni pregled — VSE ponudbe, tudi podpisane) · vir = /api/projects (resnica vloge — polna resnica, ne samo viden seznam).`,
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

/** Ime datoteke — `Ponudbe-spomniki-YYYY-MM-DD.pdf` (družinski vzorec;
 *  deterministično glede na `now`; EN now za žig IN ime — lekcija R121/R235). */
export function ponudbeSpomnikiPdfFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('ponudbeSpomnikiPdfFilename: pričakovan veljaven now: Date')
  }
  return `Ponudbe-spomniki-${todayStamp(now)}.pdf`
}

/** Zgeneriraj PONUDBE — SPOMNIŠKI PREGLED PDF (determinističen — enak vhod =
 *  bajtno enak dokument) in ga shrani. */
export function generatePonudbeSpomnikiPdf(
  ponudbe: readonly PonudbaSpomnikiVnos[],
  options: PonudbaSpomnikiPdfOptions,
): void {
  const doc = buildPonudbeSpomnikiPdfDoc(ponudbe, options)
  doc.save(ponudbeSpomnikiPdfFilename(options.now))
}
