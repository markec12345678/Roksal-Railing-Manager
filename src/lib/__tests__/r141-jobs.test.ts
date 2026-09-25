// R141 — integracijski testi (issue #5 §23 — Background jobs).
// ---------------------------------------------------------------------------
//   • jobWindowKey: deterministično UTC okno (padStart, ista ura = isti ključ).
//   • session-gc: briše IZKLJUČNO seje, potekle ≥ 30 dni (sveže ostanejo);
//     higiena, ne varnost (assertSessionAlive je avtoritativna plast, §2).
//   • idempotency-gc: briše ključe starejše od 7 dni.
//   • portal-access-gc: briše dostope starejše od 90 dni (AuditLog ostane).
//   • runJob idempotenca na okno: drugi zagon istega dne = REPLAYED z ISTIM
//     job ID (ni dvojnega dela); FAILED + attempts < maxAttempts → attempts+1;
//     attempts ≥ maxAttempts → EXHAUSTED (retry policy).
//   • API: /api/jobs GET (anon 401, MONTER 403, ADMIN 200 z registry),
//     /api/jobs/run POST (MONTER 403, ADMIN 200 + JobRun vrstice).
//
// Handlerji direktno, baza roksal_test prek globalSetup (vzorec R128/R139/R140).
// Brez AI, brez naključja — okna idempotenc so EKSPLOCITNA datumca (2030+) za
// izolacijo od drugih run-ov istega dne.
import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import { GET as jobsGet } from '@/app/api/jobs/route'
import { POST as jobsRunPost } from '@/app/api/jobs/run/route'
import {
  JOB_REGISTRY,
  JOB_MAX_ATTEMPTS,
  jobWindowKey,
  runJob,
  runMaintenanceJobs,
} from '@/lib/jobs'

const BASE = 'http://localhost/api'

function req(path: string, token: string | null, method = 'GET'): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

/** Okno za posamezen test — edinstveno tudi čez dneve (fail-safe izolacija). */
function testWindow(type: string, day: number): { type: string; key: string; now: Date } {
  const now = new Date(Date.UTC(2030, 0, day, 12, 0, 0))
  return { type, now, key: jobWindowKey(type, now) }
}

beforeEach(async () => {
  // Testi si čistijo svoja okna (2030+) — produkcija/dev nikoli ne gleda teh.
  await db.jobRun.deleteMany({ where: { idempotencyKey: { startsWith: 'idempotency-gc:2030-' } } })
  await db.jobRun.deleteMany({ where: { idempotencyKey: { startsWith: 'portal-access-gc:2030-' } } })
  await db.jobRun.deleteMany({ where: { idempotencyKey: { startsWith: 'session-gc:2030-' } } })
  await db.jobRun.deleteMany({ where: { idempotencyKey: { startsWith: 'test-fail:2030-' } } })
})

describe('jobWindowKey — deterministično UTC okno', () => {
  it('isti UTC dan = isti ključ, naslednji dan = nov ključ', () => {
    const a = jobWindowKey('session-gc', new Date(Date.UTC(2026, 8, 26, 0, 5, 0)))
    const b = jobWindowKey('session-gc', new Date(Date.UTC(2026, 8, 26, 23, 59, 0)))
    const c = jobWindowKey('session-gc', new Date(Date.UTC(2026, 8, 27, 0, 0, 0)))
    expect(a).toBe('session-gc:2026-09-26')
    expect(b).toBe(a)
    expect(c).toBe('session-gc:2026-09-27')
  })

  it('meseci in dnevi so padStart(2)', () => {
    expect(jobWindowKey('x', new Date(Date.UTC(2026, 0, 5)))).toBe('x:2026-01-05')
  })

  it('registry ima registrirane GC posle z retry policy', () => {
    const types = JOB_REGISTRY.map((j) => j.type)
    expect(types).toContain('idempotency-gc')
    expect(types).toContain('portal-access-gc')
    expect(types).toContain('session-gc')
    expect(JOB_MAX_ATTEMPTS).toBeGreaterThanOrEqual(1)
  })
})

