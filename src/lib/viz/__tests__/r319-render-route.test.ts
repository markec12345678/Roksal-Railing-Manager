/**
 * R319 (S+7) — testi POLL-ON-READ v GET /api/viz/render/[jobId].
 *
 * Pravila (EN VIR resnice = ruta + državni stroj repository):
 *   1. GPU completed → PNG prenesen v shrambo → prehodi queued→processing→completed
 *      (zakonito zaporedje), resultPath NASTAVLJEN, odgovor completed + resultUrl.
 *   2. GPU failed → prehod failed z iskreno napako.
 *   3. GPU 404 (restart/TTL) → dokončno failed — joba ni več mogoče izvedeti.
 *   4. GPU unreachable (prehodno) → stanje NEspremenjeno (processing ostane).
 *   5. Job BREZ gpuJobId (zgodovina / GPU unset) → GPU se NE kliče (0 fetch).
 *   6. Tuj job → 404 (S+4 lastništvo — nespremenjeno obnašanje).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('VIZ_GPU_URL', 'https://gpu.example.com')
  vi.stubEnv('VIZ_GPU_TOKEN', 'skrivni-zeton-r319')
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
  vi.doUnmock('@/lib/viz/ownership')
  vi.doUnmock('@/lib/viz/repository')
  vi.doUnmock('@/lib/viz/storage')
  vi.doUnmock('@/lib/viz/gpu-client')
})

/** Enostavna in-memory shramba + kontrole za route test. */
function setupMocks(job: Record<string, unknown>) {
  const state: Record<string, unknown> = { ...job }
  const transitions: Array<Record<string, unknown>> = []
  const puts: Array<{ key: string; bytes: number }> = []

  vi.doMock('@/lib/viz/ownership', () => ({
    vizOwner: vi.fn(async () => ({ ownerId: 'owner-1', isAdmin: false })),
  }))
  vi.doMock('@/lib/viz/repository', () => ({
    getRenderJobForOwner: vi.fn(async () => state as never),
    transitionRenderJob: vi.fn(async (_id: string, patch: Record<string, unknown>) => {
      transitions.push(patch)
      Object.assign(state, patch)
      return { ok: true, job: state, duplicate: false }
    }),
  }))
  vi.doMock('@/lib/viz/storage', () => ({
    renderResultKey: (id: string) => `viz/render-jobs/${id}/result.png`,
    vizPut: vi.fn(async (key: string, data: Buffer) => {
      puts.push({ key, bytes: data.length })
      return { key, url: `/${key}` }
    }),
    clientUrlForPath: (p: string | null) => (p ? `/api/viz/files/${p}` : null),
  }))

  return { state, transitions, puts }
}

async function callGet(jobId: string): Promise<Response> {
  const mod = await import('@/app/api/viz/render/[jobId]/route')
  return mod.GET(new Request(`http://localhost/api/viz/render/${jobId}`), {
    params: Promise.resolve({ jobId }),
  })
}

const BASE_JOB = {
  id: 'job-r319-1',
  ownerId: 'owner-1',
  projectId: 'proj-1',
  status: 'processing',
  engine: 'qwen-image-edit-2509',
  inputJson: '{}',
  gpuJobId: 'gpu-job-12345678',
  resultPath: null,
  error: null,
  createdAt: '2026-09-30T12:00:00.000Z',
  updatedAt: '2026-09-30T12:00:00.000Z',
}

describe('R319 poll-on-read — GET /api/viz/render/[jobId]', () => {
  it('GPU completed → PNG v shrambo, zakonita prehoda, completed + resultUrl', async () => {
    const { state, transitions, puts } = setupMocks({ ...BASE_JOB })
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ jobId: 'gpu-job-12345678', status: 'completed' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      })
    )

    const res = await callGet('job-r319-1')
    const body = (await res.json()) as {
      status: string
      resultPath: string | null
      resultUrl: string | null
    }

    expect(res.status).toBe(200)
    expect(body.status).toBe('completed')
    expect(body.resultPath).toBe('viz/render-jobs/job-r319-1/result.png')
    expect(body.resultUrl).toBe('/api/viz/files/viz/render-jobs/job-r319-1/result.png')
    // Prehodi: processing → completed (job je ŽE bil processing — en prehod).
    expect(transitions).toEqual([
      { status: 'completed', resultPath: 'viz/render-jobs/job-r319-1/result.png', error: null },
    ])
    expect(puts).toEqual([{ key: 'viz/render-jobs/job-r319-1/result.png', bytes: 6 }])
    expect(state.status).toBe('completed')
  })

  it('GPU failed → prehod failed z iskreno napako', async () => {
    const { state, transitions } = setupMocks({ ...BASE_JOB })
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ jobId: 'gpu-job-12345678', status: 'failed', error: 'CUDA OOM' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )

    const res = await callGet('job-r319-1')
    const body = (await res.json()) as { status: string; error: string | null }

    expect(body.status).toBe('failed')
    expect(body.error).toBe('CUDA OOM')
    expect(transitions).toEqual([{ status: 'failed', error: 'CUDA OOM' }])
    expect(state.status).toBe('failed')
  })

  it('GPU 404 (restart/TTL) → dokončno failed z razumljivim vzrokom', async () => {
    const { state } = setupMocks({ ...BASE_JOB })
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'neznan jobId' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      })
    )

    const res = await callGet('job-r319-1')
    const body = (await res.json()) as { status: string; error: string | null }

    expect(body.status).toBe('failed')
    expect(body.error).toContain('ne pozna več joba')
    expect(state.status).toBe('failed')
  })

  it('GPU unreachable (prehodno) → stanje NEspremenjeno — naslednji GET poskusi znova', async () => {
    const { state, transitions, puts } = setupMocks({ ...BASE_JOB })
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))

    const res = await callGet('job-r319-1')
    const body = (await res.json()) as { status: string }

    expect(res.status).toBe(200)
    expect(body.status).toBe('processing')
    expect(transitions).toEqual([]) // NOPREHOD — prehodna napaka
    expect(puts).toEqual([])
    expect(state.status).toBe('processing')
  })

  it('job BREZ gpuJobId → GPU se NE kliče (0 fetch) — zgodovinski jobi nedotaknjeni', async () => {
    const { transitions } = setupMocks({ ...BASE_JOB, gpuJobId: null })

    const res = await callGet('job-r319-1')
    const body = (await res.json()) as { status: string; resultUrl: string | null }

    expect(body.status).toBe('processing')
    expect(body.resultUrl).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(transitions).toEqual([])
  })

  it('končan job (completed) → GPU se NE kliče (terminalna stanja nespremenljiva)', async () => {
    setupMocks({ ...BASE_JOB, status: 'completed', resultPath: 'viz/render-jobs/job-r319-1/result.png' })

    const res = await callGet('job-r319-1')
    const body = (await res.json()) as { status: string; resultUrl: string | null }

    expect(body.status).toBe('completed')
    expect(body.resultUrl).toBe('/api/viz/files/viz/render-jobs/job-r319-1/result.png')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('queued job z gpuJobId + GPU completed → DVA zakonita prehoda (queued→processing→completed)', async () => {
    const { transitions } = setupMocks({ ...BASE_JOB, status: 'queued' })
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ jobId: 'gpu-job-12345678', status: 'completed' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array([0x89, 0x50]), { status: 200, headers: { 'content-type': 'image/png' } })
    )

    const res = await callGet('job-r319-1')
    const body = (await res.json()) as { status: string }

    expect(body.status).toBe('completed')
    expect(transitions.map((t) => t.status)).toEqual(['processing', 'completed'])
  })
})
