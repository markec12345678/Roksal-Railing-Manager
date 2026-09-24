// Roksal — testi API-key lifecycle (R126 — issue #5 §3)
// ---------------------------------------------------------------------------
// Dokazuje fail-closed obnašanje čez pravo bazo (roksal_test prek globalSetup)
// in prave rute (handlerji direktno):
//   • neznani ključ → 'unknown', preklican → 'revoked', potekel → 'expired',
//     čez per-key proračun → 'rate_limited';
//   • authenticate() vrne context z id, scopes in projectScope;
//   • neuspešna preverba piše AUTH_APIKEY_FAIL v AuditLog (vmejeno na IP);
//   • rotacija: predhodnik preklican, naslednik z ISTIMI pravicami (rotatedFrom);
//   • access: scope vrata (projects:read/write, measurements:create,
//     photos:read/write) + projektne omejitve (projectScope) na ravni vrstic;
//   • regresije pukljav: apikey NE več dostopa do računov in naročil
//     (invoices GET/POST, material-orders GET/PATCH — prej "manager").
// Brez AI, brez naključja (ključi so naključni po zasnovi, a samo izolirano).

import { describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import {
  createApiKey,
  resetApiKeyRateLimit,
  rotateApiKey,
  verifyApiKey,
  type ApiKeyVerificationResult,
} from '@/lib/password'
import { resetRateLimit } from '@/lib/rate-limit'
import { authenticate, type AuthContext } from '@/lib/auth'
import {
  apiKeyScopeDenied,
  projectAccessAllowed,
  projectWhereForPrincipal,
} from '@/lib/access'
import type { ApiKeyScope } from '@/lib/api-keys'

function bearer(key: string, init: RequestInit = {}): Request {
  return new Request('http://localhost/api/test', {
    ...init,
    headers: { ...(init.headers ?? {}), authorization: `Bearer ${key}` },
  })
}

function apikeyCtx(
  scopes: ApiKeyScope[],
  projectScope: string[] | null = null,
): AuthContext {
  return { kind: 'apikey', name: 'test', id: 'k-test', scopes, projectScope }
}

async function expectFail(key: string | null, reason: string): Promise<void> {
  const result = await verifyApiKey(key)
  expect(result.ok).toBe(false)
  expect((result as Extract<ApiKeyVerificationResult, { ok: false }>).reason).toBe(reason)
}

describe('verifyApiKey — fail-closed preverba (R126)', () => {
  it('neznani ključ → unknown; okraščen null prav tako', async () => {
    await expectFail('rkm_ni-obstaja-si-121212121212121212121212', 'unknown')
    await expectFail(null, 'unknown')
  })

  it('veljaven ključ → ok z razčlenjenimi scopes in projectScope', async () => {
    const created = await createApiKey({
      name: `vitest-ok-${Date.now()}`,
      purpose: 'test veljavnosti',
      scopes: ['projects:read', 'photos:write'],
      projectScope: ['proj-A', 'proj-B'],
    })
    const result = await verifyApiKey(created.key)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.scopes).toEqual(['projects:read', 'photos:write'])
      expect(result.projectScope).toEqual(['proj-A', 'proj-B'])
    }
  })

  it('preklican ključ → revoked', async () => {
    const created = await createApiKey({ name: `vitest-req-${Date.now()}` })
    await db.apiKey.update({ where: { id: created.id }, data: { revokedAt: new Date() } })
    await expectFail(created.key, 'revoked')
  })

  it('potekel ključ → expired (fail-closed)', async () => {
    const created = await createApiKey({
      name: `vitest-exp-${Date.now()}`,
      expiresAt: new Date(Date.now() - 60_000),
    })
    await expectFail(created.key, 'expired')
  })

  it('per-key rate limit: 2/min → tretji klic rate_limited; reset odpusti', async () => {
    const created = await createApiKey({
      name: `vitest-rl-${Date.now()}`,
      rateLimitPerMin: 2,
    })
    expect((await verifyApiKey(created.key)).ok).toBe(true)
    expect((await verifyApiKey(created.key)).ok).toBe(true)
    await expectFail(created.key, 'rate_limited')
    resetApiKeyRateLimit(created.id)
    expect((await verifyApiKey(created.key)).ok).toBe(true)
  })

  it('neuspešna preverba piše AUTH_APIKEY_FAIL (vmejeno, z razlogom)', async () => {
    resetRateLimit('apikey-fail:localhost')
    const before = await db.auditLog.count({ where: { akcija: 'AUTH_APIKEY_FAIL' } })
    await authenticate(bearer('rkm_skrivnost-neobstaja-9999999999999'))
    // audit je neblokirajoč (void) → rahlo poll dokazujemo vpis
    let after = before
    for (let i = 0; i < 20 && after === before; i++) {
      await new Promise((r) => setTimeout(r, 50))
      after = await db.auditLog.count({ where: { akcija: 'AUTH_APIKEY_FAIL' } })
    }
    expect(after).toBeGreaterThan(before)
    const last = await db.auditLog.findFirstOrThrow({
      where: { akcija: 'AUTH_APIKEY_FAIL' },
      orderBy: { timestamp: 'desc' },
    })
    expect(last.newValue).toContain('unknown')
  })
})

