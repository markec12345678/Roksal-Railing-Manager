// Roksal Field - API: uporabniki (življenjski cikl računov) — R134 (issue #5 §9)
// GET  /api/users                 → seznam profilov z statusi (ADMIN + VODJA)
// POST /api/users {action, ...}   → upravljanje (SAMO ADMIN):
//   invite            {email, ime, vloga}        → profil brez gesla + aktivacijska povezava (ENKRAT)
//   deactivate        {userId}                   → offboarding: prijava + že izdani žetoni MRTEVI
//   reactivate        {userId}                   → vrnitev v delo
//   lock / unlock     {userId}                   → varnostni zaklep (npr. sum kompromitacije)
//   setRole           {userId, vloga}            → sprememba vloge (seje se revoke — ponovna prijava)
//   resetPassword     {userId}                   → začasno geslo (ENKRAT) + prisilna zamenjava
//
// Fail-closed pravila:
//   • upravljanje = samo ADMIN (VODJA samo bere) in samo uporabniške seje
//     (API ključi ne upravljajo računov — čezrno branje/upravljanje žetonov
//     bi bila nova napadna površina);
//   • ADMIN ne more deaktivirati/zakleniti/spremeniti vloge SAMO SEBI
//     (deloval bi proti lastnemu računu);
//   • vsa dejanja grejo v AuditLog (USER_*) z pravim akterjem;
//   • deaktivacija/zaklep/role-change revoke-ajo VSE žive seje ciljnega
//     profila + assertSessionAlive preverja status ob vsakem zahtevku
//     (dvojna plast — hard requirement: žeton deaktiviranega ne dela).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden, hasRole, MANAGER_ROLES } from '@/lib/auth'
import { hashPassword } from '@/lib/password'
import { revokeAllForUser } from '@/lib/session-registry'
import { audit } from '@/lib/audit'
import {
  VALID_ROLES,
  generateInviteToken,
  generateTempPassword,
  hashInviteToken,
  inviteExpiryFromNow,
  profileLifecycleView,
  emailTaken,
} from '@/lib/user-lifecycle'

const actionsSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('invite'),
    email: z.string().trim().toLowerCase().email('Neveljaven e-naslov'),
    ime: z.string().trim().min(2, 'Ime je obvezno').max(80),
    vloga: z.enum(VALID_ROLES),
  }),
  z.object({ action: z.literal('deactivate'), userId: z.string().min(1) }),
  z.object({ action: z.literal('reactivate'), userId: z.string().min(1) }),
  z.object({ action: z.literal('lock'), userId: z.string().min(1) }),
  z.object({ action: z.literal('unlock'), userId: z.string().min(1) }),
  z.object({ action: z.literal('setRole'), userId: z.string().min(1), vloga: z.enum(VALID_ROLES) }),
  z.object({ action: z.literal('resetPassword'), userId: z.string().min(1) }),
])

const USER_LIST_SELECT = {
  id: true,
  ime: true,
  email: true,
  vloga: true,
  telefon: true,
  lastActive: true,
  createdAt: true,
  deactivatedAt: true,
  lockedAt: true,
  mustChangePassword: true,
  inviteTokenHash: true,
  inviteExpiresAt: true,
} as const

// GET — seznam uporabnikov (ADMIN + VODJA; MONTER/SKLADISCE → 403)
export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (auth.kind !== 'user') {
    return NextResponse.json({ error: 'Uporabnike upravlja samo osebje s sejo' }, { status: 403 })
  }
  if (!hasRole(auth.session, MANAGER_ROLES)) {
    return forbidden('Seznam uporabnikov je samo za pisarno.')
  }
  try {
    const users = await db.profile.findMany({
      orderBy: { createdAt: 'desc' },
      select: USER_LIST_SELECT,
    })
    return NextResponse.json(
      users.map((u) => ({
        id: u.id,
        ime: u.ime,
        email: u.email,
        vloga: u.vloga,
        telefon: u.telefon,
        lastActive: u.lastActive?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
        lifecycle: profileLifecycleView(u),
      })),
    )
  } catch (error) {
    console.error('Users GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju uporabnikov' }, { status: 500 })
  }
}

