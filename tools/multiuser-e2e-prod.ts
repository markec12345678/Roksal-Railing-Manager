/**
 * S+4 §7 — MULTI-USER PRODUCTION E2E (pravi HTTP zahtevki proti Vercelu).
 *
 * Dokazuje na PRAVI produkciji:
 *   1. registracija dveh različnih uporabnikov (A, B)
 *   2. A ustvari projekt (stage → preview → save) in ga vidi/odpre
 *   3. B na seznamu NE vidi A projekta
 *   4. NEPOSREDNI HTTP napadi B na A projekt — vse zavrnjene:
 *      GET / PATCH / DELETE / render / files proxy / GET tuj render job
 *   5. A lahko svoj projekt normalno uporablja in izbriše
 *   6. idempotenca save ×2 (isti ključ → isti projekt)
 *   7. proxy model: v odgovorih NI surovih blob URL-jev; files proxy brez
 *      seje → 401
 *   8. GC endpoint brez auth → 401 (fail-closed)
 *
 * Uporaba: bun tools/multiuser-e2e-prod.ts   (BASE opcionalno prek env)
 */
import { writeFileSync } from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE ?? 'https://roksal-railing-manager.vercel.app'
const OUT = path.join(__dirname, '..', 'tmp', 'scenarios', 'multiuser-e2e-prod.json')
const INPUT = process.env.AUDIT_IMG ?? '/home/z/baseline/input/balcony_3.png'

interface Check {
  step: string
  ok: boolean
  detail: string
}

const checks: Check[] = []
function check(step: string, ok: boolean, detail: string): Check {
  checks.push({ step, ok, detail })
  console.log(`  ${ok ? '✓' : '✗ FAIL'} ${step} — ${detail}`)
  return { step, ok, detail }
}

async function api(path: string, init: RequestInit & { cookie?: string } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
      ...(init.cookie ? { cookie: init.cookie } : {}),
      ...(init.headers ?? {}),
    },
  })
  return res
}

async function register(email: string, name: string): Promise<string> {
  const res = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password: `S4-E2E-${randomToken()}!`, name }),
  })
  const setCookie = res.headers.get('set-cookie') ?? ''
  const session = setCookie.split(';')[0]
  if (!res.ok || !session.startsWith('roksal_session=')) {
    // če že obstaja (ponovni zagon), poskusi prijavo ni mogoča (geslo random) —
    // zato unikaten email na zagon
    throw new Error(`register ${email} → ${res.status}: ${await res.text()}`)
  }
  return session
}

function randomToken(): string {
  return Math.random().toString(36).slice(2, 10)
}

async function stage(cookie: string, file: string, kind: string): Promise<{ token: string; url: string }> {
  const buf = await (await import('node:fs/promises')).readFile(file)
  const fd = new FormData()
  fd.append('file', new Blob([new Uint8Array(buf)]), 'photo.jpg')
  fd.append('kind', kind)
  const res = await api('/api/viz/stage', { method: 'POST', body: fd, cookie })
  if (!res.ok) throw new Error(`stage ${kind} → ${res.status}`)
  return res.json() as Promise<{ token: string; url: string }>
}

