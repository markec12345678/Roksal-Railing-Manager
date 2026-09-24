/**
 * MEASUREMENT SDK (issue #2) — tipi in konstante.
 *
 * Določen v docs/MEASUREMENT.md + docs/MEASUREMENT-QUALITY.md.
 *
 * ZAKON (issue #2):
 *  - Ni AI modelov v kritični poti merjenja.
 *  - Nikoli ni izmišljenih dimenzij: absolutne mm vrednosti obstajajo SAMO,
 *    če obstaja veljaven vir merila (znana referenčna mera uporabnika,
 *    Roksal referenčni marker ali prihodnji depth vir).
 *  - Vsaka vrednost ima sledljiv izvor (provenance).
 *  - Determinizem: enak vhod → enak izhod (brez naključja, ure ali mreže).
 */

/** Kako je meritev nastala. */
export type MeasurementSource = 'automatic' | 'manual' | 'hybrid'

/** Kakovostno stanje meritve — NIKOLI "AI confidence". */
export type MeasurementQualityState =
  | 'INSUFFICIENT_DATA' // ni zaznane ograje / preveč malo podatkov
  | 'DETECTED' // struktura zaznana, merilo NI določeno
  | 'SCALE_REQUIRED' // zahtevek po referenčni meri (dimensions = null)
  | 'MEASUREMENT_READY' // merilo + geometrija = izmerjene vrednosti z negotovostjo
  | 'USER_REVIEW_REQUIRED' // ročni popravki prisotni — uporabnik mora potrditi
  | 'VERIFIED' // uporabnik je potrdil (confirmed)

/** Vir merila — sledljivost (issue #2 §5). */
export type ScaleSourceKind =
  | 'user-known-measure' // uporabnik vpiše znano dolžino
  | 'roksal-marker' // Roksal referenčni marker (prihodnje)
  | 'known-object' // znan objekt s potrjeno dimenzijo (prihodnje)
  | 'depth-sensor' // LiDAR/ToF (prihodnje)

/** Točka v NORMALIZIRANEM prostoru slike (0..1 obeh osi). */
export interface NormPoint {
  x: number
  y: number
}

/** Zaznana oz. uporabniška črta v normaliziranem prostoru. */
export interface NormLine {
  /** normalizirani y (horizontalna struktura) oziroma x (vertikalna) */
  pos: number
  /** obseg: [from, to] na orthogonalni osi */
  from: number
  to: number
  /** Hough podpora (0..1 relativno na najmočnejšo črto) */
  support: number
  /** pokritost z robovi (0..1) */
  coverage: number
}

/** Zaznan vertikalni steber (normalizirani x znotraj pasu ograje). */
export interface DetectedPost {
  x: number
  support: number
}

/** Zaznana struktura ograje v normaliziranem prostoru. */
export interface DetectedFeatures {
  /** horizontalni prekni (runs) — vsak = en odsek ograje v pogledu */
  runs: Array<{
    yTop: number
    yBottom: number
    x0: number
    x1: number
    supportTop: number
    supportBottom: number
  }>
  /** vertikalni stebri znotraj glavnega pasu (normalizirani x, naraščajoče) */
  posts: DetectedPost[]
  /** glavni kotniki (TL, TR, BR, BL) prvega run-a — kandidati za perspektivo */
  corners: [NormPoint, NormPoint, NormPoint, NormPoint] | null
}

/** Objektivne metrike kakovosti (issue #2 §4 — NIKOLI AI confidence). */
export interface MeasurementQualityMetrics {
  /** delež pikslov nad pragom robov (0..1) */
  edgeDensity: number
  /** podpora zgornje/spodnje črte (0..1 relativno na najmočnejšo) */
  lineSupportTop: number
  lineSupportBottom: number
  /** pokritost glavne horizontalne črte z robovi (0..1) */
  lineCoverage: number
  /** konsistentnost razmakov stebrov: 1 − normalizirana std (0..1) */
  postSpacingConsistency: number
  /** časovna stabilnost: 1 − povprečna pomika med frame-i (0..1; 1.0 če 1 frame) */
  temporalStability: number
  /** število analiziranih frame-ov */
  frames: number
}

/** Objasnitev stanja za UI — človeku razumljivo, brez ugibanja. */
export interface MeasurementGuidance {
  /** kaj sistem VIDI */
  seen: string
  /** kaj MANJKA za naslednje stanje */
  missing: string | null
  /** priporočen naslednji korak */
  nextAction: string
}

