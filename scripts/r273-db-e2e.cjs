// R273 — DB seed/restore + bajtni prstni odtis za E2E (lokalni dev DB, port 5433).
// UPORABA:
//   node scripts/r273-db-e2e.cjs seed-base     — vstavi 1 stranko + 1 projekt
//                                                ('E2E Vrednost Blok C', V_TEKU)
//                                                — za Z3 regresije (R272/R271/
//                                                R269 pill so projekt-gated);
//   node scripts/r273-db-e2e.cjs seed-vrednost — vstavi 1 dobavitelja + 5
//                                                artiklov + 5 cen (id
//                                                e2e-r273-a1…a5, c1…c5;
//                                                VSE TRI veje resničnega
//                                                API-ja: 3 artikli z VELJAVNO
//                                                ceno (a1 DVE cene — best =
//                                                nižja 12.50), a3 z SAMO
//                                                PRETEČENO ceno (veljavnostDo
//                                                nastavljen — API ne vrne →
//                                                'pretečena' veja skozi
//                                                REALNO API filtriranje!), a4
//                                                BREZ vpisane cene (_count
//                                                .prices === 0 dobesedno —
//                                                R227 žig veja);
//                                                Σ = 12.50×10 + 8.30×4.5 +
//                                                3.10×25 = 239.85 EUR;
//   node scripts/r273-db-e2e.cjs restore       — DELETE vseh 'e2e-r273-%'
//                                                vrstic (red: cene → artikli
//                                                → dobavitelj → Slope →
//                                                projekt → stranka — FK
//                                                veriga);
//   node scripts/r273-db-e2e.cjs fp            — bajtni prstni odtis (JSON) —
//                                                pre==post MORA biti
//                                                IDENTIČEN (ZERO-MUTACIJA);
//                                                Inventory + MaterialPrice +
//                                                Supplier e2e POLNA resnica
//                                                (runda mutira zaloga/cene)
//                                                + regresija širine r272
//                                                števcev.
// RAW SQL (NE Prisma) — createdAt/updatedAt FIKSNI timestamps (determinizem
// odtisa); SAMO INSERT novih vrstic — NIČ UPDATE obstoječih (R261); idempotenten
// seed (DELETE pred INSERT, R262–R272); sifraMateriala UNIQUE → '-E2E' pripona.
const { Client } = require('pg')

const c = new Client({
  host: 'localhost',
  port: 5433,
  user: 'roksal',
  password: 'roksal',
  database: 'roksal_dev',
})

const ID_PREDPONA = 'e2e-r273-'

// 5 artiklov — VSE TRI veje (ISTA fixture resnica kot r273 testni ARTIKLI,
// okrnjeni na E2E-minimalne; tip = UI tip-koda):
const ARTIKLI_SEED = [
  { id: `${ID_PREDPONA}a1`, sifra: 'WPC-120-A-E2E', naziv: 'E2E WPC deska 120', tip: 'WPC_deska', zaloga: 10, min: 5 },
  { id: `${ID_PREDPONA}a2`, sifra: 'WPC-140-B-E2E', naziv: 'E2E WPC deska 140', tip: 'WPC_deska', zaloga: 4.5, min: 5 },
  { id: `${ID_PREDPONA}a3`, sifra: 'INOX-VIJAK-M8-E2E', naziv: 'E2E Inox vijak M8', tip: 'Inox_vijak', zaloga: 200, min: 50 },
  { id: `${ID_PREDPONA}a4`, sifra: 'KEM-SIDRO-75-E2E', naziv: 'E2E Kemično sidro 75', tip: 'Kemicno_sidro', zaloga: 0, min: 5 },
  { id: `${ID_PREDPONA}a5`, sifra: 'ALU-PROFIL-2M-E2E', naziv: 'E2E Alu profil 2m', tip: 'Alu_profil', zaloga: 25, min: 10 },
]

