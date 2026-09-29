// R267 — DB seed/restore + bajtni prstni odtis za E2E (lokalni dev DB, port 5433).
// UPORABA:
//   node scripts/r267-db-e2e.cjs seed      — vstavi 1 stranko + 5 projektov
//                                            (id e2e-r267-proj1…proj5),
//                                            DATUMI DINAMIČNI glede na dan
//                                            teka (dnevna ravni stanja
//                                            spomnika — R161 EN VIR, 100 %
//                                            deterministično znotraj teka):
//                                            proj1 'E2E Spomniki Blok A —
//                                              Zapadel': NACRTOVANO,
//                                              followUpDate = danes − 28 dni
//                                              (Zapadel — RED akcija) +
//                                              opomba + datumMontaze = danes
//                                              + 3 dni;
//                                            proj2 'E2E Spomniki Blok B —
//                                              Danes': V_TEKU, followUpDate =
//                                              danes 09:00 (Danes — NAVY);
//                                            proj3 'E2E Spomniki Blok C —
//                                              Kmalu': NACRTOVANO,
//                                              followUpDate = danes + 2 dni
//                                              (Kmalu 1–3 dni — AMBER) +
//                                              datumMontaze = danes + 11 dni;
//                                            proj4 'E2E Spomniki Blok D —
//                                              Podpisana': ZAKLJUCENO +
//                                              dealLocked TRUE (zgodovinska
//                                              cona), followUpDate = danes −
//                                              45 dni (zapadel ampak
//                                              PODPISANA — NE alarm);
//                                            proj5 'E2E Spomniki Blok E —
//                                              Brez Spomnika': V_TEKU, brez
//                                              followUpDate (Brez spomnika —
//                                              AMBER akcija).
//                                            Pričakovan FRESH toast:
//                                            '5 ponudb, zapadel spomnik 1,
//                                            podpisanih 1.' (FRESH = polna
//                                            resnica — vključno s podpisano
//                                            proj4!).
//                                            Mini-vrstica (state = viden
//                                            seznam kartice: !dealLocked &&
//                                            status !== 'ZAKLJUCENO', prvih
//                                            12): '4 ponudbe · zapadel 1 ·
//                                            spomnik danes 1 · brez
//                                            spomnika 1' + žetona '1 zapadel
//                                            spomnik' (RED) + '1 brez
//                                            spomnika' (AMBER) + RED dot.
//   node scripts/r267-db-e2e.cjs restore   — DELETE vseh 'e2e-r267-%' vrstic
//                                            (red: projekti → stranka — FK)
//   node scripts/r267-db-e2e.cjs fp        — bajtni prstni odtis (JSON) —
//                                            pre==post MORA biti IDENTIČEN
//                                            (ZERO-MUTACIJA); Customer +
//                                            Project POLNA resnica + vsi
//                                            števci r266 odtisa (regresija
//                                            širine)
// RAW SQL (NE Prisma) — createdAt/updatedAt FIKSNI timestamps (determinizem
// odtisa); restore = bajtnata identičnost. LEKCIJE: quoted camelCase stolpci
// (R257); SAMO INSERT novih vrstic — NIČ UPDATE obstoječih (R261);
// idempotenten seed (DELETE pred INSERT, R262–R266); Project.clientToken NOT
// NULL brez DB defaulta — seed GA MORA podati eksplicitno (R265 lekcija 4).
const { Client } = require('pg')

const c = new Client({
  host: 'localhost',
  port: 5433,
  user: 'roksal',
  password: 'roksal',
  database: 'roksal_dev',
})

const ID_PREDPONA = 'e2e-r267-'

function danesIso() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const t = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${t}`
}

function isoPlusDni(dni) {
  const d = new Date()
  d.setDate(d.getDate() + dni)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const t = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${t}`
}

