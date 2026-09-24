/**
 * CV STUDIO SDK — PWC Placement Engine (issue #11 §7/§8).
 *
 * DETERMINISTIČNA PLAST: Scene/meritvena geometrija → postavitev produkta.
 *
 * PONOVNA UPORABA (ni podvajanja):
 *  - produkt = Product SDK definicija (data/roksal-catalog.json) — NIČ
 *    izmišljenih produktov/lastnosti; nezanesljivo ostane unknown;
 *  - layout = IZKLJUČNO obstoječi computeFenceLayout (@/lib/procedural/
 *    fence-engine) — EN vir proizvodne geometrije;
 *  - pravila razmakov = obstoječi resolveMaxPostSpacingMm /
 *    resolveMaxRailSpacingMm (@/lib/product-sdk/rules);
 *  - perspektiva = obstoječa homografija (@/lib/viz/homography, NISPREMENJENA).
 *
 * ZAKON (issue #11 §7): če konfiguracija krši pravila produkta →
 * placement = invalid, jasen razlog, BREZ layouta → brez BOM-a.
 * Ta modul NE izračuna BOM-a/cene — ta ostane v obstoječi verigi
 * Measurement → mapToGeometry → quote.
 */
import type { FenceLayout, FenceRequest } from '@/lib/procedural/fence-engine'
import { computeFenceLayout } from '@/lib/procedural/fence-engine'
import { getProductDefinition, normalizeProductId } from '@/lib/product-sdk'
import {
  resolveMaxPostSpacingMm,
  resolveMaxRailSpacingMm,
} from '@/lib/product-sdk/rules'
import type { NormPoint } from '@/lib/measurement'
import {
  applyHomography,
  solveHomography,
} from '@/lib/viz/homography'
import {
  PLACEMENT_ALGORITHM_VERSION,
  type PlacementInput,
  type PlacementResult,
  type PlacementViolation,
  type ProjectedElement,
  type ProjectionInput,
  type ProjectionResult,
} from './types'

/** Proizvodno območje (isti zakon kot mapToGeometry v Measurement SDK). */
const WIDTH_RANGE = { min: 300, max: 20000 } as const
const HEIGHT_RANGE = { min: 300, max: 3000 } as const
const EPS = 1e-6

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

function violation(code: string, message: string): PlacementViolation {
  return { code, message }
}

/**
 * Ocena postavitve (strežnik-avtoritativna; čista funkcija).
 * Invalid → { valid:false, reason, violations, layout:null }.
 */
