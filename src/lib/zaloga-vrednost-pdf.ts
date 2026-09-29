// ---------------------------------------------------------------------------
// R273 (P1-f, 'izvozi' družina — 29. člen) — ZALOGA — PREMOŽENJSKA VREDNOST
// PDF iz Zaloga taba (inventory-tab.tsx). Vzorec nagibi-teren R272 /
// inventura R270: ROKSAL glava, KPI 5, autoTable, sklep, noge, bajtni
// determinizem.
//
// SEMANTIČNA ODLOČITEV (zapisana PRED razvojem — R272 handover zahteva):
//  • TRENUTNA CENA = API resnica `veljavnostDo: null` — /api/material-prices
//    SAM hard-filtra pretečene cene (dolgoletna API semantika — R245
//    primerjalni cenik + R264 pozicija cen na ISTI vir). Lib NE izumlja
//    svojega filtra veljavnosti (EN VIR — API vrne SAMO trenutno veljavne);
//  • bestPerMaterial = najnižja trenutna cena per artikel (API resnica —
//    zgradi map po inventoryId; izenačba = API notranji red, client NE
//    računa svoje). Per-artikel VREDNOST = bestPrice × kolicinaZaloga (EUR);
//  • TRI ISKRENE VEJE per artikel:
//      1) artikel ima vnos v bestPerMaterial → vrednost = bestPrice × zaloga,
//         dobavitelj = bestSupplier (API resnica);
//      2) `_count.prices > 0` a BREZ vnosa → VSE vpisane cene pretečene
//         (API jih ne vrne) → 'pretečena' AMBER bold vrstica — vrednost NI
//         ocenjena (akcija: vpisati novo veljavno ceno);
//      3) `_count.prices === 0` (DOBESLEDNO) → '—' sivo — R227 žig pariteta
//         ('brez vpisane nabavne cene'; vrednost NI ocenjena).
//    Manjkajoč/pokvaren števec cen → TypeError (R227/R270 strogost —
//    manjkajoč števec NIKOLI tiho 0);
//  • Σ vrednost = Σ NAD artikli z veljavno trenutno ceno (veja 1 SAMO —
//    pretečeni in brez cene NE ocenjeni; NIKOLI UI-jeva 'demo' ocena
//    cenaEur — R204 družinsko pravilo). zCeno 0 → Σ '—' iskrena praznina;
//  • RED (akcijski, R270 cone precedens + R258 rangiranje): z vrednostjo —
//    vrednost DESC (kje je denar) → naziv ASC → id ASC; 'pretečena' cone —
//    naziv ASC → id ASC (akcija); 'brez cene' cone — naziv ASC → id ASC
//    (registratura). Referenčni pregled, NE izmišljenega rangiranja.
//
// EN VIR RESNICE (route NIČ — client+lib only):
//  • /api/inventory — FRESH fetch ISTEGA endpointa ob kliku (R270 precedens):
//    artikli + količine + _count.prices (orderBy naziv asc — API resnica);
//  • /api/material-prices — FRESH fetch (BREZ query): {prices, bestPerMaterial}
//    — SAMO trenutno veljavne cene (veljavnostDo null — API resnica).
//
// ENA RESNICA (WYSIWYG): ISTA izpeljava zalogaVrednostPregled poganja PDF
// KPI, tabelo, sklep IN toast — ENA izpeljava (klicatelj jo požene ENKRAT in
// podaja ISTO resnico naprej, R263/R266–R272 vzorec); mini-vrstica na kartici
// (state + bestCene mount fetch) = ISTA izpeljava — dve okni (state vs FRESH),
// ENA matemtika.
//
// Načela (družinska pravila):
//  • Fail-closed: pokvaren vnos → TypeError z indeksom krivca (ne-finite
//    količina, negativna cena, podvojen id, podvojen best inventoryId,
//    orphan best cena — best brez ujemajočega artikla = pokvaren vir, R264
//    precedens). PRAZEN seznam ne nastaja dokumenta (družina: ni prazne
//    datoteke; komponenta pokaže iskren toast 'Ni vpisanih artiklov.').
//  • Determinizem: `now` KOT parameter; doc.setCreationDate(now) +
//    doc.setFileId(FNV-1a) — enak vhod = bajtno enak PDF (document-pdf R121).
//  • CLIENT-safe: čista JS FNV-1a; LASTNI soli **0xb1–0xb4** (register:
//    nagibi-teren 0xad–0xb0 → zaloga-vrednost 0xb1–0xb4 — ista semena v dveh
//    libih NE smejo dati isti ID).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { todayStamp } from './csv-export'
import { zalogaPovzetekCasOznaka } from './zaloga-povzetek'
import { artikelBeseda } from './inventura-pregled-pdf'
import { kolicinaNiz } from './zaloga-osnutek-pdf'

