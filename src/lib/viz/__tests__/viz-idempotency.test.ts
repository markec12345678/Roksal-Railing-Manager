/**
 * VIZ — idempotenca save/delete (runda S+4, P1 §6).
 *
 * Spec: ponovljeni requesti ne smejo povzročiti:
 *   • podvojenega projekta (isti idempotencyKey → isti projekt)
 *   • podvojenih datotek
 *   • pokvarjenega metadata
 *   • 500 zaradi že neobstoječega objekta (DELETE ×2, GET po DELETE)
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { VIZ_FILE_NAMES, stagingKey, vizDelPrefix, vizList, vizPut } from '../storage'
import { getProject, listProjects } from '../repository'

const PLACEMENT = {
  version: 2,
  corners: [[0.1, 0.2], [0.9, 0.2], [0.9, 0.8], [0.1, 0.8]],
  rotation: 0,
  scale: 1,
  productQuad: null,
}

let tokenA = ''

beforeEach(async () => {
  delete process.env.BLOB_READ_WRITE_TOKEN
  delete process.env.VIZ_STORAGE_DRIVER
  process.env.SESSION_SECRET = 'test-secret-0123456789abcdef'
  const { signSession } = await import('@/lib/session')
  tokenA = await signSession({ sub: 'user-A', email: 'a@test.si', ime: 'A', vloga: 'MONTER' })
})

const cleanupKeys: string[] = []
afterEach(async () => {
  for (const key of cleanupKeys.splice(0)) {
    await vizDelPrefix(key).catch(() => undefined)
  }
})

async function stageSession(): Promise<string> {
  const stagingToken = `tok-${randomUUID().slice(0, 12)}`
  cleanupKeys.push(`viz/staging/${stagingToken}/`)
  for (const name of [VIZ_FILE_NAMES.original, VIZ_FILE_NAMES.product, VIZ_FILE_NAMES.mask, VIZ_FILE_NAMES.preview]) {
    await vizPut(stagingKey(stagingToken, name), Buffer.from(`bytes-${name}`), 'image/jpeg')
  }
  const result = {
    metrics: {},
    placement: PLACEMENT,
    tokens: { original: stagingToken, product: stagingToken, productMask: null, mask: stagingToken },
  }
  await vizPut(stagingKey(stagingToken, VIZ_FILE_NAMES.result), Buffer.from(JSON.stringify(result)), 'application/json')
  return stagingToken
}

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/viz/projects', {
    method: 'POST',
    headers: { authorization: `Bearer ${tokenA}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('S+4 idempotenca — POST save z idempotencyKey', () => {
  it(' isti save ×2 → ISTI projekt (brez podvajanja), drugi odgovor idempotent:true', async () => {
    const projectsRoute = await import('@/app/api/viz/projects/route')
    const stagingToken = await stageSession()
    const idemKey = `idem-${randomUUID().slice(0, 12)}`

    const r1 = await projectsRoute.POST(postRequest({ name: 'Idempotent projekt', stagingToken, idempotencyKey: idemKey }))
    expect(r1.status).toBe(200)
    const b1 = (await r1.json()) as { projectId: string }
    cleanupKeys.push(`viz/projects/${b1.projectId}/`)

    // drugi save z ISTIM ključem — staging že porabljen, vendar ne sme ustvariti novega projekta
    const r2 = await projectsRoute.POST(postRequest({ name: 'Idempotent projekt', stagingToken, idempotencyKey: idemKey }))
    expect(r2.status).toBe(200)
    const b2 = (await r2.json()) as { projectId: string; idempotent: boolean }
    expect(b2.projectId).toBe(b1.projectId)
    expect(b2.idempotent).toBe(true)

    // v shrambi obstaja NATANČNO en metadata zapis za ta ključ
    const all = await listProjects()
    const withKey = all.filter((p) => p.idempotencyKey === idemKey)
    expect(withKey).toHaveLength(1)
    // metadata je veljaven
    expect(await getProject(b1.projectId)).not.toBeNull()
  })

  it('različna ključa → različna projekta (normalno vedenje ohranjeno)', async () => {
    const projectsRoute = await import('@/app/api/viz/projects/route')
    const s1 = await stageSession()
    const r1 = await projectsRoute.POST(postRequest({ name: 'Prvi', stagingToken: s1, idempotencyKey: `k-${randomUUID().slice(0, 8)}` }))
    const s2 = await stageSession()
    const r2 = await projectsRoute.POST(postRequest({ name: 'Drugi', stagingToken: s2, idempotencyKey: `k-${randomUUID().slice(0, 8)}` }))
    expect(r1.status).toBe(200)
    expect(r2.status).toBe(200)
    const b1 = (await r1.json()) as { projectId: string }
    const b2 = (await r2.json()) as { projectId: string }
    expect(b1.projectId).not.toBe(b2.projectId)
    cleanupKeys.push(`viz/projects/${b1.projectId}/`, `viz/projects/${b2.projectId}/`)
  })

  it('brez idempotencyKey vsak save ustvari nov projekt (dokumentirano vedenje)', async () => {
    const projectsRoute = await import('@/app/api/viz/projects/route')
    const s1 = await stageSession()
    const r1 = await projectsRoute.POST(postRequest({ name: 'Brez ključa A', stagingToken: s1 }))
    const s2 = await stageSession()
    const r2 = await projectsRoute.POST(postRequest({ name: 'Brez ključa B', stagingToken: s2 }))
    const b1 = (await r1.json()) as { projectId: string }
    const b2 = (await r2.json()) as { projectId: string }
    expect(b1.projectId).not.toBe(b2.projectId)
    cleanupKeys.push(`viz/projects/${b1.projectId}/`, `viz/projects/${b2.projectId}/`)
  })

  it('podvojenih datotek ni: save ×1 → kanoničnih 6 datotek', async () => {
    const projectsRoute = await import('@/app/api/viz/projects/route')
    const stagingToken = await stageSession()
    const r = await projectsRoute.POST(postRequest({ name: 'Datoteke', stagingToken, idempotencyKey: `k-${randomUUID().slice(0, 8)}` }))
    const { projectId } = (await r.json()) as { projectId: string }
    cleanupKeys.push(`viz/projects/${projectId}/`)
    const files = await vizList(`viz/projects/${projectId}/`)
    expect(files.map((f) => f.key.split('/').pop()).sort()).toEqual([
      VIZ_FILE_NAMES.mask,
      VIZ_FILE_NAMES.original,
      VIZ_FILE_NAMES.placement,
      VIZ_FILE_NAMES.preview,
      VIZ_FILE_NAMES.product,
      VIZ_FILE_NAMES.result,
    ])
  })
})
