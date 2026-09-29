// R269 — DB seed/restore + bajtni prstni odtis za E2E (lokalni dev DB, port 5433).
// UPORABA:
//   node scripts/r269-db-e2e.cjs seed-base    — vstavi 1 stranko + 1 projekt
//                                               ('E2E Teren Blok A', V_TEKU)
//                                               BREZ meritev — naravna
//                                               fail-closed veja Z1b (projekt
//                                               obstaja, 0 meritev);
//   node scripts/r269-db-e2e.cjs seed-meritve — vstavi 4 meritve
//                                               (id e2e-r269-mer1…4;
//                                               projekt MORA obstajati —
//                                               seed-base PRVN, drugače FK
//                                               kršitev; arMetadata JSON =
//                                               ENAK vir razčlenjenih polj
//                                               kot UI — tipMeritve/oznaka/
//                                               lokacija/opomba; status
//                                               stolpec = EN VIR R153; fiksni
//                                               timestamps):
//                                               mer1 OSNUTEK + VISINA +
//                                                 oznaka 'E2E višina stekla' +
//                                                 lokacija + opomba (AMBER
//                                                 akcija);
//                                               mer2 OSNUTEK + PRAZEN
//                                                 arMetadata (brez oznake —
//                                                 iskren odpad; tip fallback
//                                                 RAZDALJA);
//                                               mer3 POTRJENA + RAZDALJA +
//                                                 oznaka 'E2E dolžina
//                                                 zgornjega dela' + lokacija;
//                                               mer4 ARHIVIRANA + oznaka 'E2E
//                                                 stara meritev' + opomba
//                                                 (zgodovinska cona).
//                                               Pričakovan mini (viden seznam =
//                                               VSEH 4, statusFilter VSE):
//                                               'Meritve (viden seznam): 4
//                                               meritve · osnutki 2 ·
//                                               potrjenih 1 · arhiviranih 1' +
//                                               AMBER dot + žeton '2 osnutki'.
//                                               FRESH POST = ISTA resnica
//                                               (endpoint brez paginacije):
//                                               toast '4 meritve, osnutki 2,
//                                               potrjenih 1, arhiviranih 1.'
//   node scripts/r269-db-e2e.cjs seed         — seed-base + seed-meritve
//                                               (priročnik; E2E kliče ločeno)
//   node scripts/r269-db-e2e.cjs restore      — DELETE vseh 'e2e-r269-%'
//                                               vrstic (red: meritve →
//                                               projekt → stranka — FK veriga)
//   node scripts/r269-db-e2e.cjs fp           — bajtni prstni odtis (JSON) —
//                                               pre==post MORA biti IDENTIČEN
//                                               (ZERO-MUTACIJA); Measurement
//                                               POLNA resnica + Customer +
//                                               Project + vsi števci r268
//                                               odtisa (regresija širine)
// RAW SQL (NE Prisma) — createdAt/updatedAt FIKSNI timestamps (determinizem
// odtisa); restore = bajtnata identičnost. LEKCIJE: quoted camelCase stolpci
// (R257); SAMO INSERT novih vrstic — NIČ UPDATE obstoječih (R261);
// idempotenten seed (DELETE pred INSERT, R262–R268); Project.clientToken NOT
// NULL brez DB defaulta — seed GA MORA podati eksplicitno (R265 lekcija 4).
const { Client } = require('pg')

const c = new Client({
  host: 'localhost',
  port: 5433,
  user: 'roksal',
  password: 'roksal',
  database: 'roksal_dev',
})

const ID_PREDPONA = 'e2e-r269-'

const MERITVE_SEED = [
  {
    id: `${ID_PREDPONA}mer1`,
    status: 'OSNUTEK',
    dolzinaMm: 800,
    visinaMm: 1400,
    ar: '{"tipMeritve":"VISINA","oznaka":"E2E višina stekla","lokacija":"Balkon A","opomba":"E2E opomba osnutka"}',
  },
  {
    id: `${ID_PREDPONA}mer2`,
    status: 'OSNUTEK',
    dolzinaMm: 640,
    visinaMm: 900,
    ar: '{}',
  },
  {
    id: `${ID_PREDPONA}mer3`,
    status: 'POTRJENA',
    dolzinaMm: 1250,
    visinaMm: 1100,
    ar: '{"tipMeritve":"RAZDALJA","oznaka":"E2E dolžina zgornjega dela","lokacija":"Balkon B"}',
  },
  {
    id: `${ID_PREDPONA}mer4`,
    status: 'ARHIVIRANA',
    dolzinaMm: 2000,
    visinaMm: 1200,
    ar: '{"oznaka":"E2E stara meritev","opomba":"E2E zgodovinska"}',
  },
]

