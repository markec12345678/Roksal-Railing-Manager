// R257 — DB seed/restore + bajtni prstni odtis za E2E (lokalni dev DB, port 5433).
// UPORABA:
//   node scripts/r257-db-e2e.cjs seed      — vstavi 1 dobavitelja + 6 naročil
//                                            (+6 postavk) z EKSPLICITNIMI id-ji
//                                            ('e2e-r257-o1…o6'; tekstovni cuid
//                                            stolpec — sekvenc ni, DELETE
//                                            restore = bajtnata identičnost):
//                                            o1 OSNUTEK, obljuba 3 dni PREJ →
//                                              ZAMUJEN žig (odprt + pretekel),
//                                            o2 POSLANO, obljuba +5 dni,
//                                            o3 POTRJENO, obljuba NULL ('—'),
//                                            o4 DOBLJENO, obljuba včeraj (zaprto
//                                              stanje — NIKOLI žig),
//                                            o5 PREKlicANO, obljuba 2 dni prej
//                                              (iskren odpad — izključen iz
//                                              vrednostne vsote, 999.99),
//                                            o6 OSNUTEK, obljuba +1 dan,
//                                              opombe NULL, 0 postavk (iskren 0).
//                                            Pričakovani toast agregat:
//                                            '6 naročil, odprtih 4, pretekel
//                                            rok 1, vrednost ne-preklicanih
//                                            2125.49 €.'
//   node scripts/r257-db-e2e.cjs restore   — DELETE vseh 'e2e-r257-%' vrstic
//   node scripts/r257-db-e2e.cjs fp        — bajtni prstni odtis (JSON) — pre==post
//                                            MORA biti IDENTIČEN (ZERO-MUTACIJA)
// Prstni odtis = R256 števci + MaterialOrder/MaterialOrderItem/Supplier POLNA
// resnica (VSE vrstice — to rundo MUTIRAMO, zato so v odtisu).
// RAW SQL (NE Prisma) — updatedAt se NE premakne, restore = bajtnata identičnost.
const { Client } = require('pg')

const c = new Client({
  host: 'localhost',
  port: 5433,
  user: 'roksal',
  password: 'roksal',
  database: 'roksal_dev',
})

const ID_PREDPONA = 'e2e-r257-'

function danOb(enUr, odmikDni) {
  const d = new Date(Date.now() + odmikDni * 86400000)
  const iso = d.toISOString()
  const datum = iso.slice(0, 10)
  return `${datum} ${String(enUr).padStart(2, '0')}:00:00`
}

async function najdiInventar(naziv) {
  const r = await c.query(`SELECT id FROM "Inventory" WHERE naziv = $1`, [naziv])
  if (r.rows.length !== 1) throw new Error(`seed: pričakovan 1 inventar '${naziv}', najdenih ${r.rows.length}`)
  return r.rows[0].id
}

