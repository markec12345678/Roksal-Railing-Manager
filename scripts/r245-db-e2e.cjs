// R245 — DB seed/restore + bajtni prstni odtis za E2E (lokalni dev DB, port 5433).
// UPORABA:
//   node scripts/r245-db-e2e.cjs seed      — vstavi 2 dobavitelja + 3 cene (idempotentno po nazivu)
//   node scripts/r245-db-e2e.cjs restore   — pobriše TOČNO vrstice z R245 id-ji (PK)
//   node scripts/r245-db-e2e.cjs fp        — bajtni prstni odtis (JSON) — pre==post MORA biti IDENTIČEN
// Prstni odtis = ŠTEVEC + polna vsebina tabel Supplier in MaterialPrice (byte-level JSON).
const { Client } = require('pg')

const c = new Client({
  host: 'localhost',
  port: 5433,
  user: 'roksal',
  password: 'roksal',
  database: 'roksal_dev',
})

// Fiksni PK-ji (deterministični id-ji so dovoljeni — cuid default, ne zahteva) —
// restore pobriše TOČNO te vrstice, nič drugega.
const SUP1 = 'r245e2esupplierA000000000'
const SUP2 = 'r245e2esupplierB000000000'

async function main() {
  await c.connect()
  const mode = process.argv[2] || 'fp'

  if (mode === 'seed') {
    // 2 dobavitelja (aktivna) + 3 cene na prvih 2 inventarjema po šifri:
    //   material A @ SUP1 10.50, A @ SUP2 9.25 (SUP2 ZMAGA — najnižja),
    //   material B @ SUP1 3.80 → primerjalni: 2 vrstici (A: 9.25/2 ponudbi, B: 3.80/1 ponudba)
    const inv = await c.query(`SELECT id FROM "Inventory" ORDER BY "sifraMateriala" LIMIT 2`)
    if (inv.rows.length < 2) throw new Error('seed: pričakovana vsaj 2 inventarja')
    await c.query(
      `INSERT INTO "Supplier" (id, naziv, "dobavniRok", popust, aktivna, "createdAt", "updatedAt")
       VALUES ($1, 'E2E R245 Dobavitelj A', 7, 0, true, now(), now()), ($2, 'E2E R245 Dobavitelj B', 5, 0, true, now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [SUP1, SUP2],
    )
    await c.query(`DELETE FROM "MaterialPrice" WHERE id LIKE 'r245e2e%'`)
    await c.query(
      `INSERT INTO "MaterialPrice" (id, "inventoryId", "supplierId", cena, "veljavnostOd", opomba, "createdAt")
       VALUES
         ('r245e2eprice0000000000000001', $1, $3, 10.50, now(), 'E2E R245', now()),
         ('r245e2eprice0000000000000002', $1, $4, 9.25, now(), 'E2E R245', now()),
         ('r245e2eprice0000000000000003', $2, $3, 3.80, now(), 'E2E R245', now())`,
      [inv.rows[0].id, inv.rows[1].id, SUP1, SUP2],
    )
    console.log(JSON.stringify({ seeded: true, prices: 3, suppliers: 2 }))
  } else if (mode === 'restore') {
    await c.query(`DELETE FROM "MaterialPrice" WHERE id LIKE 'r245e2e%'`)
    await c.query(`DELETE FROM "Supplier" WHERE id IN ($1, $2)`, [SUP1, SUP2])
    console.log(JSON.stringify({ restored: true }))
  } else if (mode === 'fp') {
    const cnt = await c.query(
      `SELECT (SELECT COUNT(*) FROM "Inventory") AS inv,
              (SELECT COUNT(*) FROM "Inventory" WHERE "kolicinaZaloga" <= "minimalnaZaloga") AS pod,
              (SELECT COUNT(*) FROM "Inventory" WHERE "kolicinaZaloga" = "minimalnaZaloga") AS na,
              (SELECT COUNT(*) FROM "MaterialOrder") AS narocila,
              (SELECT COUNT(*) FROM "Supplier") AS dobavitelji,
              (SELECT COUNT(*) FROM "MaterialPrice") AS cene,
              (SELECT COUNT(*) FROM "Project") AS projekti,
              (SELECT COUNT(*) FROM "Invoice") AS racuni`,
    )
    const sup = await c.query(`SELECT * FROM "Supplier" ORDER BY id`)
    const cene = await c.query(`SELECT * FROM "MaterialPrice" ORDER BY id`)
    console.log(JSON.stringify({
      stevci: cnt.rows[0],
      supplierVrstice: sup.rows,
      ceneVrstice: cene.rows,
    }))
  } else {
    throw new Error(`neznan način: ${mode}`)
  }
  await c.end()
}

main().catch((e) => {
  console.error('R245 DB FAIL:', e.message)
  process.exit(1)
})
