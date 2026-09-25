// R147 — integracijski testi (issue #5 §28 — Structured installation evidence).
// ---------------------------------------------------------------------------
//   • Predloga checklist: deterministična, VERSIONIRANA (iev-v1) — 8 postavk
//     §28 (pred/po, lokacija, material, meritve, napake, čiščenje, predaja).
//     validateIEVChecklist fail-closed: napačna dolžina, neznani/dodaten/
//     manjkajoč ključ, ne-boolean checked, prazna opomba, opomba > 500.
//   • Napake: vsaka { opomba (ne-prazna ≤ 500), reseno boolean }, strop 20.
//   • GPS po policyju: soglasje OBVEZEN vhod; koordinate brez soglasja →
//     napaka (ne tiho); soglasje brez koordinat → napaka; obseg + finite.
//   • POST /api/evidence: anon → 401; MONTER → 201 + revizija
//     INSTALLATION_EVIDENCE_SUBMITTED + createdById = seja; fotka MORA
//     obstajati, pripadati projektu in imeti kategorijo (PRED/PO); meritev
//     MORA pripadati projektu; GPS z soglasjem → gpsConsentAt (strežnik).
//   • GET /api/evidence: lista DESC + izpeljane zastavice + PORABA MATERIALA
//     izvedena iz StockLedger (samo odhodi, agregat po artikel, red po šifri).
//   • PATCH: zaklenjeno s predajo → 409 (NIČ spremenjeno); predaja brez
//     PRED/PO fotk → 409 PRED mutacijo (vzorec R146 — vrata za mutacijo);
//     veljavna predaja → handoverAt + revizija _HANDOVER; 404 neznan id.
//
// Handlerji direktno, baza roksal_test prek globalSetup (vzorec R128–R146).
import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import { GET as evidenceGet, POST as evidencePost, PATCH as evidencePatch } from '@/app/api/evidence/route'
import {
  IEV_TEMPLATE,
  IEV_TEMPLATE_VERSION,
  validateIEVChecklist,
  validateIEVDefects,
  validateIEVGps,
  validateIEVLocation,
  computeIEVFlags,
} from '@/lib/installation-evidence'

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

/** Stranka + projekt (FK pogodba). */
async function makeProject(tag: string): Promise<string> {
  const customer = await db.customer.create({ data: { ime: `Stranka ${tag}`, naslov: 'Test 1' } })
  const project = await db.project.create({ data: { customerId: customer.id, nazivProjekta: `Projekt ${tag}` } })
  return project.id
}

async function makeSchedule(projectId: string, status = 'V_TEKU'): Promise<string> {
  const s = await db.installationSchedule.create({
    data: { projectId, datumZacetka: T(11, 8), datumKonca: T(11, 16), status },
  })
  return s.id
}

async function makePhoto(projectId: string, kategorija: 'PRED' | 'PO'): Promise<string> {
  const p = await db.projectPhoto.create({ data: { projectId, kategorija } })
  return p.id
}

function allChecked() {
  return IEV_TEMPLATE.map((t) => ({ key: t.key, checked: true, note: undefined }))
}

const VALID_BODY = (projectId: string, extra: Record<string, unknown> = {}) => ({
  projectId,
  lokacija: 'Kranj, Cesta 1',
  checklist: allChecked(),
  defects: [],
  gps: { gpsConsent: false, gpsLat: null, gpsLng: null },
  ...extra,
})

beforeEach(async () => {
  // Čistimo svoje teste po tagih (r147-*) — unikatni nazivi/e-pošte.
  await db.installationEvidence.deleteMany({ where: { project: { nazivProjekta: { contains: 'r147' } } } })
  await db.auditLog.deleteMany({ where: { project: { nazivProjekta: { contains: 'r147' } } } })
  await db.stockLedger.deleteMany({ where: { project: { nazivProjekta: { contains: 'r147' } } } })
  await db.lotAllocation.deleteMany({ where: { project: { nazivProjekta: { contains: 'r147' } } } })
  await db.projectPhoto.deleteMany({ where: { project: { nazivProjekta: { contains: 'r147' } } } })
  await db.installationSchedule.deleteMany({ where: { project: { nazivProjekta: { contains: 'r147' } } } })
  await db.measurement.deleteMany({ where: { project: { nazivProjekta: { contains: 'r147' } } } })
  // Prejemi (RECEIPT) nosijo projectId: null → čiščenje po referenci artikla.
  await db.stockLedger.deleteMany({ where: { inventory: { sifraMateriala: { contains: 'r147' } } } })
  await db.inventory.deleteMany({ where: { sifraMateriala: { contains: 'r147' } } })
  await db.project.deleteMany({ where: { nazivProjekta: { contains: 'r147' } } })
  await db.customer.deleteMany({ where: { ime: { contains: 'r147' } } })
})

