/**
 * S+6 — QWEN GPU PROOF-OF-QUALITY: priprava testnega dataset-a (A-strana dokazov).
 *
 * Zgradi evaluation/dataset/ z 6 realnimi testi (§5 + bonus §10):
 *   S6-T1 ravna + antracitna ograja      = S+3 T1-ravna        (balcony_3 + mask_C, S+1 dokazan quad)
 *   S6-T2 balkon pod kotom               = S+3 T2-perspektiva  (balcony_2)
 *   S6-T3 drugačna osvetlitev            = S+3 T3-sonce        (balcony_4)
 *   S6-T4 zakritje (rastlinje)           = S+3 T5-zakrit       (balcony_0)
 *   S6-T5 svetlo ozadje (barvni stres)   = S+4 T7-svetlo-ozadje (balcony_4, maska iz quad)
 *   S6-T6 occlusion drevo (bonus §10)    = S+4 T9-zakrit-drevo  (balcony_6, maska iz quad)
 *
 * Za vsak test z istim VHODOM (original, produkt, maska, placement) zgenerira:
 *   original.jpg  — realna fotografija balkona (q90)
 *   mask.png      — maska stare ograje (user datoteka ALI quad-maska, kot pri S+4)
 *   placement.json — VizPlacement v2 (normalizirani vogali + productQuad)
 *   a_preview.jpg — ČISTI A-pipeline preview (DOKAZAN algoritem, NIČ spremenjeno, brez anotacij)
 *   a_metrics.json — metriki A (letvice, outside diff, ΔE, čas)
 *
 * A-pipeline NI SPREMENJEN (1:1 = tools/real-scenarios.ts). Produkt = fence_0 bay 460×660.
 *
 * Uporaba: bun tools/s6-a-baselines.ts
 */
