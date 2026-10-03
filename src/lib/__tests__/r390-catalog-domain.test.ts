// R390 — ČISTO JEDRO PRODUKTNEGA KATALOGA (issue #13, korak R170 iz §14).
// ---------------------------------------------------------------------------
//   • §14 nabor aplikacij EXACT (6) + oznake + fail-closed validacije;
//   • orientacije/kategorije/pravice EXACT;
//   • maxRazmakMm: pozitiven cel ALI null (§8);
//   • matrika prehodov verzije DRAFT → ACTIVE → RETIRED (terminalno);
//   • resolveAktivnaVerzija: as-of resolucija, več ACTIVE = napaka, brez
//     ACTIVE = null, pred veljavnostjo / po preklicu = null;
//   • intervalaSePrekrivata: odprti/zaprti/sosednji intervali;
//   • zapriInterval: preklic pred začetkom = napaka;
//   • kompatibilnost: XOR natanko en cilj + samo-kompatibilnost;
//   • preberiJsonKolona: veljavno/pokvarjen JSON/napačna shema;
//   • VIR modula: catalog-domain NE uvaža db (stražar).
import { describe, expect, it } from 'vitest'
import {
  APLIKACIJE,
  APLIKACIJE_OZNAKE,
  KATEGORIJE_PRODUKTOV,
  KATALOG_PREHODI,
  KATALOG_STATUSES,
  ORIENTACIJE,
  PRAVICE,
  allowedKatalogTransitions,
  barvnaPaletaSchema,
  intervalaSePrekrivata,
  jeSamoKompatibilnost,
  kompatibilnostImaNatankoEnCilj,
  preberiJsonKolono,
  razmakKvalifikatorjiSchema,
  resolveAktivnaVerzija,
  rocajSchema,
  splosnaPravilaSchema,
  standardLengthsSchema,
  validateAplikacija,
  validateKategorija,
  validateMaxRazmakMm,
  validateOrientacija,
  validatePravice,
  viriSchema,
  zapriInterval,
  type KatalogVerzijaInterval,
} from '@/lib/catalog-domain'

describe('R390 — catalog-domain: §14 nabori EXACT', () => {
  it('aplikacije = §14 EXACT 6 (horizontalna/pokončna ograja, terasa, predelna, fasada, strop)', () => {
    expect(APLIKACIJE).toEqual([
      'HORIZONTALNA_OGRAJA',
      'POKONCNA_OGRAJA',
      'TERASA',
      'PREDELNA_STENA',
      'FASADA',
      'STROP',
    ])
  })

  it('oznake pokrivajo VSE aplikacije (UI besednjak iz ENega vira)', () => {
    for (const a of APLIKACIJE) {
      expect(typeof APLIKACIJE_OZNAKE[a]).toBe('string')
      expect(APLIKACIJE_OZNAKE[a].length).toBeGreaterThan(3)
    }
  })

  it('orientacije = SDK pariteta (horizontal | vertical)', () => {
    expect(ORIENTACIJE).toEqual(['horizontal', 'vertical'])
  })

  it('kategorije produktov EXACT iz kataloga', () => {
    expect(KATEGORIJE_PRODUKTOV).toEqual(['precna', 'pokoncna', 'precna+pokoncna'])
  })

  it('pravice = SDK RightsStatus pariteta (pending | granted | rejected)', () => {
    expect(PRAVICE).toEqual(['pending', 'granted', 'rejected'])
  })
})

describe('R390 — catalog-domain: fail-closed validacije', () => {
  it('validateAplikacija: neznan tip → napaka s seznamom (NE tiha normalizacija)', () => {
    const res = validateAplikacija('BALKON')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('POKONCNA_OGRAJA')
    expect(validateAplikacija('FASADA')).toEqual({ ok: true, value: 'FASADA' })
    expect(validateAplikacija(42).ok).toBe(false)
    expect(validateAplikacija(null).ok).toBe(false)
  })

  it('validateOrientacija: neznan → napaka; veljaven → value', () => {
    expect(validateOrientacija('diagonalna').ok).toBe(false)
    expect(validateOrientacija('vertical')).toEqual({ ok: true, value: 'vertical' })
  })

  it('validateKategorija: EXACT — "prečna" lowercase se ZAVRNE', () => {
    expect(validateKategorija('prečna').ok).toBe(false)
    expect(validateKategorija('precna')).toEqual({ ok: true, value: 'precna' })
  })

  it('validatePravice: neznan → napaka', () => {
    expect(validatePravice('unknown').ok).toBe(false)
    expect(validatePravice('granted')).toEqual({ ok: true, value: 'granted' })
  })

  it('validateMaxRazmakMm: pozitiven cel OK; 0/negativen/decimal/NaN → napaka; null OK (§8)', () => {
    expect(validateMaxRazmakMm(1450)).toEqual({ ok: true, value: 1450 })
    expect(validateMaxRazmakMm(null)).toEqual({ ok: true, value: null })
    expect(validateMaxRazmakMm(0).ok).toBe(false)
    expect(validateMaxRazmakMm(-5).ok).toBe(false)
    expect(validateMaxRazmakMm(12.5).ok).toBe(false)
    expect(validateMaxRazmakMm('1450').ok).toBe(false)
  })
})

