// Roksal — testi varnosti portala stranke (R132, issue #5 §7)
// ---------------------------------------------------------------------------
// Dokazuje §7 pogodbo na obeh površinah (helperji + rute direktno, baza
// roksal_test prek globalSetup):
//   • žeton je kriptografsko varen (randomBytes), NE Math.random();
//   • življenjski cikl: potek (privzeto 90 dni, clamp 1..365), revokacija
//     (žeton MRTAV), onemogočen portal — VSA neveljavna stanja = ISTA 404;
//   • dostopni dnevnik PortalAccess: vsak poskus (OK/EXPIRED/REVOKED/
//     RATE_LIMITED) z hashiranim IP (brez surovega IP-ja);
//   • shared rate limit na IP: 60/10 min → 61. zahtevek 429 + Retry-After;
//   • upravljanje: samo uporabniške seje (API ključ → 403), projektni dostop
//     (IDOR: tuj monter → 403), audit z pravim akterjem;
//   • minimalni DTO: javni odgovor ne vsebuje internih polj.
// Brez AI, brez naključja (unikatni e-naslovi izključno za izolacijo testov).

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import { hashApiKey } from '@/lib/password'
import {
  DEFAULT_PORTAL_EXPIRY_DAYS,
  MAX_PORTAL_EXPIRY_DAYS,
  PORTAL_LIMIT,
  generatePortalToken,
  hashIp,
  clientIpOf,
  clientIpOfHeaders,
  portalExpiryFromDays,
  portalValidity,
} from '@/lib/portal'

const BASE = 'http://localhost/api/portal'

function publicRequest(token: string, ip: string): Request {
  return new Request(`${BASE}/${token}`, {
    headers: { 'x-forwarded-for': ip, 'user-agent': 'vitest-portal' },
  })
}

function publicCall(token: string, ip: string): Parameters<typeof import('@/app/api/portal/[token]/route').GET> {
  return [publicRequest(token, ip), { params: Promise.resolve({ token }) }]
}

function mgmtRequest(
  method: 'GET' | 'POST',
  token: string,
  projectId?: string,
  body?: Record<string, unknown>,
): Request {
  const url = method === 'GET' ? `${BASE}?projectId=${projectId}` : BASE
  return new Request(url, {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    ...(method === 'POST' ? { body: JSON.stringify({ projectId, ...body }) } : {}),
  })
}

async function makeProjectFor(monterId: string, naziv: string): Promise<string> {
  const customer = await db.customer.create({ data: { ime: `R132-PORTAL-${naziv}`, naslov: 'Test 1' } })
  const project = await db.project.create({
    data: { customerId: customer.id, nazivProjekta: naziv, monterId },
  })
  return project.id
}

// ---------------------------------------------------------------------------
// Helperji (čisti enoti, brez baze)
// ---------------------------------------------------------------------------

