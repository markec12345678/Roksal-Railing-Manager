/**
 * R151 (issue #5 §35 — Quote/document reproducibility): reprodukcija
 * ponudb — deterministični prstni odtis učinkovitih vhodov.
 *
 * Problem, ki ga ta plast zapira: POST /api/quote je izračunal ponudbo iz
 * klientovih točk + specifikacije + cenika, odgovor pa NOSIL NIČESAR o tem,
 * kateri učinkoviti vhodi so dali skupaj. Če se privzeti cenik ali logika
 * združevanja specifikacije spremeni, isti zahtevek da drug total BREZ
 * sledi, zakaj. Dokumenti to že imajo (sha256 + verzije, R121) — ponudbe
 * niso.
 *
 * Pravila (isti vzorec kot calc-engineering R150):
 *   • QUOTE_FORMULA_VERSION ('quote-v1') — sprememba matematike ponudbe
 *     (lib/quote.ts ali railing-layout.ts) = nova verzija; obstoječi odtisi
 *     ostanejo interpretirani s svojo verzijo.
 *   • ODTIS je računan nad UČINKOVITIMI vhodi (združena specifikacija +
 *     združen cenik — tisto, kar je DEJANSKO dalo rezultat), ne nad surovo
 *     zahtevo. Reprodukcija: isti odtis + ista verzija = ISTI total.
 *   • Kanonizacija je rekurzivna (točke so polje objektov!): ključi
 *     urejeni po abecedi, števila normalizirana na 4 decimalki, vrstni red
 *     polj OHRANJEN (točke obsega so po vrsti — zamenjava vrstnega reda
 *     točk je drugačna ograja), ne-končne vrednosti vidno označene.
 *   • Čisto jedro: ni baze, ni ure, ni I/O. lib/quote.ts in
 *     railing-layout.ts (cenik/geometry jedro) ostajata NESPREMINJANA.
 */

export const QUOTE_FORMULA_VERSION = 'quote-v1'

/** Rekurzivna kanonizacija vrednosti — deterministična za isti logični vhod. */
function canonicalizeValue(v: unknown): string {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return `n${String(v)}`
    if (Number.isInteger(v)) return `n${v.toFixed(0)}`
    return `n${v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '.0')}`
  }
  if (typeof v === 'string') return `s${v}`
  if (typeof v === 'boolean') return `b${v}`
  if (Array.isArray(v)) return `[${v.map(canonicalizeValue).join(',')}]`
  if (typeof v === 'object') {
    const keys = Object.keys(v as Record<string, unknown>).sort()
    return `{${keys
      .map((k) => `${k}:${canonicalizeValue((v as Record<string, unknown>)[k])}`)
      .join(',')}}`
  }
  return `?${String(v)}`
}

/**
 * Rekurzivna kanonizacija vhodov ponudbe: ključi objektov UREJENO po
 * abecedi, vrstni red polj OHRANJEN (točke obsega so po vrsti okoli
 * objekta — ista množica točk v drugem vrstnem redu je drugačna ograja in
 * MORA dobiti drug odtis).
 */
export function canonicalizeQuoteInputs(input: unknown): string {
  return canonicalizeValue(input)
}

export interface QuoteReproInputs {
  /** Surove točke obsega (vrstni red ohranjen — del odtisa). */
  points: unknown
  closed: boolean
  /** Predelave mm (objekt — ključi urejeni v kanonizaciji). */
  overridesMm: unknown
  /** UČINKOVITA specifikacija (po mergeSpec — ne surovi override). */
  spec: unknown
  /** UČINKOVIT cenik (po mergePriceBook — ne surovi override). */
  prices: unknown
}

/**
 * Prstni odtis učinkovitih vhodov ponudbe: hash vključuje verzijo formule
 * — odtis je vedno vezan na formulo, ki je izračunala total. Isti učinkoviti
 * vhod + ista verzija = ISTI odtis (in po pogodbi isti total).
 */
export function quoteInputFingerprint(input: QuoteReproInputs): {
  quoteVersion: string
  inputHash: string
} {
  const canonical = `quote#${QUOTE_FORMULA_VERSION}#${canonicalizeQuoteInputs({
    points: input.points,
    closed: input.closed,
    overridesMm: input.overridesMm,
    spec: input.spec,
    prices: input.prices,
  })}`
  return { quoteVersion: QUOTE_FORMULA_VERSION, inputHash: fnv1a32Hex(canonical) }
}

/**
 * FNV-1a 32-bit — čista, odvisnost-brez implementacija (isti algoritem kot
 * calc-engineering R150; ločena kopija, da jedri ostajata neodvisna).
 * Znana vrednost: fnv1a32Hex('') = '811c9dc5'.
 */
export function fnv1a32Hex(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}
