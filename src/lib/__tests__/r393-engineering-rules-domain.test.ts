// R393 — ČISTO JEDRO engineering-rules (issue #13, korak R171 iz §15).
// ---------------------------------------------------------------------------
//   • §15 EXACT nabori (kategorije/viri/overitve/statusi) + fail-closed
//     validacije z javnimi seznami (kanon §5 — brez tihe normalizacije);
//   • LOČITEV (§15): jeUradnoPreverjeno truth-table — nepreverjeno NI nikoli
//     uradno; uradno ZAHTEVA reviewedAt + reviewerId; pokvarjene kombinacije
//     (overitev PROJEKTANTSKA brez pregleda) → false;
//   • preveriUradnoOveritev guard (uporabljen v store na OBEH točkah);
//   • statusni stroj DRAFT→ACTIVE→RETIRED (matrika EXACT, terminalni RETIRED);
//   • intervali + as-of resolucija (pariteta catalog-domain R390);
//   • povzetekSkladnosti — odkrito število uradno preverjenih (0 za seed);
//   • calculatorVerzija pariteta z CALC_FORMULA_VERSIONS (calc-engineering R150).
import { describe, expect, it } from 'vitest'
import { CALC_FORMULA_VERSIONS } from '@/lib/calc-engineering'
import {
  KATEGORIJE_OZNAKE,
  KATEGORIJE_PRAVIL,
  OVERITVE,
  PREHODI_VERZIJ,
  SKLADNOST_OPOZORILO,
  STATUSI_VERZIJ,
  VIRI_PRAVIL,
  allowedPrehodiVerzije,
  intervalaSePrekrivata,
  jeUradnoPreverjeno,
  povzetekSkladnosti,
  preveriUradnoOveritev,
  razredIzpisa,
  resolveAktivnaVerzijoPravila,
  strukturaPravilaSchema,
  validateAplikacijoPravila,
  validateKategorijo,
  validateOrientacijoPravila,
  validateOveritev,
  validateStatusVerzije,
  validateVir,
  zapriIntervalPravila,
} from '@/lib/engineering-rules'

const uradna = (overitev: string) => ({
  overitev,
  reviewedAt: new Date('2026-10-09T08:00:00Z'),
  reviewerId: 'profil-pregledovalec-1',
})

describe('R393 — §15 EXACT nabori (fail-closed, javni seznami)', () => {
  it('kategorije: natanko 5 + slovenske oznake za vse', () => {
    expect(KATEGORIJE_PRAVIL).toHaveLength(5)
    for (const k of KATEGORIJE_PRAVIL) expect(typeof KATEGORIJE_OZNAKE[k]).toBe('string')
  })

  it('viri: natanko 4 (katalog/uradni standard/interni/sekundarni)', () => {
    expect(VIRI_PRAVIL).toHaveLength(4)
    expect(VIRI_PRAVIL).toContain('SEKUNDARNI_VIR')
  })

  it('overitve: natanko 3 — LOČITEV informativno/projektantsko/statično', () => {
    expect(OVERITVE).toHaveLength(3)
    expect(OVERITVE[0]).toBe('INFORMATIVNO')
  })

  it('statusi: DRAFT/ACTIVE/RETIRED (pariteta R373/R390)', () => {
    expect(STATUSI_VERZIJ).toEqual(['DRAFT', 'ACTIVE', 'RETIRED'])
  })

  it.each([
    ['validateKategorijo', validateKategorijo],
    ['validateVir', validateVir],
    ['validateOveritev', validateOveritev],
    ['validateStatusVerzije', validateStatusVerzije],
  ])('%s: neznan vnos → javna napaka SEZNAMOM (fail-closed)', (_ime, fn) => {
    const res = fn('NEVELJAVEN_XYZ')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('NEVELJAVEN_XYZ')
    if (!res.ok) expect(res.error).toContain('dovoljen')
  })

  it('aplikacija: §14 EXACT 6 + NULL = splošno (veljavno)', () => {
    expect(validateAplikacijoPravila('FASADA')).toEqual({ ok: true, value: 'FASADA' })
    expect(validateAplikacijoPravila(null)).toEqual({ ok: true, value: null })
    expect(validateAplikacijoPravila('NEOBAJA').ok).toBe(false)
  })

  it('orientacija: horizontal|vertical + NULL (veljavno)', () => {
    expect(validateOrientacijoPravila('vertical')).toEqual({ ok: true, value: 'vertical' })
    expect(validateOrientacijoPravila(null)).toEqual({ ok: true, value: null })
    expect(validateOrientacijoPravila('diagonalno').ok).toBe(false)
  })
})

