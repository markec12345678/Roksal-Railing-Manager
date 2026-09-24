// Roksal — sprememba lastnega gesla
// ---------------------------------------------------------------------------
// Brez tega bi moral administrator na strežniku pognati tools/create-admin.ts
// za vsako menjavo gesla. Zahteva trenutno geslo, zato ukradena seja ne more
// spremeniti gesla in zakleniti pravega uporabnika.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/password'
import { authenticate, unauthorized } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { checkRate, clientIp, LOGIN_LIMIT } from '@/lib/rate-limit'

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Novo geslo mora imeti vsaj 8 znakov.').max(256),
})

export async function POST(request: Request) {
  const auth = await authenticate(request)
  if (!auth || auth.kind !== 'user') return unauthorized()

  // Omejitev hitrosti tudi tu: brez nje bi napadalec z ukradeno sejo lahko
  // neomejeno preizkušal trenutno geslo.
  const limitKey = `pwd:${clientIp(request)}:${auth.session.sub}`
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
      releaseOnFailure(limitKey)
      return NextResponse.json(
        { error: 'Neveljavni podatki', detail: parsed.error.issues[0]?.message },
        { status: 400 },
      )
    }

    const profile = await db.profile.findUnique({ where: { id: auth.session.sub } })
    if (!profile?.passwordHash) {
      return NextResponse.json({ error: 'Ta račun nima nastavljenega gesla.' }, { status: 400 })
    }

    const ok = await verifyPassword(parsed.data.currentPassword, profile.passwordHash)
    if (!ok) {
      // Ne sprosti žetona: napačno trenutno geslo JE poskus, ki se šteje.
      await audit({ request, session: auth.session, akcija: 'PASSWORD_CHANGE_FAILED' })
      return NextResponse.json({ error: 'Trenutno geslo ni pravilno.' }, { status: 401 })
    }
    if (await verifyPassword(parsed.data.newPassword, profile.passwordHash)) {
      releaseOnFailure(limitKey)
      return NextResponse.json(
        { error: 'Novo geslo mora biti drugačno od trenutnega.' },
        { status: 400 },
      )
    }

    // Menjava gesla = fail-closed revoke VSEH sej (tudi trenutne): ukraden
    // žeton preživi menjavo gesla le, če ga ne prekličemo. Uporabnik se
    // ponovno prijavi z novim geslom (klient dobi `relogin: true`).
    const [, revokedSessions] = await db.$transaction([
      db.profile.update({
        where: { id: profile.id },
        data: { passwordHash: await hashPassword(parsed.data.newPassword) },
      }),
      db.userSession.updateMany({
        where: { profileId: profile.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ])
    releaseOnFailure(limitKey)
    await audit({ request, session: auth.session, akcija: 'PASSWORD_CHANGED', newValue: { revokedSessions: revokedSessions.count } })
    return NextResponse.json({ ok: true, relogin: true })
  } catch (error) {
    console.error('Password change error:', error)
    return NextResponse.json({ error: 'Napaka pri spremembi gesla.' }, { status: 500 })
  }
}

function releaseOnFailure(key: string): void {
  // Za napake, ki niso poskus ugibanja gesla (validacija, enako geslo),
  // žeton vrnemo — sicer bi uporabnika kaznovali za tipkarsko napako.
  void import('@/lib/rate-limit').then((m) => m.releaseRate(key)).catch(() => undefined)
}
