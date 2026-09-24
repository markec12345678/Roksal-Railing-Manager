/**
 * VISION API (issue #10 + #11) — POST /api/vision/scene
 *
 * Deterministična analiza prizora (brez AI modelov):
 *   imageData (data URL, ≤8 MB, ≤1280 px decode)
 *   → decodeImageToImageBuffer (sharp, ENAK vzorec kot measurement/detect)
 *   → analyzeScene (reuse: measurement/cv + detectFeatures + viz/imageops)
 *   → SceneAnalysis { sessionId, elements, features, quality, warnings,
 *     guidance, algorithmVersion } — BREZ dimenzij (merilo NI del scene).
 *
 * PRAVILA:
 *  - CV = predlog. Ta endpoint NE piše v bazo, NE spreminja meritev,
 *    NE vrača mm (absolutne mere gredo IZKLJUČNO prek /api/measurement/confirm
 *    z referenčno mero).
 *  - Enaka slika → bajtno enak odgovor (sessionId = sha256 pikslov).
 *  - Neuspeh CV = 200 z iskrenim analiznim stanjem (prazna slika NI napaka);
 *    pokvarjen vhod = 400.
 */
import { NextResponse } from 'next/server'
import { authenticate, unauthorized } from '@/lib/auth'
import { analyzeScene, SceneValidationError } from '@/lib/cv-studio/scene'
import { decodeImageToImageBuffer, VisionDecodeError } from '@/lib/cv-studio/decode'

export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_BODY_BYTES = 8 * 1024 * 1024 // 8 MB (data URL)

export async function POST(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()

  let body: unknown
  try {
    const text = await request.text()
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: 'Telo zahteve presega 8 MB (imageData ≤1280 px JPEG je priporočeno).', code: 'BODY_TOO_LARGE' },
        { status: 413 },
      )
    }
    body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Neveljaven JSON.', code: 'INVALID_JSON' }, { status: 400 })
  }

  const imageData = (body as { imageData?: unknown } | null)?.imageData
  if (typeof imageData !== 'string' || imageData.length === 0) {
    return NextResponse.json(
      { error: 'imageData (data:image/* URL) je obvezen.', code: 'MISSING_IMAGE' },
      { status: 400 },
    )
  }

  try {
    const img = await decodeImageToImageBuffer(imageData)
    const analysis = analyzeScene(img)
    return NextResponse.json(analysis)
  } catch (error) {
    if (error instanceof VisionDecodeError || error instanceof SceneValidationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    return NextResponse.json(
      { error: 'Analiza prizora ni uspela.', code: 'SCENE_ERROR' },
      { status: 500 },
    )
  }
}
