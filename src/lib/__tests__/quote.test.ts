// Testi za ponudbo in omejevanje hitrosti.
// Pričakovane vrednosti za ponudbo so ENAKE kot v Kotlin testih Android aplikacije
// BalkonAR (BomCalculatorTest) — isti vhod (4,00 × 1,50 m, steklo v U-profilu),
// isti cenik, isti rezultat. To dokazuje, da obe platformi računata enako, kar je
// pogoj, da monter na terenu in pisarna vidita isto številko.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildQuote, defaultPriceBook, glassComposition, handrailPricePerM, quoteSummary } from '../quote'
import { defaultRailingSpec, layoutRailing, perimeterOf, v3 } from '../railing-layout'
import { LOGIN_LIMIT, checkRate, clientIp, rateLimitStats, releaseRate, resetRateLimit } from '../rate-limit'

const RECT = [v3(0, 0, 0), v3(4, 0, 0), v3(4, 0, -1.5), v3(0, 0, -1.5)]
const spec = defaultRailingSpec()
const layout = layoutRailing(perimeterOf(RECT, true), spec)
const prices = defaultPriceBook()
const quote = buildQuote(layout, spec, prices)

const item = (code: string) => quote.items.find((i) => i.code === code)

describe('buildQuote — postavke', () => {
  it('steklo je združeno po točni meri: 6× 1323×860 in 4× 740×860', () => {
    const glass = quote.items.filter((i) => i.group === 'GLASS' && i.code.startsWith('STK-1'))
    expect(glass).toHaveLength(1) // samo 1323 (740 se začne z STK-740)
    expect(glass[0].qty).toBe(6)
    expect(quote.items.find((i) => i.code === 'STK-740-860')?.qty).toBe(4)
    expect(quote.items.filter((i) => i.code.startsWith('STK-') && i.code !== 'STK-OB').reduce((s, i) => s + i.qty, 0)).toBe(10)
  })

  it('detajl stekla pove sestavo, kot jo dobavitelj prebere', () => {
    expect(glassComposition(spec)).toBe('ESG/VSG 8,0+8,0 (16,76 mm)')
    expect(item('STK-1323-860')!.detail).toContain('16,76')
  })

  it('rezani profili nosijo odpadek, steklo ne', () => {
    expect(item('U-PROF')!.qty).toBeCloseTo(11 * 1.05, 2)
    expect(item('LETEV')!.qty).toBeCloseTo(11 * 1.05, 2)
    expect(item('TESNILO')!.qty).toBeCloseTo(11 * 1.05, 2)
    // 6 + 4 paneli, točno — odpadek je že v številu panelov
    expect(quote.items.filter((i) => i.code.startsWith('STK-') && i.code !== 'STK-OB').reduce((s, i) => s + i.qty, 0)).toBe(10)
  })

  it('sidra: eno na 300 mm U-profila, brez stebrov pri tem sistemu', () => {
    expect(item('SIDRA')!.qty).toBe(37) // ceil(11000/300)
  })

  it('kotni elementi samo tam, kjer se potek res lomi', () => {
    expect(item('KOT')!.qty).toBe(4)
  })

  it('sklenjena zanka nima zaključnih kapic', () => {
    expect(item('KAPICA')).toBeUndefined()
  })

  it('odprta pot dobi dve kapici', () => {
    const open = layoutRailing(perimeterOf([v3(0, 0, 0), v3(4, 0, 0)], false), spec)
    const q = buildQuote(open, spec, prices)
    expect(q.items.find((i) => i.code === 'KAPICA')?.qty).toBe(2)
  })

  it('demontažo in montažo se da izklopiti', () => {
    expect(item('DEMONT')!.qty).toBeCloseTo(11, 2)
    expect(item('MONTAZA')!.qty).toBeCloseTo(11, 2)
    const q = buildQuote(layout, defaultRailingSpec({ demolition: false }), prices)
    expect(q.items.find((i) => i.code === 'DEMONT')).toBeUndefined()
    expect(q.items.find((i) => i.code === 'MONTAZA')).toBeDefined()
  })

  it('fuga med stekli je razlika med obsegom in vsoto širin panelov', () => {
    // 11,00 m − (6 × 1,3233 + 4 × 0,740) = 0,10 m
    expect(item('SILIKON')!.qty).toBeCloseTo(0.1, 2)
  })
})

