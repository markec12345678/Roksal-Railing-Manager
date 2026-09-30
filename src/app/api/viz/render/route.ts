// VIZ — POST /api/viz/render — GPU job (Qwen-Image-Edit-2509).
// Spec: docs/VIZ_CONTRACTS.md — Qwen NI production kritičen: A-pipeline
// predogled (determinističen, brez AI) je VEDNO na voljo.
//
// R319 (S+7) — GPU integracija ZAPRTÁ:
//   • Prej: payload {jobId, engine, fileUrls} NEUSTREZEN pogodbi §20 (GPU
//     zahteva base64 original/product/aPreview) + rezultat brez polling
//     zanke (status 'processing' za vedno).
//   • Zdaj: slike preberemo iz viz shrambe → base64 → veljaven RenderRequest
//     (mode: finalize če obstaja A-predogled, sicer compose); odgovor jobId
//     shranimo v VizRenderJob.gpuJobId; končno stanje preverja poll-on-read
//     v GET ruti (nikoli lažno 'completed').
//   • S+7: glava X-API-Key iz VIZ_GPU_TOKEN; URL brez žetona = fail-closed
//     odklon (NE pošiljaj brez avtentikacije).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { vizOwner } from '@/lib/viz/ownership'
import { createRenderJob, getProjectForOwner, transitionRenderJob } from '@/lib/viz/repository'
import { vizGet } from '@/lib/viz/storage'
import { gpuConfigured, gpuRenderJob } from '@/lib/viz/gpu-client'

import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'
export const runtime = 'nodejs'

const renderSchema = z.object({
  projectId: z.string().min(1, 'projectId je obvezen'),
  prompt: z.string().trim().max(1000, 'Prompt je predolg').optional(),
})

const GPU_ERROR_UNSET = 'GPU backend ni nastavljen (VIZ_GPU_URL) — čaka na lasten GPU strežnik'
const GPU_ERROR_NO_TOKEN = 'GPU URL je nastavljen, žeton (VIZ_GPU_TOKEN) pa NI — fail-closed odklon (S+7)'

/** Prebere sliko iz viz shrambe in vrne base64 ( ali null če manjka). */
async function readAsBase64(key: string | null | undefined): Promise<string | null> {
  if (!key) return null
  const buf = await vizGet(key)
  return buf ? buf.toString('base64') : null
}

export async function POST(request: Request) {
  // R190 — val 1 omejevanja hitrosti na pisanju (WRITE_LIMIT, kind `write`)
  const zavrnjeno = zapisOmejitev(request, 'viz/render')
  if (zavrnjeno) return zavrnjeno
  // S+4: render job je vezan na prijavljenega uporabnika; tuj projekt = 404.
  const ctx = await vizOwner(request)
  if (ctx instanceof Response) return ctx
  try {
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const parsed = renderSchema.safeParse(telo.telo)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Neveljavni podatki za render', details: parsed.error.issues },
        { status: 400 }
      )
    }
    const { projectId, prompt } = parsed.data

    const project = await getProjectForOwner(projectId, ctx)
    if (!project) {
      return NextResponse.json({ error: 'Projekt ne obstaja' }, { status: 404 })
    }

    const engine = 'qwen-image-edit-2509'
    const inputJson = JSON.stringify({
      projectId,
      prompt: prompt ?? null,
      engine,
      placement: (() => {
        try {
          return JSON.parse(project.placement)
        } catch {
          return null
        }
      })(),
      files: {
        original: project.originalPath,
        product: project.productPath,
        productMask: project.productMaskPath,
        mask: project.maskPath,
        preview: project.previewPath,
      },
      note: 'Qwen-Image-Edit-2509 — GPU integracija R319 (S+7)',
    })

    const job = await createRenderJob({ projectId, ownerId: ctx.ownerId, status: 'queued', engine, inputJson })

    let gpuError: string | null = GPU_ERROR_UNSET
    const gpuUrl = process.env.VIZ_GPU_URL
    const gpuToken = process.env.VIZ_GPU_TOKEN
    if (gpuUrl && !gpuToken) {
      // S+7 fail-closed: NE pošiljaj brez avtentikacije — odklon z iskreno napako.
      gpuError = GPU_ERROR_NO_TOKEN
    } else if (gpuUrl && gpuToken) {
      // R319: preberi slike iz shrambe → base64 (pogodba §20).
      const [original, product, mask, aPreview] = await Promise.all([
        readAsBase64(project.originalPath),
        readAsBase64(project.productPath),
        readAsBase64(project.productMaskPath ?? project.maskPath),
        readAsBase64(project.previewPath),
      ])
      if (!original || !product) {
        gpuError = 'Izhodne slike manjkajo v shrambi — GPU job ni poslan (projekt shranjen?)'
      } else {
        // finalize (primarni) iz A-predogleda; sicer compose iz originala.
        const mode = aPreview ? 'finalize' : 'compose'
        let placement: { corners?: unknown } | null = null
        try {
          const parsedPlacement = JSON.parse(project.placement) as { corners?: unknown }
          placement = parsedPlacement && typeof parsedPlacement === 'object' ? { corners: parsedPlacement.corners } : null
        } catch {
          placement = null
        }
        try {
          const accepted = await gpuRenderJob({
            projectId: project.id,
            original,
            product,
            mask: mask ?? undefined,
            aPreview: aPreview ?? undefined,
            mode,
            placement,
            prompt: prompt ?? undefined,
            resolution: 'final',
          })
          // S+4 sodobno varen prehod queued → processing + ZAPIŠI gpuJobId
          // (poll-on-read v GET ruti ga rabi za poizvedbo stanja).
          const outcome = await transitionRenderJob(job.id, {
            status: 'processing',
            error: null,
            gpuJobId: accepted.jobId,
          })
          return NextResponse.json({
            jobId: outcome.ok ? outcome.job.id : job.id,
            status: outcome.ok ? outcome.job.status : 'queued',
            gpuJobId: accepted.jobId,
            duplicate: outcome.ok ? outcome.duplicate : false,
          })
        } catch (error) {
          gpuError =
            error instanceof Error
              ? `GPU strežnik ni sprejel joba — ${error.message} — job ostaja v vrsti`
              : 'GPU strežnik ni sprejel joba — job ostaja v vrsti'
        }
      }
    }

    if (gpuError) {
      // Patch brez statusa — samo opomba, ni prehoda (državni stroj ne prizadet).
      await transitionRenderJob(job.id, { error: gpuError })
    }

    return NextResponse.json({ jobId: job.id, status: 'queued' })
  } catch (error) {
    console.error('Viz render POST error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju render joba' }, { status: 500 })
  }
}
