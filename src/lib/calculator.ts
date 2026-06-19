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

// ============================================
// 4. ENAKOMERNI RAZMAK PALIC (Equal spacing)
// ============================================
// Najbolj pogost problem monterjev: kako enakomerno porazdeliti palice
// med dvema točkama tako, da so razmiki enaki in ≤ maxGapMm.

export interface EqualSpacingInput {
  totalLengthMm: number
  balusterWidthMm: number
  maxGapMm: number // privzeto 110mm po SIST EN
}

export interface EqualSpacingResult {
  balusterCount: number
  actualGapMm: number
  positions: number[] // tekoče pozicije (mm od začetka) — LEVI ROB vsake palice
  centers: number[] // centri palic (mm) — za vrtanje lukenj
  isCompliant: boolean
  warnings: string[]
}

export function calculateEqualSpacing(input: EqualSpacingInput): EqualSpacingResult {
  const { totalLengthMm, balusterWidthMm } = input
  const maxGapMm = input.maxGapMm > 0 ? input.maxGapMm : 110
  const warnings: string[] = []

  if (totalLengthMm <= 0 || balusterWidthMm <= 0) {
    return {
      balusterCount: 0,
      actualGapMm: 0,
      positions: [],
      centers: [],
      isCompliant: false,
      warnings: ['Neveljavni vhodni podatki.'],
    }
  }

  // Število palic: minimalno n, da razmik ne preseže maxGapMm
  const n = Math.max(0, Math.ceil((totalLengthMm - maxGapMm) / (maxGapMm + balusterWidthMm)))
  if (n === 0) {
    return {
      balusterCount: 0,
      actualGapMm: totalLengthMm,
      positions: [],
      centers: [],
      isCompliant: totalLengthMm <= maxGapMm,
      warnings: ['Dolžina premajhna za palico.'],
    }
  }

  // Dejanski razmik med palicami (n+1 razmikov)
  const actualGap = (totalLengthMm - n * balusterWidthMm) / (n + 1)

  // Pozicije (levi rob vsake palice) in centri (za vrtanje)
  const positions: number[] = []
  const centers: number[] = []
  for (let i = 0; i < n; i++) {
    const leftEdge = actualGap + i * (balusterWidthMm + actualGap)
    positions.push(Math.round(leftEdge * 10) / 10)
    centers.push(Math.round((leftEdge + balusterWidthMm / 2) * 10) / 10)
  }

  const isCompliant = actualGap <= maxGapMm
  if (!isCompliant) {
    warnings.push(`Razmik ${actualGap.toFixed(1)}mm presega max ${maxGapMm}mm (SIST EN 1264). Dodajte več palic.`)
  }
  if (actualGap < 10) {
    warnings.push('Razmik zelo majhen (<10mm). Preverite ali je dovolj prostora za dilatacijo materiala.')
  }
  if (n > 0 && actualGap < 0) {
    warnings.push('NEGATIVEN razmik! Preveč palic za dano dolžino.')
  }

  return {
    balusterCount: n,
    actualGapMm: Math.round(actualGap * 10) / 10,
    positions,
    centers,
    isCompliant,
    warnings,
  }
}

// ============================================
// 5. KOTNI / STOPNIŠČNI IZRAČUN (Angled / Rake)
// ============================================
// Za stopniščne in kose ograje — izračun po rake (nagnjeni) ravnini.

export interface AngledSpacingInput {
  horizontalLengthMm: number
  rakeAngleDeg: number // kot stopnice od vodoravnice (npr. 35°)
  balusterWidthMm: number
  maxGapMm: number
}

export interface AngledSpacingResult extends EqualSpacingResult {
  rakeLengthMm: number
  rakeAngleDeg: number
  horizontalGapMm: number // projekcija razmika na vodoravnico
}

export function calculateAngledSpacing(input: AngledSpacingInput): AngledSpacingResult {
  const { horizontalLengthMm, rakeAngleDeg, balusterWidthMm } = input
  const maxGapMm = input.maxGapMm > 0 ? input.maxGapMm : 110
  const warnings: string[] = []

  if (rakeAngleDeg <= 0 || rakeAngleDeg >= 90) {
    return {
      ...calculateEqualSpacing({ totalLengthMm: horizontalLengthMm, balusterWidthMm, maxGapMm }),
      rakeLengthMm: horizontalLengthMm,
      rakeAngleDeg,
      horizontalGapMm: 0,
    }
  }

  const rad = (rakeAngleDeg * Math.PI) / 180
  const cosA = Math.cos(rad)
  const rakeLengthMm = horizontalLengthMm / cosA

  // Vrzemo v equal spacing z rake dolžino — palice so postavljene vzdolž rake
  const base = calculateEqualSpacing({
    totalLengthMm: rakeLengthMm,
    balusterWidthMm,
    maxGapMm,
  })

  // Projekcija razmika na vodoravnico (za preverjanje horizontalne skladnosti)
  const horizontalGapMm = base.actualGapMm * cosA

  if (rakeAngleDeg > 45) {
    warnings.push(`Kot ${rakeAngleDeg.toFixed(1)}° je > 45°! Zelo strmo — preverite statiko in oprijem palic.`)
  }
  if (rakeAngleDeg > 35) {
    warnings.push(`Kot ${rakeAngleDeg.toFixed(1)}° je značilen za strma stopnišča. Uporabite podaljšane palice.`)
  }

  return {
    ...base,
    rakeLengthMm: Math.round(rakeLengthMm * 10) / 10,
    rakeAngleDeg,
    horizontalGapMm: Math.round(horizontalGapMm * 10) / 10,
    warnings: [...warnings, ...base.warnings],
  }
}

