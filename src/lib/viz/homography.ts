/**
 * VIZ — homography (DLT) + inverse warping. Pure TypeScript, zero imports —
 * runs in browser and Node. Ported 1:1 from baseline/variant_a.py
 * (cv2.getPerspectiveTransform / cv2.warpPerspective semantics).
 *
 * H maps src -> dst, row-major 3x3: [h0 h1 h2; h3 h4 h5; h6 h7 h8], h8 = 1.
 * Forward point map:  u = (h0*x + h1*y + h2) / (h6*x + h7*y + 1)
 *                     v = (h3*x + h4*y + h5) / (h6*x + h7*y + 1)
 * Warping uses INVERSE mapping: for each output pixel we sample the source
 * through H^-1 with bilinear interpolation (same as cv2.warpPerspective).
 */
import type { Corners, ImageBuffer } from '@/lib/viz/types'

/** Solve the 8-parameter projective transform mapping src quad -> dst quad (DLT, Gaussian elimination). */
export function solveHomography(src: Corners, dst: Corners): number[] {
  // 8x8 linear system: for each (x,y)->(u,v):
  //   [x y 1 0 0 0 -ux -uy] h = u
  //   [0 0 0 x y 1 -vx -vy] h = v
  const A: number[][] = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i]
    const [u, v] = dst[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u])
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v])
  }
  const n = 8
  // Gaussian elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    let piv = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r
    }
    if (Math.abs(A[piv][col]) < 1e-12) {
      throw new Error('solveHomography: degenerate quad (singular system)')
    }
    if (piv !== col) {
      const tmp = A[piv]
      A[piv] = A[col]
      A[col] = tmp
    }
    const prow = A[col]
    const pval = prow[col]
    for (let r = col + 1; r < n; r++) {
      const row = A[r]
      const f = row[col] / pval
      if (f === 0) continue
      for (let c = col; c <= n; c++) row[c] -= f * prow[c]
    }
  }
  const h = new Array<number>(9)
  h[8] = 1
  for (let i = n - 1; i >= 0; i--) {
    let s = A[i][n]
    for (let j = i + 1; j < n; j++) s -= A[i][j] * h[j]
    h[i] = s / A[i][i]
  }
  // S+8.2 PORT (OgrajaVizija Homography.kt:81-98, proven better): corner
  // reprojection validation. Partial pivoting alone does NOT catch degenerate
  // quads (duplicate corner, collinear points) — the 8x8 system can be
  // non-singular yet inconsistent, silently producing an H that does not map
  // the corners (benchmark: reprojection error NaN @ commit 6641ca5). We verify
  // all 4 corners and fail fast, tolerance scaled to the quad diagonal.
  let diag = 0
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const dd = Math.hypot(dst[i][0] - dst[j][0], dst[i][1] - dst[j][1])
      if (dd > diag) diag = dd
    }
  }
  const tol = Math.max(1e-3, diag * 1e-6)
  for (let i = 0; i < 4; i++) {
    const [pu, pv] = applyHomography(h, src[i][0], src[i][1])
    const err = Math.max(Math.abs(pu - dst[i][0]), Math.abs(pv - dst[i][1]))
    if (!(err < tol)) {
      throw new Error(
        `solveHomography: degenerate quad (corner ${i} reprojects with error ${err.toExponential(3)} > tol ${tol.toExponential(3)})`,
      )
    }
  }
  return h
}

/** Inverse of a row-major 3x3 matrix (via adjugate / determinant). */
export function computeInverse(H: number[]): number[] {
  const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = H
  const c0 = h4 * h8 - h5 * h7
  const c1 = h5 * h6 - h3 * h8
  const c2 = h3 * h7 - h4 * h6
  const det = h0 * c0 + h1 * c1 + h2 * c2
  if (Math.abs(det) < 1e-14) throw new Error('computeInverse: singular matrix')
  const inv = 1 / det
  return [
    c0 * inv,
    (h2 * h7 - h1 * h8) * inv,
    (h1 * h5 - h2 * h4) * inv,
    c1 * inv,
    (h0 * h8 - h2 * h6) * inv,
    (h2 * h3 - h0 * h5) * inv,
    c2 * inv,
    (h1 * h6 - h0 * h7) * inv,
    (h0 * h4 - h1 * h3) * inv,
  ]
}

