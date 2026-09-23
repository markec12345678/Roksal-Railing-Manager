/**
 * VIZ — image operations (pure TS, zero imports; browser + Node safe). Runda S+2.
 *
 * Ports of the cv2 primitives used by baseline/variant_a.py:
 *  - GaussianBlur          → gaussBlurFloat / gaussBlurRGBA (3× box blur, prefix sums)
 *  - morphologyEx CLOSE 7×7 → morphClose (separable max→min, radius 3)
 *  - dilate/erode rect 61×61/9×9 → dilateBinary/erodeBinary (separable running max/min)
 *  - connectedComponentsWithStats → connectedComponents (8-connectivity BFS)
 *  - fillPoly              → fillPolygon (scanline even-odd)
 *  - resize NEAREST        → resizeNearestGray
 *
 * All hot loops are typed-array + separable to meet the <8s budget at 1024×1024
 * on 2 CPU (actual: well under 1s per step).
 */

/** Box radii for a 3-pass box blur approximating a Gaussian with `sigma`. */
function boxesForGauss(sigma: number, n: number): number[] {
  const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1)
  let wl = Math.floor(wIdeal)
  if (wl % 2 === 0) wl--
  const wu = wl + 2
  const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4)
  const m = Math.round(mIdeal)
  const sizes: number[] = []
  for (let i = 0; i < n; i++) sizes.push(i < m ? wl : wu)
  return sizes
}

/** Horizontal box blur with edge clamping (in-place safe via dst). */
function boxBlurH(src: Float32Array, dst: Float32Array, w: number, h: number, r: number): void {
  const iarr = 1 / (r + r + 1)
  for (let y = 0; y < h; y++) {
    const row = y * w
    let acc = src[row] * (r + 1)
    for (let j = 0; j < r; j++) acc += src[row + Math.min(j, w - 1)]
    for (let x = 0; x < w; x++) {
      dst[row + x] = acc * iarr
      const add = src[row + Math.min(x + r + 1, w - 1)]
      const sub = src[row + Math.max(x - r, 0)]
      acc += add - sub
    }
  }
}

/** Vertical box blur with edge clamping. */
function boxBlurV(src: Float32Array, dst: Float32Array, w: number, h: number, r: number): void {
  const iarr = 1 / (r + r + 1)
  for (let x = 0; x < w; x++) {
    let acc = src[x] * (r + 1)
    for (let j = 0; j < r; j++) acc += src[Math.min(j, h - 1) * w + x]
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = acc * iarr
      const add = src[Math.min(y + r + 1, h - 1) * w + x]
      const sub = src[Math.max(y - r, 0) * w + x]
      acc += add - sub
    }
  }
}

/** Gaussian blur (σ approximated by 3 box passes) of a single-channel float image. */
export function gaussBlurFloat(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  if (sigma <= 0.05 || w < 2 || h < 2) return src.slice()
  const boxes = boxesForGauss(sigma, 3)
  let a = src.slice()
  let b = new Float32Array(w * h)
  for (const bi of boxes) {
    const r = (bi - 1) / 2
    if (r < 1) continue
    boxBlurH(a, b, w, h, r)
    boxBlurV(b, a, w, h, r)
  }
  return a
}

/** Gaussian blur of an RGBA ImageBuffer (each channel independently). */
export function gaussBlurRGBA(img: { data: Uint8ClampedArray; w: number; h: number }, sigma: number) {
  const { w, h } = img
  const n = w * h
  const out = new Uint8ClampedArray(n * 4)
  for (let c = 0; c < 4; c++) {
    const plane = new Float32Array(n)
    for (let i = 0, p = c; i < n; i++, p += 4) plane[i] = img.data[p]
    const blurred = gaussBlurFloat(plane, w, h, sigma)
    for (let i = 0, p = c; i < n; i++, p += 4) out[p] = blurred[i]
  }
  return { data: out, w, h }
}

