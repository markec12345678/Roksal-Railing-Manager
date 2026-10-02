/**
 * R374 (issue #13, korak R165 iz §32/§2–§8/§16/§17) — deterministično jedro
 * verzij ponudb (QuoteVersion).
 * ---------------------------------------------------------------------------
 * Problem, ki ga to jedro zapira (issue #13 §2/§3/§7): deal-lock je sprejemal
 * KLIENTOV quoteData (items + seštevki) kot vir resnice — podpis se ni vezal
 * na nobeno strežniško izračunano, nespremenljivo verzijo ponudbe. Od R374
 * je EDINI vir resnice zaklepa QuoteVersion, izračunana NA STREŽNIKU iz
 * aktivne verzije cenika.
 *
 * Zasnova (isti vzorec kot equipment-lifecycle R145 — čisto jedro):
 *   • NIČ baze, NIČ ure, NIČ I/O — vsi vhodi so argumenti (determinizem:
 *     isti vhodi → bajtno isti izid, dokazljivo v testih);
 *   • statusni stroj DRAFT→ISSUED→APPROVED (+ DRAFT→REJECTED, supersede ob
 *     novi verziji) — ISSUED→APPROVED se zgodi SAMO ob uspešnem zaklepu s
 *     podpisom (deal-lock ruta; ta modul ne ve za podpise, samo za prehode);
 *   • computeQuoteVersion — STREŽNIŠKI izračun: klient NIKOLI ne pošlje denarja
 *     (postavk, cen, seštevkov) — samo geometrijo/specifikacijo; denar izide;
 *   • verifyQuoteVersionIntegrity — rekonstrukcija iz shranjenih vhodov +
 *     VEZANE knjige MORA dati iste postavke/seštevke/inputHash; vsako
 *     odstopanje je tampiranje → javna napaka ({ ok: false, detail });
 *   • plannedMargin — iz QuoteItem.sourceKey → referenceCost VEZANE knjige;
 *     MANJKA katerikoli relevantni referenceCost → NULL (iskreno NEZNANO —
 *     §8: nikoli več lažnega 0.6/0.15 modela);
 *   • bomDraftFromLines — BOM draft iz STRUKTURIRANIH postavk (sku = item.code,
 *     količina = item.qty) — nikoli več tekstovna hevristika 'vsebuje wpc' in
 *     ocena vijakov iz EUR (Math.ceil(skupaj/50)).
 *
 * Primerjava postavk v integriteti je kanonizirana (canonicalizeQuoteInputs
 * iz quote-repro.ts): JSONB v PostgreSQL NE ohranja vrstnega reda ključev
 * objektov, zato surovi JSON.stringify primerjak lažno ne bi uspel.
 */

import {
  layoutRailing,
  mergeSpec,
  perimeterOf,
  type DeepPartialSpec,
  type RailingSpec,
  type Vec3,
} from './railing-layout'
import { buildQuote, GROUP_LABEL, type BomGroup, type PriceBook, type QuoteItem } from './quote'
import { canonicalizeQuoteInputs, quoteInputFingerprint } from './quote-repro'

// ── Statusni stroj verzij ponudb (EN VIR) ───────────────────────────────────

export const QUOTE_VERSION_STATUSES = ['DRAFT', 'ISSUED', 'APPROVED', 'REJECTED', 'SUPERSEDED'] as const
export type QuoteVersionStatus = (typeof QUOTE_VERSION_STATUSES)[number]

/**
 * Dovoljeni prehodi statusa verzije ponudbe (§3 — immutable po izdaji):
 *
 *   DRAFT    → ISSUED (izda ga pisarna prek PATCH /api/quotes/[id]),
 *              REJECTED (zavrnitev osnutka),
 *              SUPERSEDED (nova verzija ponudbe nadomesti osnutek);
 *   ISSUED   → APPROVED (SAMO ob uspešnem zaklepu s podpisom — deal-lock
 *              ruta; ta modul prehod dovoli, pot pa imata podpisa),
 *              SUPERSEDED (nova verzija nadomesti IZDANO — sprememba po
 *              izdaji je NOVA verzija, nikoli tiha mutacija);
 *   APPROVED / REJECTED / SUPERSEDED → terminalno (prazno).
 */