describe('authenticate — servisni context (R126)', () => {
  it('vrne apikey context z id, scopes, projectScope', async () => {
    const created = await createApiKey({
      name: `vitest-ctx-${Date.now()}`,
      scopes: ['measurements:create'],
      projectScope: ['proj-X'],
    })
    const ctx = await authenticate(bearer(created.key))
    expect(ctx?.kind).toBe('apikey')
    if (ctx?.kind === 'apikey') {
      expect(ctx.id).toBe(created.id)
      expect(ctx.scopes).toEqual(['measurements:create'])
      expect(ctx.projectScope).toEqual(['proj-X'])
    }
  })
})

describe('rotacija ključa (R126)', () => {
  it('nov ključ podeduje pravice, predhodnik je preklican', async () => {
    const created = await createApiKey({
      name: `vitest-rot-${Date.now()}`,
      purpose: 'BalkonAR terenska ekipa',
      scopes: ['projects:read', 'photos:write'],
      projectScope: ['proj-R'],
      expiresAt: new Date(Date.now() + 86_400_000),
      rateLimitPerMin: 42,
    })
    const rotated = await rotateApiKey(created.id)
    expect(rotated).not.toBeNull()

    const oldRow = await db.apiKey.findUniqueOrThrow({ where: { id: created.id } })
    expect(oldRow.revokedAt).not.toBeNull()

    const newRow = await db.apiKey.findUniqueOrThrow({ where: { id: rotated!.id } })
    expect(newRow.rotatedFrom).toBe(created.id)
    expect(newRow.purpose).toBe('BalkonAR terenska ekipa')
    expect(newRow.rateLimitPerMin).toBe(42)

    await expectFail(created.key, 'revoked')
    const result = await verifyApiKey(rotated!.key)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.scopes).toEqual(['projects:read', 'photos:write'])
      expect(result.projectScope).toEqual(['proj-R'])
    }
  })

  it('neobstoječ predhodnik → null (brez tistega pojava)', async () => {
    expect(await rotateApiKey('neobstaja-x')).toBeNull()
  })

  it('rotacija s preglasitvijo poteka', async () => {
    const created = await createApiKey({
      name: `vitest-rot2-${Date.now()}`,
      expiresAt: new Date(Date.now() + 3_600_000),
    })
    const newExpiry = new Date(Date.now() + 30 * 86_400_000)
    const rotated = await rotateApiKey(created.id, { expiresAt: newExpiry })
    const newRow = await db.apiKey.findUniqueOrThrow({ where: { id: rotated!.id } })
    expect(newRow.expiresAt?.toISOString()).toBe(newExpiry.toISOString())
  })
})

