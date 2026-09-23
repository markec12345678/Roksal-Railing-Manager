'use client'

/**
 * VIZ — zavihek "Vizualizacija ograje" (runda S+2): čarovnik 5 korakov
 * (start / 1 BALKON / 2 IZDELEK / 3 STARA OGRAJA / 4 VOGALI / 5 PREDPREGLED).
 * Shrani + AI finish sta sekciji koraka 5 (po funkcionalni specifikaciji).
 *
 * Start zaslon: hero z razlago toka, [Nova vizualizacija], [Preizkusni primer]
 * (dokazan baseline S+1: 13 = 13 letvic) in seznam shranjenih projektov
 * (GET /api/viz/projects — odpre projekt z RE-STAGIRANJEM slik, da ostane
 * celoten čarovnik urejanja funkcionalen).
 *
 * Spec: docs/VIZ_CONTRACTS.md · A-pipeline = deterministična geometrija (NI AI).
 */

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import {
  Camera,
  ChevronLeft,
  FlaskConical,
  Layers,
  Loader2,
  Trash2,
  Wand2,
} from 'lucide-react'
import type { VizProjectSummary } from '@/lib/viz/types'
import { getProject, deleteProject, listProjects } from './api'
import { loadDemoProject } from './demo-loader'
import { maxReachableStep, toVizImage, useVizStore, type VizStep } from './viz-store'

const StepBalcony = dynamic(() => import('./step-balcony').then((m) => m.StepBalcony), { ssr: false })
const StepProduct = dynamic(() => import('./step-product').then((m) => m.StepProduct), { ssr: false })
const StepMask = dynamic(() => import('./step-mask').then((m) => m.StepMask), { ssr: false })
const StepCorners = dynamic(() => import('./step-corners').then((m) => m.StepCorners), { ssr: false })
const StepResult = dynamic(() => import('./step-result').then((m) => m.StepResult), { ssr: false })

const STEP_LABELS: Array<{ id: Exclude<VizStep, 'start'>; short: string }> = [
  { id: 1, short: 'BALKON' },
  { id: 2, short: 'IZDELEK' },
  { id: 3, short: 'STARA OGRAJA' },
  { id: 4, short: 'VOGALI' },
  { id: 5, short: 'PREDPREGLED' },
]

