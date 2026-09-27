// Roksal — testi R195: CSRF-zavrnitev toast + 'Odjavi ostale naprave'
// ---------------------------------------------------------------------------
// Trije nivoji, vzorec R194 / session-revocation:
//   1. brskalniški ovoj (`installCsrfFetch` s špioniranim oknom) — 403 z
//      markerjem 'dvojni podpis' sproži dogodek `roksal:csrf-zavrnjen`;
//      RBAC 403 / 401 / 200 / varne metode NE sprožijo ničesar; telo ostane
//      klicatelju berljivo (klon); ovoj fail-open.
//   2. prava ruta DELETE /api/auth/sessions (baza roksal_test) — 401 brez
//      žetona; revoke OSTALIH sej, trenutna ostane ŽIVA; revizijski zapis
//      SESSION_REVOKE_OTHERS; ponovni klic → revoked 0 (idempotentno).
//   3. čisto jedro — konstanti dogodka in markerja (EN VIR za ovoj, poslušalca
//      in strežniško sporočilo).

import { describe, expect, it, vi } from 'vitest'
import type { CsrfWindow } from '@/lib/csrf-client'
import { installCsrfFetch } from '@/lib/csrf-client'
import { CSRF_HEADER, CSRF_REJECTION_EVENT, CSRF_REJECTION_MARKER } from '@/lib/csrf-core'
import { SESSION_COOKIE } from '@/lib/session'
import { db } from '@/lib/db'
import { createTestSessionToken, createTestUserWithSession } from './helpers/test-session'

const TOKEN = 'zeton-vzorec-r195'
const CSRF_403_BODY = 'Zavrnjeno — CSRF žeton manjka ali ne ujema (dvojni podpis)'
const RBAC_403_BODY = 'Dostop ni dovoljen — vaša vloga tega ne sme.'

// ── brskalniški ovoj — objaviCsrfZavrnitev ─────────────────────────────────────

function stubWindowWith(
  cookie: string,
  status: number,
  body: string,
): CsrfWindow & { __spiedFetch: ReturnType<typeof vi.fn>; __spiedDispatch: ReturnType<typeof vi.fn> } {
  const origin = 'https://app.roksal.si'
  const spiedFetch = vi.fn(() => Promise.resolve(new Response(body, { status })))
  const spiedDispatch = vi.fn(() => true)
  return {
    fetch: spiedFetch as unknown as CsrfWindow['fetch'],
    location: { href: `${origin}/`, origin },
    document: { cookie },
    dispatchEvent: spiedDispatch as unknown as CsrfWindow['dispatchEvent'],
    __spiedFetch: spiedFetch,
    __spiedDispatch: spiedDispatch,
  }
}

describe('R195 ovoj — dogodek ob 403 dvojni podpis', () => {
  it('403 z markerjem sproži dogodek roksal:csrf-zavrnjen (žeton prilepljen — srečna pot)', async () => {
    const win = stubWindowWith(`${SESSION_COOKIE}=s; roksal_csrf=${TOKEN}`, 403, CSRF_403_BODY)
    installCsrfFetch(win)
    const res = await win.fetch('/api/projects', { method: 'POST' })
    expect(res.status).toBe(403)
    await vi.waitFor(() => expect(win.__spiedDispatch).toHaveBeenCalledTimes(1), { timeout: 1000 })
    const evt = win.__spiedDispatch.mock.calls[0][0] as Event
    expect(evt).toBeInstanceOf(Event)
    expect(evt.type).toBe(CSRF_REJECTION_EVENT)
  })

  it('RBAC 403 (dostop ni dovoljen) NE sproži dogodka — toast ne lažno zatreske za permisije', async () => {
    const win = stubWindowWith(`${SESSION_COOKIE}=s; roksal_csrf=${TOKEN}`, 403, RBAC_403_BODY)
    installCsrfFetch(win)
    const res = await win.fetch('/api/projects', { method: 'POST' })
    expect(res.status).toBe(403)
    await new Promise((r) => setTimeout(r, 30))
    expect(win.__spiedDispatch).not.toHaveBeenCalled()
  })

  it('200 in 401 ne sprožita dogodka (samo 403 se ogleduje)', async () => {
    for (const status of [200, 401]) {
      const win = stubWindowWith(`${SESSION_COOKIE}=s; roksal_csrf=${TOKEN}`, status, '{"ok":true}')
      installCsrfFetch(win)
      await win.fetch('/api/projects', { method: 'POST' })
      await new Promise((r) => setTimeout(r, 30))
      expect(win.__spiedDispatch).not.toHaveBeenCalled()
    }
  })

  it('varne metode (GET) se ne ogledujejo — tudi če je telo CSRF 403', async () => {
    const win = stubWindowWith(`${SESSION_COOKIE}=s; roksal_csrf=${TOKEN}`, 403, CSRF_403_BODY)
    installCsrfFetch(win)
    await win.fetch('/api/projects')
    await new Promise((r) => setTimeout(r, 30))
    expect(win.__spiedDispatch).not.toHaveBeenCalled()
  })

  it('pot brez prilepljenega žetona (brez piškotka) prav tako sporoči zavrnitev', async () => {
    const win = stubWindowWith('', 403, CSRF_403_BODY)
    installCsrfFetch(win)
    await win.fetch('/api/projects', { method: 'POST' })
    await vi.waitFor(() => expect(win.__spiedDispatch).toHaveBeenCalledTimes(1), { timeout: 1000 })
  })

  it('pot z obstoječo glavo klicatelja (ni preglašena) prav tako sporoči zavrnitev', async () => {
    const win = stubWindowWith(`${SESSION_COOKIE}=s; roksal_csrf=${TOKEN}`, 403, CSRF_403_BODY)
    installCsrfFetch(win)
    await win.fetch('/api/projects', { method: 'POST', headers: { [CSRF_HEADER]: 'naroben-zeton' } })
    await vi.waitFor(() => expect(win.__spiedDispatch).toHaveBeenCalledTimes(1), { timeout: 1000 })
  })

  it('telo odgovora ostane klicatelju NEDOTAKNJENO (klon, ne poraba)', async () => {
    const win = stubWindowWith(`${SESSION_COOKIE}=s; roksal_csrf=${TOKEN}`, 403, CSRF_403_BODY)
    installCsrfFetch(win)
    const res = await win.fetch('/api/projects', { method: 'POST' })
    const telo = await res.text()
    expect(telo).toContain(CSRF_REJECTION_MARKER)
  })

  it('marker je isti vir kot strežniško sporočilo (dvojni podpis)', () => {
    expect(CSRF_REJECTION_MARKER).toBe('dvojni podpis')
    expect(CSRF_REJECTION_EVENT).toBe('roksal:csrf-zavrnjen')
  })
})

