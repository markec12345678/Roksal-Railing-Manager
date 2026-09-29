#!/usr/bin/env python3
"""R281 — generator skript (kanon gen-r280-skripte.py):
  1. r281-db-e2e.cjs        — seed-sync/restore/fp (e2e-r281-%, RAW SQL, idempotentno)
  2. r281-build-needles.sh  — r280 needle set + R281 sekcija (§10 sync metadata + stil)
  3. r281-run-smoke.sh      — dimni test (vzorec r280)
  4. r281-prod-qa.sh        — build-guard (build > R280 11:24:57.844Z) + LIVE needleji
  5. r281-e2e-browser.sh    — r280 E2E tok + Z1s sync žig ŽIVO
"""
import re

ROOT = '/home/z/my-project'
SCRIPTS = ROOT + '/scripts'


def beri(pot):
    with open(pot, encoding='utf-8') as f:
        return f.read()


def pisi(pot, vsebina):
    with open(pot, 'w', encoding='utf-8') as f:
        f.write(vsebina)
    print('  napisana:', pot)


# ---------------------------------------------------------------- 1. db-e2e
DB_E2E = r'''// R281 DB E2E orodje (kanon r276-db-e2e.cjs — RAW SQL, SAMO INSERT novih
// vrstic, idempotentno):
//   node scripts/r281-db-e2e.cjs seed-sync — vstavi 1 stranko + 1 projekt
//                ('e2e-r281-proj', V_TEKU) + 2 meritvi s sync metadata
//                (issue #16 §10, V1–V6):
//                  m1 'e2e-r281-m1': syncState 'synced', syncRevision 7,
//                     tombstone false (izrecno NE grobnica — V4);
//                  m2 'e2e-r281-m2': syncState 'conflict', tombstone true —
//                fiksni timestamps (determinizem odtisa);
//   node scripts/r281-db-e2e.cjs restore — DELETE vseh 'e2e-r281-%' vrstic
//                (red: audit → meritve → projekt → stranka — FK veriga);
//   node scripts/r281-db-e2e.cjs fp — bajtni prstni odtis (JSON):
//                pre==post MORA biti IDENTIČEN (ZERO-MUTACIJA).
const { Client } = require('pg')

const c = new Client({
  host: 'localhost',
  port: 5433,
  user: 'roksal',
  password: 'roksal',
  database: 'roksal_dev',
})

const TS = '2026-09-29T09:00:00Z'

const AR_M1 = JSON.stringify({
  tipMeritve: 'VISINA',
  kot: 87,
  sync: {
    mutationId: 'mut-r281-001',
    deviceId: 'device-pixel-8',
    baseRevision: 3,
    baseUpdatedAt: '2026-09-29T07:15:00Z',
    syncRevision: 7,
    syncState: 'synced',
    tombstone: false,
  },
})

const AR_M2 = JSON.stringify({
  tipMeritve: 'VISINA',
  sync: {
    mutationId: 'mut-r281-002',
    deviceId: 'device-pixel-8',
    baseRevision: 3,
    baseUpdatedAt: '2026-09-29T07:15:00Z',
    syncState: 'conflict',
    tombstone: true,
  },
})

async function main() {
  const cmd = process.argv[2]
  if (!cmd || !['seed-sync', 'restore', 'fp'].includes(cmd)) {
    console.error('Uporaba: node scripts/r281-db-e2e.cjs [seed-sync|restore|fp]')
    process.exit(1)
  }
  await c.connect()

  if (cmd === 'seed-sync') {
    // Idempotenca: čist začetek pred INSERT (vzorec r272–r280).
    await c.query(`DELETE FROM "AuditLog" WHERE "projectId" = 'e2e-r281-proj'`)
    await c.query(`DELETE FROM "Measurement" WHERE "projectId" = 'e2e-r281-proj'`)
    await c.query(`DELETE FROM "Project" WHERE "id" = 'e2e-r281-proj'`)
    await c.query(`DELETE FROM "Customer" WHERE "id" = 'e2e-r281-str'`)
    await c.query(
      `INSERT INTO "Customer" ("id","ime","naslov","createdAt") VALUES ($1,$2,$3,$4)`,
      ['e2e-r281-str', 'E2E r281 Stranka', 'Test 1', TS]
    )
    await c.query(
      `INSERT INTO "Project" ("id","strankaId","naziv","status","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$5)`,
      ['e2e-r281-proj', 'e2e-r281-str', 'E2E r281 Projekt', 'V_TEKU', TS]
    )
    await c.query(
      `INSERT INTO "Measurement" ("id","projectId","dolzinaMm","visinaMm","createdAt","status","arMetadata") VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      ['e2e-r281-m1', 'e2e-r281-proj', 3200, 1200, TS, 'POTRJENA', AR_M1]
    )
    await c.query(
      `INSERT INTO "Measurement" ("id","projectId","dolzinaMm","visinaMm","createdAt","status","arMetadata") VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      ['e2e-r281-m2', 'e2e-r281-proj', 2400, 1100, TS, 'OSNUTEK', AR_M2]
    )
    const n = await c.query(
      `SELECT COUNT(*)::int AS n FROM "Measurement" WHERE "projectId" = 'e2e-r281-proj'`
    )
    console.log(`seed-sync OK — meritve: ${n.rows[0].n} (pričakovano 2)`)
  }

  if (cmd === 'restore') {
    // RED: audit → meritve → projekt → stranka (FK veriga — kanon r276).
    await c.query(`DELETE FROM "AuditLog" WHERE "projectId" = 'e2e-r281-proj'`)
    await c.query(`DELETE FROM "Measurement" WHERE "projectId" = 'e2e-r281-proj'`)
    await c.query(`DELETE FROM "Project" WHERE "id" = 'e2e-r281-proj'`)
    await c.query(`DELETE FROM "Customer" WHERE "id" = 'e2e-r281-str'`)
    console.log('restore OK — e2e-r281-% očiščeno')
  }

  if (cmd === 'fp') {
    const fp = {}
    for (const t of ['Customer', 'Project', 'Measurement', 'AuditLog']) {
      const r = await c.query(
        `SELECT to_jsonb(t) FROM "${t}" t WHERE ` +
          (t === 'Customer'
            ? `t."id" LIKE 'e2e-r281%'`
            : t === 'Project'
              ? `t."id" LIKE 'e2e-r281%'`
              : t === 'Measurement'
                ? `t."projectId" LIKE 'e2e-r281%'`
                : `t."projectId" LIKE 'e2e-r281%'`) +
          ` ORDER BY t."id"`
      )
      fp[t] = r.rows.map((x) => x.to_jsonb)
    }
    console.log(JSON.stringify(fp))
  }

  await c.end()
}

main().catch((e) => {
  console.error('NAPAKA:', e.message)
  process.exit(1)
})
'''
pisi(SCRIPTS + '/r281-db-e2e.cjs', DB_E2E)

