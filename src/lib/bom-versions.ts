/**
 * R376 (issue #13, korak R166 iz §5/§6/§11 + §7 vezava) — deterministično
 * jedro KANONIČNEGA BOM (BOMVersion/BOMLine).
 * ---------------------------------------------------------------------------
 * Problem, ki ga to jedro zapira (issue #13 §5/§6): do R374 je bil BOM samo
 * JSON polje na projektu (Project.bomDraftJson — R374 ga je sicer izračunal
 * iz STRUKTURIRANIH postavk verzije ponudbe, a brez verzij, brez actor/čas,
 * brez EXACT inventarne vezave). Od R376 je kanonični vir resnice BOMVersion
 * (NESPREMENLJIVA verzija nad nosilcem BOM — isti vzorec kot QuoteVersion
 * R374); bomDraftJson ostane SAMO kot legacy/read-model.
 *
 * Zasnova (isti vzorec kot quote-versions R374 — čisto jedro):
 *   • NIČ baze, NIČ ure, NIČ I/O — vsi vhodi so argumenti (determinizem:
 *     isti vhodi → bajtno iste VRSTICE, dokazljivo v testih; generatedAt se
 *     NAMENOMO ne zapiše v vrstice — čas verzije živi na BOMVersion.createdAt,
 *     ne na posamezni materialni vrstici);
 *   • statusni stroj DRAFT → APPROVED (+ supersede ob novi verziji) —
 *     APPROVED/SUPERSEDED sta terminalna; po odobritvi se BOM NE spreminja
 *     (sprememba = nova verzija / change order, nikoli tiha mutacija §6);
 *   • EXACT inventarna vezava (§5): Inventory.sifraMateriala === QuoteItem.code
 *     — BREZ fuzzy, BREZ includes(), BREZ normalizacije velikih črk;
 *     neujemana postavka ostane NEVEZANA (inventoryId = NULL, javni razlog v
 *     procurement pogledu §11);
 *   • HONEST NULLs (§8): wasteFactor/grossQuantity = NULL (neznani brez vira
 *     — nikoli izmišljeni odstotki); unitCost/totalCost = NULL, dokler
 *     VEZANA knjiga nima referenceCost za sourceKey postavke (nikoli več
 *     lažni 0.6/0.15 model);
 *   • količina = QuoteItem.qty iz LayoutResult (NIKOLI ocena iz EUR —
 *     Math.ceil(skupaj/50) hevristika R372 je mrtva).
 */

import { QUOTE_FORMULA_VERSION } from './quote-repro'
import { GROUP_LABEL, type QuoteItem } from './quote'

// ── Statusni stroj verzij BOM (EN VIR) ──────────────────────────────────────

export const BOM_VERSION_STATUSES = ['DRAFT', 'APPROVED', 'SUPERSEDED'] as const
export type BomVersionStatus = (typeof BOM_VERSION_STATUSES)[number]

/**
 * Dovoljeni prehodi statusa verzije BOM (§6 — immutable po odobritvi):
 *
 *   DRAFT     → APPROVED (PATCH /api/bom/[id] action=approve — odobritev je
 *               revizijsko sledena; ob zaklepu posla jo ustvari deal-lock
 *               TRANSAKCIJSKO neposredno v APPROVED),
 *               SUPERSEDED (nova verzija BOM nadomesti osnutek);
 *   APPROVED  → terminalno (§6: odobren BOM se NE spreminja — sprememba je
 *               nova verzija, ki PREJŠNJO postavi v SUPERSEDED);
 *   SUPERSEDED → terminalno.
 */
export const BOM_VERSION_TRANSITIONS: Readonly<Record<BomVersionStatus, readonly BomVersionStatus[]>> = {
  DRAFT: ['APPROVED', 'SUPERSEDED'],
  APPROVED: [],
  SUPERSEDED: [],
}

export function allowedBomVersionTransitions(from: string): readonly BomVersionStatus[] {
  return BOM_VERSION_TRANSITIONS[from as BomVersionStatus] ?? []
}

export function checkBomVersionTransition(from: string, to: string): { ok: boolean; allowed: readonly BomVersionStatus[] } {
  const allowed = allowedBomVersionTransitions(from)
  return { ok: (allowed as readonly string[]).includes(to), allowed }
}

/**
 * Ali je verzija BOM NESPREMENLJIVA (vse razen DRAFT)? Po §6 se po odobritvi
 * ne sme tiho spremeniti NIČ (količina, artikel, cena, vezava) — sprememba je
 * nova verzija. DRAFT je edini mutable status (delni osnutek za nabavo).
 */
export function isImmutableBomVersion(status: string): boolean {
  return status !== 'DRAFT'
}

// ── Kanonična generacija vrstic iz verzije ponudbe (§5) ─────────────────────

/** Jedro izvorne QuoteVersion, ki ga generacija potrebuje (brez baze). */
export interface BomVersionQuoteSource {
  /** Parsiran linesJson — postavke QuoteItem[] (prej ga validira integriteta). */
  linesJson: unknown
  /** Prstni odtis izračuna izvorne verzije (geometrijska sledljivost, §5). */
  inputHash: string
}

