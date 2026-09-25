// R134 E2E — preverba USER_* audit dnevnika (kliče scripts/r134-e2e.sh)
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

async function main() {
  const wanted = ['USER_INVITE', 'USER_ACTIVATED', 'USER_DEACTIVATE', 'USER_REACTIVATE']
  const rows = await db.auditLog.findMany({
    where: { akcija: { in: wanted } },
    orderBy: { timestamp: 'desc' },
    take: 20,
    select: { akcija: true, userId: true },
  })
  const seen = new Set(rows.map((r) => r.akcija))
  const missing = wanted.filter((a) => !seen.has(a))
  if (missing.length > 0) throw new Error(`audit manjka: ${missing.join(', ')}`)
  // vsi USER_* dogodki imajo pravega akterja (ne 'system')
  for (const r of rows) {
    if (!r.userId) throw new Error(`${r.akcija} brez akterja (userId null)`)
  }
  console.log('audit OK:', wanted.join(' + '))
  await db.$disconnect()
}

main().catch((e) => {
  console.error('AUDIT FAIL:', e.message)
  process.exit(1)
})
