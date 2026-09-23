/**
 * S+5 — meritve zmogljivosti po UX spremembah (spec §24).
 * Meri stage/preview/save/list/open na lokalnem dev strežniku (n=20/endpoint,
 * preview n=20) in izpiše p50/p90/p95/max. A-pipeline NI spremenjen.
 *
 * Uporaba: bun tools/s5-perf-check.ts [baseUrl]
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:3000'
const N = 20

function pct(sorted: number[]): { p50: number; p90: number; p95: number; max: number } {
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
  return { p50: q(0.5), p90: q(0.9), p95: q(0.95), max: sorted[sorted.length - 1] }
}

async function register(): Promise<string> {
  const email = `s5perf-${randomUUID().slice(0, 8)}@test.roksal.si`
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'S5-testni-2026!', name: 'S5 Perf' }),
  })
  return (res.headers.get('set-cookie') ?? '').split(';')[0]
}

async function main() {
  const cookie = await register()
  const demo = JSON.parse(readFileSync('public/viz-demo/demo.json','utf8')) as {
    balcony: { url: string }; product: { url: string }; mask: { url: string }
    placement: { corners: number[][]; productQuad: number[][] | null }
  }

  async function stageOnce(kind: 'balcony' | 'product' | 'mask'): Promise<{ ms: number; token: string }> {
    const url = kind === 'balcony' ? demo.balcony.url : kind === 'product' ? demo.product.url : demo.mask.url
    const buf = readFileSync(`public${url}`)
    const fd = new FormData()
    fd.append('file', new Blob([buf], { type: kind === 'mask' ? 'image/png' : 'image/jpeg' }), kind === 'mask' ? 'mask.png' : `${kind}.jpg`)
    fd.append('kind', kind)
    const t0 = performance.now()
    const res = await fetch(`${BASE}/api/viz/stage`, { method: 'POST', headers: { cookie }, body: fd })
    const ms = performance.now() - t0
    if (!res.ok) throw new Error(`stage ${kind} → ${res.status}`)
    return { ms, token: ((await res.json()) as { token: string }).token }
  }

  // stage (n=20, izmenično vrste)
  const stageTimes: number[] = []
  let balconyToken = ''
  let productToken = ''
  let maskToken = ''
  for (let i = 0; i < N; i++) {
    const kind = i % 3 === 0 ? 'balcony' : i % 3 === 1 ? 'product' : 'mask'
    const r = await stageOnce(kind)
    stageTimes.push(r.ms)
    if (kind === 'balcony') balconyToken = r.token
    if (kind === 'product') productToken = r.token
    if (kind === 'mask') maskToken = r.token
  }

  // preview (n=20)
  const previewTimes: number[] = []
  for (let i = 0; i < N; i++) {
    const t0 = performance.now()
    const res = await fetch(`${BASE}/api/viz/preview`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        originalToken: balconyToken,
        productToken,
        productMaskToken: null,
        maskToken,
        placement: { version: 2, corners: demo.placement.corners, rotation: 0, scale: 1, productQuad: demo.placement.productQuad },
      }),
    })
    previewTimes.push(performance.now() - t0)
    if (!res.ok) throw new Error(`preview → ${res.status}: ${await res.text()}`)
    await res.json()
  }

  // save (n=20) + cleanup
  const saveTimes: number[] = []
  const savedIds: string[] = []
  for (let i = 0; i < N; i++) {
    const t0 = performance.now()
    const res = await fetch(`${BASE}/api/viz/projects`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ name: `S5 perf ${i}`, stagingToken: balconyToken }),
    })
    saveTimes.push(performance.now() - t0)
    if (res.ok) {
      const j = (await res.json()) as { projectId: string }
      savedIds.push(j.projectId)
    } else {
      console.error(`save ${i} → ${res.status}`)
    }
  }

  // list (n=20)
  const listTimes: number[] = []
  for (let i = 0; i < N; i++) {
    const t0 = performance.now()
    const res = await fetch(`${BASE}/api/viz/projects`, { headers: { cookie } })
    listTimes.push(performance.now() - t0)
    await res.json()
  }

  // open (n=20, krozimo shranjene)
  const openTimes: number[] = []
  for (let i = 0; i < N; i++) {
    const id = savedIds[i % savedIds.length]
    const t0 = performance.now()
    const res = await fetch(`${BASE}/api/viz/projects/${id}`, { headers: { cookie } })
    openTimes.push(performance.now() - t0)
    await res.json()
  }

  // cleanup
  for (const id of savedIds) {
    await fetch(`${BASE}/api/viz/projects/${id}`, { method: 'DELETE', headers: { cookie } }).catch(() => undefined)
  }

  const rows: Array<[string, number[]]> = [
    [`stage  (n=${N})`, stageTimes],
    [`preview(n=${N})`, previewTimes],
    [`save   (n=${N})`, saveTimes],
    [`list   (n=${N})`, listTimes],
    [`open   (n=${N})`, openTimes],
  ]
  console.log('endpoint        p50     p90     p95     max   (ms)')
  for (const [name, times] of rows) {
    const s = pct([...times].sort((a, b) => a - b))
    console.log(
      `${name}  ${s.p50.toFixed(0).padStart(5)}  ${s.p90.toFixed(0).padStart(5)}  ${s.p95.toFixed(0).padStart(5)}  ${s.max.toFixed(0).padStart(5)}`,
    )
  }
}

void main()
