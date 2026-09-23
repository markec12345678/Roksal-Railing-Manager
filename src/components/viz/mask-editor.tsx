'use client'

/**
 * VIZ — urejevalnik maske (runda S+2), skupen koraku 2 (maska izdelka, v Dialogu)
 * in koraku 3 (stara ograja, v vrsti — poligon aktiven).
 *
 * Orodja: BRUSH, ERASE, (POLIGON — tap točk, ≥3, [Zapri poligon]), PAN,
 *         UNDO, REDO, PONASTAVI VSE (počisti masko), zoom [+][−][1:1].
 * Zoom: pinceta z dvema prstoma + premik z dvema prstoma; enoprstni vlečni pan
 * z orodjem "Premakni" (in s poligonom pri zoom>1). S brush/erase en prst RIŠE
 * (tudi povečano) — pinceta/vlečenje z dvema prstoma vedno premika/zoomira.
 *
 * Arhitektura: offscreen `maskCanvas` v LOČLJIVOSLI slike (bela = območje, prosojno =
 * ostalo) + vektorska zgodovina potez (max 20) za undo/redo (ponovni predvajalnik —
 * prihrani pomnilnik v primerjavi s bitmapi skladom). Prikazni canvas izrisuje
 * masko (bela 45 %) + oris (blur − original ring) + poligonske točke.
 * Izvoz: PNG v ločljivosti slike — belo = območje, črno = ostalo (pogodba).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import {
  Brush, Eraser, Hexagon, Hand, Undo2, Redo2, RotateCcw, Plus, Minus, Check, X, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type MaskTool = 'brush' | 'erase' | 'polygon' | 'pan'

type ImgPt = [number, number]

type MaskStroke =
  | { type: 'stroke'; erase: boolean; sizeImg: number; points: ImgPt[] }
  | { type: 'polygon'; points: ImgPt[] }
  | { type: 'clear' }

const HISTORY_MAX = 20
const ZOOM_MIN = 1
const ZOOM_MAX = 6

interface MaskEditorProps {
  imageUrl: string
  /** Poligon aktiven (korak 3 — stara ograja). Korak 2: false. */
  polygonEnabled?: boolean
  /** Obstoječa maska (belo = območje) za nadaljevanje urejanja. */
  initialMaskUrl?: string | null
  title?: string
  hint?: string
  saveLabel: string
  saving?: boolean
  onSave: (blob: Blob) => void | Promise<void>
  onCancel?: () => void
  className?: string
}

