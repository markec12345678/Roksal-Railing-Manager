// Roksal — šarže / lot traceability (issue #5, §24 — R144)
// ---------------------------------------------------------------------------
// Nespremenljiva pravila (dopolnilo pravil src/lib/inventory.ts):
//  1. Vsak PRIHOD zaloge (delta > 0) kredira šaržo (InventoryLot):
//     - prejem naročila (RECEIPT z orderItemId): ENA šarža na postavko,
//       lotNumber 'LOT-<orderId zadnjih 8>-<zap. postavke>' — deterministično
//       in idempotentno (isti prejem = ista šarža, brez dvojnikov);
//     - ročni prihod (OPENING/PURCHASE/RETURN/RELEASE/+) : nova šarža
//       'LOT-M-<kratki unikat>' (poreklo neznano = supplier NULL, iskreno).
//  2. Vsak ODHOD (delta < 0) alokira DETERMINISTIČNO FIFO: šarže z
//     statusom ACTIVE in quantityRemaining > 0, vrstni red deliveryDate ASC,
//     createdAt ASC, id ASC (id kot zadnji ključ pomeni totalen red — brez
//     naključja tudi pri enakih datumih). Če šarže NE pokrijejo količine,
//     premik SPLODI 409 (fail-closed) — transakcija se zavrne (brez delne
//     alokacije, brez tihe degradacije).
//  3. Vsak odhod dobi LotAllocation vrstico na šaržo (-količina) + povezavo
//     na StockLedger dogodek (ledgerId) → polna sled:
//     Project → StockLedger → LotAllocation → InventoryLot → Supplier/Order.
//  4. Sledljivost NI nadomestilo za bilanco: Inventory.kolicinaZaloga ostane
//     avtoritativna (vsota ledger dogodkov); Σ quantityRemaining šarž mora
//     biti enaka bilanci (invarianta, preverjena v testih).

import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { StockError } from '@/lib/inventory'

type Tx = Prisma.TransactionClient

export const LOT_STATUS_ACTIVE = 'ACTIVE'
export const LOT_STATUS_EXHAUSTED = 'EXHAUSTED'
export const LOT_STATUS_CLOSED = 'CLOSED'

export type CreditLotInput = {
  inventoryId: string
  /** Količina, ki se kredira šarži (pozitivna). */
  kolicina: number
  /** Eksplicitna šarža (npr. vračilo v določeno šaržo). */
  lotId?: string | null
  /** Referenca prejema — enolično določi šaržo (idempotenca). */
  orderId?: string | null
  orderItemId?: string | null
  /** Zaporedna št. postavke znotraj naročila (del determinističnega lotNumber). */
  orderItemIndex?: number | null
  supplierId?: string | null
  purchasePrice?: number | null
  deliveryDate?: Date
  note?: string | null
}

export type AllocationRow = {
  lotId: string
  lotNumber: string
  /** Predznačena količina (odhod = negativna). */
  kolicina: number
}

/**
 * Krediraj šaržo (prihod zaloge). Vrne šaržo PO kreditu.
 *  - lotId podan: šarža mora obstajati, pripadati istemu artiklu in biti ACTIVE
 *    (fail-closed 404/409 sicer) — količina se prišteje, EXHAUSTED ostaja
 *    EXHAUSTED samo če ostane 0.
 *  - orderId+orderItemId podana: find-or-create po (inventoryId, lotNumber) —
 *    idempotentno (isti prejem ne ustvari dvojne šarže).
 *  - sicer: nova ročna šarža 'LOT-M-<kratki unikat>'.
 */
