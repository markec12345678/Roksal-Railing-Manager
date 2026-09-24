import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { resolveDatabaseUrl, isSqliteUrl } from '@/lib/db-url'

// Prisma client. V dev načinu ga cached-amo na globalThis, da preprečimo
// odpiranje preveč povezav ob hot-reloadih. Ker ob spremembi sheme Prisma
// regenerira engine binary, moramo v tem primeru ustvariti nov client.
// `SCHEMA_VERSION` ročno dvignemo ob vsaki spremembi prisma/schema.prisma.
const SCHEMA_VERSION = 'v3-postgres-issue4-s9'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __prismaSchemaVersion?: string
}

// ── Vercel / serverless demo način ───────────────────────────────────────────
//
// Na Vercelu je `/var/task` samo-za-branje, SQLite pa za delovanje potrebuje
// pisavo (dnevnik, WAL, …). Zato ob hladnem startu prekopiramo bazo, ki jo je
// build vključil v bundle (glej `outputFileTracingIncludes` v next.config.ts),
// v zapisljiv `/tmp` in uporabimo kopijo. Posledica: pisanje deluje, a je
// kratkotrajno (per-lambda instanca) — za trajne podatke uporabi Turso ali
// Postgres (glej README → »Deploy na Vercel«).
/**
 * Vrni serverless (Vercel) URL kopije baze v /tmp ali null izven serverlessa.
 * Izvoženo tudi za viz klienta (src/lib/viz/db.ts) — isti /tmp prototip.
 */
export function resolveServerlessDatabaseUrl(): string | null {
  // ISSUE #4: prehodni SQLite demo način — velja IZKLJUČNO, ko je razrešen
  // URL `file:*` in tečemo na Vercelu. PostgreSQL pot (produkcija) te poti
  // ne uporablja nikoli (docs/POSTGRES-MIGRATION.md).
  const base = resolveDatabaseUrl()
  if (!base || !isSqliteUrl(base)) return null // PostgreSQL pot ali brez URL-a
  const onVercel = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV)
  if (!onVercel) return null

  const bundledCandidates = [
    path.join(process.cwd(), 'db', 'custom.db'),
    path.join(process.cwd(), '..', 'db', 'custom.db'),
  ]
  const bundled = bundledCandidates.find((p) => {
    try {
      return fs.existsSync(p)
    } catch {
      return false
    }
  })
  const writable = '/tmp/roksal-demo.db'
  try {
    if (!fs.existsSync(writable)) {
      if (!bundled) return null // ni vgrajene baze — naj Prisma sama javi napako
      fs.copyFileSync(bundled, writable)
      console.log('[db] serverless: kopirana demo baza →', writable)
    }
    return `file:${writable}`
  } catch (e) {
    console.error('[db] serverless: kopiranje baze ni uspelo:', e)
    return null
  }
}

const serverlessUrl = resolveServerlessDatabaseUrl()
const resolvedUrl = resolveDatabaseUrl()
if (!resolvedUrl) {
  throw new Error(
    '[db] DATABASE_URL ni razrešen — nastavi postgres:// URL v .env ali env.'
  )
}
console.log(
  '[db] vir:',
  serverlessUrl
    ? 'sqlite /tmp demo (PREHODNO)'
    : isSqliteUrl(resolvedUrl)
      ? 'sqlite (PREHODNI demo)'
      : 'postgresql (produkcija)'
)

if (
  process.env.NODE_ENV !== 'production' &&
  globalForPrisma.prisma &&
  globalForPrisma.__prismaSchemaVersion !== SCHEMA_VERSION
) {
  // Shema se je spremenila — zapri stari client in ustvari novega.
  console.log('[db] schema changed, recreating PrismaClient', {
    old: globalForPrisma.__prismaSchemaVersion,
    new: SCHEMA_VERSION,
  })
  try {
    void globalForPrisma.prisma.$disconnect()
  } catch {
    // ignore
  }
  globalForPrisma.prisma = undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
    datasourceUrl: serverlessUrl ?? resolvedUrl,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
  globalForPrisma.__prismaSchemaVersion = SCHEMA_VERSION
}

console.log('[db] initialized, schema=', SCHEMA_VERSION, 'cached=', globalForPrisma.prisma === db)
