// ---------------------------------------------------------------------------
// R250 (P1-f/g, 'izvozi' družina — 7. člen) — PRIHODKI PDF poročilo iz
// Finance → Računi (crm-tab → InvoiceManager). Vzorec cenik-pdf R244 /
// primerjalni-cenik-pdf R245: ROKSAL glava, KPI, autoTable, noge, bajtni
// determinizem.
//
// LOČEN dokument od R136 racuni-CSV (ta ostaja NESPREMENJEN — vrstični
// pregled za Excel) in od per-račun FURS PDF (R136/obvezna oblika): prihodki
// poročilo je AGREGATNA resnica za vodstvo — KPI (izdano/plačano/zapadlo) +
// tabela stanj + iskren sklep. ENA resnica z zaslonom (WYSIWYG — brat iz
// ISTEGA vira):
//  • vir podatkov = GET /api/invoices (odgovor, ki ga InvoiceManager že
//    izriše) — route NIČ (client+lib only — izvoz je potrošnik obstoječe
//    resnice);
//  • agregati = TOČNO ISTA izpeljava kot summary izpeljanka v
//    invoice-manager (izdano = IZDAN+PLACAN, plačano = PLACAN, zapadlo =
//    IZDAN prek roka; zapadlaDni vzorec, Date.now() → now KOT PARAMETER —
//    determinizem, vzorec R203/R244); stornirani + osnutki = števci
//    (iskrena resnica — stornirani se NE skrivajo, izključeni so iz zneskov
//    in poimenovani v sklepu);
//  • sort = ŠTEVILKA ASC (računovodski red, '2026-001' < '2026-002'; navadno
//    < primerjanje po UTF-16 kodnih točkah — localeCompare NE, vzorec R245)
//    in sortira interno pred vsotami — FP seštevanje je odvisno od vrstnega
//    reda, rezultat je f(MNOŽICA), ne f(vrstni red odgovora) (vzorec
//    povprecniRazpon R248);
//  • bralni dokument — brez pravice gate (P1-k precedens: odjemalski/
//    bralni dokumenti ostanejo vidni; vsi, ki vidijo Račune, nosijo
//    invoices.read).
//
// Načela (družinska pravila — ISTA kot cenik-pdf R244):
//  • Fail-closed: pokvaren vnos → TypeError (stevilka/kupec/projekt ne-prazna
//    niza, tip/status iz množic, ISO datumi, rokPlacilaDni celo število ≥ 0,
//    zneski končno ne-negativni — indeks krivca v sporočilu). INKONZISTENCA
//    statusa → TypeError: PLACAN brez placanoAt ALI placanoAt na ne-PLACAN
//    (API to zagotavlja — odklon = pokvarjen vir, NIKOLI tiho spregledan).
//    PRAZEN SEZNAM ne nastaja dokumenta (družina: ni prazne datoteke;
//    komponenta pokaže iskren toast).
//  • Determinizem: `now` pride KOT parameter; doc.setCreationDate(now) +
//    doc.setFileId(FNV-1a) — enak vhod = bajtno enak PDF (document-pdf R121
//    100× pravilo). Bajtni razred je odvisen tudi od GLIFOV generacijske
//    ure (R249 doktrina 'glifni razred minute' — številka 7 pride samo iz
//    ure, če je ni v podatkih).
//  • CLIENT-safe: čista JS FNV-1a (node:crypto NE sme v client bundle —
//    lekcija R234); LASTNI soli **0x61–0x64** (register: zaloga 0x01–04,
//    naročilnica 0x11–14, dobavitelji 0x21–24, osnutek 0x31–34, cenik
//    0x41–44, primerjalni 0x51–54, prihodki 0x61–64 — ista semena v dveh
//    libih NE smejo dati isti ID).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { todayStamp } from './csv-export'
import { zalogaPovzetekCasOznaka } from './zaloga-povzetek'
import { cenikDatumIso } from './cenik-pdf'

// ---------- barve (ISTI dokumenti družina — usklajeno s cenik/zaloga) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const GREEN: [number, number, number] = [22, 163, 74] // roksal-green
const RED: [number, number, number] = [220, 38, 38] // zaloga-pdf R120 red
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

const TIPI = ['PREDRACUN', 'RACUN', 'PREDPLACILNI'] as const
const STATUSI = ['OSNUTEK', 'IZDAN', 'PLACAN', 'STORNIRAN'] as const

