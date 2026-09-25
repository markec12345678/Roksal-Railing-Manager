// R139 — integracijski testi novih rund (issue #5 §20 + §17).
// ---------------------------------------------------------------------------
//   • customers POST idempotenca (§20): retry s ISTIM Idempotency-Key vrne
//     ORIGINALNI odgovor (Idempotent-Replay: true), v bazi NATANKO ena
//     stranka; neveljaven ključ → 400; brez ključa → starejša pogodba
//     (vsak POST = nova stranka).
//   • schedules GET pagination (§17): ?limit/offset režejo polje, neveljavne
//     številke → fail-closed privzeti limit, odzivna oblika (polje) ista.
//   • users GET pagination (§17): ADMIN ?limit=1 → največ 1 vpis.
//
// Handlerji direktno, baza roksal_test prek globalSetup (vzorec R128).
// Brez AI, brez naključja (unikatni e-naslovi izključno za izolacijo testov).

import { describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import { POST as customersPost, GET as customersGet } from '@/app/api/customers/route'
import { GET as schedulesGet } from '@/app/api/schedules/route'
import { GET as usersGet } from '@/app/api/users/route'

const BASE = 'http://localhost/api'

function jsonReq(path: string, token: string | null, init: { method?: string; body?: unknown; key?: string } = {}): Request {
  return new Request(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.key ? { 'idempotency-key': init.key } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
}

describe('customers POST — idempotenca (R139 §20)', () => {
  it('isti Idempotency-Key dvakrat → replay originala, NATANKO ena stranka', async () => {
    const stamp = `r139-cust-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const { token } = await createTestUserWithSession(`r139-idem-${Date.now()}`)

    const body = { ime: `${stamp} d.o.o.`, naslov: 'Ulica 1, Ljubljana' }
    const first = await customersPost(jsonReq('/customers', token, { method: 'POST', body, key: `r139key-${stamp}` }))
    expect(first.status).toBe(201)
    const firstData = await first.json()

    const second = await customersPost(jsonReq('/customers', token, { method: 'POST', body, key: `r139key-${stamp}` }))
    expect(second.status).toBe(201)
    expect(second.headers.get('Idempotent-Replay')).toBe('true')
    const secondData = await second.json()
    expect(secondData.id).toBe(firstData.id)

    const rows = await db.customer.count({ where: { ime: `${stamp} d.o.o.` } })
    expect(rows).toBe(1)
  })

  it('neveljaven Idempotency-Key → 400 (fail-closed)', async () => {
    const { token } = await createTestUserWithSession(`r139-idem-b-${Date.now()}`)
    const res = await customersPost(
      jsonReq('/customers', token, {
        method: 'POST',
        body: { ime: `r139-badkey-${Date.now()}`, naslov: 'Test 2' },
        key: 'kratki',
      }),
    )
    expect(res.status).toBe(400)
  })

  it('brez Idempotency-Key → starejša pogodba (vsak POST ustvari)', async () => {
    const stamp = `r139-noidem-${Date.now()}`
    const { token } = await createTestUserWithSession(`r139-idem-c-${Date.now()}`)
    const body = { ime: stamp, naslov: 'Test 3' }
    const a = await customersPost(jsonReq('/customers', token, { method: 'POST', body }))
    const b = await customersPost(jsonReq('/customers', token, { method: 'POST', body }))
    expect(a.status).toBe(201)
    expect(b.status).toBe(201)
    const aData = await a.json()
    const bData = await b.json()
    expect(bData.id).not.toBe(aData.id)
  })

  it('GET še vedno deluje po idempotenčnih spremembah (limit/offset nespremenjen)', async () => {
    const { token } = await createTestUserWithSession(`r139-idem-d-${Date.now()}`)
    const res = await customersGet(jsonReq('/customers?limit=1', token))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeLessThanOrEqual(1)
  })
})

describe('schedules GET — pagination (R139 §17)', () => {
  async function makeSchedules(count: number): Promise<{ projectId: string }> {
    const stamp = `r139-sched-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const customer = await db.customer.create({ data: { ime: `Stranka ${stamp}`, naslov: 'Test 4' } })
    const project = await db.project.create({
      data: { customerId: customer.id, nazivProjekta: `Projekt ${stamp}` },
    })
    const base = new Date('2026-10-01T08:00:00.000Z')
    for (let i = 0; i < count; i++) {
      await db.installationSchedule.create({
        data: {
          projectId: project.id,
          datumZacetka: new Date(base.getTime() + i * 86400000),
          datumKonca: new Date(base.getTime() + i * 86400000 + 8 * 3600000),
          status: 'NAVRTENO',
          predvideneUre: 8,
        },
      })
    }
    return { projectId: project.id }
  }

  it('?limit=2 vrne največ 2, oblika (polje) nespremenjena', async () => {
    const { token } = await createTestUserWithSession(`r139-sched-a-${Date.now()}`)
    const { projectId } = await makeSchedules(3)
    const res = await schedulesGet(jsonReq(`/schedules?projectId=${projectId}&limit=2`, token))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBe(2)
  })

  it('?offset=1 preskoči prvi (orderBy datumZacetka asc)', async () => {
    const { token } = await createTestUserWithSession(`r139-sched-b-${Date.now()}`)
    const { projectId } = await makeSchedules(3)
    const full = await (await schedulesGet(jsonReq(`/schedules?projectId=${projectId}`, token))).json()
    const shifted = await (
      await schedulesGet(jsonReq(`/schedules?projectId=${projectId}&offset=1`, token))
    ).json()
    expect(shifted.length).toBe(full.length - 1)
    expect(shifted[0].id).toBe(full[1].id)
  })

  it('neveljaven limit → fail-closed privzeti limit (vse vrstice)', async () => {
    const { token } = await createTestUserWithSession(`r139-sched-c-${Date.now()}`)
    const { projectId } = await makeSchedules(2)
    const res = await schedulesGet(jsonReq(`/schedules?projectId=${projectId}&limit=-5`, token))
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBe(2)
  })
})

describe('users GET — pagination (R139 §17)', () => {
  it('ADMIN ?limit=1 → največ 1 vpis, oblika (polje) nespremenjena', async () => {
    const { token } = await createTestUserWithSession(`r139-users-${Date.now()}`, 'ADMIN')
    const res = await usersGet(jsonReq('/users?limit=1', token))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeLessThanOrEqual(1)
  })
})
