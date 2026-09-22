// Varnejši način za kopijo SQLite baze, ki je v uporabi.
// ---------------------------------------------------------------------------
// `cp db/custom.db /backup/` NI varen: SQLite lahko sredi kopiranja piše in
// dobiš poškodovano datoteko, ki je ne moreš odpreti — backup, ki ga nikoli ne
// preizkusiš, ni backup.
//
// `VACUUM INTO` naredi konsistentno kopijo preko SQLite samega, medtem ko
// aplikacija teče. Nepotreben je `sqlite3` CLI (na mnogih strežnikih ga ni),
// ker gre ukaz skozi Prisma.
//
// Uporaba:
//   bunx tsx tools/backup-db.ts                       # v ./backups/
//   bunx tsx tools/backup-db.ts /mnt/nas/roksal       # v izbrano mapo
//   KEEP=14 bunx tsx tools/backup-db.ts               # obdrži zadnjih 14 (privzeto 7)
//
// Priporočeno v cron:  15 3 * * * cd /opt/roksal && bunx tsx tools/backup-db.ts >> /var/log/roksal-backup.log 2>&1

import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

function timestamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

async function main() {
  const dir = resolve(process.argv[2] ?? './backups')
  const keep = Number(process.env.KEEP ?? 7)
  const file = join(dir, `roksal-${timestamp()}.db`)

  mkdirSync(dir, { recursive: true })

  // Če ciljna datoteka že obstaja, VACUUM INTO vrže napako — zato jo prej preverimo.
  if (existsSync(file)) {
    throw new Error(`Cilj že obstaja: ${file}`)
  }

  // SQLite zahteva enojne navednice in ne sme sprejeti parametrov, zato pot
  // sanitiziramo: dovolimo samo znake, ki so v datotečnem sistemu varni.
  const safe = file.replace(/'/g, "''")
  if (/[^A-Za-z0-9._\-/:]/.test(safe)) {
    throw new Error(`Pot vsebuje nepričakovane znake: ${file}`)
  }

  await db.$executeRawUnsafe(`VACUUM INTO '${safe}'`)

  const size = statSync(file).size
  console.log(`✓ Backup: ${file} (${(size / 1024 / 1024).toFixed(2)} MB)`)

  // Preveri, da je kopija berljiva — backup, ki ga ne moreš odpreti, ni backup.
  await db.$disconnect()
  const check = new PrismaClient({ datasources: { db: { url: `file:${file}` } } })
  try {
    const projects = await check.project.count()
    const customers = await check.customer.count()
    console.log(`✓ Preverjeno: kopija je berljiva (${projects} projektov, ${customers} strank)`)
  } finally {
    await check.$disconnect()
  }

  // Rotacija: obdrži zadnjih `keep`.
  const backups = readdirSync(dir)
    .filter((f) => f.startsWith('roksal-') && f.endsWith('.db'))
    .map((f) => ({ f, mtime: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
  for (const old of backups.slice(Math.max(0, keep))) {
    unlinkSync(join(dir, old.f))
    console.log(`  odstranjen star backup: ${old.f}`)
  }
}

main()
  .catch((e) => {
    console.error('✗ Backup ni uspel:', e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect().catch(() => undefined)
  })
