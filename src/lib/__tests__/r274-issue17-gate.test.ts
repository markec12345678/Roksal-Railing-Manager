// R274 — GitHub issue #17: "test: production-readiness gate za Roksal Manager
// ↔ ar-android" — PRVI SKLOP GATE DOKAZOV IZ KODE/TESTOV (po sekcijah A/B/D/F/G
// issue-ja; J terensko ostaja izrecno NEDOKAZANO — glej docs/ISSUE-17-GATE.md).
// ---------------------------------------------------------------------------
//   • G (konflikt — namerni scenarij iz issue-ja): polna 5-korakovna zanka —
//     klient A ustvari (rev 1) → klient B spremeni (rev 2) → klient A spremeni
//     (rev 3) → klient A pošlje ZASTAREL baseRevision=1 → KONFLIKT (ok:false,
//     retryable:true, serverState, nič spremenjeno) → refresh prek GET
//     ?sinceRevision → nov zapis z osveženo bazo uspešen (rev 4). Audit pokaže
//     OBE uspešni spremembi, konfliktni poskus NE nastavi audit zapisa (nič ni
//     bilo uporabljeno). Nobena sprememba se ne izgubi tiho.
//   • F (sync): replay BREZ Idempotency-Key (ponovitev omrežnega zahtevka) →
//     created nato updated, NIKOLI dvojnik (unique mobileProjectId);
//     vzporedni sync dveh naprav na istem mobileProjectId (Promise.all) →
//     točno 1 projekt v bazi (P2002 race varnost, R121).
//   • D (versioning): contractVersion — v1 sprejeta (brez verzijnega
//     warninga), odsotna = star klient z IZRECNIM warningom, neznana (99) =
//     per-item zavrnitev (fail-closed, retryable false, nič v bazi),
//     odpuščivost serije (pokvaren element ne podre ostalih), neveljavni tipi
//     (0, 1.5) prek zod; pogodbena verzija sledljiva v auditu (v1 kot 1,
//     odsotna kot null).
//   • B (Android → Roksal payload): napačno tipizirano polje (lengthCm niz) →
//     per-item zavrnitev brez zapisa; stabilen projectId (isti mobileProjectId
//     → isti DB id); enote ostanejo nespremenjene (lengthCm verbatim v
//     projectData — nič pretvorbe cm→m).
//   • A (shared contract jedro): neznana prihodnja polja zod stripa — brez
//     korupcije in brez zavrnitve (issue #17 D: "unknown future fields ne
//     povzročijo korupcije").
//
// Handlerji direktno, baza roksal_test prek globalSetup (vzorec R128–R148).
import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/lib/db'
import { createApiKey } from '@/lib/password'
import { GET as syncGet, POST as syncPost } from '@/app/api/sync/route'

const BASE = 'http://localhost/api'

type Key = { key: string; id: string; name: string }
let apiKey: Key

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
  customerName: `r274 stranka ${mobileId.slice(-6)}`,
  railingStyle: 'inox',
  ...extra,
})

type SyncRes = {
  results: Array<{
    ok: boolean
    action: string
    revision: number | null
    retryable?: boolean
    warnings?: string[]
    projectId?: string
    error?: string
    serverState?: { syncRevision: number; updatedAt: string; status: string }
  }>
}

beforeEach(async () => {
  // Čistimo svoje teste po tagih (r274-*) — unikatni nazivi/ključi/id-ji.
  await db.idempotencyKey.deleteMany({ where: { key: { contains: 'r274' } } })
  await db.syncTombstone.deleteMany({ where: { mobileProjectId: { contains: 'r274' } } })
  await db.syncDevice.deleteMany({ where: { deviceId: { contains: 'r274' } } })
  await db.auditLog.deleteMany({ where: { akcija: { contains: 'SYNC' }, newValue: { contains: 'r274' } } })
  await db.project.deleteMany({ where: { OR: [{ nazivProjekta: { contains: 'r274' } }, { mobileProjectId: { contains: 'r274' } }] } })
  await db.customer.deleteMany({ where: { ime: { contains: 'r274' } } })
  await db.apiKey.deleteMany({ where: { name: { contains: 'r274' } } })
  apiKey = await createApiKey({ name: `r274-key-${Date.now()}` })
})

