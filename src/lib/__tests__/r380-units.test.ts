// R380 (issue #13, korak R168 iz §12) — KANONIČNE ENOTE + konverzijska validacija.
// ---------------------------------------------------------------------------
// Testi dokazujejo kanon §5 (EXACT, brez fuzzy) na enotah:
//   • nabor osmih enot je ZAMRZNJEN (bajtno — 'm²' ima SUPERSCRIPT 2);
//   • 'm2' NI 'm²', 'M' NI 'm', ' kos' NI 'kos' — vsak nekanonični zapis je
//     JAVNA napaka s seznamom veljavnih vrednosti (NE tiha normalizacija —
//     ista hevristika, ki jo §5 prepoveduje pri SKU);
//   • konverzija (§12): delna prisotnost dovoljena (neodvisno znano §8),
//     izračun zahteva popolnost (manjka karkoli → null, ne ugibanje);
//   • faktorji/packSize pozitivni, preciznost 0–6, nabor GORI/DOL/NAJBLIZJE.
import { describe, expect, it } from 'vitest'
import {
  KANONICNE_ENOTE,
  jeKanonicnaEnota,
  veljavajKanonicnoEnoto,
  veljavajNacinZaokrozevanja,
  veljavajPreciznost,
  veljavajKonverzijoZaZapis,
  izracunajKonverzijo,
  UnitsError,
} from '@/lib/units'