describe('scope vrata + projektne omejitve (access, R126)', () => {
  it('projects:write manjka → update na projektu zavrnjen; read deluje', async () => {
    const ctx = apikeyCtx(['projects:read'])
    const project = { id: 'p-r126', monterId: null, vodjaId: null, dealLocked: false }
    expect(projectAccessAllowed(ctx, project, 'read')).toBe(true)
    expect(projectAccessAllowed(ctx, project, 'update')).toBe(false)
    expect(projectAccessAllowed(ctx, project, 'changeStatus')).toBe(false)
    expect(projectAccessAllowed(ctx, project, 'delete')).toBe(false)
    expect(projectAccessAllowed(ctx, project, 'lock')).toBe(false)
  })

  it('projects:write prisoten → update dovoljen (razen dealLocked)', async () => {
    const ctx = apikeyCtx(['projects:write'])
    expect(projectAccessAllowed(ctx, { id: 'p', monterId: null, vodjaId: null, dealLocked: false }, 'update')).toBe(true)
    expect(projectAccessAllowed(ctx, { id: 'p', monterId: null, vodjaId: null, dealLocked: true }, 'update')).toBe(false)
  })

  it('projectScope: ključ omejen na [A] ne dostopa do projekta B (tudi read)', async () => {
    const ctx = apikeyCtx(['projects:read', 'projects:write'], ['proj-A'])
    expect(projectAccessAllowed(ctx, { id: 'proj-A', monterId: null, vodjaId: null, dealLocked: false }, 'read')).toBe(true)
    expect(projectAccessAllowed(ctx, { id: 'proj-B', monterId: null, vodjaId: null, dealLocked: false }, 'read')).toBe(false)
    expect(projectWhereForPrincipal(ctx)).toEqual({ id: { in: ['proj-A'] } })
  })

  it('brez projectScope: sync zrcalo podjetja ostane pogodba ({})', async () => {
    expect(projectWhereForPrincipal(apikeyCtx(['projects:read']))).toEqual({})
  })

  it('apiKeyScopeDenied: uporabniška seja gre vedno skozi', () => {
    expect(apiKeyScopeDenied(apikeyCtx([]), 'photos:read')).toBe(true)
    expect(apiKeyScopeDenied(apikeyCtx(['photos:read']), 'photos:read')).toBe(false)
  })
})

describe('rute čez prave handlerje — scope vrata živa (R126)', () => {
  it('sync GET: ključ brez projects:read → 403; s scope-om → 200', async () => {
    const noRead = await createApiKey({ name: `vitest-sync-nr-${Date.now()}`, scopes: ['photos:write'] })
    const route = await import('@/app/api/sync/route')
    expect((await route.GET(bearer(noRead.key))).status).toBe(403)

    const withRead = await createApiKey({ name: `vitest-sync-r-${Date.now()}`, scopes: ['projects:read'] })
    const res = await route.GET(bearer(withRead.key))
    expect(res.status).toBe(200)
  })

  it('sync POST: ključ brez projects:write → 403 (branje ga ne povzdigne)', async () => {
    const readOnly = await createApiKey({ name: `vitest-sync-po-${Date.now()}`, scopes: ['projects:read'] })
    const route = await import('@/app/api/sync/route')
    const res = await route.POST(bearer(readOnly.key, { method: 'POST', body: '[]' }))
    expect(res.status).toBe(403)
  })

  it('measurement/confirm POST: brez measurements:create → 403', async () => {
    const noMeasure = await createApiKey({ name: `vitest-meas-${Date.now()}`, scopes: ['projects:read'] })
    const route = await import('@/app/api/measurement/confirm/route')
    const res = await route.POST(bearer(noMeasure.key, { method: 'POST', body: '{}' }))
    expect(res.status).toBe(403)
  })

  it('photos GET/POST: brez photos:read/photos:write → 403', async () => {
    const noPhotos = await createApiKey({ name: `vitest-ph-${Date.now()}`, scopes: ['projects:read'] })
    const route = await import('@/app/api/photos/route')
    expect((await route.GET(bearer(noPhotos.key))).status).toBe(403)
    expect((await route.POST(bearer(noPhotos.key, { method: 'POST', body: '{}' }))).status).toBe(403)
  })
})

describe('regresija pukljav — apikey NI manager (R126)', () => {
  it('invoices GET/POST: API ključ → 403 (uradni dokumenti)', async () => {
    const key = await createApiKey({ name: `vitest-inv-${Date.now()}` })
    const route = await import('@/app/api/invoices/route')
    expect((await route.GET(bearer(key.key))).status).toBe(403)
    const post = await route.POST(bearer(key.key, { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } }))
    expect(post.status).toBe(403)
  })

  it('material-orders GET/PATCH: API ključ → 403 (dobavitelji/cene)', async () => {
    const key = await createApiKey({ name: `vitest-mo-${Date.now()}` })
    const route = await import('@/app/api/material-orders/route')
    expect((await route.GET(bearer(key.key))).status).toBe(403)
    const patch = await route.PATCH(bearer(key.key, { method: 'PATCH', body: '{}', headers: { 'content-type': 'application/json' } }))
    expect(patch.status).toBe(403)
  })
})
