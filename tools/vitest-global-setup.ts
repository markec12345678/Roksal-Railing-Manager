/**
 * S+9 (issue #4, korak 1) — Vitest global setup: zagotovi PostgreSQL testno bazo.
 *
 * 1. Če embedded PG (:5433) ne teče, ga zaženi (brez root, binaries iz npm).
 * 2. Nad roksal_test zaženi `prisma migrate deploy` — testi zato tudi
 *    regresijsko varujejo verigo migracij (issue #4: reproducible migrations).
 *
 * Testna baza se NE čisti — testi si sami upravljajo svoje podatke (unikatni
 * sifra/email z naključno pripono), saj so suite-i vzporedni.
 * */
import net from 'node:net'
import { execSync, spawn } from 'node:child_process'
import path from 'node:path'

const PORT = 5433
const TEST_DB_URL = 'postgresql://roksal:roksal@localhost:5433/roksal_test'
const DATA_DIR = path.join(process.cwd(), '.pgdata')

function portOpen(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host })
    socket.once('connect', () => { socket.end(); resolve(true) })
    socket.once('error', () => resolve(false))
    socket.setTimeout(1500, () => { socket.destroy(); resolve(false) })
  })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default async function setup() {
  const running = await portOpen(PORT)
  if (!running) {
    console.log('[vitest-setup] zaganjam embedded PostgreSQL :%d …', PORT)
    const child = spawn('bun', ['tools/pg.ts', 'start'], {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
      env: process.env,
    })
    child.unref()
    let up = false
    for (let i = 0; i < 60; i++) {
      await sleep(500)
      if (await portOpen(PORT)) { up = true; break }
    }
    if (!up) throw new Error('[vitest-setup] PostgreSQL se ni zagnal v 30 s')
    // Po startu pusti 1 s, da se `createDatabase` zaključi
    await sleep(1500)
  }

  execSync('bunx prisma migrate deploy', {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
  })
  console.log('[vitest-setup] roksal_test pripravljen:', TEST_DB_URL)
}
