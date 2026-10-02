// R374 — dekompozicija testov koraka R165 (issue #13): deterministično jedro
// verzij ponudb (quote-versions.ts) — ČISTE enote brez baze.
// ---------------------------------------------------------------------------
// Testi dokazujejo (isti kanon kot equipment-lifecycle R145 testi):
//   (1) statusni stroj: dovoljeni prehodi DRAFT→ISSUED→APPROVED (zadnji SAMO
//       ob zaklepu), DRAFT→REJECTED/SUPERSEDED, ISSUED→SUPERSEDED; terminalna
//       stanja nimajo prehodov (immutable po izdaji — §3);
//   (2) computeQuoteVersion je DETERMINISTIČEN (isti vhodi + ista knjiga →
//       bajtno isti izid) in odvisen od knjige (spremenjena cena → drugačen
//       total + drugačen inputHash — strežnik je vir denarja);
//   (3) verifyQuoteVersionIntegrity: rekonstrukcija zadeti OK; tampirana
//       seštevka/postavke/inputHash ali TUJA knjiga → { ok: false } (§16);
//   (4) plannedMargin: manjkajoč referenceCost → NULL (iskreno NEZNANO —
//       §8, nikoli izmišljeni odstotek); popolni viri → realna marža;
//       postavke brez sourceKey so IZRECNO izven;
//   (5) bomDraftFromLines: sku = postavkin code, količina = qty — NE tekstovna
//       hevristika 'vsebuje wpc' in NE ocena vijakov iz EUR (Math.ceil/50).
import { describe, expect, it } from 'vitest'
import {
  QUOTE_VERSION_STATUSES,
  QUOTE_VERSION_TRANSITIONS,
  allowedQuoteVersionTransitions,
  checkQuoteVersionTransition,
  computeQuoteVersion,
  isImmutableQuoteVersion,
  plannedMargin,
  verifyQuoteVersionIntegrity,
  bomDraftFromLines,
  type QuoteVersionSpecInputs,
} from '@/lib/quote-versions'
import { defaultPriceBook, type PriceBook } from '@/lib/quote'

/** Enostaven pravokotnik 4 × 1 m (zaprt obseg) — realen vhod. */
const VHOD: QuoteVersionSpecInputs = {
  points: [
    { xM: 0, yM: 0, zM: 0 },
    { xM: 4, yM: 0, zM: 0 },
    { xM: 4, yM: 0, zM: 1 },
    { xM: 0, yM: 0, zM: 1 },
  ],
  closed: true,
}

const KNJIGA = defaultPriceBook()

