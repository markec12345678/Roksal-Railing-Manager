// R260 — DB seed/restore + bajtni prstni odtis za E2E (lokalni dev DB, port 5433).
// UPORABA:
//   node scripts/r260-db-e2e.cjs seed      — vstavi 3 dobavitelje ('e2e-r260-sup1…3'):
//                                            sup1 Alu   rok 5  aktiven popust 0
//                                            sup2 Beton rok 12 aktiven popust 3
//                                            sup3 Cink  rok 7  neaktiven popust 0
//                                            → API default vrne SAMO AKTIVNE
//                                            (route: aktivne !== 'false') →
//                                            vidni seznam = 2 → pričakovani
//                                            toast agregat (WYSIWYG):
//                                            'Izvoženih 2 dobavitelja v PDF' +
//                                            'povprečni dobavni rok 8,5 dni,
//                                            najhitrejši 5 dni (E2E R260 Alu
//                                            Dobavitelj).'
//   node scripts/r260-db-e2e.cjs restore   — DELETE vseh 'e2e-r260-%' vrstic
//   node scripts/r260-db-e2e.cjs fp        — bajtni prstni odtis (JSON) — pre==post
//                                            MORA biti IDENTIČEN (ZERO-MUTACIJA)
// Prstni odtis = R258 števci + Supplier/MaterialOrder/MaterialOrderItem/… POLNA
// resnica (dobavitelje VSTAVLJAMO — so v odtisu).
// RAW SQL (NE Prisma) — updatedAt se NE premakne, restore = bajtnata identičnost.
// LEKCIJA R257: raw SQL INSERT rabi QUOTED camelCase stolpce.
const { Client } = require('pg')

const c = new Client({
  host: 'localhost',
  port: 5433,
  user: 'roksal',
  password: 'roksal',
  database: 'roksal_dev',
})

const ID_PREDPONA = 'e2e-r260-'

async function main() {
  await c.connect()
  const mode = process.argv[2] || 'fp'

  if (mode === 'seed') {
    // idempotentnost: starejši e2e-r260 ostanki IZBRANI pred vstavljanjem
    await c.query(`DELETE FROM "Supplier" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    // dev DB MORA biti brez tujih dobaviteljev (R258 restore je poskrbel) —
    // drugače bi bil toast agregat ne-determinističen → fail fast (ni tihe
    // degradacije).
    const tuji = await c.query(`SELECT COUNT(*)::int AS n FROM "Supplier" WHERE id NOT LIKE $1`, ['e2e-%'])
    if (tuji.rows[0].n !== 0) {
      throw new Error(`seed: dev DB vsebuje ${tuji.rows[0].n} tujih dobaviteljev — E2E agregat bi bil ne-determinističen`)
    }
    const dobavitelji = [
      { id: `${ID_PREDPONA}sup1`, naziv: 'E2E R260 Alu Dobavitelj', rok: 5, popust: 0, aktivna: true },
      { id: `${ID_PREDPONA}sup2`, naziv: 'E2E R260 Beton Dobavitelj', rok: 12, popust: 3, aktivna: true },
      { id: `${ID_PREDPONA}sup3`, naziv: 'E2E R260 Cink Dobavitelj', rok: 7, popust: 0, aktivna: false },
    ]
    for (const s of dobavitelji) {
      await c.query(
        `INSERT INTO "Supplier"
           (id, naziv, kontakt, email, telefon, "dobavniRok", popust, aktivna, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [s.id, s.naziv, 'E2E Kontakt', 'e2e-r260@roksal.si', '+386 4 000 000', s.rok, s.popust, s.aktivna],
      )
    }
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "Supplier" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ seeded: true, dobaviteljev: n.rows[0].n }))
  } else if (mode === 'restore') {
    await c.query(`DELETE FROM "MaterialPrice" WHERE "supplierId" LIKE $1`, [`${ID_PREDPONA}%`])
    await c.query(`DELETE FROM "MaterialOrder" WHERE "supplierId" LIKE $1`, [`${ID_PREDPONA}%`])
    await c.query(`DELETE FROM "Supplier" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const s = await c.query(`SELECT COUNT(*)::int AS n FROM "Supplier" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ restored: true, ostankovDobaviteljev: s.rows[0].n }))
  } else if (mode === 'fp') {
    const cnt = await c.query(
      `SELECT (SELECT COUNT(*) FROM "Inventory") AS inv,
              (SELECT COUNT(*) FROM "MaterialOrder") AS narocila,
              (SELECT COUNT(*) FROM "MaterialOrderItem") AS postavke,
              (SELECT COUNT(*) FROM "Supplier") AS dobavitelji,
              (SELECT COUNT(*) FROM "MaterialPrice") AS cene,
              (SELECT COUNT(*) FROM "Project") AS projekti,
              (SELECT COUNT(*) FROM "Invoice") AS racuni,
              (SELECT COUNT(*) FROM "Customer") AS stranke,
              (SELECT COUNT(*) FROM "InstallationSchedule") AS termini`,
    )
    const narocila = await c.query(
      `SELECT id, "projectId", "supplierId", status, "skupajCena", "datumNarocila", "datumDobave", opombe, "createdAt", "updatedAt"
         FROM "MaterialOrder" ORDER BY id`,
    )
    const postavke = await c.query(
      `SELECT id, "orderId", "inventoryId", kolicina, cena, naziv, enota, "createdAt"
         FROM "MaterialOrderItem" ORDER BY id`,
    )
    const sup = await c.query(`SELECT * FROM "Supplier" ORDER BY id`)
    const cene = await c.query(`SELECT * FROM "MaterialPrice" ORDER BY id`)
    const stranke = await c.query(
      `SELECT ime, status, "opomnikDatum", "opomnikOpis" FROM "Customer" ORDER BY ime`,
    )
    const racuni = await c.query(
      `SELECT id, "stevilka", status, znesek, "datumIzdaje", "placanoAt" FROM "Invoice" ORDER BY id`,
    )
    console.log(JSON.stringify({
      stevci: cnt.rows[0],
      narocilaVrstice: narocila.rows,
      postavkeVrstice: postavke.rows,
      supplierVrstice: sup.rows,
      ceneVrstice: cene.rows,
      strankeVrstice: stranke.rows,
      racuniVrstice: racuni.rows,
    }))
  } else {
    throw new Error(`neznan način: ${mode}`)
  }
  await c.end()
}

main().catch((e) => {
  console.error('R260 DB FAIL:', e.message)
  process.exit(1)
})
