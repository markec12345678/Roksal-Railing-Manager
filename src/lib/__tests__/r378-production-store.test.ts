// R378 — TRANSAKCIJSKA PLAST PROIZVODNJE (issue #13, korak R167 iz §10).
// ---------------------------------------------------------------------------
// Integracijski testi PLASTI production-store (ustvariProductionOrderVTx /
// prehodProductionOrderVTx / zapisProdukcijeVTx) proti testni bazi:
//
//   (1) ustvarjanje NAD ODOBRENIM BOM (snapshoti vrstic; prioritetna
//       validacija; PLANNED + revizijski vpis atomsko);
//   (2) vrata: DRAFT BOM → 409 (§10 produkcija samo nad odobrenim);
//       prečni projekt → 409; neznan projekt → 404; neznan BOM → 404;
//   (3) zaklenjen projekt: USTVARJANJE 409 (nova zaveza = change order),
//       IZVEDBA obstoječega (prehod + zapis) LAHKO teče naprej (meja R167);
//   (4) prehodi: PLANNED→RELEASED napolni approvedById/approvedAt; izid BREZ
//       razloga → 400; prepovedan rob (PLANNED→IN_PRODUCTION) → 409;
//       terminalno naročilo ne zapisuje → 409;
//   (5) zapis produkcije: remainingQty STREŽNIŠKO izračunan (klientov vnos
//       se NE sprejme — forged total test); produced+scrapped > planned → 409
//       (sprememba načrta je change order); rejected > produced → 400/409.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import { POST as bomPost } from '@/app/api/bom/route'
import { PATCH as bomVersionPatch } from '@/app/api/bom/[id]/route'
import { computeQuoteVersion } from '@/lib/quote-versions'
import { getActivePriceBookVersion } from '@/lib/price-book-store'
import {
  ProductionStoreError,
  prehodProductionOrderVTx,
  ustvariProductionOrderVTx,
  zapisProdukcijeVTx,
} from '../production-store'

const OZNAKA = 'r378-produkcija'

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

async function pocisti() {
  const projekti = await db.project.findMany({ where: { nazivProjekta: { contains: OZNAKA } }, select: { id: true } })
  const ids = projekti.map((p) => p.id)
  if (ids.length > 0) {
    await db.installationRecord.deleteMany({ where: { projectId: { in: ids } } }) // vrstice kaskadajo
    await db.productionOrder.deleteMany({ where: { projectId: { in: ids } } }) // vrstice/operacije kaskadajo
    await db.auditLog.deleteMany({ where: { projectId: { in: ids } } })
    await db.bOM.deleteMany({ where: { projectId: { in: ids } } }) // verzije+vrstice kaskadajo
    await db.quote.deleteMany({ where: { projectId: { in: ids } } })
    await db.project.deleteMany({ where: { id: { in: ids } } })
  }
  await db.customer.deleteMany({ where: { ime: `Stranka ${OZNAKA}` } })
}

/** Kontekst revizije za direktne klice plasti (brez HTTP). */
function revizija(userId: string | null) {
  return {
    request: new Request('http://localhost/vitest', { headers: { 'user-agent': 'vitest' } }),
    session: null,
    userId,
  }
}

// ── Skupni kontekst ─────────────────────────────────────────────────────────
let monter: { user: { id: string }; token: string }
let projektId: string
let projektZaklenjenId: string
let bomVerzijaId: string
let bomVrsticaId: string
let bomVrsticaQty: number

beforeAll(async () => {
  await pocisti()
  monter = await createTestUserWithSession(`${OZNAKA}-monter`, 'MONTER')
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

  // ODOBRENA BOM verzija prek kanonskih rut (POST /api/bom + PATCH approve):
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
  const prvaVrstica = await db.bOMLine.findFirst({ where: { bomVersionId: bomVerzijaId }, orderBy: { lineOrder: 'asc' } })
  if (!prvaVrstica) throw new Error('BOM verzija nima vrstic')
  bomVrsticaId = prvaVrstica.id
  bomVrsticaQty = prvaVrstica.quantity.toNumber()
})

