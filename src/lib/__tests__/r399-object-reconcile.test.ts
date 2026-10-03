// R399 (issue #13 §18 — OBJECT STORAGE PRIVATE BY DEFAULT) — testi:
// ---------------------------------------------------------------------------
//  (1) blob driver: putObject piše z access:'private' (NIKOLI 'public'),
//      getObject bere ZASEBNO (SDK get + žeton) s prehodnim javnim
//      fallbackom + GLASNIM opozorilom, deleteObject briše po pathname;
//  (2) domena reconcileStorage (local driver + testna DB):
//      čiste vezave · sirota (objekt brez vrstice) · pretrgana vezava
//      (vrstica brez objekta — NE briše se) · checksum RE-HASH sweep ·
//      legacy vrstice brez ključa (iskreno štete, niso diskrepanca) ·
//      dedup dokumentov (Document legacy kazalčnik + DocumentVersion
//      kanonična verzija = EN objekt, DVE vezavi);
//  (3) pruneOrphanObjects briše SAMO izrecno podane ključe (vezani
//      objekti ostanejo — mehanična ločitev odgovornosti od izbire);
//  (4) API GET /api/storage/reconcile: 401 anon · 403 MONTER · 200 VODJA
//      (oblika poročila: driver/totals/byFamily ×6);
//  (5) migrateBlobAccessPrivate: local no-op z odkrito opombo; blob
//      vedenjska detekcija (javni URL → copy zasebno → PO-verifikacija
//      zavrnitve) + fail-closed (ostane javen → 'napaka').
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import { reconcileStorage, pruneOrphanObjects } from '@/lib/object-reconciliation'
import {
  putObject,
  getObject,
  hasObject,
  deleteObject,
  objectKey,
  objectStorageMode,
  migrateBlobAccessPrivate,
} from '@/lib/object-storage'
import * as reconcileRoute from '@/app/api/storage/reconcile/route'

// ── @vercel/blob mock (SAMO blob-branch testi — local driver nikoli ne
//    uvozi modula; vi.mock prestavljen na vrh datoteke) ───────────────────────
const blobSdk = vi.hoisted(() => ({
  put: vi.fn(),
  get: vi.fn(),
  head: vi.fn(),
  del: vi.fn(),
  copy: vi.fn(),
  list: vi.fn(),
}))
vi.mock('@vercel/blob', () => blobSdk)

const TMP = mkdtempSync(path.join(tmpdir(), 'roksal-r396-'))
const OZNAKA = `r396-${Date.now()}`
const BASE = 'http://localhost/api'

// 1×1 PNG (determinističen fixture — magični bajti 0x89 0x50 …)
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

let vodja: { user: { id: string }; token: string }
let monter: { user: { id: string }; token: string }
let projektId: string
let strankaId: string

/** Moji ključi (za filtrirane assertione — globalni scan vključuje tuje vrstice). */
const mojiKljuči: string[] = []

beforeAll(async () => {
  process.env.OBJECT_STORAGE_DRIVER = 'local'
  process.env.STORAGE_LOCAL_ROOT = TMP
  delete process.env.BLOB_READ_WRITE_TOKEN

  vodja = await createTestUserWithSession(`${OZNAKA}-vodja`, 'VODJA')
  monter = await createTestUserWithSession(`${OZNAKA}-monter`, 'MONTER')
  const stranka = await db.customer.create({
    data: { ime: `Stranka ${OZNAKA}`, naslov: 'Testna 1', email: `${OZNAKA}@test.si` },
  })
  strankaId = stranka.id
  const projekt = await db.project.create({
    data: {
      nazivProjekta: `${OZNAKA} projekt`,
      status: 'V_TEKU',
      monterId: monter.user.id,
      customerId: stranka.id,
    },
  })
  projektId = projekt.id
})

