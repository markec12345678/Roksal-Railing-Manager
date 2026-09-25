// R139 E2E seed — deterministični podatki v roksal_dev za brskalniški E2E
// (audit dialog + termini CSV). Idempotenten (upsert).
const { PrismaClient } = require('@prisma/client')

const db = new PrismaClient({
  datasources: { db: { url: 'postgresql://roksal:roksal@localhost:5433/roksal_dev' } },
})

const MONTER_ID = 'cmuh90zjv000mn6qcsiqnvkg0'
const NOW = new Date()

async function main() {
  await db.customer.upsert({
    where: { id: 'r139cust' },
    update: {},
    create: { id: 'r139cust', ime: 'R139 E2E Stranka', naslov: 'Testna cesta 13, Ljubljana' },
  })
  await db.project.upsert({
    where: { id: 'r139proj' },
    update: { monterId: MONTER_ID },
    create: {
      id: 'r139proj',
      customerId: 'r139cust',
      nazivProjekta: 'R139 E2E Projekt — ograja balkona',
      status: 'NACRTOVANO',
      monterId: MONTER_ID,
    },
  })
  const auditRows = [
    ['r139a1', MONTER_ID, 'CREATE_PROJECT', null, JSON.stringify({ nazivProjekta: 'R139 E2E Projekt — ograja balkona' }), 120],
    ['r139a2', MONTER_ID, 'PROJECT_STATUS', JSON.stringify({ status: 'NACRTOVANO' }), JSON.stringify({ status: 'V_IZDELAVI' }), 60],
    ['r139a3', null, 'PORTAL_ENABLED', null, JSON.stringify({ veljaDni: 90 }), 30],
  ]
  for (const [id, userId, akcija, oldValue, newValue, minutesAgo] of auditRows) {
    await db.auditLog.upsert({
      where: { id },
      update: {},
      create: {
        id,
        userId,
        projectId: 'r139proj',
        akcija,
        oldValue,
        newValue,
        ipAddress: '127.0.0.1',
        userAgent: 'agent-browser',
        timestamp: new Date(NOW.getTime() - minutesAgo * 60000),
      },
    })
  }
  await db.installationSchedule.upsert({
    where: { id: 'r139sched1' },
    update: {},
    create: {
      id: 'r139sched1',
      projectId: 'r139proj',
      datumZacetka: new Date('2026-10-05T08:00:00.000Z'),
      datumKonca: new Date('2026-10-05T16:00:00.000Z'),
      status: 'NAVRTENO',
      predvideneUre: 8,
      lokacija: 'Ljubljana',
    },
  })
  const auditCount = await db.auditLog.count({ where: { projectId: 'r139proj' } })
  console.log('audit rows for r139proj:', auditCount)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
