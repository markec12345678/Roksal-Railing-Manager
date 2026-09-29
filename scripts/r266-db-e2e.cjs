// R266 — DB seed/restore + bajtni prstni odtis za E2E (lokalni dev DB, port 5433).
// UPORABA:
//   node scripts/r266-db-e2e.cjs seed      — vstavi 4 kose opreme
//                                            (id e2e-r266-e1…e4):
//                                            e1 'E2E Cikel Blok A — Merilec':
//                                              MERSKA_OPREMA, NA_VOLJO,
//                                              lokacija 'E2E Delavnica',
//                                              SN 'E2E-SN-1',
//                                              lastInspection 2026-01-01 +
//                                              interval 180 dni → naslednji
//                                              2026-06-30 (PRETEKLO →
//                                              inspectionDue TRUE — API izračun),
//                                              calibrationDueDate 2026-08-01
//                                              (PRETEKLO → calibrationOverdue
//                                              TRUE) — RED akcija;
//                                            e2 'E2E Cikel Blok B — Merilec
//                                            Brez Roka': MERSKA_OPREMA,
//                                              interval 90 BREZ zadnjega
//                                              pregleda → inspectionUnknown
//                                              TRUE (iskreno NEZNANO),
//                                              calibrationRequired TRUE brez
//                                              roka → calibrationMissing TRUE
//                                              (AMBER); brez lokacije;
//                                            e3 'E2E Cikel Blok C — Viličar':
//                                              PREVOZ, V_SERVISU, lokacija
//                                              'E2E Skladišče', lastInspection
//                                              2026-03-01 + interval 365 →
//                                              naslednji 2027-03-01 (prihodnji
//                                              — NI zapadel), nemerska;
//                                            e4 'E2E Cikel Blok D — Kolesek':
//                                              OSTALO, UPOKOJENO (terminalni
//                                              status — referenčni pregled),
//                                              brez periodike, nemerska, brez
//                                              lokacije.
//                                            Pričakovan FRESH toast:
//                                            '4 kosi, zapadel pregled 1,
//                                            potečena kalibracija 1.'
//                                            (naravno stanje dev DB: 0 opreme
//                                            → PRE klik = fail-closed toast
//                                            'Ni vpisane opreme' — veja 1).
//                                            Mini-vrstica (state): '4 kosi ·
//                                            zapadel 1 · potečena 1 · brez
//                                            lokacije 2' (e2+e4).
//   node scripts/r266-db-e2e.cjs restore   — DELETE vseh 'e2e-r266-%' vrstic
//   node scripts/r266-db-e2e.cjs fp        — bajtni prstni odtis (JSON) —
//                                            pre==post MORA biti IDENTIČEN
//                                            (ZERO-MUTACIJA); Equipment
//                                            POLNA resnica + vsi števci
//                                            r265 odtisa (regresija širine)
// RAW SQL (NE Prisma) — createdAt/updatedAt FIKSNI timestamps (determinizem
// odtisa); restore = bajtnata identičnost. LEKCIJA R257: quoted camelCase
// stolpci ("calibrationRequired", "lastInspectionAt"). LEKCIJA R261: SAMO
// INSERT novih vrstic — NIČ UPDATE obstoječih. LEKCIJA R262–R265: idempotenten
// seed (DELETE pred INSERT) + samostojna tabela Equipment (brez FK verige).
const { Client } = require('pg')

const c = new Client({
  host: 'localhost',
  port: 5433,
  user: 'roksal',
  password: 'roksal',
  database: 'roksal_dev',
})

const ID_PREDPONA = 'e2e-r266-'

