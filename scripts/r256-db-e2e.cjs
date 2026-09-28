// R256 — DB seed/restore + bajtni prstni odtis za E2E (lokalni dev DB, port 5433).
// UPORABA:
//   node scripts/r256-db-e2e.cjs seed      — vstavi 5 terminov montaže z
//                                            EKSPLICITNIMI id-ji ('e2e-r256-t1…t5';
//                                            tekstovni cuid stolpec — sekvenc ni,
//                                            DELETE restore = bajtnata identičnost):
//                                            1× ZAKLJUČENO (včeraj, 09:00–13:00, 4 h
//                                              — TEDENSKI okno VEN, vozni red NOTER),
//                                            1× V_TEKU (danes, 07:00–15:30, 8 h),
//                                            1× NAVRTENO (zdaj+2 dni, 08:00–16:00, 6 h),
//                                            1× PREKlicANO (zdaj+5 dni, 07:30–15:30, 3 h
//                                              — iskren VIDEN odpad),
//                                            1× NAVRTENO (zdaj+6 dni, 08:00–12:00, 4 h
//                                              — TEDENSKI okno ZADNJI dan)
//                                            — vsi crewId NULL (dev DB brez ekip —
//                                            iskrena '—' resnica na listu).
//   node scripts/r256-db-e2e.cjs restore   — DELETE vseh 'e2e-r256-%' vrstic
//   node scripts/r256-db-e2e.cjs fp        — bajtni prstni odtis (JSON) — pre==post
//                                            MORA biti IDENTIČEN (ZERO-MUTACIJA)
// Prstni odtis = R254 števci + InstallationSchedule polna resnica (VSE vrstice).
// RAW SQL (NE Prisma) — updatedAt se NE premakne, restore = bajtnata identičnost.
const { Client } = require('pg')

const c = new Client({
  host: 'localhost',
  port: 5433,
  user: 'roksal',
  password: 'roksal',
  database: 'roksal_dev',
})

const ID_PREDPONA = 'e2e-r256-'

function danOb(enUr, odmikDni) {
  const d = new Date(Date.now() + odmikDni * 86400000)
  const iso = d.toISOString()
  const datum = iso.slice(0, 10)
  return `${datum} ${String(enUr).padStart(2, '0')}:00:00`
}

// Projekti po nazivu (deterministično — dev DB 3 projekti; najdeni ob seedu).
// R255 LEKCIJA (E2E diag): aplikacija po prijavi SAMODEJNO izbere prvi projekt
// (Kokalj — prvi po nazivu ASC) → logistika je PROJEKTNO OBSEGOVANA
// (?projectId=). VSI seed termini gredo ZATO na ISTI projekt — sicer summary
// točno (iskreno) pokaže samo projektni podmnožico.
const PROJEKTI = {
  kokalj: 'Ograja Kokalj - Balustrada',
  novak: 'Ograja Novak - Balkon 3.nadstropje',
  zupan: 'Terasa Zupan - WPC deske',
}

async function projektniIdi() {
  const nazivi = Object.values(PROJEKTI)
  const r = await c.query(`SELECT id, "nazivProjekta" FROM "Project" WHERE "nazivProjekta" = ANY($1)`, [nazivi])
  if (r.rows.length !== nazivi.length) {
    throw new Error(`seed: pričakovani ${nazivi.length} projekti, najdenih ${r.rows.length}`)
  }
  const poNazivu = {}
  for (const row of r.rows) poNazivu[row.nazivProjekta] = row.id
  return poNazivu
}

