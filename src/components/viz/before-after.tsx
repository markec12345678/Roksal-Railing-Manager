'use client'

/**
 * VIZ — PREJ | POTEM drsnik (runda S+2, korak 5).
 *
 * Sliki (original | predogled) sta zloženi; zgornja (POTEM) je odrezana s
 * clip-path na desni strani drsnika. Drsnik vlečeš s kazalcem (ročaj ≥44 px,
 * role="slider" + puščične tipke). Način `withZoom` (celozaslonski pogled):
 * gumba [+][−] in [Ponastavi] — transform scale + pan z vlečenjem (ko je
 * povečava > 1); vlečenje ročaja drsnika ima vedno prednost.
 */

import { useCallback, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronsLeftRight, Minus, Plus, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BeforeAfterProps {
  beforeUrl: string
  afterUrl: string
  altBefore?: string
  altAfter?: string
  /** Višina/višine containerja (npr. "h-72 sm:h-96"). */
  className?: string
  /** Celozaslonski način — prikaži zoom kontrole + pan. */
  withZoom?: boolean
}

const ZOOM_MIN = 1
const ZOOM_MAX = 5

export function BeforeAfter({
  beforeUrl,
  afterUrl,
  altBefore = 'Originalna fotografija balkona (prej)',
  altAfter = 'Vizualizacija z vašo ograjo (potem)',
  className,
  withZoom = false,
}: BeforeAfterProps) {
  const [pos, setPos] = useState(0.5)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [imgErr, setImgErr] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<'divider' | 'pan' | null>(null)
  const panStartRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  const updatePos = useCallback((clientX: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const p = (clientX - rect.left) / Math.max(1, rect.width)
    setPos(Math.min(1, Math.max(0, p)))
  }, [])

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = containerRef.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    if (withZoom && zoom > 1) {
      dragRef.current = 'pan'
      panStartRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
    } else {
      dragRef.current = 'divider'
      updatePos(e.clientX)
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current === 'divider') {
      updatePos(e.clientX)
    } else if (dragRef.current === 'pan' && panStartRef.current) {
      const s = panStartRef.current
      setPan({ x: s.px + (e.clientX - s.x), y: s.py + (e.clientY - s.y) })
    }
  }

  function onPointerUp() {
    dragRef.current = null
    panStartRef.current = null
  }

  function onHandlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Ročaj vedno vleče drsnnik (tudi pri povečavi) — ne pani.
    e.stopPropagation()
    const el = containerRef.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    dragRef.current = 'divider'
  }

  function onHandleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setPos((p) => Math.max(0, p - 0.02))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setPos((p) => Math.min(1, p + 0.02))
    }
  }

  const zoomBy = (factor: number) => {
    setZoom((z) => {
      const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * factor))
      if (nz <= ZOOM_MIN + 1e-6) setPan({ x: 0, y: 0 })
      return nz
    })
  }

  const imgTransform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`

  return (
    <div className={cn('space-y-2', withZoom && 'space-y-3')}>
      <div
        ref={containerRef}
        className={cn(
          'relative w-full touch-none select-none overflow-hidden rounded-xl bg-roksal-navy/90',
          className ?? 'h-72 sm:h-96',
        )}
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {imgErr ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-xs text-white/80">
            Predogled ni na voljo — strežnik še ni pripravljen (API /api/viz/*).
          </div>
        ) : (
          <>
            {/* PREJ — spodnja plast */}
            { }
            <img
              src={beforeUrl}
              alt={altBefore}
              className="absolute inset-0 h-full w-full object-contain"
              style={{ transform: imgTransform }}
              draggable={false}
            />
            {/* POTEM — odrezana na desni strani drsnika (clip na neskaliran ovitku,
                da se drsnnik in rez vedno ujemata tudi pri povečavi) */}
            <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos * 100}%)` }}>
              { }
              <img
                src={afterUrl}
                alt={altAfter}
                className="absolute inset-0 h-full w-full object-contain"
                style={{ transform: imgTransform }}
                draggable={false}
                onError={() => setImgErr(true)}
              />
            </div>
          </>
        )}

        {/* Drsnik + ročaj */}
        {!imgErr && (
          <div
            className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-white shadow-[0_0_6px_rgba(0,0,0,0.6)]"
            style={{ left: `${pos * 100}%` }}
            aria-hidden="true"
          >
            <div
              role="slider"
              tabIndex={0}
              aria-label="Primerjava prej in potem"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(pos * 100)}
              className="pointer-events-auto absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border-2 border-roksal-amber bg-white/95 shadow-lg outline-hidden focus-visible:ring-2 focus-visible:ring-roksal-amber"
              onPointerDown={onHandlePointerDown}
              onKeyDown={onHandleKeyDown}
            >
              <ChevronsLeftRight className="h-5 w-5 text-roksal-ink" />
            </div>
          </div>
        )}

        {/* Oznake PREJ | POTEM */}
        <Badge className="pointer-events-none absolute left-2 top-2 bg-roksal-navy/85 text-[10px] font-bold text-white hover:bg-roksal-navy/85">
          PREJ
        </Badge>
        <Badge className="pointer-events-none absolute right-2 top-2 bg-roksal-amber/95 text-[10px] font-bold text-white hover:bg-roksal-amber/95">
          POTEM
        </Badge>
      </div>

      {/* Zoom kontrole (celozaslonski način) */}
      {withZoom && (
        <div className="flex items-center justify-center gap-2">
          <Button type="button" variant="outline" size="icon" className="h-11 w-11" onClick={() => zoomBy(1 / 1.3)} aria-label="Pomanjšaj" title="Pomanjšaj">
            <Minus className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 px-3 text-xs font-semibold"
            onClick={() => {
              setZoom(1)
              setPan({ x: 0, y: 0 })
            }}
            aria-label="Ponastavi povečavo"
          >
            <RotateCcw className="mr-1 h-4 w-4" />
            Ponastavi
          </Button>
          <Button type="button" variant="outline" size="icon" className="h-11 w-11" onClick={() => zoomBy(1.3)} aria-label="Povečaj" title="Povečaj">
            <Plus className="h-5 w-5" />
          </Button>
          <span className="ml-1 text-xs text-muted-foreground">{Math.round(zoom * 100)} %</span>
        </div>
      )}
    </div>
  )
}
