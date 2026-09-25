/**
 * R141 (issue #5 §23 — Background jobs): enoten register vzdrževalnih poslov.
 *
 * §23 pogodba za VSAK posel: job ID, owner, input, status, attempts,
 * retry policy, error, idempotency, correlation ID — vse to nosi vrstica
 * `JobRun` (job ledger, migracija 20260926030000_r141_job_runs).
 *
 * Zasnovano po obstoječih vzorcih:
 *   • deterministično — GC pragovi so konstante (ali env override z clamp),
 *     brez AI, brez naključja; okno idempotenc = UTC dan (YYYY-MM-DD);
 *   • PostgreSQL-only fail-closed — posli delajo na bazi, napaka = FAILED
 *     vrstica z lastError (sanitiziran, §22), ne tiho preglajanje;
 *   • exactly-once na okno — idempotencyKey UNIQUE (`type:YYYY-MM-DD`):
 *     drugi zagon istega dne = replay (posel NE dela dvojno delo).
 *
 * Odločitev, kaj je posel (in kaj NI):
 *   • idempotency-gc  — IdempotencyKey starejši od 7 dni (responseBody nosi
 *     snapshot odgovorov → vrstice rastejo; replay pogodba jeminute/ure,
 *     ne tedni).
 *   • portal-access-gc — PortalAccess starejši od 90 dni (zasebnost: ipHash
 *     ostane pripisan obdobju, ne večnosti; AuditLog se NE čišči — pravno
 *     pomemben podatek ostane za vedno, R139).
 *   • session-gc      — UserSession s expiresAt ≥ 30 dni v preteklost
 *     (mrtve vrstice; assertSessionAlive (§2) je avtoritativna plast in
 *     deluje neodvisno od te čistilne akcije — čistka je higična, ne
 *     varnostna).
 *
 * VIZ staging GC ostane v svoji ruti (/api/viz/gc, object storage — ne baza)
 * in je tu ZAVEZNO dokumentiran kot ločen posel, da se ne podvoji upravljanje.
 */
import { db } from '@/lib/db'
import { correlationErrorSummary } from '@/lib/correlation'

export const IDEMPOTENCY_TTL_DAYS = 7
export const PORTAL_ACCESS_TTL_DAYS = 90
export const SESSION_GC_TTL_DAYS = 30
/** Retry policy: koliko poskusov na okno (dan). Cron prihaja vsak dan znova. */
export const JOB_MAX_ATTEMPTS = 3

export type JobStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED'

export interface JobDefinition {
  type: string
  opis: string
  /** Zaženi posel → determinističen rezultat (JSON-serializabilen). */
  run: (now: Date) => Promise<Record<string, unknown>>
}

/** UTC okno idempotenc poslov: `type:YYYY-MM-DD` (deterministično, padStart). */
export function jobWindowKey(type: string, now: Date): string {
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  return `${type}:${y}-${m}-${d}`
}

/** Prag starosti → cutoff Date (deterministično iz `now`). */
function cutoffDays(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
}

/** Registrirani posli (deterministični GC — vsak vrača števce, brez stranskih učinkov izven baze). */
export const JOB_REGISTRY: readonly JobDefinition[] = [
  {
    type: 'idempotency-gc',
    opis: `Briše IdempotencyKey starejše od ${IDEMPOTENCY_TTL_DAYS} dni (odgovori s snapshoti rastejo)`,
    async run(now) {
      const cutoff = cutoffDays(now, IDEMPOTENCY_TTL_DAYS)
      const r = await db.idempotencyKey.deleteMany({ where: { createdAt: { lt: cutoff } } })
      return { deleted: r.count, cutoff: cutoff.toISOString(), ttlDays: IDEMPOTENCY_TTL_DAYS }
    },
  },
  {
    type: 'portal-access-gc',
    opis: `Briše PortalAccess starejše od ${PORTAL_ACCESS_TTL_DAYS} dni (zasebnost ipHash; AuditLog ostane)`,
    async run(now) {
      const cutoff = cutoffDays(now, PORTAL_ACCESS_TTL_DAYS)
      const r = await db.portalAccess.deleteMany({ where: { createdAt: { lt: cutoff } } })
      return { deleted: r.count, cutoff: cutoff.toISOString(), ttlDays: PORTAL_ACCESS_TTL_DAYS }
    },
  },
  {
    type: 'session-gc',
    opis: `Briše UserSession, ki so potekle ≥ ${SESSION_GC_TTL_DAYS} dni nazaj (higiena, ne varnost)`,
    async run(now) {
      const cutoff = cutoffDays(now, SESSION_GC_TTL_DAYS)
      const r = await db.userSession.deleteMany({
        where: { expiresAt: { lt: cutoff } },
      })
      return { deleted: r.count, cutoff: cutoff.toISOString(), ttlDays: SESSION_GC_TTL_DAYS }
    },
  },
]

export function jobByType(type: string): JobDefinition | null {
  return JOB_REGISTRY.find((j) => j.type === type) ?? null
}

export interface JobOutcome {
  jobId: string
  type: string
  status: 'SUCCEEDED' | 'FAILED' | 'REPLAYED' | 'EXHAUSTED'
  attempts: number
  /** true = ta zagon je bil replay (posel je ta okno že USPEŠNO delal). */
  replayed: boolean
  durationMs: number | null
  lastError: string | null
  result: Record<string, unknown> | null
}

