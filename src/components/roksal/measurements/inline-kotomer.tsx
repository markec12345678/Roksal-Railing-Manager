// R319 — dekompozicija measurements-tab (faza 1): izluščeno iz measurements-tab.tsx BREZ spremembe obnašanja (čist premik).

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CornerDownRight,
  Layers2,
  Triangle,
  X,
  Gauge,
  Lock,
  Unlock,
  Bookmark,
  Save,
} from 'lucide-react'
import { LOKACIJE_INCLINOMETER, type SlopeReading } from './shared'

// ============================================
// P3 — KOMPONENTA: InlineKotomer (protractor)
// ============================================

export function InlineKotomer({
  mode,
  stairKot,
  onClose,
  onSave,
}: {
  mode: 'KOT' | 'KOT_VOGAL' | 'KOT_STOPNISCE'
  stairKot: number | null
  onClose: () => void
  onSave: (
    kotStopinje: number,
    notranjiKot: number | null,
    zunanjiKot: number | null,
    lokacija: string
  ) => void
}) {
  const [reading, setReading] = useState<SlopeReading | null>(null)
  const [permission, setPermission] = useState<'idle' | 'granted' | 'denied' | 'unsupported'>('idle')
  const [monitoring, setMonitoring] = useState(false)
  const [lockedAngle, setLockedAngle] = useState<number | null>(null)
  // P3 — za KOT_STOPNISCE pred-fill iz stair čarovnika (initial state, ne useEffect)
  const [manualAngle, setManualAngle] = useState<string>(
    mode === 'KOT_STOPNISCE' && stairKot != null ? stairKot.toFixed(1) : ''
  )
  const [notranjiInput, setNotranjiInput] = useState('')
  const [zunanjiInput, setZunanjiInput] = useState('')
  const [lokacija, setLokacija] = useState(
    mode === 'KOT_STOPNISCE' ? 'Stopnišče' : LOKACIJE_INCLINOMETER[0]
  )
  const [customLokacija, setCustomLokacija] = useState('')

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

  // trenutni kot iz senzorja
  const currentAngle = reading
    ? Math.abs((reading.beta + 360) % 360 - 90) // kot od navpičnice
    : null

  function handleLockAngle() {
    if (currentAngle == null) {
      toast.error('Branje senzorja ni na voljo')
      return
    }
    setLockedAngle(Number(currentAngle.toFixed(1)))
    if (mode === 'KOT_VOGAL') {
      // notranji = 180 - kot; zunanji = kot
      setNotranjiInput((180 - Number(currentAngle.toFixed(1))).toFixed(1))
      setZunanjiInput(currentAngle.toFixed(1))
    }
    toast.success(`Kot zaklenjen: ${currentAngle.toFixed(1)}°`)
  }

  function handleSaveKotomer() {
    const finalLokacija = lokacija === 'Drugo' ? customLokacija || 'Drugo' : lokacija
    let kot = 0
    let notranji: number | null = null
    let zunanji: number | null = null
    if (mode === 'KOT_VOGAL') {
      notranji = parseFloat(notranjiInput) || 0
      zunanji = parseFloat(zunanjiInput) || 0
      kot = zunanji // uporabimo zunanji kot kot primarno vrednost
    } else {
      kot = lockedAngle ?? parseFloat(manualAngle) ?? 0
    }
    if (!Number.isFinite(kot) || kot < 0) {
      toast.error('Vnesite veljaven kot!')
      return
    }
    onSave(kot, notranji, zunanji, finalLokacija)
  }

  // vizualni kot za protractor (0-180)
  const displayAngle =
    mode === 'KOT_VOGAL'
      ? parseFloat(zunanjiInput) || lockedAngle || currentAngle || 0
      : lockedAngle ?? parseFloat(manualAngle) ?? currentAngle ?? 0
  const clampedAngle = Math.max(0, Math.min(180, displayAngle))
  // kot v radianih za lok
  const angleRad = (clampedAngle * Math.PI) / 180
  const protractorR = 70
  const cx = 90
  const cy = 90
  // točka na loku
  const endX = cx + protractorR * Math.cos(Math.PI - angleRad)
  const endY = cy - protractorR * Math.sin(Math.PI - angleRad)

  const modeIcon =
    mode === 'KOT_VOGAL' ? (
      // R319: aria-hidden dodan — dekompozicija je ODKRILA slepo pego R254
      // codemoda (vejica v uvoznem komentarju je ikono skrila detektorju;
      // sorojenci Layers2/Triangle sta ga imela od R254).
      <CornerDownRight aria-hidden="true" className="h-4 w-4 text-roksal-amber" />
    ) : mode === 'KOT_STOPNISCE' ? (
      <Layers2 aria-hidden="true" className="h-4 w-4 text-roksal-amber" />
    ) : (
      <Triangle aria-hidden="true" className="h-4 w-4 text-roksal-amber" />
    )
  const modeTitle =
    mode === 'KOT_VOGAL'
      ? 'Meritev vogala (L-oblika)'
      : mode === 'KOT_STOPNISCE'
        ? 'Kot stopnice (rake)'
        : 'Meritev kota'

  return (
    <Card className="card-hover transition-all duration-200 animate-fade-in-up border-roksal-amber/30">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
            {modeIcon}
            {modeTitle}
          </CardTitle>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
            aria-label={`Zapri ${modeTitle}`}
          >
            <X className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {/* Protractor SVG */}
        <div className="flex justify-center">
          <div className="relative">
            <svg
              viewBox="0 0 180 110"
              className="w-full max-w-[240px]"
              role="img"
              aria-label="Kotomer"
            >
              {/* osnova (ravna črta) */}
              <line
                x1={cx - protractorR}
                y1={cy}
                x2={cx + protractorR}
                y2={cy}
                stroke="#1d2b3e"
                strokeWidth="1.5"
              />
              {/* polkrožnica (protractor) */}
              <path
                d={`M ${cx - protractorR} ${cy} A ${protractorR} ${protractorR} 0 0 1 ${cx + protractorR} ${cy}`}
                fill="none"
                stroke="#1d2b3e"
                strokeWidth="1"
                opacity={0.4}
              />
              {/* oznake stopinj (vsakih 15°) */}
              {Array.from({ length: 13 }).map((_, i) => {
                const deg = i * 15
                const rad = (deg * Math.PI) / 180
                const x1 = cx + (protractorR - 4) * Math.cos(Math.PI - rad)
                const y1 = cy - (protractorR - 4) * Math.sin(Math.PI - rad)
                const x2 = cx + protractorR * Math.cos(Math.PI - rad)
                const y2 = cy - protractorR * Math.sin(Math.PI - rad)
                return (
                  <g key={i}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1d2b3e" strokeWidth="0.6" opacity={0.6} />
                    {deg % 30 === 0 && (
                      <text
                        x={cx + (protractorR - 12) * Math.cos(Math.PI - rad)}
                        y={cy - (protractorR - 12) * Math.sin(Math.PI - rad)}
                        fill="#1d2b3e"
                        fontSize="6"
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        {deg}
                      </text>
                    )}
                  </g>
                )
              })}
              {/* kazalec (rotiran glede na kot) */}
              <line
                x1={cx}
                y1={cy}
                x2={endX}
                y2={endY}
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* mehurček (center) */}
              <circle cx={cx} cy={cy} r="4" fill="#1d2b3e" />
              <circle cx={cx} cy={cy} r="2" fill="#f59e0b" />
              {/* prikaz številke kota */}
              <text
                x={cx}
                y={cy + 18}
                fill="#f59e0b"
                fontSize="14"
                fontWeight="bold"
                textAnchor="middle"
              >
                {clampedAngle.toFixed(1)}°
              </text>
            </svg>
          </div>
        </div>

        {/* Live senzor */}
        <div className="rounded-lg border border-roksal-navy/10 dark:border-roksal-ink/15 bg-secondary/20 p-2.5 text-center">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">
            Senzor naprave (beta/gamma)
          </p>
          <p className="text-lg font-bold text-roksal-ink font-mono">
            {currentAngle != null ? `${currentAngle.toFixed(1)}°` : '—'}
            {reading && (
              <span className="ml-2 text-2xs text-muted-foreground font-normal">
                (β {reading.beta.toFixed(0)}°, γ {reading.gamma.toFixed(0)}°)
              </span>
            )}
          </p>
        </div>

        {/* Kontrola senzorja */}
        {permission === 'idle' && (
          <Button
            type="button"
            onClick={enableSensor}
            className="w-full bg-roksal-amber text-white hover:bg-roksal-amber/90 h-9"
          >
            <Gauge aria-hidden="true" className="mr-2 h-4 w-4" />
            Vklopi senzor kotomera
          </Button>
        )}
        {permission === 'granted' && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={monitoring ? 'outline' : 'default'}
              onClick={() => setMonitoring(!monitoring)}
              className="h-9"
            >
              <Gauge aria-hidden="true" className="mr-1.5 h-4 w-4" />
              {monitoring ? 'Ustavi' : ' merit'}
            </Button>
            <Button
              type="button"
              onClick={handleLockAngle}
              disabled={!monitoring || currentAngle == null}
              className="h-9 bg-roksal-navy text-white hover:bg-roksal-navy/90"
            >
              {lockedAngle != null ? <Lock aria-hidden="true" className="mr-1.5 h-4 w-4" /> : <Unlock aria-hidden="true" className="mr-1.5 h-4 w-4" />}
              {lockedAngle != null ? `Zaklenjeno ${lockedAngle}°` : 'Zakleni kot'}
            </Button>
          </div>
        )}
        {permission === 'denied' && (
          <p className="text-center text-[11px] text-red-600 dark:text-red-400">
            Dostop do senzorjev je zavrnjen.
          </p>
        )}
        {permission === 'unsupported' && (
          <p className="text-center text-[11px] text-amber-600 dark:text-amber-400">
            Ta naprava ne podpira senzorjev orientacije — uporabite ročni vnos.
          </p>
        )}

        {/* Za KOT_VOGAL: 2 vnosa */}
        {mode === 'KOT_VOGAL' ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Notranji kot (°)</Label>
              <Input
                type="number"
                value={notranjiInput}
                onChange={(e) => setNotranjiInput(e.target.value)}
                placeholder="90"
                className="h-10 font-mono"
              />
              <p className="text-[9px] text-muted-foreground">α = 180° − zunanji</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Zunanji kot (°)</Label>
              <Input
                type="number"
                value={zunanjiInput}
                onChange={(e) => setZunanjiInput(e.target.value)}
                placeholder="90"
                className="h-10 font-mono"
              />
              <p className="text-[9px] text-muted-foreground">β = 180° − notranji</p>
            </div>
          </div>
        ) : (
          /* Za KOT/KOT_STOPNISCE: 1 vnos */
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              {lockedAngle != null ? 'Zaklenjeni kot (ročno popravljivo)' : 'Ročni vnos kota (°)'}
            </Label>
            <Input
              type="number"
              value={manualAngle}
              onChange={(e) => {
                setManualAngle(e.target.value)
                setLockedAngle(null)
              }}
              placeholder={stairKot != null ? stairKot.toFixed(1) : '33'}
              className="h-10 font-mono"
            />
            {mode === 'KOT_STOPNISCE' && stairKot != null && (
              <p className="text-[9px] text-roksal-amber">
                <Bookmark aria-hidden="true" className="inline h-2.5 w-2.5 mr-1" />
                Predlog iz stopniščnega čarovnika: {stairKot.toFixed(1)}°
              </p>
            )}
          </div>
        )}

        {/* Lokacija */}
        <div className="space-y-1.5">
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
        </div>

        <Button
          type="button"
          onClick={handleSaveKotomer}
          className="w-full bg-roksal-navy text-white hover:bg-roksal-navy/90 h-9 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
          title="Shrani izmerjeni kot v meritev izbrane lokacije"
        >
          <Save aria-hidden="true" className="mr-2 h-4 w-4" />
          Shrani kot {mode === 'KOT_VOGAL' ? 'vogal' : mode === 'KOT_STOPNISCE' ? 'kot stopnice' : 'kot'}
        </Button>
      </CardContent>
    </Card>
  )
}
