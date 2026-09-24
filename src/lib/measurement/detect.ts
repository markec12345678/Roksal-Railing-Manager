/**
 * MEASUREMENT SDK (issue #2) — samodejna detekcija ograje (brez AI).
 *
 * Cevovod: siva → downscale → Sobel → Otsu robovi → dilacija → Hough →
 * horizontalni prekni (runs) + vertikalni stebri + kotniki.
 * Vse objektivno merljivo; nikoli ne ugiba merila ali dimenzij.
 * Algoritmi + pragi: docs/AUTOMATIC-DETECTION.md.
 */
import { MEASUREMENT_CONSTANTS } from './types'
import type {
  DetectedFeatures,
  DetectInput,
  MeasurementQualityMetrics,
  NormLine,
  NormPoint,
} from './types'
import {
  edgesFromGradient,
  dilate1,
  houghPeaks,
  houghTransform,
  mergeNearbyPositions,
  projectLineExtent,
  sobel,
  toWorkGray,
  type GrayImage,
} from './cv'

interface WorkFrame {
  gray: GrayImage
  bin: Uint8Array
  w: number
  h: number
}

/** Pripravi delovni frame (gray + binarni robovi). */
function prepareFrames(input: DetectInput): WorkFrame[] {
  return input.frames.slice(0, MEASUREMENT_CONSTANTS.maxFrames).map((f) => {
    const gray = toWorkGray({ data: f.data, w: f.w, h: f.h })
    const grad = sobel(gray)
    const bin = dilate1(edgesFromGradient(grad), gray.w, gray.h)
    return { gray, bin, w: gray.w, h: gray.h }
  })
}

/** Struktura ene analizirane slike (pred združitvijo frame-ov). */
interface FrameAnalysis {
  horizontals: NormLine[]
  verticals: NormLine[]
  edgeDensity: number
}

/** Analiza enega delovnega frame-a. */
function analyzeFrame(f: WorkFrame): FrameAnalysis {
  const { bin, w, h } = f
  let edgeCount = 0
  for (let i = 0; i < bin.length; i++) if (bin[i]) edgeCount++
  const edgeDensity = edgeCount / bin.length

  const hs = houghTransform(bin, w, h, 1)
  let maxVotes = 0
  for (let i = 0; i < hs.acc.length; i++) maxVotes = Math.max(maxVotes, hs.acc[i])
  if (maxVotes === 0) return { horizontals: [], verticals: [], edgeDensity }

  const peaks = houghPeaks(hs, Math.max(6, Math.round(maxVotes * 0.15)), MEASUREMENT_CONSTANTS.maxHoughPeaks)

  // klasifikacija: θ≈90° → horizontalna črta (y=const), θ≈0°/180° → vertikalna
  const horizontals: NormLine[] = []
  const verticals: NormLine[] = []
  for (const p of peaks) {
    const thDeg = (p.thetaIdx * 180) / hs.thetaBins
    const isHorizontal = Math.abs(thDeg - 90) <= 12
    const isVertical = thDeg <= 12 || thDeg >= 168
    if (!isHorizontal && !isVertical) continue
    const ext = projectLineExtent(
      bin, w, h, p.thetaIdx, p.rhoIdx, hs,
      isHorizontal ? 'horizontal' : 'vertical',
    )
    if (!ext) continue
    const len = ext.to - ext.from + 1
    const minLen = (isHorizontal ? w : h) * 0.15
    if (len < minLen) continue // prekratka črta — šum
    if (ext.maxGapPx > len * MEASUREMENT_CONSTANTS.maxLineGapFraction) continue
    const line: NormLine = {
      pos: (p.rhoIdx - hs.rhoOffset) / (isHorizontal ? h : w),
      from: ext.from / (isHorizontal ? w : h),
      to: ext.to / (isHorizontal ? w : h),
      support: p.votes / maxVotes,
      coverage: ext.coverage,
    }
    if (ext.coverage < MEASUREMENT_CONSTANTS.minLineCoverage) continue
    // črta mora dejansko biti v sliki (t≈180° reprezentanta iste črte ima
    // negativni ρ → izven [0,1] → zavrži, da ne onesnaži združevanja)
    if (line.pos < -0.05 || line.pos > 1.05) continue
    if (isHorizontal) horizontals.push(line)
    else verticals.push(line)
  }
  return { horizontals, verticals, edgeDensity }
}

