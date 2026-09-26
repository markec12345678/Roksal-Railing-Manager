/**
 * R150 (issue #5 §32–34 — engineering/versioning): inženirska ovojnica
 * kalkulatorja — validacija območja umerjenosti, verzionirane formule in
 * deterministični prstni odtis vhodov.
 *
 * Problem, ki ga ta plast zapira: kalkulator (lib/calculator.ts) je bil
 * matematično pravilen, a BREZ inženirske validacije vhodov —
 * Infinity skozi zod `z.number()` je mirno izračunal `slatCount: Infinity`
 * (v JSON ugaši v `null`), višina 0 m pri vetru je dala tiho `heightFactor
 * = 0` → tlak 0 → raven tveganja LOW (nevaren tihi rezultat!), globina
 * vrtanja 0.001 mm je dala 0 kartuš. Tiho nonsens rezultato namesto
 * eksplicitne napake.
 *
 * Pravila (isti vzorec kot qc-gate R146 / sync-conflicts R148):
 *   • VALIDACIJA je fail-closed: vnos izven območja umerjenosti formule →
 *     eksplicitna napaka, NIČ se ne izračuna (brez tihnega ekstrapoliranja).
 *   • FORMULE so VERSIONIRANE (CALC_FORMULA_VERSIONS) — sprememba matematike
 *     = nova verzija; obstoječi prstni odtisi ostanejo berljivi s svojo
 *     verzijo. Versionirane formule NIKOLI ne spreminjajo izračuna za iste
 *     vhode (determinizem je pogodba).
 *   • PRSTNI ODTIS (canonical JSON + FNV-1a 32-bit) je determinističen:
 *     isti vhod ne glede na vrstni red ključev = isti odtis. Hash vključuje
 *     tip in verzijo formule — zabeležen odtis je vedno vezan na formulo,
 *     ki je izračunala rezultat (reproducibilnost, §33/§34).
 *   • Čista jedra: ni baze, ni ure, ni I/O — kliče obstoječo matematiko
 *     iz lib/calculator.ts NESPREMENJENO.
 */

import {
  calculateRailingSpacing,
  calculateAnchoring,
  calculateWindLoad,
  type RailingCalcResult,
  type AnchoringCalcResult,
  type WindLoadCalcResult,
} from './calculator'

// ============================================
// VERZIJE FORMUL
// ============================================

export type CalcType = 'railing' | 'anchoring' | 'wind'

/**
 * Verzija formule za vsak tip izračuna. Pravilo: sprememba matematike v
 * lib/calculator.ts ZA tip T mora povišati verzijo za T (npr. rail-v1 →
 * rail-v2) — odtisi stare verzije ostanejo interpretirani s staro verzijo.
 * Dokler se matematika ne spreminja, se verzije ne povišujejo.
 */
export const CALC_FORMULA_VERSIONS: Record<CalcType, string> = {
  railing: 'rail-v1',
  anchoring: 'anch-v1',
  wind: 'wind-v1',
}

// ============================================
// OBMOČJA UMERJENOSTI (dokumentirana, deterministična)
// ============================================

/**
 * Območja, za katera je formula izračunana in umerjena. Izven teh območij
 * rezultat NI zanesljiv — fail-closed napaka namesto tihega številka.
 * Meje so inženirsko utemeljene:
 *   • ograja: 10 cm … 100 m (višji objekti niso vsakdanji montažni primer),
 *     letvica 10 … 500 mm, razmik 1 … 200 mm (poravnano z Zod stropom);
 *   • sidranje: 1 … 500 lukenj, globina 10 … 2000 mm (pod 10 mm luknja
 *     ni smiselna za kemično sidro), premer 4 … 200 mm, temperatura
 *     −30 … 60 °C (širši od Zod ja — validacija tukaj je inženirska plast);
 *   • veter: višina 0,5 … 200 m (VIŠINA ≤ 0 → heightFactor 0 → tiho
 *     LOW tveganje — zaprto), hitrost 1 … 80 m/s (orikanski vihar je 32,7),
 *     površina 0,1 … 10 000 m².
 */
export const CALC_CALIBRATION = {
  railing: {
    totalLengthMm: { min: 100, max: 100000 },
    slatWidthMm: { min: 10, max: 500 },
    maxGapMm: { min: 1, max: 200 },
  },
  anchoring: {
    holeCount: { min: 1, max: 500 },
    holeDepthMm: { min: 10, max: 2000 },
    holeDiameterMm: { min: 4, max: 200 },
    temperature: { min: -30, max: 60 },
  },
  wind: {
    heightAboveGround: { min: 0.5, max: 200 },
    windSpeedMs: { min: 1, max: 80 },
    railingAreaM2: { min: 0.1, max: 10000 },
  },
} as const

const RAILING_PROFILE_TYPES = ['classic', 'z-line', 'vertical'] as const
const ANCHOR_TYPES = ['hilti-hit', 'fischer-fis', 'generic'] as const
const WIND_RAILING_TYPES = ['solid', 'slatted', 'z-line'] as const