// ── ruta DELETE /api/auth/sessions — odjava ostalih naprav ─────────────────────

function bearer(token: string, method = 'GET'): Request {
  return new Request('http://localhost/api/auth/sessions', {
    method,
    headers: { authorization: `Bearer ${token}` },
  })
}

describe('R195 ruta — DELETE /api/auth/sessions (ostani tu, ostalo umri)', () => {
  it('brez žetona → 401 (fail-closed)', async () => {
    const route = await import('@/app/api/auth/sessions/route')
    const res = await route.DELETE(new Request('http://localhost/api/auth/sessions', { method: 'DELETE' }))
    expect(res.status).toBe(401)
  })

  it('revoke OSTALIH sej; trenutna ostane ŽIVA; revizijski zapis SESSION_REVOKE_OTHERS', async () => {
    const { user, token } = await createTestUserWithSession(`r195a-${Date.now()}`)
    const otherToken = await createTestSessionToken(user)
    const authRoute = await import('@/app/api/auth/route')

    // obe seji živi pred dejanjem
    expect((await authRoute.GET(bearer(token))).status).toBe(200)
    expect((await authRoute.GET(bearer(otherToken))).status).toBe(200)

    const route = await import('@/app/api/auth/sessions/route')
    const res = await route.DELETE(bearer(token, 'DELETE'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { success: boolean; revoked: number }
    expect(body.success).toBe(true)
    expect(body.revoked).toBe(1)

    // tuja naprava mrli, trenutna ŽIVA
    expect((await authRoute.GET(bearer(otherToken))).status).toBe(401)
    expect((await authRoute.GET(bearer(token))).status).toBe(200)

    // revizijska sled — ločena družina od LOGOUT (nima stranskih učinkov piškotkov)
    const logs = await db.auditLog.findMany({
      where: { userId: user.id, akcija: 'SESSION_REVOKE_OTHERS' },
    })
    expect(logs.length).toBeGreaterThanOrEqual(1)
  })

  it('brez ostalih naprav → 200 revoked 0 (idempotentno, brez napake)', async () => {
    const { user, token } = await createTestUserWithSession(`r195b-${Date.now()}`)
    const route = await import('@/app/api/auth/sessions/route')
    const res = await route.DELETE(bearer(token, 'DELETE'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { revoked: number }
    expect(body.revoked).toBe(0)
    // uporabnik še vedno prijavljen
    const authRoute = await import('@/app/api/auth/route')
    expect((await authRoute.GET(bearer(token))).status).toBe(200)
  })

  it('tuj uporabnik ni dotaknjen (revoke filtrira po profileId)', async () => {
    const { user: a, token: tokenA } = await createTestUserWithSession(`r195c-${Date.now()}`)
    const { user: b, token: tokenB } = await createTestUserWithSession(`r195d-${Date.now()}`)
    const otherB = await createTestSessionToken(b)

    const route = await import('@/app/api/auth/sessions/route')
    const res = await route.DELETE(bearer(tokenA, 'DELETE'))
    expect(res.status).toBe(200)

    // B-jeve seji ostali ŽIVE
    const authRoute = await import('@/app/api/auth/route')
    expect((await authRoute.GET(bearer(tokenB))).status).toBe(200)
    expect((await authRoute.GET(bearer(otherB))).status).toBe(200)
  })
})
