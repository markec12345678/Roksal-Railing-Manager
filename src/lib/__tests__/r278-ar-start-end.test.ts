// R278 — SEGMENT START/END KOORDINATI v skupnem kontraktu (issue #16 §3:
// 'Vsak segment mora imeti stabilen ID in podatke za nadaljnjo geometrijo:
// start/end, length, height, angle, slope, …'). lengthMm/heightMm/slopeDeg
// obstajajo od R274, angleDeg od R277; startMm/endMm sta R278 ADITIVNA
// razširitev v1 (semantične odločitve Q1–Q6 v src/lib/ar-contract.ts —
// zapisane PRED razvojem po kanonu P1–P6):
//   • Q1 aditivna v1 (NE v2) — verzija ostane 1, matrika nosi razširitev;
//   • Q2 žični tuple [x, y] 2D (mm, enota v imenu) — 2D NE 3D;
//   • Q3 izmerjeno, NE izpeljano, NE križno preverjano — |end−start| ≠
//     lengthMm ostane VELJAVEN (skladnost = downstream geometrija domena);
//   • Q4 session-level LOCAL_NORMALIZED — prvi startMm [0,0] pričakovan,
//     NE vsiljen;
//   • Q5 izostanek = ni izmerjeno (iskrena praznina); ekspliciten null,
//     NaN, Infinity, napačna dolžina tupleja, niz = zavrnjeno; negativni
//     koordinati VELJAVNI — verbatim;
//   • Q6 DB/route NIČ — arMetadata JSON verbatim, brez sheme.
// Zlati fixture (R275) ostaja NESPREMENJEN — predstavlja v1 brez novih
// polj; ta datoteka dokazuje nova polja LOČENO.
import { describe, expect, it } from 'vitest'
import {
  parseArSessionPayload,
  serializeArSessionPayload,
  migrateArSessionPayload,
  ArContractError,
  AR_CONTRACT_VERSION,
  AR_CONTRACT_COMPATIBILITY,
  SUPPORTED_AR_CONTRACT_VERSIONS,
} from '@/lib/ar-contract'
import golden from './fixtures/ar-session-golden-v1.json'

const ZLATI = golden as Record<string, unknown>

/** Poln veljaven payload z ZLATIMI obveznimi polji + nova startMm/endMm. */
function osnova(
  start: unknown,
  end: unknown,
  segmentDodatki: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    contractVersion: 1,
    appVersion: 'BalkonAR 0.9.2',
    projectId: 'proj-r278',
    sessionId: 'sess-r278',
    source: 'ARCORE_DEPTH',
    units: 'mm',
    coordinateFrame: { type: 'LOCAL_NORMALIZED' },
    segments: [
      {
        segmentId: 'seg-r278-1',
        lengthMm: 3200.75,
        heightMm: 1200,
        ...segmentDodatki,
        ...(start !== undefined ? { startMm: start } : {}),
        ...(end !== undefined ? { endMm: end } : {}),
        source: 'ARCORE_DEPTH',
      },
    ],
  }
}

