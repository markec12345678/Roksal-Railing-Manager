/**
 * S+8 — DATASET T1–T5 + BARVNA MATRIKA + VISUAL MATRIX + IDENTITETA (spec §14–§16).
 *
 * Vsi testi tečejo skozi NOVO deterministično pot Product SDK (spec §20):
 *   productId → katalog → FenceLayout → render (produktni koordinate)
 *   → exact maska iz layout-a → A-pipeline homografija → balkon.
 *
 * Visual matrix (§16): ORIGINAL | PRODUCT | PROCEDURAL | A | MASK | FINAL.
 * Barvna matrika (§15): temen/srednji/svetel za 3 profile; svetel (WHITE) je
 * P0 — dokaz, da productMask (geometrija) NE naredi svetlih izdelkov
 * prosojnih (S+7 kvantificirana omejitev je REŠENA).
 *
 * T4/T5: brez realnih assetov → proceduralni test asset, OZNAČEN synthetic
 * (assetQuality insufficient — ni lažnega "uradnega" produkta).
 * Uporaba: bun tools/s8-dataset.ts
 */
import sharp from 'sharp'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { runPipeline } from '../src/lib/viz/pipeline'
import { solveHomography, warpFloat, warpImage } from '../src/lib/viz/homography'
import { productSdk } from '../src/lib/product-sdk'
import type { Corners, ImageBuffer, VizPlacement } from '../src/lib/viz/types'
import { cornerToPx } from '../src/lib/viz/types'

const ROOT = path.join(__dirname, '..')
const S6 = path.join(ROOT, 'evaluation', 'dataset')
const OUT = path.join(ROOT, 'evaluation', 'dataset')
const SHEETS = path.join(ROOT, 'evaluation', 'contact-sheets')
const ASSETS = path.join(ROOT, 'evaluation', 'roksal-assets')
mkdirSync(SHEETS, { recursive: true })

// ---------- Testi (spec §14: T1–T5) ----------

interface S8Test {
  id: string
  title: string
  productId: string
  orientation: 'horizontal' | 'vertical'
  gapMm: number
  fenceHeightMm: number
  /** Izrez realne referenčne fotografije za PRODUCT stolpec (pravice pending). */
  crop?: { src: string; x: number; y: number; w: number; h: number }
  /** Izmerjen RGB iz S+7 referenc (neuradno, odkrito). */
  measuredRgb: [number, number, number]
  colorId: string
  synthetic: boolean
  note: string
}

const TESTS: S8Test[] = [
  {
    id: 'S8-T1-romb67-horizontal',
    title: 'T1 — ROMB 67 / Amazon Wood / prečno',
    productId: 'woodcore-romb-67',
    orientation: 'horizontal',
    gapMm: 20,
    fenceHeightMm: 900,
    crop: { src: 't1-romb-amazon-reference.jpg', x: 296, y: 392, w: 1248, h: 366 },
    measuredRgb: [65, 62, 62],
    colorId: 'amazon-wood',
    synthetic: false,
    note: 'realni referenčni izrez iz S+7 (rights pending); temen odtenek',
  },
  {
    id: 'S8-T2-polna128-horizontal',
    title: 'T2 — POLNA 128 / Rustic Oak / prečno',
    productId: 'woodcore-polna-128',
    orientation: 'horizontal',
    gapMm: 20,
    fenceHeightMm: 900,
    crop: { src: 't2-polna128-reference.jpg', x: 268, y: 290, w: 542, h: 565 },
    measuredRgb: [116, 92, 74],
    colorId: 'rustic-oak',
    synthetic: false,
    note: 'realni referenčni izrez iz S+7 (rights pending); srednji lesni odtenek',
  },
  {
    id: 'S8-T3-polna100-vertical',
    title: 'T3 — POLNA 100 / Burma Teak / pokončno',
    productId: 'woodcore-polna-100',
    orientation: 'vertical',
    gapMm: 20,
    fenceHeightMm: 650,
    crop: { src: 't3-polna100-vertical-reference.jpg', x: 540, y: 485, w: 540, h: 205 },
    measuredRgb: [150, 131, 113],
    colorId: 'burma-teak',
    synthetic: false,
    note: 'realni referenčni izrez iz S+7 (rights pending); SVETEL odtenek — P0',
  },
  {
    id: 'S8-T4-polna-57-32-vertical',
    title: 'T4 — POLNA 57/32 / srednji / pokončno',
    productId: 'woodcore-polna-57-32',
    orientation: 'vertical',
    gapMm: 25,
    fenceHeightMm: 700,
    measuredRgb: [116, 92, 74],
    colorId: 'rustic-oak',
    synthetic: true,
    note: 'SYNTHETIC asset (ni realne fotografije; assetQuality insufficient) — odkrito označeno',
  },
  {
    id: 'S8-T5-kubo-80-42-vertical',
    title: 'T5 — KUBO 80/42 / srednji / pokončno (SYNTHETIC)',
    productId: 'woodcore-kubo-80-42',
    orientation: 'vertical',
    gapMm: 30,
    fenceHeightMm: 700,
    measuredRgb: [96, 82, 66],
    colorId: 'rustic-oak',
    synthetic: true,
    note: 'SYNTHETIC procedural asset za KUBO (spec §14 dovoljuje; čistega asseta ni — insufficient). Uradni vir: fasadni profil, samo vertikalno',
  },
]

