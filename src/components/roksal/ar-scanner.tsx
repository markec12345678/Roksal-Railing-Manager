'use client'

/**
 * Roksal AR Scanner
 * -----------------------------------------------------------------------------
 * Full-screen camera + canvas overlay component for balcony railing installers.
 *
 * Features:
 *   - Rear camera (getUserMedia facingMode: 'environment')
 *   - Anchor points (ADD / REMOVE / MOVE / MEASURE modes)
 *   - Railing visualization based on selected profile's category
 *       · WPC vodoravno  → horizontal slats (~110mm apart)
 *       · WPC pokončno    → vertical balusters (~110mm apart)
 *       · Inox            → vertical balusters (silver)
 *       · Steklo          → translucent glass panel
 *       · Alu klasično    → top + bottom rail + vertical pickets
 *   - Calibration (px → mm) using a known reference distance
 *   - Real-world measurements between two tapped points
 *   - Capture (composite of video frame + overlay) → POST /api/ar-snapshots
 *   - History sheet listing saved snapshots for the project
 *
 * All UI text is in Slovenian. Color theme: navy #1d2b3e, amber #f59e0b,
 * green #10b981, red #ef4444 — NO indigo/blue.
 */

import * as React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import {
  Camera,
  Plus,
  Trash2,
  Move,
  Ruler,
  Crosshair,
  History,
  X,
  Check,
  Loader2,
  RotateCcw,
  AlertTriangle,
  Grid3x3,
  Calculator,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Zap,
  Undo2,
  Sparkles,
  SunDim,
  ZoomIn,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { calculateEqualSpacing, formatEUR } from '@/lib/calculator'

// ============================================================================
// Types
// ============================================================================

interface XY {
  x: number
  y: number
}

interface Tocka extends XY {
  label: string
}

interface Meritev {
  id: string
  a: XY
  b: XY
  dolzinaMm: number
  oznaka: string
}

interface Kalibracija {
  pixelsPerMm: number
  referencnaMm: number
  createdAt: string
}

interface Profil {
  id: string
  sifra: string
  naziv: string
  material: string
  kategorija: string
  visinaMm: number
  sirinaMm: number
  cenaM: number
  barvaRal: string | null
  slikaUrl: string | null
  aktivna: boolean
}

interface ArSnapshot {
  id: string
  projectId: string
  profilId: string | null
  imageUrl: string
  tocke: string
  meritve: string | null
  kalibracija: string | null
  opombe: string | null
  createdAt: string
  profil?: Profil
}

type Mode = 'ADD' | 'REMOVE' | 'MOVE' | 'MEASURE'

/** Posamezna priporočena meritev iz AI analize fotografije. */
interface AiMera {
  naziv: string
  opis: string
  prednost: string
}

/** Strukturiran rezultat AI analize fotografije ograje (glej /api/ar/analyze). */
interface AiAnaliza {
  tipOgraje: string
  stanje: string
  material: string
  predlaganaBarva: string
  tipMontaze: string
  ovire: string
  priporoceneMere: AiMera[]
  opombe: string
  zaupanje: number
}

interface ArScannerProps {
  projectId: string
  onClose: () => void
}

// ============================================================================
// Constants
// ============================================================================

const NAVY = '#1d2b3e'
const AMBER = '#f59e0b'
const GREEN = '#10b981'
const RED = '#ef4444'

const HIT_RADIUS = 30 // px — tap near existing point within this radius
const DEFAULT_POST_HEIGHT_PX = 200 // fallback post height when not calibrated
const DEFAULT_SLAT_SPACING_PX = 18 // fallback infill spacing when not calibrated
const POST_HEIGHT_CAP_PX = 600 // never draw posts taller than this

// Grid overlay (AR-OVERLAY)
const GRID_CELL_MM = 100 // 1 grid cell = 100mm real-world (when calibrated)
const GRID_CELL_PX_UNCALIBRATED = 50 // 1 grid cell = 50px (when not calibrated)
const GRID_MAJOR_EVERY = 5 // major line every 5 cells

// ============================================================================
// Helpers
// ============================================================================

function dist(a: XY, b: XY): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}

function formatDistance(mm: number): string {
  if (!Number.isFinite(mm) || mm <= 0) return '—'
  if (mm >= 1000) return `${(mm / 1000).toFixed(2)} m`
  if (mm >= 100) return `${(mm / 10).toFixed(1)} cm`
  return `${Math.round(mm)} mm`
}

function findNearestPoint(points: Tocka[], p: XY): number {
  let best = -1
  let bestD = HIT_RADIUS
  for (let i = 0; i < points.length; i++) {
    const d = dist(points[i], p)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Haptika — najlažji takojšen povratni učinek na telefonu (brez zvoka, brez UI).
 * Tiho ignorira naprave brez vibratorja (desktop).
 */
function zibaj(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern)
    } catch {
      /* ignore */
    }
  }
}

// ============================================================================
// Drawing helpers (pure, operate on a 2D context in CSS pixels)
// ============================================================================

function drawAnchorPoint(
  ctx: CanvasRenderingContext2D,
  p: Tocka,
  index: number,
  total: number,
): void {
  const isEnd = total <= 2 || index === 0 || index === total - 1
  const r = isEnd ? 14 : 10
  // Outer halo for end posts
  if (isEnd) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(29, 43, 62, 0.18)'
    ctx.fill()
  }
  // Filled circle
  ctx.beginPath()
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
  ctx.fillStyle = isEnd ? NAVY : AMBER
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2.5
  ctx.stroke()
  // Number label
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${isEnd ? 13 : 11}px ui-sans-serif, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(index + 1), p.x, p.y)
}

function drawInfill(
  ctx: CanvasRenderingContext2D,
  a: XY, // bottom-left (anchor i)
  b: XY, // bottom-right (anchor i+1)
  ta: XY, // top-left (post top i)
  tb: XY, // top-right (post top i+1)
  profil: Profil,
  slatSpacingPx: number,
): void {
  const kat = profil.kategorija.toLowerCase()
  const isWpcVodoravno = kat.includes('vodoravno')
  const isWpcPokoncno =
    kat.includes('pokončno') || kat.includes('pokoncno')
  const isInox = kat.includes('inox')
  const isSteklo = kat.includes('steklo')
  const isAluKlasicno =
    kat.includes('klasično') || kat.includes('klasicno')

  // --- Steklo: translucent panel ---
  if (isSteklo) {
    ctx.save()
    ctx.fillStyle = 'rgba(186, 230, 253, 0.35)'
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.7)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.lineTo(tb.x, tb.y)
    ctx.lineTo(ta.x, ta.y)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    // Subtle highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(ta.x + 4, ta.y + 4)
    ctx.lineTo(tb.x - 4, tb.y + 4)
    ctx.stroke()
    ctx.restore()
    return
  }

  // --- WPC vodoravno: horizontal slats from bottom up ---
  if (isWpcVodoravno) {
    const segHeight = Math.max(
      Math.abs(ta.y - a.y),
      Math.abs(tb.y - b.y),
    )
    const numSlats = Math.max(1, Math.floor(segHeight / slatSpacingPx))
    const actualSpacing = segHeight / numSlats
    ctx.strokeStyle = '#8b5a2b'
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    for (let s = 1; s <= numSlats; s++) {
      const offset = s * actualSpacing
      const ly = a.y - offset
      const ry = b.y - offset
      // Stop if both endpoints rise above the top rail
      if (ly < ta.y && ry < tb.y) break
      const clampedLy = Math.max(ly, ta.y)
      const clampedRy = Math.max(ry, tb.y)
      ctx.beginPath()
      ctx.moveTo(a.x, clampedLy)
      ctx.lineTo(b.x, clampedRy)
      ctx.stroke()
    }
    return
  }

  // --- WPC pokončno / Inox: vertical balusters ---
  if (isWpcPokoncno || isInox) {
    const segLen = dist(a, b)
    const numBal = Math.max(1, Math.floor(segLen / slatSpacingPx))
    ctx.strokeStyle = isInox ? '#c0c4cc' : '#8b5a2b'
    ctx.lineWidth = isInox ? 2.5 : 3.5
    ctx.lineCap = 'round'
    for (let s = 1; s < numBal; s++) {
      const t = s / numBal
      const bx = a.x + (b.x - a.x) * t
      const by = a.y + (b.y - a.y) * t
      const tx = ta.x + (tb.x - ta.x) * t
      const ty = ta.y + (tb.y - ta.y) * t
      ctx.beginPath()
      ctx.moveTo(bx, by)
      ctx.lineTo(tx, ty)
      ctx.stroke()
    }
    return
  }

  // --- Alu klasično: bottom rail + vertical pickets ---
  if (isAluKlasicno) {
    // Bottom rail
    ctx.strokeStyle = NAVY
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    // Vertical pickets
    const segLen = dist(a, b)
    const numPick = Math.max(1, Math.floor(segLen / slatSpacingPx))
    ctx.strokeStyle = '#6b7280'
    ctx.lineWidth = 2
    for (let s = 1; s < numPick; s++) {
      const t = s / numPick
      const bx = a.x + (b.x - a.x) * t
      const by = a.y + (b.y - a.y) * t
      const tx = ta.x + (tb.x - ta.x) * t
      const ty = ta.y + (tb.y - ta.y) * t
      ctx.beginPath()
      ctx.moveTo(bx, by)
      ctx.lineTo(tx, ty)
      ctx.stroke()
    }
    return
  }

  // Fallback: no infill
}