function terminVrstice(poNazivu) {
  const k = poNazivu[PROJEKTI.kokalj]
  return [
    // t1 — ZAKLJUČENO, včeraj 09:00–13:00, 4 h (KPI GREEN resnica)
    { id: `${ID_PREDPONA}t1`, projekt: k, zacetek: danOb(9, -1), konec: `${danOb(9, -1).slice(0, 11)}13:00:00`, status: 'ZAKLJUCENO', ure: 4, lokacija: 'Cesta Republike 14, Kranj', opomba: 'E2E R256 zaključen termin' },
    // t2 — V_TEKU, danes 07:00–15:30, 8 h (KPI AMBER delo v teku)
    { id: `${ID_PREDPONA}t2`, projekt: k, zacetek: danOb(7, 0), konec: `${danOb(7, 0).slice(0, 11)}15:30:00`, status: 'V_TEKU', ure: 8, lokacija: null, opomba: 'E2E R256 v teku' },
    // t3 — NAVRTENO, zdaj+2 dni 08:00–16:00, 6 h (datumKonca je NOT NULL v
    // bazi — schema vedno nastavi konec; lib null-konec pot ostaja pokrita z
    // enotnimi testi kot defenzivna resnica)
    { id: `${ID_PREDPONA}t3`, projekt: k, zacetek: danOb(8, 2), konec: `${danOb(8, 2).slice(0, 11)}16:00:00`, status: 'NAVRTENO', ure: 6, lokacija: 'Kranjska 12, Bled', opomba: 'E2E R256 načrtovan' },
    // t4 — PREKlicANO, zdaj+5 dni 07:30–15:30, 3 h (iskren VIDEN odpad)
    { id: `${ID_PREDPONA}t4`, projekt: k, zacetek: `${danOb(7, 5).slice(0, 11)}07:30:00`, konec: `${danOb(7, 5).slice(0, 11)}15:30:00`, status: 'PREKlicANO', ure: 3, lokacija: null, opomba: 'E2E R256 preklican' },
    // t5 — NAVRTENO, zdaj+6 dni 08:00–12:00, 4 h (TEDENSKI okno ZADNJI dan —
    // danes+6 UTC; tedenski razgled: 4 termini / 4 dni / 21 h / 0 brez ure /
    // 1 preklican; vozni red R255: 5 terminov vključno včerajšnjim = DVE
    // iskreni resnici vsako svoje dokumento — R255 lekcija 7)
    { id: `${ID_PREDPONA}t5`, projekt: k, zacetek: danOb(8, 6), konec: `${danOb(8, 6).slice(0, 11)}12:00:00`, status: 'NAVRTENO', ure: 4, lokacija: 'Cesta 15, Bled', opomba: 'E2E R256 okno rob' },
  ]
}

async function main() {
  await c.connect()
  const mode = process.argv[2] || 'fp'

  if (mode === 'seed') {
    const poNazivu = await projektniIdi()
    // idempotentnost: starejši e2e-r255 ostanki IZBRANI pred vstavljanjem
    await c.query(`DELETE FROM "InstallationSchedule" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    for (const t of terminVrstice(poNazivu)) {
      await c.query(
        `INSERT INTO "InstallationSchedule"
           (id, "projectId", "datumZacetka", "datumKonca", status, "predvideneUre", lokacija, opombe, "createdAt", "updatedAt")
         VALUES ($1, $2, $3::timestamp, $4::timestamp, $5, $6, $7, $8, $3::timestamp, $3::timestamp)`,
        [t.id, t.projekt, t.zacetek, t.konec, t.status, t.ure, t.lokacija, t.opomba],
      )
    }
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "InstallationSchedule" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ seeded: true, vstavljenih: n.rows[0].n }))
  } else if (mode === 'restore') {
    await c.query(`DELETE FROM "InstallationSchedule" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "InstallationSchedule" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ restored: true, ostankov: n.rows[0].n }))
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
              (SELECT COUNT(*) FROM "Customer") AS stranke,
              (SELECT COUNT(*) FROM "InstallationSchedule") AS termini`,
    )
    const stranke = await c.query(
      `SELECT ime, status, "opomnikDatum", "opomnikOpis" FROM "Customer" ORDER BY ime`,
    )
    const termini = await c.query(
      `SELECT id, "projectId", "datumZacetka", "datumKonca", status, "predvideneUre", "dejanskeUre", lokacija, opombe
         FROM "InstallationSchedule" ORDER BY id`,
    )
    const sup = await c.query(`SELECT * FROM "Supplier" ORDER BY id`)
    const cene = await c.query(`SELECT * FROM "MaterialPrice" ORDER BY id`)
    console.log(JSON.stringify({
      stevci: cnt.rows[0],
      strankeVrstice: stranke.rows,
      terminiVrstice: termini.rows,
      supplierVrstice: sup.rows,
      ceneVrstice: cene.rows,
    }))
  } else {
    throw new Error(`neznan način: ${mode}`)
  }
  await c.end()
}

main().catch((e) => {
  console.error('R256 DB FAIL:', e.message)
  process.exit(1)
})
