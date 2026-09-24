// Roksal — gesla in API ključi
// ---------------------------------------------------------------------------
// Samo Node runtime (`node:crypto`). Middleware tega NE sme uvažati — Edge
// runtime nima scrypta. Za seje glej `session.ts` (samo Web Crypto).
//
// Namerno brez `bcrypt`/`argon2` odvisnosti: scrypt je vgrajen v Node, je
// pomnilniško trd (memory-hard) in za 2–5 uporabnikov več kot zadostuje.

import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { db } from '@/lib/db'
import { checkRate, resetRateLimit } from './rate-limit'
import {
  DEFAULT_API_KEY_RATE_LIMIT_PER_MIN,
  parseApiKeyProjectScope,
  parseApiKeyScopes,
  type ApiKeyScope,
} from './api-keys'

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>

/** N=16384 (2^14), r=8, p=1 → ~16 MB, ~50–100 ms. Priporočilo OWASP za scrypt. */
const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEYLEN = 64
const SALT_BYTES = 16

const PREFIX = 'scrypt'

/** `scrypt$N$r$p$salt$hash` — parametri so v shranjeni vrednosti, da jih lahko kdaj dvignemo. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const derived = await scrypt(password.normalize('NFKC'), salt, KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })
  return [PREFIX, SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString('base64'), derived.toString('base64')].join('$')
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== PREFIX) return false
  const [, nStr, rStr, pStr, saltB64, hashB64] = parts
  const N = Number(nStr)
  const r = Number(rStr)
  const p = Number(pStr)
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false

  let salt: Buffer
  let expected: Buffer
  try {
    salt = Buffer.from(saltB64, 'base64')
    expected = Buffer.from(hashB64, 'base64')
  } catch {
    return false
  }
  if (expected.length === 0) return false

  let derived: Buffer
  try {
    derived = await scrypt(password.normalize('NFKC'), salt, expected.length, { N, r, p })
  } catch {
    return false
  }
  // Konstantni čas — `===` na stringih bi razkril dolžino in prefix ujemanja.
  return derived.length === expected.length && timingSafeEqual(derived, expected)
}

// ── API ključi (mobilni klient: BalkonAR) ─────────────────────────────────────
//
// Prejšnja "avtentikacija" za /api/sync je bila
//   key.startsWith('ROKSAL_MOBILE_') && key.length >= 20
// kar pomeni, da je bil vsak, ki je poznal obliko (ta je bila v javnem repu),
// pooblaščen za pisanje v bazo. Zdaj: naključen ključ, v bazi samo njegov
// SHA-256, in možnost preklica posameznega ključa.

const API_KEY_PREFIX = 'rkm_'

export interface CreatedApiKey {
  /** Poln ključ — viden SAMO ob ustvarjanju, nato se hrani samo hash. */
  key: string
  id: string
  name: string
}

export interface ApiKeyInput {
  name: string
  /** Namenska raba (issue #5 §3). */
  purpose?: string | null
  /** Scope lista; null = privzeti nabor MOBILE_SYNC. */
  scopes?: ApiKeyScope[] | null
  /** Omejitev na projekte (ID-ji); null = vsi. */
  projectScope?: string[] | null
  /** Kdaj ključ poteče; null = ne poteče. */
  expiresAt?: Date | null
  /** Per-key omejitev (zahtevkov/min). */
  rateLimitPerMin?: number | null
  /** ID predhodnika pri rotaciji. */
  rotatedFrom?: string | null
  createdBy?: string | null
}

/**
 * Ustvari ključ: `rkm_<32 naključnih bajtov v base64url>`.
 * R126 (issue #5 §3): nosi purpose, scopes, projektni obseg, potek, per-key
 * omejitev in (opcijsko) povezavo s predhodnikom pri rotaciji.
 */
export async function createApiKey(input: ApiKeyInput | string, createdBy?: string): Promise<CreatedApiKey> {
  const data: ApiKeyInput = typeof input === 'string' ? { name: input, createdBy } : input
  const secret = randomBytes(32).toString('base64url')
  const key = `${API_KEY_PREFIX}${secret}`
  const row = await db.apiKey.create({
    data: {
      name: data.name,
      purpose: data.purpose ?? null,
      scopes: (data.scopes ?? null) ? data.scopes!.join(',') : undefined,
      projectScope: data.projectScope?.length ? data.projectScope.join(',') : null,
      expiresAt: data.expiresAt ?? null,
      rateLimitPerMin: data.rateLimitPerMin ?? null,
      rotatedFrom: data.rotatedFrom ?? null,
      keyHash: hashApiKey(key),
      keyPrefix: key.slice(0, 12),
      createdBy: data.createdBy ?? null,
    },
  })
  return { key, id: row.id, name: row.name }
}