async function main() {
  console.log(`\n=== S+4 §7 MULTI-USER E2E na ${BASE} ===`)
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)

  // ── 1. Registracija A in B ────────────────────────────────────────────────
  const cookieA = await register(`monter-a-${stamp}@roksal.si`, 'Monter A')
  const cookieB = await register(`monter-b-${stamp}@roksal.si`, 'Monter B')
  check('registracija A + B', Boolean(cookieA && cookieB), 'obe seji izdani (MONTER)')

  // ── 2. A: stage → preview → save ──────────────────────────────────────────
  const b = await stage(cookieA, INPUT, 'balcony')
  const p = await stage(cookieA, INPUT, 'product')
  const m = await stage(cookieA, INPUT, 'mask')
  const placement = {
    version: 2,
    corners: [[0.232, 0.451], [0.933, 0.294], [0.929, 0.652], [0.232, 0.709]],
    rotation: 0,
    scale: 1,
    productQuad: null,
  }
  const preview = await api('/api/viz/preview', {
    method: 'POST',
    cookie: cookieA,
    body: JSON.stringify({ originalToken: b.token, productToken: p.token, productMaskToken: null, maskToken: m.token, placement }),
  })
  check('A: preview', preview.ok, `HTTP ${preview.status}`)
  const idemKey = `s4-e2e-${stamp}`
  const saveRes = await api('/api/viz/projects', {
    method: 'POST',
    cookie: cookieA,
    body: JSON.stringify({ name: `S4 E2E A ${stamp}`, stagingToken: b.token, productToken: p.token, maskToken: m.token, idempotencyKey: idemKey }),
  })
  const save = (await saveRes.json()) as { projectId: string; urls: Record<string, string> }
  check('A: save', saveRes.ok && Boolean(save.projectId), `HTTP ${saveRes.status}, id=${save.projectId}`)
  const projectId = save.projectId

  // idempotenca: isti save ×2 → isti projekt
  const save2 = await api('/api/viz/projects', {
    method: 'POST',
    cookie: cookieA,
    body: JSON.stringify({ name: `S4 E2E A ${stamp}`, stagingToken: b.token, productToken: p.token, maskToken: m.token, idempotencyKey: idemKey }),
  })
  const save2Body = (await save2.json()) as { projectId: string; idempotent?: boolean }
  check('idempotenca: save ×2 → isti projekt', save2.ok && save2Body.projectId === projectId && save2Body.idempotent === true, `id=${save2Body.projectId}, idempotent=${save2Body.idempotent}`)

  // A vidi svoj projekt na seznamu in ga odpre
  const listA = await api('/api/viz/projects', { cookie: cookieA })
  const listAJson = (await listA.json()) as { projects: Array<{ id: string }> }
  check('A: seznam vidi svoj projekt', listA.ok && listAJson.projects.some((x) => x.id === projectId), `HTTP ${listA.status}, št=${listAJson.projects.length}`)
  const openA = await api(`/api/viz/projects/${projectId}`, { cookie: cookieA })
  check('A: odpre svoj projekt', openA.ok, `HTTP ${openA.status}`)

  // A preimenuje svoj projekt
  const patchA = await api(`/api/viz/projects/${projectId}`, { method: 'PATCH', cookie: cookieA, body: JSON.stringify({ name: `S4 E2E A preimenovan ${stamp}` }) })
  check('A: preimenuje svoj projekt', patchA.ok, `HTTP ${patchA.status}`)

  // ── 3. B: seznam NE vidi A projekta ───────────────────────────────────────
  const listB = await api('/api/viz/projects', { cookie: cookieB })
  const listBJson = (await listB.json()) as { projects: Array<{ id: string }> }
  check('B: seznam NE vidi A projekta', listB.ok && !listBJson.projects.some((x) => x.id === projectId), `HTTP ${listB.status}, št=${listBJson.projects.length}`)

  // ── 4. Neposredni HTTP napadi B ───────────────────────────────────────────
  const getB = await api(`/api/viz/projects/${projectId}`, { cookie: cookieB })
  check('B: GET tuj projekt → 404', getB.status === 404, `HTTP ${getB.status}`)
  const patchB = await api(`/api/viz/projects/${projectId}`, { method: 'PATCH', cookie: cookieB, body: JSON.stringify({ name: 'Ukraden' }) })
  check('B: PATCH tuj projekt → 404', patchB.status === 404, `HTTP ${patchB.status}`)
  const deleteB = await api(`/api/viz/projects/${projectId}`, { method: 'DELETE', cookie: cookieB })
  check('B: DELETE tuj projekt → 404', deleteB.status === 404, `HTTP ${deleteB.status}`)
  const renderB = await api('/api/viz/render', { method: 'POST', cookie: cookieB, body: JSON.stringify({ projectId }) })
  check('B: POST render tuj projekt → 404', renderB.status === 404, `HTTP ${renderB.status}`)
  const fileB = await api(`/api/viz/files/viz/projects/${projectId}/original.jpg`, { cookie: cookieB })
  check('B: files proxy tuj projekt → 404', fileB.status === 404, `HTTP ${fileB.status}`)
  // A ustvari render job; B ne sme prebrati
  const renderA = await api('/api/viz/render', { method: 'POST', cookie: cookieA, body: JSON.stringify({ projectId }) })
  const renderAJson = (await renderA.json()) as { jobId: string; status?: string }
  check('A: POST render svoj projekt (stub queued)', renderA.ok, `HTTP ${renderA.status}, status=${renderAJson.status ?? 'n/a'}`)
  const jobB = await api(`/api/viz/render/${renderAJson.jobId}`, { cookie: cookieB })
  check('B: GET tuj render job → 404', jobB.status === 404, `HTTP ${jobB.status}`)
  const jobA = await api(`/api/viz/render/${renderAJson.jobId}`, { cookie: cookieA })
  check('A: GET svoj render job → 200 (iskren queued)', jobA.ok, `HTTP ${jobA.status}, ${(await jobA.json()).status}`)

  // ── 7. Proxy model: ni surovih URL-jev; files proxy brez seje → 401 ───────
  const urlsStr = JSON.stringify(save.urls)
  check('save odgovor NE vsebuje surovih blob URL-jev', !urlsStr.includes('.public.blob.vercel-storage.com'), urlsStr.slice(0, 80))
  const fileAnon = await api(`/api/viz/files/viz/projects/${projectId}/original.jpg`)
  check('files proxy brez seje → 401', fileAnon.status === 401, `HTTP ${fileAnon.status}`)
  const fileA = await api(`/api/viz/files/viz/projects/${projectId}/original.jpg`, { cookie: cookieA })
  check('files proxy z sejo lastnika → 200', fileA.ok, `HTTP ${fileA.status}, ${fileA.headers.get('content-type')}`)

  // ── 8. GC fail-closed ─────────────────────────────────────────────────────
  const gcAnon = await api('/api/viz/gc', { method: 'POST' })
  check('GC brez auth → 401', gcAnon.status === 401, `HTTP ${gcAnon.status}`)

  // ── 5. A pobriše svoj projekt; ponovljen DELETE = 404; GET = 404 ──────────
  const delA1 = await api(`/api/viz/projects/${projectId}`, { method: 'DELETE', cookie: cookieA })
  const delA2 = await api(`/api/viz/projects/${projectId}`, { method: 'DELETE', cookie: cookieA })
  const getAfterDel = await api(`/api/viz/projects/${projectId}`, { cookie: cookieA })
  check('A: DELETE svoj projekt → 200; DELETE ×2 → 404; GET po brisanju → 404', delA1.ok && delA2.status === 404 && getAfterDel.status === 404, `${delA1.status}/${delA2.status}/${getAfterDel.status}`)

  // ── Izpis ─────────────────────────────────────────────────────────────────
  const failed = checks.filter((c) => !c.ok)
  console.log(`\n=== REZULTAT: ${checks.length - failed.length}/${checks.length} PASS, ${failed.length} FAIL ===`)
  writeFileSync(OUT, JSON.stringify({ base: BASE, ranAt: new Date().toISOString(), checks }, null, 2))
  console.log(`Rezultati: ${OUT}`)
  if (failed.length > 0) process.exit(1)
}

main().catch((e) => {
  console.error('E2E napaka:', e)
  process.exit(1)
})
