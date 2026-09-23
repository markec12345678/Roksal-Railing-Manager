import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

// Prisma client. V dev načinu ga cached-amo na globalThis, da preprečimo
// odpiranje preveč povezav ob hot-reloadih. Ker ob spremembi sheme Prisma
// regenerira engine binary, moramo v tem primeru ustvariti nov client.
// `SCHEMA_VERSION` ročno dvignemo ob vsaki spremembi prisma/schema.prisma.
const SCHEMA_VERSION = 'v2-portal-2026-09-r-survey-ral'

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
function resolveServerlessDatabaseUrl(): string | null {
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
    ...(serverlessUrl ? { datasources: { db: { url: serverlessUrl } } } : {}),
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
  globalForPrisma.__prismaSchemaVersion = SCHEMA_VERSION
}

console.log('[db] initialized, schema=', SCHEMA_VERSION, 'cached=', globalForPrisma.prisma === db)
