/* R136 §18 — pregled obstoječih podatkov pred dodajanjem DB omejitev.
 * Samo branje. Ugotovi, če katerikoli nova CHECK/EXCLUDE constraint bi bil
 * kršen s sedanjimi podatki (fail-closed: najprej vemo, nato dodamo). */
const { Client } = require('pg')

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  const q = async (label, sql) => {
    const r = await client.query(sql)
    console.log(`--- ${label}: ${r.rowCount} vrstic`)
    for (const row of r.rows) console.log('   ', JSON.stringify(row))
    return r
  }

  // 1. MaterialPrice — prekrivanje veljavnosti znotraj (inventoryId, supplierId)
  await q(
    'PREKRIVANJA MaterialPrice (expect 0)',
    `SELECT a."inventoryId", a."supplierId", a.id AS a_id, a."veljavnostOd" AS a_od, a."veljavnostDo" AS a_do,
            b.id AS b_id, b."veljavnostOd" AS b_od, b."veljavnostDo" AS b_do
     FROM "MaterialPrice" a JOIN "MaterialPrice" b
       ON a."inventoryId" = b."inventoryId" AND a."supplierId" = b."supplierId" AND a.id < b.id
      AND tstzrange(a."veljavnostOd", a."veljavnostDo", '[)') && tstzrange(b."veljavnostOd", b."veljavnostDo", '[)')`,
  )

  // 2. Negativne / ničelne vrednosti
  await q('Inventory negativne (expect 0)', `SELECT id, "kolicinaZaloga", "minimalnaZaloga" FROM "Inventory" WHERE "kolicinaZaloga" < 0 OR "minimalnaZaloga" < 0`)
  await q('MaterialOrderItem neveljavni (expect 0)', `SELECT id, "kolicina", "cena" FROM "MaterialOrderItem" WHERE "kolicina" <= 0 OR "cena" < 0`)
  await q('MaterialUsage neveljavni (expect 0)', `SELECT id, "porabljenaKolicina" FROM "MaterialUsage" WHERE "porabljenaKolicina" <= 0`)
  await q('MaterialPrice negativne cene (expect 0)', `SELECT id, "cena" FROM "MaterialPrice" WHERE "cena" < 0`)

  // 3. Invoice — vrednosti statusov/tipov + negativni zneski
  await q('Invoice statusi (različni)', `SELECT DISTINCT "status" FROM "Invoice"`)
  await q('Invoice tipi (različni)', `SELECT DISTINCT "tip" FROM "Invoice"`)
  await q('Invoice negativni zneski (expect 0)', `SELECT id, "osnova", "ddv", "znesek", "rokPlacilaDni" FROM "Invoice" WHERE "osnova" < 0 OR "ddv" < 0 OR "znesek" < 0 OR "rokPlacilaDni" < 0`)

  // 4. MaterialOrder statusi
  await q('MaterialOrder statusi (različni)', `SELECT DISTINCT "status" FROM "MaterialOrder"`)
  await q('MaterialOrder negativne cene (expect 0)', `SELECT id, "skupajCena" FROM "MaterialOrder" WHERE "skupajCena" < 0`)

  // 5. btree_gist extension (za EXCLUDE)
  await q('btree_gist obstoji?', `SELECT extname FROM pg_extension WHERE extname = 'btree_gist'`)

  await client.end()
}

main().catch((e) => {
  console.error('AUDIT FAILED:', e.message)
  process.exit(1)
})
