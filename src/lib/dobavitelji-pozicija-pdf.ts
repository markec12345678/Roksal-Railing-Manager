// ---------------------------------------------------------------------------
// R264 (P1-f, 'izvozi' družina — 20. člen) — DOBAVITELJI — POZICIJA CEN PDF iz
// Material pregleda (material-intelligence-tab, podzavihek Cenik). Vzorec
// stranke-pokritost-pdf R263 / zaloga-osnutek-pdf R262 / primerjalni cenik
// R245–R249: ROKSAL glava, KPI, autoTable, noge, bajtni determinizem.
//
// PRESEK DVEH POLJ IZ ISTEGA API ODGOVORA (route NIČ — client+lib only;
// material-intelligence tab ŽE fetcha /api/material-prices ob kliku —
// R244/R245 precedens FRESH-podatki ob kliku, NIČ nove mreže):
//  • prices (veljavne ponudbe: inventoryId × dobavitelj × cena) ×
//    bestPerMaterial (najnižja veljavna cena per artikel, ENA vrstica per
//    artikel, suppliers = št. veljavnih ponudb);
//  • JOIN po IDENTITETI inventoryId === inventoryId (v === s — R260–R263
//    lekcija); cena brez ujemajoče best vrstice = pokvaren vir → TypeError
//    (NIKOLI izmišljena najnižja, R245 vzorec);
//  • razlika % per ponudba = (cena − bestPrice) / bestPrice × 100 — VEDNO
//    definiran (bestPrice > 0: bestPrice 0 = necena/placeholder → razlika
//    % NE obstaja → TypeError, deljenje z nič NE obstaja, NIKOLI Infinity);
//  • pozicija ponudbe (iskren jezik): NAJNIŽJA (cena === bestPrice — po
//    VREDNOSTI; dva istocenovna dobavitelja sta OBADVA najnižja — iskreno,
//    bestSupplier iz API-ja je prikazna resnica, ta dokument šteje vrednosti)
//    ALI VIŠJA (cena > bestPrice); cena < bestPrice = pokvaren vir →
//    TypeError (bestPrice je MIN po konstrukciji ISTEGA odgovora);
//  • per DOBAVITELJ agregat: ponudb / najnižjih / višjih / povprečni
//    odstopek = Σ razlika % čez VIŠJE vrstice / višjih — SAMO pri višjih
//    > 0, sicer null '—' (vse najnižje = NIČ povprečja prazne množice —
//    NIKOLI izmišljen 0 %; akcijska resnica: kako drag je, ko NI najcenejši);
//    najširši razpon = max razlika % čez VSE njegove vrstice (0 = vse
//    najnižje — iskrena resnica, VEDNO definiran);
//  • vrstica = VSAK dobavitelj z vsaj eno veljavno ponudbo (referenčni
//    pregled — NE rangiranje; sort IME ASC + izenačba dobaviteljId ASC,
//    navadno < — brez locale-odvisnega primerjanja; dva istonaslovna
//    dobavitelja = RAZLIČNI resnici po id, R260–R263 lekcija);
//  • artiklov = št. vrstic bestPerMaterial (distinct inventoryId z vsaj
//    eno veljavno ponudbo); brez alternative = best vrstice z suppliers
//    === 1 (samo ena ponudba — NIČ primerjave, cenitveno tveganje — RED
//    pri > 0); best vrstica brez ujemajoče cene (cenitvena race) =
//    števec poimenovan v sklepu (NIKOLI tiho);
//  • bestPerMaterial vrstica brez ujemajoče cene = števec + poimenovan
//    (vlogsko zožen / race — R262 'brez zapisa' vzorec).
//
// ENA RESNICA (WYSIWYG):
//  • ISTA izpeljava dobaviteljiPozicijaCen poganja PDF KPI, tabelo, sklep
//    IN toast — ENA izpeljava (klicatelj jo požene ENKRAT in podaja ISTO
//    resnico naprej — fresh fetch ob kliku, ni state-a, zato mini-vrstice
//    NIČ — legenda nosi resnico, R259 F2 precedens);
//  • višja pozicija NIKOLI utišana (višjih števec AMBER — normalno stanje
//    trga, NI alarm; alarm je samo brez-alternativa RED).
//
// Načela (družinska pravila):
//  • Fail-closed: pokvaren vnos → TypeError z indeksom krivca (cena končno
//    ≥ 0, dobavitelj ne-prazen, suppliers končno ≥ 1, JOIN in min-invarianta
//    preverjena). PRAZEN SEZNAM cen ne nastaja dokumenta (družina: ni
//    prazne datoteke; komponenta pokaže iskren toast).
//  • Determinizem: `now` KOT parameter; doc.setCreationDate(now) +
//    doc.setFileId(FNV-1a) — enak vhod = bajtno enak PDF (document-pdf R121).
//  • CLIENT-safe: čista JS FNV-1a; LASTNI soli **0x8d–0x90** (register:
//    … stranke-pokritost 0x89–0x8c → dobavitelji-pozicija 0x8d–0x90 —
//    ista semena v dveh libih NE smejo dati isti ID).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { todayStamp } from './csv-export'
import { zalogaPovzetekCasOznaka } from './zaloga-povzetek'

