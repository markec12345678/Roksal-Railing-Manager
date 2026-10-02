// R382 — /api/leads API POGODBA (issue #13, korak R169 iz §13).
// ---------------------------------------------------------------------------
//   • POST 201: privzeti vrednosti (source DRUGO, status NOV, tip DRUGO) +
//     honest NULL (telefon/email/nextActionAt);
//   • POST fail-closed: neznan vir 400, neznan tip povpraševanja 400, ime
//     manjka/kratko 400, tuj ownerId 404;
//   • RBAC: SKLADISCE (samo customers.read) POST → 403;
//   • GET seznam: vsebuje ustvarjen slead + filter status deluje + neveljaven
//     filter → 400;
//   • PATCH transition po MATRIKI: NOV→KONTAKTIRAN 200; nazaj 409;
//     NOV→ZAVRNJEN (direktna zavrnitev) 200; terminalen ne spreminja več 409;
//   • PATCH transition PRETVORJEN brez naziva 400; z nazivom 200 +
//     PRiložnost nastane V ISTI TRANSAKCIJI (stage NEW, leadId vezan) +
//     slead terminalen (update 409);
//   • PATCH update kontaktov na NOV 200; na ZAVRNJEN 409 (zamrznjena
//     zgodovina — kanon terminalnosti R378);
//   • PATCH neznan action/to → 400; GET [id] 404 za manjkajočega.
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import * as leadsRoute from '@/app/api/leads/route'
import * as leadsIdRoute from '@/app/api/leads/[id]/route'

const BASE = 'http://localhost'
let counter = 0
const uniq = (p: string) => `${p}-${Date.now()}-${(counter += 1)}`

function req(path: string, token: string, method: 'POST' | 'PATCH' | 'GET', body?: Record<string, unknown>): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, origin: BASE },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

