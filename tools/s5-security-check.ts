/**
 * S+5 — varnostni spot-check (spec §25): po UX spremembah mora ostati
 * B uporabnik → 404/403 za vse A-jeve podatke (projekti, datoteke, jobi).
 * Local produkcija (dev strežnik), pravi HTTP klici.
 *
 * Uporaba: bun tools/s5-security-check.ts [baseUrl]
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:3000'

async function register(name: string): Promise<string> {
  const email = `s5-${name}-${randomUUID().slice(0, 8)}@test.roksal.si`
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'S5-testni-2026!', name: `S5 ${name}` }),
  })
  if (res.status === 404 || res.status === 405) {
    // registracija nedosegljiva → demo
    const d = await fetch(`${BASE}/api/auth/demo`, { method: 'POST' })
    const setCookie = d.headers.get('set-cookie') ?? ''
    return setCookie.split(';')[0]
  }
  if (!res.ok) throw new Error(`register ${name} → ${res.status}: ${await res.text()}`)
  const setCookie = res.headers.get('set-cookie') ?? ''
  return setCookie.split(';')[0]
}

interface Check { name: string; ok: boolean; status: number }

async function main() {
  const checks: Check[] = []
  const cookieA = await register('A')
  const cookieB = await register('B')

  // A: stage balkon + produkt + maska (iz demo assets), preview, save
  async function stage(cookie: string, file: string, kind: string): Promise<string> {
    const buf = readFileSync(file)
    const fd = new FormData()
    fd.append('file', new Blob([buf], { type: 'image/jpeg' }), file.split('/').pop()!)
    fd.append('kind', kind)
    const res = await fetch(`${BASE}/api/viz/stage`, { method: 'POST', headers: { cookie }, body: fd })
    if (!res.ok) throw new Error(`stage ${kind} → ${res.status}`)
    return ((await res.json()) as { token: string }).token
  }

  const demo = JSON.parse(readFileSync('public/viz-demo/demo.json','utf8')) as {
    placement: { corners: number[][]; productQuad: number[][] | null }
  }
  const tBalkon = await stage(cookieA, 'public/viz-demo/balcony.jpg', 'balcony')
  const tProduct = await stage(cookieA, 'public/viz-demo/product.jpg', 'product')
  const tMask = await stage(cookieA, 'public/viz-demo/mask.png', 'mask')
  const preview = await fetch(`${BASE}/api/viz/preview`, {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: JSON.stringify({
      originalToken: tBalkon,
      productToken: tProduct,
      productMaskToken: null,
      maskToken: tMask,
      placement: { version: 2, corners: demo.placement.corners, rotation: 0, scale: 1, productQuad: demo.placement.productQuad },
    }),
  })
  checks.push({ name: 'A: preview', ok: preview.ok, status: preview.status })
  const pv = (await preview.json()) as { metrics: unknown }

  const save = await fetch(`${BASE}/api/viz/projects`, {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'S5 security check', stagingToken: tBalkon }),
  })
  checks.push({ name: 'A: save', ok: save.ok, status: save.status })
  const { projectId } = (await save.json()) as { projectId: string }

  // B poskuša dostopati do A-jevih podatkov (vse MORA biti 404/403)
  const bChecks: Array<[string, Response]> = [
    ['B: GET tuj projekt', await fetch(`${BASE}/api/viz/projects/${projectId}`, { headers: { cookie: cookieB } })],
    ['B: PATCH tuj projekt', await fetch(`${BASE}/api/viz/projects/${projectId}`, { method: 'PATCH', headers: { cookie: cookieB, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Ukraden' }) })],
    ['B: DELETE tuj projekt', await fetch(`${BASE}/api/viz/projects/${projectId}`, { method: 'DELETE', headers: { cookie: cookieB } })],
    ['B: render tuj projekt', await fetch(`${BASE}/api/viz/render`, { method: 'POST', headers: { cookie: cookieB, 'content-type': 'application/json' }, body: JSON.stringify({ projectId }) })],
    ['B: duplicate tuj projekt', await fetch(`${BASE}/api/viz/projects/${projectId}/duplicate`, { method: 'POST', headers: { cookie: cookieB } })],
    ['B: file original', await fetch(`${BASE}/api/viz/files/viz/projects/${projectId}/original.jpg`, { headers: { cookie: cookieB } })],
    ['B: file preview', await fetch(`${BASE}/api/viz/files/viz/projects/${projectId}/preview.jpg`, { headers: { cookie: cookieB } })],
  ]
  for (const [name, res] of bChecks) {
    checks.push({ name, ok: res.status === 404 || res.status === 403, status: res.status })
  }

  // A še vedno dostopa (sanity) + počisti
  const aGet = await fetch(`${BASE}/api/viz/projects/${projectId}`, { headers: { cookie: cookieA } })
  checks.push({ name: 'A: GET svoj (sanity)', ok: aGet.ok, status: aGet.status })
  const del = await fetch(`${BASE}/api/viz/projects/${projectId}`, { method: 'DELETE', headers: { cookie: cookieA } })
  checks.push({ name: 'A: DELETE svoj (cleanup)', ok: del.ok, status: del.status })

  let pass = 0
  for (const c of checks) {
    console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name} → ${c.status}`)
    if (c.ok) pass++
  }
  console.log(`\n${pass}/${checks.length} PASS · preview metrics ok=${!!pv.metrics}`)
  if (pass !== checks.length) process.exit(1)
}

void main()
