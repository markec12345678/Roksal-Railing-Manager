/**
 * VIZ — Blob security model (runda S+4, P0 §2).
 *
 * AUDIT (reproducibilno dokazano na produkciji, HEAD 1a4c403):
 *   vseh 7 projektnih datotek → HTTP 200 BREZ avtentikacije, CORS `*`.
 *   => javna dostopnost NI bila namerna varnostna odločitev.
 *
 * NOVI MODEL: klient vidi SAMO proxy URL-e (/api/viz/files/...), surovi
 * blob URL-ji ne gredo k klientu in se ne shranjujejo v nove zapise.
 *
 * Testi tu: clientUrlForPath pretvorbe, proxy URL v blob načinu, ter
 * pravila proxy rute (lastnik 200 / tuj 404 / anon 401 / staging prijavljen /
 * render-jobs zavrnjen). Produkcijski dokaz (curl brez piškotkov → 401/404)
 * je v reports/S+4-REPORT.md (tools/blob-audit-prod.ts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { clientUrlFor, clientUrlForPath, projectKey, stagingKey, vizDelPrefix, vizPut, vizHas, VIZ_FILE_NAMES } from '../storage'

beforeEach(() => {
  delete process.env.BLOB_READ_WRITE_TOKEN
  delete process.env.VIZ_STORAGE_DRIVER
  process.env.SESSION_SECRET = 'test-secret-0123456789abcdef'
})

const cleanupKeys: string[] = []
const cleanupIds: string[] = []
afterEach(async () => {
  for (const key of cleanupKeys.splice(0)) {
    await vizDelPrefix(key).catch(() => undefined)
  }
  for (const id of cleanupIds.splice(0)) {
    await vizDelPrefix(`viz/projects/${id}/`).catch(() => undefined)
  }
  vi.doUnmock('../storage')
  vi.doUnmock('@vercel/blob')
  vi.resetModules()
})

describe('S+4 blob security — clientUrlForPath pretvorbe', () => {
  it('zapuščinski surovi blob URL → proxy pot', () => {
    const raw = 'https://cidgcfdqpr3tvp7w.public.blob.vercel-storage.com/viz/projects/d4c955a7-7791-4511-a7ce-1c8cb744147d/original.jpg'
    expect(clientUrlForPath(raw)).toBe('/api/viz/files/viz/projects/d4c955a7-7791-4511-a7ce-1c8cb744147d/original.jpg')
  })

  it('proxy pot ostane proxy, local /viz/… ostane local, prazno → prazno', () => {
    expect(clientUrlForPath('/api/viz/files/viz/projects/x/original.jpg')).toBe('/api/viz/files/viz/projects/x/original.jpg')
    expect(clientUrlForPath('/viz/projects/x/original.jpg')).toBe('/viz/projects/x/original.jpg')
    expect(clientUrlForPath(null)).toBe('')
    expect(clientUrlForPath(undefined)).toBe('')
    // tuj zunanji URL (ne /viz/) ostane nespremenjen (ni naš)
    expect(clientUrlForPath('https://example.com/a.jpg')).toBe('https://example.com/a.jpg')
  })
})

describe('S+4 blob security — vizPut vrača proxy URL (blob način, mockana storage)', () => {
  it('blob: url = /api/viz/files/<key>; local: url = /<key>', async () => {
    const actual = await vi.importActual<typeof import('../storage')>('../storage')
    // blob način: storageMode preglasemo z env + mockamo samo @vercel/blob put
    process.env.VIZ_STORAGE_DRIVER = 'blob'
    const putCalls: Array<{ key: string; url: string }> = []
    vi.doMock('@vercel/blob', () => ({
      put: vi.fn(async (key: string) => {
        const url = `https://store.example/${key}`
        putCalls.push({ key, url })
        return { url, pathname: key }
      }),
      head: vi.fn(async () => ({ url: 'https://store.example/x' })),
      del: vi.fn(async () => undefined),
      list: vi.fn(async () => ({ blobs: [], cursor: undefined })),
    }))
    vi.resetModules()
    try {
      const storage = await import('../storage')
      const res = await storage.vizPut('viz/projects/p1/original.jpg', Buffer.from('x'), 'image/jpeg')
      expect(res.url).toBe('/api/viz/files/viz/projects/p1/original.jpg')
      // surovi URL NI v odgovoru
      expect(res.url).not.toContain('store.example')
      // clientUrlForPath konvertira tudi surove URL-je te seje
      expect(storage.clientUrlForPath(putCalls[0].url)).toBe('/api/viz/files/viz/projects/p1/original.jpg')
    } finally {
      delete process.env.VIZ_STORAGE_DRIVER
    }
    // local način (privzet)
    expect(clientUrlFor('viz/projects/p1/original.jpg')).toBe('/viz/projects/p1/original.jpg')
    void actual
  })
})

describe('S+4 blob security — proxy ruta /api/viz/files/[...key]', () => {
  let tokenA = ''
  let tokenB = ''

  beforeEach(async () => {
    const { signSession } = await import('@/lib/session')
    tokenA = await signSession({ sub: 'user-A', email: 'a@test.si', ime: 'A', vloga: 'MONTER' })
    tokenB = await signSession({ sub: 'user-B', email: 'b@test.si', ime: 'B', vloga: 'MONTER' })
  })

  function req(url: string, token?: string): Request {
    return new Request(`http://localhost${url}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
  }

  it('lastnik prebere svojo datoteko (200, pravi bytes, private cache-control)', async () => {
    const id = `sec-${randomUUID().slice(0, 8)}`
    cleanupKeys.push(`viz/projects/${id}/`)
    await vizPut(projectKey(id, VIZ_FILE_NAMES.original), Buffer.from('original-bytes-xyz'), 'image/jpeg')
    await vizPut(projectKey(id, 'project.json'), Buffer.from(JSON.stringify({ ownerId: 'user-A' })), 'application/json')
    // metadata zapis je potreben za lastniško preverbo
    const { createProject, deleteProject } = await import('../repository')
    await createProject({
      id, name: 'sec', originalPath: '', productPath: '', productMaskPath: null, maskPath: '',
      previewPath: null, resultPath: null,
      placement: '{"version":2,"corners":[[0.1,0.2],[0.9,0.2],[0.9,0.8],[0.1,0.8]],"rotation":0,"scale":1,"productQuad":null}',
      variants: null, ownerId: 'user-A',
    })
    cleanupIds.push(id)

    const route = await import('@/app/api/viz/files/[...key]/route')
    const res = await route.GET(req(`/api/viz/files/viz/projects/${id}/original.jpg`, tokenA), { params: Promise.resolve({ key: ['viz', 'projects', id, 'original.jpg'] }) })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('original-bytes-xyz')
    expect(res.headers.get('cache-control')).toContain('private')
    expect(res.headers.get('content-type')).toBe('image/jpeg')
    await deleteProject(id).catch(() => undefined)
  })

  it('tuj uporabnik → 404; anonimen → 401; render-jobs pot → 400', async () => {
    const id = `sec-${randomUUID().slice(0, 8)}`
    const { createProject, deleteProject } = await import('../repository')
    await createProject({
      id, name: 'sec2', originalPath: '', productPath: '', productMaskPath: null, maskPath: '',
      previewPath: null, resultPath: null,
      placement: '{"version":2,"corners":[[0.1,0.2],[0.9,0.2],[0.9,0.8],[0.1,0.8]],"rotation":0,"scale":1,"productQuad":null}',
      variants: null, ownerId: 'user-A',
    })
    cleanupIds.push(id)

    const route = await import('@/app/api/viz/files/[...key]/route')
    // B (tuj) → 404 (ne pušča obstoja)
    const resB = await route.GET(req(`/api/viz/files/viz/projects/${id}/original.jpg`, tokenB), { params: Promise.resolve({ key: ['viz', 'projects', id, 'original.jpg'] }) })
    expect(resB.status).toBe(404)
    // anonimen → 401
    const resAnon = await route.GET(req(`/api/viz/files/viz/projects/${id}/original.jpg`), { params: Promise.resolve({ key: ['viz', 'projects', id, 'original.jpg'] }) })
    expect(resAnon.status).toBe(401)
    // render-jobs metadata ni dosegljiv skozi proxy
    const resJobs = await route.GET(req('/api/viz/files/viz/render-jobs/job-1.json', tokenA), { params: Promise.resolve({ key: ['viz', 'render-jobs', 'job-1.json'] }) })
    expect(resJobs.status).toBe(400)
    await deleteProject(id).catch(() => undefined)
  })

  it('staging: vsak prijavljen uporabnik lahko prebere (kratkotrajni tok)', async () => {
    const tok = `tok-${randomUUID().slice(0, 12)}`
    cleanupKeys.push(`viz/staging/${tok}/`)
    await vizPut(stagingKey(tok, VIZ_FILE_NAMES.product), Buffer.from('product-staged'), 'image/jpeg')
    const route = await import('@/app/api/viz/files/[...key]/route')
    const res = await route.GET(req(`/api/viz/files/viz/staging/${tok}/product.jpg`, tokenB), { params: Promise.resolve({ key: ['viz', 'staging', tok, 'product.jpg'] }) })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('product-staged')
    expect(res.headers.get('cache-control')).toContain('no-store')
    expect(await vizHas(stagingKey(tok, VIZ_FILE_NAMES.product))).toBe(true)
  })
})
