'use client'

/**
 * VIZ — korak 5: PREJ | POTEM + dokazila + shrani + varianti + AI finish.
 * Runda S+2. Spec: docs/VIZ_CONTRACTS.md (UI CONTRACT).
 *
 * - PREJ|POTEM drsnik (before-after.tsx) + celozaslonski način z zoomom
 * - kartica DOKAZILA iz metrik pipeline-a (identiteta letvic, ohranjenost
 *   originala izven maske, RAL kroma, čas) — vse iz numeričnih meritev
 * - SHRANI PROJEKT → POST /api/viz/projects (stagingToken = token balkona,
 *   ki drži preview.jpg + result.json z provenance)
 * - VARIANTI: Ograja A/B/C — ista balkon/maska/vogali, druga fotografia produkta
 * - AI FINISH (Qwen-Image-Edit-2509): ISKRENO stanje — planirano, čaka na GPU
 *   strežnik; gumb ustvari job (status queued) in pokaže status brez pretvarjanja
 */

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Maximize2,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react'
import type { PipelineMetrics } from '@/lib/viz/types'
import { createProject, requestRender, runPreview, stageImage, getRenderJob } from './api'
import { toVizImage, useVizStore } from './viz-store'
import { BeforeAfter } from './before-after'

const VARIANT_LETTERS = 'ABCDEFGH'

function defaultName(): string {
  const d = new Date()
  return `Vizualizacija ${d.toLocaleDateString('sl-SI')}`
}

function MetricsRow({
  ok,
  children,
}: {
  ok: boolean | null
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
      <span className="min-w-0 flex-1 text-muted-foreground">{children}</span>
      {ok === null ? (
        <Badge variant="outline" className="shrink-0 text-[10px]">—</Badge>
      ) : ok ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" aria-label="USTREZA" />
      ) : (
        <XCircle className="h-5 w-5 shrink-0 text-red-600" aria-label="NE USTREZA" />
      )}
    </div>
  )
}

