'use client'

/**
 * CV STUDIO (issues #10 + #11) — samostojen Computer Vision Studio.
 *
 * NAČELA (issue #10/#11 — ista kot Measurement SDK):
 *   - Computer Vision = PREDLOG/ZAZNAVA. Measurement/Geometry = VIR RESNICE.
 *     Končna meritev gre IZKLJUČNO prek obstoječe /api/measurement/confirm
 *     verige (Measurement → Geometry → BOM); CV je bil samo predlog.
 *   - Absolutne mm obstajajo SAMO ob referenčni meri (ni ugibanja).
 *   - Prazne zaznave = iskreno prazno stanje z guidance (ni izmišljevanja).
 *   - Fail-safe: ROČNO zavihek deluje BREZ kakršnegakoli CV rezultata
 *     (features: null, source: 'manual') — CV neuspeh ne blokira projekta.
 *
 * ZAVIHKI:
 *   - FOTO  — upload/drag&drop → POST /api/vision/scene → overlay + review
 *             zaznav + segment/kotniki/referenca + PWC predlog postavitve
 *             (POST /api/vision/placement) + potrditev prek confirm.
 *   - V ŽIVO— getUserMedia živi predogled (2D CV, frame-relative overlay),
 *             ročna ali samodejna (3 s throttle) analiza kadra, zajem → FOTO.
 *   - ROČNO — fail-safe brez CV: točke (referenca, spodnja/zgornja linija,
 *             stebri) + referenčna mera + potrditev (source 'manual').
 *
 * Overlay risanje/resize vzorec (ResizeObserver + devicePixelRatio) je
 * posnet iz measurement-studio.tsx (drawOverlay/startCamera/captureFrame) —
 * measurement-studio.tsx SAM Neurejen.
 *
 * Kontrakt: export function CvStudio({ projectId }: { projectId?: string | null })
 * Komponenta NE registrira lastnih zavihkov — vgradi jo page.tsx ('cvstudio').
 */

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import {
  Camera,
  CheckCircle2,
  Crosshair,
  Layers,
  Loader2,
  Package,
  Ruler,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  TriangleAlert,
  Undo2,
  Upload,
  Video,
  XCircle,
} from 'lucide-react'

// TYPE-only importi iz SDK (brez strežniških modulov v klient bundle-u)
import type { DeviceCapabilities } from '@/lib/cv-studio/capabilities'
import type {
  PlacementResult,
  ProjectionResult,
  SceneAnalysis,
  SceneElement,
  SceneElementType,
} from '@/lib/cv-studio/types'
import type { DetectedFeatures, MeasurementSession, NormPoint } from '@/lib/measurement'
import { detectDeviceCapabilities } from '@/lib/cv-studio/capabilities'

// ── Lokalni kontrakti API rut (lokalno tipizirano — NE strežniški uvoz) ──────

interface ProductDefinition {
  id: string
  family: string
  profile: string
  orientations: string[]
  board: { minGapMm: number; maxGapMm: number }
  rights: string
}

interface ProductsResponse {
  products: ProductDefinition[]
}

interface PlacementScale {
  mmPerUnitX: number
  mmPerUnitY: number
  reference: { p1: NormPoint; p2: NormPoint; knownMm: number; kind: string }
  referenceLengthUnits: number
}

interface PlacementResponse {
  placement: PlacementResult
  projection: ProjectionResult | null
  scale: PlacementScale | null
  scaleReason: string | null
  error?: string
  code?: string
  reason?: string
}

interface TakeoffPreview {
  boardCount: number
  boardsTotalLinearM: number
  postCount: number
  fieldSpanMm: number
  fenceHeightMm: number
  cutList: Array<{ index: number; cutMm: number }>
}

interface ConfirmResponse {
  session: MeasurementSession
  takeoffPreview: TakeoffPreview | null
  layout: {
    boardCount: number
    fieldSpanMm: number
    fenceWidthMm: number
    fenceHeightMm: number
    orientation: string
    warnings: string[]
  } | null
  savedMeasurementId: string | null
  error?: string
  code?: string
}

interface ConfirmRequestBody {
  sessionId: string
  source: 'automatic' | 'manual' | 'hybrid'
  features?: DetectedFeatures | null
  metrics?: SceneAnalysis['quality']['metrics'] | null
  manual?: { path: NormPoint[]; top: NormPoint[]; posts?: NormPoint[] }
  reference: { p1: NormPoint; p2: NormPoint; knownMm: number; kind: RefKind }
  manualCorrections: number
  confirmed: boolean
  projectId?: string
  geometry?: {
    productId: string
    orientation: 'horizontal' | 'vertical'
    gapMm: number
    postWidthMm: number
  }
}

type RefKind = 'user-known-measure' | 'roksal-marker' | 'known-object'
type ReviewState = 'accepted' | 'rejected'
type ManualSurfaceType = Extract<
  SceneElementType,
  'FLOOR' | 'GROUND' | 'WALL' | 'OPENING' | 'DOOR' | 'OTHER_SURFACE' | 'OBSTACLE'
>
type StudioTab = 'photo' | 'live' | 'manual'
type ClickMode = 'none' | 'ref' | 'bbox' | 'corners' | 'addpoint' | 'm-path' | 'm-top' | 'm-posts'
type ManualStep = 'ref' | 'path' | 'top' | 'posts'

// ── Pomožne konstante / čiste funkcije (brez naključja, brez ure) ────────────

const REF_KIND_OPTIONS: Array<{ value: RefKind; label: string }> = [
  { value: 'user-known-measure', label: 'Znana mera (uporabnik)' },
  { value: 'roksal-marker', label: 'Roksal marker' },
  { value: 'known-object', label: 'Znani objekt' },
]

const MANUAL_SURFACE_TYPES: Array<{ value: ManualSurfaceType; label: string }> = [
  { value: 'FLOOR', label: 'Tla' },
  { value: 'GROUND', label: 'Tla (zunaj)' },
  { value: 'WALL', label: 'Zid' },
  { value: 'OPENING', label: 'Otvor' },
  { value: 'DOOR', label: 'Vrata' },
  { value: 'OTHER_SURFACE', label: 'Druga površina' },
  { value: 'OBSTACLE', label: 'Ovira' },
]

const ELEMENT_LABELS: Record<SceneElementType, string> = {
  RAILING: 'Ograja (pas)',
  BALCONY_EDGE: 'Rob balkona',
  RAILING_POST: 'Steber ograje',
  STAIR: 'Stopnice (predel)',
  STAIR_EDGE: 'Stopniška linija',
  OBSTACLE: 'Ovira',
  FLOOR: 'Tla',
  GROUND: 'Tla (zunaj)',
  WALL: 'Zid',
  OPENING: 'Otvor',
  DOOR: 'Vrata',
  OTHER_SURFACE: 'Druga površina',
}

const STATE_BADGE: Record<string, { label: string; cls: string }> = {
  PROPOSED: { label: 'PREDLOG', cls: 'border-stone-300 bg-stone-100 text-stone-700' },
  NEEDS_CONFIRMATION: { label: 'POTRDITEV', cls: 'border-amber-300 bg-amber-100 text-amber-800' },
  UNKNOWN: { label: 'NEZNANO', cls: 'border-stone-300 bg-stone-100 text-stone-500' },
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

function parseDec(input: string): number | null {
  const raw = input.trim().replace(',', '.')
  if (!raw) return null
  const v = Number(raw)
  return Number.isFinite(v) ? v : null
}

function formatPct(v: number): string {
  return `${Math.round(v * 100)} %`
}

function uid(): string {
  const c: Crypto | undefined =
    typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/** Normalizirana točka iz kazalčnega dogodka glede na element. */
function pointFromEvent(e: { clientX: number; clientY: number }, el: HTMLElement): NormPoint | null {
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return {
    x: round4(clamp01((e.clientX - rect.left) / rect.width)),
    y: round4(clamp01((e.clientY - rect.top) / rect.height)),
  }
}

function distNorm(a: NormPoint, b: NormPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function pointToSegmentDist(p: NormPoint, a: NormPoint, b: NormPoint): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const len2 = abx * abx + aby * aby
  let t = len2 === 0 ? 0 : ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby))
}

/** Vstavi točko v pot na najbližji odsek (vmesna točka za L/U tloris). */
function insertPointInPath(path: NormPoint[], pt: NormPoint): NormPoint[] {
  if (path.length < 2) return [...path, pt]
  let bestI = 0
  let bestD = Infinity
  for (let i = 0; i < path.length - 1; i++) {
    const d = pointToSegmentDist(pt, path[i], path[i + 1])
    if (d < bestD) {
      bestD = d
      bestI = i
    }
  }
  const next = [...path]
  next.splice(bestI + 1, 0, pt)
  return next
}

/** Skupna dolžina poti v normaliziranih enotah (vsota nog — hypot). */
function pathLengthUnits(path: NormPoint[]): number {
  let sum = 0
  for (let i = 0; i < path.length - 1; i++) sum += distNorm(path[i], path[i + 1])
  return sum
}

/** Privzeti segment iz analize: BALCONY_EDGE, sicer glavni run (yBottom). */
function deriveSegmentFromAnalysis(analysis: SceneAnalysis | null): NormPoint[] {
  if (!analysis) return []
  const edge = analysis.elements.find(
    (e) => e.type === 'BALCONY_EDGE' && e.geometry.kind === 'line',
  )
  if (edge && edge.geometry.kind === 'line') {
    return [
      { x: round4(edge.geometry.from), y: round4(edge.geometry.pos) },
      { x: round4(edge.geometry.to), y: round4(edge.geometry.pos) },
    ]
  }
  const run = analysis.features?.runs[0]
  if (run) {
    return [
      { x: round4(run.x0), y: round4(run.yBottom) },
      { x: round4(run.x1), y: round4(run.yBottom) },
    ]
  }
  return []
}

/** Zgornja linija pri vsaki točki poti IZ ZAZNANEGA raila (ni izmišljena). */
function deriveTopFromRuns(
  path: NormPoint[],
  runs: DetectedFeatures['runs'],
): NormPoint[] | null {
  if (runs.length === 0) return null
  return path.map((p) => {
    const run =
      runs.find((r) => p.x >= r.x0 && p.x <= r.x1) ??
      runs.reduce((best, r) =>
        Math.abs((r.x0 + r.x1) / 2 - p.x) < Math.abs((best.x0 + best.x1) / 2 - p.x) ? r : best,
      )
    return { x: round4(p.x), y: round4(run.yTop) }
  })
}

/** Interpoliran y spodnje poti pri danem x (za post točke). */
function bottomYAtX(path: NormPoint[], x: number): number {
  if (path.length === 0) return 0.5
  if (x <= path[0].x) return path[0].y
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    if (x >= a.x && x <= b.x && b.x !== a.x) {
      const t = (x - a.x) / (b.x - a.x)
      return round4(a.y + t * (b.y - a.y))
    }
  }
  return path[path.length - 1].y
}

/** Končne pike črte v px (vertikalna/horizontalna/diagonalna geometrija). */
function lineEndpointsPx(
  g: { pos: number; from: number; to: number; thetaDeg: number },
  w: number,
  h: number,
): { x1: number; y1: number; x2: number; y2: number } {
  if (g.thetaDeg <= 12 || g.thetaDeg >= 168) {
    const x = g.pos * w
    return { x1: x, y1: g.from * h, x2: x, y2: g.to * h }
  }
  if (Math.abs(g.thetaDeg - 90) <= 12) {
    const y = g.pos * h
    return { x1: g.from * w, y1: y, x2: g.to * w, y2: y }
  }
  const th = (g.thetaDeg * Math.PI) / 180
  const rho = g.pos * Math.max(w, h)
  const x1 = g.from * w
  const x2 = g.to * w
  const y1 = (rho - x1 * Math.cos(th)) / Math.sin(th)
  const y2 = (rho - x2 * Math.cos(th)) / Math.sin(th)
  return { x1, y1, x2, y2 }
}

// ── Overlay risanje (čista funkcija — brez React stanja) ─────────────────────

interface OverlayOptions {
  elements: SceneElement[]
  review: Record<string, ReviewState>
  projection: ProjectionResult | null
  segPath: NormPoint[]
  segEditMode: boolean
  dragIndex: number
  confirmedCorners: NormPoint[]
  cornerProgress: NormPoint[]
  refP1: NormPoint | null
  refP2: NormPoint | null
  refLabel: string | null
  bboxStart: NormPoint | null
  manualPoints: { path: NormPoint[]; top: NormPoint[]; posts: NormPoint[] }
}

