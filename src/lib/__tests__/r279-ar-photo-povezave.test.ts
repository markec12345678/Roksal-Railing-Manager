// R279 — SEGMENT PHOTO/GLB POVEZAVE v skupnem kontraktu (issue #16 §9:
// 'Fotografije in GLB morajo imeti stabilne reference in povezavo s
// Project → MeasurementSession → Segment. Ni dovolj samo ime datoteke.').
// photoRefs/glbRefs obstajajo od R274 (session nivo); segments[].photoIds/
// modelIds je R279 ADITIVNA razširitev v1 (semantične odločitve T1–T5 v
// src/lib/ar-contract.ts — zapisane PRED razvojem po kanonu P/Q/S):
//   • T1 aditivna v1 (NE v2) — verzija ostane 1, matrika nosi razširitev;
//   • T2 verbatim reference v session-level nize (EN VIR — nič podvajanja
//     sekcije); NE-prazni nizi (izostanek = edini 'brez'); strop 20;
//   • T3 referenčna integriteta = fail-closed superRefine — osirotela
//     referenca = zavrnitev (strukturna vez === brez tolerance — NI v
//     protislovju z Q3, ki NE vsiljuje enačb med NEODVISNIMI meritvami);
//   • T4 id-ji verbatim (brez trim/case-fold — 'ref-A' ≠ 'ref-a');
//   • T5 DB/route NIČ — arMetadata JSON verbatim, brez sheme.
// Zlati fixture (R275) ostaja NESPREMENJEN — v1 brez novih polj.
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

/** Poln veljaven payload z ZLATIMI obveznimi polji + session foto/GLB
 *  reference + nova per-segment photoIds/modelIds. */
function osnova(
  photoIds: unknown,
  modelIds: unknown,
  dodatki: { session?: Record<string, unknown>; segment?: Record<string, unknown> } = {},
): Record<string, unknown> {
  return {
    contractVersion: 1,
    appVersion: 'BalkonAR 0.9.2',
    projectId: 'proj-r279',
    sessionId: 'sess-r279',
    source: 'ARCORE_DEPTH',
    units: 'mm',
    coordinateFrame: { type: 'LOCAL_NORMALIZED' },
    ...dodatki.session,
    photoRefs: [
      { ref: 'foto-balkon-a', sha256: 'a'.repeat(64) },
      { ref: 'foto-balkon-b' },
    ],
    glbRefs: [{ ref: 'model-balkon-1', sha256: 'b'.repeat(64) }],
    segments: [
      {
        segmentId: 'seg-r279-1',
        lengthMm: 3200.75,
        heightMm: 1200,
        startMm: [0, 0],
        endMm: [3200.75, 12.5],
        confidence: 0.92,
        uncertaintyMm: 8.5,
        ...dodatki.segment,
        ...(photoIds !== undefined ? { photoIds } : {}),
        ...(modelIds !== undefined ? { modelIds } : {}),
        source: 'ARCORE_DEPTH',
      },
    ],
  }
}

describe('R279 photoIds/modelIds — sprejetje (issue #16 §9: povezava s Segment)', () => {
  it('photoIds/modelIds (verbatim reference) preidejo shemo — povezava Segment → Photo/GLB (T2)', () => {
    const parsed = parseArSessionPayload(osnova(['foto-balkon-a'], ['model-balkon-1']))
    expect(parsed.segments[0].photoIds).toEqual(['foto-balkon-a'])
    expect(parsed.segments[0].modelIds).toEqual(['model-balkon-1'])
    expect(parsed.photoRefs?.[0].ref).toBe('foto-balkon-a')
  })

  it('več referenc + referenca brez sha256 = veljavna resnica (EN VIR — sha256 ostaje opcijski, T2)', () => {
    const parsed = parseArSessionPayload(osnova(['foto-balkon-a', 'foto-balkon-b'], ['model-balkon-1']))
    expect(parsed.segments[0].photoIds).toEqual(['foto-balkon-a', 'foto-balkon-b'])
  })

  it('izostanek = brez vezave (iskrena praznina) — zlati fixture ostaja veljaven (T2)', () => {
    const parsed = parseArSessionPayload(ZLATI)
    for (const s of parsed.segments) {
      expect(s.photoIds).toBeUndefined()
      expect(s.modelIds).toBeUndefined()
    }
    const brez = parseArSessionPayload(osnova(undefined, undefined))
    expect(brez.segments[0].photoIds).toBeUndefined()
    expect(brez.segments[0].modelIds).toBeUndefined()
  })

  it('per-segment neodvisnost: en segment s vezavo, drugi brez (T2)', () => {
    const payload = osnova(['foto-balkon-a'], undefined)
    ;(payload.segments as Record<string, unknown>[]).push({
      segmentId: 'seg-r279-2',
      lengthMm: 900,
      source: 'MANUAL',
    })
    const parsed = parseArSessionPayload(payload)
    expect(parsed.segments[0].photoIds).toEqual(['foto-balkon-a'])
    expect(parsed.segments[1].photoIds).toBeUndefined()
  })

  it('prazen niz = ZAVRJEN (T2 — izostanek polja je EDINI način "brez"; ena resnica, NIKOLI dve izjavi)', () => {
    try {
      parseArSessionPayload(osnova([], undefined))
      expect.unreachable('prazen photoIds mora biti zavrnjen')
    } catch (e) {
      expect(e).toBeInstanceOf(ArContractError)
      expect((e as ArContractError).code).toBe('AR_CONTRACT_VALIDACIJA')
    }
  })
})

