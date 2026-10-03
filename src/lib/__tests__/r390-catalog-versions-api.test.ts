// R390 — /api/catalog/versions + compatibility + supplier-mappings
// API POGODBA (issue #13, korak R170 iz §14).
// ---------------------------------------------------------------------------
//   • POST versions 201 → DRAFT z zaporedno številko (2);
//   • PATCH aktiviraj: DRAFT→ACTIVE + prejšnja ACTIVE→RETIRED V ISTI
//     TRANSAKCIJI (veljavnostDo nastavljen); aktivirati ACTIVE → 409;
//     upokojiti → RETIRED terminalno 409; neznan action → 400; 404;
//   • snapshot po upokojitvi BREZ ACTIVE → 409 (NE mešaj upokojenih);
//   • POST compatibility: produkt×produkt 201, XOR 400, samo-sebe 400,
//     neznani cilj 404, duplikat 409;
//   • POST supplier-mappings: 201 + prekrivanje intervala 409 + napačen
//     interval 400; PATCH preklici zapre (veljavnostDo), drugič 409;
//   • RBAC: MONTER versions POST → 403.
// POZOR: suite MUTIRA stanje verzij — afterEach OBVEZNO obnovi seed (v1
// nazaj ACTIVE, odprt interval; v2 izbrisana) za druge suite (fileParallelism
// false — zaporedje znotraj suite-a je pod nadzorom).
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import * as catalogRoute from '@/app/api/catalog/route'
import * as versionsRoute from '@/app/api/catalog/versions/route'
import * as versionIdRoute from '@/app/api/catalog/versions/[id]/route'
import * as compatibilityRoute from '@/app/api/catalog/compatibility/route'
import * as supplierMappingsRoute from '@/app/api/catalog/supplier-mappings/route'

const BASE = 'http://localhost'
let counter = 0
const uniq = (p: string) => `${p}-${Date.now()}-${(counter += 1)}`

function req(
  path: string,
  token: string,
  method: 'POST' | 'PATCH' | 'GET',
  body?: Record<string, unknown>,
): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, origin: BASE },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

