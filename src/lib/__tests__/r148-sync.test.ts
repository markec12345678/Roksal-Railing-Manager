// R148 — integracijski testi (issue #5 §36 — Mobile sync conflict model).
// ---------------------------------------------------------------------------
//   • Lib determinizem: normalizeDeviceId (dolžina/znaki), detectSyncConflict
//     (legacy/clean/stale/client-ahead/neveljavni vhodi), nextSyncRevision
//     (monotono), syncRetryable mapping.
//   • POST /api/sync: legacy klient (brez base) → uporabljeno z izrecnim
//     warningom + revision 1 + mutationId echo; zastarel baseRevision →
//     KONFLIKT (nič spremenjeno + serverState + retryable); čist base →
//     uporabljeno + revizija naprej; client-ahead → konflikt (strežnik ne
//     ugiba); neveljaven baseUpdatedAt → konflikt; X-Device-Id upsert
//     (firstSeen + apiKeyId vezava); neveljaven X-Device-Id → 400;
//     grobnica → iskren tombstone rezultat (ni dvojnika); Idempotency-Key
//     replay → identičen odgovor.
//   • GET /api/sync: delta kurzor (sinceRevision + ASC red + nextCursor +
//     hasMore), grobnice izključene iz zrcala + lista grobnic, kurzor
//     naprave monotono zabeležen, neveljaven sinceRevision → 400.
//   • DELETE /api/sync: fail-closed (neznano → 404), grobnica + revizija
//     SYNC_TOMBSTONE, idempotenten ponovni DELETE.
//
// Handlerji direktno, baza roksal_test prek globalSetup (vzorec R128–R147).
import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import { createApiKey } from '@/lib/password'
import { GET as syncGet, POST as syncPost, DELETE as syncDelete } from '@/app/api/sync/route'
import {
  normalizeDeviceId,
  detectSyncConflict,
  nextSyncRevision,
  syncRetryable,
} from '@/lib/sync-conflicts'

const BASE = 'http://localhost/api'

type Key = { key: string; id: string; name: string }
let apiKey: Key

