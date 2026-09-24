/**
 * CV STUDIO SDK — ocena kakovosti slike (issues #10 §2 "Kakovost",
 * #11 §13 slaba svetloba/šum/mehka slika).
 *
 * Vse deterministično, objektivno merljivo — brez AI, brez ugibanja.
 * Verdikt `usable` je tehničen (rezolucija/kontrast); slaba svetloba ali
 * šum = OPOZORILO, ne blokada (ročni način mora ostati odprt).
 */
import type { GrayImage, GradientImage } from '@/lib/measurement/cv'
import type { SceneQuality } from './types'

/** Min. delovna ločljivost daljše stranice za smiselno analizo (px). */
export const MIN_WORK_DIM = 160
/** Min. kontrast (std luminance) — pod tem ni strukture za zaznavo. */
export const MIN_CONTRAST = 0.015
/** Nad tem je slika praktično "prežgana" / pod tem praktično črna. */
export const EXTREME_BRIGHTNESS = 0.92
export const DARK_BRIGHTNESS = 0.08

/** Povprečna luminanca (0..1) — deterministično. */
export function meanLuminance(gray: GrayImage): number {
  let sum = 0
  for (let i = 0; i < gray.data.length; i++) sum += gray.data[i]
  return sum / gray.data.length
}

/** Standardni odklon luminance (0..1) — deterministično. */
export function stdLuminance(gray: GrayImage): number {
  const mean = meanLuminance(gray)
  let varSum = 0
  for (let i = 0; i < gray.data.length; i++) {
    const d = gray.data[i] - mean
    varSum += d * d
  }
  return Math.sqrt(varSum / gray.data.length)
}

/** Povprečna magnituda gradienta (0..1) — nizka vrednost = mehka slika. */
export function meanGradientMagnitude(grad: GradientImage): number {
  let sum = 0
  for (let i = 0; i < grad.mag.length; i++) sum += grad.mag[i]
  return sum / grad.mag.length
}

/**
 * Ocena šuma: povprečna visokofrekvenčna residua (|gray − 3×3 box blur|)
 * na NOTRANJIh pikslih. Robovi dvignejo vrednost, zato jo razlagamo SAMO
 * kot tehnični signal (opozorilo), ne kot zavračanje.
 */
export function noiseEstimate(gray: GrayImage): number {
  const { data, w, h } = gray
  if (w < 3 || h < 3) return 0
  let sum = 0
  let count = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const blur =
        (data[i - w - 1] + data[i - w] + data[i - w + 1] +
          data[i - 1] + data[i] + data[i + 1] +
          data[i + w - 1] + data[i + w] + data[i + w + 1]) / 9
      sum += Math.abs(data[i] - blur)
      count++
    }
  }
  return count > 0 ? sum / count : 0
}

/** Pražne vrednosti šuma/ostrosti za opozorila (deterministične meje). */
export const QUALITY_THRESHOLDS = {
  /** nad tem = izrazito šumna slika (opozorilo) */
  highNoise: 0.045,
  /** pod tem = mehka/zabrisana slika (opozorilo) */
  lowSharpness: 0.02,
} as const

/**
 * Polna ocena kakovosti. NIKOLI ne blokira analize — vrne metrike + razloge.
 */
export function assessImageQuality(gray: GrayImage, grad: GradientImage): SceneQuality {
  const brightness = meanLuminance(gray)
  const contrast = stdLuminance(gray)
  const sharpness = meanGradientMagnitude(grad)
  const noise = noiseEstimate(gray)

  const reasons: string[] = []
  const longer = Math.max(gray.w, gray.h)
  if (longer < MIN_WORK_DIM) {
    reasons.push(`Ločljivost delovne slike (${gray.w}×${gray.h} px) je pod minimumom ${MIN_WORK_DIM} px.`)
  }
  if (contrast < MIN_CONTRAST) {
    reasons.push(`Kontrast (${contrast.toFixed(4)}) je pod pragom ${MIN_CONTRAST} — ni uporabne strukture.`)
  }

  const warnings: string[] = []
  if (brightness < DARK_BRIGHTNESS) {
    warnings.push('Zelo temna slika — zaznava je lahko nezanesljiva; pričakuj ročni popravek.')
  } else if (brightness > EXTREME_BRIGHTNESS) {
    warnings.push('Zelo svetla (prežgana) slika — zaznava je lahko nezanesljiva; pričakuj ročni popravek.')
  }
  if (noise > QUALITY_THRESHOLDS.highNoise) {
    warnings.push(`Izrazit šum (ocena ${noise.toFixed(4)}) — zaznave so lahko nestabilne.`)
  }
  if (sharpness < QUALITY_THRESHOLDS.lowSharpness) {
    warnings.push(`Mehka/zabrisana slika (ostrost ${sharpness.toFixed(4)}) — robovi so lahko slabo določeni.`)
  }

  return {
    metrics: {
      edgeDensity: 0,
      lineSupportTop: 0,
      lineSupportBottom: 0,
      lineCoverage: 0,
      postSpacingConsistency: 1,
      temporalStability: 1,
      frames: 1,
    },
    brightness: round4(brightness),
    contrast: round4(contrast),
    sharpness: round4(sharpness),
    noiseEstimate: round4(noise),
    usable: reasons.length === 0,
    reasons,
  }
}

/** Zaokroži na 4 decimalki (determinističen JSON — bajtna stabilnost). */
export function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}
