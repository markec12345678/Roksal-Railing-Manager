'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calculator, AlertTriangle, CheckCircle2, Info, Thermometer, Wind, Anchor, Package, Save, Trash2, Clock, RotateCcw, Ruler, Scissors, ArrowLeft, ArrowDownToLine, Euro } from 'lucide-react'

type CalcMode = 'railing' | 'anchoring' | 'wind'
type ProfileType = 'classic' | 'z-line' | 'vertical'
type AnchorType = 'hilti-hit' | 'fischer-fis' | 'generic'
type TerrainCategory = 'I' | 'II' | 'III' | 'IV'
type RailingType = 'solid' | 'slatted' | 'z-line'

interface CalcResult {
  slatCount: number
  actualGapMm: number
  totalSlatsLengthMm: number
  totalGapsLengthMm: number
  isCompliant: boolean
  warnings: string[]
}

interface AnchoringResult {
  resinVolumeMl: number
  totalResinMl: number
  curingTimeMin: number
  cartridgesNeeded: number
  warnings: string[]
}

interface WindResult {
  windPressureKpa: number
  totalForceKn: number
  forcePerMeterNm: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  recommendations: string[]
}

const modeTabs: { id: CalcMode; label: string; icon: React.ElementType }[] = [
  { id: 'railing', label: 'Razmiki letev', icon: Calculator },
  { id: 'anchoring', label: 'Kemično sidranje', icon: Anchor },
  { id: 'wind', label: 'Vetrna obremenitev', icon: Wind },
]

const anchorTypeLabels: Record<AnchorType, string> = {
  'hilti-hit': 'Hilti HIT-RE 500',
  'fischer-fis': 'Fischer FIS V',
  'generic': 'Splošno',
}

const terrainLabels: Record<TerrainCategory, string> = {
  I: 'I — Odprto morje',
  II: 'II — Ravninsko',
  III: 'III — Primestno',
  IV: 'IV — Urbano',
}

const railingTypeLabels: Record<RailingType, string> = {
  solid: 'Polna ograja',
  slatted: 'Lamelna ograja',
  'z-line': 'Z-line profil',
}

const riskColors: Record<string, string> = {
  LOW: 'bg-roksal-green/15 text-roksal-green border-roksal-green/30',
  MEDIUM: 'bg-roksal-amber/15 text-roksal-navy border-roksal-amber/30',
  HIGH: 'bg-roksal-red/15 text-roksal-red border-roksal-red/30',
  CRITICAL: 'bg-roksal-red/25 text-roksal-red border-roksal-red/50',
}

const riskLabels: Record<string, string> = {
  LOW: 'Nizko tveganje',
  MEDIUM: 'Srednje tveganje',
  HIGH: 'Visoko tveganje',
  CRITICAL: 'KRITIČNO',
}

interface SavedCalculation {
  id: string
  date: string
  mode: CalcMode
  modeLabel: string
  keyResult: string
  inputs: Record<string, string>
}

import type { CalculatorImportData } from '@/app/page'

interface CalculatorTabProps {
  importedFromMeasurement?: CalculatorImportData | null
  onClearImport?: () => void
  onBackToMeasurements?: () => void
}

