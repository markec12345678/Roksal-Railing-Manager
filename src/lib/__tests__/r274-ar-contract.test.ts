// R274 — testi (issue #17, sekcija A + B + D — AR skupni kontrakt).
// ---------------------------------------------------------------------------
//   • lib/ar-contract: kanonična shema MeasurementSession payload-a
//     (BalkonAR ↔ Roksal) — contractVersion OBVEZEN (D), združljivostna
//     matrika, napačna verzija ZAVRNJENA z originalnim payload-om (D: ni
//     izgube), neznana polja ZAVRNJENA (strict — ne tiho odstranjena),
//     source enum ARCORE_DEPTH/MANUAL/PHOTO_CV (B), enote 'mm' eksplicitno
//     (B: nespremenjene — brez zaokroževanja), ID-ji passthrough VERBATIM
//     (B), coordinate frame LOCAL_NORMALIZED + ARCore transform + kalibracija
//     + quality + photo/glb reference (A), deterministična serializacija.
//   • POST /api/measurements: kontrakt-payload (nosi contractVersion) →
//     validacija PRED transakcijo; napaka → 400 z žično kodo, NIČ zapisano,
//     projekt status OSTANE nespremenjen (B: 'napaka payload-a ne spremeni
//     obstoječega projekta'), Idempotency-Key NI rezerviran (retry čist).
//     Veljaven payload → zapisan v kanonični obliki; obstoječi poslovni tok
//     (NACRTOVANO → V_TEKU) NESPREMENJEN. Legacy payload (brez
//     contractVersion — balkonar blok) → stara pot NESPREMENJENA
//     (nadgrajevljivost, R148 vzorec).
//   • Measurement SDK core (src/lib/measurement/*) NIČ — issue #17:
//     obstoječa infrastruktura se NE ponovno implementira NE oslabi.
//
// Handlerji direktno, baza roksal_test prek globalSetup (vzorec R128–R154).
import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import {
  AR_CONTRACT_VERSION,
  AR_CONTRACT_COMPATIBILITY,
  SUPPORTED_AR_CONTRACT_VERSIONS,
  ArContractError,
  isArContractPayload,
  migrateArSessionPayload,
  parseArSessionPayload,
  serializeArSessionPayload,
} from '@/lib/ar-contract'
import { POST as measurementsPost } from '@/app/api/measurements/route'

const BASE = 'http://localhost/api'
const TAG = 'r274'
const ZETON = 'r274-zeton'

/** Veljaven minimalen kontrakt-payload (v1). */
function veljaven(razširitve: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    contractVersion: 1,
    appVersion: 'BalkonAR 1.4.2',
    projectId: `balkonar-proj-${TAG}`,
    sessionId: `balkonar-ses-${TAG}`,
    source: 'ARCORE_DEPTH',
    units: 'mm',
    coordinateFrame: { type: 'LOCAL_NORMALIZED' },
    segments: [{ segmentId: `seg-${TAG}-a`, lengthMm: 3200, source: 'ARCORE_DEPTH' }],
    ...razširitve,
  }
}