describe('R374 — statusni stroj verzij ponudb (EN VIR)', () => {
  it('STATUSI: natanko DRAFT/ISSUED/APPROVED/REJECTED/SUPERSEDED (drift = javna napaka)', () => {
    expect([...QUOTE_VERSION_STATUSES]).toEqual(['DRAFT', 'ISSUED', 'APPROVED', 'REJECTED', 'SUPERSEDED'])
  })

  it('PREHODI: DRAFT → ISSUED/REJECTED/SUPERSEDED; ISSUED → APPROVED/SUPERSEDED; terminalno = prazno', () => {
    expect([...QUOTE_VERSION_TRANSITIONS.DRAFT].sort()).toEqual(['ISSUED', 'REJECTED', 'SUPERSEDED'])
    expect([...QUOTE_VERSION_TRANSITIONS.ISSUED].sort()).toEqual(['APPROVED', 'SUPERSEDED'])
    // APPROVED se zgodi SAMO ob zaklepu s podpisom — iz statusnega stroja je
    // dosegljiv IZključno iz ISSUED (deal-lock ruta; PATCH issue ne more).
    expect(QUOTE_VERSION_TRANSITIONS.APPROVED).toEqual([])
    expect(QUOTE_VERSION_TRANSITIONS.REJECTED).toEqual([])
    expect(QUOTE_VERSION_TRANSITIONS.SUPERSEDED).toEqual([])
  })

  it('allowedQuoteVersionTransitions: neznano stanje → PRAZNO (fail-closed, ne "vse")', () => {
    expect(allowedQuoteVersionTransitions('DRAFT')).toEqual(['ISSUED', 'REJECTED', 'SUPERSEDED'])
    expect(allowedQuoteVersionTransitions('HACKED')).toEqual([])
  })

  it('checkQuoteVersionTransition: dovoljen prehod OK; nezakončen odklonjen Z dovoljenimi cilji', () => {
    expect(checkQuoteVersionTransition('DRAFT', 'ISSUED').ok).toBe(true)
    expect(checkQuoteVersionTransition('ISSUED', 'APPROVED').ok).toBe(true)
    const zavrnjen = checkQuoteVersionTransition('APPROVED', 'DRAFT')
    expect(zavrnjen.ok).toBe(false)
    expect(zavrnjen.allowed).toEqual([])
    const nazaj = checkQuoteVersionTransition('ISSUED', 'DRAFT')
    expect(nazaj.ok).toBe(false)
    expect(nazaj.allowed).toEqual(['APPROVED', 'SUPERSEDED'])
  })

  it('isImmutableQuoteVersion: ISSUED/APPROVED/REJECTED/SUPERSEDED so nespremenljivi (§3)', () => {
    expect(isImmutableQuoteVersion('DRAFT')).toBe(false)
    for (const s of ['ISSUED', 'APPROVED', 'REJECTED', 'SUPERSEDED'] as const) {
      expect(isImmutableQuoteVersion(s)).toBe(true)
    }
    expect(isImmutableQuoteVersion('NEZNANO')).toBe(true) // fail-closed: neznan status se NE sme spreminjati
  })
})

describe('R374 — computeQuoteVersion (strežniški izračun, §2/§3)', () => {
  it('DETERMINIZEM: isti vhodi + ista knjiga → bajtno identičen izid (2 klica)', () => {
    const a = computeQuoteVersion(VHOD, KNJIGA)
    const b = computeQuoteVersion(VHOD, KNJIGA)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(a.inputHash).toBe(b.inputHash)
  })

  it('KNJIGA JE VIR DENARJA: dražja knjiga → drugačen total + drugačen inputHash (odtis vezan na cene)', () => {
    const osnovna = computeQuoteVersion(VHOD, KNJIGA)
    const draga = computeQuoteVersion(VHOD, defaultPriceBook({ baseProfilePerM: 146.9 }))
    expect(draga.total).toBeGreaterThan(osnovna.total)
    expect(draga.inputHash).not.toBe(osnovna.inputHash)
  })

  it('GEOMETRIJA: daljša ograja → večji total (vhodi res vplivajo na izid)', () => {
    const kratek = computeQuoteVersion({ points: VHOD.points, closed: true }, KNJIGA)
    const dolg = computeQuoteVersion(
      { points: [VHOD.points[0]!, { xM: 8, yM: 0, zM: 0 }, { xM: 8, yM: 0, zM: 1 }, VHOD.points[3]!], closed: true },
      KNJIGA,
    )
    expect(dolg.total).toBeGreaterThan(kratek.total)
    expect(dolg.runM).toBeGreaterThan(kratek.runM)
  })

  it('POSTAVKE nosijo sourceKey (sledljivost cene §4 — ključ cenika iz ENEGA vira)', () => {
    const { lines } = computeQuoteVersion(VHOD, KNJIGA)
    expect(lines.length).toBeGreaterThan(0)
    const sSource = lines.filter((l) => typeof l.sourceKey === 'string' && l.sourceKey.length > 0)
    expect(sSource.length).toBeGreaterThan(0)
    for (const l of sSource) {
      expect(Object.keys(KNJIGA)).toContain(l.sourceKey)
    }
  })
})

