// ---------------------------------------------------------------------------
// R271 (P1-f, 'izvozi' družina — 27. člen) — ZAPISNIK — STANJE PRED PREDAJO
// PDF iz Prejemni zapisnik kartice (punch-list.tsx). Vzorec meritve-teren-pdf
// R269 / inventura-pregled-pdf R270: ROKSAL glava, KPI 5, autoTable, sklep,
// noge, bajtni determinizem.
//
// LOČNICA OD OBSTOJEČIH IZVOZOV ZAPISNIKA (brez podvajanja):
//  • vgrajeni jsPDF 'PDF zapisnik' (predajni dokument — podpisni blok, točke
//    v API redu) ostaja kot je; CSV R158 je podatkovni arhiv. TA pregled je
//    TRETJA rezina ISTEGA vira: STANJE — akcijski pregled za pisarno/monterja
//    (kaj blokira predajo, kaj čaka, kako daleč je zapisnik).
//
// EN VIR RESNICE (route NIČ — client+lib only):
//  • /api/punch?projectId — FRESH fetch ISTEGA endpointa ob kliku (R244–R270
//    precedens): dokument = TRENUTNA resnica zapisnika ob kliku (state je
//    lahko zastarel; refetch-on-focus R181 sveža, FRESH pa je resnica ob
//    kliku). Endpoint je projekt-obračunski (assertProjectAccess read, R155 —
//    vir poimenoval v sklepu);
//  • STATUSI EN VIR = PUNCH_STATUS_LABELS iz punch-csv.ts (R158 — IMPORT, NI
//    zasegane kopije): Odprto/Rešeno/Napaka = ISTA besedila kot CSV izvoz IN
//    UI značke (STATUS_META label). Neznani status = pokvaren vir → TypeError
//    (CSV kodo zapiše verbatim v napako — dokument resnice pa ga NE izvozi);
//  • VALIDACIJA ENA (družinska pravila, ISTA strogost kot CSV R158):
//    createdAt = veljaven ISO (ne-ISO → TypeError), naslov = ne-prazen niz,
//    opomba = niz ALI null (ne-nizovna polja NE smejo tiho priti na list kot
//    String(number));
//  • DATUM EN VIR = cenikDatumIso (ISO → DD.MM.YYYY — deterministično, brez
//    locale odvisnosti; R269 precedens).
//
// AKCIJSKI SORT (izvožen + dokumentiran): ISSUE 'Napaka' (0 — akcija RED:
// predaja ne more potekti z odprto napako) → OPEN 'Odprto' (1 — akcija AMBER:
// čaka rešitev) → DONE 'Rešeno' (2 — zgodovinska cona GREEN); nato createdAt
// ASC (kronološko branje zapisnika — najstarejša točka prva, ISTI red kot API
// orderBy) → id ASC (identiteta — isti naslov = RAZLIČNA resnica). Referenčni
// pregled, NE rangiranje.
//
// ENA RESNICA (WYSIWYG):
//  • ISTA izpeljava punchZapisnikPregled poganja PDF KPI, tabelo, sklep,
//    mini-vrstico IN toast — ENA izpeljava (klicatelj jo požene ENKRAT in
//    podaja ISTO resnico naprej, R263/R266–R270 vzorec); mini-vrstica na
//    kartici (state) = ISTA izpeljava čez ISTI items — dve okni (state vs
//    FRESH fetch), ENA matemtika.
//
// Načela (družinska pravila):
//  • Fail-closed: pokvaren vnos → TypeError z indeksom krivca (neznani
//    status, ne-ISO datum, prazen naslov, podvojen id, ne-nizovna polja).
//    PRAZEN zapisnik ne nastaja dokumenta (družina: ni prazne datoteke;
//    komponenta pokaže iskren toast 'Ni točk prejemnega zapisnika.').
//  • Determinizem: `now` KOT parameter; doc.setCreationDate(now) +
//    doc.setFileId(FNV-1a) — enak vhod = bajtno enak PDF (document-pdf R121).
//  • CLIENT-safe: čista JS FNV-1a; LASTNI soli **0xa9–0xac** (register:
//    inventura 0xa5–0xa8 → punch-stanje 0xa9–0xac — ista semena v dveh libih
//    NE smejo dati isti ID).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { todayStamp } from './csv-export'
import { zalogaPovzetekCasOznaka } from './zaloga-povzetek'
import { cenikDatumIso } from './cenik-pdf'
import { PUNCH_STATUS_LABELS, type PunchStatus } from './punch-csv'

