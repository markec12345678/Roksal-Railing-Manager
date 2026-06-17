'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
} from 'lucide-react'

interface Measurement {
  id: string
  dolzinaMm: number
  visinaMm: number
  lidarScanUrl?: string | null
  gpsLokacija?: string | null
  createdAt: string
  projectId: string
  lokacija?: string | null
  steviloStebrov?: number | null
  tipPodlage?: string | null
  kot?: number | null
  opombe?: string | null
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

type GroundType = 'beton' | 'les' | 'plosca' | 'gramoz' | 'metal'

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

interface MeasurementsTabProps {
  onNavigateToCalculator?: (dolzinaMm: number, visinaMm: number, locationName: string) => void
}

export function MeasurementsTab({ onNavigateToCalculator }: MeasurementsTabProps) {
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [formOpen, setFormOpen] = useState(false)

  // Form fields
  const [formLength, setFormLength] = useState('')
  const [formHeight, setFormHeight] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formPosts, setFormPosts] = useState('')
  const [formGround, setFormGround] = useState<GroundType>('beton')
  const [formAngle, setFormAngle] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
                setMeasurements(measData)
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

  // Re-fetch measurements when project changes
  useEffect(() => {
    if (!selectedProject || loading) return
    async function fetchMeasurements() {
      try {
        const measRes = await fetch(`/api/measurements?projectId=${selectedProject}`)
        if (measRes.ok) {
          const measData = await measRes.json()
          setMeasurements(measData.length > 0 ? measData : demoMeasurements.filter(m => m.projectId === selectedProject))
        }
      } catch {
        // keep existing
      }
    }
    fetchMeasurements()
  }, [selectedProject, loading])

  function resetForm() {
    setFormLength('')
    setFormHeight('')
    setFormLocation('')
    setFormPosts('')
    setFormGround('beton')
    setFormAngle('')
    setFormNotes('')
  }