describe('R374 — verifyQuoteVersionIntegrity (rekonstrukcija, §16)', () => {
  it('VELJAVNA shranjena verzija → OK (round-trip iz computeQuoteVersion)', () => {
    const c = computeQuoteVersion(VHOD, KNJIGA)
    const verdict = verifyQuoteVersionIntegrity(
      {
        inputsJson: VHOD,
        linesJson: c.lines,
        subtotal: c.subtotal,
        vat: c.vat,
        total: c.total,
        currency: c.currency,
        inputHash: c.inputHash,
      },
      KNJIGA,
    )
    expect(verdict.ok).toBe(true)
  })

  it('TAMPIRAN seštevek → odklonjen z detail (nikoli tiho)', () => {
    const c = computeQuoteVersion(VHOD, KNJIGA)
    const verdict = verifyQuoteVersionIntegrity(
      {
        inputsJson: VHOD,
        linesJson: c.lines,
        subtotal: c.subtotal - 100,
        vat: c.vat,
        total: c.total,
        currency: c.currency,
        inputHash: c.inputHash,
      },
      KNJIGA,
    )
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) expect(verdict.detail).toContain('Seštevki')
  })

  it('TAMPIRANA postavka (cena) → odklonjena (denar ni ročno editabilen)', () => {
    const c = computeQuoteVersion(VHOD, KNJIGA)
    const pokvarjene = c.lines.map((l, i) => (i === 0 ? { ...l, total: 0.01 } : l))
    const verdict = verifyQuoteVersionIntegrity(
      {
        inputsJson: VHOD,
        linesJson: pokvarjene,
        subtotal: c.subtotal,
        vat: c.vat,
        total: c.total,
        currency: c.currency,
        inputHash: c.inputHash,
      },
      KNJIGA,
    )
    expect(verdict.ok).toBe(false)
  })

  it('TUJA knjiga ( vezana ≠ rekonstrukcijska ) → odklonjena — vezava na VEZANO verzijo', () => {
    const c = computeQuoteVersion(VHOD, KNJIGA)
    const verdict = verifyQuoteVersionIntegrity(
      {
        inputsJson: VHOD,
        linesJson: c.lines,
        subtotal: c.subtotal,
        vat: c.vat,
        total: c.total,
        currency: c.currency,
        inputHash: c.inputHash,
      },
      defaultPriceBook({ postPerEach: 138.5 }),
    )
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) expect(verdict.detail).toContain('inputHash')
  })

  it('POKVARJEN inputsJson (brez points) → odklonjen (ne tiltuje v default)', () => {
    const verdict = verifyQuoteVersionIntegrity(
      { inputsJson: { closed: true }, linesJson: [], subtotal: 1, vat: 1, total: 2, currency: 'EUR', inputHash: 'x' },
      KNJIGA,
    )
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) expect(verdict.detail).toContain('points')
  })
})

describe('R374 — plannedMargin (iskrena marža, §8)', () => {
  it('MANJKAJOČ referenceCost → NULL (NEZNANO — nikoli izmišljeni odstotek)', () => {
    const c = computeQuoteVersion(VHOD, KNJIGA)
    const vir = new Map(
      c.lines
        .filter((l) => l.sourceKey)
        .map((l) => [l.sourceKey!, { salesPrice: l.unitPrice, referenceCost: null as number | null }]),
    )
    expect(plannedMargin(c.lines, vir)).toBeNull()
  })

  it('MANJKAJOČ ključ v viru → NULL (fail-closed nad delnimi podatki)', () => {
    const c = computeQuoteVersion(VHOD, KNJIGA)
    const vir = new Map<string, { salesPrice: number; referenceCost: number | null }>()
    expect(plannedMargin(c.lines, vir)).toBeNull()
  })

  it('POPPOLNI viri → realna marža (prihodek − nabavna × količina), zaokrožena na 2 decimalki', () => {
    const c = computeQuoteVersion(VHOD, KNJIGA)
    // Konstantna nabavna cena po ključu (5 €) — odvojeno od cene postavke,
    // da rekonstrukcija ne odvisi od vrstnega reda/deljenih ključev.
    const NABAVNA = 5
    const vir = new Map(
      c.lines
        .filter((l) => l.sourceKey)
        .map((l) => [l.sourceKey!, { salesPrice: l.unitPrice, referenceCost: NABAVNA }]),
    )
    const marza = plannedMargin(c.lines, vir)
    expect(marza).not.toBeNull()
    // Ročna rekonstrukcija istega izračuna (dokaz formule):
    let prihodek = 0
    let strosek = 0
    for (const l of c.lines) {
      if (!l.sourceKey) continue
      prihodek += l.total
      strosek += l.qty * NABAVNA
    }
    expect(marza).toBe(Math.round((prihodek - strosek) * 100) / 100)
  })

  it('POSTAVKE brez sourceKey so IZRECNO izven (DROBNI ne sprožijo NULL)', () => {
    const marza = plannedMargin(
      [
        { code: 'DROBNI', group: 'OSTALO' as never, name: 'Droben material', detail: '', qty: 1, unit: 'kos', unitPrice: 10, total: 10 },
      ],
      new Map(),
    )
    expect(marza).toBe(0)
  })
})

