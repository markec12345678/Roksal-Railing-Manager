// R140 — seed naročila v LOKALNI dev bazi (roksal_dev) za brskalniški E2E
// Material Intelligence → Naročila (CSV + razprte postavke). DEV ONLY.
const { PrismaClient } = require('@prisma/client')

async function main() {
  const db = new PrismaClient({
    datasources: { db: { url: 'postgresql://roksal:roksal@localhost:5433/roksal_dev' } },
  })
  const supplier = await db.supplier.upsert({
    where: { naziv: 'Dobavitelj R140 Test' },
    update: {},
    create: { naziv: 'Dobavitelj R140 Test', kontakt: 'Janez Test', telefon: '041 234 567', dobavniRok: 5, popust: 3, aktivna: true },
  })
  const inv = await db.inventory.findFirst({ where: { naziv: { contains: 'Inox', mode: 'insensitive' } } })
  if (!inv) throw new Error('ni Inox artikla v dev bazi')
  const existing = await db.materialOrder.findFirst({ where: { supplierId: supplier.id } })
  if (existing) {
    console.log('order že obstaja:', existing.id)
    await db.$disconnect()
    return
  }
  // dve postavki (isti artikel, različni količini) za prikaz razpritih vrstic
  const items = [
    { inventoryId: inv.id, kolicina: 50, cena: 0.35, naziv: inv.naziv, enota: inv.enota },
    { inventoryId: inv.id, kolicina: 120, cena: 0.29, naziv: inv.naziv, enota: inv.enota },
  ]
  const skupajCena = items.reduce((s, i) => s + i.cena * i.kolicina, 0)
  const order = await db.materialOrder.create({
    data: {
      supplierId: supplier.id,
      skupajCena,
      opombe: 'R140 E2E — testno naročilo (dev)',
      status: 'OSNUTEK',
      items: { create: items },
    },
  })
  console.log('created order:', order.id, 'skupajCena:', skupajCena)
  await db.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
