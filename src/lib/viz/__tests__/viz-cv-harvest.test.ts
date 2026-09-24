/**
 * S+8.2 — OgrajaVizija → Roksal CV HARVEST (issue #6): testna matrica.
 *
 * PORTANI TESTNI PRIJEMI iz OgrajaVizija (HEAD ebc4a12, repo NI dependency —
 * samo testne ideje iz tools/jvmtest/CoreTest.kt, prevedene v Roksal Vitest):
 *
 *  - CoreTest testHomography: natančnost vogalov, inverz, degeneriran štirikotnik
 *  - CoreTest testLab: sRGB→LAB→sRGB round-trip ≤ 1/255, L(črna)=0, L(bela)=max
 *  - CoreTest testNoLeakage: original IZVEN maske BITNO enak (zahteva 9)
 *  - CoreTest testShadow: senca potemni pod izdelkom + determinizem
 *  - backend/scripts/test_pipeline.py: leakage gate (PASS_protection ⇔ ratio==0)
 *
 * NOVI §4 VEKTORJI (obvezna matrica iz issue #6): identity, translation, scale,
 * affine, normal/strong perspective, nearly-degenerate, duplicate corner,
 * collinear, reversed ordering, singular inverse, src/dst rect, mask warp,
 * alpha warp.
 *
 * NOVI §6 KONTRAKT: vsak piksel IZVEN dovoljenega območja ostane BITNO identičen
 * originalu (ne samo "vizualno podoben") — matrika scenarijev.
 */
import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { Corners, ImageBuffer } from '@/lib/viz/types'
import {
  applyHomography,
  computeInverse,
  solveHomography,
  warpFloat,
  warpImage,
  warpPremultiplied,
} from '@/lib/viz/homography'
import { rgb2labScalar, lab2rgbScalar } from '@/lib/viz/color'
import { runPipeline } from '@/lib/viz/pipeline'

function rgbaImage(w: number, h: number, fill: (x: number, y: number) => [number, number, number, number?]): ImageBuffer {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = fill(x, y)
      const i = (y * w + x) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = a ?? 255
    }
  }
  return { data, w, h }
}

function checksum(img: ImageBuffer): string {
  return createHash('sha256').update(img.data).digest('hex')
}

// ═══════════════════════════════ §4 HOMOGRAFIJA — OBAVEZNI VEKTORJI ═════════

const SRC_QUAD: Corners = [
  [0, 0],
  [200, 0],
  [200, 100],
  [0, 100],
]

function maxCornerError(src: Corners, dst: Corners, H: number[]): number {
  let maxE = 0
  for (let i = 0; i < 4; i++) {
    const [u, v] = applyHomography(H, src[i][0], src[i][1])
    maxE = Math.max(maxE, Math.abs(u - dst[i][0]), Math.abs(v - dst[i][1]))
  }
  return maxE
}

