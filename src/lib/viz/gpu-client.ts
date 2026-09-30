/**
 * VIZ — GPU backend klient (R319, S+7). Spec: docs/VIZ_CONTRACTS.md + gpu-backend/app/main.py.
 *
 * NAMEN: prej je POST /api/viz/render pošiljal NAPAČEN payload ({jobId, engine,
 * fileUrls} — neustrezen pogodbi §20, ki zahteva base64 original/product/aPreview)
 * IN rezultat ni imel polling zanke (status 'processing' za vedno). Ta klient
 * je ENA točka resnice za pogovor z GPU strežnikom:
 *   • S+7 avtentikacija: glava X-API-Key iz VIZ_GPU_TOKEN (konstantno-časna
 *     primerjava je na strani strežnika; mi žetona NIKOLI ne logiramo).
 *   • Fail-closed konfiguracija: VIZ_GPU_URL brez VIZ_GPU_TOKEN = NE DELUJE
 *     (gpuConfigured() vrne false — ruta odkloni z iskreno napako, NE pošilja
 *     brez avtentikacije).
 *   • Vsaka napaka je TIPIZIRANA (GpuClientError) — klicna koda se odloči
 *     po VRSTI (not-found = dokončno failed; unreachable/http = prehodno,
 *     stanje NE dotikaj).
 *
 * SAMO strežniška raba (route handlerji) — modul ne sme priti v client bundle.
 */

/** Pogodba §20 — POST /render zahteva (neposreden preslikava RenderRequest). */
export interface GpuRenderRequest {
  projectId: string
  /** base64 (brez data: prefixa) originalne fotografije. */
  original: string
  /** base64 referenčnega produkta (ograja). */
  product: string
  /** base64 maske (record-only na GPU, §20) — neobvezno. */
  mask?: string
  /** base64 A-pipeline predogleda — za mode 'finalize' (primarni). */
  aPreview?: string
  /** 'finalize' (ima aPreview) | 'compose' | 'auto'. */
  mode?: 'finalize' | 'compose' | 'auto'
  /** { corners } kot v placement.json (gpu schemas.Placement). */
  placement?: { corners?: unknown } | null
  prompt?: string
  /** 0 = GPU izbere naključni seed in ga ZABELEŽI (§18). */
  seed?: number
  resolution?: 'preview' | 'final'
  steps?: number
  trueCfg?: number
}

export interface GpuJobStatusResponse {
  jobId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  error?: string | null
}

/** Tipizirana napaka klienta — vrsta odloča, ali je prehodna ali dokončna. */
export type GpuClientErrorKind = 'unreachable' | 'timeout' | 'http' | 'not-found'

export class GpuClientError extends Error {
  readonly kind: GpuClientErrorKind
  readonly status?: number

  constructor(kind: GpuClientErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'GpuClientError'
    this.kind = kind
    this.status = status
  }
}

/** Timeouti (ms) — upload base64 je počasnejši, download PNG tudi. */
const GPU_TIMEOUT_RENDER_MS = 15_000
const GPU_TIMEOUT_STATUS_MS = 5_000
const GPU_TIMEOUT_RESULT_MS = 30_000

/** Fail-closed: GPU je konfiguriran SAMO, če sta OBA env nastavljena (S+7). */
export function gpuConfigured(): boolean {
  return Boolean(process.env.VIZ_GPU_URL && process.env.VIZ_GPU_TOKEN)
}

function gpuBase(): string {
  return (process.env.VIZ_GPU_URL ?? '').replace(/\/+$/, '')
}

function gpuHeaders(json: boolean): Record<string, string> {
  const headers: Record<string, string> = { 'X-API-Key': process.env.VIZ_GPU_TOKEN ?? '' }
  if (json) headers['content-type'] = 'application/json'
  return headers
}

/** Log napake BREZ žetona (glave se NE izpisujejo — samo status/vrsta). */
function describeFailure(where: string, status: number): string {
  return `GPU ${where} je vrnil HTTP ${status}`
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { detail?: unknown } | { error?: unknown }
    const detail = 'detail' in data ? data.detail : 'error' in data ? data.error : undefined
    if (typeof detail === 'string' && detail.length > 0 && detail.length <= 300) return detail
  } catch {
    // prazno/ne-JSON telo — uporabi status
  }
  return ''
}