/** Postavka VEZANE knjige — vir referenceCost prek sourceKey (§8 honest NULL). */
export interface BomPriceSourceItem {
  key: string
  /** NULL = nabavna referenca NEZNANA → unitCost/totalCost ostane NULL. */
  referenceCost: number | null
}

/**
 * EXACT inventarna vezava (§5): sifraMateriala === QuoteItem.code. Nosilec
 * supplierId/supplierSku je ZADNJA MaterialPrice vezava artikla (ali NULL) —
 * baza danes NIMA dobaviteljske šifre artikla, zato supplierSku ostaja NULL
 * (iskreno NEZNANO, §8 — nikoli izumljena šifra).
 */
export interface BomInventoryBinding {
  id: string
  sifraMateriala: string
  supplierId: string | null
  supplierSku: string | null
}

/** Ena kanonična vrstica BOM (preslikava v BOMLine row; lineOrder = vrstni red). */
export interface BomVersionLineData {
  lineOrder: number
  /** Ključ postavke ponudbe — QuoteItem.sourceKey ?? code (direktna sled). */
  quoteLineKey: string | null
  /** Kanonični interni SKU = QuoteItem.code (strukturiran, NE hevristika). */
  internalSku: string
  supplierSku: string | null
  /** EXACT vezava na Inventory ali NULL (NEVEZANO — javni razlog v §11). */
  inventoryId: string | null
  /** Kategorija = BomGroup postavke (GLASS/…/LABOUR/OTHER). */
  category: string
  /** Zmrznjen opis `${name} — ${detail}` izvirne postavke. */
  descriptionSnapshot: string
  /** NETO količina = QuoteItem.qty (iz LayoutResult, NE ocena iz EUR). */
  quantity: number
  unit: string
  /** Odpadek NEZNAN brez vira — vedno NULL v tej rundi (§8). */
  wasteFactor: null
  /** Bruto količina izpeljiva šele ob znanem wasteFactorju — NULL (§8). */
  grossQuantity: null
  /** Nabavna referenca VEZANE knjige prek sourceKey — NULL = NEZNANO (§8). */
  unitCost: number | null
  /** unitCost × quantity (2 decimalki) — SAMO kadar je unitCost znan. */
  totalCost: number | null
  /** Dobavitelj iz EXACT inventarne vezave ali NULL. */
  supplierId: string | null
  /** Besedilni snapshot sledi: quoteLineKey + odtis izvorne verzije. */
  geometrySource: string
  /** Verzija izračunskega pravila = QUOTE_FORMULA_VERSION ('quote-v1'). */
  calculationRuleVersion: string
  /** AKTIVEN (PREKINJAN je rezerviran za change-order — te runde še ni). */
  status: string
}

/** Izračunana verzija BOM (čisti izhod — brez baze, brez ure v vrsticah). */
export interface ComputedBomVersion {
  /** Odmev argumenta (R294 F4: stena ure živi v ruti; vrstice je NE nosijo). */
  generatedAt: string
  /** Snapshot verzije izračuna = QUOTE_FORMULA_VERSION. */
  productSdkVersion: string
  /** Odtis geometrije/izračuna = inputHash izvorne verzije ponudbe (§5). */
  layoutFingerprint: string
  /** Vrstice — deterministične (vrstni red = lineOrder). */
  lines: BomVersionLineData[]
}

/** Fail-closed napaka generacije (pokvarjen linesJson — javna, ne tiha). */
export class BomGenerationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BomGenerationError'
  }
}

/** Ozka validacija postavke iz linesJson (fail-closed — brez izumljanja polj). */
function preveriPostavko(raw: unknown, i: number): QuoteItem {
  if (typeof raw !== 'object' || raw === null) {
    throw new BomGenerationError(`Postavka BOM #${i + 1} ni objekt — linesJson verzije ponudbe je pokvarjen.`)
  }
  const it = raw as Partial<QuoteItem>
  if (typeof it.code !== 'string' || it.code.length === 0) {
    throw new BomGenerationError(`Postavka BOM #${i + 1} nima kanonskega code (internalSku) — linesJson je pokvarjen.`)
  }
  if (typeof it.group !== 'string' || it.group.length === 0) {
    throw new BomGenerationError(`Postavka BOM #${i + 1} nima kategorije (group) — linesJson je pokvarjen.`)
  }
  // Kategorija MORA biti kanonski BomGroup (CHECK v DB bi sicer zavrnil zapis
  // z 500 — fail-closed raje JAVNO prej, z imenom vrstice).
  if (!(it.group in GROUP_LABEL)) {
    throw new BomGenerationError(
      `Postavka BOM #${i + 1} ima nekanonsko kategorijo '${it.group}' (dovoljeno: ${Object.keys(GROUP_LABEL).join('/')}).`,
    )
  }
  if (typeof it.name !== 'string') {
    throw new BomGenerationError(`Postavka BOM #${i + 1} nima naziva (name) — linesJson je pokvarjen.`)
  }
  if (typeof it.detail !== 'string') {
    throw new BomGenerationError(`Postavka BOM #${i + 1} nima podrobnosti (detail) — linesJson je pokvarjen.`)
  }
  if (typeof it.qty !== 'number' || !Number.isFinite(it.qty) || it.qty <= 0) {
    throw new BomGenerationError(`Postavka BOM #${i + 1} ima neveljavno količino (${String(it.qty)}) — linesJson je pokvarjen.`)
  }
  if (typeof it.unit !== 'string' || it.unit.length === 0) {
    throw new BomGenerationError(`Postavka BOM #${i + 1} nima enote — linesJson je pokvarjen.`)
  }
  return it as QuoteItem
}