describe('R278 startMm/endMm — sprejetje (issue #16 §3: start/end per segment)', () => {
  it('startMm/endMm (float, mm) preideta kanonično shemo — izmerjena resnica verbatim', () => {
    const parsed = parseArSessionPayload(osnova([0, 0], [3200.75, 12.5]))
    expect(parsed.segments[0].startMm).toEqual([0, 0])
    expect(parsed.segments[0].endMm).toEqual([3200.75, 12.5])
  })

  it('negativni koordinati = resnica — kontrakt NE wrapa/normalizira (Q5, precedens P2/slopeDeg)', () => {
    const parsed = parseArSessionPayload(osnova([-120.5, -340], [-2980.25, 45]))
    expect(parsed.segments[0].startMm).toEqual([-120.5, -340])
    expect(parsed.segments[0].endMm).toEqual([-2980.25, 45])
  })

  it('prvi segment startMm [0, 0] je veljaven (Q4 — pričakovan po definiciji okvirja, NE vsiljen)', () => {
    const parsed = parseArSessionPayload(osnova([0, 0], [3200, 0]))
    expect(parsed.segments[0].startMm).toEqual([0, 0])
  })

  it('per-segment neodvisnost: en segment s koordinati, drugi brez (Q5)', () => {
    const payload = osnova([0, 0], [3200, 0])
    ;(payload.segments as Record<string, unknown>[]).push({
      segmentId: 'seg-r278-2',
      lengthMm: 900,
      slopeDeg: -2.5,
      source: 'MANUAL',
    })
    const parsed = parseArSessionPayload(payload)
    expect(parsed.segments[0].startMm).toEqual([0, 0])
    expect(parsed.segments[0].endMm).toEqual([3200, 0])
    expect(parsed.segments[1].startMm).toBeUndefined()
    expect(parsed.segments[1].endMm).toBeUndefined()
  })

  it('izostanek koordinat = točki NISTA izmerjeni (iskrena praznina, Q5) — zlati fixture ostaja veljaven', () => {
    const parsed = parseArSessionPayload(ZLATI)
    for (const s of parsed.segments) {
      expect(s.startMm).toBeUndefined()
      expect(s.endMm).toBeUndefined()
    }
    const izostanek = parseArSessionPayload(osnova(undefined, undefined))
    expect(izostanek.segments[0].startMm).toBeUndefined()
    expect(izostanek.segments[0].endMm).toBeUndefined()
  })

  it('samo startMm brez endMm (in obratno) = veljavna delna resnica (Q5 — per-polje izostanek)', () => {
    const samoStart = parseArSessionPayload(osnova([0, 0], undefined))
    expect(samoStart.segments[0].startMm).toEqual([0, 0])
    expect(samoStart.segments[0].endMm).toBeUndefined()
    const samoEnd = parseArSessionPayload(osnova(undefined, [3200, 0]))
    expect(samoEnd.segments[0].startMm).toBeUndefined()
    expect(samoEnd.segments[0].endMm).toEqual([3200, 0])
  })
})

describe('R278 startMm/endMm — determinizem in round-trip', () => {
  it('round-trip serialize(parse(x)) je bajtno identičen (koordinati verbatim)', () => {
    const vhod = osnova([-120.5, 0.125], [3200.75, 45], { angleDeg: -45.5 })
    const json1 = JSON.stringify(vhod)
    const parsed = parseArSessionPayload(vhod)
    const json2 = serializeArSessionPayload(parsed)
    expect(json2).toBe(json1)
    const ponovno = parseArSessionPayload(JSON.parse(json2))
    expect(serializeArSessionPayload(ponovno)).toBe(json2)
  })

  it('determinizem: ista vhodna resnica → ista žica (brez ure/locale/naključja)', () => {
    const vhod = osnova([0, 0], [3200.75, 12.5])
    const a = serializeArSessionPayload(parseArSessionPayload(vhod))
    const b = serializeArSessionPayload(parseArSessionPayload(JSON.parse(JSON.stringify(vhod))))
    expect(a).toBe(b)
  })
})

describe('R278 Q3 — IZMERJENO, NE IZPELJANO, NE KRIŽNO PREVERJANO', () => {
  it('|end−start| ≠ lengthMm ostane VELJAVEN payload — kontrakt NE vsiljuje enačbe (Q3)', () => {
    // start [0,0] → end [3000,0] = 3000 mm, lengthMm = 3200.75 — NEENAKA,
    // obe vrednosti sta neodvisni izmerjeni resnici; konsistenca je
    // downstream geometry/BOM domena (core NIČ).
    const parsed = parseArSessionPayload(osnova([0, 0], [3000, 0]))
    expect(parsed.segments[0].lengthMm).toBe(3200.75)
    expect(parsed.segments[0].endMm).toEqual([3000, 0])
  })

  it('angleDeg NI izpeljan iz start/end — neskladne vrednosti ostanejo verbatim (Q3/P3)', () => {
    // atan2(0−0, 3200−0) bi bil 0°, a izmerjen azimut je 12.5° — obe
    // vrednosti sta neodvisni resnici, kontrakt NE računa nazaj.
    const payload = osnova([0, 0], [3200, 0], { angleDeg: 12.5 })
    const parsed = parseArSessionPayload(payload)
    expect(parsed.segments[0].angleDeg).toBe(12.5)
    expect(parsed.segments[0].endMm).toEqual([3200, 0])
  })
})

