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

/** Ustvari ključ: `rkm_<32 naključnih bajtov v base64url>`. */
export async function createApiKey(name: string, createdBy?: string): Promise<CreatedApiKey> {
  const secret = randomBytes(32).toString('base64url')
  const key = `${API_KEY_PREFIX}${secret}`
  const row = await db.apiKey.create({
    data: {
      name,
      keyHash: hashApiKey(key),
      keyPrefix: key.slice(0, 12),
      createdBy: createdBy ?? null,
    },
  })
  return { key, id: row.id, name: row.name }
}

export function hashApiKey(key: string): string {
  return createHmac('sha256', apiKeyPepper()).update(key).digest('hex')
}

/**
 * Preveri ključ proti bazi. Vrže ime ključa (za dnevnik) ali null.
 * Ob uspehu osveži `lastUsedAt` — neblokirajoče, napaka ne sme podreti zahteve.
 */
export async function verifyApiKey(key: string | null | undefined): Promise<{ id: string; name: string } | null> {
  if (!key) return null
  const candidate = hashApiKey(key)
  const row = await db.apiKey.findFirst({ where: { keyHash: candidate, revokedAt: null } })
  if (!row) return null
  void db.apiKey
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined)
  return { id: row.id, name: row.name }
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