/**
 * KANONIČNA generacija vrstic BOM iz verzije ponudbe (§5/§6):
 *
 *   internalSku   = item.code            (strukturna identiteta);
 *   category      = item.group           (BomGroup — CHECK v DB);
 *   quantity      = item.qty             (iz LayoutResult — NE iz EUR);
 *   quoteLineKey  = item.sourceKey ?? item.code (direktna sled na postavko);
 *   unitCost      = referenceCost VEZANE knjige prek sourceKey — NULL = NEZNANO;
 *   totalCost     = unitCost × quantity  — SAMO kadar unitCost obstaja;
 *   wasteFactor   = NULL, grossQuantity = NULL (iskreno NEZNANO, §8);
 *   inventoryId   = EXACT sifraMateriala === item.code (brez fuzzy!) sicer NULL;
 *   supplierId    = zadnja MaterialPrice vezava vezanega artikla sicer NULL;
 *   supplierSku   = NULL (vir v bazi še ne obstaja — §8);
 *   geometrySource= `sourceKey=<k>;layout=<inputHash>` (sledljivost §5);
 *   calculationRuleVersion = QUOTE_FORMULA_VERSION ('quote-v1').
 *
 * Determinizem: isti vhodi → BAJTNO identične vrstice (vrstni red = lineOrder,
 * generatedAt se NE zapiše v vrstice). Fail-closed: pokvarjen linesJson →
 * BomGenerationError (nikoli tiho preskočena postavka, nikoli izumljeno polje).
 */
export function bomVersionFromQuoteVersion(
  quoteVersion: BomVersionQuoteSource,
  priceBookItems: readonly BomPriceSourceItem[],
  inventoryItems: readonly BomInventoryBinding[],
  generatedAt: string,
): ComputedBomVersion {
  if (!Array.isArray(quoteVersion.linesJson)) {
    throw new BomGenerationError('linesJson verzije ponudbe ni polje — BOM ni mogoče generirati.')
  }
  // EXACT preslikava sifraMateriala → vezava (sifraMateriala je UNIQUE v DB).
  const poSifri = new Map(inventoryItems.map((inv) => [inv.sifraMateriala, inv]))
  // Preslikava sourceKey → referenceCost VEZANE knjige (ključ je UNIQUE/knjigo).
  const stroski = new Map(priceBookItems.map((i) => [i.key, i.referenceCost]))

  const lines: BomVersionLineData[] = quoteVersion.linesJson.map((raw, i) => {
    const item = preveriPostavko(raw, i)
    const quoteLineKey = typeof item.sourceKey === 'string' && item.sourceKey.length > 0 ? item.sourceKey : item.code
    // EXACT ujemanje — NIKOLI includes()/toLowerCase()/levenshein:
    const vezava = poSifri.get(item.code) ?? null
    // referenceCost prek sourceKey; BREZ sourceKey (izpeljane postavke) = NULL
    // (nabavna cena ne živi v knjigi — izmišljanje bi ponovilo lažni model).
    const unitCost = typeof item.sourceKey === 'string' ? (stroski.get(item.sourceKey) ?? null) : null
    const totalCost = unitCost !== null ? Math.round(unitCost * item.qty * 100) / 100 : null
    return {
      lineOrder: i + 1,
      quoteLineKey,
      internalSku: item.code,
      supplierSku: vezava !== null ? vezava.supplierSku : null,
      inventoryId: vezava !== null ? vezava.id : null,
      category: item.group,
      descriptionSnapshot: `${item.name} — ${item.detail}`,
      quantity: item.qty,
      unit: item.unit,
      wasteFactor: null,
      grossQuantity: null,
      unitCost,
      totalCost,
      supplierId: vezava !== null ? vezava.supplierId : null,
      geometrySource: `sourceKey=${quoteLineKey};layout=${quoteVersion.inputHash}`,
      calculationRuleVersion: QUOTE_FORMULA_VERSION,
      status: 'AKTIVEN',
    }
  })

  return {
    generatedAt,
    productSdkVersion: QUOTE_FORMULA_VERSION,
    layoutFingerprint: quoteVersion.inputHash,
    lines,
  }
}