  async function handleSubmitMeasurement() {
    if (!selectedProject || !formLength || !formHeight) {
      toast.error('Vnesite dolžino in višino!')
      return
    }
    if (parseFloat(formLength) < 100 || parseFloat(formHeight) < 100) {
      toast.error('Meritve morajo biti vsaj 100mm!')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject,
          dolzinaMm: parseInt(formLength),
          visinaMm: parseInt(formHeight),
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
        }
        setMeasurements((prev) => [newMeasurement, ...prev])
        resetForm()
        setFormOpen(false)
        toast.success('Meritev dodana!')
      } else {
        // Server returned error — save locally as fallback
        setMeasurements((prev) => [
          {
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
          },
          ...prev,
        ])
        resetForm()
        setFormOpen(false)
        toast.error('Napaka strežnika — meritev shranjena lokalno')
      }
    } catch {
      setMeasurements((prev) => [
        {
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
        },
        ...prev,
      ])
      resetForm()
      setFormOpen(false)
      toast.success('Meritev dodana (lokalno)!')
    } finally {
      setSubmitting(false)
    }
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
    }
    setMeasurements((prev) => [duplicate, ...prev])
    toast.success('Meritev podvojena!')
  }

  // Quick spacing calc for a measurement
  function getQuickSpacing(dolzinaMm: number, visinaMm: number, slatWidth: number = 80, maxGap: number = 100) {
    const n = Math.ceil((dolzinaMm - maxGap) / (maxGap + slatWidth))
    const actualGap = (dolzinaMm - n * slatWidth) / (n + 1)
    return {
      slatCount: n,
      gap: Math.round(actualGap * 10) / 10,
      compliant: actualGap <= 100,
      postSpacing: dolzinaMm / Math.max(1, n > 5 ? Math.ceil(n / 5) : 2),
    }
  }

  const lidarScans = measurements.filter((m) => m.lidarScanUrl).length
  const totalLength = measurements.reduce((sum, m) => sum + m.dolzinaMm, 0)
  const avgLength = measurements.length > 0
    ? measurements.reduce((s, m) => s + m.dolzinaMm, 0) / measurements.length
    : 0
  const avgHeight = measurements.length > 0
    ? measurements.reduce((s, m) => s + m.visinaMm, 0) / measurements.length
    : 0
  const totalPosts = measurements.reduce((sum, m) => sum + (m.steviloStebrov || 0), 0)

  // Date grouping
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

      if (!grouped.has(label)) {
        grouped.set(label, [])
      }
      grouped.get(label)!.push(m)
    }

    for (const [label, meas] of grouped) {
      groups.push({ label, date: new Date(meas[0].createdAt), measurements: meas })
    }

    return groups
  }, [measurements])

  function formatDimension(mm: number): string {
    if (mm >= 1000) return `${(mm / 1000).toFixed(2)}m`
    return `${mm}mm`
  }

  function renderRailingDiagram(dolzina: number, visina: number, _slatCount?: number) {
    const maxDim = Math.max(dolzina, visina)
    const barWidthPct = Math.min((dolzina / maxDim) * 100, 100)
    const heightPct = Math.min((visina / maxDim) * 40, 40)

    // Always calculate spacing for visual diagram
    const calc = getQuickSpacing(dolzina, visina)
    const numSlats = Math.min(calc.slatCount, 15)
    const gapWidth = calc && numSlats > 0 ? ((dolzina - numSlats * 80) / (numSlats + 1)) : 0
    const gapPct = gapWidth / dolzina * 100

    return (
      <div className="w-full">
        {/* Visual diagram */}
        <div className="relative rounded-lg border border-roksal-navy/20 bg-gradient-to-b from-roksal-navy/3 to-roksal-navy/8 p-3">
          {/* Dimension labels */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-mono text-muted-foreground">0</span>
            <span className="text-[9px] font-mono text-muted-foreground">{formatDimension(dolzina)}</span>
          </div>

          {/* Railing side view */}
          <div className="relative flex items-end gap-0" style={{ height: `${Math.max(heightPct, 20)}px` }}>
            {/* Left post */}
            <div className="w-[4px] h-full bg-roksal-navy rounded-full" />
            {/* Slats section */}
            <div className="flex-1 flex items-end h-full gap-0">
              {numSlats > 0 ? (
                <>
                  {/* Gap + Slats + Gaps */}
                  <div className="flex-1 h-full flex items-end gap-0">
                    {/* Left edge gap */}
                    <div className="h-full bg-transparent" style={{ width: `${gapPct}%` }} />
                    {/* Slats and gaps */}
                    {Array.from({ length: numSlats }).map((_, i) => (
                      <div key={i} className="flex h-full">
                        <div className="h-[85%] bg-roksal-navy/70 rounded-[1px]" style={{ width: `${(80 / dolzina) * 100}%`, minWidth: '2px' }} />
                        {i < numSlats - 1 && (
                          <div className="h-full bg-roksal-amber/30" style={{ width: `${gapPct}%`, minWidth: '1px' }} />
                        )}
                      </div>
                    ))}
                    {/* Right edge gap */}
                    <div className="h-full bg-transparent" style={{ width: `${gapPct}%` }} />
                  </div>
                </>
              ) : (
                <div className="flex-1 h-full border-t-2 border-dashed border-roksal-navy/30" />
              )}
            </div>
            {/* Right post */}
            <div className="w-[4px] h-full bg-roksal-navy rounded-full" />
          </div>

          {/* Bottom rail */}
          <div className="mt-0.5 flex">
            <div className="w-[4px] bg-roksal-navy rounded-full" />
            <div className="flex-1 h-[3px] bg-roksal-navy/40 rounded" />
            <div className="w-[4px] bg-roksal-navy rounded-full" />
          </div>

          {/* Height dimension */}
          <div className="absolute -right-1 top-2 flex items-center gap-0.5">
            <div className="w-[1px] h-4 border-l border-dashed border-muted-foreground/40" />
            <span className="text-[8px] font-mono text-muted-foreground">{formatDimension(visina)}</span>
          </div>
        </div>

        {/* Quick spacing result */}
        {numSlats > 0 && (
          <div className={`mt-1.5 flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[10px] border ${
            calc.compliant
              ? 'bg-roksal-green/8 border-roksal-green/20 text-roksal-green'
              : 'bg-roksal-red/8 border-roksal-red/20 text-roksal-red'
          }`}>
            <span className="font-medium">
              {calc.slatCount} letvev × 80mm = razmik {calc.gap}mm
            </span>
            <span className="font-bold">
              {calc.compliant ? '✓ SKLADNO' : '✗ NESKLADNO'}
            </span>
          </div>
        )}
      </div>
    )
  }

  function handleExportCSV() {
    if (measurements.length === 0) {
      toast.error('Ni meritev za izvoz')
      return
    }
    const header = 'Lokacija,Dolzina(mm),Visina(mm),Stevilo stebrov,Tip podlage,Kot,Opombe,Datum'
    const rows = measurements.map((m) => {
      const lokacija = m.lokacija || ''
      const dolzina = String(m.dolzinaMm)
      const visina = String(m.visinaMm)
      const stebri = m.steviloStebrov ? String(m.steviloStebrov) : ''
      const podlaga = m.tipPodlage ? (groundTypeLabels[m.tipPodlage as GroundType] || m.tipPodlage) : ''
      const kot = m.kot ? String(m.kot) : ''
      const opombe = (m.opombe || '').replace(/"/g, '""')
      const datum = new Date(m.createdAt).toLocaleDateString('sl-SI')
      return `${lokacija},${dolzina},${visina},${stebri},${podlaga},${kot},"${opombe}",${datum}`
    })
    const csvContent = '\uFEFF' + header + '\n' + rows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `meritve_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('CSV izvožen!')
  }

  function parseGPS(gpsStr: string | null): { lat: number; lng: number } | null {
    if (!gpsStr) return null
    try {
      return JSON.parse(gpsStr)
    } catch {
      return null
    }
  }

  return (
    <div className="space-y-4 px-4 pb-4 pt-2">
      <div>
        <h2 className="text-xl font-bold text-roksal-navy">Meritve</h2>
        <p className="text-sm text-muted-foreground">
          Meritve ograj, dimenzije in razmiki
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
          </div>
        </CardContent>
      </Card>

      {/* Stats Header */}
      <div className="grid grid-cols-4 gap-2">
        <Card className="px-2 py-2.5 card-hover animate-fade-in-up" style={{ animationDelay: '0ms' }}>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">
            Meritve
          </p>
          <p className="text-lg font-bold text-roksal-navy">{measurements.length}</p>
        </Card>
        <Card className="px-2 py-2.5 card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '30ms' }}>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">
            Stebri
          </p>
          <p className="text-lg font-bold text-roksal-navy">{totalPosts || '—'}</p>
        </Card>
        <Card className="px-2 py-2.5 card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">
            LiDAR
          </p>
          <p className="text-lg font-bold text-roksal-navy">{lidarScans}</p>
        </Card>
        <Card className="px-2 py-2.5 card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '90ms' }}>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">
            Skupaj
          </p>
          <p className="text-lg font-bold text-roksal-navy">
            {(totalLength / 1000).toFixed(1)}m
          </p>
        </Card>
      </div>

      {/* Average Dimensions Card */}
      {measurements.length > 0 && (
        <Card className="card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
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

      {/* Add Measurement Form - Collapsible */}
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
              <p className="text-[10px] text-muted-foreground">Dolžina, višina, lokacija, podlaga...</p>
            </div>
          </div>
          {formOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {formOpen && (
          <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-3 slide-in-right">
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
                <Select value={formGround} onValueChange={(v) => setFormGround(v as GroundType)}>
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

            {/* Angle */}
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
                        <p className={`text-lg font-bold ${calc.compliant ? 'text-roksal-green' : 'text-roksal-red'}`}>
                          {calc.slatCount} letvev
                        </p>
                        <p className="text-[9px] text-muted-foreground">
                          razmik {calc.gap}mm
                        </p>
                      </div>
                    )
                  })() : (
                    <p className="text-[10px] text-muted-foreground">
                      Vnesite meritve za<br />hitri izračun razmikov
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Opombe</Label>
              <Input
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Posebnosti, opazke..."
                className="h-10"
              />
            </div>

            {/* Scan + Submit */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                className="h-9 px-3 text-[11px] gap-1.5 shrink-0 transition-colors"
                onClick={() => toast.info('LiDAR skeniranje bo kmalu na voljo')}
              >
                <Scan className="h-3.5 w-3.5" />
                Scaniraj
              </Button>
              <Button
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

      {/* Measurements List */}
      <Card className="card-hover animate-fade-in-up" style={{ animationDelay: '240ms' }}>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-roksal-navy">
              Seznam meritev
            </CardTitle>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleExportCSV}
                className="flex items-center gap-1 rounded-lg border border-roksal-navy/20 bg-roksal-navy/5 px-2 py-1 text-[10px] font-medium text-roksal-navy hover:bg-roksal-navy/10 active:scale-[0.96] transition-all duration-150"
                disabled={loading || measurements.length === 0}
              >
                <Download className="h-3 w-3" />
                Izvozi CSV
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
                  {/* Date header */}
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
                  {/* Measurements in group */}
                  <div className="space-y-3">
                    {group.measurements.map((m) => {
                      const gps = parseGPS(m.gpsLokacija ?? null)
                      return (
                        <div
                          key={m.id}
                          className="rounded-xl border border-border/50 overflow-hidden transition-colors hover:border-roksal-navy/20 slide-in-right"
                        >
                          {/* Measurement header */}
                          <div className="flex items-center justify-between p-3 pb-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {/* Location name or default */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-roksal-navy truncate">
                                    {m.lokacija || `Meritev #${m.id.slice(-4)}`}
                                  </p>
                                  {m.kot && m.kot !== 90 && (
                                    <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                                      {m.kot}°
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-muted-foreground font-mono">
                                    ↔ {formatDimension(m.dolzinaMm)} × ↕ {formatDimension(m.visinaMm)}
                                  </span>
                                  {m.steviloStebrov && (
                                    <Badge variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0">
                                      {m.steviloStebrov} stebrov
                                    </Badge>
                                  )}
                                  {m.tipPodlage && (
                                    <span className={`inline-flex items-center rounded px-1 py-0 text-[8px] font-medium border ${groundTypeColors[m.tipPodlage as GroundType] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                      {groundTypeLabels[m.tipPodlage as GroundType] || m.tipPodlage}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {/* Action buttons */}
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

                          {/* Railing diagram */}
                          <div className="px-3 pb-2">
                            {renderRailingDiagram(m.dolzinaMm, m.visinaMm)}
                          </div>

                          {/* Footer info + Calculator button */}
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
                              {m.opombe && (
                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground max-w-[30%] truncate">
                                  <AlertCircle className="h-3 w-3 shrink-0" />
                                  <span className="truncate hidden sm:inline">{m.opombe}</span>
                                </div>
                              )}
                              {onNavigateToCalculator && (
                                <button
                                  type="button"
                                  onClick={() => onNavigateToCalculator(m.dolzinaMm, m.visinaMm, m.lokacija || `Meritev #${m.id.slice(-4)}`)}
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
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <Ruler className="mx-auto h-8 w-8 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">
                Še ni meritev
              </p>
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
  },
  {
    id: 'm3',
    dolzinaMm: 5800,
    visinaMm: 1200,
    lidarScanUrl: '/lidar/scan003.las',
    gpsLokacija: JSON.stringify({ lat: 46.240, lng: 14.354 }),
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    projectId: 'demo1',
    lokacija: 'Terasa - sprednja stran',
    steviloStebrov: 6,
    tipPodlage: 'gramoz',
    kot: 90,
    opombe: null,
  },
  {
    id: 'm4',
    dolzinaMm: 3400,
    visinaMm: 900,
    lidarScanUrl: null,
    gpsLokacija: JSON.stringify({ lat: 46.240, lng: 14.354 }),
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    projectId: 'demo1',
    lokacija: 'Stopnišče - zgornje nadstropje',
    steviloStebrov: 3,
    tipPodlage: 'les',
    kot: 90,
    opombe: 'Preveriti nosilnost lesa',
  },
]

const demoProjects: Project[] = [
  { id: 'demo1', nazivProjekta: 'Ograja Horjul - WPC Classic' },
  { id: 'demo2', nazivProjekta: 'Terasa Kranj - Inox Z-line' },
]
