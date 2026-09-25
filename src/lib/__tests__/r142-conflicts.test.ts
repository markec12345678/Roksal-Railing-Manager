// R142 — integracijski testi (issue #5 §30 — Scheduler conflicts).
// ---------------------------------------------------------------------------
//   • overlaps(): poli-odprt interval [zacetka, konec) — nazaj-na-nazaj
//     (konec 16:00 / začetek 16:00) NI konflikt (IZRECNA sprememba vedenja
//     glede na prejšnjo zaprto preverbo — dokumentirano v lib + worklog).
//   • statusHoldsResource: NAVRTENO/V_TEKU/PRELOZENO zasedajo; PREKlicANO in
//     ZAKLJUCENO ne.
//   • findResourceConflicts: ekipa in monter sta NEODVISNA vira; monter
//     prekrivanje je ZDAJ ujeto (prej ni bilo preverjeno — luknja §30);
//     excludeId pri premiku ne dovoli termina, da prekrije samega sebe.
//   • POST /api/schedules: monter konflikt → 409 z ResourceConflict DTO;
//     nazaj-na-nazaj ekipa → 201 (nova semantika); neveljaven interval → 400.
//   • PATCH (premestitev): konflikt → 409, nič ni spremenjeno (rollback);
//     uspešen premik → 200 + nov interval + revizija SCHEDULE_RESCHEDULED
//     z oldValue/nnewValue; samo status (brez datuma) → starejša pogodba.
//
// Handlerji direktno, baza roksal_test prek globalSetup (vzorec R128–R141).
import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import { POST as schedulesPost, PATCH as schedulesPatch } from '@/app/api/schedules/route'
import { overlaps, statusHoldsResource, findResourceConflicts, conflictMessage } from '@/lib/schedule-conflicts'

const BASE = 'http://localhost/api'

function req(path: string, token: string | null, body?: unknown, method = 'GET'): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const T = (day: number, hour: number) => new Date(Date.UTC(2027, 2, day, hour, 0, 0))

/** Stranka + projekt (FK pogodba za schedule). */
async function makeProject(tag: string): Promise<string> {
  const customer = await db.customer.create({ data: { ime: `Stranka ${tag}`, naslov: 'Test 1' } })
  const project = await db.project.create({ data: { customerId: customer.id, nazivProjekta: `Projekt ${tag}` } })
  return project.id
}

async function makeCrew(tag: string): Promise<string> {
  const c = await db.crew.create({ data: { naziv: `Ekipa ${tag}`, barva: '#123456' } })
  return c.id
}

beforeEach(async () => {
  // Čistimo svoje teste po tagih (r142-*) — vsi unikatni z izolacijskim časom.
  await db.installationSchedule.deleteMany({ where: { project: { nazivProjekta: { contains: 'r142' } } } })
  await db.project.deleteMany({ where: { nazivProjekta: { contains: 'r142' } } })
  await db.customer.deleteMany({ where: { ime: { contains: 'r142' } } })
  await db.crew.deleteMany({ where: { naziv: { contains: 'r142' } } })
})

describe('overlaps — poli-odprt interval', () => {
  it('nazaj-na-nazaj (16:00 konec / 16:00 začetek) NI konflikt', () => {
    expect(overlaps(T(10, 8), T(10, 16), T(10, 16), T(11, 0))).toBe(false)
  })
  it('delno prekrivanje in vsebovanje sta konflikt', () => {
    expect(overlaps(T(10, 8), T(10, 17), T(10, 16), T(11, 0))).toBe(true)
    expect(overlaps(T(10, 8), T(10, 18), T(10, 9), T(10, 10))).toBe(true)
  })
  it('različni dnevi se ne prekrivajo', () => {
    expect(overlaps(T(10, 8), T(11, 0), T(11, 8), T(11, 16))).toBe(false)
  })
})

describe('statusHoldsResource', () => {
  it('aktivni statusi zasedajo, PREKlicANO/ZAKLJUCENO ne', () => {
    for (const s of ['NAVRTENO', 'V_TEKU', 'PRELOZENO']) expect(statusHoldsResource(s)).toBe(true)
    for (const s of ['PREKlicANO', 'ZAKLJUCENO']) expect(statusHoldsResource(s)).toBe(false)
  })
})

