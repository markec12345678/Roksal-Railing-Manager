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
import { EmptyState } from '@/components/ui/empty-state'
import { parseSlDimension, useSpeechRecognition } from '@/lib/sl-speech'
import { measurementStatusCounts } from '@/lib/measurement-status'
// R276 (issue #16 §6) — zgodovina verzij meritev: oznake vira (EN VIR z
// kontraktom #16 §2) za prikaz na kartici meritve.
import { MERITEV_VIR_LABELS, type MeritevVir } from '@/lib/meritev-verzije'
// R283 (issue #15 §3) — pokritost virov vidnega seznama (fail-closed
// čiste funkcije; EN VIR resnice = filteredMeasurements).
import { izracunajMeritveVirPregled } from '@/lib/meritve-viri-pregled'
import {
  loadDrafts,
  saveDraft,
  removeDraft,
  makeDraftId,
  type MeasurementDraft,
} from '@/lib/measurement-drafts'
import { PhotoMeasure } from '@/components/roksal/photo-measure'
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
// R183 — živostna družina: refetch-on-focus + pečat 'Osveženo ob' (EN VIR
// casOznaka — komponenta NE formatiraj časa sama; vzorec R170-R182).
import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'
import { casOznaka } from '@/lib/osvezitev-fokus'
// R186 — izvoz VIDNIH meritev kot CSV (vzorec zaloga 'Izvozi vidno zalogo',
// čisto jedro meritve-csv = družina vodja-csv R157-R163).
import { meritveCsv, meritveCsvFilename } from '@/lib/meritve-csv'
import { buildMeritvePovzetek, meritvePovzetekBeseda } from '@/lib/meritve-povzetek'
import {
  meritevTerenPregled,
  osnutekBeseda,
} from '@/lib/meritve-teren-pdf'
import { downloadCsvText } from '@/lib/csv-export'
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
  CheckCircle2,
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
  // P3 — novi ikoni (stopnice, koti, štebricki, WPC; Gauge/Triangle/
  // Mountain/RefreshCw/CornerDownRight so se R338 dekompozicijo FAZE 3
  // preselile v measurements/labels)
  Layers2,
  Columns3,
  Fence,
  PencilRuler,
  Bookmark,
  ArrowRightLeft,
  // MERITVE-PRO — novi ikoni (AR sync, Foto mere; Bluetooth/Radio/Unplug
  // so se R325 dekompozicijo FAZE 2 preselile v measurements/laser-panel)
  Boxes,
  Image as ImageIcon,
  Link2,
  Loader2,
  UserRound,
  AlertTriangle,
  Info,
  Phone,
  CloudUpload,
  // R201 — iskren prazni stolpec (ni projektov)
  FolderX,
  // R269 — terenski pregled PDF (25. člen 'izvozi' družine)
  FileDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { slDatumKratko, slCasDolgo, slDatumOkrajsava, MESCI_SL } from '@/lib/csv-export'
// R319 — dekompozicija measurements-tab (faza 1): samostojne pod-komponente
// izluščene v ./measurements/ (čist premik — BREZ spremembe obnašanja).
import { CalibrationPhotoPicker } from './measurements/calibration-photo-picker'
import { InlineInclinometer } from './measurements/inline-inclinometer'
import { StairDiagram } from './measurements/stair-diagram'
import { InlineKotomer } from './measurements/inline-kotomer'
import { SteberTable } from './measurements/steber-table'
import { WpcDiagram } from './measurements/wpc-diagram'
// R319 — skupni tipi/konstante/čisti helper za measurements-tab + pod-komponente.
import {
  calcWpcPalice,
  materialStebraLabels,
  tipStebraLabels,
  type ArSyncMeta,
  type EnotaTip,
  type MaterialStebra,
  type Measurement,
  type MeasurementStatus,
  type Segment,
  type TipMeritve,
  type TipStebra,
} from './measurements/shared'
// R325 — dekompozicija measurements-tab FAZA 2: laserski BT blok (hook +
// UI + Web Bluetooth tipi/pomožne) in "template localStorage blok"
// (PREDLOGE + stopniške predloge + WPC konstante) izluščeni v
// ./measurements/ (kanon R319/R321 faza 1 — refaktor internih sestavljenih
// struktur, ne čist premik).
import { LaserPanel } from './measurements/laser-panel'
import { useLaserDistance } from './measurements/use-laser'
import {
  PREDLOGE,
  WPC_DEBELINA_DEFAULT,
  WPC_KOT_POSEVNIH_DEFAULT,
  WPC_RAZMAK_DEFAULT,
  WPC_SIRINE_PALIC,
  loadStairTemplates,
  saveStairTemplates,
  type StairCalc,
  type StairTemplate,
} from './measurements/templates'
// R340 — dekompozicija measurements-tab FAZA 4 (KOLIZIJA #14: vzporedna
// lastniška R339 vzela številko med mojim delom — delta prenesena na R340):
// normalizeMeasurements + getQuickSpacing (čisti funkciji) v
// ./measurements/normalize.ts in renderRailingDiagram (čista JSX funkcija)
// v ./measurements/railing-diagram.tsx (čist premik — BREZ spremembe
// obnašanja, vzorec R319/R325/R338).
import { getQuickSpacing, normalizeMeasurements } from './measurements/normalize'
// R348 — dekompozicija measurements-tab FAZA 5: EN VIR gradnja CSV izvozov
// (csvEsc/csvDokument/MERITVE_CSV_HEADER/zgradiMeritveVrstice — vzorec
// kalkulator FAZA 5–7; prenos ostane v tabu prek kanona downloadCsvText).
// R350 — FAZA 7 ostanki starejše družine: steber + zgodovina gradniki
// (STEBRI_CSV_HEADER/zgradiStebriVrstice + ZGODOVINA_CSV_HEADER/
// zgradiZgodovinaVrstice — VERBATIM iz taba; izvožene datoteke bajtno iste).
import {
  csvDokument,
  MERITVE_CSV_HEADER,
  STEBRI_CSV_HEADER,
  ZGODOVINA_CSV_HEADER,
  zgradiMeritveVrstice,
  zgradiStebriVrstice,
  zgradiZgodovinaVrstice,
} from './measurements/izvoz-csv'
// R350 — dekompozicija measurements-tab FAZA 7: seznam meritev PDF izvoz
// (85-vrstični inline jsPDF gradnik izluščen — vzorec FAZA 2/R325
// pdf-exports + r269 build/generate razcep; guard + toasti ostanejo v tabu).
import { exportSeznamPdf } from './measurements/pdf-seznam'
// R349 — dekompozicija measurements-tab FAZA 6: EN VIR fetch + fail-verbose
// DTO pruning terenskih izvozov (R269/R284/R285 — 3 stale telesa → 1
// gradnik z dialektnim stikalom zKotom; vzorec FAZA 5).
import { izvediTerenIzvoz } from './measurements/teren-izvozi'
import { renderRailingDiagram } from './measurements/railing-diagram'
// R356 — dekompozicija measurements-tab FAZA 9: EN VIR vnos meritve POST
// orkestracija (stopniščni čarovnik batch + WPC palice batch + ročni steber
// single — ISTI per-item tok POST → uspeh/osnutek R152; prej 9 podvojenih
// payload literalov + 9× gps literal; vzorec FAZA 5–8). Preslikava odgovora
// + osnutki + toasti ostanejo v tabu (UI resnica v UI — LEKCIJA R354).
import {
  posljiVnosMere,
  posljiRepostMere,
  teloRepostaIzMeritve,
  type RepostTelo,
} from './measurements/vnos-meritve'

// ============================================
// TIPI
// ============================================

// R338 — dekompozicija measurements-tab FAZA 3: zbirke oznak/barv/ikon
// (labels) + parse/format pomožne (format) izluščene v ./measurements/
// (čist premik — kanon R319 faza 1 / R325 faza 2).
import {
  auditActionLabels,
  auditActionTitles,
  auditColors,
  auditIcons,
  enotaLabels,
  groundTypeColors,
  groundTypeLabels,
  segmentTypeLabels,
  statusColors,
  statusCycle,
  statusLabels,
  syncStanjeColors,
  syncStanjeLabels,
  syncStanjeTitles,
  tipMeritveColors,
  tipMeritveIcons,
  tipMeritveLabels,
  tipMeritveTitles,
  type AuditEntry,
  type GroundType,
} from './measurements/labels'
import {
  calculateStairDimensions,
  convertToMm,
  formatAngleMulti,
  formatDimension,
  formatInPrimaryUnit,
  formatM2,
  formatMultiUnit,
  formatSlopeMulti,
  getNextStebriNumber,
  loadAudit,
  loadPrimaryUnit,
  parseGPS,
  type ArMetadata,
} from './measurements/format'
// R340 — osiroteli uvoz parseArMetadata odstranjen (edin uporabnik je bil
// normalizeMeasurements, zdaj v ./measurements/normalize.ts).

interface Project {
  id: string
  nazivProjekta: string
}

interface MeasurementGroup {
  label: string
  date: Date
  measurements: Measurement[]
}

interface CalibrationState {
  realMm: string
  pixelDistance: string
  pixelsPerMm: number | null
  note: string
}

type StatusFilter = 'VSE' | MeasurementStatus

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

