// Roksal — transakcijska zaloga (issue #4, §4 + §5)
// ---------------------------------------------------------------------------
// Pravila (nespremenljiva):
//  1. Vsaka sprememba zaloge = NESPREMENLJIV dogodek v StockLedger
//     (predznačena delta + balanceAfter) — dogodek IN sprememba balance sta V
//     ISTI DB transakciji.
//  2. Bilanca Inventory.kolicinaZaloga je vedno vsota dogodkov za ta artikel.
//  3. Idempotentnost: prejem naročila (DOBLJENO) ima atomic guard na statusu
//     (updateMany WHERE NOT DOBLJENO) + unique idempotencyKey v ledgerju —
//     retry/double-click/ponovljen request podvoji NIČ.
//  4. Zaloga ne more pod ničlo (razen ADJUSTMENT inventure, ki jo popravlja).
//  5. Zgodovinski InventoryMovement se ŠE VEDNO piše (združljivost UI), a je
//     od zdaj odraz ledger dogodka, ne neodvisen vir resnice.

import { db } from '@/lib/db'
import type { Prisma, StockLedgerEventType } from '@prisma/client'

export class StockError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export type LedgerMovementInput = {
  inventoryId: string
  eventType: StockLedgerEventType
  /** Predznačena delta: pozitivno = prihod, negativno = odhod. */
  kolicina: number
  enota: string
  balanceAfter: number
  orderId?: string | null
  orderItemId?: string | null
  projectId?: string | null
  actorId?: string | null
  reason?: string | null
  idempotencyKey?: string | null
}

type Tx = Prisma.TransactionClient

/**
 * En posamezen ledger vnos + posodobitev bilance — klicatelj mora biti ZNOTRAJ
 * transakcije. Ne metira zaporedja (klicatelj izračuna balanceAfter), ker je
 * transakcija serializirana po vrsti (glej recordMovement).
 */
async function writeLedgerEntry(tx: Tx, input: LedgerMovementInput) {
  return tx.stockLedger.create({
    data: {
      inventoryId: input.inventoryId,
      eventType: input.eventType,
      kolicina: input.kolicina,
      enota: input.enota,
      balanceAfter: input.balanceAfter,
      orderId: input.orderId ?? null,
      orderItemId: input.orderItemId ?? null,
      projectId: input.projectId ?? null,
      actorId: input.actorId ?? null,
      reason: input.reason ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
    },
  })
}

export type MovementCommand = {
  inventoryId: string
  eventType: StockLedgerEventType
  /** Pozitivno število; delta smer določi eventType (ISSUE/WASTE/DAMAGE = minus). */
  kolicina: number
  actorId?: string | null
  reason?: string | null
  projectId?: string | null
  orderId?: string | null
  orderItemId?: string | null
  idempotencyKey?: string | null
  /** Prepovedi premikov pod 0 (privzeto true; ADJUSTMENT lahko popravlja). */
  allowNegative?: boolean
}

const OUTFLOW: ReadonlySet<string> = new Set(['ISSUE', 'WASTE', 'DAMAGE', 'RESERVATION'])

/** Smer delte glede na tip dogodka. */
export function deltaFor(eventType: StockLedgerEventType, kolicina: number): number {
  if (kolicina < 0) return kolicina // klicatelj je podal predznačeno delto
  return OUTFLOW.has(eventType) ? -Math.abs(kolicina) : Math.abs(kolicina)
}

/**
 * Zapiši en premik zaloge v transakciji: preberi bilanco (znotraj tx),
 * validiraj, ustvari ledger dogodek + posodobi Inventory + (združljivost)
 * InventoryMovement. Vrne balanceAfter.
 */
export async function recordMovement(cmd: MovementCommand): Promise<number> {
  if (!Number.isFinite(cmd.kolicina) || cmd.kolicina <= 0) {
    throw new StockError(400, 'Količina mora biti pozitivno končno število')
  }
  return db.$transaction(async (tx) => {
    return recordMovementInTx(tx, cmd)
  })
}

/**
 * Isti premik, a znotraj obstoječe transakcije (npr. prejem naročila: vse
 * postavke + status naročila + audit = ENA transakcija).
 */