export const QUOTE_VERSION_TRANSITIONS: Readonly<Record<QuoteVersionStatus, readonly QuoteVersionStatus[]>> = {
  DRAFT: ['ISSUED', 'REJECTED', 'SUPERSEDED'],
  ISSUED: ['APPROVED', 'SUPERSEDED'],
  APPROVED: [],
  REJECTED: [],
  SUPERSEDED: [],
}

export function allowedQuoteVersionTransitions(from: string): readonly QuoteVersionStatus[] {
  return QUOTE_VERSION_TRANSITIONS[from as QuoteVersionStatus] ?? []
}

export function checkQuoteVersionTransition(from: string, to: string): { ok: boolean; allowed: readonly QuoteVersionStatus[] } {
  const allowed = allowedQuoteVersionTransitions(from)
  return { ok: (allowed as readonly string[]).includes(to), allowed }
}

/**
 * Ali je verzija NESPREMENLJIVA (vse razen DRAFT)? Po §3 se po ISSUED ne sme
 * tiho spremeniti NIČ (količina, cena, popust, DDV, izdelek) — sprememba je
 * nova verzija. DRAFT je edini mutable status (urejanje osnutka).
 */
export function isImmutableQuoteVersion(status: string): boolean {
  return status !== 'DRAFT'
}

// ── Izračun verzije (strežniški vir denarja) ────────────────────────────────

/** Točka obsega v metrih — ista oblika kot perimeterPointSchema (validacije). */
export interface QuoteVersionPoint {
  xM: number
  yM?: number
  zM: number
}

/** VHODI izračuna verzije — točno to, kar se shrani v inputsJson. */
export interface QuoteVersionSpecInputs {
  /** Surove točke obsega (vrstni red ohranjen — del odtisa). */
  points: QuoteVersionPoint[]
  closed: boolean
  /** Popravki s trakom po indeksu roba (ključi so stringi po JSON round-trip). */
  overridesMm?: Record<string, number> | null
  /** DELNI specifikacijski override (DeepPartialSpec) — zlijemo z mergeSpec. */
  spec?: DeepPartialSpec | null
}

export interface ComputedQuoteVersion {
  /** Postavke (QuoteItem[] z sourceKey) —(linesJson). */
  lines: QuoteItem[]
  /** Neto brez DDV (buildQuote.netTotal) — po popustu. */
  subtotal: number
  /** DDV (buildQuote.vatAmount). */
  vat: number
  /** Skupaj z DDV (buildQuote.total). */
  total: number
  currency: string
  /** Prstni odtis UČINKOVITIH vhodov (quoteInputFingerprint, quote-v1). */
  inputHash: string
  /** Dolžina ograje v metrih (informacijsko — za UI/BOM). */
  runM: number
}

/**
 * Normalizacija točk — ISTA kot v /api/quote (yM ?? 0), da ima PREDogLED
 * (/api/quote) in URADNA verzija (/api/quotes) IDENTIČEN odtis istih vhodov.
 */
function normalizedPoints(points: QuoteVersionPoint[]): Array<{ xM: number; yM: number; zM: number }> {
  return points.map((p) => ({ xM: p.xM, yM: p.yM ?? 0, zM: p.zM }))
}

/**
 * STREŽNIŠKI izračun verzije ponudbe iz geometrije/specifikacije in VEZANE
 * knjige (PriceBook). Klient pošlje SAMO vhode — postavke, cene in seštevki
 * so IZHOD te funkcije (nikoli klientov vhod). Deterministično: isti vhodi +
 * ista knjiga → isti lines/subtotal/vat/total/inputHash.
 */
