// ---------------------------------------------------------------------------
// R276 — testi: zgodovina verzij meritev (issue #16 §6; register #17-E).
// ---------------------------------------------------------------------------
//   • Lib (čiste funkcije, brez baze): izracunajNaslednjoVerzijo (O3),
//     izracunajKorenIdNaslednika (O3), izracunajDelti + formatirajDeltaMm
//     (O6), aktivnaVerzijaIzVerige (O5) — vključno z iskrenimi prazninami.
//   • POST /api/measurements: samostojna meritev = verzija 1 (O3); korekcija
//     = verzija predhodnik+1 + korenId + predhodnikId (O3); vir izpeljava
//     (O2: kontrakt ARCORE_DEPTH / brez arMetadata MANUAL / legacy null);
//     fail-closed meje (O4): 404 neznani predhodnik, 400 tuj projekt,
//     409 arhiviran predhodnik, 409 fork (P2002) — sekvenčno IN vzporedno;
//     ZERO-MUTACIJA neuspešnega fork-a (nič vrstic, nič audita).
//   • GET /api/measurements/[id]/verzije: celotna veriga z deltami med
//     sosedi, determinističen vrstni red, aktivna verzija (O5/O6/O8);
//     401 anon; ARHIVIRANA zadnja verzija = aktivnaId null (iskrena
//     praznina — nikoli padec nazaj).
//   • Audit: MEASUREMENT_VERSION z oldValue (predhodnik) + newValue
//     (deltaDolzinaMm/deltaVisinaMm/vir/predhodnikId + IZREČNO iskren
//     odvisniRezultati — O6/O7). Primer iz issue-ja: 3200 → 3450 → 3420 mm.
//
// Handlerji direktno, baza roksal_test prek globalSetup (vzorec R128–R275).
// Unikatni tag r276 za izolacijo.
import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import { POST as measurementsPost } from '@/app/api/measurements/route'
import { GET as verzijeGet } from '@/app/api/measurements/[id]/verzije/route'
import { PATCH as measurementPatch } from '@/app/api/measurements/[id]/route'
import {
  izracunajNaslednjoVerzijo,
  izracunajKorenIdNaslednika,
  izracunajDelti,
  formatirajDeltaMm,
  aktivnaVerzijaIzVerige,
  MERITEV_VIRI,
  MERITEV_VIR_LABELS,
  ODVISNI_REZULTATI_OPOMBA,
} from '@/lib/meritev-verzije'
import { isArContractPayload } from '@/lib/ar-contract'

const BASE = 'http://localhost/api'
const TAG = 'r276'