export function MaskEditor({
  imageUrl,
  polygonEnabled = false,
  initialMaskUrl = null,
  title,
  hint,
  saveLabel,
  saving = false,
  onSave,
  onCancel,
  className,
}: MaskEditorProps) {
  const [tool, setTool] = useState<MaskTool>(polygonEnabled ? 'polygon' : 'brush')
  const [brushSize, setBrushSize] = useState(28)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [polygonPoints, setPolygonPoints] = useState<ImgPt[]>([])
  const [hasMask, setHasMask] = useState(false)
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [historyLen, setHistoryLen] = useState(0)
  const [dims, setDims] = useState({ imgW: 0, imgH: 0 })
  const [imgReady, setImgReady] = useState(false)

  // ── Velikost prikaza (fit) + ResizeObserver (izpeljano — pred renderOverlay) ──
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 })
  const disp = useMemo(() => {
    if (!dims.imgW || !viewportSize.w || !viewportSize.h) return { w: 0, h: 0 }
    const fit = Math.min(viewportSize.w / dims.imgW, viewportSize.h / dims.imgH)
    return { w: dims.imgW * fit, h: dims.imgH * fit }
  }, [dims.imgW, dims.imgH, viewportSize.w, viewportSize.h])

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const maskRef = useRef<HTMLCanvasElement | null>(null)
  const edgeRef = useRef<HTMLCanvasElement | null>(null)
  const baseRef = useRef<HTMLCanvasElement | null>(null) // začetna maska (za undo replays)
  const historyRef = useRef<MaskStroke[]>([])
  const strokeRef = useRef<MaskStroke | null>(null)
  const pointersRef = useRef<Map<number, ImgPt>>(new Map())
  const pinchRef = useRef<{ dist: number; mid: ImgPt; zoom0: number; pan0: { x: number; y: number } } | null>(null)
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const polyDownRef = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const rafRef = useRef(0)

  // ── Pomagalniki za canvas ─────────────────────────────────────────────────

  const ensureCanvases = useCallback((w: number, h: number) => {
    if (!maskRef.current || maskRef.current.width !== w || maskRef.current.height !== h) {
      const m = document.createElement('canvas')
      m.width = w
      m.height = h
      maskRef.current = m
      const e = document.createElement('canvas')
      e.width = w
      e.height = h
      edgeRef.current = e
      const b = document.createElement('canvas')
      b.width = w
      b.height = h
      baseRef.current = b
    }
  }, [])

  /** Preveri, ali maska ima karkoli (poceni 1/8 vzorčenje). */
  const checkMaskContent = useCallback(() => {
    const mask = maskRef.current
    if (!mask || !mask.width || !mask.height) {
      setHasMask(false)
      return
    }
    const t = document.createElement('canvas')
    const tw = 160
    const th = Math.max(1, Math.round((mask.height / mask.width) * tw))
    t.width = tw
    t.height = th
    const tc = t.getContext('2d')
    if (!tc) return
    tc.drawImage(mask, 0, 0, tw, th)
    const data = tc.getImageData(0, 0, tw, th).data
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 12) {
        setHasMask(true)
        return
      }
    }
    setHasMask(false)
  }, [])

  /** Oris maske = blur(mask) − mask (obroba). */
  const recomputeEdge = useCallback(() => {
    const mask = maskRef.current
    const edge = edgeRef.current
    if (!mask || !edge) return
    const ec = edge.getContext('2d')
    if (!ec) return
    ec.clearRect(0, 0, edge.width, edge.height)
    const r = Math.max(2, Math.round(mask.width * 0.004))
    try {
      ec.filter = `blur(${r}px)`
    } catch {
      // filter ni podprt — oris izpusti (degradacija je neškodljiva)
    }
    ec.drawImage(mask, 0, 0)
    ec.filter = 'none'
    ec.globalCompositeOperation = 'destination-out'
    ec.drawImage(mask, 0, 0)
    ec.globalCompositeOperation = 'source-over'
  }, [])

  /** Ponovno izriši prikazni canvas: maska (bela 45 %) + oris + poligon vodila. */
  const renderImgW = dims.imgW
  const renderImgH = dims.imgH
  const renderOverlay = useCallback(() => {
    const overlay = overlayRef.current
    const mask = maskRef.current
    const edge = edgeRef.current
    if (!overlay || !mask) return
    const imgW = renderImgW
    const imgH = renderImgH
    const dispW = disp.w
    const dispH = disp.h
    if (!dispW || !imgW) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    if (overlay.width !== Math.round(dispW * dpr) || overlay.height !== Math.round(dispH * dpr)) {
      overlay.width = Math.round(dispW * dpr)
      overlay.height = Math.round(dispH * dpr)
    }
    const ctx = overlay.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, dispW, dispH)
    const k = dispW / imgW
    // Maska — polprosojna bela
    ctx.globalAlpha = 0.45
    ctx.drawImage(mask, 0, 0, dispW, dispH)
    // Oris
    if (edge) {
      ctx.globalAlpha = 0.9
      ctx.drawImage(edge, 0, 0, dispW, dispH)
    }
    ctx.globalAlpha = 1
    // Poligonska vodila
    if (polygonPoints.length > 0) {
      ctx.save()
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.strokeStyle = '#f59e0b'
      ctx.beginPath()
      polygonPoints.forEach(([x, y], i) => {
        const dx = x * k
        const dy = y * (dispH / imgH)
        if (i === 0) ctx.moveTo(dx, dy)
        else ctx.lineTo(dx, dy)
      })
      ctx.stroke()
      ctx.setLineDash([])
      polygonPoints.forEach(([x, y]) => {
        const dx = x * k
        const dy = y * (dispH / imgH)
        ctx.beginPath()
        ctx.arc(dx, dy, 7, 0, Math.PI * 2)
        ctx.fillStyle = '#f59e0b'
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = '#ffffff'
        ctx.stroke()
      })
      ctx.restore()
    }
    // Primitivne odvisnosti (dims/disp objekta imata vsakič novo identiteto)
    // — prepreči cascade re-rendere in neskončno zanko z load efektom.
  }, [renderImgW, renderImgH, disp.w, disp.h, polygonPoints])

  const scheduleOverlay = useCallback(() => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      renderOverlay()
    })
  }, [renderOverlay])

  const historyIndexRef = useRef(-1)

  function applyStroke(ctx: CanvasRenderingContext2D, mask: HTMLCanvasElement, s: MaskStroke) {
    if (s.type === 'clear') {
      ctx.clearRect(0, 0, mask.width, mask.height)
      return
    }
    if (s.type === 'polygon') {
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      s.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
      ctx.closePath()
      ctx.fill()
      return
    }
    ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over'
    ctx.strokeStyle = '#ffffff'
    ctx.fillStyle = '#ffffff'
    ctx.lineWidth = s.sizeImg
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (s.points.length === 1) {
      const [x, y] = s.points[0]
      ctx.beginPath()
      ctx.arc(x, y, s.sizeImg / 2, 0, Math.PI * 2)
      ctx.fill()
      return
    }
    ctx.beginPath()
    s.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
    ctx.stroke()
    ctx.globalCompositeOperation = 'source-over'
  }

  /** Predvajalnik zgodovine — izriše base + poteze do `idx` (vključno). */
  const replayTo = useCallback((idx: number) => {
    const mask = maskRef.current
    const base = baseRef.current
    const ctx = mask?.getContext('2d')
    if (!mask || !base || !ctx) return
    ctx.clearRect(0, 0, mask.width, mask.height)
    ctx.drawImage(base, 0, 0)
    for (let i = 0; i <= idx && i < historyRef.current.length; i++) {
      applyStroke(ctx, mask, historyRef.current[i])
    }
  }, [])

  const pushHistory = useCallback((s: MaskStroke) => {
    const h = historyRef.current
    historyRef.current = [...h.slice(0, historyIndexRef.current + 1), s].slice(-HISTORY_MAX)
    historyIndexRef.current = historyRef.current.length - 1
    setHistoryIndex(historyIndexRef.current)
    setHistoryLen(historyRef.current.length)
  }, [])

  // ── Nalaganje slike + začetne maske ───────────────────────────────────────

  useEffect(() => {
    // Reset ob spremembi slike — refs se počistijo; REACT stanje se ponastavi
    // prek `key` na komponenti (parent remounta ob spremembi slike/maske) —
    // priporočen React vzorec namesto sinhronih setState-ov v efektu.
    historyRef.current = []
    historyIndexRef.current = -1
    maskRef.current = null
    edgeRef.current = null
    baseRef.current = null
    let cancelled = false

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => {
      if (cancelled) return
      imgRef.current = img
      const imgW = img.naturalWidth
      const imgH = img.naturalHeight
      ensureCanvases(imgW, imgH)
      setDims({ imgW, imgH })
      setImgReady(true)
      if (initialMaskUrl) {
        const mi = new Image()
        mi.crossOrigin = 'anonymous'
        mi.onload = () => {
          if (cancelled || !maskRef.current || !baseRef.current) return
          // pretvori (belo=območje na črnem) → bela oznaka na prosojnem
          const t = document.createElement('canvas')
          t.width = imgW
          t.height = imgH
          const tc = t.getContext('2d')
          if (!tc) return
          tc.drawImage(mi, 0, 0, imgW, imgH)
          const src = tc.getImageData(0, 0, imgW, imgH)
          const out = tc.createImageData(imgW, imgH)
          for (let i = 0; i < src.data.length; i += 4) {
            const lum = (src.data[i] + src.data[i + 1] + src.data[i + 2]) / 3
            out.data[i] = 255
            out.data[i + 1] = 255
            out.data[i + 2] = 255
            out.data[i + 3] = lum > 40 ? 255 : 0
          }
          const bc = baseRef.current.getContext('2d')
          const mc = maskRef.current.getContext('2d')
          bc?.putImageData(out, 0, 0)
          mc?.putImageData(out, 0, 0)
          recomputeEdge()
          checkMaskContent()
          scheduleOverlay()
        }
        mi.src = initialMaskUrl
      }
    }
    img.src = imageUrl
    return () => {
      cancelled = true
    }
  }, [imageUrl, initialMaskUrl])

  // ── Velikost prikaza: ResizeObserver (stanje viewportSize je deklarirano zgoraj) ──
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (r) setViewportSize({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    scheduleOverlay()
  }, [disp.w, disp.h, scheduleOverlay])

  // ── Zoom/pan pomagalniki ─────────────────────────────────────────────────

  const zoomAround = useCallback((cx: number, cy: number, factor: number) => {
    setZoom((z) => {
      const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * factor))
      setPan((p) => {
        const np = { x: cx - (cx - p.x) * (nz / z), y: cy - (cy - p.y) * (nz / z) }
        return nz <= ZOOM_MIN + 1e-6 ? { x: 0, y: 0 } : np
      })
      return nz
    })
  }, [])

  const zoomIn = useCallback(() => {
    const el = viewportRef.current
    const w = el?.clientWidth ?? 0
    const h = el?.clientHeight ?? 0
    zoomAround(w / 2, h / 2, 1.3)
  }, [zoomAround])
  const zoomOut = useCallback(() => {
    const el = viewportRef.current
    const w = el?.clientWidth ?? 0
    const h = el?.clientHeight ?? 0
    zoomAround(w / 2, h / 2, 1 / 1.3)
  }, [zoomAround])
  const resetView = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  // ── Kazalčne interakcije ──────────────────────────────────────────────────

  const toImageCoords = useCallback((clientX: number, clientY: number): ImgPt => {
    const overlay = overlayRef.current
    if (!overlay || !dims.imgW || !dims.imgH) return [0, 0]
    const rect = overlay.getBoundingClientRect() // vključuje transform (zoom+pan)
    return [
      ((clientX - rect.left) / rect.width) * dims.imgW,
      ((clientY - rect.top) / rect.height) * dims.imgH,
    ]
  }, [dims.imgW, dims.imgH])

  const finishStroke = useCallback(() => {
    const s = strokeRef.current
    if (!s) return
    strokeRef.current = null
    pushHistory(s)
    recomputeEdge()
    checkMaskContent()
    scheduleOverlay()
  }, [pushHistory, recomputeEdge, checkMaskContent, scheduleOverlay])

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!imgReady) return
    const canvas = overlayRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    const pt: ImgPt = [e.clientX, e.clientY]
    const pointers = pointersRef.current
    pointers.set(e.pointerId, pt)

    if (pointers.size === 2) {
      // začni pinceto — aktivno potezo najprej zaključi
      finishStroke()
      polyDownRef.current = null
      panStartRef.current = null
      const [a, b] = [...pointers.values()]
      pinchRef.current = {
        dist: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1,
        mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        zoom0: zoom,
        pan0: pan,
      }
      return
    }
    if (pointers.size > 2) return

    // en prst
    if (tool === 'brush' || tool === 'erase') {
      const mask = maskRef.current
      const ctx = mask?.getContext('2d')
      if (!mask || !ctx) return
      const rect = canvas.getBoundingClientRect()
      const sizeImg = (brushSize * dims.imgW) / Math.max(1, rect.width)
      const p = toImageCoords(e.clientX, e.clientY)
      const s: MaskStroke = { type: 'stroke', erase: tool === 'erase', sizeImg, points: [p] }
      strokeRef.current = s
      applyStroke(ctx, mask, s)
      scheduleOverlay()
    } else if (tool === 'pan') {
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
    } else if (tool === 'polygon') {
      polyDownRef.current = { x: e.clientX, y: e.clientY, moved: false }
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const pointers = pointersRef.current
    if (!pointers.has(e.pointerId)) return
    pointers.set(e.pointerId, [e.clientX, e.clientY])

    // pinceta (2 prsta)
    if (pointers.size >= 2 && pinchRef.current) {
      const [a, b] = [...pointers.values()]
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1
      const mid: ImgPt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      const p0 = pinchRef.current
      const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, p0.zoom0 * (dist / p0.dist)))
      setZoom(nz)
      setPan({
        x: mid[0] - (p0.mid[0] - p0.pan0.x) * (nz / p0.zoom0),
        y: mid[1] - (p0.mid[1] - p0.pan0.y) * (nz / p0.zoom0),
      })
      return
    }

    if (strokeRef.current) {
      // risanje — dodaj točko in izriši segment
      const mask = maskRef.current
      const ctx = mask?.getContext('2d')
      const s = strokeRef.current
      if (mask && ctx && s.type === 'stroke') {
        const p = toImageCoords(e.clientX, e.clientY)
        const last = s.points[s.points.length - 1]
        s.points.push(p)
        ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over'
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = s.sizeImg
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(last[0], last[1])
        ctx.lineTo(p[0], p[1])
        ctx.stroke()
        ctx.globalCompositeOperation = 'source-over'
        scheduleOverlay()
      }
      return
    }

    if (panStartRef.current) {
      const ps = panStartRef.current
      setPan({ x: ps.panX + (e.clientX - ps.x), y: ps.panY + (e.clientY - ps.y) })
      return
    }

    if (polyDownRef.current && tool === 'polygon') {
      const d = polyDownRef.current
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) d.moved = true
      // pan z enim prstom pri poligonu, ko je povečava > 1
      if (d.moved && zoom > 1) {
        if (!panStartRef.current) panStartRef.current = { x: d.x, y: d.y, panX: pan.x, panY: pan.y }
        const ps = panStartRef.current
        setPan({ x: ps.panX + (e.clientX - ps.x), y: ps.panY + (e.clientY - ps.y) })
      }
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const pointers = pointersRef.current
    pointers.delete(e.pointerId)
    if (pointers.size < 2) pinchRef.current = null
    if (pointers.size === 1) {
      // iz pincete nazaj na en prst — ponastavi izhodišče pana
      const [only] = [...pointers.values()]
      panStartRef.current = { x: only[0], y: only[1], panX: pan.x, panY: pan.y }
    }
    if (pointers.size === 0) panStartRef.current = null

    if (strokeRef.current) {
      finishStroke()
      return
    }

    if (polyDownRef.current && tool === 'polygon') {
      const d = polyDownRef.current
      polyDownRef.current = null
      if (!d.moved && dims.imgW) {
        const p = toImageCoords(e.clientX, e.clientY)
        setPolygonPoints((pts) => [...pts, p])
      }
      return
    }
    panStartRef.current = null
  }

  function onPointerCancel(e: React.PointerEvent<HTMLCanvasElement>) {
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null
    if (pointersRef.current.size === 0) panStartRef.current = null
    polyDownRef.current = null
    if (strokeRef.current) finishStroke()
  }

  // ── Poligon akcije ────────────────────────────────────────────────────────

  const closePolygon = useCallback(() => {
    if (polygonPoints.length < 3) return
    const mask = maskRef.current
    const ctx = mask?.getContext('2d')
    if (!mask || !ctx) return
    const s: MaskStroke = { type: 'polygon', points: polygonPoints }
    applyStroke(ctx, mask, s)
    pushHistory(s)
    setPolygonPoints([])
    recomputeEdge()
    checkMaskContent()
    scheduleOverlay()
  }, [polygonPoints, pushHistory, recomputeEdge, checkMaskContent, scheduleOverlay])

  const undoPoint = useCallback(() => {
    setPolygonPoints((pts) => pts.slice(0, -1))
  }, [])

  // ── Undo / redo / reset ───────────────────────────────────────────────────

  const undo = useCallback(() => {
    if (historyIndexRef.current < 0) return
    const ni = historyIndexRef.current - 1
    replayTo(ni)
    setHistoryIndex(ni)
    historyIndexRef.current = ni
    recomputeEdge()
    checkMaskContent()
    scheduleOverlay()
  }, [replayTo, recomputeEdge, checkMaskContent, scheduleOverlay])

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return
    const ni = historyIndexRef.current + 1
    replayTo(ni)
    setHistoryIndex(ni)
    historyIndexRef.current = ni
    recomputeEdge()
    checkMaskContent()
    scheduleOverlay()
  }, [replayTo, recomputeEdge, checkMaskContent, scheduleOverlay])

  const clearAll = useCallback(() => {
    const mask = maskRef.current
    const ctx = mask?.getContext('2d')
    if (!mask || !ctx) return
    ctx.clearRect(0, 0, mask.width, mask.height)
    pushHistory({ type: 'clear' })
    setPolygonPoints([])
    recomputeEdge()
    checkMaskContent()
    scheduleOverlay()
  }, [pushHistory, recomputeEdge, checkMaskContent, scheduleOverlay])

  // ── Izvoz ─────────────────────────────────────────────────────────────────

  const exportAndSave = useCallback(async () => {
    const mask = maskRef.current
    if (!mask || !hasMask) return
    const out = document.createElement('canvas')
    out.width = mask.width
    out.height = mask.height
    const ctx = out.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, out.width, out.height)
    ctx.drawImage(mask, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'))
    if (!blob) return
    await onSave(blob)
  }, [hasMask, onSave])

  // ── Oznake orodij ─────────────────────────────────────────────────────────

  const tools = useMemo(() => {
    const list: { id: MaskTool; icon: typeof Brush; label: string }[] = [
      { id: 'brush', icon: Brush, label: 'Čopič — pobarvaj območje' },
      { id: 'erase', icon: Eraser, label: 'Radirka — izbriši območje' },
    ]
    if (polygonEnabled) list.push({ id: 'polygon', icon: Hexagon, label: 'Poligon — tapni točke' })
    list.push({ id: 'pan', icon: Hand, label: 'Premakni pogled' })
    return list
  }, [polygonEnabled])

  const showBrushSlider = tool === 'brush' || tool === 'erase'

  return (
    <div className={cn('flex h-full min-h-0 flex-col gap-2', className)}>
      {(title || hint) && (
        <div className="space-y-1 px-1">
          {title && <h3 className="text-sm font-bold text-roksal-navy">{title}</h3>}
          {hint && <p className="text-xs leading-snug text-muted-foreground">{hint}</p>}
        </div>
      )}

      {/* Plátno — viewport z checkerboard ozadjem (transparentnost maske) */}
      <div
        ref={viewportRef}
        className="relative min-h-[240px] flex-1 touch-none overflow-hidden rounded-xl border bg-secondary/40"
        style={{
          backgroundImage:
            'linear-gradient(45deg, #e2e5ea 25%, transparent 25%, transparent 75%, #e2e5ea 75%), linear-gradient(45deg, #e2e5ea 25%, transparent 25%, transparent 75%, #e2e5ea 75%)',
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 8px 8px',
          touchAction: 'none',
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {!imgReady && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            Nalagam sliko …
          </div>
        )}
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: disp.w || 1,
            height: disp.h || 1,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {imgReady && (
             
            <img
              src={imageUrl}
              alt={title ?? 'Slika za urejanje maske'}
              className="pointer-events-none absolute inset-0 h-full w-full select-none"
              draggable={false}
            />
          )}
          <canvas
            ref={overlayRef}
            className="absolute inset-0 h-full w-full"
            style={{ touchAction: 'none' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            aria-label={title ?? 'Urejevalnik maske'}
            role="application"
          />
        </div>

        {/* ZOOM oznaka */}
        {imgReady && (
          <Badge
            variant="secondary"
            className="pointer-events-none absolute bottom-2 right-2 bg-white/85 text-[10px] text-roksal-navy"
          >
            {Math.round(zoom * 100)}%
          </Badge>
        )}
      </div>

      {/* Orodja */}
      <div className="flex flex-wrap items-center gap-1">
        {tools.map((t) => {
          const Icon = t.icon
          const active = tool === t.id
          return (
            <Button
              key={t.id}
              type="button"
              variant={active ? 'default' : 'outline'}
              size="icon"
              className={cn('h-11 w-11', active && 'bg-roksal-navy hover:bg-roksal-navy/90')}
              onClick={() => {
                if (tool === 'brush' || tool === 'erase') finishStroke()
                setTool(t.id)
              }}
              aria-pressed={active}
              aria-label={t.label}
              title={t.label}
            >
              <Icon className="h-5 w-5" />
            </Button>
          )
        })}
        <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11"
          onClick={undo}
          disabled={historyIndex < 0}
          aria-label="Razveljavi"
          title="Razveljavi"
        >
          <Undo2 className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11"
          onClick={redo}
          disabled={historyIndex >= historyLen - 1}
          aria-label="Uveljavi znova"
          title="Uveljavi znova"
        >
          <Redo2 className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 text-roksal-red hover:text-roksal-red"
          onClick={clearAll}
          aria-label="Ponastavi vse — počisti masko"
          title="Ponastavi vse (počisti masko)"
        >
          <RotateCcw className="h-5 w-5" />
        </Button>
      </div>

      {/* Velikost čopiča */}
      {showBrushSlider && (
        <div className="flex items-center gap-3 px-1">
          <span className="w-20 shrink-0 text-xs text-muted-foreground">Čopič {brushSize}</span>
          <Slider
            value={[brushSize]}
            min={8}
            max={80}
            step={1}
            onValueChange={(v) => setBrushSize(v[0] ?? 28)}
            aria-label="Velikost čopiča"
          />
        </div>
      )}

      {/* Zoom + poligon akcije */}
      <div className="flex flex-wrap items-center gap-1">
        <Button type="button" variant="outline" size="icon" className="h-11 w-11" onClick={zoomOut} aria-label="Pomanjšaj" title="Pomanjšaj">
          <Minus className="h-5 w-5" />
        </Button>
        <Button type="button" variant="outline" className="h-11 min-w-11 px-2 text-xs font-semibold" onClick={resetView} aria-label="Ponastavi pogled (1:1)" title="Ponastavi pogled">
          1:1
        </Button>
        <Button type="button" variant="outline" size="icon" className="h-11 w-11" onClick={zoomIn} aria-label="Povečaj" title="Povečaj">
          <Plus className="h-5 w-5" />
        </Button>
        {tool === 'polygon' && (
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11 px-3 text-xs"
              onClick={undoPoint}
              disabled={polygonPoints.length === 0}
              aria-label="Razveljavi zadnjo točko"
            >
              Točko −
            </Button>
            <Button
              type="button"
              className="h-11 bg-roksal-amber px-3 text-xs font-semibold text-white hover:bg-roksal-amber/90"
              onClick={closePolygon}
              disabled={polygonPoints.length < 3}
              aria-label="Zapri poligon in zapolni območje"
            >
              <Check className="mr-1 h-4 w-4" />
              Zapri poligon{polygonPoints.length >= 3 ? '' : ` (${polygonPoints.length}/3)`}
            </Button>
          </>
        )}
      </div>

      {/* Shrani / prekliči */}
      <div className="flex items-center gap-2">
        {onCancel && (
          <Button type="button" variant="outline" className="h-11 flex-1" onClick={onCancel} aria-label="Prekliči urejanje maske">
            <X className="mr-1 h-4 w-4" />
            Prekliči
          </Button>
        )}
        <Button
          type="button"
          className="h-11 flex-1 bg-roksal-navy hover:bg-roksal-navy/90"
          onClick={() => void exportAndSave()}
          disabled={!hasMask || saving}
          aria-label={saveLabel}
        >
          {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
          {saveLabel}
        </Button>
      </div>
    </div>
  )
}
