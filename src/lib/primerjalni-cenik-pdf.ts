// ---------------------------------------------------------------------------
// R245 (P1-g, 'izvozi' družina — 6. člen) — PRIMERJALNI CENIK PDF iz Material
// → Dobavitelji → 'Cene materiala'. CSV obstaja sočasno (ISTA runda); ta lib
// je njegov PRAVI PDF brat (vzorec cenik-pdf R244 / dobavitelji-pdf R236:
// ROKSAL glava, KPI, autoTable, noge, bajtni determinizem).
//
// LOČEN dokument od Cenika R244 (zavestna odločitev): cenik R244 ostane
// bajtno STABILEN (njegovi testi pijejo točne stolpce + determinizem) —
// primerjalni dokument je NOVA resnica: ENA vrstica per artikel (najnižja
// trenutno veljavna cena), ne vrstica per ponudba.
//
// ENA RESNICA z zaslonom in CSV (WYSIWYG — brat iz ISTEGA vira):
//  • vir podatkov = GET /api/material-prices (brez filtrov) — polje
//    `bestPerMaterial` (API že vrne: bestPrice = najnižja `cena` med
//    trenutno veljavnimi vnosi per inventoryId, bestSupplier = naziv
//    dobavitelja te cene, suppliers = št. dobaviteljev z veljavno ceno);
//    route NIČ (client+lib only — izvoz je potrošnik obstoječe resnice);
//  • stolpci tabele = TOČNO ISTI prerez kot CSV (R247 9 stolpcev: Artikel,
//    Šifra, Enota, Najboljša cena (EUR/enota), Najvišja (EUR/enota),
//    Razlika (EUR/enota), % razlike, Dobavitelj, Št. dobaviteljev);
//  • vrstice so sortirane V LIBU (artikel asc → najboljša cena asc →
//    dobavitelj asc → šifra asc) in sort je IZVOŽEN — CSV uporabi ISTI red
//    (WYSIWYG brata; izboljšava vzorca: cenik R244 CSV je šel po API redu,
//    primerjalni dobi skupni red že od prvega dne): bajtni determinizem je
//    odvisen od MNOŽICE vhodov, ne od vrstnega reda odgovora;
//  • KPI se RAČUNAJO iz obveznih polj vrstic (artikli, najnižja/najvišja
//    najboljša cena, primerjave = artikli z ≥ 2 ponudbami) — notranje
//    skladni; NIKOLI izmišljeni števci;
//  • iskren podpis v sklepni vrstici: 'samo trenutno veljavne cene' (route
//    filtrira veljavnostDo: null — pretečene ponudbe ne lažno spustijo
//    'najboljše' cene).
//
// Načela (družinska pravila — ISTA kot cenik-pdf R244):
//  • Fail-closed: pokvaren vnos → TypeError (artikel/šifra/enota/dobavitelj
//    ne-prazni nizi, najboljšaCena končno ne-negativno število,
//    stDobaviteljev celo število ≥ 1 — indeks krivca v sporočilu). PRAZEN
//    SEZNAM ne nastaja dokumenta (R232–R244 družina: ni prazne datoteke;
//    komponenta pokaže iskren toast 'Ni vpisanih cen za primerjavo.').
//  • Determinizem: `now` pride KOT parameter; doc.setCreationDate(now) +
//    doc.setFileId(FNV-1a) — enak vhod = bajtno enak PDF (document-pdf R121
//    100× pravilo).
//  • CLIENT-safe: čista JS FNV-1a (node:crypto NE sme v client bundle —
//    lekcija R234); LASTNI soli **0x51–0x54** (register: zaloga 0x01–04,
//    naročilnica 0x11–14, dobavitelji 0x21–24, osnutek 0x31–34, cenik
//    0x41–44, primerjalni 0x51–54 — ista semena v dveh libih NE smejo dati
//    isti ID).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { todayStamp } from './csv-export'
import { zalogaPovzetekCasOznaka } from './zaloga-povzetek'
import { artikelBeseda } from './cenik-pdf'

// ---------- barve (ISTI dokumenti družina — usklajeno z cenik-pdf R244) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const GREEN: [number, number, number] = [22, 163, 74] // roksal-green
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

