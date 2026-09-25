// Roksal — javni demo dostop ("vstop brez prijave")
// ---------------------------------------------------------------------------
// Lastnik je želel, da je aplikacija uporabna tudi BREZ poznavanja gesla
// (na Vercelu seed morda ni tekel, `tools/create-admin.ts` pa zahteva shell).
//
// Ta ruta ob enem kliku:
//   1. preveri centralno politiko demoAccessState() (R127 — issue #5 §1):
//      produkcija je privzeto OFF; lastnik lahko vklopi z DEMO_ACCESS=on;
//   2. zagotovi, da demo profil obstaja (upsert — idempotentno, deluje tudi
//      na prazni bazi brez seeda) — vloga je VEDNO MONTER (nikoli ADMIN),
//      obstoječ ADMIN/VODJA demo profil se SNIŽA (migracija r127 to naredi
//      tudi za že naseljene baze);
//   3. geslo profila zrotira na naključno vrednost, ki jo nihče ne pozna —
//      prijava prek /login forme za demo račun je tako nemogoča (dostop
//      izključno prek tega gumba; "credentials niso v source" — #5 §1);
//   4. izda veljaven podpisan sejni žeton (isti mehanizem kot prijava),
//   5. vpiše v audit dnevnik, da je dostop transparenten.
//
// Varnost: geslo se NE pošilja po omrežju. Ruta je omejena s hitrostjo
// (DEMO_LIMIT), saj je ustvarjanje scrypt hasha drago in ne želimo, da je
// ruta DoS vektor. GET vrne javno zastavico { enabled }, da lahko prijavna
// stran demo gumb skrije, kadar je dostop izklopljen.

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { SESSION_COOKIE, isSecureRequest, sessionCookieAttributes } from '@/lib/session'
import { createUserSession } from '@/lib/session-registry'
import { audit } from '@/lib/audit'
import { checkRate, clientIp } from '@/lib/rate-limit'
import { DEMO_EMAIL, DEMO_NAME, DEMO_ROLE, demoAccessState, randomDemoPassword } from '@/lib/demo-access'

/** Demo dostop: 10 zahtev na uro na IP — dovolj za ljudi, premalo za zlorabo. */
const DEMO_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 }

/**
 * GET — javna zastavica, ali je demo dostop omogočen (brez občutljivih
 * podatkov; točno toliko, kot pokaže prijavna stran s prisotnostjo gumba).
 */
export async function GET() {
  const state = demoAccessState()
  return NextResponse.json(
    { enabled: state.enabled },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function POST(request: Request) {
  try {
    // R127 (#5 §1): centralna politika — produkcija privzeto OFF.
    const state = demoAccessState()
    if (!state.enabled) {
      return NextResponse.json(
        {
          error: 'Demo dostop je onemogočen.',
          detail:
            'Na produkciji je demo privzeto izklopljen (issue #5 §1). Lastnik ga lahko omogoči z DEMO_ACCESS=on.',
        },
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

    // Demo profil: VEDNO MONTER (nikoli ADMIN — #5 §1). Upsert tudi SNIŽI
    // že obstoječega ADMIN demo profila (star deploy) in zrotira geslo,
    // da znano geslo iz starih verzij preneha veljati takoj ob prvem
    // novem demo vstopu.
    const profile = await db.profile.upsert({
      where: { email: DEMO_EMAIL },
      update: {
        vloga: DEMO_ROLE,
        passwordHash: await hashPassword(randomDemoPassword()),
      },
      create: {
        email: DEMO_EMAIL,
        ime: DEMO_NAME,
        vloga: DEMO_ROLE,
        passwordHash: await hashPassword(randomDemoPassword()),
      },
    })

    // #5 §2: tudi demo seja gre v register — preklicljiva (logout-all/geslo).
    const issued = await createUserSession(profile, request)

    await db.profile
      .update({ where: { id: profile.id }, data: { lastActive: new Date() } })
      .catch(() => undefined)
    await audit({
      request,
      userId: profile.id,
      akcija: 'DEMO_LOGIN',
      newValue: { vloga: profile.vloga, reason: state.reason },
    })

    const response = NextResponse.json({
      user: { id: profile.id, email: profile.email, ime: profile.ime, vloga: profile.vloga },
      demo: true,
    })
    response.headers.set('Set-Cookie', `${SESSION_COOKIE}=${issued.token}; ${sessionCookieAttributes(isSecureRequest(request))}`)
    return response
  } catch (error) {
    console.error('Demo login error:', error)
    return NextResponse.json({ error: 'Napaka pri demo dostopu.' }, { status: 500 })
  }
}
