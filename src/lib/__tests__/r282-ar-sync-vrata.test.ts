// R282 — ISSUE #17 F/G DOKLJUČITEV NA OBSTOJEČIH /api/sync VRATAH z R281
// sync metadata (issue #16 §10, V1–V6). Kanon r148 (roksal_test prek
// globalSetup, handlerji direktno) — R282 DODA, kaj F checklist še
// izrecno zahteva, r148 pa NIMA:
//   • F 'replay test' z R281 metadata: Idempotency-Key replay SERIJE, ki
//     nosi mutationId + baseRevision/baseUpdatedAt + contractVersion —
//     identičen odgovor (isti revision/action/echo) — metadata se NE
//     podvoji (exactly-once).
//   • F 'parallel sync test': DVE napravi (X-Device-Id A/B) pišeta ISTI
//     projekt — revizije rastejo MONOTONO, obe spremembi vidni v auditu
//     (nobena tiho izgubljena), kurzor naprave monotono.
//   • G 'Conflict' scenarij §G koraki 1–9 (žično voden — klient bere bazo
//     IZ GET delta odgovora): preberi N → drugi piše (N+1) → prvi pošlje
//     star baseRevision=N → KONFLIKT (serverState, retryable, NIČ
//     spremenjeno, server state vrnjen) → po refreshu (baza iz
//     serverState/GET) možen nov zapis (N+2) → audit pokaže OBE spremembi.
//   • V2/V5 pariteta besednjaka: ISTI metadata objekt je veljaven v
//     kontraktu (parseArSessionPayload sync blok) IN na sync vratah —
//     ENA resnica o mejah (stropi 128/64/int ≥ 0).
// Ruta /api/sync NIČ (NE oslabljena — issue #17 F: obstoječi sync model);
// R281 sync blok v kontraktu NOSI metadata, ki jih ta protokol potrebuje.
import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import { createApiKey } from '@/lib/password'
import { GET as syncGet, POST as syncPost } from '@/app/api/sync/route'
import { parseArSessionPayload } from '@/lib/ar-contract'

const BASE = 'http://localhost/api'
let apiKey: { key: string; id: string; name: string }

