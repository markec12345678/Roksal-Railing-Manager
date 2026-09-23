/**
 * S+4 — PRODUKCIJSKI TESTI: T6–T10 skozi pravi API (Vercel + Blob) +
 * §10 performance (≥20 meritev per endpoint: stage/preview/save/list/open,
 * percentili p50/p90/p95/max).
 *
 * Uporaba: bun tools/s4-prod-tests.ts
 * Izhod:   tmp/scenarios/results-s4-prod.json + perf-s4-prod.json
 */
import { writeFileSync } from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE ?? 'https://roksal-railing-manager.vercel.app'
const OUT = path.join(__dirname, '..', 'tmp', 'scenarios')

// T6–T10 (isti kvadri kot tools/real-scenarios-s4.ts — izmerjeno po gridu)
const SCENARIOS = [
  { id: 'T6-ekstremna-perspektiva', input: '/home/z/baseline/input/balcony_7.jpg', maskQuad: [[0.595, 0.538], [0.780, 0.578], [0.780, 0.647], [0.595, 0.672]], corners: [[0.600, 0.545], [0.775, 0.585], [0.775, 0.640], [0.600, 0.665]] },
  { id: 'T7-svetlo-ozadje', input: '/home/z/baseline/input/balcony_4.jpg', maskQuad: [[0.180, 0.245], [0.835, 0.245], [0.835, 0.612], [0.180, 0.612]], corners: [[0.185, 0.250], [0.830, 0.250], [0.830, 0.605], [0.185, 0.605]] },
  { id: 'T8-temna-scena', input: '/home/z/baseline/input/balcony_5.jpg', maskQuad: [[0.345, 0.515], [0.755, 0.515], [0.755, 0.648], [0.345, 0.648]], corners: [[0.350, 0.520], [0.750, 0.520], [0.750, 0.640], [0.350, 0.640]] },
  { id: 'T9-zakrit-drevo', input: '/home/z/baseline/input/balcony_6.jpg', maskQuad: [[0.255, 0.370], [0.625, 0.370], [0.625, 0.445], [0.255, 0.445]], corners: [[0.262, 0.377], [0.618, 0.377], [0.618, 0.438], [0.262, 0.438]] },
  { id: 'T10-ukrivljen-rob', input: '/home/z/baseline/input/balcony_1.jpg', maskQuad: [[0.265, 0.335], [0.670, 0.335], [0.670, 0.480], [0.265, 0.480]], corners: [[0.275, 0.362], [0.660, 0.362], [0.660, 0.472], [0.275, 0.472]] },
]

const latencies: Record<string, number[]> = { stage: [], preview: [], save: [], list: [], open: [] }
const savedIds: string[] = []

async function timed<T>(kind: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now()
  const out = await fn()
  latencies[kind].push(Math.round(performance.now() - t0))
  return out
}

async function api(p: string, init: RequestInit & { cookie?: string } = {}) {
  return fetch(`${BASE}${p}`, {
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
      ...(init.cookie ? { cookie: init.cookie } : {}),
    },
  })
}

async function stage(cookie: string, file: string, kind: string) {
  const buf = await (await import('node:fs/promises')).readFile(file)
  const fd = new FormData()
  fd.append('file', new Blob([new Uint8Array(buf)]), 'photo.jpg')
  fd.append('kind', kind)
  const res = await timed('stage', () => api('/api/viz/stage', { method: 'POST', body: fd, cookie }))
  if (!res.ok) throw new Error(`stage ${kind} → ${res.status}`)
  return (await res.json()) as { token: string; w: number; h: number }
}

async function makeMaskPng(input: string, quadNorm: number[][]): Promise<Buffer> {
  const sharp = (await import('sharp')).default
  const { data, info } = await sharp(input).raw().toBuffer({ resolveWithObject: true })
  const w = info.width
  const h = info.height
  // poligon fill (scanline po ravnih robovih kvadra — zadostno za grid kvadre)
  const px = quadNorm.map(([x, y]) => [Math.round(x * w), Math.round(y * h)] as [number, number])
  const out = Buffer.alloc(w * h, 0)
  for (let y = 0; y < h; y++) {
    const xs: number[] = []
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = px[i]
      const [x2, y2] = px[(i + 1) % 4]
      if ((y1 <= y && y < y2) || (y2 <= y && y < y1)) {
        xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1))
      }
    }
    xs.sort((a, b) => a - b)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) out[y * w + x] = 255
    }
  }
  return sharp(out, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer()
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[Math.max(0, idx)]
}

