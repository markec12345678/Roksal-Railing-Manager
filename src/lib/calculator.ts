// Roksal Field - Kalkulator za ograje
// Izračuni za razmike letev, kemično sidranje in vetrno obremenitev

// ============================================
// 1. KALKULATOR RAZMIKOV LETEV
// ============================================

export interface RailingCalcInput {
  totalLengthMm: number
  slatWidthMm: number
  maxGapMm: number
  profileType: 'classic' | 'z-line' | 'vertical'
}

export interface RailingCalcResult {
  slatCount: number
  actualGapMm: number
  totalSlatsLengthMm: number
  totalGapsLengthMm: number
  isCompliant: boolean
  warnings: string[]
}

export function calculateRailingSpacing(input: RailingCalcInput): RailingCalcResult {
  const { totalLengthMm, slatWidthMm, maxGapMm, profileType } = input
  const warnings: string[] = []

  const n = Math.ceil((totalLengthMm - maxGapMm) / (maxGapMm + slatWidthMm))
  const actualGap = (totalLengthMm - n * slatWidthMm) / (n + 1)

  const isCompliant = actualGap <= 100
  if (!isCompliant) {
    warnings.push('RAZMIK PRESEGA 100mm - Prepovedano za stanovanjske objekte (lestveni učinek)!')
  }

  if (profileType === 'z-line' && actualGap > 0) {
    warnings.push('Z-line profil: Prekrivanje zagotavlja 100% vizualno zasebnost tudi pri dovoljenem razmiku.')
  }

  if (actualGap < 10) {
    warnings.push('Razmik zelo majhen (<10mm). Preverite ali je dovolj prostora za dilatacijo WPC materiala.')
  }

  return {
    slatCount: n,
    actualGapMm: Math.round(actualGap * 10) / 10,
    totalSlatsLengthMm: n * slatWidthMm,
    totalGapsLengthMm: Math.round((n + 1) * actualGap),
    isCompliant,
    warnings,
  }
}

// ============================================
// 2. KALKULATOR KEMIČNEGA SIDRANJA
// ============================================

export interface AnchoringCalcInput {
  holeCount: number
  holeDepthMm: number
  holeDiameterMm: number
  temperature: number
  anchorType: 'hilti-hit' | 'fischer-fis' | 'generic'
}

export interface AnchoringCalcResult {
  resinVolumeMl: number
  totalResinMl: number
  curingTimeMin: number
  cartridgesNeeded: number
  warnings: string[]
}

export function calculateAnchoring(input: AnchoringCalcInput): AnchoringCalcResult {
  const { holeCount, holeDepthMm, holeDiameterMm, temperature, anchorType } = input
  const warnings: string[] = []

  const radiusMm = holeDiameterMm / 2
  const holeVolumeMm3 = Math.PI * Math.pow(radiusMm, 2) * holeDepthMm
  const holeVolumeMl = holeVolumeMm3 / 1000

  const resinPerHole = holeVolumeMl * 1.2
  const totalResin = resinPerHole * holeCount

  let curingTimeMin: number
  if (temperature >= 20) {
    curingTimeMin = 30
  } else if (temperature >= 10) {
    curingTimeMin = 60
    warnings.push('Temperatura < 20°C: Podaljšan čas strjevanja. Počakajte vsaj 1 uro.')
  } else if (temperature >= 5) {
    curingTimeMin = 120
    warnings.push('Temperatura < 10°C: Zelo podaljšan čas strjevanja (2 uri). Uporabite zimsko formulo smole.')
  } else {
    curingTimeMin = 0
    warnings.push('Temperatura < 5°C: Kemično sidranje NI priporočljivo! Tveganje nezadostne trdnosti.')
  }

  const cartridgeSize = anchorType === 'hilti-hit' ? 330 : 300
  const cartridgesNeeded = Math.ceil(totalResin / cartridgeSize)

  if (holeDepthMm < 70) {
    warnings.push('Globina vrtanja < 70mm. Priporočena minimalna globina za M12 sidro je 70mm.')
  }

  return {
    resinVolumeMl: Math.round(resinPerHole * 10) / 10,
    totalResinMl: Math.round(totalResin * 10) / 10,
    curingTimeMin,
    cartridgesNeeded,
    warnings,
  }
}

// ============================================
// 3. KALKULATOR VETRNE OBREMENITVE
// ============================================

export interface WindLoadCalcInput {
  heightAboveGround: number
  terrainCategory: 'I' | 'II' | 'III' | 'IV'
  windSpeedMs: number
  railingAreaM2: number
  railingType: 'solid' | 'slatted' | 'z-line'
}

export interface WindLoadCalcResult {
  windPressureKpa: number
  totalForceKn: number
  forcePerMeterNm: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  recommendations: string[]
}

export function calculateWindLoad(input: WindLoadCalcInput): WindLoadCalcResult {
  const { heightAboveGround, terrainCategory, windSpeedMs, railingAreaM2, railingType } = input
  const recommendations: string[] = []

  const terrainFactors: Record<string, number> = { I: 1.0, II: 0.91, III: 0.82, IV: 0.73 }
  const kTerrain = terrainFactors[terrainCategory] || 0.91

  const heightFactor = Math.pow(heightAboveGround / 10, 0.2)

  const aeroFactors: Record<string, number> = { solid: 1.3, slatted: 0.8, 'z-line': 0.6 }
  const cAero = aeroFactors[railingType] || 0.8

  const basePressure = 0.5 * 1.25 * Math.pow(windSpeedMs, 2)
  const designPressure = basePressure * kTerrain * heightFactor * cAero
  const totalForce = designPressure * railingAreaM2
  const railingLength = Math.sqrt(railingAreaM2)
  const forcePerMeter = totalForce / railingLength

  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  if (designPressure < 0.5) {
    riskLevel = 'LOW'
  } else if (designPressure < 1.0) {
    riskLevel = 'MEDIUM'
    recommendations.push('Preverite pritrdilne elemente. Uporabite A4 Inox vijake.')
  } else if (designPressure < 1.5) {
    riskLevel = 'HIGH'
    recommendations.push('Visoka vetrna obremenitev! Uporabite kemično sidranje in dodatne stebre.')
    recommendations.push('Priporočljivo: Z-line profil za zmanjšanje vetrenega upora.')
  } else {
    riskLevel = 'CRITICAL'
    recommendations.push('KRITIČNA vetrna obremenitev! Potrebna statična analiza.')
    recommendations.push('Obvezno: Kemično sidranje vseh stebrov, zmanjšan razmik med stebri.')
  }

  if (railingType === 'solid' && heightAboveGround > 20) {
    recommendations.push('Polna ograja nad 20m: Tveganje harmoničnih vibracij. Vgradite dušilna tesnila.')
  }

  return {
    windPressureKpa: Math.round(designPressure * 100) / 100,
    totalForceKn: Math.round(totalForce * 100) / 100,
    forcePerMeterNm: Math.round(forcePerMeter * 10) / 10,
    riskLevel,
    recommendations,
  }
}