// ---------- barve (ISTI dokumenti družina — 0 novih hex) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const GREEN: [number, number, number] = [22, 163, 74] // roksal-green
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

export type ZalogaVrednostArtikel = {
  /** Identiteta artikla (API id — JOIN ključ z bestPerMaterial). */
  id: string
  /** Šifra materiala (ne-prazna — API resnica). */
  sifraMateriala: string
  /** Naziv artikla (ne-prazen — API resnica). */
  naziv: string
  /** Zaloga (fizična vrednost — končno ne-negativno). */
  kolicinaZaloga: number
  /** Enota (ne-prazna). */
  enota: string
  /** Števec VSEH vpisanih cen (API _count.prices — R227 strogost:
   *  manjkajoč/pokvaren → TypeError; === 0 dobesedno = 'brez cene' veja). */
  stevecCen: number
}

export type ZalogaVrednostBest = {
  /** Artikel identiteta (JOIN ključ — API bestPerMaterial.inventoryId). */
  inventoryId: string
  /** Najnižja trenutno veljavna cena EUR/enoto (končno ne-negativna — R264
   *  pariteta; API resnica veljavnostDo null). */
  bestPrice: number
  /** Dobavitelj najnižje cene (ne-prazen — API resnica). */
  bestSupplier: string
}

/** Stanje vrstice — tri iskrene veje (semantična odločitev zgoraj). */
export type ZalogaVrednostStanje = 'OK' | 'PRETECENA' | 'BREZ_CENE'

export interface ZalogaVrednostVrsta {
  /** ID (identiteta). */
  id: string
  /** Šifra materiala. */
  sifra: string
  /** Naziv artikla. */
  naziv: string
  /** Zaloga niz (kolicinaNiz EN VIR R262 — necela 4.5 → '4.50'). */
  zaloga: string
  /** Enota. */
  enota: string
  /** Cena EUR/enoto (veja 1 SAMO — sicer null → '—'). */
  cena: number | null
  /** Dobavitelj najnižje cene (veja 1 SAMO — sicer null → '—'). */
  dobavitelj: string | null
  /** Vrednost EUR (veja 1 SAMO — sicer null). */
  vrednost: number | null
  /** Prikaz vrednosti v tabeli: toFixed(2) / 'pretečena' / null ('—'). */
  vrednostPrikaz: string | null
  /** Iskreno stanje veje. */
  stanje: ZalogaVrednostStanje
}

export interface ZalogaVrednostPovzetek {
  /** Št. artiklov (vsi iz /api/inventory — polna resnica skladišča). */
  artiklov: number
  /** Σ vrednost EUR nad artikli z veljavno ceno (veja 1; 0 če nič). */
  vsotaEur: number
  /** Št. artiklov z veljavno trenutno ceno (veja 1). */
  zCeno: number
  /** Št. artiklov z VSEMI cenami pretečenimi (veja 2 — akcija re-price). */
  pretecenih: number
  /** Št. artiklov brez VPISANE cene (_count.prices === 0 — veja 3). */
  brezCene: number
  /** Največja vrednost EUR (veja 1; null = nič nima veljavne cene). */
  najvecjaEur: number | null
  /** Naziv artikla z največjo vrednostjo (null pariteta). */
  najvecjaNaziv: string | null
}

