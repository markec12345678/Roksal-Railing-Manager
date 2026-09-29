// R277 — SEGMENT KOT v skupnem kontraktu (issue #16 §3: 'Vsak segment mora
// imeti stabilen ID in podatke za nadaljnjo geometrijo: … height, angle, …').
// heightMm je obstajal od R274; angleDeg je R277 ADITIVNA razširitev v1
// (semantične odločitve P1–P6 v src/lib/ar-contract.ts — zapisane PRED
// razvojem po kanonu O1–O9):
//   • P1 aditivna v1 (NE v2) — verzija ostane 1, matrika nosi razširitev;
//   • P2 azimut CCW od +X (deg) — vrednost/znak verbatim, brez normalizacije;
//   • P3 izmerjeno, NE izpeljano — kontrakt NE računa kota iz koordinat;
//   • P4 stopinje (deg), NE radiani (isti dogovor kot slopeDeg);
//   • P5 izostanek = ni izmerjeno (iskrena praznina); ekspliciten null,
//     NaN, Infinity, niz = zavrnjeno; strict — tipografija 'kotDeg' zavrnjena;
//   • P6 DB/route NIČ — arMetadata JSON verbatim, brez sheme.
// Zlati fixture (R275) ostaje NESPREMENJEN — predstavlja v1 brez novega
// polja; ta datoteka dokazuje novo polje LOČENO.
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

/** Poln veljaven payload z ZLATIMI obveznimi polji + novi angleDeg. */
function osnova(angle: unknown, segmentDodatki: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    contractVersion: 1,
    appVersion: 'BalkonAR 0.9.2',
    projectId: 'proj-r277',
    sessionId: 'sess-r277',
    source: 'ARCORE_DEPTH',
    units: 'mm',
    coordinateFrame: { type: 'LOCAL_NORMALIZED' },
    segments: [
      {
        segmentId: 'seg-r277-1',
        lengthMm: 3200.75,
        heightMm: 1200,
        source: 'ARCORE_DEPTH',
        ...segmentDodatki,
        ...(angle !== undefined ? { angleDeg: angle } : {}),
      },
    ],
  }
}

describe('R277 angleDeg — sprejetje (issue #16 §3: angle per segment)', () => {
  it('angleDeg (pozitiven azimut) preide kanonično shemo — izmerjena resnica verbatim', () => {
    const parsed = parseArSessionPayload(osnova(90))
    expect(parsed.segments[0].angleDeg).toBe(90)
  })

  it('negativen in ulomkov kot = resnica — kontrakt NE normalizira (P2)', () => {
    const parsed = parseArSessionPayload(osnova(-45.5))
    expect(parsed.segments[0].angleDeg).toBe(-45.5)
  })

  it('0° je VELJAVNA izmerjena vrednost (prvi segment v LOCAL_NORMALIZED — P2/P5)', () => {
    const parsed = parseArSessionPayload(osnova(0))
    expect(parsed.segments[0].angleDeg).toBe(0)
  })

  it('izostanek angleDeg = kot ni izmerjen (iskrena praznina, P5) — zlati fixture še vedno veljaven', () => {
    const parsed = parseArSessionPayload(ZLATI)
    for (const s of parsed.segments) expect(s.angleDeg).toBeUndefined()
    const izostanek = parseArSessionPayload(osnova(undefined))
    expect(izostanek.segments[0].angleDeg).toBeUndefined()
  })

  it('per-segment neodvisnost: en segment s kotom, drugi brez (P3)', () => {
    const payload = osnova(undefined, {})
    ;(payload.segments as Record<string, unknown>[]).push({
      segmentId: 'seg-r277-2',
      lengthMm: 900,
      slopeDeg: -2.5,
      angleDeg: 89.75,
      source: 'MANUAL',
    })
    const parsed = parseArSessionPayload(payload)
    expect(parsed.segments[0].angleDeg).toBeUndefined()
    expect(parsed.segments[1].angleDeg).toBe(89.75)
  })

  it('round-trip: serialize(parse(x)) deep-enak vhodu in bajtno determinističen', () => {
    const vhod = osnova(123.25)
    const parsed = parseArSessionPayload(vhod)
    const niz1 = serializeArSessionPayload(parsed)
    const niz2 = serializeArSessionPayload(parseArSessionPayload(JSON.parse(niz1)))
    expect(JSON.parse(niz1)).toEqual(vhod)
    expect(niz1).toBe(niz2)
  })
})

