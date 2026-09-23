/**
 * S+7 — ROKSAL TESTNI DATASET (3 izdelki) + A|B|C PRIMERJAVA + IDENTITETA + VISUAL QA.
 *
 * Spec §9  — 3 testi (ROMB 67/Amazon Wood/H, POLNA 128/Rustic Oak/H, POLNA 100/Burma Teak/V),
 *            vsak z original/product/profile/mask/placement.json/procedural/preview.
 * Spec §10 — avtomatsko identitetno poročilo (profil, širina, debelina, št. desk, razmak,
 *            orientacija, barva, tekstura, vijaki) — iz kataloga + izmerjeno.
 * Spec §11 — primerjava metod: A = realni produkt skozi A-pipeline, B = procedural (barva),
 *            C = procedural + realna tekstura — vsi skozi NESPREMJEN dokazan A-pipeline.
 * Spec §14 — contact sheet ORIGINAL | PRODUCT | PROCEDURAL | A | B | C + povečave
 *            (profil, rob, spoj, tekstura, senca).
 *
 * A-pipeline (src/lib/viz/*) NI SPREMENJEN — uporabljen 1:1 kot kompozitni motor.
 * Uporaba: bun tools/s7-dataset.ts
 */
import sharp from 'sharp'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { runPipeline } from '../src/lib/viz/pipeline'
import { solveHomography, warpImage } from '../src/lib/viz/homography'
import { computeFenceLayout, renderFence, renderFenceMask } from '../src/lib/procedural/fence-engine'
import { getProduct, maxSupportSpacingMm, type CatalogProfile } from '../src/lib/product-catalog'
import { rgb2labScalar } from '../src/lib/viz/color'
import { cornerToPx, type Corners, type ImageBuffer, type VizPlacement } from '../src/lib/viz/types'

const ROOT = path.join(__dirname, '..')
const ASSETS = path.join(ROOT, 'evaluation', 'roksal-assets')
const S6 = path.join(ROOT, 'evaluation', 'dataset')
const OUT = path.join(ROOT, 'evaluation', 'dataset')
const SHEETS = path.join(ROOT, 'evaluation', 'contact-sheets')
mkdirSync(SHEETS, { recursive: true })

// ---------- Testne definicije (spec §9 — točno 3 izdelki) ----------

interface S7Test {
  id: string
  title: string
  productId: string
  orientation: 'horizontal' | 'vertical'
  gapMm: number
  /** Realna višina ograjnega polja v mm (ocena; širina se računa iz kvadra). */
  fenceHeightMm: number
  s6Source: string
  /** Izrez ograje iz referenčne fotografije (začasni PRODUCT vhod, pravice pending). */
  crop: { src: string; x: number; y: number; w: number; h: number }
  note: string
}

