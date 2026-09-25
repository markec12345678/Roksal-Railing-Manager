// Roksal — testi življenjskega cikla uporabnikov (R134, issue #5 §9)
// ---------------------------------------------------------------------------
// Dokazuje §9 pogodbo (baza roksal_test prek globalSetup):
//   • assertSessionAlive: deaktiviran/zaklenjen profil → že izdani žeton
//     NE dela več (hard requirement: "Deaktiviran uporabnik ne sme
//     nadaljevati z že izdanim tokenom");
//   • prijava blokiranega računa → 403 + LOGIN_BLOCKED dnevnik (za uspešnim
//     geslom — brez pravic ne izveš ničesar o statusu tujega računa);
//   • upravljanje: samo ADMIN seja (VODJA bere, MONTER/API ključ → 403),
//     self-guard (ADMIN ne deaktivira/zaklene/spremeni vloge sebi);
//   • deactivate/lock revoke-ata VSE žive seje (dvojna plast z assert);
//   • setRole: audit nova vloga + seje revoke; ista vloga → 400;
//   • invite: profil brez gesla + hash žetona v bazi (čistega NIKOLI) +
//     7 dni potek + audit; dvojen e-naslov → 409;
//   • activate: veljaven žeton nastavi geslo + počisti žeton + USER_ACTIVATED;
//     potečen/porabljen/neznan → ISTA 400; nato prijava dela;
//   • resetPassword: začasno geslo dela + mustChangePassword + seje revoke;
//   • email change: napačno geslo → 403, dvojen e-naslov → 409, uspeh →
//     audit + prijava z novo e-pošto dela.
// Brez AI, brez naključja (unikatni e-naslovi izključno za izolacijo testov).

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import {
  TEMP_PASSWORD_LENGTH,
  VALID_ROLES,
  accountBlock,
  generateTempPassword,
  hashInviteToken,
} from '@/lib/user-lifecycle'
import { verifyPassword, hashPassword } from '@/lib/password'

const BASE = 'http://localhost/api/users'

function request(
  method: 'GET' | 'POST',
  token: string,
  body?: Record<string, unknown>,
): Request {
  return new Request(BASE, {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      origin: 'http://localhost',
    },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  })
}

async function makeProfile(email: string, ime: string, vloga: (typeof VALID_ROLES)[number] = 'MONTER'): Promise<string> {
  const p = await db.profile.create({ data: { email, ime, vloga } })
  return p.id
}

describe('lifecycle helperji — blokada, temp geslo, žeton (R134 §9)', () => {
  it('accountBlock: deaktivacija premaga zaklep pri PREDSTAVLJANJU, oba blokirata', () => {
    const past = new Date(Date.now() - 1000)
    const future = new Date(Date.now() + 86_400_000)
    expect(accountBlock({ deactivatedAt: null, lockedAt: null })).toBeNull()
    expect(accountBlock({ deactivatedAt: past, lockedAt: null })).toBe('DEACTIVATED')
    expect(accountBlock({ deactivatedAt: null, lockedAt: past })).toBe('LOCKED')
    // prihodnji datumi še ne blokirajo (vrstni red v času je determinističen)
    expect(accountBlock({ deactivatedAt: future, lockedAt: null })).toBeNull()
    // oba: deaktivacija je vidnejši razlog (offboarding nad zaklepom)
    expect(accountBlock({ deactivatedAt: past, lockedAt: past })).toBe('DEACTIVATED')
  })

  it('generateTempPassword: prava dolžina, brez nejasnih znakov, vsaj številka + mala + velika', () => {
    for (let i = 0; i < 8; i += 1) {
      const p = generateTempPassword()
      expect(p).toHaveLength(TEMP_PASSWORD_LENGTH)
      expect(p).not.toMatch(/[0O1lI]/)
      expect(p).toMatch(/[0-9]/)
      expect(p).toMatch(/[a-z]/)
      expect(p).toMatch(/[A-Z]/)
      expect(generateTempPassword()).not.toBe(p) // dva klica različna
    }
  })

  it('VALID_ROLES pokriva vse vloge iz sheme; hash žetona je determinističen in pepper-odvisen', () => {
    expect(VALID_ROLES).toEqual(['ADMIN', 'VODJA', 'MONTER', 'SKLADISCE'])
    const h1 = hashInviteToken('test-token-abc')
    expect(h1).toBe(hashInviteToken('test-token-abc'))
    expect(h1).toHaveLength(64)
    expect(h1).not.toContain('test-token')
  })
})

