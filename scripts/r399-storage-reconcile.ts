// R399 (issue #13 §18 — OBJECT STORAGE PRIVATE BY DEFAULT) — lastniški
// spravni CLI za object storage (isti vir kot /api/storage/reconcile:
// src/lib/object-reconciliation.ts).
//
// UPORABA (bun — natively poganja TS + tsconfig poti + .env):
//   bun run scripts/r399-storage-reconcile.ts                        # poročilo (privzeto)
//   bun run scripts/r399-storage-reconcile.ts --prune-orphans        # + briši sirote ≥ milostne dobe
//   bun run scripts/r399-storage-reconcile.ts --min-age-hours 72     # drugačna milostna doba
//   bun run scripts/r399-storage-reconcile.ts --migrate-private      # javni blobi → zasebni (PO-verifikacija)
//
// IZHODNE KODE (fail-closed):
//   0 = čisto (0 diskrepanc; pri --prune-orphans/--migrate-private: tudi
//       akcije uspele brez napak, preostanek = 0)
//   1 = NAJDENE diskrepanc (sirote/pretrgane vezave/checksumi) ali
//       napake akcij — poročilo je izpisano, ODLOČITEV je lastnikova
//   2 = operativna napaka (DB/driver nedosegljiv)
//
// NAČELA:
//   • pretrgane vezave in checksumi se NIKOLI ne brišejo/popravljajo
//     samodejno (integriteta poslovne resnice — poročilo, lastnik odloči);
//   • prune BRIŠE SAMO sirote (objekti BREZ DB vrstice) starejše od
//     milostne dobe (privzeto 48 h — pisanje v teku še NI sirota);
//   • --migrate-private je izrecna akcija (vedenjska detekcija javnega
//     dostopa + PO-verifikacija zavrnitve — glej object-storage.ts).
const MIN_AGE_DEFAULT_H = 48

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const prune = args.includes('--prune-orphans')
  const migrate = args.includes('--migrate-private')
  const ageIdx = args.indexOf('--min-age-hours')
  const minAgeHours =
    ageIdx >= 0 && args[ageIdx + 1] && /^\d+$/.test(args[ageIdx + 1])
      ? Number(args[ageIdx + 1])
      : MIN_AGE_DEFAULT_H

  const { reconcileStorage, pruneOrphanObjects } = await import('@/lib/object-reconciliation')
  const { migrateBlobAccessPrivate } = await import('@/lib/object-storage')
  const { objectStorageMode } = await import('@/lib/object-storage')

  console.log(`=== R399 storage sprava — driver: ${objectStorageMode()} ===`)
  console.log(
    `nacin: porocilo${prune ? ' + PRUNE SIROT (milostna doba ${minAgeHours} h)' : ''}${
      migrate ? ' + MIGRACIJA ZASEBNOSTI' : ''
    }\n`
  )

  let exit = 0

  // 1) poročilo
  const report = await reconcileStorage()
  console.log(
    `pregled: ${report.scannedRows} DB vezav, ${report.scannedObjects} objektov ` +
      `(driver ${report.driver}, ${report.generatedAt})`
  )
  console.log(
    `skupaj: sirot ${report.totals.orphans}, pretrganih vezav ${report.totals.brokenRefs}, ` +
      `checksum neujemanj ${report.totals.checksumMismatches}`
  )
  for (const [family, s] of Object.entries(report.byFamily)) {
    console.log(
      `  ${family.padEnd(13)} vezav ${String(s.rows).padStart(4)} · objektov ${String(s.objects).padStart(4)} · ` +
        `sirot ${s.orphans} · pretrganih ${s.brokenRefs} · checksumov ${s.checksumMismatches}` +
        (s.legacyRowsWithoutKey > 0 ? ` · (legacy brez kljuca: ${s.legacyRowsWithoutKey})` : '')
    )
  }
  for (const o of report.orphans) {
    console.log(`  SIROTA: ${o.key} (${o.sizeBytes} B, zapis ${o.uploadedAt ?? 'neznano'})`)
  }
  for (const b of report.brokenRefs) {
    console.log(`  PRETRGANA VEZAVA: ${b.family}/${b.rowId} → ${b.key} (objekt MANJKA)`)
  }
  for (const c of report.checksumMismatches) {
    console.log(
      `  CHECKSUM: ${c.family}/${c.rowId} → ${c.key} (pričakovano ${c.expectedSha256.slice(0, 12)}…, ` +
        `dejansko ${c.actualSha256.slice(0, 12)}…)`
    )
  }
  if (report.totals.orphans + report.totals.brokenRefs + report.totals.checksumMismatches > 0) {
    exit = 1
  }

  // 2) prune sirot (izrecno)
  if (prune && report.orphans.length > 0) {
    const meja = Date.now() - minAgeHours * 3600_000
    const kandidati = report.orphans.filter((o) => {
      if (!o.uploadedAt) return false // neznan čas → NE brišemo (fail-closed)
      return new Date(o.uploadedAt).getTime() <= meja
    })
    console.log(
      `\nprune: ${report.orphans.length} sirot, ${kandidati.length} starejših od ${minAgeHours} h ` +
        `(mlajše/z neznanim časom ostanejo — pisanja v teku)`
    )
    if (kandidati.length > 0) {
      const res = await pruneOrphanObjects(kandidati.map((o) => o.key))
      for (const k of res.deleted) console.log(`  zbrisan: ${k}`)
      for (const f of res.failed) {
        console.log(`  NAPAKA brisanja: ${f.key} — ${f.napaka}`)
        exit = exit === 2 ? 2 : 1
      }
    }
  }

  // 3) migracija zasebnosti (izrecno, blob driver)
  if (migrate) {
    const m = await migrateBlobAccessPrivate()
    console.log(
      `\nmigracija zasebnosti: preverjenih ${m.checked}, migriranih ${m.migrated}, ` +
        `že zasebnih ${m.alreadyPrivate}, napak ${m.failed}`
    )
    if (m.opomba) console.log(`  ${m.opomba}`)
    for (const e of m.entries.filter((x) => x.izid !== 'ze_zaseben')) {
      console.log(`  ${e.izid}: ${e.key}${e.napaka ? ` — ${e.napaka}` : ''}`)
    }
    if (m.failed > 0) exit = exit === 2 ? 2 : 1
  }

  console.log(`\n=== R399 sprava konec (EXIT ${exit}) ===`)
  return exit
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error('FAILOVEDANO: operativna napaka —', error)
    process.exit(2)
  })
