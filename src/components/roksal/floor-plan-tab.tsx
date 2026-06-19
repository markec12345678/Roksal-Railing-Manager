'use client'

// ============================================================================
// Roksal Railing Manager — Tloris z elementi (Floor Plan Editor)
// Task: TLORIS — Canvas tloris z stenami, stebri, vrati, okni, merami
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import jsPDF from 'jspdf'
import {
  Minus,
  Columns3,
  DoorOpen,
  RectangleHorizontal,
  Ruler,
  Type,
  Eraser,
  Move,
  Frame,
  ZoomIn,
  ZoomOut,
  Maximize,
  Trash2,
  Download,
  FileText,
  FileImage,
  Save,
  Upload,
  Layers,
  X,
  Eye,
  EyeOff,
  Crosshair,
  Ruler as RulerIcon,
  Undo2,
  Redo2,
} from 'lucide-react'

// ============================================================================
// TIPI
// ============================================================================

interface Point { x: number; y: number }

interface WallElement {
  id: string
  type: 'wall'
  a: Point
  b: Point
  heightMm: number
  thicknessMm: number
}

type PostType = 'KONCNI' | 'VMESNI' | 'VOGALNI'
type PostMaterial = 'ALU' | 'INOX' | 'WPC'

interface PostElement {
  id: string
  type: 'post'
  x: number
  y: number
  label: string
  postType: PostType
  heightMm: number
  material: PostMaterial
}

interface DoorElement {
  id: string
  type: 'door'
  wallId: string
  position: number // 0..1 along wall
  widthMm: number
  swing: 'single' | 'double'
}

interface WindowElement {
  id: string
  type: 'window'
  wallId: string
  position: number // 0..1 along wall
  widthMm: number
  heightMm: number
}

interface DimensionElement {
  id: string
  type: 'dimension'
  a: Point
  b: Point
  label: string
  realMm: number
}

interface TextElement {
  id: string
  type: 'text'
  x: number
  y: number
  text: string
}

type FloorElement =
  | WallElement
  | PostElement
  | DoorElement
  | WindowElement
  | DimensionElement
  | TextElement

type Tool =
  | 'select'
  | 'wall'
  | 'post'
  | 'door'
  | 'window'
  | 'dimension'
  | 'text'
  | 'eraser'
  | 'move'

interface Layers {
  walls: boolean
  posts: boolean
  doors: boolean
  windows: boolean
  dimensions: boolean
  texts: boolean
}

interface HistorySnapshot {
  elements: FloorElement[]
  // we store a serialized copy
}

// ============================================================================
// KONSTANTE
// ============================================================================

const NAVY = '#1d2b3e'
const AMBER = '#f59e0b'
const GREEN = '#22c55e'
const DOOR_COLOR = '#0ea5e9' // cyan-ish (not blue/indigo per theme)
const WINDOW_COLOR = '#06b6d4'

const DEFAULT_ZOOM = 0.3
const MIN_ZOOM = 0.05
const MAX_ZOOM = 4
const GRID_MM = 500 // 500mm grid lines (shows up at 0.3 zoom = 150px)

const POST_RADIUS_MM = 40 // 4cm radius in world coords
const HIT_TOLERANCE_PX = 10

const POST_TYPE_LABELS: Record<PostType, string> = {
  KONCNI: 'Končni',
  VMESNI: 'Vmesni',
  VOGALNI: 'Vogalni',
}

const POST_MATERIAL_LABELS: Record<PostMaterial, string> = {
  ALU: 'Aluminij',
  INOX: 'Inox',
  WPC: 'WPC',
}

const POST_TYPE_COLORS: Record<PostType, string> = {
  KONCNI: '#f59e0b',
  VMESNI: '#22c55e',
  VOGALNI: '#ef4444',
}

const POST_MATERIAL_FILLS: Record<PostMaterial, string> = {
  ALU: '#cbd5e1',
  INOX: '#94a3b8',
  WPC: '#a16207',
}

const STORAGE_PREFIX = 'roksal_floorplan_'

// ============================================================================
// POMOŽNE FUNKCIJE — geometrija
// ============================================================================

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function dist(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2)
}

// Razdalja od točke P do segmenta AB
function distToSegment(p: Point, a: Point, b: Point): number {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
  if (l2 === 0) return dist(p, a)
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2
  t = Math.max(0, Math.min(1, t))
  const proj: Point = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
  return dist(p, proj)
}

// Projekcija točke na segment (parameter 0..1)
function projectOnSegment(p: Point, a: Point, b: Point): number {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
  if (l2 === 0) return 0
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2
  t = Math.max(0, Math.min(1, t))
  return t
}

function pointOnWall(wall: WallElement, t: number): Point {
  return {
    x: wall.a.x + t * (wall.b.x - wall.a.x),
    y: wall.a.y + t * (wall.b.y - wall.a.y),
  }
}

function wallLength(wall: WallElement): number {
  return dist(wall.a, wall.b)
}

function wallAngle(wall: WallElement): number {
  return Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x)
}

// Vrstni red točk za zaprt poligon (za površino)
function polygonArea(points: Point[]): number {
  if (points.length < 3) return 0
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    area += points[i].x * points[j].y
    area -= points[j].x * points[i].y
  }
  return Math.abs(area) / 2
}

// ============================================================================
// POMOŽNE FUNKCIJE — formatiranje
// ============================================================================

function fmtMm(mm: number): string {
  if (mm >= 1000) return `${(mm / 1000).toFixed(2)} m`
  return `${Math.round(mm)} mm`
}

function fmtM(mm: number): string {
  return `${(mm / 1000).toFixed(2)} m`
}

function fmtM2(mm2: number): string {
  return `${(mm2 / 1_000_000).toFixed(2)} m²`
}

// ============================================================================
// KOMPONENTA
// ============================================================================

interface FloorPlanTabProps {
  projectId: string | null
}

