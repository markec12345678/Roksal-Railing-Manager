// R133 E2E — preverba audit dnevnika (kliče scripts/r133-e2e.sh)
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

async function main() {
  const rows = await db.auditLog.findMany({
    where: { akcija: { in: ['MEASURE_SUBMIT', 'MEASURE_REVOKE', 'MEASURE_VIEW', 'MEASURE_DUPLICATE', 'MEASURE_REJECTED'] } },
    orderBy: { timestamp: 'desc' },
    take: 10,
    select: { akcija: true, ipAddress: true, userAgent: true, projectId: true },
  })
  console.log('audit vrstice:', JSON.stringify(rows.map((r) => r.akcija)))
  const submit = rows.find((r) => r.akcija === 'MEASURE_SUBMIT')
  const revoke = rows.find((r) => r.akcija === 'MEASURE_REVOKE')
  if (!submit) throw new Error('MEASURE_SUBMIT manjka')
  if (!revoke) throw new Error('MEASURE_REVOKE manjka')
  // Javna površina (VIEW/SUBMIT/DUPLICATE/REJECTED) MORA nositi ipHash;
  // management akcije (MEASURE_REVOKE prek seje) so R132 vzorec brez IP-ja.
  const publicAkcije = new Set(['MEASURE_VIEW', 'MEASURE_SUBMIT', 'MEASURE_DUPLICATE', 'MEASURE_REJECTED'])
  for (const r of rows) {
    if (publicAkcije.has(r.akcija)) {
      if (!r.ipAddress || !/^[0-9a-f]{32}$/.test(r.ipAddress)) {
        throw new Error(`ipHash naj bi bil 32 hex: ${r.akcija} → ${r.ipAddress}`)
      }
    }
  }
  console.log('audit OK — javni dogodki z ipHash 32 hex, surov IP ni shranjen')
  await db.$disconnect()
}

main().catch((e) => {
  console.error('AUDIT FAIL:', e.message)
  process.exit(1)
})
