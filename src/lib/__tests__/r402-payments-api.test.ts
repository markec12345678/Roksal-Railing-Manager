// R402 — API TESTI PLAČIL + FINANČNEGA STROJA (issue #13 §19, korak R170).
// ---------------------------------------------------------------------------
// Handlerji direktno (vzorec R128/R155/R378), baza roksal_test prek
// globalSetup. Pokrivamo VRATA + KONTRAKT HTTP plasti:
//   (1) POST /api/payments: anon 401 · MONTER 403 (brez invoices.issue) ·
//       API ključ 403 (finančni uradni podatki — kanon R126) · VODJA 201 +
//       izpeljava statusa + audit;
//   (2) IDEMPOTENCA: isti Idempotency-Key → replay (ISTI odgovor, NILO
//       dvojnikov — exactly-once bančnega prometa);
//   (3) GET /api/payments: MONTER svoj projekt 200 / tuj 403 / brez
//       projectId 400;
//   (4) GET /api/payments/reconciliation: VODJA 200 s poročilom (izpeljava
//       + anomalije); MONTER tuj projekt 403;
//   (5) PATCH /api/invoices STROJ: OSNUTEK→POSLAN preskok 409 ·
//       IZDAN→POSLAN 200 (poslanoAt) · ročni PLACAN 409 z navodilom na
//       /api/payments · IZDAN→ZAPADLO 200;
//   (6) PATCH /api/payments/[id] prekinitev: MONTER 403 · VODJA 200 +
//       povratek statusa · dvojna 409;
//   (7) GET /api/invoices nosi strežniško izpeljavo placiloZnesek.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import { createApiKey } from '@/lib/password'
import { GET as invoicesGet, PATCH as invoicesPatch } from '@/app/api/invoices/route'
import { GET as paymentsGet, POST as paymentsPost } from '@/app/api/payments/route'
import { GET as paymentIdGet, PATCH as paymentIdPatch } from '@/app/api/payments/[id]/route'
import { GET as reconciliationGet } from '@/app/api/payments/reconciliation/route'

const BASE = 'http://localhost/api'
const OZNAKA = 'r400-api'

