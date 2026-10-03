// R390 — /api/catalog API POGODBA (issue #13, korak R170 iz §14).
// ---------------------------------------------------------------------------
//   • GET snapshot: verzija 1 ACTIVE + 8 produktov + besednjak 6 aplikacij +
//     KUBO aplikacija FASADA (§14 eksplicitni kontekst v odgovoru);
//   • GET ?aplikacija= filter: POKONCNA_OGRAJA podmnožica, FASADA samo KUBO,
//     TERASA samo DESKA-150; neznan tip → 400 s seznamom; orientacija filter;
//   • POST produkt 201 (+DB vrstica), duplikat šifre → 409, neznana družina
//     → 404, neveljavna kategorija → 400, okrepitev brez opisa → 400;
//   • RBAC: MONTER in SKLADISCE POST → 403 (catalog.manage = vodstvo);
//   • GET products/[id] detajl 200 / 404;
//   • POST applications 201 / duplikat 409 / neznan tip 400;
//   • POST variants: barva iz palete 201, neznana barva 400, lažni hex 400,
//     duplikat šifre 409.
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import * as catalogRoute from '@/app/api/catalog/route'
import * as productDetailRoute from '@/app/api/catalog/products/[id]/route'
import * as productAppsRoute from '@/app/api/catalog/products/[id]/applications/route'
import * as productVariantsRoute from '@/app/api/catalog/products/[id]/variants/route'

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

const NOV_PRODUKT = (sifra: string) => ({
  familySifra: 'woodcore',
  sifra,
  naziv: 'Testni profil R390',
  kategorija: 'pokoncna',
  faceWidthMm: 60,
  thicknessMm: 20,
  standardLengthsMm: [4000],
  fixingMetoda: 'Testna pritrditev skozi konzolo',
  screwsVisible: true,
  interniOkrepitev: false,
  gapMinMm: 2,
  gapMaxMm: 30,
  rocaj: { available: false },
  posebnosti: ['testna posebnost'],
  pravice: 'pending',
  viri: ['https://roksal.com/test-r390'],
})

