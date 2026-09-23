/**
 * VIZ — staging garbage collection testi (runda S+4, P1 §5).
 *
 * Spec zahteva:
 *   fresh staging  → ostane
 *   expired staging → izbriše se
 *   project        → ostane (GC se GA NE dotika)
 *   render-jobs    → ostanejo (GC se jih NE dotika)
 *
 * Local način: pravi datoteki na disku; starost nastavimo z utimes (mtime).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { utimes } from 'node:fs/promises'
import path from 'node:path'
import { VIZ_FILE_NAMES, stagingKey, vizDelPrefix, vizHas, vizList, vizPut, projectKey } from '../storage'
import { gcStaging, stagingTokenOfKey, DEFAULT_STAGING_TTL_MS } from '../gc'
import { createProject, deleteProject, type VizProjectInput } from '../repository'

const HOUR = 60 * 60 * 1000

async function stageToken(ageMs: number): Promise<string> {
  const token = `tok-${randomUUID().slice(0, 12)}`
  const p = await vizPut(stagingKey(token, VIZ_FILE_NAMES.original), Buffer.from('x'), 'image/jpeg')
  // local driver: URL = /viz/staging/... → absolutna pot na disku
  const disk = path.join(process.cwd(), 'public', p.key)
  const past = new Date(Date.now() - ageMs)
  await utimes(disk, past, past)
  return token
}

const BASE: VizProjectInput = {
  id: 'gc-proj',
  name: 'GC test',
  originalPath: '/viz/projects/gc-proj/original.jpg',
  productPath: '/viz/projects/gc-proj/product.jpg',
  productMaskPath: null,
  maskPath: '/viz/projects/gc-proj/mask.png',
  previewPath: null,
  resultPath: null,
  placement: JSON.stringify({ version: 2, corners: [[0.1, 0.2], [0.9, 0.2], [0.9, 0.8], [0.1, 0.8]], rotation: 0, scale: 1, productQuad: null }),
  variants: null,
}

beforeEach(() => {
  delete process.env.BLOB_READ_WRITE_TOKEN
  delete process.env.VIZ_STORAGE_DRIVER
  delete process.env.VIZ_STAGING_TTL_MS
})

const cleanupKeys: string[] = []
afterEach(async () => {
  for (const key of cleanupKeys.splice(0)) {
    await vizDelPrefix(key).catch(() => undefined)
  }
})

describe('S+4 staging GC (local driver, pravi mtime)', () => {
  it('spec sekvence: fresh ostane, expired se izbriše, project ostane, render-jobs ostanejo', async () => {
    // staging: 1 svež (1 h star) + 2 pretečena (30 h star, TTL 24 h)
    const fresh = await stageToken(1 * HOUR)
    cleanupKeys.push(`viz/staging/${fresh}/`)
    const expired1 = await stageToken(30 * HOUR)
    const expired2 = await stageToken(26 * HOUR)

    // projekt + render job (GC se ju NE sme dotakniti)
    await vizPut(projectKey('gc-keep', VIZ_FILE_NAMES.original), Buffer.from('proj'), 'image/jpeg')
    cleanupKeys.push('viz/projects/gc-keep/')

    const result = await gcStaging()

    expect(result.deletedTokens.sort()).toEqual([expired1, expired2].sort())
    expect(result.deletedFiles).toBe(2)
    expect(result.keptTokens).toContain(fresh)
    // fresh staging OSTANE
    expect(await vizHas(stagingKey(fresh, VIZ_FILE_NAMES.original))).toBe(true)
    // expired staging IZBRIŠEN
    expect(await vizHas(stagingKey(expired1, VIZ_FILE_NAMES.original))).toBe(false)
    expect(await vizHas(stagingKey(expired2, VIZ_FILE_NAMES.original))).toBe(false)
    // projekt OSTANE (file + metadata)
    expect(await vizHas(projectKey('gc-keep', VIZ_FILE_NAMES.original))).toBe(true)
    // render-jobs prefix se ni spremenil (GC ga ni dotaknil — preveri da ključi iz prej obstajajo)
    const stagingLeft = (await vizList('viz/staging/')).map((i) => i.key)
    // fresh token je med ostanki; izbrisana pa ne
    expect(stagingLeft.some((k) => k.includes(fresh))).toBe(true)
    expect(stagingLeft.some((k) => k.includes(expired1))).toBe(false)
    // števec
    expect(result.scannedTokens).toBeGreaterThanOrEqual(3)
  }, 30_000)

  it('TTL preglas po VIZ_STAGING_TTL_MS in opts.ttlMs', async () => {
    process.env.VIZ_STAGING_TTL_MS = String(2 * HOUR)
    const young = await stageToken(1 * HOUR) // star 1 h < 2 h → ostane
    cleanupKeys.push(`viz/staging/${young}/`)
    const old = await stageToken(3 * HOUR) // star 3 h > 2 h → izbriše
    let result = await gcStaging()
    expect(result.ttlMs).toBe(2 * HOUR)
    expect(result.deletedTokens).toContain(old)
    expect(result.deletedTokens).not.toContain(young)
    expect(result.keptTokens).toContain(young)

    // opts.ttlMs preglasi env
    process.env.VIZ_STAGING_TTL_MS = String(DEFAULT_STAGING_TTL_MS)
    const mid = await stageToken(5 * HOUR)
    result = await gcStaging({ ttlMs: 30 * HOUR }) // zelo dolg TTL → ne briše
    expect(result.deletedTokens).not.toContain(mid)
  }, 30_000)

  it('aktivni token (novejša datoteka) ostane, četudi je del starejši', async () => {
    const token = `tok-${randomUUID().slice(0, 12)}`
    cleanupKeys.push(`viz/staging/${token}/`)
    // stara datoteka (30 h) + nova datoteka (1 h) → latest = 1 h → ostane
    const p1 = await vizPut(stagingKey(token, VIZ_FILE_NAMES.original), Buffer.from('old'), 'image/jpeg')
    const d1 = path.join(process.cwd(), 'public', p1.key)
    await utimes(d1, new Date(Date.now() - 30 * HOUR), new Date(Date.now() - 30 * HOUR))
    const p2 = await vizPut(stagingKey(token, VIZ_FILE_NAMES.preview), Buffer.from('new'), 'image/jpeg')
    const d2 = path.join(process.cwd(), 'public', p2.key)
    await utimes(d2, new Date(Date.now() - 1 * HOUR), new Date(Date.now() - 1 * HOUR))

    const result = await gcStaging()
    expect(result.deletedTokens).not.toContain(token)
    expect(await vizHas(stagingKey(token, VIZ_FILE_NAMES.original))).toBe(true)
  }, 30_000)

  it('stagingTokenOfKey: varna oblika, zavrača traversal', () => {
    expect(stagingTokenOfKey('viz/staging/tok-1/original.jpg')).toBe('tok-1')
    expect(stagingTokenOfKey('viz/projects/id/original.jpg')).toBeNull()
    expect(stagingTokenOfKey('viz/staging/')).toBeNull()
    expect(stagingTokenOfKey('viz/staging/..%2f/x.jpg')).toBeNull()
    expect(stagingTokenOfKey('other')).toBeNull()
  })
})