function drawCheckBadge(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.beginPath()
  ctx.arc(cx, cy, 9, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(5, 150, 105, 0.95)'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx - 4, cy)
  ctx.lineTo(cx - 1, cy + 3)
  ctx.lineTo(cx + 4, cy - 3)
  ctx.lineWidth = 2
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()
}

function strokeHatchRect(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  color: string,
): void {
  ctx.save()
  ctx.beginPath()
  ctx.rect(bx, by, bw, bh)
  ctx.clip()
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let d = -bh; d < bw; d += 9) {
    ctx.moveTo(bx + d, by + bh)
    ctx.lineTo(bx + d + bh, by)
  }
  ctx.stroke()
  ctx.restore()
}

function renderSceneOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  o: OverlayOptions,
): void {
  ctx.clearRect(0, 0, w, h)

  // ── 1. Projekcija postavitve (pod zaznavami) ──
  if (o.projection) {
    const p = o.projection
    const all = [...p.boards, ...p.posts, ...(p.handle ? [p.handle] : [])]
    for (const el of all) {
      ctx.beginPath()
      el.quad.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x * w, q.y * h) : ctx.lineTo(q.x * w, q.y * h)))
      ctx.closePath()
      if (p.kind === 'homography') {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.18)'
        ctx.fill()
        ctx.lineWidth = 1.5
        ctx.strokeStyle = 'rgba(5, 150, 105, 0.9)'
        ctx.stroke()
      } else {
        ctx.save()
        ctx.setLineDash([6, 4])
        ctx.lineWidth = 1.5
        ctx.strokeStyle = 'rgba(5, 150, 105, 0.9)'
        ctx.stroke()
        ctx.restore()
      }
    }
  }

  // ── 2. Zaznave po tipu (zavrnjene = skrite; sprejete = debelejše + ✓) ──
  for (const el of o.elements) {
    const st = o.review[el.id]
    if (st === 'rejected') continue
    const accepted = st === 'accepted'
    const g = el.geometry
    const dashed = el.state === 'NEEDS_CONFIRMATION' || el.state === 'UNKNOWN'
    const lw = accepted ? 4 : 2.5

    const maybeDash = () => {
      if (dashed && !accepted) ctx.setLineDash([7, 5])
    }

    if (g.kind === 'band' && el.type === 'RAILING') {
      const bx = g.x0 * w
      const by = g.yTop * h
      const bw = (g.x1 - g.x0) * w
      const bh = (g.yBottom - g.yTop) * h
      ctx.save()
      maybeDash()
      ctx.fillStyle = 'rgba(16, 185, 129, 0.08)'
      ctx.fillRect(bx, by, bw, bh)
      ctx.lineWidth = lw
      ctx.strokeStyle = accepted ? '#047857' : '#10b981'
      ctx.strokeRect(bx, by, bw, bh)
      ctx.restore()
      if (accepted) drawCheckBadge(ctx, bx + 10, by + 10)
    } else if (g.kind === 'line' && el.type === 'BALCONY_EDGE') {
      const e = lineEndpointsPx(g, w, h)
      ctx.save()
      maybeDash()
      ctx.lineWidth = lw
      ctx.strokeStyle = accepted ? '#047857' : '#10b981'
      ctx.beginPath()
      ctx.moveTo(e.x1, e.y1)
      ctx.lineTo(e.x2, e.y2)
      ctx.stroke()
      ctx.restore()
      if (accepted) drawCheckBadge(ctx, Math.min(e.x1, e.x2) + 10, e.y1 - 10)
    } else if (g.kind === 'line' && el.type === 'RAILING_POST') {
      const e = lineEndpointsPx(g, w, h)
      ctx.save()
      maybeDash()
      ctx.lineWidth = accepted ? 3.5 : 2
      ctx.strokeStyle = accepted ? '#0f766e' : '#0d9488'
      ctx.beginPath()
      ctx.moveTo(e.x1, e.y1)
      ctx.lineTo(e.x2, e.y2)
      ctx.stroke()
      ctx.restore()
      if (accepted) drawCheckBadge(ctx, e.x1, Math.min(e.y1, e.y2) - 10)
    } else if (g.kind === 'bbox' && (el.type === 'STAIR' || el.type === 'STAIR_EDGE')) {
      const bx = g.x0 * w
      const by = g.y0 * h
      const bw = (g.x1 - g.x0) * w
      const bh = (g.y1 - g.y0) * h
      ctx.save()
      maybeDash()
      ctx.lineWidth = accepted ? 3.5 : 2
      ctx.strokeStyle = accepted ? '#b45309' : '#d97706'
      ctx.strokeRect(bx, by, bw, bh)
      ctx.restore()
      strokeHatchRect(ctx, bx, by, bw, bh, 'rgba(217, 119, 6, 0.35)')
      if (accepted) drawCheckBadge(ctx, bx + 10, by + 10)
    } else if (g.kind === 'line' && (el.type === 'STAIR' || el.type === 'STAIR_EDGE')) {
      const e = lineEndpointsPx(g, w, h)
      ctx.save()
      maybeDash()
      ctx.lineWidth = accepted ? 3.5 : 2
      ctx.strokeStyle = accepted ? '#b45309' : '#d97706'
      ctx.beginPath()
      ctx.moveTo(e.x1, e.y1)
      ctx.lineTo(e.x2, e.y2)
      ctx.stroke()
      ctx.restore()
      if (accepted) drawCheckBadge(ctx, e.x1, e.y1 - 10)
    } else if (g.kind === 'bbox' && el.type === 'OBSTACLE') {
      const bx = g.x0 * w
      const by = g.y0 * h
      const bw = (g.x1 - g.x0) * w
      const bh = (g.y1 - g.y0) * h
      ctx.save()
      maybeDash()
      ctx.lineWidth = lw
      ctx.strokeStyle = '#dc2626'
      ctx.strokeRect(bx, by, bw, bh)
      ctx.restore()
      strokeHatchRect(ctx, bx, by, bw, bh, 'rgba(220, 38, 38, 0.4)')
      if (accepted) drawCheckBadge(ctx, bx + 10, by + 10)
    } else if (g.kind === 'bbox') {
      // ročne površine (FLOOR/GROUND/WALL/OPENING/DOOR/OTHER_SURFACE) — kamen
      const bx = g.x0 * w
      const by = g.y0 * h
      const bw = (g.x1 - g.x0) * w
      const bh = (g.y1 - g.y0) * h
      ctx.save()
      maybeDash()
      ctx.fillStyle = 'rgba(120, 113, 122, 0.10)'
      ctx.fillRect(bx, by, bw, bh)
      ctx.lineWidth = lw
      ctx.strokeStyle = '#78716c'
      ctx.strokeRect(bx, by, bw, bh)
      ctx.restore()
      if (accepted) drawCheckBadge(ctx, bx + 10, by + 10)
    }
  }

  // ── 3. Pot segmenta (dno ograje — uporabniško potrjena geometrija) ──
  if (o.segPath.length > 0) {
    ctx.save()
    ctx.strokeStyle = '#0f766e'
    ctx.lineWidth = 2
    ctx.beginPath()
    o.segPath.forEach((p, i) =>
      i === 0 ? ctx.moveTo(p.x * w, p.y * h) : ctx.lineTo(p.x * w, p.y * h),
    )
    ctx.stroke()
    ctx.restore()
    o.segPath.forEach((p, i) => {
      const x = p.x * w
      const y = p.y * h
      const isEnd = i === 0 || i === o.segPath.length - 1
      const r = o.segEditMode ? (o.dragIndex === i ? 11 : 9) : 6
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = isEnd ? '#0f766e' : '#14b8a6'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 10px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(
        i === 0 ? 'A' : i === o.segPath.length - 1 ? 'B' : String(i),
        x,
        y + 0.5,
      )
    })
  }

  // ── 4. Kotniki (potrditveni napredek + potrjeni) ──
  const cornerPts = [
    ...o.confirmedCorners.map((p, i) => ({ p, label: ['TL', 'TR', 'BR', 'BL'][i] ?? '' })),
    ...o.cornerProgress.map((p, i) => ({ p, label: `${i + 1}` })),
  ]
  for (const c of cornerPts) {
    const x = c.p.x * w
    const y = c.p.y * h
    ctx.beginPath()
    ctx.arc(x, y, 7, 0, Math.PI * 2)
    ctx.fillStyle = '#ea580c'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 9px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(c.label, x, y + 0.5)
  }
  if (o.confirmedCorners.length === 4) {
    ctx.save()
    ctx.setLineDash([5, 4])
    ctx.strokeStyle = 'rgba(234, 88, 12, 0.7)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    o.confirmedCorners.forEach((p, i) =>
      i === 0 ? ctx.moveTo(p.x * w, p.y * h) : ctx.lineTo(p.x * w, p.y * h),
    )
    ctx.closePath()
    ctx.stroke()
    ctx.restore()
  }

  // ── 5. Referenčna mera (rdeča črta + oznaka) ──
  const drawRefMarker = (p: NormPoint) => {
    ctx.beginPath()
    ctx.arc(p.x * w, p.y * h, 7, 0, Math.PI * 2)
    ctx.fillStyle = '#dc2626'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()
  }
  if (o.refP1) drawRefMarker(o.refP1)
  if (o.refP1 && o.refP2) {
    drawRefMarker(o.refP2)
    ctx.save()
    ctx.setLineDash([6, 4])
    ctx.strokeStyle = '#dc2626'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(o.refP1.x * w, o.refP1.y * h)
    ctx.lineTo(o.refP2.x * w, o.refP2.y * h)
    ctx.stroke()
    ctx.restore()
    if (o.refLabel) {
      const mx = ((o.refP1.x + o.refP2.x) / 2) * w
      const my = ((o.refP1.y + o.refP2.y) / 2) * h
      ctx.font = 'bold 12px sans-serif'
      const textW = ctx.measureText(o.refLabel).width
      const boxW = textW + 10
      const bx = mx + 8 + boxW > w ? mx - 8 - boxW : mx + 8
      const by = Math.min(Math.max(my - 18, 2), h - 20)
      ctx.fillStyle = 'rgba(220, 38, 38, 0.92)'
      ctx.fillRect(bx, by, boxW, 18)
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(o.refLabel, bx + 5, by + 9.5)
    }
  }

  // ── 6. Predogled ročnega bbox-a (prvi klik) ──
  if (o.bboxStart) {
    ctx.save()
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = '#78716c'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(o.bboxStart.x * w, o.bboxStart.y * h, 6, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  // ── 7. Ročne točke (ROČNO zavihek — rumena/rožata kot v Merilnem studiu) ──
  const drawSequence = (pts: NormPoint[], color: string, connect: boolean) => {
    if (pts.length === 0) return
    if (connect && pts.length > 1) {
      ctx.save()
      ctx.setLineDash([5, 4])
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.beginPath()
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * w, p.y * h) : ctx.lineTo(p.x * w, p.y * h)))
      ctx.stroke()
      ctx.restore()
    }
    pts.forEach((p, i) => {
      const x = p.x * w
      const y = p.y * h
      ctx.beginPath()
      ctx.arc(x, y, 8, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 10px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(i + 1), x, y + 0.5)
    })
  }
  if (o.manualPoints.path.length > 0) drawSequence(o.manualPoints.path, '#ec4899', true)
  if (o.manualPoints.top.length > 0) drawSequence(o.manualPoints.top, '#eab308', true)
  for (const p of o.manualPoints.posts) {
    const x = p.x * w
    const y = p.y * h
    ctx.strokeStyle = '#be185d'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(x, y - 12)
    ctx.lineTo(x, y + 12)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, y, 6, 0, Math.PI * 2)
    ctx.fillStyle = '#be185d'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()
  }
}

// ── Manjše UI pod-komponente ─────────────────────────────────────────────────

function CapsBadge({ ok, label }: { ok: boolean | 'unknown'; label: string }) {
  const variant = ok === true ? 'emerald' : ok === false ? 'stone' : 'amber'
  const cls =
    variant === 'emerald'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
      : variant === 'amber'
        ? 'border-amber-300 bg-amber-50 text-amber-800'
        : 'border-stone-300 bg-stone-100 text-stone-600'
  return (
    <Badge variant="outline" className={`text-[10px] ${cls}`}>
      {label}: {ok === true ? 'da' : ok === false ? 'ne' : 'neznano'}
    </Badge>
  )
}