/** Referenca za merilo — 2 točki + znana dolžina v mm. */
export interface ScaleReference {
  p1: NormPoint
  p2: NormPoint
  /** znana dolžina med točkama v milimetrih (pozitivna, finite) */
  knownMm: number
  /** vir reference (sledljivost) */
  kind: ScaleSourceKind
}

/** Razrešeno merilo. */
export interface ResolvedScale {
  /** mm na enoto normaliziranega prostora (x os slike) */
  mmPerUnitX: number
  /** mm na enoto normaliziranega prostora (y os slike) */
  mmPerUnitY: number
  reference: ScaleReference
  /** oddaljenost referenčnih točk v normaliziranih enotah */
  referenceLengthUnits: number
}

/** Izmerjena dimenzija z izvorom + negotovostjo (issue #2 §3). */
export interface MeasuredDimension {
  /** vrednost v mm (SAMO če obstaja merilo) */
  valueMm: number
  /** negotovost ±mm (iz ±1 px pri zaznavi × merilo) */
  uncertaintyMm: number
  /** izvor vrednosti */
  source: MeasurementSource
  /** kako je nastala (sledljivost) */
  provenance: string
}

/** En segment balkona (raven, L, U — ročni način podaja več). */
export interface MeasuredSegment {
  index: number
  lengthMm: number
  uncertaintyMm: number
  /** začetek v mm od začetka balkona (naraščajoče) */
  startMm: number
  source: MeasurementSource
}

/** Polna izmerjena geometrija — SAMO ob veljavnem merilu. */
export interface MeasuredGeometry {
  totalLengthMm: MeasuredDimension
  heightMm: MeasuredDimension
  segments: MeasuredSegment[]
  postCount: number
  /** položaji stebrov v mm od začetka (naraščajoče, brez končnega) */
  postPositionsMm: number[]
  postSpacingConsistency: number
  source: MeasurementSource
}

/** Celotna merilna seja — skupni podatkovni model OBEH načinov (issue #2 §3). */
export interface MeasurementSession {
  /** shema (za prihodnjo razširljivost) */
  version: 1
  /** korelacijski id — določi klient (SDK NE generira ID-jev) */
  sessionId: string
  source: MeasurementSource
  /** zaznane značilke (normalizirane) — tudi ko merilo manjka */
  features: DetectedFeatures | null
  /** razrešeno merilo ali null (NI izmišljenega) */
  scale: ResolvedScale | null
  quality: {
    state: MeasurementQualityState
    metrics: MeasurementQualityMetrics
    guidance: MeasurementGuidance
    /** število ročnih popravk uporabnika (0 = čista avtomatika) */
    manualCorrections: number
  }
  /** izmerjena geometrija — null, dokler ni veljavnega merila */
  geometry: MeasuredGeometry | null
}

/** Vhod v detekcijo (issue #2 §1) — čisti vhod, brez stranskih učinkov. */
export interface DetectInput {
  /** 1..3 frame-i (RGBA). Več frame-ov = temporalStability metrika. */
  frames: Array<{ data: Uint8ClampedArray; w: number; h: number }>
}

/** Konstante zaznave (dokumentirane v docs/AUTOMATIC-DETECTION.md). */
export const MEASUREMENT_CONSTANTS = {
  /** maksimalna delovna ločljivost daljše stranice pri detekciji (px) */
  workMaxDim: 480,
  /** min. ločevanje zgornje/spodnje črte (delež višine slike) */
  minRailBandFraction: 0.06,
  /** min. pokritost horizontalne črte z robovi, da je veljavna */
  minLineCoverage: 0.35,
  /** maks. presledek znotraj črte (delež dolžine črte) */
  maxLineGapFraction: 0.12,
  /** toleranca združevanja vertikalnih črt istega stebra (px v delovnem
   *  prostoru) — pokrije oba roba deske (±3 px) + tiltno reprezentanto;
   *  realni razmak stebrov (≥300 mm ≈ ≥24 px) je varno nad to vrednostjo */
  postMergeTolerancePx: 14,
  /** maks. št. Hough vrhov horizontalnih/vertikalnih črt (po NMS) */
  maxHoughPeaks: 40,
  /** ±1 px zaznavna negotovost (osnova za uncertaintyMm) */
  detectionTolerancePx: 1,
  /** maks. frame-ov za stabilnost */
  maxFrames: 3,
} as const
