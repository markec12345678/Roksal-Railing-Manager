/**
 * S+4 §8 — realni vizualni testi T6–T10 (+ §9 T5 occlusion analiza).
 *
 * 5 NOVIH scenarijev na realnih fotografijah, DOKAZANI A-pipeline 1:1
 * (runPipeline, NI spremenjen — spec §8: "Ne spreminjaj algoritma"):
 *   T6  — zelo močna perspektiva   (balcony_7 — vogalni balkon, recede okrog kota)
 *   T7  — zelo svetlo ozadje + temna ograja (balcony_4 — sončna preperela stena)
 *   T8  — zelo temna scena + antracit produkt (balcony_5 — spodnji temni pas)
 *   T9  — delna zakritost z drevesom (balcony_6 — deblo PRED ograjo)
 *   T10 — nepravilen/ukrivljen obstoječi rob (balcony_1 — okrasno kovano železo)
 *
 * Maska = poligon okrog stare ograje (kot bi jo risal monter — programsko
 * izrisana iz izmerjenih vogalov, dokumentirano per scenarij).
 *
 * Uporaba:  bun tools/real-scenarios-s4.ts
 * Izhod:    tmp/scenarios/results-s4.json + result_S4_<id>.jpg + s4_T5_occlusion.jpg
 */
import sharp from 'sharp'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { runPipeline, cutoutProduct, countLetvice } from '../src/lib/viz/pipeline'
import { dilateBinary, fillPolygon } from '../src/lib/viz/imageops'
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

/** Risanje quadra + vogalnih križcev na rezultat. */
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

