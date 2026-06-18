'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Ruler,
  Plus,
  MapPin,
  ScanLine,
  Calendar,
  FolderOpen,
  TrendingUp,
  Scan,
  Trash2,
  ChevronDown,
  ChevronUp,
  Hammer,
  AlertCircle,
  Copy,
  Calculator,
  Download,
  FileText,
  Crosshair,
  Layers,
  Gauge,
  Triangle,
  Mountain,
  CheckCircle2,
  RefreshCw,
  Camera,
  X,
  Save,
  Tag,
  // P1 — novi ikoni
  Mic,
  History,
  CheckSquare,
  Square,
  Archive,
  ClipboardList,
  Sparkles,
  RotateCcw,
  Filter,
  Clock,
  FileSpreadsheet,
  // P3 — novi ikoni (stopnice, koti, štebricki, WPC)
  CornerDownRight,
  Layers2,
  Columns3,
  Fence,
  PencilRuler,
  Lock,
  Unlock,
  Bookmark,
  ArrowRightLeft,
  Grid3x3,
  TrendingDown,
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ============================================
// TIPI
// ============================================

type TipMeritve =
  | 'RAZDALJA'
  | 'VISINA'
  | 'KOT'
  | 'NAGIB'
  | 'GLOBINA'
  | 'PREMER'
  | 'SEGMENT'
  // P3 — novi tipi meritev
  | 'KOT_VOGAL'
  | 'KOT_STOPNISCE'
  | 'STEBR'

type GroundType = 'beton' | 'les' | 'plosca' | 'gramoz' | 'metal'

interface ArMetadata {
  tipMeritve?: TipMeritve
  oznaka?: string
  segmentId?: string
  opomba?: string
  status?: MeasurementStatus
  // starejše polje (združljivost)
  lokacija?: string
  steviloStebrov?: number
  tipPodlage?: string
  kot?: number
  opombe?: string
  // kalibracija
  pixelsPerMm?: number
  calibrationNote?: string
  // inclinometer
  kotStopinje?: number
  smer?: string
  // P3 — enote (mm/cm/m)
  enota?: 'mm' | 'cm' | 'm'
  originalnaVrednost?: number
  // P3 — kotomer (vogal: notranji + zunanji kot)
  notranjiKot?: number
  zunanjiKot?: number
  // P3 — štebricki (STEBR)
  tipStebra?: 'KONCNI' | 'VMESNI' | 'VOGALNI'
  materialStebra?: 'ALU' | 'INOX' | 'WPC' | 'DRUGO'
  visinaStebraMm?: number
  pozicijaMm?: number
  razmikMm?: number
  steberOznaka?: string
  // P3 — WPC palice
  orientacijaPalic?: 'WPC_POKOCNE' | 'WPC_VODORAVNE' | 'WPC_POSEVNE'
  sirinaPalice?: number
  debelinaPalice?: number
  razmikPalic?: number
  kotPosevnih?: number
  stPalic?: number
}

interface Measurement {
  id: string
  dolzinaMm: number
  visinaMm: number
  lidarScanUrl?: string | null
  gpsLokacija?: string | null
  createdAt: string
  projectId: string
  // odjemanje iz arMetadata (za prikaz)
  lokacija?: string | null
  steviloStebrov?: number | null
  tipPodlage?: string | null
  kot?: number | null
  opombe?: string | null
  arMetadata?: string | null
  // razčlenjena polja (za prikaz)
  tipMeritve?: TipMeritve
  oznaka?: string
  segmentId?: string
  opomba?: string
  status?: MeasurementStatus
  kotStopinje?: number | null
  // P3 — enote
  enota?: 'mm' | 'cm' | 'm'
  originalnaVrednost?: number
  // P3 — kotomer
  notranjiKot?: number | null
  zunanjiKot?: number | null
  // P3 — štebricki
  tipStebra?: 'KONCNI' | 'VMESNI' | 'VOGALNI'
  materialStebra?: 'ALU' | 'INOX' | 'WPC' | 'DRUGO'
  visinaStebraMm?: number | null
  pozicijaMm?: number | null
  razmikMm?: number | null
  steberOznaka?: string
  // P3 — WPC palice
  orientacijaPalic?: 'WPC_POKOCNE' | 'WPC_VODORAVNE' | 'WPC_POSEVNE'
  sirinaPalice?: number
  debelinaPalice?: number
  razmikPalic?: number
  kotPosevnih?: number
  stPalic?: number
}

interface Project {
  id: string
  nazivProjekta: string
}

interface MeasurementGroup {
  label: string
  date: Date
  measurements: Measurement[]
}

interface Segment {
  id: string
  name: string
  type:
    | 'ravni'
    | 'kotni'
    | 'stopniscje'
    | 'lokan'
    // P3 — WPC orientacije
    | 'WPC_POKOCNE'
    | 'WPC_VODORAVNE'
    | 'WPC_POSEVNE'
}

interface CalibrationState {
  realMm: string
  pixelDistance: string
  pixelsPerMm: number | null
  note: string
}

interface SlopeReading {
  beta: number
  gamma: number
}

type MeasurementStatus = 'OSNUTEK' | 'POTRJENA' | 'ARHIVIRANA'

type StatusFilter = 'VSE' | MeasurementStatus

interface AuditEntry {
  timestamp: string
  akcija: 'ADD' | 'EDIT' | 'DELETE' | 'STATUS'
  meritevId: string
  opis: string
  staraVrednost?: string
  novaVrednost?: string
}

interface PredlogaDef {
  id: string
  naziv: string
  opis: string
  ikona: typeof Ruler
}

// Tipizirana oz. varovalna oblika Web Speech API
interface SpeechRecognitionResultItem {
  transcript: string
  confidence: number
}
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: {
    resultIndex: number
    results: ArrayLike<ArrayLike<SpeechRecognitionResultItem> & { isFinal: boolean; length: number }>
  }) => void) | null
  onerror: ((event: unknown) => void) | null
  onend: (() => void) | null
}
interface SpeechRecognitionCtor {
  new (): SpeechRecognitionLike
}

// ============================================
// KONSTANTE
// ============================================

const tipMeritveLabels: Record<TipMeritve, string> = {
  RAZDALJA: 'Razdalja',
  VISINA: 'Višina',
  KOT: 'Kot',
  NAGIB: 'Nagib',
  GLOBINA: 'Globina',
  PREMER: 'Premer',
  SEGMENT: 'Segment',
  // P3 — novi tipi
  KOT_VOGAL: 'Vogal',
  KOT_STOPNISCE: 'Kot stopnice',
  STEBR: 'Stebriček/Palica',
}

const tipMeritveIcons: Record<TipMeritve, typeof Ruler> = {
  RAZDALJA: Ruler,
  VISINA: Gauge,
  KOT: Triangle,
  NAGIB: Mountain,
  GLOBINA: Crosshair,
  PREMER: Crosshair,
  SEGMENT: Layers,
  // P3 — novi tipi
  KOT_VOGAL: CornerDownRight,
  KOT_STOPNISCE: Layers2,
  STEBR: Columns3,
}

const tipMeritveColors: Record<TipMeritve, string> = {
  RAZDALJA: 'bg-roksal-navy/10 text-roksal-navy border-roksal-navy/20',
  VISINA: 'bg-roksal-amber/10 text-roksal-amber border-roksal-amber/30',
  KOT: 'bg-purple-50 text-purple-700 border-purple-200',
  NAGIB: 'bg-orange-50 text-orange-700 border-orange-200',
  GLOBINA: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  PREMER: 'bg-teal-50 text-teal-700 border-teal-200',
  SEGMENT: 'bg-gray-50 text-gray-700 border-gray-200',
  // P3 — novi tipi
  KOT_VOGAL: 'bg-teal-50 text-teal-700 border-teal-200',
  KOT_STOPNISCE: 'bg-orange-50 text-orange-700 border-orange-200',
  STEBR: 'bg-roksal-navy/10 text-roksal-navy border-roksal-navy/20',
}

const groundTypeLabels: Record<GroundType, string> = {
  beton: 'Beton',
  les: 'Lesena podlaga',
  plosca: 'Plošča (kompozit)',
  gramoz: 'Gramoz',
  metal: 'Kovinska podlaga',
}

const groundTypeColors: Record<GroundType, string> = {
  beton: 'bg-gray-100 text-gray-700 border-gray-300',
  les: 'bg-amber-50 text-amber-700 border-amber-300',
  plosca: 'bg-green-50 text-green-700 border-green-300',
  gramoz: 'bg-orange-50 text-orange-700 border-orange-300',
  metal: 'bg-slate-100 text-slate-700 border-slate-300',
}

const segmentTypeLabels: Record<Segment['type'], string> = {
  ravni: 'Ravni odsek',
  kotni: 'Kotni odsek',
  stopniscje: 'Stopnišče',
  lokan: 'Lokan / ukrivljen',
  // P3 — WPC orientacije
  WPC_POKOCNE: 'WPC pokončne palice',
  WPC_VODORAVNE: 'WPC vodoravne palice',
  WPC_POSEVNE: 'WPC poševne palice',
}

const statusLabels: Record<MeasurementStatus, string> = {
  OSNUTEK: 'Osnutek',
  POTRJENA: 'Potrjena',
  ARHIVIRANA: 'Arhivirana',
}

const statusColors: Record<MeasurementStatus, string> = {
  OSNUTEK: 'bg-gray-100 text-gray-600 border-gray-300',
  POTRJENA: 'bg-green-50 text-green-700 border-green-300',
  ARHIVIRANA: 'bg-gray-50 text-gray-400 border-gray-200 line-through',
}

const statusCycle: Record<MeasurementStatus, MeasurementStatus> = {
  OSNUTEK: 'POTRJENA',
  POTRJENA: 'ARHIVIRANA',
  ARHIVIRANA: 'OSNUTEK',
}

const auditActionLabels: Record<AuditEntry['akcija'], string> = {
  ADD: 'Dodano',
  EDIT: 'Spremenjeno',
  DELETE: 'Izbrisano',
  STATUS: 'Status',
}

const auditIcons: Record<AuditEntry['akcija'], typeof Ruler> = {
  ADD: Plus,
  EDIT: RefreshCw,
  DELETE: Trash2,
  STATUS: RotateCcw,
}

const auditColors: Record<AuditEntry['akcija'], string> = {
  ADD: 'bg-green-50 text-green-700',
  EDIT: 'bg-blue-50 text-blue-700',
  DELETE: 'bg-red-50 text-red-700',
  STATUS: 'bg-amber-50 text-amber-700',
}

const PREDLOGE: PredlogaDef[] = [
  { id: 'balkon3m', naziv: 'Standardni balkon 3m', opis: 'Balkon + 3 meritve', ikona: Ruler },
  { id: 'stopnisce', naziv: 'Stopnišče 12 stopnic', opis: 'Stopnišče + 2 meritevi', ikona: Layers },
  { id: 'loblika', naziv: 'L-oblika 4+2m', opis: '2 segmenta, L tloris', ikona: Triangle },
  { id: 'terasa5m', naziv: 'Terasa 5m', opis: 'Terasa + 1 meritev', ikona: Mountain },
  { id: 'prazen', naziv: 'Prazen začetek', opis: 'Samo nova forma', ikona: Plus },
]

const LOKACIJE_INCLINOMETER = [
  'Talna plošča balkona',
  'Podkonstrukcija',
  'Rob balkona',
  'Stopnišče',
  'Terasa',
  'Drugo',
]

// P3 — konstante za stopniščni čarovnik
type EnotaTip = 'mm' | 'cm' | 'm'

const enotaLabels: Record<EnotaTip, string> = {
  mm: 'mm',
  cm: 'cm',
  m: 'm',
}

// P3 — konstante za štebricki
type TipStebra = 'KONCNI' | 'VMESNI' | 'VOGALNI'
type MaterialStebra = 'ALU' | 'INOX' | 'WPC' | 'DRUGO'

const tipStebraLabels: Record<TipStebra, string> = {
  KONCNI: 'Končni',
  VMESNI: 'Vmesni',
  VOGALNI: 'Vogalni',
}

const tipStebraColors: Record<TipStebra, string> = {
  KONCNI: 'bg-roksal-amber/10 text-roksal-amber border-roksal-amber/30',
  VMESNI: 'bg-roksal-navy/10 text-roksal-navy border-roksal-navy/20',
  VOGALNI: 'bg-teal-50 text-teal-700 border-teal-200',
}

const materialStebraLabels: Record<MaterialStebra, string> = {
  ALU: 'ALU',
  INOX: 'INOX',
  WPC: 'WPC',
  DRUGO: 'Drugo',
}

const materialStebraColors: Record<MaterialStebra, string> = {
  ALU: 'bg-slate-100 text-slate-700 border-slate-300',
  INOX: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  WPC: 'bg-amber-50 text-amber-700 border-amber-200',
  DRUGO: 'bg-gray-50 text-gray-600 border-gray-200',
}

// P3 — konstante za WPC
const WPC_SIRINE_PALIC = [140, 180] as const
const WPC_DEBELINA_DEFAULT = 23
const WPC_RAZMAK_DEFAULT = 110 // standardni Roksal razmik med palicami
const WPC_KOT_POSEVNIH_DEFAULT = 45

interface StairTemplate {
  id: string
  naziv: string
  skupnaVisinaMm: number
  stStopnic: number
  globinaStopniceMm: number
  sirinaStopniceMm?: number
  createdAt: string
}

interface StairCalc {
  visinaPosamezne: number
  kotStopinje: number
  dolzinaKosa: number
  skupnaDolzina: number
  priporocilo: string
  priporociloColor: string
  valid: boolean
}

interface MeasurementsTabProps {
  onNavigateToCalculator?: (dolzinaMm: number, visinaMm: number, locationName: string) => void
}

// ============================================
// POMOŽNE FUNKCIJE
// ============================================

function parseArMetadata(raw: string | null | undefined): ArMetadata {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as ArMetadata
  } catch {
    return {}
  }
}

function parseGPS(gpsStr: string | null): { lat: number; lng: number } | null {
  if (!gpsStr) return null
  try {
    return JSON.parse(gpsStr)
  } catch {
    return null
  }
}

function formatDimension(mm: number): string {
  if (mm >= 1000) return `${(mm / 1000).toFixed(2)}m`
  return `${mm}mm`
}

function formatM2(mm2: number): string {
  return `${(mm2 / 1_000_000).toFixed(2)}m²`
}

// P1 — multi-unit prikaz mer
function formatMultiUnit(mm: number): string {
  return `${mm}mm · ${Math.round(mm / 10)}cm · ${(mm / 1000).toFixed(2)}m`
}

function formatAngleMulti(deg: number): string {
  const rad = (deg * Math.PI) / 180
  return `${deg}° · ${rad.toFixed(2)}rad`
}

function formatSlopeMulti(deg: number): string {
  const pct = Math.tan((deg * Math.PI) / 180) * 100
  return `${deg.toFixed(1)}° · ${pct.toFixed(1)}%`
}

function loadAudit(projectId: string): AuditEntry[] {
  try {
    const raw = localStorage.getItem(`roksal_audit_${projectId}`)
    return raw ? (JSON.parse(raw) as AuditEntry[]) : []
  } catch {
    return []
  }
}

// P3 — pretvorba enot (mm/cm/m) v mm
function convertToMm(value: number, unit: EnotaTip): number {
  if (!Number.isFinite(value)) return 0
  switch (unit) {
    case 'mm':
      return value
    case 'cm':
      return value * 10
    case 'm':
      return value * 1000
  }
}

// P3 — prikaz v primarni enoti (default mm)
function formatInPrimaryUnit(mm: number, primary: EnotaTip): string {
  if (!Number.isFinite(mm)) return '—'
  switch (primary) {
    case 'mm':
      return `${Math.round(mm)}mm`
    case 'cm':
      return `${(mm / 10).toFixed(1)}cm`
    case 'm':
      return `${(mm / 1000).toFixed(2)}m`
  }
}

// P3 — izračun stopniščnih dimenzij
function calculateStairDimensions(
  skupnaVisinaMm: number,
  stStopnic: number,
  globinaStopniceMm: number,
  sirinaStopniceMm?: number
): StairCalc {
  if (
    skupnaVisinaMm <= 0 ||
    stStopnic <= 0 ||
    globinaStopniceMm <= 0 ||
    !Number.isFinite(skupnaVisinaMm) ||
    !Number.isFinite(stStopnic) ||
    !Number.isFinite(globinaStopniceMm)
  ) {
    return {
      visinaPosamezne: 0,
      kotStopinje: 0,
      dolzinaKosa: 0,
      skupnaDolzina: 0,
      priporocilo: 'Vnesite veljavne vhodne podatke',
      priporociloColor: 'text-muted-foreground',
      valid: false,
    }
  }
  const visinaPosamezne = skupnaVisinaMm / stStopnic
  const kotRad = Math.atan(visinaPosamezne / globinaStopniceMm)
  const kotStopinje = (kotRad * 180) / Math.PI
  const dolzinaKosa = Math.sqrt(visinaPosamezne ** 2 + globinaStopniceMm ** 2) * stStopnic
  const rezerva = sirinaStopniceMm ? sirinaStopniceMm * 0.5 : 200 // dodaten rob
  const skupnaDolzina = dolzinaKosa + rezerva
  let priporocilo = 'Standardni kot 30–35°'
  let priporociloColor = 'text-green-700'
  if (kotStopinje > 40) {
    priporocilo = 'Nevarno: >40° (prestrmo!)'
    priporociloColor = 'text-red-600'
  } else if (kotStopinje > 37) {
    priporocilo = 'Prestrmo: >37°'
    priporociloColor = 'text-orange-600'
  } else if (kotStopinje < 25) {
    priporocilo = 'Ploščato: <25°'
    priporociloColor = 'text-amber-600'
  }
  return {
    visinaPosamezne,
    kotStopinje,
    dolzinaKosa,
    skupnaDolzina,
    priporocilo,
    priporociloColor,
    valid: true,
  }
}

// P3 — avto-številčenje stebrov v segmentu (S1, S2, ...)
function getNextStebriNumber(measurements: Measurement[], segmentId?: string): number {
  const stebri = measurements.filter(
    (m) => m.tipMeritve === 'STEBR' && (!segmentId || m.segmentId === segmentId)
  )
  return stebri.length + 1
}

// P3 — izračun števila WPC palic za dano orientacijo
function calcWpcPalice(
  orientacija: Segment['type'],
  dolzinaMm: number,
  visinaMm: number,
  sirinaPalice: number,
  razmikPalic: number
): number {
  if (sirinaPalice <= 0 || razmikPalic <= 0) return 0
  const korak = sirinaPalice + razmikPalic
  if (
    orientacija === 'WPC_POKOCNE' ||
    orientacija === 'WPC_VODORAVNE'
  ) {
    const relevantnaDim = orientacija === 'WPC_POKOCNE' ? dolzinaMm : visinaMm
    if (relevantnaDim <= 0) return 0
    return Math.max(0, Math.floor((relevantnaDim - sirinaPalice) / korak) + 1)
  }
  if (orientacija === 'WPC_POSEVNE') {
    // mreža: (dolžina / korak) × (višina / korak) — približno
    if (dolzinaMm <= 0 || visinaMm <= 0) return 0
    const nDolzina = Math.max(0, Math.floor((dolzinaMm - sirinaPalice) / korak) + 1)
    const nVisina = Math.max(0, Math.floor((visinaMm - sirinaPalice) / korak) + 1)
    return nDolzina * nVisina
  }
  return 0
}

// P3 — nalaganje/shranjevanje stopniških predlog
function loadStairTemplates(): StairTemplate[] {
  try {
    const raw = localStorage.getItem('roksal_stair_templates')
    return raw ? (JSON.parse(raw) as StairTemplate[]) : []
  } catch {
    return []
  }
}

function saveStairTemplates(templates: StairTemplate[]) {
  try {
    localStorage.setItem('roksal_stair_templates', JSON.stringify(templates))
  } catch {
    // ignore
  }
}

