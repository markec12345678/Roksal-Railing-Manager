// ---------------------------------------------------------------------------
// R270 (P1-f, 'izvozi' družina — 26. člen) — INVENTURA — PREMOŽENJSKI PREGLED
// PDF iz Zaloge (inventory-tab.tsx). Vzorec meritve-teren-pdf R269 /
// ekipa-stanje-pdf R268 / ponudbe-spomniki-pdf R267: ROKSAL glava, KPI 5,
// autoTable, sklep, noge, bajtni determinizem.
//
// DRUGA REZINA ISTEGA VIRA (route NIČ — client+lib only):
//  • R262 'ZALOGA — OSNUTEK POKRITOST' je pokritost (koliko osnutkov naročil
//    pokriva deficit) — PRESEK dveh virov. R270 je PREMOŽENJE (kaj DEJANSKO
//    imamo v skladišču zdaj) — EN vir: GET /api/inventory FRESH ob kliku
//    (R244/R245/R264–R269 precedens: FRESH-podatki ob kliku, nič state-a,
//    nič nove mreže) — dokument = TRENUTNA resnica skladišča ob kliku
//    (state kartice je filtriran in lahko zastarel; R234 'Stanje zaloge
//    PDF' je namenoma viden seznam po filtrih — R270 je polna resnica VSEH
//    premoženj, druga vrata, drugačna vprasanja);
//  • STATUSI EN VIR (R219 čip pariteta — ISTA predikatna resnica kot
//    dvostopenjsko filtriranje zaloge): POD MINIMUMOM (zaloga < minimum —
//    akcija: naroči, manjka > 0) / NA MEJI (zaloga === minimum — pozornost:
//    naslednja poraba pusti pod; manjka 0) / ZADOSTNO (zaloga > minimum —
//    zdrava zaloga). Predikata <= in === iz R219 čipov sta ISTA — trojna
//    razčlenitev je refinirana resnica ISTE meje; pokritje 'nizka zaloga'
//    (≤ minimum — rdeči čip/dot) = pod minimumom + na meji, POIMENOVANO v
//    sklepu (WYSIWYG — dokument NE laže o tem, kaj je UI rdeče). Robni
//    primer zaloga = minimum = 0 → NA MEJI po ISTEM predikatu (iskreno:
//    točno na meji, brez pravila — NIKOLI poseben lažni status);
//  • OBRAT EN VIR = _count.movements (števec VSEH zabeleženih premikov
//    artikla — include 'take 10' omejuje SAMO seznam, ne števca; Σ po
//    artikelih = obrat skladišča, največji obrat poimenovan v sklepu);
//  • FORMAT EN VIR = kolicinaNiz iz zaloga-osnutek-pdf R262 (IMPORT — NI
//    zasegane kopije; količine so lahko necela — Float: celo → String,
//    sicer 2 decimalna mesti brez locale).
//
// AKCIJSKI SORT (izvožen + dokumentiran): POD MINIMUMOM (0 — akcija: naroči
// pred naslednjo porabo) → NA MEJI (1 — pozornost) → ZADOSTNO (2 — zdrava
// cona); nato šifra ASC (računovodski red zaloge — R262 pariteta; šifra je
// @unique v shemi → totálni red za veljavne podatke; podvojen šifra =
// pokvaren vir → TypeError) → id ASC (identiteta — determinističen
// tiebreak). Referenčni pregled, NE rangiranje.
//
// ENA RESNICA (WYSIWYG):
//  • ISTA izpeljava inventuraPregled poganja PDF KPI, tabelo, sklep,
//    mini-vrstico IN toast — ENA izpeljava (klicatelj jo požene ENKRAT in
//    podaja ISTO resnico naprej, R263/R266–R269 vzorec); mini-vrstica na
//    kartici (viden seznam po filtrih) = ISTA izpeljava čez ISTI prune —
//    dve okni (state vs FRESH fetch), ENA matemtika (obe poimenovani po
//    viru).
//
// Načela (družinska pravila):
//  • Fail-closed: pokvaren vnos → TypeError z indeksom krivca (ne-prazni
//    nizi, končno ne-negativne količine, premiki ne-negativno celo število,
//    podvojen id ALI šifra = pokvaren vir). PRAZEN SEZNAM artiklov ne
//    nastaja dokumenta (družina: ni prazne datoteke; komponenta pokaže
//    iskren toast 'Ni vpisanih artiklov.').
//  • Determinizem: `now` KOT parameter; doc.setCreationDate(now) +
//    doc.setFileId(FNV-1a) — enak vhod = bajtno enak PDF (document-pdf R121).
//  • CLIENT-safe: čista JS FNV-1a; LASTNI soli **0xa5–0xa8** (register:
//    … meritve-teren 0xa1–0xa4 → inventura-pregled 0xa5–0xa8 — ista semena
//    v dveh libih NE smejo dati isti ID).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { todayStamp } from './csv-export'
import { zalogaPovzetekCasOznaka } from './zaloga-povzetek'
import { kolicinaNiz } from './zaloga-osnutek-pdf'