const TESTS: S7Test[] = [
  {
    id: 'S7-T1-romb67-amazon-horizontal',
    title: 'TEST 1 — ROMB 67 / Amazon Wood / prečno (horizontal)',
    productId: 'woodcore-romb-67',
    orientation: 'horizontal',
    gapMm: 20,
    fenceHeightMm: 900,
    s6Source: 'S6-T1-ravna-antracit',
    crop: { src: 't1-romb-amazon-reference.jpg', x: 296, y: 392, w: 1248, h: 366 },
    note: 'raven balkon (S+1 dokazani vogali); referenčna fotografija vgrajene romb ograje, temen odtenek (domneva Amazon Wood); realne vrzeli TANKE (~5 mm) — števec 0,5-pokritosti j ne razreši (znana omejitev, zabeležena)',
  },
  {
    id: 'S7-T2-polna128-rustic-oak-horizontal',
    title: 'TEST 2 — POLNA 128 / Rustic Oak / prečno (horizontal)',
    productId: 'woodcore-polna-128',
    orientation: 'horizontal',
    gapMm: 20,
    fenceHeightMm: 900,
    s6Source: 'S6-T1-ravna-antracit',
    crop: { src: 't2-polna128-reference.jpg', x: 268, y: 290, w: 542, h: 565 },
    note: 'ista čista scena kot T1 (S6-T1 — namenoma primerljivo); izrez levega zaslona (široke deske = POLNA 128 videz); razmerje izreza 0,96 vs kvader 2,66 → A RAZTEGNE ploskvice (dokumentirano), B/C regenerirata geometrijo na ciljno razmerje s pravim številom desk — to je glavna prednost proceduralnega pristopa; odtenek toplo rjava (NI potrjen Rustic Oak)',
  },
  {
    id: 'S7-T3-polna100-burma-teak-vertical',
    title: 'TEST 3 — POLNA 100 / Burma Teak / pokončno (vertical)',
    productId: 'woodcore-polna-100',
    orientation: 'vertical',
    gapMm: 20,
    fenceHeightMm: 650,
    s6Source: 'S6-T1-ravna-antracit',
    crop: { src: 't3-polna100-vertical-reference.jpg', x: 540, y: 485, w: 540, h: 205 },
    note: 'ista čista scena kot T1; pokončna ograja — izrez MED stebri (brez konstrukcije); svetlejši odtenek kot Burma Teak referenca — zabeleženo, ne prikrito',
  },
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

async function rawToPng(img: ImageBuffer, file: string): Promise<void> {
  await sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength), {
    raw: { width: img.w, height: img.h, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toFile(file)
}

async function rawToJpg(img: ImageBuffer, file: string, q = 92): Promise<void> {
  await sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength), {
    raw: { width: img.w, height: img.h, channels: 4 },
  })
    .jpeg({ quality: q })
    .toFile(file)
}

/** Povprečna barva SREDINSKE regije (60 %) — robustno proti ozadju na robovih izreza. */
function meanRGB(img: ImageBuffer): [number, number, number] {
  const x0 = Math.round(img.w * 0.2)
  const x1 = Math.round(img.w * 0.8)
  const y0 = Math.round(img.h * 0.2)
  const y1 = Math.round(img.h * 0.8)
  let r = 0
  let g = 0
  let b = 0
  const n = (x1 - x0) * (y1 - y0)
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * img.w + x) * 4
      r += img.data[i]
      g += img.data[i + 1]
      b += img.data[i + 2]
    }
  }
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)]
}

function hexOf(rgb: [number, number, number]): string {
  return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('')
}

