// R231 E2E pomočnik — ZAČASNO odpre 1 MaterialOrder (status POSLANO,
// datumDobave VČERAJ — izrecno zamujena obljuba) z 1 POSTAVKO (snapshot
// naziv/enota iz obstoječega artikla po šifri), da Material → Naročila CSV
// izvoz pokaže vrstico s stolpcem 'Pretekel rok','DA' (R231 — ENAJSTI
// signalec konvergence). Vzorec r228-narocilo-tmp (ZERO-MUTACIJA guardi).
// Razlika proti r228: ta naročilo IMA postavko (CSV je per postavka — brez
// postavke ni vrstice, brez vrstice ni dokaza).
// Uporaba:
//   node scripts/r231-narocilo-tmp.cjs raise | restore
//   (opcijsko EB_ARTIKEL_SIFRA='WPC-120-A' — privzeto WPC-120-A)
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

const DOBAVITELJ = 'R231-TMP-DOBAVITELJ (E2E)'
const OPOMBE = 'R231 E2E začasno zamujeno naročilo s postavko'
const ARTIKEL_SIFRA = process.env.EB_ARTIKEL_SIFRA || 'WPC-120-A'

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
    const artikel = await db.inventory.findUnique({
      where: { sifraMateriala: ARTIKEL_SIFRA },
      select: { id: true, naziv: true, enota: true },
    })
    if (!artikel) {
      throw new Error(`Artikel ${ARTIKEL_SIFRA}: ne obstaja (EB_ARTIKEL_SIFRA) — PREKINJAM`)
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
          items: {
            create: [
              {
                inventoryId: artikel.id,
                kolicina: 2,
                cena: 0,
                naziv: artikel.naziv,
                enota: artikel.enota,
              },
            ],
          },
        },
      })
    })
    console.log(`RAISE OK — 1 naročilo POSLANO (datumDobave včeraj) + 1 postavka (${ARTIKEL_SIFRA}) pri ${DOBAVITELJ}`)
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
    // Guard 3: naročilo mora biti NAŠE (opombe + status + TOČNO 1 postavka
    // z našim snapshotom) — nikoli ne brišemo tujega naročila.
    const naso = await db.materialOrder.findFirst({
      where: { supplierId: sup.id, opombe: OPOMBE, status: 'POSLANO' },
      include: { items: { select: { naziv: true, kolicina: true, cena: true } } },
    })
    if (!naso) {
      throw new Error(`${DOBAVITELJ}: začasnega naročila ni mogoče identificirati (opombe/status) — PREKINJAM`)
    }
    if (naso.items.length !== 1 || naso.items[0].kolicina !== 2 || naso.items[0].cena !== 0) {
      throw new Error(`${DOBAVITELJ}: postavka ni v naši znani obliki (1 × količina 2, cena 0) — PREKINJAM`)
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
    console.log('RESTORE OK — začasno naročilo (+postavka) + dobavitelj izbrisana (bajtnato)')
  } else {
    throw new Error('uporaba: raise | restore')
  }
  await db.$disconnect()
}

main().catch((e) => {
  console.error('NAPAKA:', e.message)
  db.$disconnect().finally(() => process.exit(1))
})
