/**
 * S+3 — merilni strežnik za 5 realnih montažnih scenarijev (spec §5–§7).
 * Poganja DOKAZANI A-pipeline (runPipeline, port 1:1 iz baseline/variant_a.py)
 * na 5 realnih fotografijah z realnim produktom (fence_0 S+1 bay crop) in
 * meri vse zahtevane metrike:
 *   letvice (expected vs detected), outside diff, ΔE, processing_ms,
 *   black-edge (ring), mask-bleed.
 *
 * Uporaba: bun tools/real-scenarios.ts
 * Izhod:   tmp/scenarios/results.json + result_<id>.jpg (z označenim quadrom)
 *
 * ALGORITMA NI SPREMINJAL — samo meri (spec §7: najprej izmeri).
 */
import sharp from 'sharp'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { runPipeline, cutoutProduct, countLetvice } from '../src/lib/viz/pipeline'
import { dilateBinary } from '../src/lib/viz/imageops'
import type { Corners, ImageBuffer } from '../src/lib/viz/types'
import { cornerToPx } from '../src/lib/viz/types'

const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, 'tmp', 'scenarios')
mkdirSync(OUT, { recursive: true })

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

function rgbaFromBin(bin: Uint8Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(bin.length * 4)
  for (let i = 0; i < bin.length; i++) {
    const v = bin[i] ? 255 : 0
    out[i * 4] = v; out[i * 4 + 1] = v; out[i * 4 + 2] = v; out[i * 4 + 3] = 255
  }
  return out
}

interface Scenario {
  id: string
  label: string
  input: string
  mask: string
  corners: Corners
  note: string
}

// S+1 izmerjen productQuad znotraj bay cropa (px) → normalizirano na 460×660
const PRODUCT_QUAD: Corners = [
  [0 / 460, 80 / 660],
  [460 / 460, 18 / 660],
  [460 / 460, 638 / 660],
  [0 / 460, 600 / 660],
]
const EXPECTED_SLATS = 13 // dokazano v S+1 (rectify_and_count na bay cropu)

const SCENARIOS: Scenario[] = [
  {
    id: 'T1-ravna',
    label: 'Ravna balkonska ograja (jeklena — dokazan primer S+1)',
    input: '/home/z/baseline/input/balcony_3.png',
    mask: '/home/z/baseline/mask/mask_C_old_fence.png',
    corners: [
      [238 / 1024, 462 / 1024],
      [956 / 1024, 302 / 1024],
      [952 / 1024, 668 / 1024],
      [238 / 1024, 726 / 1024],
    ],
    note: 'quad = S+1 dokazani vogali (iz mask_C poligona)',
  },
  {
    id: 'T2-perspektiva',
    label: 'Ograja z močno perspektivo (srednji balkon, kovano železo)',
    input: '/home/z/baseline/input/balcony_2.jpg',
    mask: '/home/z/baseline/mask/mask_b2_middle.png',
    corners: [
      [0.347, 0.588],
      [0.612, 0.58],
      [0.614, 0.748],
      [0.349, 0.756],
    ],
    note: 'spodaj-levo bližje, zgoraj-deso dlje — višinski raz Trap 1,2 % širine',
  },
  {
    id: 'T3-sonce',
    label: 'Sončna fotografija z močnim gradientom svetlobe (beneški balkon)',
    input: '/home/z/baseline/input/balcony_4.jpg',
    mask: '/home/z/baseline/mask/mask_b4_sun.png',
    corners: [
      [0.205, 0.372],
      [0.823, 0.356],
      [0.828, 0.592],
      [0.21, 0.607],
    ],
    note: 'sonce z leve, senca desno — gradient čez celoten produkt',
  },
  {
    id: 'T4-temna',
    label: 'Temna/antracitna ograja in temna okolica (opečna fasada)',
    input: '/home/z/baseline/input/balcony_5.jpg',
    mask: '/home/z/baseline/mask/mask_b5_dark.png',
    corners: [
      [0.115, 0.235],
      [0.885, 0.225],
      [0.88, 0.76],
      [0.12, 0.77],
    ],
    note: 'antracit produkt na temni opeki — dark-product guard (strength 0.6)',
  },
  {
    id: 'T5-zakrit',
    label: 'Delno zakrit balkon (rastline čez ograjo)',
    input: '/home/z/baseline/input/balcony_0.jpg',
    mask: '/home/z/baseline/mask/mask_b0_railing.png',
    corners: [
      [0.355, 0.56],
      [0.885, 0.505],
      [0.89, 0.76],
      [0.36, 0.785],
    ],
    note: 'kaktus + lončnice prekrivajo del ograje — stolpična sinteza ozadja',
  },
]

/** Risanje quadra + vogalnih križcev na rezultat (vizualni dokaz geometrije). */
function annotate(res: ImageBuffer, cornersPx: Corners): ImageBuffer {
  const out = new Uint8ClampedArray(res.data)
  const w = res.w
  const h = res.h
  const setPx = (x: number, y: number, r: number, g: number, b: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const i = (y * w + x) * 4
    out[i] = r; out[i + 1] = g; out[i + 2] = b
  }
  const drawCross = ([cx, cy]: [number, number], size = 16, thickness = 3) => {
    for (let d = -size; d <= size; d++) {
      for (let t = 0; t < thickness; t++) {
        setPx(cx + d, cy + t, 255, 40, 40)
        setPx(cx + t, cy + d, 255, 40, 40)
      }
    }
  }
  const drawLine = (a: [number, number], b: [number, number]) => {
    const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(a[0] + ((b[0] - a[0]) * s) / steps)
      const y = Math.round(a[1] + ((b[1] - a[1]) * s) / steps)
      setPx(x, y, 255, 40, 40); setPx(x + 1, y, 255, 40, 40)
    }
  }
  for (let i = 0; i < 4; i++) {
    drawLine(cornersPx[i], cornersPx[(i + 1) % 4])
    drawCross(cornersPx[i])
  }
  return { data: out, w, h }
}