describe('R277 angleDeg — fail-closed meje (P5)', () => {
  const poskusi = (angle: unknown) => () => parseArSessionPayload(osnova(angle))

  it('ekspliciten null = ZAVRJEN (izostanek je edini način brez vrednosti)', () => {
    expect(poskusi(null)).toThrow(ArContractError)
    try {
      poskusi(null)()
    } catch (e) {
      expect((e as ArContractError).code).toBe('AR_CONTRACT_VALIDACIJA')
      expect((e as ArContractError).message).toContain('segments.0.angleDeg')
    }
  })

  it('NaN zavrnjen (finite)', () => {
    expect(poskusi(Number.NaN)).toThrow(ArContractError)
  })

  it('Infinity zavrnjena (finite, obe smeri)', () => {
    expect(poskusi(Number.POSITIVE_INFINITY)).toThrow(ArContractError)
    expect(poskusi(Number.NEGATIVE_INFINITY)).toThrow(ArContractError)
  })

  it('niz zavrnjen (številski tip je del žične resnice)', () => {
    expect(poskusi('90')).toThrow(ArContractError)
  })

  it('strict ostaja: tipografija kotDeg = NEZNANO polje → zavrnitev (odločitev 3)', () => {
    const typo = osnova(undefined, { kotDeg: 90 })
    expect(() => parseArSessionPayload(typo)).toThrow(ArContractError)
    try {
      parseArSessionPayload(typo)
    } catch (e) {
      expect((e as ArContractError).code).toBe('AR_CONTRACT_VALIDACIJA')
      expect((e as ArContractError).message).toContain('kotDeg')
    }
  })
})

describe('R277 P1 — aditivna v1: verzija NE slabel (issue #16 §7 kompatibilna sprememba)', () => {
  it('AR_CONTRACT_VERSION ostane 1; podprte verzije ostanejo [1]', () => {
    expect(AR_CONTRACT_VERSION).toBe(1)
    expect(SUPPORTED_AR_CONTRACT_VERSIONS).toEqual([1])
  })

  it('matrika nosi razširitev IZREČNO (brez tihe tolerance)', () => {
    const v1 = AR_CONTRACT_COMPATIBILITY[1]
    expect(v1.status).toBe('aktivna')
    expect(v1.uvod).toContain('R274')
    expect((v1 as Record<string, unknown>)['razsiritev']).toContain('R277')
    expect((v1 as Record<string, unknown>)['razsiritev']).toContain('angleDeg')
  })

  it('nepodprta verzija še vedno zavrnjena z ORIGINALOM (migracijska kljuka nespremenjena)', () => {
    const v99 = { ...osnova(90), contractVersion: 99 }
    expect(() => migrateArSessionPayload(v99)).toThrow(ArContractError)
    try {
      migrateArSessionPayload(v99)
    } catch (e) {
      const err = e as ArContractError
      expect(err.code).toBe('AR_CONTRACT_VERSION_UNSUPPORTED')
      expect(err.payload).toEqual(v99)
    }
  })

  it('zlati fixture round-trip ostaja bajtno stabilen (R275 regresija skozi razširjeno shemo)', () => {
    const parsed = parseArSessionPayload(ZLATI)
    const niz = serializeArSessionPayload(parsed)
    expect(JSON.parse(niz)).toEqual(ZLATI)
  })
})
