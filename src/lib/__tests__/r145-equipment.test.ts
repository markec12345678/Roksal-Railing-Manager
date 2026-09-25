// R145 — integracijski testi (issue #5 §31 — Equipment lifecycle).
// ---------------------------------------------------------------------------
//   • Transicijska matrika: legalne/nelegalne tranzicije, UPOKOJENO je
//     TERMINALNO (prazna lista — upokojena oprema se ne vrne v uporabo),
//     neznani status → prazna dovoljena lista (fail-closed).
//   • Kalibracija: POTEČENA (rok < now), manjka potrdilo/rok (NEZNANO —
//     iskreno stanje, ne izmišljen datum), nemerska oprema → vedno false.
//   • Pregledi: interval + last → naslednji rok; brez lasta = NEZNANO.
//   • PATCH /api/equipment: nelegalna tranzicija → 409 z dovoljenimi cilji,
//     legalna → 200 + revizija EQUIPMENT_STATUS, UPOKOJENO → terminalni 409.
//   • POST /api/equipment/events: kalibracija merske opreme BREZ potrdila →
//     400 (fail-closed); s potrdilom → 201 + posodobljen rok; PREGLED →
//     lastInspectionAt; performedAt v prihodnosti → 400; NAPAKA rezultat NE
//     posodablja polj; nemerska oprema + KALIBRACIJA → 400.
//   • Dodelitev opreme (R142 obljuba): POST /api/schedules z equipmentIds →
//     201 + assignment vrstice; prekrivanje → 409 z razlogom "oprema";
//     nazaj-na-nazaj → 201 (poli-odprto); neznana/UPOKOJENA oprema → 400.
//   • PATCH premik: intervale assignmentov SINHRONIZIRA s terminom.
//   • Pravice: anon → 401, MONTER PATCH → 403 (production.manage).
//
// Handlerji direktno, baza roksal_test prek globalSetup (vzorec R128–R144).
import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import { POST as schedulesPost, PATCH as schedulesPatch, GET as schedulesGet } from '@/app/api/schedules/route'
import { GET as equipmentGet, PATCH as equipmentPatch } from '@/app/api/equipment/route'
import { POST as eventsPost, GET as eventsGet } from '@/app/api/equipment/events/route'
import {
  checkTransition,
  allowedTransitions,
  isCalibrationOverdue,
  isCalibrationMissing,
  isInspectionDue,
  isInspectionUnknown,
  nextInspectionAt,
  eventUpdatesField,
} from '@/lib/equipment-lifecycle'
import { findEquipmentConflicts, conflictMessage } from '@/lib/schedule-conflicts'

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

const T = (day: number, hour: number) => new Date(Date.UTC(2027, 5, day, hour, 0, 0))

/** Stranka + projekt (FK pogodba za schedule). */
async function makeProject(tag: string): Promise<string> {
  const customer = await db.customer.create({ data: { ime: `Stranka ${tag}`, naslov: 'Test 1' } })
  const project = await db.project.create({ data: { customerId: customer.id, nazivProjekta: `Projekt ${tag}` } })
  return project.id
}

async function makeEquipment(tag: string, extra?: { tip?: string; status?: string; calibrationRequired?: boolean }): Promise<string> {
  const e = await db.equipment.create({
    data: {
      naziv: `Oprema ${tag}`,
      tip: extra?.tip ?? 'ROCNO_ORODJE',
      ...(extra?.status ? { status: extra.status } : {}),
      ...(extra?.calibrationRequired !== undefined ? { calibrationRequired: extra.calibrationRequired } : {}),
    },
  })
  return e.id
}

