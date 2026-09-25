// R143 (issue #5 §29 — Notifications): odpiranje (open ack) obvestila.
//
// POST /api/notifications/read { id } → SENT|DELIVERED → OPENED (isRead=true).
//   • tuj id → 404 (ne razkriva obstoja — vzorec DELETE /api/auth/sessions/[id])
//   • QUEUED/FAILED → 409 (stroga tabela prehodov — odpreti se da samo oddano)
//   • že OPENED → 200 idempotentno (no-op)
//   • §22: x-correlation-id; anon → 401 (proxy vrata + ruta).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticate, unauthorized } from '@/lib/auth'
import { CORRELATION_HEADER, correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import type { UserRole } from '@prisma/client'
import {
  markNotificationOpened,
  NotificationNotFoundError,
  NotificationTransitionError,
} from '@/lib/notifications'

export const runtime = 'nodejs'

const readSchema = z.object({ id: z.string().min(1).max(128) })

export async function POST(request: Request): Promise<NextResponse> {
  const correlationId = correlationFromRequest(request)
  const ctx = await authenticate(request)
  if (!ctx || ctx.kind !== 'user') {
    // 401 nosi korelacijo (§22 — enotna pogodba, vzorec dimnih preverb [23]/[25]).
    const res = unauthorized()
    res.headers.set(CORRELATION_HEADER, correlationId)
    return res
  }
  try {
    const parsed = readSchema.safeParse(await request.json())
    if (!parsed.success) {
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
