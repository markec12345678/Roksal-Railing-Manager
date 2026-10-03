// R390 — SEED PARITETA: BAZA == data/roksal-catalog.json (issue #13, §14).
// ---------------------------------------------------------------------------
// Dokaz, da seed migracije 20261008080000 ni izmišljeval: vsako polje vsake
// produktna vrstica je ENAKO JSON viru (generator r390-seed-sql-gen.mjs je
// edini izvor). Izjeme so DOKUMENTIRANE izpeljave: interniOkrepitev (iz
// fixing/posebnosti besedila), aplikacije (iz kategorije/posebnosti/fasadnega
// vira KUBO), kompatibilnost (iz besedil dodatkov) — vse s citatom vira v
// vrstici. Variante + preslikave dobaviteljev = 0 (§8 honest).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { db } from '@/lib/db'

const catalog = JSON.parse(readFileSync('data/roksal-catalog.json', 'utf8')) as {
  family: string
  material: string
  warranty: string
  officialSite: string
  colorPalette: { colors: Array<{ id: string; approxHex: string | null }> }
  generalMountingRules: string[]
  profiles: Array<{
    productId: string
    profile: string
    category: string
    faceWidthMm: number
    thicknessMm: number
    standardLengthsMm: number[]
    fixing: string
    screwsVisible: boolean
    maxPostSpacingMm: Record<string, number | null>
    maxRailSpacingMm: Record<string, number | null> | null
    recommendedGapMm: { min: number; max: number }
    handle: Record<string, unknown>
    sourceUrls: string[]
    rights: string
    specialFeatures: string[]
  }>
  accessories: Array<{
    id: string
    name: string
    dimensionMm?: number[]
    innerMm?: number[]
    note?: string
  }>
}

// Dokumentirane izpeljave (še videz citatov v vrsticah):
const OKREPITVE = new Set([
  'woodcore-romb-67',
  'woodcore-romb-67-vertical',
  'woodcore-kubo-80-42',
  'woodcore-polna-57-32',
])
const APLIKACIJE_PRODUKTA: Record<string, Array<[string, string]>> = {
  'woodcore-romb-67': [
    ['HORIZONTALNA_OGRAJA', 'horizontal'],
    ['POKONCNA_OGRAJA', 'vertical'],
  ],
  'woodcore-polna-128': [
    ['HORIZONTALNA_OGRAJA', 'horizontal'],
    ['POKONCNA_OGRAJA', 'vertical'],
  ],
  'woodcore-deska-150': [['TERASA', 'horizontal']],
  'woodcore-polna-57-32': [['POKONCNA_OGRAJA', 'vertical']],
  'woodcore-polna-100': [['POKONCNA_OGRAJA', 'vertical']],
  'woodcore-polna-128-vertical': [['POKONCNA_OGRAJA', 'vertical']],
  'woodcore-romb-67-vertical': [['POKONCNA_OGRAJA', 'vertical']],
  'woodcore-kubo-80-42': [['FASADA', 'vertical']],
}

describe('R390 — seed pariteta: verzija + družina', () => {
  it('točno ENA verzija (v1, ACTIVE, odprt interval — seed iz JSON)', async () => {
    const verzije = await db.productCatalogVersion.findMany()
    expect(verzije).toHaveLength(1)
    const v = verzije[0]
    expect(v.verzija).toBe(1)
    expect(v.status).toBe('ACTIVE')
    expect(v.veljavnostDo).toBeNull()
    expect(v.opomba).toContain('roksal-catalog.json')
  })

  it('družina WoodCore: paleta 9 + splošna pravila 9 EXACT iz JSON', async () => {
    const f = await db.productFamily.findUnique({ where: { sifra: 'woodcore' } })
    expect(f).not.toBeNull()
    expect(f!.naziv).toBe(catalog.family)
    expect(f!.material).toBe(catalog.material)
    expect(f!.garancija).toBe(catalog.warranty)
    expect(f!.uradnaStran).toBe(catalog.officialSite)
    expect(f!.pravice).toBe('pending')
    expect(JSON.parse(f!.barvnaPaletaJson)).toEqual(catalog.colorPalette.colors)
    expect(JSON.parse(f!.splosnaPravilaJson)).toEqual(catalog.generalMountingRules)
  })
})

