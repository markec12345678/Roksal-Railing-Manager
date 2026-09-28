// R252 — DB seed/restore + bajtni prstni odtis za E2E (lokalni dev DB, port 5433).
// UPORABA:
//   node scripts/r252-db-e2e.cjs seed      — nastavi POTEKEL opomnika (fiksni datumi) na
//                                            'Janez Novak' + 'Maja Zupan'; ORIGINALI v /tmp/r252-crm-original.json
//   node scripts/r252-db-e2e.cjs restore   — zapiše ORIGINALNE vrednosti nazaj (bajtnato, vključno z NULL)
//   node scripts/r252-db-e2e.cjs fp        — bajtni prstni odtis (JSON) — pre==post MORA biti IDENTIČEN
// Prstni odtis = R251 števci + polna Customer opomnik resnica (VSE stranke).
// RAW SQL (NE Prisma) — updatedAt se NE premakne, restore = bajtnata identičnost.
const { Client } = require('pg')

const c = new Client({
  host: 'localhost',
  port: 5433,
  user: 'roksal',
  password: 'roksal',
  database: 'roksal_dev',
})

// Fiksni ciljni stranki (deterministični po imenu) + fiksna POTEKEL datuma
// (v preteklosti glede na celotno E2E okno — bulk sort: najstarejši prvi).
const CILJI = ['Janez Novak', 'Maja Zupan']
const ORIGINAL = '/tmp/r252-crm-original.json'

const SEED = {
  'Janez Novak': { datum: '2026-09-20T09:00:00.000Z', opis: 'E2E R252 pregled balkona' }, // najstarejši
  'Maja Zupan': { datum: '2026-09-26T09:00:00.000Z', opis: 'E2E R252 dobava ograje' }, // mlajši
}

async function main() {
  await c.connect()
  const mode = process.argv[2] || 'fp'

  if (mode === 'seed') {
    const orig = await c.query(
      `SELECT ime, "opomnikDatum", "opomnikOpis" FROM "Customer" WHERE ime = ANY($1)`,
      [CILJI],
    )
    if (orig.rows.length !== CILJI.length) {
      throw new Error(`seed: pričakovani ${CILJI.length} stranki, najdenih ${orig.rows.length}`)
    }
    require('fs').writeFileSync(ORIGINAL, JSON.stringify(orig.rows))
    for (const ime of CILJI) {
      await c.query(
        `UPDATE "Customer" SET "opomnikDatum" = $2, "opomnikOpis" = $3 WHERE ime = $1`,
        [ime, SEED[ime].datum, SEED[ime].opis],
      )
    }
    console.log(JSON.stringify({ seeded: true, stranke: CILJI, originali: orig.rows }))
  } else if (mode === 'restore') {
    const origi = JSON.parse(require('fs').readFileSync(ORIGINAL, 'utf8'))
    for (const o of origi) {
      await c.query(
        `UPDATE "Customer" SET "opomnikDatum" = $2, "opomnikOpis" = $3 WHERE ime = $1`,
        [o.ime, o['opomnikDatum'], o['opomnikOpis']],
      )
    }
    console.log(JSON.stringify({ restored: true, originali: origi }))
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
  console.error('R252 DB FAIL:', e.message)
  process.exit(1)
})