function Stepper() {
  const step = useVizStore((s) => s.step)
  const setStep = useVizStore((s) => s.setStep)
  const maxReach = useVizStore((s) => maxReachableStep(s))
  if (step === 'start') return null
  return (
    <nav aria-label="Koraki čarovnika" className="flex items-center justify-between gap-0.5 px-3 pt-3">
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
              className={`hidden truncate text-[9px] font-semibold sm:block ${
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

function StartScreen() {
  const setStep = useVizStore((s) => s.setStep)
  const resetAll = useVizStore((s) => s.resetAll)
  const demoLoading = useVizStore((s) => s.loading.demo)
  const [projects, setProjects] = useState<VizProjectSummary[] | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [armedDelete, setArmedDelete] = useState<string | null>(null)
  const reloadKey = useVizStore((s) => s.projectsReloadKey)

  const refresh = useCallback(async () => {
    setLoadingList(true)
    try {
      setProjects(await listProjects())
    } catch {
      setProjects([])
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh, reloadKey])

  async function openProject(id: string) {
    try {
      const detail = await getProject(id)
      const s = useVizStore.getState()
      // Re-stagiraj slike (staging tokeni porabljenih projektov so izčiščeni),
      // da ostane celoten čarovnik urejanja (vogali, preview, varianti) delujoč.
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
      s.setCorners(detail.placement.corners)
      s.setProductQuad(detail.placement.productQuad)
      s.setProjectName(detail.name)
      s.setSavedProject(detail.id) // že shranjen — skrij gumb za ponovno shranjevanje
      // metrike iz result.json (če obstaja)
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
      }
      s.setStep(5)
      toast({ title: 'Projekt odprt ✓', description: detail.name })
    } catch (e) {
      toast({
        title: 'Odpiranje projekta ni uspelo',
        description: e instanceof Error ? e.message : 'Neznana napaka',
        variant: 'destructive',
      })
    }
  }

  async function handleDelete(id: string) {
    if (armedDelete !== id) {
      setArmedDelete(id)
      setTimeout(() => setArmedDelete((cur) => (cur === id ? null : cur)), 3000)
      return
    }
    try {
      await deleteProject(id)
      toast({ title: 'Projekt izbrisan' })
      setArmedDelete(null)
      void refresh()
    } catch (e) {
      toast({
        title: 'Brisanje ni uspelo',
        description: e instanceof Error ? e.message : 'Neznana napaka',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-4 p-4">
      {/* HERO */}
      <Card className="overflow-hidden border-roksal-navy/15">
        <div className="bg-gradient-to-br from-roksal-navy to-roksal-navy/85 p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-roksal-amber">
              <Wand2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Vizualizacija ograje</h1>
              <p className="text-xs text-white/80">Vaša dejanska ograja na fotografiji balkona — takoj</p>
            </div>
          </div>
          <ol className="mt-4 space-y-1.5 text-[11px] leading-relaxed text-white/90">
            <li>1. Fotografiraj balkon</li>
            <li>2. Dodaj fotografijo svoje ograje</li>
            <li>3. Označi staro ograjo</li>
            <li>4. Nastavi 4 vogale (geometrija — ne AI)</li>
            <li>5. Takojšen predogled PREJ | POTEM</li>
          </ol>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              className="h-11 flex-1 bg-roksal-amber font-bold text-white hover:bg-roksal-amber/90"
              onClick={() => {
                resetAll()
                setStep(1)
              }}
            >
              <Camera className="mr-2 h-4 w-4" />
              Nova vizualizacija
            </Button>
            <Button
              variant="outline"
              className="h-11 flex-1 border-white/40 bg-white/10 font-semibold text-white hover:bg-white/20 hover:text-white"
              disabled={demoLoading}
              onClick={() => void loadDemoProject()}
            >
              {demoLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}
              {demoLoading ? 'Nalagam …' : 'Preizkusni primer'}
            </Button>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[10px] text-white/70">
            <Layers className="h-3 w-3" />
            Predogled: deterministični A-pipeline (1.6 s) · AI finish (Qwen) planiran na lastnem GPU strežniku
          </p>
        </div>
      </Card>

      {/* SHRANJENI PROJEKTI */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-roksal-navy">Shranjeni projekti</h2>
          {projects && projects.length > 0 && (
            <Badge variant="outline" className="text-[10px]">{projects.length}</Badge>
          )}
        </div>
        {loadingList && projects === null ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : !projects || projects.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-center text-xs text-muted-foreground">
              Ni še shranjenih projektov — ustvari prvo vizualizacijo zgoraj.
            </CardContent>
          </Card>
        ) : (
          <ul className="max-h-96 space-y-2 overflow-y-auto pr-1 scrollbar-thin" aria-label="Seznam projektov">
            {projects.map((p) => (
              <li key={p.id}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center gap-3 p-3">
                    <button
                      type="button"
                      onClick={() => void openProject(p.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      aria-label={`Odpri projekt ${p.name}`}
                    >
                      {p.previewPath ? (
                         
                        <img
                          src={p.previewPath}
                          alt={`Predogled projekta ${p.name}`}
                          className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
                          <Wand2 className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-roksal-navy">{p.name}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {new Date(p.createdAt).toLocaleDateString('sl-SI', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(p.id)}
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors ${
                        armedDelete === p.id
                          ? 'bg-red-600 text-white'
                          : 'text-muted-foreground hover:bg-red-600/10 hover:text-red-600'
                      }`}
                      aria-label={armedDelete === p.id ? `Potrdi brisanje projekta ${p.name}` : `Izbriši projekt ${p.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export function VizTab() {
  const step = useVizStore((s) => s.step)
  const setStep = useVizStore((s) => s.setStep)
  const error = useVizStore((s) => s.error)
  const setError = useVizStore((s) => s.setError)

  return (
    <div className="pb-4">
      {step !== 'start' && (
        <>
          <div className="flex items-center gap-1 px-3 pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2 h-9 text-muted-foreground"
              onClick={() => {
                const prev = typeof step === 'number' && step > 1 ? ((step - 1) as VizStep) : 'start'
                setStep(prev)
              }}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Nazaj
            </Button>
          </div>
          <Stepper />
        </>
      )}

      {error && (
        <div className="mx-3 mt-3 rounded-lg border border-red-600/30 bg-red-600/5 px-3 py-2 text-xs text-red-700" role="alert">
          <div className="flex items-start justify-between gap-2">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="shrink-0 font-bold" aria-label="Zapri napako">
              ×
            </button>
          </div>
        </div>
      )}

      {step === 'start' && <StartScreen />}
      {step === 1 && <StepBalcony />}
      {step === 2 && <StepProduct />}
      {step === 3 && <StepMask />}
      {step === 4 && <StepCorners />}
      {step === 5 && <StepResult />}
    </div>
  )
}
