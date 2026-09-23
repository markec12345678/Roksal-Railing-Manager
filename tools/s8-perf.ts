/**
 * S+8 — PERFORMANCE (spec §24): meri catalog lookup, layout, masko, procedural
 * render in A-preview. SDK mora biti dovolj hiter za instant preview.
 * Brez GPU odvisnosti (proceduralna geometrija = čista aritmetika + piksli).
 * Uporaba: bun tools/s8-perf.ts → evaluation/S8-PERFORMANCE.json
 */
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { runPipeline } from '../src/lib/viz/pipeline'
import { productSdk } from '../src/lib/product-sdk'
import type { Corners, ImageBuffer, VizPlacement } from '../src/lib/viz/types'
import { cornerToPx } from '../src/lib/viz/types'

const ROOT = path.join(__dirname, '..')

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function stats(times: number[]): { p50: number; p95: number; mean: number } {
  const s = [...times].sort((a, b) => a - b)
  const p = (q: number) => Math.round(s[Math.min(s.length - 1, Math.floor(s.length * q))] * 1000) / 1000
  return { p50: p(0.5), p95: p(0.95), mean: Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 1000) / 1000 }
}

async function toRaw(buf: Buffer): Promise<ImageBuffer> {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true })
  const out = new Uint8ClampedArray(info.width * info.height * 4)
  for (let i = 0, j = 0; i < info.width * info.height; i++, j += info.channels) {
    out[i * 4] = data[j]
    out[i * 4 + 1] = data[j + 1]
    out[i * 4 + 2] = data[j + 2]
    out[i * 4 + 3] = info.channels === 4 ? data[j + 3] : 255
  }
  return { data: out, w: info.width, h: info.height }
}

async function main(): Promise<void> {
  // scena (enaka kot dataseti)
  const s6Dir = path.join(ROOT, 'evaluation', 'dataset', 'S6-T1-ravna-antracit')
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
  const mask: ImageBuffer = { data: maskData, w: maskRaw.w, h: maskRaw.h }
  const placement = JSON.parse(
    await import('node:fs').then((fs) => fs.readFileSync(path.join(s6Dir, 'placement.json'), 'utf8')),
  ) as VizPlacement
  const cornersPx = cornerToPx(placement.corners, original.w, original.h)

  const definition = productSdk.catalog.get('woodcore-polna-128')!
  const config = {
    productId: definition.id,
    orientation: 'horizontal' as const,
    spanMm: 2600,
    heightMm: 1000,
    gapMm: 20,
    colorId: 'rustic-oak',
    posts: { widthMm: 60 },
  }
  const layout = productSdk.layout(config, { definition })

  // 1) catalog lookup × 5000
  const tLookup: number[] = []
  for (let i = 0; i < 5000; i++) {
    const t = now()
    productSdk.catalog.get('woodcore-polna-128')
    tLookup.push(now() - t)
  }

  // 2) layout × 5000
  const tLayout: number[] = []
  for (let i = 0; i < 5000; i++) {
    const t = now()
    productSdk.layout(config, { definition })
    tLayout.push(now() - t)
  }

  // 3) maska × 200 (540×380)
  const tMask: number[] = []
  for (let i = 0; i < 200; i++) {
    const t = now()
    productSdk.mask(layout, { outWidthPx: 540, outHeightPx: 380 })
    tMask.push(now() - t)
  }

  // 4) procedural render × 200 (540×380)
  const tRender: number[] = []
  for (let i = 0; i < 200; i++) {
    const t = now()
    productSdk.render({
      definition,
      config,
      layout,
      material: { colorId: 'rustic-oak', measuredRgb: [116, 92, 74] },
      outWidthPx: 540,
      outHeightPx: 380,
    })
    tRender.push(now() - t)
  }

  // 5) A-preview (celoten SDK + pipeline kompozit) × 10
  const tPreview: number[] = []
  for (let i = 0; i < 10; i++) {
    const t = now()
    const { render, mask: productMask } = productSdk.renderWithMask({
      definition,
      config,
      layout,
      material: { colorId: 'rustic-oak', measuredRgb: [116, 92, 74] },
      outWidthPx: 540,
      outHeightPx: 380,
    })
    runPipeline({ original, mask, product: render.image, productMask, cornersPx, productQuadPx: null })
    tPreview.push(now() - t)
  }

  const result = {
    round: 'S+8 §24',
    environment: 'sandbox 2 CPU / 4.1 GB RAM / brez GPU',
    scene: `${original.w}×${original.h}, produkt 540×380 px`,
    catalogLookup: { runs: 5000, ...stats(tLookup), unit: 'ms' },
    layoutGeneration: { runs: 5000, ...stats(tLayout), unit: 'ms' },
    maskGeneration: { runs: 200, ...stats(tMask), unit: 'ms' },
    proceduralRender: { runs: 200, ...stats(tRender), unit: 'ms' },
    aPreviewEndToEnd: { runs: 10, ...stats(tPreview), unit: 'ms' },
    instantPreviewCapable: stats(tPreview).p95 < 8000,
    gpuDependency: 'BREZ — proceduralna geometrija je čista CPU aritmetika',
  }
  writeFileSync(path.join(ROOT, 'evaluation', 'S8-PERFORMANCE.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 1))
}

main().catch((e) => {
  console.error('S8 perf FAIL:', e)
  process.exit(1)
})
