'use client'

/**
 * VIZ — KORAK 1: BALKON (runda S+2).
 * Fotografiraj (capture="environment") / iz galerije / namizno vleci-spusti.
 * Obdelava NA ODJEMKU: EXIF orientacija (createImageBitmap 'from-image'),
 * pomanjšanje na najdaljšo stran ≤ 1600 px, JPEG q90 → POST /api/viz/stage
 * (kind=balcony). Nato: [Zavrti 90°] (canvas rotacija + ponovni staging),
 * [Obreži] (vlečen pravokotnik z 4 ročaji ≥ 44 px) in [Zamenjaj].
 */

import { useCallback, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import {
  Camera, Images, RotateCw, Crop, Replace, Loader2, Sparkles, ImageUp, ArrowRight,
} from 'lucide-react'
import type { StageResult } from '@/lib/viz/types'
import { stageImage } from './api'
import { loadDemoProject } from './demo-loader'
import { toVizImage, useVizStore } from './viz-store'

const MAX_SIDE = 1600

/** Naloži datoteko z EXIF orientacijo (createImageBitmap) ali z <img> fallbackom. */
async function decodeImage(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return img
    } finally {
      // URL uravnavamo po decode — img je že dekodiran v bitmap
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    }
  }
}

function imgDims(img: ImageBitmap | HTMLImageElement): { w: number; h: number } {
  return 'naturalWidth' in img ? { w: img.naturalWidth, h: img.naturalHeight } : { w: img.width, h: img.height }
}

/** Pomanjšaj na ≤ MAX_SIDE in vrni JPEG blob (q90). */
async function normalizeToJpeg(img: ImageBitmap | HTMLImageElement, quality = 0.9): Promise<Blob> {
  const { w, h } = imgDims(img)
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h))
  const cw = Math.max(1, Math.round(w * scale))
  const ch = Math.max(1, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas ni na voljo.')
  ctx.drawImage(img, 0, 0, cw, ch)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new Error('Pretvorba v JPEG ni uspela.')
  return blob
}

/** Naloži URL (staged sliko) v <img> za canvas obdelavo. */
function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Slike ni mogoče naložiti.'))
    img.src = url
  })
}

