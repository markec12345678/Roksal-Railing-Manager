// R205 F2 — narocilnicaCsvVrstice (zaloga-povzetek): CSV priloga naročilnice.
// ---------------------------------------------------------------------------
// Pogodba:
//  • EN VIR RESNICE: količina = narociloKolicina (ISTA formula kot odložišče
//    R204 / POST osnutka R205) — testi dokazujejo enakost z formula.
//  • Oblika vrstice: [šifra, naziv, enota, zaloga, min. zaloga, naroči] —
//    natanko 6 polj, BREZ vrednosti iz UI ('demo' ocene NE smejo v dokument
//    za dobavitelja — pravilo R204).
//  • Fail-closed: isti pogodbi kot buildZalogaPovzetek (narociloKolicina
//    poganja preveriArtikel) — pokvaren vnos → TypeError, NIKOLI tihe vrstice.
//  • Determinizem: čista funkcija (brez ure, brez naključja).
import { describe, expect, it } from 'vitest'
import { narocilnicaCsvVrstice, type ZalogaArtikelZaNarocilo } from '../zaloga-povzetek'

const artikel = (pre: Partial<ZalogaArtikelZaNarocilo>): ZalogaArtikelZaNarocilo => ({
  id: 'inv-1',
  sifraMateriala: 'INOX-M12-A4',
  naziv: 'Inox Vijak M12 A4',
  kolicinaZaloga: 15,
  enota: 'kos',
  minimalnaZaloga: 50,
  ...pre,
})

describe('R205 narocilnicaCsvVrstice — EN VIR RESNICE (formula)', () => {
  it('naroči = Math.max(min − zaloga, min) — ista formula kot odložišče R204', () => {
    // zaloga 15 / min 50 → max(35, 50) = 50
    expect(narocilnicaCsvVrstice([artikel({})])).toEqual([
      ['INOX-M12-A4', 'Inox Vijak M12 A4', 'kos', 15, 50, 50],
    ])
    // zaloga 0 / min 20 → max(20, 20) = 20
    expect(narocilnicaCsvVrstice([artikel({ id: 'x', kolicinaZaloga: 0, minimalnaZaloga: 20 })])).toEqual([
      ['INOX-M12-A4', 'Inox Vijak M12 A4', 'kos', 0, 20, 20],
    ])
    // zaloga = min (meja isLow) → max(0, min) = min
    expect(narocilnicaCsvVrstice([artikel({ id: 'y', kolicinaZaloga: 50, minimalnaZaloga: 50 })])).toEqual([
      ['INOX-M12-A4', 'Inox Vijak M12 A4', 'kos', 50, 50, 50],
    ])
  })

  it('deljene količine ostanejo brez zaokroževanja (ISTI razred vrednosti kot lib)', () => {
    const vrstice = narocilnicaCsvVrstice([
      artikel({ id: 'z', kolicinaZaloga: 2.5, minimalnaZaloga: 7.5 }),
    ])
    expect(vrstice[0][3]).toBe(2.5)
    expect(vrstice[0][4]).toBe(7.5)
    expect(vrstice[0][5]).toBe(7.5) // max(5, 7.5) = 7.5
  })

  it('dva artikla → dve vrstici v VHODNEM vrstnem redu (deterministično)', () => {
    const vrstice = narocilnicaCsvVrstice([
      artikel({}),
      artikel({ id: 'b', sifraMateriala: 'WPC-D1', naziv: 'WPC Deska', kolicinaZaloga: 3, minimalnaZaloga: 12, enota: 'm' }),
    ])
    expect(vrstice).toHaveLength(2)
    expect(vrstice[1]).toEqual(['WPC-D1', 'WPC Deska', 'm', 3, 12, 12])
  })

  it('determinizem: ista vhodna data = ista vrstica (dva klica, deep equal)', () => {
    const a = narocilnicaCsvVrstice([artikel({})])
    const b = narocilnicaCsvVrstice([artikel({})])
    expect(a).toEqual(b)
  })
})

describe('R205 narocilnicaCsvVrstice — oblika (brez vrednosti iz UI)', () => {
  it('natanko 6 polj: šifra, naziv, enota, zaloga, min. zaloga, naroči', () => {
    const vrstica = narocilnicaCsvVrstice([artikel({})])[0]
    expect(vrstica).toHaveLength(6)
    expect(vrstica[0]).toBe('INOX-M12-A4')
    expect(vrstica[1]).toBe('Inox Vijak M12 A4')
    expect(vrstica[2]).toBe('kos')
    expect(typeof vrstica[3]).toBe('number')
    expect(typeof vrstica[4]).toBe('number')
    expect(typeof vrstica[5]).toBe('number')
  })

  it('besedilna polja so obrezana (trim) — determinističen zapis', () => {
    const vrstica = narocilnicaCsvVrstice([
      artikel({ sifraMateriala: '  S1  ', naziv: '  Naziv  ', enota: '  kos  ' }),
    ])[0]
    expect(vrstica[0]).toBe('S1')
    expect(vrstica[1]).toBe('Naziv')
    expect(vrstica[2]).toBe('kos')
  })

  it('prazen seznam → prazne vrstice (iskreno prazna priloga)', () => {
    expect(narocilnicaCsvVrstice([])).toEqual([])
  })

  it('ne-polje → TypeError (fail-closed)', () => {
    expect(() => narocilnicaCsvVrstice(null as unknown as ZalogaArtikelZaNarocilo[])).toThrow(TypeError)
    expect(() => narocilnicaCsvVrstice('ne' as unknown as ZalogaArtikelZaNarocilo[])).toThrow(TypeError)
  })
})

describe('R205 narocilnicaCsvVrstice — fail-closed (isti pogodbi kot R204)', () => {
  it('artikel NAD minimumom → TypeError (priloga nikoli ne laže)', () => {
    expect(() =>
      narocilnicaCsvVrstice([artikel({ kolicinaZaloga: 60, minimalnaZaloga: 50 })]),
    ).toThrow(TypeError)
  })

  it('prazna šifra / prazen naziv → TypeError', () => {
    expect(() => narocilnicaCsvVrstice([artikel({ sifraMateriala: '  ' })])).toThrow(TypeError)
    expect(() => narocilnicaCsvVrstice([artikel({ naziv: '' })])).toThrow(TypeError)
  })

  it('ne-končna / negativna količina → TypeError', () => {
    expect(() => narocilnicaCsvVrstice([artikel({ kolicinaZaloga: Number.NaN })])).toThrow(TypeError)
    expect(() => narocilnicaCsvVrstice([artikel({ kolicinaZaloga: -1 })])).toThrow(TypeError)
    expect(() => narocilnicaCsvVrstice([artikel({ minimalnaZaloga: Number.POSITIVE_INFINITY })])).toThrow(TypeError)
  })

  it('prazen id / ne-objekt → TypeError', () => {
    expect(() => narocilnicaCsvVrstice([artikel({ id: '' })])).toThrow(TypeError)
    expect(() => narocilnicaCsvVrstice([null as unknown as ZalogaArtikelZaNarocilo])).toThrow(TypeError)
  })
})