function jsonReq(
  path: string,
  token: string | null,
  init: { method?: string; body?: unknown; idempotencyKey?: string } = {},
): Request {
  return new Request(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.idempotencyKey ? { 'Idempotency-Key': init.idempotencyKey } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
}

let vodja: { user: { id: string }; token: string }
let monter: { user: { id: string }; token: string }
let tujMonter: { user: { id: string }; token: string }
let apiKljuc: string

async function narediProjekt(tag: string, monterId?: string): Promise<string> {
  const customer = await db.customer.create({
    data: { ime: `Stranka ${OZNAKA} ${tag} ${Date.now()}`, naslov: 'Test 1' },
  })
  const project = await db.project.create({
    data: {
      customerId: customer.id,
      nazivProjekta: `Projekt ${OZNAKA} ${tag} ${Date.now()}`,
      vodjaId: vodja.user.id,
      ...(monterId ? { monterId } : {}),
    },
  })
  return project.id
}

async function narediRacun(projectId: string, tag: string, znesek = 100, status = 'IZDAN'): Promise<string> {
  const racun = await db.invoice.create({
    data: {
      projectId,
      tip: 'RACUN',
      stevilka: `2026-R402A-${tag}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      rokPlacilaDni: 8,
      postavke: '[]',
      kupec: JSON.stringify({ ime: 'K', naslov: 'N' }),
      osnova: Math.round((znesek / 1.22) * 100) / 100,
      ddv: Math.round((znesek - znesek / 1.22) * 100) / 100,
      znesek,
      status,
    },
  })
  return racun.id
}

beforeAll(async () => {
  vodja = await createTestUserWithSession('r400-api-vodja', 'VODJA')
  monter = await createTestUserWithSession('r400-api-monter', 'MONTER')
  tujMonter = await createTestUserWithSession('r400-api-tuj', 'MONTER')
  const key = await createApiKey({ name: `vitest-r400-${Date.now()}`, purpose: 'test' })
  apiKljuc = key.key
})

afterAll(async () => {
  const projekti = await db.project.findMany({
    where: { nazivProjekta: { contains: OZNAKA } },
    select: { id: true },
  })
  const ids = projekti.map((p) => p.id)
  if (ids.length > 0) {
    await db.payment.deleteMany({ where: { projectId: { in: ids } } })
    await db.auditLog.deleteMany({ where: { projectId: { in: ids } } })
    await db.project.deleteMany({ where: { id: { in: ids } } })
  }
  await db.customer.deleteMany({ where: { ime: { contains: `Stranka ${OZNAKA}` } } })
  await db.apiKey.deleteMany({ where: { name: { startsWith: 'vitest-r400-' } } })
})

describe('R402 — POST /api/payments: vrata', () => {
  it('anon → 401; MONTER → 403 (brez invoices.issue); API ključ → 403 (finančni podatki)', async () => {
    const projectId = await narediProjekt('vrata')

    const anon = await paymentsPost(jsonReq('/payments', null, { method: 'POST', body: {} }))
    expect(anon.status).toBe(401)

    const monterRes = await paymentsPost(
      jsonReq('/payments', monter.token, {
        method: 'POST',
        body: { projectId, tip: 'PLACILO', znesek: 10, placanoAt: new Date().toISOString() },
      }),
    )
    expect(monterRes.status).toBe(403)

    const apiRes = await paymentsPost(
      jsonReq('/payments', apiKljuc, {
        method: 'POST',
        body: { projectId, tip: 'PLACILO', znesek: 10, placanoAt: new Date().toISOString() },
      }),
    )
    expect(apiRes.status).toBe(403)
    // forbidden() kanon: {error: 'Prepovedano', detail} — razlog je v detail (R241 fail-verbose)
    const apiTelo = (await apiRes.json()) as { error: string; detail: string }
    expect(apiTelo.error).toBe('Prepovedano')
    expect(apiTelo.detail).toContain('API ključ')
  })

  it('VODJA → 201 + izpeljava PLACAN + audita (PAYMENT_RECORDED + INVOICE_STATUS)', async () => {
    const projectId = await narediProjekt('happy')
    const racunId = await narediRacun(projectId, 'happy', 100)

    const res = await paymentsPost(
      jsonReq('/payments', vodja.token, {
        method: 'POST',
        body: {
          projectId,
          invoiceId: racunId,
          tip: 'PLACILO',
          znesek: 100,
          placanoAt: '2026-10-03T10:00:00Z',
          metoda: 'BANKA',
          referenca: 'SKLIC-TEST',
        },
      }),
    )
    expect(res.status).toBe(201)
    const telo = (await res.json()) as {
      payment: { id: string; status: string; znesek: number; allocations: unknown[] }
      spremembe: Array<{ from: string; to: string }>
    }
    expect(telo.payment.status).toBe('KNJIZENO')
    expect(telo.payment.znesek).toBe(100)
    expect(telo.payment.allocations).toHaveLength(1)
    expect(telo.spremembe[0]).toMatchObject({ from: 'IZDAN', to: 'PLACAN' })
    expect((await db.invoice.findUniqueOrThrow({ where: { id: racunId } })).status).toBe('PLACAN')

    const auditi = await db.auditLog.findMany({
      where: { projectId, akcija: { in: ['PAYMENT_RECORDED', 'INVOICE_STATUS'] } },
    })
    expect(auditi.map((a) => a.akcija).sort()).toEqual(['INVOICE_STATUS', 'PAYMENT_RECORDED'])
  })

  it('zod: 3. decimalka zneska → 400 (denarna politika R380 — ne tiho zaokrožimo)', async () => {
    const projectId = await narediProjekt('zod')
    await narediRacun(projectId, 'zod', 100)
    const res = await paymentsPost(
      jsonReq('/payments', vodja.token, {
        method: 'POST',
        body: { projectId, tip: 'PLACILO', znesek: 10.123, placanoAt: new Date().toISOString() },
      }),
    )
    expect(res.status).toBe(400)
  })
})

describe('R402 — POST /api/payments: idempotenca (exactly-once)', () => {
  it('isti Idempotency-Key → replay ISTEGA odgovora, NILO dvojnika plačila', async () => {
    const projectId = await narediProjekt('idem')
    const racunId = await narediRacun(projectId, 'idem', 100)
    const key = `r400-idem-${Date.now()}-test1234`
    const telo = {
      projectId,
      invoiceId: racunId,
      tip: 'PLACILO',
      znesek: 100,
      placanoAt: '2026-10-03T10:00:00Z',
    }

    const prvi = await paymentsPost(jsonReq('/payments', vodja.token, { method: 'POST', body: telo, idempotencyKey: key }))
    expect(prvi.status).toBe(201)
    const prviTelo = (await prvi.json()) as { payment: { id: string } }

    // Retry po mrežni napaki (isti ključ, isti principal):
    const drugi = await paymentsPost(jsonReq('/payments', vodja.token, { method: 'POST', body: telo, idempotencyKey: key }))
    expect(drugi.status).toBe(201)
    expect(drugi.headers.get('Idempotent-Replay')).toBe('true')
    const drugiTelo = (await drugi.json()) as { payment: { id: string } }
    expect(drugiTelo.payment.id).toBe(prviTelo.payment.id)

    // NOBENEGA dvojnika — točno ENO plačilo:
    const placila = await db.payment.findMany({ where: { projectId } })
    expect(placila).toHaveLength(1)
  })
})

describe('R402 — GET /api/payments + reconciliation: vrata branja', () => {
  it('brez projectId → 400; MONTER svoj projekt 200 / tuj 403', async () => {
    const projectId = await narediProjekt('branje', monter.user.id)
    const racunId = await narediRacun(projectId, 'branje', 100)
    await paymentsPost(
      jsonReq('/payments', vodja.token, {
        method: 'POST',
        body: { projectId, invoiceId: racunId, tip: 'PLACILO', znesek: 100, placanoAt: new Date().toISOString() },
      }),
    )

    const brez = await paymentsGet(jsonReq('/payments', vodja.token))
    expect(brez.status).toBe(400)

    const svoj = await paymentsGet(jsonReq(`/payments?projectId=${projectId}`, monter.token))
    expect(svoj.status).toBe(200)
    const placila = (await svoj.json()) as Array<{ znesek: number; allocations: unknown[] }>
    expect(placila).toHaveLength(1)
    expect(placila[0].znesek).toBe(100)

    const tuj = await paymentsGet(jsonReq(`/payments?projectId=${projectId}`, tujMonter.token))
    expect(tuj.status).toBe(403)
  })

  it('GET /api/payments/reconciliation: VODJA 200 s poročilom; MONTER tuj → 403', async () => {
    const projectId = await narediProjekt('uskladi', monter.user.id)
    const racunId = await narediRacun(projectId, 'uskladi', 100)
    await paymentsPost(
      jsonReq('/payments', vodja.token, {
        method: 'POST',
        body: {
          projectId,
          tip: 'PLACILO',
          znesek: 50,
          placanoAt: new Date().toISOString(),
          allocacije: [{ invoiceId: racunId, znesek: 30 }],
        },
      }),
    )

    const res = await reconciliationGet(jsonReq(`/payments/reconciliation?projectId=${projectId}`, vodja.token))
    expect(res.status).toBe(200)
    const porocilo = (await res.json()) as {
      racuni: Array<{ placiloZnesek: number; odprto: number; status: string }>
      anomalije: Array<{ koda: string }>
      povzetek: { skupajPlacilo: number }
    }
    expect(porocilo.racuni[0]).toMatchObject({ placiloZnesek: 30, odprto: 70, status: 'DELNO_PLACAN' })
    expect(porocilo.povzetek.skupajPlacilo).toBe(30)
    expect(porocilo.anomalije.map((a) => a.koda)).toContain('NEPORAZDELEJEN_OSTANEK')

    const tuj = await reconciliationGet(jsonReq(`/payments/reconciliation?projectId=${projectId}`, tujMonter.token))
    expect(tuj.status).toBe(403)
  })

  it('GET /api/payments/[id]: lastnik projekta 200, tuj → 403', async () => {
    const projectId = await narediProjekt('en', monter.user.id)
    const placilo = await paymentsPost(
      jsonReq('/payments', vodja.token, {
        method: 'POST',
        body: { projectId, tip: 'AVANS', znesek: 10, placanoAt: new Date().toISOString() },
      }),
    )
    const telo = (await placilo.json()) as { payment: { id: string } }

    const svoj = await paymentIdGet(jsonReq(`/payments/${telo.payment.id}`, monter.token), {
      params: Promise.resolve({ id: telo.payment.id }),
    })
    expect(svoj.status).toBe(200)

    const tuj = await paymentIdGet(jsonReq(`/payments/${telo.payment.id}`, tujMonter.token), {
      params: Promise.resolve({ id: telo.payment.id }),
    })
    expect(tuj.status).toBe(403)
  })
})

describe('R402 — PATCH /api/invoices: finančni statusni stroj', () => {
  it('OSNUTEK→POSLAN preskok 409; ročni PLACAN 409 z navodilom na /api/payments', async () => {
    const projectId = await narediProjekt('stroj')
    const osnutekId = await narediRacun(projectId, 'stroj-osn', 100, 'OSNUTEK')

    const preskok = await invoicesPatch(
      jsonReq('/invoices', vodja.token, { method: 'PATCH', body: { id: osnutekId, status: 'POSLAN' } }),
    )
    expect(preskok.status).toBe(409)

    const rocniPlacan = await invoicesPatch(
      jsonReq('/invoices', vodja.token, { method: 'PATCH', body: { id: osnutekId, status: 'PLACAN' } }),
    )
    expect(rocniPlacan.status).toBe(409)
    const telo = (await rocniPlacan.json()) as { error: string }
    expect(telo.error).toContain('/api/payments')
  })

  it('IZDAN→POSLAN 200 (poslanoAt); POSLAN→ZAPADLO 200; STORNIRAN iz POSLAN 200', async () => {
    const projectId = await narediProjekt('pot')
    const racunId = await narediRacun(projectId, 'pot-r', 100)

    const poslan = await invoicesPatch(
      jsonReq('/invoices', vodja.token, { method: 'PATCH', body: { id: racunId, status: 'POSLAN' } }),
    )
    expect(poslan.status).toBe(200)
    const poslanTelo = (await poslan.json()) as { status: string; poslanoAt: string | null }
    expect(poslanTelo.status).toBe('POSLAN')
    expect(poslanTelo.poslanoAt).not.toBeNull()

    const zapadlo = await invoicesPatch(
      jsonReq('/invoices', vodja.token, { method: 'PATCH', body: { id: racunId, status: 'ZAPADLO' } }),
    )
    expect(zapadlo.status).toBe(200)

    const storno = await invoicesPatch(
      jsonReq('/invoices', vodja.token, { method: 'PATCH', body: { id: racunId, status: 'STORNIRAN' } }),
    )
    expect(storno.status).toBe(200)

    // Audirani vsi trije prehodi (INVOICE_STATUS v isti transakciji):
    const auditi = await db.auditLog.findMany({
      where: { projectId, akcija: 'INVOICE_STATUS' },
      orderBy: { timestamp: 'asc' },
    })
    expect(auditi.map((a) => a.newValue)).toEqual(['POSLAN', 'ZAPADLO', 'STORNIRAN'])
  })
})

describe('R402 — PATCH /api/payments/[id]: prekinitev', () => {
  it('MONTER 403; VODJA 200 + povratek statusa; dvojna prekinitev 409', async () => {
    const projectId = await narediProjekt('prekini', monter.user.id)
    const racunId = await narediRacun(projectId, 'prekini-r', 100)
    const placilo = await paymentsPost(
      jsonReq('/payments', vodja.token, {
        method: 'POST',
        body: { projectId, invoiceId: racunId, tip: 'PLACILO', znesek: 100, placanoAt: new Date().toISOString() },
      }),
    )
    const telo = (await placilo.json()) as { payment: { id: string } }

    const monterRes = await paymentIdPatch(
      jsonReq('/payments', monter.token, { method: 'PATCH', body: { action: 'prekini', razlog: 'Test' } }),
      { params: Promise.resolve({ id: telo.payment.id }) },
    )
    expect(monterRes.status).toBe(403)

    const vodjaRes = await paymentIdPatch(
      jsonReq('/payments', vodja.token, { method: 'PATCH', body: { action: 'prekini', razlog: 'Knjižna napaka' } }),
      { params: Promise.resolve({ id: telo.payment.id }) },
    )
    expect(vodjaRes.status).toBe(200)
    const vodjaTelo = (await vodjaRes.json()) as {
      payment: { status: string; prekinitevRazlog: string }
      spremembe: Array<{ from: string; to: string }>
    }
    expect(vodjaTelo.payment.status).toBe('PREKINJENO')
    expect(vodjaTelo.payment.prekinitevRazlog).toBe('Knjižna napaka')
    expect(vodjaTelo.spremembe[0].from).toBe('PLACAN')
    expect(['IZDAN', 'POSLAN', 'ZAPADLO']).toContain(vodjaTelo.spremembe[0].to)

    const dvojna = await paymentIdPatch(
      jsonReq('/payments', vodja.token, { method: 'PATCH', body: { action: 'prekini', razlog: 'Še enkrat' } }),
      { params: Promise.resolve({ id: telo.payment.id }) },
    )
    expect(dvojna.status).toBe(409)
  })

  it('nediscipliniran vnos (actionSpotreba) → 400', async () => {
    const projectId = await narediProjekt('disc')
    const placilo = await paymentsPost(
      jsonReq('/payments', vodja.token, {
        method: 'POST',
        body: { projectId, tip: 'AVANS', znesek: 5, placanoAt: new Date().toISOString() },
      }),
    )
    const telo = (await placilo.json()) as { payment: { id: string } }
    const res = await paymentIdPatch(
      jsonReq('/payments', vodja.token, { method: 'PATCH', body: { action: 'brisi' } }),
      { params: Promise.resolve({ id: telo.payment.id }) },
    )
    expect(res.status).toBe(400)
  })
})

describe('R402 — GET /api/invoices: strežniška izpeljava placiloZnesek', () => {
  it('odgovor nosi placiloZnesek (vsota KNJIZENO allocacij) na vsaki vrstici', async () => {
    const projectId = await narediProjekt('izpeljava')
    const racunId = await narediRacun(projectId, 'izp', 100)
    await paymentsPost(
      jsonReq('/payments', vodja.token, {
        method: 'POST',
        body: {
          projectId,
          tip: 'PLACILO',
          znesek: 50,
          placanoAt: new Date().toISOString(),
          allocacije: [{ invoiceId: racunId, znesek: 40 }],
        },
      }),
    )

    const res = await invoicesGet(jsonReq(`/invoices?projectId=${projectId}`, vodja.token))
    expect(res.status).toBe(200)
    const vrstice = (await res.json()) as Array<{ id: string; placiloZnesek: number; status: string }>
    expect(vrstice).toHaveLength(1)
    expect(vrstice[0].placiloZnesek).toBe(40)
    expect(vrstice[0].status).toBe('DELNO_PLACAN')
  })
})
