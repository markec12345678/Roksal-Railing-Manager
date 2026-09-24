/**
 * R122 — GC ORODJE: sirote v object storage (artefakti pobrisanih projektov).
 * ---------------------------------------------------------------------------
 * Brisanje projektov kaskadno zbriše DB vrstice (ProjectPhoto, Sketch,
 * ArSnapshot, Document/DocumentVersion, SignatureAudit, …), a artefakti v
 * object storage so ostajali (dokumentirana vrzel v docs/STORAGE.md §8).
 * To orodje zapre zanko:
 *
 *   1) iz DB zbere VELJAVNE ključe (vse storageKey stolpce);
 *   2) iz object storage IZPIŠE obstoječe ključe (local walk | blob list);
 *   3) SIROTE = izpisane − veljavne  → (z --commit) IZBRIŠE;
 *   4) MANJKAJOČI = veljavni − izpisani → SAMO INTEGRITETNO POROČILO
 *      (iskreno: ne popravlja, ne taji — lastnik odloči o obnovi).
 *
 * VARNOST:
 *   • privzeto DRY RUN; brisanje ŠELE z `--commit`;
 *   • brise IZKLJUČNO ključe z dovoljenimi resursi (parseObjectKey whitelist —
 *     photos/sketches/ar-snapshots/gallery/documents/signatures); ključi
 *     `viz/…` (OgrajaVizija, ločen modul z lastnim GC) NISO dosegljivi;
 *   • fail-closed DB resolve (isti vzorec kot migrate-base64-to-storage);
 *   • idempotenten: ponovni zagon po --commit → 0 sirot.
 *
 * Zagon:
 *   bun tools/storage-gc.ts            # dry run (poročilo)
 *   bun tools/storage-gc.ts --commit   # dejansko brisanje sirot
 *
 * Ni AI, ni naključja. PostgreSQL-only.
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { deleteObject, listObjects, parseObjectKey } from '../src/lib/object-storage'

const COMMIT = process.argv.includes('--commit')

/** Fail-closed razrešitev DATABASE_URL (isti vzorec kot tools/db.ts). */
function resolveDatabaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL ?? null
  if (fromEnv && /^postgres(ql)?:\/\//.test(fromEnv)) return fromEnv
  try {
    const envPath = path.join(process.cwd(), '.env')
    const envFile = readFileSync(envPath, 'utf8')
    for (const line of envFile.split('\n')) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?\s*$/)
      if (m && /^postgres(ql)?:\/\//.test(m[1])) return m[1]
    }
  } catch {
    // .env ne obstaja — pade na spodnjo napako
  }
  throw new Error('DATABASE_URL (postgresql://) ni razrešen — fail closed.')
}

const prisma = new PrismaClient({
  datasources: { db: { url: resolveDatabaseUrl() } },
})

interface ResourceScan {
  table: string
  column: string
  keys: string[]
}

async function scanValidKeys(): Promise<ResourceScan[]> {
  const scans: ResourceScan[] = []

  const photos = await prisma.projectPhoto.findMany({ where: { storageKey: { not: null } }, select: { storageKey: true } })
  scans.push({ table: 'ProjectPhoto', column: 'storageKey', keys: photos.map((r) => r.storageKey!) })

  const sketches = await prisma.sketch.findMany({ where: { storageKey: { not: null } }, select: { storageKey: true } })
  scans.push({ table: 'Sketch', column: 'storageKey', keys: sketches.map((r) => r.storageKey!) })

  const ar = await prisma.arSnapshot.findMany({ where: { storageKey: { not: null } }, select: { storageKey: true } })
  scans.push({ table: 'ArSnapshot', column: 'storageKey', keys: ar.map((r) => r.storageKey!) })

  const gallery = await prisma.galleryItem.findMany({
    where: { OR: [{ slikaPredKey: { not: null } }, { slikaPoKey: { not: null } }] },
    select: { slikaPredKey: true, slikaPoKey: true },
  })
  scans.push({
    table: 'GalleryItem',
    column: 'slikaPredKey/slikaPoKey',
    keys: gallery.flatMap((r) => [r.slikaPredKey, r.slikaPoKey].filter((k): k is string => !!k)),
  })

  const documents = await prisma.document.findMany({ where: { storageKey: { not: null } }, select: { storageKey: true } })
  scans.push({ table: 'Document', column: 'storageKey', keys: documents.map((r) => r.storageKey!) })

  const versions = await prisma.documentVersion.findMany({ select: { storageKey: true } })
  scans.push({ table: 'DocumentVersion', column: 'storageKey', keys: versions.map((r) => r.storageKey) })

  const signatures = await prisma.signatureAudit.findMany({ where: { storageKey: { not: null } }, select: { storageKey: true } })
  scans.push({ table: 'SignatureAudit', column: 'storageKey', keys: signatures.map((r) => r.storageKey!) })

  return scans
}