function drawRailing(
  ctx: CanvasRenderingContext2D,
  tocke: Tocka[],
  profil: Profil,
  postHeightPx: number,
  slatSpacingPx: number,
): void {
  if (tocke.length < 2) return
  const cappedHeight = Math.min(postHeightPx, POST_HEIGHT_CAP_PX)
  const tops: XY[] = tocke.map((p) => ({
    x: p.x,
    y: p.y - cappedHeight,
  }))

  // 1. Infill between consecutive posts (drawn first so posts/rails overlay)
  for (let i = 0; i < tocke.length - 1; i++) {
    drawInfill(ctx, tocke[i], tocke[i + 1], tops[i], tops[i + 1], profil, slatSpacingPx)
  }

  // 2. Vertical posts at each anchor (navy)
  ctx.strokeStyle = NAVY
  ctx.lineWidth = 6
  ctx.lineCap = 'round'
  for (let i = 0; i < tocke.length; i++) {
    ctx.beginPath()
    ctx.moveTo(tocke[i].x, tocke[i].y)
    ctx.lineTo(tops[i].x, tops[i].y)
    ctx.stroke()
  }

  // 3. Top rail — thick navy line connecting tops of consecutive posts
  ctx.strokeStyle = NAVY
  ctx.lineWidth = 8
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(tops[0].x, tops[0].y)
  for (let i = 1; i < tops.length; i++) {
    ctx.lineTo(tops[i].x, tops[i].y)
  }
  ctx.stroke()
}

function drawMeasurement(ctx: CanvasRenderingContext2D, m: Meritev): void {
  // Dashed line
  ctx.save()
  ctx.strokeStyle = GREEN
  ctx.lineWidth = 2.5
  ctx.setLineDash([8, 4])
  ctx.beginPath()
  ctx.moveTo(m.a.x, m.a.y)
  ctx.lineTo(m.b.x, m.b.y)
  ctx.stroke()
  ctx.setLineDash([])
  // End markers
  for (const pt of [m.a, m.b]) {
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2)
    ctx.fillStyle = GREEN
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.stroke()
  }
  // Label badge at midpoint
  const mx = (m.a.x + m.b.x) / 2
  const my = (m.a.y + m.b.y) / 2
  const label = `${m.oznaka}: ${formatDistance(m.dolzinaMm)}`
  ctx.font = 'bold 12px ui-sans-serif, system-ui, sans-serif'
  const metrics = ctx.measureText(label)
  const pad = 6
  const w = metrics.width + pad * 2
  const h = 20
  // Background pill
  ctx.fillStyle = 'rgba(29, 43, 62, 0.92)'
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(mx - w / 2, my - h / 2, w, h, 4)
    ctx.fill()
  } else {
    ctx.fillRect(mx - w / 2, my - h / 2, w, h)
  }
  // Text
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, mx, my)
  ctx.restore()
}

// ============================================================================
// Grid overlay drawing (AR-OVERLAY)
// ============================================================================

function drawGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  ppm: number | null,
): void {
  const cellPx = ppm && ppm > 0 ? Math.max(8, GRID_CELL_MM * ppm) : GRID_CELL_PX_UNCALIBRATED
  const majorPx = cellPx * GRID_MAJOR_EVERY

  ctx.save()
  ctx.lineWidth = 1

  // Minor lines — subtle white
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.beginPath()
  for (let x = cellPx; x < w; x += cellPx) {
    const i = Math.round(x / cellPx)
    if (i % GRID_MAJOR_EVERY === 0) continue
    const xx = Math.round(x) + 0.5
    ctx.moveTo(xx, 0)
    ctx.lineTo(xx, h)
  }
  for (let y = cellPx; y < h; y += cellPx) {
    const i = Math.round(y / cellPx)
    if (i % GRID_MAJOR_EVERY === 0) continue
    const yy = Math.round(y) + 0.5
    ctx.moveTo(0, yy)
    ctx.lineTo(w, yy)
  }
  ctx.stroke()

  // Major lines — brighter
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.beginPath()
  for (let x = majorPx; x < w; x += majorPx) {
    const xx = Math.round(x) + 0.5
    ctx.moveTo(xx, 0)
    ctx.lineTo(xx, h)
  }
  for (let y = majorPx; y < h; y += majorPx) {
    const yy = Math.round(y) + 0.5
    ctx.moveTo(0, yy)
    ctx.lineTo(w, yy)
  }
  ctx.stroke()

  // Labels at major lines (top-left, horizontal axis only to avoid clutter)
  ctx.font = '9px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  for (let x = majorPx, i = 1; x < w - 30; x += majorPx, i++) {
    const label = ppm ? `${i * GRID_CELL_MM * GRID_MAJOR_EVERY}mm` : `${i * GRID_CELL_PX_UNCALIBRATED * GRID_MAJOR_EVERY}px`
    const tw = ctx.measureText(label).width
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(x + 3, 3, tw + 6, 12)
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillText(label, x + 6, 5)
  }

  ctx.restore()
}

// ============================================================================
// Main component
// ============================================================================

