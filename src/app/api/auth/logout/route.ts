// Roksal — odjava (issue #5 §2: Session revocation)
// ---------------------------------------------------------------------------
// Prej je logout le pobrisal piškotek — žeton je ostal veljaven do poteka
// (ukraden žeton je preživel odjavo). Zdaj:
//
//   POST /api/auth/logout                  → revoke TE seje (ena naprava)
//   POST /api/auth/logout { all: true }    → revoke vseh ŽIVIH sej RAZEN trenutne
//                                            („odjavi ostale naprave")
//   POST /api/auth/logout { all: true, current: true } → revoke vseh (tudi te)
//
// Piškotek se pobriše v vsakem primeru. Neveljaven/manjkajoč žeton → še vedno
// 200 (odjava je idempotentna; ne razkrivamo stanja žetona).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { SESSION_COOKIE } from '@/lib/session'
import { authenticate } from '@/lib/auth'
import { revokeAllForUser, revokeSession } from '@/lib/session-registry'
import { audit } from '@/lib/audit'

const schema = z
  .object({
    all: z.boolean().optional(),
    current: z.boolean().optional(),
  })
  .optional()

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  const opts = parsed.success ? (parsed.data ?? {}) : {}

  const auth = await authenticate(request)
  if (auth?.kind === 'user') {
    const jti = auth.session.jti
    if (opts.all) {
      const count = await revokeAllForUser(auth.session.sub, opts.current ? undefined : jti)
      await audit({
        request,
        session: auth.session,
        akcija: opts.current ? 'LOGOUT_ALL_INCLUDING_CURRENT' : 'LOGOUT_ALL_DEVICES',
        newValue: { revoked: count, includingCurrent: Boolean(opts.current) },
      })
    } else if (jti) {
      await revokeSession(jti, auth.session.sub)
      await audit({ request, session: auth.session, akcija: 'LOGOUT' })
    }
  }

  const response = NextResponse.json({ success: true, all: Boolean(opts.all) })
  response.headers.set('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
  return response
}
