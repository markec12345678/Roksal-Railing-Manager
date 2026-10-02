// R319 — dekompozicija measurements-tab (faza 1): izluščeno iz measurements-tab.tsx BREZ spremembe obnašanja (čist premik).

import { useEffect, useState, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Triangle,
  Mountain,
  X,
  CheckCircle2,
  AlertCircle,
  Gauge,
  RefreshCw,
  Save,
} from 'lucide-react'
import { LOKACIJE_INCLINOMETER, type SlopeReading } from './shared'

// ============================================
// KOMPONENTA: InlineInclinometer
// ============================================

export function InlineInclinometer({
  mode,
  onClose,
  onSave,
}: {
  mode: 'KOT' | 'NAGIB'
  onClose: () => void
  onSave: (kotStopinje: number, smer: string, lokacija: string) => void
}) {
  const [reading, setReading] = useState<SlopeReading | null>(null)
  const [permission, setPermission] = useState<'idle' | 'granted' | 'denied' | 'unsupported'>('idle')
  const [monitoring, setMonitoring] = useState(false)
  const [lokacija, setLokacija] = useState(LOKACIJE_INCLINOMETER[0])
  const [customLokacija, setCustomLokacija] = useState('')
  const [saving, setSaving] = useState(false)
  const rafRef = useRef<number | null>(null)

  const enableSensor = useCallback(async () => {
    const D =
      typeof window !== 'undefined'
        ? (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } })
            .DeviceOrientationEvent
        : undefined
    if (!D) {
      setPermission('unsupported')
      return
    }
    try {
      if (typeof D.requestPermission === 'function') {
        const res = await D.requestPermission()
        if (res !== 'granted') {
          setPermission('denied')
          toast.error('Dovoljenje za senzor zavrnjeno')
          return
        }
      }
      setPermission('granted')
      setMonitoring(true)
    } catch {
      setPermission('denied')
    }
  }, [])

  const stopSensor = useCallback(() => {
    setMonitoring(false)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  useEffect(() => {
    if (!monitoring) return
    const handler = (e: DeviceOrientationEvent) => {
      const beta = e.beta ?? 0
      const gamma = e.gamma ?? 0
      setReading({ beta, gamma })
    }
    window.addEventListener('deviceorientation', handler, true)
    return () => {
      window.removeEventListener('deviceorientation', handler, true)
    }
  }, [monitoring])

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const tiltX = reading ? Math.max(-45, Math.min(45, reading.gamma)) : 0
  const tiltY = reading ? Math.max(-45, Math.min(45, reading.beta - 90)) : 0
  const angleX = reading ? Math.abs(reading.gamma) : 0
  const angleY = reading ? Math.abs((reading.beta + 360) % 360 - 90) : 0
  const isLevel = angleX < 1.5 && angleY < 1.5

  async function handleSave() {
    if (!reading) return
    setSaving(true)
    const smer = angleX >= angleY ? 'Y' : 'X'
    const kot = smer === 'Y' ? Number(angleX.toFixed(1)) : Number(angleY.toFixed(1))
    const finalLokacija = lokacija === 'Drugo' ? customLokacija || 'Drugo' : lokacija
    onSave(kot, smer, finalLokacija)
    setSaving(false)
  }

  return (
    <Card className="card-hover transition-all duration-200 animate-fade-in-up border-roksal-amber/30">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
            {mode === 'KOT' ? (
              <Triangle aria-hidden="true" className="h-4 w-4 text-roksal-amber" />
            ) : (
              <Mountain aria-hidden="true" className="h-4 w-4 text-roksal-amber" />
            )}
            {mode === 'KOT' ? 'Meritev kota' : 'Meritev nagiba'}
          </CardTitle>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
            aria-label={mode === 'KOT' ? 'Zapri meritev kota' : 'Zapri meritev nagiba'}
          >
            <X className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex flex-col items-center gap-3">
        {/* Libela */}
        <div className="relative h-40 w-40 rounded-full border-4 border-roksal-navy/20 dark:border-roksal-ink/20 bg-gradient-to-br from-roksal-navy/5 to-roksal-amber/5">
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-roksal-navy/15" />
          <div className="absolute top-1/2 left-0 w-full h-px -translate-y-1/2 bg-roksal-navy/15" />
          <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-roksal-navy/30 dark:border-roksal-ink/30" />
          <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-roksal-navy" />
          <div
            className="absolute h-6 w-6 rounded-full bg-roksal-amber shadow-lg ring-2 ring-white transition-transform duration-100"
            style={{
              transform: `translate(calc(-50% + ${tiltX * 2.2}px), calc(-50% + ${tiltY * 2.2}px))`,
              left: '50%',
              top: '50%',
            }}
          />
        </div>

        {/* Prikaz kotov */}
        <div className="grid w-full grid-cols-2 gap-2">
          <div className="rounded-lg border border-roksal-navy/10 bg-card dark:border-roksal-ink/15 p-2 text-center">
            <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              Levo ↔ Desno
            </div>
            <div className="text-xl font-bold text-roksal-ink">
              {reading ? angleX.toFixed(1) : '–'}°
            </div>
          </div>
          <div className="rounded-lg border border-roksal-navy/10 bg-card dark:border-roksal-ink/15 p-2 text-center">
            <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              Naprej ↔ Nazaj
            </div>
            <div className="text-xl font-bold text-roksal-ink">
              {reading ? angleY.toFixed(1) : '–'}°
            </div>
          </div>
        </div>

        {reading && (
          <Badge variant={isLevel ? 'default' : 'secondary'} className={isLevel ? 'bg-green-600 text-white' : ''}>
            {isLevel ? (
              <>
                <CheckCircle2 aria-hidden="true" className="mr-1 h-3 w-3" /> V vodoravni
              </>
            ) : (
              <>
                <AlertCircle aria-hidden="true" className="mr-1 h-3 w-3" />
                {(angleX + angleY).toFixed(1)}° odstopanja
              </>
            )}
          </Badge>
        )}

        {/* Kontrola senzorja */}
        {permission === 'idle' && (
          <Button
            type="button"
            onClick={enableSensor}
            className="w-full bg-roksal-amber text-white hover:bg-roksal-amber/90 h-9"
          >
            <Gauge aria-hidden="true" className="mr-2 h-4 w-4" />
            Vklopi senzor
          </Button>
        )}
        {permission === 'granted' && (
          <Button
            type="button"
            variant={monitoring ? 'outline' : 'default'}
            onClick={monitoring ? stopSensor : enableSensor}
            className="w-full h-9"
          >
            {monitoring ? (
              <>
                <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" /> Ustavi merjenje
              </>
            ) : (
              <>
                <Gauge aria-hidden="true" className="mr-2 h-4 w-4" /> Nadaljuj
              </>
            )}
          </Button>
        )}
        {permission === 'denied' && (
          <p className="text-center text-[11px] text-red-600 dark:text-red-400">
            Dostop do senzorjev je zavrnjen.
          </p>
        )}
        {permission === 'unsupported' && (
          <p className="text-center text-[11px] text-amber-600 dark:text-amber-400">
            Ta naprava ne podpira senzorjev orientacije.
          </p>
        )}

        {/* Lokacija + Save */}
        {reading && monitoring && (
          <div className="w-full space-y-2 rounded-lg border border-roksal-navy/10 bg-card dark:border-roksal-ink/15 p-2.5">
            <Label className="text-xs font-medium">Lokacija meritve</Label>
            <Select value={lokacija} onValueChange={setLokacija}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOKACIJE_INCLINOMETER.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {lokacija === 'Drugo' && (
              <Input
                value={customLokacija}
                onChange={(e) => setCustomLokacija(e.target.value)}
                placeholder="Opis lokacije"
                className="h-9"
              />
            )}
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-roksal-navy text-white hover:bg-roksal-navy/90 h-9"
            >
              <Save aria-hidden="true" className="mr-2 h-4 w-4" />
              {saving ? 'Shranjujem...' : `Shrani kot ${mode === 'KOT' ? 'kot' : 'nagib'}`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
