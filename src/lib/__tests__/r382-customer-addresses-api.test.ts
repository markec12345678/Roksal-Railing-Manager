// R382 — /api/customer-addresses + /api/customers/[id] API POGODBA
// (issue #13, korak R169 iz §13 — ločitev naslovov stranke).
// ---------------------------------------------------------------------------
//   • POST 201: tip iz nabora; VEČ MONTAZNI naslovov je dovoljenih (upravniki
//     imajo več objektov);
//   • POST fail-closed: neznan tip 400 (EXACT kanon §5 — 'kontaktni' ali
//     'POSTNI' NE gresta skozi); manjkajoč customerId 400; tuja stranka 404;
//     prekratki naslov 400;
//   • PRIVZETOST: nov privzeti KONTAKTNI demote-a starega V ISTI transakciji
//     (eden na stranko+tip) + LEGACY SINHRON Customer.naslov (flat prikazno
//     polje — mobilni klienti/PDF, kanon §1);
//   • PATCH: posodobitev naslova privzetega KONTAKTNI → legacy sinhron;
//     preklop jePrivzet demote-a prejšnjega;
//   • DELETE privzetega KONTAKTNI → legacy naslov pade na najstarejši
//     preostali KONTAKTNI (če obstaja);
//   • GET brez customerId 400; s customerId → razdelitev PO TIPIH
//     (KONTAKTNI/RACUNSKI/MONTAZNI);
//   • GET /api/customers/[id] detajl: naslovi razdeljeni + priložnosti +
//     števci; 404 za tujo stranko;
//   • RBAC: SKLADISCE POST → 403.
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import * as addrRoute from '@/app/api/customer-addresses/route'
import * as addrIdRoute from '@/app/api/customer-addresses/[id]/route'
import * as customerIdRoute from '@/app/api/customers/[id]/route'

const BASE = 'http://localhost'
let counter = 0
const uniq = (p: string) => `${p}-${Date.now()}-${(counter += 1)}`

function req(path: string, token: string, method: 'POST' | 'PATCH' | 'GET' | 'DELETE', body?: Record<string, unknown>): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, origin: BASE },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