afterAll(async () => {
  // moje vrstice (projekt kaskadira photos/sketches/arSnapshots/documents;
  // DocumentVersion kaskadira z Document; gallery/signature eksplicitno)
  await db.signatureAudit.deleteMany({ where: { projectId: projektId } })
  await db.galleryItem.deleteMany({ where: { naslov: { startsWith: OZNAKA } } })
  await db.auditLog.deleteMany({ where: { projectId: projektId } })
  await db.project.deleteMany({ where: { id: projektId } })
  await db.customer.deleteMany({ where: { id: strankaId } })
  await db.auditLog.deleteMany({ where: { userId: { in: [vodja.user.id, monter.user.id] } } })
  await db.profile.deleteMany({ where: { id: { in: [vodja.user.id, monter.user.id] } } })

  // moji objekti (0 sirot za naslednje suite-e)
  for (const key of mojiKljuči) await deleteObject(key).catch(() => undefined)
  rmSync(TMP, { recursive: true, force: true })
})

/** Zapiši objekt + zabeleži ključ (čiščenje v afterAll). */
async function pisi(resource: 'photos' | 'sketches' | 'ar-snapshots' | 'gallery' | 'documents' | 'signatures', id: string, ime: string, bytes: Buffer = PNG_1PX) {
  const key = objectKey(resource, id, ime)
  const res = await putObject(key, bytes)
  mojiKljuči.push(key)
  return { key, sha256: res.sha256 }
}

function req(pathName: string, token: string | null): Request {
  return new Request(`${BASE}${pathName}`, {
    method: 'GET',
    ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
  })
}