export function evaluatePlacement(input: PlacementInput): PlacementResult {
  const violations: PlacementViolation[] = []
  const warnings: string[] = []

  // 0) osnovna finiten validacija (NI tišega popravljanja)
  const numeric: Array<[string, number]> = [
    ['gapMm', input.gapMm],
    ['postWidthMm', input.postWidthMm],
    ['fenceWidthMm', input.fenceWidthMm],
    ['fenceHeightMm', input.fenceHeightMm],
  ]
  for (const [k, v] of numeric) {
    if (!Number.isFinite(v)) {
      violations.push(violation('NON_FINITE_INPUT', `${k} ni končno število (NaN/Infinity).`))
    }
  }
  if (input.posts) {
    for (const p of input.posts.positionsMm) {
      if (!Number.isFinite(p)) {
        violations.push(violation('NON_FINITE_INPUT', 'Pozicija stebra ni končno število.'))
        break
      }
    }
  }

  // 1) produkt — izključno realna katalog definicija
  const def = input.productId ? getProductDefinition(normalizeProductId(input.productId)) : null
  if (!def) {
    violations.push(violation('UNKNOWN_PRODUCT', `Neznan produkt "${input.productId}".`))
  } else {
    // 2) orientacija — katalog pravilo
    if (!def.orientations.includes(input.orientation)) {
      violations.push(
        violation(
          'ORIENTATION_NOT_SUPPORTED',
          `Produkt "${def.id}" ne podpira orientacije "${input.orientation}" (dovoljeno: ${def.orientations.join(', ')}).`,
        ),
      )
    }
    // 3) razmak — katalog pravilo
    if (input.gapMm < def.board.minGapMm - EPS || input.gapMm > def.board.maxGapMm + EPS) {
      violations.push(
        violation(
          'GAP_OUT_OF_RANGE',
          `Razmak ${input.gapMm} mm je izven dovoljenega (${def.board.minGapMm}..${def.board.maxGapMm} mm) za ${def.profile.name}.`,
        ),
      )
    }
    // 4) ročaj samo, če profil podpira
    if (input.handle === true && def.mounting.handle.available !== true) {
      violations.push(
        violation('HANDLE_NOT_SUPPORTED', `Profil ${def.profile.name} ne podpira vrhnjega ročaja.`),
      )
    }
  }

  // 5) proizvodno območje (isti zakon kot mapToGeometry)
  if (
    Number.isFinite(input.fenceWidthMm) &&
    (input.fenceWidthMm < WIDTH_RANGE.min || input.fenceWidthMm > WIDTH_RANGE.max)
  ) {
    violations.push(
      violation(
        'WIDTH_OUT_OF_RANGE',
        `Širina ${input.fenceWidthMm} mm je izven proizvodnega območja (${WIDTH_RANGE.min}..${WIDTH_RANGE.max} mm).`,
      ),
    )
  }
  if (
    Number.isFinite(input.fenceHeightMm) &&
    (input.fenceHeightMm < HEIGHT_RANGE.min || input.fenceHeightMm > HEIGHT_RANGE.max)
  ) {
    violations.push(
      violation(
        'HEIGHT_OUT_OF_RANGE',
        `Višina ${input.fenceHeightMm} mm je izven proizvodnega območja (${HEIGHT_RANGE.min}..${HEIGHT_RANGE.max} mm).`,
      ),
    )
  }

  // 6) pravila stebrov (katalog) + hard validacija pozicij
  if (def && Number.isFinite(input.fenceWidthMm) && Number.isFinite(input.fenceHeightMm)) {
    const handlePresent = input.handle === true && def.mounting.handle.available === true
    const handleHeight = handlePresent ? (def.mounting.handle.dimensionMm?.[0] ?? 92) : 0
    const fieldHeightMm = Math.max(def.profile.faceWidthMm, input.fenceHeightMm - handleHeight)
    const maxPost = resolveMaxPostSpacingMm(def, { orientation: input.orientation }, fieldHeightMm)

    if (!input.posts || input.posts.positionsMm.length === 0) {
      if (maxPost === null) {
        violations.push(
          violation(
            'POSTS_REQUIRED',
            `Profil ${def.profile.name} (${input.orientation}) nima dokumentiranega maksimalnega razmaka stebrov — eksplicitne pozicije stebrov so OBVEZNE (ni tišega izvajanja).`,
          ),
        )
      }
      warnings.push('Stebri niso podani — layout brez stebrov (razmak stebrov ostaja odgovornost uporabnika).')
    } else {
      // efektivne točke podpore: končni stebri na robovih + podane pozicije
      // (ocena razmaka; v FenceRequest gre NErazširjen seznam — ista pot kot
      // mapToGeometry v Measurement SDK)
      const span = input.fenceWidthMm
      // NI tišega razvrščanja/duplikatov — podane pozicije grejo v validacijo
      // tako, kot so prišle (kršitev = POSTS_INVALID, fail-closed)
      const effective = [...input.posts.positionsMm]
      if (!effective.some((p) => Math.abs(p - 0) < 0.5)) effective.unshift(0)
      if (!effective.some((p) => Math.abs(p - span) < 0.5)) effective.push(span)

      try {
        validatePostPositionsSafe(effective, span, maxPost)
      } catch (err) {
        violations.push(
          violation('POSTS_INVALID', err instanceof Error ? err.message : 'Neveljavne pozicije stebrov.'),
        )
      }

      if (!(input.posts.widthMm >= 10 && input.posts.widthMm <= 200)) {
        violations.push(
          violation('POST_WIDTH_OUT_OF_RANGE', 'Širina stebra mora biti v [10, 200] mm.'),
        )
      }
    }

    // 7) pravilo pritrdilnih profilov (rails) — ne-blokirajoče inženirsko
    //    opozorilo (layout jih ne modelira; iskreno dokumentirano)
    const maxRail = resolveMaxRailSpacingMm(def, input.orientation)
    if (maxRail !== null && input.fenceHeightMm > maxRail) {
      warnings.push(
        `Višina ${input.fenceHeightMm} mm presega katalog max razmak pritrdilnih profilov (${maxRail} mm) — potrebni vmesni profili (layout jih ne modelira).`,
      )
    }
  }

  if (violations.length > 0) {
    return {
      valid: false,
      reason: violations[0].message,
      violations,
      layout: null,
      warnings,
      algorithmVersion: PLACEMENT_ALGORITHM_VERSION,
    }
  }

  // 8) layout — IZKLJUČNO prek obstoječega fence-engine (en vir resnice)
  const fenceRequest: FenceRequest = {
    productId: def!.catalogProductId,
    orientation: input.orientation,
    fenceWidthMm: Math.round(input.fenceWidthMm),
    fenceHeightMm: Math.round(input.fenceHeightMm),
    gapMm: input.gapMm,
    material:
      input.colorRgb !== undefined
        ? { kind: 'color', rgb: input.colorRgb }
        : { kind: 'color', rgb: [120, 120, 120] },
    outWidthPx: 200,
    outHeightPx: 150,
    posts: input.posts ?? null,
    handle: input.handle === true,
  }

  let layout: FenceLayout
  try {
    layout = computeFenceLayout(fenceRequest)
  } catch (err) {
    return {
      valid: false,
      reason: err instanceof Error ? err.message : 'Layout engine napaka.',
      violations: [violation('LAYOUT_ENGINE_ERROR', 'computeFenceLayout je zavrl vhod (fail-closed).')],
      layout: null,
      warnings,
      algorithmVersion: PLACEMENT_ALGORITHM_VERSION,
    }
  }
  for (const w of layout.warnings) warnings.push(w)

  return {
    valid: true,
    reason: null,
    violations: [],
    layout,
    warnings,
    algorithmVersion: PLACEMENT_ALGORITHM_VERSION,
  }
}

