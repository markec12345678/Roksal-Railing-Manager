// Roksal — testi demo dostopa (R127 — issue #5 §1: Demo ADMIN mora biti
// production-safe)
// ---------------------------------------------------------------------------
// Dokazuje čez pravo bazo (roksal_test prek globalSetup) in prave rute
// (handlerji direktno):
//   • centralna politika demoAccessState(): matrika env vrednosti —
//     produkcija privzeto OFF (fail-closed), razvoj privzeto ON, `on`/`off`
//     eksplicitno, neznana vrednost OFF;
//   • POST /api/auth/demo v produkciji (VERCEL_ENV=production) → 403;
//   • DEMO_ACCESS=off → 403 povsod; GET zastavica odraža stanje;
//   • demo profil je NIKOLI ADMIN: odgovor in baza pokažeta MONTER;
//   • obstoječ ADMIN demo profil se ob demo vstopu SNIŽA na MONTER in
//     dobi novo, neznano geslo (stari javni skrivnosti so mrtve);
//   • demo seja ne omogoči privilegiranega dostopa: POST /api/invoices
//     (vodstvo) → 403; projektni seznam je omejen na lastne (praznen).
// Brez AI, brez naključja v asercijah (gesla so naključna po zasnovi).

import { afterAll, describe, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/password'
import { resetRateLimit } from '@/lib/rate-limit'
import { DEMO_EMAIL, DEMO_NAME, DEMO_ROLE, demoAccessState, randomDemoPassword } from '@/lib/demo-access'

afterAll(() => {
  vi.unstubAllEnvs()
  resetRateLimit()
})

/** Demo POST prek pravega handlerja; vrne { status, cookie, body }. */
async function demoPost(): Promise<{ status: number; cookie: string | null; body: Record<string, unknown> | null }> {
  const route = await import('@/app/api/auth/demo/route')
  const res = await route.POST(new Request('http://localhost/api/auth/demo', { method: 'POST' }))
  const setCookie = res.headers.get('set-cookie')
  const cookie = setCookie ? setCookie.split(';')[0] : null
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null
  return { status: res.status, cookie, body }
}

describe('demoAccessState — politika okolja (čiste funkcije)', () => {
  it('produkcija brez env vrednosti je privzeto IZKLOPLJENA (fail-closed)', () => {
    expect(demoAccessState({ NODE_ENV: 'production' })).toEqual({
      enabled: false,
      reason: 'default-production-off',
      production: true,
    })
    expect(demoAccessState({ VERCEL_ENV: 'production' })).toMatchObject({ enabled: false, production: true })
    expect(demoAccessState({ DEMO_ACCESS: '', VERCEL_ENV: 'production' })).toMatchObject({ enabled: false })
  })

  it('razvoj je privzeto VKLOPLJEN', () => {
    expect(demoAccessState({ NODE_ENV: 'development' })).toMatchObject({ enabled: true, reason: 'default-dev' })
    expect(demoAccessState({ NODE_ENV: 'test' })).toMatchObject({ enabled: true, reason: 'default-dev' })
    expect(demoAccessState({})).toMatchObject({ enabled: true, production: false })
  })

  it('eksplicitni on/off preglasi okolje; neznana vrednost = OFF (fail-closed)', () => {
    expect(demoAccessState({ DEMO_ACCESS: 'on', VERCEL_ENV: 'production' })).toMatchObject({
      enabled: true,
      reason: 'explicit-on',
      production: true,
    })
    expect(demoAccessState({ DEMO_ACCESS: 'off', NODE_ENV: 'development' })).toMatchObject({
      enabled: false,
      reason: 'explicit-off',
    })
    expect(demoAccessState({ DEMO_ACCESS: 'maybe', NODE_ENV: 'development' })).toMatchObject({
      enabled: false,
      reason: 'unknown-value-off',
    })
    expect(demoAccessState({ DEMO_ACCESS: 'ON' })).toMatchObject({ enabled: false, reason: 'unknown-value-off' })
  })

  it('demo vloga je NIKOLI privilegirana (konstanta, ne naključje)', () => {
    expect(DEMO_ROLE).toBe('MONTER')
    expect(DEMO_ROLE).not.toBe('ADMIN')
    expect(DEMO_ROLE).not.toBe('VODJA')
  })

  it('randomDemoPassword je vedno nov in vsaj 40 znakov (nikoli statično geslo)', () => {
    const a = randomDemoPassword()
    const b = randomDemoPassword()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThanOrEqual(40)
  })
})

describe('POST /api/auth/demo — produkcija je privzeto OFF', () => {
  it('VERCEL_ENV=production → 403, brez seje in brez sprememb profila', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('DEMO_ACCESS', '')
    resetRateLimit()
    const before = await db.profile.findUnique({ where: { email: DEMO_EMAIL } })

    const { status, cookie } = await demoPost()

    expect(status).toBe(403)
    expect(cookie).toBeNull()
    const after = await db.profile.findUnique({ where: { email: DEMO_EMAIL } })
    // profil (če obstaja) se NI spremenil — `?? null` normalizira undefined
    // (profil še ne obstaja, npr. čista CI baza) in null (polje je null)
    expect(after?.vloga ?? null).toBe(before?.vloga ?? null)
    expect(after?.passwordHash ?? null).toBe(before?.passwordHash ?? null)
  })

  it('NODE_ENV=production (lokalni produkcijski start) → 403', async () => {
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DEMO_ACCESS', '')
    resetRateLimit()
    const { status } = await demoPost()
    expect(status).toBe(403)
  })

  it('DEMO_ACCESS=off → 403 tudi v razvoju; GET zastavica → { enabled: false }', async () => {
    vi.unstubAllEnvs()
    vi.stubEnv('DEMO_ACCESS', 'off')
    resetRateLimit()
    const { status } = await demoPost()
    expect(status).toBe(403)

    const get = await import('@/app/api/auth/demo/route')
    const res = await get.GET()
    const data = (await res.json()) as { enabled: boolean }
    expect(res.headers.get('Cache-Control')).toContain('no-store')
    expect(data).toEqual({ enabled: false })
  })
})

