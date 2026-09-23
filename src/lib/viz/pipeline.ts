/**
 * VIZ — A-PIPELINE (runda S+2): 1:1 TypeScript port of baseline/variant_a.py
 * (runda S+1, commit 0f4a283 — DOKAZAN baseline: 13=13 letvic, diff=0 izven
 * maske, RAL-varen, 1.37s). ALGORITMA SE NE SPREMINJA — samo jezik (cv2/numpy →
 * čisti TS). Številke korakov v komentarjih ustrezajo Python skripti.
 *
 * Koraki (python → tukaj):
 *  1. maska stare ograje (vhod — monterjev poligon, že rasteriziran)
 *  2. izrez produkta: prag gray<115 → MORPH_CLOSE 7×7 → največja povezana
 *     komponenta (+ komponente >4000 px znotraj bay kvadra) → Gauss σ0.8
 *  3. odstranitev stare ograje: STOLPIČNA linearna interpolacija ozadja
 *     (pas 14 px, preskoči 6 px od roba, median po stolpcu), glajenje σ3 znotraj
 *     maske (maska σ2 kot utež)
 *  4. 4-točkovna PERSPEKTIVA = GEOMETRIJA (homografija, inverse mapping,
 *     bilinearno vzorčenje, alpha-weighted barva brez črnega robu)
 *  5. RAL-VARNA luminance-only harmonizacija: ring (dilate61 − erode9),
 *     illum = Gauss(L_scene, σ25), field = clip(illum/mean_ring, 0.85, 1.15),
 *     L' = L·(1+strength·(field−1)), a/b NESPREMENJENA; strength=0.6 za temne
 *     izdelke (L_mean<70). REPO ColorMatcher (full-channel transfer, dokazano
 *     ΔE=38.4 na RAL) je PREPOVEDAN.
 *  6. feather blend (EdgeBlender repoja: radius 3, gaussian) — utež CLIPANA NA
 *     MASKO (× maska σ2) → diff izven maske = 0 pred senco (izboljšava python
 *     baseline, ki je krvavil ~1.5 mean čez rob)
 *  7. kontaktna senca pod spodnjim robom (28 pasov, max 0.22, Gauss σ5, ×0.4)
 *  8. DOKAZILA: diff izven maske (pred/po senci), štetje letvic v rektificiranem
 *     prostoru 700×300 (centralni pas 35–65 %, profil >0.5, naraščajoči robovi),
 *     RAL kroma a/b pred/po, timing po korakih.
 *
 * ČISTI TS, BREZ importov — tek v brskalniku (samodejni izrez izdelka) in Node
 * (API /api/viz/preview).
 */
import type { Corners, ImageBuffer, PipelineMetrics, PipelineOptions } from '@/lib/viz/types'
import { solveHomography, warpFloat, warpPremultiplied } from '@/lib/viz/homography'
import { rgb2lab, lab2rgb } from '@/lib/viz/color'
import {
  bboxAbove,
  connectedComponents,
  dilateBinary,
  erodeBinary,
  fillPolygon,
  gaussBlurFloat,
  gaussBlurRGBA,
  morphClose,
  resizeNearestF32,
} from '@/lib/viz/imageops'

const CUTOUT_GRAY_THRESHOLD = 115
const CUTOUT_MIN_COMPONENT = 4000

/**
 * S+8 §11/§12: exact alpha iz geometry-derived maske (FenceLayout/mask-editor).
 * Globalni prag gray<115 NE sme svetlih izdelkov (WHITE, svetli lesni odtenki)
 * narediti prosojnih — maska opisuje KJE JE produkt, ne KAKŠNE BARVE je.
 * Brez maske pipeline ostane bajtno identičen prejšnji izvedbi.
 */