async function main(): Promise<number> {
  console.log(`=== R122 storage GC (${COMMIT ? 'COMMIT — briše sirote' : 'DRY RUN'}) ===`)

  // 1) veljavni ključi iz DB
  const scans = await scanValidKeys()
  const valid = new Set<string>()
  for (const s of scans) {
    for (const k of s.keys) valid.add(k)
  }
  console.log(
    `DB veljavni ključi: ${valid.size} (photos=${scans[0].keys.length} sketches=${scans[1].keys.length} ar=${scans[2].keys.length} gallery=${scans[3].keys.length} documents=${scans[4].keys.length} versions=${scans[5].keys.length} signatures=${scans[6].keys.length})`,
  )

  // 2) izpis shrambe
  const listed = await listObjects('files/')
  console.log(`Shramba (files/): ${listed.length} objektov, driver=${process.env.OBJECT_STORAGE_DRIVER ?? (process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : 'local')}`)

  // 3) sirote
  const listedSet = new Set(listed)
  const orphans = listed.filter((k) => !valid.has(k))
  const perResource: Record<string, number> = {}
  for (const k of orphans) {
    const parsed = parseObjectKey(k)
    const res = parsed?.resource ?? 'NEVELJAVEN'
    perResource[res] = (perResource[res] ?? 0) + 1
  }

  console.log(`SIROTE (v shrambi, brez DB vrstice): ${orphans.length}`, JSON.stringify(perResource))
  for (const k of orphans.slice(0, 50)) console.log(`  • ${k}`)
  if (orphans.length > 50) console.log(`  … in še ${orphans.length - 50}`)

  // 4) integriteta: manjkajoči artefakti (veljavni brez bajtov)
  const missing = [...valid].filter((k) => !listedSet.has(k))
  if (missing.length > 0) {
    console.warn(`OPOZORILO — MANJKAJOČI ARTEFAKTI (DB vrstica brez bajtov): ${missing.length}`)
    for (const k of missing.slice(0, 20)) console.warn(`  ! ${k}`)
    if (missing.length > 20) console.warn(`  … in še ${missing.length - 20}`)
  }

  if (!COMMIT) {
    if (orphans.length > 0) console.log('DRY RUN — za brisanje sirot poženi z --commit.')
    else console.log('Ni sirot — nič za brisanje.')
    console.log('=== Povzetek ===', JSON.stringify({ orphans: orphans.length, missing: missing.length, committed: false }))
    return 0
  }

  // 5) brisanje sirot (samo whitelist ključi)
  let deleted = 0
  let skippedInvalid = 0
  for (const k of orphans) {
    if (!parseObjectKey(k)) {
      skippedInvalid++
      continue
    }
    try {
      await deleteObject(k)
      deleted++
    } catch (err) {
      console.error(`Napaka pri brisanju ${k}:`, err instanceof Error ? err.message : err)
    }
  }
  console.log(`=== Povzetek ===`, JSON.stringify({ orphans: orphans.length, deleted, skippedInvalid, missing: missing.length, committed: true }))
  return skippedInvalid > 0 ? 1 : 0
}

main()
  .then((code) => {
    void prisma.$disconnect()
    process.exit(code)
  })
  .catch(async (e) => {
    console.error('GC je padel:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
