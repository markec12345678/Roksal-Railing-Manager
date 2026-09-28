// ---------------------------------------------------------------------------
// R258 (P1-f, 'izvozi' družina — 14. člen) — DOBIČKONOST PO PROJEKTIH PDF iz
// Vodjinega pregleda (vodja-dashboard). Vzorec prihodki-pdf R250 /
// narocila-pregled-pdf R257: ROKSAL glava, KPI, autoTable, noge, bajtni
// determinizem.
//
// PRESEK DVEH VIROV (route NIČ — client+lib only; vodja-dashboard ŽE fetcha
// oba: GET /api/invoices + GET /api/material-orders):
//  • prihodki = Σ znesek računov IZDAN + PLACAN (ISTA definicija 'izdano' kot
//    prihodki R250 / summary izpeljanka invoice-manager — STATUSI import iz
//    prihodki-pdf, EN VIR, nič dvojnega);
//  • stroški materiala = Σ skupajCena NE-preklicanih naročil (R257 vzorec —
//    preklic ni denarni tok; STATUSI_NAROCIL import iz narocila-pregled-pdf,
//    EN VIR);
//  • marža = prihodki − stroški (IZPELJANA resnica, poimenovana — lahko
//    negativna: rdeča iskrena, NIKOLI utišana);
//  • % marže = marža / prihodki × 100 — SAMO pri prihodki > 0; brez prihodkov
//    % NI definiran → '—' sivo (NIKOLI izmišljen 0 %, R227 strogost);
//  • prazna vsota = 0 (resnica prazne vsote — projekt brez računov ima
//    prihodke 0, brez naročil stroške 0; to NI izmišljena vrednost, ampak
//    poimenovana vsota praznega seznama);
//  • vnos BREZ projekta (null) se NE pripisuje nobenemu projektu — ŠTEJE se
//    ločeno in je poimenovan v sklepu ('računov brez projekta N · naročil brez
//    projekta M (izključeni iz preseka)' — prihodki 'stornirani' vzorec);
//  • stornirani + osnutki računov: izključeni iz prihodkov, poimenovani v
//    sklepu (R250 vzorec).
//
// ENA RESNICA z zaslonom (WYSIWYG):
//  • vodja-dashboard ŽE izriše ista vsota-izpeljave (mesecniPrihodek,
//    odprtaNarocila, zamujeneDobave) iz ISTIH fetch-ov — ta dokument je
//    projekt-na-razcepljena različica ISTIH resnic;
//  • sort = MARŽA ASC (najslabša marža PRVA = akcijski red — ista logika kot
//    potekli opomniki R252 'najstarejši prvi'), izenačba projekt ASC (navadno
//    < po UTF-16 kodnih točkah — brez locale-odvisnega primerjanja, R245/R250
//    vzorec). Sort INTERNI PRED vsotami — FP seštevanje odvisno od vrstnega
//    reda, rezultat f(MNOŽICA) (povprecniRazpon R248 vzorec).
//
// Načela (družinska pravila):
//  • Fail-closed: pokvaren vnos → TypeError (status iz znanih množic EN VIR,
//    zneski končno ne-negativni, številka/projekt oblike — indeks krivca v
//    sporočilu). PRAZEN PRESEK (0 računov IN 0 naročil) ne nastaja dokumenta
//    (družina: ni prazne datoteke; komponenta pokaže iskren toast). EN
//    ne-prazen vir ZADOVOLJI (projekt samo z računi = stroški 0; samo z
//    naročili = prihodki 0 — obe poimenovani resnici).
//  • Determinizem: `now` KOT parameter; doc.setCreationDate(now) +
//    doc.setFileId(FNV-1a) — enak vhod = bajtno enak PDF (document-pdf R121).
//  • CLIENT-safe: uvozi ga vodja-dashboard (client) — čista JS FNV-1a;
//    LASTNI soli **0x7d–0x80** (register: … prihodki 0x61–64, opomnik
//    0x65–68, potekli 0x69–6c, koledar 0x6d–0x70, vozni red 0x71–74,
//    tedenski 0x75–78, naročila pregled 0x79–7c → dobičkonost 0x7d–0x80 —
//    ista semena v dveh libih NE smejo dati isti ID).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { todayStamp } from './csv-export'
import { zalogaPovzetekCasOznaka } from './zaloga-povzetek'
import { STATUSI as STATUSI_RACUNOV } from './prihodki-pdf'
import { STATUSI_NAROCIL } from './narocila-pregled-pdf'