// ============================================
// VALIDACIJA (fail-closed — prazna lista = veljavno)
// ============================================

function finiteError(field: string, value: number): string {
  return `${field} mora biti končno število (prejeto: ${String(value)})`
}

function rangeError(field: string, value: number, min: number, max: number, unit: string): string {
  return `${field} je izven območja umerjenosti formule (dovoljeno ${min}–${max} ${unit}, prejeto: ${String(value)})`
}

function inRange(
  field: string,
  value: number,
  min: number,
  max: number,
  unit: string,
  errors: string[],
): void {
  if (!Number.isFinite(value)) {
    errors.push(finiteError(field, value))
  } else if (value < min || value > max) {
    errors.push(rangeError(field, value, min, max, unit))
  }
}

function inEnum(field: string, value: string, allowed: readonly string[], errors: string[]): void {
  if (!allowed.includes(value)) {
    errors.push(`${field} mora biti eno od: ${allowed.join(', ')} (prejeto: "${value}")`)
  }
}

/** Vhod za ovojnico ograje — profileType je string (validiran ob teku). */
export interface RailingEngineeringInput {
  totalLengthMm: number
  slatWidthMm: number
  maxGapMm: number
  profileType: string
}

export interface AnchoringEngineeringInput {
  holeCount: number
  holeDepthMm: number
  holeDiameterMm: number
  temperature: number
  anchorType: string
}

export interface WindEngineeringInput {
  heightAboveGround: number
  terrainCategory: string
  windSpeedMs: number
  railingAreaM2: number
  railingType: string
}

export function validateRailingEngineering(input: RailingEngineeringInput): string[] {
  const errors: string[] = []
  const c = CALC_CALIBRATION.railing
  inRange('Skupna dolžina', input.totalLengthMm, c.totalLengthMm.min, c.totalLengthMm.max, 'mm', errors)
  inRange('Širina letve', input.slatWidthMm, c.slatWidthMm.min, c.slatWidthMm.max, 'mm', errors)
  inRange('Maksimalni razmik', input.maxGapMm, c.maxGapMm.min, c.maxGapMm.max, 'mm', errors)
  // Fizična relacija: letvica oziroma razmik širša/večja od same ograje = nonsense.
  if (
    Number.isFinite(input.slatWidthMm) &&
    Number.isFinite(input.totalLengthMm) &&
    input.slatWidthMm > input.totalLengthMm
  ) {
    errors.push(`Širina letve (${String(input.slatWidthMm)} mm) ne sme presegati skupne dolžine (${String(input.totalLengthMm)} mm)`)
  }
  if (
    Number.isFinite(input.maxGapMm) &&
    Number.isFinite(input.totalLengthMm) &&
    input.maxGapMm > input.totalLengthMm
  ) {
    errors.push(`Maksimalni razmik (${String(input.maxGapMm)} mm) ne sme presegati skupne dolžine (${String(input.totalLengthMm)} mm)`)
  }
  inEnum('Tip profila', input.profileType, RAILING_PROFILE_TYPES, errors)
  return errors
}

export function validateAnchoringEngineering(input: AnchoringEngineeringInput): string[] {
  const errors: string[] = []
  const c = CALC_CALIBRATION.anchoring
  if (!Number.isFinite(input.holeCount)) {
    errors.push(finiteError('Število lukenj', input.holeCount))
  } else {
    if (!Number.isInteger(input.holeCount)) {
      errors.push(`Število lukenj mora biti celo število (prejeto: ${String(input.holeCount)})`)
    }
    if (input.holeCount < c.holeCount.min || input.holeCount > c.holeCount.max) {
      errors.push(rangeError('Število lukenj', input.holeCount, c.holeCount.min, c.holeCount.max, 'kos'))
    }
  }
  inRange('Globina vrtanja', input.holeDepthMm, c.holeDepthMm.min, c.holeDepthMm.max, 'mm', errors)
  inRange('Premer luknje', input.holeDiameterMm, c.holeDiameterMm.min, c.holeDiameterMm.max, 'mm', errors)
  inRange('Temperatura', input.temperature, c.temperature.min, c.temperature.max, '°C', errors)
  inEnum('Tip sidra', input.anchorType, ANCHOR_TYPES, errors)
  return errors
}

export function validateWindEngineering(input: WindEngineeringInput): string[] {
  const errors: string[] = []
  const c = CALC_CALIBRATION.wind
  inRange('Višina nad tlemi', input.heightAboveGround, c.heightAboveGround.min, c.heightAboveGround.max, 'm', errors)
  inRange('Hitrost vetra', input.windSpeedMs, c.windSpeedMs.min, c.windSpeedMs.max, 'm/s', errors)
  inRange('Površina ograje', input.railingAreaM2, c.railingAreaM2.min, c.railingAreaM2.max, 'm²', errors)
  inEnum('Kategorija terena', input.terrainCategory, ['I', 'II', 'III', 'IV'], errors)
  inEnum('Tip ograje', input.railingType, WIND_RAILING_TYPES, errors)
  return errors
}

