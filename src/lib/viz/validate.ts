/**
 * VIZ — validacija in normalizacija slik (runda S+2). Spec: docs/VIZ_CONTRACTS.md
 *
 * Pravila stage-a:
 *  - MIME po magic bytes: JPEG | PNG | WebP (zaupanja vrednejše od Content-Type)
 *  - velikost ≤ 12 MB, vhodne dimenzije ≤ 6000 px, pokvarjene slike zavrnjene
 *  - sharp .rotate() = EXIF auto-orient
 *  - slike (balcony/product): resize dolga stran ≤ 1600 px, JPEG q90
 *  - maske (productMask/mask): resize ≤ 1600 px, grayscale PNG (belo = območje)
 *
 * Poleg tega: pretvorba staged datoteke v surov RGBA ImageBuffer za pipeline
 * in zod shema za placement.json.
 */
import sharp from 'sharp'
import { z } from 'zod'
import type { ImageBuffer, VizStageKind } from '@/lib/viz/types'
import { isValidCorners } from '@/lib/viz/types'

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024 // 12 MB
export const MAX_INPUT_DIM = 6000 // px
export const MAX_SIDE = 1600 // px — dolga stran po normalizaciji

export class VizValidationError extends Error {}

/** Vrsta staged vsebine po magic bytes. */
export type DetectedMime = 'image/jpeg' | 'image/png' | 'image/webp'

/** Prepoznav MIME iz magic bytes (ne zaupamo Content-Type od brskalnika). */
export function detectImageMime(buf: Buffer): DetectedMime | null {
  if (!buf || buf.length < 12) return null
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png'
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

/** Kanonično ime datoteke za vrsto stage-a (MVP spec map projekta). */
export function kindToFileName(kind: VizStageKind): string {
  switch (kind) {
    case 'balcony':
      return 'original.jpg'
    case 'product':
      return 'product.jpg'
    case 'productMask':
      return 'product-mask.png'
    case 'mask':
      return 'mask.png'
  }
}

/** Ali je vrsta stage-a maska (grayscale PNG). */
export function kindIsMask(kind: VizStageKind): boolean {
  return kind === 'productMask' || kind === 'mask'
}

export interface NormalizedImage {
  /** Normalizirana (encodana) datoteka za zapis na disk. */
  data: Buffer
  w: number
  h: number
  bytes: number
}

/**
 * Validiraj in normaliziraj naloženo sliko.
 * Vrže VizValidationError z slovenskim sporočilom ob vsaki kršitvi pravil.
 */
export async function normalizeUpload(buf: Buffer, kind: VizStageKind): Promise<NormalizedImage> {
  if (!buf || buf.length === 0) {
    throw new VizValidationError('Datoteka je prazna')
  }
  if (buf.length > MAX_UPLOAD_BYTES) {
    throw new VizValidationError('Slika je prevelika — omejitev je 12 MB')
  }
  const mime = detectImageMime(buf)
  if (!mime) {
    throw new VizValidationError('Nepodprta vrsta datoteke — dovoljene so slike JPEG, PNG in WebP')
  }

  let width = 0
  let height = 0
  try {
    const meta = await sharp(buf).metadata()
    width = meta.width ?? 0
    height = meta.height ?? 0
  } catch {
    throw new VizValidationError('Slika je pokvarjena ali ni podprta')
  }
  if (width <= 0 || height <= 0) {
    throw new VizValidationError('Slika je pokvarjena ali ni podprta')
  }
  if (width > MAX_INPUT_DIM || height > MAX_INPUT_DIM) {
    throw new VizValidationError(`Slika je prevelika — največ ${MAX_INPUT_DIM} px na stran`)
  }

  try {
    // .rotate() brez argumentov = EXIF auto-orient; nato resize na dolgo stran ≤ 1600.
    let pipeline = sharp(buf).rotate()
    if (kindIsMask(kind)) {
      // Maska: odstrani alfa (prosojno = nič = črno), pravi grayscale PNG
      // (1 kanal; 'b-w' mora iti ZADNJE — sharp ima fiksni vrstni red operacij,
      // .grayscale() po flatten namreč ne obstane in PNG ostane RGB).
      pipeline = pipeline.flatten({ background: '#000000' }).toColourspace('b-w')
    } else {
      // Fotografija: alfa nariši na belo, izhod JPEG.
      pipeline = pipeline.flatten({ background: '#ffffff' })
    }
    const resized = pipeline.resize({
      width: MAX_SIDE,
      height: MAX_SIDE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    const out = kindIsMask(kind)
      ? await resized.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
      : await resized.jpeg({ quality: 90 }).toBuffer({ resolveWithObject: true })
    return {
      data: out.data,
      w: out.info.width,
      h: out.info.height,
      bytes: out.data.length,
    }
  } catch {
    throw new VizValidationError('Slike ni mogoče obdelati — pokvarjena ali nepodprta vsebina')
  }
}

/**
 * staged (encodana) datoteka → surov RGBA ImageBuffer (oblika iz '@/lib/viz/types').
 * Podpira 1/2/3/4-kanalne vhode (grayscale PNG maske, JPEG, PNG z alfo, WebP).
 */
export async function toRawImageBuffer(buf: Buffer): Promise<ImageBuffer> {
  const { data, info } = await sharp(buf)
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width: w, height: h, channels } = info
  const out = new Uint8ClampedArray(w * h * 4)
  if (channels === 4) {
    out.set(data)
  } else if (channels === 3) {
    for (let i = 0, j = 0; i < w * h; i++, j += 3) {
      out[i * 4] = data[j]
      out[i * 4 + 1] = data[j + 1]
      out[i * 4 + 2] = data[j + 2]
      out[i * 4 + 3] = 255
    }
  } else if (channels === 2) {
    // Gray + alpha
    for (let i = 0, j = 0; i < w * h; i++, j += 2) {
      out[i * 4] = data[j]
      out[i * 4 + 1] = data[j]
      out[i * 4 + 2] = data[j]
      out[i * 4 + 3] = data[j + 1]
    }
  } else {
    // Gray (1 kanal)
    for (let i = 0; i < w * h; i++) {
      out[i * 4] = data[i]
      out[i * 4 + 1] = data[i]
      out[i * 4 + 2] = data[i]
      out[i * 4 + 3] = 255
    }
  }
  return { data: out, w, h }
}

// ── zod sheme (deljene med routes) ──────────────────────────────────────────

/** Token staging mape: crypto.randomUUID() oz. varčen segment brez poti. */
export const stagedTokenSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{8,100}$/, 'Neveljaven staging token')

const cornerTuple = z.tuple([z.number().finite(), z.number().finite()])
const cornersSchema = z.tuple([cornerTuple, cornerTuple, cornerTuple, cornerTuple])

/** placement.json — normalizirane koordinate 0..1 (docs/VIZ_CONTRACTS.md). */
export const placementSchema = z
  .object({
    version: z.literal(2),
    corners: cornersSchema,
    rotation: z.number().finite().min(-360).max(360),
    scale: z.number().finite().positive().max(10),
    productQuad: z.union([cornersSchema, z.null()]),
  })
  .refine((p) => isValidCorners(p.corners), {
    message: 'Vogali balkona so izven dovoljenega obsega (0..1)',
  })
  .refine((p) => p.productQuad === null || isValidCorners(p.productQuad), {
    message: 'ProduktQuad je izven dovoljenega obsega (0..1)',
  })

export type PlacementInput = z.infer<typeof placementSchema>