/** Client-safe prerez ENE primerjalne vrstice (polje `bestPerMaterial` iz
 *  GET /api/material-prices brez filtrov) + razponska dimenzija (R246, P1-g
 *  nadaljevanje): najvišja veljavna cena IZ ISTEGA odgovora (polje `prices`
 *  = vse trenutno veljavne ponudbe) — razlika do najvišje je resnično
 *  IZPELJANA iz obstoječih vrstic (nič izmišljenega; 1 ponudba → razlika
 *  0,00 = resnica: brez ponudb za primerjavo ni razpona). ENA vrstica = EN
 *  artikel. */
export interface PrimerjalniPdfVnos {
  artikel: string
  sifra: string
  enota: string
  /** Najnižja trenutno veljavna cena per artikel (EUR na enoto). */
  najboljsaCena: number
  /** Najvišja trenutno veljavna cena za ta artikel (EUR na enoto; iz polja
   *  prices ISTEGA odgovora — R246). ≥ najboljsaCena (preveriPrimerjalniVnos
   *  to zagotavlja — negativna razlika ne obstaja). */
  najvisjaCena: number
  /** Dobavitelj najnižje cene (API `bestSupplier`). */
  dobavitelj: string
  /** Št. dobaviteljev z veljavno ceno za ta artikel (API `suppliers`). */
  stDobaviteljev: number
}

export interface PrimerjalniPdfOptions {
  /** Referenčni trenutek (žig + CreationDate + fileId + ime) — KOT PARAMETER
   *  (determinizem, vzorec R203/R204/R167/R244). */
  now: Date
}

/** Fail-closed preverba primerjalne vrstice (obvezna polja; indeks krivca je
 *  VEDNO v sporočilu — družina R236/R244). */
export function preveriPrimerjalniVnos(p: PrimerjalniPdfVnos, i: number): void {
  if (!p || typeof p !== 'object') {
    throw new TypeError(`preveriPrimerjalniVnos (${i}): pričakovana primerjalna vrstica (PrimerjalniPdfVnos)`)
  }
  for (const [k, v] of [
    ['artikel', p.artikel],
    ['sifra', p.sifra],
    ['enota', p.enota],
    ['dobavitelj', p.dobavitelj],
  ] as const) {
    if (typeof v !== 'string' || v.trim() === '') {
      throw new TypeError(`preveriPrimerjalniVnos (${i}): ${k} mora biti ne-prazen niz, ne ${String(v)}`)
    }
  }
  if (typeof p.najboljsaCena !== 'number' || !Number.isFinite(p.najboljsaCena) || p.najboljsaCena < 0) {
    throw new TypeError(`preveriPrimerjalniVnos (${i}): najboljsaCena mora biti končno ne-negativno število, ne ${String(p.najboljsaCena)}`)
  }
  if (typeof p.najvisjaCena !== 'number' || !Number.isFinite(p.najvisjaCena) || p.najvisjaCena < 0) {
    throw new TypeError(`preveriPrimerjalniVnos (${i}): najvisjaCena mora biti končno ne-negativno število, ne ${String(p.najvisjaCena)}`)
  }
  if (p.najvisjaCena < p.najboljsaCena) {
    throw new TypeError(`preveriPrimerjalniVnos (${i}): najvisjaCena (${String(p.najvisjaCena)}) ne sme biti pod najboljsa (${String(p.najboljsaCena)}) — negativna razlika ne obstaja`)
  }
  if (typeof p.stDobaviteljev !== 'number' || !Number.isInteger(p.stDobaviteljev) || p.stDobaviteljev < 1) {
    throw new TypeError(`preveriPrimerjalniVnos (${i}): stDobaviteljev mora biti celo število ≥ 1, ne ${String(p.stDobaviteljev)}`)
  }
}

/** Determinističen file-ID (32 hex) iz semena — čista JS FNV-1a (CLIENT-safe;
 *  LASTNI soli 0x51–0x54: vsak PDF lib družine ima svoje — cenik 0x41–44,
 *  primerjalni 0x51–54 — ista semena v dveh libih NE smejo dati isti ID). */
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
    fnv1aHex(seed, 0x51) +
    fnv1aHex(seed, 0x52) +
    fnv1aHex(seed, 0x53) +
    fnv1aHex(seed, 0x54)
  )
}

/** Razlika do najvišje veljavne cene (EUR/enota) — ENOGA izpeljava za PDF
 *  (KPI Prihranek + stolpec) IN CSV (EN vir resnice; 1 ponudba → 0 = resnica,
 *  brez ponudb za primerjavo ni razpona). */
export function razlikaDoNajvisje(v: PrimerjalniPdfVnos): number {
  return v.najvisjaCena - v.najboljsaCena
}

