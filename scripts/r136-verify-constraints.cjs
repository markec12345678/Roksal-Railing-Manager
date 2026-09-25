/* R136 — verifikacija §18 omejitev po migraciji. */
const { Client } = require('pg')

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  const con = await client.query(`
    SELECT conname, contype, convalidated
    FROM pg_constraint
    WHERE conrelid::regclass::text IN ('"Invoice"','"Inventory"','"MaterialOrderItem"','"MaterialOrder"','"MaterialUsage"','"MaterialPrice"','"PortalAccess"')
      AND conname NOT LIKE '%_pkey' AND conname NOT LIKE '%_key' AND conname NOT LIKE '%_fkey' OR conrelid::regclass::text = '"PortalAccess"'
    ORDER BY conname
  `)
  console.log('CONSTRAINTS:')
  for (const r of con.rows) console.log(`  ${r.conname} [${r.contype}] validated=${r.convalidated}`)

  const idx = await client.query(`
    SELECT indexname FROM pg_indexes
    WHERE indexname IN ('AuditLog_projectId_timestamp_idx','AuditLog_akcija_timestamp_idx','Invoice_projectId_status_idx')
    ORDER BY 1
  `)
  console.log('INDEXES:', idx.rows.map((r) => r.indexname))

  const ext = await client.query(`SELECT extname FROM pg_extension WHERE extname='btree_gist'`)
  console.log('btree_gist:', ext.rows.length > 0 ? 'installed' : 'MISSING')

  const mig = await client.query(`SELECT migration_name, finished_at IS NOT NULL AS done FROM _prisma_migrations ORDER BY migration_name DESC LIMIT 3`)
  console.log('MIGRATIONS:', mig.rows)

  await client.end()
}
main().catch((e) => { console.error(e.message); process.exit(1) })
