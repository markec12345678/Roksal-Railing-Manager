/**
 * MEASUREMENT API (issue #2) — POST /api/measurement/detect
 *
 * Samodejna deterministična detekcija ograje (brez AI modelov):
 *   imageData (data URL, priporočeno ≤1280 px, JPEG/PNG)
 *   → decode (sharp) → detectFeatures (Sobel+Hough, pure TS)
 *   → { features, metrics, state, guidance } — BREZ dimenzij.
 *
 * Nikoli ne ugiba merila: brez referenčne mere je odgovor SCALE_REQUIRED.
 */
import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { authenticate, unauthorized } from '@/lib/auth'
import {
  detectFeatures,
  MeasurementValidationError,
  MEASUREMENT_CONSTANTS,
} from '@/lib/measurement'
import type { ImageBuffer } from '@/lib/viz/types'

export const runtime = 'nodejs'
export const maxDuration = 30

const ALLOWED_PREFIX = 'data:image/'
const MAX_BODY_BYTES = 8 * 1024 * 1024 // 8 MB (data URL — klient pošilja ≤1280px JPEG)

/** Data URL → RGBA ImageBuffer (determinističen decode, srednja ločljivost). */
async function dataUrlToImageBuffer(dataUrl: string): Promise<ImageBuffer> {
  if (!dataUrl.startsWith(ALLOWED_PREFIX)) {
    throw new MeasurementValidationError('IMAGE_FORMAT', 'imageData mora biti data:image/* URL.')
  }
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const buf = Buffer.from(base64, 'base64')
  const raw = await sharp(buf)
    .rotate() // EXIF orientacija (deterministično glede na metapodatke slike)
    .resize({
      width: 1280,
      height: 1280,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return {
    data: new Uint8ClampedArray(
      raw.data.buffer,
      raw.data.byteOffset,
      raw.data.byteLength,
    ),
    w: raw.info.width,
    h: raw.info.height,
  }
}

export async function POST(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()

  let body: { imageData?: unknown; frames?: unknown }
  try {
    const text = await request.text()
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: 'Slika je prevelika — pošljite ≤1280 px JPEG (klient pomanjša).' },
        { status: 413 },
      )
    }
    body = JSON.parse(text) as { imageData?: unknown; frames?: unknown }
  } catch {
    return NextResponse.json({ error: 'Neveljaven JSON.' }, { status: 400 })
  }

  // 1..3 frame-i: imageData (posamezen) ali frames[] (temporalna stabilnost)
  const frameUrls: string[] = []
  if (typeof body.imageData === 'string') frameUrls.push(body.imageData)
  if (Array.isArray(body.frames)) {
    for (const f of body.frames.slice(0, MEASUREMENT_CONSTANTS.maxFrames)) {
      if (typeof f === 'string') frameUrls.push(f)
    }
  }
  if (frameUrls.length === 0) {
    return NextResponse.json(
      { error: 'Obvezen je imageData (data URL) ali frames[1..3].' },
      { status: 400 },
    )
  }

  try {
    const buffers = await Promise.all(frameUrls.map((u) => dataUrlToImageBuffer(u)))
    const { features, metrics } = detectFeatures({ frames: buffers })

    // Stanje: zaznava sama ne more določiti merila → SCALE_REQUIRED
    // ((dimenzije NIKOLI iz same slike — issue #2 ključno pravilo).
    const state = features ? 'DETECTED' : 'INSUFFICIENT_DATA'
    const guidance =
      state === 'DETECTED' && features
        ? {
            seen: `Ograja zaznana (${features.runs.length} odsek${features.runs.length > 1 ? 'i' : ''}, ${features.posts.length} stebrov).`,
            missing: 'Absolutno merilo.',
            nextAction:
              'Označite znano dolžino (2 točki + mm) ali preklopite na ročno urejanje točk.',
          }
        : {
            seen: 'Ograje ni bilo mogoče zaznati (premalo robov/črt).',
            missing: 'Jasna silhueta ograje.',
            nextAction:
              'Fotografirajte frontalno pri dobri svetlobi ali uporabite ročno meritev.',
          }

    return NextResponse.json({
      features,
      metrics,
      state,
      guidance,
      // dimenzije SOBIH — dokler ni referenčne mere (SCALE_REQUIRED na confirm)
    })
  } catch (error) {
    if (error instanceof MeasurementValidationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    console.error('[measurement/detect]', error)
    return NextResponse.json({ error: 'Napaka pri detekciji.' }, { status: 500 })
  }
}