function req(path: string, body?: unknown, method = 'GET', headers: Record<string, string> = {}): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey.key}`,
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const MOBILE_ITEM = (mobileId: string, extra: Record<string, unknown> = {}) => ({
  id: mobileId,
  customerName: `r282 stranka ${mobileId.slice(-6)}`,
  railingStyle: 'inox',
  ...extra,
})

type SyncBody = {
  results: Array<{
    ok: boolean
    action: string
    revision?: number
    mutationId?: string | null
    retryable?: boolean
    warnings?: string[]
    error?: string
    serverState?: { syncRevision: number; updatedAt: string; status: string }
  }>
  device?: { deviceId: string; firstSeen: boolean }
  projects?: Array<Record<string, unknown> & { syncRevision: number; updatedAt: string; opombe: string | null }>
  nextCursor?: number
  hasMore?: boolean
}

beforeEach(async () => {
  // Čistimo svoje teste po tagih (r282-*) — vzorec r148.
  await db.idempotencyKey.deleteMany({ where: { key: { contains: 'r282' } } })
  await db.syncTombstone.deleteMany({ where: { mobileProjectId: { contains: 'r282' } } })
  await db.syncDevice.deleteMany({ where: { deviceId: { contains: 'r282' } } })
  await db.auditLog.deleteMany({ where: { akcija: { contains: 'SYNC' }, newValue: { contains: 'r282' } } })
  await db.project.deleteMany({ where: { OR: [{ nazivProjekta: { contains: 'r282' } }, { mobileProjectId: { contains: 'r282' } }] } })
  await db.customer.deleteMany({ where: { ime: { contains: 'r282' } } })
  await db.apiKey.deleteMany({ where: { name: { contains: 'r282' } } })
  apiKey = await createApiKey({ name: `r282-key-${Date.now()}` })
})

// ---------------------------------------------------------------------------
// F — replay test z R281 sync metadata (issue #17 F 'replay test')
// ---------------------------------------------------------------------------

describe('F replay z R281 sync metadata (issue #17 F — exactly-once, echo)', () => {
  it('replay serije z mutationId + base + contractVersion → identičen odgovor (isti revision/action/echo) — metadata se NE podvoji', async () => {
    const mobileId = `r282-replay-${Date.now()}`
    const headers = {
      'Idempotency-Key': `r282-idem-${Date.now()}`,
      'X-Device-Id': 'r282-dev-replay',
    }
    const item = MOBILE_ITEM(mobileId, {
      mutationId: 'mut-r282-replay-001',
      baseRevision: 0,
      baseUpdatedAt: '2026-09-29T09:00:00.000Z',
      contractVersion: 1,
      status: 'NACRTOVANO',
    })
    const res1 = await syncPost(req('/api/sync', [item], 'POST', headers))
    const b1 = (await res1.json()) as SyncBody
    const res2 = await syncPost(req('/api/sync', [item], 'POST', headers))
    expect(res2.headers.get('Idempotent-Replay')).toBe('true')
    const b2 = (await res2.json()) as SyncBody

    expect(b1.results[0].ok).toBe(true)
    expect(b1.results[0].action).toBe('created')
    expect(b1.results[0].revision).toBe(1)
    expect(b1.results[0].mutationId).toBe('mut-r282-replay-001')
    // Replay = BAJTNATO ista serija (isti revision, isti echo, ni dvojnikov).
    expect(b2.results[0]).toEqual(b1.results[0])
    const project = await db.project.findUnique({ where: { mobileProjectId: mobileId } })
    expect(project).not.toBeNull()
    expect(project!.syncRevision).toBe(1)
  })

  it('audit nosi mutationId + contractVersion (R274/R281 — sledljivost metadata na obstoječih vratah)', async () => {
    const mobileId = `r282-audit-${Date.now()}`
    await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { mutationId: 'mut-r282-audit', contractVersion: 1 })], 'POST', { 'X-Device-Id': 'r282-dev-audit' }))
    const audit = await db.auditLog.findFirst({ where: { akcija: 'SYNC_PROJECT_CREATED', newValue: { contains: mobileId } } })
    expect(audit).not.toBeNull()
    expect(audit!.newValue).toContain('mut-r282-audit')
    expect(audit!.newValue).toContain('"contractVersion":1')
  })
})

// ---------------------------------------------------------------------------
// F — parallel sync test (dve napravi, isti projekt — issue #17 F)
// ---------------------------------------------------------------------------

describe('F parallel sync (dve napravi — revizije monotono, obe spremembi v auditu)', () => {
  it('naprava A ustvari (rev 1) → naprava B piše (rev 2) → naprava A piše (rev 3) — obe spremembi sledljivi, nič tiho izgubljeno', async () => {
    const mobileId = `r282-par-${Date.now()}`
    const devA = 'r282-dev-A'
    const devB = 'r282-dev-B'

    // A ustvari projekt (legacy brez baze — nov projekt NIMA konfliktnih vrat).
    const r1 = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { mutationId: 'mut-par-A1', extraNotes: 'baza A' })], 'POST', { 'X-Device-Id': devA }))
    const b1 = (await r1.json()) as SyncBody
    expect(b1.results[0].ok).toBe(true)
    expect(b1.results[0].revision).toBe(1)

    // B piše s svežo bazo (baseRevision 1 = strežniška) → updated rev 2.
    const r2 = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { mutationId: 'mut-par-B1', baseRevision: 1, extraNotes: 'sprememba B' })], 'POST', { 'X-Device-Id': devB }))
    const b2 = (await r2.json()) as SyncBody
    expect(b2.results[0].ok).toBe(true)
    expect(b2.results[0].action).toBe('updated')
    expect(b2.results[0].revision).toBe(2)

    // A piše SVEŽO bazo (baseRevision 2) → updated rev 3 — A NI prevrtel B.
    const r3 = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { mutationId: 'mut-par-A2', baseRevision: 2, extraNotes: 'sprememba A' })], 'POST', { 'X-Device-Id': devA }))
    const b3 = (await r3.json()) as SyncBody
    expect(b3.results[0].ok).toBe(true)
    expect(b3.results[0].action).toBe('updated')
    expect(b3.results[0].revision).toBe(3)

    // Obe spremembi sta sledljivi v auditu (nobena tiho izgubljena — §G 9).
    // UPDATE audit newValue nosi business polja (brez mobileProjectId) —
    // poizvedba gre prek projectId (r148 kanon).
    const project = await db.project.findUnique({ where: { mobileProjectId: mobileId } })
    const audits = await db.auditLog.findMany({
      where: { akcija: 'SYNC_PROJECT_UPDATED', projectId: project!.id },
      orderBy: { timestamp: 'asc' },
    })
    expect(audits).toHaveLength(2)
    expect(audits[0].newValue).toContain('mut-par-B1')
    expect(audits[0].newValue).toContain('sprememba B')
    expect(audits[1].newValue).toContain('mut-par-A2')
    expect(audits[1].newValue).toContain('sprememba A')
  })

  it('delta kurzor naprave monotono: A vidi rev 3 (cursor=3), ponovno branje od 3 → nič novega, cursor NE pade nazaj', async () => {
    const mobileId = `r282-cursor-${Date.now()}`
    const devA = 'r282-dev-curA'
    await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId)], 'POST', { 'X-Device-Id': devA }))
    await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { baseRevision: 1, extraNotes: 'rev2' })], 'POST', { 'X-Device-Id': 'r282-dev-curB' }))

    const g1 = await syncGet(req('/api/sync?sinceRevision=0', undefined, 'GET', { 'X-Device-Id': devA }))
    const gb1 = (await g1.json()) as SyncBody
    expect(gb1.nextCursor).toBe(2)
    const row = await db.syncDevice.findUnique({ where: { deviceId: devA } })
    expect(row!.lastSyncCursor).toBe(2)

    // Ponovno branje od kurzorja 2 → nič novega; kurzor ostane 2 (monotono).
    const g2 = await syncGet(req('/api/sync?sinceRevision=2', undefined, 'GET', { 'X-Device-Id': devA }))
    const gb2 = (await g2.json()) as SyncBody
    expect(gb2.nextCursor).toBe(2)
    expect((await db.syncDevice.findUnique({ where: { deviceId: devA } }))!.lastSyncCursor).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// G — Conflict scenarij (issue #17 §G koraki 1–9 — žično voden)
// ---------------------------------------------------------------------------

describe('G konfliktni scenarij (§G 1–9 — strežnik ne ugiba, nič tiho izgubljeno)', () => {
  it('koraki 1–9: preberi N → drugi piše N+1 → prvi pošlje star N → KONFLIKT + serverState → refresh → nov zapis N+2 → audit pokaže obe spremembi', async () => {
    const mobileId = `r282-g-${Date.now()}`
    const devA = 'r282-dev-GA' // Manager
    const devB = 'r282-dev-GB' // Android

    // (priprava) A ustvari projekt → rev 1.
    const r0 = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { mutationId: 'mut-G-A0', extraNotes: 'izhodišče' })], 'POST', { 'X-Device-Id': devA }))
    expect(((await r0.json()) as SyncBody).results[0].revision).toBe(1)

    // §G 1 — Manager (A) PREBERE projekt pri reviziji N (žično: GET delta).
    const g1 = await syncGet(req('/api/sync?sinceRevision=0', undefined, 'GET', { 'X-Device-Id': devA }))
    const gb1 = (await g1.json()) as SyncBody
    const vrstica = gb1.projects!.find((p) => p.mobileProjectId === mobileId)
    expect(vrstica).toBeDefined()
    expect(vrstica!.syncRevision).toBe(1)
    const N = vrstica!.syncRevision
    const baseUpdatedAtN = vrstica!.updatedAt // baza, ki jo A vidi na žici

    // §G 2 — Android (B) spremeni meritev s svežo bazo N → N+1.
    const rB = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { mutationId: 'mut-G-B1', baseRevision: N, baseUpdatedAt: baseUpdatedAtN, extraNotes: 'sprememba Android' })], 'POST', { 'X-Device-Id': devB }))
    const bB = (await rB.json()) as SyncBody
    expect(bB.results[0].ok).toBe(true)
    expect(bB.results[0].action).toBe('updated')
    expect(bB.results[0].revision).toBe(N + 1)

    // §G 3 — Manager (A) spremeni ISTO meritev in pošlje STAR baseRevision=N.
    const rA = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { mutationId: 'mut-G-A1', baseRevision: N, baseUpdatedAt: baseUpdatedAtN, extraNotes: 'sprememba Manager' })], 'POST', { 'X-Device-Id': devA }))
    const bA = (await rA.json()) as SyncBody

    // §G 4/5 — Sistem vrne KONFLIKT (ok:false, retryable, serverState z
    // trenutno revizijo N+1) — strežnik ne ugiba.
    expect(bA.results[0].ok).toBe(false)
    expect(bA.results[0].action).toBe('conflict')
    expect(bA.results[0].retryable).toBe(true)
    expect(bA.results[0].error).toContain('Konflikt sinhronizacije')
    expect(bA.results[0].serverState).toBeDefined()
    expect(bA.results[0].serverState!.syncRevision).toBe(N + 1)
    expect(bA.results[0].mutationId).toBe('mut-G-A1') // echo metadata (V2)

    // §G 6/7 — Nobena sprememba se NE izgubi tiho: server state = B-jeva
    // resnica (A-jeva sprememba NI uporabljena, B-jeva ostane).
    const g2 = await syncGet(req('/api/sync?sinceRevision=0', undefined, 'GET', { 'X-Device-Id': devA }))
    const gb2 = (await g2.json()) as SyncBody
    const poKonfliktu = gb2.projects!.find((p) => p.mobileProjectId === mobileId)
    expect(poKonfliktu!.syncRevision).toBe(N + 1)
    expect(poKonfliktu!.opombe).toBe('sprememba Android')

    // §G 8 — Po refreshu (baza iz serverState/GET) je nov zapis MOŽEN:
    // A ponovi z baseRevision=N+1 + svež baseUpdatedAt → updated N+2.
    const rA2 = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { mutationId: 'mut-G-A2', baseRevision: poKonfliktu!.syncRevision, baseUpdatedAt: poKonfliktu!.updatedAt, extraNotes: 'sprememba Manager' })], 'POST', { 'X-Device-Id': devA }))
    const bA2 = (await rA2.json()) as SyncBody
    expect(bA2.results[0].ok).toBe(true)
    expect(bA2.results[0].action).toBe('updated')
    expect(bA2.results[0].revision).toBe(N + 2)

    // §G 9 — Audit pokaže OBE spremembi (B-jeva + A-jeva po razrešitvi).
    const gProject = await db.project.findUnique({ where: { mobileProjectId: mobileId } })
    const audits = await db.auditLog.findMany({
      where: { akcija: 'SYNC_PROJECT_UPDATED', projectId: gProject!.id },
      orderBy: { timestamp: 'asc' },
    })
    expect(audits).toHaveLength(2)
    expect(audits[0].newValue).toContain('mut-G-B1')
    expect(audits[1].newValue).toContain('mut-G-A2')
  })
})

// ---------------------------------------------------------------------------
// V2/V5 — pariteta besednjaka: kontrakt ↔ sync vrata (ENA resnica o mejah)
// ---------------------------------------------------------------------------

describe('V2/V5 pariteta besednjaka (kontrakt sync blok ↔ /api/sync shema)', () => {
  it('ISTI metadata objekt veljaven v OBEH svetovih — stropi 128/64/int ≥ 0 = ENA resnica o mejah (V5)', async () => {
    // Isti metadata, ki jih pošlje mobilni klient na /api/sync vrata ...
    const metadata = {
      mutationId: 'x'.repeat(128), // strop 128 = shema /api/sync
      baseRevision: 0, // int ≥ 0 — obe shemi
      baseUpdatedAt: 'y'.repeat(64), // strop 64 = shema /api/sync
      syncRevision: 7,
      syncState: 'synced' as const,
      tombstone: false,
    }
    const mobileId = `r282-paritet-${Date.now()}`

    // ... sprejeto na sync vratah (route schema max 128/64/int ≥ 0):
    const res = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { mutationId: metadata.mutationId, baseRevision: metadata.baseRevision, baseUpdatedAt: metadata.baseUpdatedAt, contractVersion: 1 })], 'POST'))
    const body = (await res.json()) as SyncBody
    expect(body.results[0].ok).toBe(true)
    expect(body.results[0].mutationId).toBe(metadata.mutationId)

    // ... in isto resnico sprejme kontraktni sync blok (isti stropi — V5).
    const payload = {
      contractVersion: 1,
      appVersion: 'BalkonAR 0.9.2',
      projectId: 'proj-r282-pariteta',
      sessionId: 'sess-r282-pariteta',
      source: 'ARCORE_DEPTH' as const,
      units: 'mm' as const,
      coordinateFrame: { type: 'LOCAL_NORMALIZED' as const },
      sync: { ...metadata, mutationId: metadata.mutationId, deviceId: 'r282-dev-paritet' },
      segments: [{ segmentId: 'seg-r282', lengthMm: 3200, source: 'ARCORE_DEPTH' as const }],
    }
    const parsed = parseArSessionPayload(payload)
    expect(parsed.sync?.mutationId).toBe(metadata.mutationId)
    expect(parsed.sync?.baseRevision).toBe(0)
    expect(parsed.sync?.baseUpdatedAt).toBe(metadata.baseUpdatedAt)
  })

  it('baseRevision 0 veljaven na OBEH vratah (R148 vzorec = V2 kanon — nič vzporednih mej)', async () => {
    // Kontrakt: 0 = veljavna revizija (r281 test ×5).
    const kontraktPayload = {
      contractVersion: 1,
      appVersion: 'BalkonAR 0.9.2',
      projectId: 'proj-r282-zero',
      sessionId: 'sess-r282-zero',
      source: 'MANUAL' as const,
      units: 'mm' as const,
      coordinateFrame: { type: 'LOCAL_NORMALIZED' as const },
      sync: { syncState: 'pending' as const, baseRevision: 0, syncRevision: 0 },
      segments: [{ segmentId: 'seg-r282-zero', lengthMm: 3000, source: 'MANUAL' as const }],
    }
    expect(parseArSessionPayload(kontraktPayload).sync?.baseRevision).toBe(0)

    // Sync vrata: update z baseRevision 0 na projektu z revizijo 0? Ne —
    // projekt ZAVEK nosi revizijo ≥ 1 (created = 1); 0 proti 1 = KONFLIKT
    // (r148 kanon 'zastarel baseRevision → konflikt') — dokaz, da STA
    // meji ISTI (≥ 0 sprejeto kot tip, semantiko konflikta nosi strežnik).
    const mobileId = `r282-zero-${Date.now()}`
    await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId)], 'POST'))
    const res = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { baseRevision: 0, extraNotes: 'x' })], 'POST'))
    const body = (await res.json()) as SyncBody
    expect(body.results[0].action).toBe('conflict')
  })
})
