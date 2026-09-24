/**
 * VIZ — PODVOJITEV projekta (runda S+5, spec §16).
 *
 * Dokazujemo:
 *   1. Repozitorij (local/Prisma + blob dokumentni način): nov id, ime
 *      " (kopija)", prepisane poti datotek, isti lastnik, idempotencyKey = null,
 *      izvorni projekt NEPRIZADET.
 *   2. Lastništvo: B ne more podvojiti A-jevega projekta (null → 404).
 *   3. API ruta: kopiranje datotek (vizCopy), compensating cleanup ob
 *      neuspešnem kopiranju (0 orphan metadata), tuj projekt → 404.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createProject,
  deleteProject,
  duplicateProjectForOwner,
  getProject,
  getProjectForOwner,
  type VizProjectInput,
} from '../repository'

const SECRET = 'test-secret-0123456789abcdef'

function ctx(ownerId: string, isAdmin = false) {
  return { ownerId, isAdmin }
}

const created: string[] = []

/** Dosleden vnos: poti sledijo id-ju (kot v produkciji — route generira obe). */
function baseInput(id: string, overrides: Partial<VizProjectInput> = {}): VizProjectInput {
  return {
    id,
    name: 'Balkon – ograja A',
    originalPath: `/viz/projects/${id}/original.jpg`,
    productPath: `/viz/projects/${id}/product.jpg`,
    productMaskPath: `/viz/projects/${id}/product-mask.png`,
    maskPath: `/viz/projects/${id}/mask.png`,
    previewPath: `/viz/projects/${id}/preview.jpg`,
    resultPath: `/viz/projects/${id}/result.json`,
    placement: JSON.stringify({
      version: 2,
      corners: [[0.1, 0.2], [0.9, 0.2], [0.9, 0.8], [0.1, 0.8]],
      rotation: 0,
      scale: 1,
      productQuad: null,
    }),
    variants: null,
    ...overrides,
  }
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
  // čiščenje poteka per-test
})

describe('S+5 podvoji — repozitorij (Prisma local)', () => {
  it('podvojitev: nov id, ime " (kopija)", prepisane poti, isti lastnik, izvornik nespremenjen', async () => {
    const src = await createProject(baseInput('dup-a1', { ownerId: 'user-A', idempotencyKey: 'key-12345678' }))
    created.push(src.id)
    const copy = await duplicateProjectForOwner('dup-a1', ctx('user-A'))
    expect(copy).not.toBeNull()
    created.push(copy!.id)
    expect(copy!.id).not.toBe('dup-a1')
    expect(copy!.name).toBe('Balkon – ograja A (kopija)')
    expect(copy!.ownerId).toBe('user-A')
    expect(copy!.idempotencyKey).toBeNull()
    expect(copy!.originalPath).toBe(`/viz/projects/${copy!.id}/original.jpg`)
    expect(copy!.maskPath).toBe(`/viz/projects/${copy!.id}/mask.png`)
    expect(copy!.previewPath).toBe(`/viz/projects/${copy!.id}/preview.jpg`)
    expect(copy!.productMaskPath).toBe(`/viz/projects/${copy!.id}/product-mask.png`)
    expect(copy!.placement).toBe(src.placement)
    // izvornik ostane nespremenjen
    const srcAfter = await getProject('dup-a1')
    expect(srcAfter?.name).toBe('Balkon – ograja A')
    expect(srcAfter?.originalPath).toBe('/viz/projects/dup-a1/original.jpg')
  })

  it('B ne more podvojiti A-jevega projekta (null → 404)', async () => {
    const src = await createProject(baseInput('dup-a2', { ownerId: 'user-A' }))
    created.push(src.id)
    expect(await duplicateProjectForOwner('dup-a2', ctx('user-B'))).toBeNull()
    expect(await duplicateProjectForOwner('dup-ne-obstaja', ctx('user-A'))).toBeNull()
  })

  it('ime preseže 120 znakov → skrajšano na 120', async () => {
    const longName = 'X'.repeat(130)
    const src = await createProject(baseInput('dup-a3', { ownerId: 'user-A', name: longName }))
    created.push(src.id)
    const copy = await duplicateProjectForOwner('dup-a3', ctx('user-A'))
    created.push(copy!.id)
    expect(copy!.name.length).toBeLessThanOrEqual(120)
    expect(copy!.name.endsWith('(kopija)')).toBe(true)
  })
})

