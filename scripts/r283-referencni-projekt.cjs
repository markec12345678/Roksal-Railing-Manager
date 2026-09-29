// R283 — DB seed/restore + bajtni prstni odtis za E2E (lokalni dev DB, :5433).
// Issue #15 §1 — referenčni testni projekt: SKELET s znanimi referenčnimi
// podatki (raven segment, kot 90°, stopniščni segment, naklon, različne
// dolžine, višine, profil, barva/material, fotografije, ponovni obisk) +
// §3 isti test prek VSEH treh virov (MANUAL / PHOTO_CV / ARCORE_DEPTH).
// Fizična neodvisna merjenja = lastniška akcija (docs/AR-FIELD-VALIDATION.md).
// UPORABA:
//   node scripts/r283-referencni-projekt.cjs seed-referencni — vstavi 1
//                stranko + 1 projekt ('e2e-r283-ref-proj', V_TEKU) + 3
//                meritve (m1 MANUAL raven+kot90, m2 PHOTO_CV raven B,
//                m3 ARCORE_DEPTH poln kontrakt v1 — ponovni obisk); vsi
//                OSNUTEK — skelet ČAKA terensko potrditev (iskrena
//                semantika, nič izmišljenih potrditev); fiksni timestamps
//                (determinizem odtisa); arMetadata IZ fiksture JSON
//                (EN VIR — scripts/r283-referencni-fiksture.json);
//   node scripts/r283-referencni-projekt.cjs restore — DELETE vseh
//                'e2e-r283-%' vrstic (red: audit → meritve → projekt →
//                stranka — FK veriga; audit NIKOLI SetNull ostanki);
//   node scripts/r283-referencni-projekt.cjs fp — bajtni prstni odtis
//                (JSON): pre==post MORA biti IDENTIČEN (ZERO-MUTACIJA).
// RAW SQL (NE Prisma) — SAMO INSERT novih vrstic, NIČ UPDATE obstoječih;
// idempotenten seed (DELETE pred INSERT — vzorec R262–R281).
const { Client } = require('pg')

const FIKSTURA = require('./r283-referencni-fiksture.json')

const c = new Client({
  host: 'localhost',
  port: 5433,
  user: 'roksal',
  password: 'roksal',
  database: 'roksal_dev',
})

async function main() {
  const cmd = process.argv[2]
  if (!cmd || !['seed-referencni', 'restore', 'fp'].includes(cmd)) {
    console.error('Uporaba: node scripts/r283-referencni-projekt.cjs [seed-referencni|restore|fp]')
    process.exit(1)
  }
  await c.connect()

  const PROJ = FIKSTURA.projekt.id
  const STR = FIKSTURA.stranka.id

  if (cmd === 'seed-referencni') {
    // Idempotenca: čist začetek pred INSERT (vzorec r272–r281).
    await c.query(`DELETE FROM "AuditLog" WHERE "projectId" = $1`, [PROJ])
    await c.query(`DELETE FROM "Measurement" WHERE "projectId" = $1`, [PROJ])
    await c.query(`DELETE FROM "Project" WHERE "id" = $1`, [PROJ])
    await c.query(`DELETE FROM "Customer" WHERE "id" = $1`, [STR])
    await c.query(
      `INSERT INTO "Customer" ("id","ime","naslov","createdAt") VALUES ($1,$2,$3,$4)`,
      [STR, FIKSTURA.stranka.ime, FIKSTURA.stranka.naslov, FIKSTURA.meritve[0].ts]
    )
    await c.query(
      `INSERT INTO "Project"
         ("id","customerId","nazivProjekta","status","clientToken","clientPortalEnabled","measureEnabled","dealLocked","syncRevision","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,false,false,false,0,$6,$6)`,
      [PROJ, STR, FIKSTURA.projekt.nazivProjekta, FIKSTURA.projekt.status, FIKSTURA.projekt.clientToken, FIKSTURA.meritve[0].ts]
    )
    for (const m of FIKSTURA.meritve) {
      await c.query(
        `INSERT INTO "Measurement" ("id","projectId","dolzinaMm","visinaMm","createdAt","status","verzija","korenId","vir","arMetadata") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [m.id, PROJ, m.dolzinaMm, m.visinaMm, m.ts, m.status, m.verzija, null, m.vir, JSON.stringify(m.arMetadata)]
      )
    }
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "Measurement" WHERE "projectId" = $1`, [PROJ])
    const viri = await c.query(`SELECT "vir", COUNT(*)::int AS n FROM "Measurement" WHERE "projectId" = $1 GROUP BY "vir" ORDER BY "vir"`, [PROJ])
    console.log(
      `seed-referencni OK — meritve: ${n.rows[0].n} (pričakovano ${FIKSTURA.meritve.length}) — viri: ${viri.rows.map((r) => `${r.vir}=${r.n}`).join(', ')}`
    )
  }

  if (cmd === 'restore') {
    // FK red: audit → meritve → projekt → stranka. Audit NIKOLI ostane z
    // SetNull projectId (r275 lekcija 5: restore PRED in PO — idempotentno).
    await c.query(`DELETE FROM "AuditLog" WHERE "projectId" = $1`, [PROJ])
    await c.query(`DELETE FROM "Measurement" WHERE "projectId" = $1`, [PROJ])
    await c.query(`DELETE FROM "Project" WHERE "id" = $1`, [PROJ])
    await c.query(`DELETE FROM "Customer" WHERE "id" = $1`, [STR])
    console.log('restore OK — e2e-r283-% vrstice odstranjene')
  }

  if (cmd === 'fp') {
    const fp = {}
    for (const t of ['Customer', 'Project', 'Measurement', 'AuditLog']) {
      const r = await c.query(
        `SELECT to_jsonb(t) FROM "${t}" t WHERE ` +
          (t === 'Customer' || t === 'Project'
            ? `t."id" LIKE 'e2e-r283%'`
            : `t."projectId" LIKE 'e2e-r283%'`) +
          ` ORDER BY t."id"`
      )
      fp[t] = r.rows.map((x) => x.to_jsonb)
    }
    const skupaj = await c.query(`SELECT COUNT(*)::int AS n FROM "Measurement"`)
    fp.skupajMeritve = skupaj.rows[0].n
    console.log(JSON.stringify(fp))
  }

  await c.end()
}

main().catch((e) => {
  console.error('r283-referencni-projekt NAPAKA:', e.message)
  process.exit(1)
})
