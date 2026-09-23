'use client'

/**
 * VIZ — KORAK 4: 4 VOGALI (runda S+2).
 * Štirje ročaji (≥44 px, številčeni 1–4) na normaliziranih vogalih (0..1).
 * Interakcije: vlečenje posameznega ročaja; pinceta (2 prsta) = zoom + pan
 * (transform na notranjem ovitku — ročaji sledijo prek koordinatnega računa z
 * getBoundingClientRect, ki vključuje transform). [Ponastavi] = privzeti
 * uravnoteženi kvader. Fini panel: puščice ±0.002 / ±veliko (±0.01) za aktivni
 * vogal. ŽIVI PRAZEN PREDOGLED: produkt pretvorjen v kvader z dvotrikotniško
 * afino aproksimacijo (TL-TR-BR + TL-BR-BL), opacity 0.85, rAF prigušen.
 * [Pripravi predogled] → POST /api/viz/preview → korak 5.
 * GEOMETRIJA = čista matematika (homografija) — NI AI; tekst prav tako.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import {
  ArrowLeft, ArrowRight, ArrowUp, ArrowDown, RotateCcw, Loader2, Sparkles,
} from 'lucide-react'
import type { Corners } from '@/lib/viz/types'
import { runPreview } from './api'
import { defaultCorners, useVizStore } from './viz-store'

const ZOOM_MIN = 1
const ZOOM_MAX = 5
const CORNER_MIN = -0.02
const CORNER_MAX = 1.02
const HANDLE = 44

const CORNER_LABELS = ['1', '2', '3', '4']

/** Reši afino preslikavo iz 3 izvoriščnih v 3 ciljne točke (2×3 matrika). */
function affineFromTri(
  src: Array<[number, number]>,
  dst: Array<[number, number]>,
): [number, number, number, number, number, number] {
  const [[x0, y0], [x1, y1], [x2, y2]] = src
  const [[u0, v0], [u1, v1], [u2, v2]] = dst
  const det = x0 * (y1 - y2) - y0 * (x1 - x2) + (x1 * y2 - x2 * y1)
  if (Math.abs(det) < 1e-9) return [1, 0, 0, 1, 0, 0]
  const a = (u0 * (y1 - y2) - y0 * (u1 - u2) + (u1 * y2 - u2 * y1)) / det
  const c = (x0 * (u1 - u2) - u0 * (x1 - x2) + (x1 * u2 - x2 * u1)) / det
  const b = (v0 * (y1 - y2) - y0 * (v1 - v2) + (v1 * y2 - v2 * y1)) / det
  const d = (x0 * (v1 - v2) - v0 * (x1 - x2) + (x1 * v2 - x2 * v1)) / det
  const e = u0 - a * x0 - c * y0
  const f = v0 - b * x0 - d * y0
  return [a, b, c, d, e, f]
}