// ---------- barve (ISTI dokumenti družina — usklajeno s prihodki/narocila) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber (stroški)
const GREEN: [number, number, number] = [22, 163, 74] // roksal-green (prihodki / pozitivna marža)
const RED: [number, number, number] = [220, 38, 38] // zaloga-pdf R120 red (negativna marža)
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

/** Client-safe prerez ENEGA računa za presek (podmnožica InvLite / GET
 *  /api/invoices). projekt = naziv projekta ALI null (brez projekta →
 *  števec izključenih, poimenovan v sklepu). */
export interface DobicikonostRacun {
  /** Račun 'YYYY-NNN' (ne-prazen — fail-closed). */
  stevilka: string
  /** VERBATIM status iz API-ja (4 znanih — EN VIR STATUSI prihodki-pdf). */
  status: string
  /** Znesek (EUR; končno ne-negativen). */
  znesek: number
  /** Naziv projekta ALI null/undefined (brez projekta). */
  projekt?: string | null
}

/** Client-safe prerez ENEGA naročila za presek (podmnožica GET
 *  /api/material-orders). projekt = naziv projekta ALI null. */
export interface DobicikonostNarocilo {
  /** VERBATIM status iz API-ja (5 znanih — EN VIR STATUSI_NAROCIL). */
  status: string
  /** Skupaj vrednost naročila (EUR; končno ne-negativna). */
  skupajCena: number
  /** Naziv projekta ALI null/undefined (brez projekta). */
  projekt?: string | null
}

export interface DobicikonostPdfOptions {
  /** Referenčni trenutek (žig + CreationDate + fileId + ime) — KOT
   *  PARAMETER (determinizem; vzorec R203/R244/R250/R257). */
  now: Date
}

/** Fail-closed preverba računa (indeks krivca VEDNO v sporočilu). */
export function preveriDobicikonostRacun(r: DobicikonostRacun, i: number): void {
  if (!r || typeof r !== 'object') {
    throw new TypeError(`preveriDobicikonostRacun (${i}): pričakovan račun (DobicikonostRacun)`)
  }
  if (typeof r.stevilka !== 'string' || r.stevilka.trim() === '') {
    throw new TypeError(`preveriDobicikonostRacun (${i}): stevilka mora biti ne-prazen niz, ne ${String(r.stevilka)}`)
  }
  if (typeof r.status !== 'string' || !(STATUSI_RACUNOV as readonly string[]).includes(r.status)) {
    throw new TypeError(`preveriDobicikonostRacun (${i}): status mora biti eden iz ${STATUSI_RACUNOV.join('/')}, ne ${String(r.status)}`)
  }
  if (typeof r.znesek !== 'number' || !Number.isFinite(r.znesek) || r.znesek < 0) {
    throw new TypeError(`preveriDobicikonostRacun (${i}): znesek mora biti končno ne-negativno število, ne ${String(r.znesek)}`)
  }
  if (r.projekt !== undefined && r.projekt !== null && (typeof r.projekt !== 'string' || r.projekt.trim() === '')) {
    throw new TypeError(`preveriDobicikonostRacun (${i}): projekt mora biti ne-prazen niz ali null, ne ${String(r.projekt)}`)
  }
}