// P3 — nalaganje primarne enote
function loadPrimaryUnit(): EnotaTip {
  try {
    const raw = localStorage.getItem('roksal_primary_unit')
    if (raw === 'mm' || raw === 'cm' || raw === 'm') return raw
  } catch {
    // ignore
  }
  return 'mm'
}

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export function MeasurementsTab({ onNavigateToCalculator }: MeasurementsTabProps) {
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [formOpen, setFormOpen] = useState(false)

  // Obstoječa polja obrazca
  const [formLength, setFormLength] = useState('')
  const [formHeight, setFormHeight] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formPosts, setFormPosts] = useState('')
  const [formGround, setFormGround] = useState<GroundType>('beton')
  const [formAngle, setFormAngle] = useState('')
  const [formNotes, setFormNotes] = useState('')

  // NOVA polja obrazca
  const [formTipMeritve, setFormTipMeritve] = useState<TipMeritve>('RAZDALJA')
  const [formOznaka, setFormOznaka] = useState('')
  const [formSegmentId, setFormSegmentId] = useState('')
  const [formOpomba, setFormOpomba] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Segmenti
  const [segments, setSegments] = useState<Segment[]>([])
  const [newSegmentName, setNewSegmentName] = useState('')
  const [newSegmentType, setNewSegmentType] = useState<Segment['type']>('ravni')
  const [addSegmentOpen, setAddSegmentOpen] = useState(false)

  // Kalibracija
  const [calibration, setCalibration] = useState<CalibrationState>({
    realMm: '',
    pixelDistance: '',
    pixelsPerMm: null,
    note: '',
  })
  const [calibrationOpen, setCalibrationOpen] = useState(false)

  // Inline inclinometer
  const [inclinometerOpen, setInclinometerOpen] = useState(false)
  const [inclinometerMode, setInclinometerMode] = useState<'KOT' | 'NAGIB'>('KOT')

  // Razširjeni segmenti (kateri so odprti)
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set())

  // P1 — Skupinske akcije
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkCopyTarget, setBulkCopyTarget] = useState('')
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  // P1 — Status filter
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('VSE')

  // P1 — Zgodovina sprememb (audit)
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [auditOpen, setAuditOpen] = useState(false)
  const [auditExpanded, setAuditExpanded] = useState(false)

  // P1 — Glasovni vnos opomb
  const [voiceListening, setVoiceListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [interimText, setInterimText] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  // P3 — Primarna enota za prikaz (mm / cm / m) — globalna nastavitev
  const [primaryUnit, setPrimaryUnit] = useState<EnotaTip>('mm')

  // P3 — Enota v formi (ločena za dolžino in višino)
  const [formLengthUnit, setFormLengthUnit] = useState<EnotaTip>('mm')
  const [formHeightUnit, setFormHeightUnit] = useState<EnotaTip>('mm')

  // P3 — Stopniščni čarovnik (stair wizard)
  const [stairWizardOpen, setStairWizardOpen] = useState(false)
  const [stairSkupnaVisina, setStairSkupnaVisina] = useState('')
  const [stairStStopnic, setStairStStopnic] = useState('')
  const [stairGlobina, setStairGlobina] = useState('')
  const [stairSirina, setStairSirina] = useState('')
  const [stairSegmentId, setStairSegmentId] = useState('')
  const [stairTemplates, setStairTemplates] = useState<StairTemplate[]>([])

  // P3 — Inline kotomer (za KOT, KOT_VOGAL, KOT_STOPNISCE)
  const [kotomerOpen, setKotomerOpen] = useState(false)
  const [kotomerMode, setKotomerMode] = useState<'KOT' | 'KOT_VOGAL' | 'KOT_STOPNISCE'>('KOT')

  // P3 — Štebricki (STEBR) — forma znotraj meritev
  const [stebriFormOpen, setStebriFormOpen] = useState(false)
  const [stebriTipStebra, setStebriTipStebra] = useState<TipStebra>('VMESNI')
  const [stebriMaterial, setStebriMaterial] = useState<MaterialStebra>('ALU')
  const [stebriVisina, setStebriVisina] = useState('1100')
  const [stebriPozicija, setStebriPozicija] = useState('')
  const [stebriPozicijaUnit, setStebriPozicijaUnit] = useState<EnotaTip>('mm')
  const [stebriRazmik, setStebriRazmik] = useState('') // auto-calc from previous
  const [stebriSegmentId, setStebriSegmentId] = useState('')

  // P3 — WPC konfiguracija (porabljenih pri izbiri WPC segmenta)
  const [wpcSirinaPalice, setWpcSirinaPalice] = useState<number>(140)
  const [wpcDebelinaPalice, setWpcDebelinaPalice] = useState<number>(WPC_DEBELINA_DEFAULT)
  const [wpcRazmikPalic, setWpcRazmikPalic] = useState<number>(WPC_RAZMAK_DEFAULT)
  const [wpcKotPosevnih, setWpcKotPosevnih] = useState<number>(WPC_KOT_POSEVNIH_DEFAULT)
  const [wpcConfigOpen, setWpcConfigOpen] = useState(false)

  // ============================================
  // NALAGANJE PODATKOV
  // ============================================

  useEffect(() => {
    async function fetchData() {
      try {
        const projRes = await fetch('/api/projects')
        if (projRes.ok) {
          const projData = await projRes.json()
          setProjects(projData)
          if (projData.length > 0) {
            const firstProjectId = projData[0].id
            setSelectedProject(firstProjectId)
            const measRes = await fetch(`/api/measurements?projectId=${firstProjectId}`)
            if (measRes.ok) {
              const measData = await measRes.json()
              if (measData.length > 0) {
                setMeasurements(normalizeMeasurements(measData))
              } else {
                setMeasurements(demoMeasurements)
              }
            } else {
              setMeasurements(demoMeasurements)
            }
          } else {
            setMeasurements(demoMeasurements)
          }
        } else {
          setMeasurements(demoMeasurements)
          setProjects(demoProjects)
        }
      } catch {
        setMeasurements(demoMeasurements)
        setProjects(demoProjects)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Re-fetch pri spremembi projekta
  useEffect(() => {
    if (!selectedProject || loading) return
    async function fetchMeasurements() {
      try {
        const measRes = await fetch(`/api/measurements?projectId=${selectedProject}`)
        if (measRes.ok) {
          const measData = await measRes.json()
          setMeasurements(
            measData.length > 0
              ? normalizeMeasurements(measData)
              : demoMeasurements.filter((m) => m.projectId === selectedProject)
          )
        }
      } catch {
        // keep existing
      }
    }
    fetchMeasurements()
  }, [selectedProject, loading])

  // Naloži segmente iz localStorage
  useEffect(() => {
    if (!selectedProject) return
    try {
      const raw = localStorage.getItem(`roksal_segments_${selectedProject}`)
      if (raw) {
        setSegments(JSON.parse(raw) as Segment[])
      } else {
        // privzeti demo segmenti (P3 — vključuje WPC_POKOCNE za demonstracijo)
        setSegments([
          { id: 'severni', name: 'Severni del', type: 'ravni' },
          { id: 'vzhodni', name: 'Vzhodni del', type: 'kotni' },
          { id: 'stopniscje', name: 'Stopnišče', type: 'stopniscje' },
          { id: 'wpc-terasa', name: 'WPC terasa', type: 'WPC_POKOCNE' },
        ])
      }
    } catch {
      setSegments([])
    }
  }, [selectedProject])

  // Shrani segmente v localStorage
  useEffect(() => {
    if (!selectedProject || segments.length === 0) return
    try {
      localStorage.setItem(`roksal_segments_${selectedProject}`, JSON.stringify(segments))
    } catch {
      // ignore
    }
  }, [segments, selectedProject])

  // Naloži kalibracijo iz localStorage
  useEffect(() => {
    if (!selectedProject) return
    try {
      const raw = localStorage.getItem(`roksal_calibration_${selectedProject}`)
      if (raw) {
        setCalibration(JSON.parse(raw) as CalibrationState)
      }
    } catch {
      // ignore
    }
  }, [selectedProject])

  // P1 — Naloži zgodovino sprememb ob spremembi projekta
  useEffect(() => {
    if (!selectedProject) return
    setAuditEntries(loadAudit(selectedProject))
  }, [selectedProject])

  // P1 — Zaznaj podporo Web Speech API
  useEffect(() => {
    if (typeof window === 'undefined') return
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor
      webkitSpeechRecognition?: SpeechRecognitionCtor
    }
    setVoiceSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition))
  }, [])

  // P1 — počisti voice recognition ob unmountu
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort()
      } catch {
        // ignore
      }
    }
  }, [])

  // P3 — naloži primarno enoto + stopniške predloge ob mountu
  useEffect(() => {
    setPrimaryUnit(loadPrimaryUnit())
    setStairTemplates(loadStairTemplates())
  }, [])

  // P3 — shrani primarno enoto ob spremembi
  useEffect(() => {
    try {
      localStorage.setItem('roksal_primary_unit', primaryUnit)
    } catch {
      // ignore
    }
  }, [primaryUnit])

  // P3 — auto-calc razmika stebra od prejšnjega stebra v segmentu
  useEffect(() => {
    if (!stebriFormOpen) return
    if (!stebriPozicija || !stebriSegmentId) {
      setStebriRazmik('')
      return
    }
    const pozicijaMm = convertToMm(parseFloat(stebriPozicija) || 0, stebriPozicijaUnit)
    if (!Number.isFinite(pozicijaMm) || pozicijaMm <= 0) {
      setStebriRazmik('')
      return
    }
    const stebri = measurements
      .filter((m) => m.tipMeritve === 'STEBR' && m.segmentId === stebriSegmentId)
      .sort((a, b) => (a.pozicijaMm || 0) - (b.pozicijaMm || 0))
    if (stebri.length === 0) {
      setStebriRazmik('—')
      return
    }
    const prev = stebri[stebri.length - 1]
    const prevPozicija = prev.pozicijaMm || 0
    const razmik = pozicijaMm - prevPozicija
    setStebriRazmik(razmik > 0 ? String(Math.round(razmik)) : '—')
  }, [stebriPozicija, stebriPozicijaUnit, stebriSegmentId, stebriFormOpen, measurements])

  // ============================================
  // NORMALIZACIJA MERITEV IZ API-ja
  // ============================================

  function normalizeMeasurements(raw: unknown[]): Measurement[] {
    return raw.map((item) => {
      const m = item as Measurement
      const ar = parseArMetadata(m.arMetadata)
      return {
        ...m,
        lokacija: m.lokacija ?? ar.lokacija ?? null,
        steviloStebrov: m.steviloStebrov ?? ar.steviloStebrov ?? null,
        tipPodlage: m.tipPodlage ?? ar.tipPodlage ?? null,
        kot: m.kot ?? ar.kot ?? null,
        opombe: m.opombe ?? ar.opombe ?? null,
        tipMeritve: ar.tipMeritve,
        oznaka: ar.oznaka,
        segmentId: ar.segmentId,
        opomba: ar.opomba,
        status: ar.status ?? m.status ?? 'OSNUTEK',
        kotStopinje: m.kotStopinje ?? ar.kotStopinje ?? null,
        // P3 — enote
        enota: ar.enota ?? m.enota,
        originalnaVrednost: ar.originalnaVrednost ?? m.originalnaVrednost,
        // P3 — kotomer
        notranjiKot: ar.notranjiKot ?? m.notranjiKot ?? null,
        zunanjiKot: ar.zunanjiKot ?? m.zunanjiKot ?? null,
        // P3 — štebricki
        tipStebra: ar.tipStebra ?? m.tipStebra,
        materialStebra: ar.materialStebra ?? m.materialStebra,
        visinaStebraMm: ar.visinaStebraMm ?? m.visinaStebraMm ?? null,
        pozicijaMm: ar.pozicijaMm ?? m.pozicijaMm ?? null,
        razmikMm: ar.razmikMm ?? m.razmikMm ?? null,
        steberOznaka: ar.steberOznaka ?? m.steberOznaka,
        // P3 — WPC palice
        orientacijaPalic: ar.orientacijaPalic ?? m.orientacijaPalic,
        sirinaPalice: ar.sirinaPalice ?? m.sirinaPalice,
        debelinaPalice: ar.debelinaPalice ?? m.debelinaPalice,
        razmikPalic: ar.razmikPalic ?? m.razmikPalic,
        kotPosevnih: ar.kotPosevnih ?? m.kotPosevnih,
        stPalic: ar.stPalic ?? m.stPalic,
      }
    })
  }

  // ============================================
  // OBRAZEC — RESET / SUBMIT
  // ============================================

  function resetForm() {
    setFormLength('')
    setFormHeight('')
    setFormLocation('')
    setFormPosts('')
    setFormGround('beton')
    setFormAngle('')
    setFormNotes('')
    setFormTipMeritve('RAZDALJA')
    setFormOznaka('')
    setFormSegmentId('')
    setFormOpomba('')
    // P3 — reset enot
    setFormLengthUnit('mm')
    setFormHeightUnit('mm')
  }

  // P1 — zapiši v zgodovino sprememb (audit)
  const pushAudit = useCallback(
    (entry: Omit<AuditEntry, 'timestamp'>) => {
      if (!selectedProject) return
      const full: AuditEntry = { ...entry, timestamp: new Date().toISOString() }
      setAuditEntries((prev) => {
        const updated = [full, ...prev].slice(0, 200)
        try {
          localStorage.setItem(`roksal_audit_${selectedProject}`, JSON.stringify(updated))
        } catch {
          // ignore
        }
        return updated
      })
    },
    [selectedProject]
  )

  async function handleSubmitMeasurement() {
    if (!selectedProject || !formLength || !formHeight) {
      toast.error('Vnesite dolžino in višino!')
      return
    }
    if (parseFloat(formLength) < 0.001 || parseFloat(formHeight) < 0.001) {
      toast.error('Meritve morajo biti pozitivne!')
      return
    }
    setSubmitting(true)

    // P3 — pretvorba izbrane enote v mm
    const rawLength = parseFloat(formLength) || 0
    const rawHeight = parseFloat(formHeight) || 0
    const dolzinaMm = Math.max(1, Math.round(convertToMm(rawLength, formLengthUnit)))
    const visinaMm = Math.max(1, Math.round(convertToMm(rawHeight, formHeightUnit)))

    const arMetadata: ArMetadata = {
      tipMeritve: formTipMeritve,
      oznaka: formOznaka || undefined,
      segmentId: formSegmentId || undefined,
      opomba: formOpomba || undefined,
      status: 'OSNUTEK',
      lokacija: formLocation || undefined,
      steviloStebrov: formPosts ? parseInt(formPosts) : undefined,
      tipPodlage: formGround,
      kot: formAngle ? parseFloat(formAngle) : undefined,
      opombe: formNotes || undefined,
      // P3 — audit: originalna enota + vrednost
      enota: formLengthUnit,
      originalnaVrednost: rawLength,
    }

    try {
      const res = await fetch('/api/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject,
          dolzinaMm,
          visinaMm,
          arMetadata,
          gpsLokacija: { lat: 46.2397, lng: 14.3556 },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const newMeasurement: Measurement = {
          ...data,
          lokacija: formLocation || null,
          steviloStebrov: formPosts ? parseInt(formPosts) : null,
          tipPodlage: formGround,
          kot: formAngle ? parseFloat(formAngle) : null,
          opombe: formNotes || null,
          tipMeritve: formTipMeritve,
          oznaka: formOznaka || undefined,
          segmentId: formSegmentId || undefined,
          opomba: formOpomba || undefined,
          status: 'OSNUTEK',
          // P3
          enota: formLengthUnit,
          originalnaVrednost: rawLength,
        }
        setMeasurements((prev) => [newMeasurement, ...prev])
        pushAudit({
          akcija: 'ADD',
          meritevId: newMeasurement.id,
          opis: `Nova meritev \"${formOznaka || formLocation || newMeasurement.id.slice(-4)}\" dodana — ${formatMultiUnit(dolzinaMm)}`,
        })
        resetForm()
        setFormOpen(false)
        toast.success('Meritev dodana!')
      } else {
        // Server error — save locally as fallback
        saveLocalMeasurement(arMetadata, dolzinaMm, visinaMm, rawLength)
        toast.error('Napaka strežnika — meritev shranjena lokalno')
      }
    } catch {
      saveLocalMeasurement(arMetadata, dolzinaMm, visinaMm, rawLength)
      toast.success('Meritev dodana (lokalno)!')
    } finally {
      setSubmitting(false)
    }
  }

  function saveLocalMeasurement(ar: ArMetadata, dolzinaMm: number, visinaMm: number, originalnaVrednost: number) {
    const newMeasurement: Measurement = {
      id: `local_${Date.now()}`,
      dolzinaMm,
      visinaMm,
      lidarScanUrl: null,
      gpsLokacija: JSON.stringify({ lat: 46.2397, lng: 14.3556 }),
      createdAt: new Date().toISOString(),
      projectId: selectedProject,
      lokacija: formLocation || null,
      steviloStebrov: formPosts ? parseInt(formPosts) : null,
      tipPodlage: formGround,
      kot: formAngle ? parseFloat(formAngle) : null,
      opombe: formNotes || null,
      arMetadata: JSON.stringify({ ...ar, status: 'OSNUTEK' }),
      tipMeritve: formTipMeritve,
      oznaka: formOznaka || undefined,
      segmentId: formSegmentId || undefined,
      opomba: formOpomba || undefined,
      status: 'OSNUTEK',
      // P3
      enota: ar.enota,
      originalnaVrednost,
    }
    setMeasurements((prev) => [newMeasurement, ...prev])
    pushAudit({
      akcija: 'ADD',
      meritevId: newMeasurement.id,
      opis: `Nova meritev \"${formOznaka || formLocation || newMeasurement.id.slice(-4)}\" dodana (lokalno) — ${formatMultiUnit(dolzinaMm)}`,
    })
    resetForm()
    setFormOpen(false)
  }

  function handleDeleteMeasurement(id: string) {
    const m = measurements.find((x) => x.id === id)
    setMeasurements((prev) => prev.filter((m) => m.id !== id))
    if (m) {
      pushAudit({
        akcija: 'DELETE',
        meritevId: id,
        opis: `Meritev \"${m.oznaka || m.lokacija || id.slice(-4)}\" izbrisana`,
      })
    }
    toast.success('Meritev izbrisana')
  }

  function handleDuplicateMeasurement(m: Measurement) {
    const duplicate: Measurement = {
      ...m,
      id: `local_${Date.now()}`,
      createdAt: new Date().toISOString(),
      lokacija: m.lokacija ? `${m.lokacija} (kopija)` : 'Kopija',
      oznaka: m.oznaka ? `${m.oznaka} (kopija)` : undefined,
      status: 'OSNUTEK',
    }
    setMeasurements((prev) => [duplicate, ...prev])
    pushAudit({
      akcija: 'ADD',
      meritevId: duplicate.id,
      opis: `Meritev \"${m.oznaka || m.lokacija || m.id.slice(-4)}\" podvojena`,
    })
    toast.success('Meritev podvojena!')
  }

  // P1 — cikliranje statusa meritve (OSNUTEK → POTRJENA → ARHIVIRANA → OSNUTEK)
  function handleStatusCycle(m: Measurement) {
    const currentStatus: MeasurementStatus = m.status || 'OSNUTEK'
    const nextStatus = statusCycle[currentStatus]
    const updated: Measurement = { ...m, status: nextStatus }
    setMeasurements((prev) => prev.map((x) => (x.id === m.id ? updated : x)))
    pushAudit({
      akcija: 'STATUS',
      meritevId: m.id,
      opis: `Status meritve \"${m.oznaka || m.lokacija || m.id.slice(-4)}\" spremenjen`,
      staraVrednost: statusLabels[currentStatus],
      novaVrednost: statusLabels[nextStatus],
    })
    toast.info(`Status: ${statusLabels[currentStatus]} → ${statusLabels[nextStatus]}`)
  }

  // Hitri izračun razmikov
  function getQuickSpacing(dolzinaMm: number, visinaMm: number, slatWidth = 80, maxGap = 100) {
    const n = Math.ceil((dolzinaMm - maxGap) / (maxGap + slatWidth))
    const actualGap = (dolzinaMm - n * slatWidth) / (n + 1)
    return {
      slatCount: n,
      gap: Math.round(actualGap * 10) / 10,
      compliant: actualGap <= 100,
      postSpacing: dolzinaMm / Math.max(1, n > 5 ? Math.ceil(n / 5) : 2),
    }
  }

  // ============================================
  // POVZETKI / STATISTIKA
  // ============================================

  const razdaljeMeasurements = measurements.filter((m) => !m.tipMeritve || m.tipMeritve === 'RAZDALJA')
  const visineMeasurements = measurements.filter((m) => m.tipMeritve === 'VISINA')

  const totalLength = razdaljeMeasurements.reduce((sum, m) => sum + m.dolzinaMm, 0)
  const avgLength = razdaljeMeasurements.length > 0
    ? razdaljeMeasurements.reduce((s, m) => s + m.dolzinaMm, 0) / razdaljeMeasurements.length
    : 0
  const avgHeight = visineMeasurements.length > 0
    ? visineMeasurements.reduce((s, m) => s + m.visinaMm, 0) / visineMeasurements.length
    : measurements.length > 0
      ? measurements.reduce((s, m) => s + m.visinaMm, 0) / measurements.length
      : 0
  const totalPosts = measurements.reduce((sum, m) => sum + (m.steviloStebrov || 0), 0)
  const lidarScans = measurements.filter((m) => m.lidarScanUrl).length

  const longestMeasurement = measurements.reduce(
    (max, m) => (m.dolzinaMm > max.dolzinaMm ? m : max),
    measurements[0]
  )

  const totalArea = measurements.reduce((sum, m) => sum + m.dolzinaMm * m.visinaMm, 0)

  // Vsi uporabljeni segmentId-ji (vključno s tistimi, ki niso v segments state)
  const usedSegmentIds = useMemo(() => {
    const ids = new Set<string>()
    measurements.forEach((m) => {
      if (m.segmentId) ids.add(m.segmentId)
    })
    return ids
  }, [measurements])

  const allSegments: Segment[] = useMemo(() => {
    const known = new Map(segments.map((s) => [s.id, s]))
    // dodaj segmente iz meritev, ki niso definirani
    usedSegmentIds.forEach((id) => {
      if (!known.has(id)) {
        known.set(id, { id, name: id, type: 'ravni' })
      }
    })
    return Array.from(known.values())
  }, [segments, usedSegmentIds])

  const segmentStats = useMemo(() => {
    const stats = new Map<string, { totalLength: number; avgHeight: number; count: number }>()
    allSegments.forEach((seg) => {
      const segMeas = measurements.filter((m) => m.segmentId === seg.id)
      const razdalje = segMeas.filter((m) => !m.tipMeritve || m.tipMeritve === 'RAZDALJA')
      const visine = segMeas.filter((m) => m.tipMeritve === 'VISINA')
      stats.set(seg.id, {
        totalLength: razdalje.reduce((s, m) => s + m.dolzinaMm, 0),
        avgHeight:
          visine.length > 0
            ? visine.reduce((s, m) => s + m.visinaMm, 0) / visine.length
            : segMeas.length > 0
              ? segMeas.reduce((s, m) => s + m.visinaMm, 0) / segMeas.length
              : 0,
        count: segMeas.length,
      })
    })
    return stats
  }, [allSegments, measurements])

  // P1 — števci statusov
  const statusCounts = useMemo(() => {
    const counts: Record<MeasurementStatus, number> = { OSNUTEK: 0, POTRJENA: 0, ARHIVIRANA: 0 }
    measurements.forEach((m) => {
      const s: MeasurementStatus = m.status || 'OSNUTEK'
      counts[s]++
    })
    return counts
  }, [measurements])

  // P1 — filtrirane meritve glede na status filter
  const filteredMeasurements = useMemo(() => {
    if (statusFilter === 'VSE') return measurements
    return measurements.filter((m) => (m.status || 'OSNUTEK') === statusFilter)
  }, [measurements, statusFilter])

  // Grupiranje po datumu (obstoječa logika) — uporablja filtrirane meritve
  const groupedMeasurements = useMemo((): MeasurementGroup[] => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 86400000)

    const groups: MeasurementGroup[] = []
    const grouped = new Map<string, Measurement[]>()

    const sorted = [...filteredMeasurements].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    for (const m of sorted) {
      const mDate = new Date(m.createdAt)
      const mDay = new Date(mDate.getFullYear(), mDate.getMonth(), mDate.getDate())

      let label: string
      if (mDay.getTime() === today.getTime()) {
        label = 'Danes'
      } else if (mDay.getTime() === yesterday.getTime()) {
        label = 'Včeraj'
      } else {
        label = mDate.toLocaleDateString('sl-SI', { day: 'numeric', month: 'long' })
      }

      if (!grouped.has(label)) grouped.set(label, [])
      grouped.get(label)!.push(m)
    }

    for (const [label, meas] of grouped) {
      groups.push({ label, date: new Date(meas[0].createdAt), measurements: meas })
    }

    return groups
  }, [filteredMeasurements])

  // ============================================
  // UKREPI ZA SEGMENTE
  // ============================================

  function handleAddSegment() {
    if (!newSegmentName.trim()) {
      toast.error('Vnesite ime segmenta')
      return
    }
    const id = newSegmentName
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9čšž-]/g, '')
      .slice(0, 30)
    if (segments.some((s) => s.id === id)) {
      toast.error('Segment s tem imenom že obstaja')
      return
    }
    setSegments((prev) => [...prev, { id, name: newSegmentName.trim(), type: newSegmentType }])
    setNewSegmentName('')
    setNewSegmentType('ravni')
    setAddSegmentOpen(false)
    toast.success(`Segment "${newSegmentName.trim()}" dodan`)
  }

  function handleDeleteSegment(segId: string) {
    setSegments((prev) => prev.filter((s) => s.id !== segId))
    setExpandedSegments((prev) => {
      const next = new Set(prev)
      next.delete(segId)
      return next
    })
    toast.success('Segment izbrisan')
  }

  function toggleSegment(id: string) {
    setExpandedSegments((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ============================================
  // KALIBRACIJA
  // ============================================

  function handleComputeCalibration() {
    const realMm = parseFloat(calibration.realMm)
    const px = parseFloat(calibration.pixelDistance)
    if (!realMm || realMm <= 0 || !px || px <= 0) {
      toast.error('Vnesite veljavno realno dolžino in piksel razdaljo')
      return
    }
    const pxPerMm = px / realMm
    const newCal = { ...calibration, pixelsPerMm: pxPerMm }
    setCalibration(newCal)
    try {
      localStorage.setItem(`roksal_calibration_${selectedProject}`, JSON.stringify(newCal))
    } catch {
      // ignore
    }
    toast.success(`Umeritev shranjena: ${pxPerMm.toFixed(2)} px/mm`)
  }

  function handleClearCalibration() {
    const cleared: CalibrationState = { realMm: '', pixelDistance: '', pixelsPerMm: null, note: '' }
    setCalibration(cleared)
    try {
      localStorage.removeItem(`roksal_calibration_${selectedProject}`)
    } catch {
      // ignore
    }
    toast.info('Umeritev izbrisana')
  }

  // ============================================
  // HITRI ZAČETEK (quick-add)
  // ============================================

  function handleQuickAdd(tip: TipMeritve) {
    setFormOpen(true)
    setFormTipMeritve(tip)
    if (tip === 'KOT' || tip === 'NAGIB') {
      setInclinometerMode(tip)
      setInclinometerOpen(true)
    }
    // P3 — za nove kotne tipe odpri kotomer
    if (tip === 'KOT_VOGAL' || tip === 'KOT_STOPNISCE') {
      setKotomerMode(tip)
      setKotomerOpen(true)
    }
  }

  // Shrani inclinometer meritev
  async function saveInclinometerReading(kotStopinje: number, smer: string, lokacija: string) {
    if (!selectedProject) {
      toast.error('Izberite projekt!')
      return
    }
    const arMetadata: ArMetadata = {
      tipMeritve: inclinometerMode,
      oznaka: `${inclinometerMode === 'KOT' ? 'Kot' : 'Nagib'} — ${lokacija}`,
      segmentId: formSegmentId || undefined,
      opomba: `${inclinometerMode === 'KOT' ? 'Kot' : 'Nagib'} ${kotStopinje}° (${smer === 'Y' ? 'levo-desno' : 'naprej-nazaj'})`,
      kotStopinje,
      smer,
      lokacija,
    }

    try {
      const res = await fetch('/api/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject,
          dolzinaMm: 1,
          visinaMm: 1,
          arMetadata,
          gpsLokacija: { lat: 46.2397, lng: 14.3556 },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const newMeasurement: Measurement = {
          ...data,
          lokacija,
          tipMeritve: inclinometerMode,
          oznaka: arMetadata.oznaka,
          opomba: arMetadata.opomba,
          status: 'OSNUTEK',
          kotStopinje,
        }
        setMeasurements((prev) => [newMeasurement, ...prev])
        pushAudit({
          akcija: 'ADD',
          meritevId: newMeasurement.id,
          opis: `${inclinometerMode === 'KOT' ? 'Kot' : 'Nagib'} ${kotStopinje}° shranjen (${lokacija})`,
        })
        toast.success(`${inclinometerMode === 'KOT' ? 'Kot' : 'Nagib'} ${kotStopinje}° shranjen`)
        setInclinometerOpen(false)
      } else {
        // fallback lokalno
        const newMeasurement: Measurement = {
          id: `local_${Date.now()}`,
          dolzinaMm: 1,
          visinaMm: 1,
          createdAt: new Date().toISOString(),
          projectId: selectedProject,
          lokacija,
          arMetadata: JSON.stringify({ ...arMetadata, status: 'OSNUTEK' }),
          tipMeritve: inclinometerMode,
          oznaka: arMetadata.oznaka,
          opomba: arMetadata.opomba,
          status: 'OSNUTEK',
          kotStopinje,
        }
        setMeasurements((prev) => [newMeasurement, ...prev])
        pushAudit({
          akcija: 'ADD',
          meritevId: newMeasurement.id,
          opis: `${inclinometerMode === 'KOT' ? 'Kot' : 'Nagib'} ${kotStopinje}° shranjen (lokalno) — ${lokacija}`,
        })
        toast.success(`${inclinometerMode === 'KOT' ? 'Kot' : 'Nagib'} ${kotStopinje}° shranjen (lokalno)`)
        setInclinometerOpen(false)
      }
    } catch {
      toast.error('Napaka pri shranjevanju')
    }
  }

  // ============================================
  // P3 — STOPNIŠČNI ČAROVNIK (stair wizard)
  // ============================================

  const stairCalc = useMemo(() => {
    return calculateStairDimensions(
      parseFloat(stairSkupnaVisina) || 0,
      parseInt(stairStStopnic) || 0,
      parseFloat(stairGlobina) || 0,
      stairSirina ? parseFloat(stairSirina) : undefined
    )
  }, [stairSkupnaVisina, stairStStopnic, stairGlobina, stairSirina])

  async function handleStairCreateMeasurements() {
    if (!selectedProject) {
      toast.error('Izberite projekt!')
      return
    }
    if (!stairCalc.valid) {
      toast.error('Vnesite veljavne podatke za stopnišče!')
      return
    }
    const skupnaVisinaMm = parseFloat(stairSkupnaVisina) || 0
    const stStopnic = parseInt(stairStStopnic) || 0
    const globinaStopniceMm = parseFloat(stairGlobina) || 0
    const targetSegment = stairSegmentId || 'stopniscje'
    // zagotovi, da segment obstaja
    if (!segments.some((s) => s.id === targetSegment)) {
      setSegments((prev) => [
        ...prev,
        { id: targetSegment, name: 'Stopnišče', type: 'stopniscje' },
      ])
    }

    const newMeas: Array<{ dolzinaMm: number; visinaMm: number; ar: ArMetadata }> = [
      {
        dolzinaMm: 1,
        visinaMm: Math.round(skupnaVisinaMm),
        ar: {
          tipMeritve: 'VISINA',
          oznaka: 'skupna višina stopnišča',
          segmentId: targetSegment,
          opomba: `Skupna višina: ${Math.round(skupnaVisinaMm)}mm`,
          status: 'OSNUTEK',
          enota: 'mm',
        },
      },
      {
        dolzinaMm: Math.round(globinaStopniceMm),
        visinaMm: 1,
        ar: {
          tipMeritve: 'GLOBINA',
          oznaka: 'globina posamezne stopnice',
          segmentId: targetSegment,
          opomba: `Globina/vertikalna: ${Math.round(globinaStopniceMm)}mm`,
          status: 'OSNUTEK',
          enota: 'mm',
        },
      },
      {
        dolzinaMm: 1,
        visinaMm: 1,
        ar: {
          tipMeritve: 'KOT_STOPNISCE',
          oznaka: 'kot stopnice (rake)',
          segmentId: targetSegment,
          opomba: `Kot stopnice: ${stairCalc.kotStopinje.toFixed(1)}° (atan(${Math.round(stairCalc.visinaPosamezne)}/${Math.round(globinaStopniceMm)}))`,
          kotStopinje: Number(stairCalc.kotStopinje.toFixed(1)),
          status: 'OSNUTEK',
          enota: 'mm',
        },
      },
      {
        dolzinaMm: Math.round(stairCalc.dolzinaKosa),
        visinaMm: 1,
        ar: {
          tipMeritve: 'RAZDALJA',
          oznaka: 'dolžina kosa (stringer)',
          segmentId: targetSegment,
          opomba: `sqrt(${Math.round(stairCalc.visinaPosamezne)}² + ${Math.round(globinaStopniceMm)}²) × ${stStopnic} = ${Math.round(stairCalc.dolzinaKosa)}mm`,
          status: 'OSNUTEK',
          enota: 'mm',
        },
      },
      {
        dolzinaMm: stStopnic,
        visinaMm: 1,
        ar: {
          tipMeritve: 'SEGMENT',
          oznaka: `št. stopnic: ${stStopnic}`,
          segmentId: targetSegment,
          opomba: `Skupno število stopnic: ${stStopnic}`,
          status: 'OSNUTEK',
          enota: 'mm',
        },
      },
    ]

    let okCount = 0
    let localCount = 0
    for (const item of newMeas) {
      try {
        const res = await fetch('/api/measurements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: selectedProject,
            dolzinaMm: item.dolzinaMm,
            visinaMm: item.visinaMm,
            arMetadata: item.ar,
            gpsLokacija: { lat: 46.2397, lng: 14.3556 },
          }),
        })
        if (res.ok) {
          const data = await res.json()
          const newM: Measurement = {
            ...data,
            lokacija: null,
            steviloStebrov: null,
            tipPodlage: null,
            kot: null,
            opombe: null,
            tipMeritve: item.ar.tipMeritve,
            oznaka: item.ar.oznaka,
            segmentId: item.ar.segmentId,
            opomba: item.ar.opomba,
            status: 'OSNUTEK',
            enota: 'mm',
            kotStopinje: item.ar.kotStopinje ?? null,
          }
          setMeasurements((prev) => [newM, ...prev])
          okCount++
        } else {
          const localM: Measurement = {
            id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            dolzinaMm: item.dolzinaMm,
            visinaMm: item.visinaMm,
            lidarScanUrl: null,
            gpsLokacija: JSON.stringify({ lat: 46.2397, lng: 14.3556 }),
            createdAt: new Date().toISOString(),
            projectId: selectedProject,
            lokacija: null,
            steviloStebrov: null,
            tipPodlage: null,
            kot: null,
            opombe: null,
            arMetadata: JSON.stringify(item.ar),
            tipMeritve: item.ar.tipMeritve,
            oznaka: item.ar.oznaka,
            segmentId: item.ar.segmentId,
            opomba: item.ar.opomba,
            status: 'OSNUTEK',
            enota: 'mm',
            kotStopinje: item.ar.kotStopinje ?? null,
          }
          setMeasurements((prev) => [localM, ...prev])
          localCount++
        }
      } catch {
        const localM: Measurement = {
          id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          dolzinaMm: item.dolzinaMm,
          visinaMm: item.visinaMm,
          lidarScanUrl: null,
          gpsLokacija: JSON.stringify({ lat: 46.2397, lng: 14.3556 }),
          createdAt: new Date().toISOString(),
          projectId: selectedProject,
          lokacija: null,
          steviloStebrov: null,
          tipPodlage: null,
          kot: null,
          opombe: null,
          arMetadata: JSON.stringify(item.ar),
          tipMeritve: item.ar.tipMeritve,
          oznaka: item.ar.oznaka,
          segmentId: item.ar.segmentId,
          opomba: item.ar.opomba,
          status: 'OSNUTEK',
          enota: 'mm',
          kotStopinje: item.ar.kotStopinje ?? null,
        }
        setMeasurements((prev) => [localM, ...prev])
        localCount++
      }
    }

    pushAudit({
      akcija: 'ADD',
      meritevId: 'stair-wizard',
      opis: `Stopniščni čarovnik: ${stStopnic} stopnic, ${Math.round(skupnaVisinaMm)}mm višine, kot ${stairCalc.kotStopinje.toFixed(1)}° — ${newMeas.length} meritev kreiranih`,
    })
    toast.success(
      `Ustvarjeno ${newMeas.length} meritev${localCount > 0 ? ` (${okCount} sinhroniziranih, ${localCount} lokalno)` : ''}`
    )
    setStairWizardOpen(false)
  }

  function handleSaveStairTemplate() {
    if (!stairCalc.valid) {
      toast.error('Vnesite veljavne podatke za shranjevanje predloge!')
      return
    }
    const naziv = window.prompt('Ime predloge za stopnišče:', `Stopnišče ${stairStStopnic} stopnic`)
    if (!naziv) return
    const template: StairTemplate = {
      id: `stair_${Date.now()}`,
      naziv,
      skupnaVisinaMm: parseFloat(stairSkupnaVisina) || 0,
      stStopnic: parseInt(stairStStopnic) || 0,
      globinaStopniceMm: parseFloat(stairGlobina) || 0,
      sirinaStopniceMm: stairSirina ? parseFloat(stairSirina) : undefined,
      createdAt: new Date().toISOString(),
    }
    const updated = [template, ...stairTemplates].slice(0, 30)
    setStairTemplates(updated)
    saveStairTemplates(updated)
    toast.success(`Predloga "${naziv}" shranjena`)
  }

  function handleLoadStairTemplate(t: StairTemplate) {
    setStairSkupnaVisina(String(t.skupnaVisinaMm))
    setStairStStopnic(String(t.stStopnic))
    setStairGlobina(String(t.globinaStopniceMm))
    setStairSirina(t.sirinaStopniceMm ? String(t.sirinaStopniceMm) : '')
    toast.info(`Predloga "${t.naziv}" naložena`)
  }

  function handleDeleteStairTemplate(id: string) {
    const updated = stairTemplates.filter((t) => t.id !== id)
    setStairTemplates(updated)
    saveStairTemplates(updated)
    toast.success('Predloga izbrisana')
  }

  // ============================================
  // P3 — KOTOMER (save callback)
  // ============================================

  async function saveKotomerReading(
    kotStopinje: number,
    notranjiKot: number | null,
    zunanjiKot: number | null,
    lokacija: string
  ) {
    if (!selectedProject) {
      toast.error('Izberite projekt!')
      return
    }
    const isVogal = kotomerMode === 'KOT_VOGAL'
    const oznaka = isVogal
      ? `Vogal — ${lokacija}`
      : kotomerMode === 'KOT_STOPNISCE'
        ? `Kot stopnice — ${lokacija}`
        : `Kot — ${lokacija}`
    const arMetadata: ArMetadata = {
      tipMeritve: kotomerMode,
      oznaka,
      segmentId: formSegmentId || undefined,
      opomba: isVogal
        ? `Notranji kot: ${notranjiKot ?? '—'}°, Zunanji kot: ${zunanjiKot ?? '—'}°`
        : `Kot: ${kotStopinje}° (${lokacija})`,
      kotStopinje,
      notranjiKot: notranjiKot ?? undefined,
      zunanjiKot: zunanjiKot ?? undefined,
      lokacija,
      status: 'OSNUTEK',
    }

    try {
      const res = await fetch('/api/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject,
          dolzinaMm: 1,
          visinaMm: 1,
          arMetadata,
          gpsLokacija: { lat: 46.2397, lng: 14.3556 },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const newM: Measurement = {
          ...data,
          lokacija,
          tipMeritve: kotomerMode,
          oznaka,
          opomba: arMetadata.opomba,
          status: 'OSNUTEK',
          kotStopinje,
          notranjiKot: notranjiKot ?? null,
          zunanjiKot: zunanjiKot ?? null,
        }
        setMeasurements((prev) => [newM, ...prev])
        pushAudit({
          akcija: 'ADD',
          meritevId: newM.id,
          opis: `${oznaka} shranjen — ${kotStopinje}°`,
        })
        toast.success(`${oznaka} shranjen`)
        setKotomerOpen(false)
      } else {
        const newM: Measurement = {
          id: `local_${Date.now()}`,
          dolzinaMm: 1,
          visinaMm: 1,
          createdAt: new Date().toISOString(),
          projectId: selectedProject,
          lokacija,
          arMetadata: JSON.stringify({ ...arMetadata, status: 'OSNUTEK' }),
          tipMeritve: kotomerMode,
          oznaka,
          opomba: arMetadata.opomba,
          status: 'OSNUTEK',
          kotStopinje,
          notranjiKot: notranjiKot ?? null,
          zunanjiKot: zunanjiKot ?? null,
        }
        setMeasurements((prev) => [newM, ...prev])
        pushAudit({
          akcija: 'ADD',
          meritevId: newM.id,
          opis: `${oznaka} shranjen (lokalno) — ${kotStopinje}°`,
        })
        toast.success(`${oznaka} shranjen (lokalno)`)
        setKotomerOpen(false)
      }
    } catch {
      toast.error('Napaka pri shranjevanju')
    }
  }

  // ============================================
  // P3 — ŠTEBRICKI (STEBR) — dodajanje
  // ============================================

  async function handleAddSteber() {
    if (!selectedProject) {
      toast.error('Izberite projekt!')
      return
    }
    if (!stebriSegmentId) {
      toast.error('Izberite segment za steber!')
      return
    }
    const pozicijaMm = convertToMm(parseFloat(stebriPozicija) || 0, stebriPozicijaUnit)
    if (!Number.isFinite(pozicijaMm) || pozicijaMm <= 0) {
      toast.error('Vnesite veljavno pozicijo stebra!')
      return
    }
    const visinaStebra = parseInt(stebriVisina) || 1100
    const steberNum = getNextStebriNumber(measurements, stebriSegmentId)
    const oznaka = `S${steberNum}`
    const razmikMm = stebriRazmik && stebriRazmik !== '—' ? parseInt(stebriRazmik) : 0
    const arMetadata: ArMetadata = {
      tipMeritve: 'STEBR',
      oznaka,
      segmentId: stebriSegmentId,
      opomba: `Stebriček S${steberNum} — ${tipStebraLabels[stebriTipStebra]} (${materialStebraLabels[stebriMaterial]}), višina ${visinaStebra}mm, pozicija ${Math.round(pozicijaMm)}mm`,
      status: 'OSNUTEK',
      tipStebra: stebriTipStebra,
      materialStebra: stebriMaterial,
      visinaStebraMm: visinaStebra,
      pozicijaMm: Math.round(pozicijaMm),
      razmikMm: razmikMm || undefined,
      steberOznaka: oznaka,
      enota: stebriPozicijaUnit,
      originalnaVrednost: parseFloat(stebriPozicija) || 0,
    }

    try {
      const res = await fetch('/api/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject,
          dolzinaMm: Math.max(1, Math.round(pozicijaMm)),
          visinaMm: visinaStebra,
          arMetadata,
          gpsLokacija: { lat: 46.2397, lng: 14.3556 },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const newM: Measurement = {
          ...data,
          lokacija: null,
          tipMeritve: 'STEBR',
          oznaka,
          segmentId: stebriSegmentId,
          opomba: arMetadata.opomba,
          status: 'OSNUTEK',
          tipStebra: stebriTipStebra,
          materialStebra: stebriMaterial,
          visinaStebraMm: visinaStebra,
          pozicijaMm: Math.round(pozicijaMm),
          razmikMm: razmikMm || null,
          steberOznaka: oznaka,
          enota: stebriPozicijaUnit,
          originalnaVrednost: parseFloat(stebriPozicija) || 0,
        }
        setMeasurements((prev) => [newM, ...prev])
        pushAudit({
          akcija: 'ADD',
          meritevId: newM.id,
          opis: `Stebriček ${oznaka} dodan — ${tipStebraLabels[stebriTipStebra]}, pozicija ${Math.round(pozicijaMm)}mm`,
        })
        toast.success(`Stebriček ${oznaka} dodan!`)
      } else {
        const newM: Measurement = {
          id: `local_${Date.now()}`,
          dolzinaMm: Math.max(1, Math.round(pozicijaMm)),
          visinaMm: visinaStebra,
          lidarScanUrl: null,
          gpsLokacija: JSON.stringify({ lat: 46.2397, lng: 14.3556 }),
          createdAt: new Date().toISOString(),
          projectId: selectedProject,
          lokacija: null,
          arMetadata: JSON.stringify({ ...arMetadata, status: 'OSNUTEK' }),
          tipMeritve: 'STEBR',
          oznaka,
          segmentId: stebriSegmentId,
          opomba: arMetadata.opomba,
          status: 'OSNUTEK',
          tipStebra: stebriTipStebra,
          materialStebra: stebriMaterial,
          visinaStebraMm: visinaStebra,
          pozicijaMm: Math.round(pozicijaMm),
          razmikMm: razmikMm || null,
          steberOznaka: oznaka,
          enota: stebriPozicijaUnit,
          originalnaVrednost: parseFloat(stebriPozicija) || 0,
        }
        setMeasurements((prev) => [newM, ...prev])
        pushAudit({
          akcija: 'ADD',
          meritevId: newM.id,
          opis: `Stebriček ${oznaka} dodan (lokalno) — pozicija ${Math.round(pozicijaMm)}mm`,
        })
        toast.success(`Stebriček ${oznaka} dodan (lokalno)!`)
      }
    } catch {
      toast.error('Napaka pri shranjevanju stebra')
    }
    // reset forme
    setStebriPozicija('')
    setStebriRazmik('')
    setStebriTipStebra('VMESNI')
    setStebriMaterial('ALU')
    setStebriVisina('1100')
    setStebriPozicijaUnit('mm')
  }

  function handleExportStebriCSV(segmentId: string) {
    const stebri = measurements
      .filter((m) => m.tipMeritve === 'STEBR' && m.segmentId === segmentId)
      .sort((a, b) => (a.pozicijaMm || 0) - (b.pozicijaMm || 0))
    if (stebri.length === 0) {
      toast.error('Ni stebrov za izvoz')
      return
    }
    const header = 'Oznaka,Tip,Pozicija(mm),Razmik(mm),Visina(mm),Material,Opomba'
    const rows = stebri.map((m) => {
      const o = (m.steberOznaka || m.oznaka || '').replace(/"/g, '""')
      const t = m.tipStebra ? tipStebraLabels[m.tipStebra] : ''
      const poz = m.pozicijaMm ? String(Math.round(m.pozicijaMm)) : ''
      const raz = m.razmikMm ? String(Math.round(m.razmikMm)) : '—'
      const vis = m.visinaStebraMm ? String(Math.round(m.visinaStebraMm)) : ''
      const mat = m.materialStebra ? materialStebraLabels[m.materialStebra] : ''
      const op = (m.opomba || '').replace(/"/g, '""')
      return `"${o}","${t}",${poz},${raz},${vis},"${mat}","${op}"`
    })
    const csvContent = '\uFEFF' + header + '\n' + rows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `stebri_${segmentId}_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    pushAudit({
      akcija: 'EDIT',
      meritevId: 'stebri-csv',
      opis: `Izvoženih ${stebri.length} stebrov (CSV) za segment ${segmentId}`,
    })
    toast.success(`Izvozenih ${stebri.length} stebrov (CSV)`)
  }

  // ============================================
  // P3 — WPC palice (dodaj kot materiale)
  // ============================================

  async function handleAddWpcPaliceAsStebri(segment: Segment) {
    if (!selectedProject) {
      toast.error('Izberite projekt!')
      return
    }
    // uporabi dimenzije iz segmenta (segment stats)
    const segMeas = measurements.filter((m) => m.segmentId === segment.id)
    const razdalje = segMeas.filter((m) => !m.tipMeritve || m.tipMeritve === 'RAZDALJA')
    const visine = segMeas.filter((m) => m.tipMeritve === 'VISINA')
    const dolzinaMm = razdalje.length > 0 ? Math.max(...razdalje.map((m) => m.dolzinaMm)) : 0
    const visinaMm = visine.length > 0
      ? Math.max(...visine.map((m) => m.visinaMm))
      : segMeas.length > 0
        ? Math.max(...segMeas.map((m) => m.visinaMm))
        : 0

    const stPalic = calcWpcPalice(
      segment.type,
      dolzinaMm,
      visinaMm,
      wpcSirinaPalice,
      wpcRazmikPalic
    )
    if (stPalic === 0) {
      toast.error('Segment nima dimenzij — dodajte najprej RAZDALJA/VISINA meritev!')
      return
    }

    const orientacija = segment.type as 'WPC_POKOCNE' | 'WPC_VODORAVNE' | 'WPC_POSEVNE'
    let okCount = 0
    let localCount = 0
    for (let i = 0; i < stPalic; i++) {
      const oznaka = `P${i + 1}`
      const pozicijaMm = i * (wpcSirinaPalice + wpcRazmikPalic) + wpcSirinaPalice / 2
      const arMetadata: ArMetadata = {
        tipMeritve: 'STEBR',
        oznaka,
        segmentId: segment.id,
        opomba: `WPC palica P${i + 1} (${segmentTypeLabels[segment.type]}, ${wpcSirinaPalice}×${wpcDebelinaPalice}mm, razmak ${wpcRazmikPalic}mm)`,
        status: 'OSNUTEK',
        tipStebra: 'VMESNI',
        materialStebra: 'WPC',
        visinaStebraMm: visinaMm || 1100,
        pozicijaMm: Math.round(pozicijaMm),
        steberOznaka: oznaka,
        orientacijaPalic: orientacija,
        sirinaPalice: wpcSirinaPalice,
        debelinaPalice: wpcDebelinaPalice,
        razmikPalic: wpcRazmikPalic,
        kotPosevnih: segment.type === 'WPC_POSEVNE' ? wpcKotPosevnih : undefined,
        stPalic,
        enota: 'mm',
      }
      try {
        const res = await fetch('/api/measurements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: selectedProject,
            dolzinaMm: Math.max(1, Math.round(pozicijaMm)),
            visinaMm: visinaMm || 1100,
            arMetadata,
            gpsLokacija: { lat: 46.2397, lng: 14.3556 },
          }),
        })
        if (res.ok) {
          const data = await res.json()
          const newM: Measurement = {
            ...data,
            lokacija: null,
            tipMeritve: 'STEBR',
            oznaka,
            segmentId: segment.id,
            opomba: arMetadata.opomba,
            status: 'OSNUTEK',
            tipStebra: 'VMESNI',
            materialStebra: 'WPC',
            visinaStebraMm: visinaMm || 1100,
            pozicijaMm: Math.round(pozicijaMm),
            steberOznaka: oznaka,
            orientacijaPalic: orientacija,
            sirinaPalice: wpcSirinaPalice,
            debelinaPalice: wpcDebelinaPalice,
            razmikPalic: wpcRazmikPalic,
            kotPosevnih: segment.type === 'WPC_POSEVNE' ? wpcKotPosevnih : undefined,
            stPalic,
            enota: 'mm',
          }
          setMeasurements((prev) => [newM, ...prev])
          okCount++
        } else {
          const localM: Measurement = {
            id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            dolzinaMm: Math.max(1, Math.round(pozicijaMm)),
            visinaMm: visinaMm || 1100,
            lidarScanUrl: null,
            gpsLokacija: JSON.stringify({ lat: 46.2397, lng: 14.3556 }),
            createdAt: new Date().toISOString(),
            projectId: selectedProject,
            lokacija: null,
            arMetadata: JSON.stringify({ ...arMetadata, status: 'OSNUTEK' }),
            tipMeritve: 'STEBR',
            oznaka,
            segmentId: segment.id,
            opomba: arMetadata.opomba,
            status: 'OSNUTEK',
            tipStebra: 'VMESNI',
            materialStebra: 'WPC',
            visinaStebraMm: visinaMm || 1100,
            pozicijaMm: Math.round(pozicijaMm),
            steberOznaka: oznaka,
            orientacijaPalic: orientacija,
            sirinaPalice: wpcSirinaPalice,
            debelinaPalice: wpcDebelinaPalice,
            razmikPalic: wpcRazmikPalic,
            kotPosevnih: segment.type === 'WPC_POSEVNE' ? wpcKotPosevnih : undefined,
            stPalic,
            enota: 'mm',
          }
          setMeasurements((prev) => [localM, ...prev])
          localCount++
        }
      } catch {
        const localM: Measurement = {
          id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          dolzinaMm: Math.max(1, Math.round(pozicijaMm)),
          visinaMm: visinaMm || 1100,
          lidarScanUrl: null,
          gpsLokacija: JSON.stringify({ lat: 46.2397, lng: 14.3556 }),
          createdAt: new Date().toISOString(),
          projectId: selectedProject,
          lokacija: null,
          arMetadata: JSON.stringify({ ...arMetadata, status: 'OSNUTEK' }),
          tipMeritve: 'STEBR',
          oznaka,
          segmentId: segment.id,
          opomba: arMetadata.opomba,
          status: 'OSNUTEK',
          tipStebra: 'VMESNI',
          materialStebra: 'WPC',
          visinaStebraMm: visinaMm || 1100,
          pozicijaMm: Math.round(pozicijaMm),
          steberOznaka: oznaka,
          orientacijaPalic: orientacija,
          sirinaPalice: wpcSirinaPalice,
          debelinaPalice: wpcDebelinaPalice,
          razmikPalic: wpcRazmikPalic,
          kotPosevnih: segment.type === 'WPC_POSEVNE' ? wpcKotPosevnih : undefined,
          stPalic,
          enota: 'mm',
        }
        setMeasurements((prev) => [localM, ...prev])
        localCount++
      }
    }

    pushAudit({
      akcija: 'ADD',
      meritevId: 'wpc-palice',
      opis: `WPC palice dodane: ${stPalic} kos (${segmentTypeLabels[segment.type]}, ${wpcSirinaPalice}×${wpcDebelinaPalice}mm, razmak ${wpcRazmikPalic}mm) v segment ${segment.id}`,
    })
    toast.success(
      `Dodanih ${stPalic} WPC palic${localCount > 0 ? ` (${okCount} sinhroniziranih, ${localCount} lokalno)` : ''}`
    )
  }

  function handleExportCSV() {
    if (measurements.length === 0) {
      toast.error('Ni meritev za izvoz')
      return
    }
    // P1 — dodani stolpci za multi-unit (mm, cm, m) in status
    const header = 'Oznaka,Tip,Status,Lokacija,Segment,Dolzina(mm),Dolzina(cm),Dolzina(m),Visina(mm),Visina(cm),Visina(m),Stebri,Podlaga,Kot,Opomba,Opombe,Datum'
    const rows = measurements.map((m) => {
      const oznaka = (m.oznaka || '').replace(/"/g, '""')
      const tip = m.tipMeritve ? tipMeritveLabels[m.tipMeritve] : 'Razdalja'
      const status = statusLabels[m.status || 'OSNUTEK']
      const lokacija = (m.lokacija || '').replace(/"/g, '""')
      const segment = (m.segmentId || '').replace(/"/g, '""')
      const dMm = String(m.dolzinaMm)
      const dCm = String(Math.round(m.dolzinaMm / 10))
      const dM = (m.dolzinaMm / 1000).toFixed(2)
      const vMm = String(m.visinaMm)
      const vCm = String(Math.round(m.visinaMm / 10))
      const vM = (m.visinaMm / 1000).toFixed(2)
      const stebri = m.steviloStebrov ? String(m.steviloStebrov) : ''
      const podlaga = m.tipPodlage ? (groundTypeLabels[m.tipPodlage as GroundType] || m.tipPodlage) : ''
      const kot = m.kot ? String(m.kot) : ''
      const opomba = (m.opomba || '').replace(/"/g, '""')
      const opombe = (m.opombe || '').replace(/"/g, '""')
      const datum = new Date(m.createdAt).toLocaleDateString('sl-SI')
      return `"${oznaka}","${tip}","${status}","${lokacija}","${segment}",${dMm},${dCm},${dM},${vMm},${vCm},${vM},"${stebri}","${podlaga}",${kot},"${opomba}","${opombe}",${datum}`
    })
    const csvContent = '\uFEFF' + header + '\n' + rows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `meritve_${selectedProject}_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('CSV izvožen!')
  }

  // ============================================
  // IZVOZ PDF
  // ============================================

  function handleExportPDF() {
    if (measurements.length === 0) {
      toast.error('Ni meritev za izvoz')
      return
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const projectName = projects.find((p) => p.id === selectedProject)?.nazivProjekta || 'Brez projekta'

    // Glava
    doc.setFillColor(29, 43, 62) // roksal-navy
    doc.rect(0, 0, pageW, 22, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('ROKSAL — Seznam meritev', 14, 14)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Projekt: ${projectName}`, 14, 19)

    // Povzetek
    doc.setTextColor(40, 40, 40)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Povzetek', 14, 32)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const summary = [
      `Skupna dolžina: ${formatDimension(totalLength)}`,
      `Povprečna višina: ${formatDimension(Math.round(avgHeight))}`,
      `Število meritev: ${measurements.length}`,
      `Število segmentov: ${allSegments.length}`,
      `Najdaljša meritev: ${longestMeasurement ? formatDimension(longestMeasurement.dolzinaMm) : '—'}`,
      `Skupna površina: ${formatM2(totalArea)}`,
    ]
    summary.forEach((s, i) => {
      const x = 14 + (i % 2) * (pageW / 2 - 14)
      const y = 38 + Math.floor(i / 2) * 5
      doc.text(s, x, y)
    })

    // Tabela meritev
    autoTable(doc, {
      startY: 56,
      head: [['#', 'Oznaka', 'Tip', 'Segment', 'Dolžina', 'Višina', 'Kot', 'Datum']],
      body: measurements.map((m, i) => [
        String(i + 1),
        m.oznaka || m.lokacija || `Meritev #${m.id.slice(-4)}`,
        m.tipMeritve ? tipMeritveLabels[m.tipMeritve] : 'Razdalja',
        m.segmentId || '—',
        formatDimension(m.dolzinaMm),
        formatDimension(m.visinaMm),
        m.kot ? `${m.kot}°` : '—',
        new Date(m.createdAt).toLocaleDateString('sl-SI'),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [29, 43, 62], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        0: { cellWidth: 8 },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
      },
      margin: { left: 14, right: 14 },
    })

    // Noga
    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 56
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text(
      `Izvozeno ${new Date().toLocaleString('sl-SI')} • Roksal Kranj`,
      14,
      Math.min(finalY + 10, doc.internal.pageSize.getHeight() - 10)
    )

    doc.save(`meritve_${selectedProject}_${new Date().toISOString().slice(0, 10)}.pdf`)
    toast.success('PDF izvožen!')
  }

  // ============================================
  // P1 — PREDLOGE MERITEV (templates)
  // ============================================

  async function handleApplyPredloga(predlogaId: string) {
    if (!selectedProject) {
      toast.error('Izberite projekt!')
      return
    }
    if (predlogaId === 'prazen') {
      resetForm()
      setFormOpen(true)
      toast.info('Odprta forma za novo meritev')
      return
    }

    const newSegs: Segment[] = []
    const newMeas: Array<{ dolzinaMm: number; visinaMm: number; ar: ArMetadata }> = []

    if (predlogaId === 'balkon3m') {
      if (!segments.some((s) => s.id === 'balkon')) {
        newSegs.push({ id: 'balkon', name: 'Balkon', type: 'ravni' })
      }
      newMeas.push({
        dolzinaMm: 3000,
        visinaMm: 1100,
        ar: { tipMeritve: 'RAZDALJA', oznaka: 'dolžina balkona', segmentId: 'balkon', status: 'OSNUTEK' },
      })
      newMeas.push({
        dolzinaMm: 1,
        visinaMm: 1100,
        ar: { tipMeritve: 'VISINA', oznaka: 'višina ograje', segmentId: 'balkon', status: 'OSNUTEK' },
      })
      newMeas.push({
        dolzinaMm: 1,
        visinaMm: 1,
        ar: { tipMeritve: 'GLOBINA', oznaka: 'debela stene', segmentId: 'balkon', opomba: 'Debelina stene (mm)', status: 'OSNUTEK' },
      })
    } else if (predlogaId === 'stopnisce') {
      if (!segments.some((s) => s.id === 'stopnisce')) {
        newSegs.push({ id: 'stopnisce', name: 'Stopnišče', type: 'stopniscje' })
      }
      newMeas.push({
        dolzinaMm: 2400,
        visinaMm: 1,
        ar: { tipMeritve: 'SEGMENT', oznaka: 'vodoravno', segmentId: 'stopnisce', status: 'OSNUTEK' },
      })
      newMeas.push({
        dolzinaMm: 1,
        visinaMm: 1800,
        ar: { tipMeritve: 'VISINA', oznaka: 'skupna višina', segmentId: 'stopnisce', status: 'OSNUTEK' },
      })
    } else if (predlogaId === 'loblika') {
      if (!segments.some((s) => s.id === 'severni-del')) {
        newSegs.push({ id: 'severni-del', name: 'Severni del', type: 'ravni' })
      }
      if (!segments.some((s) => s.id === 'vzhodni-del')) {
        newSegs.push({ id: 'vzhodni-del', name: 'Vzhodni del', type: 'kotni' })
      }
      newMeas.push({
        dolzinaMm: 4000,
        visinaMm: 1100,
        ar: { tipMeritve: 'RAZDALJA', oznaka: 'severni — dolžina', segmentId: 'severni-del', status: 'OSNUTEK' },
      })
      newMeas.push({
        dolzinaMm: 2000,
        visinaMm: 1100,
        ar: { tipMeritve: 'RAZDALJA', oznaka: 'vzhodni — dolžina', segmentId: 'vzhodni-del', status: 'OSNUTEK' },
      })
    } else if (predlogaId === 'terasa5m') {
      if (!segments.some((s) => s.id === 'terasa')) {
        newSegs.push({ id: 'terasa', name: 'Terasa', type: 'ravni' })
      }
      newMeas.push({
        dolzinaMm: 5000,
        visinaMm: 1000,
        ar: { tipMeritve: 'RAZDALJA', oznaka: 'terasa — dolžina', segmentId: 'terasa', status: 'OSNUTEK' },
      })
    }

    // Dodaj nove segmente v state + localStorage
    if (newSegs.length > 0) {
      setSegments((prev) => [...prev, ...newSegs])
    }

    // POST vsako meritev na API; ob napaki shrani lokalno
    let successCount = 0
    let localCount = 0
    for (const item of newMeas) {
      try {
        const res = await fetch('/api/measurements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: selectedProject,
            dolzinaMm: item.dolzinaMm,
            visinaMm: item.visinaMm,
            arMetadata: item.ar,
            gpsLokacija: { lat: 46.2397, lng: 14.3556 },
          }),
        })
        if (res.ok) {
          const data = await res.json()
          const newM: Measurement = {
            ...data,
            lokacija: null,
            steviloStebrov: null,
            tipPodlage: null,
            kot: null,
            opombe: null,
            tipMeritve: item.ar.tipMeritve,
            oznaka: item.ar.oznaka,
            segmentId: item.ar.segmentId,
            opomba: item.ar.opomba,
            status: item.ar.status || 'OSNUTEK',
          }
          setMeasurements((prev) => [newM, ...prev])
          successCount++
        } else {
          const localM: Measurement = {
            id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            dolzinaMm: item.dolzinaMm,
            visinaMm: item.visinaMm,
            lidarScanUrl: null,
            gpsLokacija: JSON.stringify({ lat: 46.2397, lng: 14.3556 }),
            createdAt: new Date().toISOString(),
            projectId: selectedProject,
            lokacija: null,
            steviloStebrov: null,
            tipPodlage: null,
            kot: null,
            opombe: null,
            arMetadata: JSON.stringify(item.ar),
            tipMeritve: item.ar.tipMeritve,
            oznaka: item.ar.oznaka,
            segmentId: item.ar.segmentId,
            opomba: item.ar.opomba,
            status: item.ar.status || 'OSNUTEK',
          }
          setMeasurements((prev) => [localM, ...prev])
          localCount++
        }
      } catch {
        const localM: Measurement = {
          id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          dolzinaMm: item.dolzinaMm,
          visinaMm: item.visinaMm,
          lidarScanUrl: null,
          gpsLokacija: JSON.stringify({ lat: 46.2397, lng: 14.3556 }),
          createdAt: new Date().toISOString(),
          projectId: selectedProject,
          lokacija: null,
          steviloStebrov: null,
          tipPodlage: null,
          kot: null,
          opombe: null,
          arMetadata: JSON.stringify(item.ar),
          tipMeritve: item.ar.tipMeritve,
          oznaka: item.ar.oznaka,
          segmentId: item.ar.segmentId,
          opomba: item.ar.opomba,
          status: item.ar.status || 'OSNUTEK',
        }
        setMeasurements((prev) => [localM, ...prev])
        localCount++
      }
    }

    const predloga = PREDLOGE.find((p) => p.id === predlogaId)
    pushAudit({
      akcija: 'ADD',
      meritevId: 'predloga',
      opis: `Predloga \"${predloga?.naziv || predlogaId}\" uporabljena — ${newMeas.length} meritev, ${newSegs.length} segmentov`,
    })
    toast.success(
      `Predloga uporabljena: ${predloga?.naziv || predlogaId}${
        localCount > 0 ? ` (${successCount} sinhroniziranih, ${localCount} lokalno)` : ''
      }`
    )
  }

  // ============================================
  // P1 — SKUPINSKE AKCIJE (bulk)
  // ============================================

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleBulkSelectAll() {
    setSelectedIds(new Set(filteredMeasurements.map((m) => m.id)))
  }

  function handleBulkClear() {
    setSelectedIds(new Set())
  }

  function handleBulkExportCSV() {
    const selected = measurements.filter((m) => selectedIds.has(m.id))
    if (selected.length === 0) {
      toast.error('Ni izbranih meritev')
      return
    }
    const header = 'Oznaka,Tip,Status,Lokacija,Segment,Dolzina(mm),Dolzina(cm),Dolzina(m),Visina(mm),Visina(cm),Visina(m),Stebri,Podlaga,Kot,Opomba,Opombe,Datum'
    const rows = selected.map((m) => {
      const oznaka = (m.oznaka || '').replace(/"/g, '""')
      const tip = m.tipMeritve ? tipMeritveLabels[m.tipMeritve] : 'Razdalja'
      const status = statusLabels[m.status || 'OSNUTEK']
      const lokacija = (m.lokacija || '').replace(/"/g, '""')
      const segment = (m.segmentId || '').replace(/"/g, '""')
      const dMm = String(m.dolzinaMm)
      const dCm = String(Math.round(m.dolzinaMm / 10))
      const dM = (m.dolzinaMm / 1000).toFixed(2)
      const vMm = String(m.visinaMm)
      const vCm = String(Math.round(m.visinaMm / 10))
      const vM = (m.visinaMm / 1000).toFixed(2)
      const stebri = m.steviloStebrov ? String(m.steviloStebrov) : ''
      const podlaga = m.tipPodlage ? (groundTypeLabels[m.tipPodlage as GroundType] || m.tipPodlage) : ''
      const kot = m.kot ? String(m.kot) : ''
      const opomba = (m.opomba || '').replace(/"/g, '""')
      const opombe = (m.opombe || '').replace(/"/g, '""')
      const datum = new Date(m.createdAt).toLocaleDateString('sl-SI')
      return `"${oznaka}","${tip}","${status}","${lokacija}","${segment}",${dMm},${dCm},${dM},${vMm},${vCm},${vM},"${stebri}","${podlaga}",${kot},"${opomba}","${opombe}",${datum}`
    })
    const csvContent = '\uFEFF' + header + '\n' + rows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `meritve_izbrane_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    pushAudit({
      akcija: 'EDIT',
      meritevId: 'bulk',
      opis: `Skupinsko izvoženih ${selected.length} meritev (CSV)`,
    })
    toast.success(`Izvozenih ${selected.length} meritev (CSV)`)
  }

  function handleBulkCopyToSegment() {
    if (!bulkCopyTarget) {
      toast.error('Izberite ciljni segment')
      return
    }
    const selected = measurements.filter((m) => selectedIds.has(m.id))
    if (selected.length === 0) {
      toast.error('Ni izbranih meritev')
      return
    }
    const copies: Measurement[] = selected.map((m) => ({
      ...m,
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      segmentId: bulkCopyTarget,
      oznaka: m.oznaka ? `${m.oznaka} (kopija)` : 'Kopija',
      status: 'OSNUTEK' as MeasurementStatus,
    }))
    setMeasurements((prev) => [...copies, ...prev])
    pushAudit({
      akcija: 'ADD',
      meritevId: 'bulk',
      opis: `Kopirano ${selected.length} meritev v segment \"${bulkCopyTarget}\"`,
    })
    toast.success(`${selected.length} meritev kopiranih v \"${bulkCopyTarget}\"`)
    setSelectedIds(new Set())
    setBulkCopyTarget('')
  }

  function handleBulkDelete() {
    const selected = measurements.filter((m) => selectedIds.has(m.id))
    if (selected.length === 0) {
      toast.error('Ni izbranih meritev')
      return
    }
    // Ker API nima DELETE, meritve označimo kot ARHIVIRANE (ne izgubijo se)
    setMeasurements((prev) =>
      prev.map((m) =>
        selectedIds.has(m.id) ? { ...m, status: 'ARHIVIRANA' as MeasurementStatus } : m
      )
    )
    selected.forEach((m) => {
      pushAudit({
        akcija: 'DELETE',
        meritevId: m.id,
        opis: `Meritev \"${m.oznaka || m.lokacija || m.id.slice(-4)}\" arhivirana (skupinsko)`,
      })
    })
    toast.success(`${selected.length} meritev arhiviranih`)
    setSelectedIds(new Set())
    setBulkDeleteOpen(false)
  }

  // ============================================
  // P1 — IZVOZ ZGODOVINE (audit CSV)
  // ============================================

  function handleExportAuditCSV() {
    if (auditEntries.length === 0) {
      toast.error('Ni zgodovine za izvoz')
      return
    }
    const header = 'Cas,Akcija,MeritevId,Opis,StaraVrednost,NovaVrednost'
    const rows = auditEntries.map((e) => {
      const cas = new Date(e.timestamp).toLocaleString('sl-SI')
      const akcija = auditActionLabels[e.akcija]
      const opis = e.opis.replace(/"/g, '""')
      const stara = (e.staraVrednost || '').replace(/"/g, '""')
      const nova = (e.novaVrednost || '').replace(/"/g, '""')
      return `"${cas}","${akcija}","${e.meritevId}","${opis}","${stara}","${nova}"`
    })
    const csvContent = '\uFEFF' + header + '\n' + rows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `zgodovina_${selectedProject}_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Zgodovina izvožena (CSV)')
  }

  // ============================================
  // P1 — GLASOVNI VNOS OPOMB
  // ============================================

  function handleVoiceToggle() {
    if (!voiceSupported) return
    if (voiceListening) {
      try {
        recognitionRef.current?.stop()
      } catch {
        // ignore
      }
      setVoiceListening(false)
      setInterimText('')
      return
    }
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor
      webkitSpeechRecognition?: SpeechRecognitionCtor
    }
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) return
    const recognition = new SR()
    recognition.lang = 'sl-SI'
    recognition.interimResults = true
    recognition.continuous = true
    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i]
        const transcript = item[0]?.transcript ?? ''
        if (item.isFinal) {
          setFormOpomba((prev) => (prev ? `${prev} ${transcript}`.trim() : transcript))
        } else {
          interim += transcript
        }
      }
      setInterimText(interim)
    }
    recognition.onerror = () => {
      toast.error('Napaka pri prepoznavi glasu')
      setVoiceListening(false)
      setInterimText('')
    }
    recognition.onend = () => {
      setVoiceListening(false)
      setInterimText('')
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
      setVoiceListening(true)
      toast.info('Poslušam... govorite opombo')
    } catch {
      toast.error('Napaka pri zagonu prepoznavanja')
    }
  }

  // ============================================
  // RENDERS — RAILING DIAGRAM (obstoječa logika)
  // ============================================

  function renderRailingDiagram(dolzina: number, visina: number) {
    const maxDim = Math.max(dolzina, visina)
    const heightPct = Math.min((visina / maxDim) * 40, 40)
    const calc = getQuickSpacing(dolzina, visina)
    const numSlats = Math.min(calc.slatCount, 15)
    const gapWidth = numSlats > 0 ? (dolzina - numSlats * 80) / (numSlats + 1) : 0
    const gapPct = (gapWidth / dolzina) * 100

    return (
      <div className="w-full">
        <div className="relative rounded-lg border border-roksal-navy/20 bg-gradient-to-b from-roksal-navy/3 to-roksal-navy/8 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-mono text-muted-foreground">0</span>
            <span className="text-[9px] font-mono text-muted-foreground">{formatDimension(dolzina)}</span>
          </div>
          <div className="relative flex items-end gap-0" style={{ height: `${Math.max(heightPct, 20)}px` }}>
            <div className="w-[4px] h-full bg-roksal-navy rounded-full" />
            <div className="flex-1 flex items-end h-full gap-0">
              {numSlats > 0 ? (
                <div className="flex-1 h-full flex items-end gap-0">
                  <div className="h-full bg-transparent" style={{ width: `${gapPct}%` }} />
                  {Array.from({ length: numSlats }).map((_, i) => (
                    <div key={i} className="flex h-full">
                      <div
                        className="h-[85%] bg-roksal-navy/70 rounded-[1px]"
                        style={{ width: `${(80 / dolzina) * 100}%`, minWidth: '2px' }}
                      />
                      {i < numSlats - 1 && (
                        <div
                          className="h-full bg-roksal-amber/30"
                          style={{ width: `${gapPct}%`, minWidth: '1px' }}
                        />
                      )}
                    </div>
                  ))}
                  <div className="h-full bg-transparent" style={{ width: `${gapPct}%` }} />
                </div>
              ) : (
                <div className="flex-1 h-full border-t-2 border-dashed border-roksal-navy/30" />
              )}
            </div>
            <div className="w-[4px] h-full bg-roksal-navy rounded-full" />
          </div>
          <div className="mt-0.5 flex">
            <div className="w-[4px] bg-roksal-navy rounded-full" />
            <div className="flex-1 h-[3px] bg-roksal-navy/40 rounded" />
            <div className="w-[4px] bg-roksal-navy rounded-full" />
          </div>
          <div className="absolute -right-1 top-2 flex items-center gap-0.5">
            <div className="w-[1px] h-4 border-l border-dashed border-muted-foreground/40" />
            <span className="text-[8px] font-mono text-muted-foreground">{formatDimension(visina)}</span>
          </div>
        </div>

        {numSlats > 0 && (
          <div
            className={`mt-1.5 flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[10px] border ${
              calc.compliant
                ? 'bg-roksal-green/8 border-roksal-green/20 text-roksal-green'
                : 'bg-roksal-red/8 border-roksal-red/20 text-roksal-red'
            }`}
          >
            <span className="font-medium">
              {calc.slatCount} letvev × 80mm = razmik {calc.gap}mm
            </span>
            <span className="font-bold">{calc.compliant ? '✓ SKLADNO' : '✗ NESKLADNO'}</span>
          </div>
        )}
      </div>
    )
  }

  // ============================================
  // RENDER — MERITVE LIST (ena kartica)
  // ============================================

  function renderMeasurementCard(m: Measurement) {
    const gps = parseGPS(m.gpsLokacija ?? null)
    const TipIcon = m.tipMeritve ? tipMeritveIcons[m.tipMeritve] : Ruler
    const mStatus: MeasurementStatus = m.status || 'OSNUTEK'
    const isArchived = mStatus === 'ARHIVIRANA'
    const angleDeg = m.kotStopinje ?? m.kot ?? null
    return (
      <div
        key={m.id}
        className={`rounded-xl border border-border/50 overflow-hidden transition-colors hover:border-roksal-navy/20 slide-in-right ${
          isArchived ? 'opacity-60' : ''
        }`}
      >
        {/* Glava meritve */}
        <div className="flex items-center justify-between p-3 pb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* P1 — bulk checkbox */}
            {bulkMode && (
              <Checkbox
                checked={selectedIds.has(m.id)}
                onCheckedChange={() => toggleSelect(m.id)}
                className="shrink-0"
                aria-label="Izberi meritev"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`text-sm font-semibold text-roksal-navy truncate ${isArchived ? 'line-through' : ''}`}>
                  {m.oznaka || m.lokacija || `Meritev #${m.id.slice(-4)}`}
                </p>
                {m.tipMeritve && m.tipMeritve !== 'RAZDALJA' && (
                  <span
                    className={`inline-flex items-center gap-0.5 rounded px-1 py-0 text-[8px] font-medium border ${
                      tipMeritveColors[m.tipMeritve]
                    }`}
                  >
                    <TipIcon className="h-2.5 w-2.5" />
                    {tipMeritveLabels[m.tipMeritve]}
                  </span>
                )}
                {/* P1 — status badge (clickable) */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleStatusCycle(m)}
                      className={`inline-flex items-center gap-0.5 rounded px-1 py-0 text-[8px] font-medium border transition-colors hover:opacity-80 ${
                        statusColors[mStatus]
                      }`}
                      title="Klikni za cikliranje statusa"
                    >
                      {mStatus === 'POTRJENA' ? (
                        <CheckCircle2 className="h-2.5 w-2.5" />
                      ) : mStatus === 'ARHIVIRANA' ? (
                        <Archive className="h-2.5 w-2.5" />
                      ) : (
                        <RotateCcw className="h-2.5 w-2.5" />
                      )}
                      {statusLabels[mStatus]}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Spremeni status</TooltipContent>
                </Tooltip>
                {m.segmentId && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                    <Layers className="h-2.5 w-2.5 mr-0.5" />
                    {allSegments.find((s) => s.id === m.segmentId)?.name || m.segmentId}
                  </Badge>
                )}
                {m.kot && m.kot !== 90 && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                    {m.kot}°
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {/* P1 — multi-unit prikaz */}
                {m.tipMeritve !== 'KOT' && m.tipMeritve !== 'NAGIB' && (
                  <>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      ↔ {formatMultiUnit(m.dolzinaMm)}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      ↕ {formatMultiUnit(m.visinaMm)}
                    </span>
                  </>
                )}
                {m.tipMeritve === 'KOT' && angleDeg != null && (
                  <span className="text-xs text-roksal-amber font-mono">
                    {formatAngleMulti(angleDeg)}
                  </span>
                )}
                {m.tipMeritve === 'NAGIB' && angleDeg != null && (
                  <span className="text-xs text-roksal-amber font-mono">
                    {formatSlopeMulti(angleDeg)}
                  </span>
                )}
                {(m.tipMeritve === 'KOT' || m.tipMeritve === 'NAGIB') && m.opomba && (
                  <span className="text-[11px] text-muted-foreground font-mono">{m.opomba}</span>
                )}
                {m.steviloStebrov && (
                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0">
                    {m.steviloStebrov} stebrov
                  </Badge>
                )}
                {m.tipPodlage && (
                  <span
                    className={`inline-flex items-center rounded px-1 py-0 text-[8px] font-medium border ${
                      groundTypeColors[m.tipPodlage as GroundType] ||
                      'bg-gray-50 text-gray-600 border-gray-200'
                    }`}
                  >
                    {groundTypeLabels[m.tipPodlage as GroundType] || m.tipPodlage}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0 ml-2">
            <button
              type="button"
              onClick={() => handleDuplicateMeasurement(m)}
              className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors"
              title="Podvoji meritev"
            >
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() => handleDeleteMeasurement(m.id)}
              className="p-1.5 rounded-lg hover:bg-roksal-red/10 transition-colors"
              title="Izbriši meritev"
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-roksal-red" />
            </button>
          </div>
        </div>

        {/* Diagram (samo za RAZDALJA / VISINA / SEGMENT) */}
        {(!m.tipMeritve ||
          m.tipMeritve === 'RAZDALJA' ||
          m.tipMeritve === 'VISINA' ||
          m.tipMeritve === 'SEGMENT') && (
          <div className="px-3 pb-2">{renderRailingDiagram(m.dolzinaMm, m.visinaMm)}</div>
        )}

        {/* Noga */}
        <div className="flex items-center justify-between border-t border-border/30 px-3 py-2 bg-secondary/10">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground min-w-0">
            <span className="flex items-center gap-1 shrink-0">
              <Calendar className="h-3 w-3" />
              {new Date(m.createdAt).toLocaleDateString('sl-SI')}
            </span>
            {gps && (
              <span className="flex items-center gap-1 shrink-0">
                <MapPin className="h-3 w-3" />
                GPS
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {(m.opomba || m.opombe) && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground max-w-[30%] truncate">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span className="truncate hidden sm:inline">{m.opomba || m.opombe}</span>
              </div>
            )}
            {onNavigateToCalculator && (
              <button
                type="button"
                onClick={() =>
                  onNavigateToCalculator(
                    m.dolzinaMm,
                    m.visinaMm,
                    m.oznaka || m.lokacija || `Meritev #${m.id.slice(-4)}`
                  )
                }
                className="flex items-center gap-1 rounded-lg bg-roksal-navy text-white px-2.5 py-1 text-[11px] font-medium hover:bg-roksal-navy/90 active:scale-[0.96] transition-all duration-150 press-scale"
                title="Izračunaj razmike v kalkulatorju"
              >
                <Calculator className="h-3.5 w-3.5" />
                <span>Razmiki</span>
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-4 px-4 pb-4 pt-2">
      <div>
        <h2 className="text-xl font-bold text-roksal-navy">Meritve</h2>
        <p className="text-sm text-muted-foreground">
          Meritve ograj, dimenzije, kotovi in nagibi — z umeritvijo in segmenti
        </p>
      </div>

      {/* Project Selector */}
      <Card className="card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '0ms' }}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-4 w-4 text-roksal-navy" />
            <div className="flex-1">
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Izberi projekt" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nazivProjekta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {calibration.pixelsPerMm && (
              <Badge className="bg-roksal-amber/15 text-roksal-amber border border-roksal-amber/30">
                <Crosshair className="h-3 w-3 mr-1" />
                {calibration.pixelsPerMm.toFixed(2)} px/mm
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* P1 — HITRE PREDLOGE (templates) */}
      <Card className="card-hover transition-all duration-200 animate-fade-in-up border-roksal-amber/20" style={{ animationDelay: '15ms' }}>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
            <Sparkles className="h-4 w-4 text-roksal-amber" />
            Hitre predloge
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PREDLOGE.map((p) => {
              const Icon = p.ikona
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleApplyPredloga(p.id)}
                  disabled={!selectedProject}
                  className="flex flex-col items-start gap-1 rounded-lg border border-border/50 bg-secondary/30 p-2.5 text-left transition-all duration-150 hover:border-roksal-amber/40 hover:bg-roksal-amber/5 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-roksal-amber" />
                    <span className="text-[11px] font-semibold text-roksal-navy leading-tight">{p.naziv}</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground leading-tight">{p.opis}</span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* POVZETEK PROEKTA (NEW) */}
      <Card className="card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '30ms' }}>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
            <TrendingUp className="h-4 w-4" />
            Povzetek meritev
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Skupna dolžina</p>
              <p className="text-[11px] font-bold text-roksal-navy leading-tight">{formatMultiUnit(totalLength)}</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Povpr. višina</p>
              <p className="text-[11px] font-bold text-roksal-navy leading-tight">{formatMultiUnit(Math.round(avgHeight))}</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Meritev</p>
              <p className="text-sm font-bold text-roksal-navy">{measurements.length}</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Segmentov</p>
              <p className="text-sm font-bold text-roksal-navy">{allSegments.length}</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Najdaljša</p>
              <p className="text-[11px] font-bold text-roksal-navy leading-tight">
                {longestMeasurement ? formatMultiUnit(longestMeasurement.dolzinaMm) : '—'}
              </p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Površina</p>
              <p className="text-sm font-bold text-roksal-navy">{formatM2(totalArea)}</p>
            </div>
          </div>
          {/* P1 — števci statusov */}
          <Separator className="my-2.5" />
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-2 text-center">
              <p className="text-[9px] text-gray-500 uppercase tracking-wide">Osnutki</p>
              <p className="text-sm font-bold text-gray-600">{statusCounts.OSNUTEK}</p>
            </div>
            <div className="rounded-lg bg-green-50 border border-green-200 p-2 text-center">
              <p className="text-[9px] text-green-600 uppercase tracking-wide">Potrjene</p>
              <p className="text-sm font-bold text-green-700">{statusCounts.POTRJENA}</p>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-2 text-center">
              <p className="text-[9px] text-gray-400 uppercase tracking-wide">Arhivirane</p>
              <p className="text-sm font-bold text-gray-400 line-through">{statusCounts.ARHIVIRANA}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* HITRI ZAČETEK — quick-add tipi meritev (NEW) */}
      <Card className="card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
        <CardContent className="p-3">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2 px-1">
            Hitra meritev
          </p>
          <div className="grid grid-cols-4 gap-2">
            {(['RAZDALJA', 'VISINA', 'KOT', 'NAGIB'] as TipMeritve[]).map((tip) => {
              const Icon = tipMeritveIcons[tip]
              return (
                <button
                  key={tip}
                  type="button"
                  onClick={() => handleQuickAdd(tip)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-lg border p-2.5 transition-all duration-150 active:scale-[0.96] hover:border-roksal-navy/40 ${tipMeritveColors[tip]}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-[10px] font-medium">{tipMeritveLabels[tip]}</span>
                </button>
              )
            })}
          </div>
          {/* P3 — napredne meritve (vogal, kot stopnice, stebriček) */}
          <Separator className="my-2.5" />
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2 px-1">
            Napredne meritve (P3)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(['KOT_VOGAL', 'KOT_STOPNISCE', 'STEBR'] as TipMeritve[]).map((tip) => {
              const Icon = tipMeritveIcons[tip]
              return (
                <button
                  key={tip}
                  type="button"
                  onClick={() => handleQuickAdd(tip)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-lg border p-2.5 transition-all duration-150 active:scale-[0.96] hover:border-roksal-navy/40 ${tipMeritveColors[tip]}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-[10px] font-medium">{tipMeritveLabels[tip]}</span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* P3 — PRIMARNA ENOTA ZA PRIKAZ (pills) */}
      <Card className="card-hover transition-all duration-200 animate-fade-in-up border-roksal-navy/15">
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-roksal-navy" />
              <div>
                <p className="text-xs font-medium text-roksal-navy">Primarna enota za prikaz</p>
                <p className="text-[9px] text-muted-foreground">Vpliva na vse prikaze dimenzij</p>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-secondary/30 p-0.5">
              {(['mm', 'cm', 'm'] as EnotaTip[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setPrimaryUnit(u)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-all duration-150 active:scale-[0.96] ${
                    primaryUnit === u
                      ? 'bg-roksal-navy text-white shadow-sm'
                      : 'text-muted-foreground hover:text-roksal-navy'
                  }`}
                >
                  {enotaLabels[u]}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2 rounded-md bg-roksal-amber/5 border border-roksal-amber/15 p-2 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Predogled</p>
            <p className="text-sm font-bold text-roksal-navy">
              {formatInPrimaryUnit(3000, primaryUnit)} · {formatInPrimaryUnit(1100, primaryUnit)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* P3 — STOPNIŠČNI ČAROVNIK (stair wizard) */}
      {(segments.some((s) => s.type === 'stopniscje') || stairWizardOpen) && (
        <Card className="card-hover transition-all duration-200 animate-fade-in-up border-roksal-amber/20">
          <Collapsible open={stairWizardOpen} onOpenChange={setStairWizardOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between p-4 text-left hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-roksal-amber text-white">
                    <Layers2 className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-roksal-navy">Stopniščni čarovnik</span>
                    <p className="text-[10px] text-muted-foreground">
                      Izračun stopnic, kota, dolžine kosa — z diagramom
                    </p>
                  </div>
                </div>
                {stairWizardOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-3 slide-in-right">
                {/* Vhodni podatki */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Skupna višina (mm)</Label>
                    <Input
                      type="number"
                      value={stairSkupnaVisina}
                      onChange={(e) => setStairSkupnaVisina(e.target.value)}
                      placeholder="2700"
                      className="h-10 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Število stopnic</Label>
                    <Input
                      type="number"
                      value={stairStStopnic}
                      onChange={(e) => setStairStStopnic(e.target.value)}
                      placeholder="15"
                      className="h-10 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Globina stopnice (mm)</Label>
                    <Input
                      type="number"
                      value={stairGlobina}
                      onChange={(e) => setStairGlobina(e.target.value)}
                      placeholder="280"
                      className="h-10 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Širina stopnice (mm, opcijsko)</Label>
                    <Input
                      type="number"
                      value={stairSirina}
                      onChange={(e) => setStairSirina(e.target.value)}
                      placeholder="250"
                      className="h-10 font-mono"
                    />
                  </div>
                </div>

                {/* Segment */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    <Layers className="inline h-3 w-3 mr-1" />
                    Ciljni segment
                  </Label>
                  <Select
                    value={stairSegmentId}
                    onValueChange={setStairSegmentId}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Stopnišče (privzeto)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stopniscje">Stopnišče (privzeto)</SelectItem>
                      {segments.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({segmentTypeLabels[s.type]})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Real-time izračuni */}
                {stairCalc.valid && (
                  <div className="grid grid-cols-2 gap-2 rounded-lg border border-roksal-amber/30 bg-roksal-amber/5 p-3 slide-in-right">
                    <div className="text-center">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Višina posamezne</p>
                      <p className="text-sm font-bold text-roksal-navy">
                        {Math.round(stairCalc.visinaPosamezne)}mm
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Kot stopnice</p>
                      <p className="text-sm font-bold text-roksal-navy">
                        {stairCalc.kotStopinje.toFixed(1)}°
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Dolžina kosa</p>
                      <p className="text-sm font-bold text-roksal-navy">
                        {Math.round(stairCalc.dolzinaKosa)}mm
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Skupna dolžina</p>
                      <p className="text-sm font-bold text-roksal-navy">
                        {Math.round(stairCalc.skupnaDolzina)}mm
                      </p>
                    </div>
                    <div className="col-span-2 text-center border-t border-roksal-amber/20 pt-2">
                      <p className={`text-xs font-semibold ${stairCalc.priporociloColor}`}>
                        {stairCalc.priporocilo}
                      </p>
                    </div>
                  </div>
                )}

                {/* SVG diagram */}
                {stairCalc.valid && (
                  <StairDiagram
                    stStopnic={parseInt(stairStStopnic) || 0}
                    visinaPosamezne={stairCalc.visinaPosamezne}
                    globinaStopnice={parseFloat(stairGlobina) || 0}
                    kotStopinje={stairCalc.kotStopinje}
                  />
                )}

                {/* Akcije */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={handleStairCreateMeasurements}
                    disabled={!stairCalc.valid || !selectedProject}
                    className="flex-1 h-9 bg-roksal-navy text-white hover:bg-roksal-navy/90"
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    Ustvari meritve
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveStairTemplate}
                    disabled={!stairCalc.valid}
                    className="h-9 px-3 border-roksal-amber/30 text-roksal-amber hover:bg-roksal-amber/10"
                  >
                    <Bookmark className="mr-1.5 h-4 w-4" />
                    Shrani kot predlogo
                  </Button>
                </div>

                {/* Predloge */}
                {stairTemplates.length > 0 && (
                  <div className="rounded-lg border border-border/50 bg-secondary/20 p-2.5 space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Prihranjene predloge ({stairTemplates.length})
                    </p>
                    <div className="max-h-32 overflow-y-auto scrollbar-thin space-y-1">
                      {stairTemplates.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-background p-1.5"
                        >
                          <button
                            type="button"
                            onClick={() => handleLoadStairTemplate(t)}
                            className="flex-1 text-left min-w-0"
                          >
                            <p className="text-[11px] font-medium text-roksal-navy truncate">{t.naziv}</p>
                            <p className="text-[9px] text-muted-foreground font-mono">
                              {t.skupnaVisinaMm}mm · {t.stStopnic} stopnic · {t.globinaStopniceMm}mm globine
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStairTemplate(t.id)}
                            className="p-1 rounded hover:bg-red-50 transition-colors shrink-0"
                            title="Izbriši predlogo"
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-roksal-red" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* UMERITEV REFERENCE (NEW) */}
      <Card className="card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '90ms' }}>
        <Collapsible open={calibrationOpen} onOpenChange={setCalibrationOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between p-4 text-left hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    calibration.pixelsPerMm
                      ? 'bg-roksal-amber text-white'
                      : 'bg-roksal-navy/10 text-roksal-navy'
                  }`}
                >
                  <Crosshair className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-sm font-medium text-roksal-navy">Umeritev reference</span>
                  <p className="text-[10px] text-muted-foreground">
                    {calibration.pixelsPerMm
                      ? `Umerjeno: ${calibration.pixelsPerMm.toFixed(2)} px/mm`
                      : 'A4 list, ploščica ali znana dolžina'}
                  </p>
                </div>
              </div>
              {calibrationOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-3 slide-in-right">
              <p className="text-[11px] text-muted-foreground">
                Umeritev omogoča pretvorbo pikslov v milimetre za AR module. Vnesite znano dolžino
                (npr. A4 = 297mm) in pripadajočo piksel razdaljo na sliki.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Realna dolžina (mm)</Label>
                  <Input
                    type="number"
                    value={calibration.realMm}
                    onChange={(e) =>
                      setCalibration((prev) => ({ ...prev, realMm: e.target.value }))
                    }
                    placeholder="297"
                    className="h-10 font-mono"
                  />
                  <p className="text-[9px] text-muted-foreground">npr. A4 = 297, ploščica = 600</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Piksel razdalja (px)</Label>
                  <Input
                    type="number"
                    value={calibration.pixelDistance}
                    onChange={(e) =>
                      setCalibration((prev) => ({ ...prev, pixelDistance: e.target.value }))
                    }
                    placeholder="700"
                    className="h-10 font-mono"
                  />
                  <p className="text-[9px] text-muted-foreground">ali preko točk na sliki</p>
                </div>
              </div>

              <CalibrationPhotoPicker
                onPixelDistance={(px) =>
                  setCalibration((prev) => ({ ...prev, pixelDistance: String(Math.round(px)) }))
                }
              />

              <Input
                value={calibration.note}
                onChange={(e) => setCalibration((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Opomba k umeritvi (npr. A4 na balkonski plošči)"
                className="h-9 text-xs"
              />

              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  onClick={handleComputeCalibration}
                  className="flex-1 h-9 bg-roksal-amber hover:bg-roksal-amber/90 text-white"
                  disabled={!calibration.realMm || !calibration.pixelDistance}
                >
                  <Crosshair className="mr-1.5 h-4 w-4" />
                  Izračunaj umeritev
                </Button>
                {calibration.pixelsPerMm && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClearCalibration}
                    className="h-9 px-3"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {calibration.pixelsPerMm && (
                <div className="rounded-lg border border-roksal-amber/30 bg-roksal-amber/8 p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Aktivna umeritev
                  </p>
                  <p className="text-lg font-bold text-roksal-amber">
                    {calibration.pixelsPerMm.toFixed(2)} px/mm
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    1mm = {calibration.pixelsPerMm.toFixed(2)} pikslov
                  </p>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* INLINE INCLINOMETER (NEW) */}
      {inclinometerOpen && (
        <InlineInclinometer
          mode={inclinometerMode}
          onClose={() => setInclinometerOpen(false)}
          onSave={saveInclinometerReading}
        />
      )}

      {/* P3 — INLINE KOTOMER (za KOT / KOT_VOGAL / KOT_STOPNISCE) */}
      {kotomerOpen && (
        <InlineKotomer
          mode={kotomerMode}
          stairKot={stairCalc.valid ? stairCalc.kotStopinje : null}
          onClose={() => setKotomerOpen(false)}
          onSave={saveKotomerReading}
        />
      )}

      {/* OBRAZEC — Nova meritev (ENHANCED) */}
      <Card className="card-hover transition-all duration-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setFormOpen(!formOpen)}
          className="flex w-full items-center justify-between p-4 text-left hover:bg-secondary/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-roksal-navy text-white">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <span className="text-sm font-medium text-roksal-navy">Nova meritev</span>
              <p className="text-[10px] text-muted-foreground">
                Tip, oznaka, segment, dolžina, višina, opombe...
              </p>
            </div>
          </div>
          {formOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {formOpen && (
          <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-3 slide-in-right">
            {/* Tip meritve + oznaka */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Tip meritve</Label>
                <Select
                  value={formTipMeritve}
                  onValueChange={(v) => setFormTipMeritve(v as TipMeritve)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(tipMeritveLabels) as TipMeritve[]).map((tip) => {
                      const Icon = tipMeritveIcons[tip]
                      return (
                        <SelectItem key={tip} value={tip}>
                          <span className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5" />
                            {tipMeritveLabels[tip]}
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  <Tag className="inline h-3 w-3 mr-1" />
                  Oznaka
                </Label>
                <Input
                  value={formOznaka}
                  onChange={(e) => setFormOznaka(e.target.value)}
                  placeholder="dolžina balkona"
                  className="h-10"
                />
              </div>
            </div>

            {/* Segment */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                <Layers className="inline h-3 w-3 mr-1" />
                Segment
              </Label>
              <Input
                value={formSegmentId}
                onChange={(e) => setFormSegmentId(e.target.value)}
                placeholder="severni del"
                list="segment-list"
                className="h-10"
              />
              <datalist id="segment-list">
                {allSegments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </datalist>
              <p className="text-[9px] text-muted-foreground">
                Grupiranje meritev (npr. severni del, stopnišče)
              </p>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                <MapPin className="inline h-3 w-3 mr-1" />
                Lokacija / Opis
              </Label>
              <Input
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                placeholder="npr. Balkon leva stran, Terasa spredaj..."
                className="h-10"
              />
            </div>

            {/* Length + Height (P3 — z enoto) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  <Ruler className="inline h-3 w-3 mr-1" />
                  Dolžina
                </Label>
                <div className="flex gap-1.5">
                  <Input
                    type="number"
                    value={formLength}
                    onChange={(e) => setFormLength(e.target.value)}
                    placeholder="3000"
                    className="h-10 font-mono flex-1"
                  />
                  <Select
                    value={formLengthUnit}
                    onValueChange={(v) => setFormLengthUnit(v as EnotaTip)}
                  >
                    <SelectTrigger className="h-10 w-[68px] px-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mm">mm</SelectItem>
                      <SelectItem value="cm">cm</SelectItem>
                      <SelectItem value="m">m</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formLength && formLengthUnit !== 'mm' && (
                  <p className="text-[9px] text-roksal-amber font-mono">
                    = {convertToMm(parseFloat(formLength) || 0, formLengthUnit)}mm
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  <Ruler className="inline h-3 w-3 mr-1 rotate-90" />
                  Višina
                </Label>
                <div className="flex gap-1.5">
                  <Input
                    type="number"
                    value={formHeight}
                    onChange={(e) => setFormHeight(e.target.value)}
                    placeholder="900"
                    className="h-10 font-mono flex-1"
                  />
                  <Select
                    value={formHeightUnit}
                    onValueChange={(v) => setFormHeightUnit(v as EnotaTip)}
                  >
                    <SelectTrigger className="h-10 w-[68px] px-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mm">mm</SelectItem>
                      <SelectItem value="cm">cm</SelectItem>
                      <SelectItem value="m">m</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formHeight && formHeightUnit !== 'mm' && (
                  <p className="text-[9px] text-roksal-amber font-mono">
                    = {convertToMm(parseFloat(formHeight) || 0, formHeightUnit)}mm
                  </p>
                )}
              </div>
            </div>

            {/* Posts + Ground Type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  <Hammer className="inline h-3 w-3 mr-1" />
                  Število stebrov
                </Label>
                <Input
                  type="number"
                  value={formPosts}
                  onChange={(e) => setFormPosts(e.target.value)}
                  placeholder="3"
                  className="h-10 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Tip podlage</Label>
                <Select
                  value={formGround}
                  onValueChange={(v) => setFormGround(v as GroundType)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(groundTypeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Angle + quick spacing */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Kot (°)</Label>
                <Input
                  type="number"
                  value={formAngle}
                  onChange={(e) => setFormAngle(e.target.value)}
                  placeholder="90"
                  className="h-10 font-mono"
                />
                <p className="text-[9px] text-muted-foreground">Pustite prazno za ravne odseke</p>
              </div>
              <div className="flex items-end">
                <div className="w-full rounded-lg border border-border/50 bg-secondary/30 p-2.5 text-center">
                  {formLength && formHeight ? (() => {
                    const calc = getQuickSpacing(parseInt(formLength), parseInt(formHeight))
                    return (
                      <div>
                        <p
                          className={`text-lg font-bold ${
                            calc.compliant ? 'text-roksal-green' : 'text-roksal-red'
                          }`}
                        >
                          {calc.slatCount} letvev
                        </p>
                        <p className="text-[9px] text-muted-foreground">razmik {calc.gap}mm</p>
                      </div>
                    )
                  })() : (
                    <p className="text-[10px] text-muted-foreground">
                      Vnesite meritve za
                      <br />
                      hitri izračun razmikov
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* P1 — Opomba (textarea) z glasovnim vnosom */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Opomba</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleVoiceToggle}
                      disabled={!voiceSupported}
                      title={voiceSupported ? 'Vnos z glasom' : 'Vnos z glasom ni podprt v tem brskalniku'}
                      className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-medium transition-all duration-150 active:scale-[0.96] ${
                        voiceListening
                          ? 'border-red-300 bg-red-50 text-red-600 animate-pulse'
                          : voiceSupported
                            ? 'border-roksal-navy/20 bg-roksal-navy/5 text-roksal-navy hover:bg-roksal-navy/10'
                            : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <Mic className="h-3 w-3" />
                      {voiceListening ? 'Poslušam...' : 'Glas'}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {voiceSupported
                      ? 'Klikni za vnos opombe z glasom (sl-SI)'
                      : 'Vnos z glasom ni podprt v tem brskalniku'}
                  </TooltipContent>
                </Tooltip>
              </div>
              <Textarea
                value={formOpomba}
                onChange={(e) => setFormOpomba(e.target.value)}
                placeholder="Podrobnejši opis, posebnosti, opozorila..."
                className="min-h-[60px] text-sm"
              />
              {interimText && (
                <p className="text-[10px] text-muted-foreground italic truncate">
                  <Mic className="inline h-2.5 w-2.5 mr-1" />
                  {interimText}
                </p>
              )}
            </div>

            {/* Notes (kratko) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Kratke opombe</Label>
              <Input
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Posebnosti, opazke..."
                className="h-10"
              />
            </div>

            <Separator />

            {/* Scan + Submit */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="h-9 px-3 text-[11px] gap-1.5 shrink-0 transition-colors"
                onClick={() => toast.info('LiDAR skeniranje bo kmalu na voljo')}
              >
                <Scan className="h-3.5 w-3.5" />
                Scaniraj
              </Button>
              <Button
                type="button"
                onClick={handleSubmitMeasurement}
                className="flex-1 h-9 bg-roksal-navy hover:bg-roksal-navy/90 text-white transition-transform duration-200 active:scale-[0.98]"
                disabled={submitting || !formLength || !formHeight}
              >
                {submitting ? (
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Shranjujem...
                  </span>
                ) : (
                  <>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Shrani meritev
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* SEgmenti (NEW) */}
      <Card className="card-hover animate-fade-in-up" style={{ animationDelay: '120ms' }}>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
              <Layers className="h-4 w-4" />
              Segmenti
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                {allSegments.length}
              </Badge>
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px] gap-1"
              onClick={() => setAddSegmentOpen(!addSegmentOpen)}
            >
              <Plus className="h-3 w-3" />
              Dodaj segment
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {/* Forma za nov segment */}
          {addSegmentOpen && (
            <div className="mb-3 rounded-lg border border-border/50 bg-secondary/30 p-3 space-y-2 slide-in-right">
              <Input
                value={newSegmentName}
                onChange={(e) => setNewSegmentName(e.target.value)}
                placeholder="Ime segmenta (npr. Severni del)"
                className="h-9"
              />
              <Select
                value={newSegmentType}
                onValueChange={(v) => setNewSegmentType(v as Segment['type'])}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(segmentTypeLabels) as Segment['type'][]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {segmentTypeLabels[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleAddSegment}
                  className="flex-1 h-8 bg-roksal-navy text-white hover:bg-roksal-navy/90 text-xs"
                >
                  <Save className="mr-1 h-3 w-3" />
                  Shrani
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 px-3"
                  onClick={() => setAddSegmentOpen(false)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {allSegments.length === 0 ? (
            <div className="py-6 text-center">
              <Layers className="mx-auto h-7 w-7 text-muted-foreground/30" />
              <p className="mt-2 text-xs text-muted-foreground">Brez segmentov</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                Dodajte segment za grupiranje meritev
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
              {allSegments.map((seg) => {
                const stats = segmentStats.get(seg.id)
                const segMeas = measurements.filter((m) => m.segmentId === seg.id)
                const isOpen = expandedSegments.has(seg.id)
                return (
                  <Collapsible key={seg.id} open={isOpen} onOpenChange={() => toggleSegment(seg.id)}>
                    <div className="rounded-lg border border-border/50 overflow-hidden">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between p-3 text-left hover:bg-secondary/30 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-roksal-navy/10 text-roksal-navy">
                              <Layers className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-roksal-navy truncate">{seg.name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {segmentTypeLabels[seg.type]} • {stats?.count || 0} meritev
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <p className="text-xs font-mono font-bold text-roksal-navy">
                                {formatDimension(stats?.totalLength || 0)}
                              </p>
                              <p className="text-[9px] text-muted-foreground">
                                povpr. {formatDimension(Math.round(stats?.avgHeight || 0))}
                              </p>
                            </div>
                            {isOpen ? (
                              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </div>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t border-border/30 p-2 space-y-2 bg-secondary/5">
                          {/* P3 — WPC diagram za WPC segmente */}
                          {(seg.type === 'WPC_POKOCNE' ||
                            seg.type === 'WPC_VODORAVNE' ||
                            seg.type === 'WPC_POSEVNE') && (
                            <WpcDiagram
                              orientacija={seg.type}
                              dolzinaMm={stats?.totalLength || 0}
                              visinaMm={Math.round(stats?.avgHeight || 0) || 1100}
                              sirinaPalice={wpcSirinaPalice}
                              debelinaPalice={wpcDebelinaPalice}
                              razmikPalic={wpcRazmikPalic}
                              kotPosevnih={wpcKotPosevnih}
                            />
                          )}
                          {/* P3 — Preglednica stebrov za ta segment */}
                          <SteberTable
                            measurements={measurements}
                            segmentId={seg.id}
                            onExportCsv={() => handleExportStebriCSV(seg.id)}
                          />
                          {segMeas.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground text-center py-3">
                              V tem segmentu ni meritev
                            </p>
                          ) : (
                            segMeas.map((m) => (
                              <div key={m.id} className="text-xs">
                                {renderMeasurementCard(m)}
                              </div>
                            ))
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setFormSegmentId(seg.id)
                              setStebriSegmentId(seg.id)
                              setFormOpen(true)
                              setAddSegmentOpen(false)
                            }}
                            className="w-full rounded-lg border border-dashed border-roksal-navy/30 py-1.5 text-[10px] text-roksal-navy hover:bg-roksal-navy/5 transition-colors"
                          >
                            <Plus className="inline h-3 w-3 mr-1" />
                            Dodaj meritev v ta segment
                          </button>
                          {/* P3 — dodaj stebriček v ta segment */}
                          <button
                            type="button"
                            onClick={() => {
                              setStebriSegmentId(seg.id)
                              setStebriFormOpen(true)
                            }}
                            className="w-full rounded-lg border border-dashed border-roksal-amber/40 py-1.5 text-[10px] text-roksal-amber hover:bg-roksal-amber/5 transition-colors"
                          >
                            <Columns3 className="inline h-3 w-3 mr-1" />
                            Dodaj stebriček v ta segment
                          </button>
                          {/* P3 — dodaj WPC palice za WPC segmente */}
                          {(seg.type === 'WPC_POKOCNE' ||
                            seg.type === 'WPC_VODORAVNE' ||
                            seg.type === 'WPC_POSEVNE') && (
                            <button
                              type="button"
                              onClick={() => handleAddWpcPaliceAsStebri(seg)}
                              className="w-full rounded-lg border border-dashed border-amber-400/50 py-1.5 text-[10px] text-amber-700 hover:bg-amber-50 transition-colors"
                            >
                              <Fence className="inline h-3 w-3 mr-1" />
                              Dodaj WPC palice kot materiale
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteSegment(seg.id)}
                            className="w-full rounded-lg border border-dashed border-roksal-red/30 py-1 text-[10px] text-roksal-red hover:bg-roksal-red/5 transition-colors"
                          >
                            <Trash2 className="inline h-3 w-3 mr-1" />
                            Izbriši segment
                          </button>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* P3 — ŠTEBRICKI — forma za nov steber */}
      {allSegments.length > 0 && stebriFormOpen && (
        <Card className="card-hover animate-fade-in-up border-roksal-amber/20">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                <Columns3 className="h-4 w-4 text-roksal-amber" />
                Nov stebriček (S{getNextStebriNumber(measurements, stebriSegmentId || undefined)})
              </CardTitle>
              <button
                type="button"
                onClick={() => setStebriFormOpen(false)}
                className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3 slide-in-right">
            {/* Segment */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                <Layers className="inline h-3 w-3 mr-1" />
                Segment
              </Label>
              <Select
                value={stebriSegmentId}
                onValueChange={setStebriSegmentId}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Izberi segment" />
                </SelectTrigger>
                <SelectContent>
                  {allSegments.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({segmentTypeLabels[s.type]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Tip stebra */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Tip stebra</Label>
                <Select
                  value={stebriTipStebra}
                  onValueChange={(v) => setStebriTipStebra(v as TipStebra)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(tipStebraLabels) as TipStebra[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {tipStebraLabels[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Material */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Material</Label>
                <Select
                  value={stebriMaterial}
                  onValueChange={(v) => setStebriMaterial(v as MaterialStebra)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(materialStebraLabels) as MaterialStebra[]).map((m) => (
                      <SelectItem key={m} value={m}>
                        {materialStebraLabels[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Pozicija z enoto */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Pozicija od začetka</Label>
                <div className="flex gap-1.5">
                  <Input
                    type="number"
                    value={stebriPozicija}
                    onChange={(e) => setStebriPozicija(e.target.value)}
                    placeholder="0"
                    className="h-10 font-mono flex-1"
                  />
                  <Select
                    value={stebriPozicijaUnit}
                    onValueChange={(v) => setStebriPozicijaUnit(v as EnotaTip)}
                  >
                    <SelectTrigger className="h-10 w-[68px] px-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mm">mm</SelectItem>
                      <SelectItem value="cm">cm</SelectItem>
                      <SelectItem value="m">m</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {stebriPozicija && stebriPozicijaUnit !== 'mm' && (
                  <p className="text-[9px] text-roksal-amber font-mono">
                    = {convertToMm(parseFloat(stebriPozicija) || 0, stebriPozicijaUnit)}mm
                  </p>
                )}
              </div>
              {/* Razmik (auto-calc) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Razmik do prejšnjega (auto)</Label>
                <Input
                  type="text"
                  value={stebriRazmik || '—'}
                  readOnly
                  className="h-10 font-mono bg-secondary/30"
                />
                <p className="text-[9px] text-muted-foreground">Izračunano iz pozicije prejšnjega stebra</p>
              </div>
            </div>

            {/* Višina stebra */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                <Ruler className="inline h-3 w-3 mr-1 rotate-90" />
                Višina stebra (mm)
              </Label>
              <Input
                type="number"
                value={stebriVisina}
                onChange={(e) => setStebriVisina(e.target.value)}
                placeholder="1100"
                className="h-10 font-mono"
              />
              <p className="text-[9px] text-muted-foreground">Standardna višina: 1100mm (zakonsko minimum za balkon)</p>
            </div>

            <Button
              type="button"
              onClick={handleAddSteber}
              disabled={!stebriSegmentId || !stebriPozicija}
              className="w-full h-9 bg-roksal-amber text-white hover:bg-roksal-amber/90"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Dodaj stebriček S{getNextStebriNumber(measurements, stebriSegmentId || undefined)}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* P3 — WPC KONFIGURACIJA (prikaz če obstaja WPC segment) */}
      {allSegments.some(
        (s) =>
          s.type === 'WPC_POKOCNE' ||
          s.type === 'WPC_VODORAVNE' ||
          s.type === 'WPC_POSEVNE'
      ) && (
        <Card className="card-hover animate-fade-in-up border-amber-200">
          <Collapsible open={wpcConfigOpen} onOpenChange={setWpcConfigOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between p-4 text-left hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white">
                    <Fence className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-roksal-navy">WPC konfiguracija</span>
                    <p className="text-[10px] text-muted-foreground">
                      Dimenzije palic, razmak, kot poševnih
                    </p>
                  </div>
                </div>
                {wpcConfigOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-3 slide-in-right">
                <div className="grid grid-cols-2 gap-3">
                  {/* Širina palice */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Širina palice</Label>
                    <Select
                      value={String(wpcSirinaPalice)}
                      onValueChange={(v) => setWpcSirinaPalice(parseInt(v))}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WPC_SIRINE_PALIC.map((s) => (
                          <SelectItem key={s} value={String(s)}>
                            {s}mm
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[9px] text-muted-foreground">Standardni Roksal profili</p>
                  </div>
                  {/* Debelina palice */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Debelina palice (mm)</Label>
                    <Input
                      type="number"
                      value={String(wpcDebelinaPalice)}
                      onChange={(e) => setWpcDebelinaPalice(parseInt(e.target.value) || WPC_DEBELINA_DEFAULT)}
                      className="h-10 font-mono"
                    />
                    <p className="text-[9px] text-muted-foreground">Standard: 23mm</p>
                  </div>
                  {/* Razmik */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Razmik med palicami (mm)</Label>
                    <Input
                      type="number"
                      value={String(wpcRazmikPalic)}
                      onChange={(e) => setWpcRazmikPalic(parseInt(e.target.value) || WPC_RAZMAK_DEFAULT)}
                      className="h-10 font-mono"
                    />
                    <p className="text-[9px] text-muted-foreground">Standard: 110mm (predpisi!)</p>
                  </div>
                  {/* Kot poševnih */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Kot poševnih palic (°)</Label>
                    <Input
                      type="number"
                      value={String(wpcKotPosevnih)}
                      onChange={(e) => setWpcKotPosevnih(parseInt(e.target.value) || WPC_KOT_POSEVNIH_DEFAULT)}
                      className="h-10 font-mono"
                    />
                    <p className="text-[9px] text-muted-foreground">Standard: 45°</p>
                  </div>
                </div>
                {wpcRazmikPalic > 110 && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[10px] text-amber-700 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Razmik {wpcRazmikPalic}mm presega 110mm — preverite skladnost s predpisi!
                  </div>
                )}
                {wpcRazmikPalic <= 110 && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-2.5 text-[10px] text-green-700 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    Razmik {wpcRazmikPalic}mm ustreza predpisom (≤110mm)
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground text-center">
                  Nastavitve veljajo za vse WPC segmente v projektu.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Stats Header (existing) */}
      <div className="grid grid-cols-4 gap-2">
        <Card className="px-2 py-2.5 card-hover animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Meritve</p>
          <p className="text-lg font-bold text-roksal-navy">{measurements.length}</p>
        </Card>
        <Card className="px-2 py-2.5 card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '180ms' }}>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Stebri</p>
          <p className="text-lg font-bold text-roksal-navy">{totalPosts || '—'}</p>
        </Card>
        <Card className="px-2 py-2.5 card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '210ms' }}>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">LiDAR</p>
          <p className="text-lg font-bold text-roksal-navy">{lidarScans}</p>
        </Card>
        <Card className="px-2 py-2.5 card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '240ms' }}>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Skupaj</p>
          <p className="text-lg font-bold text-roksal-navy">{(totalLength / 1000).toFixed(1)}m</p>
        </Card>
      </div>

      {/* Average Dimensions Card (existing) */}
      {measurements.length > 0 && (
        <Card className="card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '270ms' }}>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
              <TrendingUp className="h-4 w-4" />
              Povprečne dimenzije
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-roksal-navy/10">
                  <Ruler className="h-4 w-4 text-roksal-navy" />
                </div>
                <div>
                  <p className="text-xs font-medium text-roksal-navy">
                    {formatDimension(Math.round(avgLength))}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Povpr. dolžina</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-roksal-navy/10">
                  <Ruler className="h-4 w-4 text-roksal-amber rotate-90" />
                </div>
                <div>
                  <p className="text-xs font-medium text-roksal-navy">
                    {formatDimension(Math.round(avgHeight))}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Povpr. višina</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* P1 — STATUS FILTER PILLS + BULK TOOLBAR */}
      <Card className="card-hover animate-fade-in-up" style={{ animationDelay: '285ms' }}>
        <CardContent className="p-3 space-y-2.5">
          {/* Status filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {(['VSE', 'OSNUTEK', 'POTRJENA', 'ARHIVIRANA'] as StatusFilter[]).map((f) => {
              const isActive = statusFilter === f
              const label = f === 'VSE' ? 'Vse' : statusLabels[f as MeasurementStatus]
              const count = f === 'VSE' ? measurements.length : statusCounts[f as MeasurementStatus]
              const color =
                f === 'VSE'
                  ? isActive
                    ? 'bg-roksal-navy text-white border-roksal-navy'
                    : 'bg-secondary/50 text-muted-foreground border-border/50'
                  : f === 'OSNUTEK'
                    ? isActive
                      ? 'bg-gray-600 text-white border-gray-600'
                      : 'bg-gray-50 text-gray-600 border-gray-200'
                    : f === 'POTRJENA'
                      ? isActive
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-green-50 text-green-700 border-green-200'
                      : isActive
                        ? 'bg-gray-400 text-white border-gray-400'
                        : 'bg-gray-50 text-gray-400 border-gray-200'
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatusFilter(f)}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all duration-150 active:scale-[0.96] ${color}`}
                >
                  {label}
                  <span className="rounded-full bg-black/10 px-1 text-[9px]">{count}</span>
                </button>
              )
            })}
            <div className="flex-1" />
            {/* Bulk mode toggle */}
            <button
              type="button"
              onClick={() => {
                setBulkMode(!bulkMode)
                if (bulkMode) setSelectedIds(new Set())
              }}
              className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-medium transition-all duration-150 active:scale-[0.96] ${
                bulkMode
                  ? 'bg-roksal-navy text-white border-roksal-navy'
                  : 'bg-secondary/50 text-muted-foreground border-border/50 hover:bg-secondary'
              }`}
            >
              {bulkMode ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
              Skupinsko
            </button>
          </div>

          {/* Bulk toolbar (prikaže se samo v bulk mode z izborom) */}
          {bulkMode && (
            <div className="rounded-lg border border-roksal-navy/20 bg-roksal-navy/5 p-2.5 space-y-2 slide-in-right">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleBulkSelectAll}
                    className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[10px] font-medium hover:bg-secondary/50 transition-colors"
                  >
                    <CheckSquare className="h-3 w-3" />
                    Izberi vse
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkClear}
                    className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[10px] font-medium hover:bg-secondary/50 transition-colors"
                  >
                    <Square className="h-3 w-3" />
                    Počisti
                  </button>
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                    {selectedIds.size} izbrane
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={handleBulkExportCSV}
                  disabled={selectedIds.size === 0}
                  className="flex items-center justify-center gap-1 rounded-md border border-roksal-navy/20 bg-background px-2 py-1 text-[10px] font-medium text-roksal-navy hover:bg-roksal-navy/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Download className="h-3 w-3" />
                  Izvozi izbrane CSV
                </button>
                <div className="flex items-center gap-1">
                  <Select value={bulkCopyTarget} onValueChange={setBulkCopyTarget}>
                    <SelectTrigger className="h-7 text-[10px] flex-1">
                      <SelectValue placeholder="Ciljni segment" />
                    </SelectTrigger>
                    <SelectContent>
                      {allSegments.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    onClick={handleBulkCopyToSegment}
                    disabled={selectedIds.size === 0 || !bulkCopyTarget}
                    className="flex items-center gap-1 rounded-md border border-roksal-amber/30 bg-roksal-amber/10 px-2 py-1 text-[10px] font-medium text-roksal-amber hover:bg-roksal-amber/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    <Copy className="h-3 w-3" />
                    Kopiraj
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setBulkDeleteOpen(true)}
                  disabled={selectedIds.size === 0}
                  className="flex items-center justify-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  Izbriši izbrane
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Measurements List */}
      <Card className="card-hover animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-roksal-navy">Seznam meritev</CardTitle>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleExportCSV}
                className="flex items-center gap-1 rounded-lg border border-roksal-navy/20 bg-roksal-navy/5 px-2 py-1 text-[10px] font-medium text-roksal-navy hover:bg-roksal-navy/10 active:scale-[0.96] transition-all duration-150"
                disabled={loading || measurements.length === 0}
              >
                <Download className="h-3 w-3" />
                CSV
              </button>
              <button
                type="button"
                onClick={handleExportPDF}
                className="flex items-center gap-1 rounded-lg border border-roksal-amber/30 bg-roksal-amber/10 px-2 py-1 text-[10px] font-medium text-roksal-amber hover:bg-roksal-amber/20 active:scale-[0.96] transition-all duration-150"
                disabled={loading || measurements.length === 0}
              >
                <FileText className="h-3 w-3" />
                PDF
              </button>
              <Badge variant="secondary">{filteredMeasurements.length}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : filteredMeasurements.length > 0 ? (
            <div className="space-y-4 max-h-[600px] overflow-y-auto scrollbar-thin">
              {groupedMeasurements.map((group) => (
                <div key={group.label}>
                  <div className="flex items-center gap-2 mb-2 mt-1 first:mt-0">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {group.label}
                    </span>
                    <div className="flex-1 h-px bg-border/50" />
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                      {group.measurements.length}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {group.measurements.map((m) => renderMeasurementCard(m))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <Ruler className="mx-auto h-8 w-8 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">
                {measurements.length === 0 ? 'Še ni meritev' : 'Brez meritev v tem filtru'}
              </p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">
                {measurements.length === 0
                  ? 'Dodajte novo meritev za ogrodje'
                  : 'Spremenite filter statusa zgoraj'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* P1 — ZGODOVINA SPREMEMB (audit trail) */}
      <Card className="card-hover animate-fade-in-up" style={{ animationDelay: '315ms' }}>
        <Collapsible open={auditOpen} onOpenChange={setAuditOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between p-4 text-left hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-roksal-navy/10 text-roksal-navy">
                  <History className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-sm font-medium text-roksal-navy">Zgodovina sprememb</span>
                  <p className="text-[10px] text-muted-foreground">
                    {auditEntries.length} {auditEntries.length === 1 ? 'sprememba' : 'sprememb'} • zadnjih {Math.min(auditEntries.length, 20)} prikazanih
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                  {auditEntries.length}
                </Badge>
                {auditOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-3 slide-in-right">
              {auditEntries.length === 0 ? (
                <div className="py-6 text-center">
                  <ClipboardList className="mx-auto h-7 w-7 text-muted-foreground/30" />
                  <p className="mt-2 text-xs text-muted-foreground">Brez zgodovine sprememb</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    Spremembe meritev bodo samodejno zabeležene
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2.5 max-h-96 overflow-y-auto scrollbar-thin">
                    {auditEntries
                      .slice(0, auditExpanded ? 200 : 20)
                      .map((entry, i) => {
                        const Icon = auditIcons[entry.akcija]
                        const color = auditColors[entry.akcija]
                        return (
                          <div key={`${entry.timestamp}-${i}`} className="flex items-start gap-2.5">
                            <div className={`flex h-7 w-7 items-center justify-center rounded-full ${color} shrink-0`}>
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-foreground leading-tight">{entry.opis}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(entry.timestamp).toLocaleString('sl-SI')}
                                </span>
                                <Badge variant="outline" className="text-[8px] h-3.5 px-1 py-0">
                                  {auditActionLabels[entry.akcija]}
                                </Badge>
                              </div>
                              {entry.staraVrednost && entry.novaVrednost && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  <span className="line-through">{entry.staraVrednost}</span>
                                  {' → '}
                                  <span className="font-medium text-foreground">{entry.novaVrednost}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    {auditEntries.length > 20 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={() => setAuditExpanded(!auditExpanded)}
                      >
                        {auditExpanded ? 'Prikaži manj' : `Prikaži več (${auditEntries.length - 20})`}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] ml-auto"
                      onClick={handleExportAuditCSV}
                      disabled={auditEntries.length === 0}
                    >
                      <FileSpreadsheet className="mr-1 h-3 w-3" />
                      Izvozi zgodovino
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* P1 — POTRDITVENI DIALOG ZA SKUPINSKO BRISANJE */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arhiviraj izbrane meritve?</DialogTitle>
            <DialogDescription>
              Izbrane meritve ({selectedIds.size}) bodo arhivirane. Arhivirane meritve niso izbrisane
              in jih lahko pozneje obnovite (cikliranje statusa). Želite nadaljevati?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkDeleteOpen(false)}
            >
              Prekliči
            </Button>
            <Button
              type="button"
              onClick={handleBulkDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              <Archive className="mr-1.5 h-4 w-4" />
              Arhiviraj ({selectedIds.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// KOMPONENTA: CalibrationPhotoPicker
// Naloži sliko in omogoči tap dveh točk za izračun piksel razdalje
// ============================================

function CalibrationPhotoPicker({ onPixelDistance }: { onPixelDistance: (px: number) => void }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [points, setPoints] = useState<{ x: number; y: number }[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    setPoints([])
  }

  function handleImageClick(e: React.MouseEvent<HTMLImageElement>) {
    if (!imageUrl) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setPoints((prev) => {
      const next = [...prev, { x, y }]
      if (next.length > 2) return [next[next.length - 1]]
      if (next.length === 2) {
        const dx = next[1].x - next[0].x
        const dy = next[1].y - next[0].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        onPixelDistance(dist)
      }
      return next
    })
  }

  function clearPoints() {
    setPoints([])
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        <Camera className="inline h-3 w-3 mr-1" />
        Ali izberi 2 točki na sliki
      </Label>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />
      {!imageUrl ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-lg border border-dashed border-border bg-secondary/30 py-3 text-[11px] text-muted-foreground hover:bg-secondary/50 transition-colors"
        >
          <Camera className="mx-auto h-4 w-4 mb-1" />
          Naloži ali slikaj referenco
        </button>
      ) : (
        <div className="space-y-1">
          <div
            ref={containerRef}
            className="relative w-full overflow-hidden rounded-lg border border-border/50 bg-secondary/20"
          >
            <img
              src={imageUrl}
              alt="Referenca"
              onClick={handleImageClick}
              className="w-full max-h-48 object-contain cursor-crosshair"
            />
            {points.map((p, i) => (
              <div
                key={i}
                className="absolute pointer-events-none"
                style={{
                  left: `${p.x}px`,
                  top: `${p.y}px`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div
                  className={`h-3 w-3 rounded-full border-2 border-white ${
                    i === 0 ? 'bg-roksal-navy' : 'bg-roksal-amber'
                  } shadow-md`}
                />
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-white bg-roksal-navy rounded px-1">
                  {String.fromCharCode(65 + i)}
                </span>
              </div>
            ))}
            {points.length === 2 && (
              <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
                <line
                  x1={points[0].x}
                  y1={points[0].y}
                  x2={points[1].x}
                  y2={points[1].y}
                  stroke="#f59e0b"
                  strokeWidth="2"
                  strokeDasharray="4,2"
                />
              </svg>
            )}
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={clearPoints}
              className="flex-1 rounded-md border border-border bg-secondary/30 py-1 text-[10px] text-muted-foreground hover:bg-secondary/50"
            >
              Počisti točke
            </button>
            <button
              type="button"
              onClick={() => {
                setImageUrl(null)
                setPoints([])
              }}
              className="flex-1 rounded-md border border-border bg-secondary/30 py-1 text-[10px] text-muted-foreground hover:bg-secondary/50"
            >
              Zamenjaj sliko
            </button>
          </div>
          {points.length === 2 && (
            <p className="text-[10px] text-roksal-amber text-center">
              ✓ Izbrani 2 točki — piksel razdalja izračunana
            </p>
          )}
          {points.length === 1 && (
            <p className="text-[10px] text-muted-foreground text-center">
              Izberi še drugo točko...
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================
// KOMPONENTA: InlineInclinometer
// ============================================

function InlineInclinometer({
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
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
            {mode === 'KOT' ? (
              <Triangle className="h-4 w-4 text-roksal-amber" />
            ) : (
              <Mountain className="h-4 w-4 text-roksal-amber" />
            )}
            {mode === 'KOT' ? 'Meritev kota' : 'Meritev nagiba'}
          </CardTitle>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex flex-col items-center gap-3">
        {/* Libela */}
        <div className="relative h-40 w-40 rounded-full border-4 border-roksal-navy/20 bg-gradient-to-br from-roksal-navy/5 to-roksal-amber/5">
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-roksal-navy/15" />
          <div className="absolute top-1/2 left-0 w-full h-px -translate-y-1/2 bg-roksal-navy/15" />
          <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-roksal-navy/30" />
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
          <div className="rounded-lg border border-roksal-navy/10 bg-white p-2 text-center">
            <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              Levo ↔ Desno
            </div>
            <div className="text-xl font-bold text-roksal-navy">
              {reading ? angleX.toFixed(1) : '–'}°
            </div>
          </div>
          <div className="rounded-lg border border-roksal-navy/10 bg-white p-2 text-center">
            <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              Naprej ↔ Nazaj
            </div>
            <div className="text-xl font-bold text-roksal-navy">
              {reading ? angleY.toFixed(1) : '–'}°
            </div>
          </div>
        </div>

        {reading && (
          <Badge variant={isLevel ? 'default' : 'secondary'} className={isLevel ? 'bg-green-600 text-white' : ''}>
            {isLevel ? (
              <>
                <CheckCircle2 className="mr-1 h-3 w-3" /> V vodoravni
              </>
            ) : (
              <>
                <AlertCircle className="mr-1 h-3 w-3" />
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
            <Gauge className="mr-2 h-4 w-4" />
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
                <RefreshCw className="mr-2 h-4 w-4" /> Ustavi merjenje
              </>
            ) : (
              <>
                <Gauge className="mr-2 h-4 w-4" /> Nadaljuj
              </>
            )}
          </Button>
        )}
        {permission === 'denied' && (
          <p className="text-center text-[11px] text-red-600">
            Dostop do senzorjev je zavrnjen.
          </p>
        )}
        {permission === 'unsupported' && (
          <p className="text-center text-[11px] text-amber-600">
            Ta naprava ne podpira senzorjev orientacije.
          </p>
        )}

        {/* Lokacija + Save */}
        {reading && monitoring && (
          <div className="w-full space-y-2 rounded-lg border border-roksal-navy/10 bg-white p-2.5">
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
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Shranjujem...' : `Shrani kot ${mode === 'KOT' ? 'kot' : 'nagib'}`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================
// P3 — KOMPONENTA: StairDiagram (SVG)
// ============================================

function StairDiagram({
  stStopnic,
  visinaPosamezne,
  globinaStopnice,
  kotStopinje,
}: {
  stStopnic: number
  visinaPosamezne: number
  globinaStopnice: number
  kotStopinje: number
}) {
  // omejimo število narisanih stopnic za berljivost
  const maxDraw = Math.min(stStopnic, 12)
  const w = 320
  const h = 180
  const margin = 16
  const usableW = w - margin * 2
  const usableH = h - margin * 2 - 24 // prostor za oznake
  const stepW = usableW / maxDraw
  const stepH = (visinaPosamezne / globinaStopnice) * stepW
  const totalH = stepH * maxDraw
  const scaleY = Math.min(1, usableH / totalH) // če preveliko, skrčimo
  const drawStepH = stepH * scaleY
  const drawTotalH = drawStepH * maxDraw
  const baseY = margin + usableH // spodaj
  // Ograja ob strani (navy line)
  const railX1 = margin
  const railY1 = baseY - drawTotalH - 8
  const railX2 = w - margin
  const railY2 = baseY

  return (
    <div className="rounded-lg border border-border/50 bg-gradient-to-br from-roksal-navy/5 to-roksal-amber/5 p-2">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto"
        role="img"
        aria-label="Diagram stopnišča"
      >
        {/* Ograja (poševna) */}
        <line
          x1={railX1}
          y1={railY1}
          x2={railX2}
          y2={railY2}
          stroke="#1d2b3e"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <line
          x1={railX1}
          y1={railY1 - 4}
          x2={railX2}
          y2={railY2 - 4}
          stroke="#1d2b3e"
          strokeWidth="1.5"
          strokeDasharray="3,2"
          opacity={0.5}
        />
        {/* Stopnice (pravokotniki) */}
        {Array.from({ length: maxDraw }).map((_, i) => {
          const x = margin + i * stepW
          const yTop = baseY - (i + 1) * drawStepH
          return (
            <g key={i}>
              <rect
                x={x}
                y={yTop}
                width={stepW}
                height={drawStepH}
                fill="#1d2b3e"
                fillOpacity={0.12 + (i / maxDraw) * 0.15}
                stroke="#1d2b3e"
                strokeWidth="0.8"
              />
              {/* horizontalna površina stopnice */}
              <line
                x1={x}
                y1={yTop}
                x2={x + stepW}
                y2={yTop}
                stroke="#1d2b3e"
                strokeWidth="1.2"
              />
              {/* navpičnica stopnice */}
              <line
                x1={x + stepW}
                y1={yTop}
                x2={x + stepW}
                y2={yTop + drawStepH}
                stroke="#1d2b3e"
                strokeWidth="1.2"
              />
            </g>
          )
        })}
        {/* Vertikala (višina) — levo */}
        <line
          x1={margin - 6}
          y1={baseY}
          x2={margin - 6}
          y2={baseY - drawTotalH}
          stroke="#f59e0b"
          strokeWidth="1.5"
          markerEnd="url(#arrAmberU)"
          markerStart="url(#arrAmberD)"
        />
        <text
          x={margin - 10}
          y={baseY - drawTotalH / 2}
          fill="#f59e0b"
          fontSize="9"
          fontWeight="bold"
          textAnchor="end"
          transform={`rotate(-90 ${margin - 10} ${baseY - drawTotalH / 2})`}
        >
          {Math.round(visinaPosamezne * stStopnic)}mm
        </text>
        {/* Horizontala (globina skupna) — spodaj */}
        <line
          x1={margin}
          y1={baseY + 6}
          x2={margin + maxDraw * stepW}
          y2={baseY + 6}
          stroke="#f59e0b"
          strokeWidth="1.5"
          markerEnd="url(#arrAmberR)"
          markerStart="url(#arrAmberL)"
        />
        <text
          x={margin + (maxDraw * stepW) / 2}
          y={baseY + 18}
          fill="#f59e0b"
          fontSize="9"
          fontWeight="bold"
          textAnchor="middle"
        >
          {Math.round(globinaStopnice * stStopnic)}mm
        </text>
        {/* Kot (lok) — na prvi stopnici */}
        <path
          d={`M ${margin + stepW * 0.4} ${baseY} A ${stepW * 0.4} ${stepW * 0.4} 0 0 0 ${margin + stepW * 0.4} ${baseY - drawStepH * 0.4}`}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="1.2"
        />
        <text
          x={margin + stepW * 0.45}
          y={baseY - drawStepH * 0.5}
          fill="#f59e0b"
          fontSize="9"
          fontWeight="bold"
        >
          {kotStopinje.toFixed(0)}°
        </text>
        {/* markers */}
        <defs>
          <marker
            id="arrAmberR"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill="#f59e0b" />
          </marker>
          <marker
            id="arrAmberL"
            markerWidth="6"
            markerHeight="6"
            refX="1"
            refY="3"
            orient="auto"
          >
            <path d="M6,0 L0,3 L6,6 Z" fill="#f59e0b" />
          </marker>
          <marker
            id="arrAmberU"
            markerWidth="6"
            markerHeight="6"
            refX="3"
            refY="1"
            orient="auto"
          >
            <path d="M0,6 L3,0 L6,6 Z" fill="#f59e0b" />
          </marker>
          <marker
            id="arrAmberD"
            markerWidth="6"
            markerHeight="6"
            refX="3"
            refY="5"
            orient="auto"
          >
            <path d="M0,0 L3,6 L6,0 Z" fill="#f59e0b" />
          </marker>
        </defs>
      </svg>
      <div className="mt-1 flex items-center justify-between text-[9px] text-muted-foreground">
        <span>↕ {Math.round(visinaPosamezne)}mm/stopnico</span>
        <span>↔ {Math.round(globinaStopnice)}mm globina</span>
        <span className="font-bold text-roksal-amber">{kotStopinje.toFixed(1)}° kot</span>
      </div>
      {stStopnic > maxDraw && (
        <p className="text-[9px] text-muted-foreground text-center mt-0.5">
          (prikazanih prvih {maxDraw} od {stStopnic} stopnic)
        </p>
      )}
    </div>
  )
}

// ============================================
// P3 — KOMPONENTA: InlineKotomer (protractor)
// ============================================

function InlineKotomer({
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
      <CornerDownRight className="h-4 w-4 text-roksal-amber" />
    ) : mode === 'KOT_STOPNISCE' ? (
      <Layers2 className="h-4 w-4 text-roksal-amber" />
    ) : (
      <Triangle className="h-4 w-4 text-roksal-amber" />
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
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
            {modeIcon}
            {modeTitle}
          </CardTitle>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
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
        <div className="rounded-lg border border-roksal-navy/10 bg-secondary/20 p-2.5 text-center">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">
            Senzor naprave (beta/gamma)
          </p>
          <p className="text-lg font-bold text-roksal-navy font-mono">
            {currentAngle != null ? `${currentAngle.toFixed(1)}°` : '—'}
            {reading && (
              <span className="ml-2 text-[10px] text-muted-foreground font-normal">
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
            <Gauge className="mr-2 h-4 w-4" />
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
              <Gauge className="mr-1.5 h-4 w-4" />
              {monitoring ? 'Ustavi' : ' merit'}
            </Button>
            <Button
              type="button"
              onClick={handleLockAngle}
              disabled={!monitoring || currentAngle == null}
              className="h-9 bg-roksal-navy text-white hover:bg-roksal-navy/90"
            >
              {lockedAngle != null ? <Lock className="mr-1.5 h-4 w-4" /> : <Unlock className="mr-1.5 h-4 w-4" />}
              {lockedAngle != null ? `Zaklenjeno ${lockedAngle}°` : 'Zakleni kot'}
            </Button>
          </div>
        )}
        {permission === 'denied' && (
          <p className="text-center text-[11px] text-red-600">
            Dostop do senzorjev je zavrnjen.
          </p>
        )}
        {permission === 'unsupported' && (
          <p className="text-center text-[11px] text-amber-600">
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
                <Bookmark className="inline h-2.5 w-2.5 mr-1" />
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
          className="w-full bg-roksal-navy text-white hover:bg-roksal-navy/90 h-9"
        >
          <Save className="mr-2 h-4 w-4" />
          Shrani kot {mode === 'KOT_VOGAL' ? 'vogal' : mode === 'KOT_STOPNISCE' ? 'kot stopnice' : 'kot'}
        </Button>
      </CardContent>
    </Card>
  )
}

// ============================================
// P3 — KOMPONENTA: SteberTable (preglednica stebrov)
// ============================================

function SteberTable({
  measurements,
  segmentId,
  onExportCsv,
}: {
  measurements: Measurement[]
  segmentId: string
  onExportCsv: () => void
}) {
  const stebri = useMemo(() => {
    return measurements
      .filter((m) => m.tipMeritve === 'STEBR' && m.segmentId === segmentId)
      .sort((a, b) => (a.pozicijaMm || 0) - (b.pozicijaMm || 0))
  }, [measurements, segmentId])

  if (stebri.length === 0) return null

  // summary
  const total = stebri.length
  const razmiki = stebri
    .map((s) => s.razmikMm)
    .filter((r): r is number => r != null && r > 0)
  const maxRazmik = razmiki.length > 0 ? Math.max(...razmiki) : 0
  const avgRazmik =
    razmiki.length > 0 ? razmiki.reduce((s, r) => s + r, 0) / razmiki.length : 0
  const materialCounts: Record<string, number> = {}
  stebri.forEach((s) => {
    const m = s.materialStebra || 'DRUGO'
    materialCounts[m] = (materialCounts[m] || 0) + 1
  })

  return (
    <div className="rounded-lg border border-roksal-navy/15 bg-background overflow-hidden slide-in-right">
      <div className="flex items-center justify-between p-2 border-b border-border/40 bg-roksal-navy/5">
        <div className="flex items-center gap-1.5">
          <Columns3 className="h-3.5 w-3.5 text-roksal-navy" />
          <span className="text-[11px] font-semibold text-roksal-navy">
            Preglednica stebrov ({total})
          </span>
        </div>
        <button
          type="button"
          onClick={onExportCsv}
          className="flex items-center gap-1 rounded-md border border-roksal-navy/20 bg-background px-1.5 py-0.5 text-[9px] font-medium text-roksal-navy hover:bg-roksal-navy/10 transition-colors"
        >
          <Download className="h-2.5 w-2.5" />
          CSV
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto scrollbar-thin">
        <Table className="text-[10px]">
          <TableHeader>
            <TableRow className="bg-secondary/40 hover:bg-secondary/40">
              <TableHead className="h-6 px-1.5 text-[9px] font-semibold">Oznaka</TableHead>
              <TableHead className="h-6 px-1.5 text-[9px] font-semibold">Tip</TableHead>
              <TableHead className="h-6 px-1.5 text-[9px] font-semibold text-right">Pozicija</TableHead>
              <TableHead className="h-6 px-1.5 text-[9px] font-semibold text-right">Razmik</TableHead>
              <TableHead className="h-6 px-1.5 text-[9px] font-semibold text-right">Višina</TableHead>
              <TableHead className="h-6 px-1.5 text-[9px] font-semibold">Material</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stebri.map((s, i) => {
              const razmik = s.razmikMm
              const razmikPrevelik = razmik != null && razmik > 1500
              return (
                <TableRow key={s.id} className={i % 2 === 0 ? 'bg-transparent' : 'bg-secondary/10'}>
                  <TableCell className="py-1 px-1.5 font-mono font-bold text-roksal-navy">
                    {s.steberOznaka || s.oznaka || `S${i + 1}`}
                  </TableCell>
                  <TableCell className="py-1 px-1.5">
                    {s.tipStebra && (
                      <span
                        className={`inline-flex rounded px-1 py-0 text-[8px] font-medium border ${tipStebraColors[s.tipStebra]}`}
                      >
                        {tipStebraLabels[s.tipStebra]}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-1 px-1.5 text-right font-mono">
                    {s.pozicijaMm != null ? Math.round(s.pozicijaMm) : '—'}
                  </TableCell>
                  <TableCell
                    className={`py-1 px-1.5 text-right font-mono ${
                      razmikPrevelik ? 'text-red-600 font-bold' : ''
                    }`}
                  >
                    {razmik != null ? Math.round(razmik) : '—'}
                  </TableCell>
                  <TableCell className="py-1 px-1.5 text-right font-mono">
                    {s.visinaStebraMm != null ? Math.round(s.visinaStebraMm) : '—'}
                  </TableCell>
                  <TableCell className="py-1 px-1.5">
                    {s.materialStebra && (
                      <span
                        className={`inline-flex rounded px-1 py-0 text-[8px] font-medium border ${materialStebraColors[s.materialStebra]}`}
                      >
                        {materialStebraLabels[s.materialStebra]}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      {/* Warnings */}
      {maxRazmik > 1500 && (
        <div className="border-t border-red-200 bg-red-50 p-1.5 text-[9px] text-red-700 flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" />
          Razmik {Math.round(maxRazmik)}mm presega 1500mm — preveri statiko!
        </div>
      )}
      {/* Summary */}
      <div className="border-t border-border/40 p-2 grid grid-cols-2 gap-1.5 text-[9px]">
        <div className="rounded bg-secondary/30 p-1.5">
          <p className="text-muted-foreground">Skupno</p>
          <p className="font-bold text-roksal-navy">{total} stebrov</p>
        </div>
        <div className="rounded bg-secondary/30 p-1.5">
          <p className="text-muted-foreground">Povpr. razmik</p>
          <p className="font-bold text-roksal-navy">{Math.round(avgRazmik)}mm</p>
        </div>
        <div className="rounded bg-secondary/30 p-1.5">
          <p className="text-muted-foreground">Max razmik</p>
          <p className={`font-bold ${maxRazmik > 1500 ? 'text-red-600' : 'text-roksal-navy'}`}>
            {Math.round(maxRazmik)}mm
          </p>
        </div>
        <div className="rounded bg-secondary/30 p-1.5">
          <p className="text-muted-foreground">Materiali</p>
          <p className="font-bold text-roksal-navy text-[9px]">
            {Object.entries(materialCounts)
              .map(([k, v]) => `${materialStebraLabels[k as MaterialStebra] || k}: ${v}`)
              .join(', ')}
          </p>
        </div>
      </div>
    </div>
  )
}

// ============================================
// P3 — KOMPONENTA: WpcDiagram (SVG orientacije)
// ============================================

function WpcDiagram({
  orientacija,
  dolzinaMm,
  visinaMm,
  sirinaPalice,
  debelinaPalice,
  razmikPalic,
  kotPosevnih,
}: {
  orientacija: Segment['type']
  dolzinaMm: number
  visinaMm: number
  sirinaPalice: number
  debelinaPalice: number
  razmikPalic: number
  kotPosevnih: number
}) {
  const stPalic = calcWpcPalice(
    orientacija,
    dolzinaMm,
    visinaMm,
    sirinaPalice,
    razmikPalic
  )
  const w = 280
  const h = 160
  const margin = 12
  const innerW = w - margin * 2
  const innerH = h - margin * 2 - 18

  // koliko palic narišemo
  const maxDraw = Math.min(stPalic, 14)
  const korak = sirinaPalice + razmikPalic
  // dimenzije v px
  let paliceCoords: Array<{ x: number; y: number; w: number; h: number }> = []
  if (orientacija === 'WPC_POKOCNE') {
    // navpične palice
    for (let i = 0; i < maxDraw; i++) {
      const x = margin + (i * korak / korak) * (innerW / Math.max(maxDraw, 1))
      paliceCoords.push({
        x: margin + (innerW / Math.max(maxDraw, 1)) * i + 2,
        y: margin,
        w: Math.max(3, sirinaPalice / korak * (innerW / Math.max(maxDraw, 1)) - 4),
        h: innerH,
      })
    }
  } else if (orientacija === 'WPC_VODORAVNE') {
    for (let i = 0; i < maxDraw; i++) {
      paliceCoords.push({
        x: margin,
        y: margin + (innerH / Math.max(maxDraw, 1)) * i + 2,
        w: innerW,
        h: Math.max(2, sirinaPalice / korak * (innerH / Math.max(maxDraw, 1)) - 4),
      })
    }
  } else if (orientacija === 'WPC_POSEVNE') {
    // poševne pod kotom — nariši kot mrežo diagonal
    const angle = (kotPosevnih * Math.PI) / 180
    const numX = Math.min(Math.ceil(Math.sqrt(maxDraw)), 7)
    const numY = Math.min(Math.ceil(maxDraw / numX), 7)
    for (let j = 0; j < numY; j++) {
      for (let i = 0; i < numX; i++) {
        const idx = j * numX + i
        if (idx >= maxDraw) break
        const cx = margin + (innerW / numX) * (i + 0.5)
        const cy = margin + (innerH / numY) * (j + 0.5)
        const len = Math.min(innerW / numX, innerH / numY) * 0.6
        // palica kot rotirani pravokotnik (prikazana kot črta z debelino)
        paliceCoords.push({ x: cx, y: cy, w: len, h: Math.max(3, debelinaPalice / 23 * 4) })
      }
    }
  }

  const orientacijaLabel =
    orientacija === 'WPC_POKOCNE'
      ? 'Pokončne (vertikalne)'
      : orientacija === 'WPC_VODORAVNE'
        ? 'Vodoravne (horizontalne)'
        : `Poševne (${kotPosevnih}°)`

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-2 slide-in-right">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Fence className="h-3.5 w-3.5 text-amber-700" />
          <span className="text-[11px] font-semibold text-roksal-navy">{orientacijaLabel}</span>
        </div>
        <Badge variant="outline" className="text-[9px] h-4 px-1 border-amber-300 text-amber-700">
          {stPalic} palic
        </Badge>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto"
        role="img"
        aria-label={`WPC diagram — ${orientacijaLabel}`}
      >
        {/* okvir (ograjje) — navy */}
        <rect
          x={margin}
          y={margin}
          width={innerW}
          height={innerH}
          fill="none"
          stroke="#1d2b3e"
          strokeWidth="2"
          rx="2"
        />
        {/* Palice */}
        {orientacija === 'WPC_POSEVNE'
          ? paliceCoords.map((p, i) => {
              // rotirana palica kot debela črta
              const angle = (kotPosevnih * Math.PI) / 180
              const dx = (p.w / 2) * Math.cos(angle)
              const dy = (p.w / 2) * Math.sin(angle)
              return (
                <line
                  key={i}
                  x1={p.x - dx}
                  y1={p.y - dy}
                  x2={p.x + dx}
                  y2={p.y + dy}
                  stroke="#f59e0b"
                  strokeWidth={Math.max(3, p.h)}
                  strokeLinecap="round"
                  opacity={0.8}
                />
              )
            })
          : paliceCoords.map((p, i) => (
              <rect
                key={i}
                x={p.x}
                y={p.y}
                width={p.w}
                height={p.h}
                fill="#1d2b3e"
                fillOpacity={0.7}
                rx="0.5"
              />
            ))}
        {/* dimenzije (amber) */}
        <text x={margin} y={h - 4} fill="#f59e0b" fontSize="9" fontWeight="bold">
          ↔ {Math.round(dolzinaMm)}mm
        </text>
        <text x={w - margin} y={h - 4} fill="#f59e0b" fontSize="9" fontWeight="bold" textAnchor="end">
          ↕ {Math.round(visinaMm)}mm
        </text>
      </svg>
      <div className="mt-1 flex items-center justify-between text-[9px] text-muted-foreground">
        <span>Št. palic: {stPalic} kos</span>
        <span className="font-mono">
          WPC {sirinaPalice}×{debelinaPalice}mm, razmak {razmikPalic}mm
        </span>
      </div>
      {stPalic > maxDraw && (
        <p className="text-[9px] text-muted-foreground text-center mt-0.5">
          (prikazanih prvih {maxDraw} palic)
        </p>
      )}
      {razmikPalic > 110 && (
        <p className="text-[9px] text-amber-700 mt-0.5 text-center">
          <AlertCircle className="inline h-2.5 w-2.5 mr-0.5" />
          Razmik {razmikPalic}mm presega 110mm — preveri predpise!
        </p>
      )}
    </div>
  )
}

// ============================================
// DEMO PODATKI
// ============================================

const demoMeasurements: Measurement[] = [
  {
    id: 'm1',
    dolzinaMm: 4200,
    visinaMm: 900,
    lidarScanUrl: '/lidar/scan001.las',
    gpsLokacija: JSON.stringify({ lat: 46.2397, lng: 14.3556 }),
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    projectId: 'demo1',
    lokacija: 'Balkon leva stran',
    steviloStebrov: 4,
    tipPodlage: 'beton',
    kot: 90,
    opombe: 'Stari podbeton je v dobrem stanju',
    arMetadata: JSON.stringify({
      tipMeritve: 'RAZDALJA',
      oznaka: 'dolžina balkona — sever',
      segmentId: 'severni',
      opomba: 'Glavna razdalja severnega dela',
      lokacija: 'Balkon leva stran',
      steviloStebrov: 4,
      tipPodlage: 'beton',
      kot: 90,
      opombe: 'Stari podbeton je v dobrem stanju',
    }),
    tipMeritve: 'RAZDALJA',
    oznaka: 'dolžina balkona — sever',
    segmentId: 'severni',
    opomba: 'Glavna razdalja severnega dela',
    status: 'POTRJENA',
  },
  {
    id: 'm2',
    dolzinaMm: 2100,
    visinaMm: 1050,
    lidarScanUrl: null,
    gpsLokacija: JSON.stringify({ lat: 46.2397, lng: 14.356 }),
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    projectId: 'demo1',
    lokacija: 'Balkon desna stran',
    steviloStebrov: 3,
    tipPodlage: 'plosca',
    kot: 45,
    opombe: 'Kotna povezava z levim balkonom',
    arMetadata: JSON.stringify({
      tipMeritve: 'RAZDALJA',
      oznaka: 'vzhodni del — razdalja',
      segmentId: 'vzhodni',
      lokacija: 'Balkon desna stran',
      steviloStebrov: 3,
      tipPodlage: 'plosca',
      kot: 45,
      opombe: 'Kotna povezava z levim balkonom',
    }),
    tipMeritve: 'RAZDALJA',
    oznaka: 'vzhodni del — razdalja',
    segmentId: 'vzhodni',
    status: 'OSNUTEK',
  },
  {
    id: 'm3',
    dolzinaMm: 5800,
    visinaMm: 1200,
    lidarScanUrl: '/lidar/scan003.las',
    gpsLokacija: JSON.stringify({ lat: 46.24, lng: 14.354 }),
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    projectId: 'demo1',
    lokacija: 'Terasa - sprednja stran',
    steviloStebrov: 6,
    tipPodlage: 'gramoz',
    kot: 90,
    opombe: null,
    arMetadata: JSON.stringify({
      tipMeritve: 'RAZDALJA',
      oznaka: 'terasa — spredaj',
      segmentId: 'severni',
      lokacija: 'Terasa - sprednja stran',
      steviloStebrov: 6,
      tipPodlage: 'gramoz',
      kot: 90,
    }),
    tipMeritve: 'RAZDALJA',
    oznaka: 'terasa — spredaj',
    segmentId: 'severni',
    status: 'POTRJENA',
  },
  {
    id: 'm4',
    dolzinaMm: 3400,
    visinaMm: 900,
    lidarScanUrl: null,
    gpsLokacija: JSON.stringify({ lat: 46.24, lng: 14.354 }),
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    projectId: 'demo1',
    lokacija: 'Stopnišče - zgornje nadstropje',
    steviloStebrov: 3,
    tipPodlage: 'les',
    kot: 90,
    opombe: 'Preveriti nosilnost lesa',
    arMetadata: JSON.stringify({
      tipMeritve: 'VISINA',
      oznaka: 'višina ograje — stopnišče',
      segmentId: 'stopniscje',
      opomba: 'Preveriti nosilnost lesa — prag je star',
      lokacija: 'Stopnišče - zgornje nadstropje',
      steviloStebrov: 3,
      tipPodlage: 'les',
      kot: 90,
      opombe: 'Preveriti nosilnost lesa',
    }),
    tipMeritve: 'VISINA',
    oznaka: 'višina ograje — stopnišče',
    segmentId: 'stopniscje',
    opomba: 'Preveriti nosilnost lesa — prag je star',
    status: 'OSNUTEK',
  },
  {
    id: 'm5',
    dolzinaMm: 1,
    visinaMm: 1,
    lidarScanUrl: null,
    gpsLokacija: null,
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    projectId: 'demo1',
    lokacija: 'Talna plošča balkona',
    arMetadata: JSON.stringify({
      tipMeritve: 'NAGIB',
      oznaka: 'Nagib — Talna plošča balkona',
      opomba: 'Nagib 2.5° (levo-desno)',
      kotStopinje: 2.5,
      smer: 'Y',
      lokacija: 'Talna plošča balkona',
      status: 'ARHIVIRANA',
    }),
    tipMeritve: 'NAGIB',
    oznaka: 'Nagib — Talna plošča balkona',
    opomba: 'Nagib 2.5° (levo-desno)',
    status: 'ARHIVIRANA',
    kotStopinje: 2.5,
  },
  // P3 — demo stebriček
  {
    id: 'm6',
    dolzinaMm: 0,
    visinaMm: 1100,
    lidarScanUrl: null,
    gpsLokacija: JSON.stringify({ lat: 46.2397, lng: 14.3556 }),
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    projectId: 'demo1',
    lokacija: 'Začetek balkona',
    arMetadata: JSON.stringify({
      tipMeritve: 'STEBR',
      oznaka: 'S1',
      segmentId: 'severni',
      opomba: 'Stebriček S1 — Končni (ALU), višina 1100mm, pozicija 0mm',
      status: 'POTRJENA',
      tipStebra: 'KONCNI',
      materialStebra: 'ALU',
      visinaStebraMm: 1100,
      pozicijaMm: 0,
      steberOznaka: 'S1',
      enota: 'mm',
    }),
    tipMeritve: 'STEBR',
    oznaka: 'S1',
    segmentId: 'severni',
    opomba: 'Stebriček S1 — Končni (ALU), pozicija 0mm',
    status: 'POTRJENA',
    tipStebra: 'KONCNI',
    materialStebra: 'ALU',
    visinaStebraMm: 1100,
    pozicijaMm: 0,
    steberOznaka: 'S1',
    enota: 'mm',
  },
  {
    id: 'm7',
    dolzinaMm: 1500,
    visinaMm: 1100,
    lidarScanUrl: null,
    gpsLokacija: JSON.stringify({ lat: 46.2397, lng: 14.3556 }),
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    projectId: 'demo1',
    lokacija: 'Vmesni steber',
    arMetadata: JSON.stringify({
      tipMeritve: 'STEBR',
      oznaka: 'S2',
      segmentId: 'severni',
      opomba: 'Stebriček S2 — Vmesni (ALU), višina 1100mm, pozicija 1500mm',
      status: 'OSNUTEK',
      tipStebra: 'VMESNI',
      materialStebra: 'ALU',
      visinaStebraMm: 1100,
      pozicijaMm: 1500,
      razmikMm: 1500,
      steberOznaka: 'S2',
      enota: 'mm',
    }),
    tipMeritve: 'STEBR',
    oznaka: 'S2',
    segmentId: 'severni',
    opomba: 'Stebriček S2 — Vmesni (ALU), pozicija 1500mm',
    status: 'OSNUTEK',
    tipStebra: 'VMESNI',
    materialStebra: 'ALU',
    visinaStebraMm: 1100,
    pozicijaMm: 1500,
    razmikMm: 1500,
    steberOznaka: 'S2',
    enota: 'mm',
  },
  {
    id: 'm8',
    dolzinaMm: 3000,
    visinaMm: 1100,
    lidarScanUrl: null,
    gpsLokacija: JSON.stringify({ lat: 46.2397, lng: 14.3556 }),
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    projectId: 'demo1',
    lokacija: 'Vogalni steber',
    arMetadata: JSON.stringify({
      tipMeritve: 'STEBR',
      oznaka: 'S3',
      segmentId: 'severni',
      opomba: 'Stebriček S3 — Vogalni (INOX), višina 1100mm, pozicija 3000mm',
      status: 'OSNUTEK',
      tipStebra: 'VOGALNI',
      materialStebra: 'INOX',
      visinaStebraMm: 1100,
      pozicijaMm: 3000,
      razmikMm: 1500,
      steberOznaka: 'S3',
      enota: 'mm',
    }),
    tipMeritve: 'STEBR',
    oznaka: 'S3',
    segmentId: 'severni',
    opomba: 'Stebriček S3 — Vogalni (INOX), pozicija 3000mm',
    status: 'OSNUTEK',
    tipStebra: 'VOGALNI',
    materialStebra: 'INOX',
    visinaStebraMm: 1100,
    pozicijaMm: 3000,
    razmikMm: 1500,
    steberOznaka: 'S3',
    enota: 'mm',
  },
  // P3 — demo KOT_VOGAL meritev
  {
    id: 'm9',
    dolzinaMm: 1,
    visinaMm: 1,
    lidarScanUrl: null,
    gpsLokacija: null,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    projectId: 'demo1',
    lokacija: 'Vogal L-oblike',
    arMetadata: JSON.stringify({
      tipMeritve: 'KOT_VOGAL',
      oznaka: 'Vogal — Vogal L-oblike',
      opomba: 'Notranji kot: 90°, Zunanji kot: 90°',
      kotStopinje: 90,
      notranjiKot: 90,
      zunanjiKot: 90,
      lokacija: 'Vogal L-oblike',
      status: 'OSNUTEK',
    }),
    tipMeritve: 'KOT_VOGAL',
    oznaka: 'Vogal — Vogal L-oblike',
    opomba: 'Notranji kot: 90°, Zunanji kot: 90°',
    status: 'OSNUTEK',
    kotStopinje: 90,
    notranjiKot: 90,
    zunanjiKot: 90,
  },
  // P3 — demo KOT_STOPNISCE
  {
    id: 'm10',
    dolzinaMm: 1,
    visinaMm: 1,
    lidarScanUrl: null,
    gpsLokacija: null,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    projectId: 'demo1',
    lokacija: 'Stopnišče',
    arMetadata: JSON.stringify({
      tipMeritve: 'KOT_STOPNISCE',
      oznaka: 'Kot stopnice — Stopnišče',
      opomba: 'Kot: 33° (Stopnišče)',
      kotStopinje: 33,
      lokacija: 'Stopnišče',
      status: 'OSNUTEK',
    }),
    tipMeritve: 'KOT_STOPNISCE',
    oznaka: 'Kot stopnice — Stopnišče',
    opomba: 'Kot: 33° (Stopnišče)',
    status: 'OSNUTEK',
    kotStopinje: 33,
  },
  // P3 — demo WPC terasa — dimenzije za WPC diagram
  {
    id: 'm11',
    dolzinaMm: 4200,
    visinaMm: 1100,
    lidarScanUrl: null,
    gpsLokacija: JSON.stringify({ lat: 46.2397, lng: 14.3556 }),
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    projectId: 'demo1',
    lokacija: 'WPC terasa — dolžina',
    arMetadata: JSON.stringify({
      tipMeritve: 'RAZDALJA',
      oznaka: 'WPC terasa — dolžina',
      segmentId: 'wpc-terasa',
      opomba: 'Dolžina WPC terase — pokončne palice',
      status: 'OSNUTEK',
      enota: 'mm',
    }),
    tipMeritve: 'RAZDALJA',
    oznaka: 'WPC terasa — dolžina',
    segmentId: 'wpc-terasa',
    opomba: 'Dolžina WPC terase — pokončne palice',
    status: 'OSNUTEK',
    enota: 'mm',
  },
]

const demoProjects: Project[] = [
  { id: 'demo1', nazivProjekta: 'Ograja Horjul - WPC Classic' },
  { id: 'demo2', nazivProjekta: 'Terasa Kranj - Inox Z-line' },
]