describe('findResourceConflicts — viri so neodvisni', () => {
  it('ekipa konflikt se ujame, monter brez prekrivanja ne moti', async () => {
    const stamp = `r142-lib-${Date.now()}`
    const crewId = await makeCrew(stamp)
    const projectId = await makeProject(stamp)
    await db.installationSchedule.create({
      data: { projectId, crewId, datumZacetka: T(10, 8), datumKonca: T(10, 16), status: 'NAVRTENO' },
    })
    const conflicts = await findResourceConflicts({ crewId, datumZacetka: T(10, 15), datumKonca: T(10, 18) })
    expect(conflicts.length).toBe(1)
    expect(conflicts[0]!.resource).toBe('ekipa')
    expect(conflicts[0]!.naziv).toBe(`Ekipa ${stamp}`)
    expect(conflicts[0]!.nazivProjekta).toContain('r142')
    const msg = conflictMessage(conflicts)
    expect(msg).toContain('Ekipa')
    expect(msg).toContain('ima že termin')
  })

  it('monter konflikt (prej nezaščiten) se ZDAJ ujame', async () => {
    const stamp = `r142-mon-${Date.now()}`
    const { user } = await createTestUserWithSession(`r142-monter-${Date.now()}`, 'MONTER')
    const projectId = await makeProject(stamp)
    await db.installationSchedule.create({
      data: { projectId, monterId: user.id, datumZacetka: T(12, 8), datumKonca: T(12, 16), status: 'NAVRTENO' },
    })
    const conflicts = await findResourceConflicts({ monterId: user.id, datumZacetka: T(12, 10), datumKonca: T(12, 20) })
    expect(conflicts.length).toBe(1)
    expect(conflicts[0]!.resource).toBe('monter')
  })

  it('PREKlicANO in ZAKLJUCENO ne blokirata, excludeId izključi samega sebe', async () => {
    const stamp = `r142-st-${Date.now()}`
    const crewId = await makeCrew(stamp)
    const projectId = await makeProject(stamp)
    await db.installationSchedule.create({
      data: { projectId, crewId, datumZacetka: T(14, 8), datumKonca: T(14, 16), status: 'PREKlicANO' },
    })
    expect(await findResourceConflicts({ crewId, datumZacetka: T(14, 8), datumKonca: T(14, 16) })).toHaveLength(0)
    const active = await db.installationSchedule.create({
      data: { projectId, crewId, datumZacetka: T(14, 8), datumKonca: T(14, 16), status: 'NAVRTENO' },
    })
    const withSelf = await findResourceConflicts({ crewId, datumZacetka: T(14, 9), datumKonca: T(14, 15) })
    expect(withSelf.length).toBe(1)
    const excluding = await findResourceConflicts({ crewId, datumZacetka: T(14, 9), datumKonca: T(14, 15), excludeId: active.id })
    expect(excluding).toHaveLength(0)
  })
})

