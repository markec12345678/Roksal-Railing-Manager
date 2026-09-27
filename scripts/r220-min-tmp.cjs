// R220 E2E pomožnik — ZAČASNO nastavi minimalnaZaloga = kolicinaZaloga na
// WPC-120-B (deterministično stanje 'na minimumu' — zaloga === minimum),
// nato BAJTNATO TOČNO obnovi (original 50). WPC-120-B NI v r218 PLAN-u
// (brez interakcije). ZERO-MUTACIJA zaloge: kolicinaZaloga se NETIKA.
// Uporaba: node scripts/r220-min-tmp.cjs raise | restore
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

const SIFRA = 'WPC-120-B'
const ORIGINAL = 50

async function main() {
  const mode = process.argv[2]
  if (mode === 'raise') {
    const item = await db.inventory.findUniqueOrThrow({
      where: { sifraMateriala: SIFRA },
      select: { kolicinaZaloga: true, minimalnaZaloga: true },
    })
    if (item.minimalnaZaloga !== ORIGINAL) {
      throw new Error(`${SIFRA}: original min=${item.minimalnaZaloga}, pričakovano ${ORIGINAL} — stanje ni bazno, PREKINJAM`)
    }
    const r = await db.inventory.updateMany({
      where: { sifraMateriala: SIFRA, minimalnaZaloga: ORIGINAL },
      data: { minimalnaZaloga: item.kolicinaZaloga }, // zaloga === minimum
    })
    if (r.count !== 1) throw new Error(`${SIFRA}: raise count=${r.count} (pričakovano 1)`)
    console.log(`RAISE OK — ${SIFRA} min=${item.kolicinaZaloga} (=== zaloga; 'na minimumu' = 1)`)
  } else if (mode === 'restore') {
    const item = await db.inventory.findUniqueOrThrow({
      where: { sifraMateriala: SIFRA },
      select: { kolicinaZaloga: true, minimalnaZaloga: true },
    })
    if (item.minimalnaZaloga !== item.kolicinaZaloga) {
      throw new Error(`${SIFRA}: min=${item.minimalnaZaloga} !== zaloga=${item.kolicinaZaloga} — raise stanje ni več prisotno, PREKINJAM`)
    }
    const r = await db.inventory.updateMany({
      where: { sifraMateriala: SIFRA, minimalnaZaloga: item.kolicinaZaloga },
      data: { minimalnaZaloga: ORIGINAL },
    })
    if (r.count !== 1) throw new Error(`${SIFRA}: restore count=${r.count} (pričakovano 1)`)
    console.log(`RESTORE OK — ${SIFRA} min=${ORIGINAL} (bajtnato)`)
  } else {
    throw new Error('uporaba: raise | restore')
  }
  await db.$disconnect()
}

main().catch((e) => {
  console.error('NAPAKA:', e.message)
  db.$disconnect().finally(() => process.exit(1))
})
