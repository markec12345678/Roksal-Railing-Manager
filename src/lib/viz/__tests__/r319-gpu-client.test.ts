/**
 * R319 (S+7) — testi GPU klienta (src/lib/viz/gpu-client.ts).
 *
 * Pokritost (fail-closed ×7):
 *   • gpuConfigured: SAMO z obema env (URL + žeton); URL brez žetona = false
 *   • gpuRenderJob: pravilen URL + glava X-API-Key + JSON telo; 202 → jobId
 *   • gpuRenderJob: 401/503 (S+7 odklon) → GpuClientError http
 *   • gpuJobStatus: 200 → status; 404 → kind 'not-found' (dokončno)
 *   • gpuJobResultPng: 200 image/png → Buffer; napačen content-type → napaka
 *   • omrežna napaka → kind 'unreachable' (prehodno)
 *   • žeton NIKOLI v URL-ju (samo v glavi — ne prišteva se v loge)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('VIZ_GPU_URL', 'https://gpu.example.com/')
  vi.stubEnv('VIZ_GPU_TOKEN', 'skrivni-zeton-r319')
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('gpuConfigured — fail-closed konfiguracija', () => {
  it('true SAMO z obema env (URL + žeton)', async () => {
    const { gpuConfigured } = await import('../gpu-client')
    expect(gpuConfigured()).toBe(true)
  })

  it('URL brez žetona = false (NE pošiljaj brez avtentikacije)', async () => {
    vi.stubEnv('VIZ_GPU_TOKEN', '')
    const { gpuConfigured } = await import('../gpu-client')
    expect(gpuConfigured()).toBe(false)
  })

  it('brez URL = false (tudi s prisotnim žetonom)', async () => {
    vi.stubEnv('VIZ_GPU_URL', '')
    const { gpuConfigured } = await import('../gpu-client')
    expect(gpuConfigured()).toBe(false)
  })
})

describe('gpuRenderJob — POST /render (pogodba §20)', () => {
  it('pošlje pravilen URL, glavo X-API-Key in base64 telo; 202 → jobId', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(202, { jobId: 'gpu-job-12345678', status: 'queued' }))
    const { gpuRenderJob } = await import('../gpu-client')

    const out = await gpuRenderJob({
      projectId: 'viz-proj-1',
      original: 'b3JpZ2luYWw=',
      product: 'cHJvZHVrdA==',
      mode: 'finalize',
      aPreview: 'cHJldmlldw==',
      resolution: 'final',
    })

    expect(out).toEqual({ jobId: 'gpu-job-12345678', status: 'queued' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    // URL: BREZ žetona (le v glavi); brez podvojenega sledilnega poševnice.
    expect(url).toBe('https://gpu.example.com/render')
    expect(String(url)).not.toContain('skrivni-zeton')
    const headers = init.headers as Record<string, string>
    expect(headers['X-API-Key']).toBe('skrivni-zeton-r319')
    expect(headers['content-type']).toBe('application/json')
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body.projectId).toBe('viz-proj-1')
    expect(body.original).toBe('b3JpZ2luYWw=')
    expect(body.mode).toBe('finalize')
    expect(body.resolution).toBe('final')
  })

  it('401 (S+7 odklon) → GpuClientError http (dokončno NE-poslan)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { detail: 'neveljaven ali manjkajoč X-API-Key' }))
    const { gpuRenderJob, GpuClientError } = await import('../gpu-client')

    let uhvacen: unknown
    try {
      await gpuRenderJob({ projectId: 'p', original: 'b2I=', product: 'cHJvZA==', resolution: 'final' })
    } catch (e) {
      uhvacen = e
    }
    expect(uhvacen).toBeInstanceOf(GpuClientError)
    const err = uhvacen as InstanceType<typeof GpuClientError>
    expect(err.kind).toBe('http')
    expect(err.status).toBe(401)
    expect(err.message).not.toContain('skrivni-zeton') // žeton NIKOLI v sporocilu
  })

  it('odgovor brez jobId → GpuClientError http (neveljavna pogodba)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(202, { status: 'queued' }))
    const { gpuRenderJob } = await import('../gpu-client')

    await expect(
      gpuRenderJob({ projectId: 'p', original: 'b2I=', product: 'cHJvZA==', resolution: 'final' })
    ).rejects.toThrow('jobId')
  })

  it('omrežna napaka → kind unreachable (prehodno)', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    const { gpuRenderJob, GpuClientError } = await import('../gpu-client')

    await expect(
      gpuRenderJob({ projectId: 'p', original: 'b2I=', product: 'cHJvZA==', resolution: 'final' })
    ).rejects.toSatisfy((e: unknown) => e instanceof GpuClientError && e.kind === 'unreachable')
  })
})

describe('gpuJobStatus — GET /jobs/{id}', () => {
  it('200 → status in error iz telesa', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { jobId: 'gpu-job-12345678', status: 'processing', error: null })
    )
    const { gpuJobStatus } = await import('../gpu-client')

    const st = await gpuJobStatus('gpu-job-12345678')
    expect(st).toEqual({ jobId: 'gpu-job-12345678', status: 'processing', error: null })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://gpu.example.com/jobs/gpu-job-12345678')
    expect((init.headers as Record<string, string>)['X-API-Key']).toBe('skrivni-zeton-r319')
  })

  it('404 → kind not-found (GPU pozabil job — dokončno)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { detail: 'neznan jobId' }))
    const { gpuJobStatus, GpuClientError } = await import('../gpu-client')

    await expect(gpuJobStatus('gpu-job-1')).rejects.toSatisfy(
      (e: unknown) => e instanceof GpuClientError && e.kind === 'not-found'
    )
  })

  it('neznan status v telesu → GpuClientError http (pogodbena higiena)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { jobId: 'x', status: 'cudno-stanje' }))
    const { gpuJobStatus } = await import('../gpu-client')

    await expect(gpuJobStatus('x')).rejects.toThrow('status')
  })
})

describe('gpuJobResultPng — GET /jobs/{id}/result', () => {
  it('200 image/png → Buffer bajtov', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    fetchMock.mockResolvedValueOnce(
      new Response(png, { status: 200, headers: { 'content-type': 'image/png' } })
    )
    const { gpuJobResultPng } = await import('../gpu-client')

    const buf = await gpuJobResultPng('gpu-job-12345678')
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.equals(Buffer.from(png))).toBe(true)
  })

  it('napačen content-type → GpuClientError http (NE zaupaj telesu)', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('napaka', { status: 200, headers: { 'content-type': 'text/plain' } })
    )
    const { gpuJobResultPng } = await import('../gpu-client')

    await expect(gpuJobResultPng('gpu-job-1')).rejects.toThrow('PNG')
  })
})