// ---------- barve (ISTI dokumenti družina — 0 novih hex) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const GREEN: [number, number, number] = [22, 163, 74] // roksal-green
const RED: [number, number, number] = [220, 38, 38] // zaloga-pdf R120 red
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

/** Client-safe prerez ENEGA zalogovnega artikla (podmnožica GET
 *  /api/inventory + _count.movements). `tip` = LABEL (ISTA preslikava kot
 *  zaloga CSV R136 / PDF R234 — preslikava je komponentna resnica; neznana
 *  koda verbatim — iskren fallback, NIČ izmišljenega). */
export interface InventuraArtikel {
  /** ID artikla (ne-prazen — IDENTITETA). */
  id: string
  /** Šifra materiala (ne-prazen — sort ključ; @unique v shemi). */
  sifraMateriala: string
  /** Naziv artikla (ne-prazen). */
  naziv: string
  /** Tip kot LABEL (ne-prazen). */
  tip: string
  /** Enota (ne-prazna — kos/m/…). */
  enota: string
  /** Trenutna zaloga (končno ne-negativna — Float). */
  kolicinaZaloga: number
  /** Minimalna zaloga (končno ne-negativna — Float, default 5). */
  minimalnaZaloga: number
  /** Števec VSEH zabeleženih premikov (_count.movements — obrat; končno
   *  ne-negativno CELO število). */
  premiki: number
}

/** Iskren trojni inventurni status — ISTA predikatna meja kot R219 čipa
 *  ('pod minimumom' ≤ in 'na minimumu' ===). Totálen in medsebojno
 *  izključen za vse končne ne-negativne pare. */
export type InventurniStatus = 'POD MINIMUMOM' | 'NA MEJI' | 'ZADOSTNO'

/** Izpeljani status ENEGA artikla — EN VIR za tabelo, KPI, sklep IN
 *  mini-vrstico (NIKAJ drugega ne sme presojati meje). */
export function inventurniStatusOf(kolicinaZaloga: number, minimalnaZaloga: number): InventurniStatus {
  for (const [ime, v] of [
    ['kolicinaZaloga', kolicinaZaloga],
    ['minimalnaZaloga', minimalnaZaloga],
  ] as const) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new TypeError(`inventurniStatusOf: ${ime} mora biti končno ne-negativno število, ne ${String(v)}`)
    }
  }
  if (kolicinaZaloga < minimalnaZaloga) return 'POD MINIMUMOM'
  if (kolicinaZaloga === minimalnaZaloga) return 'NA MEJI'
  return 'ZADOSTNO'
}

/** Akcijski red statusov (manjša = prej — akcijska cona na vrhu). */
const AKCIJSKI_RED: Record<InventurniStatus, number> = {
  'POD MINIMUMOM': 0,
  'NA MEJI': 1,
  ZADOSTNO: 2,
}

export interface InventuraPdfOptions {
  /** Referenčni trenutek (žig + CreationDate + fileId + ime) — KOT
   *  PARAMETER (determinizem; vzorec R203/R244–R269). */
  now: Date
}

