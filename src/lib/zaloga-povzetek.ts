// ---------------------------------------------------------------------------
// R204 — naročilnica zaloge za odložišče (naročanje pri dobavitelju prek
// e-pošte/SMS/WhatsApp) — vzorec meritve-povzetek (R203) /
// buildTerminShareText (R167): čisto client-safe jedro, fail-closed,
// deterministično (referenčni trenutek pride KOT parameter).
// ---------------------------------------------------------------------------
// Motiv: gumb 'Naroči' na artiklih pod minimumom je do zdaj POKAZAL IZMIŠLJEN
// uspeh — toast 'Naročilo bo poslano dobavitelju.' čeprav NIČ ni bilo poslano
// (integracije z dobaviteljem ni). To je laž v UI (kršitev 'ni izmišljenih
// podatkov'). R204: pravi uporabni izhod namesto izmišljenega — naročilnica
// kot besedilo v odložišču, ki jo monter/pisarna SAM prilepi v e-pošto/SMS/
// WhatsApp. Aplikacija trdi LE to, kar je res: 'kopirana v odložišče', ne
// 'poslano'.
//
// Načela:
//  • Brez izmišljenih podatkov: v naročilnici so SAMO resnična polja (šifra,
//    naziv, enota, zaloga, min. zaloga). CEN NI — cenaEur je pogosto null,
//    UI-jeva ocena vrednosti po tipu je izrecno 'demo' približek; ocenjene
//    cene NE smejo priti v dokument za dobavitelja.
//  • EN VIR RESNICE za priporočeno količino: ISTA formula, ki jo je do zdaj
//    pokazal UI (handleReorder): Math.max(min − zaloga, min). Ni nove logike
//    — naročilnica pove TOČNO to, kar je do zdaj povedal toast, le da je zdaj
//    raznosljiva (prilepimo jo lahko res dobavitelju).
//  • Fail-closed: količine so FIZIČNE vrednosti — pokvaren vnos → TypeError
//    (NIKOLI tihega izmišljenega besedila; polpdatki ne gredo v dokument za
//    dobavitelja). Artikel NAD minimumom → TypeError (dokument trdi 'pod
//    minimumom' — jedro tega NIKOLI ne laže; komponenta posreduje le isLow
//    artikle, jedro je samozaščitno).
//  • Determinizem: `now` pride KOT parameter — jedro ne bere ure; časovni
//    žig = sl-SI Intl z izrecnimi opcijami (isti vzorec R167/R203 — človeška
//    oblika, ne arhiv).

/** Najmanjši potrebni prerez artikla inventarja za naročilnico (podmnožica
 *  InventoryItem iz inventory-tab — client-safe, brez uvozov).
 *
 *  R227 (P1-c nadaljevanje) — DESETI signalec konvergence: opcijski
 *  `_count` (ISTI prerez kot /api/inventory odgovor od R221) nosi
 *  nabavno pripravljenost per postavka — vrstica naročilnice z
 *  `_count.prices === 0` (DOBESLEDNO; manjkajoči števec NIKOLI ni
 *  'brez' — fail-closed, brez ?? 0 / <= 0) dobi v besedilnem dokumentu
 *  oznako '— brez vpisane nabavne cene' (ISKRENOST: pisarna in
 *  dobavitelj vidita, da aplikacija postavke ne more oceniti — cena ni
 *  izmišljena niti v besedilu). Producers brez polja (starejši hint,
 *  sekanc med deployema) = brez oznake — NIKOLI lažnega žiga. */
export interface ZalogaArtikelZaNarocilo {
  id: string
  sifraMateriala: string
  naziv: string
  kolicinaZaloga: number
  enota: string
  minimalnaZaloga: number
  _count?: { prices?: number }
}

export interface ZalogaPovzetekOptions {
  /** Referenčni trenutek za žig 'osveženo …' — KOT PARAMETER
   *  (determinizem, vzorec termini-prikaz/meritve-csv/meritve-povzetek). */
  now: Date
  /** Opcijska oznaka aktivnega filtra (npr. 'WPC') — LE če filter dejansko
   *  aktiven; 'Vse'/null → brez omembe (brez izmišljenega konteksta). */
  kategorija?: string | null
}

/** Skupna fail-closed preverba (količine so fizične vrednosti; naročilnica
 *  pokriva LE artikle pod minimumom — sicer bi dokument lažal). */