// ── 1) domena: reconcileStorage (local driver, testna DB) ────────────────────
describe('R399 §18 — reconcileStorage domena (local driver)', () => {
  it('čiste vezave po VSEH 6 družinah: moje ključe NE najde med diskrepancami', async () => {
    // po en objekt na družino (+ galerija pred+po, dokument verzija+legacy)
    const foto = await pisi('photos', `${OZNAKA}-f1`, 'slika.jpg')
    await db.projectPhoto.create({
      data: { projectId: projektId, kategorija: 'PRED', storageKey: foto.key, sha256: foto.sha256 },
    })
    const skica = await pisi('sketches', `${OZNAKA}-s1`, 'skica.png')
    await db.sketch.create({
      data: { projectId: projektId, naziv: 'Skica', storageKey: skica.key, sha256: skica.sha256 },
    })
    const ar = await pisi('ar-snapshots', `${OZNAKA}-a1`, 'posnetek.png')
    await db.arSnapshot.create({
      data: { projectId: projektId, tocke: '[]', storageKey: ar.key, sha256: ar.sha256 },
    })
    const pred = await pisi('gallery', `${OZNAKA}-g1`, 'pred.jpg')
    const po = await pisi('gallery', `${OZNAKA}-g1`, 'po.jpg')
    await db.galleryItem.create({
      data: {
        naslov: `${OZNAKA} galerija`,
        slikaPredKey: pred.key,
        slikaPredSha256: pred.sha256,
        slikaPoKey: po.key,
        slikaPoSha256: po.sha256,
      },
    })
    const doc = await pisi('documents', `${OZNAKA}-d1`, 'v1.pdf')
    const dokument = await db.document.create({
      data: { projectId: projektId, storageKey: doc.key, sha256: doc.sha256 },
    })
    await db.documentVersion.create({
      data: {
        documentId: dokument.id,
        version: 1,
        storageKey: doc.key,
        sizeBytes: PNG_1PX.length,
        sha256: doc.sha256,
      },
    })
    const podpis = await pisi('signatures', `${OZNAKA}-p1`, 'podpis.png')
    await db.signatureAudit.create({
      data: {
        projectId: projektId,
        signatureType: 'CUSTOMER',
        signedByName: 'Stranka',
        storageKey: podpis.key,
        sha256: podpis.sha256,
      },
    })

    const report = await reconcileStorage()
    expect(report.driver).toBe('local')
    for (const key of [foto.key, skica.key, ar.key, pred.key, po.key, doc.key, podpis.key]) {
      expect(report.orphans.map((o) => o.key)).not.toContain(key)
      expect(report.brokenRefs.map((b) => b.key)).not.toContain(key)
      expect(report.checksumMismatches.map((c) => c.key)).not.toContain(key)
    }
    // galerija: DVE vezavi (pred + po) na ENO vrstico
    const mojaGalerija = report.byFamily.gallery
    expect(mojaGalerija.rows).toBeGreaterThanOrEqual(2)
    // dokumenti: Document legacy kazalčnik + DocumentVersion = EN objekt, DVE vezavi
    expect(report.byFamily.documents.rows).toBeGreaterThanOrEqual(2)
    expect(report.scannedObjects).toBeGreaterThanOrEqual(7)
  })

  it('SIROTA: objekt brez DB vrstice je odkrit (družina, velikost, čas zapisa)', async () => {
    const sirota = await pisi('photos', `${OZNAKA}-orphan1`, 'sirota.jpg')
    const report = await reconcileStorage()
    const najden = report.orphans.find((o) => o.key === sirota.key)
    expect(najden).toBeDefined()
    expect(najden!.family).toBe('photos')
    expect(najden!.sizeBytes).toBe(PNG_1PX.length)
    expect(najden!.uploadedAt).not.toBeNull()
  })

  it('PRETRGANA VEZAVA: vrstica brez objekta je odkrita in NE izgine (samo-bralno)', async () => {
    const manjkajocKey = objectKey('sketches', `${OZNAKA}-broken1`, 'nic.png')
    const vrstica = await db.sketch.create({
      data: { projectId: projektId, naziv: 'Pretrgana', storageKey: manjkajocKey, sha256: null },
    })
    const report = await reconcileStorage()
    expect(
      report.brokenRefs.some((b) => b.rowId === vrstica.id && b.key === manjkajocKey && b.family === 'sketches')
    ).toBe(true)
    // samo-bralno: vrstica OSTANE (integriteta poslovne resnice — lastnik odloči)
    expect(await db.sketch.findUnique({ where: { id: vrstica.id } })).not.toBeNull()
  })

  it('CHECKSUM: tampirani bajti so odkriti (pričakovani ≠ dejanski RE-HASH)', async () => {
    const spremenjen = await pisi('ar-snapshots', `${OZNAKA}-tamp1`, 'posnetek.png')
    const vrstica = await db.arSnapshot.create({
      data: { projectId: projektId, tocke: '[]', storageKey: spremenjen.key, sha256: spremenjen.sha256 },
    })
    // tampiraj bajte NAD pisanjem (isti ključ, druga vsebina)
    writeFileSync(path.join(TMP, spremenjen.key), Buffer.from('TAMPIRANO'))
    const report = await reconcileStorage()
    const najden = report.checksumMismatches.find(
      (c) => c.key === spremenjen.key && c.rowId === vrstica.id && c.family === 'ar-snapshots'
    )
    expect(najden).toBeDefined()
    expect(najden!.expectedSha256).toBe(spremenjen.sha256)
    expect(najden!.actualSha256).not.toBe(spremenjen.sha256)
    expect(najden!.actualSha256).toHaveLength(64)
  })

  it('legacy vrstice brez ključa: iskreno štete, NISO pretrgane vezave', async () => {
    const legacy = await db.projectPhoto.create({
      data: { projectId: projektId, kategorija: 'MED' }, // storageKey NULL (pred R121 backfillom)
    })
    const report = await reconcileStorage()
    expect(report.byFamily.photos.legacyRowsWithoutKey).toBeGreaterThanOrEqual(1)
    expect(report.brokenRefs.some((b) => b.rowId === legacy.id)).toBe(false)
  })

  it('pruneOrphanObjects briše SAMO podane ključe — vezani objekti ostanejo', async () => {
    const sirota2 = await pisi('gallery', `${OZNAKA}-orphan2`, 'sirota.jpg')
    const vezan = await pisi('signatures', `${OZNAKA}-keep1`, 'podpis.png')
    await db.signatureAudit.create({
      data: {
        projectId: projektId,
        signatureType: 'CUSTOMER',
        signedByName: 'Stranka',
        storageKey: vezan.key,
        sha256: vezan.sha256,
      },
    })

    const res = await pruneOrphanObjects([sirota2.key])
    expect(res.deleted).toEqual([sirota2.key])
    expect(res.failed).toHaveLength(0)
    expect(await hasObject(sirota2.key)).toBe(false)
    expect(await hasObject(vezan.key)).toBe(true)

    // re-sprava: sirota IZGINI iz poročila (brisanje je idempotentno)
    const report = await reconcileStorage()
    expect(report.orphans.map((o) => o.key)).not.toContain(sirota2.key)
  })
})

