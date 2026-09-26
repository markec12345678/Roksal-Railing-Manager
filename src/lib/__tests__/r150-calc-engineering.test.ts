// R150 — testi (issue #5 §32–34 — engineering/versioning: kalkulator).
// ---------------------------------------------------------------------------
//   • Lib determinizem: fnv1a32Hex (znane vrednosti + determinizem),
//     canonicalizeCalcInput (vrstni red ključev ne vpliva, normalizacija
//     števil, ne-končna vrednost vidno označena), calcInputFingerprint
//     (verzija formule vezana v hash — sprememba verzije = novi odtisi).
//   • Validacijske matrike (fail-closed): railing (meje umerjenosti,
//     relacije letvica/razmik ≤ dolžina, enum), anchoring (celo število
//     lukenj, globina/premer/temperatura, enum), wind (višina 0 → NAPAKA —
//     prej tiho LOW tveganje!, hitrost, površina, enuma).
//   • Ovojnice: ok → rezultat = DIREKTNA matematika lib/calculator.ts
//     (ovojnica NIKOLI ne spreminja izračuna) + formulaVersion + inputHash;
//     fail → errors, brez rezultata.
//   • POST /api/calculator: anon → 401, veljaven railing → 200 z
//     formulaVersion/inputHash, zod-veljaven a izven umerjenosti → 400 z
//     izrecnimi napakami, GET register formul (anon → 401, seja → 200).
//
// Handlerji direktno, baza roksal_test prek globalSetup (vzorec R128–R149).
import { describe, expect, it } from 'vitest'
import { POST as calculatorPost, GET as calculatorGet } from '@/app/api/calculator/route'
import {
  fnv1a32Hex,
  canonicalizeCalcInput,
  calcInputFingerprint,
  validateRailingEngineering,
  validateAnchoringEngineering,
  validateWindEngineering,
  runRailingCalcV1,
  runAnchoringCalcV1,
  runWindCalcV1,
  CALC_FORMULA_VERSIONS,
  CALC_CALIBRATION,
} from '@/lib/calc-engineering'
import {
  calculateRailingSpacing,
  calculateAnchoring,
  calculateWindLoad,
} from '@/lib/calculator'
import { createTestUserWithSession } from './helpers/test-session'

const BASE = 'http://localhost/api'