const TIPI_SI: Record<(typeof TIPI)[number], string> = {
  PREDRACUN: 'Predračun',
  RACUN: 'Račun',
  PREDPLACILNI: 'Predplačilni',
}

const STATUSI_SI: Record<(typeof STATUSI)[number], string> = {
  OSNUTEK: 'Osnutek',
  IZDAN: 'Izdan',
  PLACAN: 'Plačan',
  STORNIRAN: 'Storniran',
}

/** Client-safe prerez ENE prihodkove vrstice (polje iz GET /api/invoices —
 *  ISTI odgovor, ki ga InvoiceManager izriše). ENA vrstica = EN račun. */
export interface PrihodkiPdfVnos {
  /** Račun 'YYYY-NNN' (unique v bazi — determinističen sort ključ). */
  stevilka: string
  tip: (typeof TIPI)[number]
  status: (typeof STATUSI)[number]
  /** ISO niz (YYYY-MM-DD…) — datum izdaje. */
  datumIzdaje: string
  /** Rok plačila v dnevih od izdaje (≥ 0). */
  rokPlacilaDni: number
  /** ISO niz ALI null — PLACAN MORA imeti, ne-PLACAN NE sme (inkonzistenca
   *  = pokvaren vir → TypeError, nikoli tiho spregledana). */
  placanoAt: string | null
  /** Za plačilo (EUR; končno ne-negativno). */
  znesek: number
  /** Snapshot kupca ob izdaji (ne-prazen niz). */
  kupec: string
  /** Projekt (ne-prazen niz — kontekst per račun). */
  projekt: string
}

export interface PrihodkiPdfOptions {
  /** Referenčni trenutek (žig + CreationDate + fileId + ime + ZAPADLOST) —
   *  KOT PARAMETER (determinizem; vzorec R203/R244; Date.now() v UI
   *  zapadlaDni ima tu svoj determinističen dvojnik). */
  now: Date
}

/** Fail-closed preverba prihodkove vrstice (obvezna polja + statusna
 *  inkonzistenca; indeks krivca je VEDNO v sporočilu — družina R236/R244). */
export function preveriPrihodkiVnos(p: PrihodkiPdfVnos, i: number): void {
  if (!p || typeof p !== 'object') {
    throw new TypeError(`preveriPrihodkiVnos (${i}): pričakovana prihodkova vrstica (PrihodkiPdfVnos)`)
  }
  for (const [k, v] of [
    ['stevilka', p.stevilka],
    ['kupec', p.kupec],
    ['projekt', p.projekt],
  ] as const) {
    if (typeof v !== 'string' || v.trim() === '') {
      throw new TypeError(`preveriPrihodkiVnos (${i}): ${k} mora biti ne-prazen niz, ne ${String(v)}`)
    }
  }
  if (!(TIPI as readonly string[]).includes(p.tip)) {
    throw new TypeError(`preveriPrihodkiVnos (${i}): tip mora biti eden iz ${TIPI.join('/')}, ne ${String(p.tip)}`)
  }
  if (!(STATUSI as readonly string[]).includes(p.status)) {
    throw new TypeError(`preveriPrihodkiVnos (${i}): status mora biti eden iz ${STATUSI.join('/')}, ne ${String(p.status)}`)
  }
  if (typeof p.datumIzdaje !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(p.datumIzdaje)) {
    throw new TypeError(`preveriPrihodkiVnos (${i}): datumIzdaje mora biti ISO niz YYYY-MM-DD…, ne ${String(p.datumIzdaje)}`)
  }
  if (
    p.placanoAt !== null &&
    (typeof p.placanoAt !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(p.placanoAt))
  ) {
    throw new TypeError(`preveriPrihodkiVnos (${i}): placanoAt mora biti ISO niz YYYY-MM-DD… ali null, ne ${String(p.placanoAt)}`)
  }
  if (p.status === 'PLACAN' && p.placanoAt === null) {
    throw new TypeError(`preveriPrihodkiVnos (${i}): PLACAN brez placanoAt je inkonzistenca — datum plačila NIKOLI izmišljen`)
  }
  if (p.status !== 'PLACAN' && p.placanoAt !== null) {
    throw new TypeError(`preveriPrihodkiVnos (${i}): placanoAt na statusu ${p.status} je inkonzistenca (plačilo se beleži samo na PLACAN)`)
  }
  if (typeof p.rokPlacilaDni !== 'number' || !Number.isInteger(p.rokPlacilaDni) || p.rokPlacilaDni < 0) {
    throw new TypeError(`preveriPrihodkiVnos (${i}): rokPlacilaDni mora biti celo število ≥ 0, ne ${String(p.rokPlacilaDni)}`)
  }
  for (const [k, v] of [
    ['znesek', p.znesek],
  ] as const) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new TypeError(`preveriPrihodkiVnos (${i}): ${k} mora biti končno ne-negativno število, ne ${String(v)}`)
    }
  }
}

