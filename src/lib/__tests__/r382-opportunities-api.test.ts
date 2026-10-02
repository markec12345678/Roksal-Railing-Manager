// R382 — /api/opportunities API POGODBA (issue #13, korak R169 iz §13).
// ---------------------------------------------------------------------------
//   • POST 201 direkten (brez sleada — repeat posel): stage NEW, honest NULL
//     (ocena/verjetnost), Decimal DTO = number;
//   • POST fail-closed: verjetnost 101 → 400; necelo število → 400; ocena s
//     3 decimalkami → 400 (denarna domena R380 — NE tiho zaokroževanje);
//     tuja stranka → 404;
//   • PATCH stage preskok naprej (NEW→SITE_SURVEY) 200; nazaj 409;
//   • PATCH LOST brez razloga 400 (§13 loss reason — tiha izguba je mutacija
//     zgodovine); z razlogom 200 + razlog ZAPISAN; terminalen (update 409,
//     oživljanje 409);
//   • PATCH ACCEPTED brez stranke 409; brez nazivProjekta 400; S stranko in
//     nazivom 200 → PROJEKT nastane V ISTI TRANSAKCIJI (convertedProjectId
//     vezan UNIQUE, projekt NACRTOVANO, customerId pravilen) + dvojna
//     revizija (OPPORTUNITY_CONVERTED + PROJECT_CREATED); po pretvorbi
//     update 409 in ACCEPTED→LOST 409;
//   • GET seznam: stage filter deluje, neveljaven filter 400; GET [id]
//     detajl s stranko + projektom; 404 za manjkajočo.
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import * as oppRoute from '@/app/api/opportunities/route'
import * as oppIdRoute from '@/app/api/opportunities/[id]/route'

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