function preveriArtikel(a: ZalogaArtikelZaNarocilo): void {
  if (!a || typeof a !== 'object') {
    throw new TypeError('preveriArtikel: pričakovan artikel (ZalogaArtikelZaNarocilo)')
  }
  if (typeof a.id !== 'string' || a.id.trim() === '') {
    throw new TypeError('preveriArtikel: artikel mora imeti ne-prazen id')
  }
  if (typeof a.naziv !== 'string' || a.naziv.trim() === '') {
    throw new TypeError(`preveriArtikel (${a.id}): artikel mora imeti ne-prazen naziv`)
  }
  if (typeof a.sifraMateriala !== 'string' || a.sifraMateriala.trim() === '') {
    throw new TypeError(`preveriArtikel (${a.id}): artikel mora imeti ne-prazno šifro materiala`)
  }
  if (typeof a.enota !== 'string' || a.enota.trim() === '') {
    throw new TypeError(`preveriArtikel (${a.id}): artikel mora imeti ne-prazno enoto`)
  }
  for (const k of ['kolicinaZaloga', 'minimalnaZaloga'] as const) {
    const v = a[k]
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new TypeError(
        `preveriArtikel (${a.id}): ${k} mora biti ne-negativno končno število, ne ${String(v)}`,
      )
    }
  }
  if (a.kolicinaZaloga > a.minimalnaZaloga) {
    throw new TypeError(
      `preveriArtikel (${a.id}): artikel je NAD minimalno zalogo (${a.kolicinaZaloga} > ${a.minimalnaZaloga}) — naročilnica pokriva le artikle pod minimumom`,
    )
  }
}

/** Priporočena naročila količina — EN VIR RESNICE z obstoječim UI (prej
 *  handleReorder): deficit do minimuma, a vsaj celoten minimum. */
export function narociloKolicina(a: ZalogaArtikelZaNarocilo): number {
  preveriArtikel(a)
  return Math.max(a.minimalnaZaloga - a.kolicinaZaloga, a.minimalnaZaloga)
}

/** Slovenska sklanjatev besede 'artikel' za števec (1 artikel, 2 artikla,
 *  3/4 artikli, 5+ artiklov) — vzorec meritvePovzetekBeseda (R203). */
export function zalogaPovzetekBeseda(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError(
      `zalogaPovzetekBeseda: pričakovano ne-negativno celo število, ne ${String(n)}`,
    )
  }
  if (n === 1) return 'artikel'
  if (n === 2) return 'artikla'
  if (n === 3 || n === 4) return 'artikli'
  return 'artiklov'
}

/** Časovni žig '27. 09. 2026 ob 14:05' — sl-SI Intl z izrecnimi opcijami
 *  (isti vzorec kot meritvePovzetekCasOznaka R203). Pokvaren now → TypeError. */
export function zalogaPovzetekCasOznaka(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('zalogaPovzetekCasOznaka: pričakovan veljaven now: Date')
  }
  const datum = now.toLocaleDateString('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const ura = now.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
  return `${datum} ob ${ura}`
}

/** Besedilna naročilnica VIDNIH artiklov pod minimumom (za dobavitelja).
 *
 *  Struktura:
 *    Naročilnica — Zaloga pod minimumom
 *    {n} {artikel/artikla/artikli/artiklov} · osveženo {datum} ob {ura}[ · filter: {kategorija}]
 *
 *    1. {naziv} ({šifra}): naroči {k} {enota} (zaloga {z} / min. {m})[ — brez vpisane nabavne cene]
 *    …
 *
 *  R227 — oznaka '— brez vpisane nabavne cene' po vrstici prideta LE pri
 *  `_count?.prices === 0` (dobesledno; ISTA strogost kot čip R221 /
 *  zvonček R222 / Domov R223 / vodja R224 / vrstica R225 / CSV R226 —
 *  deseti signalec istega jezika). Manjkajoči/pokvaren števec = brez
 *  oznake (fail-closed). Naročilnica CSV (narocilnicaCsvVrstice) ostaja
 *  NESPREMENJENA — dobaviteljska priloga ostane čista; notranji Zaloga
 *  CSV že nosi stolpec od R226.
 *
 *  Fail-closed: pokvaren vnos ALI artikel nad minimumom → TypeError.
 *  Prazen seznam je VELJAVEN (iskreno 'Ni artiklov za naročilo.'). */