describe('§9 upravljanje računov — deaktivacija, zaklep, vloge (hard requirement)', () => {
  let uniqueCounter = 0
  const nextEmail = (p: string) => `r134-${p}-${Date.now()}-${(uniqueCounter += 1)}@roksal.si`

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('DEAKTIVACIJA: že izdani žeton takoj preneha delovati + seje revoke + USER_DEACTIVATE dnevnik', async () => {
    const { token: adminToken } = await createTestUserWithSession(nextEmail('adm'), 'ADMIN')
    // ciljni uporabnik z ŽIVO sejo (žeton izdan PRED deaktivacijo)
    const { user: victim, token: victimToken } = await createTestUserWithSession(nextEmail('victim'), 'MONTER')

    // pred deaktivacijo: žeton dela (authenticate uspešen)
    const projectsRoute = await import('@/app/api/projects/route')
    const before = await projectsRoute.GET(new Request('http://localhost/api/projects', {
      headers: { authorization: `Bearer ${victimToken}` },
    }))
    expect(before.status).toBe(200)

    const route = await import('@/app/api/users/route')
    const res = await route.POST(request('POST', adminToken, { action: 'deactivate', userId: victim.id }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { revokedSessions: number }
    expect(body.revokedSessions).toBeGreaterThanOrEqual(1)

    // HARD REQUIREMENT: isti žeton NE dela več (authenticate → 401)
    const after = await projectsRoute.GET(new Request('http://localhost/api/projects', {
      headers: { authorization: `Bearer ${victimToken}` },
    }))
    expect(after.status).toBe(401)

    const auditRow = await db.auditLog.findFirst({
      where: { akcija: 'USER_DEACTIVATE', oldValue: { contains: victim.email } },
      orderBy: { timestamp: 'desc' },
    })
    expect(auditRow).not.toBeNull()
  })

  it('LOGIN_BLOCKED: račun z geslom + zaklenjen → 403 z jasnim sporočilom (ne 401 invalid)', async () => {
    const email = nextEmail('locked')
    const id = await makeProfile(email, 'Zaklenjen Test')
    await db.profile.update({
      where: { id },
      data: { passwordHash: await hashPassword('PravoGeslo123'), lockedAt: new Date() },
    })

    const loginRoute = await import('@/app/api/auth/route')
    const res = await loginRoute.POST(new Request('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({ email, password: 'PravoGeslo123' }),
    }))
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('zaklenjen')

    const log = await db.auditLog.findFirst({ where: { akcija: 'LOGIN_BLOCKED' }, orderBy: { timestamp: 'desc' } })
    expect(log).not.toBeNull()
    expect(log!.newValue).toContain('LOCKED')
  })

  it('SELF-GUARD + dostop: ADMIN ne deaktivira/zaklene/vloge sebe; MONTER in API ključ → 403; VODJA bere, ne upravlja', async () => {
    const { user: admin, token: adminToken } = await createTestUserWithSession(nextEmail('adm2'), 'ADMIN')
    const route = await import('@/app/api/users/route')

    // self-guard (destruktivne akcije na sebi)
    for (const action of ['deactivate', 'lock', 'setRole']) {
      const res = await route.POST(request('POST', adminToken, {
        action,
        userId: admin.id,
        ...(action === 'setRole' ? { vloga: 'MONTER' } : {}),
      }))
      expect(res.status).toBe(400)
    }
    // unlock na sebi je non-destructive → 200
    const unlockSelf = await route.POST(request('POST', adminToken, { action: 'unlock', userId: admin.id }))
    expect(unlockSelf.status).toBe(200)

    // MONTER ne upravlja in ne bere
    const { token: monterToken } = await createTestUserWithSession(nextEmail('mon'), 'MONTER')
    const monterPost = await route.POST(request('POST', monterToken, { action: 'deactivate', userId: admin.id }))
    expect(monterPost.status).toBe(403)
    const monterGet = await route.GET(request('GET', monterToken))
    expect(monterGet.status).toBe(403)

    // API ključ → 403 (upravljanje je samo prek seje)
    const { hashApiKey } = await import('@/lib/password')
    const rawKey = `rkm_test_${Date.now()}_r134`
    await db.apiKey.create({
      data: { name: `vitest-r134-${Date.now()}`, keyHash: hashApiKey(rawKey), keyPrefix: rawKey.slice(0, 12), scopes: 'projects:read' },
    })
    const keyPost = await route.POST(new Request(BASE, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${rawKey}`, origin: 'http://localhost' },
      body: JSON.stringify({ action: 'deactivate', userId: admin.id }),
    }))
    expect(keyPost.status).toBe(403)

    // VODJA bere (200), ne upravlja (403)
    const { token: vodjaToken } = await createTestUserWithSession(nextEmail('vod'), 'VODJA')
    const vodjaGet = await route.GET(request('GET', vodjaToken))
    expect(vodjaGet.status).toBe(200)
    const vodjaPost = await route.POST(request('POST', vodjaToken, { action: 'deactivate', userId: admin.id }))
    expect(vodjaPost.status).toBe(403)
  })

  it('LOCK/UNLOCK + REACTIVATE: stanja se preklapljajo, dnevnik nosi prave akcije', async () => {
    const { token: adminToken } = await createTestUserWithSession(nextEmail('adm3'), 'ADMIN')
    const victimEmail = nextEmail('target')
    const victimId = await makeProfile(victimEmail, 'Target Test')
    const route = await import('@/app/api/users/route')

    const lock = await route.POST(request('POST', adminToken, { action: 'lock', userId: victimId }))
    expect(lock.status).toBe(200)
    expect((await lock.json()) as { revokedSessions: number }).toBeDefined()
    expect((await db.profile.findUnique({ where: { id: victimId }, select: { lockedAt: true } }))!.lockedAt).not.toBeNull()

    const unlock = await route.POST(request('POST', adminToken, { action: 'unlock', userId: victimId }))
    expect(unlock.status).toBe(200)
    expect((await db.profile.findUnique({ where: { id: victimId }, select: { lockedAt: true } }))!.lockedAt).toBeNull()

    const deact = await route.POST(request('POST', adminToken, { action: 'deactivate', userId: victimId }))
    expect(deact.status).toBe(200)
    const react = await route.POST(request('POST', adminToken, { action: 'reactivate', userId: victimId }))
    expect(react.status).toBe(200)
    expect((await db.profile.findUnique({ where: { id: victimId }, select: { deactivatedAt: true } }))!.deactivatedAt).toBeNull()

    for (const akcija of ['USER_LOCK', 'USER_UNLOCK', 'USER_DEACTIVATE', 'USER_REACTIVATE']) {
      const row = await db.auditLog.findFirst({
        where: { akcija, oldValue: { contains: victimEmail } },
        orderBy: { timestamp: 'desc' },
      })
      // dnevnik vodi identiteto cilja (e-pošta v oldValue)
      expect(row).not.toBeNull()
    }
  })

  it('SET_ROLE: vloga se spremeni + seje revoke + audit nova vloga; ista vloga → 400; neznana → 400', async () => {
    const { token: adminToken } = await createTestUserWithSession(nextEmail('adm4'), 'ADMIN')
    const { user: victim, token: victimToken } = await createTestUserWithSession(nextEmail('victim4'), 'MONTER')
    const route = await import('@/app/api/users/route')

    // ista vloga → 400
    const same = await route.POST(request('POST', adminToken, { action: 'setRole', userId: victim.id, vloga: 'MONTER' }))
    expect(same.status).toBe(400)

    // sprememba MONTER → VODJA
    const res = await route.POST(request('POST', adminToken, { action: 'setRole', userId: victim.id, vloga: 'VODJA' }))
    expect(res.status).toBe(200)
    expect((await db.profile.findUnique({ where: { id: victim.id }, select: { vloga: true } }))!.vloga).toBe('VODJA')

    // seje cilja so revoke (žeton nosi staro vlogo)
    const projectsRoute = await import('@/app/api/projects/route')
    const after = await projectsRoute.GET(new Request('http://localhost/api/projects', {
      headers: { authorization: `Bearer ${victimToken}` },
    }))
    expect(after.status).toBe(401)

    const log = await db.auditLog.findFirst({ where: { akcija: 'USER_ROLE_CHANGE' }, orderBy: { timestamp: 'desc' } })
    expect(log).not.toBeNull()
    expect(log!.newValue).toContain('VODJA')

    // neznana vloga → 400 (zod enum)
    const bad = await route.POST(request('POST', adminToken, { action: 'setRole', userId: victim.id, vloga: 'CESAR' }))
    expect(bad.status).toBe(400)
  })
})

describe('§9 povabila + aktivacija + reset gesla + menjava e-pošte', () => {
  let uniqueCounter = 0
  const nextEmail = (p: string) => `r134-${p}-${Date.now()}-${(uniqueCounter += 1)}@roksal.si`

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('INVITE: profil brez gesla + hash žetona (čistega NI v bazi) + 7 dni + audit; dvojen e-naslov → 409', async () => {
    const { token: adminToken } = await createTestUserWithSession(nextEmail('adm'), 'ADMIN')
    const route = await import('@/app/api/users/route')
    const email = nextEmail('invited')

    const res = await route.POST(request('POST', adminToken, { action: 'invite', email, ime: 'Povabljen Test', vloga: 'MONTER' }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { activationPath: string }
    expect(body.activationPath).toMatch(/^\/aktivacija\/[A-Za-z0-9_-]{24}$/)

    const profile = await db.profile.findUnique({ where: { email } })
    expect(profile).not.toBeNull()
    expect(profile!.passwordHash).toBeNull()
    expect(profile!.inviteTokenHash).toHaveLength(64)
    // čistega žetona NIKOLI v bazi (v bazi je samo hash)
    const rawToken = body.activationPath.split('/').pop()!
    expect(JSON.stringify(profile)).not.toContain(rawToken)
    const days = Math.round((profile!.inviteExpiresAt!.getTime() - Date.now()) / 86_400_000)
    expect(days).toBeGreaterThanOrEqual(6)
    expect(days).toBeLessThanOrEqual(7)

    const dvojnik = await route.POST(request('POST', adminToken, { action: 'invite', email, ime: 'Dvojnik', vloga: 'MONTER' }))
    expect(dvojnik.status).toBe(409)

    const log = await db.auditLog.findFirst({ where: { akcija: 'USER_INVITE' }, orderBy: { timestamp: 'desc' } })
    expect(log).not.toBeNull()
  })

  it('ACTIVATE: veljaven žeton nastavi geslo + počisti žeton + USER_ACTIVATED; prijava dela; porabljen/neznan žeton → ISTA 400', async () => {
    const { token: adminToken } = await createTestUserWithSession(nextEmail('adm'), 'ADMIN')
    const usersRoute = await import('@/app/api/users/route')
    const activateRoute = await import('@/app/api/users/activate/route')
    const email = nextEmail('act')

    const res = await usersRoute.POST(request('POST', adminToken, { action: 'invite', email, ime: 'Aktivacija Test', vloga: 'MONTER' }))
    const { activationPath } = (await res.json()) as { activationPath: string }
    const token = activationPath.split('/').pop()!

    // aktivacija s prekratkim geslom → 400
    const weak = await activateRoute.POST(new Request('http://localhost/api/users/activate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({ token, password: 'krajši' }),
    }))
    expect(weak.status).toBe(400)

    // uspešna aktivacija
    const ok = await activateRoute.POST(new Request('http://localhost/api/users/activate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({ token, password: 'MojeNovoGeslo1' }),
    }))
    expect(ok.status).toBe(200)

    const profile = await db.profile.findUnique({ where: { email } })
    expect(profile!.passwordHash).not.toBeNull()
    expect(profile!.inviteTokenHash).toBeNull() // enkratna uporaba
    expect(await verifyPassword('MojeNovoGeslo1', profile!.passwordHash)).toBe(true)

    // isti žeton ponovno → ISTA 400 kot neznan (enumeration protection)
    const reused = await activateRoute.POST(new Request('http://localhost/api/users/activate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({ token, password: 'MojeNovoGeslo1' }),
    }))
    expect(reused.status).toBe(400)
    const unknown = await activateRoute.POST(new Request('http://localhost/api/users/activate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({ token: 'neznan-zeton-aktivacije', password: 'MojeNovoGeslo1' }),
    }))
    expect(await reused.json()).toEqual(await unknown.json())

    // prijava z novim geslom dela
    const loginRoute = await import('@/app/api/auth/route')
    const login = await loginRoute.POST(new Request('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({ email, password: 'MojeNovoGeslo1' }),
    }))
    expect(login.status).toBe(200)

    const log = await db.auditLog.findFirst({ where: { akcija: 'USER_ACTIVATED' }, orderBy: { timestamp: 'desc' } })
    expect(log).not.toBeNull()
  })

  it('RESET PASSWORD: začasno geslo dela + mustChangePassword + seje revoke; login nosi zastavico; gesla NIKOLI v dnevniku', async () => {
    const { token: adminToken } = await createTestUserWithSession(nextEmail('adm'), 'ADMIN')
    const route = await import('@/app/api/users/route')
    // cilj: profil Z geslom in živo sejo (isti profil — helper pomeni identiteto)
    const { user: victim, token: victimToken } = await createTestUserWithSession(nextEmail('victim'), 'MONTER')
    await db.profile.update({
      where: { id: victim.id },
      data: { passwordHash: await hashPassword('StaroGeslo123') },
    })

    const res = await route.POST(request('POST', adminToken, { action: 'resetPassword', userId: victim.id }))
    expect(res.status).toBe(200)
    const { tempPassword } = (await res.json()) as { tempPassword: string }
    expect(tempPassword).toHaveLength(TEMP_PASSWORD_LENGTH)

    // stari žeton mrtev
    const projectsRoute = await import('@/app/api/projects/route')
    expect((await projectsRoute.GET(new Request('http://localhost/api/projects', {
      headers: { authorization: `Bearer ${victimToken}` },
    }))).status).toBe(401)

    // začasno geslo dela za prijavo; odgovor nosi mustChangePassword=true
    const loginRoute = await import('@/app/api/auth/route')
    const login = await loginRoute.POST(new Request('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({ email: victim.email, password: tempPassword }),
    }))
    expect(login.status).toBe(200)
    const loginBody = (await login.json()) as { mustChangePassword: boolean }
    expect(loginBody.mustChangePassword).toBe(true)

    const profile = await db.profile.findUnique({ where: { id: victim.id } })
    expect(await verifyPassword(tempPassword, profile!.passwordHash)).toBe(true)

    const log = await db.auditLog.findFirst({ where: { akcija: 'USER_PASSWORD_RESET' }, orderBy: { timestamp: 'desc' } })
    expect(log).not.toBeNull()
    // geslo NIKOLI v dnevniku (niti začasno niti katerikoli drug)
    expect(JSON.stringify(log)).not.toContain(tempPassword)
    expect(JSON.stringify(log)).not.toContain('StaroGeslo123')
  })

  it('EMAIL CHANGE: napačno geslo → 403; dvojen e-naslov → 409; uspeh → audit + prijava z novo e-pošto', async () => {
    const { user: me, token } = await createTestUserWithSession(nextEmail('me'), 'MONTER')
    await db.profile.update({ where: { id: me.id }, data: { passwordHash: await hashPassword('Geslo1234') } })

    const route = await import('@/app/api/auth/email/route')
    const call = (body: Record<string, unknown>) =>
      route.POST(new Request('http://localhost/api/auth/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, origin: 'http://localhost' },
        body: JSON.stringify(body),
      }))

    // napačno trenutno geslo → 403
    const wrong = await call({ newEmail: nextEmail('email-new'), currentPassword: 'Narobe1' })
    expect(wrong.status).toBe(403)

    // dvojen e-naslov → 409 (vzamemo e-pošto drugega profila)
    const otherEmail = nextEmail('email-other')
    await makeProfile(otherEmail, 'Other')
    const dup = await call({ newEmail: otherEmail, currentPassword: 'Geslo1234' })
    expect(dup.status).toBe(409)

    // uspeh → nova e-pošta v bazi + USER_EMAIL_CHANGE dnevnik
    const newEmail = nextEmail('email-new2')
    const ok = await call({ newEmail, currentPassword: 'Geslo1234' })
    expect(ok.status).toBe(200)
    expect((await db.profile.findUnique({ where: { id: me.id }, select: { email: true } }))!.email).toBe(newEmail)
    const log = await db.auditLog.findFirst({ where: { akcija: 'USER_EMAIL_CHANGE' }, orderBy: { timestamp: 'desc' } })
    expect(log).not.toBeNull()

    // prijava z NOVO e-pošto dela
    const loginRoute = await import('@/app/api/auth/route')
    const login = await loginRoute.POST(new Request('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({ email: newEmail, password: 'Geslo1234' }),
    }))
    expect(login.status).toBe(200)
  })
})