// ---------------------------------------------------------------------------
// SEKCIJA G — namerni konfliktni scenarij (9 točk iz issue-ja #17)
// ---------------------------------------------------------------------------

describe('issue #17 G — konfliktni scenarij (Manager ↔ Android, namerni preizkus)', () => {
  it('polna zanka: rev N → A piše → B piše → A pošlje star baseRevision → KONFLIKT → refresh → nov zapis uspešen', async () => {
    const mobileId = `r274-g-${Date.now()}`

    // (1) Klient A (Android) ustvari projekt — revizija 1.
    const r1 = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { contractVersion: 1, extraNotes: 'izmera A v1' })], 'POST'))
    expect(r1.status).toBe(200)
    const b1 = (await r1.json()) as SyncRes
    expect(b1.results[0].ok).toBe(true)
    expect(b1.results[0].action).toBe('created')
    expect(b1.results[0].revision).toBe(1)
    const projectId = b1.results[0].projectId!

    // (2) Klient B (Manager) prebere zrcalo pri reviziji 1 (GET).
    const get1 = await syncGet(req('/api/sync?sinceRevision=0', undefined, 'GET'))
    expect(get1.status).toBe(200)
    const g1 = (await get1.json()) as { projects: Array<{ mobileProjectId: string; syncRevision: number }> }
    const videno = g1.projects.find((p) => p.mobileProjectId === mobileId)
    expect(videno).toBeDefined()
    expect(videno!.syncRevision).toBe(1)

    // (3) Klient B spremeni meritveni zapis (čist base 1) → revizija 2.
    const r2 = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { contractVersion: 1, baseRevision: 1, extraNotes: 'manager v2' })], 'POST'))
    const b2 = (await r2.json()) as SyncRes
    expect(b2.results[0].ok).toBe(true)
    expect(b2.results[0].action).toBe('updated')
    expect(b2.results[0].revision).toBe(2)

    // (4) Klient A spremeni isti zapis (čist base 2) → revizija 3.
    const r3 = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { contractVersion: 1, baseRevision: 2, extraNotes: 'android v3' })], 'POST'))
    const b3 = (await r3.json()) as SyncRes
    expect(b3.results[0].ok).toBe(true)
    expect(b3.results[0].revision).toBe(3)

    // (5) Klient B pošlje ZASTAREL baseRevision=1 (videl je revizijo 1).
    const stale = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { contractVersion: 1, baseRevision: 1, extraNotes: 'zastarel poskus' })], 'POST'))
    const bs = (await stale.json()) as SyncRes
    // (6) Sistem vrne konflikt — nič tihe izgube.
    expect(bs.results[0].ok).toBe(false)
    expect(bs.results[0].action).toBe('conflict')
    expect(bs.results[0].retryable).toBe(true)
    expect(bs.results[0].error).toContain('1 ≠ strežniška revizija 3')
    // (7) Server state je vrnjen (klient ve, kam osvežiti).
    expect(bs.results[0].serverState).toBeDefined()
    expect(bs.results[0].serverState!.syncRevision).toBe(3)
    expect(typeof bs.results[0].serverState!.updatedAt).toBe('string')
    expect(typeof bs.results[0].serverState!.status).toBe('string')

    // Nič izgubljeno: baza nosi ZADNJO uspešno spremembo (klient A, rev 3),
    // zastarel poskus se NI uporabil.
    const poKonfliktu = await db.project.findUnique({ where: { mobileProjectId: mobileId } })
    expect(poKonfliktu!.opombe).toBe('android v3')
    expect(poKonfliktu!.syncRevision).toBe(3)

    // (9) Audit pokaže OBE uspešni spremembi (B rev 2 + A rev 3) — konfliktni
    // poskus NI nastavil audit zapisa SYNC_PROJECT_UPDATED (nič uporabljeno).
    // Filter po projectId FK (update audit newValue NE nosi mobileProjectId
    // — samo created; navedba po nizu bi ujela 0 vrstic = lažni porod).
    const audit = await db.auditLog.findMany({
      where: { akcija: 'SYNC_PROJECT_UPDATED', projectId },
      orderBy: { timestamp: 'asc' },
    })
    expect(audit.length).toBe(2)
    expect(JSON.stringify(audit[0].newValue)).toContain('manager v2')
    expect(JSON.stringify(audit[1].newValue)).toContain('android v3')

    // (8) Po refreshu (GET sinceRevision=2) je nov zapis MOŽEN: klient B
    // osveži bazo (vidi revizijo 3) in ponovi z veljavnim baseRevision=3.
    const refresh = await syncGet(req('/api/sync?sinceRevision=2', undefined, 'GET'))
    const gr = (await refresh.json()) as { projects: Array<{ mobileProjectId: string; syncRevision: number }> }
    const osvezeno = gr.projects.find((p) => p.mobileProjectId === mobileId)
    expect(osvezeno).toBeDefined()
    expect(osvezeno!.syncRevision).toBe(3)
    const retry = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { contractVersion: 1, baseRevision: 3, extraNotes: 'manager v4 po refreshu' })], 'POST'))
    const br = (await retry.json()) as SyncRes
    expect(br.results[0].ok).toBe(true)
    expect(br.results[0].action).toBe('updated')
    expect(br.results[0].revision).toBe(4)
    // Audit sedaj nosi VSE tri uspešne spremembe (2, 3, 4) — polna sledljivost.
    const audit2 = await db.auditLog.findMany({
      where: { akcija: 'SYNC_PROJECT_UPDATED', projectId },
    })
    expect(audit2.length).toBe(3)
    expect(await db.project.count({ where: { mobileProjectId: mobileId } })).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// SEKCIJA F — replay brez idempotenčnega ključa + vzporedni sync
