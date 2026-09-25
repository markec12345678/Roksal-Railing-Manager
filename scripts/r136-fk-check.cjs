/* R136 — pregled PortalAccess FK stanja (razlaga "AddForeignKey" drifta). */
const { Client } = require('pg')

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  const r = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = '"PortalAccess"'::regclass AND contype = 'f'
  `)
  console.log('PortalAccess FKs:', JSON.stringify(r.rows, null, 2))
  const idx = await client.query(`
    SELECT indexname FROM pg_indexes WHERE tablename = 'AuditLog' OR tablename = 'Invoice'
  `)
  console.log('Existing idx:', idx.rows.map((x) => x.indexname))
  await client.end()
}
main().catch((e) => { console.error(e.message); process.exit(1) })
