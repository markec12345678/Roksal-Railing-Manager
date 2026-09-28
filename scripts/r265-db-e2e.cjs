// R265 — DB seed/restore + bajtni prstni odtis za E2E (lokalni dev DB, port 5433).
// UPORABA:
//   node scripts/r265-db-e2e.cjs seed      — vstavi 1 stranko + 3 projekte +
//                                            5 terminov (id e2e-r265-stranka,
//                                            e2e-r265-proj1…3, e2e-r265-t1…t5):
//                                            proj1 'E2E Termini Blok A' +
//                                            datumMontaze: t1 ZAKLJUCENO 6h
//                                              (2026-09-20), t2 NAVRTENO 8h
//                                              (2026-10-05), t3 NAVRTENO 4h
//                                              (2026-10-06), t4 PREKlicANO 3h
//                                              (2026-10-07 — ure izključene);
//                                            proj2 'E2E Termini Blok B' +
//                                            datumMontaze: BREZ terminov
//                                              (plan. montaža brez termina —
//                                              planska luknja RED);
//                                            proj3 'E2E Termini Blok C' brez
//                                            datumMontaze: t5 V_TEKU 5h
//                                              (2026-09-29).
//                                            Pričakovan POST toast:
//                                            '2 projekta z termini, 5
//                                            terminov, brez termina 4.'
//                                            (naravno stanje dev DB: 3 projekti
//                                            vsi z datumMontaze + 0 termini →
//                                            brez termina 3 + proj2 = 4;
//                                            PRE klik = fail-closed toast 'Ni
//                                            vpisanih terminov' — veja 1).
//   node scripts/r265-db-e2e.cjs restore   — DELETE vseh 'e2e-r265-%' vrstic
//   node scripts/r265-db-e2e.cjs fp        — bajtni prstni odtis (JSON) —
//                                            pre==post MORA biti IDENTIČEN
//                                            (ZERO-MUTACIJA); Customer +
//                                            Project + InstallationSchedule
//                                            POLNA resnica — ta runda mutira
//                                            vse tri (SAMO INSERT/DELETE —
//                                            R261 lekcija 2)
// RAW SQL (NE Prisma) — createdAt/umi FIKSNI timestamps (determinizem
// odtisa); restore = bajtnata identičnost. LEKCIJA R257: quoted camelCase
// stolpci ("datumMontaze", "datumZacetka"). LEKCIJA R261: SAMO INSERT novih
// vrstic — NIČ UPDATE obstoječih. LEKCIJA R262/R263/R264: idempotenten seed
// (DELETE pred INSERT) + FK veriga Customer → Project → InstallationSchedule.
const { Client } = require('pg')

const c = new Client({
  host: 'localhost',
  port: 5433,
  user: 'roksal',
  password: 'roksal',
  database: 'roksal_dev',
})

const ID_PREDPONA = 'e2e-r265-'