/** Fail-closed preverba ENEGA artikla (indeks krivca VEDNO v sporočilu). */
export function preveriInventuraArtikel(a: InventuraArtikel, i: number): void {
  if (!a || typeof a !== 'object' || Array.isArray(a)) {
    throw new TypeError(`preveriInventuraArtikel (${i}): pričakovan artikel (InventuraArtikel)`)
  }
  for (const [ime, v] of [
    ['id', a.id],
    ['sifraMateriala', a.sifraMateriala],
    ['naziv', a.naziv],
    ['tip', a.tip],
    ['enota', a.enota],
  ] as const) {
    if (typeof v !== 'string' || v.trim() === '') {
      throw new TypeError(`preveriInventuraArtikel (${i}): ${ime} mora biti ne-prazen niz, ne ${String(v)}`)
    }
  }
  for (const [ime, v] of [
    ['kolicinaZaloga', a.kolicinaZaloga],
    ['minimalnaZaloga', a.minimalnaZaloga],
  ] as const) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new TypeError(`preveriInventuraArtikel (${i}): ${ime} mora biti končno ne-negativno število, ne ${String(v)}`)
    }
  }
  if (typeof a.premiki !== 'number' || !Number.isInteger(a.premiki) || a.premiki < 0) {
    throw new TypeError(`preveriInventuraArtikel (${i}): premiki morajo biti ne-negativno celo število (števec _count.movements), ne ${String(a.premiki)}`)
  }
}

export interface InventuraVrsta {
  /** ID (identiteta). */
  id: string
  /** Šifra materiala (sort ključ znotraj cone). */
  sifra: string
  /** Naziv artikla. */
  naziv: string
  /** Tip kot LABEL. */
  tip: string
  /** Trenutna zaloga. */
  zaloga: number
  /** Enota. */
  enota: string
  /** Minimalna zaloga. */
  minimum: number
  /** max(0, minimum − zaloga) — izpeljani deficit ('—' na listu kadar 0). */
  manjka: number
  /** Izpeljani inventurni status (EN VIR inventurniStatusOf). */
  status: InventurniStatus
  /** Akcijski red (manjša = prej — akcijska cona na vrhu). */
  akcijskiRed: number
}

export interface InventuraPovzetek {
  /** Št. artiklov (VSA premoženja iz /api/inventory). */
  artiklov: number
  /** Št. POD MINIMUMOM (RED — akcija: naroči). */
  podMinimumom: number
  /** Št. NA MEJI (AMBER — pozornost). */
  naMeji: number
  /** Št. ZADOSTNO (GREEN — zdrava zaloga). */
  zadostno: number
  /** Št. RAZLIČNIH tipov (referenčna resnica). */
  tipov: number
  /** Σ premikov čez vse artikle (obrat skladišča — vsi zabeleženi). */
  premikiSkupaj: number
  /** Največji manjkajoči odmik (null, če NIČ ni pod minimumom); izenačba →
   *  prvi v sortiranem redu (šifra ASC znotraj akcijske cone). */
  najvecjiManjka: { sifra: string; naziv: string; enota: string; vrednost: number } | null
  /** Največji obrat (null, če NIČ ni zabeležil premika); izenačba → prvi v
   *  sortiranem redu. */
  najvecjiObrat: { sifra: string; naziv: string; premiki: number } | null
}

/** Inventurni pregled premoženja — ENA resnica za KPI, tabelo, sklep,
 *  mini-vrstico IN toast (WYSIWYG). Fail-verbose preverba VSEH vnosov;
 *  podvojen id ALI šifra = pokvaren vir fail-closed. Vrstica = VSAK artikel
 *  (tudi brez premikov — polna resnica premoženja). */