/** Fail-closed preverba naročila (indeks krivca VEDNO v sporočilu). */
export function preveriDobicikonostNarocilo(n: DobicikonostNarocilo, i: number): void {
  if (!n || typeof n !== 'object') {
    throw new TypeError(`preveriDobicikonostNarocilo (${i}): pričakovano naročilo (DobicikonostNarocilo)`)
  }
  if (typeof n.status !== 'string' || !(STATUSI_NAROCIL as readonly string[]).includes(n.status)) {
    throw new TypeError(`preveriDobicikonostNarocilo (${i}): status mora biti eden iz ${STATUSI_NAROCIL.join('/')}, ne ${String(n.status)}`)
  }
  if (typeof n.skupajCena !== 'number' || !Number.isFinite(n.skupajCena) || n.skupajCena < 0) {
    throw new TypeError(`preveriDobicikonostNarocilo (${i}): skupajCena mora biti končno ne-negativno število, ne ${String(n.skupajCena)}`)
  }
  if (n.projekt !== undefined && n.projekt !== null && (typeof n.projekt !== 'string' || n.projekt.trim() === '')) {
    throw new TypeError(`preveriDobicikonostNarocilo (${i}): projekt mora biti ne-prazen niz ali null, ne ${String(n.projekt)}`)
  }
}

/** Znesek kot stabilen niz — 2 decimalni mesti (družinski znesekNiz vzorec). */
function znesekNiz(z: number): string {
  return z.toFixed(2)
}

/** Determinističen file-ID (32 hex) — čista JS FNV-1a; LASTNI soli 0x7d–0x80. */
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
    fnv1aHex(seed, 0x7d) +
    fnv1aHex(seed, 0x7e) +
    fnv1aHex(seed, 0x7f) +
    fnv1aHex(seed, 0x80)
  )
}

export interface DobicikonostVrsta {
  /** Naziv projekta (ne-prazen). */
  projekt: string
  /** Σ znesek IZDAN + PLACAN (ISTO kot UI 'izdano'). */
  prihodki: number
  /** Σ skupajCena ne-preklicanih naročil (R257 vzorec). */
  stroski: number
  /** prihodki − stroški (izpeljana resnica — lahko negativna). */
  marza: number
  /** marža / prihodki × 100, ALI null če prihodki = 0 (NI definiran → '—'). */
  marzaOdstotek: number | null
  /** Št. računov IZDAN + PLACAN na projektu (osnutki/stornirani NE štejejo). */
  racunov: number
  /** Št. VSEH ne-preklicanih naročil na projektu. */
  narocil: number
}

export interface DobicikonostPovzetek {
  /** Št. vrstic (= sortirane.length). */
  projektov: number
  /** Σ prihodki čez projekte. */
  prihodki: number
  /** Σ stroški čez projekte. */
  stroski: number
  /** Σ marža čez projekte. */
  marza: number
  /** Št. projektov z marža < 0 (iskren alarm). */
  negativnih: number
  /** Št. računov brez projekta (izključeni iz preseka, poimenovani). */
  racunovBrezProjekta: number
  /** Št. naročil brez projekta (izključeni iz preseka, poimenovani). */
  narocilBrezProjekta: number
  /** Σ znesek računov brez projekta (iskrena vsota — poimenovana). */
  prihodkiBrezProjekta: number
  /** Σ skupajCena ne-preklicanih naročil brez projekta (poimenovana). */
  stroskiBrezProjekta: number
  /** Št. STORNIRAN računov (izključeni iz prihodkov — poimenovani). */
  storniranih: number
  /** Št. OSNUTEK računov (izključeni iz prihodkov — poimenovani). */
  osnutkiRacunov: number
}

/** Presek dveh virov — ENA resnica za KPI, tabelo, sklep IN toast (WYSIWYG).
 *  Groupira po nazivu projekta (trim); fail-verbose preverba VSEH vnosov
 *  TUDI brez-projektnih (pokvaren vnos = pokvaren vir — NIKOLI tiho). */