export function buildZalogaPovzetek(
  artikli: readonly ZalogaArtikelZaNarocilo[],
  options: ZalogaPovzetekOptions,
): string {
  if (!Array.isArray(artikli)) {
    throw new TypeError(
      'buildZalogaPovzetek: pričakovano polje artiklov (ZalogaArtikelZaNarocilo[])',
    )
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildZalogaPovzetek: pričakovane opcije (ZalogaPovzetekOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildZalogaPovzetek: pričakovan veljaven now: Date')
  }
  artikli.forEach((a) => preveriArtikel(a))

  const vrstice: string[] = []
  vrstice.push('Naročilnica — Zaloga pod minimumom')
  const kategorija =
    typeof options.kategorija === 'string' && options.kategorija.trim() !== ''
      ? options.kategorija.trim()
      : null
  vrstice.push(
    `${artikli.length} ${zalogaPovzetekBeseda(artikli.length)} · osveženo ${zalogaPovzetekCasOznaka(now)}${kategorija ? ` · filter: ${kategorija}` : ''}`,
  )
  vrstice.push('')

  if (artikli.length === 0) {
    vrstice.push('Ni artiklov za naročilo.')
    return vrstice.join('\n')
  }

  artikli.forEach((a, i) => {
    // R227 — deseti signalec: oznaka per vrstica LE pri dobeslednem
    // `_count?.prices === 0` (nabavna pripravljenost — naročilni tok
    // postavke ne more oceniti; iskreno v dokumentu za dobavitelja,
    // ne le v UI). Vse ostale vrednosti (vključno z manjkajočim
    // števcem) = brez oznake — NIKOLI lažnega žiga.
    const brezCene = a._count?.prices === 0
    vrstice.push(
      `${i + 1}. ${a.naziv.trim()} (${a.sifraMateriala.trim()}): naroči ${narociloKolicina(a)} ${a.enota.trim()} (zaloga ${a.kolicinaZaloga} / min. ${a.minimalnaZaloga})${brezCene ? ' — brez vpisane nabavne cene' : ''}`,
    )
  })

  return vrstice.join('\n')
}

// ---------------------------------------------------------------------------
// R205 F2 — CSV vrstice naročilnice (priloga za dobavitelja; ista vsebina kot
// besedilna naročilnica R204, le v tabelarni obliki za Excel/e-pošto).
// EN VIR RESNICE: količina = narociloKolicina (ISTA formula kot odložišče).
// BREZ CEN: ista pravila kot R204 — cenaEur je pogosto null, UI-jeva ocena po
// tipu je izrecno 'demo' približek; ocenjene vrednosti NE smejo v dokument za
// dobavitelja. (Stvarne cene vnese strežnik iz realnih MaterialPrice zapisov,
// če obstajajo — glej POST /api/material-orders.)
// ---------------------------------------------------------------------------

/** CSV vrstice (BREZ glave — glavo poda klicatelj prek downloadCsv) za vidne
 *  artikle pod minimumom:
 *    [šifra, naziv, enota, zaloga, min. zaloga, naroči]
 *  Števila gredo kot number (csvField: decimalna vejica, SI Excel).
 *  Fail-closed: pokvaren vnos ALI artikel nad minimumom → TypeError (narociloKolicina
 *  poganja isto preverbo kot buildZalogaPovzetek). Prazen seznam → prazne vrstice. */
export function narocilnicaCsvVrstice(
  artikli: readonly ZalogaArtikelZaNarocilo[],
): Array<[string, string, string, number, number, number]> {
  if (!Array.isArray(artikli)) {
    throw new TypeError(
      'narocilnicaCsvVrstice: pričakovano polje artiklov (ZalogaArtikelZaNarocilo[])',
    )
  }
  return artikli.map((a) => {
    const kolicina = narociloKolicina(a)
    return [
      a.sifraMateriala.trim(),
      a.naziv.trim(),
      a.enota.trim(),
      a.kolicinaZaloga,
      a.minimalnaZaloga,
      kolicina,
    ] as [string, string, string, number, number, number]
  })
}

// ---------------------------------------------------------------------------
// R206 F2 — naročilnica IZ SLEDLJIVEGA naročila (Material → Naročila): isti
// dokument kot R204, le da izvira iz realnih postavk naročila (MaterialOrder)
// — regeneracija pozneje (npr. ob označevanju prehoda POSLANO ali ponovnem
// prigotavljanju dokumenta). ENA družina dokumentov: odložišče (R204), CSV
// priloga (R205), regeneracija iz naročila (R206).
// ---------------------------------------------------------------------------

/** Client-safe prerez naročila za regeneracijo dokumenta (podmnožica
 *  MaterialOrder iz material-intelligence-tab — brez uvozov). */
export interface NarociloZaDokument {
  supplier: { naziv: string }
  items: ReadonlyArray<{ naziv: string; kolicina: number; enota: string }>
  opombe?: string | null
}

/** Sklanjatev besede 'postavka' (1 postavka, 2 postavki, 3/4 postavke,
 *  5+ postavk) — vzorec zalogaPovzetekBeseda. */
export function narociloPostavkaBeseda(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError(
      `narociloPostavkaBeseda: pričakovano ne-negativno celo število, ne ${String(n)}`,
    )
  }
  if (n === 1) return 'postavka'
  if (n === 2) return 'postavki'
  if (n === 3 || n === 4) return 'postavke'
  return 'postavk'
}

