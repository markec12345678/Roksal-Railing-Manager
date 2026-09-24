/**
 * PRODUCT SDK — GEOMETRY ENGINE (runda S+8 §9/§10; S+8.1 hardening §2–§6, §10, §13).
 *
 * buildFenceLayout() je SOURCE-OF-TRUTH za geometrijo ograje:
 *   ProductDefinition + FenceConfiguration → FenceLayout
 *
 * PRAVILA:
 *  - število desk, razmaki, širine, oblika, stebri, cevi, čepi, vijaki = IZ KATALOGA
 *    in čiste aritmetike — NIČ ugibanja, NIČ AI, NIČ naključja;
 *  - enak vhod → enak izhod (čista funkcija, determinizem);
 *  - S+8.1 §2 (P0): max razmak stebrov je ORIENTACIJSKO-SPECIFIČEN (NI fallbacka
 *    H↔V); kvalifikator verticalOver150Cm se upošteva pri višini > 1500 mm;
 *  - S+8.1 §4/§5 (P0): eksplicitne post pozicije so HARD validirane (izven
 *    polja / NaN / ∞ / duplikati / neurejene / interval > max = validation
 *    error — NI tiših popravil in NI tišega razvrščanja);
 *  - S+8.1 §6 (P1): cevi so hard validirane (bounds/monotonija/duplikati/max);
 *  - S+8.1 §13 (P1): nepodprta orientacija (npr. KUBO horizontal) = ZAVRNJENA,
 *    ročaj brez katalog podpore = ZAVRJEN (prej tiho ignorirano);
 *  - katalog NE dokumentira max razmaka → stebri NISO izpeljani (eksplicitne
 *    pozicije obvezne) — nič izmišljenega.
 *
 * Deske se računajo z DOKAZANO funkcijo computeFenceLayout iz
 * src/lib/procedural/fence-engine.ts (S+7, 21 testov) — NI podvajanja.
 */
import { computeFenceLayout, type FenceRequest } from '@/lib/procedural/fence-engine'
import { getProduct } from '@/lib/product-catalog'
import type {
  FenceConfiguration,
  FenceLayout,
  FenceLayoutBounds,
  FencePost,
  FenceRail,
  FenceCap,
  FenceFastener,
  ProductDefinition,
} from './types'
import {
  SdkValidationError,
  assertHandleAllowed,
  assertOrientationSupported,
  resolveMaxPostSpacingMm,
  resolveMaxRailSpacingMm,
  validatePostPositions,
  validateRails,
} from './rules'

const EPS = 1e-9

/** Deterministično izpeljane pozicije stebrov iz orientacijsko-specifičnega max razmaka. */
function derivePostPositions(def: ProductDefinition, config: FenceConfiguration, fenceHeightMm: number): number[] | null {
  const max = resolveMaxPostSpacingMm(def, config, fenceHeightMm)
  if (max === null) return null // katalog ne navaja (za to orientacijo) — ne izmišljujemo
  const spanMm = config.spanMm
  const positions: number[] = []
  const n = Math.max(1, Math.ceil(spanMm / max - EPS))
  for (let i = 0; i <= n; i++) positions.push(Math.round((spanMm * i) / n))
  return positions
}

function buildPosts(def: ProductDefinition, config: FenceConfiguration, fenceHeightMm: number): { posts: FencePost[]; warnings: string[] } {
  const warnings: string[] = []
  const widthMm = config.posts?.widthMm ?? 0
  if (widthMm <= 0 || !config.posts) return { posts: [], warnings }

  // Kvalifikator (verticalOver150Cm) gleda SKUPNO višino ograje (ne polja brez ročaja).
  const maxSpacing = resolveMaxPostSpacingMm(def, config, fenceHeightMm)
  let centers: number[]
  if (config.posts.positionsMm && config.posts.positionsMm.length > 0) {
    // S+8.1 §4/§5: eksplicitne pozicije = HARD validacija (nič tiših popravil).
    centers = validatePostPositions([...config.posts.positionsMm], {
      spanMm: config.spanMm,
      maxSpacingMm: maxSpacing,
      source: 'explicit',
    })
  } else {
    const derived = derivePostPositions(def, config, fenceHeightMm)
    if (derived === null) {
      warnings.push(
        `katalog ne navaja maxPostSpacing za profil "${def.profile.name}" pri orientaciji "${config.orientation}" — stebri NISO izpeljani (potrebne eksplicitne pozicije)`,
      )
      return { posts: [], warnings }
    }
    // Obrambno v globino: izpeljane pozicije gredo skozi ISTO validacijo (§5).
    centers = validatePostPositions(derived, { spanMm: config.spanMm, maxSpacingMm: maxSpacing, source: 'derived' })
  }
  const posts: FencePost[] = centers.map((centerMm, index) => ({
    index,
    centerMm,
    widthMm,
    role: index === 0 || index === centers.length - 1 ? 'terminal' : 'intermediate',
  }))
  return { posts, warnings }
}