export function hashApiKey(key: string): string {
  return createHmac('sha256', apiKeyPepper()).update(key).digest('hex')
}

/** Zakaj je preverba ključa spodletela (R126 §3 — za audit). */
export type ApiKeyFailureReason = 'unknown' | 'revoked' | 'expired' | 'rate_limited'

export type ApiKeyVerificationResult =
  | {
      ok: true
      id: string
      name: string
      scopes: ApiKeyScope[]
      projectScope: string[] | null
    }
  | { ok: false; reason: ApiKeyFailureReason }

/**
 * Preveri ključ proti bazi (R126 — issue #5 §3).
 *
 * Zavrže (fail-closed, z razlogom za audit):
 *   • unknown      — ključ ne obstaja,
 *   • revoked      — `revokedAt` je nastavljen,
 *   • expired      — `expiresAt` je v preteklosti,
 *   • rate_limited — ključ je čez svoj per-key proračun (privzeto 120/min).
 *
 * Ob uspehu osveži `lastUsedAt` — neblokirajoče, napaka ne sme podreti zahteve.
 */
export async function verifyApiKey(key: string | null | undefined): Promise<ApiKeyVerificationResult> {
  if (!key) return { ok: false, reason: 'unknown' }
  const candidate = hashApiKey(key)
  const row = await db.apiKey.findUnique({ where: { keyHash: candidate } })
  if (!row) return { ok: false, reason: 'unknown' }
  if (row.revokedAt) return { ok: false, reason: 'revoked' }
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: 'expired' }
  }

  // Per-key rate limit (R126 §3): vsak preverjen zahtevek šteje — ključ z
  // 60/min ne sme povzročiti 10.000 sync klicev na minuto.
  const limit = row.rateLimitPerMin ?? DEFAULT_API_KEY_RATE_LIMIT_PER_MIN
  const budget = checkRate(`apikey:${row.id}`, { limit, windowMs: 60_000 })
  if (!budget.ok) return { ok: false, reason: 'rate_limited' }

  void db.apiKey
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined)
  return {
    ok: true,
    id: row.id,
    name: row.name,
    scopes: parseApiKeyScopes(row.scopes),
    projectScope: parseApiKeyProjectScope(row.projectScope),
  }
}

/**
 * Rotacija ključa (R126 — issue #5 §3): nov ključ z ISTIMI pravicami
 * (name/purpose/scopes/projectScope/expiry/rate limit), predhodnik se prekliče.
 * Vrne novi poln ključ — viden samo tokrat.
 */
export async function rotateApiKey(
  oldId: string,
  options: { expiresAt?: Date | null } = {}
): Promise<CreatedApiKey | null> {
  const old = await db.apiKey.findUnique({ where: { id: oldId } })
  if (!old) return null
  const created = await createApiKey({
    name: old.name,
    purpose: old.purpose,
    scopes: parseApiKeyScopes(old.scopes),
    projectScope: parseApiKeyProjectScope(old.projectScope),
    expiresAt: options.expiresAt !== undefined ? options.expiresAt : old.expiresAt,
    rateLimitPerMin: old.rateLimitPerMin,
    rotatedFrom: old.id,
    createdBy: old.createdBy,
  })
  await db.apiKey.update({ where: { id: oldId }, data: { revokedAt: new Date() } })
  return created
}

/** Poniži omejevalnik za dani ključ (testi / odpuščanje po incidentu). */
export function resetApiKeyRateLimit(apiKeyId?: string): void {
  resetRateLimit(apiKeyId ? `apikey:${apiKeyId}` : undefined)
}

/**
 * Sol za hashe API ključev.
 *
 * Ključi so visoko-entropijski (256 bitov), zato je hash brez soli varen pred
 * mavričnimi tabelami; sol iz `API_KEY_PEPPER` pa pomeni, da razkritje baze
 * samo po sebi ne omogoči ponarejanja ključev, dokler je pepper v okolju.
 * Če pepper ni nastavljen, uporabimo fiksno vrednost — ključi ostanejo
 * neuganljivi, izgubi se le dodatna plast.
 */
function apiKeyPepper(): string {
  return process.env.API_KEY_PEPPER ?? 'roksal-api-key-pepper-set-me-in-production'
}
