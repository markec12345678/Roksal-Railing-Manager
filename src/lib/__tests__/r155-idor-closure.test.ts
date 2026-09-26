// ---------------------------------------------------------------------------
// R155 — testi: (1) IDOR zaključek — /api/surveys, /api/qc, /api/punch,
// /api/evidence, /api/invoices GET (5 P1 popravkov iz R154 zapuščenega
// kandidata "(a) audit preostalih malih rut brez assertProjectAccess"),
// (2) regresijski stražar — projektne rute, ki vračajo projektne podatke,
// morajo preverjati dostop na ravni vira.
// ---------------------------------------------------------------------------
//   • /api/surveys: do R155 je ruta preverila SAMO prijavo — vsak
//     avtenticiran uporabnik je lahko bral/pregal (upsert) terenski pregled
//     TUJEGA projekta. Zdaj: GET → read, POST → update; neznani projekt →
//     404 (prej tihi Prisma FK → 500); tuj projekt → 403; baza NESPREMENJENA.
//   • /api/qc: GET/POST vrata (prej je dokumentirano "MONTER+" sploh ni bilo
//     uveljavljeno); vrata PRED transakcijo.
//   • /api/punch: vse štiri operacije (prej bral/dodal/spremenil/BRISAL po id
//     brez lastniške preverbe); neznana točka → 404 (prej P2025 → 500).
//   • /api/evidence: GET/POST vrata (prej samo 404 preverba brez lastništva).
//   • /api/invoices GET: MONTER z ?projectId= tujega projekta je prej OBŠEL
//     lastniški filter (preverjal se je SAMO brez parametra).
//
// Handlerji direktno, baza roksal_test prek globalSetup (vzorec R128/R140/
// R153/R154). Unikatni e-naslovi/imena izključno za izolacijo.
import { describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import { GET as surveysGet, POST as surveysPost } from '@/app/api/surveys/route'
import { GET as qcGet, POST as qcPost } from '@/app/api/qc/route'
import {
  GET as punchGet,
  POST as punchPost,
  PATCH as punchPatch,
  DELETE as punchDelete,
} from '@/app/api/punch/route'
import { GET as evidenceGet } from '@/app/api/evidence/route'
import { GET as invoicesGet } from '@/app/api/invoices/route'

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

/** Stranka + projekt z lastnikom (MONTER/VODJA na projektu — ProjectRef). */
async function makeProject(tag: string, monterId?: string): Promise<string> {
  const customer = await db.customer.create({
    data: { ime: `Stranka r155 ${tag} ${Date.now()}`, naslov: 'Test 1' },
  })
  const project = await db.project.create({
    data: {
      customerId: customer.id,
      nazivProjekta: `Projekt r155 ${tag} ${Date.now()}`,
      ...(monterId ? { monterId } : {}),
    },
  })
  return project.id
}

// ===========================================================================
// 1. /api/surveys — dostop na ravni vira
// ===========================================================================

describe('R155 — /api/surveys: vrata na ravni vira (P1 IDOR fix)', () => {
  it('anon → 401 (obe metodi)', async () => {
    const g = await surveysGet(jsonReq('/surveys?projectId=x', null))
    const p = await surveysPost(jsonReq('/surveys', null, { method: 'POST', body: {} }))
    expect(g.status).toBe(401)
    expect(p.status).toBe(401)
  })

  it('brez projectId → 400 (obe metodi)', async () => {
    const { token } = await createTestUserWithSession('r155-surv-a', 'VODJA')
    const g = await surveysGet(jsonReq('/surveys', token))
    const p = await surveysPost(
      jsonReq('/surveys', token, { method: 'POST', body: { tipObjekta: 'balkon' } }),
    )
    expect(g.status).toBe(400)
    expect(p.status).toBe(400)
  })

  it('neznani projekt → 404 (GET in POST; prej: tihi FK 500)', async () => {
    const { token } = await createTestUserWithSession('r155-surv-b', 'VODJA')
    const g = await surveysGet(jsonReq('/surveys?projectId=r155-ne-obstaja', token))
    expect(g.status).toBe(404)
    const p = await surveysPost(
      jsonReq('/surveys', token, {
        method: 'POST',
        body: { projectId: 'r155-ne-obstaja', tipObjekta: 'balkon' },
      }),
    )
    expect(p.status).toBe(404)
  })

  it('tuj MONTER: GET 403 in POST 403 + zapisnik TUJEGA projekta NESPREMENJEN', async () => {
    const owner = await createTestUserWithSession('r155-surv-owner', 'MONTER')
    const outsider = await createTestUserWithSession('r155-surv-out', 'MONTER')
    const projectId = await makeProject('survey-tuj', owner.user.id)
    const created = await surveysPost(
      jsonReq('/surveys', owner.token, {
        method: 'POST',
        body: { projectId, tipObjekta: 'balkon', opombe: 'original' },
      }),
    )
    expect(created.status).toBe(200)

    const g = await surveysGet(jsonReq(`/surveys?projectId=${projectId}`, outsider.token))
    expect(g.status).toBe(403)
    const p = await surveysPost(
      jsonReq('/surveys', outsider.token, {
        method: 'POST',
        body: { projectId, tipObjekta: 'terasa', opombe: 'PREGLASAN' },
      }),
    )
    expect(p.status).toBe(403)

    // fail-closed živo: baza NESPREMENJENA po 403
    const after = await db.siteSurvey.findUnique({ where: { projectId } })
    expect(after?.tipObjekta).toBe('balkon')
    expect(after?.opombe).toBe('original')
  })

  it('lastnik MONTER: GET 200 + POST upsert uspešen', async () => {
    const owner = await createTestUserWithSession('r155-surv-owner2', 'MONTER')
    const projectId = await makeProject('survey-moj', owner.user.id)
    const p = await surveysPost(
      jsonReq('/surveys', owner.token, {
        method: 'POST',
        body: { projectId, tipObjekta: 'stopnice', steviloStopnic: 12 },
      }),
    )
    expect(p.status).toBe(200)
    const g = await surveysGet(jsonReq(`/surveys?projectId=${projectId}`, owner.token))
    expect(g.status).toBe(200)
    const body = (await g.json()) as { tipObjekta: string; steviloStopnic: number }
    expect(body.tipObjekta).toBe('stopnice')
    expect(body.steviloStopnic).toBe(12)
  })
})

// ===========================================================================
// 2. /api/qc — dostop na ravni vira
// ===========================================================================

describe('R155 — /api/qc: vrata na ravni vira (P1 IDOR fix)', () => {
  // items = seznam {key, checked} v dolžini predloge qc-v1 (vse rešene).
  const VALID_ITEMS = [
    'dimenzije',
    'sidranje',
    'zakljucek_ral',
    'komponente',
    'steklo',
    'poravnava',
    'varnost',
    'fotografije',
    'napake',
    'korekcija',
  ].map((key) => ({ key, checked: true }))

  it('anon → 401 (obe metodi)', async () => {
    const g = await qcGet(jsonReq('/qc?projectId=x', null))
    const p = await qcPost(jsonReq('/qc', null, { method: 'POST', body: {} }))
    expect(g.status).toBe(401)
    expect(p.status).toBe(401)
  })

  it('tuj MONTER: GET 403; POST 403 + NIČ ni zapisano (tudi ne revizija)', async () => {
    const owner = await createTestUserWithSession('r155-qc-owner', 'MONTER')
    const outsider = await createTestUserWithSession('r155-qc-out', 'MONTER')
    const projectId = await makeProject('qc-tuj', owner.user.id)

    const g = await qcGet(jsonReq(`/qc?projectId=${projectId}`, outsider.token))
    expect(g.status).toBe(403)

    const before = await db.auditLog.count({ where: { projectId, akcija: 'QC_SUBMITTED' } })
    const p = await qcPost(
      jsonReq('/qc', outsider.token, {
        method: 'POST',
        body: { projectId, items: VALID_ITEMS },
      }),
    )
    expect(p.status).toBe(403)
    const after = await db.auditLog.count({ where: { projectId, akcija: 'QC_SUBMITTED' } })
    expect(after).toBe(before) // vrata PRED transakcijo — nič ni nastalo
    expect(await db.qualityControl.count({ where: { projectId } })).toBe(0)
  })

  it('lastnik MONTER: POST 201 + GET 200 z istim zapisom', async () => {
    const owner = await createTestUserWithSession('r155-qc-owner2', 'MONTER')
    const projectId = await makeProject('qc-moj', owner.user.id)
    const p = await qcPost(
      jsonReq('/qc', owner.token, { method: 'POST', body: { projectId, items: VALID_ITEMS } }),
    )
    expect(p.status).toBe(201)
    const g = await qcGet(jsonReq(`/qc?projectId=${projectId}`, owner.token))
    expect(g.status).toBe(200)
    const body = (await g.json()) as { qualityControl: { passed: boolean } | null }
    expect(body.qualityControl?.passed).toBe(true)
  })

  it('SKLADISCE lahko bere (material kontekst), a NE piše (403)', async () => {
    const owner = await createTestUserWithSession('r155-qc-owner3', 'MONTER')
    const skladisce = await createTestUserWithSession('r155-qc-sklad', 'SKLADISCE')
    const projectId = await makeProject('qc-sklad', owner.user.id)
    const g = await qcGet(jsonReq(`/qc?projectId=${projectId}`, skladisce.token))
    expect(g.status).toBe(200)
    const p = await qcPost(
      jsonReq('/qc', skladisce.token, { method: 'POST', body: { projectId, items: VALID_ITEMS } }),
    )
    expect(p.status).toBe(403)
  })
})

// ===========================================================================
// 3. /api/punch — dostop na ravni vira (vse štiri operacije)
// ===========================================================================

describe('R155 — /api/punch: vrata na ravni vira (P1 IDOR fix)', () => {
  it('anon → 401 (vse štiri metode)', async () => {
    expect((await punchGet(jsonReq('/punch?projectId=x', null))).status).toBe(401)
    expect((await punchPost(jsonReq('/punch', null, { method: 'POST', body: {} }))).status).toBe(401)
    expect(
      (await punchPatch(jsonReq('/punch', null, { method: 'PATCH', body: { id: 'x' } }))).status,
    ).toBe(401)
    expect((await punchDelete(jsonReq('/punch?id=x', null, { method: 'DELETE' }))).status).toBe(401)
  })

  it('brez projectId/id → 400 (GET/POST/DELETE)', async () => {
    const { token } = await createTestUserWithSession('r155-punch-a', 'VODJA')
    expect((await punchGet(jsonReq('/punch', token))).status).toBe(400)
    expect(
      (await punchPost(jsonReq('/punch', token, { method: 'POST', body: { naslov: 'x' } }))).status,
    ).toBe(400)
    expect((await punchDelete(jsonReq('/punch', token, { method: 'DELETE' }))).status).toBe(400)
  })

  it('neznana točka → 404 (PATCH in DELETE; prej: P2025 → 500)', async () => {
    const { token } = await createTestUserWithSession('r155-punch-b', 'VODJA')
    expect(
      (
        await punchPatch(
          jsonReq('/punch', token, { method: 'PATCH', body: { id: 'r155-ni-je', status: 'done' } }),
        )
      ).status,
    ).toBe(404)
    expect(
      (await punchDelete(jsonReq('/punch?id=r155-ni-je', token, { method: 'DELETE' }))).status,
    ).toBe(404)
  })

  it('tuj MONTER: GET 403, POST 403, PATCH 403 (status ostane), DELETE 403 (točka ostane)', async () => {
    const owner = await createTestUserWithSession('r155-punch-owner', 'MONTER')
    const outsider = await createTestUserWithSession('r155-punch-out', 'MONTER')
    const projectId = await makeProject('punch-tuj', owner.user.id)
    const item = await db.punchItem.create({
      data: { projectId, naslov: 'Točka lastnika', status: 'open' },
    })

    expect((await punchGet(jsonReq(`/punch?projectId=${projectId}`, outsider.token))).status).toBe(403)
    expect(
      (
        await punchPost(
          jsonReq('/punch', outsider.token, {
            method: 'POST',
            body: { projectId, naslov: 'TUJA točka' },
          }),
        )
      ).status,
    ).toBe(403)

    const patched = await punchPatch(
      jsonReq('/punch', outsider.token, { method: 'PATCH', body: { id: item.id, status: 'done' } }),
    )
    expect(patched.status).toBe(403)

    const deleted = await punchDelete(
      jsonReq(`/punch?id=${item.id}`, outsider.token, { method: 'DELETE' }),
    )
    expect(deleted.status).toBe(403)

    // fail-closed živo: status NESPREMENJEN, točka ŠE VEDNO obstaja, tujih točk ni
    const after = await db.punchItem.findUnique({ where: { id: item.id } })
    expect(after?.status).toBe('open')
    expect(after).not.toBeNull()
    expect(await db.punchItem.count({ where: { projectId, naslov: 'TUJA točka' } })).toBe(0)
  })

  it('lastnik: POST 201 → PATCH done → GET vidí vrstico → DELETE ok', async () => {
    const owner = await createTestUserWithSession('r155-punch-owner2', 'MONTER')
    const projectId = await makeProject('punch-moj', owner.user.id)
    const created = await punchPost(
      jsonReq('/punch', owner.token, { method: 'POST', body: { projectId, naslov: 'Moja točka' } }),
    )
    expect(created.status).toBe(201)
    const item = (await created.json()) as { id: string }
    const patched = await punchPatch(
      jsonReq('/punch', owner.token, { method: 'PATCH', body: { id: item.id, status: 'done' } }),
    )
    expect(patched.status).toBe(200)
    expect(((await patched.json()) as { status: string }).status).toBe('done')
    const list = await punchGet(jsonReq(`/punch?projectId=${projectId}`, owner.token))
    expect(((await list.json()) as unknown[]).length).toBe(1)
    expect((await punchDelete(jsonReq(`/punch?id=${item.id}`, owner.token, { method: 'DELETE' }))).status).toBe(200)
    expect(await db.punchItem.count({ where: { projectId } })).toBe(0)
  })
})

// ===========================================================================
// 4. /api/evidence — dostop na ravni vira (GET in POST vrata)
// ===========================================================================

describe('R155 — /api/evidence: vrata na ravni vira (P1 IDOR fix)', () => {
  it('anon → 401; brez projectId → 400', async () => {
    expect((await evidenceGet(jsonReq('/evidence?projectId=x', null))).status).toBe(401)
    const { token } = await createTestUserWithSession('r155-iev-a', 'VODJA')
    expect((await evidenceGet(jsonReq('/evidence', token))).status).toBe(400)
  })

  it('tuj MONTER: GET 403 (prej: 200 s podatki tujega projekta)', async () => {
    const owner = await createTestUserWithSession('r155-iev-owner', 'MONTER')
    const outsider = await createTestUserWithSession('r155-iev-out', 'MONTER')
    const projectId = await makeProject('iev-tuj', owner.user.id)
    const g = await evidenceGet(jsonReq(`/evidence?projectId=${projectId}`, outsider.token))
    expect(g.status).toBe(403)
    const body = (await g.json()) as { error: string }
    expect(body.error).toBe('Dostop do projekta ni dovoljen')
  })

  it('lastnik MONTER: GET 200 (prazen seznam je resnično prazen)', async () => {
    const owner = await createTestUserWithSession('r155-iev-owner2', 'MONTER')
    const projectId = await makeProject('iev-moj', owner.user.id)
    const g = await evidenceGet(jsonReq(`/evidence?projectId=${projectId}`, owner.token))
    expect(g.status).toBe(200)
    const body = (await g.json()) as { evidence: unknown[] }
    expect(Array.isArray(body.evidence)).toBe(true)
  })
})

// ===========================================================================
// 5. /api/invoices GET — ?projectId= ne more več obiti lastniških vrata
// ===========================================================================

describe('R155 — /api/invoices GET: ?projectId= bypass zaprt (P1 IDOR fix)', () => {
  it('anon → 401', async () => {
    expect((await invoicesGet(jsonReq('/invoices', null))).status).toBe(401)
  })

  it('MONTER z ?projectId= TUJEGA projekta → 403 (prej: 200 s tujimi računi)', async () => {
    const owner = await createTestUserWithSession('r155-inv-owner', 'MONTER')
    const outsider = await createTestUserWithSession('r155-inv-out', 'MONTER')
    const projectId = await makeProject('inv-tuj', owner.user.id)
    const customer = await db.customer.findFirst({ where: { ime: { startsWith: 'Stranka r155 inv-tuj' } } })
    await db.invoice.create({
      data: {
        projectId,
        tip: 'PREDRACUN',
        stevilka: `2026-RT${Date.now()}`,
        rokPlacilaDni: 30,
        postavke: '[]',
        kupec: JSON.stringify({ ime: customer?.ime ?? 'x', naslov: 'y', telefon: null, email: null }),
        osnova: 100,
        ddv: 22,
        znesek: 122,
        status: 'OSNUTEK',
      },
    })
    const res = await invoicesGet(jsonReq(`/invoices?projectId=${projectId}`, outsider.token))
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('Dostop do projekta ni dovoljen')
  })

  it('MONTER z ?projectId= svojega projekta → 200 samo svoji računi; neznani → 404', async () => {
    const owner = await createTestUserWithSession('r155-inv-owner2', 'MONTER')
    const projectId = await makeProject('inv-moj', owner.user.id)
    const res = await invoicesGet(jsonReq(`/invoices?projectId=${projectId}`, owner.token))
    expect(res.status).toBe(200)
    const body = (await res.json()) as unknown[]
    expect(Array.isArray(body)).toBe(true)
    expect((await invoicesGet(jsonReq('/invoices?projectId=r155-ne-obstaja', owner.token))).status).toBe(404)
  })
})

// ===========================================================================
// 6. Regresijski stražar — VSE projektne rute morajo imeti vrata
// ===========================================================================

describe('R155 — regresijski stražar: projektne rute preverjajo assertProjectAccess', () => {
  const PROJECT_ROUTES = [
    'src/app/api/measurements/route.ts',
    'src/app/api/measurements/[id]/route.ts',
    'src/app/api/slopes/route.ts',
    'src/app/api/surveys/route.ts',
    'src/app/api/qc/route.ts',
    'src/app/api/punch/route.ts',
    'src/app/api/evidence/route.ts',
    'src/app/api/sketches/route.ts',
    'src/app/api/photos/route.ts',
  ]

  it.each(PROJECT_ROUTES)(
    '%s vsebuje assertProjectAccess (IDOR stražar — kršitev = rdeči test)',
    async (rel) => {
      const { readFileSync } = await import('node:fs')
      const { resolve } = await import('node:path')
      const src = readFileSync(resolve(process.cwd(), rel), 'utf8')
      expect(src).toContain('assertProjectAccess')
    },
  )
})
