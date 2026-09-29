// ---------------------------------------------------------------------------
// R272 (P1-f, 'izvozi' družina — 28. člen) — NAGIBI — TERENSKI PREGLED PDF iz
// Digitalna libela taba (inclinometer-tab.tsx). Vzorec zapisnik-stanje R271 /
// meritve-teren R269: ROKSAL glava, KPI 5, autoTable, sklep, noge, bajtni
// determinizem.
//
// EN VIR RESNICE (route NIČ — client+lib only):
//  • /api/slopes?projectId — FRESH fetch ISTEGA endpointa ob kliku (R244–R271
//    precedens): dokument = TRENUTNA resnica zgodovine nagibov ob kliku
//    (state 'saved' je lahko zastarel). Endpoint je projekt-obračunski
//    (assertProjectAccess read, R154 — vir poimenoval v sklepu);
//  • SMER EN VIR = smerLabel iz nagibi-csv.ts (R157 — IMPORT; R272 EXPORT
//    izvlečen iz buildNagibiCsv — R262 kolicinaNiz precedens; VEDANJE 1:1):
//    'X' → 'Naprej-nazaj', 'Y' → 'Levo-desno', katerakoli druga/null →
//    iskren odpad ('—' sivo na listu; CSV prazen stolpec — ISTA preslikava,
//    NI zasegane kopije). PDF ne more divergirati od CSV-ja;
//  • KOT EN VIR = kotStopinje (Number.isFinite — ISTA pravila kot CSV R157;
//    točno 1 decimalka toFixed(1) — ISTI format kot CSV IN UI značka);
//    ZNAK je del resnice (negativen kot = legitiem odčitek — CSV NE preverja
//    znaka, PDF tudi ne — iskreno f(vir));
//  • DATUM/URA = deterministično razčlenjevanje ISO (cenikDatumIso za datum
//    DD.MM.YYYY — brez locale; URA HH:MM iz ISO — čista JS, NIKOLI
//    toLocaleTimeString);
//  • VELJAVEN = DB resnica (Boolean @default true — POST ne zapisuje false;
//    UI IN CSV ne prikazujeta zastavice — PDF je NIKOLI tiho ne pokaže:
//    fail-closed preverba ne-boolean → TypeError, kondicionalna sklep resnica
//    + tabelarna AMBER bold vrstica SAMO kadar > 0 — iskren signal DB
//    resnice, brez izmišljenih alarmov).
//
// RED (izvožen + dokumentiran): createdAt DESC (najnovejši odčitek NA VRHU —
// ISTI red kot API orderBy { createdAt: 'desc' }; pregled želi zadnji terenski
// odčitek prvi) → id ASC (identiteta — istočasni odčitki = RAZLIČNE resnice).
// Referenčni pregled, NE rangiranje.
//
// ENA RESNICA (WYSIWYG):
//  • ISTA izpeljava nagibiTerenPregled poganja PDF KPI, tabelo, sklep,
//    mini-vrstico IN toast — ENA izpeljava (klicatelj jo požene ENKRAT in
//    podaja ISTO resnico naprej, R263/R266–R271 vzorec); mini-vrstica na
//    kartici (state 'saved') = ISTA izpeljava — dve okni (state vs FRESH
//    fetch), ENA matemtika.
//
// Načela (družinska pravila):
//  • Fail-closed: pokvaren vnos → TypeError z indeksom krivca (ne-finite kot,
//    ne-ISO datum, podvojen id, ne-nizovna besedilna polja, ne-boolean
//    veljaven). PRAZEN seznam ne nastaja dokumenta (družina: ni prazne
//    datoteke; komponenta pokaže iskren toast 'Ni vpisanih nagibov.').
//  • Determinizem: `now` KOT parameter; doc.setCreationDate(now) +
//    doc.setFileId(FNV-1a) — enak vhod = bajtno enak PDF (document-pdf R121).
//  • CLIENT-safe: čista JS FNV-1a; LASTNI soli **0xad–0xb0** (register:
//    punch-stanje 0xa9–0xac → nagibi-teren 0xad–0xb0 — ista semena v dveh
//    libih NE smejo dati isti ID).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { todayStamp } from './csv-export'
import { zalogaPovzetekCasOznaka } from './zaloga-povzetek'
import { cenikDatumIso } from './cenik-pdf'
import { smerLabel } from './nagibi-csv'