// ---------- barve (ISTI dokumenti družina — 0 novih hex) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const GREEN: [number, number, number] = [22, 163, 74] // roksal-green
const RED: [number, number, number] = [220, 38, 38] // zaloga-pdf R120 red
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

/** Akcijski red statusov (VSI 3 znani iz PUNCH_STATUS_LABELS R158 — tipovna
 *  preverba pokritosti: Record<PunchStatus, number> se NE prevede, če status
 *  manjka). Napaka = akcija RED (blokira predajo); Odprto = akcija AMBER
 *  (čaka rešitev); Rešeno = zgodovinska cona GREEN. */
const AKCIJSKI_RED: Record<PunchStatus, number> = {
  issue: 0,
  open: 1,
  done: 2,
}

export type PunchZapisnikVnos = {
  /** Identiteta točke (API). */
  id: string
  /** ISO datum nastanka točke (API createdAt). */
  createdAt: string
  /** Naslov točke kontrole (ne-prazen niz — ISTA pravila kot CSV R158). */
  naslov: string
  /** Opomba ALI null/izostanek (iskren '—' na listu). */
  opomba?: string | null
  /** Status — EN VIR R158 (3 znani; neznani = pokvaren vir → TypeError). */
  status: string
}

export interface PunchZapisnikVrsta {
  /** ID (identiteta). */
  id: string
  /** Datum točke DD.MM.YYYY (iz ISO — cenikDatumIso). */
  datum: string
  /** ISO datum (IZVOŽEN sort ključ — kronološka izenačba). */
  datumIso: string
  /** Naslov točke kontrole (ne-prazen — CSV pariteta). */
  naslov: string
  /** Status — EN VIR R158 (3 znani). */
  status: PunchStatus
  /** Status besedilo — PUNCH_STATUS_LABELS (ISTA besedila kot CSV + UI). */
  statusLabel: string
  /** Opomba ALI null ('—'). */
  opomba: string | null
  /** Akcijski red (manjša = prej — akcijska cona na vrhu). */
  akcijskiRed: number
}

export interface PunchZapisnikPovzetek {
  /** Št. točk (vse iz /api/punch — polna resnica zapisnika). */
  tock: number
  /** Št. napak (RED — akcija: predaja blokirana). */
  napak: number
  /** Št. odprtih (AMBER — akcija: čaka rešitev). */
  odprtih: number
  /** Št. rešenih (GREEN — zgodovina uspeha). */
  resenih: number
  /** Rešenost v % (rešenih / vseh × 100, 1 decimalka — Σ resnica). */
  resenostOdstotek: string
}

/** Fail-closed preverba ENE točke (indeks krivca VEDNO v sporočilu).
 *  Besedilna polja: niz ALI null/izostanek (pokvaren vir NE sme tiho priti
 *  na list kot String(number)). Status preveri EN VIR PUNCH_STATUS_LABELS. */
