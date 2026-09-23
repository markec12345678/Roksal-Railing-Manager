/**
 * VIZ (Vizualizacija ograje) — shared types. Round S+2.
 * Single source of truth: docs/VIZ_CONTRACTS.md
 * Written by orchestrator — do NOT edit without updating contracts.
 */

/** 4 corners, order TL, TR, BR, BL. Pixels: [x,y]; Normalized: fractions 0..1 */
export type Corners = [[number, number], [number, number], [number, number], [number, number]]

/** Raw RGBA image buffer (8-bit per channel, 4 channels, row-major). */
export interface ImageBuffer {
  data: Uint8ClampedArray // RGBA, length = w * h * 4
  w: number
  h: number
}

/** placement.json — normalized (screen-size independent) placement. */
export interface VizPlacement {
  version: 2
  /** TL, TR, BR, BL — fractions of original image width/height */
  corners: Corners
  /** degrees, extra user rotation (0 | 90 | 180 | 270), applied before corners */
  rotation: number
  /** uniform scale hint (1 = as-fitted) */
  scale: number
  /** fence plane inside PRODUCT photo, normalized to product dims; null = auto bbox of cutout */
  productQuad: Corners | null
}

/** Per-step + summary metrics — evidence (identity, preservation, RAL guard, speed). */
export interface PipelineMetrics {
  timeMs: number
  steps: Record<string, number>
  /** letvice (rail) count in rectified space — identity proof */
  letviceProduct: number
  letviceResult: number
  letviceIdentityOk: boolean
  /** original preservation outside mask (sum |ΔRGB| per pixel) */
  outsideMax: number
  outsideMean: number
  /** same, measured before contact shadow (target 0) */
  outsideMaxPreShadow: number
  /** RAL guard: mean a/b of product pixels before/after harmonization */
  chroma: {
    aBefore: number
    aAfter: number
    bBefore: number
    bAfter: number
    dE: number
  }
  /** illumination field strength actually applied (0..1 modulation) */
  harmonizeStrength: number
  alphaCoverage: number
}

export interface PipelineOptions {
  /** enable luminance-only harmonization (default true — RAL-safe) */
  harmonize?: boolean
  /** contact shadow under bottom edge (default true) */
  shadow?: boolean
  /** feather radius px for product blend (default 3) */
  feather?: number
}

export type VizStageKind = 'balcony' | 'product' | 'productMask' | 'mask'

export interface StageResult {
  token: string
  url: string
  w: number
  h: number
  bytes: number
}

export interface VizPreviewResponse {
  previewUrl: string
  metrics: PipelineMetrics
}

export interface VizVariant {
  label: string
  productPath: string
  productMaskPath?: string | null
  previewPath?: string | null
}

export interface VizProjectSummary {
  id: string
  name: string
  previewPath: string | null
  placement: VizPlacement
  createdAt: string
}

export interface VizProjectDetail extends VizProjectSummary {
  originalPath: string
  productPath: string
  productMaskPath: string | null
  maskPath: string
  resultPath: string | null
  resultImagePath: string | null
  variants: VizVariant[]
}

/** Denormalize normalized corner (0..1) to pixel coords for given dims. */
export function cornerToPx(c: Corners, w: number, h: number): Corners {
  return c.map(([x, y]) => [Math.round(x * w), Math.round(y * h)]) as Corners
}

/** Normalize pixel corner to 0..1 fractions. */
export function cornerToNorm(c: Corners, w: number, h: number): Corners {
  return c.map(([x, y]) => [x / w, y / h]) as Corners
}

/** Validate a normalized corners quad: within [0,1] (+tolerance), finite. */
export function isValidCorners(c: Corners): boolean {
  if (!Array.isArray(c) || c.length !== 4) return false
  for (const [x, y] of c) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false
    if (x < -0.05 || x > 1.05 || y < -0.05 || y > 1.05) return false
  }
  return true
}
