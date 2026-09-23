/**
 * VIZ — repozitorij metadata (runda S+3). Spec: docs/VIZ_CONTRACTS.md
 *
 * Metadata (projekti + render jobi) imata DVA ozadja, odvisno od storage
 * driverja — klicna koda (rute) ne pozna razlike:
 *   • local (dev/test): Prisma SQLite (VizProject / VizRenderJob) — kot v S+2.
 *   • blob  (produkcija na Vercelu): JSON dokumenti v isti Vercel Blob
 *     shrambi (`viz/projects/<id>/project.json`, `viz/render-jobs/<jobId>.json`),
 *     ker SQLite na serverless ni trajen. Seznam projektov = list prefix +
 *     branje dokumentov (max 50, najnovejši prej po createdAt).
 *
 * Oba ozadja vračata ISTE normalizirane oblike (VizProjectRecord /
 * VizRenderJobRecord) — datumska polja ISO nizi.
 */
import { randomUUID } from 'node:crypto'
import { vizGetJson, vizPutJson, vizDel, vizList, projectKey, renderJobKey, storageMode } from './storage'
import type { PrismaClient } from '@prisma/client'

// ── Zapis (normaliziran) ─────────────────────────────────────────────────────

export interface VizProjectRecord {
  id: string
  name: string
  originalPath: string
  productPath: string
  productMaskPath: string | null
  maskPath: string
  previewPath: string | null
  resultPath: string | null
  resultImagePath: string | null
  /** placement.json vsebina kot niz (route parsava/validira) */
  placement: string
  /** varianti kot niz ali null */
  variants: string | null
  createdAt: string
  updatedAt: string
}

export interface VizRenderJobRecord {
  id: string
  projectId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  engine: string
  /** vhodni JSON (prompt, placement, files) kot niz */
  inputJson: string
  resultPath: string | null
  error: string | null
  createdAt: string
  updatedAt: string
}

export interface VizProjectInput {
  id: string
  name: string
  originalPath: string
  productPath: string
  productMaskPath: string | null
  maskPath: string
  previewPath: string | null
  resultPath: string | null
  placement: string
  variants: string | null
}

export interface VizRenderJobInput {
  projectId: string
  status: VizRenderJobRecord['status']
  engine: string
  inputJson: string
}

// ── Prisma (local način) ─────────────────────────────────────────────────────

/** Leni Prisma client — samo local način; import šele ob uporabi (blob ne rabi). */
async function prisma(): Promise<PrismaClient> {
  const mod = await import('./db')
  return mod.getVizDb()
}

function rowToProject(row: Awaited<ReturnType<PrismaClient['vizProject']['findUniqueOrThrow']>>): VizProjectRecord {
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
    placement: row.placement,
    variants: row.variants,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function rowToJob(row: Awaited<ReturnType<PrismaClient['vizRenderJob']['findUniqueOrThrow']>>): VizRenderJobRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    status: row.status as VizRenderJobRecord['status'],
    engine: row.engine,
    inputJson: row.inputJson,
    resultPath: row.resultPath,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

// ── Projekti ─────────────────────────────────────────────────────────────────

/** Ustvari metadata zapis projekta (datoteke morajo biti že v shrambi). */
export async function createProject(input: VizProjectInput): Promise<VizProjectRecord> {
  if (storageMode() === 'blob') {
    const now = new Date().toISOString()
    const doc: VizProjectRecord = { ...input, resultImagePath: null, createdAt: now, updatedAt: now }
    await vizPutJson(projectKey(input.id, 'project.json'), doc)
    return doc
  }
  const db = await prisma()
  const row = await db.vizProject.create({
    data: {
      id: input.id,
      name: input.name,
      originalPath: input.originalPath,
      productPath: input.productPath,
      productMaskPath: input.productMaskPath,
      maskPath: input.maskPath,
      previewPath: input.previewPath,
      resultPath: input.resultPath,
      resultImagePath: null,
      placement: input.placement,
      variants: input.variants,
    },
  })
  return rowToProject(row)
}

/** Seznam projektov, najnovejši prej, max 50. */
export async function listProjects(): Promise<VizProjectRecord[]> {
  if (storageMode() === 'blob') {
    // Seznam = project.json pod viz/projects/<id>/project.json.
    const items = await vizList('viz/projects/')
    const docKeys = items.filter((i) => i.key.endsWith('/project.json'))
    const docs = await Promise.all(docKeys.map((i) => vizGetJson<VizProjectRecord>(i.key)))
    return docs
      .filter((d): d is VizProjectRecord => d !== null && typeof d.createdAt === 'string')
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
      .slice(0, 50)
  }
  const db = await prisma()
  const rows = await db.vizProject.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })
  return rows.map(rowToProject)
}