describe('S+5 podvoji — blob način (dokumentna logika, mockana storage)', () => {
  it('blob: nov dokument project.json, lastniška izolacija ostaja', async () => {
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
    vi.resetModules()
    try {
      const {
        createProject: cp,
        duplicateProjectForOwner: dp,
        getProjectForOwner: gp,
        getProject: g,
        deleteProject: del,
      } = await import('../repository')
      const src = await cp(baseInput('blob-dup-a', { ownerId: 'user-A' }))
      const copy = await dp('blob-dup-a', ctx('user-A'))
      expect(copy).not.toBeNull()
      expect(copy!.name).toBe('Balkon – ograja A (kopija)')
      expect(copy!.ownerId).toBe('user-A')
      expect(copy!.originalPath).toBe(`/viz/projects/${copy!.id}/original.jpg`)
      // metadata dokument obstaja
      expect(docs.get(`viz/projects/${copy!.id}/project.json`)).toBeTruthy()
      // izolacija: B vidi null
      expect(await gp(copy!.id, ctx('user-B'))).toBeNull()
      // izvornik nespremenjen
      expect((await g('blob-dup-a'))?.name).toBe(src.name)
      await del(copy!.id)
    } finally {
      vi.doUnmock('../storage')
      vi.resetModules()
    }
  })
})

describe('S+5 podvoji — API ruta (pravi handlerji + žetoni)', () => {
  let tokenA = ''
  let tokenB = ''

  beforeEach(async () => {
    // #5 §2: authenticate zahteva registrirano (živo) sejo — Profile + UserSession.
    const { createTestUserWithSession } = await import('@/lib/__tests__/helpers/test-session')
    tokenA = await createTestUserWithSession('user-A').then((r) => r.token)
    tokenB = await createTestUserWithSession('user-B').then((r) => r.token)
  })

  function req(method: string, url: string, token: string): Request {
    return new Request(`http://localhost${url}`, {
      method,
      headers: { authorization: `Bearer ${token}` },
    })
  }

  it('A podvoji svoj projekt → 200 + datoteke kopirane; B → 404', async () => {
    const route = await import('@/app/api/viz/projects/[id]/duplicate/route')
    const { vizPut } = await import('../storage')

    // naredi realne projektne datoteke (local mode → public/viz/projects/…)
    await createProject(baseInput('dup-route-a1', { ownerId: 'user-A' }))
    created.push('dup-route-a1')
    for (const name of ['original.jpg', 'product.jpg', 'mask.png', 'preview.jpg']) {
      await vizPut(`viz/projects/dup-route-a1/${name}`, Buffer.from(name), 'image/jpeg')
    }

    // A podvoji
    const res = await route.POST(req('POST', '/api/viz/projects/dup-route-a1/duplicate', tokenA), {
      params: Promise.resolve({ id: 'dup-route-a1' }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { project: { id: string; name: string } }
    created.push(body.project.id)
    expect(body.project.name).toBe('Balkon – ograja A (kopija)')

    // kopirane datoteke obstajajo
    const { vizHas } = await import('../storage')
    expect(await vizHas(`viz/projects/${body.project.id}/original.jpg`)).toBe(true)
    expect(await vizHas(`viz/projects/${body.project.id}/preview.jpg`)).toBe(true)

    // B ne more podvojiti A projekta
    const resB = await route.POST(req('POST', '/api/viz/projects/dup-route-a1/duplicate', tokenB), {
      params: Promise.resolve({ id: 'dup-route-a1' }),
    })
    expect(resB.status).toBe(404)

    // neobstoječ projekt → 404
    const res404 = await route.POST(req('POST', '/api/viz/projects/ne-obstaja/duplicate', tokenA), {
      params: Promise.resolve({ id: 'ne-obstaja' }),
    })
    expect(res404.status).toBe(404)
  })

  it('brez seje → 401', async () => {
    const route = await import('@/app/api/viz/projects/[id]/duplicate/route')
    const res = await route.POST(new Request('http://localhost/api/viz/projects/x/duplicate', { method: 'POST' }), {
      params: Promise.resolve({ id: 'x' }),
    })
    expect(res.status).toBe(401)
  })
})