async function main() {
  await c.connect()
  const mode = process.argv[2] || 'fp'

  if (mode === 'seed') {
    // idempotentnost: starejši e2e-r257 ostanki IZBRANI pred vstavljanjem
    await c.query(`DELETE FROM "MaterialOrder" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    await c.query(`DELETE FROM "Supplier" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const invProfil = await najdiInventar('Alu Profil 40x40')
    const invTesnilo = await najdiInventar('EPDM Tesnilo 10mm')
    await c.query(
      `INSERT INTO "Supplier"
         (id, naziv, kontakt, email, telefon, "dobavniRok", popust, aktivna, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
      [`${ID_PREDPONA}sup1`, 'E2E R257 Dobavitelj', 'E2E Kontakt', 'e2e-r257@roksal.si', '+386 4 000 000', 7, 0, true],
    )
    const sup = `${ID_PREDPONA}sup1`
    // 6 naročil — EKSPLICITNI datumNarocila/updatedAt (raw SQL: NOT NULL createdAt/updatedAt)
    const naročila = [
      { id: `${ID_PREDPONA}o1`, status: 'OSNUTEK', cena: 450.5, narocilo: danOb(10, -3), dobava: danOb(10, -6), opombe: 'E2E R257 zamujena obljuba' },
      { id: `${ID_PREDPONA}o2`, status: 'POSLANO', cena: 1200, narocilo: danOb(12, -1), dobava: danOb(12, 5), opombe: null },
      { id: `${ID_PREDPONA}o3`, status: 'POTRJENO', cena: 89.99, narocilo: danOb(9, -2), dobava: null, opombe: null },
      { id: `${ID_PREDPONA}o4`, status: 'DOBLJENO', cena: 310, narocilo: danOb(8, -4), dobava: danOb(8, -1), opombe: null },
      { id: `${ID_PREDPONA}o5`, status: 'PREKlicANO', cena: 999.99, narocilo: danOb(7, -6), dobava: danOb(7, -2), opombe: 'E2E R257 preklicano — izključeno iz vsote' },
      { id: `${ID_PREDPONA}o6`, status: 'OSNUTEK', cena: 75, narocilo: danOb(11, 0), dobava: danOb(11, 1), opombe: null },
    ]
    for (const n of naročila) {
      await c.query(
        `INSERT INTO "MaterialOrder"
           (id, "supplierId", status, "skupajCena", "datumNarocila", "datumDobave", opombe, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5::timestamp, $6::timestamp, $7, $5::timestamp, $5::timestamp)`,
        [n.id, sup, n.status, n.cena, n.narocilo, n.dobava, n.opombe],
      )
    }
    const postavke = [
      { id: `${ID_PREDPONA}i1`, order: `${ID_PREDPONA}o1`, inv: invProfil, kolicina: 6, cena: 60.5, naziv: 'Alu Profil 40x40', enota: 'm' },
      { id: `${ID_PREDPONA}i2`, order: `${ID_PREDPONA}o1`, inv: invTesnilo, kolicina: 2, cena: 64.75, naziv: 'EPDM Tesnilo 10mm', enota: 'm' },
      { id: `${ID_PREDPONA}i3`, order: `${ID_PREDPONA}o2`, inv: invProfil, kolicina: 6, cena: 200, naziv: 'Alu Profil 40x40', enota: 'm' },
      { id: `${ID_PREDPONA}i4`, order: `${ID_PREDPONA}o3`, inv: invTesnilo, kolicina: 1, cena: 89.99, naziv: 'EPDM Tesnilo 10mm', enota: 'm' },
      { id: `${ID_PREDPONA}i5`, order: `${ID_PREDPONA}o4`, inv: invProfil, kolicina: 1, cena: 310, naziv: 'Alu Profil 40x40', enota: 'm' },
      { id: `${ID_PREDPONA}i6`, order: `${ID_PREDPONA}o5`, inv: invTesnilo, kolicina: 2, cena: 499.995, naziv: 'EPDM Tesnilo 10mm', enota: 'm' },
    ]
    for (const p of postavke) {
      await c.query(
        `INSERT INTO "MaterialOrderItem"
           (id, "orderId", "inventoryId", kolicina, cena, naziv, enota, "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [p.id, p.order, p.inv, p.kolicina, p.cena, p.naziv, p.enota],
      )
    }
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "MaterialOrder" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const ni = await c.query(`SELECT COUNT(*)::int AS n FROM "MaterialOrderItem" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ seeded: true, narocil: n.rows[0].n, postavk: ni.rows[0].n }))
  } else if (mode === 'restore') {
    // items gredo po cascade, vendar eksplicitno za dokazljivost
    await c.query(`DELETE FROM "MaterialOrderItem" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    await c.query(`DELETE FROM "MaterialOrder" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    await c.query(`DELETE FROM "Supplier" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "MaterialOrder" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const s = await c.query(`SELECT COUNT(*)::int AS n FROM "Supplier" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ restored: true, ostankovNarocil: n.rows[0].n, ostankovDobaviteljev: s.rows[0].n }))
  } else if (mode === 'fp') {
    const cnt = await c.query(
      `SELECT (SELECT COUNT(*) FROM "Inventory") AS inv,
              (SELECT COUNT(*) FROM "MaterialOrder") AS narocila,
              (SELECT COUNT(*) FROM "MaterialOrderItem") AS postavke,
              (SELECT COUNT(*) FROM "Supplier") AS dobavitelji,
              (SELECT COUNT(*) FROM "MaterialPrice") AS cene,
              (SELECT COUNT(*) FROM "Project") AS projekti,
              (SELECT COUNT(*) FROM "Invoice") AS racuni,
              (SELECT COUNT(*) FROM "Customer") AS stranke,
              (SELECT COUNT(*) FROM "InstallationSchedule") AS termini`,
    )
    const narocila = await c.query(
      `SELECT id, "supplierId", status, "skupajCena", "datumNarocila", "datumDobave", opombe, "createdAt", "updatedAt"
         FROM "MaterialOrder" ORDER BY id`,
    )
    const postavke = await c.query(
      `SELECT id, "orderId", "inventoryId", kolicina, cena, naziv, enota, "createdAt"
         FROM "MaterialOrderItem" ORDER BY id`,
    )
    const sup = await c.query(`SELECT * FROM "Supplier" ORDER BY id`)
    const cene = await c.query(`SELECT * FROM "MaterialPrice" ORDER BY id`)
    const stranke = await c.query(
      `SELECT ime, status, "opomnikDatum", "opomnikOpis" FROM "Customer" ORDER BY ime`,
    )
    console.log(JSON.stringify({
      stevci: cnt.rows[0],
      narocilaVrstice: narocila.rows,
      postavkeVrstice: postavke.rows,
      supplierVrstice: sup.rows,
      ceneVrstice: cene.rows,
      strankeVrstice: stranke.rows,
    }))
  } else {
    throw new Error(`neznan način: ${mode}`)
  }
  await c.end()
}

main().catch((e) => {
  console.error('R257 DB FAIL:', e.message)
  process.exit(1)
})