describe('R390 — /api/catalog (§14 snapshot + aplikacijski filter)', () => {
  let token: string
  let vodjaId: string
  const createdProductIds: string[] = []
  const createdVariantIds: string[] = []
  const createdAppIds: string[] = []
  const users: Array<{ id: string; vloga: string }> = []

  beforeEach(async () => {
    const u = await createTestUserWithSession(uniq('r390vodja'), 'VODJA')
    token = u.token
    vodjaId = u.user.id
    users.push({ id: u.user.id, vloga: 'VODJA' })
  })

  afterEach(async () => {
    // Vrstni red (FK): variante → aplikacije → kompatibilnost → produkti → revizije → profili
    for (const id of createdVariantIds.splice(0)) {
      await db.productVariant.delete({ where: { id } }).catch(() => undefined)
    }
    for (const id of createdAppIds.splice(0)) {
      await db.productApplication.delete({ where: { id } }).catch(() => undefined)
    }
    for (const id of createdProductIds.splice(0)) {
      await db.product.delete({ where: { id } }).catch(() => undefined)
    }
    for (const u of users.splice(0)) {
      await db.auditLog.deleteMany({ where: { userId: u.id } })
      await db.profile.delete({ where: { id: u.id } }).catch(() => undefined)
    }
  })

  it('GET snapshot: verzija 1 ACTIVE + 8 produktov + besednjak 6 + KUBO FASADA', async () => {
    const res = await catalogRoute.GET(req('/api/catalog', token, 'GET'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    const verzija = body.verzija as Record<string, unknown>
    expect(verzija.verzija).toBe(1)
    expect(verzija.status).toBe('ACTIVE')
    expect(body.produkti as unknown[]).toHaveLength(8)
    expect(body.dodatki as unknown[]).toHaveLength(5)
    expect(body.družine as unknown[]).toHaveLength(1)
    const aplikacije = body.aplikacije as Array<{ aplikacija: string }>
    expect(aplikacije.map((a) => a.aplikacija)).toContain('FASADA')
    expect(aplikacije).toHaveLength(6)
    const kubo = (body.produkti as Array<Record<string, unknown>>).find(
      (p) => p.sifra === 'woodcore-kubo-80-42',
    )
    const kuboApps = kubo!.aplikacije as Array<Record<string, unknown>>
    expect(kuboApps).toHaveLength(1)
    expect(kuboApps[0].aplikacija).toBe('FASADA')
    expect(kuboApps[0].oznaka).toBe('Fasada')
    expect(kubo!.maxPostSpacingV).toBeNull() // honest NULL
    expect(kubo!.interniOkrepitev).toBe(true)
  })

  it('GET ?aplikacija=POKONCNA_OGRAJA — podmnožica BREZ terasne deske in KUBO', async () => {
    const res = await catalogRoute.GET(
      req('/api/catalog?aplikacija=POKONCNA_OGRAJA', token, 'GET'),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    const sifre = (body.produkti as Array<Record<string, unknown>>).map((p) => p.sifra)
    expect(sifre).not.toContain('woodcore-deska-150')
    expect(sifre).not.toContain('woodcore-kubo-80-42')
    expect(sifre).toContain('woodcore-polna-100')
    expect(sifre).toContain('woodcore-romb-67')
  })

  it('GET ?aplikacija=FASADA — SAMO KUBO (dokumentirana aplikacija)', async () => {
    const res = await catalogRoute.GET(req('/api/catalog?aplikacija=FASADA', token, 'GET'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    const sifre = (body.produkti as Array<Record<string, unknown>>).map((p) => p.sifra)
    expect(sifre).toEqual(['woodcore-kubo-80-42'])
  })

  it('GET ?aplikacija=TERASA&orientacija=horizontal — samo DESKA-150', async () => {
    const res = await catalogRoute.GET(
      req('/api/catalog?aplikacija=TERASA&orientacija=horizontal', token, 'GET'),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    const sifre = (body.produkti as Array<Record<string, unknown>>).map((p) => p.sifra)
    expect(sifre).toEqual(['woodcore-deska-150'])
  })

  it('GET ?aplikacija=BALKON — 400 s seznamom §14 tipov (fail-closed)', async () => {
    const res = await catalogRoute.GET(req('/api/catalog?aplikacija=BALKON', token, 'GET'))
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('POKONCNA_OGRAJA')
    expect(body.error).toContain('STROP')
  })

  it('GET ?orientacija=diagonalna — 400 (neveljavna orientacija)', async () => {
    const res = await catalogRoute.GET(
      req('/api/catalog?aplikacija=TERASA&orientacija=diagonalna', token, 'GET'),
    )
    expect(res.status).toBe(400)
  })

  it('POST 201 — produkt vezan na AKTIVNO verzijo (resolucija v store)', async () => {
    const sifra = uniq('r390-prod')
    const res = await catalogRoute.POST(req('/api/catalog', token, 'POST', NOV_PRODUKT(sifra)))
    expect(res.status).toBe(201)
    const body = (await res.json()) as Record<string, unknown>
    createdProductIds.push(body.produktId as string)
    const vBaza = await db.product.findUnique({
      where: { id: body.produktId as string },
      include: { catalogVersion: true },
    })
    expect(vBaza!.sifra).toBe(sifra)
    expect(vBaza!.catalogVersion.verzija).toBe(1)
    expect(vBaza!.standardLengthsJson).toBe('[4000]')
  })

  it('POST 409 — duplikat šifre (EXACT kanon §5)', async () => {
    const res = await catalogRoute.POST(
      req('/api/catalog', token, 'POST', NOV_PRODUKT('woodcore-romb-67')),
    )
    expect(res.status).toBe(409)
  })

  it('POST 404 — neznana družina (EXACT šifra)', async () => {
    const res = await catalogRoute.POST(
      req('/api/catalog', token, 'POST', { ...NOV_PRODUKT(uniq('r390-x')), familySifra: 'neobstojeca' }),
    )
    expect(res.status).toBe(404)
  })

  it('POST 400 — neveljavna kategorija (s seznamom)', async () => {
    const res = await catalogRoute.POST(
      req('/api/catalog', token, 'POST', { ...NOV_PRODUKT(uniq('r390-x')), kategorija: 'vsestranska' }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('precna+pokoncna')
  })

  it('POST 400 — interniOkrepitev brez opisa (NE izmišljamo citata)', async () => {
    const res = await catalogRoute.POST(
      req('/api/catalog', token, 'POST', { ...NOV_PRODUKT(uniq('r390-x')), interniOkrepitev: true }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('okrepitevOpis')
  })

  it('RBAC: MONTER in SKLADISCE POST → 403 (catalog.manage = vodstvo)', async () => {
    const monter = await createTestUserWithSession(uniq('r390mon'), 'MONTER')
    users.push({ id: monter.user.id, vloga: 'MONTER' })
    const skladisce = await createTestUserWithSession(uniq('r390skl'), 'SKLADISCE')
    users.push({ id: skladisce.user.id, vloga: 'SKLADISCE' })
    expect(
      (await catalogRoute.POST(req('/api/catalog', monter.token, 'POST', NOV_PRODUKT(uniq('r390-m'))))).status,
    ).toBe(403)
    expect(
      (await catalogRoute.POST(req('/api/catalog', skladisce.token, 'POST', NOV_PRODUKT(uniq('r390-s'))))).status,
    ).toBe(403)
  })

  it('GET products/[id] — detajl 200 z verzijo/variantami; 404 za manjkajočega', async () => {
    const romb = await db.product.findUnique({ where: { sifra: 'woodcore-romb-67' } })
    const res = await productDetailRoute.GET(
      req(`/api/catalog/products/${romb!.id}`, token, 'GET'),
      { params: Promise.resolve({ id: romb!.id }) },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.sifra).toBe('woodcore-romb-67')
    expect((body.aplikacije as unknown[]).length).toBe(2)
    expect(body.katalogVerzija).toBeDefined()
    const res404 = await productDetailRoute.GET(
      req('/api/catalog/products/neobstojec', token, 'GET'),
      { params: Promise.resolve({ id: 'neobstojec' }) },
    )
    expect(res404.status).toBe(404)
  })

  it('POST applications 201 → duplikat 409 → neznan tip 400', async () => {
    const sifra = uniq('r390-prod')
    const created = await catalogRoute.POST(req('/api/catalog', token, 'POST', NOV_PRODUKT(sifra)))
    const produktId = ((await created.json()) as Record<string, unknown>).produktId as string
    createdProductIds.push(produktId)

    const res = await productAppsRoute.POST(
      req(`/api/catalog/products/${produktId}/applications`, token, 'POST', {
        aplikacija: 'PREDELNA_STENA',
        orientacija: 'vertical',
        vir: 'testni vir R390 — predelna stena dokumentirana',
      }),
      { params: Promise.resolve({ id: produktId }) },
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as Record<string, unknown>
    createdAppIds.push(body.aplikacijaId as string)

    const dupl = await productAppsRoute.POST(
      req(`/api/catalog/products/${produktId}/applications`, token, 'POST', {
        aplikacija: 'PREDELNA_STENA',
        orientacija: 'vertical',
        vir: 'drug vir',
      }),
      { params: Promise.resolve({ id: produktId }) },
    )
    expect(dupl.status).toBe(409)

    const slab = await productAppsRoute.POST(
      req(`/api/catalog/products/${produktId}/applications`, token, 'POST', {
        aplikacija: 'BALKON',
        orientacija: 'vertical',
        vir: 'vir',
      }),
      { params: Promise.resolve({ id: produktId }) },
    )
    expect(slab.status).toBe(400)
  })

  it('POST variants: barva iz palete 201; neznana barva 400; lažni hex 400; duplikat 409', async () => {
    const romb = await db.product.findUnique({ where: { sifra: 'woodcore-romb-67' } })
    const productId = romb!.id

    const ok = await productVariantsRoute.POST(
      req(`/api/catalog/products/${productId}/variants`, token, 'POST', {
        sifra: uniq('r390-var'),
        naziv: 'Romb 67 — Rustik hrast',
        barvaId: 'rustic-oak',
      }),
      { params: Promise.resolve({ id: productId }) },
    )
    expect(ok.status).toBe(201)
    const okBody = (await ok.json()) as Record<string, unknown>
    createdVariantIds.push(okBody.variantaId as string)
    // hex prevzet iz palete (NE izmišljen)
    const paletaHex = (
      await db.productFamily.findUnique({ where: { sifra: 'woodcore' } })
    )!.barvnaPaletaJson
    const barva = (JSON.parse(paletaHex) as Array<{ id: string; approxHex: string | null }>).find(
      (c) => c.id === 'rustic-oak',
    )
    expect(okBody.barvaHex).toBe(barva!.approxHex)

    const neznana = await productVariantsRoute.POST(
      req(`/api/catalog/products/${productId}/variants`, token, 'POST', {
        sifra: uniq('r390-var'),
        naziv: 'Neznana barva varianta',
        barvaId: 'neobstojeca-barva',
      }),
      { params: Promise.resolve({ id: productId }) },
    )
    expect(neznana.status).toBe(400)
    const neznanaBody = (await neznana.json()) as { error: string }
    expect(neznanaBody.error).toContain('rustic-oak')

    const lažniHex = await productVariantsRoute.POST(
      req(`/api/catalog/products/${productId}/variants`, token, 'POST', {
        sifra: uniq('r390-var'),
        naziv: 'Lažni hex varianta',
        barvaId: 'rustic-oak',
        barvaHex: '#000001',
      }),
      { params: Promise.resolve({ id: productId }) },
    )
    expect(lažniHex.status).toBe(400)

    const duplSifra = uniq('r390-var')
    const prvi = await productVariantsRoute.POST(
      req(`/api/catalog/products/${productId}/variants`, token, 'POST', {
        sifra: duplSifra,
        naziv: 'Prva',
      }),
      { params: Promise.resolve({ id: productId }) },
    )
    expect(prvi.status).toBe(201)
    createdVariantIds.push(((await prvi.json()) as Record<string, unknown>).variantaId as string)
    const drugi = await productVariantsRoute.POST(
      req(`/api/catalog/products/${productId}/variants`, token, 'POST', {
        sifra: duplSifra,
        naziv: 'Druga',
      }),
      { params: Promise.resolve({ id: productId }) },
    )
    expect(drugi.status).toBe(409)
  })
})