describe('R382 — /api/customer-addresses (§13 ločitev naslovov)', () => {
  let token: string
  let vodjaId: string
  let customerId: string
  const addressIds: string[] = []
  const oppIds: string[] = []

  beforeEach(async () => {
    const uporabnik = await createTestUserWithSession(uniq('r381addrvodja'), 'VODJA')
    token = uporabnik.token
    vodjaId = uporabnik.user.id
    const stranka = await db.customer.create({
      data: { ime: uniq('Stranka Naslovi'), naslov: 'Legacy naslov 1, 1000 Ljubljana' },
      select: { id: true },
    })
    customerId = stranka.id
  })

  afterEach(async () => {
    for (const id of oppIds.splice(0)) {
      await db.opportunity.delete({ where: { id } }).catch(() => undefined)
    }
    for (const id of addressIds.splice(0)) {
      await db.customerAddress.delete({ where: { id } }).catch(() => undefined)
    }
    if (customerId) {
      await db.customerAddress.deleteMany({ where: { customerId } })
      await db.customer.delete({ where: { id: customerId } }).catch(() => undefined)
    }
    if (vodjaId) {
      await db.auditLog.deleteMany({ where: { userId: vodjaId } })
      await db.profile.delete({ where: { id: vodjaId } }).catch(() => undefined)
    }
  })

  it('POST 201 — trije ločeni tipi naslovov; VEČ MONTAZNI dovoljenih', async () => {
    const kontaktni = await addrRoute.POST(
      req('/api/customer-addresses', token, 'POST', {
        customerId,
        tip: 'KONTAKTNI',
        naslov: 'Slovenska cesta 5',
        kraj: 'Ljubljana',
        postnaSt: '1000',
      }),
    )
    expect(kontaktni.status).toBe(201)

    const racunski = await addrRoute.POST(
      req('/api/customer-addresses', token, 'POST', {
        customerId,
        tip: 'RACUNSKI',
        naslov: 'Dunajska cesta 50',
        kraj: 'Ljubljana',
        postnaSt: '1000',
      }),
    )
    expect(racunski.status).toBe(201)

    const montaza1 = await addrRoute.POST(
      req('/api/customer-addresses', token, 'POST', { customerId, tip: 'MONTAZNI', naslov: 'Objekt A, Kranj' }),
    )
    expect(montaza1.status).toBe(201)
    const montaza2 = await addrRoute.POST(
      req('/api/customer-addresses', token, 'POST', { customerId, tip: 'MONTAZNI', naslov: 'Objekt B, Kranj' }),
    )
    expect(montaza2.status).toBe(201)

    const vsi = await db.customerAddress.findMany({ where: { customerId } })
    addressIds.push(...vsi.map((a) => a.id))
    expect(vsi.filter((a) => a.tip === 'KONTAKTNI')).toHaveLength(1)
    expect(vsi.filter((a) => a.tip === 'RACUNSKI')).toHaveLength(1)
    expect(vsi.filter((a) => a.tip === 'MONTAZNI')).toHaveLength(2)
  })

  it('POST 400 — neznan tip (EXACT kanon §5: brez fuzzy, brez case-fold)', async () => {
    for (const slab of ['kontaktni', 'POSTNI', 'MONTAZNI ', 'billing']) {
      const res = await addrRoute.POST(
        req('/api/customer-addresses', token, 'POST', { customerId, tip: slab, naslov: 'Testni naslov 1' }),
      )
      expect(res.status).toBe(400)
      const body = (await res.json()) as { error: string }
      expect(body.error).toContain('KONTAKTNI')
      expect(body.error).toContain('MONTAZNI')
    }
  })

  it('POST 400 — manjkajoč customerId; prekratki naslov; 404 tuja stranka', async () => {
    expect(
      (await addrRoute.POST(req('/api/customer-addresses', token, 'POST', { tip: 'KONTAKTNI', naslov: 'Naslov 1' }))).status,
    ).toBe(400)
    expect(
      (await addrRoute.POST(req('/api/customer-addresses', token, 'POST', { customerId, tip: 'KONTAKTNI', naslov: 'ab' }))).status,
    ).toBe(400)
    expect(
      (
        await addrRoute.POST(
          req('/api/customer-addresses', token, 'POST', { customerId: 'neobstojeca', tip: 'KONTAKTNI', naslov: 'Naslov 1' }),
        )
      ).status,
    ).toBe(404)
  })

  it('PRIVZETOST — drugi privzeti KONTAKTNI demote-a prvega + LEGACY SINHRON Customer.naslov', async () => {
    const prvi = await addrRoute.POST(
      req('/api/customer-addresses', token, 'POST', {
        customerId,
        tip: 'KONTAKTNI',
        naslov: 'Prva ulica 1',
        jePrivzet: true,
      }),
    )
    expect(prvi.status).toBe(201)
    const prviBody = (await prvi.json()) as { addressId: string }
    addressIds.push(prviBody.addressId)

    // Legacy sinhron #1:
    let stranka = await db.customer.findUnique({ where: { id: customerId }, select: { naslov: true } })
    expect(stranka?.naslov).toBe('Prva ulica 1')

    const drugi = await addrRoute.POST(
      req('/api/customer-addresses', token, 'POST', {
        customerId,
        tip: 'KONTAKTNI',
        naslov: 'Druga ulica 2',
        jePrivzet: true,
      }),
    )
    expect(drugi.status).toBe(201)
    const drugiBody = (await drugi.json()) as { addressId: string }
    addressIds.push(drugiBody.addressId)

    // Samo EN privzet na (stranka, tip):
    const kontakti = await db.customerAddress.findMany({ where: { customerId, tip: 'KONTAKTNI' } })
    expect(kontakti.filter((a) => a.jePrivzet)).toHaveLength(1)
    expect(kontakti.find((a) => a.jePrivzet)?.naslov).toBe('Druga ulica 2')

    // Legacy sinhron #2 (novi privzeti):
    stranka = await db.customer.findUnique({ where: { id: customerId }, select: { naslov: true } })
    expect(stranka?.naslov).toBe('Druga ulica 2')
  })

  it('RACUNSKI privzet NE vpliva na legacy naslov (sinhron SAMO za KONTAKTNI)', async () => {
    const racunski = await addrRoute.POST(
      req('/api/customer-addresses', token, 'POST', {
        customerId,
        tip: 'RACUNSKI',
        naslov: 'Računski naslov 9',
        jePrivzet: true,
      }),
    )
    expect(racunski.status).toBe(201)
    const body = (await racunski.json()) as { addressId: string }
    addressIds.push(body.addressId)

    const stranka = await db.customer.findUnique({ where: { id: customerId }, select: { naslov: true } })
    expect(stranka?.naslov).toBe('Legacy naslov 1, 1000 Ljubljana') // nespremenjen
  })

  it('PATCH — sprememba naslova privzetega KONTAKTNI → legacy sinhron; preklop jePrivzet', async () => {
    const ustvarjen = await addrRoute.POST(
      req('/api/customer-addresses', token, 'POST', {
        customerId,
        tip: 'KONTAKTNI',
        naslov: 'Stari naslov 1',
        jePrivzet: true,
      }),
    )
    const { addressId } = (await ustvarjen.json()) as { addressId: string }
    addressIds.push(addressId)

    const drugi = await addrRoute.POST(
      req('/api/customer-addresses', token, 'POST', { customerId, tip: 'KONTAKTNI', naslov: 'Rezervni naslov 2' }),
    )
    const drugiBody = (await drugi.json()) as { addressId: string }
    addressIds.push(drugiBody.addressId)

    // Sprememba naslova privzetega → legacy sledi:
    const patch = await addrIdRoute.PATCH(
      req(`/api/customer-addresses/${addressId}`, token, 'PATCH', { naslov: 'Novi naslov 3' }),
      { params: Promise.resolve({ id: addressId }) },
    )
    expect(patch.status).toBe(200)
    let stranka = await db.customer.findUnique({ where: { id: customerId }, select: { naslov: true } })
    expect(stranka?.naslov).toBe('Novi naslov 3')

    // Preklop privzetosti na drugega → demote prvega + legacy na drugega:
    const preklop = await addrIdRoute.PATCH(
      req(`/api/customer-addresses/${drugiBody.addressId}`, token, 'PATCH', { jePrivzet: true }),
      { params: Promise.resolve({ id: drugiBody.addressId }) },
    )
    expect(preklop.status).toBe(200)
    const kontakti = await db.customerAddress.findMany({ where: { customerId, tip: 'KONTAKTNI' } })
    expect(kontakti.find((a) => a.jePrivzet)?.naslov).toBe('Rezervni naslov 2')
    stranka = await db.customer.findUnique({ where: { id: customerId }, select: { naslov: true } })
    expect(stranka?.naslov).toBe('Rezervni naslov 2')
  })

  it('DELETE privzetega KONTAKTNI → legacy pade na najstarejši preostali KONTAKTNI', async () => {
    const prvi = await addrRoute.POST(
      req('/api/customer-addresses', token, 'POST', { customerId, tip: 'KONTAKTNI', naslov: 'Vrsta A 1' }),
    )
    const prviBody = (await prvi.json()) as { addressId: string }
    addressIds.push(prviBody.addressId)

    const drugi = await addrRoute.POST(
      req('/api/customer-addresses', token, 'POST', {
        customerId,
        tip: 'KONTAKTNI',
        naslov: 'Vrsta B 2',
        jePrivzet: true,
      }),
    )
    const drugiBody = (await drugi.json()) as { addressId: string }
    addressIds.push(drugiBody.addressId)

    const brisi = await addrIdRoute.DELETE(
      req(`/api/customer-addresses/${drugiBody.addressId}`, token, 'DELETE'),
      { params: Promise.resolve({ id: drugiBody.addressId }) },
    )
    expect(brisi.status).toBe(200)

    const stranka = await db.customer.findUnique({ where: { id: customerId }, select: { naslov: true } })
    expect(stranka?.naslov).toBe('Vrsta A 1') // preusmerjen na preostali KONTAKTNI

    const manjka = await addrIdRoute.DELETE(
      req(`/api/customer-addresses/${drugiBody.addressId}`, token, 'DELETE'),
      { params: Promise.resolve({ id: drugiBody.addressId }) },
    )
    expect(manjka.status).toBe(404)
  })

  it('GET brez customerId 400; s customerId → razdelitev PO TIPIH', async () => {
    const brez = await addrRoute.GET(req('/api/customer-addresses', token, 'GET'))
    expect(brez.status).toBe(400)

    await addrRoute.POST(
      req('/api/customer-addresses', token, 'POST', { customerId, tip: 'KONTAKTNI', naslov: 'GET ulica 1', jePrivzet: true }),
    )
    await addrRoute.POST(
      req('/api/customer-addresses', token, 'POST', { customerId, tip: 'RACUNSKI', naslov: 'GET ulica 2' }),
    )
    const vsi = await db.customerAddress.findMany({ where: { customerId } })
    addressIds.push(...vsi.map((a) => a.id))

    const res = await addrRoute.GET(req(`/api/customer-addresses?customerId=${customerId}`, token, 'GET'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      customerId: string
      legacyNaslov: string
      naslovi: { KONTAKTNI: unknown[]; RACUNSKI: unknown[]; MONTAZNI: unknown[] }
    }
    expect(body.customerId).toBe(customerId)
    expect(body.legacyNaslov).toBe('GET ulica 1')
    expect(body.naslovi.KONTAKTNI).toHaveLength(1)
    expect(body.naslovi.RACUNSKI).toHaveLength(1)
    expect(body.naslovi.MONTAZNI).toHaveLength(0)

    const tuja = await addrRoute.GET(
      req('/api/customer-addresses?customerId=neobstojeca', token, 'GET'),
    )
    expect(tuja.status).toBe(404)
  })

  it('GET /api/customers/[id] — detajl z naslovi PO TIPIH + priložnostmi + števci; 404 tuja', async () => {
    await addrRoute.POST(
      req('/api/customer-addresses', token, 'POST', { customerId, tip: 'MONTAZNI', naslov: 'Objekt X' }),
    )
    const vsi = await db.customerAddress.findMany({ where: { customerId } })
    addressIds.push(...vsi.map((a) => a.id))

    const opp = await db.opportunity.create({
      data: { customerId, naziv: 'Detajl priložnost', stage: 'NEW' },
      select: { id: true },
    })
    oppIds.push(opp.id)

    const res = await customerIdRoute.GET(req(`/api/customers/${customerId}`, token, 'GET'), {
      params: Promise.resolve({ id: customerId }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      customer: { id: string; ime: string }
      naslovi: { KONTAKTNI: unknown[]; RACUNSKI: unknown[]; MONTAZNI: unknown[] }
      opportunities: Array<{ id: string; stage: string }>
      stevci: { projektov: number; ponudb: number; priloznosti: number }
    }
    expect(body.customer.id).toBe(customerId)
    expect(body.naslovi.MONTAZNI).toHaveLength(1)
    expect(body.opportunities).toHaveLength(1)
    expect(body.opportunities[0]?.stage).toBe('NEW')
    expect(body.stevci.priloznosti).toBe(1)
    expect(body.stevci.projektov).toBe(0)

    const tuja = await customerIdRoute.GET(req('/api/customers/neobstojeca', token, 'GET'), {
      params: Promise.resolve({ id: 'neobstojeca' }),
    })
    expect(tuja.status).toBe(404)
  })

  it('RBAC: SKLADISCE POST → 403 (customers.write prag, R156 precedens)', async () => {
    const skladisce = await createTestUserWithSession(uniq('r381addrskl'), 'SKLADISCE')
    const res = await addrRoute.POST(
      req('/api/customer-addresses', skladisce.token, 'POST', {
        customerId,
        tip: 'KONTAKTNI',
        naslov: 'Ne bo slo 1',
      }),
    )
    expect(res.status).toBe(403)
    await db.auditLog.deleteMany({ where: { userId: skladisce.user.id } })
    await db.profile.delete({ where: { id: skladisce.user.id } }).catch(() => undefined)
  })
})