export async function recordMovementInTx(tx: Tx, cmd: MovementCommand): Promise<number> {
  if (!Number.isFinite(cmd.kolicina) || cmd.kolicina <= 0) {
    throw new StockError(400, 'Količina mora biti pozitivno končno število')
  }

  // Idempotency: isti ključ → vrni obstoječi rezultat brez novega dogodka.
  if (cmd.idempotencyKey) {
    const existing = await tx.stockLedger.findUnique({
      where: { idempotencyKey: cmd.idempotencyKey },
    })
    if (existing) return existing.balanceAfter
  }

  // Optimistična zanka (portabilno PG + SQLite): preberi stanje, poskus pogojno
  // posodobitev; ob konfliktu ponovno preberi (READ COMMITTED = svež posnetek).
  // Po 5 poskusih (ekstremni konflikt) vrže 409 — klicatelj ponovi.
  let target = 0
  let committed = false
  let delta = 0
  let enota = 'kos'
  for (let attempt = 0; attempt < 5 && !committed; attempt++) {
    const inv = await tx.inventory.findUnique({ where: { id: cmd.inventoryId } })
    if (!inv) throw new StockError(404, 'Artikel ne obstaja')
    enota = inv.enota

    delta = deltaFor(cmd.eventType, cmd.kolicina)
    target = inv.kolicinaZaloga + delta
    if (!cmd.allowNegative && target < 0) {
      throw new StockError(
        409,
        `Zaloga ne more biti negativna: ${inv.naziv} (${inv.kolicinaZaloga} ${inv.enota}, ${delta > 0 ? '+' : ''}${delta})`
      )
    }

    const updated = await tx.inventory.updateMany({
      where: { id: cmd.inventoryId, kolicinaZaloga: inv.kolicinaZaloga },
      data: { kolicinaZaloga: target },
    })
    committed = updated.count === 1
  }
  if (!committed) {
    throw new StockError(409, 'Sodobni konflikt premika zaloge — poskusi znova')
  }

  await writeLedgerEntry(tx, {
    inventoryId: cmd.inventoryId,
    eventType: cmd.eventType,
    kolicina: delta,
    enota,
    balanceAfter: target,
    orderId: cmd.orderId ?? null,
    orderItemId: cmd.orderItemId ?? null,
    projectId: cmd.projectId ?? null,
    actorId: cmd.actorId ?? null,
    reason: cmd.reason ?? null,
    idempotencyKey: cmd.idempotencyKey ?? null,
  })

  // Združljivost: obstoječi UI bere InventoryMovement.
  await tx.inventoryMovement.create({
    data: {
      inventoryId: cmd.inventoryId,
      projectId: cmd.projectId ?? null,
      orderId: cmd.orderId ?? null,
      kolicina: Math.abs(cmd.kolicina),
      tipPremika: cmd.eventType,
      createdBy: cmd.actorId ?? null,
    },
  })

  return target
}

export type ReceiptResult = {
  alreadyReceived: boolean
  orderId: string
  items: number
  balanceAfter: Record<string, number>
}

/**
 * Prejem naročila (issue #4, §5) — IDEMPOTENTEN.
 *  1. Atomic status guard: updateMany WHERE NOT DOBLJETO — če je count 0,
 *     je naročilo že prejeto → vrni alreadyReceived (brez dvojnega prijema).
 *  2. Za vsako postavko: RECEIPT ledger dogodek z idempotencyKey
 *     `receipt:<orderId>:<itemId>` + posodobitev bilance, vse v ISTI transakciji.
 *  3. Datum dobave se nastavi samo ob prvem prejemu.
 */
export async function receiveOrder(
  orderId: string,
  actorId: string | null,
  reason?: string
): Promise<ReceiptResult> {
  return db.$transaction(async (tx) => {
    // 1) Atomic guard — samo en klic lahko preide iz ne-DOBLJENO v DOBLJENO.
    const transition = await tx.materialOrder.updateMany({
      where: { id: orderId, NOT: { status: 'DOBLJENO' } },
      data: { status: 'DOBLJENO', datumDobave: new Date() },
    })
    if (transition.count === 0) {
      const existing = await tx.materialOrder.findUnique({
        where: { id: orderId },
        select: { id: true, items: true },
      })
      if (!existing) throw new StockError(404, 'Naročilo ne obstaja')
      return { alreadyReceived: true, orderId, items: existing.items.length, balanceAfter: {} }
    }

    const order = await tx.materialOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    })
    if (!order) throw new StockError(404, 'Naročilo ne obstaja')

    const balanceAfter: Record<string, number> = {}
    for (const item of order.items) {
      const bal = await recordMovementInTx(tx, {
        inventoryId: item.inventoryId,
        eventType: 'RECEIPT',
        kolicina: item.kolicina,
        actorId,
        reason: reason ?? `Prejem naročila ${orderId}`,
        orderId: order.id,
        orderItemId: item.id,
        projectId: order.projectId,
        idempotencyKey: `receipt:${order.id}:${item.id}`,
      })
      balanceAfter[item.inventoryId] = bal
    }

    return { alreadyReceived: false, orderId, items: order.items.length, balanceAfter }
  })
}
