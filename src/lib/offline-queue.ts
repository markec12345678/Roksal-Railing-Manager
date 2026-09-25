'use client'

/**
 * Offline vrsta (queue) za zapise, ki nastanejo brez povezave — R128 (issue #5 §4).
 * ---------------------------------------------------------------------------
 * Terenski tok (monter v garaži/kleti/balkonu brez signala) NE SME izgubiti
 * zapisov. R128 zamenja localStorage z IndexedDB in doda produkcsko pogodbo:
 *
 *  • STANJA: pending → sending → succeeded | failed | conflict
 *      - succeeded  = 2xx (hranjen 24 h kot potrdilo, nato GC);
 *      - failed     = 4xx (NI tiho izgubljen — čaka ročni retry/odstranitev);
 *      - conflict   = 409 (nasprotujoče stanje — čaka ročno odločitev);
 *      - 429/5xx/brez mreže = pending z eksponentnim backoffom.
 *  • IDEMPOTENCA: vsak čakajoč zapis dobi klient mutacijski ID (mutationId),
 *    ki se ob VSAKEM poizkusu pošlje kot `Idempotency-Key` — isti ključ pri
 *    ponovitvi ne ustvari dvojnika (strežnik: src/lib/idempotency.ts).
 *  • BREZ PERSISTENTNIH KREDENTIALOV: vrsta NE shranjuje NOBENE glave
 *    (Authorization/Cookie/X-Api-Key vključno) — ponovitev pošlje samo sejni
 *    piškotek (httpOnly, pošlje ga brskalnik) + Idempotency-Key. Kredenciali
 *    ne morejo ostati na disku.
 *  • VRSTNI RED: zapisi imajo monotoni `seq` — flush pošilja v nastanku vrstnem
 *    redu (zaporedno, ne vzporedno).
 *  • RETRY/BACKOFF: 30 s → 1 min → 2 min → … → 15 min (strop); flush pošilja
 *    samo zapise, katerih `nextAttemptAt` je že minilo.
 *  • MIGRACIJA: stari localStorage `roksal-offline-queue` se enkrat uvozri v
 *    IndexedDB (pending) in izbriše — nadgradnja ne izgubi čakajočih zapisov.
 *  • CRASH RECOVERY: zapis ujet v `sending` > 5 min (sesutje brskalnika) se
 *    pri naslednjem flushu vrne v pending (Idempotency-Key prepreči dvojnika).
 *  • ZMOGLJIVOST: največ 200 vnosov; ob polni vrsti flush vrne iskren
 *    sintetičen 503 { queued:false } — ni tihe izgube.
 *
 * Uporaba: `const res = await fetchWithQueue('/api/measurements', { … })`
 * — vrne pravi Response ali sintetičen 202 { queued:true, id, mutationId }.
 */

const DB_NAME = 'roksal-offline'
const DB_VERSION = 1
const STORE = 'requests'
const META = 'meta'
const LEGACY_KEY = 'roksal-offline-queue'

export const QUEUE_EVENT = 'roksal:queue-change'

export type QueueStatus = 'pending' | 'sending' | 'succeeded' | 'failed' | 'conflict'

/** Stanja, ki jih uporabnik še mora "pospraviti" (števec v pasu). */
const ACTIONABLE: QueueStatus[] = ['pending', 'sending', 'failed', 'conflict']

export interface QueuedRequest {
  id: string
  url: string
  method: string
  body: unknown
  /** ZASTARELO (pre-R128): niso več shranjene (kredentials sanitizacija). */
  headers?: Record<string, string>
  createdAt: string
  label?: string
  /** R128 naslednja polja (novalni zapisi jih vedno imajo): */
  mutationId?: string
  seq?: number
  status?: QueueStatus
  attempts?: number
  nextAttemptAt?: string
  lastError?: string
  statusCode?: number
  updatedAt?: string
  succeededAt?: string
}

export interface QueueItem {
  id: string
  seq: number
  url: string
  method: string
  body: unknown
  /** Stabilen klient mutacijski ID — `Idempotency-Key` ob vsakem poizkusu. */
  mutationId: string
  createdAt: string
  label?: string
  status: QueueStatus
  attempts: number
  nextAttemptAt: string
  lastError?: string
  statusCode?: number
  updatedAt: string
  succeededAt?: string
}

