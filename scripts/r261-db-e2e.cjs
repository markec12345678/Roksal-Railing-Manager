// R261 — DB seed/restore + bajtni prstni odtis za E2E (lokalni dev DB, port 5433).
// UPORABA:
//   node scripts/r261-db-e2e.cjs seed      — vstavi 1 projekt BREZ ponudbe
//                                            ('E2E R261 Brez Ponudbe', id
//                                            e2e-r261-p1, estimatedPrice
//                                            NULL) + 2 računa ('2026-E2E261-…',
//                                            id e2e-r261-i1/i2):
//                                            i1 IZDAN 250.00 na e2e-r261-p1
//                                              (brez ponudbe → '—'),
//                                            i2 PLACAN 50.00 na 'Terasa Zupan'
//                                              (realizirano 893.04 → 943.04).
//                                            Pričakovan toast PO seedu:
//                                            '4 projektov, ponudba 9150.00 €,
//                                            realizirano 1193.04 €, odstopanje
//                                            -8206.96 €.'
//   node scripts/r261-db-e2e.cjs restore   — DELETE vseh 'e2e-r261-%' vrstic
//   node scripts/r261-db-e2e.cjs fp        — bajtni prstni odtis (JSON) —
//                                            pre==post MORA biti IDENTIČEN
//                                            (ZERO-MUTACIJA)
// Prstni odtis = R257 števci + Project POLNA resnica (projekte MUTIRAMO —
// so v odtisu) + Invoice resnica (račune MUTIRAMO — so v odtisu).
// RAW SQL (NE Prisma) — updatedAt se NE premakne, restore = bajtnata
// identičnost. LEKCIJA R257: raw SQL INSERT rabi QUOTED camelCase stolpce.
// LEKCIJA R261 (seed): SAMO INSERT novih vrstic — NIČ UPDATE obstoječih
// (restore = čist DELETE novih; izvirnik se nikoli ne dotakne).
const { Client } = require('pg')

const c = new Client({
  host: 'localhost',
  port: 5433,
  user: 'roksal',
  password: 'roksal',
  database: 'roksal_dev',
})

const ID_PREDPONA = 'e2e-r261-'
const PROJEKT_TERASA = 'Terasa Zupan - WPC deske'

async function main() {
  await c.connect()
  const mode = process.argv[2] || 'fp'

  if (mode === 'seed') {
    // idempotentnost: starejši e2e-r261 ostanki IZBRANI pred vstavljanjem
    await c.query(`DELETE FROM "Invoice" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    await c.query(`DELETE FROM "Project" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const cust = await c.query(`SELECT id FROM "Customer" ORDER BY ime LIMIT 1`)
    if (cust.rows.length !== 1) throw new Error('seed: pričakovan vsaj 1 stranka')
    const strankaId = cust.rows[0].id
    const tr = await c.query(`SELECT id FROM "Project" WHERE "nazivProjekta" = $1`, [PROJEKT_TERASA])
    if (tr.rows.length !== 1) throw new Error(`seed: pričakovan 1 projekt '${PROJEKT_TERASA}', najdenih ${tr.rows.length}`)
    const terasaId = tr.rows[0].id
    // Projekt BREZ vpisane ponudbe (estimatedPrice NULL — iskrena '—' resnica)
    // LEKCIJA R261: raw SQL rabi TUDI Prisma-default stolpce (clientToken
    // @default(cuid()) je v PG NOT NULL — Prisma default deluje samo prek
    // Prisma clienta, NE prek raw INSERT).
    await c.query(
      `INSERT INTO "Project"
         (id, "customerId", "nazivProjekta", status, "clientToken", "clientPortalEnabled", "measureEnabled", "dealLocked", "syncRevision", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'NACRTOVANO', $4, false, false, false, 0, NOW(), NOW())`,
      [`${ID_PREDPONA}p1`, strankaId, 'E2E R261 Brez Ponudbe', `${ID_PREDPONA}token1`],
    )
    const racuni = [
      { id: `${ID_PREDPONA}i1`, stevilka: '2026-E2E261-1', status: 'IZDAN', znesek: 250.0, projekt: `${ID_PREDPONA}p1` },
      { id: `${ID_PREDPONA}i2`, stevilka: '2026-E2E261-2', status: 'PLACAN', znesek: 50.0, projekt: terasaId },
    ]
    for (const r of racuni) {
      await c.query(
        `INSERT INTO "Invoice"
           (id, "projectId", tip, "stevilka", "datumIzdaje", "rokPlacilaDni", status, "placanoAt", postavke, "kupec", osnova, ddv, znesek, opombe, "createdAt", "updatedAt")
         VALUES ($1, $2, 'RACUN', $3, '2026-09-28 10:00:00'::timestamp, 8, $4, $5, '[]', NULL, $6, 0, $6, $7, '2026-09-28 10:00:00'::timestamp, '2026-09-28 10:00:00'::timestamp)`,
        [
          r.id,
          r.projekt,
          r.stevilka,
          r.status,
          r.status === 'PLACAN' ? '2026-09-28 11:00:00' : null,
          r.znesek,
          'E2E R261 racun',
        ],
      )
    }
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "Invoice" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const p = await c.query(`SELECT COUNT(*)::int AS n FROM "Project" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ seeded: true, racunov: n.rows[0].n, projektov: p.rows[0].n }))
  } else if (mode === 'restore') {
    await c.query(`DELETE FROM "Invoice" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    await c.query(`DELETE FROM "Project" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "Invoice" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const p = await c.query(`SELECT COUNT(*)::int AS n FROM "Project" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ restored: true, ostankovRacunov: n.rows[0].n, ostankovProjektov: p.rows[0].n }))
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
    const projekti = await c.query(
      `SELECT id, "customerId", "nazivProjekta", status, "estimatedPrice", "clientToken", "mobileProjectId", "createdAt", "updatedAt"
         FROM "Project" ORDER BY id`,
    )
    const racuni = await c.query(
      `SELECT id, "stevilka", status, znesek, "datumIzdaje", "placanoAt" FROM "Invoice" ORDER BY id`,
    )
    const sup = await c.query(`SELECT * FROM "Supplier" ORDER BY id`)
    const cene = await c.query(`SELECT * FROM "MaterialPrice" ORDER BY id`)
    const stranke = await c.query(
      `SELECT ime, status, "opomnikDatum", "opomnikOpis" FROM "Customer" ORDER BY ime`,
    )
    console.log(JSON.stringify({
      stevci: cnt.rows[0],
      projekti: projekti.rows,
      racuni: racuni.rows,
      dobavitelji: sup.rows,
      cene: cene.rows,
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