export function preveriPunchVnos(o: PunchZapisnikVnos, i: number): void {
  if (!o || typeof o !== 'object' || Array.isArray(o)) {
    throw new TypeError(`preveriPunchVnos (${i}): pričakovana točka zapisnika (PunchZapisnikVnos)`)
  }
  if (typeof o.id !== 'string' || o.id === '') {
    throw new TypeError(`preveriPunchVnos (${i}): id mora biti ne-prazen niz, ne ${String(o.id)}`)
  }
  if (typeof o.createdAt !== 'string' || o.createdAt === '') {
    throw new TypeError(`preveriPunchVnos (${i}): createdAt mora biti ISO niz, ne ${String(o.createdAt)}`)
  }
  if (typeof o.naslov !== 'string' || o.naslov.trim() === '') {
    throw new TypeError(`preveriPunchVnos (${i}): naslov mora biti ne-prazen niz, ne ${String(o.naslov)}`)
  }
  if (o.opomba !== null && o.opomba !== undefined && typeof o.opomba !== 'string') {
    throw new TypeError(`preveriPunchVnos (${i}): opomba mora biti niz ALI null, ne ${String(o.opomba)}`)
  }
}

/** Rešenost v % (rešenih / vseh × 100, 1 decimalka). 0 točk ne pride sem
 *  (prazen zapisnik fail-closed prej); rešenih 0 = iskren '0.0'. */
export function resenostOdstotek(resenih: number, vseh: number): string {
  if (!Number.isInteger(resenih) || !Number.isInteger(vseh) || resenih < 0 || vseh <= 0 || resenih > vseh) {
    throw new TypeError(`resenostOdstotek: pričakovana 0 ≤ rešenih ≤ vseh (vseh > 0): ${String(resenih)}/${String(vseh)}`)
  }
  return ((resenih / vseh) * 100).toFixed(1)
}

/** Stanje zapisnika — ENA resnica za KPI, tabelo, sklep, mini-vrstico IN
 *  toast (WYSIWYG). Fail-verbose preverba VSEH vnosov; podvojen id = pokvaren
 *  vir fail-closed. Vrstica = VSA točka zapisnika (tudi REŠENE — polna
 *  resnica, ne samo akcijski ostanki). */
export function punchZapisnikPregled(
  tocke: readonly PunchZapisnikVnos[],
): { vrste: PunchZapisnikVrsta[]; povzetek: PunchZapisnikPovzetek } {
  if (!Array.isArray(tocke)) {
    throw new TypeError('punchZapisnikPregled: pričakovano polje točk zapisnika (PunchZapisnikVnos[])')
  }
  if (tocke.length === 0) {
    throw new TypeError('punchZapisnikPregled: prazen zapisnik ne nastaja dokumenta — stanje zapisnika se izvozi, ko je vpisana prva točka projekta (fail-closed)')
  }
  tocke.forEach((o, i) => preveriPunchVnos(o, i))

  const vrste: PunchZapisnikVrsta[] = tocke.map((o, i) => {
    // Status EN VIR R158: PUNCH_STATUS_LABELS lookup — neznana koda = pokvaren
    // vir (TypeError; CSV bi jo zapisal verbatim, dokument resnice pa je NE
    // izvozi — NIKOLI tiho ugibanje).
    const statusLabel = PUNCH_STATUS_LABELS[o.status as PunchStatus]
    if (statusLabel === undefined) {
      throw new TypeError(
        `punchZapisnikPregled (točka ${i}, id ${o.id}): neznani status: ${String(o.status)}`,
      )
    }
    // Datum EN VIR cenikDatumIso: ne-ISO → TypeError z indeksom krivca
    // (ovijemo — cenikDatumIso nima indeksa).
    let datum: string
    try {
      datum = cenikDatumIso(o.createdAt)
    } catch (e) {
      throw new TypeError(`punchZapisnikPregled (točka ${i}, id ${o.id}): ${e instanceof Error ? e.message : String(e)}`)
    }
    return {
      id: o.id,
      datum,
      datumIso: o.createdAt,
      naslov: o.naslov,
      status: o.status as PunchStatus,
      statusLabel,
      opomba: o.opomba === undefined || o.opomba === '' ? null : o.opomba,
      akcijskiRed: AKCIJSKI_RED[o.status as PunchStatus],
    }
  })

  // Podvojen id = pokvaren vir (dve vrstici za ISTO identiteto bi lažno
  // podvajali KPI in tabelo — fail-closed, NIKOLI tiho združevanje).
  const videni = new Set<string>()
  for (const v of vrste) {
    if (videni.has(v.id)) {
      throw new TypeError(`punchZapisnikPregled: podvojen id točke ${v.id} (pokvaren vir — identiteta mora biti edinstvena)`)
    }
    videni.add(v.id)
  }

  sortirajPunchZapisnik(vrste)

  const resenih = vrste.filter((v) => v.status === 'done').length
  const povzetek: PunchZapisnikPovzetek = {
    tock: vrste.length,
    napak: vrste.filter((v) => v.status === 'issue').length,
    odprtih: vrste.filter((v) => v.status === 'open').length,
    resenih,
    resenostOdstotek: resenostOdstotek(resenih, vrste.length),
  }
  return { vrste, povzetek }
}

