// R121 (issue #7) — object storage: ključi, parseDataUri, put/get/del
// roundtrip (local driver na tmp korenu), SHA-256 determinizem.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  assertSafeObjectKey,
  objectKey,
  parseObjectKey,
  parseDataUri,
  putObject,
  getObject,
  hasObject,
  deleteObject,
  sha256Of,
  extensionForMime,
  objectStorageMode,
  objectUrlFor,
} from '@/lib/object-storage'

const TMP = mkdtempSync(path.join(tmpdir(), 'roksal-storage-'))

beforeAll(() => {
  process.env.OBJECT_STORAGE_DRIVER = 'local'
  process.env.STORAGE_LOCAL_ROOT = TMP
})
afterAll(() => {
  rmSync(TMP, { recursive: true, force: true })
})

// 1×1 PNG (magični bajti 0x89 0x50 …) — determinističen fixture.
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

describe('R121 object-storage — ključi', () => {
  it('objectKey sestavi in preveri kanoničen ključ', () => {
    const key = objectKey('photos', 'abc-123', 'slika.jpg')
    expect(key).toBe('files/photos/abc-123/slika.jpg')
    expect(assertSafeObjectKey(key)).toBe(key)
  })

  it('parseObjectKey razčleni nazaj (avtorizacija na /api/files)', () => {
    expect(parseObjectKey('files/photos/abc/slika.jpg')).toEqual({
      resource: 'photos',
      id: 'abc',
      name: 'slika.jpg',
    })
  })

  it('traversal/ponarejeni ključi so zavrnjeni', () => {
    expect(parseObjectKey('files/photos/../../etc/passwd/x.jpg')).toBeNull()
    expect(parseObjectKey('etc/passwd')).toBeNull()
    expect(parseObjectKey('files/obmocje/abc/x.jpg')).toBeNull()
    expect(parseObjectKey('files/photos/abc')).toBeNull()
    expect(() => objectKey('photos', 'abc', '../x.jpg')).toThrow()
    expect(() => assertSafeObjectKey('files/photos//x.jpg')).toThrow()
  })

  it('objectUrlFor je VEDNO proxy URL (nikoli surov blob)', () => {
    expect(objectUrlFor('files/photos/abc/slika.jpg')).toBe('/api/files/files/photos/abc/slika.jpg')
  })

  it('local mode brez BLOB tokena', () => {
    expect(objectStorageMode()).toBe('local')
  })
})

describe('R121 parseDataUri (klient ni zaupan)', () => {
  it('data URI z mime → bajti + mime', () => {
    const parsed = parseDataUri(`data:image/png;base64,${PNG_1PX.toString('base64')}`)
    expect(parsed).not.toBeNull()
    expect(parsed!.mime).toBe('image/png')
    expect(parsed!.bytes.equals(PNG_1PX)).toBe(true)
  })

  it('surovi base64 → mime iz magičnih bajtov (PNG)', () => {
    const parsed = parseDataUri(PNG_1PX.toString('base64'))
    expect(parsed).not.toBeNull()
    expect(parsed!.mime).toBe('image/png')
  })

  it('JPEG magični bajti (0xFF 0xD8)', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])
    const parsed = parseDataUri(jpeg.toString('base64'))
    expect(parsed!.mime).toBe('image/jpeg')
  })

  it('pokvarjen base64 (neupravljena dolžina) → null', () => {
    expect(parseDataUri('abcde')).toBeNull()
  })

  it('nepodprt data URI (brez base64) → null', () => {
    expect(parseDataUri('data:image/svg+xml,<svg/>')).toBeNull()
  })

  it('prazen vnos → null; prevelik vnos → null (zaloga)', () => {
    expect(parseDataUri('')).toBeNull()
    const big = Buffer.alloc(11 * 1024 * 1024 + 8).toString('base64')
    expect(parseDataUri(big, 10 * 1024 * 1024)).toBeNull()
  })
})

describe('R121 put/get/has/delete roundtrip (local driver)', () => {
  it('zapis vrne metadata (sha256, size, proxy url) in bajti so isti', async () => {
    const key = objectKey('photos', 'test-obj-1', 'slika.png')
    const put = await putObject(key, PNG_1PX, 'image/png')
    expect(put.key).toBe(key)
    expect(put.sha256).toBe(sha256Of(PNG_1PX))
    expect(put.sizeBytes).toBe(PNG_1PX.length)
    expect(put.url).toBe(`/api/files/${key}`)

    const bytes = await getObject(key)
    expect(bytes).not.toBeNull()
    expect(bytes!.equals(PNG_1PX)).toBe(true)
    expect(await hasObject(key)).toBe(true)
    expect(existsSync(path.join(TMP, key))).toBe(true)
  })

  it('ponovni zapis istega ključa je dovoljen (putObject overwrite)', async () => {
    const key = objectKey('sketches', 'test-obj-2', 'skica.png')
    await putObject(key, PNG_1PX, 'image/png')
    await putObject(key, PNG_1PX, 'image/png')
    expect(await hasObject(key)).toBe(true)
  })

  it('brisanje je idempotentno; branje po brisanju = null', async () => {
    const key = objectKey('documents', 'test-obj-3', 'v1.pdf')
    await putObject(key, Buffer.from('%PDF-1.4 test'), 'application/pdf')
    await deleteObject(key)
    expect(await hasObject(key)).toBe(false)
    await deleteObject(key) // drugo brisanje brez napake
    expect(await getObject(key)).toBeNull()
  })

  it('pražen objekt je zavrnjen (fail-closed)', async () => {
    await expect(putObject(objectKey('photos', 'x', 'slika.jpg'), Buffer.alloc(0))).rejects.toThrow()
  })

  it('napačen ključ (traversal) je zavrnjen', async () => {
    await expect(putObject('files/photos/../x.jpg', PNG_1PX)).rejects.toThrow()
    expect(await getObject('files/photos/../x.jpg')).toBeNull()
  })
})

describe('R121 SHA-256 determinizem', () => {
  it('isti bajti = isti hash (100× pravilo)', () => {
    expect(sha256Of(PNG_1PX)).toBe(sha256Of(PNG_1PX))
    expect(sha256Of(PNG_1PX)).toHaveLength(64)
  })

  it('extensionForMime pokrije vse servirane tipe', () => {
    expect(extensionForMime('image/png')).toBe('png')
    expect(extensionForMime('image/jpeg')).toBe('jpg')
    expect(extensionForMime('image/webp')).toBe('webp')
    expect(extensionForMime('application/pdf')).toBe('pdf')
    expect(extensionForMime('application/octet-stream')).toBe('bin')
  })
})