describe('R374 — bomDraftFromLines (strukturiran BOM, §7)', () => {
  it('SKU = postavkin code, KOLIČINA = qty — NE EUR hevristika (multiset 1:1)', () => {
    const c = computeQuoteVersion(VHOD, KNJIGA)
    const bom = bomDraftFromLines(c.lines, 'Test projekt', c.total, '2026-10-03T08:00:00Z')
    expect(bom.items.length).toBe(c.lines.length)
    // Multiset (sku, količina) PAROV — 1:1 preslikava postavk, tudi če se
    // ista koda pojavi večkrat (vsaka postavka svoja vrstica BOM-a):
    const parBom = bom.items.map((i) => `${i.sku}:${i.kolicina}`).sort()
    const parLines = c.lines.map((l) => `${l.code}:${l.qty}`).sort()
    expect(parBom).toEqual(parLines)
    // …in količina IZ postavke (ne Math.ceil(EUR/50) ocena):
    expect(bom.quoteTotal).toBe(c.total)
  })

  it('NI več tekstovne hevristike: dve postavki z enako vsebino opisa, različnima code → LOČENA skuja', () => {
    const bom = bomDraftFromLines(
      [
        { code: 'POST-001', group: 'POSTS' as never, name: 'Stebriček', detail: '', qty: 3, unit: 'kos', unitPrice: 38.5, total: 115.5 },
        { code: 'POST-002', group: 'POSTS' as never, name: 'Stebriček', detail: 'drugi', qty: 2, unit: 'kos', unitPrice: 38.5, total: 77 },
      ],
      'Test projekt',
      192.5,
      '2026-10-03T08:00:00Z',
    )
    const skuji = bom.items.map((i) => i.sku)
    expect(new Set(skuji).size).toBe(2)
    expect(skuji).toContain('POST-001')
    expect(skuji).toContain('POST-002')
  })
})

describe('R374 — skupni kanon z lib/quote (brez vzporedne resnice)', () => {
  it('defaultPriceBook numerični ključi ≡ PRICE_BOOK_NUMERIC_KEYS (drift = javna napaka)', async () => {
    const { PRICE_BOOK_NUMERIC_KEYS } = await import('@/lib/price-book-store')
    const stevilski = Object.entries(KNJIGA)
      .filter(([, v]) => typeof v === 'number')
      .map(([k]) => k)
      .sort()
    expect([...PRICE_BOOK_NUMERIC_KEYS].sort()).toEqual(stevilski)
  })

  it('handrailBookKey delita cena in sourceKey (EN VIR odločitve)', async () => {
    const { handrailBookKey } = await import('@/lib/quote')
    expect(handrailBookKey({ handrail: { type: 'WOOD' } } as never)).toBe('woodHandrailPerM')
    expect(handrailBookKey({ handrail: { type: 'ROUND_42' } } as never)).toBe('roundHandrailPerM')
    expect(handrailBookKey({ handrail: { type: 'ROUND_48' } } as never)).toBe('roundHandrailPerM')
    expect(handrailBookKey({ handrail: { type: 'U_COVER_ALU' } } as never)).toBe('coverRailPerM')
    expect(handrailBookKey({ handrail: { type: 'RECT' } } as never)).toBe('coverRailPerM')
    expect(handrailBookKey({ handrail: { type: 'NONE' } } as never)).toBeNull()
  })
})
