// R264 — DB seed/restore + bajtni prstni odtis za E2E (lokalni dev DB, port 5433).
// UPORABA:
//   node scripts/r264-db-e2e.cjs seed      — vstavi 2 dobavitelja + 3 cene
//                                            (id e2e-r264-sup1/sup2, cene
//                                            e2e-r264-p1…p3):
//                                            sup1 (Alu Pozicija Dobavitelj):
//                                              p1 artikel A 100 (NAJNIŽJA),
//                                              p2 artikel B 80 (NAJNIŽJA —
//                                                artikel B brez alternative),
//                                            sup2 (Beton Pozicija Center):
//                                              p3 artikel A 120 (VIŠJA 20 %).
//                                            Pričakovan POST toast:
//                                            '2 dobavitelja, 3 ponudbe, brez
//                                            alternative 1.'
//                                            ⚠️ Naravno stanje dev DB: 0 cen →
//                                            PRE klik = fail-closed toast 'Ni
//                                            vpisanih cen' (veja 1), PO seedu =
//                                            uspešna pot (veja 2) — OBE dokazani.
//   node scripts/r264-db-e2e.cjs restore   — DELETE vseh 'e2e-r264-%' vrstic
//   node scripts/r264-db-e2e.cjs fp        — bajtni prstni odtis (JSON) —
//                                            pre==post MORA biti IDENTIČEN
//                                            (ZERO-MUTACIJA); MaterialPrice +
//                                            Supplier POLNA resnica — ta runda
//                                            mutira obe (SAMO INSERT/DELETE —
//                                            R261 lekcija 2)
// RAW SQL (NE Prisma) — createdAt/veljavnostOd FIKSNI timestamps (determinizem
// odtisa); restore = bajtnata identičnost. LEKCIJA R257: quoted camelCase
// stolpci ("inventoryId", "supplierId", "veljavnostOd"). LEKCIJA R261: SAMO
// INSERT novih vrstic — NIČ UPDATE obstoječih. LEKCIJA R262/R263: idempotenten
// seed (DELETE pred INSERT) + Inventory identiteta po sifraMateriala (NIČ
// UPDATE obstoječih vrstic).
const { Client } = require('pg')

const c = new Client({
  host: 'localhost',
  port: 5433,
  user: 'roksal',
  password: 'roksal',
  database: 'roksal_dev',
})

const ID_PREDPONA = 'e2e-r264-'

async function main() {
  await c.connect()
  const mode = process.argv[2] || 'fp'

  if (mode === 'seed') {
    // idempotentnost: starejši e2e-r264 ostanki IZBRANI pred vstavljanjem
    await c.query(`DELETE FROM "MaterialPrice" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    await c.query(`DELETE FROM "Supplier" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    // dobavitelja (identiteta po id — dva različna naziva)
    await c.query(
      `INSERT INTO "Supplier"
         (id, naziv, kontakt, email, telefon, "dobavniRok", popust, aktivna, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 7, 0, true, '2026-09-28 10:00:00'::timestamp, '2026-09-28 10:00:00'::timestamp)`,
      [`${ID_PREDPONA}sup1`, 'Alu Pozicija Dobavitelj', 'E2E Kontakt', 'e2e-r264-a@roksal.si', '+386 4 111 111'],
    )
    await c.query(
      `INSERT INTO "Supplier"
         (id, naziv, kontakt, email, telefon, "dobavniRok", popust, aktivna, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 7, 5, true, '2026-09-28 10:00:00'::timestamp, '2026-09-28 10:00:00'::timestamp)`,
      [`${ID_PREDPONA}sup2`, 'Beton Pozicija Center', 'E2E Kontakt', 'e2e-r264-b@roksal.si', '+386 4 222 222'],
    )
    // identiteti joina: obstoječa Inventory id (naravno stanje — NIČ UPDATE)
    const arta = await c.query(`SELECT id FROM "Inventory" WHERE "sifraMateriala" = 'INOX-M12-A4'`)
    const artb = await c.query(`SELECT id FROM "Inventory" WHERE "sifraMateriala" = 'WPC-120-B'`)
    if (arta.rows.length !== 1 || artb.rows.length !== 1) {
      throw new Error('seed: pričakovan po 1 artikel INOX-M12-A4/WPC-120-B')
    }
    const a = arta.rows[0].id
    const b = artb.rows[0].id
    // 3 veljavne cene (veljavnostDo NULL): sup1 najnižja na obeh artiklih,
    // sup2 višja na A (20 % nad najnižjo); artikel B ima SAMO sup1 ponudbo
    // (suppliers = 1 → brez alternative — cenitveno tveganje).
    const cene = [
      { id: `${ID_PREDPONA}p1`, inv: a, sup: `${ID_PREDPONA}sup1`, cena: 100, opomba: 'E2E R264 najnižja A' },
      { id: `${ID_PREDPONA}p2`, inv: b, sup: `${ID_PREDPONA}sup1`, cena: 80, opomba: 'E2E R264 brez alternative B' },
      { id: `${ID_PREDPONA}p3`, inv: a, sup: `${ID_PREDPONA}sup2`, cena: 120, opomba: 'E2E R264 višja A' },
    ]
    for (const p of cene) {
      await c.query(
        `INSERT INTO "MaterialPrice"
           (id, "inventoryId", "supplierId", cena, "veljavnostOd", "veljavnostDo", opomba, "createdAt")
         VALUES ($1, $2, $3, $4, '2026-09-28 10:00:00'::timestamp, NULL, $5, '2026-09-28 10:00:00'::timestamp)`,
        [p.id, p.inv, p.sup, p.cena, p.opomba],
      )
    }
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "MaterialPrice" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ seeded: true, cen: n.rows[0].n }))
  } else if (mode === 'restore') {
    await c.query(`DELETE FROM "MaterialPrice" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    await c.query(`DELETE FROM "Supplier" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "MaterialPrice" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const s = await c.query(`SELECT COUNT(*)::int AS n FROM "Supplier" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ restored: true, ostankovCen: n.rows[0].n, ostankovDobaviteljev: s.rows[0].n }))
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
    // R264 — Supplier + MaterialPrice POLNA resnica (ta runda mutira obe —
    // odtis MORA pokriti; pre==post bajtnata identičnost = ZERO-MUTACIJA dokaz)
    const sup = await c.query(`SELECT * FROM "Supplier" ORDER BY id`)
    const cene = await c.query(
      `SELECT id, "inventoryId", "supplierId", cena, "veljavnostOd", "veljavnostDo", opomba, "createdAt"
         FROM "MaterialPrice" ORDER BY id`,
    )
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
