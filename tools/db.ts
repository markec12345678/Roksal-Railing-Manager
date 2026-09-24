/**
 * S+9 (issue #4, korak 1) — Prisma CLI wrapper, ki vsili razrešen DATABASE_URL.
 *
 * Peskovnik vbrizga star file: URL kot procesni env, ki senči .env (glej
 * src/lib/db-url.ts). Ta wrapper pokliče `prisma <args>` z USKLJENIM env, tako
 * da `bun run db:deploy` itd. vedno zadene pravo bazo.
 *
 * Uki:
 *   bun tools/db.ts migrate deploy   → prisma migrate deploy
 *   bun tools/db.ts db push          → prisma db push
 *   bun tools/db.ts seed             → node prisma/seed.cjs
 *   bun tools/db.ts format|validate  → prisma ...
 * */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

function readEnvFileDatabaseUrl(): string | null {
  const envPath = path.join(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return null
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?\s*$/)
    if (m) return m[1]
  }
  return null
}

function resolveUrl(): string | null {
  const fromEnv = process.env.DATABASE_URL ?? null
  if (fromEnv && /^postgres(ql)?:\/\//.test(fromEnv)) return fromEnv
  const fromDotEnv = readEnvFileDatabaseUrl()
  if (fromDotEnv && /^postgres(ql)?:\/\//.test(fromDotEnv)) return fromDotEnv
  // S+8.2: prehodni sqlite demo ne obstaja več — file: env NE upoštevamo
  // (kanonična shema je PostgreSQL; fail closed, glej src/lib/db-url.ts).
  return null
}

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('Uporaba: bun tools/db.ts <prisma-args|seed>')
  process.exit(2)
}

const url = resolveUrl()
if (!url) {
  console.error('[db] DATABASE_URL ni razrešen — nastavi .env ali env.')
  process.exit(1)
}

const [cmd, ...rest] = args
// Lokalni prisma entry direktno — `bunx prisma <sub>` v wrapperju zaradi
// bunx arg-parsinga poskuša namestiti napačen paket (cli-deploy).
const prismaEntry = require.resolve('prisma/build/index.js')
const command = cmd === 'seed' ? 'node' : process.execPath
// Vsi argumenti gredo prisma CLI-ju (npr. "migrate deploy" = dva argumenta).
const argv = cmd === 'seed'
  ? ['prisma/seed.cjs']
  : [prismaEntry, ...args]

console.log(
  `[db] ${cmd === 'seed' ? 'node prisma/seed.cjs' : 'prisma ' + rest.join(' ')}` +
  ` (DATABASE_URL=${url.replace(/:[^:@/]+@/, ':***@')})`
)
const res = spawnSync(command, argv, {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url },
  cwd: process.cwd(),
})
process.exit(res.status ?? 1)
