// ---------------------------------------------------------------------------
// R262 (P1-f, 'izvozi' družina — 18. člen) — ZALOGA — OSNUTEK POKRITOST PDF iz
// Material pregleda (material-intelligence-tab, podzavihek Naročila). Vzorec
// racuni-projekti-pdf R261 / dobičkonost-pdf R258 / narocila-pregled-pdf
// R257: ROKSAL glava, KPI, autoTable, noge, bajtni determinizem.
//
// PRESEK DVEH VIROV (route NIČ — client+lib only; material-intelligence-tab
// ŽE fetcha oba: GET /api/inventory + GET /api/material-orders — R258/R261
// precedens, NIČ nove mreže):
//  • pokrito = Σ kolicina postavk naročil S STATUSOM OSNUTEK (EN VIR
//    STATUSI_NAROCIL narocila-pregled-pdf R257 — statusna množica NE
//    podvajana), JOIN po IDENTITETI item.inventoryId === artikel.id (v === s
//    — R260/R261 lekcija: naziv/sifra sta prikazna resnica, join je po id);
//  • manjkajoci = max(0, minimalnaZaloga − kolicinaZaloga) — izpeljana
//    resnica deficita (pod minimumom);
//  • pokritost % = pokrito / manjkajoci × 100 — SAMO pri manjkajoci > 0;
//    artikel nad minimumom NIČ ne manjka → '—' sivo (NIKOLI izmišljen 0 %
//    ali 100 %, R258/R261 vzorec);
//  • status vrstice (iskren jezik): POKRITO (pokrito ≥ manjkajoci, deficita
//    je osnutek v celoti pokril) / DELNO (0 < pokrito < manjkajoci) /
//    NEPOKRITO (pokrito = 0 IN manjkajoci > 0) / NAD MINIMUMOM (manjkajoci
//    = 0, a artikel ima pokrito > 0 — osnutek naroča VEČ istega artikla:
//    iskrena vrstica, brez %);
//  • vrstica = artikel z manjkajoci > 0 ALI pokrito > 0; ostali (nad
//    minimumom brez osnutka) NIMAJO kaj pokazati — ŠTEVEC poimenovan v
//    sklepu (nikoli tiho);
//  • postavka osnutka z inventoryId, ki ga ni med artikli (vlogsko zožen /
//    race): NE vrstica — števec + vsota enot POIMENOVANA v sklepu (R261
//    'brez projektnega zapisa' vzorec);
//  • ne-OSNUTEK naročila (POSLANO/POTRJENO/DOBLJENO/PREKlicANO): NIČ ne
//    pokrivajo (osnutek je OBLJUBA, ne nabava) — dokazano z E2E (POSLANO z
//    999 enot ostane neštet).
//
// ENA RESNICA z zaslonom (WYSIWYG):
//  • ISTA izpeljava zalogaOsnutekPokritost poganja PDF KPI, tabelo, sklep IN
//    kondicionalno mini-vrstico 'Pokritost osnutka' + toast — ENA izpeljava;
//  • sort = ŠIFRA ASC (računovodski red zaloge; navadno < po UTF-16 kodnih
//    točkah — brez locale-odvisnega primerjanja, R245/R250/R257 vzorec),
//    izenačba naziv ASC, nato id ASC (determinističen tiebreak). Sort
//    INTERNI PRED vsotami — f(MNOŽICA) (R248 vzorec).
//
// Načela (družinska pravila):
//  • Fail-closed: pokvaren vnos → TypeError (status iz znane množice EN VIR,
//    količine končno ne-negativne, id/sifra/naziv/enota ne-prazna niza —
//    indeks krivca v sporočilu). PRAZEN PRESEK (0 artiklov IN 0 naročil) ne
//    nastaja dokumenta (družina: ni prazne datoteke; komponenta pokaže
//    iskren toast). EN ne-prazen vir ZADOVOLJI.
//  • Determinizem: `now` KOT parameter; doc.setCreationDate(now) +
//    doc.setFileId(FNV-1a) — enak vhod = bajtno enak PDF (document-pdf R121).
//  • CLIENT-safe: uvozi ga material-intelligence-tab (client) — čista JS
//    FNV-1a (node:crypto NE sme v client bundle — lekcija R234); LASTNI soli
//    **0x85–0x88** (register: … naročila pregled 0x79–7c, dobičkonost
//    0x7d–0x80, računi po projektih 0x81–0x84 → zaloga-osnutek 0x85–0x88 —
//    ista semena v dveh libih NE smejo dati isti ID).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { todayStamp } from './csv-export'
import { zalogaPovzetekCasOznaka } from './zaloga-povzetek'
import { STATUSI_NAROCIL } from './narocila-pregled-pdf'