function maskToCutout(
  mask: ImageBuffer,
  w: number,
  h: number,
): { alpha: Float32Array; w: number; h: number; bbox: { x0: number; y0: number; x1: number; y1: number } | null } {
  const n = w * h
  let alpha: Float32Array
  if (mask.w !== w || mask.h !== h) {
    const plane = new Float32Array(mask.w * mask.h)
    for (let i = 0, p = 0; i < mask.w * mask.h; i++, p += 4) plane[i] = mask.data[p] / 255
    alpha = resizeNearestF32(plane, mask.w, mask.h, w, h)
  } else {
    alpha = new Float32Array(n)
    for (let i = 0, p = 0; i < n; i++, p += 4) alpha[i] = mask.data[p] / 255
  }
  const bbox = bboxAbove(alpha, w, h, 0.5)
  return { alpha, w, h, bbox }
}

/** Polygons in pixel coords of an image. */
type Poly = Array<[number, number]>

function cornersToPoly(c: Corners): Poly {
  return [
    [c[0][0], c[0][1]],
    [c[1][0], c[1][1]],
    [c[2][0], c[2][1]],
    [c[3][0], c[3][1]],
  ]
}

/**
 * Izrez produkta (python korak 2). Čisti TS — uporablja se tudi v brskalniku
 * (samodejni predogled maske izdelka v koraku 2 čarovnika).
 * Vrne float alpha (0..1) + tight bbox (za samodejni productQuad).
 */
export function cutoutProduct(
  img: ImageBuffer,
  quadPx?: Corners | null,
): { alpha: Float32Array; w: number; h: number; bbox: { x0: number; y0: number; x1: number; y1: number } | null } {
  const { data, w, h } = img
  const n = w * h
  // prag: temne letvice/rails → 1; vrzeli (zid) → 0
  let alpha: Float32Array = new Float32Array(n)
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const gray = (data[p] + data[p + 1] + data[p + 2]) / 3
    alpha[i] = gray < CUTOUT_GRAY_THRESHOLD ? 1 : 0
  }
  // zapri majhne luknje v letvicah (odsevi), ne zapri 20px+ vrzeli
  alpha = morphClose(alpha, w, h, 7)
  // omeji na bay kvader (če je podan)
  let quadMask: Uint8Array | null = null
  if (quadPx) {
    quadMask = fillPolygon(cornersToPoly(quadPx), w, h)
    for (let i = 0; i < n; i++) if (quadMask[i] === 0) alpha[i] = 0
  }
  // največja povezana komponenta (+ dovolj velike znotraj kvadra — drogov obrobni)
  const binary = new Uint8Array(n)
  for (let i = 0; i < n; i++) binary[i] = alpha[i] > 0.5 ? 1 : 0
  const { labels, sizes, count } = connectedComponents(binary, w, h)
  if (count > 0) {
    let biggest = 0
    for (let i = 1; i < count; i++) if (sizes[i] > sizes[biggest]) biggest = i
    const biggestId = biggest + 1
    for (let i = 0; i < n; i++) {
      const l = labels[i]
      if (l === 0) {
        alpha[i] = 0
        continue
      }
      if (l === biggestId) continue
      // ohrani komponente znotraj kvadra, ki so dovolj velike (stebri ob robu)
      const inside = quadMask ? quadMask[i] === 1 : false
      if (inside && sizes[l - 1] > CUTOUT_MIN_COMPONENT) continue
      alpha[i] = 0
    }
  }
  // mehak rob (python: GaussianBlur (3,3), σ0.8)
  alpha = gaussBlurFloat(alpha, w, h, 0.8)
  const bbox = bboxAbove(alpha, w, h, 0.5)
  return { alpha, w, h, bbox }
}

/** Debug: profil pokritosti zadnjega countLetvice klica (merilni orodji/testi). */
export const countLetviceDebug: { lastProfile: number[] | null } = { lastProfile: null }

