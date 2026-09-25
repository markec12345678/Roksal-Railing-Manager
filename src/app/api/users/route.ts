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
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { lacksPermission } from '@/lib/access'
import { hashPassword } from '@/lib/password'
import { revokeAllForUser } from '@/lib/session-registry'
import { auditInTx } from '@/lib/audit'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import {
  VALID_ROLES,
  generateInviteToken,
  generateTempPassword,
  hashInviteToken,
  inviteExpiryFromNow,
  profileLifecycleView,
  emailTaken,
} from '@/lib/user-lifecycle'

// Meje strani (R139 §17) — isti kontrakt kot customers/schedules.
const USER_DEFAULT_LIMIT = 500
const USER_MAX_LIMIT = 500

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

// GET — seznam uporabnikov (§10: users.read = ADMIN + VODJA; ostali → 403)
export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (auth.kind !== 'user') {
    return NextResponse.json({ error: 'Uporabnike upravlja samo osebje s sejo' }, { status: 403 })
  }
  if (lacksPermission(auth, 'users.read')) {
    return forbidden('Seznam uporabnikov je pravica users.read (pisarna).')
  }
  const correlationId = correlationFromRequest(request)
  try {
    // R139 (issue #5 §17): strop na findMany — isti kontrakt kot customers/
    // schedules (neveljavne številke → privzeti limit, odzivna oblika ista).
    const { searchParams } = new URL(request.url)
    const limitRaw = Number.parseInt(searchParams.get('limit') ?? '', 10)
    const offsetRaw = Number.parseInt(searchParams.get('offset') ?? '', 10)
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(limitRaw, USER_MAX_LIMIT)
        : USER_DEFAULT_LIMIT
    const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0
    const users = await db.profile.findMany({
      orderBy: { createdAt: 'desc' },
      select: USER_LIST_SELECT,
      take: limit,
      skip: offset,
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
    logWithCorrelation('users.get', correlationId, error)
    return NextResponse.json({ error: 'Napaka pri branju uporabnikov', correlationId }, { status: 500 })
  }
}

// POST — upravljanje (§10: users.manage = izključno ADMIN)
export async function POST(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (auth.kind !== 'user') {
    return NextResponse.json({ error: 'Uporabnike upravlja samo osebje s sejo' }, { status: 403 })
  }
  if (lacksPermission(auth, 'users.manage')) {
    return forbidden('Upravljanje računov je pravica users.manage (izključno administrator).')
  }
  const correlationId = correlationFromRequest(request)

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
      // R136 (§19): profil + revizijski vpis v ENI transakciji — povabilo brez
      // sledi v dnevniku ne sme obstajati (in obratno; crash med korakoma = nič).
      const profile = await db.$transaction(async (tx) => {
        const created = await tx.profile.create({
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
        await auditInTx(tx, {
          request,
          session: auth.session,
          userId: auth.session.sub,
          akcija: 'USER_INVITE',
          oldValue: null,
          newValue: { invitedEmail: email, vloga },
        })
        return created
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

    // R136 (§19): vsa stanja tečejo v ENI transakciji (profil + revoke sej +
    // revizijski vpis). Crash med koraki = ROLBACK — ne obstaja okno, kjer bi
    // deaktiviran uporabnik imel žive žetone ali vloga bi bila spremenjena brez
    // sledi v dnevniku (§9 hard requirement + "critical audit" iz §19).
    let response: Record<string, unknown>

    if (action === 'deactivate') {
      // §9 offboarding: blokada + revoke vseh živih sej. assertSessionAlive
      // dodatno preverja status ob vsakem zahtevku (dvojna plast).
      response = await db.$transaction(async (tx) => {
        await tx.profile.update({
          where: { id: userId },
          data: { deactivatedAt: new Date() },
        })
        const revoked = await revokeAllForUser(userId, undefined, tx)
        await auditInTx(tx, {
          request,
          session: auth.session,
          userId: auth.session.sub,
          akcija: 'USER_DEACTIVATE',
          oldValue: lifecycleSnapshot(target),
          newValue: { email: target.email, action },
        })
        return { ok: true, revokedSessions: revoked }
      })
    } else if (action === 'reactivate') {
      response = await db.$transaction(async (tx) => {
        await tx.profile.update({ where: { id: userId }, data: { deactivatedAt: null } })
        await auditInTx(tx, {
          request,
          session: auth.session,
          userId: auth.session.sub,
          akcija: 'USER_REACTIVATE',
          oldValue: lifecycleSnapshot(target),
          newValue: { email: target.email, action },
        })
        return { ok: true }
      })
    } else if (action === 'lock') {
      response = await db.$transaction(async (tx) => {
        await tx.profile.update({ where: { id: userId }, data: { lockedAt: new Date() } })
        const revoked = await revokeAllForUser(userId, undefined, tx)
        await auditInTx(tx, {
          request,
          session: auth.session,
          userId: auth.session.sub,
          akcija: 'USER_LOCK',
          oldValue: lifecycleSnapshot(target),
          newValue: { email: target.email, action },
        })
        return { ok: true, revokedSessions: revoked }
      })
    } else if (action === 'unlock') {
      response = await db.$transaction(async (tx) => {
        await tx.profile.update({ where: { id: userId }, data: { lockedAt: null } })
        await auditInTx(tx, {
          request,
          session: auth.session,
          userId: auth.session.sub,
          akcija: 'USER_UNLOCK',
          oldValue: lifecycleSnapshot(target),
          newValue: { email: target.email, action },
        })
        return { ok: true }
      })
    } else if (action === 'setRole') {
      const { vloga } = parsed.data as { vloga: (typeof VALID_ROLES)[number] }
      if (vloga === target.vloga) {
        return NextResponse.json({ error: 'Uporabnik že ima to vlogo.' }, { status: 400 })
      }
      response = await db.$transaction(async (tx) => {
        await tx.profile.update({ where: { id: userId }, data: { vloga } })
        // Žeton nosi vlogo (snapshot) → vse seje se revoke (nova vloga velja po
        // ponovni prijavi; stari žeton ne more "živeti" s staro vlogo).
        const revoked = await revokeAllForUser(userId, undefined, tx)
        await auditInTx(tx, {
          request,
          session: auth.session,
          userId: auth.session.sub,
          akcija: 'USER_ROLE_CHANGE',
          oldValue: lifecycleSnapshot(target),
          newValue: { email: target.email, action, novaVloga: vloga },
        })
        return { ok: true, revokedSessions: revoked }
      })
    } else if (action === 'resetPassword') {
      // §9 password reset (brez e-pošte): začasno geslo gre v odgovor ENKRAT;
      // v bazi je samo scrypt hash. Uporabnik MORA geslo zamenjati (mustChangePassword).
      const tempPassword = generateTempPassword()
      const passwordHash = await hashPassword(tempPassword) // CPU izven transakcije
      response = await db.$transaction(async (tx) => {
        await tx.profile.update({
          where: { id: userId },
          data: { passwordHash, mustChangePassword: true },
        })
        const revoked = await revokeAllForUser(userId, undefined, tx)
        await auditInTx(tx, {
          request,
          session: auth.session,
          userId: auth.session.sub,
          akcija: 'USER_PASSWORD_RESET',
          oldValue: lifecycleSnapshot(target),
          newValue: { email: target.email, action }, // gesla NIKOLI v dnevniku
        })
        return { ok: true, tempPassword, revokedSessions: revoked }
      })
    } else {
      return NextResponse.json({ error: 'Neznana akcija' }, { status: 400 })
    }

    return NextResponse.json(response)
  } catch (error) {
    logWithCorrelation('users.post', correlationId, error)
    return NextResponse.json({ error: 'Napaka pri upravljanju uporabnikov', correlationId }, { status: 500 })
  }
}

/** Snapshot stanja profila PRED akcijo — v dnevnik gre razlika, ne celoten profil. */
function lifecycleSnapshot(target: {
  email: string
  vloga: string
  deactivatedAt: Date | null
  lockedAt: Date | null
}): Record<string, unknown> {
  return {
    email: target.email,
    vloga: target.vloga,
    deactivated: target.deactivatedAt !== null,
    locked: target.lockedAt !== null,
  }
}
