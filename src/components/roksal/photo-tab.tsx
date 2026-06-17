'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import {
  Camera, Trash2, MapPin, Image as ImageIcon, X, Check, Loader2, AlertTriangle,
  ArrowRight, Minus, Square, Circle as CircleIcon, Type, Pencil, Ruler, Eraser,
  Upload, Copy, Download, ChevronLeft, ChevronRight, Images, Layers, Search,
  ExternalLink, Save, Undo2, Calendar, Sparkles, Columns, Trash,
} from 'lucide-react'

// ============================================================
// TIPI & KONSTANTE
// ============================================================
interface Photo {
  id: string
  kategorija: string
  imageData: string
  opomba: string | null
  latitude: number | null
  longitude: number | null
  createdAt: string
}

type Tool = 'arrow' | 'line' | 'rect' | 'circle' | 'text' | 'pen' | 'measure' | 'eraser'

interface Annotation {
  type: 'arrow' | 'line' | 'rect' | 'circle' | 'text' | 'pen' | 'measure'
  color: string
  width: number
  points: { x: number; y: number }[]
  text?: string
  fontSize?: number
  label?: string
}

interface PhotoPair {
  predId: string
  poId: string
}

const KATEGORIJE = [
  { id: 'PRED', label: 'Pred montažo', short: 'Pred', cls: 'bg-blue-100 text-blue-800' },
  { id: 'MED', label: 'Med montažo', short: 'Med', cls: 'bg-amber-100 text-amber-800' },
  { id: 'PO', label: 'Po montaži', short: 'Po', cls: 'bg-green-100 text-green-800' },
] as const

const COLORS = [
  { name: 'Rdeča', value: '#ef4444' },
  { name: 'Oranžna', value: '#f59e0b' },
  { name: 'Zelena', value: '#22c55e' },
  { name: 'Temno modra', value: '#1d2b3e' },
  { name: 'Bela', value: '#ffffff' },
]

const STROKES = [
  { name: 'Tanko', value: 2 },
  { name: 'Srednje', value: 4 },
  { name: 'Debelo', value: 6 },
]

const TOOLS: { id: Tool; label: string; icon: typeof Camera }[] = [
  { id: 'arrow', label: 'Puščica', icon: ArrowRight },
  { id: 'line', label: 'Črta', icon: Minus },
  { id: 'rect', label: 'Pravokotnik', icon: Square },
  { id: 'circle', label: 'Krog', icon: CircleIcon },
  { id: 'text', label: 'Besedilo', icon: Type },
  { id: 'pen', label: 'Prostoro', icon: Pencil },
  { id: 'measure', label: 'Mera', icon: Ruler },
  { id: 'eraser', label: 'Radiraj', icon: Eraser },
]

// ============================================================
// POMOŽNE FUNKCIJE
// ============================================================

// Komprimira datoteko v base64 JPEG (max 1280px širina, kvaliteta 0.75)
function compressImageFile(file: File, maxSize = 1280, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(1, img.naturalWidth))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas ni podprt'))
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => reject(new Error('Napaka pri nalaganju slike'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('Napaka pri branju datoteke'))
    reader.readAsDataURL(file)
  })
}

// Ocena velikosti base64 slike v bajtih
function estimateBytes(base64: string): number {
  const idx = base64.indexOf(',')
  const b64 = idx >= 0 ? base64.slice(idx + 1) : base64
  return Math.floor(b64.length * 0.75)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  const diff = Date.now() - date.getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'pravkar'
  const min = Math.floor(sec / 60)
  if (min < 60) return `pred ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `pred ${h} h`
  const d = Math.floor(h / 24)
  if (d < 7) return `pred ${d} d`
  return date.toLocaleDateString('sl-SI')
}

function formatLength(mm: number): string {
  if (mm < 1000) return `${Math.round(mm)} mm`
  return `${(mm / 1000).toFixed(2)} m`
}

// Nariše puščično glavo
function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  color: string, width: number
) {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const headLen = Math.max(10, width * 3)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6))
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6))
  ctx.stroke()
}

// Nariše posamezno anotacijo na kontekst
function drawAnnotation(ctx: CanvasRenderingContext2D, ann: Annotation) {
  ctx.strokeStyle = ann.color
  ctx.fillStyle = ann.color
  ctx.lineWidth = Math.max(0.5, ann.width)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (ann.type === 'pen' && ann.points.length > 0) {
    ctx.beginPath()
    ctx.moveTo(ann.points[0].x, ann.points[0].y)
    for (let i = 1; i < ann.points.length; i++) {
      ctx.lineTo(ann.points[i].x, ann.points[i].y)
    }
    ctx.stroke()
    return
  }

  if (ann.type === 'text' && ann.text && ann.points.length >= 1) {
    const p = ann.points[0]
    const fs = ann.fontSize ?? 18
    ctx.font = `bold ${fs}px sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    // Beli rob za vidnost
    ctx.lineWidth = Math.max(2, fs * 0.18)
    ctx.strokeStyle = ann.color === '#ffffff' ? '#1d2b3e' : '#ffffff'
    ctx.strokeText(ann.text, p.x, p.y)
    ctx.fillStyle = ann.color
    ctx.fillText(ann.text, p.x, p.y)
    return
  }

  if (ann.points.length < 2) return

  const [a, b] = ann.points
  if (ann.type === 'arrow') {
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    drawArrowHead(ctx, a.x, a.y, b.x, b.y, ann.color, ann.width)
  } else if (ann.type === 'line') {
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  } else if (ann.type === 'measure') {
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    drawArrowHead(ctx, a.x, a.y, b.x, b.y, ann.color, ann.width)
    drawArrowHead(ctx, b.x, b.y, a.x, a.y, ann.color, ann.width)
    if (ann.label) {
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      const fs = ann.fontSize ?? 14
      ctx.font = `bold ${fs}px sans-serif`
      const w = ctx.measureText(ann.label).width + 12
      ctx.fillStyle = ann.color
      ctx.fillRect(mx - w / 2, my - fs / 2 - 4, w, fs + 8)
      ctx.fillStyle = ann.color === '#ffffff' ? '#1d2b3e' : '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(ann.label, mx, my)
    }
  } else if (ann.type === 'rect') {
    const x = Math.min(a.x, b.x)
    const y = Math.min(a.y, b.y)
    const w = Math.abs(b.x - a.x)
    const h = Math.abs(b.y - a.y)
    ctx.strokeRect(x, y, w, h)
  } else if (ann.type === 'circle') {
    const cx = a.x
    const cy = a.y
    const r = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y))
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }
}