// ============================================
// 6. PREDLOGA VRTANJA (Hole template)
// ============================================
// "Running measurements" — pozicije lukenj od prve točke.
// Monter natisne to predlogo in uporabi kot vodilo za vrtanje.

export interface HoleTemplateInput {
  segmentLengthMm: number
  postSpacingMm: number // max 1500mm po predpisih
  balusterLayout: EqualSpacingResult // layout za EN bay (med dvema stebroma)
}

export interface HoleTemplateResult {
  postPositions: number[] // pozicije stebrov (mm od začetka segmenta)
  holePositions: number[] // pozicije lukenj za palice (mm od začetka segmenta)
  postCount: number
  totalHoles: number
  bayCount: number
}

export function calculateHoleTemplate(input: HoleTemplateInput): HoleTemplateResult {
  const { segmentLengthMm, balusterLayout } = input
  // Omeji postSpacing na 1500mm (SIST EN)
  const postSpacingMm = Math.min(input.postSpacingMm > 0 ? input.postSpacingMm : 1500, 1500)

  if (segmentLengthMm <= 0) {
    return { postPositions: [], holePositions: [], postCount: 0, totalHoles: 0, bayCount: 0 }
  }

  // Pozicije stebrov: 0, postSpacing, 2*postSpacing, ... do segmentLengthMm
  const postPositions: number[] = [0]
  let pos = postSpacingMm
  while (pos < segmentLengthMm - 1) {
    postPositions.push(Math.round(pos))
    pos += postSpacingMm
  }
  // Zadnji stebro na koncu segmenta (če ni že tam)
  const last = postPositions[postPositions.length - 1]
  if (last < segmentLengthMm - 1) {
    postPositions.push(Math.round(segmentLengthMm))
  }

  const bayCount = postPositions.length - 1
  const holePositions: number[] = []

  // Za vsak bay: uporabi balusterLayout in dodaj offset stebra
  for (let b = 0; b < bayCount; b++) {
    const bayStart = postPositions[b]
    // Dejanska dolžina tega baya
    const bayEnd = postPositions[b + 1]
    const bayLen = bayEnd - bayStart
    // Če je bay krajši od predvidenega, prilagodi layout
    const layout = bayLen >= postSpacingMm - 1
      ? balusterLayout
      : calculateEqualSpacing({
          totalLengthMm: bayLen,
          balusterWidthMm: balusterLayout.actualGapMm > 0 ? 40 : 40, // privzeta širina
          maxGapMm: 110,
        })
    for (const c of layout.centers) {
      const absPos = bayStart + c
      // Samo če je znotraj tega baya
      if (absPos < bayEnd - 1) {
        holePositions.push(Math.round(absPos))
      }
    }
  }

  return {
    postPositions,
    holePositions,
    postCount: postPositions.length,
    totalHoles: holePositions.length,
    bayCount,
  }
}

// ============================================
// 7. SKUPNI MATERIAL (Material total)
// ============================================

export interface Profil {
  id?: string
  sifra: string
  naziv: string
  material: string
  kategorija: string
  visinaMm: number
  sirinaMm: number
  cenaM: number
  barvaRal?: string | null
  slikaUrl?: string | null
  aktivna?: boolean
}

export interface MaterialSegment {
  lengthMm: number
  heightMm: number
  type: 'level' | 'angled' | 'stair'
  rakeAngleDeg?: number // za angled/stair
}

export interface MaterialTotalInput {
  segments: MaterialSegment[]
  profileSifra: string
  profili: Profil[]
  balusterWidthMm?: number // privzeto 40mm
  postSpacingMm?: number // privzeto 1500mm
  maxGapMm?: number // privzeto 110mm
}

