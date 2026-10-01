// R333 E2E pomožnik — ZAČASNO zasidra DOBAVITELJA z 2 VELJAVNIMA cenama na
// DVEH RAZLIČNIH obstoječih artiklih (cena 100 + 125, veljavnostDo null —
// odprti okni; DB EXCLUSION constraint material_price_no_overlap dovoljuje
// SAMO ENA odprta cena per (inventoryId, supplierId) — 2 ceni na ISTEM
// artiklu sta pokvarjen vir, zato EN artikel; ISTA realna invarianta, ki jo
// PDF/CSV agregat obravnava per dobavitelj ČEZ artikle) — ŽIVO pokrije
// izvoz POZICIJA DOBAVITELJEV CSV (60. člen issue #1 IZVOZI, CSV brat PDF
// R264) z resničnimi podatki. Fiksni ISO veljavnostOd (determinizem — nič
// Date.now v vsebini). ZERO-MUTACIJA končnega stanja: restore zbriše
// TEMPERATURNE cene (guard: točno 2 vrstici po IDENTITETI supplierId) IN
// TEMPERATURNEGA dobavitelja (guard: točno 1 vrstica z markerjem imena);
// obstoječi dobavitelji/cene/artikli se NETIKAJO. ODTIS guard ×2 (Supplier
// + MaterialPrice prej−Δ==po — r330/r332 kanon). Uporaba:
//   node scripts/r333-pz-tmp.cjs raise | restore
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

const DOBAVITELJ = 'R333-TMP-DOBAVITELJ (E2E)'
const OPOMBA = 'R333 E2E cena (pozicija)'
// fiksni ISO (determinizem — nič trenutnega časa v podatkih)
const VELJAVNOST = new Date('2026-01-10T08:00:00.000Z')
// deterministična artikla: PRVA DVA po id ASC (identiteta — isti za VSE
// teke, dokler se bazno stanje ne spremeni; guard brani obstoj); ceni:
// 100 + 125 — EN dobavitelj, 2 različna artikla (odprti okni —
// material_price_no_overlap varnost; mesto/konkurenca = živa resnica,
// brez trdih pričakovanj — iskren fail-closed)

// ODTIS bazne resnice prej (r332-po-tmp kanon: guard brani REALNO stanje —
// pre==post po Δ, nič trdih pričakovanj)
async function odtis() {
  return {
    dobavitelji: await db.supplier.count(),
    cene: await db.materialPrice.count(),
  }
}

async function main() {
  const mode = process.argv[2]
  if (mode === 'raise') {
    const prej = await odtis()
    const obstojec = await db.supplier.findFirst({
      where: { naziv: DOBAVITELJ },
      select: { id: true },
    })
    if (obstojec) {
      throw new Error(`${DOBAVITELJ}: že obstaja — bazno stanje ni čisto, PREKINJAM`)
    }
    // deterministična artikla (prva dva po id ASC) — fail-closed, če jih ni
    const artikli = await db.inventory.findMany({
      orderBy: { id: 'asc' },
      take: 2,
      select: { id: true, naziv: true },
    })
    if (artikli.length !== 2) {
      throw new Error(`pričakovana 2 artikla, najdeno ${artikli.length} — pozicijska resnica brez vira, PREKINJAM`)
    }
    const sup = await db.supplier.create({
      data: {
        naziv: DOBAVITELJ,
        kontakt: null,
        telefon: '041 333 444',
        naslov: 'E2E tmp naslov (r333)',
        dobavniRok: 5,
        popust: 0,
        aktivna: true,
        materialPrices: {
          create: [
            { inventoryId: artikli[0].id, cena: 100, veljavnostOd: VELJAVNOST, opomba: OPOMBA },
            { inventoryId: artikli[1].id, cena: 125, veljavnostOd: VELJAVNOST, opomba: OPOMBA },
          ],
        },
      },
      select: { id: true },
    })
    console.log(
      `RAISE OK — ${DOBAVITELJ}: 2 ceni (100 + 125) na artiklih ${artikli[0].id} + ${artikli[1].id} (supplierId ${sup.id}; odtis prej: ${JSON.stringify(prej)})`,
    )
  } else if (mode === 'restore') {
    const prej = await odtis()
    const sup = await db.supplier.findFirst({
      where: { naziv: DOBAVITELJ },
      select: { id: true },
    })
    if (!sup) {
      throw new Error(`${DOBAVITELJ}: manjka — raise stanja ni več, PREKINJAM`)
    }
    // cena guard: točno 2 vrstici TEMPERATURNega dobavitelja (marker po IDENTITETI supplierId — v === s, R260–R263 lekcija)
    const cene = await db.materialPrice.findMany({
      where: { supplierId: sup.id },
      select: { id: true },
    })
    if (cene.length !== 2) {
      throw new Error(
        `${DOBAVITELJ}: ${cene.length} cen (pričakovanih točno 2) — tujek vstopil ali raise stanja ni več, PREKINJAM`,
      )
    }
    // odstranitev po IDENTITETI (id ×2) — ne po imenu/oznaki (iskren ključ)
    await db.materialPrice.deleteMany({ where: { id: { in: cene.map((c) => c.id) } } })
    await db.supplier.delete({ where: { id: sup.id } })
    const po = await odtis()
    if (po.dobavitelji !== prej.dobavitelji - 1 || po.cene !== prej.cene - 2) {
      throw new Error(
        `restore: odtis ${JSON.stringify(po)} != bazna resnica (prej ${JSON.stringify(prej)} − 1 dobavitelj − 2 ceni) — ODTIS ni čist, PREKINJAM`,
      )
    }
    console.log(
      `RESTORE OK — začasni dobavitelj + 2 ceni izbrisana (odtis ${JSON.stringify(po)} == bazna resnica)`,
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