// 4 cene — ENA veljavna per artikel (DB resnica: material_price_no_overlap
// EXCLUDE gist (inventoryId, supplierId, tsrange(veljavnostOd, veljavnostDo))
// — ISTEGA dobavitelja NIKOLI dve prekrivajoči se obdobji per artikel — r273
// E2E prvi tek to DOKAZAL s zavrnitvijo c2!); best-per-artikel iz več
// dobaviteljev = enotni testi (BEST fixture). a3 cena PRETEČENA
// (veljavnostDo nastavljen — API /api/material-prices ne vrne);
// a4 brez cen (veja _count.prices === 0 dobesedno).
const CENE_SEED = [
  { id: `${ID_PREDPONA}c1`, art: `${ID_PREDPONA}a1`, cena: 12.5, do: null },
  { id: `${ID_PREDPONA}c3`, art: `${ID_PREDPONA}a2`, cena: 8.3, do: null },
  { id: `${ID_PREDPONA}c4`, art: `${ID_PREDPONA}a3`, cena: 6.0, do: '2026-09-28 00:00:00' },
  { id: `${ID_PREDPONA}c5`, art: `${ID_PREDPONA}a5`, cena: 3.1, do: null },
]

async function poCisti() {
  // FK veriga: MaterialPrice → Inventory/Supplier; Slope → Project →
  // Customer (Cascade po strani projekta, ampak ekspliciten red =
  // determinističen odtis; R269/R272 vzorec)
  await c.query(`DELETE FROM "MaterialPrice" WHERE id LIKE $1 OR "inventoryId" LIKE $1`, [`${ID_PREDPONA}%`])
  await c.query(`DELETE FROM "Inventory" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
  await c.query(`DELETE FROM "Supplier" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
  await c.query(`DELETE FROM "Slope" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
  await c.query(`DELETE FROM "Project" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
  await c.query(`DELETE FROM "Customer" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
}

async function main() {
  await c.connect()
  const mode = process.argv[2] || 'fp'

  if (mode === 'seed-base') {
    await poCisti()
    await c.query(
      `INSERT INTO "Customer"
         (id, ime, naslov, status, "createdAt")
       VALUES ($1, $2, $3, 'AKTIVEN', '2026-09-29 07:00:00'::timestamp)`,
      [`${ID_PREDPONA}stranka`, 'E2E Vrednost Stranka', 'E2E Vrednostna ulica 3, 4000 Kranj'],
    )
    await c.query(
      `INSERT INTO "Project"
         (id, "customerId", "nazivProjekta", status, "clientToken", "clientPortalEnabled", "measureEnabled", "dealLocked", "syncRevision", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'V_TEKU', $4, false, false, false, 0, '2026-09-29 07:00:00'::timestamp, '2026-09-29 07:00:00'::timestamp)`,
      [`${ID_PREDPONA}proj`, `${ID_PREDPONA}stranka`, 'E2E Vrednost Blok C', `${ID_PREDPONA}proj-portal`],
    )
    const p = await c.query(`SELECT COUNT(*)::int AS n FROM "Project" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ seeded: mode, projektov: p.rows[0].n }))
  } else if (mode === 'seed-vrednost') {
    // dobavitelj (FK za cene) — naziv UNIQUE
    await c.query(
      `INSERT INTO "Supplier"
         (id, naziv, "dobavniRok", popust, aktivna, "createdAt", "updatedAt")
       VALUES ($1, $2, 7, 0, true, '2026-09-29 07:05:00'::timestamp, '2026-09-29 07:05:00'::timestamp)`,
      [`${ID_PREDPONA}dob`, 'E2E Vrednost Dobavitelj'],
    )
    for (const a of ARTIKLI_SEED) {
      await c.query(
        `INSERT INTO "Inventory"
           (id, "sifraMateriala", naziv, tip, "kolicinaZaloga", enota, "minimalnaZaloga", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, 'kos', $6, '2026-09-29 07:05:00'::timestamp, '2026-09-29 07:05:00'::timestamp)`,
        [a.id, a.sifra, a.naziv, a.tip, a.zaloga, a.min],
      )
    }
    for (const p of CENE_SEED) {
      await c.query(
        `INSERT INTO "MaterialPrice"
           (id, "inventoryId", "supplierId", cena, "veljavnostOd", "veljavnostDo", "createdAt")
         VALUES ($1, $2, $3, $4, '2026-09-01 00:00:00'::timestamp, ${p.do === null ? 'NULL' : `'${p.do}'::timestamp`}, '2026-09-01 00:00:00'::timestamp)`,
        [p.id, p.art, `${ID_PREDPONA}dob`, p.cena],
      )
    }
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "Inventory" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const pc = await c.query(`SELECT COUNT(*)::int AS n FROM "MaterialPrice" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ seeded: mode, artiklov: n.rows[0].n, cen: pc.rows[0].n }))
  } else if (mode === 'restore') {
    await poCisti()
    const i = await c.query(`SELECT COUNT(*)::int AS n FROM "Inventory" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const pc = await c.query(`SELECT COUNT(*)::int AS n FROM "MaterialPrice" WHERE id LIKE $1 OR "inventoryId" LIKE $1`, [`${ID_PREDPONA}%`])
    const d = await c.query(`SELECT COUNT(*)::int AS n FROM "Supplier" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const s = await c.query(`SELECT COUNT(*)::int AS n FROM "Slope" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const p = await c.query(`SELECT COUNT(*)::int AS n FROM "Project" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const k = await c.query(`SELECT COUNT(*)::int AS n FROM "Customer" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ restored: true, ostankovArtikli: i.rows[0].n, ostankovCene: pc.rows[0].n, ostankovDobavitelj: d.rows[0].n, ostankovSlope: s.rows[0].n, ostankovProjekt: p.rows[0].n, ostankovStranka: k.rows[0].n }))
  } else if (mode === 'fp') {
    const cnt = await c.query(
      `SELECT (SELECT COUNT(*) FROM "Equipment") AS oprema,
              (SELECT COUNT(*) FROM "Inventory") AS inv,
              (SELECT COUNT(*) FROM "InventoryMovement") AS premiki,
              (SELECT COUNT(*) FROM "MaterialUsage") AS uporabe,
              (SELECT COUNT(*) FROM "StockLedger") AS ledger,
              (SELECT COUNT(*) FROM "MaterialOrder") AS narocila,
              (SELECT COUNT(*) FROM "MaterialOrderItem") AS postavke,
              (SELECT COUNT(*) FROM "Supplier") AS dobavitelji,
              (SELECT COUNT(*) FROM "MaterialPrice") AS cene,
              (SELECT COUNT(*) FROM "Project") AS projekti,
              (SELECT COUNT(*) FROM "Invoice") AS racuni,
              (SELECT COUNT(*) FROM "Customer") AS stranke,
              (SELECT COUNT(*) FROM "InstallationSchedule") AS termini,
              (SELECT COUNT(*) FROM "Measurement") AS meritve,
              (SELECT COUNT(*) FROM "Slope") AS nagibi`,
    )
    // R273 — Inventory + MaterialPrice + Supplier e2e POLNA resnica (ta runda
    // mutira zalogo/cene — odtis MORA pokriti) + Project e2e; pre==post
    // bajtnata identičnost = ZERO-MUTACIJA dokaz.
    const inv = await c.query(
      `SELECT id, "sifraMateriala", naziv, tip, "kolicinaZaloga", enota, "minimalnaZaloga", "createdAt", "updatedAt"
         FROM "Inventory" WHERE id LIKE $1 ORDER BY id`,
      [`${ID_PREDPONA}%`],
    )
    const cene = await c.query(
      `SELECT id, "inventoryId", "supplierId", cena, "veljavnostOd", "veljavnostDo", "createdAt"
         FROM "MaterialPrice" WHERE id LIKE $1 ORDER BY id`,
      [`${ID_PREDPONA}%`],
    )
    const dob = await c.query(
      `SELECT id, naziv, "dobavniRok", popust, aktivna, "createdAt", "updatedAt"
         FROM "Supplier" WHERE id LIKE $1 ORDER BY id`,
      [`${ID_PREDPONA}%`],
    )
    const proj = await c.query(
      `SELECT id, "customerId", "nazivProjekta", status, "clientToken", "clientPortalEnabled", "measureEnabled", "dealLocked", "syncRevision", "createdAt", "updatedAt"
         FROM "Project" WHERE id LIKE $1 ORDER BY id`,
      [`${ID_PREDPONA}%`],
    )
    console.log(JSON.stringify({
      stevci: cnt.rows[0],
      e2eInv: inv.rows,
      e2eCene: cene.rows,
      e2eDobavitelj: dob.rows,
      e2eProj: proj.rows,
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
