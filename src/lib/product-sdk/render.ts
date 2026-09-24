/**
 * PRODUCT SDK — RENDERER (runda S+8 §9/§10; S+8.1 §9/§10 hardening).
 *
 * PRAVILA:
 *  - render je DETERMINISTIČEN: brez random seed-a, brez generativnega
 *    AI, brez zunanjih API klicev. Isti (ProductDefinition + Configuration +
 *    Material) → BAJTNO identičen rezultat (test dokazuje, ≥100 ponovitev).
 *  - S+8.1 §10: LAYOUT JE KANONIČEN — render gradi engine request IZ LAYOUT-a
 *    (ne iz config). Config↔layout konflikt = HARD FAILURE (SdkValidationError),
 *    nikoli tiha korekcija.
 *  - S+8.1 §9: render in maska izhajata iz ISTE FenceLayout strukture —
 *    en rasterizacijski vir, ni podvojenega geometrijskega izračuna.
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
import { engineLayoutOf } from './engine'
import { assertLayoutConsistentWithConfig } from './rules'
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
 * Deterministični produktni render (ortogonalno čelno polje).
 * Vrne sliko + layout + invarianta poročilo + renderValid.
 *
 * S+8.1 §10: ko je layout podan, MORA biti skladen s configom — konflikt
 * (npr. config.spanMm=3000, layout.bounds.widthMm=2800) = hard failure.
 */
export function renderProductFence(options: RenderOptions): RenderResult {
  const { definition, config, material, outWidthPx, outHeightPx } = options
  const layout = options.layout ?? buildFenceLayout(config, { definition })
  // S+8.1 §10: konflikt config↔layout = hard failure (NI tihe izbire ene vrednosti).
  assertLayoutConsistentWithConfig(layout, config)
  const resolved = resolveMaterial(definition, material)
  const profile = getProduct(definition.catalogProductId)
  if (!profile) throw new Error(`product-sdk: katalog profil "${definition.catalogProductId}" ne obstaja`)

  // Engine request se gradi IZ LAYOUT-a (kanoničen vir) — config je le material+izhod.
  const req: FenceRequest = {
    productId: layout.catalogProductId,
    orientation: layout.orientation,
    fenceWidthMm: layout.fenceWidthMm,
    fenceHeightMm: layout.fenceHeightMm,
    gapMm: layout.gapMm,
    material:
      resolved.kind === 'texture' && resolved.texture
        ? { kind: 'texture', texture: resolved.texture, mode: resolved.mode }
        : { kind: 'color', rgb: resolved.rgb ?? [128, 128, 128] },
    outWidthPx,
    outHeightPx,
    posts: postsOf(layout),
    handle: layout.handlePresent,
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
 * Maska je NEODVISNA od barve (spec §12) — iz ISTE geometrije kot render.
 */
export function renderWithMask(options: RenderOptions): {
  render: RenderResult
  mask: { data: Uint8ClampedArray; w: number; h: number }
} {
  const render = renderProductFence(options)
  const mask = layoutMask(render.layout, { outWidthPx: options.outWidthPx, outHeightPx: options.outHeightPx })
  return { render, mask }
}

export { engineLayoutOf } from './engine'
