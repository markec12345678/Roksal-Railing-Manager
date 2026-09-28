// R262 — DB seed/restore + bajtni prstni odtis za E2E (lokalni dev DB, port 5433).
// UPORABA:
//   node scripts/r262-db-e2e.cjs seed      — vstavi 1 dobavitelja + 2 naročili
//                                            (id e2e-r262-o1/o2, postavke
//                                            e2e-r262-oi1…oi3):
//                                            o1 OSNUTEK: INOX-M12-A4 40 kos
//                                              (pokrito 40 ≥ 35 → POKRITO,
//                                              114.3 %) + ALU-PROF-40 100 m
//                                              (nad minimumom → NAD
//                                              MINIMUMOM, % '—'),
//                                            o2 POSLAN: WPC-120-B 999 m
//                                              (NE ŠTEJE — obljuba ≠ nabava;
//                                              dokaz izključitve: pokrito
//                                              ostane 140, ne 1139).
//                                            Pričakovan toast PO seedu:
//                                            '2 artiklov, pokrito 140 enot
//                                            iz 1 osnutkov, nepokritih 0.'
//   node scripts/r262-db-e2e.cjs restore   — DELETE vseh 'e2e-r262-%' vrstic
//   node scripts/r262-db-e2e.cjs fp        — bajtni prstni odtis (JSON) —
//                                            pre==post MORA biti IDENTIČEN
//                                            (ZERO-MUTACIJA)
// Prstni odtis = R257 števci + Inventory POLNA resnica + MaterialOrder/
// MaterialOrderItem/Supplier POLNA resnica (naročila MUTIRAMO — so v
// odtisu; inventory NE mutiramo — samo beremo za join dokaz).
// RAW SQL (NE Prisma) — updatedAt se NE premakne, restore = bajtnata
// identičnost. LEKCIJA R257: quoted camelCase stolpci. LEKCIJA R261:
// SAMO INSERT novih vrstic — NIČ UPDATE obstoječih; Prisma-default stolpci
// (clientToken) NIČ ne manjkajo pri MaterialOrder/Supplier (brez defaultov).
const { Client } = require('pg')

const c = new Client({
  host: 'localhost',
  port: 5433,
  user: 'roksal',
  password: 'roksal',
  database: 'roksal_dev',
})

const ID_PREDPONA = 'e2e-r262-'