// ---------- barve (ISTI dokumenti družina — usklajeno s prihodki/narocila) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber (delna pokritost)
const GREEN: [number, number, number] = [22, 163, 74] // roksal-green (polna pokritost)
const RED: [number, number, number] = [220, 38, 38] // zaloga-pdf R120 red (nepokrit deficit)
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

/** Client-safe prerez ENEGA zalogovnega artikla (podmnožica GET
 *  /api/inventory). */
export interface ZalogaOsnutekArtikel {
  /** ID artikla (ne-prazen — IDENTITETA joina, fail-closed). */
  id: string
  /** Šifra materiala (ne-prazen — sort ključ). */
  sifraMateriala: string
  /** Naziv artikla (ne-prazen). */
  naziv: string
  /** Trenutna zaloga (končno ne-negativna). */
  kolicinaZaloga: number
  /** Enota (ne-prazna — kos/m/…). */
  enota: string
  /** Minimalna zaloga (končno ne-negativna). */
  minimalnaZaloga: number
}

/** Client-safe prerez ENE postavke naročila (podmnožica GET
 *  /api/material-orders → items). inventoryId = IDENTITETA joina. */
export interface ZalogaOsnutekPostavka {
  /** ID zalogovnega artikla (ne-prazen — identiteta joina). */
  inventoryId: string
  /** Količina v osnutku (končno ne-negativna). */
  kolicina: number
}

/** Client-safe prerez ENEGA naročila — status odloča o pokritosti (samo
 *  OSNUTEK pokriva; EN VIR STATUSI_NAROCIL). */
export interface ZalogaOsnutekNarocilo {
  /** VERBATIM status iz API-ja (5 znanih — EN VIR STATUSI_NAROCIL). */
  status: string
  /** Postavke naročila (prazno polje = veljavno naročilo brez postavk). */
  items: readonly ZalogaOsnutekPostavka[]
}

export interface ZalogaOsnutekPdfOptions {
  /** Referenčni trenutek (žig + CreationDate + fileId + ime) — KOT
   *  PARAMETER (determinizem; vzorec R203/R244/R250/R257/R258/R261). */
  now: Date
}

/** Fail-closed preverba artikla (indeks krivca VEDNO v sporočilu). */
export function preveriZalogaOsnutekArtikel(a: ZalogaOsnutekArtikel, i: number): void {
  if (!a || typeof a !== 'object') {
    throw new TypeError(`preveriZalogaOsnutekArtikel (${i}): pričakovan artikel (ZalogaOsnutekArtikel)`)
  }
  for (const [k, v] of [
    ['id', a.id],
    ['sifraMateriala', a.sifraMateriala],
    ['naziv', a.naziv],
    ['enota', a.enota],
  ] as const) {
    if (typeof v !== 'string' || v.trim() === '') {
      throw new TypeError(`preveriZalogaOsnutekArtikel (${i}): ${k} mora biti ne-prazen niz, ne ${String(v)}`)
    }
  }
  for (const [k, v] of [
    ['kolicinaZaloga', a.kolicinaZaloga],
    ['minimalnaZaloga', a.minimalnaZaloga],
  ] as const) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new TypeError(`preveriZalogaOsnutekArtikel (${i}): ${k} mora biti končno ne-negativno število, ne ${String(v)}`)
    }
  }
}

