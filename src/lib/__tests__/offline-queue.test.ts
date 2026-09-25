// Roksal — testi offline vrste (issue #5 §4: IndexedDB, idempotenca, retry)
// ---------------------------------------------------------------------------
// Dokazuje produkcjsko pogodbo vrste (src/lib/offline-queue.ts):
//   • ob offline POST se zapis vrsti (202 { queued:true }) z mutationId;
//   • GET se NIKOLI ne vrsti; online mrežna napaka se ne vrsti;
//   • vrsta NE shranjuje glav (kredenciali ne morejo ostati na disku);
//   • flush 2xx → succeeded + `Idempotency-Key` = mutationId (ponovitev
//     ponovno uporabi ISTI ključ);
//   • 4xx → failed, zapis OHRANJEN (ni tihe izgube — §4);
//   • 409 → conflict; 429/5xx → pending z backoffom (takojšen flush ne ponavlja);
//   • flush v vrstnem redu nastanka (seq, zaporedno);
//   • migracija legacy localStorage vrste v IndexedDB (nadgradnja brez izgube);
//   • crash recovery: stale `sending` → pending → pošlje;
//   • kapaciteta 200 → pošten 503 { queued:false } (ni tihe izgube);
//   • ročni retry/delete/clearSucceeded.
// IndexedDB = fake-indexeddb; fetch/navigator/window so stubi (node environment).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import type { QueueItem } from '@/lib/offline-queue'

type Responder = (url: string, init: RequestInit | undefined) => Response

interface Harness {
  fetchCalls: Array<{ url: string; init: RequestInit | undefined }>
  setResponder: (r: Responder) => void
  setOffline: (offline: boolean) => void
  localStorageMap: Map<string, string>
  idb: IDBFactory
}