/**
 * Map a point (x,y) through a row-major 3x3 homography (projective divide).
 *
 * S+8.2 PORT (OgrajaVizija Homography.kt:19-26, proven better): the divider w is
 * clamped away from zero (|w| < 1e-12 → 1e-12). Before this guard a point on the
 * horizon line (w = 0) silently produced NaN/Infinity which propagated into
 * metrics/callers. For an exactly-on-horizon point the result is still a huge
 * finite value (point at infinity) — but never NaN.
 */
export function applyHomography(H: number[], x: number, y: number): [number, number] {
  const wRaw = H[6] * x + H[7] * y + H[8]
  const w = Math.abs(wRaw) < 1e-12 ? 1e-12 : wRaw
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w]
}

/**
 * Inverse-mapping warp of an RGBA ImageBuffer through H (src -> dst) into an
 * outW x outH buffer. Bilinear sampling; pixels outside the source become 0.
 * opts.alphaMode: treat source as a single-channel mask/alpha (sample the R
 * channel only) and write the value into R=G=B with A=255.
 */
export function warpImage(
  src: ImageBuffer,
  H: number[],
  outW: number,
  outH: number,
  opts?: { alphaMode?: boolean },
): ImageBuffer {
  const Hi = computeInverse(H)
  const sw = src.w
  const sh = src.h
  const s = src.data
  const out = new Uint8ClampedArray(outW * outH * 4)
  const alphaMode = opts?.alphaMode === true
  for (let y = 0; y < outH; y++) {
    const rowOut = y * outW
    for (let x = 0; x < outW; x++) {
      const w = Hi[6] * x + Hi[7] * y + Hi[8]
      const sx = (Hi[0] * x + Hi[1] * y + Hi[2]) / w
      const sy = (Hi[3] * x + Hi[4] * y + Hi[5]) / w
      const o = (rowOut + x) * 4
      if (!(sx >= 0 && sy >= 0 && sx <= sw - 1 && sy <= sh - 1)) continue // stays 0
      const x0 = sx | 0
      const y0 = sy | 0
      const x1 = x0 + 1 < sw ? x0 + 1 : sw - 1
      const y1 = y0 + 1 < sh ? y0 + 1 : sh - 1
      const fx = sx - x0
      const fy = sy - y0
      const w00 = (1 - fx) * (1 - fy)
      const w10 = fx * (1 - fy)
      const w01 = (1 - fx) * fy
      const w11 = fx * fy
      const i00 = (y0 * sw + x0) * 4
      const i10 = (y0 * sw + x1) * 4
      const i01 = (y1 * sw + x0) * 4
      const i11 = (y1 * sw + x1) * 4
      if (alphaMode) {
        const v = s[i00] * w00 + s[i10] * w10 + s[i01] * w01 + s[i11] * w11
        out[o] = v
        out[o + 1] = v
        out[o + 2] = v
        out[o + 3] = 255
      } else {
        out[o] = s[i00] * w00 + s[i10] * w10 + s[i01] * w01 + s[i11] * w11
        out[o + 1] = s[i00 + 1] * w00 + s[i10 + 1] * w10 + s[i01 + 1] * w01 + s[i11 + 1] * w11
        out[o + 2] = s[i00 + 2] * w00 + s[i10 + 2] * w10 + s[i01 + 2] * w01 + s[i11 + 2] * w11
        out[o + 3] = s[i00 + 3] * w00 + s[i10 + 3] * w10 + s[i01 + 3] * w01 + s[i11 + 3] * w11
      }
    }
  }
  return { data: out, w: outW, h: outH }
}

