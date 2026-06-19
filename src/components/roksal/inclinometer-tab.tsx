'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Compass, RefreshCw, Save, TriangleAlert, CheckCircle2 } from 'lucide-react'

interface SlopeReading {
  beta: number // X front-back tilt (-180 to 180)
  gamma: number // Y left-right tilt (-90 to 90)
}

interface SavedSlope {
  id: string
  kotStopinje: number
  smer: string | null
  lokacija: string | null
  createdAt: string
}

const LOKACIJE = [
  'Talna plošča balkona',
  'Podkonstrukcija',
  'Rob balkona',
  'Stopnišče',
  'Terasa',
  'Drugo',
]

export function InclinometerTab({ projectId }: { projectId: string | null }) {
  const [reading, setReading] = useState<SlopeReading | null>(null)
  const [permission, setPermission] = useState<'idle' | 'granted' | 'denied' | 'unsupported'>('idle')
  const [monitoring, setMonitoring] = useState(false)
  const [lokacija, setLokacija] = useState(LOKACIJE[0])
  const [customLokacija, setCustomLokacija] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<SavedSlope[]>([])
  const { toast } = useToast()
  const rafRef = useRef<number | null>(null)

  // Zahtevek za dovoljenje (iOS 13+) in začetek poslušanja
  const enableSensor = useCallback(async () => {
    // iOS zahteva requestPermission
    const D = typeof window !== 'undefined' ? (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent : undefined
    if (!D) {
      setPermission('unsupported')
      return
    }
    try {
      if (typeof D.requestPermission === 'function') {
        const res = await D.requestPermission()
        if (res !== 'granted') {
          setPermission('denied')
          toast({ title: 'Dovoljenje zavrnjeno', description: 'Brez dostopa do senzorjev nagiba libela ne deluje.', variant: 'destructive' })
          return
        }
      }
      setPermission('granted')
      setMonitoring(true)
    } catch {
      setPermission('denied')
    }
  }, [toast])

  const stopSensor = useCallback(() => {
    setMonitoring(false)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  useEffect(() => {
    if (!monitoring) return
    const handler = (e: DeviceOrientationEvent) => {
      // beta: front-back (-180..180), gamma: left-right (-90..90)
      const beta = e.beta ?? 0
      const gamma = e.gamma ?? 0
      setReading({ beta, gamma })
    }
    window.addEventListener('deviceorientation', handler, true)
    return () => {
      window.removeEventListener('deviceorientation', handler, true)
    }
  }, [monitoring])

  // Naloži zgodovino nagibov za projekt
  const loadSaved = useCallback(async () => {
    if (!projectId) return
    try {
      const res = await fetch(`/api/slopes?projectId=${projectId}`)
      if (res.ok) setSaved(await res.json())
    } catch {
      /* ignore */
    }
  }, [projectId])

  useEffect(() => {
    loadSaved()
  }, [loadSaved])

  // Izračun prikaza libele
  const tiltX = reading ? Math.max(-45, Math.min(45, reading.gamma)) : 0 // levo-desno
  const tiltY = reading ? Math.max(-45, Math.min(45, reading.beta - 90)) : 0 // naprej-nazaj (relativno na vertikalo)
  const angleX = reading ? Math.abs(reading.gamma) : 0
  const angleY = reading ? Math.abs((reading.beta + 360) % 360 - 90) : 0
  const isLevel = angleX < 1.5 && angleY < 1.5

  async function handleSave() {
    if (!projectId) {
      toast({ title: 'Brez projekta', description: 'Izberite projekt pred shranjevanjem.', variant: 'destructive' })
      return
    }
    if (!reading) return
    setSaving(true)
    try {
      const smer = angleX >= angleY ? 'Y' : 'X'
      const kot = smer === 'Y' ? Number(angleX.toFixed(1)) : Number(angleY.toFixed(1))
      const res = await fetch('/api/slopes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          kotStopinje: kot,
          smer,
          lokacija: lokacija === 'Drugo' ? customLokacija || 'Drugo' : lokacija,
        }),
      })
      if (res.ok) {
        toast({ title: 'Nagib shranjen', description: `${kot}° (${smer === 'Y' ? 'levo-desno' : 'naprej-nazaj'}) — ${lokacija === 'Drugo' ? customLokacija : lokacija}` })
        loadSaved()
      } else {
        toast({ title: 'Napaka', description: 'Shranjevanje ni uspelo.', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Napaka', description: 'Omrežna napaka.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Compass className="h-5 w-5 text-roksal-amber" />
              Digitalna libela
            </CardTitle>
            {reading && (
              <Badge variant={isLevel ? 'default' : 'secondary'} className={isLevel ? 'bg-green-600 text-white' : ''}>
                {isLevel ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <TriangleAlert className="mr-1 h-3 w-3" />}
                {isLevel ? 'V vodoravni' : `${(angleX + angleY).toFixed(1)}°`}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {/* Libela — krožna */}
          <div className="relative h-56 w-56 rounded-full border-4 border-roksal-navy/20 bg-gradient-to-br from-roksal-navy/5 to-roksal-amber/5">
            {/* križ */}
            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-roksal-navy/15" />
            <div className="absolute top-1/2 left-0 w-full h-px -translate-y-1/2 bg-roksal-navy/15" />
            <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-roksal-navy/30" />
            <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-roksal-navy" />
            {/* mehurček */}
            <div
              className="absolute h-7 w-7 rounded-full bg-roksal-amber shadow-lg ring-2 ring-white transition-transform duration-100"
              style={{
                transform: `translate(calc(-50% + ${tiltX * 2.2}px), calc(-50% + ${tiltY * 2.2}px))`,
                left: '50%',
                top: '50%',
              }}
            />
          </div>

          {/* Prikaz kotov */}
          <div className="grid w-full grid-cols-2 gap-3">
            <div className="rounded-lg border border-roksal-navy/10 bg-white p-3 text-center">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Levo ↔ Desno</div>
              <div className="text-2xl font-bold text-roksal-navy">{reading ? angleX.toFixed(1) : '–'}°</div>
              <div className="text-[10px] text-muted-foreground">
                {reading ? (Math.abs(reading.gamma) < 1.5 ? '↓ ravno' : reading.gamma > 0 ? '→ desno' : '← levo') : ''}
              </div>
            </div>
            <div className="rounded-lg border border-roksal-navy/10 bg-white p-3 text-center">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Naprej ↔ Nazaj</div>
              <div className="text-2xl font-bold text-roksal-navy">{reading ? angleY.toFixed(1) : '–'}°</div>
              <div className="text-[10px] text-muted-foreground">
                {reading ? (angleY < 1.5 ? '↓ ravno' : reading.beta > 90 ? '↓ naprej' : '↑ nazaj') : ''}
              </div>
            </div>
          </div>

          {/* Kontrola senzorja */}
          {permission === 'idle' && (
            <Button type="button" onClick={enableSensor} className="w-full bg-roksal-amber text-white hover:bg-roksal-amber/90">
              <Compass className="mr-2 h-4 w-4" />
              Vklopi libelo
            </Button>
          )}
          {permission === 'granted' && (
            <Button type="button" variant={monitoring ? 'outline' : 'default'} onClick={monitoring ? stopSensor : enableSensor} className="w-full">
              {monitoring ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" /> Ustavi merjenje
                </>
              ) : (
                <>
                  <Compass className="mr-2 h-4 w-4" /> Nadaljuj merjenje
                </>
              )}
            </Button>
          )}
          {permission === 'denied' && (
            <p className="text-center text-sm text-red-600">Dostop do senzorjev je zavrnjen. Omogočite ga v nastavitvah brskalnika.</p>
          )}
          {permission === 'unsupported' && (
            <p className="text-center text-sm text-amber-600">Ta naprava/brskalnik ne podpira senzorjev orientacije.</p>
          )}

          {/* Shranjevanje */}
          {reading && monitoring && (
            <div className="w-full space-y-3 rounded-lg border border-roksal-navy/10 bg-white p-3">
              <Label className="text-xs font-medium">Lokacija meritve</Label>
              <Select value={lokacija} onValueChange={setLokacija}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOKACIJE.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lokacija === 'Drugo' && (
                <Input value={customLokacija} onChange={(e) => setCustomLokacija(e.target.value)} placeholder="Opis lokacije" className="h-9" />
              )}
              <Button type="button" onClick={handleSave} disabled={saving || !projectId} className="w-full bg-roksal-navy text-white hover:bg-roksal-navy/90">
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Shranjujem...' : 'Shrani nagib'}
              </Button>
              {!projectId && <p className="text-center text-[10px] text-amber-600">Izberite projekt v zavihku Domov.</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Zgodovina nagibov */}
      {saved.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Zabeleženi nagibi ({saved.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {saved.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-roksal-navy/10 bg-white p-2.5 text-xs">
                <div>
                  <div className="font-medium text-roksal-navy">{s.kotStopinje}° ({s.smer === 'Y' ? 'L↔D' : 'N↔Z'})</div>
                  <div className="text-muted-foreground">{s.lokacija ?? 'Brez lokacije'}</div>
                </div>
                <div className="text-muted-foreground">{new Date(s.createdAt).toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
