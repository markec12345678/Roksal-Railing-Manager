// VIZ — POST /api/viz/stage (multipart/form-data)
// Polji: `file` (Blob) + `kind` ∈ balcony | product | productMask | mask
// Validira (magic bytes, ≤12 MB, ≤6000 px, sharp decode), normalizira
// (EXIF rotate, dolga stran ≤1600 px; slike → JPEG q90, maske → grayscale PNG),
// zapiše v staging shrambo pod kanoničnim imenom in vrne
// { token, url, w, h, bytes } — spec: docs/VIZ_CONTRACTS.md
// Runda S+3: zapis gre prek storage driverja (local FS ali Vercel Blob) —
// na Vercelu je public/ bralen, zato produkcijski driver = Vercel Blob.
import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { vizOwner } from '@/lib/viz/ownership'
import {
  VizValidationError,
  kindToFileName,
  normalizeUpload,
} from '@/lib/viz/validate'
import { stagingKey, vizPut } from '@/lib/viz/storage'
import type { StageResult } from '@/lib/viz/types'

export const runtime = 'nodejs'

const kindSchema = z.enum(['balcony', 'product', 'productMask', 'mask'])

export async function POST(request: Request) {
  // S+4: viz rute so vezane na prijavljenega uporabnika (API ključ = 403).
  const ctx = await vizOwner(request)
  if (ctx instanceof Response) return ctx
  try {
    const form = await request.formData()
    const file = form.get('file')
    const kindRaw = form.get('kind')

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Datoteka manjka (polje "file")' }, { status: 400 })
    }
    const parsedKind = kindSchema.safeParse(kindRaw)
    if (!parsedKind.success) {
      return NextResponse.json(
        { error: 'Neveljavna vrsta ("kind") — dovoljene so: balcony, product, productMask, mask' },
        { status: 400 }
      )
    }
    const kind = parsedKind.data

    const inputBuf = Buffer.from(await file.arrayBuffer())
    const normalized = await normalizeUpload(inputBuf, kind)
    // `inputBuf` pade iz dosega ob koncu zahtevka — GC ga sprosti (Buffer.length
    // je getter-only, ročnega "skrajšanja" ni).

    const token = randomUUID()
    const name = kindToFileName(kind)
    const { url } = await vizPut(stagingKey(token, name), normalized.data)

    const body: StageResult = {
      token,
      url,
      w: normalized.w,
      h: normalized.h,
      bytes: normalized.bytes,
    }
    return NextResponse.json(body)
  } catch (error) {
    if (error instanceof VizValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Viz stage POST error:', error)
    return NextResponse.json({ error: 'Napaka pri nalaganju slike' }, { status: 500 })
  }
}
