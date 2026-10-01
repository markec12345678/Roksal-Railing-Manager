// R332 E2E pomožnik — ZAČASNO zasidra STRANKO s POTEKLim opomnikom (opomnikDatum
// v preteklosti → /api/crm enrich izračuna opomnikStatus='POTEKEL' — ISTI
// izračun kot žig 'Opomnik potekel' na kartici) — ŽIVO pokrije izvoz POTEKLI
// OPOMNIKI CSV (59. člen issue #1 IZVOZI, CSV brat PDF R252) z resničnimi
// podatki. Deterministični fiksni ISO čas (nič Date.now). ZERO-MUTACIJA
// končnega stanja: restore zbriše TEMPERATURNO stranko (guard: točno 1
// vrstica z markerjem imena), ostale stranke se NETIKAJO. Uporaba:
//   node scripts/r332-po-tmp.cjs raise | restore
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

const STRANKA = 'R332-TMP-STRANKA (E2E)'
// fiksni ISO niz (determinizem — nič trenutnega časa v podatkih); v preteklosti
// → POTEKEL (days < 0) za VSE teke po tem datumu — akcijska monotona resnica
const OPOMNIK = new Date('2026-01-15T08:00:00.000Z')
const OPIS = 'R332 E2E opomnik (potekel)'

// ODTIS bazne resnice prej (r330-pt-tmp kanon: guard brani REALNO stanje
// — pre==post, nič trdih pričakovanj)
async function odtis() {
  return {
    stranke: await db.customer.count(),
  }
}

async function main() {
  const mode = process.argv[2]
  if (mode === 'raise') {
    const prej = await odtis()
    const obstojeca = await db.customer.findFirst({
      where: { ime: STRANKA },
      select: { id: true },
    })
    if (obstojeca) {
      throw new Error(`${STRANKA}: že obstaja — bazno stanje ni čisto, PREKINJAM`)
    }
    await db.customer.create({
      data: {
        ime: STRANKA,
        naslov: 'E2E tmp naslov (r332)',
        telefon: '041 555 666',
        kontaktnaOseba: null,
        opomnikDatum: OPOMNIK,
        opomnikOpis: OPIS,
      },
    })
    console.log(
      `RAISE OK — ${STRANKA}: stranka s poteklim opomnikom (opomnikDatum ${OPOMNIK.toISOString()}; odtis prej: ${JSON.stringify(prej)})`,
    )
  } else if (mode === 'restore') {
    const prej = await odtis()
    const najdene = await db.customer.findMany({
      where: { ime: STRANKA },
      select: { id: true },
    })
    if (najdene.length !== 1) {
      throw new Error(
        `${STRANKA}: ${najdene.length} vrstic (pričakovanih točno 1) — tujek vstopil ali raise stanja ni več, PREKINJAM`,
      )
    }
    await db.customer.delete({ where: { id: najdene[0].id } })
    const po = await odtis()
    if (po.stranke !== prej.stranke - 1) {
      throw new Error(
        `restore: Customer odtis ${po.stranke} != bazna resnica ${prej.stranke - 1} (prej ${prej.stranke} − 1 začasna) — ODTIS ni čist, PREKINJAM`,
      )
    }
    console.log(
      `RESTORE OK — začasna stranka izbrisana (bajtnato; odtis ${JSON.stringify(po)} == bazna resnica)`,
    )
  } else {
    throw new Error(`neznana moda: ${String(mode)} — uporabi raise | restore`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
