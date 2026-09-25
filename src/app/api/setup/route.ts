// Roksal — nastavitvena konzola (R137)
// ---------------------------------------------------------------------------
// GET  /api/setup → { enabled: boolean } (brez žetona — samo "ali je vklopljena")
// POST /api/setup → bootstrap NOVEGA ADMIN računa ALI obnova lastnikovega
//                   (geslo + vloga + blokade + seje) — zaščiteno z žetonom iz
//                   okolja (glej src/lib/setup.ts za celotno politiko).
//
// Fail-closed vrstni red: 404 (izklopljeno) → rate limit → 403 (žeton) →
// 400 (telo) → 403 (politika ožilja) → transakcija (§19) → audit.
// Vsak zavrnjen poskus pusti sled (SETUP_DENIED) z hashiranim IP.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { checkRate, clientIp, releaseRate } from '@/lib/rate-limit'
import { hashIp } from '@/lib/portal'
import {
  SETUP_LIMIT,
  resolveSetupMode,
  setupTokenFromEnv,
  tokenMatches,
} from '@/lib/setup'

const schema = z.object({
  email: z.string().trim().min(3).max(254).email('Neveljaven e-naslov'),
  password: z.string().min(8, 'Geslo mora imeti vsaj 8 znakov.').max(256),
  // Ime je obvezno SAMO pri ustvarjanju (BOOTSTRAP); pri obnovi ohranimo.
  name: z.string().trim().min(1).max(80).optional(),
})

export async function GET() {
  return NextResponse.json({ enabled: setupTokenFromEnv() !== null })
}

export async function POST(request: Request) {
  const expected = setupTokenFromEnv()
  if (!expected) {
    // Izklopljena konzola — ne razkrivamo niti tega, da ruta obstaja.
    return NextResponse.json({ error: 'Nastavitev ni na voljo.' }, { status: 404 })
  }

  const ip = clientIp(request)
  const limitKey = `setup:${ip}`
  const limit = checkRate(limitKey, SETUP_LIMIT)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Preveč poskusov.', detail: `Poskusite znova čez ${limit.retryAfterSeconds} s.` },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    )
  }

  const ipHash = hashIp(ip)
  const userAgent = request.headers.get('user-agent')
  const deny = async (akcija: 'SETUP_DENIED' | 'SETUP_FAILED', podrobnosti: string) => {
    // Vzdržljiv dnevnik (nauček R132): napaka pisanja se javi, ne taji.
    try {
      await db.auditLog.create({
        data: {
          userId: null, // javni dogodek brez seje (null = sistemski, FK varen)
          akcija,
          newValue: podrobnosti,
          ipAddress: ipHash,
          userAgent: userAgent?.slice(0, 255) ?? null,
        },
      })
    } catch (error) {
      console.error('Setup audit napaka:', error)
    }
  }

  if (!tokenMatches(request.headers.get('x-setup-token'), expected)) {
    await deny('SETUP_DENIED', 'neveljaven žeton')
    return NextResponse.json({ error: 'Neveljaven žeton.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    releaseRate(limitKey) // tipkarska napaka ni poskus ugibanja žetona
    return NextResponse.json(
      { error: 'Neveljavni podatki', detail: parsed.error.issues[0]?.message },
      { status: 400 },
    )
  }

  const email = parsed.data.email.toLowerCase()
  const existing = await db.profile.findUnique({ where: { email } })
  const mode = resolveSetupMode(email, existing !== null)
  if (!mode) {
    // Fail-closed: obstoječ račun brez ujemajočega ROKSAL_SETUP_EMAIL se NE
    // dotikamo (odgovor NE razkriva, ali račun obstaja — enumeracija).
    await deny('SETUP_DENIED', 'politika ožilja (obstoječ račun brez ujemanja)')
    return NextResponse.json(
      { error: 'Ta račun ni dosegljiv prek nastavitvene konzole. Nastavite ROKSAL_SETUP_EMAIL.' },
      { status: 403 },
    )
  }

  const passwordHash = await hashPassword(parsed.data.password) // CPU izven tx (R136)

  try {
    if (mode === 'BOOTSTRAP') {
      if (!parsed.data.name) {
        releaseRate(limitKey)
        return NextResponse.json(
          { error: 'Neveljavni podatki', detail: 'Ime je obvezno.' },
          { status: 400 },
        )
      }
      const profile = await db.$transaction(async (tx) => {
        const created = await tx.profile.create({
          data: {
            email,
            ime: parsed.data.name as string,
            vloga: 'ADMIN',
            passwordHash,
            mustChangePassword: false,
          },
        })
        await tx.auditLog.create({
          data: {
            userId: created.id,
            akcija: 'SETUP_BOOTSTRAP',
            newValue: JSON.stringify({ email, mode: 'BOOTSTRAP', vloga: 'ADMIN' }),
            ipAddress: ipHash,
            userAgent: userAgent?.slice(0, 255) ?? null,
          },
        })
        return created
      })
      releaseRate(limitKey)
      return NextResponse.json({ ok: true, mode: 'BOOTSTRAP', email: profile.email })
    }

    // RECOVER — obstoječ račun, ožilje se točno ujema. Novo geslo, ADMIN,
    // odprte blokade, počiščena povabila, VSE seje revoke (ukraden žeton mrtev).
    const existingId = existing!.id
    const previousRole = existing!.vloga
    const revokedSessions = await db.$transaction(async (tx) => {
      await tx.profile.update({
        where: { id: existingId },
        data: {
          passwordHash,
          vloga: 'ADMIN',
          deactivatedAt: null,
          lockedAt: null,
          mustChangePassword: false,
          inviteTokenHash: null,
          inviteExpiresAt: null,
        },
      })
      const sessions = await tx.userSession.updateMany({
        where: { profileId: existingId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      await tx.auditLog.create({
        data: {
          userId: existingId,
          akcija: 'SETUP_RECOVER',
          oldValue: JSON.stringify({ vloga: previousRole }),
          newValue: JSON.stringify({
            email,
            mode: 'RECOVER',
            vloga: 'ADMIN',
            revokedSessions: sessions.count,
          }),
          ipAddress: ipHash,
          userAgent: userAgent?.slice(0, 255) ?? null,
        },
      })
      return sessions.count
    })
    releaseRate(limitKey)
    return NextResponse.json({ ok: true, mode: 'RECOVER', email, revokedSessions })
  } catch (error) {
    console.error('Setup napaka:', error)
    await deny('SETUP_FAILED', 'napaka pri zapisu')
    return NextResponse.json({ error: 'Napaka pri nastavitvi. Poskusite znova.' }, { status: 500 })
  }
}