describe('session-gc — higiene stareh sej', () => {
  it('briše IZKLJUČNO seje potekle ≥ 30 dni, sveže ostanejo', async () => {
    const stamp = `r141-gc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const { user } = await createTestUserWithSession(stamp, 'MONTER')
    // Podatki so relativni na FAKE now (2030) — cutoff posla je izračunan iz
    // istega datumca (drugače bi 2030 cutoff izbrisal tudi "sveže" 2026 vrstice).
    const w = testWindow('session-gc', 5)
    const old = await db.userSession.create({
      data: {
        profileId: user.id,
        expiresAt: new Date(w.now.getTime() - 31 * 24 * 60 * 60 * 1000),
      },
    })
    const freshExpired = await db.userSession.create({
      data: {
        profileId: user.id,
        expiresAt: new Date(w.now.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
    })
    const def = JOB_REGISTRY.find((j) => j.type === 'session-gc')!
    const outcome = await runJob(def, { owner: 'test', correlationId: w.key, now: w.now })
    expect(outcome.status).toBe('SUCCEEDED')
    const result = outcome.result as { deleted: number }
    expect(result.deleted).toBeGreaterThanOrEqual(1)
    expect(await db.userSession.findUnique({ where: { id: old.id } })).toBeNull()
    // Sveže potekla seja ostane (30-dnevni prag).
    expect(await db.userSession.findUnique({ where: { id: freshExpired.id } })).not.toBeNull()
    await db.userSession.deleteMany({ where: { profileId: user.id } })
  })
})

describe('idempotency-gc + portal-access-gc — pragovi', () => {
  it('briše IdempotencyKey starejše od 7 dni', async () => {
    const stamp = `r141-idem-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const old = await db.idempotencyKey.create({
      data: {
        key: `old-${stamp}`,
        route: 'measurements',
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      },
    })
    const fresh = await db.idempotencyKey.create({
      data: { key: `fresh-${stamp}`, route: 'measurements' },
    })
    const def = JOB_REGISTRY.find((j) => j.type === 'idempotency-gc')!
    const w = testWindow('idempotency-gc', 6)
    // Podatki relativni na fake now (glej session-gc opombo).
    await db.idempotencyKey.update({
      where: { key: old.key },
      data: { createdAt: new Date(w.now.getTime() - 8 * 24 * 60 * 60 * 1000) },
    })
    await db.idempotencyKey.update({
      where: { key: fresh.key },
      data: { createdAt: new Date(w.now.getTime() - 1 * 24 * 60 * 60 * 1000) },
    })
    const outcome = await runJob(def, { owner: 'test', correlationId: w.key, now: w.now })
    expect(outcome.status).toBe('SUCCEEDED')
    expect(await db.idempotencyKey.findUnique({ where: { key: old.key } })).toBeNull()
    expect(await db.idempotencyKey.findUnique({ where: { key: fresh.key } })).not.toBeNull()
    await db.idempotencyKey.deleteMany({ where: { key: { startsWith: `fresh-${stamp}` } } })
  })

  it('briše PortalAccess starejše od 90 dni (projectId null dovoljen)', async () => {
    const stamp = `r141-pa-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const old = await db.portalAccess.create({
      data: {
        status: 'OK',
        ipHash: `hash-${stamp}`,
        createdAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000),
      },
    })
    const fresh = await db.portalAccess.create({
      data: { status: 'NOT_FOUND', ipHash: `hash2-${stamp}` },
    })
    const def = JOB_REGISTRY.find((j) => j.type === 'portal-access-gc')!
    const w = testWindow('portal-access-gc', 7)
    await db.portalAccess.update({
      where: { id: old.id },
      data: { createdAt: new Date(w.now.getTime() - 91 * 24 * 60 * 60 * 1000) },
    })
    await db.portalAccess.update({
      where: { id: fresh.id },
      data: { createdAt: new Date(w.now.getTime() - 1 * 24 * 60 * 60 * 1000) },
    })
    const outcome = await runJob(def, { owner: 'test', correlationId: w.key, now: w.now })
    expect(outcome.status).toBe('SUCCEEDED')
    expect(await db.portalAccess.findUnique({ where: { id: old.id } })).toBeNull()
    expect(await db.portalAccess.findUnique({ where: { id: fresh.id } })).not.toBeNull()
    await db.portalAccess.deleteMany({ where: { id: fresh.id } })
  })
})

describe('runJob — idempotenca na okno + retry policy', () => {
  const failingDef = {
    type: 'test-fail',
    opis: 'testni posel, ki vedno pade',
    run: async () => {
      throw new Error('boom')
    },
  }

  it('drugi uspešen zagon istega okna = REPLAYED z ISTIM job ID', async () => {
    const def = JOB_REGISTRY.find((j) => j.type === 'session-gc')!
    const w = testWindow('session-gc', 10)
    const first = await runJob(def, { owner: 'test-a', correlationId: 'c1', now: w.now })
    expect(first.status).toBe('SUCCEEDED')
    expect(first.replayed).toBe(false)
    const second = await runJob(def, { owner: 'test-b', correlationId: 'c2', now: w.now })
    expect(second.status).toBe('REPLAYED')
    expect(second.replayed).toBe(true)
    expect(second.jobId).toBe(first.jobId)
    // Owner se NE spremeni ob replayu (prvi zagon ostane lastnik okna).
    const row = await db.jobRun.findUnique({ where: { id: first.jobId } })
    expect(row?.owner).toBe('test-a')
    expect(row?.attempts).toBe(1)
    expect(row?.status).toBe('SUCCEEDED')
    expect(row?.correlationId).toBe('c1')
  })

  it('FAILED posel: attempts rastejo do maxAttempts, potem EXHAUSTED', async () => {
    const w = testWindow('test-fail', 12)
    const a1 = await runJob(failingDef, { owner: 'test', correlationId: 'c1', now: w.now })
    expect(a1.status).toBe('FAILED')
    expect(a1.attempts).toBe(1)
    expect(a1.lastError).toContain('boom')
    // §22: error brez stacka — kratka sanitizirana oblika.
    expect(a1.lastError!.length).toBeLessThan(300)
    expect(a1.lastError!).not.toContain('at ')

    const a2 = await runJob(failingDef, { owner: 'test', correlationId: 'c2', now: w.now })
    expect(a2.status).toBe('FAILED')
    expect(a2.attempts).toBe(2)
    expect(a2.jobId).toBe(a1.jobId)

    const a3 = await runJob(failingDef, { owner: 'test', correlationId: 'c3', now: w.now })
    expect(a3.status).toBe('FAILED')
    expect(a3.attempts).toBe(3)

    // 4. poskus: attempts (3) ≥ maxAttempts (3) → EXHAUSTED, run se NE pokliče več.
    const a4 = await runJob(failingDef, { owner: 'test', correlationId: 'c4', now: w.now })
    expect(a4.status).toBe('EXHAUSTED')
    expect(a4.replayed).toBe(true)
    expect(a4.attempts).toBe(3)

    const row = await db.jobRun.findUnique({ where: { id: a1.jobId } })
    expect(row?.maxAttempts).toBe(3)
    expect(row?.lastError).toContain('boom')
    await db.jobRun.delete({ where: { id: a1.jobId } })
  })

  it('runMaintenanceJobs zažene VSE registrirane posle in vrača izide', async () => {
    const now = new Date(Date.UTC(2030, 0, 20, 12, 0, 0))
    const run = await runMaintenanceJobs({ owner: 'test-all', correlationId: 'c-all', now })
    expect(run.outcomes.length).toBe(JOB_REGISTRY.length)
    for (const o of run.outcomes) {
      expect(['SUCCEEDED', 'REPLAYED']).toContain(o.status)
    }
    // Vsak posel ima svojo vrstico z vsemi §23 polji.
    const rows = await db.jobRun.findMany({ where: { owner: 'test-all' } })
    expect(rows.length).toBe(JOB_REGISTRY.length)
    for (const r of rows) {
      expect(r.input).toContain('window')
      expect(r.correlationId).toBe('c-all')
      expect(r.startedAt).not.toBeNull()
      expect(r.finishedAt).not.toBeNull()
    }
    await db.jobRun.deleteMany({ where: { owner: 'test-all' } })
  })
})

describe('API /api/jobs — register poslov (ADMIN-only)', () => {
  it('anon → 401, MONTER → 403', async () => {
    const anon = await jobsGet(req('/api/jobs', null))
    expect(anon.status).toBe(401)

    const stamp = `r141-api-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const { token } = await createTestUserWithSession(stamp, 'MONTER')
    const res = await jobsGet(req('/api/jobs', token))
    expect(res.status).toBe(403)
  })

  it('ADMIN → 200: registry + retry policy + minimalni DTO', async () => {
    const stamp = `r141-admin-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const { token } = await createTestUserWithSession(stamp, 'ADMIN')
    const res = await jobsGet(req('/api/jobs', token))
    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      jobs: unknown[]
      registry: { type: string; opis: string }[]
      retryPolicy: { maxAttempts: number }
    }
    expect(Array.isArray(data.jobs)).toBe(true)
    expect(data.registry.map((j) => j.type)).toContain('session-gc')
    expect(data.retryPolicy.maxAttempts).toBe(3)
  })

  it('POST /api/jobs/run: MONTER → 403, ADMIN → 200 z izidi + vrstice v ledgerju', async () => {
    const stampM = `r141-run-m-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const { token: monterToken } = await createTestUserWithSession(stampM, 'MONTER')
    const denied = await jobsRunPost(req('/api/jobs/run', monterToken, 'POST'))
    expect(denied.status).toBe(403)

    const stampA = `r141-run-a-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const { token: adminToken, user } = await createTestUserWithSession(stampA, 'ADMIN')
    // Izolacija: današnje okno (UTC) je UNIQUE — prejšnji run istega dne bi
    // sicer vrnil REPLAYED z TUJIM ownerjem. Počistimo samo svoja okna.
    const today = new Date()
    const y = today.getUTCFullYear()
    const m = String(today.getUTCMonth() + 1).padStart(2, '0')
    const d = String(today.getUTCDate()).padStart(2, '0')
    const todaysKeys = JOB_REGISTRY.map((j) => `${j.type}:${y}-${m}-${d}`)
    await db.jobRun.deleteMany({ where: { idempotencyKey: { in: todaysKeys } } })
    const res = await jobsRunPost(req('/api/jobs/run', adminToken, 'POST'))
    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      ok: boolean
      outcomes: { type: string; status: string }[]
      window: string
    }
    expect(data.ok).toBe(true)
    expect(data.outcomes.length).toBe(JOB_REGISTRY.length)
    // Owner = e-mail ADMIN seje (ročni zagon), ne "cron".
    const rows = await db.jobRun.findMany({ where: { idempotencyKey: { in: data.outcomes.map((o) => o.type + ':' + data.window.split(':')[1]) } } })
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.owner === user.email)).toBe(true)
  })
})
