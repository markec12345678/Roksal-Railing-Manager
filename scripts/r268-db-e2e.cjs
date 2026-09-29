// R268 — DB prstni odtis za E2E (lokalni dev DB, port 5433) — ČISTO BRALNA
// runda: EKIPA — STANJE EKIPE PDF bere NARAVNI /api/users portfelj (6 računov:
// 2 ADMIN / 1 VODJA / 3 MONTER — vsi aktivni; R267 lekcija 2 — E2E pričakovanja
// štejejo NARAVNE vrstice) → NIČ seeding NI potreben in NIČ se ne mutira.
// UPORABA:
//   node scripts/r268-db-e2e.cjs fp        — bajtni prstni odtis (JSON) —
//                                            pre==post MORA biti IDENTIČEN
//                                            (ZERO-MUTACIJA). Profil POLNA
//                                            resnica BREZ passwordHash
//                                            (skrivnost NIKOLI v odtisu;
//                                            življenjski cikl POLNO pokrit:
//                                            deactivatedAt/lockedAt/invitedAt/
//                                            inviteExpiresAt/mustChangePassword)
//                                            + vsi števci r267 odtisa
//                                            (regresija širine).
//   node scripts/r268-db-e2e.cjs restore   — higiena: izbriše morebitne
//                                            STARE 'e2e-r267-%'/'e2e-r268-%'
//                                            ostanki (idempotentno; ta runda
//                                            nič ne seje — varnostni pomazek).
// ⚠️ lastActive se posodablja SAMO na /api/auth POST (prijava) — odtis PRE se
// jemlje PO prijavi (brez novih prijav med pre in post; UserSession/AuditLog/
// Notification NE v odtisu — rasteta po prijavi po oblikovanju).
const { Client } = require('pg')

const c = new Client({
  host: 'localhost',
  port: 5433,
  user: 'roksal',
  password: 'roksal',
  database: 'roksal_dev',
})

async function main() {
  await c.connect()
  const mode = process.argv[2] || 'fp'

  if (mode === 'restore') {
    // Higiena ostankov prejšnjih rund (ta runda NIČ ne seje).
    await c.query(`DELETE FROM "Project" WHERE id LIKE $1`, ['e2e-r267-%'])
    await c.query(`DELETE FROM "Customer" WHERE id LIKE $1`, ['e2e-r267-%'])
    await c.query(`DELETE FROM "Project" WHERE id LIKE $1`, ['e2e-r268-%'])
    await c.query(`DELETE FROM "Customer" WHERE id LIKE $1`, ['e2e-r268-%'])
    console.log(JSON.stringify({ restored: true, opomba: 'higiena — ta runda nič ne seje (bralna E2E)' }))
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
              (SELECT COUNT(*) FROM "Profile") AS clani`,
    )
    // R268 — Profil POLNA resnica BREZ passwordHash (skrivnost NIKOLI v
    // odtisu; življenjski cikl — rundna resnica — POLNO pokrit: timestamps +
    // mustChangePassword + invited kontekst). pre==post bajtnata identičnost
    // = ZERO-MUTACIJA dokaz.
    const clani = await c.query(
      `SELECT id, ime, email, vloga, telefon, "ekipaId", "lastActive", "createdAt", "updatedAt",
              "deactivatedAt", "lockedAt", "mustChangePassword", "inviteTokenHash" IS NOT NULL AS "imaInviteZeton",
              "inviteExpiresAt", "invitedBy", "invitedAt"
         FROM "Profile" ORDER BY email`,
    )
    console.log(JSON.stringify({
      stevci: cnt.rows[0],
      clani: clani.rows,
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
