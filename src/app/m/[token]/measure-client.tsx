'use client'

// Samomeritev stranke — interaktivni del (runda G).
// Stranka klikne točke črte ograje na satelitski karti, vpiše kontakt in pošlje.
// Enaka tehnika kot MapMeasure v aplikaciji (Leaflet + Esri satelit), vendar
// samostojna javna stran: veliki tipki, minimalen UI, brez prijave.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Loader2, MapPin, Send, LocateFixed, Undo2, Eraser, CheckCircle2 } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Map as LeafletMap, LayerGroup, Polyline as LeafletPolyline } from 'leaflet'

interface MeasureClientProps {
  token: string
  nazivProjekta: string
  stranka: string | null
}

interface Pt {
  lat: number
  lng: number
}

const SLO_CENTER: Pt = { lat: 46.1199, lng: 14.8153 }

function haversineM(a: Pt, b: Pt): number {
  const R = 6371008.8
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function pinIcon(n: number) {
  return L.divIcon({
    className: 'stranka-pin',
    html:
      `<div style="width:30px;height:30px;border-radius:50%;background:#f59e0b;color:#fff;` +
      `display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;` +
      `border:3px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,.4)">${n}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })
}

export function MeasureClient({ token, nazivProjekta, stranka }: MeasureClientProps) {
  const mapElRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markersRef = useRef<LayerGroup | null>(null)
  const lineRef = useRef<LeafletPolyline | null>(null)
  const initializedRef = useRef(false)

  const [points, setPoints] = useState<Pt[]>([])
  const [ime, setIme] = useState('')
  const [telefon, setTelefon] = useState('')
  const [opomba, setOpomba] = useState('')
  // R133 (§8): Idempotency-Key — en ključ na osnutek. Ob mrežni napaki in
  // ponovnem pošiljanju ostane ISTI (strežnik vrne ISTO meritev — brez dvojnikov).
  const idemKeyRef = useRef<string>('')
  const [reference, setReference] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const { toast } = useToast()

  const totalM = useMemo(() => {
    let sum = 0
    for (let i = 1; i < points.length; i++) sum += haversineM(points[i - 1], points[i])
    return sum
  }, [points])

  useEffect(() => {
    if (initializedRef.current || !mapElRef.current) return
    initializedRef.current = true
    const map = L.map(mapElRef.current, { zoomControl: false }).setView(
      [SLO_CENTER.lat, SLO_CENTER.lng],
      11,
    )
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Satelit: Esri' },
    ).addTo(map)
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, opacity: 0.85 },
    ).addTo(map)
    markersRef.current = L.layerGroup().addTo(map)
    map.on('click', (e: L.LeafletMouseEvent) => {
      setPoints((prev) => (prev.length >= 300 ? prev : [...prev, { lat: e.latlng.lat, lng: e.latlng.lng }]))
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      initializedRef.current = false
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const group = markersRef.current
    if (!map || !group) return
    group.clearLayers()
    points.forEach((p, i) => {
      L.marker([p.lat, p.lng], { icon: pinIcon(i + 1) }).addTo(group)
    })
    if (lineRef.current) {
      lineRef.current.remove()
      lineRef.current = null
    }
    if (points.length >= 2) {
      lineRef.current = L.polyline(
        points.map((p) => [p.lat, p.lng] as [number, number]),
        { color: '#f59e0b', weight: 5, opacity: 0.9 },
      ).addTo(map)
    }
  }, [points])

  function locateMe() {
    if (!mapRef.current || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 18),
      () => undefined,
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  async function submit() {
    if (points.length < 2) {
      toast({ title: 'Narišite vsaj 2 točki na karti', variant: 'destructive' })
      return
    }
    if (!ime.trim()) {
      toast({ title: 'Vnesite ime in priimek', variant: 'destructive' })
      return
    }
    if (!idemKeyRef.current) {
      idemKeyRef.current =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `m${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    }
    setSending(true)
    try {
      const res = await fetch('/api/public/measure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idemKeyRef.current },
        body: JSON.stringify({
          token,
          points: points.map((p) => [+p.lat.toFixed(6), +p.lng.toFixed(6)]),
          skupajM: Math.round(totalM * 10) / 10,
          imeStranke: ime.trim(),
          telefonStranke: telefon.trim() || null,
          opomba: opomba.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? 'Pošiljanje ni uspelo')
      }
      const data = (await res.json().catch(() => null)) as { id?: string } | null
      setReference(data?.id ?? null)
      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      toast({
        title: 'Napaka',
        description: err instanceof Error ? err.message : 'Poskusite znova.',
        variant: 'destructive',
      })
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <main className="min-h-screen bg-stone-100 px-4 py-10">
        <div className="mx-auto max-w-md rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="h-9 w-9 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-roksal-navy">Hvala, {ime.split(' ')[0]}!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Vaša meritev ({totalM >= 100 ? `${(totalM / 1000).toFixed(2)} km` : `${totalM.toFixed(1)} m`})
            je poslana. Kontaktirali vas bomo v 24 urah s predračunom.
          </p>
          {reference && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1 text-[11px] font-medium text-stone-500">
              Sklic: <span className="font-mono text-stone-700">{reference.slice(-8).toUpperCase()}</span>
            </p>
          )}
          <div className="mt-6 rounded-xl bg-stone-50 p-4 text-left text-xs text-muted-foreground">
            <p className="font-semibold text-stone-700">Roksal d.o.o. Kranj</p>
            <p>T: +386 4 237 05 50 · info@roksal.si</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-stone-100 pb-10">
      <style>{`
        @keyframes stranka-pin-in { from { transform: translateY(-8px) scale(.6); opacity: 0 } }
        .stranka-pin { animation: stranka-pin-in .22s ease-out; filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
      `}</style>

      {/* Glava */}
      <header className="bg-roksal-navy px-4 py-4 text-white">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-roksal-amber text-sm font-black">
            R
          </div>
          <div>
            <p className="text-sm font-bold">ROKSAL</p>
            <p className="text-[11px] text-white/60">Izmerite svojo ograjo — brez odhoda monterja</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-xl space-y-4 px-4 pt-5">
        {/* Uvod */}
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <h1 className="text-lg font-bold text-roksal-navy">
            {stranka ? `Pozdravljeni, ${stranka.split(' ')[0]}!` : 'Pozdravljeni!'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Projekt: <span className="font-medium text-stone-700">{nazivProjekta}</span>
          </p>
          <ol className="mt-3 space-y-1 text-xs text-muted-foreground">
            <li className="flex gap-2"><span className="font-bold text-roksal-amber">1.</span> poiščite svojo parcelo na karti (približajte s prsti)</li>
            <li className="flex gap-2"><span className="font-bold text-roksal-amber">2.</span> tapnite vogale, kjer naj gre ograja</li>
            <li className="flex gap-2"><span className="font-bold text-roksal-amber">3.</span> vpišite kontakt in pošljite — brezplačno in neobvezujoče</li>
          </ol>
        </div>

        {/* Karta */}
        <div className="overflow-hidden rounded-2xl border border-stone-200 shadow-sm">
          <div className="relative h-[300px] w-full sm:h-[360px]">
            <div ref={mapElRef} className="h-full w-full" aria-label="Karta za risanje črte ograje" />
            <div className="pointer-events-none absolute left-2 top-2 z-[500] rounded-lg bg-roksal-navy/90 px-3 py-1.5 text-xs font-medium text-white shadow">
              {points.length === 0
                ? '👆 Tapnite prvi vogal ograje'
                : points.length === 1
                  ? 'Tapnite naslednji vogal'
                  : `✓ ${points.length} točk — nadaljujte ali pošljite`}
            </div>
            <button
              type="button"
              onClick={locateMe}
              aria-label="Moja lokacija"
              className="absolute bottom-16 right-2 z-[500] flex h-11 w-11 items-center justify-center rounded-full bg-white text-roksal-navy shadow-md active:scale-95"
            >
              <LocateFixed className="h-5 w-5" />
            </button>
          </div>
          {/* Mer */}
          <div className="flex items-center gap-3 border-t border-stone-200 bg-white px-4 py-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-roksal-amber/15">
              <MapPin className="h-5 w-5 text-roksal-amber" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted-foreground">Dolžina vaše ograje</p>
              <p className="text-xl font-bold tabular-nums text-roksal-navy">
                {totalM >= 1000 ? `${(totalM / 1000).toFixed(2)} km` : `${totalM.toFixed(1)} m`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPoints((prev) => prev.slice(0, -1))}
              disabled={points.length === 0}
              className="flex h-10 items-center gap-1.5 rounded-lg border border-stone-300 px-3 text-xs font-medium text-stone-700 disabled:opacity-40"
            >
              <Undo2 className="h-3.5 w-3.5" /> Nazaj
            </button>
            <button
              type="button"
              onClick={() => setPoints([])}
              disabled={points.length === 0}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-300 text-stone-500 disabled:opacity-40"
              aria-label="Počisti vse točke"
            >
              <Eraser className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Obrazec */}
        <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-roksal-navy">Vaši podatki</p>
          <input
            value={ime}
            onChange={(e) => setIme(e.target.value)}
            placeholder="Ime in priimek *"
            autoComplete="name"
            className="h-12 w-full rounded-xl border border-stone-300 px-4 text-sm outline-none focus:border-roksal-amber focus:ring-2 focus:ring-roksal-amber/30"
          />
          <input
            value={telefon}
            onChange={(e) => setTelefon(e.target.value)}
            placeholder="Telefon (za ponudbo po SMS)"
            inputMode="tel"
            autoComplete="tel"
            className="h-12 w-full rounded-xl border border-stone-300 px-4 text-sm outline-none focus:border-roksal-amber focus:ring-2 focus:ring-roksal-amber/30"
          />
          <textarea
            value={opomba}
            onChange={(e) => setOpomba(e.target.value)}
            placeholder="Opomba (vrsta ograje, višina, termine…)"
            rows={2}
            className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none focus:border-roksal-amber focus:ring-2 focus:ring-roksal-amber/30"
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={sending || points.length < 2 || !ime.trim()}
            className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-roksal-amber py-3.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-roksal-amber/90 disabled:opacity-50"
            style={{ minHeight: 52 }}
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            {sending ? 'Pošiljam…' : 'Pošlji meritev'}
          </button>
          <p className="text-center text-[11px] text-muted-foreground">
            Natančnost satelita ±1–2 m — končno meritev opravi monter na terenu. Brezplačno, brez obveznosti.
          </p>
        </div>
      </div>
    </main>
  )
}