export function dobicikonostPoProjektih(
  racuni: readonly DobicikonostRacun[],
  narocila: readonly DobicikonostNarocilo[],
): { vrste: DobicikonostVrsta[]; povzetek: DobicikonostPovzetek } {
  if (!Array.isArray(racuni)) {
    throw new TypeError('dobicikonostPoProjektih: pričakovano polje računov (DobicikonostRacun[])')
  }
  if (!Array.isArray(narocila)) {
    throw new TypeError('dobicikonostPoProjektih: pričakovano polje naročil (DobicikonostNarocilo[])')
  }
  racuni.forEach((r, i) => preveriDobicikonostRacun(r, i))
  narocila.forEach((n, i) => preveriDobicikonostNarocilo(n, i))

  const povzetek: DobicikonostPovzetek = {
    projektov: 0,
    prihodki: 0,
    stroski: 0,
    marza: 0,
    negativnih: 0,
    racunovBrezProjekta: 0,
    narocilBrezProjekta: 0,
    prihodkiBrezProjekta: 0,
    stroskiBrezProjekta: 0,
    storniranih: 0,
    osnutkiRacunov: 0,
  }
  const map = new Map<string, { prihodki: number; stroski: number; racunov: number; narocil: number }>()

  for (const r of racuni) {
    // stornirani/osnutki šteje VSE račune (tudi brez projekta) — sklep
    // poimenuje IZKLJUČENE iz prihodkov, ne glede na projektno pripadnost.
    if (r.status === 'STORNIRAN') povzetek.storniranih += 1
    if (r.status === 'OSNUTEK') povzetek.osnutkiRacunov += 1
    const p = typeof r.projekt === 'string' ? r.projekt.trim() : null
    if (p === null) {
      povzetek.racunovBrezProjekta += 1
      // vsota brez projekta je poimenovana v sklepu (iskrena resnica)
      if (r.status === 'IZDAN' || r.status === 'PLACAN') povzetek.prihodkiBrezProjekta += r.znesek
      continue
    }
    if (r.status !== 'IZDAN' && r.status !== 'PLACAN') continue
    let vrsta = map.get(p)
    if (!vrsta) {
      vrsta = { prihodki: 0, stroski: 0, racunov: 0, narocil: 0 }
      map.set(p, vrsta)
    }
    vrsta.prihodki += r.znesek
    vrsta.racunov += 1
  }

  for (const n of narocila) {
    const p = typeof n.projekt === 'string' ? n.projekt.trim() : null
    if (p === null) {
      povzetek.narocilBrezProjekta += 1
      // preklic ni denarni tok — iz vsote brez projekta TUDI izključen (R257)
      if (n.status !== 'PREKlicANO') povzetek.stroskiBrezProjekta += n.skupajCena
      continue
    }
    if (n.status === 'PREKlicANO') continue
    let vrsta = map.get(p)
    if (!vrsta) {
      vrsta = { prihodki: 0, stroski: 0, racunov: 0, narocil: 0 }
      map.set(p, vrsta)
    }
    vrsta.stroski += n.skupajCena
    vrsta.narocil += 1
  }

  const vrste: DobicikonostVrsta[] = [...map.entries()].map(([projekt, v]) => ({
    projekt,
    prihodki: v.prihodki,
    stroski: v.stroski,
    marza: v.prihodki - v.stroski,
    marzaOdstotek: v.prihodki > 0 ? ((v.prihodki - v.stroski) / v.prihodki) * 100 : null,
    racunov: v.racunov,
    narocil: v.narocil,
  }))
  sortirajDobicikonost(vrste)

  povzetek.projektov = vrste.length
  for (const v of vrste) {
    povzetek.prihodki += v.prihodki
    povzetek.stroski += v.stroski
    povzetek.marza += v.marza
    if (v.marza < 0) povzetek.negativnih += 1
  }
  return { vrste, povzetek }
}

/** Sort V LIBU — MARŽA ASC (najslabša prva = akcijski red, R252 vzorec),
 *  izenačba projekt ASC (navadno < po UTF-16 kodnih točkah — brez
 *  locale-odvisnega primerjanja). IZVOŽEN — determinizem = f(MNOŽICA). */