function ElementCard({
  el,
  review,
  onAccept,
  onReject,
  onReset,
  onDelete,
}: {
  el: SceneElement
  review: ReviewState | undefined
  onAccept: () => void
  onReject: () => void
  onReset: () => void
  onDelete: () => void
}) {
  const isManual = el.id.startsWith('manual-')
  const stCfg = STATE_BADGE[el.state] ?? STATE_BADGE.UNKNOWN
  return (
    <div className="rounded-lg border border-border bg-white p-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-roksal-ink">
          {ELEMENT_LABELS[el.type] ?? el.type}
        </span>
        <Badge variant="outline" className={`text-[9px] ${stCfg.cls}`}>
          {stCfg.label}
        </Badge>
        {isManual && (
          <Badge variant="outline" className="border-stone-300 bg-stone-50 text-[9px] text-stone-600">
            ročno
          </Badge>
        )}
        {review === 'accepted' && (
          <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-[9px] text-emerald-800">
            ✓ sprejeto
          </Badge>
        )}
        {review === 'rejected' && (
          <Badge variant="outline" className="border-red-300 bg-red-50 text-[9px] text-red-700">
            zavrnjeno
          </Badge>
        )}
        <span className="ml-auto font-mono text-[9px] text-muted-foreground">{el.id}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="shrink-0 text-[10px] text-muted-foreground">podpora {formatPct(el.support)}</span>
        <Progress value={Math.round(el.support * 100)} className="h-1.5" aria-label={`Podpora zaznave ${el.id}`} />
      </div>
      {el.warnings.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {el.warnings.map((wn, i) => (
            <li key={i} className="text-[10px] leading-snug text-muted-foreground">
              ⚠ {wn}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {review === 'rejected' ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-[36px] text-[11px]"
            onClick={onReset}
            aria-label={`Razveljavi zavrnitev ${el.id}`}
          >
            <Undo2 className="mr-1 h-3 w-3" />
            Razveljavi
          </Button>
        ) : (
          <>
            <Button
              type="button"
              size="sm"
              variant={review === 'accepted' ? 'default' : 'outline'}
              className={`min-h-[36px] text-[11px] ${review === 'accepted' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border-emerald-300 text-emerald-800 hover:bg-emerald-50'}`}
              onClick={onAccept}
              aria-label={`Sprejmi zaznavo ${el.id}`}
            >
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Sprejmi
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-[36px] border-red-300 text-[11px] text-red-700 hover:bg-red-50"
              onClick={onReject}
              aria-label={`Zavrni zaznavo ${el.id}`}
            >
              <XCircle className="mr-1 h-3 w-3" />
              Zavrni
            </Button>
          </>
        )}
        {isManual && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-[36px] border-stone-300 text-[11px] text-stone-600 hover:bg-stone-50"
            onClick={onDelete}
            aria-label={`Briši ročno zaznavo ${el.id}`}
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Briši
          </Button>
        )}
      </div>
    </div>
  )
}

/** Skupna referenčna mera (FOTO + ROČNO) — OBVEZNA za absolutne mm. */
function ReferenceSection({
  refP1,
  refP2,
  knownMmInput,
  refKind,
  refLenOk,
  marking,
  onMark,
  onKnownMmChange,
  onKindChange,
  onClear,
}: {
  refP1: NormPoint | null
  refP2: NormPoint | null
  knownMmInput: string
  refKind: RefKind
  refLenOk: boolean
  marking: boolean
  onMark: () => void
  onKnownMmChange: (v: string) => void
  onKindChange: (v: RefKind) => void
  onClear: () => void
}) {
  return (
    <div className="space-y-2 rounded-lg border border-red-200 bg-red-50/40 p-3">
      <div className="flex items-center gap-2">
        <Ruler className="h-4 w-4 text-red-600" />
        <span className="text-xs font-semibold text-roksal-ink">Referenčna mera (obvezna za mm)</span>
      </div>
      <Alert className="border-amber-300 bg-amber-50 py-2">
        <TriangleAlert className="h-4 w-4 text-amber-700" />
        <AlertDescription className="text-[11px] text-amber-800">
          Absolutne mere brez referenčne mere niso mogoče (ni ugibanja). Označite znano dolžino
          (npr. letvico 1000 mm) in vpišite njeno dolžino.
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <Badge variant="outline" className={`text-[9px] ${refP1 ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-stone-300 bg-stone-50 text-stone-500'}`}>
          P1 {refP1 ? `(${refP1.x}, ${refP1.y})` : '—'}
        </Badge>
        <Badge variant="outline" className={`text-[9px] ${refP2 ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-stone-300 bg-stone-50 text-stone-500'}`}>
          P2 {refP2 ? `(${refP2.x}, ${refP2.y})` : '—'}
        </Badge>
        {refP1 && refP2 && !refLenOk && (
          <Badge variant="outline" className="border-red-300 bg-red-50 text-[9px] text-red-700">
            preveč blizu (≥ 2 % slike)
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="cv-known-mm" className="text-[11px]">
            Znana dolžina (mm)
          </Label>
          <Input
            id="cv-known-mm"
            type="number"
            min="1"
            inputMode="decimal"
            placeholder="npr. 1000"
            value={knownMmInput}
            onChange={(e) => onKnownMmChange(e.target.value)}
            className="min-h-[44px]"
            aria-label="Znana dolžina reference v milimetrih"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cv-ref-kind" className="text-[11px]">
            Vir mere
          </Label>
          <Select value={refKind} onValueChange={(v) => onKindChange(v as RefKind)}>
            <SelectTrigger id="cv-ref-kind" className="min-h-[44px]" aria-label="Vir referenčne mere">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REF_KIND_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={marking ? 'default' : 'outline'}
          className={`min-h-[44px] flex-1 text-[11px] ${marking ? 'bg-red-600 text-white hover:bg-red-700' : ''}`}
          onClick={onMark}
          aria-pressed={marking}
          aria-label="Označi referenčni točki na sliki"
        >
          <Crosshair className="mr-1 h-3.5 w-3.5" />
          {marking ? 'Klikni P1, nato P2 …' : 'Označi na sliki'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-[44px] text-[11px]"
          onClick={onClear}
          aria-label="Počisti referenčne točke"
        >
          Počisti
        </Button>
      </div>
    </div>
  )
}

/** Skupni rezultat potrditve (FOTO + ROČNO). */
function ConfirmResults({
  result,
  error,
  scaleHint,
}: {
  result: ConfirmResponse | null
  error: string | null
  scaleHint: string | null
}) {
  if (error) {
    return (
      <Alert variant="destructive" role="status">
        <TriangleAlert className="h-4 w-4" />
        <AlertTitle>Potrditev ni uspela</AlertTitle>
        <AlertDescription className="text-[11px]">{error}</AlertDescription>
      </Alert>
    )
  }
  if (!result) return null
  const state = result.session?.quality?.state
  const geom = result.session?.geometry
  return (
    <div className="space-y-2" role="status">
      {geom ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
            <span className="text-xs font-semibold text-emerald-900">Meritev shranjena</span>
            {state && (
              <Badge variant="outline" className="ml-auto border-emerald-500 bg-emerald-600 text-[9px] text-white">
                {state}
              </Badge>
            )}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded bg-white/70 p-2 text-center">
              <div className="text-base font-bold text-emerald-900">
                {geom.totalLengthMm.valueMm} mm
              </div>
              <div className="text-[9px] text-muted-foreground">
                dolžina ± {geom.totalLengthMm.uncertaintyMm} mm
              </div>
            </div>
            <div className="rounded bg-white/70 p-2 text-center">
              <div className="text-base font-bold text-emerald-900">
                {geom.heightMm.valueMm} mm
              </div>
              <div className="text-[9px] text-muted-foreground">
                višina ± {geom.heightMm.uncertaintyMm} mm
              </div>
            </div>
          </div>
          {result.takeoffPreview && (
            <div className="mt-2 space-y-1 rounded bg-white/70 p-2 text-[11px]">
              <p className="font-semibold text-emerald-900">Predračun materiala (iz geometrije)</p>
              <p>
                Desk: {result.takeoffPreview.boardCount} · {result.takeoffPreview.boardsTotalLinearM} lm ·
                Stebri: {result.takeoffPreview.postCount}
              </p>
              {result.takeoffPreview.cutList.length > 0 && (
                <p className="text-muted-foreground">
                  Rezalni seznam:{' '}
                  {result.takeoffPreview.cutList
                    .map((c) => `#${c.index} → ${c.cutMm} mm`)
                    .join(', ')}
                </p>
              )}
            </div>
          )}
          {result.savedMeasurementId && (
            <p className="mt-1.5 text-[10px] text-emerald-800">
              ID shranjene meritve: <span className="font-mono">{result.savedMeasurementId}</span>
            </p>
          )}
        </div>
      ) : (
        <Alert className="border-amber-300 bg-amber-50" role="status">
          <TriangleAlert className="h-4 w-4 text-amber-700" />
          <AlertTitle className="text-amber-900">Brez merila ni bilo mogoče shraniti geometrije</AlertTitle>
          <AlertDescription className="text-[11px] text-amber-800">
            {scaleHint ?? 'Meritev brez veljavnega merila (SCALE_REQUIRED) ni shranjena — sistem ne ugiba.'}
          </AlertDescription>
        </Alert>
      )}
      <p className="text-[10px] leading-snug text-muted-foreground">
        Potrjeno prek obstoječe Measurement → Geometry → BOM verige; CV je bil samo predlog.
      </p>
    </div>
  )
}

// ── GLAVNA KOMPONENTA ────────────────────────────────────────────────────────

export function CvStudio({ projectId }: { projectId?: string | null }) {
  const { toast } = useToast()

  // ── Zmožnosti naprave + katalog ──
  const [caps, setCaps] = useState<DeviceCapabilities | null>(null)
  const [capsLoaded, setCapsLoaded] = useState(false)
  const [products, setProducts] = useState<ProductDefinition[]>([])
  const [productsError, setProductsError] = useState<string | null>(null)

  // ── Zavihek ──
  const [tab, setTab] = useState<StudioTab>('photo')

  // ── Slika + analiza (FOTO) ──
  const [imageData, setImageData] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<SceneAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeMs, setAnalyzeMs] = useState<number | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // ── Review zaznav ──
  const [review, setReview] = useState<Record<string, ReviewState>>({})
  const [manualElements, setManualElements] = useState<SceneElement[]>([])
  const [manualType, setManualType] = useState<ManualSurfaceType>('FLOOR')
  const [corrections, setCorrections] = useState(0)

  // ── Interakcija na sliki ──
  const [clickMode, setClickMode] = useState<ClickMode>('none')
  const [bboxStart, setBboxStart] = useState<NormPoint | null>(null)
  const [cornerProgress, setCornerProgress] = useState<NormPoint[]>([])
  const [confirmedCorners, setConfirmedCorners] = useState<NormPoint[]>([])

  // ── Segment (FOTO) ──
  const [segPath, setSegPath] = useState<NormPoint[]>([])
  const [segEdited, setSegEdited] = useState(false)
  const [dragIndex, setDragIndex] = useState(-1)
  const dragRef = useRef<{ index: number; moved: boolean } | null>(null)

  // ── Referenca (skupna FOTO + ROČNO) ──
  const [refP1, setRefP1] = useState<NormPoint | null>(null)
  const [refP2, setRefP2] = useState<NormPoint | null>(null)
  const [knownMmInput, setKnownMmInput] = useState('')
  const [refKind, setRefKind] = useState<RefKind>('user-known-measure')

  // ── Postavitev (PWC predlog) ──
  const [productId, setProductId] = useState<string>('')
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal')
  const [gapMmInput, setGapMmInput] = useState('30')
  const [postWidthMmInput, setPostWidthMmInput] = useState('60')
  const [fenceHeightMmInput, setFenceHeightMmInput] = useState('1100')
  const [postsFromDetect, setPostsFromDetect] = useState(false)
  const [manualPostsMm, setManualPostsMm] = useState('')
  const [placing, setPlacing] = useState(false)
  const [placementRes, setPlacementRes] = useState<PlacementResponse | null>(null)
  const [placementError, setPlacementError] = useState<string | null>(null)
  const lastScaleRef = useRef<PlacementScale | null>(null)

  // ── Potrditev ──
  const [confirming, setConfirming] = useState(false)
  const [confirmRes, setConfirmRes] = useState<ConfirmResponse | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  // ── V ŽIVO ──
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [liveAuto, setLiveAuto] = useState(false)
  const [liveBusy, setLiveBusy] = useState(false)
  const [liveAnalysis, setLiveAnalysis] = useState<SceneAnalysis | null>(null)
  const [liveMs, setLiveMs] = useState<number | null>(null)
  const [liveError, setLiveError] = useState<string | null>(null)
  const liveBusyRef = useRef(false)
  const lastLiveRef = useRef(0)
  const streamRef = useRef<MediaStream | null>(null)

  // ── ROČNO (fail-safe) ──
  const [mPath, setMPath] = useState<NormPoint[]>([])
  const [mTop, setMTop] = useState<NormPoint[]>([])
  const [mPosts, setMPosts] = useState<NormPoint[]>([])
  const [mStep, setMStep] = useState<ManualStep>('ref')
  const [mSessionId, setMSessionId] = useState<string | null>(null)

  // ── Refs (DOM) ──
  const photoWrapRef = useRef<HTMLDivElement | null>(null)
  const photoCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const liveWrapRef = useRef<HTMLDivElement | null>(null)
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const captureInputRef = useRef<HTMLInputElement | null>(null)
  const mFileInputRef = useRef<HTMLInputElement | null>(null)
  const uploadAnalyzeRef = useRef(true)
  const [photoSize, setPhotoSize] = useState({ w: 0, h: 0 })
  const [liveSize, setLiveSize] = useState({ w: 0, h: 0 })

  // ── Izpeljane vrednosti ──
  const knownMm = parseDec(knownMmInput)
  const refLen = refP1 && refP2 ? distNorm(refP1, refP2) : 0
  const refValid = !!(refP1 && refP2 && knownMm !== null && knownMm > 0 && refLen >= 0.02)
  const knownMmLabel = refP1 && refP2 ? `${refLen.toFixed(1)} %${knownMm && knownMm > 0 ? ` · ${knownMm} mm` : ''}` : null
  const selectedProduct = products.find((p) => p.id === productId) ?? null
  const segLenUnits = pathLengthUnits(segPath)
  const fenceWidthMm = refValid && segLenUnits > 0 ? round2((knownMm! * segLenUnits) / refLen) : null
  const segEditMode = clickMode === 'addpoint'
  const allElements: SceneElement[] = [...(analysis?.elements ?? []), ...manualElements]
  const visibleCount = allElements.filter((e) => review[e.id] !== 'rejected').length

  const gapMin = selectedProduct?.board.minGapMm ?? 0
  const gapMax = selectedProduct?.board.maxGapMm ?? 200

  // ROČNO: veljavnost
  const mCanConfirm = refValid && mPath.length >= 2 && mTop.length === mPath.length
  // FOTO: struktura (features runs ALI popravljen segment z zaznano zgornjo linijo)
  const runsPresent = (analysis?.features?.runs.length ?? 0) > 0
  const derivedTop = segEdited && analysis?.features ? deriveTopFromRuns(segPath, analysis.features.runs) : null
  const fotoHasStructure = runsPresent || (!!derivedTop && segPath.length >= 2)
  const fotoCanConfirm = refValid && fotoHasStructure
  const fotoHint = !imageData
    ? 'Najprej naloži ali posnemi sliko.'
    : !refP1 || !refP2
      ? 'Označi 2 referenčni točki na sliki (rdeči markerja).'
      : knownMm === null || knownMm <= 0
        ? 'Vpiši znano dolžino v mm (več kot 0).'
        : !refValid
          ? 'Referenčni točki sta preveč blizu (najmanj 2 % slike).'
          : !runsPresent && segPath.length < 2
            ? 'Ni zaznav ograje — popravi geometrijo (dodaj točke) ali uporabi ROČNO.'
            : segEdited && !derivedTop
              ? 'Za popravljen segment manjka zaznana zgornja linija — uporabi ROČNO zavihek.'
              : null

  const placementReady = !!selectedProduct && refValid && segPath.length >= 2
  const placementHint = !selectedProduct
    ? 'Izberi izdelek iz kataloga.'
    : !refValid
      ? 'Referenčna mera je obvezna (merilo pride s strežnika — ni ugibanja).'
      : segPath.length < 2
        ? 'Potrdi geometrijo (segment A–B) — vsaj 2 točki.'
        : null

  // ── Montaža: capabilities + katalog + cleanup kamere ──
  useEffect(() => {
    let cancelled = false
    detectDeviceCapabilities()
      .then((c) => {
        if (!cancelled) {
          setCaps(c)
          setCapsLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) setCapsLoaded(true)
      })
    return () => {
      cancelled = true
      stopCamera()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/measurement/products', { credentials: 'include' })
        if (!res.ok) throw new Error(`products ${res.status}`)
        const data = (await res.json()) as ProductsResponse
        if (!cancelled) setProducts(data.products ?? [])
      } catch {
        if (!cancelled)
          setProductsError('Katalog izdelkov ni dosegljiv — predlog postavitve bo omejen.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Poveži stream z video elementom
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [cameraActive])

  // Sledi prikazani velikosti slike → overlay natanko prekriva sliko
  useEffect(() => {
    const el = photoWrapRef.current
    if (!el || !imageData || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (r && r.width > 0 && r.height > 0) {
        setPhotoSize({ w: Math.round(r.width), h: Math.round(r.height) })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [imageData, tab])

  useEffect(() => {
    const el = liveWrapRef.current
    if (!el || !cameraActive || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (r && r.width > 0 && r.height > 0) {
        setLiveSize({ w: Math.round(r.width), h: Math.round(r.height) })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [cameraActive, tab])

  // ── Risanje overlayjev (po vsakem renderju — poceni, vedno konsistentno) ──
  useEffect(() => {
    drawPhoto()
  })

  useEffect(() => {
    drawLive()
  })

  function drawPhoto() {
    const canvas = photoCanvasRef.current
    const { w, h } = photoSize
    if (!canvas || w <= 0 || h <= 0 || !imageData) return
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const cw = Math.round(w * dpr)
    const ch = Math.round(h * dpr)
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw
      canvas.height = ch
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    renderSceneOverlay(ctx, w, h, {
      elements: allElements,
      review,
      projection: placementRes?.projection ?? null,
      segPath,
      segEditMode,
      dragIndex,
      confirmedCorners,
      cornerProgress,
      refP1,
      refP2,
      refLabel: knownMmLabel,
      bboxStart,
      manualPoints: { path: [], top: [], posts: [] },
    })
  }

  function drawLive() {
    const canvas = liveCanvasRef.current
    const { w, h } = liveSize
    if (!canvas || w <= 0 || h <= 0 || !cameraActive) return
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const cw = Math.round(w * dpr)
    const ch = Math.round(h * dpr)
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw
      canvas.height = ch
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    renderSceneOverlay(ctx, w, h, {
      elements: liveAnalysis?.elements ?? [],
      review: {},
      projection: null,
      segPath: [],
      segEditMode: false,
      dragIndex: -1,
      confirmedCorners: [],
      cornerProgress: [],
      refP1: null,
      refP2: null,
      refLabel: null,
      bboxStart: null,
      manualPoints: { path: [], top: [], posts: [] },
    })
  }

  // ── Slika: nov vhod (reset vsega + opcijska analiza) ──
  function applyNewImage(dataUrl: string, analyze: boolean) {
    setImageData(dataUrl)
    setAnalysis(null)
    setAnalyzeError(null)
    setAnalyzeMs(null)
    setReview({})
    setManualElements([])
    setCorrections(0)
    setClickMode('none')
    setBboxStart(null)
    setCornerProgress([])
    setConfirmedCorners([])
    setSegPath([])
    setSegEdited(false)
    setRefP1(null)
    setRefP2(null)
    setPlacementRes(null)
    setPlacementError(null)
    setConfirmRes(null)
    setConfirmError(null)
    setMPath([])
    setMTop([])
    setMPosts([])
    setMStep('ref')
    setMSessionId(`manual-${uid()}`)
    setCameraError(null)
    setPhotoSize({ w: 0, h: 0 })
    setLiveAnalysis(null)
    setLiveError(null)
    if (analyze) void runAnalyze(dataUrl)
  }

  function processFile(file: File, analyze: boolean) {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, 1280 / Math.max(img.width, img.height))
        const cw = Math.max(1, Math.round(img.width * scale))
        const ch = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = cw
        canvas.height = ch
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          setCameraError('Slike ni bilo mogoče obdelati.')
          return
        }
        ctx.drawImage(img, 0, 0, cw, ch)
        applyNewImage(canvas.toDataURL('image/jpeg', 0.85), analyze)
      }
      img.onerror = () => setCameraError('Datoteke ni bilo mogoče prebrati kot sliko.')
      img.src = reader.result as string
    }
    reader.onerror = () => setCameraError('Branje datoteke ni uspelo.')
    reader.readAsDataURL(file)
  }

  function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // dovoli ponovno izbiro iste datoteke
    if (file) processFile(file, uploadAnalyzeRef.current)
  }

  // ── Analiza prizora (FOTO; LIVE ima svojo) ──
  async function runAnalyze(img: string) {
    setAnalyzing(true)
    setAnalyzeError(null)
    setAnalysis(null)
    const t0 = performance.now()
    try {
      const res = await fetch('/api/vision/scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ imageData: img }),
      })
      setAnalyzeMs(Math.round(performance.now() - t0))
      const data = (await res.json().catch(() => null)) as
        | (SceneAnalysis & { error?: string; code?: string })
        | null
      if (!res.ok || !data) {
        setAnalyzeError(
          data?.error
            ? `${data.error}${data.code ? ` (koda: ${data.code})` : ''}`
            : `Analiza prizora ni uspela (${res.status}).`,
        )
        return
      }
      // Nov rezultat → review/segment/corrections reset (kanonični JSON se NE meša)
      setReview({})
      setManualElements([])
      setCorrections(0)
      setSegPath(deriveSegmentFromAnalysis(data))
      setSegEdited(false)
      setAnalysis(data)
      if ((data.elements?.length ?? 0) === 0) {
        toast({
          title: 'Ni zaznav',
          description: data.guidance?.nextAction ?? 'Sistem ni zaznal strukture — uporabi ročno označbo ali ROČNO zavihek.',
        })
      }
    } catch {
      setAnalyzeMs(Math.round(performance.now() - t0))
      setAnalyzeError('Omrežna napaka pri analizi prizora. Poskusite znova.')
    } finally {
      setAnalyzing(false)
    }
  }

  // ── Review akcije ──
  function acceptElement(id: string) {
    setReview((s) => ({ ...s, [id]: 'accepted' }))
    setCorrections((c) => c + 1)
  }
  function rejectElement(id: string) {
    setReview((s) => ({ ...s, [id]: 'rejected' }))
    setCorrections((c) => c + 1)
  }
  function resetElement(id: string) {
    setReview((s) => {
      const n = { ...s }
      delete n[id]
      return n
    })
  }
  function deleteManualElement(id: string) {
    setManualElements((arr) => arr.filter((e) => e.id !== id))
  }

  // ── Klik na sliko (FOTO + ROČNO, glede na clickMode) ──
  function handlePhotoClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!imageData) return
    if (dragRef.current?.moved) return
    const el = photoWrapRef.current
    if (!el) return
    const pt = pointFromEvent(e, el)
    if (!pt) return

    switch (clickMode) {
      case 'ref':
        if (!refP1) setRefP1(pt)
        else if (!refP2) setRefP2(pt)
        else {
          setRefP1(pt)
          setRefP2(null)
        }
        break
      case 'bbox': {
        if (!bboxStart) {
          setBboxStart(pt)
        } else {
          const el2: SceneElement = {
            id: `manual-${uid()}`,
            type: manualType,
            state: 'NEEDS_CONFIRMATION',
            geometry: {
              kind: 'bbox',
              x0: Math.min(bboxStart.x, pt.x),
              y0: Math.min(bboxStart.y, pt.y),
              x1: Math.max(bboxStart.x, pt.x),
              y1: Math.max(bboxStart.y, pt.y),
            },
            support: 1,
            warnings: ['Ročna označba uporabnika.'],
          }
          setManualElements((arr) => [...arr, el2])
          setCorrections((c) => c + 1)
          setBboxStart(null)
          setClickMode('none')
          toast({ title: 'Ročna označba dodana', description: `${ELEMENT_LABELS[manualType]} — potrdi ali izbriši v seznamu zaznav.` })
        }
        break
      }
      case 'corners': {
        const next = [...cornerProgress, pt]
        if (next.length >= 4) {
          setConfirmedCorners(next.slice(0, 4))
          setCornerProgress([])
          setClickMode('none')
          toast({ title: 'Kotniki potrjeni', description: 'TL, TR, BR, BL — homografska projekcija je možna.' })
        } else {
          setCornerProgress(next)
        }
        break
      }
      case 'addpoint': {
        setSegPath((p) => insertPointInPath(p, pt))
        setSegEdited(true)
        setCorrections((c) => c + 1)
        break
      }
      case 'm-path':
        setMPath((arr) => (arr.length >= 24 ? arr : [...arr, pt]))
        break
      case 'm-top':
        setMTop((arr) => (arr.length >= 24 ? arr : [...arr, pt]))
        break
      case 'm-posts':
        setMPosts((arr) => (arr.length >= 48 ? arr : [...arr, pt]))
        break
      default:
        break
    }
  }

  // ── Vlečenje točk segmenta (pointer + touch, hit ≥ 44 px premer) ──
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!imageData || segPath.length === 0) return
    const el = photoWrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const maxDist = 22 // 44 px hit area (premer) — touch-friendly
    let best = -1
    let bestD = Infinity
    segPath.forEach((p, i) => {
      const d = Math.hypot(p.x * rect.width - px, p.y * rect.height - py)
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    if (best >= 0 && bestD <= maxDist) {
      dragRef.current = { index: best, moved: false }
      setDragIndex(best)
      e.preventDefault()
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag) return
    const el = photoWrapRef.current
    if (!el) return
    const pt = pointFromEvent(e, el)
    if (!pt) return
    dragRef.current = { ...drag, moved: true }
    setSegPath((p) => p.map((q, i) => (i === drag.index ? pt : q)))
  }

  function onPointerUp() {
    const drag = dragRef.current
    dragRef.current = null
    setDragIndex(-1)
    if (drag?.moved) {
      setSegEdited(true)
      setCorrections((c) => c + 1)
    }
  }

  // ── Kamera (V ŽIVO) — vzorec iz measurement-studio ──
  async function startCamera() {
    setCameraError(null)
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
      streamRef.current = stream
      setCameraActive(true)
      lastLiveRef.current = 0
      setLiveAnalysis(null)
      setLiveError(null)
    } catch {
      setCameraActive(false)
      setCameraError('Kamera ni dosegljiva (dostop zavrnjen ali ni podprta). Uporabite nalaganje slike v FOTO/ROČNO.')
      toast({
        title: 'Kamera ni dosegljiva',
        description: 'Preklopite na FOTO (nalaganje slike).',
        variant: 'destructive',
      })
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop()
      streamRef.current = null
    }
    setCameraActive(false)
    setLiveAuto(false)
  }

  function captureLiveFrame(): string | null {
    const video = videoRef.current
    if (!video || !streamRef.current || video.videoWidth === 0) return null
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight))
    const cw = Math.max(1, Math.round(video.videoWidth * scale))
    const ch = Math.max(1, Math.round(video.videoHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, cw, ch)
    return canvas.toDataURL('image/jpeg', 0.85)
  }

  async function analyzeLive() {
    if (liveBusyRef.current || !cameraActive) return
    const frame = captureLiveFrame()
    if (!frame) return
    liveBusyRef.current = true
    setLiveBusy(true)
    lastLiveRef.current = Date.now() // throttle odšteva od ZAČETKA analize
    const t0 = performance.now()
    try {
      const res = await fetch('/api/vision/scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ imageData: frame }),
      })
      setLiveMs(Math.round(performance.now() - t0))
      const data = (await res.json().catch(() => null)) as
        | (SceneAnalysis & { error?: string; code?: string })
        | null
      if (!res.ok || !data) {
        setLiveError(
          data?.error
            ? `${data.error}${data.code ? ` (koda: ${data.code})` : ''}`
            : `Analiza kadra ni uspela (${res.status}).`,
        )
        return
      }
      setLiveAnalysis(data)
      setLiveError(null)
    } catch {
      setLiveError('Omrežna napaka pri analizi kadra.')
    } finally {
      liveBusyRef.current = false
      setLiveBusy(false)
    }
  }

  // Samodejna analiza (throttle: samo če ni zahteve v letu + min 3 s od zadnje)
  useEffect(() => {
    if (!liveAuto || !cameraActive) return
    const id = setInterval(() => {
      if (liveBusyRef.current) return
      if (Date.now() - lastLiveRef.current < 3000) return
      void analyzeLive()
    }, 1000)
    return () => clearInterval(id)
  }, [liveAuto, cameraActive])

  // Zajemi kader → FOTO (preklopi + zaženi analizo)
  function captureToPhoto() {
    const frame = captureLiveFrame()
    if (!frame) {
      toast({ title: 'Zajem ni uspel', description: 'Kamera ni pripravljena.', variant: 'destructive' })
      return
    }
    stopCamera()
    setTab('photo')
    applyNewImage(frame, true)
  }

  // ── Segment pomožniki ──
  function undoSegPoint() {
    setSegPath((p) => p.slice(0, -1))
    setSegEdited(true)
  }
  function clearSeg() {
    setSegPath([])
    setSegEdited(true)
  }
  function resetSegFromDetection() {
    setSegPath(deriveSegmentFromAnalysis(analysis))
    setSegEdited(false)
  }

  // ── Postavitev (PWC predlog) ──
  async function runPlacement() {
    if (!placementReady || !selectedProduct || !refP1 || !refP2 || knownMm === null || fenceWidthMm === null) return
    setPlacing(true)
    setPlacementError(null)
    const gapRaw = parseDec(gapMmInput) ?? gapMin
    const gapMm = Math.min(gapMax, Math.max(gapMin, gapRaw))
    const postWidthMm = Math.min(500, Math.max(0, parseDec(postWidthMmInput) ?? 60))
    const fenceHeightMm = Math.min(5000, Math.max(0, parseDec(fenceHeightMmInput) ?? 1100))

    // stebri: iz zaznav (× merilo s strežnika — zahteva prejšnjo oceno) ali ročni vhod
    let posts: { widthMm: number; positionsMm: number[] } | null = null
    if (postsFromDetect && lastScaleRef.current && analysis?.features?.posts.length) {
      const minX = Math.min(...segPath.map((p) => p.x))
      posts = {
        widthMm: postWidthMm,
        positionsMm: analysis.features.posts
          .map((p) => round2(Math.max(0, (p.x - minX) * lastScaleRef.current!.mmPerUnitX)))
          .sort((a, b) => a - b),
      }
    } else if (manualPostsMm.trim()) {
      const positions = manualPostsMm
        .split(',')
        .map((s) => parseDec(s))
        .filter((v): v is number => v !== null && v >= 0)
      if (positions.length > 0) posts = { widthMm: postWidthMm, positionsMm: positions }
    }

    try {
      const res = await fetch('/api/vision/placement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId: selectedProduct.id,
          orientation,
          gapMm: round2(gapMm),
          postWidthMm: round2(postWidthMm),
          fenceWidthMm,
          fenceHeightMm: round2(fenceHeightMm),
          posts,
          handle: false, // products API ne vrača handle info — ne izmišljujemo
          reference: { p1: refP1, p2: refP2, knownMm, kind: refKind },
          segment: { start: segPath[0], end: segPath[segPath.length - 1] },
          corners: confirmedCorners.length === 4
            ? [confirmedCorners[0], confirmedCorners[1], confirmedCorners[2], confirmedCorners[3]]
            : null,
        }),
      })
      const data = (await res.json().catch(() => null)) as (PlacementResponse & { issues?: unknown }) | null
      if (!res.ok || !data) {
        const code = data?.code ? ` (koda: ${data.code})` : ''
        const reason = data?.reason ? ` — ${data.reason}` : ''
        setPlacementError(`${data?.error ?? `Ocena postavitve ni uspela (${res.status}).`}${code}${reason}`)
        return
      }
      lastScaleRef.current = data.scale
      setPlacementRes(data)
      if (data.placement.valid) {
        toast({ title: 'Postavitev veljavna', description: `${data.placement.layout?.boardCount ?? 0} desk — podrobnosti v panelu.` })
      } else {
        toast({
          title: 'Postavitev NI veljavna',
          description: data.placement.violations[0]?.message ?? data.placement.reason ?? 'Kršitve pravil.',
          variant: 'destructive',
        })
      }
    } catch {
      setPlacementError('Omrežna napaka pri oceni postavitve. Poskusite znova.')
    } finally {
      setPlacing(false)
    }
  }

  // ── Potrditev meritve (kanonična veriga) ──
  async function runConfirm(scope: 'photo' | 'manual') {
    if (!refP1 || !refP2 || knownMm === null) return
    if (scope === 'photo' && !analysis) return
    if (scope === 'manual' && (!mCanConfirm || mSessionId === null)) return
    setConfirming(true)
    setConfirmError(null)
    setConfirmRes(null)

    let body: ConfirmRequestBody
    if (scope === 'photo') {
      const a = analysis! // zgoraj zagotovljeno (guard); TS ne sledi prek veje
      const manual =
        segEdited && segPath.length >= 2 && derivedTop
          ? {
              path: segPath,
              top: derivedTop,
              posts:
                a.features && a.features.posts.length > 0
                  ? a.features.posts.map((p) => ({
                      x: round4(p.x),
                      y: bottomYAtX(segPath, p.x),
                    }))
                  : undefined,
            }
          : undefined
      body = {
        sessionId: a.sessionId,
        source: corrections > 0 ? 'hybrid' : 'automatic',
        features: a.features,
        metrics: a.quality.metrics,
        manual,
        reference: { p1: refP1, p2: refP2, knownMm, kind: refKind },
        manualCorrections: corrections,
        confirmed: true,
        ...(projectId ? { projectId } : {}),
        ...(productId && selectedProduct
          ? {
              geometry: {
                productId,
                orientation,
                gapMm: round2(Math.min(gapMax, Math.max(gapMin, parseDec(gapMmInput) ?? gapMin))),
                postWidthMm: round2(Math.min(200, Math.max(10, parseDec(postWidthMmInput) ?? 60))),
              },
            }
          : {}),
      }
    } else {
      body = {
        sessionId: mSessionId!, // zgoraj zagotovljeno (guard)
        source: 'manual',
        features: null,
        metrics: null,
        manual: {
          path: mPath,
          top: mTop,
          ...(mPosts.length > 0 ? { posts: mPosts } : {}),
        },
        reference: { p1: refP1, p2: refP2, knownMm, kind: refKind },
        manualCorrections: mPath.length + mTop.length + mPosts.length,
        confirmed: true,
        ...(projectId ? { projectId } : {}),
        ...(productId && selectedProduct
          ? {
              geometry: {
                productId,
                orientation,
                gapMm: round2(Math.min(gapMax, Math.max(gapMin, parseDec(gapMmInput) ?? gapMin))),
                postWidthMm: round2(Math.min(200, Math.max(10, parseDec(postWidthMmInput) ?? 60))),
              },
            }
          : {}),
      }
    }

    try {
      const res = await fetch('/api/measurement/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => null)) as (ConfirmResponse & { session?: MeasurementSession }) | null
      if (!res.ok) {
        // 422 SCALE_REQUIRED (ob shranjevanju v projekt) = zakon, prikaži iskreno
        if (res.status === 422 && data?.session) {
          setConfirmRes({ session: data.session, takeoffPreview: null, layout: null, savedMeasurementId: null })
          setConfirmError(data.error ?? 'Meritev brez merila ni shranjena (SCALE_REQUIRED).')
          return
        }
        setConfirmError(
          data?.error
            ? `${data.error}${data.code ? ` (koda: ${data.code})` : ''}`
            : `Potrditev ni uspela (${res.status}).`,
        )
        return
      }
      setConfirmRes(data)
      if (data?.session?.geometry) {
        toast({
          title: 'Meritev shranjena',
          description: data.savedMeasurementId
            ? `Shranjeno v projekt (${data.savedMeasurementId.slice(0, 8)}…).`
            : 'Geometrija izračunana (projekt ni izbran — ni shranjeno).',
        })
      }
    } catch {
      setConfirmError('Omrežna napaka pri potrditvi meritve. Poskusite znova.')
    } finally {
      setConfirming(false)
    }
  }

  // ── Izdelek: ob izbiri nastavi orientacijo + privzeti razmak ──
  function handleProductChange(id: string) {
    setProductId(id)
    const p = products.find((x) => x.id === id)
    if (p) {
      const ori = p.orientations[0] === 'vertical' ? 'vertical' : 'horizontal'
      setOrientation(ori)
      const def = Math.max(10, p.board.minGapMm)
      setGapMmInput(String(Math.min(p.board.maxGapMm, def)))
    }
  }

  const cutList = placementRes?.placement.layout?.boards.filter((b) => b.cut) ?? []

  return (
    <div className="space-y-3">
      {/* ── ZGORNJA PLOŠČA: naslov + zmožnosti + projekt ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-roksal-ink">
            <ScanLine className="h-5 w-5 text-roksal-amber" />
            CV Studio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-[11px] leading-snug text-muted-foreground">
            CV analiza prizora + predlog postavitve (ni vir resnice). Končna meritev gre vedno prek
            obstoječe Measurement → Geometry → BOM verige.
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {capsLoaded && caps ? (
              <>
                <CapsBadge ok={caps.camera} label="Kamera" />
                <CapsBadge ok={caps.webxrAr} label="WebXR AR" />
                <CapsBadge
                  ok={caps.depth === 'unavailable' ? false : 'unknown'}
                  label="Depth"
                />
              </>
            ) : (
              <span className="text-[11px] text-muted-foreground" role="status">
                Zaznavanje zmožnosti naprave …
              </span>
            )}
            {projectId ? (
              <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-[10px] text-emerald-800">
                ✓ Projekt povezan — meritev se shrani
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-800">
                Projekt ni izbran — meritev ne bo shranjena
              </Badge>
            )}
          </div>
          {capsLoaded && caps && caps.note && (
            <p className="text-[10px] leading-snug text-muted-foreground">{caps.note}</p>
          )}
          {capsLoaded && caps && !caps.camera && (
            <Alert className="border-amber-300 bg-amber-50 py-2">
              <Video className="h-4 w-4 text-amber-700" />
              <AlertDescription className="text-[11px] text-amber-800">
                Kamera ni na voljo — zavihek V ŽIVO je onemogočen. Uporabi FOTO (nalaganje
                fotografije) ali ROČNO (fail-safe brez CV).
              </AlertDescription>
            </Alert>
          )}
          {productsError && (
            <p className="text-[10px] text-amber-700" role="status">
              ⚠ {productsError}
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as StudioTab)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="photo" className="min-h-[44px]" aria-label="Foto način — analiza naložene slike">
            FOTO
          </TabsTrigger>
          <TabsTrigger
            value="live"
            className="min-h-[44px]"
            disabled={capsLoaded && !caps?.camera}
            aria-label="Živi način — kamera (2D CV predogled)"
          >
            V ŽIVO
          </TabsTrigger>
          <TabsTrigger value="manual" className="min-h-[44px]" aria-label="Ročni način — brez CV (fail-safe)">
            ROČNO
          </TabsTrigger>
        </TabsList>

        {/* ══════════════ TAB FOTO ══════════════ */}
        <TabsContent value="photo" className="pt-2">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
            {/* LEVO: slika + overlay + orodja */}
            <div className="space-y-2">
              {!imageData ? (
                <div
                  className={`flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center ${dragOver ? 'border-roksal-amber bg-roksal-amber/5' : 'border-roksal-navy/20 bg-white'}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    const f = e.dataTransfer.files?.[0]
                    if (f) processFile(f, true)
                  }}
                >
                  <Upload className="h-8 w-8 text-roksal-ink/40" />
                  <p className="text-xs text-muted-foreground">
                    Povleci sliko sem ali izberi datoteko (≤1280 px, JPEG).
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        uploadAnalyzeRef.current = true
                        fileInputRef.current?.click()
                      }}
                      className="min-h-[44px] bg-roksal-amber text-white hover:bg-roksal-amber/90"
                      aria-label="Naloži sliko prizora"
                    >
                      <Upload className="mr-1.5 h-4 w-4" />
                      Naloži sliko
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        uploadAnalyzeRef.current = true
                        captureInputRef.current?.click()
                      }}
                      className="min-h-[44px]"
                      aria-label="Posnemi fotografijo s kamero"
                    >
                      <Camera className="mr-1.5 h-4 w-4" />
                      Kamera
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div
                    ref={photoWrapRef}
                    onClick={handlePhotoClick}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      const f = e.dataTransfer.files?.[0]
                      if (f) processFile(f, true)
                    }}
                    role="application"
                    aria-label="Slika prizora — klik označuje točke, vlečenje premika točke segmenta"
                    className="relative w-full cursor-crosshair select-none overflow-hidden rounded-lg border border-border bg-muted/20"
                    style={{ touchAction: segEditMode ? 'none' : 'auto' }}
                  >
                    <img
                      src={imageData}
                      alt="Fotografija prizora za CV analizo"
                      className="block w-full"
                      draggable={false}
                    />
                    <canvas
                      ref={photoCanvasRef}
                      role="img"
                      aria-label="Overlay zaznav: ograja (emerald), stebri (teal), stopnice (amber), ovire (rdeče), ročne površine (sivo), referenčna mera (rdeča črtkana)"
                      className="pointer-events-none absolute inset-0 h-full w-full"
                    />
                  </div>
                  <p className="text-[10px] leading-snug text-muted-foreground">
                    Legenda: <span className="text-emerald-600">emerald</span> = ograja/rob ·{' '}
                    <span className="text-teal-600">teal</span> = stebri ·{' '}
                    <span className="text-amber-600">amber</span> = stopnice ·{' '}
                    <span className="text-red-600">rdeča</span> = ovira/referenca ·{' '}
                    <span className="text-stone-500">sivo</span> = ročne površine ·{' '}
                    <span className="text-orange-600">oranžno</span> = kotniki ·{' '}
                    <span className="text-teal-700">teal točke</span> = segment A–B
                  </p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUploadFile}
                aria-label="Izberi sliko prizora za analizo"
              />
              <input
                ref={captureInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleUploadFile}
                aria-label="Posnemi fotografijo prizora"
              />

              {imageData && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[44px] text-[11px]"
                    aria-label="Zamenjaj sliko"
                  >
                    <Upload className="mr-1 h-3.5 w-3.5" />
                    Zamenjaj sliko
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => imageData && void runAnalyze(imageData)}
                    disabled={analyzing}
                    className="min-h-[44px] text-[11px]"
                    aria-label="Ponovno analiziraj sliko"
                  >
                    {analyzing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
                    Analiziraj sliko
                  </Button>
                </div>
              )}

              {/* Orodja: referenca / segment / kotniki / ročna označba */}
              {imageData && (
                <div className="space-y-2 rounded-lg border border-border bg-white p-3">
                  <p className="text-xs font-semibold text-roksal-ink">Orodja označevanja</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={clickMode === 'ref' ? 'default' : 'outline'}
                      className={`min-h-[44px] text-[11px] ${clickMode === 'ref' ? 'bg-red-600 text-white hover:bg-red-700' : ''}`}
                      onClick={() => setClickMode(clickMode === 'ref' ? 'none' : 'ref')}
                      aria-pressed={clickMode === 'ref'}
                      aria-label="Označi referenčno mero (2 klika)"
                    >
                      <Ruler className="mr-1 h-3.5 w-3.5" />
                      Referenca (2 klika)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={segEditMode ? 'default' : 'outline'}
                      className={`min-h-[44px] text-[11px] ${segEditMode ? 'bg-teal-700 text-white hover:bg-teal-800' : ''}`}
                      onClick={() => setClickMode(segEditMode ? 'none' : 'addpoint')}
                      aria-pressed={segEditMode}
                      aria-label="Popravi geometrijo — dodaj/vleci točke segmenta"
                    >
                      <Layers className="mr-1 h-3.5 w-3.5" />
                      Popravi geometrijo
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={clickMode === 'corners' ? 'default' : 'outline'}
                      className={`min-h-[44px] text-[11px] ${clickMode === 'corners' ? 'bg-orange-600 text-white hover:bg-orange-700' : ''}`}
                      onClick={() => setClickMode(clickMode === 'corners' ? 'none' : 'corners')}
                      aria-pressed={clickMode === 'corners'}
                      aria-label="Označi 4 kotnike (TL, TR, BR, BL)"
                    >
                      <Square className="mr-1 h-3.5 w-3.5" />
                      Označi 4 kotnike
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={clickMode === 'bbox' ? 'default' : 'outline'}
                      className={`min-h-[44px] text-[11px] ${clickMode === 'bbox' ? 'bg-stone-600 text-white hover:bg-stone-700' : ''}`}
                      onClick={() => {
                        if (clickMode === 'bbox') {
                          setClickMode('none')
                          setBboxStart(null)
                        } else {
                          setClickMode('bbox')
                        }
                      }}
                      aria-pressed={clickMode === 'bbox'}
                      aria-label="Ročna označba površine (2 klika = bbox)"
                    >
                      <Square className="mr-1 h-3.5 w-3.5" />
                      Označi na sliki
                    </Button>
                  </div>

                  {(clickMode === 'bbox' || clickMode === 'corners' || clickMode === 'ref' || segEditMode) && (
                    <p className="text-[10px] text-muted-foreground" role="status">
                      {clickMode === 'ref' && 'Klikni P1, nato P2 (rdeči markerja). Tretji klik začne znova.'}
                      {segEditMode && 'Klik doda vmesno točko v pot; vleci točke A/B/številke za popravek.'}
                      {clickMode === 'corners' && `Klikni 4 kotnike v vrstnem redu TL, TR, BR, BL (${cornerProgress.length}/4).`}
                      {clickMode === 'bbox' && 'Izberi tip spodaj, nato klikni 2 kotni točki (bbox).'}
                    </p>
                  )}

                  {clickMode === 'bbox' && (
                    <div className="space-y-1">
                      <Label htmlFor="cv-manual-type" className="text-[11px]">
                        Tip ročne označbe
                      </Label>
                      <Select value={manualType} onValueChange={(v) => setManualType(v as ManualSurfaceType)}>
                        <SelectTrigger id="cv-manual-type" className="min-h-[44px]" aria-label="Tip ročne označbe">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MANUAL_SURFACE_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {segEditMode && (
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-h-[36px] text-[11px]"
                        onClick={undoSegPoint}
                        aria-label="Razveljavi zadnjo točko segmenta"
                      >
                        <Undo2 className="mr-1 h-3 w-3" />
                        Undo točka
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-h-[36px] text-[11px]"
                        onClick={clearSeg}
                        aria-label="Počisti segment"
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Počisti
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="min-h-[36px] text-[11px]"
                        onClick={resetSegFromDetection}
                        aria-label="Ponastavi segment iz zaznav"
                      >
                        Ponastavi iz zaznav
                      </Button>
                      <Badge variant="outline" className="border-teal-300 bg-teal-50 text-[9px] text-teal-800">
                        točke: {segPath.length}
                      </Badge>
                      {segEdited && (
                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[9px] text-amber-800">
                          popravljen
                        </Badge>
                      )}
                    </div>
                  )}

                  {confirmedCorners.length === 4 && (
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="border-orange-300 bg-orange-50 text-[9px] text-orange-800">
                        kotniki potrjeni (TL, TR, BR, BL)
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="min-h-[28px] text-[10px]"
                        onClick={() => setConfirmedCorners([])}
                        aria-label="Počisti kotnike"
                      >
                        Počisti kotnike
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Referenčna mera (OBVEZNA za mm — skupna stanja s ROČNO) */}
              {imageData && (
                <ReferenceSection
                  refP1={refP1}
                  refP2={refP2}
                  knownMmInput={knownMmInput}
                  refKind={refKind}
                  refLenOk={refLen >= 0.02}
                  marking={clickMode === 'ref'}
                  onMark={() => setClickMode(clickMode === 'ref' ? 'none' : 'ref')}
                  onKnownMmChange={setKnownMmInput}
                  onKindChange={setRefKind}
                  onClear={() => {
                    setRefP1(null)
                    setRefP2(null)
                  }}
                />
              )}

              {/* Analiza: status + kakovost + guidance */}
              {analyzing && (
                <div
                  className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground"
                  role="status"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analiza prizora teče (deterministični CV, brez AI) …
                </div>
              )}
              {analyzeError && (
                <Alert variant="destructive" role="status">
                  <TriangleAlert className="h-4 w-4" />
                  <AlertTitle>Napaka analize</AlertTitle>
                  <AlertDescription className="text-[11px]">{analyzeError}</AlertDescription>
                </Alert>
              )}
              {analysis && (
                <div className="space-y-2 rounded-lg border border-border bg-white p-3" role="status">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-roksal-ink">Kakovost prizora</span>
                    {analyzeMs !== null && (
                      <Badge variant="outline" className="ml-auto border-stone-300 bg-stone-50 text-[9px] text-stone-600">
                        Analiza: {analyzeMs} ms
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {[
                      { l: 'Svetlost', v: formatPct(analysis.quality.brightness) },
                      { l: 'Kontrast', v: formatPct(analysis.quality.contrast) },
                      { l: 'Ostrina', v: formatPct(analysis.quality.sharpness) },
                      { l: 'Šum', v: formatPct(analysis.quality.noiseEstimate) },
                    ].map((m) => (
                      <div key={m.l} className="rounded bg-muted/40 p-1.5 text-center">
                        <div className="text-sm font-bold text-roksal-ink">{m.v}</div>
                        <div className="text-[9px] text-muted-foreground">{m.l}</div>
                      </div>
                    ))}
                  </div>
                  {!analysis.quality.usable && analysis.quality.reasons.length > 0 && (
                    <Alert className="border-amber-300 bg-amber-50 py-2">
                      <TriangleAlert className="h-4 w-4 text-amber-700" />
                      <AlertDescription className="text-[11px] text-amber-800">
                        Slika morda ni uporabna: {analysis.quality.reasons.join(' ')}
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-0.5 text-[11px]">
                    <p>
                      <span className="text-muted-foreground">Vidi:</span> {analysis.guidance.seen}
                    </p>
                    {analysis.guidance.missing && (
                      <p>
                        <span className="text-muted-foreground">Manjka:</span> {analysis.guidance.missing}
                      </p>
                    )}
                    <p>
                      <span className="text-muted-foreground">Naslednji korak:</span> {analysis.guidance.nextAction}
                    </p>
                  </div>
                  {analysis.warnings.length > 0 && (
                    <ul className="space-y-0.5">
                      {analysis.warnings.map((w, i) => (
                        <li key={i} className="text-[10px] text-muted-foreground">
                          ⚠ {w}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* DESNO: zaznave + postavitev + potrditev */}
            <div className="space-y-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-roksal-ink">
                    Zaznave {analysis ? `(${visibleCount}/${allElements.length})` : ''}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div aria-live="polite">
                    {!analysis && !analyzing && (
                      <p className="text-[11px] text-muted-foreground" role="status">
                        Naloži sliko — zaznave se prikažejo tu (Sprejmi/Zavrni posodobi overlay
                        takoj).
                      </p>
                    )}
                    {analysis && allElements.length === 0 && (
                      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-800" role="status">
                        <p className="font-semibold">Ni zaznav</p>
                        <p className="mt-1">
                          {analysis.guidance.nextAction} — prazne zaznave NISO napaka in se ne
                          izmišljujejo. Uporabi ročno označbo ali ROČNO zavihek.
                        </p>
                      </div>
                    )}
                    <ScrollArea className="max-h-80">
                      <div className="space-y-2 pr-2">
                        {allElements.map((el) => (
                          <ElementCard
                            key={el.id}
                            el={el}
                            review={review[el.id]}
                            onAccept={() => acceptElement(el.id)}
                            onReject={() => rejectElement(el.id)}
                            onReset={() => resetElement(el.id)}
                            onDelete={() => deleteManualElement(el.id)}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-roksal-ink">Postavitev (PWC predlog)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {products.length === 0 && !productsError && (
                    <p className="text-[11px] text-muted-foreground">Katalog se nalaga …</p>
                  )}
                  <div className="space-y-1">
                    <Label htmlFor="cv-product" className="text-[11px]">
                      Izdelek
                    </Label>
                    <Select value={productId} onValueChange={handleProductChange}>
                      <SelectTrigger id="cv-product" className="min-h-[44px]" aria-label="Izberi izdelek iz kataloga">
                        <SelectValue placeholder="Izberi izdelek" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.family} · {p.profile}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedProduct && (
                    <>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label htmlFor="cv-orientation" className="text-[11px]">
                            Orientacija
                          </Label>
                          <Select
                            value={orientation}
                            onValueChange={(v) => setOrientation(v as 'horizontal' | 'vertical')}
                          >
                            <SelectTrigger id="cv-orientation" className="min-h-[44px]" aria-label="Orientacija desk">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedProduct.orientations.map((o) => (
                                <SelectItem key={o} value={o}>
                                  {o === 'horizontal' ? 'Horizontalno' : 'Pokončno'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="cv-gap" className="text-[11px]">
                            Razmak (mm)
                          </Label>
                          <Input
                            id="cv-gap"
                            type="number"
                            min={gapMin}
                            max={gapMax}
                            value={gapMmInput}
                            onChange={(e) => setGapMmInput(e.target.value)}
                            className="min-h-[44px]"
                            aria-label={`Razmak med deskami v mm (dovoljeno ${gapMin}–${gapMax})`}
                          />
                          <p className="text-[9px] text-muted-foreground">
                            dovoljeno: {gapMin}–{gapMax} mm
                          </p>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="cv-postw" className="text-[11px]">
                            Širina stebra (mm)
                          </Label>
                          <Input
                            id="cv-postw"
                            type="number"
                            min="10"
                            value={postWidthMmInput}
                            onChange={(e) => setPostWidthMmInput(e.target.value)}
                            className="min-h-[44px]"
                            aria-label="Širina stebra v milimetrih"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="cv-fh" className="text-[11px]">
                            Višina (mm)
                          </Label>
                          <Input
                            id="cv-fh"
                            type="number"
                            min="100"
                            value={fenceHeightMmInput}
                            onChange={(e) => setFenceHeightMmInput(e.target.value)}
                            className="min-h-[44px]"
                            aria-label="Višina ograje v milimetrih"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded border border-border px-2 py-1.5">
                        <Label htmlFor="cv-posts-detect" className="text-[11px]">
                          Stebri iz zaznav
                        </Label>
                        <Switch
                          id="cv-posts-detect"
                          checked={postsFromDetect}
                          onCheckedChange={setPostsFromDetect}
                          disabled={!lastScaleRef.current}
                          aria-label="Pozicije stebrov iz zaznanih stebrov (zahteva merilo iz ocene postavitve)"
                        />
                      </div>
                      {!postsFromDetect && (
                        <div className="space-y-1">
                          <Label htmlFor="cv-posts-manual" className="text-[11px]">
                            Pozicije stebrov (mm, ločene z vejico)
                          </Label>
                          <Input
                            id="cv-posts-manual"
                            inputMode="numeric"
                            placeholder="npr. 500, 1500, 2500"
                            value={manualPostsMm}
                            onChange={(e) => setManualPostsMm(e.target.value)}
                            className="min-h-[44px]"
                            aria-label="Ročne pozicije stebrov v milimetrih, ločene z vejico"
                          />
                        </div>
                      )}
                      {postsFromDetect && !lastScaleRef.current && (
                        <p className="text-[10px] text-amber-700" role="status">
                          Za stebre iz zaznav je potreben merilo — zaženi najprej oceno postavitve
                          (merilo pride s strežnika).
                        </p>
                      )}

                      <p className="text-[10px] text-muted-foreground">
                        Širina polja (iz reference + segment):{' '}
                        <span className="font-semibold text-roksal-ink">
                          {fenceWidthMm !== null ? `${fenceWidthMm} mm` : '— (manjka referenca/segment)'}
                        </span>
                        {' · '}Ročaj: ni podprt v katalogu (handle: false).
                      </p>
                    </>
                  )}

                  <Button
                    type="button"
                    onClick={() => void runPlacement()}
                    disabled={!placementReady || placing}
                    className="min-h-[44px] w-full bg-roksal-amber text-white hover:bg-roksal-amber/90"
                    aria-label="Oceni postavitev"
                  >
                    {placing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
                    OCENI POSTAVITEV
                  </Button>
                  {!placementReady && placementHint && (
                    <p className="text-center text-[10px] text-muted-foreground" role="status">
                      {placementHint}
                    </p>
                  )}

                  {placementError && (
                    <Alert variant="destructive" role="status">
                      <TriangleAlert className="h-4 w-4" />
                      <AlertTitle>Napaka ocene</AlertTitle>
                      <AlertDescription className="text-[11px]">{placementError}</AlertDescription>
                    </Alert>
                  )}

                  {placementRes && (
                    <div className="space-y-2" role="status">
                      {placementRes.placement.valid && placementRes.placement.layout ? (
                        <div className="space-y-1.5 rounded-lg border border-emerald-300 bg-emerald-50 p-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                            <span className="text-xs font-semibold text-emerald-900">Postavitev veljavna</span>
                            {placementRes.projection && (
                              <Badge
                                variant="outline"
                                className={`ml-auto text-[9px] ${placementRes.projection.kind === 'homography' ? 'border-emerald-400 bg-emerald-100 text-emerald-900' : 'border-amber-400 bg-amber-100 text-amber-900'}`}
                              >
                                {placementRes.projection.kind === 'homography' ? 'HOMOGRAFIJA' : '2D PRIBLIŽEK'}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px]">
                            Desk: <b>{placementRes.placement.layout.boardCount}</b> · korak:{' '}
                            <b>{placementRes.placement.layout.pitchMm} mm</b> · polje:{' '}
                            <b>{placementRes.placement.layout.fieldSpanMm} mm</b>
                          </p>
                          {cutList.length > 0 && (
                            <p className="text-[11px] text-emerald-900">
                              Rezalni seznam:{' '}
                              {cutList.map((b) => `#${b.index} → ${b.visibleMm} mm`).join(', ')}
                            </p>
                          )}
                          {placementRes.placement.warnings.length > 0 && (
                            <ul className="space-y-0.5">
                              {placementRes.placement.warnings.map((w, i) => (
                                <li key={i} className="text-[10px] text-amber-800">
                                  ⚠ {w}
                                </li>
                              ))}
                            </ul>
                          )}
                          {placementRes.projection?.warnings.map((w, i) => (
                            <p key={`pw${i}`} className="text-[10px] text-amber-800">
                              ⚠ {w}
                            </p>
                          ))}
                          {placementRes.projection?.kind === 'affine-approximation' && (
                            <p className="text-[10px] text-amber-800">
                              ⚠ 2D približek (brez 4 kotnikov) — ni prava perspektivna projekcija.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1.5 rounded-lg border border-red-300 bg-red-50 p-3">
                          <div className="flex items-center gap-1.5">
                            <XCircle className="h-4 w-4 text-red-700" />
                            <span className="text-xs font-semibold text-red-900">Postavitev NI veljavna</span>
                          </div>
                          {placementRes.placement.reason && (
                            <p className="text-[11px] text-red-900">{placementRes.placement.reason}</p>
                          )}
                          <ul className="space-y-1">
                            {placementRes.placement.violations.map((v, i) => (
                              <li key={i} className="text-[11px] text-red-900">
                                <span className="font-mono text-[9px] text-red-700">{v.code}</span> — {v.message}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-roksal-ink">Potrditev meritve</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    <Badge variant="outline" className={`text-[9px] ${refValid ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-red-300 bg-red-50 text-red-700'}`}>
                      referenca {refValid ? '✓' : '✗'}
                    </Badge>
                    <Badge variant="outline" className={`text-[9px] ${fotoHasStructure ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>
                      struktura {fotoHasStructure ? '✓' : '—'}
                    </Badge>
                    <Badge variant="outline" className="border-stone-300 bg-stone-50 text-[9px] text-stone-600">
                      popravki: {corrections}
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    onClick={() => void runConfirm('photo')}
                    disabled={!fotoCanConfirm || confirming}
                    className="min-h-[44px] w-full bg-roksal-navy text-white hover:bg-roksal-navy/90"
                    aria-label="Potrdi meritev in shrani prek obstoječe verige"
                  >
                    {confirming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                    POTRDI MERITEV (OBSTOJEČA VERIGA)
                  </Button>
                  {!fotoCanConfirm && fotoHint && !confirming && (
                    <p className="text-center text-[10px] text-muted-foreground" role="status">
                      {fotoHint}
                    </p>
                  )}
                  <ConfirmResults
                    result={confirmRes}
                    error={confirmError}
                    scaleHint={confirmError ?? null}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ══════════════ TAB V ŽIVO ══════════════ */}
        <TabsContent value="live" className="pt-2">
          {!capsLoaded || !caps ? (
            <p className="p-4 text-[11px] text-muted-foreground" role="status">
              Zaznavanje zmožnosti naprave …
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
              <div className="space-y-2">
                {!cameraActive ? (
                  <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-roksal-navy/20 bg-white p-6 text-center">
                    <Video className="h-8 w-8 text-roksal-ink/40" />
                    <p className="text-xs text-muted-foreground">
                      Živi 2D CV predogled (frame-relative overlay, brez trackinga).
                    </p>
                    <Button
                      type="button"
                      onClick={() => void startCamera()}
                      className="min-h-[44px] bg-roksal-amber text-white hover:bg-roksal-amber/90"
                      aria-label="Vklopi kamero"
                    >
                      <Camera className="mr-1.5 h-4 w-4" />
                      Vklopi kamero
                    </Button>
                    {cameraError && (
                      <Alert variant="destructive" role="status">
                        <TriangleAlert className="h-4 w-4" />
                        <AlertDescription className="text-[11px]">{cameraError}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : (
                  <>
                    <div
                      ref={liveWrapRef}
                      role="application"
                      aria-label="Živi kamera predogled z overlayjem zadnje analize"
                      className="relative w-full select-none overflow-hidden rounded-lg border border-border bg-black"
                    >
                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        autoPlay
                        className="block w-full"
                        aria-label="Živi video prizora"
                      />
                      <canvas
                        ref={liveCanvasRef}
                        role="img"
                        aria-label="Overlay zadnje analize kadra (frame-relative)"
                        className="pointer-events-none absolute inset-0 h-full w-full"
                      />
                      {liveBusy && (
                        <div
                          className="absolute inset-x-0 top-0 h-0.5 animate-pulse bg-roksal-amber"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <p className="text-[10px] leading-snug text-muted-foreground">
                      Overlay ostane stabilen med analizo (zadnji rezultat).{!caps.webxrAr && ' 2D CV predogled brez trackinga (WebXR AR ni podprt na tej napravi — pravi AR: AR skener).'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void analyzeLive()}
                        disabled={liveBusy}
                        className="min-h-[44px] text-[11px]"
                        aria-label="Analiziraj trenutni kader"
                      >
                        {liveBusy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ScanLine className="mr-1 h-3.5 w-3.5" />}
                        Analiziraj trenutni kader
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={captureToPhoto}
                        className="min-h-[44px] bg-roksal-amber text-white hover:bg-roksal-amber/90"
                        aria-label="Zajemi kader in preklopi na FOTO"
                      >
                        <Camera className="mr-1 h-3.5 w-3.5" />
                        Zajemi kader → FOTO
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={stopCamera}
                        className="min-h-[44px] text-[11px]"
                        aria-label="Izklopi kamero"
                      >
                        Izklopi
                      </Button>
                    </div>
                    <div className="flex items-center justify-between rounded border border-border px-2 py-1.5">
                      <Label htmlFor="cv-live-auto" className="text-[11px]">
                        Samodejno (vsakih 3 s)
                      </Label>
                      <Switch
                        id="cv-live-auto"
                        checked={liveAuto}
                        onCheckedChange={setLiveAuto}
                        aria-label="Samodejna analiza kadra vsake 3 sekunde"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-roksal-ink">Zadnja analiza kadra</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2" aria-live="polite">
                    {!liveAnalysis && !liveError && (
                      <p className="text-[11px] text-muted-foreground" role="status">
                        Kamera še ni analizirana — klikni „Analiziraj trenutni kader“ ali vklopi
                        samodejni način.
                      </p>
                    )}
                    {liveError && (
                      <Alert variant="destructive" role="status">
                        <TriangleAlert className="h-4 w-4" />
                        <AlertDescription className="text-[11px]">{liveError}</AlertDescription>
                      </Alert>
                    )}
                    {liveAnalysis && (
                      <div className="space-y-1.5 text-[11px]" role="status">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-[9px] text-emerald-800">
                            {liveAnalysis.elements.length} zaznav
                          </Badge>
                          {liveMs !== null && (
                            <Badge variant="outline" className="border-stone-300 bg-stone-50 text-[9px] text-stone-600">
                              Analiza: {liveMs} ms
                            </Badge>
                          )}
                        </div>
                        <p>
                          <span className="text-muted-foreground">Vidi:</span> {liveAnalysis.guidance.seen}
                        </p>
                        {liveAnalysis.guidance.missing && (
                          <p>
                            <span className="text-muted-foreground">Manjka:</span> {liveAnalysis.guidance.missing}
                          </p>
                        )}
                        <p>
                          <span className="text-muted-foreground">Naslednji korak:</span>{' '}
                          {liveAnalysis.guidance.nextAction}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Za merjenje/shranjevanje zajemi kader → FOTO (referenčna mera je tam
                          obvezna).
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ══════════════ TAB ROČNO (fail-safe) ══════════════ */}
        <TabsContent value="manual" className="pt-2">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
            <div className="space-y-2">
              {!imageData ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-roksal-navy/20 bg-white p-6 text-center">
                  <Upload className="h-8 w-8 text-roksal-ink/40" />
                  <p className="text-xs text-muted-foreground">
                    Ročni način (fail-safe): deluje BREZ CV rezultata — samo tvoje točke + referenca.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        uploadAnalyzeRef.current = false
                        mFileInputRef.current?.click()
                      }}
                      className="min-h-[44px] bg-roksal-amber text-white hover:bg-roksal-amber/90"
                      aria-label="Naloži sliko za ročno merjenje"
                    >
                      <Upload className="mr-1.5 h-4 w-4" />
                      Naloži sliko
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        uploadAnalyzeRef.current = false
                        captureInputRef.current?.click()
                      }}
                      className="min-h-[44px]"
                      aria-label="Posnemi fotografijo za ročno merjenje"
                    >
                      <Camera className="mr-1.5 h-4 w-4" />
                      Kamera
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div
                    ref={photoWrapRef}
                    onClick={handlePhotoClick}
                    role="application"
                    aria-label="Slika za ročno merjenje — klik dodaja točke"
                    className="relative w-full cursor-crosshair select-none overflow-hidden rounded-lg border border-border bg-muted/20"
                  >
                    <img
                      src={imageData}
                      alt="Fotografija prizora za ročno merjenje"
                      className="block w-full"
                      draggable={false}
                    />
                    <canvas
                      ref={photoCanvasRef}
                      role="img"
                      aria-label="Overlay ročnih točk: spodnja linija (rožnata), zgornja (rumena), stebri, referenčna mera (rdeča)"
                      className="pointer-events-none absolute inset-0 h-full w-full"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Legenda: rožata = spodnja linija · rumena = zgornja linija · vijolično = stebri ·
                    rdeča = referenčna mera
                  </p>
                </div>
              )}

              <input
                ref={mFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUploadFile}
                aria-label="Izberi sliko za ročno merjenje"
              />

              {imageData && (
                <div className="space-y-2 rounded-lg border border-roksal-navy/15 bg-roksal-navy/5 p-3">
                  <p className="text-xs font-semibold text-roksal-ink">
                    Korak: {mStep === 'ref' ? 'Referenca P1 → P2' : mStep === 'path' ? 'Spodnja linija (2+)' : mStep === 'top' ? 'Zgornja linija (enako točk)' : 'Stebri (opcijsko)'}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(
                      [
                        { id: 'ref', label: 'Referenca' },
                        { id: 'path', label: 'Spodnja linija' },
                        { id: 'top', label: 'Zgornja linija' },
                        { id: 'posts', label: 'Stebri' },
                      ] as Array<{ id: ManualStep; label: string }>
                    ).map((s) => (
                      <Button
                        key={s.id}
                        type="button"
                        size="sm"
                        variant={mStep === s.id ? 'default' : 'outline'}
                        className={`min-h-[44px] text-[11px] ${mStep === s.id ? 'bg-roksal-navy text-white' : ''}`}
                        aria-pressed={mStep === s.id}
                        aria-label={`Korak: ${s.label}`}
                        onClick={() => {
                          setMStep(s.id)
                          setClickMode(s.id === 'ref' ? 'ref' : s.id === 'path' ? 'm-path' : s.id === 'top' ? 'm-top' : 'm-posts')
                        }}
                      >
                        {s.label}
                      </Button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-[44px] flex-1 text-[11px]"
                      onClick={() => {
                        if (mStep === 'path') setMPath((a) => a.slice(0, -1))
                        else if (mStep === 'top') setMTop((a) => a.slice(0, -1))
                        else if (mStep === 'posts') setMPosts((a) => a.slice(0, -1))
                        else {
                          if (refP2) setRefP2(null)
                          else setRefP1(null)
                        }
                      }}
                      aria-label="Razveljavi zadnjo točko"
                    >
                      <Undo2 className="mr-1 h-3.5 w-3.5" />
                      Razveljavi zadnjo
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-[44px] flex-1 text-[11px]"
                      onClick={() => {
                        setMPath([])
                        setMTop([])
                        setMPosts([])
                        setRefP1(null)
                        setRefP2(null)
                      }}
                      aria-label="Počisti vse točke"
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Počisti
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    <Badge variant="outline" className="border-rose-300 bg-rose-50 text-[9px] text-rose-700">
                      Spodnja: {mPath.length}
                    </Badge>
                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[9px] text-amber-700">
                      Zgornja: {mTop.length}
                    </Badge>
                    <Badge variant="outline" className="border-pink-300 bg-pink-50 text-[9px] text-pink-700">
                      Stebri: {mPosts.length}
                    </Badge>
                    {mPath.length >= 2 && mTop.length !== mPath.length && (
                      <Badge variant="outline" className="border-red-300 bg-red-50 text-[9px] text-red-700">
                        Zgornja mora imeti {mPath.length} točk!
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <ReferenceSection
                refP1={refP1}
                refP2={refP2}
                knownMmInput={knownMmInput}
                refKind={refKind}
                refLenOk={refLen >= 0.02}
                marking={clickMode === 'ref'}
                onMark={() => setClickMode(clickMode === 'ref' ? 'none' : 'ref')}
                onKnownMmChange={setKnownMmInput}
                onKindChange={setRefKind}
                onClear={() => {
                  setRefP1(null)
                  setRefP2(null)
                }}
              />

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-roksal-ink">Potrditev meritve (ročno)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    type="button"
                    onClick={() => void runConfirm('manual')}
                    disabled={!mCanConfirm || confirming}
                    className="min-h-[44px] w-full bg-roksal-navy text-white hover:bg-roksal-navy/90"
                    aria-label="Potrdi ročno meritev"
                  >
                    {confirming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                    POTRDI MERITEV (OBSTOJEČA VERIGA)
                  </Button>
                  {!mCanConfirm && (
                    <p className="text-center text-[10px] text-muted-foreground" role="status">
                      {!refValid
                        ? 'Referenčna mera je obvezna (2 točki + znana mm).'
                        : mPath.length < 2
                          ? 'Dodaj vsaj 2 točki spodnje linije.'
                          : 'Zgornja linija mora imeti enako število točk kot spodnja.'}
                    </p>
                  )}
                  <ConfirmResults result={confirmRes} error={confirmError} scaleHint={confirmError ?? null} />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Separator />
      <p className="pb-2 text-center text-[10px] text-muted-foreground">
        CV Studio (issues #10 + #11) — zaznave so PREDLOGI; potrjena geometrija nastane izključno
        prek obstoječe Measurement → Geometry → BOM verige.
      </p>
    </div>
  )
}