export function FloorPlanTab({ projectId }: FloorPlanTabProps) {
  const { toast } = useToast()

  // --- Stanje elementov ---
  const [elements, setElements] = useState<FloorElement[]>([])
  const [selectedTool, setSelectedTool] = useState<Tool>('select')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // --- Pogled (zoom/pan) ---
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 })

  // --- Risalna stanja ---
  const [pendingPoint, setPendingPoint] = useState<Point | null>(null) // za wall/dimension: prva točka
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null) // za prikaz predogleda
  const [dragMove, setDragMove] = useState<{
    id: string
    startWorld: Point
    original: FloorElement
  } | null>(null)
  const [panDrag, setPanDrag] = useState<{
    startScreen: Point
    startPan: Point
  } | null>(null)

  // --- Dialogi ---
  const [dimDialog, setDimDialog] = useState<{
    a: Point
    b: Point
    realMm: string
  } | null>(null)
  const [textDialog, setTextDialog] = useState<{
    x: number
    y: number
    text: string
  } | null>(null)

  // --- Layers ---
  const [layers, setLayers] = useState<Layers>({
    walls: true,
    posts: true,
    doors: true,
    windows: true,
    dimensions: true,
    texts: true,
  })
  const [layersOpen, setLayersOpen] = useState(false)

  // --- Zgodovina (undo/redo) ---
  const [history, setHistory] = useState<HistorySnapshot[]>([])
  const [historyIdx, setHistoryIdx] = useState(-1)

  // --- Statistike (izračunane) ---
  const stats = useMemo(() => {
    const walls = elements.filter((e): e is WallElement => e.type === 'wall')
    const posts = elements.filter((e): e is PostElement => e.type === 'post')
    const doors = elements.filter((e): e is DoorElement => e.type === 'door')
    const windows = elements.filter((e): e is WindowElement => e.type === 'window')
    const totalWallLength = walls.reduce((sum, w) => sum + wallLength(w), 0)
    // Površina: poskusimo iz točk sten (poenostavljeno — naredimo luknjo čez vse akter/eps)
    const allPoints = walls.flatMap((w) => [w.a, w.b])
    const area = allPoints.length >= 3 ? polygonArea(allPoints) : 0
    return {
      wallLengthM: totalWallLength / 1000,
      postCount: posts.length,
      doorCount: doors.length,
      windowCount: windows.length,
      areaM2: area / 1_000_000,
      perimeterM: totalWallLength / 1000,
    }
  }, [elements])

  // --- Canvas ref ---
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerSize, setContainerSize] = useState({ w: 800, h: 480 })

  // --- Resize observer za container ---
  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const update = () => {
      setContainerSize({ w: el.clientWidth, h: el.clientHeight })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // --- Nalaganje iz localStorage ob spremembi projekta ---
  useEffect(() => {
    if (!projectId) {
      setElements([])
      return
    }
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + projectId)
      if (raw) {
        const parsed = JSON.parse(raw) as FloorElement[]
        if (Array.isArray(parsed)) {
          setElements(parsed)
          // Počisti zgodovino, nastavi začetni snapshot
          setHistory([{ elements: parsed }])
          setHistoryIdx(0)
          return
        }
      }
    } catch {
      // ignore
    }
    setElements([])
    setHistory([{ elements: [] }])
    setHistoryIdx(0)
    // Center view
    setZoom(DEFAULT_ZOOM)
    setPan({ x: containerSize.w / 2, y: containerSize.h / 2 })
  }, [projectId])

  // --- Shrani v localStorage ob spremembi ---
  useEffect(() => {
    if (!projectId) return
    try {
      localStorage.setItem(STORAGE_PREFIX + projectId, JSON.stringify(elements))
    } catch {
      // ignore quota errors
    }
  }, [elements, projectId])

  // --- zgodovina push ---
  const pushHistory = useCallback((next: FloorElement[]) => {
    setHistory((prev) => {
      const truncated = prev.slice(0, historyIdx + 1)
      truncated.push({ elements: next })
      const capped = truncated.slice(-50) // omeji na 50 korakov
      return capped
    })
    setHistoryIdx((prev) => Math.min(prev + 1, 49))
  }, [historyIdx])

  // --- Undo / Redo ---
  const undo = useCallback(() => {
    if (historyIdx <= 0) return
    const newIdx = historyIdx - 1
    setHistoryIdx(newIdx)
    const snap = history[newIdx]
    if (snap) setElements(snap.elements)
    toast({ title: 'Razveljavljeno' })
  }, [history, historyIdx, toast])

  const redo = useCallback(() => {
    if (historyIdx >= history.length - 1) return
    const newIdx = historyIdx + 1
    setHistoryIdx(newIdx)
    const snap = history[newIdx]
    if (snap) setElements(snap.elements)
    toast({ title: 'Ponovljeno' })
  }, [history, historyIdx, toast])

  // --- Update element z zgodovino ---
  const updateElements = useCallback((updater: (prev: FloorElement[]) => FloorElement[], record = true) => {
    setElements((prev) => {
      const next = updater(prev)
      if (record) {
        // Async history push (avoid setState-in-setState trap)
        setTimeout(() => pushHistory(next), 0)
      }
      return next
    })
  }, [pushHistory])

  // ============================================================================
  // KOORDINATNI SISTEM: world <-> screen
  // ============================================================================

  const worldToScreen = useCallback((p: Point): Point => {
    return { x: p.x * zoom + pan.x, y: p.y * zoom + pan.y }
  }, [zoom, pan])

  const screenToWorld = useCallback((p: Point): Point => {
    return { x: (p.x - pan.x) / zoom, y: (p.y - pan.y) / zoom }
  }, [zoom, pan])

  // ============================================================================
  // IZRIS PLATNA
  // ============================================================================

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = containerSize.w
    const h = containerSize.h
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr
      canvas.height = h * dpr
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    // Ozadje
    ctx.fillStyle = '#fafbfc'
    ctx.fillRect(0, 0, w, h)

    // --- Grid ---
    drawGrid(ctx, w, h, zoom, pan)

    // --- Osi ---
    drawAxes(ctx, w, h, zoom, pan)

    // --- Elementi ---
    const selectedEl = elements.find((e) => e.id === selectedId) || null

    // Stene (najprej, da so drugi elementi nad njimi)
    if (layers.walls) {
      elements
        .filter((e): e is WallElement => e.type === 'wall')
        .forEach((wall) => drawWall(ctx, wall, zoom, pan, wall.id === selectedId))
    }

    // Okna in vrata na stenah
    if (layers.doors) {
      elements
        .filter((e): e is DoorElement => e.type === 'door')
        .forEach((door) => {
          const wall = elements.find((e) => e.id === door.wallId && e.type === 'wall') as WallElement | undefined
          if (wall) drawDoor(ctx, wall, door, zoom, pan, door.id === selectedId)
        })
    }
    if (layers.windows) {
      elements
        .filter((e): e is WindowElement => e.type === 'window')
        .forEach((win) => {
          const wall = elements.find((e) => e.id === win.wallId && e.type === 'wall') as WallElement | undefined
          if (wall) drawWindow(ctx, wall, win, zoom, pan, win.id === selectedId)
        })
    }

    // Stebri
    if (layers.posts) {
      elements
        .filter((e): e is PostElement => e.type === 'post')
        .forEach((post) => drawPost(ctx, post, zoom, pan, post.id === selectedId))
    }

    // Mere
    if (layers.dimensions) {
      elements
        .filter((e): e is DimensionElement => e.type === 'dimension')
        .forEach((dim) => drawDimension(ctx, dim, zoom, pan, dim.id === selectedId))
    }

    // Besedila
    if (layers.texts) {
      elements
        .filter((e): e is TextElement => e.type === 'text')
        .forEach((txt) => drawText(ctx, txt, zoom, pan, txt.id === selectedId))
    }

    // --- Predogled med risanjem ---
    if (pendingPoint && hoverPoint) {
      const a = worldToScreen(pendingPoint)
      const b = worldToScreen(hoverPoint)
      ctx.save()
      ctx.strokeStyle = AMBER
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
      ctx.setLineDash([])
      // Točka A
      ctx.fillStyle = AMBER
      ctx.beginPath()
      ctx.arc(a.x, a.y, 5, 0, Math.PI * 2)
      ctx.fill()
      // Točka B (hover)
      ctx.strokeStyle = AMBER
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(b.x, b.y, 5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()

      // Dolžina preview (za stene)
      if (selectedTool === 'wall') {
        const len = dist(pendingPoint, hoverPoint)
        const mid: Point = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        ctx.save()
        ctx.fillStyle = NAVY
        ctx.font = 'bold 11px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(fmtMm(len), mid.x, mid.y - 8)
        ctx.restore()
      }
    }

    // --- Križec na hover za post/text ---
    if ((selectedTool === 'post' || selectedTool === 'text' || selectedTool === 'eraser') && hoverPoint) {
      const s = worldToScreen(hoverPoint)
      ctx.save()
      ctx.strokeStyle = AMBER
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(s.x - 10, s.y)
      ctx.lineTo(s.x + 10, s.y)
      ctx.moveTo(s.x, s.y - 10)
      ctx.lineTo(s.x, s.y + 10)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
    }
  }, [containerSize, elements, selectedId, zoom, pan, layers, pendingPoint, hoverPoint, selectedTool, worldToScreen])

  useEffect(() => {
    draw()
  }, [draw])

  // ============================================================================
  // HIT TESTING
  // ============================================================================

  const hitTest = useCallback((world: Point): FloorElement | null => {
    const tol = HIT_TOLERANCE_PX / zoom // v svetovnih enotah
    // Preverjamo v obratnem vrstnem redu (zgornji elementi najprej)
    const reversed = [...elements].reverse()
    for (const el of reversed) {
      if (el.type === 'post') {
        if (!layers.posts) continue
        if (dist(world, { x: el.x, y: el.y }) <= POST_RADIUS_MM + tol) return el
      } else if (el.type === 'text') {
        if (!layers.texts) continue
        // poenostavljena hit test: tolerance box ~50mm okrog
        if (Math.abs(world.x - el.x) < 200 && Math.abs(world.y - el.y) < 50) return el
      } else if (el.type === 'dimension') {
        if (!layers.dimensions) continue
        if (distToSegment(world, el.a, el.b) < tol + 30) return el
      } else if (el.type === 'wall') {
        if (!layers.walls) continue
        if (distToSegment(world, el.a, el.b) < tol + (el.thicknessMm / 2)) return el
      } else if (el.type === 'door' || el.type === 'window') {
        if (el.type === 'door' && !layers.doors) continue
        if (el.type === 'window' && !layers.windows) continue
        const wall = elements.find((e) => e.id === el.wallId && e.type === 'wall') as WallElement | undefined
        if (!wall) continue
        const p = pointOnWall(wall, el.position)
        if (distToSegment(world, wall.a, wall.b) < tol + 50 && dist(world, p) < el.widthMm / 2 + 50) {
          return el
        }
      }
    }
    return null
  }, [elements, zoom, layers])

  // ============================================================================
  // INTERAKCIJE — miška / dotik
  // ============================================================================

  function getCanvasPoint(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const screenPt = getCanvasPoint(e)
    const world = screenToWorld(screenPt)

    // Pan: srednji gumb ali space+drag ali tool "select" z desnim klikom
    if (e.button === 1 || e.button === 2 || (e.buttons === 4)) {
      setPanDrag({ startScreen: screenPt, startPan: { ...pan } })
      e.preventDefault()
      return
    }

    // Glede na orodje
    if (selectedTool === 'select') {
      const hit = hitTest(world)
      if (hit) {
        setSelectedId(hit.id)
      } else {
        setSelectedId(null)
        // Lahko pan z levim klikom v prazno
        setPanDrag({ startScreen: screenPt, startPan: { ...pan } })
      }
      return
    }

    if (selectedTool === 'move') {
      const hit = hitTest(world)
      if (hit) {
        setSelectedId(hit.id)
        setDragMove({ id: hit.id, startWorld: world, original: JSON.parse(JSON.stringify(hit)) })
      }
      return
    }

    if (selectedTool === 'eraser') {
      const hit = hitTest(world)
      if (hit) {
        updateElements((prev) => prev.filter((e) => e.id !== hit.id))
        setSelectedId(null)
        toast({ title: 'Izbrisano', description: `${elementLabel(hit)} izbrisan.` })
      }
      return
    }

    if (selectedTool === 'wall' || selectedTool === 'dimension') {
      if (!pendingPoint) {
        setPendingPoint(world)
      } else {
        if (selectedTool === 'wall') {
          const newWall: WallElement = {
            id: uid('wall'),
            type: 'wall',
            a: pendingPoint,
            b: world,
            heightMm: 1100,
            thicknessMm: 100,
          }
          updateElements((prev) => [...prev, newWall])
          setSelectedId(newWall.id)
          setPendingPoint(null)
          toast({ title: 'Stena dodana', description: `Dolžina: ${fmtMm(wallLength(newWall))}` })
        } else {
          // Dimension: odpri dialog za realno dolžino
          setDimDialog({ a: pendingPoint, b: world, realMm: String(Math.round(dist(pendingPoint, world))) })
          setPendingPoint(null)
        }
      }
      return
    }

    if (selectedTool === 'post') {
      // Najdi naslednjo oznako S1, S2...
      const existingPosts = elements.filter((e): e is PostElement => e.type === 'post')
      const nextNum = existingPosts.length + 1
      const newPost: PostElement = {
        id: uid('post'),
        type: 'post',
        x: world.x,
        y: world.y,
        label: `S${nextNum}`,
        postType: 'VMESNI',
        heightMm: 1100,
        material: 'ALU',
      }
      updateElements((prev) => [...prev, newPost])
      setSelectedId(newPost.id)
      toast({ title: 'Stebriček dodan', description: `${newPost.label} — ${POST_TYPE_LABELS[newPost.postType]}` })
      return
    }

    if (selectedTool === 'text') {
      setTextDialog({ x: world.x, y: world.y, text: '' })
      return
    }

    if (selectedTool === 'door' || selectedTool === 'window') {
      // Najdi najbližjo steno in pozicijo na njej
      const walls = elements.filter((e): e is WallElement => e.type === 'wall')
      if (walls.length === 0) {
        toast({ title: 'Ni sten', description: 'Najprej narišite steno.', variant: 'destructive' })
        return
      }
      let best: { wall: WallElement; t: number; d: number } | null = null
      for (const w of walls) {
        const t = projectOnSegment(world, w.a, w.b)
        const p = pointOnWall(w, t)
        const d = dist(world, p)
        if (!best || d < best.d) best = { wall: w, t, d }
      }
      if (!best) return
      if (best.d > 500) {
        toast({ title: 'Preveč stran od stene', description: 'Kliknite bliže steni.', variant: 'destructive' })
        return
      }
      if (selectedTool === 'door') {
        const newDoor: DoorElement = {
          id: uid('door'),
          type: 'door',
          wallId: best.wall.id,
          position: best.t,
          widthMm: 900,
          swing: 'single',
        }
        updateElements((prev) => [...prev, newDoor])
        setSelectedId(newDoor.id)
        toast({ title: 'Vrata dodana', description: `Širina: ${fmtMm(newDoor.widthMm)}` })
      } else {
        const newWindow: WindowElement = {
          id: uid('window'),
          type: 'window',
          wallId: best.wall.id,
          position: best.t,
          widthMm: 1200,
          heightMm: 1100,
        }
        updateElements((prev) => [...prev, newWindow])
        setSelectedId(newWindow.id)
        toast({ title: 'Okno dodano', description: `Širina: ${fmtMm(newWindow.widthMm)}` })
      }
      return
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const screenPt = getCanvasPoint(e)
    const world = screenToWorld(screenPt)
    setHoverPoint(world)

    // Pan drag
    if (panDrag) {
      const dx = screenPt.x - panDrag.startScreen.x
      const dy = screenPt.y - panDrag.startScreen.y
      setPan({ x: panDrag.startPan.x + dx, y: panDrag.startPan.y + dy })
      return
    }

    // Move element
    if (dragMove) {
      const dx = world.x - dragMove.startWorld.x
      const dy = world.y - dragMove.startWorld.y
      updateElements((prev) =>
        prev.map((el) => {
          if (el.id !== dragMove.id) return el
          if (el.type === 'post') {
            return { ...el, x: (dragMove.original as PostElement).x + dx, y: (dragMove.original as PostElement).y + dy }
          }
          if (el.type === 'text') {
            return { ...el, x: (dragMove.original as TextElement).x + dx, y: (dragMove.original as TextElement).y + dy }
          }
          if (el.type === 'wall') {
            const o = dragMove.original as WallElement
            return {
              ...el,
              a: { x: o.a.x + dx, y: o.a.y + dy },
              b: { x: o.b.x + dx, y: o.b.y + dy },
            }
          }
          if (el.type === 'dimension') {
            const o = dragMove.original as DimensionElement
            return {
              ...el,
              a: { x: o.a.x + dx, y: o.a.y + dy },
              b: { x: o.b.x + dx, y: o.b.y + dy },
            }
          }
          // Door/Window: premakni pozicijo vzdolž stene (ali pa ignoriraj)
          return el
        }),
        false // ne snemaj zgodovine pri vsakem pikslu
      )
    }
  }

  function handlePointerUp() {
    if (dragMove) {
      // Zapiši zgodovino po koncu premika
      pushHistory(elements)
      setDragMove(null)
    }
    if (panDrag) setPanDrag(null)
  }

  function handleWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const screenPt = getCanvasPoint(e as unknown as React.PointerEvent<HTMLCanvasElement>)
    const worldBefore = screenToWorld(screenPt)

    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor))
    setZoom(newZoom)

    // Ohrani točko pod miško
    const worldAfter = { x: (screenPt.x - pan.x) / newZoom, y: (screenPt.y - pan.y) / newZoom }
    const dx = worldAfter.x - worldBefore.x
    const dy = worldAfter.y - worldBefore.y
    setPan((p) => ({ x: p.x + dx * newZoom, y: p.y + dy * newZoom }))
  }

  // Pinch zoom (touch)
  const pinchRef = useRef<{ dist: number; mid: Point; zoom: number; pan: Point } | null>(null)

  function handleTouchStart(e: React.TouchEvent<HTMLCanvasElement>) {
    if (e.touches.length === 2) {
      const t1 = e.touches[0]
      const t2 = e.touches[1]
      const d = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      const rect = canvasRef.current!.getBoundingClientRect()
      const mid: Point = { x: (t1.clientX + t2.clientX) / 2 - rect.left, y: (t1.clientY + t2.clientY) / 2 - rect.top }
      pinchRef.current = { dist: d, mid, zoom, pan: { ...pan } }
    }
  }

  function handleTouchMove(e: React.TouchEvent<HTMLCanvasElement>) {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault()
      const t1 = e.touches[0]
      const t2 = e.touches[1]
      const d = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      const factor = d / pinchRef.current.dist
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchRef.current.zoom * factor))
      const worldBefore = {
        x: (pinchRef.current.mid.x - pinchRef.current.pan.x) / pinchRef.current.zoom,
        y: (pinchRef.current.mid.y - pinchRef.current.pan.y) / pinchRef.current.zoom,
      }
      const newPan = {
        x: pinchRef.current.mid.x - worldBefore.x * newZoom,
        y: pinchRef.current.mid.y - worldBefore.y * newZoom,
      }
      setZoom(newZoom)
      setPan(newPan)
    }
  }

  function handleTouchEnd() {
    pinchRef.current = null
  }

  // ============================================================================
  // UKAZI — zoom, reset, brisi vse
  // ============================================================================

  function zoomBy(factor: number) {
    const center: Point = { x: containerSize.w / 2, y: containerSize.h / 2 }
    const worldBefore = screenToWorld(center)
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor))
    const newPan = {
      x: center.x - worldBefore.x * newZoom,
      y: center.y - worldBefore.y * newZoom,
    }
    setZoom(newZoom)
    setPan(newPan)
  }

  function resetView() {
    setZoom(DEFAULT_ZOOM)
    setPan({ x: containerSize.w / 2, y: containerSize.h / 2 })
    toast({ title: 'Pogled ponastavljen' })
  }

  function clearAll() {
    if (elements.length === 0) return
    if (!window.confirm('Pobrisati vse elemente tlorisa?')) return
    updateElements(() => [])
    setSelectedId(null)
    setPendingPoint(null)
    toast({ title: 'Tloris pobrisan' })
  }

  // ============================================================================
  // UKAZI — dialogi (dimenzija, besedilo)
  // ============================================================================

  function confirmDimension() {
    if (!dimDialog) return
    const realMm = parseFloat(dimDialog.realMm)
    if (!Number.isFinite(realMm) || realMm <= 0) {
      toast({ title: 'Vnesite veljavno dolžino', variant: 'destructive' })
      return
    }
    const newDim: DimensionElement = {
      id: uid('dim'),
      type: 'dimension',
      a: dimDialog.a,
      b: dimDialog.b,
      label: fmtMm(realMm),
      realMm,
    }
    updateElements((prev) => [...prev, newDim])
    setSelectedId(newDim.id)
    setDimDialog(null)
    toast({ title: 'Mera dodana', description: newDim.label })
  }

  function confirmText() {
    if (!textDialog || !textDialog.text.trim()) {
      toast({ title: 'Vnesite besedilo', variant: 'destructive' })
      return
    }
    const newText: TextElement = {
      id: uid('text'),
      type: 'text',
      x: textDialog.x,
      y: textDialog.y,
      text: textDialog.text.trim(),
    }
    updateElements((prev) => [...prev, newText])
    setSelectedId(newText.id)
    setTextDialog(null)
    toast({ title: 'Besedilo dodano' })
  }

  // ============================================================================
  // POSODABLJANJE LASTNOSTI IZBRANEGA ELEMENTA
  // ============================================================================

  function updateSelected(patch: Partial<FloorElement>) {
    if (!selectedId) return
    updateElements((prev) =>
      prev.map((el) => (el.id === selectedId ? ({ ...el, ...patch } as FloorElement) : el))
    )
  }

  function deleteSelected() {
    if (!selectedId) return
    updateElements((prev) => prev.filter((e) => e.id !== selectedId))
    setSelectedId(null)
    toast({ title: 'Element izbrisan' })
  }

  const selectedElement = useMemo(
    () => elements.find((e) => e.id === selectedId) || null,
    [elements, selectedId]
  )

  // ============================================================================
  // UVOZ IZ MERITEV
  // ============================================================================

  async function importFromMeasurements() {
    if (!projectId) {
      toast({ title: 'Brez projekta', description: 'Izberite projekt na zavihku Domov.', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch(`/api/measurements?projectId=${encodeURIComponent(projectId)}`)
      if (!res.ok) throw new Error('Napaka')
      const raw = (await res.json()) as Array<{
        id: string
        dolzinaMm: number
        visinaMm: number
        arMetadata?: string | null
      }>
      let postCount = 0
      let dimCount = 0
      const newElements: FloorElement[] = []
      //Začetek pri (0,0) in razporeditev vzdolž x osi
      let cursorX = 0
      const startY = 0

      for (const m of raw) {
        let ar: Record<string, unknown> = {}
        try {
          ar = m.arMetadata ? JSON.parse(m.arMetadata) : {}
        } catch {
          // ignore
        }
        const tip = (ar.tipMeritve as string) || 'RAZDALJA'
        if (tip === 'STEBR') {
          // Postavimo stebriček na (cursorX, 0) z višino in materialom iz ar
          const label = (ar.steberOznaka as string) || `S${postCount + 1}`
          const postType = (ar.tipStebra as PostType) || 'VMESNI'
          const material = (ar.materialStebra as PostMaterial) || 'ALU'
          const heightMm = (ar.visinaStebraMm as number) || m.visinaMm || 1100
          newElements.push({
            id: uid('post'),
            type: 'post',
            x: cursorX,
            y: startY,
            label,
            postType,
            heightMm,
            material,
          })
          postCount++
          cursorX += 1500 // 1.5m razmik
        } else if (tip === 'RAZDALJA' || tip === 'VISINA') {
          // Dodaj dimenzijo horizontalno od cursorX do cursorX + dolzinaMm
          const a: Point = { x: cursorX, y: 0 }
          const b: Point = { x: cursorX + m.dolzinaMm, y: 0 }
          newElements.push({
            id: uid('dim'),
            type: 'dimension',
            a,
            b,
            label: fmtMm(m.dolzinaMm),
            realMm: m.dolzinaMm,
          })
          dimCount++
          cursorX += m.dolzinaMm + 300
        }
        // KOT_VOGAL: označimo z besedilom
        else if (tip === 'KOT_VOGAL') {
          const kot = (ar.kotStopinje as number) || (ar.notranjiKot as number) || 90
          newElements.push({
            id: uid('text'),
            type: 'text',
            x: cursorX,
            y: 200,
            text: `Vogal ${Math.round(kot)}°`,
          })
          cursorX += 800
        }
      }

      if (newElements.length === 0) {
        toast({ title: 'Brez podatkov', description: 'V projektu ni ustreznih meritev.' })
        return
      }

      updateElements((prev) => [...prev, ...newElements])
      // Prilagodi pogled, da vsebuje vse
      const allX = newElements.flatMap((e) => {
        if (e.type === 'post') return [e.x]
        if (e.type === 'text') return [e.x]
        if (e.type === 'wall') return [e.a.x, e.b.x]
        if (e.type === 'dimension') return [e.a.x, e.b.x]
        return []
      })
      const allY = newElements.flatMap((e) => {
        if (e.type === 'post') return [e.y]
        if (e.type === 'text') return [e.y]
        if (e.type === 'wall') return [e.a.y, e.b.y]
        if (e.type === 'dimension') return [e.a.y, e.b.y]
        return []
      })
      if (allX.length > 0) {
        const minX = Math.min(...allX)
        const maxX = Math.max(...allX)
        const minY = Math.min(...allY)
        const maxY = Math.max(...allY)
        const wWorld = maxX - minX || 1000
        const hWorld = maxY - minY || 1000
        const newZoom = Math.min(
          (containerSize.w - 80) / wWorld,
          (containerSize.h - 80) / hWorld,
          MAX_ZOOM
        )
        const z = Math.max(MIN_ZOOM, newZoom)
        const cx = (minX + maxX) / 2
        const cy = (minY + maxY) / 2
        setZoom(z)
        setPan({ x: containerSize.w / 2 - cx * z, y: containerSize.h / 2 - cy * z })
      }
      toast({
        title: 'Uvoz uspešen',
        description: `Uvoženih: ${postCount} stebrov, ${dimCount} mer.`,
      })
    } catch (err) {
      console.error(err)
      toast({ title: 'Napaka pri uvozu', variant: 'destructive' })
    }
  }

  // ============================================================================
  // IZVOZ PNG
  // ============================================================================

  function exportPNG() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `tloris_${projectId ?? 'projekt'}_${Date.now()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    toast({ title: 'PNG izvožen' })
  }

  // ============================================================================
  // SHRANI KOT SKICO
  // ============================================================================

  async function saveAsSketch() {
    const canvas = canvasRef.current
    if (!canvas) {
      toast({ title: 'Platno ni na voljo', variant: 'destructive' })
      return
    }
    if (!projectId) {
      toast({ title: 'Brez projekta', description: 'Izberite projekt na zavihku Domov.', variant: 'destructive' })
      return
    }
    try {
      const pngData = canvas.toDataURL('image/png')
      const res = await fetch('/api/sketches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          naziv: `Tloris ${new Date().toLocaleDateString('sl-SI')}`,
          pngData,
          povzetek: `Tloris z ${stats.postCount} stebri, ${stats.doorCount} vrati, ${stats.windowCount} okni. Skupna dolžina sten: ${stats.wallLengthM.toFixed(2)} m.`,
        }),
      })
      if (!res.ok) throw new Error('Napaka')
      toast({ title: 'Shranjeno kot skica', description: 'Tloris je shranjen v zavihku Skice.' })
    } catch (err) {
      console.error(err)
      toast({ title: 'Napaka pri shranjevanju', variant: 'destructive' })
    }
  }

  // ============================================================================
  // IZVOZ PDF
  // ============================================================================

  function exportPDF() {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()

      // Glava — navy pas
      doc.setFillColor(29, 43, 62)
      doc.rect(0, 0, pageW, 26, 'F')
      // Amber kvadratek
      doc.setFillColor(245, 158, 11)
      doc.rect(14, 7, 12, 12, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('R', 18, 16)
      // Naziv
      doc.setFontSize(14)
      doc.text('ROKSAL d.o.o. Kranj', 30, 13)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text('Tloris balkona z elementi', 30, 19)
      // Datum desno
      doc.setFontSize(8)
      doc.text(new Date().toLocaleDateString('sl-SI'), pageW - 14, 13, { align: 'right' })
      if (projectId) {
        doc.text(`Projekt: ${projectId.slice(-6).toUpperCase()}`, pageW - 14, 19, { align: 'right' })
      }

      let y = 36
      // Slika tlorisa
      const pngData = canvas.toDataURL('image/png')
      const imgW = pageW - 28
      const imgH = (canvas.height / canvas.width) * imgW
      doc.addImage(pngData, 'PNG', 14, y, imgW, Math.min(imgH, 130))
      y += Math.min(imgH, 130) + 6

      // Statistike
      doc.setTextColor(17, 24, 39)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('STATISTIKE', 14, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(`Skupna dolžina sten: ${stats.wallLengthM.toFixed(2)} m`, 14, y)
      y += 5
      doc.text(`Število stebrov: ${stats.postCount}`, 14, y)
      y += 5
      doc.text(`Število vrat: ${stats.doorCount}`, 14, y)
      y += 5
      doc.text(`Število oken: ${stats.windowCount}`, 14, y)
      y += 5
      doc.text(`Površina: ${stats.areaM2.toFixed(2)} m²   Obseg: ${stats.perimeterM.toFixed(2)} m`, 14, y)
      y += 8

      // Legenda
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('LEGENDA', 14, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      // Stene
      doc.setDrawColor(29, 43, 62)
      doc.setLineWidth(1.5)
      doc.line(14, y - 1, 24, y - 1)
      doc.text('Stena', 28, y)
      y += 5
      // Stebriček
      doc.setFillColor(245, 158, 11)
      doc.circle(19, y - 1, 2, 'F')
      doc.text('Stebriček (S1, S2, ...)', 28, y)
      y += 5
      // Vrata
      doc.setDrawColor(14, 165, 233)
      doc.setLineWidth(1)
      doc.line(14, y - 1, 24, y - 1)
      doc.text('Vrata', 28, y)
      y += 5
      // Okno
      doc.setDrawColor(6, 182, 212)
      doc.setLineWidth(1)
      doc.line(14, y - 1, 24, y - 1)
      doc.text('Okno', 28, y)
      y += 5
      // Mera
      doc.setDrawColor(34, 197, 94)
      doc.setLineWidth(1)
      doc.line(14, y - 1, 24, y - 1)
      doc.text('Mera (dimenzija)', 28, y)
      y += 8

      // Dimenzije tabela
      const dims = elements.filter((e): e is DimensionElement => e.type === 'dimension')
      if (dims.length > 0) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.text('DIMENZIJE', 14, y)
        y += 5
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        dims.forEach((d, i) => {
          doc.text(`${i + 1}. ${d.label} (oznaka: ${d.id.slice(-4).toUpperCase()})`, 14, y)
          y += 5
          if (y > pageH - 20) {
            doc.addPage()
            y = 20
          }
        })
      }

      // Noga
      doc.setFontSize(7)
      doc.setTextColor(107, 114, 128)
      doc.text(
        `Roksal d.o.o., Kranj — Tloris generiran ${new Date().toLocaleString('sl-SI')}`,
        14,
        pageH - 10
      )

      doc.save(`tloris_${projectId ?? 'projekt'}_${Date.now()}.pdf`)
      toast({ title: 'PDF izvožen' })
    } catch (err) {
      console.error(err)
      toast({ title: 'Napaka pri izvozu PDF', variant: 'destructive' })
    }
  }

  // ============================================================================
  // IZVOZ DXF
  // ============================================================================

  function exportDXF() {
    try {
      const lines: string[] = []
      lines.push('0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '0', 'ENDSEC')
      lines.push('0', 'SECTION', '2', 'ENTITIES')

      const wallEls = elements.filter((e): e is WallElement => e.type === 'wall')
      const postEls = elements.filter((e): e is PostElement => e.type === 'post')
      const doorEls = elements.filter((e): e is DoorElement => e.type === 'door')
      const windowEls = elements.filter((e): e is WindowElement => e.type === 'window')
      const dimEls = elements.filter((e): e is DimensionElement => e.type === 'dimension')
      const textEls = elements.filter((e): e is TextElement => e.type === 'text')

      // Stene kot LINE
      wallEls.forEach((w) => {
        lines.push(
          '0', 'LINE',
          '8', 'STENE',
          '10', String(w.a.x),
          '20', String(-w.a.y), // DXF Y navzgor
          '11', String(w.b.x),
          '21', String(-w.b.y),
          '62', '5' // modra (ACAD color index)
        )
      })

      // Stebri kot CIRCLE
      postEls.forEach((p) => {
        lines.push(
          '0', 'CIRCLE',
          '8', 'STEBRI',
          '10', String(p.x),
          '20', String(-p.y),
          '40', String(POST_RADIUS_MM),
          '62', '2'
        )
        // Label kot TEXT
        lines.push(
          '0', 'TEXT',
          '8', 'STEBRI_OZNAKE',
          '10', String(p.x + 60),
          '20', String(-p.y),
          '40', '80',
          '1', p.label
        )
      })

      // Vrata — predstavljena kot LINE z razmikom
      doorEls.forEach((d) => {
        const wall = wallEls.find((w) => w.id === d.wallId)
        if (!wall) return
        const len = wallLength(wall)
        if (len === 0) return
        const halfW = d.widthMm / 2
        const ang = wallAngle(wall)
        const center = pointOnWall(wall, d.position)
        const p1: Point = {
          x: center.x - Math.cos(ang) * halfW,
          y: center.y - Math.sin(ang) * halfW,
        }
        const p2: Point = {
          x: center.x + Math.cos(ang) * halfW,
          y: center.y + Math.sin(ang) * halfW,
        }
        lines.push(
          '0', 'LINE',
          '8', 'VRATA',
          '10', String(p1.x),
          '20', String(-p1.y),
          '11', String(p2.x),
          '21', String(-p2.y),
          '62', '4'
        )
      })

      // Okna — predstavljena kot 2 LINE
      windowEls.forEach((win) => {
        const wall = wallEls.find((w) => w.id === win.wallId)
        if (!wall) return
        const len = wallLength(wall)
        if (len === 0) return
        const halfW = win.widthMm / 2
        const ang = wallAngle(wall)
        const center = pointOnWall(wall, win.position)
        const perp: Point = { x: -Math.sin(ang), y: Math.cos(ang) }
        const offset = 30
        const p1: Point = {
          x: center.x - Math.cos(ang) * halfW + perp.x * offset,
          y: center.y - Math.sin(ang) * halfW + perp.y * offset,
        }
        const p2: Point = {
          x: center.x + Math.cos(ang) * halfW + perp.x * offset,
          y: center.y + Math.sin(ang) * halfW + perp.y * offset,
        }
        const p3: Point = {
          x: center.x - Math.cos(ang) * halfW - perp.x * offset,
          y: center.y - Math.sin(ang) * halfW - perp.y * offset,
        }
        const p4: Point = {
          x: center.x + Math.cos(ang) * halfW - perp.x * offset,
          y: center.y + Math.sin(ang) * halfW - perp.y * offset,
        }
        lines.push(
          '0', 'LINE', '8', 'OKNA',
          '10', String(p1.x), '20', String(-p1.y),
          '11', String(p2.x), '21', String(-p2.y), '62', '5'
        )
        lines.push(
          '0', 'LINE', '8', 'OKNA',
          '10', String(p3.x), '20', String(-p3.y),
          '11', String(p4.x), '21', String(-p4.y), '62', '5'
        )
      })

      // Mere kot LINE + TEXT
      dimEls.forEach((d) => {
        lines.push(
          '0', 'LINE',
          '8', 'MERE',
          '10', String(d.a.x),
          '20', String(-d.a.y),
          '11', String(d.b.x),
          '21', String(-d.b.y),
          '62', '3'
        )
        const mid: Point = { x: (d.a.x + d.b.x) / 2, y: (d.a.y + d.b.y) / 2 }
        lines.push(
          '0', 'TEXT',
          '8', 'MERE',
          '10', String(mid.x),
          '20', String(-mid.y - 100),
          '40', '80',
          '1', d.label
        )
      })

      // Besedila
      textEls.forEach((t) => {
        lines.push(
          '0', 'TEXT',
          '8', 'BESEDILA',
          '10', String(t.x),
          '20', String(-t.y),
          '40', '100',
          '1', t.text
        )
      })

      lines.push('0', 'ENDSEC', '0', 'EOF')

      const blob = new Blob([lines.join('\n')], { type: 'application/dxf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `tloris_${projectId ?? 'projekt'}_${Date.now()}.dxf`
      link.click()
      URL.revokeObjectURL(url)
      toast({ title: 'DXF izvožen', description: 'Datoteka za CAD uvoz.' })
    } catch (err) {
      console.error(err)
      toast({ title: 'Napaka pri izvozu DXF', variant: 'destructive' })
    }
  }

  // ============================================================================
  // RENDER — UI
  // ============================================================================

  const tools: { id: Tool; label: string; icon: React.ElementType; hint: string }[] = [
    { id: 'select', label: 'Izberi', icon: Crosshair, hint: 'Izbira in pan' },
    { id: 'wall', label: 'Stena', icon: Minus, hint: 'Klik A → B' },
    { id: 'post', label: 'Stebriček', icon: Columns3, hint: 'Klik za postavitev' },
    { id: 'door', label: 'Vrata', icon: DoorOpen, hint: 'Klik na steno' },
    { id: 'window', label: 'Okno', icon: RectangleHorizontal, hint: 'Klik na steno' },
    { id: 'dimension', label: 'Mera', icon: Ruler, hint: 'Klik A → B + vnos' },
    { id: 'text', label: 'Besedilo', icon: Type, hint: 'Klik za besedilo' },
    { id: 'eraser', label: 'Briši', icon: Eraser, hint: 'Klik za izbris' },
    { id: 'move', label: 'Premakni', icon: Move, hint: 'Vlecenje elementov' },
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* Glava */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-roksal-navy to-[#2a3f5f] text-white py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-roksal-amber">
                <Frame className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-base text-white">Tloris z elementi</CardTitle>
                <p className="text-[10px] text-white/70">Roksal — balkon in ograja</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={undo}
                    disabled={historyIdx <= 0}
                    className="h-8 w-8 text-white hover:bg-white/10"
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Razveljavi</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={redo}
                    disabled={historyIdx >= history.length - 1}
                    className="h-8 w-8 text-white hover:bg-white/10"
                  >
                    <Redo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Ponovi</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Statistike */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Dolžina sten" value={`${stats.wallLengthM.toFixed(2)} m`} accent="navy" />
        <StatCard label="Stebri" value={String(stats.postCount)} accent="amber" />
        <StatCard label="Vrata" value={String(stats.doorCount)} accent="navy" />
        <StatCard label="Okna" value={String(stats.windowCount)} accent="amber" />
        <StatCard label="Površina" value={`${stats.areaM2.toFixed(2)} m²`} accent="green" />
        <StatCard label="Obseg" value={`${stats.perimeterM.toFixed(2)} m`} accent="navy" />
      </div>

      {/* Vrstica z ukazi: uvoz, plasti, izvozi */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={importFromMeasurements}
          className="h-8 shrink-0 border-roksal-navy/20 text-roksal-navy"
        >
          <Upload className="mr-1 h-3.5 w-3.5" />
          Uvozi iz meritev
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setLayersOpen(true)}
          className="h-8 shrink-0 border-roksal-navy/20 text-roksal-navy"
        >
          <Layers className="mr-1 h-3.5 w-3.5" />
          Plasti
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={exportPDF}
          className="h-8 shrink-0 border-roksal-navy/20 text-roksal-navy"
        >
          <FileText className="mr-1 h-3.5 w-3.5" />
          PDF
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={exportDXF}
          className="h-8 shrink-0 border-roksal-navy/20 text-roksal-navy"
        >
          <Download className="mr-1 h-3.5 w-3.5" />
          DXF
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={exportPNG}
          className="h-8 shrink-0 border-roksal-navy/20 text-roksal-navy"
        >
          <FileImage className="mr-1 h-3.5 w-3.5" />
          PNG
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={saveAsSketch}
          className="h-8 shrink-0 border-roksal-navy/20 text-roksal-navy"
        >
          <Save className="mr-1 h-3.5 w-3.5" />
          Skica
        </Button>
      </div>

      {/* Canvas + orodja */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Canvas container */}
          <div
            ref={containerRef}
            className="relative w-full min-h-[400px] h-[55vh] bg-[#fafbfc] touch-none select-none"
          >
            <canvas
              ref={canvasRef}
              className="block h-full w-full"
              style={{ touchAction: 'none', cursor: getCursor(selectedTool, panDrag, dragMove) }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onWheel={handleWheel}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onContextMenu={(e) => e.preventDefault()}
            />

            {/* Zoom indikator + reset (top-right) */}
            <div className="absolute top-2 right-2 flex flex-col items-end gap-1.5">
              <div className="rounded-md border border-roksal-navy/20 bg-white/90 px-2 py-1 text-[11px] font-medium text-roksal-navy shadow-sm">
                {Math.round(zoom * 100)}%
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => zoomBy(1 / 1.2)}
                  className="h-7 w-7 border-roksal-navy/20 bg-white/90"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => zoomBy(1.2)}
                  className="h-7 w-7 border-roksal-navy/20 bg-white/90"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={resetView}
                  className="h-7 w-7 border-roksal-navy/20 bg-white/90"
                >
                  <Maximize className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Status spodaj levo (orodje / pending) */}
            <div className="absolute bottom-2 left-2 rounded-md border border-roksal-navy/20 bg-white/90 px-2 py-1 text-[11px] text-roksal-navy shadow-sm">
              {pendingPoint ? (
                <span className="flex items-center gap-1">
                  <Crosshair className="h-3 w-3 text-roksal-amber" />
                  Kliknite drugo točko…
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <RulerIcon className="h-3 w-3" />
                  {tools.find((t) => t.id === selectedTool)?.hint}
                </span>
              )}
            </div>

            {/* Pobriši vse — top levo */}
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={clearAll}
              className="absolute top-2 left-2 h-7 w-7 border-roksal-red/30 text-roksal-red bg-white/90"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Orodja (toolbar) */}
          <div className="border-t bg-white p-2">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {tools.map((tool) => {
                const Icon = tool.icon
                const active = selectedTool === tool.id
                return (
                  <Tooltip key={tool.id}>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant={active ? 'default' : 'outline'}
                        onClick={() => {
                          setSelectedTool(tool.id)
                          setPendingPoint(null)
                          if (tool.id !== 'select' && tool.id !== 'move' && tool.id !== 'eraser') {
                            setSelectedId(null)
                          }
                        }}
                        className={`h-9 shrink-0 px-2.5 ${
                          active
                            ? 'bg-roksal-navy text-white hover:bg-roksal-navy/90'
                            : 'border-roksal-navy/20 text-roksal-navy'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="ml-1.5 text-[11px]">{tool.label}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{tool.hint}</TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lastnosti izbranega elementa */}
      <Sheet open={!!selectedElement} onOpenChange={(o) => { if (!o) setSelectedId(null) }}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-roksal-navy">
              {selectedElement ? elementLabel(selectedElement) : 'Lastnosti'}
            </SheetTitle>
            <SheetDescription>
              Uredite lastnosti izbranega elementa.
            </SheetDescription>
          </SheetHeader>
          {selectedElement && (
            <div className="px-4 pb-6 space-y-4">
              {selectedElement.type === 'wall' && (
                <WallProperties
                  wall={selectedElement}
                  onChange={(patch) => updateSelected(patch)}
                  onDelete={deleteSelected}
                />
              )}
              {selectedElement.type === 'post' && (
                <PostProperties
                  post={selectedElement}
                  onChange={(patch) => updateSelected(patch)}
                  onDelete={deleteSelected}
                />
              )}
              {selectedElement.type === 'door' && (
                <DoorProperties
                  door={selectedElement}
                  walls={elements.filter((e): e is WallElement => e.type === 'wall')}
                  onChange={(patch) => updateSelected(patch)}
                  onDelete={deleteSelected}
                />
              )}
              {selectedElement.type === 'window' && (
                <WindowProperties
                  win={selectedElement}
                  walls={elements.filter((e): e is WallElement => e.type === 'wall')}
                  onChange={(patch) => updateSelected(patch)}
                  onDelete={deleteSelected}
                />
              )}
              {selectedElement.type === 'dimension' && (
                <DimensionProperties
                  dim={selectedElement}
                  onChange={(patch) => updateSelected(patch)}
                  onDelete={deleteSelected}
                />
              )}
              {selectedElement.type === 'text' && (
                <TextProperties
                  text={selectedElement}
                  onChange={(patch) => updateSelected(patch)}
                  onDelete={deleteSelected}
                />
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Plasti Sheet */}
      <Sheet open={layersOpen} onOpenChange={setLayersOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-roksal-navy">Plasti</SheetTitle>
            <SheetDescription>Vidnost slojev v tlorisu.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6 space-y-3">
            {([
              { key: 'walls' as const, label: 'Stene', color: NAVY },
              { key: 'posts' as const, label: 'Stebri', color: AMBER },
              { key: 'doors' as const, label: 'Vrata', color: DOOR_COLOR },
              { key: 'windows' as const, label: 'Okna', color: WINDOW_COLOR },
              { key: 'dimensions' as const, label: 'Mere', color: GREEN },
              { key: 'texts' as const, label: 'Besedila', color: NAVY },
            ]).map((layer) => (
              <div
                key={layer.key}
                className="flex items-center justify-between rounded-lg border border-roksal-navy/10 p-3"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-sm"
                    style={{ backgroundColor: layer.color }}
                  />
                  <span className="text-sm font-medium text-roksal-navy">{layer.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {layers[layer.key] ? (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Switch
                    checked={layers[layer.key]}
                    onCheckedChange={(v) =>
                      setLayers((prev) => ({ ...prev, [layer.key]: v }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialog: vnos dimenzije */}
      <Dialog open={!!dimDialog} onOpenChange={(o) => { if (!o) setDimDialog(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Realna dolžina mere</DialogTitle>
            <DialogDescription>
              Vnesite izmerjeno dolžino v milimetrih (npr. 2400 za 2,4 m).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="dimReal">Dolžina (mm)</Label>
            <Input
              id="dimReal"
              type="number"
              value={dimDialog?.realMm ?? ''}
              onChange={(e) =>
                setDimDialog((prev) => (prev ? { ...prev, realMm: e.target.value } : prev))
              }
              placeholder="2400"
              autoFocus
            />
            {dimDialog && (
              <p className="text-xs text-muted-foreground">
                Pripravljena razdalja: {fmtMm(dist(dimDialog.a, dimDialog.b))}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDimDialog(null)}>
              Prekliči
            </Button>
            <Button
              type="button"
              onClick={confirmDimension}
              className="bg-roksal-amber text-white hover:bg-roksal-amber/90"
            >
              Potrdi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: vnos besedila */}
      <Dialog open={!!textDialog} onOpenChange={(o) => { if (!o) setTextDialog(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Besedilo</DialogTitle>
            <DialogDescription>
              Vnesite besedilo, ki naj se prikaže v tlorisu.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="textContent">Besedilo</Label>
            <Input
              id="textContent"
              value={textDialog?.text ?? ''}
              onChange={(e) =>
                setTextDialog((prev) => (prev ? { ...prev, text: e.target.value } : prev))
              }
              placeholder="npr. Balkon 1"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTextDialog(null)}>
              Prekliči
            </Button>
            <Button
              type="button"
              onClick={confirmText}
              className="bg-roksal-amber text-white hover:bg-roksal-amber/90"
            >
              Dodaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================================
// POMOŽNE KOMPONENTE — StatCard
// ============================================================================

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: 'navy' | 'amber' | 'green'
}) {
  const colors = {
    navy: 'bg-roksal-navy/5 text-roksal-navy border-roksal-navy/15',
    amber: 'bg-roksal-amber/10 text-roksal-amber border-roksal-amber/25',
    green: 'bg-roksal-green/10 text-roksal-green border-roksal-green/25',
  }
  return (
    <div className={`rounded-lg border p-2 ${colors[accent]}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-sm font-bold tabular-nums">{value}</div>
    </div>
  )
}

// ============================================================================
// LASTNOSTI — posamezne komponente za vsak tip elementa
// ============================================================================

function WallProperties({
  wall,
  onChange,
  onDelete,
}: {
  wall: WallElement
  onChange: (patch: Partial<WallElement>) => void
  onDelete: () => void
}) {
  const length = wallLength(wall)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[11px] text-muted-foreground">Dolžina (auto)</Label>
          <Input value={fmtMm(length)} readOnly className="h-9 bg-muted/40" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Kot</Label>
          <Input
            value={`${Math.round((wallAngle(wall) * 180) / Math.PI)}°`}
            readOnly
            className="h-9 bg-muted/40"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="wallH" className="text-[11px]">Višina (mm)</Label>
          <Input
            id="wallH"
            type="number"
            value={wall.heightMm}
            onChange={(e) => onChange({ heightMm: parseInt(e.target.value) || 0 })}
            className="h-9"
          />
        </div>
        <div>
          <Label htmlFor="wallT" className="text-[11px]">Debelina (mm)</Label>
          <Input
            id="wallT"
            type="number"
            value={wall.thicknessMm}
            onChange={(e) => onChange({ thicknessMm: parseInt(e.target.value) || 0 })}
            className="h-9"
          />
        </div>
      </div>
      <Separator />
      <Button type="button" variant="destructive" size="sm" onClick={onDelete} className="w-full">
        <Trash2 className="mr-1 h-3.5 w-3.5" />
        Izbriši steno
      </Button>
    </div>
  )
}

function PostProperties({
  post,
  onChange,
  onDelete,
}: {
  post: PostElement
  onChange: (patch: Partial<PostElement>) => void
  onDelete: () => void
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="postLabel" className="text-[11px]">Oznaka</Label>
          <Input
            id="postLabel"
            value={post.label}
            onChange={(e) => onChange({ label: e.target.value })}
            className="h-9"
          />
        </div>
        <div>
          <Label htmlFor="postH" className="text-[11px]">Višina (mm)</Label>
          <Input
            id="postH"
            type="number"
            value={post.heightMm}
            onChange={(e) => onChange({ heightMm: parseInt(e.target.value) || 0 })}
            className="h-9"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[11px]">Tip stebrička</Label>
          <Select
            value={post.postType}
            onValueChange={(v: PostType) => onChange({ postType: v })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="KONCNI">Končni</SelectItem>
              <SelectItem value="VMESNI">Vmesni</SelectItem>
              <SelectItem value="VOGALNI">Vogalni</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px]">Material</Label>
          <Select
            value={post.material}
            onValueChange={(v: PostMaterial) => onChange({ material: v })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALU">Aluminij</SelectItem>
              <SelectItem value="INOX">Inox</SelectItem>
              <SelectItem value="WPC">WPC</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          style={{ color: POST_TYPE_COLORS[post.postType], borderColor: POST_TYPE_COLORS[post.postType] }}
        >
          {POST_TYPE_LABELS[post.postType]}
        </Badge>
        <Badge variant="outline">{POST_MATERIAL_LABELS[post.material]}</Badge>
      </div>
      <Separator />
      <Button type="button" variant="destructive" size="sm" onClick={onDelete} className="w-full">
        <Trash2 className="mr-1 h-3.5 w-3.5" />
        Izbriši stebriček
      </Button>
    </div>
  )
}

function DoorProperties({
  door,
  walls,
  onChange,
  onDelete,
}: {
  door: DoorElement
  walls: WallElement[]
  onChange: (patch: Partial<DoorElement>) => void
  onDelete: () => void
}) {
  const wall = walls.find((w) => w.id === door.wallId)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="doorW" className="text-[11px]">Širina (mm)</Label>
          <Input
            id="doorW"
            type="number"
            value={door.widthMm}
            onChange={(e) => onChange({ widthMm: parseInt(e.target.value) || 0 })}
            className="h-9"
          />
        </div>
        <div>
          <Label htmlFor="doorPos" className="text-[11px]">Pozicija (0–1)</Label>
          <Input
            id="doorPos"
            type="number"
            step="0.05"
            min="0"
            max="1"
            value={door.position}
            onChange={(e) => onChange({ position: Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)) })}
            className="h-9"
          />
        </div>
      </div>
      <div>
        <Label className="text-[11px]">Tip vrat</Label>
        <Select
          value={door.swing}
          onValueChange={(v: 'single' | 'double') => onChange({ swing: v })}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single">Enostranska</SelectItem>
            <SelectItem value="double">Dvostranska</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {wall && (
        <p className="text-xs text-muted-foreground">
          Na steni: {fmtMm(wallLength(wall))} (odsek {Math.round(door.position * 100)}%)
        </p>
      )}
      <Separator />
      <Button type="button" variant="destructive" size="sm" onClick={onDelete} className="w-full">
        <Trash2 className="mr-1 h-3.5 w-3.5" />
        Izbriši vrata
      </Button>
    </div>
  )
}

function WindowProperties({
  win,
  walls,
  onChange,
  onDelete,
}: {
  win: WindowElement
  walls: WallElement[]
  onChange: (patch: Partial<WindowElement>) => void
  onDelete: () => void
}) {
  const wall = walls.find((w) => w.id === win.wallId)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="winW" className="text-[11px]">Širina (mm)</Label>
          <Input
            id="winW"
            type="number"
            value={win.widthMm}
            onChange={(e) => onChange({ widthMm: parseInt(e.target.value) || 0 })}
            className="h-9"
          />
        </div>
        <div>
          <Label htmlFor="winH" className="text-[11px]">Višina (mm)</Label>
          <Input
            id="winH"
            type="number"
            value={win.heightMm}
            onChange={(e) => onChange({ heightMm: parseInt(e.target.value) || 0 })}
            className="h-9"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="winPos" className="text-[11px]">Pozicija (0–1)</Label>
        <Input
          id="winPos"
          type="number"
          step="0.05"
          min="0"
          max="1"
          value={win.position}
          onChange={(e) => onChange({ position: Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)) })}
          className="h-9"
        />
      </div>
      {wall && (
        <p className="text-xs text-muted-foreground">
          Na steni: {fmtMm(wallLength(wall))} (odsek {Math.round(win.position * 100)}%)
        </p>
      )}
      <Separator />
      <Button type="button" variant="destructive" size="sm" onClick={onDelete} className="w-full">
        <Trash2 className="mr-1 h-3.5 w-3.5" />
        Izbriši okno
      </Button>
    </div>
  )
}

function DimensionProperties({
  dim,
  onChange,
  onDelete,
}: {
  dim: DimensionElement
  onChange: (patch: Partial<DimensionElement>) => void
  onDelete: () => void
}) {
  const len = dist(dim.a, dim.b)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[11px] text-muted-foreground">Dolžina na platnu</Label>
          <Input value={fmtMm(len)} readOnly className="h-9 bg-muted/40" />
        </div>
        <div>
          <Label htmlFor="dimReal2" className="text-[11px]">Realna dolžina (mm)</Label>
          <Input
            id="dimReal2"
            type="number"
            value={dim.realMm}
            onChange={(e) => {
              const v = parseInt(e.target.value) || 0
              onChange({ realMm: v, label: fmtMm(v) })
            }}
            className="h-9"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="dimLabel" className="text-[11px]">Oznaka</Label>
        <Input
          id="dimLabel"
          value={dim.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="h-9"
        />
      </div>
      <Separator />
      <Button type="button" variant="destructive" size="sm" onClick={onDelete} className="w-full">
        <Trash2 className="mr-1 h-3.5 w-3.5" />
        Izbriši mero
      </Button>
    </div>
  )
}

function TextProperties({
  text,
  onChange,
  onDelete,
}: {
  text: TextElement
  onChange: (patch: Partial<TextElement>) => void
  onDelete: () => void
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="textVal" className="text-[11px]">Besedilo</Label>
        <Input
          id="textVal"
          value={text.text}
          onChange={(e) => onChange({ text: e.target.value })}
          className="h-9"
        />
      </div>
      <Separator />
      <Button type="button" variant="destructive" size="sm" onClick={onDelete} className="w-full">
        <Trash2 className="mr-1 h-3.5 w-3.5" />
        Izbriši besedilo
      </Button>
    </div>
  )
}

// ============================================================================
// POMOŽNE FUNKCIJE — risanje na canvas
// ============================================================================

function drawGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  zoom: number,
  pan: Point
) {
  const gridWorld = GRID_MM
  const gridPx = gridWorld * zoom
  if (gridPx < 6) return // preumno

  // Izhodišče v screen koordinatah
  const offsetX = pan.x % gridPx
  const offsetY = pan.y % gridPx

  ctx.save()
  ctx.strokeStyle = 'rgba(29, 43, 62, 0.06)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = offsetX; x < w; x += gridPx) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
  }
  for (let y = offsetY; y < h; y += gridPx) {
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
  }
  ctx.stroke()

  // Močnejša črta vsakih 5 kvadratkov
  const bigGrid = gridPx * 5
  if (bigGrid < 200) {
    const bigOffsetX = pan.x % bigGrid
    const bigOffsetY = pan.y % bigGrid
    ctx.strokeStyle = 'rgba(29, 43, 62, 0.12)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = bigOffsetX; x < w; x += bigGrid) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
    }
    for (let y = bigOffsetY; y < h; y += bigGrid) {
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
    }
    ctx.stroke()
  }
  ctx.restore()
}

function drawAxes(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  zoom: number,
  pan: Point
) {
  ctx.save()
  // X os
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(0, pan.y)
  ctx.lineTo(w, pan.y)
  ctx.stroke()
  // Y os
  ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)'
  ctx.beginPath()
  ctx.moveTo(pan.x, 0)
  ctx.lineTo(pan.x, h)
  ctx.stroke()
  // Označba izhodišča
  ctx.fillStyle = 'rgba(29, 43, 62, 0.6)'
  ctx.font = '10px sans-serif'
  ctx.fillText('0,0', pan.x + 4, pan.y - 4)
  ctx.restore()
}

function drawWall(
  ctx: CanvasRenderingContext2D,
  wall: WallElement,
  zoom: number,
  pan: Point,
  selected: boolean
) {
  const a = { x: wall.a.x * zoom + pan.x, y: wall.a.y * zoom + pan.y }
  const b = { x: wall.b.x * zoom + pan.x, y: wall.b.y * zoom + pan.y }
  const thicknessPx = Math.max(3, wall.thicknessMm * zoom)

  ctx.save()
  // Senca
  ctx.strokeStyle = 'rgba(0,0,0,0.08)'
  ctx.lineWidth = thicknessPx + 2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(a.x + 1, a.y + 2)
  ctx.lineTo(b.x + 1, b.y + 2)
  ctx.stroke()

  // Glavna črta
  ctx.strokeStyle = NAVY
  ctx.lineWidth = thicknessPx
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()

  // Višina oznaka na sredini
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const ang = Math.atan2(b.y - a.y, b.x - a.x)
  const len = dist(a, b)
  if (len > 40) {
    ctx.save()
    ctx.translate(mid.x, mid.y)
    let rot = ang
    if (rot > Math.PI / 2) rot -= Math.PI
    if (rot < -Math.PI / 2) rot += Math.PI
    ctx.rotate(rot)
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    const txt = fmtMm(dist(wall.a, wall.b))
    ctx.font = 'bold 10px sans-serif'
    const tw = ctx.measureText(txt).width
    ctx.fillRect(-tw / 2 - 3, -7, tw + 6, 14)
    ctx.fillStyle = NAVY
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(txt, 0, 0)
    ctx.restore()
  }

  // Končne točke
  ctx.fillStyle = NAVY
  ctx.beginPath()
  ctx.arc(a.x, a.y, 3, 0, Math.PI * 2)
  ctx.arc(b.x, b.y, 3, 0, Math.PI * 2)
  ctx.fill()

  // Selected outline
  if (selected) {
    ctx.strokeStyle = AMBER
    ctx.lineWidth = 2
    ctx.setLineDash([5, 3])
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    ctx.setLineDash([])
  }
  ctx.restore()
}

function drawPost(
  ctx: CanvasRenderingContext2D,
  post: PostElement,
  zoom: number,
  pan: Point,
  selected: boolean
) {
  const cx = post.x * zoom + pan.x
  const cy = post.y * zoom + pan.y
  const r = Math.max(6, POST_RADIUS_MM * zoom)

  ctx.save()
  // Senca
  ctx.fillStyle = 'rgba(0,0,0,0.15)'
  ctx.beginPath()
  ctx.arc(cx + 1, cy + 2, r, 0, Math.PI * 2)
  ctx.fill()

  // Zunanji krog (amber)
  ctx.fillStyle = AMBER
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  // Material notranji krogec
  ctx.fillStyle = POST_MATERIAL_FILLS[post.material]
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2)
  ctx.fill()

  // Tip indikator (mali krogec zgoraj desno)
  ctx.fillStyle = POST_TYPE_COLORS[post.postType]
  ctx.beginPath()
  ctx.arc(cx + r * 0.7, cy - r * 0.7, r * 0.25, 0, Math.PI * 2)
  ctx.fill()

  // Oznaka
  if (r > 8) {
    ctx.fillStyle = NAVY
    ctx.font = `bold ${Math.max(10, r * 0.8)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(post.label, cx, cy + r + 12)
  }

  // Selected outline
  if (selected) {
    ctx.strokeStyle = AMBER
    ctx.lineWidth = 2
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    ctx.arc(cx, cy, r + 5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }
  ctx.restore()
}

function drawDoor(
  ctx: CanvasRenderingContext2D,
  wall: WallElement,
  door: DoorElement,
  zoom: number,
  pan: Point,
  selected: boolean
) {
  const a = { x: wall.a.x * zoom + pan.x, y: wall.a.y * zoom + pan.y }
  const b = { x: wall.b.x * zoom + pan.x, y: wall.b.y * zoom + pan.y }
  const center = {
    x: a.x + (b.x - a.x) * door.position,
    y: a.y + (b.y - a.y) * door.position,
  }
  const wallAng = Math.atan2(b.y - a.y, b.x - a.x)
  const halfW = (door.widthMm / 2) * zoom
  const perpAng = wallAng + Math.PI / 2

  // P1, P2 = robovi vrat na steni
  const p1 = {
    x: center.x - Math.cos(wallAng) * halfW,
    y: center.y - Math.sin(wallAng) * halfW,
  }
  const p2 = {
    x: center.x + Math.cos(wallAng) * halfW,
    y: center.y + Math.sin(wallAng) * halfW,
  }

  ctx.save()
  // Izbriši del stene (overpaint z barvo ozadja)
  ctx.strokeStyle = '#fafbfc'
  ctx.lineWidth = Math.max(5, wall.thicknessMm * zoom) + 2
  ctx.lineCap = 'butt'
  ctx.beginPath()
  ctx.moveTo(p1.x, p1.y)
  ctx.lineTo(p2.x, p2.y)
  ctx.stroke()

  // Vrata — tanka črta + lok (swing)
  ctx.strokeStyle = DOOR_COLOR
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(p1.x, p1.y)
  ctx.lineTo(p2.x, p2.y)
  ctx.stroke()

  // Lok swing
  const swingR = halfW
  ctx.strokeStyle = DOOR_COLOR
  ctx.lineWidth = 1
  ctx.setLineDash([3, 3])
  ctx.beginPath()
  if (door.swing === 'single') {
    // Lok iz p1 proti perp smeri
    ctx.arc(p1.x, p1.y, swingR, wallAng, wallAng + Math.PI / 2)
  } else {
    // Dvojna — oba loka
    ctx.arc(p1.x, p1.y, swingR / 2, wallAng, wallAng + Math.PI / 2)
    ctx.moveTo(p2.x, p2.y)
    ctx.arc(p2.x, p2.y, swingR / 2, wallAng + Math.PI / 2, wallAng, true)
  }
  ctx.stroke()
  ctx.setLineDash([])

  // Krilo (premica od p1 do konca loka)
  ctx.strokeStyle = DOOR_COLOR
  ctx.lineWidth = 2
  ctx.beginPath()
  if (door.swing === 'single') {
    const endX = p1.x + Math.cos(wallAng + Math.PI / 2) * swingR
    const endY = p1.y + Math.sin(wallAng + Math.PI / 2) * swingR
    ctx.moveTo(p1.x, p1.y)
    ctx.lineTo(endX, endY)
  } else {
    const e1x = p1.x + Math.cos(wallAng + Math.PI / 2) * (swingR / 2)
    const e1y = p1.y + Math.sin(wallAng + Math.PI / 2) * (swingR / 2)
    const e2x = p2.x + Math.cos(wallAng + Math.PI / 2) * (swingR / 2)
    const e2y = p2.y + Math.sin(wallAng + Math.PI / 2) * (swingR / 2)
    ctx.moveTo(p1.x, p1.y)
    ctx.lineTo(e1x, e1y)
    ctx.moveTo(p2.x, p2.y)
    ctx.lineTo(e2x, e2y)
  }
  ctx.stroke()

  // Selected outline
  if (selected) {
    ctx.strokeStyle = AMBER
    ctx.lineWidth = 2
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    ctx.arc(center.x, center.y, halfW + 6, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Oznaka širine
  if (halfW > 15) {
    ctx.fillStyle = DOOR_COLOR
    ctx.font = 'bold 9px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(fmtMm(door.widthMm), center.x, center.y - 4)
  }
  ctx.restore()
}

function drawWindow(
  ctx: CanvasRenderingContext2D,
  wall: WallElement,
  win: WindowElement,
  zoom: number,
  pan: Point,
  selected: boolean
) {
  const a = { x: wall.a.x * zoom + pan.x, y: wall.a.y * zoom + pan.y }
  const b = { x: wall.b.x * zoom + pan.x, y: wall.b.y * zoom + pan.y }
  const center = {
    x: a.x + (b.x - a.x) * win.position,
    y: a.y + (b.y - a.y) * win.position,
  }
  const wallAng = Math.atan2(b.y - a.y, b.x - a.x)
  const halfW = (win.widthMm / 2) * zoom
  const perpAng = wallAng + Math.PI / 2
  const perp = { x: Math.cos(perpAng), y: Math.sin(perpAng) }
  const offset = Math.max(4, 30 * zoom)

  // P1, P2 = robovi okna na steni
  const p1 = {
    x: center.x - Math.cos(wallAng) * halfW,
    y: center.y - Math.sin(wallAng) * halfW,
  }
  const p2 = {
    x: center.x + Math.cos(wallAng) * halfW,
    y: center.y + Math.sin(wallAng) * halfW,
  }

  ctx.save()
  // Izbriši del stene
  ctx.strokeStyle = '#fafbfc'
  ctx.lineWidth = Math.max(5, wall.thicknessMm * zoom) + 2
  ctx.lineCap = 'butt'
  ctx.beginPath()
  ctx.moveTo(p1.x, p1.y)
  ctx.lineTo(p2.x, p2.y)
  ctx.stroke()

  // Dve vzporedni črti (paralelno steni, zamaknjeni za offset)
  ctx.strokeStyle = WINDOW_COLOR
  ctx.lineWidth = 2
  ctx.beginPath()
  // Zgornja
  ctx.moveTo(p1.x + perp.x * offset, p1.y + perp.y * offset)
  ctx.lineTo(p2.x + perp.x * offset, p2.y + perp.y * offset)
  // Spodnja
  ctx.moveTo(p1.x - perp.x * offset, p1.y - perp.y * offset)
  ctx.lineTo(p2.x - perp.x * offset, p2.y - perp.y * offset)
  ctx.stroke()

  // Robni črti (povezovalne)
  ctx.strokeStyle = WINDOW_COLOR
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(p1.x + perp.x * offset, p1.y + perp.y * offset)
  ctx.lineTo(p1.x - perp.x * offset, p1.y - perp.y * offset)
  ctx.moveTo(p2.x + perp.x * offset, p2.y + perp.y * offset)
  ctx.lineTo(p2.x - perp.x * offset, p2.y - perp.y * offset)
  ctx.stroke()

  // Selected outline
  if (selected) {
    ctx.strokeStyle = AMBER
    ctx.lineWidth = 2
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    ctx.rect(
      Math.min(p1.x, p2.x) - 6,
      Math.min(p1.y, p2.y) - offset - 6,
      Math.abs(p2.x - p1.x) + 12,
      offset * 2 + 12
    )
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Oznaka
  if (halfW > 18) {
    ctx.fillStyle = WINDOW_COLOR
    ctx.font = 'bold 9px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(fmtMm(win.widthMm), center.x, center.y + offset + 12)
  }
  ctx.restore()
}

function drawDimension(
  ctx: CanvasRenderingContext2D,
  dim: DimensionElement,
  zoom: number,
  pan: Point,
  selected: boolean
) {
  const a = { x: dim.a.x * zoom + pan.x, y: dim.a.y * zoom + pan.y }
  const b = { x: dim.b.x * zoom + pan.x, y: dim.b.y * zoom + pan.y }
  const ang = Math.atan2(b.y - a.y, b.x - a.x)
  const perpAng = ang + Math.PI / 2
  const offset = 18

  // Zamaknjene točke (za prikaz mere vzporedno, a odmaknjene)
  const a2 = { x: a.x + Math.cos(perpAng) * offset, y: a.y + Math.sin(perpAng) * offset }
  const b2 = { x: b.x + Math.cos(perpAng) * offset, y: b.y + Math.sin(perpAng) * offset }

  ctx.save()
  // Glavna črta (zamaknjena)
  ctx.strokeStyle = GREEN
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(a2.x, a2.y)
  ctx.lineTo(b2.x, b2.y)
  ctx.stroke()

  // End-ticks (pravokotno)
  const tickLen = 6
  ctx.beginPath()
  ctx.moveTo(a2.x - Math.cos(perpAng) * tickLen, a2.y - Math.sin(perpAng) * tickLen)
  ctx.lineTo(a2.x + Math.cos(perpAng) * tickLen, a2.y + Math.sin(perpAng) * tickLen)
  ctx.moveTo(b2.x - Math.cos(perpAng) * tickLen, b2.y - Math.sin(perpAng) * tickLen)
  ctx.lineTo(b2.x + Math.cos(perpAng) * tickLen, b2.y + Math.sin(perpAng) * tickLen)
  ctx.stroke()

  // Extension linije od originalnih točk do dim linije
  ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)'
  ctx.lineWidth = 1
  ctx.setLineDash([2, 2])
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(a2.x, a2.y)
  ctx.moveTo(b.x, b.y)
  ctx.lineTo(b2.x, b2.y)
  ctx.stroke()
  ctx.setLineDash([])

  // Label
  const mid = { x: (a2.x + b2.x) / 2, y: (a2.y + b2.y) / 2 }
  ctx.save()
  ctx.translate(mid.x, mid.y)
  let rot = ang
  if (rot > Math.PI / 2) rot -= Math.PI
  if (rot < -Math.PI / 2) rot += Math.PI
  ctx.rotate(rot)
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.font = 'bold 11px sans-serif'
  const tw = ctx.measureText(dim.label).width
  ctx.fillRect(-tw / 2 - 4, -8, tw + 8, 16)
  ctx.fillStyle = GREEN
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(dim.label, 0, 0)
  ctx.restore()

  // Originalne točke (majhne pike)
  ctx.fillStyle = GREEN
  ctx.beginPath()
  ctx.arc(a.x, a.y, 2, 0, Math.PI * 2)
  ctx.arc(b.x, b.y, 2, 0, Math.PI * 2)
  ctx.fill()

  // Selected outline
  if (selected) {
    ctx.strokeStyle = AMBER
    ctx.lineWidth = 2
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    ctx.moveTo(a2.x, a2.y)
    ctx.lineTo(b2.x, b2.y)
    ctx.stroke()
    ctx.setLineDash([])
  }
  ctx.restore()
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: TextElement,
  zoom: number,
  pan: Point,
  selected: boolean
) {
  const x = text.x * zoom + pan.x
  const y = text.y * zoom + pan.y
  ctx.save()
  ctx.font = 'bold 13px sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const tw = ctx.measureText(text.text).width

  // Ozadje
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillRect(x - 4, y - 9, tw + 8, 18)

  // Tekst
  ctx.fillStyle = NAVY
  ctx.fillText(text.text, x, y)

  // Selected outline
  if (selected) {
    ctx.strokeStyle = AMBER
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])
    ctx.strokeRect(x - 5, y - 10, tw + 10, 20)
    ctx.setLineDash([])
  }
  ctx.restore()
}

// ============================================================================
// POMOŽNE FUNKCIJE — utility
// ============================================================================

function elementLabel(el: FloorElement): string {
  switch (el.type) {
    case 'wall':
      return `Stena (${fmtMm(wallLength(el))})`
    case 'post':
      return `Stebriček ${el.label}`
    case 'door':
      return `Vrata (${fmtMm(el.widthMm)})`
    case 'window':
      return `Okno (${fmtMm(el.widthMm)})`
    case 'dimension':
      return `Mera ${el.label}`
    case 'text':
      return `Besedilo: ${el.text}`
  }
}

function getCursor(tool: Tool, panDrag: unknown, dragMove: unknown): string {
  if (panDrag) return 'grabbing'
  if (dragMove) return 'move'
  if (tool === 'move') return 'move'
  if (tool === 'eraser') return 'pointer'
  if (tool === 'select') return 'default'
  return 'crosshair'
}
