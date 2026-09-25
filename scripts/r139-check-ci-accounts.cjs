// Preveri, ali ci@ računi obstajajo v roksal_dev (za lokalni dimni test).
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient({
  datasources: { db: { url: 'postgresql://roksal:roksal@localhost:5433/roksal_dev' } },
})
async function main() {
  const profs = await db.profile.findMany({
    where: { email: { in: ['ci@roksal.si', 'monter.ci@roksal.si', 'admin@roksal.si', 'smoke-r139@roksal.si'] } },
    select: { email: true, vloga: true },
  })
  console.log(JSON.stringify(profs))
}
main().finally(() => db.$disconnect())