export function StepCorners() {
  const balcony = useVizStore((s) => s.balcony)
  const product = useVizStore((s) => s.product)
  const productMask = useVizStore((s) => s.productMask)
  const mask = useVizStore((s) => s.mask)
  const corners = useVizStore((s) => s.corners)
  const productQuad = useVizStore((s) => s.productQuad)
  const setCorners = useVizStore((s) => s.setCorners)
  const setPreview = useVizStore((s) => s.setPreview)
  const setPreviewing = useVizStore((s) => s.setPreviewing)
  const previewing = useVizStore((s) => s.loading.previewing)
  const setStep = useVizStore((s) => s.setStep)

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const ghostRef = useRef<HTMLCanvasElement | null>(null)
  const productImgRef = useRef<HTMLImageElement | null>(null)
  const pointersRef = useRef<Map<number, [number, number]>>(new Map())
  const pinchRef = useRef<{ dist: number; mid: [number, number]; zoom0: number; pan0: { x: number; y: number } } | null>(null)
  const panStartRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const dragCornerRef = useRef<number | null>(null)
  const rafRef = useRef(0)

  const [dims, setDims] = useState({ dispW: 0, dispH: 0 })
  const [aspect, setAspect] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [activeCorner, setActiveCorner] = useState(0)
  const [coarse, setCoarse] = useState(false)

  // Privzeti vogali, če še niso nastavljeni (npr. ročni tok brez demo primera).
  useEffect(() => {
    if (!corners) setCorners(defaultCorners())
  }, [corners, setCorners])

  // Razmerje strani balkonske slike (store w/h je lahko 0 → iz <img>).
  useEffect(() => {
    if (!balcony) return
    if (balcony.w && balcony.h) {
      setAspect(balcony.w / balcony.h)
      return
    }
    const img = new Image()
    img.onload = () => setAspect(img.naturalWidth / Math.max(1, img.naturalHeight))
    img.src = balcony.url
  }, [balcony])

  // Produkt za duha-predogled.
  useEffect(() => {
    if (!product) {
      productImgRef.current = null
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      productImgRef.current = img
      scheduleGhost()
    }
    img.src = product.url
     
  }, [product])

  // Velikost prikaza (fit) + ResizeObserver.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (!r || !aspect) return
      const dw = Math.min(r.width, r.height * aspect)
      setDims({ dispW: dw, dispH: dw / aspect })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [aspect])

  const renderGhost = useCallback(() => {
    const canvas = ghostRef.current
    const img = productImgRef.current
    if (!canvas || !dims.dispW || !corners) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const W = Math.round(dims.dispW * dpr)
    const H = Math.round(dims.dispH * dpr)
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W
      canvas.height = H
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, dims.dispW, dims.dispH)
    if (!img) return
    const quad = corners.map(([x, y]) => [x * dims.dispW, y * dims.dispH] as [number, number])
    const nw = img.naturalWidth
    const nh = img.naturalHeight
    const src: Array<[number, number]> = productQuad
      ? productQuad.map(([x, y]) => [x * nw, y * nh] as [number, number])
      : [
          [0, 0],
          [nw, 0],
          [nw, nh],
          [0, nh],
        ]
    // dva trikotnika: TL-TR-BR + TL-BR-BL (indeksi v kvadru)
    const tris: Array<[number, number, number]> = [
      [0, 1, 2],
      [0, 2, 3],
    ]
    ctx.globalAlpha = 0.85
    ctx.imageSmoothingEnabled = true
    for (const [i0, i1, i2] of tris) {
      const s = [src[i0], src[i1], src[i2]]
      const d = [quad[i0], quad[i1], quad[i2]]
      const [a, b, c, dd, e, f] = affineFromTri(s, d)
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(d[0][0], d[0][1])
      ctx.lineTo(d[1][0], d[1][1])
      ctx.lineTo(d[2][0], d[2][1])
      ctx.closePath()
      ctx.clip()
      ctx.transform(a, b, c, dd, e, f)
      ctx.drawImage(img, 0, 0)
      ctx.restore()
    }
    ctx.globalAlpha = 1
  }, [corners, dims, productQuad])

  const scheduleGhost = useCallback(() => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      renderGhost()
    })
  }, [renderGhost])

  useEffect(() => {
    scheduleGhost()
  }, [corners, dims, scheduleGhost])

  // ── Interakcije ────────────────────────────────────────────────────────────

  const clampPan = useCallback((p: { x: number; y: number }, z: number) => {
    const el = viewportRef.current
    if (!el) return p
    const mw = Math.max(0, (dims.dispW * z - el.clientWidth) / 2)
    const mh = Math.max(0, (dims.dispH * z - el.clientHeight) / 2)
    return {
      x: Math.min(mw, Math.max(-mw, p.x)),
      y: Math.min(mh, Math.max(-mh, p.y)),
    }
  }, [dims])

  function updateCorner(idx: number, clientX: number, clientY: number) {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const rect = wrapper.getBoundingClientRect() // vključuje zoom+pan transform
    const nx = Math.min(CORNER_MAX, Math.max(CORNER_MIN, (clientX - rect.left) / rect.width))
    const ny = Math.min(CORNER_MAX, Math.max(CORNER_MIN, (clientY - rect.top) / rect.height))
    const current = corners ?? defaultCorners()
    const next = current.map(([x, y], i) => (i === idx ? [nx, ny] : [x, y])) as Corners
    setCorners(next)
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = viewportRef.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    pointersRef.current.set(e.pointerId, [e.clientX, e.clientY])

    // ročaj? (data-corner na ročaju)
    const handle = (e.target as HTMLElement).closest?.('[data-corner]')
    if (handle) {
      const idx = Number(handle.getAttribute('data-corner'))
      if (!Number.isNaN(idx)) {
        dragCornerRef.current = idx
        setActiveCorner(idx)
        return
      }
    }

    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()]
      pinchRef.current = {
        dist: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1,
        mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        zoom0: zoom,
        pan0: pan,
      }
      panStartRef.current = null
      return
    }
    // en prst — pan
    panStartRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const pointers = pointersRef.current
    if (!pointers.has(e.pointerId)) return
    pointers.set(e.pointerId, [e.clientX, e.clientY])

    if (dragCornerRef.current !== null) {
      updateCorner(dragCornerRef.current, e.clientX, e.clientY)
      return
    }

    if (pointers.size >= 2 && pinchRef.current) {
      const [a, b] = [...pointers.values()]
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1
      const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      const p0 = pinchRef.current
      const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, p0.zoom0 * (dist / p0.dist)))
      setZoom(nz)
      setPan(
        clampPan(
          {
            x: mid[0] - (p0.mid[0] - p0.pan0.x) * (nz / p0.zoom0),
            y: mid[1] - (p0.mid[1] - p0.pan0.y) * (nz / p0.zoom0),
          },
          nz,
        ),
      )
      return
    }

    if (panStartRef.current) {
      const ps = panStartRef.current
      setPan((p) => clampPan({ x: ps.px + (e.clientX - ps.x), y: ps.py + (e.clientY - ps.y) }, zoom))
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null
    if (pointersRef.current.size === 0) {
      panStartRef.current = null
      dragCornerRef.current = null
    }
  }

  // Fini premik aktivnega vogala
  const nudge = useCallback(
    (dx: number, dy: number) => {
      const current = corners ?? defaultCorners()
      const step = coarse ? 0.01 : 0.002
      const next = current.map(([x, y], i) =>
        i === activeCorner
          ? [
              Math.min(CORNER_MAX, Math.max(CORNER_MIN, x + dx * step)),
              Math.min(CORNER_MAX, Math.max(CORNER_MIN, y + dy * step)),
            ]
          : [x, y],
      ) as Corners
      setCorners(next)
    },
    [corners, coarse, activeCorner, setCorners],
  )

  // ── Predogled ─────────────────────────────────────────────────────────────

  const preparePreview = useCallback(async () => {
    if (!balcony || !product || !mask || !corners) {
      toast({
        title: 'Manjkajo podatki',
        description: 'Zaključi korake 1–3 (balkon, izdelek, maska stare ograje).',
        variant: 'destructive',
      })
      return
    }
    setPreviewing(true)
    try {
      const res = await runPreview({
        originalToken: balcony.token,
        productToken: product.token,
        productMaskToken: productMask?.token ?? null,
        maskToken: mask.token,
        placement: { version: 2, corners, rotation: 0, scale: 1, productQuad },
      })
      setPreview({ url: res.previewUrl, metrics: res.metrics })
      setStep(5)
    } catch (e) {
      console.error('preview failed:', e)
      const { friendlyError } = await import('./api')
      toast({
        title: 'Predogled ni uspel',
        description: friendlyError(e, 'preview'),
        variant: 'destructive',
      })
    } finally {
      setPreviewing(false)
    }
  }, [balcony, product, productMask, mask, corners, productQuad, setPreview, setPreviewing, setStep])

  const quad = corners ?? defaultCorners()

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h2 className="text-lg font-bold text-roksal-navy">Prilagodite položaj nove ograje</h2>
        <p className="text-xs leading-snug text-muted-foreground">
          Povlecite štiri vogale, da se ograja prilega balkonu.
        </p>
      </header>

      <div
        ref={viewportRef}
        className="relative flex h-[52vh] min-h-[300px] touch-none items-center justify-center overflow-hidden rounded-xl bg-secondary/50"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          ref={wrapperRef}
          className="relative origin-top-left"
          style={{
            width: dims.dispW || 1,
            height: dims.dispH || 1,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {balcony && (
             
            <img
              src={balcony.url}
              alt="Fotografija balkona z označenimi vogali ograje"
              className="absolute inset-0 h-full w-full select-none object-fill"
              draggable={false}
            />
          )}
          {/* živi prazen predogled — produkt pretvorjen v kvader */}
          <canvas
            ref={ghostRef}
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
          />
          {/* ročaji */}
          {quad.map(([x, y], i) => (
            <div
              key={i}
              data-corner={i}
              role="button"
              tabIndex={0}
              aria-label={`Vogal ${i + 1} — povleci ali usmeri s tipkami`}
              className={`absolute flex touch-none select-none items-center justify-center rounded-full border-2 text-xs font-bold shadow-lg outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-roksal-amber ${
                activeCorner === i
                  ? 'border-white bg-roksal-amber text-white'
                  : 'border-roksal-amber bg-white text-roksal-navy'
              }`}
              style={{ left: `calc(${x * 100}% - ${HANDLE / 2}px)`, top: `calc(${y * 100}% - ${HANDLE / 2}px)`, width: HANDLE, height: HANDLE }}
              onKeyDown={(e) => {
                const step = e.shiftKey ? 0.01 : 0.002
                const cx = quad[i][0]
                const cy = quad[i][1]
                if (e.key === 'ArrowLeft') {
                  e.preventDefault()
                  setActiveCorner(i)
                  setCorners(quad.map(([qx, qy], j) => (j === i ? [Math.max(CORNER_MIN, qx - step), qy] : [qx, qy])) as Corners)
                } else if (e.key === 'ArrowRight') {
                  e.preventDefault()
                  setActiveCorner(i)
                  setCorners(quad.map(([qx, qy], j) => (j === i ? [Math.min(CORNER_MAX, cx + step), qy] : [qx, qy])) as Corners)
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setActiveCorner(i)
                  setCorners(quad.map(([qx, qy], j) => (j === i ? [qx, Math.max(CORNER_MIN, qy - step)] : [qx, qy])) as Corners)
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setActiveCorner(i)
                  setCorners(quad.map(([qx, qy], j) => (j === i ? [qx, Math.min(CORNER_MAX, cy + step)] : [qx, qy])) as Corners)
                }
              }}
            >
              {CORNER_LABELS[i]}
            </div>
          ))}
        </div>

        <Badge
          variant="secondary"
          className="pointer-events-none absolute left-2 top-2 bg-white/90 text-[10px] font-semibold text-roksal-navy"
          aria-live="polite"
        >
          Predogled
        </Badge>
        <Badge variant="secondary" className="pointer-events-none absolute bottom-2 right-2 bg-white/85 text-[10px] text-roksal-navy">
          {Math.round(zoom * 100)}%
        </Badge>
      </div>

      {/* Kontrole: ponastavi + fini premik */}
      <div className="rounded-2xl border bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="outline" className="h-11 text-xs" onClick={() => setCorners(defaultCorners())} disabled={previewing} aria-label="Ponastavi položaj ograje">
            <RotateCcw className="mr-1 h-4 w-4" />
            Ponastavi položaj
          </Button>
          <Button
            type="button"
            variant={coarse ? 'default' : 'outline'}
            className={`h-11 text-xs ${coarse ? 'bg-roksal-navy hover:bg-roksal-navy/90' : ''}`}
            onClick={() => setCoarse((v) => !v)}
            aria-pressed={coarse}
            aria-label={coarse ? 'Velik korak vključen (±0.01)' : 'Majhen korak vključen (±0.002)'}
          >
            ±veliko
          </Button>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Badge variant="secondary" className="shrink-0 bg-roksal-navy/10 text-[10px] text-roksal-navy">
            Vogal {activeCorner + 1}
          </Badge>
          <div className="grid grid-cols-3 grid-rows-2 gap-1" role="group" aria-label="Fini premik aktivnega vogala">
            <span />
            <Button type="button" variant="outline" size="icon" className="h-11 w-11" onClick={() => nudge(0, -1)} aria-label="Premakni vogal navzgor">
              <ArrowUp className="h-4 w-4" />
            </Button>
            <span />
            <Button type="button" variant="outline" size="icon" className="h-11 w-11" onClick={() => nudge(-1, 0)} aria-label="Premakni vogal levo">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" className="h-11 w-11" onClick={() => nudge(0, 1)} aria-label="Premakni vogal navzdol">
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" className="h-11 w-11" onClick={() => nudge(1, 0)} aria-label="Premakni vogal desno">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[11px] leading-tight text-muted-foreground">
            Korak {coarse ? '±0.01' : '±0.002'} · povečaj pogled z dvema prstoma za natančno postavitev
          </p>
        </div>
      </div>

      {/* Lepljiva akcija nad spodnjo navigacijo aplikacije */}
      <div className="sticky bottom-20 z-20 flex items-center gap-2 rounded-2xl border bg-background/95 p-2 shadow-sm backdrop-blur">
        <Button type="button" variant="ghost" className="h-11 flex-1" onClick={() => setStep(3)} disabled={previewing} aria-label="Nazaj na masko stare ograje">
          ← Nazaj
        </Button>
        <Button
          type="button"
          className="h-11 flex-1 bg-roksal-amber font-semibold text-white hover:bg-roksal-amber/90"
          onClick={() => void preparePreview()}
          disabled={previewing || !balcony || !product || !mask}
          aria-label="Pripravi predogled vizualizacije"
        >
          {previewing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
          Pripravi predogled
        </Button>
      </div>

      {previewing && (
        <p className="text-center text-sm font-medium text-roksal-navy" role="status" aria-live="polite">
          Pripravljam predogled …
        </p>
      )}
    </div>
  )
}
