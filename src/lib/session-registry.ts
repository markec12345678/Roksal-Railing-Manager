// Roksal — register sej (issue #5 §2: Session revocation)
// ---------------------------------------------------------------------------
// Žeton ostane brezstanjski HMAC (middleware ga preveri brez baze), ampak
// `authenticate()` zahteva ŽIVO vrstico v tabeli UserSession. Ta modul je
// edini pisar/bralc registra:
//
//   • createUserSession   — ob prijavi (auth/demo/register): vrstica + žeton
//                           z jti; lenobno počisti potekle seje istega profila.
//   • assertSessionAlive  — preverba živosti (obstaja, ni revoke, ni potekel,
//                           pripada pravemu profilu) — kliče authenticate().
//   • revokeSession       — ena naprava (logout / DELETE /api/auth/sessions/:id).
//   • revokeAllForUser    — odjava vseh (ali vseh razen trenutne) naprave;
//                           pokliče jo tudi menjava gesla (fail-closed).
//   • listActiveSessions  — "active-session pregled" za lastnika računa.
//
// Fail-closed pravila: neobstoječ/poterjan/revoke/potečen jti → žeton neveljaven.
// Audit se NE piše tu (klicatelj rute ima request/session kontekst).

import { db } from '@/lib/db'
import { clientIp } from '@/lib/rate-limit'
import { SESSION_TTL_SECONDS, signSession, type SessionPayload } from '@/lib/session'

export interface IssuedSession {
  token: string
  /** id vrstice UserSession = jti v žetonu */
  jti: string
  expiresAt: Date
}

/** Ustvari session vrstico in podpiše žeton z njenim id-jem (jti). */
export async function createUserSession(
  profile: { id: string; email: string; ime: string; vloga: string },
  request: Request,
  ttlSeconds: number = SESSION_TTL_SECONDS,
): Promise<IssuedSession> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000)
  const row = await db.userSession.create({
    data: {
      profileId: profile.id,
      expiresAt,
      userAgent: request.headers.get('user-agent')?.slice(0, 255) ?? null,
      ip: clientIp(request),
    },
    select: { id: true },
  })
  const token = await signSession(
    { sub: profile.id, email: profile.email, ime: profile.ime, vloga: profile.vloga },
    ttlSeconds,
    row.id,
  )
  // Lenobno čiščenje: potekle vrstice istega profila (aktivne pustimo — so
  // "active-session pregled"; revoke vrstice pustimo kot revizijski sled).
  await db.userSession.deleteMany({
    where: { profileId: profile.id, expiresAt: { lte: new Date() } },
  })
  return { token, jti: row.id, expiresAt }
}

/** Fail-closed preverba živosti seje. Vrne true, če je žeton uporaben. */
export async function assertSessionAlive(payload: SessionPayload): Promise<boolean> {
  if (!payload.jti) return false // žeton brez registra — fail-closed
  const row = await db.userSession.findUnique({
    where: { id: payload.jti },
    // R134 (§9): status profila je del živosti — deaktiviran/zaklenjen
    // uporabnik NE SME nadaljevati z že izdanim žetonom (hard requirement).
    // Preverba teče ob VSAKEM avtenticiranem zahtevku, tako da deaktivacija/
    // zaklep učinkujeta TAKOJ, brez čakanja na potek žetona.
    select: {
      profileId: true,
      expiresAt: true,
      revokedAt: true,
      profile: { select: { deactivatedAt: true, lockedAt: true } },
    },
  })
  if (!row) return false
  if (row.profileId !== payload.sub) return false // jti tujega računa
  if (row.revokedAt) return false
  if (row.expiresAt.getTime() <= Date.now()) return false
  if (row.profile.deactivatedAt || row.profile.lockedAt) return false // §9
  return true
}

/** Revoke ene seje. Vrne število posodobljenih vrstic (0 = ni obstajala/ni tvoja). */
export async function revokeSession(jti: string, profileId: string): Promise<number> {
  const res = await db.userSession.updateMany({
    where: { id: jti, profileId },
    data: { revokedAt: new Date() },
  })
  return res.count
}

/**
 * Revoke vseh živih sej profila. `exceptJti` pusti trenutno napravo prijavo
 * (odjava ostalih naprav); brez njega pade TUDI trenutna seja (menjava gesla).
 */
export async function revokeAllForUser(profileId: string, exceptJti?: string): Promise<number> {
  const res = await db.userSession.updateMany({
    where: {
      profileId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      ...(exceptJti ? { id: { not: exceptJti } } : {}),
    },
    data: { revokedAt: new Date() },
  })
  return res.count
}

export interface ActiveSessionView {
  id: string
  createdAt: Date
  expiresAt: Date
  userAgent: string | null
  ip: string | null
  /** true za sejo, iz katere je zahtevek (jti iz piškotka/žetona) */
  current: boolean
}

/** Active-session pregled: žive (nerevoked, nepoteče) seje lastnika računa. */
export async function listActiveSessions(profileId: string, currentJti?: string): Promise<ActiveSessionView[]> {
  const rows = await db.userSession.findMany({
    where: { profileId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true, expiresAt: true, userAgent: true, ip: true },
  })
  return rows.map((r) => ({ ...r, current: r.id === currentJti }))
}
