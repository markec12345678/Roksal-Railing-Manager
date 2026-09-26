// ---------------------------------------------------------------------------
// R156 — testi: (1) P1 fix — /api/crm PATCH vrata + stroga validacija +
// prava revizija, (2) CSV Status stolpec (per-segment stebri izvoz) prek
// izvozne logike v komponenti ni direktno testirljiv — testiramo LIB vir
// (statusLabels jedro) posredno prek obstoječih lib testov; tu je API del.
// ---------------------------------------------------------------------------
//   • PATCH prej: SAMO prijava — SKLADISCE in API ključ lahko prepisala CRM
//     polja katerih koli strank; revizija userId 'system' brez oldValue;
//     status poljuben niz; neveljaven datum → Prisma 500.
//   • PATCH zdaj: canManageCustomers (customers.write — matrika §10), status
//     STROGO enum, datumi strogo parsani (→ 400), besedilni stropi, 404
//     neznana stranka PRED zapisom, revizija s pravim akterjem + oldValue.
//
// Handlerji direktno, baza roksal_test prek globalSetup (vzorec R153–R155).
import { describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import { PATCH as crmPatch, GET as crmGet } from '@/app/api/crm/route'

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

function patchReq(token: string | null, body: unknown): Promise<Response> {
  return crmPatch(jsonReq('/crm', token, { method: 'PATCH', body })) as unknown as Promise<Response>
}

async function makeCustomer(tag: string): Promise<string> {
  const c = await db.customer.create({
    data: { ime: `Stranka r156 ${tag} ${Date.now()}`, naslov: 'Test 1' },
  })
  return c.id
}

// ===========================================================================
// 1. Vrata (matrika §10 — canManageCustomers)
// ===========================================================================

describe('R156 — /api/crm PATCH: vrata customers.write (P1 fix)', () => {
  it('anon → 401', async () => {
    const res = await patchReq(null, { id: 'x', status: 'AKTIVEN' })
    expect(res.status).toBe(401)
  })

  it('SKLADISCE → 403 (matrika: samo customers.read)', async () => {
    const { token } = await createTestUserWithSession('r156-crm-sklad', 'SKLADISCE')
    const customerId = await makeCustomer('sklad')
    const res = await patchReq(token, { id: customerId, status: 'NEAKTIVEN' })
    expect(res.status).toBe(403)
    // fail-closed: baza NESPREMENJENA
    const after = await db.customer.findUnique({ where: { id: customerId } })
    expect(after?.status).toBe('AKTIVEN') // privzetek sheme
  })

  it('MONTER (customers.write po matriki) → 200', async () => {
    const { token } = await createTestUserWithSession('r156-crm-monter', 'MONTER')
    const customerId = await makeCustomer('monter')
    const res = await patchReq(token, { id: customerId, status: 'POTENCIALEN' })
    expect(res.status).toBe(200)
  })

  it('VODJA → 200', async () => {
    const { token } = await createTestUserWithSession('r156-crm-vodja', 'VODJA')
    const customerId = await makeCustomer('vodja')
    const res = await patchReq(token, { id: customerId, opombeCRM: 'vodja zapis' })
    expect(res.status).toBe(200)
  })
})

// ===========================================================================
// 2. Stroga validacija (fail-closed, nič tiho pokvarjeno)
// ===========================================================================

describe('R156 — /api/crm PATCH: stroga validacija', () => {
  it('brez id → 400; neznana stranka → 404 (prej: Prisma 500)', async () => {
    const { token } = await createTestUserWithSession('r156-crm-val', 'VODJA')
    expect((await patchReq(token, { status: 'AKTIVEN' })).status).toBe(400)
    expect((await patchReq(token, { id: 'r156-ne-obstaja', status: 'AKTIVEN' })).status).toBe(404)
  })

  it('poljuben status → 400 z izrecnim seznamom (prej: tiho zapisan niz)', async () => {
    const { token } = await createTestUserWithSession('r156-crm-st', 'VODJA')
    const customerId = await makeCustomer('status')
    const res = await patchReq(token, { id: customerId, status: 'POLJUBEN NIZ' })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('AKTIVEN, NEAKTIVEN, POTENCIALEN, ARHIVIRAN')
    // baza NESPREMENJENA
    const after = await db.customer.findUnique({ where: { id: customerId } })
    expect(after?.status).toBe('AKTIVEN')
  })

  it('neveljaven datum → 400 (prej: Prisma 500 ALI Invalid Date v bazi)', async () => {
    const { token } = await createTestUserWithSession('r156-crm-datum', 'VODJA')
    const customerId = await makeCustomer('datum')
    const res = await patchReq(token, { id: customerId, opomnikDatum: 'ni-datum' })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('opomnikDatum')
  })

  it('veljaven ISO datum → 200 + zapis v bazi; null → počisti', async () => {
    const { token } = await createTestUserWithSession('r156-crm-datum2', 'VODJA')
    const customerId = await makeCustomer('datum2')
    const ok = await patchReq(token, { id: customerId, opomnikDatum: '2026-10-01T08:00:00.000Z' })
    expect(ok.status).toBe(200)
    const after = await db.customer.findUnique({ where: { id: customerId } })
    expect(after?.opomnikDatum?.toISOString()).toBe('2026-10-01T08:00:00.000Z')
    const clear = await patchReq(token, { id: customerId, opomnikDatum: null })
    expect(clear.status).toBe(200)
    const cleared = await db.customer.findUnique({ where: { id: customerId } })
    expect(cleared?.opomnikDatum).toBeNull()
  })

  it('besedilni stropi → 400 z razlogom; ne-število tipov → 400', async () => {
    const { token } = await createTestUserWithSession('r156-crm-strop', 'VODJA')
    const customerId = await makeCustomer('strop')
    const presek = await patchReq(token, {
      id: customerId,
      opombeCRM: 'x'.repeat(2001),
    })
    expect(presek.status).toBe(400)
    const wrongType = await patchReq(token, { id: customerId, kontaktnaOseba: 12345 })
    expect(wrongType.status).toBe(400)
    // ne-število NE sme biti zapisano (prej: vsak tip šel skozi)
    const after = await db.customer.findUnique({ where: { id: customerId } })
    expect(after?.kontaktnaOseba).toBeNull()
  })
})

// ===========================================================================
// 3. Revizija — pravi akter + oldValue (prej: 'system', brez oldValue)
// ===========================================================================

describe('R156 — /api/crm PATCH: revizija CRM_UPDATE', () => {
  it('revizija nosi userId seje + oldValue s prejšnjim stanjem', async () => {
    const { token, user } = await createTestUserWithSession('r156-crm-rev', 'VODJA')
    const customerId = await makeCustomer('rev')
    await patchReq(token, { id: customerId, status: 'NEAKTIVEN', opombeCRM: 'prva opomba' })
    const audit = await db.auditLog.findFirst({
      where: { akcija: 'CRM_UPDATE', userId: user.id },
      orderBy: { timestamp: 'desc' },
    })
    expect(audit).not.toBeNull()
    expect(audit!.oldValue).toContain('"status":"AKTIVEN"') // stanje PRED
    expect(audit!.newValue).toContain('NEAKTIVEN') // sprememba vidna v novi vrednosti
    // v bazi je status res NEAKTIVEN
    const after = await db.customer.findUnique({ where: { id: customerId } })
    expect(after?.status).toBe('NEAKTIVEN')
  })
})

// ===========================================================================
// 4. GET nespremenjen (branje po matriki — vsak prijavljen; zanesljivost)
// ===========================================================================

describe('R156 — /api/crm GET: nespremenjeno obnašanje', () => {
  it('anon → 401; seznam vsebuje ustvarjeno stranko (oblika {customers, stats})', async () => {
    expect((await crmGet(jsonReq('/crm', null))).status).toBe(401)
    const { token } = await createTestUserWithSession('r156-crm-get', 'MONTER')
    const customerId = await makeCustomer('get')
    const res = await crmGet(jsonReq('/crm', token))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { customers: Array<{ id: string }>; stats: { skupno: number } }
    expect(Array.isArray(body.customers)).toBe(true)
    expect(body.customers.some((c) => c.id === customerId)).toBe(true)
    expect(typeof body.stats.skupno).toBe('number')
  })
})