afterAll(pocisti)

describe('R378 — ustvariProductionOrderVTx: vrata + snapshoti (§10)', () => {
  it('USPEŠNO ustvarjanje nad ODOBRENIM BOM: PLANNED + vrstice snapshot + revizija', async () => {
    const zdaj = new Date()
    const n = await db.$transaction((tx) =>
      ustvariProductionOrderVTx(tx, {
        projectId: projektId,
        bomVersionId: bomVerzijaId,
        actorId: monter.user.id,
        now: zdaj,
        revizija: revizija(monter.user.id),
      }),
    )
    expect(n.status).toBe('PLANNED')
    expect(n.priority).toBe('NORMALNA')
    expect(n.bomVersionId).toBe(bomVerzijaId)
    expect(n.lineCount).toBeGreaterThan(3)
    // DB resnica: vrstice so snapshoti (planned = BOMLine.quantity):
    const vrstice = await db.productionOrderLine.findMany({ where: { productionOrderId: n.orderId } })
    const prva = vrstice.find((l) => l.bomLineId === bomVrsticaId)!
    expect(prva.plannedQty.toNumber()).toBe(bomVrsticaQty)
    expect(prva.remainingQty.toNumber()).toBe(bomVrsticaQty)
    expect(prva.producedQty.toNumber()).toBe(0)
    // Revizijski vpis ATOMSKO z ustvarjanjem:
    const revizije = await db.auditLog.findMany({
      where: { projectId: projektId, akcija: 'PRODUCTION_ORDER_CREATED' },
    })
    expect(revizije.length).toBeGreaterThan(0)
  })

  it('DRAFT BOM verzija → 409 (produkcija SAMO nad odobrenim, §10)', async () => {
    // Ročno dodana DRAFT verzija nad istim nosilcem:
    const bom = await db.bOMVersion.findUnique({ where: { id: bomVerzijaId }, select: { bomId: true } })
    const draft = await db.bOMVersion.create({
      data: {
        bomId: bom!.bomId,
        versionNumber: 99,
        status: 'DRAFT',
        sourceQuoteVersionId: (await db.quoteVersion.findFirst({ where: { quote: { projectId: projektId } } }))!.id,
        priceBookVersionId: (await getActivePriceBookVersion())!.id,
        productSdkVersion: 'quote-v1',
        layoutFingerprint: 'vitest-draft',
      },
    })
    await expect(
      db.$transaction((tx) =>
        ustvariProductionOrderVTx(tx, {
          projectId: projektId,
          bomVersionId: draft.id,
          actorId: monter.user.id,
          now: new Date(),
          revizija: revizija(monter.user.id),
        }),
      ),
    ).rejects.toMatchObject({ suggestedStatus: 409 })
    await db.bOMVersion.delete({ where: { id: draft.id } })
  })

  it('prečni projekt → 409; neznan projekt → 404; neznan BOM → 404', async () => {
    // ODKLENJEN drug projekt (zaklenjeni strelja prej z vrati zaklepa):
    const stranka = await db.customer.findFirstOrThrow({ where: { ime: `Stranka ${OZNAKA}` } })
    const drugi = await db.project.create({
      data: { nazivProjekta: `${OZNAKA} drugi ${Date.now()}`, status: 'V_TEKU', monterId: monter.user.id, customerId: stranka.id },
    })
    await expect(
      db.$transaction((tx) =>
        ustvariProductionOrderVTx(tx, {
          projectId: drugi.id, // drug projekt = prečni
          bomVersionId: bomVerzijaId,
          actorId: monter.user.id,
          now: new Date(),
          revizija: revizija(monter.user.id),
        }),
      ),
    ).rejects.toMatchObject({ message: expect.stringContaining('prečni'), suggestedStatus: 409 })
    await db.project.delete({ where: { id: drugi.id } }).catch(() => undefined)

    await expect(
      db.$transaction((tx) =>
        ustvariProductionOrderVTx(tx, {
          projectId: 'neobstaja',
          bomVersionId: bomVerzijaId,
          actorId: monter.user.id,
          now: new Date(),
          revizija: revizija(monter.user.id),
        }),
      ),
    ).rejects.toMatchObject({ suggestedStatus: 404 })

    await expect(
      db.$transaction((tx) =>
        ustvariProductionOrderVTx(tx, {
          projectId: projektId,
          bomVersionId: 'neobstaja',
          actorId: monter.user.id,
          now: new Date(),
          revizija: revizija(monter.user.id),
        }),
      ),
    ).rejects.toMatchObject({ suggestedStatus: 404 })
  })

  it('ZAKLENJEN projekt: ustvarjanje 409 (nova zaveza = change order, meja R167)', async () => {
    await expect(
      db.$transaction((tx) =>
        ustvariProductionOrderVTx(tx, {
          projectId: projektZaklenjenId,
          bomVersionId: bomVerzijaId,
          actorId: monter.user.id,
          now: new Date(),
          revizija: revizija(monter.user.id),
        }),
      ),
    ).rejects.toMatchObject({ suggestedStatus: 409 })
  })

  it('neveljavna prioriteta → 400 (jedro validira NIZKA/NORMALNA/URGENTNO)', async () => {
    await expect(
      db.$transaction((tx) =>
        ustvariProductionOrderVTx(tx, {
          projectId: projektId,
          bomVersionId: bomVerzijaId,
          priority: 'HITRO-NAREDIL',
          actorId: monter.user.id,
          now: new Date(),
          revizija: revizija(monter.user.id),
        }),
      ),
    ).rejects.toMatchObject({ suggestedStatus: 400 })
  })
})