export async function creditLotInTx(tx: Tx, input: CreditLotInput) {
  if (!Number.isFinite(input.kolicina) || input.kolicina <= 0) {
    throw new StockError(400, 'Količina šarže mora biti pozitivno končno število')
  }

  // 1) Eksplicitna šarža (npr. RETURN v določeno šaržo).
  if (input.lotId) {
    const lot = await tx.inventoryLot.findUnique({ where: { id: input.lotId } })
    if (!lot) throw new StockError(404, 'Šarža ne obstaja')
    if (lot.inventoryId !== input.inventoryId) {
      throw new StockError(409, 'Šarža ne pripada temu artiklu')
    }
    if (lot.status === LOT_STATUS_CLOSED) {
      throw new StockError(409, 'Šarža je zaprta — vračilo ni mogoče')
    }
    const remaining = lot.quantityRemaining + input.kolicina
    return tx.inventoryLot.update({
      where: { id: lot.id },
      data: {
        quantityRemaining: remaining,
        status:
          lot.status === LOT_STATUS_EXHAUSTED && remaining > 0
            ? LOT_STATUS_ACTIVE
            : lot.status,
      },
    })
  }

  // 2) Prejem naročila — determinističen lotNumber iz naročila + postavke.
  if (input.orderId && input.orderItemId) {
    const idx = (input.orderItemIndex ?? 0) + 1
    const lotNumber = `LOT-${input.orderId.slice(-8)}-${idx}`
    const existing = await tx.inventoryLot.findUnique({
      where: { inventoryId_lotNumber: { inventoryId: input.inventoryId, lotNumber } },
    })
    if (existing) {
      // Idempotenca: isti prejem (isti idempotencyKey v ledgerju) pride sem
      // samo, če je prejem že bil zabeležen — šarža obstaja, NE podvojujemo.
      return existing
    }
    return tx.inventoryLot.create({
      data: {
        inventoryId: input.inventoryId,
        lotNumber,
        orderId: input.orderId,
        orderItemId: input.orderItemId,
        supplierId: input.supplierId ?? null,
        purchasePrice: input.purchasePrice ?? null,
        deliveryDate: input.deliveryDate ?? new Date(),
        quantityInitial: input.kolicina,
        quantityRemaining: input.kolicina,
        status: LOT_STATUS_ACTIVE,
        note: input.note ?? null,
      },
    })
  }

  // 3) Ročni prihod — nova šarža z neznanim poreklom (iskreno, brez izmišljanja).
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12)
  return tx.inventoryLot.create({
    data: {
      inventoryId: input.inventoryId,
      lotNumber: `LOT-M-${suffix}`,
      supplierId: input.supplierId ?? null,
      purchasePrice: input.purchasePrice ?? null,
      deliveryDate: input.deliveryDate ?? new Date(),
      quantityInitial: input.kolicina,
      quantityRemaining: input.kolicina,
      status: LOT_STATUS_ACTIVE,
      note: input.note ?? null,
    },
  })
}

export type AllocateLotsInput = {
  inventoryId: string
  /** Skupna količina za odhod (pozitivna). */
  kolicina: number
  /** StockLedger dogodek, ki porabi količino (za sled LotAllocation.ledgerId). */
  ledgerId?: string | null
  eventType: string
  projectId?: string | null
  actorId?: string | null
}

/**
 * Deterministična FIFO alokacija odhoda čez šarže (znotraj obstoječe
 * transakcije). Vrne vrstice alokacij. Če ACTIVE šarže NE pokrijejo količine
 * → StockError(409) PRED katerokoli spremembo (transakcija ostane čista).
 */
export async function allocateLotsInTx(tx: Tx, input: AllocateLotsInput): Promise<AllocationRow[]> {
  if (!Number.isFinite(input.kolicina) || input.kolicina <= 0) {
    throw new StockError(400, 'Količina šarže mora biti pozitivno končno število')
  }

  // Determinističen red: deliveryDate ASC, createdAt ASC, id ASC (totalen red).
  const lots = await tx.inventoryLot.findMany({
    where: {
      inventoryId: input.inventoryId,
      status: LOT_STATUS_ACTIVE,
      quantityRemaining: { gt: 0 },
    },
    orderBy: [{ deliveryDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  })

  const available = lots.reduce((s, l) => s + l.quantityRemaining, 0)
  if (available + 1e-9 < input.kolicina) {
    throw new StockError(
      409,
      `Šarže ne pokrijejo odhoda: potrebno ${input.kolicina}, na šaržah ${round6(available)} (premalo porekla — fail-closed)`
    )
  }

  // Najprej izračunaj celoten načrt (brez stranskih učinkov), šele nato piši —
  // napaka sredi pisanja je nemogoča (plan je determinističen in pokrit).
  let remaining = input.kolicina
  const plan: { lot: (typeof lots)[number]; take: number }[] = []
  for (const lot of lots) {
    if (remaining <= 0) break
    const take = Math.min(lot.quantityRemaining, remaining)
    plan.push({ lot, take })
    remaining -= take
  }

  const rows: AllocationRow[] = []
  for (const { lot, take } of plan) {
    const after = round6(lot.quantityRemaining - take)
    await tx.inventoryLot.update({
      where: { id: lot.id },
      data: {
        quantityRemaining: after,
        status: after <= 1e-9 ? LOT_STATUS_EXHAUSTED : lot.status,
      },
    })
    await tx.lotAllocation.create({
      data: {
        lotId: lot.id,
        ledgerId: input.ledgerId ?? null,
        eventType: input.eventType,
        kolicina: -take,
        projectId: input.projectId ?? null,
        actorId: input.actorId ?? null,
      },
    })
    rows.push({ lotId: lot.id, lotNumber: lot.lotNumber, kolicina: -take })
  }
  return rows
}

/** Zaokroži na 6 decimalk (plavajoča točka pri seštevanju alokacij). */
export function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6
}