// ---------- barve (ISTI dokumenti družina — 0 novih hex) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const GREEN: [number, number, number] = [22, 163, 74] // roksal-green
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

export type NagibTerenVnos = {
  /** Identiteta odčitka (API). */
  id: string
  /** ISO datum/ura odčitka (API createdAt). */
  createdAt: string
  /** Kot v stopinjah (končno število — znak je del resnice; CSV R157 pravila). */
  kotStopinje: number
  /** Smer koda ('X' | 'Y' | druga koda = pokvaren vir → TypeError; null/izostanek = iskren odpad '—'). */
  smer?: string | null
  /** Lokacija opis ALI null/izostanek (iskren '—'). */
  lokacija?: string | null
  /** DB resnica (Boolean @default true; ne-boolean = pokvaren vir → TypeError). */
  veljaven?: boolean
}

export interface NagibTerenVrsta {
  /** ID (identiteta). */
  id: string
  /** Datum odčitka DD.MM.YYYY (iz ISO — cenikDatumIso). */
  datum: string
  /** Ura odčitka HH:MM (iz ISO — čista JS razčlenitev, brez locale). */
  ura: string
  /** ISO datum/ura (IZVOŽEN sort ključ — kronološka izenačba). */
  datumIso: string
  /** Kot z 1 decimalko (toFixed(1) — ISTI format kot CSV IN UI). */
  kot: string
  /** Smer besedilo — smerLabel EN VIR R157 (ALI null → '—' sivo). */
  smer: string | null
  /** Lokacija ALI null ('—'). */
  lokacija: string | null
  /** DB resnica veljaven (Boolean). */
  veljaven: boolean
}

export interface NagibiTerenPovzetek {
  /** Št. odčitkov (vse iz /api/slopes — polna resnica projekta). */
  nagibov: number
  /** Največji |kot| v stopinjah (1 dec — obseg odstopanja). */
  najvecjiKot: string
  /** Povprečni |kot| v stopinjah (1 dec — Σ resnica). */
  povprecniKot: string
  /** Št. veljavnih (GREEN — DB resnica). */
  veljavnih: number
  /** Št. neveljavnih (AMBER — DB resnica; POST ne zapisuje false — tipično 0). */
  neveljavnih: number
}

/** Fail-closed preverba ENEGA odčitka (indeks krivca VEDNO v sporočilu).
 *  Besedilna polja: niz ALI null/izostanek (pokvaren vir NE sme tiho priti
 *  na list kot String(number)); smer = EN VIR smerLabel preslikava — neznana
 *  NE-null koda = pokvaren vir (CSV bi jo zapisal prazno — dokument resnice
 *  je NE ugiba); veljaven = Boolean (ne-boolean → TypeError — R227 strogost). */
export function preveriNagibVnos(o: NagibTerenVnos, i: number): void {
  if (!o || typeof o !== 'object' || Array.isArray(o)) {
    throw new TypeError(`preveriNagibVnos (${i}): pričakovan nagib (NagibTerenVnos)`)
  }
  if (typeof o.id !== 'string' || o.id === '') {
    throw new TypeError(`preveriNagibVnos (${i}): id mora biti ne-prazen niz, ne ${String(o.id)}`)
  }
  if (typeof o.createdAt !== 'string' || o.createdAt === '') {
    throw new TypeError(`preveriNagibVnos (${i}): createdAt mora biti ISO niz, ne ${String(o.createdAt)}`)
  }
  if (typeof o.kotStopinje !== 'number' || !Number.isFinite(o.kotStopinje)) {
    throw new TypeError(`preveriNagibVnos (${i}): kotStopinje mora biti končno število, ne ${String(o.kotStopinje)}`)
  }
  if (o.smer !== null && o.smer !== undefined && typeof o.smer !== 'string') {
    throw new TypeError(`preveriNagibVnos (${i}): smer mora biti niz ALI null, ne ${String(o.smer)}`)
  }
  if (o.lokacija !== null && o.lokacija !== undefined && typeof o.lokacija !== 'string') {
    throw new TypeError(`preveriNagibVnos (${i}): lokacija mora biti niz ALI null, ne ${String(o.lokacija)}`)
  }
  if (typeof o.veljaven !== 'boolean') {
    throw new TypeError(`preveriNagibVnos (${i}): veljaven mora biti boolean (DB resnica), ne ${String(o.veljaven)}`)
  }
}