describe('S+8.2 §4: homography test vectors (OgrajaVizija harvest)', () => {
  it('identity: rect → same rect maps exactly (H ≈ I)', () => {
    const dst: Corners = [...SRC_QUAD]
    const H = solveHomography(SRC_QUAD, dst)
    expect(maxCornerError(SRC_QUAD, dst, H)).toBeLessThan(1e-9)
    // H je do skale enota: h0≈h4, h8 največji
    expect(Math.abs(H[0] - H[4])).toBeLessThan(1e-9)
  })

  it('translation: shifts all corners by (+37, -23)', () => {
    const dst = SRC_QUAD.map(([x, y]) => [x + 37, y - 23]) as Corners
    const H = solveHomography(SRC_QUAD, dst)
    expect(maxCornerError(SRC_QUAD, dst, H)).toBeLessThan(1e-9)
    const [u, v] = applyHomography(H, 100, 50)
    expect(Math.abs(u - 137)).toBeLessThan(1e-9)
    expect(Math.abs(v - 27)).toBeLessThan(1e-9)
  })

  it('scale: 200×100 → 400×200 uniform 2×', () => {
    const dst: Corners = [
      [0, 0],
      [400, 0],
      [400, 200],
      [0, 200],
    ]
    const H = solveHomography(SRC_QUAD, dst)
    expect(maxCornerError(SRC_QUAD, dst, H)).toBeLessThan(1e-9)
    const [u, v] = applyHomography(H, 150, 75)
    expect(Math.abs(u - 300)).toBeLessThan(1e-9)
    expect(Math.abs(v - 150)).toBeLessThan(1e-9)
  })

  it('affine: parallelogram (rotation+shear, no perspective) exact', () => {
    const dst: Corners = [
      [40, 30],
      [240, 60],
      [290, 160],
      [90, 130],
    ]
    const H = solveHomography(SRC_QUAD, dst)
    expect(maxCornerError(SRC_QUAD, dst, H)).toBeLessThan(1e-9)
  })

  it('normal perspective (OgrajaVizija CoreTest Test A quad) exact < 1e-9', () => {
    // Isti kvader kot CoreTest.kt:47-63 (200×100 → balkon perspektiva)
    const dst: Corners = [
      [100, 200],
      [500, 180],
      [540, 400],
      [80, 420],
    ]
    const H = solveHomography(SRC_QUAD, dst)
    expect(maxCornerError(SRC_QUAD, dst, H)).toBeLessThan(1e-9)
    // inverz vrne izvorni (w,h) — CoreTest: "inverz vrne (w,h)"
    const Hi = computeInverse(H)
    const [bx, by] = applyHomography(Hi, dst[2][0], dst[2][1])
    expect(Math.abs(bx - 200)).toBeLessThan(1e-9)
    expect(Math.abs(by - 100)).toBeLessThan(1e-9)
  })

  it('strong perspective: extreme quad still exact', () => {
    const dst: Corners = [
      [0, 0],
      [800, -150],
      [750, 500],
      [-50, 420],
    ]
    const H = solveHomography(SRC_QUAD, dst)
    expect(maxCornerError(SRC_QUAD, dst, H)).toBeLessThan(1e-9)
  })

  it('nearly degenerate (0.5px off) still solves — validacija ne pretirava', () => {
    const dst: Corners = [
      [100, 200],
      [100.5, 200],
      [540, 400],
      [80, 420],
    ]
    const H = solveHomography(SRC_QUAD, dst)
    expect(maxCornerError(SRC_QUAD, dst, H)).toBeLessThan(1e-6)
  })

  it('duplicate corner THROWS (port: OV Homography.kt:81-98) — prej tiho NaN', () => {
    const dst: Corners = [
      [100, 200],
      [100, 200],
      [540, 400],
      [80, 420],
    ]
    expect(() => solveHomography(SRC_QUAD, dst)).toThrow(/degenerate quad/)
  })

  it('collinear dst (3 točke na premici) THROWS', () => {
    const dst: Corners = [
      [0, 0],
      [100, 0],
      [200, 0],
      [80, 420],
    ]
    expect(() => solveHomography(SRC_QUAD, dst)).toThrow(/degenerate quad/)
  })

  it('reversed/wrong corner ordering maps src[i] → reversed dst[i] (dokumentirano vedenje)', () => {
    const dst: Corners = [
      [100, 200],
      [500, 180],
      [540, 400],
      [80, 420],
    ]
    const reversed: Corners = [dst[3], dst[2], dst[1], dst[0]]
    const H = solveHomography(SRC_QUAD, reversed)
    expect(maxCornerError(SRC_QUAD, reversed, H)).toBeLessThan(1e-9)
  })

  it('singular inverse THROWS (computeInverse)', () => {
    expect(() => computeInverse([1, 2, 3, 2, 4, 6, 0, 0, 0])).toThrow(/singular/)
  })

  it('inverse round-trip: H then H⁻¹ maps dst corners back to src (≤ 1e-9)', () => {
    const dst: Corners = [
      [238, 462],
      [956, 302],
      [952, 668],
      [238, 726],
    ]
    const H = solveHomography(SRC_QUAD, dst)
    const Hi = computeInverse(H)
    let maxE = 0
    for (let i = 0; i < 4; i++) {
      const [bx, by] = applyHomography(Hi, dst[i][0], dst[i][1])
      maxE = Math.max(maxE, Math.abs(bx - SRC_QUAD[i][0]), Math.abs(by - SRC_QUAD[i][1]))
    }
    expect(maxE).toBeLessThan(1e-9)
  })

  it('applyHomography w=0 guard: horizon point je FINITE (port: OV apply 1e-12 clamp) — prej NaN', () => {
    // H z w = x - y: točka (0,0) leži na horizontu; števci ≠ 0 → ogromen finite
    const H = [1, 0, 5, 0, 1, 3, 1, -1, 0]
    const [u, v] = applyHomography(H, 0, 0)
    expect(Number.isFinite(u)).toBe(true)
    expect(Number.isFinite(v)).toBe(true)
    expect(Math.abs(u - 5e12)).toBeLessThan(1)
    expect(Math.abs(v - 3e12)).toBeLessThan(1)
  })

  it('src rect → dst rect (affine) exact', () => {
    const dst: Corners = [
      [10, 20],
      [210, 20],
      [210, 120],
      [10, 120],
    ]
    const H = solveHomography(SRC_QUAD, dst)
    expect(maxCornerError(SRC_QUAD, dst, H)).toBeLessThan(1e-9)
  })
})