beforeEach(async () => {
  // Čistimo svoje teste po tagih (r145-*) — unikatni nazivi/e-pošte.
  await db.equipmentEvent.deleteMany({ where: { equipment: { naziv: { contains: 'r145' } } } })
  await db.equipmentAssignment.deleteMany({ where: { equipment: { naziv: { contains: 'r145' } } } })
  await db.installationSchedule.deleteMany({ where: { project: { nazivProjekta: { contains: 'r145' } } } })
  await db.equipment.deleteMany({ where: { naziv: { contains: 'r145' } } })
  await db.project.deleteMany({ where: { nazivProjekta: { contains: 'r145' } } })
  await db.customer.deleteMany({ where: { ime: { contains: 'r145' } } })
})

// ---------------------------------------------------------------------------
// Čisto jedro (determinizem)
// ---------------------------------------------------------------------------

describe('transicije statusov (§31 matrika)', () => {
  it('legalne tranzicije so dovoljene', () => {
    expect(checkTransition('NA_VOLJO', 'V_UPORABI').ok).toBe(true)
    expect(checkTransition('V_UPORABI', 'V_SERVISU').ok).toBe(true)
    expect(checkTransition('V_SERVISU', 'NA_VOLJO').ok).toBe(true)
    expect(checkTransition('IZGUBLJENO', 'NA_VOLJO').ok).toBe(true) // najdena
    expect(checkTransition('NA_VOLJO', 'UPOKOJENO').ok).toBe(true)
  })

  it('nelegalne tranzicije so zavrnjene z dovoljenimi cilji', () => {
    const v = checkTransition('IZGUBLJENO', 'V_UPORABI')
    expect(v.ok).toBe(false)
    expect(v.allowed).toEqual(['NA_VOLJO', 'UPOKOJENO'])
    expect(checkTransition('NA_VOLJO', 'NEZNANO').ok).toBe(false)
  })

  it('UPOKOJENO je TERMINALNO (prazna lista)', () => {
    expect(allowedTransitions('UPOKOJENO')).toEqual([])
    expect(checkTransition('UPOKOJENO', 'NA_VOLJO').ok).toBe(false)
    expect(checkTransition('UPOKOJENO', 'V_SERVISU').ok).toBe(false)
  })

  it('neznani status → prazna lista (fail-closed)', () => {
    expect(allowedTransitions('ČUDEN')).toEqual([])
  })
})

describe('kalibracija (deterministično)', () => {
  const NOW = T(15, 12)

  it('rok v preteklosti → POTEČENA (merska)', () => {
    expect(isCalibrationOverdue({ calibrationRequired: true, calibrationDueDate: T(15, 0) }, NOW)).toBe(true)
  })
  it('rok v prihodnosti → ni potečena', () => {
    expect(isCalibrationOverdue({ calibrationRequired: true, calibrationDueDate: T(15, 23) }, NOW)).toBe(false)
  })
  it('nemerska oprema je VEDNO brez kalibracijskih zastavic', () => {
    const e = { calibrationRequired: false, calibrationDueDate: T(1, 0) }
    expect(isCalibrationOverdue(e, NOW)).toBe(false)
    expect(isCalibrationMissing(e)).toBe(false)
  })
  it('merska brez roka → manjka potrdilo (iskreno NEZNANO)', () => {
    expect(isCalibrationMissing({ calibrationRequired: true, calibrationDueDate: null })).toBe(true)
  })
})

describe('pregledi (deterministično)', () => {
  const NOW = T(15, 12)

  it('last + interval < now → zadelju', () => {
    const e = { lastInspectionAt: T(1, 0), inspectionIntervalDays: 10 }
    expect(isInspectionDue(e, NOW)).toBe(true)
    expect(nextInspectionAt(e)).toEqual(T(11, 0))
  })
  it('rok v prihodnosti → ni zadelju', () => {
    expect(isInspectionDue({ lastInspectionAt: T(10, 0), inspectionIntervalDays: 10 }, NOW)).toBe(false)
  })
  it('interval brez lasta → NEZNANO (brez izmišljevanja)', () => {
    expect(isInspectionUnknown({ lastInspectionAt: null, inspectionIntervalDays: 30 })).toBe(true)
    expect(isInspectionDue({ lastInspectionAt: null, inspectionIntervalDays: 30 }, NOW)).toBe(false)
    expect(nextInspectionAt({ lastInspectionAt: null, inspectionIntervalDays: 30 })).toBeNull()
  })
})

