// R136 (issue #5 §18 + §19) — DB integriteta in atomske poslovne transakcije.
// ---------------------------------------------------------------------------
// §18: CHECK/EXCLUDE omejitve so ZADNJA linija obrambe — testi dokazujejo, da
//      jih PostgreSQL VSAKIC zavrne (ne le API plast).
// §19: kritične večkorake operacije so ATOMSKE — crash med koraki ne sme
//      pustiti delnega stanja (dokaz: neuspeh sredi transakcije = rollback).
//
// Determinizem: inventar/nazivi v BOM-u nosijo UNIKATEN PRVI BESEDI (brez
// presledka) — ruta s PATCH porabo namreč išče inventar z
// `naziv contains prva_beseda`; pogost prvi besed bi ujel tuj artikel iz
// testne baze (flaky + onesnaženje podatkov).
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'

const BASE = 'http://localhost'

function request(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  token: string,
  body?: Record<string, unknown>,
): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      origin: BASE,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

let counter = 0
const uniq = (p: string) => `${p}-${Date.now()}-${(counter += 1)}`
/** Unikaten NAZIV z unikatno PRVO BESEDO (za determinističen contains-match). */
const uniqNaziv = (p: string) => `${p}${Date.now()}${(counter += 1)}`

/** Temeljito čiščenje testnega inventarja (vse odvisnosti pred brisanjem). */
async function cleanupInventory(inventoryId: string) {
  await db.inventoryMovement.deleteMany({ where: { inventoryId } })
  await db.stockLedger.deleteMany({ where: { inventoryId } })
  await db.materialPrice.deleteMany({ where: { inventoryId } })
  await db.materialUsage.deleteMany({ where: { inventoryId } })
  await db.materialOrderItem.deleteMany({ where: { inventoryId } })
  await db.inventory.delete({ where: { id: inventoryId } }).catch(() => undefined)
}

