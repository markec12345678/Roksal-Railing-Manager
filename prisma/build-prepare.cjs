/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS build skripta */
/**
 * S+9 (issue #4, korak 1) — Priprava baze ob gradnji.
 *
 * Edini vir je PostgreSQL (kanonična shema `prisma/schema.prisma`):
 *
 *   postgres://*  → `prisma generate` + `prisma migrate deploy` (+ seed, razen
 *                   ko je SEED_ON_DEPLOY=false). Verzionirane migracije,
 *                   nobenega `db push`.
 *
 * S+8.2 (čiščenje prehodne poti, docs/POSTGRES-MIGRATION.md korak 5): prehodni
 * SQLite demo način (generiranje `schema.build.prisma` + `db push` za file:*
 * URL) je ODSTRANJEN — produkcija teče na Neon PostgreSQL. Brez postgres://
 * URL-a gradnja JASNO FAILED (brez tihe sqlite zasilne poti).
 * */
const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

function readEnvFileDatabaseUrl() {
  const envPath = path.join(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return null
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?/)
    if (m) return m[1]
  }
  return null
}

function readEnvUrl() {
  // Pravilo (src/lib/db-url.ts): postgres env zmaga; sicer .env postgres;
  // sicer null (fail closed — sqlite zasilna pot ne obstaja več).
  const envUrl = process.env.DATABASE_URL
  if (envUrl && /^postgres(ql)?:\/\//.test(envUrl)) return envUrl
  const fromDotEnv = readEnvFileDatabaseUrl()
  if (fromDotEnv && /^postgres(ql)?:\/\//.test(fromDotEnv)) return fromDotEnv
  return null
}

function run(cmd, extraEnv = {}) {
  console.log(`[build-prepare] ${cmd}`)
  execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...extraEnv } })
}

const url = readEnvUrl()

if (!url) {
  console.error(
    '[build-prepare] DATABASE_URL ni razrešen na postgres:// URL.\n' +
    '[build-prepare] Prehodni SQLite način je odstranjen (S+8.2) — produkcija\n' +
    '[build-prepare] ZAHTEVA zunanji PostgreSQL. Glej docs/POSTGRES-MIGRATION.md.'
  )
  process.exit(1)
}

run('bunx prisma generate')
run('bunx prisma migrate deploy', { DATABASE_URL: url })
if (process.env.SEED_ON_DEPLOY !== 'false') {
  run('node prisma/seed.cjs')
} else {
  console.log('[build-prepare] SEED_ON_DEPLOY=false — seed preskočen.')
}