export interface MaterialTotalResult {
  totalLinearMeters: number // tekoči metri profila (letve + palice)
  railLinearMeters: number // samo letve (zgoraj + spodaj)
  balusterLinearMeters: number // samo palice (višina × št.)
  balusterCount: number
  postCount: number
  railCount: number // 2 (zgoraj + spodaj) × št. segmentov
  screwCount: number // 4/palico + 8/stebro
  anchorCount: number // 2/stebro
  profileCost: number // cena profila × tekoči metri
  postsCost: number
  screwsCost: number
  anchorsCost: number
  totalCost: number
  selectedProfile: Profil | null
  perSegment: Array<{
    lengthM: number
    balusterCount: number
    postCount: number
    type: string
  }>
}

export function calculateMaterialTotal(input: MaterialTotalInput): MaterialTotalResult {
  const balusterWidthMm = input.balusterWidthMm ?? 40
  const postSpacingMm = Math.min(input.postSpacingMm ?? 1500, 1500)
  const maxGapMm = input.maxGapMm ?? 110

  const selectedProfile = input.profili.find((p) => p.sifra === input.profileSifra) ?? null
  const cenaM = selectedProfile?.cenaM ?? 0

  let railLinearMm = 0
  let balusterLinearMm = 0
  let balusterCount = 0
  let postCount = 0
  let railCount = 0
  const perSegment: MaterialTotalResult['perSegment'] = []

  for (const seg of input.segments) {
    if (seg.lengthMm <= 0) continue
    // Efektivna dolžina za izračun palic (rake za angled/stair)
    let effLength = seg.lengthMm
    if ((seg.type === 'angled' || seg.type === 'stair') && seg.rakeAngleDeg && seg.rakeAngleDeg > 0) {
      const rad = (seg.rakeAngleDeg * Math.PI) / 180
      effLength = seg.lengthMm / Math.cos(rad)
    }

    // Letve (top + bottom) = 2 × dolžina segmenta
    railLinearMm += 2 * seg.lengthMm
    railCount += 2

    // Palice v segmentu
    const bal = calculateEqualSpacing({
      totalLengthMm: effLength,
      balusterWidthMm,
      maxGapMm,
    })
    balusterCount += bal.balusterCount
    // Linear meters palic = št. × višina (mm) / 1000
    balusterLinearMm += bal.balusterCount * seg.heightMm

    // Stebri: na vsakih postSpacingMm + 1 na koncu
    const posts = Math.max(2, Math.floor(seg.lengthMm / postSpacingMm) + 1)
    postCount += posts

    perSegment.push({
      lengthM: Math.round((seg.lengthMm / 1000) * 100) / 100,
      balusterCount: bal.balusterCount,
      postCount: posts,
      type: seg.type,
    })
  }

  const railLinearMeters = railLinearMm / 1000
  const balusterLinearMeters = balusterLinearMm / 1000
  const totalLinearMeters = railLinearMeters + balusterLinearMeters

  const screwCount = balusterCount * 4 + postCount * 8
  const anchorCount = postCount * 2

  const profileCost = totalLinearMeters * cenaM
  const postsCost = postCount * 25
  const screwsCost = screwCount * 0.1
  const anchorsCost = anchorCount * 1.5
  const totalCost = profileCost + postsCost + screwsCost + anchorsCost

  return {
    totalLinearMeters: Math.round(totalLinearMeters * 100) / 100,
    railLinearMeters: Math.round(railLinearMeters * 100) / 100,
    balusterLinearMeters: Math.round(balusterLinearMeters * 100) / 100,
    balusterCount,
    postCount,
    railCount,
    screwCount,
    anchorCount,
    profileCost: Math.round(profileCost * 100) / 100,
    postsCost: Math.round(postsCost * 100) / 100,
    screwsCost: Math.round(screwsCost * 100) / 100,
    anchorsCost: Math.round(anchorsCost * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    selectedProfile,
    perSegment,
  }
}

// ============================================
// 8. PREVERJANJE PREDPISOV (Compliance)
// ============================================

export interface ComplianceInput {
  gapMm: number
  heightMm: number
  postSpacingMm: number
  loadCategory: 'A' | 'B' | 'C' // A=stanovanjsko, B=javno, C=intenzivno javno
  dropHeightMm?: number // višina padca pod ograjo
}

export interface ComplianceCheck {
  name: string
  required: string
  actual: string
  passed: boolean
  message: string
}

export interface ComplianceResult {
  passed: boolean
  checks: ComplianceCheck[]
}

export function checkCompliance(input: ComplianceInput): ComplianceResult {
  const { gapMm, heightMm, postSpacingMm, loadCategory, dropHeightMm = 0 } = input
  const checks: ComplianceCheck[] = []

  // 1. Razmik med palicami (SIST EN 1264 — krogla 100mm ne sme pastiti)
  const maxGapAllowed = 110
  checks.push({
    name: 'Razmik med palicami',
    required: `≤ ${maxGapAllowed}mm (SIST EN 1264)`,
    actual: `${gapMm.toFixed(1)}mm`,
    passed: gapMm <= maxGapAllowed,
    message:
      gapMm <= maxGapAllowed
        ? 'Skladno — krogla 100mm ne more pastiti skozi.'
        : `RAZMIK PRESEGA ${maxGapAllowed}mm! Nevarnost za otroke (lestveni učinek).`,
  })

  // 2. Višina ograje (od padca odvisna)
  const minHeight = dropHeightMm > 1000 ? 1000 : 900
  checks.push({
    name: 'Višina ograje',
    required: `≥ ${minHeight}mm${dropHeightMm > 1000 ? ' (padec > 1m)' : ' (balkon)'}`,
    actual: `${heightMm.toFixed(0)}mm`,
    passed: heightMm >= minHeight,
    message:
      heightMm >= minHeight
        ? 'Skladno višina.'
        : `Višina ${heightMm}mm < ${minHeight}mm — neustrezno!`,
  })

  // 3. Razmik med stebri
  const maxPostSpacing = 1500
  checks.push({
    name: 'Razmik med stebri',
    required: `≤ ${maxPostSpacing}mm`,
    actual: `${postSpacingMm.toFixed(0)}mm`,
    passed: postSpacingMm <= maxPostSpacing,
    message:
      postSpacingMm <= maxPostSpacing
        ? 'Skladno statika stebrov.'
        : `Razmik ${postSpacingMm}mm > ${maxPostSpacing}mm — tveganje upogiba.`,
  })

  // 4. Horizontalna obremenitev (EVS EN 1991-1-1)
  const requiredLoad: Record<string, number> = { A: 0.74, B: 1.0, C: 1.5 } // kN/m
  const reqKnm = requiredLoad[loadCategory] ?? 1.0
  checks.push({
    name: 'Horizontalna obremenitev',
    required: `≥ ${reqKnm} kN/m (kat. ${loadCategory})`,
    actual: `Obvezno preverjanje s statikom`,
    passed: true, // informativno — predpostavimo da statiko naredi odgovorni projektant
    message: `Kategorija ${loadCategory}: ${loadCategory === 'A' ? 'stanovanjsko' : loadCategory === 'B' ? 'javno' : 'intenzivno javno'} breme.`,
  })

  // 5. Dodatno: material in pritrditev
  checks.push({
    name: 'Material in pritrditev',
    required: 'A4 Inox vijaki + kemično sidranje',
    actual: 'Monter odgovoren',
    passed: true,
    message: 'Uporabite A4 (Inox 316) vijake in kemično sidranje stebrov v armaturo.',
  })

  const passed = checks.every((c) => c.passed)
  return { passed, checks }
}

// ============================================
// 9. POMOŽNE FUNKCIJE (Helpers)
// ============================================

/** Formatira EUR vrednost v slovenskem formatu: 1234.56 → "1.234,56 €" */
export function formatEUR(eur: number): string {
  if (!isFinite(eur)) eur = 0
  const rounded = Math.round(eur * 100) / 100
  // Loči cela mesta in decimalko
  const parts = rounded.toFixed(2).split('.')
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const decPart = parts[1] ?? '00'
  return `${intPart},${decPart} €`
}

/** Pretvori število v slovenski format brez EUR: 1234.5 → "1.234,5" */
export function formatSI(num: number, decimals = 2): string {
  if (!isFinite(num)) num = 0
  const rounded = Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals)
  const parts = rounded.toFixed(decimals).split('.')
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const decPart = parts[1] ?? ''
  return decPart ? `${intPart},${decPart}` : intPart
}

