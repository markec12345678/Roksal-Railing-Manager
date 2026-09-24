/**
 * S+8 testi — PRODUCT SDK: KATALOG (spec §5, §21, §22 unit).
 * Katalog je PODATEK; SDK ga tipizira/validira; lookup je server-authoritative.
 */
import { describe, it, expect } from 'vitest'
import {
  getProductDefinition,
  listProductDefinitions,
  canonicalProductId,
  normalizeProductId,
  productDefinitionChecksum,
} from '../catalog'
import { getProduct } from '../../product-catalog'

describe('catalog: lookup (server-authoritative)', () => {
  it('najde produkt po kanoničnem SDK id (roksal.woodcore.romb-67)', () => {
    const def = getProductDefinition('roksal.woodcore.romb-67')
    expect(def).not.toBeNull()
    expect(def!.id).toBe('roksal.woodcore.romb-67')
    expect(def!.catalogProductId).toBe('woodcore-romb-67')
    expect(def!.manufacturer).toBe('ROKSAL d.o.o.')
    expect(def!.family).toBe('WoodCore')
  })

  it('najde produkt tudi po katalog productId (deterministična normalizacija)', () => {
    const def = getProductDefinition('woodcore-romb-67')
    expect(def).not.toBeNull()
    expect(def!.id).toBe('roksal.woodcore.romb-67')
  })

  it('neznan productId → null (API vrne 400, ne izmišlji profil)', () => {
    expect(getProductDefinition('woodcore-ne obstaja')).toBeNull()
    expect(getProductDefinition('forged-product')).toBeNull()
  })

  it('vseh 8 profilov je v katalogu (vključno z novim KUBO)', () => {
    const all = listProductDefinitions()
    expect(all.length).toBe(8)
    const ids = all.map((d) => d.catalogProductId)
    expect(ids).toContain('woodcore-kubo-80-42')
    expect(ids).toContain('woodcore-romb-67')
    expect(ids).toContain('woodcore-polna-128')
    expect(ids).toContain('woodcore-deska-150')
    expect(ids).toContain('woodcore-polna-57-32')
    expect(ids).toContain('woodcore-polna-100')
  })
})