// ============================================================
// GLAVNA KOMPONENTA — PhotoTab
// ============================================================
export function PhotoTab({ projectId }: { projectId: string | null }) {
  const [cameraOpen, setCameraOpen] = useState(false)
  const [activeKategorija, setActiveKategorija] = useState<'PRED' | 'MED' | 'PO'>('MED')
  const [filterKat, setFilterKat] = useState<'ALL' | 'PRED' | 'MED' | 'PO'>('ALL')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(false)
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null)
  const [annotationPhoto, setAnnotationPhoto] = useState<Photo | null>(null)
  const [annotationNewImage, setAnnotationNewImage] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'gallery' | 'pairs'>('gallery')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null)
  const [pairCreatorOpen, setPairCreatorOpen] = useState(false)
  const [pairs, setPairs] = useState<PhotoPair[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // ---- Nalaganje slik ----
  const loadPhotos = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/photos?projectId=${projectId}`)
      if (res.ok) setPhotos(await res.json())
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadPhotos()
  }, [loadPhotos])

  // ---- Nalaganje parov iz localStorage ----
  useEffect(() => {
    if (!projectId) return
    try {
      const raw = localStorage.getItem(`roksal_photo_pairs_${projectId}`)
      if (raw) setPairs(JSON.parse(raw))
      else setPairs([])
    } catch {
      setPairs([])
    }
  }, [projectId])

  function savePairs(newPairs: PhotoPair[]) {
    setPairs(newPairs)
    if (projectId) {
      localStorage.setItem(`roksal_photo_pairs_${projectId}`, JSON.stringify(newPairs))
    }
  }

  // ---- Filtrirana galerija ----
  const filteredPhotos = useMemo(() => {
    let list = photos
    if (filterKat !== 'ALL') list = list.filter((p) => p.kategorija === filterKat)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((p) => (p.opomba ?? '').toLowerCase().includes(q))
    }
    if (dateFrom) {
      const from = new Date(dateFrom).getTime()
      list = list.filter((p) => new Date(p.createdAt).getTime() >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 24 * 60 * 60 * 1000
      list = list.filter((p) => new Date(p.createdAt).getTime() <= to)
    }
    return list
  }, [photos, filterKat, searchQuery, dateFrom, dateTo])

  const activeFilterCount =
    (filterKat !== 'ALL' ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0)

  // ---- Statistika ----
  const stats = useMemo(() => {
    const total = photos.length
    const pred = photos.filter((p) => p.kategorija === 'PRED').length
    const med = photos.filter((p) => p.kategorija === 'MED').length
    const po = photos.filter((p) => p.kategorija === 'PO').length
    const lastPhoto = photos[0]
    const totalBytes = photos.reduce((sum, p) => sum + estimateBytes(p.imageData), 0)
    return { total, pred, med, po, lastPhoto, totalBytes }
  }, [photos])

  // ---- Brisanje ----
  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/photos?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: 'Slika izbrisana' })
        // Odstrani tudi iz parov
        const newPairs = pairs.filter((p) => p.predId !== id && p.poId !== id)
        if (newPairs.length !== pairs.length) savePairs(newPairs)
        loadPhotos()
      }
    } catch {
      toast({ title: 'Napaka pri brisanju', variant: 'destructive' })
    }
  }

  // ---- Duplikat ----
  async function handleDuplicate(photo: Photo) {
    try {
      const res = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          kategorija: photo.kategorija,
          imageData: photo.imageData,
          opomba: photo.opomba ? `${photo.opomba} (kopija)` : '(kopija)',
          latitude: photo.latitude,
          longitude: photo.longitude,
        }),
      })
      if (res.ok) {
        toast({ title: 'Kopija ustvarjena' })
        loadPhotos()
      }
    } catch {
      toast({ title: 'Napaka pri kopiranju', variant: 'destructive' })
    }
  }

  // ---- Izvoz slike ----
  function handleExport(photo: Photo) {
    const link = document.createElement('a')
    const dateStr = new Date(photo.createdAt).toISOString().slice(0, 10)
    link.href = photo.imageData
    link.download = `roksal-${photo.kategorija}-${dateStr}.jpg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast({ title: 'Slika izvožena' })
  }

  // ---- Urejanje (anotacije) shrani ----
  async function handleAnnotationSave(photo: Photo, newImageData: string) {
    // Ustvari novo sliko z istimi metapodatki, nato izbriši staro
    try {
      const res = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          kategorija: photo.kategorija,
          imageData: newImageData,
          opomba: photo.opomba,
          latitude: photo.latitude,
          longitude: photo.longitude,
        }),
      })
      if (res.ok) {
        const newPhoto = (await res.json()) as Photo
        // Izbriši staro
        await fetch(`/api/photos?id=${photo.id}`, { method: 'DELETE' })
        // Prenesi pare
        const newPairs = pairs.map((p) =>
          p.predId === photo.id ? { ...p, predId: newPhoto.id } :
          p.poId === photo.id ? { ...p, poId: newPhoto.id } : p
        )
        if (JSON.stringify(newPairs) !== JSON.stringify(pairs)) savePairs(newPairs)
        toast({ title: 'Anotacije shranjene' })
        setAnnotationPhoto(null)
        setAnnotationNewImage(null)
        await loadPhotos()
        setPreviewPhoto(newPhoto)
      }
    } catch {
      toast({ title: 'Napaka pri shranjevanju', variant: 'destructive' })
    }
  }

  // ---- Batch upload ----
  async function handleBatchFiles(files: FileList) {
    if (!projectId || files.length === 0) return
    const kat = activeKategorija
    setBatchProgress({ current: 0, total: files.length })

    // GPS (enkrat na začetku)
    let lat: number | null = null
    let lon: number | null = null
    if (navigator.geolocation) {
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => { lat = pos.coords.latitude; lon = pos.coords.longitude; resolve() },
          () => resolve(),
          { enableHighAccuracy: true, timeout: 3000 }
        )
      })
    }

    let success = 0
    for (let i = 0; i < files.length; i++) {
      setBatchProgress({ current: i, total: files.length })
      try {
        const dataUrl = await compressImageFile(files[i])
        const res = await fetch('/api/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            kategorija: kat,
            imageData: dataUrl,
            latitude: lat,
            longitude: lon,
          }),
        })
        if (res.ok) success++
      } catch (e) {
        console.error('Batch upload error:', e)
      }
      setBatchProgress({ current: i + 1, total: files.length })
    }

    setBatchProgress(null)
    toast({
      title: `${success} slik dodanih`,
      description: `Kategorija: ${KATEGORIJE.find((k) => k.id === kat)?.label}`,
    })
    loadPhotos()
  }

  // ---- Predogled: navigacija naprej/nazaj ----
  const previewIndex = previewPhoto ? filteredPhotos.findIndex((p) => p.id === previewPhoto.id) : -1
  function navPreview(dir: -1 | 1) {
    if (previewIndex < 0 || filteredPhotos.length === 0) return
    const newIdx = (previewIndex + dir + filteredPhotos.length) % filteredPhotos.length
    setPreviewPhoto(filteredPhotos[newIdx])
  }

  // ---- Pari za before/after ----
  const pairsResolved = useMemo(() => {
    return pairs
      .map((p) => ({
        pair: p,
        pred: photos.find((ph) => ph.id === p.predId && ph.kategorija === 'PRED'),
        po: photos.find((ph) => ph.id === p.poId && ph.kategorija === 'PO'),
      }))
      .filter((x) => x.pred && x.po)
  }, [pairs, photos])

  const predPhotos = photos.filter((p) => p.kategorija === 'PRED')
  const poPhotos = photos.filter((p) => p.kategorija === 'PO')

  function clearFilters() {
    setFilterKat('ALL')
    setSearchQuery('')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div className="space-y-4 p-4">
      {/* GLAVA — akcije */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-5 w-5 text-roksal-amber" />
            Slikanje projekta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!projectId && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mb-1 inline h-3.5 w-3.5" /> Izberite projekt v zavihku Domov pred slikanjem.
            </div>
          )}

          {/* Kategorija (velja za slikaj in dodaj iz galerije) */}
          <div>
            <Label className="mb-1.5 block text-[11px] text-muted-foreground">Kategorija za nove slike</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {KATEGORIJE.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setActiveKategorija(k.id as 'PRED' | 'MED' | 'PO')}
                  className={`rounded-md border px-2 py-2 text-[11px] font-medium transition-colors ${
                    activeKategorija === k.id
                      ? 'border-roksal-amber bg-roksal-amber text-white'
                      : 'border-border bg-white text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {k.short}
                </button>
              ))}
            </div>
          </div>

          {/* Akcijska gumba */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={() => setCameraOpen(true)}
              disabled={!projectId}
              className="bg-roksal-amber text-white hover:bg-roksal-amber/90"
            >
              <Camera className="mr-2 h-4 w-4" />
              Slikaj
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={!projectId}
            >
              <Upload className="mr-2 h-4 w-4" />
              Dodaj iz galerije
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleBatchFiles(e.target.files)
                  e.target.value = ''
                }
              }}
            />
          </div>

          {/* Statistika */}
          {projectId && photos.length > 0 && (
            <div className="grid grid-cols-4 gap-1.5">
              <div className="rounded-md border border-border bg-white p-1.5 text-center">
                <div className="text-base font-bold text-roksal-navy">{stats.total}</div>
                <div className="text-[9px] text-muted-foreground">Skupaj</div>
              </div>
              <div className="rounded-md border border-border bg-white p-1.5 text-center">
                <div className="text-base font-bold text-blue-700">{stats.pred}</div>
                <div className="text-[9px] text-muted-foreground">Pred</div>
              </div>
              <div className="rounded-md border border-border bg-white p-1.5 text-center">
                <div className="text-base font-bold text-amber-700">{stats.med}</div>
                <div className="text-[9px] text-muted-foreground">Med</div>
              </div>
              <div className="rounded-md border border-border bg-white p-1.5 text-center">
                <div className="text-base font-bold text-green-700">{stats.po}</div>
                <div className="text-[9px] text-muted-foreground">Po</div>
              </div>
            </div>
          )}

          {projectId && photos.length > 0 && (
            <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5 text-[11px] text-muted-foreground">
              <span>
                <Calendar className="mr-1 inline h-3 w-3" />
                Zadnja: {stats.lastPhoto ? formatRelativeTime(stats.lastPhoto.createdAt) : '—'}
              </span>
              <span>
                <Layers className="mr-1 inline h-3 w-3" />
                {formatBytes(stats.totalBytes)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* VIEW TOGGLE — Galerija / Pred-Po pari */}
      <div className="flex gap-1.5">
        <Button
          type="button"
          variant={viewMode === 'gallery' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('gallery')}
          className={`flex-1 ${viewMode === 'gallery' ? 'bg-roksal-navy text-white' : ''}`}
        >
          <Images className="mr-1.5 h-3.5 w-3.5" />
          Galerija
        </Button>
        <Button
          type="button"
          variant={viewMode === 'pairs' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('pairs')}
          className={`flex-1 ${viewMode === 'pairs' ? 'bg-roksal-navy text-white' : ''}`}
        >
          <Columns className="mr-1.5 h-3.5 w-3.5" />
          Pred/Po pari
          {pairsResolved.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 bg-roksal-amber/20 text-roksal-amber">
              {pairsResolved.length}
            </Badge>
          )}
        </Button>
      </div>

      {/* GALERIJA — filtri + masonry */}
      {viewMode === 'gallery' && (
        <>
          {/* Filtri */}
          <div className="space-y-2">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {(['ALL', 'PRED', 'MED', 'PO'] as const).map((k) => (
                <Button
                  key={k}
                  type="button"
                  variant={filterKat === k ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterKat(k)}
                  className={`h-7 shrink-0 text-[11px] ${filterKat === k ? 'bg-roksal-navy text-white' : ''}`}
                >
                  {k === 'ALL' ? 'Vse' : KATEGORIJE.find((c) => c.id === k)?.short}
                  {k !== 'ALL' && (
                    <span className="ml-1 text-[10px] opacity-70">
                      {stats[k.toLowerCase() as 'pred' | 'med' | 'po']}
                    </span>
                  )}
                </Button>
              ))}
              {activeFilterCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-7 shrink-0 text-[11px] text-muted-foreground"
                >
                  <X className="mr-1 h-3 w-3" />
                  Počisti ({activeFilterCount})
                </Button>
              )}
            </div>

            {/* Iskanje + datum */}
            <div className="space-y-1.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Išči po opombah..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <Label className="mb-0.5 block text-[10px] text-muted-foreground">Od datuma</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="mb-0.5 block text-[10px] text-muted-foreground">Do datuma</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Galerija — masonry */}
          {loading ? (
            <div className="columns-2 gap-2 sm:columns-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="mb-2 aspect-square animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : filteredPhotos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <ImageIcon className="mb-2 h-10 w-10 opacity-30" />
              <p className="text-sm">
                {photos.length === 0 ? 'Ni še slik za ta projekt.' : 'Ni slik, ki ustrezajo filtrom.'}
              </p>
            </div>
          ) : (
            <div className="columns-2 gap-2 sm:columns-3">
              {filteredPhotos.map((p) => {
                const kat = KATEGORIJE.find((k) => k.id === p.kategorija)
                return (
                  <div
                    key={p.id}
                    className="group relative mb-2 break-inside-avoid overflow-hidden rounded-lg border border-border"
                  >
                    { }
                    <img
                      src={p.imageData}
                      alt={p.opomba ?? 'Slika projekta'}
                      className="w-full cursor-pointer object-cover"
                      onClick={() => setPreviewPhoto(p)}
                    />
                    <div className="absolute left-0 top-0">
                      <Badge className={`rounded-br-lg rounded-tl-lg text-[8px] ${kat?.cls}`} variant="secondary">
                        {p.kategorija}
                      </Badge>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(p.id)
                      }}
                      className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Izbriši sliko"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    {p.opomba && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                        <p className="line-clamp-2 text-[9px] text-white">{p.opomba}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* PARI — Pred/Po slider */}
      {viewMode === 'pairs' && (
        <div className="space-y-3">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-roksal-navy">Pred/Po primerjave</p>
                  <p className="text-[10px] text-muted-foreground">
                    Poveži PRED in PO slike za predstavitev dela strankam.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setPairCreatorOpen(true)}
                  disabled={predPhotos.length === 0 || poPhotos.length === 0}
                  className="bg-roksal-amber text-white hover:bg-roksal-amber/90"
                >
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                  Ustvari par
                </Button>
              </div>
            </CardContent>
          </Card>

          {pairsResolved.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Columns className="mb-2 h-10 w-10 opacity-30" />
              <p className="text-sm">Ni še ustvarjenih parov.</p>
              {predPhotos.length === 0 || poPhotos.length === 0 ? (
                <p className="mt-1 text-[11px]">Potrebne so vsaj ena PRED in ena PO slika.</p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              {pairsResolved.map(({ pair, pred, po }) => (
                <Card key={`${pair.predId}-${pair.poId}`}>
                  <CardContent className="p-3">
                    <BeforeAfterSlider
                      before={pred!.imageData}
                      after={po!.imageData}
                      beforeLabel="PRED"
                      afterLabel="PO"
                    />
                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(po!.createdAt).toLocaleDateString('sl-SI')}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => savePairs(pairs.filter((p) => p !== pair))}
                        className="h-7 text-[11px] text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Odstrani par
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Kamera modal */}
      {cameraOpen && (
        <CameraCapture
          projectId={projectId!}
          kategorija={activeKategorija}
          onKategorijaChange={setActiveKategorija}
          onClose={() => setCameraOpen(false)}
          onSaved={() => {
            loadPhotos()
            setCameraOpen(false)
          }}
        />
      )}

      {/* Batch upload progress */}
      {batchProgress && (
        <div className="fixed bottom-4 left-4 right-4 z-[70] rounded-lg border border-roksal-amber/40 bg-white p-3 shadow-lg">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-roksal-navy">Nalaganje slik...</span>
            <span className="text-muted-foreground">
              {batchProgress.current} / {batchProgress.total}
            </span>
          </div>
          <Progress value={(batchProgress.current / batchProgress.total) * 100} className="h-1.5" />
        </div>
      )}

      {/* Annotation editor */}
      {annotationPhoto && annotationNewImage && (
        <AnnotationEditor
          imageData={annotationNewImage}
          onSave={(newData) => handleAnnotationSave(annotationPhoto, newData)}
          onCancel={() => {
            setAnnotationPhoto(null)
            setAnnotationNewImage(null)
          }}
        />
      )}

      {/* Predogled slike — enhanced */}
      <Dialog open={!!previewPhoto} onOpenChange={(o) => !o && setPreviewPhoto(null)}>
        <DialogContent className="max-w-lg p-0 sm:p-6">
          <DialogHeader className="p-4 pb-2 sm:p-0 sm:pb-2">
            <DialogTitle className="flex items-center gap-2 text-sm">
              {previewPhoto && (
                <Badge variant="secondary" className={KATEGORIJE.find((k) => k.id === previewPhoto.kategorija)?.cls}>
                  {KATEGORIJE.find((k) => k.id === previewPhoto.kategorija)?.label}
                </Badge>
              )}
              {previewPhoto && new Date(previewPhoto.createdAt).toLocaleString('sl-SI')}
            </DialogTitle>
          </DialogHeader>
          {previewPhoto && (
            <div className="space-y-3 px-4 pb-2 sm:px-0">
              <div className="relative">
                { }
                <img src={previewPhoto.imageData} alt="Predogled" className="max-h-[55vh] w-full rounded-lg object-contain" />
                {/* Navigacijske puščice */}
                {filteredPhotos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); navPreview(-1) }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                      aria-label="Prejšnja"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); navPreview(1) }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                      aria-label="Naslednja"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                      {previewIndex + 1} / {filteredPhotos.length}
                    </div>
                  </>
                )}
              </div>

              {/* Opomba */}
              {previewPhoto.opomba && (
                <p className="rounded-md bg-muted/50 p-2 text-sm text-foreground">{previewPhoto.opomba}</p>
              )}

              {/* Metapodatki */}
              <div className="space-y-1 text-[11px] text-muted-foreground">
                {previewPhoto.latitude !== null && previewPhoto.longitude !== null && (
                  <a
                    href={`https://www.google.com/maps?q=${previewPhoto.latitude},${previewPhoto.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-roksal-amber"
                  >
                    <MapPin className="h-3 w-3 text-roksal-amber" />
                    {previewPhoto.latitude.toFixed(5)}, {previewPhoto.longitude.toFixed(5)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <div className="flex items-center gap-1.5">
                  <Layers className="h-3 w-3 text-roksal-amber" />
                  Velikost: {formatBytes(estimateBytes(previewPhoto.imageData))}
                </div>
              </div>

              <Separator />

              {/* Akcijski gumbi */}
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setAnnotationPhoto(previewPhoto)
                    setAnnotationNewImage(previewPhoto.imageData)
                  }}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Uredi
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleDuplicate(previewPhoto)}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  Kopija
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleExport(previewPhoto)}
                >
                  <Download className="mr-1 h-3.5 w-3.5" />
                  Izvozi
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    handleDelete(previewPhoto.id)
                    setPreviewPhoto(null)
                  }}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Izbriši
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pair creator dialog — conditionally mounted so initial state resets */}
      {pairCreatorOpen && (
        <PairCreatorDialog
          onClose={() => setPairCreatorOpen(false)}
          predPhotos={predPhotos}
          poPhotos={poPhotos}
          existingPairs={pairs}
          onCreate={(pair) => {
            savePairs([...pairs, pair])
            setPairCreatorOpen(false)
            toast({ title: 'Par ustvarjen' })
          }}
        />
      )}
    </div>
  )
}

