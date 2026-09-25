// Roksal — varnost javne samomeritve (R133, issue #5 §8)
// ---------------------------------------------------------------------------
// Prej je /api/public/measure (in stran /m/[token]) uporabljala Project.
// clientToken — ISTI žeton kot portal stranke — brez preverbe poteka/revokacije
// (tudi po R132 je žeton za meritve ostal večen), z lastnim in-memory
// limiterjem (resetira se ob restartu, ni deljen z drugo površino), brez
// idempotence (retry stranke = dvojnik), brez zaščite pred duplikati in brez
// audit sledi.
//
// Ta modul je ENOTEN vir resnice za obe javni merilni površini:
//   • server komponenta /m/[token] (merilna stran stranke);
//   • JSON ruti GET/POST /api/public/measure.
// Upravljanje (enable/disable/regenerate/revoke) je v /api/portal (seja).
//
// §8 pogodba:
//   • scoped token      — LOČEN measureToken, ne clientToken;
//   • expiry/revoke     — measureValidity (REVOKED > DISABLED > EXPIRED > OK);
//   • shared rate limit — skupni checkRate žebrki (IP + žeton);
//   • idempotency       — Idempotency-Key prek R128 infrastrukture
//                         (principal 'public:measure');
//   • duplicate         — determinističen dedupeHash, okno 30 min;
//   • anti-abuse        — omejitve velikosti/točk + limiterji + dnevnik;
//   • ownership         — Measurement.createdBy = 'public:measure' (jasen
//                         izvor, ločen od terenskih meritev uporabnikov);
//   • omejene mutacije  — JAVNA površina ustvari SAMO meritev (nič drugega);
//   • audit             — vsak poskus (uspeh/zavrnitev) v AuditLog z
//                         hashiranim IP (surov IP se NE shranjuje).

import { createHash } from 'node:crypto'
import { db } from '@/lib/db'
import {
  MIN_TOKEN_LENGTH,
  clientIpOf,
  clientIpOfHeaders,
  generateSecureToken,
  hashIp,
  portalExpiryFromDays,
} from '@/lib/portal'

export {
  MIN_TOKEN_LENGTH,
  clientIpOf,
  clientIpOfHeaders,
  generateSecureToken as generateMeasureToken,
  hashIp,
  portalExpiryFromDays as measureExpiryFromDays,
}

/** Privzeti življenjski vek merilne povezave ob enable/regenerate (§8: expiry). */
export const DEFAULT_MEASURE_EXPIRY_DAYS = 90
/** Strop za ročno nastavljen potek (1 leto) — napaka v UI ne ustvari večnega žetona. */
export const MAX_MEASURE_EXPIRY_DAYS = 365

/**
 * §8: shared rate limit — iste žebrke upravlja src/lib/rate-limit.ts (kot
 * prijava in portal), tako da so vsa javna vrata pod enakim nadzorom.
 *   • GET  (odpiranje stranke): 30 / 10 min na IP — velikodušno za ljudi;
 *   • POST (oddaja meritve): 6 / h na žeton (posamezna povezava) IN
 *     10 / h na IP (razpršene napade čez več žetonov).
 */
export const MEASURE_GET_LIMIT = { limit: 30, windowMs: 10 * 60 * 1000 }
export const MEASURE_SUBMIT_LIMIT_TOKEN = { limit: 6, windowMs: 60 * 60 * 1000 }
export const MEASURE_SUBMIT_LIMIT_IP = { limit: 10, windowMs: 60 * 60 * 1000 }

/** Duplicate protection: identična pošiljanja v tem oknu vrnejo obstoječo meritev. */
export const MEASURE_DEDUPE_WINDOW_MS = 30 * 60 * 1000

/** Strop surove velikosti telesa (§8 anti-abuse; prej le v komentarju). */
export const MEASURE_MAX_BODY_BYTES = 8192

/** Ownership marker (Measurement.createdBy) — jasen, determinističen izvor. */
export const PUBLIC_MEASURE_OWNER = 'public:measure'

/** Principal za IdempotencyKey.profileId — javni kontekst, brez seje. */
export const PUBLIC_MEASURE_PRINCIPAL = 'public:measure'

/** Stanja merilne povezave — vsa ne-OK javno preslikajo v ISTO 404 (enumeration). */
export type MeasureAccessStatus =
  | 'OK'
  | 'NOT_FOUND'
  | 'DISABLED'
  | 'EXPIRED'
  | 'REVOKED'
  | 'INVALID'

