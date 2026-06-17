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
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ============================================
// TIPI
// ============================================

type TipMeritve = 'RAZDALJA' | 'VISINA' | 'KOT' | 'NAGIB' | 'GLOBINA' | 'PREMER' | 'SEGMENT'

type GroundType = 'beton' | 'les' | 'plosca' | 'gramoz' | 'metal'

interface ArMetadata {
  tipMeritve?: TipMeritve
  oznaka?: string
  segmentId?: string
  opomba?: string
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
  type: 'ravni' | 'kotni' | 'stopniscje' | 'lokan'
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
}

const tipMeritveIcons: Record<TipMeritve, typeof Ruler> = {
  RAZDALJA: Ruler,
  VISINA: Gauge,
  KOT: Triangle,
  NAGIB: Mountain,
  GLOBINA: Crosshair,
  PREMER: Crosshair,
  SEGMENT: Layers,
}

const tipMeritveColors: Record<TipMeritve, string> = {
  RAZDALJA: 'bg-roksal-navy/10 text-roksal-navy border-roksal-navy/20',
  VISINA: 'bg-roksal-amber/10 text-roksal-amber border-roksal-amber/30',
  KOT: 'bg-purple-50 text-purple-700 border-purple-200',
  NAGIB: 'bg-orange-50 text-orange-700 border-orange-200',
  GLOBINA: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  PREMER: 'bg-teal-50 text-teal-700 border-teal-200',
  SEGMENT: 'bg-gray-50 text-gray-700 border-gray-200',
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
}

