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
import { SESSION_COOKIE, isSecureRequest, sessionCookieAttributes } from '@/lib/session'
import { createUserSession } from '@/lib/session-registry'
import { authenticate } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { LOGIN_LIMIT, checkRate, clientIp, releaseRate } from '@/lib/rate-limit'
import { accountBlock, BLOCK_MESSAGES } from '@/lib/user-lifecycle'
import { permissionsForRole } from '@/lib/permissions'

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
    const normalizedEmail = email.toLowerCase()

    // Omejevanje hitrosti po (IP + e-naslov): brez tega je brute-force neomejen.
    // Žeton se ob USPEŠNI prijavi vrne, da se uporabnik, ki se desetkrat pravilno
    // prijavi, ne zaklene — kaznovan je samo tisti, ki zgreši.
    const limitKey = `login:${clientIp(request)}:${normalizedEmail}`
    const limit = checkRate(limitKey, LOGIN_LIMIT)
    if (!limit.ok) {
      await audit({ request, akcija: 'LOGIN_RATE_LIMITED', newValue: { email: normalizedEmail } })
      return NextResponse.json(
        { error: 'Preveč poskusov prijave.', detail: `Poskusi znova čez ${limit.retryAfterSeconds} s.` },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      )
    }

    const profile = await db.profile.findUnique({ where: { email: normalizedEmail } })

    // Enako sporočilo in podoben čas za "ni računa" in "napačno geslo":
    // razlika bi napadalcu povedala, kateri e-naslovi so registrirani.
    const invalid = NextResponse.json({ error: 'Napačen e-naslov ali geslo.' }, { status: 401 })
    if (!profile?.passwordHash) {
      await verifyPassword(password, null) // porabi enak čas kot prava preverba
      // Profila ni (ali nima gesla) → v AuditLog ne moremo, ker je userId obvezen
      // tuji ključ. Zato v dnevnik strežnika: tam je vidno in ne laže o lastništvu.
      console.warn('[auth] neuspešna prijava, neznan račun:', { email: normalizedEmail, ip: clientIp(request) })
      return invalid
    }
    const ok = await verifyPassword(password, profile.passwordHash)
    if (!ok) {
      await audit({ request, userId: profile.id, akcija: 'LOGIN_FAILED', newValue: { email: normalizedEmail } })
      return invalid
    }
    // R134 (§9): blokiran račun NE dobi seje. Preverba ŠELE za uspešnim geslom
    // (kdo brez pravih pravic ne izve ničesar o statusu računa), sporočilo pa
    // je jasno — uporabnik ve, da ni pozabil gesla, ampak da račun blokira
    // pisarna. Vsak blokirani poskus gre v dnevnik.
    const block = accountBlock(profile)
    if (block) {
      await audit({
        request,
        userId: profile.id,
        akcija: 'LOGIN_BLOCKED',
        oldValue: null,
        newValue: { razlog: block, email: normalizedEmail },
      })
      return NextResponse.json({ error: BLOCK_MESSAGES[block] }, { status: 403 })
    }
    releaseRate(limitKey)

    // #5 §2: seja gre v register (UserSession) — žeton dobi jti in je preklicljiv.
    const issued = await createUserSession(profile, request)

    await db.profile
      .update({ where: { id: profile.id }, data: { lastActive: new Date() } })
      .catch(() => undefined)
    await audit({ request, userId: profile.id, akcija: 'LOGIN', newValue: { vloga: profile.vloga } })

    const response = NextResponse.json({
      user: { id: profile.id, email: profile.email, ime: profile.ime, vloga: profile.vloga },
      // R134 (§9): admin reset gesla → uporabnik mora geslo zamenjati.
      mustChangePassword: profile.mustChangePassword,
    })
    response.headers.set('Set-Cookie', `${SESSION_COOKIE}=${issued.token}; ${sessionCookieAttributes(isSecureRequest(request))}`)
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
  // R134 (§9): zastavica prisilne zamenjave gesla se bere ŽIVO iz baze
  // (nastavi jo admin reset — seja nosi samo identiteto, ne statusov).
  const mustChangePassword = await db.profile
    .findUnique({ where: { id: session.sub }, select: { mustChangePassword: true } })
    .then((p) => p?.mustChangePassword ?? false)
    .catch(() => false)
  return NextResponse.json({
    user: { id: session.sub, email: session.email, ime: session.ime, vloga: session.vloga },
    expiresAt: session.exp * 1000,
    mustChangePassword,
    // §10 (R135): odjemalec dobi svoje KONKRETNE pravice — UI skriva/omogoča
    // akcije po dovoljenjih (ne po vlogah) in pošteno pokaže, kaj mu manjka.
    permissions: permissionsForRole(session.vloga),
  })
}
