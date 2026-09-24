/**
 * PRODUCT SDK — PRAVILA (runda S+8.1 §2–§5, §11, §13).
 *
 * EN KRAJ za vsa konstrukcijska pravila, da geometrija NE more nastati na dva
 * različna načina (audit F1/F2/F3/F8/F9):
 *  - orientacijsko-specifičen max razmak stebrov (NI fallbacka H↔V — spec §3);
 *  - kvalifikatorji iz kataloga (samo strukturirani pogoji se uporabijo
 *    samodejno — trenutno izključno verticalOver150Cm);
 *  - HARD validacija eksplicitnih post pozicij (§4: nič tiših popravil);
 *  - geometrijska validacija razmikov (§5);
 *  - hard validacija cevi (§6);
 *  - rights gate z EKSPPLICITnim production/evaluation načinom (§11 — NI NODE_ENV).
 *
 * Vse funkcije so ČISTE (determinizem §14): brez naključja, brez urinih žigov,
 * brez UUID, brez AI, brez omrežja.
 */
import type { FenceConfiguration, Orientation, ProductDefinition, RightsStatus } from './types'

const EPS = 1e-9

/** SDK validation error — API jo preslika v 400 (spec §4: "400 / invalid configuration"). */
export class SdkValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SdkValidationError'
  }
}

// ────────────────────────────────────────────────────────────────────────────
// §2/§3 — ORIENTACIJSKO-SPECIFIČNA MONTAŽNA PRAVILA
// ────────────────────────────────────────────────────────────────────────────

/** Pravilo za orientacijo — BREZ fallbacka na drugo orientacijo (spec §3 KRITIČNO). */
export function orientationSpacingRule(def: ProductDefinition, orientation: Orientation) {
  const rules = def.mounting.maxPostSpacingByOrientation
  const rule = orientation === 'horizontal' ? rules.horizontal : rules.vertical
  return rule.maxSpacingMm
}

/**
 * Efektivni max razmak stebrov za (produkt, orientacija, relevantna geometrija).
 *
 * Odločitev je funkcija product + orientation + geometry (spec §2 KRITIČNO),
 * ne samo product. Samodejno se uporabi SAMO kvalifikator s strukturiranim
 * pogojem (verticalOver150Cm: višina polja > 1500 mm). Nič drugega ni ugibano:
 * če katalog ne dokumentira pravila → null (eksplicitne pozicije obvezne).
 *
 * fieldHeightMm = višina OGRAJNEGA POLJA brez ročaja (katalog pravila govorijo
 * o višini ograje — ročaj ni del konstrukcijske višine nosilcev).
 */
export function resolveMaxPostSpacingMm(def: ProductDefinition, config: Pick<FenceConfiguration, 'orientation'>, fieldHeightMm: number): number | null {
  const base = orientationSpacingRule(def, config.orientation)
  const applicable: number[] = []
  if (base !== null && base > 0) applicable.push(base)
  for (const q of def.mounting.postSpacingQualifiers) {
    if (!q.autoApplied) continue
    if (q.orientation !== config.orientation) continue
    if (q.appliesWhenFieldHeightAboveMm !== undefined && fieldHeightMm > q.appliesWhenFieldHeightAboveMm + EPS) {
      applicable.push(q.maxSpacingMm)
    }
  }
  if (applicable.length === 0) return null
  // Več veljavnih pravil = zadostiti mora VSEM → najstrožje (min) pravilo.
  return Math.min(...applicable)
}

/** Max razmak cevi (samo vertical — cevi pri horizontali ne obstajajo po katalogu). */
export function resolveMaxRailSpacingMm(def: ProductDefinition, orientation: Orientation): number | null {
  if (orientation !== 'vertical') return null
  const max = def.mounting.maxRailSpacingMm
  return max !== null && max > 0 ? max : null
}

/** Nepodprta orientacija = čisto zavrnjena (spec §13 KUBO H → invalid, ne warning). */
export function assertOrientationSupported(def: ProductDefinition, orientation: Orientation): void {
  if (!def.orientations.includes(orientation)) {
    throw new SdkValidationError(
      `product-sdk: profil "${def.profile.name}" po katalogu NE podpira orientacije "${orientation}" (dovoljene: ${def.orientations.join(', ')}) — konfiguracija zavrnjena`,
    )
  }
}

/** Ročaj brez katalog podpore = zavrnjen (audit F8 — prej tiho ignoriran). */
export function assertHandleAllowed(def: ProductDefinition, handle: boolean | undefined): void {
  if (handle === true && !def.mounting.handle.available) {
    throw new SdkValidationError(
      `product-sdk: ročaj je zahtevan, katalog pa ga za profil "${def.profile.name}" NE ponuja — konfiguracija zavrnjena`,
    )
  }
}

