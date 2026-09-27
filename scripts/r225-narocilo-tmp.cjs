// R225 E2E pomočnik — ZAČASNO odpre 1 MaterialOrder (status POSLANO) pri
// začasnem dobavitelju, da je vodjin pregled pokazal harmonizirano navy
// kartico 'odprtih naročil' (R225 — informacija, ne alarm). ZERO-MUTACIJA
// končnega stanja: restore zbriše TOČNO ta naročilo (guard: števec 1 za
// začasnega dobavitelja) + začasnega dobavitelja (guard: 0 cen, 0 naročil).
// Uporaba:
//   node scripts/r225-narocilo-tmp.cjs raise | restore
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

const DOBAVITELJ = 'R225-TMP-DOBAVITELJ (E2E)'

async function main() {
  const mode = process.argv[2]
  if (mode === 'raise') {
    const obstojec = await db.supplier.findUnique({
      where: { naziv: DOBAVITELJ },
      include: { _count: { select: { orders: true } } },
    })
    if (obstojec) {
      throw new Error(`${DOBAVITELJ}: že obstaja — bazno stanje ni čisto, PREKINJAM`)
    }
    await db.$transaction(async (tx) => {
      const sup = await tx.supplier.create({ data: { naziv: DOBAVITELJ } })
      await tx.materialOrder.create({
        data: { supplierId: sup.id, status: 'POSLANO', skupajCena: 0, opombe: 'R225 E2E začasno naročilo' },
      })
    })
    console.log(`RAISE OK — 1 naročilo POSLANO pri ${DOBAVITELJ} (odprta naročila +1)`)
  } else if (mode === 'restore') {
    const sup = await db.supplier.findUnique({
      where: { naziv: DOBAVITELJ },
      include: { _count: { select: { orders: true, materialPrices: true } } },
    })
    if (!sup) {
      throw new Error(`${DOBAVITELJ}: ne obstaja — raise stanja ni več, PREKINJAM`)
    }
    if (sup._count.orders !== 1) {
      throw new Error(`${DOBAVITELJ}: ${sup._count.orders} naročil (pričakovano 1) — tujek vstopil, PREKINJAM`)
    }
    if (sup._count.materialPrices !== 0) {
      throw new Error(`${DOBAVITELJ}: ${sup._count.materialPrices} cen (pričakovano 0) — tujek vstopil, PREKINJAM`)
    }
    await db.$transaction(async (tx) => {
      await tx.materialOrder.deleteMany({ where: { supplierId: sup.id } })
      await tx.supplier.delete({ where: { id: sup.id } })
    })
    const po = await db.supplier.count({ where: { naziv: DOBAVITELJ } })
    if (po !== 0) throw new Error('restore: dobavitelj še vedno obstaja — PREKINJAM')
    console.log('RESTORE OK — začasno naročilo + dobavitelj izbrisana (bajtnato)')
  } else {
    throw new Error('uporaba: raise | restore')
  }
  await db.$disconnect()
}

main().catch((e) => {
  console.error('NAPAKA:', e.message)
  db.$disconnect().finally(() => process.exit(1))
})
