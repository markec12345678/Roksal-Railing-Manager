/**
 * R118 — MEASUREMENT SDK REAL-WORLD VALIDATION HARNESS
 * ---------------------------------------------------------------------------
 * Namen: validacija merilnega SDK na 10 zahtevnih terenskih scenarijih.
 *
 * POMEMBNO (iskrenost orodja): scenariji so SINTETIČNE slike, ki modelirajo
 * znane terenske razmere (raven balkon, L/U, perspektiva, zakritost, temna/
 * svetla ograja, manjkajoče/napačno merilo, slaba svetloba). To NI nadomestilo
 * za benchmark na pravih fotografijah — je pa ponovljiv, determinističen
 * regresijski SIGNAL: vsak push lahko dokazati, da se SDK vedenje na teh
 * primerih ni poslabšalo. Prave fotografije ostajajo manual acceptance (R118
 * full pass) — glej docs/MEASUREMENT-QUALITY.md.
 *
 * Zagon: bun run bench:measurement   (ali: bun tools/measurement-benchmark.ts)
 * Izhod: tabela PASS/FAIL/INFO + exit code 1, če kateri HARD primer pade.
 *
 * HARD  = pričakovano vedenje je ZAKON (kršitev = regresija, exit 1)
 * INFO  = opazovanje (kvalitativni signal, ne blokira)
 *
 * Ni AI, ni mreže, ni naključja (šum generira deterministični LCG).
 */
import { detectFeatures, buildSession, MEASUREMENT_CONSTANTS } from '../src/lib/measurement/index'
import type { ScaleReference, MeasurementQualityState } from '../src/lib/measurement/types'
import type { ImageBuffer } from '../src/lib/viz/types'

// ── Sintetična slika ─────────────────────────────────────────────────────────

type RGB = [number, number, number]

function fillRect(img: ImageBuffer, x0: number, y0: number, x1: number, y1: number, rgb: RGB) {
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(img.h, Math.ceil(y1)); y++) {
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(img.w, Math.ceil(x1)); x++) {
      const p = (y * img.w + x) * 4
      img.data[p] = rgb[0]
      img.data[p + 1] = rgb[1]
      img.data[p + 2] = rgb[2]
      img.data[p + 3] = 255
    }
  }
}

interface BalconyOpts {
  w?: number
  h?: number
  yTop?: number
  yBottom?: number
  x0?: number
  x1?: number
  postCount?: number
  bg?: RGB
  rail?: RGB
  /** delna zakritost: [od, do] delež širine pasu, prekrit z ozadjem */
  occlude?: [number, number]
  /** deterministični šum: intenziteta ±N na kanal (LCG, ne Math.random) */
  noise?: number
}

function syntheticBalcony(opts: BalconyOpts = {}): ImageBuffer {
  const w = opts.w ?? 960
  const h = opts.h ?? 640
  const yTop = opts.yTop ?? 0.3
  const yBottom = opts.yBottom ?? 0.62
  const x0 = opts.x0 ?? 0.1
  const x1 = opts.x1 ?? 0.9
  const postCount = opts.postCount ?? 5
  const bg = opts.bg ?? [215, 218, 222]
  const rail = opts.rail ?? [35, 38, 42]
  const img: ImageBuffer = { data: new Uint8ClampedArray(w * h * 4), w, h }
  fillRect(img, 0, 0, w, h, bg)
  const tPx = 4
  fillRect(img, x0 * w, yTop * h - tPx, x1 * w, yTop * h + tPx, rail)
  fillRect(img, x0 * w, yBottom * h - tPx, x1 * w, yBottom * h + tPx, rail)
  for (let i = 0; i < postCount; i++) {
    const x = x0 + ((i + 1) * (x1 - x0)) / (postCount + 1)
    fillRect(img, x * w - 3, yTop * h, x * w + 3, yBottom * h, rail)
  }
  if (opts.occlude) {
    const [oa, ob] = opts.occlude
    fillRect(img, (x0 + (x1 - x0) * oa) * w, yTop * h - tPx, (x0 + (x1 - x0) * ob) * w, yBottom * h + tPx, bg)
  }
  if (opts.noise) {
    // LCG (determinističen): seed 42, numerična repeatabilitost
    let s = 42
    for (let i = 0; i < img.data.length; i++) {
      s = (s * 1664525 + 1013904223) >>> 0
      img.data[i] = Math.max(0, Math.min(255, img.data[i] + ((s % (2 * opts.noise + 1)) - opts.noise)))
    }
  }
  return img
}