// ────────────────────────────────────────────────────────────────────────────
// §4/§5 — HARD VALIDACIJA POST POZICIJ (NIČ tiših popravil)
// ────────────────────────────────────────────────────────────────────────────

export interface PostValidationContext {
  /** Širina polja (mm) — pozicije morajo biti znotraj [0, spanMm]. */
  spanMm: number
  /** Efektivni katalog max razmak (mm) ali null, če ni dokumentiran. */
  maxSpacingMm: number | null
  /** Vir pozicij za sporočila ("explicit" | "derived"). */
  source: 'explicit' | 'derived'
}

/**
 * Geometrijska validacija post pozicij (spec §4/§5):
 *  - vse vrednosti končne (NaN/±Infinity → napaka);
 *  - 0 ≤ p ≤ spanMm (izven polja → napaka, NE warning);
 *  - strogo naraščajoče (duplikati in nerazvrščene pozicije → napaka —
 *    NI tišega sortiranja, spec §10);
 *  - vsak interval ≤ katalog max, kadar max obstaja (spec §5).
 * Ko katalog max NE obstaja, so eksplicitne pozicije dovoljene, a osnovna
 * geometrijska veljavnost se vseeno preveri (spec §5).
 * Vrne pozicije v danem vrstnem redu (validirane) — NI preurejanja.
 */
export function validatePostPositions(positions: number[], ctx: PostValidationContext): number[] {
  const label = ctx.source === 'explicit' ? 'eksplicitna' : 'izpeljana'
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i]
    if (!Number.isFinite(p)) {
      throw new SdkValidationError(`product-sdk: ${label} pozicija stebra #${i} ni končna (NaN/Infinity) — neveljavna geometrija`)
    }
    if (p < -EPS || p > ctx.spanMm + EPS) {
      throw new SdkValidationError(
        `product-sdk: ${label} pozicija stebra ${Math.round(p)} mm je izven polja (0–${ctx.spanMm} mm) — neveljavna geometrija`,
      )
    }
  }
  for (let i = 1; i < positions.length; i++) {
    const prev = positions[i - 1]
    const cur = positions[i]
    if (cur <= prev + EPS) {
      throw new SdkValidationError(
        cur === prev
          ? `product-sdk: duplicirana pozicija stebra ${Math.round(cur)} mm — neveljavna geometrija`
          : `product-sdk: pozicije stebrov niso strogo naraščajoče (${Math.round(prev)} → ${Math.round(cur)} mm) — podaj urejene pozicije (ni tišega razvrščanja)`,
      )
    }
    if (ctx.maxSpacingMm !== null && cur - prev > ctx.maxSpacingMm + EPS) {
      throw new SdkValidationError(
        `product-sdk: razmak stebrov ${Math.round(cur - prev)} mm presega katalog max ${ctx.maxSpacingMm} mm (${ctx.source})`,
      )
    }
  }
  return positions
}

// ────────────────────────────────────────────────────────────────────────────
// §6 — HARD VALIDACIJA CEVI (rails)
// ────────────────────────────────────────────────────────────────────────────

export interface RailValidationContext {
  /** Višina polja (mm) — središča cevi morajo biti znotraj [0, fieldHeightMm]. */
  fieldHeightMm: number
  maxSpacingMm: number | null
  orientation: Orientation
}

/** Cevi obstajajo IZKLJUČNO pri pokončni ograji (spec §6). */
export function validateRails(centers: number[], ctx: RailValidationContext): number[] {
  if (centers.length === 0) return centers
  if (ctx.orientation !== 'vertical') {
    throw new SdkValidationError('product-sdk: cevi obstajajo samo pri vertical orientaciji — neveljavna geometrija')
  }
  for (let i = 0; i < centers.length; i++) {
    const c = centers[i]
    if (!Number.isFinite(c)) throw new SdkValidationError(`product-sdk: pozicija cevi #${i} ni končna (NaN/Infinity)`)
    if (c < -EPS || c > ctx.fieldHeightMm + EPS) {
      throw new SdkValidationError(
        `product-sdk: pozicija cevi ${Math.round(c)} mm je izven polja (0–${ctx.fieldHeightMm} mm)`,
      )
    }
  }
  for (let i = 1; i < centers.length; i++) {
    const prev = centers[i - 1]
    const cur = centers[i]
    if (cur <= prev + EPS) {
      throw new SdkValidationError(
        cur === prev
          ? `product-sdk: duplicirana pozicija cevi ${Math.round(cur)} mm`
          : 'product-sdk: pozicije cevi niso strogo naraščajoče — neveljavna geometrija',
      )
    }
    if (ctx.maxSpacingMm !== null && cur - prev > ctx.maxSpacingMm + EPS) {
      throw new SdkValidationError(
        `product-sdk: razmak cevi ${Math.round(cur - prev)} mm presega katalog max ${ctx.maxSpacingMm} mm`,
      )
    }
  }
  return centers
}

