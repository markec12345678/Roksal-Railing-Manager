// Roksal — concurrency-safe številčenje dokumentov (issue #4, §12)
// ---------------------------------------------------------------------------
// Prej: `findFirst(orderBy stevilka desc) + 1` — vzporedni zahtevki so se
// zaleteli v unique constraint (500) ali podvojili številko.
//
// Zdaj: NumberSequence tabeli se vrednost atomsko poveča z UPDATE … RETURNING
// znotraj transakcije; unique constraint na Invoice.stevilka ostane zadnja
// linija obrambe; ob P2002 sledi omejen retry z novo alokacijo. Deluje na
// PostgreSQL (RETURNING) in SQLite (3.35+ RETURNING) — prehodna pot ostane
// funkcionalna.
// */

import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export class NumberingError extends Error {
  readonly status = 409
  constructor(message: string) {
    super(message)
  }
}

/** Enota dokumenta → predpona številke (oblika združljiva z obstoječimi računi:
 *  RACUN → "2026-001", PREDRACUN → "2026-PR-001", PREDPLACILNI → "2026-PP-001"). */
export function prefixFor(tip: string): string {
  switch (tip) {
    case 'RACUN':
      return ''
    case 'PREDRACUN':
      return 'PR-'
    case 'PREDPLACILNI':
      return 'PP-'
    default:
      throw new NumberingError(`Neznana enota računa: ${tip}`)
  }
}

type Tx = Prisma.TransactionClient

/**
 * Atomsko povečaj sekvenco `key` in vrni novo vrednost.
 * Upsert z raw RETURNING — ena poteza, brez read-then-write tekmovanja.
 */
export async function nextSequenceValue(tx: Tx, key: string): Promise<number> {
  // CURRENT_TIMESTAMP deluje na PostgreSQL in SQLite (prehodni demo način);
  // id je determinističen iz seqKey (upsert ob konfliktu ne potrebuje novega).
  const rows = await tx.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "NumberSequence" ("id", "seqKey", "value", "updatedAt")
    VALUES (${'seq_' + key.replace(/[^A-Za-z0-9_]/g, '_')}, ${key}, 1, CURRENT_TIMESTAMP)
    ON CONFLICT ("seqKey")
    DO UPDATE SET "value" = "NumberSequence"."value" + 1, "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "value"
  `
  const first = rows[0]
  if (!first || typeof first.value !== 'number') {
    throw new NumberingError('Alokacija številke ni uspela')
  }
  return first.value
}

/**
 * Alociraj naslednjo številko dokumenta, npr. `2026-042` / `2026-PR-042`.
 * Vrne polno številko. Kliče se ZNOTRAJ transakcije (atomic z zapisom).
 */
export async function allocateDocumentNumber(
  tx: Tx,
  tip: string,
  year: number
): Promise<string> {
  const prefix = prefixFor(tip)
  const value = await nextSequenceValue(tx, `${tip}:${year}`)
  return `${year}-${prefix}${String(value).padStart(3, '0')}`
}

export const MAX_NUMBER_RETRIES = 5

/**
 * Pomagalo za route: izvede `create(tx, stevilka)` v ENI transakciji
 * (alokacija številke + zapis + audit); ob unique konfliktu (P2002) ponovi z
 * novo alokacijo (max 5×). Klicatelj NE sme sam odpirati db.$transaction.
 */
export async function createWithNumber<T>(
  tip: string,
  create: (tx: Tx, stevilka: string) => Promise<T>
): Promise<T> {
  const year = new Date().getFullYear()
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_NUMBER_RETRIES; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const stevilka = await allocateDocumentNumber(tx, tip, year)
        return create(tx, stevilka)
      })
    } catch (error) {
      const isUniqueViolation =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
      if (!isUniqueViolation) throw error
      lastError = error
    }
  }
  throw new NumberingError(
    `Številčenje ni uspelo po ${MAX_NUMBER_RETRIES} poskusih: ${String(lastError)}`
  )
}