/**
 * Zaženi en posel z oknom `now` (ali eksplicitnim ključem okna za teste).
 *
 * Semantika idempotenc na okno:
 *   • obstoječi SUCCEEDED  → REPLAYED (nič ne delamo, vrni prvotni rezultat);
 *   • obstoječi FAILED z attempts < maxAttempts → attempts+1, poskusi znova;
 *   • obstoječi FAILED z attempts ≥ maxAttempts → EXHAUSTED (retry policy —
 *     naslednji dan cron odpre NOVO okno, kar je naravna ponovitev);
 *   • obstoječi RUNNING (starejši od 1 h — zrušen proces) → poskusi znova
 *     (attempts+1); sveži RUNNING (drug proces teče) → REPLAYED z opombo.
 */
export async function runJob(
  def: JobDefinition,
  opts: { owner: string; correlationId: string; now?: Date },
): Promise<JobOutcome> {
  const now = opts.now ?? new Date()
  const windowKey = jobWindowKey(def.type, now)
  const started = Date.now()

  const existing = await db.jobRun.findUnique({ where: { idempotencyKey: windowKey } })

  if (existing) {
    if (existing.status === 'SUCCEEDED') {
      return {
        jobId: existing.id,
        type: def.type,
        status: 'REPLAYED',
        attempts: existing.attempts,
        replayed: true,
        durationMs: existing.durationMs,
        lastError: null,
        result: safeParse(existing.result),
      }
    }
    if (existing.status === 'FAILED' && existing.attempts >= existing.maxAttempts) {
      return {
        jobId: existing.id,
        type: def.type,
        status: 'EXHAUSTED',
        attempts: existing.attempts,
        replayed: true,
        durationMs: existing.durationMs,
        lastError: existing.lastError,
        result: null,
      }
    }
    if (
      existing.status === 'RUNNING' &&
      existing.startedAt &&
      now.getTime() - existing.startedAt.getTime() < 60 * 60 * 1000
    ) {
      // Sveži RUNNING = verjetno drug proces znotraj okna še teče → NE hodi
      // po istem delu hkrati (idempotenca na okno pokriva tudi to).
      return {
        jobId: existing.id,
        type: def.type,
        status: 'REPLAYED',
        attempts: existing.attempts,
        replayed: true,
        durationMs: null,
        lastError: null,
        result: null,
      }
    }
    // FAILED (pod maxAttempts) ALI zastareli RUNNING (≥ 1 h) → nov poskus.
    await db.jobRun.update({
      where: { id: existing.id },
      data: {
        status: 'RUNNING',
        attempts: { increment: 1 },
        owner: opts.owner,
        correlationId: opts.correlationId,
        lastError: null,
        startedAt: now,
        finishedAt: null,
        input: JSON.stringify({ window: windowKey, at: now.toISOString() }),
      },
    })
    return await execute(def, existing.id, opts, started, existing.attempts + 1)
  }

  const created = await db.jobRun.create({
    data: {
      type: def.type,
      owner: opts.owner,
      input: JSON.stringify({ window: windowKey, at: now.toISOString() }),
      status: 'RUNNING',
      attempts: 1,
      maxAttempts: JOB_MAX_ATTEMPTS,
      correlationId: opts.correlationId,
      idempotencyKey: windowKey,
      startedAt: now,
    },
  })
  return await execute(def, created.id, opts, started, 1)
}

/** Skupni rep: zaženi posel, zapiši SUCCEEDED/FAILED, vrni izid. */
async function execute(
  def: JobDefinition,
  jobId: string,
  opts: { owner: string; correlationId: string; now?: Date },
  startedAtMs: number,
  attempts: number,
): Promise<JobOutcome> {
  try {
    const result = await def.run(opts.now ?? new Date())
    const finished = new Date()
    const durationMs = Date.now() - startedAtMs
    await db.jobRun.update({
      where: { id: jobId },
      data: {
        status: 'SUCCEEDED',
        finishedAt: finished,
        durationMs,
        result: JSON.stringify(result),
        lastError: null,
      },
    })
    return {
      jobId,
      type: def.type,
      status: 'SUCCEEDED',
      attempts,
      replayed: false,
      durationMs,
      lastError: null,
      result,
    }
  } catch (error) {
    const lastError = correlationErrorSummary(error)
    const finished = new Date()
    const durationMs = Date.now() - startedAtMs
    await db.jobRun
      .update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          finishedAt: finished,
          durationMs,
          lastError,
        },
      })
      .catch(() => {
        // Baza padla tudi za zapis FAILED — log nosi resnico (fail-verbose).
      })
    return {
      jobId,
      type: def.type,
      status: 'FAILED',
      attempts,
      replayed: false,
      durationMs,
      lastError,
      result: null,
    }
  }
}

export interface MaintenanceRun {
  correlationId: string
  window: string
  outcomes: JobOutcome[]
}

/** Zaženi VSE registrirane posle za okno `now` (vrstni red = registry). */
export async function runMaintenanceJobs(opts: {
  owner: string
  correlationId: string
  now?: Date
}): Promise<MaintenanceRun> {
  const now = opts.now ?? new Date()
  const outcomes: JobOutcome[] = []
  for (const def of JOB_REGISTRY) {
    outcomes.push(await runJob(def, { ...opts, now }))
  }
  return { correlationId: opts.correlationId, window: jobWindowKey('maintenance', now), outcomes }
}

function safeParse(json: string | null): Record<string, unknown> | null {
  if (!json) return null
  try {
    const v = JSON.parse(json)
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}
