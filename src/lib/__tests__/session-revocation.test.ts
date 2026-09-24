// Roksal — testi sejnega registra (issue #5 §2: Session revocation)
// ---------------------------------------------------------------------------
// Dokazuje fail-closed obnašanje čez prave rute (handlerji direktno, baza
// roksal_test prek globalSetup):
//   • žeton brez jti (star način) → 401;
//   • login izda registrirano sejo → 200;
//   • logout prekliče trenutno sejo → isti žeton nato 401;
//   • logout {all} prekliče OSTALE naprave, trenutna ostane;
//   • logout {all, current} prekliče vse;
//   • menjava gesla prekliče VSE seje (ukraden žeton ne preživi);
//   • GET /api/auth/sessions = active-session pregled s `current` oznako;
//   • DELETE /api/auth/sessions/[id] prekliče eno sejo; tuja → 404;
//   • potekla vrstica registra → neveljavno.
// Brez AI, brez naključja (unikatni e-naslovi so izključno za izolacijo testov).

import { describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { createTestUserWithSession, upsertTestProfile } from './helpers/test-session'

function bearer(token: string): Request {
  return new Request('http://localhost/api/test', { headers: { authorization: `Bearer ${token}` } })
}

async function loginToken(email: string, password: string): Promise<string> {
  const route = await import('@/app/api/auth/route')
  const res = await route.POST(
    new Request('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),
  )
  expect(res.status).toBe(200)
  const cookie = res.headers.get('set-cookie') ?? ''
  const token = cookie.split(';')[0]?.split('=').slice(1).join('=')
  expect(token).toBeTruthy()
  return token as string
}

describe('session revocation — fail-closed register sej', () => {
  it('žeton brez jti (stari način) je NEVELJAVEN na ravni rute', async () => {
    const { signSession } = await import('@/lib/session')
    const user = await upsertTestProfile(`legacy-${Date.now()}`)
    const legacy = await signSession({ sub: user.id, email: user.email, ime: user.ime, vloga: user.vloga })
    const route = await import('@/app/api/auth/route')
    const res = await route.GET(bearer(legacy))
    expect(res.status).toBe(401)
  })

  it('login izda registrirano sejo; GET /api/auth jo preveri', async () => {
    const email = `live-${Date.now()}@test.si`
    await db.profile.upsert({
      where: { email },
      update: { passwordHash: await hashPassword('geslo-test-123') },
      create: { email, ime: 'Live', vloga: 'MONTER', passwordHash: await hashPassword('geslo-test-123') },
    })
    const token = await loginToken(email, 'geslo-test-123')
    const route = await import('@/app/api/auth/route')
    const res = await route.GET(bearer(token))
    expect(res.status).toBe(200)
    const data = (await res.json()) as { user: { email: string } }
    expect(data.user.email).toBe(email)
  })

  it('logout prekliče trenutno sejo — ukraden žeton ne preživi odjave', async () => {
    const { user, token } = await createTestUserWithSession(`lo-${Date.now()}`)
    const authRoute = await import('@/app/api/auth/route')
    expect((await authRoute.GET(bearer(token))).status).toBe(200)

    const logout = await import('@/app/api/auth/logout/route')
    const res = await logout.POST(bearer(token))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { success: boolean }
    expect(body.success).toBe(true)

    expect((await authRoute.GET(bearer(token))).status).toBe(401)
    // revizijska sled odjave
    const logs = await db.auditLog.findMany({ where: { userId: user.id, akcija: 'LOGOUT' } })
    expect(logs.length).toBeGreaterThanOrEqual(1)
  })

  it('logout {all} prekliče ostale naprave, trenutna ostane prijava', async () => {
    const { createTestSessionToken, upsertTestProfile } = await import('./helpers/test-session')
    const user = await upsertTestProfile(`all-${Date.now()}`)
    const tokenPhone = await createTestSessionToken(user)
    const tokenLaptop = await createTestSessionToken(user)

    const authRoute = await import('@/app/api/auth/route')
    const logout = await import('@/app/api/auth/logout/route')
    const res = await logout.POST(
      new Request('http://localhost/api/auth/logout', {
        method: 'POST',
        headers: { authorization: `Bearer ${tokenPhone}`, 'content-type': 'application/json' },
        body: JSON.stringify({ all: true }),
      }),
    )
    expect(res.status).toBe(200)
    // trenutna (telefon) ostane
    expect((await authRoute.GET(bearer(tokenPhone))).status).toBe(200)
    // ostala (prenosnik) je revoke
    expect((await authRoute.GET(bearer(tokenLaptop))).status).toBe(401)
  })

  it('logout {all, current} prekliče vse seje, tudi trenutno', async () => {
    const { createTestSessionToken, upsertTestProfile } = await import('./helpers/test-session')
    const user = await upsertTestProfile(`allc-${Date.now()}`)
    const token1 = await createTestSessionToken(user)
    const token2 = await createTestSessionToken(user)

    const authRoute = await import('@/app/api/auth/route')
    const logout = await import('@/app/api/auth/logout/route')
    const res = await logout.POST(
      new Request('http://localhost/api/auth/logout', {
        method: 'POST',
        headers: { authorization: `Bearer ${token1}`, 'content-type': 'application/json' },
        body: JSON.stringify({ all: true, current: true }),
      }),
    )
    expect(res.status).toBe(200)
    expect((await authRoute.GET(bearer(token1))).status).toBe(401)
    expect((await authRoute.GET(bearer(token2))).status).toBe(401)
  })

  it('menjava gesla na profilu z geslom revoke-a vse seje in dovoli novo prijavo', async () => {
    const email = `pwdlive-${Date.now()}@test.si`
    const hash = await hashPassword('staro-geslo-123')
    const profile = await db.profile.upsert({
      where: { email },
      update: { passwordHash: hash },
      create: { email, ime: 'PwdLive', vloga: 'VODJA', passwordHash: hash },
    })
    const { createTestSessionToken } = await import('./helpers/test-session')
    const user = { id: profile.id, email: profile.email, ime: profile.ime, vloga: profile.vloga }
    const tokenStolen = await createTestSessionToken(user)
    const tokenCurrent = await createTestSessionToken(user)

    const password = await import('@/app/api/auth/password/route')
    const res = await password.POST(
      new Request('http://localhost/api/auth/password', {
        method: 'POST',
        headers: { authorization: `Bearer ${tokenCurrent}`, 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword: 'staro-geslo-123', newPassword: 'novo-geslo-456' }),
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { relogin: boolean }
    expect(body.relogin).toBe(true)

    const authRoute = await import('@/app/api/auth/route')
    // ukraden žeton MRTV
    expect((await authRoute.GET(bearer(tokenStolen))).status).toBe(401)
    // tudi seja, ki je menjala geslo, je MRTVA (fail-closed)
    expect((await authRoute.GET(bearer(tokenCurrent))).status).toBe(401)
    // nova prijava z novim geslom deluje
    const fresh = await loginToken(email, 'novo-geslo-456')
    expect((await authRoute.GET(bearer(fresh))).status).toBe(200)
  })

  it('GET /api/auth/sessions — active-session pregled s current oznako', async () => {
    const { createTestSessionToken, upsertTestProfile } = await import('./helpers/test-session')
    const user = await upsertTestProfile(`list-${Date.now()}`)
    const tokenCurrent = await createTestSessionToken(user)
    await createTestSessionToken(user)

    const sessions = await import('@/app/api/auth/sessions/route')
    const res = await sessions.GET(bearer(tokenCurrent))
    expect(res.status).toBe(200)
    const data = (await res.json()) as { sessions: Array<{ current: boolean; id: string }> }
    expect(data.sessions.length).toBe(2)
    expect(data.sessions.filter((s) => s.current).length).toBe(1)
  })

  it('DELETE /api/auth/sessions/[id] — ena naprava revoke; tuja seja → 404', async () => {
    const { createTestSessionToken, upsertTestProfile } = await import('./helpers/test-session')
    const userA = await upsertTestProfile(`del-a-${Date.now()}`)
    const userB = await upsertTestProfile(`del-b-${Date.now()}`)
    const tokenA = await createTestSessionToken(userA)
    const otherA = await createTestSessionToken(userA)
    const tokenB = await createTestSessionToken(userB)

    // jti seje B iz A-jevega žetona (jti je base64url payload — dekodiramo)
    const payloadB = JSON.parse(Buffer.from(tokenB.split('.')[0], 'base64url').toString()) as { jti: string }
    const payloadOtherA = JSON.parse(Buffer.from(otherA.split('.')[0], 'base64url').toString()) as { jti: string }

    const del = await import('@/app/api/auth/sessions/[id]/route')
    const ok = await del.DELETE(bearer(tokenA), { params: Promise.resolve({ id: payloadOtherA.jti }) })
    expect(ok.status).toBe(200)

    const authRoute = await import('@/app/api/auth/route')
    expect((await authRoute.GET(bearer(otherA))).status).toBe(401)
    expect((await authRoute.GET(bearer(tokenA))).status).toBe(200)

    // tuja seja (B) iz A-jeve naprave → 404 (ne razkrij obstoja)
    const foreign = await del.DELETE(bearer(tokenA), { params: Promise.resolve({ id: payloadB.jti }) })
    expect(foreign.status).toBe(404)
    expect((await authRoute.GET(bearer(tokenB))).status).toBe(200)
  })

  it('potekla vrstica registra → neveljavna seja (četudi žeton še ni potekel)', async () => {
    const { createTestSessionToken, upsertTestProfile } = await import('./helpers/test-session')
    const user = await upsertTestProfile(`exp-${Date.now()}`)
    const token = await createTestSessionToken(user)

    // potek vrstice v preteklost (žeton sam je še 12 ur veljaven)
    const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString()) as { jti: string }
    await db.userSession.update({
      where: { id: payload.jti },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    const authRoute = await import('@/app/api/auth/route')
    expect((await authRoute.GET(bearer(token))).status).toBe(401)
  })
})
