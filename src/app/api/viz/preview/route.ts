// VIZ — POST /api/viz/preview (application/json)
// Telo: { originalToken, productToken, productMaskToken|null, maskToken, placement }
// Naloži staged datoteke (prek storage driverja — local FS ali Vercel Blob),
// požene A-pipeline (runPipeline iz '@/lib/viz/pipeline', port 1:1 iz
// baseline/variant_a.py), normalizirane vogale denormalizira v px in zapiše
// preview.jpg (q92) + result.json v staging mapo originalnega tokena.
// Odgovor: { previewUrl, metrics } — spec: docs/VIZ_CONTRACTS.md
import { NextResponse } from 'next/server'
import sharp from 'sharp'
import type { Corners, ImageBuffer, PipelineMetrics, PipelineOptions } from '@/lib/viz/types'
import { cornerToPx } from '@/lib/viz/types'
import { toRawImageBuffer, placementSchema, stagedTokenSchema } from '@/lib/viz/validate'
import { VIZ_FILE_NAMES, stagingKey, vizGet, vizPut } from '@/lib/viz/storage'
import { z } from 'zod'
import { vizOwner } from '@/lib/viz/ownership'

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

export async function POST(request: Request) {
  // S+4: viz rute so vezane na prijavljenega uporabnika (API ključ = 403).
  const ctx = await vizOwner(request)
  if (ctx instanceof Response) return ctx
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

    // ── Naloži staged datoteke (driver-agnostično) ──────────────────────────
    const originalFile = await vizGet(stagingKey(originalToken, VIZ_FILE_NAMES.original))
    const productFile = await vizGet(stagingKey(productToken, VIZ_FILE_NAMES.product))
    const maskFile = await vizGet(stagingKey(maskToken, VIZ_FILE_NAMES.mask))
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
      ? await vizGet(stagingKey(productMaskToken, VIZ_FILE_NAMES.productMask))
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

    // ── Zapiši preview.jpg + result.json v staging mapo (driver-agnostično) ─
    const previewJpg = await sharp(
      Buffer.from(result.preview.data.buffer, result.preview.data.byteOffset, result.preview.data.byteLength),
      { raw: { width: result.preview.w, height: result.preview.h, channels: 4 } }
    )
      .jpeg({ quality: 92 })
      .toBuffer()
    const previewPut = await vizPut(stagingKey(originalToken, VIZ_FILE_NAMES.preview), previewJpg)

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
    await vizPut(stagingKey(originalToken, VIZ_FILE_NAMES.result), Buffer.from(JSON.stringify(resultJson, null, 2), 'utf8'), 'application/json')

    const responseBody = {
      previewUrl: previewPut.url,
      metrics: result.metrics,
    }
    return NextResponse.json(responseBody)
  } catch (error) {
    console.error('Viz preview POST error:', error)
    return NextResponse.json({ error: 'Napaka pri pripravi predogleda' }, { status: 500 })
  }
}