/** Sort V LIBU — akcijski red: (1) status po akcijski teži (NAPAKA — akcija
 *  RED → ODPRTA — akcija AMBER → REŠENA — zgodovinska cona GREEN na dnu),
 *  (2) createdAt ASC (kronološko branje zapisnika — najstarejša točka prva,
 *  ISTI red kot API orderBy asc), (3) id ASC (identiteta). IZVOŽEN —
 *  determinizem = f(MNOŽICA vhodov). Referenčni pregled, NE rangiranje. */
export function sortirajPunchZapisnik(vrste: PunchZapisnikVrsta[]): PunchZapisnikVrsta[] {
  return vrste.sort((a, b) => {
    if (a.akcijskiRed !== b.akcijskiRed) return a.akcijskiRed - b.akcijskiRed
    // Izenačba statusa → kronološko branje zapisnika (najstarejša prva).
    if (a.datumIso !== b.datumIso) return a.datumIso < b.datumIso ? -1 : 1
    // Izenačba datuma → identiteta (ISTO točka je RAZLIČNA resnica).
    if (a.id !== b.id) return a.id < b.id ? -1 : 1
    return 0
  })
}

/** Sklanjatev točk za žeton IN sklep (iskrene oznake; 101 = 'sto EN točka' —
 *  pariteta clanBeseda R268 / osnutekBeseda R269). */
export function tockaBeseda(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError(`tockaBeseda: pričakovano ne-negativno celo število: ${String(n)}`)
  }
  const enice = n % 10
  const zadnjiDve = n % 100
  if (enice === 1 && zadnjiDve !== 11) return `${n} točka`
  if (enice === 2 && zadnjiDve !== 12) return `${n} točki`
  if ((enice === 3 || enice === 4) && zadnjiDve !== 13 && zadnjiDve !== 14) {
    return `${n} točke`
  }
  return `${n} točk`
}

/** Sklanjatev napak za žeton (1 napaka / 2 napaki / 3-4 napake / 5+ napak;
 *  101 = 'sto EN napaka' — dvojinski razred kanon R168). */
export function napakaBeseda(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError(`napakaBeseda: pričakovano ne-negativno celo število: ${String(n)}`)
  }
  const enice = n % 10
  const zadnjiDve = n % 100
  if (enice === 1 && zadnjiDve !== 11) return `${n} napaka`
  if (enice === 2 && zadnjiDve !== 12) return `${n} napaki`
  if ((enice === 3 || enice === 4) && zadnjiDve !== 13 && zadnjiDve !== 14) {
    return `${n} napake`
  }
  return `${n} napak`
}

/** Sklanjatev odprtih za žeton (1 odprta / 2 odprti / 3-4 odprte / 5+ odprtih;
 *  101 = 'sto EN odprta' — dvojinski razred kanon R168). */
export function odprtaBeseda(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError(`odprtaBeseda: pričakovano ne-negativno celo število: ${String(n)}`)
  }
  const enice = n % 10
  const zadnjiDve = n % 100
  if (enice === 1 && zadnjiDve !== 11) return `${n} odprta`
  if (enice === 2 && zadnjiDve !== 12) return `${n} odprti`
  if ((enice === 3 || enice === 4) && zadnjiDve !== 13 && zadnjiDve !== 14) {
    return `${n} odprte`
  }
  return `${n} odprtih`
}