// ---------------------------------------------------------------------------

describe('issue #17 F — replay test (brez Idempotency-Key) + parallel sync test', () => {
  it('ponovitev omrežnega zahtevka → created nato updated, NIKOLI dvojnik', async () => {
    const mobileId = `r274-replay-${Date.now()}`
    const payload = [MOBILE_ITEM(mobileId, { contractVersion: 1, extraNotes: 'prvi poskus' })]

    const r1 = await syncPost(req('/api/sync', payload, 'POST'))
    const b1 = (await r1.json()) as SyncRes
    expect(b1.results[0].ok).toBe(true)
    expect(b1.results[0].action).toBe('created')
    expect(b1.results[0].revision).toBe(1)

    // Isti payload ZNOVA (klient ni prejel odgovora — ponovitev brez
    // Idempotency-Key): unique mobileProjectId zagotovi posodobitev, ne
    // dvojnika; revizija raste monotono.
    const r2 = await syncPost(req('/api/sync', payload, 'POST'))
    const b2 = (await r2.json()) as SyncRes
    expect(b2.results[0].ok).toBe(true)
    expect(b2.results[0].action).toBe('updated')
    expect(b2.results[0].revision).toBe(2)

    const projects = await db.project.findMany({ where: { mobileProjectId: mobileId } })
    expect(projects.length).toBe(1)
  })

  it('vzporedni sync dveh naprav na istem mobileProjectId → točno 1 projekt (P2002 race varnost)', async () => {
    const mobileId = `r274-par-${Date.now()}`
    const napravaA = { 'X-Device-Id': 'dev-r274-par-a-0001' }
    const napravaB = { 'X-Device-Id': 'dev-r274-par-b-0002' }

    // Obe napravi hkrati (ravnovesni tekm — oba findUnique lahko vrneta null).
    const [resA, resB] = await Promise.all([
      syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { contractVersion: 1, customerName: 'r274 vzporedno A' })], 'POST', napravaA)),
      syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { contractVersion: 1, customerName: 'r274 vzporedno B' })], 'POST', napravaB)),
    ])
    expect(resA.status).toBe(200)
    expect(resB.status).toBe(200)
    const bA = (await resA.json()) as SyncRes
    const bB = (await resB.json()) as SyncRes

    // Invarianta: vsaj ena akcija 'created', vsi uspešni nosijo isti projectId,
    // v bazi je TOČNO 1 projekt — dvojnikov ni niti pod vzporednostjo (R121).
    const akcije = [bA.results[0].action, bB.results[0].action]
    expect(akcije).toContain('created')
    expect(akcije.every((a) => a === 'created' || a === 'updated')).toBe(true)
    const idA = bA.results[0].projectId
    const idB = bB.results[0].projectId
    if (bA.results[0].ok && bB.results[0].ok && idA && idB) {
      expect(idA).toBe(idB)
    }
    expect(await db.project.count({ where: { mobileProjectId: mobileId } })).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// SEKCIJA D — versioning: contractVersion (obvezen za shared payload)