async function main() {
  // login (demo)
  const login = await fetch(`${BASE}/api/auth/demo`, { method: 'POST' })
  const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0]
  if (!cookie.startsWith('roksal_session=')) throw new Error('demo login failed')
  console.log('login OK')

  const results: Array<Record<string, unknown>> = []
  let lastTokens: { b: string; p: string; m: string } | null = null

  for (const sc of SCENARIOS) {
    console.log(`\n=== ${sc.id} (produkcija) ===`)
    const b = await stage(cookie, sc.input, 'balcony')
    const p = await stage(cookie, path.join(OUT, 'product_bay.jpg'), 'product')
    lastTokens = { b: b.token, p: p.token, m: '' }

    // maska: programsko izrisan poligon (kot monterjev) → stage kot PNG
    const maskPng = await makeMaskPng(sc.input, sc.maskQuad)
    const fd = new FormData()
    fd.append('file', new Blob([new Uint8Array(maskPng)], { type: 'image/png' }), 'mask.png')
    fd.append('kind', 'mask')
    const mres = await timed('stage', () => api('/api/viz/stage', { method: 'POST', body: fd, cookie }))
    if (!mres.ok) throw new Error(`stage mask → ${mres.status}`)
    const maskTok = ((await mres.json()) as { token: string }).token

    const placement = { version: 2, corners: sc.corners, rotation: 0, scale: 1, productQuad: [[0, 80 / 660], [460 / 460, 18 / 660], [460 / 460, 638 / 660], [0, 600 / 660]] }
    const t0 = performance.now()
    const preview = await timed('preview', () =>
      api('/api/viz/preview', { method: 'POST', cookie, body: JSON.stringify({ originalToken: b.token, productToken: p.token, productMaskToken: null, maskToken: maskTok, placement }) })
    )
    if (!preview.ok) throw new Error(`preview → ${preview.status}: ${await preview.text()}`)
    const pj = (await preview.json()) as { metrics: Record<string, number | { dE: number }>; previewUrl: string }
    const mm = pj.metrics as { letviceProduct: number; letviceResult: number; outsideMax: number; outsideMean: number; timeMs: number; chroma: { dE: number }; outsideMaxPreShadow?: number }

    // save
    const stamp = Date.now()
    const save = await timed('save', () =>
      api('/api/viz/projects', { method: 'POST', cookie, body: JSON.stringify({ name: `S4 ${sc.id} ${stamp}`, stagingToken: b.token, productToken: p.token, maskToken: maskTok, idempotencyKey: `s4-prod-${sc.id}-${stamp}` }) })
    )
    const sj = (await save.json()) as { projectId: string }
    savedIds.push(sj.projectId)

    results.push({
      test_id: sc.id,
      stage_balcony_ms: latencies.stage.at(-3),
      stage_product_ms: latencies.stage.at(-2),
      stage_mask_ms: latencies.stage.at(-1),
      preview_request_ms: latencies.preview.at(-1),
      pipeline_ms: mm.timeMs,
      letvice: `${mm.letviceProduct}=${mm.letviceResult}`,
      outside_max_diff: mm.outsideMax,
      outside_mean_diff: mm.outsideMean,
      deltaE: mm.chroma.dE,
      project_id: sj.projectId,
      mask_bleed_detected: (mm.outsideMaxPreShadow ?? 0) !== 0,
    })
    console.log(`  letvice ${mm.letviceProduct}=${mm.letviceResult} | ΔE=${mm.chroma.dE} | pipeline ${mm.timeMs}ms | save→${sj.projectId.slice(0, 8)}`)
  }

  // ── §10: dodatne meritve do ≥20 per endpoint ─────────────────────────────
  console.log('\n=== §10 dodatne meritve (do ≥20/endpoint) ===')
  // stage ×5 (extra, različne slike)
  const extra = ['/home/z/baseline/input/balcony_2.jpg', '/home/z/baseline/input/balcony_0.jpg', '/home/z/baseline/input/fence_0.jpg', '/home/z/baseline/input/balcony_3.png', '/home/z/baseline/input/balcony_4.jpg']
  for (const f of extra) await stage(cookie, f, 'balcony')

  // svež set za ponovitvene preview ×15 (STAGING porabijo šele save-i)
  const pb = await stage(cookie, '/home/z/baseline/input/balcony_3.png', 'balcony')
  const pp = await stage(cookie, path.join(OUT, 'product_bay.jpg'), 'product')
  const maskPng3 = await makeMaskPng('/home/z/baseline/input/balcony_3.png', [[0.232, 0.44], [0.935, 0.29], [0.93, 0.71], [0.235, 0.72]])
  const fd3 = new FormData()
  fd3.append('file', new Blob([new Uint8Array(maskPng3)], { type: 'image/png' }), 'mask.png')
  fd3.append('kind', 'mask')
  const pm = await timed('stage', () => api('/api/viz/stage', { method: 'POST', body: fd3, cookie }))
  const pmTok = ((await pm.json()) as { token: string }).token
  const placement = { version: 2, corners: [[0.232, 0.451], [0.933, 0.294], [0.929, 0.652], [0.232, 0.709]], rotation: 0, scale: 1, productQuad: [[0, 80 / 660], [460 / 460, 18 / 660], [460 / 460, 638 / 660], [0, 600 / 660]] }
  // preview ×15 (isti staging — ponovljiv tok, meri variabilnost server pipeline)
  for (let i = 0; i < 15; i++) {
    const r = await timed('preview', () => api('/api/viz/preview', { method: 'POST', cookie, body: JSON.stringify({ originalToken: pb.token, productToken: pp.token, productMaskToken: null, maskToken: pmTok, placement }) }))
    if (!r.ok) throw new Error(`preview repeat ${i} → ${r.status}`)
  }
  // save ×15 — VSAK potrebuje svež staging + preview (save zahteva result.json)
  for (let i = 0; i < 15; i++) {
    const sb = await stage(cookie, '/home/z/baseline/input/balcony_3.png', 'balcony')
    const sp = await stage(cookie, path.join(OUT, 'product_bay.jpg'), 'product')
    const sm = await stage(cookie, '/home/z/baseline/input/balcony_3.png', 'mask')
    const pv = await timed('preview', () => api('/api/viz/preview', { method: 'POST', cookie, body: JSON.stringify({ originalToken: sb.token, productToken: sp.token, productMaskToken: null, maskToken: sm.token, placement }) }))
    if (!pv.ok) throw new Error(`perf preview ${i} → ${pv.status}`)
    const stamp = `${Date.now()}-${i}`
    const res = await timed('save', () => api('/api/viz/projects', { method: 'POST', cookie, body: JSON.stringify({ name: `S4 perf ${stamp}`, stagingToken: sb.token, productToken: sp.token, maskToken: sm.token, idempotencyKey: `s4-perf-${stamp}` }) }))
    if (res.ok) savedIds.push(((await res.json()) as { projectId: string }).projectId)
  }
  // list ×20 + open ×20
  for (let i = 0; i < 20; i++) {
    await timed('list', () => api('/api/viz/projects', { cookie }))
  }
  for (const id of savedIds.slice(0, 20)) {
    const r = await timed('open', () => api(`/api/viz/projects/${id}`, { cookie }))
    if (!r.ok) throw new Error(`open ${id} → ${r.status}`)
  }

  // ── cleanup: pobriši vse perf projekte ────────────────────────────────────
  for (const id of savedIds) {
    await api(`/api/viz/projects/${id}`, { method: 'DELETE', cookie })
  }
  console.log(`cleanup: ${savedIds.length} projektov pobrisanih`)

  // ── percentili ────────────────────────────────────────────────────────────
  const perf: Record<string, { n: number; p50: number; p90: number; p95: number; max: number }> = {}
  for (const [kind, xs] of Object.entries(latencies)) {
    const s = [...xs].sort((a, b) => a - b)
    perf[kind] = { n: s.length, p50: percentile(s, 50), p90: percentile(s, 90), p95: percentile(s, 95), max: s[s.length - 1] ?? 0 }
    console.log(`${kind.padEnd(8)} n=${s.length}  p50=${perf[kind].p50}ms  p90=${perf[kind].p90}ms  p95=${perf[kind].p95}ms  max=${perf[kind].max}ms`)
  }

  writeFileSync(path.join(OUT, 'results-s4-prod.json'), JSON.stringify(results, null, 2))
  writeFileSync(path.join(OUT, 'perf-s4-prod.json'), JSON.stringify(perf, null, 2))
  console.log(`\nRezultati: ${OUT}/results-s4-prod.json + perf-s4-prod.json`)
}

main().catch((e) => { console.error(e); process.exit(1) })
