'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Calculator, AlertTriangle, CheckCircle2, Info, Thermometer, Wind, Anchor, Package, Save, Trash2, Clock, RotateCcw, Ruler, Scissors, ArrowLeft, ArrowDownToLine, Euro, AlignJustify, Triangle, ShieldCheck, Plus, X, FileDown, Hammer, Drill, History, BookmarkPlus, FileSpreadsheet, ChevronDown, ChevronUp, Calendar, Percent, Wallet, Truck, Users, Timer, Layers, MapPin, Square, Navigation, Crosshair, Mountain } from 'lucide-react'
import {
  calculateEqualSpacing,
  calculateAngledSpacing,
  calculateHoleTemplate,
  calculateMaterialTotal,
  checkCompliance,
  calculateLaborCost,
  calculateDDV,
  calculateAkontacija,
  applyReserve,
  calculateCncCutting,
  calculateWindByLocation,
  calculateGlassBalustrade,
  formatEUR,
  formatSI,
  type EqualSpacingResult,
  type AngledSpacingResult,
  type MaterialTotalResult,
  type ComplianceResult,
  type CncCutResult,
  type WindLocationResult,
  type GlassCalcResult,
  type Profil as LibProfil,
  type MaterialSegment,
} from '@/lib/calculator'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

type CalcMode = 'railing' | 'anchoring' | 'wind' | 'baluster' | 'angled' | 'material' | 'compliance' | 'cnc' | 'windLocation' | 'glass'
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
  { id: 'baluster', label: 'Razmak palic', icon: AlignJustify },
  { id: 'angled', label: 'Kotni izračun', icon: Triangle },
  { id: 'material', label: 'Skupni material', icon: Package },
  { id: 'compliance', label: 'Predpisi', icon: ShieldCheck },
  { id: 'cnc', label: 'CNC rez', icon: Scissors },
  { id: 'windLocation', label: 'Veter po lokaciji', icon: MapPin },
  { id: 'glass', label: 'Steklena balustrada', icon: Square },
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

// ===== P2: Predloge & Zgodovina tipi =====
type TemplateMode = 'baluster' | 'angled' | 'material' | 'compliance'

interface CalcTemplate {
  id: string
  naziv: string
  mode: TemplateMode
  inputs: Record<string, string>
  createdAt: string
}

interface HistoryEntry {
  id: string
  timestamp: string
  mode: CalcMode
  modeLabel: string
  keyResult: string
  inputs: Record<string, string>
  projectName?: string
}

const templateModeLabels: Record<TemplateMode, string> = {
  baluster: 'Razmak palic',
  angled: 'Kotni izračun',
  material: 'Skupni material',
  compliance: 'Predpisi',
}

const historyModeIcon: Record<CalcMode, React.ElementType> = {
  railing: Calculator,
  anchoring: Anchor,
  wind: Wind,
  baluster: AlignJustify,
  angled: Triangle,
  material: Package,
  compliance: ShieldCheck,
  cnc: Scissors,
  windLocation: MapPin,
  glass: Square,
}