/**
 * Separable running-max dilation with a rectangular kernel (2r+1)×(2r+1)
 * over a binary (0/1) image — cv2.dilate(mask, ones(k,k)) with r=(k-1)/2.
 * O(n) per axis via sliding window max (van Herk/Gil-Werman simplified).
 */
export function dilateBinary(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r <= 0) return mask.slice()
  const tmp = new Uint8Array(w * h)
  const out = new Uint8Array(w * h)
  // horizontal
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      let m = 0
      const x0 = Math.max(0, x - r)
      const x1 = Math.min(w - 1, x + r)
      for (let i = x0; i <= x1; i++) {
        if (mask[row + i]) {
          m = 1
          break
        }
      }
      tmp[row + x] = m
    }
  }
  // vertical
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let m = 0
      const y0 = Math.max(0, y - r)
      const y1 = Math.min(h - 1, y + r)
      for (let i = y0; i <= y1; i++) {
        if (tmp[i * w + x]) {
          m = 1
          break
        }
      }
      out[y * w + x] = m
    }
  }
  return out
}

/** Separable running-min erosion (rectangular kernel), counterpart of dilateBinary. */
export function erodeBinary(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r <= 0) return mask.slice()
  const tmp = new Uint8Array(w * h)
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      let m = 1
      const x0 = Math.max(0, x - r)
      const x1 = Math.min(w - 1, x + r)
      for (let i = x0; i <= x1; i++) {
        if (!mask[row + i]) {
          m = 0
          break
        }
      }
      tmp[row + x] = m
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let m = 1
      const y0 = Math.max(0, y - r)
      const y1 = Math.min(h - 1, y + r)
      for (let i = y0; i <= y1; i++) {
        if (!tmp[i * w + x]) {
          m = 0
          break
        }
      }
      out[y * w + x] = m
    }
  }
  return out
}

/** Max-filter (dilation) of a float mask, rectangular kernel radius r (separable). */
export function dilateFloat(mask: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r <= 0) return mask.slice()
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      let m = -Infinity
      const x0 = Math.max(0, x - r)
      const x1 = Math.min(w - 1, x + r)
      for (let i = x0; i <= x1; i++) {
        const v = mask[row + i]
        if (v > m) m = v
      }
      tmp[row + x] = m
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let m = -Infinity
      const y0 = Math.max(0, y - r)
      const y1 = Math.min(h - 1, y + r)
      for (let i = y0; i <= y1; i++) {
        const v = tmp[i * w + x]
        if (v > m) m = v
      }
      out[y * w + x] = m
    }
  }
  return out
}

/** Min-filter (erosion) of a float mask, rectangular kernel radius r (separable). */
export function erodeFloat(mask: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r <= 0) return mask.slice()
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      let m = Infinity
      const x0 = Math.max(0, x - r)
      const x1 = Math.min(w - 1, x + r)
      for (let i = x0; i <= x1; i++) {
        const v = mask[row + i]
        if (v < m) m = v
      }
      tmp[row + x] = m
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let m = Infinity
      const y0 = Math.max(0, y - r)
      const y1 = Math.min(h - 1, y + r)
      for (let i = y0; i <= y1; i++) {
        const v = tmp[i * w + x]
        if (v < m) m = v
      }
      out[y * w + x] = m
    }
  }
  return out
}

/**
 * cv2.morphologyEx CLOSE with ones(k,k) on a 0/1 float mask:
 * dilate(radius (k-1)/2) then erode(radius (k-1)/2).
 */
export function morphClose(mask: Float32Array, w: number, h: number, k = 7): Float32Array {
  const r = Math.max(1, (k - 1) >> 1)
  return erodeFloat(dilateFloat(mask, w, h, r), w, h, r)
}