// ============================================
// 10. STROŠEK DELA (Labor cost)
// ============================================

export interface LaborCostInput {
  urnaPostavka: number // EUR/h
  stUr: number // ure skupaj
  stMonterjev: number // število monterjev
  transport: number // EUR enkratno
}

export interface LaborCostResult {
  urnaPostavka: number
  stUr: number
  stMonterjev: number
  transport: number
  delaSkupaj: number // urnaPostavka × stUr × stMonterjev + transport
  cistaDela: number // urnaPostavka × stUr × stMonterjev (brez transporta)
  predvideniCas: number // skupne ure (stUr × stMonterjev)
}

export function calculateLaborCost(input: LaborCostInput): LaborCostResult {
  const urnaPostavka = isFinite(input.urnaPostavka) ? input.urnaPostavka : 0
  const stUr = isFinite(input.stUr) ? input.stUr : 0
  const stMonterjev = isFinite(input.stMonterjev) ? input.stMonterjev : 0
  const transport = isFinite(input.transport) ? input.transport : 0

  const cistaDela = urnaPostavka * stUr * stMonterjev
  const delaSkupaj = cistaDela + transport
  const predvideniCas = stUr * stMonterjev

  return {
    urnaPostavka,
    stUr,
    stMonterjev,
    transport,
    cistaDela: Math.round(cistaDela * 100) / 100,
    delaSkupaj: Math.round(delaSkupaj * 100) / 100,
    predvideniCas,
  }
}

