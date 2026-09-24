/**
 * R121 — PRODUKCIJSKI RESTORE DRILL (issue #7, točka 5)
 * ---------------------------------------------------------------------------
 * "Backup, ki ga nikoli ne obnoviš, NI backup." Ta orodje DOKAŽE, da je
 * backup uporaben: logični dump (JSONL) → sveža baza → Prisma shema →
 * vrstive → preveritve (številci, unique indeks, sha256 artefaktov).
 *
 * Potek:
 *   1. DUMP    — prebere VSE tabele public sheme v kanoničnem vrstnem redu
 *                (PK order) in zapiše JSONL (vsaka vrstica = zapis).
 *   2. RESTORE — na PRAZNI ciljni bazi: `prisma db push` (shema), nato
 *                topološko urejen vnos vrstic (FK starši naprej).
 *   3. VERIFY  — številci vrstic po tabeli = vir; unique indeks
 *                Project.mobileProjectId OBSTAJA na cilju; za ProjectPhoto
                vrstice z sha256 preveri, da artefakt v object storage
 *                obstaja in da lokalni bajti dajo ISTI SHA-256.
 *
 * Varnost:
 *   • cilj MORA biti prazen (public brez tabel) — nikoli ne piše v vir;
 *   • NE dotakne se OgrajaVizija (viz ključi so izven obsega baze);
 *   • PostgreSQL-only, fail-closed (neveljaven URL = napaka).
 *
 * Zagon (lokalni drill):
 *   psql ni na voljo v peskovniku — bazo ustvari orodje prek pg modula:
 *   bun tools/restore-drill.ts --target postgresql://roksal:roksal@localhost:5433/roksal_restore
 *   bun tools/restore-drill.ts --target ... --create-db   # ustvari ciljno bazo
 *   bun tools/restore-drill.ts --target ... --drop        # pobriši cilj po drillu
 *
 * Neon (produkcija) — enak orodje z Neon URL kot cilj:
 *   bun tools/restore-drill.ts --target "$NEON_RESTORE_URL" --create-db
 *   (Neon branch restore: naredi branch iz backup točke, nastavi URL,
 *    drill preveri podatke, nato promotion v glavno bazo.)
 *
 * Ni AI, ni naključja.
 */
import { PrismaClient } from '@prisma/client'
import { Client } from 'pg'
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

// ── Argumenti ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
function argValue(flag: string): string | null {
  const idx = args.indexOf(flag)
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : null
}
const TARGET_URL = argValue('--target')
const CREATE_DB = args.includes('--create-db')
const DROP = args.includes('--drop')

/** Fail-closed razrešitev DATABASE_URL (isti vzorec kot tools/db.ts). */
function resolveDatabaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL ?? null
  if (fromEnv && /^postgres(ql)?:\/\//.test(fromEnv)) return fromEnv
  try {
    const envPath = path.join(process.cwd(), '.env')
    const envFile = readFileSync(envPath, 'utf8')
    for (const line of envFile.split('\n')) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?\s*$/)
      if (m && /^postgres(ql)?:\/\//.test(m[1])) return m[1]
    }
  } catch {
    // .env ne obstaja — pade na spodnjo napako
  }
  throw new Error('DATABASE_URL (postgresql://) ni razrešen — fail closed.')
}

const SOURCE_URL = resolveDatabaseUrl()
if (!TARGET_URL) {
  console.error('Uporaba: bun tools/restore-drill.ts --target postgresql://… [--create-db] [--drop]')
  process.exit(2)
}
if (!/^postgres(ql)?:\/\//.test(TARGET_URL)) {
  console.error('FAIL CLOSED: cilj ni PostgreSQL URL.')
  process.exit(2)
}

function pgClient(url: string): Client {
  return new Client({ connectionString: url })
}

function parseUrl(url: string): { host: string; port: number; user: string; password: string; database: string } {
  const u = new URL(url)
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.slice(1),
  }
}