function preveriPostavko(
  p: NarociloZaDokument['items'][number],
  i: number,
): void {
  if (!p || typeof p !== 'object') {
    throw new TypeError(`preveriPostavko (${i}): pričakovana postavka (naziv/količina/enota)`)
  }
  if (typeof p.naziv !== 'string' || p.naziv.trim() === '') {
    throw new TypeError(`preveriPostavko (${i}): postavka mora imeti ne-prazen naziv`)
  }
  if (typeof p.enota !== 'string' || p.enota.trim() === '') {
    throw new TypeError(`preveriPostavko (${i}): postavka mora imeti ne-prazno enoto`)
  }
  if (typeof p.kolicina !== 'number' || !Number.isFinite(p.kolicina) || p.kolicina <= 0) {
    throw new TypeError(
      `preveriPostavko (${i}): količina mora biti pozitivno končno število, ne ${String(p.kolicina)}`,
    )
  }
}

/** Besedilna naročilnica iz SLEDLJIVEGA naročila (za dobavitelja).
 *
 *  Struktura:
 *    Naročilnica — {dobavitelj}
 *    {n} {postavka/postavki/postavke/postavk} · osveženo {datum} ob {ura}
 *
 *    1. {naziv}: {količina} {enota}
 *    …
 *    [Opomba: {opombe}]
 *
 *  BREZ VREDNOSTI IZ UI (družinsko pravilo R204): postavke naročila nosijo
 *  vrednost, a manjkajoče (0) in realne se bi v skupnem dokumentu ZMEŠALE —
 *  vrednosti ostanejo v aplikaciji (Material → Naročila), dokument nosi le
 *  količine. Fail-closed: prazen dobavitelj, naročilo BREZ postavk (strežnik
 *  zahteva ≥1 — prazno bi pomenilo pokvarene podatke) ALI pokvarena postavka
 *  → TypeError. Determinizem: `now` pride KOT parameter. */
export function buildNarocilnicaIzNarocila(
  order: NarociloZaDokument,
  options: { now: Date },
): string {
  if (!order || typeof order !== 'object') {
    throw new TypeError('buildNarocilnicaIzNarocila: pričakovano naročilo (NarociloZaDokument)')
  }
  if (
    !options ||
    typeof options !== 'object' ||
    !(options.now instanceof Date) ||
    Number.isNaN(options.now.getTime())
  ) {
    throw new TypeError('buildNarocilnicaIzNarocila: pričakovan veljaven now: Date')
  }
  const dobavitelj =
    typeof order.supplier?.naziv === 'string' ? order.supplier.naziv.trim() : ''
  if (dobavitelj === '') {
    throw new TypeError('buildNarocilnicaIzNarocila: naročilo mora imeti ne-praznega dobavitelja')
  }
  if (!Array.isArray(order.items) || order.items.length === 0) {
    throw new TypeError(
      'buildNarocilnicaIzNarocila: naročilo brez postavk (strežnik zahteva ≥1) — dokument ne sme nastajati iz praznine',
    )
  }
  order.items.forEach((p, i) => preveriPostavko(p, i))

  const vrstice: string[] = []
  vrstice.push(`Naročilnica — ${dobavitelj}`)
  vrstice.push(
    `${order.items.length} ${narociloPostavkaBeseda(order.items.length)} · osveženo ${zalogaPovzetekCasOznaka(options.now)}`,
  )
  vrstice.push('')
  order.items.forEach((p, i) => {
    vrstice.push(`${i + 1}. ${p.naziv.trim()}: ${p.kolicina} ${p.enota.trim()}`)
  })
  const opombe = typeof order.opombe === 'string' ? order.opombe.trim() : ''
  if (opombe !== '') {
    vrstice.push('')
    vrstice.push(`Opomba: ${opombe}`)
  }
  return vrstice.join('\n')
}