// ---------- barve (ISTI dokumenti družina — 0 novih hex) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const GREEN: [number, number, number] = [22, 163, 74] // roksal-green
const RED: [number, number, number] = [220, 38, 38] // zaloga-pdf R120 red
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

/** Client-safe prerez ENE veljavne ponudbe (podmnožica GET
 *  /api/material-prices → prices, include supplier). */
export interface PozicijaCenaVnos {
  /** ID artikla (ne-prazen — IDENTITETA joina, fail-closed). */
  inventoryId: string
  /** Veljavna cena (končno ne-negativna). */
  cena: number
  /** ID dobavitelja (ne-prazen — identiteta/izenačba). */
  dobaviteljId: string
  /** Naziv dobavitelja (ne-prazen — prikazna resnica). */
  dobavitelj: string
}

/** Client-safe prerez ENE bestPerMaterial vrstice (podmnožica ISTEGA
 *  odgovora — najnižja veljavna cena per artikel + št. ponudb). */
export interface PozicijaBestVnos {
  /** ID artikla (ne-prazen — IDENTITETA joina). */
  inventoryId: string
  /** Najnižja veljavna cena (končno ne-negativna). */
  bestPrice: number
  /** Št. veljavnih ponudb za artikel (končno ≥ 1 — 0 pomeni brez cene). */
  suppliers: number
}

export interface DobaviteljiPozicijaPdfOptions {
  /** Referenčni trenutek (žig + CreationDate + fileId + ime) — KOT
   *  PARAMETER (determinizem; vzorec R203/R244/R245/R262/R263). */
  now: Date
}

/** Fail-closed preverba ponudbe (indeks krivca VEDNO v sporočilu). */
export function preveriPozicijaCeno(c: PozicijaCenaVnos, i: number): void {
  if (!c || typeof c !== 'object') {
    throw new TypeError(`preveriPozicijaCeno (${i}): pričakovana ponudba (PozicijaCenaVnos)`)
  }
  for (const [k, v] of [
    ['inventoryId', c.inventoryId],
    ['dobaviteljId', c.dobaviteljId],
    ['dobavitelj', c.dobavitelj],
  ] as const) {
    if (typeof v !== 'string' || v.trim() === '') {
      throw new TypeError(`preveriPozicijaCeno (${i}): ${k} mora biti ne-prazen niz, ne ${String(v)}`)
    }
  }
  if (typeof c.cena !== 'number' || !Number.isFinite(c.cena) || c.cena < 0) {
    throw new TypeError(`preveriPozicijaCeno (${i}): cena mora biti končno ne-negativno število, ne ${String(c.cena)}`)
  }
}

