// R330 E2E pomožnik — ZAČASNO zasidra PROJEKT + 2 TERMINA (InstallationSchedule)
// pri začasni stranki — ŽIVO pokrije izvozna PAR projekti-termini (57. člen)
// z resničnimi podatki (do zdaj je lokalna E2E baza poznala SAMO iskreno
// prazno vejo — Z0u/Z0v OPOMBA). Deterministični ISO časi (fiksni nizi —
// nič Date.now). ZERO-MUTACIJA končnega stanja: restore zbriše TEMPERATURNE
// termine + projekt + stranko (guardi na točno 2/1/1), ostali projekti in
// referenčni r283 projekt se NETIKAJO. Uporaba:
//   node scripts/r330-pt-tmp.cjs raise | restore
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

const STRANKA = 'R330-TMP-STRANKA (E2E)'
const PROJEKT = 'R330-TMP-PROJEKT (E2E)'
// fiksni ISO nizi (determinizem — nič trenutnega časa v podatkih)
const D1 = new Date('2026-01-05T07:00:00.000Z')
const D2 = new Date('2026-01-07T07:00:00.000Z')
const MONTAZA = new Date('2026-02-01T00:00:00.000Z')

// ODTIS bazne resnice prej (r328-cena-tmp kanon: guard brani REALNO stanje
// — pre==post, nič trdih pričakovanj)
async function odtis() {
  return {
    termini: await db.installationSchedule.count(),
    projekti: await db.project.count(),
    stranke: await db.customer.count(),
  }
}

async function main() {
  const mode = process.argv[2]
  if (mode === 'raise') {
    const prej = await odtis()
    const obstojec = await db.project.findFirst({
      where: { nazivProjekta: PROJEKT },
      select: { id: true },
    })
    if (obstojec) {
      throw new Error(`${PROJEKT}: že obstaja — bazno stanje ni čisto, PREKINJAM`)
    }
    const obstojcaStranka = await db.customer.findFirst({
      where: { ime: STRANKA },
      select: { id: true },
    })
    if (obstojcaStranka) {
      throw new Error(`${STRANKA}: že obstaja — bazno stanje ni čisto, PREKINJAM`)
    }
    await db.$transaction(async (tx) => {
      const stranka = await tx.customer.create({
        data: { ime: STRANKA, naslov: 'E2E tmp naslov (r330)' },
      })
      const projekt = await tx.project.create({
        data: {
          nazivProjekta: PROJEKT,
          customerId: stranka.id,
          datumMontaze: MONTAZA,
        },
      })
      await tx.installationSchedule.create({
        data: {
          projectId: projekt.id,
          datumZacetka: D1,
          datumKonca: D1,
          status: 'NAVRTENO',
          predvideneUre: 5,
        },
      })
      await tx.installationSchedule.create({
        data: {
          projectId: projekt.id,
          datumZacetka: D2,
          datumKonca: D2,
          status: 'ZAKLJUCENO',
          predvideneUre: 8,
        },
      })
    })
    console.log(
      `RAISE OK — ${PROJEKT}: stranka + projekt + 2 termina (NAVRTENO 5h ${D1.toISOString()} / ZAKLJUCENO 8h ${D2.toISOString()}; odtis prej: ${JSON.stringify(prej)})`,
    )
  } else if (mode === 'restore') {
    const prej = await odtis()
    const projekt = await db.project.findFirst({
      where: { nazivProjekta: PROJEKT },
      include: {
        _count: { select: { schedules: true } },
        customer: { select: { id: true, ime: true } },
      },
    })
    if (!projekt) {
      throw new Error(`${PROJEKT}: ne obstaja — raise stanja ni več, PREKINJAM`)
    }
    if (projekt._count.schedules !== 2) {
      throw new Error(
        `${PROJEKT}: ${projekt._count.schedules} terminov (pričakovanih točno 2) — tujek vstopil, PREKINJAM`,
      )
    }
    if (projekt.customer.ime !== STRANKA) {
      throw new Error(
        `${PROJEKT}: stranka '${projekt.customer.ime}' ni začasna (${STRANKA}) — tujek vstopil, PREKINJAM`,
      )
    }
    await db.$transaction(async (tx) => {
      await tx.installationSchedule.deleteMany({ where: { projectId: projekt.id } })
      await tx.project.delete({ where: { id: projekt.id } })
      await tx.customer.delete({ where: { id: projekt.customer.id } })
    })
    const po = await odtis()
    if (po.termini !== prej.termini - 2) {
      throw new Error(
        `restore: InstallationSchedule odtis ${po.termini} != bazna resnica ${prej.termini - 2} (prej ${prej.termini} − 2 začasna) — ODTIS ni čist, PREKINJAM`,
      )
    }
    if (po.projekti !== prej.projekti - 1 || po.stranke !== prej.stranke - 1) {
      throw new Error(
        `restore: Project/Customer odtis ${JSON.stringify(po)} != bazna resnica (${prej.projekti - 1}/${prej.stranke - 1}) — ODTIS ni čist, PREKINJAM`,
      )
    }
    console.log(
      `RESTORE OK — začasni termini + projekt + stranka izbrisana (bajtnato; odtis ${JSON.stringify(po)} == bazna resnica)`,
    )
  } else {
    throw new Error('uporaba: raise | restore')
  }
  await db.$disconnect()
}

main().catch((e) => {
  console.error('NAPAKA:', e.message)
  db.$disconnect().finally(() => process.exit(1))
})
