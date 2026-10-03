// R393 — /api/engineering-rules verzije (issue #13 R171 §15).
// ---------------------------------------------------------------------------
//   • POST ustvari pravilo + DRAFT v1: 201 + DB vrstica; dup šifra → 409;
//     neveljavna kategorija/vir/overitev → 400; productSifra EXACT → 404;
//   • §15 LOČITEV guard — ustvarjanje: PROJEKTANTSKA brez pregledalca → 409;
//     z obstoječim Profile pregledalcem + reviewedAt → 201;
//   • POST nova verzija: v2 DRAFT (zaporedna max+1); neznano pravilo → 404;
//   • PATCH aktiviraj: DRAFT → ACTIVE + prejšnja ACTIVE upokojena V ISTI
//     transakciji (ena ACTIVE na pravilo); aktivacija ne-DRAFT → 409;
//   • PATCH aktiviraj uradno BREZ pregleda (pokvarjena vrstica direktno v DB)
//     → 409 (druga linija guard — belt + braces);
//   • PATCH upokoji: ACTIVE → RETIRED (terminalno); ne-ACTIVE → 409;
//   • RBAC: MONTER POST/PATCH → 403 (engineering.manage = vodstvo).
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import * as engineeringRulesRoute from '@/app/api/engineering-rules/route'
import * as versionsRoute from '@/app/api/engineering-rules/[id]/versions/route'
import * as versionPatchRoute from '@/app/api/engineering-rules/versions/[id]/route'

const BASE = 'http://localhost'
let counter = 0
const uniq = (p: string) => `${p}-${Date.now()}-${(counter += 1)}`

function req(path: string, token: string, method: 'POST' | 'PATCH', body?: Record<string, unknown>): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, origin: BASE },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

const NOVO_PRAVILO = (sifra: string) => ({
  sifra,
  naziv: 'Testno pravilo R393',
  kategorija: 'MONTAZA',
  vsebina: 'Testna vsebina pravila — vir citat.',
  vir: 'INTERNI_INZENIRING',
  virZapis: 'testni vir R393',
  overitev: 'INFORMATIVNO',
})