/** POST /render → 202 { jobId, status } (pogodba §20). */
export async function gpuRenderJob(req: GpuRenderRequest): Promise<{ jobId: string; status: string }> {
  let res: Response
  try {
    res = await fetch(`${gpuBase()}/render`, {
      method: 'POST',
      headers: gpuHeaders(true),
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(GPU_TIMEOUT_RENDER_MS),
    })
  } catch (error) {
    throw wrapNetworkError(error, 'render')
  }
  if (res.status === 401 || res.status === 503) {
    // S+7: avtentikacija/ključ — ne-poslan job je dokončno zavrnjen
    throw new GpuClientError('http', `GPU je zavrnil zahtevo (S+7 avtentikacija): HTTP ${res.status}`, res.status)
  }
  if (!res.ok) {
    const detail = await parseError(res)
    throw new GpuClientError('http', detail || describeFailure('render', res.status), res.status)
  }
  const data = (await res.json()) as { jobId?: unknown; status?: unknown }
  if (typeof data.jobId !== 'string' || data.jobId.length < 8) {
    throw new GpuClientError('http', 'GPU odgovor nima veljavnega jobId (pogodba §20)')
  }
  return { jobId: data.jobId, status: typeof data.status === 'string' ? data.status : 'queued' }
}

/** GET /jobs/{id} → status (pogodba §20); 404 = GPU NE pozna joba (restart/TTL). */
export async function gpuJobStatus(gpuJobId: string): Promise<GpuJobStatusResponse> {
  let res: Response
  try {
    res = await fetch(`${gpuBase()}/jobs/${encodeURIComponent(gpuJobId)}`, {
      headers: gpuHeaders(false),
      signal: AbortSignal.timeout(GPU_TIMEOUT_STATUS_MS),
    })
  } catch (error) {
    throw wrapNetworkError(error, 'status')
  }
  if (res.status === 404) {
    throw new GpuClientError('not-found', 'GPU strežnik ne pozna joba (ponovni zagon / TTL?)', 404)
  }
  if (res.status === 401 || res.status === 503) {
    throw new GpuClientError('http', `GPU je zavrnil poizvedbo (S+7): HTTP ${res.status}`, res.status)
  }
  if (!res.ok) {
    const detail = await parseError(res)
    throw new GpuClientError('http', detail || describeFailure('status', res.status), res.status)
  }
  const data = (await res.json()) as { jobId?: unknown; status?: unknown; error?: unknown }
  if (typeof data.status !== 'string' || !['queued', 'processing', 'completed', 'failed'].includes(data.status)) {
    throw new GpuClientError('http', 'GPU status ni veljaven (pogodba §20)')
  }
  return {
    jobId: typeof data.jobId === 'string' ? data.jobId : gpuJobId,
    status: data.status as GpuJobStatusResponse['status'],
    error: typeof data.error === 'string' ? data.error : null,
  }
}

/** GET /jobs/{id}/result → PNG bajti (SAMO za status completed). */
export async function gpuJobResultPng(gpuJobId: string): Promise<Buffer> {
  let res: Response
  try {
    res = await fetch(`${gpuBase()}/jobs/${encodeURIComponent(gpuJobId)}/result`, {
      headers: gpuHeaders(false),
      signal: AbortSignal.timeout(GPU_TIMEOUT_RESULT_MS),
    })
  } catch (error) {
    throw wrapNetworkError(error, 'result')
  }
  if (res.status === 404) {
    throw new GpuClientError('not-found', 'GPU rezultat ni (več) na voljo (TTL?)', 404)
  }
  if (!res.ok) {
    const detail = await parseError(res)
    throw new GpuClientError('http', detail || describeFailure('result', res.status), res.status)
  }
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.startsWith('image/png')) {
    throw new GpuClientError('http', `GPU rezultat ni PNG (content-type: ${contentType || 'neznano'})`)
  }
  return Buffer.from(await res.arrayBuffer())
}

function wrapNetworkError(error: unknown, where: string): GpuClientError {
  if (error instanceof Error && error.name === 'TimeoutError') {
    return new GpuClientError('timeout', `GPU ${where} je potekel (timeout)`)
  }
  return new GpuClientError('unreachable', `GPU strežnik ni dosegljiv (${where})`)
}