export function inventuraPregled(
  artikli: readonly InventuraArtikel[],
): { vrste: InventuraVrsta[]; povzetek: InventuraPovzetek } {
  if (!Array.isArray(artikli)) {
    throw new TypeError('inventuraPregled: pričakovano polje artiklov (InventuraArtikel[])')
  }
  if (artikli.length === 0) {
    throw new TypeError('inventuraPregled: prazen seznam artiklov ne nastaja dokumenta — inventurni pregled se izvozi, ko je vpisan prvi artikel zaloge (fail-closed)')
  }
  artikli.forEach((a, i) => preveriInventuraArtikel(a, i))

  const vrste: InventuraVrsta[] = artikli.map((a) => {
    const status = inventurniStatusOf(a.kolicinaZaloga, a.minimalnaZaloga)
    return {
      id: a.id,
      sifra: a.sifraMateriala,
      naziv: a.naziv,
      tip: a.tip,
      zaloga: a.kolicinaZaloga,
      enota: a.enota,
      minimum: a.minimalnaZaloga,
      manjka: Math.max(0, a.minimalnaZaloga - a.kolicinaZaloga),
      status,
      akcijskiRed: AKCIJSKI_RED[status],
    }
  })

  // Podvojen id ALI šifra = pokvaren vir (šifra je @unique v shemi — dve
  // vrstici za ISTO identiteto bi lažno podvajali KPI in tabelo —
  // fail-closed, NIKOLI tiho združevanje).
  const videniId = new Set<string>()
  const videniSifra = new Set<string>()
  for (const v of vrste) {
    if (videniId.has(v.id)) {
      throw new TypeError(`inventuraPregled: podvojen id artikla ${v.id} (pokvaren vir — identiteta mora biti edinstvena)`)
    }
    videniId.add(v.id)
    if (videniSifra.has(v.sifra)) {
      throw new TypeError(`inventuraPregled: podvojena šifra materiala ${v.sifra} (pokvaren vir — šifra je edinstvena v shemi)`)
    }
    videniSifra.add(v.sifra)
  }

  sortirajInventura(vrste)

  // Največji manjka / največji obrat — prvi v SORTIRANEM redu (determinizem
  // f(MNOŽICA); izenačba = šifra ASC znotraj cone, ne vrstni red odgovora).
  let najvecjiManjka: InventuraPovzetek['najvecjiManjka'] = null
  for (const v of vrste) {
    if (v.manjka > 0) {
      if (najvecjiManjka === null || v.manjka > najvecjiManjka.vrednost) {
        najvecjiManjka = { sifra: v.sifra, naziv: v.naziv, enota: v.enota, vrednost: v.manjka }
      }
    }
  }
  let najvecjiObrat: InventuraPovzetek['najvecjiObrat'] = null
  for (const v of vrste) {
    const a = artikli.find((x) => x.id === v.id)
    const p = a ? a.premiki : 0
    if (p > 0) {
      if (najvecjiObrat === null || p > najvecjiObrat.premiki) {
        najvecjiObrat = { sifra: v.sifra, naziv: v.naziv, premiki: p }
      }
    }
  }

  const povzetek: InventuraPovzetek = {
    artiklov: vrste.length,
    podMinimumom: vrste.filter((v) => v.status === 'POD MINIMUMOM').length,
    naMeji: vrste.filter((v) => v.status === 'NA MEJI').length,
    zadostno: vrste.filter((v) => v.status === 'ZADOSTNO').length,
    tipov: new Set(vrste.map((v) => v.tip)).size,
    premikiSkupaj: artikli.reduce((s, a) => s + a.premiki, 0),
    najvecjiManjka,
    najvecjiObrat,
  }
  return { vrste, povzetek }
}

/** Sort V LIBU — akcijski red: (1) status po akcijski teži (POD MINIMUMOM —
 *  akcija → NA MEJI — pozornost → ZADOSTNO — zdrava cona), (2) šifra ASC
 *  (računovodski red zaloge — navadno < po UTF-16 kodnih točkah — brez
 *  locale; @unique = totálni red za veljavne podatke), (3) id ASC
 *  (identiteta — determinističen tiebreak). IZVOŽEN — determinizem =
 *  f(MNOŽICA vhodov). Referenčni pregled, NE rangiranje. */
export function sortirajInventura(vrste: InventuraVrsta[]): InventuraVrsta[] {
  return vrste.sort((a, b) => {
    if (a.akcijskiRed !== b.akcijskiRed) return a.akcijskiRed - b.akcijskiRed
    if (a.sifra !== b.sifra) return a.sifra < b.sifra ? -1 : 1
    if (a.id !== b.id) return a.id < b.id ? -1 : 1
    return 0
  })
}