/** Podrobnosti projekta ali null. */
export async function getProject(id: string): Promise<VizProjectRecord | null> {
  if (storageMode() === 'blob') {
    return vizGetJson<VizProjectRecord>(projectKey(id, 'project.json'))
  }
  const db = await prisma()
  const row = await db.vizProject.findUnique({ where: { id } })
  return row ? rowToProject(row) : null
}

/** Preimenovanje projekta; vrne posodobljen zapis ali null (ne obstaja). */
export async function renameProject(id: string, name: string): Promise<VizProjectRecord | null> {
  if (storageMode() === 'blob') {
    const doc = await getProject(id)
    if (!doc) return null
    const updated: VizProjectRecord = { ...doc, name, updatedAt: new Date().toISOString() }
    await vizPutJson(projectKey(id, 'project.json'), updated)
    return updated
  }
  const db = await prisma()
  const existing = await db.vizProject.findUnique({ where: { id } })
  if (!existing) return null
  const row = await db.vizProject.update({ where: { id }, data: { name } })
  return rowToProject(row)
}

/** Zbriši metadata projekta (datoteke briše klicna koda). */
export async function deleteProject(id: string): Promise<void> {
  if (storageMode() === 'blob') {
    await vizDel(projectKey(id, 'project.json'))
    return
  }
  const db = await prisma()
  await db.vizProject.delete({ where: { id } })
}

// ── Render jobi ──────────────────────────────────────────────────────────────

export async function createRenderJob(input: VizRenderJobInput): Promise<VizRenderJobRecord> {
  if (storageMode() === 'blob') {
    const now = new Date().toISOString()
    const doc: VizRenderJobRecord = {
      id: randomUUID(),
      ...input,
      resultPath: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    }
    await vizPutJson(renderJobKey(doc.id), doc)
    return doc
  }
  const db = await prisma()
  const row = await db.vizRenderJob.create({
    data: {
      projectId: input.projectId,
      status: input.status,
      engine: input.engine,
      inputJson: input.inputJson,
    },
  })
  return rowToJob(row)
}

export async function updateRenderJob(
  id: string,
  patch: Partial<Pick<VizRenderJobRecord, 'status' | 'error' | 'resultPath'>>
): Promise<VizRenderJobRecord | null> {
  if (storageMode() === 'blob') {
    const doc = await vizGetJson<VizRenderJobRecord>(renderJobKey(id))
    if (!doc) return null
    const updated: VizRenderJobRecord = { ...doc, ...patch, updatedAt: new Date().toISOString() }
    await vizPutJson(renderJobKey(id), updated)
    return updated
  }
  const db = await prisma()
  const existing = await db.vizRenderJob.findUnique({ where: { id } })
  if (!existing) return null
  const row = await db.vizRenderJob.update({ where: { id }, data: patch })
  return rowToJob(row)
}

export async function getRenderJob(id: string): Promise<VizRenderJobRecord | null> {
  if (storageMode() === 'blob') {
    return vizGetJson<VizRenderJobRecord>(renderJobKey(id))
  }
  const db = await prisma()
  const row = await db.vizRenderJob.findUnique({ where: { id } })
  return row ? rowToJob(row) : null
}