/** Ura HH:MM iz ISO niza — čista JS razčlenitev (NIKOLI toLocaleTimeString —
 *  locale ni determinističen med Node in brskalnikom). */
export function uraIso(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso)
  if (!m) {
    throw new TypeError(`uraIso: pričakovan ISO niz YYYY-MM-DDTHH:MM…, ne ${String(iso)}`)
  }
  return `${m[4]}:${m[5]}`
}

/** Zgodovina nagibov — ENA resnica za KPI, tabelo, sklep, mini-vrstico IN
 *  toast (WYSIWYG). Fail-verbose preverba VSEH vnosov; podvojen id = pokvaren
 *  vir fail-closed. Vrstica = VSI odčitki projekta (tudi označeni neveljavni
 *  — polna resnica). */
export function nagibiTerenPregled(
  nagibi: readonly NagibTerenVnos[],
): { vrste: NagibTerenVrsta[]; povzetek: NagibiTerenPovzetek } {
  if (!Array.isArray(nagibi)) {
    throw new TypeError('nagibiTerenPregled: pričakovano polje nagibov (NagibTerenVnos[])')
  }
  if (nagibi.length === 0) {
    throw new TypeError('nagibiTerenPregled: prazen seznam nagibov ne nastaja dokumenta — terenski pregled se izvozi, ko je vpisan prvi odčitek projekta (fail-closed)')
  }
  nagibi.forEach((o, i) => preveriNagibVnos(o, i))

  const vrste: NagibTerenVrsta[] = nagibi.map((o, i) => {
    // Datum EN VIR cenikDatumIso: ne-ISO → TypeError z indeksom+id krivca.
    let datum: string
    let ura: string
    try {
      datum = cenikDatumIso(o.createdAt)
      ura = uraIso(o.createdAt)
    } catch (e) {
      throw new TypeError(`nagib ${i} (id ${o.id}): ${e instanceof Error ? e.message : String(e)}`)
    }
    // Smer EN VIR R157 (smerLabel): neznana NE-null koda = pokvaren vir
    // (TypeError — CSV bi jo zapisal prazno, dokument resnice pa NE ugiba).
    let smer: string | null = null
    if (o.smer !== null && o.smer !== undefined) {
      const label = smerLabel(o.smer)
      if (label === '') {
        throw new TypeError(
          `nagibiTerenPregled (nagib ${i}, id ${o.id}): neznana smer: ${String(o.smer)}`,
        )
      }
      smer = label
    }
    return {
      id: o.id,
      datum,
      ura,
      datumIso: o.createdAt,
      kot: o.kotStopinje.toFixed(1),
      smer,
      lokacija: o.lokacija === undefined || o.lokacija === '' ? null : o.lokacija,
      veljaven: o.veljaven as boolean,
    }
  })

  // Podvojen id = pokvaren vir (dve vrstici za ISTO identiteto bi lažno
  // podvajali KPI in tabelo — fail-closed, NIKOLI tiho združevanje).
  const videni = new Set<string>()
  for (const v of vrste) {
    if (videni.has(v.id)) {
      throw new TypeError(`nagibiTerenPregled: podvojen id nagiba ${v.id} (pokvaren vir — identiteta mora biti edinstvena)`)
    }
    videni.add(v.id)
  }

  sortirajNagibiTeren(vrste)

  const najvecjiAbs = Math.max(...vrste.map((v) => Math.abs(Number(v.kot))))
  const povprecniAbs = vrste.reduce((s, v) => s + Math.abs(Number(v.kot)), 0) / vrste.length
  const neveljavnih = vrste.filter((v) => !v.veljaven).length
  const povzetek: NagibiTerenPovzetek = {
    nagibov: vrste.length,
    najvecjiKot: najvecjiAbs.toFixed(1),
    povprecniKot: povprecniAbs.toFixed(1),
    veljavnih: vrste.length - neveljavnih,
    neveljavnih,
  }
  return { vrste, povzetek }
}

/** Sort V LIBU — kronološko NARJUJOČE (najnovejši odčitek na vrhu — ISTI red
 *  kot API orderBy { createdAt: 'desc' }) → id ASC (identiteta). IZVOŽEN —
 *  determinizem = f(MNOŽICA vhodov). Referenčni pregled, NE rangiranje. */