async function main() {
  await c.connect()
  const mode = process.argv[2] || 'fp'

  if (mode === 'seed') {
    // idempotentnost: starejši e2e-r266 ostanki IZBRANI pred vstavljanjem
    await c.query(`DELETE FROM "Equipment" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    // 4 kosi — VSE ciklov veje (RED akcija / AMBER neznano / prihodnji rok /
    // terminalni mrtvi status)
    const oprema = [
      { id: `${ID_PREDPONA}e1`, naziv: 'E2E Cikel Blok A — Merilec', tip: 'MERSKA_OPREMA', status: 'NA_VOLJO', lok: 'E2E Delavnica', sn: 'E2E-SN-1', li: '2026-01-01 08:00:00', iv: 180, creq: true, cdd: '2026-08-01 08:00:00' },
      { id: `${ID_PREDPONA}e2`, naziv: 'E2E Cikel Blok B — Merilec Brez Roka', tip: 'MERSKA_OPREMA', status: 'NA_VOLJO', lok: null, sn: null, li: null, iv: 90, creq: true, cdd: null },
      { id: `${ID_PREDPONA}e3`, naziv: 'E2E Cikel Blok C — Viličar', tip: 'PREVOZ', status: 'V_SERVISU', lok: 'E2E Skladišče', sn: null, li: '2026-03-01 08:00:00', iv: 365, creq: false, cdd: null },
      { id: `${ID_PREDPONA}e4`, naziv: 'E2E Cikel Blok D — Kolesek', tip: 'OSTALO', status: 'UPOKOJENO', lok: null, sn: null, li: null, iv: null, creq: false, cdd: null },
    ]
    for (const e of oprema) {
      await c.query(
        `INSERT INTO "Equipment"
           (id, naziv, tip, status, lokacija, "serijskaStevilka", "lastInspectionAt", "inspectionIntervalDays", "calibrationRequired", "calibrationDueDate", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7::timestamp, $8, $9, $10::timestamp, '2026-09-29 06:00:00'::timestamp, '2026-09-29 06:00:00'::timestamp)`,
        [e.id, e.naziv, e.tip, e.status, e.lok, e.sn, e.li, e.iv, e.creq, e.cdd],
      )
    }
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "Equipment" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ seeded: true, oprem: n.rows[0].n }))
  } else if (mode === 'restore') {
    await c.query(`DELETE FROM "Equipment" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const e = await c.query(`SELECT COUNT(*)::int AS n FROM "Equipment" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ restored: true, ostankovOpreme: e.rows[0].n }))
  } else if (mode === 'fp') {
    const cnt = await c.query(
      `SELECT (SELECT COUNT(*) FROM "Equipment") AS oprema,
              (SELECT COUNT(*) FROM "Inventory") AS inv,
              (SELECT COUNT(*) FROM "MaterialOrder") AS narocila,
              (SELECT COUNT(*) FROM "MaterialOrderItem") AS postavke,
              (SELECT COUNT(*) FROM "Supplier") AS dobavitelji,
              (SELECT COUNT(*) FROM "MaterialPrice") AS cene,
              (SELECT COUNT(*) FROM "Project") AS projekti,
              (SELECT COUNT(*) FROM "Invoice") AS racuni,
              (SELECT COUNT(*) FROM "Customer") AS stranke,
              (SELECT COUNT(*) FROM "InstallationSchedule") AS termini`,
    )
    // R266 — Equipment POLNA resnica (ta runda mutira opremo — odtis MORA
    // pokriti; pre==post bajtnata identičnost = ZERO-MUTACIJA dokaz)
    const oprema = await c.query(
      `SELECT id, naziv, tip, sifra, status, lokacija, "zadnjiServis", opomba, "serijskaStevilka", "pridobitev", "lastInspectionAt", "inspectionIntervalDays", "calibrationRequired", "calibrationDueDate", "calibrationCertificate", "createdAt", "updatedAt"
         FROM "Equipment" ORDER BY id`,
    )
    console.log(JSON.stringify({
      stevci: cnt.rows[0],
      oprema: oprema.rows,
    }))
  } else {
    throw new Error(`neznani način: ${mode}`)
  }
  await c.end()
}

main().catch(async (e) => {
  console.error(e.message)
  try { await c.end() } catch {}
  process.exit(1)
})
