/**
 * VIZ — failure-injection testi save toka (runda S+4, P0 §3).
 *
 * Simuliramo napako PO VSAKEM koraku (11 injekcijskih točk iz spec):
 *   after original / product / product-mask / mask / preview / result /
 *   placement / variants / before-metadata / after-metadata / before-staging-cleanup
 *
 * Po vsakem vbrizganem failure-ju preverimo (kot zahteva spec):
 *   • projektni metadata  — pre-commit: NE obstaja; post-commit: obstaja (veljaven)
 *   • project files       — pre-commit: 0 (compensating cleanup); post-commit: komplet
 *   • staging files       — pre-commit: ostanejo (niso porabljeni); post-commit:
 *                           ostanki so dovoljeni (pobere jih staging GC)
 *   • orphan files        — 0 v VSEH primerih
 *
 * Cilj po spec: 0 orphan project files, 0 fake project records, 0 izgubljenih podatkov.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { saveProjectFromStaging, InjectedFailure, type VizSaveFaultPoint } from '../save-flow'
import { VIZ_FILE_NAMES, stagingKey, vizDelPrefix, vizGet, vizHas, vizList, vizPut, projectKey } from '../storage'
import { getProject } from '../repository'
import type { VizPlacement } from '../types'

const PLACEMENT: VizPlacement = {
  version: 2,
  corners: [
    [0.1, 0.2],
    [0.9, 0.2],
    [0.9, 0.8],
    [0.1, 0.8],
  ],
  rotation: 0,
  scale: 1,
  productQuad: null,
}

const ALL_FAULTS: VizSaveFaultPoint[] = [
  'after-original',
  'after-product',
  'after-product-mask',
  'after-mask',
  'after-preview',
  'after-result',
  'after-placement',
  'after-variants',
  'before-metadata',
  'after-metadata',
  'before-staging-cleanup',
]

const PRE_COMMIT_FAULTS: VizSaveFaultPoint[] = [
  'after-original',
  'after-product',
  'after-product-mask',
  'after-mask',
  'after-preview',
  'after-result',
  'after-placement',
  'after-variants',
  'before-metadata',
]

/** Pripravi staging za eno "sejo" — VSE datoteke pod enim tokenom. */
async function stageSession(): Promise<{ stagingToken: string }> {
  const stagingToken = `tok-${randomUUID().slice(0, 12)}`
  await vizPut(stagingKey(stagingToken, VIZ_FILE_NAMES.original), Buffer.from('original-bytes'), 'image/jpeg')
  await vizPut(stagingKey(stagingToken, VIZ_FILE_NAMES.product), Buffer.from('product-bytes'), 'image/jpeg')
  await vizPut(stagingKey(stagingToken, VIZ_FILE_NAMES.mask), Buffer.from('mask-bytes'), 'image/png')
  await vizPut(stagingKey(stagingToken, VIZ_FILE_NAMES.preview), Buffer.from('preview-bytes'), 'image/jpeg')
  const result = {
    metrics: { letviceProduct: 13, letviceResult: 13 },
    placement: PLACEMENT,
    tokens: { original: stagingToken, product: stagingToken, productMask: null, mask: stagingToken },
  }
  await vizPut(stagingKey(stagingToken, VIZ_FILE_NAMES.result), Buffer.from(JSON.stringify(result)), 'application/json')
  return { stagingToken }
}

function flowInput(stagingToken: string, id: string) {
  return {
    id,
    ownerId: 'user-A',
    idempotencyKey: null,
    name: 'Failure test',
    stagingToken,
    tokens: { original: stagingToken, product: stagingToken, productMask: null, mask: stagingToken },
    placement: PLACEMENT,
    variants: [],
  }
}

beforeEach(() => {
  delete process.env.BLOB_READ_WRITE_TOKEN
  delete process.env.VIZ_STORAGE_DRIVER
})

const cleanupKeys: string[] = []
function track(key: string): string {
  cleanupKeys.push(key)
  return key
}
const viCleanupIds: string[] = []
afterEach(async () => {
  for (const key of cleanupKeys.splice(0)) {
    await vizDelPrefix(key.endsWith('/') ? key : `${key}/`).catch(() => undefined)
  }
  for (const id of viCleanupIds.splice(0)) {
    await vizDelPrefix(`viz/projects/${id}/`).catch(() => undefined)
  }
})

describe('S+4 failure injection — pre-commit (cleanup mora počistiti vse)', () => {
  for (const fault of PRE_COMMIT_FAULTS) {
    it(`${fault}: napaka → 0 orphan datotek, 0 metadata, staging ohranjen`, async () => {
      const { stagingToken } = await stageSession()
      track(`viz/staging/${stagingToken}`)
      const id = track(`save-f-${randomUUID().slice(0, 12)}`)

      await expect(saveProjectFromStaging({ ...flowInput(stagingToken, id), faults: new Set([fault]) })).rejects.toBeInstanceOf(InjectedFailure)

      // metadata: 0 fake records
      expect(await getProject(id)).toBeNull()
      // project files: 0 orphans
      const files = await vizList(`viz/projects/${id}/`)
      expect(files).toHaveLength(0)
      // staging: ohranjen (niso porabljeni — klient lahko poskusi znova)
      expect(await vizHas(stagingKey(stagingToken, VIZ_FILE_NAMES.original))).toBe(true)
      expect(await vizHas(stagingKey(stagingToken, VIZ_FILE_NAMES.result))).toBe(true)
    })
  }
})

