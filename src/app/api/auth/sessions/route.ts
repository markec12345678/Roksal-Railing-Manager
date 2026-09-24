// Roksal — active-session pregled (issue #5 §2)
// ---------------------------------------------------------------------------
// GET /api/auth/sessions — seznam ŽIVIH sej prijavljenega uporabnika
// (nerevoked, nepoteče), najnovejše najprej, z oznako `current` za sejo,
// iz katere prihaja zahtevek. Uporabnik vidi svoje naprave; posamezno sejo
// prekliče prek DELETE /api/auth/sessions/[id].

import { NextResponse } from 'next/server'
import { requireUser, unauthorized } from '@/lib/auth'
import { listActiveSessions } from '@/lib/session-registry'

export async function GET(request: Request) {
  const session = await requireUser(request)
  if (!session) return unauthorized()

  const sessions = await listActiveSessions(session.sub, session.jti)
  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      current: s.current,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      userAgent: s.userAgent,
      ip: s.ip,
    })),
  })
}