import sharp from 'sharp'
import { writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { runPipeline, cutoutProduct, countLetvice } from '../src/lib/viz/pipeline'
import { fillPolygon } from '../src/lib/viz/imageops'
import type { Corners, ImageBuffer, VizPlacement } from '../src/lib/viz/types'
import { cornerToPx } from '../src/lib/viz/types'

const ROOT = path.join(__dirname, '..')
const BASE = '/home/z/baseline'
const OUT = path.join(ROOT, 'evaluation', 'dataset')
mkdirSync(OUT, { recursive: true })

/** §17 — kanoničen minimalen determinističen prompt (spec S+6 §17, shranjen poleg rezultatov). */
export const CANONICAL_PROMPT =
  'Preserve the exact reference railing design, geometry, color and structure. ' +
  'Integrate it into the marked railing area while preserving the original architecture and surroundings.'

/** S+1 izmerjen productQuad znotraj bay cropa (px) → normalizirano na 460×660. */
const PRODUCT_QUAD: Corners = [
  [0 / 460, 80 / 660],
  [460 / 460, 18 / 660],
  [460 / 460, 638 / 660],
  [0 / 460, 600 / 660],
]
const EXPECTED_SLATS = 13 // dokazano v S+1 (rectify_and_count na bay cropu fence_0)

interface S6Scenario {
  id: string
  category: string // §5 preslikava
  sourceScenario: string
  input: string
  maskFile: string | null
  maskQuad: Corners | null
  corners: Corners
  seed: number
  occlusionRegion: Corners | null
  note: string
}

const SCENARIOS: S6Scenario[] = [
  {
    id: 'S6-T1-ravna-antracit',
    category: '§5 TEST 1 — raven balkon + antracitna ograja',
    sourceScenario: 'S+3 T1-ravna (S+1 dokazani vogali)',
    input: `${BASE}/input/balcony_3.png`,
    maskFile: `${BASE}/mask/mask_C_old_fence.png`,
    maskQuad: null,
    corners: [
      [238 / 1024, 462 / 1024],
      [956 / 1024, 302 / 1024],
      [952 / 1024, 668 / 1024],
      [238 / 1024, 726 / 1024],
    ],
    seed: 250901,
    occlusionRegion: null,
    note: 'kvader = S+1 dokazani vogali (iz mask_C poligona)',
  },
  {
    id: 'S6-T2-perspektiva',
    category: '§5 TEST 2 — balkon pod kotom (perspektiva)',
    sourceScenario: 'S+3 T2-perspektiva',
    input: `${BASE}/input/balcony_2.jpg`,
    maskFile: `${BASE}/mask/mask_b2_middle.png`,
    maskQuad: null,
    corners: [
      [0.347, 0.588],
      [0.612, 0.58],
      [0.614, 0.748],
      [0.349, 0.756],
    ],
    seed: 250902,
    occlusionRegion: null,
    note: 'spodaj-levo bližje, zgoraj-deso dlje — višinski raz 1,2 % širine',
  },
  {
    id: 'S6-T3-osvetlitev',
    category: '§5 TEST 3 — drugačna osvetlitev (sončni gradient)',
    sourceScenario: 'S+3 T3-sonce',
    input: `${BASE}/input/balcony_4.jpg`,
    maskFile: `${BASE}/mask/mask_b4_sun.png`,
    maskQuad: null,
    corners: [
      [0.205, 0.372],
      [0.823, 0.356],
      [0.828, 0.592],
      [0.21, 0.607],
    ],
    seed: 250903,
    occlusionRegion: null,
    note: 'sonce z leve, senca desno — gradient čez celoten produkt',
  },
  {
    id: 'S6-T4-occlusion-rastlinje',
    category: '§5 TEST 4 — ograja pred rastlinjem / delno zakritje',
    sourceScenario: 'S+3 T5-zakrit',
    input: `${BASE}/input/balcony_0.jpg`,
    maskFile: `${BASE}/mask/mask_b0_railing.png`,
    maskQuad: null,
    corners: [
      [0.355, 0.56],
      [0.885, 0.505],
      [0.89, 0.76],
      [0.36, 0.785],
    ],
    seed: 250904,
    occlusionRegion: [
      [0.355, 0.56],
      [0.62, 0.53],
      [0.625, 0.79],
      [0.36, 0.815],
    ],
    note: 'kaktus + lončnice prekrivajo del ograje (S+4: 94 % rastlin prebarvanih = znana omejitev A)',
  },
  {
    id: 'S6-T5-svetlo-ozadje',
    category: '§5 TEST 5 — svetla/drugače obarvana ograja (PROXY: svetlo ozadje, temen produkt)',
    sourceScenario: 'S+4 T7-svetlo-ozadje',
    input: `${BASE}/input/balcony_4.jpg`,
    maskFile: null,
    maskQuad: [
      [0.18, 0.245],
      [0.835, 0.245],
      [0.835, 0.612],
      [0.18, 0.612],
    ],
    corners: [
      [0.185, 0.25],
      [0.83, 0.25],
      [0.83, 0.605],
      [0.185, 0.605],
    ],
    seed: 250905,
    occlusionRegion: null,
    note: 'neposredno sonce na belem ometu za antracitnim produktom — najvišje barvno-drift tveganje. Iskreno: realna SVETLA ograja kot produkt ni na voljo (fence_1/5 = CGI, fence_7 = realna a z vodnim žigom in svetle letvice > CUTOUT_GRAY_THRESHOLD 115 → A cutout po zasnovi ključe TEMNE letvice). Zahtevan asset: prava svetla ograja iz Roksal kataloga.',
  },
  {
    id: 'S6-T6-occlusion-drevo',
    category: '§10 BONUS — occlusion (deblo sega v kvader)',
    sourceScenario: 'S+4 T9-zakrit-drevo',
    input: `${BASE}/input/balcony_6.jpg`,
    maskFile: null,
    maskQuad: [
      [0.255, 0.37],
      [0.625, 0.37],
      [0.625, 0.445],
      [0.255, 0.445],
    ],
    corners: [
      [0.262, 0.377],
      [0.618, 0.377],
      [0.618, 0.438],
      [0.262, 0.438],
    ],
    seed: 250906,
    occlusionRegion: [
      [0.565, 0.37],
      [0.635, 0.37],
      [0.635, 0.445],
      [0.565, 0.445],
    ],
    note: 'desni rob kvadrata (x>0.565) prekriva deblo — S+4: 67 % debla prebarvanega = znana omejitev A',
  },
]

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

function rgbaFromBin(bin: Uint8Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(bin.length * 4)
  for (let i = 0; i < bin.length; i++) {
    const v = bin[i] ? 255 : 0
    out[i * 4] = v
    out[i * 4 + 1] = v
    out[i * 4 + 2] = v
    out[i * 4 + 3] = 255
  }
  return out
}

async function main() {
  const productPath = path.join(ROOT, 'tmp', 'scenarios', 'product_bay.jpg')
  if (!existsSync(productPath)) throw new Error(`manjka ${productPath} — poženi prej tools/real-scenarios.ts ali kopiraj S+1 bay crop`)
  const product = await toRaw(await sharp(productPath).jpeg({ quality: 95 }).toBuffer())
  const productQuadPx = cornerToPx(PRODUCT_QUAD, product.w, product.h)

  // pričakovane letvice na produktu (samoskladna prevera, S+1 = 13)
  const cut = cutoutProduct(product, productQuadPx)
  const expected = countLetvice(cut.alpha, product.w, product.h, productQuadPx)
  console.log('produkt: bay 460×660 (fence_0, realna fotografija) — letvice (rektificirano):', expected)
  if (expected !== EXPECTED_SLATS) throw new Error(`produkt letvice ${expected} ≠ ${EXPECTED_SLATS} — produkt ni konsistenten — STOP`)

  // produkt v dataset
  mkdirSync(path.join(OUT, 'product'), { recursive: true })
  copyFileSync(productPath, path.join(OUT, 'product', 'product_bay.jpg'))

  const manifestTests: Record<string, unknown>[] = []
  for (const sc of SCENARIOS) {
    const t0 = performance.now()
    const dir = path.join(OUT, sc.id)
    mkdirSync(dir, { recursive: true })

    const original = await toRaw(await sharp(sc.input).jpeg({ quality: 90 }).toBuffer())

    // maska: user datoteka (realna) ALI quad-maska (kot S+4 za T6–T10)
    let mask: ImageBuffer
    if (sc.maskFile) {
      const maskRaw = await toRaw(await sharp(sc.maskFile).toBuffer())
      const bin = new Uint8Array(maskRaw.w * maskRaw.h)
      for (let i = 0; i < bin.length; i++) bin[i] = maskRaw.data[i * 4] > 127 ? 1 : 0
      mask = { data: rgbaFromBin(bin), w: maskRaw.w, h: maskRaw.h }
    } else if (sc.maskQuad) {
      const quadPx = cornerToPx(sc.maskQuad, original.w, original.h)
      const bin = fillPolygon(quadPx as Array<[number, number]>, original.w, original.h)
      mask = { data: rgbaFromBin(bin), w: original.w, h: original.h }
    } else throw new Error(`${sc.id}: manjka maskFile ali maskQuad`)

    const cornersPx = cornerToPx(sc.corners, original.w, original.h)

    // DOKAZAN A-pipeline — NIČ spremenjeno (port 1:1 iz tools/real-scenarios.ts)
    const res = runPipeline({
      original,
      mask,
      product,
      productMask: null,
      cornersPx,
      productQuadPx,
    })
    const wallMs = Math.round(performance.now() - t0)
    const m = res.metrics

    // piši datoteke
    await sharp(Buffer.from(original.data.buffer, original.data.byteOffset, original.data.byteLength), {
      raw: { width: original.w, height: original.h, channels: 4 },
    })
      .jpeg({ quality: 90 })
      .toFile(path.join(dir, 'original.jpg'))
    await sharp(Buffer.from(mask.data.buffer, mask.data.byteOffset, mask.data.byteLength), {
      raw: { width: mask.w, height: mask.h, channels: 4 },
    })
      .png()
      .toFile(path.join(dir, 'mask.png'))
    await sharp(Buffer.from(res.preview.data.buffer, res.preview.data.byteOffset, res.preview.data.byteLength), {
      raw: { width: res.preview.w, height: res.preview.h, channels: 4 },
    })
      .jpeg({ quality: 92 })
      .toFile(path.join(dir, 'a_preview.jpg'))

    const placement: VizPlacement = {
      version: 2,
      corners: sc.corners,
      rotation: 0,
      scale: 1,
      productQuad: PRODUCT_QUAD,
    }
    writeFileSync(path.join(dir, 'placement.json'), JSON.stringify(placement, null, 2))

    const aMetrics = {
      test_id: sc.id,
      pipeline: 'A (deterministic composite) — src/lib/viz/pipeline.ts, nespremenjen od S+1',
      letvice_product: m.letviceProduct,
      letvice_result: m.letviceResult,
      letvice_identity_ok: m.letviceIdentityOk,
      outside_max_diff: m.outsideMax,
      outside_mean_diff: m.outsideMean,
      outside_max_pre_shadow: m.outsideMaxPreShadow,
      deltaE: m.chroma.dE,
      harmonizeStrength: m.harmonizeStrength,
      alphaCoverage: m.alphaCoverage,
      processing_ms: m.timeMs,
      wall_ms: wallMs,
      original_size: [original.w, original.h],
      note: sc.note,
    }
    writeFileSync(path.join(dir, 'a_metrics.json'), JSON.stringify(aMetrics, null, 2))

    manifestTests.push({
      id: sc.id,
      category: sc.category,
      sourceScenario: sc.sourceScenario,
      dir: sc.id,
      original: `${sc.id}/original.jpg`,
      product: 'product/product_bay.jpg',
      mask: `${sc.id}/mask.png`,
      placement: `${sc.id}/placement.json`,
      aPreview: `${sc.id}/a_preview.jpg`,
      aMetrics: `${sc.id}/a_metrics.json`,
      corners: sc.corners,
      productQuad: PRODUCT_QUAD,
      occlusionRegion: sc.occlusionRegion,
      seed: sc.seed,
      prompt: CANONICAL_PROMPT,
      expectedSlats: EXPECTED_SLATS,
      resolutionTarget: 'final',
      note: sc.note,
    })

    console.log(
      `${sc.id}: letvice ${m.letviceProduct}=${m.letviceResult}, preshadow=${m.outsideMaxPreShadow}, ΔE=${m.chroma.dE.toFixed(2)}, ${m.timeMs}ms → ${dir}`
    )
  }

  const manifest = {
    version: 1,
    round: 'S+6 — QWEN GPU PROOF-OF-QUALITY',
    generated: new Date().toISOString(),
    product: {
      file: 'product/product_bay.jpg',
      description: 'fence_0 S+1 bay crop 460×660 — realna fotografija Roksal ograje (antracit, 13 letvic)',
      expectedSlats: EXPECTED_SLATS,
      productQuad: PRODUCT_QUAD,
    },
    promptCanonical: CANONICAL_PROMPT,
    promptPolicy: '§17 — minimalen determinističen prompt, shranjen poleg vsakega rezultata; rewrite_prompt izklopljen',
    seedPolicy: '§18 — fiksni seed na test (ponovitev istega renderja mora dati isti izhod, če runtime omogoča determinizem)',
    tests: manifestTests,
  }
  writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`\nmanifest.json: ${manifestTests.length} testov → ${OUT}`)
}

void main()
