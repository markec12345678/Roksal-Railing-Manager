// ---------------------------------------------------------------------------
// R269 (P1-f, 'izvozi' družina — 25. člen) — MERITVE — TERENSKI PREGLED PDF iz
// Meritve taba (measurements-tab.tsx). Vzorec ekipa-stanje-pdf R268 /
// ponudbe-spomniki-pdf R267 / oprema-cikel-pdf R266: ROKSAL glava, KPI 5,
// autoTable, sklep, noge, bajtni determinizem.
//
// EN VIR RESNICE (route NIČ — client+lib only):
//  • /api/measurements?projectId — FRESH fetch ISTEGA endpointa ob kliku
//    (R244/R245/R264–R268 precedens: FRESH-podatki ob kliku, nič state-a,
//    nič nove mreže) — dokument = TRENUTNA resnica projekta ob kliku (state
//    kartice je filtriran in lahko zastarel); resnica dostopa: endpoint je
//    projekt-obračunski (assertProjectAccess read — vir poimenoval v sklepu);
//  • VRSTICE EN VIR = meritevVrstica iz meritve-csv.ts (R186 — IMPORT, NI
//    zasegane kopije; R263/R267/R268 precedens): vsaka vrstica lista nastane
//    PREK ISTEGA graditelja vrstic kot CSV arhiv — ISTI fallbacki (status
//    brez vrednosti = OSNUTEK, tip brez vrednosti = RAZDALJA), ISTA
//    fail-closed validacija fizikalnih mer (ne-negativna končna mm, veljaven
//    ISO datum, ne-prazen id). PDF ne more divergirati od CSV-ja: kar gre v
//    arhiv, gre enako na list. Status/tip na listu = KODA VERBATIM (ista
//    koda kot CSV arhiv — arhivna resnica, ni kopije UI oznak);
//  • STATUSI EN VIR = MEASUREMENT_STATUS_VALUES iz measurement-status.ts
//    (R154 — IMPORT — 3 znanih: OSNUTEK/POTRJENA/ARHIVIRANA); neznani status
//    (za fallbackom R186) = pokvaren vir → TypeError z indeksom krivca
//    (CSV kodo zapiše verbatim, dokument resnice pa je ne izvozi);
//  • SKLANJATEV ENA = meritvePovzetekBeseda iz meritve-povzetek.ts (R203 —
//    IMPORT — toast IN sklep IN mini-vrstica; 1 meritev / 2 meritvi /
//    3-4 meritve / 5+ meritev).
//
// AKCIJSKI SORT (izvožen + dokumentiran): OSNUTEK (0 — akcija: pregled in
// potrditev, da so mere pripravljene za izdelavo) → POTRJENA (1 — pripravljeno)
// → ARHIVIRANA (2 — zgodovinska cona na dnu); nato oznaka ASC (code-unit,
// brez locale; BREZ oznake = iskren odpad — ZADNJA cona, ne prva) → createdAt
// ASC (kronološko branje terena — najstarejša meritev prva) → id ASC
// (identiteta — istonaslovni = RAZLIČNI resnici). Referenčni pregled, NE
// rangiranje.
//
// ENA RESNICA (WYSIWYG):
//  • ISTA izpeljava meritevTerenPregled poganja PDF KPI, tabelo, sklep, mini-
//    vrstico IN toast — ENA izpeljava (klicatelj jo požene ENKRAT in podaja
//    ISTO resnico naprej, R263/R266–R268 vzorec); mini-vrstica na kartici
//    (state — viden seznam po filtrih) = ISTA izpeljava čez ISTI prune — dve
//    okni (state vs FRESH fetch), ENA matemtika (obe poimenovani po viru).
//
// Načela (družinska pravila):
//  • Fail-closed: pokvaren vnos → TypeError z indeksom krivca (fizikalne
//    mere prek meritevVrstica R186, neznani status, podvojen id = pokvaren
//    vir, ne-nizovna besedilna polja). PRAZEN SEZNAM meritev ne nastaja
//    dokumenta (družina: ni prazne datoteke; komponenta pokaže iskren toast
//    'Ni vpisanih meritev.').
//  • Determinizem: `now` KOT parameter; doc.setCreationDate(now) +
//    doc.setFileId(FNV-1a) — enak vhod = bajtno enak PDF (document-pdf R121).
//  • CLIENT-safe: čista JS FNV-1a; LASTNI soli **0xa1–0xa4** (register:
//    … ekipa-stanje 0x9d–0xa0 → meritve-teren 0xa1–0xa4 — ista semena v dveh
//    libih NE smejo dati isti ID).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { todayStamp } from './csv-export'
import { zalogaPovzetekCasOznaka } from './zaloga-povzetek'
import { cenikDatumIso } from './cenik-pdf'
import { meritevVrstica, type MeritevZaIzvoz } from './meritve-csv'
import { MEASUREMENT_STATUS_VALUES, type MeasurementStatusValue } from './measurement-status'
import { meritvePovzetekBeseda } from './meritve-povzetek'

