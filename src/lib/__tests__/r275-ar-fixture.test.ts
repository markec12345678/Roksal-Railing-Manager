// R275 — ZLATI AR KONTRAKT FIXTURE (issue #16/#15/#17 — dokument (A) iz
// R274 handoverja): kanoničen primer MeasurementSession payload-a, ki ga
// OBOData repozitorija kodirata naprej:
//   • Roksal: ta testi dokazujejo, da je fixture VELJAVEN skozi kanonično
//     shemo (parseArSessionPayload) + determinističen round-trip;
//   • ar-android (BalkonAR, Kotlin): docs/AR-CONTRACT-FIXTURE.md vsebuje
//     ISTI fixture + Kotlin data classe + preslikavno tabelo (žica ↔ Kotlin
//     ↔ zod omejitev) — EN VIR resnice je fixtures/ar-session-golden-v1.json,
//     dokument je njegova razlaga (kopija je varovana z opozorilom).
//
// Dokazi:
//   • veljavnost (A): zlati fixture preide kanonično shemo z VSAMI opcijskimi
//     polji izkorščenimi (transform, calibration, quality, photoRefs,
//     glbRefs, segments z vsemi tremi source-i);
//   • kanonična oblika (D): serialize(parse(x)) je fiksna — ključi v redu
//     definicije sheme, round-trip deep-enak vhodu;
//   • determinizem: enak vhod → bajtno enak izhod (brez ure/locale);
//   • fail-closed meje: neznano polje, tuj source, napačne enote, prazni
//     segmenti, negativna dolžina, slab sha256, napačna verzija (z
//     ORIGINALOM na napaki — ni izgube, D);
//   • ID-ji verbatim (B): eksotični identifikatorji preživijo round-trip
//     bajtno identično (brez trim/normalize/case-fold).
import { describe, expect, it } from 'vitest'
import {
  parseArSessionPayload,
  serializeArSessionPayload,
  migrateArSessionPayload,
  ArContractError,
  AR_CONTRACT_VERSION,
  SUPPORTED_AR_CONTRACT_VERSIONS,
} from '@/lib/ar-contract'
import golden from './fixtures/ar-session-golden-v1.json'

const ZLATI = golden as Record<string, unknown>

/** Minimalna varianti: samo OBVEZNA polja (matrika opcijskosti — vse ostalo
 *  izpustljivo). */
const MINIMAL: Record<string, unknown> = {
  contractVersion: 1,
  appVersion: 'BalkonAR 0.9.2',
  projectId: 'proj-min',
  sessionId: 'sess-min',
  source: 'MANUAL',
  units: 'mm',
  coordinateFrame: { type: 'LOCAL_NORMALIZED' },
  segments: [{ segmentId: 'seg-min', lengthMm: 3000, source: 'MANUAL' }],
}