// ============================================================
// CAMERA CAPTURE — polnozaslonska kamera z zajemom + anotacijo
// ============================================================
function CameraCapture({
  projectId,
  kategorija,
  onKategorijaChange,
  onClose,
  onSaved,
}: {
  projectId: string
  kategorija: 'PRED' | 'MED' | 'PO'
  onKategorijaChange: (k: 'PRED' | 'MED' | 'PO') => void
  onClose: () => void
  onSaved: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<'starting' | 'ready' | 'error' | 'captured'>('starting')
  const [errorMsg, setErrorMsg] = useState('')
  const [capturedData, setCapturedData] = useState<string | null>(null)
  const [opomba, setOpomba] = useState('')
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [annotateMode, setAnnotateMode] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    let mounted = true
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setStatus('ready')
      } catch (e) {
        setStatus('error')
        setErrorMsg(e instanceof Error ? e.message : 'Kamera ni na voljo')
      }
    }
    start()

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      )
    }

    return () => {
      mounted = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [])

  function handleCapture() {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 1280 / Math.max(1, video.videoWidth))
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const data = canvas.toDataURL('image/jpeg', 0.75)
    setCapturedData(data)
    setStatus('captured')
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }

  function handleRetake() {
    setCapturedData(null)
    setStatus('starting')
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setStatus('ready')
      } catch {
        setStatus('error')
      }
    })()
  }

  async function handleSave() {
    if (!capturedData) return
    setSaving(true)
    try {
      const res = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          kategorija,
          imageData: capturedData,
          opomba: opomba || null,
          latitude: gps?.lat ?? null,
          longitude: gps?.lon ?? null,
        }),
      })
      if (res.ok) {
        toast({
          title: 'Slika shranjena',
          description: `${KATEGORIJE.find((k) => k.id === kategorija)?.label}${gps ? ' · GPS zabeležen' : ''}`,
        })
        onSaved()
      } else {
        toast({ title: 'Napaka pri shranjevanju', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Omrežna napaka', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
    }
    onClose()
  }

  // Annotation editor nad zajeto sliko
  if (annotateMode && capturedData) {
    return (
      <AnnotationEditor
        imageData={capturedData}
        onSave={(newData) => {
          setCapturedData(newData)
          setAnnotateMode(false)
          toast({ title: 'Anotacije shranjene na sliko' })
        }}
        onCancel={() => setAnnotateMode(false)}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between bg-black/80 px-4 py-3 text-white">
        <button type="button" onClick={handleClose} className="rounded-full p-1.5 hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
        <span className="text-sm font-medium">Slikanje — {KATEGORIJE.find((k) => k.id === kategorija)?.label}</span>
        {gps ? (
          <div className="flex items-center gap-1 text-[10px] text-green-400">
            <MapPin className="h-3 w-3" />
            GPS
          </div>
        ) : (
          <div className="w-6" />
        )}
      </div>

      {/* Kategorija selector */}
      <div className="flex justify-center gap-2 bg-black/80 px-4 py-2">
        {KATEGORIJE.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => onKategorijaChange(k.id as 'PRED' | 'MED' | 'PO')}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
              kategorija === k.id ? 'bg-roksal-amber text-white' : 'bg-white/10 text-white/70'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {/* Vsebina */}
      <div className="relative flex-1 overflow-hidden">
        {status === 'starting' && (
          <div className="flex h-full items-center justify-center text-white">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}
        {status === 'error' && (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <AlertTriangle className="h-10 w-10 text-amber-400" />
            <p className="text-sm">{errorMsg || 'Dostop do kamere je zavrnjen.'}</p>
            <p className="text-[11px] text-white/60">V nastavitvah brskalnika omogočite dostop do kamere.</p>
          </div>
        )}
        {status === 'ready' && (
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        )}
        {status === 'captured' && capturedData && (
           
          <img src={capturedData} alt="Zajeto" className="h-full w-full object-contain" />
        )}
      </div>

      {/* Footer kontrola */}
      {status === 'ready' && (
        <div className="flex items-center justify-center bg-black/80 py-6">
          <button
            type="button"
            onClick={handleCapture}
            className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20"
            aria-label="Posnemi"
          >
            <div className="h-12 w-12 rounded-full bg-white" />
          </button>
        </div>
      )}
      {status === 'captured' && (
        <div className="space-y-3 bg-black/80 p-4">
          <Input
            value={opomba}
            onChange={(e) => setOpomba(e.target.value)}
            placeholder="Opomba k sliki (opcijsko)..."
            className="border-white/20 bg-white/10 text-white placeholder:text-white/40"
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleRetake} className="flex-1 border-white/20 bg-transparent text-white hover:bg-white/10">
              <X className="mr-1 h-4 w-4" />
              Ponovi
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAnnotateMode(true)}
              className="flex-1 border-roksal-amber/40 bg-transparent text-roksal-amber hover:bg-roksal-amber/10"
            >
              <Pencil className="mr-1 h-4 w-4" />
              Anotiraj
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving} className="flex-1 bg-roksal-amber text-white hover:bg-roksal-amber/90">
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
              Shrani
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// ANNOTATION EDITOR — polnozaslonski urejevalnik anotacij
// ============================================================
function AnnotationEditor({
  imageData,
  onSave,
  onCancel,
}: {
  imageData: string
  onSave: (newImageData: string) => void
  onCancel: () => void
}) {
  const [tool, setTool] = useState<Tool>('arrow')
  const [color, setColor] = useState(COLORS[0].value)
  const [stroke, setStroke] = useState(4)
  const [anns, setAnns] = useState<Annotation[]>([])
  const [current, setCurrent] = useState<Annotation | null>(null)
  const [textValue, setTextValue] = useState('')
  const [measureInput, setMeasureInput] = useState<{ ann: Annotation } | null>(null)
  const [measureValue, setMeasureValue] = useState('')
  const [saving, setSaving] = useState(false)

  const drawingRef = useRef(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const { toast } = useToast()

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const ann of anns) drawAnnotation(ctx, ann)
    if (current) drawAnnotation(ctx, current)
  }, [anns, current])

  useEffect(() => {
    redraw()
  }, [redraw])

  // Setup canvas size
  useEffect(() => {
    const img = imageRef.current
    const canvas = canvasRef.current
    if (!img || !canvas) return
    const setup = () => {
      const rect = img.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      canvas.width = Math.round(rect.width)
      canvas.height = Math.round(rect.height)
      redraw()
    }
    if (img.complete && img.naturalWidth > 0) setup()
    img.addEventListener('load', setup)
    window.addEventListener('resize', setup)
    const t = setTimeout(setup, 50)
    return () => {
      img.removeEventListener('load', setup)
      window.removeEventListener('resize', setup)
      clearTimeout(t)
    }
  }, [redraw])

  function getPos(e: React.PointerEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (measureInput) return
    if (tool === 'eraser') {
      setAnns((a) => a.slice(0, -1))
      return
    }
    const p = getPos(e)
    if (tool === 'text') {
      if (!textValue.trim()) {
        toast({ title: 'Vnesite besedilo', description: 'Najprej vnesite besedilo v polje zgoraj.' })
        return
      }
      setAnns((a) => [
        ...a,
        {
          type: 'text',
          color,
          width: stroke,
          points: [p],
          text: textValue.trim(),
          fontSize: 18 + stroke * 2,
        },
      ])
      setTextValue('')
      return
    }
    drawingRef.current = true
    try {
      ;(e.target as Element).setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    const newAnn: Annotation = {
      type: tool,
      color,
      width: stroke,
      points: [p, p],
    }
    setCurrent(newAnn)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drawingRef.current || !current) return
    const p = getPos(e)
    if (current.type === 'pen') {
      setCurrent({ ...current, points: [...current.points, p] })
    } else {
      setCurrent({ ...current, points: [current.points[0], p] })
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!drawingRef.current || !current) return
    drawingRef.current = false
    try {
      ;(e.target as Element).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    if (current.type === 'measure') {
      setMeasureInput({ ann: current })
      setMeasureValue('')
      setCurrent(null)
      return
    }
    setAnns((a) => [...a, current])
    setCurrent(null)
  }

  function commitMeasure() {
    if (!measureInput) return
    const length = parseFloat(measureValue)
    if (isNaN(length) || length <= 0) {
      toast({ title: 'Vnesite veljavno dolžino', variant: 'destructive' })
      return
    }
    const label = formatLength(length)
    setAnns((a) => [...a, { ...measureInput.ann, label, fontSize: 14 + stroke }])
    setMeasureInput(null)
    setMeasureValue('')
  }

  async function handleSave() {
    setSaving(true)
    try {
      const naturalImg = new Image()
      naturalImg.src = imageData
      await new Promise<void>((resolve, reject) => {
        naturalImg.onload = () => resolve()
        naturalImg.onerror = () => reject(new Error('Napaka pri nalaganju slike'))
      })
      const natW = naturalImg.naturalWidth || 1280
      const natH = naturalImg.naturalHeight || 720

      const scale = Math.min(1, 1280 / Math.max(1, natW))
      const saveCanvas = document.createElement('canvas')
      saveCanvas.width = Math.max(1, Math.round(natW * scale))
      saveCanvas.height = Math.max(1, Math.round(natH * scale))
      const sctx = saveCanvas.getContext('2d')
      if (!sctx) throw new Error('Canvas ni podprt')
      sctx.drawImage(naturalImg, 0, 0, saveCanvas.width, saveCanvas.height)

      const displayCanvas = canvasRef.current
      if (displayCanvas && displayCanvas.width > 0) {
        const scaleX = saveCanvas.width / displayCanvas.width
        const scaleY = saveCanvas.height / displayCanvas.height
        for (const ann of anns) {
          const scaledAnn: Annotation = {
            ...ann,
            width: Math.max(0.5, ann.width * scaleX),
            fontSize: (ann.fontSize ?? 14) * scaleX,
            points: ann.points.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY })),
          }
          drawAnnotation(sctx, scaledAnn)
        }
      }

      const dataUrl = saveCanvas.toDataURL('image/jpeg', 0.75)
      onSave(dataUrl)
    } catch (e) {
      console.error('Annotation save error:', e)
      toast({ title: 'Napaka pri shranjevanju', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  function clearAll() {
    setAnns([])
    setCurrent(null)
  }

  function undoLast() {
    setAnns((a) => a.slice(0, -1))
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black">
      {/* HEADER — barva + debelina + akcije */}
      <div className="flex flex-wrap items-center gap-2 bg-roksal-navy px-3 py-2 text-white">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md bg-white/10 px-2.5 py-1.5 text-[11px] font-medium hover:bg-white/20"
        >
          <X className="h-4 w-4" />
        </button>
        <span className="text-xs font-medium">Anotacije</span>
        <span className="ml-1 text-[10px] text-white/60">{anns.length}</span>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={undoLast}
            disabled={anns.length === 0}
            className="rounded-md bg-white/10 px-2 py-1.5 text-[11px] hover:bg-white/20 disabled:opacity-30"
            title="Radiraj zadnjo"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={anns.length === 0}
            className="rounded-md bg-white/10 px-2 py-1.5 text-[11px] hover:bg-white/20 disabled:opacity-30"
            title="Počisti vse"
          >
            <Trash className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-roksal-amber px-3 py-1.5 text-[11px] font-medium text-white hover:bg-roksal-amber/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span className="ml-1">Shrani</span>
          </button>
        </div>
      </div>

      {/* BARVE + DEBELINA */}
      <div className="flex items-center gap-2 bg-black/80 px-3 py-1.5">
        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setColor(c.value)}
              className={`h-6 w-6 rounded-full border-2 transition-all ${
                color === c.value ? 'border-white scale-110' : 'border-white/30'
              }`}
              style={{ backgroundColor: c.value }}
              aria-label={c.name}
              title={c.name}
            />
          ))}
        </div>
        <Separator orientation="vertical" className="h-6 bg-white/20" />
        <div className="flex gap-1.5">
          {STROKES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStroke(s.value)}
              className={`flex h-6 w-9 items-center justify-center rounded-md border text-[10px] ${
                stroke === s.value
                  ? 'border-roksal-amber bg-roksal-amber/20 text-roksal-amber'
                  : 'border-white/20 text-white/70'
              }`}
              title={s.name}
            >
              <div className="rounded-full bg-current" style={{ width: s.value + 'px', height: s.value + 'px' }} />
            </button>
          ))}
        </div>
        {tool === 'text' && (
          <>
            <Separator orientation="vertical" className="h-6 bg-white/20" />
            <input
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder="Vnesi besedilo..."
              className="h-7 flex-1 rounded-md border border-white/20 bg-white/10 px-2 text-[11px] text-white placeholder:text-white/40"
            />
          </>
        )}
      </div>

      {/* SLIKA + CANVAS */}
      <div className="relative flex-1 overflow-hidden bg-black">
        { }
        <img
          ref={imageRef}
          src={imageData}
          alt="Za anotacijo"
          className="absolute inset-0 h-full w-full object-contain"
          draggable={false}
        />
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="absolute inset-0 h-full w-full touch-none"
          style={{ touchAction: 'none', cursor: tool === 'text' ? 'text' : tool === 'eraser' ? 'cell' : 'crosshair' }}
        />
      </div>

      {/* TOOLBAR — orodja */}
      <div className="flex gap-1 overflow-x-auto bg-roksal-navy px-2 py-2 no-scrollbar">
        {TOOLS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTool(t.id)}
              className={`flex shrink-0 flex-col items-center gap-0.5 rounded-md px-2.5 py-1.5 text-[9px] transition-colors ${
                tool === t.id
                  ? 'bg-roksal-amber text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* MODAL — vnos mere */}
      {measureInput && (
        <Dialog open onOpenChange={(o) => !o && setMeasureInput(null)}>
          <DialogContent className="max-w-xs">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm">
                <Ruler className="h-4 w-4 text-roksal-amber" />
                Dolžina mere
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Vnesi realno dolžino (mm)</Label>
              <Input
                type="number"
                value={measureValue}
                onChange={(e) => setMeasureValue(e.target.value)}
                placeholder="npr. 1200"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') commitMeasure() }}
              />
              <p className="text-[10px] text-muted-foreground">
                Vrednost se prikaže kot oznaka na črti (npr. &quot;1.20 m&quot;).
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setMeasureInput(null)}>
                Prekliči
              </Button>
              <Button type="button" size="sm" onClick={commitMeasure} className="bg-roksal-amber text-white hover:bg-roksal-amber/90">
                <Check className="mr-1 h-3.5 w-3.5" />
                Potrdi
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

// ============================================================
// BEFORE/AFTER SLIDER — za prikaz Pred/Po parov
// ============================================================
function BeforeAfterSlider({
  before,
  after,
  beforeLabel = 'PRED',
  afterLabel = 'PO',
}: {
  before: string
  after: string
  beforeLabel?: string
  afterLabel?: string
}) {
  const [pos, setPos] = useState(50)
  return (
    <div
      className="relative w-full select-none overflow-hidden rounded-lg"
      style={{ aspectRatio: '4 / 3', backgroundImage: `url(${before})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      {/* After (PO) slika, prevlečena s clip-path */}
      { }
      <img
        src={after}
        alt={afterLabel}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
        draggable={false}
      />
      {/* Ločnica */}
      <div
        className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-white shadow-md"
        style={{ left: `${pos}%` }}
      >
        <div className="absolute top-1/2 left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-roksal-navy bg-white shadow-lg">
          <ChevronLeft className="h-3 w-3 text-roksal-navy" />
          <ChevronRight className="h-3 w-3 text-roksal-navy" />
        </div>
      </div>
      {/* Oznaki */}
      <Badge className="absolute left-2 top-2 bg-blue-500/90 text-white text-[9px]">{beforeLabel}</Badge>
      <Badge className="absolute right-2 top-2 bg-green-600/90 text-white text-[9px]">{afterLabel}</Badge>
      {/* Slider input */}
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        aria-label="Premakni za primerjavo"
      />
    </div>
  )
}