describe('R390 — seed pariteta: produkti (8 profilov, polja EXACT)', () => {
  it('število produktov = profilov v JSON', async () => {
    const n = await db.product.count()
    expect(n).toBe(catalog.profiles.length)
  })

  for (const p of catalog.profiles) {
    it(`produkt ${p.productId}: vsa polja EXACT iz kataloga`, async () => {
      const dbP = await db.product.findUnique({ where: { sifra: p.productId } })
      expect(dbP).not.toBeNull()
      expect(dbP!.familyId).toBe((await db.productFamily.findUnique({ where: { sifra: 'woodcore' } }))!.id)
      expect(dbP!.naziv).toBe(p.profile)
      expect(dbP!.kategorija).toBe(p.category)
      expect(dbP!.faceWidthMm).toBe(p.faceWidthMm)
      expect(Number(dbP!.thicknessMm)).toBe(p.thicknessMm)
      expect(JSON.parse(dbP!.standardLengthsJson)).toEqual(p.standardLengthsMm)
      expect(dbP!.fixingMetoda).toBe(p.fixing)
      expect(dbP!.screwsVisible).toBe(p.screwsVisible)
      expect(dbP!.maxPostSpacingH).toBe(p.maxPostSpacingMm.horizontal ?? null)
      expect(dbP!.maxPostSpacingV).toBe(p.maxPostSpacingMm.vertical ?? null)
      expect(dbP!.maxRailSpacingV).toBe(p.maxRailSpacingMm?.vertical ?? null)
      expect(dbP!.gapMinMm).toBe(p.recommendedGapMm.min)
      expect(dbP!.gapMaxMm).toBe(p.recommendedGapMm.max)
      expect(JSON.parse(dbP!.rocajJson)).toEqual(p.handle)
      expect(JSON.parse(dbP!.posebnostiJson)).toEqual(p.specialFeatures)
      expect(dbP!.pravice).toBe(p.rights)
      expect(JSON.parse(dbP!.viriJson)).toEqual(p.sourceUrls)
      // Kvalifikatorji = NE-baza/h/v ključi (brez izgube, brez izuma)
      const kv = Object.entries(p.maxPostSpacingMm)
        .filter(([k, v]) => k !== 'horizontal' && k !== 'vertical' && v !== null)
        .map(([k, v]) => ({ key: k, maxSpacingMm: v }))
      expect(JSON.parse(dbP!.razmakKvalifikatorjiJson)).toEqual(kv)
      // Interna okrepitev = DOKUMENTIRANA preslikava (citat v opisu)
      expect(dbP!.interniOkrepitev).toBe(OKREPITVE.has(p.productId))
      if (dbP!.interniOkrepitev) {
        expect(dbP!.okrepitevOpis).not.toBeNull()
        expect(dbP!.okrepitevOpis!.length).toBeGreaterThan(10)
      } else {
        expect(dbP!.okrepitevOpis).toBeNull()
      }
    })
  }

  it('KUBO: maxPostSpacingV NULL (honest) + kvalifikatorji prazni', async () => {
    const kubo = await db.product.findUnique({ where: { sifra: 'woodcore-kubo-80-42' } })
    expect(kubo!.maxPostSpacingV).toBeNull()
    expect(JSON.parse(kubo!.razmakKvalifikatorjiJson)).toEqual([])
  })
})