export function StepBalcony() {
  const balcony = useVizStore((s) => s.balcony)
  const staging = useVizStore((s) => s.loading.staging)
  const demoLoading = useVizStore((s) => s.loading.demo)
  const setStep = useVizStore((s) => s.setStep)
  const setStaging = useVizStore((s) => s.setStaging)
  const setBalcony = useVizStore((s) => s.setBalcony)

  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const galleryInputRef = useRef<HTMLInputElement | null>(null)
  const replaceInputRef = useRef<HTMLInputElement | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [cropOpen, setCropOpen] = useState(false)

  const stageBalcony = useCallback(
    async (blob: Blob) => {
      setStaging(true)
      try {
        const res: StageResult = await stageImage(blob, 'balcony', 'balcony.jpg')
        setBalcony(toVizImage(res))
        setCropOpen(false)
      } catch (e) {
        toast({
          title: 'Nalaganje balkona ni uspelo',
          description: e instanceof Error ? e.message : 'Poskusi znova.',
          variant: 'destructive',
        })
      } finally {
        setStaging(false)
      }
    },
    [setBalcony, setStaging],
  )

  const processFile = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return
      if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
        toast({ title: 'Nepodprt format', description: 'Uporabi JPG, PNG ali WebP.', variant: 'destructive' })
        return
      }
      if (file.size > 12 * 1024 * 1024) {
        toast({ title: 'Slika je prevelika', description: 'Največ 12 MB.', variant: 'destructive' })
        return
      }
      setStaging(true)
      try {
        const decoded = await decodeImage(file)
        const blob = await normalizeToJpeg(decoded)
        await stageBalcony(blob)
      } catch (e) {
        setStaging(false)
        toast({
          title: 'Obdelava slike ni uspela',
          description: e instanceof Error ? e.message : 'Poskusi z drugo sliko.',
          variant: 'destructive',
        })
      }
    },
    [stageBalcony, setStaging],
  )

  const rotate90 = useCallback(async () => {
    if (!balcony) return
    setStaging(true)
    try {
      const img = await loadHtmlImage(balcony.url)
      const { w, h } = { w: img.naturalWidth, h: img.naturalHeight }
      const canvas = document.createElement('canvas')
      canvas.width = h
      canvas.height = w
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas ni na voljo.')
      ctx.translate(h / 2, w / 2)
      ctx.rotate(Math.PI / 2)
      ctx.drawImage(img, -w / 2, -h / 2)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
      if (!blob) throw new Error('Zavrtitev ni uspela.')
      await stageBalcony(blob)
      toast({ title: 'Zavrtjeno za 90° ✓' })
    } catch (e) {
      setStaging(false)
      toast({ title: 'Zavrtitev ni uspela', description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    }
  }, [balcony, stageBalcony, setStaging])

  return (
    <div className="space-y-4">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void processFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          void processFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          void processFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      <header className="px-1">
        <h2 className="text-lg font-bold text-roksal-navy">1 · Balkon — fotografija</h2>
        <p className="text-xs text-muted-foreground">
          Fotografiraj svoj balkon ali izberi sliko iz galerije. Slika ostane tvoja — obdelamo jo le za predogled.
        </p>
      </header>

      {!balcony ? (
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col gap-3 p-4">
            <div
              role="button"
              tabIndex={0}
              aria-label="Povleci sliko sem ali izberi fotografiranje / galerijo"
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
                dragOver ? 'border-roksal-amber bg-roksal-amber/10' : 'border-roksal-navy/20 bg-secondary/40'
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                void processFile(e.dataTransfer.files?.[0])
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') galleryInputRef.current?.click()
              }}
            >
              <ImageUp className="h-8 w-8 text-roksal-navy/50" aria-hidden="true" />
              <p className="text-sm font-semibold text-roksal-navy">Dodaj fotografijo balkona</p>
              <p className="text-xs text-muted-foreground">JPG, PNG ali WebP · največ 12 MB</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                className="h-11 bg-roksal-navy hover:bg-roksal-navy/90"
                onClick={() => cameraInputRef.current?.click()}
                disabled={staging}
                aria-label="Fotografiraj balkon"
              >
                {staging ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Camera className="mr-1 h-4 w-4" />}
                Fotografiraj
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => galleryInputRef.current?.click()}
                disabled={staging}
                aria-label="Izberi sliko iz galerije"
              >
                <Images className="mr-1 h-4 w-4" />
                Iz galerije
              </Button>
            </div>

            <Button
              type="button"
              variant="ghost"
              className="h-11 text-roksal-amber hover:text-roksal-amber"
              onClick={() => void loadDemoProject()}
              disabled={demoLoading || staging}
              aria-label="Naloži preizkusni primer"
            >
              {demoLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
              Preizkusni primer
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl">
          <CardContent className="space-y-3 p-4">
            <div className="relative overflow-hidden rounded-xl bg-secondary/40">
              { }
              <img
                src={balcony.url}
                alt="Fotografija balkona za vizualizacijo"
                className="max-h-[46vh] w-full object-contain"
                draggable={false}
              />
              {staging && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70" aria-live="polite">
                  <span className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-roksal-navy shadow">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Nalagam na strežnik …
                  </span>
                </div>
              )}
            </div>

            {cropOpen ? (
              <BalconyCrop
                url={balcony.url}
                busy={staging}
                onConfirm={(blob) => void stageBalcony(blob)}
                onCancel={() => setCropOpen(false)}
              />
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <Button type="button" variant="outline" className="h-11 text-xs" onClick={() => void rotate90()} disabled={staging} aria-label="Zavrti sliko za 90 stopinj">
                  <RotateCw className="mr-1 h-4 w-4" />
                  Zavrti 90°
                </Button>
                <Button type="button" variant="outline" className="h-11 text-xs" onClick={() => setCropOpen(true)} disabled={staging} aria-label="Obreži sliko">
                  <Crop className="mr-1 h-4 w-4" />
                  Obreži
                </Button>
                <Button type="button" variant="outline" className="h-11 text-xs" onClick={() => replaceInputRef.current?.click()} disabled={staging} aria-label="Zamenjaj fotografijo">
                  <Replace className="mr-1 h-4 w-4" />
                  Zamenjaj
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lepljiva akcija nad spodnjo navigacijo aplikacije */}
      <div className="sticky bottom-20 z-20 flex items-center gap-2 rounded-2xl border bg-background/95 p-2 shadow-sm backdrop-blur">
        <Button type="button" variant="ghost" className="h-11 flex-1" onClick={() => setStep('start')} aria-label="Nazaj na začetni zaslon">
          ← Nazaj
        </Button>
        <Button
          type="button"
          className="h-11 flex-1 bg-roksal-amber font-semibold text-white hover:bg-roksal-amber/90"
          onClick={() => setStep(2)}
          disabled={!balcony || staging}
          aria-label="Naprej na izbiro izdelka"
        >
          Naprej
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

/** Obrezovalnik — vlečen pravokotnik z 4 vogalnimi ročaji (≥44 px) + premik znotraj. */
function BalconyCrop({
  url,
  busy,
  onConfirm,
  onCancel,
}: {
  url: string
  busy: boolean
  onConfirm: (blob: Blob) => void
  onCancel: () => void
}) {
  const [rect, setRect] = useState({ x0: 0.06, y0: 0.06, x1: 0.94, y1: 0.94 })
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ corner: 0 | 1 | 2 | 3 | null; sx: number; sy: number; start: typeof rect } | null>(null)

  const MIN = 0.08

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

  function handlePointerDown(e: React.PointerEvent, corner: 0 | 1 | 2 | 3 | null) {
    e.stopPropagation()
    const el = wrapRef.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    dragRef.current = { corner, sx: e.clientX, sy: e.clientY, start: rect }
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current
    const el = wrapRef.current
    if (!d || !el) return
    const r = el.getBoundingClientRect()
    const dx = (e.clientX - d.sx) / r.width
    const dy = (e.clientY - d.sy) / r.height
    const s = d.start
    if (d.corner === null) {
      // premik celotnega pravokotnika
      let nx0 = Math.min(1 - (s.x1 - s.x0), Math.max(0, s.x0 + dx))
      let ny0 = Math.min(1 - (s.y1 - s.y0), Math.max(0, s.y0 + dy))
      nx0 = Math.max(0, nx0)
      ny0 = Math.max(0, ny0)
      setRect({ x0: nx0, y0: ny0, x1: nx0 + (s.x1 - s.x0), y1: ny0 + (s.y1 - s.y0) })
      return
    }
    const pts: Array<[number, number]> = [
      [Math.min(1 - MIN, Math.max(0, s.x0 + dx)), Math.min(1 - MIN, Math.max(0, s.y0 + dy))],
      [Math.min(1, Math.max(s.x0 + MIN, s.x1 + dx)), Math.min(1 - MIN, Math.max(0, s.y0 + dy))],
      [Math.min(1, Math.max(s.x0 + MIN, s.x1 + dx)), Math.min(1, Math.max(s.y0 + MIN, s.y1 + dy))],
      [Math.min(1 - MIN, Math.max(0, s.x0 + dx)), Math.min(1, Math.max(s.y0 + MIN, s.y1 + dy))],
    ]
    const [px, py] = pts[d.corner]
    setRect({
      x0: d.corner === 0 || d.corner === 3 ? px : s.x0,
      y0: d.corner === 0 || d.corner === 1 ? py : s.y0,
      x1: d.corner === 1 || d.corner === 2 ? px : s.x1,
      y1: d.corner === 2 || d.corner === 3 ? py : s.y1,
    })
  }

  async function confirmCrop() {
    try {
      const img = await loadHtmlImage(url)
      const nw = img.naturalWidth
      const nh = img.naturalHeight
      const sx = Math.round(rect.x0 * nw)
      const sy = Math.round(rect.y0 * nh)
      const cw = Math.max(1, Math.round((rect.x1 - rect.x0) * nw))
      const ch = Math.max(1, Math.round((rect.y1 - rect.y0) * nh))
      const canvas = document.createElement('canvas')
      canvas.width = cw
      canvas.height = ch
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas ni na voljo.')
      ctx.drawImage(img, sx, sy, cw, ch, 0, 0, cw, ch)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
      if (!blob) throw new Error('Obrezovanje ni uspelo.')
      onConfirm(blob)
    } catch (e) {
      toast({ title: 'Obrezovanje ni uspelo', description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    }
  }

  const corners: Array<{ idx: 0 | 1 | 2 | 3; style: React.CSSProperties; label: string }> = [
    { idx: 0, style: { left: `calc(${rect.x0 * 100}% - 22px)`, top: `calc(${rect.y0 * 100}% - 22px)` }, label: 'Ročaj levo zgoraj' },
    { idx: 1, style: { left: `calc(${rect.x1 * 100}% - 22px)`, top: `calc(${rect.y0 * 100}% - 22px)` }, label: 'Ročaj desno zgoraj' },
    { idx: 2, style: { left: `calc(${rect.x1 * 100}% - 22px)`, top: `calc(${rect.y1 * 100}% - 22px)` }, label: 'Ročaj desno spodaj' },
    { idx: 3, style: { left: `calc(${rect.x0 * 100}% - 22px)`, top: `calc(${rect.y1 * 100}% - 22px)` }, label: 'Ročaj levo spodaj' },
  ]

  return (
    <div className="space-y-2">
      <div
        ref={wrapRef}
        className="relative touch-none select-none"
        style={{ touchAction: 'none' }}
        onPointerMove={onPointerMove}
        onPointerUp={() => (dragRef.current = null)}
        onPointerCancel={() => (dragRef.current = null)}
      >
        { }
        <img src={url} alt="Obreži fotografijo balkona" className="block w-full" draggable={false} />
        {/* temno ozadje zunaj pravokotnika */}
        <div
          className="pointer-events-none absolute inset-0 bg-black/50"
          style={{ clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${rect.x0 * 100}% ${rect.y0 * 100}%, ${rect.x0 * 100}% ${rect.y1 * 100}%, ${rect.x1 * 100}% ${rect.y1 * 100}%, ${rect.x1 * 100}% ${rect.y0 * 100}%, ${rect.x0 * 100}% ${rect.y0 * 100}%)` }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute border-2 border-roksal-amber"
          style={{ left: `${rect.x0 * 100}%`, top: `${rect.y0 * 100}%`, width: `${(rect.x1 - rect.x0) * 100}%`, height: `${(rect.y1 - rect.y0) * 100}%` }}
          aria-hidden="true"
        />
        {corners.map((c) => (
          <div
            key={c.idx}
            role="button"
            tabIndex={0}
            aria-label={c.label}
            className="absolute z-10 h-11 w-11 cursor-nwse-resize touch-none rounded-full border-2 border-white bg-roksal-amber/80 shadow"
            style={c.style}
            onPointerDown={(e) => handlePointerDown(e, c.idx)}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 0.01 : 0.002
              let { x0, y0, x1, y1 } = rect
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault()
                const d = e.key === 'ArrowLeft' ? -step : step
                if (c.idx === 0 || c.idx === 3) x0 = clamp(x0 + d, 0, x1 - MIN)
                else x1 = clamp(x1 + d, x0 + MIN, 1)
              } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault()
                const d = e.key === 'ArrowUp' ? -step : step
                if (c.idx === 0 || c.idx === 1) y0 = clamp(y0 + d, 0, y1 - MIN)
                else y1 = clamp(y1 + d, y0 + MIN, 1)
              } else {
                return
              }
              setRect({ x0, y0, x1, y1 })
            }}
          />
        ))}
        {/* premik znotraj pravokotnika */}
        <div
          className="absolute cursor-move"
          style={{ left: `${rect.x0 * 100}%`, top: `${rect.y0 * 100}%`, width: `${(rect.x1 - rect.x0) * 100}%`, height: `${(rect.y1 - rect.y0) * 100}%` }}
          onPointerDown={(e) => handlePointerDown(e, null)}
          aria-hidden="true"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="h-11" onClick={onCancel} disabled={busy} aria-label="Prekliči obrezovanje">
          Prekliči
        </Button>
        <Button type="button" className="h-11 bg-roksal-navy hover:bg-roksal-navy/90" onClick={() => void confirmCrop()} disabled={busy} aria-label="Potrdi obrezovanje">
          Potrdi
        </Button>
      </div>
    </div>
  )
}
