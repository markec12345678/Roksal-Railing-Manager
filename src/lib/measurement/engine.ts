/**
 * MEASUREMENT SDK (issue #2) — merilni motor (Measurement Engine).
 *
 * Skupni podatkovni model za SAMODEJNO in ROČNO meritev (issue #2 §3):
 *   features (zaznane/ročne točke) + scale (referenca) → MeasurementSession
 *   s stanjem kakovosti, metrikami, vodenjem (guidance) in — SAMO ob
 *   veljavnem merilu — izmerjeno geometrijo z izvorom in negotovostjo.
 *
 * Determinizem: enak vhod → enak izhod (100× test: sha256 identično).
 */
import { MEASUREMENT_CONSTANTS } from './types'
import type {
  DetectedFeatures,
  MeasurementQualityMetrics,
  MeasurementQualityState,
  MeasurementSession,
  MeasurementSource,
  MeasuredGeometry,
  MeasuredSegment,
  NormPoint,
  ScaleReference,
} from './types'
import { resolveScale } from './scale'
import { detectFeatures } from './detect'

/** Ročno podana geometrija (ročni način / popravki) — normalizirano. */
export interface ManualGeometryInput {
  /** sekvenca prelomov balkona (raven = 2 točki, L/U = 3+); vsaj 2 */
  path: NormPoint[]
  /** zgornja linija ograje pri vsakem prelomu (iste mere kot path) */
  top: NormPoint[]
  /** vertikalni stebri (normalizirani x) — opcijsko */
  posts?: NormPoint[]
}

export interface BuildSessionInput {
  sessionId: string
  source: MeasurementSource
  /** samodejna detekcija (iz detectFeatures) ali null pri čisto ročnem vhodu */
  detected: {
    features: DetectedFeatures | null
    metrics: MeasurementQualityMetrics
  } | null
  /** ročna geometrija (ročni način ali popravki samodejne) ali null */
  manual?: ManualGeometryInput | null
  /** referenca za merilo — brez nje NI dimenzij */
  reference: ScaleReference | null
  /** število ročnih popravk (sledljivost) */
  manualCorrections?: number
  /** uporabnik je potrdil meritve (iz USER_REVIEW_REQUIRED → VERIFIED) */
  confirmed?: boolean
}

export class MeasurementValidationError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'MeasurementValidationError'
    this.code = code
  }
}

