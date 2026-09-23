/**
 * S+5 — HERO DEMO za produktno domačo stran.
 * Poganja DOKAZANI A-pipeline (1:1, algoritem NI spremenjen) na demo assets
 * (public/viz-demo/{balcony.jpg, product.jpg, mask.png} + demo.json placement)
 * in shrani REALNO PREJ/POTEM sliko + metrike:
 *   public/viz-demo/hero-preview.jpg   (POTEM — rezultat pipeline-a)
 *   public/viz-demo/hero-metrics.json  (identiteta letvic, ΔE, outside diff, čas)
 *
 * Uporaba: bun tools/hero-demo.ts
 * To je enak dokazan tok kot v S+1/S+2/S+3 (13 = 13 letvic na demo primeru) —
 * hero prikazuje DEJANSKO funkcijo aplikacije, ne stock fotografije.
 */
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { runPipeline } from '../src/lib/viz/pipeline'
import type { Corners, ImageBuffer } from '../src/lib/viz/types'

const ROOT = path.join(__dirname, '..')
const DEMO = path.join(ROOT, 'public', 'viz-demo')

async function toRaw(buf: Buffer): Promise<ImageBuffer> {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true })
  const w = info.width
  const h = info.height
  const out = new Uint8ClampedArray(w * h * 4)
  if (info.channels === 4) out.set(data.subarray(0, w * h * 4))
  else if (info.channels === 3) {
    for (let i = 0, j = 0; i < w * h; i++, j += 3) {
      out[i * 4] = data[j]; out[i * 4 + 1] = data[j + 1]; out[i * 4 + 2] = data[j + 2]; out[i * 4 + 3] = 255
    }
  } else {
    for (let i = 0; i < w * h; i++) { const g = data[i]; out[i * 4] = g; out[i * 4 + 1] = g; out[i * 4 + 2] = g; out[i * 4 + 3] = 255 }
  }
  return { data: out, w, h }
}

async function main() {
  const demoJson = JSON.parse(readFileSync(path.join(DEMO, 'demo.json'), 'utf8')) as {
    placement: { corners: Corners; productQuad: Corners | null }
  }
  const [balcony, product, mask] = await Promise.all([
    toRaw(readFileSync(path.join(DEMO, 'balcony.jpg'))),
    toRaw(readFileSync(path.join(DEMO, 'product.jpg'))),
    toRaw(readFileSync(path.join(DEMO, 'mask.png'))),
  ])

  const W = balcony.w
  const H = balcony.h
  const cornersPx: Corners = demoJson.placement.corners.map(([x, y]) => [x * W, y * H]) as Corners
  const nw = product.w
  const nh = product.h
  const productQuadPx: Corners | null = demoJson.placement.productQuad
    ? (demoJson.placement.productQuad.map(([x, y]) => [x * nw, y * nh]) as Corners)
    : null

  const t0 = Date.now()
  const res = runPipeline({
    original: balcony,
    mask,
    product,
    productMask: null,
    cornersPx,
    productQuadPx,
  })
  const wallMs = Date.now() - t0

  const jpg = await sharp(Buffer.from(res.preview.data.buffer), { raw: { width: W, height: H, channels: 4 } })
    .jpeg({ quality: 92 })
    .toBuffer()
  writeFileSync(path.join(DEMO, 'hero-preview.jpg'), jpg)

  const metrics = {
    source: 'A-pipeline (deterministična geometrija, NI AI) — demo assets runda S+1/S+2',
    letviceProduct: res.metrics.letviceProduct,
    letviceResult: res.metrics.letviceResult,
    letviceIdentityOk: res.metrics.letviceIdentityOk,
    outsideMaxPreShadow: res.metrics.outsideMaxPreShadow,
    chromaDE: res.metrics.chroma.dE,
    pipelineMs: res.metrics.timeMs,
    wallMs,
  }
  writeFileSync(path.join(DEMO, 'hero-metrics.json'), JSON.stringify(metrics, null, 2))
  console.log('HERO DEMO OK', JSON.stringify(metrics))
}

void main()
