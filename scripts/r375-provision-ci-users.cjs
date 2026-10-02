#!/usr/bin/env node
/* r375-provision-ci-users.cjs — stale-klon okolje (R375): sveža .pgdata
 * nima QA računov ci@roksal.si (ADMIN) + monter.ci@roksal.si (MONTER) —
 * ustvari ju z DOKUMENTIRANIM geslom DimniSmoke139! (isti format gesla kot
 * r139-reset-ci-passwords.cjs: scrypt$N$r$p$salt_b64$derived_b64).
 * DEV ONLY — vstiči so zgolj QA infrastruktura (R139/R173 precedens:
 * "testni računi ci@/monter.ci@ samo v DEV bazi"). Idempotenten (upsert). */
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
  await db.profile.upsert({
    where: { email: 'ci@roksal.si' },
    update: { passwordHash: hash, vloga: 'ADMIN' },
    create: { email: 'ci@roksal.si', ime: 'CI Admin', vloga: 'ADMIN', passwordHash: hash, mustChangePassword: false },
  })
  await db.profile.upsert({
    where: { email: 'monter.ci@roksal.si' },
    update: { passwordHash: hash, vloga: 'MONTER' },
    create: { email: 'monter.ci@roksal.si', ime: 'CI Monter', vloga: 'MONTER', passwordHash: hash, mustChangePassword: false },
  })
  console.log('ci@ + monter.ci@ provisionirana (dev only, ADMIN/MONTER, DimniSmoke139!)')
  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