async function main() {
  await c.connect()
  const mode = process.argv[2] || 'fp'

  if (mode === 'seed') {
    // idempotentnost: starejši e2e-r265 ostanki IZBRANI pred vstavljanjem
    // (red vrstic: termini → projekti → stranka — FK veriga)
    await c.query(`DELETE FROM "InstallationSchedule" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    await c.query(`DELETE FROM "Project" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    await c.query(`DELETE FROM "Customer" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    // stranka (FK za projekte)
    await c.query(
      `INSERT INTO "Customer"
         (id, ime, naslov, status, "createdAt")
       VALUES ($1, $2, $3, 'AKTIVEN', '2026-09-29 06:00:00'::timestamp)`,
      [`${ID_PREDPONA}stranka`, 'E2E Pozicija Stranka', 'E2E Ulica 1, 4000 Kranj'],
    )
    // 3 projekti (proj1 + proj2 z planirano montažo, proj3 brez)
    const projekti = [
      { id: `${ID_PREDPONA}proj1`, naziv: 'E2E Termini Blok A', dm: '2026-10-02 08:00:00' },
      { id: `${ID_PREDPONA}proj2`, naziv: 'E2E Termini Blok B', dm: '2026-10-10 08:00:00' },
      { id: `${ID_PREDPONA}proj3`, naziv: 'E2E Termini Blok C', dm: null },
    ]
    for (const p of projekti) {
      await c.query(
        `INSERT INTO "Project"
           (id, "customerId", "nazivProjekta", status, "datumMontaze", "clientToken", "clientPortalEnabled", "measureEnabled", "dealLocked", "syncRevision", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'NACRTOVANO', $4::timestamp, $5, false, false, false, 0, '2026-09-29 06:00:00'::timestamp, '2026-09-29 06:00:00'::timestamp)`,
        [p.id, `${ID_PREDPONA}stranka`, p.naziv, p.dm, `${p.id}-portal`],
      )
    }
    // 5 terminov: proj1 × 4 (zmes statusov; preklicana 3h izključena iz
    // vsote), proj3 × 1 (V_TEKU 5h). Σ ne-preklicanih = 6+8+4+5 = 23.
    const termini = [
      { id: `${ID_PREDPONA}t1`, proj: 'proj1', status: 'ZAKLJUCENO', ure: 6, od: '2026-09-20 08:00:00', do: '2026-09-20 14:00:00' },
      { id: `${ID_PREDPONA}t2`, proj: 'proj1', status: 'NAVRTENO', ure: 8, od: '2026-10-05 08:00:00', do: '2026-10-05 16:00:00' },
      { id: `${ID_PREDPONA}t3`, proj: 'proj1', status: 'NAVRTENO', ure: 4, od: '2026-10-06 08:00:00', do: '2026-10-06 12:00:00' },
      { id: `${ID_PREDPONA}t4`, proj: 'proj1', status: 'PREKlicANO', ure: 3, od: '2026-10-07 08:00:00', do: '2026-10-07 11:00:00' },
      { id: `${ID_PREDPONA}t5`, proj: 'proj3', status: 'V_TEKU', ure: 5, od: '2026-09-29 08:00:00', do: '2026-09-29 13:00:00' },
    ]
    for (const t of termini) {
      await c.query(
        `INSERT INTO "InstallationSchedule"
           (id, "projectId", status, "predvideneUre", "datumZacetka", "datumKonca", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5::timestamp, $6::timestamp, '2026-09-29 06:00:00'::timestamp, '2026-09-29 06:00:00'::timestamp)`,
        [t.id, `${ID_PREDPONA}${t.proj}`, t.status, t.ure, t.od, t.do],
      )
    }
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "InstallationSchedule" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ seeded: true, terminov: n.rows[0].n }))
  } else if (mode === 'restore') {
    await c.query(`DELETE FROM "InstallationSchedule" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    await c.query(`DELETE FROM "Project" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    await c.query(`DELETE FROM "Customer" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const t = await c.query(`SELECT COUNT(*)::int AS n FROM "InstallationSchedule" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const p = await c.query(`SELECT COUNT(*)::int AS n FROM "Project" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const s = await c.query(`SELECT COUNT(*)::int AS n FROM "Customer" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ restored: true, ostankovTerminov: t.rows[0].n, ostankovProjektov: p.rows[0].n, ostankovStrank: s.rows[0].n }))
  } else if (mode === 'fp') {
    const cnt = await c.query(
      `SELECT (SELECT COUNT(*) FROM "Inventory") AS inv,
              (SELECT COUNT(*) FROM "MaterialOrder") AS narocila,
              (SELECT COUNT(*) FROM "MaterialOrderItem") AS postavke,
              (SELECT COUNT(*) FROM "Supplier") AS dobavitelji,
              (SELECT COUNT(*) FROM "MaterialPrice") AS cene,
              (SELECT COUNT(*) FROM "Project") AS projekti,
              (SELECT COUNT(*) FROM "Invoice") AS racuni,
              (SELECT COUNT(*) FROM "Customer") AS stranke,
              (SELECT COUNT(*) FROM "InstallationSchedule") AS termini`,
    )
    // R265 — Customer + Project + InstallationSchedule POLNA resnica (ta
    // runda mutira vse tri — odtis MORA pokriti; pre==post bajtnata
    // identičnost = ZERO-MUTACIJA dokaz)
    const stranke = await c.query(`SELECT * FROM "Customer" ORDER BY id`)
    const projekti = await c.query(
      `SELECT id, "customerId", "nazivProjekta", status, "datumMontaze", "createdAt", "updatedAt"
         FROM "Project" ORDER BY id`,
    )
    const termini = await c.query(
      `SELECT id, "projectId", "crewId", "monterId", status, "predvideneUre", "dejanskeUre", opombe, lokacija, "datumZacetka", "datumKonca", "createdAt", "updatedAt"
         FROM "InstallationSchedule" ORDER BY id`,
    )
    console.log(JSON.stringify({
      stevci: cnt.rows[0],
      stranke: stranke.rows,
      projekti: projekti.rows,
      termini: termini.rows,
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
