// ---------------------------------------------------------------------------
// R263 (P1-f, 'izvozi' družina — 19. člen) — STRANKE — OPOMNIŠKA POKRITOST PDF
// iz CRM (crm-tab). Vzorec potekli-opomniki-pdf R252 / koledar-pregledov-pdf
// R253 / zaloga-osnutek-pdf R262: ROKSAL glava, KPI, autoTable, noge, bajtni
// determinizem.
//
// PRESEK STRANKE × OPOMNIŠKI STATUS (route NIČ — client+lib only; CrmTab ŽE
// izriše ISTI GET /api/crm odgovor — R252 DTO, NIČ nove mreže):
//  • opomnikStatus VERBATIM iz API-ja ('NI' | 'AKTIVEN' | 'POTEKEL') — lib
//    NIKOLI sam izračunava dni (EN VIR resnice, kot žig na kartici);
//    ⚠️ API resnica: opomnikDatum NASTAVLJEN a > 7 dni v prihodnje ostane
//    'NI' (route šteje AKTIVEN samo za days <= 7) — zato DTO NOSI SAMO
//    opomnikStatus (brez opomnikDatum) in lib NE trdi nobene invariante o
//    datumu (izmišljeni invarianti = lažni fail-closed — lekcija rute);
//  • BREZ OPOJNIKA (slepa pika) = opomnikStatus === 'NI'; vrstica = slepa
//    pika, ki NI ARHIVIRANA (arhivirana stranka brez opomnika je ZAPRT
//    primer — iskren odpad, ŠTEVEC poimenovan v sklepu, vzorec R257/R258
//    izključitvi);
//  • pokritost % = (strankN − brezN) / strankN × 100 — VEDNO definiran,
//    ker strankN ≥ 1 (prazen seznam fail-closed še pred deljenjem — NIČ
//    deljenja z nič, NIČ izmišljenega 0 %/100 %, R261 % jezik);
//  • poteklih = št. strank z opomnikStatus 'POTEKEL' — sekundarna resnica
//    (svoj akcijski dokument: Potekli opomniki R252), tu poimenovan v KPI
//    IN sklepu;
//  • sort = LTV DESC (najvrednejše slepe pike prve — akcijski red pisarne;
//    LTV je SHRANJENA izpeljana resnica iz /api/crm — read-only, NIČ
//    ponovnega računa, R261 estimatedPrice vzorec), izenačba ime ASC
//    (navadno < po UTF-16 kodnih točkah — brez locale-odvisnega primerjanja,
//    R245/R250 vzorec), nato id ASC (identiteta — dve istonaslovni stranki
//    z ISTIM LTV = RAZLIČNI resnici, R260/R261/R262 lekcija). Sort interno PRED
//    seedom — f(MNOŽICA), ne f(vrstni red odgovora) (R248 vzorec).
//
// ENA RESNICA z zaslonom (WYSIWYG):
//  • ISTA izpeljava strankeOpomnikiPokritost poganja PDF KPI, tabelo, sklep
//    IN kondicionalno F2 mini-vrstico 'Pokritost opomnikov' + toast — ENA
//    izpeljava (≥ 2 klici v komponenti, test dokaz);
//  • status stranke = VERBATIM CRM_STATUS_LABELS iz crm-csv (EN VIR — ISTI
//    labels kot čipi/statusni filter na zaslonu, NIČ dvojnega seznama).
//
// Načela (družinska pravila):
//  • Fail-closed: pokvaren vnos → TypeError z indeksom krivca (status iz
//    znane množice EN VIR, opomnikStatus iz 3 znanih, ltv končno ne-negativno,
//    ime/naslov ne-prazna niza, opcijska polja null ALI ne-prazen niz).
//    PRAZEN SEZNAM strank ne nastaja dokumenta; tudi 0 slepih pik (vse
//    stranke pokrite) ne nastaja dokumenta — družina: ni prazne datoteke;
//    komponenta pokaže iskren toast (obe veji E2E/test dokazani, R256
//    lekcija 4).
//  • Determinizem: `now` KOT parameter; doc.setCreationDate(now) +
//    doc.setFileId(FNV-1a) — enak vhod = bajtno enak PDF (document-pdf R121).
//  • CLIENT-safe: čista JS FNV-1a; LASTNI soli **0x89–0x8c** (register:
//    … zaloga-osnutek 0x85–0x88 → stranke-pokritost 0x89–0x8c — ista semena
//    v dveh libih NE smejo dati isti ID; grep 0x89 v object-storage je PNG
//    magija, NE salt — R261 lekcija 5 vzorec).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { todayStamp } from './csv-export'
import { zalogaPovzetekCasOznaka } from './zaloga-povzetek'
import { cenikDatumIso } from './cenik-pdf'
import { CRM_STATUS_LABELS } from './crm-csv'

