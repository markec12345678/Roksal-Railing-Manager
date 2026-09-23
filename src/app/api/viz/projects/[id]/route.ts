// VIZ — /api/viz/projects/[id] (runda S+2, storage driver runda S+3). Spec: docs/VIZ_CONTRACTS.md
//   GET    — detail (placement + variants parsed, urls map)
//   PATCH  — samo preimenovanje: { name }
//   DELETE — zbriše metadata zapis + projektne datoteke iz shrambe
// Metadata: local = Prisma, blob = project.json v Vercel Blob (repository).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { vizOwner } from '@/lib/viz/ownership'
import type { VizPlacement, VizVariant } from '@/lib/viz/types'
import { VIZ_FILE_NAMES, clientUrlFor, clientUrlForPath, projectKey, vizDelPrefix } from '@/lib/viz/storage'
import {
  deleteProject,
  getProjectForOwner,
  renameProjectForOwner,
  type VizProjectRecord,
} from '@/lib/viz/repository'

export const runtime = 'nodejs'

const renameSchema = z.object({
  name: z.string().trim().min(1, 'Ime projekta je obvezno').max(120, 'Ime je predolgo'),
})

function parseJsonOrNull<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** URL placement.json za klienta (S+4: vedno proxy, brez head klica). */
async function placementUrl(id: string): Promise<string> {
  return clientUrlFor(projectKey(id, VIZ_FILE_NAMES.placement))
}

/** Sestavi odgovor z parsed placement/variants + urls map. */
async function serializeProject(rec: VizProjectRecord) {
  const urls = {
    original: rec.originalPath,
    product: rec.productPath,
    productMask: rec.productMaskPath,
    mask: rec.maskPath,
    placement: await placementUrl(rec.id),
    preview: rec.previewPath,
    result: rec.resultPath,
    resultImage: rec.resultImagePath,
  }
  return {
    id: rec.id,
    name: rec.name,
    originalPath: rec.originalPath,
    productPath: rec.productPath,
    productMaskPath: rec.productMaskPath,
    maskPath: rec.maskPath,
    previewPath: rec.previewPath,
    resultPath: rec.resultPath,
    resultImagePath: rec.resultImagePath,
    placement: parseJsonOrNull<VizPlacement>(rec.placement),
    variants: parseJsonOrNull<VizVariant[]>(rec.variants) ?? [],
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
    urls,
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // S+4: tuj projekt = 404 (ne 403) — ne puščamo informacije o obstoju.
  const ctx = await vizOwner(request)
  if (ctx instanceof Response) return ctx
  try {
    const { id } = await params
    const rec = await getProjectForOwner(id, ctx)
    if (!rec) {
      return NextResponse.json({ error: 'Projekt ne obstaja' }, { status: 404 })
    }
    return NextResponse.json({ project: await serializeProject(rec) })
  } catch (error) {
    console.error('Viz project GET error:', error)
    return NextResponse.json({ error: 'Napaka pri branju projekta' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // S+4: samo lastnik sme preimenovati; tuj projekt = 404.
  const ctx = await vizOwner(request)
  if (ctx instanceof Response) return ctx
  try {
    const { id } = await params
    const body = await request.json().catch(() => null)
    const parsed = renameSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Neveljavni podatki za preimenovanje', details: parsed.error.issues },
        { status: 400 }
      )
    }
    const rec = await renameProjectForOwner(id, parsed.data.name, ctx)
    if (!rec) {
      return NextResponse.json({ error: 'Projekt ne obstaja' }, { status: 404 })
    }
    return NextResponse.json({ project: await serializeProject(rec) })
  } catch (error) {
    console.error('Viz project PATCH error:', error)
    return NextResponse.json({ error: 'Napaka pri preimenovanju projekta' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // S+4: samo lastnik sme brisati; tuj projekt = 404.
  const ctx = await vizOwner(request)
  if (ctx instanceof Response) return ctx
  try {
    const { id } = await params
    // Najprej metadata z lastniško preverbo (404, če ne obstaja ALI ni tvoj),
    // nato datoteke iz shrambe.
    const rec = await getProjectForOwner(id, ctx)
    if (!rec) {
      return NextResponse.json({ error: 'Projekt ne obstaja' }, { status: 404 })
    }
    await deleteProject(id)
    await vizDelPrefix(`viz/projects/${id}/`)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Viz project DELETE error:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju projekta' }, { status: 500 })
  }
}