describe('R393 — §15 LOČITEV: jeUradnoPreverjeno / razredIzpisa', () => {
  it('INFORMATIVNO NI nikoli uradno (tudi z lažnim pregledom)', () => {
    expect(jeUradnoPreverjeno(uradna('INFORMATIVNO'))).toBe(false)
    expect(razredIzpisa(uradna('INFORMATIVNO'))).toBe('INFORMATIVNO')
  })

  it('PROJEKTANTSKA/STATISTICNA S pregledom = uradno', () => {
    expect(jeUradnoPreverjeno(uradna('PROJEKTANTSKA'))).toBe(true)
    expect(razredIzpisa(uradna('STATISTICNA'))).toBe('URADNO')
  })

  it('PROJEKTANTSKA/STATISTICNA BREZ pregleda = NI uradno (fail-closed)', () => {
    expect(jeUradnoPreverjeno({ overitev: 'PROJEKTANTSKA', reviewedAt: null, reviewerId: null })).toBe(false)
    expect(jeUradnoPreverjeno({ overitev: 'STATISTICNA', reviewedAt: new Date(), reviewerId: null })).toBe(false)
    expect(jeUradnoPreverjeno({ overitev: 'STATISTICNA', reviewedAt: null, reviewerId: 'x' })).toBe(false)
    expect(razredIzpisa({ overitev: 'PROJEKTANTSKA', reviewedAt: null, reviewerId: null })).toBe('INFORMATIVNO')
  })

  it('neveljavna overitev = NI uradno (nepoznan nabor ne sme zraditi uradno)', () => {
    expect(jeUradnoPreverjeno(uradna('URADNO_KAR_NEKAK'))).toBe(false)
  })
})

describe('R393 — preveriUradnoOveritev guard (obe točki: create + activate)', () => {
  it('INFORMATIVNO → null (dovoljeno brez pregleda — seed resnica)', () => {
    expect(preveriUradnoOveritev('INFORMATIVNO', null, null)).toBeNull()
  })

  it('PROJEKTANTSKA brez pregledalca → javna §15 napaka', () => {
    const napaka = preveriUradnoOveritev('PROJEKTANTSKA', null, new Date())
    expect(napaka).toContain('SAMO INFORMATIVNO')
  })

  it('STATISTICNA brez datuma pregleda → javna §15 napaka', () => {
    const napaka = preveriUradnoOveritev('STATISTICNA', 'profil-1', null)
    expect(napaka).toContain('reviewedAt')
  })

  it('uradno S pregledom → null (dovoljeno)', () => {
    expect(preveriUradnoOveritev('PROJEKTANTSKA', 'profil-1', new Date())).toBeNull()
    expect(preveriUradnoOveritev('STATISTICNA', 'profil-1', new Date())).toBeNull()
  })

  it('neveljavna overitev → napaka z seznamom nabora', () => {
    expect(preveriUradnoOveritev('URADNO', 'x', new Date())).toContain('dovoljene')
  })
})

describe('R393 — statusni stroj verzij (matrika = PODATEK)', () => {
  it('DRAFT → ACTIVE → RETIRED; RETIRED terminalen', () => {
    expect(PREHODI_VERZIJ.DRAFT).toEqual(['ACTIVE'])
    expect(PREHODI_VERZIJ.ACTIVE).toEqual(['RETIRED'])
    expect(PREHODI_VERZIJ.RETIRED).toEqual([])
  })

  it('allowedPrehodiVerzije: neznan status → prazno (fail-closed)', () => {
    expect(allowedPrehodiVerzije('NEZNAN')).toEqual([])
  })
})

