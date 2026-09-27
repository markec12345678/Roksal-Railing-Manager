// Roksal — testi R197: aktivacijsko obvestilo + opozorilo o neuspešnih prijavah
// ---------------------------------------------------------------------------
// Realna baza (roksal_test prek globalSetup), prave rute:
//   • aktivacija povabljenega računa → ACCOUNT_ACTIVATED vrstica za
//     aktiviran profil (aktivacija ŠE ne ustvari seje — vrstica čaka v
//     zvončku ob prvi prijavi; entity = profile, korelacija iz zahtevka);
//   • neveljavna aktivacija → ISTA 400 in NOVA vrstica ne nastane;
//   • napačno geslo (LOGIN_FAILED audit) + uspešna prijava → FAILED_LOGINS
//     vrstica s števcem v sporocilu (industrijski standard — Google 'N
//     neuspešnih poskusov');
//   • čista prijava (brez predhodnih neuspešnih) → FAILED_LOGINS vrstica NE
//     nastane (brez šuma);
//   • predlogi sta registrirani (fail-closed seznam NOTIFICATION_TEMPLATES);
//   • zvonček razločuje varnostne vrstice (ščit + jantarna barva).
// Brez AI, brez naključja (unikatni e-naslovi so izključno za izolacijo testov).

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { NOTIFICATION_TEMPLATES } from '@/lib/notifications'
import { createTestUserWithSession } from './helpers/test-session'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

let uniqueCounter = 0
const nextEmail = (p: string) => `r197-${p}-${Date.now()}-${(uniqueCounter += 1)}@test.si`

async function prijava(email: string, geslo: string) {
  const route = await import('@/app/api/auth/route')
  return route.POST(
    new Request('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: geslo }),
    }),
  )
}

