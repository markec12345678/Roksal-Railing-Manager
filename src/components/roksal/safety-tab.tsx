'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Wind,
  Thermometer,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Eye,
  EyeOff,
  Compass,
  Gauge,
  CloudRain,
  CloudSun,
  Zap,
  FileText,
} from 'lucide-react'

interface WindData {
  speed: number
  gust: number
  direction: number
  directionLabel: string
  temperature: number
  humidity: number
  pressure: number
  description: string
  isSafeForInstallation: boolean
  riskLevel: string
  maxRailingHeight: number
  calculations?: {
    windPressure: number
    windForce: number
    railingArea: number
  }
}

interface ChecklistItem {
  id: string
  label: string
  checked: boolean
}

const defaultChecklist: ChecklistItem[] = [
  { id: 's1', label: 'Varovalna čelada pravilno nameščena', checked: false },
  { id: 's2', label: 'Zaščitna očala na mestu', checked: false },
  { id: 's3', label: 'Delovne rokavice', checked: false },
  { id: 's4', label: 'Zaščitna obutev', checked: false },
  { id: 's5', label: 'Pristopna pot ocenjena (varna)', checked: false },
  { id: 's6', label: 'Električna orodja pregledana', checked: false },
  { id: 's7', label: 'Jeseniška zavarovalna mreža nameščena', checked: false },
  { id: 's8', label: 'Prva pomoč dostopna', checked: false },
]

const riskLevelConfig: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: 'Nizko tveganje', color: 'text-roksal-green', bg: 'bg-roksal-green/10' },
  medium: { label: 'Srednje tveganje', color: 'text-roksal-amber', bg: 'bg-roksal-amber/10' },
  high: { label: 'Visoko tveganje', color: 'text-roksal-red', bg: 'bg-roksal-red/10' },
  dangerous: { label: 'NEVARNOST', color: 'text-roksal-red', bg: 'bg-roksal-red/20' },
}

// Beaufort scale: wind speed (m/s) -> { scale number, Slovenian name }
function getBeaufortScale(speedMs: number): { scale: number; name: string } {
  const thresholds = [
    { max: 0.2, scale: 0, name: 'Tišina' },
    { max: 1.5, scale: 1, name: 'Sibiren vetrič' },
    { max: 3.3, scale: 2, name: 'Sibiren vetrič' },
    { max: 5.4, scale: 3, name: 'Sibiren vetrič' },
    { max: 7.9, scale: 4, name: 'Sibiren vetrič' },
    { max: 10.7, scale: 5, name: 'Šibek vetrič' },
    { max: 13.8, scale: 6, name: 'Močan vetrič' },
    { max: 17.1, scale: 7, name: 'Močan vetrič' },
    { max: 20.7, scale: 8, name: 'Viharni vetrič' },
    { max: 24.4, scale: 9, name: 'Viharni vetrič' },
    { max: 28.4, scale: 10, name: 'Vihar' },
    { max: 32.6, scale: 11, name: 'Vihar' },
    { max: Infinity, scale: 12, name: 'Orkan' },
  ]
  for (const t of thresholds) {
    if (speedMs <= t.max) return { scale: t.scale, name: t.name }
  }
  return { scale: 12, name: 'Orkan' }
}

function getHumidityColor(humidity: number): string {
  if (humidity < 60) return 'bg-roksal-green'
  if (humidity <= 80) return 'bg-roksal-amber'
  return 'bg-roksal-red'
}

function getHumidityLabel(humidity: number): string {
  if (humidity < 60) return 'Nizka — ugodno'
  if (humidity <= 80) return 'Zmerna — sprejemljivo'
  return 'Visoka — neugodno'
}

