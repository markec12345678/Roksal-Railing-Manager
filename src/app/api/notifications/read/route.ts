// R143 (issue #5 §29 — Notifications): odpiranje (open ack) obvestila.
//
// POST /api/notifications/read { id } → SENT|DELIVERED → OPENED (isRead=true).
//   • tuj id → 404 (ne razkriva obstoja — vzorec DELETE /api/auth/sessions/[id])
//   • QUEUED/FAILED → 409 (stroga tabela prehodov — odpreti se da samo oddano)
//   • že OPENED → 200 idempotentno (no-op)
// R198 — masovno odpiranje: POST { all: true } → VSE vidne vrstice v stanju
//   SENT|DELIVERED → OPENED (markAllNotificationsOpened, ISTI obseg
//   visibleScope kot per-row; QUEUED/FAILED ostanejo — fail-closed).
//   { id } in { all } sta XOR — oba hkrati → 400 (dvoumna zahteva).
//   • §22: x-correlation-id; anon → 401 (proxy vrata + ruta).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticate, unauthorized } from '@/lib/auth'
import { CORRELATION_HEADER, correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import type { UserRole } from '@prisma/client'
import { zapisOmejitev } from '@/lib/rate-limit'
import {
  markAllNotificationsOpened,
  markNotificationOpened,
  NotificationNotFoundError,
  NotificationTransitionError,
} from '@/lib/notifications'
import { preberiJsonTelo } from '@/lib/api-telo'

export const runtime = 'nodejs'

// R198 — { id } ALI { all: true }, nikoli oba (XOR — dvoumna zahteva → 400).
const readSchema = z
  .object({ id: z.string().min(1).max(128).optional(), all: z.boolean().optional() })
  .refine((v) => (v.id !== undefined) !== (v.all === true), {
    message: 'Natanko ena izbira: id ALI all.',
  })

export async function POST(request: Request): Promise<NextResponse> {
  // R191 — val 2 omejevanja hitrosti na pisanju (WRITE_LIMIT, kind `write`)
  const zavrnjeno = zapisOmejitev(request, 'notifications/read')
  if (zavrnjeno) return zavrnjeno

  const correlationId = correlationFromRequest(request)
  const ctx = await authenticate(request)
  if (!ctx || ctx.kind !== 'user') {
    // 401 nosi korelacijo (§22 — enotna pogodba, vzorec dimnih preverb [23]/[25]).
    const res = unauthorized()
    res.headers.set(CORRELATION_HEADER, correlationId)
    return res
  }
  try {
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const parsed = readSchema.safeParse(telo.telo)
    if (!parsed.success) {
      const res = NextResponse.json(
        { error: 'Neveljaven zahtevek: natanko ena izbira — id ALI all.', correlationId },
        { status: 400 },
      )
      res.headers.set(CORRELATION_HEADER, correlationId)
      return res
    }
    // R198 — XOR dispecer: { all: true } = masovno (markAllNotificationsOpened),
    // { id } = per-row (markNotificationOpened). Obe poti delita 401/§22 pogodbo.
    if (parsed.data.all === true) {
      const openedCount = await markAllNotificationsOpened({
        userId: ctx.session.sub,
        vloga: ctx.session.vloga as UserRole,
      })
      const res = NextResponse.json({ ok: true, opened: openedCount })
      res.headers.set(CORRELATION_HEADER, correlationId)
      return res
    }
    if (!parsed.data.id) {
      // XOR refine to že izloči, TS pa ne more izpeljati — ekspliciten 400
      // (fail-closed: brez id ni per-row odpiranja).
      const res = NextResponse.json(
        { error: 'Neveljaven zahtevek: id je obvezen.', correlationId },
        { status: 400 },
      )
      res.headers.set(CORRELATION_HEADER, correlationId)
      return res
    }
    const result = await markNotificationOpened({
      id: parsed.data.id,
      userId: ctx.session.sub,
      vloga: ctx.session.vloga as UserRole,
    })
    const res = NextResponse.json({ ok: true, ...result })
    res.headers.set(CORRELATION_HEADER, correlationId)
    return res
  } catch (error) {
    if (error instanceof NotificationNotFoundError) {
      const res = NextResponse.json(
        { error: 'Obvestilo ne obstaja ali ni dostopno.', correlationId },
        { status: 404 },
      )
      res.headers.set(CORRELATION_HEADER, correlationId)
      return res
    }
    if (error instanceof NotificationTransitionError) {
      const res = NextResponse.json(
        { error: error.message, correlationId },
        { status: 409 },
      )
      res.headers.set(CORRELATION_HEADER, correlationId)
      return res
    }
    logWithCorrelation('notifications.read.error', correlationId, error)
    const res = NextResponse.json(
      { error: 'Napaka pri odpiranju obvestila', correlationId },
      { status: 500 },
    )
    res.headers.set(CORRELATION_HEADER, correlationId)
    return res
  }
}
