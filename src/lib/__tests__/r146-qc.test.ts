// R146 — integracijski testi (issue #5 §27 — Quality control gate).
// ---------------------------------------------------------------------------
//   • Predloga: deterministična, VERSIONIRANA (qc-v1) — 10 postavk §27
//     (dimenzije … korektivni ukrepi). validateQCItems fail-closed: napačna
//     dolžina, neznani/dodaten/manjkajoč ključ, ne-boolean checked, prazna
//     opomba, opomba > 500.
//   • Determinizem: passed = vse izpolnjene; defectsCount = neizpolnjene;
//     neizpolnjena postavka ZAHTEVA opombo (napaka brez ukrepa se ne zapiše).
//   • POST /api/qc: anon → 401; MONTER (terensko delo) → 201; neveljavna
//     oblika → 400; derived projectId iz scheduleId; tuj schedule → 400;
//     revizija QC_SUBMITTED; approvedBy = seja (§27 approvedBy/approvedAt).
//   • QC GATE (PATCH /api/schedules → ZAKLJUCENO): brez preverbe → 409
//     qcRequired (NIČ spremenjeno); z override razlogom → 200 + revizija
//     QC_OVERRIDE + MONTIRANO + odšteta zaloga (§19 atomsko); prazen razlog
//     → 400; NE-prešla preverba ne odpre vrat; prešla preverba odpre brez
//     override; zapis nosi qcOverridden v reviziji SCHEDULE_STATUS.
//   • Override razlog: prazen/beli prostor/600 znakov → neveljaven (lib).
//
// Handlerji direktno, baza roksal_test prek globalSetup (vzorec R128–R145).
import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import { PATCH as schedulesPatch } from '@/app/api/schedules/route'
import { GET as qcGet, POST as qcPost } from '@/app/api/qc/route'
import {
  QC_TEMPLATE,
  QC_TEMPLATE_VERSION,
  validateQCItems,
  computePassed,
  countDefects,
  isValidOverrideReason,
} from '@/lib/qc-gate'

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

const T = (day: number, hour: number) => new Date(Date.UTC(2027, 8, day, hour, 0, 0))

/** Stranka + projekt (FK pogodba za schedule). R155: opcijski monterId — vrata na ravni vira. */
async function makeProject(tag: string, monterId?: string): Promise<string> {
  const customer = await db.customer.create({ data: { ime: `Stranka ${tag}`, naslov: 'Test 1' } })
  const project = await db.project.create({
    data: { customerId: customer.id, nazivProjekta: `Projekt ${tag}`, ...(monterId ? { monterId } : {}) },
  })
  return project.id
}

async function makeSchedule(projectId: string, status = 'V_TEKU'): Promise<string> {
  const s = await db.installationSchedule.create({
    data: { projectId, datumZacetka: T(10, 8), datumKonca: T(10, 16), status },
  })
  return s.id
}

/** Polne, VSE izpolnjene postavke (preverba prehaja). */
function allChecked() {
  return QC_TEMPLATE.map((t) => ({ key: t.key, checked: true, note: undefined }))
}

beforeEach(async () => {
  // Čistimo svoje teste po tagih (r146-*) — unikatni nazivi/e-pošte.
  await db.qualityControl.deleteMany({ where: { project: { nazivProjekta: { contains: 'r146' } } } })
  await db.installationSchedule.deleteMany({ where: { project: { nazivProjekta: { contains: 'r146' } } } })
  await db.project.deleteMany({ where: { nazivProjekta: { contains: 'r146' } } })
  await db.customer.deleteMany({ where: { ime: { contains: 'r146' } } })
})

// ---------------------------------------------------------------------------
// Čisto jedro (determinizem)
// ---------------------------------------------------------------------------