describe('buildQuote — seštevki', () => {
  it('material + storitve + drobni = bruto', () => {
    expect(quote.materialTotal + quote.labourTotal + quote.smallMaterialTotal).toBeCloseTo(quote.grossTotal, 1)
  })

  it('droben material je odstotek materiala', () => {
    expect(quote.smallMaterialTotal).toBeCloseTo(quote.materialTotal * 0.03, 1)
  })

  it('brez popusta je neto = bruto, DDV 22 %, skupaj = neto + DDV', () => {
    expect(quote.netTotal).toBeCloseTo(quote.grossTotal, 1)
    expect(quote.vatAmount).toBeCloseTo(quote.netTotal * 0.22, 1)
    expect(quote.total).toBeCloseTo(quote.netTotal + quote.vatAmount, 1)
  })

  it('cena na meter je skupaj deljeno z dolžino', () => {
    expect(quote.totalPerMetre).toBeCloseTo(quote.total / 11, 1)
    expect(quote.runM).toBeCloseTo(11, 2)
  })

  it('vsaka natisnjena postavka ima pozitivno količino in vrednost', () => {
    for (const i of quote.items) {
      expect(i.qty, `${i.code} qty`).toBeGreaterThan(0)
      expect(i.total, `${i.code} total`).toBeGreaterThan(0)
      expect(i.total).toBeCloseTo(i.qty * i.unitPrice, 1)
    }
  })

  it('popust zniša neto in DDV, bruto ostane enak', () => {
    const q = buildQuote(layout, spec, defaultPriceBook({ discountPercent: 10 }))
    expect(q.grossTotal).toBeCloseTo(quote.grossTotal, 1)
    expect(q.discountAmount).toBeCloseTo(quote.grossTotal * 0.1, 1)
    expect(q.netTotal).toBeCloseTo(quote.grossTotal * 0.9, 1)
    expect(q.total).toBeLessThan(quote.total)
  })

  it('prazen razpored da prazno ponudbo, ne ponudbe s samim prevozom', () => {
    const empty = buildQuote(layoutRailing(perimeterOf([v3(0, 0, 0)]), spec), spec, prices)
    expect(empty.items).toHaveLength(0)
    expect(empty.total).toBe(0)
    expect(empty.cutList).toHaveLength(0)
    expect(empty.totalPerMetre).toBe(0)
  })
})

describe('buildQuote — rezalni seznam in povzetek', () => {
  it('vsebuje steklo, letev in profile s koti žage', () => {
    expect(quote.cutList.filter((r) => r.part === 'Steklo')).toHaveLength(2)
    expect(quote.cutList.filter((r) => r.part === 'Pokrovna letev')).toHaveLength(4)
    expect(quote.cutList.filter((r) => r.part === 'U-profil')).toHaveLength(4)
    for (const r of quote.cutList.filter((x) => x.part === 'Pokrovna letev')) {
      expect(r.cutStart).toContain('45')
      expect(r.cutEnd).toContain('45')
      expect(r.cutStart).toContain('notranji kot 90°')
    }
  })

  it('povzetek za glavo ponudbe', () => {
    const s = quoteSummary(layout, spec, quote)
    expect(s.runM).toBeCloseTo(11, 2)
    expect(s.postCount).toBe(0)
    expect(s.panelCount).toBe(10)
    expect(s.corners).toBe(4)
    expect(s.anchors).toBe(37)
    expect(s.glassAreaM2).toBeGreaterThan(9)
    expect(s.total).toBe(quote.total)
  })

  it('cena letev sledi izbranemu tipu', () => {
    expect(handrailPricePerM(spec, prices)).toBe(prices.coverRailPerM)
    expect(handrailPricePerM(defaultRailingSpec({ handrail: { ...spec.handrail, type: 'ROUND_42' } }), prices)).toBe(prices.roundHandrailPerM)
    expect(handrailPricePerM(defaultRailingSpec({ handrail: { ...spec.handrail, type: 'WOOD' } }), prices)).toBe(prices.woodHandrailPerM)
  })
})