export function computeQuoteVersion(inputs: QuoteVersionSpecInputs, prices: PriceBook): ComputedQuoteVersion {
  const spec: RailingSpec = mergeSpec(inputs.spec ?? {})
  const vecs: Vec3[] = normalizedPoints(inputs.points).map((p) => ({ x: p.xM, y: p.yM, z: p.zM }))
  const overrides = (inputs.overridesMm ?? {}) as Record<number, number>
  const layout = layoutRailing(perimeterOf(vecs, inputs.closed, overrides), spec)
  const quote = buildQuote(layout, spec, prices)
  const repro = quoteInputFingerprint({
    points: normalizedPoints(inputs.points),
    closed: inputs.closed,
    overridesMm: inputs.overridesMm ?? {},
    spec,
    prices,
  })
  return {
    lines: quote.items,
    subtotal: quote.netTotal,
    vat: quote.vatAmount,
    total: quote.total,
    currency: prices.currency,
    inputHash: repro.inputHash,
    runM: quote.runM,
  }
}

// ── Integriteta shranjene verzije (§16 veriga) ─────────────────────────────

/** Jedro shranjene verzije, kot ga potrebuje preverba (brez baze). */
export interface StoredQuoteVersionCore {
  /** Parsiran inputsJson ({ points, closed, overridesMm, spec }). */
  inputsJson: unknown
  /** Parsiran linesJson (QuoteItem[]). */
  linesJson: unknown
  subtotal: number
  vat: number
  total: number
  currency: string
  inputHash: string
}

export type IntegrityVerdict = { ok: true } | { ok: false; detail: string }

/**
 * Rekonstrukcija iz shranjenih VHODOV + VEZANE knjige mora dati ISTE
 * postavke, seštevke in inputHash. Vsako odstopanje (tampirana vrstica,
 * spremenjen seštevek, druga knjiga, spremenjena formula) → { ok: false }
 * s podrobnostjo — klicatelj (deal-lock) javno odkloni (409), NIKOLI tiho.
 *
 * Denarne primerjake so EXACT po dogovoru money() (2 decimalki): shranjena
 * vrednost je nastala iz ISTE float vrednosti prek Decimal(12,2) → nazaj,
 * zato ni prostora za akumulacijo napake (dokazano v testih).
 */
export function verifyQuoteVersionIntegrity(stored: StoredQuoteVersionCore, boundPrices: PriceBook): IntegrityVerdict {
  const inputs = stored.inputsJson as Partial<QuoteVersionSpecInputs> | null
  if (typeof inputs !== 'object' || inputs === null || !Array.isArray(inputs.points)) {
    return { ok: false, detail: 'inputsJson nima veljavnega polja points — shranjena verzija je pokvarjena.' }
  }
  const recomputed = computeQuoteVersion(
    {
      points: inputs.points as QuoteVersionPoint[],
      closed: inputs.closed === true,
      overridesMm: (inputs.overridesMm ?? null) as Record<string, number> | null,
      spec: (inputs.spec ?? null) as DeepPartialSpec | null,
    },
    boundPrices,
  )
  if (recomputed.inputHash !== stored.inputHash) {
    return {
      ok: false,
      detail: `inputHash se ne ujema (shranjen ${stored.inputHash}, rekonstruiran ${recomputed.inputHash}) — vhodi ali vezana knjiga so se spremenili.`,
    }
  }
  if (recomputed.subtotal !== stored.subtotal || recomputed.vat !== stored.vat || recomputed.total !== stored.total) {
    return {
      ok: false,
      detail: `Seštevki se ne ujemajo (shranjeno ${stored.subtotal}/${stored.vat}/${stored.total}, rekonstruirano ${recomputed.subtotal}/${recomputed.vat}/${recomputed.total}).`,
    }
  }
  // Postavke: KANONIZIRANA primerjava — JSONB ne ohranja vrstnega reda ključev.
  const shranjene = canonicalizeQuoteInputs(stored.linesJson)
  const rekonstruirane = canonicalizeQuoteInputs(recomputed.lines)
  if (shranjene !== rekonstruirane) {
    return { ok: false, detail: 'Postavke se ne ujemajo s rekonstrukcijo iz shranjenih vhodov.' }
  }
  if (recomputed.currency !== stored.currency) {
    return { ok: false, detail: `Valuta se ne ujema (${stored.currency} vs ${recomputed.currency}).` }
  }
  return { ok: true }
}

