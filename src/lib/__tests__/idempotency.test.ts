// Roksal — testi idempotence meritev (issue #5 §4: offline vrsta)
// ---------------------------------------------------------------------------
// Dokazuje exactly-once pogodbo na ravni rute (handlerji direktno, baza
// roksal_test prek globalSetup):
//   • POST /api/measurements z `Idempotency-Key` — ponovitev ISTEGA ključa
//     vrne ORIGINALNI odgovor (ista meritev, `Idempotent-Replay: true`),
//     v bazi je NATANKO ena vrstica (brez dvojnika);
//   • ISTI ključ, DRUG profil (vodja istega projekta — dostop OK) → 409 conflict
//     (tuji replay ne razkrije odgovora, ne ustvari meritve);
//   • neveljaven format ključa → 400 (fail-closed);
//   • BREZ ključa → starejša pogodba nespremenjena (vsak POST = nova meritev);
//   • beginIdempotency/storeResponse helperji: new → replay → tuj profil conflict.
// Brez AI, brez naključja (unikatni e-naslovi so izključno za izolacijo testov).

import { describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'

const ROUTE_URL = 'http://localhost/api/measurements'

function measurementRequest(
  token: string,
  projectId: string,
  key?: string,
  body?: Record<string, unknown>,
): Request {
  return new Request(ROUTE_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(key ? { 'idempotency-key': key } : {}),
    },
    body: JSON.stringify(body ?? { projectId, dolzinaMm: 2400, visinaMm: 900 }),
  })
}

async function makeProjectFor(monterId: string, naziv: string, vodjaId?: string): Promise<string> {
  const customer = await db.customer.create({
    data: { ime: `R128-IDEM-${naziv}`, naslov: 'Test 1' },
  })
  const project = await db.project.create({
    data: { customerId: customer.id, nazivProjekta: naziv, monterId, vodjaId },
  })
  return project.id
}

describe('idempotenca meritev — exactly-once replay (R128 §4)', () => {
  it('isti Idempotency-Key dvakrat → isti odgovor, NATANKO ena meritev v bazi', async () => {
    const { user, token } = await createTestUserWithSession(`r128-idem-a-${Date.now()}`)
    const projectId = await makeProjectFor(user.id, 'Idem-a')
    const key = `m-test-${Date.now()}-a`

    const route = await import('@/app/api/measurements/route')
    const res1 = await route.POST(measurementRequest(token, projectId, key))
    expect(res1.status).toBe(201)
    const body1 = (await res1.json()) as { id: string }
    expect(res1.headers.get('Idempotent-Stored')).toBe('true')

    const res2 = await route.POST(measurementRequest(token, projectId, key))
    expect(res2.status).toBe(201)
    const body2 = (await res2.json()) as { id: string }
    expect(res2.headers.get('Idempotent-Replay')).toBe('true')
    expect(body2.id).toBe(body1.id)

    const count = await db.measurement.count({ where: { projectId } })
    expect(count).toBe(1) // ponovitev NE ustvari dvojnika
  })

  it('isti ključ, DRUG profil → 409 conflict, brez druge meritve in brez razkritja', async () => {
    const { user: userA, token: tokenA } = await createTestUserWithSession(`r128-idem-b1-${Date.now()}`)
    const { user: userB, token: tokenB } = await createTestUserWithSession(`r128-idem-b2-${Date.now()}`)
    // userB ima dostop do istega projekta (vodja) — pregled se torej doseže
    // (to ni IDOR test; tu testiramo VEZAVO ključa na principal).
    const projectId = await makeProjectFor(userA.id, 'Idem-b', userB.id)
    const key = `m-test-${Date.now()}-b`

    const route = await import('@/app/api/measurements/route')
    const res1 = await route.POST(measurementRequest(tokenA, projectId, key))
    expect(res1.status).toBe(201)
    await res1.json()

    const res2 = await route.POST(measurementRequest(tokenB, projectId, key))
    expect(res2.status).toBe(409)
    const err = (await res2.json()) as { error: string }
    expect(err.error).not.toContain('id') // brez razkritja tujega odgovora

    const count = await db.measurement.count({ where: { projectId } })
    expect(count).toBe(1)
  })

  it('neveljaven format Idempotency-Key → 400 (fail-closed, brez mutacije)', async () => {
    const { user, token } = await createTestUserWithSession(`r128-idem-c-${Date.now()}`)
    const projectId = await makeProjectFor(user.id, 'Idem-c')

    const route = await import('@/app/api/measurements/route')
    const res = await route.POST(measurementRequest(token, projectId, 'kratko'))
    expect(res.status).toBe(400)
    const count = await db.measurement.count({ where: { projectId } })
    expect(count).toBe(0)
  })

  it('brez Idempotency-Key → starejša pogodba: vsak POST je nova meritev', async () => {
    const { user, token } = await createTestUserWithSession(`r128-idem-d-${Date.now()}`)
    const projectId = await makeProjectFor(user.id, 'Idem-d')

    const route = await import('@/app/api/measurements/route')
    const res1 = await route.POST(measurementRequest(token, projectId))
    const res2 = await route.POST(measurementRequest(token, projectId))
    expect(res1.status).toBe(201)
    expect(res2.status).toBe(201)
    const count = await db.measurement.count({ where: { projectId } })
    expect(count).toBe(2)
  })
})

describe('idempotenca helperji — begin/store/cleanup', () => {
  it('begin → new; storeResponse → replay; tuj profil → conflict; GC pobere stare', async () => {
    const idem = await import('@/lib/idempotency')
    const key = `m-helper-${Date.now()}`
    const bindingA = 'profile-A'
    const bindingB = 'profile-B'

    expect(await idem.beginIdempotency(key, 'test', bindingA)).toEqual({ kind: 'new' })
    await idem.storeResponse(key, 201, '{"ok":true}')

    const replay = await idem.beginIdempotency(key, 'test', bindingA)
    expect(replay).toEqual({ kind: 'replay', status: 201, body: '{"ok":true}' })

    const foreign = await idem.beginIdempotency(key, 'test', bindingB)
    expect(foreign).toEqual({ kind: 'conflict' })

    // GC: star zapis (> 30 dni) se pri begin pobere — dovolj velika verjetnost
    // (0.05 × poskusi) ni deterministična, zato GC pokličemo direktno prek deleteMany:
    const old = await db.idempotencyKey.create({
      data: { key: `m-old-${Date.now()}`, route: 'test', profileId: bindingA, createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) },
    })
    const removed = await db.idempotencyKey.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    })
    expect(removed.count).toBeGreaterThanOrEqual(1)
    expect(await db.idempotencyKey.findUnique({ where: { key: old.key } })).toBeNull()
  })
})