async function main() {
  const product = await toRaw(await sharp(path.join(OUT, 'product_bay.jpg')).jpeg().toBuffer())
  const productQuadPx = cornerToPx(PRODUCT_QUAD, product.w, product.h)

  // Pričakovano št. letvic na produktu (samoskladna prevera, S+1 = 13)
  const cut = cutoutProduct(product, productQuadPx)
  const expected = countLetvice(cut.alpha, product.w, product.h, productQuadPx)
  console.log('produkt: bay 460×660 — letvice na produktu (rektificirano):', expected)

  const results: Array<Record<string, unknown>> = []
  for (const sc of SCENARIOS) {
    const t0 = performance.now()
    const original = await toRaw(await sharp(sc.input).jpeg({ quality: 95 }).toBuffer())
    const maskRaw = await toRaw(await sharp(sc.mask).toBuffer())
    // maska → binarni (vsi vhodi imajo <mask>.png kot sivo na RGB)
    const maskBin = new Uint8Array(maskRaw.w * maskRaw.h)
    for (let i = 0; i < maskBin.length; i++) maskBin[i] = maskRaw.data[i * 4] > 127 ? 1 : 0
    const mask: ImageBuffer = { data: rgbaFromBin(maskBin), w: maskRaw.w, h: maskRaw.h }

    const cornersPx = cornerToPx(sc.corners, original.w, original.h)

    const res = runPipeline({
      original,
      mask,
      product,
      productMask: null,
      cornersPx,
      productQuadPx,
    })
    const wallMs = Math.round(performance.now() - t0)

    // ── black-edge / bleed ring: dilate(mask,4) & !mask ─────────────────────
    const ring = dilateBinary(maskBin, mask.w, mask.h, 4)
    let ringDiffCount = 0
    let ringMaxDiff = 0
    let bleedCount = 0
    for (let i = 0; i < maskBin.length; i++) {
      if (ring[i] && !maskBin[i]) {
        const j = i * 4
        const d =
          Math.abs(res.preview.data[j] - original.data[j]) +
          Math.abs(res.preview.data[j + 1] - original.data[j + 1]) +
          Math.abs(res.preview.data[j + 2] - original.data[j + 2])
        if (d > 0) ringDiffCount++
        if (d > ringMaxDiff) ringMaxDiff = d
        if (d > 90) bleedCount++ // >30 na kanal = opazen produkt/senca izven
      }
    }

    // rezultat slika z označenim quadrom (vizualni dokaz)
    const annotated = annotate(res.preview, cornersPx)
    const resultJpg = await sharp(
      Buffer.from(annotated.data.buffer, annotated.data.byteOffset, annotated.data.byteLength),
      { raw: { width: annotated.w, height: annotated.h, channels: 4 } }
    )
      .jpeg({ quality: 90 })
      .toBuffer()
    writeFileSync(path.join(OUT, `result_${sc.id}.jpg`), resultJpg)

    const m = res.metrics
    const pass =
      m.letviceIdentityOk &&
      m.letviceProduct === EXPECTED_SLATS &&
      m.letviceResult === EXPECTED_SLATS &&
      m.outsideMaxPreShadow === 0 &&
      Math.abs(m.chroma.dE) < 1.5 &&
      m.timeMs < 8000 &&
      bleedCount === 0

    results.push({
      test_id: sc.id,
      label: sc.label,
      input: path.basename(sc.input),
      product: 'product_bay.jpg (fence_0 S+1 bay, 460×660)',
      mask: path.basename(sc.mask),
      placement: { corners: sc.corners, rotation: 0, scale: 1, productQuad: PRODUCT_QUAD },
      expected_slats: EXPECTED_SLATS,
      slat_check_on_product: expected,
      detected_or_rendered_slats: m.letviceResult,
      outside_max_diff: m.outsideMax,
      outside_mean_diff: m.outsideMean,
      outside_max_pre_shadow: m.outsideMaxPreShadow,
      deltaE: m.chroma.dE,
      chroma_ab: m.chroma,
      processing_ms: m.timeMs,
      wall_ms: wallMs,
      geometry_note: sc.note,
      black_edge_detected: bleedCount > 0,
      ring_diff_pixels: ringDiffCount,
      ring_max_diff: ringMaxDiff,
      mask_bleed_detected: m.outsideMaxPreShadow !== 0,
      harmonizeStrength: m.harmonizeStrength,
      alphaCoverage: m.alphaCoverage,
      result: pass ? 'PASS' : 'FAIL',
    })
    console.log(
      `${sc.id}: letvice ${m.letviceProduct}=${m.letviceResult} (exp ${EXPECTED_SLATS}), preshadow=${m.outsideMaxPreShadow}, ΔE=${m.chroma.dE.toFixed(2)}, ${m.timeMs}ms (wall ${wallMs}ms), ringMax=${ringMaxDiff}, bleed=${bleedCount} → ${pass ? 'PASS' : 'FAIL'}`
    )
  }

  writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2))
  console.log('\nresults.json zapisan v tmp/scenarios/')
}

void main()