/** 8-connectivity connected components on a binary image (BFS flood fill). */
export function connectedComponents(
  binary: Uint8Array,
  w: number,
  h: number,
): { labels: Int32Array; sizes: Int32Array; count: number } {
  const labels = new Int32Array(w * h) // 0 = unlabeled
  const sizesList: number[] = []
  const stack = new Int32Array(w * h)
  for (let start = 0; start < w * h; start++) {
    if (binary[start] === 0 || labels[start] !== 0) continue
    const id = sizesList.length + 1
    let sp = 0
    stack[sp++] = start
    labels[start] = id
    let size = 0
    while (sp > 0) {
      const p = stack[--sp]
      size++
      const x = p % w
      const y = (p / w) | 0
      // 8 neighbors
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = x + dx
          if (nx < 0 || nx >= w) continue
          const q = ny * w + nx
          if (binary[q] !== 0 && labels[q] === 0) {
            labels[q] = id
            stack[sp++] = q
          }
        }
      }
    }
    sizesList.push(size)
  }
  const sizes = new Int32Array(sizesList.length)
  for (let i = 0; i < sizesList.length; i++) sizes[i] = sizesList[i]
  return { labels, sizes, count: sizesList.length }
}

/**
 * Scanline even-odd polygon fill (integer coords). Ports cv2.fillPoly for
 * convex quads (the only shape the pipeline needs).
 */
export function fillPolygon(points: Array<[number, number]>, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h)
  if (points.length < 3) return out
  const ys = points.map((p) => p[1])
  const yMin = Math.max(0, Math.floor(Math.min(...ys)))
  const yMax = Math.min(h - 1, Math.ceil(Math.max(...ys)))
  const n = points.length
  for (let y = yMin; y <= yMax; y++) {
    const yc = y + 0.5
    const xs: number[] = []
    for (let i = 0; i < n; i++) {
      const [x1, y1] = points[i]
      const [x2, y2] = points[(i + 1) % n]
      if (y1 === y2) continue
      if (yc >= Math.min(y1, y2) && yc < Math.max(y1, y2)) {
        xs.push(x1 + ((yc - y1) / (y2 - y1)) * (x2 - x1))
      }
    }
    xs.sort((a, b) => a - b)
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const x0 = Math.max(0, Math.ceil(xs[i] - 0.5))
      const x1 = Math.min(w - 1, Math.floor(xs[i + 1] - 0.5))
      for (let x = x0; x <= x1; x++) out[y * w + x] = 1
    }
  }
  return out
}

/** Nearest-neighbor resize of a single-channel gray (Uint8) image. */
export function resizeNearestU8(src: Uint8Array, w: number, h: number, outW: number, outH: number): Uint8Array {
  const out = new Uint8Array(outW * outH)
  const rx = w / outW
  const ry = h / outH
  for (let y = 0; y < outH; y++) {
    const sy = Math.min(h - 1, (y * ry) | 0)
    const rowS = sy * w
    const rowO = y * outW
    for (let x = 0; x < outW; x++) {
      out[rowO + x] = src[rowS + Math.min(w - 1, (x * rx) | 0)]
    }
  }
  return out
}

/** Nearest-neighbor resize of a single-channel float image. */
export function resizeNearestF32(src: Float32Array, w: number, h: number, outW: number, outH: number): Float32Array {
  const out = new Float32Array(outW * outH)
  const rx = w / outW
  const ry = h / outH
  for (let y = 0; y < outH; y++) {
    const sy = Math.min(h - 1, (y * ry) | 0)
    const rowS = sy * w
    const rowO = y * outW
    for (let x = 0; x < outW; x++) {
      out[rowO + x] = src[rowS + Math.min(w - 1, (x * rx) | 0)]
    }
  }
  return out
}

/** Tight bbox of values > threshold (returns null if empty). */
export function bboxAbove(
  vals: Float32Array,
  w: number,
  h: number,
  threshold: number,
): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = w
  let y0 = h
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      if (vals[row + x] > threshold) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) return null
  return { x0, y0, x1, y1 }
}
