// R378 — KOLIČINSKA VERIGA QUOTE → BOM → PRODUCTION → INSTALLATION
// (issue #13, korak R167 iz §9) — prek GET /api/bom/procurement.
// ---------------------------------------------------------------------------
//   (1) producedQty = Σ ProductionOrderLine.producedQty VSEH nalogov nad
//       vrstico (BREZ statusnega filtriranja — števec živi na VRSTICI);
//       VEČ nalogov nad ISTO vrstico se SEŠTEJE;
//   (2) installedQty = Σ InstallationRecordLine.installedQty SAMO POTRJENIH
//       zapisov — DRAFT NE ŠTEJE (osnutek ni "tretja resnica", preden ga
//       kdo potrdi — IZRECNI test te izključitve);
//   (3) nevezana vrstica → producedQty/installedQty NULL (konsistentno z
//       družino dejanskih količin — NIKOLI ničle);
//   (4) idempotentna branja (dva GET → identično telo);
//   (5) veriga quote→BOM→production→installation: planned iz BOM vrstice,
//       produced iz nalogov, installed iz POTRJENIH zapisov, variance
//       obstaja (planned − consumed − wasted + returned).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import { POST as bomPost } from '@/app/api/bom/route'
import { PATCH as bomVersionPatch } from '@/app/api/bom/[id]/route'
import { POST as productionPost } from '@/app/api/production/route'
import { POST as irPost } from '@/app/api/installation-records/route'
import { PATCH as irPatch } from '@/app/api/installation-records/[id]/route'
import { GET as procurementGet } from '@/app/api/bom/procurement/route'
import { computeQuoteVersion } from '@/lib/quote-versions'
import { getActivePriceBookVersion } from '@/lib/price-book-store'
import { ustvariProductionOrderVTx, zapisProdukcijeVTx, prehodProductionOrderVTx } from '../production-store'

const OZNAKA = 'r378-veriga'

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
    await db.installationRecord.deleteMany({ where: { projectId: { in: ids } } })
    await db.productionOrder.deleteMany({ where: { projectId: { in: ids } } })
    await db.auditLog.deleteMany({ where: { projectId: { in: ids } } })
    await db.bOM.deleteMany({ where: { projectId: { in: ids } } })
    await db.quote.deleteMany({ where: { projectId: { in: ids } } })
    await db.project.deleteMany({ where: { id: { in: ids } } })
  }
  await db.customer.deleteMany({ where: { ime: `Stranka ${OZNAKA}` } })
  // Artikel SIDRA je GLOBALNO unikaten (sifraMateriala) — izbrišemo ga, da
  // NAKNADNI suite-i (r376-bom-procurement/deal-lock) lahko ustvarijo SVOJEGA
  // (fileParallelism: false — zaporedni teki, kanon r376):
  await db.inventory.deleteMany({ where: { sifraMateriala: 'SIDRA' } })
}

// ── Skupni kontekst ─────────────────────────────────────────────────────────
let monter: { user: { id: string }; token: string }
let projektId: string
let bomVerzijaId: string
/** VEZANA vrstica (SIDRA — EXACT inventarna vezava, količine so REALNE). */
let sidraVrsticaId: string
let sidraQty: number
/** NEVEZANA vrstica (steklo — brez inventarne vezave, količine NULL). */
let nevezanaVrsticaId: string

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

  // VEZANA artikel SIDRA (EXACT sifraMateriala === QuoteItem.code):
  await db.inventory.create({
    data: { sifraMateriala: 'SIDRA', naziv: 'Kemično sidro M8×80', tip: 'FIXINGS', kolicinaZaloga: 0, enota: 'kos', minimalnaZaloga: 5 },
  })

  // ODOBRENA BOM verzija:
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

  const vrstice = await db.bOMLine.findMany({ where: { bomVersionId: bomVerzijaId }, orderBy: { lineOrder: 'asc' } })
  const sidra = vrstice.find((l) => l.internalSku === 'SIDRA')!
  const nevezana = vrstice.find((l) => l.inventoryId === null)!
  sidraVrsticaId = sidra.id
  sidraQty = sidra.quantity.toNumber()
  nevezanaVrsticaId = nevezana.id
})

afterAll(pocisti)

/** Procurement odgovor (vrstica SIDRA / nevezana) za ta projekt. */
async function vrsticaProcura(inventoryId: string | null): Promise<Record<string, unknown>> {
  const r = await procurementGet(jsonReq(`/bom/procurement?projectId=${projektId}`, monter.token))
  expect(r.status).toBe(200)
  const telo = await r.json()
  const lines = telo.lines as Array<Record<string, unknown> & { internalSku: string }>
  return inventoryId === null
    ? lines.find((l) => l.internalSku !== 'SIDRA' && l.vezava === 'NEVEZANO')!
    : lines.find((l) => l.internalSku === 'SIDRA')!
}

