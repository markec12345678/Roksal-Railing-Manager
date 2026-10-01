// R345 — dekompozicija calculator-tab FAZA 5: dispatch logika 10 načinov
// izluščena VERBATIM iz calculator-tab.tsx v calculator/calculations.ts
// (vzorec R325 pdf-exports + R340 cut-list + R343 history: closure dostop
// do stanja → eksplicitni args objekti; čist premik BREZ spremembe
// obnašanja — parsanje vhodnih nizov, guard pogoji, klici čistih jeder in
// ovonjic R150 so premaknjeni bistev takšni, kot so bili; komponenta samo
// zapiše rezultat v state).
//
// DVE DRUŽINI dispatchev:
//  • Ovonični načini (railing, anchoring, wind — R150 inženirska ovojnica)
//    vračajo CalcEngineeringResult<T> NESPREMJEN: komponenta loči
//    !ok → setEngineeringErrors(errors), ok → setLastFingerprint + set*Result.
//  • Guard načini (baluster, angled, material, compliance, cnc,
//    windLocation, glass) vračajo T | null (null = guard zadel — rezultat
//    se počisti), komponenta pa samo set*Result(dispatch*(...)).
//
// Determinizem: čista funkcija vhodov → rezultat, NIČ časa, NIČ I/O,
// NIČ React. Jedra (lib/calculator.ts + lib/calc-engineering.ts) so
// klicana NESPREMJENO (hard rule: izračunsko jedro nič AI sprememb).

import {
  calculateEqualSpacing,
  calculateAngledSpacing,
  calculateMaterialTotal,
  checkCompliance,
  calculateCncCutting,
  calculateWindByLocation,
  calculateGlassBalustrade,
  type EqualSpacingResult,
  type AngledSpacingResult,
  type MaterialTotalResult,
  type ComplianceResult,
  type CncCutResult,
  type WindLocationResult,
  type GlassCalcResult,
  type RailingCalcResult,
  type AnchoringCalcResult,
  type WindLoadCalcResult,
  type Profil,
  type MaterialSegment,
} from '@/lib/calculator'
import {
  runRailingCalcV1,
  runAnchoringCalcV1,
  runWindCalcV1,
  type CalcEngineeringResult,
} from '@/lib/calc-engineering'
// R325 — tip CncSegment/GlassType sta EN VIR v calculator/pdf-exports.ts
// (stanje + PDF + dispatch delijo isti tip).
import { type CncSegment, type GlassType } from './pdf-exports'
import type { ProfileType, AnchorType, TerrainCategory, RailingType } from './shared'

// ===== Ovonični načini (R150 —CalcEngineeringResult nepremenjen) =====

/** R345 FAZA 5: railing dispatch (telo VERBATIM iz calculateRailingClientSide). */
export function dispatchRailing(args: {
  totalLength: string
  slatWidth: string
  maxGap: string
  profileType: ProfileType
}): CalcEngineeringResult<RailingCalcResult> {
  const { totalLength, slatWidth, maxGap, profileType } = args
  // R150: inženirska ovojnica — fail-closed validacija (izven območja
  // umerjenosti → eksplicitne napake, NIČ rezultata) + prstni odtis.
  const L = parseFloat(totalLength) * 1000
  const W = parseFloat(slatWidth)
  const G = parseFloat(maxGap)
  return runRailingCalcV1({
    totalLengthMm: L,
    slatWidthMm: W,
    maxGapMm: G,
    profileType,
  })
}

/** R345 FAZA 5: anchoring dispatch (telo VERBATIM iz calculateAnchoringClientSide). */
export function dispatchAnchoring(args: {
  holeCount: string
  holeDepthMm: string
  holeDiameterMm: string
  temperature: string
  anchorType: AnchorType
}): CalcEngineeringResult<AnchoringCalcResult> {
  const { holeCount, holeDepthMm, holeDiameterMm, temperature, anchorType } = args
  // R150: inženirska ovojnica — fail-closed validacija + prstni odtis.
  const hc = parseInt(holeCount)
  const depth = parseFloat(holeDepthMm)
  const dia = parseFloat(holeDiameterMm)
  const temp = parseFloat(temperature)
  return runAnchoringCalcV1({
    holeCount: hc,
    holeDepthMm: depth,
    holeDiameterMm: dia,
    temperature: temp,
    anchorType,
  })
}

/** R345 FAZA 5: wind dispatch (telo VERBATIM iz calculateWindClientSide). */
export function dispatchWind(args: {
  heightAboveGround: string
  terrainCategory: TerrainCategory
  windSpeedMs: string
  railingAreaM2: string
  railingType: RailingType
}): CalcEngineeringResult<WindLoadCalcResult> {
  const { heightAboveGround, terrainCategory, windSpeedMs, railingAreaM2, railingType } = args
  // R150: inženirska ovojnica — višina 0 m (prej tiho LOW tveganje!),
  // negativna/neskončna hitrost in nesmiselna površina so ZDAJ eksplicitne
  // napake, ne tihi rezultat.
  const h = parseFloat(heightAboveGround)
  const ws = parseFloat(windSpeedMs)
  const area = parseFloat(railingAreaM2)
  return runWindCalcV1({
    heightAboveGround: h,
    terrainCategory,
    windSpeedMs: ws,
    railingAreaM2: area,
    railingType,
  })
}

// ===== Guard načini (T | null) =====