describe('R393 — /api/engineering-rules verzije (§15 stroj)', () => {
  let token: string
  let vodjaId: string
  const createdRuleIds: string[] = []
  const users: Array<{ id: string }> = []

  beforeEach(async () => {
    const u = await createTestUserWithSession(uniq('r393verzije'), 'VODJA')
    token = u.token
    vodjaId = u.user.id
    users.push({ id: u.user.id })
  })

  afterEach(async () => {
    // Vrstni red (FK): verzije → pravila → revizije → profili.
    for (const ruleId of createdRuleIds.splice(0)) {
      await db.engineeringRuleVersion.deleteMany({ where: { ruleId } })
      await db.engineeringRule.delete({ where: { id: ruleId } }).catch(() => undefined)
    }
    for (const u of users.splice(0)) {
      await db.auditLog.deleteMany({ where: { userId: u.id } })
      await db.profile.delete({ where: { id: u.id } }).catch(() => undefined)
    }
  })

  it('POST ustvari pravilo + DRAFT v1 (201 + DB + audit revizija)', async () => {
    const sifra = uniq('MONT-TEST')
    const res = await engineeringRulesRoute.POST(req('/api/engineering-rules', token, 'POST', NOVO_PRAVILO(sifra)))
    expect(res.status).toBe(201)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.sifra).toBe(sifra)
    expect(body.status).toBe('DRAFT')
    expect(body.verzija).toBe(1)
    createdRuleIds.push(body.praviloId as string)

    const vDB = await db.engineeringRuleVersion.findUnique({
      where: { id: body.verzijaId as string },
    })
    expect(vDB!.status).toBe('DRAFT')
    expect(vDB!.createdById).toBe(vodjaId)
    const revizije = await db.auditLog.findMany({
      where: { userId: vodjaId, akcija: 'ENGINEERING_RULE_CREATED' },
    })
    expect(revizije.length).toBeGreaterThan(0)
  })

  it('POST dup šifra → 409 (predlagaj novo verzijo obstoječega)', async () => {
    const sifra = uniq('MONT-DUP')
    const prva = await engineeringRulesRoute.POST(req('/api/engineering-rules', token, 'POST', NOVO_PRAVILO(sifra)))
    createdRuleIds.push(((await prva.json()) as Record<string, unknown>).praviloId as string)
    const druga = await engineeringRulesRoute.POST(req('/api/engineering-rules', token, 'POST', NOVO_PRAVILO(sifra)))
    expect(druga.status).toBe(409)
    const body = (await druga.json()) as Record<string, string>
    expect(body.error).toContain('novo verzijo')
  })

  it.each([
    ['kategorija', 'kategorija', 'NEVELJAVNA_KATEGORIJA'],
    ['vir', 'vir', 'NEVELJAVEN_VIR'],
    ['overitev', 'overitev', 'NEVELJAVNA_OVERITEV'],
  ])('POST neveljavna %s → 400 s seznamom nabora', (_ime, polje, vrednost) => {
    return (async () => {
      const res = await engineeringRulesRoute.POST(
        req('/api/engineering-rules', token, 'POST', { ...NOVO_PRAVILO(uniq('MONT-NAPAČNO')), [polje]: vrednost }),
      )
      expect(res.status).toBe(400)
      const body = (await res.json()) as Record<string, string>
      expect(body.error).toContain('dovoljen')
    })()
  })

  it('POST productSifra=neobstojeca → 404 (EXACT vezava — kanon §5)', async () => {
    const res = await engineeringRulesRoute.POST(
      req('/api/engineering-rules', token, 'POST', { ...NOVO_PRAVILO(uniq('MONT-PROD')), productSifra: 'neobstojec-profil' }),
    )
    expect(res.status).toBe(404)
  })

  it('§15 guard — POST overitev PROJEKTANTSKA BREZ pregledalca → 409', async () => {
    const res = await engineeringRulesRoute.POST(
      req('/api/engineering-rules', token, 'POST', { ...NOVO_PRAVILO(uniq('MONT-URADNO-NAPAKA')), overitev: 'PROJEKTANTSKA' }),
    )
    expect(res.status).toBe(409)
    const body = (await res.json()) as Record<string, string>
    expect(body.error).toContain('SAMO INFORMATIVNO')
  })

  it('§15 guard — POST PROJEKTANTSKA z neobstoječim pregledalcem → 404', async () => {
    const res = await engineeringRulesRoute.POST(
      req('/api/engineering-rules', token, 'POST', {
        ...NOVO_PRAVILO(uniq('MONT-URADNO-BOGUS')),
        overitev: 'PROJEKTANTSKA',
        reviewerId: 'neobstojeci-pregledovalec',
        reviewedAt: '2026-10-09T08:00:00Z',
      }),
    )
    expect(res.status).toBe(404)
    expect(((await res.json()) as Record<string, string>).error).toContain('pregledalca')
  })

  it('§15 dovoljeno — POST PROJEKTANTSKA S pregledalcem + datumom → 201 (uradna pot)', async () => {
    const res = await engineeringRulesRoute.POST(
      req('/api/engineering-rules', token, 'POST', {
        ...NOVO_PRAVILO(uniq('MONT-URADNO-OK')),
        overitev: 'PROJEKTANTSKA',
        reviewerId: vodjaId,
        reviewedAt: '2026-10-09T08:00:00Z',
        standardReferenca: 'SIST EN 1991-1-1',
        jurisdikcija: 'SI',
      }),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as Record<string, unknown>
    createdRuleIds.push(body.praviloId as string)
    const vDB = await db.engineeringRuleVersion.findUnique({ where: { id: body.verzijaId as string } })
    expect(vDB!.overitev).toBe('PROJEKTANTSKA')
    expect(vDB!.reviewerId).toBe(vodjaId)
    expect(vDB!.reviewedAt).not.toBeNull()
  })

  it('POST nova verzija obstoječega pravila → v2 DRAFT (zaporedna max+1)', async () => {
    const ustvarjeno = await engineeringRulesRoute.POST(
      req('/api/engineering-rules', token, 'POST', NOVO_PRAVILO(uniq('MONT-VERZIJE'))),
    )
    const telo = (await ustvarjeno.json()) as Record<string, string>
    createdRuleIds.push(telo.praviloId)

    const v2 = await versionsRoute.POST(
      req(`/api/engineering-rules/${telo.praviloId}/versions`, token, 'POST', {
        vsebina: 'Popravek vsebine po odkriti nedoslednosti — nova verzija.',
        vir: 'URADNI_STANDARD',
        virZapis: 'uradni list',
        overitev: 'INFORMATIVNO',
      }),
      { params: Promise.resolve({ id: telo.praviloId }) },
    )
    expect(v2.status).toBe(201)
    const bodyV2 = (await v2.json()) as Record<string, unknown>
    expect(bodyV2.verzija).toBe(2)
    expect(bodyV2.status).toBe('DRAFT')
  })

  it('POST nova verzija neznanega pravila → 404', async () => {
    const res = await versionsRoute.POST(
      req('/api/engineering-rules/neobstojece-pravilo/versions', token, 'POST', {
        vsebina: 'x',
        vir: 'INTERNI_INZENIRING',
        overitev: 'INFORMATIVNO',
      }),
      { params: Promise.resolve({ id: 'neobstojece-pravilo' }) },
    )
    expect(res.status).toBe(404)
  })

  it('PATCH aktiviraj: DRAFT → ACTIVE + prejšnja ACTIVE upokojena V ISTI transakciji', async () => {
    const ustvarjeno = await engineeringRulesRoute.POST(
      req('/api/engineering-rules', token, 'POST', NOVO_PRAVILO(uniq('MONT-AKTIVACIJA'))),
    )
    const telo = (await ustvarjeno.json()) as Record<string, string>
    createdRuleIds.push(telo.praviloId)

    const prvaAktivacija = await versionPatchRoute.PATCH(
      req(`/api/engineering-rules/versions/${telo.verzijaId}`, token, 'PATCH', { action: 'aktiviraj' }),
      { params: Promise.resolve({ id: telo.verzijaId }) },
    )
    expect(prvaAktivacija.status).toBe(200)
    expect(((await prvaAktivacija.json()) as Record<string, unknown>).status).toBe('ACTIVE')

    const v2 = await versionsRoute.POST(
      req(`/api/engineering-rules/${telo.praviloId}/versions`, token, 'POST', {
        vsebina: 'v2 vsebina',
        vir: 'INTERNI_INZENIRING',
        overitev: 'INFORMATIVNO',
      }),
      { params: Promise.resolve({ id: telo.praviloId }) },
    )
    const v2Id = ((await v2.json()) as Record<string, string>).verzijaId

    const drugaAktivacija = await versionPatchRoute.PATCH(
      req(`/api/engineering-rules/versions/${v2Id}`, token, 'PATCH', { action: 'aktiviraj' }),
      { params: Promise.resolve({ id: v2Id }) },
    )
    expect(drugaAktivacija.status).toBe(200)

    const v1DB = await db.engineeringRuleVersion.findUnique({ where: { id: telo.verzijaId } })
    expect(v1DB!.status).toBe('RETIRED')
    expect(v1DB!.veljavnostDo).not.toBeNull()
    const v2DB = await db.engineeringRuleVersion.findUnique({ where: { id: v2Id } })
    expect(v2DB!.status).toBe('ACTIVE')
    expect(v2DB!.veljavnostDo).toBeNull()
  })

  it('PATCH aktiviraj ne-DRAFT (RETIRED) → 409; neveljaven action → 400', async () => {
    const ustvarjeno = await engineeringRulesRoute.POST(
      req('/api/engineering-rules', token, 'POST', NOVO_PRAVILO(uniq('MONT-UPOKOJ'))),
    )
    const telo = (await ustvarjeno.json()) as Record<string, string>
    createdRuleIds.push(telo.praviloId)
    await versionPatchRoute.PATCH(
      req(`/api/engineering-rules/versions/${telo.verzijaId}`, token, 'PATCH', { action: 'aktiviraj' }),
      { params: Promise.resolve({ id: telo.verzijaId }) },
    )
    await versionPatchRoute.PATCH(
      req(`/api/engineering-rules/versions/${telo.verzijaId}`, token, 'PATCH', { action: 'upokoji' }),
      { params: Promise.resolve({ id: telo.verzijaId }) },
    )

    const reAktiviraj = await versionPatchRoute.PATCH(
      req(`/api/engineering-rules/versions/${telo.verzijaId}`, token, 'PATCH', { action: 'aktiviraj' }),
      { params: Promise.resolve({ id: telo.verzijaId }) },
    )
    expect(reAktiviraj.status).toBe(409)

    const slabaAkcija = await versionPatchRoute.PATCH(
      req(`/api/engineering-rules/versions/${telo.verzijaId}`, token, 'PATCH', { action: 'izbrisi' }),
      { params: Promise.resolve({ id: telo.verzijaId }) },
    )
    expect(slabaAkcija.status).toBe(400)
  })

  it('PATCH upokoji ne-ACTIVE (DRAFT) → 409', async () => {
    const ustvarjeno = await engineeringRulesRoute.POST(
      req('/api/engineering-rules', token, 'POST', NOVO_PRAVILO(uniq('MONT-DRAFT-UPOKOJ'))),
    )
    const telo = (await ustvarjeno.json()) as Record<string, string>
    createdRuleIds.push(telo.praviloId)
    const res = await versionPatchRoute.PATCH(
      req(`/api/engineering-rules/versions/${telo.verzijaId}`, token, 'PATCH', { action: 'upokoji' }),
      { params: Promise.resolve({ id: telo.verzijaId }) },
    )
    expect(res.status).toBe(409)
  })

  it('§15 zadnja linija — BAZA CHECK zavrne uradno overitev BREZ pregleda (mimo store-plasti)', async () => {
    const ustvarjeno = await engineeringRulesRoute.POST(
      req('/api/engineering-rules', token, 'POST', NOVO_PRAVILO(uniq('MONT-URADNO-AKTIV'))),
    )
    const telo = (await ustvarjeno.json()) as Record<string, string>
    createdRuleIds.push(telo.praviloId)
    // Simuliraj pokvarjeno stanje MIMO store-plasti: CHECK 'erv_uradno_zahteva_pregled'
    // MORA zavrniti vrstico (tretja linija zaščite — vzorec partial UNIQUE R390).
    await expect(
      db.engineeringRuleVersion.update({
        where: { id: telo.verzijaId },
        data: { overitev: 'STATISTICNA' },
      }),
    ).rejects.toThrow()
    // Vrstlica je ostala INFORMATIVNO (napaka ni tiho zapisala polovičnega stanja):
    const vDB = await db.engineeringRuleVersion.findUnique({ where: { id: telo.verzijaId } })
    expect(vDB!.overitev).toBe('INFORMATIVNO')
  })

  it('RBAC: MONTER POST pravilo → 403; MONTER PATCH verzijo → 403', async () => {
    const monter = await createTestUserWithSession(uniq('r393monterverzije'), 'MONTER')
    users.push({ id: monter.user.id })

    const post = await engineeringRulesRoute.POST(
      req('/api/engineering-rules', monter.token, 'POST', NOVO_PRAVILO(uniq('MONT-MONTER'))),
    )
    expect(post.status).toBe(403)
    expect(((await post.json()) as Record<string, string>).detail).toContain('engineering.manage')

    const patch = await versionPatchRoute.PATCH(
      req('/api/engineering-rules/versions/karkoli', monter.token, 'PATCH', { action: 'aktiviraj' }),
      { params: Promise.resolve({ id: 'karkoli' }) },
    )
    expect(patch.status).toBe(403)
  })

  it('manjkajoča obvezna polja → 400 (sifra/naziv/vsebina/vir/overitev)', async () => {
    const res = await engineeringRulesRoute.POST(req('/api/engineering-rules', token, 'POST', { naziv: 'samo naziv' }))
    expect(res.status).toBe(400)
    expect(((await res.json()) as Record<string, string>).error).toContain('obvezno')
  })
})