export function sortirajNagibiTeren(vrste: NagibTerenVrsta[]): NagibTerenVrsta[] {
  return vrste.sort((a, b) => {
    // Najnovejši prvi (API red verbatim — pregled želi zadnji odčitek prvi).
    if (a.datumIso !== b.datumIso) return a.datumIso > b.datumIso ? -1 : 1
    // Izenačba datuma/ure → identiteta (ISTO točka je RAZLIČNA resnica).
    if (a.id !== b.id) return a.id < b.id ? -1 : 1
    return 0
  })
}

/** Sklanjatev nagibov za žeton IN sklep (iskrene oznake; 101 = 'sto EN
 *  nagib' — pariteta clanBeseda R268 / tockaBeseda R271). */
export function nagibBeseda(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError(`nagibBeseda: pričakovano ne-negativno celo število: ${String(n)}`)
  }
  const enice = n % 10
  const zadnjiDve = n % 100
  if (enice === 1 && zadnjiDve !== 11) return `${n} nagib`
  if (enice === 2 && zadnjiDve !== 12) return `${n} nagiba`
  if ((enice === 3 || enice === 4) && zadnjiDve !== 13 && zadnjiDve !== 14) {
    return `${n} nagibi`
  }
  return `${n} nagibov`
}

/** Determinističen file-ID (32 hex) — čista JS FNV-1a; LASTNI soli 0xad–0xb0. */
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
    fnv1aHex(seed, 0xad) +
    fnv1aHex(seed, 0xae) +
    fnv1aHex(seed, 0xaf) +
    fnv1aHex(seed, 0xb0)
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

/** KPI polje — ISTI vzorec kot zapisnik-stanje/meritve-teren/inventura. */
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

export interface NagibiTerenPdfOptions {
  /** Referenčni trenutek (žig + CreationDate + fileId + ime) — KOT
   *  PARAMETER (determinizem; vzorec R203/R244–R271). */
  now: Date
  /** Ime projekta — točno to, kar pokaže izbirnik (ali null/izostanek —
   *  list pošteno pokaže 'Brez imena projekta', R203 pariteta). */
  projektIme?: string | null
}

/** Zgradi NAGIBI — TERENSKI PREGLED dokument (brez shranjevanja) — vrne jsPDF
 *  instanco (testi berejo doc.output('arraybuffer') → bajtni dokazi). */
