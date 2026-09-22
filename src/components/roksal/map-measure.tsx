'use client'

// Satelitsko merjenje črte ograje (map measure).
// Iz raziskave forumov: QuoteIQ oglašuje "satellite measuring" kot ključno
// funkcijo za ograjnike (merjenje brez odhoda na teren); ProFence ima
// "Measure Your Fence Line" — stranka riše črto na zemljevidu. To je enakovredna
// funkcija: klikni točke na satelitskem posnetku → dolžina črte → meritev.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { fetchWithQueue } from '@/lib/offline-queue'
import {
  MapPin,
  Undo2,
  Eraser,
  Save,
  Loader2,
  Satellite,
  LocateFixed,
  Ruler,
} from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Map as LeafletMap, LayerGroup, Polyline as LeafletPolyline } from 'leaflet'

interface MapMeasureProps {
  projectId: string | null
}

interface Pt {
  lat: number
  lng: number
}

const SLO_CENTER: Pt = { lat: 46.1199, lng: 14.8153 } // center Slovenije

const VISINE = [
  { v: '1000', label: '1000 mm' },
  { v: '1200', label: '1200 mm' },
  { v: '1500', label: '1500 mm' },
  { v: '1800', label: '1800 mm (standard)' },
  { v: '2000', label: '2000 mm' },
  { v: '2200', label: '2200 mm' },
]