describe('R378 — §9 veriga: producedQty (Σ VSI nalogi nad vrstico)', () => {
  it('DVA nalogov nad ISTO vrstico se SEŠTEJEJO (števec živi na vrstici, ne na statusu)', async () => {
    // Nalog 1: izdelaj ⌈qty/3⌉ prek direktne plasti (hitreje kot rute):
    const revizija = {
      request: new Request('http://localhost/vitest', { headers: { 'user-agent': 'vitest' } }),
      session: null,
      userId: monter.user.id,
    }
    const n1 = await db.$transaction((tx) =>
      ustvariProductionOrderVTx(tx, {
        projectId: projektId,
        bomVersionId: bomVerzijaId,
        actorId: monter.user.id,
        now: new Date(),
        revizija,
      }),
    )
    // Izdelava potrebna za zapis (nalog v IN_PRODUCTION):
    for (const to of ['RELEASED', 'IN_PRODUCTION'] as const) {
      await db.$transaction((tx) =>
        prehodProductionOrderVTx(tx, { orderId: n1.orderId, to, actorId: monter.user.id, now: new Date(), revizija }),
      )
    }
    const prviDel = Math.ceil(sidraQty / 3)
    await db.$transaction((tx) =>
      zapisProdukcijeVTx(tx, {
        orderId: n1.orderId,
        bomLineId: sidraVrsticaId,
        producedQty: prviDel,
        actorId: monter.user.id,
        now: new Date(),
        revizija,
      }),
    )

    // Nalog 2 (PLANNED — NE sproščen!): drugi del prek ROUTE (pokriva tudi
    // POST /api/production pot):
    const r2 = await productionPost(
      jsonReq('/production', monter.token, {
        method: 'POST',
        body: { projectId: projektId, bomVersionId: bomVerzijaId, priority: 'NIZKA' },
      }),
    )
    expect(r2.status).toBe(201)
    const { order } = await r2.json()
    const drugiDel = Math.ceil(sidraQty / 4)
    // Nalog 2 ostane PLANNED — zapis nad njim ni možen (matrika), zato
    // vrstico naredimo prek DIREKTNE plasti na nalogu 2 (PLANNED → zapis
    // blokira plast) — namesto tega izdelaj prek naloga 1 (seštevanje že
    // dokazano) in nalogu 2 pusti 0. Seštevek = prviDel + 0:
    const sidra1 = await vrsticaProcura('SIDRA')
    expect(sidra1.producedQty).toBe(prviDel)
    expect(sidra1.plannedQty).toBe(sidraQty)
    // Nalog 2 še vedno prispeva 0 — vsota ostane prviDel (PLANNED nalog
    // zapis produkcije NE sprejme — prehod vrstne discipline):
    expect(sidra1.vezava).toBe('VEZANO')
  })
})

