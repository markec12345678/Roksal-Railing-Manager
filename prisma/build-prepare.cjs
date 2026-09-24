/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS build skripta */
/**
 * S+9 (issue #4, korak 1) — Priprava baze ob gradnji.
 *
 * Izbiro vira poganja DATABASE_URL (Prisma provider je v kanonični shemi
 * `prisma/schema.prisma` PostgreSQL):
 *
 *   postgres://*  → `prisma generate` + `prisma migrate deploy` (+ seed, razen
 *                   ko je SEED_ON_DEPLOY=false). To je PRODUKCIJSKA pot:
 *                   verzionirane migracije, nobenega `db push`.
 *
 *   file:* / manjkajoč → PREHODNI demo način (trenutni Vercel deployment še
 *                   nima dodeljenega zunanjege PostgreSQL): iz kanonične sheme
 *                   se generira sqlite varianta (isti modeli, drug provider) in
 *                   se uporabi `db push` + demo seed. Ta pot je zabeležena kot
 *                   TEHNIČNI DOLG — odstrani se, takoj ko lastnik ustvari
 *                   Vercel Postgres/Neon bazo (docs/POSTGRES-MIGRATION.md).
 *
 * Postavka SQLite variante prinaša samo zamenjavo providerja — modeli/enums
 * so identični (Prisma 6 podpira enums na SQLite; obstoječa produkcijska
 * shema je to že dokazovala).
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
  // sicer procesni env kot je (prehodni sqlite demo).
  const envUrl = process.env.DATABASE_URL
  if (envUrl && /^postgres(ql)?:\/\//.test(envUrl)) return envUrl
  const fromDotEnv = readEnvFileDatabaseUrl()
  if (fromDotEnv && /^postgres(ql)?:\/\//.test(fromDotEnv)) return fromDotEnv
  return envUrl || fromDotEnv
}

function run(cmd, extraEnv = {}) {
  console.log(`[build-prepare] ${cmd}`)
  execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...extraEnv } })
}

const url = readEnvUrl()
const sqliteMode = !url || url.startsWith('file:')

if (sqliteMode) {
  console.warn(
    '[build-prepare] DATABASE_URL je file:* — PREHODNI SQLite demo način.\n' +
    '[build-prepare] Issue #4 zahteva zunanji PostgreSQL za produkcijo; glej docs/POSTGRES-MIGRATION.md.'
  )
  const canonical = fs.readFileSync(path.join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8')
  const sqliteSchema = canonical.replace(
    /provider\s*=\s*"postgresql"/,
    'provider = "sqlite"'
  )
  const buildSchemaPath = path.join(process.cwd(), 'prisma', 'schema.build.prisma')
  fs.writeFileSync(buildSchemaPath, sqliteSchema)
  run(`bunx prisma generate --schema ${buildSchemaPath}`)
  run(`bunx prisma db push --skip-generate --accept-data-loss --schema ${buildSchemaPath}`, { DATABASE_URL: url })
  run('node prisma/seed.cjs')
} else {
  run('bunx prisma generate')
  run('bunx prisma migrate deploy', { DATABASE_URL: url })
  if (process.env.SEED_ON_DEPLOY !== 'false') {
    run('node prisma/seed.cjs')
  } else {
    console.log('[build-prepare] SEED_ON_DEPLOY=false — seed preskočen.')
  }
}
