// VIZ — /api/viz/projects/[id] (runda S+2). Spec: docs/VIZ_CONTRACTS.md
//   GET    — detail (placement + variants parsed, urls map)
//   PATCH  — samo preimenovanje: { name }
//   DELETE — zbriše mapo na disku + vrstico v bazi (render jobs cascade)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getVizDb } from '@/lib/viz/db'
import { authenticate, unauthorized } from '@/lib/auth'
import type { VizPlacement, VizVariant } from '@/lib/viz/types'
import {
  VIZ_FILE_NAMES,
  pathExists,
  projectDir,
  publicProjectUrl,
  removeDir,
} from '@/lib/viz/storage'

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

/** Sestavi odgovor z parsed placement/variants + urls map. */
function serializeProject(row: {
  id: string
  name: string
  originalPath: string
  productPath: string
  productMaskPath: string | null
  maskPath: string
  previewPath: string | null
  resultPath: string | null
  resultImagePath: string | null
  placement: string
  variants: string | null
  createdAt: Date
  updatedAt: Date
}) {
  const urls = {
    original: row.originalPath,
    product: row.productPath,
    productMask: row.productMaskPath,
    mask: row.maskPath,
    placement: publicProjectUrl(row.id, VIZ_FILE_NAMES.placement),
    preview: row.previewPath,
    result: row.resultPath,
    resultImage: row.resultImagePath,
  }
  return {
    id: row.id,
    name: row.name,
    originalPath: row.originalPath,
    productPath: row.productPath,
    productMaskPath: row.productMaskPath,
    maskPath: row.maskPath,
    previewPath: row.previewPath,
    resultPath: row.resultPath,
    resultImagePath: row.resultImagePath,
    placement: parseJsonOrNull<VizPlacement>(row.placement),
    variants: parseJsonOrNull<VizVariant[]>(row.variants) ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    urls,
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const vizDb = getVizDb()
  try {
    const { id } = await params
    const row = await vizDb.vizProject.findUnique({ where: { id } })
    if (!row) {
      return NextResponse.json({ error: 'Projekt ne obstaja' }, { status: 404 })
    }
    return NextResponse.json({ project: serializeProject(row) })
  } catch (error) {
    console.error('Viz project GET error:', error)
    return NextResponse.json({ error: 'Napaka pri branju projekta' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const vizDb = getVizDb()
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
    const existing = await vizDb.vizProject.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Projekt ne obstaja' }, { status: 404 })
    }
    const row = await vizDb.vizProject.update({
      where: { id },
      data: { name: parsed.data.name },
    })
    return NextResponse.json({ project: serializeProject(row) })
  } catch (error) {
    console.error('Viz project PATCH error:', error)
    return NextResponse.json({ error: 'Napaka pri preimenovanju projekta' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const vizDb = getVizDb()
  try {
    const { id } = await params
    const existing = await vizDb.vizProject.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Projekt ne obstaja' }, { status: 404 })
    }
    // Najprej baza (render jobs gredo s cascado), nato datoteke na disku.
    await vizDb.vizProject.delete({ where: { id } })
    const dir = projectDir(id)
    if (await pathExists(dir)) {
      await removeDir(dir)
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Viz project DELETE error:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju projekta' }, { status: 500 })
  }
}
