// ---------------------------------------------------------------------------
// R153 — testi (§19: perzistenten status meritve + revizijska sled).
// ---------------------------------------------------------------------------
//   • PATCH /api/measurements/[id]: sprememba statusa je PERZISTENTNA
//     (stolpec status/statusNote/statusUpdatedAt) + revizijski zapis
//     MEASUREMENT_STATUS (oldValue {status} → newValue {status, note}).
//   • Fail-closed pravila: ponovno odprtje arhiva ZAHTEVA opombo (≥ 3 znaki,
//     400 brez nje); isti status = idempotenten 200 changed:false BREZ novega
//     revizijskega zapisa; neznana meritev → 404; neveljaven status → 400;
//     SKLADISCE (samo bere) → 403; anon → 401.
//   • GET /api/measurements po PATCH vrne nov status (hidracija UI).
//   • POST /api/measurements ustvari vrstico s privzetim OSNUTEK (migracijski
//     backfill je iskren: nič izmišljene zgodovine statusov).
//
// Handlerji direktno, baza roksal_test prek globalSetup (vzorec R128/R139/R140).
// Brez AI pri odločitvah; unikatni e-naslovi/ime izključno za izolacijo.
import { describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import { POST as measurementsPost, GET as measurementsGet } from '@/app/api/measurements/route'
import { PATCH as measurementPatch } from '@/app/api/measurements/[id]/route'

const BASE = 'http://localhost/api'

function jsonReq(
  path: string,
  token: string | null,
  init: { method?: string; body?: unknown } = {},
): Request {
  return new Request(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
}

function patchReq(id: string, token: string | null, body: unknown): Request {
  return jsonReq(`/measurements/${id}`, token, { method: 'PATCH', body })
}

/** Next 16 [id] ruta: handler potrebuje TUDI context ({ params: Promise }). */
function callPatch(id: string, token: string | null, body: unknown): Promise<Response> {
  return measurementPatch(patchReq(id, token, body), {
    params: Promise.resolve({ id }),
  }) as unknown as Promise<Response>
}

/** Stranka + projekt + meritev (vzorec R140 — unikatno za izolacijo). */
async function makeMeasurement(
  tag: string,
  vloga: 'ADMIN' | 'VODJA' | 'MONTER' = 'VODJA'
): Promise<{ measurementId: string; projectId: string; token: string }> {
  const { token } = await createTestUserWithSession(`r153-${tag}-${Date.now()}`, vloga)
  const customer = await db.customer.create({
    data: { ime: `Stranka ${tag}`, naslov: 'Test 1' },
  })
  const project = await db.project.create({
    data: { customerId: customer.id, nazivProjekta: `Projekt ${tag}` },
  })
  const post = await measurementsPost(
    jsonReq('/measurements', token, {
      method: 'POST',
      body: { projectId: project.id, dolzinaMm: 3000, visinaMm: 1200 },
    })
  )
  expect(post.status).toBe(201)
  const created = (await post.json()) as { id: string; status?: string }
  return { measurementId: created.id, projectId: project.id, token }
}

describe('R153 — PATCH /api/measurements/[id]: perzistenten status', () => {
  it('anon PATCH → 401 (fail-closed vrata)', async () => {
    const res = await callPatch('neobstaja', null, { status: 'POTRJENA' })
    expect(res.status).toBe(401)
  })

  it('OSNUTEK → POTRJENA: 200 changed:true, status perzistenten, revizijski zapis MEASUREMENT_STATUS', async () => {
    const { measurementId, projectId, token } = await makeMeasurement('status-ok')
    const res = await callPatch(measurementId, token, { status: 'POTRJENA' })
    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      changed: boolean
      measurement: { id: string; status: string; statusUpdatedAt: string | null; statusNote: string | null }
    }
    expect(data.changed).toBe(true)
    expect(data.measurement.status).toBe('POTRJENA')
    expect(data.measurement.statusUpdatedAt).not.toBeNull()

    // Perzistentnost: baza deklarativno preverjena (ne samo odgovor).
    const row = await db.measurement.findUnique({ where: { id: measurementId } })
    expect(row?.status).toBe('POTRJENA')
    expect(row?.statusUpdatedAt).not.toBeNull()

    // Revizijska sled: NATANKO en zapis MEASUREMENT_STATUS z old/new vrednostjo.
    const audits = await db.auditLog.findMany({
      where: { projectId, akcija: 'MEASUREMENT_STATUS' },
      orderBy: { timestamp: 'asc' },
    })
    expect(audits).toHaveLength(1)
    expect(JSON.parse(audits[0].oldValue ?? '{}')).toEqual({ status: 'OSNUTEK' })
    const newValue = JSON.parse(audits[0].newValue ?? '{}') as {
      status: string
      note: string | null
    }
    expect(newValue.status).toBe('POTRJENA')
    expect(newValue.note).toBeNull()
  })

  it('isti status dvakrat → drugi klic changed:false, BREZ novega revizijskega zapisa (idempotenca)', async () => {
    const { measurementId, projectId, token } = await makeMeasurement('status-idem')
    const first = await callPatch(measurementId, token, { status: 'POTRJENA' })
    expect(first.status).toBe(200)
    const second = await callPatch(measurementId, token, { status: 'POTRJENA' })
    expect(second.status).toBe(200)
    const secondData = (await second.json()) as { changed: boolean }
    expect(secondData.changed).toBe(false)
    const audits = await db.auditLog.findMany({
      where: { projectId, akcija: 'MEASUREMENT_STATUS' },
    })
    expect(audits).toHaveLength(1)
  })

  it('ponovno odprtje arhiva brez opombe → 400 z izrecnim razlogom (fail-closed)', async () => {
    const { measurementId, projectId, token } = await makeMeasurement('status-reopen')
    await callPatch(measurementId, token, { status: 'POTRJENA' })
    await callPatch(measurementId, token, { status: 'ARHIVIRANA' })

    const noNote = await callPatch(measurementId, token, { status: 'OSNUTEK' })
    expect(noNote.status).toBe(400)
    const noNoteBody = (await noNote.json()) as { error?: string }
    expect(noNoteBody.error).toContain('opombo')

    const shortNote = await callPatch(
      measurementId, token, { status: 'OSNUTEK', note: 'ab' }
    )
    expect(shortNote.status).toBe(400)

    // Baza NESPREMENJENA — zavrnitev je resnična, ne kozmetična.
    const row = await db.measurement.findUnique({ where: { id: measurementId } })
    expect(row?.status).toBe('ARHIVIRANA')

    // Z opombo → 200 in revizijski zapis nosi razlog.
    const withNote = await callPatch(
      measurementId, token, { status: 'OSNUTEK', note: 'napačno arhivirana' }
    )
    expect(withNote.status).toBe(200)
    const audits = await db.auditLog.findMany({
      where: { projectId, akcija: 'MEASUREMENT_STATUS' },
      orderBy: { timestamp: 'asc' },
    })
    expect(audits).toHaveLength(3)
    const last = JSON.parse(audits[2].newValue ?? '{}') as { note: string | null }
    expect(last.note).toBe('napačno arhivirana')
  })

  it('neznana meritev → 404; neveljaven status → 400 z zod napakami', async () => {
    const { token } = await makeMeasurement('status-404')
    const missing = await callPatch(
      'r153-ne-obstaja', token, { status: 'POTRJENA' }
    )
    expect(missing.status).toBe(404)

    const { measurementId } = await makeMeasurement('status-bad')
    const bad = await callPatch(measurementId, token, { status: 'IZBRISANA' })
    expect(bad.status).toBe(400)
    const badBody = (await bad.json()) as { error?: string; details?: unknown }
    expect(badBody.error).toBe('Neveljavni podatki')
    expect(badBody.details).toBeDefined()
  })

  it('SKLADISCE (samo bere) → 403 na tujem projektu (access matrika)', async () => {
    const { measurementId } = await makeMeasurement('status-403')
    const { token: skladisceToken } = await createTestUserWithSession(
      `r153-skladisce-${Date.now()}`,
      'SKLADISCE'
    )
    const res = await callPatch(measurementId, skladisceToken, { status: 'POTRJENA' })
    expect(res.status).toBe(403)
  })

  it('GET po PATCH vrne nov status (hidracija UI) in POST ustvari OSNUTEK (iskren backfill)', async () => {
    const { measurementId, projectId, token } = await makeMeasurement('status-get')
    await callPatch(measurementId, token, { status: 'POTRJENA' })
    const get = await measurementsGet(
      jsonReq(`/measurements?projectId=${projectId}`, token)
    )
    expect(get.status).toBe(200)
    const list = (await get.json()) as Array<{ id: string; status: string }>
    const target = list.find((m) => m.id === measurementId)
    expect(target?.status).toBe('POTRJENA')
  })
})
