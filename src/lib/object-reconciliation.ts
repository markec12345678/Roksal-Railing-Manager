/**
 * R399 (issue #13 §18 — OBJECT STORAGE PRIVATE BY DEFAULT) — orphan
 * reconciliation: DB je vir resnice (R121: DB hrani SAMO metadata, bajti
 * živijo v object storage), zato se BOTH pojavitveni neujemanji odkrijeta
 * in poročata:
 *
 *   1. SIROTA (orphan) — objekt v storage BREZ DB vrstice: pisanje se je
 *      zrušilo med putObject in DB transakcijo (kompenzacija deleteObject
 *      ni stekla — R374/R376/R395 pišejo kompenzacijo, a procesni zruški
 *      pustijo ostanek), ALI je bila vrstica zbrisana brez deleteObject.
 *      Milostna doba (uploadedAt — skript, privzeto 48 h) loči siroto od
 *      pisanja, ki je PRAV KAR V TEKU.
 *   2. PRETRGANA VEZAVA (broken reference) — DB vrstica se sklicuje na
 *      ključ, ki v storage NE obstaja (izguba/brisanje artefakta). To je
 *      NARUŠITEV integritete poslovne resnice → poročilo, NIKOLI samodejni
 *      popravek (vrstica ostane — lastnik odloči o obnovi).
 *   3. NAPAČEN CHECKSUM — bajti v storage ≠ sha256 v DB (tampiranje ali
 *      pokvarjenost). Poročilo + točen pričakovani/dejanski hash; §16
 *      deal-lock veriga take artefakte ŽE zavrne ob zaklepu (R395
 *      RE-HASH); ta sweep pokriva VSE družine (fotografije, skice, AR,
 *      galerija, dokumenti, podpisi).
 *
 * Poganja se:
 *   • skript scripts/r399-storage-reconcile.ts (report privzeto;
 *     --prune-orphans briše SAMO sirote starejše od milostne dobe;
 *     --migrate-private spreobrne javne blob objekte v zasebne);
 *   • GET /api/storage/reconcile (vodstvo — poročilo brez bajtov).
 *
 * Fail-closed: nobena funkcija tukaj NE briše vrstic, NE popravlja hashov,
 * NE mutira skladnosti — samo poroča (pruneOrphanObjects briše IZRECNO
 * podane ključe; klicatelj — skript — izbere sirote po milostni dobi).
 */
import { db } from '@/lib/db'
import {
  getObject,
  hasObject,
  deleteObject,
  listObjectEntries,
  objectStorageMode,
  parseObjectKey,
  sha256Of,
  type ObjectStorageMode,
  type StorageResource,
} from '@/lib/object-storage'

/** Sklic DB vrstice na objekt (družina + vrstica + pričakovani sha256). */
interface RowRef {
  family: StorageResource
  rowId: string
  key: string
  expectedSha256: string | null
}

export interface ReconcileOrphan {
  key: string
  family: StorageResource
  sizeBytes: number
  /** ISO čas zapisa (local mtime / blob uploadedAt); null = neznan. */
  uploadedAt: string | null
}

export interface ReconcileBrokenRef {
  family: StorageResource
  rowId: string
  key: string
}

export interface ReconcileChecksumMismatch {
  family: StorageResource
  rowId: string
  key: string
  expectedSha256: string
  actualSha256: string
}

export interface ReconcileFamilySummary {
  /** Število DB vezav s ključem (galerija pred+po štejeta 2; dokument
   *  verzije + legacy kazalčki štejejo vsak svojo vezavo). */
  rows: number
  /** Vrstice brez ključa (zapuščina pred R121 backfillom) — odkrito
   *  šteto, NISO pretrgane vezave. */
  legacyRowsWithoutKey: number
  objects: number
  orphans: number
  brokenRefs: number
  checksumMismatches: number
}

export interface ReconcileReport {
  driver: ObjectStorageMode
  generatedAt: string
  scannedRows: number
  scannedObjects: number
  totals: { orphans: number; brokenRefs: number; checksumMismatches: number }
  orphans: ReconcileOrphan[]
  brokenRefs: ReconcileBrokenRef[]
  checksumMismatches: ReconcileChecksumMismatch[]
  byFamily: Record<StorageResource, ReconcileFamilySummary>
}

