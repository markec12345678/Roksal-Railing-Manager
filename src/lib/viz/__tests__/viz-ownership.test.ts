/**
 * VIZ — lastništvo projektov (runda S+4, P0).
 *
 * Dokazujemo celotno matriko iz spec S+4 §1 (NA BACKENDU, ne frontendu):
 *   user A ustvari → vidi → odpre → preimenuje → zbriše
 *   user B ne more: prebrati / preimenovati / izbrisati / renderirati /
 *                   prebrati tuj render job
 * Politika: tuj projekt = 404 (ne 403); zapuščina (brez ownerId) = samo ADMIN.
 *
 * Nivoja:
 *   1. repozitorij (Prisma local + blob dokumentni način z mockano storage)
 *   2. API rute (pravi handlerji z podpisanimi sejnimi žetoni — Bearer)
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createProject,
  createRenderJob,
  deleteProject,
  getProjectForOwner,
  getRenderJobForOwner,
  listProjects,
  listProjectsForOwner,
  renameProjectForOwner,
  type VizProjectInput,
} from '../repository'
import { mayAccess, vizOwner } from '../ownership'

const SECRET = 'test-secret-0123456789abcdef'

function ctx(ownerId: string, isAdmin = false) {
  return { ownerId, isAdmin }
}

// ── 1. Repozitorij (local / Prisma) ─────────────────────────────────────────────

const created: string[] = []

const BASE: VizProjectInput = {
  id: 'own-proj',
  name: 'Testni lastnik',
  originalPath: '/viz/projects/own-proj/original.jpg',
  productPath: '/viz/projects/own-proj/product.jpg',
  productMaskPath: null,
  maskPath: '/viz/projects/own-proj/mask.png',
  previewPath: '/viz/projects/own-proj/preview.jpg',
  resultPath: '/viz/projects/own-proj/result.json',
  placement: JSON.stringify({
    version: 2,
    corners: [[0.1, 0.2], [0.9, 0.2], [0.9, 0.8], [0.1, 0.8]],
    rotation: 0,
    scale: 1,
    productQuad: null,
  }),
  variants: null,
}

beforeEach(() => {
  delete process.env.BLOB_READ_WRITE_TOKEN
  delete process.env.VIZ_STORAGE_DRIVER
  process.env.SESSION_SECRET = SECRET
})

afterEach(async () => {
  for (const id of created.splice(0)) {
    await deleteProject(id).catch(() => undefined)
  }
})

afterAll(async () => {
  // render jobi kaširajo z projektom (onDelete: Cascade) — ni dodatnega čiščenja
})

describe('S+4 lastništvo — repozitorij (Prisma)', () => {
  it('A ustvari projekt → A ga vidi na seznamu, B ga NE', async () => {
    const proj = await createProject({ ...BASE, id: 'own-a1', ownerId: 'user-A' })
    created.push(proj.id)
    const a = await listProjectsForOwner(ctx('user-A'))
    const b = await listProjectsForOwner(ctx('user-B'))
    expect(a.some((p) => p.id === 'own-a1')).toBe(true)
    expect(b.some((p) => p.id === 'own-a1')).toBe(false)
  })

  it('B ne more prebrati tujega projekta (getProjectForOwner = null → 404)', async () => {
    await createProject({ ...BASE, id: 'own-a2', ownerId: 'user-A' })
    created.push('own-a2')
    expect(await getProjectForOwner('own-a2', ctx('user-A'))).not.toBeNull()
    expect(await getProjectForOwner('own-a2', ctx('user-B'))).toBeNull()
    expect(await getProjectForOwner('own-a2', ctx('user-B', true))).toBeNull() // B je ADMIN? ne — B isAdmin=true, a lastnik je A
  })

  it('B ne more preimenovati tujega projekta (null → 404)', async () => {
    await createProject({ ...BASE, id: 'own-a3', ownerId: 'user-A' })
    created.push('own-a3')
    expect(await renameProjectForOwner('own-a3', 'Ukraden', ctx('user-B'))).toBeNull()
    const after = await getProjectForOwner('own-a3', ctx('user-A'))
    expect(after?.name).toBe('Testni lastnik')
    // lastnik uspe
    const ok = await renameProjectForOwner('own-a3', 'Preimenovan', ctx('user-A'))
    expect(ok?.name).toBe('Preimenovan')
  })

  it('B ne more prebrati tujega render joba (404)', async () => {
    await createProject({ ...BASE, id: 'own-a4', ownerId: 'user-A' })
    created.push('own-a4')
    const job = await createRenderJob({ projectId: 'own-a4', ownerId: 'user-A', status: 'queued', engine: 'qwen-image-edit-2509', inputJson: '{}' })
    expect(await getRenderJobForOwner(job.id, ctx('user-A'))).not.toBeNull()
    expect(await getRenderJobForOwner(job.id, ctx('user-B'))).toBeNull()
    expect(await getRenderJobForOwner('ne-obstaja', ctx('user-A'))).toBeNull()
  })

  it('zapuščinski zapis brez ownerId: samo ADMIN ga vidi (A in B navaden ne)', async () => {
    await createProject({ ...BASE, id: 'own-legacy', ownerId: null })
    created.push('own-legacy')
    expect(await getProjectForOwner('own-legacy', ctx('user-A'))).toBeNull()
    expect(await getProjectForOwner('own-legacy', ctx('user-A', true))).not.toBeNull()
    expect((await listProjectsForOwner(ctx('user-A'))).some((p) => p.id === 'own-legacy')).toBe(false)
    expect((await listProjectsForOwner(ctx('user-A', true))).some((p) => p.id === 'own-legacy')).toBe(true)
  })

  it('mayAccess politika: null lastnik = samo ADMIN, drugače točno lastnik', () => {
    expect(mayAccess(ctx('u1'), 'u1')).toBe(true)
    expect(mayAccess(ctx('u1'), 'u2')).toBe(false)
    expect(mayAccess(ctx('u1'), null)).toBe(false)
    expect(mayAccess(ctx('u1', true), null)).toBe(true)
    expect(mayAccess(ctx('u1', true), 'u2')).toBe(false)
  })
})

// ── 2. Blob način (dokumentna logika z mockano storage plastjo) ───────────────

describe('S+4 lastništvo — blob način (dokumentna logika z mockano storage plastjo)', () => {
  function mockStorage() {
    const docs = new Map<string, string>()
    vi.doMock('../storage', () => ({
      storageMode: vi.fn(() => 'blob'),
      projectKey: (id: string, name: string) => `viz/projects/${id}/${name}`,
      renderJobKey: (id: string) => `viz/render-jobs/${id}.json`,
      vizPutJson: vi.fn(async (key: string, data: unknown) => {
        docs.set(key, JSON.stringify(data))
        return { key, url: `https://store/${key}` }
      }),
      vizGetJson: vi.fn(async <T,>(key: string): Promise<T | null> => {
        const v = docs.get(key)
        return v ? (JSON.parse(v) as T) : null
      }),
      vizDel: vi.fn(async (key: string) => {
        docs.delete(key)
      }),
      vizList: vi.fn(async (prefix: string) =>
        [...docs.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ key: k, url: `https://store/${k}` }))
      ),
    }))
    return docs
  }

  it('blob list/get filtrirata po lastniku (isolation v produkcijskem načinu)', async () => {
    mockStorage()
    vi.resetModules()
    try {
      const { createProject: cp, listProjectsForOwner: lp, getProjectForOwner: gp, deleteProject: dp } = await import('../repository')
      await cp({ ...BASE, id: 'blob-a1', ownerId: 'user-A' })
      await cp({ ...BASE, id: 'blob-b1', ownerId: 'user-B' })
      const a = await lp(ctx('user-A'))
      expect(a.map((p) => p.id)).toEqual(['blob-a1'])
      const b = await lp(ctx('user-B'))
      expect(b.map((p) => p.id)).toEqual(['blob-b1'])
      expect(await gp('blob-b1', ctx('user-A'))).toBeNull()
      expect(await gp('blob-a1', ctx('user-B'))).toBeNull()
      expect(await gp('blob-a1', ctx('user-A'))).not.toBeNull()
      await dp('blob-a1')
      expect(await gp('blob-a1', ctx('user-A'))).toBeNull()
    } finally {
      vi.doUnmock('../storage')
      vi.resetModules()
    }
  })
})

// ── 3. API rute (pravi handlerji + podpisani žetoni) ──────────────────────────

describe('S+4 lastništvo — API rute (Bearer sejni žetoni)', () => {
  let tokenA = ''
  let tokenB = ''

  beforeEach(async () => {
    // #5 §2: authenticate zahteva registrirano (živo) sejo — Profile + UserSession.
    const { createTestUserWithSession } = await import('@/lib/__tests__/helpers/test-session')
    tokenA = await createTestUserWithSession('user-A').then((r) => r.token)
    tokenB = await createTestUserWithSession('user-B').then((r) => r.token)
  })

  function req(method: string, url: string, token: string, body?: unknown): Request {
    return new Request(`http://localhost${url}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  }

  it('A ustvari projekt (route) → B ne more GET/PATCH/DELETE/render', async () => {
    const projectsRoute = await import('@/app/api/viz/projects/route')
    const detailRoute = await import('@/app/api/viz/projects/[id]/route')
    const renderRoute = await import('@/app/api/viz/render/route')
    const jobRoute = await import('@/app/api/viz/render/[jobId]/route')

    // A: seznam je lahko prazen ali vsebuje samo A projekte — ustvarimo enega
    const proj = await createProject({ ...BASE, id: 'route-a1', ownerId: 'user-A' })
    created.push(proj.id)

    // A vidi svoj projekt
    const listA = await projectsRoute.GET(req('GET', '/api/viz/projects', tokenA))
    expect(listA.status).toBe(200)
    const bodyA = (await listA.json()) as { projects: Array<{ id: string }> }
    expect(bodyA.projects.some((p) => p.id === 'route-a1')).toBe(true)

    // B NE vidi A projekta na seznamu
    const listB = await projectsRoute.GET(req('GET', '/api/viz/projects', tokenB))
    const bodyB = (await listB.json()) as { projects: Array<{ id: string }> }
    expect(bodyB.projects.some((p) => p.id === 'route-a1')).toBe(false)

    // B NE more odpreti (404), preimenovati (404), izbrisati (404)
    expect((await detailRoute.GET(req('GET', '/api/viz/projects/route-a1', tokenB), { params: Promise.resolve({ id: 'route-a1' }) })).status).toBe(404)
    expect((await detailRoute.PATCH(req('PATCH', '/api/viz/projects/route-a1', tokenB, { name: 'Ukraden' }), { params: Promise.resolve({ id: 'route-a1' }) })).status).toBe(404)
    expect((await detailRoute.DELETE(req('DELETE', '/api/viz/projects/route-a1', tokenB), { params: Promise.resolve({ id: 'route-a1' }) })).status).toBe(404)
    // po poskusih projekt ŠE VEDNO obstaja z istim imenom
    const still = await getProjectForOwner('route-a1', ctx('user-A'))
    expect(still?.name).toBe('Testni lastnik')

    // B NE more renderirati tujega projekta (404)
    expect((await renderRoute.POST(req('POST', '/api/viz/render', tokenB, { projectId: 'route-a1' }))).status).toBe(404)

    // A lahko renderira; B ne more prebrati A-jevega joba (404)
    const renderRes = await renderRoute.POST(req('POST', '/api/viz/render', tokenA, { projectId: 'route-a1' }))
    expect(renderRes.status).toBe(200)
    const { jobId } = (await renderRes.json()) as { jobId: string }
    expect((await jobRoute.GET(req('GET', `/api/viz/render/${jobId}`, tokenA), { params: Promise.resolve({ jobId }) })).status).toBe(200)
    expect((await jobRoute.GET(req('GET', `/api/viz/render/${jobId}`, tokenB), { params: Promise.resolve({ jobId }) })).status).toBe(404)

    // A uspešno zbriše svoj projekt
    expect((await detailRoute.DELETE(req('DELETE', '/api/viz/projects/route-a1', tokenA), { params: Promise.resolve({ id: 'route-a1' }) })).status).toBe(200)
    // ponovni DELETE → 404 (idempotentno obnašanje, ne 500)
    expect((await detailRoute.DELETE(req('DELETE', '/api/viz/projects/route-a1', tokenA), { params: Promise.resolve({ id: 'route-a1' }) })).status).toBe(404)
    // GET po DELETE → 404
    expect((await detailRoute.GET(req('GET', '/api/viz/projects/route-a1', tokenA), { params: Promise.resolve({ id: 'route-a1' }) })).status).toBe(404)
  })

  it('anonimna zahteva → 401; veljaven API ključ → 403 (viz ni za mobilne ključe)', async () => {
    const projectsRoute = await import('@/app/api/viz/projects/route')
    const anon = await projectsRoute.GET(new Request('http://localhost/api/viz/projects'))
    expect(anon.status).toBe(401)
    // veljaven API ključ (mockan — resnični ključ bi zahteval DB zapis + pepper)
    vi.doMock('@/lib/password', () => ({
      verifyPassword: vi.fn(),
      hashPassword: vi.fn(),
      // R126: verifyApiKey vrne rezultatni objekt (ok + scopes).
      verifyApiKey: vi.fn(async () => ({ ok: true, id: 'k1', name: 'mobilni-klient', scopes: ['projects:read'], projectScope: null })),
      generateApiKey: vi.fn(),
      hashApiKey: vi.fn(),
    }))
    vi.resetModules()
    try {
      const { vizOwner: vOwner } = await import('../ownership')
      const keyed = await vOwner(req('GET', '/x', 'rkm_validkey'))
      expect(keyed instanceof Response).toBe(true)
      expect((keyed as Response).status).toBe(403)
    } finally {
      vi.doUnmock('@/lib/password')
      vi.resetModules()
    }
  })

  it('vizOwner vrne kontekst za uporabnika; neveljaven api ključ → 401 (fail closed)', async () => {
    const ok = await vizOwner(req('GET', '/x', tokenA))
    expect(ok).toEqual({ ownerId: 'user-A', isAdmin: false })
    const keyed = await vizOwner(req('GET', '/x', 'rkm_x'))
    expect(keyed instanceof Response).toBe(true)
    expect((keyed as Response).status).toBe(401)
  })

  it('ADMIN sme videti zapuščinski zapis skozi rutu (GET 200)', async () => {
    const { createTestUserWithSession } = await import('@/lib/__tests__/helpers/test-session')
    const admin = await createTestUserWithSession('user-ADMIN', 'ADMIN').then((r) => r.token)
    await createProject({ ...BASE, id: 'route-legacy', ownerId: null })
    created.push('route-legacy')
    const detailRoute = await import('@/app/api/viz/projects/[id]/route')
    const res = await detailRoute.GET(req('GET', '/api/viz/projects/route-legacy', admin), { params: Promise.resolve({ id: 'route-legacy' }) })
    expect(res.status).toBe(200)
  })
})

// ── higiena: seznam vseh projektov ostane orodje (ni javno) ────────────────────

describe('higiena', () => {
  it('listProjects (brez filtra) obstaja samo za orodja/teste — rute ga ne kličejo več', async () => {
    const projectsRoute = await import('@/app/api/viz/projects/route')
    const src = await import('node:fs/promises').then((fs) => fs.readFile('src/app/api/viz/projects/route.ts', 'utf8'))
    expect(src).not.toContain('listProjects()')
    expect(typeof projectsRoute.GET).toBe('function')
  })
})