/** Rektificiraj alpha v pravokotnik rw×rh in preštej letvice (python korak 8b). */
export function countLetvice(
  alpha: Float32Array,
  w: number,
  h: number,
  quad: Corners,
  rw = 700,
  rh = 300,
): number {
  const dst: Corners = [
    [0, 0],
    [rw, 0],
    [rw, rh],
    [0, rh],
  ]
  let H: number[]
  try {
    H = solveHomography(quad, dst)
  } catch {
    return 0
  }
  const rect = warpFloat(alpha, w, h, H, rw, rh)
  const cx0 = Math.floor(rw * 0.35)
  const cx1 = Math.ceil(rw * 0.65)
  const stripW = cx1 - cx0
  // Števec je 1:1 iz pythona (prag 0.5 na pokritosti vrstice). S+3 izpit:
  // profili T1–T5 (countLetviceDebug.lastProfile) so čisti — 13 ločenih
  // ON tekov; hystereza/median poskusi so ZAVRŽENI (zlivajo prave vrzeli,
  // ker vrzeli lahko dosežejo pokritost 0.46–0.49).
  const cover: number[] = []
  for (let y = 0; y < rh; y++) {
    let sum = 0
    const row = y * rw
    for (let x = cx0; x < cx1; x++) sum += rect[row + x] > 0.5 ? 1 : 0
    cover.push(sum / stripW)
  }
  countLetviceDebug.lastProfile = cover
  let count = 0
  let prev = false
  for (const v of cover) {
    const on = v > 0.5
    if (on && !prev) count++
    prev = on
  }
  return count
}

/** Maska ImageBuffer (belo = območje) → float 0..1 plane, resize na (W,H) po potrebi. */
function maskToFloatPlane(mask: ImageBuffer, W: number, H: number): Float32Array {
  const n = mask.w * mask.h
  const plane = new Float32Array(n)
  for (let i = 0, p = 0; i < n; i++, p += 4) plane[i] = mask.data[p] / 255
  if (mask.w !== W || mask.h !== H) {
    return resizeNearestF32(plane, mask.w, mask.h, W, H)
  }
  return plane
}

export interface PipelineInput {
  original: ImageBuffer
  mask: ImageBuffer
  product: ImageBuffer
  productMask: ImageBuffer | null
  cornersPx: Corners
  productQuadPx: Corners | null
  options?: PipelineOptions
}

export interface PipelineResult {
  preview: ImageBuffer
  metrics: PipelineMetrics
}