/** Razlika izražena v % najboljše cene (R247, P1-g nadaljevanje — naslednja
 *  logična korak razponske dimenzije po R246) — ENA izpeljava za PDF stolpec
 *  IN CSV stolpec (ISTI prikaz = WYSIWYG brata).
 *
 *  Fail-closed matematični rob: najboljša cena 0 z razliko > 0 → TypeError
 *  (odstotek od nič NI izraziv — NIKOLI izmišljen 999%/∞; indeks krivca
 *  doda klicatelj prek preveriPrimerjalniVnos vrstnega reda). najboljša 0
 *  z razliko 0 → 0 (iskrena resnica: brez ponudb za primerjavo ni razpona,
 *  ISTI vzorec kot razlikaDoNajvisje 1 ponudbe). */
export function razlikaOdstotek(v: PrimerjalniPdfVnos): number {
  const razlika = razlikaDoNajvisje(v)
  if (v.najboljsaCena === 0) {
    if (razlika > 0) {
      throw new TypeError(
        `razlikaOdstotek: odstotek od najboljše cene 0 ne obstaja (najvišja ${String(v.najvisjaCena)} EUR — razlika od nič ni izraziva v %, NIKOLI izmišljena)`,
      )
    }
    return 0
  }
  return (razlika / v.najboljsaCena) * 100
}

/** Prikazna resnica razlike v % — ENA decimalna mesta + decimalna vejica
 *  (slovenski zapis, ISTI niz v PDF celici IN CSV polju — WYSIWYG; FP lekcija
 *  R246: trditve na prikaznem nizu, ne na goli FP razliki). */
export function razlikaOdstotekNiz(v: PrimerjalniPdfVnos): string {
  return razlikaOdstotek(v).toFixed(1).replace('.', ',')
}

/** Povprečni razpon v % (R248, P1-g nadaljevanje — agregatna izpeljava
 *  razponske dimenzije: per-row % razlike R247 dobi svoj skupni povzetek) —
 *  vsota razlik / vsota NAJBOLJŠIH cen × 100. Imenovatelj je vsota najboljših
 *  (NE najvišjih — delovna opomba iz R247 handoverja je pomenila nasprotno,
 *  ampak ENA resnica zahteva skladnost s stolpcem '% razlike' R247, ki je
 *  razlika v % NAJBOLJŠE cene: agregat ISTIH razmerij = uteženo povprečje
 *  stolpca; z vsoto najvišjih bi bralcu seštevanje stolpca dalo drugo
 *  številko kot KPI — lažna neskladnost).
 *
 *  Fail-closed matematični rob (ISTI vzorec kot razlikaOdstotek R247):
 *  vsota najboljših 0 z vsoto razlik > 0 → TypeError (odstotek od nič NI
 *  izraziv — NIKOLI izmišljen 999 %/∞); vsota najboljših 0 z vsoto razlik 0
 *  → 0 (iskrena resnica: brez razpona ni povprečja).
 *
 *  Determinizem: sortira interno (sortirajPrimerjalni) pred seštevanjem —
 *  FP seštevanje je odvisno od vrstnega reda, rezultat mora biti f(MNOŽICA),
 *  ne f(vrstni red odgovora) — ISTI vzorec kot sort V LIBU (R245). */
export function povprecniRazpon(vnosi: readonly PrimerjalniPdfVnos[]): number {
  const sortirane = sortirajPrimerjalni(vnosi)
  const vsotaNajboljsih = sortirane.reduce((s, p) => s + p.najboljsaCena, 0)
  const vsotaRazlik = sortirane.reduce((s, p) => s + razlikaDoNajvisje(p), 0)
  if (vsotaNajboljsih === 0) {
    if (vsotaRazlik > 0) {
      throw new TypeError(
        `povprecniRazpon: odstotek od vsote najboljših cen 0 ne obstaja (vsota razlik ${String(vsotaRazlik)} EUR — razlika od nič ni izraziva v %, NIKOLI izmišljena)`,
      )
    }
    return 0
  }
  return (vsotaRazlik / vsotaNajboljsih) * 100
}

/** Prikazna resnica povprečnega razpona — ENA decimalna mesta + decimalna
 *  vejica (slovenski zapis, ISTI vzorec kot razlikaOdstotekNiz R247: ISTI
 *  niz v PDF KPI boxu, sklepni vrstici IN toast opisu — WYSIWYG). */