describe('POST /api/schedules — §30 konflikti', () => {
  it('monter dvojna rezervacija → 409 z ResourceConflict DTO', async () => {
    const stamp = `r142-post-mon-${Date.now()}`
    const { user, token } = await createTestUserWithSession(`r142-pm-${Date.now()}`, 'VODJA')
    const projectId = await makeProject(stamp)
    await db.installationSchedule.create({
      data: { projectId, monterId: user.id, datumZacetka: T(20, 8), datumKonca: T(20, 12), status: 'NAVRTENO' },
    })
    const res = await schedulesPost(req('/api/schedules', token, {
      projectId, monterId: user.id, datumZacetka: T(20, 10).toISOString(), datumKonca: T(20, 14).toISOString(),
    }, 'POST'))
    expect(res.status).toBe(409)
    const data = (await res.json()) as { error: string; conflicts: { resource: string }[] }
    expect(data.conflicts[0]!.resource).toBe('monter')
    expect(data.error).toContain('Monter')
  })

  it('nazaj-na-nazaj ekipa → 201 (nova poli-odprta semantika)', async () => {
    const stamp = `r142-post-b2b-${Date.now()}`
    const { token } = await createTestUserWithSession(`r142-b2b-${Date.now()}`, 'VODJA')
    const projectId = await makeProject(stamp)
    const crewId = await makeCrew(stamp)
    await db.installationSchedule.create({
      data: { projectId, crewId, datumZacetka: T(21, 8), datumKonca: T(21, 16), status: 'NAVRTENO' },
    })
    const res = await schedulesPost(req('/api/schedules', token, {
      projectId, crewId, datumZacetka: T(21, 16).toISOString(), datumKonca: T(21, 20).toISOString(),
    }, 'POST'))
    expect(res.status).toBe(201)
  })

  it('neveljaven interval (konec ≤ začetek) → 400', async () => {
    const stamp = `r142-post-inv-${Date.now()}`
    const { token } = await createTestUserWithSession(`r142-inv-${Date.now()}`, 'VODJA')
    const projectId = await makeProject(stamp)
    const res = await schedulesPost(req('/api/schedules', token, {
      projectId, datumZacetka: T(22, 16).toISOString(), datumKonca: T(22, 8).toISOString(),
    }, 'POST'))
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/schedules — premestitev (§30)', () => {
  it('premik na zasedeno okno → 409, termin NI spremenjen', async () => {
    const stamp = `r142-patch-409-${Date.now()}`
    const { token } = await createTestUserWithSession(`r142-p409-${Date.now()}`, 'VODJA')
    const projectId = await makeProject(stamp)
    const crewId = await makeCrew(stamp)
    const blocker = await db.installationSchedule.create({
      data: { projectId, crewId, datumZacetka: T(24, 8), datumKonca: T(24, 12), status: 'NAVRTENO' },
    })
    const movable = await db.installationSchedule.create({
      data: { projectId, crewId, datumZacetka: T(23, 8), datumKonca: T(23, 12), status: 'NAVRTENO' },
    })
    const res = await schedulesPatch(req('/api/schedules', token, {
      id: movable.id, status: 'NAVRTENO',
      datumZacetka: T(24, 9).toISOString(), datumKonca: T(24, 15).toISOString(),
    }, 'PATCH'))
    expect(res.status).toBe(409)
    // Termin je ŠE VEDNO na starem datumu (rollback — ni delne spremembe).
    const after = await db.installationSchedule.findUnique({ where: { id: movable.id } })
    expect(after!.datumZacetka.getTime()).toBe(T(23, 8).getTime())
    expect(blocker.id).toBeTruthy()
  })

  it('uspešen premik → 200 + nov interval + revizija SCHEDULE_RESCHEDULED', async () => {
    const stamp = `r142-patch-ok-${Date.now()}`
    const { token, user } = await createTestUserWithSession(`r142-pok-${Date.now()}`, 'VODJA')
    const projectId = await makeProject(stamp)
    const movable = await db.installationSchedule.create({
      data: { projectId, datumZacetka: T(25, 8), datumKonca: T(25, 12), status: 'NAVRTENO' },
    })
    const res = await schedulesPatch(req('/api/schedules', token, {
      id: movable.id, status: 'NAVRTENO',
      datumZacetka: T(26, 8).toISOString(), datumKonca: T(26, 14).toISOString(),
    }, 'PATCH'))
    expect(res.status).toBe(200)
    const after = await db.installationSchedule.findUnique({ where: { id: movable.id } })
    expect(after!.datumZacetka.getTime()).toBe(T(26, 8).getTime())
    expect(after!.datumKonca.getTime()).toBe(T(26, 14).getTime())
    const audits = await db.auditLog.findMany({
      where: { projectId, akcija: 'SCHEDULE_RESCHEDULED' },
      orderBy: { timestamp: 'desc' },
      take: 1,
    })
    expect(audits.length).toBe(1)
    expect(audits[0]!.userId).toBe(user.id)
    const oldVal = JSON.parse(audits[0]!.oldValue ?? '{}') as { datumZacetka: string }
    expect(new Date(oldVal.datumZacetka).getTime()).toBe(T(25, 8).getTime())
  })

  it('samo status brez datuma → starejša pogodba (brez premika), neznani termin → 404 pri premiku', async () => {
    const stamp = `r142-patch-old-${Date.now()}`
    const { token } = await createTestUserWithSession(`r142-pold-${Date.now()}`, 'VODJA')
    const projectId = await makeProject(stamp)
    const s = await db.installationSchedule.create({
      data: { projectId, datumZacetka: T(27, 8), datumKonca: T(27, 12), status: 'NAVRTENO' },
    })
    const res = await schedulesPatch(req('/api/schedules', token, { id: s.id, status: 'PRELOZENO' }, 'PATCH'))
    expect(res.status).toBe(200)
    const after = await db.installationSchedule.findUnique({ where: { id: s.id } })
    expect(after!.status).toBe('PRELOZENO')
    expect(after!.datumZacetka.getTime()).toBe(T(27, 8).getTime())

    const unknown = await schedulesPatch(req('/api/schedules', token, {
      id: 'neznani-id', status: 'NAVRTENO', datumZacetka: T(28, 8).toISOString(), datumKonca: T(28, 12).toISOString(),
    }, 'PATCH'))
    expect(unknown.status).toBe(404)
  })
})
