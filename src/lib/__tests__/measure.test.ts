// Roksal — testi varnosti javne samomeritve (R133, issue #5 §8)
// ---------------------------------------------------------------------------
// Dokazuje §8 pogodbo na obeh površinah (helperji + rute direktno, baza
// roksal_test prek globalSetup):
//   • scoped token: merilna povezava je LOČEN žeton (measureToken) —
//     revokacija/potek portala ne vpliva nanj in obratno;
//   • življenjski cikl: potek, revokacija, onemogočeno — VSA neveljavna
//     stanja = ISTA 404 (enumeration protection);
//   • shared rate limit (checkRate): GET 30/10 min na IP → 31. → 429;
//   • idempotency: isti Idempotency-Key → replay ISTEGA odgovora (R128
//     transakcijska rezervacija — race pot), natanko 1 meritev;
//   • duplicate protection: identična pošiljanja v 30 min → obstoječi id;
//   • anti-abuse: strop telesa 8 kB → 413;
//   • ownership: Measurement.createdBy = 'public:measure' + dedupeHash;
//   • audit: MEASURE_VIEW / MEASURE_SUBMIT / MEASURE_DUPLICATE /
//     MEASURE_REJECTED z hashiranim IP (surov IP NI v bazi);
//   • upravljanje: measureEnable izda kripto žeton (zapuščinski cuid →
//     rotacija), measureRevoke je trajna; enable po preklicu = NOV žeton.

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import {
  DEFAULT_MEASURE_EXPIRY_DAYS,
  MAX_MEASURE_EXPIRY_DAYS,
  MEASURE_DEDUPE_WINDOW_MS,
  PUBLIC_MEASURE_OWNER,
  PUBLIC_MEASURE_PRINCIPAL,
  generateMeasureToken,
  measureDedupeHash,
  measureExpiryFromDays,
  measureValidity,
} from '@/lib/measure'

const BASE = 'http://localhost/api/public/measure'

function getRequest(token: string, ip: string): Request {
  return new Request(`${BASE}?token=${encodeURIComponent(token)}`, {
    headers: { 'x-forwarded-for': ip, 'user-agent': 'vitest-measure' },
  })
}

function postRequest(body: unknown, ip: string, idemKey?: string): Request {
  return new Request(BASE, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
      'user-agent': 'vitest-measure',
      ...(idemKey ? { 'Idempotency-Key': idemKey } : {}),
    },
    body: JSON.stringify(body),
  })
}

function submitPayload(token: string, over: Record<string, unknown> = {}) {
  return {
    token,
    points: [
      [46.1, 14.8],
      [46.1005, 14.801],
    ],
    skupajM: 42.5,
    imeStranke: 'Test Stranka',
    ...over,
  }
}

async function makeMeasureProject(naziv: string, opts: {
  measureToken?: string | null
  measureEnabled?: boolean
  measureTokenExpiresAt?: Date | null
  measureTokenRevokedAt?: Date | null
} = {}): Promise<string> {
  const customer = await db.customer.create({ data: { ime: `R133-MEASURE-${naziv}`, naslov: 'Test 1' } })
  const project = await db.project.create({
    data: {
      customerId: customer.id,
      nazivProjekta: naziv,
      measureToken: opts.measureToken ?? null,
      measureEnabled: opts.measureEnabled ?? false,
      measureTokenExpiresAt: opts.measureTokenExpiresAt ?? null,
      measureTokenRevokedAt: opts.measureTokenRevokedAt ?? null,
    },
  })
  return project.id
}

// ---------------------------------------------------------------------------
// Helperji (čisti enoti, brez baze)
// ---------------------------------------------------------------------------