/** Determinističen file-ID (32 hex) — čista JS FNV-1a; LASTNI soli 0xa9–0xac. */
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
    fnv1aHex(seed, 0xa9) +
    fnv1aHex(seed, 0xaa) +
    fnv1aHex(seed, 0xab) +
    fnv1aHex(seed, 0xac)
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

/** KPI polje — ISTI vzorec kot meritve-teren/inventura/ekipa-stanje družina. */
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

/** Zgradi ZAPISNIK — STANJE PRED PREDAJO dokument (brez shranjevanja) — vrne
 *  jsPDF instanco (testi berejo doc.output('arraybuffer') → bajtni dokazi). */
export function buildZapisnikStanjePdfDoc(
  tocke: readonly PunchZapisnikVnos[],
  options: ZapisnikStanjePdfOptions,
): jsPDF {
  if (!Array.isArray(tocke)) {
    throw new TypeError('buildZapisnikStanjePdfDoc: pričakovano polje točk zapisnika')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildZapisnikStanjePdfDoc: pričakovane opcije (ZapisnikStanjePdfOptions)')
  }
  const { now, projektIme } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildZapisnikStanjePdfDoc: pričakovan veljaven now: Date')
  }
  if (projektIme !== null && projektIme !== undefined && typeof projektIme !== 'string') {
    throw new TypeError('buildZapisnikStanjePdfDoc: projektIme mora biti niz ALI null')
  }
  // PRAZEN zapisnik ne nastaja dokumenta (družina: ni prazne datoteke —
  // komponenta pokaže iskren toast 'Ni točk prejemnega zapisnika.').
  if (tocke.length === 0) {
    throw new TypeError(
      'buildZapisnikStanjePdfDoc: prazen zapisnik ne nastaja dokumenta — komponenta pokaže iskren toast (Ni točk prejemnega zapisnika.)',
    )
  }
  const { vrste, povzetek } = punchZapisnikPregled(tocke)
  // Ime projekta — točno to, kar pokaže izbirnik; prazno/manjkajoče = iskren
  // 'Brez imena projekta' (R203 pariteta — NIKOLI izmišljenega imena).
  const imeProjekta =
    projektIme !== null && projektIme !== undefined && projektIme.trim() !== ''
      ? projektIme
      : 'Brez imena projekta'

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / družina) ----------
  doc.setCreationDate(now)
  // Seed = f(MNOŽICA) — kanoniziran red (po id identitete), NIKOLI vrstni
  // red odgovora (R248/R262/R264–R270 vzorec). Naslov = ne-prazen niz
  // (preveriPunchVnos) — varen seed vnos.
  const kanonTocke = [...tocke].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  doc.setFileId(
    deterministichenId(
      `${now.toISOString()}|Z:${imeProjekta}:${kanonTocke
        .map((o) => `${o.id}/${o.status}/${o.naslov}/${o.createdAt}`)
        .join(',')}`,
    ),
  )

  // ---------- glava (ISTI vzorec kot meritve-teren/inventura) ----------
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
  doc.text('ZAPISNIK — STANJE PRED PREDAJO', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })
  doc.setFontSize(9)
  doc.text(`projekt: ${imeProjekta}`, 196, 24.5, { align: 'right' })

  // ---------- KPI 5 (signalni jezik: RED = akcija — napaka blokira predajo;
  //  AMBER = akcija — odprte čakajo rešitev; GREEN = rešene, zgodovina
  //  uspeha; NAVY = obseg in Σ rešenost) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Stanje zapisnika')
  const bw = 33
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Točk', String(povzetek.tock), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Napak', String(povzetek.napak), povzetek.napak > 0 ? RED : GREEN)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Odprtih', String(povzetek.odprtih), povzetek.odprtih > 0 ? AMBER : GREEN)
  kpiBox(doc, 14 + 3 * (bw + gap), y, bw, bh, 'Rešenih', String(povzetek.resenih), GREEN)
  kpiBox(doc, 14 + 4 * (bw + gap), y, bw, bh, 'Rešenost', `${povzetek.resenostOdstotek} %`, NAVY)
  y += bh + 8

  // ---------- tabela točk (akcijski red: napake na vrhu — blokirajo predajo;
  //  odprte čakajo; rešene = zgodovinska cona; VSA točka zapisnika) ----------
  y = sectionTitle(doc, y, `Točke zapisnika (${vrste.length})`)
  autoTable(doc, {
    startY: y,
    head: [['Datum', 'Točka kontrole', 'Status', 'Opomba']],
    body: vrste.map((v) => [
      v.datum,
      v.naslov,
      v.statusLabel,
      v.opomba ?? '—',
    ]),
    styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
    didParseCell: (data) => {
      // WYSIWYG: Napaka RED bold (akcija — blokira predajo); Odprto AMBER
      // bold (akcija — čaka rešitev); Rešeno GREEN (zgodovina uspeha); '—'
      // sivo (iskren odpad — opomba manjka).
      if (data.section !== 'body') return
      const v = vrste[data.row.index]
      if (!v) return
      const raw = String(data.cell.raw ?? '')
      if (data.column.index === 2) {
        if (v.status === 'issue') {
          data.cell.styles.textColor = RED
          data.cell.styles.fontStyle = 'bold'
        } else if (v.status === 'open') {
          data.cell.styles.textColor = AMBER
          data.cell.styles.fontStyle = 'bold'
        } else if (v.status === 'done') {
          data.cell.styles.textColor = GREEN
        }
      }
      if (data.column.index === 3 && raw === '—') {
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
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text(
    `${tockaBeseda(povzetek.tock)} · napak ${povzetek.napak} (akcija — predaja ne more potekti z odprto napako) · odprtih ${povzetek.odprtih} (akcija — čaka rešitev) · rešenih ${povzetek.resenih} (zgodovinska cona) · rešenost ${povzetek.resenostOdstotek} % (Σ rešenih / vseh točk) · statusi = ISTA besedila kot CSV izvoz (PUNCH_STATUS_LABELS EN VIR) · (referenčni pregled — VSE točke zapisnika, tudi rešene) · vir = /api/punch?projectId (resnica dostopa do projekta).`,
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

export interface ZapisnikStanjePdfOptions {
  /** Referenčni trenutek (žig + CreationDate + fileId + ime) — KOT
   *  PARAMETER (determinizem; vzorec R203/R244–R270). */
  now: Date
  /** Ime projekta — točno to, kar pokaže izbirnik (ali null/izostanek —
   *  list pošteno pokaže 'Brez imena projekta', R203 pariteta). */
  projektIme?: string | null
}

/** Ime datoteke — `Zapisnik-stanje-YYYY-MM-DD.pdf` (družinski vzorec;
 *  deterministično glede na `now`; EN now za žig IN ime — lekcija R121/R235;
 *  ločeno od predajnega 'PDF zapisnik' in CSV 'zapisnik_<projectId>_…'). */
export function zapisnikStanjePdfFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('zapisnikStanjePdfFilename: pričakovan veljaven now: Date')
  }
  return `Zapisnik-stanje-${todayStamp(now)}.pdf`
}

/** Zgeneriraj ZAPISNIK — STANJE PRED PREDAJO PDF (determinističen — enak
 *  vhod = bajtno enak dokument) in ga shrani. */
export function generateZapisnikStanjePdf(
  tocke: readonly PunchZapisnikVnos[],
  options: ZapisnikStanjePdfOptions,
): void {
  const doc = buildZapisnikStanjePdfDoc(tocke, options)
  doc.save(zapisnikStanjePdfFilename(options.now))
}
