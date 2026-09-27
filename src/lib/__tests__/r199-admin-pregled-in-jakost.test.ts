// Roksal — testi R199: ADMIN pregled neuspešnih prijav (FAILED_LOGINS_OVERVIEW)
// + jakost gesla (gesloJakost) v 'Zamenjaj geslo' dialogu
// ---------------------------------------------------------------------------
// Realna baza (roksal_test prek globalSetup), prave rute:
//   • ADMIN prijava po neuspešnih poskusih ekipe → FAILED_LOGINS_OVERVIEW
//     vrstica (naslov, sporocilo 'N × napačno geslo po celotni ekipi (M
//     profilov)', entity = profile, QUEUED); NASTANE NAJVEČ ENA NA PRIJAVO;
//   • MONTER prijava → BREZ pregledne vrstice (vloga pregrata — deterministicno,
//     userId-obseg), lastna FAILED_LOGINS vrstica ostane (R197 regresija);
//   • čista prijava NE podvoji vrstic (≤ 1 na prijavo — vzporedni suite-i
//     delijo 24 h okno, zato globalnega 'nič' ne trdimo — lekcija r198);
//   • gesloJakost: čista funkcija — 0 (< 8), 1 šibko, 2 sprejemljivo, 3 močno;
//   • dialog source kontrakt: uvoz + aria-live + oznake + token družine.
// Brez AI, brez naključja (unikatni e-naslovi so izključno za izolacijo testov).

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { gesloJakost } from '@/lib/password-jakost'
import { NOTIFICATION_TEMPLATES } from '@/lib/notifications'
import { createTestUserWithSession } from './helpers/test-session'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

let uniqueCounter = 0
const nextEmail = (p: string) => `r199-${p}-${Date.now()}-${(uniqueCounter += 1)}@test.si`

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

async function ustvariProfil(ime: string, vloga: 'ADMIN' | 'MONTER', geslo: string) {
  const email = nextEmail(ime)
  return db.profile.create({
    data: { email, ime: `R199 ${ime}`, vloga, passwordHash: await hashPassword(geslo) },
  })
}

describe('R199 — ADMIN pregled neuspešnih prijav (FAILED_LOGINS_OVERVIEW v1)', () => {
  it('predloga FAILED_LOGINS_OVERVIEW je registrirana (verzija 1, fail-closed seznam)', () => {
    expect(NOTIFICATION_TEMPLATES.FAILED_LOGINS_OVERVIEW).toEqual({ version: 1 })
  })

  it('ADMIN prijava po ekipnih neuspehih → ENA pregledna vrstica s števcem in profilov', async () => {
    // trije ekipni neuspehi po DVEH profilih (določljivo spodnje meje: ≥ 3 × / ≥ 2 profilov)
    const admin = await ustvariProfil('admin-pregled', 'ADMIN', 'geslo-admin-r199')
    const zrtev1 = await ustvariProfil('zrtev-1', 'MONTER', 'geslo-zrtev-1')
    const zrtev2 = await ustvariProfil('zrtev-2', 'MONTER', 'geslo-zrtev-2')
    const zdaj = new Date()
    await db.auditLog.createMany({
      data: [
        { userId: zrtev1.id, akcija: 'LOGIN_FAILED', timestamp: zdaj, ipAddress: '127.0.0.1' },
        { userId: zrtev1.id, akcija: 'LOGIN_FAILED', timestamp: zdaj, ipAddress: '127.0.0.1' },
        { userId: zrtev2.id, akcija: 'LOGIN_FAILED', timestamp: zdaj, ipAddress: '127.0.0.2' },
      ],
    })

    const res = await prijava(admin.email, 'geslo-admin-r199')
    expect(res.status).toBe(200)

    const vrstice = await db.notification.findMany({
      where: { userId: admin.id, template: 'FAILED_LOGINS_OVERVIEW' },
    })
    expect(vrstice.length).toBe(1)
    const vrstica = vrstice[0]
    expect(vrstica.templateVersion).toBe(1)
    expect(vrstica.naslov).toBe('Pregled neuspešnih prijav (24 h)')
    expect(vrstica.sporocilo).toContain('× napačno geslo po celotni ekipi (')
    const m = vrstica.sporocilo!.match(/(\d+) × napačno geslo po celotni ekipi \((\d+) (profilu|profilov)\)/)
    expect(m).toBeTruthy()
    expect(Number(m![1])).toBeGreaterThanOrEqual(3) // vsaj naši trije (vzporedni suite-i lahko dodajo)
    expect(Number(m![2])).toBeGreaterThanOrEqual(2) // vsaj dva različna profila
    expect(vrstica.entityType).toBe('profile')
    expect(vrstica.entityId).toBe(admin.id)
    expect(vrstica.recipientRole).toBeNull()
    expect(vrstica.status).toBe('QUEUED')
    expect(vrstica.correlationId).toBeTruthy()
  })

  it('MONTER prijava → brez pregledne vrstice (vloga pregrata); lastna FAILED_LOGINS ostane (R197 regresija)', async () => {
    const monter = await ustvariProfil('monter-pregled', 'MONTER', 'geslo-monter-r199')
    const zdaj = new Date()
    await db.auditLog.createMany({
      data: [{ userId: monter.id, akcija: 'LOGIN_FAILED', timestamp: zdaj, ipAddress: '127.0.0.3' }],
    })

    const res = await prijava(monter.email, 'geslo-monter-r199')
    expect(res.status).toBe(200)

    const pregled = await db.notification.count({
      where: { userId: monter.id, template: 'FAILED_LOGINS_OVERVIEW' },
    })
    expect(pregled).toBe(0)
    // R197 lastna vrstica ostaja — pregled je DODATEK, ne zamenjava
    const lastna = await db.notification.findMany({
      where: { userId: monter.id, template: 'FAILED_LOGINS' },
    })
    expect(lastna.length).toBe(1)
    expect(lastna[0].sporocilo).toContain('1 × napačno geslo v zadnjih 24 urah')
  })

  it('ponovna ADMIN prijava NE podvoji pregledne vrstice (največ ena na prijavo)', async () => {
    const admin = await ustvariProfil('admin-ponovi', 'ADMIN', 'geslo-admin-ponovi')
    await db.auditLog.createMany({
      data: [
        { userId: admin.id, akcija: 'LOGIN_FAILED', timestamp: new Date(), ipAddress: '127.0.0.4' },
      ],
    })
    const prva = await prijava(admin.email, 'geslo-admin-ponovi')
    expect(prva.status).toBe(200)
    const poPrvi = await db.notification.count({
      where: { userId: admin.id, template: 'FAILED_LOGINS_OVERVIEW' },
    })
    expect(poPrvi).toBe(1)

    const druga = await prijava(admin.email, 'geslo-admin-ponovi')
    expect(druga.status).toBe(200)
    const poDrugi = await db.notification.count({
      where: { userId: admin.id, template: 'FAILED_LOGINS_OVERVIEW' },
    })
    // vsaka prijava doda NAJVEČ eno vrstico (ni kopičenja duplikatov na prijavo)
    expect(poDrugi).toBe(poPrvi + 1)
  })
})

