// R287 — DB seed/restore + bajtni prstni odtis za E2E (lokalni dev DB, :5433).
// (k) opomnik portal akcija — zvonček signal 7: seed = DVE stranki z
// opomnikom (POTEKEL = now-3 dni / AKTIVEN = now+5 dni — koledarsko iskrene
// mete v zvončku). UPORABA:
//   node scripts/r287-db-e2e.cjs seed-opomniki — vstavi 2 stranki
//                ('e2e-r287-str-potekel' / 'e2e-r287-str-aktiven') z
//                opomnikDatum/opomnikOpis (dynamischen datum = now ± odmik;
//                odtis nosi IZRAČUNANE vrednosti — pre==post ostaja bajtnata
//                identičnost, ker se restore briše po istem ključu);
//   node scripts/r287-db-e2e.cjs restore — DELETE vseh 'e2e-r287-%'
//                strank (Customer brez FK otrok — tu ni projektov);
//   node scripts/r287-db-e2e.cjs fp — bajtni prstni odtis (JSON):
//                pre==post MORA biti IDENTIČEN (ZERO-MUTACIJA).
// RAW SQL (NE Prisma) — SAMO INSERT novih vrstic, NIČ UPDATE obstoječih;
// idempotenten seed (DELETE pred INSERT — vzorec R262–R286).
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
  if (!cmd || !['seed-opomniki', 'restore', 'fp'].includes(cmd)) {
    console.error('Uporaba: node scripts/r287-db-e2e.cjs [seed-opomniki|restore|fp]')
    process.exit(1)
  }
  await c.connect()

  if (cmd === 'seed-opomniki') {
    // Idempotenca: čist začetek pred INSERT (vzorec r272–r286).
    await c.query(`DELETE FROM "Customer" WHERE "id" LIKE 'e2e-r287-%'`)
    const potekel = new Date(Date.now() - 3 * 86400000) // 3 dni nazaj
    const aktiven = new Date(Date.now() + 5 * 86400000) // 5 dni naprej
    await c.query(
      `INSERT INTO "Customer" ("id","ime","naslov","createdAt","opomnikDatum","opomnikOpis")
       VALUES ($1,$2,$3,$4,$5,$6)`,
      ['e2e-r287-str-potekel', 'E2E R287 Potekel Opomnik', 'Test P', TS, potekel.toISOString(), 'E2E pokliči nazaj (potekel)']
    )
    await c.query(
      `INSERT INTO "Customer" ("id","ime","naslov","createdAt","opomnikDatum","opomnikOpis")
       VALUES ($1,$2,$3,$4,$5,$6)`,
      ['e2e-r287-str-aktiven', 'E2E R287 Aktiven Opomnik', 'Test A', TS, aktiven.toISOString(), 'E2E sledi ponudbi (aktiven)']
    )
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "Customer" WHERE "id" LIKE 'e2e-r287-%'`)
    console.log(`seed-opomniki OK — stranke: ${n.rows[0].n}`)
  }

  if (cmd === 'restore') {
    // Customer brez FK otrok v tem seedu (ni projektov za e2e-r287-%).
    await c.query(`DELETE FROM "Customer" WHERE "id" LIKE 'e2e-r287-%'`)
    console.log('restore OK — e2e-r287-% vrstice odstranjene')
  }

  if (cmd === 'fp') {
    const stranke = await c.query(
      `SELECT "id","ime","naslov","opomnikOpis","opomnikDatum"::text AS opomnikDatum,"createdAt"::text
       FROM "Customer" WHERE "id" LIKE 'e2e-r287-%' ORDER BY "id"`
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