// ============================================================
// PAIR CREATOR DIALOG — ročna izbira PRED + PO para
// ============================================================
function PairCreatorDialog({
  onClose,
  predPhotos,
  poPhotos,
  existingPairs,
  onCreate,
}: {
  onClose: () => void
  predPhotos: Photo[]
  poPhotos: Photo[]
  existingPairs: PhotoPair[]
  onCreate: (pair: PhotoPair) => void
}) {
  const predAvailable = predPhotos.filter((p) => !existingPairs.some((pr) => pr.predId === p.id))
  const poAvailable = poPhotos.filter((p) => !existingPairs.some((pr) => pr.poId === p.id))

  const [predId, setPredId] = useState(() => predAvailable[0]?.id ?? '')
  const [poId, setPoId] = useState(() => poAvailable[0]?.id ?? '')

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-roksal-amber" />
            Ustvari Pred/Po par
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1 block text-xs">PRED slika</Label>
            <select
              value={predId}
              onChange={(e) => setPredId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {predAvailable.length === 0 && <option value="">Ni razpoložljivih PRED slik</option>}
              {predAvailable.map((p) => (
                <option key={p.id} value={p.id}>
                  {new Date(p.createdAt).toLocaleString('sl-SI')}
                  {p.opomba ? ` — ${p.opomba.slice(0, 30)}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">PO slika</Label>
            <select
              value={poId}
              onChange={(e) => setPoId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {poAvailable.length === 0 && <option value="">Ni razpoložljivih PO slik</option>}
              {poAvailable.map((p) => (
                <option key={p.id} value={p.id}>
                  {new Date(p.createdAt).toLocaleString('sl-SI')}
                  {p.opomba ? ` — ${p.opomba.slice(0, 30)}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Predogled parov */}
          {predId && poId && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1 text-[10px] text-muted-foreground">PRED</p>
                { }
                <img
                  src={predPhotos.find((p) => p.id === predId)?.imageData}
                  alt="Pred"
                  className="aspect-[4/3] w-full rounded-md object-cover"
                />
              </div>
              <div>
                <p className="mb-1 text-[10px] text-muted-foreground">PO</p>
                { }
                <img
                  src={poPhotos.find((p) => p.id === poId)?.imageData}
                  alt="Po"
                  className="aspect-[4/3] w-full rounded-md object-cover"
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Prekliči
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!predId || !poId}
            onClick={() => onCreate({ predId, poId })}
            className="bg-roksal-amber text-white hover:bg-roksal-amber/90"
          >
            <Check className="mr-1 h-3.5 w-3.5" />
            Ustvari par
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