// ---------- Barvna matrika (spec §15: temen/srednji/svetel × 3 profili; svetel = P0) ----------

const COLOR_MATRIX = [
  { productId: 'woodcore-romb-67', orientation: 'horizontal' as const, label: 'temen', colorId: 'amazon-wood', rgb: [65, 62, 62] as [number, number, number], source: 'izmerjeno iz S+7 referenčne fotografije (neuradno)' },
  { productId: 'woodcore-romb-67', orientation: 'horizontal' as const, label: 'srednji', colorId: 'rustic-oak', rgb: [116, 92, 74] as [number, number, number], source: 'izmerjeno iz S+7 referenčne fotografije (neuradno)' },
  { productId: 'woodcore-romb-67', orientation: 'horizontal' as const, label: 'svetel (P0)', colorId: 'white', rgb: [244, 242, 236] as [number, number, number], source: 'SYNTHETIC WHITE — uradni hex ne obstaja (approxHex=null)' },
  { productId: 'woodcore-polna-128', orientation: 'horizontal' as const, label: 'temen', colorId: 'amazon-wood', rgb: [65, 62, 62] as [number, number, number], source: 'izmerjeno (neuradno)' },
  { productId: 'woodcore-polna-128', orientation: 'horizontal' as const, label: 'srednji', colorId: 'rustic-oak', rgb: [116, 92, 74] as [number, number, number], source: 'izmerjeno iz S+7 (neuradno)' },
  { productId: 'woodcore-polna-128', orientation: 'horizontal' as const, label: 'svetel (P0)', colorId: 'white', rgb: [244, 242, 236] as [number, number, number], source: 'SYNTHETIC WHITE' },
  { productId: 'woodcore-polna-100', orientation: 'vertical' as const, label: 'temen', colorId: 'amazon-wood', rgb: [65, 62, 62] as [number, number, number], source: 'izmerjeno (neuradno)' },
  { productId: 'woodcore-polna-100', orientation: 'vertical' as const, label: 'srednji', colorId: 'burma-teak', rgb: [150, 131, 113] as [number, number, number], source: 'izmerjeno iz S+7 (neuradno)' },
  { productId: 'woodcore-polna-100', orientation: 'vertical' as const, label: 'svetel (P0)', colorId: 'white', rgb: [244, 242, 236] as [number, number, number], source: 'SYNTHETIC WHITE' },
]

// ---------- Pomožniki ----------

async function toRaw(buf: Buffer): Promise<ImageBuffer> {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true })
  const w = info.width
  const h = info.height
  const out = new Uint8ClampedArray(w * h * 4)
  if (info.channels === 4) out.set(data.subarray(0, w * h * 4))
  else if (info.channels === 3) {
    for (let i = 0, j = 0; i < w * h; i++, j += 3) {
      out[i * 4] = data[j]
      out[i * 4 + 1] = data[j + 1]
      out[i * 4 + 2] = data[j + 2]
      out[i * 4 + 3] = 255
    }
  } else {
    for (let i = 0; i < w * h; i++) {
      const g = data[i]
      out[i * 4] = g
      out[i * 4 + 1] = g
      out[i * 4 + 2] = g
      out[i * 4 + 3] = 255
    }
  }
  return { data: out, w, h }
}

async function rawToJpg(img: ImageBuffer, file: string, q = 92): Promise<void> {
  await sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength), {
    raw: { width: img.w, height: img.h, channels: 4 },
  })
    .jpeg({ quality: q })
    .toFile(file)
}