/** Determinističen file-ID (32 hex) iz semena — čista JS FNV-1a (CLIENT-safe;
 *  LASTNI soli 0x61–0x64: vsak PDF lib družine ima svoje — ista semena v
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
    fnv1aHex(seed, 0x61) +
    fnv1aHex(seed, 0x62) +
    fnv1aHex(seed, 0x63) +
    fnv1aHex(seed, 0x64)
  )
}

/** Znesek kot stabilen niz — točkovna dela na 2 decimalni mesti (ISTI vzorec
 *  kot cenaNiz cenik-pdf R244 — String(1499.99) = '1499.99' je že v redu, a
 *  String(9.1) = '9.1' bi izgledal drugače kot '9.10'; tabela ostane
 *  računovodsko berljiva). */
function znesekNiz(z: number): string {
  return z.toFixed(2)
}

/** Sort vrstic V LIBU — ŠTEVILKA ASC (računovodski red; navadno < primerjanje
 *  po UTF-16 kodnih točkah — localeCompare NE, locale odvisen). IZVOŽEN —
 *  determinizem = f(MNOŽICA vhodov), ne f(vrstni red odgovora). */
export function sortirajPrihodki(vnosi: readonly PrihodkiPdfVnos[]): PrihodkiPdfVnos[] {
  return [...vnosi].sort((a, b) => {
    if (a.stevilka !== b.stevilka) return a.stevilka < b.stevilka ? -1 : 1
    return 0
  })
}

/** Dnevi zapadlosti IZDANEGA računa glede na `now` — TOČNO ISTI vzorec kot
 *  zapadlaDni v invoice-manager (IZDAN only; due = izdaja + rok dni;
 *  diff = floor((now − due) / 86400000); > 0 → dni, sicer null). Razlika:
 *  Date.now() → now KOT PARAMETER (determinizem). STORNIRAN/PLACAN/OSNUTEK
 *  NIKOLI zapadl (plačan ni zapadl, storniran ne obstaja več). */
export function zapadlaDniVnos(
  p: Pick<PrihodkiPdfVnos, 'datumIzdaje' | 'rokPlacilaDni' | 'status'>,
  now: Date,
): number | null {
  if (p.status !== 'IZDAN') return null
  const due = new Date(p.datumIzdaje)
  due.setDate(due.getDate() + p.rokPlacilaDni)
  const diff = Math.floor((now.getTime() - due.getTime()) / 86400000)
  return diff > 0 ? diff : null
}

export interface PrihodkiPovzetek {
  /** Σ znesek IZDAN + PLACAN (ISTO kot UI 'izdano'). */
  izdano: number
  /** max(0, izdano − plačano) — ISTO kot UI 'Odprto' box (max(0,·) vzorec
   *  vzame iz invoice-manager; FP varnost: zneski ≥ 0 preverjeni). */
  odprto: number
  /** Σ znesek PLACAN (ISTO kot UI 'plačano'). */
  placano: number
  /** Σ znesek IZDAN prek roka (ISTO kot UI 'zapadlo'). */
  zapadlo: number
  /** Št. IZDAN prek roka. */
  zapadloN: number
  /** Št. OSNUTEK. */
  osnutki: number
  /** Št. STORNIRAN (iskrena resnica — izključeni iz zneskov, poimenovani). */
  stornirani: number
  /** Št. vseh vrstic (= sortirane.length). */
  vseh: number
}

/** Agregatna izpeljava prihodkov — ENA resnica za PDF KPI, sklep IN toast
 *  (WYSIWYG; ISTI vzorec kot summary izpeljanka invoice-manager). Sortira
 *  interno (sortirajPrihodki) pred seštevanjem — FP seštevanje je odvisno
 *  od vrstnega reda; rezultat je f(MNOŽICA), ne f(vrstni red odgovora)
 *  (ISTI vzorec kot povprecniRazpon R248). */