const reserveOptions = [0, 5, 10, 15, 20]
const ddvOptions = [
  { value: 22, label: '22% (standard)' },
  { value: 9.5, label: '9,5% (gradbene storitve)' },
  { value: 0, label: '0% (izvoz)' },
]
const akontacijaOptions = [0, 30, 50, 70]

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

  // ===== Baluster (Razmak palic) state =====
  const [balTotalLength, setBalTotalLength] = useState('3.0')
  const [balWidth, setBalWidth] = useState('40')
  const [balMaxGap, setBalMaxGap] = useState('110')
  const [balPostSpacing, setBalPostSpacing] = useState('1500')
  const [balusterResult, setBalusterResult] = useState<EqualSpacingResult | null>(null)

  // ===== Angled (Kotni izračun) state =====
  const [angHorizontalLength, setAngHorizontalLength] = useState('2.5')
  const [angRakeAngle, setAngRakeAngle] = useState('35')
  const [angWidth, setAngWidth] = useState('40')
  const [angMaxGap, setAngMaxGap] = useState('110')
  const [angledResult, setAngledResult] = useState<AngledSpacingResult | null>(null)

  // ===== Material (Skupni material) state =====
  const [segments, setSegments] = useState<MaterialSegment[]>([
    { lengthMm: 3000, heightMm: 1100, type: 'level' },
  ])
  const [profili, setProfili] = useState<LibProfil[]>([])
  const [selectedProfileSifra, setSelectedProfileSifra] = useState<string>('')
  const [materialResult, setMaterialResult] = useState<MaterialTotalResult | null>(null)

  // ===== Compliance (Predpisi) state =====
  const [compGap, setCompGap] = useState('90')
  const [compHeight, setCompHeight] = useState('1100')
  const [compPostSpacing, setCompPostSpacing] = useState('1500')
  const [compLoadCategory, setCompLoadCategory] = useState<'A' | 'B' | 'C'>('A')
  const [compDropHeight, setCompDropHeight] = useState('0')
  const [complianceResult, setComplianceResult] = useState<ComplianceResult | null>(null)

  // ===== CNC REZ state =====
  type CncSegment = { lengthMm: string; count: string; label: string }
  const [cncStockLength, setCncStockLength] = useState('6000')
  const [cncStockPreset, setCncStockPreset] = useState('6000')
  const [cncSawBlade, setCncSawBlade] = useState('3')
  const [cncSegments, setCncSegments] = useState<CncSegment[]>([
    { lengthMm: '2500', count: '2', label: 'Zgornja letev' },
    { lengthMm: '800', count: '3', label: 'Stranski' },
  ])
  const [cncResult, setCncResult] = useState<CncCutResult | null>(null)

  // ===== VETER PO LOKACIJI state =====
  const [windLocLat, setWindLocLat] = useState('46.2389') // Kranj
  const [windLocLon, setWindLocLon] = useState('14.3556')
  const [windLocHeight, setWindLocHeight] = useState('10')
  const [windLocTerrain, setWindLocTerrain] = useState<TerrainCategory>('II')
  const [windLocArea, setWindLocArea] = useState('6')
  const [windLocType, setWindLocType] = useState<RailingType>('slatted')
  const [windLocResult, setWindLocResult] = useState<WindLocationResult | null>(null)
  const [windLocLoading, setWindLocLoading] = useState(false)

  // ===== STEKLENA BALUSTRADA state =====
  type GlassType = 'single' | 'laminated' | 'tempered'
  const [glassInput, setGlassInput] = useState<{
    spanMm: number
    heightMm: number
    loadKnPerM: number
    glassType: GlassType
  }>({
    spanMm: 1200,
    heightMm: 1100,
    loadKnPerM: 1.0,
    glassType: 'laminated',
  })
  const [glassResult, setGlassResult] = useState<GlassCalcResult | null>(null)

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

  // ===== P2: Predloge (templates) =====
  const [templates, setTemplates] = useState<CalcTemplate[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('roksal_calc_templates')
        if (stored) return JSON.parse(stored)
      } catch {
        // ignore
      }
    }
    return []
  })
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)

  // ===== P2: Zgodovina izračunov =====
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('roksal_calc_history')
        if (stored) return JSON.parse(stored)
      } catch {
        // ignore
      }
    }
    return []
  })
  const [historyOpen, setHistoryOpen] = useState(false)
  const [projectName, setProjectName] = useState('')

  // ===== P2: Strošek dela (material mode) =====
  const [urnaPostavka, setUrnaPostavka] = useState('35')
  const [stUr, setStUr] = useState('8')
  const [stMonterjev, setStMonterjev] = useState('2')
  const [transport, setTransport] = useState('50')

  // ===== P2: Rezerva materiala (baluster + material) =====
  const [rezervaPctBaluster, setRezervaPctBaluster] = useState(10)
  const [rezervaPctMaterial, setRezervaPctMaterial] = useState(10)

  // ===== P2: DDV =====
  const [ddvPct, setDdvPct] = useState(22)

  // ===== P2: Akontacija (material) =====
  const [akontacijaPct, setAkontacijaPct] = useState(0)

  // ===== P2: calcNonce — vsakič ko uporabnik klikne "Izračunaj" se poveča,
  // effect ga opazuje in zapiše v zgodovino (po tem, ko so se rezultati posodobili). =====
  const [calcNonce, setCalcNonce] = useState(0)
  const skipHistoryRef = useRef(false)

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
    } else if (mode === 'baluster') {
      calculateBalusterClientSide()
    } else if (mode === 'angled') {
      calculateAngledClientSide()
    } else if (mode === 'material') {
      calculateMaterialClientSide()
    } else if (mode === 'compliance') {
      calculateComplianceClientSide()
    } else if (mode === 'cnc') {
      calculateCncClientSide()
    } else if (mode === 'windLocation') {
      calculateWindLocClientSide()
    } else if (mode === 'glass') {
      calculateGlassClientSide()
    }
    // P2: Povečaj nonce — effect ga opazuje in zapiše v zgodovino,
    // ko se bodo rezultati posodobili (re-render).
    setCalcNonce((n) => n + 1)
  }

  // P2: Effect za pisanje v zgodovino je definiran za addToHistory (glej spodaj).

  /** Zbere vhodne podatke trenutnega načina (za predloge in zgodovino). */
  function collectCurrentInputs(): Record<string, string> {
    if (mode === 'railing') {
      return { profileType, totalLength: effectiveTotalLength, slatWidth, maxGap, postCount }
    } else if (mode === 'anchoring') {
      return { holeCount, holeDepthMm, holeDiameterMm, temperature, anchorType }
    } else if (mode === 'wind') {
      return { heightAboveGround, terrainCategory, windSpeedMs, railingAreaM2, railingType }
    } else if (mode === 'baluster') {
      return {
        balTotalLength, balWidth, balMaxGap, balPostSpacing,
        rezervaPctBaluster: String(rezervaPctBaluster),
      }
    } else if (mode === 'angled') {
      return { angHorizontalLength, angRakeAngle, angWidth, angMaxGap }
    } else if (mode === 'material') {
      return {
        profileSifra: selectedProfileSifra,
        segments: JSON.stringify(segments),
        urnaPostavka, stUr, stMonterjev, transport,
        rezervaPctMaterial: String(rezervaPctMaterial),
        ddvPct: String(ddvPct),
        akontacijaPct: String(akontacijaPct),
      }
    } else if (mode === 'compliance') {
      return { compGap, compHeight, compPostSpacing, compLoadCategory, compDropHeight }
    } else if (mode === 'cnc') {
      return {
        cncStockLength, cncSawBlade,
        cncSegments: JSON.stringify(cncSegments),
      }
    } else if (mode === 'windLocation') {
      return {
        windLocLat, windLocLon, windLocHeight,
        windLocTerrain, windLocArea, windLocType,
      }
    } else {
      return {
        glassSpan: String(glassInput.spanMm),
        glassHeight: String(glassInput.heightMm),
        glassLoad: String(glassInput.loadKnPerM),
        glassType: glassInput.glassType,
      }
    }
  }

  /** Ključni rezultat trenutnega načina za prikaz v zgodovini. */
  function getCurrentKeyResult(): string {
    const modeLabelMap: Record<CalcMode, string> = {
      railing: 'Razmiki letev',
      anchoring: 'Kemično sidranje',
      wind: 'Vetrna obremenitev',
      baluster: 'Razmak palic',
      angled: 'Kotni izračun',
      material: 'Skupni material',
      compliance: 'Predpisi',
      cnc: 'CNC rez',
      windLocation: 'Veter po lokaciji',
      glass: 'Steklena balustrada',
    }
    if (mode === 'railing' && railingResult) {
      return `${railingResult.slatCount} letvev, razmik ${railingResult.actualGapMm.toFixed(1)}mm`
    } else if (mode === 'anchoring' && anchoringResult) {
      return `${anchoringResult.totalResinMl}ml smola, ${anchoringResult.cartridgesNeeded} patronov`
    } else if (mode === 'wind' && windResult) {
      return `${windResult.windPressureKpa.toFixed(2)} kPa, ${riskLabels[windResult.riskLevel]}`
    } else if (mode === 'baluster' && balusterResult) {
      const baseCount = balusterResult.balusterCount
      const withReserve = applyReserve(baseCount, rezervaPctBaluster)
      return `${withReserve} palic (rezerva ${rezervaPctBaluster}%), razmik ${balusterResult.actualGapMm.toFixed(1)}mm`
    } else if (mode === 'angled' && angledResult) {
      return `${angledResult.balusterCount} palic, rake ${(angledResult.rakeLengthMm / 1000).toFixed(2)}m, kot ${angledResult.rakeAngleDeg.toFixed(1)}°`
    } else if (mode === 'material' && materialResult) {
      return `${materialResult.totalLinearMeters.toFixed(2)}m profila, ${applyReserve(materialResult.balusterCount, rezervaPctMaterial)} palic, ${formatEUR(materialResult.totalCost)}`
    } else if (mode === 'compliance' && complianceResult) {
      const ok = complianceResult.checks.filter((c) => c.passed).length
      return `${ok}/${complianceResult.checks.length} preverb uspešnih`
    } else if (mode === 'cnc' && cncResult) {
      return `${cncResult.stockCount} profilov, izkoristek ${cncResult.overallUtilizationPct.toFixed(1)}%, ostanek ${cncResult.totalWasteMm}mm`
    } else if (mode === 'windLocation' && windLocResult) {
      return `${windLocResult.locationDescription} — cona ${windLocResult.windZone}, ${riskLabels[windLocResult.riskLevel]}`
    } else if (mode === 'glass' && glassResult) {
      return `${glassResult.recommendedThicknessMm}mm ${glassResult.layers ? `laminirano (${glassResult.layers} sloje)` : glassInput.glassType === 'tempered' ? 'kaljeno' : 'enojno'}${glassResult.isSafe ? ' — VARNO' : ' — NEVARNO'}`
    }
    return modeLabelMap[mode]
  }

  /** Naloži inpute iz predloge ali zgodovine v ustrezen način. */
  function applyInputs(targetMode: CalcMode, inputs: Record<string, string>) {
    if (targetMode === 'railing') {
      if (inputs.profileType) setProfileType(inputs.profileType as ProfileType)
      if (inputs.totalLength) setTotalLength(inputs.totalLength)
      if (inputs.slatWidth) setSlatWidth(inputs.slatWidth)
      if (inputs.maxGap) setMaxGap(inputs.maxGap)
      if (inputs.postCount !== undefined) setPostCount(inputs.postCount)
    } else if (targetMode === 'anchoring') {
      if (inputs.holeCount) setHoleCount(inputs.holeCount)
      if (inputs.holeDepthMm) setHoleDepthMm(inputs.holeDepthMm)
      if (inputs.holeDiameterMm) setHoleDiameterMm(inputs.holeDiameterMm)
      if (inputs.temperature) setTemperature(inputs.temperature)
      if (inputs.anchorType) setAnchorType(inputs.anchorType as AnchorType)
    } else if (targetMode === 'wind') {
      if (inputs.heightAboveGround) setHeightAboveGround(inputs.heightAboveGround)
      if (inputs.terrainCategory) setTerrainCategory(inputs.terrainCategory as TerrainCategory)
      if (inputs.windSpeedMs) setWindSpeedMs(inputs.windSpeedMs)
      if (inputs.railingAreaM2) setRailingAreaM2(inputs.railingAreaM2)
      if (inputs.railingType) setRailingType(inputs.railingType as RailingType)
    } else if (targetMode === 'baluster') {
      if (inputs.balTotalLength) setBalTotalLength(inputs.balTotalLength)
      if (inputs.balWidth) setBalWidth(inputs.balWidth)
      if (inputs.balMaxGap) setBalMaxGap(inputs.balMaxGap)
      if (inputs.balPostSpacing) setBalPostSpacing(inputs.balPostSpacing)
      if (inputs.rezervaPctBaluster) {
        const r = parseFloat(inputs.rezervaPctBaluster)
        if (isFinite(r)) setRezervaPctBaluster(r)
      }
    } else if (targetMode === 'angled') {
      if (inputs.angHorizontalLength) setAngHorizontalLength(inputs.angHorizontalLength)
      if (inputs.angRakeAngle) setAngRakeAngle(inputs.angRakeAngle)
      if (inputs.angWidth) setAngWidth(inputs.angWidth)
      if (inputs.angMaxGap) setAngMaxGap(inputs.angMaxGap)
    } else if (targetMode === 'material') {
      if (inputs.profileSifra) setSelectedProfileSifra(inputs.profileSifra)
      if (inputs.segments) {
        try {
          const parsed = JSON.parse(inputs.segments)
          if (Array.isArray(parsed) && parsed.length > 0) setSegments(parsed)
        } catch { /* ignore */ }
      }
      if (inputs.urnaPostavka) setUrnaPostavka(inputs.urnaPostavka)
      if (inputs.stUr) setStUr(inputs.stUr)
      if (inputs.stMonterjev) setStMonterjev(inputs.stMonterjev)
      if (inputs.transport) setTransport(inputs.transport)
      if (inputs.rezervaPctMaterial) {
        const r = parseFloat(inputs.rezervaPctMaterial)
        if (isFinite(r)) setRezervaPctMaterial(r)
      }
      if (inputs.ddvPct) {
        const d = parseFloat(inputs.ddvPct)
        if (isFinite(d)) setDdvPct(d)
      }
      if (inputs.akontacijaPct) {
        const a = parseFloat(inputs.akontacijaPct)
        if (isFinite(a)) setAkontacijaPct(a)
      }
    } else if (targetMode === 'compliance') {
      if (inputs.compGap) setCompGap(inputs.compGap)
      if (inputs.compHeight) setCompHeight(inputs.compHeight)
      if (inputs.compPostSpacing) setCompPostSpacing(inputs.compPostSpacing)
      if (inputs.compLoadCategory) setCompLoadCategory(inputs.compLoadCategory as 'A' | 'B' | 'C')
      if (inputs.compDropHeight) setCompDropHeight(inputs.compDropHeight)
    } else if (targetMode === 'cnc') {
      if (inputs.cncStockLength) {
        setCncStockLength(inputs.cncStockLength)
        setCncStockPreset(['6000', '4000', '2200'].includes(inputs.cncStockLength) ? inputs.cncStockLength : 'custom')
      }
      if (inputs.cncSawBlade) setCncSawBlade(inputs.cncSawBlade)
      if (inputs.cncSegments) {
        try {
          const parsed = JSON.parse(inputs.cncSegments)
          if (Array.isArray(parsed) && parsed.length > 0) setCncSegments(parsed)
        } catch { /* ignore */ }
      }
    } else if (targetMode === 'windLocation') {
      if (inputs.windLocLat) setWindLocLat(inputs.windLocLat)
      if (inputs.windLocLon) setWindLocLon(inputs.windLocLon)
      if (inputs.windLocHeight) setWindLocHeight(inputs.windLocHeight)
      if (inputs.windLocTerrain) setWindLocTerrain(inputs.windLocTerrain as TerrainCategory)
      if (inputs.windLocArea) setWindLocArea(inputs.windLocArea)
      if (inputs.windLocType) setWindLocType(inputs.windLocType as RailingType)
    } else if (targetMode === 'glass') {
      const span = parseFloat(inputs.glassSpan)
      const height = parseFloat(inputs.glassHeight)
      const load = parseFloat(inputs.glassLoad)
      const gType = inputs.glassType as GlassType
      setGlassInput({
        spanMm: isFinite(span) ? span : 1200,
        heightMm: isFinite(height) ? height : 1100,
        loadKnPerM: isFinite(load) ? load : 1.0,
        glassType: gType || 'laminated',
      })
    }
  }

  /** Shrani trenutne inpute kot predlogo (samo za 4 podprte načine). */
  function saveTemplate() {
    const supported: TemplateMode[] = ['baluster', 'angled', 'material', 'compliance']
    if (!supported.includes(mode as TemplateMode)) {
      toast.error('Predloge so na voljo samo za: Razmak palic, Kotni, Skupni material, Predpisi')
      return
    }
    const naziv = window.prompt('Ime predloge:', `Predloga ${templateModeLabels[mode as TemplateMode]} ${new Date().toLocaleDateString('sl-SI')}`)
    if (!naziv || !naziv.trim()) return
    const tpl: CalcTemplate = {
      id: `tpl_${Date.now()}`,
      naziv: naziv.trim(),
      mode: mode as TemplateMode,
      inputs: collectCurrentInputs(),
      createdAt: new Date().toISOString(),
    }
    const updated = [tpl, ...templates].slice(0, 50)
    setTemplates(updated)
    try {
      localStorage.setItem('roksal_calc_templates', JSON.stringify(updated))
    } catch {
      // ignore
    }
    setActiveTemplateId(tpl.id)
    toast.success(`Predloga "${tpl.naziv}" shranjena`)
  }

  /** Naloži predlogo v ustrezni način. */
  function loadTemplate(tpl: CalcTemplate) {
    setMode(tpl.mode)
    applyInputs(tpl.mode, tpl.inputs)
    setActiveTemplateId(tpl.id)
    toast.info(`Predloga "${tpl.naziv}" naložena`)
  }

  /** Izbriše predlogo. */
  function deleteTemplate(id: string) {
    const updated = templates.filter((t) => t.id !== id)
    setTemplates(updated)
    if (activeTemplateId === id) setActiveTemplateId(null)
    try {
      localStorage.setItem('roksal_calc_templates', JSON.stringify(updated))
    } catch {
      // ignore
    }
    toast.success('Predloga izbrisana')
  }

  /** Doda trenutni izračun v zgodovino (max 30). */
  function addToHistory() {
    const modeLabelMap: Record<CalcMode, string> = {
      railing: 'Razmiki letev',
      anchoring: 'Kemično sidranje',
      wind: 'Vetrna obremenitev',
      baluster: 'Razmak palic',
      angled: 'Kotni izračun',
      material: 'Skupni material',
      compliance: 'Predpisi',
      cnc: 'CNC rez',
      windLocation: 'Veter po lokaciji',
      glass: 'Steklena balustrada',
    }
    const hasResult =
      (mode === 'railing' && railingResult) ||
      (mode === 'anchoring' && anchoringResult) ||
      (mode === 'wind' && windResult) ||
      (mode === 'baluster' && balusterResult) ||
      (mode === 'angled' && angledResult) ||
      (mode === 'material' && materialResult) ||
      (mode === 'compliance' && complianceResult) ||
      (mode === 'cnc' && cncResult) ||
      (mode === 'windLocation' && windLocResult) ||
      (mode === 'glass' && glassResult)
    if (!hasResult) return

    const entry: HistoryEntry = {
      id: `hist_${Date.now()}`,
      timestamp: new Date().toISOString(),
      mode,
      modeLabel: modeLabelMap[mode],
      keyResult: getCurrentKeyResult(),
      inputs: collectCurrentInputs(),
      projectName: projectName.trim() || undefined,
    }
    const updated = [entry, ...history].slice(0, 30)
    setHistory(updated)
    try {
      localStorage.setItem('roksal_calc_history', JSON.stringify(updated))
    } catch {
      // ignore
    }
  }

  // P2: Effect — ko se calcNonce spremeni (uporabnik je kliknil "Izračunaj"),
  // zapiše trenutni izračun v zgodovino. Re-render je takrat že opravljen,
  // zato so rezultati na voljo.
  useEffect(() => {
    if (calcNonce === 0) return
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false
      return
    }
    addToHistory()
  }, [calcNonce])

  /** Počisti zgodovino. */
  function clearHistory() {
    setHistory([])
    try {
      localStorage.removeItem('roksal_calc_history')
    } catch {
      // ignore
    }
    toast.success('Zgodovina počiščena')
  }

  /** Izvozi zgodovino v CSV. */
  function exportHistoryCsv() {
    if (history.length === 0) {
      toast.error('Zgodovina je prazna')
      return
    }
    const headers = ['Datum', 'Način', 'Ključni rezultat', 'Projekt', 'Vhodni podatki']
    const rows = history.map((h) => [
      new Date(h.timestamp).toLocaleString('sl-SI'),
      h.modeLabel,
      h.keyResult,
      h.projectName ?? '',
      JSON.stringify(h.inputs),
    ])
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n')
    // BOM za Excel
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `roksal-zgodovina-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Zgodovina izvožena v CSV')
  }

  /** Naloži vnos iz zgodovine in ponovno izračuna. */
  function loadFromHistory(entry: HistoryEntry) {
    setMode(entry.mode)
    applyInputs(entry.mode, entry.inputs)
    if (entry.projectName) setProjectName(entry.projectName)
    // Pri loadu iz zgodovine NE želimo ponovno zapisati v zgodovino.
    skipHistoryRef.current = true
    toast.info(`Naloženo iz zgodovine: ${entry.modeLabel}`)
    // Sproži ponovni izračun
    setTimeout(() => handleCalculate(), 50)
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

  // ===== Baluster calculation =====
  function calculateBalusterClientSide() {
    const L = parseFloat(balTotalLength) * 1000
    const W = parseFloat(balWidth)
    const G = parseFloat(balMaxGap)
    if (!isFinite(L) || !isFinite(W) || !isFinite(G) || L <= 0 || W <= 0 || G <= 0) {
      setBalusterResult(null)
      return
    }
    const result = calculateEqualSpacing({
      totalLengthMm: L,
      balusterWidthMm: W,
      maxGapMm: G,
    })
    setBalusterResult(result)
  }

  // ===== Angled calculation =====
  function calculateAngledClientSide() {
    const L = parseFloat(angHorizontalLength) * 1000
    const angle = parseFloat(angRakeAngle)
    const W = parseFloat(angWidth)
    const G = parseFloat(angMaxGap)
    if (!isFinite(L) || !isFinite(angle) || !isFinite(W) || !isFinite(G) || L <= 0 || W <= 0 || G <= 0) {
      setAngledResult(null)
      return
    }
    const result = calculateAngledSpacing({
      horizontalLengthMm: L,
      rakeAngleDeg: angle,
      balusterWidthMm: W,
      maxGapMm: G,
    })
    setAngledResult(result)
  }

  // ===== Material calculation =====
  function calculateMaterialClientSide() {
    if (segments.length === 0) {
      setMaterialResult(null)
      return
    }
    const result = calculateMaterialTotal({
      segments,
      profileSifra: selectedProfileSifra,
      profili,
    })
    setMaterialResult(result)
  }

  // ===== Compliance calculation =====
  function calculateComplianceClientSide() {
    const gap = parseFloat(compGap)
    const height = parseFloat(compHeight)
    const spacing = parseFloat(compPostSpacing)
    const drop = parseFloat(compDropHeight) || 0
    if (!isFinite(gap) || !isFinite(height) || !isFinite(spacing)) {
      setComplianceResult(null)
      return
    }
    const result = checkCompliance({
      gapMm: gap,
      heightMm: height,
      postSpacingMm: spacing,
      loadCategory: compLoadCategory,
      dropHeightMm: drop,
    })
    setComplianceResult(result)
  }

  // ===== CNC cutting calculation =====
  function calculateCncClientSide() {
    const stock = parseFloat(cncStockLength)
    const blade = parseFloat(cncSawBlade)
    if (!isFinite(stock) || stock <= 0) {
      setCncResult(null)
      return
    }
    const segments = cncSegments
      .filter((s) => s.lengthMm && s.count)
      .map((s) => ({
        lengthMm: parseFloat(s.lengthMm) || 0,
        count: parseInt(s.count) || 0,
        label: s.label || undefined,
      }))
      .filter((s) => s.lengthMm > 0 && s.count > 0)
    if (segments.length === 0) {
      setCncResult(null)
      return
    }
    const result = calculateCncCutting({
      segments,
      stockLengthMm: stock,
      sawBladeWidthMm: isFinite(blade) ? blade : 3,
    })
    setCncResult(result)
  }

  // ===== Wind by location calculation =====
  function calculateWindLocClientSide() {
    const lat = parseFloat(windLocLat)
    const lon = parseFloat(windLocLon)
    const h = parseFloat(windLocHeight)
    const area = parseFloat(windLocArea)
    if (!isFinite(lat) || !isFinite(lon) || !isFinite(h) || !isFinite(area)) {
      setWindLocResult(null)
      return
    }
    const result = calculateWindByLocation({
      latitude: lat,
      longitude: lon,
      heightAboveGround: h,
      terrainCategory: windLocTerrain,
      railingAreaM2: area,
      railingType: windLocType,
    })
    setWindLocResult(result)
  }

  // ===== Glass balustrade calculation =====
  function calculateGlassClientSide() {
    if (
      !isFinite(glassInput.spanMm) ||
      !isFinite(glassInput.heightMm) ||
      !isFinite(glassInput.loadKnPerM) ||
      glassInput.spanMm <= 0
    ) {
      setGlassResult(null)
      return
    }
    const result = calculateGlassBalustrade(glassInput)
    setGlassResult(result)
  }

  // Auto-calculate on input change
  useEffect(() => {
    if (mode === 'railing') {
      calculateRailingClientSide()
    } else if (mode === 'anchoring') {
      calculateAnchoringClientSide()
    } else if (mode === 'wind') {
      calculateWindClientSide()
    } else if (mode === 'baluster') {
      calculateBalusterClientSide()
    } else if (mode === 'angled') {
      calculateAngledClientSide()
    } else if (mode === 'material') {
      calculateMaterialClientSide()
    } else if (mode === 'compliance') {
      calculateComplianceClientSide()
    } else if (mode === 'cnc') {
      calculateCncClientSide()
    } else if (mode === 'windLocation') {
      calculateWindLocClientSide()
    } else if (mode === 'glass') {
      calculateGlassClientSide()
    }
  }, [mode, profileType, effectiveTotalLength, slatWidth, maxGap, postCount, holeCount, holeDepthMm, holeDiameterMm, temperature, anchorType, heightAboveGround, terrainCategory, windSpeedMs, railingAreaM2, railingType, balTotalLength, balWidth, balMaxGap, balPostSpacing, angHorizontalLength, angRakeAngle, angWidth, angMaxGap, segments, selectedProfileSifra, compGap, compHeight, compPostSpacing, compLoadCategory, compDropHeight, cncStockLength, cncSawBlade, cncSegments, windLocLat, windLocLon, windLocHeight, windLocTerrain, windLocArea, windLocType, glassInput])

  // Fetch profili when material mode is selected
  useEffect(() => {
    if (mode === 'material' && profili.length === 0) {
      fetch('/api/profili')
        .then((r) => r.json())
        .then((data: LibProfil[]) => {
          if (Array.isArray(data)) {
            setProfili(data)
            if (data.length > 0 && !selectedProfileSifra) {
              setSelectedProfileSifra(data[0].sifra)
            }
          }
        })
        .catch(() => {
          toast.error('Napaka pri nalaganju profilov')
        })
    }
  }, [mode, profili.length, selectedProfileSifra])

  // ===== PDF: Baluster drilling template =====
  function exportBalusterPdf() {
    if (!balusterResult) return
    const L = parseFloat(balTotalLength) * 1000
    const W = parseFloat(balWidth)
    const G = parseFloat(balMaxGap)
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()

    // Navy header
    doc.setFillColor(29, 43, 62)
    doc.rect(0, 0, pageW, 22, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(15)
    doc.setFont('helvetica', 'bold')
    doc.text('ROKSAL — Predloga vrtanja', 14, 12)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Kranj, Slovenija', 14, 18)
    // Amber accent
    doc.setFillColor(245, 158, 11)
    doc.rect(0, 22, pageW, 1.5, 'F')

    let y = 30
    doc.setTextColor(20, 20, 20)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Parameter', 14, y)
    doc.text('Vrednost', 80, y)
    y += 4
    doc.setDrawColor(220, 220, 220)
    doc.line(14, y, pageW - 14, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const rows: [string, string][] = [
      ['Skupna dolžina', `${L.toFixed(0)}mm (${(L / 1000).toFixed(2)}m)`],
      ['Širina palice', `${W}mm`],
      ['Maksimalni razmik', `${G}mm`],
      ['Dejanski razmik', `${balusterResult.actualGapMm.toFixed(1)}mm`],
      ['Število palic (brez rezerve)', `${balusterResult.balusterCount} kos`],
      ['Rezerva materiala', `${rezervaPctBaluster}%`],
      ['Število palic (z rezervo)', `${applyReserve(balusterResult.balusterCount, rezervaPctBaluster)} kos`],
      ['Skladnost (SIST EN 1264)', balusterResult.isCompliant ? 'DA ✓' : 'NE ✗'],
    ]
    for (const [k, v] of rows) {
      doc.setTextColor(90, 90, 90)
      doc.text(k, 14, y)
      doc.setTextColor(20, 20, 20)
      doc.text(v, 80, y)
      y += 5
    }

    // Hole template table (centers for drilling)
    y += 4
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(29, 43, 62)
    doc.text('Pozicije lukenj (centri palic) od prve točke', 14, y)
    y += 3

    autoTable(doc, {
      startY: y,
      head: [['#', 'mm', 'cm', 'm']],
      body: balusterResult.centers.map((c, i) => [
        String(i + 1),
        `${c.toFixed(1)}`,
        `${(c / 10).toFixed(2)}`,
        `${(c / 1000).toFixed(3)}`,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [29, 43, 62], fontSize: 9 },
      bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: [247, 249, 255] },
      margin: { left: 14, right: 14 },
    })

    // Footer
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text(
      `Datum: ${new Date().toLocaleDateString('sl-SI')} — Roksal Railing Manager`,
      14,
      finalY + 10,
    )
    doc.save(`roksal-predloga-vrtanja-${Date.now()}.pdf`)
    toast.success('Predloga PDF izvožena')
  }

  // ===== PDF: Material list =====
  function exportMaterialPdf() {
    if (!materialResult) return
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()

    // Navy header
    doc.setFillColor(29, 43, 62)
    doc.rect(0, 0, pageW, 22, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(15)
    doc.setFont('helvetica', 'bold')
    doc.text('ROKSAL — Materialni list', 14, 12)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Kranj, Slovenija', 14, 18)
    // Amber accent
    doc.setFillColor(245, 158, 11)
    doc.rect(0, 22, pageW, 1.5, 'F')

    let y = 30
    doc.setTextColor(20, 20, 20)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Profil: ${materialResult.selectedProfile?.naziv ?? '—'} (${materialResult.selectedProfile?.sifra ?? '—'})`, 14, y)
    y += 5
    if (projectName.trim()) {
      doc.text(`Projekt: ${projectName.trim()}`, 14, y)
      y += 5
    }
    doc.text(`Datum: ${new Date().toLocaleDateString('sl-SI')}`, 14, y)
    y += 5
    doc.text(`Rezerva materiala: ${rezervaPctMaterial}%`, 14, y)
    y += 7

    // Summary table (z rezervo)
    autoTable(doc, {
      startY: y,
      head: [['Material', 'Brez rezerve', 'Z rezervo', 'Enota']],
      body: [
        ['Letve (zgoraj + spodaj)', `${materialResult.railLinearMeters.toFixed(2)}`, `${materialResult.railLinearMeters.toFixed(2)}`, 'm'],
        ['Palice (linearni metri)', `${materialResult.balusterLinearMeters.toFixed(2)}`, `${materialResult.balusterLinearMeters.toFixed(2)}`, 'm'],
        ['Skupno profil', `${materialResult.totalLinearMeters.toFixed(2)}`, `${materialResult.totalLinearMeters.toFixed(2)}`, 'm'],
        ['Palice (število)', `${materialResult.balusterCount}`, `${applyReserve(materialResult.balusterCount, rezervaPctMaterial)}`, 'kos'],
        ['Stebri', `${materialResult.postCount}`, `${applyReserve(materialResult.postCount, rezervaPctMaterial)}`, 'kos'],
        ['Število letvev (top+bottom)', `${materialResult.railCount}`, `${applyReserve(materialResult.railCount, rezervaPctMaterial)}`, 'kos'],
        ['Vijaki (4/palico + 8/stebro)', `${materialResult.screwCount}`, `${applyReserve(materialResult.screwCount, rezervaPctMaterial)}`, 'kos'],
        ['Sidra (2/stebro)', `${materialResult.anchorCount}`, `${applyReserve(materialResult.anchorCount, rezervaPctMaterial)}`, 'kos'],
      ],
      theme: 'grid',
      headStyles: { fillColor: [29, 43, 62], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [247, 249, 255] },
      margin: { left: 14, right: 14 },
    })

    // Cost breakdown (material)
    const y2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    const labor = calculateLaborCost({
      urnaPostavka: parseFloat(urnaPostavka) || 0,
      stUr: parseFloat(stUr) || 0,
      stMonterjev: parseFloat(stMonterjev) || 0,
      transport: parseFloat(transport) || 0,
    })
    const skupajBrezDdv = materialResult.totalCost + labor.delaSkupaj
    const ddv = calculateDDV(skupajBrezDdv, ddvPct)
    const akon = calculateAkontacija(ddv.total, akontacijaPct)

    autoTable(doc, {
      startY: y2,
      head: [['Postavka', 'Cena (€)']],
      body: [
        ['Profil material', materialResult.profileCost.toFixed(2)],
        ['Stebri (25 €/kos)', materialResult.postsCost.toFixed(2)],
        ['Vijaki (0,10 €/kos)', materialResult.screwsCost.toFixed(2)],
        ['Sidra (1,50 €/kos)', materialResult.anchorsCost.toFixed(2)],
        ['SKUPAJ MATERIAL', materialResult.totalCost.toFixed(2)],
        ['', ''],
        ['Delo (ura × ur × monterji)', labor.cistaDela.toFixed(2)],
        ['Transport', labor.transport.toFixed(2)],
        ['SKUPAJ BREZ DDV', skupajBrezDdv.toFixed(2)],
        [`DDV (${formatSI(ddvPct, 1)}%)`, ddv.ddvAmount.toFixed(2)],
        ['SKUPAJ Z DDV', ddv.total.toFixed(2)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [245, 158, 11], textColor: [29, 43, 62], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        // Bold for SKUPAJ rows
        if (data.cell.raw === 'SKUPAJ MATERIAL' || data.cell.raw === 'SKUPAJ BREZ DDV' || data.cell.raw === 'SKUPAJ Z DDV') {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.textColor = [29, 43, 62]
        }
      },
    })

    // Akontacija (if > 0)
    let afterY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
    if (akontacijaPct > 0) {
      const placiloDatum = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('sl-SI')
      autoTable(doc, {
        startY: afterY + 6,
        head: [['Akontacija', 'Znesek (€)', 'Rok']],
        body: [
          [`Akontacija (${akontacijaPct}%) — ob naročilu`, akon.akontacija.toFixed(2), placiloDatum],
          [`Preostanek (${100 - akontacijaPct}%) — ob prevzemu`, akon.preostanek.toFixed(2), 'ob prevzemu'],
        ],
        theme: 'grid',
        headStyles: { fillColor: [29, 43, 62], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      })
      afterY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
    }

    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text('Roksal Railing Manager — orientacijska cena. Končno ponudbo pripravi vodja projekta.', 14, afterY + 10)
    doc.save(`roksal-materialni-list-${Date.now()}.pdf`)
    toast.success('Materialni list PDF izvožen')
  }

  // ===== PDF: CNC razrezni list =====
  function exportCncPdf() {
    if (!cncResult) return
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()

    // Navy header
    doc.setFillColor(29, 43, 62)
    doc.rect(0, 0, pageW, 22, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(15)
    doc.setFont('helvetica', 'bold')
    doc.text('ROKSAL — Razrezni list CNC', 14, 12)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Kranj, Slovenija', 14, 18)
    doc.setFillColor(245, 158, 11)
    doc.rect(0, 22, pageW, 1.5, 'F')

    let y = 30
    doc.setTextColor(20, 20, 20)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Dolžina profila: ${cncStockLength}mm`, 14, y)
    y += 5
    doc.text(`Širina reza: ${cncSawBlade}mm`, 14, y)
    y += 5
    if (projectName.trim()) {
      doc.text(`Projekt: ${projectName.trim()}`, 14, y)
      y += 5
    }
    doc.text(`Datum: ${new Date().toLocaleDateString('sl-SI')}`, 14, y)
    y += 5
    doc.text(`Število profilov: ${cncResult.stockCount}  ·  Izkoristek: ${cncResult.overallUtilizationPct.toFixed(1)}%  ·  Ostanek: ${cncResult.totalWasteMm}mm`, 14, y)
    y += 7

    // Seznam odsekov
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(29, 43, 62)
    doc.text('Zahtevani odseki', 14, y)
    y += 4

    autoTable(doc, {
      startY: y,
      head: [['#', 'Labela', 'Dolžina (mm)', 'Število']],
      body: cncSegments
        .filter((s) => s.lengthMm && s.count)
        .map((s, i) => [String(i + 1), s.label || '—', s.lengthMm, s.count]),
      theme: 'grid',
      headStyles: { fillColor: [29, 43, 62], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [247, 249, 255] },
      margin: { left: 14, right: 14 },
    })

    let y2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(29, 43, 62)
    doc.text('Razrezni načrt', 14, y2)
    y2 += 4

    const planRows: [string, string, string][] = []
    cncResult.plans.forEach((plan) => {
      const cutsStr = plan.cuts.map((c) => `${c.lengthMm}mm${c.label ? ` (${c.label})` : ''}`).join(', ')
      planRows.push([
        `Profil #${plan.stockIndex}`,
        cutsStr || '—',
        `Ostanek: ${plan.remainingMm}mm (${plan.utilizationPct.toFixed(1)}%)`,
      ])
    })
    autoTable(doc, {
      startY: y2,
      head: [['Profil', 'Rezi', 'Ostanek / Izkoristek']],
      body: planRows,
      theme: 'grid',
      headStyles: { fillColor: [245, 158, 11], textColor: [29, 43, 62], fontSize: 9 },
      bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: [247, 249, 255] },
      margin: { left: 14, right: 14 },
    })

    // Warnings
    if (cncResult.warnings.length > 0) {
      const y3 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(245, 158, 11)
      doc.text('Opozorila', 14, y3)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(80, 80, 80)
      cncResult.warnings.forEach((w, i) => {
        doc.text(`• ${w}`, 14, y3 + 5 + i * 4)
      })
    }

    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
    doc.text('Roksal Railing Manager — razrezni list za CNC operaterja.', 14, finalY + 20)
    doc.save(`roksal-razrezni-list-${Date.now()}.pdf`)
    toast.success('Razrezni list PDF izvožen')
  }

  // ===== PDF: Veter po lokaciji =====
  function exportWindLocPdf() {
    if (!windLocResult) return
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()

    // Navy header
    doc.setFillColor(29, 43, 62)
    doc.rect(0, 0, pageW, 22, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(15)
    doc.setFont('helvetica', 'bold')
    doc.text('ROKSAL — Vetrno poročilo', 14, 12)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Kranj, Slovenija', 14, 18)
    doc.setFillColor(245, 158, 11)
    doc.rect(0, 22, pageW, 1.5, 'F')

    let y = 30
    doc.setTextColor(20, 20, 20)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Lokacija', 14, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`${windLocResult.locationDescription}`, 14, y)
    y += 5
    doc.text(`GPS: ${windLocLat}, ${windLocLon}`, 14, y)
    y += 5
    doc.text(`Višina nad tlemi: ${windLocHeight}m  ·  Teren: ${windLocTerrain}  ·  Tip: ${railingTypeLabels[windLocType]}  ·  Površina: ${windLocArea}m²`, 14, y)
    y += 8

    autoTable(doc, {
      startY: y,
      head: [['Parameter', 'Vrednost']],
      body: [
        ['Vetrna cona', `Cona ${windLocResult.windZone}`],
        ['Osnovna hitrost vetra', `${windLocResult.basicWindSpeedMs} m/s`],
        ['Osnovni vetrni tlak', `${windLocResult.basicPressureKpa.toFixed(3)} kPa`],
        ['Vrhnji vetrni tlak', `${windLocResult.designPressureKpa.toFixed(3)} kPa`],
        ['Skupna sila na ograjo', `${windLocResult.totalForceKn.toFixed(2)} kN`],
        ['Sila na meter', `${windLocResult.forcePerMeterNm.toFixed(0)} N/m`],
        ['Stopnja tveganja', riskLabels[windLocResult.riskLevel]],
      ],
      theme: 'grid',
      headStyles: { fillColor: [29, 43, 62], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [247, 249, 255] },
      margin: { left: 14, right: 14 },
    })

    let y2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    if (windLocResult.recommendations.length > 0) {
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(245, 158, 11)
      doc.text('Priporočila', 14, y2)
      y2 += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(60, 60, 60)
      windLocResult.recommendations.forEach((r, i) => {
        const lines = doc.splitTextToSize(`• ${r}`, pageW - 28)
        doc.text(lines, 14, y2 + i * 5)
        y2 += lines.length * 5 - 5
      })
    }

    if (projectName.trim()) {
      y2 += 8
      doc.setFontSize(9)
      doc.setTextColor(120, 120, 120)
      doc.text(`Projekt: ${projectName.trim()}`, 14, y2)
    }

    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text(`Datum: ${new Date().toLocaleDateString('sl-SI')} — Roksal Railing Manager (SIST EN 1991-1-4 NA)`, 14, 280)
    doc.save(`roksal-vetrno-porocilo-${Date.now()}.pdf`)
    toast.success('Vetrno poročilo PDF izvoženo')
  }

  // ===== PDF: Steklena balustrada specifikacija =====
  function exportGlassPdf() {
    if (!glassResult) return
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()

    // Navy header
    doc.setFillColor(29, 43, 62)
    doc.rect(0, 0, pageW, 22, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(15)
    doc.setFont('helvetica', 'bold')
    doc.text('ROKSAL — Steklena balustrada specifikacija', 14, 12)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Kranj, Slovenija', 14, 18)
    doc.setFillColor(245, 158, 11)
    doc.rect(0, 22, pageW, 1.5, 'F')

    let y = 30
    doc.setTextColor(20, 20, 20)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const glassTypeLabelsLocal: Record<GlassType, string> = {
      single: 'Enojno steklo',
      laminated: 'Laminirano steklo',
      tempered: 'Kaljeno steklo',
    }
    doc.text(`Tip stekla: ${glassTypeLabelsLocal[glassInput.glassType]}`, 14, y)
    y += 5
    doc.text(`Razpon med stebri: ${glassInput.spanMm}mm`, 14, y)
    y += 5
    doc.text(`Višina stekla: ${glassInput.heightMm}mm`, 14, y)
    y += 5
    doc.text(`Horizontalna obremenitev: ${glassInput.loadKnPerM.toFixed(1)} kN/m`, 14, y)
    y += 8

    autoTable(doc, {
      startY: y,
      head: [['Parameter', 'Vrednost']],
      body: [
        ['Priporočena debelina', `${glassResult.recommendedThicknessMm}mm`],
        ['Napetost v steklu', `${glassResult.stressMpa.toFixed(1)} MPa`],
        ['Dovoljena napetost', `${glassResult.allowableStressMpa} MPa`],
        ['Max razpon za debelino', `${glassResult.maxSpanForThicknessMm}mm`],
        ['Število slojev', glassResult.layers ? `${glassResult.layers}` : '1'],
        ['Varnost', glassResult.isSafe ? 'VARNO ✓' : 'NEVARNO ✗'],
      ],
      theme: 'grid',
      headStyles: { fillColor: [29, 43, 62], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [247, 249, 255] },
      margin: { left: 14, right: 14 },
    })

    let y2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(29, 43, 62)
    doc.text('Alternativne debeline', 14, y2)
    y2 += 4
    autoTable(doc, {
      startY: y2,
      head: [['Debelina (mm)', 'Status', 'Razlog']],
      body: glassResult.alternativeThicknesses.map((a) => [
        `${a.mm}`,
        a.safe ? 'VARNO' : 'Tveganje',
        a.reason,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [245, 158, 11], textColor: [29, 43, 62], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [247, 249, 255] },
      margin: { left: 14, right: 14 },
    })

    let y3 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    if (glassResult.warnings.length > 0) {
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(245, 158, 11)
      doc.text('Opozorila', 14, y3)
      y3 += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(80, 80, 80)
      glassResult.warnings.forEach((w, i) => {
        const lines = doc.splitTextToSize(`• ${w}`, pageW - 28)
        doc.text(lines, 14, y3 + i * 4)
        y3 += lines.length * 4 - 4
      })
      y3 += 6
    }

    if (glassResult.recommendations.length > 0) {
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(29, 43, 62)
      doc.text('Priporočila', 14, y3)
      y3 += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(60, 60, 60)
      glassResult.recommendations.forEach((r, i) => {
        const lines = doc.splitTextToSize(`• ${r}`, pageW - 28)
        doc.text(lines, 14, y3 + i * 4)
        y3 += lines.length * 4 - 4
      })
    }

    if (projectName.trim()) {
      y3 += 8
      doc.setFontSize(9)
      doc.setTextColor(120, 120, 120)
      doc.text(`Projekt: ${projectName.trim()}`, 14, y3)
    }

    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text(`Datum: ${new Date().toLocaleDateString('sl-SI')} — Roksal Railing Manager (poenostavljena metoda po SIST EN)`, 14, 280)
    doc.save(`roksal-steklena-balustrada-${Date.now()}.pdf`)
    toast.success('Specifikacija stekla PDF izvožena')
  }

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

      {/* P2: Prihranjene predloge (Saved templates) */}
      {templates.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                <Layers className="h-4 w-4 text-roksal-amber" />
                Prihranjene predloge
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{templates.length}</Badge>
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[10px] text-roksal-red hover:text-roksal-red hover:bg-roksal-red/10"
                onClick={() => {
                  setTemplates([])
                  setActiveTemplateId(null)
                  try { localStorage.removeItem('roksal_calc_templates') } catch { /* ignore */ }
                  toast.success('Vse predloge počiščene')
                }}
              >
                <Trash2 className="mr-1 h-3 w-3" />
                Počisti vse
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto scrollbar-thin">
              {templates.map((tpl) => {
                const isActive = tpl.id === activeTemplateId
                return (
                  <div
                    key={tpl.id}
                    className={`rounded-lg border p-2.5 transition-all ${
                      isActive
                        ? 'border-roksal-amber bg-roksal-amber/10 ring-1 ring-roksal-amber/30'
                        : 'border-border/60 hover:border-roksal-navy/30 hover:bg-secondary/30'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => loadTemplate(tpl)}
                      className="flex w-full items-start gap-2 text-left"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-roksal-navy/10">
                        <Layers className="h-3.5 w-3.5 text-roksal-navy" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-roksal-navy truncate">{tpl.naziv}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-roksal-navy/5 border-roksal-navy/20 text-roksal-navy">
                            {templateModeLabels[tpl.mode]}
                          </Badge>
                          <span className="text-[9px] text-muted-foreground">
                            {new Date(tpl.createdAt).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', year: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center justify-end mt-1.5 pt-1.5 border-t border-border/30">
                      <button
                        type="button"
                        onClick={() => deleteTemplate(tpl.id)}
                        className="flex items-center gap-1 text-[9px] text-roksal-red hover:text-roksal-red/80 transition-colors"
                        aria-label="Izbriši predlogo"
                      >
                        <Trash2 className="h-3 w-3" />
                        Izbriši
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            {activeTemplateId && (
              <p className="mt-2 text-[10px] text-roksal-amber flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Aktivna predloga je naložena v trenutnem načinu.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* P2: Naziv projekta (za zgodovino) */}
      <Card>
        <CardContent className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="projectName" className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
              Naziv projekta:
            </Label>
            <Input
              id="projectName"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="npr. Stanovanjska hiša Kranj — balkon"
              className="h-8 text-xs"
            />
          </div>
        </CardContent>
      </Card>

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

      {/* ===== BALUSTER (RAZMAK PALIC) CALCULATOR ===== */}
      {mode === 'baluster' && (
        <>
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                <AlignJustify className="h-4 w-4" />
                Razmak palic — enakomerna porazdelitev
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <div className="space-y-1.5">
                <Label htmlFor="balTotalLength" className="text-xs">
                  Skupna dolžina (m)
                </Label>
                <Input
                  id="balTotalLength"
                  type="number"
                  value={balTotalLength}
                  onChange={(e) => setBalTotalLength(e.target.value)}
                  placeholder="3.0"
                  step="0.1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="balWidth" className="text-xs">
                    Širina palice (mm)
                  </Label>
                  <Input
                    id="balWidth"
                    type="number"
                    value={balWidth}
                    onChange={(e) => setBalWidth(e.target.value)}
                    placeholder="40"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="balMaxGap" className="text-xs">
                    Max razmik (mm)
                  </Label>
                  <Input
                    id="balMaxGap"
                    type="number"
                    value={balMaxGap}
                    onChange={(e) => setBalMaxGap(e.target.value)}
                    placeholder="110"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="balPostSpacing" className="text-xs">
                  Razmik stebrov (mm, max 1500)
                </Label>
                <Input
                  id="balPostSpacing"
                  type="number"
                  value={balPostSpacing}
                  onChange={(e) => setBalPostSpacing(e.target.value)}
                  placeholder="1500"
                />
              </div>
            </CardContent>
          </Card>

          {/* P2: Rezerva materiala + DDV */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                <Percent className="h-4 w-4 text-roksal-amber" />
                Rezerva materiala
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Select
                value={String(rezervaPctBaluster)}
                onValueChange={(v) => setRezervaPctBaluster(parseFloat(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reserveOptions.map((r) => (
                    <SelectItem key={r} value={String(r)}>
                      {r}%{r === 10 ? ' (priporočeno)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Pri izračunu se vse količine (palice, stebri, vijaki, sidra) pomnožijo z (1 + rezerva/100).
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={handleCalculate}
              className="w-full bg-roksal-navy hover:bg-roksal-navy/90 text-white h-11"
            >
              <AlignJustify className="mr-2 h-4 w-4" />
              Izračunaj razmak palic
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={saveTemplate}
              className="w-full h-11 border-roksal-amber/40 text-roksal-navy hover:bg-roksal-amber/10"
            >
              <BookmarkPlus className="mr-2 h-4 w-4" />
              Shrani predlogo
            </Button>
          </div>

          {balusterResult && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Compliance */}
              <Card
                className={`overflow-hidden border-l-4 ${
                  balusterResult.isCompliant
                    ? 'border-l-roksal-green bg-roksal-green/5'
                    : 'border-l-roksal-red bg-roksal-red/5'
                }`}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  {balusterResult.isCompliant ? (
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-roksal-green" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 shrink-0 text-roksal-red" />
                  )}
                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        balusterResult.isCompliant ? 'text-roksal-green' : 'text-roksal-red'
                      }`}
                    >
                      {balusterResult.isCompliant
                        ? 'SKLADNO s predpisi'
                        : 'NESKLADNO — presežen razmik!'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Razmik {balusterResult.actualGapMm.toFixed(1)}mm{' '}
                      {balusterResult.isCompliant ? '≤' : '>'} {balMaxGap}mm
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Result cards */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Število palic
                  </p>
                  <p className="text-2xl font-bold text-roksal-navy">
                    {applyReserve(balusterResult.balusterCount, rezervaPctBaluster)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">kos × {balWidth}mm</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Dejanski razmik
                  </p>
                  <p className="text-2xl font-bold text-roksal-navy">
                    {balusterResult.actualGapMm.toFixed(1)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">mm</p>
                </Card>
              </div>

              {/* P2: Rezerva materiala info */}
              {rezervaPctBaluster > 0 && (
                <Card className="border-roksal-amber/30 bg-roksal-amber/5">
                  <CardContent className="flex items-center gap-3 p-3">
                    <Percent className="h-5 w-5 shrink-0 text-roksal-amber" />
                    <div className="text-xs">
                      <p className="font-semibold text-roksal-navy">Rezerva materiala: {rezervaPctBaluster}%</p>
                      <p className="text-muted-foreground">
                        Brez rezerve: <span className="font-medium text-foreground">{balusterResult.balusterCount} kos</span>
                        {' → '}z rezervo: <span className="font-medium text-roksal-amber">{applyReserve(balusterResult.balusterCount, rezervaPctBaluster)} kos</span>
                        {' '}<span className="text-muted-foreground">(+{rezervaPctBaluster}%)</span>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* SVG diagram */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold text-roksal-navy">
                    Vizualizacija — tehnična skica
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <BalusterSvg
                    totalLengthMm={parseFloat(balTotalLength) * 1000}
                    balusterWidthMm={parseFloat(balWidth)}
                    positions={balusterResult.positions}
                    gapMm={balusterResult.actualGapMm}
                    count={balusterResult.balusterCount}
                  />
                </CardContent>
              </Card>

              {/* Positions table */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                      <Drill className="h-4 w-4" />
                      Pozicije od prve točke
                    </CardTitle>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[10px] border-roksal-amber/30 text-roksal-navy hover:bg-roksal-amber/10"
                      onClick={exportBalusterPdf}
                    >
                      <FileDown className="mr-1 h-3 w-3" />
                      Izvozi PDF
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="max-h-80 overflow-y-auto scrollbar-thin rounded-lg border border-border/40">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead className="w-10 text-center">#</TableHead>
                          <TableHead className="text-right">mm</TableHead>
                          <TableHead className="text-right">cm</TableHead>
                          <TableHead className="text-right">m</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {balusterResult.centers.map((c, i) => (
                          <TableRow key={i} className="even:bg-roksal-navy/5">
                            <TableCell className="text-center font-semibold text-roksal-navy">
                              {i + 1}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {c.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {(c / 10).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {(c / 1000).toFixed(3)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Pozicije so centri palic — kjer vrtate luknje za pritrditev.
                  </p>
                </CardContent>
              </Card>

              {/* Warnings */}
              {balusterResult.warnings.length > 0 && (
                <Card className="border-roksal-amber/30">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-amber">
                      <Info className="h-4 w-4" />
                      Opozorila
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <ul className="space-y-1.5">
                      {balusterResult.warnings.map((w, i) => (
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
            </div>
          )}
        </>
      )}

      {/* ===== ANGLED (KOTNI IZRAČUN) CALCULATOR ===== */}
      {mode === 'angled' && (
        <>
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                <Triangle className="h-4 w-4" />
                Kotni / stopniščni izračun
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="angHorizontalLength" className="text-xs">
                    Horizontalna dolžina (m)
                  </Label>
                  <Input
                    id="angHorizontalLength"
                    type="number"
                    value={angHorizontalLength}
                    onChange={(e) => setAngHorizontalLength(e.target.value)}
                    placeholder="2.5"
                    step="0.1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="angRakeAngle" className="text-xs">
                    Kot stopnice (°)
                  </Label>
                  <Input
                    id="angRakeAngle"
                    type="number"
                    value={angRakeAngle}
                    onChange={(e) => setAngRakeAngle(e.target.value)}
                    placeholder="35"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="angWidth" className="text-xs">
                    Širina palice (mm)
                  </Label>
                  <Input
                    id="angWidth"
                    type="number"
                    value={angWidth}
                    onChange={(e) => setAngWidth(e.target.value)}
                    placeholder="40"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="angMaxGap" className="text-xs">
                    Max razmik (mm)
                  </Label>
                  <Input
                    id="angMaxGap"
                    type="number"
                    value={angMaxGap}
                    onChange={(e) => setAngMaxGap(e.target.value)}
                    placeholder="110"
                  />
                </div>
              </div>
              <div className="rounded-lg bg-roksal-navy/5 p-3 text-[11px] text-muted-foreground">
                <p>
                  <span className="font-medium text-roksal-navy">Tipični koti:</span>{' '}
                  30–35° (standardno stopnišče), 38–42° (strmo), 45°+ (zelo strmo, preverite statiko).
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={handleCalculate}
              className="w-full bg-roksal-navy hover:bg-roksal-navy/90 text-white h-11"
            >
              <Triangle className="mr-2 h-4 w-4" />
              Izračunaj kotni izračun
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={saveTemplate}
              className="w-full h-11 border-roksal-amber/40 text-roksal-navy hover:bg-roksal-amber/10"
            >
              <BookmarkPlus className="mr-2 h-4 w-4" />
              Shrani predlogo
            </Button>
          </div>

          {angledResult && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Result cards */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Rake dolžina
                  </p>
                  <p className="text-2xl font-bold text-roksal-navy">
                    {(angledResult.rakeLengthMm / 1000).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">m (poševno)</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Kot stopnice
                  </p>
                  <p className="text-2xl font-bold text-roksal-navy">
                    {angledResult.rakeAngleDeg.toFixed(1)}°
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    horiz. razmik: {angledResult.horizontalGapMm.toFixed(0)}mm
                  </p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Število palic
                  </p>
                  <p className="text-2xl font-bold text-roksal-navy">
                    {angledResult.balusterCount}
                  </p>
                  <p className="text-[10px] text-muted-foreground">kos</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Dejanski razmik (po rake)
                  </p>
                  <p className="text-2xl font-bold text-roksal-navy">
                    {angledResult.actualGapMm.toFixed(1)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">mm</p>
                </Card>
              </div>

              {/* Compliance */}
              <Card
                className={`overflow-hidden border-l-4 ${
                  angledResult.isCompliant
                    ? 'border-l-roksal-green bg-roksal-green/5'
                    : 'border-l-roksal-red bg-roksal-red/5'
                }`}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  {angledResult.isCompliant ? (
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-roksal-green" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 shrink-0 text-roksal-red" />
                  )}
                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        angledResult.isCompliant ? 'text-roksal-green' : 'text-roksal-red'
                      }`}
                    >
                      {angledResult.isCompliant
                        ? 'SKLADNO s predpisi'
                        : 'NESKLADNO — presežen razmik!'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Razmik {angledResult.actualGapMm.toFixed(1)}mm po rake {' '}
                      {angledResult.isCompliant ? '≤' : '>'} {angMaxGap}mm
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Angled SVG */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold text-roksal-navy">
                    Vizualizacija — kose ograje
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <AngledSvg
                    horizontalLengthMm={parseFloat(angHorizontalLength) * 1000}
                    rakeAngleDeg={parseFloat(angRakeAngle)}
                    positions={angledResult.positions}
                    balusterWidthMm={parseFloat(angWidth)}
                    gapMm={angledResult.actualGapMm}
                  />
                </CardContent>
              </Card>

              {/* Positions table */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                    <Drill className="h-4 w-4" />
                    Pozicije palic (po rake)
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="max-h-64 overflow-y-auto scrollbar-thin rounded-lg border border-border/40">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead className="w-10 text-center">#</TableHead>
                          <TableHead className="text-right">mm</TableHead>
                          <TableHead className="text-right">cm</TableHead>
                          <TableHead className="text-right">m</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {angledResult.centers.map((c, i) => (
                          <TableRow key={i} className="even:bg-roksal-navy/5">
                            <TableCell className="text-center font-semibold text-roksal-navy">
                              {i + 1}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {c.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {(c / 10).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {(c / 1000).toFixed(3)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Warnings */}
              {angledResult.warnings.length > 0 && (
                <Card className="border-roksal-amber/30">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-amber">
                      <Info className="h-4 w-4" />
                      Opozorila
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <ul className="space-y-1.5">
                      {angledResult.warnings.map((w, i) => (
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
            </div>
          )}
        </>
      )}

      {/* ===== MATERIAL (SKUPNI MATERIAL) CALCULATOR ===== */}
      {mode === 'material' && (
        <>
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                <Package className="h-4 w-4" />
                Segmenti projekta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              {segments.map((seg, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border/60 bg-background p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-roksal-navy">
                      Segment {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSegments(segments.filter((_, idx) => idx !== i))
                      }}
                      className="p-1 rounded-md hover:bg-roksal-red/10 text-roksal-red transition-colors"
                      aria-label="Odstrani segment"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Dolžina (m)</Label>
                      <Input
                        type="number"
                        value={seg.lengthMm / 1000}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) * 1000
                          setSegments(
                            segments.map((s, idx) =>
                              idx === i ? { ...s, lengthMm: isFinite(v) ? v : 0 } : s,
                            ),
                          )
                        }}
                        step="0.1"
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Višina (mm)</Label>
                      <Input
                        type="number"
                        value={seg.heightMm}
                        onChange={(e) => {
                          const v = parseInt(e.target.value)
                          setSegments(
                            segments.map((s, idx) =>
                              idx === i ? { ...s, heightMm: isFinite(v) ? v : 0 } : s,
                            ),
                          )
                        }}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Tip</Label>
                      <Select
                        value={seg.type}
                        onValueChange={(v: 'level' | 'angled' | 'stair') => {
                          setSegments(
                            segments.map((s, idx) =>
                              idx === i
                                ? {
                                    ...s,
                                    type: v,
                                    rakeAngleDeg: v === 'level' ? undefined : s.rakeAngleDeg ?? 35,
                                  }
                                : s,
                            ),
                          )
                        }}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="level">Ravno</SelectItem>
                          <SelectItem value="angled">Koso</SelectItem>
                          <SelectItem value="stair">Stopnišče</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {(seg.type === 'angled' || seg.type === 'stair') && (
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Kot stopnice (°)</Label>
                      <Input
                        type="number"
                        value={seg.rakeAngleDeg ?? 35}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value)
                          setSegments(
                            segments.map((s, idx) =>
                              idx === i ? { ...s, rakeAngleDeg: isFinite(v) ? v : 0 } : s,
                            ),
                          )
                        }}
                        className="h-9 text-xs"
                      />
                    </div>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-9 border-dashed border-roksal-navy/30 text-roksal-navy hover:bg-roksal-navy/5"
                onClick={() => {
                  setSegments([
                    ...segments,
                    { lengthMm: 3000, heightMm: 1100, type: 'level' },
                  ])
                }}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Dodaj segment
              </Button>
            </CardContent>
          </Card>

          {/* Profile selector */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-roksal-navy">
                Profil materiala
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {profili.length === 0 ? (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  Nalagam profile...
                </div>
              ) : (
                <Select
                  value={selectedProfileSifra}
                  onValueChange={setSelectedProfileSifra}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {profili.map((p) => (
                      <SelectItem key={p.sifra} value={p.sifra}>
                        {p.naziv} — {p.sifra} ({p.cenaM.toFixed(2)} €/m)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedProfileSifra && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Cena profila:{' '}
                  <span className="font-medium text-roksal-navy">
                    {profili.find((p) => p.sifra === selectedProfileSifra)?.cenaM.toFixed(2)} €/m
                  </span>
                </p>
              )}
            </CardContent>
          </Card>

          {/* P2: Strošek dela */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                <Users className="h-4 w-4 text-roksal-amber" />
                Strošek dela
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="urnaPostavka" className="text-xs">Urna postavka (EUR/h)</Label>
                  <Input
                    id="urnaPostavka"
                    type="number"
                    value={urnaPostavka}
                    onChange={(e) => setUrnaPostavka(e.target.value)}
                    placeholder="35"
                    step="0.5"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="stUr" className="text-xs">Število ur</Label>
                  <Input
                    id="stUr"
                    type="number"
                    value={stUr}
                    onChange={(e) => setStUr(e.target.value)}
                    placeholder="8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="stMonterjev" className="text-xs">Število monterjev</Label>
                  <Input
                    id="stMonterjev"
                    type="number"
                    value={stMonterjev}
                    onChange={(e) => setStMonterjev(e.target.value)}
                    placeholder="2"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="transport" className="text-xs">Transport (EUR)</Label>
                  <Input
                    id="transport"
                    type="number"
                    value={transport}
                    onChange={(e) => setTransport(e.target.value)}
                    placeholder="50"
                  />
                </div>
              </div>
              <div className="rounded-lg bg-roksal-navy/5 p-2.5 text-[11px] text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Timer className="h-3 w-3 text-roksal-navy" />
                    Predvideni čas montaže
                  </span>
                  <span className="font-medium text-roksal-navy">
                    {(parseFloat(stUr) || 0) * (parseFloat(stMonterjev) || 0)} ur ({(parseFloat(stUr) || 0)}h × {(parseFloat(stMonterjev) || 0)} monterjev)
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* P2: Rezerva + DDV + Akontacija */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                <Wallet className="h-4 w-4 text-roksal-amber" />
                Rezerva, DDV in akontacija
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Percent className="h-3 w-3 text-roksal-amber" />
                  Rezerva materiala
                </Label>
                <Select
                  value={String(rezervaPctMaterial)}
                  onValueChange={(v) => setRezervaPctMaterial(parseFloat(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {reserveOptions.map((r) => (
                      <SelectItem key={r} value={String(r)}>
                        {r}%{r === 10 ? ' (priporočeno)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Stopnja DDV</Label>
                <Select
                  value={String(ddvPct)}
                  onValueChange={(v) => setDdvPct(parseFloat(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ddvOptions.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Wallet className="h-3 w-3 text-roksal-amber" />
                  Akontacija (ob naročilu)
                </Label>
                <Select
                  value={String(akontacijaPct)}
                  onValueChange={(v) => setAkontacijaPct(parseFloat(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {akontacijaOptions.map((a) => (
                      <SelectItem key={a} value={String(a)}>
                        {a}%{a === 0 ? ' (brez akontacije)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={handleCalculate}
              className="w-full bg-roksal-navy hover:bg-roksal-navy/90 text-white h-11"
              disabled={segments.length === 0 || !selectedProfileSifra}
            >
              <Package className="mr-2 h-4 w-4" />
              Izračunaj skupni material
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={saveTemplate}
              className="w-full h-11 border-roksal-amber/40 text-roksal-navy hover:bg-roksal-amber/10"
            >
              <BookmarkPlus className="mr-2 h-4 w-4" />
              Shrani predlogo
            </Button>
          </div>

          {materialResult && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Main totals */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="px-3 py-3 col-span-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Skupno tekoči metri profila
                  </p>
                  <p className="text-3xl font-bold text-roksal-navy">
                    {materialResult.totalLinearMeters.toFixed(2)}
                    <span className="text-sm font-normal ml-1">m</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    letve {materialResult.railLinearMeters.toFixed(2)}m + palice {materialResult.balusterLinearMeters.toFixed(2)}m
                  </p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Palice {rezervaPctMaterial > 0 ? '(z rezervo)' : ''}
                  </p>
                  <p className="text-2xl font-bold text-roksal-navy">
                    {applyReserve(materialResult.balusterCount, rezervaPctMaterial)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {rezervaPctMaterial > 0
                      ? `brez: ${materialResult.balusterCount} (+${rezervaPctMaterial}%)`
                      : 'kos'}
                  </p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Stebri {rezervaPctMaterial > 0 ? '(z rezervo)' : ''}
                  </p>
                  <p className="text-2xl font-bold text-roksal-navy">
                    {applyReserve(materialResult.postCount, rezervaPctMaterial)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">kos (×2 sidra)</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Vijaki {rezervaPctMaterial > 0 ? '(z rezervo)' : ''}
                  </p>
                  <p className="text-2xl font-bold text-roksal-navy">
                    {applyReserve(materialResult.screwCount, rezervaPctMaterial)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">kos (A4 Inox)</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Sidra {rezervaPctMaterial > 0 ? '(z rezervo)' : ''}
                  </p>
                  <p className="text-2xl font-bold text-roksal-navy">
                    {applyReserve(materialResult.anchorCount, rezervaPctMaterial)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">kos (kemična)</p>
                </Card>
              </div>

              {/* P2: Rezerva materiala info */}
              {rezervaPctMaterial > 0 && (
                <Card className="border-roksal-amber/30 bg-roksal-amber/5">
                  <CardContent className="flex items-center gap-3 p-3">
                    <Percent className="h-5 w-5 shrink-0 text-roksal-amber" />
                    <div className="text-xs flex-1">
                      <p className="font-semibold text-roksal-navy">Rezerva materiala: {rezervaPctMaterial}%</p>
                      <div className="text-muted-foreground grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-1">
                        <span>Palice: {materialResult.balusterCount} → <span className="font-medium text-roksal-amber">{applyReserve(materialResult.balusterCount, rezervaPctMaterial)}</span></span>
                        <span>Stebri: {materialResult.postCount} → <span className="font-medium text-roksal-amber">{applyReserve(materialResult.postCount, rezervaPctMaterial)}</span></span>
                        <span>Vijaki: {materialResult.screwCount} → <span className="font-medium text-roksal-amber">{applyReserve(materialResult.screwCount, rezervaPctMaterial)}</span></span>
                        <span>Sidra: {materialResult.anchorCount} → <span className="font-medium text-roksal-amber">{applyReserve(materialResult.anchorCount, rezervaPctMaterial)}</span></span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Per-segment breakdown */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                    <Hammer className="h-4 w-4" />
                    Razdelitev po segmentih
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="rounded-lg border border-border/40 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">#</TableHead>
                          <TableHead className="text-xs">Tip</TableHead>
                          <TableHead className="text-xs text-right">Dolžina</TableHead>
                          <TableHead className="text-xs text-right">Palice</TableHead>
                          <TableHead className="text-xs text-right">Stebri</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {materialResult.perSegment.map((s, i) => (
                          <TableRow key={i} className="even:bg-roksal-navy/5">
                            <TableCell className="text-xs font-semibold text-roksal-navy">{i + 1}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                                {s.type === 'level' ? 'Ravno' : s.type === 'angled' ? 'Koso' : 'Stopnišče'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono">{s.lengthM.toFixed(2)}m</TableCell>
                            <TableCell className="text-xs text-right font-mono">{s.balusterCount}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{s.postCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Cost breakdown */}
              <Card className="overflow-hidden border-l-4 border-l-roksal-amber">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                    <Euro className="h-4 w-4" />
                    Stroški materiala
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/30">
                      <span className="text-muted-foreground">
                        Profil ({materialResult.totalLinearMeters.toFixed(2)}m ×{' '}
                        {materialResult.selectedProfile?.cenaM.toFixed(2) ?? '0.00'} €/m)
                      </span>
                      <span className="font-medium text-roksal-navy">
                        {materialResult.profileCost.toFixed(2)} €
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/30">
                      <span className="text-muted-foreground">
                        Stebri ({materialResult.postCount} × 25 €)
                      </span>
                      <span className="font-medium text-roksal-navy">
                        {materialResult.postsCost.toFixed(2)} €
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/30">
                      <span className="text-muted-foreground">
                        Vijaki ({materialResult.screwCount} × 0,10 €)
                      </span>
                      <span className="font-medium text-roksal-navy">
                        {materialResult.screwsCost.toFixed(2)} €
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/30">
                      <span className="text-muted-foreground">
                        Sidra ({materialResult.anchorCount} × 1,50 €)
                      </span>
                      <span className="font-medium text-roksal-navy">
                        {materialResult.anchorsCost.toFixed(2)} €
                      </span>
                    </div>
                    <Separator className="my-1" />
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-bold text-roksal-navy text-sm">SKUPAJ MATERIAL</span>
                      <span className="font-bold text-roksal-amber text-lg">
                        {materialResult.totalCost.toFixed(2)} €
                      </span>
                    </div>
                  </div>

                  {/* P2: Strošek dela */}
                  {(() => {
                    const labor = calculateLaborCost({
                      urnaPostavka: parseFloat(urnaPostavka) || 0,
                      stUr: parseFloat(stUr) || 0,
                      stMonterjev: parseFloat(stMonterjev) || 0,
                      transport: parseFloat(transport) || 0,
                    })
                    const skupajBrezDdv = materialResult.totalCost + labor.delaSkupaj
                    const ddv = calculateDDV(skupajBrezDdv, ddvPct)
                    const akon = calculateAkontacija(ddv.total, akontacijaPct)
                    return (
                      <>
                        <Separator className="my-3" />
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold text-roksal-navy uppercase tracking-wide flex items-center gap-1.5">
                            <Users className="h-3 w-3 text-roksal-amber" />
                            Strošek dela
                          </p>
                          <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/30">
                            <span className="text-muted-foreground">
                              Delo ({labor.urnaPostavka.toFixed(2)} €/h × {labor.stUr}h × {labor.stMonterjev} monterjev)
                            </span>
                            <span className="font-medium text-roksal-navy">
                              {labor.cistaDela.toFixed(2)} €
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/30">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <Truck className="h-3 w-3" />
                              Transport
                            </span>
                            <span className="font-medium text-roksal-navy">
                              {labor.transport.toFixed(2)} €
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/30">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <Timer className="h-3 w-3" />
                              Predvideni čas montaže
                            </span>
                            <span className="font-medium text-roksal-navy">
                              {labor.predvideniCas} ur
                            </span>
                          </div>
                          <Separator className="my-1" />
                          <div className="flex items-center justify-between pt-1">
                            <span className="font-bold text-roksal-navy text-sm">SKUPAJ BREZ DDV</span>
                            <span className="font-bold text-roksal-navy text-base">
                              {skupajBrezDdv.toFixed(2)} €
                            </span>
                          </div>
                          {/* P2: DDV */}
                          <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/30">
                            <span className="text-muted-foreground">
                              DDV ({formatSI(ddvPct, 1)}%)
                            </span>
                            <span className="font-medium text-roksal-navy">
                              {ddv.ddvAmount.toFixed(2)} €
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-1 pb-1 bg-roksal-navy/5 -mx-1 px-3 rounded">
                            <span className="font-bold text-roksal-navy text-sm">SKUPAJ Z DDV</span>
                            <span className="font-bold text-roksal-amber text-xl">
                              {ddv.total.toFixed(2)} €
                            </span>
                          </div>
                        </div>

                        {/* P2: Akontacija */}
                        {akontacijaPct > 0 && (
                          <>
                            <Separator className="my-3" />
                            <div className="space-y-2">
                              <p className="text-[11px] font-semibold text-roksal-navy uppercase tracking-wide flex items-center gap-1.5">
                                <Wallet className="h-3 w-3 text-roksal-amber" />
                                Akontacija
                              </p>
                              <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/30">
                                <span className="text-muted-foreground">
                                  Akontacija ({akontacijaPct}%) — ob naročilu
                                </span>
                                <span className="font-medium text-roksal-amber">
                                  {akon.akontacija.toFixed(2)} €
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/30">
                                <span className="text-muted-foreground">
                                  Preostanek ({100 - akontacijaPct}%) — ob prevzemu
                                </span>
                                <span className="font-medium text-roksal-navy">
                                  {akon.preostanek.toFixed(2)} €
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-xs py-1.5 text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                  <Calendar className="h-3 w-3" />
                                  Predvideni datum plačila akontacije
                                </span>
                                <span className="font-medium text-roksal-navy">
                                  {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('sl-SI')}
                                </span>
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )
                  })()}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full mt-3 h-9 border-roksal-navy/30 text-roksal-navy hover:bg-roksal-navy/5"
                    onClick={exportMaterialPdf}
                  >
                    <FileDown className="mr-1.5 h-3.5 w-3.5" />
                    Izvozi materialni list PDF
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* ===== COMPLIANCE (PREDPISI) CALCULATOR ===== */}
      {mode === 'compliance' && (
        <>
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                <ShieldCheck className="h-4 w-4" />
                Preverjanje skladnosti s predpisi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="compGap" className="text-xs">
                    Razmik med palicami (mm)
                  </Label>
                  <Input
                    id="compGap"
                    type="number"
                    value={compGap}
                    onChange={(e) => setCompGap(e.target.value)}
                    placeholder="90"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="compHeight" className="text-xs">
                    Višina ograje (mm)
                  </Label>
                  <Input
                    id="compHeight"
                    type="number"
                    value={compHeight}
                    onChange={(e) => setCompHeight(e.target.value)}
                    placeholder="1100"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="compPostSpacing" className="text-xs">
                    Razmik stebrov (mm)
                  </Label>
                  <Input
                    id="compPostSpacing"
                    type="number"
                    value={compPostSpacing}
                    onChange={(e) => setCompPostSpacing(e.target.value)}
                    placeholder="1500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="compDropHeight" className="text-xs">
                    Padec pod ograjo (mm)
                  </Label>
                  <Input
                    id="compDropHeight"
                    type="number"
                    value={compDropHeight}
                    onChange={(e) => setCompDropHeight(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Kategorija obremenitve</Label>
                <Select
                  value={compLoadCategory}
                  onValueChange={(v: 'A' | 'B' | 'C') => setCompLoadCategory(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A — Stanovanjsko (0,74 kN/m)</SelectItem>
                    <SelectItem value="B">B — Javno (1,0 kN/m)</SelectItem>
                    <SelectItem value="C">C — Intenzivno javno (1,5 kN/m)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={handleCalculate}
              className="w-full bg-roksal-navy hover:bg-roksal-navy/90 text-white h-11"
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Preveri skladnost
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={saveTemplate}
              className="w-full h-11 border-roksal-amber/40 text-roksal-navy hover:bg-roksal-amber/10"
            >
              <BookmarkPlus className="mr-2 h-4 w-4" />
              Shrani predlogo
            </Button>
          </div>

          {complianceResult && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <Card
                className={`overflow-hidden border-l-4 ${
                  complianceResult.passed
                    ? 'border-l-roksal-green bg-roksal-green/5'
                    : 'border-l-roksal-red bg-roksal-red/5'
                }`}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  {complianceResult.passed ? (
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-roksal-green" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 shrink-0 text-roksal-red" />
                  )}
                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        complianceResult.passed ? 'text-roksal-green' : 'text-roksal-red'
                      }`}
                    >
                      {complianceResult.passed
                        ? 'VSE PREVERBE USPEŠNE'
                        : 'NESKLADNO — potrebne popravke!'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {complianceResult.checks.filter((c) => c.passed).length}/
                      {complianceResult.checks.length} preverb uspešnih
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold text-roksal-navy">
                    Podrobne preverbe
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {complianceResult.checks.map((check, i) => (
                    <div
                      key={i}
                      className={`rounded-lg border p-3 ${
                        check.passed
                          ? 'border-roksal-green/30 bg-roksal-green/5'
                          : 'border-roksal-red/30 bg-roksal-red/5'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {check.passed ? (
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-roksal-green mt-0.5" />
                        ) : (
                          <X className="h-5 w-5 shrink-0 text-roksal-red mt-0.5" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-roksal-navy">{check.name}</p>
                          <div className="mt-1 grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-muted-foreground">Zahtevano: </span>
                              <span className="font-medium text-foreground">{check.required}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Dejansko: </span>
                              <span className="font-medium text-foreground">{check.actual}</span>
                            </div>
                          </div>
                          <p className="mt-1.5 text-[11px] text-muted-foreground">{check.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-roksal-navy/5">
                <CardContent className="flex gap-3 p-4">
                  <Info className="h-5 w-5 shrink-0 text-roksal-navy" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-roksal-navy">
                      Sklic predpisov
                    </p>
                    <p className="mt-1">
                      SIST EN 1264 (razmik ≤ 110mm), SIST EN 13485 (višina ograj),
                      EVS EN 1991-1-1 (horizontalna obremenitev). Za objekte z javnim
                      dostopom veljajo strožji kriteriji — obvezno posvetovanje s statikom.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* ===== CNC REZ CALCULATOR ===== */}
      {mode === 'cnc' && (
        <>
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                <Scissors className="h-4 w-4" />
                CNC razrezni načrt — 1D bin packing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Dolžina profila</Label>
                  <Select
                    value={cncStockPreset}
                    onValueChange={(v) => {
                      setCncStockPreset(v)
                      if (v !== 'custom') setCncStockLength(v)
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6000">6000mm (aluminij)</SelectItem>
                      <SelectItem value="4000">4000mm (WPC dolg)</SelectItem>
                      <SelectItem value="2200">2200mm (WPC standard)</SelectItem>
                      <SelectItem value="custom">Po meri</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cncStockLength" className="text-xs">Dolžina (mm)</Label>
                  <Input
                    id="cncStockLength"
                    type="number"
                    value={cncStockLength}
                    onChange={(e) => {
                      setCncStockLength(e.target.value)
                      setCncStockPreset('custom')
                    }}
                    placeholder="6000"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cncSawBlade" className="text-xs">Širina reza (mm) — žagin disk</Label>
                <Input
                  id="cncSawBlade"
                  type="number"
                  value={cncSawBlade}
                  onChange={(e) => setCncSawBlade(e.target.value)}
                  placeholder="3"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                  <AlignJustify className="h-4 w-4" />
                  Zahtevani odseki
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{cncSegments.length}</Badge>
                </CardTitle>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[10px] border-roksal-amber/40 text-roksal-navy hover:bg-roksal-amber/10"
                    onClick={() => {
                      // Uvozi iz materiala — uporabi trenutne segments iz material mode
                      if (segments.length === 0) {
                        toast.error('V načinu "Skupni material" najprej dodajte segmente.')
                        return
                      }
                      const newSegs: CncSegment[] = segments.map((s) => ({
                        lengthMm: String(s.lengthMm),
                        count: '1',
                        label: s.type === 'angled' ? `Kos (kot ${s.rakeAngleDeg ?? 0}°)` : s.type === 'stair' ? 'Stopnišče' : 'Letev',
                      }))
                      setCncSegments(newSegs)
                      toast.success(`Uvoženo ${newSegs.length} odsekov iz materiala`)
                    }}
                  >
                    <ArrowDownToLine className="mr-1 h-3 w-3" />
                    Uvozi iz materiala
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[10px]"
                    onClick={() => setCncSegments([...cncSegments, { lengthMm: '', count: '1', label: '' }])}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Dodaj
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
                {cncSegments.map((seg, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-1.5 items-end rounded-lg border border-border/50 p-2">
                    <div className="col-span-4 space-y-1">
                      <Label className="text-[9px] text-muted-foreground">Labela</Label>
                      <Input
                        type="text"
                        value={seg.label}
                        onChange={(e) => {
                          const copy = [...cncSegments]
                          copy[idx] = { ...copy[idx], label: e.target.value }
                          setCncSegments(copy)
                        }}
                        placeholder="npr. Zgornja letev"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-[9px] text-muted-foreground">Dolžina (mm)</Label>
                      <Input
                        type="number"
                        value={seg.lengthMm}
                        onChange={(e) => {
                          const copy = [...cncSegments]
                          copy[idx] = { ...copy[idx], lengthMm: e.target.value }
                          setCncSegments(copy)
                        }}
                        placeholder="2500"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-[9px] text-muted-foreground">Število</Label>
                      <Input
                        type="number"
                        value={seg.count}
                        onChange={(e) => {
                          const copy = [...cncSegments]
                          copy[idx] = { ...copy[idx], count: e.target.value }
                          setCncSegments(copy)
                        }}
                        placeholder="2"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setCncSegments(cncSegments.filter((_, i) => i !== idx))}
                        className="p-1.5 rounded-md text-roksal-red hover:bg-roksal-red/10 transition-colors"
                        aria-label="Odstrani odsek"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {cncSegments.length === 0 && (
                  <div className="text-center py-4 text-xs text-muted-foreground">
                    Dodajte odseke za rezanje ali uvozite iz materiala.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={handleCalculate}
              className="w-full bg-roksal-navy hover:bg-roksal-navy/90 text-white h-11"
            >
              <Scissors className="mr-2 h-4 w-4" />
              Izračunaj razrez
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={exportCncPdf}
              disabled={!cncResult}
              className="w-full h-11 border-roksal-amber/40 text-roksal-navy hover:bg-roksal-amber/10 disabled:opacity-40"
            >
              <FileDown className="mr-2 h-4 w-4" />
              Izvozi PDF
            </Button>
          </div>

          {cncResult && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Profilov</p>
                  <p className="text-2xl font-bold text-roksal-navy">{cncResult.stockCount}</p>
                  <p className="text-[10px] text-muted-foreground">kos × {cncStockLength}mm</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Izkoristek</p>
                  <p className="text-2xl font-bold text-roksal-green">{cncResult.overallUtilizationPct.toFixed(1)}<span className="text-sm font-normal ml-0.5">%</span></p>
                  <p className="text-[10px] text-muted-foreground">{(cncResult.totalRequiredMm / 1000).toFixed(2)}m / {(cncResult.totalStockMm / 1000).toFixed(2)}m</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ostanek</p>
                  <p className="text-2xl font-bold text-roksal-amber">{cncResult.totalWasteMm}<span className="text-sm font-normal ml-0.5">mm</span></p>
                  <p className="text-[10px] text-muted-foreground">{(cncResult.totalWasteMm / 1000).toFixed(2)}m</p>
                </Card>
              </div>

              {/* Warnings */}
              {cncResult.warnings.length > 0 && (
                <Card className="border-roksal-amber/30">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-amber">
                      <AlertTriangle className="h-4 w-4" />
                      Opozorila
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <ul className="space-y-1.5">
                      {cncResult.warnings.map((w, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-roksal-amber" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Razrezni načrt — visual */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                    <Scissors className="h-4 w-4" />
                    Razrezni načrt (vizualno)
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  {cncResult.plans.map((plan) => {
                    const stockLen = parseFloat(cncStockLength) || 1
                    const colors = ['#1d2b3e', '#f59e0b', '#22c55e', '#0ea5e9', '#a855f7', '#ef4444', '#14b8a6', '#f97316']
                    let cursor = 0
                    return (
                      <div key={plan.stockIndex} className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-mono font-semibold text-roksal-navy">Profil #{plan.stockIndex}</span>
                          <span className="text-muted-foreground">
                            {plan.cuts.length} rezov · ostanek {plan.remainingMm}mm · izkoristek {plan.utilizationPct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex h-6 rounded-md overflow-hidden border border-border">
                          {plan.cuts.map((c, ci) => {
                            const widthPct = (c.lengthMm / stockLen) * 100
                            cursor += c.lengthMm + (parseFloat(cncSawBlade) || 3)
                            const color = colors[c.fromSegmentIndex % colors.length]
                            return (
                              <div
                                key={ci}
                                className="h-full flex items-center justify-center text-[8px] font-mono text-white"
                                style={{ width: `${widthPct}%`, backgroundColor: color }}
                                title={`${c.label || 'Odsek'}: ${c.lengthMm}mm`}
                              >
                                {widthPct > 8 ? c.lengthMm : ''}
                              </div>
                            )
                          })}
                          {plan.remainingMm > 0 && (
                            <div
                              className="h-full bg-muted border-l border-dashed border-border flex items-center justify-center text-[8px] text-muted-foreground"
                              style={{ width: `${(plan.remainingMm / stockLen) * 100}%` }}
                            >
                              {plan.remainingMm > 50 ? `${plan.remainingMm}` : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/30">
                    {Array.from(new Set(cncResult.plans.flatMap(p => p.cuts.map(c => c.fromSegmentIndex)))).map((idx) => {
                      const seg = cncSegments[idx]
                      const colors = ['#1d2b3e', '#f59e0b', '#22c55e', '#0ea5e9', '#a855f7', '#ef4444', '#14b8a6', '#f97316']
                      return (
                        <span key={idx} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colors[idx % colors.length] }} />
                          {seg?.label || `Odsek ${idx + 1}`} ({seg?.lengthMm}mm × {seg?.count})
                        </span>
                      )
                    })}
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span className="inline-block h-2.5 w-3 rounded-sm bg-muted border border-dashed border-border" />
                      Ostanek
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Tabela razreza */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                    <AlignJustify className="h-4 w-4" />
                    Tabela razreza
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="overflow-x-auto scrollbar-thin">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px]">Profil</TableHead>
                          <TableHead className="text-[10px]">Rezi</TableHead>
                          <TableHead className="text-[10px] text-right">Ostanek</TableHead>
                          <TableHead className="text-[10px] text-right">Izkoristek</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cncResult.plans.map((plan) => (
                          <TableRow key={plan.stockIndex}>
                            <TableCell className="text-xs font-mono font-semibold text-roksal-navy">#{plan.stockIndex}</TableCell>
                            <TableCell className="text-xs">
                              {plan.cuts.map((c, i) => (
                                <span key={i} className="inline-block mr-1 mb-0.5 px-1.5 py-0.5 rounded bg-secondary text-[10px] font-mono">
                                  {c.lengthMm}mm{c.label ? ` · ${c.label}` : ''}
                                </span>
                              ))}
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono text-roksal-amber">{plan.remainingMm}mm</TableCell>
                            <TableCell className="text-xs text-right font-mono font-semibold">{plan.utilizationPct.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* ===== VETER PO LOKACIJI CALCULATOR ===== */}
      {mode === 'windLocation' && (
        <>
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                <MapPin className="h-4 w-4" />
                Lokacija
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="windLocLat" className="text-xs">Latitude (°N)</Label>
                  <Input
                    id="windLocLat"
                    type="number"
                    value={windLocLat}
                    onChange={(e) => setWindLocLat(e.target.value)}
                    placeholder="46.2389"
                    step="0.0001"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="windLocLon" className="text-xs">Longitude (°E)</Label>
                  <Input
                    id="windLocLon"
                    type="number"
                    value={windLocLon}
                    onChange={(e) => setWindLocLon(e.target.value)}
                    placeholder="14.3556"
                    step="0.0001"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full border-roksal-amber/40 text-roksal-navy hover:bg-roksal-amber/10 h-10"
                onClick={() => {
                  if (typeof navigator === 'undefined' || !navigator.geolocation) {
                    toast.error('Geolokacija ni podprta v tem brskalniku.')
                    return
                  }
                  setWindLocLoading(true)
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      setWindLocLat(pos.coords.latitude.toFixed(4))
                      setWindLocLon(pos.coords.longitude.toFixed(4))
                      setWindLocLoading(false)
                      toast.success(`Lokacija pridobljena: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`)
                    },
                    (err) => {
                      setWindLocLoading(false)
                      const msg = err.code === err.PERMISSION_DENIED
                        ? 'Dostop do lokacije zavrnjen. Vnesite GPS ročno.'
                        : err.code === err.POSITION_UNAVAILABLE
                        ? 'Lokacija ni na voljo.'
                        : err.code === err.TIMEOUT
                        ? 'Časovna omejitev za lokacijo potekla.'
                        : 'Napaka pri pridobivanju lokacije.'
                      toast.error(msg)
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
                  )
                }}
                disabled={windLocLoading}
              >
                {windLocLoading ? (
                  <>
                    <Crosshair className="mr-2 h-4 w-4 animate-spin" />
                    Pridobivanje...
                  </>
                ) : (
                  <>
                    <Navigation className="mr-2 h-4 w-4" />
                    Uporabi mojo lokacijo
                  </>
                )}
              </Button>
              <p className="text-[10px] text-muted-foreground text-center">
                Privzeto: Kranj (46,2389°N, 14,3556°E)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-roksal-navy">
                Parametri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="windLocHeight" className="text-xs">Višina nad tlemi (m)</Label>
                  <Input
                    id="windLocHeight"
                    type="number"
                    value={windLocHeight}
                    onChange={(e) => setWindLocHeight(e.target.value)}
                    placeholder="10"
                    step="0.5"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="windLocArea" className="text-xs">Površina ograje (m²)</Label>
                  <Input
                    id="windLocArea"
                    type="number"
                    value={windLocArea}
                    onChange={(e) => setWindLocArea(e.target.value)}
                    placeholder="6"
                    step="0.5"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Kategorija terena</Label>
                <Select
                  value={windLocTerrain}
                  onValueChange={(v) => setWindLocTerrain(v as TerrainCategory)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="I">I — Odprto morje, jezera</SelectItem>
                    <SelectItem value="II">II — Ravninsko, nizka vegetacija</SelectItem>
                    <SelectItem value="III">III — Primestno, gozdovi</SelectItem>
                    <SelectItem value="IV">IV — Urbano, visoke stavbe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tip ograje</Label>
                <Select
                  value={windLocType}
                  onValueChange={(v) => setWindLocType(v as RailingType)}
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
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={handleCalculate}
              className="w-full bg-roksal-navy hover:bg-roksal-navy/90 text-white h-11"
            >
              <Wind className="mr-2 h-4 w-4" />
              Izračunaj vetrno obremenitev
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={exportWindLocPdf}
              disabled={!windLocResult}
              className="w-full h-11 border-roksal-amber/40 text-roksal-navy hover:bg-roksal-amber/10 disabled:opacity-40"
            >
              <FileDown className="mr-2 h-4 w-4" />
              Izvozi PDF
            </Button>
          </div>

          {windLocResult && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Location & Risk badge */}
              <Card className={`overflow-hidden border ${riskColors[windLocResult.riskLevel]}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Lokacija</p>
                      <p className="text-sm font-bold text-roksal-navy truncate">{windLocResult.locationDescription}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {windLocLat}°N, {windLocLon}°E
                      </p>
                    </div>
                    <Badge className={`${riskColors[windLocResult.riskLevel]} border`}>
                      {riskLabels[windLocResult.riskLevel]}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Wind zone visual + key stats */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="px-3 py-3 flex items-center gap-3">
                  {windLocResult.windZone === 3 ? (
                    <Mountain className="h-8 w-8 text-roksal-amber shrink-0" />
                  ) : windLocResult.windZone === 2 ? (
                    <Wind className="h-8 w-8 text-roksal-amber shrink-0" />
                  ) : (
                    <MapPin className="h-8 w-8 text-roksal-green shrink-0" />
                  )}
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Vetrna cona</p>
                    <p className="text-2xl font-bold text-roksal-navy">{windLocResult.windZone}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {windLocResult.windZone === 3 ? 'gore' : windLocResult.windZone === 2 ? 'obala' : 'celina'}
                    </p>
                  </div>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Osnovna hitrost</p>
                  <p className="text-2xl font-bold text-roksal-navy">{windLocResult.basicWindSpeedMs}<span className="text-sm font-normal ml-0.5">m/s</span></p>
                  <p className="text-[10px] text-muted-foreground">{windLocResult.basicPressureKpa.toFixed(3)} kPa</p>
                </Card>
              </div>

              {/* Main results */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Vrhnji tlak</p>
                  <p className="text-xl font-bold text-roksal-navy">{windLocResult.designPressureKpa.toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground">kPa</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Skupna sila</p>
                  <p className="text-xl font-bold text-roksal-navy">{windLocResult.totalForceKn.toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground">kN</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sila/m</p>
                  <p className="text-xl font-bold text-roksal-navy">{windLocResult.forcePerMeterNm.toFixed(0)}</p>
                  <p className="text-[10px] text-muted-foreground">N/m</p>
                </Card>
              </div>

              {/* Slovenia map SVG */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                    <MapPin className="h-4 w-4" />
                    Karta vetrnih con Slovenije
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <SloveniaWindMapSvg
                    lat={parseFloat(windLocLat) || 46.2}
                    lon={parseFloat(windLocLon) || 14.5}
                    windZone={windLocResult.windZone}
                  />
                </CardContent>
              </Card>

              {/* Recommendations */}
              {windLocResult.recommendations.length > 0 && (
                <Card className="border-roksal-amber/30">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-amber">
                      <Info className="h-4 w-4" />
                      Priporočila
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <ul className="space-y-1.5">
                      {windLocResult.recommendations.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-roksal-amber" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-roksal-navy/5">
                <CardContent className="flex gap-3 p-4">
                  <Info className="h-5 w-5 shrink-0 text-roksal-navy" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-roksal-navy">
                      SIST EN 1991-1-4 NA (Slovenija)
                    </p>
                    <p className="mt-1">
                      Vetrne cone Slovenije: cona 1 (celina — 22 m/s), cona 2 (obala — 24 m/s),
                      cona 3 (gore &gt; 1000 m — 28 m/s). Izračun vključuje terenski faktor,
                      višinski faktor in aerodinamični koeficient. Za natančno določitev cone
                      uporabite uradno kartno podlago ZGS.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* ===== STEKLENA BALUSTRADA CALCULATOR ===== */}
      {mode === 'glass' && (
        <>
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                <Square className="h-4 w-4" />
                Steklena balustrada — poenostavljena metoda
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="glassSpan" className="text-xs">Razpon med stebri (mm)</Label>
                  <Input
                    id="glassSpan"
                    type="number"
                    value={String(glassInput.spanMm)}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      setGlassInput({ ...glassInput, spanMm: isFinite(v) ? v : 0 })
                    }}
                    placeholder="1200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="glassHeight" className="text-xs">Višina stekla (mm)</Label>
                  <Input
                    id="glassHeight"
                    type="number"
                    value={String(glassInput.heightMm)}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      setGlassInput({ ...glassInput, heightMm: isFinite(v) ? v : 0 })
                    }}
                    placeholder="1100"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Horizontalna obremenitev (kN/m)</Label>
                <Select
                  value={String(glassInput.loadKnPerM)}
                  onValueChange={(v) => setGlassInput({ ...glassInput, loadKnPerM: parseFloat(v) })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1.0">1,0 kN/m — Stanovanjske</SelectItem>
                    <SelectItem value="1.5">1,5 kN/m — Javne</SelectItem>
                    <SelectItem value="2.0">2,0 kN/m — Balkon &gt; 1m padec</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tip stekla</Label>
                <Select
                  value={glassInput.glassType}
                  onValueChange={(v) => setGlassInput({ ...glassInput, glassType: v as GlassType })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Enojno (float) — 40 MPa</SelectItem>
                    <SelectItem value="laminated">Laminirano (VSG) — 50 MPa</SelectItem>
                    <SelectItem value="tempered">Kaljeno (ESG) — 120 MPa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={handleCalculate}
              className="w-full bg-roksal-navy hover:bg-roksal-navy/90 text-white h-11"
            >
              <Square className="mr-2 h-4 w-4" />
              Izračunaj steklo
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={exportGlassPdf}
              disabled={!glassResult}
              className="w-full h-11 border-roksal-amber/40 text-roksal-navy hover:bg-roksal-amber/10 disabled:opacity-40"
            >
              <FileDown className="mr-2 h-4 w-4" />
              Izvozi PDF
            </Button>
          </div>

          {glassResult && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Recommended thickness */}
              <Card className={`overflow-hidden border-l-4 ${glassResult.isSafe ? 'border-l-roksal-green bg-roksal-green/5' : 'border-l-roksal-red bg-roksal-red/5'}`}>
                <CardContent className="flex items-center gap-3 p-4">
                  {glassResult.isSafe ? (
                    <CheckCircle2 className="h-8 w-8 shrink-0 text-roksal-green" />
                  ) : (
                    <AlertTriangle className="h-8 w-8 shrink-0 text-roksal-red" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Priporočena debelina</p>
                    <p className="text-3xl font-bold text-roksal-navy">
                      {glassResult.recommendedThicknessMm}<span className="text-base font-normal ml-1">mm</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {glassResult.layers
                        ? `Laminirano: 2× ${glassResult.recommendedThicknessMm / 2}mm + PVB`
                        : glassInput.glassType === 'tempered'
                        ? 'Kaljeno steklo (ESG)'
                        : 'Enojno steklo (float)'}
                    </p>
                  </div>
                  <Badge className={`${glassResult.isSafe ? 'bg-roksal-green/15 text-roksal-green border-roksal-green/30' : 'bg-roksal-red/15 text-roksal-red border-roksal-red/30'} border`}>
                    {glassResult.isSafe ? 'VARNO' : 'NEVARNO'}
                  </Badge>
                </CardContent>
              </Card>

              {/* Stress stats */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Napetost</p>
                  <p className="text-xl font-bold text-roksal-navy">{glassResult.stressMpa.toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground">MPa</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Dovoljena</p>
                  <p className="text-xl font-bold text-roksal-navy">{glassResult.allowableStressMpa}</p>
                  <p className="text-[10px] text-muted-foreground">MPa</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Max razpon</p>
                  <p className="text-xl font-bold text-roksal-navy">{glassResult.maxSpanForThicknessMm}</p>
                  <p className="text-[10px] text-muted-foreground">mm</p>
                </Card>
              </div>

              {/* Glass layers SVG (only for laminated) */}
              {glassResult.layers === 2 && (
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                      <Layers className="h-4 w-4" />
                      Plasti laminiranega stekla
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <GlassLayersSvg
                      totalMm={glassResult.recommendedThicknessMm}
                      baseMm={glassResult.recommendedThicknessMm / 2}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Alternative thicknesses table */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                    <AlignJustify className="h-4 w-4" />
                    Alternativne debeline
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="overflow-x-auto scrollbar-thin">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px]">Debelina</TableHead>
                          <TableHead className="text-[10px]">Status</TableHead>
                          <TableHead className="text-[10px]">Razlog</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {glassResult.alternativeThicknesses.map((a) => (
                          <TableRow key={a.mm}>
                            <TableCell className="text-xs font-mono font-semibold">{a.mm}mm</TableCell>
                            <TableCell>
                              {a.safe ? (
                                <Badge className="bg-roksal-green/15 text-roksal-green border-roksal-green/30 border text-[9px]">VARNO</Badge>
                              ) : (
                                <Badge className="bg-roksal-amber/15 text-roksal-navy border-roksal-amber/30 border text-[9px]">Tveganje</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-[10px] text-muted-foreground">{a.reason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Warnings */}
              {glassResult.warnings.length > 0 && (
                <Card className="border-roksal-amber/30">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-amber">
                      <AlertTriangle className="h-4 w-4" />
                      Opozorila
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <ul className="space-y-1.5">
                      {glassResult.warnings.map((w, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-roksal-amber" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Recommendations */}
              {glassResult.recommendations.length > 0 && (
                <Card className="border-roksal-navy/20">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                      <Info className="h-4 w-4" />
                      Priporočila
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <ul className="space-y-1.5">
                      {glassResult.recommendations.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-roksal-green" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-roksal-navy/5">
                <CardContent className="flex gap-3 p-4">
                  <Info className="h-5 w-5 shrink-0 text-roksal-navy" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-roksal-navy">
                      Poenostavljena metoda (SIST EN)
                    </p>
                    <p className="mt-1">
                      Napetost ≈ (obremenitev × razpon² × 6) / (debelina² × 8). Dovoljene napetosti:
                      enojno 40 MPa, laminirano (VSG) 50 MPa, kaljeno (ESG) 120 MPa. Za končno
                      dimenzioniranje je obvezna statična analiza z certifikatom proizvajalca stekla.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Save Calculation Button */}
      {(railingResult || anchoringResult || windResult || balusterResult || angledResult || materialResult || complianceResult || cncResult || windLocResult || glassResult) && (
        <Button
          type="button"
          onClick={() => {
            const modeLabelMap: Record<CalcMode, string> = {
              railing: 'Razmiki letev',
              anchoring: 'Kemično sidranje',
              wind: 'Vetrna obremenitev',
              baluster: 'Razmak palic',
              angled: 'Kotni izračun',
              material: 'Skupni material',
              compliance: 'Predpisi',
              cnc: 'CNC rez',
              windLocation: 'Veter po lokaciji',
              glass: 'Steklena balustrada',
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
            } else if (mode === 'baluster' && balusterResult) {
              keyResult = `${balusterResult.balusterCount} palic, razmik ${balusterResult.actualGapMm.toFixed(1)}mm`
              inputs = { balTotalLength, balWidth, balMaxGap, balPostSpacing }
            } else if (mode === 'angled' && angledResult) {
              keyResult = `${angledResult.balusterCount} palic, rake ${(angledResult.rakeLengthMm / 1000).toFixed(2)}m, kot ${angledResult.rakeAngleDeg.toFixed(1)}°`
              inputs = { angHorizontalLength, angRakeAngle, angWidth, angMaxGap }
            } else if (mode === 'material' && materialResult) {
              keyResult = `${materialResult.totalLinearMeters.toFixed(2)}m profila, ${materialResult.balusterCount} palic, ${materialResult.totalCost.toFixed(2)}€`
              inputs = { profileSifra: selectedProfileSifra, segments: JSON.stringify(segments) }
            } else if (mode === 'compliance' && complianceResult) {
              const ok = complianceResult.checks.filter((c) => c.passed).length
              keyResult = `${ok}/${complianceResult.checks.length} preverb uspešnih`
              inputs = { compGap, compHeight, compPostSpacing, compLoadCategory, compDropHeight }
            } else if (mode === 'cnc' && cncResult) {
              keyResult = `${cncResult.stockCount} profilov, izkoristek ${cncResult.overallUtilizationPct.toFixed(1)}%`
              inputs = { cncStockLength: String(cncStockLength), cncSawBlade: String(cncSawBlade), cncSegments: JSON.stringify(cncSegments) }
            } else if (mode === 'windLocation' && windLocResult) {
              keyResult = `${windLocResult.locationDescription}, ${riskLabels[windLocResult.riskLevel]}`
              inputs = { windLocLat: String(windLocLat), windLocLon: String(windLocLon), windLocHeight: String(windLocHeight), windLocTerrain: windLocTerrain, windLocArea: String(windLocArea), windLocType: windLocType }
            } else if (mode === 'glass' && glassResult) {
              keyResult = `${glassResult.recommendedThicknessMm}mm ${glassResult.isSafe ? 'VARNO' : 'NEVARNO'}`
              inputs = { glassSpan: String(glassInput.spanMm), glassHeight: String(glassInput.heightMm), glassLoad: String(glassInput.loadKnPerM), glassType: glassInput.glassType }
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

      {/* P2: Zgodovina izračunov (collapsible) */}
      <Card>
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm font-semibold text-roksal-navy hover:opacity-80 transition-opacity"
                >
                  <History className="h-4 w-4 text-roksal-amber" />
                  Zgodovina izračunov
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{history.length}</Badge>
                  {historyOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              </CollapsibleTrigger>
              {history.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[10px] text-roksal-navy hover:text-roksal-navy hover:bg-roksal-navy/5"
                    onClick={exportHistoryCsv}
                  >
                    <FileSpreadsheet className="mr-1 h-3 w-3" />
                    Izvozi CSV
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[10px] text-roksal-red hover:text-roksal-red hover:bg-roksal-red/10"
                    onClick={clearHistory}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Počisti
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="px-4 pb-4">
              {history.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>Zgodovina je prazna.</p>
                  <p className="text-[10px] mt-1">Kliknite "Izračunaj" v kateremkoli načinu, da se izračun samodejno shrani.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
                  {history.map((entry) => {
                    const Icon = historyModeIcon[entry.mode]
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => loadFromHistory(entry)}
                        className="flex w-full items-start gap-3 rounded-lg border border-border/50 p-3 transition-colors hover:bg-secondary/30 hover:border-roksal-navy/30 text-left"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-roksal-navy/10">
                          <Icon className="h-4 w-4 text-roksal-navy" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-roksal-navy/5 border-roksal-navy/20 text-roksal-navy">
                              {entry.modeLabel}
                            </Badge>
                            <span className="text-[9px] text-muted-foreground">
                              {new Date(entry.timestamp).toLocaleString('sl-SI', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {entry.projectName && (
                              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-roksal-amber/10 text-roksal-amber border-roksal-amber/20">
                                {entry.projectName}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-xs font-medium text-roksal-navy">
                            {entry.keyResult}
                          </p>
                        </div>
                        <RotateCcw className="h-3.5 w-3.5 shrink-0 text-muted-foreground ml-2 mt-1" />
                      </button>
                    )
                  })}
                </div>
              )}
              {history.length > 0 && (
                <p className="mt-2 text-[10px] text-muted-foreground text-center">
                  Prikaže se zadnjih {history.length} {history.length === 1 ? 'izračun' : history.length < 5 ? 'izračune' : 'izračunov'} (max 30).
                </p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  )
}

// ============================================
// SVG: Baluster diagram (enakomeren razmak)
// ============================================
function BalusterSvg({
  totalLengthMm,
  balusterWidthMm,
  positions,
  gapMm,
  count,
}: {
  totalLengthMm: number
  balusterWidthMm: number
  positions: number[]
  gapMm: number
  count: number
}) {
  if (totalLengthMm <= 0 || positions.length === 0) {
    return (
      <div className="text-center py-4 text-xs text-muted-foreground">
        Ni podatkov za vizualizacijo.
      </div>
    )
  }

  // SVG dimensions
  const vbW = 1000
  const vbH = 180
  const railTopY = 40
  const railBotY = 130
  const railHeight = 8
  const scale = vbW / totalLengthMm

  // Limit display to avoid overdraw
  const maxDisplay = 60
  const displayPositions = positions.slice(0, maxDisplay)
  const truncated = positions.length > maxDisplay

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Vizualizacija ograje: ${count} palic, razmik ${gapMm.toFixed(1)}mm`}
      >
        {/* Background grid */}
        <defs>
          <pattern id="balGrid" width="50" height="20" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={vbW} height={vbH} fill="url(#balGrid)" />

        {/* Top rail */}
        <rect x="0" y={railTopY - railHeight / 2} width={vbW} height={railHeight} fill="#1d2b3e" />
        {/* Bottom rail */}
        <rect x="0" y={railBotY - railHeight / 2} width={vbW} height={railHeight} fill="#1d2b3e" />

        {/* Left post */}
        <rect x="0" y={railTopY - 12} width="10" height={railBotY - railTopY + 24} fill="#f59e0b" rx="2" />
        {/* Right post */}
        <rect
          x={vbW - 10}
          y={railTopY - 12}
          width="10"
          height={railBotY - railTopY + 24}
          fill="#f59e0b"
          rx="2"
        />

        {/* Balusters */}
        {displayPositions.map((pos, i) => {
          const x = pos * scale
          const w = Math.max(balusterWidthMm * scale, 1.5)
          return (
            <rect
              key={i}
              x={x}
              y={railTopY + railHeight / 2}
              width={w}
              height={railBotY - railTopY - railHeight}
              fill="#1d2b3e"
              opacity="0.85"
            />
          )
        })}

        {/* Gap measurement label */}
        <text
          x={vbW / 2}
          y={vbH - 8}
          textAnchor="middle"
          fontSize="14"
          fill="#1d2b3e"
          fontWeight="bold"
          fontFamily="monospace"
        >
          Razmik: {gapMm.toFixed(1)}mm — {count} palic — skupaj {(totalLengthMm / 1000).toFixed(2)}m
        </text>

        {/* Total length arrow */}
        <line x1="0" y1={railTopY - 18} x2={vbW} y2={railTopY - 18} stroke="#1d2b3e" strokeWidth="0.8" />
        <line x1="0" y1={railTopY - 22} x2="0" y2={railTopY - 14} stroke="#1d2b3e" strokeWidth="0.8" />
        <line
          x1={vbW}
          y1={railTopY - 22}
          x2={vbW}
          y2={railTopY - 14}
          stroke="#1d2b3e"
          strokeWidth="0.8"
        />
        <text
          x={vbW / 2}
          y={railTopY - 24}
          textAnchor="middle"
          fontSize="11"
          fill="#1d2b3e"
          fontFamily="monospace"
        >
          {totalLengthMm.toFixed(0)}mm
        </text>

        {truncated && (
          <text x={vbW - 5} y={vbH - 25} textAnchor="end" fontSize="9" fill="#6b7280">
            (prikazanih prvih {maxDisplay} od {count})
          </text>
        )}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-[2px] bg-roksal-navy" />
          Palica ({balusterWidthMm}mm)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-2.5 rounded-[2px] bg-roksal-amber" />
          Steber
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-4 bg-roksal-navy" />
          Letev (zgoraj + spodaj)
        </span>
      </div>
    </div>
  )
}

// ============================================
// SVG: Angled railing diagram (kose / stopnišče)
// ============================================
function AngledSvg({
  horizontalLengthMm,
  rakeAngleDeg,
  positions,
  balusterWidthMm,
  gapMm,
}: {
  horizontalLengthMm: number
  rakeAngleDeg: number
  positions: number[]
  balusterWidthMm: number
  gapMm: number
}) {
  if (horizontalLengthMm <= 0 || positions.length === 0) {
    return (
      <div className="text-center py-4 text-xs text-muted-foreground">
        Ni podatkov za vizualizacijo.
      </div>
    )
  }

  const rad = (rakeAngleDeg * Math.PI) / 180
  const cosA = Math.cos(rad)
  const sinA = Math.sin(rad)
  const rakeLengthMm = horizontalLengthMm / cosA

  // SVG dimensions
  const vbW = 1000
  const vbH = 220
  // Map horizontal length to viewBox width with padding
  const padX = 60
  const padTop = 30
  const usableW = vbW - 2 * padX
  const usableH = vbH - padTop - 40
  const scale = usableW / horizontalLengthMm

  // Top rail endpoints (horizontal projection)
  const x1 = padX
  const y1 = padTop
  const x2 = padX + horizontalLengthMm * scale
  const y2 = padTop + (horizontalLengthMm * Math.tan(rad)) * scale
  // Clamp y2 to usableH
  const y2Clamped = Math.min(y2, padTop + usableH)
  const y2Actual = y2Clamped

  // Bottom rail (offset by railing height ~1100mm, scaled)
  const railHeightVb = 90
  const x1b = x1
  const y1b = y1 + railHeightVb
  const x2b = x2
  const y2b = y2Actual + railHeightVb

  // Limit display
  const maxDisplay = 60
  const displayPositions = positions.slice(0, maxDisplay)

  // Vector along the rake (unit)
  const rakeVecX = cosA
  const rakeVecY = sinA
  // Perpendicular vector (downward from rake)
  const perpX = -sinA
  const perpY = cosA

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Kose ograja: kot ${rakeAngleDeg.toFixed(1)}°, rake dolžina ${(rakeLengthMm / 1000).toFixed(2)}m`}
      >
        {/* Background grid */}
        <defs>
          <pattern id="angGrid" width="50" height="20" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={vbW} height={vbH} fill="url(#angGrid)" />

        {/* Horizontal projection reference (dashed) */}
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y1}
          stroke="#9ca3af"
          strokeWidth="0.8"
          strokeDasharray="4 3"
        />
        <text x={(x1 + x2) / 2} y={y1 - 6} textAnchor="middle" fontSize="10" fill="#6b7280" fontFamily="monospace">
          horizontal: {(horizontalLengthMm / 1000).toFixed(2)}m
        </text>

        {/* Angle arc */}
        <path
          d={`M ${x1 + 30} ${y1} A 30 30 0 0 1 ${x1 + 30 * cosA} ${y1 + 30 * sinA}`}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="1.2"
        />
        <text
          x={x1 + 42}
          y={y1 + 18}
          fontSize="11"
          fill="#f59e0b"
          fontWeight="bold"
          fontFamily="monospace"
        >
          {rakeAngleDeg.toFixed(1)}°
        </text>

        {/* Top rail (along rake) */}
        <line x1={x1} y1={y1} x2={x2} y2={y2Actual} stroke="#1d2b3e" strokeWidth="6" strokeLinecap="round" />
        {/* Bottom rail */}
        <line x1={x1b} y1={y1b} x2={x2b} y2={y2b} stroke="#1d2b3e" strokeWidth="6" strokeLinecap="round" />

        {/* Left post */}
        <line
          x1={x1}
          y1={y1}
          x2={x1b}
          y2={y1b}
          stroke="#f59e0b"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Right post */}
        <line
          x1={x2}
          y1={y2Actual}
          x2={x2b}
          y2={y2b}
          stroke="#f59e0b"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Balusters (perpendicular to rake) */}
        {displayPositions.map((pos, i) => {
          // Position along rake (in mm), mapped to vb units
          const t = pos / rakeLengthMm
          // Position along the top rail
          const topX = x1 + (x2 - x1) * t
          const topY = y1 + (y2Actual - y1) * t
          // Bottom rail at same t
          const botX = x1b + (x2b - x1b) * t
          const botY = y1b + (y2b - y1b) * t
          return (
            <line
              key={i}
              x1={topX}
              y1={topY}
              x2={botX}
              y2={botY}
              stroke="#1d2b3e"
              strokeWidth={Math.max(balusterWidthMm * scale * 0.6, 1)}
              opacity="0.8"
            />
          )
        })}

        {/* Rake length label */}
        <text
          x={(x1 + x2) / 2 + 20}
          y={(y1 + y2Actual) / 2 + 30}
          textAnchor="middle"
          fontSize="11"
          fill="#1d2b3e"
          fontWeight="bold"
          fontFamily="monospace"
        >
          rake: {(rakeLengthMm / 1000).toFixed(2)}m — razmik {gapMm.toFixed(1)}mm
        </text>

        {/* Reference vectors (small annotation) */}
        <text x="10" y={vbH - 8} fontSize="9" fill="#6b7280" fontFamily="monospace">
          rakeVec = ({rakeVecX.toFixed(2)}, {rakeVecY.toFixed(2)}) — perp = ({perpX.toFixed(2)}, {perpY.toFixed(2)})
        </text>
      </svg>

      <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-[2px] bg-roksal-navy" />
          Palica
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-2.5 rounded-[2px] bg-roksal-amber" />
          Steber
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-4 bg-roksal-navy" />
          Letev (zgoraj + spodaj)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 border-t border-dashed border-roksal-amber" />
          Horizontalna projekcija
        </span>
      </div>
    </div>
  )
}

// ============================================
// SVG: Karta vetrnih con Slovenije
// ============================================
function SloveniaWindMapSvg({
  lat,
  lon,
  windZone,
}: {
  lat: number
  lon: number
  windZone: 1 | 2 | 3
}) {
  // Slovenia bounds: lat 45.42-46.88, lon 13.38-16.61
  const minLat = 45.42
  const maxLat = 46.88
  const minLon = 13.38
  const maxLon = 16.61
  const vbW = 600
  const vbH = 400
  const projX = (lon: number) => ((lon - minLon) / (maxLon - minLon)) * vbW
  const projY = (lat: number) => ((maxLat - lat) / (maxLat - minLat)) * vbH

  // Rough Slovenia outline
  const sloPath =
    'M 110,90 L 200,40 L 290,30 L 410,55 L 520,75 L 580,110 L 575,180 L 530,260 L 470,320 L 380,375 L 290,370 L 220,335 L 110,310 L 65,250 L 50,180 L 75,130 Z'

  // Clamp pin within Slovenia
  const pinX = Math.max(30, Math.min(vbW - 30, projX(lon)))
  const pinY = Math.max(20, Math.min(vbH - 90, projY(lat)))

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Karta vetrnih con Slovenije — lokacija cona ${windZone}`}
    >
      <defs>
        <clipPath id="sloClip">
          <path d={sloPath} />
        </clipPath>
      </defs>

      {/* Background Slovenia (zone 1 — celina, light green) */}
      <path d={sloPath} fill="#dcfce7" stroke="#1d2b3e" strokeWidth="2" />

      {/* Zone 3 (gore) — top portion, lat > 46.5 */}
      <rect
        x="0"
        y="0"
        width={vbW}
        height={projY(46.5)}
        fill="#fef3c7"
        clipPath="url(#sloClip)"
      />

      {/* Zone 2 (obala) — bottom-left, lat < 45.7 AND lon > 13.5 */}
      <rect
        x={projX(13.5)}
        y={projY(45.7)}
        width={vbW - projX(13.5)}
        height={vbH - projY(45.7)}
        fill="#fed7aa"
        clipPath="url(#sloClip)"
      />

      {/* Slovenia outline on top */}
      <path d={sloPath} fill="none" stroke="#1d2b3e" strokeWidth="2.5" />

      {/* City labels */}
      <text x={projX(14.3556)} y={projY(46.2389) - 6} fontSize="9" fill="#1d2b3e" fontWeight="bold" textAnchor="middle">
        Kranj
      </text>
      <circle cx={projX(14.3556)} cy={projY(46.2389)} r="2" fill="#1d2b3e" />

      <text x={projX(14.5050)} y={projY(46.0569) - 6} fontSize="9" fill="#1d2b3e" textAnchor="middle">
        Ljubljana
      </text>
      <circle cx={projX(14.5050)} cy={projY(46.0569)} r="2" fill="#1d2b3e" />

      <text x={projX(15.6467)} y={projY(46.5547) - 6} fontSize="9" fill="#1d2b3e" textAnchor="middle">
        Maribor
      </text>
      <circle cx={projX(15.6467)} cy={projY(46.5547)} r="2" fill="#1d2b3e" />

      <text x={projX(13.7297)} y={projY(45.5481) - 6} fontSize="9" fill="#1d2b3e" textAnchor="middle">
        Koper
      </text>
      <circle cx={projX(13.7297)} cy={projY(45.5481)} r="2" fill="#1d2b3e" />

      {/* Location pin (amber with white center) */}
      <circle cx={pinX} cy={pinY} r="10" fill="#f59e0b" stroke="#1d2b3e" strokeWidth="2" />
      <circle cx={pinX} cy={pinY} r="3.5" fill="#ffffff" />
      <text x={pinX} y={pinY - 16} fontSize="10" fill="#1d2b3e" fontWeight="bold" textAnchor="middle">
        Tukaj
      </text>

      {/* Highlighted zone label */}
      <g>
        <rect x={vbW - 110} y={10} width={100} height={26} fill="#1d2b3e" rx="4" />
        <text x={vbW - 60} y={28} fontSize="13" fill="#ffffff" fontWeight="bold" textAnchor="middle">
          CONA {windZone}
        </text>
      </g>

      {/* Legend */}
      <g>
        <rect x="14" y={vbH - 78} width="13" height="13" fill="#dcfce7" stroke="#1d2b3e" strokeWidth="1" />
        <text x="32" y={vbH - 67} fontSize="9" fill="#1d2b3e">
          Cona 1 — celina (22 m/s)
        </text>
        <rect x="14" y={vbH - 60} width="13" height="13" fill="#fed7aa" stroke="#1d2b3e" strokeWidth="1" />
        <text x="32" y={vbH - 49} fontSize="9" fill="#1d2b3e">
          Cona 2 — obala (24 m/s)
        </text>
        <rect x="14" y={vbH - 42} width="13" height="13" fill="#fef3c7" stroke="#1d2b3e" strokeWidth="1" />
        <text x="32" y={vbH - 31} fontSize="9" fill="#1d2b3e">
          Cona 3 — gore (28 m/s)
        </text>
      </g>
    </svg>
  )
}

// ============================================
// SVG: Plasti laminiranega stekla (VSG)
// ============================================
function GlassLayersSvg({ totalMm, baseMm }: { totalMm: number; baseMm: number }) {
  const vbW = 500
  const vbH = 230
  const startX = 100
  const endX = 380
  const layerW = endX - startX
  const paneH = 50
  const pvbH = 8
  const startY = 60
  const totalH = 2 * paneH + pvbH

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Laminirano steklo: 2× ${baseMm}mm + PVB folija = ${totalMm}mm`}
    >
      {/* Title */}
      <text x={vbW / 2} y={26} textAnchor="middle" fontSize="13" fill="#1d2b3e" fontWeight="bold">
        Laminirano steklo (VSG) — 2× {baseMm}mm + PVB = {totalMm}mm
      </text>

      {/* Pane 1 */}
      <rect x={startX} y={startY} width={layerW} height={paneH} fill="#bae6fd" stroke="#1d2b3e" strokeWidth="1.5" />
      <text x={startX + layerW / 2} y={startY + paneH / 2 + 4} textAnchor="middle" fontSize="12" fill="#1d2b3e" fontWeight="bold">
        Steklo {baseMm}mm
      </text>

      {/* PVB interlayer */}
      <rect x={startX} y={startY + paneH} width={layerW} height={pvbH} fill="#fde68a" stroke="#1d2b3e" strokeWidth="1" />

      {/* Pane 2 */}
      <rect x={startX} y={startY + paneH + pvbH} width={layerW} height={paneH} fill="#bae6fd" stroke="#1d2b3e" strokeWidth="1.5" />
      <text x={startX + layerW / 2} y={startY + paneH + pvbH + paneH / 2 + 4} textAnchor="middle" fontSize="12" fill="#1d2b3e" fontWeight="bold">
        Steklo {baseMm}mm
      </text>

      {/* Right side labels */}
      <text x={endX + 14} y={startY + paneH / 2 + 4} fontSize="11" fill="#1d2b3e" fontWeight="bold">
        {baseMm}mm
      </text>
      <text x={endX + 14} y={startY + paneH + pvbH / 2 + 3} fontSize="9" fill="#666666">
        PVB 0,76mm
      </text>
      <text x={endX + 14} y={startY + paneH + pvbH + paneH / 2 + 4} fontSize="11" fill="#1d2b3e" fontWeight="bold">
        {baseMm}mm
      </text>

      {/* Total dimension (left) */}
      <line x1={startX - 35} y1={startY} x2={startX - 35} y2={startY + totalH} stroke="#1d2b3e" strokeWidth="1.5" />
      <line x1={startX - 39} y1={startY} x2={startX - 31} y2={startY} stroke="#1d2b3e" strokeWidth="1.5" />
      <line x1={startX - 39} y1={startY + totalH} x2={startX - 31} y2={startY + totalH} stroke="#1d2b3e" strokeWidth="1.5" />
      <text
        x={startX - 50}
        y={startY + totalH / 2}
        textAnchor="middle"
        fontSize="11"
        fill="#1d2b3e"
        fontWeight="bold"
        transform={`rotate(-90 ${startX - 50} ${startY + totalH / 2})`}
      >
        Skupaj {totalMm}mm
      </text>

      {/* Legend */}
      <g transform="translate(30, 185)">
        <rect x="0" y="0" width="11" height="11" fill="#bae6fd" stroke="#1d2b3e" strokeWidth="1" />
        <text x="16" y="9" fontSize="9" fill="#1d2b3e">
          Steklo (float/kaljeno)
        </text>
        <rect x="130" y="0" width="11" height="11" fill="#fde68a" stroke="#1d2b3e" strokeWidth="1" />
        <text x="146" y="9" fontSize="9" fill="#1d2b3e">
          PVB folija (varnostna)
        </text>
      </g>
    </svg>
  )
}