async function poCisti() {
  // idempotentnost: starejši e2e-r269 ostanki IZBRANI pred vstavljanjem
  // (red vrstic: meritve → projekti → stranka — FK veriga)
  await c.query(`DELETE FROM "Measurement" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
  await c.query(`DELETE FROM "Project" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
  await c.query(`DELETE FROM "Customer" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
}

async function main() {
  await c.connect()
  const mode = process.argv[2] || 'fp'

  if (mode === 'seed-base' || mode === 'seed') {
    await poCisti()
    // stranka (FK za projekt)
    await c.query(
      `INSERT INTO "Customer"
         (id, ime, naslov, status, "createdAt")
       VALUES ($1, $2, $3, 'AKTIVEN', '2026-09-29 06:00:00'::timestamp)`,
      [`${ID_PREDPONA}stranka`, 'E2E Teren Stranka', 'E2E Ulica 1, 4000 Kranj'],
    )
    // projekt (FK za meritve) — clientToken ekspliciten (R265 lekcija 4)
    await c.query(
      `INSERT INTO "Project"
         (id, "customerId", "nazivProjekta", status, "clientToken", "clientPortalEnabled", "measureEnabled", "dealLocked", "syncRevision", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'V_TEKU', $4, false, false, false, 0, '2026-09-29 06:00:00'::timestamp, '2026-09-29 06:00:00'::timestamp)`,
      [`${ID_PREDPONA}proj1`, `${ID_PREDPONA}stranka`, 'E2E Teren Blok A', `${ID_PREDPONA}proj1-portal`],
    )
    if (mode === 'seed') {
      // priročnik: osnova + meritve skupaj (E2E kliče ločeno — Z1b naravna
      // fail-closed veja potrebuje projekt BREZ meritev)
      for (const m of MERITVE_SEED) {
        await c.query(
          `INSERT INTO "Measurement"
             (id, "projectId", "dolzinaMm", "visinaMm", status, "arMetadata", "createdAt")
           VALUES ($1, $2, $3, $4, $5, $6, '2026-09-29 06:00:00'::timestamp)`,
          [m.id, `${ID_PREDPONA}proj1`, m.dolzinaMm, m.visinaMm, m.status, m.ar],
        )
      }
    }
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "Measurement" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ seeded: mode, meritev: n.rows[0].n }))
  } else if (mode === 'seed-meritve') {
    // 4 meritve — vse veje statusov; projekt MORA obstajati (seed-base PRVN).
    for (const m of MERITVE_SEED) {
      await c.query(
        `INSERT INTO "Measurement"
           (id, "projectId", "dolzinaMm", "visinaMm", status, "arMetadata", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, '2026-09-29 06:00:00'::timestamp)`,
        [m.id, `${ID_PREDPONA}proj1`, m.dolzinaMm, m.visinaMm, m.status, m.ar],
      )
    }
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "Measurement" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ seeded: mode, meritev: n.rows[0].n }))
  } else if (mode === 'restore') {
    await poCisti()
    const m = await c.query(`SELECT COUNT(*)::int AS n FROM "Measurement" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const p = await c.query(`SELECT COUNT(*)::int AS n FROM "Project" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    const s = await c.query(`SELECT COUNT(*)::int AS n FROM "Customer" WHERE id LIKE $1`, [`${ID_PREDPONA}%`])
    console.log(JSON.stringify({ restored: true, ostankovMeritev: m.rows[0].n, ostankovProjektov: p.rows[0].n, ostankovStrank: s.rows[0].n }))
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
              (SELECT COUNT(*) FROM "InstallationSchedule") AS termini,
              (SELECT COUNT(*) FROM "Measurement") AS meritve`,
    )
    // R269 — Measurement POLNA resnica (ta runda mutira meritve — odtis MORA
    // pokriti; pre==post bajtnata identičnost = ZERO-MUTACIJA dokaz).
    // Customer + Project polna resnica (seed ljubkuje tudi njiju — r267).
    const meritve = await c.query(
      `SELECT id, "projectId", "dolzinaMm", "visinaMm", status, "statusNote", "arMetadata", "gpsLokacija", "lidarScanUrl", "dedupeHash", "createdBy", "createdAt"
         FROM "Measurement" ORDER BY id`,
    )
    const stranke = await c.query(`SELECT * FROM "Customer" ORDER BY id`)
    const projekti = await c.query(
      `SELECT id, "customerId", "nazivProjekta", status, "datumMontaze", "followUpDate", "followUpOpomba", "dealLocked", "dealLockedAt", "estimatedPrice", "clientToken", "clientPortalEnabled", "measureEnabled", "syncRevision", "createdAt", "updatedAt"
         FROM "Project" ORDER BY id`,
    )
    console.log(JSON.stringify({
      stevci: cnt.rows[0],
      meritve: meritve.rows,
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
