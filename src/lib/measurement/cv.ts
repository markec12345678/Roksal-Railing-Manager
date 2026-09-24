/**
 * MEASUREMENT SDK (issue #2) — deterministične CV primitivke.
 *
 * Čist TypeScript, brez odvisnosti od node/canvas/AI. Vse operacije so
 * deterministične: enak vhod → enak izhod (brez naključja, ure ali mreže).
 * Algoritmi dokumentirani v docs/AUTOMATIC-DETECTION.md.
 */
import { MEASUREMENT_CONSTANTS } from './types'
import type { ImageBuffer } from '../viz/types'

/** Sivinska slika v plovcih 0..1, row-major. */
export interface GrayImage {
  data: Float32Array // length = w*h
  w: number
  h: number
}

/** Sobel gradientni odgovor. */
export interface GradientImage {
  mag: Float32Array
  dirX: Float32Array // normalizirana gx komponenta (−1..1)
  dirY: Float32Array
  w: number
  h: number
}

/** Luminanca (Rec. 601) RGBA → siva 0..1. Deterministično. */
export function toGray(img: ImageBuffer): GrayImage {
  const { data, w, h } = img
  const out = new Float32Array(w * h)
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) / 255
  }
  return { data: out, w, h }
}

/**
 * Deterministični area-average downscale (celoštevilski faktor blokov po
 * ALI izrazu deležev — vsak ciljni piksel = povprečje natančno določenega
 * pravokotnika vira). Neodvisen od zaokrožanja drsnega okna.
 */
export function downscaleGray(g: GrayImage, maxDim: number): GrayImage {
  const scale = Math.min(1, maxDim / Math.max(g.w, g.h))
  if (scale >= 1) return g
  const w = Math.max(1, Math.round(g.w * scale))
  const h = Math.max(1, Math.round(g.h * scale))
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor((y * g.h) / h)
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * g.h) / h))
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * g.w) / w)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * g.w) / w))
      let sum = 0
      let n = 0
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          sum += g.data[sy * g.w + sx]
          n++
        }
      }
      out[y * w + x] = n > 0 ? sum / n : 0
    }
  }
  return { data: out, w, h }
}

/** Sobel 3×3 gradient (mag + smer). Robustno na robu (clamp indeksov). */
export function sobel(g: GrayImage): GradientImage {
  const { data, w, h } = g
  const mag = new Float32Array(w * h)
  const dirX = new Float32Array(w * h)
  const dirY = new Float32Array(w * h)
  const at = (x: number, y: number): number =>
    data[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))]
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx =
        -at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1) +
        at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)
      const gy =
        -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1) +
        at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)
      const m = Math.hypot(gx, gy)
      const i = y * w + x
      mag[i] = m
      const n = m > 1e-9 ? 1 / m : 0
      dirX[i] = gx * n
      dirY[i] = gy * n
    }
  }
  return { mag, dirX, dirY, w, h }
}

/** Otsu prag nad 0..1 vrednostmi (determinističen). */
export function otsuThreshold(values: Float32Array): number {
  // histogram na 256 nivojev
  const hist = new Float64Array(256)
  for (let i = 0; i < values.length; i++) {
    const v = Math.min(255, Math.max(0, Math.round(values[i] * 255)))
    hist[v]++
  }
  const total = values.length
  let sumAll = 0
  for (let t = 0; t < 256; t++) sumAll += t * hist[t]
  let sumB = 0
  let wB = 0
  let best = 0
  let bestVar = -1
  // t se začne pri 1: pri čisto bimodalnem histogramu {0, M} je medrazredna
  // varianca maksimalna že pri t=0, kar bi vse piksle razglasilo za robove.
  for (let t = 1; t < 256; t++) {
    wB += hist[t - 1]
    if (wB === 0) continue
    const wF = total - wB
    if (wF === 0) break
    sumB += (t - 1) * hist[t - 1]
    const mB = sumB / wB
    const mF = (sumAll - sumB) / wF
    const between = wB * wF * (mB - mF) * (mB - mF)
    if (between > bestVar) {
      bestVar = between
      best = t
    }
  }
  return Math.max(1, best) / 255
}

