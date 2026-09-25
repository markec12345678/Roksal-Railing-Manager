// R141 (issue #5 §23): pregled zadnjih zagonov poslov — samo ADMIN.
//
// Minimalni DTO (§17): samo polja, ki jih UI pokaže; lastError je že
// sanitiziran ob zapisu (correlationErrorSummary — brez stacka, §22).
// API ključi → 403 (fail-closed, isti razlog kot pri /api/jobs/run).
import { NextResponse } from 'next/server'
import { denyUnless, ADMIN_ROLES } from '@/lib/auth'
import { JOB_REGISTRY, JOB_MAX_ATTEMPTS } from '@/lib/jobs'
import { CORRELATION_HEADER, correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

const LIST_LIMIT = 50

export async function GET(request: Request): Promise<NextResponse> {
  const correlationId = correlationFromRequest(request)
  const denied = await denyUnless(request, ADMIN_ROLES)
  if (denied) return denied
  try {
    const rows = await db.jobRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
      select: {
        id: true,
        type: true,
        owner: true,
        status: true,
        attempts: true,
        maxAttempts: true,
        lastError: true,
        correlationId: true,
        durationMs: true,
        createdAt: true,
        finishedAt: true,
        result: true,
      },
    })
    const res = NextResponse.json({
      jobs: rows.map((r) => ({
        ...r,
        // Rezultat je shranjen kot JSON niz — klient dobi strukturo (brez
        // dvojnega parseanja v UI), pri pokvarjenem zapisu null (fail-safe).
        result: r.result ? safeParse(r.result) : null,
      })),
      registry: JOB_REGISTRY.map((j) => ({ type: j.type, opis: j.opis })),
      retryPolicy: { maxAttempts: JOB_MAX_ATTEMPTS, window: 'UTC dan (idempotencyKey)' },
    })
    res.headers.set(CORRELATION_HEADER, correlationId)
    return res
  } catch (error) {
    logWithCorrelation('jobs.list.error', correlationId, error)
    const res = NextResponse.json(
      { error: 'Napaka pri branju registera poslov', correlationId },
      { status: 500 },
    )
    res.headers.set(CORRELATION_HEADER, correlationId)
    return res
  }
}

function safeParse(json: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(json)
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}
