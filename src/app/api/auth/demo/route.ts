// Roksal — javni demo dostop ("vstop brez prijave")
// ---------------------------------------------------------------------------
// Lastnik je želel, da je aplikacija uporabna tudi BREZ poznavanja gesla
// (na Vercelu seed morda ni tekel, `tools/create-admin.ts` pa zahteva shell).
//
// Ta ruta ob enem kliku:
//   1. zagotovi, da demo profil obstaja (upsert — idempotentno, deluje tudi
//      na prazni bazi brez seeda),
//   2. izda veljaven podpisan sejni žeton (isti mehanizem kot prijava),
//   3. vpiše v audit dnevnik, da je dostop transparenten.
//
// Varnost: geslo se NE pošilja po omrežju. Ruta je javna po zasnovi, a
// omejena s hitrostjo (DEMO_LIMIT), saj je ustvarjanje scrypt hasha drago
// in ne želimo, da je ruta DoS vektor. Demo račun je mogoče izklopiti z
// env spremenljivko DEMO_ACCESS=off.

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { SESSION_COOKIE, isSecureRequest, sessionCookieAttributes, signSession } from '@/lib/session'
import { audit } from '@/lib/audit'
import { checkRate, clientIp } from '@/lib/rate-limit'

/** Demo dostop: 10 zahtev na uro na IP — dovolj za ljudi, premalo za zlorabo. */
const DEMO_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 }

const DEMO_EMAIL = 'demo@roksal.si'
const DEMO_PASSWORD = 'RoksalDemo2026!'
const DEMO_NAME = 'Demo Uporabnik'

export async function POST(request: Request) {
  try {
    // Lastnik lahko javni demo dostop izklopi z env spremenljivko.
    if (process.env.DEMO_ACCESS === 'off') {
      return NextResponse.json(
        { error: 'Demo dostop je onemogočen.' },
        { status: 403 },
      )
    }

    const limitKey = `demo:${clientIp(request)}`
    const limit = checkRate(limitKey, DEMO_LIMIT)
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'Preveč zahtev.', detail: `Poskusi znova čez ${limit.retryAfterSeconds} s.` },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      )
    }

    // Zagotovi, da demo profil obstaja — tudi če seed ni tekel (npr. Vercel).
    const profile = await db.profile.upsert({
      where: { email: DEMO_EMAIL },
      update: {},
      create: {
        email: DEMO_EMAIL,
        ime: DEMO_NAME,
        vloga: 'ADMIN',
        passwordHash: await hashPassword(DEMO_PASSWORD),
      },
    })

    const token = await signSession({
      sub: profile.id,
      email: profile.email,
      ime: profile.ime,
      vloga: profile.vloga,
    })

    await db.profile
      .update({ where: { id: profile.id }, data: { lastActive: new Date() } })
      .catch(() => undefined)
    await audit({ request, userId: profile.id, akcija: 'DEMO_LOGIN', newValue: { vloga: profile.vloga } })

    const response = NextResponse.json({
      user: { id: profile.id, email: profile.email, ime: profile.ime, vloga: profile.vloga },
      demo: true,
    })
    response.headers.set('Set-Cookie', `${SESSION_COOKIE}=${token}; ${sessionCookieAttributes(isSecureRequest(request))}`)
    return response
  } catch (error) {
    console.error('Demo login error:', error)
    return NextResponse.json({ error: 'Napaka pri demo dostopu.' }, { status: 500 })
  }
}
