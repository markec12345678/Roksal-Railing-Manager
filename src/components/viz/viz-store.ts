'use client'

/**
 * VIZ — zustand store za produktno izkušnjo "Vizualizacija ograje"
 * (runda S+2, produktna lupina runda S+5).
 *
 * Opombe glede pogodbe (docs/VIZ_CONTRACTS.md):
 *  - step je 'home' | 'projects' | 1..5 (S+5: navigacijska pogleda + čarovnik).
 *    Koraka 6 (Shrani) in 7 (AI finish) sta po funkcionalni specifikaciji
 *    SEKCIJI znotraj prikaza koraka 5 — korakov 6/7 ni kot ločenih zaslonov.
 *  - NIČ se ne persista v localStorage — projekti živijo na strežniku
 *    (/api/viz/projects), staging pa v /api/viz/stage sejah (tokeni).
 */

import { create } from 'zustand'
import type { Corners, PipelineMetrics, StageResult } from '@/lib/viz/types'

/**
 * Pogled produkta: 'home' (domača stran), 'projects' (Moji projekti) ali
 * 1..5 (čarovnik nove vizualizacije; 6/7 sta sekciji koraka 5).
 */
export type VizStep = 'home' | 'projects' | 1 | 2 | 3 | 4 | 5

/** Staged slika (odgovor /api/viz/stage). w/h = 0 pomeni "ni znano" (npr. iz projekta) —
 *  komponente takrat merijo prek naturalWidth/naturalHeight. */
export interface VizImage {
  token: string
  url: string
  w: number
  h: number
}

/** Maska s sliko + ali jo je urejal uporabnik (edited=true → ročno, sicer samodejno). */
export interface VizMaskImage extends VizImage {
  edited: boolean
}

export interface VizPreviewData {
  url: string
  metrics: PipelineMetrics | null
}

/** Lokalna varianta ograje (A/B/C) — A je vedno glavni izdelek. */
export interface VizVariantLocal {
  label: string
  product: VizImage
  productMask: VizMaskImage | null
  preview: VizPreviewData | null
}

export interface VizState {
  step: VizStep
  balcony: VizImage | null
  product: VizImage | null
  productMask: VizMaskImage | null
  mask: VizMaskImage | null
  /** Normalizirani vogali (0..1) — TL, TR, BR, BL glede na ORIGINAL sliko. */
  corners: Corners | null
  /** Ograjna ravnina v PRODUKTNI fotografiji (normalizirano) ali null = samodejno. */
  productQuad: Corners | null
  preview: VizPreviewData | null
  variants: VizVariantLocal[]
  activeVariant: number
  projectName: string
  savedProjectId: string | null
  loading: {
    staging: boolean
    previewing: boolean
    demo: boolean
    saving: boolean
  }
  error: string | null
  /**_signal zavihku "start", da osveži seznam projektov (po shranjevanju/brisanju). */
  projectsReloadKey: number

  // ── Akcije ────────────────────────────────────────────────────────────────
  setStep: (s: VizStep) => void
  resetAll: () => void
  setBalcony: (img: VizImage) => void
  setProduct: (img: VizImage) => void
  setProductMask: (img: VizMaskImage | null) => void
  setMask: (img: VizMaskImage | null) => void
  setCorners: (c: Corners) => void
  setProductQuad: (q: Corners | null) => void
  setPreview: (p: VizPreviewData | null) => void
  setProjectName: (n: string) => void
  setSavedProject: (id: string | null) => void
  setStaging: (v: boolean) => void
  setPreviewing: (v: boolean) => void
  setDemoLoading: (v: boolean) => void
  setSaving: (v: boolean) => void
  setError: (e: string | null) => void
  bumpProjectsReload: () => void
  addVariant: (v: VizVariantLocal) => void
  /** Preklopi aktivno varianto: zamenja product/productMask/preview z varianto. */
  applyVariant: (index: number) => void
  /** Pripravi varianto A (glavni izdelek), če seznam variant še prazen. */
  seedVariantA: () => void
  /** Uskladi aktivno varianto s trenutnim product/productMask/preview. */
  syncActiveVariant: () => void
}

