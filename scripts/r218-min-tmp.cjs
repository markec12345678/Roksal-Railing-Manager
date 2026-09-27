// R218 E2E pomožnik — ZAČASNO dvigne minimalnaZaloga na 5 artiklih (da je
// nizka zaloga = 6 → 'Vse' vrstica vidna), nato BAJTNATO TOČNO obnovi.
// Uporaba: node scripts/r218-min-tmp.cjs raise | restore
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

// Originalne vrednosti (izjemen vir resnice za restore — bajtna obnova):
const PLAN = [
  { sifra: 'ALU-PROF-40', original: 50, začasno: 200 },
  { sifra: 'ALU-PROF-60', original: 30, začasno: 100 },
  { sifra: 'EPDM-TESNILO', original: 100, začasno: 350 },
  { sifra: 'SID-HILTI-330', original: 10, začasno: 40 },
  { sifra: 'WPC-120-A', original: 100, začasno: 500 },
]

async function main() {
  const mode = process.argv[2]
  if (mode === 'raise') {
    for (const p of PLAN) {
      const r = await db.inventory.updateMany({
        where: { sifraMateriala: p.sifra, minimalnaZaloga: p.original },
        data: { minimalnaZaloga: p.začasno },
      })
      if (r.count !== 1) throw new Error(`${p.sifra}: raise count=${r.count} (pričakovano 1)`)
    }
    console.log('RAISE OK — 5 artiklov pod minimum (nizka = 6 z M12 A4)')
  } else if (mode === 'restore') {
    for (const p of PLAN) {
      const r = await db.inventory.updateMany({
        where: { sifraMateriala: p.sifra, minimalnaZaloga: p.začasno },
        data: { minimalnaZaloga: p.original },
      })
      if (r.count !== 1) throw new Error(`${p.sifra}: restore count=${r.count} (pričakovano 1)`)
    }
    console.log('RESTORE OK — originalne vrednosti bajtnato obnovljene')
  } else {
    throw new Error('uporaba: raise | restore')
  }
  await db.$disconnect()
}

main().catch((e) => {
  console.error('NAPAKA:', e.message)
  db.$disconnect().finally(() => process.exit(1))
})
