// Roksal — enkratna sanacija demo podatkov (runda K / Task 10)
// ---------------------------------------------------------------------------
// Zgodovina: prisma/seed.cjs je uporabljal `create()` za stranke in projekte,
// zato je vsak ponoven zagon naseljal NOV nabor (v peskovniku 4× isti nabor:
// 12 strank + 12 projektov, vsi z estimatedPrice=null). To je onesnaževalo
// ploščo, obvestila, follow-upe in LTV.
//
// Ta skripta:
//  1. za vsako ime stranke obdrži NAJSTAREŠO stranko, ostale zbere;
//  2. račune dup-projektov preusmeri na ohranjeni projekt z istim nazivom;
//  3. AuditLog dup-projektov pusti (history), le projectId=null (projekt gre čez);
//  4. zbriše MaterialUsage/InventoryMovement dup-projektov (brez cascade),
//     nato dup-projekte (Measurements/Documents/Invoice/Gallery/Photos kaskadirajo
//     prek onDelete: Cascade v shemi);
//  5. dup stranke zbriše;
//  6. ohranjene projekte obogati z realističnimi estimatedPrice / dealLocked.
//
// Idempotentna: ponovni zagon ne najde duplikatov in ne spremeni ničesar.

const { PrismaClient } = require('@prisma/client')

const db = new PrismaClient({ log: [] })

// Realistične cene za demo projekte (EUR, z DDV realno okvirno)
const PRICE_BY_NAME = {
  'Ograja Novak - Balkon 3.nadstropje': 2850,
  'Terasa Zupan - WPC deske': 4320,
  'Ograja Kokalj - Balustrada': 1980,
}
const LOCKED_BY_NAME = new Set(['Terasa Zupan - WPC deske'])