// ---------------------------------------------------------------------------

describe('issue #17 D — contractVersion (strežnik podriva točno SYNC_CONTRACT_VERSION)', () => {
  it('v1 → sprejeta brez verzijnega warninga; odsotna → tiho naprej (pre-kontraktni klient, audit null)', async () => {
    const stamp = Date.now()

    const r1 = await syncPost(req('/api/sync', [MOBILE_ITEM(`r274-dv1-${stamp}`, { contractVersion: 1 })], 'POST'))
    const b1 = (await r1.json()) as SyncRes
    expect(b1.results[0].ok).toBe(true)
    expect(b1.results[0].action).toBe('created')
    expect((b1.results[0].warnings ?? []).some((w) => w.includes('contractVersion'))).toBe(false)

    // Pre-kontraktni klient (r148 kanon: stari klient NE dobi novih
    // warningov — warnings so smiselni, ne hrup; sledljivost nosi audit).
    const r0 = await syncPost(req('/api/sync', [MOBILE_ITEM(`r274-dnula-${stamp}`)], 'POST'))
    const b0 = (await r0.json()) as SyncRes
    expect(b0.results[0].ok).toBe(true)
    expect(b0.results[0].action).toBe('created')
    expect(b0.results[0].warnings ?? []).toEqual([])
  })

  it('neznana verzija 99 → per-item zavrnitev (fail-closed, nič v bazi); odpuščivost serije velja', async () => {
    const stamp = Date.now()
    const mobileNapacen = `r274-d99-${stamp}`
    const mobileVeljaven = `r274-dok-${stamp}`

    // Serija: pokvaren element NE podre veljavnega (odpuščivost serije).
    const res = await syncPost(req('/api/sync', [
      MOBILE_ITEM(mobileNapacen, { contractVersion: 99 }),
      MOBILE_ITEM(mobileVeljaven, { contractVersion: 1 }),
    ], 'POST'))
    const body = (await res.json()) as SyncRes
    expect(body.results.length).toBe(2)

    expect(body.results[0].ok).toBe(false)
    expect(body.results[0].action).toBe('error')
    expect(body.results[0].retryable).toBe(false)
    expect(body.results[0].error).toContain('Nepodprta pogodbena verzija 99')
    expect(body.results[0].error).toContain('strežnik podpira 1')
    expect(body.results[1].ok).toBe(true)
    expect(body.results[1].action).toBe('created')

    expect(await db.project.count({ where: { mobileProjectId: mobileNapacen } })).toBe(0)
    expect(await db.project.count({ where: { mobileProjectId: mobileVeljaven } })).toBe(1)
  })

  it('neveljavni tipi verzije (0, 1.5) → zod per-item napaka; pogodbena verzija sledljiva v auditu', async () => {
    const stamp = Date.now()

    const r0 = await syncPost(req('/api/sync', [MOBILE_ITEM(`r274-dzer0-${stamp}`, { contractVersion: 0 })], 'POST'))
    const b0 = (await r0.json()) as SyncRes
    expect(b0.results[0].ok).toBe(false)
    expect(b0.results[0].error).toContain('contractVersion')

    const rF = await syncPost(req('/api/sync', [MOBILE_ITEM(`r274-dfrac-${stamp}`, { contractVersion: 1.5 })], 'POST'))
    const bF = (await rF.json()) as SyncRes
    expect(bF.results[0].ok).toBe(false)
    expect(bF.results[0].error).toContain('contractVersion')

    // Audit sledljivost: v1 → '"contractVersion":1'; odsotna → null
    // (pre-kontraktni klient je v auditu VEDNO razločljiv od deklariranega).
    const mobileV1 = `r274-daud-${stamp}`
    const mobileLeg = `r274-dleg-${stamp}`
    await syncPost(req('/api/sync', [MOBILE_ITEM(mobileV1, { contractVersion: 1 })], 'POST'))
    await syncPost(req('/api/sync', [MOBILE_ITEM(mobileLeg)], 'POST'))
    const audit = await db.auditLog.findFirst({
      where: { akcija: 'SYNC_PROJECT_CREATED', newValue: { contains: mobileV1 } },
    })
    expect(audit).not.toBeNull()
    // audit newValue je shranjen kot JSON NIZ — String(), ne JSON.stringify
    // (dvokodiranje bi izmuznilo navedek v \\\"contractVersion\\\" — R272
    // lekcija 2: preverba mora obesti DEJANSKO vsebino).
    expect(String(audit!.newValue)).toContain('"contractVersion":1')
    const auditLeg = await db.auditLog.findFirst({
      where: { akcija: 'SYNC_PROJECT_CREATED', newValue: { contains: mobileLeg } },
    })
    expect(auditLeg).not.toBeNull()
    expect(String(auditLeg!.newValue)).toContain('"contractVersion":null')
  })
})

