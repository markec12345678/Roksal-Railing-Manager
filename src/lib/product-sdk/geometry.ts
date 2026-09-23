/**
 * PRODUCT SDK — GEOMETRY ENGINE (runda S+8 §9, §10).
 *
 * buildFenceLayout() je SOURCE-OF-TRUTH za geometrijo ograje:
 *   ProductDefinition + FenceConfiguration → FenceLayout
 *
 * PRAVILA (spec §6/§8/§19):
 *  - število desk, razmaki, širine, oblika, stebri, čepi, vijaki = IZ KATALOGA
 *    in čiste aritmetike — NIČ ugibanja, NIČ AI, NIČ naključja;
 *  - enak vhod → enak izhod (čista funkcija, determinizem);
 *  - stebri/cevi so izpeljani IZ katalogovih maksimalnih razmakov (ne iz AI);
 *  - vijaki so izpeljani IZ mounting.screwVisibility (odločitev proizvajalca).
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

const EPS = 1e-9

/** Deterministično izpeljane pozicije stebrov iz katalog. maxPostSpacingMm. */
function derivePostPositions(def: ProductDefinition, spanMm: number): number[] | null {
  const max = def.mounting.maxPostSpacingMm
  if (max === null || max <= 0) return null // katalog ne navaja — ne izmišljujemo
  const positions: number[] = []
  const n = Math.max(1, Math.ceil(spanMm / max - EPS))
  for (let i = 0; i <= n; i++) positions.push(Math.round((spanMm * i) / n))
  return positions
}

function buildPosts(def: ProductDefinition, config: FenceConfiguration, spanMm: number): { posts: FencePost[]; warnings: string[] } {
  const warnings: string[] = []
  const widthMm = config.posts?.widthMm ?? 0
  if (widthMm <= 0 || !config.posts) return { posts: [], warnings }

  let centers: number[] | null = null
  let role: FencePost['role'][] | null = null
  if (config.posts.positionsMm && config.posts.positionsMm.length > 0) {
    // Eksplicitne pozicije — validirane proti max razmaku (spec §8 MOUNTING).
    const given = [...config.posts.positionsMm].sort((a, b) => a - b)
    const max = def.mounting.maxPostSpacingMm
    for (let i = 1; i < given.length; i++) {
      if (max !== null && given[i] - given[i - 1] > max + EPS) {
        warnings.push(
          `razmak stebrov ${Math.round(given[i] - given[i - 1])} mm presega katalog max ${max} mm`,
        )
      }
    }
    centers = given
    role = given.map((_, i) => (i === 0 || i === given.length - 1 ? 'terminal' : 'intermediate'))
  } else {
    centers = derivePostPositions(def, spanMm)
    if (centers === null) {
      warnings.push(
        'katalog ne navaja maxPostSpacingMm za ta profil — stebri NISO izpeljani (potrebne eksplicitne pozicije)',
      )
      return { posts: [], warnings }
    }
    role = centers.map((_, i) => (i === 0 || i === centers!.length - 1 ? 'terminal' : 'intermediate'))
  }
  const posts: FencePost[] = centers.map((centerMm, index) => ({
    index,
    centerMm,
    widthMm,
    role: role![index],
  }))
  return { posts, warnings }
}

/** Vodoravne cevi (samo vertical): zgornja + spodnja + vmesne po maxRailSpacingMm. */
function buildRails(def: ProductDefinition, layoutOrientation: 'horizontal' | 'vertical', fieldHeightMm: number): { rails: FenceRail[]; warnings: string[] } {
  const warnings: string[] = []
  if (layoutOrientation !== 'vertical') return { rails: [], warnings }
  const max = def.mounting.maxRailSpacingMm
  if (max === null || max <= 0) {
    warnings.push('katalog ne navaja maxRailSpacingMm — cevi NISO izpeljane (samo konstrukcija uporabnika)')
    return { rails: [], warnings }
  }
  const centers: number[] = []
  const n = Math.max(1, Math.ceil(fieldHeightMm / max - EPS))
  for (let i = 0; i <= n; i++) centers.push(Math.round((fieldHeightMm * i) / n))
  const rails: FenceRail[] = centers.map((centerMm, index) => ({
    index,
    centerMm,
    // Presek cevi NI v katalogu — pozicija brez izmišljenega preseka.
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
 * Neveljavna konfiguracija → javna napaka (NI tišega popravljanja).
 */
export function buildFenceLayout(config: FenceConfiguration, options?: BuildLayoutOptions): FenceLayout {
  const def = options?.definition ?? null
  if (!def) {
    // Strežnik mora definicijo naložiti iz kataloga (spec §21) — SDK to zahteva.
    throw new Error('product-sdk: buildFenceLayout zahteva definition (server-authoritative) — uporabi sdk.layout({ definition })')
  }
  if (!(config.spanMm > 0) || !(config.heightMm > 0)) {
    throw new Error('product-sdk: spanMm/heightMm morata biti > 0')
  }
  if (!(config.gapMm >= 0)) throw new Error('product-sdk: gapMm >= 0')
  if (def.rights === 'rejected') {
    throw new Error(`product-sdk: produkt "${def.id}" ima rights=rejected — render NI dovoljen`)
  }

  const warnings: string[] = [...buildPostRailWarnings(def, config)]
  const posts = buildPosts(def, config, config.spanMm)
  warnings.push(...posts.warnings)

  // 1) deske — DOKAZANA aritmetika iz S+7 (isti vir, ni podvajanja)
  const catalogProfile = getProduct(def.catalogProductId)
  if (!catalogProfile) throw new Error(`product-sdk: katalog profil "${def.catalogProductId}" ne obstaja`)
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

  // 2) konstrukcija + zaključki + vijaki (iz katalogovih pravil)
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

  if (!def.orientations.includes(config.orientation)) {
    warnings.push(
      `profil "${def.profile.name}" po katalogu NE podpira orientacije "${config.orientation}" (dovoljene: ${def.orientations.join(', ')})`,
    )
  }
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

function buildPostRailWarnings(def: ProductDefinition, config: FenceConfiguration): string[] {
  const w: string[] = []
  if (config.posts?.positionsMm && config.posts.positionsMm.length > 0) {
    for (const p of config.posts.positionsMm) {
      if (p < 0 || p > config.spanMm + EPS) {
        w.push(`pozicija stebra ${Math.round(p)} mm je izven polja (0–${config.spanMm} mm)`)
      }
    }
  }
  return w
}