/** Perspektiva: zgornja linija je ozka, spodnja široka (trapez) + nagnjeni stebri. */
function syntheticPerspective(): ImageBuffer {
  const w = 960
  const h = 640
  const img: ImageBuffer = { data: new Uint8ClampedArray(w * h * 4), w, h }
  fillRect(img, 0, 0, w, h, [215, 218, 222])
  const dark: RGB = [35, 38, 42]
  const yTop = 0.28
  const yBottom = 0.62
  const tTop: [number, number] = [0.3, 0.7] // ozko zgoraj
  const tBottom: [number, number] = [0.08, 0.92] // široko spodaj
  const tPx = 4
  fillRect(img, tTop[0] * w, yTop * h - tPx, tTop[1] * w, yTop * h + tPx, dark)
  fillRect(img, tBottom[0] * w, yBottom * h - tPx, tBottom[1] * w, yBottom * h + tPx, dark)
  const postCount = 5
  for (let i = 0; i < postCount; i++) {
    const f = (i + 1) / (postCount + 1)
    const xT = (tTop[0] + (tTop[1] - tTop[0]) * f) * w
    const xB = (tBottom[0] + (tBottom[1] - tBottom[0]) * f) * w
    // nagnjen steber: poveži xT in xB z zaporedjem tankih pravokotnikov
    for (let y = Math.round(yTop * h); y <= Math.round(yBottom * h); y++) {
      const t = (y - yTop * h) / ((yBottom - yTop) * h)
      const x = xT + (xB - xT) * t
      fillRect(img, x - 3, y, x + 3, y + 1, dark)
    }
  }
  return img
}

/** Ročna (uporabniška) pot — L ali U balkon, točke v normaliziranem prostoru. */
function manualSession(shape: 'L' | 'U', ref: ScaleReference) {
  if (shape === 'L') {
    return buildSession({
      sessionId: 'bench-l',
      source: 'manual',
      detected: null,
      manual: {
        path: [
          { x: 0.05, y: 0.7 }, { x: 0.45, y: 0.7 }, { x: 0.45, y: 0.45 }, { x: 0.95, y: 0.45 },
        ],
        top: [
          { x: 0.05, y: 0.2 }, { x: 0.45, y: 0.2 }, { x: 0.45, y: 0.1 }, { x: 0.95, y: 0.1 },
        ],
      },
      reference: ref,
    })
  }
  return buildSession({
    sessionId: 'bench-u',
    source: 'manual',
    detected: null,
    manual: {
      path: [
        { x: 0.05, y: 0.7 }, { x: 0.2, y: 0.7 }, { x: 0.2, y: 0.35 }, { x: 0.8, y: 0.35 }, { x: 0.8, y: 0.7 }, { x: 0.95, y: 0.7 },
      ],
      top: [
        { x: 0.05, y: 0.2 }, { x: 0.2, y: 0.2 }, { x: 0.2, y: 0.1 }, { x: 0.8, y: 0.1 }, { x: 0.8, y: 0.2 }, { x: 0.95, y: 0.2 },
      ],
    },
    reference: ref,
  })
}

const REF: ScaleReference = {
  p1: { x: 0.0, y: 0.8 },
  p2: { x: 1.0, y: 0.8 },
  knownMm: 5000,
  kind: 'user-known-measure',
}

// ── Primeri ──────────────────────────────────────────────────────────────────

type Verdict = 'PASS' | 'FAIL' | 'INFO'

interface Case {
  id: string
  label: string
  kind: 'HARD' | 'INFO'
  /** izvede primer in vrne { state, geometry, note } */
  run: () => { state: MeasurementQualityState; geometry: unknown; note?: string }
  expect: (r: { state: MeasurementQualityState; geometry: unknown }) => string | null
}

function autoState(image: ImageBuffer, reference: ScaleReference | null, note?: string) {
  const { features, metrics } = detectFeatures({ frames: [image] })
  const session = buildSession({
    sessionId: 'bench-auto',
    source: 'automatic',
    detected: features ? { features, metrics } : null,
    reference,
  })
  return { state: session.quality.state, geometry: session.geometry, note }
}