describe('measure helperji — žeton, veljavnost, dedupe hash (R133 §8)', () => {
  it('generateMeasureToken je kriptografsko varen: dva klica različna, 24 znakov base64url', () => {
    const a = generateMeasureToken()
    const b = generateMeasureToken()
    expect(a).not.toBe(b)
    expect(a).toHaveLength(24)
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('measureExpiryFromDays: privzeto 90 dni, clamp 1..365', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    expect(measureExpiryFromDays(DEFAULT_MEASURE_EXPIRY_DAYS, now).getTime() - now.getTime()).toBe(90 * 86400000)
    expect(measureExpiryFromDays(0, now).getTime() - now.getTime()).toBe(86400000)
    expect(measureExpiryFromDays(100_000, now).getTime() - now.getTime()).toBe(
      MAX_MEASURE_EXPIRY_DAYS * 86400000,
    )
  })

  it('measureValidity: REVOKED premaga vse; EXPIRED in DISABLED ločeno; konstante so brez presenečenj', () => {
    const past = new Date(Date.now() - 1000)
    const future = new Date(Date.now() + 86400000)
    expect(measureValidity({ measureEnabled: true, measureTokenExpiresAt: future, measureTokenRevokedAt: null })).toBe('OK')
    expect(measureValidity({ measureEnabled: false, measureTokenExpiresAt: future, measureTokenRevokedAt: null })).toBe('DISABLED')
    expect(measureValidity({ measureEnabled: true, measureTokenExpiresAt: past, measureTokenRevokedAt: null })).toBe('EXPIRED')
    // revokacija premaga tudi onemogočeno povezavo in pretečen potek
    expect(measureValidity({ measureEnabled: false, measureTokenExpiresAt: past, measureTokenRevokedAt: past })).toBe('REVOKED')
    // ownership/principal markerja sta stabilna pogodba (notranji ugled)
    expect(PUBLIC_MEASURE_OWNER).toBe('public:measure')
    expect(PUBLIC_MEASURE_PRINCIPAL).toBe('public:measure')
  })

  it('measureDedupeHash: determinističen, 32 hex, razlikuje točke/dolžino/višino/projekt; surovih podatkov ni', () => {
    const points: Array<[number, number]> = [
      [46.1, 14.8],
      [46.1005, 14.801],
    ]
    const base = measureDedupeHash('proj-1', points, 42.5, 1800)
    expect(base).toBe(measureDedupeHash('proj-1', points.map((p) => [...p]) as Array<[number, number]>, 42.5, 1800))
    expect(base).toHaveLength(32)
    expect(base).toMatch(/^[0-9a-f]+$/)
    // drug projekt → drug hash
    expect(measureDedupeHash('proj-2', points, 42.5, 1800)).not.toBe(base)
    // zaokrožitev na 6 decimalk — enaka točka v drugi natančnosti = ISTI hash
    expect(measureDedupeHash('proj-1', [[46.1, 14.8], [46.1005, 14.801]], 42.5, 1800)).toBe(base)
    // druga dolžina/višina → drug hash
    expect(measureDedupeHash('proj-1', points, 43.0, 1800)).not.toBe(base)
    expect(measureDedupeHash('proj-1', points, 42.5, 2000)).not.toBe(base)
    expect(base).not.toContain('46.1')
  })
})

// ---------------------------------------------------------------------------
// Rute (roksal_test)
// ---------------------------------------------------------------------------

describe('javna merilna rute — veljavnost, audit, dedupe, idempotency (R133 §8)', () => {
  let uniqueIpCounter = 0
  const nextIp = () => `10.88.${(uniqueIpCounter += 1)}.1`

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('GET z veljavnim žetonom: minimalni DTO + MEASURE_VIEW dnevnik s hashiranim IP', async () => {
    const token = generateMeasureToken()
    const projectId = await makeMeasureProject('Measure-get', { measureToken: token, measureEnabled: true })
    const route = await import('@/app/api/public/measure/route')
    const res = await route.GET(getRequest(token, nextIp()))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { nazivProjekta: string; stranka: string }
    expect(body.nazivProjekta).toBe('Measure-get')
    expect(body.stranka).toContain('R133-MEASURE')
    // audit: MEASURE_VIEW, brez surovega IP-ja (hash 32 hex)
    const log = await db.auditLog.findFirst({
      where: { akcija: 'MEASURE_VIEW', projectId },
      orderBy: { timestamp: 'desc' },
    })
    expect(log).not.toBeNull()
    expect(log!.ipAddress).toMatch(/^[0-9a-f]{32}$/)
    expect(log!.ipAddress).not.toContain('10.88')
  })

  it('VSA neveljavna stanja = ISTA 404 (neznan, pretečen, preklican, onemogočen) + MEASURE_REJECTED', async () => {
    const route = await import('@/app/api/public/measure/route')
    type Case = { label: string; token: string; opts?: Parameters<typeof makeMeasureProject>[1] }
    const cases: Case[] = [
      { label: 'neznan', token: generateMeasureToken() },
      { label: 'pretečen', token: generateMeasureToken(), opts: { measureToken: generateMeasureToken(), measureEnabled: true, measureTokenExpiresAt: new Date(Date.now() - 3600_000) } },
      { label: 'preklican', token: generateMeasureToken(), opts: { measureToken: generateMeasureToken(), measureEnabled: false, measureTokenRevokedAt: new Date(Date.now() - 3600_000) } },
      { label: 'onemogočen', token: generateMeasureToken(), opts: { measureToken: generateMeasureToken(), measureEnabled: false } },
    ]
    for (const c of cases) {
      if (c.opts) await makeMeasureProject(`Measure-404-${c.label}`, c.opts)
      const res = await route.GET(getRequest(c.token, nextIp()))
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'Povezava ni veljavna' })
    }
    const rejected = await db.auditLog.findMany({
      where: { akcija: 'MEASURE_REJECTED', projectId: null },
      orderBy: { timestamp: 'desc' },
      take: 4,
    })
    expect(rejected.length).toBeGreaterThanOrEqual(4)
  })

  it('POST ustvari meritev z ownership markerjem + dedupeHash; lastUsed posodobljen; MEASURE_SUBMIT dnevnik', async () => {
    const token = generateMeasureToken()
    const projectId = await makeMeasureProject('Measure-post', { measureToken: token, measureEnabled: true })
    const route = await import('@/app/api/public/measure/route')
    const res = await route.POST(postRequest(submitPayload(token), nextIp()))
    expect(res.status).toBe(201)
    const body = (await res.json()) as { ok: boolean; id: string }
    expect(body.ok).toBe(true)
    const m = await db.measurement.findUnique({ where: { id: body.id } })
    expect(m).not.toBeNull()
    expect(m!.createdBy).toBe('public:measure')
    expect(m!.dedupeHash).toMatch(/^[0-9a-f]{32}$/)
    expect(m!.dolzinaMm).toBe(42500)
    expect(JSON.parse(m!.arMetadata!)).toMatchObject({ source: 'customer-map' })
    const project = await db.project.findUnique({ where: { id: projectId } })
    expect(project!.measureTokenLastUsedAt).not.toBeNull()
    const log = await db.auditLog.findFirst({ where: { akcija: 'MEASURE_SUBMIT', projectId }, orderBy: { timestamp: 'desc' } })
    expect(log).not.toBeNull()
  })

  it('§8 duplicate protection: identična pošiljanja v oknu 30 min → ISTI id, duplicate:true, brez nove vrstice', async () => {
    const token = generateMeasureToken()
    const projectId = await makeMeasureProject('Measure-dupe', { measureToken: token, measureEnabled: true })
    const route = await import('@/app/api/public/measure/route')
    const first = await route.POST(postRequest(submitPayload(token), nextIp()))
    expect(first.status).toBe(201)
    const firstBody = (await first.json()) as { id: string }
    const second = await route.POST(postRequest(submitPayload(token), nextIp()))
    expect(second.status).toBe(200)
    const secondBody = (await second.json()) as { id: string; duplicate: boolean }
    expect(secondBody.id).toBe(firstBody.id)
    expect(secondBody.duplicate).toBe(true)
    // štetje po project ID (imeni se lahko ponavljajo med runi — testna baza je trajna)
    const count = await db.measurement.count({ where: { projectId } })
    expect(count).toBe(1)
    const dupLog = await db.auditLog.findFirst({ where: { akcija: 'MEASURE_DUPLICATE', projectId }, orderBy: { timestamp: 'desc' } })
    expect(dupLog).not.toBeNull()
  })

  it('§8 idempotency: isti Idempotency-Key (različen payload) → replay ISTEGA 201 odgovora, natanko 1 meritev', async () => {
    const token = generateMeasureToken()
    const projectId = await makeMeasureProject('Measure-idem', { measureToken: token, measureEnabled: true })
    const route = await import('@/app/api/public/measure/route')
    const key = `r133-idem-${Date.now()}`
    const first = await route.POST(postRequest(submitPayload(token), nextIp(), key))
    expect(first.status).toBe(201)
    const firstBody = (await first.json()) as { id: string }
    // drugi poizkus z ISTIM ključem, RAZLIČNO vsebino (dedupe ne zadane) → race → replay
    const second = await route.POST(
      postRequest(submitPayload(token, { points: [[46.2, 14.9], [46.2005, 14.901]] }), nextIp(), key),
    )
    expect(second.status).toBe(201)
    expect(second.headers.get('Idempotent-Replay')).toBe('true')
    const secondBody = (await second.json()) as { id: string }
    expect(secondBody.id).toBe(firstBody.id)
    const count = await db.measurement.count({ where: { projectId } })
    expect(count).toBe(1)
  })

  it('§8 anti-abuse: neveljaven Idempotency-Key → 400; prekratek žeton (zod) → 400; preveliko telo → 413; neznan žeton → 404 brez meritve', async () => {
    const token = generateMeasureToken()
    const projectId = await makeMeasureProject('Measure-abuse', { measureToken: token, measureEnabled: true })
    const route = await import('@/app/api/public/measure/route')
    // neveljaven ključ (prekratek / nevarni znaki)
    const badKey = await route.POST(postRequest(submitPayload(token), nextIp(), 'x'))
    expect(badKey.status).toBe(400)
    // prekratek žeton → zod 400 (validacija pred razrešitvijo žetona)
    const short = await route.POST(postRequest(submitPayload('kratko'), nextIp()))
    expect(short.status).toBe(400)
    // preveliko telo (> 8 kB surovega besedila)
    const huge = await route.POST(postRequest(submitPayload(token, { opomba: 'x'.repeat(9000) }), nextIp()))
    expect(huge.status).toBe(413)
    // neznan žeton ustrezne dolžine → 404
    const unknown = await route.POST(postRequest(submitPayload('neznan-zeton-qa-133'), nextIp()))
    expect(unknown.status).toBe(404)
    const count = await db.measurement.count({ where: { projectId } })
    expect(count).toBe(0)
  })

  it('§8 shared rate limit: 30 GET na IP preživi, 31. → 429 + Retry-After', async () => {
    const token = generateMeasureToken()
    await makeMeasureProject('Measure-rate', { measureToken: token, measureEnabled: true })
    const route = await import('@/app/api/public/measure/route')
    const ip = nextIp()
    for (let i = 0; i < 30; i += 1) {
      const res = await route.GET(getRequest(token, ip))
      expect(res.status).toBe(200)
    }
    const blocked = await route.GET(getRequest(token, ip))
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('Retry-After')).toBeDefined()
  })
})

