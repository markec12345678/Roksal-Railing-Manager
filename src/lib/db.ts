import { PrismaClient } from '@prisma/client'
import { resolveDatabaseUrl } from '@/lib/db-url'

// Prisma client. V dev načinu ga cached-amo na globalThis, da preprečimo
// odpiranje preveč povezav ob hot-reloadih. Ker ob spremembi sheme Prisma
// regenerira engine binary, moramo v tem primeru ustvariti nov client.
// `SCHEMA_VERSION` ročno dvignemo ob vsaki spremembi prisma/schema.prisma.
const SCHEMA_VERSION = 'v4-postgres-cleanup-s82'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __prismaSchemaVersion?: string
}

// ── Vir podatkov ─────────────────────────────────────────────────────────────
//
// S+8.2 (čiščenje prehodne poti, docs/POSTGRES-MIGRATION.md korak 5): prehodni
// SQLite demo način (bundled db/custom.db → /tmp kopija na Vercelu) je
// ODSTRANJEN. Produkcija teče na Neon PostgreSQL; edini vir je postgres:// URL
// (env ali .env). Brez njega ne moremo tiho nadaljevati — fail closed.

const resolvedUrl = resolveDatabaseUrl()
if (!resolvedUrl) {
  throw new Error(
    '[db] DATABASE_URL ni razrešen na postgres:// URL — nastavi env ali .env ' +
    '(glej docs/POSTGRES-MIGRATION.md). Prehodni SQLite način ne obstaja več.'
  )
}
console.log('[db] vir: postgresql (produkcija)')

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
    datasourceUrl: resolvedUrl,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
  globalForPrisma.__prismaSchemaVersion = SCHEMA_VERSION
}

console.log('[db] initialized, schema=', SCHEMA_VERSION, 'cached=', globalForPrisma.prisma === db)
