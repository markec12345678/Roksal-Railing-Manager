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
import {
  vizGetJson,
  vizPutJson,
  vizDel,
  vizList,
  vizCreate,
  vizGet,
  projectKey,
  renderJobKey,
  storageMode,
} from './storage'
import type { PrismaClient } from '@prisma/client'
import { mayAccess, type VizOwnerContext } from './ownership'

/** Kontekst lastništva (S+4) — null polja = zapuščinski zapisi (pred S+4). */
export interface OwnershipFilter {
  ownerId: string
  isAdmin: boolean
}

// ── Zapis (normaliziran) ─────────────────────────────────────────────────────

export interface VizProjectRecord {
  id: string
  /** Lastnik (Profile.id seje). Null = zapuščina pred S+4 (vidna samo ADMIN). */
  ownerId: string | null
  /** Idempotenčni ključ klienta (S+4) — ista rešitev vrača isti projekt. */
  idempotencyKey: string | null
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
  /** Lastnik joba = seja, ki ga je ustvarila (null = zapuščina pred S+4). */
  ownerId: string | null
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
  ownerId?: string | null
  idempotencyKey?: string | null
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
  ownerId?: string | null
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
    ownerId: row.ownerId,
    idempotencyKey: row.idempotencyKey,
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
    ownerId: row.ownerId,
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
    const doc: VizProjectRecord = {
      id: input.id,
      ownerId: input.ownerId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      name: input.name,
      originalPath: input.originalPath,
      productPath: input.productPath,
      productMaskPath: input.productMaskPath ?? null,
      maskPath: input.maskPath,
      previewPath: input.previewPath ?? null,
      resultPath: input.resultPath ?? null,
      resultImagePath: null,
      placement: input.placement,
      variants: input.variants ?? null,
      createdAt: now,
      updatedAt: now,
    }
    await vizPutJson(projectKey(input.id, 'project.json'), doc)
    return doc
  }
  const db = await prisma()
  const row = await db.vizProject.create({
    data: {
      id: input.id,
      ownerId: input.ownerId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
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

/** Seznam projektov, najnovejši prej, max 50 (brez filtra = samo orodja/testi!). */
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

/**
 * S+4 — seznam projektov LASTNIKA (rute smejo uporabljati samo to).
 * Vidi: svoje projekte; ADMIN pa dodatno zapuščinske brez ownerId.
 */
export async function listProjectsForOwner(ctx: OwnershipFilter): Promise<VizProjectRecord[]> {
  const all = await listProjects()
  return all.filter((p) => mayAccess({ ownerId: ctx.ownerId, isAdmin: ctx.isAdmin }, p.ownerId))
}

/**
 * S+4 — projekt za lastnika ali null (tuj projekt = null; ruta javi 404,
 * ne 403 — ne puščamo informacije o obstoju).
 */
export async function getProjectForOwner(
  id: string,
  ctx: OwnershipFilter
): Promise<VizProjectRecord | null> {
  const rec = await getProject(id)
  if (!rec) return null
  if (!mayAccess({ ownerId: ctx.ownerId, isAdmin: ctx.isAdmin }, rec.ownerId)) return null
  return rec
}

/** Projekta po idempotenčnem ključu (S+4) ali null. */
export async function findProjectByIdempotencyKey(
  ownerId: string,
  key: string
): Promise<VizProjectRecord | null> {
  const owned = await listProjectsForOwner({ ownerId, isAdmin: false })
  return owned.find((p) => p.idempotencyKey === key) ?? null
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

/**
 * S+4 — preimenovanje z lastniško preverbo (null = tuj/neobstoječ → 404).
 */
export async function renameProjectForOwner(
  id: string,
  name: string,
  ctx: OwnershipFilter
): Promise<VizProjectRecord | null> {
  const rec = await getProjectForOwner(id, ctx)
  if (!rec) return null
  return renameProject(id, name)
}

/**
 * S+5 — PODVOJITEV projekta (isti lastnik): nov id + ime " (kopija)",
 * iste poti datotek so SESTAVLJENE na nov id (route kopira datoteke PRED
 * klicem te funkcije, da metadata ne kaže na manjkajoče vire).
 *
 *   blob  = nov project.json dokument (viz/projects/<newId>/project.json)
 *   local = nova Prisma vrstica
 */
/**
 * S+5 — ime podvojenega projekta: "ime (kopija)", največ 120 znakov
 * (pripona je VEDNO prisotna — name se po potrebi obreže).
 */
export function duplicateName(srcName: string): string {
  const suffix = ' (kopija)'
  const maxName = 120
  if (srcName.length + suffix.length <= maxName) return srcName + suffix
  return srcName.slice(0, maxName - suffix.length) + suffix
}

export async function duplicateProjectForOwner(
  id: string,
  ctx: OwnershipFilter
): Promise<VizProjectRecord | null> {
  const src = await getProjectForOwner(id, ctx)
  if (!src) return null
  const newId = randomUUID()
  const now = new Date().toISOString()
  const newPath = (p: string | null): string => {
    if (!p) return p as never
    // originalPath/maskPath/... so "/viz/projects/<id>/<ime>" (ali brez vodilnega
    // poševnika v blob načinu) — zamenjaj id segment v obeh oblikah.
    return p
      .replace(`viz/projects/${src.id}/`, `viz/projects/${newId}/`)
      .replace(`/viz/projects/${src.id}/`, `/viz/projects/${newId}/`)
  }
  const doc: VizProjectRecord = {
    id: newId,
    ownerId: src.ownerId,
    idempotencyKey: null, // podvojitev je NOV projekt — idempotenca se ne deduje
    name: duplicateName(src.name),
    originalPath: newPath(src.originalPath),
    productPath: newPath(src.productPath),
    productMaskPath: src.productMaskPath ? newPath(src.productMaskPath) : null,
    maskPath: newPath(src.maskPath),
    previewPath: src.previewPath ? newPath(src.previewPath) : null,
    resultPath: src.resultPath ? newPath(src.resultPath) : null,
    resultImagePath: src.resultImagePath ? newPath(src.resultImagePath) : null,
    placement: src.placement,
    variants: src.variants,
    createdAt: now,
    updatedAt: now,
  }
  if (storageMode() === 'blob') {
    await vizPutJson(projectKey(newId, 'project.json'), doc)
    return doc
  }
  const db = await prisma()
  const row = await db.vizProject.create({
    data: {
      id: newId,
      ownerId: doc.ownerId,
      idempotencyKey: null,
      name: doc.name,
      originalPath: doc.originalPath,
      productPath: doc.productPath,
      productMaskPath: doc.productMaskPath,
      maskPath: doc.maskPath,
      previewPath: doc.previewPath,
      resultPath: doc.resultPath,
      resultImagePath: null,
      placement: doc.placement,
      variants: doc.variants,
    },
  })
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
      ownerId: input.ownerId ?? null,
      projectId: input.projectId,
      status: input.status,
      engine: input.engine,
      inputJson: input.inputJson,
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
      ownerId: input.ownerId ?? null,
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

/** S+4 — render job za lastnika ali null (tuj job → ruta javi 404). */
export async function getRenderJobForOwner(
  id: string,
  ctx: OwnershipFilter
): Promise<VizRenderJobRecord | null> {
  const job = await getRenderJob(id)
  if (!job) return null
  if (!mayAccess({ ownerId: ctx.ownerId, isAdmin: ctx.isAdmin }, job.ownerId)) return null
  return job
}

// ── Render jobi — sodobno varni prehodi (S+4, P0) ────────────────────────────
//
// Problem: blob način je prej bil read → modify → overwrite. Dva sočasna
// update-a (A: queued→processing, B: stale queued→failed) sta lahko izgubila
// A-jev zapis (last-writer-wins brez konteksta) ALI regresirala stanje
// (processing → nazaj queued).
//
// Mehanizem (dve neodvisni zaščiti):
//   1. **Lease zaklep per job** prek ATOMARNEGA create-if-not-exists
//      (vizCreate = put brez allowOverwrite / fs 'wx'). Zaklep poteče po
//      RENDER_JOB_LOCK_TTL_MS (mrtev držalec ne blokira za vedno).
//   2. **Državni stroj prehodov** — status ne sme regresirati in terminalna
//      stanja (completed/failed) so nespremenljiva. Ponovljen isti update je
//      idempotentna no-op uspeh.

export type VizJobStatus = VizRenderJobRecord['status']

/** Dovoljeni prehodi — vse ostalo je ZAVRNJENO (regresija/terminal = napaka). */
const LEGAL_JOB_TRANSITIONS: Record<VizJobStatus, VizJobStatus[]> = {
  queued: ['processing', 'failed'],
  processing: ['completed', 'failed'],
  completed: [],
  failed: [],
}

export type VizJobTransitionResult =
  | { ok: true; job: VizRenderJobRecord; duplicate: boolean }
  | { ok: false; reason: 'not-found' | 'illegal-transition' | 'lock-timeout' }

function validateJobTransition(current: VizJobStatus, target: VizJobStatus): 'ok' | 'duplicate' | 'illegal' {
  if (current === target) return 'duplicate' // ponovno pošiljanje istega update-a
  return LEGAL_JOB_TRANSITIONS[current].includes(target) ? 'ok' : 'illegal'
}

const RENDER_JOB_LOCK_TTL_MS = 30_000
const RENDER_JOB_LOCK_RETRIES = 5
const RENDER_JOB_LOCK_RETRY_DELAY_MS = 60

function jobLockKey(jobId: string): string {
  return `${renderJobKey(jobId)}.lock`
}

/** Poskusi pridobiti lease zaklep; vrne holder token ali null (zaseden/potečen retry). */
async function acquireJobLock(jobId: string): Promise<string | null> {
  const holder = randomUUID()
  const key = jobLockKey(jobId)
  for (let attempt = 0; attempt <= RENDER_JOB_LOCK_RETRIES; attempt++) {
    try {
      await vizCreate(key, Buffer.from(JSON.stringify({ holder, lockedAt: Date.now() }), 'utf8'), 'application/json')
      return holder
    } catch (error) {
      // VizAlreadyExistsError → zaklep zaseden; ostalo = resnična napaka → odpovej
      if (!(error instanceof Error) || error.name !== 'VizAlreadyExistsError') throw error
      // Ali je držalec mrtev (lease potečen)? → prevzemi zaklep.
      const lockDoc = await vizGetJson<{ holder: string; lockedAt: number }>(key)
      if (lockDoc && Date.now() - lockDoc.lockedAt > RENDER_JOB_LOCK_TTL_MS) {
        // Pogojno prevzemanje: prepisemo zaklep (last-writer-wins na lease —
        // TTL je dovolj dolg, da je držalec v teku defintivno mrtev).
        await vizPutJson(key, { holder, lockedAt: Date.now() })
        return holder
      }
      if (attempt < RENDER_JOB_LOCK_RETRIES) {
        await new Promise((r) => setTimeout(r, RENDER_JOB_LOCK_RETRY_DELAY_MS))
      }
    }
  }
  return null
}

/** Sprosti lease zaklep — SAMO, če je še naš (nikoli ne briši tujega). */
async function releaseJobLock(jobId: string, holder: string): Promise<void> {
  const key = jobLockKey(jobId)
  const lockDoc = await vizGetJson<{ holder: string; lockedAt: number }>(key)
  if (lockDoc?.holder === holder) {
    await vizDel(key)
  }
}

/**
 * S+4 — sodobno VAREN update render joba z validacijo prehoda.
 *
 * Vrača:
 *   { ok: true, job, duplicate }   — uspeh (duplicate = ponovljen isti update,
 *                                    vrni trenutno stanje, NIČ ne spremeni)
 *   { ok: false, reason }          — not-found | illegal-transition | lock-timeout
 *
 * Blob način: lease zaklep + read-modify-write pod zaklepom.
 * Local (Prisma): isti prehodni stroj znotraj $transaction (SQLite seralizira).
 */
export async function transitionRenderJob(
  id: string,
  patch: Partial<Pick<VizRenderJobRecord, 'status' | 'error' | 'resultPath'>>
): Promise<VizJobTransitionResult> {
  if (storageMode() === 'blob') {
    const holder = await acquireJobLock(id)
    if (!holder) return { ok: false, reason: 'lock-timeout' }
    try {
      const doc = await vizGetJson<VizRenderJobRecord>(renderJobKey(id))
      if (!doc) return { ok: false, reason: 'not-found' }
      if (patch.status) {
        const verdict = validateJobTransition(doc.status, patch.status)
        if (verdict === 'duplicate') return { ok: true, job: doc, duplicate: true }
        if (verdict === 'illegal') return { ok: false, reason: 'illegal-transition' }
      }
      const updated: VizRenderJobRecord = { ...doc, ...patch, updatedAt: new Date().toISOString() }
      await vizPutJson(renderJobKey(id), updated)
      return { ok: true, job: updated, duplicate: false }
    } finally {
      await releaseJobLock(id, holder)
    }
  }
  const db = await prisma()
  return db.$transaction(async (tx) => {
    const existing = await tx.vizRenderJob.findUnique({ where: { id } })
    if (!existing) return { ok: false, reason: 'not-found' as const }
    const current = existing.status as VizJobStatus
    if (patch.status) {
      const verdict = validateJobTransition(current, patch.status)
      if (verdict === 'duplicate') return { ok: true, job: rowToJob(existing), duplicate: true }
      if (verdict === 'illegal') return { ok: false, reason: 'illegal-transition' as const }
    }
    const row = await tx.vizRenderJob.update({ where: { id }, data: patch })
    return { ok: true, job: rowToJob(row), duplicate: false }
  })
}