// ═══════════════════════ §4 WARP: mask / alpha / sampling ═══════════════════

describe('S+8.2 §4/§5: warpImage alphaMode, warpFloat, warpPremultiplied', () => {
  it('mask warp (warpImage alphaMode): R kanal → R=G=B, A=255', () => {
    const src = rgbaImage(4, 4, (x, y) => ((x + y) % 2 === 0 ? [200, 11, 22] : [100, 33, 44]))
    const H = [1, 0, 0, 0, 1, 0, 0, 0, 1]
    const out = warpImage(src, H, 4, 4, { alphaMode: true })
    for (let i = 0; i < 16; i++) {
      const p = i * 4
      expect(out.data[p]).toBe(out.data[p + 1])
      expect(out.data[p + 1]).toBe(out.data[p + 2])
      expect(out.data[p + 3]).toBe(255)
    }
    // vrednosti so vzorčene iz R kanala (G/B se ne smejo pojaviti)
    expect(out.data[0]).toBe(200) // (0,0): R=200
    expect(out.data[4]).toBe(100) // (1,0): R=100
  })

  it('alpha warp (warpFloat): piksli izven vira = 0 (zero border)', () => {
    const alpha = new Float32Array(8 * 8)
    for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) alpha[y * 8 + x] = 1
    const H = [2, 0, 0, 0, 2, 0, 0, 0, 1] // 2× scale → izven izvora je prazno
    const out = warpFloat(alpha, 8, 8, H, 16, 16)
    expect(out[5 * 16 + 5]).toBe(1)
    expect(out[1 * 16 + 1]).toBe(0) // izven preslikave vira
  })

  it('KEEP-guard warpPremultiplied: prosojni vir brez RGB ne povzroči črnega robu', () => {
    // 4×1: dve prosojni (A=0, RGB=0 — "prazni" piksli) + neprosojna barva
    const color = rgbaImage(4, 1, (x) => (x < 2 ? [0, 0, 0, 0] : [250, 120, 10, 255]))
    const alpha = new Float32Array([0, 0, 1, 1])
    const H = [1, 0, 0, 0, 1, 0, 0, 0, 1]
    const out = warpPremultiplied(color, alpha, H, 4, 1)
    // pri x=2 je pokritost 1 → barva mora biti čista (brez umazanije iz A=0 pikslov)
    expect(out.alpha[2]).toBeCloseTo(1, 6)
    expect(out.color.data[8]).toBe(250)
    expect(out.color.data[9]).toBe(120)
    expect(out.color.data[10]).toBe(10)
  })
})

// ═══════════════════ §12 PORT: LAB round-trip (OV CoreTest testLab) ═════════

describe('S+8.2 §12: LAB round-trip (preveden iz OV CoreTest testLab)', () => {
  it('L(črna)=0, L(bela)=255 (OpenCV 8-bit konvencija), siva≈L50', () => {
    const black = rgb2labScalar(0, 0, 0)
    const white = rgb2labScalar(255, 255, 255)
    expect(black.L).toBeLessThan(0.5)
    expect(Math.abs(white.L - 255)).toBeLessThan(0.5)
    // OV: siva 118 ≈ L*49.7 → 49.7 × 2.55 ≈ 126.7 v 8-bit konvenciji
    const gray = rgb2labScalar(118, 118, 118)
    expect(Math.abs(gray.L - 126.7)).toBeLessThan(3)
    // siva: a/b okoli 128 (nevtralna)
    expect(Math.abs(gray.a - 128)).toBeLessThan(1.5)
    expect(Math.abs(gray.b - 128)).toBeLessThan(1.5)
  })

  it('sRGB→LAB→sRGB round-trip ≤ 1/255 na mreži (OV: maxErr ≤ 1.0)', () => {
    let maxErr = 0
    for (const r of [0, 30, 118, 200, 255]) {
      for (const g of [0, 64, 118, 190, 255]) {
        for (const b of [0, 90, 118, 210, 255]) {
          const lab = rgb2labScalar(r, g, b)
          const rgb = lab2rgbScalar(lab.L, lab.a, lab.b)
          maxErr = Math.max(maxErr, Math.abs(rgb.r - r), Math.abs(rgb.g - g), Math.abs(rgb.b - b))
        }
      }
    }
    expect(maxErr).toBeLessThanOrEqual(1)
  })

  it('FIX benchmark: temne barve (L* ≤ 8, RAL 9005 razred) round-trip ≤ 2/255 — prej 20/255', () => {
    // rgb(0,0,90) je bil NAJHUJŠI primer pred popravkom (napaka 20 v G kanalu)
    const lab = rgb2labScalar(0, 0, 90)
    expect(lab.L).toBeLessThanOrEqual(20.4) // res temna barva (L* ≤ 8)
    const rgb = lab2rgbScalar(lab.L, lab.a, lab.b)
    expect(Math.max(Math.abs(rgb.r - 0), Math.abs(rgb.g - 0), Math.abs(rgb.b - 90))).toBeLessThanOrEqual(2)
    // RAL 9005 (jet black ≈ rgb(26,29,32)): produkcijsko najpomembnejša temna barva
    const ral9005 = rgb2labScalar(26, 29, 32)
    const back = lab2rgbScalar(ral9005.L, ral9005.a, ral9005.b)
    expect(Math.max(Math.abs(back.r - 26), Math.abs(back.g - 29), Math.abs(back.b - 32))).toBeLessThanOrEqual(2)
  })
})