describe('R378 — prehodProductionOrderVTx: matrika + razlogi + izvedba po zaklepu', () => {
  let orderId: string

  beforeAll(async () => {
    const n = await db.$transaction((tx) =>
      ustvariProductionOrderVTx(tx, {
        projectId: projektId,
        bomVersionId: bomVerzijaId,
        priority: 'URGENTNO',
        actorId: monter.user.id,
        now: new Date(),
        revizija: revizija(monter.user.id),
      }),
    )
    orderId = n.orderId
  })

  it('PLANNED→RELEASED napolni approvedById/approvedAt (odobritev izvedbe)', async () => {
    const prehod = await db.$transaction((tx) =>
      prehodProductionOrderVTx(tx, {
        orderId,
        to: 'RELEASED',
        actorId: monter.user.id,
        now: new Date(),
        revizija: revizija(monter.user.id),
      }),
    )
    expect(prehod.to).toBe('RELEASED')
    const nalog = await db.productionOrder.findUnique({ where: { id: orderId } })
    expect(nalog!.approvedById).toBe(monter.user.id)
    expect(nalog!.approvedAt).not.toBeNull()
  })

  it('izid BREZ razloga → 400 (odmik brez razloga = tiha mutacija zgodovine)', async () => {
    await expect(
      db.$transaction((tx) =>
        prehodProductionOrderVTx(tx, {
          orderId,
          to: 'SCRAPPED',
          actorId: monter.user.id,
          now: new Date(),
          revizija: revizija(monter.user.id),
        }),
      ),
    ).rejects.toMatchObject({ suggestedStatus: 400 })
  })

  it('izid Z razlogom uspe in je TERMINALEN ( SCRAPPED ne oživi)', async () => {
    const prehod = await db.$transaction((tx) =>
      prehodProductionOrderVTx(tx, {
        orderId,
        to: 'SCRAPPED',
        reason: 'poškodba profila pri rezanju',
        actorId: monter.user.id,
        now: new Date(),
        revizija: revizija(monter.user.id),
      }),
    )
    expect(prehod.to).toBe('SCRAPPED')
    await expect(
      db.$transaction((tx) =>
        prehodProductionOrderVTx(tx, {
          orderId,
          to: 'PLANNED',
          reason: 'poskus oživljanja',
          actorId: monter.user.id,
          now: new Date(),
          revizija: revizija(monter.user.id),
        }),
      ),
    ).rejects.toMatchObject({ suggestedStatus: 409 })
  })

  it('prepovedan rob (PLANNED→IN_PRODUCTION preskok izpusta) → 409', async () => {
    const n = await db.$transaction((tx) =>
      ustvariProductionOrderVTx(tx, {
        projectId: projektId,
        bomVersionId: bomVerzijaId,
        actorId: monter.user.id,
        now: new Date(),
        revizija: revizija(monter.user.id),
      }),
    )
    await expect(
      db.$transaction((tx) =>
        prehodProductionOrderVTx(tx, {
          orderId: n.orderId,
          to: 'IN_PRODUCTION',
          actorId: monter.user.id,
          now: new Date(),
          revizija: revizija(monter.user.id),
        }),
      ),
    ).rejects.toMatchObject({ suggestedStatus: 409 })
    // Počisti temu testu svoj nalog:
    await db.productionOrder.delete({ where: { id: n.orderId } })
  })
})