const initialData = {
  balcony: null,
  product: null,
  productMask: null,
  mask: null,
  corners: null,
  productQuad: null,
  preview: null,
  variants: [],
  activeVariant: 0,
  projectName: '',
  savedProjectId: null,
}

export const useVizStore = create<VizState>((set) => ({
  step: 'home',
  ...initialData,
  loading: { staging: false, previewing: false, demo: false, saving: false },
  error: null,
  projectsReloadKey: 0,

  setStep: (s) => set({ step: s }),
  resetAll: () => set({ step: 'home', ...initialData, error: null }),
  setBalcony: (img) => set({ balcony: img, preview: null, savedProjectId: null, corners: null }),
  setProduct: (img) => set({ product: img, preview: null }),
  setProductMask: (img) => set({ productMask: img, preview: null }),
  setMask: (img) => set({ mask: img, preview: null }),
  setCorners: (c) => set({ corners: c }),
  setProductQuad: (q) => set({ productQuad: q }),
  setPreview: (p) => set({ preview: p }),
  setProjectName: (n) => set({ projectName: n }),
  setSavedProject: (id) => set({ savedProjectId: id }),
  setStaging: (v) => set((s) => ({ loading: { ...s.loading, staging: v } })),
  setPreviewing: (v) => set((s) => ({ loading: { ...s.loading, previewing: v } })),
  setDemoLoading: (v) => set((s) => ({ loading: { ...s.loading, demo: v } })),
  setSaving: (v) => set((s) => ({ loading: { ...s.loading, saving: v } })),
  setError: (e) => set({ error: e }),
  bumpProjectsReload: () => set((s) => ({ projectsReloadKey: s.projectsReloadKey + 1 })),

  addVariant: (v) =>
    set((s) => ({
      variants: [...s.variants, v],
      activeVariant: s.variants.length,
      product: v.product,
      productMask: v.productMask,
      preview: v.preview,
    })),

  applyVariant: (index) =>
    set((s) => {
      const v = s.variants[index]
      if (!v) return {}
      return {
        activeVariant: index,
        product: v.product,
        productMask: v.productMask,
        preview: v.preview,
      }
    }),

  seedVariantA: () =>
    set((s) => {
      if (s.variants.length > 0 || !s.product || !s.preview) return {}
      return {
        variants: [{ label: 'Ograja A', product: s.product, productMask: s.productMask, preview: s.preview }],
        activeVariant: 0,
      }
    }),

  syncActiveVariant: () =>
    set((s) => {
      if (s.activeVariant >= s.variants.length || !s.product) return {}
      const variants = [...s.variants]
      variants[s.activeVariant] = {
        ...variants[s.activeVariant],
        product: s.product,
        productMask: s.productMask,
        preview: s.preview,
      }
      return { variants }
    }),
}))

/**
 * Ali je korak del čarovnika (1..5) — nasprotuje navigacijskim pogledom
 * 'home' (domača stran) in 'projects' (Moji projekti).
 */
export function isWizardStep(step: VizStep): step is 1 | 2 | 3 | 4 | 5 {
  return typeof step === 'number'
}

/** Najvišji korak, do katerega je uporabnik dejansko prišel (iz podatkov) —
 *  določa, katere pike v prikazovalniku so klikabilne. */
export function maxReachableStep(s: Pick<VizState, 'balcony' | 'product' | 'mask' | 'corners' | 'preview'>): number {
  if (!s.balcony) return 0
  if (!s.product) return 1
  if (!s.mask) return 2
  if (!s.corners) return 3
  if (!s.preview) return 4
  return 5
}

/** Pomožnik: StageResult → VizImage (token/url/w/h). */
export function toVizImage(r: StageResult): VizImage {
  return { token: r.token, url: r.url, w: r.w, h: r.h }
}

/** Privzeti uravnoteženi kvader (navodilo: inset 12% po širini / 25% po višini). */
export function defaultCorners(): Corners {
  return [
    [0.12, 0.25],
    [0.88, 0.25],
    [0.88, 0.75],
    [0.12, 0.75],
  ]
}
