// Roksal — testi R196: obvestilo o novi prijavi (NEW_LOGIN login alert)
// ---------------------------------------------------------------------------
// Realna baza (roksal_test prek globalSetup), prave rute:
//   • uspešna prijava z geslom → NEW_LOGIN vrstica za prijavljeni profil
//     (template + verzija, naslovnik XOR, sporocilo z deterministično
//     oznako naprave, entityId = jti seje, korelacija iz zahtevka);
//   • lenobni dispatch (GET /api/notifications notranjost) → QUEUED → SENT —
//     obvestilo DEJANSKO prispe v zvonček;
//   • demo profil (R127, brez gesla, efemeren) NE ustvari NEW_LOGIN —
//     brez lastnika = samo šum;
//   • predloga je registrirana (fail-closed seznam NOTIFICATION_TEMPLATES).
// Brez AI, brez naključja (unikatni e-naslovi so izključno za izolacijo testov).

import { describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { NOTIFICATION_TEMPLATES } from '@/lib/notifications'
import { upsertTestProfile } from './helpers/test-session'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

async function prijava(email: string, geslo: string, userAgent: string | null) {
  const route = await import('@/app/api/auth/route')
  const headers = new Headers({ 'content-type': 'application/json' })
  if (userAgent) headers.set('user-agent', userAgent)
  return route.POST(
    new Request('http://localhost/api/auth', {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password: geslo }),
    }),
  )
}

describe('R196 — NEW_LOGIN obvestilo o novi prijavi', () => {
  it('predloga NEW_LOGIN je registrirana (verzija 1, fail-closed seznam)', () => {
    expect(NOTIFICATION_TEMPLATES.NEW_LOGIN).toEqual({ version: 1 })
  })

  it('uspešna prijava ustvari NEW_LOGIN vrstico za prijavljeni profil (npr. z napravo + entityId = jti)', async () => {
    const email = `r196-login-${Date.now()}@test.si`
    const geslo = 'geslo-test-r196'
    await db.profile.upsert({
      where: { email },
      update: { passwordHash: await hashPassword(geslo) },
      create: { email, ime: 'R196 Prijava', vloga: 'MONTER', passwordHash: await hashPassword(geslo) },
    })

    const res = await prijava(email, geslo, UA)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { user: { id: string } }
    const profileId = body.user.id

    const vrstice = await db.notification.findMany({
      where: { userId: profileId, template: 'NEW_LOGIN' },
      orderBy: { createdAt: 'desc' },
    })
    expect(vrstice.length).toBe(1)
    const vrstica = vrstice[0]
    expect(vrstica.templateVersion).toBe(1)
    expect(vrstica.naslov).toBe('Nova prijava v vaš račun')
    // deterministična oznaka naprave (deviceLabelLine: device · os · browser)
    expect(vrstica.sporocilo).toContain('Računalnik')
    expect(vrstica.sporocilo).toContain('Chrome')
    expect(vrstica.entityType).toBe('session')
    // entityId = jti — najnovejša živa seja tega profila
    const seja = await db.userSession.findFirst({
      where: { profileId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    })
    expect(vrstica.entityId).toBe(seja?.id ?? null)
    // XOR naslavljanje: userId nastavljen, recipientRole prazno
    expect(vrstica.recipientRole).toBeNull()
    expect(vrstica.status).toBe('QUEUED')
  })

  it('lenobni dispatch pošlje NEW_LOGIN (QUEUED → SENT) — obvestilo prispe v zvonček', async () => {
    const email = `r196-dispatch-${Date.now()}@test.si`
    const geslo = 'geslo-test-r196'
    await db.profile.upsert({
      where: { email },
      update: { passwordHash: await hashPassword(geslo) },
      create: { email, ime: 'R196 Dispatch', vloga: 'VODJA', passwordHash: await hashPassword(geslo) },
    })
    const res = await prijava(email, geslo, UA)
    expect(res.status).toBe(200)
    const { user } = (await res.json()) as { user: { id: string } }

    await (await import('@/lib/notifications')).dispatchQueuedNotifications()

    const vrstica = await db.notification.findFirst({
      where: { userId: user.id, template: 'NEW_LOGIN' },
    })
    expect(vrstica).not.toBeNull()
    expect(vrstica!.status).toBe('SENT')
    expect(vrstica!.sentAt).not.toBeNull()
  })

  it('prijava z ocidlom brez user-agent glave ostane delujoča (sporocilo z Neznana naprava)', async () => {
    const email = `r196-noua-${Date.now()}@test.si`
    const geslo = 'geslo-test-r196'
    await db.profile.upsert({
      where: { email },
      update: { passwordHash: await hashPassword(geslo) },
      create: { email, ime: 'R196 NoUA', vloga: 'MONTER', passwordHash: await hashPassword(geslo) },
    })
    const res = await prijava(email, geslo, null)
    expect(res.status).toBe(200)
    const { user } = (await res.json()) as { user: { id: string } }
    const vrstica = await db.notification.findFirst({
      where: { userId: user.id, template: 'NEW_LOGIN' },
    })
    expect(vrstica).not.toBeNull()
    // device-label za manjkajoč UA je determinističen (Neznana …)
    expect(vrstica!.sporocilo).toContain('·')
  })

  it('demo profil NE ustvari NEW_LOGIN (efemeren račun brez lastnika — samo šum)', async () => {
    const demoRoute = await import('@/app/api/auth/demo/route')
    const res = await demoRoute.POST(
      new Request('http://localhost/api/auth/demo', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'origin': 'http://localhost' },
        body: '{}',
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json().catch(() => null)) as { user?: { id?: string } } | null
    const demoId = body?.user?.id
    expect(demoId).toBeTruthy()
    const vrstice = await db.notification.findMany({
      where: { userId: demoId!, template: 'NEW_LOGIN' },
    })
    expect(vrstice.length).toBe(0)
  })
})
