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

const projectRequire = createRequire(path.join(process.cwd(), 'package.json'))

const GENERATED_DIR = path.join(process.cwd(), 'node_modules', '.prisma', 'client')
const GENERATED_FILES = ['default.js', 'client.js', 'index.js'] as const

type PrismaClientCtor = new (options?: {
  log?: Array<'query' | 'error' | 'warn' | 'info' | 'event'>
}) => PrismaClient

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
    // Na Vercelu je filesystem bralen — uporabi ISTO /tmp kopijo baze kot
    // glavni klient (src/lib/db.ts resolveServerlessDatabaseUrl). Brez tega bi
    // viz rute pisale v bralno bundled datoteko (SQLite error 14).
    let serverlessUrl: string | null = null
    try {
      // Dinamični import (bundler razreši @/ alias); izpusti, če modul ni dosegljiv.
      const main = (await import('@/lib/db')) as { resolveServerlessDatabaseUrl?: () => string | null }
      serverlessUrl = main.resolveServerlessDatabaseUrl?.() ?? null
    } catch {
      serverlessUrl = null
    }
    globalForVizDb.vizPrisma = new PrismaClient({
      log: ['error'],
      ...(serverlessUrl ? { datasources: { db: { url: serverlessUrl } } } : {}),
    })
  }
  return globalForVizDb.vizPrisma
}
