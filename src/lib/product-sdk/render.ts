/**
 * PRODUCT SDK — RENDERER (runda S+8 §9, §10).
 *
 * PRAVILA:
 *  - render je DETERMINISTIČEN: brez random seed-a, brez generativnega
 *    AI, brez zunanjih API klicev. Isti (ProductDefinition + Configuration +
 *    Material) → BAJTNO identičen rezultat (test dokazuje).
 *  - PERSPEKTIVA (spec §10): geometrija se najprej izdela v PRODUKTNIH
 *    koordinatah (FenceLayout → render), ŠELE NATO sledi perspektivna
 *    transformacija v balkonsko sliko — izključno prek dokazane homografije
 *    A-pipeline (runPipeline, 4-točkovni placement). Ta modul NE ve NIČesar
 *    o sceni — order je: product coords → layout → perspective → image.
 *  - renderValid: če katera invarianta pade, rezultat NI validen produkt.
 */
import { renderFence, type FenceRequest } from '@/lib/procedural/fence-engine'
import { getProduct } from '@/lib/product-catalog'
import type { FenceConfiguration, FenceLayout, ProductDefinition, RenderResult } from './types'
import { verifyProductIdentity } from './invariants'
import { layoutMask, postsOf } from './mask'
import { resolveMaterial, type MaterialInput } from './material'
import { buildFenceLayout } from './geometry'

export interface RenderOptions {
  definition: ProductDefinition
  config: FenceConfiguration
  /** Layout (če že izračunan) — sicer se zgradi iz config (deterministično). */
  layout?: FenceLayout
  /** Material (barva/tekstura) — LOČENO od geometrije (spec §7). */
  material: MaterialInput
  outWidthPx: number
  outHeightPx: number
}

/**
 * Konverzija SDK FenceLayout → engine layout (podmnožina polj).
 * KRITIČNO: engine `productId` je KATALOG id (woodcore-*) — renderer po njem
 * prepozna profil (ROMB rebro). Podatki so identični (isti katalog).
 */
export function engineLayoutOf(layout: FenceLayout) {
  return {
    productId: layout.catalogProductId,
    profile: layout.profile,
    orientation: layout.orientation,
    faceWidthMm: layout.faceWidthMm,
    gapMm: layout.gapMm,
    pitchMm: layout.pitchMm,
    fenceWidthMm: layout.fenceWidthMm,
    fenceHeightMm: layout.fenceHeightMm,
    fieldHeightMm: layout.fieldHeightMm,
    fieldSpanMm: layout.fieldSpanMm,
    boardCount: layout.boardCount,
    boards: layout.boards,
    handleHeightMm: layout.handleHeightMm,
    handlePresent: layout.handlePresent,
    warnings: layout.warnings,
  }
}

/**
 * Deterministični produktni render (ortogonalno čelno polje).
 * Vrne sliko + layout + invarianta poročilo + renderValid.
 */
export function renderProductFence(options: RenderOptions): RenderResult {
  const { definition, config, material, outWidthPx, outHeightPx } = options
  const layout = options.layout ?? buildFenceLayout(config, { definition })
  const resolved = resolveMaterial(definition, material)
  const profile = getProduct(definition.catalogProductId)
  if (!profile) throw new Error(`product-sdk: katalog profil "${definition.catalogProductId}" ne obstaja`)

  const req: FenceRequest = {
    productId: definition.catalogProductId,
    orientation: config.orientation,
    fenceWidthMm: config.spanMm,
    fenceHeightMm: config.heightMm,
    gapMm: config.gapMm,
    material:
      resolved.kind === 'texture' && resolved.texture
        ? { kind: 'texture', texture: resolved.texture, mode: resolved.mode }
        : { kind: 'color', rgb: resolved.rgb ?? [128, 128, 128] },
    outWidthPx,
    outHeightPx,
    posts: postsOf(layout, config),
    handle: config.handle,
    profileOverride: profile,
  }
  const image = renderFence(req, engineLayoutOf(layout))
  const invariants = verifyProductIdentity(definition, config, layout)
  return {
    image,
    layout,
    invariants,
    renderValid: invariants.renderValid,
    materialProvenance: resolved.provenance,
  }
}

/**
 * Popoln produktni paket za kompozit: render + maska iz layout-a (exact alpha).
 * Maska je NEODVISNA od barve (spec §12) — iz iste geometrije.
 */
export function renderWithMask(options: RenderOptions): {
  render: RenderResult
  mask: { data: Uint8ClampedArray; w: number; h: number }
} {
  const render = renderProductFence(options)
  const mask = layoutMask(render.layout, { outWidthPx: options.outWidthPx, outHeightPx: options.outHeightPx })
  return { render, mask }
}
