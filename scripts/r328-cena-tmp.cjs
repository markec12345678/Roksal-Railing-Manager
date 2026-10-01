// R328 E2E pomožnik — ZAČASNO zasidra ZGODOVINO CEN (zaprt + odprt vnos) za
// WPC-120-A pri začasnem dobavitelju — ŽIVO pokrije panel zgodovine cen IN
// panel primerjave dobaviteljev (55. člen) z resničnimi podatki (do zdaj je
// lokalna E2E baza poznala SAMO iskreno prazno vejo — Z0au). Deterministični
// ISO časi (fiksni nizi — nič Date.now). ZERO-MUTACIJA končnega stanja:
// restore zbriše TEMPERATURNI vpisi + dobavitelja (guarda na točno 2/0),
// artikli in ostale cene se NETIKAJO. Uporaba:
//   node scripts/r328-cena-tmp.cjs raise | restore
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

const DOBAVITELJ = 'R328-TMP-DOBAVITELJ (E2E)'
const SIFRA = 'WPC-120-A'
const STARA_CENA = 10.0
const NOVA_CENA = 12.5
// fiksni ISO nizi (determinizem — EXCLUDE material_price_no_overlap:
// [od, do) se dotika [do, ∞) — mejni stik je dovoljen, kanon R136 §19)
const OD_STARE = '2026-01-01T00:00:00.000Z'
// veljavnostDo zaprtega = veljavnostOd odprtega (isti fiksni trenutek)
const MEJA = new Date('2026-02-01T00:00:00.000Z')

// ODTIS bazne resnice prej (Z0au kanon: lokalna E2E baza je 0-vrstična,
// a guard brani REALNO stanje — pre==post, nič trdih pričakovanj)
async function odtisCen() {
  return db.materialPrice.count()
}

async function main() {
  const mode = process.argv[2]
  if (mode === 'raise') {
    const prej = await odtisCen()
    const artikel = await db.inventory.findUniqueOrThrow({
      where: { sifraMateriala: SIFRA },
      select: { id: true },
    })
    const obstojec = await db.supplier.findUnique({
      where: { naziv: DOBAVITELJ },
      include: { _count: { select: { materialPrices: true } } },
    })
    if (obstojec) {
      throw new Error(
        `${DOBAVITELJ}: že obstaja z ${obstojec._count.materialPrices} cenami — bazno stanje ni čisto, PREKINJAM`,
      )
    }
    await db.$transaction(async (tx) => {
      const sup = await tx.supplier.create({ data: { naziv: DOBAVITELJ } })
      await tx.materialPrice.create({
        data: {
          inventoryId: artikel.id,
          supplierId: sup.id,
          cena: STARA_CENA,
          veljavnostOd: new Date(OD_STARE),
          veljavnostDo: MEJA,
        },
      })
      await tx.materialPrice.create({
        data: {
          inventoryId: artikel.id,
          supplierId: sup.id,
          cena: NOVA_CENA,
          veljavnostOd: MEJA,
          veljavnostDo: null,
        },
      })
    })
    console.log(
      `RAISE OK — ${SIFRA}: zgodovina 2 vpisov (zaprt ${STARA_CENA} → odprt ${NOVA_CENA}) pri ${DOBAVITELJ} (odtis prej: ${prej})`,
    )
  } else if (mode === 'restore') {
    const prej = await odtisCen()
    const sup = await db.supplier.findUnique({
      where: { naziv: DOBAVITELJ },
      include: { _count: { select: { materialPrices: true } } },
    })
    if (!sup) {
      throw new Error(`${DOBAVITELJ}: ne obstaja — raise stanja ni več, PREKINJAM`)
    }
    if (sup._count.materialPrices !== 2) {
      throw new Error(
        `${DOBAVITELJ}: ${sup._count.materialPrices} cen (pričakovane točno 2) — tujek vstopil, PREKINJAM`,
      )
    }
    await db.$transaction(async (tx) => {
      await tx.materialPrice.deleteMany({ where: { supplierId: sup.id } })
      await tx.supplier.delete({ where: { id: sup.id } })
    })
    const po = await db.supplier.count({ where: { naziv: DOBAVITELJ } })
    if (po !== 0) throw new Error('restore: dobavitelj še vedno obstaja — PREKINJAM')
    const cene = await odtisCen()
    if (cene !== prej - 2) {
      throw new Error(
        `restore: MaterialPrice odtis ${cene} != bazna resnica ${prej - 2} (prej ${prej} − 2 začasna) — ODTIS ni čist, PREKINJAM`,
      )
    }
    console.log(
      `RESTORE OK — začasna zgodovina + dobavitelj izbrisana (bajtnato; MaterialPrice odtis ${cene} == bazna resnica)`,
    )
  } else {
    throw new Error('uporaba: raise | restore')
  }
  await db.$disconnect()
}

main().catch((e) => {
  console.error('NAPAKA:', e.message)
  db.$disconnect().finally(() => process.exit(1))
})
