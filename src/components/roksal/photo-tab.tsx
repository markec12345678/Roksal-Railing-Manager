'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Camera, Trash2, MapPin, Image as ImageIcon, X, Check, Loader2, AlertTriangle } from 'lucide-react'

interface Photo {
  id: string
  kategorija: string
  imageData: string
  opomba: string | null
  latitude: number | null
  longitude: number | null
  createdAt: string
}

const KATEGORIJE = [
  { id: 'PRED', label: 'Pred montažo', cls: 'bg-blue-100 text-blue-800' },
  { id: 'MED', label: 'Med montažo', cls: 'bg-amber-100 text-amber-800' },
  { id: 'PO', label: 'Po montaži', cls: 'bg-green-100 text-green-800' },
]

export function PhotoTab({ projectId }: { projectId: string | null }) {
  const [cameraOpen, setCameraOpen] = useState(false)
  const [activeKategorija, setActiveKategorija] = useState<'PRED' | 'MED' | 'PO'>('MED')
  const [filterKat, setFilterKat] = useState<'ALL' | 'PRED' | 'MED' | 'PO'>('ALL')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(false)
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null)
  const { toast } = useToast()

  const loadPhotos = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/photos?projectId=${projectId}${filterKat !== 'ALL' ? `&kategorija=${filterKat}` : ''}`)
      if (res.ok) setPhotos(await res.json())
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [projectId, filterKat])

  useEffect(() => {
    loadPhotos()
  }, [loadPhotos])

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/photos?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: 'Slika izbrisana' })
        loadPhotos()
      }
    } catch {
      toast({ title: 'Napaka pri brisanju', variant: 'destructive' })
    }
  }

  // Števce po kategorijah
  const counts = {
    PRED: photos.filter((p) => p.kategorija === 'PRED').length,
    MED: photos.filter((p) => p.kategorija === 'MED').length,
    PO: photos.filter((p) => p.kategorija === 'PO').length,
  }

  return (
    <div className="space-y-4 p-4">
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

          {/* Gumb za odprt kamere */}
          <Button
            type="button"
            onClick={() => setCameraOpen(true)}
            disabled={!projectId}
            className="w-full bg-roksal-amber text-white hover:bg-roksal-amber/90"
          >
            <Camera className="mr-2 h-4 w-4" />
            Slikaj
          </Button>

          {/* Števci po kategorijah */}
          <div className="grid grid-cols-3 gap-2">
            {KATEGORIJE.map((k) => (
              <div key={k.id} className="rounded-lg border border-border bg-white p-2 text-center">
                <div className="text-lg font-bold text-roksal-navy">{counts[k.id as keyof typeof counts]}</div>
                <div className="text-[10px] text-muted-foreground">{k.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filter */}
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
            {k === 'ALL' ? 'Vse' : KATEGORIJE.find((c) => c.id === k)?.label}
          </Button>
        ))}
      </div>

      {/* Galerija slik */}
      {loading ? (
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-square animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <ImageIcon className="mb-2 h-10 w-10 opacity-30" />
          <p className="text-sm">Ni še slik za ta projekt.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => {
            const kat = KATEGORIJE.find((k) => k.id === p.kategorija)
            return (
              <div key={p.id} className="group relative aspect-square overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.imageData}
                  alt={p.opomba ?? 'Slika projekta'}
                  className="h-full w-full cursor-pointer object-cover"
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
              </div>
            )
          })}
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

      {/* Predogled slike */}
      <Dialog open={!!previewPhoto} onOpenChange={(o) => !o && setPreviewPhoto(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
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
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewPhoto.imageData} alt="Predogled" className="w-full rounded-lg" />
              {previewPhoto.opomba && <p className="text-sm text-muted-foreground">{previewPhoto.opomba}</p>}
              {previewPhoto.latitude !== null && previewPhoto.longitude !== null && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 text-roksal-amber" />
                  {previewPhoto.latitude.toFixed(5)}, {previewPhoto.longitude.toFixed(5)}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {previewPhoto && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  handleDelete(previewPhoto.id)
                  setPreviewPhoto(null)
                }}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Izbriši
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// KAMERA CAPTURE — polnozaslonska kamera z zajemom
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
  const { toast } = useToast()

  // Zaženi kamero
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

    // GPS
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
    // Max širina 1280px za kompresijo
    const scale = Math.min(1, 1280 / video.videoWidth)
    canvas.width = video.videoWidth * scale
    canvas.height = video.videoHeight * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    // JPEG kompresija 0.75
    const data = canvas.toDataURL('image/jpeg', 0.75)
    setCapturedData(data)
    setStatus('captured')
    // Ustavi video stream med predogledom
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }

  function handleRetake() {
    setCapturedData(null)
    setStatus('starting')
    // Ponovno zaženi kamero
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

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between bg-black/80 px-4 py-3 text-white">
        <button type="button" onClick={handleClose} className="rounded-full p-1.5 hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
        <span className="text-sm font-medium">Slikanje — {KATEGORIJE.find((k) => k.id === kategorija)?.label}</span>
        {gps && (
          <div className="flex items-center gap-1 text-[10px] text-green-400">
            <MapPin className="h-3 w-3" />
            GPS
          </div>
        )}
        {!gps && <div className="w-6" />}
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
          // eslint-disable-next-line @next/next/no-img-element
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
