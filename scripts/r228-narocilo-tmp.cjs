// R228 E2E pomočnik — ZAČASNO odpre 1 MaterialOrder (status POSLANO,
// datumDobave VČERAJ — izrecno zamujena obljuba), da vodjin pregled pokaže
// kartico 'Zamujena dobava' (R228 — nova tema). Vzorec r225-narocilo-tmp.
// ZERO-MUTACIJA končnega stanja: restore zbriše TOČNO ta naročilo (guard:
// števec 1 za začasnega dobavitelja) + začasnega dobavitelja (guard: 0 cen,
// 0 naročil).
// Uporaba:
//   node scripts/r228-narocilo-tmp.cjs raise | restore
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

const DOBAVITELJ = 'R228-TMP-DOBAVITELJ (E2E)'
const OPOMBE = 'R228 E2E začasno zamujeno naročilo'

function vcerajDate() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  d.setHours(12, 0, 0, 0)
  return d
}

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
        data: {
          supplierId: sup.id,
          status: 'POSLANO',
          skupajCena: 0,
          opombe: OPOMBE,
          datumDobave: vcerajDate(),
        },
      })
    })
    console.log(`RAISE OK — 1 naročilo POSLANO z datumDobave včeraj pri ${DOBAVITELJ} (zamujeneDobave +1)`)
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
    // Guard 3: naročilo mora biti NAŠE (opombe + datumDobave pretekel) —
    // nikoli ne brišemo tujega naročila.
    const naso = await db.materialOrder.findFirst({
      where: { supplierId: sup.id, opombe: OPOMBE, status: 'POSLANO' },
    })
    if (!naso) {
      throw new Error(`${DOBAVITELJ}: začasnega naročila ni mogoče identificirati (opombe/status) — PREKINJAM`)
    }
    if (!naso.datumDobave || naso.datumDobave.getTime() >= Date.now()) {
      throw new Error(`${DOBAVITELJ}: datumDobave NI pretekel — nepričakovano stanje, PREKINJAM`)
    }
    await db.$transaction(async (tx) => {
      await tx.materialOrder.deleteMany({ where: { supplierId: sup.id } })
      await tx.supplier.delete({ where: { id: sup.id } })
    })
    const po = await db.supplier.count({ where: { naziv: DOBAVITELJ } })
    if (po !== 0) throw new Error('restore: dobavitelj še vedno obstaja — PREKINJAM')
    console.log('RESTORE OK — začasno zamujeno naročilo + dobavitelj izbrisana (bajtnato)')
  } else {
    throw new Error('uporaba: raise | restore')
  }
  await db.$disconnect()
}

main().catch((e) => {
  console.error('NAPAKA:', e.message)
  db.$disconnect().finally(() => process.exit(1))
})
