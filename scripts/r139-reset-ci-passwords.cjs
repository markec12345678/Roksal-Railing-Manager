// Nastavi znano geslo ci@ računom v LOKALNI dev bazi (roksal_dev) za dimni test.
// NE produkcija. Geslo: DimniSmoke139!
// Format je točen po src/lib/password.ts: `scrypt$N$r$p$salt_b64$derived_b64`
// (brez pepperja — verifyPassword uporablja samo timingSafeEqual na derived).
const { PrismaClient } = require('@prisma/client')
const { scrypt, randomBytes } = require('node:crypto')
const { promisify } = require('node:util')
const scryptAsync = promisify(scrypt)

const N = 16384
const R = 8
const P = 1
const KEYLEN = 64
const SALT_BYTES = 16

async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES)
  const derived = await scryptAsync(password.normalize('NFKC'), salt, KEYLEN, { N, r: R, p: P })
  return [PREFIX, N, R, P, salt.toString('base64'), derived.toString('base64')].join('$')
}

const PREFIX = 'scrypt'

async function main() {
  const db = new PrismaClient({
    datasources: { db: { url: 'postgresql://roksal:roksal@localhost:5433/roksal_dev' } },
  })
  const hash = await hashPassword('DimniSmoke139!')
  for (const email of ['ci@roksal.si', 'monter.ci@roksal.si']) {
    await db.profile.update({ where: { email }, data: { passwordHash: hash } })
  }
  console.log('passwords reset for ci@ + monter.ci@ (dev only)')
  await db.$disconnect()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