/** Fail-closed preverba naročila (status EN VIR + postavke; indeks krivca). */
export function preveriZalogaOsnutekNarocilo(n: ZalogaOsnutekNarocilo, i: number): void {
  if (!n || typeof n !== 'object') {
    throw new TypeError(`preveriZalogaOsnutekNarocilo (${i}): pričakovano naročilo (ZalogaOsnutekNarocilo)`)
  }
  if (typeof n.status !== 'string' || !(STATUSI_NAROCIL as readonly string[]).includes(n.status)) {
    throw new TypeError(`preveriZalogaOsnutekNarocilo (${i}): status mora biti eden iz ${STATUSI_NAROCIL.join('/')}, ne ${String(n.status)}`)
  }
  if (!Array.isArray(n.items)) {
    throw new TypeError(`preveriZalogaOsnutekNarocilo (${i}): items morajo biti polje`)
  }
  n.items.forEach((p, j) => {
    if (!p || typeof p !== 'object') {
      throw new TypeError(`preveriZalogaOsnutekNarocilo (${i}, postavka ${j}): pričakovana postavka (ZalogaOsnutekPostavka)`)
    }
    if (typeof p.inventoryId !== 'string' || p.inventoryId.trim() === '') {
      throw new TypeError(`preveriZalogaOsnutekNarocilo (${i}, postavka ${j}): inventoryId mora biti ne-prazen niz (identiteta joina), ne ${String(p.inventoryId)}`)
    }
    if (typeof p.kolicina !== 'number' || !Number.isFinite(p.kolicina) || p.kolicina < 0) {
      throw new TypeError(`preveriZalogaOsnutekNarocilo (${i}, postavka ${j}): kolicina mora biti končno ne-negativno število, ne ${String(p.kolicina)}`)
    }
  })
}

/** Znesek/količina kot stabilen niz — 1 decimalna mesta za količine (ISTI
 *  vzorec kot prihodki/dobicikonost znesekNiz; količine so lahko necel). */
function kolicinaNiz(k: number): string {
  return Number.isInteger(k) ? String(k) : k.toFixed(2)
}

/** Determinističen file-ID (32 hex) — čista JS FNV-1a; LASTNI soli 0x85–0x88. */
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
    fnv1aHex(seed, 0x85) +
    fnv1aHex(seed, 0x86) +
    fnv1aHex(seed, 0x87) +
    fnv1aHex(seed, 0x88)
  )
}

export interface ZalogaOsnutekVrsta {
  /** Šifra materiala (sort ključ). */
  sifra: string
  /** Naziv artikla. */
  naziv: string
  /** Enota. */
  enota: string
  /** Trenutna zaloga. */
  zaloga: number
  /** Minimalna zaloga. */
  minimum: number
  /** max(0, minimum − zaloga) — izpeljani deficit. */
  manjkajoci: number
  /** Σ kolicina OSNUTEK postavk tega artikla (0 = poimenovana prazna vsota). */
  pokrito: number
  /** pokrito / manjkajoci × 100; null če manjkajoci = 0 (NI definiran → '—'). */
  pokritostOdstotek: number | null
  /** POKRITO | DELNO | NEPOKRITO | NAD MINIMUMOM (iskren jezik — zgoraj). */
  status: 'POKRITO' | 'DELNO' | 'NEPOKRITO' | 'NAD MINIMUMOM'
}

export interface ZalogaOsnutekPovzetek {
  /** Št. vrstic (= sortirane.length). */
  artiklov: number
  /** Št. vrstic z manjkajoci > 0 (pod minimumom). */
  podMinimumom: number
  /** Št. vrstic statusa POKRITO. */
  pokritihCeloti: number
  /** Št. vrstic statusa DELNO. */
  delno: number
  /** Št. vrstic statusa NEPOKRITO. */
  nepokritih: number
  /** Σ pokrito enot čez vrstice. */
  pokritoEnot: number
  /** Σ manjkajoci čez vrstice z manjkajoci > 0. */
  manjkajociEnot: number
  /** Št. naročil statusa OSNUTEK (pokrivni vir). */
  osnutkov: number
  /** Št. artiklov nad minimumom BREZ osnutka (brez vrstice — poimenovano). */
  nadMinimumomBrezOsnutka: number
  /** Št. postavk OSNUTEK z inventoryId brez artikla (poimenovano v sklepu). */
  postavkBrezArtikla: number
  /** Σ kolicina postavk brez artikla (iskrena vsota — poimenovana). */
  enotBrezArtikla: number
}

/** Presek dveh virov — ENA resnica za KPI, tabelo, sklep, mini-vrstico IN
 *  toast (WYSIWYG). JOIN po IDENTITETI inventoryId === id (v === s — R260/
 *  R261 lekcija); SAMO status OSNUTEK pokriva (EN VIR STATUSI_NAROCIL);
 *  fail-verbose preverba VSEH vnosov (pokvaren vnos = pokvaren vir —
 *  NIKOLI tiho). */
