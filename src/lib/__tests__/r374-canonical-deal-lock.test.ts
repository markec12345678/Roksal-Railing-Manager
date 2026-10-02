// R374 — KANONIČNI DEAL-LOCK (issue #13, korak R165 iz §2/§7/§8/§16/§17).
// ---------------------------------------------------------------------------
// Integracijski testi NAD ROUTNIMA HANDLERJEMA (POST + GET /api/deal-lock,
// PATCH /api/quotes/[id]) proti testni bazi — isti vzorec kot r153:
//
//   (1) legacy klientov quoteData → 400 (konec klientovega denarja — §2);
//   (2) DRAFT verzija → 409 (nezaključena ponudba se ne podpisuje — §3);
//   (3) TUJA verzija (prečni projekt) → 409 (verzija MORA pripadati projektu);
//   (4) TAMPIRANA verzija (ročni UPDATE totala v DB) → 409 (§16 integriteta);
//   (5) FORGED totals: odvečna denarna polja v telesu NIMAJO učinka —
//       estimatedPrice/marža izhajata IZKLJUČNO iz strežniške verzije;
//   (6) USPEŠEN zaklep nad ISSUED: 200 + verzija → APPROVED (atomarno) +
//       SignatureAudit.quoteVersionId/quoteInputHash (§16 veriga) +
//       marginLocked = NULL (iskreno NEZNANO — §8) + estimatedPrice = total
//       verzije; BOM iz strukturiranih postavk;
//   (7) DVAKRATNI zaklep → 409;
//   (8) GET IDOR: uporabnik BREZ dostopa do projekta → 403 (§17 fix);
//       avtoriziran GET → MINIMALNI DTO (brez storageKey/ip/UA/fingerprint/geo).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import { POST as dealLockPost, GET as dealLockGet } from '@/app/api/deal-lock/route'
import { PATCH as quotePatch } from '@/app/api/quotes/[id]/route'
import { computeQuoteVersion } from '@/lib/quote-versions'
import { getActivePriceBookVersion } from '@/lib/price-book-store'
import { deleteObject } from '@/lib/object-storage'

const BASE = 'http://localhost/api'
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const PODPIS = `data:image/png;base64,${PNG}`

/** Pravokotnik 4 × 1 m (zaprt) — realen vhod za computeQuoteVersion. */
const VHOD = {
  points: [
    { xM: 0, yM: 0, zM: 0 },
    { xM: 4, yM: 0, zM: 0 },
    { xM: 4, yM: 0, zM: 1 },
    { xM: 0, yM: 0, zM: 1 },
  ],
  closed: true,
}