// ═══════════ §6 BITNO-TOČNA ZAŠČITA ORIGINALA IZVEN MASKE (matrika) ═════════

describe('S+8.2 §6: bit-exact outside-mask protection matrix', () => {
  const W = 200
  const H = 220
  // "fasada" z gradientom + determinističnim vzorcem (iz OV syntheticScene)
  const scene = rgbaImage(W, H, (x, y) => {
    const base = 150 + Math.floor((y * 60) / H)
    const n = ((x * 31 + y * 17) % 7) - 3
    const v = Math.min(255, Math.max(0, base + n))
    return [v, Math.max(0, v - 8), Math.max(0, v - 20)]
  })
  // maska: pas v sredini (kot ograja)
  const mask = rgbaImage(W, H, (x, y) =>
    y >= 80 && y < 150 && x >= 40 && x < 160 ? [255, 255, 255] : [0, 0, 0],
  )
  const corners: Corners = [
    [40, 80],
    [160, 84],
    [158, 148],
    [42, 146],
  ]

  function runWith(opts: { feather?: number; shadow?: boolean; harmonize?: boolean }, productMask?: ImageBuffer | null, cornersPx: Corners = corners) {
    const product = rgbaImage(80, 40, (x) => (x % 12 < 5 ? [30, 30, 32] : [200, 200, 200]))
    return runPipeline({
      original: scene,
      mask,
      product,
      productMask: productMask ?? null,
      cornersPx,
      productQuadPx: null,
      options: { shadow: false, ...opts },
    })
  }

  function bitDiffOutsideMask(preview: ImageBuffer, m: ImageBuffer): { count: number; maxChannel: number } {
    let count = 0
    let maxChannel = 0
    for (let i = 0; i < W * H; i++) {
      if (m.data[i * 4] > 127) continue // znotraj maske
      for (let c = 0; c < 3; c++) {
        const d = Math.abs(scene.data[i * 4 + c] - preview.data[i * 4 + c])
        if (d > 0) count++
        if (d > maxChannel) maxChannel = d
      }
    }
    return { count, maxChannel }
  }

  it.each([
    ['normalna maska', {}],
    ['feather radius 0', { feather: 0 }],
    ['feather radius 8', { feather: 8 }],
    ['brez harmonizacije', { harmonize: false }],
  ] as const)('bitno točno izven maske: %s (diff=0, maxChannel=0)', (_name, opts) => {
    const res = runWith(opts)
    const d = bitDiffOutsideMask(res.preview, mask)
    expect(d.count).toBe(0) // outsideMaskDiffPixels = 0
    expect(d.maxChannel).toBe(0) // outsideMaskMaxChannelDiff = 0
    expect(res.metrics.outsideMaxPreShadow).toBe(0)
  })

  it('1-px-visoka maska: še vedno bitno točno izven', () => {
    const thinMask = rgbaImage(W, H, (x, y) => (y === 100 && x >= 40 && x < 160 ? [255, 255, 255] : [0, 0, 0]))
    const product = rgbaImage(80, 40, (x) => (x % 12 < 5 ? [30, 30, 32] : [200, 200, 200]))
    const res = runPipeline({
      original: scene,
      mask: thinMask,
      product,
      productMask: null,
      cornersPx: corners,
      productQuadPx: null,
      options: { shadow: false },
    })
    const d = bitDiffOutsideMask(res.preview, thinMask)
    expect(d.count).toBe(0)
    expect(d.maxChannel).toBe(0)
  })

  it('maska izven bounding boxa produkta: izdelek ne razliva', () => {
    const farMask = rgbaImage(W, H, (x, y) => (x >= 170 && y >= 10 && y < 60 ? [255, 255, 255] : [0, 0, 0]))
    const product = rgbaImage(80, 40, (x) => (x % 12 < 5 ? [30, 30, 32] : [200, 200, 200]))
    const res = runPipeline({
      original: scene,
      mask: farMask,
      product,
      productMask: null,
      cornersPx: [
        [170, 10],
        [199, 12],
        [198, 58],
        [171, 56],
      ],
      productQuadPx: null,
      options: { shadow: false },
    })
    const d = bitDiffOutsideMask(res.preview, farMask)
    expect(d.count).toBe(0)
    expect(d.maxChannel).toBe(0)
  })

  it('prosojni produkt (exact alpha productMask): bitno točno izven maske', () => {
    // produkt 80×40 z luknjo (A=0 območje) — productMask določa exact alpha
    const product = rgbaImage(80, 40, (x, y) => (x >= 20 && x < 60 && y >= 10 && y < 30 ? [0, 0, 0, 0] : [60, 60, 64, 255]))
    const productMask = rgbaImage(80, 40, (x, y) => (x >= 20 && x < 60 && y >= 10 && y < 30 ? [0, 0, 0] : [255, 255, 255]))
    const res = runWith({ shadow: false }, productMask)
    const d = bitDiffOutsideMask(res.preview, mask)
    expect(d.count).toBe(0)
    expect(d.maxChannel).toBe(0)
  })

  it('ekstremna perspektiva: bitno točno izven maske', () => {
    const extremeCorners: Corners = [
      [30, 82],
      [170, 70],
      [175, 160],
      [35, 152],
    ]
    const res = runWith({ shadow: false }, null, extremeCorners)
    const d = bitDiffOutsideMask(res.preview, mask)
    expect(d.count).toBe(0)
    expect(d.maxChannel).toBe(0)
  })

  it('SENCA (shadow=true): spremembe izven maske so OMEJENE na pas pod spodnjim robom', () => {
    const res = runWith({ shadow: true })
    expect(res.metrics.outsideMaxPreShadow).toBe(0)
    // senca: pasovi začnejo pri y = bl.y+4, blur σ5 doseže ~15px višje
    const bl = corners[3]
    const br = corners[2]
    const xMin = Math.floor(Math.min(bl[0], br[0])) - 20
    const xMax = Math.ceil(Math.max(bl[0], br[0])) + 20
    const yMin = Math.floor(bl[1]) - 20
    let leak = 0
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x
        if (mask.data[i * 4] > 127) continue
        for (let c = 0; c < 3; c++) {
          if (Math.abs(scene.data[i * 4 + c] - res.preview.data[i * 4 + c]) > 0) {
            if (x < xMin || x > xMax || y < yMin) leak++
          }
        }
      }
    }
    expect(leak).toBe(0)
  })
})

