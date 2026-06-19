import { PrismaClient } from '@prisma/client'

// Prisma client. V dev načinu ga cached-amo na globalThis, da preprečimo
// odpiranje preveč povezav ob hot-reloadih. Ker ob spremembi sheme Prisma
// regenerira engine binary, moramo v tem primeru ustvariti nov client.
// `SCHEMA_VERSION` ročno dvignemo ob vsaki spremembi prisma/schema.prisma.
const SCHEMA_VERSION = 'v2-portal-2026-06-18'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __prismaSchemaVersion?: string
}

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
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
  globalForPrisma.__prismaSchemaVersion = SCHEMA_VERSION
}

console.log('[db] initialized, schema=', SCHEMA_VERSION, 'cached=', globalForPrisma.prisma === db)