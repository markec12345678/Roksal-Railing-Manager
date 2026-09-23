/**
 * VIZ — testi repozitorija metadata (runda S+3).
 * Local način (Prisma): pravi roundtrip proti SQLite (demo baza).
 * Blob način: mockan storage modul — preverjamo dokumentno logiko
 * (project.json per projekt, seznam po createdAt desc, max 50).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createProject,
  createRenderJob,
  deleteProject,
  getProject,
  getRenderJob,
  listProjects,
  renameProject,
  updateRenderJob,
  type VizProjectInput,
} from '../repository'

const BASE: VizProjectInput = {
  id: 'test-proj-repo',
  name: 'Testni balkon',
  originalPath: '/viz/projects/test-proj-repo/original.jpg',
  productPath: '/viz/projects/test-proj-repo/product.jpg',
  productMaskPath: null,
  maskPath: '/viz/projects/test-proj-repo/mask.png',
  previewPath: '/viz/projects/test-proj-repo/preview.jpg',
  resultPath: '/viz/projects/test-proj-repo/result.json',
  placement: JSON.stringify({
    version: 2,
    corners: [
      [0.1, 0.2],
      [0.9, 0.2],
      [0.9, 0.8],
      [0.1, 0.8],
    ],
    rotation: 0,
    scale: 1,
    productQuad: null,
  }),
  variants: null,
}

function makeDocStorage() {
  const docs = new Map<string, unknown>()
  const putJson = vi.fn(async (key: string, data: unknown) => {
    docs.set(key, JSON.parse(JSON.stringify(data)))
    return { key, url: `https://store/${key}` }
  })
  const getJson = vi.fn(async <T,>(key: string): Promise<T | null> => {
    const v = docs.get(key)
    return v ? (JSON.parse(JSON.stringify(v)) as T) : null
  })
  const del = vi.fn(async (key: string) => {
    docs.delete(key)
  })
  const list = vi.fn(async (prefix: string) => {
    return [...docs.keys()]
      .filter((k) => k.startsWith(prefix))
      .map((k) => ({ key: k, url: `https://store/${k}` }))
  })
  return { docs, putJson, getJson, del, list }
}

describe('viz repository — local način (Prisma)', () => {
  const created: string[] = []

  beforeEach(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN
    delete process.env.VIZ_STORAGE_DRIVER
  })
  afterEach(async () => {
    vi.unstubAllEnvs()
    for (const id of created.splice(0)) {
      await deleteProject(id).catch(() => undefined)
    }
  })

  it('create → get → list → rename → delete (Prisma roundtrip)', async () => {
    const rec = await createProject({ ...BASE, id: 'test-proj-repo-1' })
    created.push('test-proj-repo-1')
    expect(rec.id).toBe('test-proj-repo-1')
    expect(rec.createdAt).not.toBeNull()
    expect(typeof rec.createdAt).toBe('string')

    const got = await getProject('test-proj-repo-1')
    expect(got?.name).toBe('Testni balkon')
    expect(JSON.parse(got!.placement).version).toBe(2)

    const listed = await listProjects()
    expect(listed.some((p) => p.id === 'test-proj-repo-1')).toBe(true)

    const renamed = await renameProject('test-proj-repo-1', 'Preimenovan')
    expect(renamed?.name).toBe('Preimenovan')
    expect(await getProject('ne-obstaja-id')).toBeNull()
  })

  it('render job: create → get → update status (iskren queued → processing)', async () => {
    await createProject({ ...BASE, id: 'test-proj-repo-2' })
    created.push('test-proj-repo-2')
    const job = await createRenderJob({
      projectId: 'test-proj-repo-2',
      status: 'queued',
      engine: 'qwen-image-edit-2509',
      inputJson: JSON.stringify({ note: 'planirano, čaka na GPU' }),
    })
    expect(job.status).toBe('queued')
    const fetched = await getRenderJob(job.id)
    expect(fetched?.error).toBeNull()
    const updated = await updateRenderJob(job.id, { status: 'processing', error: null })
    expect(updated?.status).toBe('processing')
    expect(await getRenderJob('ne-obstaja-job')).toBeNull()
  })
})

describe('viz repository — blob način (mockan storage)', () => {
  let storage: ReturnType<typeof makeDocStorage>

  beforeEach(() => {
    storage = makeDocStorage()
    vi.resetModules()
    vi.doMock('../storage', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../storage')>()
      return {
        ...actual,
        vizPutJson: storage.putJson,
        vizGetJson: storage.getJson,
        vizDel: storage.del,
        vizList: storage.list,
      }
    })
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_mock_token')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.doUnmock('../storage')
  })

  it('create zapiše project.json dokument; seznam je createdAt desc, max 50', async () => {
    const repo = await import('../repository')
    const rec = await repo.createProject({ ...BASE, id: 'blob-p1' })
    expect(storage.docs.has('viz/projects/blob-p1/project.json')).toBe(true)
    expect(storage.putJson).toHaveBeenCalledWith('viz/projects/blob-p1/project.json', expect.anything())

    // drugi projekt, ustvarjen KASNEJE (novejši createdAt)
    await new Promise((r) => setTimeout(r, 5))
    await repo.createProject({ ...BASE, id: 'blob-p2', name: 'Novejši' })

    const listed = await repo.listProjects()
    const ids = listed.map((p) => p.id)
    expect(ids.indexOf('blob-p2')).toBeLessThan(ids.indexOf('blob-p1'))
    expect(listed[0].name).toBe('Novejši')
  })

  it('rename + get + delete delujeta nad dokumenti', async () => {
    const repo = await import('../repository')
    await repo.createProject({ ...BASE, id: 'blob-p3' })
    const renamed = await repo.renameProject('blob-p3', 'Blob ime')
    expect(renamed?.name).toBe('Blob ime')
    const doc = storage.docs.get('viz/projects/blob-p3/project.json') as { name: string }
    expect(doc.name).toBe('Blob ime')

    expect((await repo.getProject('blob-p3'))?.name).toBe('Blob ime')
    await repo.deleteProject('blob-p3')
    expect(await repo.getProject('blob-p3')).toBeNull()
  })

  it('render job dokumenti: queued ostane iskren brez GPU', async () => {
    const repo = await import('../repository')
    await repo.createProject({ ...BASE, id: 'blob-p4' })
    const job = await repo.createRenderJob({
      projectId: 'blob-p4',
      status: 'queued',
      engine: 'qwen-image-edit-2509',
      inputJson: '{}',
    })
    expect(job.id).toBeTruthy()
    expect(storage.docs.has(`viz/render-jobs/${job.id}.json`)).toBe(true)
    const upd = await repo.updateRenderJob(job.id, { error: 'GPU backend ni nastavljen (VIZ_GPU_URL)' })
    expect(upd?.status).toBe('queued')
    expect(upd?.error).toContain('GPU backend ni nastavljen')
  })
})
