'use client'

/**
 * VIZ — PRODUKTNA LUPINA (runda S+5).
 *
 * Produkt "Vizualizacija ograje" ima SVOJO minimalno navigacijo (spec §7):
 *   LOGO | Moji projekti | Nov projekt
 *
 * Pogledi (viz-store.step):
 *   'home'     → ProductHome (hero + realna PREJ/POTEM demo + kako deluje)
 *   'projects' → ProductProjects (odpri / podvoji / izbriši)
 *   1..5       → čarovnik (balkon → izdelek → stara ograja → vogali → rezultat)
 *
 * Ubežna lopica za montažna orodja (dashboard itd.) je diskretna (spec §1:
 * to NI admin panel) — gumb "Orodja" pošlje roksal:navigate dogodek.
 *
 * Spec: docs/VIZ_CONTRACTS.md · A-pipeline = deterministična geometrija (NI AI).
 */

import { useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { ChevronLeft, FolderOpen, Hammer, Loader2 } from 'lucide-react'
import { getProject } from './api'
import { maxReachableStep, toVizImage, useVizStore, type VizStep } from './viz-store'
import { ProductHome } from './product-home'
import { ProductProjects } from './product-projects'

const StepBalcony = dynamic(() => import('./step-balcony').then((m) => m.StepBalcony), { ssr: false })
const StepProduct = dynamic(() => import('./step-product').then((m) => m.StepProduct), { ssr: false })
const StepMask = dynamic(() => import('./step-mask').then((m) => m.StepMask), { ssr: false })
const StepCorners = dynamic(() => import('./step-corners').then((m) => m.StepCorners), { ssr: false })
const StepResult = dynamic(() => import('./step-result').then((m) => m.StepResult), { ssr: false })

const STEP_LABELS: Array<{ id: Exclude<VizStep, 'home' | 'projects'>; short: string }> = [
  { id: 1, short: 'Balkon' },
  { id: 2, short: 'Ograja' },
  { id: 3, short: 'Stara ograja' },
  { id: 4, short: 'Položaj' },
  { id: 5, short: 'Rezultat' },
]

function Stepper() {
  const step = useVizStore((s) => s.step)
  const setStep = useVizStore((s) => s.setStep)
  const maxReach = useVizStore((s) => maxReachableStep(s))
  return (
    <nav aria-label="Koraki vizualizacije" className="flex items-center justify-between gap-0.5 px-4 pt-3">
      {STEP_LABELS.map((s, i) => {
        const active = step === s.id
        const done = typeof step === 'number' && s.id < step
        const reachable = s.id <= maxReach
        return (
          <button
            key={s.short}
            type="button"
            disabled={!reachable}
            onClick={() => reachable && setStep(s.id)}
            className="group flex min-w-0 flex-1 flex-col items-center gap-1"
            aria-current={active ? 'step' : undefined}
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                active
                  ? 'bg-roksal-amber text-white shadow-[0_0_0_3px] shadow-roksal-amber/20'
                  : done
                    ? 'bg-roksal-navy text-white'
                    : reachable
                      ? 'border-2 border-roksal-navy/25 text-roksal-navy/60'
                      : 'border-2 border-roksal-navy/10 text-roksal-navy/25'
              }`}
            >
              {i + 1}
            </span>
            <span
              className={`truncate text-[9px] font-semibold sm:text-[10px] ${
                active ? 'text-roksal-navy' : 'text-muted-foreground'
              }`}
            >
              {s.short}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

/** Produktni header — LOGO | Moji projekti | Nov projekt (spec §7, minimalno). */
function ProductHeader() {
  const step = useVizStore((s) => s.step)
  const setStep = useVizStore((s) => s.setStep)
  const inWizard = typeof step === 'number'

  function openTools() {
    // Ubežna lopica v montažna orodja (dashboard, kalkulator, …) —
    // page.tsx posluša roksal:navigate in pokaže klasičen chrome.
    window.dispatchEvent(new CustomEvent('roksal:navigate', { detail: { tab: 'dashboard' } }))
  }

  return (
    <header
      className="sticky top-0 z-30 border-b border-roksal-navy/10 bg-background/95 backdrop-blur"
      role="banner"
    >
      {/* Spec §7: mobilna navigacija = Logo | Moji projekti | Nov projekt
          (Montažna orodja = footer povezava na mobiteli, gumb od sm+). */}
      <div className="mx-auto flex h-14 w-full max-w-lg items-center justify-between gap-1 px-3 sm:max-w-2xl sm:gap-2 sm:px-4">
        {/* LOGO */}
        <button
          type="button"
          onClick={() => setStep('home')}
          className="flex shrink-0 items-center gap-2 rounded-md outline-hidden focus-visible:ring-2 focus-visible:ring-roksal-amber"
          aria-label="Roksal — domača stran vizualizacije"
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-roksal-navy text-sm font-black text-roksal-amber"
          >
            R
          </span>
          <span className="text-sm font-bold tracking-tight text-roksal-navy">
            Roksal<span className="hidden font-medium text-muted-foreground sm:inline"> · Vizualizacija</span>
          </span>
        </button>

        <nav aria-label="Glavna navigacija" className="flex items-center gap-0.5 sm:gap-1">
          <Button
            type="button"
            variant="ghost"
            className="h-10 shrink-0 px-2.5 text-[13px] font-semibold text-muted-foreground hover:text-roksal-navy sm:px-3 sm:text-sm"
            aria-current={step === 'projects' ? 'page' : undefined}
            onClick={() => setStep('projects')}
          >
            <FolderOpen className="mr-1 h-4 w-4 sm:mr-1.5" aria-hidden="true" />
            Moji projekti
          </Button>
          <Button
            type="button"
            className="h-10 shrink-0 bg-roksal-amber px-2.5 text-[13px] font-bold text-white hover:bg-roksal-amber/90 sm:px-4 sm:text-sm"
            onClick={() => {
              useVizStore.getState().resetAll()
              setStep(1)
            }}
          >
            Nov projekt
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden h-10 w-10 shrink-0 text-muted-foreground hover:text-roksal-navy sm:inline-flex"
            aria-label="Montažna orodja (kalkulator, meritve, zaloga …)"
            title="Montažna orodja"
            onClick={openTools}
          >
            <Hammer className="h-4 w-4" aria-hidden="true" />
          </Button>
        </nav>
      </div>
    </header>
  )
}

/** Odpiranje shranjenega projekta — RE-STAGIRANJE slik, da čarovnik ostane urejanju pripravljen. */
export async function openProjectById(id: string): Promise<void> {
  const s = useVizStore.getState()
  try {
    const detail = await getProject(id)
    const restage = async (url: string, kind: 'balcony' | 'product' | 'mask') => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Slika ni na voljo (${res.status})`)
      const blob = await res.blob()
      const { stageImage } = await import('./api')
      return stageImage(blob, kind)
    }
    const [balcony, product, mask] = await Promise.all([
      restage(detail.originalPath, 'balcony'),
      restage(detail.productPath, 'product'),
      restage(detail.maskPath, 'mask'),
    ])
    s.resetAll()
    s.setBalcony(toVizImage(balcony))
    s.setProduct(toVizImage(product))
    s.setMask({ ...toVizImage(mask), edited: false })
    if (detail.placement) {
      s.setCorners(detail.placement.corners)
      s.setProductQuad(detail.placement.productQuad ?? null)
    }
    s.setProjectName(detail.name)
    s.setSavedProject(detail.id) // že shranjen
    if (detail.previewPath) {
      let metrics = null
      if (detail.resultPath) {
        try {
          const res = await fetch(detail.resultPath)
          if (res.ok) metrics = (await res.json()).metrics ?? null
        } catch {
          // metrike so opcijske
        }
      }
      s.setPreview({ url: detail.previewPath, metrics })
      // S+5 primerjava ograd: glavna ograja (A) je vedno prva varianta,
      // da se pri primerjavi pokaže tudi A (balkon/maska/položaj enaka).
      s.seedVariantA()
    }
    s.setStep(5)
    toast({ title: 'Projekt odprt ✓', description: detail.name })
  } catch (e) {
    const { friendlyError } = await import('./api')
    toast({
      title: 'Odpiranje projekta ni uspelo',
      description: friendlyError(e, 'generic'),
      variant: 'destructive',
    })
  }
}

export function VizTab() {
  const step = useVizStore((s) => s.step)
  const setStep = useVizStore((s) => s.setStep)
  const error = useVizStore((s) => s.error)
  const setError = useVizStore((s) => s.setError)
  const projectsReloadKey = useVizStore((s) => s.projectsReloadKey)

  // Odpiranje projekta iz pogleda "Moji projekti" (dogodek iz ProductProjects)
  useEffect(() => {
    function onOpen(e: Event) {
      const id = (e as CustomEvent<string>).detail
      if (typeof id === 'string' && id) void openProjectById(id)
    }
    window.addEventListener('roksal:viz-open-project', onOpen)
    return () => window.removeEventListener('roksal:viz-open-project', onOpen)
  }, [])

  // Ko prideš iz čarovnika na 'projects', seznam osveži (npr. po shranjevanju).
  useEffect(() => {
    if (step === 'projects') {
      // bumpProjectsReload sproži refresh v ProductProjects prek reloadKey
      useVizStore.setState((st) => ({ projectsReloadKey: st.projectsReloadKey }))
    }
  }, [step, projectsReloadKey])

  const inWizard = typeof step === 'number'

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col" data-testid="viz-product-shell">
      <ProductHeader />

      {inWizard && (
        <div className="mx-auto w-full max-w-lg sm:max-w-2xl">
          <div className="flex items-center gap-1 px-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2 h-9 text-muted-foreground"
              onClick={() => {
                const prev = step > 1 ? ((step - 1) as VizStep) : 'home'
                setStep(prev)
              }}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Nazaj
            </Button>
          </div>
          <Stepper />
        </div>
      )}

      {error && (
        <div className="mx-auto mt-3 w-full max-w-lg px-4 sm:max-w-2xl">
          <div
            className="rounded-lg border border-red-600/30 bg-red-600/5 px-3 py-2 text-xs text-red-700"
            role="alert"
          >
            <div className="flex items-start justify-between gap-2">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} className="shrink-0 font-bold" aria-label="Zapri napako">
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1">
        {step === 'home' && <ProductHome />}
        {step === 'projects' && <ProductProjects />}
        {inWizard && (
          <div className="px-3 pb-2 pt-3 sm:px-4">
            {step === 1 && <StepBalcony />}
            {step === 2 && <StepProduct />}
            {step === 3 && <StepMask />}
            {step === 4 && <StepCorners />}
            {step === 5 && <StepResult />}
          </div>
        )}
      </div>

      {/* Produktni footer — minimalen, drži se dna (sticky footer pravilo). */}
      <footer className="mt-auto border-t border-roksal-navy/10 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-4">
        <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-2 px-4 text-center sm:max-w-2xl">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-roksal-navy sm:hidden"
            onClick={() => window.dispatchEvent(new CustomEvent('roksal:navigate', { detail: { tab: 'dashboard' } }))}
          >
            <Hammer className="h-3 w-3" aria-hidden="true" />
            Montažna orodja (kalkulator, meritve, zaloga …)
          </button>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Roksal — ograje po meri. Predogled je informativen; pri predmetih pred ograjo (rastline,
            stebri) lahko pride do odstopanj.
          </p>
          <p className="text-[10px] text-muted-foreground/70">
            © {new Date().getFullYear()} Roksal d.o.o.
          </p>
        </div>
      </footer>
    </div>
  )
}