describe('§18 — DB CHECK omejitve (zadnja linija obrambe)', () => {
  it('omejitve obstajajo v bazi (pregled pg_constraint)', async () => {
    const rows = await db.$queryRaw<{ conname: string; contype: string; convalidated: boolean }[]>`
      SELECT conname, contype, convalidated FROM pg_constraint
      WHERE conname IN ('inventory_stock_nonnegative','invoice_amounts_nonnegative',
        'invoice_status_allowed','invoice_tip_allowed','order_item_quantity_positive',
        'order_total_nonnegative','usage_quantity_positive','price_nonnegative',
        'material_price_no_overlap')`
    const names = rows.map((r) => r.conname).sort()
    expect(names).toEqual([
      'inventory_stock_nonnegative',
      'invoice_amounts_nonnegative',
      'invoice_status_allowed',
      'invoice_tip_allowed',
      'material_price_no_overlap',
      'order_item_quantity_positive',
      'order_total_nonnegative',
      'price_nonnegative',
      'usage_quantity_positive',
    ].sort())
    // CHECK grejo z NOT VALID (zaščita novih zapisov brez tveganja deploja);
    // EXCLUDE pa je takoj validated.
    const excl = rows.find((r) => r.conname === 'material_price_no_overlap')
    expect(excl!.contype).toBe('x')
    expect(excl!.convalidated).toBe(true)
  })

  it('Inventory: negativna zaloga → zavrnjena (CHECK inventory_stock_nonnegative)', async () => {
    const sifra = uniq('R136TEST')
    const item = await db.inventory.create({
      data: { sifraMateriala: sifra, naziv: uniqNaziv('R136TestArtikel'), tip: 'WPC_deska', kolicinaZaloga: 10, enota: 'kos' },
    })
    await expect(
      db.inventory.update({ where: { id: item.id }, data: { kolicinaZaloga: -1 } }),
    ).rejects.toThrow()
    await cleanupInventory(item.id)
  })

  it('Invoice: negativen znesek in neznan status → zavrnjena', async () => {
    const project = await db.project.create({
      data: { nazivProjekta: uniqNaziv('R136RacunTest'), customer: { create: { ime: 'R136 kupec', naslov: 'Test 1' } } },
    })
    await expect(
      db.invoice.create({
        data: {
          projectId: project.id,
          stevilka: uniq('2026-R136'),
          status: 'IZDAN',
          osnova: -10,
          ddv: -2.2,
          znesek: -12.2,
          postavke: JSON.stringify([{ opis: 'x', kolicina: 1, enota: 'kos', cenaNaEnoto: 10, ddvStopnja: 22 }]),
        },
      }),
    ).rejects.toThrow()

    await expect(
      db.invoice.create({
        data: { projectId: project.id, stevilka: uniq('2026-R136'), status: 'NEZNAN', postavke: '[]' },
      }),
    ).rejects.toThrow()

    await db.invoice.deleteMany({ where: { projectId: project.id } })
    await db.project.delete({ where: { id: project.id } })
  })

  it('MaterialOrderItem: količina 0 → zavrnjena; MaterialUsage: količina 0 → zavrnjena', async () => {
    const sifra = uniq('R136ITEM')
    const inv = await db.inventory.create({
      data: { sifraMateriala: sifra, naziv: uniqNaziv('R136ItemArtikel'), tip: 'Inox_vijak', kolicinaZaloga: 5, enota: 'kos' },
    })
    const supplier = await db.supplier.create({ data: { naziv: uniqNaziv('DobaviteljR136'), naslov: 'Test' } })
    const order = await db.materialOrder.create({
      data: { supplierId: supplier.id, status: 'OSNUTEK', skupajCena: 0 },
    })
    await expect(
      db.materialOrderItem.create({
        data: { orderId: order.id, inventoryId: inv.id, kolicina: 0, cena: 1, naziv: 'x', enota: 'kos' },
      }),
    ).rejects.toThrow()
    await db.materialOrder.delete({ where: { id: order.id } })

    const project = await db.project.create({
      data: { nazivProjekta: uniqNaziv('R136Usage'), customer: { create: { ime: 'R136 kupec 2', naslov: 'Test 2' } } },
    })
    await expect(
      db.materialUsage.create({
        data: { projectId: project.id, inventoryId: inv.id, porabljenaKolicina: 0 },
      }),
    ).rejects.toThrow()
    await db.materialUsage.deleteMany({ where: { projectId: project.id } })
    await db.project.delete({ where: { id: project.id } })
    await cleanupInventory(inv.id)
    await db.supplier.delete({ where: { id: supplier.id } }).catch(() => undefined)
  })

  it('EXCLUDE material_price_no_overlap: ista (material, dobavitelj) s prekrivanjem → zavrnjena; drug dobavitelj → OK', async () => {
    const sifra = uniq('R136PRICE')
    const inv = await db.inventory.create({
      data: { sifraMateriala: sifra, naziv: uniqNaziv('R136CenArtikel'), tip: 'Alu_profil', kolicinaZaloga: 0, enota: 'm' },
    })
    const s1 = await db.supplier.create({ data: { naziv: uniqNaziv('DobR136A'), naslov: 'A' } })
    const s2 = await db.supplier.create({ data: { naziv: uniqNaziv('DobR136B'), naslov: 'B' } })

    // odprta cena pri dobavitelju A (start eksplicitno v preteklosti → zaprtje
    // z zdaj() je vedno veljaven interval)
    await db.materialPrice.create({
      data: { inventoryId: inv.id, supplierId: s1.id, cena: 10, veljavnostOd: new Date(Date.now() - 5_000) },
    })

    // prekrivanje pri ISTEM paru → EXCLUDE zavrne
    await expect(
      db.materialPrice.create({ data: { inventoryId: inv.id, supplierId: s1.id, cena: 12 } }),
    ).rejects.toThrow()

    // isti material, DRUG dobavitelj → dovoljeno (par je (inventory, supplier))
    const ok = await db.materialPrice.create({ data: { inventoryId: inv.id, supplierId: s2.id, cena: 9 } })
    expect(ok.cena).toBe(9)

    // zaprta okna ne štejejo kot prekrivanje (nova cena začne NOVO okno)
    await db.materialPrice.updateMany({
      where: { inventoryId: inv.id, supplierId: s1.id, veljavnostDo: null },
      data: { veljavnostDo: new Date() },
    })
    const ok2 = await db.materialPrice.create({ data: { inventoryId: inv.id, supplierId: s1.id, cena: 11 } })
    expect(ok2.cena).toBe(11)

    await cleanupInventory(inv.id)
    await db.supplier.delete({ where: { id: s1.id } }).catch(() => undefined)
    await db.supplier.delete({ where: { id: s2.id } }).catch(() => undefined)
  })
})