// ============================================
// 11. REZERVA MATERIALA (Material reserve)
// ============================================

/** Pripravi rezervo na količino in zaokroži navzgor na celo število kosov. */
export function applyReserve(qty: number, reservePct: number): number {
  if (!isFinite(qty) || qty < 0) return 0
  const factor = 1 + (isFinite(reservePct) ? reservePct : 0) / 100
  return Math.ceil(qty * factor)
}

// ============================================
// 12. DDV (VAT)
// ============================================

export interface DDVResult {
  base: number // znesek brez DDV
  ddvPct: number // % DDV
  ddvAmount: number // znesek DDV
  total: number // skupaj z DDV
}

export function calculateDDV(base: number, ddvPct: number): DDVResult {
  const b = isFinite(base) ? base : 0
  const pct = isFinite(ddvPct) ? ddvPct : 0
  const ddvAmount = (b * pct) / 100
  return {
    base: Math.round(b * 100) / 100,
    ddvPct: pct,
    ddvAmount: Math.round(ddvAmount * 100) / 100,
    total: Math.round((b + ddvAmount) * 100) / 100,
  }
}

// ============================================
// 13. AKONTACIJA (Advance payment)
// ============================================

export interface AkontacijaResult {
  total: number // skupni znesek (z DDV)
  akontacijaPct: number // %
  akontacija: number // znesek akontacije
  preostanek: number // preostanek
}

export function calculateAkontacija(total: number, akontacijaPct: number): AkontacijaResult {
  const t = isFinite(total) ? total : 0
  const pct = isFinite(akontacijaPct) ? akontacijaPct : 0
  const akontacija = (t * pct) / 100
  return {
    total: Math.round(t * 100) / 100,
    akontacijaPct: pct,
    akontacija: Math.round(akontacija * 100) / 100,
    preostanek: Math.round((t - akontacija) * 100) / 100,
  }
}

// ============================================
// 14. CNC RAZREZNI NAČRT (1D bin packing)
// ============================================
// First-Fit Decreasing (FFD) algoritem za optimizacijo razreza profilov.
// Standardne dolžine: alu 6000mm, WPC 2200/4000mm.

export interface CncCutInput {
  // Zahtevane dolžine (odseki za rezanje)
  segments: Array<{ lengthMm: number; count: number; label?: string }>
  // Standardna dolžina profila (navadno 6000mm za alu, 2200/4000mm za WPC)
  stockLengthMm: number
  // Širina reza (žagin disk, default 3mm)
  sawBladeWidthMm?: number
}

export interface CncCutResult {
  // Število kupljenih profilov
  stockCount: number
  // Razrezni načrt za vsak profil
  plans: Array<{
    stockIndex: number
    cuts: Array<{ lengthMm: number; label?: string; fromSegmentIndex: number }>
    remainingMm: number
    utilizationPct: number
  }>
  // Skupna dolžina zahtevanih odsekov
  totalRequiredMm: number
  // Skupna dolžina kupljenih profilov
  totalStockMm: number
  // Skupni ostanki (vključno z žaginimi rezi)
  totalWasteMm: number
  // Skupni izkoristek %
  overallUtilizationPct: number
  warnings: string[]
}