async function main() {
  await c.connect()
  const mode = process.argv[2] || 'fp'

  if (mode === 'seed') {
    // idempotentnost: starejši e2e-r267 ostanki IZBRANI pred vstavljanjem
    // (red vrstic: projekti → stranka — FK veriga)
    await c.query(`DELETE FROM "Project" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    await c.query(`DELETE FROM "Customer" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    // stranka (FK za projekte)
    await c.query(
      `INSERT INTO "Customer"
         (id, ime, naslov, status, "createdAt")
       VALUES ($1, $2, $3, 'AKTIVEN', '2026-09-29 06:00:00'::timestamp)`,
      [`${ID_PREDPONA}stranka`, 'E2E Spomniki Stranka', 'E2E Ulica 1, 4000 Kranj'],
    )
    // 5 projekti — VSE veje stanj spomnika + zgodovinska cona (podpisana).
    // Datumi DINAMIČNI (dnevna ravni — deterministično znotraj teka; seed se
    // po teku IZBRIŠE, odtis pre==post bajtnata identičnost).
    const projekti = [
      { id: `${ID_PREDPONA}proj1`, naziv: 'E2E Spomniki Blok A — Zapadel', status: 'NACRTOVANO', fu: `${isoPlusDni(-28)} 09:00:00`, opomba: 'Pokliči stranko — E2E sledenje ponudbe', dm: `${isoPlusDni(3)} 08:00:00`, locked: false },
      { id: `${ID_PREDPONA}proj2`, naziv: 'E2E Spomniki Blok B — Danes', status: 'V_TEKU', fu: `${danesIso()} 09:00:00`, opomba: null, dm: null, locked: false },
      { id: `${ID_PREDPONA}proj3`, naziv: 'E2E Spomniki Blok C — Kmalu', status: 'NACRTOVANO', fu: `${isoPlusDni(2)} 09:00:00`, opomba: null, dm: `${isoPlusDni(11)} 08:00:00`, locked: false },
      { id: `${ID_PREDPONA}proj4`, naziv: 'E2E Spomniki Blok D — Podpisana', status: 'ZAKLJUCENO', fu: `${isoPlusDni(-45)} 09:00:00`, opomba: null, dm: null, locked: true },
      { id: `${ID_PREDPONA}proj5`, naziv: 'E2E Spomniki Blok E — Brez Spomnika', status: 'V_TEKU', fu: null, opomba: null, dm: null, locked: false },
    ]
    for (const p of projekti) {
      await c.query(
        `INSERT INTO "Project"
           (id, "customerId", "nazivProjekta", status, "datumMontaze", "followUpDate", "followUpOpomba", "clientToken", "clientPortalEnabled", "measureEnabled", "dealLocked", "syncRevision", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5::timestamp, $6::timestamp, $7, $8, false, false, $9, 0, '2026-09-29 06:00:00'::timestamp, '2026-09-29 06:00:00'::timestamp)`,
        [p.id, `${ID_PREDPONA}stranka`, p.naziv, p.status, p.dm, p.fu, p.opomba, `${p.id}-portal`, p.locked],
      )
    }
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "Project" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ seeded: true, projektov: n.rows[0].n, danes: danesIso() }))
  } else if (mode === 'restore') {
    await c.query(`DELETE FROM "Project" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    await c.query(`DELETE FROM "Customer" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const p = await c.query(`SELECT COUNT(*)::int AS n FROM "Project" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const s = await c.query(`SELECT COUNT(*)::int AS n FROM "Customer" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ restored: true, ostankovProjektov: p.rows[0].n, ostankovStrank: s.rows[0].n }))
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
    // R267 — Customer + Project POLNA resnica (ta runda mutira projekto —
    // odtis MORA pokriti; pre==post bajtnata identičnost = ZERO-MUTACIJA
    // dokaz). Project vključuje followUp + podpisna polja (rundna resnica).
    const stranke = await c.query(`SELECT * FROM "Customer" ORDER BY id`)
    const projekti = await c.query(
      `SELECT id, "customerId", "nazivProjekta", status, "datumMontaze", "followUpDate", "followUpOpomba", "dealLocked", "dealLockedAt", "estimatedPrice", "clientToken", "clientPortalEnabled", "measureEnabled", "syncRevision", "createdAt", "updatedAt"
         FROM "Project" ORDER BY id`,
    )
    console.log(JSON.stringify({
      stevci: cnt.rows[0],
      stranke: stranke.rows,
      projekti: projekti.rows,
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