export function povprecniRazponNiz(vnosi: readonly PrimerjalniPdfVnos[]): string {
  return povprecniRazpon(vnosi).toFixed(1).replace('.', ',')
}

/** Največji razpon v % (R249, P1-g nadaljevanje — tretji element razponske
 *  dimenzije: per-row % razlike R247 + povprečni R248 dobita še najširšega —
 *  max per-row %: KJE je prostor za pogajanja največji). IZPELJAN iz
 *  ISTEGA odgovora (razlikaOdstotek nad vsako vrstico), NIKOLI izmišljen.
 *
 *  Fail-closed matematični rob (DEDOVAN od razlikaOdstotek R247 — ISTI
 *  vzorec): vrstica z najboljšo ceno 0 in razliko > 0 → TypeError (odstotek
 *  od nič NI izraziv — NIKOLI izmišljen 999 %/∞). Poleg tega LASTNI rob:
 *  prazen seznam → TypeError (max prazne množice NE obstaja — NIKOLI
 *  izmišljen -Infinity; buildPrimerjalniPdfDoc prazne sezname že blokira,
 *  čista funkcija je iskrena tudi sama).
 *
 *  Determinizem: max je UREJENOSTNA INVARIANTA (f(množica) po naravi —
 *  vsak per-row % je determinističen, max med njimi ne potrebuje notranje
 *  sortravanja; razlika od povprecniRazpon R248, kjer FP seštevanje sorto
 *  ZAHTEVA — dokumentirano, test dokazuje premešan red = ISTI rezultat). */
export function najvecjiRazpon(vnosi: readonly PrimerjalniPdfVnos[]): number {
  if (!Array.isArray(vnosi) || vnosi.length === 0) {
    throw new TypeError(
      'najvecjiRazpon: prazen seznam nima največjega razpona (max prazne množice ne obstaja — NIKOLI izmišljen -Infinity)',
    )
  }
  return Math.max(...vnosi.map((p) => razlikaOdstotek(p)))
}

/** Prikazna resnica največjega razpona — ENA decimalna mesta + decimalna
 *  vejica (slovenski zapis, ISTI vzorec kot povprecniRazponNiz R248: ISTI
 *  niz v PDF KPI boxu, sklepni vrstici IN toast opisu — WYSIWYG). */
export function najvecjiRazponNiz(vnosi: readonly PrimerjalniPdfVnos[]): string {
  return najvecjiRazpon(vnosi).toFixed(1).replace('.', ',')
}

/** Sort vrstic V LIBU — skupni red (artikel asc → najboljša cena asc →
 *  dobavitelj asc → šifra asc): bajtni determinizem = f(MNOŽICA vhodov), ne
 *  f(vrstni red odgovora). IZVOŽEN — CSV brat uporabi ISTI red (WYSIWYG).
 *  localeCompare NE uporabljamo (locale odvisen — navadno < primerjanje po
 *  UTF-16 kodnih točkah je povsod isto). */