const LOKACIJE_INCLINOMETER = [
  'Talna plošča balkona',
  'Podkonstrukcija',
  'Rob balkona',
  'Stopnišče',
  'Terasa',
  'Drugo',
]

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
        // privzeti demo segmenti
        setSegments([
          { id: 'severni', name: 'Severni del', type: 'ravni' },
          { id: 'vzhodni', name: 'Vzhodni del', type: 'kotni' },
          { id: 'stopniscje', name: 'Stopnišče', type: 'stopniscje' },
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
  }

  async function handleSubmitMeasurement() {
    if (!selectedProject || !formLength || !formHeight) {
      toast.error('Vnesite dolžino in višino!')
      return
    }
    if (parseFloat(formLength) < 1 || parseFloat(formHeight) < 1) {
      toast.error('Meritve morajo biti pozitivne!')
      return
    }
    setSubmitting(true)

    const arMetadata: ArMetadata = {
      tipMeritve: formTipMeritve,
      oznaka: formOznaka || undefined,
      segmentId: formSegmentId || undefined,
      opomba: formOpomba || undefined,
      lokacija: formLocation || undefined,
      steviloStebrov: formPosts ? parseInt(formPosts) : undefined,
      tipPodlage: formGround,
      kot: formAngle ? parseFloat(formAngle) : undefined,
      opombe: formNotes || undefined,
    }

    try {
      const res = await fetch('/api/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject,
          dolzinaMm: parseInt(formLength),
          visinaMm: parseInt(formHeight),
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
        }
        setMeasurements((prev) => [newMeasurement, ...prev])
        resetForm()
        setFormOpen(false)
        toast.success('Meritev dodana!')
      } else {
        // Server error — save locally as fallback
        saveLocalMeasurement(arMetadata)
        toast.error('Napaka strežnika — meritev shranjena lokalno')
      }
    } catch {
      saveLocalMeasurement(arMetadata)
      toast.success('Meritev dodana (lokalno)!')
    } finally {
      setSubmitting(false)
    }
  }

  function saveLocalMeasurement(ar: ArMetadata) {
    const newMeasurement: Measurement = {
      id: `local_${Date.now()}`,
      dolzinaMm: parseInt(formLength),
      visinaMm: parseInt(formHeight),
      lidarScanUrl: null,
      gpsLokacija: JSON.stringify({ lat: 46.2397, lng: 14.3556 }),
      createdAt: new Date().toISOString(),
      projectId: selectedProject,
      lokacija: formLocation || null,
      steviloStebrov: formPosts ? parseInt(formPosts) : null,
      tipPodlage: formGround,
      kot: formAngle ? parseFloat(formAngle) : null,
      opombe: formNotes || null,
      arMetadata: JSON.stringify(ar),
      tipMeritve: formTipMeritve,
      oznaka: formOznaka || undefined,
      segmentId: formSegmentId || undefined,
      opomba: formOpomba || undefined,
    }
    setMeasurements((prev) => [newMeasurement, ...prev])
    resetForm()
    setFormOpen(false)
  }

  function handleDeleteMeasurement(id: string) {
    setMeasurements((prev) => prev.filter((m) => m.id !== id))
    toast.success('Meritev izbrisana')
  }

  function handleDuplicateMeasurement(m: Measurement) {
    const duplicate: Measurement = {
      ...m,
      id: `local_${Date.now()}`,
      createdAt: new Date().toISOString(),
      lokacija: m.lokacija ? `${m.lokacija} (kopija)` : 'Kopija',
      oznaka: m.oznaka ? `${m.oznaka} (kopija)` : undefined,
    }
    setMeasurements((prev) => [duplicate, ...prev])
    toast.success('Meritev podvojena!')
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

  // Grupiranje po datumu (obstoječa logika)
  const groupedMeasurements = useMemo((): MeasurementGroup[] => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 86400000)

    const groups: MeasurementGroup[] = []
    const grouped = new Map<string, Measurement[]>()

    const sorted = [...measurements].sort(
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
  }, [measurements])

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
        }
        setMeasurements((prev) => [newMeasurement, ...prev])
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
          arMetadata: JSON.stringify(arMetadata),
          tipMeritve: inclinometerMode,
          oznaka: arMetadata.oznaka,
          opomba: arMetadata.opomba,
        }
        setMeasurements((prev) => [newMeasurement, ...prev])
        toast.success(`${inclinometerMode === 'KOT' ? 'Kot' : 'Nagib'} ${kotStopinje}° shranjen (lokalno)`)
        setInclinometerOpen(false)
      }
    } catch {
      toast.error('Napaka pri shranjevanju')
    }
  }

  // ============================================
  // IZVOZ CSV
  // ============================================

  function handleExportCSV() {
    if (measurements.length === 0) {
      toast.error('Ni meritev za izvoz')
      return
    }
    const header = 'Oznaka,Tip,Lokacija,Segment,Dolzina(mm),Visina(mm),Stebri,Podlaga,Kot,Opomba,Opombe,Datum'
    const rows = measurements.map((m) => {
      const oznaka = (m.oznaka || '').replace(/"/g, '""')
      const tip = m.tipMeritve ? tipMeritveLabels[m.tipMeritve] : 'Razdalja'
      const lokacija = (m.lokacija || '').replace(/"/g, '""')
      const segment = (m.segmentId || '').replace(/"/g, '""')
      const dolzina = String(m.dolzinaMm)
      const visina = String(m.visinaMm)
      const stebri = m.steviloStebrov ? String(m.steviloStebrov) : ''
      const podlaga = m.tipPodlage ? (groundTypeLabels[m.tipPodlage as GroundType] || m.tipPodlage) : ''
      const kot = m.kot ? String(m.kot) : ''
      const opomba = (m.opomba || '').replace(/"/g, '""')
      const opombe = (m.opombe || '').replace(/"/g, '""')
      const datum = new Date(m.createdAt).toLocaleDateString('sl-SI')
      return `"${oznaka}","${tip}","${lokacija}","${segment}",${dolzina},${visina},${stebri},"${podlaga}",${kot},"${opomba}","${opombe}",${datum}`
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
    return (
      <div
        key={m.id}
        className="rounded-xl border border-border/50 overflow-hidden transition-colors hover:border-roksal-navy/20 slide-in-right"
      >
        {/* Glava meritve */}
        <div className="flex items-center justify-between p-3 pb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-roksal-navy truncate">
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
                {m.tipMeritve !== 'KOT' && m.tipMeritve !== 'NAGIB' && (
                  <span className="text-xs text-muted-foreground font-mono">
                    ↔ {formatDimension(m.dolzinaMm)} × ↕ {formatDimension(m.visinaMm)}
                  </span>
                )}
                {(m.tipMeritve === 'KOT' || m.tipMeritve === 'NAGIB') && m.opomba && (
                  <span className="text-xs text-roksal-amber font-mono">{m.opomba}</span>
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
              <p className="text-sm font-bold text-roksal-navy">{formatDimension(totalLength)}</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Povpr. višina</p>
              <p className="text-sm font-bold text-roksal-navy">{formatDimension(Math.round(avgHeight))}</p>
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
              <p className="text-sm font-bold text-roksal-navy">
                {longestMeasurement ? formatDimension(longestMeasurement.dolzinaMm) : '—'}
              </p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Površina</p>
              <p className="text-sm font-bold text-roksal-navy">{formatM2(totalArea)}</p>
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
        </CardContent>
      </Card>

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

            {/* Length + Height */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  <Ruler className="inline h-3 w-3 mr-1" />
                  Dolžina (mm)
                </Label>
                <Input
                  type="number"
                  value={formLength}
                  onChange={(e) => setFormLength(e.target.value)}
                  placeholder="3000"
                  className="h-10 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  <Ruler className="inline h-3 w-3 mr-1 rotate-90" />
                  Višina (mm)
                </Label>
                <Input
                  type="number"
                  value={formHeight}
                  onChange={(e) => setFormHeight(e.target.value)}
                  placeholder="900"
                  className="h-10 font-mono"
                />
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

            {/* Opomba (textarea) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Opomba</Label>
              <Textarea
                value={formOpomba}
                onChange={(e) => setFormOpomba(e.target.value)}
                placeholder="Podrobnejši opis, posebnosti, opozorila..."
                className="min-h-[60px] text-sm"
              />
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
                              setFormOpen(true)
                              setAddSegmentOpen(false)
                            }}
                            className="w-full rounded-lg border border-dashed border-roksal-navy/30 py-1.5 text-[10px] text-roksal-navy hover:bg-roksal-navy/5 transition-colors"
                          >
                            <Plus className="inline h-3 w-3 mr-1" />
                            Dodaj meritev v ta segment
                          </button>
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
              <Badge variant="secondary">{measurements.length}</Badge>
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
          ) : measurements.length > 0 ? (
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
              <p className="mt-2 text-sm text-muted-foreground">Še ni meritev</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">
                Dodajte novo meritev za ogrodje
              </p>
            </div>
          )}
        </CardContent>
      </Card>
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
    }),
    tipMeritve: 'NAGIB',
    oznaka: 'Nagib — Talna plošča balkona',
    opomba: 'Nagib 2.5° (levo-desno)',
  },
]

const demoProjects: Project[] = [
  { id: 'demo1', nazivProjekta: 'Ograja Horjul - WPC Classic' },
  { id: 'demo2', nazivProjekta: 'Terasa Kranj - Inox Z-line' },
]