function jsonReq(token: string | null, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${BASE}/measurements`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

async function makeProject(naziv: string, status = 'NACRTOVANO'): Promise<string> {
  const customer = await db.customer.create({
    data: { ime: `Stranka ${TAG} ${naziv} ${Date.now()}`, naslov: 'Test 1' },
  })
  const project = await db.project.create({
    data: { customerId: customer.id, nazivProjekta: naziv, status: status as 'NACRTOVANO' },
  })
  return project.id
}

let adminToken: string

beforeEach(async () => {
  await db.measurement.deleteMany({ where: { project: { nazivProjekta: { contains: TAG } } } })
  await db.project.deleteMany({ where: { nazivProjekta: { contains: TAG } } })
  await db.customer.deleteMany({ where: { ime: { contains: TAG } } })
  await db.idempotencyKey.deleteMany({ where: { key: { contains: TAG } } })
  adminToken = (await createTestUserWithSession(`${TAG}admin`, 'ADMIN')).token
})

// ===========================================================================
// 1. Konstante + združljivostna matrika (D)
// ===========================================================================

describe('ar-contract konstante (issue #17 D)', () => {
  it('verzija 1 je trenutna in edina podprta (matrika = EN vir)', () => {
    expect(AR_CONTRACT_VERSION).toBe(1)
    expect(SUPPORTED_AR_CONTRACT_VERSIONS).toEqual([1])
    expect(AR_CONTRACT_COMPATIBILITY[1].status).toBe('aktivna')
  })

  it('isArContractPayload: true samo za objekt z integralno contractVersion', () => {
    expect(isArContractPayload(veljaven())).toBe(true)
    expect(isArContractPayload({ contractVersion: 2 })).toBe(true)
    expect(isArContractPayload({})).toBe(false)
    expect(isArContractPayload({ contractVersion: '1' })).toBe(false)
    expect(isArContractPayload({ contractVersion: 1.5 })).toBe(false)
    expect(isArContractPayload(null)).toBe(false)
    expect(isArContractPayload([1])).toBe(false)
    expect(isArContractPayload('kontrakt')).toBe(false)
    // Legacy balkonar blok (R120) — brez contractVersion = NI kontrakt-payload.
    expect(isArContractPayload({ oznaka: 'a1', source: 'ar_snapshot', balkonar: { x: 1 } })).toBe(false)
  })
})

// ===========================================================================
// 2. Migracijska kljuka + verzije (D: zavrnitev brez izgube)
// ===========================================================================

describe('migrateArSessionPayload (D — napačna verzija se zavrne, original ne izgine)', () => {
  it('v1 → identiteta (ISTI reference, brez mutacije — deepFreeze varuje)', () => {
    const vhod = veljaven() as {
      segments: Array<Record<string, unknown>>
      coordinateFrame: Record<string, unknown>
      [key: string]: unknown
    }
    Object.freeze(vhod)
    Object.freeze(vhod.segments)
    Object.freeze(vhod.segments[0])
    Object.freeze(vhod.coordinateFrame)
    const izhod = migrateArSessionPayload(vhod)
    expect(izhod).toBe(vhod)
    // deepFreeze bi metala pri vsakem poskusu mutacije — ker vračamo ISTI
    // referenco brez mutacije, je to dokaz brez stranskih učinkov.
    expect((izhod as Record<string, unknown>)['contractVersion']).toBe(1)
  })

  it('verzija 0 / 2 → AR_CONTRACT_VERSION_UNSUPPORTED s seznamom podprtih + original payload na napaki', () => {
    for (const verzija of [0, 2, 99]) {
      const vhod = veljaven({ contractVersion: verzija })
      try {
        parseArSessionPayload(vhod)
        expect.unreachable(`verzija ${verzija} mora pasti`)
      } catch (e) {
        expect(e).toBeInstanceOf(ArContractError)
        const err = e as ArContractError
        expect(err.code).toBe('AR_CONTRACT_VERSION_UNSUPPORTED')
        expect(err.message).toContain(`contractVersion ${verzija}`)
        expect(err.message).toContain('podprto: 1')
        expect(err.payload).toBe(vhod) // ISTI reference — ni izgube (D)
      }
    }
  })

  it('manjkajoča / ne-integralna verzija → izrecne kode, original priložen', () => {
    const brez = { appVersion: 'x', segments: [] }
    try {
      parseArSessionPayload(brez)
      expect.unreachable()
    } catch (e) {
      expect((e as ArContractError).code).toBe('AR_CONTRACT_VERZIJA_MANJKA')
      expect((e as ArContractError).payload).toBe(brez)
    }
    try {
      parseArSessionPayload(veljaven({ contractVersion: 1.5 }))
      expect.unreachable()
    } catch (e) {
      expect((e as ArContractError).code).toBe('AR_CONTRACT_VERZIJA_NEVELJAVNA')
    }
    try {
      parseArSessionPayload(veljaven({ contractVersion: '1' }))
      expect.unreachable()
    } catch (e) {
      expect((e as ArContractError).code).toBe('AR_CONTRACT_VERZIJA_NEVELJAVNA')
    }
  })
})

// ===========================================================================
// 3. Kanonična shema — vrata, enum, enote, ID-ji (A + B)
// ===========================================================================

describe('parseArSessionPayload — vrata (fail-closed)', () => {
  it('ni objekt (string/null/array) → AR_CONTRACT_NI_OBJEKT', () => {
    for (const vhod of ['kontrakt', null, 42, [veljaven()]]) {
      try {
        parseArSessionPayload(vhod)
        expect.unreachable()
      } catch (e) {
        expect((e as ArContractError).code).toBe('AR_CONTRACT_NI_OBJEKT')
      }
    }
  })

  it('veljaven minimalen payload preide in vrne kanonično obliko', () => {
    const parsed = parseArSessionPayload(veljaven())
    expect(parsed.contractVersion).toBe(1)
    expect(parsed.units).toBe('mm')
    expect(parsed.source).toBe('ARCORE_DEPTH')
    expect(parsed.segments).toHaveLength(1)
    expect(parsed.segments[0].segmentId).toBe(`seg-${TAG}-a`)
  })

  it('neznano top-level polje → AR_CONTRACT_VALIDACIJA s potjo (strict, ni tihega stripa)', () => {
    try {
      parseArSessionPayload(veljaven({ prihodnjePolje: true }))
      expect.unreachable()
    } catch (e) {
      const err = e as ArContractError
      expect(err.code).toBe('AR_CONTRACT_VALIDACIJA')
      expect(err.message).toContain('prihodnjePolje')
    }
  })

  it('neznano gnezdeno polje (segment) → AR_CONTRACT_VALIDACIJA s potjo', () => {
    const vhod = veljaven({
      segments: [{ segmentId: 's1', lengthMm: 1000, source: 'MANUAL', ugibanje: 42 }],
    })
    try {
      parseArSessionPayload(vhod)
      expect.unreachable()
    } catch (e) {
      const err = e as ArContractError
      expect(err.code).toBe('AR_CONTRACT_VALIDACIJA')
      // zod v4 strict: pot = 'segments.0', ključ v sporočilu 'Unrecognized key: "ugibanje"'
      expect(err.message).toContain('segments.0')
      expect(err.message).toContain('ugibanje')
    }
  })
})

describe('parseArSessionPayload — source enum (B: ARCORE_DEPTH/MANUAL/PHOTO_CV)', () => {
  it('vse tri vrednosti sprejete (top + per-segment)', () => {
    for (const vir of ['ARCORE_DEPTH', 'MANUAL', 'PHOTO_CV'] as const) {
      const parsed = parseArSessionPayload(veljaven({ source: vir, segments: [{ segmentId: 's', lengthMm: 10, source: vir }] }))
      expect(parsed.source).toBe(vir)
      expect(parsed.segments[0].source).toBe(vir)
    }
  })

  it('tuje vrednosti zavrnjene (SDK enumi, lower-case, LIDAR)', () => {
    for (const vir of ['automatic', 'manual', 'hybrid', 'arcore_depth', 'LIDAR', 'ARCORE', '']) {
      try {
        parseArSessionPayload(veljaven({ source: vir }))
        expect.unreachable(`source '${vir}' mora pasti`)
      } catch (e) {
        expect((e as ArContractError).code).toBe('AR_CONTRACT_VALIDACIJA')
      }
    }
  })
})

describe('parseArSessionPayload — enote + vrednosti (B: metri/enote ostanejo nespremenjene)', () => {
  it("samo 'mm' sprejeta; manjka / 'cm' / 'm' zavrnjena", () => {
    expect(parseArSessionPayload(veljaven()).units).toBe('mm')
    const brez = veljaven()
    delete (brez as Record<string, unknown>)['units']
    expect(() => parseArSessionPayload(brez)).toThrow(ArContractError)
    for (const enota of ['cm', 'm', 'MM', '']) {
      try {
        parseArSessionPayload(veljaven({ units: enota }))
        expect.unreachable(`units '${enota}' mora pasti`)
      } catch (e) {
        expect((e as ArContractError).code).toBe('AR_CONTRACT_VALIDACIJA')
      }
    }
  })

  it('lengthMm: 0 / negativno / NaN / Infinity zavrnjeno; float ostane NEzaokrožen', () => {
    for (const dolzina of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      try {
        parseArSessionPayload(veljaven({ segments: [{ segmentId: 's', lengthMm: dolzina, source: 'ARCORE_DEPTH' }] }))
        expect.unreachable(`lengthMm ${dolzina} mora pasti`)
      } catch (e) {
        expect((e as ArContractError).code).toBe('AR_CONTRACT_VALIDACIJA')
      }
    }
    const parsed = parseArSessionPayload(veljaven({ segments: [{ segmentId: 's', lengthMm: 3200.75, source: 'ARCORE_DEPTH' }] }))
    expect(parsed.segments[0].lengthMm).toBe(3200.75) // brez zaokroževanja (odločitev 2)
  })

  it('slopeDeg znak = del resnice (negativen naklon legitimen — R272 precedens)', () => {
    const parsed = parseArSessionPayload(veljaven({ segments: [{ segmentId: 's', lengthMm: 1000, slopeDeg: -12.5, source: 'MANUAL' }] }))
    expect(parsed.segments[0].slopeDeg).toBe(-12.5)
  })

  it('segments: prazen seznam zavrnjen; segmentId prazen/predolg zavrnjen', () => {
    try {
      parseArSessionPayload(veljaven({ segments: [] }))
      expect.unreachable()
    } catch (e) {
      expect((e as ArContractError).code).toBe('AR_CONTRACT_VALIDACIJA')
    }
    for (const id of ['', 'x'.repeat(129)]) {
      try {
        parseArSessionPayload(veljaven({ segments: [{ segmentId: id, lengthMm: 100, source: 'MANUAL' }] }))
        expect.unreachable()
      } catch (e) {
        expect((e as ArContractError).code).toBe('AR_CONTRACT_VALIDACIJA')
      }
    }
  })
})

describe('parseArSessionPayload — ID-ji passthrough verbatim (B: ID-ji ostanejo nespremenjeni)', () => {
  it('eksotični, a veljavni ID-ji preživejo bajtno identično (brez trim/case-fold)', () => {
    const eksoticni = {
      projectId: 'balkonar-Projekt_ž Č/š-42  (vhodni)',
      sessionId: 'ses|uuid+znak$43',
      segments: [{ segmentId: 'SEG-ž-002  traversal', lengthMm: 1500, source: 'PHOTO_CV' }],
    }
    const parsed = parseArSessionPayload(veljaven(eksoticni))
    expect(parsed.projectId).toBe(eksoticni.projectId)
    expect(parsed.sessionId).toBe(eksoticni.sessionId)
    expect(parsed.segments[0].segmentId).toBe(eksoticni.segments[0].segmentId)
  })
})

describe('parseArSessionPayload — frame + transform + kalibracija + quality (A)', () => {
  it("coordinateFrame: samo 'LOCAL_NORMALIZED' v v1; tuji tip zavrnjen; note preživi", () => {
    const sNote = parseArSessionPayload(veljaven({ coordinateFrame: { type: 'LOCAL_NORMALIZED', note: 'prva točka v izhodišču, prvi rob vzdolž +X' } }))
    expect(sNote.coordinateFrame.note).toBe('prva točka v izhodišču, prvi rob vzdolž +X')
    try {
      parseArSessionPayload(veljaven({ coordinateFrame: { type: 'AR_WORLD' } }))
      expect.unreachable()
    } catch (e) {
      expect((e as ArContractError).code).toBe('AR_CONTRACT_VALIDACIJA')
    }
  })

  it('transform: anchorId + translationMm + rotationQ preživijo; ne-finite zavrnjen', () => {
    const transform = { anchorId: 'anchor-1', translationMm: [12.5, -3, 1000], rotationQ: [0, 0, 0, 1] }
    const parsed = parseArSessionPayload(veljaven({ transform }))
    expect(parsed.transform).toEqual(transform)
    try {
      parseArSessionPayload(veljaven({ transform: { rotationQ: [0, 0, 0, Number.POSITIVE_INFINITY] } }))
      expect.unreachable()
    } catch (e) {
      expect((e as ArContractError).code).toBe('AR_CONTRACT_VALIDACIJA')
    }
  })

  it('kalibracija se ne izgubi (model enum + referenceMm > 0); 0 / tuji model zavrnjena', () => {
    const kalibracija = { model: 'TWO_POINT_SCALE', referenceMm: 600, note: 'ploščica' }
    const parsed = parseArSessionPayload(veljaven({ calibration: kalibracija }))
    expect(parsed.calibration).toEqual(kalibracija)
    for (const pokvarjen of [{ model: 'TWO_POINT_SCALE', referenceMm: 0 }, { model: 'MAGIČNA', referenceMm: 600 }]) {
      try {
        parseArSessionPayload(veljaven({ calibration: pokvarjen }))
        expect.unreachable()
      } catch (e) {
        expect((e as ArContractError).code).toBe('AR_CONTRACT_VALIDACIJA')
      }
    }
    // Vsi trije modeli preživijo.
    for (const model of ['TWO_POINT_SCALE', 'KNOWN_OBJECT', 'MARKER_PLATE'] as const) {
      expect(parseArSessionPayload(veljaven({ calibration: { model, referenceMm: 100 } })).calibration?.model).toBe(model)
    }
  })

  it('quality: confidence 0..1, uncertaintyMm > 0; 1.5 / negativna negotovost zavrnjena', () => {
    const quality = { confidence: 0.87, uncertaintyMm: 4.2, note: 'glossy steklo' }
    const parsed = parseArSessionPayload(veljaven({ quality }))
    expect(parsed.quality).toEqual(quality)
    for (const pokvaren of [{ confidence: 1.5 }, { uncertaintyMm: -1 }, { confidence: 2 }]) {
      try {
        parseArSessionPayload(veljaven({ quality: pokvaren }))
        expect.unreachable()
      } catch (e) {
        expect((e as ArContractError).code).toBe('AR_CONTRACT_VALIDACIJA')
      }
    }
  })

  it('photoRefs + glbRefs ostanejo povezani (B); prazen ref / napačen sha256 zavrnjen', () => {
    const refs = {
      photoRefs: [{ ref: 'balkonar://f/1.jpg', sha256: 'a'.repeat(64) }],
      glbRefs: [{ ref: 'balkonar://model/ogrebalica.glb' }],
    }
    const parsed = parseArSessionPayload(veljaven(refs))
    expect(parsed.photoRefs).toEqual(refs.photoRefs)
    expect(parsed.glbRefs).toEqual(refs.glbRefs)
    for (const pokvarjen of [{ photoRefs: [{ ref: '' }] }, { photoRefs: [{ ref: 'x', sha256: 'abc' }] }]) {
      try {
        parseArSessionPayload(veljaven(pokvarjen))
        expect.unreachable()
      } catch (e) {
        expect((e as ArContractError).code).toBe('AR_CONTRACT_VALIDACIJA')
      }
    }
  })

  it('appVersion obvezen (provenance): manjka / prazen / predolg zavrnjen', () => {
    const brez = veljaven()
    delete (brez as Record<string, unknown>)['appVersion']
    expect(() => parseArSessionPayload(brez)).toThrow(ArContractError)
    expect(() => parseArSessionPayload(veljaven({ appVersion: '' }))).toThrow(ArContractError)
    expect(() => parseArSessionPayload(veljaven({ appVersion: 'x'.repeat(65) }))).toThrow(ArContractError)
    expect(parseArSessionPayload(veljaven({ appVersion: 'BalkonAR 2.0-rc1 (build 4482)' })).appVersion).toBe('BalkonAR 2.0-rc1 (build 4482)')
  })
})

// ===========================================================================
// 4. Determinizem + round-trip (100 % deterministično — kanon)
// ===========================================================================

describe('serializeArSessionPayload (determinizem + round-trip)', () => {
  it('enak payload → enak niz (dva klica bajtno identična)', () => {
    const payload = parseArSessionPayload(veljaven({
      transform: { translationMm: [1, 2, 3], rotationQ: [0, 0, 0, 1] },
      calibration: { model: 'MARKER_PLATE', referenceMm: 400 },
      quality: { confidence: 0.5 },
      photoRefs: [{ ref: 'p://1' }],
      glbRefs: [{ ref: 'g://1.glb', sha256: 'b'.repeat(64) }],
      segments: [
        { segmentId: 's1', lengthMm: 3200.5, source: 'ARCORE_DEPTH' },
        { segmentId: 's2', lengthMm: 800, slopeDeg: -1.5, source: 'MANUAL', measurementIndex: 1 },
      ],
    }))
    expect(serializeArSessionPayload(payload)).toBe(serializeArSessionPayload(payload))
  })

  it('round-trip: serialize → parse → deep-equal (ID-ji + mm + viri nespremenjeni)', () => {
    const original = parseArSessionPayload(veljaven({ segments: [{ segmentId: 'seg|ž', lengthMm: 3200.75, source: 'PHOTO_CV' }] }))
    const ponovno = parseArSessionPayload(JSON.parse(serializeArSessionPayload(original)))
    expect(ponovno).toEqual(original)
    expect(ponovno.segments[0].lengthMm).toBe(3200.75)
  })

  it('serializacija NE mutira vhoda', () => {
    const payload = parseArSessionPayload(veljaven())
    const pred = serializeArSessionPayload(payload)
    serializeArSessionPayload(payload)
    expect(serializeArSessionPayload(payload)).toBe(pred)
  })
})

// ===========================================================================
// 5. POST /api/measurements — kontrakt gate (B: napaka ne spremeni projekta)
// ===========================================================================

describe('POST /api/measurements — AR skupni kontrakt gate (R274)', () => {
  it('veljaven kontrakt-payload → 201 + zapisan v KANONIČNI obliki + obstoječi tok (NACRTOVANO → V_TEKU) nespremenjen', async () => {
    const projectId = await makeProject(`Projekt ${TAG} kontrakt ok`)
    const res = await measurementsPost(jsonReq(adminToken, { projectId, dolzinaMm: 3200, visinaMm: 1100, arMetadata: veljaven() }))
    expect(res.status).toBe(201)
    const zapisana = (await res.json()) as { id: string; arMetadata: string }
    expect(JSON.parse(zapisana.arMetadata)).toEqual(veljaven())
    const projekt = await db.project.findUniqueOrThrow({ where: { id: projectId } })
    expect(projekt.status).toBe('V_TEKU') // obstoječi poslovni tok OSTAJA
    const stevec = await db.measurement.count({ where: { projectId } })
    expect(stevec).toBe(1)
  })

  it('legacy payload (brez contractVersion — balkonar blok) → 201, zapisan verbatim (nadgrajevljivost)', async () => {
    const projectId = await makeProject(`Projekt ${TAG} legacy`)
    const legacy = { oznaka: 'rob-a', source: 'ar_snapshot', enota: 'mm', balkonar: { tocke: [[0, 0], [3200, 0]] } }
    const res = await measurementsPost(jsonReq(adminToken, { projectId, dolzinaMm: 3200, visinaMm: 1100, arMetadata: legacy }))
    expect(res.status).toBe(201)
    const zapisana = (await res.json()) as { arMetadata: string }
    expect(JSON.parse(zapisana.arMetadata)).toEqual(legacy) // NIČ preslikave — verbatim
  })

  it('nepodprta verzija → 400 + koda + NIČ zapisano + projekt status OSTANE NACRTOVANO (B)', async () => {
    const projectId = await makeProject(`Projekt ${TAG} verzija`)
    const pred = await db.measurement.count({ where: { projectId } })
    const res = await measurementsPost(jsonReq(adminToken, { projectId, dolzinaMm: 100, visinaMm: 100, arMetadata: veljaven({ contractVersion: 2 }) }))
    expect(res.status).toBe(400)
    const telo = (await res.json()) as { code?: string; podrobnost?: string }
    expect(telo.code).toBe('AR_CONTRACT_VERSION_UNSUPPORTED')
    expect(telo.podrobnost).toContain('podprto: 1')
    expect(await db.measurement.count({ where: { projectId } })).toBe(pred) // nič zapisano
    const projekt = await db.project.findUniqueOrThrow({ where: { id: projectId } })
    expect(projekt.status).toBe('NACRTOVANO') // B: napaka payload-a ne spremeni projekta
  })

  it('neznano polje → 400 + pot v odgovoru + NIČ zapisano (strict gate na vratih)', async () => {
    const projectId = await makeProject(`Projekt ${TAG} neznano`)
    const pred = await db.measurement.count({ where: { projectId } })
    const res = await measurementsPost(jsonReq(adminToken, { projectId, dolzinaMm: 100, visinaMm: 100, arMetadata: veljaven({ prihodnjePolje: 1 }) }))
    expect(res.status).toBe(400)
    const telo = (await res.json()) as { code?: string; podrobnost?: string }
    expect(telo.code).toBe('AR_CONTRACT_VALIDACIJA')
    expect(telo.podrobnost).toContain('prihodnjePolje')
    expect(await db.measurement.count({ where: { projectId } })).toBe(pred)
  })

  it('tuji source (SDK enum, ne kontrakt) → 400 + NIČ zapisano (fail-closed vrata)', async () => {
    const projectId = await makeProject(`Projekt ${TAG} source`)
    const pred = await db.measurement.count({ where: { projectId } })
    const res = await measurementsPost(jsonReq(adminToken, { projectId, dolzinaMm: 100, visinaMm: 100, arMetadata: veljaven({ source: 'automatic' }) }))
    expect(res.status).toBe(400)
    expect(((await res.json()) as { code?: string }).code).toBe('AR_CONTRACT_VALIDACIJA')
    expect(await db.measurement.count({ where: { projectId } })).toBe(pred)
  })

  it('Idempotency-Key NI rezerviran ob 400 — isti ključ po popravku uspe (čist retry)', async () => {
    const projectId = await makeProject(`Projekt ${TAG} idem`)
    const kljuc = `${TAG}-idem-key-${Date.now()}-aaaaaaaa`
    const slabo = await measurementsPost(
      jsonReq(adminToken, { projectId, dolzinaMm: 100, visinaMm: 100, arMetadata: veljaven({ contractVersion: 3 }) }, { 'Idempotency-Key': kljuc }),
    )
    expect(slabo.status).toBe(400)
    const dobro = await measurementsPost(
      jsonReq(adminToken, { projectId, dolzinaMm: 3200, visinaMm: 1100, arMetadata: veljaven() }, { 'Idempotency-Key': kljuc }),
    )
    expect(dobro.status).toBe(201) // rezervacija NI ostala — ključ uporaben
    expect(await db.measurement.count({ where: { projectId } })).toBe(1)
  })
})