describe('eventUpdatesField — deterministična trasa', () => {
  it('PREGLED→lastInspectionAt, KALIBRACIJA→calibration, SERVIS/POPRAVILO→zadnjiServis', () => {
    expect(eventUpdatesField('PREGLED')).toBe('lastInspectionAt')
    expect(eventUpdatesField('KALIBRACIJA')).toBe('calibration')
    expect(eventUpdatesField('SERVIS')).toBe('zadnjiServis')
    expect(eventUpdatesField('POPRAVILO')).toBe('zadnjiServis')
  })
})

// ---------------------------------------------------------------------------
// API — /api/equipment (GET/PATCH)
// ---------------------------------------------------------------------------

describe('GET /api/equipment', () => {
  it('anon → 401', async () => {
    const res = await equipmentGet(req('/api/equipment', null))
    expect(res.status).toBe(401)
  })

  it('MONTER bere (življenjski DTO z zastavicami)', async () => {
    const stamp = `r145-get-${Date.now()}`
    const { token } = await createTestUserWithSession(`r145-get-${Date.now()}`, 'MONTER')
    await makeEquipment(stamp, { tip: 'MERSKA_OPREMA', calibrationRequired: true })
    const res = await equipmentGet(req('/api/equipment', token))
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<Record<string, unknown>>
    const mine = rows.find((r) => r.naziv === `Oprema ${stamp}`)
    expect(mine).toBeDefined()
    expect(mine!.calibrationRequired).toBe(true) // backfill/implicitna pogodba
    expect(mine!.calibrationMissing).toBe(true) // brez roka = iskreno NEZNANO
    expect(mine!.calibrationOverdue).toBe(false)
  })
})

