// Roksal — samostojen pomočnik za hash gesla (za seed skripte)
// ---------------------------------------------------------------------------
// Ločeno od src/lib/password.ts, ker ta uvaža `@/lib/db` (Prisma klient in
// TS path alias) — seed skripta ne sme imeti teh odvisnosti. Format je
// identičen: `scrypt$N$r$p$salt$hash`, NFKC normalizacija, 16-bajtna sol.

import { randomBytes, scrypt as scryptCb } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEYLEN = 64

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = await scrypt(password.normalize('NFKC'), salt, KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })
  return ['scrypt', SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString('base64'), derived.toString('base64')].join('$')
}
