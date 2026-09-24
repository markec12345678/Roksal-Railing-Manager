/**
 * S+9 (issue #4, korak 1) — Lokalni PostgreSQL brez root pravic.
 *
 * Uporabi `embedded-postgres` (uradni PostgreSQL 18 binaries prek npm, brez
 * postinstall downloada) za zagon lokalne instance v `.pgdata/`. Nadomesti
 * SQLite kot razvojni/testni vir (issue #4: "preiti na PostgreSQL").
 *
 * Uki:
 *   bun tools/pg.ts start   — zaženi instanco (idempotentno: če vrata odprta, pusti)
 *   bun tools/pg.ts stop    — ustavi instanco
 *   bun tools/pg.ts status  — izpiši stanje
 *
 * Bazi: roksal_dev (dev strežnik), roksal_test (vitest). Uporabnik roksal/roksal.
 * */
import EmbeddedPostgres from 'embedded-postgres'
import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'

const PORT = Number(process.env.PGPORT ?? 5433)
const DATA_DIR = path.join(process.cwd(), '.pgdata')
const PG_USER = 'roksal'

function portOpen(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host })
    socket.once('connect', () => { socket.end(); resolve(true) })
    socket.once('error', () => resolve(false))
    socket.setTimeout(1500, () => { socket.destroy(); resolve(false) })
  })
}

function ensureHydrated() {
  // Bun blokira postinstall skripte brez trustedDependencies (package.json jih
  // od S+9 vsebuje). Obramba v globino: če lib symlinks manjkajo, jih hidriraj
  // ročno — sicer initdb/postgres na sveži instalaciji ne najdejo knjižnic.
  const symlinkFile = path.join(process.cwd(), 'node_modules', '@embedded-postgres', 'linux-x64', 'native', 'pg-symlinks.json')
  const binPostgres = path.join(process.cwd(), 'node_modules', '@embedded-postgres', 'linux-x64', 'native', 'bin', 'postgres')
  try {
    if (fs.existsSync(symlinkFile) && fs.existsSync(binPostgres)) {
      const links = JSON.parse(fs.readFileSync(symlinkFile, 'utf8')) as Array<{ source: string; target: string }>
      const libDir = path.join(process.cwd(), 'node_modules', '@embedded-postgres', 'linux-x64')
      for (const { source, target } of links) {
        const t = path.join(libDir, target)
        if (!fs.existsSync(t)) {
          fs.symlinkSync(path.relative(path.dirname(t), path.join(libDir, source)), t)
        }
      }
    }
  } catch (e) {
    console.warn('[pg] symlink hidracija ni uspela (nadaljujem):', e)
  }
}

async function main() {
  const cmd = process.argv[2] ?? 'status'
  ensureHydrated()
  const running = await portOpen(PORT)

  if (cmd === 'status') {
    console.log(running ? `PG RUNNING :${PORT}` : `PG STOPPED :${PORT}`)
    process.exit(0)
  }

  if (cmd === 'stop') {
    if (!running) { console.log('PG already stopped'); process.exit(0) }
    const pg = new EmbeddedPostgres({
      databaseDir: DATA_DIR, user: PG_USER, password: 'roksal', port: PORT, persistent: true,
    })
    await pg.stop()
    console.log('PG stopped')
    process.exit(0)
  }

  if (cmd === 'start') {
    if (running) { console.log(`PG already running :${PORT}`); process.exit(0) }
    const initialise = !fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'))
    const pg = new EmbeddedPostgres({
      databaseDir: DATA_DIR,
      user: PG_USER,
      password: 'roksal',
      port: PORT,
      persistent: true,
      onError: (msgOrErr: string | Error) => console.error('[pg]', msgOrErr),
    })
    if (initialise) await pg.initialise()
    await pg.start()
    // Ustvari obe bazi, če še ne obstajata (initialise ustvari samo 'roksal').
    for (const dbname of ['roksal_dev', 'roksal_test']) {
      try {
        await pg.createDatabase(dbname)
        console.log(`PG created database ${dbname}`)
      } catch {
        // že obstaja
      }
    }
    console.log(`PG RUNNING :${PORT} (data: ${DATA_DIR})`)
    // Ostani živ — uporabljen tudi kot dolgotrajen proces prek `bun tools/pg.ts start &`.
    setInterval(() => {}, 1 << 30)
    return
  }

  console.error('Unknown command:', cmd)
  process.exit(2)
}

main().catch((e) => { console.error(e); process.exit(1) })