export function ArScanner({ projectId, onClose }: ArScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const draggingRef = useRef<number | null>(null)

  const { toast } = useToast()

  // Camera state
  const [streamReady, setStreamReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  // Mode + drawing state
  const [mode, setMode] = useState<Mode>('ADD')
  const [tocke, setTocke] = useState<Tocka[]>([])
  const [meritve, setMeritve] = useState<Meritev[]>([])

  // Profile selection
  const [profili, setProfili] = useState<Profil[]>([])
  const [profiliLoading, setProfiliLoading] = useState(true)
  const [selectedProfilId, setSelectedProfilId] = useState<string | null>(null)

  // Calibration state
  const [kalibracija, setKalibracija] = useState<Kalibracija | null>(null)
  const [calibrateDialogOpen, setCalibrateDialogOpen] = useState(false)
  const [calRealMm, setCalRealMm] = useState('600')
  const [calibrateActive, setCalibrateActive] = useState(false)
  const [calFirstPoint, setCalFirstPoint] = useState<XY | null>(null)

  // Measurement state
  const [measureFirstPoint, setMeasureFirstPoint] = useState<XY | null>(null)
  const [labelDialogOpen, setLabelDialogOpen] = useState(false)
  const [pendingMeritev, setPendingMeritev] = useState<{
    a: XY
    b: XY
    dolzinaMm: number
  } | null>(null)
  const [meritevLabel, setMeritevLabel] = useState('')

  // History sheet
  const [historyOpen, setHistoryOpen] = useState(false)
  const [snapshots, setSnapshots] = useState<ArSnapshot[]>([])
  const [snapshotsLoading, setSnapshotsLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Grid + HUD + auto-calc (AR-OVERLAY)
  const [gridVisible, setGridVisible] = useState(true)
  const [calcPanelOpen, setCalcPanelOpen] = useState(false)
  const [liveCursor, setLiveCursor] = useState<XY | null>(null)

  // --- Kamera kontrola (bliskavica / zoom / fokus) — lažje merjenje v hladnih
  // hodnikih in z zasenčenih balkonov; vse best-effort, naprava bez podpore
  // posamezne možnosti ne prikaže. ---
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [zoomCap, setZoomCap] = useState<{ min: number; max: number; step: number } | null>(null)
  const [zoomValue, setZoomValue] = useState(1)

  // --- AI analiza fotografije + pogoji scene ---
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiAnaliza, setAiAnaliza] = useState<AiAnaliza | null>(null)
  const [aiSheetOpen, setAiSheetOpen] = useState(false)
  const [lowLight, setLowLight] = useState(false)
  const [steady, setSteady] = useState(false)
  const steadyRef = useRef(false)

  // --- Fetch profili on mount ---
  useEffect(() => {
    let cancelled = false
    setProfiliLoading(true)
    fetch('/api/profili')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('fetch failed'))))
      .then((data: Profil[]) => {
        if (cancelled) return
        setProfili(data)
        if (data.length > 0) setSelectedProfilId(data[0].id)
      })
      .catch(() => {
        if (cancelled) return
        toast({
          title: 'Napaka',
          description: 'Katalog profilov ni na voljo.',
          variant: 'destructive',
        })
      })
      .finally(() => {
        if (!cancelled) setProfiliLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [toast])

  // --- Detekcija zmožnosti video sledega (torch, zoom) ob zagonu toka ---
  const setupTrack = useCallback((stream: MediaStream) => {
    const track = stream.getVideoTracks()[0] ?? null
    trackRef.current = track
    setTorchOn(false)
    if (!track) {
      setTorchSupported(false)
      setZoomCap(null)
      return
    }
    type Caps = MediaTrackCapabilities & {
      torch?: boolean
      zoom?: { min: number; max: number; step?: number }
    }
    let caps: Caps = {}
    try {
      caps = (track.getCapabilities?.() ?? {}) as Caps
    } catch {
      caps = {}
    }
    setTorchSupported(Boolean(caps.torch))
    if (caps.zoom && caps.zoom.max > caps.zoom.min) {
      setZoomCap({
        min: caps.zoom.min,
        max: caps.zoom.max,
        step: caps.zoom.step || 0.1,
      })
      const settings = track.getSettings() as MediaTrackSettings & { zoom?: number }
      setZoomValue(typeof settings.zoom === 'number' ? settings.zoom : caps.zoom.min)
    } else {
      setZoomCap(null)
    }
  }, [])

  // --- Bliskavica (torch) — ključna za temna stopnišča in podane balkone ---
  const applyTorch = useCallback(
    async (on: boolean) => {
      const track = trackRef.current
      if (!track) return
      try {
        await track.applyConstraints({
          advanced: [{ torch: on }],
        } as unknown as MediaTrackConstraints)
        setTorchOn(on)
        zibaj(on ? 15 : 8)
      } catch {
        toast({ title: 'Bliskavica ni na voljo', description: 'Naprava je ne podpira.' })
      }
    },
    [toast],
  )

  // --- Optični/digitalni zoom — okvir ograde brez odhoda nazaj ---
  const applyZoom = useCallback(async (value: number) => {
    const track = trackRef.current
    if (!track) return
    try {
      await track.applyConstraints({
        advanced: [{ zoom: value }],
      } as unknown as MediaTrackConstraints)
    } catch {
      /* ignore — slider se vseeno pomika */
    }
  }, [])

  // --- Tap-to-focus: takojšnja ostrost tam, kamor monter kaže ---
  const focusAt = useCallback((clientX: number, clientY: number) => {
    const track = trackRef.current
    const video = videoRef.current
    if (!track || !video) return
    const rect = video.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const nx = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    const ny = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height))
    type Caps = MediaTrackCapabilities & {
      focusMode?: string[]
      pointsOfInterest?: boolean
    }
    let caps: Caps = {}
    try {
      caps = (track.getCapabilities?.() ?? {}) as Caps
    } catch {
      caps = {}
    }
    const constraints: Record<string, unknown> = {}
    if (caps.focusMode?.includes('single-shot')) constraints.focusMode = 'single-shot'
    if (caps.pointsOfInterest) {
      constraints.pointsOfInterest = { x: nx, y: 1 - ny } // kamera ima obrnjen y
    }
    if (Object.keys(constraints).length === 0) return
    track.applyConstraints(constraints as MediaTrackConstraints).catch(() => {})
  }, [])

  // --- Osvetlitev scene: vzorčenje svetlosti vsake 2,5 s (32×32 vzorec) ---
  // Če je scena pretemna, monterju prikažemo opozorilo in vabimo k bliskavici —
  // temne fotke so najpogostejši razlog za slabše meritve in AI analize.
  useEffect(() => {
    if (!streamReady) return
    const c = document.createElement('canvas')
    c.width = 32
    c.height = 32
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    const id = window.setInterval(() => {
      const video = videoRef.current
      if (!video || video.videoWidth === 0) return
      try {
        ctx.drawImage(video, 0, 0, 32, 32)
        const { data } = ctx.getImageData(0, 0, 32, 32)
        let sum = 0
        for (let i = 0; i < data.length; i += 4) {
          sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
        }
        const avg = sum / (data.length / 4)
        setLowLight(avg < 42)
      } catch {
        /* video še ni pripravljen za branje */
      }
    }, 2500)
    return () => window.clearInterval(id)
  }, [streamReady])

  // --- Stabilnost roke (DeviceMotion): držite telefon pri miru ~0,7 s in se
  // prikaže »Stabilno ✓« — pravi trenutek za kalibracijo/meritev. Best-effort:
  // na iOS brez dovoljenja se senzor tiho ne vključi. ---
  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return
    let lastStableAt: number | null = null
    const onMotion = (e: DeviceMotionEvent) => {
      const r = e.rotationRate
      if (!r) return
      const rate = Math.max(Math.abs(r.alpha ?? 0), Math.abs(r.beta ?? 0), Math.abs(r.gamma ?? 0))
      const now = performance.now()
      if (rate < 12) {
        if (lastStableAt === null) {
          lastStableAt = now
        } else if (now - lastStableAt > 700 && !steadyRef.current) {
          steadyRef.current = true
          setSteady(true)
        }
      } else {
        lastStableAt = null
        if (steadyRef.current) {
          steadyRef.current = false
          setSteady(false)
        }
      }
    }
    window.addEventListener('devicemotion', onMotion)
    return () => window.removeEventListener('devicemotion', onMotion)
  }, [])

  // --- Camera init (getUserMedia rear camera) ---
  useEffect(() => {
    let active = true
    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          if (active) {
            setCameraError(
              'Vaša naprava ali brskalnik ne podpira dostopa do kamere.',
            )
          }
          return
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            // Višja ločljivost → ostrejši robovi → natančnejša kalibracija in
            // boljša AI analiza fotografije.
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })
        if (!active) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        setupTrack(stream)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {
            // Autoplay can fail; user gesture (button click) is needed
          })
        }
        setStreamReady(true)
        setCameraError(null)
      } catch (err) {
        if (!active) return
        const e = err as DOMException
        if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
          setCameraError(
            'Dostop do kamere je zavrnjen. V nastavitvah brskalnika omogočite kamero in poskusite znova.',
          )
        } else if (e.name === 'NotFoundError' || e.name === 'OverconstrainedError') {
          setCameraError('Kamera ni najdena. Preverite, da je priklopljena in aktivna.')
        } else if (e.name === 'NotReadableError') {
          setCameraError(
            'Kamera je v uporabi v drugem programu. Zaprite ga in poskusite znova.',
          )
        } else {
          setCameraError(`Napaka kamere: ${e.message || e.name}`)
        }
      }
    }
    startCamera()
    return () => {
      active = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [])

  // --- Resize canvas to match the displayed video element ---
  const resizeCanvas = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const rect = video.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const dpr = window.devicePixelRatio || 1
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
    const targetW = Math.round(rect.width * dpr)
    const targetH = Math.round(rect.height * dpr)
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW
      canvas.height = targetH
    }
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
  }, [])

  // --- ResizeObserver + window resize + polling ---
  useEffect(() => {
    if (!streamReady) return
    resizeCanvas()
    const ro = new ResizeObserver(() => resizeCanvas())
    if (containerRef.current) ro.observe(containerRef.current)
    window.addEventListener('resize', resizeCanvas)
    window.addEventListener('orientationchange', resizeCanvas)
    const interval = setInterval(resizeCanvas, 500)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', resizeCanvas)
      window.removeEventListener('orientationchange', resizeCanvas)
      clearInterval(interval)
    }
  }, [streamReady, resizeCanvas])

  // --- Selected profile ---
  const selectedProfil = useMemo(
    () => profili.find((p) => p.id === selectedProfilId) ?? null,
    [profili, selectedProfilId],
  )

  // --- Real-time stats (AR-OVERLAY) ---
  // Širina / višina / dolžina / površina computed from tocke + kalibracija
  const realtimeStats = useMemo(() => {
    const ppm = kalibracija?.pixelsPerMm ?? null
    const stTock = tocke.length
    const visinaMm = selectedProfil?.visinaMm ?? null

    if (stTock === 0) {
      return {
        sirinaMm: null as number | null,
        visinaMm,
        dolzinaMm: 0,
        povrsinaM2: 0,
        stTock,
        kalibrirano: !!kalibracija,
        ppm,
      }
    }

    // Širina = max X − min X
    const xs = tocke.map((t) => t.x)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const sirinaPx = maxX - minX
    const sirinaMm = ppm ? sirinaPx / ppm : null

    // Dolžina = sum of consecutive distances
    let dolzinaPx = 0
    for (let i = 0; i < tocke.length - 1; i++) {
      dolzinaPx += dist(tocke[i], tocke[i + 1])
    }
    const dolzinaMm = ppm ? dolzinaPx / ppm : 0

    // Površina = širina × višina (m²)
    const povrsinaM2 = sirinaMm && visinaMm ? (sirinaMm * visinaMm) / 1_000_000 : 0

    return {
      sirinaMm,
      visinaMm,
      dolzinaMm,
      povrsinaM2,
      stTock,
      kalibrirano: !!kalibracija,
      ppm,
    }
  }, [tocke, kalibracija, selectedProfil])

  // --- Auto calculation (AR-OVERLAY) ---
  // Material counts + cost derived from realtimeStats + selectedProfil
  const autoCalc = useMemo(() => {
    if (!selectedProfil || !kalibracija || tocke.length < 2) return null
    const dolzinaMm = realtimeStats.dolzinaMm
    if (dolzinaMm <= 0) return null

    const visinaMm = selectedProfil.visinaMm
    const balusterWidthMm = Math.max(1, selectedProfil.sirinaMm || 40)

    const spacing = calculateEqualSpacing({
      totalLengthMm: dolzinaMm,
      balusterWidthMm,
      maxGapMm: 110,
    })

    const balusterCount = spacing.balusterCount
    const actualGapMm = spacing.actualGapMm
    const postCount = Math.floor(dolzinaMm / 1500) + 1
    // Top + bottom rails = 2× linearni metri
    const totalLinearMeters = (2 * dolzinaMm) / 1000
    const screwCount = balusterCount * 4 + postCount * 8
    const anchorCount = postCount * 2
    const cenaMateriala = totalLinearMeters * selectedProfil.cenaM
    const cenaZDDV = cenaMateriala * 1.22

    return {
      dolzinaMm,
      visinaMm,
      balusterCount,
      actualGapMm,
      postCount,
      totalLinearMeters,
      screwCount,
      anchorCount,
      cenaMateriala,
      cenaZDDV,
      profil: selectedProfil,
    }
  }, [realtimeStats, selectedProfil, kalibracija, tocke.length])

  // --- Redraw canvas whenever state changes ---
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const cssW = canvas.clientWidth
    const cssH = canvas.clientHeight
    ctx.clearRect(0, 0, cssW, cssH)

    const ppm = kalibracija?.pixelsPerMm ?? null

    // Grid overlay (AR-OVERLAY) — behind everything, on top of video
    if (gridVisible) {
      drawGrid(ctx, cssW, cssH, ppm)
    }

    const postHeightPx =
      ppm && selectedProfil
        ? selectedProfil.visinaMm * ppm
        : DEFAULT_POST_HEIGHT_PX
    const slatSpacingPx = ppm ? 110 * ppm : DEFAULT_SLAT_SPACING_PX

    // Railing visualization
    if (tocke.length >= 2 && selectedProfil) {
      drawRailing(ctx, tocke, selectedProfil, postHeightPx, slatSpacingPx)
    } else if (tocke.length >= 2) {
      // No profile — just a navy line between anchors
      ctx.strokeStyle = NAVY
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(tocke[0].x, tocke[0].y)
      for (let i = 1; i < tocke.length; i++) {
        ctx.lineTo(tocke[i].x, tocke[i].y)
      }
      ctx.stroke()
    }

    // Saved measurements
    for (const m of meritve) {
      drawMeasurement(ctx, m)
    }

    // Pending measurement: first point marker
    if (mode === 'MEASURE' && measureFirstPoint) {
      ctx.save()
      ctx.fillStyle = GREEN
      ctx.beginPath()
      ctx.arc(measureFirstPoint.x, measureFirstPoint.y, 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2.5
      ctx.stroke()
      // Pulsing ring
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(measureFirstPoint.x, measureFirstPoint.y, 16, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // Pending calibration: first point marker
    if (calibrateActive && calFirstPoint) {
      ctx.save()
      ctx.fillStyle = AMBER
      ctx.beginPath()
      ctx.arc(calFirstPoint.x, calFirstPoint.y, 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2.5
      ctx.stroke()
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(calFirstPoint.x, calFirstPoint.y, 16, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // Anchor points on top
    for (let i = 0; i < tocke.length; i++) {
      drawAnchorPoint(ctx, tocke[i], i, tocke.length)
    }

    // === LIVE OVERLAYS (AR-OVERLAY) ===

    // Live measure line: MEASURE mode, first point set, cursor moving (mouse hover)
    if (mode === 'MEASURE' && measureFirstPoint && liveCursor) {
      const dPx = dist(measureFirstPoint, liveCursor)
      if (dPx > 3) {
        const dMm = kalibracija ? dPx / kalibracija.pixelsPerMm : 0
        ctx.save()
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.75)'
        ctx.lineWidth = 2
        ctx.setLineDash([6, 4])
        ctx.beginPath()
        ctx.moveTo(measureFirstPoint.x, measureFirstPoint.y)
        ctx.lineTo(liveCursor.x, liveCursor.y)
        ctx.stroke()
        ctx.setLineDash([])
        // Label at midpoint
        const mx = (measureFirstPoint.x + liveCursor.x) / 2
        const my = (measureFirstPoint.y + liveCursor.y) / 2
        const label = kalibracija ? formatDistance(dMm) : `${Math.round(dPx)} px`
        ctx.font = 'bold 12px ui-sans-serif, system-ui, sans-serif'
        const tw = ctx.measureText(label).width + 12
        ctx.fillStyle = 'rgba(16, 185, 129, 0.95)'
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath()
          ctx.roundRect(mx - tw / 2, my - 10, tw, 20, 4)
          ctx.fill()
        } else {
          ctx.fillRect(mx - tw / 2, my - 10, tw, 20)
        }
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, mx, my)
        ctx.restore()
      }
    }

    // Drag distance line: MOVE mode, dragging a point → nearest other point
    const dragIdx = draggingRef.current
    if (
      mode === 'MOVE' &&
      dragIdx !== null &&
      dragIdx >= 0 &&
      dragIdx < tocke.length &&
      tocke.length >= 2
    ) {
      const dragged = tocke[dragIdx]
      let nearestIdx = -1
      let nearestD = Infinity
      for (let i = 0; i < tocke.length; i++) {
        if (i === dragIdx) continue
        const d = dist(dragged, tocke[i])
        if (d < nearestD) {
          nearestD = d
          nearestIdx = i
        }
      }
      if (nearestIdx !== -1 && nearestD > 1) {
        const other = tocke[nearestIdx]
        const dMm = kalibracija ? nearestD / kalibracija.pixelsPerMm : 0
        ctx.save()
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)'
        ctx.lineWidth = 2
        ctx.setLineDash([4, 3])
        ctx.beginPath()
        ctx.moveTo(dragged.x, dragged.y)
        ctx.lineTo(other.x, other.y)
        ctx.stroke()
        ctx.setLineDash([])
        const mx = (dragged.x + other.x) / 2
        const my = (dragged.y + other.y) / 2
        const label = kalibracija ? formatDistance(dMm) : `${Math.round(nearestD)} px`
        ctx.font = 'bold 11px ui-sans-serif, system-ui, sans-serif'
        const tw = ctx.measureText(label).width + 10
        ctx.fillStyle = 'rgba(245, 158, 11, 0.95)'
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath()
          ctx.roundRect(mx - tw / 2, my - 9, tw, 18, 4)
          ctx.fill()
        } else {
          ctx.fillRect(mx - tw / 2, my - 9, tw, 18)
        }
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, mx, my)
        ctx.restore()
      }
    }
  }, [
    tocke,
    meritve,
    selectedProfil,
    kalibracija,
    mode,
    measureFirstPoint,
    calibrateActive,
    calFirstPoint,
    gridVisible,
    liveCursor,
  ])

  // --- Convert a pointer event to canvas CSS-pixel coordinates ---
  const getCanvasPoint = useCallback((e: React.PointerEvent<HTMLCanvasElement>): XY => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }, [])

  // --- Pointer down handler ---
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      // Tap-to-focus: kadar naprava podpira, takoj ostro tam, kamor kaže monter.
      focusAt(e.clientX, e.clientY)
      const p = getCanvasPoint(e)
      // Calibration has priority over modes
      if (calibrateActive) {
        if (!calFirstPoint) {
          setCalFirstPoint(p)
          toast({
            title: 'Umeritev',
            description: 'Sedaj tapnite drugo točko.',
          })
        } else {
          const pixelDist = dist(calFirstPoint, p)
          const realMm = parseFloat(calRealMm)
          if (!Number.isFinite(realMm) || realMm <= 0 || pixelDist < 5) {
            toast({
              title: 'Napaka',
              description: 'Neveljavna razdalja ali premajhen razmik med točkama.',
              variant: 'destructive',
            })
            setCalFirstPoint(null)
            setCalibrateActive(false)
            return
          }
          const ppm = pixelDist / realMm
          setKalibracija({
            pixelsPerMm: ppm,
            referencnaMm: realMm,
            createdAt: new Date().toISOString(),
          })
          setCalFirstPoint(null)
          setCalibrateActive(false)
          zibaj([20, 30, 20])
          toast({
            title: 'Umeritev končana',
            description: `1 mm = ${ppm.toFixed(3)} px (referenca ${realMm} mm).`,
          })
        }
        return
      }

      // MEASURE mode
      if (mode === 'MEASURE') {
        if (!measureFirstPoint) {
          setMeasureFirstPoint(p)
          setLiveCursor(p)
        } else {
          const pixelDist = dist(measureFirstPoint, p)
          const dolzinaMm = kalibracija
            ? pixelDist / kalibracija.pixelsPerMm
            : 0
          setPendingMeritev({
            a: measureFirstPoint,
            b: p,
            dolzinaMm,
          })
          setMeritevLabel(`Meritev ${meritve.length + 1}`)
          setLabelDialogOpen(true)
          setMeasureFirstPoint(null)
          zibaj(18)
        }
        return
      }

      // ADD mode
      if (mode === 'ADD') {
        setTocke((prev) => [
          ...prev,
          { x: p.x, y: p.y, label: String(prev.length + 1) },
        ])
        zibaj(12)
        return
      }

      // REMOVE mode
      if (mode === 'REMOVE') {
        setTocke((prev) => {
          const idx = findNearestPoint(prev, p)
          if (idx === -1) return prev
          const next = prev.filter((_, i) => i !== idx)
          // Re-number labels
          return next.map((t, i) => ({ ...t, label: String(i + 1) }))
        })
        zibaj(10)
        return
      }

      // MOVE mode — start drag if near an existing point
      if (mode === 'MOVE') {
        const idx = findNearestPoint(tocke, p)
        if (idx !== -1) {
          draggingRef.current = idx
          try {
            canvasRef.current?.setPointerCapture(e.pointerId)
          } catch {
            // ignore
          }
        }
      }
    },
    [
      calibrateActive,
      calFirstPoint,
      calRealMm,
      mode,
      measureFirstPoint,
      meritve.length,
      kalibracija,
      tocke,
      getCanvasPoint,
      focusAt,
      toast,
    ],
  )

  // --- Pointer move handler (for MOVE mode drag + live cursor) ---
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const p = getCanvasPoint(e)
      // Live cursor for measure mode (mouse hover updates distance live)
      if (mode === 'MEASURE' && measureFirstPoint) {
        setLiveCursor(p)
      }
      // Dragging a point
      if (draggingRef.current !== null) {
        setTocke((prev) => {
          const idx = draggingRef.current
          if (idx === null) return prev
          const next = [...prev]
          next[idx] = { ...next[idx], x: p.x, y: p.y }
          return next
        })
      }
    },
    [getCanvasPoint, mode, measureFirstPoint],
  )

  // --- Pointer up / cancel: end drag + clear live cursor ---
  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (draggingRef.current !== null) {
        try {
          canvasRef.current?.releasePointerCapture(e.pointerId)
        } catch {
          // ignore
        }
        draggingRef.current = null
      }
      setLiveCursor(null)
    },
    [],
  )

  // --- Open calibrate dialog ---
  const openCalibrate = useCallback(() => {
    setCalFirstPoint(null)
    setCalibrateActive(false)
    setCalibrateDialogOpen(true)
  }, [])

  // --- Confirm calibrate dialog → enter "tap two points" mode ---
  const confirmCalibrateStart = useCallback(() => {
    const mm = parseFloat(calRealMm)
    if (!Number.isFinite(mm) || mm <= 0) {
      toast({
        title: 'Napaka',
        description: 'Vnesite veljavno razdaljo v mm.',
        variant: 'destructive',
      })
      return
    }
    setCalibrateDialogOpen(false)
    setCalibrateActive(true)
    setCalFirstPoint(null)
    toast({
      title: 'Umeritev',
      description: 'Tapnite prvo točko na znani razdalji.',
    })
  }, [calRealMm, toast])

  // --- Cancel calibration ---
  const cancelCalibrate = useCallback(() => {
    setCalibrateActive(false)
    setCalFirstPoint(null)
  }, [])

  // --- Confirm measurement label dialog ---
  const confirmMeritev = useCallback(() => {
    if (!pendingMeritev) return
    const finalLabel = meritevLabel.trim() || `Meritev ${meritve.length + 1}`
    setMeritve((prev) => [
      ...prev,
      {
        id: makeId(),
        a: pendingMeritev.a,
        b: pendingMeritev.b,
        dolzinaMm: pendingMeritev.dolzinaMm,
        oznaka: finalLabel,
      },
    ])
    setPendingMeritev(null)
    setMeritevLabel('')
    setLabelDialogOpen(false)
    zibaj([25, 25, 25])
    toast({
      title: 'Meritev shranjena',
      description: `${finalLabel}: ${formatDistance(pendingMeritev.dolzinaMm)}`,
    })
  }, [pendingMeritev, meritevLabel, meritve.length, toast])

  // --- Undo zadnjega dejanja (v teku → meritev → točka) ---
  const undoLast = useCallback(() => {
    if (measureFirstPoint) {
      setMeasureFirstPoint(null)
      zibaj(8)
      return
    }
    if (calFirstPoint) {
      setCalFirstPoint(null)
      return
    }
    if (meritve.length > 0) {
      setMeritve((prev) => prev.slice(0, -1))
      zibaj(15)
      toast({ title: 'Razveljavljeno', description: 'Zadnja meritev odstranjena.' })
      return
    }
    if (tocke.length > 0) {
      setTocke((prev) =>
        prev.slice(0, -1).map((t, i) => ({ ...t, label: String(i + 1) })),
      )
      zibaj(15)
      toast({ title: 'Razveljavljeno', description: 'Zadnja točka odstranjena.' })
    }
  }, [measureFirstPoint, calFirstPoint, meritve.length, tocke.length, toast])

  // --- Cancel measurement label dialog ---
  const cancelMeritev = useCallback(() => {
    setPendingMeritev(null)
    setMeritevLabel('')
    setLabelDialogOpen(false)
  }, [])

  // --- Clear all points ---
  const clearAll = useCallback(() => {
    setTocke([])
    setMeritve([])
    setMeasureFirstPoint(null)
    toast({ title: 'Počiščeno', description: 'Vse točke in meritve so odstranjene.' })
  }, [])

  // --- Reset calibration ---
  const resetCalibration = useCallback(() => {
    setKalibracija(null)
    setCalibrateActive(false)
    setCalFirstPoint(null)
    toast({ title: 'Umeritev ponastavljena' })
  }, [])

  // --- Export to calculator (AR-OVERLAY) ---
  // Save current auto-calc to localStorage so the Kalkulator tab can pick it up
  const exportToCalculator = useCallback(() => {
    if (!autoCalc) return
    try {
      const payload = {
        dolzinaMm: autoCalc.dolzinaMm,
        visinaMm: autoCalc.visinaMm,
        profilId: selectedProfilId,
        profilSifra: autoCalc.profil.sifra,
        balusterCount: autoCalc.balusterCount,
        postCount: autoCalc.postCount,
        totalLinearMeters: autoCalc.totalLinearMeters,
        cenaMateriala: autoCalc.cenaMateriala,
        cenaZDDV: autoCalc.cenaZDDV,
        exportedAt: new Date().toISOString(),
      }
      localStorage.setItem('roksal_ar_calc_export', JSON.stringify(payload))
      toast({
        title: 'Preneseno',
        description: 'Podatki preneseni v kalkulator.',
      })
    } catch {
      toast({
        title: 'Napaka',
        description: 'Prenos v kalkulator ni uspel.',
        variant: 'destructive',
      })
    }
  }, [autoCalc, selectedProfilId, toast])

  // --- Fetch snapshots for history sheet ---
  const fetchSnapshots = useCallback(async () => {
    setSnapshotsLoading(true)
    try {
      const res = await fetch(`/api/ar-snapshots?projectId=${encodeURIComponent(projectId)}`)
      if (!res.ok) throw new Error('fetch failed')
      const data: ArSnapshot[] = await res.json()
      setSnapshots(data)
    } catch {
      toast({
        title: 'Napaka',
        description: 'Posnetkov ni mogoče naložiti.',
        variant: 'destructive',
      })
    } finally {
      setSnapshotsLoading(false)
    }
  }, [projectId, toast])

  // --- Open history sheet ---
  const openHistory = useCallback(() => {
    setHistoryOpen(true)
    void fetchSnapshots()
  }, [fetchSnapshots])

  // --- Delete a snapshot ---
  const deleteSnapshot = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/ar-snapshots?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        })
        if (!res.ok) throw new Error('delete failed')
        setSnapshots((prev) => prev.filter((s) => s.id !== id))
        toast({ title: 'Posnetek izbrisan' })
      } catch {
        toast({
          title: 'Napaka',
          description: 'Posnetka ni mogoče izbrisati.',
          variant: 'destructive',
        })
      }
    },
    [toast],
  )

  // --- Zajem čistega kadra za AI analizo (brez overlayja, maks. 1024 px) ---
  const captureFrameForAI = useCallback((): string | null => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) return null
    const maxW = 1024
    const scale = Math.min(1, maxW / video.videoWidth)
    const w = Math.round(video.videoWidth * scale)
    const h = Math.round(video.videoHeight * scale)
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, w, h)
    return c.toDataURL('image/jpeg', 0.85)
  }, [])

  // --- AI analiza fotografije ograje → /api/ar/analyze (VLM) ---
  const handleAiAnalyze = useCallback(async () => {
    const image = captureFrameForAI()
    if (!image) {
      toast({
        title: 'Kamera ni pripravljena',
        description: 'Počakajte trenutek in poskusite znova.',
        variant: 'destructive',
      })
      return
    }
    setAiAnalyzing(true)
    try {
      const res = await fetch('/api/ar/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, projectId }),
      })
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; analiza?: AiAnaliza; error?: string }
        | null
      if (!res.ok || !data?.ok || !data.analiza) {
        throw new Error(data?.error || 'Analiza ni uspela.')
      }
      setAiAnaliza(data.analiza)
      setAiSheetOpen(true)
      zibaj([20, 40, 20])
    } catch (err) {
      toast({
        title: 'AI analiza ni uspela',
        description: (err as Error).message,
        variant: 'destructive',
      })
    } finally {
      setAiAnalyzing(false)
    }
  }, [captureFrameForAI, projectId, toast])

  // --- Uporabi AI priporočila: samodejno izberi najbolj podoben profil iz kataloga ---
  const applyAiSuggestions = useCallback(() => {
    if (!aiAnaliza) return
    const tip = aiAnaliza.tipOgraje.toLowerCase()
    const rules: Array<{ re: RegExp; tag: string }> = [
      { re: /inox|nerjave/, tag: 'inox' },
      { re: /steklo/, tag: 'steklo' },
      { re: /alu|aluminij/, tag: 'alu' },
      { re: /wpc/, tag: 'wpc' },
    ]
    const rule = rules.find((r) => r.re.test(tip))
    const match = rule
      ? profili.find((p) => p.kategorija.toLowerCase().includes(rule.tag))
      : undefined
    if (match) {
      setSelectedProfilId(match.id)
      toast({
        title: 'Priporočilo uporabljeno',
        description: `Izbran profil: ${match.naziv}`,
      })
      zibaj(20)
    } else {
      toast({
        title: 'Podobnega profila ni v katalogu',
        description: `AI predlog: ${aiAnaliza.tipOgraje} — izberite ročno.`,
      })
    }
  }, [aiAnaliza, profili, toast])

  // --- Capture composite (video frame + canvas overlay) → POST ---
  const handleCapture = useCallback(async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) {
      toast({
        title: 'Napaka',
        description: 'Kamera ali platno ni na voljo.',
        variant: 'destructive',
      })
      return
    }
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      toast({
        title: 'Kamera ni pripravljena',
        description: 'Počakajte, da se video naloži.',
        variant: 'destructive',
      })
      return
    }
    if (tocke.length === 0) {
      toast({
        title: 'Brez točk',
        description: 'Dodajte vsaj eno točko pred zajem.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      // Composite at displayed canvas size (CSS pixels)
      const rect = canvas.getBoundingClientRect()
      const cw = Math.max(1, Math.round(rect.width))
      const ch = Math.max(1, Math.round(rect.height))
      const comp = document.createElement('canvas')
      comp.width = cw
      comp.height = ch
      const cctx = comp.getContext('2d')
      if (!cctx) throw new Error('no 2d context')

      // Background (in case video frame is transparent)
      cctx.fillStyle = '#000000'
      cctx.fillRect(0, 0, cw, ch)

      // Draw video frame with object-cover semantics
      const vw = video.videoWidth
      const vh = video.videoHeight
      const scale = Math.max(cw / vw, ch / vh)
      const scaledW = vw * scale
      const scaledH = vh * scale
      const offsetX = (cw - scaledW) / 2
      const offsetY = (ch - scaledH) / 2
      cctx.drawImage(video, 0, 0, vw, vh, offsetX, offsetY, scaledW, scaledH)

      // Draw overlay canvas (canvas internal px scaled down to cw×ch)
      cctx.drawImage(canvas, 0, 0, cw, ch)

      const dataUrl = comp.toDataURL('image/png')

      // Build payload
      const payload: {
        projectId: string
        profilId: string | null
        imageUrl: string
        tocke: Tocka[]
        meritve: Meritev[]
        kalibracija: Kalibracija | null
        opombe: string | null
      } = {
        projectId,
        profilId: selectedProfilId,
        imageUrl: dataUrl,
        tocke,
        meritve,
        kalibracija,
        // AI analiza se shrani kot opomba — pride prav pri pisanju ponudbe.
        opombe: aiAnaliza
          ? `AI: ${aiAnaliza.tipOgraje}; ${aiAnaliza.stanje}` +
            (aiAnaliza.ovire && aiAnaliza.ovire !== 'ni vidnih ovir'
              ? `; ovire: ${aiAnaliza.ovire}`
              : '')
          : null,
      }

      const res = await fetch('/api/ar-snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('save failed')
      zibaj(20)
      toast({
        title: 'Posnetek shranjen',
        description: `${tocke.length} točk · ${meritve.length} meritev`,
      })
    } catch (err) {
      const e = err as Error
      toast({
        title: 'Napaka pri shranjevanju',
        description: e.message || 'Neznana napaka.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }, [projectId, selectedProfilId, tocke, meritve, kalibracija, aiAnaliza, toast])

  // --- Retry camera (after error) ---
  const retryCamera = useCallback(() => {
    setCameraError(null)
    setStreamReady(false)
    // Stop any old stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    // Trigger re-init by reloading video element
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    // The camera init effect runs once on mount, so to retry we reload the page
    // — but to avoid that, we manually re-request here:
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })
        streamRef.current = stream
        setupTrack(stream)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setStreamReady(true)
        setCameraError(null)
      } catch (err) {
        const e = err as DOMException
        if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
          setCameraError(
            'Dostop do kamere je zavrnjen. V nastavitvah brskalnika omogočite kamero in poskusite znova.',
          )
        } else if (e.name === 'NotFoundError' || e.name === 'OverconstrainedError') {
          setCameraError('Kamera ni najdena. Preverite, da je priklopljena in aktivna.')
        } else {
          setCameraError(`Napaka kamere: ${e.message || e.name}`)
        }
      }
    })()
  }, [])

  // --- Status banner text ---
  const statusText = useMemo(() => {
    if (calibrateActive) {
      return calFirstPoint
        ? 'Umeritev: tapnite drugo točko'
        : 'Umeritev: tapnite prvo točko'
    }
    switch (mode) {
      case 'ADD':
        return 'Tapnite za dodajanje stebra'
      case 'REMOVE':
        return 'Tapnite steber za izbris'
      case 'MOVE':
        return 'Povlecite steber za premik'
      case 'MEASURE':
        return measureFirstPoint
          ? 'Tapnite drugo točko za meritev'
          : 'Tapnite prvo točko za meritev'
      default:
        return ''
    }
  }, [mode, measureFirstPoint, calibrateActive, calFirstPoint])

  // --- Mode toggle button class ---
  const modeButtonClass = useCallback(
    (m: Mode) =>
      cn(
        'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-md text-[11px] font-medium transition-colors',
        mode === m && !calibrateActive
          ? 'bg-roksal-navy text-white'
          : 'bg-white/10 text-white hover:bg-white/20',
      ),
    [mode, calibrateActive],
  )

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col select-none">
      {/* === TOP BAR === */}
      <header className="bg-roksal-navy/95 backdrop-blur-sm px-3 py-2 flex items-center gap-2 border-b border-white/10">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10 shrink-0"
          onClick={onClose}
          aria-label="Zapri AR"
        >
          <X className="h-5 w-5" />
        </Button>

        <div className="flex-1 min-w-0">
          <Select
            value={selectedProfilId ?? undefined}
            onValueChange={(v) => setSelectedProfilId(v)}
          >
            <SelectTrigger
              className="h-9 bg-white/10 border-white/20 text-white text-xs w-full max-w-[260px]"
              aria-label="Izberi profil"
            >
              <SelectValue
                placeholder={
                  profiliLoading ? 'Nalagam profile…' : 'Izberi profil'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {profili.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="flex flex-col">
                    <span className="font-medium">{p.naziv}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {p.kategorija} · {p.visinaMm} mm
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Grid toggle (AR-OVERLAY) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'shrink-0',
                gridVisible
                  ? 'text-roksal-amber hover:bg-white/10'
                  : 'text-white hover:bg-white/10',
              )}
              onClick={() => setGridVisible((v) => !v)}
              aria-label="Mreža"
            >
              <Grid3x3 className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {gridVisible ? 'Skrij mrežo' : 'Prikaži mrežo'}
          </TooltipContent>
        </Tooltip>

        {/* Torch (bliskavica) — samo kadar naprava podpira */}
        {torchSupported && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  'shrink-0',
                  torchOn
                    ? 'text-roksal-amber hover:bg-white/10'
                    : 'text-white hover:bg-white/10',
                )}
                onClick={() => void applyTorch(!torchOn)}
                aria-label="Bliskavica"
                aria-pressed={torchOn}
              >
                <Zap className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {torchOn ? 'Ugasni bliskavico' : 'Prižgi bliskavico (temna scena)'}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Undo — hitro razveljavi zadnjo točko/meritev */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 shrink-0"
              onClick={undoLast}
              aria-label="Razveljavi"
            >
              <Undo2 className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Razveljavi zadnje dejanje</TooltipContent>
        </Tooltip>

        {/* Calibration button + status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'shrink-0',
                kalibracija
                  ? 'text-roksal-green hover:bg-white/10'
                  : 'text-white hover:bg-white/10',
              )}
              onClick={kalibracija ? resetCalibration : openCalibrate}
              aria-label="Umeri"
            >
              <Crosshair className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {kalibracija
              ? `Umerjeno (${kalibracija.pixelsPerMm.toFixed(3)} px/mm) — klik za ponastavitev`
              : 'Umeri kamero'}
          </TooltipContent>
        </Tooltip>

        {/* AI analiza fotografije ograje */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'shrink-0',
                aiAnaliza
                  ? 'text-roksal-amber hover:bg-white/10'
                  : 'text-white hover:bg-white/10',
              )}
              onClick={() => void handleAiAnalyze()}
              disabled={aiAnalyzing || !streamReady}
              aria-label="AI analiza ograje"
            >
              {aiAnalyzing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            AI analiza fotografije (tip, stanje, mere)
          </TooltipContent>
        </Tooltip>

        {/* Capture button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 shrink-0"
              onClick={handleCapture}
              disabled={saving || tocke.length === 0}
              aria-label="Posnetek"
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Camera className="h-5 w-5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Zajemi posnetek</TooltipContent>
        </Tooltip>

        {/* History button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 shrink-0"
              onClick={openHistory}
              aria-label="Zgodovina"
            >
              <History className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Zgodovina posnetkov</TooltipContent>
        </Tooltip>
      </header>

      {/* Calibration / mode status badge (top-right of video) */}
      <div className="absolute top-16 right-3 z-10 flex flex-col items-end gap-1.5 pointer-events-none">
        {lowLight && (
          <Badge className="bg-amber-600/90 text-white border-transparent shadow-md animate-pulse">
            <SunDim className="h-3 w-3" />
            Temno — prižgi bliskavico
          </Badge>
        )}
        {steady && (
          <Badge className="bg-emerald-600/90 text-white border-transparent shadow-md">
            <Check className="h-3 w-3" />
            Stabilno — zajemi zdaj
          </Badge>
        )}
        {kalibracija && (
          <Badge className="bg-roksal-green/90 text-white border-transparent shadow-md">
            <Check className="h-3 w-3" />
            {kalibracija.pixelsPerMm.toFixed(3)} px/mm
          </Badge>
        )}
        {selectedProfil && (
          <Badge className="bg-roksal-navy/90 text-white border-transparent shadow-md">
            {selectedProfil.kategorija}
          </Badge>
        )}
        {tocke.length > 0 && (
          <Badge className="bg-roksal-amber/90 text-white border-transparent shadow-md">
            {tocke.length} {tocke.length === 1 ? 'točka' : tocke.length < 5 ? 'točke' : 'točk'}
          </Badge>
        )}
        {meritve.length > 0 && (
          <Badge className="bg-roksal-green/90 text-white border-transparent shadow-md">
            <Ruler className="h-3 w-3" />
            {meritve.length}
          </Badge>
        )}
      </div>

      {/* === VIDEO + CANVAS === */}
      <div ref={containerRef} className="relative flex-1 overflow-hidden bg-black">
        {cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-roksal-navy">
            <AlertTriangle className="h-12 w-12 text-roksal-amber mb-3" />
            <p className="text-white text-base font-semibold mb-2">Kamera ni na voljo</p>
            <p className="text-white/70 text-sm max-w-xs mb-4">{cameraError}</p>
            <Button
              type="button"
              variant="default"
              className="bg-roksal-amber text-white hover:bg-roksal-amber/90"
              onClick={retryCamera}
            >
              <RotateCcw className="h-4 w-4" />
              Poskusi znova
            </Button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
              style={{ touchAction: 'none' }}
            />

            {/* Empty-state hint */}
            {tocke.length === 0 && !calibrateActive && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-roksal-navy/80 text-white/90 text-sm px-4 py-2.5 rounded-lg backdrop-blur-sm text-center max-w-[280px]">
                  <Plus className="h-5 w-5 mx-auto mb-1 text-roksal-amber" />
                  Tapnite na tla za dodajanje stebrov ograje
                </div>
              </div>
            )}

            {/* === HUD: real-time dimensions (AR-OVERLAY) === */}
            <div className="absolute top-3 left-3 z-10 pointer-events-none">
              <div className="bg-roksal-navy/90 text-white rounded-lg p-2 text-[10px] max-w-[180px] backdrop-blur-sm shadow-md">
                <div className="flex items-center gap-1 mb-1 pb-1 border-b border-white/15">
                  <Ruler className="h-3 w-3 text-roksal-amber" />
                  <span className="font-semibold uppercase tracking-wide">Meritve</span>
                </div>
                <div className="space-y-0.5">
                  <div className="flex justify-between gap-2">
                    <span className="text-white/55">Širina</span>
                    <span className="font-bold text-roksal-amber">
                      {realtimeStats.sirinaMm !== null
                        ? formatDistance(realtimeStats.sirinaMm)
                        : 'N/A — umeri'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-white/55">Višina</span>
                    <span className="font-bold text-roksal-amber">
                      {realtimeStats.visinaMm !== null
                        ? `${realtimeStats.visinaMm} mm`
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-white/55">Dolžina</span>
                    <span className="font-bold text-roksal-amber">
                      {realtimeStats.kalibrirano && realtimeStats.dolzinaMm > 0
                        ? formatDistance(realtimeStats.dolzinaMm)
                        : 'N/A — umeri'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-white/55">Površina</span>
                    <span className="font-bold text-roksal-amber">
                      {realtimeStats.povrsinaM2 > 0
                        ? `${realtimeStats.povrsinaM2.toFixed(2)} m²`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-white/55">Št. točk</span>
                    <span className="font-bold text-white">{realtimeStats.stTock}</span>
                  </div>
                  <div className="flex justify-between gap-2 pt-0.5 border-t border-white/10">
                    <span className="text-white/55">Kalibracija</span>
                    {realtimeStats.kalibrirano && realtimeStats.ppm ? (
                      <span className="font-semibold text-roksal-green flex items-center gap-0.5">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        {realtimeStats.ppm.toFixed(2)} px/mm
                      </span>
                    ) : (
                      <span className="font-semibold text-roksal-amber">✗ ni umerjeno</span>
                    )}
                  </div>
                  {/* Live cursor distance during MEASURE mode */}
                  {mode === 'MEASURE' && measureFirstPoint && liveCursor && kalibracija && (
                    <div className="flex justify-between gap-2 pt-0.5 border-t border-roksal-green/30">
                      <span className="text-white/55">→ kurzor</span>
                      <span className="font-bold text-roksal-green">
                        {formatDistance(
                          dist(measureFirstPoint, liveCursor) / kalibracija.pixelsPerMm,
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Status banner — moved above calc panel */}
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <div className="bg-roksal-navy/85 text-white text-xs font-medium px-3 py-1.5 rounded-full backdrop-blur-sm shadow-md whitespace-nowrap">
                {statusText}
              </div>
            </div>

            {/* === AUTO CALC PANEL (AR-OVERLAY) === */}
            <div className="absolute bottom-3 left-3 right-3 z-20">
              <div className="bg-roksal-navy/95 text-white rounded-lg shadow-lg backdrop-blur-sm overflow-hidden">
                {/* Header — always visible, toggles expansion */}
                <button
                  type="button"
                  onClick={() => setCalcPanelOpen((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
                  aria-label={calcPanelOpen ? 'Skrči izračun' : 'Razširi izračun'}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Calculator className="h-4 w-4 text-roksal-amber shrink-0" />
                    <span className="text-xs font-semibold shrink-0">Izračun</span>
                    <span className="text-[10px] text-white/70 truncate">
                      {autoCalc
                        ? `${autoCalc.balusterCount} palic · ${formatEUR(autoCalc.cenaMateriala)}`
                        : '—'}
                    </span>
                  </div>
                  {calcPanelOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronUp className="h-4 w-4 shrink-0" />
                  )}
                </button>

                {/* Expanded content */}
                {calcPanelOpen && (
                  <div className="px-2.5 pb-2.5 pt-0.5">
                    {/* Warnings */}
                    {!kalibracija && (
                      <div className="mb-1.5 text-[10px] bg-roksal-amber/15 border border-roksal-amber/30 text-roksal-amber rounded px-2 py-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span>Najprej umeri referenco za natančne mere</span>
                      </div>
                    )}
                    {!selectedProfil && (
                      <div className="mb-1.5 text-[10px] bg-roksal-amber/15 border border-roksal-amber/30 text-roksal-amber rounded px-2 py-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span>Izberi profil</span>
                      </div>
                    )}
                    {tocke.length < 2 && (
                      <div className="mb-1.5 text-[10px] bg-white/5 border border-white/10 text-white/70 rounded px-2 py-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span>Dodaj vsaj 2 točki za izračun</span>
                      </div>
                    )}

                    {/* Stat grid */}
                    {autoCalc ? (
                      <>
                        <div className="grid grid-cols-2 gap-1">
                          <div className="bg-white/5 rounded px-2 py-1">
                            <div className="text-[9px] text-white/50 uppercase tracking-wide">Št. palic</div>
                            <div className="text-sm font-bold text-roksal-amber">{autoCalc.balusterCount}</div>
                          </div>
                          <div className="bg-white/5 rounded px-2 py-1">
                            <div className="text-[9px] text-white/50 uppercase tracking-wide">Razmik</div>
                            <div className="text-sm font-bold text-roksal-amber">{autoCalc.actualGapMm}mm</div>
                          </div>
                          <div className="bg-white/5 rounded px-2 py-1">
                            <div className="text-[9px] text-white/50 uppercase tracking-wide">Št. stebrov</div>
                            <div className="text-sm font-bold text-roksal-amber">{autoCalc.postCount}</div>
                          </div>
                          <div className="bg-white/5 rounded px-2 py-1">
                            <div className="text-[9px] text-white/50 uppercase tracking-wide">Linearni</div>
                            <div className="text-sm font-bold text-roksal-amber">{autoCalc.totalLinearMeters.toFixed(1)}m</div>
                          </div>
                          <div className="bg-white/5 rounded px-2 py-1">
                            <div className="text-[9px] text-white/50 uppercase tracking-wide">Vijaki</div>
                            <div className="text-sm font-bold text-roksal-amber">{autoCalc.screwCount}</div>
                          </div>
                          <div className="bg-white/5 rounded px-2 py-1">
                            <div className="text-[9px] text-white/50 uppercase tracking-wide">Sidra</div>
                            <div className="text-sm font-bold text-roksal-amber">{autoCalc.anchorCount}</div>
                          </div>
                          <div className="bg-white/5 rounded px-2 py-1">
                            <div className="text-[9px] text-white/50 uppercase tracking-wide">Material</div>
                            <div className="text-sm font-bold text-white">{formatEUR(autoCalc.cenaMateriala)}</div>
                          </div>
                          <div className="bg-roksal-amber/15 border border-roksal-amber/30 rounded px-2 py-1">
                            <div className="text-[9px] text-roksal-amber/70 uppercase tracking-wide">Z DDV</div>
                            <div className="text-sm font-bold text-roksal-amber">{formatEUR(autoCalc.cenaZDDV)}</div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="w-full mt-2 bg-roksal-amber text-white hover:bg-roksal-amber/90 text-xs h-8"
                          onClick={exportToCalculator}
                        >
                          Dodaj v kalkulator
                        </Button>
                      </>
                    ) : (
                      <div className="text-[10px] text-white/50 text-center py-2">
                        Podatki bodo izračunani, ko dodate točke in umerite referenco.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* === MODE BAR (bottom) === */}
      <footer className="bg-roksal-navy/95 backdrop-blur-sm border-t border-white/10 px-2 py-2">
        {/* Zoom drsnik — samo kadar kamera podpira zoom */}
        {zoomCap && (
          <div className="flex items-center gap-2 px-2 pb-2">
            <ZoomIn className="h-4 w-4 shrink-0 text-white/70" aria-hidden />
            <input
              type="range"
              min={zoomCap.min}
              max={zoomCap.max}
              step={zoomCap.step}
              value={zoomValue}
              onChange={(e) => {
                const v = Number(e.target.value)
                setZoomValue(v)
                void applyZoom(v)
              }}
              className="flex-1 accent-amber-500"
              aria-label="Zoom kamere"
            />
            <span className="w-10 text-right text-[10px] text-white/70" aria-hidden>
              {zoomValue.toFixed(1)}×
            </span>
          </div>
        )}

        <div className="flex gap-1.5 mb-1.5">
          <Button
            type="button"
            variant="ghost"
            className={modeButtonClass('ADD')}
            onClick={() => {
              setMode('ADD')
              setMeasureFirstPoint(null)
            }}
            disabled={calibrateActive}
          >
            <Plus className="h-4 w-4" />
            Točke
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={modeButtonClass('REMOVE')}
            onClick={() => {
              setMode('REMOVE')
              setMeasureFirstPoint(null)
            }}
            disabled={calibrateActive || tocke.length === 0}
          >
            <Trash2 className="h-4 w-4" />
            Izbriši
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={modeButtonClass('MOVE')}
            onClick={() => {
              setMode('MOVE')
              setMeasureFirstPoint(null)
            }}
            disabled={calibrateActive || tocke.length === 0}
          >
            <Move className="h-4 w-4" />
            Premakni
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={modeButtonClass('MEASURE')}
            onClick={() => {
              setMode('MEASURE')
              setMeasureFirstPoint(null)
            }}
            disabled={calibrateActive}
          >
            <Ruler className="h-4 w-4" />
            Meri
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white text-xs flex-1"
            onClick={clearAll}
            disabled={tocke.length === 0 && meritve.length === 0}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Počisti vse
          </Button>
          {calibrateActive && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="bg-roksal-amber/20 border-roksal-amber/40 text-roksal-amber hover:bg-roksal-amber/30 text-xs"
              onClick={cancelCalibrate}
            >
              Prekliči umeritev
            </Button>
          )}
          {mode === 'MEASURE' && measureFirstPoint && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="bg-roksal-green/20 border-roksal-green/40 text-roksal-green hover:bg-roksal-green/30 text-xs"
              onClick={() => setMeasureFirstPoint(null)}
            >
              Prekliči meritev
            </Button>
          )}
        </div>
      </footer>

      {/* === CALIBRATION DIALOG === */}
      <Dialog
        open={calibrateDialogOpen}
        onOpenChange={(o) => {
          setCalibrateDialogOpen(o)
          if (!o) {
            setCalibrateActive(false)
            setCalFirstPoint(null)
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-roksal-navy">
              <Crosshair className="h-5 w-5 text-roksal-amber" />
              Umeritev kamere
            </DialogTitle>
            <DialogDescription>
              Vnesite znano razdaljo v milimetrih (npr. širina ploščice 600 mm),
              nato tapnite dve točki na zaslonu, ki ustrezata tej razdalji.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="cal-mm">Razdalja (mm)</Label>
              <Input
                id="cal-mm"
                type="number"
                inputMode="numeric"
                min={1}
                value={calRealMm}
                onChange={(e) => setCalRealMm(e.target.value)}
                placeholder="npr. 600"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Namig: uporabite rob ploščice, širino vrat ali drugo znano merilo na lokaciji.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCalibrateDialogOpen(false)}
            >
              Prekliči
            </Button>
            <Button
              type="button"
              className="bg-roksal-amber text-white hover:bg-roksal-amber/90"
              onClick={confirmCalibrateStart}
            >
              <Crosshair className="h-4 w-4" />
              Izberi 2 točki
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === MEASUREMENT LABEL DIALOG === */}
      <Dialog open={labelDialogOpen} onOpenChange={(o) => { if (!o) cancelMeritev() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-roksal-navy">
              <Ruler className="h-5 w-5 text-roksal-green" />
              Označi meritev
            </DialogTitle>
            <DialogDescription>
              {pendingMeritev && (
                <>
                  Izmerjena razdalja:{' '}
                  <span className="font-semibold text-roksal-navy">
                    {formatDistance(pendingMeritev.dolzinaMm)}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="mer-label">Oznaka meritve</Label>
              <Input
                id="mer-label"
                value={meritevLabel}
                onChange={(e) => setMeritevLabel(e.target.value)}
                placeholder="npr. dolžina balkona"
                autoFocus
              />
            </div>
            {!kalibracija && (
              <p className="text-xs text-roksal-amber bg-roksal-amber/10 border border-roksal-amber/20 rounded-md p-2">
                Umeritev kamere ni aktivna — razdalja je samo orientacijska (0 mm).
                Najprej umerite kamero z gumbom za umeritev.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cancelMeritev}>
              Prekliči
            </Button>
            <Button
              type="button"
              className="bg-roksal-green text-white hover:bg-roksal-green/90"
              onClick={confirmMeritev}
            >
              <Check className="h-4 w-4" />
              Shrani
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === AI ANALIZA SHEET === */}
      <Sheet open={aiSheetOpen} onOpenChange={setAiSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="px-4 pt-5 pb-3 border-b">
            <SheetTitle className="flex items-center gap-2 text-roksal-navy">
              <Sparkles className="h-5 w-5 text-roksal-amber" />
              AI analiza ograje
            </SheetTitle>
            <SheetDescription>
              Samodejna ocena fotografije: tip, stanje in katere mere vzeti.
            </SheetDescription>
          </SheetHeader>
          {aiAnaliza && (
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {/* Tip + zaupanje */}
              <div className="flex items-center justify-between rounded-lg border border-roksal-amber/30 bg-roksal-amber/5 p-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Prepoznana ograja
                  </p>
                  <p className="text-sm font-bold text-roksal-navy">{aiAnaliza.tipOgraje}</p>
                </div>
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-[10px]',
                    aiAnaliza.zaupanje >= 0.7
                      ? 'bg-roksal-green/15 text-roksal-green'
                      : 'bg-amber-100 text-amber-700',
                  )}
                >
                  {Math.round(aiAnaliza.zaupanje * 100)} % gotovo
                </Badge>
              </div>

              <dl className="space-y-3 text-sm">
                {[
                  ['Stanje', aiAnaliza.stanje],
                  ['Material', aiAnaliza.material],
                  ['Predlog barve', aiAnaliza.predlaganaBarva],
                  ['Tip montaže', aiAnaliza.tipMontaze],
                  ['Ovire', aiAnaliza.ovire],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {label}
                    </dt>
                    <dd className="text-[13px] leading-relaxed text-roksal-navy">{value}</dd>
                  </div>
                ))}
              </dl>

              {/* Priporočene mere */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Priporočene mere
                </p>
                {aiAnaliza.priporoceneMere?.map((m, i) => (
                  <div
                    key={`${m.naziv}-${i}`}
                    className="rounded-lg border bg-white p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-roksal-navy">{m.naziv}</p>
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-[9px]',
                          m.prednost === 'visoka'
                            ? 'bg-roksal-amber/15 text-roksal-amber'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {m.prednost}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                      {m.opis}
                    </p>
                  </div>
                ))}
              </div>

              {aiAnaliza.opombe && (
                <div className="rounded-lg bg-roksal-navy/5 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Opombe za ponudbo
                  </p>
                  <p className="text-[12px] leading-relaxed text-roksal-navy">{aiAnaliza.opombe}</p>
                </div>
              )}

              <p className="text-[10px] text-muted-foreground leading-relaxed">
                AI ocena je pripomoček, ne zamenjava za merjenje na lokaciji. Mere vedno
                preverite s kalibriranim merjenjem.
              </p>
            </div>
          )}
          <div className="border-t px-4 py-3 flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setAiSheetOpen(false)}
            >
              Zapri
            </Button>
            <Button
              type="button"
              size="sm"
              className="flex-1 bg-roksal-amber text-white hover:bg-roksal-amber/90"
              onClick={applyAiSuggestions}
              disabled={!aiAnaliza}
            >
              <CheckCircle2 className="h-4 w-4" />
              Uporabi priporočila
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* === HISTORY SHEET === */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="px-4 pt-5 pb-3 border-b">
            <SheetTitle className="flex items-center gap-2 text-roksal-navy">
              <History className="h-5 w-5 text-roksal-amber" />
              Zgodovina AR posnetkov
            </SheetTitle>
            <SheetDescription>
              Shranjeni posnetki za ta projekt.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
            {snapshotsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-roksal-navy" />
              </div>
            ) : snapshots.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Camera className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Še ni shranjenih posnetkov.
                </p>
              </div>
            ) : (
              <div className="grid gap-2.5">
                {snapshots.map((s) => (
                  <SnapshotCard
                    key={s.id}
                    snapshot={s}
                    onDelete={() => deleteSnapshot(s.id)}
                  />
                ))}
              </div>
            )}
          </div>
          <Separator />
          <div className="p-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => void fetchSnapshots()}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Osveži
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ============================================================================
// SnapshotCard — subcomponent for history list
// ============================================================================

function SnapshotCard({
  snapshot,
  onDelete,
}: {
  snapshot: ArSnapshot
  onDelete: () => void
}) {
  const date = useMemo(() => {
    try {
      return new Date(snapshot.createdAt).toLocaleString('sl-SI', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return snapshot.createdAt
    }
  }, [snapshot.createdAt])

  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden card-hover">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left"
        aria-label="Razširi posnetek"
      >
        {/* Thumbnail */}
        <div className="relative w-full aspect-video bg-muted overflow-hidden">
          <img
            src={snapshot.imageUrl}
            alt="AR posnetek"
            className="w-full h-full object-cover"
          />
        </div>
      </button>
      <div className="p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-roksal-navy truncate">
              {snapshot.profil?.naziv ?? 'Brez profila'}
            </p>
            <p className="text-[10px] text-muted-foreground">{date}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-roksal-red hover:bg-roksal-red/10 shrink-0"
            onClick={onDelete}
            aria-label="Izbriši posnetek"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        {expanded && (
          <div className="mt-2 pt-2 border-t border-border text-[11px] text-muted-foreground space-y-0.5">
            <SnapshotMeta json={snapshot.tocke} label="Točke" />
            {snapshot.meritve && (
              <SnapshotMeta json={snapshot.meritve} label="Meritve" />
            )}
            {snapshot.kalibracija && (
              <SnapshotMeta json={snapshot.kalibracija} label="Kalibracija" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SnapshotMeta({ json, label }: { json: string; label: string }) {
  let count = 0
  try {
    const parsed = JSON.parse(json)
    if (Array.isArray(parsed)) count = parsed.length
    else if (parsed && typeof parsed === 'object') count = 1
  } catch {
    // ignore
  }
  return (
    <p>
      <span className="font-medium text-foreground">{label}:</span> {count}
    </p>
  )
}