// ---------- barve (ISTI dokumenti družina — 0 novih hex) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const GREEN: [number, number, number] = [22, 163, 74] // roksal-green
const RED: [number, number, number] = [220, 38, 38] // zaloga-pdf R120 red
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

/** Akcijski red statusov (ISTI 3 znani iz MEASUREMENT_STATUS_VALUES R154 —
 *  preverba pokritosti je tipovna: Record<MeasurementStatusValue, number> se
 *  NE prevede, če status manjka). Osnutek = akcija (AMBER — pregled in
 *  potrditev); Potrjena = pripravljeno (GREEN); Arhivirana = zgodovinska
 *  cona (sivo). RED ostaja rezerviran za fizikalno pokvarjene mere — tiste
 *  sploh ne pridejo na list (fail-closed R186). */
const AKCIJSKI_RED: Record<MeasurementStatusValue, number> = {
  OSNUTEK: 0,
  POTRJENA: 1,
  ARHIVIRANA: 2,
}

export type MeritveTerenVnos = MeritevZaIzvoz

export interface MeritveTerenPdfOptions {
  /** Referenčni trenutek (žig + CreationDate + fileId + ime) — KOT
   *  PARAMETER (determinizem; vzorec R203/R244–R268). */
  now: Date
  /** Ime projekta — točno to, kar pokaže izbirnik (ali null/izostanek —
   *  list pošteno pokaže 'Brez imena projekta', R203 pariteta). */
  projektIme?: string | null
}

/** Fail-closed preverba ENE meritve (indeks krivca VEDNO v sporočilu).
 *  Besedilna polja: niz ALI null/izostanek (pokvaren vir NE sme tiho priti
 *  na list kot String(number)). Fizikalne mere + datum + id preveri EN VIR
 *  meritevVrstica (R186). */
export function preveriMeritevVnos(o: MeritveTerenVnos, i: number): void {
  if (!o || typeof o !== 'object' || Array.isArray(o)) {
    throw new TypeError(`preveriMeritevVnos (${i}): pričakovana meritev (MeritveTerenVnos)`)
  }
  for (const [ime, v] of [
    ['tipMeritve', o.tipMeritve],
    ['oznaka', o.oznaka],
    ['status', o.status],
    ['lokacija', o.lokacija],
    ['opomba', o.opomba],
    ['tipPodlage', o.tipPodlage],
  ] as const) {
    if (v !== null && v !== undefined && typeof v !== 'string') {
      throw new TypeError(`preveriMeritevVnos (${i}): ${ime} mora biti niz ALI null, ne ${String(v)}`)
    }
  }
}

export interface MeritveTerenVrsta {
  /** ID (identiteta). */
  id: string
  /** Datum meritve DD.MM.YYYY (iz ISO R186 vrstice). */
  datum: string
  /** ISO datum (IZVOŽEN sort ključ — kronološka izenačba, R186 vrstica). */
  datumIso: string
  /** Oznaka ALI null ('—' na listu — iskren odpad). */
  oznaka: string | null
  /** Tip meritev — KODA VERBATIM (CSV arhiv pariteta; brez vrednosti = RAZDALJA). */
  tip: string
  /** Dolžina mm (kanonična enota — fizikalna resnica). */
  dolzinaMm: number
  /** Višina mm (kanonična enota — fizikalna resnica). */
  visinaMm: number
  /** Status — EN VIR R154 (3 znani; brez vrednosti = OSNUTEK). */
  status: MeasurementStatusValue
  /** Lokacija ALI null ('—'). */
  lokacija: string | null
  /** Opomba ALI null ('—'). */
  opomba: string | null
  /** Akcijski red (manjša = prej — akcijska cona na vrhu). */
  akcijskiRed: number
}

export interface MeritveTerenPovzetek {
  /** Št. meritev (vse iz /api/measurements — polna resnica projekta). */
  meritev: number
  /** Št. osnutkov (AMBER — akcija: pregled in potrditev). */
  osnutkov: number
  /** Št. potrjenih (GREEN — pripravljeno za pripravo izdelave). */
  potrjenih: number
  /** Št. arhiviranih (zgodovinska cona). */
  arhiviranih: number
  /** Σ dolžin vseh meritev v mm (fizikalna resnica terena — kanonične enote). */
  skupnaDolzinaMm: number
  /** Št. RAZLIČNIH tipov meritev (referenčna resnica). */
  tipov: number
}