/** Prazna družinska statistika (za vsako od 6 družin). */
function emptySummary(): ReconcileFamilySummary {
  return {
    rows: 0,
    legacyRowsWithoutKey: 0,
    objects: 0,
    orphans: 0,
    brokenRefs: 0,
    checksumMismatches: 0,
  }
}

/** Zberi VSE sklice vrstic na objekte (po družinah, izključno ključi ≠ null). */
async function zberiSklice(): Promise<{
  refs: RowRef[]
  legacy: Record<StorageResource, number>
}> {
  const legacy: Record<StorageResource, number> = {
    photos: 0,
    sketches: 0,
    'ar-snapshots': 0,
    gallery: 0,
    documents: 0,
    signatures: 0,
  }
  const refs: RowRef[] = []

  // photographs — projectPhoto.storageKey
  for (const r of await db.projectPhoto.findMany({
    select: { id: true, storageKey: true, sha256: true },
  })) {
    if (!r.storageKey) {
      legacy.photos += 1
      continue
    }
    refs.push({ family: 'photos', rowId: r.id, key: r.storageKey, expectedSha256: r.sha256 })
  }

  // skice — sketch.storageKey
  for (const r of await db.sketch.findMany({
    select: { id: true, storageKey: true, sha256: true },
  })) {
    if (!r.storageKey) {
      legacy.sketches += 1
      continue
    }
    refs.push({ family: 'sketches', rowId: r.id, key: r.storageKey, expectedSha256: r.sha256 })
  }

  // AR posnetki — arSnapshot.storageKey
  for (const r of await db.arSnapshot.findMany({
    select: { id: true, storageKey: true, sha256: true },
  })) {
    if (!r.storageKey) {
      legacy['ar-snapshots'] += 1
      continue
    }
    refs.push({
      family: 'ar-snapshots',
      rowId: r.id,
      key: r.storageKey,
      expectedSha256: r.sha256,
    })
  }

  // galerija — slikaPredKey + slikaPoKey (DVE vezavi na vrstico)
  for (const r of await db.galleryItem.findMany({
    select: {
      id: true,
      slikaPredKey: true,
      slikaPredSha256: true,
      slikaPoKey: true,
      slikaPoSha256: true,
    },
  })) {
    if (r.slikaPredKey) {
      refs.push({
        family: 'gallery',
        rowId: r.id,
        key: r.slikaPredKey,
        expectedSha256: r.slikaPredSha256,
      })
    } else {
      legacy.gallery += 1
    }
    if (r.slikaPoKey) {
      refs.push({
        family: 'gallery',
        rowId: r.id,
        key: r.slikaPoKey,
        expectedSha256: r.slikaPoSha256,
      })
    } else {
      legacy.gallery += 1
    }
  }

  // dokumenti — KANONIČNO DocumentVersion.storageKey (immutable verzije,
  // R374/R395) + legacy Document.storageKey kazalčnik (R121 prehod — isti
  // ključ lahko vezuje OBE vrstici; skupinska mapa spodaj to deduplicira)
  for (const r of await db.documentVersion.findMany({
    select: { id: true, storageKey: true, sha256: true },
  })) {
    refs.push({
      family: 'documents',
      rowId: r.id,
      key: r.storageKey,
      expectedSha256: r.sha256,
    })
  }
  for (const r of await db.document.findMany({
    select: { id: true, storageKey: true, sha256: true },
  })) {
    if (!r.storageKey) {
      legacy.documents += 1
      continue
    }
    refs.push({ family: 'documents', rowId: r.id, key: r.storageKey, expectedSha256: r.sha256 })
  }

  // podpisi — signatureAudit.storageKey (R121/R122)
  for (const r of await db.signatureAudit.findMany({
    select: { id: true, storageKey: true, sha256: true },
  })) {
    if (!r.storageKey) {
      legacy.signatures += 1
      continue
    }
    refs.push({
      family: 'signatures',
      rowId: r.id,
      key: r.storageKey,
      expectedSha256: r.sha256,
    })
  }

  return { refs, legacy }
}

/**
 * Celovit spravni pregled: sirote + pretrgane vezave + checksum sweep
 * (vsak obstoječi sklic prebere in RE-HASHIRA — isto jedro kot §16
 * deal-lock RE-HASH R395, razširjeno na VSE družine).
 * Deterministično, samo-bralno, fail-closed (nikoli ne mutira).
 */
