/**
 * S+9 (issue #4, korak 1) — Kanonično razreševanje DATABASE_URL.
 *
 * PROBLEM: peskovnik/platforma vbrizga star `DATABASE_URL=file:…` kot procesni
 * env, ki senči `.env` (Next.js in bun NE prepišejo obstoječih env spremenljivk).
 *
 * PRAVILO razreševanja (dokumentirano v docs/POSTGRES-MIGRATION.md):
 *  1. `process.env.DATABASE_URL`, če je `postgres(ql)://*` → uporabi
 *     (Vercel/Neon produkcija, testi, eksplicitna preglasitev).
 *  2. sicer `.env` iz projekta, če vsebuje `postgres(ql)://*` → uporabi
 *     (lokalni dev v peskovniku — vbrizgan file: env se ignorira).
 *  3. sicer `null` — klicatelj naj faila JASNO.
 *
 * ZAKAJ NE vrne file:* URL-a (S+8.2 čiščenje prehodne poti): prehodni SQLite
 * demo način je ODSTRANJEN (produkcija teče na Neon PostgreSQL od b23424a).
 * Kanonična shema je PostgreSQL; file: URL bi ustvaril Prisma klienta z
 * napačnim datasource-om in padel s skrivnostno napako — zato fail closed
 * z jasnim sporočilom pri klicatelju (src/lib/db.ts).
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
    // filesystem ni dosegljiv (edge?) — nadaljuj z null
  }
  cached = null
  return cached
}