/** R345 FAZA 5: baluster dispatch (telo VERBATIM iz calculateBalusterClientSide). */
export function dispatchBaluster(args: {
  balTotalLength: string
  balWidth: string
  balMaxGap: string
}): EqualSpacingResult | null {
  const { balTotalLength, balWidth, balMaxGap } = args
  const L = parseFloat(balTotalLength) * 1000
  const W = parseFloat(balWidth)
  const G = parseFloat(balMaxGap)
  if (!isFinite(L) || !isFinite(W) || !isFinite(G) || L <= 0 || W <= 0 || G <= 0) {
    return null
  }
  return calculateEqualSpacing({
    totalLengthMm: L,
    balusterWidthMm: W,
    maxGapMm: G,
  })
}

/** R345 FAZA 5: angled dispatch (telo VERBATIM iz calculateAngledClientSide). */
export function dispatchAngled(args: {
  angHorizontalLength: string
  angRakeAngle: string
  angWidth: string
  angMaxGap: string
}): AngledSpacingResult | null {
  const { angHorizontalLength, angRakeAngle, angWidth, angMaxGap } = args
  const L = parseFloat(angHorizontalLength) * 1000
  const angle = parseFloat(angRakeAngle)
  const W = parseFloat(angWidth)
  const G = parseFloat(angMaxGap)
  if (!isFinite(L) || !isFinite(angle) || !isFinite(W) || !isFinite(G) || L <= 0 || W <= 0 || G <= 0) {
    return null
  }
  return calculateAngledSpacing({
    horizontalLengthMm: L,
    rakeAngleDeg: angle,
    balusterWidthMm: W,
    maxGapMm: G,
  })
}

/** R345 FAZA 5: material dispatch (telo VERBATIM iz calculateMaterialClientSide). */
export function dispatchMaterial(args: {
  segments: MaterialSegment[]
  profileSifra: string
  profili: Profil[]
}): MaterialTotalResult | null {
  const { segments, profileSifra, profili } = args
  if (segments.length === 0) {
    return null
  }
  return calculateMaterialTotal({
    segments,
    profileSifra,
    profili,
  })
}

/** R345 FAZA 5: compliance dispatch (telo VERBATIM iz calculateComplianceClientSide). */
export function dispatchCompliance(args: {
  compGap: string
  compHeight: string
  compPostSpacing: string
  compLoadCategory: 'A' | 'B' | 'C'
  compDropHeight: string
}): ComplianceResult | null {
  const { compGap, compHeight, compPostSpacing, compLoadCategory, compDropHeight } = args
  const gap = parseFloat(compGap)
  const height = parseFloat(compHeight)
  const spacing = parseFloat(compPostSpacing)
  const drop = parseFloat(compDropHeight) || 0
  if (!isFinite(gap) || !isFinite(height) || !isFinite(spacing)) {
    return null
  }
  return checkCompliance({
    gapMm: gap,
    heightMm: height,
    postSpacingMm: spacing,
    loadCategory: compLoadCategory,
    dropHeightMm: drop,
  })
}

/** R345 FAZA 5: CNC dispatch (telo VERBATIM iz calculateCncClientSide). */
export function dispatchCnc(args: {
  cncStockLength: string
  cncSawBlade: string
  cncSegments: CncSegment[]
}): CncCutResult | null {
  const { cncStockLength, cncSawBlade, cncSegments } = args
  const stock = parseFloat(cncStockLength)
  const blade = parseFloat(cncSawBlade)
  if (!isFinite(stock) || stock <= 0) {
    return null
  }
  const segments = cncSegments
    .filter((s) => s.lengthMm && s.count)
    .map((s) => ({
      lengthMm: parseFloat(s.lengthMm) || 0,
      count: parseInt(s.count) || 0,
      label: s.label || undefined,
    }))
    .filter((s) => s.lengthMm > 0 && s.count > 0)
  if (segments.length === 0) {
    return null
  }
  return calculateCncCutting({
    segments,
    stockLengthMm: stock,
    sawBladeWidthMm: isFinite(blade) ? blade : 3,
  })
}

/** R345 FAZA 5: wind-by-location dispatch (telo VERBATIM iz calculateWindLocClientSide). */
export function dispatchWindLocation(args: {
  windLocLat: string
  windLocLon: string
  windLocHeight: string
  windLocTerrain: TerrainCategory
  windLocArea: string
  windLocType: RailingType
}): WindLocationResult | null {
  const { windLocLat, windLocLon, windLocHeight, windLocTerrain, windLocArea, windLocType } = args
  const lat = parseFloat(windLocLat)
  const lon = parseFloat(windLocLon)
  const h = parseFloat(windLocHeight)
  const area = parseFloat(windLocArea)
  if (!isFinite(lat) || !isFinite(lon) || !isFinite(h) || !isFinite(area)) {
    return null
  }
  return calculateWindByLocation({
    latitude: lat,
    longitude: lon,
    heightAboveGround: h,
    terrainCategory: windLocTerrain,
    railingAreaM2: area,
    railingType: windLocType,
  })
}

/** R345 FAZA 5: glass dispatch (telo VERBATIM iz calculateGlassClientSide). */
export function dispatchGlass(args: {
  spanMm: number
  heightMm: number
  loadKnPerM: number
  glassType: GlassType
}): GlassCalcResult | null {
  const { spanMm, heightMm, loadKnPerM } = args
  if (!isFinite(spanMm) || !isFinite(heightMm) || !isFinite(loadKnPerM) || spanMm <= 0) {
    return null
  }
  return calculateGlassBalustrade(args)
}
