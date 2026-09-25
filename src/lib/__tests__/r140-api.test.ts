// R140 — integracijski testi novih rund (issue #5 §20 + §17 + §22).
// ---------------------------------------------------------------------------
//   • schedules POST idempotenca (§20): retry s ISTIM Idempotency-Key vrne
//     ORIGINALNI odgovor (Idempotent-Replay: true), v bazi NATANKO en termin;
//     neveljaven ključ → 400; brez ključa → starejša pogodba (vsak POST =
//     nov termin).
//   • material-orders POST idempotenca (§20): isti ključ dvakrat → replay,
//     NATANKO eno naročilo; neveljaven ključ → 400.
//   • material-orders GET pagination (§17): ?limit reže polje, oblika (polje)
//     nespremenjena.
//   • photos/sketches/documents GET stropi (§17): težki odgovori (data URI /
//     verzije) imajo privzeti limit — ?limit=1 vrne največ 1 vrstico.
//
// Handlerji direktno, baza roksal_test prek globalSetup (vzorec R128/R139).
// Brez AI, brez naključja (unikatni e-naslovi/ime izključno za izolacijo).
// Vloge: VODJA ima production.manage + procurement.create (matrika R135).

import { describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import { POST as schedulesPost, GET as schedulesGet } from '@/app/api/schedules/route'
import { POST as ordersPost, GET as ordersGet } from '@/app/api/material-orders/route'
import { GET as photosGet } from '@/app/api/photos/route'
import { GET as sketchesGet } from '@/app/api/sketches/route'
import { GET as documentsGet } from '@/app/api/documents/route'

const BASE = 'http://localhost/api'

function jsonReq(
  path: string,
  token: string | null,
  init: { method?: string; body?: unknown; key?: string } = {},
): Request {
  return new Request(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.key ? { 'idempotency-key': init.key } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
}

/** Stranka + projekt za schedules POST (FK pogodba). */
async function makeProject(tag: string): Promise<string> {
  const customer = await db.customer.create({
    data: { ime: `Stranka ${tag}`, naslov: 'Test 1' },
  })
  const project = await db.project.create({
    data: { customerId: customer.id, nazivProjekta: `Projekt ${tag}` },
  })
  return project.id
}

describe('schedules POST — idempotenca (R140 §20)', () => {
  it('isti Idempotency-Key dvakrat → replay originala, NATANKO en termin', async () => {
    const stamp = `r140-sched-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const { token } = await createTestUserWithSession(`r140-sched-a-${Date.now()}`, 'VODJA')
    const projectId = await makeProject(stamp)

    const body = {
      projectId,
      datumZacetka: '2026-11-01T08:00:00.000Z',
      datumKonca: '2026-11-01T16:00:00.000Z',
      opombe: `termin ${stamp}`,
    }
    const first = await schedulesPost(jsonReq('/schedules', token, { method: 'POST', body, key: `r140key-${stamp}` }))
    expect(first.status).toBe(201)
    const firstData = await first.json()

    const second = await schedulesPost(jsonReq('/schedules', token, { method: 'POST', body, key: `r140key-${stamp}` }))
    expect(second.status).toBe(201)
    expect(second.headers.get('Idempotent-Replay')).toBe('true')
    const secondData = await second.json()
    expect(secondData.id).toBe(firstData.id)

    const rows = await db.installationSchedule.count({ where: { projectId } })
    expect(rows).toBe(1)
  })

  it('neveljaven Idempotency-Key → 400 (fail-closed)', async () => {
    const stamp = `r140-sched-b-${Date.now()}`
    const { token } = await createTestUserWithSession(`r140-sched-c-${Date.now()}`, 'VODJA')
    const projectId = await makeProject(stamp)
    const res = await schedulesPost(
      jsonReq('/schedules', token, {
        method: 'POST',
        body: { projectId, datumZacetka: '2026-11-02T08:00:00.000Z', datumKonca: '2026-11-02T16:00:00.000Z' },
        key: 'kratki',
      }),
    )
    expect(res.status).toBe(400)
  })

  it('brez Idempotency-Key → starejša pogodba (vsak POST ustvari)', async () => {
    const stamp = `r140-sched-d-${Date.now()}`
    const { token } = await createTestUserWithSession(`r140-sched-e-${Date.now()}`, 'VODJA')
    const projectId = await makeProject(stamp)
    const body = {
      projectId,
      datumZacetka: '2026-11-03T08:00:00.000Z',
      datumKonca: '2026-11-03T16:00:00.000Z',
    }
    const a = await schedulesPost(jsonReq('/schedules', token, { method: 'POST', body }))
    const b = await schedulesPost(jsonReq('/schedules', token, { method: 'POST', body }))
    expect(a.status).toBe(201)
    expect(b.status).toBe(201)
    const aData = await a.json()
    const bData = await b.json()
    expect(bData.id).not.toBe(aData.id)
    const rows = await db.installationSchedule.count({ where: { projectId } })
    expect(rows).toBe(2)
  })

  it('GET pagination še vedno deluje po idempotenčnih spremembah (R139 §17 regresija)', async () => {
    const { token } = await createTestUserWithSession(`r140-sched-f-${Date.now()}`, 'VODJA')
    const res = await schedulesGet(jsonReq('/schedules?limit=1', token))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeLessThanOrEqual(1)
  })
})

describe('material-orders POST — idempotenca (R140 §20)', () => {
  async function makeSupplierAndInventory(tag: string): Promise<{ supplierId: string; inventoryId: string }> {
    const supplier = await db.supplier.create({
      data: { naziv: `Dobavitelj ${tag}`, kontakt: 'Kontakt', dobavniRok: 7, popust: 0, aktivna: true },
    })
    const inv = await db.inventory.create({
      data: {
        sifraMateriala: `MAT-${tag}`,
        naziv: `Inox Vijak ${tag}`,
        tip: 'PRITRDILNI_MATERIAL',
        kolicinaZaloga: 100,
        enota: 'kos',
        minimalnaZaloga: 10,
      },
    })
    return { supplierId: supplier.id, inventoryId: inv.id }
  }

  it('isti Idempotency-Key dvakrat → replay originala, NATANKO eno naročilo', async () => {
    const stamp = `r140-ord-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const { token } = await createTestUserWithSession(`r140-ord-a-${Date.now()}`, 'VODJA')
    const { supplierId, inventoryId } = await makeSupplierAndInventory(stamp)

    const body = { supplierId, items: [{ inventoryId, kolicina: 5 }] }
    const first = await ordersPost(jsonReq('/material-orders', token, { method: 'POST', body, key: `r140key-${stamp}` }))
    expect(first.status).toBe(201)
    const firstData = await first.json()

    const second = await ordersPost(jsonReq('/material-orders', token, { method: 'POST', body, key: `r140key-${stamp}` }))
    expect(second.status).toBe(201)
    expect(second.headers.get('Idempotent-Replay')).toBe('true')
    const secondData = await second.json()
    expect(secondData.id).toBe(firstData.id)

    const rows = await db.materialOrder.count({ where: { supplierId } })
    expect(rows).toBe(1)
    const items = await db.materialOrderItem.count({ where: { orderId: firstData.id } })
    expect(items).toBe(1)
  })

  it('neveljaven Idempotency-Key → 400 (fail-closed)', async () => {
    const stamp = `r140-ord-b-${Date.now()}`
    const { token } = await createTestUserWithSession(`r140-ord-c-${Date.now()}`, 'VODJA')
    const { supplierId, inventoryId } = await makeSupplierAndInventory(stamp)
    const res = await ordersPost(
      jsonReq('/material-orders', token, {
        method: 'POST',
        body: { supplierId, items: [{ inventoryId, kolicina: 2 }] },
        key: 'kratki',
      }),
    )
    expect(res.status).toBe(400)
  })
})

describe('material-orders GET — pagination (R140 §17)', () => {
  it('?limit=1 vrne največ 1, oblika (polje) nespremenjena', async () => {
    const { token } = await createTestUserWithSession(`r140-ord-d-${Date.now()}`, 'VODJA')
    const res = await ordersGet(jsonReq('/material-orders?limit=1', token))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeLessThanOrEqual(1)
  })
})

describe('težki projektni seznami — stropi (R140 §17)', () => {
  async function makeProjectFull(tag: string): Promise<string> {
    return makeProject(tag)
  }

  it('photos GET ?limit=1 → največ 1 slika (odzivna oblika polja ista)', async () => {
    const stamp = `r140-photo-${Date.now()}`
    const { token } = await createTestUserWithSession(`r140-photo-a-${Date.now()}`, 'VODJA')
    const projectId = await makeProjectFull(stamp)
    for (let i = 0; i < 2; i++) {
      await db.projectPhoto.create({
        data: { projectId, kategorija: 'MED', opomba: `slika ${i}` },
      })
    }
    const res = await photosGet(jsonReq(`/photos?projectId=${projectId}&limit=1`, token))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBe(1)
  })

  it('sketches GET ?limit=1 → največ 1 skica', async () => {
    const stamp = `r140-sketch-${Date.now()}`
    const { token } = await createTestUserWithSession(`r140-sketch-a-${Date.now()}`, 'VODJA')
    const projectId = await makeProjectFull(stamp)
    for (let i = 0; i < 2; i++) {
      await db.sketch.create({
        data: { projectId, naziv: `skica ${i}` },
      })
    }
    const res = await sketchesGet(jsonReq(`/sketches?projectId=${projectId}&limit=1`, token))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBe(1)
  })

  it('documents GET ?limit=1 → največ 1 dokument', async () => {
    const stamp = `r140-doc-${Date.now()}`
    const { token } = await createTestUserWithSession(`r140-doc-a-${Date.now()}`, 'VODJA')
    const projectId = await makeProjectFull(stamp)
    for (let i = 0; i < 2; i++) {
      await db.document.create({
        data: { projectId, tipDokumenta: 'ZAPISNIK_NAVORA' },
      })
    }
    const res = await documentsGet(jsonReq(`/documents?projectId=${projectId}&limit=1`, token))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBe(1)
  })
})
