'use client'

/**
 * Offline vrsta (queue) za zapise, ki nastanejo brez povezave.
 *
 * Monter na terenu pogosto ni v signalu (garaža, klet, balkon v kotu).
 * Namesto da zapis izgine, se vrsti v localStorage in SAMODEJNO pošlje,
 * ko povezava pride nazaj (dogodek 'online' ali ob zagonu app).
 *
 * Uporaba: `const res = await fetchWithQueue('/api/measurements', { … })`
 * — vrne pravi Response ali sintetičen 202 { queued: true }.
 */

const QUEUE_KEY = 'roksal-offline-queue'
export const QUEUE_EVENT = 'roksal:queue-change'

export interface QueuedRequest {
  id: string
  url: string
  method: string
  body: unknown
  headers?: Record<string, string>
  createdAt: string
  label?: string // npr. 'Meritev 2400×900 mm' za prikaz v bannerju
}

function readQueue(): QueuedRequest[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY)
    const parsed = raw ? (JSON.parse(raw) as QueuedRequest[]) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeQueue(items: QueuedRequest[]) {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(0, 50)))
  } catch { /* localStorage poln — ignoriraj */ }
  window.dispatchEvent(new CustomEvent(QUEUE_EVENT, { detail: items.length }))
}

export function getQueueLength(): number {
  return readQueue().length
}

export function getQueueLabels(): string[] {
  return readQueue().map((q) => q.label ?? q.url).slice(0, 3)
}

/** Pošlje vse vrstične zapise; vrne število uspešno poslanih. */
export async function flushQueue(): Promise<number> {
  const queue = readQueue()
  if (queue.length === 0) return 0
  const remaining: QueuedRequest[] = []
  let sent = 0
  for (const item of queue) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: { 'Content-Type': 'application/json', ...(item.headers ?? {}) },
        body: JSON.stringify(item.body),
      })
      if (res.ok || res.status === 400 || res.status === 401 || res.status === 422) {
        // 4xx = zahtevo ne bo nikdar uspela (npr. potekla seja) — ne držimo je več
        sent += res.ok ? 1 : 0
      } else {
        remaining.push(item) // 5xx — poskusi znova kasneje
      }
    } catch {
      remaining.push(item) // še vedno offline
    }
  }
  writeQueue(remaining)
  return sent
}

/**
 * fetch z offline varnostno mrežo: če mreže ni (TypeError), zapis vrsti
 * in vrne sintetičen odgovor 202 { queued: true }.
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
    if (method === 'GET' || navigator.onLine) throw err
    const item: QueuedRequest = {
      id: `q${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      url,
      method,
      body: init.body ?? null,
      headers: init.headers,
      createdAt: new Date().toISOString(),
      label: init.label,
    }
    writeQueue([...readQueue(), item])
    return new Response(JSON.stringify({ queued: true }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
