// VIZ — POST /api/viz/preview (application/json)
// Telo: { originalToken, productToken, productMaskToken|null, maskToken, placement }
// Naloži staged datoteke, požene A-pipeline (runPipeline iz '@/lib/viz/pipeline',
// port 1:1 iz baseline/variant_a.py — piše paralelni agent S2-a; če modul še ne
// obstaja, vrne 503 'pipeline se nalaga'), normalizirane vogale denormalizira v
// px in zapiše preview.jpg (q92) + result.json v staging mapo.
// Odgovor: { previewUrl, metrics } — spec: docs/VIZ_CONTRACTS.md
import { NextResponse } from 'next/server'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import type { Corners, ImageBuffer, PipelineMetrics, PipelineOptions } from '@/lib/viz/types'
import { cornerToPx } from '@/lib/viz/types'
import { toRawImageBuffer, placementSchema, stagedTokenSchema } from '@/lib/viz/validate'
import {
  VIZ_FILE_NAMES,
  pathExists,
  publicStagingUrl,
  stagingDir,
  writeJsonFile,
} from '@/lib/viz/storage'
import { z } from 'zod'
import { authenticate, unauthorized } from '@/lib/auth'

export const runtime = 'nodejs'

// Strukturni tip po dokumentirani pipeline signature (contracts) — ne vezan na
// modul, da route deluje tudi, ko pipeline.ts (S2-a) še ni na repozitoriju.
type RunPipelineFn = (input: {
  original: ImageBuffer
  mask: ImageBuffer
  product: ImageBuffer
  productMask: ImageBuffer | null
  cornersPx: Corners
  productQuadPx: Corners | null
  options?: PipelineOptions
}) => { preview: ImageBuffer; metrics: PipelineMetrics }

const previewSchema = z.object({
  originalToken: stagedTokenSchema,
  productToken: stagedTokenSchema,
  productMaskToken: stagedTokenSchema.nullable().optional(),
  maskToken: stagedTokenSchema,
  placement: placementSchema,
})

/** Preberi staged datoteko; vrne null, če ne obstaja. */
async function readStagedFile(token: string, name: string): Promise<Buffer | null> {
  const p = path.join(stagingDir(token), name)
  if (!(await pathExists(p))) return null
  try {
    return await readFile(p)
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  // Aplikacijska konvencija: proxy je prva plast, ruta preveri sama (glej src/lib/auth.ts).
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const body = await request.json().catch(() => null)
    const parsed = previewSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Neveljavni podatki za predogled', details: parsed.error.issues },
        { status: 400 }
      )
    }
    const { originalToken, productToken, productMaskToken, maskToken, placement } = parsed.data

    // ── Naloži staged datoteke ──────────────────────────────────────────────
    const originalFile = await readStagedFile(originalToken, VIZ_FILE_NAMES.original)
    const productFile = await readStagedFile(productToken, VIZ_FILE_NAMES.product)
    const maskFile = await readStagedFile(maskToken, VIZ_FILE_NAMES.mask)
    if (!originalFile) {
      return NextResponse.json(
        { error: 'Staged fotografija balkona ne obstaja — naloži sliko znova' },
        { status: 400 }
      )
    }
    if (!productFile) {
      return NextResponse.json(
        { error: 'Staged fotografija izdelka ne obstaja — naloži sliko znova' },
        { status: 400 }
      )
    }
    if (!maskFile) {
      return NextResponse.json(
        { error: 'Staged maska stare ograje ne obstaja — nariši masko znova' },
        { status: 400 }
      )
    }
    const productMaskFile = productMaskToken
      ? await readStagedFile(productMaskToken, VIZ_FILE_NAMES.productMask)
      : null
    if (productMaskToken && !productMaskFile) {
      return NextResponse.json(
        { error: 'Staged maska izdelka ne obstaja — uredi masko znova' },
        { status: 400 }
      )
    }

    // ── Decode → surovi RGBA ImageBuffer ────────────────────────────────────
    const original = await toRawImageBuffer(originalFile)
    const product = await toRawImageBuffer(productFile)
    const mask = await toRawImageBuffer(maskFile)
    const productMask = productMaskFile ? await toRawImageBuffer(productMaskFile) : null

    // ── Normalizirane koordinate → px ───────────────────────────────────────
    const cornersPx = cornerToPx(placement.corners, original.w, original.h)
    const productQuadPx = placement.productQuad
      ? cornerToPx(placement.productQuad, product.w, product.h)
      : null

    // ── A-pipeline (dinamični import — S2-a lahko še piše) ──────────────────
    let runPipeline: RunPipelineFn
    try {
      const mod = (await import('@/lib/viz/pipeline')) as { runPipeline: RunPipelineFn }
      runPipeline = mod.runPipeline
    } catch {
      console.error('Viz preview: @/lib/viz/pipeline še ni na voljo (S2-a v teku)')
      return NextResponse.json({ error: 'pipeline se nalaga' }, { status: 503 })
    }

    let result: { preview: ImageBuffer; metrics: PipelineMetrics }
    try {
      result = runPipeline({
        original,
        mask,
        product,
        productMask,
        cornersPx,
        productQuadPx,
        // privzete opcije po contracts: harmonize=true, shadow=true, feather=3
      })
    } catch (error) {
      console.error('Viz preview pipeline error:', error)
      return NextResponse.json({ error: 'Napaka v cevovodu predogleda' }, { status: 500 })
    }

    // ── Zapiši preview.jpg + result.json v staging mapo ─────────────────────
    const dir = stagingDir(originalToken)
    const previewJpg = await sharp(
      Buffer.from(result.preview.data.buffer, result.preview.data.byteOffset, result.preview.data.byteLength),
      { raw: { width: result.preview.w, height: result.preview.h, channels: 4 } }
    )
      .jpeg({ quality: 92 })
      .toBuffer()
    await writeFile(path.join(dir, VIZ_FILE_NAMES.preview), previewJpg)

    // result.json = metrike (dokazila) + provenance (placement + tokeni),
    // ki jih POST /api/viz/projects uporabi za sestavo projektne mape.
    const resultJson = {
      metrics: result.metrics,
      placement,
      tokens: {
        original: originalToken,
        product: productToken,
        productMask: productMaskToken ?? null,
        mask: maskToken,
      },
      createdAt: new Date().toISOString(),
    }
    await writeJsonFile(path.join(dir, VIZ_FILE_NAMES.result), resultJson)

    const responseBody = {
      previewUrl: publicStagingUrl(originalToken, VIZ_FILE_NAMES.preview),
      metrics: result.metrics,
    }
    return NextResponse.json(responseBody)
  } catch (error) {
    console.error('Viz preview POST error:', error)
    return NextResponse.json({ error: 'Napaka pri pripravi predogleda' }, { status: 500 })
  }
}
