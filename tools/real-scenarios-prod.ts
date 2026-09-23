/**
 * S+3 — 5 realnih scenarijev skozi PRODUKCIJSKI API (Vercel + Blob).
 * Meri: stage/preview latenco na produkciji + metrike iz result.json.
 * Uporaba: BASE=https://roksal-railing-manager.vercel.app COOKIE=... bun tools/real-scenarios-prod.ts
 */
import { writeFileSync } from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE ?? 'https://roksal-railing-manager.vercel.app'
const COOKIE = process.env.COOKIE ?? ''
const OUT = path.join(__dirname, '..', 'tmp', 'scenarios', 'results-prod.json')

const BAY = 'tmp/scenarios/product_bay.jpg'

const SCENARIOS = [
  { id: 'T1-ravna', input: '/home/z/baseline/input/balcony_3.png', mask: '/home/z/baseline/mask/mask_C_old_fence.png', corners: [[238/1024,462/1024],[956/1024,302/1024],[952/1024,668/1024],[238/1024,726/1024]] },
  { id: 'T2-perspektiva', input: '/home/z/baseline/input/balcony_2.jpg', mask: '/home/z/baseline/mask/mask_b2_middle.png', corners: [[0.347,0.588],[0.612,0.58],[0.614,0.748],[0.349,0.756]] },
  { id: 'T3-sonce', input: '/home/z/baseline/input/balcony_4.jpg', mask: '/home/z/baseline/mask/mask_b4_sun.png', corners: [[0.205,0.372],[0.823,0.356],[0.828,0.592],[0.21,0.607]] },
  { id: 'T4-temna', input: '/home/z/baseline/input/balcony_5.jpg', mask: '/home/z/baseline/mask/mask_b5_dark.png', corners: [[0.115,0.235],[0.885,0.225],[0.88,0.76],[0.12,0.77]] },
  { id: 'T5-zakrit', input: '/home/z/baseline/input/balcony_0.jpg', mask: '/home/z/baseline/mask/mask_b0_railing.png', corners: [[0.355,0.56],[0.885,0.505],[0.89,0.76],[0.36,0.785]] },
]

const PRODUCT_QUAD = [[0, 80 / 660], [460 / 460, 18 / 660], [460 / 460, 638 / 660], [0, 600 / 660]]

async function stage(file: string, kind: string): Promise<{ token: string }> {
  const fd = new FormData()
  const buf = await (await import('node:fs/promises')).readFile(file)
  fd.append('file', new Blob([new Uint8Array(buf)]), path.basename(file))
  fd.append('kind', kind)
  const t0 = performance.now()
  const res = await fetch(`${BASE}/api/viz/stage`, { method: 'POST', body: fd, headers: { cookie: COOKIE } })
  const ms = Math.round(performance.now() - t0)
  if (!res.ok) throw new Error(`stage ${kind} ${res.status}: ${await res.text()}`)
  const json = (await res.json()) as { token: string }
  console.log(`  stage ${kind}: ${ms}ms`)
  return json
}

async function main() {
  const results: Array<Record<string, unknown>> = []
  for (const sc of SCENARIOS) {
    console.log(`\n=== ${sc.id} ===`)
    const b = await stage(sc.input, 'balcony')
    const p = await stage(BAY, 'product')
    const m = await stage(sc.mask, 'mask')

    const placement = { version: 2, corners: sc.corners, rotation: 0, scale: 1, productQuad: PRODUCT_QUAD }
    const t0 = performance.now()
    const res = await fetch(`${BASE}/api/viz/preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: COOKIE },
      body: JSON.stringify({ originalToken: b.token, productToken: p.token, productMaskToken: null, maskToken: m.token, placement }),
    })
    const reqMs = Math.round(performance.now() - t0)
    if (!res.ok) throw new Error(`preview ${res.status}: ${await res.text()}`)
    const json = (await res.json()) as { metrics: Record<string, unknown>; previewUrl: string }
    console.log(`  preview: ${reqMs}ms | letvice ${json.metrics.letviceProduct}=${json.metrics.letviceResult} | dE=${(json.metrics.chroma as { dE: number }).dE} | pipeline ${json.metrics.timeMs}ms`)
    results.push({
      test_id: sc.id,
      stage_balcony_ms: null,
      preview_request_ms: reqMs,
      pipeline_ms: json.metrics.timeMs,
      letvice: `${json.metrics.letviceProduct}=${json.metrics.letviceResult}`,
      outsideMax: json.metrics.outsideMax,
      outsideMaxPreShadow: json.metrics.outsideMaxPreShadow,
      deltaE: (json.metrics.chroma as { dE: number }).dE,
      previewUrl: json.previewUrl,
    })
  }
  writeFileSync(OUT, JSON.stringify(results, null, 2))
  console.log(`\nzapisano: ${OUT}`)
}

void main()