describe('R382 — /api/opportunities (§13 Opportunity prodajna cev)', () => {
  let token: string
  let vodjaId: string
  let customerId: string
  const oppIds: string[] = []
  const projectIds: string[] = []

  beforeEach(async () => {
    const uporabnik = await createTestUserWithSession(uniq('r381oppvodja'), 'VODJA')
    token = uporabnik.token
    vodjaId = uporabnik.user.id
    const stranka = await db.customer.create({
      data: { ime: uniq('Stranka R382'), naslov: 'Testna ulica 1, 1000 Ljubljana' },
      select: { id: true },
    })
    customerId = stranka.id
  })

  afterEach(async () => {
    // Vrstni red (FK Restrict): priložnosti (sklicujejo projekt/stranko) →
    // projekti → stranka → revizije → profil.
    for (const id of oppIds.splice(0)) {
      await db.opportunity.delete({ where: { id } }).catch(() => undefined)
    }
    for (const id of projectIds.splice(0)) {
      await db.project.delete({ where: { id } }).catch(() => undefined)
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

  it('POST 201 — direktna priložnost (brez sleada): stage NEW + honest NULL', async () => {
    const res = await oppRoute.POST(
      req('/api/opportunities', token, 'POST', { naziv: 'Alu ograja - Novo mesto', customerId }),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as Record<string, unknown>
    oppIds.push(body.opportunityId as string)
    expect(body.stage).toBe('NEW')
    const vBaza = await db.opportunity.findUnique({ where: { id: body.opportunityId as string } })
    expect(vBaza?.leadId).toBeNull()
    expect(vBaza?.ocenjenaVrednost).toBeNull()
    expect(vBaza?.verjetnost).toBeNull()
    expect(vBaza?.customerId).toBe(customerId)
  })

  it('POST 201 — ocena 2 decimalki + verjetnost 60 zapisani; DTO vrača številke', async () => {
    const res = await oppRoute.POST(
      req('/api/opportunities', token, 'POST', {
        naziv: 'Ograja Kranj',
        customerId,
        ocenjenaVrednost: 12500.5,
        verjetnost: 60,
      }),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as Record<string, unknown>
    oppIds.push(body.opportunityId as string)
    const vBaza = await db.opportunity.findUnique({ where: { id: body.opportunityId as string } })
    expect(vBaza?.ocenjenaVrednost?.toNumber()).toBe(12500.5)
    expect(vBaza?.verjetnost).toBe(60)
  })

  it('POST 400 — verjetnost 101 (meja 0–100, fail-closed)', async () => {
    const res = await oppRoute.POST(
      req('/api/opportunities', token, 'POST', { naziv: 'Preverba meje', customerId, verjetnost: 101 }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('100')
  })

  it('POST 400 — verjetnost necelo število (mnenje je celo število)', async () => {
    const res = await oppRoute.POST(
      req('/api/opportunities', token, 'POST', { naziv: 'Preverba decimalk', customerId, verjetnost: 55.5 }),
    )
    expect(res.status).toBe(400)
  })

  it('POST 400 — ocena s 3 decimalkami (denarna domena R380 — NE tiho zaokroževanje)', async () => {
    const res = await oppRoute.POST(
      req('/api/opportunities', token, 'POST', { naziv: 'Preverba ocene', customerId, ocenjenaVrednost: 99.999 }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('decimalk')
  })

  it('POST 404 — tuja stranka (ne tiha prazna priložnost)', async () => {
    const res = await oppRoute.POST(
      req('/api/opportunities', token, 'POST', { naziv: 'Preverba stranke', customerId: 'neobstojeca-stranka' }),
    )
    expect(res.status).toBe(404)
  })

  it('PATCH stage preskok naprej NEW→SITE_SURVEY 200 (lažni vmesni koraki se ne prisiljujejo); nazaj 409', async () => {
    const ustvarjena = await oppRoute.POST(
      req('/api/opportunities', token, 'POST', { naziv: 'Preskok naprej', customerId }),
    )
    const { opportunityId } = (await ustvarjena.json()) as { opportunityId: string }
    oppIds.push(opportunityId)

    const naprej = await oppIdRoute.PATCH(
      req(`/api/opportunities/${opportunityId}`, token, 'PATCH', { action: 'transition', to: 'SITE_SURVEY' }),
      { params: Promise.resolve({ id: opportunityId }) },
    )
    expect(naprej.status).toBe(200)

    const nazaj = await oppIdRoute.PATCH(
      req(`/api/opportunities/${opportunityId}`, token, 'PATCH', { action: 'transition', to: 'NEW' }),
      { params: Promise.resolve({ id: opportunityId }) },
    )
    expect(nazaj.status).toBe(409)
  })

  it('PATCH LOST brez razloga 400; z razlogom 200 + ZAPISAN + terminalen (update 409)', async () => {
    const ustvarjena = await oppRoute.POST(
      req('/api/opportunities', token, 'POST', { naziv: 'Izguba posla', customerId }),
    )
    const { opportunityId } = (await ustvarjena.json()) as { opportunityId: string }
    oppIds.push(opportunityId)

    const brez = await oppIdRoute.PATCH(
      req(`/api/opportunities/${opportunityId}`, token, 'PATCH', { action: 'transition', to: 'LOST' }),
      { params: Promise.resolve({ id: opportunityId }) },
    )
    expect(brez.status).toBe(400)
    const body = (await brez.json()) as { error: string }
    expect(body.error).toContain('razlog')

    const z = await oppIdRoute.PATCH(
      req(`/api/opportunities/${opportunityId}`, token, 'PATCH', {
        action: 'transition',
        to: 'LOST',
        razlogIzgube: 'Konkurenčna ponudba 20% cenejša.',
      }),
      { params: Promise.resolve({ id: opportunityId }) },
    )
    expect(z.status).toBe(200)
    const vBaza = await db.opportunity.findUnique({ where: { id: opportunityId } })
    expect(vBaza?.razlogIzgube).toBe('Konkurenčna ponudba 20% cenejša.')
    expect(vBaza?.stage).toBe('LOST')

    // Terminalen: update 409 (zamrznjena zgodovina) + oživljanje 409:
    const update = await oppIdRoute.PATCH(
      req(`/api/opportunities/${opportunityId}`, token, 'PATCH', { action: 'update', verjetnost: 10 }),
      { params: Promise.resolve({ id: opportunityId }) },
    )
    expect(update.status).toBe(409)

    const ozivi = await oppIdRoute.PATCH(
      req(`/api/opportunities/${opportunityId}`, token, 'PATCH', { action: 'transition', to: 'QUOTE' }),
      { params: Promise.resolve({ id: opportunityId }) },
    )
    expect(ozivi.status).toBe(409)
  })

  it('PATCH ACCEPTED brez stranke 409; brez nazivProjekta 400; popolna pretvorba 200 → PROJEKT V ISTI TRANSAKCIJI', async () => {
    // 1) brez stranke:
    const brezStranke = await oppRoute.POST(
      req('/api/opportunities', token, 'POST', { naziv: 'Pretvorba brez stranke' }),
    )
    const bs = (await brezStranke.json()) as { opportunityId: string }
    oppIds.push(bs.opportunityId)
    // Najprej v QUOTE (matrika §13: ACCEPTED samo iz QUOTE|FOLLOW_UP) —
    // sicer bi 409 padel na MATRIKI in ne na MANJKANJU STRANKE:
    await oppIdRoute.PATCH(
      req(`/api/opportunities/${bs.opportunityId}`, token, 'PATCH', { action: 'transition', to: 'QUOTE' }),
      { params: Promise.resolve({ id: bs.opportunityId }) },
    )
    const resBs = await oppIdRoute.PATCH(
      req(`/api/opportunities/${bs.opportunityId}`, token, 'PATCH', {
        action: 'transition',
        to: 'ACCEPTED',
        nazivProjekta: 'Projekt brez stranke',
      }),
      { params: Promise.resolve({ id: bs.opportunityId }) },
    )
    expect(resBs.status).toBe(409)
    const bodyBs = (await resBs.json()) as { error: string }
    expect(bodyBs.error).toContain('strank')

    // 2) s stranko, brez naziva projekta:
    const sStranko = await oppRoute.POST(
      req('/api/opportunities', token, 'POST', { naziv: 'Pretvorba z nazivom', customerId }),
    )
    const ss = (await sStranko.json()) as { opportunityId: string }
    oppIds.push(ss.opportunityId)
    // V QUOTE (matrika prva vrata — nato še validacija payload-a):
    await oppIdRoute.PATCH(
      req(`/api/opportunities/${ss.opportunityId}`, token, 'PATCH', { action: 'transition', to: 'QUOTE' }),
      { params: Promise.resolve({ id: ss.opportunityId }) },
    )
    const resBrezNaziva = await oppIdRoute.PATCH(
      req(`/api/opportunities/${ss.opportunityId}`, token, 'PATCH', { action: 'transition', to: 'ACCEPTED' }),
      { params: Promise.resolve({ id: ss.opportunityId }) },
    )
    expect(resBrezNaziva.status).toBe(400)

    // 3) popolna pretvorba (veriga SITE_SURVEY→QUOTE→ACCEPTED):
    await oppIdRoute.PATCH(
      req(`/api/opportunities/${ss.opportunityId}`, token, 'PATCH', { action: 'transition', to: 'SITE_SURVEY' }),
      { params: Promise.resolve({ id: ss.opportunityId }) },
    )
    await oppIdRoute.PATCH(
      req(`/api/opportunities/${ss.opportunityId}`, token, 'PATCH', { action: 'transition', to: 'QUOTE' }),
      { params: Promise.resolve({ id: ss.opportunityId }) },
    )
    const resSprejeta = await oppIdRoute.PATCH(
      req(`/api/opportunities/${ss.opportunityId}`, token, 'PATCH', {
        action: 'transition',
        to: 'ACCEPTED',
        nazivProjekta: 'Montaža alu ograj Metelkova',
      }),
      { params: Promise.resolve({ id: ss.opportunityId }) },
    )
    expect(resSprejeta.status).toBe(200)
    const body = (await resSprejeta.json()) as { stage: string; convertedProjectId: string }
    expect(body.stage).toBe('ACCEPTED')
    expect(body.convertedProjectId).toBeTruthy()
    projectIds.push(body.convertedProjectId)

    // Projekt: NACRTOVANO + stranka pravilna + naziv:
    const projekt = await db.project.findUnique({ where: { id: body.convertedProjectId } })
    expect(projekt?.status).toBe('NACRTOVANO')
    expect(projekt?.customerId).toBe(customerId)
    expect(projekt?.nazivProjekta).toBe('Montaža alu ograj Metelkova')

    // Priložnost: convertedProjectId VEZAN (UNIQUE — pretvorba enkratna):
    const opp = await db.opportunity.findUnique({ where: { id: ss.opportunityId } })
    expect(opp?.convertedProjectId).toBe(body.convertedProjectId)

    // Po pretvorbi: terminalen — update 409, ACCEPTED→LOST 409 (razpad
    // sprejetega posla živi na projektu, ne v prepisu CRM zgodovine):
    const update = await oppIdRoute.PATCH(
      req(`/api/opportunities/${ss.opportunityId}`, token, 'PATCH', { action: 'update', verjetnost: 100 }),
      { params: Promise.resolve({ id: ss.opportunityId }) },
    )
    expect(update.status).toBe(409)
    const vLost = await oppIdRoute.PATCH(
      req(`/api/opportunities/${ss.opportunityId}`, token, 'PATCH', {
        action: 'transition',
        to: 'LOST',
        razlogIzgube: 'Odstop stranke po sprejetju.',
      }),
      { params: Promise.resolve({ id: ss.opportunityId }) },
    )
    expect(vLost.status).toBe(409)
  })

  it('GET seznam — stage filter deluje; neveljaven stage filter 400', async () => {
    const ustvarjena = await oppRoute.POST(
      req('/api/opportunities', token, 'POST', { naziv: 'Filter test', customerId }),
    )
    const { opportunityId } = (await ustvarjena.json()) as { opportunityId: string }
    oppIds.push(opportunityId)

    const seznam = (await (
      await oppRoute.GET(req('/api/opportunities?stage=NEW', token, 'GET'))
    ).json()) as Array<{ id: string; stage: string }>
    expect(seznam.some((o) => o.id === opportunityId)).toBe(true)
    expect(seznam.every((o) => o.stage === 'NEW')).toBe(true)

    const slabFilter = await oppRoute.GET(req('/api/opportunities?stage=MAYBE', token, 'GET'))
    expect(slabFilter.status).toBe(400)
  })

  it('GET [id] detajl — stranka + pretvorjeni projekt; 404 za manjkajočo', async () => {
    const ustvarjena = await oppRoute.POST(
      req('/api/opportunities', token, 'POST', { naziv: 'Detajl test', customerId, ocenjenaVrednost: 4200.25 }),
    )
    const { opportunityId } = (await ustvarjena.json()) as { opportunityId: string }
    oppIds.push(opportunityId)

    const detajl = await oppIdRoute.GET(req(`/api/opportunities/${opportunityId}`, token, 'GET'), {
      params: Promise.resolve({ id: opportunityId }),
    })
    expect(detajl.status).toBe(200)
    const body = (await detajl.json()) as {
      opportunity: {
        ocenjenaVrednost: number | null
        customer: { id: string } | null
        convertedProject: { id: string } | null
      }
    }
    expect(body.opportunity.ocenjenaVrednost).toBe(4200.25) // Decimal → number (R380)
    expect(body.opportunity.customer?.id).toBe(customerId)
    expect(body.opportunity.convertedProject).toBeNull() // še ni pretvorjena

    const manjka = await oppIdRoute.GET(req('/api/opportunities/xyz', token, 'GET'), {
      params: Promise.resolve({ id: 'xyz' }),
    })
    expect(manjka.status).toBe(404)
  })

  it('PATCH update ocene/verjetnosti na živi priložnosti 200 + zapis', async () => {
    const ustvarjena = await oppRoute.POST(
      req('/api/opportunities', token, 'POST', { naziv: 'Update test', customerId }),
    )
    const { opportunityId } = (await ustvarjena.json()) as { opportunityId: string }
    oppIds.push(opportunityId)

    const update = await oppIdRoute.PATCH(
      req(`/api/opportunities/${opportunityId}`, token, 'PATCH', {
        action: 'update',
        ocenjenaVrednost: 7777.77,
        verjetnost: 85,
      }),
      { params: Promise.resolve({ id: opportunityId }) },
    )
    expect(update.status).toBe(200)
    const vBaza = await db.opportunity.findUnique({ where: { id: opportunityId } })
    expect(vBaza?.ocenjenaVrednost?.toNumber()).toBe(7777.77)
    expect(vBaza?.verjetnost).toBe(85)
  })
})
