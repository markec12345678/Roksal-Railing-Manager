// R393 — /api/engineering-rules + /api/calculator §15 ŽIG (issue #13 R171).
// ---------------------------------------------------------------------------
//   • GET seznam: vsa semena pravil + skladnostni povzetek (0 uradno
//     preverjenih — odkrito) + opozorilo ločitve na vsakem odgovoru;
//   • filtri EXACT: kategorija/vir/aplikacija (400 za neznan nabor),
//     productSifra (404 za neobstoječi; EXACT šifra);
//   • GET detajl: po id IN po EXACT šifri + zgodovina verzij; 404;
//   • /api/calculator: GET register formul + POST izračun — VSAK uspešen
//     odgovor nosi razred 'INFORMATIVNO' + opozorilo (§15 LOČITEV, R393);
//   • RBAC: anon → 401; MONTER bere (honest kontekst terena).
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import * as engineeringRulesRoute from '@/app/api/engineering-rules/route'
import * as engineeringRulesDetailRoute from '@/app/api/engineering-rules/[id]/route'
import * as calculatorRoute from '@/app/api/calculator/route'

const BASE = 'http://localhost'
let counter = 0
const uniq = (p: string) => `${p}-${Date.now()}-${(counter += 1)}`

function req(path: string, token: string, method: 'GET' | 'POST', body?: Record<string, unknown>): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, origin: BASE },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