/** Inverse-mapping warp of a single-channel float image through H (src -> dst). Zero border. */
export function warpFloat(
  alpha: Float32Array,
  w: number,
  h: number,
  H: number[],
  outW: number,
  outH: number,
): Float32Array {
  const Hi = computeInverse(H)
  const out = new Float32Array(outW * outH)
  for (let y = 0; y < outH; y++) {
    const rowOut = y * outW
    for (let x = 0; x < outW; x++) {
      const hw = Hi[6] * x + Hi[7] * y + Hi[8]
      const sx = (Hi[0] * x + Hi[1] * y + Hi[2]) / hw
      const sy = (Hi[3] * x + Hi[4] * y + Hi[5]) / hw
      if (!(sx >= 0 && sy >= 0 && sx <= w - 1 && sy <= h - 1)) continue
      const x0 = sx | 0
      const y0 = sy | 0
      const x1 = x0 + 1 < w ? x0 + 1 : w - 1
      const y1 = y0 + 1 < h ? y0 + 1 : h - 1
      const fx = sx - x0
      const fy = sy - y0
      const r0 = y0 * w
      const r1 = y1 * w
      out[rowOut + x] =
        alpha[r0 + x0] * (1 - fx) * (1 - fy) +
        alpha[r0 + x1] * fx * (1 - fy) +
        alpha[r1 + x0] * (1 - fx) * fy +
        alpha[r1 + x1] * fx * fy
    }
  }
  return out
}

/**
 * Inverse-mapping warp of a product (color + float alpha) through H with
 * ALPHA-WEIGHTED color sampling: neighbors are weighted by w_i * a_i, so the
 * color of transparent source pixels never bleeds in (no black fringe —
 * documented improvement over the python baseline which warped color and
 * alpha independently). Output alpha = bilinear alpha.
 */
export function warpPremultiplied(
  color: ImageBuffer,
  alpha: Float32Array,
  H: number[],
  outW: number,
  outH: number,
): { color: ImageBuffer; alpha: Float32Array } {
  const Hi = computeInverse(H)
  const sw = color.w
  const sh = color.h
  const c = color.data
  const outC = new Uint8ClampedArray(outW * outH * 4)
  const outA = new Float32Array(outW * outH)
  for (let y = 0; y < outH; y++) {
    const rowOut = y * outW
    for (let x = 0; x < outW; x++) {
      const hw = Hi[6] * x + Hi[7] * y + Hi[8]
      const sx = (Hi[0] * x + Hi[1] * y + Hi[2]) / hw
      const sy = (Hi[3] * x + Hi[4] * y + Hi[5]) / hw
      if (!(sx >= 0 && sy >= 0 && sx <= sw - 1 && sy <= sh - 1)) continue
      const x0 = sx | 0
      const y0 = sy | 0
      const x1 = x0 + 1 < sw ? x0 + 1 : sw - 1
      const y1 = y0 + 1 < sh ? y0 + 1 : sh - 1
      const fx = sx - x0
      const fy = sy - y0
      const r0 = y0 * sw
      const r1 = y1 * sw
      const i00 = (r0 + x0) * 4
      const i10 = (r0 + x1) * 4
      const i01 = (r1 + x0) * 4
      const i11 = (r1 + x1) * 4
      const w00 = (1 - fx) * (1 - fy)
      const w10 = fx * (1 - fy)
      const w01 = (1 - fx) * fy
      const w11 = fx * fy
      const a00 = alpha[r0 + x0] * w00
      const a10 = alpha[r0 + x1] * w10
      const a01 = alpha[r1 + x0] * w01
      const a11 = alpha[r1 + x1] * w11
      const sa = a00 + a10 + a01 + a11
      const o = (rowOut + x) * 4
      outA[rowOut + x] = sa
      if (sa > 1e-4) {
        const inv = 1 / sa
        outC[o] = (c[i00] * a00 + c[i10] * a10 + c[i01] * a01 + c[i11] * a11) * inv
        outC[o + 1] = (c[i00 + 1] * a00 + c[i10 + 1] * a10 + c[i01 + 1] * a01 + c[i11 + 1] * a11) * inv
        outC[o + 2] = (c[i00 + 2] * a00 + c[i10 + 2] * a10 + c[i01 + 2] * a01 + c[i11 + 2] * a11) * inv
        outC[o + 3] = 255
      }
    }
  }
  return { color: { data: outC, w: outW, h: outH }, alpha: outA }
}