describe('R378 — zapisProdukcijeVTx: strežniški totali + invarianti (§10)', () => {
  let orderId: string

  beforeAll(async () => {
    const n = await db.$transaction((tx) =>
      ustvariProductionOrderVTx(tx, {
        projectId: projektId,
        bomVersionId: bomVerzijaId,
        actorId: monter.user.id,
        now: new Date(),
        revizija: revizija(monter.user.id),
      }),
    )
    orderId = n.orderId
    // Nalog v IN_PRODUCTION (zapis produkcije smisen nad izdelavo):
    await db.$transaction((tx) =>
      prehodProductionOrderVTx(tx, {
        orderId,
        to: 'RELEASED',
        actorId: monter.user.id,
        now: new Date(),
        revizija: revizija(monter.user.id),
      }),
    )
    await db.$transaction((tx) =>
      prehodProductionOrderVTx(tx, {
        orderId,
        to: 'IN_PRODUCTION',
        actorId: monter.user.id,
        now: new Date(),
        revizija: revizija(monter.user.id),
      }),
    )
  })

  it('zapis: remainingQty STREŽNIŠKO izračunan (planned − produced − scrapped); klient NE poda totala', async () => {
    const izdelaj = Math.max(1, Math.floor(bomVrsticaQty / 2))
    const zapis = await db.$transaction((tx) =>
      zapisProdukcijeVTx(tx, {
        orderId,
        bomLineId: bomVrsticaId,
        producedQty: izdelaj,
        actorId: monter.user.id,
        now: new Date(),
        revizija: revizija(monter.user.id),
      }),
    )
    // Plast NE sprejme remainingQty od klienta (ni niti v vhodu) — strežnik
    // izračuna: planned − produced − scrapped:
    expect(zapis.remainingQty).toBe(bomVrsticaQty - izdelaj)
    expect(zapis.producedQty).toBe(izdelaj)
  })

  it('produced + scrapped > planned → 409 (sprememba načrta je change order)', async () => {
    await expect(
      db.$transaction((tx) =>
        zapisProdukcijeVTx(tx, {
          orderId,
          bomLineId: bomVrsticaId,
          producedQty: bomVrsticaQty + 5,
          actorId: monter.user.id,
          now: new Date(),
          revizija: revizija(monter.user.id),
        }),
      ),
    ).rejects.toMatchObject({ message: expect.stringContaining('change order'), suggestedStatus: 409 })
  })

  it('rejected > produced → zavrnjeno (ne moreš zavrniti neizdelanega)', async () => {
    await expect(
      db.$transaction((tx) =>
        zapisProdukcijeVTx(tx, {
          orderId,
          bomLineId: bomVrsticaId,
          producedQty: 2,
          rejectedQty: 3,
          actorId: monter.user.id,
          now: new Date(),
          revizija: revizija(monter.user.id),
        }),
      ),
    ).rejects.toBeInstanceOf(ProductionStoreError)
  })

  it('neznana BOM vrstica za ta nalog → 404; neznan nalog → 404', async () => {
    await expect(
      db.$transaction((tx) =>
        zapisProdukcijeVTx(tx, {
          orderId,
          bomLineId: 'neobstaja',
          producedQty: 1,
          actorId: monter.user.id,
          now: new Date(),
          revizija: revizija(monter.user.id),
        }),
      ),
    ).rejects.toMatchObject({ suggestedStatus: 404 })

    await expect(
      db.$transaction((tx) =>
        zapisProdukcijeVTx(tx, {
          orderId: 'neobstaja',
          bomLineId: bomVrsticaId,
          producedQty: 1,
          actorId: monter.user.id,
          now: new Date(),
          revizija: revizija(monter.user.id),
        }),
      ),
    ).rejects.toMatchObject({ suggestedStatus: 404 })
  })

  it('terminalno naročilo (SCRAPPED) ne zapisuje produkcije → 409', async () => {
    const n = await db.$transaction((tx) =>
      ustvariProductionOrderVTx(tx, {
        projectId: projektId,
        bomVersionId: bomVerzijaId,
        actorId: monter.user.id,
        now: new Date(),
        revizija: revizija(monter.user.id),
      }),
    )
    await db.$transaction((tx) =>
      prehodProductionOrderVTx(tx, {
        orderId: n.orderId,
        to: 'SCRAPPED',
        reason: 'vitest terminalni zapis',
        actorId: monter.user.id,
        now: new Date(),
        revizija: revizija(monter.user.id),
      }),
    )
    await expect(
      db.$transaction((tx) =>
        zapisProdukcijeVTx(tx, {
          orderId: n.orderId,
          bomLineId: bomVrsticaId,
          producedQty: 1,
          actorId: monter.user.id,
          now: new Date(),
          revizija: revizija(monter.user.id),
        }),
      ),
    ).rejects.toMatchObject({ suggestedStatus: 409 })
    await db.productionOrder.delete({ where: { id: n.orderId } })
  })
})

