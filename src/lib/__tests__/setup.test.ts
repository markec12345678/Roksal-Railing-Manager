// Roksal — testi nastavitvene konzole (R137)
// ---------------------------------------------------------------------------
// Dokazuje pogodbo /api/setup (baza roksal_test prek globalSetup):
//   • brez ROKSAL_SETUP_TOKEN je konzola IZKLOPLJENA (GET {enabled:false},
//     POST 404) — fail-closed privzeto;
//   • napačen žeton → 403 + SETUP_DENIED dnevnik z hashiranim IP (32 hex,
//     surov IP NE v bazi);
//   • nevalidno telo → 400 (pravice žetona ne razkrivajo validacije);
//   • BOOTSTRAP: nov račun → ADMIN + geslo dela + SETUP_BOOTSTRAP dnevnik;
//   • BOOTSTRAP z ROKSAL_SETUP_EMAIL na drug e-naslov → 403, NIČ ne nastane;
//   • RECOVER: obstoječ račun + ujemajoče ožilje → novo geslo dela, stara
//     NE dela več, vloga ADMIN, deaktivacija odstranjena, ŽIVA seja revokana
//     (žeton mrtev — hard requirement §9), SETUP_RECOVER dnevnik;
//   • RECOVER brez ožilja (samo žeton) na obstoječem računu → 403 fail-closed
//     (žeton NI mojstrski ključ za prevzem tujih računov);
//   • politika resolveSetupMode: celotna 2×2 matrika deterministična.
// Brez AI, brez naključja (unikatni e-naslovi izključno za izolacijo testov).

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { db } from '@/lib/db'
import { resetRateLimit } from '@/lib/rate-limit'
import { resolveSetupMode, setupTokenFromEnv, tokenMatches } from '@/lib/setup'
import { verifyPassword } from '@/lib/password'

const BASE = 'http://localhost/api/setup'

function post(body: unknown, token?: string): Request {
  return new Request(BASE, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-setup-token': token ?? '',
      origin: 'http://localhost',
      'user-agent': 'vitest-setup',
    },
    body: JSON.stringify(body),
  })
}

let counter = 0
const nextEmail = (p: string) => `r137-setup-${p}-${Date.now()}-${(counter += 1)}@roksal.si`

const savedToken = process.env.ROKSAL_SETUP_TOKEN
const savedEmail = process.env.ROKSAL_SETUP_EMAIL

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  // Vsi testni Request-i imajo isti (neznan) IP — očisti vmemorijo limiterja,
  // da je limit 5/uro determinističen na raven posameznega testa.
  resetRateLimit()
})

afterEach(() => {
  vi.restoreAllMocks()
  if (savedToken === undefined) delete process.env.ROKSAL_SETUP_TOKEN
  else process.env.ROKSAL_SETUP_TOKEN = savedToken
  if (savedEmail === undefined) delete process.env.ROKSAL_SETUP_EMAIL
  else process.env.ROKSAL_SETUP_EMAIL = savedEmail
})

describe('setup helperji (R137)', () => {
  it('setupTokenFromEnv: odsoten/prekratek žeton = null (izklop), trim deluje, min 16 znakov', () => {
    delete process.env.ROKSAL_SETUP_TOKEN
    expect(setupTokenFromEnv()).toBeNull()
    process.env.ROKSAL_SETUP_TOKEN = 'krajši'
    expect(setupTokenFromEnv()).toBeNull() // prekratek = izklopljeno, ne polovično
    process.env.ROKSAL_SETUP_TOKEN = '  dolg-dovolj-zeton-123456  '
    expect(setupTokenFromEnv()).toBe('dolg-dovolj-zeton-123456')
  })

  it('tokenMatches: konstantnočasna primerjava, trim, napačna dolžina ne vrže napake', () => {
    expect(tokenMatches(' skrivni-zeton-12345678 ', 'skrivni-zeton-12345678')).toBe(true)
    expect(tokenMatches('skrivni-zeton-12345678', 'dolg-dovolj-zeton-123456')).toBe(false)
    expect(tokenMatches('kratek', 'daleč-daljši-pričakovani-zeton')).toBe(false) // brez izjeme
    expect(tokenMatches(null, 'daleč-daljši-pričakovani-zeton')).toBe(false)
    expect(tokenMatches(undefined, 'daleč-daljši-pričakovani-zeton')).toBe(false)
  })

  it('resolveSetupMode: celotna matrika ožilja je deterministična in fail-closed', () => {
    delete process.env.ROKSAL_SETUP_EMAIL
    // brez ožilja: nov → BOOTSTRAP, obstoječ → NIKOLI
    expect(resolveSetupMode('a@x.si', false)).toBe('BOOTSTRAP')
    expect(resolveSetupMode('a@x.si', true)).toBeNull()
    // z ožiljem: samo točen e-naslov
    process.env.ROKSAL_SETUP_EMAIL = 'lastnik@roksal.si'
    expect(resolveSetupMode('lastnik@roksal.si', false)).toBe('BOOTSTRAP')
    expect(resolveSetupMode('lastnik@roksal.si', true)).toBe('RECOVER')
    expect(resolveSetupMode('tujec@roksal.si', false)).toBeNull()
    expect(resolveSetupMode('tujec@roksal.si', true)).toBeNull()
    // pokvarjeno ožilje = kot da ni nastavljeno (ne razširi ničesar)
    process.env.ROKSAL_SETUP_EMAIL = 'ni-e-posta'
    expect(resolveSetupMode('a@x.si', true)).toBeNull()
    expect(resolveSetupMode('a@x.si', false)).toBe('BOOTSTRAP')
  })
})