export function prihodkiPovzetek(vnosi: readonly PrihodkiPdfVnos[], now: Date): PrihodkiPovzetek {
  const sortirane = sortirajPrihodki(vnosi)
  const povzetek: PrihodkiPovzetek = {
    izdano: 0,
    odprto: 0,
    placano: 0,
    zapadlo: 0,
    zapadloN: 0,
    osnutki: 0,
    stornirani: 0,
    vseh: sortirane.length,
  }
  for (const p of sortirane) {
    if (p.status === 'IZDAN' || p.status === 'PLACAN') {
      povzetek.izdano += p.znesek
    }
    if (p.status === 'PLACAN') {
      povzetek.placano += p.znesek
      // FP varnost: znesek je preverjen (končen, ≥ 0) — vsota ostane končna.
    }
    if (p.status === 'OSNUTEK') povzetek.osnutki += 1
    if (p.status === 'STORNIRAN') povzetek.stornirani += 1
    const dni = zapadlaDniVnos(p, now)
    if (dni !== null) {
      povzetek.zapadlo += p.znesek
      povzetek.zapadloN += 1
    }
  }
  // ISTO kot UI 'Odprto' box: max(0, izdano − plačano) — FP podtek od dveh
  // preverjenih vsot je brez pomena (zneski ≥ 0), max(0,·) je VEDNO resnica.
  povzetek.odprto = Math.max(0, povzetek.izdano - povzetek.placano)
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

/** KPI polje — ISTI vzorec kot zaloga-pdf/naročilnica/dobavitelji/cenik/primerjalni. */
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

/** Zgradi PRIHODKI dokument (brez shranjevanja) — vrne jsPDF instanco (testi
 *  berejo doc.output('arraybuffer') → bajtni dokazi). */
export function buildPrihodkiPdfDoc(
  vnosi: readonly PrihodkiPdfVnos[],
  options: PrihodkiPdfOptions,
): jsPDF {
  if (!Array.isArray(vnosi)) {
    throw new TypeError('buildPrihodkiPdfDoc: pričakovano polje prihodkovih vrstic (PrihodkiPdfVnos[])')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildPrihodkiPdfDoc: pričakovane opcije (PrihodkiPdfOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildPrihodkiPdfDoc: pričakovan veljaven now: Date')
  }
  // PRAZEN SEZNAM ne nastaja dokumenta (družina: ni prazne datoteke —
  // komponenta pokaže iskren toast 'Ni računov za prihodke.').
  if (vnosi.length === 0) {
    throw new TypeError(
      'buildPrihodkiPdfDoc: prazen seznam ne nastaja dokumenta — komponenta pokaže iskren toast (Ni računov za prihodke.)',
    )
  }
  vnosi.forEach((p, i) => preveriPrihodkiVnos(p, i))
  const sortirane = sortirajPrihodki(vnosi)
  const pov = prihodkiPovzetek(sortirane, now)

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / cenik R244) ----------
  doc.setCreationDate(now)
  doc.setFileId(
    deterministichenId(
      `${now.toISOString()}|${sortirane
        .map((p) => `${p.stevilka.trim()}/${p.status}/${znesekNiz(p.znesek)}${p.placanoAt ? '/P' : ''}`)
        .join(',')}`,
    ),
  )

  // ---------- glava (ISTI vzorec kot boss-report/zaloga/cenik/primerjalni) ----------
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
  doc.text('PRIHODKI', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })

  // ---------- KPI povzetek (izračun iz vrstic — notranja skladnost) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Povzetek prihodkov')
  // 5 polj → ožji box (33 mm) v ISTI vrsti (5×33 + 4×4 = 181 ≤ 182) — ISTI
  // layout kot primerjalni R246. Signal barve = ISTI jezik kot stanja na
  // zaslonu (Plačano zelen, Odprto amber, Zapadlo rdeče — ISTI trikot kot
  // Povzetek boxi invoice-manager; osnutek sivo).
  const bw = 33
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Računov', String(pov.vseh), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Plačano', `${znesekNiz(pov.placano)} €`, GREEN)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Odprto', `${znesekNiz(pov.odprto)} €`, pov.odprto > 0 ? AMBER : NAVY)
  kpiBox(doc, 14 + 3 * (bw + gap), y, bw, bh, 'Zapadlo', `${znesekNiz(pov.zapadlo)} €`, pov.zapadlo > 0 ? RED : NAVY)
  kpiBox(doc, 14 + 4 * (bw + gap), y, bw, bh, 'Osnutki', String(pov.osnutki), GRAY)
  y += bh + 8

  // ---------- tabela stanj (ŠTEVILKA ASC — računovodski red) ----------
  y = sectionTitle(doc, y, `Računi (${sortirane.length})`)
  autoTable(doc, {
    startY: y,
    head: [['Številka', 'Tip', 'Izdano', 'Rok', 'Kupec', 'Projekt', 'Status', 'Znesek (EUR)']],
    body: sortirane.map((p) => {
      const dni = zapadlaDniVnos(p, now)
      // Rok = ISTI vzorec kot rokPlacilaDatum v invoice-manager (setDate na
      // lokalni izdaji — WYSIWYG z istim brskalnikom; ±1 dan ob polnoči je
      // dokumentiran glifni razred, determinizem znotraj TZ je točen).
      const rok = new Date(p.datumIzdaje)
      rok.setDate(rok.getDate() + p.rokPlacilaDni)
      return [
        p.stevilka.trim(),
        TIPI_SI[p.tip],
        cenikDatumIso(p.datumIzdaje),
        cenikDatumIso(rok.toISOString()),
        p.kupec.trim(),
        p.projekt.trim(),
        STATUSI_SI[p.status] + (dni !== null ? ` (${dni} dni)` : ''),
        znesekNiz(p.znesek),
      ]
    }),
    styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 22 },
      2: { cellWidth: 18, halign: 'right' },
      3: { cellWidth: 18, halign: 'right' },
      7: { halign: 'right' },
    },
    didParseCell: (data) => {
      // WYSIWYG z zaslonom: plačan zeleno bold (ISTI pomen zelene resnice kot
      // v ceniku R244); zapadl znesek rdeče bold (ISTI signal kot R120 nizka
      // zaloga — denar, ki ga manka); storniran sivo (iskrena resnica — viden,
      // utišan); izdan-neplačan znesek ostane navy (resnica brez signala).
      if (data.section === 'body' && data.column.index === 7) {
        const v = String(data.cell.raw ?? '')
        const n = Number(v)
        const status = String(data.row.raw?.[6] ?? '')
        if (status === 'Plačan') {
          data.cell.styles.textColor = GREEN
          data.cell.styles.fontStyle = 'bold'
        } else if (status.includes('dni') && Number.isFinite(n) && n > 0) {
          data.cell.styles.textColor = RED
          data.cell.styles.fontStyle = 'bold'
        } else if (status === 'Storniran') {
          data.cell.styles.textColor = GRAY
        }
      }
      if (data.section === 'body' && data.column.index === 6) {
        const status = String(data.cell.raw ?? '')
        if (status === 'Plačan') {
          data.cell.styles.textColor = GREEN
          data.cell.styles.fontStyle = 'bold'
        } else if (status === 'Storniran') {
          data.cell.styles.textColor = GRAY
        }
      }
    },
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 6

  // ---------- sklepna vrstica (ISTA sklanjatev družine + iskren podpis) ----------
  if (y > 255) {
    doc.addPage()
    y = 20
  }
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text(
    `${pov.vseh} računov · izdano skupaj ${znesekNiz(pov.izdano)} EUR · odprto ${znesekNiz(pov.odprto)} EUR · plačano ${znesekNiz(pov.placano)} EUR · zapadlo ${znesekNiz(pov.zapadlo)} EUR (${pov.zapadloN} računov prek roka) · storniranih ${pov.stornirani} (izključeni iz zneskov) · osnutkov ${pov.osnutki}.`,
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

/** Ime datoteke prihodkov — `Prihodki-YYYY-MM-DD.pdf` (ISTI vzorec kot
 *  cenikPdfFilename R244; EN now za žig IN ime — lekcija R121/R235). */
export function prihodkiPdfFilename(now: Date): string {
  return `Prihodki-${todayStamp(now)}.pdf`
}

/** Zgeneriraj Prihodki PDF (determinističen — enak vhod = bajtno enak
 *  dokument) in ga shrani kot `Prihodki-YYYY-MM-DD.pdf`. */
export function generatePrihodkiPdf(
  vnosi: readonly PrihodkiPdfVnos[],
  options: PrihodkiPdfOptions,
): void {
  const doc = buildPrihodkiPdfDoc(vnosi, options)
  doc.save(prihodkiPdfFilename(options.now))
}