function jsonReq(
  reqPath: string,
  token: string | null,
  init: { method?: string; body?: unknown } = {},
): Request {
  return new Request(`${BASE}${reqPath}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
}

// ── Lib: fnv1a32Hex ─────────────────────────────────────────────────────────

describe('R150 §32 fnv1a32Hex (deterministični hash)', () => {
  it('velja znane FNV-1a 32-bit vrednosti', () => {
    expect(fnv1a32Hex('')).toBe('811c9dc5')
    expect(fnv1a32Hex('a')).toBe('e40c292c')
    expect(fnv1a32Hex('foobar')).toBe('bf9cf968')
  })

  it('je determinističen (100× isti izhod) in 8-mestni hex', () => {
    const first = fnv1a32Hex('roksal-kalkulator')
    for (let i = 0; i < 100; i++) {
      expect(fnv1a32Hex('roksal-kalkulator')).toBe(first)
    }
    expect(first).toMatch(/^[0-9a-f]{8}$/)
  })

  it('različni vhodi → različni hashi (sanity)', () => {
    expect(fnv1a32Hex('vhod-a')).not.toBe(fnv1a32Hex('vhod-b'))
  })
})

// ── Lib: canonicalizeCalcInput ──────────────────────────────────────────────

describe('R150 §33 canonicalizeCalcInput (kanonična oblika)', () => {
  it('vrstni red ključev NE vpliva na kanonično obliko', () => {
    const a = canonicalizeCalcInput({ totalLengthMm: 5000, slatWidthMm: 140, maxGapMm: 99 })
    const b = canonicalizeCalcInput({ maxGapMm: 99, slatWidthMm: 140, totalLengthMm: 5000 })
    expect(a).toBe(b)
  })

  it('normalizira števila deterministično (cela ostanejo cela, decimala na 4 mesta)', () => {
    expect(canonicalizeCalcInput({ x: 5 })).toBe('x=n5')
    expect(canonicalizeCalcInput({ x: 2.5 })).toBe('x=n2.5')
    expect(canonicalizeCalcInput({ x: 2.123456789 })).toBe('x=n2.1235')
    expect(canonicalizeCalcInput({ x: 1.2, y: 'profil' })).toBe('x=n1.2|y=sprofil')
  })

  it('ne-končne vrednosti so VIDNO označene (odtis NaN ≠ odtis števila)', () => {
    const nanForm = canonicalizeCalcInput({ x: NaN })
    expect(nanForm).toBe('x=nNaN')
    expect(canonicalizeCalcInput({ x: Infinity })).toBe('x=nInfinity')
    expect(nanForm).not.toBe(canonicalizeCalcInput({ x: 1 }))
  })
})

// ── Lib: calcInputFingerprint ───────────────────────────────────────────────

describe('R150 §33/§34 calcInputFingerprint (verzija vezana v odtis)', () => {
  it('nosi verzijo formule in je determinističen za isti vhod (100×)', () => {
    const input = { totalLengthMm: 5000, slatWidthMm: 140, maxGapMm: 99, profileType: 'classic' }
    const fp1 = calcInputFingerprint('railing', input)
    expect(fp1.formulaVersion).toBe('rail-v1')
    for (let i = 0; i < 100; i++) {
      expect(calcInputFingerprint('railing', input)).toEqual(fp1)
    }
  })

  it('isti vhod, drugačen vrstni red ključev → ISTI odtis', () => {
    const a = calcInputFingerprint('railing', { totalLengthMm: 5000, slatWidthMm: 140, maxGapMm: 99, profileType: 'classic' })
    const b = calcInputFingerprint('railing', { profileType: 'classic', maxGapMm: 99, slatWidthMm: 140, totalLengthMm: 5000 })
    expect(a.inputHash).toBe(b.inputHash)
  })

  it('odtis je vezan na tip izračuna (isti vhod, drug tip → drug odtis)', () => {
    const rail = calcInputFingerprint('railing', { totalLengthMm: 5000 })
    const wind = calcInputFingerprint('wind', { totalLengthMm: 5000 })
    expect(rail.inputHash).not.toBe(wind.inputHash)
    expect(rail.formulaVersion).toBe('rail-v1')
    expect(wind.formulaVersion).toBe('wind-v1')
  })
})

// ── Lib: validacijske matrike (fail-closed) ─────────────────────────────────

describe('R150 §32 validateRailingEngineering', () => {
  const veljaven = { totalLengthMm: 5000, slatWidthMm: 140, maxGapMm: 99, profileType: 'classic' }

  it('veljaven vhod → prazen seznam napak', () => {
    expect(validateRailingEngineering(veljaven)).toEqual([])
  })

  it('ne-končne vrednosti → eksplicitna napaka (prej tiho nonsens)', () => {
    const errs = validateRailingEngineering({ ...veljaven, totalLengthMm: Infinity })
    expect(errs.some((e) => e.includes('končno število'))).toBe(true)
    expect(validateRailingEngineering({ ...veljaven, slatWidthMm: NaN }).length).toBeGreaterThan(0)
  })

  it('izven območja umerjenosti → napaka z mejami', () => {
    const errs = validateRailingEngineering({ ...veljaven, totalLengthMm: 50 })
    expect(errs.some((e) => e.includes('izven območja umerjenosti') && e.includes('100'))).toBe(true)
    expect(validateRailingEngineering({ ...veljaven, totalLengthMm: 100001 }).length).toBeGreaterThan(0)
    expect(validateRailingEngineering({ ...veljaven, maxGapMm: 500 }).length).toBeGreaterThan(0)
  })

  it('fizične relacije: letvica/razmik širša od ograje → napaka', () => {
    expect(validateRailingEngineering({ ...veljaven, slatWidthMm: 6000 }).some((e) => e.includes('ne sme presegati skupne dolžine'))).toBe(true)
    expect(validateRailingEngineering({ ...veljaven, maxGapMm: 190, totalLengthMm: 150 }).some((e) => e.includes('ne sme presegati skupne dolžine'))).toBe(true)
  })

  it('neveljaven enum profila → napaka', () => {
    expect(validateRailingEngineering({ ...veljaven, profileType: 'baklava' }).some((e) => e.includes('Tip profila'))).toBe(true)
  })
})

describe('R150 §32 validateAnchoringEngineering', () => {
  const veljaven = { holeCount: 4, holeDepthMm: 80, holeDiameterMm: 12, temperature: 20, anchorType: 'hilti-hit' }

  it('veljaven vhod → prazen seznam napak', () => {
    expect(validateAnchoringEngineering(veljaven)).toEqual([])
  })

  it('necelo število lukenj → napaka', () => {
    expect(validateAnchoringEngineering({ ...veljaven, holeCount: 2.5 }).some((e) => e.includes('celo število'))).toBe(true)
  })

  it('meje: 0 lukenj, globina 5 mm, premer 2 mm → napake', () => {
    expect(validateAnchoringEngineering({ ...veljaven, holeCount: 0 }).length).toBeGreaterThan(0)
    expect(validateAnchoringEngineering({ ...veljaven, holeDepthMm: 5 }).some((e) => e.includes('izven območja umerjenosti'))).toBe(true)
    expect(validateAnchoringEngineering({ ...veljaven, holeDiameterMm: 2 }).length).toBeGreaterThan(0)
    expect(validateAnchoringEngineering({ ...veljaven, holeDepthMm: 2500 }).length).toBeGreaterThan(0)
  })

  it('temperatura izven −30…60 → napaka; neveljaven enum sidra → napaka', () => {
    expect(validateAnchoringEngineering({ ...veljaven, temperature: -40 }).length).toBeGreaterThan(0)
    expect(validateAnchoringEngineering({ ...veljaven, temperature: 70 }).length).toBeGreaterThan(0)
    expect(validateAnchoringEngineering({ ...veljaven, anchorType: 'jega' }).some((e) => e.includes('Tip sidra'))).toBe(true)
  })
})

describe('R150 §32 validateWindEngineering (tihi LOW zaprt)', () => {
  const veljaven = { heightAboveGround: 10, terrainCategory: 'II', windSpeedMs: 25, railingAreaM2: 2, railingType: 'solid' }

  it('veljaven vhod → prazen seznam napak', () => {
    expect(validateWindEngineering(veljaven)).toEqual([])
  })

  it('višina 0 m → NAPAKA (prej heightFactor 0 → tiho LOW tveganje!)', () => {
    const errs = validateWindEngineering({ ...veljaven, heightAboveGround: 0 })
    expect(errs.length).toBeGreaterThan(0)
    expect(errs.some((e) => e.includes('Višina nad tlemi'))).toBe(true)
  })

  it('meje: višina 0.3 in 300, hitrost 0.5 in 100, površina 0.05 → napake', () => {
    expect(validateWindEngineering({ ...veljaven, heightAboveGround: 0.3 }).length).toBeGreaterThan(0)
    expect(validateWindEngineering({ ...veljaven, heightAboveGround: 300 }).length).toBeGreaterThan(0)
    expect(validateWindEngineering({ ...veljaven, windSpeedMs: 0.5 }).length).toBeGreaterThan(0)
    expect(validateWindEngineering({ ...veljaven, windSpeedMs: 100 }).length).toBeGreaterThan(0)
    expect(validateWindEngineering({ ...veljaven, railingAreaM2: 0.05 }).length).toBeGreaterThan(0)
  })

  it('neveljavna enuma → napaki', () => {
    expect(validateWindEngineering({ ...veljaven, terrainCategory: 'V' }).some((e) => e.includes('Kategorija terena'))).toBe(true)
    expect(validateWindEngineering({ ...veljaven, railingType: 'pleksiglas' }).some((e) => e.includes('Tip ograje'))).toBe(true)
  })
})

// ── Lib: ovojnice (rezultat = direkt matematika, odtis vezan) ───────────────

describe('R150 ovojnice run*RailV1 (determinizem + reproducibilnost)', () => {
  it('railing: rezultat = DIREKTNA matematika lib/calculator.ts + odtis', () => {
    const input = { totalLengthMm: 5000, slatWidthMm: 140, maxGapMm: 99, profileType: 'classic' as const }
    const envelope = runRailingCalcV1(input)
    expect(envelope.ok).toBe(true)
    if (!envelope.ok) return
    const direct = calculateRailingSpacing(input)
    expect(envelope.result).toEqual(direct)
    expect(envelope.formulaVersion).toBe(CALC_FORMULA_VERSIONS.railing)
    expect(envelope.inputHash).toMatch(/^[0-9a-f]{8}$/)
  })

  it('railing: izven umerjenosti → ok:false + errors, BREZ rezultata', () => {
    const envelope = runRailingCalcV1({ totalLengthMm: 50, slatWidthMm: 140, maxGapMm: 99, profileType: 'classic' })
    expect(envelope.ok).toBe(false)
    if (envelope.ok) return
    expect(envelope.errors.length).toBeGreaterThan(0)
    expect('result' in envelope).toBe(false)
  })

  it('anchoring: rezultat = DIREKTNA matematika; klient parseFloat NaN/Infinity → fail-closed', () => {
    const input = { holeCount: 4, holeDepthMm: 80, holeDiameterMm: 12, temperature: 15, anchorType: 'fischer-fis' as const }
    const envelope = runAnchoringCalcV1(input)
    expect(envelope.ok).toBe(true)
    if (!envelope.ok) return
    expect(envelope.result).toEqual(calculateAnchoring(input))
    // Defense-in-depth za klienta: parseFloat('1e999') → Infinity; Zod bi to
    // blokal na API-ju, klient pa gre naravnost sem.
    expect(runAnchoringCalcV1({ ...input, holeDepthMm: Infinity }).ok).toBe(false)
    expect(runAnchoringCalcV1({ ...input, holeDepthMm: NaN }).ok).toBe(false)
  })

  it('wind: rezultat = DIREKTNA matematika; višina 0 → napaka, NE tiho LOW', () => {
    const input = { heightAboveGround: 10, terrainCategory: 'II' as const, windSpeedMs: 25, railingAreaM2: 2, railingType: 'solid' as const }
    const envelope = runWindCalcV1(input)
    expect(envelope.ok).toBe(true)
    if (!envelope.ok) return
    expect(envelope.result).toEqual(calculateWindLoad(input))
    expect(runWindCalcV1({ ...input, heightAboveGround: 0 }).ok).toBe(false)
  })

  it('determinizem: isti vhod 100× → isti rezultat IN isti odtis', () => {
    const input = { heightAboveGround: 12, terrainCategory: 'III' as const, windSpeedMs: 28, railingAreaM2: 3, railingType: 'slatted' as const }
    const first = runWindCalcV1(input)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    for (let i = 0; i < 100; i++) {
      const again = runWindCalcV1(input)
      expect(again.ok).toBe(true)
      if (!again.ok) return
      expect(again.result).toEqual(first.result)
      expect(again.inputHash).toBe(first.inputHash)
      expect(again.formulaVersion).toBe(first.formulaVersion)
    }
  })

  it('kalibracijske meje so dokumentirane in deterministične', () => {
    expect(CALC_CALIBRATION.railing.totalLengthMm).toEqual({ min: 100, max: 100000 })
    expect(CALC_CALIBRATION.anchoring.holeCount).toEqual({ min: 1, max: 500 })
    expect(CALC_CALIBRATION.wind.heightAboveGround).toEqual({ min: 0.5, max: 200 })
  })
})

// ── API: POST/GET /api/calculator ───────────────────────────────────────────

describe('R150 POST /api/calculator (inženirska ovojnica na API-ju)', () => {
  it('anon POST → 401', async () => {
    const res = await calculatorPost(
      jsonReq('/api/calculator', null, {
        method: 'POST',
        body: { type: 'railing', totalLengthMm: 5000, slatWidthMm: 140, maxGapMm: 99, profileType: 'classic' },
      }),
    )
    expect(res.status).toBe(401)
  })

  it('anon GET (register formul) → 401', async () => {
    const res = await calculatorGet(jsonReq('/api/calculator', null))
    expect(res.status).toBe(401)
  })

  it('veljaven railing → 200 z formulaVersion rail-v1 + inputHash + rezultat', async () => {
    const { token } = await createTestUserWithSession(`r150-calc-a-${Date.now()}`, 'VODJA')
    const res = await calculatorPost(
      jsonReq('/api/calculator', token, {
        method: 'POST',
        body: { type: 'railing', totalLengthMm: 5000, slatWidthMm: 140, maxGapMm: 99, profileType: 'classic' },
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.slatCount).toBeGreaterThan(0)
    expect(body.formulaVersion).toBe('rail-v1')
    expect(body.inputHash).toMatch(/^[0-9a-f]{8}$/)
    // Odtis na API-ju = odtis v lib (ista kanonizacija, isti hash).
    const libFp = calcInputFingerprint('railing', {
      totalLengthMm: 5000, slatWidthMm: 140, maxGapMm: 99, profileType: 'classic',
    })
    expect(body.inputHash).toBe(libFp.inputHash)
  })

  it('zod-veljaven a izven umerjenosti → 400 z IZREČNIMI napakami (nič tihega)', async () => {
    const { token } = await createTestUserWithSession(`r150-calc-b-${Date.now()}`, 'VODJA')
    // 50 mm je pozitivno (zod OK), a izven območja umerjenosti (min 100 mm).
    const res = await calculatorPost(
      jsonReq('/api/calculator', token, {
        method: 'POST',
        body: { type: 'railing', totalLengthMm: 50, slatWidthMm: 140, maxGapMm: 99, profileType: 'classic' },
      }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Inženirska validacija')
    expect(Array.isArray(body.errors)).toBe(true)
    expect(body.errors.length).toBeGreaterThan(0)
    expect(body.slatCount).toBeUndefined()
  })

  it('wind z višino 0.3 m → 400 (izven umerjenosti), z 10 m → 200', async () => {
    const { token } = await createTestUserWithSession(`r150-calc-c-${Date.now()}`, 'VODJA')
    const bad = await calculatorPost(
      jsonReq('/api/calculator', token, {
        method: 'POST',
        body: { type: 'wind', heightAboveGround: 0.3, terrainCategory: 'II', windSpeedMs: 25, railingAreaM2: 2, railingType: 'solid' },
      }),
    )
    expect(bad.status).toBe(400)
    const good = await calculatorPost(
      jsonReq('/api/calculator', token, {
        method: 'POST',
        body: { type: 'wind', heightAboveGround: 10, terrainCategory: 'II', windSpeedMs: 25, railingAreaM2: 2, railingType: 'solid' },
      }),
    )
    expect(good.status).toBe(200)
    const body = await good.json()
    expect(body.formulaVersion).toBe('wind-v1')
    expect(body.riskLevel).toBeDefined()
  })

  it('GET s sejo → register formul s verzijami in mejami umerjenosti', async () => {
    const { token } = await createTestUserWithSession(`r150-calc-d-${Date.now()}`, 'VODJA')
    const res = await calculatorGet(jsonReq('/api/calculator', token))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.formulas).toHaveLength(3)
    const rail = body.formulas.find((f: { type: string }) => f.type === 'railing')
    expect(rail.formulaVersion).toBe('rail-v1')
    expect(rail.calibration.totalLengthMm).toEqual({ min: 100, max: 100000 })
    expect(body.determinism).toContain('isti rezultat')
  })
})
