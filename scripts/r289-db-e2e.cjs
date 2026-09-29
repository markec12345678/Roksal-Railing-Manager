// R289 — DB seed/restore + bajtni prstni odtis za E2E (lokalni dev DB, :5433).
// ISKREN PRESEŽEK v zvončku: seed = 9 strank z opomnikom (8 POTEKEL =
// now-(1..8) dni + 1 AKTIVEN = now+5 dni) — zvonček pokaže 6 vrstic
// (POTEKEL prioriteta) + iskren presežek 'CRM opomniki +3'. UPORABA:
//   node scripts/r289-db-e2e.cjs seed-presezek — vstavi 9 strank
//                ('e2e-r289-p0..p7' POTEKEL + 'e2e-r289-a0' AKTIVEN; datum =
//                now ± odmik — koledarsko iskrene mete, vzorec r287);
//   node scripts/r289-db-e2e.cjs restore — DELETE vseh 'e2e-r289-%';
//   node scripts/r289-db-e2e.cjs fp — bajtni prstni odtis (JSON):
//                pre==post MORA biti IDENTIČEN (ZERO-MUTACIJA).
// RAW SQL (NE Prisma) — SAMO INSERT novih vrstic, NIČ UPDATE obstoječih;
// idempotenten seed (DELETE pred INSERT — vzorec r272–r288).
const { Client } = require('pg')

const c = new Client({
  host: 'localhost',
  port: 5433,
  user: 'roksal',
  password: 'roksal',
  database: 'roksal_dev',
})

const TS = '2026-09-30T08:00:00Z'

async function main() {
  const cmd = process.argv[2]
  if (!cmd || !['seed-presezek', 'restore', 'fp'].includes(cmd)) {
    console.error('Uporaba: node scripts/r289-db-e2e.cjs [seed-presezek|restore|fp]')
    process.exit(1)
  }
  await c.connect()

  if (cmd === 'seed-presezek') {
    // Idempotenca: čist začetek pred INSERT (vzorec r272–r288).
    await c.query(`DELETE FROM "Customer" WHERE "id" LIKE 'e2e-r289-%'`)
    // 8 POTEKELIH — datumi now-(1..8) dni (različni → determinističen vrstni
    // red v prihajajočem odgovoru; lib POTEKEL ostane v odgovor vrstnem redu).
    for (let i = 0; i < 8; i++) {
      const potekel = new Date(Date.now() - (1 + i) * 86400000)
      await c.query(
        `INSERT INTO "Customer" ("id","ime","naslov","createdAt","opomnikDatum","opomnikOpis")
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [`e2e-r289-p${i}`, `E2E R289 Presezek Potekel ${i}`, `Test P${i}`, TS, potekel.toISOString(), `E2E pokliči nazaj (potekel ${i})`],
      )
    }
    // 1 AKTIVEN — now+5 dni (najbližji rok med AKTIVNIMI — sort po datumu).
    const aktiven = new Date(Date.now() + 5 * 86400000)
    await c.query(
      `INSERT INTO "Customer" ("id","ime","naslov","createdAt","opomnikDatum","opomnikOpis")
       VALUES ($1,$2,$3,$4,$5,$6)`,
      ['e2e-r289-a0', 'E2E R289 Presezek Aktiven 0', 'Test A0', TS, aktiven.toISOString(), 'E2E sledi ponudbi (aktiven)'],
    )
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "Customer" WHERE "id" LIKE 'e2e-r289-%'`)
    console.log(`seed-presezek OK — stranke: ${n.rows[0].n} (8 POTEKEL + 1 AKTIVEN = 6 vidnih + presežek 3)`)
  }

  if (cmd === 'restore') {
    // Customer brez FK otrok v tem seedu (ni projektov za e2e-r289-%).
    await c.query(`DELETE FROM "Customer" WHERE "id" LIKE 'e2e-r289-%'`)
    console.log('restore OK — e2e-r289-% vrstice odstranjene')
  }

  if (cmd === 'fp') {
    const stranke = await c.query(
      `SELECT "id","ime","naslov","opomnikOpis","opomnikDatum"::text AS opomnikDatum,"createdAt"::text
       FROM "Customer" WHERE "id" LIKE 'e2e-r289-%' ORDER BY "id"`
    )
    const hash = require('node:crypto')
      .createHash('sha256')
      .update(JSON.stringify(stranke.rows))
      .digest('hex')
    console.log(JSON.stringify({ stranke: stranke.rows.length, sha256: hash }))
  }

  await c.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
