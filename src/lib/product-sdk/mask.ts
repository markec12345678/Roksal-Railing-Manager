/**
 * PRODUCT SDK — MASKA IZ FENCELAYOUT (runda S+8 §11, §12 — kritično za SVETLE izdelke).
 *
 * PRAVILA:
 *  - maska je izdelana IZ FenceLayout (board geometry → exact alpha) — NE iz
 *    AI segmentacije in NE iz globalnega praga svetlosti (prag gray<115 iz
 *    zamrznjenega cutouta NE more ločiti svetlih produktov — S+7 dokazano);
 *  - maska opisuje KJE JE PRODUKT, ne KAKŠNE BARVE je — za isti layout je
 *    maska IDENTIČNA ne glede na material (WHITE/temna/tekstura);
 *  - deterministično: enak layout → bajtno identična maska.
 *
 * Implementacija ponovno uporablja DOKAZANO renderFenceMask (S+7) — maska
 * je preslikava konstrukcije (deske + stebri + ročaj) v alfo.
 */
import { renderFenceMask, type FenceRequest } from '@/lib/procedural/fence-engine'
import { getProduct } from '@/lib/product-catalog'
import type { FenceLayout, FenceConfiguration } from './types'

export interface LayoutMaskOptions {
  outWidthPx: number
  outHeightPx: number
}

/**
 * Exact alpha maska iz geometrije layout-a. Belo = produkt (neproduženo),
 * črno = vrzeli/ozadje. Neodvisna od barve produkta (testirano: WHITE).
 */
export function layoutMask(layout: FenceLayout, options: LayoutMaskOptions): { data: Uint8ClampedArray; w: number; h: number } {
  const profile = getProduct(layout.catalogProductId)
  if (!profile) throw new Error(`product-sdk: katalog profil "${layout.catalogProductId}" ne obstaja`)
  const req: FenceRequest = {
    productId: layout.catalogProductId,
    orientation: layout.orientation,
    fenceWidthMm: layout.fenceWidthMm,
    fenceHeightMm: layout.fenceHeightMm,
    gapMm: layout.gapMm,
    material: { kind: 'color', rgb: [128, 128, 128] }, // maska materiala NE uporablja
    outWidthPx: options.outWidthPx,
    outHeightPx: options.outHeightPx,
    posts:
      layout.posts.length > 0
        ? { widthMm: layout.posts[0].widthMm, positionsMm: layout.posts.map((p) => p.centerMm) }
        : null,
    handle: layout.handlePresent,
    profileOverride: profile,
  }
  return renderFenceMask(req)
}

/** Pogojni vhod za renderFence iz layout-a (isti stebri kot maska). */
export function postsOf(layout: FenceLayout, config: FenceConfiguration | null): FenceRequest['posts'] {
  if (layout.posts.length === 0) return null
  return {
    widthMm: layout.posts[0].widthMm,
    positionsMm: layout.posts.map((p) => p.centerMm),
  }
}

export { renderFenceMask }