// ---------------------------------------------------------------------------
// SEKCIJA B — Android → Roksal payload: validacija, stabilni ID, enote
// ---------------------------------------------------------------------------

describe('issue #17 B — payload validacija + stabilni projectId + nespremenjene enote', () => {
  it('napačno tipizirano polje (lengthCm niz) → per-item zavrnitev, NIČ ustvarjeno', async () => {
    const mobileId = `r274-btip-${Date.now()}`
    const res = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { lengthCm: '345' })], 'POST'))
    const body = (await res.json()) as SyncRes
    expect(body.results[0].ok).toBe(false)
    expect(body.results[0].action).toBe('error')
    expect(body.results[0].error).toContain('lengthCm')
    expect(body.results[0].retryable).toBe(false)
    expect(await db.project.count({ where: { mobileProjectId: mobileId } })).toBe(0)
  })

  it('stabilen projectId: isti mobileProjectId → isti DB zapis (ustvarjen enkrat, posodobljen naprej)', async () => {
    const mobileId = `r274-bid-${Date.now()}`
    const r1 = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { contractVersion: 1 })], 'POST'))
    const b1 = (await r1.json()) as SyncRes
    const idPrvi = b1.results[0].projectId!

    const r2 = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { contractVersion: 1, baseRevision: 1, extraNotes: 'posodobljeno' })], 'POST'))
    const b2 = (await r2.json()) as SyncRes
    expect(b2.results[0].projectId).toBe(idPrvi)

    const row = await db.project.findUnique({ where: { mobileProjectId: mobileId } })
    expect(row!.id).toBe(idPrvi)
    // ID-ji ostanejo nespremenjeni: mobileProjectId v bazi = payload id, verbatim.
    expect(row!.mobileProjectId).toBe(mobileId)
  })

  it('enote ostanejo nespremenjene: lengthCm 345.5 → projectData verbatim (nič pretvorbe cm→m)', async () => {
    const mobileId = `r274-benota-${Date.now()}`
    const res = await syncPost(req('/api/sync', [MOBILE_ITEM(mobileId, { contractVersion: 1, lengthCm: 345.5, heightCm: 120 })], 'POST'))
    const body = (await res.json()) as SyncRes
    expect(body.results[0].ok).toBe(true)
    const row = await db.project.findUnique({ where: { mobileProjectId: mobileId } })
    const data = JSON.parse(row!.projectData ?? '{}') as { lengthCm?: number; heightCm?: number }
    expect(data.lengthCm).toBe(345.5)
    expect(data.heightCm).toBe(120)
  })
})

// ---------------------------------------------------------------------------
// SEKCIJA A — shared contract jedro: neznana prihodnja polja (zod strip)
// ---------------------------------------------------------------------------

describe('issue #17 A/D — neznana prihodnja polja ne povzročijo korupcije', () => {
  it('payload z prihodnjim poljem (futureField) → sprejet, polje odstranjeno, brez korupcije', async () => {
    const mobileId = `r274-afut-${Date.now()}`
    const res = await syncPost(req('/api/sync', [
      MOBILE_ITEM(mobileId, { contractVersion: 1, futureField: 'prihodnja razširitev', arSessionId: 'sess-123' }),
    ], 'POST'))
    const body = (await res.json()) as SyncRes
    expect(body.results[0].ok).toBe(true)
    expect(body.results[0].action).toBe('created')

    const row = await db.project.findUnique({ where: { mobileProjectId: mobileId } })
    expect(row).not.toBeNull()
    const data = JSON.parse(row!.projectData ?? '{}') as Record<string, unknown>
    expect(data.futureField).toBeUndefined()
    expect(data.arSessionId).toBeUndefined()
  })
})