/** Fail-closed preverba ENEGA artikla (indeks krivca VEDNO v sporočilu). */
export function preveriVrednostArtikel(a: ZalogaVrednostArtikel, i: number): void {
  if (!a || typeof a !== 'object' || Array.isArray(a)) {
    throw new TypeError(`preveriVrednostArtikel (${i}): pričakovan artikel (ZalogaVrednostArtikel)`)
  }
  if (typeof a.id !== 'string' || a.id === '') {
    throw new TypeError(`preveriVrednostArtikel (${i}): id mora biti ne-prazen niz, ne ${String(a.id)}`)
  }
  if (typeof a.sifraMateriala !== 'string' || a.sifraMateriala.trim() === '') {
    throw new TypeError(`preveriVrednostArtikel (${i} — ${a.id}): sifraMateriala mora biti ne-prazen niz, ne ${String(a.sifraMateriala)}`)
  }
  if (typeof a.naziv !== 'string' || a.naziv.trim() === '') {
    throw new TypeError(`preveriVrednostArtikel (${i} — ${a.id}): naziv mora biti ne-prazen niz, ne ${String(a.naziv)}`)
  }
  if (typeof a.enota !== 'string' || a.enota.trim() === '') {
    throw new TypeError(`preveriVrednostArtikel (${i} — ${a.id}): enota mora biti ne-prazen niz, ne ${String(a.enota)}`)
  }
  if (typeof a.kolicinaZaloga !== 'number' || !Number.isFinite(a.kolicinaZaloga) || a.kolicinaZaloga < 0) {
    throw new TypeError(
      `preveriVrednostArtikel (${i} — ${a.id}): kolicinaZaloga mora biti končno ne-negativno število, ne ${String(a.kolicinaZaloga)}`,
    )
  }
  // R227 strogost: števec cen je DEL vira — manjkajoč/pokvaren NIKOLI tiho 0.
  if (typeof a.stevecCen !== 'number' || !Number.isInteger(a.stevecCen) || a.stevecCen < 0) {
    throw new TypeError(
      `preveriVrednostArtikel (${i} — ${a.id}): stevecCen (_count.prices) mora biti ne-negativno celo število, ne ${String(a.stevecCen)}`,
    )
  }
}

/** Fail-closed preverba ENEGA best vnosa (API bestPerMaterial vrstica). */
export function preveriVrednostBest(b: ZalogaVrednostBest, i: number): void {
  if (!b || typeof b !== 'object' || Array.isArray(b)) {
    throw new TypeError(`preveriVrednostBest (${i}): pričakovan best vnos (ZalogaVrednostBest)`)
  }
  if (typeof b.inventoryId !== 'string' || b.inventoryId === '') {
    throw new TypeError(`preveriVrednostBest (${i}): inventoryId mora biti ne-prazen niz, ne ${String(b.inventoryId)}`)
  }
  if (typeof b.bestPrice !== 'number' || !Number.isFinite(b.bestPrice) || b.bestPrice < 0) {
    throw new TypeError(
      `preveriVrednostBest (${i} — ${b.inventoryId}): bestPrice mora biti končno ne-negativno število, ne ${String(b.bestPrice)}`,
    )
  }
  if (typeof b.bestSupplier !== 'string' || b.bestSupplier.trim() === '') {
    throw new TypeError(`preveriVrednostBest (${i} — ${b.inventoryId}): bestSupplier mora biti ne-prazen niz, ne ${String(b.bestSupplier)}`)
  }
}

/** Vrednost zaloge — ENA resnica za KPI, tabelo, sklep IN toast (WYSIWYG).
 *  Fail-verbose preverba VSEH vnosov; podvojen artikel id / podvojen best
 *  inventoryId / orphan best (best brez artikla) = pokvaren vir fail-closed. */