/** Terenski pregled meritev — ENA resnica za KPI, tabelo, sklep, mini-vrstico
 *  IN toast (WYSIWYG). Fail-verbose preverba VSEH vnosov; podvojen id =
 *  pokvaren vir fail-closed. Vrstica = VSA meritev projekta (tudi
 *  ARHIVIRANE — polna resnica, ne samo viden seznam filtrov). */
export function meritevTerenPregled(
  meritve: readonly MeritveTerenVnos[],
): { vrste: MeritveTerenVrsta[]; povzetek: MeritveTerenPovzetek } {
  if (!Array.isArray(meritve)) {
    throw new TypeError('meritevTerenPregled: pričakovano polje meritev (MeritveTerenVnos[])')
  }
  if (meritve.length === 0) {
    throw new TypeError('meritevTerenPregled: prazen seznam meritev ne nastaja dokumenta — terenski pregled se izvozi, ko je vpisana prva meritev projekta (fail-closed)')
  }
  meritve.forEach((o, i) => preveriMeritevVnos(o, i))

  const vrste: MeritveTerenVrsta[] = meritve.map((o, i) => {
    // EN VIR R186: vrstica nastane PREK ISTEGA graditelja kot CSV arhiv
    // (ISTA validacija fizikalnih mer + ISTI fallbacki). Napaka dobi indeks
    // krivca (meritevVrstica ga nima — ovijemo).
    let r: string[]
    try {
      r = meritevVrstica(o)
    } catch (e) {
      throw new TypeError(`meritev ${i}: ${e instanceof Error ? e.message : String(e)}`)
    }
    // r = [datum, oznaka, tip, dolzina, visina, kot, stebrov, podlaga, enota,
    //      originalna, tipStebra, material, visinaStebra, pozicija,
    //      notranjiKot, zunanjiKot, status, lokacija, opomba]
    const status = r[16]
    if (!(MEASUREMENT_STATUS_VALUES as readonly string[]).includes(status)) {
      throw new TypeError(
        `meritev ${i}: status mora biti eden izmed ${MEASUREMENT_STATUS_VALUES.length} znanih (${MEASUREMENT_STATUS_VALUES.join('/')}), ne ${status}`,
      )
    }
    return {
      id: o.id,
      datum: cenikDatumIso(r[0]),
      datumIso: r[0],
      oznaka: r[1] === '' ? null : r[1],
      tip: r[2],
      dolzinaMm: o.dolzinaMm,
      visinaMm: o.visinaMm,
      status: status as MeasurementStatusValue,
      lokacija: r[17] === '' ? null : r[17],
      opomba: r[18] === '' ? null : r[18],
      akcijskiRed: AKCIJSKI_RED[status as MeasurementStatusValue],
    }
  })

  // Podvojen id = pokvaren vir (dve vrstici za ISTO identiteto bi lažno
  // podvajali KPI in tabelo — fail-closed, NIKOLI tiho združevanje).
  const videni = new Set<string>()
  for (const v of vrste) {
    if (videni.has(v.id)) {
      throw new TypeError(`meritevTerenPregled: podvojen id meritve ${v.id} (pokvaren vir — identiteta mora biti edinstvena)`)
    }
    videni.add(v.id)
  }

  sortirajMeritveTeren(vrste)

  const povzetek: MeritveTerenPovzetek = {
    meritev: vrste.length,
    osnutkov: vrste.filter((v) => v.status === 'OSNUTEK').length,
    potrjenih: vrste.filter((v) => v.status === 'POTRJENA').length,
    arhiviranih: vrste.filter((v) => v.status === 'ARHIVIRANA').length,
    skupnaDolzinaMm: vrste.reduce((s, v) => s + v.dolzinaMm, 0),
    tipov: new Set(vrste.map((v) => v.tip)).size,
  }
  return { vrste, povzetek }
}

/** Sort V LIBU — akcijski red: (1) status po akcijski teži (OSNUTEK — akcija
 *  → POTRJENA → ARHIVIRANA — zgodovinska cona na dnu), (2) oznaka ASC
 *  (navadno < po UTF-16 kodnih točkah — brez locale; BREZ oznake = iskren
 *  odpad — ZADNJA cona), (3) createdAt ASC (kronološko branje terena),
 *  (4) id ASC (identiteta). IZVOŽEN — determinizem = f(MNOŽICA vhodov).
 *  Referenčni pregled, NE rangiranje. */