/** Strop vrste — pošten 503 namesto tihe izgube. */
export const MAX_QUEUE_ITEMS = 200
/** succeeded potrdila se po 24 h počistijo; failed/conflict po 7 dneh. */
const SUCCEEDED_TTL_MS = 24 * 60 * 60 * 1000
const FAILED_TTL_MS = 7 * 24 * 60 * 60 * 1000
/** Ujet v `sending` dlje kot 5 min = sesutje procesa → nazaj v pending. */
const STALE_SENDING_MS = 5 * 60 * 1000
const BACKOFF_BASE_MS = 30 * 1000
const BACKOFF_CAP_MS = 15 * 60 * 1000

const QUEUABLE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Diagnostika: glave z kredenciali v vrsti NIKOLI ne potujejo na disk. */
function warnCredentialHeaders(headers?: Record<string, string>): void {
  if (!headers) return
  for (const key of Object.keys(headers)) {
    const lower = key.toLowerCase()
    if (lower === 'authorization' || lower === 'cookie' || lower === 'x-api-key') {
      console.warn('[offline-queue] glava z kredenciali se NE shrani v vrsto (ponovitev uporabi samo sejni piškotek)')
      return
    }
  }
}

function newId(prefix: string): string {
  return `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

// ---------------------------------------------------------------------------
// IndexedDB osnova
// ---------------------------------------------------------------------------

type LegacyItem = QueuedRequest

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('status', 'status')
        store.createIndex('seq', 'seq')
        store.createIndex('nextAttemptAt', 'nextAttemptAt')
      }
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

let dbPromise: Promise<IDBDatabase> | null = null
let migrationDone = false

function withDb<T>(fn: (db: IDBDatabase) => Promise<T>): Promise<T> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('indexedDB ni na voljo (SSR/ni brskalnika)'))
  }
  dbPromise ??= openDb()
  return dbPromise.then(async (db) => {
    if (!migrationDone) {
      migrationDone = true
      await migrateLegacyLocalStorage(db)
    }
    return fn(db)
  })
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Enojni build korak — zapiši vse v eni transakciji. */
function transactionToPromise(db: IDBDatabase, stores: string[], mode: IDBTransactionMode, fn: (tx: IDBTransaction) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
    fn(tx)
  })
}

/** Nadgradnja s starega localStorage — enkrat, brez izgube podatkov. */
async function migrateLegacyLocalStorage(db: IDBDatabase): Promise<void> {
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY)
    if (!raw) return
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) {
      window.localStorage.removeItem(LEGACY_KEY)
      return
    }
    let seq = await getSeqCounter(db)
    await transactionToPromise(db, [STORE, META], 'readwrite', (tx) => {
      const store = tx.objectStore(STORE)
      const meta = tx.objectStore(META)
      for (const legacy of parsed as LegacyItem[]) {
        if (!legacy?.id || !legacy?.url) continue
        const item: QueueItem = {
          id: legacy.id,
          seq: ++seq,
          url: legacy.url,
          method: legacy.method ?? 'POST',
          body: legacy.body ?? null,
          mutationId: newId('m'),
          createdAt: legacy.createdAt ?? new Date().toISOString(),
          label: legacy.label,
          status: 'pending',
          attempts: 0,
          nextAttemptAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        store.put(item)
      }
      meta.put(seq, 'seq')
    })
    window.localStorage.removeItem(LEGACY_KEY)
    if (parsed.length > 0) notify()
  } catch {
    // Pokvarjen legacy zapis — ne sabotiraj nove vrste.
    try { window.localStorage.removeItem(LEGACY_KEY) } catch { /* ignore */ }
  }
}

async function getSeqCounter(db: IDBDatabase): Promise<number> {
  const tx = db.transaction(META, 'readonly')
  const current = await requestToPromise(tx.objectStore(META).get('seq') as IDBRequest<number | undefined>)
  return typeof current === 'number' ? current : 0
}

async function nextSeq(db: IDBDatabase): Promise<number> {
  const tx = db.transaction(META, 'readwrite')
  const store = tx.objectStore(META)
  const current = await requestToPromise(store.get('seq') as IDBRequest<number | undefined>)
  const seq = (typeof current === 'number' ? current : 0) + 1
  store.put(seq, 'seq')
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
  return seq
}

function normalize(raw: QueuedRequest | undefined): QueueItem | null {
  if (!raw?.id || !raw.url) return null
  return {
    id: raw.id,
    seq: raw.seq ?? 0,
    url: raw.url,
    method: raw.method ?? 'POST',
    body: raw.body ?? null,
    mutationId: raw.mutationId ?? newId('m'),
    createdAt: raw.createdAt ?? new Date().toISOString(),
    label: raw.label,
    status: raw.status ?? 'pending',
    attempts: raw.attempts ?? 0,
    nextAttemptAt: raw.nextAttemptAt ?? new Date(0).toISOString(),
    lastError: raw.lastError,
    statusCode: raw.statusCode,
    updatedAt: raw.updatedAt ?? raw.createdAt ?? new Date().toISOString(),
    succeededAt: raw.succeededAt,
  }
}

function notify(): void {
  void getQueueLength()
    .then((n) => {
      if (typeof window === 'undefined') return
      window.dispatchEvent(new CustomEvent(QUEUE_EVENT, { detail: n }))
    })
    .catch(() => undefined)
}

function backoffMs(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1), BACKOFF_CAP_MS)
}

// ---------------------------------------------------------------------------
// Branje stanja
// ---------------------------------------------------------------------------

export async function getQueueItems(statuses?: QueueStatus[]): Promise<QueueItem[]> {
  try {
    const items = await withDb((db) => {
      const tx = db.transaction(STORE, 'readonly')
      return requestToPromise(tx.objectStore(STORE).getAll() as IDBRequest<QueuedRequest[]>)
    })
    return items
      .map(normalize)
      .filter((i): i is QueueItem => i !== null)
      .filter((i) => (statuses ? statuses.includes(i.status) : true))
      .sort((a, b) => a.seq - b.seq || a.createdAt.localeCompare(b.createdAt))
  } catch {
    return []
  }
}

/** Števec akcijskih zapisov (pending+sending+failed+conflict). */
export async function getQueueLength(): Promise<number> {
  const items = await getQueueItems(ACTIONABLE)
  return items.length
}

export async function getQueueLabels(): Promise<string[]> {
  const items = await getQueueItems(ACTIONABLE)
  return items.slice(0, 3).map((q) => q.label ?? q.url)
}

// ---------------------------------------------------------------------------
// Vrstenje (enqueue)
// ---------------------------------------------------------------------------

async function gcIfNeeded(db: IDBDatabase): Promise<void> {
  const now = Date.now()
  const tx = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  const all = await requestToPromise(store.getAll() as IDBRequest<QueuedRequest[]>)
  for (const raw of all) {
    const item = normalize(raw)
    if (!item) { store.delete(raw.id); continue }
    const stamp = item.succeededAt ?? item.updatedAt
    const age = now - new Date(stamp).getTime()
    const expired =
      (item.status === 'succeeded' && age > SUCCEEDED_TTL_MS) ||
      ((item.status === 'failed' || item.status === 'conflict') && age > FAILED_TTL_MS)
    if (expired) store.delete(item.id)
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

async function enqueue(
  url: string,
  method: string,
  body: unknown,
  label?: string,
): Promise<Response> {
  const db = await withDb((d) => Promise.resolve(d))
  await gcIfNeeded(db)

  const count = await (async () => {
    const tx = db.transaction(STORE, 'readonly')
    return requestToPromise(tx.objectStore(STORE).count())
  })()
  if (count >= MAX_QUEUE_ITEMS) {
    // Pošteno: vrata so polna — javimo, ne molčimo.
    return new Response(JSON.stringify({ queued: false, reason: 'queue_full', max: MAX_QUEUE_ITEMS }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const seq = await nextSeq(db)
  const now = new Date().toISOString()
  const item: QueueItem = {
    id: newId('q'),
    seq,
    url,
    method,
    body: body ?? null,
    mutationId: newId('m'),
    createdAt: now,
    label,
    status: 'pending',
    attempts: 0,
    nextAttemptAt: now,
    updatedAt: now,
  }
  await transactionToPromise(db, [STORE], 'readwrite', (tx) => {
    tx.objectStore(STORE).put(item)
  })
  notify()
  return new Response(JSON.stringify({ queued: true, id: item.id, mutationId: item.mutationId }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ---------------------------------------------------------------------------
// Flush — zaporedno pošiljanje v vrstnem redu nastanka
// ---------------------------------------------------------------------------

let flushing = false

function sendHeaders(item: QueueItem, extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Idempotency-Key': item.mutationId,
    ...(extra ?? {}),
  }
}

async function putItem(db: IDBDatabase, item: QueueItem): Promise<void> {
  await transactionToPromise(db, [STORE], 'readwrite', (tx) => {
    tx.objectStore(STORE).put(item)
  })
}

/** Vrne zapise, ki jih ta flush sme pošiljati (pravi status + zapadlost). */
async function dueItems(db: IDBDatabase): Promise<QueueItem[]> {
  const tx = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  const all = await requestToPromise(store.getAll() as IDBRequest<QueuedRequest[]>)
  const now = Date.now()
  const ready: QueueItem[] = []
  for (const raw of all) {
    const item = normalize(raw)
    if (!item) { store.delete(raw.id); continue }
    if (item.status === 'sending') {
      const staleMs = now - new Date(item.updatedAt).getTime()
      if (staleMs <= STALE_SENDING_MS) continue
      // Crash recovery: Idempotency-Key na strežniku prepreči dvojnika.
      // Po recovery NADALJUJEMO k zapadlostni preverbi — zapis gre v vrsto
      // takoj (ne šele ob naslednjem flushu).
      item.status = 'pending'
      item.attempts = Math.max(0, item.attempts - 1)
      item.updatedAt = new Date().toISOString()
      store.put(item)
    }
    if (item.status === 'succeeded') continue
    if (new Date(item.nextAttemptAt).getTime() > now) continue
    ready.push(item)
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
  return ready.sort((a, b) => a.seq - b.seq || a.createdAt.localeCompare(b.createdAt))
}

/** Pošlje vse zapadle zapise (zaporedno, v vrstnem redu); vrne število uspešno poslanih. */
export async function flushQueue(): Promise<number> {
  if (flushing) return 0
  flushing = true
  let sent = 0
  let changed = false
  try {
    const db = await withDb((d) => Promise.resolve(d))
    const queue = await dueItems(db)
    for (const item of queue) {
      const now = new Date().toISOString()
      const sending: QueueItem = { ...item, status: 'sending', attempts: item.attempts + 1, updatedAt: now }
      await putItem(db, sending)
      try {
        const res = await fetch(item.url, {
          method: item.method,
          headers: sendHeaders(item),
          body: JSON.stringify(item.body),
        })
        if (res.ok) {
          await putItem(db, {
            ...sending,
            status: 'succeeded',
            statusCode: res.status,
            succeededAt: new Date().toISOString(),
            lastError: undefined,
            updatedAt: new Date().toISOString(),
          })
          sent += 1
          changed = true
        } else if (res.status === 409) {
          // Nasprotujoče stanje na strežniku — čaka ročno odločitev (NI izguba).
          await putItem(db, {
            ...sending,
            status: 'conflict',
            statusCode: 409,
            lastError: 'Strežnik javlja nasprotujoče stanje (409) — potrebna ročna potrditev',
            updatedAt: new Date().toISOString(),
          })
          changed = true
        } else if (res.status === 429 || res.status >= 500) {
          // Začasno — nazaj v vrsto z backoffom.
          const backoff = backoffMs(sending.attempts)
          await putItem(db, {
            ...sending,
            status: 'pending',
            statusCode: res.status,
            lastError: `Strežnik zaseden (${res.status}) — poskus znova čez ${Math.round(backoff / 1000)} s`,
            nextAttemptAt: new Date(Date.now() + backoff).toISOString(),
            updatedAt: new Date().toISOString(),
          })
          changed = true
        } else {
          // 4xx: zahteve ne bo nikdar samodejno uspela, a je NE izgubimo —
          // čaka ročni retry ali odstranitev (točna §4 zahteva).
          let detail = `Napaka ${res.status}`
          try {
            const payload = (await res.json()) as { error?: string }
            if (payload?.error) detail = `${detail}: ${payload.error}`
          } catch { /* brez telesa */ }
          await putItem(db, {
            ...sending,
            status: 'failed',
            statusCode: res.status,
            lastError: detail,
            updatedAt: new Date().toISOString(),
          })
          changed = true
        }
      } catch {
        // Še brez mreže — nazaj v pending z backoffom.
        const backoff = backoffMs(sending.attempts)
        await putItem(db, {
          ...sending,
          status: 'pending',
          lastError: 'Brez povezave',
          nextAttemptAt: new Date(Date.now() + backoff).toISOString(),
          updatedAt: new Date().toISOString(),
        })
        changed = true
      }
    }
  } catch {
    // IndexedDB ni dosegljiv — flush preskočimo (vrsta ostane nedotaknjena).
    return 0
  } finally {
    flushing = false
    if (changed) notify()
  }
  return sent
}

// ---------------------------------------------------------------------------
// Ročno upravljanje (UI)
// ---------------------------------------------------------------------------

/** Ročni retry enega zapisa (failed/conflict → pending + takojšen flush). */
export async function retryItem(id: string): Promise<void> {
  try {
    const db = await withDb((d) => Promise.resolve(d))
    const tx = db.transaction(STORE, 'readonly')
    const raw = await requestToPromise(tx.objectStore(STORE).get(id) as IDBRequest<QueuedRequest | undefined>)
    const item = normalize(raw)
    if (!item || item.status === 'sending') return
    await putItem(db, {
      ...item,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: new Date().toISOString(),
      lastError: undefined,
      updatedAt: new Date().toISOString(),
    })
    notify()
    void flushQueue()
  } catch { /* vrsta nedosegljiva */ }
}

/** Ročni retry vseh failed/conflict zapisov. */
export async function retryFailed(): Promise<void> {
  try {
    const db = await withDb((d) => Promise.resolve(d))
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const all = await requestToPromise(store.getAll() as IDBRequest<QueuedRequest[]>)
    const now = new Date().toISOString()
    for (const raw of all) {
      const item = normalize(raw)
      if (!item || (item.status !== 'failed' && item.status !== 'conflict')) continue
      store.put({
        ...item,
        status: 'pending',
        attempts: 0,
        nextAttemptAt: now,
        lastError: undefined,
        updatedAt: now,
      })
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
    notify()
    void flushQueue()
  } catch { /* vrsta nedosegljiva */ }
}

/** Izbris enega zapisa — eksplicitna uporabnikova odločitev (ne tiho). */
export async function deleteItem(id: string): Promise<void> {
  try {
    const db = await withDb((d) => Promise.resolve(d))
    await transactionToPromise(db, [STORE], 'readwrite', (tx) => {
      tx.objectStore(STORE).delete(id)
    })
    notify()
  } catch { /* vrsta nedosegljiva */ }
}

/** Počisti succeeded potrdila (npr. po uspešnem flushu). */
export async function clearSucceeded(): Promise<void> {
  try {
    const db = await withDb((d) => Promise.resolve(d))
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const all = await requestToPromise(store.getAll() as IDBRequest<QueuedRequest[]>)
    for (const raw of all) {
      if (normalize(raw)?.status === 'succeeded') store.delete(raw.id)
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
    notify()
  } catch { /* vrsta nedosegljiva */ }
}

// ---------------------------------------------------------------------------
// fetch z offline varnostno mrežo
// ---------------------------------------------------------------------------

/**
 * fetch z offline varnostno mrežo: če mreže ni (TypeError), zapis vrsti
 * in vrne sintetičen odgovor 202 { queued:true, id, mutationId }.
 */
export async function fetchWithQueue(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: unknown; label?: string } = {},
): Promise<Response> {
  const method = init.method ?? 'GET'
  try {
    return await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    })
  } catch (err) {
    // Vrstimo SAMO zapisovalne zahteve, ko brskalnik ve, da je offline.
    // GET in mrežne napake ob "online" stanju pustimo skozi.
    if (!QUEUABLE_METHODS.has(method) || navigator.onLine) throw err
    warnCredentialHeaders(init.headers)
    return enqueue(url, method, init.body ?? null, init.label)
  }
}
