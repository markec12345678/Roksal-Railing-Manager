// R251 — preverba lokalne DB: ali obstaja stranka z opomnikom (za E2E načrt).
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient({ datasources: { db: { url: 'postgresql://roksal:roksal@localhost:5433/roksal_dev' } } })
;(async () => {
  const vsi = await p.customer.findMany({ select: { ime: true, status: true, opomnikDatum: true, opomnikOpis: true }, take: 20, orderBy: { createdAt: 'asc' } })
  console.log(JSON.stringify({
    skupaj: vsi.length,
    zOpomnikom: vsi.filter(c => c.opomnikDatum).map(c => ({ ime: c.ime, opomnikDatum: c.opomnikDatum, opomnikOpis: c.opomnikOpis })),
    vzorec: vsi.slice(0, 8).map(c => ({ ime: c.ime, status: c.status, opomnik: !!c.opomnikDatum })),
  }, null, 1))
  await p.$disconnect()
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