describe('GET /api/setup', () => {
  it('brez žetona v okolju → { enabled: false }', async () => {
    delete process.env.ROKSAL_SETUP_TOKEN
    const route = await import('@/app/api/setup/route')
    const res = await route.GET()
    expect(res.status).toBe(200)
    const body = (await res.json()) as { enabled: boolean }
    expect(body.enabled).toBe(false)
  })

  it('z žetonom v okolju → { enabled: true }', async () => {
    process.env.ROKSAL_SETUP_TOKEN = 'test-dovolj-dolg-zeton-1'
    const route = await import('@/app/api/setup/route')
    const res = await route.GET()
    expect(res.status).toBe(200)
    const body = (await res.json()) as { enabled: boolean }
    expect(body.enabled).toBe(true)
  })
})

describe('POST /api/setup — fail-closed vrata', () => {
  it('izklopljena konzola → 404 (ruta se pretvarja, da ne obstaja)', async () => {
    delete process.env.ROKSAL_SETUP_TOKEN
    const route = await import('@/app/api/setup/route')
    const res = await route.POST(post({ email: nextEmail('x'), password: 'geslo12345' }, 'karkoli'))
    expect(res.status).toBe(404)
  })

  it('napačen žeton → 403 + SETUP_DENIED dnevnik z hashiranim IP (32 hex)', async () => {
    process.env.ROKSAL_SETUP_TOKEN = 'test-dovolj-dolg-zeton-2'
    const email = nextEmail('wrongtoken')
    const route = await import('@/app/api/setup/route')
    // Žeton BREZ ne-ASCII znakov (HTTP glave so ByteString).
    const res = await route.POST(post({ email, password: 'geslo12345', name: 'T Nekomu' }, 'popolnoma-napacen-zeton-xyz'))
    expect(res.status).toBe(403)

    const auditRow = await db.auditLog.findFirst({
      where: { akcija: 'SETUP_DENIED' },
      orderBy: { timestamp: 'desc' },
    })
    expect(auditRow).not.toBeNull()
    expect(auditRow?.userId).toBeNull()
    expect(auditRow?.ipAddress).toHaveLength(32)
    expect(auditRow?.newValue).toContain('neveljaven žeton')
  })

  it('pravi žeton + nevalidno telo → 400 (geslo prekratko)', async () => {
    process.env.ROKSAL_SETUP_TOKEN = 'test-dovolj-dolg-zeton-3'
    const route = await import('@/app/api/setup/route')
    const res = await route.POST(post({ email: nextEmail('short'), password: 'kratko' }, 'test-dovolj-dolg-zeton-3'))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/setup — BOOTSTRAP (nov ADMIN račun)', () => {
  it('ustvari ADMIN z geslom + SETUP_BOOTSTRAP dnevnik', async () => {
    const token = 'bootstrap-zeton-dovolj-dolg'
    process.env.ROKSAL_SETUP_TOKEN = token
    const email = nextEmail('bootstrap')
    const route = await import('@/app/api/setup/route')

    const res = await route.POST(post({ email, password: 'NovoGeslo123', name: 'Robert Pezdirc' }, token))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; mode: string; email: string }
    expect(body.mode).toBe('BOOTSTRAP')
    expect(body.email).toBe(email)

    const profile = await db.profile.findUnique({ where: { email } })
    expect(profile).not.toBeNull()
    expect(profile?.vloga).toBe('ADMIN')
    expect(profile?.mustChangePassword).toBe(false)
    expect(await verifyPassword('NovoGeslo123', profile?.passwordHash)).toBe(true)
    expect(await verifyPassword('napačno', profile?.passwordHash)).toBe(false)

    const auditRow = await db.auditLog.findFirst({
      where: { akcija: 'SETUP_BOOTSTRAP', userId: profile?.id },
      orderBy: { timestamp: 'desc' },
    })
    expect(auditRow).not.toBeNull()
    expect(auditRow?.newValue).toContain(email)
  })

  it('ožilje na drug e-naslov → 403 in NIČ ne nastane', async () => {
    process.env.ROKSAL_SETUP_TOKEN = 'bootstrap-zeton-dovolj-dolg2'
    process.env.ROKSAL_SETUP_EMAIL = 'lastnik-nujno@roksal.si'
    const email = nextEmail('scoped-away')
    const route = await import('@/app/api/setup/route')

    const res = await route.POST(post({ email, password: 'NovoGeslo123', name: 'N Kdo' }, 'bootstrap-zeton-dovolj-dolg2'))
    expect(res.status).toBe(403)
    expect(await db.profile.findUnique({ where: { email } })).toBeNull()
  })
})

describe('POST /api/setup — RECOVER (obnova lastnikovega računa)', () => {
  it('nastavi novo geslo, povzdigne ADMIN, revoke-a ŽIVO sejo (stari žeton takoj mrtev)', async () => {
    // Pozor: createTestUserWithSession uporabi 1. argument kot ID (e-pošta
    // postane "<id>@test.si") — za ožilje potrebujem ČIST e-naslov, zato
    // profil ustvarim direktno in žeton izdam prek createTestSessionToken.
    const { createTestSessionToken } = await import('./helpers/test-session')
    process.env.ROKSAL_SETUP_TOKEN = 'recover-zeton-dovolj-dolg1'
    const email = nextEmail('recover-victim')
    const profile = await db.profile.create({ data: { email, ime: 'N Victim', vloga: 'MONTER' } })
    const oldToken = await createTestSessionToken({
      id: profile.id,
      email: profile.email,
      ime: profile.ime,
      vloga: 'MONTER',
    })
    process.env.ROKSAL_SETUP_EMAIL = email

    const projectsRoute = await import('@/app/api/projects/route')
    const before = await projectsRoute.GET(new Request('http://localhost/api/projects', {
      headers: { authorization: `Bearer ${oldToken}` },
    }))
    expect(before.status).toBe(200) // žeton dela PRED obnovo

    const route = await import('@/app/api/setup/route')
    const res = await route.POST(
      post({ email, password: 'ObnovljenoGeslo9' }, 'recover-zeton-dovolj-dolg1'),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { mode: string; revokedSessions: number }
    expect(body.mode).toBe('RECOVER')
    expect(body.revokedSessions).toBeGreaterThanOrEqual(1)

    const updated = await db.profile.findUnique({ where: { email } })
    expect(updated?.vloga).toBe('ADMIN')
    expect(updated?.lockedAt).toBeNull()
    expect(await verifyPassword('ObnovljenoGeslo9', updated?.passwordHash)).toBe(true)

    // HARD requirement: stari žeton mrtev TAKOJ (revoke v registru sej)
    const after = await projectsRoute.GET(new Request('http://localhost/api/projects', {
      headers: { authorization: `Bearer ${oldToken}` },
    }))
    expect(after.status).toBe(401)

    const auditRow = await db.auditLog.findFirst({
      where: { akcija: 'SETUP_RECOVER', userId: profile.id },
      orderBy: { timestamp: 'desc' },
    })
    expect(auditRow).not.toBeNull()
    expect(auditRow?.oldValue).toContain('MONTER')
    expect(auditRow?.newValue).toContain('RECOVER')
  })

  it('obnova odpne deaktiviran IN zaklenjen račun (scenarij lastnika: "ne morem noter")', async () => {
    process.env.ROKSAL_SETUP_TOKEN = 'recover-zeton-dovolj-dolg3'
    const email = nextEmail('recover-blocked')
    const profile = await db.profile.create({
      data: {
        email,
        ime: 'N Blocked',
        vloga: 'VODJA',
        deactivatedAt: new Date(Date.now() - 1000),
        lockedAt: new Date(Date.now() - 500),
      },
    })
    process.env.ROKSAL_SETUP_EMAIL = email

    const route = await import('@/app/api/setup/route')
    const res = await route.POST(
      post({ email, password: 'OdblokiranoGeslo7' }, 'recover-zeton-dovolj-dolg3'),
    )
    expect(res.status).toBe(200)
    expect((await res.json()) as { mode: string }).toMatchObject({ mode: 'RECOVER' })

    const unblocked = await db.profile.findUnique({ where: { id: profile.id } })
    expect(unblocked?.vloga).toBe('ADMIN')
    expect(unblocked?.deactivatedAt).toBeNull()
    expect(unblocked?.lockedAt).toBeNull()
    expect(await verifyPassword('OdblokiranoGeslo7', unblocked?.passwordHash)).toBe(true)
  })

  it('obstoječ račun BREZ ožilja (samo žeton) → 403, geslo se NE spremeni', async () => {
    process.env.ROKSAL_SETUP_TOKEN = 'recover-zeton-dovolj-dolg2'
    delete process.env.ROKSAL_SETUP_EMAIL
    const email = nextEmail('recover-refused')
    const profile = await db.profile.create({
      data: { email, ime: 'N Refused', vloga: 'MONTER', passwordHash: 'scrypt$16384$8$1$YWJjZA==$YWJjZA==' },
    })
    const route = await import('@/app/api/setup/route')

    const res = await route.POST(post({ email, password: 'HekanoGeslo1' }, 'recover-zeton-dovolj-dolg2'))
    expect(res.status).toBe(403)

    const unchanged = await db.profile.findUnique({ where: { id: profile.id } })
    expect(unchanged?.vloga).toBe('MONTER')
    expect(unchanged?.passwordHash).toBe('scrypt$16384$8$1$YWJjZA==$YWJjZA==')
  })
})
