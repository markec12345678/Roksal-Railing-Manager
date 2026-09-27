// Roksal — testi R198: obvestilo o menjavi gesla + masovno 'Označi vse kot prebrano'
// ---------------------------------------------------------------------------
// Realna baza (roksal_test prek globalSetup), prave rute:
//   • uspešna menjava lastnega gesla (/api/auth/password) → PASSWORD_CHANGED
//     vrstica za lastnika profila (entity = profile, QUEUED), sporocilo vsebuje
//     število odjavljenih naprav ('Vse seje so odjavljene (N naprav)') + klic
//     skrbniku, če menjave ni bil lastnik;
//   • menjava poče VSE seje — žeton po menjavi je MRTAV (regresija R137);
//   • napaka obvestila (createMany pada) NIKOLI ne podre menjave gesla
//     (best-effort — 200 relogin:true ostane);
//   • neuspešna menjava (napačno trenutno geslo) → 401 in NOVA vrstica ne
//     nastane (samo uspešne menjave se obvestijo);
//   • markAllNotificationsOpened: VSE vidne SENT|DELIVERED → OPENED,
//     QUEUED/FAILED + tuje vrstice se NE dotakne; idempotentno (2. klic → 0);
//   • POST /api/notifications/read { all: true } → 200 { opened: N }; { id } in
//     { all } hkrati → 400 (XOR); prazno telo → 400; anon → 401;
//   • predloga je registrirana (fail-closed seznam NOTIFICATION_TEMPLATES);
//   • zvonček: PASSWORD_CHANGED ima ščit + jantarno (VARNOSTNE_PREDLOGE),
//     masovni gumb 'Označi vse' je vezan na neprebrane vrstice.
// Brez AI, brez naključja (unikatni e-naslovi so izključno za izolacijo testov).