describe('R278 startMm/endMm — fail-closed (Q2/Q5, strict odločitev 3)', () => {
  const pričakovanaKoda = 'AR_CONTRACT_VALIDACIJA'
  const zavrnjen = (vhod: unknown) =>
    expect(() => parseArSessionPayload(vhod)).toThrowError(ArContractError)

  it('ekspliciten null startMm = ZAVRJEN (izostanek je edini način "brez vrednosti" — Q5)', () => {
    try {
      parseArSessionPayload(osnova(null, [3200, 0]))
      expect.unreachable('null startMm mora biti zavrnjen')
    } catch (e) {
      expect(e).toBeInstanceOf(ArContractError)
      expect((e as ArContractError).code).toBe(pričakovanaKoda)
    }
  })

  it('ekspliciten null endMm = ZAVRJEN (dual polja, ista strogost — Q5)', () => {
    try {
      parseArSessionPayload(osnova([0, 0], null))
      expect.unreachable('null endMm mora biti zavrnjen')
    } catch (e) {
      expect(e).toBeInstanceOf(ArContractError)
      expect((e as ArContractError).code).toBe(pričakovanaKoda)
    }
  })

  it('3D tuple endMm = ZAVRJEN (Q2 — 2D NE 3D, nič ugibanja o z osi)', () => {
    zavrnjen(osnova([0, 0], [3200, 0, 1200]))
  })

  it('1D tuple startMm = ZAVRJEN (Q2 — natanko [x, y])', () => {
    zavrnjen(osnova([3200], [3200, 0]))
  })

  it('NaN/Infinity koordinata = ZAVRJENA (finite — Q5)', () => {
    zavrnjen(osnova([Number.NaN, 0], [3200, 0]))
    zavrnjen(osnova([0, 0], [Number.POSITIVE_INFINITY, 0]))
  })

  it('niz namesto številke = ZAVRJEN (tipna strogost — Q5)', () => {
    zavrnjen(osnova(['3200', '0'], [3200, 0]))
  })

  it('tipografija "startPoint"/"start" = ZAVRJENA neznana polja (strict — odločitev 3)', () => {
    zavrnjen(osnova(undefined, undefined, { startPoint: [0, 0] }))
    zavrnjen(osnova(undefined, undefined, { start: [0, 0], end: [3200, 0] }))
  })
})

describe('R278 Q1 — verzija in matrika (kljuka ISTA vrata)', () => {
  it('contractVersion ostane 1 — aditivna razširitev, NI dviga verzije (Q1)', () => {
    expect(AR_CONTRACT_VERSION).toBe(1)
    expect(SUPPORTED_AR_CONTRACT_VERSIONS).toEqual([1])
    const parsed = parseArSessionPayload(osnova([0, 0], [3200, 0]))
    expect(parsed.contractVersion).toBe(1)
  })

  it('matrika nosi R278 razširitev IZREČNO (žica: startMm/endMm opcijsko, Q1–Q6)', () => {
    const razsiritev = AR_CONTRACT_COMPATIBILITY[1].razsiritev
    expect(razsiritev).toContain('R277')
    expect(razsiritev).toContain('R278')
    expect(razsiritev).toContain('startMm/endMm')
    expect(razsiritev).toContain('Q1–Q6')
    expect(razsiritev).toContain('confidence/uncertaintyMm')
    expect(razsiritev).toContain('S1–S6')
  })

  it('nepodprta verzija 2 = ISTA vrata (AR_CONTRACT_VERSION_UNSUPPORTED z originalom — regresija R274/R277)', () => {
    const vhod = osnova([0, 0], [3200, 0])
    vhod['contractVersion'] = 2
    try {
      migrateArSessionPayload(vhod)
      expect.unreachable('verzija 2 mora biti zavrnjena')
    } catch (e) {
      expect(e).toBeInstanceOf(ArContractError)
      const err = e as ArContractError
      expect(err.code).toBe('AR_CONTRACT_VERSION_UNSUPPORTED')
      expect(err.payload).toBe(vhod)
    }
  })
})

/** Segment z dodatnimi flat polji (S — confidence/uncertaintyMm), ključi v
 *  REDI DEFINICIJE SHEME (round-trip determinizem — parsed ključi sledijo
 *  vrstnemu redu definicije). */
function segmentS(dodatkiPoVrsti: Record<string, unknown>): Record<string, unknown> {
  return {
    contractVersion: 1,
    appVersion: 'BalkonAR 0.9.2',
    projectId: 'proj-r278',
    sessionId: 'sess-r278',
    source: 'ARCORE_DEPTH',
    units: 'mm',
    coordinateFrame: { type: 'LOCAL_NORMALIZED' },
    segments: [
      {
        segmentId: 'seg-r278-s1',
        lengthMm: 3200.75,
        heightMm: 1200,
        startMm: [0, 0],
        endMm: [3200.75, 12.5],
        confidence: undefined,
        uncertaintyMm: undefined,
        source: 'ARCORE_DEPTH',
        ...dodatkiPoVrsti,
      },
    ],
  }
}