describe('R390 — catalog-domain: statusni stroj verzije (pariteta R373)', () => {
  it('statusi: DRAFT | ACTIVE | RETIRED', () => {
    expect(KATALOG_STATUSES).toEqual(['DRAFT', 'ACTIVE', 'RETIRED'])
  })

  it('matrika: DRAFT→[ACTIVE], ACTIVE→[RETIRED], RETIRED terminalno', () => {
    expect(KATALOG_PREHODI.DRAFT).toEqual(['ACTIVE'])
    expect(KATALOG_PREHODI.ACTIVE).toEqual(['RETIRED'])
    expect(KATALOG_PREHODI.RETIRED).toEqual([])
    expect(allowedKatalogTransitions('RETIRED')).toEqual([])
    expect(allowedKatalogTransitions('NEZNAN')).toEqual([])
  })
})

describe('R390 — catalog-domain: resolveAktivnaVerzija (§14 effective dates)', () => {
  const base = new Date('2026-10-08T08:00:00.000Z')
  const v = (
    id: string,
    verzija: number,
    status: string,
    od: Date,
    do_: Date | null,
  ): KatalogVerzijaInterval => ({ id, verzija, status, veljavnostOd: od, veljavnostDo: do_ })

  it('aktivna verzija znotraj intervala → najdena', () => {
    const res = resolveAktivnaVerzija(
      [v('a', 1, 'ACTIVE', new Date('2026-01-01'), null)],
      base,
    )
    expect(res && 'verzija' in res && res.verzija.id).toBe('a')
  })

  it('zaprt interval v preteklosti → null (ne velja več)', () => {
    const res = resolveAktivnaVerzija(
      [v('a', 1, 'ACTIVE', new Date('2026-01-01'), new Date('2026-06-01'))],
      base,
    )
    expect(res).toBeNull()
  })

  it('veljavnostOd v prihodnosti → null (še ne začela veljati)', () => {
    const res = resolveAktivnaVerzija(
      [v('a', 1, 'ACTIVE', new Date('2026-12-01'), null)],
      base,
    )
    expect(res).toBeNull()
  })

  it('brez ACTIVE (samo DRAFT/RETIRED) → null', () => {
    const res = resolveAktivnaVerzija(
      [v('a', 1, 'DRAFT', new Date('2026-01-01'), null), v('b', 2, 'RETIRED', new Date('2026-01-01'), null)],
      base,
    )
    expect(res).toBeNull()
  })

  it('DVE ACTIVE hkrati → POKVARJENO stanje (javna napaka, NE "izberi prvo")', () => {
    const res = resolveAktivnaVerzija(
      [v('a', 1, 'ACTIVE', new Date('2026-01-01'), null), v('b', 2, 'ACTIVE', new Date('2026-02-01'), null)],
      base,
    )
    expect(res && 'napaka' in res).toBe(true)
    if (res && 'napaka' in res) expect(res.napaka).toContain('2 ACTIVE')
  })

  it('mejna točka veljavnostDo = asOf → NE velja več ([od, do) polodprto)', () => {
    const res = resolveAktivnaVerzija(
      [v('a', 1, 'ACTIVE', new Date('2026-01-01'), base)],
      base,
    )
    expect(res).toBeNull()
  })
})

describe('R390 — catalog-domain: intervali preslikav dobaviteljev', () => {
  it('odprta intervala se prekrivata', () => {
    expect(
      intervalaSePrekrivata(
        { od: new Date('2026-01-01'), do: null },
        { od: new Date('2026-06-01'), do: null },
      ),
    ).toBe(true)
  })

  it('zaprt pred drugim → NI prekrivanje', () => {
    expect(
      intervalaSePrekrivata(
        { od: new Date('2026-01-01'), do: new Date('2026-03-01') },
        { od: new Date('2026-03-01'), do: null },
      ),
    ).toBe(false)
  })

  it('delno prekrivanje → prekrivanje', () => {
    expect(
      intervalaSePrekrivata(
        { od: new Date('2026-01-01'), do: new Date('2026-06-01') },
        { od: new Date('2026-05-01'), do: null },
      ),
    ).toBe(true)
  })

  it('zapriInterval pred začetkom → napaka; sicer do = asOf', () => {
    const slabo = zapriInterval(new Date('2026-06-01'), new Date('2026-01-01'))
    expect('napaka' in slabo).toBe(true)
    const dobro = zapriInterval(new Date('2026-01-01'), new Date('2026-06-01'))
    expect('do' in dobro && dobro.do.toISOString()).toBe('2026-06-01T00:00:00.000Z')
  })
})