/** Referenca polj žetona, ki jih veljavnost bere (subset Project). */
export interface MeasureTokenState {
  measureEnabled: boolean
  measureTokenExpiresAt: Date | null
  measureTokenRevokedAt: Date | null
}

/**
 * Življenjski cikl merilnega žetona (§8: expiry/revoke). Vrstni red je
 * pomemben: revokacija pomeni, da je žeton MRTAV ne glede na potek;
 * onemogočena povezava pa samo začasno ne sprejema meritev.
 */
export function measureValidity(
  state: MeasureTokenState,
  now: Date = new Date(),
): Exclude<MeasureAccessStatus, 'OK' | 'NOT_FOUND' | 'INVALID'> | 'OK' {
  if (state.measureTokenRevokedAt) return 'REVOKED'
  if (!state.measureEnabled) return 'DISABLED'
  if (state.measureTokenExpiresAt && state.measureTokenExpiresAt.getTime() < now.getTime())
    return 'EXPIRED'
  return 'OK'
}

/**
 * Enotna preverba žetona za obe površini (stran + API): najde projekt po
 * measureToken in vrne { project, status }. Vsa ne-OK stanja klicatelj
 * preslika v ISTO javno 404 — tu se razlikujejo SAMO v dnevniku.
 */
export async function resolveMeasureToken(
  token: string,
  now: Date = new Date(),
): Promise<
  | { status: 'OK'; project: { id: string; nazivProjekta: string; customer: { ime: string } | null } }
  | { status: Exclude<MeasureAccessStatus, 'OK'>; project: null }
> {
  if (!token || token.length < MIN_TOKEN_LENGTH) return { status: 'INVALID', project: null }
  const project = await db.project.findUnique({
    where: { measureToken: token },
    select: {
      id: true,
      nazivProjekta: true,
      measureEnabled: true,
      measureTokenExpiresAt: true,
      measureTokenRevokedAt: true,
      customer: { select: { ime: true } },
    },
  })
  if (!project) return { status: 'NOT_FOUND', project: null }
  const validity = measureValidity(project, now)
  if (validity !== 'OK') return { status: validity, project: null }
  return {
    status: 'OK',
    project: {
      id: project.id,
      nazivProjekta: project.nazivProjekta,
      customer: project.customer ?? null,
    },
  }
}

/**
 * §8 audit: vsak poskus (uspešen ALI zavrnjen) gre v AuditLog.
 * Zasebnost: ipAddress = sha256(IP + pepper) — surovega IP-ja NE hranimo
 * (isti dogovor kot PortalAccess v R132). Napaka dnevnika se NE taji —
 * javi se klicatelju (vzdržljiv dnevnik, naučen v R132).
 */
export async function logMeasureEvent(entry: {
  projectId: string | null
  akcija: 'MEASURE_VIEW' | 'MEASURE_SUBMIT' | 'MEASURE_DUPLICATE' | 'MEASURE_REJECTED'
  ipHash: string
  userAgent: string | null
  podrobnosti?: string
}): Promise<void> {
  await db.auditLog.create({
    data: {
      userId: null, // javni dogodek brez uporabnika (null = sistemski, FK varen)
      projectId: entry.projectId,
      akcija: entry.akcija,
      newValue: entry.podrobnosti ?? null,
      ipAddress: entry.ipHash,
      userAgent: entry.userAgent?.slice(0, 255) ?? null,
    },
  })
}

/**
 * §8 duplicate protection: deterministični hash oddane meritve.
 * Kanonični niz = projectId + točke (zaokrožene na 6 decimalk, v oddanem
 * vrstnem redu — risanje po karti je pomenljivo) + skupajM (1 decimalna) +
 * visinaMm. Pepper vključen, da hash ni prenosljiv izven sistema.
 */
export function measureDedupeHash(
  projectId: string,
  points: Array<[number, number]>,
  skupajM: number,
  visinaMm: number,
): string {
  const canonical = JSON.stringify({
    projectId,
    points: points.map(([lat, lng]) => [lat.toFixed(6), lng.toFixed(6)]),
    skupajM: skupajM.toFixed(1),
    visinaMm,
  })
  const pepper = process.env.API_KEY_PEPPER ?? 'roksal-local-pepper'
  return createHash('sha256').update(`${canonical}:${pepper}`).digest('hex').slice(0, 32)
}
