// R249 — obnova lokalnih E2E fixture računov (roksal_dev SAMO — NE produkcija).
// Sandbox rollback (R249 rundi) je povrnil DB na starejši posnetek, ki še ni
// imel ci@ računov. To so TRAJNI lokalni fixture (družina r139): ci@roksal.si
// = ADMIN, monter.ci@roksal.si = MONTER; geslo DimniSmoke139! (r139 vzorec:
// scrypt$N$r$p$salt_b64$derived_b64, brez pepperja).
const { PrismaClient } = require('@prisma/client')
const { scrypt, randomBytes } = require('node:crypto')
const { promisify } = require('node:util')
const scryptAsync = promisify(scrypt)

const N = 16384
const R = 8
const P = 1
const KEYLEN = 64
const SALT_BYTES = 16
const PREFIX = 'scrypt'

async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES)
  const derived = await scryptAsync(password.normalize('NFKC'), salt, KEYLEN, { N, r: R, p: P })
  return [PREFIX, N, R, P, salt.toString('base64'), derived.toString('base64')].join('$')
}

async function main() {
  const db = new PrismaClient({
    datasources: { db: { url: 'postgresql://roksal:roksal@localhost:5433/roksal_dev' } },
  })
  const hash = await hashPassword('DimniSmoke139!')
  const fixtures = [
    { email: 'ci@roksal.si', ime: 'CI Admin', vloga: 'ADMIN' },
    { email: 'monter.ci@roksal.si', ime: 'CI Monter', vloga: 'MONTER' },
  ]
  for (const f of fixtures) {
    await db.profile.upsert({
      where: { email: f.email },
      update: { passwordHash: hash, deactivatedAt: null, lockedAt: null, mustChangePassword: false },
      create: { ...f, passwordHash: hash },
    })
    console.log('fixture pripravljen:', f.email, f.vloga)
  }
  await db.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