/** Zgrad seja iz vhoda — deterministično, brez stranskih učinkov. */
export function buildSession(input: BuildSessionInput): MeasurementSession {
  if (!input.sessionId || input.sessionId.length > 128) {
    throw new MeasurementValidationError('SESSION_ID', 'sessionId je obvezen (1..128 znakov).')
  }
  const manualCorrections = Math.max(0, Math.floor(input.manualCorrections ?? 0))
  const hasManual = input.manual !== null && input.manual !== undefined

  // ── Značilke + metrike ───────────────────────────────────────────────────
  let features: DetectedFeatures | null = null
  let metrics: MeasurementQualityMetrics = {
    edgeDensity: 0,
    lineSupportTop: 0,
    lineSupportBottom: 0,
    lineCoverage: 0,
    postSpacingConsistency: 1,
    temporalStability: 1,
    frames: 0,
  }

  if (input.detected) {
    features = input.detected.features
    metrics = input.detected.metrics
  }

  // ── Geometrija v normaliziranih enotah (iz detekcije ali ročnega vhoda) ──
  // En sam kanal za OBA načina → ista geometrija (issue #2 acceptance).
  // legMm je DOLŽINA NOGE (hypot) — pravilno za raven, L in U tloris.
  let runs: Array<{ x0: number; x1: number; yTop: number; yBottom: number; legUnits: number }> = []
  let postsX: number[] = []

  if (hasManual && input.manual) {
    const m = input.manual
    validateManual(m)
    // path = prelomi spodnje linije; top = zgornja linija (isti indeksi);
    // vsaka noga = razdalja med zaporednima točkama (hypot) × merilo.
    for (let i = 0; i < m.path.length - 1; i++) {
      const a = m.path[i]
      const b = m.path[i + 1]
      runs.push({
        x0: Math.min(a.x, b.x),
        x1: Math.max(a.x, b.x),
        yTop: Math.min(m.top[i].y, m.top[i + 1].y),
        yBottom: Math.max(a.y, b.y),
        legUnits: Math.hypot(b.x - a.x, b.y - a.y),
      })
    }
    postsX = (m.posts ?? []).map((p) => p.x).sort((a, b) => a - b)
    if (features === null) {
      // čisto ročni način: značilke so uporabniške točke (sledljivost)
      features = {
        runs: runs.map((r) => ({
          yTop: r.yTop,
          yBottom: r.yBottom,
          x0: r.x0,
          x1: r.x1,
          supportTop: 0,
          supportBottom: 0,
        })),
        posts: postsX.map((x) => ({ x, support: 0 })),
        corners: runs.length > 0
          ? [
              { x: runs[0].x0, y: runs[0].yTop },
              { x: runs[0].x1, y: runs[0].yTop },
              { x: runs[0].x1, y: runs[0].yBottom },
              { x: runs[0].x0, y: runs[0].yBottom },
            ]
          : null,
      }
    }
  } else if (features && features.runs.length > 0) {
    // samodejni način: run = horizontalni odsek (ista y) → noga = x-razpon
    runs = features.runs.map((r) => ({
      x0: r.x0,
      x1: r.x1,
      yTop: r.yTop,
      yBottom: r.yBottom,
      legUnits: Math.abs(r.x1 - r.x0),
    }))
    postsX = features.posts.map((p) => p.x)
  }

  // ── Merilo ───────────────────────────────────────────────────────────────
  const scaleResult = resolveScale(input.reference)
  const scale = scaleResult.scale

  // ── Stanje kakovosti (issue #2 §4) ───────────────────────────────────────
  const hasStructure = runs.length > 0
  let state: MeasurementQualityState
  if (!hasStructure) {
    state = 'INSUFFICIENT_DATA'
  } else if (!scale) {
    state = hasManual ? 'SCALE_REQUIRED' : 'SCALE_REQUIRED'
  } else if (hasManual && !input.confirmed && manualCorrections > 0) {
    state = 'USER_REVIEW_REQUIRED'
  } else if (input.confirmed) {
    state = 'VERIFIED'
  } else if (hasManual && manualCorrections > 0) {
    state = 'USER_REVIEW_REQUIRED'
  } else {
    state = 'MEASUREMENT_READY'
  }

  // ── Geometrija v mm — SAMO ob merilu (NI izmišljevanja) ──────────────────
  let geometry: MeasuredGeometry | null = null
  if (scale && hasStructure) {
    const s = scale.mmPerUnitX
    const sY = scale.mmPerUnitY
    const uncertainty = MEASUREMENT_CONSTANTS.detectionTolerancePx / MEASUREMENT_CONSTANTS.workMaxDim // enota normalizirana (≈1 px v delovnem prostoru)

    // segmenti po vrstnem redu nog (hypot dolžina × merilo)
    const segments: MeasuredSegment[] = []
    let start = 0
    for (let i = 0; i < runs.length; i++) {
      const lenMm = runs[i].legUnits * s
      segments.push({
        index: i,
        lengthMm: round2(lenMm),
        uncertaintyMm: round2(2 * uncertainty * s),
        startMm: round2(start),
        source: input.source,
      })
      start += lenMm
    }

    const totalMm = segments.reduce((sum, seg) => sum + seg.lengthMm, 0)
    const heightMm = Math.abs(
      (Math.max(...runs.map((r) => r.yBottom)) - Math.min(...runs.map((r) => r.yTop))) * sY,
    )

    // položaji stebrov v mm od začetka (glede na najmanjši x0 vseh runov)
    const originX = Math.min(...runs.map((r) => r.x0))
    const postPositionsMm = postsX.map((x) => round2((x - originX) * s))

    geometry = {
      totalLengthMm: {
        valueMm: round2(totalMm),
        uncertaintyMm: round2(segments.length * 2 * uncertainty * s),
        source: input.source,
        provenance:
          input.source === 'automatic'
            ? `detekcija (Hough runs × merilo iz ${scale.reference.kind})`
            : `ročne točke × merilo iz ${scale.reference.kind}`,
      },
      heightMm: {
        valueMm: round2(heightMm),
        uncertaintyMm: round2(2 * uncertainty * sY),
        source: input.source,
        provenance: `liniji top/bottom × merilo iz ${scale.reference.kind}`,
      },
      segments,
      postCount: postsX.length,
      postPositionsMm,
      postSpacingConsistency: metrics.postSpacingConsistency,
      source: input.source,
    }
  }

  // ── Vodenje (guidance) — kaj VIDI, kaj MANJKA, kaj NEXT (issue #2 §1) ────
  const guidance = buildGuidance(state, runs.length, postsX.length, scaleResult.reason)

  return {
    version: 1,
    sessionId: input.sessionId,
    source: input.source,
    features,
    scale,
    quality: {
      state,
      metrics: { ...metrics, frames: input.detected ? metrics.frames : 0 },
      guidance,
      manualCorrections,
    },
    geometry,
  }
}

