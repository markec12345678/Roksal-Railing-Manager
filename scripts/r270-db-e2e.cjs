// R270 — DB seed/restore + bajtni prstni odtis za E2E (lokalni dev DB, port 5433).
// UPORABA:
//   node scripts/r270-db-e2e.cjs seed      — vstavi 8 zalogovnih artiklov
//                                              (id e2e-r270-inv1…8; VSE veje:
//                                              POD MINIMUMOM ×3 — inv2 na
//                                              NIČ, inv1 necela zaloga 4.5,
//                                              inv3 največji manjka 6;
//                                              NA MEJI ×2 — inv4 točno ===,
//                                              inv8 neznana koda tipa;
//                                              ZADOSTNO ×3 — inv5/inv6
//                                              izenačba obrata 0 (brez
//                                              premikov — sklep 'iskreno
//                                              nič' veja), inv7 necela
//                                              zaloga 10.25; premiki VSI 0
//                                              — NI InventoryMovement
//                                              vrstic, _count.movements =
//                                              0 = veljavno celo število):
//   node scripts/r270-db-e2e.cjs restore   — DELETE vseh 'e2e-r270-%'
//                                              vrstic (Inventory — brez FK
//                                              otrok od seedu: NI premikov/
//                                              uporabe/cen — FK-less model,
//                                              R266 lekcija 6 vzorec)
//   node scripts/r270-db-e2e.cjs fp        — bajtni prstni odtis (JSON) —
//                                              pre==post MORA biti IDENTIČEN
//                                              (ZERO-MUTACIJA); Inventory
//                                              POLNA resnica + vsi števci
//                                              r269 odtisa (regresija širine)
// RAW SQL (NE Prisma) — createdAt/updatedAt FIKSNI timestamps (determinizem
// odtisa); restore = bajtnata identičnost. LEKCIJE: quoted camelCase stolpci
// (R257); SAMO INSERT novih vrstic — NIČ UPDATE obstoječih (R261);
// idempotenten seed (DELETE pred INSERT, R262–R269); InventoryMovement NIČ
// (seed ne ustvari premikov — odtis premikov = pre==post trivialno, ampak
// dokazan s števcem).
const { Client } = require('pg')

const c = new Client({
  host: 'localhost',
  port: 5433,
  user: 'roksal',
  password: 'roksal',
  database: 'roksal_dev',
})

const ID_PREDPONA = 'e2e-r270-'

// 8 artiklov — VSE veje (ISTA fixture resnica kot r270 testni ARTIKLI, ampak
// z RAW tip kodami — preslikava typeLabels je komponentna resnica):
//  inv1 WPC_deska  4.5/10  → POD MINIMUMOM manjka 5.5 (necela kolicinaNiz)
//  inv2 WPC_deska  0/5     → POD MINIMUMOM (na NIČ) manjka 5
//  inv3 Kemicno_sidro 2/8  → POD MINIMUMOM manjka 6 (največji manjka)
//  inv4 Inox_vijak 100/100 → NA MEJI (===)
//  inv5 Inox_vijak 250/100 → ZADOSTNO (premiki 0 — brez premikov veja)
//  inv6 Alu_profil 12/4    → ZADOSTNO (premiki 0)
//  inv7 WPC_deska 10.25/6  → ZADOSTNO (necela zaloga)
//  inv8 NADOMESTNI_TIP_47 3/3 → NA MEJI (neznana koda tipa — verbatim)
const ARTIKLI_SEED = [
  { id: `${ID_PREDPONA}inv1`, sifra: 'E2E-WPC-120-A', naziv: 'E2E WPC deska 120', tip: 'WPC_deska', zaloga: 4.5, min: 10, enota: 'm' },
  { id: `${ID_PREDPONA}inv2`, sifra: 'E2E-WPC-090-B', naziv: 'E2E WPC deska 90', tip: 'WPC_deska', zaloga: 0, min: 5, enota: 'kos' },
  { id: `${ID_PREDPONA}inv3`, sifra: 'E2E-KEM-5L', naziv: 'E2E Kemično sidro 5 L', tip: 'Kemicno_sidro', zaloga: 2, min: 8, enota: 'kos' },
  { id: `${ID_PREDPONA}inv4`, sifra: 'E2E-INOX-A2-060', naziv: 'E2E Inox vijak A2 6×60', tip: 'Inox_vijak', zaloga: 100, min: 100, enota: 'kos' },
  { id: `${ID_PREDPONA}inv5`, sifra: 'E2E-INOX-A2-040', naziv: 'E2E Inox vijak A2 4×40', tip: 'Inox_vijak', zaloga: 250, min: 100, enota: 'kos' },
  { id: `${ID_PREDPONA}inv6`, sifra: 'E2E-ALU-025-2M', naziv: 'E2E Alu profil 25×2 m', tip: 'Alu_profil', zaloga: 12, min: 4, enota: 'kos' },
  { id: `${ID_PREDPONA}inv7`, sifra: 'E2E-WPC-150-T', naziv: 'E2E WPC deska 150 terasa', tip: 'WPC_deska', zaloga: 10.25, min: 6, enota: 'm' },
  { id: `${ID_PREDPONA}inv8`, sifra: 'E2E-PRS-001', naziv: 'E2E Posebni pritrdilni komplet', tip: 'NADOMESTNI_TIP_47', zaloga: 3, min: 3, enota: 'kom' },
]

async function poCisti() {
  // idempotentnost: starejši e2e-r270 ostanki IZBRANI pred vstavljanjem
  // (Inventory je FK-less do premikov — NI otrok od seedu; R266 lekcija 6)
  await c.query(`DELETE FROM "Inventory" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
}

async function main() {
  await c.connect()
  const mode = process.argv[2] || 'fp'

  if (mode === 'seed') {
    await poCisti()
    for (const a of ARTIKLI_SEED) {
      await c.query(
        `INSERT INTO "Inventory"
           (id, "sifraMateriala", naziv, tip, "kolicinaZaloga", enota, "minimalnaZaloga", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, '2026-09-29 06:00:00'::timestamp, '2026-09-29 06:00:00'::timestamp)`,
        [a.id, a.sifra, a.naziv, a.tip, a.zaloga, a.enota, a.min],
      )
    }
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "Inventory" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ seeded: mode, artiklov: n.rows[0].n }))
  } else if (mode === 'restore') {
    await poCisti()
    const i = await c.query(`SELECT COUNT(*)::int AS n FROM "Inventory" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ restored: true, ostankovInventory: i.rows[0].n }))
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
              (SELECT COUNT(*) FROM "Measurement") AS meritve`,
    )
    // R270 — Inventory POLNA resnica (ta runda mutira zaloge — odtis MORA
    // pokriti; pre==post bajtnata identičnost = ZERO-MUTACIJA dokaz).
    const inventory = await c.query(
      `SELECT id, "sifraMateriala", naziv, tip, "kolicinaZaloga", enota, "minimalnaZaloga", "createdAt", "updatedAt"
         FROM "Inventory" ORDER BY id`,
    )
    console.log(JSON.stringify({
      stevci: cnt.rows[0],
      inventory: inventory.rows,
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
