// VIZ — POST /api/viz/product-preview — SERVER-AUTHORITATIVE PRODUCT SDK ENDPOINT
// (runda S+8 §21).
//
// KLJUČNO PRAVILO (spec §21): klient pošlje SAMO productId + konfiguracijo +
// placement. ProductDefinition naloži STREŽNIK iz data/roksal-catalog.json —
// klient NE sme poslati definition JSON-a in s tem obiti kataloga
// (pravice, mere, barve, montažna pravila so strežniška resnica).
//
// Tok (spec §10 — vrstni red NE SME biti obrnjen):
//   productId → katalog → FenceLayout (produktni mm, deterministično)
//   → render v produktnih koordinatah + exact maska iz layout-a
//   → A-pipeline homografija (4-točkovni placement) → balkonska slika.
//
// Pravice (S+8.1 §11): EKSPPLICITEN gate — rights=rejected → 403 VEDNO;
// rights=pending → blokiran v production načinu (ROKSAL_RIGHTS_MODE=production),
// dovoljen IZKLJUČNO v evaluation načinu za interno development/evalvacijo
// (odgovor to odkrito označi). Privzeti način = evaluation (trenutni deployment
// je razvojni — dokumentirano v evaluation/S81-AUDIT.md §F9). NI NODE_ENV kot
// poslovno pravilo.
import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { z } from 'zod'
import type { Corners, ImageBuffer, PipelineMetrics } from '@/lib/viz/types'
import { cornerToPx } from '@/lib/viz/types'
import { toRawImageBuffer, placementSchema, stagedTokenSchema } from '@/lib/viz/validate'
import { VIZ_FILE_NAMES, stagingKey, vizGet, vizPut } from '@/lib/viz/storage'
import { vizOwner } from '@/lib/viz/ownership'
import { productSdk } from '@/lib/product-sdk'

export const runtime = 'nodejs'

/** S+8.1: lokalni validation error — loči 400 (vhod) od 500 (strežniška napaka). */
class ProductPreviewValidationError extends Error {}

const rgbSchema = z.tuple([
  z.number().finite().min(0).max(255),
  z.number().finite().min(0).max(255),
  z.number().finite().min(0).max(255),
])

// .strict() → vsak poskus ponarejanja definition/pravic/asset poti = 400.
const productPreviewSchema = z
  .object({
    originalToken: stagedTokenSchema,
    maskToken: stagedTokenSchema,
    placement: placementSchema,
    productId: z.string().trim().min(3).max(80),
    orientation: z.enum(['horizontal', 'vertical']),
    spanMm: z.number().finite().min(100).max(20000),
    heightMm: z.number().finite().min(100).max(5000),
    gapMm: z.number().finite().min(0).max(200),
    colorId: z.string().trim().min(1).max(60).optional(),
    // Izmerjen RGB (neuradno) — dovoljeno, ker katalog NIMA uradnega hexa;
    // odgovor to odkrito označi (provenance), NI trditev o uradni barvi.
    measuredRgb: rgbSchema.optional(),
    posts: z
      .object({
        widthMm: z.number().finite().min(10).max(400),
        positionsMm: z.array(z.number().finite().min(0).max(20000)).max(50).optional(),
      })
      .optional()
      .nullable(),
    handle: z.boolean().optional(),
  })
  .strict()

type RunPipelineFn = (input: {
  original: ImageBuffer
  mask: ImageBuffer
  product: ImageBuffer
  productMask: ImageBuffer | null
  cornersPx: Corners
  productQuadPx: Corners | null
}) => { preview: ImageBuffer; metrics: PipelineMetrics }