describe('R390 — catalog-domain: kompatibilnost (§14 XOR)', () => {
  it('natanko EN cilj — produkt ALI dodatek', () => {
    expect(kompatibilnostImaNatankoEnCilj({ kompatibilenProductId: 'p', kompatibilenDodatekId: null })).toBe(true)
    expect(kompatibilnostImaNatankoEnCilj({ kompatibilenProductId: null, kompatibilenDodatekId: 'd' })).toBe(true)
    expect(kompatibilnostImaNatankoEnCilj({ kompatibilenProductId: null, kompatibilenDodatekId: null })).toBe(false)
    expect(kompatibilnostImaNatankoEnCilj({ kompatibilenProductId: 'p', kompatibilenDodatekId: 'd' })).toBe(false)
  })

  it('samo-kompatibilnost = nesmisel', () => {
    expect(jeSamoKompatibilnost('p', { kompatibilenProductId: 'p', kompatibilenDodatekId: null })).toBe(true)
    expect(jeSamoKompatibilnost('p', { kompatibilenProductId: 'q', kompatibilenDodatekId: null })).toBe(false)
  })
})

describe('R390 — catalog-domain: JSON kolone (zod)', () => {
  it('preberiJsonKolono: veljaven JSON → value; pokvarjen → napaka; napačna shema → napaka', () => {
    const ok = preberiJsonKolono('[5800,2200]', standardLengthsSchema, 'standardLengthsMm')
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.value).toEqual([5800, 2200])
    expect(preberiJsonKolono('[5800,', standardLengthsSchema, 'x').ok).toBe(false)
    expect(preberiJsonKolono('[]', standardLengthsSchema, 'x').ok).toBe(false) // min(1)
    expect(preberiJsonKolono('[-1]', standardLengthsSchema, 'x').ok).toBe(false)
  })

  it('barvnaPaletaSchema: approxHex null dovoljen (§8), hex format STROG', () => {
    expect(
      barvnaPaletaSchema.safeParse([{ id: 'grey', name: 'Grey', nameSl: 'Siva', approxHex: null, evidence: 'vir' }]).success,
    ).toBe(true)
    expect(
      barvnaPaletaSchema.safeParse([{ id: 'grey', name: 'Grey', nameSl: 'Siva', approxHex: 'gray', evidence: 'vir' }]).success,
    ).toBe(false)
  })

  it('rocajSchema: available obvezen; screwsVisible neobvezen', () => {
    expect(rocajSchema.safeParse({ available: false }).success).toBe(true)
    expect(rocajSchema.safeParse({ available: true, dimensionMm: [92, 45, 5800] }).success).toBe(true)
    expect(rocajSchema.safeParse({}).success).toBe(false)
  })

  it('viriSchema: neprazen seznam URL-jev', () => {
    expect(viriSchema.safeParse(['https://roksal.com']).success).toBe(true)
    expect(viriSchema.safeParse([]).success).toBe(false)
    expect(viriSchema.safeParse(['ni-url']).success).toBe(false)
  })

  it('razmakKvalifikatorjiSchema + splosnaPravilaSchema oblike', () => {
    expect(razmakKvalifikatorjiSchema.safeParse([{ key: 'verticalOver150Cm', maxSpacingMm: 1500 }]).success).toBe(true)
    expect(razmakKvalifikatorjiSchema.safeParse([{ key: 'x', maxSpacingMm: 0 }]).success).toBe(false)
    expect(splosnaPravilaSchema.safeParse(['pravilo 1']).success).toBe(true)
  })
})

describe('R390 — catalog-domain: VIR modula (stražar — čisto jedro brez IO)', () => {
  it('NE uvaža db/next/server (determinizem jedra)', async () => {
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync('src/lib/catalog-domain.ts', 'utf8'),
    )
    expect(source).not.toMatch(/from\s+'@\/lib\/db'/)
    expect(source).not.toMatch(/from\s+'next\/server'/)
    expect(source).not.toMatch(/from\s+'@\/lib\/audit'/)
  })
})