export function zalogaOsnutekPokritost(
  artikli: readonly ZalogaOsnutekArtikel[],
  narocila: readonly ZalogaOsnutekNarocilo[],
): { vrste: ZalogaOsnutekVrsta[]; povzetek: ZalogaOsnutekPovzetek } {
  if (!Array.isArray(artikli)) {
    throw new TypeError('zalogaOsnutekPokritost: pričakovano polje artiklov (ZalogaOsnutekArtikel[])')
  }
  if (!Array.isArray(narocila)) {
    throw new TypeError('zalogaOsnutekPokritost: pričakovano polje naročil (ZalogaOsnutekNarocilo[])')
  }
  artikli.forEach((a, i) => preveriZalogaOsnutekArtikel(a, i))
  narocila.forEach((n, i) => preveriZalogaOsnutekNarocilo(n, i))

  const povzetek: ZalogaOsnutekPovzetek = {
    artiklov: 0,
    podMinimumom: 0,
    pokritihCeloti: 0,
    delno: 0,
    nepokritih: 0,
    pokritoEnot: 0,
    manjkajociEnot: 0,
    osnutkov: 0,
    nadMinimumomBrezOsnutka: 0,
    postavkBrezArtikla: 0,
    enotBrezArtikla: 0,
  }

  // Pokritost per IDENTITETI — Σ OSNUTEK postavk per inventoryId.
  const pokritost = new Map<string, number>()
  for (const n of narocila) {
    if (n.status !== 'OSNUTEK') continue
    povzetek.osnutkov += 1
    for (const p of n.items) {
      pokritost.set(p.inventoryId, (pokritost.get(p.inventoryId) ?? 0) + p.kolicina)
    }
  }

  const vrste: ZalogaOsnutekVrsta[] = []
  for (const a of artikli) {
    const pokrito = pokritost.get(a.id)
    if (pokrito === undefined) {
      // artikel, ki ga OSNUTEK ne omenja: vrstica SAMO kadar je pod
      // minimumom (deficit = resnica, ki jo dokument MORA pokazati);
      // nad minimumom brez osnutka = števec v sklepu (brez vrstice).
      if (a.kolicinaZaloga < a.minimalnaZaloga) {
        const manjkajoci = a.minimalnaZaloga - a.kolicinaZaloga
        vrste.push({
          sifra: a.sifraMateriala.trim(),
          naziv: a.naziv.trim(),
          enota: a.enota.trim(),
          zaloga: a.kolicinaZaloga,
          minimum: a.minimalnaZaloga,
          manjkajoci,
          pokrito: 0,
          pokritostOdstotek: 0,
          status: 'NEPOKRITO',
        })
      } else {
        povzetek.nadMinimumomBrezOsnutka += 1
      }
      continue
    }
    const manjkajoci = Math.max(0, a.minimalnaZaloga - a.kolicinaZaloga)
    vrste.push({
      sifra: a.sifraMateriala.trim(),
      naziv: a.naziv.trim(),
      enota: a.enota.trim(),
      zaloga: a.kolicinaZaloga,
      minimum: a.minimalnaZaloga,
      manjkajoci,
      pokrito,
      pokritostOdstotek: manjkajoci > 0 ? (pokrito / manjkajoci) * 100 : null,
      status:
        manjkajoci === 0
          ? 'NAD MINIMUMOM'
          : pokrito >= manjkajoci
            ? 'POKRITO'
            : pokrito > 0
              ? 'DELNO'
              : 'NEPOKRITO',
    })
  }
  // Postavke OSNUTEK, katerih inventoryId NI med artikli — števec + vsota
  // poimenovana (vlogsko zožen odgovor / race — nikoli tiho spregledano).
  const znani = new Set(artikli.map((a) => a.id))
  for (const n of narocila) {
    if (n.status !== 'OSNUTEK') continue
    for (const p of n.items) {
      if (!znani.has(p.inventoryId)) {
        povzetek.postavkBrezArtikla += 1
        povzetek.enotBrezArtikla += p.kolicina
      }
    }
  }
  sortirajZalogaOsnutek(vrste)

  povzetek.artiklov = vrste.length
  for (const v of vrste) {
    povzetek.pokritoEnot += v.pokrito
    if (v.manjkajoci > 0) {
      povzetek.podMinimumom += 1
      povzetek.manjkajociEnot += v.manjkajoci
      if (v.status === 'POKRITO') povzetek.pokritihCeloti += 1
      if (v.status === 'DELNO') povzetek.delno += 1
      if (v.status === 'NEPOKRITO') povzetek.nepokritih += 1
    }
  }
  return { vrste, povzetek }
}