// ---------------------------------------------------------------------------
// Čisto jedro (determinizem)
// ---------------------------------------------------------------------------

describe('IEV predloga (deterministična, verzirana)', () => {
  it('predloga pokriva §28 področja in ima verzijo', () => {
    expect(IEV_TEMPLATE.length).toBe(8)
    expect(IEV_TEMPLATE_VERSION).toBe('iev-v1')
    const keys = IEV_TEMPLATE.map((t) => t.key)
    expect(new Set(keys).size).toBe(8)
    for (const k of ['pred_foto', 'po_foto', 'lokacija', 'material', 'meritve', 'napake', 'ciscenje', 'predaja']) {
      expect(keys).toContain(k)
    }
  })

  it('validateIEVChecklist: veljaven vnos → items v vrstnem redu predloge', () => {
    const raw = IEV_TEMPLATE.map((t, i) => ({ key: t.key, checked: i % 2 === 0, note: i % 2 === 0 ? undefined : 'delno jutri' }))
    const v = validateIEVChecklist(raw)
    expect('items' in v).toBe(true)
    if ('items' in v) expect(v.items.map((i) => i.key)).toEqual(IEV_TEMPLATE.map((t) => t.key))
  })

  it('validateIEVChecklist: manjkajoč/dodaten/neznani ključ → napaka (fail-closed)', () => {
    expect('error' in validateIEVChecklist(allChecked().slice(1))).toBe(true)
    expect('error' in validateIEVChecklist([...allChecked(), { key: 'neznano', checked: true }])).toBe(true)
    expect('error' in validateIEVChecklist(allChecked().map((i) => (i.key === 'pred_foto' ? { ...i, key: 'tuje' } : i)))).toBe(true)
  })

  it('validateIEVChecklist: ne-boolean checked / podvojen ključ → napaka', () => {
    expect('error' in validateIEVChecklist(allChecked().map((i) => (i.key === 'po_foto' ? { ...i, checked: 'ja' } : i)))).toBe(true)
    expect('error' in validateIEVChecklist([...allChecked(), ...allChecked().slice(0, 1)])).toBe(true)
  })

  it('neizpolnjena postavka brez opombe → napaka; opomba > 500 → napaka', () => {
    expect('error' in validateIEVChecklist(allChecked().map((i) => (i.key === 'ciscenje' ? { ...i, checked: false, note: undefined } : i)))).toBe(true)
    expect('error' in validateIEVChecklist(allChecked().map((i) => (i.key === 'material' ? { ...i, checked: false, note: 'x'.repeat(501) } : i)))).toBe(true)
    // Prazna opomba ni uporabna — ali odstrani ali zapiši ukrep.
    expect('error' in validateIEVChecklist(allChecked().map((i) => (i.key === 'material' ? { ...i, checked: false, note: '  ' } : i)))).toBe(true)
  })

  it('validateIEVDefects: ne-prazna opomba + reseno boolean; strop 20; prazno = OK', () => {
    const v = validateIEVDefects([{ opomba: 'Praska na letvici 3', reseno: false }])
    expect('defects' in v).toBe(true)
    expect(validateIEVDefects(null)).toEqual({ defects: [] })
    expect('error' in validateIEVDefects([{ opomba: '   ', reseno: true }])).toBe(true)
    expect('error' in validateIEVDefects([{ opomba: 'x', reseno: 'ja' }])).toBe(true)
    expect('error' in validateIEVDefects(Array.from({ length: 21 }, (_, i) => ({ opomba: `n${i}`, reseno: false })))).toBe(true)
    expect('error' in validateIEVDefects([{ opomba: 'x'.repeat(501), reseno: true }])).toBe(true)
  })

  it('validateIEVGps: koordinate brez soglasja → NAPAKA (ne tiho)', () => {
    expect('error' in validateIEVGps({ gpsConsent: false, gpsLat: 46.15, gpsLng: 14.5 })).toBe(true)
  })

  it('validateIEVGps: soglasje brez koordinat → napaka; neznani soglasje → napaka', () => {
    expect('error' in validateIEVGps({ gpsConsent: true, gpsLat: null, gpsLng: null })).toBe(true)
    expect('error' in validateIEVGps({ gpsConsent: 'ja', gpsLat: 46.15, gpsLng: 14.5 })).toBe(true)
    expect(validateIEVGps({ gpsConsent: false, gpsLat: null, gpsLng: null })).toEqual({ gps: { gpsLat: null, gpsLng: null, withConsent: false } })
  })

  it('validateIEVGps: obseg + finite; veljavno soglasje → koordinate', () => {
    expect('error' in validateIEVGps({ gpsConsent: true, gpsLat: 91, gpsLng: 14.5 })).toBe(true)
    expect('error' in validateIEVGps({ gpsConsent: true, gpsLat: 46.15, gpsLng: 190 })).toBe(true)
    expect('error' in validateIEVGps({ gpsConsent: true, gpsLat: NaN, gpsLng: 14.5 })).toBe(true)
    const v = validateIEVGps({ gpsConsent: true, gpsLat: 46.15, gpsLng: 14.5 })
    expect(v).toEqual({ gps: { gpsLat: 46.15, gpsLng: 14.5, withConsent: true } })
  })

  it('validateIEVLocation: obvezna, obrezana, ≤ 300', () => {
    expect('error' in validateIEVLocation(undefined)).toBe(true)
    expect('error' in validateIEVLocation('   ')).toBe(true)
    expect('error' in validateIEVLocation('x'.repeat(301))).toBe(true)
    expect(validateIEVLocation('  Kranj  ')).toEqual({ lokacija: 'Kranj' })
  })

  it('computeIEVFlags: complete = pred + po + checklist + predaja; locked = predaja', () => {
    const base = { checklistJson: JSON.stringify(allChecked()), defectsJson: '[]', now: new Date() }
    const flags = computeIEVFlags({
      ...base,
      beforePhotoId: 'b1',
      afterPhotoId: 'a1',
      handoverAt: new Date(),
    })
    expect(flags.complete).toBe(true)
    expect(flags.locked).toBe(true)
    expect(computeIEVFlags({ ...base, beforePhotoId: null, afterPhotoId: 'a1', handoverAt: new Date() }).complete).toBe(false)
    expect(computeIEVFlags({ ...base, beforePhotoId: 'b1', afterPhotoId: 'a1', handoverAt: null }).locked).toBe(false)
    const unchecked = computeIEVFlags({
      ...base,
      checklistJson: JSON.stringify(allChecked().map((i) => (i.key === 'material' ? { ...i, checked: false } : i))),
      beforePhotoId: 'b1',
      afterPhotoId: 'a1',
      handoverAt: new Date(),
    })
    expect(unchecked.checklistAllChecked).toBe(false)
    expect(unchecked.complete).toBe(false)
    const withOpenDefects = computeIEVFlags({
      ...base,
      defectsJson: JSON.stringify([{ opomba: 'praska', reseno: false }, { opomba: 'umazano', reseno: true }]),
      beforePhotoId: 'b1',
      afterPhotoId: 'a1',
      handoverAt: new Date(),
    })
    expect(withOpenDefects.defectsCount).toBe(2)
    expect(withOpenDefects.openDefectsCount).toBe(1)
    // Pokvarjen JSON → iskreno false (ne ugibanje).
    expect(computeIEVFlags({ ...base, checklistJson: '{neveljaven', beforePhotoId: 'b1', afterPhotoId: 'a1', handoverAt: new Date() }).checklistAllChecked).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// POST /api/evidence
// ---------------------------------------------------------------------------

describe('POST /api/evidence', () => {
  it('anon → 401', async () => {
    const projectId = await makeProject('r147-anon')
    const res = await evidencePost(req('/api/evidence', null, VALID_BODY(projectId), 'POST'))
    expect(res.status).toBe(401)
  })

  it('MONTER shrani dokazilo → 201 + revizija INSTALLATION_EVIDENCE_SUBMITTED + createdById', async () => {
    const stamp = `r147-post-${Date.now()}`
    const projectId = await makeProject(stamp)
    const scheduleId = await makeSchedule(projectId)
    const { token, user } = await createTestUserWithSession(`r147-post-${Date.now()}`, 'MONTER')

    const res = await evidencePost(req('/api/evidence', token, VALID_BODY(projectId, { scheduleId }), 'POST'))
    expect(res.status).toBe(201)
    const body = (await res.json()) as { id: string; templateVersion: string; lokacija: string }
    expect(body.templateVersion).toBe('iev-v1')
    expect(body.lokacija).toBe('Kranj, Cesta 1')

    const row = await db.installationEvidence.findUnique({ where: { id: body.id } })
    expect(row!.createdById).toBe(user.id)
    expect(row!.scheduleId).toBe(scheduleId)
    expect(row!.gpsConsentAt).toBeNull() // brez soglasja se nič ne zapiše
    const audit = await db.auditLog.findFirst({ where: { akcija: 'INSTALLATION_EVIDENCE_SUBMITTED', projectId, userId: user.id } })
    expect(audit).not.toBeNull()
    expect(audit!.newValue).toContain('iev-v1')
  })

  it('GPS z soglasjem → koordinate + gpsConsentAt (strežnik); brez soglasja s koordinatami → 400', async () => {
    const stamp = `r147-gps-${Date.now()}`
    const projectId = await makeProject(stamp)
    const { token } = await createTestUserWithSession(`r147-gps-${Date.now()}`, 'MONTER')

    const ok = await evidencePost(req('/api/evidence', token, VALID_BODY(projectId, {
      gps: { gpsConsent: true, gpsLat: 46.1512, gpsLng: 14.9935 },
    }), 'POST'))
    expect(ok.status).toBe(201)
    const okBody = (await ok.json()) as { id: string }
    const row = await db.installationEvidence.findUnique({ where: { id: okBody.id } })
    expect(row!.gpsLat).toBe(46.1512)
    expect(row!.gpsLng).toBe(14.9935)
    expect(row!.gpsConsentAt).not.toBeNull()

    const denied = await evidencePost(req('/api/evidence', token, VALID_BODY(projectId, {
      gps: { gpsConsent: false, gpsLat: 46.1512, gpsLng: 14.9935 },
    }), 'POST'))
    expect(denied.status).toBe(400)
  })

  it('fotka: napačna kategorija → 400; tuja → 400; neznana → 400; prava kategorija → 201', async () => {
    const stamp = `r147-foto-${Date.now()}`
    const projectId = await makeProject(stamp)
    const otherProject = await makeProject(`r147-drugi-${Date.now()}`)
    const { token } = await createTestUserWithSession(`r147-foto-${Date.now()}`, 'MONTER')
    const predPhoto = await makePhoto(projectId, 'PRED')
    const poPhoto = await makePhoto(projectId, 'PO')
    const foreignPhoto = await makePhoto(otherProject, 'PO')

    const wrongCat = await evidencePost(req('/api/evidence', token, VALID_BODY(projectId, { beforePhotoId: poPhoto }), 'POST'))
    expect(wrongCat.status).toBe(400)
    const foreign = await evidencePost(req('/api/evidence', token, VALID_BODY(projectId, { afterPhotoId: foreignPhoto }), 'POST'))
    expect(foreign.status).toBe(400)
    const unknown = await evidencePost(req('/api/evidence', token, VALID_BODY(projectId, { beforePhotoId: 'neobstaja' }), 'POST'))
    expect(unknown.status).toBe(400)

    const ok = await evidencePost(req('/api/evidence', token, VALID_BODY(projectId, {
      beforePhotoId: predPhoto, afterPhotoId: poPhoto,
    }), 'POST'))
    expect(ok.status).toBe(201)
  })

  it('neveljaven checklist → 400; tuja meritev → 400; prazna lokacija → 400; derivacija projectId iz scheduleId', async () => {
    const stamp = `r147-val-${Date.now()}`
    const projectId = await makeProject(stamp)
    const otherProject = await makeProject(`r147-drugi-${Date.now()}`)
    const scheduleId = await makeSchedule(projectId)
    const foreignSchedule = await makeSchedule(otherProject)
    const { token } = await createTestUserWithSession(`r147-val-${Date.now()}`, 'MONTER')
    const measurement = await db.measurement.create({
      data: { projectId, dolzinaMm: 1000, visinaMm: 2000 },
    })

    const badChecklist = await evidencePost(req('/api/evidence', token, { projectId, lokacija: 'x', checklist: [{ key: 'pred_foto', checked: true }] }, 'POST'))
    expect(badChecklist.status).toBe(400)
    const badLoc = await evidencePost(req('/api/evidence', token, { projectId, lokacija: '  ', checklist: allChecked(), defects: [] }, 'POST'))
    expect(badLoc.status).toBe(400)

    const foreignMeas = await evidencePost(req('/api/evidence', token, VALID_BODY(projectId, { measurementId: 'neobstaja' }), 'POST'))
    expect(foreignMeas.status).toBe(400)

    const foreignSched = await evidencePost(req('/api/evidence', token, VALID_BODY(projectId, { scheduleId: foreignSchedule }), 'POST'))
    expect(foreignSched.status).toBe(400)

    // Meritev istega projekta + scheduleId-only derivacija → 201.
    const okMeas = await evidencePost(req('/api/evidence', token, { scheduleId, lokacija: 'L', checklist: allChecked(), defects: [], measurementId: measurement.id }, 'POST'))
    expect(okMeas.status).toBe(201)
  })

  it('neznani projekt → 404; tudi za GET', async () => {
    const { token } = await createTestUserWithSession(`r147-404-${Date.now()}`, 'MONTER')
    const post = await evidencePost(req('/api/evidence', token, VALID_BODY('neobstaja'), 'POST'))
    expect(post.status).toBe(404)
    const get = await evidenceGet(req('/api/evidence?projectId=neobstaja', token))
    expect(get.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// GET /api/evidence — lista + izpeljane zastavice + poraba materiala
// ---------------------------------------------------------------------------

describe('GET /api/evidence', () => {
  it('anon → 401 + brez projectId → 400', async () => {
    expect((await evidenceGet(req('/api/evidence?projectId=x', null))).status).toBe(401)
    const { token } = await createTestUserWithSession(`r147-get-${Date.now()}`, 'MONTER')
    expect((await evidenceGet(req('/api/evidence', token))).status).toBe(400)
  })

  it('lista DESC z izpeljanimi zastavicami; poraba materiala izvedena iz StockLedger', async () => {
    const stamp = `r147-list-${Date.now()}`
    const projectId = await makeProject(stamp)
    const { token } = await createTestUserWithSession(`r147-list-${Date.now()}`, 'MONTER')
    const predPhoto = await makePhoto(projectId, 'PRED')
    const poPhoto = await makePhoto(projectId, 'PO')

    const empty = await evidenceGet(req(`/api/evidence?projectId=${projectId}`, token))
    expect(empty.status).toBe(200)
    const emptyBody = (await empty.json()) as { evidence: unknown[]; materialConsumption: unknown[] }
    expect(emptyBody.evidence).toEqual([])
    expect(emptyBody.materialConsumption).toEqual([])

    // Poraba: prihod (RECEIPT) ni poraba; odhoda (ISSUE) na projektu so.
    const inv = await db.inventory.create({
      data: { sifraMateriala: `r147-ART-${Date.now()}`, naziv: 'Alu Letvica', tip: 'PROFIL', enota: 'm' },
    })
    await db.stockLedger.create({ data: { inventoryId: inv.id, eventType: 'RECEIPT', kolicina: 50, enota: 'm', balanceAfter: 50, projectId: null, reason: 'prejem' } })
    await db.stockLedger.create({ data: { inventoryId: inv.id, eventType: 'ISSUE', kolicina: -12.5, enota: 'm', balanceAfter: 37.5, projectId, reason: 'montaža' } })
    await db.stockLedger.create({ data: { inventoryId: inv.id, eventType: 'ISSUE', kolicina: -0.5, enota: 'm', balanceAfter: 37, projectId, reason: 'odrezek' } })

    const created = await evidencePost(req('/api/evidence', token, VALID_BODY(projectId, {
      beforePhotoId: predPhoto, afterPhotoId: poPhoto,
      defects: [{ opomba: 'Praska na letvici', reseno: false }],
    }), 'POST'))
    expect(created.status).toBe(201)

    const res = await evidenceGet(req(`/api/evidence?projectId=${projectId}`, token))
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      evidence: Array<{ hasBefore: boolean; hasAfter: boolean; complete: boolean; locked: boolean; openDefectsCount: number; checklist: unknown[]; gps: unknown }>
      materialConsumption: Array<{ naziv: string; kolicina: number; enota: string }>
      total: number
    }
    expect(body.total).toBe(1)
    expect(body.evidence[0].hasBefore).toBe(true)
    expect(body.evidence[0].hasAfter).toBe(true)
    expect(body.evidence[0].complete).toBe(false) // predaja manjka
    expect(body.evidence[0].locked).toBe(false)
    expect(body.evidence[0].openDefectsCount).toBe(1)
    expect(body.evidence[0].gps).toBeNull()
    // Poraba: samo odhodi projekta, determinističen agregat.
    expect(body.materialConsumption.length).toBe(1)
    expect(body.materialConsumption[0].naziv).toBe('Alu Letvica')
    expect(body.materialConsumption[0].kolicina).toBe(-13)
    expect(body.materialConsumption[0].enota).toBe('m')
  })

  it('strop limit: limit=1 → 1 vrstica + total pravi', async () => {
    const stamp = `r147-cap-${Date.now()}`
    const projectId = await makeProject(stamp)
    const { token } = await createTestUserWithSession(`r147-cap-${Date.now()}`, 'MONTER')
    await evidencePost(req('/api/evidence', token, VALID_BODY(projectId), 'POST'))
    await evidencePost(req('/api/evidence', token, { scheduleId: await makeSchedule(projectId), lokacija: 'B', checklist: allChecked(), defects: [] }, 'POST'))
    const res = await evidenceGet(req(`/api/evidence?projectId=${projectId}&limit=1`, token))
    const body = (await res.json()) as { evidence: unknown[]; total: number; limit: number }
    expect(body.evidence.length).toBe(1)
    expect(body.total).toBe(2)
    expect(body.limit).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/evidence — posodobitve + dokaz predaje (zaklep)
// ---------------------------------------------------------------------------

describe('PATCH /api/evidence', () => {
  it('anon → 401; neznan id → 404', async () => {
    expect((await evidencePatch(req('/api/evidence', null, { id: 'x' }, 'PATCH'))).status).toBe(401)
    const { token } = await createTestUserWithSession(`r147-p1-${Date.now()}`, 'MONTER')
    const res = await evidencePatch(req('/api/evidence', token, { id: 'neobstaja', lokacija: 'x' }, 'PATCH'))
    expect(res.status).toBe(404)
  })

  it('predaja brez PRED/PO fotk → 409; NIČ spremenjeno (vrata PRED mutacijo)', async () => {
    const stamp = `r147-gate-${Date.now()}`
    const projectId = await makeProject(stamp)
    const { token } = await createTestUserWithSession(`r147-gate-${Date.now()}`, 'MONTER')
    const created = await evidencePost(req('/api/evidence', token, VALID_BODY(projectId), 'POST'))
    const { id } = (await created.json()) as { id: string }

    const res = await evidencePatch(req('/api/evidence', token, { id, handoverName: 'Jože Montažer' }, 'PATCH'))
    expect(res.status).toBe(409)
    const row = await db.installationEvidence.findUnique({ where: { id } })
    expect(row!.handoverAt).toBeNull()
    expect(row!.handoverName).toBeNull()
    expect(row!.lokacija).toBe('Kranj, Cesta 1') // nič spremenjeno
  })

  it('prazno handoverName → 400; veljavna predaja (s fotkami) → handoverAt + revizija _HANDOVER', async () => {
    const stamp = `r147-hand-${Date.now()}`
    const projectId = await makeProject(stamp)
    const { token } = await createTestUserWithSession(`r147-hand-${Date.now()}`, 'MONTER')
    const predPhoto = await makePhoto(projectId, 'PRED')
    const poPhoto = await makePhoto(projectId, 'PO')
    const created = await evidencePost(req('/api/evidence', token, VALID_BODY(projectId, {
      beforePhotoId: predPhoto, afterPhotoId: poPhoto,
    }), 'POST'))
    const { id } = (await created.json()) as { id: string }

    const empty = await evidencePatch(req('/api/evidence', token, { id, handoverName: '   ' }, 'PATCH'))
    expect(empty.status).toBe(400)

    const ok = await evidencePatch(req('/api/evidence', token, { id, handoverName: 'Ana Vodja' }, 'PATCH'))
    expect(ok.status).toBe(200)
    const row = await db.installationEvidence.findUnique({ where: { id } })
    expect(row!.handoverName).toBe('Ana Vodja')
    expect(row!.handoverAt).not.toBeNull()
    const audit = await db.auditLog.findFirst({ where: { akcija: 'INSTALLATION_EVIDENCE_HANDOVER', projectId } })
    expect(audit).not.toBeNull()
    expect(audit!.newValue).toContain('Ana Vodja')
    const flags = computeIEVFlags({
      beforePhotoId: row!.beforePhotoId,
      afterPhotoId: row!.afterPhotoId,
      checklistJson: row!.checklistJson,
      defectsJson: row!.defectsJson,
      handoverAt: row!.handoverAt,
      now: new Date(),
    })
    expect(flags.complete).toBe(true)
    expect(flags.locked).toBe(true)
  })

  it('zaklenjeno dokazilo → 409 za VSAK nadaljnji PATCH (tudi brez sprememb)', async () => {
    const stamp = `r147-lock-${Date.now()}`
    const projectId = await makeProject(stamp)
    const { token } = await createTestUserWithSession(`r147-lock-${Date.now()}`, 'MONTER')
    const predPhoto = await makePhoto(projectId, 'PRED')
    const poPhoto = await makePhoto(projectId, 'PO')
    const created = await evidencePost(req('/api/evidence', token, VALID_BODY(projectId, {
      beforePhotoId: predPhoto, afterPhotoId: poPhoto,
    }), 'POST'))
    const { id } = (await created.json()) as { id: string }
    await evidencePatch(req('/api/evidence', token, { id, handoverName: 'Ana Vodja' }, 'PATCH'))

    const res = await evidencePatch(req('/api/evidence', token, { id, lokacija: 'Nova lokacija' }, 'PATCH'))
    expect(res.status).toBe(409)
    const row = await db.installationEvidence.findUnique({ where: { id } })
    expect(row!.lokacija).toBe('Kranj, Cesta 1') // nič spremenjeno
  })

  it('navadna posodobitev (checklist/napake/GPS) → 200 + revizija INSTALLATION_EVIDENCE_UPDATED; neveljaven checklist → 400', async () => {
    const stamp = `r147-up-${Date.now()}`
    const projectId = await makeProject(stamp)
    const { token } = await createTestUserWithSession(`r147-up-${Date.now()}`, 'MONTER')
    const created = await evidencePost(req('/api/evidence', token, VALID_BODY(projectId), 'POST'))
    const { id } = (await created.json()) as { id: string }

    const bad = await evidencePatch(req('/api/evidence', token, { id, checklist: [{ key: 'pred_foto', checked: true }] }, 'PATCH'))
    expect(bad.status).toBe(400)

    const ok = await evidencePatch(req('/api/evidence', token, {
      id,
      checklist: allChecked().map((i) => (i.key === 'meritve' ? { ...i, checked: false, note: 'ni potreben' } : i)),
      defects: [{ opomba: 'Praska na letvici 3', reseno: false }],
      gps: { gpsConsent: true, gpsLat: 46.15, gpsLng: 14.5 },
    }, 'PATCH'))
    expect(ok.status).toBe(200)
    const row = await db.installationEvidence.findUnique({ where: { id } })
    expect(row!.checklistJson).toContain('ni potreben')
    expect(row!.defectsJson).toContain('Praska na letvici 3')
    expect(row!.gpsLat).toBe(46.15)
    const audit = await db.auditLog.findFirst({ where: { akcija: 'INSTALLATION_EVIDENCE_UPDATED', projectId } })
    expect(audit).not.toBeNull()
  })
})