const cases: Case[] = [
  {
    id: 'S1',
    label: 'raven balkon (baseline, merilo 5000 mm)',
    kind: 'HARD',
    run: () => autoState(syntheticBalcony(), REF),
    expect: (r) => {
      if (r.state !== 'MEASUREMENT_READY' && r.state !== 'VERIFIED') return `pričakovano MEASUREMENT_READY, dobil ${r.state}`
      const g = r.geometry as { totalLengthMm: { valueMm: number } } | null
      if (!g) return 'geometrija manjka'
      // 0.1..0.9 slike × 5000 mm = 4000 mm (± 2 %)
      if (Math.abs(g.totalLengthMm.valueMm - 4000) > 80) return `dolžina ${g.totalLengthMm.valueMm} mm izven 4000±80`
      return null
    },
  },
  {
    id: 'S2',
    label: 'L-balkon (ročni način, 3 segmenti)',
    kind: 'HARD',
    run: () => {
      const s = manualSession('L', REF)
      return { state: s.quality.state, geometry: s.geometry }
    },
    expect: (r) => {
      const g = r.geometry as { segments: unknown[] } | null
      if (r.state !== 'MEASUREMENT_READY') return `pričakovano MEASUREMENT_READY, dobil ${r.state}`
      if (!g || g.segments.length !== 3) return `pričakovano 3 segmentov, dobil ${g?.segments.length ?? 0}`
      return null
    },
  },
  {
    id: 'S3',
    label: 'U-balkon (ročni način, 5 segmentov)',
    kind: 'HARD',
    run: () => {
      const s = manualSession('U', REF)
      return { state: s.quality.state, geometry: s.geometry }
    },
    expect: (r) => {
      const g = r.geometry as { segments: unknown[] } | null
      if (r.state !== 'MEASUREMENT_READY') return `pričakovano MEASUREMENT_READY, dobil ${r.state}`
      if (!g || g.segments.length !== 5) return `pričakovano 5 segmentov, dobil ${g?.segments.length ?? 0}`
      return null
    },
  },
  {
    id: 'S4',
    label: 'perspektiva (trapez — fronto-parallel omejitev v1)',
    kind: 'INFO',
    run: () => autoState(syntheticPerspective(), REF),
    expect: () => null, // poročamo dolžino in znano pristranost v1
  },
  {
    id: 'S5',
    label: 'delno zakrita ograja (10 % vrzel v pasu)',
    kind: 'HARD',
    run: () => autoState(syntheticBalcony({ occlude: [0.45, 0.55] }), REF),
    expect: (r) => {
      // maxLineGapFraction = 0.12 → 10 % vrzel je ŠE VEDNO veljavna linija
      if (r.state !== 'MEASUREMENT_READY') return `pričakovano MEASUREMENT_READY (vrzel < 12 %), dobil ${r.state}`
      return null
    },
  },
  {
    id: 'S6',
    label: 'delno zakrita ograja (20 % vrzel — čez prag 12 %)',
    kind: 'INFO',
    run: () => autoState(syntheticBalcony({ occlude: [0.4, 0.6] }), REF),
    expect: (r) => {
      // ZNANA v1 OMEJITEV (dokumentirana v MEASUREMENT-QUALITY.md): vrzel čez
      // prag razbije glavni run — detekcija lahko grabi le vidni del in vrne
      // KRATŠO meritev, ki IZGLEDA veljavna. Terenski protokol: pri delni
      // zakritosti vedno uporabi ročni način (fail-safe). INFO dokaz trdnosti
      // signala; popolna fix (multi-run merge) = issue #2 faza 2.
      const g = r.geometry as { totalLengthMm?: { valueMm: number } } | null
      if (g?.totalLengthMm && g.totalLengthMm.valueMm < 3000) {
        return `ZNANA OMEJITEV: dolžina ${g.totalLengthMm.valueMm.toFixed(0)} mm je podrezana (grabi le vidni run) — terensko: ročni način`
      }
      return null
    },
  },
  {
    id: 'S7',
    label: 'temna ograja (nizek kontrast: temno na temnem)',
    kind: 'INFO',
    run: () => autoState(syntheticBalcony({ bg: [40, 42, 45], rail: [24, 26, 29] }), REF),
    expect: () => null,
  },
  {
    id: 'S8',
    label: 'svetla ograja (nizek kontrast — sintetika)',
    kind: 'INFO',
    run: () => autoState(syntheticBalcony({ bg: [242, 242, 242], rail: [236, 236, 236] }), REF),
    expect: (r) => {
      // Iskreno: sintetičen nizek kontrast ima še VEDNO strukturo in Otsu/Sobel
      // jo najde (kontrast 6/255 → detekcija uspe). To NI washout prave kamere
      // (zabrisani robovi). Zato INFO, ne HARD zakon — prave fotografije so
      // manual acceptance (R118 full pass).
      if (r.geometry === null && r.state === 'INSUFFICIENT_DATA') return 'zaznava zavrnjena (konservativno)'
      return null
    },
  },
  {
    id: 'S9',
    label: 'brez merila (uporabnik ni vnesel reference)',
    kind: 'HARD',
    run: () => autoState(syntheticBalcony(), null),
    expect: (r) => {
      if (r.state !== 'SCALE_REQUIRED') return `pričakovano SCALE_REQUIRED, dobil ${r.state}`
      if (r.geometry !== null) return 'ZAKON kršen: geometrija brez merila!'
      return null
    },
  },
  {
    id: 'S10',
    label: 'napačna referenca (premalo točk: < 2 % slike)',
    kind: 'HARD',
    run: () => autoState(syntheticBalcony(), { p1: { x: 0.5, y: 0.5 }, p2: { x: 0.505, y: 0.5 }, knownMm: 5000, kind: 'user-known-measure' }),
    expect: (r) => {
      if (r.geometry !== null) return 'ZAKON kršen: merilo sprejeto iz neveljavne reference'
      if (r.state !== 'SCALE_REQUIRED') return `pričakovano SCALE_REQUIRED, dobil ${r.state}`
      return null
    },
  },
  {
    id: 'S11',
    label: 'slaba svetloba (močan deterministični šum)',
    kind: 'INFO',
    run: () => autoState(syntheticBalcony({ noise: 40 }), REF),
    expect: () => null,
  },
  {
    id: 'S12',
    label: 'brez ograje (prazna slika)',
    kind: 'HARD',
    run: () => autoState(syntheticBalcony({ rail: [215, 218, 222] }), REF),
    expect: (r) => {
      if (r.state !== 'INSUFFICIENT_DATA') return `pričakovano INSUFFICIENT_DATA, dobil ${r.state}`
      return null
    },
  },
]