describe('R390 — /api/catalog/versions (§14 catalog version + effective dates)', () => {
  let token: string
  let vodjaId: string
  let novaVerzijaId: string | null
  let monterToken: string | null
  let monterId: string | null

  beforeEach(async () => {
    const u = await createTestUserWithSession(uniq('r390ver'), 'VODJA')
    token = u.token
    vodjaId = u.user.id
    novaVerzijaId = null
  })

  afterEach(async () => {
    // OBNOVA SEEDA (kanon: testna baza se NE čisti med suite-i):
    // 1. izbriši novo verzijo + njene produkte (cascade ni — RESTRICT od
    //    produkta; brišemo produkt ročno, če je ostal);
    if (novaVerzijaId) {
      await db.product.deleteMany({ where: { catalogVersionId: novaVerzijaId } })
      await db.productCatalogVersion.delete({ where: { id: novaVerzijaId } }).catch(() => undefined)
    }
    // 2. vrni katalog-v1 v ACTIVE z odprtim intervalom.
    await db.productCatalogVersion.update({
      where: { id: 'katalog-v1' },
      data: { status: 'ACTIVE', veljavnostDo: null, approvedAt: null },
    }).catch(() => undefined)
    await db.auditLog.deleteMany({ where: { userId: vodjaId } })
    await db.profile.delete({ where: { id: vodjaId } }).catch(() => undefined)
    if (monterId) {
      await db.auditLog.deleteMany({ where: { userId: monterId } })
      await db.profile.delete({ where: { id: monterId } }).catch(() => undefined)
      monterId = null
      monterToken = null
    }
  })

  it('GET seznam: seed v1 ACTIVE + število produktov 8', async () => {
    const res = await versionsRoute.GET(req('/api/catalog/versions', token, 'GET'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as Array<Record<string, unknown>>
    const v1 = body.find((v) => v.verzija === 1)
    expect(v1).toBeDefined()
    expect(v1!.status).toBe('ACTIVE')
    expect(v1!.steviloProduktov).toBe(8)
  })

  it('POST 201 → DRAFT verzija 2 (zaporedna številka)', async () => {
    const res = await versionsRoute.POST(
      req('/api/catalog/versions', token, 'POST', { opomba: 'testna verzija R390' }),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.verzija).toBe(2)
    expect(body.status).toBe('DRAFT')
    novaVerzijaId = body.verzijaId as string
  })

  it('RBAC: MONTER POST verzijo → 403', async () => {
    const monter = await createTestUserWithSession(uniq('r390mon'), 'MONTER')
    monterToken = monter.token
    monterId = monter.user.id
    const res = await versionsRoute.POST(
      req('/api/catalog/versions', monter.token, 'POST', {}),
    )
    expect(res.status).toBe(403)
  })

  it('PATCH aktiviraj: DRAFT→ACTIVE + prejšnja v1 RETIRED V ISTI TRANSAKCIJI', async () => {
    const created = await versionsRoute.POST(
      req('/api/catalog/versions', token, 'POST', { opomba: 'aktivacijski test' }),
    )
    const createdBody = (await created.json()) as Record<string, unknown>
    novaVerzijaId = createdBody.verzijaId as string

    const res = await versionIdRoute.PATCH(
      req(`/api/catalog/versions/${novaVerzijaId}`, token, 'PATCH', { action: 'aktiviraj' }),
      { params: Promise.resolve({ id: novaVerzijaId! }) },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.status).toBe('ACTIVE')
    expect(body.veljavnostDo).toBeNull()

    const v1 = await db.productCatalogVersion.findUnique({ where: { id: 'katalog-v1' } })
    expect(v1!.status).toBe('RETIRED')
    expect(v1!.veljavnostDo).not.toBeNull()

    // snapshot zdaj kaže verzijo 2 (BREZ produktov — novi katalog je prazen)
    const snap = await catalogRoute.GET(req('/api/catalog', token, 'GET'))
    expect(snap.status).toBe(200)
    const snapBody = (await snap.json()) as Record<string, unknown>
    expect((snapBody.verzija as Record<string, unknown>).verzija).toBe(2)
    expect(snapBody.produkti as unknown[]).toHaveLength(0)
  })

  it('PATCH aktiviraj na ACTIVE → 409; neznan action → 400; neznan id → 404', async () => {
    const res = await versionIdRoute.PATCH(
      req('/api/catalog/versions/katalog-v1', token, 'PATCH', { action: 'aktiviraj' }),
      { params: Promise.resolve({ id: 'katalog-v1' }) },
    )
    expect(res.status).toBe(409) // v1 je ACTIVE — aktivirati se da SAMO DRAFT

    const slab = await versionIdRoute.PATCH(
      req('/api/catalog/versions/katalog-v1', token, 'PATCH', { action: 'ponastavi' }),
      { params: Promise.resolve({ id: 'katalog-v1' }) },
    )
    expect(slab.status).toBe(400)

    const manjka = await versionIdRoute.PATCH(
      req('/api/catalog/versions/neobstojec', token, 'PATCH', { action: 'aktiviraj' }),
      { params: Promise.resolve({ id: 'neobstojec' }) },
    )
    expect(manjka.status).toBe(404)
  })

  it('PATCH upokoji: ACTIVE→RETIRED; ponovno → 409; snapshot brez ACTIVE → 409', async () => {
    const res = await versionIdRoute.PATCH(
      req('/api/catalog/versions/katalog-v1', token, 'PATCH', { action: 'upokoji' }),
      { params: Promise.resolve({ id: 'katalog-v1' }) },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.status).toBe('RETIRED')
    expect(body.veljavnostDo).not.toBeNull()

    const ponovno = await versionIdRoute.PATCH(
      req('/api/catalog/versions/katalog-v1', token, 'PATCH', { action: 'upokoji' }),
      { params: Promise.resolve({ id: 'katalog-v1' }) },
    )
    expect(ponovno.status).toBe(409)

    // Brez ACTIVE verzije → snapshot fail-closed 409 (NE mešaj upokojenih)
    const snap = await catalogRoute.GET(req('/api/catalog', token, 'GET'))
    expect(snap.status).toBe(409)
    const snapBody = (await snap.json()) as { error: string }
    expect(snapBody.error).toContain('ACTIVE')
  })
})

describe('R390 — /api/catalog/compatibility (§14 Compatibility)', () => {
  let token: string
  let vodjaId: string
  const createdCompatIds: string[] = []

  beforeEach(async () => {
    const u = await createTestUserWithSession(uniq('r390kom'), 'VODJA')
    token = u.token
    vodjaId = u.user.id
  })

  afterEach(async () => {
    for (const id of createdCompatIds.splice(0)) {
      await db.productCompatibility.delete({ where: { id } }).catch(() => undefined)
    }
    await db.auditLog.deleteMany({ where: { userId: vodjaId } })
    await db.profile.delete({ where: { id: vodjaId } }).catch(() => undefined)
  })

  it('POST 201 — produkt × produkt (XOR cilj)', async () => {
    const romb = await db.product.findUnique({ where: { sifra: 'woodcore-romb-67' } })
    const polna = await db.product.findUnique({ where: { sifra: 'woodcore-polna-128' } })
    const res = await compatibilityRoute.POST(
      req('/api/catalog/compatibility', token, 'POST', {
        productId: romb!.id,
        kompatibilenProductId: polna!.id,
        opis: 'testna kombinacija R390',
      }),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as Record<string, unknown>
    createdCompatIds.push(body.kompatibilnostId as string)
    expect(body.kompatibilenProductId).toBe(polna!.id)
    expect(body.kompatibilenDodatekId).toBeNull()
  })

  it('POST 400 — oba cilja ALI noben (XOR)', async () => {
    const romb = await db.product.findUnique({ where: { sifra: 'woodcore-romb-67' } })
    const dodatek = await db.productAccessory.findUnique({ where: { sifra: 'cep-romb-levo-desno' } })
    const oba = await compatibilityRoute.POST(
      req('/api/catalog/compatibility', token, 'POST', {
        productId: romb!.id,
        kompatibilenProductId: romb!.id,
        kompatibilenDodatekId: dodatek!.id,
      }),
    )
    expect(oba.status).toBe(400)
    const noben = await compatibilityRoute.POST(
      req('/api/catalog/compatibility', token, 'POST', { productId: romb!.id }),
    )
    expect(noben.status).toBe(400)
  })

  it('POST 400 — produkt samemu sebi', async () => {
    const romb = await db.product.findUnique({ where: { sifra: 'woodcore-romb-67' } })
    const res = await compatibilityRoute.POST(
      req('/api/catalog/compatibility', token, 'POST', {
        productId: romb!.id,
        kompatibilenProductId: romb!.id,
      }),
    )
    expect(res.status).toBe(400)
  })

  it('POST 404 — neznani produkt/cilj; 409 — duplikat (seed para)', async () => {
    const romb = await db.product.findUnique({ where: { sifra: 'woodcore-romb-67' } })
    const dodatek = await db.productAccessory.findUnique({ where: { sifra: 'cep-romb-levo-desno' } })

    const neznaniCilj = await compatibilityRoute.POST(
      req('/api/catalog/compatibility', token, 'POST', {
        productId: romb!.id,
        kompatibilenDodatekId: 'neobstojec-dodatek',
      }),
    )
    expect(neznaniCilj.status).toBe(404)

    const neznaniVir = await compatibilityRoute.POST(
      req('/api/catalog/compatibility', token, 'POST', {
        productId: 'neobstojec-produkt',
        kompatibilenDodatekId: dodatek!.id,
      }),
    )
    expect(neznaniVir.status).toBe(404)

    // Seed že vsebuje romb ← cep-romb-levo-desno → duplikat 409
    const dupl = await compatibilityRoute.POST(
      req('/api/catalog/compatibility', token, 'POST', {
        productId: romb!.id,
        kompatibilenDodatekId: dodatek!.id,
      }),
    )
    expect(dupl.status).toBe(409)
  })
})

describe('R390 — /api/catalog/supplier-mappings (§14 supplier mapping + datumi)', () => {
  let token: string
  let vodjaId: string
  let supplierId: string
  const createdMappingIds: string[] = []

  beforeEach(async () => {
    const u = await createTestUserWithSession(uniq('r390sup'), 'VODJA')
    token = u.token
    vodjaId = u.user.id
    const s = await db.supplier.create({
      data: { naziv: uniq('Testni dobavitelj R390') },
    })
    supplierId = s.id
  })

  afterEach(async () => {
    for (const id of createdMappingIds.splice(0)) {
      await db.productSupplierMapping.delete({ where: { id } }).catch(() => undefined)
    }
    await db.supplier.delete({ where: { id: supplierId } }).catch(() => undefined)
    await db.auditLog.deleteMany({ where: { userId: vodjaId } })
    await db.profile.delete({ where: { id: vodjaId } }).catch(() => undefined)
  })

  it('POST 201 — odprt interval; PATCH preklici zapre; drugič 409', async () => {
    const romb = await db.product.findUnique({ where: { sifra: 'woodcore-romb-67' } })
    const res = await supplierMappingsRoute.POST(
      req('/api/catalog/supplier-mappings', token, 'POST', {
        productId: romb!.id,
        supplierId,
        veljavnostOd: '2026-10-01T00:00:00.000Z',
        opomba: 'testna preslikava R390',
      }),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as Record<string, unknown>
    createdMappingIds.push(body.mappingId as string)
    expect(body.veljavnostDo).toBeNull()

    const preklic = await supplierMappingsRoute.PATCH(
      req('/api/catalog/supplier-mappings', token, 'PATCH', {
        mappingId: body.mappingId,
        action: 'preklici',
      }),
    )
    expect(preklic.status).toBe(200)
    const preklicBody = (await preklic.json()) as Record<string, unknown>
    expect(preklicBody.veljavnostDo).not.toBeNull()

    const ponovno = await supplierMappingsRoute.PATCH(
      req('/api/catalog/supplier-mappings', token, 'PATCH', {
        mappingId: body.mappingId,
        action: 'preklici',
      }),
    )
    expect(ponovno.status).toBe(409)
  })

  it('POST 409 — prekrivajoč se interval istega para', async () => {
    const romb = await db.product.findUnique({ where: { sifra: 'woodcore-romb-67' } })
    const prvi = await supplierMappingsRoute.POST(
      req('/api/catalog/supplier-mappings', token, 'POST', {
        productId: romb!.id,
        supplierId,
        veljavnostOd: '2026-10-01T00:00:00.000Z',
      }),
    )
    expect(prvi.status).toBe(201)
    createdMappingIds.push(((await prvi.json()) as Record<string, unknown>).mappingId as string)

    const drugi = await supplierMappingsRoute.POST(
      req('/api/catalog/supplier-mappings', token, 'POST', {
        productId: romb!.id,
        supplierId,
        veljavnostOd: '2026-11-01T00:00:00.000Z', // prekriva odprti interval
      }),
    )
    expect(drugi.status).toBe(409)

    // NE-prekrivajoč (po preklicu prvega) je dovoljen — sosednji interval
    await supplierMappingsRoute.PATCH(
      req('/api/catalog/supplier-mappings', token, 'PATCH', {
        mappingId: createdMappingIds[0],
        action: 'preklici',
      }),
    )
    const tretji = await supplierMappingsRoute.POST(
      req('/api/catalog/supplier-mappings', token, 'POST', {
        productId: romb!.id,
        supplierId,
        veljavnostOd: '2026-12-01T00:00:00.000Z',
      }),
    )
    expect(tretji.status).toBe(201)
    createdMappingIds.push(((await tretji.json()) as Record<string, unknown>).mappingId as string)
  })

  it('POST 400 — veljavnostDo ≤ veljavnostOd; 404 — neznan produkt/dobavitelj', async () => {
    const romb = await db.product.findUnique({ where: { sifra: 'woodcore-romb-67' } })
    const slabInterval = await supplierMappingsRoute.POST(
      req('/api/catalog/supplier-mappings', token, 'POST', {
        productId: romb!.id,
        supplierId,
        veljavnostOd: '2026-10-01T00:00:00.000Z',
        veljavnostDo: '2026-09-01T00:00:00.000Z',
      }),
    )
    expect(slabInterval.status).toBe(400)

    const neznanaBaza = await supplierMappingsRoute.POST(
      req('/api/catalog/supplier-mappings', token, 'POST', {
        productId: 'neobstojec-produkt',
        supplierId,
        veljavnostOd: '2026-10-01T00:00:00.000Z',
      }),
    )
    expect(neznanaBaza.status).toBe(404)

    const neznaniDobavitelj = await supplierMappingsRoute.POST(
      req('/api/catalog/supplier-mappings', token, 'POST', {
        productId: romb!.id,
        supplierId: 'neobstojec-dobavitelj',
        veljavnostOd: '2026-10-01T00:00:00.000Z',
      }),
    )
    expect(neznaniDobavitelj.status).toBe(404)
  })
})