/** Fail-closed preverba best vrstice (indeks krivca). */
export function preveriPozicijaBest(b: PozicijaBestVnos, i: number): void {
  if (!b || typeof b !== 'object') {
    throw new TypeError(`preveriPozicijaBest (${i}): pričakovana best vrstica (PozicijaBestVnos)`)
  }
  if (typeof b.inventoryId !== 'string' || b.inventoryId.trim() === '') {
    throw new TypeError(`preveriPozicijaBest (${i}): inventoryId mora biti ne-prazen niz, ne ${String(b.inventoryId)}`)
  }
  if (typeof b.bestPrice !== 'number' || !Number.isFinite(b.bestPrice) || b.bestPrice < 0) {
    throw new TypeError(`preveriPozicijaBest (${i}): bestPrice mora biti končno ne-negativno število, ne ${String(b.bestPrice)}`)
  }
  if (typeof b.suppliers !== 'number' || !Number.isFinite(b.suppliers) || b.suppliers < 1) {
    throw new TypeError(`preveriPozicijaBest (${i}): suppliers mora biti končno število ≥ 1, ne ${String(b.suppliers)}`)
  }
}

/** Determinističen file-ID (32 hex) — čista JS FNV-1a; LASTNI soli 0x8d–0x90. */
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
    fnv1aHex(seed, 0x8d) +
    fnv1aHex(seed, 0x8e) +
    fnv1aHex(seed, 0x8f) +
    fnv1aHex(seed, 0x90)
  )
}

/** Odstotek kot stabilen prikazni niz — 1 decimalna + vejica (ISTI niz
 *  KPI/tabela/sklep/toast; vzorec povprecjeNiz R252/pokritostNiz R263). */
function odstotekNiz(p: number): string {
  return p.toFixed(1).replace('.', ',')
}

/** Sklanjatev '1 ponudba / 2 ponudbi / 3-4 ponudbe / 5+ ponudb' — ENA resnica
 *  za toast (ISTI vzorec kot dobaviteljBeseda R248 — EN VIR sklanjatev). */
export function ponudbaBeseda(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError(
      `ponudbaBeseda: pričakovano ne-negativno celo število, ne ${String(n)}`,
    )
  }
  if (n === 1) return 'ponudba'
  if (n === 2) return 'ponudbi'
  if (n === 3 || n === 4) return 'ponudbe'
  return 'ponudb'
}

export interface DobaviteljPozicijaVrsta {
  /** ID dobavitelja (identiteta). */
  id: string
  /** Naziv dobavitelja. */
  ime: string
  /** Št. veljavnih ponudb dobavitelja. */
  ponudb: number
  /** Št. ponudb na najnižji vrednosti (cena === bestPrice). */
  najnizjih: number
  /** Št. ponudb nad najnižjo (cena > bestPrice). */
  visjih: number
  /** Σ razlika % / višjih — SAMO pri visjih > 0, sicer null ('—'). */
  povprecniOdstotek: number | null
  /** max razlika % čez VSE njegove vrstice (0 = vse najnižje — iskreno). */
  najsirosiRazpon: number
}

export interface DobaviteljiPozicijaPovzetek {
  /** Št. dobaviteljev z vsaj eno veljavno ponudbo (= vrstic). */
  dobaviteljev: number
  /** Št. veljavnih ponudb skupaj (= Σ ponudb). */
  ponudb: number
  /** Št. artiklov z vsaj eno veljavno ponudbo (= najboljse.length). */
  artiklov: number
  /** Št. artiklov z suppliers === 1 (ni primerjave — cenitveno tveganje). */
  brezAlternative: number
  /** Št. ponudb na najnižji vrednosti (čez vse dobavitelje). */
  najnizjihPozicij: number
  /** Št. ponudb nad najnižjo (čez vse dobavitelje). */
  visjihPozicij: number
  /** Št. best vrstic brez ujemajoče cene (pokvaren vir / race — poimenovano). */
  brezCeneN: number
}

/** Presek cen × najnižjih — ENA resnica za KPI, tabelo, sklep IN toast
 *  (WYSIWYG). JOIN po IDENTITETI inventoryId; min-invarianta (cena ≥
 *  bestPrice) fail-closed preverjena; fail-verbose preverba VSEH vnosov. */