// ---------- barve (ISTI dokumenti družina — 0 novih hex) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const GREEN: [number, number, number] = [22, 163, 74] // roksal-green
const RED: [number, number, number] = [220, 38, 38] // zaloga-pdf R120 red
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

const OPOJNIKI_STATUSI = ['NI', 'AKTIVEN', 'POTEKEL'] as const

/** Client-safe prerez ENE CRM stranke (podmnožica GET /api/crm — ISTI
 *  odgovor, ki ga CrmTab izriše; opomnikStatus VERBATIM iz API-ja). */
export interface StrankaOpomnikVnos {
  /** ID stranke (ne-prazen — identiteta/izenačba, fail-closed). */
  id: string
  /** Stranka (ne-prazen niz). */
  ime: string
  /** Naslov (ne-prazen niz — obvezno za akcijo). */
  naslov: string
  /** Status VERBATIM iz API-ja — ključ CRM_STATUS_LABELS (EN VIR crm-csv). */
  status: string
  /** Kategorija: null ALI ne-prazen niz ('—' = brez, iskreno). */
  kategorija: string | null
  /** Telefon: null ALI ne-prazen niz. */
  telefon: string | null
  /** Zadnji kontakt ISO niz: null ALI YYYY-MM-DD… (cenikDatumIso izriše). */
  zadnjiKontakt: string | null
  /** Življenjska vrednost EUR (končno ne-negativna — akcijski red DESC). */
  ltv: number
  /** Opomniški status VERBATIM iz API-ja (3 znani — zgoraj). */
  opomnikStatus: 'NI' | 'AKTIVEN' | 'POTEKEL'
}

export interface StrankePokritostPdfOptions {
  /** Referenčni trenutek (žig + CreationDate + fileId + ime) — KOT
   *  PARAMETER (determinizem; vzorec R203/R244/R250/R252/R262). */
  now: Date
}

/** Fail-closed preverba stranke (obvezna polja + VERBATIM statusi + ltv;
 *  indeks krivca je VEDNO v sporočilu — družina R236/R250–R262). */
export function preveriStrankoVnos(s: StrankaOpomnikVnos, i: number): void {
  if (!s || typeof s !== 'object') {
    throw new TypeError(`preveriStrankoVnos (${i}): pričakovana CRM stranka (StrankaOpomnikVnos)`)
  }
  for (const [k, v] of [
    ['id', s.id],
    ['ime', s.ime],
    ['naslov', s.naslov],
  ] as const) {
    if (typeof v !== 'string' || v.trim() === '') {
      throw new TypeError(`preveriStrankoVnos (${i}): ${k} mora biti ne-prazen niz, ne ${String(v)}`)
    }
  }
  if (typeof s.status !== 'string' || !Object.prototype.hasOwnProperty.call(CRM_STATUS_LABELS, s.status)) {
    throw new TypeError(`preveriStrankoVnos (${i}): status mora biti eden iz ${Object.keys(CRM_STATUS_LABELS).join('/')}, ne ${String(s.status)}`)
  }
  if (!OPOJNIKI_STATUSI.includes(s.opomnikStatus)) {
    throw new TypeError(`preveriStrankoVnos (${i}): opomnikStatus mora biti eden iz ${OPOJNIKI_STATUSI.join('/')}, ne ${String(s.opomnikStatus)}`)
  }
  if (typeof s.ltv !== 'number' || !Number.isFinite(s.ltv) || s.ltv < 0) {
    throw new TypeError(`preveriStrankoVnos (${i}): ltv mora biti končno ne-negativno število, ne ${String(s.ltv)}`)
  }
  for (const [k, v] of [
    ['kategorija', s.kategorija],
    ['telefon', s.telefon],
  ] as const) {
    if (v !== null && (typeof v !== 'string' || v.trim() === '')) {
      throw new TypeError(`preveriStrankoVnos (${i}): ${k} mora biti null ALI ne-prazen niz, ne ${String(v)}`)
    }
  }
  if (
    s.zadnjiKontakt !== null &&
    (typeof s.zadnjiKontakt !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(s.zadnjiKontakt))
  ) {
    throw new TypeError(`preveriStrankoVnos (${i}): zadnjiKontakt mora biti null ALI ISO niz YYYY-MM-DD…, ne ${String(s.zadnjiKontakt)}`)
  }
}