/** Binarna slika robov po Otsu pragu magnitude. */
export function edgesFromGradient(g: GradientImage): Uint8Array {
  const out = new Uint8Array(g.w * g.h)
  // Degeneratni primer: unifomna slika (max gradient ≈ 0) → NI robov.
  // (Otsu na konstantnem histogramu bi sicer vse piksle razglasil za robove.)
  let maxMag = 0
  for (let i = 0; i < g.mag.length; i++) if (g.mag[i] > maxMag) maxMag = g.mag[i]
  if (maxMag < 1e-6) return out
  const thr = otsuThreshold(g.mag)
  for (let i = 0; i < out.length; i++) out[i] = g.mag[i] >= thr ? 1 : 0
  return out
}

/** Binarna dilacija 1 px (8-sosednost) — premosti 1px luknje. */
export function dilate1(bin: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (bin[i]) {
        out[i] = 1
        continue
      }
      let any = 0
      for (let dy = -1; dy <= 1 && !any; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= w) continue
          if (bin[yy * w + xx]) {
            any = 1
            break
          }
        }
      }
      out[i] = any
    }
  }
  return out
}

/** Hough transform nad binarno sliko robov za θ ∈ [0°,180°). */
export interface HoughSpace {
  acc: Int32Array // thetaBins × rhoBins
  thetaBins: number
  rhoBins: number
  rhoOffset: number // ρ = indeks − rhoOffset
}

export function houghTransform(bin: Uint8Array, w: number, h: number, thetaStepDeg = 1): HoughSpace {
  const thetaBins = Math.max(90, Math.round(180 / thetaStepDeg))
  const diag = Math.ceil(Math.hypot(w, h))
  const rhoBins = 2 * diag + 1
  const rhoOffset = diag
  const acc = new Int32Array(thetaBins * rhoBins)
  const cosT = new Float64Array(thetaBins)
  const sinT = new Float64Array(thetaBins)
  for (let t = 0; t < thetaBins; t++) {
    const th = (t * Math.PI) / thetaBins
    cosT[t] = Math.cos(th)
    sinT[t] = Math.sin(th)
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!bin[y * w + x]) continue
      for (let t = 0; t < thetaBins; t++) {
        const rho = Math.round(x * cosT[t] + y * sinT[t]) + rhoOffset
        if (rho >= 0 && rho < rhoBins) acc[t * rhoBins + rho]++
      }
    }
  }
  return { acc, thetaBins, rhoBins, rhoOffset }
}

export interface HoughPeak {
  thetaIdx: number
  rhoIdx: number
  votes: number
}

/**
 * Izbor vrhov: lokalni maksimum v 3×3 okolici + absolutni prag, nato
 * požrešna ne-maximum supresija (NMS) v oknu ±supTheta θ-binov in
 * ±supRho ρ-binov — sicer debela pasova razmaze isto črto čez več ρ-binov
 * in izrine šibkejše (vertikalne) črte iz maxPeaks. Urejeno po
 * (votes desc, thetaIdx, rhoIdx) — popolnoma deterministično.
 */
export function houghPeaks(
  hs: HoughSpace,
  minVotes: number,
  maxPeaks: number,
  supTheta = 6,
  supRho = 8,
): HoughPeak[] {
  const { acc, thetaBins, rhoBins } = hs
  const peaks: HoughPeak[] = []
  for (let t = 0; t < thetaBins; t++) {
    for (let r = 0; r < rhoBins; r++) {
      const v = acc[t * rhoBins + r]
      if (v < minVotes) continue
      let isMax = true
      for (let dt = -1; dt <= 1 && isMax; dt++) {
        const tt = (t + dt + thetaBins) % thetaBins
        for (let dr = -1; dr <= 1; dr++) {
          const rr = r + dr
          if (rr < 0 || rr >= rhoBins) continue
          if (acc[tt * rhoBins + rr] > v) {
            isMax = false
            break
          }
        }
      }
      if (isMax) peaks.push({ thetaIdx: t, rhoIdx: r, votes: v })
    }
  }
  peaks.sort((a, b) => b.votes - a.votes || a.thetaIdx - b.thetaIdx || a.rhoIdx - b.rhoIdx)
  // požrešna NMS: sprejemi vrh samo, če ni blizu že sprejetega
  const accepted: HoughPeak[] = []
  for (const p of peaks) {
    let suppressed = false
    for (const q of accepted) {
      const dT = Math.min(
        Math.abs(p.thetaIdx - q.thetaIdx),
        thetaBins - Math.abs(p.thetaIdx - q.thetaIdx),
      )
      if (dT <= supTheta && Math.abs(p.rhoIdx - q.rhoIdx) <= supRho) {
        suppressed = true
        break
      }
    }
    if (!suppressed) accepted.push(p)
    if (accepted.length >= maxPeaks) break
  }
  return accepted
}

