/**
 * CV STUDIO SDK — strežniški decode (issue #10/#11 API).
 *
 * ENAK determinističen decode kot /api/measurement/detect (sharp: EXIF
 * rotate → resize ≤1280 inside → ensureAlpha → raw RGBA) — posamezna
 * kopija, DA obstoječa merilna ruta OSTANE NEDOTAKNJENA (issue #10:
 * "obstoječega sistema ne spreminjaj"). Ista pravila: data:image/* prefix,
 * max 8 MB.
 */
import sharp from 'sharp'
import type { ImageBuffer } from '@/lib/viz/types'

export const ALLOWED_PREFIX = 'data:image/'
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // 8 MB

export class VisionDecodeError extends Error {
  readonly code: string
  constructor(message: string, code = 'IMAGE_FORMAT') {
    super(message)
    this.name = 'VisionDecodeError'
    this.code = code
  }
}

/** Data URL → RGBA ImageBuffer (determinističen decode, srednja ločljivost). */
export async function decodeImageToImageBuffer(dataUrl: string): Promise<ImageBuffer> {
  if (!dataUrl.startsWith(ALLOWED_PREFIX)) {
    throw new VisionDecodeError('imageData mora biti data:image/* URL.')
  }
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const buf = Buffer.from(base64, 'base64')
  if (buf.length === 0) {
    throw new VisionDecodeError('Prazna ali pokvarjena slikovna podatka.')
  }
  try {
    const raw = await sharp(buf)
      .rotate() // EXIF orientacija (deterministično glede na metapodatke)
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
      data: new Uint8ClampedArray(raw.data.buffer, raw.data.byteOffset, raw.data.byteLength),
      w: raw.info.width,
      h: raw.info.height,
    }
  } catch {
    throw new VisionDecodeError('Slike ni bilo mogoče dekodirati (pokvarjen/nepodprten format).', 'IMAGE_DECODE')
  }
}