describe('R393 — intervali + as-of resolucija (pariteta R390)', () => {
  it('intervalaSePrekrivata: odprti se prekrivata; sosednja NE', () => {
    expect(intervalaSePrekrivata({ od: new Date('2026-01-01'), do: null }, { od: new Date('2026-06-01'), do: null })).toBe(true)
    expect(intervalaSePrekrivata({ od: new Date('2026-01-01'), do: new Date('2026-06-01') }, { od: new Date('2026-06-01'), do: null })).toBe(false)
  })

  it('zapriIntervalPravila: preklic pred začetkom = napaka', () => {
    const slab = zapriIntervalPravila(new Date('2026-06-01'), new Date('2026-01-01'))
    expect('napaka' in slab).toBe(true)
    expect(zapriIntervalPravila(new Date('2026-01-01'), new Date('2026-06-01'))).toEqual({ do: new Date('2026-06-01') })
  })

  it('resolveAktivnaVerzijoPravila: samo ACTIVE ki velja na dan; DRAFT ignoriran', () => {
    const ACTIVE = { status: 'ACTIVE', veljavnostOd: new Date('2026-01-01'), veljavnostDo: null }
    const PRETEKLA = { status: 'ACTIVE', veljavnostOd: new Date('2026-01-01'), veljavnostDo: new Date('2026-06-01') }
    const DRAFT = { status: 'DRAFT', veljavnostOd: new Date('2026-01-01'), veljavnostDo: null }
    const asOf = new Date('2026-10-09')
    expect(resolveAktivnaVerzijoPravila([DRAFT, ACTIVE], asOf)).toBe(ACTIVE)
    expect(resolveAktivnaVerzijoPravila([DRAFT], asOf)).toBeNull()
    expect(resolveAktivnaVerzijoPravila([PRETEKLA], asOf)).toBeNull()
    expect(resolveAktivnaVerzijoPravila([], asOf)).toBeNull()
  })
})

describe('R393 — povzetek skladnosti + opozorilo (§15 compliance statement)', () => {
  it('povzetekSkladnosti: odkrito šteje uradne ločeno od informativnih', () => {
    const p = povzetekSkladnosti([
      { overitev: 'INFORMATIVNO', reviewedAt: null, reviewerId: null },
      uradna('STATISTICNA'),
    ])
    expect(p.stevilo).toBe(2)
    expect(p.uradnoPreverjenih).toBe(1)
    expect(p.informativnih).toBe(1)
  })

  it('SKLADNOST_OPOZORILO izrecno ločuje informativni izračun od uradne preverbe', () => {
    expect(SKLADNOST_OPOZORILO).toContain('NE nadomešča')
    expect(SKLADNOST_OPOZORILO).toContain('projektantskega')
    expect(SKLADNOST_OPOZORILO).toContain('§15')
    expect(SKLADNOST_OPOZORILO).toContain('niso bile neodvisno preverjene')
  })
})

describe('R393 — struktura pravila (zod JSON kolona)', () => {
  it('dovoli primitivne vrednosti + eno raven gnezdenja (faktorji)', () => {
    expect(strukturaPravilaSchema.safeParse({ maxSpacingMm: 1450 }).success).toBe(true)
    expect(strukturaPravilaSchema.safeParse({ minMm: 2, maxMm: 30 }).success).toBe(true)
    expect(strukturaPravilaSchema.safeParse({ terenskiFaktorji: { I: 1.0, IV: 0.73 } }).success).toBe(true)
  })

  it('zavrne globlje gnezdenje/array (NE poljuben JSON)', () => {
    expect(strukturaPravilaSchema.safeParse({ x: { y: { z: 1 } } }).success).toBe(false)
    expect(strukturaPravilaSchema.safeParse([1, 2, 3]).success).toBe(false)
    expect(strukturaPravilaSchema.safeParse('tekst').success).toBe(false)
  })
})

describe('R393 — calculatorVerzija pariteta (calc-engineering R150)', () => {
  it('formula verzije so stabilne nizovne konstante (§15 calculator version)', () => {
    expect(CALC_FORMULA_VERSIONS.railing).toBe('rail-v1')
    expect(CALC_FORMULA_VERSIONS.anchoring).toBe('anch-v1')
    expect(CALC_FORMULA_VERSIONS.wind).toBe('wind-v1')
  })
})
