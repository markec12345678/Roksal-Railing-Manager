/**
 * S+9 (issue #4, korak 1) — Enkratna migracija podatkov SQLite → PostgreSQL.
 *
 * Branje: `bun:sqlite` (readonly) nad db/custom.db.
 * Pisanje: Prisma klient (PostgreSQL provider) nad DATABASE_URL.
 * Ponovni zagon = ponoven restore (wipe + copy) — rezultat je vedno enak.
 *
 * Run:  bun tools/migrate-data-to-postgres.ts [sqlite-pot] [dev|test]
 * Default sqlite pot: db/custom.db
 *
 * SEMANTIKA RESTORE-NA-SVEŽI-BAZI (issue #4: "preveriti backup, restore in
 * recovery na sveži bazi"): pred kopiranjem počisti vse poslovne tabele v
 * obratnem FK vrstnem redu — ciljna baza je po zagonu bitna kopija SQLite
 * vira (+ OPENING ledger backfill). Številke, e-pošte in id-ji so 1:1.
 * */
import { Database } from 'bun:sqlite'
import { PrismaClient, Prisma } from '@prisma/client'
import path from 'node:path'

const SQLITE_PATH = process.argv[2] ?? path.join(process.cwd(), 'db', 'custom.db')
const TARGET_MODE = process.argv[3] ?? 'dev' // dev | test

const pg = new PrismaClient({
  datasourceUrl:
    TARGET_MODE === 'test'
      ? 'postgresql://roksal:roksal@localhost:5433/roksal_test'
      : process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')
        ? process.env.DATABASE_URL
        : 'postgresql://roksal:roksal@localhost:5433/roksal_dev',
})

const sqlite = new Database(SQLITE_PATH, { readonly: true })

// FK-varen vrstni red (krožna odvisnost Profile↔Crew rešena posebej).
const ORDER: string[] = [
  'Profile', 'Crew', 'Customer', 'Project', 'Measurement', 'Inventory',
  'MaterialUsage', 'InventoryMovement', 'StockLedger', 'Document', 'AuditLog',
  'Notification', 'Profil', 'ArSnapshot', 'Sketch', 'GalleryItem', 'Slope',
  'ProjectPhoto', 'SignatureAudit', 'Supplier', 'MaterialPrice',
  'MaterialOrder', 'MaterialOrderItem', 'Equipment', 'InstallationSchedule',
  'EquipmentAssignment', 'ApiKey', 'PunchItem', 'Invoice', 'SiteSurvey',
  'VizProject', 'VizRenderJob',
]

type FieldMeta = { name: string; type: string; kind: string; isList: boolean }

function fieldsOf(model: string): FieldMeta[] {
  const m = Prisma.dmmf.datamodel.models.find((mm) => mm.name === model)
  if (!m) throw new Error(`Model ${model} ni v DMMF`)
  return m.fields
    .filter((f) => f.kind !== 'object')
    .map((f) => ({ name: f.name, type: f.type, kind: f.kind, isList: f.isList }))
}

function coerce(meta: FieldMeta[], row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of meta) {
    let v = row[f.name]
    if (v === undefined) continue
    if (v === null) { out[f.name] = null; continue }
    if (f.type === 'Boolean' && typeof v === 'number') v = v !== 0
    if (f.type === 'DateTime') {
      // bun:sqlite vrne DATETIME bodisi kot epoch millis (number) bodisi kot string.
      if (typeof v === 'number') v = new Date(v)
      else if (typeof v === 'string') v = new Date(v)
    }
    out[f.name] = v
  }
  return out
}

type UpsertDelegate = {
  upsert: (args: Record<string, unknown>) => Promise<unknown>
}

type DeleteDelegate = {
  deleteMany: (args?: Record<string, never>) => Promise<unknown>
}

async function upsertAll(model: string, rows: Record<string, unknown>[], delegate: UpsertDelegate) {
  const meta = fieldsOf(model)
  let n = 0
  for (const row of rows) {
    const data = coerce(meta, row)
    const id = data.id as string
    if (!id) throw new Error(`${model}: vrstica brez id`)
    const { id: _omit, ...rest } = data
    await delegate.upsert({
      where: { id },
      create: { ...rest, id } as never,
      update: rest as never,
    })
    n++
  }
  return n
}

async function wipeAll() {
  for (const model of [...ORDER].reverse()) {
    const delegate = (pg as unknown as Record<string, DeleteDelegate>)[
      model.charAt(0).toLowerCase() + model.slice(1)
    ]
    if (!delegate) continue
    try {
      await delegate.deleteMany({})
    } catch {
      // model ne obstaja v tej shemi — preskoči
    }
  }
}

async function main() {
  const counts: Record<string, number> = {}
  await wipeAll()
  console.log('── Ciljna baza počiščena (restore na sveži bazi) ──')
  for (const model of ORDER) {
    let rows: Record<string, unknown>[]
    try {
      rows = sqlite.prepare(`SELECT * FROM "${model}"`).all() as Record<string, unknown>[]
    } catch {
      counts[model] = 0 // tabela v starem SQLite ne obstaja (npr. StockLedger)
      continue
    }
    if (rows.length === 0) { counts[model] = 0; continue }

    if (model === 'Profile') {
      // Krožna odvisnost: Profile.ekipaId → Crew, Crew.vodjaId → Profile.
      rows = rows.map((r) => ({ ...r, ekipaId: null }))
      counts[model] = await upsertAll(model, rows, pg.profile)
      const withCrew = sqlite.prepare(`SELECT * FROM "Profile"`).all() as Record<string, unknown>[]
      for (const r of withCrew) {
        if (r.ekipaId) await pg.profile.update({ where: { id: r.id as string }, data: { ekipaId: r.ekipaId as string } })
      }
      continue
    }
    const delegate = (pg as unknown as Record<string, UpsertDelegate>)[
      model.charAt(0).toLowerCase() + model.slice(1)
    ]
    if (!delegate) throw new Error(`Ni delegata za ${model}`)
    counts[model] = await upsertAll(model, rows, delegate)
  }

  // OPENING backfill (issue #4 §4): obstoječa zaloga postane izhodiščni dogodek.
  const inventories = await pg.inventory.findMany()
  let opening = 0
  for (const inv of inventories) {
    const existing = await pg.stockLedger.findFirst({
      where: { inventoryId: inv.id, eventType: 'OPENING' },
    })
    if (!existing && inv.kolicinaZaloga !== 0) {
      await pg.stockLedger.create({
        data: {
          inventoryId: inv.id,
          eventType: 'OPENING',
          kolicina: inv.kolicinaZaloga,
          enota: inv.enota,
          balanceAfter: inv.kolicinaZaloga,
          actorId: 'system',
          reason: 'Backfill obstoječe zaloge ob migraciji SQLite → PostgreSQL',
        },
      })
      opening++
    }
  }

  console.log('── Migracija končana ──')
  for (const [k, v] of Object.entries(counts)) if (v) console.log(`  ${k}: ${v}`)
  console.log(`  StockLedger OPENING backfill: ${opening}`)
  await pg.$disconnect()
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => sqlite.close())