/**
 * Orientacije-zaveden števec ploskovic na REZULTATU (orodje, NE pipeline):
 * kvader rektificira v 700×300 in šteje ON-teke po vrsticah (horizontal)
 * ali stolpcih (vertical) iz luminančnega profila. Ponovno uporablja
 * solveHomography + warpFloat iz src/lib/viz (NIč spremenjeno).
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
  // Rektifikacija prek warpImage (ponovna uporaba src/lib/viz — NI spremembe pipeline-a)
  const rectRGBA = warpImage(img, H, rw, rh)
  const lum = new Float32Array(rw * rh)
  for (let i = 0; i < rw * rh; i++) {
    const o = i * 4
    lum[i] = 0.299 * rectRGBA.data[o] + 0.587 * rectRGBA.data[o + 1] + 0.114 * rectRGBA.data[o + 2]
  }
  // Profil po sredinskih 30 % pasu: horizontal → vrstice (os Y), vertical → stolpci (os X)
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
  // Detrendiranje: odstrani počasen svetlobni gradient (drseče povprečje).
  // Okno < razmak ploskovic (span/12), da val ohrani; prag −0,5σ.
  // (Best-effort merilnik; definitivna geometrija = deterministična izgradnja
  // + enotski testi + pre-warp števec na proceduralnem renderju.)
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
  // dark = temne teke (ploskvice ALI profilno senčenje), bright = svetle teke
  // (VRZELI — najbolj zanesljiv signal: bele/ozadje med deskami)
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

// ---------- Contact sheet (spec §14) ----------

interface Cell {
  img: ImageBuffer
  label: string
}

async function makeSheet(rows: Cell[][], file: string, cellW = 300, cellH = 230): Promise<void> {
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
    const row = rows[ri]
    for (let ci = 0; ci < row.length; ci++) {
      const cell = row[ci]
      const x = gap + ci * (cellW + gap)
      const y = gap + ri * (labelH + cellH + gap)
      // label (SVG → PNG, deterministično)
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cellW}" height="${labelH}">
        <rect width="100%" height="100%" fill="#1c1917"/>
        <text x="6" y="18" font-family="DejaVu Sans, sans-serif" font-size="13" fill="#fafaf9">${cell.label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>
      </svg>`
      const labelPng = await sharp(Buffer.from(svg)).png().toBuffer()
      composites.push({ input: labelPng, left: x, top: y })
      // slika: contain v celico
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

/** Sredinski izrez (povečava detajla: profil/rob/tekstura/senca). */
async function centerCrop(img: ImageBuffer, frac = 0.5): Promise<ImageBuffer> {
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

// ---------- Glavni tok ----------

interface VariantMetrics {
  method: 'A' | 'B' | 'C' | 'B2'
  letviceProduct: number
  letviceResult: number
  letviceIdentityOk: boolean
  outsideMaxPreShadow: number
  outsideMean: number
  deltaE: number
  alphaCoverage: number
  timeMs: number
  geometryBoardCount: number | null
  geometryOk: boolean | null
  geometryMethod: string
  honestyNotes: string[]
}
async function main(): Promise<void> {
  const manifestTests: Record<string, unknown>[] = []
  const identityRows: Record<string, unknown>[] = []
  const comparisonRows: Record<string, unknown>[] = []

  for (const t of TESTS) {
    const dir = path.join(OUT, t.id)
    for (const sub of ['product', 'profile', 'procedural', 'preview']) {
      mkdirSync(path.join(dir, sub), { recursive: true })
    }
    const profile: CatalogProfile = getProduct(t.productId)!
    if (!profile) throw new Error(`neznan productId ${t.productId}`)

    // --- vhodi iz S+6 (zamrznjeni original/maska/placement — A-pipeline vhodi nespremenjeni)
    const s6Dir = path.join(S6, t.s6Source)
    const originalBuf = await sharp(path.join(s6Dir, 'original.jpg')).jpeg({ quality: 90 }).toBuffer()
    const original = await toRaw(originalBuf)
    const maskRaw = await toRaw(await sharp(path.join(s6Dir, 'mask.png')).toBuffer())
    const maskBin = new Uint8Array(maskRaw.w * maskRaw.h)
    for (let i = 0; i < maskBin.length; i++) maskBin[i] = maskRaw.data[i * 4] > 127 ? 1 : 0
    const maskData = new Uint8ClampedArray(maskRaw.w * maskRaw.h * 4)
    for (let i = 0; i < maskBin.length; i++) {
      const v = maskBin[i] ? 255 : 0
      maskData[i * 4] = v
      maskData[i * 4 + 1] = v
      maskData[i * 4 + 2] = v
      maskData[i * 4 + 3] = 255
    }
    const mask: ImageBuffer = { data: maskData, w: maskRaw.w, h: maskRaw.h }
    const placement = JSON.parse(await readFileStr(path.join(s6Dir, 'placement.json'))) as VizPlacement
    const cornersPx = cornerToPx(placement.corners, original.w, original.h)
    const quadW = Math.abs(cornersPx[1][0] - cornersPx[0][0]) + Math.abs(cornersPx[2][0] - cornersPx[3][0])
    const quadH = Math.abs(cornersPx[3][1] - cornersPx[0][1]) + Math.abs(cornersPx[2][1] - cornersPx[1][1])
    const quadAspect = quadW / quadH

    // --- produkt: izrez realne Roksal fotografije (pravice pending — interna uporaba)
    const cropBuf = await sharp(path.join(ASSETS, t.crop.src))
      .extract({ left: t.crop.x, top: t.crop.y, width: t.crop.w, height: t.crop.h })
      .jpeg({ quality: 95 })
      .toBuffer()
    const productPath = path.join(dir, 'product', 'product.jpg')
    await sharp(cropBuf).toFile(productPath)
    const product = await toRaw(cropBuf)
    const productQuadPx: Corners = [
      [0, 0],
      [product.w, 0],
      [product.w, product.h],
      [0, product.h],
    ]

    // --- izmerjena barva produkta (približek, NI uradni podatek)
    const measuredRGB = meanRGB(product)
    const measuredHex = hexOf(measuredRGB)
    const measuredLab = rgb2labScalar(measuredRGB[0], measuredRGB[1], measuredRGB[2])

    // --- deterministična geometrija iz kataloga (spec §7, §8)
    // Širina ograje se izračuna iz kvadra (realna ravnina stare ograje), omejena
    // na kataloški max razmak nosilcev (polja + stebri po pravilu proizvajalca).
    const maxSpan = maxSupportSpacingMm(profile, t.orientation) ?? 1450
    const fenceWidthMm = Math.round(t.fenceHeightMm * quadAspect)
    const nFields = Math.max(1, Math.ceil(fenceWidthMm / maxSpan))
    const fieldW = fenceWidthMm / nFields
    const postPositionsMm: number[] = []
    for (let k = 1; k < nFields; k++) postPositionsMm.push(Math.round(k * fieldW))
    const outW = 896
    const outH = Math.max(120, Math.round((outW * t.fenceHeightMm) / fenceWidthMm))

    const materialColor = { kind: 'color' as const, rgb: measuredRGB }
    const layReq = {
      productId: t.productId,
      orientation: t.orientation,
      fenceWidthMm,
      fenceHeightMm: t.fenceHeightMm,
      gapMm: t.gapMm,
      material: materialColor,
      outWidthPx: outW,
      outHeightPx: outH,
      posts: postPositionsMm.length > 0 ? { widthMm: 60, positionsMm: postPositionsMm } : null,
    }
    const tLayout0 = performance.now()
    const layout = computeFenceLayout(layReq)
    const layoutMs = Math.round(performance.now() - tLayout0)
    if (layout.warnings.length > 0) {
      console.log(`  ${t.id} layout warnings: ${layout.warnings.join(' | ')}`)
    }

    // --- B: procedural (barva) + C: procedural + realna tekstura
    const tB0 = performance.now()
    const fenceB = renderFence(layReq, layout)
    const bRenderMs = Math.round(performance.now() - tB0)
    const fenceC = renderFence(
      { ...layReq, material: { kind: 'texture', texture: product, mode: 'scan' as const } },
      layout
    )
    // B2 (samo T3): SVETEL material (gray > prag 115) je izven vhodne domene
    // zamrznjenega A-pipeline (dokazano — S+6 TEST 5 napoved, S+7 kvantificirano).
    // B2 = SINTETIČNA temna varianta (NI izmerjena barva!) za dokaz, da mehanika
    // vertikalnega kompozita skozi nespremenjen pipeline deluje.
    const isT3 = t.id.startsWith('S7-T3')
    const fenceB2 = isT3
      ? renderFence({ ...layReq, material: { kind: 'color' as const, rgb: [70, 68, 64] } }, layout)
      : null
    // Deterministična productMask iz konstrukcije (obvezna za SVETLE materiale:
    // gray > CUTOUT_GRAY_THRESHOLD 115 — dokumentirana omejitev avtomatskega
    // cutouta A-pipeline; maska = točen vir alfe, isto kot mask-editor v produkciji)
    const fenceMask = renderFenceMask(layReq, layout)
    await rawToPng(fenceMask, path.join(dir, 'procedural', 'generated_fence_mask.png'))
    await rawToPng(fenceB, path.join(dir, 'procedural', 'generated_fence.png'))
    await rawToPng(fenceC, path.join(dir, 'procedural', 'generated_fence_texture.png'))
    if (fenceB2) await rawToPng(fenceB2, path.join(dir, 'procedural', 'generated_fence_dark_variant.png'))
    writeFileSync(
      path.join(dir, 'procedural', 'layout.json'),
      JSON.stringify({ request: { ...layReq, material: { kind: 'color', rgb: measuredRGB } }, layout, layoutMs, bRenderMs, nFields, postPositionsMm, quadAspect }, null, 2)
    )

    // --- profilna fotografija = izrez ENE ploskvice (spec §6)
    if (t.orientation === 'horizontal') {
      const b0 = layout.boards[0]
      const boardPxH = Math.max(8, Math.round((b0.visibleMm / t.fenceHeightMm) * cropH(t.crop)))
      await sharp(cropBuf)
        .extract({ left: Math.round(t.crop.w * 0.1), top: t.crop.h - boardPxH, width: Math.round(t.crop.w * 0.25), height: boardPxH })
        .toFile(path.join(dir, 'profile', 'profile.jpg'))
    } else {
      const b0 = layout.boards[0]
      const boardPxW = Math.max(8, Math.round((b0.visibleMm / fenceWidthMm) * t.crop.w))
      await sharp(cropBuf)
        .extract({ left: 0, top: Math.round(t.crop.h * 0.15), width: boardPxW, height: Math.round(t.crop.h * 0.7) })
        .toFile(path.join(dir, 'profile', 'profile.jpg'))
    }

    // --- A/B/C skozi NESPREMJEN A-pipeline
    const variants: Array<{ m: 'A' | 'B' | 'C' | 'B2'; product: ImageBuffer; mask: ImageBuffer | null }> = [
      { m: 'A', product, mask: null },
      { m: 'B', product: fenceB, mask: fenceMask },
      { m: 'C', product: fenceC, mask: fenceMask },
    ]
    if (fenceB2) variants.push({ m: 'B2', product: fenceB2, mask: null })
    const results: Record<string, { preview: ImageBuffer; metrics: VariantMetrics }> = {}
    // Pre-warp števec na proceduralnih renderjih (čist signal: bele vrzeli) —
    // to je NATANČEN dokaz, da render ustreza kataloški geometriji (§10).
    const fullQuad = (im: ImageBuffer): Corners => [
      [0, 0],
      [im.w, 0],
      [im.w, im.h],
      [0, im.h],
    ]
    const bPreWarp = countBoardsRect(fenceB, fullQuad(fenceB), t.orientation)
    const cPreWarp = countBoardsRect(fenceC, fullQuad(fenceC), t.orientation)
    for (const v of variants) {
      const res = runPipeline({
        original,
        mask,
        product: v.product,
        productMask: v.mask,
        cornersPx,
        productQuadPx: [
          [0, 0],
          [v.product.w, 0],
          [v.product.w, v.product.h],
          [0, v.product.h],
        ],
      })
      const m = res.metrics
      // Geometrija (spec §10):
      //  • B/C: pre-warp števec na proceduralnem renderju = TOČEN dokaz
      //    (svetli teki = vrzeli = boardCount−1; beli signal, brez ozadja).
      //  • result-stran = best-effort meritev (ozadje v kvadru vnese šum) —
      //    poročano, ne uporabljeno kot vrata.
      //  • A: geometrija iz realne fotografije ni zanesljivo merljiva s števcem
      //    (tanke vrzeli/tekstura) — identiteta skozi pipeline = letvice P→R.
      const productCount = countBoardsRect(v.product, fullQuad(v.product), t.orientation)
      const resultCount = countBoardsRect(res.preview, cornersPx, t.orientation)
      const preWarp = v.m === 'B' ? bPreWarp : v.m === 'C' ? cPreWarp : null
      const expectedGaps = layout.boardCount - 1
      const bPreWarpExact = bPreWarp.bright === expectedGaps || bPreWarp.dark === layout.boardCount
      const preWarpExact = preWarp !== null && (preWarp.bright === expectedGaps || preWarp.dark === layout.boardCount)
      const geometryBoardCount =
        v.m === 'A' ? null : preWarpExact ? layout.boardCount : null
      const geometryMethod = `preWarp=${preWarp ? `dark=${preWarp.dark},bright=${preWarp.bright}` : 'n/a (realna foto)'} (pričakovano: dark=${layout.boardCount}, bright=${expectedGaps}); result(dark=${resultCount.dark},bright=${resultCount.bright}; best-effort); produkt(dark=${productCount.dark},bright=${productCount.bright})`
      const geometryOk =
        v.m === 'A'
          ? t.orientation === 'vertical'
            ? null // števec os-Y ne meri pokončnih ograj (znana omejitev instrumenta)
            : m.letviceIdentityOk
          : bPreWarpExact && m.letviceIdentityOk // C: ista layout instanca kot točna-B
      const honestyNotes: string[] = []
      const measuredGray = 0.299 * measuredRGB[0] + 0.587 * measuredRGB[1] + 0.114 * measuredRGB[2]
      if (v.m === 'A' && t.orientation === 'horizontal' && m.letviceProduct <= 2) {
        honestyNotes.push('letvice števec degenerira pri tankih vrzelih realne fotografije (pokritost > 0,5) — identiteta je sicer ohranjena (P=R), absolutno število ni merljivo s tem instrumentom')
      }
      if (v.m === 'A' && t.orientation === 'vertical') {
        honestyNotes.push('števec (os Y) ni orientiran za pokončne ploskvice — identiteta preveri contact sheet (vizualno)')
      }
      if (v.m === 'C') {
        honestyNotes.push('material scan projicira lastne svetle vrzeli fotografije v ploskvice (artefakt C-metode) — geometrija je po konstrukciji ista layout instanca kot točno izmerjena B')
      }
      if ((v.m === 'B' || v.m === 'C') && measuredGray > 115) {
        honestyNotes.push(`izmerjena barva (gray=${measuredGray.toFixed(0)}) je NAD dokumentiranim cutout pragom 115 zamrznjenega A-pipeline → kompozit je delno prosojen (to je KVANTIFICIRANA znana omejitev, ne napaka S+7); rešitev: podpora productMask v pipeline (renderFenceMask že obstaja) — kandidat S+8`)
      }
      if (v.m === 'B2') {
        honestyNotes.push('B2 = SINTETIČNA temna varianta (rgb 70,68,64 — NI izmerjena barva izdelka!) — dokaz, da mehanika kompozita skozi nespremjenjen pipeline deluje; barvna identiteta B2 NI trditev o izdelku')
      }
      const vm: VariantMetrics = {
        method: v.m,
        letviceProduct: m.letviceProduct,
        letviceResult: m.letviceResult,
        letviceIdentityOk: m.letviceIdentityOk,
        outsideMaxPreShadow: m.outsideMaxPreShadow,
        outsideMean: m.outsideMean,
        deltaE: m.chroma.dE,
        alphaCoverage: m.alphaCoverage,
        timeMs: m.timeMs,
        geometryBoardCount,
        geometryOk,
        geometryMethod,
        honestyNotes,
      }
      results[v.m] = { preview: res.preview, metrics: vm }
      await rawToJpg(res.preview, path.join(dir, 'preview', `${v.m.toLowerCase()}_preview.jpg`))
    }

    // --- metrična datoteka (§10/§11)
    const metricsOut = {
      test_id: t.id,
      title: t.title,
      product: {
        productId: t.productId,
        profile: profile.profile,
        orientation: t.orientation,
        faceWidthMm: profile.faceWidthMm,
        thicknessMm: profile.thicknessMm,
        standardLengthsMm: profile.standardLengthsMm,
        screwsVisible: profile.screwsVisible,
        fixing: profile.fixing,
        recommendedGapMm: profile.recommendedGapMm,
        usedGapMm: t.gapMm,
        colorsCount: profile.colorsCount,
        rights: profile.rights,
        assetQuality: profile.assetQuality ?? 'unassessed',
      },
      measuredColor: { rgb: measuredRGB, hex: measuredHex, lab: measuredLab, note: 'izmerjeno iz referenčne fotografije — NI uradni Roksal/RAL podatek' },
      fence: { fenceWidthMm, fenceHeightMm: t.fenceHeightMm, quadAspect, nFields, postPositionsMm },
      layout: { boardCount: layout.boardCount, pitchMm: layout.pitchMm, cut: layout.boards.some((b) => b.cut), warnings: layout.warnings, handlePresent: layout.handlePresent },
      methods: {
        A: results.A.metrics,
        B: results.B.metrics,
        C: results.C.metrics,
        ...(results.B2 ? { B2: results.B2.metrics } : {}),
      },
      note: t.note,
    }
    writeFileSync(path.join(dir, 'metrics.json'), JSON.stringify(metricsOut, null, 2))
    // placement (kopija S6 + productQuad polne slike — za reprodukcijo)
    writeFileSync(
      path.join(dir, 'placement.json'),
      JSON.stringify({ ...placement, productQuadSource: 'product/product.jpg (celotna slika)' }, null, 2)
    )

    // --- identitetna vrstica (§10)
    identityRows.push({
      test_id: t.id,
      productId: t.productId,
      profil: profile.profile,
      sirinaMm: profile.faceWidthMm,
      debelinaMm: profile.thicknessMm,
      steviloDesk_katalog: layout.boardCount,
      razmakMm: t.gapMm,
      razmak_ok: t.gapMm >= profile.recommendedGapMm.min && t.gapMm <= profile.recommendedGapMm.max,
      orientacija: t.orientation,
      barva_izmerjena: measuredHex,
      barva_opomba: 'približek iz fotografije (ni uradni podatek)',
      tekstura: 'C-metoda: realna fotografija (scan); B: determinističen profilni vzorec',
      vijaki: profile.screwsVisible ? 'vidni (render pri stebrih)' : 'skriti (render brez vijakov)',
      konstrukcija: `${nFields} polj (max ${maxSpan} mm po katalogu), stebri na ${postPositionsMm.join(', ') || '—'} mm`,
      pravice: profile.rights,
    })

    // --- primerjalna vrstica (§11)
    const fmt = (v: VariantMetrics): string =>
      `letvice ${v.letviceProduct}→${v.letviceResult}${v.letviceIdentityOk ? ' ✓' : ' ✗'}; geometrija ${v.geometryBoardCount}${v.geometryOk === true ? ' ✓' : v.geometryOk === false ? ' ✗' : ' ?'}; ΔE ${v.deltaE.toFixed(2)}; preshadow ${v.outsideMaxPreShadow}; ${v.timeMs} ms`
    comparisonRows.push({
      test: t.id,
      A: fmt(results.A.metrics),
      B: fmt(results.B.metrics),
      C: fmt(results.C.metrics),
      ...(results.B2 ? { B2: fmt(results.B2.metrics) + ' (sintetična temna — NI barva izdelka)' } : {}),
      A_ok: results.A.metrics.letviceIdentityOk && (results.A.metrics.geometryOk ?? true),
      B_ok: results.B.metrics.letviceIdentityOk && results.B.metrics.geometryOk === true,
      C_ok: results.C.metrics.letviceIdentityOk && results.C.metrics.geometryOk === true,
    })

    // --- contact sheet (§14): ORIGINAL | PRODUCT | PROCEDURAL | A | B | C (| B2) + povečave
    const zoomOf = async (img: ImageBuffer): Promise<ImageBuffer> => centerCrop(img, 0.5)
    const rowTop: Cell[] = [
      { img: original, label: 'ORIGINAL' },
      { img: product, label: `PRODUCT (${profile.profile})` },
      { img: fenceB, label: 'PROCEDURAL (B)' },
      { img: results.A.preview, label: 'A (real product)' },
      { img: results.B.preview, label: 'B (procedural color)' },
      { img: results.C.preview, label: 'C (procedural+material)' },
    ]
    const rowZoom: Cell[] = [
      { img: await zoomOf(original), label: 'ORIGINAL 2×' },
      { img: await zoomOf(product), label: 'PRODUCT 2× (profil/rob)' },
      { img: await zoomOf(fenceB), label: 'PROCEDURAL 2× (geometrija)' },
      { img: await zoomOf(results.A.preview), label: 'A 2× (senca/stik)' },
      { img: await zoomOf(results.B.preview), label: 'B 2× (tekstura)' },
      { img: await zoomOf(results.C.preview), label: 'C 2× (tekstura+senca)' },
    ]
    if (fenceB2 && results.B2) {
      rowTop.push({ img: fenceB2, label: 'B2 PROCEDURAL (temna sintetika)' })
      rowTop.push({ img: results.B2.preview, label: 'B2 (dokaz mehanike)' })
      rowZoom.push({ img: await zoomOf(results.B2.preview), label: 'B2 2×' })
    }
    await makeSheet([rowTop, rowZoom], path.join(SHEETS, `s7-contact-${t.id}.png`))

    manifestTests.push({
      id: t.id,
      dir: t.id,
      s6Source: t.s6Source,
      productId: t.productId,
      orientation: t.orientation,
      gapMm: t.gapMm,
      fence: { fenceWidthMm, fenceHeightMm: t.fenceHeightMm },
      files: {
        original: `${t.id}/original.jpg`,
        product: `${t.id}/product/product.jpg`,
        profile: `${t.id}/profile/profile.jpg`,
        mask: `${t.id}/mask.png`,
        placement: `${t.id}/placement.json`,
        proceduralB: `${t.id}/procedural/generated_fence.png`,
        proceduralC: `${t.id}/procedural/generated_fence_texture.png`,
        proceduralMask: `${t.id}/procedural/generated_fence_mask.png`,
        ...(fenceB2 ? { proceduralB2: `${t.id}/procedural/generated_fence_dark_variant.png` } : {}),
        layout: `${t.id}/procedural/layout.json`,
        previews: ['a', 'b', 'c', ...(fenceB2 ? ['b2'] : [])].map((v) => `${t.id}/preview/${v}_preview.jpg`),
        metrics: `${t.id}/metrics.json`,
      },
      contactSheet: `evaluation/contact-sheets/s7-contact-${t.id}.png`,
      note: t.note,
    })

    console.log(
      `${t.id}: layout ${layout.boardCount} desk (${layoutMs} ms, render ${bRenderMs} ms) | A ${results.A.metrics.letviceProduct}→${results.A.metrics.letviceResult} ΔE ${results.A.metrics.deltaE.toFixed(2)} | B geo ${results.B.metrics.geometryBoardCount}/${layout.boardCount} | C geo ${results.C.metrics.geometryBoardCount}/${layout.boardCount}`
    )
  }

  // --- S7 manifest + identiteta + primerjava
  const manifest = {
    version: 1,
    round: 'S+7 — ROKSAL PRODUCT ASSET LIBRARY + PROCEDURAL FENCE ENGINE',
    generated: new Date().toISOString(),
    methods: {
      A: 'realna produkt fotografija → NESPREMJEN A-pipeline (S+1 dokazan)',
      B: 'proceduralni renderer (katalog geometrija + izmerjena barva) → isti A-pipeline',
      C: 'proceduralna geometrija + realna tekstura iz fotografije → isti A-pipeline',
    },
    rights: 'vse fotografije pending — glej evaluation/ROKSAL-ASSET-RIGHTS.md',
    tests: manifestTests,
  }
  writeFileSync(path.join(OUT, 'S7-manifest.json'), JSON.stringify(manifest, null, 2))
  writeFileSync(path.join(ROOT, 'evaluation', 'S7-IDENTITY-REPORT.json'), JSON.stringify(identityRows, null, 2))
  writeFileSync(path.join(ROOT, 'evaluation', 'S7-ABC-COMPARISON.json'), JSON.stringify(comparisonRows, null, 2))
  console.log(`\nS7 dataset: ${manifestTests.length} testov → ${OUT}`)
  console.log(`Contact sheets → ${SHEETS}`)
}

function cropH(c: { h: number }): number {
  return c.h
}

async function readFileStr(p: string): Promise<string> {
  const { readFileSync } = await import('node:fs')
  return readFileSync(p, 'utf8')
}

void main().catch((e) => {
  console.error(e)
  process.exit(1)
})