export function dobaviteljiPozicijaCen(
  ceny: readonly PozicijaCenaVnos[],
  najboljse: readonly PozicijaBestVnos[],
): { vrste: DobaviteljPozicijaVrsta[]; povzetek: DobaviteljiPozicijaPovzetek } {
  if (!Array.isArray(ceny)) {
    throw new TypeError('dobaviteljiPozicijaCen: pričakovano polje cen (PozicijaCenaVnos[])')
  }
  if (!Array.isArray(najboljse)) {
    throw new TypeError('dobaviteljiPozicijaCen: pričakovano polje najboljših (PozicijaBestVnos[])')
  }
  if (ceny.length === 0) {
    throw new TypeError('dobaviteljiPozicijaCen: prazen seznam cen nima pozicij (fail-closed — komponenta pokaže iskren toast)')
  }
  ceny.forEach((c, i) => preveriPozicijaCeno(c, i))
  najboljse.forEach((b, i) => preveriPozicijaBest(b, i))

  // JOIN po IDENTITETI inventoryId — best cena per artikel.
  const best = new Map<string, number>()
  for (const b of najboljse) {
    if (!best.has(b.inventoryId)) best.set(b.inventoryId, b.bestPrice)
  }

  // Per dobavitelj agregat (identiteta = dobaviteljId).
  const poDobavitelju = new Map<string, { ime: string; ponudb: number; najnizjih: number; visjih: number; vsotaVisjih: number; najsirosi: number }>()
  let najnizjihPozicij = 0
  let visjihPozicij = 0
  ceny.forEach((c, i) => {
    const b = best.get(c.inventoryId)
    if (b === undefined) {
      throw new TypeError(`dobaviteljiPozicijaCen (${i}): ponudba brez ujemajoče best vrstice za artikel ${c.inventoryId} (NIKOLI izmišljena najnižja cena)`)
    }
    if (c.cena < b) {
      throw new TypeError(`dobaviteljiPozicijaCen (${i}): cena ${c.cena} < bestPrice ${b} za artikel ${c.inventoryId} — bestPrice je MIN po konstrukciji ISTEGA odgovora (pokvaren vir)`)
    }
    if (b === 0) {
      // bestPrice 0 (necena/placeholder — DB dovoljuje cena ≥ 0): razlika %
      // je NEDEFINIRANA — cena 0 → deljenje z nič, cena > 0 → Infinity.
      // Iskren fail-closed, NIKOLI izmišljen 0 %/100 %/Infinity (R263 vzorec).
      throw new TypeError(`dobaviteljiPozicijaCen (${i}): bestPrice 0 za artikel ${c.inventoryId} — razlika % ne obstaja (deljenje z nič, fail-closed)`)
    }
    const razlikaPct = ((c.cena - b) / b) * 100
    const g = poDobavitelju.get(c.dobaviteljId)
    const vrsta = g ?? { ime: c.dobavitelj.trim(), ponudb: 0, najnizjih: 0, visjih: 0, vsotaVisjih: 0, najsirosi: 0 }
    vrsta.ponudb += 1
    if (razlikaPct === 0) {
      vrsta.najnizjih += 1
      najnizjihPozicij += 1
    } else {
      vrsta.visjih += 1
      visjihPozicij += 1
      vrsta.vsotaVisjih += razlikaPct
    }
    if (razlikaPct > vrsta.najsirosi) vrsta.najsirosi = razlikaPct
    poDobavitelju.set(c.dobaviteljId, vrsta)
  })

  // Best vrstice brez ujemajoče cene (race / vlogsko zožen) — poimenovane.
  const znane = new Set(ceny.map((c) => c.inventoryId))
  let brezCeneN = 0
  for (const b of najboljse) {
    if (!znane.has(b.inventoryId)) brezCeneN += 1
  }

  const vrste: DobaviteljPozicijaVrsta[] = []
  for (const [id, g] of poDobavitelju) {
    vrste.push({
      id,
      ime: g.ime,
      ponudb: g.ponudb,
      najnizjih: g.najnizjih,
      visjih: g.visjih,
      povprecniOdstotek: g.visjih > 0 ? g.vsotaVisjih / g.visjih : null,
      najsirosiRazpon: g.najsirosi,
    })
  }
  sortirajDobaviteljePozicija(vrste)

  const brezAlternative = najboljse.filter((b) => b.suppliers === 1).length
  return {
    vrste,
    povzetek: {
      dobaviteljev: vrste.length,
      ponudb: ceny.length,
      artiklov: najboljse.length,
      brezAlternative,
      najnizjihPozicij,
      visjihPozicij,
      brezCeneN,
    },
  }
}