interface MeasurementsTabProps {
  onNavigateToCalculator?: (dolzinaMm: number, visinaMm: number, locationName: string) => void
  /** Združi izbrnik projekta z glavno aplikacijo (runda H — QA popravek iz runde G) */
  selectedProjectId?: string | null
}

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export function MeasurementsTab({ onNavigateToCalculator, selectedProjectId }: MeasurementsTabProps) {
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<string>('')
  // R183 — pečat 'Osveženo ob' = čas zadnjega USPEŠNEGA branja meritev
  // (primarni vir te površine, vzorec R170-R182). Napaka/omrežje → null
  // (pečat brez podatkov bi lažno trdil svežino).
  const [meritveOsvezitev, setMeritveOsvezitev] = useState<Date | null>(null)
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

  // R153 (§19) — perzistenten status meritev (PATCH /api/measurements/[id]):
  // busy oznaka vrstice, dialog za ponovno odprtje arhiva (obvezna opomba)
  // in busy zastava množičnega arhiviranja.
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null)
  const [reopenTarget, setReopenTarget] = useState<{
    measurement: Measurement
    nextStatus: MeasurementStatus
  } | null>(null)
  const [reopenNote, setReopenNote] = useState('')
  const [reopenBusy, setReopenBusy] = useState(false)
  const [bulkArchiveBusy, setBulkArchiveBusy] = useState(false)
  // R269 — dvoklik guard za terenski pregled PDF (družinska pariteta R263–R268).
  const [pdfVteku, setPdfVteku] = useState(false)
  // R284 — dvoklik guard za terenski zapisni list PDF (pariteta R269 guard).
  const [zapisniVteku, setZapisniVteku] = useState(false)
  // R285 — CSV zapisni list v teku (dvoklik guard — pariteta R284 PDF gumba).
  const [zapisniCsvVteku, setZapisniCsvVteku] = useState(false)

  // R276 (issue #16 §6) — korekcija = NOVA verzija v verigi (predhodnik
  // ostane v zgodovini — nič tihega prepisovanja). popravljaMeritev drži
  // cilj korekcije; zgodovina drži odprto verigo verzij (lazy fetch).
  const [popravljaMeritev, setPopravljaMeritev] = useState<{
    id: string
    oznaka: string
    verzija: number | null
  } | null>(null)
  type VerzijaVrstica = {
    id: string
    verzija: number | null
    vir: string | null
    status: string
    dolzinaMm: number
    visinaMm: number
    predhodnikId: string | null
    createdAt: string
    deltaDolzinaMm: number | null
    deltaVisinaMm: number | null
  }
  type VerzijeOdgovor = {
    korenId: string | null
    aktivnaId: string | null
    aktivnaVerzija: number | null
    steviloVerzij: number
    verzije: VerzijaVrstica[]
  }
  const [zgodovina, setZgodovina] = useState<{
    odprtoZa: string | null
    nalaga: boolean
    napaka: string | null
    data: VerzijeOdgovor | null
  }>({ odprtoZa: null, nalaga: false, napaka: null, data: null })

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

  // ── Glasovni vnos meritev (sl-SI, Web Speech API) ─────────────────────
  // "dva metra štirideset" → 2400 mm. Klik na mikrofon zapene cilj
  // (dolžina/višina), prepis pa razčleni parseSlDimension.
  const [voiceTarget, setVoiceTarget] = useState<'length' | 'height'>('length')
  const voiceTargetRef = useRef<'length' | 'height'>('length')
  const fromMm = useCallback((mm: number, unit: EnotaTip) =>
    unit === 'm' ? String(+(mm / 1000).toFixed(2)) : unit === 'cm' ? String(+(mm / 10).toFixed(1)) : String(Math.round(mm)), [])
  const applyVoice = useCallback((transcript: string) => {
    const isLength = voiceTargetRef.current === 'length'
    const unit = isLength ? formLengthUnit : formHeightUnit
    const mm = parseSlDimension(transcript, unit)
    if (mm === null || mm <= 0) {
      toast.error(`Ni razumel: „${transcript}“`)
      return
    }
    const val = fromMm(mm, unit)
    try { navigator.vibrate?.([20, 30, 20]) } catch { /* ignore */ }
    if (isLength) {
      setFormLength(val)
      toast.success(`🎤 Dolžina: ${val} ${unit}`)
    } else {
      setFormHeight(val)
      toast.success(`🎤 Višina: ${val} ${unit}`)
    }
  }, [formLengthUnit, formHeightUnit, fromMm])
  const voice = useSpeechRecognition(applyVoice)
  const micFor = (target: 'length' | 'height') => {
    const active = voice.listening && voiceTarget === target
    return (
      <button
        type="button"
        onClick={() => {
          if (active) { voice.stop(); return }
          setVoiceTarget(target)
          voiceTargetRef.current = target
          voice.start()
        }}
        disabled={!voice.supported}
        aria-label={`Glasovni vnos ${target === 'length' ? 'dolžine' : 'višine'}`}
        title={voice.supported ? 'Glasovni vnos (slovenščina)' : 'Glasovni vnos ni podprt v tem brskalniku (Chrome/Edge)'}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border transition-colors ${
          active
            ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 animate-pulse'
            : 'border-border bg-background text-muted-foreground hover:bg-secondary'
        } ${voice.supported ? '' : 'opacity-40'}`}
      >
        <Mic aria-hidden="true" className="h-4 w-4" />
      </button>
    )
  }

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
  // MERITVE-PRO — stanje za nove funkcije
  // ============================================

  // 1. Web Bluetooth laser — R325 dekompozicija FAZA 2: stanje + GATT
  // povezava + odklop + auto-reconnect so izluščeni v useLaserDistance
  // hook (VERBATIM); forma se polni prek onMeasurement povratnega klica
  // (prej: neposredni setFormLength/setFormLengthUnit/setFormTipMeritve/
  // setFormOpen znotraj handleLaserMeasurement).
  const {
    laserSupported,
    laserStatus,
    laserDeviceName,
    laserLastReading,
    connectLaser,
    disconnectLaser,
  } = useLaserDistance(
    useCallback(
      (mm: number) => {
        // Auto-izpolni dolžino v formi (v mm enoti)
        setFormLength(String(mm))
        setFormLengthUnit('mm')
        setFormTipMeritve('RAZDALJA')
        if (!formOpen) setFormOpen(true)
      },
      [formOpen]
    )
  )

  // 2. AR sync (prenašanje točk iz AR posnetka v mere)
  const [arImportOpen, setArImportOpen] = useState(false)
  const [arSnapshots, setArSnapshots] = useState<Array<{
    id: string
    imageUrl: string
    tocke: string
    kalibracija: string | null
    opombe: string | null
    createdAt: string
    profil?: { naziv: string } | null
  }>>([])
  const [arImportLoading, setArImportLoading] = useState(false)
  const [arImportProgress, setArImportProgress] = useState<{ current: number; total: number } | null>(null)
  const [arSelectedSnapshotId, setArSelectedSnapshotId] = useState<string | null>(null)

  // 3. Foto mere povezava nazaj
  const [fotoFilterActive, setFotoFilterActive] = useState(false)
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false)
  const [photoViewerUrl, setPhotoViewerUrl] = useState<string | null>(null)
  const [photoViewerId, setPhotoViewerId] = useState<string | null>(null)
  const [photoViewerLoading, setPhotoViewerLoading] = useState(false)
  const [photoViewerNotFound, setPhotoViewerNotFound] = useState(false)

  // ============================================
  // NALAGANJE PODATKOV
  // ============================================

  // Ref drži zadnjo vrednost propsa za bootstrap brez stale-closure / lint težav
  const selectedProjectIdRef = useRef(selectedProjectId)
  selectedProjectIdRef.current = selectedProjectId

  // R183 — stabilen fail-verbose loader (EN VIR — mount + fokus; vzorec R176
  // dokumenti). Ob osvežitvi ob fokusu NE resetiramo izbire projekta —
  // meritve osvežimo za TRENUTNO izbrani projekt; auto-izbira (sledi glavni
  // app, sicer prvi) SAMO ko izbire še ni — meritve za sveže izbrani projekt
  // naloži obstoječi selectedProject efekt (BREZ dvojnega fetcha — prej sta
  // mount efekt IN selectedProject efekt oba pobrala meritve prvega projekta).
  const selectedProjectRef = useRef(selectedProject)
  useEffect(() => {
    selectedProjectRef.current = selectedProject
  }, [selectedProject])

  const loadAll = useCallback(async () => {
    try {
      const projRes = await fetch('/api/projects')
      if (!projRes.ok) {
        // R152 fail-closed: ni izmišljenih projektov/meritev — napaka je vidna.
        setMeasurements([])
        setProjects([])
        setMeritveOsvezitev(null)
        toast.error(`Projektov ni bilo mogoče naložiti (napaka ${projRes.status})`)
        return
      }
      const projData = await projRes.json()
      setProjects(projData)
      if (projData.length === 0) {
        setMeasurements([])
        setMeritveOsvezitev(null)
        return
      }
      if (!selectedProjectRef.current) {
        // Sinhronizirano z glavno aplikacijo: če je v glavni app izbran
        // projekt, uporabi tega, sicer prvi (prej je ta izbrnik vedno
        // ignoriral izbiro glavne app — bug odkrit v rundi G)
        const wanted = selectedProjectIdRef.current
        const firstProjectId =
          wanted && projData.some((p: { id: string }) => p.id === wanted)
            ? wanted
            : projData[0].id
        setSelectedProject(firstProjectId)
        return
      }
      // Fokus/osvežitev: meritve za TRENUTNO izbrani projekt (izbira ostane).
      const measRes = await fetch(`/api/measurements?projectId=${selectedProjectRef.current}`)
      if (measRes.ok) {
        const measData = await measRes.json()
        // R152: prazen projekt ostane PRAZEN — ni izmišljenih meritev.
        setMeasurements(normalizeMeasurements(measData))
        setMeritveOsvezitev(new Date())
      } else {
        // R152 fail-closed: napaka API-ja je vidna, nič demo meritev.
        setMeasurements([])
        setMeritveOsvezitev(null)
        toast.error(`Meritev ni bilo mogoče naložiti (napaka ${measRes.status})`)
      }
    } catch {
      setMeasurements([])
      setProjects([])
      setMeritveOsvezitev(null)
      toast.error('Meritev ni bilo mogoče naložiti — preverite povezavo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  // R183 — vrnitev v zavihek/okno → ponovno naloži projekte + meritve
  // izbranega projekta (pisarna dodaja meritve v drugi seji; terenski seznam
  // ostane zastarel do remonta). loadAll je fail-verbose — hook ne požira napak.
  useRefetchOnFocus(loadAll)

  // Sinhronizacija iz glavne aplikacije: uporabnik zamenja projekt v headeru
  // → Meritve izbrnik sledi (in re-fetch useEffect zgoraj pritegne meritve)
  useEffect(() => {
    if (loading) return
    if (selectedProjectId && selectedProjectId !== selectedProject) {
      setSelectedProject(selectedProjectId)
    }
  }, [selectedProjectId, loading])

  // Re-fetch pri spremembi projekta
  useEffect(() => {
    if (!selectedProject || loading) return
    async function fetchMeasurements() {
      try {
        const measRes = await fetch(`/api/measurements?projectId=${selectedProject}`)
        if (measRes.ok) {
          const measData = await measRes.json()
          // R152: prazen projekt ostane PRAZEN — ni izmišljenih meritev.
          setMeasurements(normalizeMeasurements(measData))
          // R183 — pečat v OBEH uspešnih vejah (vzorec R177 dokumenti).
          setMeritveOsvezitev(new Date())
        } else {
          setMeasurements([])
          setMeritveOsvezitev(null)
          toast.error(`Meritev ni bilo mogoče osvežiti (napaka ${measRes.status})`)
        }
      } catch {
        setMeasurements([])
        setMeritveOsvezitev(null)
        toast.error('Meritev ni bilo mogoče osvežiti — preverite povezavo.')
      }
    }
    fetchMeasurements()
  }, [selectedProject, loading])

  // ============================================
  // R152 — ISKRENI LOKALNI OSNUTKI (fail-closed offline)
  // ============================================
  // Meritev, ki je POST na strežnik NI uspel, NE izgine in NE laže, da je
  // shranjena: gre v ekspliciten osnutek (localStorage, per projekt), ki je
  // vedno vidno označen in ročno sinhroniziran. Nič izmišljenih vrstic,
  // nič tihega izgubljanja.

  const [drafts, setDrafts] = useState<MeasurementDraft[]>([])
  const [draftsOpen, setDraftsOpen] = useState(true)
  const [syncingDrafts, setSyncingDrafts] = useState(false)

  // Naloži osnutke ob spremembi projekta (localStorage → stanje)
  useEffect(() => {
    if (!selectedProject) {
      setDrafts([])
      return
    }
    try {
      const { drafts: loaded, skipped } = loadDrafts(selectedProject)
      setDrafts(loaded)
      if (skipped > 0) {
        toast.warning(
          `${skipped} osnutek(ov) s pokvarjenim zapisom je preskočenih — ostali so ohranjeni.`
        )
      }
    } catch {
      setDrafts([])
      toast.error('Lokalnih osnutkov ni bilo mogoče prebrati (shramba ni dostopna).')
    }
  }, [selectedProject])

  /** Ustvari ekspliciten osnutek iz NEUSPELEGA POST tela. Iskren toast. */
  function createMeasurementDraft(payload: Record<string, unknown>, label: string) {
    const draft: MeasurementDraft = {
      draftId: makeDraftId(),
      createdAt: new Date().toISOString(),
      label,
      payload,
    }
    try {
      saveDraft(selectedProject, draft)
      setDrafts((prev) => [draft, ...prev])
      toast.warning(
        `„${label}" NI shranjena v bazo (strežnik ni dosegljiv) — shranjena kot lokalni osnutek. Sinhronizirajte jo v razdelku osnutkov.`,
        { duration: 8000 }
      )
      pushAudit({
        akcija: 'ADD',
        meritevId: draft.draftId,
        opis: `Lokalni osnutek „${label}" ustvarjen (ni sinhroniziran)`,
      })
    } catch {
      toast.error(
        `„${label}" NI shranjena — niti v bazo niti lokalno (napaka shrambe). Vpišite jo znova.`,
        { duration: 10000 }
      )
    }
  }

  /** Odstrani osnutek brez sinhronizacije (uporabnikova odločitev). */
  function discardMeasurementDraft(draftId: string) {
    try {
      const next = removeDraft(selectedProject, draftId)
      setDrafts(next)
      toast.info('Osnutek odstranjen (ni bil nikoli v bazi).')
    } catch {
      toast.error('Osnutka ni bilo mogoče odstraniti (shramba ni dostopna).')
    }
  }

  /** Poskusi sinhronizirati enega osnutek. Vrne true ob uspehu.
   *  R358 FAZA 11: repost prek gradnika posljiRepostMere — telo = shranjen
   *  draft.payload VERBATIM (kontrakt R152: "Točno telo, ki ga je treba
   *  ponovno POSTati"; korekcijski osnutek nosi predhodnikId — R276). Osnutek
   *  že OBSTAJA — neuspeh NE ustvari novega (vrne false; R152 ni fake-success,
   *  toast/konteksta ostanejeta pri klicatelju). */
  async function syncSingleDraft(draft: MeasurementDraft): Promise<boolean> {
    const rezultat = await posljiRepostMere(draft.payload as RepostTelo)
    if (rezultat.izid !== 'uspeh') return false
    const data = rezultat.podatki
    setMeasurements((prev) => [normalizeMeasurements([data])[0], ...prev])
    const next = removeDraft(selectedProject, draft.draftId)
    setDrafts(next)
    pushAudit({
      akcija: 'ADD',
      meritevId: data.id,
      opis: `Osnutek „${draft.label}" sinhroniziran v bazo`,
    })
    return true
  }

  /** Sinhroniziraj vse osnutke (zaporedno, determinističen vrstni red). */
  async function syncAllDrafts() {
    if (syncingDrafts || drafts.length === 0) return
    setSyncingDrafts(true)
    let ok = 0
    let fail = 0
    for (const draft of [...drafts].sort((a, b) => (a.createdAt > b.createdAt ? 1 : a.createdAt < b.createdAt ? -1 : 0))) {
      const success = await syncSingleDraft(draft)
      if (success) ok += 1
      else fail += 1
    }
    setSyncingDrafts(false)
    if (ok > 0 && fail === 0) {
      toast.success(`Sinhroniziranih ${ok} osnutek(ov) v bazo.`)
    } else if (ok > 0 && fail > 0) {
      toast.warning(`Sinhroniziranih ${ok}, NEUSPEŠNIH ${fail} — ostajajo kot osnutki.`)
    } else {
      toast.error(`Sinhronizacija ni uspela (vseh ${fail}) — preverite povezavo in poskusite znova.`)
    }
  }

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
  // R340 — dekompozicija FAZA 4: normalizeMeasurements izluščena VERBATIM
  // v measurements/normalize.ts (čist premik; spoj arMetadata fallback po
  // poljih ostaja identičen).

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

  // R276 (O4/O8) — začetek korekcije: obrazec se vnaprej izpolni z vrednostmi
  // predhodnika (enote mm — brez pretvorbe, nič ugibanja); shranjevanje
  // ustvari NOVO verzijo (predhodnikId v POST telesu).
  function handleStartCorrection(m: Measurement) {
    if (m.status === 'ARHIVIRANA') {
      toast.error(
        'Arhivirane meritve ni mogoče popraviti — najprej jo ponovno odprite (klik na status z opombo).'
      )
      return
    }
    setPopravljaMeritev({
      id: m.id,
      oznaka: m.oznaka || m.lokacija || `#${m.id.slice(-4)}`,
      verzija: m.verzija ?? null,
    })
    setFormLengthUnit('mm')
    setFormHeightUnit('mm')
    setFormLength(String(m.dolzinaMm))
    setFormHeight(String(m.visinaMm))
    setFormOznaka(m.oznaka || '')
    setFormLocation(m.lokacija || '')
    setFormOpen(true)
    toast.info(
      `Popravljanje „${m.oznaka || m.lokacija || `#${m.id.slice(-4)}`}“ — shranjevanje ustvari NOVO verzijo; obstoječa ostane v zgodovini.`
    )
  }

  function handleCancelCorrection() {
    setPopravljaMeritev(null)
    resetForm()
    toast.info('Korekcija preklicana — nič ni bilo shranjeno.')
  }

  // R276 (O8) — zgodovina verzij: lazy fetch celotne verige (GET
  // /api/measurements/[id]/verzije). Napaka = viden razlog, nič lažnih
  // praznih tabel.
  async function toggleZgodovina(m: Measurement) {
    if (zgodovina.odprtoZa === m.id) {
      setZgodovina({ odprtoZa: null, nalaga: false, napaka: null, data: null })
      return
    }
    setZgodovina({ odprtoZa: m.id, nalaga: true, napaka: null, data: null })
    try {
      const res = await fetch(`/api/measurements/${m.id}/verzije`)
      if (!res.ok) {
        const telo = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(telo?.error ?? `Strežnik je vrnil ${res.status}`)
      }
      const data = (await res.json()) as VerzijeOdgovor
      if (!Array.isArray(data.verzije) || typeof data.steviloVerzij !== 'number') {
        throw new Error('Odgovora verzij ni mogoče prebrati (pokvarena oblika)')
      }
      setZgodovina({ odprtoZa: m.id, nalaga: false, napaka: null, data })
    } catch (napaka) {
      setZgodovina({
        odprtoZa: m.id,
        nalaga: false,
        napaka: napaka instanceof Error ? napaka.message : 'Napaka pri branju zgodovine',
        data: null,
      })
    }
  }

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
      // R276 (O4/O8) — korekcija: predhodnikId v telesu → strežnik ustvari
      // NOVO verzijo v verigi (fail-closed meje na strežniku; vir je
      // strežniško izpeljan — klient ga ne pošilja).
      // R357 FAZA 10 — EN VIR vnos meritve POST orkestracija (vzorec FAZA
      // 5–9): telo + POST + osnutek-ne-ok + osnutek-napaka zdaj v
      // measurements/vnos-meritve (predhodnikId nosi gradnik v VSEH vejah —
      // R357 popravek: stale catch-veja je telo rekonstruirala BREZ
      // predhodnikId, kar je kršilo kontrakt R276 »osnutek korekcije NOSI
      // predhodnikId«); preslikava odgovora + audit + toasti ostanejo tu.
      const rezultat = await posljiVnosMere({
        projectId: selectedProject,
        dolzinaMm,
        visinaMm,
        arMetadata,
        ...(popravljaMeritev ? { predhodnikId: popravljaMeritev.id } : {}),
      })
      if (rezultat.izid === 'uspeh') {
        const data = rezultat.podatki
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
          opis: popravljaMeritev
            ? `Nova verzija v${newMeasurement.verzija ?? '?'} meritve „${popravljaMeritev.oznaka}" — ${formatMultiUnit(dolzinaMm)} (predhodna ostaja v zgodovini)`
            : `Nova meritev \"${formOznaka || formLocation || newMeasurement.id.slice(-4)}\" dodana — ${formatMultiUnit(dolzinaMm)}`,
        })
        resetForm()
        setFormOpen(false)
        // R276 (O3) — korekcija: iskren toast z verzijo; predhodnik ostane.
        if (popravljaMeritev) {
          setPopravljaMeritev(null)
          toast.success(
            `Nova verzija v${newMeasurement.verzija ?? '?'} shranjena — predhodna meritev ostaja v zgodovini.`
          )
        } else {
          toast.success('Meritev dodana!')
        }
      } else {
        // R152: neuspeh → ekspliciten lokalni osnutek (ni izmišljene vrstice,
        // ni lažnega "uspešno shranjeno"). R276 + R357: osnutek korekcije
        // NOSI predhodnikId v OBEH neuspešnih vejah (ne-ok IN omrežna napaka
        // — sinhronizacija ustvari verzijo, ne nove standalone).
        createMeasurementDraft(
          rezultat.telo,
          formOznaka || formLocation || formatMultiUnit(dolzinaMm)
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  // R152: saveLocalMeasurement IZBRISAN — izmišljena lokalna vrstica z
  // fake-success toastom je kršila fail-closed pravila. Namesto nje:
  // createMeasurementDraft() (ekspliciten osnutek z vidnim badgeom in
  // sinhronizacijo).
  function handleDeleteMeasurement(id: string) {
    const m = measurements.find((x) => x.id === id)
    if (m) {
      // R152: API /api/measurements nima DELETE — ni lažnega brisanja
      // (prej: izbris iz lokalnega stanja + toast.success, po reloadu
      // je meritev prišla nazaj).
      toast.error(
        'Brisanje meritev ni na voljo — meritve so revizijski podatki. Neuporabne meritve označite z opombo ali jih prijavite vodji.'
      )
      return
    }
    toast.error('Meritve ni bilo mogoče najti (morda je že bila odstranjena).')
  }

  // R152: podvajanje POSKUSI resnični POST; ob neuspehu → ekspliciten
  // osnutek (prej: izmišljena lokalna vrstica, izgubljena ob reloadu).
  // R358 FAZA 11: telo gradi EN builder teloRepostaIzMeritve (ist kot
  // kopiranje v segment — bajtno isti vrstni red 5 ključev; izvirna GPS
  // točka ostane, NIČ vsiljene terenske točke), per-item tok v
  // posljiRepostMere; preslikava + audit + toast ostanejo tu (UI resnica
  // v UI — LEKCIJA R354); ne-ok ALI omrežna napaka = osnutek z ISTIM telesom.
  async function handleDuplicateMeasurement(m: Measurement) {
    const label = `${m.oznaka || m.lokacija || 'meritev'} (kopija)`
    const payload = teloRepostaIzMeritve(m, selectedProject)
    const rezultat = await posljiRepostMere(payload)
    if (rezultat.izid === 'uspeh') {
      const data = rezultat.podatki
      const duplicate: Measurement = {
        ...data,
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
      return
    }
    createMeasurementDraft(payload, label)
  }

  // R153 (§19) — cikliranje statusa meritve je zdaj PERZISTENTNO
  // (PATCH /api/measurements/[id] z revizijsko sledjo MEASUREMENT_STATUS).
  // Prej: sprememba samo lokalna (po reloadu izginila) → R152 iskren
  // toast.error workaround — zdaj prava funkcionalnost.
  // Fail-closed: neuspeh → status ostane nespremenjen + viden razlog;
  // ponovno odprtje arhiva (ARHIVIRANA → OSNUTEK) zahteva opombo → dialog.
  async function patchMeasurementStatus(
    m: Measurement,
    nextStatus: MeasurementStatus,
    note?: string
  ): Promise<boolean> {
    const currentStatus: MeasurementStatus = m.status || 'OSNUTEK'
    setStatusBusyId(m.id)
    try {
      const res = await fetch(`/api/measurements/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, ...(note ? { note } : {}) }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        toast.error(data?.error || `Sprememba statusa ni uspela (napaka ${res.status})`)
        return false
      }
      const data = (await res.json()) as { changed: boolean; measurement: Measurement }
      setMeasurements((prev) =>
        prev.map((x) =>
          x.id === m.id ? normalizeMeasurements([data.measurement])[0] : x
        )
      )
      if (data.changed) {
        const label = m.oznaka || m.lokacija || `#${m.id.slice(-4)}`
        pushAudit({
          akcija: 'STATUS',
          meritevId: m.id,
          opis: `Status meritve „${label}“: ${statusLabels[currentStatus]} → ${statusLabels[nextStatus]}`,
          staraVrednost: statusLabels[currentStatus],
          novaVrednost: statusLabels[nextStatus],
        })
        toast.success(`Status: ${statusLabels[currentStatus]} → ${statusLabels[nextStatus]}`)
      }
      return true
    } catch {
      toast.error('Sprememba statusa ni uspela — preverite povezavo. Status ostaja nespremenjen.')
      return false
    } finally {
      setStatusBusyId(null)
    }
  }

  async function handleStatusCycle(m: Measurement) {
    const currentStatus: MeasurementStatus = m.status || 'OSNUTEK'
    const nextStatus = statusCycle[currentStatus]
    if (currentStatus === 'ARHIVIRANA') {
      // R153 fail-closed: ponovno odprtje arhiva zahteva razlog (opomba ≥ 3
      // znaki — arhivirane meritve so izključene iz aktivnih pregledov).
      setReopenNote('')
      setReopenTarget({ measurement: m, nextStatus })
      return
    }
    await patchMeasurementStatus(m, nextStatus)
  }

  async function handleReopenConfirm() {
    if (!reopenTarget) return
    const reason = reopenNote.trim()
    if (reason.length < 3) {
      toast.error(
        'Razlog je obvezen (vsaj 3 znaki) — arhivirana meritev se ne odpre brez utemeljitve.'
      )
      return
    }
    const { measurement, nextStatus } = reopenTarget
    setReopenBusy(true)
    const ok = await patchMeasurementStatus(measurement, nextStatus, reason)
    setReopenBusy(false)
    if (ok) {
      setReopenTarget(null)
      setReopenNote('')
    }
  }

  // Hitri izračun razmikov — R340 dekompozicija FAZA 4: getQuickSpacing
  // izluščen VERBATIM v measurements/normalize.ts (čist premik; rabi ga
  // railing-diagram.tsx in predogled obrazca spodaj).

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

  // P1 — števci statusov (R154: čisto jedro lib/measurement-status — ista
  // logika v UI, PDF izvozu in testih; brez statusa = OSNUTEK, iskren
  // privzetek migracijskega backfilla R153)
  const statusCounts = useMemo(() => measurementStatusCounts(measurements), [measurements])

  // P1 — filtrirane meritve glede na status filter
  const filteredMeasurements = useMemo(() => {
    let list = measurements
    if (statusFilter !== 'VSE') {
      list = list.filter((m) => (m.status || 'OSNUTEK') === statusFilter)
    }
    // MERITVE-PRO — Foto mere filter (dodatno nad status filtrom)
    if (fotoFilterActive) {
      list = list.filter((m) => m.source === 'photo')
    }
    return list
  }, [measurements, statusFilter, fotoFilterActive])

  // MERITVE-PRO — število foto mer (za filter pill badge)
  const fotoMeasurementsCount = useMemo(
    () => measurements.filter((m) => m.source === 'photo').length,
    [measurements]
  )

  // R269 — F2 mini-vrstica 'Meritve (viden seznam):' — ENA izpeljava
  // meritevTerenPregled čez ISTI prune kot PDF KPI + sklep + toast (WYSIWYG):
  // state (viden seznam po status/foto filtrih) = kar uporabnik vidi; FRESH
  // ob kliku = polna resnica projekta (dve okni, ENA matemtika). Brez
  // try/catch — pokvaren vir bi poklical isti throw kot statusni filter
  // (EN vir napak; DB status je strežniško čist — R153).
  const terenPovzetek = useMemo(() => {
    if (!selectedProject || filteredMeasurements.length === 0) return null
    return meritevTerenPregled(
      filteredMeasurements.map((m) => ({
        id: m.id,
        createdAt: m.createdAt,
        dolzinaMm: m.dolzinaMm,
        visinaMm: m.visinaMm,
        tipMeritve: m.tipMeritve ?? null,
        oznaka: m.oznaka ?? null,
        status: m.status ?? null,
        lokacija: m.lokacija ?? null,
        opomba: m.opomba ?? null,
      })),
    ).povzetek
  }, [filteredMeasurements, selectedProject])

  // R282 (issue #16 §10) — F2 sync mini-vrstica: števec sync metadata
  // (V3 — opazovano stanje klienta) čez ISTI vidni seznam (EN VIR
  // filteredMeasurements). Null = nobena vidna vrstica NE nosi sync
  // metadata → vrstica se NE rendera (iskrena praznina — nikoli izumljen
  // števec 'brez sync'); neznano syncState se NE šteje (fail-closed).
  const syncPregled = useMemo(() => {
    const vrstice = filteredMeasurements.filter((m) => m.sync?.syncState != null)
    if (vrstice.length === 0) return null
    const n = (s: NonNullable<ArSyncMeta['syncState']>) =>
      vrstice.filter((m) => m.sync?.syncState === s).length
    return {
      sinhroniziranih: n('synced'),
      cakajocih: n('pending'),
      konfliktov: n('conflict'),
      napak: n('error'),
      grobnic: vrstice.filter((m) => m.sync?.tombstone === true).length,
    }
  }, [filteredMeasurements])

  // R283 (issue #15 §3) — F3 vir pokritost mini: števec strežniško
  // izpeljanih virov čez ISTI vidni seznam (EN VIR filteredMeasurements;
  // zaprta množica = AR_SESSION_SOURCES). Null = nobena vidna vrstica NE
  // nosi prepoznanega viroma → vrstica se NE rendera (iskrena praznina —
  // nikoli izumljen števec); neznani vir se NE šteje (fail-closed —
  // syncPregled kanon R282).
  const virPregled = useMemo(
    () => izracunajMeritveVirPregled(filteredMeasurements),
    [filteredMeasurements],
  )

  // R186 — izvoz VIDNIH meritev (upošteva status + foto filter) kot CSV.
  // Fail-closed: prazen seznam → viden toast (nič praznih datotek);
  // pokvaren vnos → viden toast z razlogom (fail-verbose — nič tihega izvoza
  // polpdatkov). Jedro meritve-csv je deterministično (družina vodja-csv).
  function izvoziMeritveCsv() {
    if (filteredMeasurements.length === 0) {
      toast.error('Ni meritev za izvoz.')
      return
    }
    try {
      const { csv } = meritveCsv(filteredMeasurements)
      downloadCsvText(meritveCsvFilename(new Date().toISOString().slice(0, 10)), csv)
      toast.success(`Izvoženih ${filteredMeasurements.length} meritev v CSV.`)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `Izvoza ni bilo mogoče ustvariti: ${error.message}`
          : 'Izvoza ni bilo mogoče ustvariti.',
      )
    }
  }

  // R203 — povzetek VIDNIH meritev v odložišče (delitev SMS/WhatsApp; vzorec
  // kopiraj termina R167). Fail-verbose: napaka odložišča je viden toast;
  // pokvaren vnos (fail-closed jedro) → viden toast z razlogom.
  const kopirajMeritvePovzetek = useCallback(async () => {
    if (filteredMeasurements.length === 0) {
      toast.error('Ni meritev za kopiranje.')
      return
    }
    // Ime projekta = točno to, kar pokaže izbirnik; brez izbire → null
    // (jedro pošteno pokaže 'Brez imena projekta' — brez izmišljenih imen).
    const projektIme = projects.find((p) => p.id === selectedProject)?.nazivProjekta || null
    try {
      const besedilo = buildMeritvePovzetek(filteredMeasurements, {
        projektIme,
        now: new Date(),
      })
      await navigator.clipboard.writeText(besedilo)
      toast.success('Povzetek meritev kopiran v odložišče', {
        description: `${filteredMeasurements.length} ${meritvePovzetekBeseda(filteredMeasurements.length)} — prilepi v SMS/WhatsApp.`,
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        toast.error('Brskalnik je zavrnil dostop do odložišča (dovoljenje).')
      } else {
        toast.error(
          err instanceof Error
            ? `Kopiranje ni uspelo: ${err.message}`
            : 'Kopiranje ni uspelo.',
        )
      }
    }
  }, [filteredMeasurements, projects, selectedProject])

  // R269 — MERITVE — TERENSKI PREGLED PDF (25. člen 'izvozi' družine): FRESH
  // fetch + fail-verbose DTO pruning od R349 FAZA 6 EN VIR
  // fetchMeritveTerenVnosi(selectedProject, { zKotom: false }) — polna
  // resnica projekta, ne filtrirani state (R244–R268 precedens; dialekt
  // brez kotStopinje — bajtni kontrakt lista). PRAZEN seznam → iskren toast
  // (NIČ prazne datoteke); ENA izpeljava povzetka = ISTA resnica kot KPI +
  // sklep + mini-vrstica (WYSIWYG).
  const handleTerenPdf = async () => {
    if (pdfVteku) return
    if (!selectedProject) {
      toast.error('Ni izbranega projekta', {
        description: 'Terenski pregled je projekt-obračunski — najprej izberite projekt.',
      })
      return
    }
    setPdfVteku(true)
    try {
      // R354 FAZA 8: orkestracija (fetch FAZA 6 EN VIR + prazno guard +
      // gradnja + fail-verbose) v ./measurements/teren-izvozi — rezultat je
      // diskriminiran, toast besedila ostanejo VERBATIM tu (UI resnica).
      const r = await izvediTerenIzvoz('teren-pdf', {
        selectedProject,
        // Ime projekta = točno to, kar pokaže izbirnik; brez izbire → null
        // (jedro pošteno pokaže 'Brez imena projekta' — brez izmišljenih imen).
        projektIme: projects.find((p) => p.id === selectedProject)?.nazivProjekta || null,
        zdaj: new Date(),
      })
      if (r.izid === 'prazno') {
        // Fail-closed jedro: prazen seznam ne nastaja dokumenta — iskren toast.
        toast.error('Ni vpisanih meritev', {
          description: 'Terenski pregled se izvozi, ko je vpisana prva meritev projekta.',
        })
        return
      }
      if (r.izid === 'napaka') {
        // Fail-verbose: izvoz ne sme tiho spodleteti — razlog gre v toast.
        toast.error('Izvoz ni uspel', { description: r.sporocilo })
        return
      }
      if (r.izid === 'uspeh-pdf') {
        toast.success('Terenski pregled meritev prenešen v PDF', {
          description: `Meritve-teren-…pdf — ${r.povzetek.meritev} ${meritvePovzetekBeseda(r.povzetek.meritev)}, osnutki ${r.povzetek.osnutkov}, potrjenih ${r.povzetek.potrjenih}, arhiviranih ${r.povzetek.arhiviranih}.`,
        })
      }
    } finally {
      setPdfVteku(false)
    }
  }

  // R284 — TERENSKI ZAPISNI LIST PDF (issue #15 §3, worklog i5): FRESH
  // fetch + fail-verbose DTO pruning od R349 FAZA 6 EN VIR
  // fetchMeritveTerenVnosi(selectedProject, { zKotom: true }) — skupno
  // resnico nosi EN VIR modul (prej namerna duplikacija pruningu, da R269
  // handler NIKOLI ne tvega regresije bajtnega kontrakta — zdaj dialektni
  // stikalo zKotom nosi OBA kontrakta EKSPLICITNO, nič tihega). Zapisni
  // list = IZPOLNJEVALNI list (X1): zapisana resnica + PRAZNI fizični
  // stolpci (Fizična ref./Δ/Zapiski) — izpolni jih lastnik na terenu po
  // docs/AR-FIELD-VALIDATION.md §3. PRAZEN seznam → iskren toast; ENA
  // izpeljava povzetka = ISTA resnica kot KPI + sklep (WYSIWYG).
  const handleZapisniListPdf = async () => {
    if (zapisniVteku) return
    if (!selectedProject) {
      toast.error('Ni izbranega projekta', {
        description: 'Terenski zapisni list je projekt-obračunski — najprej izberite projekt.',
      })
      return
    }
    setZapisniVteku(true)
    try {
      // R354 FAZA 8: orkestracija v ./measurements/teren-izvozi (zKotom: true
      // — izpolnjevalni list nosi tudi kot; rezultat diskriminiran).
      const r = await izvediTerenIzvoz('zapisni-pdf', {
        selectedProject,
        projektIme: projects.find((p) => p.id === selectedProject)?.nazivProjekta || null,
        zdaj: new Date(),
      })
      if (r.izid === 'prazno') {
        toast.error('Ni vpisanih meritev', {
          description: 'Terenski zapisni list se izvozi, ko je vpisana prva meritev projekta.',
        })
        return
      }
      if (r.izid === 'napaka') {
        toast.error('Izvoz ni uspel', { description: r.sporocilo })
        return
      }
      if (r.izid === 'uspeh-pdf') {
        toast.success('Zapisni list prenešen v PDF', {
          description: `Terenski-zapisni-…pdf — ${r.povzetek.meritev} ${meritvePovzetekBeseda(r.povzetek.meritev)}; fizični stolpci (ref./Δ/zapiski) ostajajo prazni — izpolni jih na terenu (issue #15 §3).`,
        })
      }
    } finally {
      setZapisniVteku(false)
    }
  }

  // R285 — TERENSKI ZAPISNI LIST CSV (issue #15 §3, worklog i5b): FRESH
  // fetch + fail-verbose DTO pruning od R349 FAZA 6 EN VIR
  // fetchMeritveTerenVnosi — ISTI modul kot R284/R269
  // (prej namerna duplikacija — izolacija družine; stale telesi R284 ≡
  // R285 bajtno identična → zdaj 1 gradnik v ./measurements/teren-vnosi).
  // CSV = DIGITALNO izpolnjevanje v Excelu (Y1): ista zapisana resnica +
  // PRAZNI fizični stolpci (fizicna_ref_mm / delta_mm / zapiski_terena) —
  // izpolni jih lastnik v Excelu. PRAZEN seznam → iskren toast (nič praznih
  // datotek); pariteta stolpcev z R186 arhivom po konstrukciji (Y2 — EN VIR
  // meritevVrstica).
  const handleZapisniListCsv = async () => {
    if (zapisniCsvVteku) return
    if (!selectedProject) {
      toast.error('Ni izbranega projekta', {
        description: 'Terenski zapisni list (CSV) je projekt-obračunski — najprej izberite projekt.',
      })
      return
    }
    setZapisniCsvVteku(true)
    try {
      // R354 FAZA 8: orkestracija v ./measurements/teren-izvozi; lib vrne
      // {csv, imeDatoteke, vrstic} — prenos ostane v tabu prek kanona
      // downloadCsvText (brskalniški kanon, vzorec kalkulator FAZA 5–7).
      const r = await izvediTerenIzvoz('zapisni-csv', {
        selectedProject,
        projektIme: projects.find((p) => p.id === selectedProject)?.nazivProjekta || null,
        zdaj: new Date(),
      })
      if (r.izid === 'prazno') {
        // Fail-closed jedro: prazen seznam ne nastaja datoteke — iskren toast.
        toast.error('Ni vpisanih meritev', {
          description: 'Terenski zapisni list (CSV) se izvozi, ko je vpisana prva meritev projekta.',
        })
        return
      }
      if (r.izid === 'napaka') {
        toast.error('Izvoz ni uspel', { description: r.sporocilo })
        return
      }
      if (r.izid === 'uspeh-csv') {
        downloadCsvText(r.imeDatoteke, r.csv)
        toast.success('Zapisni list prenešen v CSV', {
          description: `Terenski-zapisni-…csv — ${r.vrstic - 1} vrstic; stolpci fizicna_ref_mm/delta_mm/zapiski_terena ostajajo PRAZNI — izpolni jih v Excelu (issue #15 §3).`,
        })
      }
    } finally {
      setZapisniCsvVteku(false)
    }
  }

  // ── Primerjava "Stranka vs merilec" ───────────────────────────────────────
  // Stranka je prek javne povezave /m/[token] narisala svojo ograjo na karti
  // (source='customer-map'). Vodja na enem mestu vidi razliko do uradnih meritev
  // — pomaga pri pripravi ponudbe še pred obiskom na terenu (model ProFence).
  const strankaPrimerjava = useMemo(() => {
    const customerMap = measurements.filter((m) => m.source === 'customer-map')
    if (customerMap.length === 0) return null
    const merilec = measurements.filter((m) => m.source !== 'customer-map')

    const strankaSkupajMm = customerMap.reduce((s, m) => s + (m.dolzinaMm || 0), 0)
    const merilecSkupajMm = merilec.reduce((s, m) => s + (m.dolzinaMm || 0), 0)

    let meta: {
      imeStranke?: string
      telefonStranke?: string
      opombaStranke?: string
      tocke?: number
    } = {}
    try {
      meta = JSON.parse(customerMap[0].arMetadata || '{}')
    } catch { /* brez metapodatkov */ }

    const deltaMm = strankaSkupajMm - merilecSkupajMm
    const deltaPct = merilecSkupajMm > 0 ? (deltaMm / merilecSkupajMm) * 100 : null

    let verdict: { label: string; cls: string; icon: typeof CheckCircle2 }
    if (deltaPct == null) {
      verdict = { label: 'Ni uradnih meritev za primerjavo', cls: 'bg-muted text-muted-foreground border-border', icon: Info }
    } else if (Math.abs(deltaPct) <= 5) {
      verdict = { label: 'V okviru — zanesljiva orientacija', cls: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800', icon: CheckCircle2 }
    } else if (Math.abs(deltaPct) <= 15) {
      verdict = { label: 'Orientacija — preveri na terenu pred izdelavo', cls: 'bg-roksal-amber/10 text-roksal-ink border-roksal-amber/40', icon: AlertTriangle }
    } else {
      verdict = { label: 'Veliko odstopanje — obvezen obisk na terenu', cls: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800', icon: AlertTriangle }
    }

    return {
      customerMap,
      strankaSkupajMm,
      merilecSkupajMm,
      merilecCount: merilec.length,
      deltaMm,
      deltaPct,
      meta,
      verdict,
      zadnja: customerMap.reduce((a, b) => (a.createdAt > b.createdAt ? a : b)).createdAt as string,
    }
  }, [measurements])

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
        label = `${mDate.getDate()}. ${MESCI_SL[mDate.getMonth()]}`
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

    // R357 FAZA 10 — EN VIR (vzorec FAZA 5–9): telo + POST + osnutki v
    // measurements/vnos-meritve; preslikava + toasti ostanejo tu (prikazna
    // polja nagibnega merilnika, bajtno ista kot stale telo).
    const rezultat = await posljiVnosMere({
      projectId: selectedProject,
      dolzinaMm: 1,
      visinaMm: 1,
      arMetadata,
    })
    if (rezultat.izid === 'uspeh') {
      const data = rezultat.podatki
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
      // R152: neuspeh → ekspliciten osnutek, ni fake-success "(lokalno)";
      // telo = ISTI payload kot POST (EN VIR — gradnik ga nosi v rezultatu).
      // stale obnašanje: dialog ostane odprt tudi ob osnutku (VERBATIM).
      createMeasurementDraft(
        rezultat.telo,
        `${inclinometerMode === 'KOT' ? 'Kot' : 'Nagib'} ${kotStopinje}° — ${lokacija}`
      )
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
      // R356 FAZA 9 — EN VIR vnos meritve POST orkestracija (vzorec FAZA
      // 5–8): per-item tok (POST → uspeh = preslikava + prepend; ne-ok ALI
      // napaka = ekspliciten osnutek R152) zdaj v measurements/vnos-meritve;
      // preslikava odgovora ostane tu (prikazna polja stopniščnega čarovnika,
      // bajtno ista kot stale telo).
      const rezultat = await posljiVnosMere({
        projectId: selectedProject,
        dolzinaMm: item.dolzinaMm,
        visinaMm: item.visinaMm,
        arMetadata: item.ar,
      })
      if (rezultat.izid === 'uspeh') {
        const newM: Measurement = {
          ...rezultat.podatki,
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
        // R152: neuspeh → ekspliciten osnutek (ni fake-success); telo = ISTI
        // payload kot POST (EN VIR — gradnik ga nosi v rezultatu).
        createMeasurementDraft(rezultat.telo, item.ar.oznaka || 'stopnica')
        localCount++
      }
    }

    pushAudit({
      akcija: 'ADD',
      meritevId: 'stair-wizard',
      opis: `Stopniščni čarovnik: ${stStopnic} stopnic, ${Math.round(skupnaVisinaMm)}mm višine, kot ${stairCalc.kotStopinje.toFixed(1)}° — ${newMeas.length} meritev kreiranih`,
    })
    if (localCount > 0) {
      toast.warning(
        `Ustvarjeno ${newMeas.length} meritev: ${okCount} v bazi, ${localCount} NISO v bazi — ostajo kot lokalni osnutki za sinhronizacijo.`
      )
    } else {
      toast.success(`Ustvarjeno ${newMeas.length} meritev v bazo.`)
    }
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

    // R357 FAZA 10 — EN VIR (vzorec FAZA 5–9): telo + POST + osnutki v
    // measurements/vnos-meritve; preslikava + toasti ostanejo tu (prikazna
    // polja kotomera, bajtno ista kot stale telo).
    const rezultat = await posljiVnosMere({
      projectId: selectedProject,
      dolzinaMm: 1,
      visinaMm: 1,
      arMetadata,
    })
    if (rezultat.izid === 'uspeh') {
      const data = rezultat.podatki
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
      // R152: neuspeh → ekspliciten osnutek, ni fake-success "(lokalno)";
      // telo = ISTI payload kot POST (EN VIR — gradnik ga nosi v rezultatu).
      createMeasurementDraft(rezultat.telo, oznaka)
      setKotomerOpen(false)
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

    // R356 FAZA 9 — EN VIR vnos meritve POST orkestracija (vzorec FAZA
    // 5–8): per-item tok (POST → uspeh = preslikava + prepend; ne-ok ALI
    // napaka = ekspliciten osnutek R152) zdaj v measurements/vnos-meritve;
    // preslikava odgovora ostane tu (prikazna polja STEBR, bajtno ista kot
    // stale telo).
    const rezultat = await posljiVnosMere({
      projectId: selectedProject,
      dolzinaMm: Math.max(1, Math.round(pozicijaMm)),
      visinaMm: visinaStebra,
      arMetadata,
    })
    if (rezultat.izid === 'uspeh') {
      const newM: Measurement = {
        ...rezultat.podatki,
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
      // R152: neuspeh → ekspliciten osnutek, ni fake-success "(lokalno)";
      // telo = ISTI payload kot POST (EN VIR — gradnik ga nosi v rezultatu).
      createMeasurementDraft(rezultat.telo, `Stebriček ${oznaka}`)
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
    // R156: Status stolpec — usklajen s splošnim CSV izvozom (P1 dodan tudi
    // v per-segment izvoz; R154 odloženo, zdaj dopolnjeno. Vrednosti iz
    // statusLabels jedra — enak vir resnice kot UI in strežniški filter).
    // R350 FAZA 7 — EN VIR: STEBRI_CSV_HEADER + zgradiStebriVrstice (prej
    // inline vrstični gradnik; vsebina bajtno ista) + csvDokument + kanon
    // downloadCsvText (R348 FAZA 5 ostanki).
    const csvContent = csvDokument(STEBRI_CSV_HEADER, zgradiStebriVrstice(stebri))
    downloadCsvText(`stebri_${segmentId}_${new Date().toISOString().slice(0, 10)}.csv`, csvContent)
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
      // R356 FAZA 9 — EN VIR vnos meritve POST orkestracija (vzorec FAZA
      // 5–8): per-item tok (POST → uspeh = preslikava + prepend; ne-ok ALI
      // napaka = ekspliciten osnutek R152) zdaj v measurements/vnos-meritve;
      // preslikava odgovora ostane tu (prikazna polja STEBR/WPC, bajtno
      // ista kot stale telo).
      const rezultat = await posljiVnosMere({
        projectId: selectedProject,
        dolzinaMm: Math.max(1, Math.round(pozicijaMm)),
        visinaMm: visinaMm || 1100,
        arMetadata,
      })
      if (rezultat.izid === 'uspeh') {
        const newM: Measurement = {
          ...rezultat.podatki,
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
        // R152: neuspeh → ekspliciten osnutek (ni fake-success); telo = ISTI
        // payload kot POST (EN VIR — gradnik ga nosi v rezultatu).
        createMeasurementDraft(rezultat.telo, `WPC stebriček ${oznaka}`)
        localCount++
      }
    }

    pushAudit({
      akcija: 'ADD',
      meritevId: 'wpc-palice',
      opis: `WPC palice dodane: ${stPalic} kos (${segmentTypeLabels[segment.type]}, ${wpcSirinaPalice}×${wpcDebelinaPalice}mm, razmak ${wpcRazmikPalic}mm) v segment ${segment.id}`,
    })
    if (localCount > 0) {
      toast.warning(
        `Dodanih ${stPalic} WPC palic: ${okCount} v bazi, ${localCount} NISO — ostajo kot lokalni osnutki za sinhronizacijo.`
      )
    } else {
      toast.success(`Dodanih ${stPalic} WPC palic v bazo.`)
    }
  }

  function handleExportCSV() {
    if (measurements.length === 0) {
      toast.error('Ni meritev za izvoz')
      return
    }
    // R348 FAZA 5 — EN VIR: vrstice prek zgradiMeritveVrstice (prej stale
    // kopija — bajtno identična telesu handleBulkExportCSV; zdaj ISTA
    // resnica, vhodni seznam = klicateljeva resnica); prenos prek kanona
    // downloadCsvText (R171/R296) — vsebina bajtno ista, MIME kanon
    // 'text/csv;charset=utf-8' (navlečna pika odpade).
    const csvContent = csvDokument(MERITVE_CSV_HEADER, zgradiMeritveVrstice(measurements))
    downloadCsvText(`meritve_${selectedProject}_${new Date().toISOString().slice(0, 10)}.csv`, csvContent)
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

    // R350 FAZA 7 — EN VIR: gradnik v ./measurements/pdf-seznam.ts (prej
    // 85-vrstični inline jsPDF blok — glava/povzetek/tabela/noga VERBATIM;
    // izvoženi PDF bajtno enak). Povzetek številke = ISTA izpeljava kot KPI
    // kartice (WYSIWYG); guard + toast = klicateljeva UI resnica.
    exportSeznamPdf({
      measurements,
      projectName: projects.find((p) => p.id === selectedProject)?.nazivProjekta || 'Brez projekta',
      totalLength,
      avgHeight,
      stSegmentov: allSegments.length,
      najdalsaDolzinaMm: longestMeasurement ? longestMeasurement.dolzinaMm : null,
      totalArea,
      statusCounts,
      izvozenoOb: new Date(),
      filename: `meritve_${selectedProject}_${new Date().toISOString().slice(0, 10)}.pdf`,
    })
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
      // R357 FAZA 10 — EN VIR vnos meritve POST orkestracija (vzorec FAZA
      // 5–9): per-item tok v measurements/vnos-meritve; preslikava odgovora
      // ostane tu (prikazna polja predlog, bajtno ista kot stale telo).
      const rezultat = await posljiVnosMere({
        projectId: selectedProject,
        dolzinaMm: item.dolzinaMm,
        visinaMm: item.visinaMm,
        arMetadata: item.ar,
      })
      if (rezultat.izid === 'uspeh') {
        const data = rezultat.podatki
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
        // R152: neuspeh → ekspliciten osnutek (ni fake-success); telo = ISTI
        // payload kot POST (EN VIR — gradnik ga nosi v rezultatu).
        createMeasurementDraft(
          rezultat.telo,
          item.ar.oznaka || 'predloga'
        )
        localCount++
      }
    }

    const predloga = PREDLOGE.find((p) => p.id === predlogaId)
    pushAudit({
      akcija: 'ADD',
      meritevId: 'predloga',
      opis: `Predloga \"${predloga?.naziv || predlogaId}\" uporabljena — ${newMeas.length} meritev, ${newSegs.length} segmentov`,
    })
    if (localCount > 0) {
      toast.warning(
        `Predloga ${predloga?.naziv || predlogaId}: ${successCount} sinhroniziranih, ${localCount} NISO v bazi — ostajo kot lokalni osnutki za sinhronizacijo.`
      )
    } else {
      toast.success(`Predloga uporabljena: ${predloga?.naziv || predlogaId} (${successCount} meritev)`)
    }
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
    // R348 FAZA 5 — EN VIR: ISTI gradnik kot handleExportCSV (prej stale
    // kopija z 2. resnico); samo vhodni seznam = izbrane meritve.
    const csvContent = csvDokument(MERITVE_CSV_HEADER, zgradiMeritveVrstice(selected))
    downloadCsvText(`meritve_izbrane_${new Date().toISOString().slice(0, 10)}.csv`, csvContent)
    pushAudit({
      akcija: 'EDIT',
      meritevId: 'bulk',
      opis: `Skupinsko izvoženih ${selected.length} meritev (CSV)`,
    })
    toast.success(`Izvozenih ${selected.length} meritev (CSV)`)
  }

  // R152: kopiranje v segment POSKUSI resnični POST za vsako meritev;
  // neuspele gredo v eksplicitne osnutke (prej: samo izmišljene lokalne
  // vrstice, izgubljene ob reloadu).
  // R358 FAZA 11: per-item telo gradi SKUPNI builder teloRepostaIzMeritve
  // (ist kot podvojenost — bajtno isti vrstni red 5 ključev), per-item tok
  // v posljiRepostMere (gradnik nikoli ne meče — try/catch ovojnica
  // izginila; ne-ok ALI omrežna napaka = osnutek z ISTIM telesom R152);
  // zbirni audit + toasti + brisanje izbire ostanejo tu (UI resnica v UI).
  async function handleBulkCopyToSegment() {
    if (!bulkCopyTarget) {
      toast.error('Izberite ciljni segment')
      return
    }
    const selected = measurements.filter((m) => selectedIds.has(m.id))
    if (selected.length === 0) {
      toast.error('Ni izbranih meritev')
      return
    }
    let okCount = 0
    let draftCount = 0
    for (const m of selected) {
      const payload = teloRepostaIzMeritve(m, selectedProject)
      const rezultat = await posljiRepostMere(payload)
      if (rezultat.izid === 'uspeh') {
        const data = rezultat.podatki
        const copy: Measurement = {
          ...data,
          lokacija: m.lokacija,
          tipMeritve: m.tipMeritve,
          segmentId: bulkCopyTarget,
          oznaka: m.oznaka ? `${m.oznaka} (kopija)` : 'Kopija',
          status: 'OSNUTEK' as MeasurementStatus,
        }
        setMeasurements((prev) => [copy, ...prev])
        okCount++
        continue
      }
      createMeasurementDraft(payload, `${m.oznaka || 'meritev'} (kopija → ${bulkCopyTarget})`)
      draftCount++
    }
    pushAudit({
      akcija: 'ADD',
      meritevId: 'bulk',
      opis: `Kopirano ${selected.length} meritev v segment \"${bulkCopyTarget}\" (${okCount} strežnik, ${draftCount} osnutki)`,
    })
    if (draftCount > 0) {
      toast.warning(`${okCount} kopiranih v bazo, ${draftCount} NISO — ostajajo kot lokalni osnutki.`)
    } else {
      toast.success(`${selected.length} meritev kopiranih v \"${bulkCopyTarget}\"`)
    }
    setSelectedIds(new Set())
    setBulkCopyTarget('')
  }

  // R153 (§19) — množično arhiviranje je zdaj PERZISTENTNO: zaporedni PATCH
  // /api/measurements/[id] (determinističen vrstni red po seznamu meritev =
  // createdAt desc). že arhivirane meritev končno stanje ustreza zahtevku —
  // štejeta se kot opravljene (idempotentno, brez laži). Neuspehi → iskren
  // povzetek s prvim razlogom. (Ime handlerja zgodovinsko — dialog arhivira.)
  async function handleBulkDelete() {
    const selected = measurements.filter((m) => selectedIds.has(m.id))
    if (selected.length === 0) {
      toast.error('Ni izbranih meritev')
      return
    }
    setBulkArchiveBusy(true)
    let okCount = 0
    const failed: string[] = []
    for (const m of selected) {
      const label = m.oznaka || m.lokacija || `#${m.id.slice(-4)}`
      if (m.status === 'ARHIVIRANA') {
        okCount += 1
        continue
      }
      try {
        const res = await fetch(`/api/measurements/${m.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'ARHIVIRANA' }),
        })
        if (res.ok) {
          const data = (await res.json()) as { changed: boolean; measurement: Measurement }
          setMeasurements((prev) =>
            prev.map((x) =>
              x.id === m.id ? normalizeMeasurements([data.measurement])[0] : x
            )
          )
          pushAudit({
            akcija: 'STATUS',
            meritevId: m.id,
            opis: `Status meritve „${label}“: ${statusLabels[m.status || 'OSNUTEK']} → Arhivirana`,
            staraVrednost: statusLabels[m.status || 'OSNUTEK'],
            novaVrednost: 'Arhivirana',
          })
          okCount += 1
        } else {
          const err = (await res.json().catch(() => null)) as { error?: string } | null
          failed.push(`${label}: ${err?.error || `napaka ${res.status}`}`)
        }
      } catch {
        failed.push(`${label}: brez povezave`)
      }
    }
    setBulkArchiveBusy(false)
    setSelectedIds(new Set())
    setBulkDeleteOpen(false)
    if (failed.length === 0) {
      toast.success(`Arhiviranih meritev: ${okCount}`)
    } else if (okCount === 0) {
      toast.error(`Arhiviranje ni uspelo (vseh ${failed.length}) — prvi razlog: ${failed[0]}`)
    } else {
      toast.warning(`Arhiviranih ${okCount}, neuspelih ${failed.length} — prvi razlog: ${failed[0]}`)
    }
  }

  // ============================================
  // P1 — IZVOZ ZGODOVINE (audit CSV)
  // ============================================

  function handleExportAuditCSV() {
    if (auditEntries.length === 0) {
      toast.error('Ni zgodovine za izvoz')
      return
    }
    // R350 FAZA 7 — EN VIR: ZGODOVINA_CSV_HEADER + zgradiZgodovinaVrstice
    // (prej inline vrstični gradnik — vsebina bajtno ista; čas = ISTI
    // slDatumKratko + ', ' + slCasDolgo prikaz kot zaslon) + csvDokument +
    // kanon downloadCsvText (R348 FAZA 5 ostanki).
    const csvContent = csvDokument(ZGODOVINA_CSV_HEADER, zgradiZgodovinaVrstice(auditEntries))
    downloadCsvText(`zgodovina_${selectedProject}_${new Date().toISOString().slice(0, 10)}.csv`, csvContent)
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
  // MERITVE-PRO — AR SINHRONIZACIJA (uvaz tock v mere)
  // ============================================

  async function handleOpenArImport() {
    if (!selectedProject) {
      toast.error('Izberite projekt!')
      return
    }
    setArImportOpen(true)
    setArImportLoading(true)
    setArSelectedSnapshotId(null)
    setArSnapshots([])
    try {
      const res = await fetch(`/api/ar-snapshots?projectId=${selectedProject}`)
      if (res.ok) {
        const data = await res.json()
        setArSnapshots(data || [])
        if ((data || []).length === 0) {
          toast.info('Najprej ustvari AR posnetek v AR kameri')
        }
      } else {
        toast.error('Napaka pri pridobivanju AR posnetkov')
      }
    } catch {
      toast.error('Napaka pri povezavi s strežnikom')
    } finally {
      setArImportLoading(false)
    }
  }

  async function handleImportFromAr() {
    if (!selectedProject || !arSelectedSnapshotId) {
      toast.error('Izberite AR posnetek za uvoz')
      return
    }
    const snapshot = arSnapshots.find((s) => s.id === arSelectedSnapshotId)
    if (!snapshot) {
      toast.error('AR posnetek ni najden')
      return
    }

    // Razčleni točke in kalibracijo
    let tocke: Array<{ x: number; y: number; label?: string }> = []
    let kalibracija: { pixelsPerMm?: number; pixelsPerCm?: number } | null = null
    let noCalibration = false
    try {
      tocke = JSON.parse(snapshot.tocke || '[]')
    } catch {
      toast.error('Napaka pri razčlenjevanju točk AR posnetka')
      return
    }
    try {
      kalibracija = snapshot.kalibracija ? JSON.parse(snapshot.kalibracija) : null
    } catch {
      kalibracija = null
    }
    // Podprta tako pixelsPerMm kot pixelsPerCm (Prisma schema omenja pixelsPerCm)
    let pixelsPerMm: number | null = null
    if (kalibracija?.pixelsPerMm && kalibracija.pixelsPerMm > 0) {
      pixelsPerMm = kalibracija.pixelsPerMm
    } else if (kalibracija?.pixelsPerCm && kalibracija.pixelsPerCm > 0) {
      pixelsPerMm = kalibracija.pixelsPerCm / 10
    }
    if (!pixelsPerMm) {
      noCalibration = true
      toast.warning('AR posnetek ni umerjen — mere bodo neprofične, a še vedno uvožene', {
        description: 'Umeri AR posnetek v AR kameri za pravilne mere.',
      })
    }

    if (tocke.length < 2) {
      toast.error('AR posnetek ima premalo točk (potrebni vsaj 2)')
      return
    }

    // Pripravi seznam parov (zaporedne točke) in posamezne točke (stebri)
    const pairs: Array<{ a: typeof tocke[0]; b: typeof tocke[0]; dolzinaMm: number }> = []
    for (let i = 0; i < tocke.length - 1; i++) {
      const a = tocke[i]
      const b = tocke[i + 1]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const px = Math.sqrt(dx * dx + dy * dy)
      const mm = pixelsPerMm ? px / pixelsPerMm : 0
      pairs.push({ a, b, dolzinaMm: Math.max(0, Math.round(mm)) })
    }

    const total = pairs.length + tocke.length
    setArImportProgress({ current: 0, total })

    let okCount = 0
    let localCount = 0
    let created = 0

    // 1. Ustvari RAZDALJA mere za vsak par
    for (let i = 0; i < pairs.length; i++) {
      const p = pairs[i]
      const label1 = p.a.label || `T${i + 1}`
      const label2 = p.b.label || `T${i + 2}`
      const arMetadata: ArMetadata = {
        tipMeritve: 'RAZDALJA',
        oznaka: `AR ${label1}-${label2}`,
        source: 'ar_snapshot',
        snapshotId: snapshot.id,
        opomba: noCalibration
          ? `AR uvoz (brez umeritve) — par ${label1}→${label2}`
          : `AR uvoz — par ${label1}→${label2}, ${p.dolzinaMm}mm`,
        status: 'OSNUTEK',
        enota: 'mm',
        x: p.a.x,
        y: p.a.y,
      }
      // R357 FAZA 10 — EN VIR (vzorec FAZA 5–9): per-item tok v
      // measurements/vnos-meritve; preslikava odgovora ostane tu (prikazna
      // polja AR RAZDALJA, bajtno ista kot stale telo).
      const rezultat = await posljiVnosMere({
        projectId: selectedProject,
        dolzinaMm: Math.max(1, p.dolzinaMm),
        visinaMm: 1100,
        arMetadata,
      })
      if (rezultat.izid === 'uspeh') {
        const data = rezultat.podatki
        const newM: Measurement = {
          ...data,
          lokacija: null,
          tipMeritve: 'RAZDALJA',
          oznaka: arMetadata.oznaka,
          opomba: arMetadata.opomba,
          status: 'OSNUTEK',
          source: 'ar_snapshot',
          snapshotId: snapshot.id,
          enota: 'mm',
        }
        setMeasurements((prev) => [newM, ...prev])
        okCount++
      } else {
        // R152: neuspeh → ekspliciten osnutek (ni fake-success); telo = ISTI
        // payload kot POST (EN VIR — gradnik ga nosi v rezultatu).
        createMeasurementDraft(
          rezultat.telo,
          arMetadata.oznaka || 'AR uvoz'
        )
        localCount++
      }
      created++
      setArImportProgress({ current: created, total })
    }

    // 2. Ustvari STEBR mero za vsako točko
    for (let i = 0; i < tocke.length; i++) {
      const t = tocke[i]
      const label = t.label || `T${i + 1}`
      const arMetadata: ArMetadata = {
        tipMeritve: 'STEBR',
        oznaka: `AR-${label}`,
        source: 'ar_snapshot',
        snapshotId: snapshot.id,
        opomba: `AR točka ${label} (x=${Math.round(t.x)}, y=${Math.round(t.y)})`,
        status: 'OSNUTEK',
        enota: 'mm',
        tipStebra: 'VMESNI',
        materialStebra: 'ALU',
        visinaStebraMm: 1100,
        pozicijaMm: 0,
        steberOznaka: `AR-${label}`,
        x: t.x,
        y: t.y,
      }
      // R357 FAZA 10 — EN VIR (vzorec FAZA 5–9): per-item tok v
      // measurements/vnos-meritve; preslikava odgovora ostane tu (prikazna
      // polja AR STEBR, bajtno ista kot stale telo).
      const rezultat = await posljiVnosMere({
        projectId: selectedProject,
        dolzinaMm: 1,
        visinaMm: 1100,
        arMetadata,
      })
      if (rezultat.izid === 'uspeh') {
        const data = rezultat.podatki
        const newM: Measurement = {
          ...data,
          lokacija: null,
          tipMeritve: 'STEBR',
          oznaka: arMetadata.oznaka,
          opomba: arMetadata.opomba,
          status: 'OSNUTEK',
          source: 'ar_snapshot',
          snapshotId: snapshot.id,
          enota: 'mm',
          tipStebra: 'VMESNI',
          materialStebra: 'ALU',
          visinaStebraMm: 1100,
          pozicijaMm: 0,
          steberOznaka: `AR-${label}`,
        }
        setMeasurements((prev) => [newM, ...prev])
        okCount++
      } else {
        // R152: neuspeh → ekspliciten osnutek (ni fake-success); telo = ISTI
        // payload kot POST (EN VIR — gradnik ga nosi v rezultatu).
        createMeasurementDraft(
          rezultat.telo,
          arMetadata.oznaka || `AR-${label}`
        )
        localCount++
      }
      created++
      setArImportProgress({ current: created, total })
    }

    pushAudit({
      akcija: 'ADD',
      meritevId: 'ar-import',
      opis: `AR uvoz: ${pairs.length} mer + ${tocke.length} stebrov iz AR posnetka ${snapshot.id.slice(-6)}${noCalibration ? ' (brez umeritve)' : ''}`,
    })
    if (localCount > 0) {
      toast.warning(
        `AR uvoz: ${okCount} shranjenih v bazo, ${localCount} NISO v bazi — ostajo kot lokalni osnutki.`,
        { duration: 8000 }
      )
    } else {
      toast.success(`${pairs.length} mer in ${tocke.length} stebrov uvoženih iz AR posnetka`)
    }
    setArImportProgress(null)
    setArImportOpen(false)
  }

  // ============================================
  // MERITVE-PRO — FOTO MERE POVEZAVA NAZAJ
  // ============================================

  // Odpri pregledovalnik foto za določeno meritev (ki ima photoId v arMetadata)
  async function handleViewPhoto(m: Measurement) {
    if (!m.photoId) {
      toast.error('Foto povezava manjka')
      return
    }
    setPhotoViewerOpen(true)
    setPhotoViewerLoading(true)
    setPhotoViewerNotFound(false)
    setPhotoViewerUrl(null)
    setPhotoViewerId(m.photoId)
    try {
      const res = await fetch(`/api/photos?projectId=${m.projectId}`)
      if (res.ok) {
        const data = await res.json() as Array<{ id: string; imageData: string; opomba?: string | null; createdAt: string }>
        const photo = data.find((p) => p.id === m.photoId)
        if (photo) {
          setPhotoViewerUrl(photo.imageData)
        } else {
          setPhotoViewerNotFound(true)
          toast.error('Foto ni najden v projektu')
        }
      } else {
        setPhotoViewerNotFound(true)
        toast.error('Napaka pri pridobivanju slik')
      }
    } catch {
      setPhotoViewerNotFound(true)
      toast.error('Napaka pri povezavi s strežnikom')
    } finally {
      setPhotoViewerLoading(false)
    }
  }

  // Preklopi v Slike zavihek (signal prek localStorage)
  function handleOpenInPhotos() {
    if (!photoViewerId) return
    try {
      localStorage.setItem('roksal_open_photo_id', photoViewerId)
    } catch {
      // ignore
    }
    setPhotoViewerOpen(false)
    toast.info('Odprto v slikah', {
      description: 'Preklopite na zavihek "Slike" za urejanje.',
    })
  }

  // ============================================
  // RENDERS — RAILING DIAGRAM (obstoječa logika)
  // ============================================
  // R340 — dekompozicija FAZA 4: renderRailingDiagram izluščen VERBATIM v
  // measurements/railing-diagram.tsx (čist premik čiste JSX funkcije; edina
  // odvisnost = getQuickSpacing + formatDimension, obe v mapi measurements/).

  // ============================================
  // RENDER — MERITVE LIST (ena kartica)
  // ============================================

  function renderMeasurementCard(m: Measurement) {
    const gps = parseGPS(m.gpsLokacija ?? null)
    const TipIcon = m.tipMeritve ? tipMeritveIcons[m.tipMeritve] : Ruler
    const mStatus: MeasurementStatus = m.status || 'OSNUTEK'
    const isArchived = mStatus === 'ARHIVIRANA'
    const angleDeg = m.kotStopinje ?? m.kot ?? null
    // MERITVE-PRO — vir meritve
    const isPhoto = m.source === 'photo'
    const isArSnapshot = m.source === 'ar_snapshot'
    return (
      <div
        key={m.id}
        className={`rounded-xl border border-border/50 overflow-hidden transition-all hover:border-roksal-navy/20 dark:hover:border-roksal-ink/20 hover:shadow-sm slide-in-right focus-within:border-roksal-navy/30 dark:focus-within:border-roksal-ink/30 ${
          isArchived ? 'opacity-60' : ''
        } ${isPhoto ? 'border-roksal-amber/30' : ''}`}
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
                <p className={`text-sm font-semibold text-roksal-ink truncate ${isArchived ? 'line-through' : ''}`}>
                  {m.oznaka || m.lokacija || `Meritev #${m.id.slice(-4)}`}
                </p>
                {m.tipMeritve && m.tipMeritve !== 'RAZDALJA' && (
                  <span
                    className={`inline-flex items-center gap-0.5 rounded px-1 py-0 text-3xs font-medium border cursor-help ${
                      tipMeritveColors[m.tipMeritve]
                    }`}
                    title={tipMeritveTitles[m.tipMeritve]}
                  >
                    <TipIcon className="h-2.5 w-2.5" />
                    {tipMeritveLabels[m.tipMeritve]}
                  </span>
                )}
                {/* MERITVE-PRO — Vir badge (Foto / AR / Laser) */}
                {isPhoto && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-0.5 rounded px-1 py-0 text-3xs font-medium border bg-roksal-amber/10 text-roksal-amber border-roksal-amber/30">
                        <Camera aria-hidden="true" className="h-2.5 w-2.5" />
                        Foto
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Vir: Foto mera</TooltipContent>
                  </Tooltip>
                )}
                {isArSnapshot && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-0.5 rounded px-1 py-0 text-3xs font-medium border bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800">
                        <Boxes aria-hidden="true" className="h-2.5 w-2.5" />
                        AR
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Vir: AR posnetek</TooltipContent>
                  </Tooltip>
                )}
                {m.source === 'customer-map' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-0.5 rounded px-1 py-0 text-3xs font-medium border bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800">
                        <UserRound aria-hidden="true" className="h-2.5 w-2.5" />
                        Stranka
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Vir: samomeritev stranke prek povezave</TooltipContent>
                  </Tooltip>
                )}
                {/* P1 — status badge (clickable) — R153: perzistenten PATCH */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleStatusCycle(m)}
                      disabled={statusBusyId === m.id}
                      aria-label={`Status meritve ${m.oznaka || m.lokacija || `#${m.id.slice(-4)}`}: ${statusLabels[mStatus]}. Klik za spremembo v ${statusLabels[statusCycle[mStatus]]}`}
                      className={`inline-flex items-center gap-0.5 rounded px-1 py-0 text-3xs font-medium border transition-all hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-50 ${
                        statusColors[mStatus]
                      }`}
                      title="Klikni za cikliranje statusa (shranjeno v bazo)"
                    >
                      {mStatus === 'POTRJENA' ? (
                        <CheckCircle2 aria-hidden="true" className="h-2.5 w-2.5" />
                      ) : mStatus === 'ARHIVIRANA' ? (
                        <Archive aria-hidden="true" className="h-2.5 w-2.5" />
                      ) : (
                        <RotateCcw aria-hidden="true" className="h-2.5 w-2.5" />
                      )}
                      {statusLabels[mStatus]}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Spremeni status (perzistentno, z revizijsko sledjo)</TooltipContent>
                </Tooltip>
                {/* R276 (O2/O5) — verzija žig: vN za verzionirane vrstice;
                    null (legacy pred verzioniranjem) = brez žiga (iskrena
                    praznina — nikoli izmišljene verzije). */}
                {m.verzija != null && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="inline-flex items-center rounded px-1 py-0 text-3xs font-medium border bg-roksal-navy/5 text-roksal-navy border-roksal-navy/20 dark:bg-roksal-ink/10 dark:text-roksal-ink dark:border-roksal-ink/20 cursor-help font-mono tabular-nums"
                        title={
                          m.predhodnikId
                            ? `Verzija v${m.verzija} — korekcija (predhodna verzija ostaja v zgodovini — issue #16 §6). Klik na ikono zgodovine pokaže celotno verigo.`
                            : `Verzija v${m.verzija} — prvi vpis v verigi (korekcije ustvarjajo v2, v3 …; obstoječe se ne prepišejo — issue #16 §6).`
                        }
                      >
                        v{m.verzija}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {m.predhodnikId
                        ? 'Korekcija — predhodna verzija ostaja v zgodovini'
                        : 'Prvi vpis v verigi verzij'}
                    </TooltipContent>
                  </Tooltip>
                )}
                {/* R276 (O2) — vir izpeljan na strežniku (MANUAL/PHOTO_CV/
                    ARCORE_DEPTH); null (legacy) = brez oznake (iskrena
                    praznina — nikoli ugibanje). */}
                {m.vir != null && m.vir in MERITEV_VIR_LABELS && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="inline-flex items-center rounded px-1 py-0 text-3xs font-medium border bg-muted text-muted-foreground border-border cursor-help"
                        title={
                          m.vir === 'MANUAL'
                            ? 'Vir podatkov: Ročni vnos — meritev vnesel uporabnik; oznako izpeljal strežnik iz kontrakta (klient je ne more ponarejati).'
                            : m.vir === 'PHOTO_CV'
                              ? 'Vir podatkov: Foto-CV — meritev iz računalniškega vida na fotografijah; oznako izpeljal strežnik iz kontrakta (klient je ne more ponarejati).'
                              : 'Vir podatkov: AR-Depth — meritev iz ARCore globinskega senzorja; oznako izpeljal strežnik iz kontrakta (klient je ne more ponarejati).'
                        }
                      >
                        {MERITEV_VIR_LABELS[m.vir as MeritevVir]}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Vir meritve (izpeljan na strežniku — vir resnice)
                    </TooltipContent>
                  </Tooltip>
                )}
                {/* R281 (issue #16 §10, V3/V4) — sync žig: opazovano stanje
                    klienta (provenance), prikazano SAMO kadar je klient
                    poročal sync stanje (iskrena praznina — nikoli izumljen
                    žig); neznano syncState = brez žiga (fail-closed prikaz). */}
                {m.sync?.syncState != null && m.sync.syncState in syncStanjeLabels && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className={`inline-flex items-center rounded px-1 py-0 text-3xs font-medium border cursor-help ${syncStanjeColors[m.sync.syncState]}`}
                        title={`${syncStanjeTitles[m.sync.syncState]}${m.sync.tombstone === true ? ' Lokalno označeno za brisanje (tombstone — grobnico potrdi /api/sync ob naslednjem syncu).' : ''}`}
                      >
                        {syncStanjeLabels[m.sync.syncState]}
                        {typeof m.sync.syncRevision === 'number' ? ` r${m.sync.syncRevision}` : ''}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Sync metadata (opazovano stanje klienta — NI sync resnica)
                    </TooltipContent>
                  </Tooltip>
                )}
                {m.segmentId && (
                  <Badge
                    variant="outline"
                    className="text-[9px] h-4 px-1 shrink-0 cursor-help"
                    title={`Pripada segmentu ${allSegments.find((s) => s.id === m.segmentId)?.name || m.segmentId} — stabilen segmentId (identiteta preživi re-anchor, offline delo in migracijo kontrakta — issue #16 §1).`}
                  >
                    <Layers aria-hidden="true" className="h-2.5 w-2.5 mr-0.5" />
                    {allSegments.find((s) => s.id === m.segmentId)?.name || m.segmentId}
                  </Badge>
                )}
                {m.kot && m.kot !== 90 && (
                  <Badge
                    variant="outline"
                    className="text-[9px] h-4 px-1 shrink-0 cursor-help"
                    title={`Kot ${m.kot}° — izmerjena vrednost (verbatim, znak = resnica). Privzeti pravi kot 90° se ne označuje — označujem samo odstopanja.`}
                  >
                    {m.kot}°
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {/* P1 — multi-unit prikaz */}
                {m.tipMeritve !== 'KOT' && m.tipMeritve !== 'NAGIB' && (
                  <>
                    <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
                      ↔ {formatMultiUnit(m.dolzinaMm)}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
                      ↕ {formatMultiUnit(m.visinaMm)}
                    </span>
                  </>
                )}
                {m.tipMeritve === 'KOT' && angleDeg != null && (
                  <span className="text-xs text-roksal-amber font-mono tabular-nums">
                    {formatAngleMulti(angleDeg)}
                  </span>
                )}
                {m.tipMeritve === 'NAGIB' && angleDeg != null && (
                  <span className="text-xs text-roksal-amber font-mono tabular-nums">
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
                    className={`inline-flex items-center rounded px-1 py-0 text-3xs font-medium border ${
                      groundTypeColors[m.tipPodlage as GroundType] ||
                      'bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {groundTypeLabels[m.tipPodlage as GroundType] || m.tipPodlage}
                  </span>
                )}
                {/* MERITVE-PRO — podrobnosti vira */}
                {isPhoto && m.oznaka && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] text-roksal-amber/80 font-mono">
                    <ImageIcon aria-hidden="true" className="h-2.5 w-2.5" />
                    Vir: Foto ({m.oznaka} · {m.dolzinaMm}mm)
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0 ml-2">
            {/* R276 (O8) — zgodovina verzij: odpre verigo korekcij (lazy
                fetch); viden le, ko veriga obstaja (korenId ali predhodnikId). */}
            {(m.verzija != null || m.predhodnikId || m.korenId) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => toggleZgodovina(m)}
                    className="p-1.5 rounded-lg hover:bg-roksal-navy/10 dark:hover:bg-roksal-ink/10 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:outline-none transition-colors"
                    title="Zgodovina verzij"
                    aria-label={`Pokaži zgodovino verzij meritve ${m.oznaka || m.lokacija || `#${m.id.slice(-4)}`}`}
                  >
                    <History
                      aria-hidden="true"
                      className={`h-3.5 w-3.5 ${zgodovina.odprtoZa === m.id ? 'text-roksal-navy dark:text-roksal-ink' : 'text-muted-foreground'}`}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Zgodovina verzij (korekcije ne prepišejo — dodajo)</TooltipContent>
              </Tooltip>
            )}
            {/* R276 (O4) — Popravi (nova verzija): arhivirana → UI varen
                zavrn (server je vseeno fail-closed 409). */}
            {!isArchived && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => handleStartCorrection(m)}
                    className="p-1.5 rounded-lg hover:bg-roksal-navy/10 dark:hover:bg-roksal-ink/10 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:outline-none transition-colors"
                    title="Popravi meritev (ustvari novo verzijo)"
                    aria-label={`Popravi meritev ${m.oznaka || m.lokacija || `#${m.id.slice(-4)}`} — ustvari novo verzijo`}
                  >
                    <PencilRuler aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  Popravi — ustvari novo verzijo (obstoječa ostaja v zgodovini)
                </TooltipContent>
              </Tooltip>
            )}
            {/* MERITVE-PRO — Poglej foto gumb za photo-sourced mere */}
            {isPhoto && m.photoId && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => handleViewPhoto(m)}
                    className="p-1.5 rounded-lg hover:bg-roksal-amber/10 focus-visible:ring-2 focus-visible:ring-roksal-amber/40 focus-visible:ring-offset-2 focus-visible:outline-none transition-colors"
                    title="Poglej foto"
                    aria-label={`Poglej pripadajočo foto mero za ${m.oznaka || 'meritev'}`}
                  >
                    <Camera aria-hidden="true" className="h-3.5 w-3.5 text-roksal-amber" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Poglej pripadajočo foto mero</TooltipContent>
              </Tooltip>
            )}
            <button
              type="button"
              onClick={() => handleDuplicateMeasurement(m)}
              className="p-1.5 rounded-lg hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:outline-none transition-colors"
              title="Podvoji meritev"
              aria-label={`Podvoji meritev ${m.oznaka || m.id.slice(-4)}`}
            >
              <Copy aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() => handleDeleteMeasurement(m.id)}
              className="p-1.5 rounded-lg hover:bg-roksal-red/10 focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:outline-none transition-colors"
              title="Izbriši meritev"
              aria-label={`Izbriši meritev ${m.oznaka || m.id.slice(-4)}`}
            >
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground hover:text-roksal-red" />
            </button>
          </div>
        </div>

        {/* R276 (O8) — zgodovina verzij: celotna veriga z deltami, virom,
            statusom in aktivno verzijo (determinističen vrstni red s
            strežnika). Iskrene praznine: legacy verzija = '—', delta prve
            vrstice = '—', arhivirana zadnja = brez aktivne. */}
        {zgodovina.odprtoZa === m.id && (
          <div className="px-3 pb-3">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
              <p className="text-3xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <History aria-hidden="true" className="h-3 w-3" />
                Zgodovina verzij — korekcije NE prepišejo obstoječih mer, dodajo novo verzijo
                (issue #16 §6)
              </p>
              {zgodovina.nalaga && (
                <p className="text-3xs text-muted-foreground py-2">Nalaganje zgodovine …</p>
              )}
              {zgodovina.napaka && (
                <p className="text-3xs text-roksal-red py-2" role="alert">
                  Zgodovine ni mogoče pokazati: {zgodovina.napaka}
                </p>
              )}
              {!zgodovina.nalaga && !zgodovina.napaka && zgodovina.data && (
                <>
                  <table className="w-full text-3xs">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-1 pr-2 font-medium" title="Verzija v verigi korekcij — v1 = prvi vpis; — = nastalo pred verzioniranjem (korekcija ustvari novo verzijo, starejša ostaje v zgodovini)">Verzija</th>
                        <th className="py-1 pr-2 font-medium">Datum</th>
                        <th className="py-1 pr-2 font-medium" title="Izvor meritve — izpeljan na strežniku: Ročni vnos / Foto-CV / AR-Depth; — = nastalo pred verzioniranjem">Vir</th>
                        <th className="py-1 pr-2 font-medium tabular-nums" title="Dolžina te verzije v mm — Δ pokaže razliko od predhodne verzije">Dolžina</th>
                        <th className="py-1 pr-2 font-medium tabular-nums" title="Delta od predhodne verzije (+ večje / − manjše); prva vrstica verige nima delte">Δ</th>
                        <th className="py-1 pr-2 font-medium">Status</th>
                        <th className="py-1 font-medium text-right">Aktivna</th>
                      </tr>
                    </thead>
                    <tbody>
                      {zgodovina.data.verzije.map((v) => (
                        <tr key={v.id} className="border-t border-border/40">
                          <td className="py-1 pr-2 font-mono tabular-nums">
                            {v.verzija != null ? `v${v.verzija}` : '—'}
                          </td>
                          <td className="py-1 pr-2 tabular-nums">
                            {slDatumKratko(new Date(v.createdAt))}
                          </td>
                          <td className="py-1 pr-2">
                            {v.vir != null && v.vir in MERITEV_VIR_LABELS
                              ? MERITEV_VIR_LABELS[v.vir as MeritevVir]
                              : '—'}
                          </td>
                          <td className="py-1 pr-2 font-mono tabular-nums">
                            {formatMultiUnit(v.dolzinaMm)}
                          </td>
                          <td className="py-1 pr-2 font-mono tabular-nums">
                            {v.deltaDolzinaMm != null
                              ? (v.deltaDolzinaMm >= 0 ? `+${v.deltaDolzinaMm}` : String(v.deltaDolzinaMm))
                              : '—'}
                          </td>
                          <td className="py-1 pr-2">{v.status}</td>
                          <td className="py-1 text-right">
                            {zgodovina.data?.aktivnaId === v.id ? (
                              <span
                                className="inline-block h-2 w-2 rounded-full bg-roksal-green"
                                aria-hidden="true"
                              />
                            ) : (
                              <span className="sr-only">
                                {v.status === 'ARHIVIRANA' ? 'arhivirana — brez aktivne' : 'neaktivna'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-3xs text-muted-foreground mt-2">
                    {zgodovina.data.aktivnaId === null
                      ? 'Aktivna verzija: ni (zadnja verzija je arhivirana — nikoli padec nazaj na starejšo).'
                      : `Aktivna verzija: v${zgodovina.data.aktivnaVerzija}. Odvisni rezultati (BOM/dokumenti) nastali pred novejšo verzijo se NE izračunajo samodejno.`}
                  </p>
                </>
              )}
            </div>
          </div>
        )}

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
            <span className="flex items-center gap-1 shrink-0 tabular-nums">
              <Calendar aria-hidden="true" className="h-3 w-3" />
              {slDatumKratko(new Date(m.createdAt))}
            </span>
            {gps && (
              <span className="flex items-center gap-1 shrink-0">
                <MapPin aria-hidden="true" className="h-3 w-3" />
                GPS
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {(m.opomba || m.opombe) && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground max-w-[30%] truncate">
                <AlertCircle aria-hidden="true" className="h-3 w-3 shrink-0" />
                <span className="truncate hidden sm:inline">{m.opomba || m.opombe}</span>
              </div>
            )}
            {/* MERITVE-PRO — Poglej foto link gumb */}
            {isPhoto && m.photoId && (
              <button
                type="button"
                onClick={() => handleViewPhoto(m)}
                className="flex items-center gap-1 rounded-lg border border-roksal-amber/30 bg-roksal-amber/5 px-2 py-1 text-[11px] font-medium text-roksal-amber hover:bg-roksal-amber/10 active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-roksal-amber/40 focus-visible:ring-offset-2 focus-visible:outline-none transition-all duration-150"
                title="Poglej pripadajočo foto mero"
                aria-label={`Poglej pripadajočo foto mero za ${m.oznaka || 'meritev'}`}
              >
                <Link2 aria-hidden="true" className="h-3 w-3" />
                <span>Poglej foto</span>
              </button>
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
                className="flex items-center gap-1 rounded-lg bg-roksal-navy text-white px-2.5 py-1 text-[11px] font-medium hover:bg-roksal-navy/90 active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:outline-none transition-all duration-150 press-scale"
                title="Izračunaj razmike v kalkulatorju"
                aria-label={`Izračunaj razmike za meritev ${m.oznaka || m.id.slice(-4)}`}
              >
                <Calculator aria-hidden="true" className="h-3.5 w-3.5" />
                <span>Razmiki</span>
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // R201 — iskren prazni stolpec: brez projektov so vsi kontrolniki mrtvi
  // (predloge/uvoz/CSV brez predmeta). Izpeljanka ENKRAT, uporabljena na
  // izbirniku, seznamu in predlogah — ni izmišljenih podatkov (družina R152).
  const brezProjektov = !loading && projects.length === 0

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-4 px-4 pb-4 pt-2 md:space-y-5 md:px-6 md:pb-6">
      <div>
        <h2 className="text-xl font-bold text-roksal-ink">Meritve</h2>
        {/* R183 — pečat 'Osveženo ob HH:MM:SS' = čas zadnjega uspešnega branja
            meritev (vzorec R170-R182; skrit na ozkih zaslonih; flex-wrap). */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="text-sm text-muted-foreground">
            Meritve ograj, dimenzije, kotovi in nagibi — z umeritvijo in segmenti
          </p>
          {meritveOsvezitev && (
            <span
              className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"
              title="Čas zadnje uspešne osvežitve podatkov"
            >
              <History className="h-3 w-3 shrink-0" aria-hidden="true" />
              Osveženo ob <span className="tabular-nums">{casOznaka(meritveOsvezitev)}</span>
            </span>
          )}
        </div>
      </div>

      {/* Project Selector — R201: brez projektov = iskren prazni stolpec
          namesto slepega izbrnika (R200 P1 (b)); monter projektov NE ustvari,
          zato brez CTA — samo poštena razlaga in 'kaj naprej' koraki. */}
      <Card className="card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '0ms' }}>
        <CardContent className="p-4">
          {brezProjektov ? (
            <div className="space-y-3" data-testid="meritve-brez-projektov">
              <EmptyState
                icon={FolderX}
                title="Ni projektov"
                description="Meritve se vežejo na projekt — ko je projekt ustvarjen in dodeljen tebi, se pojavi tukaj."
              />
              <ol
                className="mx-auto grid w-full max-w-[340px] gap-1.5 text-left"
                aria-label="Kaj naprej"
              >
                {[
                  /* R239 (P1-a): ustvarjanje = vodstveno dejanje — besedilo
                     je vlogo-nevtralno in točno za VSE: vodstvo vidi gumb,
                     monter ve, odkod projekti pridejo (nikoli kazalec na
                     gumb, ki ga ne vidi — R201 iskrenost, R239 resnica). */
                  'Projekt se ustvari v zavihku Domov (gumb »Nov projekt« — viden vodstvu).',
                  'Projekt se samodejno pojavi v tem zavihku.',
                  'Zajemi meritve z AR kamero ali jih dodaj ročno.',
                ].map((korak, i) => (
                  <li
                    key={korak}
                    className="flex items-start gap-2 text-[11px] text-muted-foreground"
                  >
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-roksal-navy/10 text-[9px] font-bold tabular-nums text-roksal-ink">
                      {i + 1}
                    </span>
                    {korak}
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <FolderOpen aria-hidden="true" className="h-4 w-4 text-roksal-ink" />
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
                  <Crosshair aria-hidden="true" className="h-3 w-3 mr-1" />
                  {calibration.pixelsPerMm.toFixed(2)} px/mm
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MERITVE-PRO — LASER + AR SINHRONIZACIJA orodna vrstica */}
      <Card className="card-hover transition-all duration-200 animate-fade-in-up border-roksal-navy/15 dark:border-roksal-ink/15">
        <CardContent className="p-3 space-y-2.5">
          {/* Laser povezava — R325 dekompozicija FAZA 2: UI blok izluščen v
              LaserPanel (čist premik; props namesto closure spremenljivk) */}
          <LaserPanel
            laserSupported={laserSupported}
            laserStatus={laserStatus}
            laserDeviceName={laserDeviceName}
            laserLastReading={laserLastReading}
            onConnect={connectLaser}
            onDisconnect={disconnectLaser}
          />
          <Separator />
          {/* AR sinhronizacija */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 shrink-0 border border-cyan-200 dark:border-cyan-800">
                <Boxes aria-hidden="true" className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-roksal-ink">Uvozi iz AR posnetka</p>
                <p className="text-2xs text-muted-foreground truncate">
                  Prenesi točke iz AR kamere v mere
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleOpenArImport}
              disabled={!selectedProject}
              className="h-8 px-3 text-[11px] border-cyan-300 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/40"
            >
              <Boxes aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
              Uvozi iz AR
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI — Meri iz fotke (ocene mer brez ARCore, tudi iPhone) */}
      <PhotoMeasure projectId={selectedProject || null} />

      {/* P1 — HITRE PREDLOGE (templates) */}
      <Card className="card-hover transition-all duration-200 animate-fade-in-up border-roksal-amber/20" style={{ animationDelay: '15ms' }}>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
            <Sparkles aria-hidden="true" className="h-4 w-4 text-roksal-amber" />
            Hitre predloge
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {/* R201 — onemogočene predloge brez projekta so razložene (ni mrtvih gumbov brez konteksta) */}
          {brezProjektov && (
            <p role="note" className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Info className="h-3 w-3 shrink-0" aria-hidden="true" />
              Predloge so na voljo, ko je izbran projekt.
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PREDLOGE.map((p) => {
              const Icon = p.ikona
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleApplyPredloga(p.id)}
                  disabled={!selectedProject}
                  className="flex flex-col items-start gap-1 rounded-lg border border-border/50 bg-secondary/30 p-2.5 text-left transition-all duration-150 hover:border-roksal-amber/40 hover:bg-roksal-amber/5 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                  aria-label={`Naloži predlogo meritev: ${p.naziv}`}
                  title="Naloži predlogo — zapolni vnosni obrazec z vrednostmi predloge"
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-roksal-amber" />
                    <span className="text-[11px] font-semibold text-roksal-ink leading-tight">{p.naziv}</span>
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
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
            <TrendingUp aria-hidden="true" className="h-4 w-4" />
            Povzetek meritev
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Skupna dolžina</p>
              <p className="text-[11px] font-bold text-roksal-ink leading-tight">{formatMultiUnit(totalLength)}</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Povpr. višina</p>
              <p className="text-[11px] font-bold text-roksal-ink leading-tight">{formatMultiUnit(Math.round(avgHeight))}</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Meritev</p>
              <p className="text-sm font-bold text-roksal-ink">{measurements.length}</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Segmentov</p>
              <p className="text-sm font-bold text-roksal-ink">{allSegments.length}</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Najdaljša</p>
              <p className="text-[11px] font-bold text-roksal-ink leading-tight">
                {longestMeasurement ? formatMultiUnit(longestMeasurement.dolzinaMm) : '—'}
              </p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Površina</p>
              <p className="text-sm font-bold text-roksal-ink">{formatM2(totalArea)}</p>
            </div>
          </div>
          {/* P1 — števci statusov (R235 P1-f: UI površine gray → žetoni — en
              razred obe temi, 0 novih hex; 'Potrjene' ostane semantična zelena;
              ARHIVIRANA line-through = semantika arhiva, R234 pravilo) */}
          <Separator className="my-2.5" />
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted border border-border p-2 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Osnutki</p>
              <p className="text-sm font-bold text-muted-foreground">{statusCounts.OSNUTEK}</p>
            </div>
            <div className="rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 p-2 text-center">
              <p className="text-[9px] text-green-600 dark:text-green-400 uppercase tracking-wide">Potrjene</p>
              <p className="text-sm font-bold text-green-700 dark:text-green-300">{statusCounts.POTRJENA}</p>
            </div>
            <div className="rounded-lg bg-muted border border-border p-2 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Arhivirane</p>
              <p className="text-sm font-bold text-muted-foreground line-through">{statusCounts.ARHIVIRANA}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* HITRI ZAČETEK — quick-add tipi meritev (NEW) */}
      <Card className="card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
        <CardContent className="p-3">
          <p className="text-2xs font-medium text-muted-foreground uppercase tracking-wide mb-2 px-1">
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
                  className={`flex flex-col items-center justify-center gap-1 rounded-lg border p-2.5 transition-all duration-150 active:scale-[0.96] hover:border-roksal-navy/40 dark:hover:border-roksal-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 ${tipMeritveColors[tip]}`}
                  aria-label={`Nova meritev: ${tipMeritveLabels[tip]}`}
                  title={`Hitro dodaj novo meritev vrste ${tipMeritveLabels[tip]} v ta projekt`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-2xs font-medium">{tipMeritveLabels[tip]}</span>
                </button>
              )
            })}
          </div>
          {/* P3 — napredne meritve (vogal, kot stopnice, stebriček) */}
          <Separator className="my-2.5" />
          <p className="text-2xs font-medium text-muted-foreground uppercase tracking-wide mb-2 px-1">
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
                  className={`flex flex-col items-center justify-center gap-1 rounded-lg border p-2.5 transition-all duration-150 active:scale-[0.96] hover:border-roksal-navy/40 dark:hover:border-roksal-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 ${tipMeritveColors[tip]}`}
                  aria-label={`Nova meritev: ${tipMeritveLabels[tip]}`}
                  title={`Hitro dodaj novo meritev vrste ${tipMeritveLabels[tip]} v ta projekt`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-2xs font-medium">{tipMeritveLabels[tip]}</span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* P3 — PRIMARNA ENOTA ZA PRIKAZ (pills) */}
      <Card className="card-hover transition-all duration-200 animate-fade-in-up border-roksal-navy/15 dark:border-roksal-ink/15">
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <ArrowRightLeft aria-hidden="true" className="h-4 w-4 text-roksal-ink" />
              <div>
                <p className="text-xs font-medium text-roksal-ink">Primarna enota za prikaz</p>
                <p className="text-[9px] text-muted-foreground">Vpliva na vse prikaze dimenzij</p>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-secondary/30 p-0.5">
              {(['mm', 'cm', 'm'] as EnotaTip[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setPrimaryUnit(u)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-all duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 ${
                    primaryUnit === u
                      ? 'bg-roksal-navy text-white shadow-sm'
                      : 'text-muted-foreground hover:text-roksal-ink'
                  }`}
                  aria-label={`Nastavi glavno enoto: ${enotaLabels[u]}`}
                  title="Glavna enota vseh vnosnih in prikaznih polj meritev"
                >
                  {enotaLabels[u]}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2 rounded-md bg-roksal-amber/5 border border-roksal-amber/15 p-2 text-center">
            <p className="text-2xs text-muted-foreground uppercase tracking-wide">Predogled</p>
            <p className="text-sm font-bold text-roksal-ink">
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
                className="flex w-full items-center justify-between p-4 text-left hover:bg-secondary/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:outline-none transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-roksal-amber text-white">
                    <Layers2 aria-hidden="true" className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-roksal-ink">Stopniščni čarovnik</span>
                    <p className="text-2xs text-muted-foreground">
                      Izračun stopnic, kota, dolžine kosa — z diagramom
                    </p>
                  </div>
                </div>
                {stairWizardOpen ? (
                  <ChevronUp aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
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
                    <Layers aria-hidden="true" className="inline h-3 w-3 mr-1" />
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
                      <p className="text-sm font-bold text-roksal-ink">
                        {Math.round(stairCalc.visinaPosamezne)}mm
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Kot stopnice</p>
                      <p className="text-sm font-bold text-roksal-ink">
                        {stairCalc.kotStopinje.toFixed(1)}°
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Dolžina kosa</p>
                      <p className="text-sm font-bold text-roksal-ink">
                        {Math.round(stairCalc.dolzinaKosa)}mm
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Skupna dolžina</p>
                      <p className="text-sm font-bold text-roksal-ink">
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
                    aria-label="Ustvari stopniščne meritve v izbrani segment"
                    title="Ustvari 5 meritev čarovnika (višina, globina, kot, kos, št. stopnic) v izbrani segment"
                    className="flex-1 h-9 bg-roksal-navy text-white hover:bg-roksal-navy/90 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                  >
                    <Plus aria-hidden="true" className="mr-1.5 h-4 w-4" />
                    Ustvari meritve
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveStairTemplate}
                    disabled={!stairCalc.valid}
                    className="h-9 px-3 border-roksal-amber/30 text-roksal-amber hover:bg-roksal-amber/10"
                  >
                    <Bookmark aria-hidden="true" className="mr-1.5 h-4 w-4" />
                    Shrani kot predlogo
                  </Button>
                </div>

                {/* Predloge */}
                {stairTemplates.length > 0 && (
                  <div className="rounded-lg border border-border/50 bg-secondary/20 p-2.5 space-y-1.5">
                    <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wide">
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
                            className="flex-1 text-left min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 rounded"
                            aria-label={`Naloži stopnično predlogo: ${t.naziv}`}
                            title="Naloži stopnično predlogo v vnosni obrazec"
                          >
                            <p className="text-[11px] font-medium text-roksal-ink truncate">{t.naziv}</p>
                            <p className="text-[9px] text-muted-foreground font-mono">
                              {t.skupnaVisinaMm}mm · {t.stStopnic} stopnic · {t.globinaStopniceMm}mm globine
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStairTemplate(t.id)}
                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-roksal-red/40"
                            title="Izbriši predlogo"
                            aria-label={`Izbriši predlogo ${t.naziv}`}
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-roksal-red" aria-hidden="true" />
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
              className="flex w-full items-center justify-between p-4 text-left hover:bg-secondary/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:outline-none transition-colors"
            >
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    calibration.pixelsPerMm
                      ? 'bg-roksal-amber text-white'
                      : 'bg-roksal-navy/10 text-roksal-ink'
                  }`}
                >
                  <Crosshair aria-hidden="true" className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-sm font-medium text-roksal-ink">Umeritev reference</span>
                  <p className="text-2xs text-muted-foreground">
                    {calibration.pixelsPerMm
                      ? `Umerjeno: ${calibration.pixelsPerMm.toFixed(2)} px/mm`
                      : 'A4 list, ploščica ali znana dolžina'}
                  </p>
                </div>
              </div>
              {calibrationOpen ? (
                <ChevronUp aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
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
                  <Crosshair aria-hidden="true" className="mr-1.5 h-4 w-4" />
                  Izračunaj umeritev
                </Button>
                {calibration.pixelsPerMm && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClearCalibration}
                    className="h-9 px-3 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                    aria-label="Počisti umeritev"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                )}
              </div>

              {calibration.pixelsPerMm && (
                <div className="rounded-lg border border-roksal-amber/30 bg-roksal-amber/8 p-2.5 text-center">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">
                    Aktivna umeritev
                  </p>
                  <p className="text-lg font-bold text-roksal-amber">
                    {calibration.pixelsPerMm.toFixed(2)} px/mm
                  </p>
                  <p className="text-2xs text-muted-foreground">
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
          className="flex w-full items-center justify-between p-4 text-left hover:bg-secondary/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:outline-none transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-roksal-navy text-white">
              <Plus aria-hidden="true" className="h-4 w-4" />
            </div>
            <div>
              <span className="text-sm font-medium text-roksal-ink">Nova meritev</span>
              <p className="text-2xs text-muted-foreground">
                Tip, oznaka, segment, dolžina, višina, opombe...
              </p>
            </div>
          </div>
          {formOpen ? (
            <ChevronUp aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {formOpen && (
          <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-3 slide-in-right">
            {/* R276 (O3/O4) — korekcijski pas: vidna resnica da shranjevanje
                ustvari NOVO verzijo (predhodnik ostane v zgodovini — nič
                prepisovanja); preklic je čist (nič shranjeno). */}
            {popravljaMeritev && (
              <div
                className="flex items-start justify-between gap-2 rounded-lg border border-roksal-navy/20 bg-roksal-navy/5 dark:border-roksal-ink/20 dark:bg-roksal-ink/10 px-2.5 py-2"
                role="status"
              >
                <div className="min-w-0">
                  <p className="text-2xs font-medium text-roksal-navy dark:text-roksal-ink">
                    Popravljanje verzije: „{popravljaMeritev.oznaka}"
                    {popravljaMeritev.verzija != null ? ` (v${popravljaMeritev.verzija})` : ' (legacy — brez oznake verzije)'}
                  </p>
                  <p className="text-3xs text-muted-foreground mt-0.5">
                    Shranjevanje ustvari NOVO verzijo v
                    {popravljaMeritev.verzija != null ? popravljaMeritev.verzija + 1 : 2}; obstoječa
                    meritev ostane nespremenjena v zgodovini (issue #16 §6).
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancelCorrection}
                  disabled={submitting}
                  className="h-6 shrink-0 text-2xs px-2"
                >
                  <X aria-hidden="true" className="h-3 w-3" />
                  Prekliči
                </Button>
              </div>
            )}
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
                  <Tag aria-hidden="true" className="inline h-3 w-3 mr-1" />
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
                <Layers aria-hidden="true" className="inline h-3 w-3 mr-1" />
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
                <MapPin aria-hidden="true" className="inline h-3 w-3 mr-1" />
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
                  <Ruler aria-hidden="true" className="inline h-3 w-3 mr-1" />
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
                  {micFor('length')}
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
                  <Ruler aria-hidden="true" className="inline h-3 w-3 mr-1 rotate-90" />
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
                  {micFor('height')}
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
                  <Hammer aria-hidden="true" className="inline h-3 w-3 mr-1" />
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
                    <p className="text-2xs text-muted-foreground">
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
                      className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-2xs font-medium transition-all duration-150 active:scale-[0.96] ${
                        voiceListening
                          ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 animate-pulse'
                          : voiceSupported
                            ? 'border-roksal-navy/20 dark:border-roksal-ink/20 bg-roksal-navy/5 text-roksal-ink hover:bg-roksal-navy/10'
                            : 'border-border bg-muted text-muted-foreground cursor-not-allowed'
                      }`}
                    >
                      <Mic aria-hidden="true" className="h-3 w-3" />
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
                <p className="text-2xs text-muted-foreground italic truncate">
                  <Mic aria-hidden="true" className="inline h-2.5 w-2.5 mr-1" />
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
                className="h-9 px-3 text-[11px] gap-1.5 shrink-0 transition-colors focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                onClick={() => toast.info('LiDAR skeniranje bo kmalu na voljo')}
                aria-label="LiDAR skeniranje meritev — kmalu na voljo"
                title="LiDAR skeniranje meritev (iskren stub — funkcija bo kmalu na voljo)"
              >
                <Scan aria-hidden="true" className="h-3.5 w-3.5" />
                Scaniraj
              </Button>
              <Button
                type="button"
                onClick={handleSubmitMeasurement}
                className="flex-1 h-9 bg-roksal-navy hover:bg-roksal-navy/90 text-white press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                disabled={submitting || !formLength || !formHeight}
                title={
                  popravljaMeritev
                    ? 'Shrani novo verzijo — predhodna meritev ostane v zgodovini (korekcijska veriga)'
                    : 'Shrani vneseno meritev v izbrani projekt'
                }
              >
                {submitting ? (
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Shranjujem...
                  </span>
                ) : (
                  <>
                    <Plus aria-hidden="true" className="mr-1.5 h-4 w-4" />
                    {popravljaMeritev ? 'Shrani kot novo verzijo' : 'Shrani meritev'}
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
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
              <Layers aria-hidden="true" className="h-4 w-4" />
              Segmenti
              <Badge variant="secondary" className="text-2xs h-5 px-1.5">
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
              <Plus aria-hidden="true" className="h-3 w-3" />
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
                  <Save aria-hidden="true" className="mr-1 h-3 w-3" />
                  Shrani
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 px-3 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                  onClick={() => setAddSegmentOpen(false)}
                  aria-label="Zapri dodajanje segmenta"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}

          {allSegments.length === 0 ? (
            <div className="py-6 text-center">
              <Layers aria-hidden="true" className="mx-auto h-7 w-7 text-muted-foreground/30" />
              <p className="mt-2 text-xs text-muted-foreground">Brez segmentov</p>
              <p className="text-2xs text-muted-foreground/60 mt-1">
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
                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-roksal-navy/10 text-roksal-ink">
                              <Layers aria-hidden="true" className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-roksal-ink truncate">{seg.name}</p>
                              <p className="text-2xs text-muted-foreground">
                                {segmentTypeLabels[seg.type]} • {stats?.count || 0} meritev
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <p className="text-xs font-mono font-bold text-roksal-ink">
                                {formatDimension(stats?.totalLength || 0)}
                              </p>
                              <p className="text-[9px] text-muted-foreground">
                                povpr. {formatDimension(Math.round(stats?.avgHeight || 0))}
                              </p>
                            </div>
                            {isOpen ? (
                              <ChevronUp aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
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
                            className="w-full rounded-lg border border-dashed border-roksal-navy/30 dark:border-roksal-ink/30 py-1.5 text-2xs text-roksal-ink hover:bg-roksal-navy/5 transition-colors"
                          >
                            <Plus aria-hidden="true" className="inline h-3 w-3 mr-1" />
                            Dodaj meritev v ta segment
                          </button>
                          {/* P3 — dodaj stebriček v ta segment — R356 val 39:
                              vidno besedilo NE razlaga CILJA (odpre formo,
                              že tarčno na ta segment) → aria akcija+cilj +
                              title + izrecen ring navy/40 (LEKCIJA R346
                              kanon; 0 novih hex). */}
                          <button
                            type="button"
                            onClick={() => {
                              setStebriSegmentId(seg.id)
                              setStebriFormOpen(true)
                            }}
                            aria-label={`Dodaj stebriček v segment ${seg.name}`}
                            title={`Odpre formo za novega stebrička, že tarčno na segment ${seg.name}`}
                            className="w-full rounded-lg border border-dashed border-roksal-amber/40 py-1.5 text-2xs text-roksal-amber hover:bg-roksal-amber/5 transition-colors focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                          >
                            <Columns3 aria-hidden="true" className="inline h-3 w-3 mr-1" />
                            Dodaj stebriček v ta segment
                          </button>
                          {/* P3 — dodaj WPC palice za WPC segmente */}
                          {(seg.type === 'WPC_POKOCNE' ||
                            seg.type === 'WPC_VODORAVNE' ||
                            seg.type === 'WPC_POSEVNE') && (
                            <button
                              type="button"
                              onClick={() => handleAddWpcPaliceAsStebri(seg)}
                              aria-label={`Dodaj izračunane WPC palice kot meritve v segment ${seg.name}`}
                              title={`Izračuna št. WPC palic iz meritev segmenta ${seg.name} in jih doda kot meritev STEBR`}
                              className="w-full rounded-lg border border-dashed border-roksal-amber/50 py-1.5 text-2xs text-roksal-ink hover:bg-roksal-amber/10 transition-colors focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                            >
                              <Fence aria-hidden="true" className="inline h-3 w-3 mr-1" />
                              Dodaj WPC palice kot materiale
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteSegment(seg.id)}
                            className="w-full rounded-lg border border-dashed border-roksal-red/30 py-1 text-2xs text-roksal-red hover:bg-roksal-red/5 transition-colors"
                          >
                            <Trash2 aria-hidden="true" className="inline h-3 w-3 mr-1" />
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
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                <Columns3 aria-hidden="true" className="h-4 w-4 text-roksal-amber" />
                Nov stebriček (S{getNextStebriNumber(measurements, stebriSegmentId || undefined)})
              </CardTitle>
              <button
                type="button"
                onClick={() => setStebriFormOpen(false)}
                className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                aria-label="Zapri formo za nov stebriček"
              >
                <X className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3 slide-in-right">
            {/* Segment */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                <Layers aria-hidden="true" className="inline h-3 w-3 mr-1" />
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
                <Ruler aria-hidden="true" className="inline h-3 w-3 mr-1 rotate-90" />
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
              title="Dodaj meritve STEBR z izračunom pozicije in vrstno oznako"
              className="w-full h-9 bg-roksal-amber text-white hover:bg-roksal-amber/90 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
            >
              <Plus aria-hidden="true" className="mr-1.5 h-4 w-4" />
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
        <Card className="card-hover animate-fade-in-up border-roksal-amber/40">
          <Collapsible open={wpcConfigOpen} onOpenChange={setWpcConfigOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between p-4 text-left hover:bg-secondary/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:outline-none transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-roksal-amber text-roksal-navy">
                    <Fence aria-hidden="true" className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-roksal-ink">WPC konfiguracija</span>
                    <p className="text-2xs text-muted-foreground">
                      Dimenzije palic, razmak, kot poševnih
                    </p>
                  </div>
                </div>
                {wpcConfigOpen ? (
                  <ChevronUp aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
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
                  <div className="rounded-lg border border-roksal-amber/40 bg-roksal-amber/10 p-2.5 text-2xs text-roksal-ink flex items-center gap-1.5">
                    <AlertCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    Razmik {wpcRazmikPalic}mm presega 110mm — preverite skladnost s predpisi!
                  </div>
                )}
                {wpcRazmikPalic <= 110 && (
                  <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40 p-2.5 text-2xs text-green-700 dark:text-green-300 flex items-center gap-1.5">
                    <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    Razmik {wpcRazmikPalic}mm ustreza predpisom (≤110mm)
                  </div>
                )}
                <p className="text-2xs text-muted-foreground text-center">
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
          <p className="text-lg font-bold text-roksal-ink">{measurements.length}</p>
        </Card>
        <Card className="px-2 py-2.5 card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '180ms' }}>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Stebri</p>
          <p className="text-lg font-bold text-roksal-ink">{totalPosts || '—'}</p>
        </Card>
        <Card className="px-2 py-2.5 card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '210ms' }}>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">LiDAR</p>
          <p className="text-lg font-bold text-roksal-ink">{lidarScans}</p>
        </Card>
        <Card className="px-2 py-2.5 card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '240ms' }}>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Skupaj</p>
          <p className="text-lg font-bold text-roksal-ink">{(totalLength / 1000).toFixed(1)}m</p>
        </Card>
      </div>

      {/* Average Dimensions Card (existing) */}
      {measurements.length > 0 && (
        <Card className="card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '270ms' }}>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
              <TrendingUp aria-hidden="true" className="h-4 w-4" />
              Povprečne dimenzije
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-roksal-navy/10">
                  <Ruler aria-hidden="true" className="h-4 w-4 text-roksal-ink" />
                </div>
                <div>
                  <p className="text-xs font-medium text-roksal-ink">
                    {formatDimension(Math.round(avgLength))}
                  </p>
                  <p className="text-2xs text-muted-foreground">Povpr. dolžina</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-roksal-navy/10">
                  <Ruler aria-hidden="true" className="h-4 w-4 text-roksal-amber rotate-90" />
                </div>
                <div>
                  <p className="text-xs font-medium text-roksal-ink">
                    {formatDimension(Math.round(avgHeight))}
                  </p>
                  <p className="text-2xs text-muted-foreground">Povpr. višina</p>
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
            <Filter aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
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
                      ? 'bg-muted-foreground text-white border-muted-foreground'
                      : 'bg-muted text-muted-foreground border-border'
                    : f === 'POTRJENA'
                      ? isActive
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                      : isActive
                        ? 'bg-muted-foreground text-white border-muted-foreground'
                        : 'bg-muted text-muted-foreground border-border'
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatusFilter(f)}
                  aria-pressed={isActive}
                  aria-label={`Filtriraj po statusu: ${label} (${count})`}
                  title={`Pokaži meritve statusa ${label} (${count})`}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium transition-all duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 ${color}`}
                >
                  {label}
                  <span className="rounded-full bg-black/10 px-1 text-[9px]">{count}</span>
                </button>
              )
            })}
            {/* MERITVE-PRO — Foto mere filter pill */}
            <button
              type="button"
              onClick={() => setFotoFilterActive(!fotoFilterActive)}
              aria-pressed={fotoFilterActive}
              aria-label="Foto mere filter: prikaži samo meritve zajete na foto zavihku"
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium transition-all duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 ${
                fotoFilterActive
                  ? 'bg-roksal-amber text-white border-roksal-amber'
                  : 'bg-roksal-amber/5 text-roksal-amber border-roksal-amber/30 hover:bg-roksal-amber/10'
              }`}
              title="Filtriraj samo mere iz foto zavihka"
            >
              <Camera aria-hidden="true" className="h-3 w-3" />
              Foto mere
              <span className="rounded-full bg-black/10 px-1 text-[9px]">{fotoMeasurementsCount}</span>
            </button>
            {/* R186 — izvoz vidnih meritev (isto mesto kot zaloga CSV gumb) */}
            <button
              type="button"
              onClick={izvoziMeritveCsv}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-border/50 bg-secondary/50 px-2 py-1 text-2xs font-medium text-muted-foreground transition-all duration-150 active:scale-[0.96] hover:text-roksal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
              aria-label="Izvozi vidne meritve kot CSV"
              title="Izvozi vidne meritve (upošteva filter) kot CSV za Excel"
            >
              <Download aria-hidden="true" className="h-3 w-3" />
              CSV
            </button>
            {/* R203 — povzetek vidnih meritev v odložišče (SMS/WhatsApp) —
                isti seznam kot CSV (IZVOŽENO = ZASLON), samo človeška oblika. */}
            <button
              type="button"
              onClick={() => void kopirajMeritvePovzetek()}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-border/50 bg-secondary/50 px-2 py-1 text-2xs font-medium text-muted-foreground transition-all duration-150 active:scale-[0.96] hover:text-roksal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
              aria-label="Kopiraj povzetek vidnih meritev v odložišče"
              title="Kopiraj vidne meritve (upošteva filter) kot besedilo za SMS/WhatsApp"
            >
              <Copy aria-hidden="true" className="h-3 w-3" />
              Povzetek
            </button>
            {/* R269 — terenski pregled PDF (25. člen 'izvozi' družine): VEDNO
                viden, ko je projekt izbran (NI gated na filteredMeasurements
                .length — pariteta R263–R268; brez projekta ni FRESH vira —
                podatek-scope, ne pravica); press-scale + dvoklik guard +
                FileDown aria-hidden (družinski kontrakt). */}
            {selectedProject && (
              <button
                type="button"
                onClick={() => void handleTerenPdf()}
                disabled={pdfVteku}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-border/50 bg-secondary/50 px-2 py-1 text-2xs font-medium text-muted-foreground transition-all duration-150 press-scale active:scale-[0.96] hover:text-roksal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                aria-label="Izvozi terenski pregled meritev kot PDF"
                title="Terenski pregled meritev kot pravi PDF — VSE meritve projekta (tudi arhivirane)"
              >
                {pdfVteku ? (
                  <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
                ) : (
                  <FileDown aria-hidden="true" className="h-3 w-3" />
                )}
                PDF
              </button>
            )}
            {/* R284 — terenski zapisni list PDF (issue #15 §3, worklog i5):
                IZPOLNJEVALNI list — zapisana resnica + PRAZNI fizični
                stolpci (Fizična ref./Δ/Zapiski) za lastniško akcijo na
                terenu (docs/AR-FIELD-VALIDATION.md §3). Pariteta R269 gumba:
                press-scale + dvoklik guard + FileText aria-hidden
                (družinski kontrakt); hover title pariteta kanon R280–R283. */}
            {selectedProject && (
              <button
                type="button"
                onClick={() => void handleZapisniListPdf()}
                disabled={zapisniVteku}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-border/50 bg-secondary/50 px-2 py-1 text-2xs font-medium text-muted-foreground transition-all duration-150 press-scale active:scale-[0.96] hover:text-roksal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                aria-label="Izvozi terenski zapisni list kot PDF"
                title="Terenski zapisni list (issue #15 §3) — zapisane mere + prazni stolpci za fizično validacijo na terenu"
              >
                {zapisniVteku ? (
                  <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
                ) : (
                  <FileText aria-hidden="true" className="h-3 w-3" />
                )}
                ZAPISNI LIST
              </button>
            )}
            {/* R285 — terenski zapisni list CSV (issue #15 §3, worklog i5b):
                DIGITALNO izpolnjevanje v Excelu — ISTA zapisana resnica + ISTI
                prazni fizični stolpci (fizicna_ref_mm/delta_mm/zapiski_terena)
                kot R284 PDF; pariteta R186 arhiva po konstrukciji (EN VIR
                meritevVrstica). Pariteta R284 gumba: press-scale + dvoklik
                guard + FileSpreadsheet aria-hidden (družinski kontrakt);
                hover title pariteta kanon R280–R284. */}
            {selectedProject && (
              <button
                type="button"
                onClick={() => void handleZapisniListCsv()}
                disabled={zapisniCsvVteku}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-border/50 bg-secondary/50 px-2 py-1 text-2xs font-medium text-muted-foreground transition-all duration-150 press-scale active:scale-[0.96] hover:text-roksal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                aria-label="Izvozi terenski zapisni list kot CSV"
                title="Terenski zapisni list kot CSV (issue #15 §3) — ista zapisana resnica + prazni stolpci fizicna_ref_mm/delta_mm/zapiski_terena za digitalno izpolnjevanje v Excelu"
              >
                {zapisniCsvVteku ? (
                  <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
                ) : (
                  <FileSpreadsheet aria-hidden="true" className="h-3 w-3" />
                )}
                ZAPISNI LIST CSV
              </button>
            )}
            <div className="flex-1" />
            {/* Bulk mode toggle */}
            <button
              type="button"
              onClick={() => {
                setBulkMode(!bulkMode)
                if (bulkMode) setSelectedIds(new Set())
              }}
              className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-2xs font-medium transition-all duration-150 active:scale-[0.96] ${
                bulkMode
                  ? 'bg-roksal-navy text-white border-roksal-navy'
                  : 'bg-secondary/50 text-muted-foreground border-border/50 hover:bg-secondary'
              }`}
              title="Skupinski način — masovno izbiranje meritev za skupinske akcije (potrdi/arhiviraj)"
            >
              {bulkMode ? <CheckSquare aria-hidden="true" className="h-3 w-3" /> : <Square aria-hidden="true" className="h-3 w-3" />}
              Skupinsko
            </button>
          </div>

          {/* R269 — legenda pill pariteta (družina R263–R268): poimenuje kaj
              nosi dokument — VSE meritve izbranega projekta (FRESH ob kliku,
              ne filtrirani state); VEDNO vidna, ko je projekt izbran
              (pariteta s pillom). */}
          {selectedProject && (
            <p className="text-2xs text-muted-foreground">
              PDF = VSE meritve projekta (tudi arhivirane — polna resnica, ne samo viden seznam filtrov) · ZAPISNI LIST = zapisane mere + prazni stolpci za fizično validacijo (issue #15 §3 — fizične mere zapisuje lastnik na terenu) · ZAPISNI LIST CSV = ista resnica v Excelu — prazni fizični stolpci za digitalno izpolnjevanje (issue #15 §3, pariteta z R186 arhivom)
            </p>
          )}

          {/* R269 — F2 mini-vrstica stanja meritev (WYSIWYG ISTA izpeljava
              meritevTerenPregled kot PDF KPI + sklep + toast — ENA izpeljava):
              state (viden seznam po filtrih) = kar uporabnik vidi, FRESH =
              polna resnica projekta (dve okni, ENA matemtika); dot
              roksal-amber/green — AMBER kadar osnutki čakajo potrditev;
              kondicionalni žeton ŽIVO samo kadar > 0 — R256 lekcija 4;
              tabular-nums; 0 novih hex. */}
          {/* R274 a11y: role="status" — async mini resnica oznanjena bralniku. */}
          {/* R283 MANDATORY STIL: hover parity — R269 mini je imela brez
              title (R282 sync mini jo ima) → parity kanon R280/R281/R282:
              cursor-help + title (WYSIWYG razlaga + R153 cikel); žeton
              title (osnutki = čakajo potrditev). 0 novih hex. */}
          {selectedProject && terenPovzetek !== null && (
            <div role="status" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span
                aria-hidden="true"
                className={`h-2 w-2 shrink-0 rounded-full ${terenPovzetek.osnutkov > 0 ? 'bg-roksal-amber' : 'bg-roksal-green'}`}
              />
              <span
                className="tabular-nums cursor-help"
                title="Števec stanj vidnega seznama (WYSIWYG — R269): state = viden seznam po filtrih (kar uporabnik vidi), FRESH = polna resnica projekta — dve okni, ENA matemtika. Osnutki čakajo potrditev; potrjene/arhivirane nosi življenjski cikel R153."
              >
                Meritve (viden seznam): {terenPovzetek.meritev} {meritvePovzetekBeseda(terenPovzetek.meritev)} · osnutki {terenPovzetek.osnutkov} · potrjenih {terenPovzetek.potrjenih} · arhiviranih {terenPovzetek.arhiviranih}
              </span>
              {terenPovzetek.osnutkov > 0 && (
                <span
                  className="rounded-full border border-roksal-amber/40 bg-roksal-amber/10 px-2 py-0.5 text-2xs font-medium text-roksal-amber cursor-help"
                  title="Osnutki — meritve v stanju OSNUTEK čakajo potrditev (R153 življenjski cikel); potrditev prek akcij vrstice meritve."
                >
                  {osnutekBeseda(terenPovzetek.osnutkov)}
                </span>
              )}
            </div>
          )}

          {/* R282 (issue #16 §10, V3) — F2 sync mini-vrstica: števec sync
              metadata vidnega seznama — prikazana SAMO kadar vsaj ena vrstica
              nosi sync metadata (iskrena praznina = brez vrstice); konflikti
              > 0 = rdeča pika + akcijski žig (osveži bazo in ponovi sync —
              obstoječi /api/sync razreši), čakajoči > 0 = amber, sicer green;
              hover title parity (0 novih hex — ulomki že v datoteki). */}
          {selectedProject && terenPovzetek !== null && syncPregled !== null && (
            <div role="status" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span
                aria-hidden="true"
                className={`h-2 w-2 shrink-0 rounded-full ${syncPregled.konfliktov > 0 ? 'bg-roksal-red' : syncPregled.cakajocih > 0 || syncPregled.napak > 0 ? 'bg-roksal-amber' : 'bg-roksal-green'}`}
              />
              <span
                className="tabular-nums cursor-help"
                title="Sinhronizacijsko stanje vidnega seznama (issue #16 §10): števec sync metadata iz kontrakta — opazovano stanje klienta (provenance), NI sync resnica; revizije in konflikte razrešuje obstoječi /api/sync (strežnik ne zaupa klientu). Grobnice = lokalno označeno za brisanje (tombstone)."
              >
                Sync (viden seznam): {syncPregled.sinhroniziranih} sinhroniziranih · {syncPregled.cakajocih} čakajoči · {syncPregled.konfliktov} konfliktov · {syncPregled.napak} napak{syncPregled.grobnic > 0 ? ` · ${syncPregled.grobnic} grobnic` : ''}
              </span>
              {syncPregled.konfliktov > 0 && (
                <span
                  className="rounded-full border border-roksal-red/40 bg-roksal-red/10 px-2 py-0.5 text-2xs font-medium text-roksal-red cursor-help"
                  title="Odprti sync konflikt (issue #16 §10): ista meritev spremenjena na dveh straneh — obstoječi /api/sync je zavrpnil star baseRevision (strežnik ne ugiba); obe verziji ohranjeni. Osveži bazo (GET delta) in ponovi sync."
                >
                  Konflikt — osveži bazo in ponovi sync
                </span>
              )}
            </div>
          )}

          {/* R283 (issue #15 §3) — F3 vir pokritost mini-vrstica: števec
              strežniško izpeljanih virov vidnega seznama (EN VIR
              filteredMeasurements — ISTI seznam kot R269 mini + R282 sync
              mini); prikazana SAMO kadar vsaj ena vrstica nosi prepoznan
              vir (iskrena praznina = brez vrstice — nikoli izumljen
              števec); popolna pokritost (MANUAL + PHOTO_CV + ARCORE_DEPTH)
              = green pika, delna = amber — terenska validacija (#15)
              zahteva isti test prek VSEH treh virov; hover title parity
              (0 novih hex — ulomki že v datoteki). */}
          {selectedProject && terenPovzetek !== null && virPregled !== null && (
            <div role="status" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span
                aria-hidden="true"
                className={`h-2 w-2 shrink-0 rounded-full ${virPregled.popolnaPokritost ? 'bg-roksal-green' : 'bg-roksal-amber'}`}
              />
              <span
                className="tabular-nums cursor-help"
                title="Pokritost virov vidnega seznama (issue #15 §3): števec strežniško izpeljanih virov po skupnem kontraktu — ročni vnos (MANUAL), foto-CV (PHOTO_CV), AR-Depth (ARCORE_DEPTH). Zelena pika = vse tri vrste prisotne; amber = samo del — terenska validacija (issue #15) zahteva isti test prek vseh treh virov. Vrstice brez prepoznanega viroma se ne štejejo (fail-closed — nič ugibanja)."
              >
                Viri (viden seznam): {virPregled.manual} ročnih · {virPregled.photoCv} foto-CV · {virPregled.arcoreDepth} AR-Depth
              </span>
            </div>
          )}

          {/* Bulk toolbar (prikaže se samo v bulk mode z izborom) */}
          {bulkMode && (
            <div className="rounded-lg border border-roksal-navy/20 dark:border-roksal-ink/20 bg-roksal-navy/5 p-2.5 space-y-2 slide-in-right">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleBulkSelectAll}
                    className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-2xs font-medium hover:bg-secondary/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                    aria-label="Izberi vse vidne meritve za skupinske akcije"
                    title="Izberi vse meritve vidnega (filtriranega) seznama"
                  >
                    <CheckSquare aria-hidden="true" className="h-3 w-3" />
                    Izberi vse
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkClear}
                    className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-2xs font-medium hover:bg-secondary/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                    aria-label="Počisti izbor izbranih meritev"
                    title="Odizbori vse izbrane meritve"
                  >
                    <Square aria-hidden="true" className="h-3 w-3" />
                    Počisti
                  </button>
                  <Badge variant="secondary" className="text-2xs h-5 px-1.5">
                    {selectedIds.size} izbrane
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={handleBulkExportCSV}
                  disabled={selectedIds.size === 0}
                  className="flex items-center justify-center gap-1 rounded-md border border-roksal-navy/20 dark:border-roksal-ink/20 bg-background px-2 py-1 text-2xs font-medium text-roksal-ink hover:bg-roksal-navy/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                  aria-label="Izvozi izbrane meritve kot CSV"
                  title="Izvozi samo izbrane meritve kot CSV za Excel"
                >
                  <Download aria-hidden="true" className="h-3 w-3" />
                  Izvozi izbrane CSV
                </button>
                <div className="flex items-center gap-1">
                  <Select value={bulkCopyTarget} onValueChange={setBulkCopyTarget}>
                    <SelectTrigger className="h-7 text-2xs flex-1">
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
                    className="flex items-center gap-1 rounded-md border border-roksal-amber/30 bg-roksal-amber/10 px-2 py-1 text-2xs font-medium text-roksal-amber hover:bg-roksal-amber/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                    aria-label="Kopiraj izbrane meritve v ciljni segment"
                    title="Kopiraj izbrane meritve v izbrani ciljni segment"
                  >
                    <Copy aria-hidden="true" className="h-3 w-3" />
                    Kopiraj
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setBulkDeleteOpen(true)}
                  disabled={selectedIds.size === 0}
                  className="flex items-center justify-center gap-1 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-2 py-1 text-2xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                  aria-label="Izbriši izbrane meritve"
                  title="Trajno izbriši vse izbrane meritve"
                >
                  <Trash2 aria-hidden="true" className="h-3 w-3" />
                  Izbriši izbrane
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Primerjava: Stranka vs merilec ──────────────────────────────
          Vidna samo, kadar projekt ima strankino samomeritev (source=
          'customer-map' iz javne povezave /m/[token]). Vodja takoj vidi,
          kako zanesljiva je strankina ocena dolžine — pomaga pri pripravi
          ponudbe še pred odhodom na teren. */}
      {strankaPrimerjava && (
        <Card
          className="overflow-hidden card-hover animate-fade-in-up border-l-4 border-l-roksal-amber bg-gradient-to-br from-roksal-amber/5 to-transparent"
          style={{ animationDelay: '250ms' }}
        >
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-roksal-amber/15">
                  <UserRound aria-hidden="true" className="h-4 w-4 text-roksal-amber"  />
                </span>
                Stranka vs merilec
              </CardTitle>
              <Badge variant="outline" className={cn('gap-1 text-2xs font-medium', strankaPrimerjava.verdict.cls)}>
                <strankaPrimerjava.verdict.icon className="h-3 w-3" aria-hidden />
                {strankaPrimerjava.verdict.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4">
            {/* Glavni kazalniki: merilec ↔ delta ↔ stranka */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
              <div className="rounded-lg border border-roksal-navy/15 dark:border-roksal-ink/15 bg-card px-2.5 py-2 text-center">
                <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Merilec</p>
                <p className="text-base font-bold text-roksal-ink sm:text-lg">
                  {strankaPrimerjava.merilecSkupajMm > 0 ? formatMultiUnit(strankaPrimerjava.merilecSkupajMm) : '—'}
                </p>
                <p className="text-[9px] text-muted-foreground">
                  {strankaPrimerjava.merilecCount > 0 ? `${strankaPrimerjava.merilecCount} meritev` : 'š ni uradnih meritev'}
                </p>
              </div>
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-2xs font-bold',
                    strankaPrimerjava.deltaPct == null
                      ? 'bg-muted text-muted-foreground'
                      : Math.abs(strankaPrimerjava.deltaPct) <= 5
                        ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : Math.abs(strankaPrimerjava.deltaPct) <= 15
                          ? 'bg-roksal-amber/10 text-roksal-ink'
                          : 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300',
                  )}
                >
                  {strankaPrimerjava.deltaPct == null
                    ? 'n/a'
                    : `${strankaPrimerjava.deltaPct > 0 ? '+' : ''}${strankaPrimerjava.deltaPct.toFixed(1)} %`}
                </span>
                <span className="mt-0.5 text-3xs text-muted-foreground">razlika</span>
              </div>
              <div className="rounded-lg border border-roksal-amber/30 bg-roksal-amber/10 px-2.5 py-2 text-center">
                <p className="flex items-center justify-center gap-1 text-[9px] font-medium uppercase tracking-wide text-roksal-amber">
                  <UserRound aria-hidden="true" className="h-2.5 w-2.5"  /> Stranka
                </p>
                <p className="text-base font-bold text-roksal-ink sm:text-lg">{formatMultiUnit(strankaPrimerjava.strankaSkupajMm)}</p>
                <p className="text-[9px] text-muted-foreground">
                  {strankaPrimerjava.customerMap.length} samomeritev{strankaPrimerjava.meta.tocke ? ` · ${strankaPrimerjava.meta.tocke} točk` : ''}
                </p>
              </div>
            </div>

            {/* Razproportionalni stolpci — vizualna primerjava dolžin */}
            {strankaPrimerjava.merilecSkupajMm > 0 && strankaPrimerjava.strankaSkupajMm > 0 && (
              <div className="space-y-1.5" aria-hidden>
                {(() => {
                  const max = Math.max(strankaPrimerjava.merilecSkupajMm, strankaPrimerjava.strankaSkupajMm)
                  const wM = (strankaPrimerjava.merilecSkupajMm / max) * 100
                  const wS = (strankaPrimerjava.strankaSkupajMm / max) * 100
                  return (
                    <>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-roksal-navy/80 transition-all duration-500"
                          style={{ width: `${wM}%` }}
                        />
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-roksal-amber to-roksal-amber/60 transition-all duration-500"
                          style={{ width: `${wS}%` }}
                        />
                      </div>
                    </>
                  )
                })()}
              </div>
            )}

            {/* Kontakt + opomba stranke */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-muted/50 px-2.5 py-1.5 text-2xs text-muted-foreground">
              {strankaPrimerjava.meta.imeStranke && (
                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                  <UserRound aria-hidden="true" className="h-3 w-3"  />
                  {strankaPrimerjava.meta.imeStranke}
                </span>
              )}
              {strankaPrimerjava.meta.telefonStranke && (
                <a
                  href={`tel:${strankaPrimerjava.meta.telefonStranke.replace(/\s+/g, '')}`}
                  className="inline-flex items-center gap-1 text-roksal-ink underline-offset-2 hover:underline"
                >
                  <Phone aria-hidden="true" className="h-3 w-3"  />
                  {strankaPrimerjava.meta.telefonStranke}
                </a>
              )}
              <span className="ml-auto inline-flex items-center gap-1">
                <Clock aria-hidden="true" className="h-3 w-3"  />
                prejeto {slDatumOkrajsava(new Date(strankaPrimerjava.zadnja))}
              </span>
            </div>
            {strankaPrimerjava.meta.opombaStranke && (
              <p className="rounded-lg border border-dashed border-roksal-amber/40 bg-card px-2.5 py-1.5 text-[11px] italic text-muted-foreground">
                „{strankaPrimerjava.meta.opombaStranke}“
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* R152 — Lokalni osnutki (iskreni offline podatki, NI v bazi) */}
      {drafts.length > 0 && (
        <Card
          className="card-hover animate-fade-in-up border border-roksal-amber/40 bg-roksal-amber/5"
          style={{ animationDelay: '240ms' }}
          role="region"
          aria-label={`Lokalni osnutki: ${drafts.length} meritev ni sinhroniziranih z bazo`}
        >
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                <AlertTriangle className="h-4 w-4 text-roksal-amber" aria-hidden="true" />
                Lokalni osnutki — ni v bazi
                <Badge className="bg-roksal-amber/20 text-roksal-ink hover:bg-roksal-amber/20 tabular-nums">
                  {drafts.length}
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setDraftsOpen((o) => !o)}
                  aria-expanded={draftsOpen}
                  aria-label={draftsOpen ? 'Skrči seznam osnutkov' : 'Razširi seznam osnutkov'}
                  className="rounded-lg border border-roksal-navy/20 dark:border-roksal-ink/20 bg-roksal-navy/5 px-2 py-1 text-2xs font-medium text-roksal-ink hover:bg-roksal-navy/10 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 active:scale-[0.96] transition-all duration-150"
                >
                  {draftsOpen ? 'Skrči' : 'Razširi'}
                </button>
                <button
                  type="button"
                  onClick={syncAllDrafts}
                  disabled={syncingDrafts}
                  aria-label={`Sinhroniziraj vse osnutke (${drafts.length}) v bazo`}
                  title="Sinhroniziraj vse lokalne osnutke v bazo — zaporedno v determinističnem vrstnem redu"
                  className="flex items-center gap-1 rounded-lg bg-roksal-navy px-2.5 py-1 text-2xs font-semibold text-white hover:bg-roksal-navy/90 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 active:scale-[0.96] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CloudUpload className="h-3 w-3" aria-hidden="true" />
                  {syncingDrafts ? 'Sinhronizacija …' : 'Sinhroniziraj vse'}
                </button>
              </div>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              Te meritve <span className="font-semibold">NISO shranjene v bazo</span> (strežnik ob
              vnosu ni bil dosegljiv). Ohranjene so lokalno na tej napravi. Sinhronizirajte jih, ko
              je povezava spet na voljo.
            </p>
          </CardHeader>
          {draftsOpen && (
            <CardContent className="px-4 pb-4">
              <ul className="space-y-2">
                {[...drafts]
                  .sort((a, b) => (a.createdAt > b.createdAt ? 1 : a.createdAt < b.createdAt ? -1 : 0))
                  .map((d) => (
                    <li
                      key={d.draftId}
                      className="flex items-center justify-between gap-2 rounded-lg border border-roksal-amber/30 bg-white/70 dark:bg-card/60 px-3 py-2 transition-all hover:shadow-sm focus-within:ring-2 focus-within:ring-roksal-navy/30"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-roksal-ink">
                          {d.label || 'Meritev brez oznake'}
                        </p>
                        <p className="text-2xs text-muted-foreground tabular-nums">
                          {`${slDatumKratko(new Date(d.createdAt))}, ${slCasDolgo(new Date(d.createdAt))}`} · lokalni osnutek
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void syncSingleDraft(d).then((ok) => {
                            if (ok) toast.success(`Osnutek „${d.label}" sinhroniziran v bazo.`)
                            else toast.error(`Sinhronizacija osnutka „${d.label}" ni uspela — preverite povezavo.`)
                          })}
                          disabled={syncingDrafts}
                          aria-label={`Sinhroniziraj osnutek ${d.label || 'brez oznake'} v bazo`}
                          title="Pošlji shranjeno telo osnutka v bazo (neuspeh ostane lokalni osnutek)"
                          className="rounded-lg border border-roksal-navy/20 dark:border-roksal-ink/20 bg-roksal-navy/5 px-2 py-1 text-2xs font-medium text-roksal-ink hover:bg-roksal-navy/10 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 active:scale-[0.96] transition-all duration-150 disabled:opacity-50"
                        >
                          Sinhroniziraj
                        </button>
                        <button
                          type="button"
                          onClick={() => discardMeasurementDraft(d.draftId)}
                          aria-label={`Odstrani osnutek ${d.label || 'brez oznake'} (ni bil nikoli v bazi)`}
                          title="Odstrani lokalni osnutek — ni bil nikoli poslan v bazo"
                          className="rounded-lg border border-roksal-red/30 bg-roksal-red/5 p-1 text-roksal-red hover:bg-roksal-red/10 focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2 active:scale-[0.96] transition-all duration-150"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
            </CardContent>
          )}
        </Card>
      )}

      {/* Measurements List */}
      <Card className="card-hover animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-roksal-ink">Seznam meritev</CardTitle>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleExportCSV}
                className="flex items-center gap-1 rounded-lg border border-roksal-navy/20 dark:border-roksal-ink/20 bg-roksal-navy/5 px-2 py-1 text-2xs font-medium text-roksal-ink hover:bg-roksal-navy/10 active:scale-[0.96] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                aria-label="Izvozi vse meritve kot CSV"
                title="Izvozi VSE meritve projekta (brez filtra) kot CSV za Excel"
                disabled={loading || measurements.length === 0}
              >
                <Download aria-hidden="true" className="h-3 w-3" />
                CSV
              </button>
              <button
                type="button"
                onClick={handleExportPDF}
                className="flex items-center gap-1 rounded-lg border border-roksal-amber/30 bg-roksal-amber/10 px-2 py-1 text-2xs font-medium text-roksal-amber hover:bg-roksal-amber/20 active:scale-[0.96] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                aria-label="Izvozi pregled meritev kot PDF"
                title="Pregled vseh meritev projekta kot PDF za arhiv"
                disabled={loading || measurements.length === 0}
              >
                <FileText aria-hidden="true" className="h-3 w-3" />
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
                    <Calendar aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {group.label}
                    </span>
                    <div className="flex-1 h-px bg-border/50" />
                    <Badge variant="secondary" className="text-2xs h-5 px-1.5">
                      {group.measurements.length}
                    </Badge>
                  </div>
                  <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
                    {group.measurements.map((m) => renderMeasurementCard(m))}
                  </div>
                </div>
              ))}
            </div>
          ) : measurements.length === 0 ? (
            /* R201 — iskreno: brez projekta 'Dodaj meritev' ne more delovati,
               zato brez akcije (navidezni poziv = izmišljeni podatki UI). */
            brezProjektov ? (
              <EmptyState
                icon={FolderX}
                title="Meritve čakajo na projekt"
                description="Meritve se vežejo na projekt. Ko je projekt izbran, lahko zajameš prvo meritev."
              />
            ) : (
              <EmptyState
                icon={Ruler}
                title="Ni še meritev"
                description="Zajemi z AR kamero ali dodaj ročno."
                action={{ label: 'Dodaj meritev', onClick: () => setFormOpen(true) }}
              />
            )
          ) : (
            <div className="py-8 text-center">
              <Ruler aria-hidden="true" className="mx-auto h-8 w-8 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">Brez meritev v tem filtru</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">Spremenite filter statusa zgoraj</p>
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
              className="flex w-full items-center justify-between p-4 text-left hover:bg-secondary/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:outline-none transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-roksal-navy/10 text-roksal-ink">
                  <History aria-hidden="true" className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-sm font-medium text-roksal-ink">Zgodovina sprememb</span>
                  <p className="text-2xs text-muted-foreground">
                    {auditEntries.length === 0
                      ? 'Ni sprememb — zgodovina se zapiše ob prvih meritvah.'
                      : `${auditEntries.length} ${auditEntries.length === 1 ? 'sprememba' : 'sprememb'} • zadnjih ${Math.min(auditEntries.length, 20)} prikazanih`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-2xs h-5 px-1.5">
                  {auditEntries.length}
                </Badge>
                {auditOpen ? (
                  <ChevronUp aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-3 slide-in-right">
              {auditEntries.length === 0 ? (
                <div className="py-6 text-center">
                  <ClipboardList aria-hidden="true" className="mx-auto h-7 w-7 text-muted-foreground/30" />
                  <p className="mt-2 text-xs text-muted-foreground">Brez zgodovine sprememb</p>
                  <p className="text-2xs text-muted-foreground/60 mt-1">
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
                                <Clock aria-hidden="true" className="h-2.5 w-2.5 text-muted-foreground" />
                                <span className="text-2xs text-muted-foreground">
                                  {`${slDatumKratko(new Date(entry.timestamp))}, ${slCasDolgo(new Date(entry.timestamp))}`}
                                </span>
                                {/* R339 STIL val 25 — hover parity za revizijsko sled
                                    (isti vzorec kot R280 tip badge + R281 sync žig:
                                    title razložljivost EN VIR; 0 novih hex). */}
                                <Badge
                                  variant="outline"
                                  className="cursor-help text-3xs h-3.5 px-1 py-0"
                                  title={auditActionTitles[entry.akcija]}
                                >
                                  {auditActionLabels[entry.akcija]}
                                </Badge>
                              </div>
                              {entry.staraVrednost && entry.novaVrednost && (
                                <p className="text-2xs text-muted-foreground mt-0.5">
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
                      className="h-7 text-[11px] ml-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                      onClick={handleExportAuditCSV}
                      disabled={auditEntries.length === 0}
                      aria-label="Izvozi zgodovino meritev kot CSV"
                      title="Revizijska zgodovina meritev (akcije, statusi) kot CSV"
                    >
                      <FileSpreadsheet aria-hidden="true" className="mr-1 h-3 w-3" />
                      Izvozi zgodovino
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* P1 — POTRDITVENI DIALOG ZA SKUPINSKO ARHIVIRANJE (R153: perzistentno) */}
      <Dialog open={bulkDeleteOpen} onOpenChange={(o) => !bulkArchiveBusy && setBulkDeleteOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arhiviraj izbrane meritve?</DialogTitle>
            <DialogDescription>
              Izbrane meritve ({selectedIds.size}) bodo arhivirane — sprememba se SHRANI v bazo (z
              revizijsko sledjo). Arhivirane meritve niso izbrisane in jih lahko pozneje obnovite s
              klikom na statusni badge (potreben razlog). Želite nadaljevati?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkDeleteOpen(false)}
              disabled={bulkArchiveBusy}
              title="Zapri pogovorno okno — nič se ne arhivira, izbira meritev ostane"
              className="focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
            >
              Prekliči
            </Button>
            <Button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkArchiveBusy}
              aria-label="Potrdi arhiviranje izbranih meritev v bazo"
              title="Zaporedno arhiviraj izbrane meritve — že arhivirane se štejejo kot opravljene (idempotentno)"
              className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
            >
              <Archive aria-hidden="true" className="mr-1.5 h-4 w-4" />
              {bulkArchiveBusy ? 'Arhiviranje …' : `Arhiviraj (${selectedIds.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* R153 (§19) — DIALOG: ponovno odprtje arhivirane meritve (obvezna opomba) */}
      <Dialog
        open={reopenTarget !== null}
        onOpenChange={(o) => !o && !reopenBusy && setReopenTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive aria-hidden="true" className="h-4 w-4 text-roksal-amber" />
              Ponovno odpri arhivirano meritev?
            </DialogTitle>
            <DialogDescription>
              Meritev „
              {reopenTarget
                ? reopenTarget.measurement.oznaka ||
                  reopenTarget.measurement.lokacija ||
                  `#${reopenTarget.measurement.id.slice(-4)}`
                : ''}
              “ bo spet {statusLabels[reopenTarget?.nextStatus ?? 'OSNUTEK'].toLowerCase()}. Navedite
              razlog — vpisan v revizijsko sled (zgodovina sprememb).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reopen-reason">Razlog (obvezen, vsaj 3 znaki)</Label>
            <Textarea
              id="reopen-reason"
              value={reopenNote}
              onChange={(e) => setReopenNote(e.target.value)}
              placeholder="npr. napačno arhivirana — meritev je potrebna za ponudbo"
              rows={3}
              maxLength={500}
              autoFocus
              className="focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
            />
            <p className="text-xs text-muted-foreground tabular-nums">
              {reopenNote.trim().length}/500 znakov
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReopenTarget(null)}
              disabled={reopenBusy}
            >
              Prekliči
            </Button>
            <Button
              type="button"
              onClick={handleReopenConfirm}
              disabled={reopenBusy}
              aria-label="Potrdi ponovno odpiranje meritve z razlogom"
              title="Ponovno odpri to meritev za urejanje — zapisana razlog gre v revizijsko sled"
              className="bg-roksal-amber text-white hover:bg-roksal-amber/90 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
            >
              {reopenBusy ? 'Shranjevanje …' : 'Odpri z razlogom'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MERITVE-PRO — DIALOG: Uvozi iz AR posnetka */}
      <Dialog open={arImportOpen} onOpenChange={(o) => !arImportProgress && setArImportOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Boxes aria-hidden="true" className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              Uvozi mere iz AR posnetka
            </DialogTitle>
            <DialogDescription>
              Izberite AR posnetek — točke bodo pretvorjene v RAZDALJA mere in STEBR točke.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto scrollbar-thin">
            {arImportLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-border/50 p-2.5">
                    <Skeleton className="h-14 w-14 shrink-0 rounded-md" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : arSnapshots.length === 0 ? (
              <div className="py-8 text-center">
                <Boxes aria-hidden="true" className="mx-auto h-8 w-8 text-muted-foreground/30" />
                <p className="mt-2 text-xs text-muted-foreground">Ni AR posnetkov za ta projekt</p>
                <p className="text-2xs text-muted-foreground/60 mt-1">
                  Najprej ustvari AR posnetek v AR kameri
                </p>
              </div>
            ) : (
              arSnapshots.map((snap) => {
                let stTock = 0
                let hasKalibracija = false
                try {
                  const parsed = JSON.parse(snap.tocke || '[]')
                  stTock = Array.isArray(parsed) ? parsed.length : 0
                } catch { /* ignore */ }
                try {
                  if (snap.kalibracija) {
                    const k = JSON.parse(snap.kalibracija)
                    hasKalibracija = !!(k?.pixelsPerMm || k?.pixelsPerCm)
                  }
                } catch { /* ignore */ }
                const isSelected = arSelectedSnapshotId === snap.id
                return (
                  <button
                    key={snap.id}
                    type="button"
                    onClick={() => setArSelectedSnapshotId(snap.id)}
                    className={`flex w-full items-start gap-3 rounded-lg border p-2.5 text-left transition-all duration-150 ${
                      isSelected
                        ? 'border-cyan-400 dark:border-cyan-700 bg-cyan-50 dark:bg-cyan-950/40'
                        : 'border-border/50 bg-secondary/30 hover:border-cyan-300 dark:hover:border-cyan-700'
                    }`}
                  >
                    <div className="h-14 w-14 shrink-0 rounded-md overflow-hidden border border-border/50 bg-secondary/50">
                      {snap.imageUrl ? (
                        <img
                          src={snap.imageUrl}
                          alt="AR posnetek"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Boxes aria-hidden="true" className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-semibold text-roksal-ink truncate">
                          AR posnetek #{snap.id.slice(-6)}
                        </p>
                        {snap.profil?.naziv && (
                          <Badge variant="outline" className="text-3xs h-3.5 px-1">
                            {snap.profil.naziv}
                          </Badge>
                        )}
                        {hasKalibracija ? (
                          <Badge className="text-3xs h-3.5 px-1 bg-roksal-green/15 text-roksal-green border border-roksal-green/30">
                            Umerjeno
                          </Badge>
                        ) : (
                          <Badge className="text-3xs h-3.5 px-1 bg-roksal-amber/10 text-roksal-ink border border-roksal-amber/40">
                            Ni umeritve
                          </Badge>
                        )}
                      </div>
                      <p className="text-2xs text-muted-foreground mt-0.5">
                        {`${slDatumKratko(new Date(snap.createdAt))}, ${slCasDolgo(new Date(snap.createdAt))}`}
                      </p>
                      <p className="text-2xs text-muted-foreground font-mono mt-0.5">
                        {stTock} točk · {stTock >= 2 ? stTock - 1 : 0} parov
                      </p>
                      {snap.opombe && (
                        <p className="text-[9px] text-muted-foreground/80 mt-0.5 truncate italic">
                          {snap.opombe}
                        </p>
                      )}
                    </div>
                    {isSelected && (
                      <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                    )}
                  </button>
                )
              })
            )}
          </div>
          {arImportProgress && (
            <div className="space-y-1.5 rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/40 p-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-cyan-800 dark:text-cyan-200 font-medium">Prenašam...</span>
                <span className="font-mono text-cyan-700 dark:text-cyan-300">
                  {arImportProgress.current}/{arImportProgress.total}
                </span>
              </div>
              <Progress
                value={(arImportProgress.current / Math.max(1, arImportProgress.total)) * 100}
                className="h-2"
              />
              <p className="text-2xs text-cyan-700 dark:text-cyan-300 text-center">
                {arImportProgress.current} mer prenesenih...
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setArImportOpen(false)}
              disabled={!!arImportProgress}
              className="sm:flex-1"
            >
              Prekliči
            </Button>
            <Button
              type="button"
              onClick={handleImportFromAr}
              disabled={!arSelectedSnapshotId || !!arImportProgress}
              aria-label="Uvozi mere iz AR posnetka v meritev"
              title="Prenesi izbrane mere iz AR posnetka v aktivno meritev"
              className="sm:flex-1 bg-cyan-600 text-white hover:bg-cyan-700 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
            >
              {arImportProgress ? (
                <>
                  <Loader2 aria-hidden="true" className="mr-1.5 h-4 w-4 animate-spin" />
                  Prenašam...
                </>
              ) : (
                <>
                  <Boxes aria-hidden="true" className="mr-1.5 h-4 w-4" />
                  Uvozi mere
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MERITVE-PRO — DIALOG: Pregledovalnik foto (za photo-sourced mere) */}
      <Dialog open={photoViewerOpen} onOpenChange={(o) => setPhotoViewerOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera aria-hidden="true" className="h-4 w-4 text-roksal-amber" />
              Foto mera
            </DialogTitle>
            <DialogDescription>
              Pregled pripadajoče fotografije z narisano merno črto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {photoViewerLoading ? (
              <Skeleton className="h-48 w-full rounded-lg" />
            ) : photoViewerNotFound ? (
              <div className="py-8 text-center">
                <AlertCircle aria-hidden="true" className="mx-auto h-8 w-8 text-roksal-red/40" />
                <p className="mt-2 text-xs text-muted-foreground">Foto ni najden v projektu</p>
                <p className="text-2xs text-muted-foreground/60 mt-1">
                  Morda je bila izbrisana. ID: {photoViewerId?.slice(-6)}
                </p>
              </div>
            ) : photoViewerUrl ? (
              <div className="rounded-lg overflow-hidden border border-border/50 bg-secondary/20">
                <img
                  src={photoViewerUrl}
                  alt="Foto mera"
                  className="w-full max-h-[60vh] object-contain"
                />
              </div>
            ) : null}
            {photoViewerUrl && !photoViewerLoading && (
              <div className="rounded-md bg-roksal-amber/5 border border-roksal-amber/20 p-2 text-2xs text-roksal-amber/90 flex items-start gap-1.5">
                <ImageIcon aria-hidden="true" className="h-3 w-3 mt-0.5 shrink-0" />
                <span>
                  To je fotografija z narisano merno črto. Za urejanje anotacij odpri v slikah.
                </span>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPhotoViewerOpen(false)}
              className="sm:flex-1"
            >
              Zapri
            </Button>
            <Button
              type="button"
              onClick={handleOpenInPhotos}
              disabled={!photoViewerUrl || photoViewerLoading}
              aria-label="Odpri to fotografijo meritve v zavihku Slike"
              title="Prenesi pogled na zavihek Slike s to fotografijo meritve odprto"
              className="sm:flex-1 bg-roksal-amber text-white hover:bg-roksal-amber/90 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
            >
              <ImageIcon aria-hidden="true" className="mr-1.5 h-4 w-4" />
              Odpri v slikah
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// DEMO PODATKI
// ============================================
// R152: demoMeasurements IZBRISANI — izmišljeni podatki na mestu praznega/neuspešnega nalaganja so kršili fail-closed pravila.

// R152: demoProjects IZBRISANI — izmišljeni podatki na mestu praznega/neuspešnega nalaganja so kršili fail-closed pravila.