describe('R380 — kanonične enote (§12, EXACT kanon §5)', () => {
  it('nabor osmih enot je ZAMRZNJEN (bajtno — m² s superscriptom U+00B2)', () => {
    expect([...KANONICNE_ENOTE]).toEqual(['kos', 'm', 'm²', 'kg', 'l', 'komplet', 'ura', 'paket'])
    // dokaz, da je res superscript (ne 'm2'):
    expect('m²'.charCodeAt(1)).toBe(0x00b2)
    const kotString: string = 'm²'
    expect(kotString === 'm2').toBe(false)
  })

  describe('jeKanonicnaEnota — EXACT preverba', () => {
    it('veljavne vrednosti → true', () => {
      for (const e of KANONICNE_ENOTE) expect(jeKanonicnaEnota(e)).toBe(true)
    })
    it('nekanonični zapisi → false (BREZ fuzzy: m2, M, presledki, prazno)', () => {
      expect(jeKanonicnaEnota('m2')).toBe(false) // superscript ≠ številka
      expect(jeKanonicnaEnota('M')).toBe(false) // case-sensitive
      expect(jeKanonicnaEnota(' kos')).toBe(false) // presledki
      expect(jeKanonicnaEnota('kos ')).toBe(false)
      expect(jeKanonicnaEnota('')).toBe(false)
      expect(jeKanonicnaEnota('KOS')).toBe(false)
      expect(jeKanonicnaEnota('metrov')).toBe(false)
    })
    it('ne-string tipi → false (preverba, ne validacija)', () => {
      expect(jeKanonicnaEnota(5)).toBe(false)
      expect(jeKanonicnaEnota(null)).toBe(false)
      expect(jeKanonicnaEnota(undefined)).toBe(false)
      expect(jeKanonicnaEnota({})).toBe(false)
    })
  })

  describe('veljavajKanonicnoEnoto — fail-closed validacija', () => {
    it('veljavna vrne TIP (KanonicnaEnota)', () => {
      expect(veljavajKanonicnoEnoto('paket', 'purchaseUnit')).toBe('paket')
      expect(veljavajKanonicnoEnoto('m²', 'stockUnit')).toBe('m²')
    })
    it('neveljavna → UnitsError, sporočilo vsebuje SEZNAM veljavnih vrednosti', () => {
      try {
        veljavajKanonicnoEnoto('m2', 'purchaseUnit')
        expect.unreachable('m2 mora pasti')
      } catch (e) {
        expect(e).toBeInstanceOf(UnitsError)
        const sporocilo = (e as UnitsError).message
        expect(sporocilo).toContain('m2')
        expect(sporocilo).toContain("'m²'")
        for (const enota of KANONICNE_ENOTE) expect(sporocilo).toContain(enota)
      }
    })
    it('ne-string → UnitsError z imenom polja', () => {
      expect(() => veljavajKanonicnoEnoto(42, 'stockUnit')).toThrow(UnitsError)
      expect(() => veljavajKanonicnoEnoto(null, 'stockUnit')).toThrow(/stockUnit/)
    })
  })

  describe('načini zaokroževanja + preciznost (pogodba z decimal-policy)', () => {
    it('veljavni načini GORI/DOL/NAJBLIZJE', () => {
      expect(veljavajNacinZaokrozevanja('GORI', 'rounding')).toBe('GORI')
      expect(veljavajNacinZaokrozevanja('DOL', 'rounding')).toBe('DOL')
      expect(veljavajNacinZaokrozevanja('NAJBLIZJE', 'rounding')).toBe('NAJBLIZJE')
    })
    it('smet → UnitsError (tudi "gor", "NAJBLIŽJE", null)', () => {
      expect(() => veljavajNacinZaokrozevanja('gor', 'rounding')).toThrow(UnitsError)
      expect(() => veljavajNacinZaokrozevanja('NAJBLIŽJE', 'rounding')).toThrow(UnitsError)
      expect(() => veljavajNacinZaokrozevanja(null, 'rounding')).toThrow(UnitsError)
    })
    it('preciznost: celo število 0–6 OK', () => {
      expect(veljavajPreciznost(0, 'precision')).toBe(0)
      expect(veljavajPreciznost(3, 'precision')).toBe(3)
      expect(veljavajPreciznost(6, 'precision')).toBe(6)
    })
    it('preciznost izven/mešano → UnitsError', () => {
      expect(() => veljavajPreciznost(-1, 'precision')).toThrow(UnitsError)
      expect(() => veljavajPreciznost(7, 'precision')).toThrow(UnitsError)
      expect(() => veljavajPreciznost(2.5, 'precision')).toThrow(UnitsError)
      expect(() => veljavajPreciznost('3', 'precision')).toThrow(UnitsError)
    })
  })

  describe('veljavajKonverzijoZaZapis — delna prisotnost (honest NULL §8)', () => {
    it('PRAZEN vhod → VSA polja null (neznano ostane neznano)', () => {
      const z = veljavajKonverzijoZaZapis({})
      expect(z.purchaseUnit).toBeNull()
      expect(z.stockUnit).toBeNull()
      expect(z.consumptionUnit).toBeNull()
      expect(z.supplierPackSize).toBeNull()
      expect(z.conversionFactor).toBeNull()
      expect(z.precision).toBeNull()
      expect(z.rounding).toBeNull()
    })
    it('DELNA prisotnost dovoljena (vsako polje neodvisno znano)', () => {
      const z = veljavajKonverzijoZaZapis({ purchaseUnit: 'paket', precision: 3 })
      expect(z.purchaseUnit).toBe('paket')
      expect(z.precision).toBe(3)
      expect(z.stockUnit).toBeNull() // ostalo iskreno neznano
    })
    it('POPOLNA veljavna konverzija preide', () => {
      const z = veljavajKonverzijoZaZapis({
        purchaseUnit: 'paket',
        stockUnit: 'm',
        consumptionUnit: 'm',
        supplierPackSize: 6,
        conversionFactor: 6,
        precision: 3,
        rounding: 'GORI',
      })
      expect(z.purchaseUnit).toBe('paket')
      expect(z.stockUnit).toBe('m')
      expect(z.consumptionUnit).toBe('m')
      expect(z.supplierPackSize).toBe(6)
      expect(z.conversionFactor).toBe(6)
      expect(z.precision).toBe(3)
      expect(z.rounding).toBe('GORI')
    })
    it("FAIL-CLOSED: 'm2' → UnitsError (NE tiha normalizacija v 'm²')", () => {
      expect(() => veljavajKonverzijoZaZapis({ purchaseUnit: 'm2' })).toThrow(/m2/)
    })
    it('faktor 0 / negativen packSize → UnitsError (ničelni faktor pokvari pretvorbo)', () => {
      expect(() => veljavajKonverzijoZaZapis({ conversionFactor: 0 })).toThrow(UnitsError)
      expect(() => veljavajKonverzijoZaZapis({ conversionFactor: -1 })).toThrow(UnitsError)
      expect(() => veljavajKonverzijoZaZapis({ supplierPackSize: 0 })).toThrow(UnitsError)
      expect(() => veljavajKonverzijoZaZapis({ supplierPackSize: -6 })).toThrow(UnitsError)
    })
    it('neveljaven rounding → UnitsError', () => {
      expect(() => veljavajKonverzijoZaZapis({ rounding: 'NAJBLIŽJE' })).toThrow(UnitsError)
    })
  })

  describe('izracunajKonverzijo — izračun zahteva POPOLNOST', () => {
    it('popolna konverzija → Konverzija objekt', () => {
      const k = izracunajKonverzijo({
        purchaseUnit: 'kos',
        stockUnit: 'kos',
        consumptionUnit: 'kos',
        supplierPackSize: 50,
        conversionFactor: 50,
        precision: 0,
        rounding: 'DOL',
      })
      expect(k).not.toBeNull()
      expect(k!.purchaseUnit).toBe('kos')
      expect(k!.rounding).toBe('DOL')
    })
    it('manjka ENO polje → null (iskreno NEIZRAČUNLJIVO — ne privzeti faktor 1)', () => {
      const skorajPopolna = {
        purchaseUnit: 'paket',
        stockUnit: 'm',
        consumptionUnit: 'm',
        supplierPackSize: 6,
        conversionFactor: 6,
        precision: 3,
        // rounding manjka
      }
      expect(izracunajKonverzijo(skorajPopolna)).toBeNull()
      expect(izracunajKonverzijo({ purchaseUnit: 'm' })).toBeNull()
      expect(izracunajKonverzijo({})).toBeNull()
    })
  })
})
