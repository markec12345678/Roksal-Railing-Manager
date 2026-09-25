// R144 — integracijski testi (issue #5 §24 — Inventory lot/batch traceability).
// ---------------------------------------------------------------------------
//   • Šarže (InventoryLot): vsak prihod kredira šaržo, vsak odhod alokira
//     DETERMINISTIČNO FIFO (deliveryDate ASC, createdAt ASC, id ASC — totalen
//     red, brez naključja).
//   • Prejem naročila: ENA šarža na postavko, determinističen lotNumber
//     'LOT-<orderId zadnjih 8>-<zap.>', supplier + purchasePrice iz naročila,
//     idempotentno po (orderId, orderItemId).
//   • Fail-closed: odhod, ki ga šarže ne pokrijejo → 409 PRED vsakim zapisom
//     (brez delne alokacije — transakcija se zavrne celotna).
//   • Sled: LotAllocation povezuje odhodni StockLedger dogodek s šaržami →
//     Project → StockLedger → LotAllocation → InventoryLot → Supplier/Order.
//   • API GET /api/inventory/lots: anon 401 + korelacija; prijavljen 200 z
//     minimalnim DTO (§17) v FIFO redu; neznani artikel → 404.
//   • Invarianta: Σ quantityRemaining šarž == Inventory.kolicinaZaloga.
//
// Handlerji direktno, baza roksal_test prek globalSetup (vzorec R128–R143).
// Brez AI, brez naključja — lot numberi so deterministični ali eksplicitno
// označeni; testne artikle se počisti v afterAll (FK varni vrstni red).
import { describe, expect, it, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import { GET as lotsGet } from '@/app/api/inventory/lots/route'
import { POST as inventoryPost } from '@/app/api/inventory/route'
import { recordMovement, receiveOrder, StockError } from '@/lib/inventory'
import { creditLotInTx, allocateLotsInTx, round6 } from '@/lib/lots'

const BASE = 'http://localhost/api'

function req(
  path: string,
  token: string | null,
  method = 'GET',
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...extraHeaders,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const createdInventories: string[] = []
const createdOrders: string[] = []
const createdSuppliers: string[] = []
const createdProjects: string[] = []
const createdCustomers: string[] = []

async function makeItem(startQty = 0, enota = 'kos') {
  const inv = await db.inventory.create({
    data: {
      sifraMateriala: `S24-LOT-${randomUUID().slice(0, 10)}`,
      naziv: 'Testni artikel šarž (R144)',
      tip: 'TEST',
      kolicinaZaloga: startQty,
      enota,
      minimalnaZaloga: 0,
    },
  })
  createdInventories.push(inv.id)
  if (startQty > 0) {
    await db.inventoryLot.create({
      data: {
        inventoryId: inv.id,
        lotNumber: `LOT-LEGACY-${inv.id}`,
        deliveryDate: inv.createdAt,
        quantityInitial: startQty,
        quantityRemaining: startQty,
        status: 'ACTIVE',
        note: 'Zaloga pred uvedbo šarž (§24 backfill vzorec)',
      },
    })
  }
  return inv
}

async function makeProject() {
  const customer = await db.customer.create({
    data: { ime: `R144 stranka ${randomUUID().slice(0, 8)}`, naslov: 'Testna ulica 1' },
  })
  const project = await db.project.create({
    data: {
      nazivProjekta: `R144 projekt šarž ${randomUUID().slice(0, 6)}`,
      customerId: customer.id,
      status: 'V_TEKU',
    },
  })
  createdProjects.push(project.id)
  createdCustomers.push(customer.id)
  return project
}

/** Šarže, ustvarjene DIREKTNO prek db, morajo imeti usklajeno bilanco
 * (invarianta §24: Σ quantityRemaining == kolicinaZaloga) — sicer bi
 * recordMovement 409-al PRED alokacijo ("zaloga ne more biti negativna"). */
async function syncBalance(inventoryId: string) {
  const lots = await db.inventoryLot.findMany({ where: { inventoryId } })
  const sum = lots.reduce((s, l) => s + l.quantityRemaining, 0)
  await db.inventory.update({ where: { id: inventoryId }, data: { kolicinaZaloga: sum } })
}

afterAll(async () => {
  await db.lotAllocation.deleteMany({ where: { lot: { inventoryId: { in: createdInventories } } } })
  await db.inventoryLot.deleteMany({ where: { inventoryId: { in: createdInventories } } })
  await db.stockLedger.deleteMany({ where: { inventoryId: { in: createdInventories } } })
  await db.inventoryMovement.deleteMany({ where: { inventoryId: { in: createdInventories } } })
  await db.materialOrderItem.deleteMany({ where: { orderId: { in: createdOrders } } })
  await db.materialOrder.deleteMany({ where: { id: { in: createdOrders } } })
  await db.supplier.deleteMany({ where: { id: { in: createdSuppliers } } })
  await db.inventory.deleteMany({ where: { id: { in: createdInventories } } })
  await db.project.deleteMany({ where: { id: { in: createdProjects } } })
  await db.customer.deleteMany({ where: { id: { in: createdCustomers } } })
  await db.$disconnect()
})

describe('R144 §24 — kredit šarže (prihodki)', () => {
  it('PURCHASE kreira šaržo LOT-M-*, ledger nosi lotId, količini so usklajene', async () => {
    const inv = await makeItem(0)
    await recordMovement({ inventoryId: inv.id, eventType: 'PURCHASE', kolicina: 10 })

    const lots = await db.inventoryLot.findMany({ where: { inventoryId: inv.id } })
    expect(lots).toHaveLength(1)
    expect(lots[0].lotNumber.startsWith('LOT-M-')).toBe(true)
    expect(lots[0].quantityInitial).toBe(10)
    expect(lots[0].quantityRemaining).toBe(10)
    expect(lots[0].status).toBe('ACTIVE')

    const ledger = await db.stockLedger.findFirst({ where: { inventoryId: inv.id } })
    expect(ledger?.lotId).toBe(lots[0].id)
  })

  it('OPENING prek rute: artikel + šarža + ledger v ENI transakciji', async () => {
    const { token } = await createTestUserWithSession('r144admin', 'ADMIN')
    const sifra = `S24-OPEN-${randomUUID().slice(0, 8)}`
    const res = await inventoryPost(
      req('/api/inventory', token, 'POST', {
        sifraMateriala: sifra,
        naziv: 'R144 ustanovitveni artikel',
        tip: 'Inox_vijak',
        enota: 'kos',
        kolicinaZaloga: 7,
        minimalnaZaloga: 2,
      }),
    )
    expect(res.status).toBe(201)
    const created = (await res.json()) as { id: string }
    createdInventories.push(created.id)

    const lots = await db.inventoryLot.findMany({ where: { inventoryId: created.id } })
    expect(lots).toHaveLength(1)
    expect(lots[0].quantityRemaining).toBe(7)
    const ledger = await db.stockLedger.findFirst({ where: { inventoryId: created.id } })
    expect(ledger?.eventType).toBe('OPENING')
    expect(ledger?.lotId).toBe(lots[0].id)
  })

  it('prejem naročila: ENA šarža na postavko (determinističen lotNumber, supplier, cena)', async () => {
    const inv = await makeItem(0)
    const supplier = await db.supplier.create({
      data: { naziv: `S24-SUP-${randomUUID().slice(0, 8)}`, aktivna: true },
    })
    createdSuppliers.push(supplier.id)
    const order = await db.materialOrder.create({
      data: {
        supplierId: supplier.id,
        status: 'POTRJENO',
        items: { create: [{ inventoryId: inv.id, kolicina: 12, cena: 2.5, naziv: 'vijak', enota: 'kos' }] },
      },
      include: { items: true },
    })
    createdOrders.push(order.id)

    const result = await receiveOrder(order.id, 'test-actor')
    expect(result.alreadyReceived).toBe(false)

    const lots = await db.inventoryLot.findMany({ where: { inventoryId: inv.id } })
    expect(lots).toHaveLength(1)
    expect(lots[0].lotNumber).toBe(`LOT-${order.id.slice(-8)}-1`)
    expect(lots[0].supplierId).toBe(supplier.id)
    expect(lots[0].purchasePrice).toBe(2.5)
    expect(lots[0].quantityRemaining).toBe(12)

    // Idempotenca: drugi prejem NE doda šarže.
    const again = await receiveOrder(order.id, 'test-actor')
    expect(again.alreadyReceived).toBe(true)
    const lotsAfter = await db.inventoryLot.findMany({ where: { inventoryId: inv.id } })
    expect(lotsAfter).toHaveLength(1)
  })
})

describe('R144 §24 — deterministična FIFO alokacija (odhodki)', () => {
  it('ISSUE porabi NAJSTAREJŠO šaržo (deliveryDate ASC)', async () => {
    const inv = await makeItem(0)
    const old = await db.inventoryLot.create({
      data: { inventoryId: inv.id, lotNumber: 'L-OLD', deliveryDate: new Date('2026-01-01'), quantityInitial: 5, quantityRemaining: 5 },
    })
    const newer = await db.inventoryLot.create({
      data: { inventoryId: inv.id, lotNumber: 'L-NEW', deliveryDate: new Date('2026-06-01'), quantityInitial: 5, quantityRemaining: 5 },
    })
    await syncBalance(inv.id)

    await recordMovement({ inventoryId: inv.id, eventType: 'ISSUE', kolicina: 3 })

    const [oldAfter, newAfter] = await Promise.all([
      db.inventoryLot.findUniqueOrThrow({ where: { id: old.id } }),
      db.inventoryLot.findUniqueOrThrow({ where: { id: newer.id } }),
    ])
    expect(oldAfter.quantityRemaining).toBe(2)
    expect(newAfter.quantityRemaining).toBe(5) // nedotaknjena

    // Sled: alokacija kaže na staro šaržo z negativno količino.
    const alloc = await db.lotAllocation.findFirst({ where: { lotId: old.id }, orderBy: { createdAt: 'desc' } })
    expect(alloc?.kolicina).toBe(-3)
    expect(alloc?.eventType).toBe('ISSUE')
    const ledger = await db.stockLedger.findFirst({ where: { inventoryId: inv.id, eventType: 'ISSUE' } })
    expect(alloc?.ledgerId).toBe(ledger?.id)
  })

  it('isti deliveryDate → createdAt, nato id (totalen red, brez naključja)', async () => {
    const inv = await makeItem(0)
    const same = new Date('2026-03-03T12:00:00Z')
    const a = await db.inventoryLot.create({
      data: { inventoryId: inv.id, lotNumber: 'L-A', deliveryDate: same, createdAt: same, quantityInitial: 2, quantityRemaining: 2 },
    })
    const b = await db.inventoryLot.create({
      data: { inventoryId: inv.id, lotNumber: 'L-B', deliveryDate: same, createdAt: same, quantityInitial: 2, quantityRemaining: 2 },
    })
    await syncBalance(inv.id)
    // id ASC — prvi porabljen je tisti z manjšim id-jem.
    const first = a.id < b.id ? a : b

    await recordMovement({ inventoryId: inv.id, eventType: 'ISSUE', kolicina: 1 })

    const firstAfter = await db.inventoryLot.findUniqueOrThrow({ where: { id: first.id } })
    expect(firstAfter.quantityRemaining).toBe(1)
  })

  it('odhod čez VEČ šarž: razliva se po FIFO redu (brez dvojnikov, brez naključja)', async () => {
    const inv = await makeItem(0)
    await db.inventoryLot.create({
      data: { inventoryId: inv.id, lotNumber: 'L-S1', deliveryDate: new Date('2026-01-05'), quantityInitial: 4, quantityRemaining: 4 },
    })
    await db.inventoryLot.create({
      data: { inventoryId: inv.id, lotNumber: 'L-S2', deliveryDate: new Date('2026-02-05'), quantityInitial: 6, quantityRemaining: 6 },
    })
    await syncBalance(inv.id)

    await recordMovement({ inventoryId: inv.id, eventType: 'ISSUE', kolicina: 5 })

    const lots = await db.inventoryLot.findMany({
      where: { inventoryId: inv.id },
      orderBy: { lotNumber: 'asc' },
    })
    const s1 = lots.find((l) => l.lotNumber === 'L-S1')
    const s2 = lots.find((l) => l.lotNumber === 'L-S2')
    expect(s1?.quantityRemaining).toBe(0)
    expect(s1?.status).toBe('EXHAUSTED')
    expect(s2?.quantityRemaining).toBe(5)

    const allocs = await db.lotAllocation.findMany({
      where: { lot: { inventoryId: inv.id } },
      orderBy: { kolicina: 'asc' },
    })
    expect(allocs).toHaveLength(2)
    expect(allocs.map((a) => a.kolicina).sort((x, y) => x - y)).toEqual([-4, -1])
  })

  it('premalo porekla → 409 PRED zapisom (brez delne alokacije, bilanca nespremenjena)', async () => {
    const inv = await makeItem(0)
    await db.inventoryLot.create({
      data: { inventoryId: inv.id, lotNumber: 'L-TINY', deliveryDate: new Date('2026-01-01'), quantityInitial: 3, quantityRemaining: 3 },
    })
    await db.inventory.update({ where: { id: inv.id }, data: { kolicinaZaloga: 3 } })

    await expect(
      recordMovement({ inventoryId: inv.id, eventType: 'ISSUE', kolicina: 10 }),
    ).rejects.toMatchObject({ status: 409 })

    // Transakcija rolled back: bilanca, ledger, alokacije — nič ni zapisano.
    const fresh = await db.inventory.findUniqueOrThrow({ where: { id: inv.id } })
    expect(fresh.kolicinaZaloga).toBe(3)
    const ledger = await db.stockLedger.findMany({ where: { inventoryId: inv.id } })
    expect(ledger).toHaveLength(0)
    const allocs = await db.lotAllocation.findMany({ where: { lot: { inventoryId: inv.id } } })
    expect(allocs).toHaveLength(0)
  })
})

describe('R144 §24 — vračila v eksplicitno šaržo + invarianta', () => {
  it('RETURN z lotId: kredira TO šaržo, EXHAUSTED se ponovno odpre', async () => {
    const inv = await makeItem(0)
    const lot = await db.inventoryLot.create({
      data: { inventoryId: inv.id, lotNumber: 'L-RET', deliveryDate: new Date('2026-01-01'), quantityInitial: 5, quantityRemaining: 5 },
    })
    await syncBalance(inv.id)
    await recordMovement({ inventoryId: inv.id, eventType: 'ISSUE', kolicina: 5 })
    let after = await db.inventoryLot.findUniqueOrThrow({ where: { id: lot.id } })
    expect(after.status).toBe('EXHAUSTED')

    await recordMovement({
      inventoryId: inv.id,
      eventType: 'RETURN',
      kolicina: 2,
      lotId: lot.id,
    })
    after = await db.inventoryLot.findUniqueOrThrow({ where: { id: lot.id } })
    expect(after.quantityRemaining).toBe(2)
    expect(after.status).toBe('ACTIVE') // ponovno odprta

    const ledger = await db.stockLedger.findFirst({ where: { inventoryId: inv.id, eventType: 'RETURN' } })
    expect(ledger?.lotId).toBe(lot.id)
  })

  it('RETURN z tujo šaržo → 409; neznana šarža → 404 (fail-closed)', async () => {
    const invA = await makeItem(0)
    const invB = await makeItem(0)
    const lotB = await db.inventoryLot.create({
      data: { inventoryId: invB.id, lotNumber: 'L-B', deliveryDate: new Date('2026-01-01'), quantityInitial: 5, quantityRemaining: 5 },
    })

    await expect(
      recordMovement({ inventoryId: invA.id, eventType: 'RETURN', kolicina: 1, lotId: lotB.id }),
    ).rejects.toMatchObject({ status: 409 })

    await expect(
      recordMovement({ inventoryId: invA.id, eventType: 'RETURN', kolicina: 1, lotId: 'neobstaja' }),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('invarianta: Σ quantityRemaining šarž == kolicinaZaloga po seriji premikov', async () => {
    const inv = await makeItem(0)
    await recordMovement({ inventoryId: inv.id, eventType: 'PURCHASE', kolicina: 20 })
    await recordMovement({ inventoryId: inv.id, eventType: 'ISSUE', kolicina: 7 })
    await recordMovement({ inventoryId: inv.id, eventType: 'WASTE', kolicina: 1 })
    await recordMovement({ inventoryId: inv.id, eventType: 'RETURN', kolicina: 2 })

    const fresh = await db.inventory.findUniqueOrThrow({ where: { id: inv.id } })
    const lots = await db.inventoryLot.findMany({ where: { inventoryId: inv.id } })
    const lotSum = lots.reduce((s, l) => s + l.quantityRemaining, 0)
    expect(round6(lotSum)).toBe(round6(fresh.kolicinaZaloga))
    expect(fresh.kolicinaZaloga).toBe(14)
  })

  it('allocateLotsInTx: ne-štirsedem-mestna količina se zaokroži deterministično (round6)', () => {
    expect(round6(0.1 + 0.2)).toBe(0.3)
    expect(round6(2.9999999999)).toBe(3)
  })

  it('allocateLotsInTx direktno: neveljavna količina → 400', async () => {
    const inv = await makeItem(0)
    await db.$transaction(async (tx) => {
      await expect(
        allocateLotsInTx(tx, { inventoryId: inv.id, kolicina: 0, eventType: 'ISSUE' }),
      ).rejects.toMatchObject({ status: 400 })
    })
  })
})

describe('R144 §24 — projekt × šarža (sled Project → … → Supplier)', () => {
  it('ISSUE s projectId: alokacija nosi projekt (polna sled do šarže/dobavitelja)', async () => {
    const inv = await makeItem(0)
    const supplier = await db.supplier.create({
      data: { naziv: `S24-TRC-${randomUUID().slice(0, 8)}`, aktivna: true },
    })
    createdSuppliers.push(supplier.id)
    const order = await db.materialOrder.create({
      data: {
        supplierId: supplier.id,
        status: 'POTRJENO',
        items: { create: [{ inventoryId: inv.id, kolicina: 8, cena: 1.25, naziv: 'x', enota: 'kos' }] },
      },
      include: { items: true },
    })
    createdOrders.push(order.id)
    await receiveOrder(order.id, 'test-actor')

    const project = await makeProject()
    await recordMovement({
      inventoryId: inv.id,
      eventType: 'ISSUE',
      kolicina: 3,
      projectId: project.id,
      actorId: 'test-actor',
    })

    const alloc = await db.lotAllocation.findFirst({
      where: { lot: { inventoryId: inv.id }, projectId: project.id },
    })
    expect(alloc).not.toBeNull()
    expect(alloc?.kolicina).toBe(-3)

    // Polna sled: projekt → alokacija → šarža → dobavitelj.
    const trace = await db.lotAllocation.findUniqueOrThrow({
      where: { id: alloc!.id },
      include: { lot: { include: { supplier: true, order: true } }, project: true },
    })
    expect(trace.lot.supplier?.id).toBe(supplier.id)
    expect(trace.lot.orderId).toBe(order.id)
    expect(trace.project?.id).toBe(project.id)
  })
})

describe('R144 §24 — API GET /api/inventory/lots', () => {
  it('anon → 401 + x-correlation-id', async () => {
    const res = await lotsGet(req('/api/inventory/lots', null))
    expect(res.status).toBe(401)
    expect(res.headers.get('x-correlation-id')).toBeTruthy()
  })

  it('prijavljen: FIFO red + minimalni DTO (lotNumber, dobavitelj, alokacije)', async () => {
    const inv = await makeItem(0)
    const supplier = await db.supplier.create({
      data: { naziv: `S24-DTO-${randomUUID().slice(0, 8)}`, aktivna: true },
    })
    createdSuppliers.push(supplier.id)
    await db.inventoryLot.create({
      data: {
        inventoryId: inv.id,
        lotNumber: 'L-DTO-OLD',
        deliveryDate: new Date('2026-02-01'),
        quantityInitial: 10,
        quantityRemaining: 6,
        supplierId: supplier.id,
        purchasePrice: 1.5,
      },
    })
    await db.inventoryLot.create({
      data: {
        inventoryId: inv.id,
        lotNumber: 'L-DTO-NEW',
        deliveryDate: new Date('2026-05-01'),
        quantityInitial: 4,
        quantityRemaining: 4,
      },
    })
    await syncBalance(inv.id)
    await recordMovement({ inventoryId: inv.id, eventType: 'ISSUE', kolicina: 4 }) // iz stare

    const { token } = await createTestUserWithSession('r144reader', 'MONTER')
    const res = await lotsGet(req(`/api/inventory/lots?inventoryId=${inv.id}`, token))
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      inventory: { id: string }
      lots: { lotNumber: string; dobavitelj: string | null; quantityRemaining: number; purchasePrice: number | null; allocations: unknown[] }[]
      activeLots: number
    }
    expect(body.inventory.id).toBe(inv.id)
    // FIFO red: starejša šarža PRVA.
    expect(body.lots.map((l) => l.lotNumber)).toEqual(['L-DTO-OLD', 'L-DTO-NEW'])
    expect(body.lots[0].dobavitelj).toBeTruthy()
    expect(body.lots[0].purchasePrice).toBe(1.5)
    expect(body.lots[0].quantityRemaining).toBe(2)
    expect(body.lots[0].allocations.length).toBeGreaterThan(0)
    expect(body.activeLots).toBe(2) // OLD (2/10) + NEW (4/4) — obe še ACTIVE
  })

  it('neznani artikel → 404', async () => {
    const { token } = await createTestUserWithSession('r144reader2', 'MONTER')
    const res = await lotsGet(req('/api/inventory/lots?inventoryId=neobstaja', token))
    expect(res.status).toBe(404)
  })

  it('brez inventoryId: splošni pregled vrne {lots: [...]} (strop 100)', async () => {
    const { token } = await createTestUserWithSession('r144reader3', 'MONTER')
    const res = await lotsGet(req('/api/inventory/lots', token))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { lots: unknown[] }
    expect(Array.isArray(body.lots)).toBe(true)
    expect(body.lots.length).toBeLessThanOrEqual(100)
  })
})