export function CalculatorTab({ importedFromMeasurement, onClearImport, onBackToMeasurements }: CalculatorTabProps) {
  const [mode, setMode] = useState<CalcMode>('railing')

  // Railing state
  const [profileType, setProfileType] = useState<ProfileType>('classic')
  const [totalLength, setTotalLength] = useState('3.0')
  const [slatWidth, setSlatWidth] = useState('80')
  const [maxGap, setMaxGap] = useState('100')
  const [postCount, setPostCount] = useState('')
  const [railingResult, setRailingResult] = useState<CalcResult | null>(null)

  // Anchoring state
  const [holeCount, setHoleCount] = useState('8')
  const [holeDepthMm, setHoleDepthMm] = useState('120')
  const [holeDiameterMm, setHoleDiameterMm] = useState('14')
  const [temperature, setTemperature] = useState('20')
  const [anchorType, setAnchorType] = useState<AnchorType>('hilti-hit')
  const [anchoringResult, setAnchoringResult] = useState<AnchoringResult | null>(null)

  // Wind state
  const [heightAboveGround, setHeightAboveGround] = useState('10')
  const [terrainCategory, setTerrainCategory] = useState<TerrainCategory>('II')
  const [windSpeedMs, setWindSpeedMs] = useState('25')
  const [railingAreaM2, setRailingAreaM2] = useState('6')
  const [railingType, setRailingType] = useState<RailingType>('slatted')
  const [windResult, setWindResult] = useState<WindResult | null>(null)

  // Compute imported length for display
  const importedLength = useMemo(() => {
    if (!importedFromMeasurement) return null
    return (importedFromMeasurement.dolzinaMm / 1000).toFixed(1)
  }, [importedFromMeasurement])

  // Effective total length uses import when available, otherwise manual input
  const effectiveTotalLength = importedLength ?? totalLength

  // Clear import when user manually changes totalLength
  useEffect(() => {
    if (importedLength && totalLength) {
      if (totalLength !== importedLength) {
        onClearImport?.()
      }
    }
  }, [totalLength, importedLength, onClearImport])

  // Saved calculations
  const [savedCalculations, setSavedCalculations] = useState<SavedCalculation[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('roksal-saved-calculations')
        if (stored) return JSON.parse(stored)
      } catch {
        // ignore
      }
    }
    return []
  })

  const profileLabels: Record<ProfileType, string> = {
    classic: 'Classic',
    'z-line': 'Z-line',
    vertical: 'Vertical',
  }

  function handleCalculate() {
    if (mode === 'railing') {
      calculateRailingClientSide()
    } else if (mode === 'anchoring') {
      calculateAnchoringClientSide()
    } else if (mode === 'wind') {
      calculateWindClientSide()
    }
  }

  function calculateRailingClientSide() {
    const L = parseFloat(effectiveTotalLength) * 1000
    const W = parseFloat(slatWidth)
    const G = parseFloat(maxGap)
    const n = Math.ceil((L - G) / (G + W))
    const actualGap = (L - n * W) / (n + 1)
    const warnings: string[] = []

    if (actualGap > 100) {
      warnings.push('RAZMIK PRESEGA 100mm — Prepovedano za stanovanjske objekte!')
    }
    if (profileType === 'z-line') {
      warnings.push('Z-line profil: Prekrivanje zagotavlja 100% vizualno zasebnost.')
    }
    if (actualGap < 10) {
      warnings.push('Razmik zelo majhen (<10mm). Preverite dilatacijo WPC materiala.')
    }

    setRailingResult({
      slatCount: n,
      actualGapMm: Math.round(actualGap * 10) / 10,
      totalSlatsLengthMm: n * W,
      totalGapsLengthMm: Math.round((n + 1) * actualGap),
      isCompliant: actualGap <= 100,
      warnings,
    })
  }

  function calculateAnchoringClientSide() {
    const hc = parseInt(holeCount)
    const depth = parseFloat(holeDepthMm)
    const dia = parseFloat(holeDiameterMm)
    const temp = parseFloat(temperature)
    const warnings: string[] = []

    const radiusMm = dia / 2
    const holeVolumeMm3 = Math.PI * Math.pow(radiusMm, 2) * depth
    const holeVolumeMl = holeVolumeMm3 / 1000
    const resinPerHole = holeVolumeMl * 1.2
    const totalResin = resinPerHole * hc

    let curingTimeMin: number
    if (temp >= 20) {
      curingTimeMin = 30
    } else if (temp >= 10) {
      curingTimeMin = 60
      warnings.push('Temperatura < 20°C: Podaljšan čas strjevanja. Počakajte vsaj 1 uro.')
    } else if (temp >= 5) {
      curingTimeMin = 120
      warnings.push('Temperatura < 10°C: Zelo podaljšan čas strjevanja (2 uri). Uporabite zimsko formulo smole.')
    } else {
      curingTimeMin = 0
      warnings.push('Temperatura < 5°C: Kemično sidranje NI priporočljivo!')
    }

    const cartridgeSize = anchorType === 'hilti-hit' ? 330 : 300
    const cartridgesNeeded = Math.ceil(totalResin / cartridgeSize)

    if (depth < 70) {
      warnings.push('Globina vrtanja < 70mm. Priporočena minimalna globina za M12 sidro je 70mm.')
    }

    setAnchoringResult({
      resinVolumeMl: Math.round(resinPerHole * 10) / 10,
      totalResinMl: Math.round(totalResin * 10) / 10,
      curingTimeMin,
      cartridgesNeeded,
      warnings,
    })
  }

  function calculateWindClientSide() {
    const h = parseFloat(heightAboveGround)
    const terrainFactors: Record<string, number> = { I: 1.0, II: 0.91, III: 0.82, IV: 0.73 }
    const kTerrain = terrainFactors[terrainCategory] || 0.91
    const heightFactor = Math.pow(h / 10, 0.2)
    const aeroFactors: Record<string, number> = { solid: 1.3, slatted: 0.8, 'z-line': 0.6 }
    const cAero = aeroFactors[railingType] || 0.8

    const ws = parseFloat(windSpeedMs)
    const area = parseFloat(railingAreaM2)
    const recommendations: string[] = []

    const basePressure = 0.5 * 1.25 * Math.pow(ws, 2)
    const designPressure = basePressure * kTerrain * heightFactor * cAero
    const totalForce = designPressure * area
    const railingLength = Math.sqrt(area)
    const forcePerMeter = totalForce / railingLength

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    if (designPressure < 0.5) {
      riskLevel = 'LOW'
    } else if (designPressure < 1.0) {
      riskLevel = 'MEDIUM'
      recommendations.push('Preverite pritrdilne elemente. Uporabite A4 Inox vijake.')
    } else if (designPressure < 1.5) {
      riskLevel = 'HIGH'
      recommendations.push('Visoka vetrna obremenitev! Uporabite kemično sidranje in dodatne stebre.')
      recommendations.push('Priporočljivo: Z-line profil za zmanjšanje veternega upora.')
    } else {
      riskLevel = 'CRITICAL'
      recommendations.push('KRITIČNA vetrna obremenitev! Potrebna statična analiza.')
      recommendations.push('Obvezno: Kemično sidranje vseh stebrov, zmanjšan razmik med stebri.')
    }

    if (railingType === 'solid' && h > 20) {
      recommendations.push('Polna ograja nad 20m: Tveganje harmoničnih vibracij. Vgradite dušilna tesnila.')
    }

    setWindResult({
      windPressureKpa: Math.round(designPressure * 100) / 100,
      totalForceKn: Math.round(totalForce * 100) / 100,
      forcePerMeterNm: Math.round(forcePerMeter * 10) / 10,
      riskLevel,
      recommendations,
    })
  }

  // Auto-calculate on input change
  useEffect(() => {
    if (mode === 'railing') {
      calculateRailingClientSide()
    } else if (mode === 'anchoring') {
      calculateAnchoringClientSide()
    } else if (mode === 'wind') {
      calculateWindClientSide()
    }
  }, [mode, profileType, effectiveTotalLength, slatWidth, maxGap, postCount, holeCount, holeDepthMm, holeDiameterMm, temperature, anchorType, heightAboveGround, terrainCategory, windSpeedMs, railingAreaM2, railingType])

  // Generate cut list positions
  function getCutList(): { num: number; type: 'razmik' | 'letva'; startPosMm: number; widthMm: number }[] {
    if (!railingResult) return []
    const L = parseFloat(effectiveTotalLength) * 1000
    const W = parseFloat(slatWidth)
    const gap = railingResult.actualGapMm
    const positions: { num: number; type: 'razmik' | 'letva'; startPosMm: number; widthMm: number }[] = []
    let pos = gap // first gap
    for (let i = 0; i < railingResult.slatCount; i++) {
      positions.push({ num: i + 1, type: 'letva', startPosMm: Math.round(pos), widthMm: W })
      pos += W + gap
    }
    return positions
  }

  function getPostPositions(): number[] {
    if (!railingResult || !postCount) return []
    const L = parseFloat(effectiveTotalLength) * 1000
    const n = parseInt(postCount)
    if (n < 2) return [0]
    const spacing = L / (n - 1)
    return Array.from({ length: n }, (_, i) => Math.round(i * spacing))
  }

  function renderRailingVisual() {
    if (!railingResult) return null
    const L = parseFloat(effectiveTotalLength) * 1000
    const W = parseFloat(slatWidth)
    const gap = railingResult.actualGapMm
    const totalSlatWidth = railingResult.totalSlatsLengthMm
    const totalGapWidth = railingResult.totalGapsLengthMm
    const total = totalSlatWidth + totalGapWidth
    const slatPct = (totalSlatWidth / total) * 100
    const gapPct = (totalGapWidth / total) * 100
    const postPositions = getPostPositions()
    const displayCount = Math.min(railingResult.slatCount, 20)

    return (
      <div className="space-y-3">
        {/* Main visual with dimension arrows */}
        <div className="relative">
          {/* Top dimension line with total length */}
          <div className="flex items-center justify-between mb-1 px-0.5">
            <span className="text-[9px] font-mono text-roksal-navy font-semibold">0mm</span>
            <div className="flex-1 mx-1">
              <div className="border-t border-dashed border-roksal-navy/40 relative">
                <span className="absolute left-1/2 -top-2.5 -translate-x-1/2 text-[9px] font-mono font-bold text-roksal-navy bg-background px-1">
                  {L}mm = {(L / 1000).toFixed(2)}m
                </span>
              </div>
            </div>
            <span className="text-[9px] font-mono text-roksal-navy font-semibold">{L}mm</span>
          </div>

          {/* Railing cross-section */}
          <div className="relative flex items-end overflow-hidden rounded-lg border border-roksal-navy/20 bg-gradient-to-b from-roksal-navy/3 to-roksal-navy/8 p-3 pt-4 pb-2" style={{ minHeight: '52px' }}>
            {/* Posts (background layer) */}
            {postPositions.length > 0 && (
              <div className="absolute inset-0 flex items-end pointer-events-none">
                {postPositions.map((pos, i) => {
                  const pct = (pos / L) * 100
                  return (
                    <div
                      key={i}
                      className="absolute bottom-0 w-[6px] rounded-full bg-roksal-amber/60"
                      style={{ left: `${pct}%`, height: '90%' }}
                    />
                  )
                })}
              </div>
            )}
            {/* Slats and gaps */}
            <div className="flex-1 flex h-10 items-center w-full relative z-10">
              <div className="h-full bg-roksal-amber/15 border border-dashed border-roksal-amber/30 rounded" style={{ width: `${(gap / L) * 100}%`, minWidth: gap > 0 ? '2px' : '0' }} />
              {Array.from({ length: displayCount }).map((_, i) => (
                <div key={i} className="flex h-full">
                  <div
                    className={`h-[85%] rounded-[2px] ${profileType === 'z-line' ? 'bg-roksal-navy/80 border-r border-roksal-navy/20' : 'bg-roksal-navy'}`}
                    style={{ width: `${(W / L) * 100}%`, minWidth: '2px' }}
                  />
                  {i < displayCount - 1 && (
                    <div
                      className="h-full bg-roksal-amber/15 border border-dashed border-roksal-amber/30 rounded"
                      style={{ width: `${(gap / L) * 100}%`, minWidth: '1px' }}
                    />
                  )}
                </div>
              ))}
              {railingResult.slatCount > 20 && (
                <div className="flex items-center justify-center bg-gradient-to-l from-white/80 to-transparent px-2 h-full">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    +{railingResult.slatCount - 20} letvev
                  </span>
                </div>
              )}
              <div className="h-full bg-roksal-amber/15 border border-dashed border-roksal-amber/30 rounded" style={{ width: `${(gap / L) * 100}%`, minWidth: gap > 0 ? '2px' : '0' }} />
            </div>
          </div>

          {/* Bottom dimension: individual gap annotation */}
          <div className="flex items-center justify-center mt-1.5">
            <div className="flex items-center gap-0.5">
              <Ruler className="h-3 w-3 text-roksal-amber" />
              <span className="text-[9px] font-mono font-medium text-roksal-amber">
                Razmik: {gap.toFixed(1)}mm med letvami
              </span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-[2px] bg-roksal-navy" />
            Letva ({W}mm)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-[2px] bg-roksal-amber/15 border border-dashed border-roksal-amber/30" />
            Razmik ({gap.toFixed(1)}mm)
          </span>
          {postPositions.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-[6px] rounded-full bg-roksal-amber/60" />
              Steber
            </span>
          )}
        </div>
      </div>
    )
  }

  function renderCutList() {
    if (!railingResult) return null
    const cutList = getCutList()
    const W = parseFloat(slatWidth)
    const gap = railingResult.actualGapMm
    const L = parseFloat(effectiveTotalLength) * 1000

    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
            <Scissors className="h-4 w-4" />
            Seznam rezov — pozicije letvev
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="overflow-x-auto scrollbar-thin">
            {/* Header */}
            <div className="grid grid-cols-12 gap-0 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider pb-1.5 border-b border-border/50 mb-1">
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-2 text-center">Tip</div>
              <div className="col-span-3 text-center">Začetek</div>
              <div className="col-span-3 text-center">Širina</div>
              <div className="col-span-3 text-center">Konec</div>
            </div>
            {/* First gap row */}
            <div className="grid grid-cols-12 gap-0 text-[10px] font-mono py-1 border-b border-border/20 bg-roksal-amber/5">
              <div className="col-span-1 text-center text-muted-foreground">—</div>
              <div className="col-span-2 text-center"><Badge variant="outline" className="text-[8px] h-4 px-1 bg-roksal-amber/10 border-roksal-amber/30 text-roksal-amber">razmik</Badge></div>
              <div className="col-span-3 text-center">0</div>
              <div className="col-span-3 text-center font-medium">{gap.toFixed(1)}</div>
              <div className="col-span-3 text-center">{gap.toFixed(1)}</div>
            </div>
            {/* Slat + gap rows */}
            {cutList.map((item, i) => {
              const endPos = item.startPosMm + item.widthMm
              return (
                <div key={i}>
                  {/* Slat row */}
                  <div className="grid grid-cols-12 gap-0 text-[10px] font-mono py-1 border-b border-border/20">
                    <div className="col-span-1 text-center font-semibold text-roksal-navy">{item.num}</div>
                    <div className="col-span-2 text-center"><Badge variant="outline" className="text-[8px] h-4 px-1 bg-roksal-navy/10 border-roksal-navy/30 text-roksal-navy">letva</Badge></div>
                    <div className="col-span-3 text-center text-roksal-navy font-medium">{item.startPosMm}</div>
                    <div className="col-span-3 text-center font-medium">{item.widthMm}</div>
                    <div className="col-span-3 text-center text-roksal-navy font-medium">{endPos}</div>
                  </div>
                  {/* Gap row after slat (not after last) */}
                  {i < cutList.length - 1 && (
                    <div className="grid grid-cols-12 gap-0 text-[10px] font-mono py-1 border-b border-border/20 bg-roksal-amber/5">
                      <div className="col-span-1 text-center text-muted-foreground">—</div>
                      <div className="col-span-2 text-center"><Badge variant="outline" className="text-[8px] h-4 px-1 bg-roksal-amber/10 border-roksal-amber/30 text-roksal-amber">razmik</Badge></div>
                      <div className="col-span-3 text-center">{endPos}</div>
                      <div className="col-span-3 text-center font-medium">{gap.toFixed(1)}</div>
                      <div className="col-span-3 text-center">{(endPos + gap).toFixed(1)}</div>
                    </div>
                  )}
                </div>
              )
            })}
            {/* Last gap row */}
            <div className="grid grid-cols-12 gap-0 text-[10px] font-mono py-1 bg-roksal-amber/5 rounded-b-lg">
              <div className="col-span-1 text-center text-muted-foreground">—</div>
              <div className="col-span-2 text-center"><Badge variant="outline" className="text-[8px] h-4 px-1 bg-roksal-amber/10 border-roksal-amber/30 text-roksal-amber">razmik</Badge></div>
              <div className="col-span-3 text-center">{cutList.length > 0 ? cutList[cutList.length - 1].startPosMm + W : gap.toFixed(1)}</div>
              <div className="col-span-3 text-center font-medium">{gap.toFixed(1)}</div>
              <div className="col-span-3 text-center font-semibold">{L}</div>
            </div>
          </div>
          {/* Summary */}
          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/30 pt-2">
            <span>Skupaj {railingResult.slatCount} letvev × {W}mm</span>
            <span className="font-mono font-medium">Skupna dolžina: {(railingResult.totalSlatsLengthMm / 1000).toFixed(2)}m</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4 px-4 pb-4 pt-2">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-roksal-navy">Kalkulator ograj</h2>
          <p className="text-sm text-muted-foreground">
            Izračuni za ograje, sidranje in vetrno obremenitev
          </p>
        </div>
        {importedFromMeasurement && (
          <button
            type="button"
            onClick={onBackToMeasurements}
            className="flex items-center gap-1.5 rounded-lg border border-roksal-amber/30 bg-roksal-amber/10 px-2.5 py-1.5 text-[11px] font-medium text-roksal-navy hover:bg-roksal-amber/20 active:scale-[0.96] transition-all duration-150 press-scale shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Nazaj na meritve</span>
          </button>
        )}
      </div>

      {/* Import from measurement indicator */}
      {importedFromMeasurement && (
        <div className="flex items-center gap-2.5 rounded-xl border border-roksal-amber/30 bg-roksal-amber/5 px-3.5 py-2.5 animate-fade-in-up">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-roksal-amber/15">
            <ArrowDownToLine className="h-4 w-4 text-roksal-amber" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-roksal-navy">Uvoženo iz meritev</span>
              <span className="rounded-full bg-roksal-amber/20 px-1.5 py-0.5 text-[9px] font-bold text-roksal-amber">MERITEV</span>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {importedFromMeasurement.locationName} — {importedFromMeasurement.dolzinaMm}mm × {importedFromMeasurement.visinaMm}mm
            </p>
          </div>
          <button
            type="button"
            onClick={onClearImport}
            className="p-1 rounded-md hover:bg-secondary/60 transition-colors shrink-0"
            title="Počisti uvoz"
          >
            <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Calculator Mode Selector */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {modeTabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setMode(tab.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === tab.id
                  ? 'bg-roksal-navy text-white'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* RAILING CALCULATOR */}
      {mode === 'railing' && (
        <>
          {/* Profile Type Selector */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-roksal-navy">
                Tip profila
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Select
                value={profileType}
                onValueChange={(v) => setProfileType(v as ProfileType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic">Classic — Navaden profil</SelectItem>
                  <SelectItem value="z-line">Z-line — Prekrivni profil</SelectItem>
                  <SelectItem value="vertical">Vertical — Vertikalne letve</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Input Fields */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-roksal-navy">
                Meritve
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <div className="space-y-1.5">
                <Label htmlFor="totalLength" className="text-xs">
                  Skupna dolžina (m)
                </Label>
                <Input
                  id="totalLength"
                  type="number"
                  value={effectiveTotalLength}
                  onChange={(e) => setTotalLength(e.target.value)}
                  placeholder="3.0"
                  step="0.1"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slatWidth" className="text-xs">
                  Širina letve (mm)
                </Label>
                <Input
                  id="slatWidth"
                  type="number"
                  value={slatWidth}
                  onChange={(e) => setSlatWidth(e.target.value)}
                  placeholder="80"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxGap" className="text-xs">
                  Maksimalni razmik (mm)
                </Label>
                <Input
                  id="maxGap"
                  type="number"
                  value={maxGap}
                  onChange={(e) => setMaxGap(e.target.value)}
                  placeholder="100"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="postCount" className="text-xs">
                  Število stebrov (izbirno)
                </Label>
                <Input
                  id="postCount"
                  type="number"
                  value={postCount}
                  onChange={(e) => setPostCount(e.target.value)}
                  placeholder="3"
                />
              </div>
            </CardContent>
          </Card>

          {/* Calculate Button */}
          <Button
            onClick={handleCalculate}
            className="w-full bg-roksal-navy hover:bg-roksal-navy/90 text-white h-11"
          >
            <Calculator className="mr-2 h-4 w-4" />
            Izračunaj razmike
          </Button>

          {/* Results */}
          {railingResult && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Visual Representation */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold text-roksal-navy">
                    Vizualizacija — {profileLabels[profileType]}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {renderRailingVisual()}
                </CardContent>
              </Card>

              {/* Compliance Status */}
              <Card
                className={`overflow-hidden border-l-4 ${
                  railingResult.isCompliant
                    ? 'border-l-roksal-green bg-roksal-green/5'
                    : 'border-l-roksal-red bg-roksal-red/5'
                }`}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  {railingResult.isCompliant ? (
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-roksal-green" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 shrink-0 text-roksal-red" />
                  )}
                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        railingResult.isCompliant ? 'text-roksal-green' : 'text-roksal-red'
                      }`}
                    >
                      {railingResult.isCompliant
                        ? 'SKLADNO s standardom'
                        : 'NESKLADNO — Presežen razmik!'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Razmik {railingResult.actualGapMm.toFixed(1)}mm{' '}
                      {railingResult.isCompliant ? '≤' : '>'} 100mm
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Results Grid */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Število letvev
                  </p>
                  <p className="text-2xl font-bold text-roksal-navy">
                    {railingResult.slatCount}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    kos × {parseFloat(slatWidth)}mm
                  </p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Dejanski razmik
                  </p>
                  <p className="text-2xl font-bold text-roksal-navy">
                    {railingResult.actualGapMm.toFixed(1)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">mm</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Skupna širina letvev
                  </p>
                  <p className="text-lg font-bold text-roksal-navy">
                    {(railingResult.totalSlatsLengthMm / 1000).toFixed(2)}m
                  </p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Skupna širina razmikov
                  </p>
                  <p className="text-lg font-bold text-roksal-navy">
                    {(railingResult.totalGapsLengthMm / 1000).toFixed(2)}m
                  </p>
                </Card>
              </div>

              {/* Warnings */}
              {railingResult.warnings.length > 0 && (
                <Card className="border-roksal-amber/30">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-amber">
                      <Info className="h-4 w-4" />
                      Opozorila
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <ul className="space-y-1.5">
                      {railingResult.warnings.map((w, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-xs text-muted-foreground"
                        >
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-roksal-amber" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Cut List */}
              {renderCutList()}

              {/* Skupaj material summary */}
              <Card className="overflow-hidden border-l-4 border-l-roksal-navy">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                    <Package className="h-4 w-4" />
                    Skupaj material
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-roksal-navy/5 p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        Skupaj tekoče metre letvev
                      </p>
                      <p className="text-2xl font-bold text-roksal-navy">
                        {(railingResult.totalSlatsLengthMm / 1000).toFixed(2)}<span className="text-sm font-normal ml-0.5">m</span>
                      </p>
                    </div>
                    <div className="rounded-lg bg-roksal-amber/10 p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        Število letvev
                      </p>
                      <p className="text-2xl font-bold text-roksal-amber">
                        {railingResult.slatCount}<span className="text-sm font-normal ml-0.5">kos</span>
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Za dolžino {parseFloat(effectiveTotalLength)}m s širino letve {parseFloat(slatWidth)}mm je potrebnih{' '}
                    <span className="font-semibold text-roksal-navy">{railingResult.totalSlatsLengthMm / 1000} tekočih metrov</span> materiala.
                  </p>
                </CardContent>
              </Card>

              {/* Ocena stroškov */}
              <Card className="overflow-hidden border-l-4 border-l-roksal-amber">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                    <Euro className="h-4 w-4" />
                    Ocena stroškov
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {(() => {
                    const slatPricePerM = profileType === 'z-line' ? 8.5 : 6.2
                    const slatTotalM = railingResult.totalSlatsLengthMm / 1000
                    const slatCost = slatTotalM * slatPricePerM
                    const postsCount = postCount ? parseInt(postCount) : 0
                    const postsCost = postsCount > 0 ? postsCount * 25 : 0
                    const anchoringCost = anchoringResult ? anchoringResult.cartridgesNeeded * 12 : 0
                    const totalCost = slatCost + postsCost + anchoringCost
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/30">
                          <div className="flex items-center gap-2">
                            <Euro className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Letve ({slatTotalM.toFixed(2)}m × {slatPricePerM.toFixed(1)} €/m)</span>
                          </div>
                          <span className="font-medium text-roksal-navy">{slatCost.toFixed(2)} €</span>
                        </div>
                        {postsCount > 0 && (
                          <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/30">
                            <div className="flex items-center gap-2">
                              <Euro className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">Stebri ({postsCount} × 25 €)</span>
                            </div>
                            <span className="font-medium text-roksal-navy">{postsCost.toFixed(2)} €</span>
                          </div>
                        )}
                        {anchoringCost > 0 && (
                          <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/30">
                            <div className="flex items-center gap-2">
                              <Euro className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">Smola/čepi ({anchoringResult!.cartridgesNeeded} × 12 €)</span>
                            </div>
                            <span className="font-medium text-roksal-navy">{anchoringCost.toFixed(2)} €</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-sm pt-1.5">
                          <span className="font-bold text-roksal-navy">Skupaj</span>
                          <span className="font-bold text-roksal-navy text-base">{totalCost.toFixed(2)} €</span>
                        </div>
                      </div>
                    )
                  })()}
                </CardContent>
              </Card>

              {/* Safety Info Box */}
              <Card className="bg-roksal-navy/5">
                <CardContent className="flex gap-3 p-4">
                  <Info className="h-5 w-5 shrink-0 text-roksal-navy" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-roksal-navy">
                      Pravilnik o varstvu otrok (SIST EN 13485)
                    </p>
                    <p className="mt-1">
                      Maksimalni razmik med letvami za ograje na stopniščih in balkonih
                      je <span className="font-bold text-roksal-navy">100mm</span>. Večji
                      razmiki predstavljajo nevarnost zapletanja (lestveni učinek).
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* ANCHORING CALCULATOR */}
      {mode === 'anchoring' && (
        <>
          {/* Anchor Type */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                <Anchor className="h-4 w-4" />
                Tip sidra
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Select
                value={anchorType}
                onValueChange={(v) => setAnchorType(v as AnchorType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(anchorTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Input Fields */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-roksal-navy">
                Parametri sidranja
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="holeCount" className="text-xs">
                    Število lukenj
                  </Label>
                  <Input
                    id="holeCount"
                    type="number"
                    value={holeCount}
                    onChange={(e) => setHoleCount(e.target.value)}
                    placeholder="8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="holeDepth" className="text-xs">
                    Globina luknje (mm)
                  </Label>
                  <Input
                    id="holeDepth"
                    type="number"
                    value={holeDepthMm}
                    onChange={(e) => setHoleDepthMm(e.target.value)}
                    placeholder="120"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="holeDiameter" className="text-xs">
                    Premer luknje (mm)
                  </Label>
                  <Input
                    id="holeDiameter"
                    type="number"
                    value={holeDiameterMm}
                    onChange={(e) => setHoleDiameterMm(e.target.value)}
                    placeholder="14"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="temperature" className="text-xs">
                    Temperatura (°C)
                  </Label>
                  <Input
                    id="temperature"
                    type="number"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    placeholder="20"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Temperature Warning */}
          {parseFloat(temperature) < 10 && (
            <div className="flex items-center gap-3 rounded-xl border border-roksal-amber/30 bg-roksal-amber/5 p-3">
              <Thermometer className="h-5 w-5 shrink-0 text-roksal-amber" />
              <p className="text-xs text-muted-foreground">
                {parseFloat(temperature) < 5
                  ? 'POZOR: Temperatura < 5°C. Kemično sidranje ni priporočljivo!'
                  : 'Opozorilo: Nizka temperatura — podaljšan čas strjevanja smole.'}
              </p>
            </div>
          )}

          {/* Calculate Button */}
          <Button
            onClick={handleCalculate}
            className="w-full bg-roksal-navy hover:bg-roksal-navy/90 text-white h-11"
          >
            <Anchor className="mr-2 h-4 w-4" />
            Izračunaj sidranje
          </Button>

          {/* Results */}
          {anchoringResult && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Main Results */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Smola na luknjo
                  </p>
                  <p className="text-2xl font-bold text-roksal-navy">
                    {anchoringResult.resinVolumeMl}
                  </p>
                  <p className="text-[10px] text-muted-foreground">ml</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Skupaj smola
                  </p>
                  <p className="text-2xl font-bold text-roksal-navy">
                    {anchoringResult.totalResinMl}
                  </p>
                  <p className="text-[10px] text-muted-foreground">ml</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Čas strjevanja
                  </p>
                  <p className="text-2xl font-bold text-roksal-navy">
                    {anchoringResult.curingTimeMin}
                  </p>
                  <p className="text-[10px] text-muted-foreground">min</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Patronov
                  </p>
                  <p className="text-2xl font-bold text-roksal-amber">
                    {anchoringResult.cartridgesNeeded}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    × {anchorType === 'hilti-hit' ? '330' : '300'}ml
                  </p>
                </Card>
              </div>

              {/* Warnings */}
              {anchoringResult.warnings.length > 0 && (
                <Card className="border-roksal-amber/30">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-amber">
                      <AlertTriangle className="h-4 w-4" />
                      Opozorila
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <ul className="space-y-1.5">
                      {anchoringResult.warnings.map((w, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-xs text-muted-foreground"
                        >
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-roksal-amber" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Info */}
              <Card className="bg-roksal-navy/5">
                <CardContent className="flex gap-3 p-4">
                  <Info className="h-5 w-5 shrink-0 text-roksal-navy" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-roksal-navy">
                      Navodila za sidranje
                    </p>
                    <p className="mt-1">
                      Pri uporabi kemičnega sidranja je obvezno predhodno vrtanje in
                      čiščenje lukenj. Uporabite samo originalne smole proizvajalca.
                      Čas strjevanja je odvisen od temperature okolja.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* WIND LOAD CALCULATOR */}
      {mode === 'wind' && (
        <>
          {/* Railing Type */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                <Wind className="h-4 w-4" />
                Tip ograje
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Select
                value={railingType}
                onValueChange={(v) => setRailingType(v as RailingType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(railingTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Input Fields */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-roksal-navy">
                Parametri vetra
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="windHeight" className="text-xs">
                    Višina nad tlemi (m)
                  </Label>
                  <Input
                    id="windHeight"
                    type="number"
                    value={heightAboveGround}
                    onChange={(e) => setHeightAboveGround(e.target.value)}
                    placeholder="10"
                    step="0.5"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Kategorija terena</Label>
                  <Select
                    value={terrainCategory}
                    onValueChange={(v) => setTerrainCategory(v as TerrainCategory)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(terrainLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="windSpeed" className="text-xs">
                    Hitrost vetra (m/s)
                  </Label>
                  <Input
                    id="windSpeed"
                    type="number"
                    value={windSpeedMs}
                    onChange={(e) => setWindSpeedMs(e.target.value)}
                    placeholder="25"
                    step="0.5"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="railingArea" className="text-xs">
                    Površina ograje (m²)
                  </Label>
                  <Input
                    id="railingArea"
                    type="number"
                    value={railingAreaM2}
                    onChange={(e) => setRailingAreaM2(e.target.value)}
                    placeholder="6"
                    step="0.5"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Calculate Button */}
          <Button
            onClick={handleCalculate}
            className="w-full bg-roksal-navy hover:bg-roksal-navy/90 text-white h-11"
          >
            <Wind className="mr-2 h-4 w-4" />
            Izračunaj vetrno obremenitev
          </Button>

          {/* Results */}
          {windResult && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Risk Level */}
              <Card className={`overflow-hidden border ${riskColors[windResult.riskLevel]}`}>
                <CardContent className="flex items-center gap-3 p-4">
                  {windResult.riskLevel === 'LOW' || windResult.riskLevel === 'MEDIUM' ? (
                    <CheckCircle2 className="h-6 w-6 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-semibold">
                      {riskLabels[windResult.riskLevel]}
                    </p>
                    <p className="text-xs opacity-75">
                      {windResult.windPressureKpa.toFixed(2)} kPa vetrni tlak
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Main Results */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Tlak
                  </p>
                  <p className="text-xl font-bold text-roksal-navy">
                    {windResult.windPressureKpa.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">kPa</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Skupna sila
                  </p>
                  <p className="text-xl font-bold text-roksal-navy">
                    {windResult.totalForceKn.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">kN</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Sila/m
                  </p>
                  <p className="text-xl font-bold text-roksal-navy">
                    {windResult.forcePerMeterNm.toFixed(1)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">N/m</p>
                </Card>
              </div>

              {/* Recommendations */}
              {windResult.recommendations.length > 0 && (
                <Card className="border-roksal-amber/30">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-amber">
                      <Info className="h-4 w-4" />
                      Priporočila
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <ul className="space-y-1.5">
                      {windResult.recommendations.map((r, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-xs text-muted-foreground"
                        >
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-roksal-amber" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Info */}
              <Card className="bg-roksal-navy/5">
                <CardContent className="flex gap-3 p-4">
                  <Info className="h-5 w-5 shrink-0 text-roksal-navy" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-roksal-navy">
                      Vetrna obremenitev (EVS EN 1991-1-4)
                    </p>
                    <p className="mt-1">
                      Izračun vključuje osnovni vetrni tlak, terenski faktor, višinski faktor
                      in aerodinamični koeficient. Za kritične primere je potrebna statična analiza.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Save Calculation Button */}
      {(railingResult || anchoringResult || windResult) && (
        <Button
          onClick={() => {
            const modeLabelMap: Record<CalcMode, string> = {
              railing: 'Razmiki letev',
              anchoring: 'Kemično sidranje',
              wind: 'Vetrna obremenitev',
            }
            let keyResult = ''
            let inputs: Record<string, string> = {}
            if (mode === 'railing' && railingResult) {
              keyResult = `${railingResult.slatCount} letvev, razmik ${railingResult.actualGapMm.toFixed(1)}mm`
              inputs = { profileType, totalLength: effectiveTotalLength, slatWidth, maxGap, postCount }
            } else if (mode === 'anchoring' && anchoringResult) {
              keyResult = `${anchoringResult.totalResinMl}ml smola, ${anchoringResult.cartridgesNeeded} patronov`
              inputs = { holeCount, holeDepthMm, holeDiameterMm, temperature, anchorType }
            } else if (mode === 'wind' && windResult) {
              keyResult = `${windResult.windPressureKpa.toFixed(2)} kPa, ${riskLabels[windResult.riskLevel]}`
              inputs = { heightAboveGround, terrainCategory, windSpeedMs, railingAreaM2, railingType }
            }
            const newCalc: SavedCalculation = {
              id: `calc_${Date.now()}`,
              date: new Date().toISOString(),
              mode,
              modeLabel: modeLabelMap[mode],
              keyResult,
              inputs,
            }
            const updated = [newCalc, ...savedCalculations]
            setSavedCalculations(updated)
            try {
              localStorage.setItem('roksal-saved-calculations', JSON.stringify(updated))
            } catch {
              // ignore
            }
            toast.success('Izračun shranjen')
          }}
          className="w-full bg-roksal-navy hover:bg-roksal-navy/90 text-white h-11 transition-all duration-200"
        >
          <Save className="mr-2 h-4 w-4" />
          Shrani izračun
        </Button>
      )}

      {/* Saved Calculations Section */}
      {savedCalculations.length > 0 && (
        <Card className="card-hover transition-all duration-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                <Clock className="h-4 w-4" />
                Shrjeni izračuni
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[10px] text-roksal-red hover:text-roksal-red hover:bg-roksal-red/10"
                onClick={() => {
                  setSavedCalculations([])
                  try { localStorage.removeItem('roksal-saved-calculations') } catch { /* ignore */ }
                  toast.success('Vsi izračuni počiščeni')
                }}
              >
                <Trash2 className="mr-1 h-3 w-3" />
                Počisti vse
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
              {savedCalculations.map((calc) => (
                <button
                  key={calc.id}
                  onClick={() => {
                    // Load saved inputs back
                    if (calc.mode === 'railing') {
                      if (calc.inputs.profileType) setProfileType(calc.inputs.profileType as ProfileType)
                      if (calc.inputs.totalLength) setTotalLength(calc.inputs.totalLength)
                      if (calc.inputs.slatWidth) setSlatWidth(calc.inputs.slatWidth)
                      if (calc.inputs.maxGap) setMaxGap(calc.inputs.maxGap)
                      if (calc.inputs.postCount) setPostCount(calc.inputs.postCount)
                      setMode('railing')
                    } else if (calc.mode === 'anchoring') {
                      if (calc.inputs.holeCount) setHoleCount(calc.inputs.holeCount)
                      if (calc.inputs.holeDepthMm) setHoleDepthMm(calc.inputs.holeDepthMm)
                      if (calc.inputs.holeDiameterMm) setHoleDiameterMm(calc.inputs.holeDiameterMm)
                      if (calc.inputs.temperature) setTemperature(calc.inputs.temperature)
                      if (calc.inputs.anchorType) setAnchorType(calc.inputs.anchorType as AnchorType)
                      setMode('anchoring')
                    } else if (calc.mode === 'wind') {
                      if (calc.inputs.heightAboveGround) setHeightAboveGround(calc.inputs.heightAboveGround)
                      if (calc.inputs.terrainCategory) setTerrainCategory(calc.inputs.terrainCategory as TerrainCategory)
                      if (calc.inputs.windSpeedMs) setWindSpeedMs(calc.inputs.windSpeedMs)
                      if (calc.inputs.railingAreaM2) setRailingAreaM2(calc.inputs.railingAreaM2)
                      if (calc.inputs.railingType) setRailingType(calc.inputs.railingType as RailingType)
                      setMode('wind')
                    }
                    toast.info(`Izračun "${calc.modeLabel}" naložen`)
                  }}
                  className="flex w-full items-center justify-between rounded-lg border border-border/50 p-3 transition-colors hover:bg-secondary/30 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">
                        {calc.modeLabel}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(calc.date).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs font-medium text-roksal-navy">
                      {calc.keyResult}
                    </p>
                  </div>
                  <RotateCcw className="h-3.5 w-3.5 shrink-0 text-muted-foreground ml-2" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
