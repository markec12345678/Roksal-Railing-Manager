// S+9 (issue #4 §4/§5) — Transakcijski StockLedger + idempotentni prejem.
// INTEGRACIJSKI testi proti realni PostgreSQL bazi (roksal_test).
import { describe, it, expect, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import {
  recordMovement,
  receiveOrder,
  deltaFor,
  StockError,
} from '@/lib/inventory'

const createdInventories: string[] = []
const createdOrders: string[] = []
const createdSuppliers: string[] = []

async function makeItem(startQty = 0, enota = 'kos') {
  const inv = await db.inventory.create({
    data: {
      sifraMateriala: `S9-LED-${randomUUID().slice(0, 10)}`,
      naziv: 'Testni artikel (S+9)',
      tip: 'TEST',
      kolicinaZaloga: startQty,
      enota,
      minimalnaZaloga: 0,
    },
  })
  createdInventories.push(inv.id)
  // R144 (§24): artikel, ustvarjen DIREKTNO prek db (obvoz rute), z zalogo > 0
  // dobi šaržo z istim vzorcem kot backfill migracije (LOT-LEGACY-<id>) —
  // sicer bi odhod 409-al ("šarže ne pokrijejo"), ker porekla ni.
  if (startQty > 0) {
    await db.inventoryLot.create({
      data: {
        inventoryId: inv.id,
        lotNumber: `LOT-LEGACY-${inv.id}`,
        deliveryDate: inv.createdAt,
        quantityInitial: startQty,
        quantityRemaining: startQty,
        status: 'ACTIVE',
        note: 'Zaloga pred uvedbo šarž (§24 backfill) — poreklo neznano',
      },
    })
  }
  return inv
}

async function makeOrder(itemId: string, kolicina: number) {
  const supplier = await db.supplier.create({
    data: { naziv: `S9-SUP-${randomUUID().slice(0, 8)}` },
  })
  createdSuppliers.push(supplier.id)
  const order = await db.materialOrder.create({
    data: {
      supplierId: supplier.id,
      status: 'POTRJENO',
      items: { create: [{ inventoryId: itemId, kolicina, cena: 1, naziv: 'x', enota: 'kos' }] },
    },
    include: { items: true },
  })
  createdOrders.push(order.id)
  return order
}

afterAll(async () => {
  // Čistilna akcija — FK varni vrstni red (R144: šarže + alokacije PRED ledger).
  await db.lotAllocation.deleteMany({ where: { lot: { inventoryId: { in: createdInventories } } } })
  await db.inventoryLot.deleteMany({ where: { inventoryId: { in: createdInventories } } })
  await db.stockLedger.deleteMany({ where: { inventoryId: { in: createdInventories } } })
  await db.inventoryMovement.deleteMany({ where: { inventoryId: { in: createdInventories } } })
  await db.materialOrderItem.deleteMany({ where: { orderId: { in: createdOrders } } })
  await db.materialOrder.deleteMany({ where: { id: { in: createdOrders } } })
  await db.supplier.deleteMany({ where: { id: { in: createdSuppliers } } })
  await db.inventory.deleteMany({ where: { id: { in: createdInventories } } })
  await db.$disconnect()
})

describe('recordMovement — transakcijski ledger', () => {
  it('PURCHASE poveča bilanco + zapiše dogodek z balanceAfter', async () => {
    const inv = await makeItem(0)
    const after = await recordMovement({
      inventoryId: inv.id,
      eventType: 'PURCHASE',
      kolicina: 10,
      actorId: 'test-actor',
      reason: 'test nakup',
    })
    expect(after).toBe(10)

    const fresh = await db.inventory.findUniqueOrThrow({ where: { id: inv.id } })
    expect(fresh.kolicinaZaloga).toBe(10)

    const ledger = await db.stockLedger.findMany({ where: { inventoryId: inv.id } })
    expect(ledger).toHaveLength(1)
    expect(ledger[0].eventType).toBe('PURCHASE')
    expect(ledger[0].kolicina).toBe(10)
    expect(ledger[0].balanceAfter).toBe(10)
    expect(ledger[0].actorId).toBe('test-actor')

    // Združljivost: InventoryMovement odraz obstaja
    const movement = await db.inventoryMovement.findFirst({ where: { inventoryId: inv.id } })
    expect(movement).not.toBeNull()
  })

  it('ISSUE zmanjša bilanco; pod ničlo → 409 (brez sledi v ledgerju)', async () => {
    const inv = await makeItem(5)
    const after = await recordMovement({
      inventoryId: inv.id,
      eventType: 'ISSUE',
      kolicina: 3,
    })
    expect(after).toBe(2)

    await expect(
      recordMovement({ inventoryId: inv.id, eventType: 'ISSUE', kolicina: 5 })
    ).rejects.toMatchObject({ status: 409 })

    // Nič ni posodobljeno — transakcija rollback
    const fresh = await db.inventory.findUniqueOrThrow({ where: { id: inv.id } })
    expect(fresh.kolicinaZaloga).toBe(2)
    const ledger = await db.stockLedger.findMany({ where: { inventoryId: inv.id } })
    expect(ledger).toHaveLength(1) // samo uspešen ISSUE
  })

  it('invarianta: bilanca == vsota ledger dogodkov', async () => {
    const inv = await makeItem(0)
    await recordMovement({ inventoryId: inv.id, eventType: 'PURCHASE', kolicina: 20 })
    await recordMovement({ inventoryId: inv.id, eventType: 'ISSUE', kolicina: 4 })
    await recordMovement({ inventoryId: inv.id, eventType: 'WASTE', kolicina: 1 })
    await recordMovement({ inventoryId: inv.id, eventType: 'RETURN', kolicina: 2 })

    const fresh = await db.inventory.findUniqueOrThrow({ where: { id: inv.id } })
    const entries = await db.stockLedger.findMany({ where: { inventoryId: inv.id } })
    const sum = entries.reduce((s, e) => s + e.kolicina, 0)
    expect(fresh.kolicinaZaloga).toBe(sum)
    expect(fresh.kolicinaZaloga).toBe(17)

    // zaporedje balanceAfter je konsistentno
    const sorted = [...entries].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    )
    let running = 0
    for (const e of sorted) {
      running += e.kolicina
      expect(e.balanceAfter).toBe(running)
    }
  })

  it('neveljavne količine → 400', async () => {
    const inv = await makeItem(0)
    await expect(
      recordMovement({ inventoryId: inv.id, eventType: 'PURCHASE', kolicina: 0 })
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      recordMovement({ inventoryId: inv.id, eventType: 'PURCHASE', kolicina: Number.NaN })
    ).rejects.toMatchObject({ status: 400 })
  })

  it('deltaFor: odhodi negativni, prihodi pozitivni', () => {
    expect(deltaFor('ISSUE', 5)).toBe(-5)
    expect(deltaFor('WASTE', 5)).toBe(-5)
    expect(deltaFor('DAMAGE', 5)).toBe(-5)
    expect(deltaFor('RESERVATION', 5)).toBe(-5)
    expect(deltaFor('PURCHASE', 5)).toBe(5)
    expect(deltaFor('RECEIPT', 5)).toBe(5)
    expect(deltaFor('RETURN', 5)).toBe(5)
    expect(deltaFor('RELEASE', 5)).toBe(5)
    expect(deltaFor('ISSUE', -7)).toBe(-7) // eksplicitno predznačeno
  })

  it('sočasni ISSUE-i na istem artikelu: vse uspešne, bilanca točna (optimistična zanka)', async () => {
    const inv = await makeItem(100)
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        recordMovement({ inventoryId: inv.id, eventType: 'ISSUE', kolicina: 2 })
      )
    )
    // Vsi so uspeli — bilanca = 100 - 20
    const fresh = await db.inventory.findUniqueOrThrow({ where: { id: inv.id } })
    expect(fresh.kolicinaZaloga).toBe(80)
    // Vsak rezultat je bilanca po premiku (unikatna)
    expect(new Set(results).size).toBe(10)
    const ledger = await db.stockLedger.findMany({ where: { inventoryId: inv.id } })
    expect(ledger).toHaveLength(10)
  })
})