describe('portal helperji — žeton, potek, veljavnost, IP (R132 §7)', () => {
  it('generatePortalToken je kriptografsko varen: dva klica različna, 24 znakov base64url', () => {
    const a = generatePortalToken()
    const b = generatePortalToken()
    expect(a).not.toBe(b)
    expect(a).toHaveLength(24)
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('portalExpiryFromDays: privzeto 90 dni, clamp 1..365', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const d90 = portalExpiryFromDays(DEFAULT_PORTAL_EXPIRY_DAYS, now)
    expect(d90.getTime() - now.getTime()).toBe(90 * 86400000)
    expect(portalExpiryFromDays(0, now).getTime() - now.getTime()).toBe(86400000)
    expect(portalExpiryFromDays(-5, now).getTime() - now.getTime()).toBe(86400000)
    expect(portalExpiryFromDays(100_000, now).getTime() - now.getTime()).toBe(
      MAX_PORTAL_EXPIRY_DAYS * 86400000,
    )
  })

  it('portalValidity: REVOKED premaga vse; EXPIRED in DISABLED ločeno', () => {
    const past = new Date(Date.now() - 1000)
    const future = new Date(Date.now() + 86400000)
    expect(portalValidity({ clientPortalEnabled: true, clientTokenExpiresAt: future, clientTokenRevokedAt: null })).toBe('OK')
    expect(portalValidity({ clientPortalEnabled: false, clientTokenExpiresAt: future, clientTokenRevokedAt: null })).toBe('DISABLED')
    expect(portalValidity({ clientPortalEnabled: true, clientTokenExpiresAt: past, clientTokenRevokedAt: null })).toBe('EXPIRED')
    // revokacija premaga tudi onemogočen portal in pretečen potek
    expect(portalValidity({ clientPortalEnabled: false, clientTokenExpiresAt: past, clientTokenRevokedAt: past })).toBe('REVOKED')
  })

  it('hashIp je determinističen, 32 hex znakov, loči IP-je, vpliva pepper; surov IP NI v vrednosti', () => {
    const a = hashIp('1.2.3.4')
    expect(a).toBe(hashIp('1.2.3.4'))
    expect(a).toHaveLength(32)
    expect(a).toMatch(/^[0-9a-f]+$/)
    expect(hashIp('1.2.3.5')).not.toBe(a)
    expect(a).not.toContain('1.2.3.4')
    const originalPepper = process.env.API_KEY_PEPPER
    process.env.API_KEY_PEPPER = 'druga-sol'
    expect(hashIp('1.2.3.4')).not.toBe(a)
    if (originalPepper === undefined) delete process.env.API_KEY_PEPPER
    else process.env.API_KEY_PEPPER = originalPepper
  })

  it('clientIpOf: prvi x-forwarded-for, x-real-ip rezerva, unknown', () => {
    const req = (headers: Record<string, string>) =>
      new Request('http://localhost/x', { headers })
    expect(clientIpOf(req({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' }))).toBe('9.9.9.9')
    expect(clientIpOf(req({ 'x-real-ip': '8.8.8.8' }))).toBe('8.8.8.8')
    expect(clientIpOf(req({}))).toBe('unknown')
    expect(clientIpOfHeaders({ get: () => '7.7.7.7' })).toBe('7.7.7.7')
  })
})

// ---------------------------------------------------------------------------
// Rute (roksal_test)
// ---------------------------------------------------------------------------

describe('portal rute — upravljanje, javni dostop, dnevnik (R132 §7)', () => {
  let uniqueIpCounter = 0
  const nextIp = () => `10.77.${(uniqueIpCounter += 1)}.1`

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('enable: kripto žeton + privzeti potek 90 dni; GET vrne življenjski cikl; audit z pravim akterjem', async () => {
    const { user, token } = await createTestUserWithSession(`r132-portal-a-${Date.now()}`)
    const projectId = await makeProjectFor(user.id, 'Portal-a')

    const route = await import('@/app/api/portal/route')
    const res = await route.POST(mgmtRequest('POST', token, projectId, { action: 'enable' }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      enabled: boolean
      token: string
      expiresAt: string | null
      revokedAt: string | null
    }
    expect(body.enabled).toBe(true)
    expect(body.token).toHaveLength(24)
    expect(body.revokedAt).toBeNull()
    const expDays = (new Date(body.expiresAt!).getTime() - Date.now()) / 86400000
    expect(expDays).toBeGreaterThan(89)
    expect(expDays).toBeLessThan(91)

    const resGet = await route.GET(
      new Request(`${BASE}?projectId=${projectId}`, {
        headers: { authorization: `Bearer ${token}` },
      }),
    )
    expect(resGet.status).toBe(200)
    const getBody = (await resGet.json()) as { expiresAt: string; lastUsedAt: string | null }
    expect(getBody.expiresAt).toBe(body.expiresAt)
    expect(getBody.lastUsedAt).toBeNull()

    const audit = await db.auditLog.findFirst({
      where: { projectId, akcija: 'PORTAL_ENABLE' },
      orderBy: { timestamp: 'desc' },
    })
    expect(audit?.userId).toBe(user.id)
  })

  it('expiresInDays je clamped (0 → 1 dan, 100000 → 365 dni)', async () => {
    const { user, token } = await createTestUserWithSession(`r132-portal-b-${Date.now()}`)
    const projectId = await makeProjectFor(user.id, 'Portal-b')
    const route = await import('@/app/api/portal/route')

    const res1 = await route.POST(mgmtRequest('POST', token, projectId, { action: 'enable', expiresInDays: 0 }))
    const b1 = (await res1.json()) as { expiresAt: string }
    expect((new Date(b1.expiresAt!).getTime() - Date.now()) / 86400000).toBeLessThan(2)

    const res2 = await route.POST(
      mgmtRequest('POST', token, projectId, { action: 'update', expiresInDays: 100_000 }),
    )
    const b2 = (await res2.json()) as { expiresAt: string }
    expect((new Date(b2.expiresAt!).getTime() - Date.now()) / 86400000).toBeGreaterThan(364)
  })

  it('revoke: žeton MRTAV → javna ruta 404 z ISTIM telesom kot neznan žeton; dnevnik REVOKED', async () => {
    const { user, token } = await createTestUserWithSession(`r132-portal-c-${Date.now()}`)
    const projectId = await makeProjectFor(user.id, 'Portal-c')
    const route = await import('@/app/api/portal/route')
    const publicRoute = await import('@/app/api/portal/[token]/route')

    const enabled = (await (
      await route.POST(mgmtRequest('POST', token, projectId, { action: 'enable' }))
    ).json()) as { token: string }

    const resRevoke = await route.POST(mgmtRequest('POST', token, projectId, { action: 'revoke' }))
    expect(resRevoke.status).toBe(200)
    const revoked = (await resRevoke.json()) as { enabled: boolean; revokedAt: string | null }
    expect(revoked.enabled).toBe(false)
    expect(revoked.revokedAt).not.toBeNull()

    const resUnknown = await publicRoute.GET(...publicCall('neznan-zeton-123456', nextIp()))
    const resRevoked = await publicRoute.GET(...publicCall(enabled.token, nextIp()))
    expect(resRevoked.status).toBe(404)
    expect(resUnknown.status).toBe(404)
    // enumeration protection: ISTO telo
    expect(await resRevoked.json()).toEqual(await resUnknown.json())

    const log = await db.portalAccess.findFirst({
      where: { projectId, status: 'REVOKED' },
      orderBy: { createdAt: 'desc' },
    })
    expect(log).not.toBeNull()
    expect(log?.ipHash).toHaveLength(32)
  })

  it('regenerate: NOV žeton (stari mrtav), revokedAt počiščen, svež potek; javna ruta dela', async () => {
    const { user, token } = await createTestUserWithSession(`r132-portal-d-${Date.now()}`)
    const projectId = await makeProjectFor(user.id, 'Portal-d')
    const route = await import('@/app/api/portal/route')
    const publicRoute = await import('@/app/api/portal/[token]/route')

    const first = (await (
      await route.POST(mgmtRequest('POST', token, projectId, { action: 'enable' }))
    ).json()) as { token: string }

    // preklic, nato obnova
    await route.POST(mgmtRequest('POST', token, projectId, { action: 'revoke' }))
    const res = await route.POST(mgmtRequest('POST', token, projectId, { action: 'regenerate' }))
    expect(res.status).toBe(200)
    const second = (await res.json()) as { token: string; revokedAt: string | null; expiresAt: string }
    expect(second.token).not.toBe(first.token)
    expect(second.revokedAt).toBeNull()
    expect((new Date(second.expiresAt).getTime() - Date.now()) / 86400000).toBeGreaterThan(89)

    // stari žeton → 404, novi → 200
    const oldRes = await publicRoute.GET(...publicCall(first.token, nextIp()))
    expect(oldRes.status).toBe(404)
    const newRes = await publicRoute.GET(...publicCall(second.token, nextIp()))
    expect(newRes.status).toBe(200)
    const pub = (await newRes.json()) as {
      project: { nazivProjekta: string }
      timeline: Array<{ title: string }>
      company: { ime: string }
    }
    expect(pub.project.nazivProjekta).toBe('Portal-d')
    expect(Array.isArray(pub.timeline)).toBe(true)
    expect(pub.company.ime).toContain('Roksal')

    // minimalni DTO: surovih audit polj (oldValue/newValue/ipAddress) NI v odgovoru
    const raw = JSON.stringify(pub)
    expect(raw).not.toContain('oldValue')
    expect(raw).not.toContain('ipAddress')
    expect(raw).not.toContain('passwordHash')

    const okLog = await db.portalAccess.findFirst({
      where: { projectId, status: 'OK' },
      orderBy: { createdAt: 'desc' },
    })
    expect(okLog).not.toBeNull()
  })

  it('EXPIRED: pretečen potek → 404 + dnevnik; disable → 404 (DISABLED)', async () => {
    const { user, token } = await createTestUserWithSession(`r132-portal-e-${Date.now()}`)
    const projectId = await makeProjectFor(user.id, 'Portal-e')
    const route = await import('@/app/api/portal/route')
    const publicRoute = await import('@/app/api/portal/[token]/route')

    const enabled = (await (
      await route.POST(mgmtRequest('POST', token, projectId, { action: 'enable', expiresInDays: 1 }))
    ).json()) as { token: string }

    // potek v preteklost direktno v bazi (določeno, brez čakanja)
    await db.project.update({
      where: { id: projectId },
      data: { clientTokenExpiresAt: new Date(Date.now() - 5000) },
    })
    expect((await publicRoute.GET(...publicCall(enabled.token, nextIp()))).status).toBe(404)
    const expiredLog = await db.portalAccess.findFirst({ where: { projectId, status: 'EXPIRED' } })
    expect(expiredLog).not.toBeNull()

    // reaktiviraj potek, izklopi portal → DISABLED
    await db.project.update({
      where: { id: projectId },
      data: { clientTokenExpiresAt: new Date(Date.now() + 86400000) },
    })
    await route.POST(mgmtRequest('POST', token, projectId, { action: 'disable' }))
    expect((await publicRoute.GET(...publicCall(enabled.token, nextIp()))).status).toBe(404)
    const disabledLog = await db.portalAccess.findFirst({ where: { projectId, status: 'DISABLED' } })
    expect(disabledLog).not.toBeNull()
  })

  it('IDOR: tuj monter (brez dostopa do projekta) → 403 na GET in POST upravljanja', async () => {
    const { user: owner, token: ownerToken } = await createTestUserWithSession(`r132-portal-f-${Date.now()}`)
    const projectId = await makeProjectFor(owner.id, 'Portal-f')
    const { token: outsiderToken } = await createTestUserWithSession(`r132-portal-g-${Date.now()}`)

    const route = await import('@/app/api/portal/route')
    const resGet = await route.GET(
      new Request(`${BASE}?projectId=${projectId}`, {
        headers: { authorization: `Bearer ${outsiderToken}` },
      }),
    )
    expect(resGet.status).toBe(403)
    const resPost = await route.POST(
      mgmtRequest('POST', outsiderToken, projectId, { action: 'enable' }),
    )
    expect(resPost.status).toBe(403)
    // lastnik gre skozi
    const resOwner = await route.GET(
      new Request(`${BASE}?projectId=${projectId}`, {
        headers: { authorization: `Bearer ${ownerToken}` },
      }),
    )
    expect(resOwner.status).toBe(200)
  })

  it('API ključ ne upravlja portala → 403 (samo uporabniške seje)', async () => {
    const { user } = await createTestUserWithSession(`r132-portal-h-${Date.now()}`)
    const projectId = await makeProjectFor(user.id, 'Portal-h')
    const rawKey = `rkm_test_${Date.now()}_abc`
    await db.apiKey.create({
      data: {
        name: `vitest-portal-${Date.now()}`,
        keyHash: hashApiKey(rawKey),
        keyPrefix: rawKey.slice(0, 12),
        scopes: 'projects:read',
      },
    })

    const route = await import('@/app/api/portal/route')
    const res = await route.GET(
      new Request(`${BASE}?projectId=${projectId}`, {
        headers: { authorization: `Bearer ${rawKey}` },
      }),
    )
    expect(res.status).toBe(403)
  })

  it(`shared rate limit: ${PORTAL_LIMIT.limit} dovoljenih, nato 429 + Retry-After + dnevnik`, async () => {
    const { user } = await createTestUserWithSession(`r132-portal-i-${Date.now()}`)
    const projectId = await makeProjectFor(user.id, 'Portal-i')
    const project = await db.project.update({
      where: { id: projectId },
      data: {
        clientToken: generatePortalToken(),
        clientPortalEnabled: true,
        clientTokenExpiresAt: new Date(Date.now() + 86400000),
      },
      select: { clientToken: true },
    })

    const publicRoute = await import('@/app/api/portal/[token]/route')
    const ip = nextIp()
    let saw429 = false
    let retryAfter = ''
    for (let i = 0; i < PORTAL_LIMIT.limit + 5; i += 1) {
      const res = await publicRoute.GET(...publicCall(project.clientToken, ip))
      if (res.status === 429) {
        saw429 = true
        retryAfter = res.headers.get('Retry-After') ?? ''
        break
      }
      expect(res.status).toBe(200)
    }
    expect(saw429).toBe(true)
    expect(Number(retryAfter)).toBeGreaterThan(0)

    // Limiter teče PRED lookupom žetona → vrstica ima projectId null,
    // identifikacija je po hashiranem IP-ju (test-unikatna vrednost).
    const limited = await db.portalAccess.findFirst({
      where: { status: 'RATE_LIMITED', ipHash: hashIp(ip) },
      orderBy: { createdAt: 'desc' },
    })
    expect(limited).not.toBeNull()
  })
})
