// R251 — DB seed/restore + bajtni prstni odtis za E2E (lokalni dev DB, port 5433).
// UPORABA:
//   node scripts/r251-db-e2e.cjs seed      — nastavi opomnik (fiksna vrednost) na stranko 'Janez Novak';
//                                            ORIGINALNI vrednosti shrani v /tmp/r251-crm-original.json
//   node scripts/r251-db-e2e.cjs restore   — zapiše ORIGINALNI vrednosti nazaj (bajtnato, vključno z NULL)
//   node scripts/r251-db-e2e.cjs fp        — bajtni prstni odtis (JSON) — pre==post MORA biti IDENTIČEN
// Prstni odtis = R245 števci + polna Customer opomnik resnica (ime, opomnikDatum,
// opomnikOpis za VSE stranke) — seed/restore pa točno ENO stranko po imenu.
// RAW SQL (NE Prisma) — updatedAt se NE premakne, restore = bajtnata identičnost.
const { Client } = require('pg')

const c = new Client({
  host: 'localhost',
  port: 5433,
  user: 'roksal',
  password: 'roksal',
  database: 'roksal_dev',
})

// Fiksna ciljna stranka (deterministična po imenu — seeded dev DB) + fiksni opomnik.
const CILJ = 'Janez Novak'
const OPOMNIK_DATUM = '2026-10-02T09:00:00.000Z'
const OPOMNIK_OPIS = 'E2E R251 pregled ograje'
const ORIGINAL = '/tmp/r251-crm-original.json'

async function main() {
  await c.connect()
  const mode = process.argv[2] || 'fp'

  if (mode === 'seed') {
    const orig = await c.query(
      `SELECT "opomnikDatum", "opomnikOpis" FROM "Customer" WHERE ime = $1 LIMIT 1`,
      [CILJ],
    )
    if (orig.rows.length === 0) throw new Error(`seed: stranka '${CILJ}' ne obstaja`)
    require('fs').writeFileSync(ORIGINAL, JSON.stringify(orig.rows[0]))
    await c.query(
      `UPDATE "Customer" SET "opomnikDatum" = $2, "opomnikOpis" = $3 WHERE ime = $1`,
      [CILJ, OPOMNIK_DATUM, OPOMNIK_OPIS],
    )
    console.log(JSON.stringify({ seeded: true, stranka: CILJ, original: orig.rows[0] }))
  } else if (mode === 'restore') {
    const orig = JSON.parse(require('fs').readFileSync(ORIGINAL, 'utf8'))
    // Zapiši točno originalni vrednosti (tudi NULL) — bajtnata identičnost.
    await c.query(
      `UPDATE "Customer" SET "opomnikDatum" = $2, "opomnikOpis" = $3 WHERE ime = $1`,
      [CILJ, orig['opomnikDatum'], orig['opomnikOpis']],
    )
    console.log(JSON.stringify({ restored: true, original: orig }))
  } else if (mode === 'fp') {
    const cnt = await c.query(
      `SELECT (SELECT COUNT(*) FROM "Inventory") AS inv,
              (SELECT COUNT(*) FROM "Inventory" WHERE "kolicinaZaloga" <= "minimalnaZaloga") AS pod,
              (SELECT COUNT(*) FROM "Inventory" WHERE "kolicinaZaloga" = "minimalnaZaloga") AS na,
              (SELECT COUNT(*) FROM "MaterialOrder") AS narocila,
              (SELECT COUNT(*) FROM "Supplier") AS dobavitelji,
              (SELECT COUNT(*) FROM "MaterialPrice") AS cene,
              (SELECT COUNT(*) FROM "Project") AS projekti,
              (SELECT COUNT(*) FROM "Invoice") AS racuni,
              (SELECT COUNT(*) FROM "Customer") AS stranke`,
    )
    const stranke = await c.query(
      `SELECT ime, status, "opomnikDatum", "opomnikOpis" FROM "Customer" ORDER BY ime`,
    )
    const sup = await c.query(`SELECT * FROM "Supplier" ORDER BY id`)
    const cene = await c.query(`SELECT * FROM "MaterialPrice" ORDER BY id`)
    console.log(JSON.stringify({
      stevci: cnt.rows[0],
      strankeVrstice: stranke.rows,
      supplierVrstice: sup.rows,
      ceneVrstice: cene.rows,
    }))
  } else {
    throw new Error(`neznan način: ${mode}`)
  }
  await c.end()
}

main().catch((e) => {
  console.error('R251 DB FAIL:', e.message)
  process.exit(1)
})