/** Sort V LIBU — ŠIFRA ASC (navadno < po UTF-16 kodnih točkah — brez
 *  locale-odvisnega primerjanja), izenačba naziv ASC, nato id ASC.
 *  IZVOŽEN — determinizem = f(MNOŽICA). */
export function sortirajZalogaOsnutek(vrste: ZalogaOsnutekVrsta[]): ZalogaOsnutekVrsta[] {
  return vrste.sort((a, b) => {
    if (a.sifra !== b.sifra) return a.sifra < b.sifra ? -1 : 1
    if (a.naziv !== b.naziv) return a.naziv < b.naziv ? -1 : 1
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

/** KPI polje — ISTI vzorec kot prihodki/narocila/dobicikonost/racuni (družinski
 *  kpiBox). */
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

/** Zgradi ZALOGA — OSNUTEK POKRITOST dokument (brez shranjevanja) — vrne
 *  jsPDF instanco (testi berejo doc.output('arraybuffer') → bajtni dokazi). */
export function buildZalogaOsnutekPdfDoc(
  artikli: readonly ZalogaOsnutekArtikel[],
  narocila: readonly ZalogaOsnutekNarocilo[],
  options: ZalogaOsnutekPdfOptions,
): jsPDF {
  if (!Array.isArray(artikli) || !Array.isArray(narocila)) {
    throw new TypeError('buildZalogaOsnutekPdfDoc: pričakovani polji artiklov in naročil')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildZalogaOsnutekPdfDoc: pričakovane opcije (ZalogaOsnutekPdfOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildZalogaOsnutekPdfDoc: pričakovan veljaven now: Date')
  }
  // PRAZEN PRESEK ne nastaja dokumenta (družina: ni prazne datoteke —
  // komponenta pokaže iskren toast 'Ni podatkov za pokritost.').
  if (artikli.length === 0 && narocila.length === 0) {
    throw new TypeError(
      'buildZalogaOsnutekPdfDoc: prazen presek ne nastaja dokumenta — komponenta pokaže iskren toast (Ni podatkov za pokritost.)',
    )
  }
  const { vrste, povzetek } = zalogaOsnutekPokritost(artikli, narocila)

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / prihodki R250) ----------
  doc.setCreationDate(now)
  // Seed = f(MNOŽICA) — kanoniziran red (artikli: šifra/naziv/id ASC;
  // naročila: status + postavke kanon), NIKOLI vrstni red odgovora
  // (R250/R257/R258/R261 vzorec: sort pred seedom).
  const kanonArtikli = [...artikli].sort((a, b) => {
    if (a.sifraMateriala.trim() !== b.sifraMateriala.trim()) return a.sifraMateriala.trim() < b.sifraMateriala.trim() ? -1 : 1
    if (a.naziv.trim() !== b.naziv.trim()) return a.naziv.trim() < b.naziv.trim() ? -1 : 1
    if (a.id !== b.id) return a.id < b.id ? -1 : 1
    return 0
  })
  const kanonPostavke = [...narocila]
    .flatMap((n) => n.items.map((p) => ({ status: n.status, inventoryId: p.inventoryId, kolicina: p.kolicina })))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status < b.status ? -1 : 1
      if (a.inventoryId !== b.inventoryId) return a.inventoryId < b.inventoryId ? -1 : 1
      if (a.kolicina !== b.kolicina) return a.kolicina < b.kolicina ? -1 : 1
      return 0
    })
  doc.setFileId(
    deterministichenId(
      `${now.toISOString()}|A:${kanonArtikli
        .map((a) => `${a.sifraMateriala.trim()}/${a.id}/${kolicinaNiz(a.kolicinaZaloga)}/${kolicinaNiz(a.minimalnaZaloga)}`)
        .join(',')}|N:${kanonPostavke
        .map((p) => `${p.status}/${p.inventoryId}/${kolicinaNiz(p.kolicina)}`)
        .join(',')}`,
    ),
  )

  // ---------- glava (ISTI vzorec kot prihodki/narocila/dobicikonost) ----------
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
  doc.text('ZALOGA — OSNUTEK POKRITOST', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })

  // ---------- KPI povzetek (izračun iz preseka — notranja skladnost) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Povzetek pokritosti')
  // 5 polj → 33 mm boxi (ISTI layout kot prihodki R250 / naročila R257 /
  // dobičkonost R258 / računi po projektih R261).
  const bw = 33
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Artiklov', String(povzetek.artiklov), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Pod minimumom', String(povzetek.podMinimumom), povzetek.podMinimumom > 0 ? RED : NAVY)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Pokrito enot', kolicinaNiz(povzetek.pokritoEnot), povzetek.pokritoEnot > 0 ? GREEN : NAVY)
  kpiBox(doc, 14 + 3 * (bw + gap), y, bw, bh, 'Manjkajoče', kolicinaNiz(povzetek.manjkajociEnot), povzetek.manjkajociEnot > 0 ? AMBER : NAVY)
  kpiBox(doc, 14 + 4 * (bw + gap), y, bw, bh, 'Osnutkov', String(povzetek.osnutkov), NAVY)
  y += bh + 8

  // ---------- tabela artiklov (ŠIFRA ASC — računovodski red zaloge) ----------
  y = sectionTitle(doc, y, `Artikli (${vrste.length})`)
  autoTable(doc, {
    startY: y,
    head: [['Šifra', 'Artikel', 'Zaloga', 'Minimum', 'Manjkajoče', 'V osnutku', 'Pokritost (%)']],
    body: vrste.map((v) => [
      v.sifra,
      v.naziv,
      kolicinaNiz(v.zaloga),
      kolicinaNiz(v.minimum),
      kolicinaNiz(v.manjkajoci),
      kolicinaNiz(v.pokrito),
      v.pokritostOdstotek !== null ? v.pokritostOdstotek.toFixed(1) : '—',
    ]),
    styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
    didParseCell: (data) => {
      // WYSIWYG: nepokrit deficit rdeče bold (iskren alarm — NIKOLI utišan);
      // delna pokritost AMBER bold; polna (≥ 100 %) GREEN bold; '—' sivo
      // (NI definiran — artikel nad minimumom, R258/R261 vzorec).
      if (data.section === 'body' && data.column.index === 4 && data.cell.raw !== '—') {
        const v = Number(String(data.cell.raw ?? ''))
        if (Number.isFinite(v) && v > 0) {
          data.cell.styles.textColor = AMBER
          data.cell.styles.fontStyle = 'bold'
        }
      }
      if (data.section === 'body' && data.column.index === 6 && data.cell.raw !== '—') {
        const v = Number(String(data.cell.raw ?? ''))
        if (Number.isFinite(v) && v <= 0) {
          data.cell.styles.textColor = RED
          data.cell.styles.fontStyle = 'bold'
        } else if (Number.isFinite(v) && v < 100) {
          data.cell.styles.textColor = AMBER
          data.cell.styles.fontStyle = 'bold'
        } else if (Number.isFinite(v) && v >= 100) {
          data.cell.styles.textColor = GREEN
          data.cell.styles.fontStyle = 'bold'
        }
      }
      if (data.section === 'body' && data.column.index === 6 && data.cell.raw === '—') {
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
    `${povzetek.artiklov} artiklov · pod minimumom ${povzetek.podMinimumom} (manjka ${kolicinaNiz(povzetek.manjkajociEnot)} enot) · pokritih v celoti ${povzetek.pokritihCeloti} · delno ${povzetek.delno} · nepokritih ${povzetek.nepokritih} · pokrito ${kolicinaNiz(povzetek.pokritoEnot)} enot iz ${povzetek.osnutkov} osnutkov · nad minimumom brez osnutka ${povzetek.nadMinimumomBrezOsnutka} (brez vrstice) · postavk osnutkov brez artikla ${povzetek.postavkBrezArtikla} (${kolicinaNiz(povzetek.enotBrezArtikla)} enot).`,
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

/** Ime datoteke — `Zaloga-osnutek-pokritost-YYYY-MM-DD.pdf` (družinski vzorec;
 *  deterministično glede na `now`; EN now za žig IN ime — lekcija R121/R235). */
export function zalogaOsnutekPdfFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('zalogaOsnutekPdfFilename: pričakovan veljaven now: Date')
  }
  return `Zaloga-osnutek-pokritost-${todayStamp(now)}.pdf`
}

/** Zgeneriraj ZALOGA — OSNUTEK POKRITOST PDF (determinističen — enak vhod =
 *  bajtno enak dokument) in ga shrani. */
export function generateZalogaOsnutekPdf(
  artikli: readonly ZalogaOsnutekArtikel[],
  narocila: readonly ZalogaOsnutekNarocilo[],
  options: ZalogaOsnutekPdfOptions,
): void {
  const doc = buildZalogaOsnutekPdfDoc(artikli, narocila, options)
  doc.save(zalogaOsnutekPdfFilename(options.now))
}
