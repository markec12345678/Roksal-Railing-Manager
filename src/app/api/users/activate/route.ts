// Roksal Field - API: aktivacija povabljenega računa — R134 (issue #5 §9)
// POST /api/users/activate {token, password}
//
// Javna ruta (lastnik aktivacijske povezave brez seje). Povabilo ustvari
// ADMIN prek /api/users (action 'invite'): profil obstaja BREZ gesla, v bazi
// je IZKLJUČNO sha256 hash žetona (+ pepper) z 7-dnevnim potekom. Aktivacija
// nastavi geslo in počisti žeton (enkratna uporaba).
//
// Fail-closed:
//   • neznanski/potečen/porabljen žeton ali deaktiviran profil → ISTA 400
//     (brez razlikovanja — enumeration protection, vzorec §7/§8);
//   • geslo ≥ 8 znakov (isti standard kot register);
//   • rate limit 6/h na IP — počasneje lahko nekdo »ugiba« URL-je, ampak
//     vsak poskus je viden v logu.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { audit } from '@/lib/audit'
import { checkRate, clientIp } from '@/lib/rate-limit'
import { hashInviteToken } from '@/lib/user-lifecycle'

const activateSchema = z.object({
  token: z.string().min(16).max(64),
  password: z.string().min(8, 'Geslo mora imeti vsaj 8 znakov.').max(256),
})

const GENERIC = { error: 'Aktivacijska povezava ni veljavna ali je potekla. Za novo povabilo se obrnite na pisarno.' }

export async function POST(request: Request) {
  const ip = clientIp(request)
  const rate = checkRate(`activate:${ip}`, { limit: 6, windowMs: 60 * 60 * 1000 })
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'Preveč poskusov, poskusite znova pozneje.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
    )
  }

  try {
    const body = await request.json().catch(() => null)
    const parsed = activateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Neveljavni podatki', detail: parsed.error.issues[0]?.message },
        { status: 400 },
      )
    }
    const { token, password } = parsed.data

    const profile = await db.profile.findUnique({
      where: { inviteTokenHash: hashInviteToken(token) },
      select: {
        id: true,
        email: true,
        deactivatedAt: true,
        lockedAt: true,
        inviteExpiresAt: true,
      },
    })
    // VSA neveljavna stanja (neznanski, porabljen, potečen, deaktiviran,
    // zaklenjen) → ISTA 400 (brez razlikovanja).
    if (
      !profile ||
      profile.deactivatedAt ||
      profile.lockedAt ||
      !profile.inviteExpiresAt ||
      profile.inviteExpiresAt.getTime() <= Date.now()
    ) {
      return NextResponse.json(GENERIC, { status: 400 })
    }

    await db.profile.update({
      where: { id: profile.id },
      data: {
        passwordHash: await hashPassword(password),
        mustChangePassword: false,
        inviteTokenHash: null, // enkratna uporaba — žeton po aktivaciji mrtev
        inviteExpiresAt: null,
      },
      select: { id: true },
    })

    // Audit: aktiverjeva seja ne obstaja — userId = aktiviran račun (lastnik
    // dejanja je račun sam; prijava še ni potekala).
    await audit({ request, userId: profile.id, akcija: 'USER_ACTIVATED', newValue: { email: profile.email } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Users activate Error:', error)
    return NextResponse.json({ error: 'Napaka pri aktivaciji' }, { status: 500 })
  }
}
