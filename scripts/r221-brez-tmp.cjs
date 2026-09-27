// R221 E2E pomožnik — ZAČASNO zasidra ceno WPC-120-A pri začasnem
// dobavitelju (determinističen prehod 'brez dobavitelja' 8 → 7 artiklov;
// WPC_deska tip: 2 → 1 vrstica s čipom). ZERO-MUTACIJA končnega stanja:
// restore zbriše TEMPERATURNO ceno + dobavitelja (guarda na točno 1/1),
// artikli in njihove zaloge se NETIKAJO. Uporaba:
//   node scripts/r221-brez-tmp.cjs raise | restore
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

const DOBAVITELJ = 'R221-TMP-DOBAVITELJ (E2E)'
const SIFRA = 'WPC-120-A'
const CENA = 1.23

async function main() {
  const mode = process.argv[2]
  if (mode === 'raise') {
    const artikel = await db.inventory.findUniqueOrThrow({
      where: { sifraMateriala: SIFRA },
      select: { id: true, _count: { select: { prices: true } } },
    })
    if (artikel._count.prices !== 0) {
      throw new Error(`${SIFRA}: ima že ${artikel._count.prices} cen — bazno stanje ni 'brez cene', PREKINJAM`)
    }
    const obstojec = await db.supplier.findUnique({ where: { naziv: DOBAVITELJ } })
    if (obstojec) {
      throw new Error(`${DOBAVITELJ}: že obstaja — bazno stanje ni čisto, PREKINJAM`)
    }
    await db.$transaction(async (tx) => {
      const sup = await tx.supplier.create({ data: { naziv: DOBAVITELJ } })
      await tx.materialPrice.create({
        data: { inventoryId: artikel.id, supplierId: sup.id, cena: CENA },
      })
    })
    console.log(`RAISE OK — ${SIFRA} dobi 1 ceno pri ${DOBAVITELJ} ('brez dobavitelja' 8 → 7)`)
  } else if (mode === 'restore') {
    const sup = await db.supplier.findUnique({
      where: { naziv: DOBAVITELJ },
      include: { _count: { select: { materialPrices: true } } },
    })
    if (!sup) {
      throw new Error(`${DOBAVITELJ}: ne obstaja — raise stanja ni več, PREKINJAM`)
    }
    if (sup._count.materialPrices !== 1) {
      throw new Error(`${DOBAVITELJ}: ${sup._count.materialPrices} cen (pričakovano 1) — tujek vstopil, PREKINJAM`)
    }
    await db.$transaction(async (tx) => {
      await tx.materialPrice.deleteMany({ where: { supplierId: sup.id } })
      await tx.supplier.delete({ where: { id: sup.id } })
    })
    const po = await db.supplier.count({ where: { naziv: DOBAVITELJ } })
    if (po !== 0) throw new Error('restore: dobavitelj še vedno obstaja — PREKINJAM')
    console.log('RESTORE OK — začasna cena + dobavitelj izbrisana (bajtnato)')
  } else {
    throw new Error('uporaba: raise | restore')
  }
  await db.$disconnect()
}

main().catch((e) => {
  console.error('NAPAKA:', e.message)
  db.$disconnect().finally(() => process.exit(1))
})