// ============================================
// DETERMINISTIČNI PRSTNI ODTIS (canonical + FNV-1a)
// ============================================

/**
 * FNV-1a 32-bit — čista, odvisnost-brez implementacija. Deterministična
 * na vseh platformah (Math.imul + >>> 0 ohranja 32-bitno aritmetiko).
 * Znane vrednosti: fnv1a32Hex('') = '811c9dc5', fnv1a32Hex('a') = 'e40c292c'.
 */
export function fnv1a32Hex(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/**
 * Kanonizacija števil: cela števila kot cela, ostala na 4 decimalki (brez
 * odvečnih ničel), ne-končna vidno označena (nNaN/nInfinity) — odtis tihega
 * NaN-ja ne sme izgledati kot odtis števila. Kanonizacija zaokroži na
 * 0,0001 — za mm-nivoje vhodov to je dovolj in je DOKUMENTIRANO pravilo.
 */
function canonicalizeValue(v: unknown): string {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return `n${String(v)}`
    if (Number.isInteger(v)) return `n${v.toFixed(0)}`
    return `n${v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '.0')}`
  }
  if (typeof v === 'string') return `s${v}`
  return `?${String(v)}`
}

/**
 * Kanonična oblika vhoda: ključi UREJENO po abecedi (vrstni red vnosov ne
 * vpliva na odtis), vrednosti kanonizirane, ločilo '|' — deterministično.
 */
export function canonicalizeCalcInput(input: Record<string, unknown>): string {
  const keys = Object.keys(input).sort()
  return keys.map((k) => `${k}=${canonicalizeValue(input[k])}`).join('|')
}

/**
 * Prstni odtis vhodov za tip izračuna: hash vključuje tip IN verzijo
 * formule — odtis je vedno vezan na formulo, ki je izračunala rezultat.
 * Isti vhod + ista verzija = ISTI odtis (reproducibilnost, §33/§34);
 * sprememba verzije = novi odtisi tudi za iste vhode.
 */
export function calcInputFingerprint(
  type: CalcType,
  input: Record<string, unknown>,
): { formulaVersion: string; inputHash: string } {
  const formulaVersion = CALC_FORMULA_VERSIONS[type]
  const canonical = `${type}#${formulaVersion}#${canonicalizeCalcInput(input)}`
  return { formulaVersion, inputHash: fnv1a32Hex(canonical) }
}

// ============================================
// INŽENIRSKE OVONJICE (validacija → odtis → izračun)
// ============================================

export type CalcEngineeringResult<T> =
  | { ok: true; formulaVersion: string; inputHash: string; result: T }
  | { ok: false; errors: string[] }

export function runRailingCalcV1(
  input: RailingEngineeringInput,
): CalcEngineeringResult<RailingCalcResult> {
  const errors = validateRailingEngineering(input)
  if (errors.length > 0) return { ok: false, errors }
  const fp = calcInputFingerprint('railing', { ...input })
  return {
    ok: true,
    ...fp,
    result: calculateRailingSpacing({
      totalLengthMm: input.totalLengthMm,
      slatWidthMm: input.slatWidthMm,
      maxGapMm: input.maxGapMm,
      profileType: input.profileType as 'classic' | 'z-line' | 'vertical',
    }),
  }
}

export function runAnchoringCalcV1(
  input: AnchoringEngineeringInput,
): CalcEngineeringResult<AnchoringCalcResult> {
  const errors = validateAnchoringEngineering(input)
  if (errors.length > 0) return { ok: false, errors }
  const fp = calcInputFingerprint('anchoring', { ...input })
  return {
    ok: true,
    ...fp,
    result: calculateAnchoring({
      holeCount: input.holeCount,
      holeDepthMm: input.holeDepthMm,
      holeDiameterMm: input.holeDiameterMm,
      temperature: input.temperature,
      anchorType: input.anchorType as 'hilti-hit' | 'fischer-fis' | 'generic',
    }),
  }
}

export function runWindCalcV1(
  input: WindEngineeringInput,
): CalcEngineeringResult<WindLoadCalcResult> {
  const errors = validateWindEngineering(input)
  if (errors.length > 0) return { ok: false, errors }
  const fp = calcInputFingerprint('wind', { ...input })
  return {
    ok: true,
    ...fp,
    result: calculateWindLoad({
      heightAboveGround: input.heightAboveGround,
      terrainCategory: input.terrainCategory as 'I' | 'II' | 'III' | 'IV',
      windSpeedMs: input.windSpeedMs,
      railingAreaM2: input.railingAreaM2,
      railingType: input.railingType as 'solid' | 'slatted' | 'z-line',
    }),
  }
}