describe('R382 — /api/leads (§13 Lead vhod lijaka)', () => {
  let token: string
  let vodjaId: string
  const leadIds: string[] = []
  const oppIds: string[] = []

  beforeEach(async () => {
    const uporabnik = await createTestUserWithSession(uniq('r381vodja'), 'VODJA')
    token = uporabnik.token
    vodjaId = uporabnik.user.id
  })

  afterEach(async () => {
    // Vrstni red (FK): priložnosti → sleadi → revizije → profil.
    for (const id of oppIds.splice(0)) {
      await db.opportunity.delete({ where: { id } }).catch(() => undefined)
    }
    for (const id of leadIds.splice(0)) {
      await db.lead.delete({ where: { id } }).catch(() => undefined)
    }
    if (vodjaId) {
      await db.auditLog.deleteMany({ where: { userId: vodjaId } })
      await db.profile.delete({ where: { id: vodjaId } }).catch(() => undefined)
    }
  })

  it('POST 201 — privzete vrednosti + honest NULL (status NOV, vir DRUGO, tip DRUGO)', async () => {
    const res = await leadsRoute.POST(req('/api/leads', token, 'POST', { ime: 'Ana Kveder' }))
    expect(res.status).toBe(201)
    const body = (await res.json()) as Record<string, unknown>
    leadIds.push(body.leadId as string)
    expect(body.status).toBe('NOV')
    expect(body.source).toBe('DRUGO')
    expect(body.tipPovprasevanja).toBe('DRUGO')
    const vBaza = await db.lead.findUnique({ where: { id: body.leadId as string } })
    expect(vBaza?.telefon).toBeNull()
    expect(vBaza?.email).toBeNull()
    expect(vBaza?.nextActionAt).toBeNull()
  })

  it('POST 201 — vir/tip/owner iz kanonskih naborov + ownerId VEŽE lastnika', async () => {
    const res = await leadsRoute.POST(
      req('/api/leads', token, 'POST', {
        ime: 'Boris Kos',
        source: 'TELEFON',
        tipPovprasevanja: 'BALKON',
        ownerId: vodjaId,
        nextActionAt: '2026-10-15T09:00:00.000Z',
      }),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as Record<string, unknown>
    leadIds.push(body.leadId as string)
    expect(body.source).toBe('TELEFON')
    expect(body.tipPovprasevanja).toBe('BALKON')
    const vBaza = await db.lead.findUnique({ where: { id: body.leadId as string } })
    expect(vBaza?.ownerId).toBe(vodjaId)
    expect(vBaza?.nextActionAt).not.toBeNull()
  })

  it('POST 400 — neznan vir (fail-closed, NE tiha normalizacija)', async () => {
    const res = await leadsRoute.POST(req('/api/leads', token, 'POST', { ime: 'Test', source: 'FACEBOOK' }))
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('TELEFON') // seznam veljavnih vrednosti je v sporočilu
    expect(body.error).toContain('DRUGO')
  })

  it('POST 400 — neznan tip povpraševanja', async () => {
    const res = await leadsRoute.POST(req('/api/leads', token, 'POST', { ime: 'Test', tipPovprasevanja: 'ZUNANJA_STOPNICA' }))
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('BALKON')
  })

  it('POST 400 — ime manjka ali prekratko', async () => {
    expect((await leadsRoute.POST(req('/api/leads', token, 'POST', {}))).status).toBe(400)
    expect((await leadsRoute.POST(req('/api/leads', token, 'POST', { ime: 'A' }))).status).toBe(400)
  })

  it('POST 404 — tuj ownerId (ne tiha odvezava)', async () => {
    const res = await leadsRoute.POST(
      req('/api/leads', token, 'POST', { ime: 'Testni Stik', ownerId: 'neobstojec-profil' }),
    )
    expect(res.status).toBe(404)
  })

  it('RBAC: SKLADISCE (samo customers.read) POST → 403', async () => {
    const skladisce = await createTestUserWithSession(uniq('r381skl'), 'SKLADISCE')
    const res = await leadsRoute.POST(
      req('/api/leads', skladisce.token, 'POST', { ime: 'Ne bo slo' }),
    )
    expect(res.status).toBe(403)
    await db.auditLog.deleteMany({ where: { userId: skladisce.user.id } })
    await db.profile.delete({ where: { id: skladisce.user.id } }).catch(() => undefined)
  })

  it('GET seznam — vsebuje ustvarjen slead; filter status deluje; neveljaven filter 400', async () => {
    const ustvarjen = await leadsRoute.POST(
      req('/api/leads', token, 'POST', { ime: 'Cilka Novak', source: 'EMAIL' }),
    )
    const body = (await ustvarjen.json()) as { leadId: string }
    leadIds.push(body.leadId)

    const seznam = (await (await leadsRoute.GET(req('/api/leads', token, 'GET'))).json()) as Array<{ id: string; source: string }>
    expect(seznam.some((l) => l.id === body.leadId)).toBe(true)

    const filtrirano = (await (
      await leadsRoute.GET(req('/api/leads?status=NOV', token, 'GET'))
    ).json()) as Array<{ id: string; status: string }>
    expect(filtrirano.every((l) => l.status === 'NOV')).toBe(true)

    const slabFilter = await leadsRoute.GET(req('/api/leads?status=IZMISLJEN', token, 'GET'))
    expect(slabFilter.status).toBe(400)
  })

  it('PATCH transition NOV→KONTAKTIRAN 200; nazaj KONTAKTIRAN→NOV 409', async () => {
    const ustvarjen = await leadsRoute.POST(req('/api/leads', token, 'POST', { ime: 'Danijel Zajc' }))
    const { leadId } = (await ustvarjen.json()) as { leadId: string }
    leadIds.push(leadId)

    const naprej = await leadsIdRoute.PATCH(
      req(`/api/leads/${leadId}`, token, 'PATCH', { action: 'transition', to: 'KONTAKTIRAN' }),
      { params: Promise.resolve({ id: leadId }) },
    )
    expect(naprej.status).toBe(200)
    expect(((await naprej.json()) as { status: string }).status).toBe('KONTAKTIRAN')

    const nazaj = await leadsIdRoute.PATCH(
      req(`/api/leads/${leadId}`, token, 'PATCH', { action: 'transition', to: 'NOV' }),
      { params: Promise.resolve({ id: leadId }) },
    )
    expect(nazaj.status).toBe(409)
  })

  it('PATCH transition NOV→ZAVRNJEN (direktna zavrnitev) 200 → terminalen: update 409', async () => {
    const ustvarjen = await leadsRoute.POST(req('/api/leads', token, 'POST', { ime: 'Eva Kranjc' }))
    const { leadId } = (await ustvarjen.json()) as { leadId: string }
    leadIds.push(leadId)

    const zavrnitev = await leadsIdRoute.PATCH(
      req(`/api/leads/${leadId}`, token, 'PATCH', { action: 'transition', to: 'ZAVRNJEN' }),
      { params: Promise.resolve({ id: leadId }) },
    )
    expect(zavrnitev.status).toBe(200)

    const update = await leadsIdRoute.PATCH(
      req(`/api/leads/${leadId}`, token, 'PATCH', { action: 'update', telefon: '040111222' }),
      { params: Promise.resolve({ id: leadId }) },
    )
    expect(update.status).toBe(409) // zamrznjena zgodovina (kanon terminalnosti)
  })

  it('PATCH transition PRETVORJEN brez naziva 400; z nazivom 200 + PRiložnost V ISTI TRANSAKCIJI', async () => {
    const ustvarjen = await leadsRoute.POST(req('/api/leads', token, 'POST', { ime: 'Franc Horvat' }))
    const { leadId } = (await ustvarjen.json()) as { leadId: string }
    leadIds.push(leadId)

    const brez = await leadsIdRoute.PATCH(
      req(`/api/leads/${leadId}`, token, 'PATCH', { action: 'transition', to: 'PRETVORJEN' }),
      { params: Promise.resolve({ id: leadId }) },
    )
    expect(brez.status).toBe(400)

    const z = await leadsIdRoute.PATCH(
      req(`/api/leads/${leadId}`, token, 'PATCH', {
        action: 'transition',
        to: 'PRETVORJEN',
        pretvorba: { naziv: 'Ograja terasa Bled', ocenjenaVrednost: 2500, verjetnost: 60 },
      }),
      { params: Promise.resolve({ id: leadId }) },
    )
    expect(z.status).toBe(200)
    const zBody = (await z.json()) as { status: string; opportunityId: string }
    expect(zBody.status).toBe('PRETVORJEN')
    expect(zBody.opportunityId).toBeTruthy()
    oppIds.push(zBody.opportunityId)

    // Priložnost: stage NEW (napredek POSLA se začne na začetku — kontakt
    // se je zgodil na sleadu in je tam že zabeležen), leadId VEZAN:
    const opp = await db.opportunity.findUnique({ where: { id: zBody.opportunityId } })
    expect(opp?.stage).toBe('NEW')
    expect(opp?.leadId).toBe(leadId)
    expect(opp?.ocenjenaVrednost?.toNumber()).toBe(2500)
    expect(opp?.verjetnost).toBe(60)

    // Slead je zdaj terminalen — druga pretvorba 409:
    const again = await leadsIdRoute.PATCH(
      req(`/api/leads/${leadId}`, token, 'PATCH', {
        action: 'transition',
        to: 'PRETVORJEN',
        pretvorba: { naziv: 'Druga priložnost' },
      }),
      { params: Promise.resolve({ id: leadId }) },
    )
    expect(again.status).toBe(409)
  })

  it('PATCH update kontaktov na NOV 200 + zapis v bazi', async () => {
    const ustvarjen = await leadsRoute.POST(req('/api/leads', token, 'POST', { ime: 'Greta Zupan' }))
    const { leadId } = (await ustvarjen.json()) as { leadId: string }
    leadIds.push(leadId)

    const update = await leadsIdRoute.PATCH(
      req(`/api/leads/${leadId}`, token, 'PATCH', { action: 'update', telefon: '040123456', opombe: 'Kliče v torek.' }),
      { params: Promise.resolve({ id: leadId }) },
    )
    expect(update.status).toBe(200)
    const vBaza = await db.lead.findUnique({ where: { id: leadId } })
    expect(vBaza?.telefon).toBe('040123456')
    expect(vBaza?.opombe).toBe('Kliče v torek.')
  })

  it('PATCH neznan action 400; neznan to 400; GET [id] 404 za manjkajočega', async () => {
    const slabAction = await leadsIdRoute.PATCH(
      req('/api/leads/xyz', token, 'PATCH', { action: 'izbrisi' }),
      { params: Promise.resolve({ id: 'xyz' }) },
    )
    expect(slabAction.status).toBe(400)

    const slabTo = await leadsIdRoute.PATCH(
      req('/api/leads/xyz', token, 'PATCH', { action: 'transition', to: 'PREKINJEN' }),
      { params: Promise.resolve({ id: 'xyz' }) },
    )
    expect(slabTo.status).toBe(400)

    const manjka = await leadsIdRoute.GET(req('/api/leads/xyz', token, 'GET'), {
      params: Promise.resolve({ id: 'xyz' }),
    })
    expect(manjka.status).toBe(404)
  })

  it('GET [id] detajl — slead + priložnosti iz pretvorbe', async () => {
    const ustvarjen = await leadsRoute.POST(req('/api/leads', token, 'POST', { ime: 'Hana Vidmar' }))
    const { leadId } = (await ustvarjen.json()) as { leadId: string }
    leadIds.push(leadId)

    const pretvorba = await leadsIdRoute.PATCH(
      req(`/api/leads/${leadId}`, token, 'PATCH', {
        action: 'transition',
        to: 'PRETVORJEN',
        pretvorba: { naziv: 'Balkonska ograja Vrhnika' },
      }),
      { params: Promise.resolve({ id: leadId }) },
    )
    const pBody = (await pretvorba.json()) as { opportunityId: string }
    oppIds.push(pBody.opportunityId)

    const detajl = await leadsIdRoute.GET(req(`/api/leads/${leadId}`, token, 'GET'), {
      params: Promise.resolve({ id: leadId }),
    })
    expect(detajl.status).toBe(200)
    const dBody = (await detajl.json()) as {
      lead: { id: string; status: string }
      opportunities: Array<{ id: string; naziv: string; stage: string }>
    }
    expect(dBody.lead.id).toBe(leadId)
    expect(dBody.lead.status).toBe('PRETVORJEN')
    expect(dBody.opportunities).toHaveLength(1)
    expect(dBody.opportunities[0]?.naziv).toBe('Balkonska ograja Vrhnika')
    expect(dBody.opportunities[0]?.stage).toBe('NEW')
  })
})