export function sortirajMeritveTeren(vrste: MeritveTerenVrsta[]): MeritveTerenVrsta[] {
  return vrste.sort((a, b) => {
    if (a.akcijskiRed !== b.akcijskiRed) return a.akcijskiRed - b.akcijskiRed
    // Brez oznake → ZADNJA cona znotraj statusa (iskren odpad na koncu).
    if (a.oznaka === null && b.oznaka !== null) return 1
    if (b.oznaka === null && a.oznaka !== null) return -1
    if (a.oznaka !== null && b.oznaka !== null && a.oznaka !== b.oznaka) {
      return a.oznaka < b.oznaka ? -1 : 1
    }
    // Izenačba oznak → kronološko branje terena (najstarejša meritev prva).
    if (a.datumIso !== b.datumIso) return a.datumIso < b.datumIso ? -1 : 1
    // Izenačba datuma → identiteta (ISTO meritev je RAZLIČNA resnica).
    if (a.id !== b.id) return a.id < b.id ? -1 : 1
    return 0
  })
}

/** Sklanjatev osnutkov za žeton IN sklep (iskrene oznake; 101 = 'sto EN
 *  osnutek' — pariteta clanBeseda R268 / ponudbeLabel R161). */
export function osnutekBeseda(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError(`osnutekBeseda: pričakovano ne-negativno celo število: ${String(n)}`)
  }
  const enice = n % 10
  const zadnjiDve = n % 100
  if (enice === 1 && zadnjiDve !== 11) return `${n} osnutek`
  if (enice === 2 && zadnjiDve !== 12) return `${n} osnutka`
  if ((enice === 3 || enice === 4) && zadnjiDve !== 13 && zadnjiDve !== 14) {
    return `${n} osnutki`
  }
  return `${n} osnutkov`
}

/** Determinističen file-ID (32 hex) — čista JS FNV-1a; LASTNI soli 0xa1–0xa4. */
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
    fnv1aHex(seed, 0xa1) +
    fnv1aHex(seed, 0xa2) +
    fnv1aHex(seed, 0xa3) +
    fnv1aHex(seed, 0xa4)
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

/** KPI polje — ISTI vzorec kot prihodki/narocila/ekipa-stanje družina. */
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

/** Zgradi MERITVE — TERENSKI PREGLED dokument (brez shranjevanja) — vrne jsPDF
 *  instanco (testi berejo doc.output('arraybuffer') → bajtni dokazi). */