interface S4Scenario {
  id: string
  label: string
  input: string
  /** Poligon maske (normaliziran) — kot bi ga risal monter okrog stare ograje. */
  maskQuad: Corners
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
const EXPECTED_SLATS = 13

// module-level (nastavi main) — uporablja jih analyzeOcclusion
let PRODUCT: ImageBuffer | null = null
let PRODUCT_QUAD_PX: Corners | null = null

const SCENARIOS: S4Scenario[] = [
  {
    id: 'T6-ekstremna-perspektiva',
    label: 'Zelo močna perspektiva — desni krak vogalnega balkona (Paris), višina 0.12→0.055',
    input: '/home/z/baseline/input/balcony_7.jpg',
    // IZMERJENO po gridu (grid_s4_balcony_7.jpg): ograja pada desno proti kotu —
    // višina ograje se skrči z 0.120 (pri kotu x=0.60) na 0.055 (desni rob x=0.775)
    maskQuad: [[0.595, 0.538], [0.780, 0.578], [0.780, 0.647], [0.595, 0.672]],
    corners: [[0.600, 0.545], [0.775, 0.585], [0.775, 0.640], [0.600, 0.665]],
    note: 'REALNA ekstremna perspektiva (oba robova konvergirata proti izginišču desno); višina 0.12→0.055 = -54 % — prvi poskus s sintetičnim shear kvadrom je bil NErealen (13→5, dokumentirano v poročilu)',
  },
  {
    id: 'T7-svetlo-ozadje',
    label: 'Zelo svetlo sončno belo ozadje + temna kovana ograja (novi kvadrat sega v najsvetlejši pas)',
    input: '/home/z/baseline/input/balcony_4.jpg',
    // grid: novi kvadrat je VIŠJI kot stara ograja — zgornji del meči sončno belo steno
    maskQuad: [[0.180, 0.245], [0.835, 0.245], [0.835, 0.612], [0.180, 0.612]],
    corners: [[0.185, 0.250], [0.830, 0.250], [0.830, 0.605], [0.185, 0.605]],
    note: 'neposredno sonce na belem ometu (skoraj preveč eksponirano) za temnim produktom; kvadrat višji od stare ograje (realna montaža višjega ferforja)',
  },
  {
    id: 'T8-temna-scena',
    label: 'Zelo temna scena — spodnji senčni lok + antracit na antracitu',
    input: '/home/z/baseline/input/balcony_5.jpg',
    // grid: spodnji ukrivljen lok ograje + temno okno + senčna opeka
    maskQuad: [[0.345, 0.515], [0.755, 0.515], [0.755, 0.648], [0.345, 0.648]],
    corners: [[0.350, 0.520], [0.750, 0.520], [0.750, 0.640], [0.350, 0.640]],
    note: 'antracit produkt na najtemnejšem pasu (senčni lok + temno okno za balustri) — dark-product guard (strength 0.6)',
  },
  {
    id: 'T9-zakrit-drevo',
    label: 'Delna zakritost — drevesno deblo sega V kvadrat (occlusion test)',
    input: '/home/z/baseline/input/balcony_6.jpg',
    // grid: 2. nadstropje ograja x 0.26..0.565; deblo x 0.565..0.635 — kvadrat SEGANE V DEBLO
    maskQuad: [[0.255, 0.370], [0.625, 0.370], [0.625, 0.445], [0.255, 0.445]],
    corners: [[0.262, 0.377], [0.618, 0.377], [0.618, 0.438], [0.262, 0.438]],
    note: 'desni rob kvadrata (x>0.565) prekriva deblo — nova ograja bo POBARVANA ČEZ deblo (occlusion kršitev = znana omejitev A-pipeline, izmerjeno spodaj)',
  },
  {
    id: 'T10-ukrivljen-rob',
    label: 'Nepravilen/ukrivljen obstoječi rob — okrasno kovano železo z loki in rastlinami',
    input: '/home/z/baseline/input/balcony_1.jpg',
    // grid: ornat vrhovi loki y≈0.345; dno kamnita polica y≈0.478; rastline čez desni del
    maskQuad: [[0.265, 0.335], [0.670, 0.335], [0.670, 0.480], [0.265, 0.480]],
    corners: [[0.275, 0.362], [0.660, 0.362], [0.660, 0.472], [0.275, 0.472]],
    note: 'ukrivljeni valoviti vrhovi kovanega železa + rastline čez desno polovico; maska pokrije cel ornat',
  },
]

async function maskFromQuad(input: ImageBuffer, quadNorm: Corners): Promise<ImageBuffer> {
  const quadPx = cornerToPx(quadNorm, input.w, input.h)
  const bin = new Uint8Array(input.w * input.h)
  bin.set(fillPolygon(quadPx as Array<[number, number]>, input.w, input.h))
  return { data: rgbaFromBin(bin), w: input.w, h: input.h }
}

async function main() {
  const product = await toRaw(await sharp(path.join(OUT, 'product_bay.jpg')).jpeg().toBuffer())
  const productQuadPx = cornerToPx(PRODUCT_QUAD, product.w, product.h)
  PRODUCT = product
  PRODUCT_QUAD_PX = productQuadPx
  const cut = cutoutProduct(product, productQuadPx)
  const expected = countLetvice(cut.alpha, product.w, product.h, productQuadPx)
  console.log('produkt: bay 460×660 — letvice (rektificirano):', expected)

  const results: Array<Record<string, unknown>> = []
  for (const sc of SCENARIOS) {
    console.log(`\n=== ${sc.id} ===`)
    const t0 = performance.now()
    const original = await toRaw(await sharp(sc.input).jpeg({ quality: 95 }).toBuffer())
    const mask = await maskFromQuad(original, sc.maskQuad)
    // shrani masko za dokumentacijo
    await sharp(Buffer.from(mask.data.buffer, mask.data.byteOffset, mask.data.byteLength), { raw: { width: mask.w, height: mask.h, channels: 4 } }).png().toFile(path.join(OUT, `mask_S4_${sc.id}.png`))

    const cornersPx = cornerToPx(sc.corners, original.w, original.h)
    const res = runPipeline({ original, mask, product, productMask: null, cornersPx, productQuadPx })
    const wallMs = Math.round(performance.now() - t0)

    // ring bleed
    const maskBin = new Uint8Array(mask.w * mask.h)
    for (let i = 0; i < maskBin.length; i++) maskBin[i] = mask.data[i * 4] > 127 ? 1 : 0
    const ring = dilateBinary(maskBin, mask.w, mask.h, 4)
    let ringMaxDiff = 0
    let bleedCount = 0
    for (let i = 0; i < maskBin.length; i++) {
      if (ring[i] && !maskBin[i]) {
        const j = i * 4
        const d = Math.abs(res.preview.data[j] - original.data[j]) + Math.abs(res.preview.data[j + 1] - original.data[j + 1]) + Math.abs(res.preview.data[j + 2] - original.data[j + 2])
        if (d > ringMaxDiff) ringMaxDiff = d
        if (d > 90) bleedCount++
      }
    }

    const annotated = annotate(res.preview, cornersPx)
    await sharp(Buffer.from(annotated.data.buffer, annotated.data.byteOffset, annotated.data.byteLength), { raw: { width: annotated.w, height: annotated.h, channels: 4 } })
      .jpeg({ quality: 90 }).toFile(path.join(OUT, `result_S4_${sc.id}.jpg`))

    const m = res.metrics
    results.push({
      test_id: sc.id,
      label: sc.label,
      input: path.basename(sc.input),
      product: 'product_bay.jpg (fence_0 S+1 bay, 460×660)',
      mask: `mask_S4_${sc.id}.png (poligon iz programsko izrisanega kvadrata — kot monterjev poligon)`,
      placement: { corners: sc.corners, rotation: 0, scale: 1, productQuad: PRODUCT_QUAD },
      expected_slats: EXPECTED_SLATS,
      slat_check_on_product: expected,
      actual_slats: m.letviceResult,
      outside_max_diff: m.outsideMax,
      outside_mean_diff: m.outsideMean,
      outside_max_pre_shadow: m.outsideMaxPreShadow,
      deltaE: m.chroma.dE,
      processing_ms: m.timeMs,
      wall_ms: wallMs,
      black_edge: bleedCount > 0,
      ring_max_diff: ringMaxDiff,
      mask_bleed_detected: m.outsideMaxPreShadow !== 0,
      visual_notes: sc.note,
    })
    console.log(`  letvice ${m.letviceProduct}=${m.letviceResult} | outside max=${m.outsideMax} mean=${m.outsideMean.toFixed(2)} preShadow=${m.outsideMaxPreShadow} | ΔE=${m.chroma.dE.toFixed(2)} | ${m.timeMs}ms | bleed=${bleedCount} ring=${ringMaxDiff}`)
  }

  // ── §9 T5 OCCLUSION — posebni vizualni test (rastline PRED novo ograjo) ──
  console.log('\n=== §9 T5 occlusion analiza (balcony_0, rastline čez ograjo) ===')
  const t5 = await analyzeOcclusion({
    input: '/home/z/baseline/input/balcony_0.jpg',
    maskPath: '/home/z/baseline/mask/mask_b0_railing.png',
    corners: [[0.355, 0.56], [0.885, 0.505], [0.89, 0.76], [0.36, 0.785]],
    // rastline (kaktus + lončnice) prekrivajo LEVI del ograje
    occlusionRegion: [[0.36, 0.55], [0.62, 0.53], [0.62, 0.78], [0.36, 0.79]],
  })
  results.push(t5)
  // T9 occlusion: del kvadrata čez deblo (x 0.567..0.64)
  const t9Occ = await analyzeOcclusion({
    input: '/home/z/baseline/input/balcony_6.jpg',
    maskQuad: [[0.255, 0.370], [0.625, 0.370], [0.625, 0.445], [0.255, 0.445]],
    corners: [[0.262, 0.377], [0.618, 0.377], [0.618, 0.438], [0.262, 0.438]],
    occlusionRegion: [[0.567, 0.36], [0.64, 0.36], [0.64, 0.45], [0.567, 0.45]],
    id: 'T9',
  })
  results.push(t9Occ)

  writeFileSync(path.join(OUT, 'results-s4.json'), JSON.stringify(results, null, 2))
  console.log(`\nRezultati: ${path.join(OUT, 'results-s4.json')}`)
}

/** §9 — occlusion analiza: ali objekt PRED ograjo ostane pred njo? */
async function analyzeOcclusion(opts: {
  input: string
  maskPath?: string
  maskQuad?: Corners
  corners: Corners
  occlusionRegion: Corners
  id?: string
}) {
  const original = await toRaw(await sharp(opts.input).jpeg({ quality: 95 }).toBuffer())
  let mask: ImageBuffer
  if (opts.maskPath) {
    const maskRaw = await toRaw(await sharp(opts.maskPath).toBuffer())
    const bin = new Uint8Array(maskRaw.w * maskRaw.h)
    for (let i = 0; i < bin.length; i++) bin[i] = maskRaw.data[i * 4] > 127 ? 1 : 0
    mask = { data: rgbaFromBin(bin), w: maskRaw.w, h: maskRaw.h }
  } else {
    mask = await maskFromQuad(original, opts.maskQuad!)
  }
  const cornersPx = cornerToPx(opts.corners, original.w, original.h)
  const res = runPipeline({ original, mask, product: PRODUCT!, productMask: null, cornersPx, productQuadPx: PRODUCT_QUAD_PX! })

  // Occlusion regija: koliko pikslov se je spremenilo (rastlina/дебlo bi morala
  // ostati — če je spremenjena, je nova ograja POBARVANA ČEZ objekt).
  const occPx = cornerToPx(opts.occlusionRegion, original.w, original.h)
  const occBin = fillPolygon(occPx as Array<[number, number]>, original.w, original.h)
  let total = 0
  let changed = 0
  let maxDiff = 0
  for (let i = 0; i < occBin.length; i++) {
    if (!occBin[i]) continue
    total++
    const j = i * 4
    const d = Math.abs(res.preview.data[j] - original.data[j]) + Math.abs(res.preview.data[j + 1] - original.data[j + 1]) + Math.abs(res.preview.data[j + 2] - original.data[j + 2])
    if (d > 12) changed++
    if (d > maxDiff) maxDiff = d
  }
  const changedPct = total > 0 ? Math.round((changed / total) * 100) : 0

  // side-by-side dokaz: original | rezultat (crop occlusion regije + margina)
  const pad = 0.01
  const cropX = Math.round((Math.min(...occPx.map((p) => p[0])) - pad * original.w))
  const cropY = Math.round(Math.max(0, Math.min(...occPx.map((p) => p[1])) - pad * original.h))
  const cropW = Math.round((Math.max(...occPx.map((p) => p[0])) - Math.min(...occPx.map((p) => p[0]))) + 2 * pad * original.w)
  const cropH = Math.round((Math.max(...occPx.map((p) => p[1])) - Math.min(...occPx.map((p) => p[1]))) + 2 * pad * original.h)
  const clip = { left: Math.max(0, cropX), top: Math.max(0, cropY), width: Math.min(cropW, original.w - Math.max(0, cropX)), height: Math.min(cropH, original.h - Math.max(0, cropY)) }
  const origJpg = await sharp(Buffer.from(original.data.buffer, original.data.byteOffset, original.data.byteLength), { raw: { width: original.w, height: original.h, channels: 4 } }).extract(clip).png().toBuffer()
  const resJpg = await sharp(Buffer.from(res.preview.data.buffer, res.preview.data.byteOffset, res.preview.data.byteLength), { raw: { width: res.preview.w, height: res.preview.h, channels: 4 } }).extract(clip).png().toBuffer()
  const outW = clip.width
  const outH = clip.height
  const labelBar = 34
  const labelSvg = Buffer.from(`<svg width="${outW * 2 + 20}" height="${labelBar}"><rect width="100%" height="100%" fill="#111"/><text x="8" y="23" fill="#fff" font-size="18" font-family="sans-serif">ORIGINAL (rastlina/deblo PRED ograjo)</text><text x="${outW + 28}" y="23" fill="#fff" font-size="18" font-family="sans-serif">POTEM (A-pipeline)</text></svg>`)
  await sharp({ create: { width: outW * 2 + 20, height: outH + labelBar, channels: 3, background: '#111' } })
    .composite([
      { input: labelSvg, top: 0, left: 0 },
      { input: origJpg, top: labelBar, left: 0 },
      { input: resJpg, top: labelBar, left: outW + 20 },
    ])
    .jpeg({ quality: 90 })
    .toFile(path.join(OUT, `s4_occlusion_${opts.id ?? 'T5'}.jpg`))

  console.log(`  occlusion regija: ${total} px, spremenjenih ${changed} (${changedPct} %), maxDiff=${maxDiff}`)
  return {
    test_id: `occlusion-${opts.id ?? 'T5'}`,
    input: path.basename(opts.input),
    occlusion_region_px: total,
    changed_px: changed,
    changed_pct: changedPct,
    max_diff: maxDiff,
    interpretation: changedPct > 20
      ? 'ZNANA OMEJITEV POTRJENA: objekt pred ograjo je prebarvan z novo ograjo (stolpična sinteza ne loči plasti pred maske)'
      : 'objekt pred ograjo je večinoma ohranjen',
    evidence_image: `s4_occlusion_${opts.id ?? 'T5'}.jpg`,
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
