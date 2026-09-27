// R204 — zaloga-povzetek (naročilnica): enote + fail-closed + determinizem.
// ---------------------------------------------------------------------------
// (1) Struktura: glava 'Naročilnica — Zaloga pod minimumom', števec s
//     sklanjatvijo, žig 'osveženo …' iz PARAMETRA now, opcijska 'filter: X'
//     LE pri dejansko aktivnem filtru.
// (2) Vrstice: naziv (šifra): naroči k enota (zaloga z / min. m) — brez cen
//     (cenaEur je pogosto null; 'demo' ocena NE sme v dokument za
//     dobavitelja).
// (3) EN VIR RESNICE za priporočeno količino: ISTA formula kot prejšnji UI
//     (handleReorder): Math.max(min − zaloga, min).
// (4) Fail-closed: pokvaren artikel (id/naziv/šifra/enota prazni, ne-negativna
//     končna količine) ALI artikel NAD minimumom → TypeError (naročilnica
//     nikoli ne laže); ne-polje/neveljaven now → TypeError.
import { describe, expect, it } from 'vitest'
import {
  buildZalogaPovzetek,
  narociloKolicina,
  zalogaPovzetekBeseda,
  zalogaPovzetekCasOznaka,
  type ZalogaArtikelZaNarocilo,
} from '../zaloga-povzetek'

const NOW = new Date('2026-09-27T10:30:00.000Z')

const artikel = (over: Partial<ZalogaArtikelZaNarocilo> = {}): ZalogaArtikelZaNarocilo => ({
  id: 'a1',
  sifraMateriala: 'INOX-40',
  naziv: 'Inox vijak A4 8×40',
  kolicinaZaloga: 50,
  enota: 'kos',
  minimalnaZaloga: 100,
  ...over,
})

describe('zaloga-povzetek: EN VIR RESNICE — priporočena količina', () => {
  it('formula EN VIR: max(min − zaloga, min) — ista kot prejšnji UI (handleReorder)', () => {
    // deficit (50) ≥ min (100)? NE → vsaj min
    expect(narociloKolicina(artikel({ kolicinaZaloga: 50, minimalnaZaloga: 100 }))).toBe(100)
    // deficit večji od min → deficit
    expect(narociloKolicina(artikel({ kolicinaZaloga: 0, minimalnaZaloga: 100 }))).toBe(100)
    expect(
      narociloKolicina(artikel({ kolicinaZaloga: 30, minimalnaZaloga: 250 })),
    ).toBe(250)
    // točno na minimumu → vsaj min (naroči kompletno polnitev, kot je kazal UI)
    expect(narociloKolicina(artikel({ kolicinaZaloga: 100, minimalnaZaloga: 100 }))).toBe(100)
  })

  it('deljene količine ostanejo deljene (brez tihega zaokroževanja)', () => {
    expect(
      narociloKolicina(artikel({ kolicinaZaloga: 2.5, enota: 'm', minimalnaZaloga: 10 })),
    ).toBe(10)
  })
})