// ── 2) API ruta — RBAC + oblika poročila ─────────────────────────────────────
describe('R399 §18 — GET /api/storage/reconcile (RBAC)', () => {
  it('brez prijave → 401', async () => {
    const r = await reconcileRoute.GET(req('/storage/reconcile', null))
    expect(r.status).toBe(401)
  })

  it('MONTER (teren) → 403 z vodstvenim sporočilom', async () => {
    const r = await reconcileRoute.GET(req('/storage/reconcile', monter.token))
    expect(r.status).toBe(403)
    const telo = (await r.json()) as { error?: string }
    expect(telo.error).toContain('vodstveno')
  })

  it('VODJA → 200 + oblika poročila (driver/totals/byFamily ×6/generatedAt)', async () => {
    const r = await reconcileRoute.GET(req('/storage/reconcile', vodja.token))
    expect(r.status).toBe(200)
    const telo = (await r.json()) as Record<string, unknown>
    expect(telo.driver).toBe('local')
    expect(telo.generatedAt).toEqual(expect.any(String))
    const totals = telo.totals as Record<string, number>
    expect(totals).toHaveProperty('orphans')
    expect(totals).toHaveProperty('brokenRefs')
    expect(totals).toHaveProperty('checksumMismatches')
    const byFamily = telo.byFamily as Record<string, unknown>
    for (const family of [
      'photos',
      'sketches',
      'ar-snapshots',
      'gallery',
      'documents',
      'signatures',
    ]) {
      expect(byFamily).toHaveProperty(family)
    }
  })
})