async function setupHarness(initialOnline: boolean): Promise<Harness> {
  vi.resetModules()
  const fetchCalls: Harness['fetchCalls'] = []
  let responder: Responder = () => new Response('{"error":"neznan odgovor"}', { status: 500 })
  let online = initialOnline
  const localStorageMap = new Map<string, string>()
  const listeners = new Map<string, Set<(e: Event) => void>>()
  const idb = new IDBFactory()

  vi.stubGlobal('indexedDB', idb)
  vi.stubGlobal('navigator', { get onLine() { return online } })
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => localStorageMap.get(k) ?? null,
      setItem: (k: string, v: string) => void localStorageMap.set(k, v),
      removeItem: (k: string) => void localStorageMap.delete(k),
    },
    dispatchEvent: (e: Event) => {
      listeners.get(e.type)?.forEach((fn) => fn(e))
      return true
    },
    addEventListener: (t: string, fn: (e: Event) => void) => {
      if (!listeners.has(t)) listeners.set(t, new Set())
      listeners.get(t)?.add(fn)
    },
    removeEventListener: (t: string, fn: (e: Event) => void) => void listeners.get(t)?.delete(fn),
  })
  vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init })
    return responder(String(url), init)
  }))
  return {
    fetchCalls,
    setResponder: (r) => { responder = r },
    setOffline: (o) => { online = o },
    localStorageMap,
    idb,
  }
}

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** Direkten zapis v isto IndexedDB (za scenarije, ki jih javni API ne razstavlja). */
async function seedItems(idb: IDBFactory, items: Array<Partial<QueueItem> & { id: string }>): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = idb.open('roksal-offline', 1)
    req.onupgradeneeded = () => {
      const d = req.result
      if (!d.objectStoreNames.contains('requests')) {
        const store = d.createObjectStore('requests', { keyPath: 'id' })
        store.createIndex('status', 'status')
        store.createIndex('seq', 'seq')
        store.createIndex('nextAttemptAt', 'nextAttemptAt')
      }
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('requests', 'readwrite')
    for (const item of items) {
      tx.objectStore('requests').put({
        seq: 0,
        url: '/api/test',
        method: 'POST',
        body: {},
        mutationId: `m_seed_${item.id}`,
        createdAt: new Date().toISOString(),
        status: 'pending',
        attempts: 0,
        nextAttemptAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // prihodnost → flush ne pošlje
        updatedAt: new Date().toISOString(),
        ...item,
      })
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
  db.close()
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('offline vrsta — vrstenje (enqueue)', () => {
  it('ob offline POST se zapis vrsti: 202 { queued:true, mutationId } + pending v IndexedDB', async () => {
    const h = await setupHarness(false)
    h.setResponder(() => { throw new TypeError('Ni mreže') })
    const q = await import('@/lib/offline-queue')

    const res = await q.fetchWithQueue('/api/measurements', {
      method: 'POST',
      body: { projectId: 'p1', dolzinaMm: 2400, visinaMm: 900 },
      label: 'Meritev 2400×900',
    })
    expect(res.status).toBe(202)
    const payload = (await res.json()) as { queued: boolean; mutationId: string; id: string }
    expect(payload.queued).toBe(true)
    expect(payload.mutationId).toMatch(/^m/)

    const items = await q.getQueueItems()
    expect(items).toHaveLength(1)
    expect(items[0].status).toBe('pending')
    expect(items[0].mutationId).toBe(payload.mutationId)
    expect(items[0].body).toEqual({ projectId: 'p1', dolzinaMm: 2400, visinaMm: 900 })
    expect(items[0].label).toBe('Meritev 2400×900')
    expect(await q.getQueueLength()).toBe(1)
  })

  it('GET se nikoli ne vrsti; online mrežna napaka se ne vrsti', async () => {
    const h = await setupHarness(false)
    h.setResponder(() => { throw new TypeError('Ni mreže') })
    const q = await import('@/lib/offline-queue')

    await expect(q.fetchWithQueue('/api/projects', { method: 'GET' })).rejects.toThrow('Ni mreže')
    // online: mrežna napaka ni "offline zapis" — pusti skozi (pravi bug se vidi)
    h.setOffline(true)
    await expect(
      q.fetchWithQueue('/api/measurements', { method: 'POST', body: {} }),
    ).rejects.toThrow('Ni mreže')
    expect(await q.getQueueLength()).toBe(0)
  })

  it('vrsta NE shranjuje glav — kredenciali ne morejo ostati na disku (§4)', async () => {
    const h = await setupHarness(false)
    h.setResponder(() => { throw new TypeError('Ni mreže') })
    const q = await import('@/lib/offline-queue')

    await q.fetchWithQueue('/api/measurements', {
      method: 'POST',
      body: { a: 1 },
      headers: { Authorization: 'Bearer TOP-SEKRET', 'X-App': 'roksal' },
    })
    const items = await q.getQueueItems()
    expect(items).toHaveLength(1)
    const serialized = JSON.stringify(items[0])
    expect(serialized).not.toContain('TOP-SEKRET')
    expect(serialized).not.toContain('Authorization')
    expect(serialized).not.toContain('X-App')
  })
})

describe('offline vrsta — flush (pošiljanje)', () => {
  it('2xx → succeeded; pošlje `Idempotency-Key` = mutationId', async () => {
    const h = await setupHarness(false)
    h.setResponder(() => { throw new TypeError('Ni mreže') })
    const q = await import('@/lib/offline-queue')

    await q.fetchWithQueue('/api/measurements', { method: 'POST', body: { a: 1 } })
    h.setResponder(() => jsonRes(201, { ok: true }))

    const sent = await q.flushQueue()
    expect(sent).toBe(1)
    expect(h.fetchCalls[1]?.init?.headers).toMatchObject({ 'Idempotency-Key': expect.stringMatching(/^m/) })
    const items = await q.getQueueItems()
    expect(items[0].status).toBe('succeeded')
    expect(items[0].statusCode).toBe(201)
    // succeeded ni akcija — števec pasu pade na 0
    expect(await q.getQueueLength()).toBe(0)
  })

  it('4xx → failed, zapis OHRANJEN z napako (ni tihe izgube — §4)', async () => {
    const h = await setupHarness(false)
    h.setResponder(() => { throw new TypeError('Ni mreže') })
    const q = await import('@/lib/offline-queue')

    await q.fetchWithQueue('/api/measurements', { method: 'POST', body: { a: 1 }, label: 'Pokvarjen zapis' })
    h.setResponder(() => jsonRes(400, { error: 'Neveljavni podatki' }))

    const sent = await q.flushQueue()
    expect(sent).toBe(0)
    const failed = await q.getQueueItems(['failed'])
    expect(failed).toHaveLength(1)
    expect(failed[0].statusCode).toBe(400)
    expect(failed[0].lastError).toContain('Neveljavni podatki')
    expect(await q.getQueueLength()).toBe(1) // ostane akcija (viden v pasu)
  })

  it('409 → conflict (ročna odločitev, ne izguba)', async () => {
    const h = await setupHarness(false)
    h.setResponder(() => { throw new TypeError('Ni mreže') })
    const q = await import('@/lib/offline-queue')

    await q.fetchWithQueue('/api/measurements', { method: 'POST', body: { a: 1 } })
    h.setResponder(() => jsonRes(409, { error: 'Nasprotujoče stanje' }))
    await q.flushQueue()

    const conflict = await q.getQueueItems(['conflict'])
    expect(conflict).toHaveLength(1)
    expect(conflict[0].statusCode).toBe(409)
  })

  it('429/5xx → pending z backoffom; takojšen flush ne ponavlja; ročni retry pa', async () => {
    const h = await setupHarness(false)
    h.setResponder(() => { throw new TypeError('Ni mreže') })
    const q = await import('@/lib/offline-queue')

    await q.fetchWithQueue('/api/measurements', { method: 'POST', body: { a: 1 } })
    h.setResponder(() => jsonRes(500, {}))
    await q.flushQueue()

    const items = await q.getQueueItems(['pending'])
    expect(items).toHaveLength(1)
    expect(items[0].attempts).toBe(1)
    // backoff ≥ 30 s v prihodnost
    expect(new Date(items[0].nextAttemptAt).getTime()).toBeGreaterThan(Date.now() + 25_000)

    // takojšen flush: zapis NI zapadel → NI novega poizkusa
    // (fetchCalls = 1 neuspel live poskus + 1 poizkus flusha #1)
    await q.flushQueue()
    expect(h.fetchCalls).toHaveLength(2)

    // ročni retry: resetira attempts + nextAttemptAt → pošlje
    h.setResponder(() => jsonRes(201, { ok: true }))
    await q.retryItem(items[0].id)
    // retryItem sproži flush asinhrono — čakaj na KONČNO stanje (ne števec klicev)
    await vi.waitFor(async () => {
      const after = await q.getQueueItems()
      expect(after[0]?.status).toBe('succeeded')
    })
    const after = await q.getQueueItems()
    expect(after[0].status).toBe('succeeded')
    // quiescenca: noben pending/sending ni več v obtoku (izolacija testov)
    expect((await q.getQueueItems(['pending', 'sending']))).toHaveLength(0)
  })

  it('flush pošilja v vrstnem redu nastanka (seq, zaporedno)', async () => {
    const h = await setupHarness(false)
    h.setResponder(() => { throw new TypeError('Ni mreže') })
    const q = await import('@/lib/offline-queue')

    await q.fetchWithQueue('/api/measurements', { method: 'POST', body: { n: 1 } })
    await q.fetchWithQueue('/api/measurements', { method: 'POST', body: { n: 2 } })
    await q.fetchWithQueue('/api/measurements', { method: 'POST', body: { n: 3 } })
    h.setResponder(() => jsonRes(201, {}))

    const sent = await q.flushQueue()
    expect(sent).toBe(3)
    // Samo flush pošiljanja (imajo Idempotency-Key) — live poskusi so padli
    const flushBodies = h.fetchCalls
      .filter((c) => (c.init?.headers as Record<string, string> | undefined)?.['Idempotency-Key'])
      .map((c) => JSON.parse(c.init?.body as string).n)
    expect(flushBodies).toEqual([1, 2, 3])
  })
})

describe('offline vrsta — migracija, crash recovery, kapaciteta', () => {
  it('legacy localStorage vrsta se uvozri v IndexedDB in izbriše (nadgradnja brez izgube)', async () => {
    const h = await setupHarness(false)
    const legacy = [
      { id: 'q_legacy1', url: '/api/measurements', method: 'POST', body: { n: 1 }, createdAt: new Date().toISOString(), label: 'Stara meritev' },
      { id: 'q_legacy2', url: '/api/measurements', method: 'POST', body: { n: 2 }, createdAt: new Date().toISOString() },
    ]
    h.localStorageMap.set('roksal-offline-queue', JSON.stringify(legacy))

    const q = await import('@/lib/offline-queue') // prvi dostop sproži migracijo
    const items = await q.getQueueItems()
    expect(items).toHaveLength(2)
    expect(items.every((i) => i.status === 'pending')).toBe(true)
    expect(items.every((i) => typeof i.mutationId === 'string' && i.mutationId.startsWith('m'))).toBe(true)
    expect(items[0].seq).toBeLessThan(items[1].seq) // vrstni red ohranjen
    expect(h.localStorageMap.has('roksal-offline-queue')).toBe(false)
  })

  it('stale `sending` (sesutje brskalnika) → recovery v pending → pošlje', async () => {
    const h = await setupHarness(false)
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    await seedItems(h.idb, [
      { id: 'q_stale', status: 'sending', attempts: 1, updatedAt: tenMinAgo, nextAttemptAt: tenMinAgo },
    ])

    const q = await import('@/lib/offline-queue')
    h.setResponder(() => jsonRes(201, {}))
    const sent = await q.flushQueue()

    expect(sent).toBe(1)
    const items = await q.getQueueItems()
    expect(items[0].status).toBe('succeeded')
    // Idempotency-Key = ISTI mutationId kot seed → strežnik brez dvojnika
    expect(h.fetchCalls[0]?.init?.headers).toMatchObject({ 'Idempotency-Key': 'm_seed_q_stale' })  })

  it('kapaciteta 200 → pošten 503 { queued:false } (ni tihe izgube)', async () => {
    const h = await setupHarness(false)
    const bulk = Array.from({ length: 200 }, (_, i) => ({ id: `q_full_${i}` }))
    await seedItems(h.idb, bulk)

    const q = await import('@/lib/offline-queue')
    h.setResponder(() => { throw new TypeError('Ni mreže') })
    const res = await q.fetchWithQueue('/api/measurements', { method: 'POST', body: { n: 'nov' } })

    expect(res.status).toBe(503)
    const payload = (await res.json()) as { queued: boolean; reason: string }
    expect(payload.queued).toBe(false)
    expect(payload.reason).toBe('queue_full')
    // obstoječih 200 ni bilo poškodovanih
    expect((await q.getQueueItems()).length).toBe(200)
  })
})

describe('offline vrsta — ročno upravljanje', () => {
  it('deleteItem odstrani zapis; retryFailed vseh failed/conflict vrne v promet; clearSucceeded počisti potrdila', async () => {
    const h = await setupHarness(false)
    h.setResponder(() => { throw new TypeError('Ni mreže') })
    const q = await import('@/lib/offline-queue')

    // trije zapisi → flush: prvi 201, drugi 400, tretji 409
    await q.fetchWithQueue('/api/measurements', { method: 'POST', body: { n: 1 } })
    await q.fetchWithQueue('/api/measurements', { method: 'POST', body: { n: 2 } })
    await q.fetchWithQueue('/api/measurements', { method: 'POST', body: { n: 3 } })
    const codes = [201, 400, 409]
    let i = 0
    h.setResponder(() => jsonRes(codes[i++] ?? 500, {}))
    await q.flushQueue()

    let items = await q.getQueueItems()
    expect(items.map((x) => x.status)).toEqual(['succeeded', 'failed', 'conflict'])

    // retryFailed → oba problematična nazaj v promet → tokrat 201
    h.setResponder(() => jsonRes(201, {}))
    await q.retryFailed()
    await vi.waitFor(async () => {
      const all = await q.getQueueItems()
      expect(all.every((x) => x.status === 'succeeded')).toBe(true)
    })
    // quiescenca pred nadaljnjimi koraki (izolacija testov)
    expect((await q.getQueueItems(['pending', 'sending']))).toHaveLength(0)
    items = await q.getQueueItems()
    expect(items.every((x) => x.status === 'succeeded')).toBe(true)

    // clearSucceeded počisti potrdila
    await q.clearSucceeded()
    expect(await q.getQueueItems()).toHaveLength(0)

    // deleteItem: en zapis, uspešno odstranjen
    h.setResponder(() => { throw new TypeError('Ni mreže') })
    await q.fetchWithQueue('/api/measurements', { method: 'POST', body: { n: 9 } })
    const one = (await q.getQueueItems())[0]
    await q.deleteItem(one.id)
    expect(await q.getQueueItems()).toHaveLength(0)
  })
})