export function buildMeritveTerenPdfDoc(
  meritve: readonly MeritveTerenVnos[],
  options: MeritveTerenPdfOptions,
): jsPDF {
  if (!Array.isArray(meritve)) {
    throw new TypeError('buildMeritveTerenPdfDoc: pričakovano polje meritev')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildMeritveTerenPdfDoc: pričakovane opcije (MeritveTerenPdfOptions)')
  }
  const { now, projektIme } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildMeritveTerenPdfDoc: pričakovan veljaven now: Date')
  }
  if (projektIme !== null && projektIme !== undefined && typeof projektIme !== 'string') {
    throw new TypeError('buildMeritveTerenPdfDoc: projektIme mora biti niz ALI null')
  }
  // PRAZEN SEZNAM meritev ne nastaja dokumenta (družina: ni prazne datoteke —
  // komponenta pokaže iskren toast 'Ni vpisanih meritev.').
  if (meritve.length === 0) {
    throw new TypeError(
      'buildMeritveTerenPdfDoc: prazen seznam meritev ne nastaja dokumenta — komponenta pokaže iskren toast (Ni vpisanih meritev.)',
    )
  }
  const { vrste, povzetek } = meritevTerenPregled(meritve)
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
  // red odgovora (R248/R262/R264–R268 vzorec). Oznaka null-safe.
  const kanonMeritve = [...meritve].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  doc.setFileId(
    deterministichenId(
      `${now.toISOString()}|M:${imeProjekta}:${kanonMeritve
        .map(
          (o) =>
            `${o.id}/${o.status === null || o.status === undefined ? 'null' : o.status}/${o.tipMeritve === null || o.tipMeritve === undefined ? 'null' : o.tipMeritve}/${o.dolzinaMm}/${o.visinaMm}/${o.oznaka === null || o.oznaka === undefined ? 'null' : o.oznaka}/${o.createdAt}`,
        )
        .join(',')}`,
    ),
  )

  // ---------- glava (ISTI vzorec kot ekipa-stanje/ponudbe-spomniki) ----------
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
  doc.text('MERITVE — TERENSKI PREGLED', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })
  doc.setFontSize(9)
  doc.text(`projekt: ${imeProjekta}`, 196, 24.5, { align: 'right' })

  // ---------- KPI 5 (signalni jezik: AMBER = akcija — osnutki čakajo
  //  potrditev; GREEN = potrjene, pripravljene za izdelavo; NAVY = obseg in
  //  fizikalna resnica; arhivirane = zgodovina → sklep, NE lažni alarm) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Povzetek terena')
  const bw = 33
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Meritev', String(povzetek.meritev), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Osnutki', String(povzetek.osnutkov), povzetek.osnutkov > 0 ? AMBER : GREEN)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Potrjenih', String(povzetek.potrjenih), GREEN)
  kpiBox(doc, 14 + 3 * (bw + gap), y, bw, bh, 'Arhiviranih', String(povzetek.arhiviranih), NAVY)
  kpiBox(doc, 14 + 4 * (bw + gap), y, bw, bh, 'Skupna dolžina', `${(povzetek.skupnaDolzinaMm / 1000).toFixed(2)} m`, NAVY)
  y += bh + 8

  // ---------- tabela meritev (akcijski red: osnutki na vrhu — akcija;
  //  brez oznake = iskren odpad na koncu; VSA meritev projekta) ----------
  y = sectionTitle(doc, y, `Meritve (${vrste.length})`)
  autoTable(doc, {
    startY: y,
    head: [['Datum', 'Oznaka', 'Tip', 'Dolžina (mm)', 'Višina (mm)', 'Status', 'Lokacija', 'Opomba']],
    body: vrste.map((v) => [
      v.datum,
      v.oznaka ?? '—',
      v.tip,
      String(v.dolzinaMm),
      String(v.visinaMm),
      v.status,
      v.lokacija ?? '—',
      v.opomba ?? '—',
    ]),
    styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
    didParseCell: (data) => {
      // WYSIWYG: OSNUTEK AMBER bold (akcija — čaka potrditev); POTRJENA
      // GREEN (pripravljeno); ARHIVIRANA sivo (zgodovinska cona); '—' sivo
      // (iskren odpad).
      if (data.section !== 'body') return
      const v = vrste[data.row.index]
      if (!v) return
      const raw = String(data.cell.raw ?? '')
      if (data.column.index === 5) {
        if (v.status === 'OSNUTEK') {
          data.cell.styles.textColor = AMBER
          data.cell.styles.fontStyle = 'bold'
        } else if (v.status === 'POTRJENA') {
          data.cell.styles.textColor = GREEN
        } else if (v.status === 'ARHIVIRANA') {
          data.cell.styles.textColor = GRAY
        }
      }
      if ((data.column.index === 1 || data.column.index === 6 || data.column.index === 7) && raw === '—') {
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
    `${meritvePovzetekBeseda(povzetek.meritev)} · osnutki ${povzetek.osnutkov} (akcija — pregled in potrditev) · potrjenih ${povzetek.potrjenih} (pripravljeno za pripravo izdelave) · arhiviranih ${povzetek.arhiviranih} (zgodovinska cona) · skupna dolžina ${(povzetek.skupnaDolzinaMm / 1000).toFixed(2)} m (Σ vseh meritev — kanonične enote mm) · tipov ${povzetek.tipov} (polna podrobnost tipov v CSV arhivu) · statusi in tipi = kode VERBATIM (ista resnica kot CSV izvoz) · (referenčni pregled — VSE meritve projekta, tudi arhivirane) · vir = /api/measurements?projectId (resnica dostopa do projekta).`,
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

/** Ime datoteke — `Meritve-teren-YYYY-MM-DD.pdf` (družinski vzorec;
 *  deterministično glede na `now`; EN now za žig IN ime — lekcija R121/R235). */
export function meritveTerenPdfFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('meritveTerenPdfFilename: pričakovan veljaven now: Date')
  }
  return `Meritve-teren-${todayStamp(now)}.pdf`
}

/** Zgeneriraj MERITVE — TERENSKI PREGLED PDF (determinističen — enak vhod =
 *  bajtno enak dokument) in ga shrani. */
export function generateMeritveTerenPdf(
  meritve: readonly MeritveTerenVnos[],
  options: MeritveTerenPdfOptions,
): void {
  const doc = buildMeritveTerenPdfDoc(meritve, options)
  doc.save(meritveTerenPdfFilename(options.now))
}
