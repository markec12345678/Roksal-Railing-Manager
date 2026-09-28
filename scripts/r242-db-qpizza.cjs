// R242 — branje lokalnega dev DB stanja (read-only) — vhodni prerez Osnutek PDF
const { Client } = require('pg')

async function main() {
  const c = new Client({
    host: 'localhost',
    port: 5433,
    user: 'roksal',
    password: 'roksal',
    database: 'roksal_dev',
  })
  await c.connect()
  const inv = await c.query(
    `SELECT "sifraMateriala", naziv, enota, "kolicinaZaloga" AS zaloga, "minimalnaZaloga" AS minz, id
     FROM "Inventory" WHERE "kolicinaZaloga" <= "minimalnaZaloga" ORDER BY "sifraMateriala"`,
  )
  console.log('--- POD MINIMUMOM (lokalni dev DB) ---')
  for (const r of inv.rows) {
    console.log(
      `${r.sifraMateriala} | ${r.naziv} | ${r.enota} | zaloga=${r.zaloga} | min=${r.minz} | naroči=${Math.max(r.minz - r.zaloga, r.minz)}`,
    )
  }
  const cnt = await c.query(
    `SELECT (SELECT COUNT(*) FROM "Inventory") AS inv,
            (SELECT COUNT(*) FROM "Inventory" WHERE "kolicinaZaloga" <= "minimalnaZaloga") AS pod,
            (SELECT COUNT(*) FROM "Inventory" WHERE "kolicinaZaloga" = "minimalnaZaloga") AS na,
            (SELECT COUNT(*) FROM "MaterialOrder") AS narocila,
            (SELECT COUNT(*) FROM "Supplier") AS dobavitelji,
            (SELECT COUNT(*) FROM "Project") AS projekti,
            (SELECT COUNT(*) FROM "Invoice") AS racuni`,
  )
  console.log('--- fingerprint ---')
  console.log(JSON.stringify(cnt.rows[0]))
  await c.end()
}

main().catch((e) => {
  console.error('DB FAIL:', e.message)
  process.exit(1)
})
