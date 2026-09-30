// VIZ — GET /api/viz/render/[jobId] — status render joba + poll-on-read.
// Spec: docs/VIZ_CONTRACTS.md → { jobId, status, resultPath, resultUrl, error }
//
// R319 (S+7) — POLL-ON-READ: končni status 'completed' nastavimo SAMO na
// dokaz GPU strežnika. Vsak GET, ki vidi joba v 'queued'/'processing' Z
// shranjenim gpuJobId, naredi ENO poizvedbo na GPU:
//   • completed → prenese PNG v viz shrambo (renderResultKey) → prehod
//     processing → completed z resultPath. NIKOLI lažno completed.
//   • failed → prehod processing → failed z iskreno napako.
//   • queued/processing na GPUju → stanje pusti (naslednji GET posodobi).
//   • 404 na GPUju (restart/TTL) → dokončno failed (joba ni več mogoče
//     izvedeti — iskrenost > neskončno vrtiljak).
//   • unreachable/timeout/http → PREHODNA napaka: stanje NE dotikamo
//     (naslednji GET poskusi znova).
import { NextResponse } from 'next/server'
import { vizOwner } from '@/lib/viz/ownership'
import { getRenderJobForOwner, transitionRenderJob, type VizRenderJobRecord } from '@/lib/viz/repository'
import { clientUrlForPath, renderResultKey, vizPut } from '@/lib/viz/storage'
import { GpuClientError, gpuConfigured, gpuJobResultPng, gpuJobStatus } from '@/lib/viz/gpu-client'

export const runtime = 'nodejs'

/** R319 — en korak poll-on-read zanke; vrača (morebitno) posodobljen joba. */
async function pollGpuOnce(job: VizRenderJobRecord): Promise<VizRenderJobRecord> {
  if (!gpuConfigured() || !job.gpuJobId) return job
  if (job.status !== 'queued' && job.status !== 'processing') return job

  let status: Awaited<ReturnType<typeof gpuJobStatus>>
  try {
    status = await gpuJobStatus(job.gpuJobId)
  } catch (error) {
    if (error instanceof GpuClientError && error.kind === 'not-found') {
      // GPU je job izgubil (restart / TTL 6h) — iskreno dokončno failed.
      const outcome = await transitionRenderJob(job.id, {
        status: 'failed',
        error: `GPU strežnik ne pozna več joba (${error.message}) — ponovno zahtevajte izdelavo`,
      })
      return outcome.ok ? outcome.job : job
    }
    // unreachable / timeout / http — PREHODNO: stanje NE spreminjaj.
    return job
  }

  if (status.status === 'completed') {
    try {
      const png = await gpuJobResultPng(job.gpuJobId)
      const key = renderResultKey(job.id)
      await vizPut(key, png, 'image/png')
      // Zakoniti prehodi: queued → processing → completed (državni stroj).
      if (job.status === 'queued') {
        await transitionRenderJob(job.id, { status: 'processing', gpuJobId: job.gpuJobId })
      }
      const outcome = await transitionRenderJob(job.id, { status: 'completed', resultPath: key, error: null })
      return outcome.ok ? outcome.job : job
    } catch (error) {
      // Prenos rezultata ni uspel — PREHODNO (GPU ima PNG, mi ga ne moremo
      // prenesti): stanje pusti, naslednji GET poskusi znova.
      console.error('Viz render poll-on-read prenos rezultata ni uspel:', error)
      return job
    }
  }

  if (status.status === 'failed') {
    if (job.status === 'queued') {
      await transitionRenderJob(job.id, { status: 'processing', gpuJobId: job.gpuJobId })
    }
    const outcome = await transitionRenderJob(job.id, {
      status: 'failed',
      error: status.error ?? 'GPU strežnik je javil neuspeh (brez podrobnosti)',
    })
    return outcome.ok ? outcome.job : job
  }

  // GPU še obdeluje (queued/processing) — iskreno stanje brez spremembe.
  return job
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  // S+4: tuj render job = 404 (ne 403).
  const ctx = await vizOwner(request)
  if (ctx instanceof Response) return ctx
  try {
    const { jobId } = await params
    let job = await getRenderJobForOwner(jobId, ctx)
    if (!job) {
      return NextResponse.json({ error: 'Render job ne obstaja' }, { status: 404 })
    }
    // R319: posodobi stanje iz GPU strežnika (en korak na GET).
    job = await pollGpuOnce(job)
    return NextResponse.json({
      jobId: job.id,
      status: job.status, // queued | processing | completed | failed
      resultPath: job.resultPath,
      resultUrl: job.status === 'completed' && job.resultPath ? clientUrlForPath(job.resultPath) : null,
      error: job.error,
    })
  } catch (error) {
    console.error('Viz render GET error:', error)
    return NextResponse.json({ error: 'Napaka pri branju render joba' }, { status: 500 })
  }
}
