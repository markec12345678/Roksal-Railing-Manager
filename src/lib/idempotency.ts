/**
 * Idempotenca strežniških rut — R128 (issue #5 §4: offline vrsta).
 * ---------------------------------------------------------------------------
 * Terenski klient pošilja čakajoče zapis s stabilnim `Idempotency-Key`
 * (src/lib/offline-queue.ts — mutationId). Ponovitev (retry po mrežni napaki,
 * crash recovery, ročni retry) NE SME ustvariti dvojnika:
 *
 *   • `beginIdempotency(key, route, profileId)`:
 *       - 'new'      → klicatelj nadaljuje (vrstica je REZERVIRANA — vzporedni
 *                      poizkus istega ključa dobi P2002 → replay/conflict);
 *       - { replay } → vrne shranjen originalni odgovor (status + telo);
 *       - 'conflict' → ključ obstaja brez odgovora (poizkus še poteka) ALI je
 *                      rezerviral drug profil → 409, brez razkritja podatkov.
 *   • `storeResponse(key, status, body)` — snapshot odgovora (measurements:
 *      v ISTI transakciji kot mutacija = exactly-once replay; ar-snapshots:
 *      best-effort po uspehu, dokumentirano okno).
 *   • `gcIdempotencyKeys()` — lenobno čiščenje (> 30 dni), poklicano ob
 *      begin z 1/20 verjetnostjo (brez cron odvisnosti).
 *
 * Fail-closed pravila:
 *   • ključ je vezan na profilId — replay tujega ključa je 409 (ne razkriva
 *     odgovora), ne podeduje mutacije;
 *   • napaka DB pri REZERVACIJI → klicatelj dobi napako (ni tihe nadaljnje
 *     mutacije brez idempotence, če je klient zahteval ključ);
 *   • napaka DB pri SHRANJEVANJU odgovora je best-effort (mutacija je že
 *     zavežena; retry dobi 409 → klient conflict → ročna potrditev).
 */

import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

export const IDEMPOTENCY_TTL_DAYS = 30
const GC_PROBABILITY = 0.05

/** Ključ: dolžina + varni znaki (klient pošilja `m<ts>_<rand>`). */
export function isValidIdempotencyKey(key: string | null | undefined): key is string {
  return typeof key === 'string' && key.length >= 8 && key.length <= 128 && /^[A-Za-z0-9_.:-]+$/.test(key)
}

export type BeginIdempotency =
  | { kind: 'new' }
  | { kind: 'replay'; status: number; body: string }
  | { kind: 'conflict' }

/**
 * Signali transakcijske rezervacije (route transactions): tx.idempotencyKey
 * .create je vrgel P2002 — mutacija je bila PREKINJENA (ni dvojnika); klicatelj
 * naj po catch pokliče `beginIdempotency` za replay/conflict odločitev.
 */
export class IdempotencyRaceError extends Error {
  constructor() {
    super('Idempotency ključ že obstaja — transakcija prekinjena')
    this.name = 'IdempotencyRaceError'
  }
}

/**
 * Transakcijska rezervacija: prvi stavek v mutacijski transakciji.
 * P2002 → IdempotencyRaceError (tx se povzroči rollback — exactly-once).
 */
export async function reserveIdempotencyIn(
  tx: Prisma.TransactionClient,
  key: string,
  route: string,
  profileId: string | null,
): Promise<void> {
  try {
    await tx.idempotencyKey.create({ data: { key, route, profileId } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new IdempotencyRaceError()
    }
    throw error
  }
}

/**
 * Rezervacija ključa. Pri P2002 (že obstaja) poskusi vračanje shranjenega
 * odgovora ISTEGA profila; sicer conflict. (Za netransakcijske rute ali
 * odločitev po IdempotencyRaceError.)
 */
export async function beginIdempotency(key: string, route: string, profileId: string | null): Promise<BeginIdempotency> {
  // Lenobni GC (ob 1/20 beginov) — brez cron odvisnosti.
  if (Math.random() < GC_PROBABILITY) {
    void db.idempotencyKey
      .deleteMany({
        where: {
          createdAt: { lt: new Date(Date.now() - IDEMPOTENCY_TTL_DAYS * 24 * 60 * 60 * 1000) },
        },
      })
      .catch(() => undefined)
  }

  try {
    await db.idempotencyKey.create({
      data: { key, route, profileId },
    })
    return { kind: 'new' }
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      throw error
    }
    const existing = await db.idempotencyKey.findUnique({ where: { key } })
    if (!existing) return { kind: 'conflict' }
    if (existing.profileId !== profileId) return { kind: 'conflict' }
    if (existing.responseStatus !== null && existing.responseBody !== null) {
      return { kind: 'replay', status: existing.responseStatus, body: existing.responseBody }
    }
    return { kind: 'conflict' }
  }
}

/** Snapshot odgovora — klicatelj sam odloči (transakcija vs best-effort). */
export async function storeResponseIn(
  tx: Prisma.TransactionClient,
  key: string,
  status: number,
  body: string,
): Promise<void> {
  await tx.idempotencyKey.update({
    where: { key },
    data: { responseStatus: status, responseBody: body },
  })
}

/** Best-effort snapshot (za netransakcijske rute). */
export async function storeResponse(key: string, status: number, body: string): Promise<void> {
  try {
    await db.idempotencyKey.update({
      where: { key },
      data: { responseStatus: status, responseBody: body },
    })
  } catch {
    // Mutacija je že zavežena; retry dobi 409 → klientova conflict plast.
  }
}

/** Konflikt odgovor — jasno sporočilo, brez razkritja tujega odgovora. */
export function idempotencyConflictResponse(): Response {
  return Response.json(
    { error: 'Zapis s tem Idempotency-Key je že v obdelavi ali bil poslan — poskusite znova čez trenutek' },
    { status: 409 },
  )
}

/** Replay odgovor — originalni status + telo. */
export function idempotencyReplayResponse(replay: { status: number; body: string }): Response {
  return new Response(replay.body, {
    status: replay.status,
    headers: {
      'Content-Type': 'application/json',
      'Idempotent-Replay': 'true',
    },
  })
}
