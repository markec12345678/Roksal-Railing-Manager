// R143 (issue #5 §29 — Notifications): pridobitev lastnih obvestil.
//
// Pogodba (fail-closed, vzorec sosednjih rut):
//   • proxy vrata že zahtevajo prijavo; ruta še enkrat preveri (authenticate)
//     in pade na 401 z x-correlation-id (§22) — enotno obnašanje.
//   • LENOBNI DISPATCH: pred branjem se QUEUED vrstice oddajo (SENT) —
//     precedens lenobne čistke sej (§2). Idempotentno, brez dvojnega dela.
//   • DELIVERY ACK: pridobljene vrstice v stanju SENT grejo → DELIVERED
//     (klient je pocel; role-naslovljene: prvi član vloge nastavi skupno stanje).
//   • §17 minimalni DTO + strop: limit privzeto 50, strop 200, neveljavne
//     številke → fail-closed privzetek.
//   • §22: x-correlation-id v glavi + logWithCorrelation v 5xx.
import { NextResponse } from 'next/server'
import { authenticate, unauthorized } from '@/lib/auth'
import { db } from '@/lib/db'
import { CORRELATION_HEADER, correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import {
  dispatchQueuedNotifications,
  markNotificationsDelivered,
  visibleScope,
} from '@/lib/notifications'
import type { UserRole } from '@prisma/client'

export const runtime = 'nodejs'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

function limitOf(url: URL): number {
  const raw = url.searchParams.get('limit')
  if (!raw) return DEFAULT_LIMIT
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) return DEFAULT_LIMIT
  return Math.min(n, MAX_LIMIT)
}

export async function GET(request: Request): Promise<NextResponse> {
  const correlationId = correlationFromRequest(request)
  const ctx = await authenticate(request)
  if (!ctx || ctx.kind !== 'user') {
    // 401 nosi korelacijo (§22 — enotna pogodba, vzorec dimnih preverb [23]/[25]).
    const res = unauthorized()
    res.headers.set(CORRELATION_HEADER, correlationId)
    return res
  }
  try {
    // Lenobni dispatch (QUEUED → SENT) — poceni, idempotentno gospodinjenje.
    await dispatchQueuedNotifications()

    const url = new URL(request.url)
    const limit = limitOf(url)
    // vloga je strežniško podpisana (obveljavljena ob izdaji) — UserRole kast je varen.
    const scope = visibleScope({
      userId: ctx.session.sub,
      vloga: ctx.session.vloga as UserRole,
    })
    const rows = await db.notification.findMany({
      where: scope,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        naslov: true,
        sporocilo: true,
        isRead: true,
        status: true,
        template: true,
        templateVersion: true,
        entityType: true,
        entityId: true,
        retryCount: true,
        maxRetries: true,
        lastError: true,
        correlationId: true,
        createdAt: true,
        sentAt: true,
        deliveredAt: true,
        openedAt: true,
      },
    })

    // Delivery ack: točno pridobljene SENT vrstice → DELIVERED (idempotentno).
    // Odziv odraža stanje PO acku (deljiv `now` — deterministično enako bazi).
    const ackNow = new Date()
    const sentIds = rows.filter((r) => r.status === 'SENT').map((r) => r.id)
    if (sentIds.length > 0) {
      await markNotificationsDelivered({
        userId: ctx.session.sub,
        vloga: ctx.session.vloga as UserRole,
        ids: sentIds,
        now: ackNow,
      })
      for (const r of rows) {
        if (sentIds.includes(r.id)) {
          r.status = 'DELIVERED'
          r.deliveredAt = ackNow
        }
      }
    }

    const res = NextResponse.json({ notifications: rows })
    res.headers.set(CORRELATION_HEADER, correlationId)
    return res
  } catch (error) {
    logWithCorrelation('notifications.list.error', correlationId, error)
    const res = NextResponse.json(
      { error: 'Napaka pri branju obvestil', correlationId },
      { status: 500 },
    )
    res.headers.set(CORRELATION_HEADER, correlationId)
    return res
  }
}