describe('R393 — /api/engineering-rules (§15 seznam + skladnost)', () => {
  let token: string
  const users: Array<{ id: string }> = []

  beforeEach(async () => {
    const u = await createTestUserWithSession(uniq('r393vodja'), 'VODJA')
    token = u.token
    users.push({ id: u.user.id })
  })

  afterEach(async () => {
    for (const u of users.splice(0)) {
      await db.auditLog.deleteMany({ where: { userId: u.id } })
      await db.profile.delete({ where: { id: u.id } }).catch(() => undefined)
    }
  })

  it('GET seznam: 37 pravil + skladnost 37/0/37 + opozorilo (NIČ uradno)', async () => {
    const res = await engineeringRulesRoute.GET(req('/api/engineering-rules', token, 'GET'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    const pravila = body.pravila as Array<Record<string, unknown>>
    expect(pravila).toHaveLength(37)
    const skladnost = body.skladnost as Record<string, number | string>
    expect(skladnost.stevilo).toBe(37)
    expect(skladnost.uradnoPreverjenih).toBe(0)
    expect(skladnost.informativnih).toBe(37)
    expect(body.opozorilo).toContain('NE nadomešča')
    // §15 ločitev na VSAKI vrstici:
    for (const p of pravila) {
      expect(p.razred).toBe('INFORMATIVNO')
      expect(p.jeUradnoPreverjeno).toBe(false)
      expect(p.reviewedAt).toBeNull()
      expect(p.reviewerId).toBeNull()
    }
  })

  it('GET seznam nosi VSA §15 polja odkrito (rule id/source/standard/jurisdiction/calculator)', async () => {
    const res = await engineeringRulesRoute.GET(req('/api/engineering-rules', token, 'GET'))
    const body = (await res.json()) as Record<string, unknown>
    const vse = body.pravila as Array<Record<string, unknown>>
    for (const p of vse) {
      expect(typeof p.sifra).toBe('string')
      expect(typeof p.vir).toBe('string')
      expect('standardReferenca' in p).toBe(true)
      expect('standardVerzija' in p).toBe(true)
      expect('jurisdikcija' in p).toBe(true)
      expect('calculatorVerzija' in p).toBe(true)
      expect('veljavnostOd' in p).toBe(true)
      expect(typeof p.vsebina).toBe('string')
    }
  })

  it('GET ?kategorija=OBREMENITEV — SAMO 2 (obremenitev + veter); ?vir=SEKUNDARNI_VIR — 1', async () => {
    const resK = await engineeringRulesRoute.GET(
      req('/api/engineering-rules?kategorija=OBREMENITEV', token, 'GET'),
    )
    expect(resK.status).toBe(200)
    const bodyK = (await resK.json()) as Record<string, unknown>
    const sifreK = (bodyK.pravila as Array<Record<string, string>>).map((p) => p.sifra)
    expect(sifreK).toContain('OBREMENITEV-HORIZONTALNA-KNM')
    expect(sifreK).toContain('VETER-SIST-1991-1-4')
    expect(sifreK).toHaveLength(2)

    const resV = await engineeringRulesRoute.GET(
      req('/api/engineering-rules?vir=SEKUNDARNI_VIR', token, 'GET'),
    )
    const bodyV = (await resV.json()) as Record<string, unknown>
    expect((bodyV.pravila as unknown[]).map((p) => (p as Record<string, string>).sifra)).toEqual([
      'MATERIAL-WPC-ODTENNEK',
    ])
  })

  it('GET ?kategorija=NEVELJAVNA → 400 s seznamom nabora (fail-closed)', async () => {
    const res = await engineeringRulesRoute.GET(
      req('/api/engineering-rules?kategorija=NEVELJAVNA', token, 'GET'),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as Record<string, string>
    expect(body.error).toContain('MONTAZA')
    expect(body.error).toContain('GEOMETRIJA')
  })

  it('GET ?productSifra=woodcore-kubo-80-42 — SAMO podkonstrukcija + gap (2); bogus → 404', async () => {
    const res = await engineeringRulesRoute.GET(
      req('/api/engineering-rules?productSifra=woodcore-kubo-80-42', token, 'GET'),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    const sifre = (body.pravila as Array<Record<string, string>>).map((p) => p.sifra)
    expect(sifre).toHaveLength(2)
    expect(sifre).toContain('RAZMAK-PODCEVI-V-woodcore-kubo-80-42')
    expect(sifre).toContain('RAZMAK-PODDESKAMI-woodcore-kubo-80-42')
    // odkrita odsotnost razmaka stebrov:
    expect(sifre).not.toContain('RAZMAK-PODSTEBRI-V-woodcore-kubo-80-42')

    const res404 = await engineeringRulesRoute.GET(
      req('/api/engineering-rules?productSifra=neobstojec-profil', token, 'GET'),
    )
    expect(res404.status).toBe(404)
  })

  it('GET ?aplikacija=FASADA — 0 (seed pravila so splošna — honest prazna množica)', async () => {
    const res = await engineeringRulesRoute.GET(
      req('/api/engineering-rules?aplikacija=FASADA', token, 'GET'),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.pravila).toHaveLength(0)
    expect((body.skladnost as Record<string, number>).stevilo).toBe(0)
  })

  it('GET detajl po EXACT šifri: zgodovina 1 verzije + provenanca kalkulatorja', async () => {
    const res = await engineeringRulesDetailRoute.GET(
      req('/api/engineering-rules/RAZMIK-ODPRINE-110', token, 'GET'),
      { params: Promise.resolve({ id: 'RAZMIK-ODPRINE-110' }) },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    const pravilo = body.pravilo as Record<string, unknown>
    expect(pravilo.sifra).toBe('RAZMIK-ODPRINE-110')
    expect(pravilo.standardReferenca).toBe('SIST EN 1264')
    expect(pravilo.vir).toBe('INTERNI_INZENIRING')
    expect(body.aktivnaVerzijaObDatumu).toBe(1)
    expect(body.zgodovina as unknown[]).toHaveLength(1)
    expect(body.opozorilo).toContain('NE nadomešča')
  })

  it('GET detajl po id (cuid pot) + 404 za neznano šifro/id', async () => {
    const seznam = await engineeringRulesRoute.GET(req('/api/engineering-rules', token, 'GET'))
    const telo = (await seznam.json()) as Record<string, unknown>
    const prvi = (telo.pravila as Array<Record<string, string>>)[0]
    const res = await engineeringRulesDetailRoute.GET(
      req(`/api/engineering-rules/${prvi.id}`, token, 'GET'),
      { params: Promise.resolve({ id: prvi.id }) },
    )
    expect(res.status).toBe(200)

    const res404 = await engineeringRulesDetailRoute.GET(
      req('/api/engineering-rules/NEZNANO-PRAVILO', token, 'GET'),
      { params: Promise.resolve({ id: 'NEZNANO-PRAVILO' }) },
    )
    expect(res404.status).toBe(404)
  })

  it('anon brez žetona → 401 (fail-closed prag)', async () => {
    const res = await engineeringRulesRoute.GET(req('/api/engineering-rules', 'ni-zeton', 'GET'))
    expect(res.status).toBe(401)
  })

  it('MONTER bere seznam (honest kontekst terena — enak prag kot /api/catalog)', async () => {
    const monter = await createTestUserWithSession(uniq('r393monter'), 'MONTER')
    users.push({ id: monter.user.id })
    const res = await engineeringRulesRoute.GET(req('/api/engineering-rules', monter.token, 'GET'))
    expect(res.status).toBe(200)
  })
})

describe('R393 — /api/calculator §15 ŽIG (ločitev informativnega izračuna)', () => {
  let token: string
  const users: Array<{ id: string }> = []

  beforeEach(async () => {
    const u = await createTestUserWithSession(uniq('r393calc'), 'MONTER')
    token = u.token
    users.push({ id: u.user.id })
  })

  afterEach(async () => {
    for (const u of users.splice(0)) {
      await db.auditLog.deleteMany({ where: { userId: u.id } })
      await db.profile.delete({ where: { id: u.id } }).catch(() => undefined)
    }
  })

  it('GET register formul: razred INFORMATIVNO + opozorilo ENega vira', async () => {
    const res = await calculatorRoute.GET(req('/api/calculator', token, 'GET'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.razred).toBe('INFORMATIVNO')
    expect(body.opozorilo).toContain('NE nadomešča')
    expect(body.opozorilo).toContain('projektantskega')
  })

  it('POST railing izračun: rezultat NESPREMENJEN + razred INFORMATIVNO odkrito', async () => {
    const res = await calculatorRoute.POST(req('/api/calculator', token, 'POST', {
      type: 'railing',
      totalLengthMm: 3000,
      slatWidthMm: 60,
      maxGapMm: 110,
      profileType: 'classic',
    }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    // §1 determinizem temeljev NESPREMENJEN (R150 pogodba ostaja):
    expect(body.formulaVersion).toBe('rail-v1')
    expect(typeof body.inputHash).toBe('string')
    expect(typeof body.slatCount).toBe('number')
    expect(typeof body.actualGapMm).toBe('number')
    // §15 ločitev — DODATNA polja:
    expect(body.razred).toBe('INFORMATIVNO')
    expect(body.opozorilo).toContain('statičnega preverjanja')
  })

  it('POST veter izračun: enak žig (konsistentnost prek vseh treh tipov)', async () => {
    const res = await calculatorRoute.POST(req('/api/calculator', token, 'POST', {
      type: 'wind',
      heightAboveGround: 10,
      terrainCategory: 'II',
      windSpeedMs: 25,
      railingAreaM2: 8,
      railingType: 'slatted',
    }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.formulaVersion).toBe('wind-v1')
    expect(body.razred).toBe('INFORMATIVNO')
  })
})