// ── 3) blob driver: PRIVATE BY DEFAULT (SDK klici — mock) ────────────────────
describe('R399 §18 — blob driver: PRIVATE BY DEFAULT (SDK klici)', () => {
  const PREV_DRIVER = process.env.OBJECT_STORAGE_DRIVER
  const PREV_TOKEN = process.env.BLOB_READ_WRITE_TOKEN
  let warnSpy: ReturnType<typeof vi.spyOn> | null = null

  beforeEach(() => {
    process.env.OBJECT_STORAGE_DRIVER = 'blob'
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token'
    vi.clearAllMocks()
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => {
    process.env.OBJECT_STORAGE_DRIVER = PREV_DRIVER
    if (PREV_TOKEN === undefined) delete process.env.BLOB_READ_WRITE_TOKEN
    else process.env.BLOB_READ_WRITE_TOKEN = PREV_TOKEN
    warnSpy?.mockRestore()
    warnSpy = null
  })

  it('putObject → SDK put z access PRIVATE (nikoli javno) + determinističen ključ', async () => {
    blobSdk.put.mockResolvedValue({ url: 'https://x/blob', pathname: 'files/photos/a/s.jpg' })
    await putObject('files/photos/abc123/slika.jpg', PNG_1PX)
    expect(blobSdk.put).toHaveBeenCalledTimes(1)
    const [key, data, opts] = blobSdk.put.mock.calls[0] as unknown as [string, Buffer, Record<string, unknown>]
    expect(key).toBe('files/photos/abc123/slika.jpg')
    expect(data.equals(PNG_1PX)).toBe(true)
    expect(opts.access).toBe('private')
    expect(opts.addRandomSuffix).toBe(false)
    expect(opts.allowOverwrite).toBe(true)
  })

  it('getObject → SDK get z access PRIVATE (žeton) + bajti iz streama', async () => {
    blobSdk.get.mockResolvedValue({
      statusCode: 200,
      stream: new Blob([PNG_1PX]).stream(),
    })
    const bytes = await getObject('files/photos/abc123/slika.jpg')
    expect(bytes?.equals(PNG_1PX)).toBe(true)
    expect(blobSdk.get).toHaveBeenCalledTimes(1)
    const [key, opts] = blobSdk.get.mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(key).toBe('files/photos/abc123/slika.jpg')
    expect(opts.access).toBe('private')
    expect(opts.useCache).toBe(false)
    // zasebno branje USPELO → javni fallback SE NI POKLICAL + NI opozorila
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('getObject prehoden javni fallback: zasebno branje pade → javno + GLASNO opozorilo', async () => {
    blobSdk.get
      .mockRejectedValueOnce(new Error('private access denied'))
      .mockResolvedValueOnce({ statusCode: 200, stream: new Blob([PNG_1PX]).stream() })
    const bytes = await getObject('files/photos/abc123/slika.jpg')
    expect(bytes?.equals(PNG_1PX)).toBe(true)
    expect(blobSdk.get).toHaveBeenCalledTimes(2)
    const [, opts1] = blobSdk.get.mock.calls[0] as unknown as [string, Record<string, unknown>]
    const [, opts2] = blobSdk.get.mock.calls[1] as unknown as [string, Record<string, unknown>]
    expect(opts1.access).toBe('private')
    expect(opts2.access).toBe('public')
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect((warnSpy!.mock.calls[0] as unknown[])[0]).toContain('JAVEN')
  })

  it('deleteObject → SDK del po PATHNAME (žeton; brez head/URL plesa)', async () => {
    blobSdk.del.mockResolvedValue(undefined)
    await deleteObject('files/photos/abc123/slika.jpg')
    expect(blobSdk.del).toHaveBeenCalledWith('files/photos/abc123/slika.jpg')
    expect(blobSdk.head).not.toHaveBeenCalled()
  })

  it('migrateBlobAccessPrivate (local driver) → iskren no-op z opombo', async () => {
    process.env.OBJECT_STORAGE_DRIVER = 'local'
    delete process.env.BLOB_READ_WRITE_TOKEN
    const res = await migrateBlobAccessPrivate()
    expect(res.driver).toBe('local')
    expect(res.checked).toBe(0)
    expect(res.migrated).toBe(0)
    expect(res.opomba).toContain('zasebne po konstrukciji')
  })

  it('migrateBlobAccessPrivate (blob): vedenjsko javen → copy zasebno → PO-verifikacija', async () => {
    const KEY = 'files/documents/doc1/v1.pdf'
    const URL = 'https://store.public.blob.vercel-storage.com/files/documents/doc1/v1.pdf'
    blobSdk.list.mockResolvedValue({
      blobs: [{ pathname: KEY, size: PNG_1PX.length, uploadedAt: new Date() }],
      cursor: undefined,
    })
    blobSdk.head.mockResolvedValue({ url: URL, pathname: KEY })
    blobSdk.copy.mockResolvedValue({ pathname: KEY, url: URL })
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true } as Response) // detekcija: javen
      .mockResolvedValueOnce({ ok: false } as Response) // PO-verifikacija: zavrnjen
    try {
      const res = await migrateBlobAccessPrivate()
      expect(res.checked).toBe(1)
      expect(res.migrated).toBe(1)
      expect(res.failed).toBe(0)
      expect(res.entries[0]).toMatchObject({ key: KEY, izid: 'migriran' })
      expect(blobSdk.copy).toHaveBeenCalledWith(KEY, KEY, {
        access: 'private',
        allowOverwrite: true,
        contentType: 'application/pdf',
      })
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('migrateBlobAccessPrivate fail-closed: ostane javen → izid napaka (NE lažnega uspeha)', async () => {
    const KEY = 'files/signatures/sig1/podpis.png'
    const URL = 'https://store.public.blob.vercel-storage.com/files/signatures/sig1/podpis.png'
    blobSdk.list.mockResolvedValue({
      blobs: [{ pathname: KEY, size: PNG_1PX.length, uploadedAt: new Date() }],
      cursor: undefined,
    })
    blobSdk.head.mockResolvedValue({ url: URL, pathname: KEY })
    blobSdk.copy.mockResolvedValue({ pathname: KEY, url: URL })
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true } as Response) // vedno javen → PO-verifikacija pade
    try {
      const res = await migrateBlobAccessPrivate()
      expect(res.migrated).toBe(0)
      expect(res.failed).toBe(1)
      expect(res.entries[0].izid).toBe('napaka')
      expect(res.entries[0].napaka).toContain('ŠE VEDNO javen')
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('objectStorageMode: prisiljeni blob driver ostaja blob (ambient)', () => {
    expect(objectStorageMode()).toBe('blob')
  })
})