export async function POST(request: Request) {
  // S+4: viz rute so vezane na prijavljenega uporabnika (API ključ = 403).
  const ctx = await vizOwner(request)
  if (ctx instanceof Response) return ctx
  try {
    const body = await request.json().catch(() => null)
    const parsed = productPreviewSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Neveljavna zahteva — klient pošlje SAMO productId + konfiguracijo (definition je server-authoritative)', details: parsed.error.issues },
        { status: 400 }
      )
    }
    const { originalToken, maskToken, placement, productId, orientation, spanMm, heightMm, gapMm, colorId, measuredRgb, posts, handle } = parsed.data

    // ── 1. SERVER-AUTHORITATIVE definicija (spec §21) ──────────────────────
    const definition = productSdk.catalog.get(productId)
    if (!definition) {
      return NextResponse.json({ error: `Neznan productId "${productId}" — produkt ni v katalogu` }, { status: 400 })
    }
    if (definition.rights === 'rejected') {
      return NextResponse.json({ error: `Produkt "${definition.id}" ima pravice zavrnjene — render NI dovoljen` }, { status: 403 })
    }
    // S+8.1 §11: pending je dovoljen IZKLJUČNO v evaluation načinu (privzeti,
    // razvojni deployment); production način ga blokira — ekspliciten gate.
    const rightsMode = productSdk.rights.mode()
    const gate = productSdk.rights.gate(definition, rightsMode)
    if (!gate.allowed) {
      return NextResponse.json(
        { error: gate.reason, rights: { status: gate.rights, mode: gate.mode } },
        { status: gate.httpStatus }
      )
    }

    // ── 2. Naloži staged vhode (balkon + maska stare ograje) ────────────────
    const originalFile = await vizGet(stagingKey(originalToken, VIZ_FILE_NAMES.original))
    const maskFile = await vizGet(stagingKey(maskToken, VIZ_FILE_NAMES.mask))
    if (!originalFile) {
      return NextResponse.json({ error: 'Staged fotografija balkona ne obstaja — naloži sliko znova' }, { status: 400 })
    }
    if (!maskFile) {
      return NextResponse.json({ error: 'Staged maska stare ograje ne obstaja — nariši masko znova' }, { status: 400 })
    }
    const original = await toRawImageBuffer(originalFile)
    const mask = await toRawImageBuffer(maskFile)

    // ── 3. Geometrija: katalog → FenceLayout (deterministično, spec §9) ─────
    const config = {
      productId: definition.id,
      orientation,
      spanMm,
      heightMm,
      gapMm,
      colorId,
      handle,
      posts: posts ?? null,
    }
    let layout
    try {
      layout = productSdk.layout(config, { definition })
    } catch (error) {
      return NextResponse.json(
        { error: 'Neveljavna konfiguracija ograje', details: error instanceof Error ? error.message : String(error) },
        { status: 400 }
      )
    }

    // ── 4. Render v PRODUKTNIH koordinatah + exact maska iz layout-a ────────
    const cornersPx = cornerToPx(placement.corners, original.w, original.h)
    const quadW =
      Math.abs(cornersPx[1][0] - cornersPx[0][0]) + Math.abs(cornersPx[2][0] - cornersPx[3][0])
    const quadH =
      Math.abs(cornersPx[3][1] - cornersPx[0][1]) + Math.abs(cornersPx[2][1] - cornersPx[1][1])
    const outW = Math.max(4, Math.min(1600, Math.round(quadW)))
    const outH = Math.max(4, Math.min(1600, Math.round(quadH)))

    const { render, mask: productMask } = (() => {
      try {
        return productSdk.renderWithMask({
          definition,
          config,
          layout,
          material: { colorId, measuredRgb },
          outWidthPx: outW,
          outHeightPx: outH,
        })
      } catch (error) {
        // S+8.1 §12: neznana/nezrešljiva barva = neveljavna zahteva (400, ne 500).
        throw new ProductPreviewValidationError(error instanceof Error ? error.message : 'Material ni razrešen')
      }
    })()
    if (!render.renderValid) {
      // spec §8: padla invarianta → rezultat NI validen produkt (odkrito).
      return NextResponse.json(
        { error: 'Padla produktna identiteta — render ni validen', failures: render.invariants.failures },
        { status: 422 }
      )
    }

    // ── 5. A-pipeline: perspektiva (homografija) + kompozit na balkon ───────
    let runPipeline: RunPipelineFn
    try {
      const mod = (await import('@/lib/viz/pipeline')) as { runPipeline: RunPipelineFn }
      runPipeline = mod.runPipeline
    } catch {
      return NextResponse.json({ error: 'pipeline se nalaga' }, { status: 503 })
    }
    let result: { preview: ImageBuffer; metrics: PipelineMetrics }
    try {
      result = runPipeline({
        original,
        mask,
        product: render.image,
        productMask, // S+8 §11: exact alpha iz geometrije (svetli izdelki P0)
        cornersPx,
        productQuadPx: null,
      })
    } catch (error) {
      console.error('Viz product-preview pipeline error:', error)
      return NextResponse.json({ error: 'Napaka v cevovodu predogleda' }, { status: 500 })
    }

    // ── 6. preview.jpg + result.json (isti staging vzorec kot /preview) ─────
    const previewJpg = await sharp(
      Buffer.from(result.preview.data.buffer, result.preview.data.byteOffset, result.preview.data.byteLength),
      { raw: { width: result.preview.w, height: result.preview.h, channels: 4 } }
    )
      .jpeg({ quality: 92 })
      .toBuffer()
    const previewPut = await vizPut(stagingKey(originalToken, VIZ_FILE_NAMES.preview), previewJpg)

    const resultJson = {
      metrics: result.metrics,
      placement,
      product: {
        productId: definition.id,
        catalogProductId: definition.catalogProductId,
        profile: definition.profile.name,
        rights: definition.rights,
        rightsMode,
        rightsReason: gate.reason,
        layout: {
          boardCount: layout.boardCount,
          gapMm: layout.gapMm,
          pitchMm: layout.pitchMm,
          orientation: layout.orientation,
          posts: layout.posts.length,
          rails: layout.rails.length,
          caps: layout.caps.length,
          fasteners: layout.fasteners.length,
          warnings: layout.warnings,
        },
        renderValid: render.renderValid,
        materialProvenance: render.materialProvenance,
      },
      tokens: { original: originalToken, mask: maskToken },
      createdAt: new Date().toISOString(),
    }
    await vizPut(
      stagingKey(originalToken, VIZ_FILE_NAMES.result),
      Buffer.from(JSON.stringify(resultJson, null, 2), 'utf8'),
      'application/json'
    )

    return NextResponse.json({
      previewUrl: previewPut.url,
      metrics: result.metrics,
      product: resultJson.product,
    })
  } catch (error) {
    if (error instanceof ProductPreviewValidationError) {
      return NextResponse.json({ error: 'Neveljavna konfiguracija produkta', details: error.message }, { status: 400 })
    }
    if (error instanceof Error && error.name === 'SdkValidationError') {
      // S+8.1: SDK validation napake (layout konflikti, neveljavna geometrija) = 400.
      return NextResponse.json({ error: 'Neveljavna konfiguracija ograje', details: error.message }, { status: 400 })
    }
    console.error('Viz product-preview POST error:', error)
    return NextResponse.json({ error: 'Napaka pri pripravi predogleda produkta' }, { status: 500 })
  }
}
