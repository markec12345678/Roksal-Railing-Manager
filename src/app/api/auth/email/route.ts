// Roksal - API: menjava e-pošte (samo-servis) — R134 (issue #5 §9)
// POST /api/auth/email {newEmail, currentPassword}
//
// Menjava identitete je občutljiva: zahteva TRENUTNO geslo (ukradena seja ne
// more sama spremeniti e-pošte brez gesla), unikatenost (409), in revoke VSEH
// drugih sej (druge naprave se morajo znova prijaviti s novo identiteto).
// Trenutna seja ostane živa (uporabnik je pravkar dokazal identiteto z geslom).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { verifyPassword } from '@/lib/password'
import { revokeAllForUser } from '@/lib/session-registry'
import { audit } from '@/lib/audit'
import { LOGIN_LIMIT, checkRate, clientIp } from '@/lib/rate-limit'
import { emailTaken } from '@/lib/user-lifecycle'

const schema = z.object({
  newEmail: z.string().trim().toLowerCase().email('Neveljaven e-naslov.').max(254),
  currentPassword: z.string().min(1).max(256),
})

export async function POST(request: Request) {
  const auth = await authenticate(request)
  if (!auth || auth.kind !== 'user') return unauthorized()

  const limitKey = `email-change:${clientIp(request)}:${auth.session.sub}`
  const limit = checkRate(limitKey, LOGIN_LIMIT)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Preveč poskusov.', detail: `Poskusi znova čez ${limit.retryAfterSeconds} s.` },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    )
  }

  try {
    const body = await request.json().catch(() => null)
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Neveljavni podatki', detail: parsed.error.issues[0]?.message },
        { status: 400 },
      )
    }
    const { newEmail, currentPassword } = parsed.data

    const profile = await db.profile.findUnique({
      where: { id: auth.session.sub },
      select: { id: true, email: true, passwordHash: true, deactivatedAt: true, lockedAt: true },
    })
    if (!profile) return unauthorized()

    // Blokiran račun ne upravlja z identiteto (tujega admin ukrep ne zaobidemo).
    if (profile.deactivatedAt || profile.lockedAt) {
      return NextResponse.json({ error: 'Ta račun je blokiran.' }, { status: 403 })
    }

    // Trenutno geslo je obvezno (žeton sam NE zadostuje).
    const ok = await verifyPassword(currentPassword, profile.passwordHash)
    if (!ok) {
      await audit({ request, userId: profile.id, akcija: 'USER_EMAIL_CHANGE_FAILED', newValue: { razlog: 'wrong_password' } })
      return NextResponse.json({ error: 'Trenutno geslo ni pravilno.' }, { status: 403 })
    }

    if (newEmail === profile.email) {
      return NextResponse.json({ error: 'To je že vaš e-naslov.' }, { status: 400 })
    }
    if (await emailTaken(newEmail)) {
      return NextResponse.json({ error: 'Račun s tem e-naslovom že obstaja.' }, { status: 409 })
    }

    await db.profile.update({ where: { id: profile.id }, data: { email: newEmail } })
    // Druge naprave: revoke (nova identiteta → ponovna prijava). Trenutna seja ostane.
    const revoked = await revokeAllForUser(profile.id, auth.session.jti)

    await audit({
      request,
      userId: profile.id,
      akcija: 'USER_EMAIL_CHANGE',
      oldValue: JSON.stringify({ email: profile.email }),
      newValue: JSON.stringify({ email: newEmail, revokedSessions: revoked }),
    })

    return NextResponse.json({ ok: true, email: newEmail, revokedSessions: revoked })
  } catch (error) {
    console.error('Auth email change Error:', error)
    return NextResponse.json({ error: 'Napaka pri menjavi e-pošte.' }, { status: 500 })
  }
}