/** Vodoravne cevi (samo vertical): zgornja + spodnja + vmesne po maxRailSpacingMm. */
function buildRails(def: ProductDefinition, layoutOrientation: 'horizontal' | 'vertical', fieldHeightMm: number): { rails: FenceRail[]; warnings: string[] } {
  const warnings: string[] = []
  if (layoutOrientation !== 'vertical') return { rails: [], warnings }
  const max = resolveMaxRailSpacingMm(def, layoutOrientation)
  if (max === null) {
    warnings.push('katalog ne navaja maxRailSpacingMm — cevi NISO izpeljane (samo konstrukcija uporabnika)')
    return { rails: [], warnings }
  }
  const centers: number[] = []
  const n = Math.max(1, Math.ceil(fieldHeightMm / max - EPS))
  for (let i = 0; i <= n; i++) centers.push(Math.round((fieldHeightMm * i) / n))
  // S+8.1 §6: hard validacija (obrambno — izpeljava mora vedno prestati svoja pravila).
  validateRails(centers, { fieldHeightMm, maxSpacingMm: max, orientation: layoutOrientation })
  const rails: FenceRail[] = centers.map((centerMm, index) => ({
    index,
    centerMm,
    // Presek cevi NI v katalogu — pozicija brez izmišljenega preseka (S+8.1 §6: ostane null).
    crossSectionMm: null,
    role: index === 0 || index === centers.length - 1 ? 'terminal' : 'intermediate',
  }))
  return { rails, warnings }
}

/** Zaključki iz kataloga (accessories) — podatkovna preslikava, brez ugibanja. */
function buildCaps(def: ProductDefinition): FenceCap[] {
  if (def.profile.shape === 'rhombus') {
    // katalog accessories: cep-romb-levo-desno + opcija letvica-zakljucna
    return [
      { side: 'left', kind: 'cep-romb-levo' },
      { side: 'right', kind: 'cep-romb-desno' },
    ]
  }
  if (def.profile.name.startsWith('DESKA-150')) {
    // katalog accessories: pokrovcek-terasna (terasna deska)
    return [{ side: 'top', kind: 'pokrovcek-terasna' }]
  }
  return []
}

/**
 * Vijaki = DETERMINISTIČNA pravila iz definicije (spec §8 MOUNTING):
 *  - ploskvice: samo če screwVisibility === 'visible' in so stebri/cevi podani
 *    (vijak na sredini ploskvice pri nosilcu — način iz kataloga);
 *  - ročaj: vijaki vsak screwsEveryMm (katalog: 500 mm), središča intervalov.
 */
function buildFasteners(def: ProductDefinition, config: FenceConfiguration, lay: { boards: { index: number; startMm: number; visibleMm: number }[]; fenceWidthMm: number; fenceHeightMm: number; orientation: 'horizontal' | 'vertical'; handlePresent: boolean; handleHeightMm: number }, posts: FencePost[], rails: FenceRail[]): FenceFastener[] {
  const out: FenceFastener[] = []
  const visible = def.mounting.screwVisibility === 'visible'
  if (config.posts && config.posts.widthMm > 0 && posts.length > 0) {
    if (lay.orientation === 'horizontal') {
      for (const b of lay.boards) {
        for (const p of posts) {
          out.push({
            type: 'board',
            atMm: [p.centerMm, lay.fenceHeightMm - (b.startMm + b.visibleMm / 2)],
            visible,
            ref: `board-${b.index}@post-${p.index}`,
          })
        }
      }
    } else {
      // Pokončno: vijaki so na ceveh (zadaj) — vidnost iz kataloga, pozicija pri cevi.
      for (const b of lay.boards) {
        for (const r of rails) {
          out.push({
            type: 'board',
            atMm: [b.startMm + b.visibleMm / 2, r.centerMm],
            visible,
            ref: `board-${b.index}@rail-${r.index}`,
          })
        }
      }
    }
  }
  if (lay.handlePresent && def.mounting.handle.available) {
    const every = def.mounting.handle.screwsEveryMm ?? 500
    for (let smm = every / 2; smm < lay.fenceWidthMm; smm += every) {
      out.push({
        type: 'handle',
        atMm: [smm, lay.handleHeightMm / 2],
        visible: def.mounting.handle.screwsVisible !== false,
        ref: `handle@${Math.round(smm)}mm`,
      })
    }
  }
  return out
}

export interface BuildLayoutOptions {
  /** Katalog profil — če ni podan, se naloži po config.productId (server-auth). */
  definition?: ProductDefinition
}

/**
 * SOURCE-OF-TRUTH za geometrijo. Enak vhod → enak izhod (čista funkcija).
 * Neveljavna konfiguracija → SdkValidationError (NI tišega popravljanja;
 * API preslika v 400 — spec S+8.1 §4).
 */