describe('S+4 failure injection — post-commit (commit velja, 0 izgubljenih podatkov)', () => {
  it('after-metadata: metadata OBSTAJA, projektne datoteke kompletne (veljaven projekt)', async () => {
    const { stagingToken } = await stageSession()
    track(`viz/staging/${stagingToken}`)
    const id = track(`save-f-${randomUUID().slice(0, 12)}`)

    await expect(saveProjectFromStaging({ ...flowInput(stagingToken, id), faults: new Set(['after-metadata']) })).rejects.toBeInstanceOf(InjectedFailure)

    // commit je veljal: metadata obstaja + datoteke so tam
    const rec = await getProject(id)
    expect(rec).not.toBeNull()
    expect(rec?.name).toBe('Failure test')
    expect(await vizHas(projectKey(id, VIZ_FILE_NAMES.original))).toBe(true)
    expect(await vizHas(projectKey(id, VIZ_FILE_NAMES.product))).toBe(true)
    expect(await vizHas(projectKey(id, VIZ_FILE_NAMES.mask))).toBe(true)
    expect(await vizHas(projectKey(id, VIZ_FILE_NAMES.placement))).toBe(true)
    // staging ostanki: dovoljeni (GC jih pobere — glej viz-gc.test.ts)
    expect(await vizHas(stagingKey(stagingToken, VIZ_FILE_NAMES.original))).toBe(true)
  })

  it('before-staging-cleanup: projekt veljaven; staging ostanke kasneje pobere GC', async () => {
    const { stagingToken } = await stageSession()
    track(`viz/staging/${stagingToken}`)
    const id = track(`save-f-${randomUUID().slice(0, 12)}`)

    await expect(saveProjectFromStaging({ ...flowInput(stagingToken, id), faults: new Set(['before-staging-cleanup']) })).rejects.toBeInstanceOf(InjectedFailure)

    expect(await getProject(id)).not.toBeNull()
    expect(await vizHas(projectKey(id, VIZ_FILE_NAMES.preview))).toBe(true)
    expect(await vizHas(stagingKey(stagingToken, VIZ_FILE_NAMES.original))).toBe(true)
  })
})

describe('S+4 failure injection — kontrola (brez faultov = uspeh)', () => {
  it('uspešen save: metadata + datoteke + staging porabljen', async () => {
    const { stagingToken } = await stageSession()
    track(`viz/staging/${stagingToken}`)
    const id = track(`save-f-${randomUUID().slice(0, 12)}`)

    const result = await saveProjectFromStaging(flowInput(stagingToken, id))
    expect(result.record.id).toBe(id)
    expect(result.record.ownerId).toBe('user-A')
    // datoteke projekta: original, product, mask, preview, result, placement
    const files = await vizList(`viz/projects/${id}/`)
    const names = files.map((f) => f.key.split('/').pop()).sort()
    expect(names).toEqual([
      VIZ_FILE_NAMES.mask,
      VIZ_FILE_NAMES.original,
      VIZ_FILE_NAMES.placement,
      VIZ_FILE_NAMES.preview,
      VIZ_FILE_NAMES.product,
      VIZ_FILE_NAMES.result,
    ].sort())
    // staging porabljen (izbrisan)
    expect(await vizHas(stagingKey(stagingToken, VIZ_FILE_NAMES.original))).toBe(false)
    // placement.json ima veljavno vsebino
    const raw = await vizGet(projectKey(id, VIZ_FILE_NAMES.placement))
    expect(JSON.parse(raw!.toString('utf8'))).toMatchObject({ version: 2 })
  })

  it('napaka sredi kopiranja (pravi throw, ne injekcija) → prav tako cleanup brez metadata', async () => {
    const { stagingToken } = await stageSession()
    track(`viz/staging/${stagingToken}`)
    const id = track(`save-f-${randomUUID().slice(0, 12)}`)

    // vizCopy vrže PRIVO napako po 1. kopiji (original skopiran, product ne)
    const actualStorage = await vi.importActual<typeof import('../storage')>('../storage')
    let copyCount = 0
    vi.doMock('../storage', () => ({
      ...actualStorage,
      vizCopy: vi.fn(async (src: string, dest: string) => {
        copyCount++
        if (copyCount === 2) throw new Error('disk napaka sredi kopiranja')
        return actualStorage.vizCopy(src, dest)
      }),
    }))
    vi.resetModules()
    try {
      const { saveProjectFromStaging: save } = await import('../save-flow')
      const { getProject: get } = await import('../repository')
      await expect(save(flowInput(stagingToken, id))).rejects.toThrow('disk napaka')
      // compensating cleanup: 0 metadata, 0 orphan datotek (tudi skopiran original!)
      expect(await get(id)).toBeNull()
      expect(await vizList(`viz/projects/${id}/`)).toHaveLength(0)
      expect(copyCount).toBe(2)
    } finally {
      vi.doUnmock('../storage')
      vi.resetModules()
    }
  })
})
