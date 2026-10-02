// R378 — AS-INSTALLED ZAPISI (issue #13, korak R167 iz §9 "tretja resnica").
// ---------------------------------------------------------------------------
// Integracijski testi NAD ROUTAMI (/api/installation-records, /api/
// installation-records/[id]) proti testni bazi — isti vzorec kot r376:
//
//   (1) POST: ustvari DRAFT verzijo proti ODOBRENI BOM; VEZANA vrstica dobí
//       internalSku SNAPSHOT strežniško (klientov SKU laž ne uspe);
//   (2) vrata: DRAFT BOM → 409; prečni projekt → 409; zaklenjen projekt →
//       409 (nova zaveza = change order, meja R167); SKLADISCE brez
//       quotes.create → 403; vrstica s količino 0 → 400; podvojen bomLineId
//       → 400; neizvirščan material (bomLineId NULL) DOVOLJEN;
//   (3) verzioniranje: druga verzija zapisa = versionNumber 2 (§9 revizija
//       = nova verzija, nikoli mutacija);
//   (4) PATCH approve: DRAFT → POTRJENO + handover dokaz + revizijski vpis;
//       POTRJENO terminalno (drugi approve → 409);
//   (5) potrditev OB zaklepu projekta USPE (meja R167 — fizika se ni
//       ustavila; NOVA verzija po zaklepu pa je blokirana v POST);
//   (6) GET seznam + GET detajl: minimalni DTO (vrstice + defects povprek).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import { POST as bomPost } from '@/app/api/bom/route'
import { PATCH as bomVersionPatch } from '@/app/api/bom/[id]/route'
import { POST as irPost, GET as irList } from '@/app/api/installation-records/route'
import { GET as irGet, PATCH as irPatch } from '@/app/api/installation-records/[id]/route'
import { computeQuoteVersion } from '@/lib/quote-versions'
import { getActivePriceBookVersion } from '@/lib/price-book-store'

