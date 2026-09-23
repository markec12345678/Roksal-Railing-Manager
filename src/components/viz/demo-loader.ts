'use client'

/**
 * VIZ — nalagalnik preizkusnega primera (demo) iz /viz-demo/demo.json.
 *
 * Potek (po pogodbi): fetch demo.json → za vsako slika (balcony/product/mask)
 * fetch(url) → Blob → FormData → POST /api/viz/stage z ustreznim kind →
 * nastavi store (balcony, product, mask, corners = demo placement.corners,
 * productQuad = demo placement.productQuad) → skoči na korak 4 (4 VOGALI).
 * productMask ostane null (strežnik naredi samodejni izrez; productQuad je že izmerjen).
 */

import { toast } from '@/hooks/use-toast'
import type { Corners } from '@/lib/viz/types'
import { stageImage } from './api'
import { toVizImage, useVizStore } from './viz-store'

interface DemoAsset {
  url: string
  w: number
  h: number
}

export interface DemoJson {
  version: number
  balcony: DemoAsset
  product: DemoAsset
  mask: DemoAsset
  placement: {
    version: 2
    corners: Corners
    rotation: number
    scale: number
    productQuad: Corners | null
  }
  source?: string
}

async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Ni mogoče naložiti ${url} (${res.status})`)
  return res.blob()
}

/** Naloži preizkusni primer v store. Vrne true ob uspehu. Napake = toast. */
export async function loadDemoProject(): Promise<boolean> {
  const store = useVizStore.getState()
  if (store.loading.demo) return false
  store.setDemoLoading(true)
  store.setError(null)
  try {
    const res = await fetch('/viz-demo/demo.json')
    if (!res.ok) throw new Error(`demo.json ni na voljo (${res.status})`)
    const demo = (await res.json()) as DemoJson

    // Vzporedno prenesi vse tri datoteke, nato zaporedno stagiraj (majhen DB/disk).
    const [balconyBlob, productBlob, maskBlob] = await Promise.all([
      fetchBlob(demo.balcony.url),
      fetchBlob(demo.product.url),
      fetchBlob(demo.mask.url),
    ])

    const [balcony, product, mask] = await Promise.all([
      stageImage(balconyBlob, 'balcony', 'balcony.jpg'),
      stageImage(productBlob, 'product', 'product.jpg'),
      stageImage(maskBlob, 'mask', 'mask.png'),
    ])

    const s = useVizStore.getState()
    s.setBalcony(toVizImage(balcony))
    s.setProduct(toVizImage(product))
    s.setMask({ ...toVizImage(mask), edited: false })
    s.setProductMask(null)
    s.setCorners(demo.placement.corners)
    s.setProductQuad(demo.placement.productQuad)
    s.setPreview(null)
    s.setStep(4)
    toast({ title: 'Preizkusni primer naložen ✓', description: 'Nastavi 4 vogale in pripravi predogled.' })
    return true
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Nalaganje preizkusnega primera ni uspelo.'
    useVizStore.getState().setError(msg)
    toast({ title: 'Napaka pri preizkusnem primeru', description: msg, variant: 'destructive' })
    return false
  } finally {
    useVizStore.getState().setDemoLoading(false)
  }
}
