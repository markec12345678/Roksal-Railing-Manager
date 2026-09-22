// Roksal — prijava in trenutni uporabnik
// ---------------------------------------------------------------------------
// POPRAVEK: prejšnja različica te rute NI bila prijava. Za poljuben e-mail,
// ki ga ni poznala, je ustvarila profil z vlogo ADMIN:
//
//   if (!profile) { db.profile.create({ data: { email, vloga: 'ADMIN' } }) }
//
// in gesla sploh ni preverjala (`body.password` je bil prebran in opuščen).
// Kdorkoli je lahko z enim POST postal administrator. Zdaj: geslo se preveri
// proti scrypt hashu, računov se ne ustvarja preko API-ja (glej
// `tools/create-admin.ts`), in uspešna prijava izda podpisan sejni žeton.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { SESSION_COOKIE, isSecureRequest, sessionCookieAttributes, signSession } from '@/lib/session'
import { authenticate } from '@/lib/auth'

const loginSchema = z.object({
  email: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(256),
})

// POST — prijava
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neveljavni podatki za prijavo.' }, { status: 400 })
    }
    const { email, password } = parsed.data

    const profile = await db.profile.findUnique({ where: { email: email.toLowerCase() } })

    // Enako sporočilo in podoben čas za "ni računa" in "napačno geslo":
    // razlika bi napadalcu povedala, kateri e-naslovi so registrirani.
    const invalid = NextResponse.json({ error: 'Napačen e-naslov ali geslo.' }, { status: 401 })
    if (!profile?.passwordHash) {
      await verifyPassword(password, null) // porabi enak čas kot prava preverba
      return invalid
    }
    const ok = await verifyPassword(password, profile.passwordHash)
    if (!ok) return invalid

    const token = await signSession({
      sub: profile.id,
      email: profile.email,
      ime: profile.ime,
      vloga: profile.vloga,
    })

    await db.profile
      .update({ where: { id: profile.id }, data: { lastActive: new Date() } })
      .catch(() => undefined)

    const response = NextResponse.json({
      user: { id: profile.id, email: profile.email, ime: profile.ime, vloga: profile.vloga },
    })
    response.headers.set('Set-Cookie', `${SESSION_COOKIE}=${token}; ${sessionCookieAttributes(isSecureRequest(request))}`)
    return response
  } catch (error) {
    console.error('Auth login error:', error)
    return NextResponse.json({ error: 'Napaka pri prijavi.' }, { status: 500 })
  }
}

// GET — kdo sem (za inicializacijo vmesnika)
export async function GET(request: Request) {
  const context = await authenticate(request)
  if (context?.kind !== 'user') {
    return NextResponse.json({ error: 'Neavtoriziran dostop' }, { status: 401 })
  }
  const { session } = context
  return NextResponse.json({
    user: { id: session.sub, email: session.email, ime: session.ime, vloga: session.vloga },
    expiresAt: session.exp * 1000,
  })
}
