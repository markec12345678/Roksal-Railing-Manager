// ---------------------------------------------------------------------------
// R154 — testi: (1) status meritev kot čisto jedro + strežniški filter,
// (2) P1 bug fix — /api/slopes dostop na ravni vira.
// ---------------------------------------------------------------------------
//   • lib/measurement-status: stroga validacija (fail-closed, nič ugibanja)
//     + deterministični števec (brez statusa = iskren OSNUTEK privzetek
//     migracijskega backfilla R153; vrstni red vnosa ne vpliva na rezultat).
//   • GET /api/measurements?status= — R153 indeks (projectId, status) dobi
//     rabo: neznana vrednost → 400 z izrecnim razlogom; veljavna → samo te
//     vrstice; brez parametra → nespremenjeno obnašanje; anon → 401.
//   • /api/slopes P1 fix: do R154 je GET/POST preveril SAMO prijavo — vsak
//     avtenticiran uporabnik je lahko bral/pisal nagibe TUJEGA projekta.
//     Zdaj: GET → read, POST → update (isti prag kot meritve); neznani
//     projekt → 404; tuj projekt → 403; NIČ zapisano pred vrati (fail-closed).
//
// Handlerji direktno, baza roksal_test prek globalSetup (vzorec R128/R139/
// R140/R153). Brez AI pri odločitvah; unikatni e-naslovi/ime izključno za
// izolacijo.
import { describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import {
  MEASUREMENT_STATUS_VALUES,
  isValidMeasurementStatus,
  measurementStatusCounts,
} from '@/lib/measurement-status'
import { POST as measurementsPost, GET as measurementsGet } from '@/app/api/measurements/route'
import { PATCH as measurementPatch } from '@/app/api/measurements/[id]/route'
import { GET as slopesGet, POST as slopesPost } from '@/app/api/slopes/route'

const BASE = 'http://localhost/api'

function jsonReq(
  path: string,
  token: string | null,
  init: { method?: string; body?: unknown } = {},
): Request {
  return new Request(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
}

/** Next 16 [id] ruta: handler potrebuje TUDI context ({ params: Promise }). */
function callPatch(id: string, token: string | null, body: unknown): Promise<Response> {
  return measurementPatch(
    jsonReq(`/measurements/${id}`, token, { method: 'PATCH', body }),
    { params: Promise.resolve({ id }) },
  ) as unknown as Promise<Response>
}

/** Stranka + projekt (vzorec R140/R153 — unikatno za izolacijo). */
async function makeProject(tag: string): Promise<{ projectId: string }> {
  const customer = await db.customer.create({
    data: { ime: `Stranka r154 ${tag} ${Date.now()}`, naslov: 'Test 1' },
  })
  const project = await db.project.create({
    data: { customerId: customer.id, nazivProjekta: `Projekt r154 ${tag}` },
  })
  return { projectId: project.id }
}

// ===========================================================================
// 1. lib/measurement-status — stroga validacija + deterministični števec
// ===========================================================================

describe('R154 — lib/measurement-status: isValidMeasurementStatus (stroga, fail-closed)', () => {
  it('veljavne vrednosti: natanko tri konstante iz MEASUREMENT_STATUS_VALUES', () => {
    expect(MEASUREMENT_STATUS_VALUES).toEqual(['OSNUTEK', 'POTRJENA', 'ARHIVIRANA'])
    for (const v of MEASUREMENT_STATUS_VALUES) {
      expect(isValidMeasurementStatus(v)).toBe(true)
    }
  })

  it('neveljavne vrednosti: mala črka, presledki, prazno, sorodne besede, napačni tipi', () => {
    expect(isValidMeasurementStatus('osnutek')).toBe(false) // nič pretvarjanja
    expect(isValidMeasurementStatus(' OSNUTEK')).toBe(false) // presledek spredaj
    expect(isValidMeasurementStatus('OSNUTEK ')).toBe(false) // presledek zadaj
    expect(isValidMeasurementStatus('')).toBe(false)
    expect(isValidMeasurementStatus('VSE')).toBe(false) // UI filter NI status
    expect(isValidMeasurementStatus('IZBRISANA')).toBe(false) // brisanje ne obstaja
    expect(isValidMeasurementStatus('POTRJEN')).toBe(false) // skoraj-enako
    expect(isValidMeasurementStatus(null)).toBe(false)
    expect(isValidMeasurementStatus(undefined)).toBe(false)
    expect(isValidMeasurementStatus(42)).toBe(false)
    expect(isValidMeasurementStatus({})).toBe(false)
    expect(isValidMeasurementStatus(['OSNUTEK'])).toBe(false)
  })
})

describe('R154 — lib/measurement-status: measurementStatusCounts (determinističen)', () => {
  it('prazen seznam → vsa tri vedra na 0', () => {
    expect(measurementStatusCounts([])).toEqual({ OSNUTEK: 0, POTRJENA: 0, ARHIVIRANA: 0 })
  })

  it('brez/null status → OSNUTEK vedro (iskren privzetek backfilla R153)', () => {
    const counts = measurementStatusCounts([
      { status: null },
      { status: undefined },
      {}, // sploh brez polja
      { status: 'nekaj neznanega' },
    ])
    expect(counts).toEqual({ OSNUTEK: 4, POTRJENA: 0, ARHIVIRANA: 0 })
  })

  it('veljavne vrednosti grejo v svoja vedra', () => {
    const counts = measurementStatusCounts([
      { status: 'OSNUTEK' },
      { status: 'OSNUTEK' },
      { status: 'POTRJENA' },
      { status: 'ARHIVIRANA' },
      { status: 'ARHIVIRANA' },
      { status: 'ARHIVIRANA' },
    ])
    expect(counts).toEqual({ OSNUTEK: 2, POTRJENA: 1, ARHIVIRANA: 3 })
  })

  it('determinizem: ista množica 100× in v obrnjenem vrstnem red → isti rezultat', () => {
    const rows = [
      { status: 'OSNUTEK' },
      { status: 'POTRJENA' },
      { status: 'ARHIVIRANA' },
      { status: null },
      { status: 'POTRJENA' },
    ]
    const baseline = measurementStatusCounts(rows)
    for (let i = 0; i < 100; i++) {
      expect(measurementStatusCounts(rows)).toEqual(baseline)
    }
    expect(measurementStatusCounts([...rows].reverse())).toEqual(baseline)
  })
})

// ===========================================================================
// 2. GET /api/measurements?status= — strežniški filter (R153 indeks)
// ===========================================================================

describe('R154 — GET /api/measurements?status= strežniški filter', () => {
  it('anon z ?status= → 401 (vrata ostajajo na robu)', async () => {
    const res = await measurementsGet(jsonReq('/measurements?projectId=x&status=POTRJENA', null))
    expect(res.status).toBe(401)
  })

  it('neznana vrednost → 400 z izrecnim razlogom (fail-closed, ne tiho prazno)', async () => {
    const { token } = await createTestUserWithSession(`r154-badstatus-${Date.now()}`, 'VODJA')
    const { projectId } = await makeProject('badstatus')
    const res = await measurementsGet(jsonReq(`/measurements?projectId=${projectId}&status=potrjena`, token))
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error?: string }
    expect(body.error).toContain('Neveljaven status')
    expect(body.error).toContain('OSNUTEK')
    expect(body.error).toContain('ARHIVIRANA')
  })

  it('veljaven filter vrne SAMO ustrezne vrstice; brez parametra vse (nespremenjeno)', async () => {
    const { token } = await createTestUserWithSession(`r154-filter-${Date.now()}`, 'VODJA')
    const { projectId } = await makeProject('filter')
    const post1 = await measurementsPost(
      jsonReq('/measurements', token, {
        method: 'POST',
        body: { projectId, dolzinaMm: 2000, visinaMm: 1100 },
      })
    )
    expect(post1.status).toBe(201)
    const created1 = (await post1.json()) as { id: string }
    const post2 = await measurementsPost(
      jsonReq('/measurements', token, {
        method: 'POST',
        body: { projectId, dolzinaMm: 3000, visinaMm: 1200 },
      })
    )
    expect(post2.status).toBe(201)
    const created2 = (await post2.json()) as { id: string }

    // ena → POTRJENA
    const patch = await callPatch(created2.id, token, { status: 'POTRJENA' })
    expect(patch.status).toBe(200)

    // ?status=POTRJENA → samo potrjena
    const confirmed = await measurementsGet(jsonReq(`/measurements?projectId=${projectId}&status=POTRJENA`, token))
    expect(confirmed.status).toBe(200)
    const confirmedList = (await confirmed.json()) as Array<{ id: string; status: string }>
    expect(confirmedList).toHaveLength(1)
    expect(confirmedList[0].id).toBe(created2.id)
    expect(confirmedList[0].status).toBe('POTRJENA')

    // ?status=OSNUTEK → samo osnutek
    const drafts = await measurementsGet(jsonReq(`/measurements?projectId=${projectId}&status=OSNUTEK`, token))
    expect(drafts.status).toBe(200)
    const draftsList = (await drafts.json()) as Array<{ id: string }>
    expect(draftsList).toHaveLength(1)
    expect(draftsList[0].id).toBe(created1.id)

    // brez parametra → obe (nazaj-združljivo obnašanje)
    const all = await measurementsGet(jsonReq(`/measurements?projectId=${projectId}`, token))
    expect(all.status).toBe(200)
    const allList = (await all.json()) as Array<{ id: string }>
    expect(allList).toHaveLength(2)

    // ?status=ARHIVIRANA → prazen seznam je RESNIČNO prazen (nobena ni arhivirana)
    const archived = await measurementsGet(jsonReq(`/measurements?projectId=${projectId}&status=ARHIVIRANA`, token))
    expect(archived.status).toBe(200)
    expect((await archived.json()) as unknown[]).toEqual([])
  })

  it('SKLADISCE lahko BERE z filtrom (read dovoljen po matriki); vrata za pisanje ostajajo (r153)', async () => {
    const { token } = await createTestUserWithSession(`r154-owner-${Date.now()}`, 'VODJA')
    const { projectId } = await makeProject('skladisce-filter')
    const { token: skladisceToken } = await createTestUserWithSession(
      `r154-skladisce-${Date.now()}`,
      'SKLADISCE'
    )
    // SKLADISCE sme brati vse projekte (material kontekst — access matrika),
    // zato GET z ?status= → 200; filter NE razširi pravic (samo zoži izbor).
    const res = await measurementsGet(jsonReq(`/measurements?projectId=${projectId}&status=POTRJENA`, skladisceToken))
    expect(res.status).toBe(200)
    // kontrola: brez filtra prav tako 200 (matrika nespremenjena)
    const plain = await measurementsGet(jsonReq(`/measurements?projectId=${projectId}`, skladisceToken))
    expect(plain.status).toBe(200)
    // pisanje (PATCH statusa) ostaje 403 tudi z dostopom do branja — vzorec r153
    const post = await measurementsPost(
      jsonReq('/measurements', token, {
        method: 'POST',
        body: { projectId, dolzinaMm: 2100, visinaMm: 1150 },
      })
    )
    expect(post.status).toBe(201)
    const created = (await post.json()) as { id: string }
    const patch = await callPatch(created.id, skladisceToken, { status: 'POTRJENA' })
    expect(patch.status).toBe(403)
    // owner z istim filtrom gre skozi (kontrola, da bralni dostop deluje)
    const own = await measurementsGet(jsonReq(`/measurements?projectId=${projectId}&status=OSNUTEK`, token))
    expect(own.status).toBe(200)
    expect(((await own.json()) as unknown[]).length).toBeGreaterThanOrEqual(1)
  })
})

// ===========================================================================
// 3. P1 bug fix — /api/slopes dostop na ravni vira
// ===========================================================================

describe('R154 — P1 fix: /api/slopes assertProjectAccess', () => {
  it('anon GET/POST → 401 (vrata ostajajo na robu)', async () => {
    const get = await slopesGet(jsonReq('/slopes?projectId=x', null))
    expect(get.status).toBe(401)
    const post = await slopesPost(jsonReq('/slopes', null, { method: 'POST', body: { projectId: 'x', kotStopinje: 1.5 } }))
    expect(post.status).toBe(401)
  })

  it('GET brez projectId → 400; POST brez projectId → 400 (izrecno, ne 500)', async () => {
    const { token } = await createTestUserWithSession(`r154-slope-400-${Date.now()}`, 'VODJA')
    const get = await slopesGet(jsonReq('/slopes', token))
    expect(get.status).toBe(400)
    const post = await slopesPost(jsonReq('/slopes', token, { method: 'POST', body: { kotStopinje: 1.5 } }))
    expect(post.status).toBe(400)
  })

  it('POST z ne-številčnim kotStopinje → 400 (izrecna validacija, ne tihi NaN zapis)', async () => {
    const { token } = await createTestUserWithSession(`r154-slope-nan-${Date.now()}`, 'VODJA')
    const { projectId } = await makeProject('slope-nan')
    const post = await slopesPost(
      jsonReq('/slopes', token, { method: 'POST', body: { projectId, kotStopinje: 'abc' } })
    )
    expect(post.status).toBe(400)
    const body = (await post.json()) as { error?: string }
    expect(body.error).toContain('kotStopinje')
    const rows = await db.slope.findMany({ where: { projectId } })
    expect(rows).toHaveLength(0) // NIČ zapisano
  })

  it('TUJ projekt: neprijavajen MONTER (ni lastnik) → GET 403 + POST 403, NIČ zapisano (fail-closed)', async () => {
    // projekt pripada VODJI (monterId ni nastavljen)
    const { token: ownerToken } = await createTestUserWithSession(`r154-slope-owner-${Date.now()}`, 'VODJA')
    const { projectId } = await makeProject('slope-403')

    const { token: monterToken } = await createTestUserWithSession(`r154-slope-monter-${Date.now()}`, 'MONTER')

    const foreignGet = await slopesGet(jsonReq(`/slopes?projectId=${projectId}`, monterToken))
    expect(foreignGet.status).toBe(403)

    const foreignPost = await slopesPost(
      jsonReq('/slopes', monterToken, {
        method: 'POST',
        body: { projectId, kotStopinje: 3.4, smer: 'Y', lokacija: 'Tuj zapis' },
      })
    )
    expect(foreignPost.status).toBe(403)

    // Vrata PRED mutacijo: po 403 je baza še vedno prazna (prej: P1 — zapis je šel skozi)
    const rows = await db.slope.findMany({ where: { projectId } })
    expect(rows).toHaveLength(0)

    // lastnik (VODJA = manager) dostopa normalno — kontrola, da vrata niso preširoka
    const ownPost = await slopesPost(
      jsonReq('/slopes', ownerToken, {
        method: 'POST',
        body: { projectId, kotStopinje: 2.5, smer: 'Y', lokacija: 'Talna plošča balkona' },
      })
    )
    expect(ownPost.status).toBe(201)
    const ownGet = await slopesGet(jsonReq(`/slopes?projectId=${projectId}`, ownerToken))
    expect(ownGet.status).toBe(200)
    const ownList = (await ownGet.json()) as Array<{ id: string; kotStopinje: number }>
    expect(ownList).toHaveLength(1)
    expect(ownList[0].kotStopinje).toBe(2.5)
  })

  it('neznani projectId → 404 (assertProjectAccess na null projektu)', async () => {
    const { token } = await createTestUserWithSession(`r154-slope-404-${Date.now()}`, 'VODJA')
    const get = await slopesGet(jsonReq('/slopes?projectId=r154-ne-obstaja', token))
    expect(get.status).toBe(404)
    const post = await slopesPost(
      jsonReq('/slopes', token, { method: 'POST', body: { projectId: 'r154-ne-obstaja', kotStopinje: 1 } })
    )
    expect(post.status).toBe(404)
  })
})
