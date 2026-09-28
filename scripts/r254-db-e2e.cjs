// R254 — DB seed/restore + bajtni prstni odtis za E2E (lokalni dev DB, port 5433).
// UPORABA:
//   node scripts/r254-db-e2e.cjs seed      — nastavi 2× POTEKEL + 1× AKTIVEN opomnik
//                                            (AKTIVEN = computed zdaj+3 dni — vedno v
//                                            7-dnevnem oknu ob fetch-u); ORIGINALI v
//                                            /tmp/r254-crm-original.json
//   node scripts/r254-db-e2e.cjs restore   — zapiše ORIGINALNE vrednosti nazaj (bajtnato,
//                                            vključno z NULL)
//   node scripts/r254-db-e2e.cjs fp        — bajtni prstni odtis (JSON) — pre==post MORA
//                                            biti IDENTIČEN (ZERO-MUTACIJA)
// Prstni odtis = R252 števci + polna Customer opomnik resnica (VSE stranke).
// RAW SQL (NE Prisma) — updatedAt se NE premakne, restore = bajtnata identičnost.
const { Client } = require('pg')

const c = new Client({
  host: 'localhost',
  port: 5433,
  user: 'roksal',
  password: 'roksal',
  database: 'roksal_dev',
})

// Fiksni ciljni stranke (deterministični po imenu) + fiksni datumi:
// 2× POTEKEL (v preteklosti glede na celotno E2E okno) + 1× AKTIVEN
// (zdaj + 3 dni — VEDNO znotraj 7-dnevnega okna ob fetch-u; izračunan ob
// seedu, ker fiksni datum sredi oktobra ne bi več bil 'v tem tednu').
const CILJI = ['Janez Novak', 'Maja Zupan', 'Andrej Kokalj']
const ORIGINAL = '/tmp/r254-crm-original.json'

function aktivenDatum() {
  const d = new Date(Date.now() + 3 * 86400000)
  const iso = d.toISOString()
  return `${iso.slice(0, 10)}T09:00:00.000Z`
}

function seedZa(ime) {
  if (ime === 'Janez Novak') return { datum: '2026-09-20T09:00:00.000Z', opis: 'E2E R254 pregled balkona' } // najstarejši POTEKEL
  if (ime === 'Maja Zupan') return { datum: '2026-09-26T09:00:00.000Z', opis: 'E2E R254 dobava ograje' } // mlajši POTEKEL
  return { datum: aktivenDatum(), opis: 'E2E R254 pregled v tem tednu' } // Andrej Kokalj — AKTIVEN
}

async function main() {
  await c.connect()
  const mode = process.argv[2] || 'fp'

  if (mode === 'seed') {
    const orig = await c.query(
      `SELECT ime, "opomnikDatum", "opomnikOpis" FROM "Customer" WHERE ime = ANY($1)`,
      [CILJI],
    )
    if (orig.rows.length !== CILJI.length) {
      throw new Error(`seed: pričakovani ${CILJI.length} stranki, najdenih ${orig.rows.length}`)
    }
    require('fs').writeFileSync(ORIGINAL, JSON.stringify(orig.rows))
    for (const ime of CILJI) {
      const s = seedZa(ime)
      await c.query(
        `UPDATE "Customer" SET "opomnikDatum" = $2, "opomnikOpis" = $3 WHERE ime = $1`,
        [ime, s.datum, s.opis],
      )
    }
    console.log(JSON.stringify({ seeded: true, stranke: CILJI, seedi: Object.fromEntries(CILJI.map((i) => [i, seedZa(i)])), originali: orig.rows }))
  } else if (mode === 'restore') {
    const origi = JSON.parse(require('fs').readFileSync(ORIGINAL, 'utf8'))
    for (const o of origi) {
      await c.query(
        `UPDATE "Customer" SET "opomnikDatum" = $2, "opomnikOpis" = $3 WHERE ime = $1`,
        [o.ime, o['opomnikDatum'], o['opomnikOpis']],
      )
    }
    console.log(JSON.stringify({ restored: true, originali: origi }))
  } else if (mode === 'fp') {
    const cnt = await c.query(
      `SELECT (SELECT COUNT(*) FROM "Inventory") AS inv,
              (SELECT COUNT(*) FROM "Inventory" WHERE "kolicinaZaloga" <= "minimalnaZaloga") AS pod,
              (SELECT COUNT(*) FROM "Inventory" WHERE "kolicinaZaloga" = "minimalnaZaloga") AS na,
              (SELECT COUNT(*) FROM "MaterialOrder") AS narocila,
              (SELECT COUNT(*) FROM "Supplier") AS dobavitelji,
              (SELECT COUNT(*) FROM "MaterialPrice") AS cene,
              (SELECT COUNT(*) FROM "Project") AS projekti,
              (SELECT COUNT(*) FROM "Invoice") AS racuni,
              (SELECT COUNT(*) FROM "Customer") AS stranke`,
    )
    const stranke = await c.query(
      `SELECT ime, status, "opomnikDatum", "opomnikOpis" FROM "Customer" ORDER BY ime`,
    )
    const sup = await c.query(`SELECT * FROM "Supplier" ORDER BY id`)
    const cene = await c.query(`SELECT * FROM "MaterialPrice" ORDER BY id`)
    console.log(JSON.stringify({
      stevci: cnt.rows[0],
      strankeVrstice: stranke.rows,
      supplierVrstice: sup.rows,
      ceneVrstice: cene.rows,
    }))
  } else {
    throw new Error(`neznan način: ${mode}`)
  }
  await c.end()
}

main().catch((e) => {
  console.error('R254 DB FAIL:', e.message)
  process.exit(1)
})
