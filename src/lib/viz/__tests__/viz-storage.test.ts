/**
 * VIZ — testi storage driverja (runda S+3).
 * Local driver: pravi roundtrip na disku (public/viz je gitignored).
 * Blob driver: @vercel/blob je mockan — preverjamo NAŠO logiko (ključi,
 * url preslikava, delPrefix agregacija, contentType), ne SDK-ja.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  VIZ_FILE_NAMES,
  contentTypeForName,
  projectKey,
  stagingKey,
  storageMode,
  vizCopy,
  vizDel,
  vizDelPrefix,
  vizGet,
  vizGetJson,
  vizHas,
  vizList,
  vizPut,
  vizPutJson,
} from '../storage'

describe('viz storage — ključi in varnost', () => {
  it('stagingKey/projectKey dovolita kanonična imena s pikami', () => {
    expect(stagingKey('tok_en-1', VIZ_FILE_NAMES.original)).toBe('viz/staging/tok_en-1/original.jpg')
    expect(projectKey('id-1', 'project.json')).toBe('viz/projects/id-1/project.json')
    expect(projectKey('id-1', 'product-mask-2.png')).toBe('viz/projects/id-1/product-mask-2.png')
  })

  it('stagingKey zavrne path traversal in slabe segmente', () => {
    expect(() => stagingKey('../etc', 'original.jpg')).toThrow()
    expect(() => stagingKey('ok', 'sub/dir.jpg')).toThrow()
    expect(() => stagingKey('ok', '.hidden')).toThrow()
    expect(() => projectKey('id with space', 'x.jpg')).toThrow()
  })

  it('contentTypeForName preslika končnice', () => {
    expect(contentTypeForName('a.jpg')).toBe('image/jpeg')
    expect(contentTypeForName('a.png')).toBe('image/png')
    expect(contentTypeForName('a.json')).toBe('application/json')
    expect(contentTypeForName('a.bin')).toBe('application/octet-stream')
  })
})

describe('viz storage — local driver (privzet brez tokena)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    delete process.env.BLOB_READ_WRITE_TOKEN
    delete process.env.VIZ_STORAGE_DRIVER
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('storageMode = local brez BLOB_READ_WRITE_TOKEN', () => {
    expect(storageMode()).toBe('local')
  })

  it('vizPut → vizGet → vizHas → vizDel roundtrip', async () => {
    const key = stagingKey('test-roundtrip-local', 'original.jpg')
    const data = Buffer.from('podatki-test-123')
    const put = await vizPut(key, data, 'image/jpeg')
    expect(put.url).toBe(`/${key}`)
    expect(await vizHas(key)).toBe(true)
    const got = await vizGet(key)
    expect(got).not.toBeNull()
    expect(got!.toString('utf8')).toBe('podatki-test-123')
    await vizDel(key)
    expect(await vizHas(key)).toBe(false)
    expect(await vizGet(key)).toBeNull()
  })

  it('vizPutJson/vizGetJson roundtrip', async () => {
    const key = projectKey('test-json-local', 'project.json')
    await vizPutJson(key, { a: 1, b: 'dva' })
    const doc = await vizGetJson<{ a: number; b: string }>(key)
    expect(doc).toEqual({ a: 1, b: 'dva' })
    // pokvarjen JSON → null
    await vizPut(key, Buffer.from('{ni json'))
    expect(await vizGetJson(key)).toBeNull()
    await vizDelPrefix(`viz/projects/test-json-local`)
  })

  it('vizCopy kopira vsebino pod nov ključ', async () => {
    const src = stagingKey('test-copy-src', 'mask.png')
    const dest = projectKey('test-copy-dst', 'mask.png')
    await vizPut(src, Buffer.from([1, 2, 3, 4]), 'image/png')
    const res = await vizCopy(src, dest)
    expect(res.url).toBe(`/${dest}`)
    expect((await vizGet(dest))!.equals(Buffer.from([1, 2, 3, 4]))).toBe(true)
    await vizDel(src)
    await vizDelPrefix('viz/projects/test-copy-dst')
  })

  it('vizList in vizDelPrefix delujeta rekurzivno', async () => {
    const t = 'test-list-local'
    await vizPut(stagingKey(t, 'original.jpg'), Buffer.from('1'))
    await vizPut(stagingKey(t, 'preview.jpg'), Buffer.from('22'))
    const items = await vizList('viz/staging/')
    const keys = items.filter((i) => i.key.includes(t)).map((i) => i.key)
    expect(keys).toContain(`viz/staging/${t}/original.jpg`)
    expect(keys).toContain(`viz/staging/${t}/preview.jpg`)
    await vizDelPrefix(`viz/staging/${t}`)
    const after = await vizList('viz/staging/')
    expect(after.some((i) => i.key.includes(t))).toBe(false)
  })

  it('vizPut zavrne neveljaven ključ', async () => {
    await expect(vizPut('etc/passwd', Buffer.from('x'))).rejects.toThrow()
    await expect(vizPut('viz/../escape', Buffer.from('x'))).rejects.toThrow()
  })
})

describe('viz storage — blob driver (mockan @vercel/blob)', () => {
  const putMock = vi.fn()
  const headMock = vi.fn()
  const delMock = vi.fn()
  const listMock = vi.fn()

  beforeEach(() => {
    vi.resetModules()
    putMock.mockReset()
    headMock.mockReset()
    delMock.mockReset()
    listMock.mockReset()
    vi.doMock('@vercel/blob', () => ({
      put: putMock,
      head: headMock,
      del: delMock,
      list: listMock,
    }))
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_mock_token')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.doUnmock('@vercel/blob')
  })

  async function driver() {
    return import('../storage')
  }

  it('storageMode = blob ko je token nastavljen (tudi z VIZ_STORAGE_DRIVER=local preglasom)', async () => {
    const s = await driver()
    expect(s.storageMode()).toBe('blob')
    vi.stubEnv('VIZ_STORAGE_DRIVER', 'local')
    expect(s.storageMode()).toBe('local')
  })

  it('vizPut pokliče SDK z access public, brez naključnega sufiksa in vrne blob URL', async () => {
    putMock.mockResolvedValue({ url: 'https://store.public.blob.vercel-storage.com/viz/staging/t1/original.jpg' })
    const s = await driver()
    const res = await s.vizPut(stagingKey('t1', 'original.jpg'), Buffer.from('img'))
    expect(putMock).toHaveBeenCalledWith(
      'viz/staging/t1/original.jpg',
      expect.any(Buffer),
      expect.objectContaining({ access: 'public', addRandomSuffix: false, contentType: 'image/jpeg' })
    )
    expect(res.url).toBe('https://store.public.blob.vercel-storage.com/viz/staging/t1/original.jpg')
  })

  it('vizGet naredi head + fetch in vrne null, če ne obstaja', async () => {
    headMock.mockResolvedValueOnce({ url: 'https://store/x.json' })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ a: 2 }), { status: 200 })
    )
    const s = await driver()
    const doc = await s.vizGetJson<{ a: number }>(projectKey('p1', 'project.json'))
    expect(doc).toEqual({ a: 2 })
    fetchSpy.mockRestore()

    headMock.mockRejectedValueOnce(new Error('not found'))
    expect(await s.vizHas(projectKey('p1', 'project.json'))).toBe(false)
  })

  it('vizDelPrefix postrani liste in zbriše vse URL-je (paginacija)', async () => {
    listMock
      .mockResolvedValueOnce({
        blobs: [
          { pathname: 'viz/projects/p1/original.jpg', url: 'https://store/viz/projects/p1/original.jpg' },
          { pathname: 'viz/projects/p1/preview.jpg', url: 'https://store/viz/projects/p1/preview.jpg' },
        ],
        cursor: 'next',
      })
      .mockResolvedValueOnce({
        blobs: [{ pathname: 'viz/projects/p1/project.json', url: 'https://store/viz/projects/p1/project.json' }],
        cursor: undefined,
      })
    const s = await driver()
    await s.vizDelPrefix('viz/projects/p1/')
    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ prefix: 'viz/projects/p1/' }))
    expect(delMock).toHaveBeenCalledTimes(2)
    expect(delMock).toHaveBeenNthCalledWith(1, [
      'https://store/viz/projects/p1/original.jpg',
      'https://store/viz/projects/p1/preview.jpg',
    ])
    expect(delMock).toHaveBeenNthCalledWith(2, ['https://store/viz/projects/p1/project.json'])
  })

  it('vizList agregira strani', async () => {
    listMock
      .mockResolvedValueOnce({ blobs: [{ pathname: 'viz/projects/p1/project.json', url: 'u1' }], cursor: 'c' })
      .mockResolvedValueOnce({ blobs: [{ pathname: 'viz/projects/p2/project.json', url: 'u2' }], cursor: undefined })
    const s = await driver()
    const items = await s.vizList('viz/projects/')
    expect(items.map((i) => i.key)).toEqual(['viz/projects/p1/project.json', 'viz/projects/p2/project.json'])
  })
})
