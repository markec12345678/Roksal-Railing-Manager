'use client'

/**
 * VIZ — tipiziran odjemalec za /api/viz/* (runda S+2).
 * Oblike odgovorov: docs/VIZ_CONTRACTS.md (VIR RESNICE) + src/lib/viz/types.ts.
 *
 * Pomembno: vedno RELATIVNE poti (sandbox gateway prepoveduje absolutne URL-je)
 * in brez številke porta.
 */

import type {
  StageResult,
  VizPlacement,
  VizPreviewResponse,
  VizProjectDetail,
  VizProjectSummary,
  VizStageKind,
} from '@/lib/viz/types'

/** Vrže Error z sporočilom iz { error } telesa (ali HTTP statusom). */
async function jsonOrError<T>(res: Response): Promise<T> {
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    // prazno / ne-JSON telo — spodaj uporabimo status
  }
  if (!res.ok) {
    const msg =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Napaka strežnika (${res.status})`
    throw new Error(msg)
  }
  return data as T
}

/**
 * §22 — PRIJAZNO sporočilo za uporabnika iz napake.
 * Tehnične podrobnosti gredo v developer konzolo; uporabnik dobi
 * razumljivost akcijo ("poskusite ponovno").
 */
export function friendlyError(e: unknown, context: 'stage' | 'preview' | 'save' | 'delete' | 'duplicate' | 'generic' = 'generic'): string {
  if (e instanceof Error && e.message) {
    // Znana uporabniška napaka (400 z razumljivim sporočilom iz API-ja) — pokaži neposredno.
    if (/naloži|nariši|izvedi predogled|najprej|prevelika|Nepodprt format|obvezno|predolg/i.test(e.message)) {
      return e.message
    }
  }
  switch (context) {
    case 'stage':
      return 'Fotografije trenutno ni mogoče obdelati. Poskusite ponovno.'
    case 'preview':
      return 'Predogleda trenutno ni mogoče pripraviti. Poskusite ponovno.'
    case 'save':
      return 'Projekta trenutno ni mogoče shraniti. Poskusite ponovno.'
    case 'delete':
      return 'Projekta trenutno ni mogoče izbrisati. Poskusite ponovno.'
    case 'duplicate':
      return 'Projekta trenutno ni mogoče podvojiti. Poskusite ponovno.'
    default:
      return 'Prišlo je do napake. Poskusite ponovno.'
  }
}

/**
 * §23 — RAZLIKOVANA sporočila nalaganja (uporabnik ve, kaj se dogaja):
 *   upload → "Pripravljam fotografijo …"
 *   preview → "Pripravljam predogled …"
 *   GPU finish → "Ustvarjam realistično končno vizualizacijo …"
 */
export const LOADING_TEXT = {
  upload: 'Pripravljam fotografijo …',
  preview: 'Pripravljam predogled …',
  gpu: 'Ustvarjam realistično končno vizualizacijo …',
} as const

/** POST /api/viz/stage (multipart) — naloži sliko/masko v staging in vrne token + url. */
export async function stageImage(file: Blob, kind: VizStageKind, filename?: string): Promise<StageResult> {
  const fd = new FormData()
  const name =
    filename ??
    (kind === 'productMask' || kind === 'mask'
      ? 'mask.png'
      : kind === 'product'
        ? 'product.jpg'
        : 'balcony.jpg')
  fd.append('file', file, name)
  fd.append('kind', kind)
  const res = await fetch('/api/viz/stage', { method: 'POST', body: fd })
  return jsonOrError<StageResult>(res)
}

export interface PreviewRequestBody {
  originalToken: string
  productToken: string
  productMaskToken: string | null
  maskToken: string
  placement: VizPlacement
}

/** POST /api/viz/preview — A-pipeline (geometrija + klasična sinteza, NI AI). */
export async function runPreview(body: PreviewRequestBody): Promise<VizPreviewResponse> {
  const res = await fetch('/api/viz/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return jsonOrError<VizPreviewResponse>(res)
}

/** GET /api/viz/projects — seznam shranjenih projektov (novejši najprej, max 50). */
export async function listProjects(): Promise<VizProjectSummary[]> {
  const res = await fetch('/api/viz/projects')
  const data = await jsonOrError<{ projects: VizProjectSummary[] }>(res)
  return data.projects ?? []
}

/** GET /api/viz/projects/[id] — podrobnosti (placement + variants razčlenjeni). */
export async function getProject(id: string): Promise<VizProjectDetail> {
  const res = await fetch(`/api/viz/projects/${encodeURIComponent(id)}`)
  const data = await jsonOrError<{ project: VizProjectDetail }>(res)
  return data.project
}

/** DELETE /api/viz/projects/[id] — pobriše vrstico + datoteke. */
export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`/api/viz/projects/${encodeURIComponent(id)}`, { method: 'DELETE' })
  await jsonOrError<{ ok: boolean }>(res)
}

export interface DuplicateProjectResponse {
  project: {
    id: string
    name: string
    createdAt: string
  }
}

/** POST /api/viz/projects/[id]/duplicate — S+5: podvoji projekt (isti lastnik). */
export async function duplicateProject(id: string): Promise<DuplicateProjectResponse> {
  const res = await fetch(`/api/viz/projects/${encodeURIComponent(id)}/duplicate`, { method: 'POST' })
  return jsonOrError<DuplicateProjectResponse>(res)
}

export interface CreateVariantBody {
  label: string
  productToken: string
  productMaskToken: string | null
}

export interface CreateProjectBody {
  name: string
  stagingToken: string
  /** VARIANTI se shrani SAMO ob prvem shranjevanju (premik staging → project);
   *  kasnejše dodajanje variant pri že shranjenem projektu poenostavljeno izpustimo
   *  (varianti živita v store-u z lastnim predogledom prek /api/viz/preview). */
  variants?: CreateVariantBody[]
}

export interface CreateProjectResponse {
  projectId: string
  urls: Record<string, string>
}

/** POST /api/viz/projects — premakne staging v projekt in ustvari VizProject. */
export async function createProject(body: CreateProjectBody): Promise<CreateProjectResponse> {
  const res = await fetch('/api/viz/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return jsonOrError<CreateProjectResponse>(res)
}

export interface RenderJobResponse {
  jobId: string
  status: string
}

/** POST /api/viz/render — GPU job stub (Qwen NI v produkciji; iskreno stanje "queued"). */
export async function requestRender(projectId: string): Promise<RenderJobResponse> {
  const res = await fetch('/api/viz/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId }),
  })
  return jsonOrError<RenderJobResponse>(res)
}

export interface RenderJobStatus {
  jobId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  resultPath: string | null
  error: string | null
}

/** GET /api/viz/render/[jobId] — status posla. */
export async function getRenderJob(jobId: string): Promise<RenderJobStatus> {
  const res = await fetch(`/api/viz/render/${encodeURIComponent(jobId)}`)
  return jsonOrError<RenderJobStatus>(res)
}