function jsonReq(token: string | null, body?: unknown, method = 'POST'): Request {
  return new Request(`${BASE}/measurements`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

function verzijeReq(id: string, token: string | null): Request {
  return new Request(`${BASE}/measurements/${id}/verzije`, {
    method: 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  })
}

function callVerzije(id: string, token: string | null): Promise<Response> {
  return verzijeGet(verzijeReq(id, token), { params: Promise.resolve({ id }) }) as unknown as Promise<Response>
}

function patchReq(id: string, token: string | null, body: unknown): Request {
  return new Request(`${BASE}/measurements/${id}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
}

function callPatch(id: string, token: string | null, body: unknown): Promise<Response> {
  return measurementPatch(patchReq(id, token, body), {
    params: Promise.resolve({ id }),
  }) as unknown as Promise<Response>
}

/** Veljaven minimalen kontrakt-payload (v1) — vzorec r274. */
function kontrakt(source = 'ARCORE_DEPTH'): Record<string, unknown> {
  return {
    contractVersion: 1,
    appVersion: 'BalkonAR 1.4.2',
    projectId: `balkonar-proj-${TAG}`,
    sessionId: `balkonar-ses-${TAG}`,
    source,
    units: 'mm',
    coordinateFrame: { type: 'LOCAL_NORMALIZED' },
    segments: [{ segmentId: `seg-${TAG}-a`, lengthMm: 3200, source }],
  }
}

async function makeProject(naziv: string): Promise<string> {
  const customer = await db.customer.create({
    data: { ime: `Stranka ${TAG} ${naziv} ${Date.now()}`, naslov: 'Test 1' },
  })
  const project = await db.project.create({
    data: { customerId: customer.id, nazivProjekta: naziv },
  })
  return project.id
}

type PostOdgovor = {
  id: string
  verzija: number | null
  korenId: string | null
  vir: string | null
  predhodnikId: string | null
  dolzinaMm: number
  visinaMm: number
}

async function postMeritev(
  token: string,
  projectId: string,
  dolzinaMm: number,
  visinaMm: number,
  extra: Record<string, unknown> = {},
): Promise<{ status: number; telo: PostOdgovor | { error: string } }> {
  const res = await measurementsPost(
    jsonReq(token, { projectId, dolzinaMm, visinaMm, ...extra })
  )
  const telo = (await res.json()) as PostOdgovor | { error: string }
  return { status: res.status, telo }
}

let adminToken: string

beforeEach(async () => {
  // Čistimo svoje teste po tagu r276 — unikatni nazivi/projekti/ključi.
  await db.measurement.deleteMany({ where: { project: { nazivProjekta: { contains: TAG } } } })
  await db.project.deleteMany({ where: { nazivProjekta: { contains: TAG } } })
  await db.customer.deleteMany({ where: { ime: { contains: TAG } } })
  await db.auditLog.deleteMany({ where: { OR: [{ akcija: { contains: 'MEASUREMENT' }, newValue: { contains: TAG } }, { newValue: { contains: `r276-proj` } }] } })
  adminToken = (await createTestUserWithSession(`${TAG}admin-${Date.now()}`, 'ADMIN')).token
})

// ===========================================================================
// 1. Lib — čiste deterministične funkcije (O3/O5/O6)
// ===========================================================================

describe('meritev-verzije lib (O3 — številčenje)', () => {
  it('izracunajNaslednjoVerzijo: legacy predhodnik (null) = implicitna v1 → korekcija v2', () => {
    expect(izracunajNaslednjoVerzijo(null)).toBe(2)
  })
  it('izracunajNaslednjoVerzijo: zaporedje 1 → 2 → 3 je strogo +1', () => {
    expect(izracunajNaslednjoVerzijo(1)).toBe(2)
    expect(izracunajNaslednjoVerzijo(2)).toBe(3)
    expect(izracunajNaslednjoVerzijo(5)).toBe(6)
  })
  it('izracunajKorenIdNaslednika: naslednik korena prevzame koren = predhodnik.id', () => {
    expect(izracunajKorenIdNaslednika({ id: 'koren-1', korenId: null })).toBe('koren-1')
  })
  it('izracunajKorenIdNaslednika: naslednik sredine verige prevzame obstoječi korenId', () => {
    expect(izracunajKorenIdNaslednika({ id: 'v2', korenId: 'koren-1' })).toBe('koren-1')
  })
})

describe('meritev-verzije lib (O6 — delte)', () => {
  it('izracunajDelti: issue primer 3200 → 3450 = +250 / 1200 → 1150 = −50', () => {
    expect(
      izracunajDelti({ dolzinaMm: 3200, visinaMm: 1200 }, { dolzinaMm: 3450, visinaMm: 1150 })
    ).toEqual({ deltaDolzinaMm: 250, deltaVisinaMm: -50 })
  })
  it('formatirajDeltaMm: ekspliziten znak, tudi pri nič', () => {
    expect(formatirajDeltaMm(250)).toBe('+250')
    expect(formatirajDeltaMm(-30)).toBe('-30')
    expect(formatirajDeltaMm(0)).toBe('+0')
  })
})

describe('meritev-verzije lib (O5 — aktivna verzija)', () => {
  it('prazna veriga ali samo legacy vrstice → null (iskrena praznina)', () => {
    expect(aktivnaVerzijaIzVerige([])).toBeNull()
    expect(aktivnaVerzijaIzVerige([{ id: 'a', verzija: null, status: 'OSNUTEK' }])).toBeNull()
  })
  it('najvišja verzija je aktivna (vrstni red vhoda ni pomemben)', () => {
    const veriga = [
      { id: 'v2', verzija: 2, status: 'OSNUTEK' },
      { id: 'v1', verzija: 1, status: 'POTRJENA' },
      { id: 'leg', verzija: null, status: 'OSNUTEK' },
    ]
    expect(aktivnaVerzijaIzVerige(veriga)).toEqual({ id: 'v2', verzija: 2 })
  })
  it('ARHIVIRANA zadnja verzija → null (NIKOLI padec nazaj na nižjo)', () => {
    const veriga = [
      { id: 'v1', verzija: 1, status: 'POTRJENA' },
      { id: 'v2', verzija: 2, status: 'ARHIVIRANA' },
    ]
    expect(aktivnaVerzijaIzVerige(veriga)).toBeNull()
  })
  it('ARHIVIRANA nižja verzija ne onemogoči višje aktivne', () => {
    const veriga = [
      { id: 'v1', verzija: 1, status: 'ARHIVIRANA' },
      { id: 'v2', verzija: 2, status: 'OSNUTEK' },
    ]
    expect(aktivnaVerzijaIzVerige(veriga)).toEqual({ id: 'v2', verzija: 2 })
  })
  it('viri: kontrakt enum in oznake so v pariteti (EN vir resnice)', () => {
    expect(MERITEV_VIRI).toEqual(['MANUAL', 'PHOTO_CV', 'ARCORE_DEPTH'])
    for (const vir of MERITEV_VIRI) {
      expect(typeof MERITEV_VIR_LABELS[vir]).toBe('string')
      expect(MERITEV_VIR_LABELS[vir].length).toBeGreaterThan(0)
    }
    // Kontraktni enum (ARCORE_DEPTH prvi) pokriva vsaj te tri vrednosti.
    expect(isArContractPayload({ contractVersion: 1 })).toBe(true)
    expect(ODVISNI_REZULTATI_OPOMBA).toContain('NI PONOVNO IZRAČUNANO')
  })
})

// ===========================================================================
// 2. POST /api/measurements — verzije + vir izpeljava (O2/O3)
// ===========================================================================

describe('POST /api/measurements — verzije (issue #16 §6)', () => {
  it('samostojna meritev: verzija 1, korenId null, predhodnikId null, vir MANUAL', async () => {
    const projectId = await makeProject(`r276-proj-a-${Date.now()}`)
    const { status, telo } = await postMeritev(adminToken, projectId, 3200, 1200)
    expect(status).toBe(201)
    const m = telo as PostOdgovor
    expect(m.verzija).toBe(1)
    expect(m.korenId).toBeNull()
    expect(m.predhodnikId).toBeNull()
    expect(m.vir).toBe('MANUAL')
  })

  it('korekcija: verzija = predhodnik+1, korenId = predhodnik.id, predhodnikId zapisan (O3)', async () => {
    const projectId = await makeProject(`r276-proj-b-${Date.now()}`)
    const prvi = (await postMeritev(adminToken, projectId, 3200, 1200)).telo as PostOdgovor
    const { status, telo } = await postMeritev(adminToken, projectId, 3450, 1150, {
      predhodnikId: prvi.id,
    })
    expect(status).toBe(201)
    const m = telo as PostOdgovor
    expect(m.verzija).toBe(2)
    expect(m.korenId).toBe(prvi.id)
    expect(m.predhodnikId).toBe(prvi.id)
    expect(m.vir).toBe('MANUAL')
  })

  it('issue primer 3200 → 3450 → 3420: veriga v1 → v2 → v3, delti +250 / −30', async () => {
    const projectId = await makeProject(`r276-proj-c-${Date.now()}`)
    const v1 = (await postMeritev(adminToken, projectId, 3200, 1200)).telo as PostOdgovor
    const v2 = (await postMeritev(adminToken, projectId, 3450, 1200, { predhodnikId: v1.id })).telo as PostOdgovor
    const v3 = (await postMeritev(adminToken, projectId, 3420, 1200, { predhodnikId: v2.id })).telo as PostOdgovor
    expect(v2.verzija).toBe(2)
    expect(v3.verzija).toBe(3)
    // Veriga prek v3 (sredina) = celotna veriga do v1 (O8).
    const res = await callVerzije(v3.id, adminToken)
    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      korenId: string | null
      aktivnaId: string | null
      aktivnaVerzija: number | null
      steviloVerzij: number
      verzije: Array<{
        id: string
        verzija: number | null
        deltaDolzinaMm: number | null
        deltaVisinaMm: number | null
      }>
    }
    expect(data.steviloVerzij).toBe(3)
    expect(data.korenId).toBe(v1.id)
    expect(data.aktivnaId).toBe(v3.id)
    expect(data.aktivnaVerzija).toBe(3)
    expect(data.verzije.map((v) => v.verzija)).toEqual([1, 2, 3])
    expect(data.verzije[1].deltaDolzinaMm).toBe(250)
    expect(data.verzije[2].deltaDolzinaMm).toBe(-30)
    expect(data.verzije[0].deltaDolzinaMm).toBeNull()
  })

  it('AR kontrakt payload: vir = source iz kanonične oblike (ARCORE_DEPTH) — O2', async () => {
    const projectId = await makeProject(`r276-proj-d-${Date.now()}`)
    const { status, telo } = await postMeritev(adminToken, projectId, 3200, 1200, {
      arMetadata: kontrakt('ARCORE_DEPTH'),
    })
    expect(status).toBe(201)
    expect((telo as PostOdgovor).vir).toBe('ARCORE_DEPTH')
  })

  it('AR kontrakt payload PHOTO_CV: vir sledi kontraktu, ne ugibanju', async () => {
    const projectId = await makeProject(`r276-proj-d2-${Date.now()}`)
    const { status, telo } = await postMeritev(adminToken, projectId, 3200, 1200, {
      arMetadata: kontrakt('PHOTO_CV'),
    })
    expect(status).toBe(201)
    expect((telo as PostOdgovor).vir).toBe('PHOTO_CV')
  })

  it('legacy arMetadata (brez contractVersion): vir null — iskrena praznina, ne ugibanje (O2)', async () => {
    const projectId = await makeProject(`r276-proj-e-${Date.now()}`)
    const { status, telo } = await postMeritev(adminToken, projectId, 3200, 1200, {
      arMetadata: { tipMeritve: 'RAZDALJA', lokacija: 'Sever' },
    })
    expect(status).toBe(201)
    expect((telo as PostOdgovor).vir).toBeNull()
  })

  it('klient NE more ponareljati vir — polje je strežniško izpeljano (O2)', async () => {
    const projectId = await makeProject(`r276-proj-f-${Date.now()}`)
    // vir v telesu je zod strip (ni v shemi) — odgovor nosi izpeljani MANUAL.
    const { status, telo } = await postMeritev(adminToken, projectId, 3200, 1200, {
      vir: 'ARCORE_DEPTH',
    } as Record<string, unknown>)
    expect(status).toBe(201)
    expect((telo as PostOdgovor).vir).toBe('MANUAL')
  })
})

// ===========================================================================
// 3. Fail-closed meje verige (O4)
// ===========================================================================

describe('POST /api/measurements — fail-closed verige (O4)', () => {
  it('neznani predhodnik → 404, nič zapisano', async () => {
    const projectId = await makeProject(`r276-proj-g-${Date.now()}`)
    const { status, telo } = await postMeritev(adminToken, projectId, 3200, 1200, {
      predhodnikId: 'ne-obstaja-r276',
    })
    expect(status).toBe(404)
    expect((telo as { error: string }).error).toContain('Predhodna meritev ne obstaja')
    const stevilo = await db.measurement.count({ where: { projectId } })
    expect(stevilo).toBe(0)
  })

  it('predhodnik drugega projekta → 400, nič zapisano', async () => {
    const projektA = await makeProject(`r276-proj-h1-${Date.now()}`)
    const projektB = await makeProject(`r276-proj-h2-${Date.now()}`)
    const tuj = (await postMeritev(adminToken, projektA, 3200, 1200)).telo as PostOdgovor
    const { status, telo } = await postMeritev(adminToken, projektB, 3450, 1200, {
      predhodnikId: tuj.id,
    })
    expect(status).toBe(400)
    expect((telo as { error: string }).error).toContain('drugemu projektu')
    const stB = await db.measurement.count({ where: { projectId: projektB } })
    expect(stB).toBe(0)
  })

  it('arhiviran predhodnik → 409 (arhiv se ne popravlja postrani — PATCH vrata ostajajo)', async () => {
    const projectId = await makeProject(`r276-proj-i-${Date.now()}`)
    const v1 = (await postMeritev(adminToken, projectId, 3200, 1200)).telo as PostOdgovor
    const arhiv = await callPatch(v1.id, adminToken, { status: 'ARHIVIRANA' })
    expect(arhiv.status).toBe(200)
    const { status, telo } = await postMeritev(adminToken, projectId, 3450, 1200, {
      predhodnikId: v1.id,
    })
    expect(status).toBe(409)
    expect((telo as { error: string }).error).toContain('Arhivirane meritve')
  })

  it('fork (predhodnik že ima naslednika) → 409; ZERO-MUTACIJA: nič vrstic, nič verzij-audita', async () => {
    const projectId = await makeProject(`r276-proj-j-${Date.now()}`)
    const v1 = (await postMeritev(adminToken, projectId, 3200, 1200)).telo as PostOdgovor
    await postMeritev(adminToken, projectId, 3450, 1200, { predhodnikId: v1.id })
    const prej = await db.measurement.count({ where: { projectId } })
    const prejAudit = await db.auditLog.count({ where: { akcija: 'MEASUREMENT_VERSION' } })

    const { status, telo } = await postMeritev(adminToken, projectId, 3500, 1200, {
      predhodnikId: v1.id,
    })
    expect(status).toBe(409)
    expect((telo as { error: string }).error).toContain('enojna veriga')
    const potem = await db.measurement.count({ where: { projectId } })
    expect(potem).toBe(prej)
    const potemAudit = await db.auditLog.count({ where: { akcija: 'MEASUREMENT_VERSION' } })
    expect(potemAudit).toBe(prejAudit)
  })

  it('vzporedni fork (Promise.all dveh korekcij istega predhodnika) → točno 1 uspešen (P2002 race)', async () => {
    const projectId = await makeProject(`r276-proj-k-${Date.now()}`)
    const v1 = (await postMeritev(adminToken, projectId, 3200, 1200)).telo as PostOdgovor
    const [a, b] = await Promise.all([
      postMeritev(adminToken, projectId, 3450, 1200, { predhodnikId: v1.id }),
      postMeritev(adminToken, projectId, 3500, 1200, { predhodnikId: v1.id }),
    ])
    const uspehi = [a, b].filter((r) => r.status === 201)
    const konflikti = [a, b].filter((r) => r.status === 409)
    expect(uspehi).toHaveLength(1)
    expect(konflikti).toHaveLength(1)
    const nasledniki = await db.measurement.count({ where: { predhodnikId: v1.id } })
    expect(nasledniki).toBe(1)
  })
})

// ===========================================================================
// 4. GET verzije — dostop + aktivna praznina (O5/O8)
// ===========================================================================

describe('GET /api/measurements/[id]/verzije — dostop + aktivna (O5/O8)', () => {
  it('anon brez žetona → 401 (fail-closed)', async () => {
    const projectId = await makeProject(`r276-proj-l-${Date.now()}`)
    const v1 = (await postMeritev(adminToken, projectId, 3200, 1200)).telo as PostOdgovor
    const res = await callVerzije(v1.id, null)
    expect(res.status).toBe(401)
  })

  it('neznana meritev → 404', async () => {
    const res = await callVerzije('ne-obstaja-r276', adminToken)
    expect(res.status).toBe(404)
  })

  it('ARHIVIRANA zadnja verzija → aktivnaId null (iskrena praznina, nikoli padec nazaj)', async () => {
    const projectId = await makeProject(`r276-proj-m-${Date.now()}`)
    const v1 = (await postMeritev(adminToken, projectId, 3200, 1200)).telo as PostOdgovor
    const v2 = (await postMeritev(adminToken, projectId, 3450, 1200, { predhodnikId: v1.id })).telo as PostOdgovor
    const arhiv = await callPatch(v2.id, adminToken, { status: 'ARHIVIRANA' })
    expect(arhiv.status).toBe(200)
    const res = await callVerzije(v1.id, adminToken)
    expect(res.status).toBe(200)
    const data = (await res.json()) as { aktivnaId: string | null; steviloVerzij: number; verzije: Array<{ verzija: number | null; status: string }> }
    expect(data.steviloVerzij).toBe(2)
    expect(data.aktivnaId).toBeNull()
    expect(data.verzije[1].status).toBe('ARHIVIRANA')
  })

  it('audit MEASUREMENT_VERSION: oldValue (predhodnik) + newValue (delta + odvisniRezultati) — O6/O7', async () => {
    const projectId = await makeProject(`r276-proj-n-${Date.now()}`)
    const v1 = (await postMeritev(adminToken, projectId, 3200, 1200)).telo as PostOdgovor
    await postMeritev(adminToken, projectId, 3450, 1150, { predhodnikId: v1.id })
    const audit = await db.auditLog.findFirst({
      where: { akcija: 'MEASUREMENT_VERSION', projectId },
      orderBy: { timestamp: 'desc' },
    })
    expect(audit).not.toBeNull()
    const stara = JSON.parse(audit!.oldValue ?? '{}') as { id: string; verzija: number | null; dolzinaMm: number; visinaMm: number }
    expect(stara).toEqual({ id: v1.id, verzija: 1, dolzinaMm: 3200, visinaMm: 1200 })
    const nova = JSON.parse(audit!.newValue ?? '{}') as {
      verzija: number
      deltaDolzinaMm: number
      deltaVisinaMm: number
      vir: string | null
      predhodnikId: string
      odvisniRezultati: string
    }
    expect(nova.verzija).toBe(2)
    expect(nova.deltaDolzinaMm).toBe(250)
    expect(nova.deltaVisinaMm).toBe(-50)
    expect(nova.predhodnikId).toBe(v1.id)
    expect(nova.vir).toBe('MANUAL')
    expect(nova.odvisniRezultati).toContain('NI PONOVNO IZRAČUNANO')
  })
})