/** Determinističen file-ID (32 hex) iz semena — čista JS FNV-1a (CLIENT-safe;
 *  LASTNI soli 0x89–0x8c: vsak PDF lib družine ima svoje). */
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
    fnv1aHex(seed, 0x89) +
    fnv1aHex(seed, 0x8a) +
    fnv1aHex(seed, 0x8b) +
    fnv1aHex(seed, 0x8c)
  )
}

/** LTV kot stabilen računovodski niz — 2 decimalki (ISTI vzorec kot
 *  narocila-pregled skupajCena; zaslon formatLTV je svoj prikaz — ISTA
 *  številka, dva prikaza, R257 vzorec). */
function ltvNiz(l: number): string {
  return l.toFixed(2)
}

export interface StrankaPokritostVrsta {
  /** ID stranke (identiteta). */
  id: string
  ime: string
  naslov: string
  /** Status label VERBATIM iz CRM_STATUS_LABELS (ISTI kot zaslon). */
  status: string
  kategorija: string | null
  telefon: string | null
  zadnjiKontakt: string | null
  ltv: number
}

export interface StrankePokritostPovzetek {
  /** Št. strank skupaj (≥ 1 — fail-closed prazne množice). */
  strankN: number
  /** Št. slepih pik (opomnikStatus 'NI', NE-arhivirane) = vrstic. */
  brezN: number
  /** Št. strank z opomnikom (AKTIVEN + POTEKEL). */
  zOpomnikomN: number
  /** Št. strank z opomnikStatus 'POTEKEL' (svoj dokument R252). */
  potekliN: number
  /** Št. ARHIVIRANIH brez opomnika (iskren odpad — brez vrstice). */
  arhiviranihBrezN: number
  /** pokritost % = zOpomnikomN / strankN × 100 — VEDNO definiran (strankN ≥ 1). */
  pokritostOdstotek: number
  /** Pokritost kot prikazni niz (1 decimalna + vejica — ISTI niz KPI + sklep
   *  + mini-vrstica + toast; vzorec povprecjeNiz R252). */
  pokritostNiz: string
}

/** Presek strank × opomniški status — ENA resnica za PDF KPI, tabelo, sklep,
 *  F2 mini-vrstico IN toast (WYSIWYG). Fail-verbose preverba VSEH vnosov
 *  (pokvaren vnos = pokvaren vir — NIKOLI tiho). PRAZEN SEZNAM → TypeError
 *  (klicatelj — memo komponente — čuva null). */
export function strankeOpomnikiPokritost(
  stranke: readonly StrankaOpomnikVnos[],
): { vrste: StrankaPokritostVrsta[]; povzetek: StrankePokritostPovzetek } {
  if (!Array.isArray(stranke)) {
    throw new TypeError('strankeOpomnikiPokritost: pričakovano polje strank (StrankaOpomnikVnos[])')
  }
  if (stranke.length === 0) {
    throw new TypeError('strankeOpomnikiPokritost: prazen seznam strank nima pokritosti (fail-closed — komponenta čuva null)')
  }
  stranke.forEach((s, i) => preveriStrankoVnos(s, i))

  let brezN = 0
  let zOpomnikomN = 0
  let potekliN = 0
  let arhiviranihBrezN = 0
  const vrste: StrankaPokritostVrsta[] = []
  for (const s of stranke) {
    if (s.opomnikStatus === 'NI') {
      if (s.status === 'ARHIVIRAN') {
        // zaprt primer — iskren odpad, poimenovan v sklepu (brez vrstice)
        arhiviranihBrezN += 1
      } else {
        brezN += 1
        vrste.push({
          id: s.id,
          ime: s.ime.trim(),
          naslov: s.naslov.trim(),
          status: CRM_STATUS_LABELS[s.status as keyof typeof CRM_STATUS_LABELS],
          kategorija: s.kategorija,
          telefon: s.telefon,
          zadnjiKontakt: s.zadnjiKontakt,
          ltv: s.ltv,
        })
      }
    } else {
      zOpomnikomN += 1
      if (s.opomnikStatus === 'POTEKEL') potekliN += 1
    }
  }
  sortirajStrankePokritost(vrste)
  const pokritostOdstotek = (zOpomnikomN / stranke.length) * 100
  return {
    vrste,
    povzetek: {
      strankN: stranke.length,
      brezN,
      zOpomnikomN,
      potekliN,
      arhiviranihBrezN,
      pokritostOdstotek,
      pokritostNiz: pokritostOdstotek.toFixed(1).replace('.', ','),
    },
  }
}

