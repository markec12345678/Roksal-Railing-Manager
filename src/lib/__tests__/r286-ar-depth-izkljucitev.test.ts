// ---------------------------------------------------------------------------
// R286 — ISSUE #15 §12 PERFORMANCE: surov Depth material NIČ v poslovni
// sistem (dokaz na EDINIH vratah — parseArSessionPayload).
//
// Issue #15 §12: 'preveriti, da prenos AR podatkov ne prenaša nepotrebnega
// surovega Depth materiala v poslovni sistem.' Ločiti: poslovne meritve +
// potrebne metadata + fotografije + GLB + opcijski surovi/diagnostični AR
// podatki — cilj: poslovni sistem prejme VSE, kar potrebuje za delo, brez
// nepotrebne obremenitve.
//
// R286 dokaz (SEMANTIČNE ODLOČITVE D1–D4 zapisane PRED razvojem — worklog
// R286): poslovni sistem nima lastnih Depth vrst — edina vrata AR podatkov
// v poslovni sistem so skupni kontrakt v1 (parseArSessionPayload, route
// /api/measurements validira PRED transakcijo). Zato je §12 dokaz
// KONTRAKTNI in ČIST (brez DB, brez ure, brez mreže — 100 % determinističen):
//
//   D1 — dokaz = zavračanje, ne strip-anje. Odločitev 3 kontrakta (issue
//       #17): neznana prihodnja polja = ZAVRNJENA (zod strict), ne utišano
//       odstranjena. Surov Depth polje, injectirano v sicer veljaven v1
//       payload, MORA zlomiti razčlenjevanje z ArContractError
//       (AR_CONTRACT_VALIDACIJA) — NIKOLI tiho pretihniti v zapis.
//   D2 — prepovedana družina je MACHINE-CHECKED enumeracija (ne ugib):
//       depthMap / rawDepth / depthData / confidenceMap / pointCloud /
//       depthImage / depthFrame / depthBuffer / depth_raw — vsako na
//       korenu payload-a.
//   D3 — nosilci so SAMO REFERENCE: photoRefs/glbRefs = strictObject
//       { ref ≤ 300, sha256? } — binarna polja (bytes/data/binary/base64)
//       = zavrnitev; meje 500 foto / 100 GLB / ref 300 znakov so
//       DOKAZANE zgornje meje (§12 'brez nepotrebne obremenitve').
//   D4 — površinski preslikovalni dokaz: maksimalno veljaven payload
//       (VSA opcijska polja prisotna) razčlenjen → ključi NIKOLI
//       /depth|cloud|point/i (top-level + segment) — empirična žična
//       resnica površine, ne ugib o shemi.
//
// Pravila runde: route NIČ, DB NIČ, shema NIČ, core NIČ (kontrakt NIČ —
// samo IMPORT + testi), OgrajaVizija nič, 0 novih hex.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import {
  ArContractError,
  parseArSessionPayload,
  serializeArSessionPayload,
} from '@/lib/ar-contract'

/** Minimalno VELJAVEN v1 payload (sanity vrata — isti minimalen zaporedni
 *  vzorec kot r282 pariteta; segment source OBVEZEN — shema). */
const VELJAVEN = {
  contractVersion: 1 as const,
  appVersion: 'BalkonAR 0.9.3',
  projectId: 'proj-r286-depth',
  sessionId: 'sess-r286-depth',
  source: 'ARCORE_DEPTH' as const,
  units: 'mm' as const,
  coordinateFrame: { type: 'LOCAL_NORMALIZED' as const },
  segments: [{ segmentId: 'seg-r286', lengthMm: 3200, source: 'ARCORE_DEPTH' as const }],
}

/** D2 — prepovedana surovi-Depth družina (machine-checked enumeracija).
 *  Imena pokrivajo realne ARCore/Depth izhode (depth image, confidence
 *  slika, oblak točk, raw buffer) + žične variante z podčrtajem. */
const PREPOVEDANI_SUROVI_DEPTH = [
  'depthMap',
  'rawDepth',
  'depthData',
  'confidenceMap',
  'pointCloud',
  'depthImage',
  'depthFrame',
  'depthBuffer',
  'depth_raw',
] as const

function pričakujZavrnitev(vhod: unknown, pričakovanaPot: string): void {
  let napaka: unknown
  try {
    parseArSessionPayload(vhod)
    napaka = undefined
  } catch (e) {
    napaka = e
  }
  expect(napaka).toBeInstanceOf(ArContractError)
  const err = napaka as ArContractError
  // Fail-closed žica: validacijska napaka nosi polje v sporučilu (pot do
  // krivca) — NIKOLI utišano odstranjeno (odločitev 3).
  expect(err.code).toBe('AR_CONTRACT_VALIDACIJA')
  expect(err.message).toContain(pričakovanaPot)
  // D — originalni payload se pri neuspehu NE izgubi (issue #17 D).
  expect(err.payload).toEqual(vhod)
}