const OZNAKA = 'r378-installed'

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
  return new Request(`http://localhost/api${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
}

function postZapis(
  token: string | null,
  projectId: string,
  bomVersionId: string,
  lines: unknown[],
  extra: Record<string, unknown> = {},
): Promise<Response> {
  return irPost(
    jsonReq('/installation-records', token, { method: 'POST', body: { projectId, bomVersionId, lines, ...extra } }),
  ) as unknown as Promise<Response>
}

function patchApprove(token: string | null, id: string, extra: Record<string, unknown> = {}): Promise<Response> {
  return irPatch(jsonReq(`/installation-records/${id}`, token, { method: 'PATCH', body: { action: 'approve', ...extra } }), {
    params: Promise.resolve({ id }),
  }) as unknown as Promise<Response>
}

async function pocisti() {
  const projekti = await db.project.findMany({ where: { nazivProjekta: { contains: OZNAKA } }, select: { id: true } })
  const ids = projekti.map((p) => p.id)
  if (ids.length > 0) {
    await db.installationRecord.deleteMany({ where: { projectId: { in: ids } } }) // vrstice kaskadajo
    await db.productionOrder.deleteMany({ where: { projectId: { in: ids } } })
    await db.auditLog.deleteMany({ where: { projectId: { in: ids } } })
    await db.bOM.deleteMany({ where: { projectId: { in: ids } } })
    await db.quote.deleteMany({ where: { projectId: { in: ids } } })
    await db.project.deleteMany({ where: { id: { in: ids } } })
  }
  await db.customer.deleteMany({ where: { ime: `Stranka ${OZNAKA}` } })
}

// ── Skupni kontekst ─────────────────────────────────────────────────────────
let monter: { user: { id: string }; token: string }
let vodja: { user: { id: string }; token: string }
let skladiscnik: { user: { id: string }; token: string }
let projektId: string
let projektZaklenjenId: string
let bomVerzijaId: string
let bomVrsticaId: string
let bomVrsticaSku: string
let bomVrsticaQty: number

beforeAll(async () => {
  await pocisti()
  monter = await createTestUserWithSession(`${OZNAKA}-monter`, 'MONTER')
  vodja = await createTestUserWithSession(`${OZNAKA}-vodja`, 'VODJA')
  skladiscnik = await createTestUserWithSession(`${OZNAKA}-skladisce`, 'SKLADISCE')
  const stranka = await db.customer.create({
    data: { ime: `Stranka ${OZNAKA}`, naslov: 'Testna 1', email: `${OZNAKA}@test.si` },
  })
  const projekt = await db.project.create({
    data: { nazivProjekta: `${OZNAKA} ${Date.now()}`, status: 'V_TEKU', monterId: monter.user.id, customerId: stranka.id },
  })
  projektId = projekt.id
  const projektZaklenjen = await db.project.create({
    data: {
      nazivProjekta: `${OZNAKA} zaklenjen ${Date.now()}`,
      status: 'V_TEKU',
      monterId: monter.user.id,
      customerId: stranka.id,
      dealLocked: true,
    },
  })
  projektZaklenjenId = projektZaklenjen.id

  // ODOBRENA BOM verzija (enako kot r378-production-store):
  const active = (await getActivePriceBookVersion())!
  const computed = computeQuoteVersion(VHOD, active.prices)
  const quote = await db.quote.create({ data: { projectId: projektId, status: 'ODPRTA' } })
  const version = await db.quoteVersion.create({
    data: {
      quoteId: quote.id,
      versionNumber: 1,
      status: 'ISSUED',
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
  const ustvarjena = await bomPost(
    jsonReq('/bom', monter.token, { method: 'POST', body: { projectId: projektId, quoteVersionId: version.id } }),
  )
  if (ustvarjena.status !== 201) throw new Error(`POST /api/bom ni uspel: ${ustvarjena.status}`)
  const bomTelo = (await ustvarjena.json()) as { version: { id: string } }
  const odobrena = await bomVersionPatch(
    jsonReq(`/bom/${bomTelo.version.id}`, monter.token, { method: 'PATCH', body: { action: 'approve' } }),
    { params: Promise.resolve({ id: bomTelo.version.id }) },
  )
  if (odobrena.status !== 200) throw new Error(`PATCH approve ni uspel: ${odobrena.status}`)
  bomVerzijaId = bomTelo.version.id
  const prva = await db.bOMLine.findFirst({ where: { bomVersionId: bomVerzijaId }, orderBy: { lineOrder: 'asc' } })
  if (!prva) throw new Error('BOM verzija nima vrstic')
  bomVrsticaId = prva.id
  bomVrsticaSku = prva.internalSku
  bomVrsticaQty = prva.quantity.toNumber()
})

afterAll(pocisti)

describe('R378 — POST /api/installation-records: ustvarjanje DRAFT verzije (§9)', () => {
  it('USPEŠNO: 201 + DRAFT v1 + VEZANA vrstica dobí SKU snapshot STREŽNIŠKO', async () => {
    const r = await postZapis(monter.token, projektId, bomVerzijaId, [
      // Klient pošlje LAŽNI SKU — strežnik ga PREPISHE z BOMLine snapshotom:
      { bomLineId: bomVrsticaId, internalSku: 'LAŽNI-SKU', installedQty: Math.max(1, bomVrsticaQty - 1), unit: 'kos' },
      { bomLineId: null, internalSku: 'IZVENSKI-VIJAK-M8', installedQty: 4, unit: 'kos', wasteQty: 1 },
    ])
    expect(r.status).toBe(201)
    const telo = await r.json()
    expect(telo.record.status).toBe('DRAFT')
    expect(telo.record.versionNumber).toBe(1)
    expect(telo.record.lineCount).toBe(2)
    // DB resnica: SKU vezane vrstice = BOMLine.internalSku (ne klientov):
    const vrstice = await db.installationRecordLine.findMany({ where: { installationRecordId: telo.record.id } })
    const vezana = vrstice.find((l) => l.bomLineId === bomVrsticaId)!
    expect(vezana.internalSku).toBe(bomVrsticaSku)
    expect(vezana.internalSku).not.toBe('LAŽNI-SKU')
    const izvencna = vrstice.find((l) => l.bomLineId === null)!
    expect(izvencna.internalSku).toBe('IZVENSKI-VIJAK-M8')
  })

  it('SKLADISCE (brez quotes.create) → 403', async () => {
    const r = await postZapis(skladiscnik.token, projektId, bomVerzijaId, [
      { bomLineId: bomVrsticaId, internalSku: bomVrsticaSku, installedQty: 1, unit: 'kos' },
    ])
    expect(r.status).toBe(403)
  })

  it('količina 0 → 400 (vgrajeno nič je laž); podvojen bomLineId → 400', async () => {
    const r0 = await postZapis(monter.token, projektId, bomVerzijaId, [
      { bomLineId: bomVrsticaId, internalSku: bomVrsticaSku, installedQty: 0, unit: 'kos' },
    ])
    expect(r0.status).toBe(400)

    const rd = await postZapis(monter.token, projektId, bomVerzijaId, [
      { bomLineId: bomVrsticaId, internalSku: bomVrsticaSku, installedQty: 1, unit: 'kos' },
      { bomLineId: bomVrsticaId, internalSku: bomVrsticaSku, installedQty: 2, unit: 'kos' },
    ])
    expect(rd.status).toBe(400)
  })

  it('prečni bomLineId (tuja verzija) → 409', async () => {
    // Vrstica DRAUGE BOM verzije (isti projekt, nova DRAFT verzija):
    const bom = await db.bOMVersion.findUnique({ where: { id: bomVerzijaId }, select: { bomId: true } })
    const qv = await db.quoteVersion.findFirstOrThrow({ where: { quote: { projectId: projektId } } })
    const druga = await db.bOMVersion.create({
      data: {
        bomId: bom!.bomId,
        versionNumber: 98,
        status: 'DRAFT',
        sourceQuoteVersionId: qv.id,
        priceBookVersionId: (await getActivePriceBookVersion())!.id,
        productSdkVersion: 'quote-v1',
        layoutFingerprint: 'vitest-installed-cross',
      },
    })
    const tujaVrstica = await db.bOMLine.create({
      data: {
        bomVersionId: druga.id,
        lineOrder: 1,
        internalSku: 'TUJA-VRSTICA',
        category: 'OTHER',
        descriptionSnapshot: 'tuja',
        quantity: 1,
        unit: 'kos',
        calculationRuleVersion: 'quote-v1',
        status: 'AKTIVEN',
      },
    })
    const r = await postZapis(monter.token, projektId, bomVerzijaId, [
      { bomLineId: tujaVrstica.id, internalSku: 'TUJA-VRSTICA', installedQty: 1, unit: 'kos' },
    ])
    expect(r.status).toBe(409)
    await db.bOMVersion.delete({ where: { id: druga.id } })
  })

  it('ZAKLENJEN projekt → 409 (nova zaveza = change order, meja R167)', async () => {
    // VODJA (manager): prečka projektna vrata dostopa, da strelja VRATA
    // ZAKLEPA v plasti (monter na zaklenjenem projektu dobi 403 od RBAC —
    // zaklenjen dogovor ne dovoljuje več monterjevih sprememb, kanon access.ts):
    const r = await postZapis(vodja.token, projektZaklenjenId, bomVerzijaId, [
      { bomLineId: null, internalSku: 'X', installedQty: 1, unit: 'kos' },
    ])
    // bomVersionId ne pripada zaklenjenemu projektu → prečni (409); oboje 409:
    expect(r.status).toBe(409)
  })
})

describe('R378 — verzioniranje + potrditev (§9: revizija = nova verzija)', () => {
  it('druga verzija = versionNumber 2; DRAFT ostane DRAFT', async () => {
    const r = await postZapis(monter.token, projektId, bomVerzijaId, [
      { bomLineId: bomVrsticaId, internalSku: bomVrsticaSku, installedQty: 1, unit: 'kos' },
    ])
    expect(r.status).toBe(201)
    const telo = await r.json()
    expect(telo.record.versionNumber).toBe(2)
    expect(telo.record.status).toBe('DRAFT')
  })

  it('PATCH approve: DRAFT → POTRJENO + handover dokaz + revizijski vpis', async () => {
    // Najprej še en DRAFT (v3), ki ga bomo potrdili:
    const r = await postZapis(monter.token, projektId, bomVerzijaId, [
      { bomLineId: bomVrsticaId, internalSku: bomVrsticaSku, installedQty: 2, unit: 'kos' },
    ], { defects: [{ opomba: 'manjka pokrovna letev', reseno: false }] })
    expect(r.status).toBe(201)
    const { record } = await r.json()

    const potrditev = await patchApprove(monter.token, record.id, {
      handoverName: 'Janez Novak',
      handoverAt: '2026-10-05T10:00:00.000Z',
    })
    expect(potrditev.status).toBe(200)
    const telo = await potrditev.json()
    expect(telo.record.status).toBe('POTRJENO')
    expect(telo.record.handoverName).toBe('Janez Novak')

    // DB resnica + revizijski vpis:
    const zapis = await db.installationRecord.findUnique({ where: { id: record.id } })
    expect(zapis!.status).toBe('POTRJENO')
    expect(zapis!.approvedById).toBe(monter.user.id)
    const revizije = await db.auditLog.findMany({
      where: { projectId: projektId, akcija: 'INSTALLATION_RECORD_APPROVED' },
    })
    expect(revizije.length).toBeGreaterThan(0)

    // POTRJENO je TERMINALNO — drugi approve → 409:
    const znova = await patchApprove(monter.token, record.id)
    expect(znova.status).toBe(409)
  })

  it('potrditev OB zaklepu projekta USPE (meja R167 — fizika se ni ustavila)', async () => {
    const r = await postZapis(monter.token, projektId, bomVerzijaId, [
      { bomLineId: null, internalSku: 'ZAKLEP-TEST', installedQty: 1, unit: 'kos' },
    ])
    expect(r.status).toBe(201)
    const { record } = await r.json()
    await db.project.update({ where: { id: projektId }, data: { dealLocked: true } })
    try {
      // VODJA: zaklenjen projekt za monterja pomeni 403 (RBAC kanon), potrditev
      // izvedbene resnice pa je meja R167 — manager jo izvede:
      const potrditev = await patchApprove(vodja.token, record.id, { handoverName: 'Skrbnik' })
      expect(potrditev.status).toBe(200)
      const telo = await potrditev.json()
      expect(telo.record.status).toBe('POTRJENO')
      // NOVA verzija po zaklepu pa je BLOKIRANA (POST → 409):
      const nova = await postZapis(vodja.token, projektId, bomVerzijaId, [
        { bomLineId: null, internalSku: 'NE-SME', installedQty: 1, unit: 'kos' },
      ])
      expect(nova.status).toBe(409)
    } finally {
      await db.project.update({ where: { id: projektId }, data: { dealLocked: false } })
    }
  })
})

describe('R378 — GET seznam + detajl (§17 minimalni DTO)', () => {
  it('GET ?projectId= seznam verzij padajoče po verziji; detajl z defects povprek', async () => {
    const seznam = await irList(jsonReq(`/installation-records?projectId=${projektId}`, monter.token))
    expect(seznam.status).toBe(200)
    const telo = await seznam.json()
    expect(Array.isArray(telo.records)).toBe(true)
    expect(telo.records.length).toBeGreaterThanOrEqual(3)
    // Padajoče po versionNumber:
    const stevilke = telo.records.map((z: { versionNumber: number }) => z.versionNumber)
    expect([...stevilke].sort((a: number, b: number) => b - a)).toEqual(stevilke)

    // Detajl POTRJENE verzije Z NAPAKAMI (iskreno iz baze — več POTRJENIH
    // verzij obstaja, seznam ne nosi defects):
    const zDefekti = await db.installationRecord.findFirstOrThrow({
      where: { projectId: projektId, status: 'POTRJENO', defectsJson: { not: '[]' } },
    })
    const detajl = await irGet(jsonReq(`/installation-records/${zDefekti.id}`, monter.token), {
      params: Promise.resolve({ id: zDefekti.id }),
    })
    expect(detajl.status).toBe(200)
    const d = await detajl.json()
    expect(d.record.defects).toEqual([{ opomba: 'manjka pokrovna letev', reseno: false }])
    expect(Array.isArray(d.record.lines)).toBe(true)
  })

  it('GET ?projectId= brez zapisov → prazen seznam (iskrena praznina, ne 404)', async () => {
    const r = await irList(jsonReq(`/installation-records?projectId=${projektZaklenjenId}`, monter.token))
    expect(r.status).toBe(200)
    const telo = await r.json()
    expect(telo.records).toEqual([])
  })
})
