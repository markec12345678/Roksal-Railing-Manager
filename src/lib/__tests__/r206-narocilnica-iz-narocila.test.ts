// R206 F2 — buildNarocilnicaIzNarocila (zaloga-povzetek): dokument iz
// SLEDLJIVEGA naročila (Material → Naročila).
// ---------------------------------------------------------------------------
// Pogodba:
//  • Glava 'Naročilnica — {dobavitelj}' + števec s sklanjatvijo + 'osveženo'
//    žig (now KOT parameter — determinizem) + vrstice 'i. naziv: količina enota'
//    + opcijska 'Opomba: …'.
//  • BREZ VREDNOSTI IZ UI (družinsko pravilo R204): dokument ne vsebuje € ali
//    vrednosti — mešanica realnih in manjkajočih (0) bi zavajala.
//  • Fail-closed: prazen dobavitelj, naročilo BREZ postavk, pokvarena
//    postavka → TypeError (dokument ne sme nastajati iz praznine).
import { describe, expect, it } from 'vitest'
import {
  buildNarocilnicaIzNarocila,
  narociloPostavkaBeseda,
  type NarociloZaDokument,
} from '../zaloga-povzetek'

const ZDAJ = new Date('2026-09-27T10:15:00')

const narocilo = (pre?: Partial<NarociloZaDokument>): NarociloZaDokument => ({
  supplier: { naziv: 'Lesna Plastika d.o.o.' },
  items: [
    { naziv: 'Inox Vijak M12 A4', kolicina: 50, enota: 'kos' },
    { naziv: 'WPC Deska 128', kolicina: 12, enota: 'm' },
  ],
  opombe: 'dostava do petka',
  ...pre,
})

describe('R206 buildNarocilnicaIzNarocila — oblika dokumenta', () => {
  it('glava + števec + vrstice + opomba (celotna struktura)', () => {
    const t = buildNarocilnicaIzNarocila(narocilo(), { now: ZDAJ })
    const vrstice = t.split('\n')
    expect(vrstice[0]).toBe('Naročilnica — Lesna Plastika d.o.o.')
    expect(vrstice[1]).toMatch(/^2 postavki · osveženo 27\. 09\. 2026 ob \d{2}:\d{2}$/)
    expect(vrstice[3]).toBe('1. Inox Vijak M12 A4: 50 kos')
    expect(vrstice[4]).toBe('2. WPC Deska 128: 12 m')
    expect(t.endsWith('Opomba: dostava do petka')).toBe(true)
  })

  it('brez opomb → ni vrstice Opomba; prazne/belinske opombe so izgniščene', () => {
    const t1 = buildNarocilnicaIzNarocila(narocilo({ opombe: null }), { now: ZDAJ })
    expect(t1).not.toContain('Opomba:')
    const t2 = buildNarocilnicaIzNarocila(narocilo({ opombe: '   ' }), { now: ZDAJ })
    expect(t2).not.toContain('Opomba:')
  })

  it('BREZ vrednosti iz UI: dokument ne vsebuje € ne vrednosti', () => {
    const t = buildNarocilnicaIzNarocila(narocilo(), { now: ZDAJ })
    expect(t).not.toContain('€')
    expect(t).not.toContain('cena')
    expect(t).not.toContain('Cena')
  })

  it('besedilna polja so obrezana (dobavitelj, naziv, enota, opomba)', () => {
    const t = buildNarocilnicaIzNarocila(
      narocilo({
        supplier: { naziv: '  Dobavitelj X  ' },
        items: [{ naziv: '  Vijak  ', kolicina: 3, enota: '  kos  ' }],
        opombe: '  hitro  ',
      }),
      { now: ZDAJ },
    )
    expect(t).toContain('Naročilnica — Dobavitelj X')
    expect(t).toContain('1. Vijak: 3 kos')
    expect(t).toContain('Opomba: hitro')
  })

  it('determinizem: isti now → bajtno enako besedilo (2 klica)', () => {
    expect(buildNarocilnicaIzNarocila(narocilo(), { now: ZDAJ })).toBe(
      buildNarocilnicaIzNarocila(narocilo(), { now: ZDAJ }),
    )
  })
})

describe('R206 narociloPostavkaBeseda — sklanjatev', () => {
  it('1 postavka / 2 postavki / 3-4 postavke / 5+ postavk', () => {
    expect(narociloPostavkaBeseda(1)).toBe('postavka')
    expect(narociloPostavkaBeseda(2)).toBe('postavki')
    expect(narociloPostavkaBeseda(3)).toBe('postavke')
    expect(narociloPostavkaBeseda(4)).toBe('postavke')
    expect(narociloPostavkaBeseda(5)).toBe('postavk')
  })

  it('ne-celo / negativno število → TypeError', () => {
    expect(() => narociloPostavkaBeseda(1.5)).toThrow(TypeError)
    expect(() => narociloPostavkaBeseda(-1)).toThrow(TypeError)
  })
})

describe('R206 buildNarocilnicaIzNarocila — fail-closed', () => {
  it('naročilo BREZ postavk → TypeError (dokument ne sme nastajati iz praznine)', () => {
    expect(() => buildNarocilnicaIzNarocila(narocilo({ items: [] }), { now: ZDAJ })).toThrow(TypeError)
  })

  it('prazen dobavitelj / manjkajoč supplier → TypeError', () => {
    expect(() =>
      buildNarocilnicaIzNarocila(narocilo({ supplier: { naziv: '  ' } }), { now: ZDAJ }),
    ).toThrow(TypeError)
    expect(() =>
      buildNarocilnicaIzNarocila(narocilo({ supplier: undefined as unknown as { naziv: string } }), { now: ZDAJ }),
    ).toThrow(TypeError)
  })

  it('pokvarena postavka → TypeError (prazen naziv / enota / količina ≤ 0 / NaN / ne-objekt)', () => {
    expect(() =>
      buildNarocilnicaIzNarocila(narocilo({ items: [{ naziv: ' ', kolicina: 1, enota: 'kos' }] }), { now: ZDAJ }),
    ).toThrow(TypeError)
    expect(() =>
      buildNarocilnicaIzNarocila(narocilo({ items: [{ naziv: 'X', kolicina: 1, enota: '' }] }), { now: ZDAJ }),
    ).toThrow(TypeError)
    expect(() =>
      buildNarocilnicaIzNarocila(narocilo({ items: [{ naziv: 'X', kolicina: 0, enota: 'kos' }] }), { now: ZDAJ }),
    ).toThrow(TypeError)
    expect(() =>
      buildNarocilnicaIzNarocila(narocilo({ items: [{ naziv: 'X', kolicina: -2, enota: 'kos' }] }), { now: ZDAJ }),
    ).toThrow(TypeError)
    expect(() =>
      buildNarocilnicaIzNarocila(narocilo({ items: [{ naziv: 'X', kolicina: Number.NaN, enota: 'kos' }] }), { now: ZDAJ }),
    ).toThrow(TypeError)
    expect(() =>
      buildNarocilnicaIzNarocila(
        narocilo({ items: [null as unknown as { naziv: string; kolicina: number; enota: string }] }),
        { now: ZDAJ },
      ),
    ).toThrow(TypeError)
  })

  it('pokvaren now / ne-objekt naročilo → TypeError', () => {
    expect(() =>
      buildNarocilnicaIzNarocila(narocilo(), { now: new Date('neveljaven') }),
    ).toThrow(TypeError)
    expect(() =>
      buildNarocilnicaIzNarocila(null as unknown as NarociloZaDokument, { now: ZDAJ }),
    ).toThrow(TypeError)
  })
})
