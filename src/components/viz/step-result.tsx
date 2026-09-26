'use client'

/**
 * VIZ — KORAK 5: REZULTAT (runda S+2, produktni UX runda S+5).
 *
 * - Headline: "Tako bi lahko izgledala vaša nova ograja." (spec §14)
 * - PREJ | POTEM velik drsnik + Povečaj + Cel zaslon (spec §13)
 * - Diskretna occlusion opomba (spec §15) — brez lažnega marketinga
 * - DOKAZILA iz metrik pipeline-a (identiteta letvic, original izven maske,
 *   RAL kroma, čas) — vse iz numeričnih meritev (spec §18)
 * - PRIMERJAVA OGRAD: isti balkon/maska/perspektiva, samo izdelek se zamenja
 *   (spec §17) — "Primerjaj drugo ograjo"
 * - SHRANI PROJEKT → POST /api/viz/projects
 * - AI FINISH (Qwen-Image-Edit-2509): ISKRENO stanje — planirano, čaka na GPU
 *   strežnik; job status queued NI lažno "completed" (spec §29)
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
  Camera,
  CheckCircle2,
  Info,
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
import { createProject, friendlyError, LOADING_TEXT, requestRender, runPreview, stageImage, getRenderJob } from './api'
import { toVizImage, useVizStore } from './viz-store'
import { BeforeAfter } from './before-after'

const VARIANT_LETTERS = 'ABCDEFGH'

function defaultName(): string {
  const d = new Date()
  return `Balkon – vizualizacija ${d.toLocaleDateString('sl-SI')}`
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
            Predogled ni na voljo — nazaj na položaj.
          </CardContent>
        </Card>
        <Button className="mt-3 h-11" variant="outline" onClick={() => s.setStep(4)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Nazaj na položaj
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
      toast({ title: 'Projekt shranjen ✓', description: 'Vidljiv je v Mojih projektih.' })
    } catch (e) {
      console.error('save project failed:', e)
      const msg = friendlyError(e, 'save')
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
      toast({ title: 'Ograja dodana v primerjavo ✓', description: 'Isti balkon, ista maska, isti položaj — samo ograja je druga.' })
    } catch (e) {
      console.error('add variant failed:', e)
      const msg = friendlyError(e, 'preview')
      s.setError(msg)
      toast({ title: 'Primerjava ni uspela', description: msg, variant: 'destructive' })
    } finally {
      setAddingVariant(false)
      if (variantInputRef.current) variantInputRef.current.value = ''
    }
  }

  async function handleRequestRender() {
    if (!savedProjectId) {
      toast({ title: 'Najprej shrani projekt', description: 'Končna vizualizacija potrebuje shranjen projekt.' })
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
      toast({ title: 'Zaporedje ustvarjeno', description: `Status: ${job.status}` })
    } catch (e) {
      console.error('request render failed:', e)
      toast({ title: 'Končna vizualizacija ni na voljo', description: friendlyError(e, 'generic'), variant: 'destructive' })
    } finally {
      setRequestingRender(false)
    }
  }

  return (
    <div className="space-y-4 p-4">
      {/* REZULTAT — headline (spec §14) */}
      <header className="text-center">
        <h2 className="text-xl font-bold leading-snug text-roksal-ink">
          Tako bi lahko izgledala vaša nova ograja.
        </h2>
      </header>

      {/* PREJ | POTEM — velika fotografija + Povečaj + Cel zaslon (spec §13) */}
      <Card>
        <CardContent className="pt-4">
          <BeforeAfter beforeUrl={balcony.url} afterUrl={preview.url} className="h-80 sm:h-[26rem]" />

          <div className="mt-2 flex items-center justify-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 px-4 text-xs font-semibold" aria-label="Povečaj predogled">
                  <Maximize2 className="mr-1.5 h-4 w-4" />
                  Povečaj
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[95dvh] w-[96vw] max-w-4xl p-4">
                <DialogHeader>
                  <DialogTitle className="text-roksal-ink">PREJ | POTEM — povečano</DialogTitle>
                </DialogHeader>
                <div className="max-h-[80dvh] overflow-y-auto pb-2">
                  <BeforeAfter beforeUrl={balcony.url} afterUrl={preview.url} withZoom className="h-[60dvh]" />
                </div>
              </DialogContent>
            </Dialog>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 px-4 text-xs font-semibold" aria-label="Celozaslonski predogled">
                  Cel zaslon
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[95dvh] w-[96vw] max-w-4xl p-4">
                <DialogHeader>
                  <DialogTitle className="text-roksal-ink">PREJ | POTEM — cel zaslon</DialogTitle>
                </DialogHeader>
                <div className="max-h-[80dvh] overflow-y-auto pb-2">
                  <BeforeAfter beforeUrl={balcony.url} afterUrl={preview.url} withZoom className="h-[60dvh]" />
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Povlecite drsnik za primerjavo · na telefonu vlecite s prstom
          </p>
        </CardContent>
      </Card>

      {/* Diskretna occlusion opomba (spec §15) — poklicna iskrenost, ne lažni marketing */}
      <p className="flex items-start justify-center gap-1.5 px-2 text-center text-[11px] leading-snug text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Predogled je informativen. Pri rastlinah, stebrih ali drugih predmetih pred ograjo lahko pride do odstopanj.</span>
      </p>

      {/* AKCIJE (spec §14) — Shrani / Primerjaj drugo ograjo / Nova vizualizacija */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="flex items-center gap-2 text-base text-roksal-ink">
            <Save className="h-4 w-4" />
            Shrani projekt
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {savedProjectId ? (
            <div className="flex items-center gap-2 rounded-lg border border-green-600/30 bg-green-600/5 px-3 py-2.5 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Projekt je shranjen — najdete ga v <strong>Moji projekti</strong>.
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
              <Button type="button" className="h-12 w-full bg-roksal-amber font-bold text-white hover:bg-roksal-amber/90" disabled={saving} onClick={() => void handleSave()}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {saving ? 'Shranjujem …' : 'Shrani projekt'}
              </Button>
            </>
          )}

          {/* Primerjava ograd (spec §17) */}
          <input
            ref={variantInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            aria-label="Naloži fotografijo druge ograje za primerjavo"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleAddVariantFile(f)
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full font-semibold"
            disabled={addingVariant}
            onClick={() => variantInputRef.current?.click()}
          >
            {addingVariant ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            {addingVariant ? LOADING_TEXT.preview : 'Primerjaj drugo ograjo'}
          </Button>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Primerjava uporablja ISTO fotografijo balkona, masko in položaj — spremeni se samo ograja.
          </p>

          {/* Nova vizualizacija */}
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full text-muted-foreground"
            onClick={() => {
              s.resetAll()
              s.setStep(1)
            }}
          >
            <Camera className="mr-2 h-4 w-4" />
            Nova vizualizacija
          </Button>
        </CardContent>
      </Card>

      {/* PRIMERJAVA OGRAD — grid variant (spec §17) */}
      {variants.length > 1 && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-base text-roksal-ink">Primerjava ograd</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
              role="tablist"
              aria-label="Primerjava ograd — izberite ograjo"
            >
              {variants.map((v, i) => (
                <button
                  key={v.label + i}
                  type="button"
                  role="tab"
                  aria-selected={activeVariant === i}
                  onClick={() => s.applyVariant(i)}
                  className={`overflow-hidden rounded-xl border-2 transition-colors ${
                    activeVariant === i ? 'border-roksal-amber' : 'border-transparent hover:border-roksal-navy/25'
                  }`}
                  aria-label={`Pokaži ${v.label}`}
                >
                  {v.preview ? (
                    <img src={v.preview.url} alt={`${v.label} — predogled na vašem balkonu`} className="h-24 w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="flex h-24 items-center justify-center bg-muted text-xs text-muted-foreground">Brez predogleda</span>
                  )}
                  <span
                    className={`block py-1.5 text-center text-xs font-bold ${
                      activeVariant === i ? 'bg-roksal-amber text-white' : 'bg-white text-roksal-navy'
                    }`}
                  >
                    {v.label}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tapnite ograjo, da jo pokažete veliko zgoraj. Vse uporabljajo isti balkon, masko in položaj.
            </p>
          </CardContent>
        </Card>
      )}

      {/* DOKAZILA (numerika, ne mnenje) — spec §18 */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="flex items-center gap-2 text-base text-roksal-ink">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            Dokazila predogleda
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border/60">
          {m ? (
            <>
              <MetricsRow ok={m.letviceIdentityOk}>
                Število letvic (identiteta ograje): <strong className="text-foreground">{m.letviceProduct}</strong> ={' '}
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

      {/* AI FINISH (Qwen) — ISKRENO: planirano, čaka na GPU (spec §29) */}
      <Card className="border-dashed">
        <CardHeader className="pb-1">
          <CardTitle className="flex items-center justify-between gap-2 text-base text-roksal-ink">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-roksal-amber" />
              Realistična končna vizualizacija
            </span>
            <Badge variant="outline" className="shrink-0 border-roksal-amber/50 text-[10px] text-roksal-amber">
              PLANIRANO — čaka na GPU strežnik
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Fotorealistična izboljšava robov, senc in odsevov bo tekla na LASTNEM GPU strežniku.
            Strežnik še ni postavljen — instant predogled zgoraj je deterministični A-pipeline
            (brez AI) in deluje že zdaj.
          </p>
          {renderJob && (
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
              <div className="font-semibold text-roksal-ink">Zaporedje {renderJob.jobId.slice(0, 8)}…</div>
              <div className="text-muted-foreground" aria-live="polite">
                {renderJob.status === 'processing'
                  ? LOADING_TEXT.gpu
                  : renderJob.status === 'queued'
                    ? 'V vrsti — čakam na GPU strežnik …'
                    : renderJob.status === 'completed'
                      ? 'Končano ✓'
                      : renderJob.status === 'failed'
                        ? `Neuspešno — ${renderJob.error ?? 'neznan vzrok'}`
                        : renderJob.status}
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
            {savedProjectId ? 'Zahtevaj končno vizualizacijo (ko bo GPU na voljo)' : 'Najprej shrani projekt'}
          </Button>
        </CardContent>
      </Card>

      {/* Navigacija */}
      <div className="flex items-center gap-2 pb-2">
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => s.setStep(4)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Položaj
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1"
          onClick={() => {
            s.resetAll()
            s.setStep('home')
          }}
        >
          <RotateCcw className="mr-1 h-4 w-4" /> Na domačo
        </Button>
      </div>
    </div>
  )
}

/** Skeleton med pripravo predogleda (loading.previewing) — vedenje čakanja (spec §23). */
export function StepResultLoading() {
  return (
    <div className="space-y-4 p-4" aria-busy="true">
      <Skeleton className="h-80 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <p className="text-center text-sm font-medium text-roksal-ink">{LOADING_TEXT.preview}</p>
    </div>
  )
}