describe('zaloga-povzetek: glava + sklanjatev + determinizem', () => {
  it('glava + števec + žig iz parametra now; vrstica z vsemi resničnimi polji', () => {
    const tekst = buildZalogaPovzetek([artikel()], { now: NOW })
    const vrstice = tekst.split('\n')
    expect(vrstice[0]).toBe('Naročilnica — Zaloga pod minimumom')
    expect(vrstice[1]).toContain('1 artikel · osveženo ')
    expect(tekst).toContain(
      '1. Inox vijak A4 8×40 (INOX-40): naroči 100 kos (zaloga 50 / min. 100)',
    )
  })

  it('dva klica z ISTIM now = IDENTIČEN izhod (determinizem, brez skritih ur)', () => {
    const vhodi = [artikel(), artikel({ id: 'a2', sifraMateriala: 'WPC-200' })]
    const a = buildZalogaPovzetek(vhodi, { now: NOW })
    const b = buildZalogaPovzetek(vhodi, { now: NOW })
    expect(a).toBe(b)
  })

  it('sklanjatev: 1 artikel, 2 artikla, 3/4 artikli, 5/21 artiklov', () => {
    expect(zalogaPovzetekBeseda(1)).toBe('artikel')
    expect(zalogaPovzetekBeseda(2)).toBe('artikla')
    expect(zalogaPovzetekBeseda(3)).toBe('artikli')
    expect(zalogaPovzetekBeseda(4)).toBe('artikli')
    expect(zalogaPovzetekBeseda(5)).toBe('artiklov')
    expect(zalogaPovzetekBeseda(21)).toBe('artiklov')
  })

  it('kategorija se pokaže LE pri dejansko aktivnem filtru (brez izmišljenega konteksta)', () => {
    const zFilterjem = buildZalogaPovzetek([artikel()], { now: NOW, kategorija: 'WPC' })
    expect(zFilterjem).toContain(' · filter: WPC')
    const brez = buildZalogaPovzetek([artikel()], { now: NOW, kategorija: null })
    expect(brez).not.toContain('filter:')
    const prazno = buildZalogaPovzetek([artikel()], { now: NOW, kategorija: '   ' })
    expect(prazno).not.toContain('filter:')
  })

  it('prazen seznam je VELJAVEN in iskren ("Ni artiklov za naročilo.")', () => {
    const tekst = buildZalogaPovzetek([], { now: NOW })
    expect(tekst).toContain('0 artiklov · osveženo ')
    expect(tekst).toContain('Ni artiklov za naročilo.')
    expect(tekst.split('\n').length).toBe(4)
  })

  it('časovni žig: sl-SI datum + "ob HH:MM" (vzorec R167/R203); pokvaren now → TypeError', () => {
    const oznaka = zalogaPovzetekCasOznaka(NOW)
    expect(oznaka).toMatch(/^27\. 09\. 2026 ob \d{2}:\d{2}$/)
    expect(() => zalogaPovzetekCasOznaka(new Date('ne-datum'))).toThrow(TypeError)
    expect(() => zalogaPovzetekCasOznaka('x' as unknown as Date)).toThrow(TypeError)
  })
})

describe('zaloga-povzetek: fail-closed (naročilnica NIKOLI ne laže)', () => {
  it('artikel NAD minimumom → TypeError (dokument trdi "pod minimumom")', () => {
    expect(() =>
      buildZalogaPovzetek([artikel({ kolicinaZaloga: 150, minimalnaZaloga: 100 })], { now: NOW }),
    ).toThrow(TypeError)
  })

  it('negativna / NaN / neskončna količina → TypeError (fizične vrednosti)', () => {
    expect(() => buildZalogaPovzetek([artikel({ kolicinaZaloga: -1 })], { now: NOW })).toThrow(
      TypeError,
    )
    expect(() =>
      buildZalogaPovzetek([artikel({ minimalnaZaloga: Number.NaN })], { now: NOW }),
    ).toThrow(TypeError)
    expect(() =>
      buildZalogaPovzetek([artikel({ kolicinaZaloga: Number.POSITIVE_INFINITY })], { now: NOW }),
    ).toThrow(TypeError)
  })

  it('prazen id / naziv / šifra / enota → TypeError (dokument brez polpdatkov)', () => {
    expect(() => buildZalogaPovzetek([artikel({ id: '  ' })], { now: NOW })).toThrow(TypeError)
    expect(() => buildZalogaPovzetek([artikel({ naziv: '' })], { now: NOW })).toThrow(TypeError)
    expect(() =>
      buildZalogaPovzetek([artikel({ sifraMateriala: ' ' })], { now: NOW }),
    ).toThrow(TypeError)
    expect(() => buildZalogaPovzetek([artikel({ enota: '' })], { now: NOW })).toThrow(TypeError)
  })

  it('ne-polje / ne-objekt opcije / neveljaven now → TypeError', () => {
    expect(() =>
      buildZalogaPovzetek('ne-polje' as unknown as ZalogaArtikelZaNarocilo[], { now: NOW }),
    ).toThrow(TypeError)
    expect(() =>
      buildZalogaPovzetek([artikel()], null as unknown as { now: Date }),
    ).toThrow(TypeError)
    expect(() =>
      buildZalogaPovzetek([artikel()], { now: new Date('pokvaren') }),
    ).toThrow(TypeError)
  })
})