/** Sklanjatev artiklov za žeton IN sklep (iskrene oznake; 101 = 'sto EN
 *  artikel' — pariteta clanBeseda R268 / kosBeseda R168 / osnutekBeseda
 *  R269). */
export function artikelBeseda(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError(`artikelBeseda: pričakovano ne-negativno celo število: ${String(n)}`)
  }
  const enice = n % 10
  const zadnjiDve = n % 100
  if (enice === 1 && zadnjiDve !== 11) return `${n} artikel`
  if (enice === 2 && zadnjiDve !== 12) return `${n} artikla`
  if ((enice === 3 || enice === 4) && zadnjiDve !== 13 && zadnjiDve !== 14) {
    return `${n} artikli`
  }
  return `${n} artiklov`
}

/** Determinističen file-ID (32 hex) — čista JS FNV-1a; LASTNI soli 0xa5–0xa8. */
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
    fnv1aHex(seed, 0xa5) +
    fnv1aHex(seed, 0xa6) +
    fnv1aHex(seed, 0xa7) +
    fnv1aHex(seed, 0xa8)
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

/** KPI polje — ISTI vzorec kot meritve-teren/ekipa-stanje/ponudbe družina. */
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

/** Zgradi INVENTURA — PREMOŽENJSKI PREGLED dokument (brez shranjevanja) —
 *  vrne jsPDF instanco (testi berejo doc.output('arraybuffer') → bajtni
 *  dokazi). */