/** Sort vrstic V LIBU — LTV DESC (najvrednejše slepe pike prve — akcijski
 *  red), izenačba ime ASC (navadno <, brez locale-odvisnega primerjanja),
 *  nato id ASC (identiteta). IZVOŽEN — determinizem = f(MNOŽICA vhodov). */
export function sortirajStrankePokritost(
  vrste: StrankaPokritostVrsta[],
): StrankaPokritostVrsta[] {
  return vrste.sort((a, b) => {
    if (a.ltv !== b.ltv) return a.ltv > b.ltv ? -1 : 1
    if (a.ime !== b.ime) return a.ime < b.ime ? -1 : 1
    if (a.id !== b.id) return a.id < b.id ? -1 : 1
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

/** KPI polje — ISTI vzorec kot prihodki/opomnik/zaloga-osnutek družina. */
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

/** Zgradi STRANKE — OPOMNIŠKA POKRITOST dokument (brez shranjevanja) — vrne
 *  jsPDF instanco (testi berejo doc.output('arraybuffer') → bajtni dokazi). */
export function buildStrankePokritostPdfDoc(
  stranke: readonly StrankaOpomnikVnos[],
  options: StrankePokritostPdfOptions,
): jsPDF {
  if (!Array.isArray(stranke)) {
    throw new TypeError('buildStrankePokritostPdfDoc: pričakovano polje strank (StrankaOpomnikVnos[])')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildStrankePokritostPdfDoc: pričakovane opcije (StrankePokritostPdfOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildStrankePokritostPdfDoc: pričakovan veljaven now: Date')
  }
  // PRAZEN SEZNAM ne nastaja dokumenta (družina: ni prazne datoteke —
  // komponenta pokaže iskren toast 'Ni strank v CRM.').
  if (stranke.length === 0) {
    throw new TypeError(
      'buildStrankePokritostPdfDoc: prazen seznam strank ne nastaja dokumenta — komponenta pokaže iskren toast (Ni strank v CRM.)',
    )
  }
  const { vrste, povzetek } = strankeOpomnikiPokritost(stranke)
  // 0 slepih pik = pokritost 100 % — vrednost RESNICA, a dokument brez
  // vrstic je prazna datoteka (družinsko pravilo); komponenta pokaže iskren
  // toast 'Vse stranke imajo vpisan opomnik.' (obe veji iskreni).
  if (vrste.length === 0) {
    throw new TypeError(
      'buildStrankePokritostPdfDoc: brez slepih pik ne nastaja dokumenta — komponenta pokaže iskren toast (Vse stranke imajo vpisan opomnik.)',
    )
  }

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / družina) ----------
  doc.setCreationDate(now)
  // Seed = f(MNOŽICA) — kanoniziran red (ime ASC, id ASC), NIKOLI vrstni
  // red odgovora (R250/R257/R258/R261/R262 vzorec: sort pred seedom).
  const kanon = [...stranke].sort((a, b) => {
    if (a.ime.trim() !== b.ime.trim()) return a.ime.trim() < b.ime.trim() ? -1 : 1
    if (a.id !== b.id) return a.id < b.id ? -1 : 1
    return 0
  })
  doc.setFileId(
    deterministichenId(
      `${now.toISOString()}|${kanon
        .map((s) => `${s.ime.trim()}/${s.id}/${s.status}/${s.opomnikStatus}/${ltvNiz(s.ltv)}`)
        .join(',')}`,
    ),
  )

  // ---------- glava (ISTI vzorec kot boss-report družina) ----------
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
  doc.text('STRANKE — OPOMNIŠKA POKRITOST', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })

  // ---------- KPI 5 (signalni jezik: RED = alarm — slepe pike ALI potekli;
  // GREEN = z opomnikom; % po R261 % jeziku — 100 GREEN, pod 100 AMBER) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Povzetek pokritosti')
  const bw = 33
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Strank', String(povzetek.strankN), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Brez opomnika', String(povzetek.brezN), povzetek.brezN > 0 ? RED : NAVY)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Z opomnikom', String(povzetek.zOpomnikomN), povzetek.zOpomnikomN > 0 ? GREEN : NAVY)
  kpiBox(doc, 14 + 3 * (bw + gap), y, bw, bh, 'Poteklih', String(povzetek.potekliN), povzetek.potekliN > 0 ? RED : NAVY)
  kpiBox(doc, 14 + 4 * (bw + gap), y, bw, bh, 'Pokritost (%)', povzetek.pokritostNiz, povzetek.pokritostOdstotek >= 100 ? GREEN : AMBER)
  y += bh + 8

  // ---------- tabela slepih pik (LTV DESC — akcijski red) ----------
  y = sectionTitle(doc, y, `Stranke brez vpisanega opomnika (${vrste.length})`)
  autoTable(doc, {
    startY: y,
    head: [['Stranka', 'Naslov', 'Status', 'Kategorija', 'Telefon', 'Zadnji kontakt', 'LTV (EUR)']],
    body: vrste.map((v) => [
      v.ime,
      v.naslov,
      v.status,
      v.kategorija ?? '—',
      v.telefon ?? '—',
      v.zadnjiKontakt !== null ? cenikDatumIso(v.zadnjiKontakt) : '—',
      ltvNiz(v.ltv),
    ]),
    styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
    columnStyles: {
      5: { cellWidth: 22, halign: 'right' },
      6: { halign: 'right' },
    },
    didParseCell: (data) => {
      // WYSIWYG z zaslonom: statusni žetoni (Aktiven GREEN / Potencialen
      // AMBER / Neaktiven GRAY — ISTI signal kot STATUS_COLORS čipi);
      // '—' sivo (iskrena null resnica, R252 vzorec).
      if (data.section === 'body' && data.column.index === 2) {
        const label = String(data.cell.raw ?? '')
        if (label === 'Aktiven') {
          data.cell.styles.textColor = GREEN
          data.cell.styles.fontStyle = 'bold'
        } else if (label === 'Potencialen') {
          data.cell.styles.textColor = AMBER
          data.cell.styles.fontStyle = 'bold'
        } else if (label === 'Neaktiven') {
          data.cell.styles.textColor = GRAY
        }
      }
      if (data.section === 'body' && (data.column.index === 3 || data.column.index === 4 || data.column.index === 5)) {
        if (String(data.cell.raw ?? '') === '—') {
          data.cell.styles.textColor = GRAY
        }
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
    `${povzetek.brezN} strank brez vpisanega opomnika od ${povzetek.strankN} · pokritost ${povzetek.pokritostNiz} % · z opomnikom ${povzetek.zOpomnikomN} (poteklih ${povzetek.potekliN} — svoj dokument: Potekli opomniki) · arhiviranih brez opomnika ${povzetek.arhiviranihBrezN} (brez vrstice — zaprt primer) · akcijski red: najvrednejše prve · vir = opomnikStatus iz CRM.`,
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

/** Ime datoteke — `Stranke-opomniska-pokritost-YYYY-MM-DD.pdf` (družinski
 *  vzorec; deterministično glede na `now`; EN now za žig IN ime — lekcija
 *  R121/R235). */
export function strankePokritostPdfFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('strankePokritostPdfFilename: pričakovan veljaven now: Date')
  }
  return `Stranke-opomniska-pokritost-${todayStamp(now)}.pdf`
}

/** Zgeneriraj STRANKE — OPOMNIŠKA POKRITOST PDF (determinističen — enak
 *  vhod = bajtno enak dokument) in ga shrani. */
export function generateStrankePokritostPdf(
  stranke: readonly StrankaOpomnikVnos[],
  options: StrankePokritostPdfOptions,
): void {
  const doc = buildStrankePokritostPdfDoc(stranke, options)
  doc.save(strankePokritostPdfFilename(options.now))
}
