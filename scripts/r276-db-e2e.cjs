// R276 — DB seed/restore + bajtni prstni odtis za E2E (lokalni dev DB, :5433).
// Issue #16 §6 — zgodovina verzij meritev: seed = LEGACY-ČISTA veriga v1
// (vir MANUAL, korenId NULL); UI korekcija doda v2 skozi ŽIVO POST pot.
// UPORABA:
//   node scripts/r276-db-e2e.cjs seed-verzije — vstavi 1 stranko + 1 projekt
//                ('e2e-r276-proj', V_TEKU) + 1 meritev ('e2e-r276-m1':
//                3200×1200, verzija 1, korenId NULL, vir 'MANUAL') — fiksnI
//                timestamps (determinizem odtisa);
//   node scripts/r276-db-e2e.cjs restore — DELETE vseh 'e2e-r276-%' vrstic
//                (red: audit → meritve → projekt → stranka — FK veriga;
//                audit NIKOLI SetNull ostanki);
//   node scripts/r276-db-e2e.cjs fp — bajtni prstni odtis (JSON):
//                pre==post MORA biti IDENTIČEN (ZERO-MUTACIJA).
// RAW SQL (NE Prisma) — SAMO INSERT novih vrstic, NIČ UPDATE obstoječih;
// idempotenten seed (DELETE pred INSERT — vzorec R262–R275).
const { Client } = require('pg')

const c = new Client({
  host: 'localhost',
  port: 5433,
  user: 'roksal',
  password: 'roksal',
  database: 'roksal_dev',
})

const TS = '2026-09-29T08:00:00Z'

async function main() {
  const cmd = process.argv[2]
  if (!cmd || !['seed-verzije', 'restore', 'fp'].includes(cmd)) {
    console.error('Uporaba: node scripts/r276-db-e2e.cjs [seed-verzije|restore|fp]')
    process.exit(1)
  }
  await c.connect()

  if (cmd === 'seed-verzije') {
    // Idempotenca: čist začetek pred INSERT (vzorec r272–r275).
    await c.query(`DELETE FROM "AuditLog" WHERE "projectId" = 'e2e-r276-proj'`)
    await c.query(`DELETE FROM "Measurement" WHERE "projectId" = 'e2e-r276-proj'`)
    await c.query(`DELETE FROM "Project" WHERE "id" = 'e2e-r276-proj'`)
    await c.query(`DELETE FROM "Customer" WHERE "id" = 'e2e-r276-str'`)
    await c.query(
      `INSERT INTO "Customer" ("id","ime","naslov","createdAt") VALUES ($1,$2,$3,$4)`,
      ['e2e-r276-str', 'E2E r276 Stranka', 'Test 1', TS]
    )
    await c.query(
      `INSERT INTO "Project"
         ("id","customerId","nazivProjekta","status","clientToken","clientPortalEnabled","measureEnabled","dealLocked","syncRevision","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,false,false,false,0,$6,$6)`,
      ['e2e-r276-proj', 'e2e-r276-str', 'E2E r276 Verzije', 'V_TEKU', 'e2e-r276-proj-portal', TS]
    )
    await c.query(
      `INSERT INTO "Measurement" ("id","projectId","dolzinaMm","visinaMm","createdAt","status","verzija","korenId","vir") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      ['e2e-r276-m1', 'e2e-r276-proj', 3200, 1200, TS, 'OSNUTEK', 1, null, 'MANUAL']
    )
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "Measurement" WHERE "projectId" = 'e2e-r276-proj'`)
    console.log(`seed-verzije OK — meritev: ${n.rows[0].n}`)
  }

  if (cmd === 'restore') {
    // FK red: audit → meritve → projekt → stranka. Audit NIKOLI ostane z
    // SetNull projectId (r275 lekcija 5: restore PRED in PO — idempotentno).
    await c.query(`DELETE FROM "AuditLog" WHERE "projectId" = 'e2e-r276-proj'`)
    await c.query(`DELETE FROM "Measurement" WHERE "projectId" = 'e2e-r276-proj'`)
    await c.query(`DELETE FROM "Project" WHERE "id" = 'e2e-r276-proj'`)
    await c.query(`DELETE FROM "Customer" WHERE "id" = 'e2e-r276-str'`)
    console.log('restore OK — e2e-r276-% vrstice odstranjene')
  }

  if (cmd === 'fp') {
    const meritve = await c.query(
      `SELECT "id","verzija"::text AS verzija,"predhodnikId","korenId","vir","status","dolzinaMm"::text AS dolzinaMm,"visinaMm"::text AS visinaMm, "createdAt"::text FROM "Measurement" WHERE "projectId" = 'e2e-r276-proj' ORDER BY "id"`
    )
    const audit = await c.query(
      `SELECT "akcija","oldValue","newValue","timestamp"::text FROM "AuditLog" WHERE "projectId" = 'e2e-r276-proj' ORDER BY "timestamp","id"`
    )
    const projekti = await c.query(
      `SELECT "id","nazivProjekta","status","createdAt"::text FROM "Project" WHERE "id" LIKE 'e2e-r276%' ORDER BY "id"`
    )
    const stranke = await c.query(
      `SELECT "id","ime" FROM "Customer" WHERE "id" LIKE 'e2e-r276%' ORDER BY "id"`
    )
    const skupaj = await c.query(`SELECT COUNT(*)::int AS n FROM "Measurement"`)
    console.log(
      JSON.stringify({
        meritve: meritve.rows,
        audit: audit.rows,
        projekti: projekti.rows,
        stranke: stranke.rows,
        skupajMeritve: skupaj.rows[0].n,
      })
    )
  }

  await c.end()
}

main().catch((e) => {
  console.error('r276-db-e2e NAPAKA:', e.message)
  process.exit(1)
})