describe('R199 — jakost gesla (gesloJakost, čista funkcija)', () => {
  it('ocena 0: krajše od 8 znakov — vrstica se ne prikaže (oznaka prazna)', () => {
    expect(gesloJakost('')).toEqual({ ocena: 0, oznaka: '' })
    expect(gesloJakost('abc123')).toEqual({ ocena: 0, oznaka: '' })
    expect(gesloJakost('Ab1!ab1')).toEqual({ ocena: 0, oznaka: '' }) // 7 znakov, vseeno
  })

  it('ocena 1 (Šibko): ≥ 8 znakov, 1–2 razreda, kratko', () => {
    expect(gesloJakost('aaaaaaaa')).toEqual({ ocena: 1, oznaka: 'Šibko' })
    expect(gesloJakost('abcdefgh12')).toEqual({ ocena: 1, oznaka: 'Šibko' }) // 2 razreda, 10 znakov
    expect(gesloJakost('abc123ab')).toEqual({ ocena: 1, oznaka: 'Šibko' })
  })

  it('ocena 2 (Sprejemljivo): 3 razredi; ALI 2 razreda + ≥ 12', () => {
    expect(gesloJakost('abc123ab!')).toEqual({ ocena: 2, oznaka: 'Sprejemljivo' }) // 3 razredi
    expect(gesloJakost('abcdefgh1234')).toEqual({ ocena: 2, oznaka: 'Sprejemljivo' }) // 2 razreda, 13
  })

  it('ocena 3 (Močno): 4 razredi; ALI 3 razredi + ≥ 14; ALI 2 razreda + ≥ 18', () => {
    expect(gesloJakost('Abc123!d')).toEqual({ ocena: 3, oznaka: 'Močno' }) // 4 razredi, kratko
    expect(gesloJakost('Abcdefgh1234!')).toEqual({ ocena: 3, oznaka: 'Močno' }) // 3 razredi + 14
    expect(gesloJakost('abcdefgh1234567890')).toEqual({ ocena: 3, oznaka: 'Močno' }) // gesfraza 19
  })
})

describe('R199 — dialog source kontrakt (jakost + token družine)', () => {
  it('dialog uvaža gesloJakost; lestvica aria-live; oznake Šibko/Sprejemljivo/Močno brez novih hex', () => {
    const src = srcOf('src/components/roksal/password-dialog.tsx')
    expect(src).toContain("import { gesloJakost } from '@/lib/password-jakost'")
    expect(src).toContain('aria-live="polite"')
    expect(src).toContain('bg-roksal-red')
    expect(src).toContain('bg-roksal-amber')
    expect(src).toContain('bg-green-500')
    // R227 — prazni segmenti jakostne vrstice na žetonu bg-muted (en razred
    // obe temi; prej bg-stone-200 dark:bg-stone-800 — trdo kodirana klasa).
    expect(src).toContain("'bg-muted'")
    // auth ruta: ADMIN pregrata + distinct + omejitev na eno vrstico na prijavo
    const ruta = srcOf('src/app/api/auth/route.ts')
    expect(ruta).toContain("template: 'FAILED_LOGINS_OVERVIEW'")
    expect(ruta).toContain("distinct: ['userId']")
    expect(ruta).toContain("profile.vloga === 'ADMIN'")
  })
})