describe('R197 — aktivacijsko obvestilo + opozorilo o neuspešnih prijavah', () => {
  it('predlogi ACCOUNT_ACTIVATED in FAILED_LOGINS sta registrirani (verzija 1, fail-closed seznam)', () => {
    expect(NOTIFICATION_TEMPLATES.ACCOUNT_ACTIVATED).toEqual({ version: 1 })
    expect(NOTIFICATION_TEMPLATES.FAILED_LOGINS).toEqual({ version: 1 })
  })

  it('aktivacija povabljenega računa ustvari ACCOUNT_ACTIVATED vrstico za aktiviran profil (entity = profile)', async () => {
    const { token: adminToken } = await createTestUserWithSession(nextEmail('adm'), 'ADMIN')
    const usersRoute = await import('@/app/api/users/route')
    const activateRoute = await import('@/app/api/users/activate/route')
    const email = nextEmail('act')

    const invite = await usersRoute.POST(
      new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}`, origin: 'http://localhost' },
        body: JSON.stringify({ action: 'invite', email, ime: 'R197 Aktiviran', vloga: 'MONTER' }),
      }),
    )
    expect(invite.status).toBe(200)
    const { activationPath } = (await invite.json()) as { activationPath: string }
    const token = activationPath.split('/').pop()!

    const ok = await activateRoute.POST(
      new Request('http://localhost/api/users/activate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost' },
        body: JSON.stringify({ token, password: 'MojeNovoGeslo1' }),
      }),
    )
    expect(ok.status).toBe(200)

    const profile = await db.profile.findUniqueOrThrow({ where: { email } })
    const vrstice = await db.notification.findMany({
      where: { userId: profile.id, template: 'ACCOUNT_ACTIVATED' },
    })
    expect(vrstice.length).toBe(1)
    const vrstica = vrstice[0]
    expect(vrstica.templateVersion).toBe(1)
    expect(vrstica.naslov).toBe('Vaš račun je aktiviran')
    expect(vrstica.sporocilo).toContain('Prijava je zdaj možna z vašim geslom')
    expect(vrstica.entityType).toBe('profile')
    expect(vrstica.entityId).toBe(profile.id)
    expect(vrstica.recipientRole).toBeNull()
    expect(vrstica.status).toBe('QUEUED')

    // neveljaven žeton → ISTA 400 in brez nove vrstice (enumeration protection)
    const predNeveljavno = await db.notification.count({ where: { template: 'ACCOUNT_ACTIVATED' } })
    const bad = await activateRoute.POST(
      new Request('http://localhost/api/users/activate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost' },
        body: JSON.stringify({ token: 'neznan-zeton-r197-aktivacija', password: 'MojeNovoGeslo1' }),
      }),
    )
    expect(bad.status).toBe(400)
    const poNeveljavni = await db.notification.count({ where: { template: 'ACCOUNT_ACTIVATED' } })
    expect(poNeveljavni).toBe(predNeveljavno)
  })

  it('napačno geslo + uspešna prijava → FAILED_LOGINS vrstica s števcem; čista prijava → brez vrstice', async () => {
    // profil A: najprej napačno geslo (LOGIN_FAILED audit), nato uspešna prijava
    const emailA = nextEmail('fail')
    const gesloA = 'geslo-test-r197'
    await db.profile.create({
      data: { email: emailA, ime: 'R197 Neuspešne', vloga: 'MONTER', passwordHash: await hashPassword(gesloA) },
    })

    const slaba = await prijava(emailA, 'napacno-geslo-r197')
    expect(slaba.status).toBe(401)
    const dobra = await prijava(emailA, gesloA)
    expect(dobra.status).toBe(200)
    const profilA = (await dobra.json()) as { user: { id: string } }

    const vrstice = await db.notification.findMany({
      where: { userId: profilA.user.id, template: 'FAILED_LOGINS' },
    })
    expect(vrstice.length).toBe(1)
    expect(vrstice[0].naslov).toBe('Neuspešni poskusi prijave pred to prijavo')
    expect(vrstice[0].sporocilo).toContain('1 × napačno geslo v zadnjih 24 urah')
    expect(vrstice[0].entityType).toBe('profile')
    expect(vrstice[0].entityId).toBe(profilA.user.id)
    expect(vrstice[0].status).toBe('QUEUED')
    // uspešna prijava je tudi sicer ustvarila NEW_LOGIN (R196 regresija)
    const novaPrijava = await db.notification.count({
      where: { userId: profilA.user.id, template: 'NEW_LOGIN' },
    })
    expect(novaPrijava).toBe(1)

    // profil B: čista prijava (brez predhodnih neuspešnih) → brez FAILED_LOGINS
    const emailB = nextEmail('cista')
    const gesloB = 'geslo-test-r197'
    await db.profile.create({
      data: { email: emailB, ime: 'R197 Čista', vloga: 'MONTER', passwordHash: await hashPassword(gesloB) },
    })
    const cista = await prijava(emailB, gesloB)
    expect(cista.status).toBe(200)
    const profilB = (await cista.json()) as { user: { id: string } }
    const brezVrstic = await db.notification.count({
      where: { userId: profilB.user.id, template: 'FAILED_LOGINS' },
    })
    expect(brezVrstic).toBe(0)
  })

  it('zvonček razločuje varnostne vrstice: ščit + jantarna barva za NEW_LOGIN/FAILED_LOGINS/ACCOUNT_ACTIVATED', () => {
    const src = srcOf('src/components/roksal/notification-center.tsx')
    // en vir resnice: množica varnostnih predlog + ščit ikona + jantarna površina
    // R198: PASSWORD_CHANGED se pridruži ščitovim predlogam (isti stil, novi dogodek)
    expect(src).toContain("new Set(['NEW_LOGIN', 'FAILED_LOGINS', 'ACCOUNT_ACTIVATED', 'PASSWORD_CHANGED'])")
    expect(src).toContain('VARNOSTNE_PREDLOGE.has(n.template)')
    expect(src).toContain('<ShieldCheck className="h-4 w-4 text-roksal-amber" aria-hidden="true" />')
    expect(src).toContain("varnostna ? 'bg-roksal-amber/10' : 'bg-roksal-navy/5'")
  })
})