export function calculateCncCutting(input: CncCutInput): CncCutResult {
  const warnings: string[] = []
  const sawBladeWidthMm = input.sawBladeWidthMm && input.sawBladeWidthMm > 0 ? input.sawBladeWidthMm : 3
  const stockLengthMm = input.stockLengthMm

  if (!isFinite(stockLengthMm) || stockLengthMm <= 0) {
    return {
      stockCount: 0,
      plans: [],
      totalRequiredMm: 0,
      totalStockMm: 0,
      totalWasteMm: 0,
      overallUtilizationPct: 0,
      warnings: ['Neveljavna dolžina profila.'],
    }
  }

  // Preveri segmente — če kateri presega stock
  for (const seg of input.segments) {
    if (seg.lengthMm > stockLengthMm) {
      warnings.push(`Odsek ${seg.lengthMm}mm presega dolžino profila ${stockLengthMm}mm!`)
    }
    if (seg.count <= 0) {
      warnings.push(`Odsek z ${seg.count} kosi je neveljaven (sprejeto 0).`)
    }
  }

  // Razširi segmente v posamezne odseke
  type CutItem = { lengthMm: number; label?: string; fromSegmentIndex: number }
  const cuts: CutItem[] = []
  input.segments.forEach((seg, idx) => {
    const count = Math.max(0, Math.floor(seg.count))
    for (let i = 0; i < count; i++) {
      if (seg.lengthMm > 0 && seg.lengthMm <= stockLengthMm) {
        cuts.push({
          lengthMm: Math.round(seg.lengthMm * 10) / 10,
          label: seg.label,
          fromSegmentIndex: idx,
        })
      }
    }
  })

  if (cuts.length === 0) {
    return {
      stockCount: 0,
      plans: [],
      totalRequiredMm: 0,
      totalStockMm: 0,
      totalWasteMm: 0,
      overallUtilizationPct: 0,
      warnings: ['Ni veljavnih odsekov za razrez.'],
    }
  }

  // First-Fit Decreasing: sortiraj po dolžini padajoče
  cuts.sort((a, b) => b.lengthMm - a.lengthMm)

  // Pakiranje
  type Stock = { cuts: CutItem[]; usedMm: number }
  const stocks: Stock[] = []

  for (const cut of cuts) {
    let placed = false
    for (const stock of stocks) {
      // Dodajanje v obstoječ profil: potrebujemo rezilo + dolžino
      const needed = (stock.cuts.length > 0 ? sawBladeWidthMm : 0) + cut.lengthMm
      if (stock.usedMm + needed <= stockLengthMm) {
        stock.cuts.push(cut)
        stock.usedMm += needed
        placed = true
        break
      }
    }
    if (!placed) {
      // Odpri nov profil
      stocks.push({ cuts: [cut], usedMm: cut.lengthMm })
    }
  }

  const plans = stocks.map((stock, idx) => {
    const usedMm = stock.usedMm
    const remainingMm = Math.max(0, stockLengthMm - usedMm)
    const utilizationPct = (usedMm / stockLengthMm) * 100
    return {
      stockIndex: idx + 1,
      cuts: stock.cuts.map((c) => ({
        lengthMm: c.lengthMm,
        label: c.label,
        fromSegmentIndex: c.fromSegmentIndex,
      })),
      remainingMm: Math.round(remainingMm * 10) / 10,
      utilizationPct: Math.round(utilizationPct * 10) / 10,
    }
  })

  const totalRequiredMm = cuts.reduce((sum, c) => sum + c.lengthMm, 0)
  const totalStockMm = stocks.length * stockLengthMm
  const totalWasteMm = totalStockMm - totalRequiredMm
  const overallUtilizationPct = totalStockMm > 0 ? (totalRequiredMm / totalStockMm) * 100 : 0

  if (overallUtilizationPct < 70) {
    warnings.push(`Izkoristek ${overallUtilizationPct.toFixed(1)}% je nizak. Razmislite o ponovni uporabi ostankov.`)
  }

  return {
    stockCount: stocks.length,
    plans,
    totalRequiredMm: Math.round(totalRequiredMm),
    totalStockMm,
    totalWasteMm: Math.round(totalWasteMm),
    overallUtilizationPct: Math.round(overallUtilizationPct * 10) / 10,
    warnings,
  }
}

// ============================================
// 15. VETRNI IZRAČUN PO LOKACIJI (SIST EN 1991-1-4 NA Slovenija)
// ============================================
// Določi vetrno cono iz GPS koordinat in izračuna obremenitev.

export interface WindLocationInput {
  latitude: number
  longitude: number
  heightAboveGround: number // m
  terrainCategory: 'I' | 'II' | 'III' | 'IV'
  railingAreaM2: number
  railingType: 'solid' | 'slatted' | 'z-line'
}

export interface WindLocationResult {
  windZone: 1 | 2 | 3
  basicWindSpeedMs: number
  basicPressureKpa: number
  designPressureKpa: number
  totalForceKn: number
  forcePerMeterNm: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  locationDescription: string
  recommendations: string[]
}

/** Pomožna funkcija: določi približno ime mesta iz GPS (poenostavljeno za Slovenijo). */
function describeSlovenianLocation(lat: number, lon: number): string {
  if (lat >= 46.20 && lat <= 46.45 && lon >= 14.20 && lon <= 14.45) return 'Kranj'
  if (lat >= 46.00 && lat <= 46.15 && lon >= 14.40 && lon <= 14.65) return 'Ljubljana'
  if (lat >= 46.50 && lat <= 46.70 && lon >= 15.55 && lon <= 15.75) return 'Maribor'
  if (lat >= 46.18 && lat <= 46.30 && lon >= 15.20 && lon <= 15.35) return 'Celje'
  if (lat >= 45.45 && lat <= 45.60 && lon >= 13.65 && lon <= 13.85) return 'Koper'
  if (lat >= 46.30 && lat <= 46.50 && lon >= 13.50 && lon <= 14.20) return 'Julijske Alpe / Bled'
  if (lat >= 46.45 && lat <= 46.75 && lon >= 13.50 && lon <= 14.10) return 'Karavanke'
  if (lat >= 45.95 && lat <= 46.10 && lon >= 13.60 && lon <= 13.80) return 'Nova Gorica'
  if (lat >= 46.20 && lat <= 46.30 && lon >= 13.80 && lon <= 14.00) return 'Tolmin / Bovec'
  if (lat >= 46.20 && lat <= 46.30 && lon >= 15.65 && lon <= 15.85) return 'Ptuj'
  return 'Lokacija (Slovenija)'
}