/** Hard validacija pozicij stebrov (ista pravila kot Product SDK — fail-closed). */
function validatePostPositionsSafe(positions: number[], spanMm: number, maxSpacingMm: number | null): void {
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i]
    if (!Number.isFinite(p)) throw new Error(`Pozicija stebra #${i} ni končna (NaN/Infinity).`)
    if (p < -EPS || p > spanMm + EPS) {
      throw new Error(`Pozicija stebra ${Math.round(p)} mm je izven polja (0–${Math.round(spanMm)} mm).`)
    }
  }
  for (let i = 1; i < positions.length; i++) {
    const prev = positions[i - 1]
    const cur = positions[i]
    if (cur <= prev + EPS) {
      throw new Error(
        cur === prev
          ? `Duplicirana pozicija stebra ${Math.round(cur)} mm.`
          : `Pozicije stebrov niso strogo naraščajoče (${Math.round(prev)} → ${Math.round(cur)} mm).`,
      )
    }
    if (maxSpacingMm !== null && cur - prev > maxSpacingMm + EPS) {
      throw new Error(`Razmak stebrov ${Math.round(cur - prev)} mm presega katalog max ${maxSpacingMm} mm.`)
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Projekcija layouta na sliko (issue #11 §8)
// ───────────────────────────────────────────────────────────────────────────

function norm(x: number, y: number): NormPoint {
  return { x: round4(x), y: round4(y) }
}

/** Homografska projekcija (4 potrjeni kotniki) — prava perspektivna preslikava. */
function projectViaHomography(input: ProjectionInput): ProjectionResult {
  const { layout, orientation, corners } = input
  if (!corners) throw new Error('Homografija brez kotnikov ni mogoča.')
  const dst: [[number, number], [number, number], [number, number], [number, number]] = [
    [corners[0].x, corners[0].y],
    [corners[1].x, corners[1].y],
    [corners[2].x, corners[2].y],
    [corners[3].x, corners[3].y],
  ]
  // src: enotski kvadrat (u,v) — u = x/W (od leve), v = y/H (OD ZGORAJ;
  // mm y meri od dna, zato v = 1 − mm/H)
  const src: [[number, number], [number, number], [number, number], [number, number]] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ]
  const H = solveHomography(src, dst)
  const map = (u: number, v: number): NormPoint => {
    const [x, y] = applyHomography(H, u, v)
    return norm(x, y)
  }

  const W = layout.fenceWidthMm
  const Ht = layout.fenceHeightMm
  const vBottom = 1
  const vFieldTop = 1 - layout.fieldHeightMm / Ht
  const vTop = 0

  const boards: ProjectedElement[] = []
  if (orientation === 'horizontal') {
    for (const b of layout.boards) {
      const v0 = 1 - (b.startMm + b.visibleMm) / Ht
      const v1 = 1 - b.startMm / Ht
      boards.push({
        key: b.index,
        kind: 'board',
        cut: b.cut,
        quad: [map(0, v0), map(1, v0), map(1, v1), map(0, v1)],
      })
    }
  } else {
    for (const b of layout.boards) {
      const u0 = b.startMm / W
      const u1 = (b.startMm + b.visibleMm) / W
      boards.push({
        key: b.index,
        kind: 'board',
        cut: b.cut,
        quad: [map(u0, vFieldTop), map(u1, vFieldTop), map(u1, vBottom), map(u0, vBottom)],
      })
    }
  }

  // stebri (tanka vertikalna ploskvica čez višino polja)
  const posts: ProjectedElement[] = []
  const pw = Math.max(0.002, (input.postsWidthMm ?? 60) / 2 / W)
  for (const pos of input.postsPositionsMm ?? []) {
    const u = pos / W
    posts.push({
      key: round4(pos),
      kind: 'post',
      quad: [map(u - pw, vFieldTop), map(u + pw, vFieldTop), map(u + pw, vBottom), map(u - pw, vBottom)],
    })
  }

  const handle: ProjectedElement | null =
    layout.handlePresent
      ? {
          key: 0,
          kind: 'handle',
          quad: [map(0, vTop), map(1, vTop), map(1, vFieldTop), map(0, vFieldTop)],
        }
      : null

  return { kind: 'homography', boards, posts, handle, warnings: [] }
}

/**
 * Projekcija postavitve na sliko.
 *  - s 4 potrjenimi kotniki → homografija (prava perspektivna preslikava);
 *  - brez → iskren 2D afina približek z OPOZORILO (nikoli "prava 3D").
 * Brez potrjenega merila → throw (NI mm projekcije brez merila).
 */
export function projectPlacement(input: ProjectionInput): ProjectionResult {
  if (!input.scale || !(input.scale.mmPerUnitX > 0) || !(input.scale.mmPerUnitY > 0)) {
    throw new Error('Projekcija brez potrjenega merila NI mogoča (ni izmišljevanja merila).')
  }

  if (input.corners && input.corners.length === 4) {
    try {
      return projectViaHomography(input)
    } catch {
      // degeneraten quad → iskren fallback z opozorilom
      return projectAffine(input, ['Homografija ni možna (degenerirani kotniki) — 2D približek.'])
    }
  }
  return projectAffine(input, [])
}

/** Iskren 2D afina približek (segment + merilo; NIKOLI se ne izda za 3D). */
function projectAffine(input: ProjectionInput, extraWarnings: string[]): ProjectionResult {
  const { layout, orientation, segment, scale } = input
  const dx = segment.end.x - segment.start.x
  const dy = segment.end.y - segment.start.y
  const len = Math.hypot(dx, dy)
  if (!(len > 1e-9)) {
    throw new Error('Potrjeni segment je degeneriran (dolžina 0) — projekcija ni mogoča.')
  }
  const ux = dx / len
  const uy = dy / len
  // normala "navzgor" (y raste navzdol po zaslonu → up = manjši y)
  let nx = uy
  let ny = -ux
  if (ny > 0) {
    nx = -nx
    ny = -ny
  }

  const sX = scale.mmPerUnitX
  const sY = scale.mmPerUnitY
  const segLenMm = len * sX
  const warnings = [
    ...extraWarnings,
    'PERSPEKTIVNI PBLIŽEK — 2D preslikava brez potrjenih kotnikov; ne predstavlja prave 3D projekcije.',
  ]
  if (Math.abs(segLenMm - layout.fenceWidthMm) > layout.fenceWidthMm * 0.02) {
    warnings.push(
      `Potrjeni segment (${Math.round(segLenMm)} mm) ne ujema z širino layouta (${layout.fenceWidthMm} mm) — preveri merilo/segment.`,
    )
  }

  /** točka: t mm po segmentu od start, h mm navzgor od dna */
  const P = (tMm: number, hMm: number): NormPoint => {
    const t = tMm / sX
    const h = hMm / sY
    return norm(segment.start.x + ux * t + nx * h, segment.start.y + uy * t + ny * h)
  }

  const W = layout.fenceWidthMm
  const fieldH = layout.fieldHeightMm
  const handleH = layout.handlePresent ? layout.handleHeightMm : 0

  const boards: ProjectedElement[] = []
  for (const b of layout.boards) {
    if (orientation === 'horizontal') {
      const h0 = b.startMm
      const h1 = b.startMm + b.visibleMm
      boards.push({
        key: b.index,
        kind: 'board',
        cut: b.cut,
        quad: [P(0, h0), P(W, h0), P(W, h1), P(0, h1)],
      })
    } else {
      const t0 = b.startMm
      const t1 = b.startMm + b.visibleMm
      boards.push({
        key: b.index,
        kind: 'board',
        cut: b.cut,
        quad: [P(t0, 0), P(t1, 0), P(t1, fieldH), P(t0, fieldH)],
      })
    }
  }

  const posts: ProjectedElement[] = []
  const pw = (input.postsWidthMm ?? 60) / 2
  for (const pos of input.postsPositionsMm ?? []) {
    posts.push({
      key: round4(pos),
      kind: 'post',
      quad: [P(pos - pw, 0), P(pos + pw, 0), P(pos + pw, fieldH), P(pos - pw, fieldH)],
    })
  }

  const handle: ProjectedElement | null =
    handleH > 0
      ? {
          key: 0,
          kind: 'handle',
          quad: [P(0, fieldH), P(W, fieldH), P(W, fieldH + handleH), P(0, fieldH + handleH)],
        }
      : null

  return { kind: 'affine-approximation', boards, posts, handle, warnings }
}