async function main() {
  console.log('[cleanup] začetek …')

  // 1. stranke: po imenu obdrži najstarejšo
  const customers = await db.customer.findMany({ orderBy: { createdAt: 'asc' } })
  const keepCustomer = new Map()
  const dupCustomers = []
  for (const c of customers) {
    if (!keepCustomer.has(c.ime)) keepCustomer.set(c.ime, c)
    else dupCustomers.push(c)
  }
  console.log(`[cleanup] stranke: ${customers.length}, dup: ${dupCustomers.length}`)

  // 2. projekti: obdrži najstarejši za (nazivProjekta) — ti nosijo meritve/dokumente
  const projects = await db.project.findMany({ orderBy: { createdAt: 'asc' } })
  const keepProject = new Map()
  const dupProjects = []
  for (const p of projects) {
    if (!keepProject.has(p.nazivProjekta)) keepProject.set(p.nazivProjekta, p)
    else dupProjects.push(p)
  }
  const dupIds = dupProjects.map((p) => p.id)
  console.log(`[cleanup] projekti: ${projects.length}, dup: ${dupProjects.length}`)

  if (dupIds.length > 0) {
    // 3. računi dup-projektov → preusmeri na ohranjeni projekt z istim nazivom
    for (const dup of dupProjects) {
      const target = keepProject.get(dup.nazivProjekta)
      if (!target) continue
      const moved = await db.invoice.updateMany({ where: { projectId: dup.id }, data: { projectId: target.id } })
      if (moved.count) console.log(`[cleanup] računi preusmerjeni: ${moved.count} (${dup.nazivProjekta})`)
    }

    // 4. AuditLog history ohrani, vez pa odveži
    const nulled = await db.auditLog.updateMany({ where: { projectId: { in: dupIds } }, data: { projectId: null } })
    if (nulled.count) console.log(`[cleanup] AuditLog odvezan: ${nulled.count}`)

    // 5. brez cascade relacije najprej ročno
    const mu = await db.materialUsage.deleteMany({ where: { projectId: { in: dupIds } } })
    const im = await db.inventoryMovement.deleteMany({ where: { projectId: { in: dupIds } } })
    if (mu.count || im.count) console.log(`[cleanup] MaterialUsage:${mu.count} InventoryMovement:${im.count} zbrisanih`)

    // 6. dup projekti (kaskada počisti meritve/dokumente/galerijo/fotografije)
    for (const p of dupProjects) {
      await db.project.delete({ where: { id: p.id } })
    }
    console.log(`[cleanup] zbrisanih projektov: ${dupProjects.length}`)

    // 7. dup stranke
    for (const c of dupCustomers) {
      await db.customer.delete({ where: { id: c.id } })
    }
    console.log(`[cleanup] zbrisanih strank: ${dupCustomers.length}`)
  }

  // 8. bogatenje ohranjenih projektov (cene so prej bile vs null)
  let enriched = 0
  for (const [, p] of keepProject) {
    const price = PRICE_BY_NAME[p.nazivProjekta]
    if (price == null) continue
    await db.project.update({
      where: { id: p.id },
      data: { estimatedPrice: price, dealLocked: LOCKED_BY_NAME.has(p.nazivProjekta) },
    })
    enriched++
  }
  console.log(`[cleanup] projektov obogatenih s ceno: ${enriched}`)

  // 9. meritve: dedup znotraj ohranjenih projektov (seed je tukaj tudi vedno
  // ustvarjal nove → 4× iste meritve). Ključ: (projectId, dolzinaMm, visinaMm,
  // source). Obdrži najstarejšo, ostale zbriši.
  const measurements = await db.measurement.findMany({ orderBy: { createdAt: 'asc' } })
  const keepM = new Map()
  const dupM = []
  for (const m of measurements) {
    let src = 'merilec'
    try {
      const a = JSON.parse(m.arMetadata || '{}')
      if (a.source) src = a.source
    } catch { /* brez metapodatkov = merilec */ }
    const key = `${m.projectId}|${m.dolzinaMm}|${m.visinaMm}|${src}`
    if (!keepM.has(key)) keepM.set(key, m)
    else dupM.push(m)
  }
  for (const m of dupM) await db.measurement.delete({ where: { id: m.id } })
  if (dupM.length) console.log(`[cleanup] dup meritev zbrisanih: ${dupM.length}`)

  // 10. strankine samomeritve → deterministično zamenjaj z ENO realistično.
  // (Prejšnji E2E testi so po zemljevidu narisali 45 m / 946 m ograje, kar
  // daje nesmiselno primerjavo "Stranka vs merilec" v demo.)
  const cMap = await db.measurement.findMany({ where: { arMetadata: { contains: 'customer-map' } } })
  const realistic = cMap.filter((m) => m.dolzinaMm === 5420)
  const obsolete = cMap.filter((m) => m.dolzinaMm !== 5420)
  if (obsolete.length > 0) {
    for (const m of obsolete) await db.measurement.delete({ where: { id: m.id } })
    console.log(`[cleanup] starih strankinih meritev zbrisanih: ${obsolete.length}`)
  }
  if (realistic.length === 0) {
    const novak = keepProject.get('Ograja Novak - Balkon 3.nadstropje')
    if (novak) {
      // merilec: 3.2 + 1.8 = 5.0 m → stranka približno 5.42 m (+8.4 % —
      // "orientacija", realen scenarij: stranka vključi tudi stranska vrata)
      await db.measurement.create({
        data: {
          projectId: novak.id,
          dolzinaMm: 5420,
          visinaMm: 1050,
          arMetadata: JSON.stringify({
            source: 'customer-map',
            imeStranke: 'Janez Novak',
            telefonStranke: '+386 41 555 666',
            opombaStranke: 'Približek po satelitskem zemljevidu — vključuje tudi stranska vrata.',
            tocke: 4,
          }),
        },
      })
      console.log('[cleanup] dodana realistična strankina meritev (5.42 m)')
    }
  }

  // Povzetek
  const [nC, nP, nM, nI] = await Promise.all([
    db.customer.count(),
    db.project.count(),
    db.measurement.count(),
    db.invoice.count(),
  ])
  console.log(`[cleanup] končno stanje: stranke=${nC} projekti=${nP} meritve=${nM} racuni=${nI}`)
}

main()
  .catch((e) => {
    console.error('[cleanup] NAPAKA:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