export function sortirajPrimerjalni(vnosi: readonly PrimerjalniPdfVnos[]): PrimerjalniPdfVnos[] {
  return [...vnosi].sort((a, b) => {
    if (a.artikel !== b.artikel) return a.artikel < b.artikel ? -1 : 1
    if (a.najboljsaCena !== b.najboljsaCena) return a.najboljsaCena - b.najboljsaCena
    if (a.dobavitelj !== b.dobavitelj) return a.dobavitelj < b.dobavitelj ? -1 : 1
    if (a.sifra !== b.sifra) return a.sifra < b.sifra ? -1 : 1
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

/** KPI polje — ISTI vzorec kot zaloga-pdf/naročilnica/dobavitelji/cenik. */
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

/** Cena kot stabilen niz — točkovna dela na 2 decimalni mesti (ISTI vzorec
 *  kot cenik-pdf R244 — String(9.25) = '9.25' bi izgledal drugače kot 9.25
 *  z dvema mestoma; tabela ostane računovodsko berljiva). */
function cenaNiz(c: number): string {
  return c.toFixed(2)
}

/** Zgradi PRIMERJALNI CENIK dokument (brez shranjevanja) — vrne jsPDF
 *  instanco (testi berejo doc.output('arraybuffer') → bajtni dokazi). */
export function buildPrimerjalniPdfDoc(
  vnosi: readonly PrimerjalniPdfVnos[],
  options: PrimerjalniPdfOptions,
): jsPDF {
  if (!Array.isArray(vnosi)) {
    throw new TypeError('buildPrimerjalniPdfDoc: pričakovano polje primerjalnih vrstic (PrimerjalniPdfVnos[])')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildPrimerjalniPdfDoc: pričakovane opcije (PrimerjalniPdfOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildPrimerjalniPdfDoc: pričakovan veljaven now: Date')
  }
  // PRAZEN SEZNAM ne nastaja dokumenta (družina: ni prazne datoteke —
  // komponenta pokaže iskren toast 'Ni vpisanih cen za primerjavo.').
  if (vnosi.length === 0) {
    throw new TypeError(
      'buildPrimerjalniPdfDoc: prazen seznam ne nastaja dokumenta — komponenta pokaže iskren toast (Ni vpisanih cen za primerjavo.)',
    )
  }
  vnosi.forEach((p, i) => preveriPrimerjalniVnos(p, i))
  const sortirane = sortirajPrimerjalni(vnosi)

  // KPI se RAČUNAJO iz obveznih polj vrstic (notranja skladnost — glej glavo
  // liba): št. artiklov, najnižja/najvišja najboljša cena, primerjave =
  // artikli z ≥ 2 ponudbami (kjer primerjava RES obstaja — amber poudarek),
  // prihranek = vsota razlik do najvišjih veljavnih cen (per enota; R246
  // razponska dimenzija — zeleno, pozitiven signal).
  const najnizja = Math.min(...sortirane.map((p) => p.najboljsaCena))
  const najvisjaKpi = Math.max(...sortirane.map((p) => p.najvisjaCena))
  const primerjave = sortirane.filter((p) => p.stDobaviteljev >= 2).length
  const prihranek = sortirane.reduce((s, p) => s + razlikaDoNajvisje(p), 0)
  // R248: agregat razponske dimenzije — povprečni razpon v % (vsota razlik /
  // vsota najboljših; izpeljava povprecniRazpon sortira interno — ISTI
  // determinizem f(množica)). KPI box barva = ISTI signal kot per-row %
  // (R247): razpon > 0 amber (prostor za pogajanja), 0 navy (resnica brez
  // lažnega signala).
  const povprecni = povprecniRazpon(sortirane)
  // R249: najširši razpon (max per-row % — 7. KPI). Dedi fail-closed rob
  // razlikaOdstotek (R247) + lastni prazen-seznam rob (max ne obstaja);
  // max je urejenostna invarianta — brez sorte, f(množica) po naravi.
  const najvecji = najvecjiRazpon(sortirane)

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / cenik R244) ----------
  doc.setCreationDate(now)
  doc.setFileId(
    deterministichenId(
      `${now.toISOString()}|${sortirane
        .map((p) => `${p.sifra.trim()}:${p.dobavitelj.trim()}/${cenaNiz(p.najboljsaCena)}#${p.stDobaviteljev}`)
        .join(',')}`,
    ),
  )

  // ---------- glava (ISTI vzorec kot boss-report/zaloga/naročilnica/dobavitelji/cenik) ----------
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
  doc.text('PRIMERJALNI CENIK', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })

  // ---------- KPI povzetek (izračun iz vrstic — notranja skladnost) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Povzetek primerjalnega cenika')
  // R246: 5 polj (razponska dimenzija) → ožji box (33 mm) v ISTI vrsti (5×33 + 4×4 = 181 ≤ 182)
  const bw = 33
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Artikli', String(sortirane.length), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Najnižja', `${cenaNiz(najnizja)} €`, GREEN)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Najvišja', `${cenaNiz(najvisjaKpi)} €`, AMBER)
  kpiBox(doc, 14 + 3 * (bw + gap), y, bw, bh, 'Primerjave', String(primerjave), NAVY)
  kpiBox(doc, 14 + 4 * (bw + gap), y, bw, bh, 'Prihranek', `${cenaNiz(prihranek)} €`, GREEN)
  y += bh + 4
  // R248: druga KPI vrsta — Povprečni razpon % (6. KPI; 33 mm box = ISTI
  // vzorec, vrednost je kratek % niz — EUR boxi ostanejo nespremenjeni,
  // brez stiskanja vrednosti v ožjo vrsto).
  kpiBox(doc, 14, y, bw, bh, 'Povprečni razpon', `${povprecniRazponNiz(sortirane)} %`, povprecni > 0 ? AMBER : NAVY)
  // R249: Največji razpon (max per-row %) v ISTI drugi vrsti (2× 33 mm —
  // kratka % niza, brez prenašanja; ISTI signal kot povprečni/per-row %:
  // amber > 0 = prostor za pogajanja, navy 0 = resnica brez lažnega signala).
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Največji razpon', `${najvecjiRazponNiz(sortirane)} %`, najvecji > 0 ? AMBER : NAVY)
  y += bh + 8

  // ---------- tabela primerjalnega cenika (ENA resnica = stolpci CSV; R246 razponska dimenzija + R247 % razlika) ----------
  y = sectionTitle(doc, y, `Najboljše cene per artikel (${sortirane.length})`)
  autoTable(doc, {
    startY: y,
    head: [['Artikel', 'Šifra', 'Enota', 'Najboljša cena (EUR/enota)', 'Najvišja (EUR/enota)', 'Razlika (EUR/enota)', '% razlike', 'Dobavitelj', 'Št. dobaviteljev']],
    body: sortirane.map((p) => [
      p.artikel.trim(),
      p.sifra.trim(),
      p.enota.trim(),
      cenaNiz(p.najboljsaCena),
      cenaNiz(p.najvisjaCena),
      cenaNiz(razlikaDoNajvisje(p)),
      razlikaOdstotekNiz(p),
      p.dobavitelj.trim(),
      String(p.stDobaviteljev),
    ]),
    styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 34 },
      6: { cellWidth: 16, halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      8: { halign: 'right' },
    },
    didParseCell: (data) => {
      // WYSIWYG z zaslonom: najboljša cena zeleno bold (ISTI pomen zelene
      // resnice kot v ceniku R244 — ključna številka ne utone); razlika > 0
      // amber bold (prostor za pogajanja — kjer razpon RES obstaja); razlika
      // 0 (1 ponudba) ostane navadna — resnica brez lažnega signala.
      // R247: % razlike > 0 isti amber signal kot EUR razlika (ista paleta,
      // isti pomen — odstotek je ISTA resnica v drugi enoti).
      if (data.section === 'body' && data.column.index === 3) {
        data.cell.styles.textColor = GREEN
        data.cell.styles.fontStyle = 'bold'
      }
      if (data.section === 'body' && data.column.index === 5) {
        const v = String(data.cell.raw ?? '')
        if (Number(v.replace(',', '.')) > 0) {
          data.cell.styles.textColor = AMBER
          data.cell.styles.fontStyle = 'bold'
        }
      }
      if (data.section === 'body' && data.column.index === 6) {
        const v = String(data.cell.raw ?? '')
        if (Number(v.replace(',', '.')) > 0) {
          data.cell.styles.textColor = AMBER
          data.cell.styles.fontStyle = 'bold'
        }
      }
      if (data.section === 'body' && data.column.index === 8) {
        const v = String(data.cell.raw ?? '')
        if (Number(v) >= 2) {
          data.cell.styles.textColor = AMBER
          data.cell.styles.fontStyle = 'bold'
        }
      }
    },
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 6

  // ---------- sklepna vrstica (ISTA sklanjatev družina + iskren podpis) ----------
  if (y > 255) {
    doc.addPage()
    y = 20
  }
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text(
    `${sortirane.length} ${artikelBeseda(sortirane.length)} · najnižja vpisana cena per artikel · vsota razlik do najvišjih veljavnih cen ${cenaNiz(prihranek)} EUR/enota · razpon izražen tudi v odstotkih najboljše cene · povprečni razpon ${povprecniRazponNiz(sortirane)} % najboljše cene · največji razpon ${najvecjiRazponNiz(sortirane)} % najboljše cene · samo trenutno veljavne cene (pretečene niso vključene).`,
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

/** Ime datoteke primerjalnega cenika — `Primerjalni-cenik-YYYY-MM-DD.pdf`
 *  (ISTI vzorec kot cenikPdfFilename R244; EN now za žig IN ime — lekcija
 *  R121/R235). */
export function primerjalniPdfFilename(now: Date): string {
  return `Primerjalni-cenik-${todayStamp(now)}.pdf`
}

/** Zgeneriraj Primerjalni cenik PDF (determinističen — enak vhod = bajtno
 *  enak dokument) in ga shrani kot `Primerjalni-cenik-YYYY-MM-DD.pdf`. */
export function generatePrimerjalniPdf(
  vnosi: readonly PrimerjalniPdfVnos[],
  options: PrimerjalniPdfOptions,
): void {
  const doc = buildPrimerjalniPdfDoc(vnosi, options)
  doc.save(primerjalniPdfFilename(options.now))
}