describe('R390 — seed pariteta: aplikacije (§14 eksplicitni kontekst)', () => {
  it('vsak produkt ima TOČNO dokumentirane aplikacije (odsotnost = fail-closed)', async () => {
    for (const [sifra, priakovane] of Object.entries(APLIKACIJE_PRODUKTA)) {
      const produkt = await db.product.findUnique({
        where: { sifra },
        include: { applications: true },
      })
      const dejanske = produkt!.applications
        .map((a) => [a.aplikacija, a.orientacija] as [string, string])
        .sort()
      expect(dejanske).toEqual([...priakovane].sort())
      // vsaka vrstica ima citat vira
      for (const a of produkt!.applications) {
        expect(a.vir.length).toBeGreaterThan(10)
        expect(a.maxRazmakMm === null || a.maxRazmakMm! > 0).toBe(true)
      }
    }
  })

  it('KUBO ima SAMO FASADO (balkonska ograja odkrito NI dokumentirana)', async () => {
    const kubo = await db.product.findUnique({
      where: { sifra: 'woodcore-kubo-80-42' },
      include: { applications: true },
    })
    expect(kubo!.applications).toHaveLength(1)
    expect(kubo!.applications[0].aplikacija).toBe('FASADA')
    expect(kubo!.applications[0].orientacija).toBe('vertical')
    expect(kubo!.applications[0].maxRazmakMm).toBe(1000) // podkonstrukcija do 100 cm
    expect(kubo!.applications[0].vir).toContain('FASADNA')
  })

  it('PREDELNA_STENA in STROP: NIČEN produkt jih nima (honest absence)', async () => {
    const predelna = await db.productApplication.count({ where: { aplikacija: 'PREDELNA_STENA' } })
    const strop = await db.productApplication.count({ where: { aplikacija: 'STROP' } })
    expect(predelna).toBe(0)
    expect(strop).toBe(0)
  })

  it('TERASA: samo terasna deska DESKA-150', async () => {
    const terasa = await db.productApplication.findMany({
      where: { aplikacija: 'TERASA' },
      include: { product: true },
    })
    expect(terasa).toHaveLength(1)
    expect(terasa[0].product.sifra).toBe('woodcore-deska-150')
  })

  it('skupno število aplikacijskih vrstic = 10', async () => {
    expect(await db.productApplication.count()).toBe(10)
  })
})

describe('R390 — seed pariteta: dodatki + kompatibilnost', () => {
  it('5 dodatkov EXACT (šifre/nazivi/dimenzije/notranje mere/opisi)', async () => {
    const dod = await db.productAccessory.findMany()
    expect(dod).toHaveLength(catalog.accessories.length)
    for (const a of catalog.accessories) {
      const vrstica = dod.find((d) => d.sifra === a.id)
      expect(vrstica).toBeDefined()
      expect(vrstica!.naziv).toBe(a.name)
      expect(vrstica!.dimenzijeJson ? JSON.parse(vrstica!.dimenzijeJson) : null).toEqual(a.dimensionMm ?? null)
      expect(vrstica!.notranjeMereJson ? JSON.parse(vrstica!.notranjeMereJson) : null).toEqual(a.innerMm ?? null)
      expect(vrstica!.opis).toBe(a.note ?? null)
    }
  })

  it('12 kompatibilnosti — VSE ciljajo dodatek (XOR) + vsaka s citatom vira', async () => {
    const komp = await db.productCompatibility.findMany()
    expect(komp).toHaveLength(12)
    for (const k of komp) {
      expect(k.kompatibilenProductId).toBeNull()
      expect(k.kompatibilenDodatekId).not.toBeNull()
      expect(k.opis).not.toBeNull()
      expect(k.opis!.length).toBeGreaterThan(10)
    }
  })

  it('ROMB (prečni) ima 4 dokumentirane dodatke (ročaj/čep/letvica/steber)', async () => {
    const romb = await db.product.findUnique({
      where: { sifra: 'woodcore-romb-67' },
      include: { compatSource: { include: { kompatibilenDodatek: true } } },
    })
    const sifre = romb!.compatSource.map((c) => c.kompatibilenDodatek!.sifra).sort()
    expect(sifre).toEqual(
      ['cep-romb-levo-desno', 'letvica-zakljucna', 'rocaj-poln-92x45', 'stebricek-alu'].sort(),
    )
  })

  it('KUBO nima NOBENE kompatibilnosti (odkrito — fasadni kontekst)', async () => {
    const kubo = await db.product.findUnique({
      where: { sifra: 'woodcore-kubo-80-42' },
      include: { compatSource: true },
    })
    expect(kubo!.compatSource).toHaveLength(0)
  })

  it('variante + preslikave dobaviteljev = 0 (§8: števec ≠ enumeracija; ni vira)', async () => {
    expect(await db.productVariant.count()).toBe(0)
    expect(await db.productSupplierMapping.count()).toBe(0)
  })
})