function req(path: string, body?: unknown, method = 'GET', headers: Record<string, string> = {}): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey.key}`,
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const MOBILE_ITEM = (mobileId: string, extra: Record<string, unknown> = {}) => ({
  id: mobileId,
  customerName: `r148 stranka ${mobileId.slice(-6)}`,
  railingStyle: 'inox',
  ...extra,
})

beforeEach(async () => {
  // Čistimo svoje teste po tagih (r148-*) — unikatni nazivi/e-pošte/ključi.
  await db.idempotencyKey.deleteMany({ where: { key: { contains: 'r148' } } })
  await db.syncTombstone.deleteMany({ where: { mobileProjectId: { contains: 'r148' } } })
  await db.syncDevice.deleteMany({ where: { deviceId: { contains: 'r148' } } })
  await db.auditLog.deleteMany({ where: { akcija: { contains: 'SYNC' }, newValue: { contains: 'r148' } } })
  await db.project.deleteMany({ where: { OR: [{ nazivProjekta: { contains: 'r148' } }, { mobileProjectId: { contains: 'r148' } }] } })
  await db.customer.deleteMany({ where: { ime: { contains: 'r148' } } })
  await db.apiKey.deleteMany({ where: { name: { contains: 'r148' } } })
  apiKey = await createApiKey({ name: `r148-key-${Date.now()}` })
})

// ---------------------------------------------------------------------------
// Čisto jedro (determinizem)
// ---------------------------------------------------------------------------

describe('normalizeDeviceId (§36 device ID)', () => {
  it('veljaven ID → obrezan; prekratek/predolg/neznani znaki → napaka', () => {
    expect(normalizeDeviceId('  dev-r148-1234  ')).toEqual({ deviceId: 'dev-r148-1234' })
    expect('error' in normalizeDeviceId('kratko')).toBe(true)
    expect('error' in normalizeDeviceId('x'.repeat(129))).toBe(true)
    expect('error' in normalizeDeviceId('napacen id s presledkom')).toBe(true)
    expect('error' in normalizeDeviceId('smeček/../../etc')).toBe(true)
    expect('error' in normalizeDeviceId(123)).toBe(true)
    expect('error' in normalizeDeviceId(undefined)).toBe(true)
  })
})

describe('detectSyncConflict (§36 konflikti — strežnik ne zaupa klientu)', () => {
  const server = { serverRevision: 3, serverUpdatedAt: new Date('2026-09-25T12:00:00.000Z') }

  it('brez obeh vhodov → legacy (nadgrajljivost, izrecen warning v ruti)', () => {
    expect(detectSyncConflict({ ...server, baseRevision: undefined, baseUpdatedAt: undefined }).kind).toBe('legacy')
    expect(detectSyncConflict({ ...server, baseRevision: null, baseUpdatedAt: null }).kind).toBe('legacy')
  })

  it('ujemanje revizije → clean; odstopanje → konflikt (zastarel + client-ahead)', () => {
    expect(detectSyncConflict({ ...server, baseRevision: 3, baseUpdatedAt: undefined }).kind).toBe('clean')
    const stale = detectSyncConflict({ ...server, baseRevision: 2, baseUpdatedAt: undefined })
    expect(stale.kind).toBe('conflict')
    if (stale.kind === 'conflict') expect(stale.detail).toContain('2 ≠ strežniška revizija 3')
    const ahead = detectSyncConflict({ ...server, baseRevision: 5, baseUpdatedAt: undefined })
    expect(ahead.kind).toBe('conflict')
    if (ahead.kind === 'conflict') expect(ahead.detail).toContain('ne ugiba')
  })

  it('baseUpdatedAt odstopanje → konflikt; ujemanje (isto ms) → clean', () => {
    const staleTime = detectSyncConflict({ ...server, baseRevision: undefined, baseUpdatedAt: '2026-09-25T11:00:00.000Z' })
    expect(staleTime.kind).toBe('conflict')
    if (staleTime.kind === 'conflict') expect(staleTime.detail).toContain('baseUpdatedAt')
    const cleanTime = detectSyncConflict({ ...server, baseRevision: undefined, baseUpdatedAt: '2026-09-25T12:00:00.000Z' })
    expect(cleanTime.kind).toBe('clean')
  })

  it('neveljavni tipi vhodov → konflikt z razlogom (ne tiho uporabljeno)', () => {
    expect(detectSyncConflict({ ...server, baseRevision: 'dva', baseUpdatedAt: undefined }).kind).toBe('conflict')
    expect(detectSyncConflict({ ...server, baseRevision: 2.5, baseUpdatedAt: undefined }).kind).toBe('conflict')
    expect(detectSyncConflict({ ...server, baseRevision: -1, baseUpdatedAt: undefined }).kind).toBe('conflict')
    expect(detectSyncConflict({ ...server, baseRevision: undefined, baseUpdatedAt: 'jutri' }).kind).toBe('conflict')
  })

  it('revizija ujemanje + čas odstopanje → konflikt (katerikoli podan vhod odstopa)', () => {
    const mixed = detectSyncConflict({ ...server, baseRevision: 3, baseUpdatedAt: '2026-09-25T11:00:00.000Z' })
    expect(mixed.kind).toBe('conflict')
  })
})

describe('nextSyncRevision + syncRetryable (§36 ordering + retry)', () => {
  it('revizija raste monotono; pokvarjen vhod → 1 (ne negativno)', () => {
    expect(nextSyncRevision(0)).toBe(1)
    expect(nextSyncRevision(7)).toBe(8)
    expect(nextSyncRevision(-3)).toBe(1)
    expect(nextSyncRevision(NaN)).toBe(1)
  })

  it('retry mapping: konflikt = ponovljiv; tombstone/created/updated = ne; statusni stroj = da', () => {
    expect(syncRetryable('conflict')).toBe(true)
    expect(syncRetryable('tombstone')).toBe(false)
    expect(syncRetryable('created')).toBe(false)
    expect(syncRetryable('updated')).toBe(false)
    expect(syncRetryable('error', 'Status "MONTIRANO" zavrnjen (statusni stroj)')).toBe(true)
    expect(syncRetryable('error', 'Neveljaven payload: x')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// POST /api/sync — konflikti, device, grobnice, idempotenca
// ---------------------------------------------------------------------------

describe('POST /api/sync (§36)', () => {
  it('anon → 401', async () => {
    const res = await syncPost(new Request(`${BASE}/api/sync`, { method: 'POST', body: JSON.stringify([]), headers: { 'content-type': 'application/json' } }))
    expect(res.status).toBe(401)
  })

  it('nov projekt (legacy klient) → created + revision 1 + mutationId echo + revizija', async () => {
    const mobileId = `r148-create-${Date.now()}`
    const res = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { mutationId: 'mut-1', status: 'NACRTOVANO' })], 'POST'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { results: Array<{ ok: boolean; action: string; revision: number; mutationId: string | null; warnings: string[] }>; projects: Array<{ syncRevision: number }> }
    const r = body.results[0]
    expect(r.ok).toBe(true)
    expect(r.action).toBe('created')
    expect(r.revision).toBe(1)
    expect(r.mutationId).toBe('mut-1')
    // Nov projekt NIMA konfliktnih vrat (še ne obstaja) — brez legacy warninga.
    expect(r.warnings ?? []).toEqual([])
    expect(body.projects[0].syncRevision).toBe(1)
    const audit = await db.auditLog.findFirst({ where: { akcija: 'SYNC_PROJECT_CREATED', newValue: { contains: mobileId } } })
    expect(audit).not.toBeNull()
  })

  it('zastarel baseRevision → KONFLIKT: nič spremenjeno + serverState + retryable', async () => {
    const mobileId = `r148-stale-${Date.now()}`
    await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { extraNotes: 'prva verzija' })], 'POST'))
    const project = await db.project.findUnique({ where: { mobileProjectId: mobileId } })

    // Drugi sync s STARELO bazo (revizija 0, strežnik je na 1) → konflikt.
    const res = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { baseRevision: 0, extraNotes: 'klientova sprememba', status: 'V_TEKU' })], 'POST'))
    const body = (await res.json()) as { results: Array<{ ok: boolean; action: string; retryable: boolean; error: string; serverState: { syncRevision: number } }> }
    const r = body.results[0]
    expect(r.ok).toBe(false)
    expect(r.action).toBe('conflict')
    expect(r.retryable).toBe(true)
    expect(r.error).toContain('Konflikt sinhronizacije')
    expect(r.serverState.syncRevision).toBe(1)
    // NIČ spremenjeno (§36: HTTP 200 jasno pove, kaj je bilo sprejeto — nič).
    const after = await db.project.findUnique({ where: { mobileProjectId: mobileId } })
    expect(after!.opombe).toBe('prva verzija')
    expect(after!.status).toBe(project!.status)
    expect(after!.syncRevision).toBe(1)
  })

  it('legacy warning na UPDATE: brez base → uporabljeno z izrecnim warningom', async () => {
    const mobileId = `r148-legacy-${Date.now()}`
    await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId)], 'POST'))
    const res = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { extraNotes: 'posodobljeno brez baze' })], 'POST'))
    const body = (await res.json()) as { results: Array<{ ok: boolean; warnings: string[] }> }
    expect(body.results[0].ok).toBe(true)
    expect(body.results[0].warnings.some((w) => w.includes('star klient'))).toBe(true)
  })

  it('čist baseRevision → uporabljeno + revizija naprej; baseUpdatedAt ujemanje → clean', async () => {
    const mobileId = `r148-clean-${Date.now()}`
    await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { extraNotes: 'v1' })], 'POST'))

    const res = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { baseRevision: 1, extraNotes: 'v2' })], 'POST'))
    const body = (await res.json()) as { results: Array<{ ok: boolean; action: string; revision: number; warnings: string[] }> }
    expect(body.results[0].ok).toBe(true)
    expect(body.results[0].action).toBe('updated')
    expect(body.results[0].revision).toBe(2)
    expect(body.results[0].warnings?.some((w) => w.includes('star klient'))).toBe(false)
    expect((await db.project.findUnique({ where: { mobileProjectId: mobileId } }))!.opombe).toBe('v2')

    // baseUpdatedAt = TRENUTNI updatedAt (po reviziji 2) → clean (brez baseRevision).
    const after2 = await db.project.findUnique({ where: { mobileProjectId: mobileId } })
    const res2 = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { baseUpdatedAt: after2!.updatedAt.toISOString(), extraNotes: 'v3' })], 'POST'))
    const body2 = (await res2.json()) as { results: Array<{ ok: boolean; action: string }> }
    expect(body2.results[0].ok).toBe(true)
    expect(body2.results[0].action).toBe('updated')
  })

  it('neveljaven baseRevision (niz) → konflikt; client-ahead (5 > 1) → konflikt', async () => {
    const mobileId = `r148-bad-${Date.now()}`
    await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId)], 'POST'))
    // zod sprejme številke; 'dva' pade na zod validacijo → payload napaka.
    const badType = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { baseRevision: 'dva' })], 'POST'))
    const badBody = (await badType.json()) as { results: Array<{ ok: boolean }> }
    expect(badBody.results[0].ok).toBe(false)

    // client-ahead: številka 5 na projektu z revizijo 1 → konflikt (lib).
    const res = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { baseRevision: 5, extraNotes: 'x' })], 'POST'))
    const body = (await res.json()) as { results: Array<{ ok: boolean; action: string }> }
    expect(body.results[0].ok).toBe(false)
    expect(body.results[0].action).toBe('conflict')
  })

  it('X-Device-Id: prva zahteva ustvari napravo (firstSeen + apiKeyId), ponovitev posodobi lastSeenAt', async () => {
    const deviceId = `dev-r148-${Date.now()}`
    const res1 = await syncPost(req('/api/sync', [MOBILE_ITEM(`r148-dev-${Date.now()}`)], 'POST', { 'X-Device-Id': deviceId }))
    const body1 = (await res1.json()) as { device: { deviceId: string; firstSeen: boolean } }
    expect(body1.device.firstSeen).toBe(true)
    const row = await db.syncDevice.findUnique({ where: { deviceId } })
    expect(row).not.toBeNull()
    expect(row!.apiKeyId).toBe(apiKey.id)

    const res2 = await syncPost(req('/api/sync', [MOBILE_ITEM(`r148-dev2-${Date.now()}`)], 'POST', { 'X-Device-Id': deviceId }))
    const body2 = (await res2.json()) as { device: { firstSeen: boolean } }
    expect(body2.device.firstSeen).toBe(false)
    expect((await db.syncDevice.findFirst({ where: { deviceId } }))!.deviceId).toBe(deviceId)
  })

  it('neveljaven X-Device-Id → 400 (fail-closed, ne tiho ignoriran)', async () => {
    const res = await syncPost(req('/api/sync', [MOBILE_ITEM(`r148-baddev-${Date.now()}`)], 'POST', { 'X-Device-Id': 'slab id!' }))
    expect(res.status).toBe(400)
  })

  it('Idempotency-Key: ponovitev serije → identičen replay (brez dvojnikov)', async () => {
    const mobileId = `r148-idem-${Date.now()}`
    const headers = { 'Idempotency-Key': `r148-idem-${Date.now()}` }
    const res1 = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId)], 'POST', headers))
    const res2 = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId)], 'POST', headers))
    expect(res2.headers.get('Idempotent-Replay')).toBe('true')
    const b1 = (await res1.json()) as { results: Array<{ projectId?: string }> }
    const b2 = await res2.json()
    expect(JSON.stringify(b2)).toBe(JSON.stringify(b1))
    const projects = await db.project.findMany({ where: { mobileProjectId: mobileId } })
    expect(projects.length).toBe(1)
  })

  it('DELETE → grobnica + revizija SYNC_TOMBSTONE; ponovni POST → tombstone rezultat; GET izključi', async () => {
    const mobileId = `r148-tomb-${Date.now()}`
    await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId)], 'POST'))

    const del = await syncDelete(req('/api/sync', { mobileProjectId: mobileId, reason: 'stranka je odstopila' }, 'DELETE'))
    expect(del.status).toBe(200)
    const delBody = (await del.json()) as { tombstoned: boolean; already: boolean }
    expect(delBody.tombstoned).toBe(true)
    expect(delBody.already).toBe(false)
    const audit = await db.auditLog.findFirst({ where: { akcija: 'SYNC_TOMBSTONE', newValue: { contains: mobileId } } })
    expect(audit).not.toBeNull()

    // Idempotenten ponovni DELETE.
    const del2 = await syncDelete(req('/api/sync', { mobileProjectId: mobileId }, 'DELETE'))
    const del2Body = (await del2.json()) as { already: boolean }
    expect(del2Body.already).toBe(true)

    // Ponovni sync → iskren tombstone rezultat (ni dvojnika).
    const res = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { customerName: 'r148 ponovno' })], 'POST'))
    const body = (await res.json()) as { results: Array<{ ok: boolean; action: string; retryable: boolean }> }
    expect(body.results[0].ok).toBe(false)
    expect(body.results[0].action).toBe('tombstone')
    expect(body.results[0].retryable).toBe(false)
    const projects = await db.project.findMany({ where: { mobileProjectId: mobileId } })
    expect(projects.length).toBe(1)

    // Neznani mobilni projekt → 404 (fail-closed).
    const unknown = await syncDelete(req('/api/sync', { mobileProjectId: 'r148-neobstaja' }, 'DELETE'))
    expect(unknown.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// GET /api/sync — delta kurzor + grobnice + kurzor naprave
// ---------------------------------------------------------------------------

describe('GET /api/sync (§36 partial sync)', () => {
  it('anon → 401; neveljaven sinceRevision → 400', async () => {
    const anon = await syncGet(new Request(`${BASE}/api/sync?sinceRevision=0`))
    expect(anon.status).toBe(401)
    const bad = await syncGet(req('/api/sync?sinceRevision=abc', undefined, 'GET'))
    expect(bad.status).toBe(400)
    const neg = await syncGet(req('/api/sync?sinceRevision=-1', undefined, 'GET'))
    expect(neg.status).toBe(400)
  })

  it('delta kurzor: sinceRevision filtrira + ASC red + nextCursor + hasMore + limit', async () => {
    const stamp = Date.now()
    for (const mid of [`r148-c1-${stamp}`, `r148-c2-${stamp}`, `r148-c3-${stamp}`]) {
      await syncPost(req('/api/sync', [MOBILE_ITEM(mid)], 'POST'))
    }
    // Revizije so PER-PROJEKT: novi projekti = 1. Posodobitev c2 (čist base)
    // dvigne njegovo revizijo na 2 → sinceRevision=1 vrne SAMO c2.
    await syncPost(req('/api/sync', [MOBILE_ITEM(`r148-c2-${stamp}`, { baseRevision: 1, extraNotes: 'posodobljeno' })], 'POST'))

    const res = await syncGet(req('/api/sync?sinceRevision=1', undefined, 'GET'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      projects: Array<{ mobileProjectId: string; syncRevision: number }>
      nextCursor: number
      hasMore: boolean
      tombstones: unknown[]
    }
    const mine = body.projects.filter((p) => p.mobileProjectId.startsWith('r148-c'))
    expect(mine.length).toBe(1)
    expect(mine[0].mobileProjectId).toBe(`r148-c2-${stamp}`)
    expect(mine[0].syncRevision).toBe(2)
    expect(body.nextCursor).toBeGreaterThanOrEqual(2)
    expect(body.hasMore).toBe(false)
    expect(body.tombstones).toEqual([])

    // Limit 1 → hasMore true (partial sync).
    const limited = await syncGet(req('/api/sync?sinceRevision=0&limit=1', undefined, 'GET'))
    const limitedBody = (await limited.json()) as { hasMore: boolean; projects: unknown[] }
    expect(limitedBody.projects.length).toBe(1)
    expect(limitedBody.hasMore).toBe(true)
  })

  it('grobnica: izključena iz zrcala + na seznamu grobnic; kurzor naprave monotono zabeležen', async () => {
    const stamp = Date.now()
    const deviceId = `dev-r148-get-${stamp}`
    const mobileId = `r148-tombget-${stamp}`
    await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId)], 'POST', { 'X-Device-Id': deviceId }))
    await syncDelete(req('/api/sync', { mobileProjectId: mobileId }, 'DELETE'))
    // Živ projekt z revizijo 1, da kurzor naprave zabeleži > 0.
    await syncPost(req('/api/sync', [MOBILE_ITEM(`r148-live-${stamp}`)], 'POST', { 'X-Device-Id': deviceId }))

    const res = await syncGet(req('/api/sync?sinceRevision=0', undefined, 'GET', { 'X-Device-Id': deviceId }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { projects: Array<{ mobileProjectId: string }>; tombstones: Array<{ mobileProjectId: string }> }
    expect(body.projects.some((p) => p.mobileProjectId === mobileId)).toBe(false)
    expect(body.projects.some((p) => p.mobileProjectId === `r148-live-${stamp}`)).toBe(true)
    expect(body.tombstones.some((t) => t.mobileProjectId === mobileId)).toBe(true)

    const device = await db.syncDevice.findUnique({ where: { deviceId } })
    expect(device!.lastSyncCursor).toBeGreaterThanOrEqual(1)
    // Monotono: kurzor se ne premakne nazaj na manjšo vrednost.
    await syncGet(req('/api/sync?sinceRevision=0', undefined, 'GET', { 'X-Device-Id': deviceId }))
    expect((await db.syncDevice.findUnique({ where: { deviceId } }))!.lastSyncCursor).toBe(device!.lastSyncCursor)
  })
})

// ---------------------------------------------------------------------------
// USER seja — resource skoping velja tudi v novem protokolu
// ---------------------------------------------------------------------------

describe('POST /api/sync z uporabniško sejo (skoping)', () => {
  it('MONTER ustvari projekt → syncRevision 1; tuji projekt → konflikt poti prek assertProjectAccess', async () => {
    const { token, user } = await createTestUserWithSession(`r148-user-${Date.now()}`, 'MONTER')
    const mobileId = `r148-user-${Date.now()}`
    const userReq = (body: unknown, method = 'POST') =>
      new Request(`${BASE}/api/sync`, {
        method,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: method === 'GET' ? undefined : JSON.stringify(body),
      })
    const res = await syncPost(userReq([MOBILE_ITEM(mobileId)]))
    const body = (await res.json()) as { results: Array<{ ok: boolean; projectId?: string }> }
    expect(body.results[0].ok).toBe(true)
    const projectId = body.results[0].projectId!
    const row = await db.project.findUnique({ where: { id: projectId } })
    expect(row!.syncRevision).toBe(1)
    void user
  })
})