describe('receiveOrder — idempotenten prejem naročila (issue #4 §5)', () => {
  it('prejem: status DOBLJENO, RECEIPT dogodki z idempotencyKey', async () => {
    const inv = await makeItem(0)
    const order = await makeOrder(inv.id, 7)

    const result = await receiveOrder(order.id, 'test-actor')
    expect(result.alreadyReceived).toBe(false)
    expect(result.items).toBe(1)
    expect(result.balanceAfter[inv.id]).toBe(7)

    const fresh = await db.inventory.findUniqueOrThrow({ where: { id: inv.id } })
    expect(fresh.kolicinaZaloga).toBe(7)

    const updated = await db.materialOrder.findUniqueOrThrow({ where: { id: order.id } })
    expect(updated.status).toBe('DOBLJENO')
    expect(updated.datumDobave).not.toBeNull()

    const receipt = await db.stockLedger.findFirst({
      where: { inventoryId: inv.id, eventType: 'RECEIPT' },
    })
    expect(receipt).not.toBeNull()
    expect(receipt?.idempotencyKey).toBe(`receipt:${order.id}:${order.items[0].id}`)
    expect(receipt?.orderItemId).toBe(order.items[0].id)
  })

  it('ponovljen prejem (1x, 10x): zaloga se poveča SAMO ENKRAT', async () => {
    const inv = await makeItem(0)
    const order = await makeOrder(inv.id, 5)

    await receiveOrder(order.id, 'test-actor')
    for (let i = 0; i < 10; i++) {
      const dup = await receiveOrder(order.id, 'test-actor')
      expect(dup.alreadyReceived).toBe(true)
    }

    const fresh = await db.inventory.findUniqueOrThrow({ where: { id: inv.id } })
    expect(fresh.kolicinaZaloga).toBe(5) // ne 10, ne 55

    const receipts = await db.stockLedger.findMany({
      where: { inventoryId: inv.id, eventType: 'RECEIPT' },
    })
    expect(receipts).toHaveLength(1) // samo en veljaven receipt event
  })

  it('VZPOREDNI prejemi (8 istih requestov): točno en poveča zalogo', async () => {
    const inv = await makeItem(0)
    const order = await makeOrder(inv.id, 3)

    const results = await Promise.all(
      Array.from({ length: 8 }, () => receiveOrder(order.id, 'concurrent-actor'))
    )
    const successful = results.filter((r) => !r.alreadyReceived)
    expect(successful.length).toBe(1)

    const fresh = await db.inventory.findUniqueOrThrow({ where: { id: inv.id } })
    expect(fresh.kolicinaZaloga).toBe(3)

    const receipts = await db.stockLedger.findMany({
      where: { inventoryId: inv.id, eventType: 'RECEIPT' },
    })
    expect(receipts).toHaveLength(1)

    const updated = await db.materialOrder.findUniqueOrThrow({ where: { id: order.id } })
    expect(updated.status).toBe('DOBLJENO')
  })

  it('neobstoječe naročilo → 404', async () => {
    await expect(receiveOrder('ne-obstaja-xyz', null)).rejects.toMatchObject({ status: 404 })
  })
})

describe('StockError oblika', () => {
  it('ima status za HTTP preslikavo', async () => {
    const inv = await makeItem(0)
    try {
      await recordMovement({ inventoryId: inv.id, eventType: 'ISSUE', kolicina: 1 })
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(StockError)
      expect((e as StockError).status).toBe(409)
    }
  })
})
