// Roksal — varnost portala stranke (R132, issue #5 §7)
// ---------------------------------------------------------------------------
// Prej je bil clientToken TRAJNI javni ključ: veljal je večno, brez revokacije,
// brez dostopnega dnevnika in brez omejitve hitrosti; generiran z Math.random()
// (ni kriptografsko varen vir). Kdorkoli z URL-jem je imel viden dostop za
// vedno — izgubljen/posredovan URL ni bilo mogoče umiriti.
//
// Ta modul je ENOTEN vir resnice za obe javni površini:
//   • server komponenta /portal/[token] (HTML stran stranke);
//   • JSON ruto /api/portal/[token] (testi, prihodnji klienti).
// Upravljanje (enable/disable/regenerate/revoke) je v /api/portal (seja).

import { createHash, randomBytes } from 'node:crypto'
import { db } from '@/lib/db'

/** Privzeti življenjski vek žetona ob enable/regenerate (§7: expiry). */
export const DEFAULT_PORTAL_EXPIRY_DAYS = 90
/** Strop za ročno nastavljen potek (1 leto) — napake v UI ne ustvarijo večnih žetonov. */
export const MAX_PORTAL_EXPIRY_DAYS = 365
/** Minimalna dolžina žetona, ki jo sploh poskusimo razčleniti (hitra zavrnitev). */
export const MIN_TOKEN_LENGTH = 8

/**
 * §7: shared rate limit za JAVNO portal površino (stran + JSON) na IP.
 * Stranka in napadalec delita isti vzvratni števec — enumeration/brute-force
 * na žetone je praktično onemogočen (60 obiskov / 10 min je za človeka
 * velikodušno; za skripto je stena).
 */
export const PORTAL_LIMIT = { limit: 60, windowMs: 10 * 60 * 1000 }

/** Stanja dostopa — javne površine vsa ne-OK preslikajo v ISTO 404 (enumeration protection). */
export type PortalAccessStatus = 'OK' | 'NOT_FOUND' | 'DISABLED' | 'EXPIRED' | 'REVOKED' | 'RATE_LIMITED' | 'INVALID'

/**
 * Kriptografsko varen žeton (§7): 18 bajtov entropije → 24 znakov base64url.
 * Prej: `Date.now().toString(36) + Math.random()` — napovedljivo.
 */
export function generatePortalToken(): string {
  return randomBytes(18).toString('base64url')
}

/** Izračun datum poteka iz števila dni (clamped 1..365). */
export function portalExpiryFromDays(days: number, from: Date = new Date()): Date {
  const n = Number.isFinite(days) ? Math.floor(days) : DEFAULT_PORTAL_EXPIRY_DAYS
  const clamped = Math.min(MAX_PORTAL_EXPIRY_DAYS, Math.max(1, n))
  return new Date(from.getTime() + clamped * 24 * 60 * 60 * 1000)
}

/**
 * Ip obiskovalca iz proxy glav (Vercel/Render postavita x-forwarded-for).
 * Prvi vnos je pravi klient; manjkajoče glave → 'unknown' (vseeno se hashira).
 * Primeren za Request (API rute) in headers() (server komponente).
 */
function ipFromGetter(get: (name: string) => string | null): string {
  const fwd = get('x-forwarded-for')
  if (fwd) {
    const first = fwd.split(',')[0]?.trim()
    if (first) return first
  }
  return get('x-real-ip')?.trim() || 'unknown'
}

/** IP iz standardnega Request objekta (API rute). */
export function clientIpOf(request: Request): string {
  return ipFromGetter((name) => request.headers.get(name))
}

/** IP iz next/headers() glav (server komponente). */
export function clientIpOfHeaders(hdrs: { get(name: string): string | null }): string {
  return ipFromGetter((name) => hdrs.get(name))
}

/**
 * Zasebnost (§38 duh): surovega IP-ja NE hranimo — samo sha256(IP + pepper),
 * 32 hex znakov. Pepper je isti kot za API ključe (produkcija MORA nastaviti
 * API_KEY_PEPPER; lokalno/testno se uporabi znana vrednost).
 */
export function hashIp(ip: string): string {
  const pepper = process.env.API_KEY_PEPPER ?? 'roksal-local-pepper'
  return createHash('sha256').update(`${ip}:${pepper}`).digest('hex').slice(0, 32)
}

/** Referenca polj žetona, ki jih veljavnost bere (subset Project). */
export interface PortalTokenState {
  clientPortalEnabled: boolean
  clientTokenExpiresAt: Date | null
  clientTokenRevokedAt: Date | null
}

/**
 * Življenjski cikl žetona (§7): expiry, revoke, onemogočen portal.
 * Vrstni red je pomemben: revokacija pomeni, da je žeton MRTAV ne glede na
 * potek; onemogočen portal pa samo začasno skrije stran (žeton ostane).
 */
export function portalValidity(state: PortalTokenState, now: Date = new Date()): Exclude<PortalAccessStatus, 'OK' | 'NOT_FOUND' | 'RATE_LIMITED' | 'INVALID'> | 'OK' {
  if (state.clientTokenRevokedAt) return 'REVOKED'
  if (!state.clientPortalEnabled) return 'DISABLED'
  if (state.clientTokenExpiresAt && state.clientTokenExpiresAt.getTime() < now.getTime()) return 'EXPIRED'
  return 'OK'
}

/**
 * Dostopni dnevnik (§7: access log) — vsak poskus, uspešen ali ne.
 * Best-effort: napaka dnevnika NE poruši stranke stranki, a je VIDNA v logu
 * (ni tihe degradacije — zapis manjka, opozorilo ostane).
 */
export async function logPortalAccess(entry: {
  projectId: string | null
  status: PortalAccessStatus
  ipHash: string
  userAgent: string | null
}): Promise<void> {
  try {
    await db.portalAccess.create({
      data: {
        projectId: entry.projectId,
        status: entry.status,
        ipHash: entry.ipHash,
        userAgent: entry.userAgent?.slice(0, 255) ?? null,
      },
    })
  } catch (error) {
    console.error('[portal] dostopni dnevnik NI zapisan:', error)
  }
}