describe('R275 zlati fixture — veljavnost (issue #17 §A: canonical schema)', () => {
  it('zlati fixture preide kanonično shemo z VSAMI opcijskimi polji izkorščenimi', () => {
    const parsed = parseArSessionPayload(ZLATI)
    expect(parsed.contractVersion).toBe(1)
    expect(parsed.appVersion).toBe('BalkonAR 0.9.2')
    expect(parsed.source).toBe('ARCORE_DEPTH')
    expect(parsed.units).toBe('mm')
    expect(parsed.coordinateFrame.type).toBe('LOCAL_NORMALIZED')
    expect(parsed.transform?.anchorId).toBe('anchor-01')
    expect(parsed.transform?.rotationQ).toEqual([0, 0, 0, 1])
    expect(parsed.calibration?.model).toBe('TWO_POINT_SCALE')
    expect(parsed.calibration?.referenceMm).toBe(1000)
    expect(parsed.quality?.confidence).toBeCloseTo(0.92, 10)
    expect(parsed.quality?.uncertaintyMm).toBe(8.5)
    expect(parsed.photoRefs).toHaveLength(2)
    expect(parsed.photoRefs?.[0].sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(parsed.photoRefs?.[1].sha256).toBeUndefined()
    expect(parsed.glbRefs).toHaveLength(1)
    expect(parsed.segments).toHaveLength(3)
    expect(parsed.segments.map((s) => s.source)).toEqual(['ARCORE_DEPTH', 'MANUAL', 'PHOTO_CV'])
    expect(parsed.segments[1].slopeDeg).toBe(-2.5)
  })

  it('minimalni fixture (samo obvezna polja) preide — matrika opcijskosti', () => {
    const parsed = parseArSessionPayload(MINIMAL)
    expect(parsed.transform).toBeUndefined()
    expect(parsed.calibration).toBeUndefined()
    expect(parsed.quality).toBeUndefined()
    expect(parsed.photoRefs).toBeUndefined()
    expect(parsed.glbRefs).toBeUndefined()
    expect(parsed.segments).toHaveLength(1)
  })
})

describe('R275 zlati fixture — kanonična oblika + determinizem (issue #17 §D)', () => {
  it('round-trip: serialize(parse(fixture)) je deep-enak vhodu (kanonična forma)', () => {
    const parsed = parseArSessionPayload(ZLATI)
    const niz = serializeArSessionPayload(parsed)
    expect(JSON.parse(niz)).toEqual(ZLATI)
  })

  it('determinizem: dva neodvisna parse-a → bajtno enak izhod', () => {
    const a = serializeArSessionPayload(parseArSessionPayload(ZLATI))
    const b = serializeArSessionPayload(parseArSessionPayload(ZLATI))
    expect(a).toBe(b)
  })

  it('float ostane verbatim: lengthMm 3200.75 NI zaokrožen (odločitev 2)', () => {
    const parsed = parseArSessionPayload(ZLATI)
    expect(parsed.segments[0].lengthMm).toBe(3200.75)
    expect(String(parsed.segments[0].lengthMm)).toContain('3200.75')
  })

  it('eksotični ID-ji preživijo round-trip bajtno identično (odločitev 6 — verbatim)', () => {
    const eksoticni = {
      ...MINIMAL,
      projectId: '  proj z presledki/posebnimi+znaki@éł  ',
      sessionId: 'SESS-UPPER-case_123:kolon-pinč',
      segments: [{ segmentId: 'SEG:001/ven', lengthMm: 2500.5, source: 'PHOTO_CV' as const }],
    }
    const niz = serializeArSessionPayload(parseArSessionPayload(eksoticni))
    const nazaj = JSON.parse(niz) as Record<string, unknown>
    expect(nazaj['projectId']).toBe('  proj z presledki/posebnimi+znaki@éł  ')
    expect(nazaj['sessionId']).toBe('SESS-UPPER-case_123:kolon-pinč')
    expect((nazaj['segments'] as Array<Record<string, unknown>>)[0]['segmentId']).toBe('SEG:001/ven')
  })
})

describe('R275 zlati fixture — fail-closed meje (issue #17 §B/§D)', () => {
  it('neznano polje na korenu → AR_CONTRACT_VALIDACIJA s potjo (strict, nič tihega stripa)', () => {
    const pokvaren = { ...ZLATI, futureField: 'prihodnost' }
    try {
      parseArSessionPayload(pokvaren)
      expect.unreachable('zavrnitev pričakovana')
    } catch (e) {
      expect(e).toBeInstanceOf(ArContractError)
      const err = e as ArContractError
      expect(err.code).toBe('AR_CONTRACT_VALIDACIJA')
      // Lekcija R274 #6: poti so v SPOROČILU (zod v4 strict — ključ NI del
      // poti); pot je null pri VALIDACIJA (original nosi payload).
      expect(String(err.message)).toContain('futureField')
      expect(err.payload).toEqual(pokvaren)
    }
  })

  it('neznano polje v segmentu → pot nosi segments indeks', () => {
    const pokvaren = JSON.parse(JSON.stringify(ZLATI)) as Record<string, unknown>
    ;(pokvaren['segments'] as Array<Record<string, unknown>>)[0]['ugibanje'] = true
    try {
      parseArSessionPayload(pokvaren)
      expect.unreachable('zavrnitev pričakovana')
    } catch (e) {
      const err = e as ArContractError
      expect(err.code).toBe('AR_CONTRACT_VALIDACIJA')
      expect(String(err.message)).toContain('segments.0')
    }
  })

  it('tuj source → zavrnjen (tudi SDK enuma automatic/manual — DVA nivoja, odločitev 1)', () => {
    for (const tuj of ['automatic', 'manual', 'hybrid', 'arcore_depth']) {
      const pokvaren = { ...MINIMAL, source: tuj }
      expect(() => parseArSessionPayload(pokvaren)).toThrow(ArContractError)
    }
  })

  it('napačne enote (cm/m) → zavrnjene; samo mm (odločitev 2)', () => {
    expect(() => parseArSessionPayload({ ...MINIMAL, units: 'cm' })).toThrow(ArContractError)
    expect(() => parseArSessionPayload({ ...MINIMAL, units: 'm' })).toThrow(ArContractError)
  })

  it('prazni segments → zavrnjeni (min 1); negativna lengthMm → zavrnjena', () => {
    expect(() => parseArSessionPayload({ ...MINIMAL, segments: [] })).toThrow(ArContractError)
    const negativna = JSON.parse(JSON.stringify(MINIMAL)) as Record<string, unknown>
    ;(negativna['segments'] as Array<Record<string, unknown>>)[0]['lengthMm'] = -100
    expect(() => parseArSessionPayload(negativna)).toThrow(ArContractError)
  })

  it('slab sha256 (63 hex, velike črke) → zavrnjen; veljaven 64-hex preide', () => {
    const slab = JSON.parse(JSON.stringify(MINIMAL)) as Record<string, unknown>
    slab['photoRefs'] = [{ ref: 'x.jpg', sha256: 'aa11'.repeat(15) + 'ZZ11' }]
    expect(() => parseArSessionPayload(slab)).toThrow(ArContractError)
    const dober = JSON.parse(JSON.stringify(MINIMAL)) as Record<string, unknown>
    dober['photoRefs'] = [{ ref: 'x.jpg', sha256: 'aa11'.repeat(16) }]
    expect(() => parseArSessionPayload(dober)).not.toThrow()
  })

  it('transform rotationQ z napačno arnost (3) → zavrnjen; [x,y,z,w] 4 preide', () => {
    const slab = { ...MINIMAL, transform: { rotationQ: [0, 0, 0] } }
    expect(() => parseArSessionPayload(slab)).toThrow(ArContractError)
    const dober = { ...MINIMAL, transform: { rotationQ: [0, 0, 0, 1] } }
    expect(() => parseArSessionPayload(dober)).not.toThrow()
  })

  it('verzija 2 → AR_CONTRACT_VERSION_UNSUPPORTED z ORIGINALOM na napaki (ni izgube, D)', () => {
    const prihodnost = { ...MINIMAL, contractVersion: 2 }
    try {
      parseArSessionPayload(prihodnost)
      expect.unreachable('zavrnitev pričakovana')
    } catch (e) {
      expect(e).toBeInstanceOf(ArContractError)
      const err = e as ArContractError
      expect(err.code).toBe('AR_CONTRACT_VERSION_UNSUPPORTED')
      expect(err.payload).toEqual(prihodnost)
      expect(String(err.message)).toContain('podprto: 1')
    }
    // Migracijska kljuka je ISTA vrata (EN vir) — ista napaka.
    expect(() => migrateArSessionPayload(prihodnost)).toThrow(ArContractError)
  })

  it('konstante verzij: AR_CONTRACT_VERSION=1; podprte = [1] (združljivostna matrika EN vir)', () => {
    expect(AR_CONTRACT_VERSION).toBe(1)
    expect(SUPPORTED_AR_CONTRACT_VERSIONS).toEqual([1])
  })
})