// POST — upravljanje (samo ADMIN)
export async function POST(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (auth.kind !== 'user') {
    return NextResponse.json({ error: 'Uporabnike upravlja samo osebje s sejo' }, { status: 403 })
  }
  if (!hasRole(auth.session, ['ADMIN'])) {
    return forbidden('Upravljanje računov je samo za administratorja.')
  }

  try {
    const body = await request.json().catch(() => null)
    const parsed = actionsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Neveljavni podatki', detail: parsed.error.issues[0]?.message },
        { status: 400 },
      )
    }
    const actorEmail = auth.session.email

    // ------------------------------------------------------------------
    // Povabilo: profil brez gesla + enkratna aktivacijska povezava.
    // ------------------------------------------------------------------
    if (parsed.data.action === 'invite') {
      const { email, ime, vloga } = parsed.data
      if (await emailTaken(email)) {
        return NextResponse.json({ error: 'Račun s tem e-naslovom že obstaja.' }, { status: 409 })
      }
      const token = generateInviteToken()
      const profile = await db.profile.create({
        data: {
          email,
          ime,
          vloga,
          passwordHash: null, // aktivira ga lastnik žetona z nastavitvijo gesla
          inviteTokenHash: hashInviteToken(token),
          inviteExpiresAt: inviteExpiryFromNow(),
          invitedBy: actorEmail,
          invitedAt: new Date(),
        },
        select: { id: true, email: true },
      })
      await audit({
        request,
        session: auth.session,
        userId: auth.session.sub,
        akcija: 'USER_INVITE',
        oldValue: null,
        newValue: { invitedEmail: email, vloga },
      })
      // Aktivacijska povezava gre v odgovor IZKLJUČNO ENKRAT (ni e-pošte —
      // admin jo posreduje po SMS/telefonu); v bazi je samo hash.
      return NextResponse.json({
        ok: true,
        user: profile,
        activationPath: `/aktivacija/${token}`,
      })
    }

    // ------------------------------------------------------------------
    // Akcije na obstoječem profilu.
    // ------------------------------------------------------------------
    const { userId, action } = parsed.data as { userId: string; action: string }
    const target = await db.profile.findUnique({
      where: { id: userId },
      select: { ...USER_LIST_SELECT },
    })
    if (!target) {
      return NextResponse.json({ error: 'Uporabnik ni najden' }, { status: 404 })
    }

    // Self-guard: ADMIN ne dela destruktivnih akcij nad svojim računom.
    if (['deactivate', 'lock', 'setRole'].includes(action) && userId === auth.session.sub) {
      return NextResponse.json(
        { error: 'Svojega računa ne morete deaktivirati, zakleniti ali mu spremeniti vloge.' },
        { status: 400 },
      )
    }

    let response: Record<string, unknown> = { ok: true }
    let akcija = ''

    if (action === 'deactivate') {
      // §9 offboarding: blokada + revoke vseh živih sej. assertSessionAlive
      // dodatno preverja status ob vsakem zahtevku (dvojna plast).
      await db.profile.update({
        where: { id: userId },
        data: { deactivatedAt: new Date() },
      })
      const revoked = await revokeAllForUser(userId)
      akcija = 'USER_DEACTIVATE'
      response = { ok: true, revokedSessions: revoked }
    } else if (action === 'reactivate') {
      await db.profile.update({ where: { id: userId }, data: { deactivatedAt: null } })
      akcija = 'USER_REACTIVATE'
    } else if (action === 'lock') {
      await db.profile.update({ where: { id: userId }, data: { lockedAt: new Date() } })
      const revoked = await revokeAllForUser(userId)
      akcija = 'USER_LOCK'
      response = { ok: true, revokedSessions: revoked }
    } else if (action === 'unlock') {
      await db.profile.update({ where: { id: userId }, data: { lockedAt: null } })
      akcija = 'USER_UNLOCK'
    } else if (action === 'setRole') {
      const { vloga } = parsed.data as { vloga: (typeof VALID_ROLES)[number] }
      if (vloga === target.vloga) {
        return NextResponse.json({ error: 'Uporabnik že ima to vlogo.' }, { status: 400 })
      }
      await db.profile.update({ where: { id: userId }, data: { vloga } })
      // Žeton nosi vlogo (snapshot) → vse seje se revoke (nova vloga velja po
      // ponovni prijavi; stari žeton ne more "živeti" s staro vlogo).
      const revoked = await revokeAllForUser(userId)
      akcija = 'USER_ROLE_CHANGE'
      response = { ok: true, revokedSessions: revoked }
    } else if (action === 'resetPassword') {
      // §9 password reset (brez e-pošte): začasno geslo gre v odgovor ENKRAT;
      // v bazi je samo scrypt hash. Uporabnik MORA geslo zamenjati (mustChangePassword).
      const tempPassword = generateTempPassword()
      await db.profile.update({
        where: { id: userId },
        data: {
          passwordHash: await hashPassword(tempPassword),
          mustChangePassword: true,
        },
      })
      const revoked = await revokeAllForUser(userId)
      akcija = 'USER_PASSWORD_RESET'
      response = { ok: true, tempPassword, revokedSessions: revoked }
    } else {
      return NextResponse.json({ error: 'Neznana akcija' }, { status: 400 })
    }

    await audit({
      request,
      session: auth.session,
      userId: auth.session.sub,
      akcija,
      oldValue: JSON.stringify({
        email: target.email,
        vloga: target.vloga,
        deactivated: target.deactivatedAt !== null,
        locked: target.lockedAt !== null,
      }),
      newValue: JSON.stringify({
        email: target.email,
        action,
        ...(action === 'setRole' ? { novaVloga: (parsed.data as { vloga?: string }).vloga } : {}),
      }),
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error('Users POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri upravljanju uporabnikov' }, { status: 500 })
  }
}