describe('R279 T3 — referenčna integriteta (fail-closed superRefine, nič osirotelih referenc)', () => {
  it('photoId brez nosilca v session photoRefs = ZAVRJEN (žica: nič osirotelih referenc)', () => {
    try {
      parseArSessionPayload(osnova(['foto-balkon-a', 'foto-ne-obstaja'], undefined))
      expect.unreachable('osirotela photoId mora biti zavrnjena')
    } catch (e) {
      expect(e).toBeInstanceOf(ArContractError)
      const err = e as ArContractError
      expect(err.code).toBe('AR_CONTRACT_VALIDACIJA')
      expect(err.message).toContain('nič osirotelih referenc')
      expect(err.message).toContain('foto-ne-obstaja')
    }
  })

  it('modelId brez nosilca v session glbRefs = ZAVRJEN (žica: nič osirotelih referenc)', () => {
    try {
      parseArSessionPayload(osnova(undefined, ['model-ne-obstaja']))
      expect.unreachable('osirotela modelId mora biti zavrnjena')
    } catch (e) {
      expect(e).toBeInstanceOf(ArContractError)
      expect((e as ArContractError).message).toContain('GLB referenca')
      expect((e as ArContractError).message).toContain('model-ne-obstaja')
    }
  })

  it('photoIds BREZ session photoRefs = osirotela vez = ZAVRJENA (§9: referenca brez nosilca NI vez — T3)', () => {
    const vhod = osnova(['foto-balkon-a'], undefined)
    delete vhod['photoRefs']
    try {
      parseArSessionPayload(vhod)
      expect.unreachable('photoIds brez photoRefs mora biti zavrnjen')
    } catch (e) {
      expect(e).toBeInstanceOf(ArContractError)
      expect((e as ArContractError).message).toContain('nič osirotelih referenc')
    }
  })

  it('glbRefs BREZ session niza = ZAVRJEN (istos strogost — T3)', () => {
    const vhod = osnova(undefined, ['model-balkon-1'])
    delete vhod['glbRefs']
    expect(() => parseArSessionPayload(vhod)).toThrowError(ArContractError)
  })

  it('T4 VERBATIM: case-fold ne obstaja — "foto-BALKON-A" ≠ "foto-balkon-a" = ZAVRJEN', () => {
    expect(() => parseArSessionPayload(osnova(['foto-BALKON-A'], undefined))).toThrowError(ArContractError)
    expect(() => parseArSessionPayload(osnova(['  foto-balkon-a'], undefined))).toThrowError(ArContractError)
  })

  it('en segment nevede NE pokvari drugega — žica nosi pot (segments.N.photoIds)', () => {
    const payload = osnova(['foto-balkon-a'], undefined)
    ;(payload.segments as Record<string, unknown>[]).push({
      segmentId: 'seg-r279-2',
      lengthMm: 900,
      photoIds: ['osirotela-x'],
      source: 'MANUAL',
    })
    try {
      parseArSessionPayload(payload)
      expect.unreachable('drugi segment mora pokvariti payload')
    } catch (e) {
      expect(e).toBeInstanceOf(ArContractError)
      expect((e as ArContractError).message).toContain('osirotela-x')
    }
  })
})

describe('R279 — determinizem, round-trip, matrika (T1)', () => {
  it('round-trip serialize(parse(x)) bajtno identičen (photoIds/modelIds verbatim)', () => {
    const vhod = osnova(['foto-balkon-a', 'foto-balkon-b'], ['model-balkon-1'])
    const json1 = JSON.stringify(vhod)
    const json2 = serializeArSessionPayload(parseArSessionPayload(vhod))
    expect(json2).toBe(json1)
    const ponovno = parseArSessionPayload(JSON.parse(json2))
    expect(serializeArSessionPayload(ponovno)).toBe(json2)
  })

  it('determinizem: ista resnica → ista žica', () => {
    const vhod = osnova(['foto-balkon-a'], ['model-balkon-1'])
    const a = serializeArSessionPayload(parseArSessionPayload(vhod))
    const b = serializeArSessionPayload(parseArSessionPayload(JSON.parse(JSON.stringify(vhod))))
    expect(a).toBe(b)
  })

  it('contractVersion ostane 1 — aditivna razširitev (T1); matrika nosi R279 + T1–T5 izrečno', () => {
    expect(AR_CONTRACT_VERSION).toBe(1)
    expect(SUPPORTED_AR_CONTRACT_VERSIONS).toEqual([1])
    const parsed = parseArSessionPayload(osnova(['foto-balkon-a'], undefined))
    expect(parsed.contractVersion).toBe(1)
    const razsiritev = AR_CONTRACT_COMPATIBILITY[1].razsiritev
    expect(razsiritev).toContain('R279')
    expect(razsiritev).toContain('photoIds/modelIds')
    expect(razsiritev).toContain('T1–T5')
  })

  it('nepodprta verzija 2 = ISTA vrata (AR_CONTRACT_VERSION_UNSUPPORTED z originalom — regresija R274/R277/R278)', () => {
    const vhod = osnova(['foto-balkon-a'], undefined)
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