async function main() {
  await c.connect()
  const mode = process.argv[2] || 'fp'

  if (mode === 'seed') {
    // idempotentnost: starejši e2e-r262 ostanki IZBRANI pred vstavljanjem
    await c.query(`DELETE FROM "MaterialOrderItem" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    await c.query(`DELETE FROM "MaterialOrder" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    await c.query(`DELETE FROM "Supplier" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    await c.query(
      `INSERT INTO "Supplier"
         (id, naziv, kontakt, email, telefon, "dobavniRok", popust, aktivna, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 7, 0, true, NOW(), NOW())`,
      [`${ID_PREDPONA}sup1`, 'E2E R262 Dobavitelj', 'E2E Kontakt', 'e2e-r262@roksal.si', '+386 4 000 000'],
    )
    const sup = `${ID_PREDPONA}sup1`
    // identiteti joina: obstoječa Inventory id (naravno stanje — NIČ UPDATE)
    const inox = await c.query(`SELECT id FROM "Inventory" WHERE "sifraMateriala" = 'INOX-M12-A4'`)
    const alu = await c.query(`SELECT id FROM "Inventory" WHERE "sifraMateriala" = 'ALU-PROF-40'`)
    const wpcb = await c.query(`SELECT id FROM "Inventory" WHERE "sifraMateriala" = 'WPC-120-B'`)
    if (inox.rows.length !== 1 || alu.rows.length !== 1 || wpcb.rows.length !== 1) {
      throw new Error('seed: pričakovan po 1 artikel INOX-M12-A4/ALU-PROF-40/WPC-120-B')
    }
    await c.query(
      `INSERT INTO "MaterialOrder"
         (id, "supplierId", status, "skupajCena", "datumNarocila", "datumDobave", opombe, "createdAt", "updatedAt")
       VALUES ($1, $2, 'OSNUTEK', 0, '2026-09-28 10:00:00'::timestamp, '2026-10-05 10:00:00'::timestamp, 'E2E R262 osnutek pokritost', '2026-09-28 10:00:00'::timestamp, '2026-09-28 10:00:00'::timestamp)`,
      [`${ID_PREDPONA}o1`, sup],
    )
    await c.query(
      `INSERT INTO "MaterialOrder"
         (id, "supplierId", status, "skupajCena", "datumNarocila", "datumDobave", opombe, "createdAt", "updatedAt")
       VALUES ($1, $2, 'POSLANO', 0, '2026-09-28 10:00:00'::timestamp, '2026-10-01 10:00:00'::timestamp, 'E2E R262 poslano — NIČ ne pokriva', '2026-09-28 10:00:00'::timestamp, '2026-09-28 10:00:00'::timestamp)`,
      [`${ID_PREDPONA}o2`, sup],
    )
    const postavke = [
      { id: `${ID_PREDPONA}oi1`, order: `${ID_PREDPONA}o1`, inv: inox.rows[0].id, kol: 40, cena: 0.5, naziv: 'Inox Vijak M12 A4', enota: 'kos' },
      { id: `${ID_PREDPONA}oi2`, order: `${ID_PREDPONA}o1`, inv: alu.rows[0].id, kol: 100, cena: 8, naziv: 'Alu Profil 40x40', enota: 'm' },
      { id: `${ID_PREDPONA}oi3`, order: `${ID_PREDPONA}o2`, inv: wpcb.rows[0].id, kol: 999, cena: 12, naziv: 'WPC Deska 120mm Brown', enota: 'm' },
    ]
    for (const p of postavke) {
      await c.query(
        `INSERT INTO "MaterialOrderItem"
           (id, "orderId", "inventoryId", kolicina, cena, naziv, enota, "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, '2026-09-28 10:00:00'::timestamp)`,
        [p.id, p.order, p.inv, p.kol, p.cena, p.naziv, p.enota],
      )
    }
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "MaterialOrder" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const i = await c.query(`SELECT COUNT(*)::int AS n FROM "MaterialOrderItem" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ seeded: true, narocil: n.rows[0].n, postavk: i.rows[0].n }))
  } else if (mode === 'restore') {
    await c.query(`DELETE FROM "MaterialOrderItem" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    await c.query(`DELETE FROM "MaterialOrder" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    await c.query(`DELETE FROM "Supplier" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "MaterialOrder" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const i = await c.query(`SELECT COUNT(*)::int AS n FROM "MaterialOrderItem" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const s = await c.query(`SELECT COUNT(*)::int AS n FROM "Supplier" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ restored: true, ostankovNarocil: n.rows[0].n, ostankovPostavk: i.rows[0].n, ostankovDobaviteljev: s.rows[0].n }))
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
    const zaloga = await c.query(
      `SELECT id, "sifraMateriala", naziv, "kolicinaZaloga", "minimalnaZaloga", enota, "createdAt", "updatedAt"
         FROM "Inventory" ORDER BY id`,
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
    const racuni = await c.query(
      `SELECT id, "stevilka", status, znesek, "datumIzdaje", "placanoAt" FROM "Invoice" ORDER BY id`,
    )
    console.log(JSON.stringify({
      stevci: cnt.rows[0],
      zaloga: zaloga.rows,
      narocila: narocila.rows,
      postavke: postavke.rows,
      dobavitelji: sup.rows,
      cene: cene.rows,
      racuni: racuni.rows,
    }))
  } else {
    throw new Error(`neznani način: ${mode}`)
  }
  await c.end()
}

main().catch(async (e) => {
  console.error(e.message)
  try { await c.end() } catch {}
  process.exit(1)
})
