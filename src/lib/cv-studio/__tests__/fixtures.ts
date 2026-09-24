/**
 * CV STUDIO — testni fiksaturi (sintetične slike, deterministične).
 * Isti vzorec kot measurement-sdk.test.ts (surov ImageBuffer, brez sharp).
 */
import type { ImageBuffer } from '@/lib/viz/types'

export function makeImage(w: number, h: number): ImageBuffer {
  return { data: new Uint8ClampedArray(w * h * 4), w, h }
}

export function fillRect(
  img: ImageBuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgb: [number, number, number],
): void {
  for (let y = Math.max(0, y0); y <= Math.min(img.h - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(img.w - 1, x1); x++) {
      const i = (y * img.w + x) * 4
      img.data[i] = rgb[0]
      img.data[i + 1] = rgb[1]
      img.data[i + 2] = rgb[2]
      img.data[i + 3] = 255
    }
  }
}

export const BG: [number, number, number] = [215, 218, 222]
export const DARK: [number, number, number] = [35, 38, 42]

/**
 * Raven balkon: dva horizontalna raila (~8 px) + vertikalni stebri (~7 px)
 * čez pas. Privzeto pas na y = 30 %..62 % višine, x = 10 %..90 % širine
 * (isti robustni vzorec kot measurement-sdk.test.ts fiksatura).
 */
export function syntheticBalcony(
  w = 960,
  h = 640,
  opts?: { bandTopFrac?: number; bandBottomFrac?: number; postCount?: number },
): ImageBuffer {
  const img = makeImage(w, h)
  fillRect(img, 0, 0, w - 1, h - 1, BG)
  const bandTop = Math.round(h * (opts?.bandTopFrac ?? 0.3))
  const bandBottom = Math.round(h * (opts?.bandBottomFrac ?? 0.62))
  const x0 = Math.round(w * 0.1)
  const x1 = Math.round(w * 0.9)
  const postCount = opts?.postCount ?? 5
  const tPx = 4
  fillRect(img, x0, bandTop - tPx, x1, bandTop + tPx, DARK)
  fillRect(img, x0, bandBottom - tPx, x1, bandBottom + tPx, DARK)
  for (let i = 0; i < postCount; i++) {
    const x = x0 + ((i + 1) * (x1 - x0)) / (postCount + 1)
    fillRect(img, Math.round(x) - 3, bandTop, Math.round(x) + 3, bandBottom, DARK)
  }
  return img
}

/** Stopnice: družina vzporednih diagonalnih črt (θ ≈ 30° pod horizontom). */
export function syntheticStairs(w = 960, h = 640, count = 6): ImageBuffer {
  const img = makeImage(w, h)
  fillRect(img, 0, 0, w - 1, h - 1, BG)
  // linija: y = tan(30°)·x + c — Hough θ: x·cosθ + y·sinθ = ρ, θ = 90−30 = 60°
  const tan = Math.tan((30 * Math.PI) / 180)
  const spacingPx = Math.round(h * 0.09)
  for (let k = 0; k < count; k++) {
    const c = Math.round(h * 0.25) + k * spacingPx
    for (let x = 0; x < w; x++) {
      const y = Math.round(c + tan * x)
      if (y < 0 || y >= h) continue
      // debelina 3 px (vertikalno) — dovolj glasna črta
      fillRect(img, x, y, x, y + 2, DARK)
    }
  }
  return img
}

/** Balkon + ovira (gost blok znotraj pasu, izven stolpcev stebrov). */
export function syntheticBalconyWithObstacle(w = 960, h = 640): ImageBuffer {
  const img = syntheticBalcony(w, h, { postCount: 3 })
  const bandTop = Math.round(h * 0.4)
  const bandBottom = Math.round(h * 0.6)
  const obX0 = Math.round(w * 0.42)
  const obX1 = Math.round(w * 0.55)
  const obY0 = bandTop + Math.round((bandBottom - bandTop) * 0.25)
  const obY1 = bandBottom - Math.round((bandBottom - bandTop) * 0.25)
  fillRect(img, obX0, obY0, obX1, obY1, DARK)
  return img
}

/** Praktično črna slika (slaba svetloba). */
export function darkImage(w = 960, h = 640): ImageBuffer {
  const img = makeImage(w, h)
  fillRect(img, 0, 0, w - 1, h - 1, [12, 12, 14])
  return img
}

/** Prežgana slika. */
export function brightImage(w = 960, h = 640): ImageBuffer {
  const img = makeImage(w, h)
  fillRect(img, 0, 0, w - 1, h - 1, [252, 253, 254])
  return img
}

/** Prazna slika (brez strukture). */
export function blankImage(w = 960, h = 640): ImageBuffer {
  const img = makeImage(w, h)
  fillRect(img, 0, 0, w - 1, h - 1, [180, 182, 186])
  return img
}

/**
 * Šumna slika: LCG (determinističen — linearni kongruentni generator, fiksen
 * seed). Balkon + šum na vrhu.
 */
export function noisyBalcony(w = 960, h = 640): ImageBuffer {
  const img = syntheticBalcony(w, h)
  let seed = 123456789
  const lcg = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  for (let i = 0; i < img.data.length; i += 4) {
    const n = Math.round((lcg() - 0.5) * 80)
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n))
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n))
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n))
  }
  return img
}