export function buildInventuraPregledPdfDoc(
  artikli: readonly InventuraArtikel[],
  options: InventuraPdfOptions,
): jsPDF {
  if (!Array.isArray(artikli)) {
    throw new TypeError('buildInventuraPregledPdfDoc: pričakovano polje artiklov')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildInventuraPregledPdfDoc: pričakovane opcije (InventuraPdfOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildInventuraPregledPdfDoc: pričakovan veljaven now: Date')
  }
  // PRAZEN SEZNAM artiklov ne nastaja dokumenta (družina: ni prazne datoteke
  // — komponenta pokaže iskren toast 'Ni vpisanih artiklov.').
  if (artikli.length === 0) {
    throw new TypeError(
      'buildInventuraPregledPdfDoc: prazen seznam artiklov ne nastaja dokumenta — komponenta pokaže iskren toast (Ni vpisanih artiklov.)',
    )
  }
  const { vrste, povzetek } = inventuraPregled(artikli)

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / družina) ----------
  doc.setCreationDate(now)
  // Seed = f(MNOŽICA) — kanoniziran red (po id identitete), NIKOLI vrstni
  // red odgovora (R248/R262/R264–R269 vzorec).
  const kanonArtikli = [...artikli].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  doc.setFileId(
    deterministichenId(
      `${now.toISOString()}|I:${kanonArtikli
        .map(
          (a) =>
            `${a.id}/${a.sifraMateriala}/${a.kolicinaZaloga}/${a.minimalnaZaloga}/${a.premiki}`,
        )
        .join(',')}`,
    ),
  )

  // ---------- glava (ISTI vzorec kot meritve-teren/ekipa-stanje) ----------
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
  doc.text('INVENTURA — PREMOŽENJSKI PREGLED', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })
  doc.setFontSize(9)
  doc.text('celotno skladišče — VSA premoženja', 196, 24.5, { align: 'right' })

  // ---------- KPI 5 (signalni jezik: RED = akcija — naroči pred porabo;
  //  AMBER = pozornost — na meji; GREEN = zdrava zaloga; NAVY = obseg in
  //  referenčna resnica) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Povzetek premoženja')
  const bw = 33
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Artiklov', String(povzetek.artiklov), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Pod minimumom', String(povzetek.podMinimumom), povzetek.podMinimumom > 0 ? RED : GREEN)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Na meji', String(povzetek.naMeji), povzetek.naMeji > 0 ? AMBER : GREEN)
  kpiBox(doc, 14 + 3 * (bw + gap), y, bw, bh, 'Tipov', String(povzetek.tipov), NAVY)
  kpiBox(
    doc,
    14 + 4 * (bw + gap),
    y,
    bw,
    bh,
    'Največji manjka',
    povzetek.najvecjiManjka ? `${kolicinaNiz(povzetek.najvecjiManjka.vrednost)} ${povzetek.najvecjiManjka.enota}` : '—',
    povzetek.najvecjiManjka ? RED : GREEN,
  )
  y += bh + 8

  // ---------- tabela artiklov (akcijski red: pod minimumom na vrhu —
  //  akcija; VSA premoženja, tudi brez premikov) ----------
  y = sectionTitle(doc, y, `Artikli (${vrste.length})`)
  autoTable(doc, {
    startY: y,
    head: [['Šifra', 'Naziv', 'Tip', 'Zaloga', 'Enota', 'Minimum', 'Manjka', 'Status']],
    body: vrste.map((v) => [
      v.sifra,
      v.naziv,
      v.tip,
      kolicinaNiz(v.zaloga),
      v.enota,
      kolicinaNiz(v.minimum),
      v.manjka > 0 ? kolicinaNiz(v.manjka) : '—',
      v.status,
    ]),
    styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
    didParseCell: (data) => {
      // WYSIWYG: POD MINIMUMOM RED bold (akcija — naroči); NA MEJI AMBER
      // bold (pozornost); ZADOSTNO GREEN (zdrava zaloga); '—' sivo (iskren
      // odpad — brez izmišljenih ničel).
      if (data.section !== 'body') return
      const v = vrste[data.row.index]
      if (!v) return
      const raw = String(data.cell.raw ?? '')
      if (data.column.index === 7) {
        if (v.status === 'POD MINIMUMOM') {
          data.cell.styles.textColor = RED
          data.cell.styles.fontStyle = 'bold'
        } else if (v.status === 'NA MEJI') {
          data.cell.styles.textColor = AMBER
          data.cell.styles.fontStyle = 'bold'
        } else if (v.status === 'ZADOSTNO') {
          data.cell.styles.textColor = GREEN
        }
      }
      if (data.column.index === 6 && raw === '—') {
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
    `${artikelBeseda(povzetek.artiklov)} · pod minimumom ${povzetek.podMinimumom} (akcija — naroči pred naslednjo porabo) · na meji ${povzetek.naMeji} (točno na meji — naslednja poraba pusti pod) · zadostno ${povzetek.zadostno} (zdrava zaloga) · nizka zaloga (≤ minimum — čip zaloge) ${povzetek.podMinimumom + povzetek.naMeji} · tipov ${povzetek.tipov} · premikov ${povzetek.premikiSkupaj} (vsi zabeleženi premiki — obrat skozi skladišče${povzetek.najvecjiObrat ? `; največji obrat: ${povzetek.najvecjiObrat.sifra} (${povzetek.najvecjiObrat.naziv}) z ${povzetek.najvecjiObrat.premiki} premiki` : ' — iskreno nič'}) · manjka izražen samo pri POD MINIMUMOM (drugi '—' — brez izmišljenih ničel) · (referenčni pregled — VSA zalogovna premoženja, tudi artikli brez premikov) · vir = /api/inventory (resnica zaloge — FRESH ob kliku, ne viden seznam filtrov).`,
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

/** Ime datoteke — `Inventura-pregled-YYYY-MM-DD.pdf` (družinski vzorec;
 *  deterministično glede na `now`; EN now za žig IN ime — lekcija R121/R235). */
export function inventuraPregledPdfFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('inventuraPregledPdfFilename: pričakovan veljaven now: Date')
  }
  return `Inventura-pregled-${todayStamp(now)}.pdf`
}

/** Zgeneriraj INVENTURA — PREMOŽENJSKI PREGLED PDF (determinističen — enak
 *  vhod = bajtno enak dokument) in ga shrani. */
export function generateInventuraPregledPdf(
  artikli: readonly InventuraArtikel[],
  options: InventuraPdfOptions,
): void {
  const doc = buildInventuraPregledPdfDoc(artikli, options)
  doc.save(inventuraPregledPdfFilename(options.now))
}