# ---------------------------------------------------- 2. build-needles (r280 + R281)
B280 = beri(SCRIPTS + '/r280-build-needles.sh')
R281_SEKCIJA = '''echo "--- R281 sync metadata (issue #16 §10 — kontrakt, server chunks, V1–V6) ---"
need_static "session-level sync blok opcijsko" "R281 matrika razširitev žig (izrečno — V1 aditivna v1)"
need_static "razmejitev provenance vs. protocol" "R281 V3 razmejitev žig (opazovano stanje klienta — NIKOLI sync resnica)"
need_static "V1–V6" "R281 matrika V-serija (izrečno)"
need_static "syncState" "R281 sync.syncState wire polje (V2 — zaprt besednjak čakalnega vrsta)"
need_static "baseRevision" "R281 sync.baseRevision wire polje (shema /api/sync — ENA resnica o mejah)"
need_static "syncRevision" "R281 sync.syncRevision wire polje (echo — nazadnje viden serverState)"
need_static "tombstone" "R281 sync.tombstone wire polje (V4 — false = izrecno NE grobnica)"
echo "--- R281 MANDATORY STIL — sync žig title ×4 + tombstone note (hover parity) ---"
need_static "Sinhronizacijsko stanje: Sinhronizirano" "R281 sync žig title SYNCED"
need_static "Sinhronizacijsko stanje: V čakalni vrsti" "R281 sync žig title PENDING"
need_static "Sinhronizacijsko stanje: Konflikt" "R281 sync žig title CONFLICT"
need_static "Sinhronizacijsko stanje: Napaka" "R281 sync žig title ERROR"
need_static "tombstone — grobnico potrdi /api/sync" "R281 tombstone note (title append — iskrena razlaga)"
need_static "Sync metadata (opazovano stanje klienta" "R281 TooltipContent (NI sync resnica — pariteta)"
echo "--- R280 produkt reference (issue #16 §3 — kontrakt, U1–U6) ---"'''
B281 = B280.replace(
    'echo "--- R280 produkt reference (issue #16 §3 — kontrakt, U1–U6) ---"',
    R281_SEKCIJA,
    1,
)
B281 = B281.replace('# R280 — build needleji:', '# R281 — build needleji:', 1)
B281 = B281.replace('OUT=/tmp/r280-build-chunks', 'OUT=/tmp/r281-build-chunks', 1)
B281 = B281.replace('must_miss "TODO-R280" "R280 — brez razvojnih ostankov"',
                    'must_miss "TODO-R281" "R281 — brez razvojnih ostankov"\nmust_miss "TODO-R280" "R280 — brez razvojnih ostankov"', 1)
B281 = B281.replace('echo "NEEDLE FAIL=$FAIL (R280 ×15 novih;',
                    'echo "NEEDLE FAIL=$FAIL (R281 ×13 novih; R280 ×15;', 1)
pisi(SCRIPTS + '/r281-build-needles.sh', B281)

# ---------------------------------------------------- 3. run-smoke
S280 = beri(SCRIPTS + '/r280-run-smoke.sh')
S281 = S280.replace('# R280 dimni test', '# R281 dimni test', 1)
S281 = S281.replace(
    'build z R280 spremembami (produkt reference profile/color/material/\n# handrail/posts/configuration — issue #16 §3, U1–U6 + tip/kot badge title stil) vstane in odgovarja fail-closed.',
    'build z R281 spremembami (sync metadata session-level blok — issue #16 §10,\n# V1–V6 + sync žig stil) vstane in odgovarja fail-closed.', 1)
S281 = S281.replace('R280-smoke-lokalni-sekret', 'R281-smoke-lokalni-sekret', 1)
S281 = S281.replace('R280-server-smoke.log', 'R281-server-smoke.log', 1)
S281 = S281.replace('--- R280 SMOKE KONEC ---', '--- R281 SMOKE KONEC ---', 1)
pisi(SCRIPTS + '/r281-run-smoke.sh', S281)

print('OSNOVA OK — 3/5 skript')
