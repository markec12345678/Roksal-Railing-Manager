'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { buildNagibiCsv, nagibiCsvFilename } from '@/lib/nagibi-csv'
import { Compass, Download, RefreshCw, Save, TriangleAlert, CheckCircle2, Loader2 } from 'lucide-react'

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
  // R154 — iskrena zgodovina: BREZ_PROJEKTA / NALAGANJE / OK / NAPAKA.
  // Prej: tihi catch /* ignore */ in neuspeh res.ok brez poročanja — napaka
  // strežnika je bila za uporabnika NEVIDNA (prazen seznam = utvara
  // "ni nagibov"). Brez izmišljenih podatkov: napaka je vidna, prazno je res
  // prazno, brez projekta je izrecno rečeno.
  const [historyState, setHistoryState] = useState<'BREZ_PROJEKTA' | 'NALAGANJE' | 'OK' | 'NAPAKA'>('BREZ_PROJEKTA')
  const [historyError, setHistoryError] = useState<string | null>(null)
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

  // Naloži zgodovino nagibov za projekt (R154: brez tihega poglate —
  // napaka je VIDLJIVA; prej je bil catch /* ignore */ fail-open kršitev)
  const loadSaved = useCallback(async () => {
    if (!projectId) {
      setSaved([])
      setHistoryError(null)
      setHistoryState('BREZ_PROJEKTA')
      return
    }
    setHistoryState('NALAGANJE')
    try {
      const res = await fetch(`/api/slopes?projectId=${projectId}`)
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null
        setSaved([])
        setHistoryError(json?.error ?? `Napaka ${res.status}`)
        setHistoryState('NAPAKA')
        return
      }
      const rows = (await res.json()) as SavedSlope[]
      setSaved(Array.isArray(rows) ? rows : [])
      setHistoryError(null)
      setHistoryState('OK')
    } catch {
      setSaved([])
      setHistoryError('Napaka pri povezavi s strežnikom')
      setHistoryState('NAPAKA')
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
        // R154 — fail-verbose: pokaži razlog iz odgovora (npr. 403 dostop do
        // tujega projekta), ne generične utvare "ni uspelo"
        const json = (await res.json().catch(() => null)) as { error?: string } | null
        toast({ title: 'Napaka', description: json?.error ?? 'Shranjevanje ni uspelo.', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Napaka', description: 'Omrežna napaka.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // R157 — izvoz zgodovine nagibov v CSV (dopolnitev odloženega iz R156 (c);
  // logika v src/lib/nagibi-csv.ts — deterministično, testirljivo, iskreno).
  function handleExportCSV() {
    if (saved.length === 0) return
    try {
      const { csv, vrstic } = buildNagibiCsv(saved)
      const filename = nagibiCsvFilename(projectId ?? 'brez-projekta', new Date().toISOString().slice(0, 10))
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast({ title: 'CSV izvožen', description: `${vrstic} nagibov izvoženih v datoteko ${filename}.` })
    } catch {
      // Fail-verbose: izvoz ne sme tiho spodleteti (npr. pokvarjen datum v bazi).
      toast({ title: 'Izvoz ni uspel', description: 'Podatki o nagibih vsebujejo neveljavno vrednost — osvežite zgodovino in poskusite znova.', variant: 'destructive' })
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
              <Badge
                variant={isLevel ? 'default' : 'secondary'}
                className={isLevel ? 'bg-green-600 text-white' : ''}
                aria-label={isLevel ? 'Libela je v vodoravni' : `Odstopanje od vodoravne: ${(angleX + angleY).toFixed(1)} stopinj`}
              >
                {isLevel ? <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" /> : <TriangleAlert className="mr-1 h-3 w-3" aria-hidden="true" />}
                {isLevel ? 'V vodoravni' : `${(angleX + angleY).toFixed(1)}°`}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {/* Libela — krožna (R150 vzorec: grafika z vlogo img + opisnim
              aria-labelom, ki ga bralniki lahko preberejo) */}
          <div
            className="relative h-56 w-56 rounded-full border-4 border-roksal-navy/20 dark:border-roksal-ink/20 bg-gradient-to-br from-roksal-navy/5 to-roksal-amber/5"
            role="img"
            aria-label={reading
              ? `Libela — odstopanje ${angleX.toFixed(1)} stopinj levo-desno, ${angleY.toFixed(1)} stopinj naprej-nazaj${isLevel ? ' — v vodoravni' : ''}`
              : 'Libela — ni aktivnega branja'}
          >
            {/* križ */}
            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-roksal-navy/15" />
            <div className="absolute top-1/2 left-0 w-full h-px -translate-y-1/2 bg-roksal-navy/15" />
            <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-roksal-navy/30 dark:border-roksal-ink/30" />
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

          {/* Prikaz kotov — tabular-nums, da se številke ne "skakljejo" */}
          <div className="grid w-full grid-cols-2 gap-3">
            <div className="rounded-lg border border-roksal-navy/10 bg-card dark:border-roksal-ink/15 p-3 text-center transition-[border-color,box-shadow] duration-150 hover:border-roksal-navy/25 dark:hover:border-roksal-ink/25 hover:shadow-sm">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Levo ↔ Desno</div>
              <div className="text-2xl font-bold tabular-nums text-roksal-ink">{reading ? angleX.toFixed(1) : '–'}°</div>
              <div className="text-[10px] text-muted-foreground">
                {reading ? (Math.abs(reading.gamma) < 1.5 ? '↓ ravno' : reading.gamma > 0 ? '→ desno' : '← levo') : ''}
              </div>
            </div>
            <div className="rounded-lg border border-roksal-navy/10 bg-card dark:border-roksal-ink/15 p-3 text-center transition-[border-color,box-shadow] duration-150 hover:border-roksal-navy/25 dark:hover:border-roksal-ink/25 hover:shadow-sm">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Naprej ↔ Nazaj</div>
              <div className="text-2xl font-bold tabular-nums text-roksal-ink">{reading ? angleY.toFixed(1) : '–'}°</div>
              <div className="text-[10px] text-muted-foreground">
                {reading ? (angleY < 1.5 ? '↓ ravno' : reading.beta > 90 ? '↓ naprej' : '↑ nazaj') : ''}
              </div>
            </div>
          </div>

          {/* Kontrola senzorja */}
          {permission === 'idle' && (
            <Button type="button" onClick={enableSensor} className="w-full bg-roksal-amber text-white hover:bg-roksal-amber/90 focus-visible:ring-2 focus-visible:ring-roksal-amber/50">
              <Compass className="mr-2 h-4 w-4" />
              Vklopi libelo
            </Button>
          )}
          {permission === 'granted' && (
            <Button
              type="button"
              variant={monitoring ? 'outline' : 'default'}
              onClick={monitoring ? stopSensor : enableSensor}
              aria-pressed={monitoring}
              className="w-full focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
            >
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
            <p className="text-center text-sm text-red-600 dark:text-red-400">Dostop do senzorjev je zavrnjen. Omogočite ga v nastavitvah brskalnika.</p>
          )}
          {permission === 'unsupported' && (
            <p className="text-center text-sm text-amber-600 dark:text-amber-400">Ta naprava/brskalnik ne podpira senzorjev orientacije.</p>
          )}

          {/* Shranjevanje */}
          {reading && monitoring && (
            <div className="w-full space-y-3 rounded-lg border border-roksal-navy/10 bg-card dark:border-roksal-ink/15 p-3">
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
                <Input
                  value={customLokacija}
                  onChange={(e) => setCustomLokacija(e.target.value)}
                  placeholder="Opis lokacije"
                  aria-label="Opis lokacije po meri"
                  maxLength={120}
                  className="h-9 tabular-nums"
                />
              )}
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving || !projectId}
                className="w-full bg-roksal-navy text-white hover:bg-roksal-navy/90 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 disabled:cursor-not-allowed disabled:opacity-50 aria-busy:cursor-wait"
                aria-busy={saving}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {saving ? 'Shranjujem …' : 'Shrani nagib'}
              </Button>
              {!projectId && <p className="text-center text-[10px] text-amber-600 dark:text-amber-400">Izberite projekt v zavihku Domov.</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Zgodovina nagibov (R154 — iskrena stanja: brez projekta / napaka /
          nalaganje / resnično prazno / podatki) */}
      {historyState === 'BREZ_PROJEKTA' ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Compass className="h-10 w-10 mx-auto mb-2 opacity-30" aria-hidden="true" />
            <p className="text-sm">Izberite projekt v zavihku Domov — zgodovina nagibov se naloži za izbrani projekt.</p>
          </CardContent>
        </Card>
      ) : historyState === 'NAPAKA' ? (
        <Card>
          <CardContent className="p-3">
            <div
              role="alert"
              className="flex flex-col gap-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <div>
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-200">Zgodovine nagibov ni mogoče prikazati</p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">{historyError}</p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void loadSaved()}
                className="shrink-0 focus-visible:ring-2 focus-visible:ring-roksal-amber/50"
                aria-label="Poskusi znova naložiti zgodovino nagibov"
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Poskusi znova
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : historyState === 'NALAGANJE' ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <RefreshCw className="h-6 w-6 mx-auto mb-2 animate-spin opacity-40" aria-hidden="true" />
            <p className="text-sm">Nalagam zgodovino nagibov …</p>
          </CardContent>
        </Card>
      ) : saved.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Compass className="h-10 w-10 mx-auto mb-2 opacity-30" aria-hidden="true" />
            <p className="text-sm">Ni še zabeleženih nagibov. Vklopite libelo in shranite prvo meritev.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm">Zabeleženi nagibi ({saved.length})</CardTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleExportCSV}
                className="shrink-0 h-8 px-2.5 text-xs focus-visible:ring-2 focus-visible:ring-roksal-amber/50"
                aria-label={`Izvozi ${saved.length} nagibov kot CSV datoteko`}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Izvozi CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent role="list" className="space-y-2">
            {saved.map((s) => (
              <div
                key={s.id}
                role="listitem"
                aria-label={`Nagib ${s.kotStopinje.toFixed(1)} stopinj, ${s.smer === 'Y' ? 'levo-desno' : 'naprej-nazaj'}, ${s.lokacija ?? 'brez lokacije'}`}
                className="flex items-center justify-between rounded-lg border border-roksal-navy/10 bg-card dark:border-roksal-ink/15 p-2.5 text-xs transition-[border-color,box-shadow] duration-150 hover:border-roksal-navy/25 dark:hover:border-roksal-ink/25 hover:shadow-sm"
              >
                <div>
                  <div className="font-medium tabular-nums text-roksal-ink">{s.kotStopinje.toFixed(1)}° ({s.smer === 'Y' ? 'L↔D' : 'N↔Z'})</div>
                  <div className="text-muted-foreground">{s.lokacija ?? 'Brez lokacije'}</div>
                </div>
                <div className="tabular-nums text-muted-foreground">{new Date(s.createdAt).toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
