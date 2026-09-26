'use client'

// Roksal — vremenska kartica "Pogoji za montažo"
// ---------------------------------------------------------------------------
// Monter se odloča, ali gre danes na streho/balkon. OpenWeather + ocena
// tveganja pride iz obstoječega /api/weather (brez OPENWEATHER_API_KEY služi
// demo podatki, zato kartica vedno nekaj pokaže). Kartica je namenoma
// samozadostna: če API pade, se ne vleče za sabo — pokazе se prijazno
// opozorilo in dashboard ostane uporaben.

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CloudSun,
  Droplets,
  Gauge,
  Navigation,
  Wind,
} from 'lucide-react'

interface WeatherResponse {
  speed: number // m/s
  gust: number // m/s
  direction: number // stopinje
  directionLabel: string // N, NE, …
  temperature: number // °C
  humidity: number // %
  pressure: number // hPa
  description: string
  location: string
  isSafeForInstallation: boolean
  riskLevel: 'low' | 'medium' | 'high' | 'dangerous'
  maxRailingHeight: number // mm
  source?: 'openweather' | 'demo'
}

const RISK_STYLES: Record<
  WeatherResponse['riskLevel'],
  { label: string; badge: string; hint: string; accent: string }
> = {
  low: {
    label: 'Varno za montažo',
    badge: 'bg-roksal-green/15 text-roksal-green hover:bg-roksal-green/20',
    hint: 'Vetrični pogoji ustrezajo vsem sistemom ograj.',
    accent: 'border-l-roksal-green/70',
  },
  medium: {
    label: 'Previdno',
    badge: 'bg-roksal-amber/15 text-roksal-navy hover:bg-roksal-amber/20',
    hint: 'Montaža možna, višje panele postavljajte v dvojici.',
    accent: 'border-l-roksal-amber/70',
  },
  high: {
    label: 'Nevarno',
    badge: 'bg-roksal-red/15 text-roksal-red hover:bg-roksal-red/20',
    hint: 'Priporočamo samo notranja dela ali kratke sekante do 0,6 m.',
    accent: 'border-l-roksal-red/70',
  },
  dangerous: {
    label: 'NE montaža',
    badge: 'bg-roksal-red/20 text-roksal-red hover:bg-roksal-red/25',
    hint: 'Vetrni suniki presegajo varno mejo — odpokliči ekipo z višin.',
    accent: 'border-l-roksal-red/80',
  },
}

function mpsToKmh(ms: number): number {
  return Math.round(ms * 3.6)
}

export function WeatherCard({
  lat,
  lon,
  locationLabel,
}: {
  lat?: number | null
  lon?: number | null
  locationLabel?: string
}) {
  const [weather, setWeather] = useState<WeatherResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const params = new URLSearchParams()
        if (typeof lat === 'number' && typeof lon === 'number') {
          params.set('lat', String(lat))
          params.set('lon', String(lon))
        }
        const res = await fetch(`/api/weather?${params.toString()}`)
        if (!res.ok) throw new Error(`API ${res.status}`)
        const data = (await res.json()) as WeatherResponse
        if (!cancelled) {
          setWeather(data)
          setError(null)
        }
      } catch {
        if (!cancelled) setError('Vetrni podatki trenutno niso na voljo.')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [lat, lon])

  return (
    <Card
      className={`overflow-hidden border-l-4 transition-all duration-200 card-hover ${
        weather ? RISK_STYLES[weather.riskLevel].accent : 'border-l-sky-500/70'
      }`}
    >
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-1.5 text-sm font-semibold text-roksal-navy">
            <CloudSun className="h-4 w-4 text-sky-500" aria-hidden="true" />
            Pogoji za montažo
          </CardTitle>
          {locationLabel && (
            <span className="max-w-40 truncate text-[11px] text-muted-foreground">
              {locationLabel}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {error && (
          <div role="status" className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            <Wind className="h-3.5 w-3.5" aria-hidden="true" />
            {error}
          </div>
        )}

        {!error && !weather && (
          <div className="space-y-2">
            <div className="flex gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1.5 pt-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
            <Skeleton className="h-8 w-full" />
          </div>
        )}

        {weather && (
          <div className="space-y-3">
            {/* Glavna vrstica: temperatura + opis + kompasa smeri */}
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-500/10">
                <span className="text-lg font-bold text-roksal-navy tabular-nums">
                  {Math.round(weather.temperature)}°
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium capitalize text-roksal-navy">
                  {weather.description || 'Vreme na lokaciji montaže'}
                </p>
                <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-0.5">
                    <Droplets className="h-3 w-3" aria-hidden="true" /> {weather.humidity}%
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <Gauge className="h-3 w-3" aria-hidden="true" /> {weather.pressure} hPa
                  </span>
                </p>
              </div>
              {/* Veterni kompas */}
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-background">
                <Navigation
                  className="h-5 w-5 text-sky-500 transition-transform duration-500"
                  style={{ transform: `rotate(${weather.direction}deg)` }}
                  aria-label={`Smer vetra ${weather.directionLabel}`}
                />
                <span className="absolute -bottom-1 rounded bg-roksal-navy px-1 text-[9px] font-semibold text-white">
                  {weather.directionLabel}
                </span>
              </div>
            </div>

            {/* Veter: trenutni + suniki */}
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-muted/60 px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Veter</p>
                <p className="text-sm font-bold text-roksal-navy tabular-nums">
                  {mpsToKmh(weather.speed)} km/h
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                    ({weather.speed.toFixed(1)} m/s)
                  </span>
                </p>
              </div>
              <div className="rounded-lg bg-muted/60 px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Suniki</p>
                <p className="text-sm font-bold text-roksal-navy tabular-nums">
                  {mpsToKmh(weather.gust)} km/h
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                    ({weather.gust.toFixed(1)} m/s)
                  </span>
                </p>
              </div>
            </div>

            {/* Ocena tveganja — varnostno sporočilo; high/dangerous se
                zaslonu bralnika oznani (role=alert, vstavi se dinamično). */}
            <div
              role={weather.riskLevel === 'high' || weather.riskLevel === 'dangerous' ? 'alert' : undefined}
              className="flex items-start gap-2 rounded-lg bg-muted/40 p-2.5"
            >
              <Badge className={`shrink-0 text-[10px] px-2 py-0.5 ${RISK_STYLES[weather.riskLevel].badge}`}>
                {RISK_STYLES[weather.riskLevel].label}
              </Badge>
              <p className="text-[11px] leading-snug text-muted-foreground">
                {RISK_STYLES[weather.riskLevel].hint}
                {weather.maxRailingHeight > 0 && (
                  <> Največja varna višina ograje: <strong className="tabular-nums">{(weather.maxRailingHeight / 1000).toFixed(1)} m</strong>.</>
                )}
              </p>
            </div>

            {/* R160 (fail-verbose): demo izvor MORA biti viden — brez API
                ključa ali ob napaki so podatki NAKLJUČNI vzorec, ne meritve.
                Monter ne sme iskrenjsko odločati iz izmišljenih števil. */}
            {weather.source === 'demo' && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-roksal-amber/40 bg-roksal-amber/10 px-2.5 py-2 text-[11px] font-medium text-amber-800"
              >
                <CloudSun className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  Demo podatki — živi vremenski servis trenutno ni dosegljiv.
                  Ocena NE temelji na realnih meritvah; varnostno odločitev preverite
                  z zanesljivim virom.
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