export function buildNagibiTerenPdfDoc(
  nagibi: readonly NagibTerenVnos[],
  options: NagibiTerenPdfOptions,
): jsPDF {
  if (!Array.isArray(nagibi)) {
    throw new TypeError('buildNagibiTerenPdfDoc: pričakovano polje nagibov')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildNagibiTerenPdfDoc: pričakovane opcije (NagibiTerenPdfOptions)')
  }
  const { now, projektIme } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildNagibiTerenPdfDoc: pričakovan veljaven now: Date')
  }
  if (projektIme !== null && projektIme !== undefined && typeof projektIme !== 'string') {
    throw new TypeError('buildNagibiTerenPdfDoc: projektIme mora biti niz ALI null')
  }
  // PRAZEN seznam ne nastaja dokumenta (družina: ni prazne datoteke —
  // komponenta pokaže iskren toast 'Ni vpisanih nagibov.').
  if (nagibi.length === 0) {
    throw new TypeError(
      'buildNagibiTerenPdfDoc: prazen seznam nagibov ne nastaja dokumenta — komponenta pokaže iskren toast (Ni vpisanih nagibov.)',
    )
  }
  const { vrste, povzetek } = nagibiTerenPregled(nagibi)
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
  // red odgovora (R248/R262/R264–R271 vzorec). Kot je končno število
  // (preveriNagibVnos) — varen seed vnos.
  const kanonNagibi = [...nagibi].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  doc.setFileId(
    deterministichenId(
      `${now.toISOString()}|N:${imeProjekta}:${kanonNagibi
        .map((o) => `${o.id}/${o.kotStopinje}/${o.smer === null || o.smer === undefined ? 'null' : o.smer}/${o.veljaven === undefined ? 'undefined' : o.veljaven}/${o.createdAt}`)
        .join(',')}`,
    ),
  )

  // ---------- glava (ISTI vzorec kot zapisnik-stanje/meritve-teren) ----------
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
  doc.text('NAGIBI — TERENSKI PREGLED', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })
  doc.setFontSize(9)
  doc.text(`projekt: ${imeProjekta}`, 196, 24.5, { align: 'right' })

  // ---------- KPI 5 (signalni jezik: NAVY = obseg in Σ odstopanja; GREEN =
  //  veljavni odčitki; AMBER = označeni neveljavni SAMO kadar > 0 — DB
  //  resnica, POST ne zapisuje false — tipično 0; NIKOLI lažni alarm) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Povzetek terena')
  const bw = 33
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Nagibov', String(povzetek.nagibov), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Največji kot', `${povzetek.najvecjiKot}°`, NAVY)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Povprečni kot', `${povzetek.povprecniKot}°`, NAVY)
  kpiBox(doc, 14 + 3 * (bw + gap), y, bw, bh, 'Veljavnih', String(povzetek.veljavnih), GREEN)
  kpiBox(doc, 14 + 4 * (bw + gap), y, bw, bh, 'Neveljavnih', String(povzetek.neveljavnih), povzetek.neveljavnih > 0 ? AMBER : GREEN)
  y += bh + 8

  // ---------- tabela odčitkov (kronološko narjajoče — najnovejši prvi;
  //  ISTI red kot API orderBy desc; glava = CSV pariteta ×5) ----------
  y = sectionTitle(doc, y, `Zgodovina odčitkov (${vrste.length})`)
  autoTable(doc, {
    startY: y,
    head: [['Datum', 'Ura', 'Kot (stopinje)', 'Smer', 'Lokacija']],
    body: vrste.map((v) => [
      v.datum,
      v.ura,
      v.kot,
      v.smer ?? '—',
      v.lokacija ?? '—',
    ]),
    styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
    didParseCell: (data) => {
      // WYSIWYG: neveljaven odčitek = AMBER bold vrstica (DB resnica —
      // iskren signal; POST ne zapisuje false — tipično ničesar); smer/
      // lokacija null = '—' sivo (iskren odpad).
      if (data.section !== 'body') return
      const v = vrste[data.row.index]
      if (!v) return
      const raw = String(data.cell.raw ?? '')
      if (!v.veljaven) {
        data.cell.styles.textColor = AMBER
        data.cell.styles.fontStyle = 'bold'
        return
      }
      if ((data.column.index === 3 || data.column.index === 4) && raw === '—') {
        data.cell.styles.textColor = GRAY
      }
    },
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 6

  // ---------- sklepna vrstica (iskren podpis — resnice poimenovane) ----------
  if (y > 255) {
    doc.addPage()
    y = 20
  }
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  const neveljavniSklep =
    povzetek.neveljavnih > 0
      ? ` · neveljavnih ${povzetek.neveljavnih} (označeni sumljivi odčitki — DB resnica)`
      : ''
  doc.text(
    `${nagibBeseda(povzetek.nagibov)} · največji |kot| ${povzetek.najvecjiKot}° (obseg odstopanja — absolutna vrednost) · povprečni |kot| ${povzetek.povprecniKot}° (Σ |kot| / št. odčitkov) · veljavnih ${povzetek.veljavnih} (DB resnica)${neveljavniSklep} · smer = ISTA preslikava kot CSV izvoz (smerLabel EN VIR — 'X' naprej-nazaj, 'Y' levo-desno) · (referenčni pregled — VSI nagibi projekta, tudi označeni neveljavni) · vir = /api/slopes?projectId (resnica dostopa do projekta).`,
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

/** Ime datoteke — `Nagibi-teren-YYYY-MM-DD.pdf` (družinski vzorec;
 *  deterministično glede na `now`; EN now za žig IN ime — lekcija R121/R235;
 *  ločeno od CSV 'nagibi_<projectId>_…'). */
export function nagibiTerenPdfFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('nagibiTerenPdfFilename: pričakovan veljaven now: Date')
  }
  return `Nagibi-teren-${todayStamp(now)}.pdf`
}

/** Zgeneriraj NAGIBI — TERENSKI PREGLED PDF (determinističen — enak vhod =
 *  bajtno enak dokument) in ga shrani. */
export function generateNagibiTerenPdf(
  nagibi: readonly NagibTerenVnos[],
  options: NagibiTerenPdfOptions,
): void {
  const doc = buildNagibiTerenPdfDoc(nagibi, options)
  doc.save(nagibiTerenPdfFilename(options.now))
}
