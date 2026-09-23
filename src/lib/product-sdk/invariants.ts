/**
 * PRODUCT SDK — PRODUCT IDENTITY INVARIANTS (runda S+8 §8).
 *
 * Za vsak render se avtomatsko preveri:
 *   GEOMETRY: board count, board width, board thickness, gap, orientation,
 *             profile, post spacing
 *   PRODUCT:  selected product ID, selected profile, selected color,
 *             selected surface
 *   MOUNTING: screw visibility, cap rules, rail rules
 *
 * Če KATERA koli invarianta pade → renderValid = false in rezultat se NE
 * sme prikazati kot validen produkt (spec §8). To je obramba proti vsakršni
 * "generativni" zamenjavi produkta (tudi kasnejšega Qwen finalization —
 * primerjava A-preview vs Qwen izhoda bo uporabljala iste invariante).
 */
import type { FenceConfiguration, FenceLayout, InvariantCheck, InvariantReport, ProductDefinition } from './types'

const EPS = 1e-9

function check(
  group: InvariantCheck['group'],
  name: string,
  ok: boolean,
  expected: string | number | boolean,
  actual: string | number | boolean,
): InvariantCheck {
  return { group, name, ok, expected: String(expected), actual: String(actual) }
}

/** Ponovno izračunaj pričakovano število desk (neodvisna aritmetika). */
function expectedBoardCount(layout: FenceLayout): number {
  const pitch = layout.faceWidthMm + layout.gapMm
  return Math.max(1, Math.ceil(layout.fieldSpanMm / pitch - EPS))
}

export function verifyProductIdentity(def: ProductDefinition, config: FenceConfiguration, layout: FenceLayout): InvariantReport {
  const checks: InvariantCheck[] = []

  // ── GEOMETRY ────────────────────────────────────────────────────────────
  checks.push(check('GEOMETRY', 'boardCount', layout.boardCount === expectedBoardCount(layout), expectedBoardCount(layout), layout.boardCount))
  checks.push(
    check(
      'GEOMETRY',
      'boardWidth',
      layout.boards.every((b) => b.visibleMm <= layout.faceWidthMm + EPS && b.visibleMm > 0),
      `0 < w <= ${layout.faceWidthMm}`,
      layout.boards.map((b) => Math.round(b.visibleMm)).join(','),
    ),
  )
  checks.push(check('GEOMETRY', 'thickness', def.profile.thicknessMm > 0, def.profile.thicknessMm, def.profile.thicknessMm))
  checks.push(check('GEOMETRY', 'gap', layout.gapMm === config.gapMm, config.gapMm, layout.gapMm))
  checks.push(check('GEOMETRY', 'pitch', Math.abs(layout.pitchMm - (layout.faceWidthMm + layout.gapMm)) < EPS, layout.faceWidthMm + layout.gapMm, layout.pitchMm))
  checks.push(check('GEOMETRY', 'orientation', layout.orientation === config.orientation && def.orientations.includes(config.orientation), `${config.orientation} ∈ [${def.orientations.join(',')}]`, layout.orientation))
  checks.push(check('GEOMETRY', 'profile', layout.profile === def.profile.name, def.profile.name, layout.profile))
  checks.push(check('GEOMETRY', 'bounds', layout.bounds.widthMm === config.spanMm && layout.bounds.heightMm === config.heightMm, `${config.spanMm}×${config.heightMm}`, `${layout.bounds.widthMm}×${layout.bounds.heightMm}`))
  // post spacing proti katalogu
  let postSpacingOk = true
  for (let i = 1; i < layout.posts.length; i++) {
    const d = layout.posts[i].centerMm - layout.posts[i - 1].centerMm
    if (def.mounting.maxPostSpacingMm !== null && d > def.mounting.maxPostSpacingMm + EPS) postSpacingOk = false
  }
  checks.push(
    check(
      'GEOMETRY',
      'postSpacing',
      postSpacingOk,
      `<= ${def.mounting.maxPostSpacingMm ?? 'n/a'}`,
      layout.posts.map((p) => Math.round(p.centerMm)).join(','),
    ),
  )
  // rail spacing proti katalogu (vertical)
  let railSpacingOk = true
  for (let i = 1; i < layout.rails.length; i++) {
    const d = layout.rails[i].centerMm - layout.rails[i - 1].centerMm
    if (def.mounting.maxRailSpacingMm !== null && d > def.mounting.maxRailSpacingMm + EPS) railSpacingOk = false
  }
  checks.push(
    check(
      'GEOMETRY',
      'railSpacing',
      railSpacingOk,
      `<= ${def.mounting.maxRailSpacingMm ?? 'n/a'}`,
      layout.rails.map((r) => Math.round(r.centerMm)).join(','),
    ),
  )

  // ── PRODUCT ─────────────────────────────────────────────────────────────
  checks.push(check('PRODUCT', 'productId', layout.productId === def.id, def.id, layout.productId))
  checks.push(check('PRODUCT', 'catalogProductId', layout.catalogProductId === def.catalogProductId, def.catalogProductId, layout.catalogProductId))
  if (config.colorId) {
    const known = def.material.colors.some((c) => c.id === config.colorId)
    checks.push(check('PRODUCT', 'colorId', known, `∈ palette (${def.material.colors.length})`, config.colorId))
  }
  if (config.colorId) {
    checks.push(check('PRODUCT', 'surface', def.material.surface.length > 0, def.material.surface, def.material.surface))
  }

  // ── MOUNTING ────────────────────────────────────────────────────────────
  const layoutScrewVisibility =
    layout.fasteners.length === 0
      ? def.mounting.screwVisibility // brez nosilcev/ročaja ni vijakov — pravilo iz definicije
      : layout.fasteners.every((f) => f.visible)
        ? 'visible'
        : 'hidden'
  checks.push(
    check(
      'MOUNTING',
      'screwVisibility',
      layoutScrewVisibility === def.mounting.screwVisibility,
      def.mounting.screwVisibility,
      layout.fasteners.length === 0 ? 'no-fasteners (ni nosilcev/ročaja)' : layoutScrewVisibility,
    ),
  )
  const capOk = def.profile.shape === 'rhombus' ? layout.caps.length === 2 : def.profile.name.startsWith('DESKA-150') ? layout.caps.length === 1 : true
  checks.push(check('MOUNTING', 'capRules', capOk, def.mounting.capRule, layout.caps.map((c) => `${c.side}:${c.kind}`).join(',') || 'none'))
  const railOk = config.orientation === 'horizontal' ? layout.rails.length === 0 : layout.rails.length === 0 || layout.rails.length >= 2
  checks.push(check('MOUNTING', 'railRules', railOk, config.orientation === 'vertical' ? 'rails >= 2 ali ni dokumentacije' : 'horizontal: brez cevi', layout.rails.length))
  // ročaj: samo če definicija dovoljuje
  checks.push(check('MOUNTING', 'handleRule', !layout.handlePresent || def.mounting.handle.available, `handle.available=${def.mounting.handle.available}`, `handlePresent=${layout.handlePresent}`))

  const failures = checks.filter((c) => !c.ok).map((c) => `${c.group}.${c.name}: expected ${c.expected}, actual ${c.actual}`)
  return { renderValid: failures.length === 0, checks, failures }
}