export function SafetyTab() {
  const [windData, setWindData] = useState<WindData | null>(null)
  const [loading, setLoading] = useState(true)
  const [ghostMode, setGhostMode] = useState(false)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(defaultChecklist)

  useEffect(() => {
    async function fetchWeather() {
      try {
        const res = await fetch('/api/weather?lat=46.2397&lon=14.3556')
        if (res.ok) {
          const data = await res.json()
          setWindData(data)
        } else {
          setWindData(demoWindData)
        }
      } catch {
        setWindData(demoWindData)
      } finally {
        setLoading(false)
      }
    }
    fetchWeather()
  }, [])

  function toggleChecklist(id: string) {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    )
  }

  const checkedCount = checklist.filter((c) => c.checked).length
  const totalItems = checklist.length
  const progressPct = (checkedCount / totalItems) * 100

  const risk = riskLevelConfig[windData?.riskLevel || 'low'] || riskLevelConfig.low
  const beaufort = windData ? getBeaufortScale(windData.speed) : { scale: 0, name: '-' }

  // Generate summary message
  const summaryMessage = windData?.isSafeForInstallation
    ? 'Vremenske razmere so ugodne za montažo'
    : 'Vremenske razmere niso ugodne za montažo'

  function handleShareReport() {
    if (!windData) return
    const now = new Date()
    const dateTime = now.toLocaleString('sl-SI', {
      dateStyle: 'full',
      timeStyle: 'short',
    })
    const verdict = windData.isSafeForInstallation ? 'VARNOSTNA DELA DOVOLJENA' : 'NEVARNOST ZA MONTAŽO'
    const report = [
      `═══ VARNOSTNO POROČILO ═══`,
      `Datum/čas: ${dateTime}`,
      ``,
      `Vremenski podatki:`,
      `  Hitrost vetra: ${windData.speed.toFixed(1)} m/s (pih: ${windData.gust.toFixed(1)} m/s)`,
      `  Smer vetra: ${windData.direction}° (${windData.directionLabel})`,
      `  Temperatura: ${windData.temperature}°C`,
      `  Vlažnost: ${windData.humidity}%`,
      `  Pritisk: ${windData.pressure} hPa`,
      ``,
      `Beaufortova lestvica: ${beaufort.scale} — ${beaufort.name}`,
      ``,
      `Seznam preverjanj: ${checkedCount}/${totalItems} zaključenih`,
      ``,
      `VARNOSTNA OCENA: ${verdict}`,
      `  Maks. višina ograje: ${windData.maxRailingHeight}mm`,
      ``,
      `─ Roksal Field Manager`,
    ].join('\n')

    navigator.clipboard.writeText(report).then(() => {
      toast.success('Varnostno poročilo kopirano!')
    }).catch(() => {
      toast.error('Napaka pri kopiranju poročila')
    })
  }

  return (
    <div className="space-y-4 px-4 pb-4 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-roksal-navy">Varnost</h2>
          <p className="text-sm text-muted-foreground">
            Vremenski podatki, seznam preverjanj in načini
          </p>
        </div>
        <Button
          size="sm"
          className="h-9 px-3 bg-roksal-navy hover:bg-roksal-navy/90 text-white gap-1.5 transition-transform duration-200 active:scale-95"
          onClick={handleShareReport}
          disabled={!windData}
        >
          <FileText className="h-3.5 w-3.5" />
          Poročilo
        </Button>
      </div>

      {/* "Danes je varen dan" Summary Banner */}
      {loading ? (
        <Skeleton className="h-16 w-full" />
      ) : windData && (
        <div
          className={`flex items-center gap-3 rounded-xl p-4 transition-all ${
            windData.isSafeForInstallation
              ? 'bg-roksal-green/10 border border-roksal-green/20'
              : 'bg-roksal-red/10 border border-roksal-red/20'
          }`}
        >
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
            windData.isSafeForInstallation ? 'bg-roksal-green/20' : 'bg-roksal-red/20'
          }`}>
            {windData.isSafeForInstallation ? (
              <CloudSun className="h-6 w-6 text-roksal-green" />
            ) : (
              <Zap className="h-6 w-6 text-roksal-red" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold ${
              windData.isSafeForInstallation ? 'text-roksal-green' : 'text-roksal-red'
            }`}>
              Danes je {windData.isSafeForInstallation ? 'varen' : 'nevaren'} dan
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {summaryMessage}
            </p>
          </div>
          <Badge className={`text-[10px] shrink-0 ${risk.bg} ${risk.color}`}>
            {risk.label}
          </Badge>
        </div>
      )}

      {/* Wind Status Card */}
      <Card
        className={`overflow-hidden border-l-4 card-hover transition-all duration-200 animate-fade-in-up ${
          windData?.isSafeForInstallation
            ? 'border-l-roksal-green'
            : 'border-l-roksal-red'
        }`}
        style={{ animationDelay: '60ms' }}
      >
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
              <Wind className="h-4 w-4" />
              Veter — Kranj
            </CardTitle>
            <Badge className={`${risk.bg} ${risk.color} text-[10px]`}>
              {risk.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : windData ? (
            <div className="space-y-3">
              {/* Main wind display with compass */}
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-roksal-surface shadow-inner">
                    <span className="text-2xl font-bold text-roksal-navy">
                      {windData.speed.toFixed(1)}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">m/s</p>
                </div>
                {/* Wind Compass */}
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
                  <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
                    {/* Compass circle */}
                    <circle cx="50" cy="50" r="44" fill="none" stroke="#e2e8f0" strokeWidth="1.5" />
                    {/* Cardinal directions */}
                    <text x="50" y="14" textAnchor="middle" className="fill-roksal-navy" fontSize="9" fontWeight="bold">N</text>
                    <text x="50" y="96" textAnchor="middle" className="fill-muted-foreground" fontSize="8">S</text>
                    <text x="8" y="54" textAnchor="middle" className="fill-muted-foreground" fontSize="8">Z</text>
                    <text x="92" y="54" textAnchor="middle" className="fill-muted-foreground" fontSize="8">E</text>
                    {/* Tick marks */}
                    <line x1="50" y1="18" x2="50" y2="22" stroke="#cbd5e1" strokeWidth="1" />
                    <line x1="50" y1="78" x2="50" y2="82" stroke="#cbd5e1" strokeWidth="1" />
                    <line x1="18" y1="50" x2="22" y2="50" stroke="#cbd5e1" strokeWidth="1" />
                    <line x1="78" y1="50" x2="82" y2="50" stroke="#cbd5e1" strokeWidth="1" />
                  </svg>
                  {/* Wind arrow - rotates based on direction */}
                  <div
                    className="relative z-10"
                    style={{ transform: `rotate(${windData.direction}deg)` }}
                  >
                    <svg viewBox="0 0 40 40" className="h-10 w-10">
                      {/* Arrow pointing up (North = 0°), rotates with wind direction */}
                      <polygon points="20,6 26,22 20,18 14,22" fill="#f59e0b" opacity="0.9" />
                      <polygon points="20,18 14,22 20,34 26,22" fill="#1d2b3e" opacity="0.6" />
                    </svg>
                  </div>
                  {/* Center dot */}
                  <div className="absolute z-20 h-2 w-2 rounded-full bg-roksal-amber" />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <Gauge className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Pih: <span className="font-medium text-roksal-navy">{windData.gust.toFixed(1)} m/s</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Compass className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {windData.directionLabel} <span className="font-medium text-roksal-navy">{windData.direction}°</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Beaufort Scale Indicator */}
              <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-roksal-navy/10">
                  <Wind className="h-5 w-5 text-roksal-navy" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-roksal-navy">
                      Beaufort {beaufort.scale}
                    </span>
                    <span className="text-xs text-muted-foreground">/ 12</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {beaufort.name}
                  </p>
                </div>
                {/* Beaufort mini scale */}
                <div className="flex gap-px">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
                    <div
                      key={i}
                      className={`h-4 w-1 rounded-sm ${
                        i <= beaufort.scale
                          ? beaufort.scale >= 8
                            ? 'bg-roksal-red'
                            : beaufort.scale >= 6
                            ? 'bg-roksal-amber'
                            : 'bg-roksal-green'
                          : 'bg-border/50'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Weather details */}
              <div className="grid grid-cols-3 gap-2">
                <div className="flex items-center gap-2 rounded-lg bg-secondary/50 p-2">
                  <Thermometer className="h-4 w-4 text-roksal-amber" />
                  <div>
                    <p className="text-xs font-medium text-roksal-navy">{windData.temperature}°C</p>
                    <p className="text-[10px] text-muted-foreground">Temperatura</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-secondary/50 p-2">
                  <CloudRain className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-xs font-medium text-roksal-navy">{windData.humidity}%</p>
                    <p className="text-[10px] text-muted-foreground">Vlažnost</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-secondary/50 p-2">
                  <Gauge className="h-4 w-4 text-purple-500" />
                  <div>
                    <p className="text-xs font-medium text-roksal-navy">{windData.pressure} hPa</p>
                    <p className="text-[10px] text-muted-foreground">Pritisnik</p>
                  </div>
                </div>
              </div>

              {/* Humidity Visual Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <CloudRain className="h-3 w-3" />
                    Vlažnost zraka
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-medium ${
                      windData.humidity < 60 ? 'text-roksal-green' : windData.humidity <= 80 ? 'text-roksal-amber' : 'text-roksal-red'
                    }`}>
                      {getHumidityLabel(windData.humidity)}
                    </span>
                  </div>
                </div>
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary/50">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${getHumidityColor(windData.humidity)}`}
                    style={{ width: `${windData.humidity}%` }}
                  />
                  {/* Threshold markers */}
                  <div className="absolute top-0 bottom-0 w-px bg-amber-400/50" style={{ left: '60%' }} />
                  <div className="absolute top-0 bottom-0 w-px bg-red-400/50" style={{ left: '80%' }} />
                </div>
                <div className="flex items-center justify-between text-[9px] text-muted-foreground/60">
                  <span>0%</span>
                  <span>60%</span>
                  <span>80%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Safety verdict */}
              <div
                className={`flex items-center gap-2.5 rounded-lg p-2.5 ${
                  windData.isSafeForInstallation
                    ? 'bg-roksal-green/10'
                    : 'bg-roksal-red/10'
                }`}
              >
                {windData.isSafeForInstallation ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-roksal-green" />
                ) : (
                  <AlertTriangle className="h-5 w-5 shrink-0 text-roksal-red" />
                )}
                <div>
                  <p
                    className={`text-sm font-medium ${
                      windData.isSafeForInstallation
                        ? 'text-roksal-green'
                        : 'text-roksal-red'
                    }`}
                  >
                    {windData.isSafeForInstallation
                      ? 'VARNOSTNA DELA DOVOLJENA'
                      : 'NEVARNOST ZA MONTAŽO'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {windData.isSafeForInstallation
                      ? `Maks. višina ograje: ${windData.maxRailingHeight}mm`
                      : `Maks. višina ograje: ${windData.maxRailingHeight}mm — Počakajte na boljše razmere.`}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Temperature Indicator */}
      {windData && (
        <Card className="card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
              <Thermometer className="h-4 w-4" />
              Temperaturni indikator
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center gap-4">
              {/* Visual Thermometer */}
              <div className="flex flex-col items-center">
                <div className="relative flex h-36 w-8 items-end overflow-hidden rounded-full border-2 border-border bg-secondary/30">
                  {/* Thermometer fill */}
                  <div
                    className="absolute bottom-0 w-full rounded-b-full transition-all duration-500"
                    style={{
                      height: `${Math.min(100, Math.max(5, ((windData.temperature + 10) / 50) * 100))}%`,
                      background: windData.temperature < 5
                        ? '#3b82f6'
                        : windData.temperature < 15
                        ? '#f59e0b'
                        : windData.temperature < 35
                        ? '#10b981'
                        : '#ef4444',
                    }}
                  />
                  {/* Scale marks */}
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="absolute right-0 z-10 h-px w-2 bg-border/50"
                      style={{ bottom: `${25 * i + 5}%` }}
                    />
                  ))}
                  {/* Bulb at bottom */}
                  <div className={`absolute -bottom-1 left-1/2 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-border ${
                    windData.temperature < 5
                      ? 'bg-blue-500'
                      : windData.temperature < 15
                      ? 'bg-amber-500'
                      : windData.temperature < 35
                      ? 'bg-emerald-500'
                      : 'bg-red-500'
                  }`} />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">-10°…40°</p>
              </div>

              {/* Temperature Info */}
              <div className="flex-1 space-y-2">
                <div className="text-center sm:text-left">
                  <span className="text-3xl font-bold text-roksal-navy">{windData.temperature}</span>
                  <span className="text-lg text-muted-foreground">°C</span>
                </div>
                <div
                  className={`flex items-center gap-2 rounded-lg p-2.5 ${
                    windData.temperature >= 5 && windData.temperature <= 35
                      ? 'bg-roksal-green/10'
                      : 'bg-roksal-red/10'
                  }`}
                >
                  {windData.temperature >= 5 && windData.temperature <= 35 ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-roksal-green" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-roksal-red" />
                  )}
                  <div>
                    <p
                      className={`text-xs font-medium ${
                        windData.temperature >= 5 && windData.temperature <= 35
                          ? 'text-roksal-green'
                          : 'text-roksal-red'
                      }`}
                    >
                      {windData.temperature >= 5 && windData.temperature <= 35
                        ? 'VARNO za montažo'
                        : windData.temperature < 5
                        ? 'PREHLAJENO — tveganje za material'
                        : 'PREVROČE — tveganje za delavce'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Priporočena temperatura: 5°C–35°C
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="rounded-md bg-blue-50 px-2 py-1.5 text-center dark:bg-blue-950/30">
                    <span className="text-blue-600 dark:text-blue-400">{'<'}5°C</span>
                    <p className="text-muted-foreground">Nevarno</p>
                  </div>
                  <div className="rounded-md bg-green-50 px-2 py-1.5 text-center dark:bg-green-950/30">
                    <span className="text-green-600 dark:text-green-400">5–35°C</span>
                    <p className="text-muted-foreground">Varno</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ghost Mode Toggle */}
      <Card className="card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '180ms' }}>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            {ghostMode ? (
              <Eye className="h-5 w-5 text-roksal-navy" />
            ) : (
              <EyeOff className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="text-sm font-medium text-roksal-navy">
                Ghost Mode
              </p>
              <p className="text-[11px] text-muted-foreground">
                Varnostno stanje brez beleženja
              </p>
            </div>
          </div>
          <Switch
            checked={ghostMode}
            onCheckedChange={setGhostMode}
          />
        </CardContent>
      </Card>

      {/* Safety Checklist */}
      <Card className="animate-fade-in-up" style={{ animationDelay: '240ms' }}>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
              <Shield className="h-4 w-4" />
              Seznam preverjanj
            </CardTitle>
            <Badge
              className={`text-[10px] ${
                progressPct === 100
                  ? 'bg-roksal-green/15 text-roksal-green'
                  : 'bg-secondary text-muted-foreground'
              }`}
            >
              {checkedCount}/{totalItems}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {/* Progress Bar */}
          <div className="mb-4 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Dokončanost</span>
              <span className="font-medium text-roksal-navy">
                {Math.round(progressPct)}%
              </span>
            </div>
            <Progress
              value={progressPct}
              className={`h-2 ${
                progressPct === 100
                  ? '[&>div]:bg-roksal-green'
                  : '[&>div]:bg-roksal-amber'
              }`}
            />
          </div>

          {/* Checklist Items */}
          <div className="space-y-1">
            {checklist.map((item) => (
              <label
                key={item.id}
                htmlFor={item.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-secondary/50"
              >
                <Checkbox
                  id={item.id}
                  checked={item.checked}
                  onCheckedChange={() => toggleChecklist(item.id)}
                  className={`${
                    item.checked
                      ? 'border-roksal-green bg-roksal-green text-white'
                      : ''
                  }`}
                />
                <span
                  className={`text-sm transition-all ${
                    item.checked
                      ? 'text-muted-foreground line-through'
                      : 'text-roksal-navy'
                  }`}
                >
                  {item.label}
                </span>
              </label>
            ))}
          </div>

          {/* Completion message */}
          {progressPct === 100 && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-roksal-green/10 p-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-roksal-green" />
              <p className="text-sm font-medium text-roksal-green">
                Vsa varnostna preverjanja so končana!
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const demoWindData: WindData = {
  speed: 7.2,
  gust: 11.8,
  direction: 225,
  directionLabel: 'SW',
  temperature: 18,
  humidity: 65,
  pressure: 1015,
  description: 'Deloma oblačno',
  isSafeForInstallation: true,
  riskLevel: 'medium',
  maxRailingHeight: 1000,
  calculations: {
    windPressure: 32.4,
    windForce: 77.8,
    railingArea: 2,
  },
}
