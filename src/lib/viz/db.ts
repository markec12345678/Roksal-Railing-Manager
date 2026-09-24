/**
 * VIZ — Prisma client z cache-bustom (runda S+2).
 *
 * PROBLEM: `bun run dev` teče od starta sandboxa, `prisma db push` (S2-b) pa je
 * regeneriral `@prisma/client` KASNEJE. Ker je Next.js @prisma/client
 * externaliziran (nloaded prek Node `require`, ne prek bundlarja), ima tekoči
 * dev strežnik v require cache-u ŠE STARO generirano kodo — `db.vizProject`
 * ne obstaja, čeprav so tabele v bazi in so tipi na disku sveži. Strežnika ne
 * smemo restartati.
 *
 * REŠITEV: iz zvitka ključev cache-a izbrišemo samo GENERIRANE datoteke
 * (.prisma/client/{default,client,index}.js — poti se spreminjajo z vsakim
 * `prisma generate`) in jih ponovno naložimo z absolutne poti. Star primer
 * PrismaClienta (`db` iz '@/lib/db') ostane funkcionalen za ostale rute —
 * imamo dva klienta na isti SQLite datoteki, kar SQLite brez težav prenese
 * (viz rute pišejo izključno v viz tabele).
 *
 * Po restartu dev strežnika je cache svež — ta loader deluje enako (no-op bust).
 * Types prihajajo iz '@prisma/client' (index.d.ts na disku — vedno svež za tsc).
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import type { PrismaClient } from '@prisma/client'
// S+9: statični import čistega modula (brez stranskih učinkov) — ne sme
// pasti skozi krhki dinamični import @/lib/db (glej zgodovino S+2).
// S+8.2: prehodni SQLite /tmp demo odstranjen — vir je izključno PostgreSQL.
import { resolveDatabaseUrl } from '@/lib/db-url'

const projectRequire = createRequire(path.join(process.cwd(), 'package.json'))

const GENERATED_DIR = path.join(process.cwd(), 'node_modules', '.prisma', 'client')
const GENERATED_FILES = ['default.js', 'client.js', 'index.js'] as const

type PrismaClientOptions = {
  log?: Array<'query' | 'error' | 'warn' | 'info' | 'event'>
  /** S+9: razrešen URL (postgresql produkcija/dev). */
  datasourceUrl?: string
}

type PrismaClientCtor = new (options?: PrismaClientOptions) => PrismaClient

/** Naloži SVEŽ generiran PrismaClient konstruktor (bust require cache-a). */
function loadFreshPrismaClientCtor(): PrismaClientCtor {
  for (const file of GENERATED_FILES) {
    const p = path.join(GENERATED_DIR, file)
    try {
      // resolve() po absolutni poti obide "exports" mapo paketa .prisma/client.
      delete projectRequire.cache[projectRequire.resolve(p)]
    } catch {
      // datoteka (še) ne obstaja — poskusimo brez busta
    }
  }
  const mod = projectRequire(path.join(GENERATED_DIR, 'default.js')) as {
    PrismaClient: PrismaClientCtor
  }
  return mod.PrismaClient
}

const globalForVizDb = globalThis as unknown as { vizPrisma?: PrismaClient }

/** Prisma client za viz rute (VizProject, VizRenderJob) — lenobno ustvarjen (async zaradi dinamičnega importa). */
export async function getVizDb(): Promise<PrismaClient> {
  if (!globalForVizDb.vizPrisma) {
    const PrismaClient = loadFreshPrismaClientCtor()
    const resolvedUrl = resolveDatabaseUrl()
    const ctorOptions: PrismaClientOptions = { log: ['error'] }
    if (resolvedUrl) {
      // Peskovnikov file: env senči .env — vsili razrešen URL
      // (postgresql produkcija/dev; glej src/lib/db-url.ts).
      ctorOptions.datasourceUrl = resolvedUrl
    }
    globalForVizDb.vizPrisma = new PrismaClient(ctorOptions)
  }
  return globalForVizDb.vizPrisma
}