/** A-pipeline — deterministična geometrija + klasična sinteza (NI generativni AI). */
export function runPipeline(input: PipelineInput): PipelineResult {
  const tAll = now()
  const steps: Record<string, number> = {}
  const { original, product } = input
  const W = original.w
  const H = original.h
  const nOrig = W * H

  // ── 1. maska stare ograje ────────────────────────────────────────────────
  let mask01 = maskToFloatPlane(input.mask, W, H)
  const maskBin = new Uint8Array(nOrig)
  for (let i = 0; i < nOrig; i++) maskBin[i] = mask01[i] > 0.5 ? 1 : 0

  // ── 2. izrez produkta ────────────────────────────────────────────────────
  let t0 = now()
  // S+8: če je podan productMask (exact alpha iz FenceLayout/renderFenceMask
  // ali mask-editorja), je TO točen vir alfe — ne prag svetlosti. Brez maske:
  // enako kot prej (bajtno identično — obstoječi determinism test ostaja).
  const cut = input.productMask
    ? maskToCutout(input.productMask, product.w, product.h)
    : cutoutProduct(product, input.productQuadPx ?? null)
  steps['cutout'] = now() - t0
  const productMaskUsed = input.productMask !== null
  // samodejni productQuad = tight bbox izreza (frontalni pravokotnik)
  const productQuadPx: Corners =
    input.productQuadPx ??
    (cut.bbox
      ? ([
          [cut.bbox.x0, cut.bbox.y0],
          [cut.bbox.x1, cut.bbox.y0],
          [cut.bbox.x1, cut.bbox.y1],
          [cut.bbox.x0, cut.bbox.y1],
        ] as Corners)
      : ([
          [0, 0],
          [product.w - 1, 0],
          [product.w - 1, product.h - 1],
          [0, product.h - 1],
        ] as Corners))

  // ── 3. odstranitev stare ograje — stolpična linearna sinteza ozadja ─────
  t0 = now()
  const bg = new Float32Array(nOrig * 3)
  for (let i = 0; i < nOrig; i++) {
    bg[i * 3] = original.data[i * 4]
    bg[i * 3 + 1] = original.data[i * 4 + 1]
    bg[i * 3 + 2] = original.data[i * 4 + 2]
  }
  for (let x = 0; x < W; x++) {
    let yt = -1
    let yb = -1
    for (let y = 0; y < H; y++) {
      if (maskBin[y * W + x]) {
        if (yt < 0) yt = y
        yb = y
      }
    }
    if (yt < 0) continue
    // ref vzorčenje NADALJ od roba (14px pas, preskoči 6px ob robu) + median
    const topRows: number[] = []
    const botRows: number[] = []
    for (let y = Math.max(yt - 20, 0); y < Math.max(yt - 8, 1); y++) topRows.push(y)
    for (let y = Math.min(yb + 8, H - 1); y < Math.min(yb + 20, H); y++) botRows.push(y)
    for (let c = 0; c < 3; c++) {
      const topRef = medianOf(topRows.map((y) => original.data[(y * W + x) * 4 + c]))
      const botRef = medianOf(botRows.map((y) => original.data[(y * W + x) * 4 + c]))
      const len = yb - yt + 1
      for (let y = yt; y <= yb; y++) {
        const t = (y - yt) / Math.max(1, len - 1)
        bg[(y * W + x) * 3 + c] = topRef * (1 - t) + botRef * t
      }
    }
  }
  // blago zgladi vodoravne prelome (samo znotraj maske, maska σ2 kot utež)
  const bgRGBA: ImageBuffer = {
    data: new Uint8ClampedArray(nOrig * 4),
    w: W,
    h: H,
  }
  for (let i = 0; i < nOrig; i++) {
    bgRGBA.data[i * 4] = bg[i * 3]
    bgRGBA.data[i * 4 + 1] = bg[i * 3 + 1]
    bgRGBA.data[i * 4 + 2] = bg[i * 3 + 2]
    bgRGBA.data[i * 4 + 3] = 255
  }
  const smooth = gaussBlurRGBA(bgRGBA, 3)
  const m3 = gaussBlurFloat(mask01, W, H, 2)
  for (let i = 0; i < nOrig; i++) {
    // m3 × maska (binarna) — glajenje SE NE razliva izven maske (garancija:
    // original izven maske ostane pikslično enak; izboljšava python baseline,
    // kjer je Gauss mehko prelil čez rob maske)
    const m = m3[i] * maskBin[i]
    if (m > 0) {
      for (let c = 0; c < 4; c++) {
        bgRGBA.data[i * 4 + c] = bgRGBA.data[i * 4 + c] * (1 - m) + smooth.data[i * 4 + c] * m
      }
    }
  }
  steps['bg_column_lerp'] = now() - t0

  // ── 4. 4-točkovna perspektiva (GEOMETRIJA — ne AI!) ─────────────────────
  t0 = now()
  const Hom = solveHomography(productQuadPx, input.cornersPx)
  const warped = warpPremultiplied(product, cut.alpha, Hom, W, H)
  const warpColor = warped.color
  const warpA = warped.alpha
  steps['perspective_warp'] = now() - t0

  // ── 5. luminance-only harmonizacija (RAL-VARNO barvno ujemanje) ─────────
  t0 = now()
  let harmonizeStrength = 0
  let warpHarm = warpColor
  let aBefore = 128
  let aAfter = 128
  let bBefore = 128
  let bAfter = 128
  let chromaDE = 0
  const harmonize = input.options?.harmonize !== false
  if (harmonize) {
    // ring = dilate(mask, 61×61) − erode(mask, 9×9)
    const dil = dilateBinary(maskBin, W, H, 30)
    const ero = erodeBinary(maskBin, W, H, 4)
    // nizkofrekvčna osvetlitev okolice (illumination field)
    const sceneLab = rgb2lab(bgRGBA)
    const illum = gaussBlurFloat(sceneLab.L, W, H, 25)
    let ringSum = 0
    let ringN = 0
    for (let i = 0; i < nOrig; i++) {
      if (dil[i] === 1 && ero[i] === 0) {
        ringSum += illum[i]
        ringN++
      }
    }
    const illumRingMean = ringN > 0 ? ringSum / ringN : 128.0
    // polje = 1.0 na povprečju okolice → NIVO SVETLOSTI IZDELKA SE OHRANI
    const field = new Float32Array(nOrig)
    for (let i = 0; i < nOrig; i++) {
      const f = illum[i] / Math.max(illumRingMean, 1.0)
      field[i] = f < 0.85 ? 0.85 : f > 1.15 ? 1.15 : f
    }
    const prodLab = rgb2lab(warpColor)
    let lSum = 0
    let lN = 0
    for (let i = 0; i < nOrig; i++) {
      if (warpA[i] > 0.5) {
        lSum += prodLab.L[i]
        lN++
      }
    }
    const lMuProd = lN > 0 ? lSum / lN : 128.0
    // zaščita temnega izdelka (RAL 9005/7016): manjša modulacija, nivo ostane
    harmonizeStrength = lMuProd < 70 ? 0.6 : 1.0
    const strength = harmonizeStrength
    const Lnew = new Float32Array(nOrig)
    for (let i = 0; i < nOrig; i++) {
      Lnew[i] = Math.min(255, Math.max(0, prodLab.L[i] * (1.0 + strength * (field[i] - 1.0))))
    }
    // kroma metrike (RAL varnost): a/b pred/po na pikslih izdelka (>0.9)
    let aB = 0
    let bB = 0
    let aA = 0
    let bA = 0
    let mN = 0
    let deSum = 0
    for (let i = 0; i < nOrig; i++) {
      if (warpA[i] > 0.9) {
        aB += prodLab.a[i]
        bB += prodLab.b[i]
        aA += prodLab.a[i] // a/b se NESPREMENI — merimo za dokaz
        bA += prodLab.b[i]
        mN++
      }
    }
    if (mN > 0) {
      aBefore = aB / mN
      aAfter = aA / mN
      bBefore = bB / mN
      bAfter = bA / mN
      chromaDE = Math.sqrt((aAfter - aBefore) ** 2 + (bAfter - bBefore) ** 2)
    }
    warpHarm = lab2rgb(Lnew, prodLab.a, prodLab.b, W, H)
  }
  steps['luminance_harmonize'] = now() - t0

  // ── 6. feather blending (EdgeBlender repoja: radius 3, gaussian) ────────
  t0 = now()
  const feather = input.options?.feather ?? 3
  const feathered = gaussBlurFloat(warpA, W, H, feather)
  // CLIP NA BINARNO MASKO → diff izven maske = 0 pred senco (feather se zgodi
  // znotraj maske, rob je čist 0 izven — pikslična garancija ohranjenosti)
  const weight = new Float32Array(nOrig)
  for (let i = 0; i < nOrig; i++) weight[i] = feathered[i] * maskBin[i]
  const comp = new Uint8ClampedArray(nOrig * 4)
  for (let i = 0; i < nOrig; i++) {
    const wgt = weight[i]
    for (let c = 0; c < 3; c++) {
      comp[i * 4 + c] = bgRGBA.data[i * 4 + c] * (1 - wgt) + warpHarm.data[i * 4 + c] * wgt
    }
    comp[i * 4 + 3] = 255
  }
  steps['feather_blend'] = now() - t0

  // DOKAZILO: original izven maske MORA biti enak (pred senco)
  let outsideMaxPreShadow = 0
  let outsideSumPre = 0
  let outsideN = 0
  for (let i = 0; i < nOrig; i++) {
    if (maskBin[i] === 0) {
      let d = 0
      for (let c = 0; c < 3; c++) d += Math.abs(original.data[i * 4 + c] - comp[i * 4 + c])
      if (d > outsideMaxPreShadow) outsideMaxPreShadow = d
      outsideSumPre += d
      outsideN++
    }
  }

  // ── 7. kontaktna senca ob spodnjem robu ograje ──────────────────────────
  t0 = now()
  const shadowOn = input.options?.shadow !== false
  if (shadowOn) {
    const bl = input.cornersPx[3]
    const br = input.cornersPx[2]
    const shadow = new Float32Array(nOrig)
    for (let i = 0; i < 28; i++) {
      const t = i / 28.0
      const yTop = Math.floor(bl[1] + 4 + t * 18)
      const yBot = Math.floor(bl[1] + 30 + 2 + t * 18)
      const xl = Math.floor(bl[0])
      const xr = Math.floor(br[0])
      const val = (1 - t) * 0.22
      for (let y = Math.max(0, yTop); y < Math.min(H, yBot); y++) {
        const row = y * W
        for (let x = Math.max(0, xl); x < Math.min(W, xr); x++) {
          if (val > shadow[row + x]) shadow[row + x] = val
        }
      }
    }
    const shadowBlur = gaussBlurFloat(shadow, W, H, 5)
    for (let i = 0; i < nOrig; i++) {
      const s = shadowBlur[i] * 0.4
      if (s > 0) {
        for (let c = 0; c < 3; c++) {
          comp[i * 4 + c] = comp[i * 4 + c] * (1 - s)
        }
      }
    }
  }
  steps['contact_shadow'] = now() - t0

  // diff po senci (senca se rahlo raztegne izven maske — pričakovano > 0)
  let outsideMax = 0
  let outsideSum = 0
  for (let i = 0; i < nOrig; i++) {
    if (maskBin[i] === 0) {
      let d = 0
      for (let c = 0; c < 3; c++) d += Math.abs(original.data[i * 4 + c] - comp[i * 4 + c])
      if (d > outsideMax) outsideMax = d
      outsideSum += d
    }
  }

  // ── 8b. DOKAZILO IDENTITETE: štetje letvic v rektificiranem prostoru ────
  t0 = now()
  const letviceProduct = countLetvice(cut.alpha, product.w, product.h, productQuadPx)
  const letviceResult = countLetvice(warpA, W, H, input.cornersPx)
  steps['letvice_count'] = now() - t0

  let alphaN = 0
  for (let i = 0; i < nOrig; i++) if (warpA[i] > 0.5) alphaN++

  const metrics: PipelineMetrics = {
    timeMs: Math.round(now() - tAll),
    steps: Object.fromEntries(Object.entries(steps).map(([k, v]) => [k, Math.round(v)])),
    letviceProduct,
    letviceResult,
    letviceIdentityOk: letviceProduct === letviceResult,
    outsideMax,
    outsideMean: outsideN > 0 ? Math.round((outsideSum / outsideN) * 10000) / 10000 : 0,
    outsideMaxPreShadow,
    chroma: {
      aBefore: round4(aBefore),
      aAfter: round4(aAfter),
      bBefore: round4(bBefore),
      bAfter: round4(bAfter),
      dE: round4(chromaDE),
    },
    harmonizeStrength,
    alphaCoverage: Math.round((alphaN / nOrig) * 10000) / 10000,
    productMaskUsed,
  }

  return { preview: { data: comp, w: W, h: H }, metrics }
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0
  const arr = values.slice().sort((a, b) => a - b)
  const mid = arr.length >> 1
  return arr.length % 2 === 1 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}
