// R258 — DB seed/restore + bajtni prstni odtis za E2E (lokalni dev DB, port 5433).
// UPORABA:
//   node scripts/r258-db-e2e.cjs seed      — vstavi 1 dobavitelja + 3 naročila
//                                            ('e2e-r258-o1…o3') na projekt
//                                            'Terasa Zupan - WPC deske' (ISTI
//                                            projekt kot obstoječi račun
//                                            2026-TEST IZDAN 893.04):
//                                            o1 OSNUTEK 450.50, obljuba 3 dni
//                                              PREJ → ZAMUJEN žig (odprt),
//                                            o2 PREKlicANO 999.99 (iskren
//                                              odpad — IZKLJUČEN iz stroškov),
//                                            o3 POSLANO 700.00, projekt NULL
//                                              (brez projekta — IZKLJUČEN iz
//                                              preseka, poimenovan v sklepu).
//                                            Pričakovani toast agregat po seedu:
//                                            '1 projektov, prihodki 893.04 €,
//                                            stroški 450.50 €, marža 442.54 €.'
//   node scripts/r258-db-e2e.cjs restore   — DELETE vseh 'e2e-r258-%' vrstic
//   node scripts/r258-db-e2e.cjs fp        — bajtni prstni odtis (JSON) — pre==post
//                                            MORA biti IDENTIČEN (ZERO-MUTACIJA)
// Prstni odtis = R257 števci + MaterialOrder/MaterialOrderItem/Supplier POLNA
// resnica (naročila MUTIRAMO — so v odtisu).
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

const ID_PREDPONA = 'e2e-r258-'
const PROJEKT = 'Terasa Zupan - WPC deske'

function danOb(enUr, odmikDni) {
  const d = new Date(Date.now() + odmikDni * 86400000)
  const iso = d.toISOString()
  const datum = iso.slice(0, 10)
  return `${datum} ${String(enUr).padStart(2, '0')}:00:00`
}

async function main() {
  await c.connect()
  const mode = process.argv[2] || 'fp'

  if (mode === 'seed') {
    // idempotentnost: starejši e2e-r258 ostanki IZBRANI pred vstavljanjem
    await c.query(`DELETE FROM "MaterialOrder" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    await c.query(`DELETE FROM "Supplier" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const pr = await c.query(`SELECT id FROM "Project" WHERE "nazivProjekta" = $1`, [PROJEKT])
    if (pr.rows.length !== 1) throw new Error(`seed: pričakovan 1 projekt '${PROJEKT}', najdenih ${pr.rows.length}`)
    const projektId = pr.rows[0].id
    await c.query(
      `INSERT INTO "Supplier"
         (id, naziv, kontakt, email, telefon, "dobavniRok", popust, aktivna, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
      [`${ID_PREDPONA}sup1`, 'E2E R258 Dobavitelj', 'E2E Kontakt', 'e2e-r258@roksal.si', '+386 4 000 000', 7, 0, true],
    )
    const sup = `${ID_PREDPONA}sup1`
    const naročila = [
      { id: `${ID_PREDPONA}o1`, status: 'OSNUTEK', cena: 450.5, projekt: projektId, dobava: danOb(10, -3), opombe: 'E2E R258 zamujena obljuba' },
      { id: `${ID_PREDPONA}o2`, status: 'PREKlicANO', cena: 999.99, projekt: projektId, dobava: danOb(10, -2), opombe: 'E2E R258 preklicano — izključeno iz stroškov' },
      { id: `${ID_PREDPONA}o3`, status: 'POSLANO', cena: 700, projekt: null, dobava: danOb(12, 5), opombe: 'E2E R258 brez projekta — izključeno iz preseka' },
    ]
    for (const n of naročila) {
      if (n.projekt === null) {
        await c.query(
          `INSERT INTO "MaterialOrder"
             (id, "supplierId", status, "skupajCena", "datumNarocila", "datumDobave", opombe, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5::timestamp, $6::timestamp, $7, $5::timestamp, $5::timestamp)`,
          [n.id, sup, n.status, n.cena, danOb(10, 0), n.dobava, n.opombe],
        )
      } else {
        await c.query(
          `INSERT INTO "MaterialOrder"
             (id, "projectId", "supplierId", status, "skupajCena", "datumNarocila", "datumDobave", opombe, "createdAt", "updatedAt")
           VALUES ($1, $8, $2, $3, $4, $5::timestamp, $6::timestamp, $7, $5::timestamp, $5::timestamp)`,
          [n.id, sup, n.status, n.cena, danOb(10, 0), n.dobava, n.opombe, n.projekt],
        )
      }
    }
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "MaterialOrder" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ seeded: true, narocil: n.rows[0].n }))
  } else if (mode === 'restore') {
    await c.query(`DELETE FROM "MaterialOrderItem" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    await c.query(`DELETE FROM "MaterialOrder" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    await c.query(`DELETE FROM "Supplier" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "MaterialOrder" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const s = await c.query(`SELECT COUNT(*)::int AS n FROM "Supplier" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ restored: true, ostankovNarocil: n.rows[0].n, ostankovDobaviteljev: s.rows[0].n }))
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
  console.error('R258 DB FAIL:', e.message)
  process.exit(1)
})