/**
 * Prerez črte (θ, ρ) z robovi: za horizontalno/vertikalno črto izračuna
 * obseg [from,to], pokritost in najdaljši presledek — s projektiranimi
 * 1-px sondami (±2 px v ρ).
 */
export interface LineExtent {
  from: number
  to: number
  coverage: number
  maxGapPx: number
}

export function projectLineExtent(
  bin: Uint8Array,
  w: number,
  h: number,
  thetaIdx: number,
  rhoIdx: number,
  hs: HoughSpace,
  orientation: 'horizontal' | 'vertical',
): LineExtent | null {
  const th = (thetaIdx * Math.PI) / hs.thetaBins
  const rho = rhoIdx - hs.rhoOffset
  const cosT = Math.cos(th)
  const sinT = Math.sin(th)
  const along = orientation === 'horizontal' ? w : h
  let count = 0
  let first = -1
  let last = -1
  let lastHit = -1
  let maxGap = 0
  const probe = 2
  for (let u = 0; u < along; u++) {
    let hit = 0
    if (orientation === 'horizontal') {
      // črta: x·cosθ + y·sinθ = ρ → y = (ρ − x·cosθ)/sinθ; sinθ≈1 (θ≈90°)
      const y = Math.round((rho - u * cosT) / (Math.abs(sinT) < 0.08 ? 0.08 * Math.sign(sinT || 1) : sinT))
      for (let dy = -probe; dy <= probe && !hit; dy++) {
        const yy = y + dy
        if (yy >= 0 && yy < h && bin[yy * w + u]) hit = 1
      }
    } else {
      // vertikalna: x = (ρ − y·sinθ)/cosθ; cosθ≈1 (θ≈0°)
      const x = Math.round((rho - u * sinT) / (Math.abs(cosT) < 0.08 ? 0.08 * Math.sign(cosT || 1) : cosT))
      for (let dx = -probe; dx <= probe && !hit; dx++) {
        const xx = x + dx
        if (xx >= 0 && xx < w && bin[u * w + xx]) hit = 1
      }
    }
    if (hit) {
      count++
      if (first < 0) first = u
      last = u
      if (lastHit >= 0) maxGap = Math.max(maxGap, u - lastHit - 1)
      lastHit = u
    }
  }
  if (first < 0) return null
  return {
    from: first,
    to: last,
    coverage: count / Math.max(1, last - first + 1),
    maxGapPx: maxGap,
  }
}

/**
 * Združi bliznje vertikalne vrhove (isti steber = 2 črti roba deske).
 * Vrne predstavnike (najmočnejši v skupini) v naraščajočem vrstnem redu.
 */
export function mergeNearbyPositions(
  items: Array<{ pos: number; votes: number }>,
  tolerancePx: number,
): Array<{ pos: number; votes: number }> {
  const sorted = [...items].sort((a, b) => a.pos - b.pos)
  const groups: Array<Array<{ pos: number; votes: number }>> = []
  for (const it of sorted) {
    const g = groups[groups.length - 1]
    if (g && it.pos - g[g.length - 1].pos <= tolerancePx) g.push(it)
    else groups.push([it])
  }
  return groups
    .map((g) => {
      // predstavnik = težišče uteženo z glasovi (deterministično), votes = max skupine
      let wsum = 0
      let vsum = 0
      let maxVotes = 0
      for (const it of g) {
        wsum += it.pos * it.votes
        vsum += it.votes
        maxVotes = Math.max(maxVotes, it.votes)
      }
      const pos = vsum > 0 ? wsum / vsum : g[0].pos
      return { pos, votes: maxVotes }
    })
    .sort((a, b) => a.pos - b.pos)
}

/** Delovna slika za detekcijo — max dim iz konstant. */
export function toWorkGray(img: ImageBuffer): GrayImage {
  return downscaleGray(toGray(img), MEASUREMENT_CONSTANTS.workMaxDim)
}