describe('catalog: produktna pravila so PODATKI (iz kataloga)', () => {
  it('KUBO 80/42: 80×42 mm, samo vertical, skrito vijačenje (uradni vir S+8 §2)', () => {
    const kubo = getProductDefinition('woodcore-kubo-80-42')!
    expect(kubo.profile.faceWidthMm).toBe(80)
    expect(kubo.profile.thicknessMm).toBe(42)
    expect(kubo.profile.shape).toBe('kubo')
    expect(kubo.orientations).toEqual(['vertical'])
    expect(kubo.mounting.screwVisibility).toBe('hidden')
    expect(kubo.rights).toBe('pending')
    // uradni vir ne navaja max razmaka stebrov — NI izmišljen (S+8.1: null za vertical)
    expect(kubo.mounting.maxPostSpacingByOrientation.vertical.maxSpacingMm).toBeNull()
    expect(kubo.mounting.maxPostSpacingByOrientation.horizontal.maxSpacingMm).toBeNull()
    expect(kubo.mounting.maxRailSpacingMm).toBe(1000)
  })

  it('S+8.1 §2: orientacijska pravila so OHRANJENA (brez izgube podatkov kataloga)', () => {
    // POLNA 128: H=1100, V=1800, verticalOver150Cm=1500 (katalog 1:1)
    const polna = getProductDefinition('woodcore-polna-128')!
    expect(polna.mounting.maxPostSpacingByOrientation.horizontal.maxSpacingMm).toBe(1100)
    expect(polna.mounting.maxPostSpacingByOrientation.vertical.maxSpacingMm).toBe(1800)
    const over150 = polna.mounting.postSpacingQualifiers.find((q) => q.key === 'verticalOver150Cm')
    expect(over150).toBeDefined()
    expect(over150!.maxSpacingMm).toBe(1500)
    expect(over150!.autoApplied).toBe(true)
    expect(over150!.appliesWhenFieldHeightAboveMm).toBe(1500)
    // ROMB 67: H=1450, horizontalWithMidConnection=1800; V NE dokumentiran → null (NI fallbacka)
    const romb = getProductDefinition('woodcore-romb-67')!
    expect(romb.mounting.maxPostSpacingByOrientation.horizontal.maxSpacingMm).toBe(1450)
    expect(romb.mounting.maxPostSpacingByOrientation.vertical.maxSpacingMm).toBeNull()
    const mid = romb.mounting.postSpacingQualifiers.find((q) => q.key === 'horizontalWithMidConnection')
    expect(mid).toBeDefined()
    expect(mid!.maxSpacingMm).toBe(1800)
    expect(mid!.autoApplied).toBe(false) // pogoj ni strukturiran — NI samodejen
    // DESKA 150: horizontalUpperBound ohranjen kot podatek
    const deska = getProductDefinition('woodcore-deska-150')!
    expect(deska.mounting.postSpacingQualifiers.find((q) => q.key === 'horizontalUpperBound')!.maxSpacingMm).toBe(1400)
    // POLNA 100: V=1800 + over150Cm; H NE obstaja → null (NI V→H fallbacka)
    const polna100 = getProductDefinition('woodcore-polna-100')!
    expect(polna100.mounting.maxPostSpacingByOrientation.vertical.maxSpacingMm).toBe(1800)
    expect(polna100.mounting.maxPostSpacingByOrientation.horizontal.maxSpacingMm).toBeNull()
  })

  it('ROMB 67: rhombus, skrito vijačenje (alu cev), max post H=1450 (V ni dokumentiran)', () => {
    const def = getProductDefinition('woodcore-romb-67')!
    expect(def.profile.shape).toBe('rhombus')
    expect(def.profile.faceWidthMm).toBe(67)
    expect(def.mounting.screwVisibility).toBe('hidden')
    expect(def.mounting.maxPostSpacingByOrientation.horizontal.maxSpacingMm).toBe(1450)
    expect(def.orientations).toEqual(['horizontal', 'vertical'])
  })

  it('POLNA 128: vidno vijačenje + ročaj 92×45 z vijaki vsakih 500 mm', () => {
    const def = getProductDefinition('woodcore-polna-128')!
    expect(def.mounting.screwVisibility).toBe('visible')
    expect(def.mounting.handle.available).toBe(true)
    expect(def.mounting.handle.dimensionMm).toEqual([92, 45, 5800])
    expect(def.mounting.handle.screwsEveryMm).toBe(500)
  })

  it('pravice: vsi profili pending (ROKSAL-ASSET-RIGHTS.md)', () => {
    for (const def of listProductDefinitions()) {
      expect(['pending', 'granted', 'rejected']).toContain(def.rights)
      expect(def.rights).toBe('pending')
    }
  })

  it('barvna paleta: approxHex je null, če uradni podatek ne obstaja (ni izmišljen)', () => {
    const def = getProductDefinition('woodcore-romb-67')!
    expect(def.material.colors.length).toBeGreaterThanOrEqual(9)
    for (const c of def.material.colors) {
      // S+7 odločitev: uradni hex ne obstaja → null
      expect(c.approxHex).toBeNull()
      expect(c.evidence.length).toBeGreaterThan(5)
    }
  })
})

describe('catalog: id normalizacija + sledljivost', () => {
  it('canonicalProductId / normalizeProductId so inverza', () => {
    expect(canonicalProductId('woodcore-polna-100')).toBe('roksal.woodcore.polna-100')
    expect(normalizeProductId('roksal.woodcore.polna-100')).toBe('woodcore-polna-100')
    expect(normalizeProductId('woodcore-polna-100')).toBe('woodcore-polna-100')
  })

  it('checksum je stabilen in različen med profili (sledljivost renderja)', () => {
    const a = getProductDefinition('woodcore-romb-67')!
    const b = getProductDefinition('woodcore-polna-128')!
    expect(productDefinitionChecksum(a)).toBe(productDefinitionChecksum(getProductDefinition('woodcore-romb-67')!))
    expect(productDefinitionChecksum(a)).not.toBe(productDefinitionChecksum(b))
  })

  it('definicija je 1:1 izpeljana iz validiranega kataloga (brez kopij podatkov)', () => {
    const profile = getProduct('woodcore-polna-100')!
    const def = getProductDefinition('woodcore-polna-100')!
    expect(def.profile.faceWidthMm).toBe(profile.faceWidthMm)
    expect(def.profile.thicknessMm).toBe(profile.thicknessMm)
    expect(def.profile.standardLengthsMm).toEqual(profile.standardLengthsMm)
    expect(def.sourceUrls).toEqual(profile.sourceUrls)
  })
})