export function buildFenceLayout(config: FenceConfiguration, options?: BuildLayoutOptions): FenceLayout {
  const def = options?.definition ?? null
  if (!def) {
    // Strežnik mora definicijo naložiti iz kataloga (spec §21) — SDK to zahteva.
    throw new SdkValidationError('product-sdk: buildFenceLayout zahteva definition (server-authoritative) — uporabi sdk.layout({ definition })')
  }
  if (!Number.isFinite(config.spanMm) || !Number.isFinite(config.heightMm) || !Number.isFinite(config.gapMm)) {
    throw new SdkValidationError('product-sdk: spanMm/heightMm/gapMm morajo biti končna števila')
  }
  if (!(config.spanMm > 0) || !(config.heightMm > 0)) {
    throw new SdkValidationError('product-sdk: spanMm/heightMm morata biti > 0')
  }
  if (!(config.gapMm >= 0)) throw new SdkValidationError('product-sdk: gapMm >= 0')
  if (def.rights === 'rejected') {
    throw new SdkValidationError(`product-sdk: produkt "${def.id}" ima rights=rejected — render NI dovoljen`)
  }

  // S+8.1 §13: nepodprta orientacija in ročaj brez podpore = ZAVRNJENO (hard).
  assertOrientationSupported(def, config.orientation)
  assertHandleAllowed(def, config.handle)

  // S+8.1 §8: polje MORA biti vsaj ena ploskvica — sicer engineovi "min ena
  // deska" garancija povzroči geometrijo, ki PRESEŽE zahtevane bounds
  // (fizično nesmiselno: profil ne more biti manjši od svoje širine).
  const handleHeightMm =
    config.handle === true && def.mounting.handle.available ? (def.mounting.handle.dimensionMm?.[0] ?? 92) : 0
  const fieldHeight = config.heightMm - handleHeightMm
  if (fieldHeight < def.profile.faceWidthMm) {
    throw new SdkValidationError(
      `product-sdk: višina polja (${Math.round(fieldHeight)} mm) je manjša od širine profila (${def.profile.faceWidthMm} mm) — neveljavna geometrija`,
    )
  }
  if (config.orientation === 'vertical' && config.spanMm < def.profile.faceWidthMm) {
    throw new SdkValidationError(
      `product-sdk: širina polja (${Math.round(config.spanMm)} mm) je manjša od širine profila (${def.profile.faceWidthMm} mm) — neveljavna geometrija`,
    )
  }

  const warnings: string[] = []
  const posts = buildPosts(def, config, config.heightMm)
  warnings.push(...posts.warnings)

  // 1) deske — DOKAZANA aritmetika iz S+7 (isti vir, ni podvajanja)
  const catalogProfile = getProduct(def.catalogProductId)
  if (!catalogProfile) throw new SdkValidationError(`product-sdk: katalog profil "${def.catalogProductId}" ne obstaja`)
  const req: FenceRequest = {
    productId: def.catalogProductId,
    orientation: config.orientation,
    fenceWidthMm: config.spanMm,
    fenceHeightMm: config.heightMm,
    gapMm: config.gapMm,
    material: { kind: 'color', rgb: [128, 128, 128] }, // za layout NE uporabljeno
    outWidthPx: 0,
    outHeightPx: 0,
    handle: config.handle,
    profileOverride: catalogProfile,
  }
  const base = computeFenceLayout(req)

  // 2) konstrukcija + zaključki + vijaki (iz katalogovih pravil).
  //    Cevi potrebujejo VIŠINO POLJA (brez ročaja) — katalog pravila govorijo o
  //    višini ograjnega polja (ročaj ni del konstrukcijske višine nosilcev).
  const rails = buildRails(def, config.orientation, base.fieldHeightMm)
  warnings.push(...rails.warnings)
  const caps = buildCaps(def)
  const fasteners = buildFasteners(
    def,
    config,
    {
      boards: base.boards,
      fenceWidthMm: base.fenceWidthMm,
      fenceHeightMm: base.fenceHeightMm,
      orientation: base.orientation,
      handlePresent: base.handlePresent,
      handleHeightMm: base.handleHeightMm,
    },
    posts.posts,
    rails.rails,
  )

  if (config.gapMm > def.board.maxGapMm || config.gapMm < def.board.minGapMm) {
    warnings.push(
      `razmak ${config.gapMm} mm je izven priporočila proizvajalca (${def.board.minGapMm}–${def.board.maxGapMm} mm)`,
    )
  }

  const bounds: FenceLayoutBounds = { widthMm: config.spanMm, heightMm: config.heightMm }

  return {
    productId: def.id,
    catalogProductId: def.catalogProductId,
    profile: def.profile.name,
    orientation: config.orientation,
    faceWidthMm: def.profile.faceWidthMm,
    gapMm: config.gapMm,
    pitchMm: base.pitchMm,
    fenceWidthMm: base.fenceWidthMm,
    fenceHeightMm: base.fenceHeightMm,
    fieldHeightMm: base.fieldHeightMm,
    fieldSpanMm: base.fieldSpanMm,
    boardCount: base.boardCount,
    boards: base.boards,
    posts: posts.posts,
    rails: rails.rails,
    caps,
    fasteners,
    handlePresent: base.handlePresent,
    handleHeightMm: base.handleHeightMm,
    bounds,
    warnings,
    definitionId: def.id,
  }
}
