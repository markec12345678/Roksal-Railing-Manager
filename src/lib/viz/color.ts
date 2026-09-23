/**
 * VIZ — sRGB <-> CIELAB conversion, OpenCV 8-bit convention (pure TS, no imports).
 *
 * Convention (same as cv2.COLOR_BGR2LAB / LAB2BGR on 8-bit images, D65):
 *   L in 0..255  where L = 255 means L* = 100
 *   a, b in 0..255 centered at 128 (a = a* + 128, b = b* + 128)
 *
 * rgb2lab returns UNQUANTIZED floats in this convention (higher precision than
 * cv2's uint8 roundtrip); lab2rgb rounds/clamps to 0..255 like cv2.
 * Scalar helpers are provided for per-pixel metrics.
 */
import type { ImageBuffer } from '@/lib/viz/types'

// OpenCV sRGB -> XYZ (D65) matrix, rows R,G,B.
const M_RGB2XYZ = [0.412453, 0.35758, 0.180423, 0.212671, 0.71516, 0.072169, 0.019334, 0.119193, 0.950227]
// OpenCV XYZ -> sRGB (D65) matrix, rows X,Y,Z.
const M_XYZ2RGB = [3.240479, -1.53715, -0.498535, -0.969256, 1.875968, 0.041556, 0.055648, -0.204043, 1.057311]

const XN = 0.412453 + 0.35758 + 0.180423 // 0.950456
const YN = 0.212671 + 0.71516 + 0.072169 // 1.0
const ZN = 0.019334 + 0.119193 + 0.950227 // 1.088754

const THRESH = 0.008856
const K7787 = 7.787
const OFF = 16 / 116

/** sRGB 8-bit value -> linear light (LUT). */
const LINEAR_LUT = new Float64Array(256)
for (let i = 0; i < 256; i++) {
  const c = i / 255
  LINEAR_LUT[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function fLab(t: number): number {
  return t > THRESH ? Math.cbrt(t) : K7787 * t + OFF
}

/** sRGB 8-bit (0..255 per channel) -> LAB floats in OpenCV 8-bit convention. */
export function rgb2labScalar(r: number, g: number, b: number): { L: number; a: number; b: number } {
  const lr = LINEAR_LUT[r]
  const lg = LINEAR_LUT[g]
  const lb = LINEAR_LUT[b]
  const X = (M_RGB2XYZ[0] * lr + M_RGB2XYZ[1] * lg + M_RGB2XYZ[2] * lb) / XN
  const Y = (M_RGB2XYZ[3] * lr + M_RGB2XYZ[4] * lg + M_RGB2XYZ[5] * lb) / YN
  const Z = (M_RGB2XYZ[6] * lr + M_RGB2XYZ[7] * lg + M_RGB2XYZ[8] * lb) / ZN
  const fx = fLab(X)
  const fy = fLab(Y)
  const fz = fLab(Z)
  const L = 116 * fy - 16
  const a = 500 * (fx - fy)
  const bb = 200 * (fy - fz)
  return { L: L * 2.55, a: a + 128, b: bb + 128 }
}

/** LAB floats (OpenCV 8-bit convention) -> sRGB 8-bit, clamped. */
export function lab2rgbScalar(L: number, a: number, b: number): { r: number; g: number; b: number } {
  const Ls = L / 2.55
  const as = a - 128
  const bs = b - 128
  const fy = Ls > 8 ? (Ls + 16) / 116 : Ls / 903.3 + OFF // L*<=8: yr = L*/903.3
  const fx = fy + as / 500
  const fz = fy - bs / 200
  const xr = fx * fx * fx > THRESH ? fx * fx * fx : (fx - OFF) / K7787
  const yr = Ls > 8 ? fy * fy * fy : Ls / 903.3
  const zr = fz * fz * fz > THRESH ? fz * fz * fz : (fz - OFF) / K7787
  const X = xr * XN
  const Y = yr * YN
  const Z = zr * ZN
  const rl = M_XYZ2RGB[0] * X + M_XYZ2RGB[1] * Y + M_XYZ2RGB[2] * Z
  const gl = M_XYZ2RGB[3] * X + M_XYZ2RGB[4] * Y + M_XYZ2RGB[5] * Z
  const bl = M_XYZ2RGB[6] * X + M_XYZ2RGB[7] * Y + M_XYZ2RGB[8] * Z
  return { r: gammaEnc(rl), g: gammaEnc(gl), b: gammaEnc(bl) }
}

function gammaEnc(lin: number): number {
  const c = lin <= 0.0031308 ? 12.92 * lin : 1.055 * Math.pow(Math.max(lin, 0), 1 / 2.4) - 0.055
  const v = c * 255 + 0.5
  return v < 0 ? 0 : v > 255 ? 255 : v | 0
}

/**
 * Convert an RGBA ImageBuffer to per-pixel LAB planes (OpenCV 8-bit convention,
 * unquantized floats). L/a/b have length w*h, row-major.
 */
export function rgb2lab(img: ImageBuffer): { L: Float32Array; a: Float32Array; b: Float32Array } {
  const n = img.w * img.h
  const L = new Float32Array(n)
  const a = new Float32Array(n)
  const b = new Float32Array(n)
  const d = img.data
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const lr = LINEAR_LUT[d[p]]
    const lg = LINEAR_LUT[d[p + 1]]
    const lb = LINEAR_LUT[d[p + 2]]
    const X = (M_RGB2XYZ[0] * lr + M_RGB2XYZ[1] * lg + M_RGB2XYZ[2] * lb) / XN
    const Y = (M_RGB2XYZ[3] * lr + M_RGB2XYZ[4] * lg + M_RGB2XYZ[5] * lb) / YN
    const Z = (M_RGB2XYZ[6] * lr + M_RGB2XYZ[7] * lg + M_RGB2XYZ[8] * lb) / ZN
    const fx = fLab(X)
    const fy = fLab(Y)
    const fz = fLab(Z)
    L[i] = (116 * fy - 16) * 2.55
    a[i] = 500 * (fx - fy) + 128
    b[i] = 200 * (fy - fz) + 128
  }
  return { L, a, b }
}

/** Convert LAB planes (OpenCV 8-bit convention) back to an RGBA ImageBuffer (8-bit, clamped). */
export function lab2rgb(L: Float32Array, a: Float32Array, b: Float32Array, w: number, h: number): ImageBuffer {
  const n = w * h
  const out = new Uint8ClampedArray(n * 4)
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const Ls = L[i] / 2.55
    const as = a[i] - 128
    const bs = b[i] - 128
    const fy = Ls > 8 ? (Ls + 16) / 116 : Ls / 903.3 + OFF
    const fx = fy + as / 500
    const fz = fy - bs / 200
    const xr = fx * fx * fx > THRESH ? fx * fx * fx : (fx - OFF) / K7787
    const yr = Ls > 8 ? fy * fy * fy : Ls / 903.3
    const zr = fz * fz * fz > THRESH ? fz * fz * fz : (fz - OFF) / K7787
    const X = xr * XN
    const Y = yr * YN
    const Z = zr * ZN
    out[p] = gammaEnc(M_XYZ2RGB[0] * X + M_XYZ2RGB[1] * Y + M_XYZ2RGB[2] * Z)
    out[p + 1] = gammaEnc(M_XYZ2RGB[3] * X + M_XYZ2RGB[4] * Y + M_XYZ2RGB[5] * Z)
    out[p + 2] = gammaEnc(M_XYZ2RGB[6] * X + M_XYZ2RGB[7] * Y + M_XYZ2RGB[8] * Z)
    out[p + 3] = 255
  }
  return { data: out, w, h }
}