describe('R278 S — per-segment confidence/uncertaintyMm (issue #16 §3 quality/uncertainty)', () => {
  it('confidence (0..1) + uncertaintyMm preideta shemo — izmerjena resnica verbatim (S2/S4)', () => {
    const parsed = parseArSessionPayload(segmentS({ confidence: 0.92, uncertaintyMm: 8.5 }))
    expect(parsed.segments[0].confidence).toBe(0.92)
    expect(parsed.segments[0].uncertaintyMm).toBe(8.5)
  })

  it('meja 0 in 1 sta VELJAVNI vrednosti (S5 — 0 = naprava izrecno poroča nič zaupanja, NIKOLI ugibanje)', () => {
    const nic = parseArSessionPayload(segmentS({ confidence: 0 }))
    expect(nic.segments[0].confidence).toBe(0)
    const popolna = parseArSessionPayload(segmentS({ confidence: 1 }))
    expect(popolna.segments[0].confidence).toBe(1)
  })

  it('izostanek kakovosti = naprava NI poročala (iskrena praznina, S5) — zlati fixture ostaja veljaven', () => {
    const parsed = parseArSessionPayload(ZLATI)
    for (const s of parsed.segments) {
      expect(s.confidence).toBeUndefined()
      expect(s.uncertaintyMm).toBeUndefined()
    }
    const brez = parseArSessionPayload(segmentS({}))
    expect(brez.segments[0].confidence).toBeUndefined()
    expect(brez.segments[0].uncertaintyMm).toBeUndefined()
  })

  it('segment kakovost je NEODVISNA od session quality (S3 — NI vsiljene skladnosti)', () => {
    // session quality.confidence = 0.92, segment confidence = 0.31 — obe
    // resnici se razlikujeta in payload ostane VELJAVEN (agregat seje vs.
    // neodvisno branje segmenta).
    const vhod = segmentS({ confidence: 0.31, uncertaintyMm: 25 })
    vhod['quality'] = { confidence: 0.92, uncertaintyMm: 8.5 }
    const parsed = parseArSessionPayload(vhod)
    expect(parsed.quality?.confidence).toBe(0.92)
    expect(parsed.segments[0].confidence).toBe(0.31)
  })

  it('session brez quality + segment s confidence = veljavna delna resnica (S3)', () => {
    const parsed = parseArSessionPayload(segmentS({ confidence: 0.55 }))
    expect(parsed.quality).toBeUndefined()
    expect(parsed.segments[0].confidence).toBe(0.55)
  })

  it('round-trip bajtno identičen z S-polji (wire raven — S2 flat, NE nested quality)', () => {
    const vhod = segmentS({ confidence: 0.92, uncertaintyMm: 8.5 })
    const json1 = JSON.stringify(vhod)
    const json2 = serializeArSessionPayload(parseArSessionPayload(vhod))
    expect(json2).toBe(json1)
  })

  it('fail-closed: confidence izven 0..1, null, NaN = ZAVRJEN (S5)', () => {
    expect(() => parseArSessionPayload(segmentS({ confidence: 1.5 }))).toThrowError(ArContractError)
    expect(() => parseArSessionPayload(segmentS({ confidence: -0.1 }))).toThrowError(ArContractError)
    expect(() => parseArSessionPayload(segmentS({ confidence: null }))).toThrowError(ArContractError)
    expect(() => parseArSessionPayload(segmentS({ confidence: Number.NaN }))).toThrowError(ArContractError)
  })

  it('fail-closed: uncertaintyMm 0/negativno/null = ZAVRJEN (S4 — mm > 0, kanon odločitev 2)', () => {
    expect(() => parseArSessionPayload(segmentS({ uncertaintyMm: 0 }))).toThrowError(ArContractError)
    expect(() => parseArSessionPayload(segmentS({ uncertaintyMm: -8.5 }))).toThrowError(ArContractError)
    expect(() => parseArSessionPayload(segmentS({ uncertaintyMm: null }))).toThrowError(ArContractError)
  })
})