export function zalogaVrednostPregled(
  artikli: readonly ZalogaVrednostArtikel[],
  best: readonly ZalogaVrednostBest[],
): { vrste: ZalogaVrednostVrsta[]; povzetek: ZalogaVrednostPovzetek } {
  if (!Array.isArray(artikli)) {
    throw new TypeError('zalogaVrednostPregled: pričakovano polje artiklov (ZalogaVrednostArtikel[])')
  }
  if (!Array.isArray(best)) {
    throw new TypeError('zalogaVrednostPregled: pričakovano polje best cen (ZalogaVrednostBest[])')
  }
  if (artikli.length === 0) {
    throw new TypeError('zalogaVrednostPregled: prazen seznam artiklov ne nastaja dokumenta — pregled vrednosti se izvozi, ko je vpisan prvi artikel zaloge (fail-closed)')
  }
  artikli.forEach((a, i) => preveriVrednostArtikel(a, i))
  best.forEach((b, i) => preveriVrednostBest(b, i))

  // Podvojen artikel id = pokvaren vir (dve vrstici za ISTO identiteto bi
  // lažno podvajali KPI in tabelo — NIKOLI tiho združevanje).
  const videniArtikli = new Set<string>()
  for (const a of artikli) {
    if (videniArtikli.has(a.id)) {
      throw new TypeError(`zalogaVrednostPregled: podvojen id artikla ${a.id} (pokvaren vir — identiteta mora biti edinstvena)`)
    }
    videniArtikli.add(a.id)
  }
  // Podvojen best inventoryId = pokvaren vir (API bestPerMaterial je Map —
  // ena vrstica per artikel; dve = pokvaren izračun).
  const videniBest = new Set<string>()
  for (const b of best) {
    if (videniBest.has(b.inventoryId)) {
      throw new TypeError(`zalogaVrednostPregled: podvojen best inventoryId ${b.inventoryId} (pokvaren vir — bestPerMaterial je ena vrstica per artikel)`)
    }
    videniBest.add(b.inventoryId)
  }

  // JOIN po IDENTITETI (R264 precedens): best map + ORPHAN preverba — best
  // cena brez ujemajočega artikla = pokvaren vir (NIKOLI izmišljena vrstica).
  const bestMap = new Map<string, ZalogaVrednostBest>()
  for (const b of best) {
    if (!videniArtikli.has(b.inventoryId)) {
      throw new TypeError(`zalogaVrednostPregled: best cena brez ujemajočega artikla ${b.inventoryId} (pokvaren vir — NIKOLI izmišljena vrstica)`)
    }
    bestMap.set(b.inventoryId, b)
  }

  const vrste: ZalogaVrednostVrsta[] = artikli.map((a) => {
    const b = bestMap.get(a.id)
    if (b) {
      // Veja 1 — veljavna trenutna cena (API resnica): vrednost = bestPrice × zaloga.
      const vrednost = b.bestPrice * a.kolicinaZaloga
      return {
        id: a.id,
        sifra: a.sifraMateriala.trim(),
        naziv: a.naziv.trim(),
        zaloga: kolicinaNiz(a.kolicinaZaloga),
        enota: a.enota.trim(),
        cena: b.bestPrice,
        dobavitelj: b.bestSupplier.trim(),
        vrednost,
        vrednostPrikaz: vrednost.toFixed(2),
        stanje: 'OK',
      }
    }
    if (a.stevecCen > 0) {
      // Veja 2 — VSE vpisane cene pretečene (API jih ne vrne): vrednost NI
      // ocenjena — iskrena AMBER vrstica 'pretečena' (akcija re-price).
      return {
        id: a.id,
        sifra: a.sifraMateriala.trim(),
        naziv: a.naziv.trim(),
        zaloga: kolicinaNiz(a.kolicinaZaloga),
        enota: a.enota.trim(),
        cena: null,
        dobavitelj: null,
        vrednost: null,
        vrednostPrikaz: 'pretečena',
        stanje: 'PRETECENA',
      }
    }
    // Veja 3 — _count.prices === 0 dobesedno: brez VPISANE cene (R227 žig
    // pariteta — iskren odpad '—', vrednost NI ocenjena).
    return {
      id: a.id,
      sifra: a.sifraMateriala.trim(),
      naziv: a.naziv.trim(),
      zaloga: kolicinaNiz(a.kolicinaZaloga),
      enota: a.enota.trim(),
      cena: null,
      dobavitelj: null,
      vrednost: null,
      vrednostPrikaz: null,
      stanje: 'BREZ_CENE',
    }
  })

  sortirajZalogaVrednost(vrste)

  // Σ NAD veljavnimi vrednostmi (veja 1 SAMO — fail-closed vrednost so že
  // preverjene končne številke; Σ končnih = končna).
  let vsotaEur = 0
  let zCeno = 0
  let pretecenih = 0
  let brezCene = 0
  for (const v of vrste) {
    if (v.stanje === 'OK' && v.vrednost !== null) {
      vsotaEur += v.vrednost
      zCeno += 1
    } else if (v.stanje === 'PRETECENA') {
      pretecenih += 1
    } else {
      brezCene += 1
    }
  }
  // Največja vrednost — prva v SORTIRANEM redu (sort determinističen: cone
  // vrednost DESC → izenačba naziv ASC → id ASC; NIKOLI vrstni red odgovora).
  const najvecja = zCeno > 0 ? vrste.find((v) => v.stanje === 'OK') ?? null : null
  const povzetek: ZalogaVrednostPovzetek = {
    artiklov: vrste.length,
    vsotaEur,
    zCeno,
    pretecenih,
    brezCene,
    najvecjaEur: najvecja?.vrednost ?? null,
    najvecjaNaziv: najvecja?.naziv ?? null,
  }
  return { vrste, povzetek }
}