describe('PATCH /api/equipment — statusne tranzicije', () => {
  it('MONTER ne sme (production.manage) → 403', async () => {
    const stamp = `r145-pmon-${Date.now()}`
    const id = await makeEquipment(stamp)
    const { token } = await createTestUserWithSession(`r145-pmon-${Date.now()}`, 'MONTER')
    const res = await equipmentPatch(req('/api/equipment', token, { id, status: 'V_SERVISU' }, 'PATCH'))
    expect(res.status).toBe(403)
  })

  it('nelegalna tranzicija → 409 z dovoljenimi cilji, nič spremenjeno', async () => {
    const stamp = `r145-il-${Date.now()}`
    const id = await makeEquipment(stamp, { status: 'IZGUBLJENO' })
    const { token } = await createTestUserWithSession(`r145-il-${Date.now()}`, 'VODJA')
    const res = await equipmentPatch(req('/api/equipment', token, { id, status: 'V_UPORABI' }, 'PATCH'))
    expect(res.status).toBe(409) // IZGUBLJENO → V_UPORABI ni dovoljeno
    const body = (await res.json()) as { allowed: string[] }
    expect(body.allowed).toEqual(['NA_VOLJO', 'UPOKOJENO'])
    expect((await db.equipment.findUnique({ where: { id } }))!.status).toBe('IZGUBLJENO')
  })

  it('legalna tranzicija → 200 + revizija EQUIPMENT_STATUS z oldValue', async () => {
    const stamp = `r145-ok-${Date.now()}`
    const id = await makeEquipment(stamp)
    const { token, user } = await createTestUserWithSession(`r145-ok-${Date.now()}`, 'VODJA')
    const res = await equipmentPatch(req('/api/equipment', token, { id, status: 'V_SERVISU' }, 'PATCH'))
    expect(res.status).toBe(200)
    const row = (await res.json()) as { status: string }
    expect(row.status).toBe('V_SERVISU')
    const auditRow = await db.auditLog.findFirst({ where: { akcija: 'EQUIPMENT_STATUS', newValue: { contains: id }, userId: user.id } })
    expect(auditRow).not.toBeNull()
    expect(auditRow!.oldValue).toContain('NA_VOLJO')
  })

  it('UPOKOJENO je terminalno tudi prek API-ja → 409', async () => {
    const stamp = `r145-term-${Date.now()}`
    const id = await makeEquipment(stamp, { status: 'UPOKOJENO' })
    const { token } = await createTestUserWithSession(`r145-term-${Date.now()}`, 'ADMIN')
    const res = await equipmentPatch(req('/api/equipment', token, { id, status: 'NA_VOLJO' }, 'PATCH'))
    expect(res.status).toBe(409)
    expect((await res.json()) as { error: string }).toBeTruthy()
  })

  it('neveljaven interval → 400 (fail-closed)', async () => {
    const stamp = `r145-bad-${Date.now()}`
    const id = await makeEquipment(stamp)
    const { token } = await createTestUserWithSession(`r145-bad-${Date.now()}`, 'VODJA')
    const res = await equipmentPatch(req('/api/equipment', token, { id, inspectionIntervalDays: -5 }, 'PATCH'))
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// API — /api/equipment/events (POST/GET)
// ---------------------------------------------------------------------------

describe('POST /api/equipment/events — fail-closed pogodbe', () => {
  it('anon → 401', async () => {
    const stamp = `r145-ev-anon-${Date.now()}`
    const id = await makeEquipment(stamp)
    const res = await eventsPost(req('/api/equipment/events', null, { equipmentId: id, type: 'PREGLED' }, 'POST'))
    expect(res.status).toBe(401)
  })

  it('kalibracija merske opreme brez potrdila → 400 (nič posodobljeno)', async () => {
    const stamp = `r145-ev-nocert-${Date.now()}`
    const id = await makeEquipment(stamp, { tip: 'MERSKA_OPREMA', calibrationRequired: true })
    const { token } = await createTestUserWithSession(`r145-ev-${Date.now()}`, 'VODJA')
    const res = await eventsPost(req('/api/equipment/events', token, { equipmentId: id, type: 'KALIBRACIJA' }, 'POST'))
    expect(res.status).toBe(400)
    const fresh = await db.equipment.findUnique({ where: { id } })
    expect(fresh!.calibrationCertificate).toBeNull()
    expect(await db.equipmentEvent.count({ where: { equipmentId: id } })).toBe(0)
  })

  it('kalibracija s potrdilom → 201 + rok + revizija EQUIPMENT_EVENT', async () => {
    const stamp = `r145-ev-cert-${Date.now()}`
    const id = await makeEquipment(stamp, { tip: 'MERSKA_OPREMA', calibrationRequired: true })
    const { token, user } = await createTestUserWithSession(`r145-evc-${Date.now()}`, 'VODJA')
    const due = new Date(Date.UTC(2027, 11, 31, 12, 0, 0))
    const res = await eventsPost(req('/api/equipment/events', token, {
      equipmentId: id, type: 'KALIBRACIJA', certificate: 'CAL-2027-0099', nextDueDate: due.toISOString(),
    }, 'POST'))
    expect(res.status).toBe(201)
    const fresh = await db.equipment.findUnique({ where: { id } })
    expect(fresh!.calibrationCertificate).toBe('CAL-2027-0099')
    expect(fresh!.calibrationDueDate!.toISOString()).toBe(due.toISOString())
    expect(await db.auditLog.count({ where: { akcija: 'EQUIPMENT_EVENT', userId: user.id } })).toBeGreaterThan(0)
  })

  it('kalibracija NEMERSKE opreme → 400 (ni relevantna)', async () => {
    const stamp = `r145-ev-nonm-${Date.now()}`
    const id = await makeEquipment(stamp, { tip: 'ROCNO_ORODJE' })
    const { token } = await createTestUserWithSession(`r145-evn-${Date.now()}`, 'VODJA')
    const res = await eventsPost(req('/api/equipment/events', token, {
      equipmentId: id, type: 'KALIBRACIJA', certificate: 'X',
    }, 'POST'))
    expect(res.status).toBe(400)
  })

  it('pregled posodobi lastInspectionAt; NAPAKA rezultat NE posodablja polj', async () => {
    const stamp = `r145-ev-insp-${Date.now()}`
    const id = await makeEquipment(stamp)
    const { token } = await createTestUserWithSession(`r145-evi-${Date.now()}`, 'VODJA')
    // Dogodki so IZVEDENI v preteklosti (preverba prihodnosti je fail-closed).
    const at = new Date(Date.UTC(2026, 4, 1, 8, 0, 0))
    const ok = await eventsPost(req('/api/equipment/events', token, { equipmentId: id, type: 'PREGLED', performedAt: at.toISOString() }, 'POST'))
    expect(ok.status).toBe(201)
    expect((await db.equipment.findUnique({ where: { id } }))!.lastInspectionAt!.toISOString()).toBe(at.toISOString())

    const bad = await eventsPost(req('/api/equipment/events', token, {
      equipmentId: id, type: 'PREGLED', result: 'NAPAKA', performedAt: new Date(Date.UTC(2026, 4, 2, 8, 0, 0)).toISOString(),
    }, 'POST'))
    expect(bad.status).toBe(201)
    // Napaka ne briše "zadnjega veljavnega pregleda" — iskreno stanje.
    expect((await db.equipment.findUnique({ where: { id } }))!.lastInspectionAt!.toISOString()).toBe(at.toISOString())
  })

  it('performedAt v prihodnosti → 400; neznana oprema → 404; neznani tip → 400', async () => {
    const stamp = `r145-ev-bad-${Date.now()}`
    const id = await makeEquipment(stamp)
    const { token } = await createTestUserWithSession(`r145-evb-${Date.now()}`, 'VODJA')
    const future = await eventsPost(req('/api/equipment/events', token, {
      equipmentId: id, type: 'PREGLED', performedAt: new Date(Date.now() + 86_400_000).toISOString(),
    }, 'POST'))
    expect(future.status).toBe(400)

    const unknown = await eventsPost(req('/api/equipment/events', token, { equipmentId: 'neobstaja', type: 'PREGLED' }, 'POST'))
    expect(unknown.status).toBe(404)

    const badType = await eventsPost(req('/api/equipment/events', token, { equipmentId: id, type: 'ČAROVANJE' }, 'POST'))
    expect(badType.status).toBe(400)
  })

  it('GET zgodovina: determinističen red (performedAt DESC)', async () => {
    const stamp = `r145-ev-hist-${Date.now()}`
    const id = await makeEquipment(stamp)
    const { token } = await createTestUserWithSession(`r145-evh-${Date.now()}`, 'VODJA')
    for (const d of [3, 1, 2]) {
      await eventsPost(req('/api/equipment/events', token, {
        equipmentId: id, type: 'SERVIS', performedAt: new Date(Date.UTC(2026, 0, d, 8, 0, 0)).toISOString(),
      }, 'POST'))
    }
    const res = await eventsGet(req(`/api/equipment/events?equipmentId=${id}`, token))
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{ performedAt: string }>
    expect(rows.length).toBe(3)
    const days = rows.map((r) => new Date(r.performedAt).getUTCDate())
    expect(days).toEqual([3, 2, 1])
  })
})

// ---------------------------------------------------------------------------
// Dodelitev opreme (R142 obljuba) — /api/schedules
// ---------------------------------------------------------------------------

describe('findEquipmentConflicts + POST/PATCH /api/schedules', () => {
  it('prekrivanje opreme → 409 z razlogom "oprema"; nazaj-na-nazaj → 201', async () => {
    const stamp = `r145-eq-conf-${Date.now()}`
    const eqId = await makeEquipment(stamp)
    const projectId = await makeProject(stamp)
    const { token } = await createTestUserWithSession(`r145-eqc-${Date.now()}`, 'VODJA')

    const first = await schedulesPost(req('/api/schedules', token, {
      projectId, datumZacetka: T(20, 8).toISOString(), datumKonca: T(20, 16).toISOString(), equipmentIds: [eqId],
    }, 'POST'))
    expect(first.status).toBe(201)

    const overlap = await schedulesPost(req('/api/schedules', token, {
      projectId, datumZacetka: T(20, 10).toISOString(), datumKonca: T(20, 18).toISOString(), equipmentIds: [eqId],
    }, 'POST'))
    expect(overlap.status).toBe(409)
    const body = (await overlap.json()) as { conflicts: Array<{ resource: string; naziv: string }> }
    expect(body.conflicts[0]!.resource).toBe('oprema')
    expect(body.conflicts[0]!.naziv).toBe(`Oprema ${stamp}`)
    expect(conflictMessage(body.conflicts as never)).toContain('je že rezervirana')

    // Nazaj-na-nazaj (konec 16:00 / začetek 16:00) → dovoljeno (poli-odprto).
    const backToBack = await schedulesPost(req('/api/schedules', token, {
      projectId, datumZacetka: T(20, 16).toISOString(), datumKonca: T(21, 0).toISOString(), equipmentIds: [eqId],
    }, 'POST'))
    expect(backToBack.status).toBe(201)
  })

  it('neznana oprema → 400; UPOKOJENA → 400; brez equipmentIds se nič ne spremeni', async () => {
    const stamp = `r145-eq-bad-${Date.now()}`
    const projectId = await makeProject(stamp)
    const { token } = await createTestUserWithSession(`r145-eqb-${Date.now()}`, 'VODJA')

    const unknown = await schedulesPost(req('/api/schedules', token, {
      projectId, datumZacetka: T(22, 8).toISOString(), datumKonca: T(22, 16).toISOString(), equipmentIds: ['neobstaja'],
    }, 'POST'))
    expect(unknown.status).toBe(400)

    const retiredId = await makeEquipment(`${stamp}-ret`, { status: 'UPOKOJENO' })
    const retired = await schedulesPost(req('/api/schedules', token, {
      projectId, datumZacetka: T(22, 8).toISOString(), datumKonca: T(22, 16).toISOString(), equipmentIds: [retiredId],
    }, 'POST'))
    expect(retired.status).toBe(400)

    const plain = await schedulesPost(req('/api/schedules', token, {
      projectId, datumZacetka: T(22, 8).toISOString(), datumKonca: T(22, 16).toISOString(),
    }, 'POST'))
    expect(plain.status).toBe(201)
  })

  it('premik termina SINHRONIZIRA intervale assignmentov', async () => {
    const stamp = `r145-move-${Date.now()}`
    const eqId = await makeEquipment(stamp)
    const projectId = await makeProject(stamp)
    const { token } = await createTestUserWithSession(`r145-mv-${Date.now()}`, 'VODJA')

    const created = (await (
      await schedulesPost(req('/api/schedules', token, {
        projectId, datumZacetka: T(24, 8).toISOString(), datumKonca: T(24, 16).toISOString(), equipmentIds: [eqId],
      }, 'POST'))
    ).json()) as { id: string }

    // Premik na naslednji dan — assignment mora slediti.
    const moved = await schedulesPatch(req('/api/schedules', token, {
      id: created.id, status: 'PRELOZENO', datumZacetka: T(25, 8).toISOString(), datumKonca: T(25, 16).toISOString(),
    }, 'PATCH'))
    expect(moved.status).toBe(200)
    const a = await db.equipmentAssignment.findFirst({ where: { scheduleId: created.id } })
    expect(a!.datumOd.toISOString()).toBe(T(25, 8).toISOString())
    expect(a!.datumDo.toISOString()).toBe(T(25, 16).toISOString())

    // Stari dan je zdaj PROST — nov termin z isto opremo uspe.
    const freed = await schedulesPost(req('/api/schedules', token, {
      projectId, datumZacetka: T(24, 8).toISOString(), datumKonca: T(24, 16).toISOString(), equipmentIds: [eqId],
    }, 'POST'))
    expect(freed.status).toBe(201)
  })

  it('zamenjava opreme (polna) → 409 proti konfliktu, 200 brez; DELETE izbrisa termina kaskadira', async () => {
    const stamp = `r145-swap-${Date.now()}`
    const eqA = await makeEquipment(`${stamp}-a`)
    const eqB = await makeEquipment(`${stamp}-b`)
    const projectId = await makeProject(stamp)
    const { token } = await createTestUserWithSession(`r145-sw-${Date.now()}`, 'VODJA')

    const s1 = (await (
      await schedulesPost(req('/api/schedules', token, {
        projectId, datumZacetka: T(26, 8).toISOString(), datumKonca: T(26, 16).toISOString(), equipmentIds: [eqA],
      }, 'POST'))
    ).json()) as { id: string }
    const s2 = (await (
      await schedulesPost(req('/api/schedules', token, {
        projectId, datumZacetka: T(26, 9).toISOString(), datumKonca: T(26, 17).toISOString(), equipmentIds: [eqB],
      }, 'POST'))
    ).json()) as { id: string }

    // s2 hoče opremo A — ta je v času s2 zasedena (s1) → 409.
    const conflict = await schedulesPatch(req('/api/schedules', token, {
      id: s2.id, status: 'NAVRTENO', equipmentIds: [eqA],
    }, 'PATCH'))
    expect(conflict.status).toBe(409)
    // Ni delne zamenjave: s2 še vedno drži opremo B.
    expect(await db.equipmentAssignment.count({ where: { scheduleId: s2.id, equipmentId: eqB } })).toBe(1)

    // s2 vzame opremo C (prosto) → 200.
    const ok = await schedulesPatch(req('/api/schedules', token, {
      id: s2.id, status: 'NAVRTENO', equipmentIds: [],
    }, 'PATCH'))
    expect(ok.status).toBe(200)
    expect(await db.equipmentAssignment.count({ where: { scheduleId: s2.id } })).toBe(0)
    expect(await db.equipmentAssignment.count({ where: { scheduleId: s1.id, equipmentId: eqA } })).toBe(1)
  })

  it('GET /api/schedules vsebuje opremo termina (nazaj-združljivo)', async () => {
    const stamp = `r145-get-sched-${Date.now()}`
    const eqId = await makeEquipment(stamp)
    const projectId = await makeProject(stamp)
    const { token } = await createTestUserWithSession(`r145-gs-${Date.now()}`, 'VODJA') // POST zahteva production.manage
    const created = await schedulesPost(req('/api/schedules', token, {
      projectId, datumZacetka: T(28, 8).toISOString(), datumKonca: T(28, 16).toISOString(), equipmentIds: [eqId],
    }, 'POST'))
    expect(created.status).toBe(201)
    const res = await schedulesGet(req(`/api/schedules?projectId=${projectId}`, token))
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{ id: string; equipment: Array<{ equipment: { id: string } }> }>
    const mine = rows.find((r) => r.equipment.some((x) => x.equipment.id === eqId))
    expect(mine).toBeDefined()
    // Vrstica mora imeti tudi id termina (za UI akcije).
    const assignmentCount = await db.equipmentAssignment.count({ where: { scheduleId: (mine ?? rows[0]!).id } })
    expect(assignmentCount).toBe(1)
  })
})
