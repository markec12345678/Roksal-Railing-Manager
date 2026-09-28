// R263 — DB seed/restore + bajtni prstni odtis za E2E (lokalni dev DB, port 5433).
// UPORABA:
//   node scripts/r263-db-e2e.cjs seed      — vstavi 3 stranke (id e2e-r263-s1/s2/s3):
//                                            s1 AKTIVEN brez opomnika (slepa pika
//                                              → brezN +1),
//                                            s2 AKTIVEN z opomnikom NOW()+5 dni
//                                              (days ≤ 7 → API opomnikStatus
//                                              AKTIVEN → pokrita, pokritost % > 0),
//                                            s3 ARHIVIRAN brez opomnika (iskren
//                                              odpad → arhiviranihBrezN +1, brez
//                                              vrstice — dokaz izključitve ŽIVO).
//                                            Pričakovan POST mini-vrstica/toast:
//                                            naravno stanje 3 stranke (vse NI):
//                                            strankN 3→6, brezN 3→4,
//                                            pokritost 0,0 % → 1/6 = 16,7 %.
//                                            ⚠️ opomnikDatum > 7 dni v prihodnje
//                                            ostane 'NI' (ruta) — zato s2 uporablja
//                                            NOW()+5 dni (dinamično — AKTIVEN vedno).
//   node scripts/r263-db-e2e.cjs restore   — DELETE vseh 'e2e-r263-%' vrstic
//   node scripts/r263-db-e2e.cjs fp        — bajtni prstni odtis (JSON) —
//                                            pre==post MORA biti IDENTIČEN
//                                            (ZERO-MUTACIJA); Customer POLNA
//                                            resnica — ta runda MUTIRA Customer
//                                            (SAMO INSERT/DELETE — R261 lekcija 2)
// RAW SQL (NE Prisma) — createdAt fiksni/funkcijski, restore = bajtnata
// identičnost. LEKCIJA R257: quoted camelCase stolpci. LEKCIJA R261: SAMO
// INSERT novih vrstic — NIČ UPDATE obstoječih. Customer NIMA updatedAt
// stolpca (schema) — samo createdAt.
const { Client } = require('pg')

const c = new Client({
  host: 'localhost',
  port: 5433,
  user: 'roksal',
  password: 'roksal',
  database: 'roksal_dev',
})

const ID_PREDPONA = 'e2e-r263-'

async function main() {
  await c.connect()
  const mode = process.argv[2] || 'fp'

  if (mode === 'seed') {
    // idempotentnost: starejši e2e-r263 ostanki IZBRANI pred vstavljanjem
    await c.query(`DELETE FROM "Customer" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    // s1 — slepa pika (AKTIVEN, brez opomnika)
    await c.query(
      `INSERT INTO "Customer"
         (id, ime, naslov, telefon, email, status, "kontaktnaOseba", kategorija, "opomnikDatum", "opomnikOpis", "zadnjiKontakt", "opombeCRM", "createdAt")
       VALUES ($1, $2, $3, $4, $5, 'AKTIVEN', $6, 'Posameznik', NULL, NULL, NULL, NULL, '2026-09-28 10:00:00'::timestamp)`,
      [`${ID_PREDPONA}s1`, 'E2E R263 Slepa Pika', 'E2E cesta 1', '+386 41 000 001', 'e2e-r263@roksal.si', 'E2E Kontakt'],
    )
    // s2 — pokrita (AKTIVEN, opomnik NOW()+5 dni → days ≤ 7 → API AKTIVEN)
    await c.query(
      `INSERT INTO "Customer"
         (id, ime, naslov, telefon, email, status, "kontaktnaOseba", kategorija, "opomnikDatum", "opomnikOpis", "zadnjiKontakt", "opombeCRM", "createdAt")
       VALUES ($1, $2, $3, $4, $5, 'AKTIVEN', $6, 'Podjetje', NOW() + interval '5 days', 'E2E R263 pregled čez 5 dni', NOW() - interval '10 days', NULL, '2026-09-28 10:00:00'::timestamp)`,
      [`${ID_PREDPONA}s2`, 'E2E R263 Pokrita', 'E2E cesta 2', '+386 41 000 002', 'e2e-r263-b@roksal.si', 'E2E Kontakt'],
    )
    // s3 — iskren odpad (ARHIVIRAN brez opomnika → brez vrstice, poimenovan števec)
    await c.query(
      `INSERT INTO "Customer"
         (id, ime, naslov, telefon, email, status, "kontaktnaOseba", kategorija, "opomnikDatum", "opomnikOpis", "zadnjiKontakt", "opombeCRM", "createdAt")
       VALUES ($1, $2, $3, $4, $5, 'ARHIVIRAN', $6, 'Drugo', NULL, NULL, NULL, 'E2E R263 zaprt primer', '2026-09-28 10:00:00'::timestamp)`,
      [`${ID_PREDPONA}s3`, 'E2E R263 Zaprt Primer', 'E2E cesta 3', null, 'e2e-r263-c@roksal.si', 'E2E Kontakt'],
    )
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "Customer" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ seeded: true, strank: n.rows[0].n }))
  } else if (mode === 'restore') {
    await c.query(`DELETE FROM "Customer" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "Customer" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ restored: true, ostankovStrank: n.rows[0].n }))
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
    // R263 — Customer POLNA resnica (ta runda mutira Customer — odtis MORA
    // pokriti; pre==post bajtnata identičnost = ZERO-MUTACIJA dokaz)
    const stranke = await c.query(
      `SELECT id, ime, naslov, telefon, email, status, "kontaktnaOseba", "opomnikDatum", "opomnikOpis", "zadnjiKontakt", "opombeCRM", kategorija, "createdAt"
         FROM "Customer" ORDER BY id`,
    )
    console.log(JSON.stringify({
      stevci: cnt.rows[0],
      zaloga: zaloga.rows,
      narocila: narocila.rows,
      postavke: postavke.rows,
      dobavitelji: sup.rows,
      cene: cene.rows,
      racuni: racuni.rows,
      stranke: stranke.rows,
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
