/**
 * VIZ pipeline testi (runda S+2) — dokazila, da je TS port A-pipelinea
 * enakovreden dokazanemu python baseline-u (runda S+1, commit 0f4a283):
 *
 *  1. GEOMETRIJA: homografija preslika 4 vogale natančno; rotacija/skala kvadra
 *  2. KOMPOZIT: original IZVEN maske ostane nespremenjen (diff = 0 pred senco)
 *  3. RAL VARNOST: kroma (a/b) se ne premakne (|Δ| < 1.5) — tudi pri gradientni
 *     osvetlitvi (repo ColorMatcher je dokazano ΔE=38.4 — PREPOVEDAN)
 *  4. ŠTETJE LETVIC: sintetični vzorec s 5 letvicami → 5
 *  5. INTEGRACIJA (realna fotografija, public/viz-demo): letvice izdelek ==
 *     rezultat, diff izven maske = 0, kroma ohranjena, čas < 8s
 */
import { describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import type { Corners, ImageBuffer } from '@/lib/viz/types'
import { applyHomography, solveHomography } from '@/lib/viz/homography'
import { countLetvice, runPipeline } from '@/lib/viz/pipeline'
import { cornerToNorm, cornerToPx } from '@/lib/viz/types'

const UNIT_QUAD: Corners = [
  [0, 0],
  [100, 0],
  [100, 50],
  [0, 50],
]

function rgbaImage(w: number, h: number, fill: (x: number, y: number) => [number, number, number]): ImageBuffer {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fill(x, y)
      const i = (y * w + x) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 255
    }
  }
  return { data, w, h }
}

async function fileToImageBuffer(p: string): Promise<ImageBuffer> {
  const raw = await sharp(p).ensureAlpha().raw().toBuffer()
  const meta = await sharp(p).metadata()
  return { data: new Uint8ClampedArray(raw.buffer, raw.byteOffset, raw.byteLength), w: meta.width!, h: meta.height! }
}

async function fileToGrayMask(p: string, w: number, h: number): Promise<ImageBuffer> {
  const raw = await sharp(p).ensureAlpha().resize(w, h, { kernel: 'nearest' }).raw().toBuffer()
  return { data: new Uint8ClampedArray(raw.buffer, raw.byteOffset, raw.byteLength), w, h }
}

// ── 1. GEOMETRIJA ────────────────────────────────────────────────────────────
describe('geometry: homography', () => {
  it('maps the 4 source corners exactly onto the target quad', () => {
    const dst: Corners = [
      [238, 462],
      [956, 302],
      [952, 668],
      [238, 726],
    ]
    const H = solveHomography(UNIT_QUAD, dst)
    for (let i = 0; i < 4; i++) {
      const [u, v] = applyHomography(H, UNIT_QUAD[i][0], UNIT_QUAD[i][1])
      expect(Math.abs(u - dst[i][0])).toBeLessThanOrEqual(0.75)
      expect(Math.abs(v - dst[i][1])).toBeLessThanOrEqual(0.75)
    }
  })

  it('scaled quad warp maps interior point correctly', () => {
    // src: 100×50 unit quad → dst: 200×100 (čista skala 2×)
    const dst: Corners = [
      [10, 20],
      [210, 20],
      [210, 120],
      [10, 120],
    ]
    const H = solveHomography(UNIT_QUAD, dst)
    // notranja točka (50, 25) mora biti v sredini cilja (110, 70)
    const [u, v] = applyHomography(H, 50, 25)
    expect(Math.abs(u - 110)).toBeLessThanOrEqual(0.75)
    expect(Math.abs(v - 70)).toBeLessThanOrEqual(0.75)
  })
})

