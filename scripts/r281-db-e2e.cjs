// R281 DB E2E orodje (kanon r276-db-e2e.cjs — RAW SQL, SAMO INSERT novih
// vrstic, idempotentno):
//   node scripts/r281-db-e2e.cjs seed-sync — vstavi 1 stranko + 1 projekt
//                ('e2e-r281-proj', V_TEKU) + 2 meritvi s sync metadata
//                (issue #16 §10, V1–V6):
//                  m1 'e2e-r281-m1': syncState 'synced', syncRevision 7,
//                     tombstone false (izrecno NE grobnica — V4);
//                  m2 'e2e-r281-m2': syncState 'conflict', tombstone true —
//                fiksni timestamps (determinizem odtisa);
//   node scripts/r281-db-e2e.cjs restore — DELETE vseh 'e2e-r281-%' vrstic
//                (red: audit → meritve → projekt → stranka — FK veriga);
//   node scripts/r281-db-e2e.cjs fp — bajtni prstni odtis (JSON):
//                pre==post MORA biti IDENTIČEN (ZERO-MUTACIJA).
const { Client } = require('pg')

const c = new Client({
  host: 'localhost',
  port: 5433,
  user: 'roksal',
  password: 'roksal',
  database: 'roksal_dev',
})

const TS = '2026-09-29T09:00:00Z'

const AR_M1 = JSON.stringify({
  tipMeritve: 'VISINA',
  kot: 87,
  sync: {
    mutationId: 'mut-r281-001',
    deviceId: 'device-pixel-8',
    baseRevision: 3,
    baseUpdatedAt: '2026-09-29T07:15:00Z',
    syncRevision: 7,
    syncState: 'synced',
    tombstone: false,
  },
})

const AR_M2 = JSON.stringify({
  tipMeritve: 'VISINA',
  sync: {
    mutationId: 'mut-r281-002',
    deviceId: 'device-pixel-8',
    baseRevision: 3,
    baseUpdatedAt: '2026-09-29T07:15:00Z',
    syncState: 'conflict',
    tombstone: true,
  },
})

async function main() {
  const cmd = process.argv[2]
  if (!cmd || !['seed-sync', 'restore', 'fp'].includes(cmd)) {
    console.error('Uporaba: node scripts/r281-db-e2e.cjs [seed-sync|restore|fp]')
    process.exit(1)
  }
  await c.connect()

  if (cmd === 'seed-sync') {
    // Idempotenca: čist začetek pred INSERT (vzorec r272–r280).
    await c.query(`DELETE FROM "AuditLog" WHERE "projectId" = 'e2e-r281-proj'`)
    await c.query(`DELETE FROM "Measurement" WHERE "projectId" = 'e2e-r281-proj'`)
    await c.query(`DELETE FROM "Project" WHERE "id" = 'e2e-r281-proj'`)
    await c.query(`DELETE FROM "Customer" WHERE "id" = 'e2e-r281-str'`)
    await c.query(
      `INSERT INTO "Customer" ("id","ime","naslov","createdAt") VALUES ($1,$2,$3,$4)`,
      ['e2e-r281-str', 'E2E r281 Stranka', 'Test 1', TS]
    )
    await c.query(
      `INSERT INTO "Project"
         ("id","customerId","nazivProjekta","status","clientToken","clientPortalEnabled","measureEnabled","dealLocked","syncRevision","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,false,false,false,0,$6,$6)`,
      ['e2e-r281-proj', 'e2e-r281-str', 'E2E r281 Sync', 'V_TEKU', 'e2e-r281-proj-portal', TS]
    )
    await c.query(
      `INSERT INTO "Measurement" ("id","projectId","dolzinaMm","visinaMm","createdAt","status","arMetadata") VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      ['e2e-r281-m1', 'e2e-r281-proj', 3200, 1200, TS, 'POTRJENA', AR_M1]
    )
    await c.query(
      `INSERT INTO "Measurement" ("id","projectId","dolzinaMm","visinaMm","createdAt","status","arMetadata") VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      ['e2e-r281-m2', 'e2e-r281-proj', 2400, 1100, TS, 'OSNUTEK', AR_M2]
    )
    const n = await c.query(
      `SELECT COUNT(*)::int AS n FROM "Measurement" WHERE "projectId" = 'e2e-r281-proj'`
    )
    console.log(`seed-sync OK — meritve: ${n.rows[0].n} (pričakovano 2)`)
  }

  if (cmd === 'restore') {
    // RED: audit → meritve → projekt → stranka (FK veriga — kanon r276).
    await c.query(`DELETE FROM "AuditLog" WHERE "projectId" = 'e2e-r281-proj'`)
    await c.query(`DELETE FROM "Measurement" WHERE "projectId" = 'e2e-r281-proj'`)
    await c.query(`DELETE FROM "Project" WHERE "id" = 'e2e-r281-proj'`)
    await c.query(`DELETE FROM "Customer" WHERE "id" = 'e2e-r281-str'`)
    console.log('restore OK — e2e-r281-% očiščeno')
  }

  if (cmd === 'fp') {
    const fp = {}
    for (const t of ['Customer', 'Project', 'Measurement', 'AuditLog']) {
      const r = await c.query(
        `SELECT to_jsonb(t) FROM "${t}" t WHERE ` +
          (t === 'Customer'
            ? `t."id" LIKE 'e2e-r281%'`
            : t === 'Project'
              ? `t."id" LIKE 'e2e-r281%'`
              : t === 'Measurement'
                ? `t."projectId" LIKE 'e2e-r281%'`
                : `t."projectId" LIKE 'e2e-r281%'`) +
          ` ORDER BY t."id"`
      )
      fp[t] = r.rows.map((x) => x.to_jsonb)
    }
    console.log(JSON.stringify(fp))
  }

  await c.end()
}

main().catch((e) => {
  console.error('NAPAKA:', e.message)
  process.exit(1)
})