function jsonReq(path: string, token: string | null, init: { method?: string; body?: unknown } = {}): Request {
  return new Request(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
}

function lockReq(token: string | null, body: unknown): Promise<Response> {
  return dealLockPost(jsonReq('/deal-lock', token, { method: 'POST', body })) as unknown as Promise<Response>
}

function patchIssue(token: string | null, id: string): Promise<Response> {
  return quotePatch(jsonReq(`/quotes/${id}`, token, { method: 'PATCH', body: { action: 'issue' } }), {
    params: Promise.resolve({ id }),
  }) as unknown as Promise<Response>
}

/** Ustvari Quote + QuoteVersion (strežniško izračunano iz AKTIVNE knjige). */
async function ustvariVerzijo(
  projectId: string,
  status: 'DRAFT' | 'ISSUED',
): Promise<{ quoteId: string; versionId: string; total: number; inputHash: string }> {
  const active = (await getActivePriceBookVersion())!
  const computed = computeQuoteVersion(VHOD, active.prices)
  const quote = await db.quote.create({
    data: { projectId, status: 'ODPRTA' },
  })
  const version = await db.quoteVersion.create({
    data: {
      quoteId: quote.id,
      versionNumber: 1,
      status,
      inputsJson: VHOD as never,
      linesJson: computed.lines as never,
      subtotal: computed.subtotal,
      vat: computed.vat,
      total: computed.total,
      currency: computed.currency,
      inputHash: computed.inputHash,
      priceBookVersionId: active.id,
    },
  })
  return { quoteId: quote.id, versionId: version.id, total: computed.total, inputHash: computed.inputHash }
}

describe('R374 — KANONIČNI DEAL-LOCK (issue #13 R165)', () => {
  beforeAll(async () => {
    // Čist start (idempotentno):
    await db.signatureAudit.deleteMany({ where: { project: { nazivProjekta: { contains: 'r374-kanon' } } } })
    await db.quoteVersion.deleteMany({ where: { quote: { project: { nazivProjekta: { contains: 'r374-kanon' } } } } })
    await db.quote.deleteMany({ where: { project: { nazivProjekta: { contains: 'r374-kanon' } } } })
    await db.project.deleteMany({ where: { nazivProjekta: { contains: 'r374-kanon' } } })
  })

  afterAll(async () => {
    // Počisti artefakte podpisov (object storage — 0 sirot) + vrstice:
    const znaki = await db.signatureAudit.findMany({
      where: { project: { nazivProjekta: { contains: 'r374-kanon' } } },
      select: { storageKey: true },
    })
    for (const z of znaki) {
      if (z.storageKey) await deleteObject(z.storageKey).catch(() => undefined)
    }
    await db.signatureAudit.deleteMany({ where: { project: { nazivProjekta: { contains: 'r374-kanon' } } } })
    await db.quoteVersion.deleteMany({ where: { quote: { project: { nazivProjekta: { contains: 'r374-kanon' } } } } })
    await db.quote.deleteMany({ where: { project: { nazivProjekta: { contains: 'r374-kanon' } } } })
    await db.project.deleteMany({ where: { nazivProjekta: { contains: 'r374-kanon' } } })
  })

  it('LEGACY quoteData → 400 z jasnim sporočilom (konec klientovega denarja, §2)', async () => {
    const { monter } = await setup()
    const r = await lockReq(monter.token, {
      projectId: 'karkoli',
      quoteData: { items: [], skupajBrezDDV: 1, ddv: 0, skupajZDDV: 1 },
    })
    expect(r.status).toBe(400)
    const telo = await r.json()
    expect(telo.error).toContain('quoteData')
    expect(telo.error).toContain('quoteVersionId')
  })

  it('MANJKAJOČI obvezni podatki → 400', async () => {
    const { monter } = await setup()
    const r = await lockReq(monter.token, { projectId: 'x' })
    expect(r.status).toBe(400)
  })

  it('BREZ prijave → 401', async () => {
    const r = await lockReq(null, { projectId: 'x', quoteVersionId: 'y', customerSignature: PODPIS, monterSignature: PODPIS })
    expect(r.status).toBe(401)
  })

  it('DRAFT verzija → 409 (nezaključena ponudba se ne podpisuje, §3)', async () => {
    const { monter, projekt } = await setup()
    const v = await ustvariVerzijo(projekt.id, 'DRAFT')
    const r = await lockReq(monter.token, {
      projectId: projekt.id,
      quoteVersionId: v.versionId,
      customerName: 'Stranka Test',
      monterName: 'Monter Test',
      customerSignature: PODPIS,
      monterSignature: PODPIS,
    })
    expect(r.status).toBe(409)
    const telo = await r.json()
    expect(telo.error).toContain('DRAFT')
    // Projekt OSTANE nezaklenjen (nič stranskih učinkov):
    const po = await db.project.findUnique({ where: { id: projekt.id }, select: { dealLocked: true } })
    expect(po!.dealLocked).toBe(false)
  })

  it('PREČNI projekt (verzija TUJEGA projekta) → 409', async () => {
    const { monter, projekt, strankaId } = await setup()
    // Verzija pripada projektu A; telo zahteva zaklep projekta B:
    const projektB = await db.project.create({
      data: { nazivProjekta: 'r374-kanon B', status: 'V_TEKU', monterId: monter.user.id, customerId: strankaId },
    })
    const v = await ustvariVerzijo(projekt.id, 'ISSUED')
    const r = await lockReq(monter.token, {
      projectId: projektB.id,
      quoteVersionId: v.versionId,
      customerName: 'S',
      monterName: 'M',
      customerSignature: PODPIS,
      monterSignature: PODPIS,
    })
    expect(r.status).toBe(409)
    await db.project.delete({ where: { id: projektB.id } }).catch(() => undefined)
  })

  it('TAMPIRANA verzija (ročni UPDATE totala) → 409 (§16 integriteta); POVNEJ', async () => {
    const { monter, projekt } = await setup()
    const v = await ustvariVerzijo(projekt.id, 'ISSUED')
    const totalPred = v.total
    // Ročni poseg v DB (simulira tampiranje):
    await db.quoteVersion.update({ where: { id: v.versionId }, data: { total: totalPred - 100 } })
    try {
      const r = await lockReq(monter.token, {
        projectId: projekt.id,
        quoteVersionId: v.versionId,
        customerName: 'S',
        monterName: 'M',
        customerSignature: PODPIS,
        monterSignature: PODPIS,
      })
      expect(r.status).toBe(409)
      const telo = await r.json()
      expect(telo.error).toContain('Integriteta')
    } finally {
      await db.quoteVersion.update({ where: { id: v.versionId }, data: { total: totalPred } })
    }
  })

  it('PATCH issue: DRAFT → ISSUED (200); terminalno → 409; PATCH nad APPROVED ostane 409', async () => {
    const { monter, projekt } = await setup()
    const v = await ustvariVerzijo(projekt.id, 'DRAFT')
    const r = await patchIssue(monter.token, v.versionId)
    expect(r.status).toBe(200)
    const verzija = await db.quoteVersion.findUnique({ where: { id: v.versionId }, select: { status: true } })
    expect(verzija!.status).toBe('ISSUED')
    // ISSUED → ISSUED ni dovoljen prehod (statusni stroj):
    const znova = await patchIssue(monter.token, v.versionId)
    expect(znova.status).toBe(409)
  })

  it('USPEŠEN zaklep nad ISSUED + FORGED totals brez učinka + §16 veriga + §8 marža NULL + dvojni zaklep', async () => {
    const { monter, projekt } = await setup()
    const v = await ustvariVerzijo(projekt.id, 'ISSUED')
    // FORGED: odvečna denarna polja v telesu — strežnik jih IGNORIRA:
    const r = await lockReq(monter.token, {
      projectId: projekt.id,
      quoteVersionId: v.versionId,
      customerName: 'Stranka Kanon',
      monterName: 'Monter Kanon',
      customerSignature: PODPIS,
      monterSignature: PODPIS,
      total: 1,
      skupajZDDV: 1,
      marginLocked: 99999,
      estimatedPrice: 1,
    } as never)
    expect(r.status).toBe(200)
    const telo = await r.json()
    // Strežniška resnica (NE forged vrednosti):
    expect(telo.estimatedPrice).toBe(v.total)
    expect(telo.marginLocked).toBeNull() // §8: referenceCost manjka → iskreno NEZNANO
    expect(telo.quoteVersionId).toBe(v.versionId)
    expect(telo.quoteInputHash).toBe(v.inputHash)
    expect(telo.bomDraft.items.length).toBeGreaterThan(0)

    // Verzija → APPROVED (atomarno ob zaklepu):
    const verzija = await db.quoteVersion.findUnique({ where: { id: v.versionId }, select: { status: true, approvedAt: true } })
    expect(verzija!.status).toBe('APPROVED')
    expect(verzija!.approvedAt).not.toBeNull()

    // §16 veriga: SignatureAudit nosi quoteVersionId + quoteInputHash:
    const znaki = await db.signatureAudit.findMany({ where: { quoteVersionId: v.versionId } })
    expect(znaki).toHaveLength(2)
    for (const z of znaki) {
      expect(z.quoteInputHash).toBe(v.inputHash)
      expect(z.storageKey).toContain('signatures/')
    }

    // Projekt zaklenjen z estimatedPrice = total VERZIJE:
    const po = await db.project.findUnique({
      where: { id: projekt.id },
      select: { dealLocked: true, estimatedPrice: true, marginLocked: true, status: true },
    })
    expect(po!.dealLocked).toBe(true)
    expect(po!.estimatedPrice).toBe(v.total)
    expect(po!.marginLocked).toBeNull()
    expect(po!.status).toBe('ZA_MONTAZO')

    // DVAKRATNI zaklep → ZAVRNJEN (403 — zaklenjen projekt ne dovoljuje VEČ
    // monterjevih sprememb; assertProjectAccess 'update' diha PRED 409
    // vejo — močnejša zaščita kot sam 409; vizija "nič več editanja"):
    const drugi = await lockReq(monter.token, {
      projectId: projekt.id,
      quoteVersionId: v.versionId,
      customerName: 'S',
      monterName: 'M',
      customerSignature: PODPIS,
      monterSignature: PODPIS,
    })
    expect([403, 409]).toContain(drugi.status)
    // In NEGLEJ podatkov NE spremeni (drugi odgovor NI uspešen zaklep):
    const telo2 = await drugi.json()
    expect(telo2.success).toBeUndefined()
  })

  it('GET IDOR: NEDODELJENI monter → 403 (SKLADISCE bere vse — zakonito); avtoriziran GET → MINIMALNI DTO (§17)', async () => {
    const { monter, skladiscnik, projekt } = await setup()
    // IDOR: MONTER, ki NI monter/vodja tega projekta (isMine=false → read zavrnjen).
    // (SKLADISCE bere VSE projekte po zasnovi — material kontekst — NI IDOR.)
    const tujec = await createTestUserWithSession('r374-kanon-tujec', 'MONTER')
    const brez = await dealLockGet(jsonReq(`/deal-lock?projectId=${projekt.id}`, tujec.token))
    expect(brez.status).toBe(403)

    // Avtoriziran GET (monter = lastnik):
    const r = await dealLockGet(jsonReq(`/deal-lock?projectId=${projekt.id}`, monter.token))
    expect(r.status).toBe(200)
    const telo = await r.json()
    // MINIMALNI DTO — občutljiva polja SO ODSTRANJENA iz odgovora:
    const besedilo = JSON.stringify(telo)
    expect(besedilo).not.toContain('storageKey')
    expect(besedilo).not.toContain('ipAddress')
    expect(besedilo).not.toContain('userAgent')
    expect(besedilo).not.toContain('deviceFingerprint')
    expect(besedilo).not.toContain('geoLatitude')
    expect(besedilo).not.toContain('sha256')
    // Podpisni DTO pa nosi kanonično verzijo (§16):
    if (Array.isArray(telo.signatures) && telo.signatures.length > 0) {
      expect(telo.signatures[0].quoteVersionId).toBeTruthy()
    }
    // SKLADISCE (zakonito bere) — tudi ON dobi MINIMALNI DTO:
    const sk = await dealLockGet(jsonReq(`/deal-lock?projectId=${projekt.id}`, skladiscnik.token))
    expect(sk.status).toBe(200)
    expect(JSON.stringify(await sk.json())).not.toContain('storageKey')
  })
})

// ── Setup (ločena fja — preden je uporabljena zgoraj prek dvigovanja) ──────
let setupCache: {
  monter: { user: { id: string }; token: string }
  skladiscnik: { user: { id: string }; token: string }
  projekt: { id: string }
  strankaId: string
} | null = null

async function setup() {
  if (setupCache) return setupCache
  const monter = await createTestUserWithSession('r374-kanon-monter', 'MONTER')
  const skladiscnik = await createTestUserWithSession('r374-kanon-skladisce', 'SKLADISCE')
  // Customer je obvezen FK na projektu (email NI unique → čist start po imenu):
  await db.customer.deleteMany({ where: { ime: 'Stranka r374' } })
  const stranka = await db.customer.create({
    data: { ime: 'Stranka r374', naslov: 'Testna 1', email: 'r374-kanon@test.si' },
  })
  const projekt = await db.project.create({
    data: { nazivProjekta: `r374-kanon ${Date.now()}`, status: 'V_TEKU', monterId: monter.user.id, customerId: stranka.id },
  })
  setupCache = { monter, skladiscnik, projekt, strankaId: stranka.id }
  return setupCache
}