describe('merilna povezava — upravljanje (R133 §8)', () => {
  let uniqueIpCounter = 0
  const nextIp = () => `10.89.${(uniqueIpCounter += 1)}.1`

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mgmtRequest(
    method: 'GET' | 'POST',
    token: string,
    projectId?: string,
    body?: Record<string, unknown>,
  ): Request {
    const url = method === 'GET' ? `http://localhost/api/portal?projectId=${projectId}` : 'http://localhost/api/portal'
    return new Request(url, {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        origin: 'http://localhost',
      },
      ...(method === 'POST' ? { body: JSON.stringify({ projectId, ...body }) } : {}),
    })
  }

  it('measureEnable izda kripto žeton (zapuščinski cuid → rotacija) z privzetim potekom; measureRevoke je trajna; audit z pravim akterjem', async () => {
    const { user, token } = await createTestUserWithSession(`r133-measure-mgmt-${Date.now()}`, 'VODJA')
    // zapuščinski žeton = kopija clientToken (backfill R133) — NI kripto formata;
    // unikaten na run (trajna testna baza — kolizija z ostanki prejšnjih runov)
    const legacyToken = `cuid-legacy-copy-${Date.now()}`
    const customer = await db.customer.create({ data: { ime: `R133-MGMT-${Date.now()}`, naslov: 'Test 1' } })
    const project = await db.project.create({
      data: { customerId: customer.id, nazivProjekta: 'Measure-mgmt', monterId: user.id, measureToken: legacyToken, measureEnabled: true },
    })

    const route = await import('@/app/api/portal/route')
    const enableRes = await route.POST(mgmtRequest('POST', token, project.id, { action: 'measureEnable' }))
    expect(enableRes.status).toBe(200)
    const enabled = (await enableRes.json()) as {
      measure: { enabled: boolean; token: string | null; expiresAt: string | null; revokedAt: string | null }
    }
    expect(enabled.measure.enabled).toBe(true)
    expect(enabled.measure.token).not.toBe(legacyToken)
    expect(enabled.measure.token).toHaveLength(24)
    expect(enabled.measure.expiresAt).not.toBeNull()
    const expiryDays = Math.round((new Date(enabled.measure.expiresAt!).getTime() - Date.now()) / 86400000)
    expect(expiryDays).toBeGreaterThanOrEqual(89)
    expect(expiryDays).toBeLessThanOrEqual(90)
    expect(enabled.measure.revokedAt).toBeNull()

    // revokacija: povezava mrtva, javni dostop → ISTA 404 kot neznan žeton
    const revokeRes = await route.POST(mgmtRequest('POST', token, project.id, { action: 'measureRevoke' }))
    expect(revokeRes.status).toBe(200)
    const revoked = (await revokeRes.json()) as { measure: { enabled: boolean; revokedAt: string | null } }
    expect(revoked.measure.enabled).toBe(false)
    expect(revoked.measure.revokedAt).not.toBeNull()

    const publicRoute = await import('@/app/api/public/measure/route')
    const publicRes = await publicRoute.GET(getRequest(enabled.measure.token!, nextIp()))
    expect(publicRes.status).toBe(404)

    // audit: MEASURE_REVOKE z pravim akterjem (ne 'system')
    const audit = await db.auditLog.findFirst({
      where: { akcija: 'MEASURE_REVOKE', projectId: project.id },
      orderBy: { timestamp: 'desc' },
    })
    expect(audit).not.toBeNull()
    expect(audit!.userId).toBe(user.id)
  })

  it('API ključ ne upravlja merilne povezave → 403 (samo uporabniške seje)', async () => {
    const { hashApiKey } = await import('@/lib/password')
    const rawKey = `rkm_test_${Date.now()}_m133`
    await db.apiKey.create({
      data: {
        name: `vitest-measure-${Date.now()}`,
        keyHash: hashApiKey(rawKey),
        keyPrefix: rawKey.slice(0, 12),
        scopes: 'projects:read',
      },
    })
    const { user } = await createTestUserWithSession(`r133-measure-key-${Date.now()}`)
    const customer = await db.customer.create({ data: { ime: `R133-KEY-${Date.now()}`, naslov: 'Test 1' } })
    const project = await db.project.create({ data: { customerId: customer.id, nazivProjekta: 'Measure-key', monterId: user.id } })

    const route = await import('@/app/api/portal/route')
    const res = await route.POST(
      new Request('http://localhost/api/portal', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${rawKey}`, origin: 'http://localhost' },
        body: JSON.stringify({ projectId: project.id, action: 'measureEnable' }),
      }),
    )
    expect(res.status).toBe(403)
  })

  it('§8 enable po preklicu izda NOV žeton (revokacija je trajna — UI nikoli ne kaže žive povezave za mrtvi žeton)', async () => {
    const { user, token } = await createTestUserWithSession(`r133-measure-rev-${Date.now()}`, 'VODJA')
    const cryptoToken = generateMeasureToken()
    const customer = await db.customer.create({ data: { ime: `R133-REV-${Date.now()}`, naslov: 'Test 1' } })
    const project = await db.project.create({
      data: {
        customerId: customer.id,
        nazivProjekta: 'Measure-revive',
        monterId: user.id,
        measureToken: cryptoToken,
        measureEnabled: false,
        measureTokenRevokedAt: new Date(Date.now() - 3600_000),
      },
    })

    const route = await import('@/app/api/portal/route')
    const enableRes = await route.POST(mgmtRequest('POST', token, project.id, { action: 'measureEnable' }))
    expect(enableRes.status).toBe(200)
    const enabled = (await enableRes.json()) as { measure: { token: string | null; revokedAt: string | null; enabled: boolean } }
    expect(enabled.measure.enabled).toBe(true)
    // NOV žeton (preklicani je trajno mrtev) + revokedAt počiščen
    expect(enabled.measure.token).not.toBe(cryptoToken)
    expect(enabled.measure.token).toHaveLength(24)
    expect(enabled.measure.revokedAt).toBeNull()

    // enable po onemogočanju (BREZ preklica) ohrani isti URL
    await route.POST(mgmtRequest('POST', token, project.id, { action: 'measureDisable' }))
    const reEnableRes = await route.POST(mgmtRequest('POST', token, project.id, { action: 'measureEnable' }))
    const reEnabled = (await reEnableRes.json()) as { measure: { token: string | null } }
    expect(reEnabled.measure.token).toBe(enabled.measure.token)
  })
})

// R133 §8: okno dedupe je del javne pogodbe — dokumentirana vrednost.
describe('meje okna (konstanta)', () => {
  it('MEASURE_DEDUPE_WINDOW_MS je 30 minut', () => {
    expect(MEASURE_DEDUPE_WINDOW_MS).toBe(30 * 60 * 1000)
  })
})