describe('buildQuote — sistemi s stebri', () => {
  it('stebri in nosilci so po kosih, sidra po načinu pritrditve', () => {
    const postSpec = defaultRailingSpec({ system: 'POST_BARS', postFixing: 'SIDE_BRACKET', baseProfile: { ...spec.baseProfile, enabled: false } })
    const q = buildQuote(layoutRailing(perimeterOf(RECT, true), postSpec), postSpec, prices)
    expect(q.items.find((i) => i.code === 'STEB')?.qty).toBe(12)
    expect(q.items.find((i) => i.code === 'NOS-B')?.qty).toBe(12)
    expect(q.items.find((i) => i.code === 'SIDRA')?.qty).toBe(24) // 12 × 2, brez U-profila
    expect(q.items.find((i) => i.code === 'U-PROF')).toBeUndefined()
  })

  it('palice so v metrih, mreža in les v m²', () => {
    const barSpec = defaultRailingSpec({ system: 'POST_BARS', baseProfile: { ...spec.baseProfile, enabled: false } })
    const q = buildQuote(layoutRailing(perimeterOf(RECT, true), barSpec), barSpec, prices)
    const bars = q.items.find((i) => i.code === 'PAL')!
    expect(bars.unit).toBe('m')
    expect(bars.qty).toBeCloseTo(44 * 1.05, 2) // 4 palice × 11 m + odpadek

    const meshSpec = defaultRailingSpec({ system: 'POST_MESH', baseProfile: { ...spec.baseProfile, enabled: false } })
    const qm = buildQuote(layoutRailing(perimeterOf(RECT, true), meshSpec), meshSpec, prices)
    expect(qm.items.find((i) => i.code === 'MREZA')!.unit).toBe('m2')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('checkRate — omejevanje hitrosti', () => {
  beforeEach(() => {
    resetRateLimit()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-22T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('dovoli do meje, nato blokira', () => {
    const opts = { limit: 3, windowMs: 1000 }
    expect(checkRate('a', opts).ok).toBe(true)
    expect(checkRate('a', opts).ok).toBe(true)
    const third = checkRate('a', opts)
    expect(third.ok).toBe(true)
    expect(third.remaining).toBe(0)
    const blocked = checkRate('a', opts)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfterMs).toBeGreaterThan(0)
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1)
  })

  it('okno scvrsti: po preteku spet dovoljuje', () => {
    const opts = { limit: 2, windowMs: 1000 }
    checkRate('b', opts)
    checkRate('b', opts)
    expect(checkRate('b', opts).ok).toBe(false)
    vi.advanceTimersByTime(1100)
    expect(checkRate('b', opts).ok).toBe(true)
  })

  it('različni ključi so neodvisni', () => {
    const opts = { limit: 1, windowMs: 10_000 }
    expect(checkRate('x', opts).ok).toBe(true)
    expect(checkRate('x', opts).ok).toBe(false)
    expect(checkRate('y', opts).ok).toBe(true)
  })

  it('releaseRate vrne žeton — uspešna prijava ne sme kaznovati uporabnika', () => {
    const opts = { limit: 2, windowMs: 10_000 }
    checkRate('c', opts)
    releaseRate('c')
    expect(checkRate('c', opts).remaining).toBe(1)
    checkRate('c', opts)
    checkRate('c', opts)
    expect(checkRate('c', opts).ok).toBe(false)
  })

  it('releaseRate na neznanem ključu ne vrže', () => {
    expect(() => releaseRate('ne-obstaja')).not.toThrow()
  })

  it('privzeta omejitev za prijavo je 10 na 15 minut', () => {
    expect(LOGIN_LIMIT.limit).toBe(10)
    expect(LOGIN_LIMIT.windowMs).toBe(15 * 60 * 1000)
  })

  it('seznam zadetkov ne raste v nedogled (stari se odstranijo)', () => {
    const opts = { limit: 5, windowMs: 1000 }
    for (let i = 0; i < 4; i++) checkRate('d', opts)
    vi.advanceTimersByTime(1100)
    for (let i = 0; i < 5; i++) checkRate('d', opts)
    expect(rateLimitStats().hits).toBeLessThanOrEqual(5)
  })

  it('resetRateLimit počisti vse ali en ključ', () => {
    const opts = { limit: 1, windowMs: 10_000 }
    checkRate('e', opts)
    checkRate('f', opts)
    resetRateLimit('e')
    expect(checkRate('e', opts).ok).toBe(true)
    expect(checkRate('f', opts).ok).toBe(false)
    resetRateLimit()
    expect(checkRate('f', opts).ok).toBe(true)
  })
})

describe('clientIp', () => {
  const req = (headers: Record<string, string>) => new Request('http://localhost/api/auth', { headers })

  it('prebere prvi naslov iz X-Forwarded-For (Caddy postavi verigo)', () => {
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4')
  })

  it('uporabi X-Real-IP, kadar XFF manjka', () => {
    expect(clientIp(req({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8')
  })

  it('brez obeh ne vrne praznega (za lokalni razvoj)', () => {
    expect(clientIp(req({})).length).toBeGreaterThan(0)
  })

  it('prazen XFF pade na X-Real-IP', () => {
    expect(clientIp(req({ 'x-forwarded-for': '', 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Meje vhodov: API ne sme sprejeti poljubnega JSON kot konfiguracijo ali cenik.
// ══════════════════════════════════════════════════════════════════════════════
import { mergePriceBook } from '../quote'
import { mergeSpec } from '../railing-layout'

describe('mergeSpec — delna konfiguracija ne sme izbrisati privzetega', () => {
  it('gnezden objekt se zlije, ne zamenja', () => {
    // Klient pošlje samo debelino stekla; tip, max širina in reži morajo ostati.
    const merged = mergeSpec({ glass: { thicknessMm: 12 } })
    expect(merged.glass.thicknessMm).toBe(12)
    expect(merged.glass.type).toBe('ESG_VSG')
    expect(merged.glass.maxPanelWidthMm).toBe(1400)
    expect(merged.glass.sideGapMm).toBe(6)
  })

  it('plitvo zlivanje bi to zlomilo — preverimo, da se ni', () => {
    const shallow = { ...defaultRailingSpec(), glass: { thicknessMm: 12 } } as unknown as typeof merged
    const merged = mergeSpec({ glass: { thicknessMm: 12 } })
    expect((shallow.glass as { type?: string }).type).toBeUndefined() // dokaz, da je plitvo zlivanje napačno
    expect(merged.glass.type).toBeDefined()
  })

  it('prazen vhod vrne privzeto konfiguracijo', () => {
    expect(mergeSpec({})).toEqual(defaultRailingSpec())
    expect(mergeSpec()).toEqual(defaultRailingSpec())
  })

  it('sistem, višina in stebrički se upoštevajo', () => {
    const merged = mergeSpec({ system: 'POST_BARS', heightMm: 1100, postSpacingMaxMm: 900 })
    expect(merged.system).toBe('POST_BARS')
    expect(merged.heightMm).toBe(1100)
    expect(merged.postSpacingMaxMm).toBe(900)
    // ostalo ostane privzeto
    expect(merged.wastePercent).toBe(5)
    expect(merged.demolition).toBe(true)
  })
})

describe('mergePriceBook — beli seznam in preverba tipov', () => {
  it('veljavna števila se upoštevajo', () => {
    const p = mergePriceBook({ glassPerM2: 200, vatPercent: 9.5 })
    expect(p.glassPerM2).toBe(200)
    expect(p.vatPercent).toBe(9.5)
    expect(p.mountingPerM).toBe(defaultPriceBook().mountingPerM)
  })

  it('število kot niz se pretvori', () => {
    expect(mergePriceBook({ glassPerM2: '175' }).glassPerM2).toBe(175)
  })

  it('neznani ključi se ignorirajo — stranka ne more podtakniti "total"', () => {
    const p = mergePriceBook({ total: 1, netTotal: 0, skupaj: 999 }) as unknown as Record<string, unknown>
    expect(p.total).toBeUndefined()
    expect(p.netTotal).toBeUndefined()
    expect(p.skupaj).toBeUndefined()
    expect(p.vatPercent).toBe(22)
    // Bela lista je izpeljana iz PriceBook, zato so pravi ključi še vedno tam.
    expect(Object.keys(p).length).toBe(Object.keys(defaultPriceBook()).length)
  })

  it('negativna in neštevilska vrednost se zavrne', () => {
    const base = defaultPriceBook()
    expect(mergePriceBook({ glassPerM2: -50 }).glassPerM2).toBe(base.glassPerM2)
    expect(mergePriceBook({ glassPerM2: 'nič' }).glassPerM2).toBe(base.glassPerM2)
    expect(mergePriceBook({ glassPerM2: null }).glassPerM2).toBe(base.glassPerM2)
    expect(mergePriceBook({ glassPerM2: NaN }).glassPerM2).toBe(base.glassPerM2)
  })

  it('valuta se sprejme samo kot kratek niz', () => {
    expect(mergePriceBook({ currency: 'EUR' }).currency).toBe('EUR')
    expect(mergePriceBook({ currency: 123 as unknown as string }).currency).toBe('EUR')
    expect(mergePriceBook({ currency: 'PREDOLGAAVALUTAZAPISO' }).currency).toBe('EUR')
  })

  it('proto pollution: __proto__ ne spremeni prototipa', () => {
    mergePriceBook({ ['__proto__']: { polluted: true } } as Record<string, unknown>)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})
