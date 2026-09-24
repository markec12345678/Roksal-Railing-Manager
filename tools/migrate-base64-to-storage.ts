/**
 * R121 — MIGRACIJA base64 → OBJECT STORAGE (issue #7)
 * ---------------------------------------------------------------------------
 * Idempotentna, deterministična enkratna migracija: bajti (base64 data URI)
 * iz DB stolpcev gredo v object storage; vrstica dobi metadata
 * (storageKey/mime/sizeBytes/sha256) in legacy stolpec se NULL-a.
 *
 * Pokriti viri:
 *   ProjectPhoto.imageData → files/photos/<id>/slika.<ext>
 *   Sketch.pngData         → files/sketches/<id>/skica.<ext>
 *   ArSnapshot.imageUrl    → files/ar-snapshots/<id>/posnetek.<ext>
 *   GalleryItem.slikaPred  → files/gallery/<id>/pred.<ext>   (samo data URI;
 *   GalleryItem.slikaPo    → files/gallery/<id>/po.<ext>      URL ostane)
 *   SignatureAudit.signatureImage → files/signatures/<id>/podpis.<ext>  (R122)
 *
 * VARNOST:
 *   • privzeto DRY RUN (pokaže, kaj bi naredil); zapiše ŠELE z `--commit`;
 *   • idempotenten: vrstice s storageKey se preskočijo — ponovni zagon je varen;
 *   • neparsljiv base64 = javljen in PRESKOČEN (ne tiho, ne pokvarjen);
 *   • brez brisanja bajtov pred uspešnim zapisom (DB legacy stolpec se NULL-a
 *     šele po potrjenem put-u).
 *
 * Zagon:
 *   bun tools/migrate-base64-to-storage.ts           # dry run
 *   bun tools/migrate-base64-to-storage.ts --commit  # dejanska migracija
 *
 * Ni AI, ni naključja. PostgreSQL-only (fail-closed db resolve).
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  deleteObject,
  extensionForMime,
  objectKey,
  parseDataUri,
  putObject,
} from '../src/lib/object-storage'

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

interface SourceRow {
  table: string
  id: string
  slot: string
  projectId: string | null
}

interface Outcome {
  table: string
  id: string
  slot: string
  action: 'migrated' | 'skipped-storage-key' | 'unparseable' | 'url-kept' | 'error' | 'dry-run'
  key?: string
  sizeBytes?: number
  sha256?: string
  message?: string
}

/** Migriraj EN vnos (data URI → storage + metadata update + legacy NULL). */
async function migrateRow(
  row: SourceRow,
  dataUri: string,
  update: (id: string, key: string, mime: string, sizeBytes: number, sha256: string) => Promise<unknown>
): Promise<Outcome> {
  const parsed = parseDataUri(dataUri)
  if (!parsed) {
    // URL (gallery) ali pokvarjen base64 — ločimo zunanji vidik:
    if (dataUri.startsWith('http') || dataUri.startsWith('/')) {
      return { ...row, action: 'url-kept', message: 'URL ostane v DB (ni bajtov)' }
    }
    return { ...row, action: 'unparseable', message: 'base64/data URI neuporaben — ročno preveri' }
  }

  const key = objectKey(
    row.table === 'photos'
      ? 'photos'
      : row.table === 'sketches'
        ? 'sketches'
        : row.table === 'ar-snapshots'
          ? 'ar-snapshots'
          : row.table === 'signatures'
            ? 'signatures'
            : 'gallery',
    row.id,
    `${row.slot}.${extensionForMime(parsed.mime)}`
  )

  if (!COMMIT) {
    return {
      ...row,
      action: 'dry-run',
      key,
      sizeBytes: parsed.bytes.length,
      message: 'dry run — zapiši z --commit',
    }
  }

  try {
    const put = await putObject(key, parsed.bytes, parsed.mime)
    await update(row.id, put.key, parsed.mime, put.sizeBytes, put.sha256)
    return { ...row, action: 'migrated', key: put.key, sizeBytes: put.sizeBytes, sha256: put.sha256 }
  } catch (error) {
    // Kompenzacija: če je bajt morda zapisan, ne puščamo sirote.
    await deleteObject(key).catch(() => {})
    return {
      ...row,
      action: 'error',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

async function main(): Promise<number> {
  console.log(`=== R121 base64 → object storage (${COMMIT ? 'COMMIT' : 'DRY RUN'}) ===`)

  const outcomes: Outcome[] = []

  // ── ProjectPhoto ──────────────────────────────────────────────────────────
  const photos = await prisma.projectPhoto.findMany({
    where: { imageData: { not: null }, storageKey: null },
    select: { id: true, projectId: true, imageData: true },
  })
  for (const p of photos) {
    outcomes.push(
      await migrateRow(
        { table: 'photos', id: p.id, slot: 'slika', projectId: p.projectId },
        p.imageData!,
        (id, key, mime, sizeBytes, sha256) =>
          prisma.projectPhoto.update({
            where: { id },
            data: { storageKey: key, mime, sizeBytes, sha256, imageData: null },
          })
      )
    )
  }

  // ── Sketch ────────────────────────────────────────────────────────────────
  const sketches = await prisma.sketch.findMany({
    where: { pngData: { not: null }, storageKey: null },
    select: { id: true, projectId: true, pngData: true },
  })
  for (const s of sketches) {
    outcomes.push(
      await migrateRow(
        { table: 'sketches', id: s.id, slot: 'skica', projectId: s.projectId },
        s.pngData!,
        (id, key, mime, sizeBytes, sha256) =>
          prisma.sketch.update({
            where: { id },
            data: { storageKey: key, mime, sizeBytes, sha256, pngData: null },
          })
      )
    )
  }

  // ── ArSnapshot ────────────────────────────────────────────────────────────
  const snapshots = await prisma.arSnapshot.findMany({
    where: { imageUrl: { not: null }, storageKey: null },
    select: { id: true, projectId: true, imageUrl: true },
  })
  for (const a of snapshots) {
    outcomes.push(
      await migrateRow(
        { table: 'ar-snapshots', id: a.id, slot: 'posnetek', projectId: a.projectId },
        a.imageUrl!,
        (id, key, mime, sizeBytes, sha256) =>
          prisma.arSnapshot.update({
            where: { id },
            data: { storageKey: key, mime, sizeBytes, sha256, imageUrl: null },
          })
      )
    )
  }

  // ── GalleryItem (slikaPred + slikaPo; URL-ji ostanejo) ────────────────────
  const gallery = await prisma.galleryItem.findMany({
    where: {
      AND: [
        {
          OR: [
            { slikaPred: { not: null }, slikaPredKey: null },
            { slikaPo: { not: null }, slikaPoKey: null },
          ],
        },
      ],
    },
    select: { id: true, projectId: true, slikaPred: true, slikaPo: true },
  })
  for (const g of gallery) {
    if (g.slikaPred && !g.slikaPredKey) {
      outcomes.push(
        await migrateRow(
          { table: 'gallery', id: g.id, slot: 'pred', projectId: g.projectId },
          g.slikaPred,
          (id, key, mime, sizeBytes, sha256) =>
            prisma.galleryItem.update({
              where: { id },
              data: { slikaPredKey: key, slikaPredMime: mime, slikaPredSize: sizeBytes, slikaPredSha256: sha256 },
            })
        )
      )
    }
    if (g.slikaPo && !g.slikaPoKey) {
      outcomes.push(
        await migrateRow(
          { table: 'gallery', id: g.id, slot: 'po', projectId: g.projectId },
          g.slikaPo,
          (id, key, mime, sizeBytes, sha256) =>
            prisma.galleryItem.update({
              where: { id },
              data: { slikaPoKey: key, slikaPoMime: mime, slikaPoSize: sizeBytes, slikaPoSha256: sha256 },
            })
        )
      )
    }
  }

  // ── SignatureAudit (R122: pravno občutljivi podpisi izven baze) ──────────
  const signatures = await prisma.signatureAudit.findMany({
    where: { signatureImage: { not: null }, storageKey: null },
    select: { id: true, projectId: true, signatureImage: true },
  })
  for (const s of signatures) {
    outcomes.push(
      await migrateRow(
        { table: 'signatures', id: s.id, slot: 'podpis', projectId: s.projectId },
        s.signatureImage!,
        (id, key, mime, sizeBytes, sha256) =>
          prisma.signatureAudit.update({
            where: { id },
            data: { storageKey: key, mime, sizeBytes, sha256, signatureImage: null },
          })
      )
    )
  }

  // ── Poročilo ──────────────────────────────────────────────────────────────
  const byAction: Record<string, number> = {}
  for (const o of outcomes) byAction[o.action] = (byAction[o.action] ?? 0) + 1
  for (const o of outcomes) {
    const target = o.key ?? '—'
    console.log(
      `[${o.action}] ${o.table}/${o.id} (${o.slot}) → ${target}${o.sizeBytes != null ? ` · ${o.sizeBytes} B` : ''}${o.message ? ` · ${o.message}` : ''}`
    )
  }
  console.log('=== Povzetek ===', JSON.stringify(byAction))

  const hardFail = byAction['error'] ?? 0
  if (hardFail > 0) {
    console.error(`NEUSPEH: ${hardFail} napak — ponovno poženi (idempotentno) ali ročno preveri.`)
    return 1
  }
  const unparseable = byAction['unparseable'] ?? 0
  if (unparseable > 0) {
    console.warn(`OPOZORILO: ${unparseable} neparsljivih vnosov — ostajajo v DB (legacy).`)
  }
  if (!COMMIT) {
    console.log('DRY RUN — za dejansko migracijo poženi z --commit.')
  } else {
    console.log('MIGRACIJA DOKONČANA. Preveri: vsi storageKey obstajajo (hasObject).')
  }
  return 0
}

main()
  .then((code) => {
    void prisma.$disconnect()
    process.exit(code)
  })
  .catch(async (e) => {
    console.error('Migracija je padla:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
