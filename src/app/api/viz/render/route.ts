// VIZ — POST /api/viz/render — GPU job stub (Qwen-Image-Edit-2509).
// Spec: docs/VIZ_CONTRACTS.md — Qwen NI production: ustvari render job
// (status 'queued'). Če je VIZ_GPU_URL nastavljen, poskusi POST <url>/render
// s 3s timeoutom in ob uspehu nastavi status 'processing'; ob napaki/neznanem
// URL ostane 'queued' z iskrenim error zapiskom. Nikoli ne označimo 'completed'.
// Runda S+3: job metadata gre prek repositoryja (local = Prisma, blob = JSON
// v Vercel Blob) — iskrenost statusov se ne spremeni.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { vizOwner } from '@/lib/viz/ownership'
import { createRenderJob, getProjectForOwner, transitionRenderJob } from '@/lib/viz/repository'

export const runtime = 'nodejs'

const renderSchema = z.object({
  projectId: z.string().min(1, 'projectId je obvezen'),
  prompt: z.string().trim().max(1000, 'Prompt je predolg').optional(),
})

const GPU_ERROR_UNSET = 'GPU backend ni nastavljen (VIZ_GPU_URL) — čaka na lasten GPU strežnik'

export async function POST(request: Request) {
  // S+4: render job je vezan na prijavljenega uporabnika; tuj projekt = 404.
  const ctx = await vizOwner(request)
  if (ctx instanceof Response) return ctx
  try {
    const body = await request.json().catch(() => null)
    const parsed = renderSchema.safeParse(body)
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
      note: 'Qwen-Image-Edit-2509 — planirano, čaka na GPU strežnik',
    })

    const job = await createRenderJob({ projectId, ownerId: ctx.ownerId, status: 'queued', engine, inputJson })

    let gpuError: string | null = GPU_ERROR_UNSET
    const gpuUrl = process.env.VIZ_GPU_URL
    if (gpuUrl) {
      try {
        const res = await fetch(`${gpuUrl.replace(/\/+$/, '')}/render`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            jobId: job.id,
            projectId,
            engine,
            prompt: prompt ?? null,
            placement: project.placement,
            fileUrls: {
              original: project.originalPath,
              product: project.productPath,
              productMask: project.productMaskPath,
              mask: project.maskPath,
            },
          }),
          signal: AbortSignal.timeout(3000),
        })
        if (res.ok) {
          // S+4: sodobno varen prehod queued → processing (zaklep + državni stroj).
          const outcome = await transitionRenderJob(job.id, { status: 'processing', error: null })
          return NextResponse.json({
            jobId: outcome.ok ? outcome.job.id : job.id,
            status: outcome.ok ? outcome.job.status : 'queued',
            duplicate: outcome.ok ? outcome.duplicate : false,
          })
        }
        gpuError = `GPU strežnik je vrnil napako HTTP ${res.status} — job ostaja v vrsti`
      } catch {
        gpuError = 'GPU strežnik ni dosegljiv — job ostaja v vrsti'
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
