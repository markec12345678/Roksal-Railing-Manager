// Roksal — registracija (runda S+4 §7).
//
// Zakaj: za DOKAZ multi-user izolacije (in za realno uporabo) mora biti
// mogoče ustvariti več uporabnikov. Do zdaj je obstajal samo demo račun
// (eden za vse) in tools/create-admin.ts (zahteva shell — na Vercelu ni ga).
//
// Varnost:
//   • Nov račun dobi vlogo MONTER (nikoli ADMIN/VODJA prek te rute) —
//     MONTER nima dostopa do cen/zalog/naročil (denyUnless to preverja).
//   • Rate limit 5/uro/IP (ustvarjanje scrypt hasha je drago + zloraba).
//   • Geslo min 8 znakov; hash = scrypt (glej lib/password.ts).
//   • Fail closed: podvojen e-naslov → 409 (brez informacije o drugem računu
//     ne gre — e-naslov je edinstven po zasnovi sheme).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { SESSION_COOKIE, isSecureRequest, sessionCookieAttributes, signSession } from '@/lib/session'
import { audit } from '@/lib/audit'
import { checkRate, clientIp } from '@/lib/rate-limit'

const REGISTER_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 }

const registerSchema = z.object({
  email: z.string().trim().min(3).max(254).email('Neveljaven e-naslov'),
  password: z.string().min(8, 'Geslo mora imeti vsaj 8 znakov').max(256),
  name: z.string().trim().min(1, 'Ime je obvezno').max(80),
})

export async function POST(request: Request) {
  try {
    const limitKey = `register:${clientIp(request)}`
    const limit = checkRate(limitKey, REGISTER_LIMIT)
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'Preveč zahtev za registracijo.', detail: `Poskusi znova čez ${limit.retryAfterSeconds} s.` },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      )
    }

    const body = await request.json().catch(() => null)
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Neveljavni podatki za registracijo', details: parsed.error.issues },
        { status: 400 }
      )
    }
    const email = parsed.data.email.toLowerCase()

    const existing = await db.profile.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Račun s tem e-naslovom že obstaja.' }, { status: 409 })
    }

    const profile = await db.profile.create({
      data: {
        email,
        ime: parsed.data.name,
        vloga: 'MONTER',
        passwordHash: await hashPassword(parsed.data.password),
      },
    })

    const token = await signSession({
      sub: profile.id,
      email: profile.email,
      ime: profile.ime,
      vloga: profile.vloga,
    })
    await audit({ request, userId: profile.id, akcija: 'REGISTER', newValue: { vloga: profile.vloga } })

    const response = NextResponse.json({
      user: { id: profile.id, email: profile.email, ime: profile.ime, vloga: profile.vloga },
    })
    response.headers.set('Set-Cookie', `${SESSION_COOKIE}=${token}; ${sessionCookieAttributes(isSecureRequest(request))}`)
    return response
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Napaka pri registraciji' }, { status: 500 })
  }
}