export function StepResult() {
  const balcony = useVizStore((s) => s.balcony)
  const mask = useVizStore((s) => s.mask)
  const productMask = useVizStore((s) => s.productMask)
  const corners = useVizStore((s) => s.corners)
  const productQuad = useVizStore((s) => s.productQuad)
  const preview = useVizStore((s) => s.preview)
  const variants = useVizStore((s) => s.variants)
  const activeVariant = useVizStore((s) => s.activeVariant)
  const projectName = useVizStore((s) => s.projectName)
  const savedProjectId = useVizStore((s) => s.savedProjectId)
  const saving = useVizStore((s) => s.loading.saving)
  const s = useVizStore()

  const [name, setName] = useState(projectName || defaultName())
  const [addingVariant, setAddingVariant] = useState(false)
  const [renderJob, setRenderJob] = useState<{ jobId: string; status: string; error: string | null } | null>(null)
  const [requestingRender, setRequestingRender] = useState(false)
  const variantInputRef = useRef<HTMLInputElement | null>(null)

  if (!balcony || !preview || !mask || !corners) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Predogled ni na voljo — nazaj na vogale.
          </CardContent>
        </Card>
        <Button className="mt-3 h-11" variant="outline" onClick={() => s.setStep(4)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Nazaj na 4 vogale
        </Button>
      </div>
    )
  }

  const m: PipelineMetrics | null = preview.metrics

  async function handleSave() {
    if (!balcony) return
    s.setSaving(true)
    s.setError(null)
    try {
      const res = await createProject({
        name: name.trim() || defaultName(),
        stagingToken: balcony.token,
      })
      s.setProjectName(name.trim() || defaultName())
      s.setSavedProject(res.projectId)
      s.bumpProjectsReload()
      toast({ title: 'Projekt shranjen ✓', description: 'Vidljiv je v seznamu projektov (zavihek Vizualizacija).' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Shranjevanje ni uspelo.'
      s.setError(msg)
      toast({ title: 'Napaka pri shranjevanju', description: msg, variant: 'destructive' })
    } finally {
      s.setSaving(false)
    }
  }

  async function handleAddVariantFile(file: File) {
    if (!balcony || !mask || !corners) return
    setAddingVariant(true)
    s.setError(null)
    try {
      const staged = await stageImage(file, 'product', file.name || 'product.jpg')
      const productMaskToken = productMask?.token ?? null
      const res = await runPreview({
        originalToken: balcony.token,
        productToken: staged.token,
        productMaskToken,
        maskToken: mask.token,
        placement: { version: 2, corners, rotation: 0, scale: 1, productQuad },
      })
      s.addVariant({
        label: `Ograja ${VARIANT_LETTERS[variants.length] ?? variants.length + 1}`,
        product: toVizImage(staged),
        productMask,
        preview: { url: res.previewUrl, metrics: res.metrics },
      })
      toast({ title: 'Varianta dodana ✓', description: 'Predogled uporablja isto balkon/maska/vogali.' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Dodajanje variante ni uspelo.'
      s.setError(msg)
      toast({ title: 'Napaka pri varianti', description: msg, variant: 'destructive' })
    } finally {
      setAddingVariant(false)
      if (variantInputRef.current) variantInputRef.current.value = ''
    }
  }

  async function handleRequestRender() {
    if (!savedProjectId) {
      toast({ title: 'Najprej shrani projekt', description: 'AI finish potrebuje shranjen projekt.' })
      return
    }
    setRequestingRender(true)
    try {
      const job = await requestRender(savedProjectId)
      setRenderJob({ jobId: job.jobId, status: job.status, error: null })
      // status poll (enkrat — GPU backend še ne obstaja, iskreno pokažemo queued)
      setTimeout(() => {
        void getRenderJob(job.jobId)
          .then((st) => setRenderJob({ jobId: st.jobId, status: st.status, error: st.error }))
          .catch(() => undefined)
      }, 1500)
      toast({ title: 'AI job ustvarjen', description: `Status: ${job.status}` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Zahteva ni uspela.'
      toast({ title: 'AI finish ni na voljo', description: msg, variant: 'destructive' })
    } finally {
      setRequestingRender(false)
    }
  }

  return (
    <div className="space-y-4 p-4">
      {/* PREJ | POTEM */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base text-roksal-navy">
            <span>PREJ | POTEM</span>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-3 text-xs font-semibold" aria-label="Celozaslonski predogled">
                  <Maximize2 className="mr-1 h-4 w-4" />
                  Celozaslonsko
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[95dvh] w-[96vw] max-w-4xl p-4">
                <DialogHeader>
                  <DialogTitle className="text-roksal-navy">PREJ | POTEM — celozaslonsko</DialogTitle>
                </DialogHeader>
                <div className="max-h-[80dvh] overflow-y-auto pb-2">
                  <BeforeAfter beforeUrl={balcony.url} afterUrl={preview.url} withZoom className="h-[60dvh]" />
                </div>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BeforeAfter beforeUrl={balcony.url} afterUrl={preview.url} className="h-80 sm:h-[26rem]" />
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Povleci drsnik za primerjavo · na telefonu vleci s prstom
          </p>
        </CardContent>
      </Card>

      {/* DOKAZILA (numerike, ne mnenja) */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="flex items-center gap-2 text-base text-roksal-navy">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            Dokazila predogleda
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border/60">
          {m ? (
            <>
              <MetricsRow ok={m.letviceIdentityOk}>
                Letvice (identiteta ograje): <strong className="text-foreground">{m.letviceProduct}</strong> ={' '}
                <strong className="text-foreground">{m.letviceResult}</strong>
              </MetricsRow>
              <MetricsRow ok={m.outsideMaxPreShadow === 0}>
                Original izven maske:{' '}
                <strong className="text-foreground">
                  {m.outsideMaxPreShadow === 0 ? 'nespremenjen' : `spremembe (${m.outsideMaxPreShadow})`}
                </strong>
              </MetricsRow>
              <MetricsRow ok={m.chroma.dE < 1.5}>
                Barva (RAL zaščita): ΔE <strong className="text-foreground">{m.chroma.dE.toFixed(2)}</strong>{' '}
                <span className="text-[10px]">(meja 1.5)</span>
              </MetricsRow>
              <MetricsRow ok={true}>
                Čas predogleda: <strong className="text-foreground">{(m.timeMs / 1000).toFixed(1)} s</strong>{' '}
                <span className="text-[10px]">(deterministična geometrija — brez AI)</span>
              </MetricsRow>
            </>
          ) : (
            <p className="py-2 text-sm text-muted-foreground">
              Metrike niso na voljo (projekt naložen iz arhiva brez result.json).
            </p>
          )}
        </CardContent>
      </Card>

      {/* VARIANTI (A/B/C) */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-base text-roksal-navy">Varianti ograje</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {variants.length > 0 && (
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Varianti ograje">
              {variants.map((v, i) => (
                <button
                  key={v.label + i}
                  type="button"
                  role="tab"
                  aria-selected={activeVariant === i}
                  onClick={() => s.applyVariant(i)}
                  className={`h-9 rounded-full border-2 px-4 text-xs font-bold transition-colors ${
                    activeVariant === i
                      ? 'border-roksal-amber bg-roksal-amber text-white'
                      : 'border-roksal-navy/15 bg-white text-roksal-navy hover:border-roksal-navy/40'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
          <input
            ref={variantInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            aria-label="Naloži fotografijo druge ograje"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleAddVariantFile(f)
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            disabled={addingVariant}
            onClick={() => variantInputRef.current?.click()}
          >
            {addingVariant ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            {addingVariant ? 'Pripravljam predogled …' : 'Dodaj varianto (druga ograja)'}
          </Button>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Nova ograja uporabi ISTO fotografijo balkona, masko in 4 vogale — samo izdelek se zamenja.
          </p>
        </CardContent>
      </Card>

      {/* SHRANI PROJEKT */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="flex items-center gap-2 text-base text-roksal-navy">
            <Save className="h-4 w-4" />
            Shrani projekt
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {savedProjectId ? (
            <div className="flex items-center gap-2 rounded-lg border border-green-600/30 bg-green-600/5 px-3 py-2.5 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Projekt je shranjen ({savedProjectId.slice(0, 8)}…)
            </div>
          ) : (
            <>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ime projekta"
                aria-label="Ime projekta"
                maxLength={120}
                className="h-11"
              />
              <Button type="button" className="h-11 w-full font-bold" disabled={saving} onClick={() => void handleSave()}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {saving ? 'Shranjujem …' : 'Shrani projekt'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* AI FINISH (Qwen) — ISKRENO: planirano, čaka na GPU */}
      <Card className="border-dashed">
        <CardHeader className="pb-1">
          <CardTitle className="flex items-center justify-between gap-2 text-base text-roksal-navy">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-roksal-amber" />
              AI finish — Qwen-Image-Edit-2509
            </span>
            <Badge variant="outline" className="shrink-0 border-roksal-amber/50 text-[10px] text-roksal-amber">
              PLANIRANO — čaka na GPU strežnik
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Fotorealistična izboljšava robov, senc in odsevov bo tekla na LASTNEM GPU strežniku (Apache-2.0
            licenca). Strežnik še ni postavljen — instant predogled zgoraj je deterministični A-pipeline
            (brez AI) in deluje že zdaj.
          </p>
          {renderJob && (
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
              <div className="font-semibold text-roksal-navy">Job {renderJob.jobId.slice(0, 8)}…</div>
              <div className="text-muted-foreground">
                status: <strong>{renderJob.status}</strong>
                {renderJob.error ? ` — ${renderJob.error}` : ''}
              </div>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            disabled={requestingRender || !savedProjectId}
            onClick={() => void handleRequestRender()}
          >
            {requestingRender ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {savedProjectId ? 'Zahtevaj AI finish (job v vrsto)' : 'Najprej shrani projekt'}
          </Button>
        </CardContent>
      </Card>

      {/* Navigacija */}
      <div className="flex items-center gap-2 pb-2">
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => s.setStep(4)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Vogali
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1"
          onClick={() => {
            s.resetAll()
            s.setStep('start')
          }}
        >
          <RotateCcw className="mr-1 h-4 w-4" /> Nova vizualizacija
        </Button>
      </div>
    </div>
  )
}

/** Skeleton med pripravo predogleda (loading.previewing) — vedenje čakanja. */
export function StepResultLoading() {
  return (
    <div className="space-y-4 p-4" aria-busy="true">
      <Skeleton className="h-80 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <p className="text-center text-sm font-medium text-roksal-navy">Pripravljam predogled …</p>
    </div>
  )
}
