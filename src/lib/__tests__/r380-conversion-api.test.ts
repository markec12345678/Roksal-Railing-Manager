// R380 (issue #13, korak R168 iz §12) — KONVERZIJA ENOT prek APIja.
// ---------------------------------------------------------------------------
// Testi dokazujejo §12 API pogodbo na /api/inventory POST:
//   • veljavna konverzija (kanonične enote EXACT + pozitivni faktorji +
//     preciznost 0–6 + način GORI/DOL/NAJBLIZJE) → 201, polja ZAPISANA;
//   • 'm2' → 400 z javno napako (NE tiha normalizacija v 'm²' — kanon §5);
//   • faktor ≤ 0 → 400; smeten rounding → 400; preciznost 7 → 400;
//   • BREZ konverzije → 201 + VSA polja NULL (honest §8 — obstoječi
//     materiali niso izumljeni);
//   • GET vrača številke (Decimal → number na DTO meji — decToPlain).
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import * as inventoryRoute from '@/app/api/inventory/route'

const BASE = 'http://localhost'
let counter = 0
const uniq = (p: string) => `${p}-${Date.now()}-${(counter += 1)}`

function req(path: string, token: string, body?: Record<string, unknown>): Request {
  return new Request(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, origin: BASE },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

const veljavnoTelo = () => ({
  sifraMateriala: uniq('R380-API-SKU'),
  naziv: uniq('R380 API Artikel'),
  tip: 'Alu_profil',
  kolicinaZaloga: 10,
  enota: 'm',
  minimalnaZaloga: 2,
})

describe('R380 — /api/inventory POST konverzija enot (§12 API)', () => {
  let token: string
  let vodjaId: string
  const created: string[] = []

  beforeEach(async () => {
    const uporabnik = await createTestUserWithSession(uniq('r379vodja'), 'VODJA')
    token = uporabnik.token
    vodjaId = uporabnik.user.id
  })

  afterEach(async () => {
    for (const id of created.splice(0)) {
      await db.inventoryMovement.deleteMany({ where: { inventoryId: id } })
      await db.stockLedger.deleteMany({ where: { inventoryId: id } })
      await db.inventoryLot.deleteMany({ where: { inventoryId: id } })
      await db.inventory.delete({ where: { id } }).catch(() => undefined)
    }
    if (vodjaId) {
      await db.profile.delete({ where: { id: vodjaId } }).catch(() => undefined)
    }
  })

  it('veljavna POPOLNA konverzija → 201 + polja zapisana kanonično', async () => {
    const res = await inventoryRoute.POST(
      req('/api/inventory', token, {
        ...veljavnoTelo(),
        purchaseUnit: 'paket',
        stockUnit: 'm',
        consumptionUnit: 'm',
        supplierPackSize: 6,
        conversionFactor: 6,
        precision: 3,
        rounding: 'GORI',
      }),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as Record<string, unknown>
    created.push(body.id as string)
    expect(body.purchaseUnit).toBe('paket')
    expect(body.stockUnit).toBe('m')
    expect(body.consumptionUnit).toBe('m')
    expect(body.supplierPackSize).toBe(6)
    expect(body.conversionFactor).toBe(6)
    expect(body.precision).toBe(3)
    expect(body.rounding).toBe('GORI')
    // GET DTO meja: številke, ne stringi (decToPlain):
    expect(typeof body.supplierPackSize).toBe('number')
    expect(typeof body.kolicinaZaloga).toBe('number')
  })

  it("'m2' → 400 JAVNO (EXACT kanon — NE tiha normalizacija v 'm²')", async () => {
    const res = await inventoryRoute.POST(
      req('/api/inventory', token, { ...veljavnoTelo(), purchaseUnit: 'm2' }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('m2')
    expect(body.error).toContain("'m²'") // seznam veljavnih vrednosti je v sporočilu
    expect(body.error).toContain('paket')
  })

  it("case-sensitive: 'KOS' → 400 (kanon §5 brez fuzzy)", async () => {
    const res = await inventoryRoute.POST(
      req('/api/inventory', token, { ...veljavnoTelo(), stockUnit: 'KOS' }),
    )
    expect(res.status).toBe(400)
  })

  it('conversionFactor 0 → 400 (ničelni faktor bi tiho pokvaril pretvorbo)', async () => {
    const res = await inventoryRoute.POST(
      req('/api/inventory', token, { ...veljavnoTelo(), conversionFactor: 0 }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('conversionFactor')
  })

  it('supplierPackSize negativen → 400', async () => {
    const res = await inventoryRoute.POST(
      req('/api/inventory', token, { ...veljavnoTelo(), supplierPackSize: -6 }),
    )
    expect(res.status).toBe(400)
  })

  it('precision 7 → 400 (meja 0–6, en vir z decimal-policy)', async () => {
    const res = await inventoryRoute.POST(
      req('/api/inventory', token, { ...veljavnoTelo(), precision: 7 }),
    )
    expect(res.status).toBe(400)
  })

  it("smeten rounding 'NAJBLIŽJE' → 400 (nabor je GORI/DOL/NAJBLIZJE)", async () => {
    const res = await inventoryRoute.POST(
      req('/api/inventory', token, { ...veljavnoTelo(), rounding: 'NAJBLIŽJE' }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('GORI')
  })

  it('BREZ konverzije → 201 + VSA polja NULL (honest §8 — nič ni izumljeno)', async () => {
    const res = await inventoryRoute.POST(req('/api/inventory', token, veljavnoTelo()))
    expect(res.status).toBe(201)
    const body = (await res.json()) as Record<string, unknown>
    created.push(body.id as string)
    expect(body.purchaseUnit).toBeNull()
    expect(body.stockUnit).toBeNull()
    expect(body.consumptionUnit).toBeNull()
    expect(body.supplierPackSize).toBeNull()
    expect(body.conversionFactor).toBeNull()
    expect(body.precision).toBeNull()
    expect(body.rounding).toBeNull()
  })

  it('DELNA konverzija → 201 (samo prisotna polja zapisana)', async () => {
    const res = await inventoryRoute.POST(
      req('/api/inventory', token, { ...veljavnoTelo(), purchaseUnit: 'paket', precision: 2 }),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as Record<string, unknown>
    created.push(body.id as string)
    expect(body.purchaseUnit).toBe('paket')
    expect(body.precision).toBe(2)
    expect(body.stockUnit).toBeNull() // ostalo iskreno neznano
  })
})