// ── 2. KOMPOZIT + 3. RAL + 4. LETVICE (sintetika) ────────────────────────────
describe('compositing / RAL / letvice (synthetic)', () => {
  const W = 256
  const H = 256
  // scena: gradient ozadja (vodoravni prehod temno → svetlo = "gradientna osvetlitev")
  const scene = rgbaImage(W, H, (x) => {
    const v = Math.round(40 + (x / W) * 180)
    return [v, v, Math.round(v * 0.95)]
  })
  // maska: sredinski kvader
  const maskQuad: Corners = [
    [64, 64],
    [192, 64],
    [192, 192],
    [64, 192],
  ]
  const mask = rgbaImage(W, H, (x, y) =>
    x >= 64 && x < 192 && y >= 64 && y < 192 ? [255, 255, 255] : [0, 0, 0],
  )
  // produkt: 128×60 — 5 horizontalnih letvic povezanih s 2 stebroma (kot prava
  // ograja → ena povezana komponenta; prag >4000 px iz python baseline-a
  // sicer izbriše ločene majhne komponente)
  const PW = 128
  const PH = 60
  const product = rgbaImage(PW, PH, (x, y) => {
    const post = x < 3 || x >= PW - 3
    const rail = y % 12 < 5
    return post || rail ? [30, 30, 32] : [200, 200, 200]
  })
  const productQuad: Corners = [
    [0, 0],
    [PW - 1, 0],
    [PW - 1, PH - 1],
    [0, PH - 1],
  ]

  function run() {
    return runPipeline({
      original: scene,
      mask,
      product,
      productMask: null,
      cornersPx: maskQuad,
      productQuadPx: productQuad,
    })
  }

  it('diff outside mask is exactly 0 (pre-shadow) with gradient scene', () => {
    const res = run()
    expect(res.metrics.outsideMaxPreShadow).toBe(0)
  })

  it('RAL guard: chroma (a/b) shift < 1.5 even with strong illumination gradient', () => {
    const res = run()
    const { chroma } = res.metrics
    expect(Math.abs(chroma.aAfter - chroma.aBefore)).toBeLessThan(1.5)
    expect(Math.abs(chroma.bAfter - chroma.bBefore)).toBeLessThan(1.5)
    expect(chroma.dE).toBeLessThan(1.5)
  })

  it('letvice identity: 5 synthetic rails → 5 = 5', () => {
    const res = run()
    expect(res.metrics.letviceProduct).toBe(5)
    expect(res.metrics.letviceResult).toBe(5)
    expect(res.metrics.letviceIdentityOk).toBe(true)
  })

  it('degenerate quad does not crash countLetvice (returns 0)', () => {
    expect(countLetvice(new Float32Array(4), 2, 2, UNIT_QUAD)).toBe(0)
  })
})

// ── 5. INTEGRACIJA — realna fotografija iz runde S+1 ─────────────────────────
describe('integration: real demo assets (S+1 proven baseline)', () => {
  it(
    'letvice identity, diff=0, RAL safe, <8s on real balcony + fence photo',
    async () => {
      const demo = JSON.parse(
        readFileSync(resolve(process.cwd(), 'public/viz-demo/demo.json'), 'utf8'),
      ) as {
        placement: { corners: Corners; productQuad: Corners | null }
      }
      const original = await fileToImageBuffer(resolve(process.cwd(), 'public/viz-demo/balcony.jpg'))
      const product = await fileToImageBuffer(resolve(process.cwd(), 'public/viz-demo/product.jpg'))
      const mask = await fileToGrayMask(resolve(process.cwd(), 'public/viz-demo/mask.png'), original.w, original.h)

      const cornersPx = cornerToPx(demo.placement.corners, original.w, original.h)
      const productQuadPx = demo.placement.productQuad
        ? cornerToPx(demo.placement.productQuad, product.w, product.h)
        : null

      const res = runPipeline({
        original,
        mask,
        product,
        productMask: null,
        cornersPx,
        productQuadPx,
      })

      const m = res.metrics
      // identiteta: enako število letvic v rektificiranem prostoru (baseline: 13 = 13)
      expect(m.letviceIdentityOk).toBe(true)
      // original zunaj maske: NIČ sprememb pred senco
      expect(m.outsideMaxPreShadow).toBe(0)
      // RAL: kroma ohranjena
      expect(Math.abs(m.chroma.aAfter - m.chroma.aBefore)).toBeLessThan(1.5)
      expect(Math.abs(m.chroma.bAfter - m.chroma.bBefore)).toBeLessThan(1.5)
      // hitrost: < 8s v sandboxu (2 CPU)
      expect(m.timeMs).toBeLessThan(8000)

      // dokazilna slika (artefakt za poročilo)
      try {
        const out = await sharp(
          Buffer.from(res.preview.data.buffer, res.preview.data.byteOffset, res.preview.data.byteLength),
          { raw: { width: res.preview.w, height: res.preview.h, channels: 4 } },
        )
          .jpeg({ quality: 92 })
          .toBuffer()
        const { writeFileSync } = await import('node:fs')
        writeFileSync(resolve(process.cwd(), 'baseline/A_result_ts.jpg'), out)
      } catch {
        // artefakt ni ključen za uspeh testa
      }
    },
    30_000,
  )
})

// ── 6. placement roundtrip ──────────────────────────────────────────────────
describe('placement: normalize/denormalize roundtrip', () => {
  it('corners survive normalize → denormalize within ±0.5px', () => {
    const px: Corners = [
      [238.3, 462.7],
      [956.1, 302.9],
      [952.4, 668.2],
      [238.8, 726.5],
    ]
    const norm = cornerToNorm(px, 1024, 1024)
    const back = cornerToPx(norm, 1024, 1024)
    for (let i = 0; i < 4; i++) {
      expect(Math.abs(back[i][0] - px[i][0])).toBeLessThanOrEqual(0.5)
      expect(Math.abs(back[i][1] - px[i][1])).toBeLessThanOrEqual(0.5)
    }
  })
})