// ── Izvedba ──────────────────────────────────────────────────────────────────

function main(): number {
  console.log('R118 — Measurement SDK benchmark (sintetični terenski scenariji, SDK brez AI)\n')
  console.log(`konstante: workMaxDim=${MEASUREMENT_CONSTANTS.workMaxDim}, minLineCoverage=${MEASUREMENT_CONSTANTS.minLineCoverage}, maxLineGapFraction=${MEASUREMENT_CONSTANTS.maxLineGapFraction}\n`)

  let hardFails = 0
  const rows: string[] = []

  for (const c of cases) {
    let verdict: Verdict = 'PASS'
    let detail = ''
    try {
      const r = c.run()
      const err = c.expect(r)
      if (err) {
        verdict = c.kind === 'HARD' ? 'FAIL' : 'INFO'
        detail = err
      } else {
        const g = r.geometry as { totalLengthMm?: { valueMm: number }; segments?: unknown[] } | null
        const parts = [`stanje=${r.state}`]
        if (g?.totalLengthMm) parts.push(`dolžina=${g.totalLengthMm.valueMm.toFixed(0)} mm`)
        if (g?.segments) parts.push(`segmenti=${g.segments.length}`)
        if (r.note) parts.push(r.note)
        detail = parts.join(', ')
      }
    } catch (e) {
      verdict = c.kind === 'HARD' ? 'FAIL' : 'INFO'
      detail = `izjema: ${e instanceof Error ? e.message : String(e)}`
    }
    if (verdict === 'FAIL') hardFails++
    rows.push(`${verdict.padEnd(5)} [${c.kind}] ${c.id} ${c.label} — ${detail}`)
  }

  console.log(rows.join('\n'))
  console.log(`\nSkupaj: ${cases.length} primerov, HARD neuspehi: ${hardFails}`)
  if (hardFails > 0) {
    console.log('\n⚠️  REGRESIJA: zakonska pričakovanja so kršena — merilni SDK se je spremenil na zahtevnih primerih.')
    return 1
  }
  console.log('\n✓ Vsi HARD primeri zeleni. INFO primeri so kvalitativni signal (perspektiva/šum/tema = znane v1 omejitve).')
  return 0
}

process.exit(main())