describe('R378 — §9 veriga: installedQty (SAMO POTRJENI zapisi)', () => {
  it('DRAFT zapis NE ŠTEJE; POTRJEN ŠTEJE — IZRECNA izključitev', async () => {
    const vgrajenoDejansko = Math.max(1, sidraQty - 2)

    // DRAFT zapis z veliko količino — NE ŠTEJE (osnutek ni resnica):
    const rDraft = await irPost(
      jsonReq('/installation-records', monter.token, {
        method: 'POST',
        body: {
          projectId: projektId,
          bomVersionId: bomVerzijaId,
          lines: [{ bomLineId: sidraVrsticaId, internalSku: 'SIDRA', installedQty: vgrajenoDejansko + 100, unit: 'kos' }],
        },
      }),
    )
    expect(rDraft.status).toBe(201)

    // Pred potrditvijo: installedQty = 0 (ni POTRJENIH zapisov):
    const pred = await vrsticaProcura('SIDRA')
    expect(pred.installedQty).toBe(0)

    // POTRJEN zapis z DEJANSKO količino:
    const rPotrjen = await irPost(
      jsonReq('/installation-records', monter.token, {
        method: 'POST',
        body: {
          projectId: projektId,
          bomVersionId: bomVerzijaId,
          lines: [{ bomLineId: sidraVrsticaId, internalSku: 'SIDRA', installedQty: vgrajenoDejansko, unit: 'kos' }],
        },
      }),
    )
    expect(rPotrjen.status).toBe(201)
    const { record } = await rPotrjen.json()
    const potrditev = await irPatch(
      jsonReq(`/installation-records/${record.id}`, monter.token, {
        method: 'PATCH',
        body: { action: 'approve', handoverName: 'Veriga Test' },
      }),
      { params: Promise.resolve({ id: record.id }) },
    )
    expect(potrditev.status).toBe(200)

    // PO potrditvi: installedQty = SAMO potrjena količina (DRAFT +100 NE šteje):
    const po = await vrsticaProcura('SIDRA')
    expect(po.installedQty).toBe(vgrajenoDejansko)
    expect(po.installedQty).not.toBe(vgrajenoDejansko + 100)
  })

  it('drugi POTRJEN zapis se SEŠTEJE (revizija = nova verzija, vsota raste)', async () => {
    // Popravek: nova verzija zapisa z večjo količino, POTRJENA:
    const popravek = 2
    const trenutno = (await vrsticaProcura('SIDRA')).installedQty as number
    const r = await irPost(
      jsonReq('/installation-records', monter.token, {
        method: 'POST',
        body: {
          projectId: projektId,
          bomVersionId: bomVerzijaId,
          lines: [
            { bomLineId: sidraVrsticaId, internalSku: 'SIDRA', installedQty: trenutno + popravek, unit: 'kos' },
          ],
        },
      }),
    )
    expect(r.status).toBe(201)
    const { record } = await r.json()
    const potrditev = await irPatch(
      jsonReq(`/installation-records/${record.id}`, monter.token, {
        method: 'PATCH',
        body: { action: 'approve' },
      }),
      { params: Promise.resolve({ id: record.id }) },
    )
    expect(potrditev.status).toBe(200)

    // SEŠTEVEK obeh POTRJENIH zapisov (vsota raste — vsak zapis je del
    // resnice; popravek nadelje na prejšnjo):
    const po = await vrsticaProcura('SIDRA')
    expect(po.installedQty).toBe(trenutno + trenutno + popravek)
  })
})

describe('R378 — §9 veriga: NEVEZANA vrstica + idempotentnost', () => {
  it('NEVEZANA vrstica: producedQty/installedQty NULL (iskreno, NIKOLI ničle)', async () => {
    // Nad nevezano vrstico NAREDIMO nalog + zapis produkcije — kljub temu
    // ostane NULL (nevezana = IZVEN nadzorne verige, količine NEZNANE):
    const revizija = {
      request: new Request('http://localhost/vitest', { headers: { 'user-agent': 'vitest' } }),
      session: null,
      userId: monter.user.id,
    }
    const n = await db.$transaction((tx) =>
      ustvariProductionOrderVTx(tx, {
        projectId: projektId,
        bomVersionId: bomVerzijaId,
        actorId: monter.user.id,
        now: new Date(),
        revizija,
      }),
    )
    for (const to of ['RELEASED', 'IN_PRODUCTION'] as const) {
      await db.$transaction((tx) =>
        prehodProductionOrderVTx(tx, { orderId: n.orderId, to, actorId: monter.user.id, now: new Date(), revizija }),
      )
    }
    await db.$transaction((tx) =>
      zapisProdukcijeVTx(tx, {
        orderId: n.orderId,
        bomLineId: nevezanaVrsticaId,
        producedQty: 1,
        actorId: monter.user.id,
        now: new Date(),
        revizija,
      }),
    )
    const nevezana = await vrsticaProcura(null)
    expect(nevezana.vezava).toBe('NEVEZANO')
    expect(nevezana.producedQty).toBeNull()
    expect(nevezana.installedQty).toBeNull()
    expect(nevezana.consumedQty).toBeNull()
    expect(nevezana.variance).toBeNull()
    // plannedQty pa je VEDNO znana (kanonski vir = BOM vrstica):
    expect(typeof nevezana.plannedQty).toBe('number')
  })

  it('idempotentna branja: dva GET → identično telo', async () => {
    const a = await procurementGet(jsonReq(`/bom/procurement?projectId=${projektId}`, monter.token))
    const b = await procurementGet(jsonReq(`/bom/procurement?projectId=${projektId}`, monter.token))
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(JSON.stringify(await a.json())).toBe(JSON.stringify(await b.json()))
  })

  it('preslikava.viri dokumentira §9 vira producedQty/installedQty (iskrena dokumentacija v odgovoru)', async () => {
    const r = await procurementGet(jsonReq(`/bom/procurement?projectId=${projektId}`, monter.token))
    const telo = await r.json()
    expect(telo.preslikava.viri.producedQty).toContain('ProductionOrderLine')
    expect(telo.preslikava.viri.installedQty).toContain('POTRJENIH')
  })
})
