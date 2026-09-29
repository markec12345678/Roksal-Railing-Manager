// R271 — DB seed/restore + bajtni prstni odtis za E2E (lokalni dev DB, port 5433).
// UPORABA:
//   node scripts/r272-db-e2e.cjs seed-base   — vstavi 1 stranko + 1 projekt
//                                              ('E2E Zapisnik Blok B', V_TEKU)
//                                              BREZ točk — naravna fail-closed
//                                              veja Z1b (projekt obstaja,
//                                              0 Slope — dev DB ima 0
//                                              naravnih Slope, R269
//                                              precedens: NIČ stuba);
//   node scripts/r272-db-e2e.cjs seed-tocke  — vstavi 4 točke zapisnika
//                                              (id e2e-r272-t1…4; projekt
//                                              MORA obstajati — seed-base
//                                              PRVN, drugače FK kršitev;
//                                              status stolpec = EN VIR R158
//                                              znane kode; fiksni timestamps):
//                                                t1 issue — 'Urejena meja z sosedom' (RED — blokira predajo)
//                                                t2 open  — 'Dostop do parcele urejen' + opomba (AMBER)
//                                                t3 done  — 'Kontrola mer in vodnosti' (GREEN)
//                                                t4 done  — 'Predaja ključev', brez opombe ('—' sivo)
//                                              → napak 1 / odprtih 1 / rešenih 2
//                                              / rešenost 50.0 % (RED dot +
//                                              žetona '1 napaka' + '1 odprta');
//   node scripts/r272-db-e2e.cjs restore     — DELETE vseh 'e2e-r272-%' vrstic
//                                              (red: točke → projekt → stranka
//                                              — FK veriga; Slope
//                                              onDelete: Cascade, ampak
//                                              ekspliciten red je文档iran)
//   node scripts/r272-db-e2e.cjs fp          — bajtni prstni odtis (JSON) —
//                                              pre==post MORA biti IDENTIČEN
//                                              (ZERO-MUTACIJA); Slope +
//                                              Project + Inventory POLNA
//                                              resnica (regresija širine R270
//                                              + r269 števci).
// RAW SQL (NE Prisma) — createdAt/updatedAt FIKSNI timestamps (determinizem
// odtisa); restore = bajtnata identičnost. LEKCIJE: quoted camelCase stolpci
// (R257); SAMO INSERT novih vrstic — NIČ UPDATE obstoječih (R261); idempotenten
// seed (DELETE pred INSERT, R262–R270); clientToken ekspliciten (R265 lekcija 4).
const { Client } = require('pg')

const c = new Client({
  host: 'localhost',
  port: 5433,
  user: 'roksal',
  password: 'roksal',
  database: 'roksal_dev',
})

const ID_PREDPONA = 'e2e-r272-'

// 4 točke — VSE veje (ISTA fixture resnica kot r272 testni TOCKE, okrnjena na
// 4 E2E-minimalne; status = DB String kodе — EN VIR R158 znane kode):
//  t1 issue — RED akcija (blokira predajo) + opomba
//  t2 open  — AMBER akcija + opomba
//  t3 done  — GREEN zgodovina + opomba
//  t4 done  — GREEN zgodovina, opomba NULL → '—' sivo (iskren odpad)
const NAGIBI_SEED = [
  { id: `${ID_PREDPONA}n1`, kot: 2.35, smer: 'Y', lokacija: 'Talna plošča balkona', veljaven: true },
  { id: `${ID_PREDPONA}n2`, kot: -1.42, smer: 'X', lokacija: 'Rob balkona', veljaven: true },
  { id: `${ID_PREDPONA}n3`, kot: 0.5, smer: null, lokacija: null, veljaven: true },
  { id: `${ID_PREDPONA}n4`, kot: 0.8, smer: 'X', lokacija: 'Stopnišče', veljaven: false },
]

async function poCisti() {
  // FK veriga: Slope → Project → Customer (Cascade po strani projekta,
  // ampak ekspliciten red = determinističen odtis; R269 vzorec)
  await c.query(`DELETE FROM "Slope" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
  await c.query(`DELETE FROM "Project" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
  await c.query(`DELETE FROM "Customer" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
}

async function main() {
  await c.connect()
  const mode = process.argv[2] || 'fp'

  if (mode === 'seed-base') {
    await poCisti()
    // stranka (FK za projekt)
    await c.query(
      `INSERT INTO "Customer"
         (id, ime, naslov, status, "createdAt")
       VALUES ($1, $2, $3, 'AKTIVEN', '2026-09-29 06:00:00'::timestamp)`,
      [`${ID_PREDPONA}stranka`, 'E2E Zapisnik Stranka', 'E2E Zapisniška ulica 2, 4000 Kranj'],
    )
    // projekt (FK za točke) — clientToken ekspliciten (R265 lekcija 4)
    await c.query(
      `INSERT INTO "Project"
         (id, "customerId", "nazivProjekta", status, "clientToken", "clientPortalEnabled", "measureEnabled", "dealLocked", "syncRevision", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'V_TEKU', $4, false, false, false, 0, '2026-09-29 06:00:00'::timestamp, '2026-09-29 06:00:00'::timestamp)`,
      [`${ID_PREDPONA}proj`, `${ID_PREDPONA}stranka`, 'E2E Zapisnik Blok B', `${ID_PREDPONA}proj-portal`],
    )
    const p = await c.query(`SELECT COUNT(*)::int AS n FROM "Project" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ seeded: mode, projektov: p.rows[0].n }))
  } else if (mode === 'seed-nagibi') {
    for (const t of NAGIBI_SEED) {
      await c.query(
        `INSERT INTO "Slope"
           (id, "projectId", "kotStopinje", smer, lokacija, veljaven, "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, '2026-09-29 06:10:00'::timestamp)`,
        [t.id, `${ID_PREDPONA}proj`, t.kot, t.smer, t.lokacija, t.veljaven],
      )
    }
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "Slope" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ seeded: mode, tock: n.rows[0].n }))
  } else if (mode === 'restore') {
    await poCisti()
    const t = await c.query(`SELECT COUNT(*)::int AS n FROM "Slope" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const p = await c.query(`SELECT COUNT(*)::int AS n FROM "Project" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const s = await c.query(`SELECT COUNT(*)::int AS n FROM "Customer" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ restored: true, ostankovTocke: t.rows[0].n, ostankovProjekt: p.rows[0].n, ostankovStranka: s.rows[0].n }))
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
              (SELECT COUNT(*) FROM "Slope") AS punch`,
    )
    // R271 — Slope POLNA resnica (ta runda mutira zapisnik — odtis MORA
    // pokriti) + Project e2e + Inventory (regresija širine R270); pre==post
    // bajtnata identičnost = ZERO-MUTACIJA dokaz.
    const punch = await c.query(
      `SELECT id, "projectId", "kotStopinje", smer, lokacija, veljaven, "createdAt"
         FROM "Slope" ORDER BY id`,
    )
    const e2eProj = await c.query(
      `SELECT id, "customerId", "nazivProjekta", status, "clientToken", "clientPortalEnabled", "measureEnabled", "dealLocked", "syncRevision", "createdAt", "updatedAt"
         FROM "Project" WHERE id LIKE $1 ORDER BY id`,
      [`${ID_PREDPONA}%`],
    )
    console.log(JSON.stringify({
      stevci: cnt.rows[0],
      punch: punch.rows,
      e2eProj: e2eProj.rows,
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
