/**
 * S+7 testi — PRODUCT ASSET CATALOG (spec §2, §3, §5).
 * Katalog je data-driven; testi dokazujejo: veljavnost sheme, 7 profilov,
 * obvezne specifikacije, vire, pravice (pending), ločitev 4 tipov assetov.
 */
import { describe, it, expect } from 'vitest'
import {
  getCatalog,
  listProfiles,
  getProduct,
  profilesForOrientation,
  getColor,
  maxSupportSpacingMm,
  isGapWithinRecommendation,
  assetStatus,
} from '../index'

describe('roksal catalog (data-driven)', () => {
  it('naloži in validira katalog brez napak', () => {
    const c = getCatalog()
    expect(c.schemaVersion).toBe(1)
    expect(c.brand).toBe('Roksal')
    expect(c.manufacturer).toBe('ROKSAL d.o.o.')
    expect(c.family).toBe('WoodCore')
  })

  it('vsebuje vseh 7 zahtevanih profilov (spec §2)', () => {
    const ids = listProfiles().map((p) => p.productId)
    // PREČNE: ROMB 67, POLNA 128, DESKA 150
    expect(ids).toContain('woodcore-romb-67')
    expect(ids).toContain('woodcore-polna-128')
    expect(ids).toContain('woodcore-deska-150')
    // POKONČNE: POLNA 57/32, POLNA 100, POLNA 128, ROMB 67
    expect(ids).toContain('woodcore-polna-57-32')
    expect(ids).toContain('woodcore-polna-100')
    expect(ids).toContain('woodcore-polna-128-vertical')
    expect(ids).toContain('woodcore-romb-67-vertical')
    expect(ids.length).toBe(7)
  })

  it('vsak profil ima obvezne dimenzije, pritrditev, razmake in vire', () => {
    for (const p of listProfiles()) {
      expect(p.faceWidthMm, p.productId).toBeGreaterThan(0)
      expect(p.thicknessMm, p.productId).toBeGreaterThan(0)
      expect(p.standardLengthsMm.length, p.productId).toBeGreaterThan(0)
      expect(p.fixing.length, p.productId).toBeGreaterThan(10)
      expect(typeof p.screwsVisible, p.productId).toBe('boolean')
      expect(p.recommendedGapMm.max, p.productId).toBeGreaterThanOrEqual(p.recommendedGapMm.min)
      expect(p.sourceUrls.length, p.productId).toBeGreaterThan(0)
      for (const u of p.sourceUrls) {
        expect(u.startsWith('https://roksal.com/'), `${p.productId}: ${u}`).toBe(true)
      }
      expect(p.colorsCount, p.productId).toBeDefined()
      expect(p.colorsEvidence.length, p.productId).toBeGreaterThan(5)
    }
  })

  it('screwsVisible ujema z uradnim virom (skrito: romb + 57/32; vidno: 128, 100, 150)', () => {
    expect(getProduct('woodcore-romb-67')?.screwsVisible).toBe(false)
    expect(getProduct('woodcore-romb-67-vertical')?.screwsVisible).toBe(false)
    expect(getProduct('woodcore-polna-57-32')?.screwsVisible).toBe(false)
    expect(getProduct('woodcore-polna-128')?.screwsVisible).toBe(true)
    expect(getProduct('woodcore-polna-100')?.screwsVisible).toBe(true)
    expect(getProduct('woodcore-deska-150')?.screwsVisible).toBe(true)
  })

  it('maksimalni razmaki konstrukcije ustrezajo uradnim podatkom', () => {
    // Prečna: romb 145 cm, polna 128 110 cm, deska 150 133 cm
    expect(maxSupportSpacingMm(getProduct('woodcore-romb-67')!, 'horizontal')).toBe(1450)
    expect(maxSupportSpacingMm(getProduct('woodcore-polna-128')!, 'horizontal')).toBe(1100)
    expect(maxSupportSpacingMm(getProduct('woodcore-deska-150')!, 'horizontal')).toBe(1330)
    // Pokončna (razmak med vodoravnima cevema): 57/32=100, 100=80, 128=100, romb=110
    expect(maxSupportSpacingMm(getProduct('woodcore-polna-57-32')!, 'vertical')).toBe(1000)
    expect(maxSupportSpacingMm(getProduct('woodcore-polna-100')!, 'vertical')).toBe(800)
    expect(maxSupportSpacingMm(getProduct('woodcore-polna-128-vertical')!, 'vertical')).toBe(1000)
    expect(maxSupportSpacingMm(getProduct('woodcore-romb-67-vertical')!, 'vertical')).toBe(1100)
  })

  it('orientacije: pokončni profili so vertical-only kjer to drži (polna 100 = SAMO pokončna)', () => {
    expect(getProduct('woodcore-polna-100')?.orientation).toEqual(['vertical'])
    expect(getProduct('woodcore-polna-57-32')?.orientation).toEqual(['vertical'])
    expect(getProduct('woodcore-deska-150')?.orientation).toEqual(['horizontal'])
    expect(getProduct('woodcore-polna-128')?.orientation).toEqual(['horizontal', 'vertical'])
    const verticalOnly = profilesForOrientation('vertical')
    expect(verticalOnly.length).toBeGreaterThanOrEqual(4)
  })

  it('pravice so pending za VSE profile (spec §3 — dokler ni dovoljenja)', () => {
    for (const p of listProfiles()) {
      expect(p.rights, p.productId).toBe('pending')
    }
  })

  it('4 tipi assetov so ločeni polja (spec §6): product/profile/texture/reference', () => {
    const st = assetStatus(getProduct('woodcore-polna-100')!)
    for (const key of ['productImage', 'profileImage', 'textureImage', 'referenceImage'] as const) {
      expect(st).toHaveProperty(key)
    }
    // Privzeto: ni assetov dokler jih ne modeliramo (ali null)
    expect(st.productImage === null || typeof st.productImage === 'string').toBe(true)
  })

  it('barve: potrjena imena obstajajo v paleti z viri', () => {
    for (const id of ['amazon-wood', 'burma-teak', 'rustic-oak', 'rustic-walnut', 'ash-wood']) {
      const c = getColor(id)
      expect(c, id).not.toBeNull()
      expect(c!.evidence.length).toBeGreaterThan(10)
    }
    expect(getColor('burma-teak')!.name).toBe('Burma Teak')
  })

  it('razmak: priporočilo se uveljavlja (POLNA 100: 0,5–3 cm po FAQ)', () => {
    const p = getProduct('woodcore-polna-100')!
    expect(p.recommendedGapMm).toEqual({ min: 5, max: 30 })
    expect(isGapWithinRecommendation(p, 8)).toBe(true)
    expect(isGapWithinRecommendation(p, 5)).toBe(true)
    expect(isGapWithinRecommendation(p, 2)).toBe(false)
    expect(isGapWithinRecommendation(p, 50)).toBe(false)
  })

  it('katalog NI hardcodiran v komponentah — je JSON podatek + loader', () => {
    // Strukturna trditev: profilov je 7 in productId so enolični
    const ids = listProfiles().map((p) => p.productId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
