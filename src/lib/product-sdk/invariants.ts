/**
 * PRODUCT SDK — PRODUCT IDENTITY INVARIANTS (runda S+8 §8; S+8.1 §5/§6/§7/§8).
 *
 * Za vsak render se avtomatsko preveri:
 *   GEOMETRY: board count, board width/thickness, gap, pitch, orientation,
 *             profile, bounds konsistentnost, POST validacija (bounds,
 *             monotonija, duplikati, orientacijski max razmak — S+8.1),
 *             RAIL validacija (bounds, monotonija, max, vertical-only),
 *             BOARD invariants (index/start/visible/gap/boardCount — S+8.1 §7)
 *   PRODUCT:  selected product ID, selected profile, selected color,
 *             selected surface
 *   MOUNTING: screw visibility, cap rules, rail rules, handle rule
 *
 * Post spacing se preverja proti ORIENTACIJSKO-SPECIFIČNEMU pravilu (S+8.1 §2)
 * — ne več proti zrušeni eni številki.
 *
 * Če KATERA koli invarianta pade → renderValid = false in rezultat se NE
 * sme prikazati kot validen produkt (spec §8).
 */
import type { FenceConfiguration, FenceLayout, InvariantCheck, InvariantReport, ProductDefinition } from './types'
import { resolveMaxPostSpacingMm, resolveMaxRailSpacingMm } from './rules'

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
  checks.push(check('GEOMETRY', 'boardArray', layout.boards.length === layout.boardCount, layout.boardCount, layout.boards.length))
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

  // S+8.1 §8: bounds ↔ fenceWidth/fenceHeight/fieldSpan konsistentnost.
  const boundsConsistent =
    layout.fenceWidthMm === layout.bounds.widthMm &&
    layout.fenceHeightMm === layout.bounds.heightMm &&
    layout.fieldSpanMm === (layout.orientation === 'horizontal' ? layout.fieldHeightMm : layout.fenceWidthMm)
  checks.push(
    check(
      'GEOMETRY',
      'boundsConsistency',
      boundsConsistent,
      `fenceW=${layout.bounds.widthMm} fenceH=${layout.bounds.heightMm} span=${layout.orientation === 'horizontal' ? 'fieldH' : 'fenceW'}`,
      `fenceW=${layout.fenceWidthMm} fenceH=${layout.fenceHeightMm} span=${layout.fieldSpanMm}`,
    ),
  )

  // ── S+8.1 §7: POLNE BOARD INVARIANTS ────────────────────────────────────
  const indexesUnique = new Set(layout.boards.map((b) => b.index)).size === layout.boards.length
  const expectedIndexes = layout.boards.every((b, i) => b.index === i)
  checks.push(check('GEOMETRY', 'boardIndexes', indexesUnique && expectedIndexes, 'unikatni, 0..n-1 v vrsti', layout.boards.map((b) => b.index).join(',')))
  const boardsValid = layout.boards.every(
    (b) => b.startMm >= -EPS && b.visibleMm > 0 && b.startMm + b.visibleMm <= layout.fieldSpanMm + EPS,
  )
  checks.push(check('GEOMETRY', 'boardPlacement', boardsValid, `start>=0 ∧ 0<visible ∧ start+visible<=${layout.fieldSpanMm}`, boardsValid ? 'ok' : 'kršeno'))
  // Zaporedna vrzel == gapMm, razen dovoljenega terminal/cut primera (zadnja deska).
  let consecutiveOk = true
  for (let i = 1; i < layout.boards.length; i++) {
    const cur = layout.boards[i - 1]
    const next = layout.boards[i]
    const gap = next.startMm - (cur.startMm + cur.visibleMm)
    if (Math.abs(gap - layout.gapMm) > EPS) consecutiveOk = false
  }
  checks.push(
    check(
      'GEOMETRY',
      'boardGaps',
      consecutiveOk,
      `gap=${layout.gapMm} med vsemi zaporednimi deskami`,
      layout.boards.length >= 2 ? (consecutiveOk ? 'ok' : 'kršeno') : 'single-board',
    ),
  )
  const lastBoard = layout.boards[layout.boards.length - 1]
  const lastWithin = lastBoard ? lastBoard.startMm + lastBoard.visibleMm <= layout.fieldSpanMm + EPS : true
  checks.push(check('GEOMETRY', 'lastBoardWithin', lastWithin, `<= ${layout.fieldSpanMm}`, lastBoard ? Math.round(lastBoard.startMm + lastBoard.visibleMm) : 'n/a'))

  // ── S+8.1 §2/§5: POST VALIDACIJA (orientacijsko-specifičen max) ─────────
  const postMax = resolveMaxPostSpacingMm(def, config, layout.fenceHeightMm)
  const postBoundsOk = layout.posts.every((p) => Number.isFinite(p.centerMm) && p.centerMm >= -EPS && p.centerMm <= layout.bounds.widthMm + EPS)
  const postMonotonicOk = layout.posts.every((p, i) => i === 0 || p.centerMm > layout.posts[i - 1].centerMm + EPS)
  let postSpacingOk = true
  for (let i = 1; i < layout.posts.length; i++) {
    const d = layout.posts[i].centerMm - layout.posts[i - 1].centerMm
    if (postMax !== null && d > postMax + EPS) postSpacingOk = false
  }
  checks.push(
    check(
      'GEOMETRY',
      'postBounds',
      postBoundsOk,
      `0 ≤ center ≤ ${layout.bounds.widthMm}`,
      layout.posts.map((p) => Math.round(p.centerMm)).join(',') || 'no-posts',
    ),
  )
  checks.push(
    check(
      'GEOMETRY',
      'postMonotonic',
      postMonotonicOk,
      'strogo naraščajoče, brez duplikatov',
      layout.posts.map((p) => Math.round(p.centerMm)).join(',') || 'no-posts',
    ),
  )
  checks.push(
    check(
      'GEOMETRY',
      'postSpacing',
      postSpacingOk,
      `<= ${postMax ?? 'n/a'} (${config.orientation}, S+8.1 orientacijsko pravilo)`,
      layout.posts.map((p) => Math.round(p.centerMm)).join(',') || 'no-posts',
    ),
  )

  // ── S+8.1 §6: RAIL VALIDACIJA ───────────────────────────────────────────
  const railMax = resolveMaxRailSpacingMm(def, layout.orientation)
  const railBoundsOk = layout.rails.every((r) => Number.isFinite(r.centerMm) && r.centerMm >= -EPS && r.centerMm <= layout.fieldHeightMm + EPS)
  const railMonotonicOk = layout.rails.every((r, i) => i === 0 || r.centerMm > layout.rails[i - 1].centerMm + EPS)
  let railSpacingOk = true
  for (let i = 1; i < layout.rails.length; i++) {
    const d = layout.rails[i].centerMm - layout.rails[i - 1].centerMm
    if (railMax !== null && d > railMax + EPS) railSpacingOk = false
  }
  checks.push(
    check(
      'GEOMETRY',
      'railBounds',
      railBoundsOk,
      `0 ≤ center ≤ ${layout.fieldHeightMm}`,
      layout.rails.map((r) => Math.round(r.centerMm)).join(',') || 'no-rails',
    ),
  )
  checks.push(
    check(
      'GEOMETRY',
      'railMonotonic',
      railMonotonicOk,
      'strogo naraščajoče, brez duplikatov',
      layout.rails.map((r) => Math.round(r.centerMm)).join(',') || 'no-rails',
    ),
  )
  checks.push(
    check(
      'GEOMETRY',
      'railSpacing',
      railSpacingOk,
      `<= ${railMax ?? 'n/a'}`,
      layout.rails.map((r) => Math.round(r.centerMm)).join(',') || 'no-rails',
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
  // S+8.1 §6: cevi obstajajo IZKLJUČNO pri vertical; pri vertical jih je ≥2 ali 0 (ni dokumentacije).
  const railOk = layout.orientation === 'vertical' ? layout.rails.length === 0 || layout.rails.length >= 2 : layout.rails.length === 0
  checks.push(check('MOUNTING', 'railRules', railOk, layout.orientation === 'vertical' ? 'vertical: rails ≥ 2 ali ni dokumentacije' : 'horizontal: brez cevi', layout.rails.length))
  // ročaj: samo če definicija dovoljuje
  checks.push(check('MOUNTING', 'handleRule', !layout.handlePresent || def.mounting.handle.available, `handle.available=${def.mounting.handle.available}`, `handlePresent=${layout.handlePresent}`))

  const failures = checks.filter((c) => !c.ok).map((c) => `${c.group}.${c.name}: expected ${c.expected}, actual ${c.actual}`)
  return { renderValid: failures.length === 0, checks, failures }
}