describe('QC predloga (deterministična, verzirana)', () => {
  it('predloga pokriva vseh 10 §27 področij in ima verzijo', () => {
    expect(QC_TEMPLATE.length).toBe(10)
    expect(QC_TEMPLATE_VERSION).toBe('qc-v1')
    const keys = QC_TEMPLATE.map((t) => t.key)
    expect(new Set(keys).size).toBe(10)
    for (const k of ['dimenzije', 'sidranje', 'zakljucek_ral', 'komponente', 'steklo', 'poravnava', 'varnost', 'fotografije', 'napake', 'korekcija']) {
      expect(keys).toContain(k)
    }
  })

  it('validateQCItems: veljavni vnos → items v vrstnem redu predloge', () => {
    const raw = QC_TEMPLATE.map((t, i) => ({ key: t.key, checked: i % 2 === 0, note: i % 2 === 0 ? undefined : 'popravljeno 5. 9.' }))
    const v = validateQCItems(raw)
    expect('items' in v).toBe(true)
    if ('items' in v) {
      expect(v.items.map((i) => i.key)).toEqual(QC_TEMPLATE.map((t) => t.key))
      expect(computePassed(v.items)).toBe(false)
      expect(countDefects(v.items)).toBe(5)
    }
  })

  it('validateQCItems: manjkajoč/dodatn/neznan ključ → napaka (fail-closed)', () => {
    const short = allChecked().slice(1)
    expect('error' in validateQCItems(short)).toBe(true)
    const extra = [...allChecked(), { key: 'neznano', checked: true }]
    expect('error' in validateQCItems(extra)).toBe(true)
    expect('error' in validateQCItems(allChecked().map((i) => i.key === 'dimenzije' ? { ...i, key: 'tuje' } : i))).toBe(true)
  })

  it('validateQCItems: ne-boolean checked → napaka; podvojen ključ → napaka', () => {
    const badChecked = allChecked().map((i) => i.key === 'steklo' ? { ...i, checked: 'ja' } : i)
    expect('error' in validateQCItems(badChecked)).toBe(true)
    const dup = [...allChecked(), ...allChecked().slice(0, 1)]
    expect('error' in validateQCItems(dup)).toBe(true)
  })

  it('neizpolnjena postavka brez opombe → napaka (napaka brez ukrepa se ne zapiše)', () => {
    const withHole = allChecked().map((i) => i.key === 'poravnava' ? { ...i, checked: false, note: undefined } : i)
    const v = validateQCItems(withHole)
    expect('error' in v).toBe(true)
    if ('error' in v) expect(v.error).toContain('poravnava'.length > 0 ? 'izpolnjena' : '')
    // Z opombo je veljavno (defekt z ukrepom), a NE prehaja.
    const withNote = allChecked().map((i) => i.key === 'poravnava' ? { ...i, checked: false, note: ' popravek naslednji teden ' } : i)
    const v2 = validateQCItems(withNote)
    if ('items' in v2) {
      expect(computePassed(v2.items)).toBe(false)
      expect(countDefects(v2.items)).toBe(1)
      expect(v2.items.find((i) => i.key === 'poravnava')!.note).toBe('popravek naslednji teden') // trim
    }
  })

  it('opomba > 500 znakov → napaka; vse izpolnjeno → passed', () => {
    const long = allChecked().map((i) => i.key === 'fotografije' ? { ...i, note: 'x'.repeat(501) } : i)
    expect('error' in validateQCItems(long)).toBe(true)
    const v = validateQCItems(allChecked())
    if ('items' in v) {
      expect(computePassed(v.items)).toBe(true)
      expect(countDefects(v.items)).toBe(0)
    }
  })

  it('override razlog: prazen/beli prostor/600 → neveljaven; opisan → veljaven', () => {
    expect(isValidOverrideReason('')).toBe(false)
    expect(isValidOverrideReason('   ')).toBe(false)
    expect(isValidOverrideReason('x'.repeat(501))).toBe(false)
    expect(isValidOverrideReason(123)).toBe(false)
    expect(isValidOverrideReason('Stranka je prevzela brez zadnjega pregleda — naročnikova želja')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// API — /api/qc
// ---------------------------------------------------------------------------

describe('POST/GET /api/qc', () => {
  it('anon → 401 (GET in POST)', async () => {
    expect((await qcGet(req('/api/qc?projectId=x', null))).status).toBe(401)
    expect((await qcPost(req('/api/qc', null, { projectId: 'x', items: allChecked() }, 'POST'))).status).toBe(401)
  })

  it('MONTER shrani preverbo → 201 + passed + revizija QC_SUBMITTED + approvedBy', async () => {
    const stamp = `r146-post-${Date.now()}`
    // R155: vrata na ravni vira — MONTER je član projekta (monterId).
    const { token, user } = await createTestUserWithSession(`r146-post-${Date.now()}`, 'MONTER')
    const projectId = await makeProject(stamp, user.id)
    const scheduleId = await makeSchedule(projectId)

    const res = await qcPost(req('/api/qc', token, { projectId, scheduleId, items: allChecked() }, 'POST'))
    expect(res.status).toBe(201)
    const body = (await res.json()) as { id: string; passed: boolean; defectsCount: number; templateVersion: string }
    expect(body.passed).toBe(true)
    expect(body.defectsCount).toBe(0)
    expect(body.templateVersion).toBe('qc-v1')

    const row = await db.qualityControl.findUnique({ where: { id: body.id } })
    expect(row!.approvedById).toBe(user.id) // §27 approvedBy
    expect(row!.scheduleId).toBe(scheduleId)
    const audit = await db.auditLog.findFirst({ where: { akcija: 'QC_SUBMITTED', projectId, userId: user.id } })
    expect(audit).not.toBeNull()
    expect(audit!.newValue).toContain('qc-v1')
  })

  it('neveljavna oblika → 400; tuj schedule → 400; neznani projekt → 404', async () => {
    const stamp = `r146-bad-${Date.now()}`
    // R155: vrata na ravni vira — MONTER je član projekta (monterId).
    const { token, user } = await createTestUserWithSession(`r146-bad-${Date.now()}`, 'MONTER')
    const projectId = await makeProject(stamp, user.id)
    const otherProject = await makeProject(`r146-drugi-${Date.now()}`)
    const foreignSchedule = await makeSchedule(otherProject)

    const badItems = await qcPost(req('/api/qc', token, { projectId, items: [{ key: 'dimenzije', checked: true }] }, 'POST'))
    expect(badItems.status).toBe(400)

    const foreign = await qcPost(req('/api/qc', token, { projectId, scheduleId: foreignSchedule, items: allChecked() }, 'POST'))
    expect(foreign.status).toBe(400)

    const unknownProj = await qcPost(req('/api/qc', token, { projectId: 'neobstaja', items: allChecked() }, 'POST'))
    expect(unknownProj.status).toBe(404)

    const unknownSched = await qcPost(req('/api/qc', token, { scheduleId: 'neobstaja', items: allChecked() }, 'POST'))
    expect(unknownSched.status).toBe(400)
  })

  it('GET vrne najnovejšo preverbo z items (determinističen red DESC)', async () => {
    const stamp = `r146-get-${Date.now()}`
    // R155: vrata na ravni vira — MONTER je član projekta (monterId).
    const { token, user } = await createTestUserWithSession(`r146-get-${Date.now()}`, 'MONTER')
    const projectId = await makeProject(stamp, user.id)

    const empty = await qcGet(req(`/api/qc?projectId=${projectId}`, token))
    expect((await empty.json()) as { qualityControl: null }).toEqual({ qualityControl: null })

    await qcPost(req('/api/qc', token, { projectId, items: allChecked() }, 'POST'))
    const res = await qcGet(req(`/api/qc?projectId=${projectId}`, token))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { qualityControl: { items: unknown[]; passed: boolean; approvedBy: string | null } }
    expect(body.qualityControl.passed).toBe(true)
    expect(body.qualityControl.items.length).toBe(10)
    expect(body.qualityControl.approvedBy).toContain('r146-get')
  })
})

// ---------------------------------------------------------------------------
// QC GATE — PATCH /api/schedules → ZAKLJUCENO
// ---------------------------------------------------------------------------

describe('§27 vrata na zaključitvi', () => {
  it('brez preverbe brez override → 409 qcRequired; termin + projekt NESPREMENJENA', async () => {
    const stamp = `r146-gate-1-${Date.now()}`
    const projectId = await makeProject(stamp)
    const scheduleId = await makeSchedule(projectId)
    const { token } = await createTestUserWithSession(`r146-g1-${Date.now()}`, 'VODJA')

    const res = await schedulesPatch(req('/api/schedules', token, { id: scheduleId, status: 'ZAKLJUCENO' }, 'PATCH'))
    expect(res.status).toBe(409)
    const body = (await res.json()) as { qcRequired: boolean; detail: string }
    expect(body.qcRequired).toBe(true)
    expect(body.detail).toContain('qcOverrideReason')

    // ATOMNOST: termin še V_TEKU, projekt ni MONTIRANO, brez QC_OVERRIDE.
    expect((await db.installationSchedule.findUnique({ where: { id: scheduleId } }))!.status).toBe('V_TEKU')
    expect((await db.project.findUnique({ where: { id: projectId } }))!.status).not.toBe('MONTIRANO')
    expect(await db.auditLog.count({ where: { akcija: 'QC_OVERRIDE', projectId } })).toBe(0)
  })

  it('s prešlo preverbo → 200 brez override; revizija nosi qcOverridden: false', async () => {
    const stamp = `r146-gate-2-${Date.now()}`
    const projectId = await makeProject(stamp)
    const scheduleId = await makeSchedule(projectId)
    const { token, user } = await createTestUserWithSession(`r146-g2-${Date.now()}`, 'VODJA')

    await qcPost(req('/api/qc', token, { projectId, scheduleId, items: allChecked() }, 'POST'))
    const res = await schedulesPatch(req('/api/schedules', token, { id: scheduleId, status: 'ZAKLJUCENO' }, 'PATCH'))
    expect(res.status).toBe(200)
    expect((await db.project.findUnique({ where: { id: projectId } }))!.status).toBe('MONTIRANO')
    const audit = await db.auditLog.findFirst({ where: { akcija: 'SCHEDULE_STATUS', projectId, userId: user.id }, orderBy: { timestamp: 'desc' } })
    expect(audit!.newValue).toContain('"qcOverridden":false')
  })

  it('s NE-prešlo preverbo → ŠE VEDNO 409 (fail-closed — napake ne odprejo vrat)', async () => {
    const stamp = `r146-gate-3-${Date.now()}`
    const projectId = await makeProject(stamp)
    const scheduleId = await makeSchedule(projectId)
    const { token } = await createTestUserWithSession(`r146-g3-${Date.now()}`, 'VODJA')

    const withDefect = allChecked().map((i) => i.key === 'steklo' ? { ...i, checked: false, note: 'praska na steklu — menjava naslednji teden' } : i)
    const qc = await qcPost(req('/api/qc', token, { projectId, items: withDefect }, 'POST'))
    expect((await qc.json()) as { passed: boolean }).toEqual(expect.objectContaining({ passed: false }))

    const res = await schedulesPatch(req('/api/schedules', token, { id: scheduleId, status: 'ZAKLJUCENO' }, 'PATCH'))
    expect(res.status).toBe(409)
    expect((await db.installationSchedule.findUnique({ where: { id: scheduleId } }))!.status).toBe('V_TEKU')
  })

  it('override z razlogom → 200 + QC_OVERRIDE revizija + MONTIRANO (atomsko)', async () => {
    const stamp = `r146-gate-4-${Date.now()}`
    const projectId = await makeProject(stamp)
    const scheduleId = await makeSchedule(projectId)
    const { token, user } = await createTestUserWithSession(`r146-g4-${Date.now()}`, 'VODJA')

    const res = await schedulesPatch(req('/api/schedules', token, {
      id: scheduleId, status: 'ZAKLJUCENO', qcOverrideReason: 'Zimski termin — steklo dobavi dobavitelj kasneje, dogovorjeno s stranko',
    }, 'PATCH'))
    expect(res.status).toBe(200)
    expect((await db.installationSchedule.findUnique({ where: { id: scheduleId } }))!.status).toBe('ZAKLJUCENO')
    expect((await db.project.findUnique({ where: { id: projectId } }))!.status).toBe('MONTIRANO')
    const override = await db.auditLog.findFirst({ where: { akcija: 'QC_OVERRIDE', projectId, userId: user.id } })
    expect(override).not.toBeNull()
    expect(override!.newValue).toContain('dobavitelj')
    expect(await db.auditLog.count({ where: { akcija: 'SCHEDULE_STATUS', projectId, userId: user.id } })).toBe(1)
  })

  it('prazen override razlog → 400 (validacija PRED transakcijo)', async () => {
    const stamp = `r146-gate-5-${Date.now()}`
    const projectId = await makeProject(stamp)
    const scheduleId = await makeSchedule(projectId)
    const { token } = await createTestUserWithSession(`r146-g5-${Date.now()}`, 'VODJA')

    for (const reason of ['', '   ']) {
      const res = await schedulesPatch(req('/api/schedules', token, { id: scheduleId, status: 'ZAKLJUCENO', qcOverrideReason: reason }, 'PATCH'))
      expect(res.status).toBe(400)
    }
    expect((await db.installationSchedule.findUnique({ where: { id: scheduleId } }))!.status).toBe('V_TEKU')
  })

  it('preverba drugega projekta NE odpre vrat (izolacija po projektu)', async () => {
    const stamp = `r146-gate-6-${Date.now()}`
    const otherProject = await makeProject(`r146-tuj-${Date.now()}`)
    const projectId = await makeProject(stamp)
    const scheduleId = await makeSchedule(projectId)
    const { token } = await createTestUserWithSession(`r146-g6-${Date.now()}`, 'VODJA')

    await qcPost(req('/api/qc', token, { projectId: otherProject, items: allChecked() }, 'POST'))
    const res = await schedulesPatch(req('/api/schedules', token, { id: scheduleId, status: 'ZAKLJUCENO' }, 'PATCH'))
    expect(res.status).toBe(409)
  })
})
