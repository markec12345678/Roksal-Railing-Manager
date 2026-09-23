/**
 * S+8 testi — PRODUCT SDK: DETERMINIZEM + INTEGRACIJA + VARNOST (spec §9, §19, §21, §22).
 *
 * Determinizem (§9): isti ProductDefinition + Configuration + Material →
 * BAJTNO identičen rezultat. Brez random seed-a, brez AI, brez zunanjega API.
 *
 * Varnost (§21): klient pošlje samo productId+config — API shema je .strict()
 * in zavrača ponarejen definition JSON. SDK brez server definicije NE dela.
 *
 * Guard (§19): product-sdk + A-pipeline NE SMEJO vsebovati generativnih
 * klicev (z-ai-web-dev-sdk, createVision, Math.random, chat.completions).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { runPipeline } from '@/lib/viz/pipeline'
import { buildFenceLayout } from '../geometry'
import { renderProductFence, renderWithMask } from '../render'
import { getProductDefinition } from '../catalog'
import { verifyProductIdentity } from '../invariants'
import type { FenceConfiguration } from '../types'

function defOf(id: string) {
  const def = getProductDefinition(id)
  if (!def) throw new Error(`manjka definicija ${id}`)
  return def
}

function config(over: Partial<FenceConfiguration> = {}): FenceConfiguration {
  return {
    productId: 'roksal.woodcore.polna-128',
    orientation: 'horizontal',
    spanMm: 1600,
    heightMm: 1000,
    gapMm: 20,
    ...over,
  }
}

describe('determinizem: bajtno identičen render (§9)', () => {
  it('dva renderefska klica = bajtno identična RGBA slika', () => {
    const def = defOf('roksal.woodcore.polna-128')
    const c = config({ handle: true, posts: { widthMm: 60 } })
    const a = renderProductFence({
      definition: def,
      config: c,
      material: { measuredRgb: [110, 82, 60] },
      outWidthPx: 400,
      outHeightPx: 300,
    })
    const b = renderProductFence({
      definition: def,
      config: c,
      material: { measuredRgb: [110, 82, 60] },
      outWidthPx: 400,
      outHeightPx: 300,
    })
    expect(Buffer.from(a.image.data)).toEqual(Buffer.from(b.image.data))
    expect(JSON.stringify(a.layout)).toBe(JSON.stringify(b.layout))
    expect(a.renderValid).toBe(true)
  })

  it('sprememba materiala NE spremeni geometrije (Geometry + Material = Render, §7)', () => {
    const def = defOf('roksal.woodcore.polna-128')
    const c = config()
    const base = { definition: def, config: c, outWidthPx: 320, outHeightPx: 240 }
    const a = renderProductFence({ ...base, material: { measuredRgb: [10, 10, 10] } })
    const b = renderProductFence({ ...base, material: { measuredRgb: [240, 239, 235] } })
    expect(JSON.stringify(a.layout)).toBe(JSON.stringify(b.layout))
    expect(a.renderValid).toBe(true)
    expect(b.renderValid).toBe(true)
    // sliki sta različni (barva), geometrija ista
    expect(Buffer.from(a.image.data)).not.toEqual(Buffer.from(b.image.data))
  })
})

describe('guard: brez generativnih klicev v deterministični poti (§19)', () => {
  const FORBIDDEN = ['z-ai-web-dev-sdk', 'createVision', 'chat.completions', 'Math.random']
  it('product-sdk + pipeline + fence-engine so čisti', () => {
    const dirs = [
      join(process.cwd(), 'src/lib/product-sdk'),
      join(process.cwd(), 'src/lib/procedural'),
    ]
    const files: string[] = []
    for (const d of dirs) {
      for (const f of readdirSync(d)) {
        if (f.endsWith('.ts') && !f.includes('__tests__')) files.push(join(d, f))
      }
    }
    files.push(join(process.cwd(), 'src/lib/viz/pipeline.ts'))
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      for (const bad of FORBIDDEN) {
        expect({ file, hit: src.includes(bad) }).toEqual({ file, hit: false })
      }
    }
  })
})

describe('integracija: productId → katalog → layout → render → A-pipeline (§22)', () => {
  it('SVETLI produkt (WHITE) skozi productMask → NE prosojen, identiteta OK (P0)', () => {
    const def = defOf('roksal.woodcore.polna-128')
    const c = config()
    const { render, mask: geometryMask } = renderWithMask({
      definition: def,
      config: c,
      material: { measuredRgb: [244, 242, 236] }, // WHITE — S+7 P0 problem
      outWidthPx: 540,
      outHeightPx: 380,
    })
    expect(render.renderValid).toBe(true)

    // sintetična scena: rjava stena (maska stare ograje = sredinski kvader)
    const W = 900
    const H = 600
    const original = { data: new Uint8ClampedArray(W * H * 4), w: W, h: H }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4
        original.data[i] = 150
        original.data[i + 1] = 130
        original.data[i + 2] = 110
        original.data[i + 3] = 255
      }
    }
    const sceneMask = { data: new Uint8ClampedArray(W * H * 4), w: W, h: H }
    for (let y = 200; y < 400; y++) {
      for (let x = 100; x < 800; x++) {
        const i = (y * W + x) * 4
        sceneMask.data[i] = 255
        sceneMask.data[i + 1] = 255
        sceneMask.data[i + 2] = 255
        sceneMask.data[i + 3] = 255
      }
    }

    const corners: [[number, number], [number, number], [number, number], [number, number]] = [
      [110, 205],
      [795, 215],
      [790, 390],
      [115, 385],
    ]
    const res = runPipeline({
      original,
      mask: sceneMask,
      product: render.image,
      productMask: geometryMask, // exact alpha iz geometrije (spec §11) — NE iz praga
      cornersPx: corners,
      productQuadPx: null,
    })
    // P0 dokaz: alfa prišla iz maske (ne praga 115) + pokritost visoka
    expect(res.metrics.productMaskUsed).toBe(true)
    expect(res.metrics.alphaCoverage).toBeGreaterThan(0.15)
    // identiteta: število letvic v rektificiranem prostoru = število iz layout-a
    expect(res.metrics.letviceProduct).toBe(res.metrics.letviceResult)
    expect(res.metrics.letviceProduct).toBe(render.layout.boardCount)
    // original izven maske nespremenjen (A-pipeline garancija ostaja)
    expect(res.metrics.outsideMaxPreShadow).toBe(0)
    // invarianta poročilo sledi
    const rep = verifyProductIdentity(def, c, render.layout)
    expect(rep.renderValid).toBe(true)
  })
})

describe('varnost: server-authoritative (§21)', () => {
  it('SDK brez strežniške definicije zavrne delo (definacija NI klient podatek)', () => {
    const c = config()
    expect(() => buildFenceLayout(c, { definition: undefined })).toThrow(/server-authoritative/)
  })

  it('normalizacija id: ponarejen id ne vrne nobenega produkta', () => {
    expect(getProductDefinition('../../../../etc/passwd')).toBeNull()
    expect(getProductDefinition('roksal.forged.product')).toBeNull()
  })

  it('rights=rejected → render vrže (pravicna vrata tudi v SDK)', () => {
    const def = { ...defOf('roksal.woodcore.polna-128'), rights: 'rejected' as const }
    expect(() =>
      renderProductFence({
        definition: def,
        config: config(),
        material: { measuredRgb: [0, 0, 0] },
        outWidthPx: 100,
        outHeightPx: 100,
      }),
    ).toThrow(/rejected/)
  })
})