export function calculateWindByLocation(input: WindLocationInput): WindLocationResult {
  const { latitude, longitude, heightAboveGround, terrainCategory, railingAreaM2, railingType } = input
  const recommendations: string[] = []

  // Določanje cone (poenostavljeno za Slovenijo)
  let windZone: 1 | 2 | 3
  let zoneDescription: string
  if (latitude > 46.5 && longitude > 13.8) {
    windZone = 3
    zoneDescription = 'gore (Julijske/Karavanke)'
  } else if (latitude < 45.7 && longitude > 13.5) {
    windZone = 2
    zoneDescription = 'obala (Primorska)'
  } else {
    windZone = 1
    zoneDescription = 'celina'
  }

  const basicWindSpeedMs = windZone === 1 ? 22 : windZone === 2 ? 24 : 28
  // basicPressureKpa = 0.5 * 1.25 * v² / 1000
  const basicPressureKpa = (0.5 * 1.25 * Math.pow(basicWindSpeedMs, 2)) / 1000

  // Faktorji (enako kot calculateWindLoad)
  const terrainFactors: Record<string, number> = { I: 1.0, II: 0.91, III: 0.82, IV: 0.73 }
  const kTerrain = terrainFactors[terrainCategory] || 0.91
  const safeHeight = Math.max(heightAboveGround, 1)
  const heightFactor = Math.pow(safeHeight / 10, 0.2)
  const aeroFactors: Record<string, number> = { solid: 1.3, slatted: 0.8, 'z-line': 0.6 }
  const cAero = aeroFactors[railingType] || 0.8

  const designPressureKpa = basicPressureKpa * kTerrain * heightFactor * cAero
  const totalForceKn = designPressureKpa * railingAreaM2 // kPa × m² = kN
  const railingLengthM = Math.sqrt(railingAreaM2)
  const forcePerMeterNm = railingLengthM > 0 ? (totalForceKn / railingLengthM) * 1000 : 0

  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  if (designPressureKpa < 0.5) {
    riskLevel = 'LOW'
  } else if (designPressureKpa < 1.0) {
    riskLevel = 'MEDIUM'
    recommendations.push('Preverite pritrdilne elemente. Uporabite A4 Inox vijake.')
  } else if (designPressureKpa < 1.5) {
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
  if (windZone === 3) {
    recommendations.push(`Cona 3 (gore): burja in vetrovi visokih hitrosti. Obvezna ojačana pritrditev.`)
  }
  if (windZone === 2) {
    recommendations.push(`Cona 2 (obala): burja. Priporočamo Z-line profil in Inox A4 vijake.`)
  }

  const cityName = describeSlovenianLocation(latitude, longitude)
  const locationDescription = `${cityName} — ${zoneDescription} (cona ${windZone})`

  return {
    windZone,
    basicWindSpeedMs,
    basicPressureKpa: Math.round(basicPressureKpa * 1000) / 1000,
    designPressureKpa: Math.round(designPressureKpa * 1000) / 1000,
    totalForceKn: Math.round(totalForceKn * 100) / 100,
    forcePerMeterNm: Math.round(forcePerMeterNm * 10) / 10,
    riskLevel,
    locationDescription,
    recommendations,
  }
}

// ============================================
// 16. STEKLENA BALUSTRADA (poenostavljena metoda po SIST EN)
// ============================================
// Poenostavljen izračun napetosti v steklu za steklene balustrade.

export interface GlassCalcInput {
  // Razpon med stebri (mm)
  spanMm: number
  // Višina stekla (mm), navadno 1000-1100
  heightMm: number
  // Obremenitev (kN/m) — horizontal load
  loadKnPerM: number
  // Tip stekla
  glassType: 'single' | 'laminated' | 'tempered'
}

export interface GlassCalcResult {
  // Priporočena debelina stekla (mm)
  recommendedThicknessMm: number
  // Alternativne debeline
  alternativeThicknesses: Array<{ mm: number; safe: boolean; reason: string }>
  // Maksimalni dovoljen razpon za izbrano debelino
  maxSpanForThicknessMm: number
  // Napetost v steklu (MPa)
  stressMpa: number
  // Dovoljena napetost (MPa) glede na tip stekla
  allowableStressMpa: number
  // Ali je izbira varna
  isSafe: boolean
  // Število slojev za laminirano
  layers?: number
  warnings: string[]
  recommendations: string[]
}

export function calculateGlassBalustrade(input: GlassCalcInput): GlassCalcResult {
  const { spanMm, heightMm, loadKnPerM, glassType } = input
  const warnings: string[] = []
  const recommendations: string[] = []

  const allowableStressMap: Record<GlassCalcInput['glassType'], number> = {
    single: 40,
    laminated: 50,
    tempered: 120,
  }
  const allowableStressMpa = allowableStressMap[glassType]

  // Kandidati (skupna debelina v mm)
  const candidates: Array<{ mm: number; layers?: number; baseMm?: number }> =
    glassType === 'laminated'
      ? [
          { mm: 12, layers: 2, baseMm: 6 },
          { mm: 16, layers: 2, baseMm: 8 },
          { mm: 20, layers: 2, baseMm: 10 },
          { mm: 24, layers: 2, baseMm: 12 },
        ]
      : [
          { mm: 8 },
          { mm: 10 },
          { mm: 12 },
          { mm: 15 },
          { mm: 19 },
          { mm: 22 },
          { mm: 25 },
        ]

  // 1 kN/m = 1 N/mm (simplified — load is line load on horizontal beam)
  const loadNPerMm = loadKnPerM
  const spanM = Math.max(spanMm, 1)

  const stressFor = (thicknessMm: number) =>
    (loadNPerMm * Math.pow(spanM, 2) * 6) / (Math.pow(thicknessMm, 2) * 8)

  const alternativeThicknesses = candidates.map((c) => {
    const stress = stressFor(c.mm)
    const safe = stress <= allowableStressMpa
    const reason = safe
      ? `Napetost ${stress.toFixed(1)} MPa ≤ ${allowableStressMpa} MPa — varno`
      : `Napetost ${stress.toFixed(1)} MPa > ${allowableStressMpa} MPa — preseženo`
    return { mm: c.mm, safe, reason }
  })

  const firstSafe = alternativeThicknesses.find((a) => a.safe)
  const recommendedThicknessMm = firstSafe?.mm ?? candidates[candidates.length - 1].mm

  const stressMpa = stressFor(recommendedThicknessMm)
  const isSafe = stressMpa <= allowableStressMpa

  // Max razpon za izbrano debelino: span = sqrt(allowable × t² × 8 / (load × 6))
  const maxSpanForThicknessMm = Math.sqrt(
    (allowableStressMpa * Math.pow(recommendedThicknessMm, 2) * 8) / (Math.max(loadNPerMm, 0.001) * 6),
  )

  // Opozorila
  if (!isSafe) {
    warnings.push(
      `Priporočena debelina ${recommendedThicknessMm}mm ne zadošča! Izberite večjo debelino ali zmanjšajte razpon.`,
    )
  }
  if (spanMm > 1500) {
    warnings.push('Razpon > 1500mm — priporočamo dodaten steber za varnost.')
  }
  if (heightMm < 1000) {
    warnings.push(`Višina stekla ${heightMm}mm je pod standardom (min 1000mm za balkone).`)
  }
  if (heightMm > 1200) {
    warnings.push(`Višina stekla ${heightMm}mm — preverite statiko za povečano obremenitev.`)
  }
  if (loadKnPerM >= 2.0) {
    warnings.push('Visoka obremenitev (2,0 kN/m) — balkon z višinskim padcem. Obvezna statična analiza.')
  }

  // Priporočila
  if (glassType === 'laminated') {
    const baseMm = candidates.find((c) => c.mm === recommendedThicknessMm)?.baseMm ?? recommendedThicknessMm / 2
    recommendations.push(
      `Laminirano steklo: 2× ${baseMm}mm + PVB folija = ${recommendedThicknessMm}mm`,
    )
    recommendations.push('Laminirano steklo ob razbitju ostane skupaj (varnostna folija PVB).')
  } else if (glassType === 'tempered') {
    recommendations.push('Kaljeno steklo je 4-5× odpornejše od navadnega.')
    recommendations.push('Pri razbitju se drobi v drobne koščke (varnostno).')
  } else {
    recommendations.push('Enojno steklo ni primerno za javne prostore — razmislite o laminiranem ali kaljenem.')
  }
  if (spanMm > 1200) {
    recommendations.push(`Pri razponu ${spanMm}mm priporočamo dodaten stebro na vsakih 1200mm.`)
  }
  recommendations.push('Uporabite A4 (Inox 316) vijake in kemično sidranje stebrov.')
  recommendations.push('Robovi stekla morajo biti bruseni (poliranje za preprečitev loma).')

  return {
    recommendedThicknessMm,
    alternativeThicknesses,
    maxSpanForThicknessMm: Math.round(maxSpanForThicknessMm),
    stressMpa: Math.round(stressMpa * 10) / 10,
    allowableStressMpa,
    isSafe,
    layers: glassType === 'laminated' ? 2 : undefined,
    warnings,
    recommendations,
  }
}