/** Sort V LIBU — IME ASC (navadno < po UTF-16 kodnih točkah — brez
 *  locale-odvisnega primerjanja), izenačba id ASC (identiteta).
 *  IZVOŽEN — determinizem = f(MNOŽICA vhodov). Referenčni pregled, NE
 *  rangiranje (rang po odstotku bi '—' vrstice lažno degradiral). */
export function sortirajDobaviteljePozicija(
  vrste: DobaviteljPozicijaVrsta[],
): DobaviteljPozicijaVrsta[] {
  return vrste.sort((a, b) => {
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

/** KPI polje — ISTI vzorec kot prihodki/narocila/zaloga-osnutek družina. */
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

/** Zgradi DOBAVITELJI — POZICIJA CEN dokument (brez shranjevanja) — vrne
 *  jsPDF instanco (testi berejo doc.output('arraybuffer') → bajtni dokazi). */
export function buildDobaviteljiPozicijaPdfDoc(
  ceny: readonly PozicijaCenaVnos[],
  najboljse: readonly PozicijaBestVnos[],
  options: DobaviteljiPozicijaPdfOptions,
): jsPDF {
  if (!Array.isArray(ceny) || !Array.isArray(najboljse)) {
    throw new TypeError('buildDobaviteljiPozicijaPdfDoc: pričakovani polji cen in najboljših')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildDobaviteljiPozicijaPdfDoc: pričakovane opcije (DobaviteljiPozicijaPdfOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildDobaviteljiPozicijaPdfDoc: pričakovan veljaven now: Date')
  }
  // PRAZEN SEZNAM cen ne nastaja dokumenta (družina: ni prazne datoteke —
  // komponenta pokaže iskren toast 'Ni vpisanih cen.').
  if (ceny.length === 0) {
    throw new TypeError(
      'buildDobaviteljiPozicijaPdfDoc: prazen seznam cen ne nastaja dokumenta — komponenta pokaže iskren toast (Ni vpisanih cen.)',
    )
  }
  const { vrste, povzetek } = dobaviteljiPozicijaCen(ceny, najboljse)

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / družina) ----------
  doc.setCreationDate(now)
  // Seed = f(MNOŽICA) — kanoniziran red (ceny: dobaviteljId/inventoryId/cena;
  // najboljse: inventoryId), NIKOLI vrstni red odgovora (R248/R262 vzorec).
  const kanonCene = [...ceny].sort((a, b) => {
    if (a.dobaviteljId !== b.dobaviteljId) return a.dobaviteljId < b.dobaviteljId ? -1 : 1
    if (a.inventoryId !== b.inventoryId) return a.inventoryId < b.inventoryId ? -1 : 1
    return a.cena - b.cena
  })
  const kanonBest = [...najboljse].sort((a, b) => {
    if (a.inventoryId !== b.inventoryId) return a.inventoryId < b.inventoryId ? -1 : 1
    return a.bestPrice - b.bestPrice
  })
  doc.setFileId(
    deterministichenId(
      `${now.toISOString()}|C:${kanonCene
        .map((c) => `${c.dobaviteljId}/${c.inventoryId}/${c.cena}`)
        .join(',')}|B:${kanonBest
        .map((b) => `${b.inventoryId}/${b.bestPrice}/${b.suppliers}`)
        .join(',')}`,
    ),
  )

  // ---------- glava (ISTI vzorec kot prihodki/narocila/zaloga-osnutek) ----------
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
  doc.text('DOBAVITELJI — POZICIJA CEN', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })

  // ---------- KPI 5 (signalni jezik: RED = brez alternative — ni primerjave;
  // GREEN = najnižje pozicije; AMBER = višje pozicije — normalno stanje) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Povzetek pozicij')
  const bw = 33
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Dobaviteljev', String(povzetek.dobaviteljev), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Ponudb', String(povzetek.ponudb), NAVY)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Brez alternative', String(povzetek.brezAlternative), povzetek.brezAlternative > 0 ? RED : NAVY)
  kpiBox(doc, 14 + 3 * (bw + gap), y, bw, bh, 'Najnižjih pozicij', String(povzetek.najnizjihPozicij), povzetek.najnizjihPozicij > 0 ? GREEN : NAVY)
  kpiBox(doc, 14 + 4 * (bw + gap), y, bw, bh, 'Višjih pozicij', String(povzetek.visjihPozicij), povzetek.visjihPozicij > 0 ? AMBER : NAVY)
  y += bh + 8

  // ---------- tabela dobaviteljev (IME ASC — referenčni red) ----------
  y = sectionTitle(doc, y, `Dobavitelji (${vrste.length})`)
  autoTable(doc, {
    startY: y,
    head: [['Dobavitelj', 'Ponudb', 'Najnižjih', 'Višjih', 'Povprečni odstopek (%)', 'Najširši razpon (%)']],
    body: vrste.map((v) => [
      v.ime,
      String(v.ponudb),
      String(v.najnizjih),
      String(v.visjih),
      v.povprecniOdstotek !== null ? odstotekNiz(v.povprecniOdstotek) : '—',
      odstotekNiz(v.najsirosiRazpon),
    ]),
    styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
    didParseCell: (data) => {
      // WYSIWYG: višje pozicije AMBER bold (normalno tržno stanje — prostor
      // za pogajanja, NI alarm); '—' sivo (vse najnižje — NI povprečja);
      // najširši razpon 0 % GREEN bold (celotna ponudba najnižja).
      if (data.section === 'body' && data.column.index === 4 && data.cell.raw !== '—') {
        data.cell.styles.textColor = AMBER
        data.cell.styles.fontStyle = 'bold'
      }
      if (data.section === 'body' && data.column.index === 5) {
        const v = Number(String(data.cell.raw ?? '').replace(',', '.'))
        if (Number.isFinite(v) && v === 0) {
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
    `${povzetek.dobaviteljev} dobaviteljev · ${povzetek.ponudb} veljavnih ponudb za ${povzetek.artiklov} artiklov · brez alternative ${povzetek.brezAlternative} (samo ena ponudba — ni primerjave) · najnižjih pozicij ${povzetek.najnizjihPozicij} · višjih ${povzetek.visjihPozicij} · povprečni odstopek = razlika % čez višje vrstice ('—' = vse najnižje) · najširši razpon = max razlika % čez vse vrstice · brez ujemajoče cene ${povzetek.brezCeneN} (poimenovano) · vir = /api/material-prices.`,
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

/** Ime datoteke — `Pozicija-dobaviteljev-YYYY-MM-DD.pdf` (družinski vzorec;
 *  deterministično glede na `now`; EN now za žig IN ime — lekcija R121/R235). */
export function dobaviteljiPozicijaPdfFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('dobaviteljiPozicijaPdfFilename: pričakovan veljaven now: Date')
  }
  return `Pozicija-dobaviteljev-${todayStamp(now)}.pdf`
}

/** Zgeneriraj DOBAVITELJI — POZICIJA CEN PDF (determinističen — enak vhod =
 *  bajtno enak dokument) in ga shrani. */
export function generateDobaviteljiPozicijaPdf(
  ceny: readonly PozicijaCenaVnos[],
  najboljse: readonly PozicijaBestVnos[],
  options: DobaviteljiPozicijaPdfOptions,
): void {
  const doc = buildDobaviteljiPozicijaPdfDoc(ceny, najboljse, options)
  doc.save(dobaviteljiPozicijaPdfFilename(options.now))
}