// ────────────────────────────────────────────────────────────────────────────
// §10 — LAYOUT JE KANONIČEN: konflikt config↔layout = HARD FAILURE
// ────────────────────────────────────────────────────────────────────────────

export interface LayoutLike {
  productId: string
  catalogProductId: string
  orientation: Orientation
  gapMm: number
  fenceWidthMm: number
  fenceHeightMm: number
  handlePresent: boolean
  bounds: { widthMm: number; heightMm: number }
}

/**
 * Renderer NE sme tiho uporabiti ene vrednosti in ignorirati druge (spec §10):
 * layout je kanoničen — klicatelj, ki podane config in layout ne ujemata,
 * dobi HARD FAILURE, ne tihega popravila.
 */
export function assertLayoutConsistentWithConfig(layout: LayoutLike, config: FenceConfiguration): void {
  const conflicts: string[] = []
  if (layout.orientation !== config.orientation) {
    conflicts.push(`orientation (layout=${layout.orientation}, config=${config.orientation})`)
  }
  if (layout.gapMm !== config.gapMm) {
    conflicts.push(`gapMm (layout=${layout.gapMm}, config=${config.gapMm})`)
  }
  if (layout.bounds.widthMm !== config.spanMm) {
    conflicts.push(`spanMm (layout.bounds=${layout.bounds.widthMm}, config=${config.spanMm})`)
  }
  if (layout.bounds.heightMm !== config.heightMm) {
    conflicts.push(`heightMm (layout.bounds=${layout.bounds.heightMm}, config=${config.heightMm})`)
  }
  if (layout.handlePresent !== (config.handle === true && layout.handlePresent)) {
    // config.handle=true mora biti v layoutu; layout.handlePresent=true brez config.handle=true je nemogoče,
    // a če se zgodi (tuji layout), je to konflikt.
    if (config.handle === true && !layout.handlePresent) conflicts.push('handle (config zahteva ročaj, layout ga nima)')
    if (layout.handlePresent && config.handle !== true) conflicts.push('handle (layout ima ročaj, config ne zahteva)')
  }
  if (conflicts.length > 0) {
    throw new SdkValidationError(
      `product-sdk: layout in config sta v konfliktu (layout je kanoničen — popravite config ali ponovno zgradite layout): ${conflicts.join('; ')}`,
    )
  }
}

// ────────────────────────────────────────────────────────────────────────────
// §11 — RIGHTS GATE (ekspliciten način, NI NODE_ENV kot poslovno pravilo)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Način pravic:
 *  - 'production'  → pending BLOKIRAN (samo granted sme v produkcijo);
 *  - 'evaluation'  → pending dovoljen za interno development/evalvacijo
 *                    (odkrito označeno v odgovoru — NI produkcija).
 *
 * Privzeto 'evaluation': trenutni deployment je RAZVOJNI (dokumentirano v
 * S81-AUDIT.md §F9). Produkcija nastavi ROKSAL_RIGHTS_MODE=production —
 * ekspliciten config gate, ne posreden NODE_ENV.
 */
export type RightsMode = 'production' | 'evaluation'

export function resolveRightsMode(explicit?: string | null): RightsMode {
  const raw = explicit ?? process.env.ROKSAL_RIGHTS_MODE
  return raw === 'production' ? 'production' : 'evaluation'
}

export interface RightsDecision {
  allowed: boolean
  rights: RightsStatus
  mode: RightsMode
  /** Predlagan HTTP status, če allowed=false (403). */
  httpStatus: 200 | 403
  reason: string
}

export function evaluateRightsGate(def: Pick<ProductDefinition, 'id' | 'rights'>, mode: RightsMode): RightsDecision {
  if (def.rights === 'rejected') {
    return { allowed: false, rights: 'rejected', mode, httpStatus: 403, reason: `Produkt "${def.id}" ima pravice ZAVRNJENE — render NI dovoljen v nobenem načinu` }
  }
  if (def.rights === 'pending' && mode === 'production') {
    return { allowed: false, rights: 'pending', mode, httpStatus: 403, reason: `Produkt "${def.id}" ima pravice PENDING — v production načinu blokiran (potrebno dovoljenje lastnika)` }
  }
  if (def.rights === 'pending' && mode === 'evaluation') {
    return { allowed: true, rights: 'pending', mode, httpStatus: 200, reason: 'PENDING — dovoljeno SAMO za interno development/evalvacijo (evaluation način)' }
  }
  return { allowed: true, rights: 'granted', mode, httpStatus: 200, reason: 'Pravice odobrene' }
}