describe('§19 — atomske poslovne transakcije', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Pomožnik: projekt z BOM draftom, ki zahteva `kolicina` enot inventarja z nazivom `naziv`.
  async function makeProjectWithBom(naziv: string, kolicina: number) {
    const project = await db.project.create({
      data: {
        nazivProjekta: uniqNaziv('R136Montaza'),
        customer: { create: { ime: uniqNaziv('KupecR136'), naslov: 'Test 3' } },
        bomDraftJson: JSON.stringify({ items: [{ naziv, kolicina }] }),
      },
    })
    return project
  }

  async function makeSchedule(projectId: string) {
    return db.installationSchedule.create({
      data: { projectId, datumZacetka: new Date('2026-10-01T08:00:00Z'), datumKonca: new Date('2026-10-01T16:00:00Z'), status: 'V_TEKU' },
    })
  }

  it('schedules PATCH ZAKLJUCENO z nezadostno zalogo → 409 in ČISTA rollback (ni delne porabe)', async () => {
    const { token } = await createTestUserWithSession(uniq('r136-adm3'), 'ADMIN')
    const schedulesRoute = await import('@/app/api/schedules/route')

    const naziv = uniqNaziv('R136WPCDeska') // prva beseda unikatna → contains zadane SAMO ta artikel
    const inv = await db.inventory.create({
      data: { sifraMateriala: uniq('R136STOCK'), naziv, tip: 'WPC_deska', kolicinaZaloga: 2, enota: 'm' },
    })
    const project = await makeProjectWithBom(naziv, 5) // potrebuje 5, na zalogi 2
    const schedule = await makeSchedule(project.id)

    const res = await schedulesRoute.PATCH(request('PATCH', '/api/schedules', token, { id: schedule.id, status: 'ZAKLJUCENO' }))
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain(naziv.slice(0, 12))

    // ATOMNOST: NIČ ni spremenjeno — termin še V_TEKU, projekt ni MONTIRANO,
    // zaloga nerazpoložena, brez premika, brez revizijskega vpisa.
    const sAfter = await db.installationSchedule.findUnique({ where: { id: schedule.id } })
    expect(sAfter!.status).toBe('V_TEKU')
    const pAfter = await db.project.findUnique({ where: { id: project.id } })
    expect(pAfter!.status).not.toBe('MONTIRANO')
    const invAfter = await db.inventory.findUnique({ where: { id: inv.id } })
    expect(invAfter!.kolicinaZaloga).toBe(2)
    const movements = await db.inventoryMovement.count({ where: { inventoryId: inv.id, projectId: project.id } })
    expect(movements).toBe(0)
    const audits = await db.auditLog.count({ where: { akcija: 'SCHEDULE_STATUS', projectId: project.id } })
    expect(audits).toBe(0)

    await db.installationSchedule.delete({ where: { id: schedule.id } })
    await db.project.delete({ where: { id: project.id } })
    await cleanupInventory(inv.id)
  })

  it('schedules PATCH ZAKLJUCENO z dovolj zaloge → 200; zaloga točno odštejeta + premik + MONTIRANO + revizija ATOMSKO', async () => {
    const { token } = await createTestUserWithSession(uniq('r136-adm4'), 'ADMIN')
    const schedulesRoute = await import('@/app/api/schedules/route')

    const naziv = uniqNaziv('R136AluProfil')
    const inv = await db.inventory.create({
      data: { sifraMateriala: uniq('R136OK'), naziv, tip: 'Alu_profil', kolicinaZaloga: 8, enota: 'm' },
    })
    const project = await makeProjectWithBom(naziv, 3)
    const schedule = await makeSchedule(project.id)

    const res = await schedulesRoute.PATCH(request('PATCH', '/api/schedules', token, { id: schedule.id, status: 'ZAKLJUCENO' }))
    expect(res.status).toBe(200)

    const invAfter = await db.inventory.findUnique({ where: { id: inv.id } })
    expect(invAfter!.kolicinaZaloga).toBe(5) // 8 − 3
    const pAfter = await db.project.findUnique({ where: { id: project.id } })
    expect(pAfter!.status).toBe('MONTIRANO')
    const movement = await db.inventoryMovement.findFirst({ where: { inventoryId: inv.id, projectId: project.id } })
    expect(movement!.kolicina).toBe(-3)
    const audit = await db.auditLog.findFirst({ where: { akcija: 'SCHEDULE_STATUS', projectId: project.id } })
    expect(audit).not.toBeNull()

    await db.installationSchedule.delete({ where: { id: schedule.id } })
    await db.project.delete({ where: { id: project.id } })
    await cleanupInventory(inv.id)
  })

  it('material-orders POST: količina 0 → 400, negativna cena → 400, neznani inventoryId → 400 (brez surovega 500)', async () => {
    const { token } = await createTestUserWithSession(uniq('r136-adm5'), 'ADMIN')
    const ordersRoute = await import('@/app/api/material-orders/route')
    const supplier = await db.supplier.create({ data: { naziv: uniqNaziv('DobR136C'), naslov: 'C' } })

    const zero = await ordersRoute.POST(request('POST', '/api/material-orders', token, {
      supplierId: supplier.id,
      items: [{ inventoryId: 'karkoli', kolicina: 0 }],
    }))
    expect(zero.status).toBe(400)

    const neg = await ordersRoute.POST(request('POST', '/api/material-orders', token, {
      supplierId: supplier.id,
      items: [{ inventoryId: 'karkoli', kolicina: 2, cena: -1 }],
    }))
    expect(neg.status).toBe(400)

    const unknown = await ordersRoute.POST(request('POST', '/api/material-orders', token, {
      supplierId: supplier.id,
      items: [{ inventoryId: 'neobstaja-r136', kolicina: 2 }],
    }))
    expect(unknown.status).toBe(400)

    await db.supplier.delete({ where: { id: supplier.id } }).catch(() => undefined)
  })

  it('material-prices POST: negativna cena → 400; veljavna cena zapre staro okno (GREATEST proti odmiku ur)', async () => {
    const { token } = await createTestUserWithSession(uniq('r136-adm6'), 'ADMIN')
    const pricesRoute = await import('@/app/api/material-prices/route')

    const res = await pricesRoute.POST(request('POST', '/api/material-prices', token, {
      inventoryId: 'karkoli',
      supplierId: 'karkoli',
      cena: -5,
    }))
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('neznegativno')

    // realna pot: obstoječa odprta cena (od v preteklosti) → nova cena jo zapre
    const sifra = uniq('R136PRICEAPI')
    const inv = await db.inventory.create({
      data: { sifraMateriala: sifra, naziv: uniqNaziv('R136CenApiArtikel'), tip: 'Alu_profil', kolicinaZaloga: 0, enota: 'm' },
    })
    const s1 = await db.supplier.create({ data: { naziv: uniqNaziv('DobR136Api'), naslov: 'Api' } })
    await db.materialPrice.create({
      data: { inventoryId: inv.id, supplierId: s1.id, cena: 10, veljavnostOd: new Date(Date.now() - 5_000) },
    })
    const res2 = await pricesRoute.POST(request('POST', '/api/material-prices', token, {
      inventoryId: inv.id,
      supplierId: s1.id,
      cena: '12,50', // tudi SI decimalna vejica mora delovati
    }))
    expect(res2.status).toBe(201)
    const openPrices = await db.materialPrice.findMany({ where: { inventoryId: inv.id, veljavnostDo: null } })
    expect(openPrices).toHaveLength(1)
    expect(openPrices[0].cena).toBe(12.5)
    // zaprta cena ima VELJAVEN interval (od <= do) — GREATEST varovalka
    const closed = await db.materialPrice.findFirst({ where: { inventoryId: inv.id, veljavnostDo: { not: null } } })
    expect(closed!.veljavnostOd.getTime()).toBeLessThanOrEqual(closed!.veljavnostDo!.getTime())

    await cleanupInventory(inv.id)
    await db.supplier.delete({ where: { id: s1.id } }).catch(() => undefined)
  })

  it('schema higiena: monter relacija je kanonična (regresija lažnega alarma [m)', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const schemaPath = fileURLToPath(new URL('../../../prisma/schema.prisma', import.meta.url))
    const schema = readFileSync(schemaPath, 'utf8')
    expect(schema).toContain('fields: [monterId]')
    expect(schema).not.toContain('fields: onterId]')

    // Relacija deluje na klientu (InstallationSchedule.monter obstaja).
    const schedule = await db.installationSchedule.findFirst({
      where: { monterId: { not: null } },
      include: { monter: { select: { ime: true } } },
      take: 1,
    })
    if (schedule) expect(schedule.monter).not.toBeNull()
  })
})