describe('R286 — issue #15 §12: surov Depth NIČ v poslovni sistem (kontraktni dokaz)', () => {
  it('D0 sanity: minimalen v1 payload je VELJAVEN (dokazna vrata odprta za poslovno resnico)', () => {
    const parsed = parseArSessionPayload(VELJAVEN)
    expect(parsed.segments).toHaveLength(1)
    expect(parsed.segments[0].lengthMm).toBe(3200)
  })

  it('D2 — vsako prepovedano surovi-Depth polje na KORENU payload-a = ZAVRNJENO (zod strict — ne strip)', () => {
    for (const polje of PREPOVEDANI_SUROVI_DEPTH) {
      const poskus = { ...VELJAVEN, [polje]: { zakodiran: 'A'.repeat(64) } }
      pričakujZavrnitev(poskus, polje)
    }
  })

  it('D2 — surovi Depth polje v SEGMENTU = ZAVRNJENO (na segment nivoju tudi nič nosilca)', () => {
    for (const polje of ['depthMap', 'rawDepth', 'pointCloud', 'confidenceMap'] as const) {
      const poskus = {
        ...VELJAVEN,
        segments: [{ ...VELJAVEN.segments[0], [polje]: 'A'.repeat(64) }],
      }
      pričakujZavrnitev(poskus, polje)
    }
  })

  it('D2 — surovi Depth polje v METADATA blokih (quality/calibration/transform/sync) = ZAVRNJENO', () => {
    const zBloki = {
      ...VELJAVEN,
      quality: { confidence: 0.9, depthMap: 'A'.repeat(32) },
      calibration: { model: 'TWO_POINT_SCALE' as const, referenceMm: 500, rawDepth: 1 },
      transform: { anchorId: 'a1', pointCloud: [1, 2, 3] },
      sync: { syncState: 'synced' as const, depthData: 'x' },
    }
    // Zod strict poroča VSE neznane poti — vsaka od štirih mora biti v sporučilu.
    pričakujZavrnitev(zBloki, 'depthMap')
    pričakujZavrnitev(zBloki, 'rawDepth')
    pričakujZavrnitev(zBloki, 'pointCloud')
    pričakujZavrnitev(zBloki, 'depthData')
  })

  it('D3 — foto/GLB nosilci so SAMO reference: binarna polja (bytes/data/binary/base64) = ZAVRNJENA', () => {
    const zBinarno = (refs: unknown[]) => ({
      ...VELJAVEN,
      photoRefs: refs,
    })
    for (const binarnoPolje of ['bytes', 'data', 'binary', 'base64'] as const) {
      pričakujZavrnitev(zBinarno([{ ref: 'foto-1', [binarnoPolje]: 'AAEC' }]), binarnoPolje)
    }
    const zGlbBinarno = { ...VELJAVEN, glbRefs: [{ ref: 'model-1', bytes: 'AAEC' }] }
    pričakujZavrnitev(zGlbBinarno, 'bytes')
  })

  it('D3 — dokazane zgornje meje nosilcev: ref > 300 znakov, > 500 foto, > 100 GLB = ZAVRNJENO (§12 brez obremenitve)', () => {
    pričakujZavrnitev(
      { ...VELJAVEN, photoRefs: [{ ref: 'r'.repeat(301) }] },
      'photoRefs',
    )
    pričakujZavrnitev(
      {
        ...VELJAVEN,
        photoRefs: Array.from({ length: 501 }, (_, i) => ({ ref: `foto-${i}` })),
      },
      'photoRefs',
    )
    pričakujZavrnitev(
      {
        ...VELJAVEN,
        glbRefs: Array.from({ length: 101 }, (_, i) => ({ ref: `model-${i}` })),
      },
      'glbRefs',
    )
    pričakujZavrnitev(
      {
        ...VELJAVEN,
        // Referenčna integriteta (T3): photoIds mora imeti nosilca v
        // session photoRefs — test dokazuje MEJO dolžine nosilca.
        photoRefs: [{ ref: 'r'.repeat(300) }],
        segments: [{ ...VELJAVEN.segments[0], photoIds: ['p'.repeat(301)] }],
      },
      'photoIds',
    )
  })

  it('D3 — meja je VELJAVNA na meji: 300 znakov ref, 500 foto, 100 GLB SPREJETO (spodnja stran — nosilcev nič odveč)', () => {
    const parsed = parseArSessionPayload({
      ...VELJAVEN,
      photoRefs: Array.from({ length: 500 }, (_, i) => ({ ref: `foto-${i}` })),
      glbRefs: Array.from({ length: 100 }, (_, i) => ({ ref: `model-${i}` })),
      segments: [
        {
          ...VELJAVEN.segments[0],
          // photoIds/modelIds = verbatim reference v nosilce (T3 integriteta).
          photoIds: ['foto-0'],
          modelIds: ['model-0'],
        },
      ],
    })
    expect(parsed.photoRefs).toHaveLength(500)
    expect(parsed.glbRefs).toHaveLength(100)
    // Serialize — round-trip determinizem (ref verbatim).
    expect(serializeArSessionPayload(parsed)).toContain('foto-0')
  })

  it('D4 — površinska enumeracija: razčlenjena POVRSINA (vsa opcijska polja) NIKOLI /depth|cloud|point/i — top-level', () => {
    const maksimalen = {
      ...VELJAVEN,
      coordinateFrame: { type: 'LOCAL_NORMALIZED' as const, note: 'prva točka' },
      transform: { anchorId: 'a1', translationMm: [0, 0, 0], rotationQ: [0, 0, 0, 1] },
      calibration: { model: 'TWO_POINT_SCALE' as const, referenceMm: 500 },
      quality: { confidence: 0.9, uncertaintyMm: 12.5 },
      photoRefs: [{ ref: 'foto-1' }],
      glbRefs: [{ ref: 'model-1' }],
      sync: { syncState: 'synced' as const },
    }
    const parsed = parseArSessionPayload(maksimalen)
    const kljuci = Object.keys(parsed)
    expect(kljuci.sort()).toEqual(
      [
        'appVersion',
        'calibration',
        'contractVersion',
        'coordinateFrame',
        'glbRefs',
        'photoRefs',
        'projectId',
        'quality',
        'segments',
        'sessionId',
        'source',
        'sync',
        'transform',
        'units',
      ].sort(),
    )
    expect(kljuci.some((k) => /depth|cloud|point/i.test(k))).toBe(false)
  })

  it('D4 — površinska enumeracija SEGMENTA: ključi NIKOLI /depth|cloud|point/i (žična resnica)', () => {
    const maksimalenSegment = {
      ...VELJAVEN.segments[0],
      heightMm: 1100,
      slopeDeg: 8,
      angleDeg: 90,
      startMm: [0, 0],
      endMm: [3200, 0],
      confidence: 0.88,
      uncertaintyMm: 9.5,
      photoIds: ['foto-1'],
      modelIds: ['model-1'],
      profile: 'ROMB 67',
      color: 'RAL 7016',
      material: 'ALU',
      handrail: 'da',
      posts: 'da',
      configuration: 'standard',
      measurementIndex: 0,
    }
    const parsed = parseArSessionPayload({
      ...VELJAVEN,
      // Nosilci za T3 referenčno integriteto segmentnih photoIds/modelIds.
      photoRefs: [{ ref: 'foto-1' }],
      glbRefs: [{ ref: 'model-1' }],
      segments: [maksimalenSegment],
    })
    const kljuci = Object.keys(parsed.segments[0])
    expect(kljuci.some((k) => /depth|cloud|point/i.test(k))).toBe(false)
    // ENA resnica o tem, KAJ segment nosi (19 znanih ključev — brez Depth
    // nosilca): meritve + reference + provenance, NIČ binarnega.
    expect(kljuci.sort()).toEqual(
      [
        'angleDeg',
        'color',
        'confidence',
        'configuration',
        'endMm',
        'handrail',
        'heightMm',
        'lengthMm',
        'material',
        'measurementIndex',
        'modelIds',
        'photoIds',
        'posts',
        'profile',
        'segmentId',
        'slopeDeg',
        'source',
        'startMm',
        'uncertaintyMm',
      ].sort(),
    )
  })

  it('D1 — zavračanje je FAIL-VERBOSE: napaka nosi ORIGINALNI payload (nič izgube, nič tihega strip-a)', () => {
    const poskus = { ...VELJAVEN, depthMap: 'surov-material' }
    try {
      parseArSessionPayload(poskus)
      expect.unreachable('payload s surovim Depth-om NE SME preiti vrata')
    } catch (e) {
      expect(e).toBeInstanceOf(ArContractError)
      const err = e as ArContractError
      expect(err.payload).toEqual(poskus)
      expect((err.payload as Record<string, unknown>)['depthMap']).toBe('surov-material')
    }
  })

  it('D1 — serialize NIKAJ ne naredi Depth IZHODA: ključi uspešnega parse-a NIKOLI /depth|cloud|point/i (vrednost ARCORE_DEPTH je LEGITIMEN enum — preverjajo se KLJUČI, ne vrednosti)', () => {
    // Surov Depth NIKOLI pride do serializacije: ali je payload zavrnjen
    // (D2), ali ima rezultat bajtno čiste ključe (D4). Zvezni dokaz:
    const poskus = { ...VELJAVEN, depthMap: 'x' }
    expect(() => parseArSessionPayload(poskus)).toThrow(ArContractError)
    const cist = parseArSessionPayload(VELJAVEN)
    const kljuci = [
      ...Object.keys(cist),
      ...Object.keys(cist.segments[0]),
    ]
    expect(kljuci.some((k) => /depth|cloud|point/i.test(k))).toBe(false)
  })
})
