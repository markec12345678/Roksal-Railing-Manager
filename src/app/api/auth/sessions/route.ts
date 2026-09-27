// Roksal — active-session pregled (issue #5 §2)
// ---------------------------------------------------------------------------
// GET /api/auth/sessions — seznam ŽIVIH sej prijavljenega uporabnika
// (nerevoked, nepoteče), najnovejše najprej, z oznako `current` za sejo,
// iz katere prihaja zahtevek. Uporabnik vidi svoje naprave; posamezno sejo
// prekliče prek DELETE /api/auth/sessions/[id].
//
// R195 — DELETE /api/auth/sessions (BREZ id) — odjava VSEH OSTALIH naprav na
// enen potez: uporabnik ostane prijavljen tu (trenutna seja ostane živa), vse
// druge žive seje se revoke. Razlika od 'Vse naprave (tudi ta)' v meniju
// (logout all → revokeAllForUser BREZ izjeme + čiščenje piškotkov): tukaj je
// namen 'počisti druge, jaz ostam' — tipično po sumu na zapuščeno napravo.

import { NextResponse } from 'next/server'
import { requireUser, unauthorized } from '@/lib/auth'
import { listActiveSessions, revokeAllForUser } from '@/lib/session-registry'
import { audit } from '@/lib/audit'
import { zapisOmejitev } from '@/lib/rate-limit'

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

// R195 — val 2 omejevanja hitrosti na pisanju (WRITE_LIMIT, kind `write`)
export async function DELETE(request: Request) {
  const zavrnjeno = zapisOmejitev(request, 'auth/sessions')
  if (zavrnjeno) return zavrnjeno

  const session = await requireUser(request)
  if (!session) return unauthorized()

  // exceptJti = trenutna seja ostane ŽIVA — 'ostani tu, ostalo umri'.
  const revoked = await revokeAllForUser(session.sub, session.jti)
  await audit({ request, session, akcija: 'SESSION_REVOKE_OTHERS', newValue: { revoked } })
  return NextResponse.json({ success: true, revoked })
}