// ═══════════════ §16 DETERMINIZEM 100× (runPipeline — kritična funkcija) ════

describe('S+8.2 §16: determinism ≥100× (runPipeline byte-identical)', () => {
  it('100 ponovitev → identičen sha256 preview bajtov', () => {
    const W = 160
    const H = 160
    const scene = rgbaImage(W, H, (x, y) => [40 + ((x * 7 + y * 13) % 60), 60, 80])
    const mask = rgbaImage(W, H, (x, y) => (y >= 50 && y < 110 && x >= 30 && x < 130 ? [255, 255, 255] : [0, 0, 0]))
    const product = rgbaImage(64, 32, (x) => (x % 10 < 4 ? [30, 30, 32] : [200, 200, 200]))
    const input = {
      original: scene,
      mask,
      product,
      productMask: null,
      cornersPx: [
        [30, 50],
        [130, 54],
        [128, 108],
        [32, 104],
      ] as Corners,
      productQuadPx: null,
      options: { shadow: true },
    }
    let reference: string | null = null
    for (let i = 0; i < 100; i++) {
      const res = runPipeline(input)
      const sha = checksum(res.preview)
      if (reference === null) reference = sha
      else expect(sha).toBe(reference)
    }
    expect(reference).not.toBeNull()
  })
})