/** Sort V LIBU — akcijske cone (semantična odločitev zgoraj): z vrednostjo —
 *  vrednost DESC (kje je denar) → naziv ASC → id ASC; 'pretečena' cone —
 *  naziv ASC → id ASC (akcija re-price); 'brez cene' cone — naziv ASC →
 *  id ASC (registratura). IZVOŽEN — determinizem = f(MNOŽICA vhodov).
 *  Primerjanje nizov = čista JS (< / >) — NIKOLI locale-odvisne primerjave (družina). */
export function sortirajZalogaVrednost(vrste: ZalogaVrednostVrsta[]): ZalogaVrednostVrsta[] {
  const conaRed: Record<ZalogaVrednostStanje, number> = { OK: 0, PRETECENA: 1, BREZ_CENE: 2 }
  return vrste.sort((a, b) => {
    // Cone: denar na vrhu → pretečena (akcija) → brez cene (registratura).
    if (a.stanje !== b.stanje) return conaRed[a.stanje] - conaRed[b.stanje]
    if (a.stanje === 'OK' && a.vrednost !== null && b.vrednost !== null && a.vrednost !== b.vrednost) {
      // Vrednost DESC — največja vrednost na vrhu (kje je denar).
      return a.vrednost > b.vrednost ? -1 : 1
    }
    // Katalog red znotraj cone (API orderBy naziv asc pariteta).
    if (a.naziv !== b.naziv) return a.naziv < b.naziv ? -1 : 1
    // Identiteta (isto ime = RAZLIČNA resnica).
    if (a.id !== b.id) return a.id < b.id ? -1 : 1
    return 0
  })
}

/** Determinističen file-ID (32 hex) — čista JS FNV-1a; LASTNI soli 0xb1–0xb4. */
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
    fnv1aHex(seed, 0xb1) +
    fnv1aHex(seed, 0xb2) +
    fnv1aHex(seed, 0xb3) +
    fnv1aHex(seed, 0xb4)
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

/** KPI polje — ISTI vzorec kot nagibi-teren/inventura/zapisnik-stanje. */
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

export interface ZalogaVrednostPdfOptions {
  /** Referenčni trenutek (žig + CreationDate + fileId + ime) — KOT
   *  PARAMETER (determinizem; vzorec R203/R244–R272). */
  now: Date
}