/** Poišči seznam tabel (public) z topološkim vrstnim redom po FK odvisnostih. */
async function tableGraph(client: Client): Promise<string[]> {
  const tables = (
    await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
         AND table_name != '_prisma_migrations'
       ORDER BY table_name`
    )
  ).rows.map((r) => r.table_name)

  // pg_catalog je izroček natančen (information_schema.constraint_column_usage
  // meša referencirane in referencirajoče stolpce — cikli laži).
  const fkRows = (
    await client.query<{ from_table: string; to_table: string }>(
      `SELECT conrelid::regclass::text AS from_table, confrelid::regclass::text AS to_table
       FROM pg_constraint
       WHERE contype = 'f' AND connamespace = 'public'::regnamespace`
    )
  ).rows

  const deps = new Map<string, Set<string>>()
  for (const t of tables) deps.set(t, new Set())
  const normalize = (s: string) => s.replace(/^"|"$/g, '')
  for (const fk of fkRows) {
    const from = normalize(fk.from_table)
    const to = normalize(fk.to_table)
    if (deps.has(from) && deps.has(to) && from !== to) {
      deps.get(from)!.add(to)
    }
  }
  // Kahn topološko (starši najprej); samoreference izpuščene.
  // OBVEŠČENOST o ciklu: Profile↔Crew obstaja (oboji NULL-able) — zato vnos
  // poteka s DISABLE TRIGGER ALL (FK enforcement izklopljen med restore-om,
  // enako kot pg_dump --disable-triggers). Topološki vrstni red je zgolj
  // priročen (manj vijoličnih odvisnosti med INSERT-i), NE pogoj uspeha.
  const order: string[] = []
  const remaining = new Set(tables)
  while (remaining.size > 0) {
    const ready = [...remaining].filter((t) => [...deps.get(t)!].every((d) => !remaining.has(d)))
    if (ready.length === 0) {
      // FK cikel — pobrani ostanejo v abecednem vrstnem redu (triggers off).
      console.warn(`[restore] FK cikel (${[...remaining].join(', ')}) — vnos s DISABLE TRIGGER ALL`)
      for (const t of [...remaining].sort()) {
        order.push(t)
        remaining.delete(t)
      }
      break
    }
    for (const t of ready) {
      order.push(t)
      remaining.delete(t)
    }
  }
  return order
}

/** Primarni ključ tabele (za determinističen vrstni red dump-a). */
async function primaryKeyOf(client: Client, table: string): Promise<string | null> {
  const res = await client.query<{ column_name: string }>(
    `SELECT kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
     WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public' AND tc.table_name = $1
     LIMIT 1`,
    [table]
  )
  return res.rows[0]?.column_name ?? null
}

interface DumpRow {
  table: string
  row: Record<string, unknown>
}

function serializeValue(v: unknown): unknown {
  if (v instanceof Date) return { __type: 'date', value: v.toISOString() }
  if (Buffer.isBuffer(v)) return { __type: 'bytea', value: v.toString('base64') }
  if (typeof v === 'bigint') return { __type: 'bigint', value: v.toString() }
  return v
}

function deserializeValue(v: unknown): unknown {
  if (
    v &&
    typeof v === 'object' &&
    '__type' in v &&
    typeof (v as { __type: string }).__type === 'string'
  ) {
    const t = v as { __type: string; value: string }
    if (t.__type === 'date') return new Date(t.value)
    if (t.__type === 'bytea') return Buffer.from(t.value, 'base64')
    if (t.__type === 'bigint') return BigInt(t.value)
  }
  return v
}

async function main(): Promise<number> {
  console.log('=== R121 RESTORE DRILL ===')
  console.log(`vir:      ${parseUrl(SOURCE_URL).database}@${parseUrl(SOURCE_URL).host}:${parseUrl(SOURCE_URL).port}`)
  const targetParsed = parseUrl(TARGET_URL)
  console.log(`cilj:     ${targetParsed.database}@${targetParsed.host}:${targetParsed.port}`)

  // ── 0. Ciljna baza (opcijsko ustvari) ─────────────────────────────────────
  if (CREATE_DB) {
    const admin = pgClient(
      `postgresql://${encodeURIComponent(targetParsed.user)}:${encodeURIComponent(targetParsed.password)}@${targetParsed.host}:${targetParsed.port}/postgres`
    )
    await admin.connect()
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetParsed.database])
    if (exists.rows.length === 0) {
      await admin.query(`CREATE DATABASE "${targetParsed.database}"`)
      console.log(`[db] ustvarjena ciljna baza ${targetParsed.database}`)
    } else {
      console.log(`[db] ciljna baza ${targetParsed.database} že obstaja`)
    }
    await admin.end()
  }

  // ── 1. DUMP ───────────────────────────────────────────────────────────────
  const source = pgClient(SOURCE_URL)
  await source.connect()
  const tables = await tableGraph(source)
  console.log(`[dump] tabel: ${tables.length}`)

  const dumpDir = path.join(process.cwd(), 'backups')
  mkdirSync(dumpDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dumpFile = path.join(dumpDir, `restore-drill-${stamp}.jsonl`)
  const dumpLines: string[] = []
  const sourceCounts: Record<string, number> = {}

  for (const table of tables) {
    const pk = await primaryKeyOf(source, table)
    const orderSql = pk ? `ORDER BY "${pk}"` : ''
    const res = await source.query(`SELECT * FROM "${table}" ${orderSql}`)
    sourceCounts[table] = res.rows.length
    for (const row of res.rows as Record<string, unknown>[]) {
      const serialized = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, serializeValue(v)])
      )
      dumpLines.push(JSON.stringify({ table, row: serialized }))
    }
  }
  writeFileSync(dumpFile, dumpLines.join('\n') + '\n')
  console.log(`[dump] ${dumpLines.length} vrstic → ${path.relative(process.cwd(), dumpFile)} (${(readFileSync(dumpFile).length / 1024).toFixed(1)} KB)`)
  await source.end()

  // ── 2. CILJ: prazen? ──────────────────────────────────────────────────────
  const target = pgClient(TARGET_URL)
  await target.connect()
  const existing = await target.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  )
  if (existing.rows.length > 0) {
    console.error(`FAIL CLOSED: ciljna baza NI prazna (${existing.rows.length} tabel). Prekinitveno.`)
    await target.end()
    return 1
  }

  // Shema na cilju: prisma db push (prek podprocesa, ciljni URL kot env).
  console.log('[restore] prisma db push (shema) …')
  const { execFileSync } = await import('node:child_process')
  execFileSync('bunx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: TARGET_URL },
    stdio: 'pipe',
  })

  // Vnos vrstic v topološkem vrstnem redu z FK enforcementom izklopljenim
  // (DISABLE TRIGGER ALL — FK so implementirani kot triggerji; re-enable po
  // vnosu znova vključi vse, FK kršitve bi sicer padle na COMMIT validaciji).
  console.log('[restore] vnos vrstic …')
  const restoredTables = await tableGraph(target)
  const targetClient = target
  await targetClient.query('BEGIN')
  let restored = 0
  try {
    for (const table of restoredTables) {
      await targetClient.query(`ALTER TABLE "${table}" DISABLE TRIGGER ALL`)
    }
    for (const table of restoredTables) {
      const rows = dumpLines
        .map((l) => JSON.parse(l) as DumpRow)
        .filter((d) => d.table === table)
      for (const { row } of rows) {
        const cols = Object.keys(row)
        const values = cols.map((c) => deserializeValue(row[c]))
        const placeholders = cols.map((_, i) => `$${i + 1}`)
        await targetClient.query(
          `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')})`,
          values
        )
        restored++
      }
    }
    for (const table of restoredTables) {
      await targetClient.query(`ALTER TABLE "${table}" ENABLE TRIGGER ALL`)
    }
    await targetClient.query('COMMIT')
  } catch (e) {
    await targetClient.query('ROLLBACK')
    throw e
  }
  console.log(`[restore] ${restored} vrstic vnesenih`)

  // ── 3. VERIFY ─────────────────────────────────────────────────────────────
  console.log('[verify] številci vrstic …')
  let failures = 0
  for (const table of tables) {
    const count = (
      await target.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM "${table}"`)
    ).rows[0].n
    const ok = Number(count) === sourceCounts[table]
    if (!ok) failures++
    console.log(
      `  ${ok ? '✓' : '✗'} ${table}: vir ${sourceCounts[table]} / cilj ${count}`
    )
  }

  // Unique indeks mobileProjectId mora biti na cilju (R121).
  const uniqueIdx = await target.query(
    `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Project'
       AND indexdef ILIKE '%mobileProjectId%' AND indexdef ILIKE '%UNIQUE%'`
  )
  const uniqueOk = uniqueIdx.rows.length > 0
  if (!uniqueOk) failures++
  console.log(`  ${uniqueOk ? '✓' : '✗'} UNIQUE Project.mobileProjectId na cilju ${uniqueOk ? 'obstaja' : 'MANJKA'}`)

  // Sha256 spot check: ProjectPhoto z sha256 → lokalni artefakt mora obstajati
  // in imeti ISTI hash (object storage integriteta čez restore).
  const photosWithHash = (
    await target.query<{ id: string; storageKey: string; sha256: string }>(
      `SELECT id, "storageKey", "sha256" FROM "ProjectPhoto" WHERE "sha256" IS NOT NULL LIMIT 20`
    )
  ).rows
  let hashOk = 0
  let hashChecked = 0
  for (const p of photosWithHash) {
    const file = path.join(process.cwd(), '.storage', p.storageKey)
    if (!existsSync(file)) {
      console.log(`  ✗ artefakt manjka: ${p.storageKey}`)
      failures++
      continue
    }
    hashChecked++
    const actual = createHash('sha256').update(readFileSync(file)).digest('hex')
    if (actual === p.sha256) hashOk++
    else {
      console.log(`  ✗ hash razlikuje: ${p.storageKey}`)
      failures++
    }
  }
  if (hashChecked > 0) {
    console.log(`  ${hashOk === hashChecked ? '✓' : '✗'} SHA-256 artefaktov: ${hashOk}/${hashChecked} ujemanj (object storage ↔ DB metadata)`)
  }

  await target.end()

  // ── 4. Počisti (opcijsko) ─────────────────────────────────────────────────
  if (DROP) {
    const admin = pgClient(
      `postgresql://${encodeURIComponent(targetParsed.user)}:${encodeURIComponent(targetParsed.password)}@${targetParsed.host}:${targetParsed.port}/postgres`
    )
    await admin.connect()
    await admin.query(`DROP DATABASE IF EXISTS "${targetParsed.database}" WITH (FORCE)`)
    await admin.end()
    console.log(`[cleanup] ciljna baza ${targetParsed.database} pobrisana`)
    rmSync(dumpFile, { force: true })
  }

  console.log('=== Povzetek ===')
  if (failures === 0) {
    console.log('RESTORE DRILL USPEŠEN — backup je dokazano obnovljiv.')
    return 0
  }
  console.error(`RESTORE DRILL NEUSPEŠEN: ${failures} preverjanj je padlo.`)
  return 1
}

main()
  .then((code) => process.exit(code))
  .catch(async (e) => {
    console.error('Drill je padel:', e instanceof Error ? e.message : e)
    process.exit(1)
  })

// PrismaClient import je namenjen prihodnjim app-nivojskim preverjanjem;
// tu ga ne instanciramo (drill je na SQL nivoju).
void PrismaClient