export async function reconcileStorage(now: Date = new Date()): Promise<ReconcileReport> {
  const { refs, legacy } = await zberiSklice()

  // sklici po ključu (dedup za checksum preverbo; vsaka vezava se šteje)
  const refsByKey = new Map<string, RowRef[]>()
  for (const ref of refs) {
    const list = refsByKey.get(ref.key)
    if (list) list.push(ref)
    else refsByKey.set(ref.key, [ref])
  }

  const entries = await listObjectEntries()
  const storageKeys = new Set(entries.map((e) => e.key))

  const report: ReconcileReport = {
    driver: objectStorageMode(),
    generatedAt: now.toISOString(),
    scannedRows: refs.length,
    scannedObjects: entries.length,
    totals: { orphans: 0, brokenRefs: 0, checksumMismatches: 0 },
    orphans: [],
    brokenRefs: [],
    checksumMismatches: [],
    byFamily: {
      photos: emptySummary(),
      sketches: emptySummary(),
      'ar-snapshots': emptySummary(),
      gallery: emptySummary(),
      documents: emptySummary(),
      signatures: emptySummary(),
    },
  }

  // 1) SIROTE: objekt v storage brez (veljavne) DB vezave
  for (const entry of entries) {
    const parsed = parseObjectKey(entry.key)
    const family = parsed?.resource ?? 'documents' // parseObjectKey je že filtriral nabor
    report.byFamily[family].objects += 1
    if (!refsByKey.has(entry.key)) {
      report.byFamily[family].orphans += 1
      report.orphans.push({
        key: entry.key,
        family,
        sizeBytes: entry.sizeBytes,
        uploadedAt: entry.uploadedAt ? entry.uploadedAt.toISOString() : null,
      })
    }
  }

  // 2) PRETRGANE VEZAVE + 3) CHECKSUM SWEEP
  for (const [key, keyRefs] of refsByKey) {
    for (const ref of keyRefs) {
      report.byFamily[ref.family].rows += 1
    }
    const obstaja = storageKeys.has(key) && (await hasObject(key))
    if (!obstaja) {
      for (const ref of keyRefs) {
        report.byFamily[ref.family].brokenRefs += 1
        report.brokenRefs.push({ family: ref.family, rowId: ref.rowId, key })
      }
      continue
    }
    // obstaja → RE-HASH preverba (samo za vezave s pričakovanim hashom)
    const bytes = await getObject(key)
    if (!bytes) {
      // hasObject je potrdil, getObject pa spodletel — obravnavaj kot
      // pretrgano vezavo (fail-closed konservativno)
      for (const ref of keyRefs) {
        report.byFamily[ref.family].brokenRefs += 1
        report.brokenRefs.push({ family: ref.family, rowId: ref.rowId, key })
      }
      continue
    }
    const actual = sha256Of(bytes)
    for (const ref of keyRefs) {
      if (ref.expectedSha256 && ref.expectedSha256 !== actual) {
        report.byFamily[ref.family].checksumMismatches += 1
        report.checksumMismatches.push({
          family: ref.family,
          rowId: ref.rowId,
          key,
          expectedSha256: ref.expectedSha256,
          actualSha256: actual,
        })
      }
    }
  }

  // zapuščinske vrstice brez ključa (R121 pred backfillom) — odkrito štetje
  for (const family of Object.keys(legacy) as StorageResource[]) {
    report.byFamily[family].legacyRowsWithoutKey = legacy[family]
  }

  report.totals = {
    orphans: report.orphans.length,
    brokenRefs: report.brokenRefs.length,
    checksumMismatches: report.checksumMismatches.length,
  }
  return report
}

export interface PruneResult {
  /** Uspešno zbrisani ključi (idempotentno brisanje). */
  deleted: string[]
  failed: Array<{ key: string; napaka: string }>
}

/**
 * Zbriši IZRECNO podane ključe objektov (R399 §18 — skript pokliče SAMO za
 * sirote, starejše od milostne dobe). NE briše vrstic, NE popravlja
 * poročil — mehanično izvajanje izbire klicatelja (fail-closed ločitev
 * odgovornosti: izbira SIROTE je nad pragom tega modula).
 */
export async function pruneOrphanObjects(keys: string[]): Promise<PruneResult> {
  const deleted: string[] = []
  const failed: Array<{ key: string; napaka: string }> = []
  for (const key of keys) {
    try {
      await deleteObject(key)
      deleted.push(key)
    } catch (error) {
      failed.push({
        key,
        napaka: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return { deleted, failed }
}
