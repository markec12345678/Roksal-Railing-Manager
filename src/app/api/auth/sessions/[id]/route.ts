// Roksal — revoke posamezne seje (issue #5 §2)
// ---------------------------------------------------------------------------
// DELETE /api/auth/sessions/[id] — uporabnik prekliče ENO svojo sejo (napravo).
// Tujega jti ne more preklicati (updateMany filtrira tudi po profileId) —
// poskus na tujo sejo vrne 404, ne 403 (ne razkriva obstoja tujih sej).

import { NextResponse } from 'next/server'
import { requireUser, unauthorized } from '@/lib/auth'
import { revokeSession } from '@/lib/session-registry'
import { audit } from '@/lib/audit'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser(request)
  if (!session) return unauthorized()

  const { id } = await params
  if (!id || typeof id !== 'string' || id.length > 64) {
    return NextResponse.json({ error: 'Neveljaven id seje.' }, { status: 400 })
  }

  const revoked = await revokeSession(id, session.sub)
  if (revoked === 0) {
    // Ni tvoja / ne obstaja / je že revoke — isti odgovor za vse tri.
    return NextResponse.json({ error: 'Seja ne obstaja.' }, { status: 404 })
  }

  await audit({ request, session, akcija: 'SESSION_REVOKE', newValue: { sessionId: id, current: id === session.jti } })
  return NextResponse.json({ success: true, current: id === session.jti })
}