/** Vodenje po issue #2 (fail-safe besedila). */
function buildGuidance(
  state: MeasurementQualityState,
  runCount: number,
  postCount: number,
  scaleReason: string | null,
): { seen: string; missing: string | null; nextAction: string } {
  switch (state) {
    case 'INSUFFICIENT_DATA':
      return {
        seen: 'Ograje ni bilo mogoče zaznati (premalo robov/črt).',
        missing: 'Jasna silhueta ograje (zgornja in spodnja linija).',
        nextAction:
          'Fotografirajte ograjo frontalno pri dobri svetlobi ali preklopite na ročno meritev.',
      }
    case 'DETECTED':
    case 'SCALE_REQUIRED':
      return {
        seen:
          runCount > 0
            ? `Ograja zaznana (${runCount} odsek${runCount > 1 ? 'i' : ''}, ${postCount} stebrov).`
            : 'Struktura zaznana.',
        missing: 'Absolutno merilo.',
        nextAction:
          scaleReason ??
          'Označite znano dolžino (2 točki + mm), da sistem izračuna vse dimenzije.',
      }
    case 'MEASUREMENT_READY':
      return {
        seen: `Merilo določeno, geometrija izmerjena (${runCount} odsekov, ${postCount} stebrov).`,
        missing: null,
        nextAction: 'Preverite vrednosti in potrdite meritev.',
      }
    case 'USER_REVIEW_REQUIRED':
      return {
        seen: 'Zaznana geometrija je bila ročno popravljena.',
        missing: 'Potrditev uporabnika.',
        nextAction: 'Preverite popravljene točke in potrdite meritev.',
      }
    case 'VERIFIED':
      return {
        seen: 'Meritev potrjena s strani uporabnika.',
        missing: null,
        nextAction: 'Geometrija je pripravljena za postavitev ograje in BOM.',
      }
  }
}

function validateManual(m: ManualGeometryInput): void {
  if (!Array.isArray(m.path) || m.path.length < 2) {
    throw new MeasurementValidationError('MANUAL_PATH', 'Ročna geometrija zahteva vsaj 2 točki (path).')
  }
  if (!Array.isArray(m.top) || m.top.length !== m.path.length) {
    throw new MeasurementValidationError('MANUAL_TOP', 'top mora imeti enako število točk kot path.')
  }
  const all = [...m.path, ...m.top, ...(m.posts ?? [])]
  for (const p of all) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      throw new MeasurementValidationError('MANUAL_POINT', 'Točke morajo biti finite.')
    }
    if (p.x < -0.05 || p.x > 1.05 || p.y < -0.05 || p.y > 1.05) {
      throw new MeasurementValidationError('MANUAL_POINT', 'Točke so izven slike (normalizirano 0..1 ± 0.05).')
    }
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}
