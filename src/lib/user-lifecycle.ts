// Roksal — življenjski cikl uporabnikov (R134, issue #5 §9)
// ---------------------------------------------------------------------------
// Prej so imeli profili SAMO vlogo: brez deaktivacije, zaklepa, povabljanja
// ali prisilne zamenjave gesla. Deaktiviran/zaklenjen uporabnik je lahko
// nadaljeval z že izdanim žetonom (seje so žive do poteka), edini način
// "izklopa" je bil brisanje profila (cascade — uniči revizijske sledi).
//
// Ta modul je ENOTEN vir resnice za:
//   • status blokade (deactivatedAt / lockedAt) — bere ga
//     assertSessionAlive ob VSAKEM zahtevku (hard requirement §9: že izdani
//     žeton deaktiviranega uporabnika preneha delovati TAKOJ);
//   • aktivacijske žetone povabil (crypto, hash v bazi, čistega NIKOLI);
//   • začasna gesla admin reset-a (kripto, prikazana ENKRAT — ni e-poštne
//     infrastrukture, geslo prevzame admin/lastnik offline).
//
// Upravljanje (invite/deactivate/reactivate/lock/unlock/setRole/resetPassword)
// je v /api/users (ADMIN; branje tudi VODJA), aktivacija v /api/users/activate
// (javna, žeton), menjava e-pošte v /api/auth/email (samo-servis).

import { createHash, randomBytes, randomInt } from 'node:crypto'
import { db } from '@/lib/db'

/** Privzeti življenjski vek aktivacijske povezave povabila. */
export const INVITE_TTL_DAYS = 7

/** Dolžina začasnega gesla admin reset-a (kripto varno, brez nejasnih znakov). */
export const TEMP_PASSWORD_LENGTH = 14

/** Veljavne vloge za setRole/invite — usklajeno z enumom UserRole v shemi. */
export const VALID_ROLES = ['ADMIN', 'VODJA', 'MONTER', 'SKLADISCE'] as const
export type ValidRole = (typeof VALID_ROLES)[number]

/** Referenca statusnih polj profila (subset Profile). */
export interface AccountStatusState {
  deactivatedAt: Date | null
  lockedAt: Date | null
}

/**
 * Vrsta blokade računa. `null` = račun je aktiven.
 * Deaktivacija ima prednost pri PREDSTAVLJANJU (offboarding je odločitev
 * "uporabnik ne dela več tu"), obe pa blokirata povsem.
 */
export function accountBlock(
  state: AccountStatusState,
  now: Date = new Date(),
): 'DEACTIVATED' | 'LOCKED' | null {
  if (state.deactivatedAt && state.deactivatedAt.getTime() <= now.getTime()) return 'DEACTIVATED'
  if (state.lockedAt && state.lockedAt.getTime() <= now.getTime()) return 'LOCKED'
  return null
}

/** Enotni javni razlogi za blokado prijave (ali uporabnik ve, kaj se dogaja). */
export const BLOCK_MESSAGES: Record<'DEACTIVATED' | 'LOCKED', string> = {
  DEACTIVATED:
    'Ta račun je deaktiviran. Za dostop se obrnite na vodjo ekipe (pisarna, +386 4 237 05 50).',
  LOCKED:
    'Ta račun je zaklenjen iz varnostnih razlogov. Za odklep se obrnite na administratorja.',
}

/**
 * Aktivacijski žeton povabila: 18 bajtov entropije → 24 znakov base64url.
 * V bazo gre IZKLJUČNO sha256 hash (pepper) — uhajanje baze ne razkrije žetonov.
 */
export function generateInviteToken(): string {
  return randomBytes(18).toString('base64url')
}

export function hashInviteToken(token: string): string {
  const pepper = process.env.API_KEY_PEPPER ?? 'roksal-local-pepper'
  return createHash('sha256').update(`${token}:${pepper}`).digest('hex')
}

/** Izračun datum poteka povabila. */
export function inviteExpiryFromNow(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)
}

/**
 * Začasno geslo za admin reset (§9: password reset brez e-poštne
 * infrastrukture — admin ga prikaže uporabniku ENKRAT). Kripto varno:
 * vsak znak iz randomInt (modulo bias izločen z odrezovalnikom), brez
 * zamenljivih znakov (0/O, 1/l/I) — uporabniku ga je moč dictirati po telefonu.
 */
const TEMP_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function generateTempPassword(length: number = TEMP_PASSWORD_LENGTH): string {
  const out: string[] = []
  const max = 256 - (256 % TEMP_ALPHABET.length)
  while (out.length < length) {
    const buf = randomBytes(length)
    for (const b of buf) {
      if (out.length >= length) break
      if (b >= max) continue
      out.push(TEMP_ALPHABET[b % TEMP_ALPHABET.length])
    }
  }
  // Garancija vsaj ena številka in ena mala + ena velika črka (zamenjaj naključni
  // indeks — geslo ostane naključno, samo znak razred je poskrbljen).
  const hasDigit = out.some((c) => /[0-9]/.test(c))
  const hasLower = out.some((c) => /[a-z]/.test(c))
  const hasUpper = out.some((c) => /[A-Z]/.test(c))
  const idx = randomInt(0, length)
  if (!hasDigit) out[idx] = String(randomInt(2, 10))
  if (!hasLower) out[randomInt(0, length)] = 'k'
  if (!hasUpper) out[randomInt(0, length)] = 'K'
  return out.join('')
}

/**
 * Statusni blok profila za API odgovore (upravljanje) — brez internih polj.
 */
export function profileLifecycleView(p: {
  deactivatedAt: Date | null
  lockedAt: Date | null
  mustChangePassword: boolean
  inviteTokenHash: string | null
  inviteExpiresAt: Date | null
}) {
  return {
    deactivated: p.deactivatedAt !== null,
    locked: p.lockedAt !== null,
    mustChangePassword: p.mustChangePassword,
    invited: p.inviteTokenHash !== null,
    inviteExpired: p.inviteExpiresAt !== null && p.inviteExpiresAt.getTime() < Date.now(),
  }
}

/** Preverba, da profil z e-pošto ne obstaja (uniqueness pred invite/email change). */
export async function emailTaken(email: string): Promise<boolean> {
  const row = await db.profile.findUnique({ where: { email }, select: { id: true } })
  return row !== null
}
