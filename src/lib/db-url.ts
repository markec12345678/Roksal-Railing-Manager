/**
 * S+9 (issue #4, korak 1) — Kanonično razreševanje DATABASE_URL.
 *
 * PROBLEM: peskovnik/platforma vbrizga star `DATABASE_URL=file:…` kot procesni
 * env, ki senči `.env` (Next.js in bun NE prepišejo obstoječih env spremenljivk).
 * Po preklopu na PostgreSQL (provider je v prisma/schema.prisma) file: URL ne
 * velja več in Prisma klient pada.
 *
 * PRAVILO razreševanja (dokumentirano v docs/POSTGRES-MIGRATION.md):
 *  1. `process.env.DATABASE_URL`, če je `postgres(ql)://*` → uporabi (Vercel
 *     produkcija z zunanjo bazo, testi, eksplicitno preglasitev).
 *  2. sicer `.env` iz projekta, če vsebuje `postgres(ql)://*` → uporabi
 *     (lokalni dev v peskovniku).
 *  3. sicer vrni procesni env kot je (prehodni Vercel SQLite demo, ki ga je
 *     zgradil prisma/build-prepare.cjs v sqlite načinu).
 *  4. null, če nič — klicatelj naj faila jasno.
 * */
import fs from 'node:fs'
import path from 'node:path'

const PG_RE = /^postgres(ql)?:\/\//

let cached: string | null | undefined

export function resolveDatabaseUrl(): string | null {
  if (cached !== undefined) return cached
  const fromEnv = process.env.DATABASE_URL ?? null
  if (fromEnv && PG_RE.test(fromEnv)) {
    cached = fromEnv
    return cached
  }
  try {
    const envPath = path.join(process.cwd(), '.env')
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      for (const line of content.split('\n')) {
        const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?\s*$/)
        if (m && PG_RE.test(m[1])) {
          cached = m[1]
          return cached
        }
      }
    }
  } catch {
    // filesystem ni dosegljiv (edge?) — nadaljuj z env vrednostjo
  }
  cached = fromEnv
  return cached
}

/** Ali je razrešen URL SQLite (prehodni demo način)? */
export function isSqliteUrl(url: string | null): boolean {
  return !!url && url.startsWith('file:')
}