// ── Načrtovana marža (§8 — iskrena, nikoli placeholder) ────────────────────

/** Vir stroška za ključ cenika (iz VEZANE knjige). */
export interface MarginSourceItem {
  salesPrice: number
  /** NULL = nabavna cena NEZNANA → celotna marža NEZNANA. */
  referenceCost: number | null
}

/**
 * Načrtovana marža verzije: vsota (prihodek − strošek) po postavkah, katerih
 * cena IZHODI iz cenika (QuoteItem.sourceKey). Pravila (§8, fail-closed):
 *   • MANJKA katerikoli relevantni referenceCost (null ali ključa ni v
 *     knjigi) → NULL — marža je iskreno NEZNANA, ne izmišljen odstotek;
 *   • postavke BREZ sourceKey (DROBNI — izpelani odstotek materiala) so
 *     IZRECNO izven: njihova nabavna cena ne živi v ceniku in bi njeno
 *     izmišljanje ponovilo lažni model, ki ga R374 briše;
 *   • rezultat je money()-zaokrožen (2 decimalki), kot vsak denar v ponudbi.
 */
export function plannedMargin(lines: QuoteItem[], source: ReadonlyMap<string, MarginSourceItem>): number | null {
  let revenue = 0
  let cost = 0
  for (const line of lines) {
    if (!line.sourceKey) continue
    const item = source.get(line.sourceKey)
    if (!item || item.referenceCost === null) return null
    revenue += line.total
    cost += line.qty * item.referenceCost
  }
  return Math.round((revenue - cost) * 100) / 100
}

// ── BOM draft iz strukturiranih postavk (§7) ───────────────────────────────

export interface BomDraftItem {
  /** Kategorija iz BomGroup (kanonična oznaka skupine postavke). */
  kategorija: string
  /** SKU = item.code (strukturiran identifikator, NE tekstovna hevristika). */
  sku: string
  naziv: string
  /** Količina = item.qty (iz LayoutResult — NE ocena iz EUR). */
  kolicina: number
  enota: string
  opomba?: string
  status: 'DRAFT'
}

export interface BomDraft {
  projectName: string
  generatedAt: string
  quoteTotal: number
  items: BomDraftItem[]
  status: 'DRAFT'
  notes: string
}

/**
 * BOM draft iz postavk VEZANE verzije ponudbe — 1:1 strukturna preslikava
 * (sku = code, količina = qty). Do R372 je ruta iz klientovega opisa ugibala
 * kategorijo ('vsebuje wpc' → WPC letve) in ocenjevala vijake iz zneska
 * (Math.ceil(skupaj/50)) — oboje izbrisano: vir je sedaj strežniška verzija.
 */
export function bomDraftFromLines(
  lines: QuoteItem[],
  projectName: string,
  quoteTotal: number,
  generatedAt: string,
): BomDraft {
  const items: BomDraftItem[] = lines.map((line) => ({
    kategorija: GROUP_LABEL[line.group as BomGroup] ?? line.group,
    sku: line.code,
    naziv: line.name,
    kolicina: line.qty,
    enota: line.unit,
    opomba: line.detail,
    status: 'DRAFT',
  }))
  return {
    projectName,
    generatedAt,
    quoteTotal,
    items,
    status: 'DRAFT',
    notes: 'BOM draft — avtomatsko generiran iz podpisane verzije ponudbe (R374 kanonična veriga). Ni naročilo.',
  }
}