async function rawToPng(img: ImageBuffer, file: string): Promise<void> {
  await sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength), {
    raw: { width: img.w, height: img.h, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toFile(file)
}

interface Cell {
  img: ImageBuffer
  label: string
}

async function makeSheet(rows: Cell[][], file: string, cellW = 300, cellH = 210): Promise<void> {
  const gap = 6
  const labelH = 26
  const cols = rows[0].length
  const W = gap + cols * (cellW + gap)
  const H = gap + rows.length * (labelH + cellH + gap)
  const canvas = sharp({
    create: { width: W, height: H, channels: 3, background: { r: 250, g: 250, b: 250 } },
  })
  const composites: sharp.OverlayOptions[] = []
  for (let ri = 0; ri < rows.length; ri++) {
    for (let ci = 0; ci < rows[ri].length; ci++) {
      const cell = rows[ri][ci]
      const x = gap + ci * (cellW + gap)
      const y = gap + ri * (labelH + cellH + gap)
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cellW}" height="${labelH}">
        <rect width="100%" height="100%" fill="#1c1917"/>
        <text x="6" y="18" font-family="DejaVu Sans, sans-serif" font-size="12" fill="#fafaf9">${cell.label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>
      </svg>`
      const labelPng = await sharp(Buffer.from(svg)).png().toBuffer()
      composites.push({ input: labelPng, left: x, top: y })
      const imgBuf = await sharp(
        Buffer.from(cell.img.data.buffer, cell.img.data.byteOffset, cell.img.data.byteLength),
        { raw: { width: cell.img.w, height: cell.img.h, channels: 4 } }
      )
        .resize(cellW, cellH, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .jpeg({ quality: 90 })
        .toBuffer()
      composites.push({ input: imgBuf, left: x, top: y + labelH })
    }
  }
  await canvas.composite(composites).jpeg({ quality: 92 }).toFile(file)
}

async function centerCrop(img: ImageBuffer, frac = 0.45): Promise<ImageBuffer> {
  const w = Math.round(img.w * frac)
  const h = Math.round(img.h * frac)
  const buf = await sharp(
    Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength),
    { raw: { width: img.w, height: img.h, channels: 4 } }
  )
    .extract({ left: Math.round((img.w - w) / 2), top: Math.round((img.h - h) / 2), width: w, height: h })
    .raw()
    .toBuffer()
  const out = new Uint8ClampedArray(w * h * 4)
  out.set(buf.subarray(0, w * h * 4))
  return { data: out, w, h }
}

/** Utežena sredina slike (za izmerjeno svetlost/gray — meritev, ne trditev). */
function meanGray(img: ImageBuffer): number {
  let sum = 0
  const n = img.w * img.h
  for (let i = 0; i < n; i++) {
    const p = i * 4
    sum += 0.299 * img.data[p] + 0.587 * img.data[p + 1] + 0.114 * img.data[p + 2]
  }
  return Math.round((sum / n) * 10) / 10
}

/** "Izrisanost" znotraj kvadra: delež pikslov, ki se razlikujejo od interpoliranega ozadja. */
function drawnness(original: ImageBuffer, composite: ImageBuffer, corners: Corners): number {
  const xs = corners.map((c) => c[0])
  const ys = corners.map((c) => c[1])
  const x0 = Math.max(0, Math.floor(Math.min(...xs)))
  const x1 = Math.min(original.w - 1, Math.ceil(Math.max(...xs)))
  const y0 = Math.max(0, Math.floor(Math.min(...ys)))
  const y1 = Math.min(original.h - 1, Math.ceil(Math.max(...ys)))
  let drawn = 0
  let n = 0
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * original.w + x) * 4
      const d =
        Math.abs(original.data[i] - composite.data[i]) +
        Math.abs(original.data[i + 1] - composite.data[i + 1]) +
        Math.abs(original.data[i + 2] - composite.data[i + 2])
      if (d > 36) drawn++
      n++
    }
  }
  return n > 0 ? Math.round((drawn / n) * 10000) / 10000 : 0
}

/**
 * Orientacije-zaveden števec ploskovic na rezultatu (orodje, NE pipeline):
 * kvader rektificira v 700×300; horizontal → profil po vrsticah, vertical →
 * po stolpcih. (A-pipeline countLetvice je horizontalno-specifičen —
 * zamrznjen; vertical šteje to orodje.) Ponovno uporablja src/lib/viz.
 */
function countBoardsRect(
  img: ImageBuffer,
  quadPx: Corners,
  orientation: 'horizontal' | 'vertical',
): { dark: number; bright: number } {
  const rw = 700
  const rh = 300
  const dst: Corners = [
    [0, 0],
    [rw, 0],
    [rw, rh],
    [0, rh],
  ]
  let H: number[]
  try {
    H = solveHomography(quadPx, dst)
  } catch {
    return { dark: -1, bright: -1 }
  }
  const rectRGBA = warpImage(img, H, rw, rh)
  const lum = new Float32Array(rw * rh)
  for (let i = 0; i < rw * rh; i++) {
    const o = i * 4
    lum[i] = 0.299 * rectRGBA.data[o] + 0.587 * rectRGBA.data[o + 1] + 0.114 * rectRGBA.data[o + 2]
  }
  const mid0 = orientation === 'horizontal' ? Math.floor(rw * 0.35) : Math.floor(rh * 0.35)
  const mid1 = orientation === 'horizontal' ? Math.ceil(rw * 0.65) : Math.ceil(rh * 0.65)
  const profile: number[] = []
  const span = orientation === 'horizontal' ? rh : rw
  const stripW = mid1 - mid0
  for (let s = 0; s < span; s++) {
    let sum = 0
    for (let m = mid0; m < mid1; m++) {
      const lumIdx = orientation === 'horizontal' ? s * rw + m : m * rw + s
      sum += lum[lumIdx]
    }
    profile.push(sum / stripW)
  }
  const win = Math.max(5, Math.round(span / 12)) | 1
  const half = (win - 1) / 2
  const resid: number[] = profile.map((_, s) => {
    let sum = 0
    let n = 0
    for (let k = -half; k <= half; k++) {
      const j = s + k
      if (j >= 0 && j < span) {
        sum += profile[j]
        n++
      }
    }
    return profile[s] - sum / n
  })
  let varSum = 0
  for (const v of resid) varSum += v * v
  const sigma = Math.sqrt(varSum / resid.length)
  const thrD = -0.5 * sigma
  const thrB = 0.5 * sigma
  let dark = 0
  let bright = 0
  let prevD = false
  let prevB = false
  for (const v of resid) {
    const onD = v < thrD
    const onB = v > thrB
    if (onD && !prevD) dark++
    if (onB && !prevB) bright++
    prevD = onD
    prevB = onB
  }
  return { dark, bright }
}

/**
 * Neprozornost PLOSKVIC: delež pikslov znotraj warped product maske, kjer je
 * končni kompozit dovolj različen od background-only run-a. Če bi svetli
 * produkt postal prosojen (S+7 bug), ta številka pade — P0 dokaz (§12).
 * Homografija = ISTA kot v pipeline (produkt kvader → scenni vogali).
 */
function boardOpacity(
  final: ImageBuffer,
  bgOnly: ImageBuffer,
  productMask: ImageBuffer,
  corners: Corners,
): number {
  const W = final.w
  const Hh = final.h
  const srcQuad: Corners = [
    [0, 0],
    [productMask.w - 1, 0],
    [productMask.w - 1, productMask.h - 1],
    [0, productMask.h - 1],
  ]
  let H: number[]
  try {
    H = solveHomography(srcQuad, corners)
  } catch {
    return 0
  }
  const plane = new Float32Array(productMask.w * productMask.h)
  for (let i = 0; i < productMask.w * productMask.h; i++) plane[i] = productMask.data[i * 4] / 255
  const warpedMask = warpFloat(plane, productMask.w, productMask.h, H, W, Hh)
  let drawn = 0
  let n = 0
  for (let i = 0; i < W * Hh; i++) {
    if (warpedMask[i] > 0.5) {
      const p = i * 4
      const d =
        Math.abs(final.data[p] - bgOnly.data[p]) +
        Math.abs(final.data[p + 1] - bgOnly.data[p + 1]) +
        Math.abs(final.data[p + 2] - bgOnly.data[p + 2])
      if (d > 24) drawn++
      n++
    }
  }
  return n > 0 ? Math.round((drawn / n) * 10000) / 10000 : 0
}

/**
 * TOČNO štetje rež na proceduralnem renderju (pre-warp, produktni koordinate):
 * reže so čisto bele (255,255,255) — štetje belih tekov po sredinskih 60 %
 * osi zlaganja. Deterministično, brez detrending hevristik.
 * Pričakovano: reži = boardCount − 1 (deske od spodaj/levo, zadnja odrezana).
 * Stebrne cone (px območja po x) so IZKLJUČENE — stebri so vidni v režah
 * (za deskami) in NISO reže.
 */
function countGapsExact(
  img: ImageBuffer,
  orientation: 'horizontal' | 'vertical',
  postZonesPx: Array<[number, number]> = [],
): { gaps: number; whiteRows: number } {
  const horizontal = orientation === 'horizontal'
  const span = horizontal ? img.h : img.w
  const stripLen = horizontal ? img.w : img.h
  const s0 = Math.floor(stripLen * 0.2)
  const s1 = Math.ceil(stripLen * 0.8)
  const inZone = (m: number): boolean => postZonesPx.some(([a, b]) => m >= a && m <= b)
  let gaps = 0
  let whiteRows = 0
  let prev = false
  for (let s = 0; s < span; s++) {
    // vertical: celega stebrnega stolpca ne šteješ kot kandidata za režo
    if (!horizontal && inZone(s)) {
      prev = false
      continue
    }
    let whiteN = 0
    let totalN = 0
    for (let m = s0; m < s1; m++) {
      if (horizontal && inZone(m)) continue // stebri prečkajo režne vrstice
      const i = horizontal ? (s * img.w + m) * 4 : (m * img.w + s) * 4
      totalN++
      if (img.data[i] >= 250 && img.data[i + 1] >= 250 && img.data[i + 2] >= 250) whiteN++
    }
    if (totalN === 0) {
      prev = false
      continue
    }
    const isWhite = whiteN >= totalN * 0.98
    if (isWhite) whiteRows++
    if (isWhite && !prev) gaps++
    prev = isWhite
  }
  return { gaps, whiteRows }
}

/** Stebrne cone v px (za izključitev pri štetju rež — stebri so vidni v režah). */
function postZonesOf(layout: { posts: Array<{ centerMm: number; widthMm: number }>; fenceWidthMm: number }, outW: number): Array<[number, number]> {
  if (layout.posts.length === 0) return []
  const pxPerMm = outW / layout.fenceWidthMm
  return layout.posts.map((p) => [
    Math.max(0, Math.round((p.centerMm - p.widthMm / 2 - 2) * pxPerMm)),
    Math.min(outW - 1, Math.round((p.centerMm + p.widthMm / 2 + 2) * pxPerMm)),
  ])
}

const EPS_MM = 1e-9
/**
 * Pričakovane VIDNE reže = boardCount−1 − reže, ki jih steber POPOLNOMA pokrije
 * (vertical: reža = stolpec; steber pred njo → ni bela, fizično pravilno).
 * Deterministično iz layout-a + px preslikave — ni hevristika.
 */
function expectedVisibleGaps(layout: { boards: Array<{ startMm: number; visibleMm: number }>; posts: Array<{ centerMm: number; widthMm: number }>; fenceWidthMm: number }, orientation: 'horizontal' | 'vertical', outW: number): number {
  const total = layout.boards.length - 1
  if (orientation !== 'vertical' || layout.posts.length === 0) return total
  const pxPerMm = outW / layout.fenceWidthMm
  let hidden = 0
  for (let i = 0; i < total; i++) {
    const gapStart = layout.boards[i].startMm + layout.boards[i].visibleMm
    const gapEnd = layout.boards[i + 1].startMm
    if (gapEnd - gapStart < EPS_MM) continue
    const ga = Math.round(gapStart * pxPerMm)
    const ge = Math.round(gapEnd * pxPerMm)
    for (const p of layout.posts) {
      const a = Math.round((p.centerMm - p.widthMm / 2 - 2) * pxPerMm)
      const b = Math.round((p.centerMm + p.widthMm / 2 + 2) * pxPerMm)
      if (ga >= a && ge <= b) {
        hidden++
        break
      }
    }
  }
  return total - hidden
}

async function loadS6Scene(): Promise<{ original: ImageBuffer; mask: ImageBuffer; placement: VizPlacement }> {
  const s6Dir = path.join(S6, 'S6-T1-ravna-antracit')
  const original = await toRaw(await sharp(path.join(s6Dir, 'original.jpg')).jpeg({ quality: 90 }).toBuffer())
  const maskRaw = await toRaw(await sharp(path.join(s6Dir, 'mask.png')).toBuffer())
  const maskData = new Uint8ClampedArray(maskRaw.w * maskRaw.h * 4)
  for (let i = 0; i < maskRaw.w * maskRaw.h; i++) {
    const v = maskRaw.data[i * 4] > 127 ? 255 : 0
    maskData[i * 4] = v
    maskData[i * 4 + 1] = v
    maskData[i * 4 + 2] = v
    maskData[i * 4 + 3] = 255
  }
  const placement = JSON.parse(
    await import('node:fs').then((fs) => fs.readFileSync(path.join(s6Dir, 'placement.json'), 'utf8')),
  ) as VizPlacement
  return { original, mask: { data: maskData, w: maskRaw.w, h: maskRaw.h }, placement }
}

// ---------- Glavni tok ----------

async function main(): Promise<void> {
  const { original, mask, placement } = await loadS6Scene()
  const cornersPx = cornerToPx(placement.corners, original.w, original.h)
  const quadW = Math.abs(cornersPx[1][0] - cornersPx[0][0]) + Math.abs(cornersPx[2][0] - cornersPx[3][0])
  const quadH = Math.abs(cornersPx[3][1] - cornersPx[0][1]) + Math.abs(cornersPx[2][1] - cornersPx[1][1])
  const quadAspect = quadW / quadH

  const identityRows: Record<string, unknown>[] = []
  const colorRows: Record<string, unknown>[] = []
  const manifest: Record<string, unknown> = {
    round: 'S+8',
    scene: 'S6-T1-ravna-antracit (čista scena, S+7 izbor — brez stock-žigov)',
    pipeline: 'product-sdk (katalog → layout → render+mask) → A-pipeline homografija',
    determinism: ' isti vhod → isti izhod (testi + renderFence byte-identical)',
  }

  for (const t of TESTS) {
    const dir = path.join(OUT, t.id)
    for (const sub of ['product', 'profile', 'procedural', 'preview']) mkdirSync(path.join(dir, sub), { recursive: true })

    const definition = productSdk.catalog.get(t.productId)
    if (!definition) throw new Error(`neznan productId ${t.productId}`)

    const spanMm = Math.round(t.fenceHeightMm * quadAspect)
    const maxPost = definition.mounting.maxPostSpacingByOrientation[t.orientation].maxSpacingMm
    const config = {
      productId: definition.id,
      orientation: t.orientation,
      spanMm,
      heightMm: t.fenceHeightMm,
      gapMm: t.gapMm,
      colorId: t.colorId,
      handle: false,
      posts: maxPost ? { widthMm: 60 } : null,
    }
    const layout = productSdk.layout(config, { definition })
    const outW = Math.max(4, Math.min(1600, Math.round(quadW)))
    const outH = Math.max(4, Math.min(1600, Math.round(quadH)))
    const { render, mask: productMask } = productSdk.renderWithMask({
      definition,
      config,
      layout,
      material: { colorId: t.colorId, measuredRgb: t.measuredRgb },
      outWidthPx: outW,
      outHeightPx: outH,
    })
    if (!render.renderValid) throw new Error(`${t.id}: padla invarianta ${render.invariants.failures.join('; ')}`)

    // determinizem dokaz na orodni ravni: ponovni render = byte-identičen
    const again = productSdk.renderWithMask({
      definition,
      config,
      layout,
      material: { colorId: t.colorId, measuredRgb: t.measuredRgb },
      outWidthPx: outW,
      outHeightPx: outH,
    })
    const byteIdentical = Buffer.from(again.render.image.data).equals(Buffer.from(render.image.data))

    // A (brez sence) + FINAL (harmonizacija + kontaktna senca) + bg-only (brez produkta)
    const runA = runPipeline({
      original, mask, product: render.image, productMask,
      cornersPx, productQuadPx: null,
      options: { shadow: false },
    })
    const runFinal = runPipeline({
      original, mask, product: render.image, productMask,
      cornersPx, productQuadPx: null,
    })
    const blackMask: ImageBuffer = { data: new Uint8ClampedArray(outW * outH * 4), w: outW, h: outH }
    const runBg = runPipeline({
      original, mask, product: render.image, productMask: blackMask,
      cornersPx, productQuadPx: null,
    })
    const maskVis: ImageBuffer = productMask
    // IDENTITY (§10) — determinističen DOKAZ: pre-warp števec na proceduralnem
    // renderju (produktni koordinate, brez šuma scene): svetli teki = vrzeli
    // = boardCount−1 / temni teki = boardCount. Post-composite = best-effort.
    const srcQuad: Corners = [
      [0, 0],
      [outW - 1, 0],
      [outW - 1, outH - 1],
      [0, outH - 1],
    ]
    const preWarp = countBoardsRect(render.image, srcQuad, t.orientation)
    const exact = countGapsExact(render.image, t.orientation, postZonesOf(layout, outW))
    const expectedGaps = expectedVisibleGaps(layout, t.orientation, outW)
    const sceneCount = countBoardsRect(runFinal.preview, cornersPx, t.orientation)

    // PRODUCT stolpec: realni izrez (T1–T3) ALI procedural (T4/T5, synthetic)
    let productCell: ImageBuffer
    if (t.crop) {
      productCell = await toRaw(
        await sharp(path.join(ASSETS, t.crop.src))
          .extract({ left: t.crop.x, top: t.crop.y, width: t.crop.w, height: t.crop.h })
          .toBuffer(),
      )
    } else {
      productCell = render.image
    }

    // artefakti
    await rawToJpg(render.image, path.join(dir, 'procedural', 'generated_fence.jpg'))
    await rawToPng(productMask, path.join(dir, 'procedural', 'generated_fence_mask.png'))
    writeFileSync(path.join(dir, 'procedural', 'layout.json'), JSON.stringify(layout, null, 2))
    await rawToJpg(runA.preview, path.join(dir, 'preview', 'a_preview.jpg'))
    await rawToJpg(runFinal.preview, path.join(dir, 'preview', 'final_preview.jpg'))
    await rawToPng(maskVis, path.join(dir, 'preview', 'mask.png'))
    if (t.crop) {
      await sharp(path.join(ASSETS, t.crop.src))
        .extract({ left: t.crop.x, top: t.crop.y, width: t.crop.w, height: t.crop.h })
        .jpeg({ quality: 92 })
        .toFile(path.join(dir, 'product', 'product.jpg'))
      // profile = ena deska (sredinski 1/pitch izrez produktnega stolpca) — poenostavljeno: sredinski pas
      const pw = Math.max(8, Math.round(productCell.w / Math.max(1, layout.boardCount)))
      await sharp(
        Buffer.from(productCell.data.buffer, productCell.data.byteOffset, productCell.data.byteLength),
        { raw: { width: productCell.w, height: productCell.h, channels: 4 } }
      )
        .extract({
          left: Math.max(0, Math.round(productCell.w / 2 - pw / 2)),
          top: 0,
          width: Math.min(pw, productCell.w),
          height: productCell.h,
        })
        .jpeg({ quality: 92 })
        .toFile(path.join(dir, 'profile', 'profile.jpg'))
    }

    // contact sheet: ORIGINAL | PRODUCT | PROCEDURAL | A | MASK | FINAL + 2× povečava (§14, §16)
    const sheetRows: Cell[][] = [
      [
        { img: original, label: 'ORIGINAL' },
        { img: productCell, label: t.synthetic ? 'PRODUCT (SYNTHETIC)' : 'PRODUCT (referenca, pending)' },
        { img: render.image, label: 'PROCEDURAL (SDK)' },
        { img: runA.preview, label: 'A (harmonize)' },
        { img: maskVis, label: 'MASK (iz FenceLayout)' },
        { img: runFinal.preview, label: 'FINAL (harmonize+senca)' },
      ],
    ]
    sheetRows.push([
      { img: await centerCrop(original), label: 'ORIGINAL ↕' },
      { img: await centerCrop(productCell), label: 'PRODUCT ↕' },
      { img: await centerCrop(render.image), label: 'PROCEDURAL ↕' },
      { img: await centerCrop(runA.preview), label: 'A ↕' },
      { img: await centerCrop(maskVis), label: 'MASK ↕' },
      { img: await centerCrop(runFinal.preview), label: 'FINAL ↕' },
    ])
    await makeSheet(sheetRows, path.join(SHEETS, `s8-contact-${t.id}.png`))

    // identitetna vrstica (§10): katalog vs izmerjeno
    const opacity = boardOpacity(runFinal.preview, runBg.preview, productMask, cornersPx)
    identityRows.push({
      test_id: t.id,
      productId: definition.id,
      profil: definition.profile.name,
      shape: definition.profile.shape,
      sirinaMm: definition.profile.faceWidthMm,
      debelinaMm: definition.profile.thicknessMm,
      steviloDesk_layout: layout.boardCount,
      steviloDesk_prewarp_detrend: preWarp.dark,
      vrzeli_prewarp_detrend: preWarp.bright,
      vrzeli_prewarp_exact: exact.gaps,
      vrzeli_pričakovane_vidne: expectedGaps,
      steviloDesk_scena_besteffort: sceneCount.dark,
      identiteta_ok:
        exact.gaps === expectedGaps &&
        (t.orientation === 'horizontal'
          ? runFinal.metrics.letviceProduct === runFinal.metrics.letviceResult
          : true),
      razmakMm: layout.gapMm,
      razmak_ok: layout.gapMm >= definition.board.minGapMm && layout.gapMm <= definition.board.maxGapMm,
      orientacija: layout.orientation,
      orientacija_podprta: definition.orientations.includes(t.orientation),
      barva_id: t.colorId,
      barva_izmerjena_hex:
        '#' + t.measuredRgb.map((v) => v.toString(16).padStart(2, '0')).join(''),
      barva_opomba: 'izmerjen približek (NEURADNO — uradni hex v katalogu ne obstaja)',
      tekstura: 'determinističen profilni vzorec (brez AI)',
      vijaki: definition.mounting.screwVisibility,
      konstrukcija: `${layout.posts.length} stebrov, ${layout.rails.length} cevi, ${layout.caps.length} čepov, ${layout.fasteners.length} vijakov`,
      warnings: layout.warnings,
      pravice: definition.rights,
      synthetic: t.synthetic,
      renderValid: render.renderValid,
      materialProvenance: render.materialProvenance,
      alphaCoverage: runFinal.metrics.alphaCoverage,
      productMaskUsed: runFinal.metrics.productMaskUsed,
      neprozornost_ploskvic: opacity,
      byteIdenticalRerun: byteIdentical,
      outsideMaxPreShadow: runFinal.metrics.outsideMaxPreShadow,
      timeMs: runFinal.metrics.timeMs,
      note: t.note,
    })
  }

  // ---------- Barvna matrika (§15) ----------
  for (const cm of COLOR_MATRIX) {
    const definition = productSdk.catalog.get(cm.productId)
    if (!definition) throw new Error(`neznan productId ${cm.productId}`)
    const spanMm = Math.round(900 * quadAspect)
    const config = {
      productId: definition.id,
      orientation: cm.orientation,
      spanMm,
      heightMm: 900,
      gapMm: 20,
      colorId: cm.colorId,
      handle: false,
      posts: definition.mounting.maxPostSpacingByOrientation[cm.orientation].maxSpacingMm ? { widthMm: 60 } : null,
    }
    const layout = productSdk.layout(config, { definition })
    const { render, mask: productMask } = productSdk.renderWithMask({
      definition,
      config,
      layout,
      material: { colorId: cm.colorId, measuredRgb: cm.rgb },
      outWidthPx: 640,
      outHeightPx: Math.round((640 * 900) / spanMm),
    })
    const run = runPipeline({ original, mask, product: render.image, productMask, cornersPx, productQuadPx: null })
    const blackMask: ImageBuffer = { data: new Uint8ClampedArray(640 * Math.round((640 * 900) / spanMm) * 4), w: 640, h: Math.round((640 * 900) / spanMm) }
    const runBg = runPipeline({ original, mask, product: render.image, productMask: blackMask, cornersPx, productQuadPx: null })
    const opacity = boardOpacity(run.preview, runBg.preview, productMask, cornersPx)
    const cmSrcQuad: Corners = [
      [0, 0],
      [639, 0],
      [639, Math.round((640 * 900) / spanMm) - 1],
      [0, Math.round((640 * 900) / spanMm) - 1],
    ]
    const preWarp = countBoardsRect(render.image, cmSrcQuad, cm.orientation)
    const exact = countGapsExact(render.image, cm.orientation, postZonesOf(layout, 640))
    const expectedGaps = expectedVisibleGaps(layout, cm.orientation, 640)
    colorRows.push({
      profil: definition.profile.name,
      orientacija: cm.orientation,
      odtenek: cm.label,
      colorId: cm.colorId,
      rgb: cm.rgb,
      gray_mean: meanGray(render.image),
      vir_barve: cm.source,
      materialProvenance: render.materialProvenance,
      alphaCoverage: run.metrics.alphaCoverage,
      productMaskUsed: run.metrics.productMaskUsed,
      maska_neodvisna_od_barve: true, // dokazano z enotskim testom + identična geometrija
      neprozornost_ploskvic: opacity,
      prosojnost_ok: opacity > 0.85, // P0: ploskvice svetlega produkta NISO prosojne
      identiteta_ok: exact.gaps === expectedGaps,
      boardCount_layout: layout.boardCount,
      vrzeli_prewarp_exact: exact.gaps,
      vrzeli_pričakovane_vidne: expectedGaps,
      vrzeli_prewarp_detrend: preWarp.bright,
      renderValid: render.renderValid,
    })
  }

  // barvna matrika contact sheet (vse 9)
  const cmSheet: Cell[][] = []
  for (const cm of COLOR_MATRIX) {
    const definition = productSdk.catalog.get(cm.productId)!
    const spanMm = Math.round(900 * quadAspect)
    const config = {
      productId: definition.id,
      orientation: cm.orientation,
      spanMm,
      heightMm: 900,
      gapMm: 20,
      colorId: cm.colorId,
      posts: definition.mounting.maxPostSpacingByOrientation[cm.orientation].maxSpacingMm ? { widthMm: 60 } : null,
    }
    const layout = productSdk.layout(config, { definition })
    const { render } = productSdk.renderWithMask({
      definition,
      config,
      layout,
      material: { colorId: cm.colorId, measuredRgb: cm.rgb },
      outWidthPx: 480,
      outHeightPx: Math.round((480 * 900) / spanMm),
    })
    const rowIdx = cmSheet.length % 3
    if (rowIdx === 0) cmSheet.push([])
    cmSheet[cmSheet.length - 1].push({
      img: render.image,
      label: `${definition.profile.name.split(' ')[0]} ${cm.label} #${cm.rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`,
    })
  }
  await makeSheet(cmSheet, path.join(SHEETS, 's8-contact-COLOR-MATRIX.png'), 300, 200)

  // ---------- Poročila ----------
  writeFileSync(path.join(ROOT, 'evaluation', 'S8-IDENTITY-REPORT.json'), JSON.stringify(identityRows, null, 2))
  writeFileSync(path.join(ROOT, 'evaluation', 'S8-COLOR-MATRIX.json'), JSON.stringify(colorRows, null, 2))
  manifest['tests'] = TESTS.map((t) => t.id)
  manifest['identity_ok'] = identityRows.every((r) => r.identiteta_ok === true)
  manifest['color_matrix_ok'] = colorRows.every((r) => r.prosojnost_ok === true && r.identiteta_ok === true)
  writeFileSync(path.join(ROOT, 'evaluation', 'S8-manifest.json'), JSON.stringify(manifest, null, 2))

  console.log('S8 dataset OK:', TESTS.length, 'testov,', COLOR_MATRIX.length, 'barvnih variant')
  console.log('identiteta_ok =', manifest['identity_ok'], ' color_matrix_ok =', manifest['color_matrix_ok'])
}

main().catch((e) => {
  console.error('S8 dataset FAIL:', e)
  process.exit(1)
})