export function sortirajDobicikonost(vrste: DobicikonostVrsta[]): DobicikonostVrsta[] {
  return vrste.sort((a, b) => {
    if (a.marza !== b.marza) return a.marza < b.marza ? -1 : 1
    const pa = a.projekt.trim()
    const pb = b.projekt.trim()
    if (pa !== pb) return pa < pb ? -1 : 1
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

/** KPI polje — ISTI vzorec kot prihodki/narocila (družinski kpiBox). */
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

/** Zgradi DOBIČKONOST dokument (brez shranjevanja) — vrne jsPDF instanco
 *  (testi berejo doc.output('arraybuffer') → bajtni dokazi). */
export function buildDobicikonostPdfDoc(
  racuni: readonly DobicikonostRacun[],
  narocila: readonly DobicikonostNarocilo[],
  options: DobicikonostPdfOptions,
): jsPDF {
  if (!Array.isArray(racuni) || !Array.isArray(narocila)) {
    throw new TypeError('buildDobicikonostPdfDoc: pričakovani polji računov in naročil')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildDobicikonostPdfDoc: pričakovane opcije (DobicikonostPdfOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildDobicikonostPdfDoc: pričakovan veljaven now: Date')
  }
  // PRAZEN PRESEK ne nastaja dokumenta (družina: ni prazne datoteke —
  // komponenta pokaže iskren toast 'Ni podatkov za dobičkonost.').
  if (racuni.length === 0 && narocila.length === 0) {
    throw new TypeError(
      'buildDobicikonostPdfDoc: prazen presek ne nastaja dokumenta — komponenta pokaže iskren toast (Ni podatkov za dobičkonost.)',
    )
  }
  const { vrste, povzetek } = dobicikonostPoProjektih(racuni, narocila)

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / prihodki R250) ----------
  doc.setCreationDate(now)
  // Seed = f(MNOŽICA) — kanoniziran red (številka ASC; status/znesek/projekt
  // ASC), NIKOLI vrstni red odgovora (R250/R257 vzorec: sort pred seedom).
  const kanonRacuni = [...racuni].sort((a, b) =>
    a.stevilka.trim() < b.stevilka.trim() ? -1 : a.stevilka.trim() > b.stevilka.trim() ? 1 : 0,
  )
  const kanonNarocila = [...narocila].sort((a, b) => {
    if (a.status !== b.status) return a.status < b.status ? -1 : 1
    if (a.skupajCena !== b.skupajCena) return a.skupajCena < b.skupajCena ? -1 : 1
    const pa = typeof a.projekt === 'string' ? a.projekt : ''
    const pb = typeof b.projekt === 'string' ? b.projekt : ''
    if (pa !== pb) return pa < pb ? -1 : 1
    return 0
  })
  doc.setFileId(
    deterministichenId(
      `${now.toISOString()}|R:${kanonRacuni
        .map((r) => `${r.stevilka.trim()}/${r.status}/${znesekNiz(r.znesek)}${r.projekt ? `@${r.projekt.trim()}` : ''}`)
        .join(',')}|N:${kanonNarocila
        .map((n) => `${n.status}/${znesekNiz(n.skupajCena)}${n.projekt ? `@${n.projekt.trim()}` : ''}`)
        .join(',')}`,
    ),
  )

  // ---------- glava (ISTI vzorec kot prihodki/narocila) ----------
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
  doc.text('DOBIČKONOST PO PROJEKTIH', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })

  // ---------- KPI povzetek (izračun iz preseka — notranja skladnost) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Povzetek dobičkonosti')
  // 5 polj → 33 mm boxi (ISTI layout kot prihodki R250 / naročila R257).
  const bw = 33
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Projektov', String(povzetek.projektov), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Prihodki', `${znesekNiz(povzetek.prihodki)} €`, povzetek.prihodki > 0 ? GREEN : NAVY)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Stroški', `${znesekNiz(povzetek.stroski)} €`, povzetek.stroski > 0 ? AMBER : NAVY)
  kpiBox(doc, 14 + 3 * (bw + gap), y, bw, bh, 'Marža', `${znesekNiz(povzetek.marza)} €`, povzetek.marza > 0 ? GREEN : povzetek.marza < 0 ? RED : NAVY)
  kpiBox(doc, 14 + 4 * (bw + gap), y, bw, bh, 'Negativnih', String(povzetek.negativnih), povzetek.negativnih > 0 ? RED : NAVY)
  y += bh + 8

  // ---------- tabela projektov (MARŽA ASC — akcijski red, najslabša prva) ----------
  y = sectionTitle(doc, y, `Projekti (${vrste.length})`)
  autoTable(doc, {
    startY: y,
    head: [['Projekt', 'Prihodki (EUR)', 'Stroški (EUR)', 'Marža (EUR)', 'Marža (%)', 'Računov', 'Naročil']],
    body: vrste.map((v) => [
      v.projekt,
      znesekNiz(v.prihodki),
      znesekNiz(v.stroski),
      znesekNiz(v.marza),
      v.marzaOdstotek !== null ? v.marzaOdstotek.toFixed(1) : '—',
      String(v.racunov),
      String(v.narocil),
    ]),
    styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
    didParseCell: (data) => {
      // WYSIWYG: negativna marža rdeče bold (iskren alarm — NIKOLI utišana);
      // pozitivna zeleno bold; '—' % sivo (NI definiran — iskrena null resnica).
      if (data.section === 'body' && data.column.index === 3) {
        const v = Number(String(data.cell.raw ?? ''))
        if (Number.isFinite(v) && v < 0) {
          data.cell.styles.textColor = RED
          data.cell.styles.fontStyle = 'bold'
        } else if (Number.isFinite(v) && v > 0) {
          data.cell.styles.textColor = GREEN
          data.cell.styles.fontStyle = 'bold'
        }
      }
      if (data.section === 'body' && data.column.index === 4 && data.cell.raw === '—') {
        data.cell.styles.textColor = GRAY
      }
    },
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 6

  // ---------- sklepna vrstica (iskren podpis — izključitve poimenovane) ----------
  if (y > 255) {
    doc.addPage()
    y = 20
  }
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text(
    `${povzetek.projektov} projektov · prihodki ${znesekNiz(povzetek.prihodki)} EUR · stroški ${znesekNiz(povzetek.stroski)} EUR · marža ${znesekNiz(povzetek.marza)} EUR · negativnih marž ${povzetek.negativnih} · storniranih računov ${povzetek.storniranih} · osnutkov računov ${povzetek.osnutkiRacunov} (izključeni iz prihodkov) · računov brez projekta ${povzetek.racunovBrezProjekta} (${znesekNiz(povzetek.prihodkiBrezProjekta)} EUR) · naročil brez projekta ${povzetek.narocilBrezProjekta} (${znesekNiz(povzetek.stroskiBrezProjekta)} EUR, izključeni iz preseka).`,
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

/** Ime datoteke — `Dobicikonost-projektov-YYYY-MM-DD.pdf` (družinski vzorec;
 *  deterministično glede na `now`; EN now za žig IN ime — lekcija R121/R235). */
export function dobicikonostPdfFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('dobicikonostPdfFilename: pričakovan veljaven now: Date')
  }
  return `Dobicikonost-projektov-${todayStamp(now)}.pdf`
}

/** Zgeneriraj DOBIČKONOST PDF (determinističen — enak vhod = bajtno enak
 *  dokument) in ga shrani kot `Dobicikonost-projektov-YYYY-MM-DD.pdf`. */
export function generateDobicikonostPdf(
  racuni: readonly DobicikonostRacun[],
  narocila: readonly DobicikonostNarocilo[],
  options: DobicikonostPdfOptions,
): void {
  const doc = buildDobicikonostPdfDoc(racuni, narocila, options)
  doc.save(dobicikonostPdfFilename(options.now))
}