/** Razdalja po velikem krogu (haversine) v metrih. */
function haversineM(a: Pt, b: Pt): number {
  const R = 6371008.8
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function pinIcon(n: number, first: boolean) {
  return L.divIcon({
    className: 'roksal-map-pin',
    html:
      `<div style="width:26px;height:26px;border-radius:50%;background:${first ? '#f59e0b' : '#1d2b3e'};` +
      `color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;` +
      `border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${n}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

export function MapMeasure({ projectId }: MapMeasureProps) {
  const mapElRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markersRef = useRef<LayerGroup | null>(null)
  const lineRef = useRef<LeafletPolyline | null>(null)
  const initializedRef = useRef(false)

  const [points, setPoints] = useState<Pt[]>([])
  const [centeredOn, setCenteredOn] = useState<'projekt' | 'gps' | 'slovenija' | null>(null)
  const [saving, setSaving] = useState(false)
  const [visina, setVisina] = useState('1800')
  const { toast } = useToast()

  const segmentsM = useMemo(() => {
    const out: number[] = []
    for (let i = 1; i < points.length; i++) out.push(haversineM(points[i - 1], points[i]))
    return out
  }, [points])
  const totalM = useMemo(() => segmentsM.reduce((s, x) => s + x, 0), [segmentsM])

  // Inicializacija zemljevida (enkrat)
  useEffect(() => {
    if (initializedRef.current || !mapElRef.current) return
    initializedRef.current = true

    const map = L.map(mapElRef.current, { zoomControl: false, attributionControl: true }).setView(
      [SLO_CENTER.lat, SLO_CENTER.lng],
      12,
    )
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Satelit: Esri, Maxar, Earthstar Geographics',
      },
    ).addTo(map)
    // Ozemljska imena čez satelit
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, opacity: 0.85 },
    ).addTo(map)

    markersRef.current = L.layerGroup().addTo(map)

    map.on('click', (e: L.LeafletMouseEvent) => {
      setPoints((prev) => [...prev, { lat: e.latlng.lat, lng: e.latlng.lng }])
    })

    mapRef.current = map
    setCenteredOn('slovenija')

    return () => {
      map.remove()
      mapRef.current = null
      initializedRef.current = false
    }
  }, [])

  // Risanje točk in črte ob spremembi state-a
  useEffect(() => {
    const map = mapRef.current
    const group = markersRef.current
    if (!map || !group) return
    group.clearLayers()
    points.forEach((p, i) => {
      L.marker([p.lat, p.lng], { icon: pinIcon(i + 1, i === 0) }).addTo(group)
    })
    if (lineRef.current) {
      lineRef.current.remove()
      lineRef.current = null
    }
    if (points.length >= 2) {
      lineRef.current = L.polyline(
        points.map((p) => [p.lat, p.lng] as [number, number]),
        { color: '#f59e0b', weight: 4, opacity: 0.85, dashArray: '1' },
      ).addTo(map)
    }
  }, [points])

  // Centriranje na projekt (ko se projekt izbere)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !projectId) return
    // Koordinati projekta prihajata prek propsa v naslednji verziji; tu
    // uporabimo globalni dogodek iz page.tsx ali privzeto Slovenijo.
    setCenteredOn((c) => c ?? 'slovenija')
  }, [projectId])

  function locateMe() {
    if (!mapRef.current || !navigator.geolocation) {
      toast({ title: 'GPS ni dosegljiv', variant: 'destructive' })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 18)
        setCenteredOn('gps')
        toast({ title: 'Centrirano na vašo lokacijo' })
      },
      () => toast({ title: 'Lokacije ni bilo mogoče dobiti', variant: 'destructive' }),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  function undo() {
    setPoints((prev) => prev.slice(0, -1))
  }

  function clearAll() {
    setPoints([])
  }

  async function saveMeasurement() {
    if (!projectId) {
      toast({ title: 'Brez projekta', description: 'Izberite projekt v zavihku Domov.', variant: 'destructive' })
      return
    }
    if (points.length < 2 || totalM < 0.5) {
      toast({ title: 'Premalo točk', description: 'Kliknite vsaj 2 točki na zemljevidu.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await fetchWithQueue('/api/measurements', {
        method: 'POST',
        body: {
          projectId,
          dolzinaMm: Math.round(totalM * 1000),
          visinaMm: Number(visina),
          gpsLokacija: { lat: points[0].lat, lng: points[0].lng },
          arMetadata: {
            source: 'satellite-map',
            provider: 'esri-world-imagery',
            tockeCount: points.length,
            segmentiM: segmentsM.map((s) => Math.round(s * 100) / 100),
            skupajM: Math.round(totalM * 100) / 100,
          },
        },
        label: 'Satelitska meritev',
      })
      if (res.status === 202) {
        toast({ title: 'Shranjeno v vrsto', description: 'Meritev se pošlje, ko bo povezava spet na voljo.' })
      } else if (res.ok) {
        toast({ title: 'Meritev shranjena', description: `${totalM.toFixed(1)} m → Meritve` })
      } else {
        throw new Error()
      }
      setPoints([])
    } catch {
      toast({ title: 'Napaka', description: 'Meritve ni bilo mogoče shraniti.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      {/* Mikro-animacije pina (vstop + pritisk) */}
      <style>{`
        @keyframes roksal-pin-in {
          from { transform: translateY(-8px) scale(.6); opacity: 0 }
        }
        .roksal-map-pin {
          animation: roksal-pin-in .22s ease-out;
          filter: drop-shadow(0 2px 3px rgba(0,0,0,.35));
          transition: transform .15s ease;
        }
        .roksal-map-pin:active { transform: scale(.9); }
        @keyframes roksal-hint-pulse {
          0%, 100% { opacity: 1 }
          50% { opacity: .75 }
        }
        .roksal-map-hint { animation: roksal-hint-pulse 2.4s ease-in-out infinite; }
      `}</style>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-roksal-navy">
          <Satellite className="h-5 w-5 text-roksal-amber" />
          Satelitsko merjenje črte
          <Badge variant="outline" className="ml-auto text-[11px]">
            brez odhoda na teren
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Zemljevid */}
        <div className="relative h-[280px] w-full overflow-hidden rounded-lg border border-stone-200 sm:h-[340px]">
          <div ref={mapElRef} className="h-full w-full" aria-label="Satelitski zemljevid za merjenje" />
          <div className="roksal-map-hint pointer-events-none absolute left-2 top-2 z-[500] rounded-md bg-roksal-navy/90 px-2.5 py-1.5 text-xs font-medium text-white shadow">
            {points.length === 0
              ? 'Kliknite na zemljevid za prvo točko'
              : points.length === 1
                ? 'Kliknite naslednjo točko črte'
                : `${points.length} točk · kliknite za nadaljevanje`}
          </div>
          <button
            type="button"
            onClick={locateMe}
            aria-label="Centriraj na mojo lokacijo"
            className="absolute bottom-16 right-2 z-[500] flex h-11 w-11 items-center justify-center rounded-full bg-white text-roksal-navy shadow-md transition-transform active:scale-95"
          >
            <LocateFixed className="h-5 w-5" />
          </button>
        </div>

        {/* Rezultati */}
        <div className="flex items-center gap-3 rounded-lg bg-stone-50 p-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-roksal-amber/15">
            <Ruler className="h-5 w-5 text-roksal-amber" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Dolžina črte ograje</p>
            <p className="text-xl font-bold tabular-nums text-roksal-navy">
              {totalM >= 100 ? `${(totalM / 1000).toFixed(2)} km` : `${totalM.toFixed(1)} m`}
            </p>
          </div>
          {segmentsM.length > 0 && (
            <p className="hidden shrink-0 text-xs text-muted-foreground sm:block">
              {segmentsM.length} segment{segmentsM.length === 1 ? '' : 'ov'}
            </p>
          )}
        </div>

        {segmentsM.length > 1 && (
          <div className="max-h-24 space-y-1 overflow-y-auto rounded-lg border border-stone-200 p-2">
            {segmentsM.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Segment {i + 1} ({i + 1} → {i + 2})
                </span>
                <span className="font-medium tabular-nums text-stone-700">{s.toFixed(1)} m</span>
              </div>
            ))}
          </div>
        )}

        {/* Višina + dejanja */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={visina} onValueChange={setVisina}>
            <SelectTrigger className="h-10 w-[190px]" aria-label="Višina ograje">
              <SelectValue placeholder="Višina ograje" />
            </SelectTrigger>
            <SelectContent>
              {VISINE.map((v) => (
                <SelectItem key={v.v} value={v.v}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10"
            disabled={points.length === 0}
            onClick={undo}
          >
            <Undo2 className="mr-1.5 h-4 w-4" />
            Nazaj
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10"
            disabled={points.length === 0}
            onClick={clearAll}
          >
            <Eraser className="mr-1.5 h-4 w-4" />
            Počisti
          </Button>
          <Button
            type="button"
            size="sm"
            className="ml-auto h-10 bg-roksal-navy hover:bg-roksal-navy/90"
            disabled={points.length < 2 || saving}
            onClick={() => void saveMeasurement()}
          >
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Shrani v meritve
          </Button>
        </div>

        <p className="text-[11px] leading-snug text-muted-foreground">
          <MapPin className="mr-1 inline h-3 w-3" />
          Natančnost satelitskega posnetka je cca. ±1–2 m — primerno za informativno ponudbo;
          končna meritev ostane AR na terenu.
        </p>
      </CardContent>
    </Card>
  )
}