describe('POST /api/auth/demo — omogočen dostop (razvoj)', () => {
  it('izda MONTER sejo; profil v bazi je MONTER z neznanim geslom; GET → { enabled: true }', async () => {
    vi.unstubAllEnvs()
    resetRateLimit()
    // Začni iz sejanega stanja: demo brez gesla (kot po migraciji r127).
    await db.profile.upsert({
      where: { email: DEMO_EMAIL },
      update: { vloga: 'MONTER', passwordHash: null },
      create: { email: DEMO_EMAIL, ime: DEMO_NAME, vloga: 'MONTER', passwordHash: null },
    })

    const { status, cookie, body } = await demoPost()
    expect(status).toBe(200)
    expect(cookie).toBeTruthy()
    const user = (body?.user ?? {}) as { vloga?: string; email?: string }
    expect(user.vloga).toBe('MONTER')
    expect(user.email).toBe(DEMO_EMAIL)

    const profile = await db.profile.findUnique({ where: { email: DEMO_EMAIL } })
    expect(profile?.vloga).toBe('MONTER')
    // geslo je zrotirano na naključno (ni null, ni znana vrednost) — prijava
    // prek /login forme za demo račun ni mogoča
    expect(profile?.passwordHash).toBeTruthy()
    expect(await verifyPassword('karkoli-ugibanje', profile?.passwordHash)).toBe(false)

    // seja je res živa (register, #5 §2) in pripada MONTER profilu
    const sessionRoute = await import('@/app/api/auth/route')
    const me = await sessionRoute.GET(new Request('http://localhost/api/auth', { headers: { cookie: cookie! } }))
    expect(me.status).toBe(200)

    // audit: DEMO_LOGIN vpisan
    const logs = await db.auditLog.findMany({ where: { userId: profile!.id, akcija: 'DEMO_LOGIN' }, orderBy: { timestamp: 'desc' } })
    expect(logs.length).toBeGreaterThanOrEqual(1)

    const get = await import('@/app/api/auth/demo/route')
    const flag = (await (await get.GET()).json()) as { enabled: boolean }
    expect(flag.enabled).toBe(true)
  })

  it('obstoječ ADMIN demo profil se SNIŽA na MONTER in izgubi staro geslo', async () => {
    vi.unstubAllEnvs()
    resetRateLimit()
    // Simuliraj STARO stanje iz pred R127: demo je ADMIN z (nevažečim) geslom.
    const oldHash = await hashPassword('staro-demo-geslo-fikstura')
    await db.profile.upsert({
      where: { email: DEMO_EMAIL },
      update: { vloga: 'ADMIN', passwordHash: oldHash },
      create: { email: DEMO_EMAIL, ime: DEMO_NAME, vloga: 'ADMIN', passwordHash: oldHash },
    })

    const { status, body } = await demoPost()
    expect(status).toBe(200)
    const user = (body?.user ?? {}) as { vloga?: string }
    expect(user.vloga).toBe('MONTER')

    const profile = await db.profile.findUnique({ where: { email: DEMO_EMAIL } })
    expect(profile?.vloga).toBe('MONTER')
    expect(profile?.passwordHash).toBeTruthy()
    expect(profile?.passwordHash).not.toBe(oldHash)
    expect(await verifyPassword('staro-demo-geslo-fikstura', profile?.passwordHash)).toBe(false)
  })
})

describe('demo seja NE omogoči privilegiranega dostopa (zahteva #5 §1)', () => {
  it('demo (MONTER): POST /api/invoices → 403; projekti = samo lastni (prazni)', async () => {
    vi.unstubAllEnvs()
    resetRateLimit()
    const { status, cookie } = await demoPost()
    expect(status).toBe(200)
    expect(cookie).toBeTruthy()

    // računi so uradni dokumenti — samo vodstvo (denyUnlessManager)
    const invoices = await import('@/app/api/invoices/route')
    const invRes = await invoices.POST(
      new Request('http://localhost/api/invoices', {
        method: 'POST',
        headers: { cookie: cookie!, 'content-type': 'application/json' },
        body: JSON.stringify({ projectId: 'poljuben-id' }),
      }),
    )
    expect(invRes.status).toBe(403)

    // projektov, kjer demo NI monter/vodja, ne vidi (projectWhereForPrincipal)
    const projects = await import('@/app/api/projects/route')
    const projRes = await projects.GET(new Request('http://localhost/api/projects', { headers: { cookie: cookie! } }))
    expect(projRes.status).toBe(200)
    const list = (await projRes.json()) as Array<{ id: string }>
    expect(Array.isArray(list)).toBe(true)
    // noben projekt v odgovoru ne sme biti tuji — demo ni monter/vodja na nobenem
    // realnem projektu (novo ustvarjeni testni projekti imajo druge profile)
    const demoProfile = await db.profile.findUnique({ where: { email: DEMO_EMAIL }, select: { id: true } })
    for (const p of list) {
      const row = await db.project.findUnique({ where: { id: p.id }, select: { monterId: true, vodjaId: true } })
      expect(row?.monterId === demoProfile?.id || row?.vodjaId === demoProfile?.id).toBe(true)
    }
  })
})