import { describe, expect, it, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import {
  markAllNotificationsOpened,
  NOTIFICATION_TEMPLATES,
  queueNotifications,
} from '@/lib/notifications'
import { createTestUserWithSession, createTestSessionToken, type TestUser } from './helpers/test-session'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

let uniqueCounter = 0
const nextEmail = (p: string) => `r198-${p}-${Date.now()}-${(uniqueCounter += 1)}@test.si`

/** Profil z geslom + ŽIV sejni žeton (menjava gesla zahteva oboje). */
async function ustvariProfilZGeslom(ime: string, geslo: string, vloga: 'ADMIN' | 'VODJA' | 'MONTER' = 'MONTER') {
  const email = nextEmail(ime)
  const profile = await db.profile.create({
    data: { email, ime: `R198 ${ime}`, vloga, passwordHash: await hashPassword(geslo) },
  })
  const token = await createTestSessionToken({
    id: profile.id,
    email: profile.email,
    ime: profile.ime,
    vloga: profile.vloga,
  })
  return { profile, token }
}

async function spremeniGeslo(token: string, trenutno: string, novo: string) {
  const route = await import('@/app/api/auth/password/route')
  return route.POST(
    new Request('http://localhost/api/auth/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, origin: 'http://localhost' },
      body: JSON.stringify({ currentPassword: trenutno, newPassword: novo }),
    }),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('R198 — obvestilo o menjavi gesla (PASSWORD_CHANGED v1)', () => {
  it('predloga PASSWORD_CHANGED je registrirana (verzija 1, fail-closed seznam)', () => {
    expect(NOTIFICATION_TEMPLATES.PASSWORD_CHANGED).toEqual({ version: 1 })
  })

  it('uspešna menjava gesla ustvari PASSWORD_CHANGED vrstico s števcem odjavljenih naprav; žeton po menjavi je mrtav', async () => {
    const geslo = 'staro-geslo-r198'
    const { profile, token } = await ustvariProfilZGeslom('menjava', geslo)

    const res = await spremeniGeslo(token, geslo, 'novo-geslo-r198-x')
    expect(res.status).toBe(200)
    expect(((await res.json()) as { relogin: boolean }).relogin).toBe(true)

    // menjava poče VSE seje (R137 fail-closed) — testni žeton je mrtav
    const mrtav = await spremeniGeslo(token, 'novo-geslo-r198-x', 'še-jedno-r198')
    expect(mrtav.status).toBe(401)

    const vrstice = await db.notification.findMany({
      where: { userId: profile.id, template: 'PASSWORD_CHANGED' },
    })
    expect(vrstice.length).toBe(1)
    const vrstica = vrstice[0]
    expect(vrstica.templateVersion).toBe(1)
    expect(vrstica.naslov).toBe('Vaše geslo je bilo spremenjeno')
    expect(vrstica.sporocilo).toContain('Vse seje so odjavljene (1 naprav)')
    expect(vrstica.sporocilo).toContain('če to niste bili vi, takoj obvestite skrbnika')
    expect(vrstica.entityType).toBe('profile')
    expect(vrstica.entityId).toBe(profile.id)
    expect(vrstica.recipientRole).toBeNull()
    expect(vrstica.status).toBe('QUEUED')
    expect(vrstica.correlationId).toBeTruthy()
  })

  it('napaka obvestila (createMany pada) NIKOLI ne podre menjave gesla (best-effort)', async () => {
    const geslo = 'staro-geslo-r198-b'
    const { profile, token } = await ustvariProfilZGeslom('menjava-b', geslo)

    const spy = vi.spyOn(db.notification, 'createMany').mockRejectedValueOnce(new Error('r198 simuliran izpad'))
    try {
      const res = await spremeniGeslo(token, geslo, 'novo-geslo-r198-b')
      expect(res.status).toBe(200)
      expect(((await res.json()) as { relogin: boolean }).relogin).toBe(true)
      // geslo je VSEENO zamenjano + seje počečene (transakcija pred obvestilom)
      const svezi = await db.profile.findUniqueOrThrow({ where: { id: profile.id } })
      expect(await import('@/lib/password').then((m) => m.verifyPassword('novo-geslo-r198-b', svezi.passwordHash!))).toBe(true)
      const seje = await db.userSession.findMany({ where: { profileId: profile.id } })
      expect(seje.every((s) => s.revokedAt !== null)).toBe(true)
      // in vrstice NE nastane (brez tihe izgube — napaka gre v konzolo)
      const vrstice = await db.notification.count({ where: { userId: profile.id, template: 'PASSWORD_CHANGED' } })
      expect(vrstice).toBe(0)
    } finally {
      spy.mockRestore()
    }
  })

  it('neuspešna menjava (napačno trenutno geslo) → 401 in brez nove vrstice', async () => {
    const geslo = 'staro-geslo-r198-c'
    const { profile, token } = await ustvariProfilZGeslom('menjava-c', geslo)

    const pred = await db.notification.count({ where: { template: 'PASSWORD_CHANGED' } })
    const res = await spremeniGeslo(token, 'napacno-trenutno', 'novo-geslo-r198-c')
    expect(res.status).toBe(401)
    const po = await db.notification.count({ where: { template: 'PASSWORD_CHANGED' } })
    expect(po).toBe(pred)
  })
})

describe('R198 — masovno označevanje prebrano (markAllNotificationsOpened + { all: true })', () => {
  it('SENT+DELIVERED → OPENED; FAILED in tuje vrstice se ne dotakne; vloga-vrstica se odpre; idempotentno', async () => {
    // DETERMINIZEM: testni uporabnik je unikaten (izolacija od vzporednih
    // suite-ov, ki delijo roksal_test). Vrstice z statusom QUEUD namenoma NE
    // ustvarimo — lenobni dispatch (GET /api/notifications v drugem suite-u)
    // jih globalno preda v SENT in bi naredil števec nedoločen; izključitev
    // QUEUED je že pokrita per-row (r143: QUEUED → 409). FAILED je terminalen
    // (dispatch se je NE dotakne) → čist dokaz izključitve.
    const { user } = await createTestUserWithSession(`r198monter-${Date.now()}`, 'MONTER')
    const { user: tujec } = await createTestUserWithSession(`r198tujec-${Date.now()}`, 'MONTER')

    const ustvari = (podatki: { userId?: string; recipientRole?: 'MONTER'; status: 'SENT' | 'DELIVERED' | 'FAILED'; naslov: string }) =>
      db.notification.create({
        data: {
          userId: podatki.userId,
          recipientRole: podatki.recipientRole ?? null,
          naslov: podatki.naslov,
          template: 'LOW_STOCK',
          status: podatki.status,
          ...(podatki.status !== 'DELIVERED' ? { sentAt: new Date() } : { deliveredAt: new Date() }),
          correlationId: 'r198-bulk',
        },
      })

    const sent = await ustvari({ userId: user.id, status: 'SENT', naslov: 'r198 sent' })
    const delivered = await ustvari({ userId: user.id, status: 'DELIVERED', naslov: 'r198 delivered' })
    const failed = await ustvari({ userId: user.id, status: 'FAILED', naslov: 'r198 failed' })
    const tujecSent = await ustvari({ userId: tujec.id, status: 'SENT', naslov: 'r198 tujec sent' })
    // vloga-naslovljena vrstica je TUDI vidna (visibleScope) → se označi
    const vlogaVrstica = await ustvari({ recipientRole: 'MONTER', status: 'SENT', naslov: 'r198 vloga vrstica' })

    await markAllNotificationsOpened({ userId: user.id, vloga: 'MONTER' })

    const statusOf = async (id: string) =>
      (await db.notification.findUniqueOrThrow({ where: { id } })).status
    expect(await statusOf(sent.id)).toBe('OPENED')
    expect(await statusOf(delivered.id)).toBe('OPENED')
    expect(await statusOf(vlogaVrstica.id)).toBe('OPENED')
    // FAILED se NE dotakne (terminalen; samo SENT|DELIVERED se odpirajo)
    expect(await statusOf(failed.id)).toBe('FAILED')
    // tujčena vrstica ostane SENT (obseg = lastne + vložne)
    expect(await statusOf(tujecSent.id)).toBe('SENT')

    // idempotentno: uporabnik ima zdaj 0 vidnih SENT|DELIVERED vrstic → 0
    expect(await markAllNotificationsOpened({ userId: user.id, vloga: 'MONTER' })).toBe(0)
  })

  it('API matrica: { all: true } → 200 { opened }; { id + all } → 400; {} → 400; anon → 401; { id } per-row ostaja', async () => {
    const { user, token } = await createTestUserWithSession(`r198monter-api-${Date.now()}`, 'MONTER')
    const row = await db.notification.create({
      data: { userId: user.id, naslov: 'r198 api per-row', template: 'LOW_STOCK', status: 'SENT', sentAt: new Date(), correlationId: 'r198-api' },
    })
    await db.notification.create({
      data: { userId: user.id, naslov: 'r198 api bulk', template: 'LOW_STOCK', status: 'SENT', sentAt: new Date(), correlationId: 'r198-api' },
    })

    const readRoute = await import('@/app/api/notifications/read/route')
    const post = (token: string | null, body: unknown) =>
      readRoute.POST(
        new Request('http://localhost/api/notifications/read', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            origin: 'http://localhost',
          },
          body: JSON.stringify(body),
        }),
      )

    const anon = await post(null, { all: true })
    expect(anon.status).toBe(401)
    expect(anon.headers.get('x-correlation-id')).toBeTruthy()

    const oboje = await post(token, { id: row.id, all: true })
    expect(oboje.status).toBe(400)

    const prazno = await post(token, {})
    expect(prazno.status).toBe(400)

    const bulk = await post(token, { all: true })
    expect(bulk.status).toBe(200)
    expect(((await bulk.json()) as { opened: number }).opened).toBe(2)
    const poBulk = await db.notification.findMany({ where: { userId: user.id, correlationId: 'r198-api' } })
    expect(poBulk.every((n) => n.status === 'OPENED' && n.isRead)).toBe(true)

    // per-row ostaja (nova vrstica → id open → OPENED; ž Bulk ne poškoduje)
    const nova = await db.notification.create({
      data: { userId: user.id, naslov: 'r198 api per-row 2', template: 'LOW_STOCK', status: 'SENT', sentAt: new Date(), correlationId: 'r198-api' },
    })
    const ena = await post(token, { id: nova.id })
    expect(ena.status).toBe(200)
    expect(((await ena.json()) as { status: string }).status).toBe('OPENED')
  })
})

describe('R198 — zvonček source kontrakt (ščit + masovni gumb)', () => {
  it('VARNOSTNE_PREDLOGE vsebuje PASSWORD_CHANGED; masovni gumb vezan na neprebrane', () => {
    const src = srcOf('src/components/roksal/notification-center.tsx')
    expect(src).toMatch(/new Set\(\['NEW_LOGIN', 'FAILED_LOGINS', 'ACCOUNT_ACTIVATED', 'PASSWORD_CHANGED'\]\)/)
    expect(src).toContain('bg-roksal-amber/10')
    expect(src).toContain("body: JSON.stringify({ all: true })")
    expect(src).toContain('Označi vse')
    expect(src).toMatch(/neprebrana === 0[\s\S]{0,40}return null/)
    // strežniška pot: { all } dispecer + XOR refine
    const ruta = srcOf('src/app/api/notifications/read/route.ts')
    expect(ruta).toContain('markAllNotificationsOpened')
    expect(ruta).toContain('Natanko ena izbira: id ALI all.')
  })
})