/** Zgradi ZALOGA — PREMOŽENJSKA VREDNOST dokument (brez shranjevanja) — vrne
 *  jsPDF instanco (testi berejo doc.output('arraybuffer') → bajtni dokazi). */
export function buildZalogaVrednostPdfDoc(
  artikli: readonly ZalogaVrednostArtikel[],
  best: readonly ZalogaVrednostBest[],
  options: ZalogaVrednostPdfOptions,
): jsPDF {
  if (!Array.isArray(artikli)) {
    throw new TypeError('buildZalogaVrednostPdfDoc: pričakovano polje artiklov')
  }
  if (!Array.isArray(best)) {
    throw new TypeError('buildZalogaVrednostPdfDoc: pričakovano polje best cen')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildZalogaVrednostPdfDoc: pričakovane opcije (ZalogaVrednostPdfOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildZalogaVrednostPdfDoc: pričakovan veljaven now: Date')
  }
  // PRAZEN seznam ne nastaja dokumenta (družina: ni prazne datoteke —
  // komponenta pokaže iskren toast 'Ni vpisanih artiklov.').
  if (artikli.length === 0) {
    throw new TypeError(
      'buildZalogaVrednostPdfDoc: prazen seznam artiklov ne nastaja dokumenta — komponenta pokaže iskren toast (Ni vpisanih artiklov.)',
    )
  }
  const { vrste, povzetek } = zalogaVrednostPregled(artikli, best)

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / družina) ----------
  doc.setCreationDate(now)
  // Seed = f(MNOŽICA) — kanoniziran red (po id identiteta / inventoryId),
  // NIKOLI vrstni red odgovora (R248/R262/R264–R272 vzorec). Količine in
  // cene so končna števila (preverjeno) — varni seed vnosi.
  const kanonArtikli = [...artikli].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const kanonBest = [...best].sort((a, b) => (a.inventoryId < b.inventoryId ? -1 : a.inventoryId > b.inventoryId ? 1 : 0))
  doc.setFileId(
    deterministichenId(
      `${now.toISOString()}|ZV:${kanonArtikli
        .map((a) => `${a.id}/${a.sifraMateriala}/${a.kolicinaZaloga}/${a.stevecCen}`)
        .join(',')};B:${kanonBest
        .map((b) => `${b.inventoryId}/${b.bestPrice}/${b.bestSupplier}`)
        .join(',')}`,
    ),
  )

  // ---------- glava (ISTI vzorec kot inventura R270 — globalno skladišče) ----------
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
  doc.text('ZALOGA — PREMOŽENJSKA VREDNOST', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })
  doc.setFontSize(9)
  doc.text('zaloga: celotno skladišče', 196, 24.5, { align: 'right' })

  // ---------- KPI 5 (signalni jezik: NAVY = obseg in denar; AMBER = akcija
  //  SAMO kadar > 0 — pretečena cena / brez vpisane cene; drugače GREEN —
  //  NIKOLI lažni alarm) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Povzetek vrednosti')
  const bw = 33
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Artiklov', String(povzetek.artiklov), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Σ vrednost', povzetek.zCeno > 0 ? `${povzetek.vsotaEur.toFixed(2)}` : '—', NAVY)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Največja', povzetek.najvecjaEur !== null ? `${povzetek.najvecjaEur.toFixed(2)}` : '—', NAVY)
  kpiBox(doc, 14 + 3 * (bw + gap), y, bw, bh, 'Pretečenih', String(povzetek.pretecenih), povzetek.pretecenih > 0 ? AMBER : GREEN)
  kpiBox(doc, 14 + 4 * (bw + gap), y, bw, bh, 'Brez cene', String(povzetek.brezCene), povzetek.brezCene > 0 ? AMBER : GREEN)
  y += bh + 8

  // ---------- tabela artiklov (akcijske cone — vrednost DESC na vrhu;
  //  glava: šifra/artikel/količina/cena/dobavitelj/vrednost) ----------
  y = sectionTitle(doc, y, `Vrednost artiklov (${vrste.length})`)
  autoTable(doc, {
    startY: y,
    head: [['Šifra', 'Artikel', 'Zaloga', 'Enota', 'Cena (EUR/enota)', 'Dobavitelj', 'Vrednost (EUR)']],
    body: vrste.map((v) => [
      v.sifra,
      v.naziv,
      v.zaloga,
      v.enota,
      v.cena !== null ? v.cena.toFixed(2) : '—',
      v.dobavitelj ?? '—',
      v.vrednostPrikaz ?? '—',
    ]),
    styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
    didParseCell: (data) => {
      // WYSIWYG: 'pretečena' = AMBER bold vrstica (akcija re-price — iskren
      // signal, NIKOLI ocenjena vrednost); '—' = sivo (iskren odpad — R227
      // žig brez cene / brez dobavitelja).
      if (data.section !== 'body') return
      const v = vrste[data.row.index]
      if (!v) return
      const raw = String(data.cell.raw ?? '')
      if (v.stanje === 'PRETECENA') {
        data.cell.styles.textColor = AMBER
        data.cell.styles.fontStyle = 'bold'
        return
      }
      if ((data.column.index === 4 || data.column.index === 5 || data.column.index === 6) && raw === '—') {
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
  const vsotaSklep =
    povzetek.zCeno > 0
      ? `Σ vrednost zaloge ${povzetek.vsotaEur.toFixed(2)} EUR (samo artikli z veljavno trenutno ceno — z ceno ${povzetek.zCeno})`
      : 'Σ vrednost zaloge — (ni artikla z veljavno trenutno ceno)'
  const najvecjaSklep =
    povzetek.najvecjaEur !== null && povzetek.najvecjaNaziv !== null
      ? ` · največja vrednost ${povzetek.najvecjaEur.toFixed(2)} EUR (${povzetek.najvecjaNaziv})`
      : ''
  const preteceniSklep =
    povzetek.pretecenih > 0
      ? ` · pretečenih ${povzetek.pretecenih} (vse vpisane cene pretečene — vpisati novo veljavno ceno)`
      : ''
  const brezCeneSklep =
    povzetek.brezCene > 0
      ? ` · brez vpisane nabavne cene ${povzetek.brezCene} (vrednost NI ocenjena — iskrena resnica)`
      : ''
  doc.text(
    `${artikelBeseda(povzetek.artiklov)} · ${vsotaSklep}${najvecjaSklep}${preteceniSklep}${brezCeneSklep} · cena = EN VIR /api/material-prices bestPerMaterial (samo trenutno veljavne cene — API resnica veljavnostDo null; pretečene NISO vključene) · (referenčni pregled — VSA zalogovna premoženja, tudi artikli brez veljavne cene) · vir = /api/inventory + /api/material-prices (resnica zaloge IN cen).`,
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

/** Ime datoteke — `Zaloga-vrednost-YYYY-MM-DD.pdf` (družinski vzorec;
 *  deterministično glede na `now`; EN now za žig IN ime — lekcija R121/R235;
 *  ločeno od Inventura-pregled-… PDF IN zaloga CSV). */
export function zalogaVrednostPdfFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('zalogaVrednostPdfFilename: pričakovan veljaven now: Date')
  }
  return `Zaloga-vrednost-${todayStamp(now)}.pdf`
}

/** Zgeneriraj ZALOGA — PREMOŽENJSKA VREDNOST PDF (determinističen — enak
 *  vhod = bajtno enak dokument) in ga shrani. */
export function generateZalogaVrednostPdf(
  artikli: readonly ZalogaVrednostArtikel[],
  best: readonly ZalogaVrednostBest[],
  options: ZalogaVrednostPdfOptions,
): void {
  const doc = buildZalogaVrednostPdfDoc(artikli, best, options)
  doc.save(zalogaVrednostPdfFilename(options.now))
}