describe('R378 — meja zaklepa: IZVEDBA obstoječega teče naprej (R167)', () => {
  it('prehod + zapis nad obstoječim nalogom OB zaklepu projekta USPEJO', async () => {
    // Nalog ustvarjen PRED zaklepom (zgoraj, nad projektId):
    const n = await db.$transaction((tx) =>
      ustvariProductionOrderVTx(tx, {
        projectId: projektId,
        bomVersionId: bomVerzijaId,
        actorId: monter.user.id,
        now: new Date(),
        revizija: revizija(monter.user.id),
      }),
    )
    // Zakleni projekt (fizika dela se ne sme ustaviti):
    await db.project.update({ where: { id: projektId }, data: { dealLocked: true } })
    try {
      const prehod = await db.$transaction((tx) =>
        prehodProductionOrderVTx(tx, {
          orderId: n.orderId,
          to: 'RELEASED',
          actorId: monter.user.id,
          now: new Date(),
          revizija: revizija(monter.user.id),
        }),
      )
      expect(prehod.to).toBe('RELEASED')
      const zapis = await db.$transaction((tx) =>
        zapisProdukcijeVTx(tx, {
          orderId: n.orderId,
          bomLineId: bomVrsticaId,
          producedQty: 1,
          actorId: monter.user.id,
          now: new Date(),
          revizija: revizija(monter.user.id),
        }),
      )
      expect(zapis.producedQty).toBe(1)
    } finally {
      await db.project.update({ where: { id: projektId }, data: { dealLocked: false } })
      await db.productionOrder.delete({ where: { id: n.orderId } }).catch(() => undefined)
    }
  })
})