/** Združi bliznje horizontalne črte (isti rob ograje) — uteženo po podpori. */
function mergeHorizontalLines(lines: NormLine[], tol: number): NormLine[] {
  const sorted = [...lines].sort((a, b) => a.pos - b.pos)
  const groups: NormLine[][] = []
  for (const l of sorted) {
    const g = groups[groups.length - 1]
    if (g && l.pos - g[g.length - 1].pos <= tol) g.push(l)
    else groups.push([l])
  }
  return groups.map((g) => {
    let wsum = 0
    let vsum = 0 // VSOTA uteži (pravilno uteženo povprečje, ne deljenje z max!)
    let support = 0
    let from = 1
    let to = 0
    let coverage = 0
    for (const l of g) {
      wsum += l.pos * l.support
      vsum += l.support
      support = Math.max(support, l.support)
      from = Math.min(from, l.from)
      to = Math.max(to, l.to)
      coverage = Math.max(coverage, l.coverage)
    }
    const pos = vsum > 0 ? wsum / vsum : g[0].pos
    return { pos, from, to, support, coverage }
  })
}

/** Analiza vseh frame-ov + normalizacija značilk (issue #2 §1). */
export function detectFeatures(input: DetectInput): {
  features: DetectedFeatures | null
  metrics: MeasurementQualityMetrics
} {
  const frames = prepareFrames(input)
  if (frames.length === 0) {
    return {
      features: null,
      metrics: emptyMetrics(0),
    }
  }

  const analyses = frames.map(analyzeFrame)
  const edgeDensity = analyses.reduce((s, a) => s + a.edgeDensity, 0) / analyses.length

  // časovna stabilnost: povprečni |Δ pos| najboljših dveh horizontalnih črt
  let temporalStability = 1
  if (frames.length > 1) {
    let drift = 0
    let n = 0
    for (let i = 1; i < analyses.length; i++) {
      const a = topLine(analyses[i - 1].horizontals)
      const b = topLine(analyses[i].horizontals)
      if (a && b) {
        drift += Math.abs(a.pos - b.pos)
        n++
      }
    }
    temporalStability = n > 0 ? Math.max(0, 1 - drift / n / 0.05) : 0
  }

  // združi horizontalne črte čez frame-e (istost po pos znotraj tol)
  const allH = analyses.flatMap((a) => a.horizontals)
  const allV = analyses.flatMap((a) => a.verticals)
  const maxSupport = allH.reduce((m, l) => Math.max(m, l.support), 0)
  const hTol = 3 / frames[0].h // 3 px v delovnem prostoru
  const mergedH = mergeHorizontalLines(allH, hTol)
    .filter((l) => l.support >= 0.35)
    .map((l) => ({ ...l, support: maxSupport > 0 ? l.support / maxSupport : l.support }))

  // glavni pas: para zgornja+spodnja z največjo skupno podporo in ločevanjem ≥ min
  const minBand = MEASUREMENT_CONSTANTS.minRailBandFraction
  let bestPair: { top: NormLine; bottom: NormLine } | null = null
  let bestScore = 0
  for (const top of mergedH) {
    for (const bottom of mergedH) {
      if (bottom.pos - top.pos < minBand) continue
      const score = top.support + bottom.support + (top.coverage + bottom.coverage) / 2
      if (score > bestScore) {
        bestScore = score
        bestPair = { top, bottom }
      }
    }
  }

  if (!bestPair) {
    return { features: null, metrics: { ...emptyMetrics(frames.length), edgeDensity, temporalStability } }
  }

  // vertikalni stebri znotraj pasu [top+10 %, bottom−10 %] — trdnost strukture
  const yTopPx = bestPair.top.pos * frames[0].h
  const yBottomPx = bestPair.bottom.pos * frames[0].h
  const bandTop = yTopPx + (yBottomPx - yTopPx) * 0.1
  const bandBottom = yBottomPx - (yBottomPx - yTopPx) * 0.1
  const bandHeight = Math.max(1, bandBottom - bandTop)
  const postsRaw: Array<{ pos: number; votes: number }> = []
  for (const v of allV) {
    const xPx = v.pos * frames[0].w
    // črta mora seči v pas (obseg prekriva vsaj 60 % pasu)
    const fromPx = v.from * frames[0].h
    const toPx = v.to * frames[0].h
    const overlap =
      Math.min(toPx, bandBottom) - Math.max(fromPx, bandTop)
    if (overlap < bandHeight * 0.6) continue
    // delovni prostor v PX (toleranca združevanja je v px)
    postsRaw.push({ pos: xPx, votes: v.support })
  }
  const mergedPostsPx = mergeNearbyPositions(postsRaw, MEASUREMENT_CONSTANTS.postMergeTolerancePx)
  const mergedPosts = mergedPostsPx.map((p) => ({ pos: p.pos / frames[0].w, votes: p.votes }))

  // post spacing consistency: 1 − normalizirana std razmakov
  let postSpacingConsistency = 1
  if (mergedPosts.length >= 3) {
    const gaps: number[] = []
    for (let i = 1; i < mergedPosts.length; i++) gaps.push(mergedPosts[i].pos - mergedPosts[i - 1].pos)
    const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length
    const variance = gaps.reduce((s, g) => s + (g - mean) * (g - mean), 0) / gaps.length
    const std = Math.sqrt(variance)
    postSpacingConsistency = mean > 0 ? Math.max(0, 1 - std / mean) : 0
  }

  // run glavnega para
  const x0 = Math.min(bestPair.top.from, bestPair.bottom.from)
  const x1 = Math.max(bestPair.top.to, bestPair.bottom.to)
  const run = {
    yTop: bestPair.top.pos,
    yBottom: bestPair.bottom.pos,
    x0,
    x1,
    supportTop: bestPair.top.support,
    supportBottom: bestPair.bottom.support,
  }

  const corners: [NormPoint, NormPoint, NormPoint, NormPoint] = [
    { x: x0, y: run.yTop },
    { x: x1, y: run.yTop },
    { x: x1, y: run.yBottom },
    { x: x0, y: run.yBottom },
  ]

  const features: DetectedFeatures = {
    runs: [run],
    posts: mergedPosts
      .filter((p) => p.pos > x0 - 0.02 && p.pos < x1 + 0.02)
      .map((p) => ({ x: p.pos, support: p.votes })),
    corners,
  }

  const lineCoverage = (bestPair.top.coverage + bestPair.bottom.coverage) / 2
  const metrics: MeasurementQualityMetrics = {
    edgeDensity,
    lineSupportTop: bestPair.top.support,
    lineSupportBottom: bestPair.bottom.support,
    lineCoverage,
    postSpacingConsistency,
    temporalStability,
    frames: frames.length,
  }
  return { features, metrics }
}

function topLine(lines: NormLine[]): NormLine | null {
  if (lines.length === 0) return null
  return lines.reduce((b, l) => (l.support > b.support ? l : b))
}

function emptyMetrics(frames: number): MeasurementQualityMetrics {
  return {
    edgeDensity: 0,
    lineSupportTop: 0,
    lineSupportBottom: 0,
    lineCoverage: 0,
    postSpacingConsistency: 1,
    temporalStability: 1,
    frames,
  }
}
