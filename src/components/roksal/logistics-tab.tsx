'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { downloadCsv, todayStamp } from '@/lib/csv-export'
import { allowedTransitions } from '@/lib/equipment-lifecycle'
import {
  normalizirajTermin,
  terminUrPovzetek,
  vsotaPredvidenihUr,
  type TerminPrikazVnos,
} from '@/lib/termini-prikaz'
import { QC_TEMPLATE, computePassed, countDefects } from '@/lib/qc-gate'
import { IEV_TEMPLATE } from '@/lib/installation-evidence'
import {
  Calendar, Download, Users, Wrench, Plus, Clock, MapPin, CheckCircle2, CalendarClock,
  Loader2, AlertTriangle, Truck, Package, ShieldCheck, History, FileCheck2, Lock,
} from 'lucide-react'

interface Schedule {
  id: string
  datumZacetka: string
  datumKonca: string
  status: string
  predvideneUre: number
  dejanskeUre: number | null
  opombe: string | null
  lokacija: string | null
  project: { id: string; nazivProjekta: string; customer: { ime: string; naslov: string } }
  crew: { id: string; naziv: string; barva: string } | null
  monter: { id: string; ime: string } | null
  equipment: Array<{ equipment: { id: string; naziv: string; tip: string } }>
}

interface Crew {
  id: string
  naziv: string
  barva: string
  vodja: { ime: string } | null
  _count: { members: number; schedules: number }
}

/** R147 (§28): montažno dokazilo (§17 minimalni DTO + izpeljane zastavice). */
interface EvidenceRow {
  id: string
  scheduleId: string | null
  templateVersion: string
  lokacija: string
  beforePhotoId: string | null
  afterPhotoId: string | null
  gps: { gpsLat: number; gpsLng: number; consentAt: string } | null
  checklist: Array<{ key: string; checked: boolean; note: string | null }>
  defects: Array<{ opomba: string; reseno: boolean }>
  handoverName: string | null
  handoverAt: string | null
  createdBy: string | null
  createdAt: string
  hasBefore: boolean
  hasAfter: boolean
  checklistAllChecked: boolean
  openDefectsCount: number
  complete: boolean
  locked: boolean
}

/** R147 (§28): fotka projekta (izbor PRED/PO v dokazilu). */
interface PhotoRow {
  id: string
  kategorija: string
  opomba: string | null
  createdAt: string
}

interface Equipment {
  id: string
  naziv: string
  tip: string
  status: string
  lokacija: string | null
  serijskaStevilka: string | null
  lastInspectionAt: string | null
  inspectionIntervalDays: number | null
  nextInspectionAt: string | null
  inspectionDue: boolean
  inspectionUnknown: boolean
  calibrationRequired: boolean
  calibrationDueDate: string | null
  calibrationCertificate: string | null
  calibrationOverdue: boolean
  calibrationMissing: boolean
  zadnjiServis: string | null
  assignmentsCount: number
}

interface EquipmentEventRow {
  id: string
  type: string
  performedAt: string
  result: string
  certificate: string | null
  opomba: string | null
  performedBy: string | null
}

interface Project {
  id: string
  nazivProjekta: string
  customer: { ime: string; naslov: string }
}

const STATUS_LABELS: Record<string, string> = {
  NAVRTENO: 'Načrtovano',
  V_TEKU: 'V teku',
  ZAKLJUCENO: 'Zaključeno',
  PREKlicANO: 'Preklicano',
  PRELOZENO: 'Preloženo',
}

const STATUS_COLORS: Record<string, string> = {
  NAVRTENO: 'bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-800',
  V_TEKU: 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800',
  ZAKLJUCENO: 'bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-200 border-green-300 dark:border-green-800',
  PREKlicANO: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800',
  PRELOZENO: 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800',
}

const EQUIPMENT_TYPES: Record<string, string> = {
  MERSKA_OPREMA: 'Merska oprema',
  ROCNO_ORODJE: 'Ročno orodje',
  PREVOZ: 'Prevoz',
  VARNOSTNA_OPREMA: 'Varnostna oprema',
  OSTALO: 'Ostalo',
}

// R145 (§31): oznake statusov opreme (življenjski cikl — UPOKOJENO je novo).
const EQUIPMENT_STATUS_LABELS: Record<string, string> = {
  NA_VOLJO: 'Na voljo',
  V_UPORABI: 'V uporabi',
  V_SERVISU: 'V servisu',
  IZGUBLJENO: 'Izgubljeno',
  UPOKOJENO: 'Upokojeno',
}

const EQUIPMENT_STATUS_COLORS: Record<string, string> = {
  NA_VOLJO: 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800',
  V_UPORABI: 'bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-800',
  V_SERVISU: 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800',
  IZGUBLJENO: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800',
  UPOKOJENO: 'bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-800',
}

const EQUIPMENT_EVENT_LABELS: Record<string, string> = {
  PREGLED: 'Pregled',
  KALIBRACIJA: 'Kalibracija',
  SERVIS: 'Servis',
  POPRAVILO: 'Popravilo',
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatTime(d: string): string {
  return new Date(d).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
}

// ---------------------------------------------------------------------------
// ICS izvoz (RFC 5545) — termine montaže v telefonov koledar (Google/Apple/
// Outlook jih vsi uvozijo). Časi v UTC (Z), kar pomeni pravilen prikaz tudi
// po časovnih pasovih; STATUS premeša Preklicano/Preloženo.
// ---------------------------------------------------------------------------

function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** RFC 5545: vrstice največ 75 oktetov — nadaljevanje z začetnim presledkom. */
function icsFold(line: string): string {
  const out: string[] = []
  let rest = line
  while (rest.length > 73) {
    out.push(rest.slice(0, 73))
    rest = ' ' + rest.slice(73)
  }
  out.push(rest)
  return out.join('\r\n')
}

// ---------------------------------------------------------------------------
// R139 — CSV izvoz terminov (isti deterministični kontrakt kot Zaloga/Računi
// iz R136: BOM, podpičje, decimalna vejica, CRLF — src/lib/csv-export.ts).
// Pisarna dobi termini kot preglednico (mesečna poročila, urni list).
// ---------------------------------------------------------------------------
function downloadSchedulesCsv(schedules: Schedule[]): number {
  downloadCsv(
    `Termini-${todayStamp()}.csv`,
    ['Datum', 'Od', 'Do', 'Projekt', 'Stranka', 'Ekipa', 'Status', 'Lokacija', 'Ure'],
    schedules.map((s) => [
      formatDate(s.datumZacetka),
      formatTime(s.datumZacetka),
      formatTime(s.datumKonca || s.datumZacetka),
      s.project.nazivProjekta,
      s.project.customer.ime,
      s.crew?.naziv ?? '',
      STATUS_LABELS[s.status] || s.status,
      s.lokacija ?? '',
      s.predvideneUre,
    ]),
  )
  return schedules.length
}

function icsUtc(d: string | Date): string {
  const t = new Date(d)
  return (
    t.getUTCFullYear().toString().padStart(4, '0') +
    String(t.getUTCMonth() + 1).padStart(2, '0') +
    String(t.getUTCDate()).padStart(2, '0') +
    'T' +
    String(t.getUTCHours()).padStart(2, '0') +
    String(t.getUTCMinutes()).padStart(2, '0') +
    String(t.getUTCSeconds()).padStart(2, '0') +
    'Z'
  )
}

export function buildIcs(schedules: Schedule[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Roksal Railing Manager//Logistika//SL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Roksal montaže',
  ]
  const now = icsUtc(new Date())
  for (const s of schedules) {
    const status = s.status === 'PREKlicANO' ? 'CANCELLED' : s.status === 'PRELOZENO' ? 'TENTATIVE' : 'CONFIRMED'
    const opis = [
      `Stranka: ${s.project.customer.ime}`,
      s.crew ? `Ekipa: ${s.crew.naziv}` : null,
      s.monter ? `Monter: ${s.monter.ime}` : null,
      `Predvidene ure: ${s.predvideneUre}`,
      s.opombe ?? null,
    ]
      .filter(Boolean)
      .join('\n')
    lines.push(
      'BEGIN:VEVENT',
      `UID:schedule-${s.id}@roksal`,
      `DTSTAMP:${now}`,
      `DTSTART:${icsUtc(s.datumZacetka)}`,
      `DTEND:${icsUtc(s.datumKonca || s.datumZacetka)}`,
      `SUMMARY:${icsEscape(`Montaža: ${s.project.nazivProjekta}`)}`,
      `LOCATION:${icsEscape(s.lokacija || s.project.customer.naslov || '')}`,
      `DESCRIPTION:${icsEscape(opis)}`,
      `STATUS:${status}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(icsFold).join('\r\n') + '\r\n'
}

export function downloadIcs(schedules: Schedule[]): number {
  if (schedules.length === 0) return 0
  const blob = new Blob([buildIcs(schedules)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `roksal-montaze-${new Date().toISOString().slice(0, 10)}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return schedules.length
}

export function LogisticsTab({ projectId }: { projectId: string | null }) {
  const [subtab, setSubtab] = useState<'calendar' | 'crews' | 'equipment'>('calendar')
  const [schedules, setSchedules] = useState<Schedule[]>([])

  // R169 — povzetek 'Skupaj ur' nad vidnimi termini (EN VIR RESNICE z
  // dashboard Termini kartico: ISTI normalizirajTermin → vsotaPredvidenihUr
  // → terminUrPovzetek). PREKlicano izključen + vidno preštet; '≥' ko ure
  // manjkajo; pokvarjen vnos → vidno preštet kot preskočen (ne tiho izgubljen).
  const urPovzetek = useMemo(() => {
    let preskoceni = 0
    const prikazne: TerminPrikazVnos[] = []
    for (const raw of schedules) {
      const res = normalizirajTermin(raw, null)
      if ('napaka' in res) {
        preskoceni += 1
        continue
      }
      prikazne.push(res.vnos)
    }
    return { ag: vsotaPredvidenihUr(prikazne), preskoceni }
  }, [schedules])
  const [crews, setCrews] = useState<Crew[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  // R163 fail-verbose: razlog, zakaj podatkov NI (prej catch ignore + stale state).
  const [loadError, setLoadError] = useState<string | null>(null)
  const [newScheduleOpen, setNewScheduleOpen] = useState(false)
  const [newCrewOpen, setNewCrewOpen] = useState(false)
  const [newEquipOpen, setNewEquipOpen] = useState(false)
  const { toast } = useToast()

  // Form states
  const [schedProject, setSchedProject] = useState('')
  const [schedCrew, setSchedCrew] = useState('')
  const [schedDate, setSchedDate] = useState('')
  const [schedTime, setSchedTime] = useState('08:00')
  const [schedHours, setSchedHours] = useState('8')
  const [schedLocation, setSchedLocation] = useState('')
  const [crewNaziv, setCrewNaziv] = useState('')
  const [equipNaziv, setEquipNaziv] = useState('')
  const [equipTip, setEquipTip] = useState('ROCNO_ORODJE')
  // R142 (§30): preložitev termina — datum/ura/trajanje se PATCH-a, konflikti
  // vira (ekipa/monter) jih javi strežnik (409 z razlogom — fail-verbose).
  const [moveTarget, setMoveTarget] = useState<{ id: string; status: string; project: string } | null>(null)
  const [moveDate, setMoveDate] = useState('')
  const [moveTime, setMoveTime] = useState('08:00')
  const [moveHours, setMoveHours] = useState('8')
  const [moveBusy, setMoveBusy] = useState(false)
  // R145 (§31): oprema pri novem terminu (več-izbira; konflikti opreme 409).
  const [schedEquipment, setSchedEquipment] = useState<string[]>([])
  // R145 (§31): zabeleži pregled/kalibracijo/servis/popravilo + statusne
  // tranzicije (409 z dovoljenimi cilji — fail-verbose).
  const [eventTarget, setEventTarget] = useState<Equipment | null>(null)
  const [eventType, setEventType] = useState('PREGLED')
  const [eventDate, setEventDate] = useState('')
  const [eventResult, setEventResult] = useState('V_REDU')
  const [eventCertificate, setEventCertificate] = useState('')
  const [eventNextDue, setEventNextDue] = useState('')
  const [eventOpomba, setEventOpomba] = useState('')
  const [eventBusy, setEventBusy] = useState(false)
  const [eventHistory, setEventHistory] = useState<EquipmentEventRow[]>([])
  const [eventHistoryFor, setEventHistoryFor] = useState<string | null>(null)
  // R146 (§27): preverba kakovosti PRED zaključitvijo — vrata so na strežniku
  // (ZAKLJUCENO brez prešle preverbe → 409; override z razlogom reviziran).
  const [qcTarget, setQcTarget] = useState<{ id: string; projectId: string; project: string } | null>(null)
  const [qcChecked, setQcChecked] = useState<Record<string, boolean>>({})
  const [qcNotes, setQcNotes] = useState<Record<string, string>>({})
  const [qcBusy, setQcBusy] = useState(false)
  const [qcOverrideMode, setQcOverrideMode] = useState(false)
  const [qcOverrideReason, setQcOverrideReason] = useState('')
  // R147 (§28): montažno dokazilo — pred/po + GPS (po policyju) + verzirani
  // checklist + napake + dokaz predaje (predaja zakleni — fail-closed 409).
  const [evTarget, setEvTarget] = useState<{ id: string; projectId: string; project: string } | null>(null)
  const [evExisting, setEvExisting] = useState<EvidenceRow | null>(null)
  const [evLokacija, setEvLokacija] = useState('')
  const [evGpsConsent, setEvGpsConsent] = useState(false)
  const [evGps, setEvGps] = useState<{ lat: number; lng: number } | null>(null)
  const [evChecked, setEvChecked] = useState<Record<string, boolean>>({})
  const [evNotes, setEvNotes] = useState<Record<string, string>>({})
  const [evDefects, setEvDefects] = useState('')
  const [evBeforeId, setEvBeforeId] = useState('')
  const [evAfterId, setEvAfterId] = useState('')
  const [evPhotos, setEvPhotos] = useState<{ pred: PhotoRow[]; po: PhotoRow[] }>({ pred: [], po: [] })
  const [evHandoverName, setEvHandoverName] = useState('')
  const [evBusy, setEvBusy] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [schedRes, crewRes, equipRes, projRes] = await Promise.all([
        fetch('/api/schedules' + (projectId ? `?projectId=${projectId}` : ''), { credentials: 'same-origin' }),
        fetch('/api/crews', { credentials: 'same-origin' }),
        // R145 (§31): lifecycle DTO (zastavice kalibracije/pregledov) —
        // /api/equipment, ne starejši /api/crews?type=equipment (brez cikla).
        fetch('/api/equipment', { credentials: 'same-origin' }),
        fetch('/api/projects', { credentials: 'same-origin' }),
      ])
      // R163 fail-verbose: prej `if (res.ok) set…` brez else + `catch ignore` —
      // pri padcu APIja TIHO staro/prazno stanje (pisarna misli, da ni terminov).
      const sources: Array<[string, Response]> = [
        ['terminov', schedRes],
        ['ekip', crewRes],
        ['opreme', equipRes],
        ['projektov', projRes],
      ]
      const failed = sources.filter(([, r]) => !r.ok)
      if (failed.length > 0) {
        const st = failed[0][1].status
        setLoadError(
          st === 401
            ? 'Prijava je potekla. Ponovno se prijavite.'
            : `Strežnik ni vrnil podatkov (${failed.map(([n]) => n).join(', ')}; napaka ${st}).`,
        )
        setSchedules([])
        setCrews([])
        setEquipment([])
        setProjects([])
        return
      }
      const [schedJson, crewJson, equipJson, projJson] = (await Promise.all([
        schedRes.json().catch(() => null),
        crewRes.json().catch(() => null),
        equipRes.json().catch(() => null),
        projRes.json().catch(() => null),
      ])) as unknown[]
      if (!Array.isArray(schedJson) || !Array.isArray(crewJson) || !Array.isArray(equipJson) || !Array.isArray(projJson)) {
        setLoadError('Neveljaven odgovor strežnika.')
        setSchedules([])
        setCrews([])
        setEquipment([])
        setProjects([])
        return
      }
      setSchedules(schedJson as Schedule[])
      setCrews(crewJson as Crew[])
      setEquipment(equipJson as Equipment[])
      setProjects(projJson as Project[])
      if (!schedProject && projJson.length > 0) setSchedProject(projectId || (projJson as Project[])[0].id)
    } catch {
      // R163: nič tihega ignore — omrežna napaka je vidna z razlogom.
      setLoadError('Ni povezave s strežnikom. Preverite omrežje in poskusite znova.')
      setSchedules([])
      setCrews([])
      setEquipment([])
      setProjects([])
    } finally { setLoading(false) }
  }, [projectId, schedProject])

  useEffect(() => { loadData() }, [loadData])

  const handleCreateSchedule = async () => {
    if (!schedProject || !schedDate) return
    const start = new Date(`${schedDate}T${schedTime}`)
    const end = new Date(start.getTime() + parseInt(schedHours) * 3600000)
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: schedProject,
          crewId: schedCrew || undefined,
          datumZacetka: start.toISOString(),
          datumKonca: end.toISOString(),
          predvideneUre: parseInt(schedHours),
          lokacija: schedLocation,
          // R145 (§31): dodeljena oprema (prazna lista = brez opreme).
          ...(schedEquipment.length > 0 ? { equipmentIds: schedEquipment } : {}),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: '✓ Termin ustvarjen', description: `${formatDate(start.toISOString())} · ${schedHours}h${schedEquipment.length > 0 ? ` · ${schedEquipment.length} kosov opreme` : ''}` })
        setNewScheduleOpen(false)
        setSchedDate(''); setSchedLocation(''); setSchedEquipment([])
        loadData()
      } else {
        toast({ title: 'Napaka', description: data.error, variant: 'destructive' })
      }
    } catch { toast({ title: 'Omrežna napaka', variant: 'destructive' }) }
  }

  /** R145 (§31): statusna tranzicija opreme (409 z dovoljenimi cilji). */
  const handleEquipmentStatus = async (e0: Equipment, to: string) => {
    try {
      const res = await fetch('/api/equipment', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: e0.id, status: to }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (res.ok) {
        toast({ title: `Status → ${EQUIPMENT_STATUS_LABELS[to] ?? to}`, description: e0.naziv })
        loadData()
      } else {
        toast({ title: 'Napaka', description: data?.error ?? `HTTP ${res.status}`, variant: 'destructive' })
      }
    } catch { toast({ title: 'Omrežna napaka', variant: 'destructive' }) }
  }

  /** R145 (§31): odpri dialog za dogodek + naloži zgodovino (zadnjih 20). */
  const openEventDialog = async (e0: Equipment) => {
    setEventTarget(e0)
    setEventType(e0.calibrationRequired ? 'KALIBRACIJA' : 'PREGLED')
    setEventResult('V_REDU')
    setEventCertificate('')
    setEventNextDue('')
    setEventOpomba('')
    const now = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    setEventDate(`${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}`)
    setEventHistory([])
    setEventHistoryFor(e0.id)
    try {
      const res = await fetch(`/api/equipment/events?equipmentId=${e0.id}`)
      if (res.ok) setEventHistory(await res.json())
    } catch { /* zgodovina je naknadna — dialog ostane uporaben */ }
  }

  /** R145 (§31): zabeleži dogodek (fail-verbose — 400/403/404/500 se pokažejo). */
  const handleLogEvent = async () => {
    if (!eventTarget || !eventDate) return
    setEventBusy(true)
    try {
      const res = await fetch('/api/equipment/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentId: eventTarget.id,
          type: eventType,
          performedAt: new Date(eventDate).toISOString(),
          result: eventResult,
          ...(eventType === 'KALIBRACIJA' && eventCertificate ? { certificate: eventCertificate } : {}),
          ...(eventType === 'KALIBRACIJA' && eventNextDue ? { nextDueDate: new Date(`${eventNextDue}T12:00:00`).toISOString() } : {}),
          ...(eventOpomba ? { opomba: eventOpomba } : {}),
        }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (res.ok) {
        toast({ title: `✓ ${EQUIPMENT_EVENT_LABELS[eventType] ?? eventType} zabeležen`, description: eventTarget.naziv })
        setEventTarget(null)
        loadData()
      } else {
        toast({ title: 'Napaka', description: data?.error ?? `HTTP ${res.status}`, variant: 'destructive' })
      }
    } catch { toast({ title: 'Omrežna napaka', variant: 'destructive' }) }
    finally { setEventBusy(false) }
  }

  /** R146 (§27): odpri preverbo kakovosti za zaključitev termina. */
  const openQcDialog = (id: string, projectId: string, project: string) => {
    setQcTarget({ id, projectId, project })
    setQcChecked({})
    setQcNotes({})
    setQcOverrideMode(false)
    setQcOverrideReason('')
  }

  /** R147 (§28): odpri montažno dokazilo + naloži obstoječe + fotke PRED/PO. */
  const openEvidenceDialog = async (id: string, projectId: string, project: string) => {
    setEvTarget({ id, projectId, project })
    setEvExisting(null)
    setEvLokacija('')
    setEvGpsConsent(false)
    setEvGps(null)
    setEvChecked({})
    setEvNotes({})
    setEvDefects('')
    setEvBeforeId('')
    setEvAfterId('')
    setEvPhotos({ pred: [], po: [] })
    setEvHandoverName('')
    try {
      const [evRes, phRes] = await Promise.all([
        fetch(`/api/evidence?projectId=${projectId}`),
        fetch(`/api/photos?projectId=${projectId}&limit=100`),
      ])
      if (evRes.ok) {
        const data = (await evRes.json().catch(() => null)) as { evidence?: EvidenceRow[] } | null
        const found = data?.evidence?.find((e) => e.scheduleId === id) ?? null
        if (found) {
          setEvExisting(found)
          setEvLokacija(found.lokacija)
          setEvGpsConsent(found.gps !== null)
          if (found.gps) setEvGps({ lat: found.gps.gpsLat, lng: found.gps.gpsLng })
          setEvChecked(Object.fromEntries(found.checklist.map((c) => [c.key, c.checked])))
          setEvNotes(Object.fromEntries(found.checklist.map((c) => [c.key, c.note ?? ''])))
          setEvDefects(found.defects.map((d) => d.opomba).join('\n'))
          setEvBeforeId(found.beforePhotoId ?? '')
          setEvAfterId(found.afterPhotoId ?? '')
          setEvHandoverName(found.handoverName ?? '')
        }
      }
      if (phRes.ok) {
        const photos = (await phRes.json().catch(() => null)) as PhotoRow[] | null
        if (Array.isArray(photos)) {
          setEvPhotos({
            pred: photos.filter((p) => p.kategorija === 'PRED'),
            po: photos.filter((p) => p.kategorija === 'PO'),
          })
        }
      }
    } catch { /* naknadni podatki — dialog ostane uporaben (fail-verbose ob shranjevanju) */ }
  }

  /** R147 (§28): GPS po policyju — koordinate IZ naprave, samo z izrecnim soglasjem. */
  const handleEvGpsConsent = (checked: boolean) => {
    setEvGpsConsent(checked)
    if (!checked) { setEvGps(null); return }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast({ title: 'GPS ni na voljo', description: 'Naprava ne omogoča geolokacije — dokazilo ostane brez koordinat (iskreno neznano).', variant: 'destructive' })
      setEvGpsConsent(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setEvGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        toast({ title: 'Dostop do GPS zavrnjen', description: 'Brez soglasja naprave se koordinate NE zapišejo (fail-closed, ne tiho).', variant: 'destructive' })
        setEvGpsConsent(false)
      },
      { timeout: 8000 },
    )
  }

  /** R147 (§28): checklist payload (isti fail-closed vzorec kot QC). */
  const evChecklistPayload = IEV_TEMPLATE.map((t) => ({
    key: t.key,
    checked: evChecked[t.key] === true,
    note: evNotes[t.key] || null,
  }))
  const evValid = evChecklistPayload.every((i) => i.checked || (i.note && i.note.trim().length > 0))
  const evAllChecked = evChecklistPayload.every((i) => i.checked)
  /** Napake iz tekstualnega polja (vrstica = napaka; opomba je dejstvo terenskega dela). */
  const evDefectsList = evDefects.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)

  /** R147 (§28): shrani dokazilo (POST ali PATCH) — fail-verbose. */
  const handleEvidenceSave = async () => {
    if (!evTarget || !evValid) return
    setEvBusy(true)
    try {
      const payload = {
        ...(evExisting ? { id: evExisting.id } : { projectId: evTarget.projectId, scheduleId: evTarget.id }),
        lokacija: evLokacija,
        checklist: evChecklistPayload,
        defects: evDefectsList.map((opomba) => ({ opomba, reseno: false })),
        gps: { gpsConsent: evGpsConsent, ...(evGpsConsent && evGps ? { gpsLat: evGps.lat, gpsLng: evGps.lng } : {}) },
        ...(evBeforeId ? { beforePhotoId: evBeforeId } : {}),
        ...(evAfterId ? { afterPhotoId: evAfterId } : {}),
      }
      const res = await fetch('/api/evidence', {
        method: evExisting ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json().catch(() => null)) as { error?: string; id?: string } | null
      if (res.ok) {
        toast({ title: evExisting ? '✓ Dokazilo posodobljeno' : '✓ Montažno dokazilo shranjeno', description: evTarget.project })
        if (evExisting && data?.id) await openEvidenceDialog(evTarget.id, evTarget.projectId, evTarget.project)
        else if (!evExisting) await openEvidenceDialog(evTarget.id, evTarget.projectId, evTarget.project)
        loadData()
      } else {
        toast({ title: 'Napaka', description: data?.error ?? `HTTP ${res.status}`, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Omrežna napaka', variant: 'destructive' })
    } finally {
      setEvBusy(false)
    }
  }

  /** R147 (§28): potrdi predajo — strežnik zavrača brez PRED+PO fotk (409). */
  const handleEvidenceHandover = async () => {
    if (!evExisting || !evHandoverName.trim()) return
    setEvBusy(true)
    try {
      const res = await fetch('/api/evidence', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: evExisting.id, handoverName: evHandoverName.trim() }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (res.ok) {
        toast({ title: '✓ Predaja potrjena', description: 'Dokazilo je zaklenjeno — nič več ni spreminljivo.' })
        await openEvidenceDialog(evTarget!.id, evTarget!.projectId, evTarget!.project)
        loadData()
      } else {
        toast({ title: 'Predaja ni mogoča', description: data?.error ?? `HTTP ${res.status}`, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Omrežna napaka', variant: 'destructive' })
    } finally {
      setEvBusy(false)
    }
  }

  const qcItemsPayload = QC_TEMPLATE.map((t) => ({
    key: t.key,
    checked: qcChecked[t.key] === true,
    note: qcNotes[t.key] || null,
  }))
  const qcPassed = computePassed(qcItemsPayload)
  const qcDefects = countDefects(qcItemsPayload)
  const qcValid = qcItemsPayload.every((i) => i.checked || (i.note && i.note.trim().length > 0))

  /** R146 (§27): shrani preverbo → če je prešla, zaključi termin (PATCH). */
  const handleQcSubmit = async () => {
    if (!qcTarget || !qcValid) return
    setQcBusy(true)
    try {
      const qcRes = await fetch('/api/qc', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: qcTarget.projectId, scheduleId: qcTarget.id, items: qcItemsPayload }),
      })
      const qcData = (await qcRes.json().catch(() => null)) as { error?: string; passed?: boolean } | null
      if (!qcRes.ok) {
        toast({ title: 'Napaka pri preverbi', description: qcData?.error ?? `HTTP ${qcRes.status}`, variant: 'destructive' })
        return
      }
      if (!qcData?.passed) {
        toast({
          title: `Preverba NE prehaja (${qcDefects} napak)`,
          description: 'Zabeležena je kot napaka — zaključitev ostane zaprta do prehoda ali reviziranega override.',
          variant: 'destructive',
        })
        setQcTarget(null)
        return
      }
      await finalizeSchedule(qcTarget.id)
      setQcTarget(null)
    } catch {
      toast({ title: 'Omrežna napaka', variant: 'destructive' })
    } finally {
      setQcBusy(false)
    }
  }

  /**
   * R146 (§27): zaključi termin — kot override z razlogom (revizirano
   * QC_OVERRIDE) ali po prešli preverbi (brez override). Fail-verbose.
   */
  const finalizeSchedule = async (id: string, overrideReason?: string) => {
    try {
      const res = await fetch('/api/schedules', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'ZAKLJUCENO', dejanskeUre: undefined, ...(overrideReason ? { qcOverrideReason: overrideReason } : {}) }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (res.ok) {
        toast({ title: '✓ Termin zaključen', description: overrideReason ? 'Z reviziranim override preverbe.' : 'Preverba kakovosti prešla.' })
        loadData()
      } else {
        toast({ title: 'Napaka', description: data?.error ?? `HTTP ${res.status}`, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Omrežna napaka', variant: 'destructive' })
    }
  }

  const handleQcOverride = async () => {
    if (!qcTarget || !qcOverrideReason.trim()) return
    setQcBusy(true)
    try {
      await finalizeSchedule(qcTarget.id, qcOverrideReason.trim())
      setQcTarget(null)
    } finally {
      setQcBusy(false)
    }
  }

  const handleStatusChange = async (id: string, status: string, dejanskeUre?: number) => {
    try {
      const res = await fetch('/api/schedules', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, ...(dejanskeUre ? { dejanskeUre } : {}) }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (res.ok) {
        toast({ title: `Status → ${STATUS_LABELS[status] || status}` })
        loadData()
      } else {
        // R142: fail-verbose (R140 vzorec) — 403/409/500 se POKAŽE, ne tiho
        // ugine (prej: MONTER ni videl, zakaj "Zaključi" ne dela).
        toast({ title: 'Napaka', description: data?.error ?? `HTTP ${res.status}`, variant: 'destructive' })
      }
    } catch { toast({ title: 'Napaka', variant: 'destructive' }) }
  }

  /** R142 (§30): preloži termin na nov datum/uro (PATCH z novim intervalom). */
  const handleMoveSchedule = async () => {
    if (!moveTarget || !moveDate) return
    const start = new Date(`${moveDate}T${moveTime}`)
    const end = new Date(start.getTime() + parseInt(moveHours) * 3600000)
    setMoveBusy(true)
    try {
      const res = await fetch('/api/schedules', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: moveTarget.id, status: moveTarget.status, datumZacetka: start.toISOString(), datumKonca: end.toISOString() }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (res.ok) {
        toast({ title: '✓ Termin preložen', description: `${formatDate(start.toISOString())} ob ${moveTime}` })
        setMoveTarget(null)
        loadData()
      } else {
        // 409 z razlogom vira ("Ekipa \"X\" ima že termin …") se pokaže cel.
        toast({ title: 'Prekrivanje', description: data?.error ?? `HTTP ${res.status}`, variant: 'destructive' })
      }
    } catch { toast({ title: 'Omrežna napaka', variant: 'destructive' }) }
    finally { setMoveBusy(false) }
  }

  const handleCreateCrew = async () => {
    if (!crewNaziv) return
    try {
      const res = await fetch('/api/crews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ naziv: crewNaziv }) })
      if (res.ok) { toast({ title: 'Ekipa ustvarjena' }); setNewCrewOpen(false); setCrewNaziv(''); loadData() }
    } catch { toast({ title: 'Napaka', variant: 'destructive' }) }
  }

  const handleCreateEquip = async () => {
    if (!equipNaziv) return
    try {
      const res = await fetch('/api/crews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'equipment', naziv: equipNaziv, tip: equipTip }) })
      if (res.ok) { toast({ title: 'Oprema dodana' }); setNewEquipOpen(false); setEquipNaziv(''); loadData() }
    } catch { toast({ title: 'Napaka', variant: 'destructive' }) }
  }

  // R163 fail-verbose: viden panel z razlogom + poskus znova — NE lažnega praznega stanja.
  if (loadError) {
    return (
      <div className="space-y-4">
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-xl border border-roksal-amber/40 bg-roksal-amber/10 p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-roksal-amber" aria-hidden="true" />
            <p className="text-sm break-words text-roksal-ink">{loadError}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void loadData()}
            className="shrink-0 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
            aria-label="Ponovno naloži logistiko"
          >
            Poskusi znova
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Subtabs */}
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        <Button type="button" variant={subtab === 'calendar' ? 'default' : 'ghost'} size="sm" onClick={() => setSubtab('calendar')} className={subtab === 'calendar' ? 'bg-roksal-navy text-white' : ''}>
          <Calendar className="h-3.5 w-3.5 mr-1" /> Koledar
        </Button>
        <Button type="button" variant={subtab === 'crews' ? 'default' : 'ghost'} size="sm" onClick={() => setSubtab('crews')} className={subtab === 'crews' ? 'bg-roksal-navy text-white' : ''}>
          <Users className="h-3.5 w-3.5 mr-1" /> Ekipe
        </Button>
        <Button type="button" variant={subtab === 'equipment' ? 'default' : 'ghost'} size="sm" onClick={() => setSubtab('equipment')} className={subtab === 'equipment' ? 'bg-roksal-navy text-white' : ''}>
          <Wrench className="h-3.5 w-3.5 mr-1" /> Oprema
        </Button>
      </div>

      {/* Calendar tab */}
      {subtab === 'calendar' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button type="button" onClick={() => setNewScheduleOpen(true)} className="flex-1 bg-roksal-navy text-white">
              <Plus className="h-4 w-4 mr-2" /> Nov termin montaže
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={schedules.length === 0}
              aria-label="Izvozi vidne termine kot CSV"
              title="Termine kot preglednico (Excel)"
              className="shrink-0 focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
              onClick={() => {
                const n = downloadSchedulesCsv(schedules)
                if (n > 0) toast({ title: `CSV izvožen (${n} terminov)`, description: 'Datoteka vsebuje vidne termine — odpravite jo v Excelu.' })
              }}
            >
              <Download className="h-4 w-4 mr-1" aria-hidden /> CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={schedules.length === 0}
              aria-label="Izvozi termine montaže kot koledarsko datoteko (.ics)"
              title="Termine odpri v Google/Apple/Outlook koledarju"
              className="shrink-0 focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
              onClick={() => {
                const n = downloadIcs(schedules)
                if (n > 0) toast({ title: `Koledar izvožen (${n} terminov)`, description: 'Datoteko odpri v telefonu — dogodki se dodajo v koledar.' })
              }}
            >
              <Download className="h-4 w-4 mr-1" aria-hidden /> .ics
            </Button>
          </div>

          {loading ? (
            <Card><CardContent className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-roksal-amber" /></CardContent></Card>
          ) : schedules.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Ni terminov. Ustvari nov termin montaže.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {/* R169 — povzetek predvidenih ur nad vidnimi termini (EN VIR
                  RESNICE z dashboard Termini kartico — isti lib). PREKlicani
                  so izključeni in vidno omenjeni; preskočeni (pokvarjeni)
                  vnosi so vidno preštet — nikoli tihega izginjanja. */}
              <p
                className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md bg-muted/60 px-2.5 py-1.5 text-[11px] text-muted-foreground"
                title="Vsota predvidenih ur vidnih terminov (preklicani so izključeni)"
              >
                <Clock className="h-3 w-3 shrink-0 text-roksal-amber" aria-hidden="true" />
                <span className="tabular-nums font-medium">{terminUrPovzetek(urPovzetek.ag)}</span>
                {urPovzetek.preskoceni > 0 && (
                  <span className="tabular-nums">
                    · {urPovzetek.preskoceni} {urPovzetek.preskoceni === 1 ? 'vnos preskočen' : 'vnosov preskočenih'} (neveljaven vnos)
                  </span>
                )}
              </p>
              {schedules.map((s) => (
              <Card key={s.id} className="overflow-hidden transition-[border-color,box-shadow] duration-150 hover:border-roksal-navy/25 dark:hover:border-roksal-ink/25 hover:shadow-sm focus-within:border-roksal-navy/25 dark:focus-within:border-roksal-ink/25">
                <div className="flex items-stretch">
                  <div className="w-1.5 shrink-0" style={{ backgroundColor: s.crew?.barva || '#1d2b3e' }} />
                  <CardContent className="p-3 flex-1">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-roksal-ink truncate">{s.project.nazivProjekta}</span>
                          <Badge variant="outline" className={`text-[8px] shrink-0 ${STATUS_COLORS[s.status]}`}>
                            {STATUS_LABELS[s.status] || s.status}
                          </Badge>
                        </div>
                        <div className="text-[10px] text-muted-foreground">{s.project.customer.ime}</div>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] mt-1 tabular-nums text-muted-foreground">
                          <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{formatDate(s.datumZacetka)} {formatTime(s.datumZacetka)}</span>
                          <span>·</span>
                          <span className="text-roksal-ink">{s.predvideneUre}h{s.dejanskeUre ? ` (dejan. ${s.dejanskeUre}h)` : ''}</span>
                          {s.crew && <><span>·</span><span className="flex items-center gap-0.5"><Users className="h-2.5 w-2.5" />{s.crew.naziv}</span></>}
                          {s.lokacija && <><span>·</span><span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{s.lokacija}</span></>}
                        </div>
                      </div>
                    </div>
                    {/* Status actions */}
                    {s.status === 'NAVRTENO' && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] bg-amber-50 dark:bg-amber-950/40 focus-visible:ring-2 focus-visible:ring-roksal-amber/50" onClick={() => handleStatusChange(s.id, 'V_TEKU')}>
                          Začni montažo
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
                          aria-label={`Preloži termin za ${s.project.nazivProjekta}`}
                          onClick={() => {
                            const d = new Date(s.datumZacetka)
                            const p = (n: number) => String(n).padStart(2, '0')
                            setMoveTarget({ id: s.id, status: s.status, project: s.project.nazivProjekta })
                            setMoveDate(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)
                            setMoveTime(`${p(d.getHours())}:${p(d.getMinutes())}`)
                            setMoveHours(String(s.predvideneUre ?? 8))
                          }}
                        >
                          <CalendarClock className="h-3 w-3 mr-1" /> Preloži
                        </Button>
                      </div>
                    )}
                    {s.status === 'V_TEKU' && (
                      <>
                        <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] bg-green-50 dark:bg-green-950/40 focus-visible:ring-2 focus-visible:ring-roksal-navy/40" aria-label={`Zaključi termin ${s.project.nazivProjekta} s preverbo kakovosti`} onClick={() => openQcDialog(s.id, s.project.id, s.project.nazivProjekta)}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Zaključi (preverba + odštej material)
                        </Button>
                        <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] focus-visible:ring-2 focus-visible:ring-roksal-navy/40" aria-label={`Montažno dokazilo za ${s.project.nazivProjekta} (pred/po, checklist, predaja)`} onClick={() => void openEvidenceDialog(s.id, s.project.id, s.project.nazivProjekta)}>
                          <FileCheck2 className="h-3 w-3 mr-1" /> Montažno dokazilo
                        </Button>
                      </>
                    )}
                    {s.status === 'PRELOZENO' && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
                        aria-label={`Premakni preloženi termin ${s.project.nazivProjekta}`}
                        onClick={() => {
                          const d = new Date(s.datumZacetka)
                          const p = (n: number) => String(n).padStart(2, '0')
                          setMoveTarget({ id: s.id, status: s.status, project: s.project.nazivProjekta })
                          setMoveDate(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)
                          setMoveTime(`${p(d.getHours())}:${p(d.getMinutes())}`)
                          setMoveHours(String(s.predvideneUre ?? 8))
                        }}
                      >
                        <CalendarClock className="h-3 w-3 mr-1" /> Premakni na nov datum
                      </Button>
                    )}
                  </CardContent>
                </div>
              </Card>
            ))}
            </div>
          )}
        </div>
      )}

      {/* Crews tab */}
      {subtab === 'crews' && (
        <div className="space-y-3">
          <Button type="button" onClick={() => setNewCrewOpen(true)} className="w-full bg-roksal-navy text-white">
            <Plus className="h-4 w-4 mr-2" /> Nova ekipa
          </Button>
          {crews.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Ni ekip. Ustvari prvo ekipo.</p>
            </CardContent></Card>
          ) : crews.map((c) => (
            <Card key={c.id} className="transition-[border-color,box-shadow] duration-150 hover:border-roksal-navy/25 dark:hover:border-roksal-ink/25 hover:shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-4 w-4 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: c.barva }} aria-hidden />
                  <span className="text-sm font-semibold text-roksal-ink">{c.naziv}</span>
                </div>
                <div className="text-[10px] tabular-nums text-muted-foreground">
                  {c.vodja ? `Vodja: ${c.vodja.ime}` : 'Brez vodje'} · {c._count.members} članov · {c._count.schedules} terminov
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Equipment tab */}
      {subtab === 'equipment' && (
        <div className="space-y-3">
          <Button type="button" onClick={() => setNewEquipOpen(true)} className="w-full bg-roksal-navy text-white">
            <Plus className="h-4 w-4 mr-2" /> Nova oprema
          </Button>
          {equipment.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              <Wrench className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Ni opreme. Dodaj prvo.</p>
            </CardContent></Card>
          ) : equipment.map((e) => (
            <Card key={e.id} className="transition-[border-color,box-shadow] duration-150 hover:border-roksal-navy/25 dark:hover:border-roksal-ink/25 hover:shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-roksal-ink">{e.naziv}</span>
                      <Badge variant="outline" className={`text-[8px] shrink-0 ${EQUIPMENT_STATUS_COLORS[e.status] ?? 'bg-muted'}`}>
                        {EQUIPMENT_STATUS_LABELS[e.status] ?? e.status}
                      </Badge>
                    </div>
                    <div className="text-[10px] tabular-nums text-muted-foreground">
                      {EQUIPMENT_TYPES[e.tip] || e.tip} · {e.lokacija || 'Brez lokacije'} · {e.assignmentsCount} rezervacij
                      {e.serijskaStevilka && <span className="ml-1"> · SN {e.serijskaStevilka}</span>}
                    </div>
                    {/* R145 (§31): življenjski cikl — kalibracija (fail-closed
                        poudarki: POTEČENA rdeče, manjka potrdilo/rok oramno). */}
                    {e.calibrationRequired && (
                      <div className="mt-1 text-[10px] tabular-nums">
                        {e.calibrationOverdue ? (
                          <span className="inline-flex items-center gap-1 rounded border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 font-semibold text-red-700 dark:text-red-300">
                            <AlertTriangle className="h-3 w-3" aria-hidden /> Kalibracija potečena ({e.calibrationDueDate ? formatDate(e.calibrationDueDate) : '—'})
                          </span>
                        ) : e.calibrationMissing ? (
                          <span className="inline-flex items-center gap-1 rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 text-amber-800 dark:text-amber-200">
                            <AlertTriangle className="h-3 w-3" aria-hidden /> Manjka potrdilo/rok kalibracije
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <ShieldCheck className="h-3 w-3 text-green-600 dark:text-green-400" aria-hidden />
                            Kalibracija do {e.calibrationDueDate ? formatDate(e.calibrationDueDate) : '—'}{e.calibrationCertificate ? ` · ${e.calibrationCertificate}` : ''}
                          </span>
                        )}
                      </div>
                    )}
                    {e.inspectionIntervalDays !== null && (
                      <div className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                        {e.inspectionDue ? (
                          <span className="font-semibold text-amber-700 dark:text-amber-300">Pregled zadelju{e.nextInspectionAt ? ` (rok ${formatDate(e.nextInspectionAt)})` : ''}</span>
                        ) : e.inspectionUnknown ? (
                          <span className="text-amber-700 dark:text-amber-300">Pregled ni še zabeležen (interval {e.inspectionIntervalDays} dni)</span>
                        ) : (
                          <span>Naslednji pregled: {e.nextInspectionAt ? formatDate(e.nextInspectionAt) : '—'}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {/* Statusne tranzicije (matrika §31 — samo dovoljeni cilji;
                    UPOKOJENO je izpostavljeno ločeno (terminalno — rdeče) in
                    zahteva zaveden klik). */}
                {e.status !== 'UPOKOJENO' && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {allowedTransitions(e.status).filter((s) => s !== 'UPOKOJENO').map((s) => (
                      <Button
                        key={s}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
                        aria-label={`${EQUIPMENT_STATUS_LABELS[s] ?? s}: ${e.naziv}`}
                        onClick={() => void handleEquipmentStatus(e, s)}
                      >
                        {s === 'V_SERVISU' ? 'V servis' : EQUIPMENT_STATUS_LABELS[s] ?? s}
                      </Button>
                    ))}
                    {allowedTransitions(e.status).includes('UPOKOJENO') && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 focus-visible:ring-2 focus-visible:ring-red-400/50"
                        aria-label={`Upokoji ${e.naziv} (terminalno — ni mogoče razveljaviti)`}
                        title="Upokojitev je terminalna — ni mogoče razveljaviti"
                        onClick={() => void handleEquipmentStatus(e, 'UPOKOJENO')}
                      >
                        Upokoji
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] bg-roksal-navy/5 focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
                      aria-label={`Zabeleži dogodek za ${e.naziv}`}
                      onClick={() => void openEventDialog(e)}
                    >
                      <History className="h-3 w-3 mr-1" aria-hidden /> Zabeleži
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog: nov termin */}
      <Dialog open={newScheduleOpen} onOpenChange={setNewScheduleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-roksal-ink">Nov termin montaže</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div><Label className="text-xs">Projekt *</Label>
              <Select value={schedProject} onValueChange={setSchedProject}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.nazivProjekta} — {p.customer.ime}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Ekipa</Label>
              <Select value={schedCrew} onValueChange={setSchedCrew}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Brez ekipe" /></SelectTrigger>
                <SelectContent>{crews.map((c) => <SelectItem key={c.id} value={c.id}>{c.naziv}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Datum *</Label><Input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} className="h-9" /></div>
              <div><Label className="text-xs">Ura začetka</Label><Input type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} className="h-9" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Predvidene ure</Label><Input type="number" value={schedHours} onChange={(e) => setSchedHours(e.target.value)} className="h-9" /></div>
              <div><Label className="text-xs">Lokacija</Label><Input value={schedLocation} onChange={(e) => setSchedLocation(e.target.value)} placeholder="naslov" className="h-9" /></div>
            </div>
            {/* R145 (§31): dodelitev opreme — samo rezervirljiva (brez
                UPOKOJENO/IZGUBLJENO/V_SERVISU); konflikt javi strežnik (409). */}
            <div>
              <Label className="text-xs">Oprema ({schedEquipment.length} izbranih)</Label>
              {equipment.filter((e0) => !['UPOKOJENO', 'IZGUBLJENO', 'V_SERVISU'].includes(e0.status)).length === 0 ? (
                <p className="text-[10px] text-muted-foreground py-1">Ni rezervirljive opreme.</p>
              ) : (
                <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border p-2">
                  {equipment.filter((e0) => !['UPOKOJENO', 'IZGUBLJENO', 'V_SERVISU'].includes(e0.status)).map((e0) => (
                    <label key={e0.id} className="flex cursor-pointer items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-[#1d2b3e] focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
                        checked={schedEquipment.includes(e0.id)}
                        onChange={(ev) => {
                          setSchedEquipment((prev) => ev.target.checked ? [...prev, e0.id] : prev.filter((x) => x !== e0.id))
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate">{e0.naziv}</span>
                      <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">{e0.assignmentsCount}×</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewScheduleOpen(false)}>Prekliči</Button>
            <Button type="button" onClick={handleCreateSchedule} className="bg-roksal-navy text-white">Shrani</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: preloži termin (R142 §30) — nov datum/ura, strežnik javi
          prekrivanja vira s 409 in človeku berljivim razlogom. */}
      <Dialog open={moveTarget !== null} onOpenChange={(open) => !open && setMoveTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-roksal-ink">
              <CalendarClock className="h-4.5 w-4.5 text-roksal-amber" />
              Preloži termin
            </DialogTitle>
          </DialogHeader>
          {moveTarget && (
            <p className="text-[11px] text-muted-foreground">
              {moveTarget.project} · trenutno status{' '}
              <span className="font-semibold text-roksal-ink">{STATUS_LABELS[moveTarget.status] ?? moveTarget.status}</span>
            </p>
          )}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Nov datum *</Label><Input type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} className="h-9" /></div>
              <div><Label className="text-xs">Ura začetka</Label><Input type="time" value={moveTime} onChange={(e) => setMoveTime(e.target.value)} className="h-9" /></div>
            </div>
            <div><Label className="text-xs">Trajanje (ure)</Label><Input type="number" min="1" max="24" value={moveHours} onChange={(e) => setMoveHours(e.target.value)} className="h-9 tabular-nums" /></div>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Če ekipa ali monter v novem oknu ima že drug termin, bo preložitev zavrnjena (409) z razlago — nič ne bo tiho prekrivano.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMoveTarget(null)}>Prekliči</Button>
            <Button
              type="button"
              onClick={() => void handleMoveSchedule()}
              disabled={moveBusy || !moveDate}
              className="bg-roksal-navy hover:bg-roksal-navy/90 text-white focus-visible:ring-roksal-navy/40"
            >
              {moveBusy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Preloži
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: nova ekipa */}
      <Dialog open={newCrewOpen} onOpenChange={setNewCrewOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-roksal-ink">Nova ekipa</DialogTitle></DialogHeader>
          <div><Label className="text-xs">Naziv ekipe</Label><Input value={crewNaziv} onChange={(e) => setCrewNaziv(e.target.value)} placeholder="npr. Ekipa A" className="h-9" /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewCrewOpen(false)}>Prekliči</Button>
            <Button type="button" onClick={handleCreateCrew} className="bg-roksal-navy text-white">Shrani</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: nova oprema */}
      <Dialog open={newEquipOpen} onOpenChange={setNewEquipOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-roksal-ink">Nova oprema</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div><Label className="text-xs">Naziv</Label><Input value={equipNaziv} onChange={(e) => setEquipNaziv(e.target.value)} placeholder="npr. Laser Bosch GLM 50C" className="h-9" /></div>
            <div><Label className="text-xs">Tip</Label>
              <Select value={equipTip} onValueChange={setEquipTip}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(EQUIPMENT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewEquipOpen(false)}>Prekliči</Button>
            <Button type="button" onClick={handleCreateEquip} className="bg-roksal-navy text-white">Shrani</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: zabeleži pregled/kalibracijo/servis/popravilo (R145 §31).
          Fail-closed pogodba je na strežniku: kalibracija merske opreme BREZ
          potrdila → 400 (toast pokaže razlog — ni tiho ugibanja). */}
      <Dialog open={eventTarget !== null} onOpenChange={(open) => !open && setEventTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-roksal-ink">
              <History className="h-4.5 w-4.5 text-roksal-amber" />
              Zabeleži dogodek
            </DialogTitle>
          </DialogHeader>
          {eventTarget && (
            <p className="text-[11px] text-muted-foreground">
              {eventTarget.naziv}
              {eventTarget.serijskaStevilka ? ` · SN ${eventTarget.serijskaStevilka}` : ''}
              {eventTarget.calibrationRequired ? ' · merska oprema' : ''}
            </p>
          )}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Tip dogodka</Label>
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EQUIPMENT_EVENT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Rezultat</Label>
                <Select value={eventResult} onValueChange={setEventResult}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="V_REDU">V redu</SelectItem>
                    <SelectItem value="NAPAKA">Napaka</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-xs">Izvedeno *</Label><Input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="h-9 tabular-nums" /></div>
            {eventType === 'KALIBRACIJA' && (
              <>
                <div><Label className="text-xs">Potrdilo (obvezno za mersko opremo)</Label><Input value={eventCertificate} onChange={(e) => setEventCertificate(e.target.value)} placeholder="npr. CAL-2026-0142 / Siemens" className="h-9" /></div>
                <div><Label className="text-xs">Naslednja kalibracija (rok)</Label><Input type="date" value={eventNextDue} onChange={(e) => setEventNextDue(e.target.value)} className="h-9 tabular-nums" /></div>
              </>
            )}
            <div><Label className="text-xs">Opomba</Label><Input value={eventOpomba} onChange={(e) => setEventOpomba(e.target.value)} placeholder="neobvezno" className="h-9" /></div>
            {/* Zgodovina (zadnjih 20) — deterministični red strežnika. */}
            {eventHistoryFor === eventTarget?.id && eventHistory.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Zadnji dogodki</Label>
                <div className="max-h-28 space-y-1 overflow-y-auto rounded-md border p-2">
                  {eventHistory.map((h) => (
                    <div key={h.id} className="flex items-center gap-2 text-[10px] tabular-nums">
                      <span className="font-semibold text-roksal-ink">{EQUIPMENT_EVENT_LABELS[h.type] ?? h.type}</span>
                      <span className="text-muted-foreground">{formatDate(h.performedAt)}</span>
                      {h.result === 'NAPAKA' && <span className="font-semibold text-red-700 dark:text-red-300">NAPAKA</span>}
                      {h.certificate && <span className="truncate text-muted-foreground">· {h.certificate}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Dogodek v prihodnosti ni mogoč (preverba na strežniku). Kalibracija merske opreme zahteva potrdilo — sicer zavržena (400).
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEventTarget(null)}>Prekliči</Button>
            <Button
              type="button"
              onClick={() => void handleLogEvent()}
              disabled={eventBusy || !eventDate || (eventType === 'KALIBRACIJA' && eventTarget?.calibrationRequired && !eventCertificate)}
              className="bg-roksal-navy hover:bg-roksal-navy/90 text-white focus-visible:ring-roksal-navy/40"
            >
              {eventBusy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Zabeleži
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: preverba kakovosti PRED zaključitvijo (R146 §27).
          Deterministična predloga (lib/qc-gate, qc-v1): napaka brez opombe ni
          shranjena; preverba NE prehaja → zaključitev ostane zaprta; override
          z razlogom je ločena, izrecna pot (strežnik ga revizira). */}
      <Dialog open={qcTarget !== null} onOpenChange={(open) => !open && setQcTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-roksal-ink">
              <ShieldCheck className="h-4.5 w-4.5 text-roksal-amber" />
              Preverba kakovosti
            </DialogTitle>
          </DialogHeader>
          {qcTarget && (
            <p className="text-[11px] text-muted-foreground">
              {qcTarget.project} · zaključitev odšteje material iz zaloge
            </p>
          )}
          <div className="space-y-2">
            <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-md border p-2">
              {QC_TEMPLATE.map((t) => (
                <div key={t.key}>
                  <label className="flex cursor-pointer items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-3.5 w-3.5 accent-[#1d2b3e] focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
                      checked={qcChecked[t.key] === true}
                      aria-label={t.label}
                      onChange={(e) => setQcChecked((prev) => ({ ...prev, [t.key]: e.target.checked }))}
                    />
                    <span className="flex-1">{t.label}</span>
                  </label>
                  {qcChecked[t.key] !== true && (
                    <Input
                      value={qcNotes[t.key] || ''}
                      onChange={(e) => setQcNotes((prev) => ({ ...prev, [t.key]: e.target.value }))}
                      placeholder="Napaka / korektivni ukrep (obvezno)"
                      className="mt-1 ml-6 h-7 text-[11px]"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-[11px] tabular-nums">
              {qcPassed ? (
                <span className="inline-flex items-center gap-1 font-semibold text-green-700 dark:text-green-300">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Preverba prehaja — vse izpolnjeno
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5" /> Napake: {qcDefects} — zaključitev ne bo prehajala
                </span>
              )}
            </div>
            {/* Override — izrecna, ločena pot (razlog gre v revizijo QC_OVERRIDE). */}
            {qcOverrideMode ? (
              <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40/60 p-2">
                <Label className="text-xs font-semibold text-red-700 dark:text-red-300">Zaključi brez preverbe (override)</Label>
                <Input
                  value={qcOverrideReason}
                  onChange={(e) => setQcOverrideReason(e.target.value)}
                  placeholder="Razlog (obvezen, reviziran kot QC_OVERRIDE)"
                  className="mt-1 h-8 text-xs"
                />
                <p className="mt-1 text-[10px] text-red-700/80 dark:text-red-300/80">Razlog se nespremenljivo zapiše v revizijsko sled skupaj z zaključitvijo.</p>
                <div className="mt-2 flex gap-2">
                  <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setQcOverrideMode(false)}>Nazaj na preverbo</Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={qcBusy || !qcOverrideReason.trim()}
                    className="h-7 bg-red-600 text-[11px] text-white hover:bg-red-700 focus-visible:ring-red-400/50"
                    onClick={() => void handleQcOverride()}
                  >
                    {qcBusy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    Zaključi z override
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="text-left text-[10px] text-muted-foreground underline underline-offset-2 hover:text-red-700 dark:hover:text-red-300"
                onClick={() => setQcOverrideMode(true)}
              >
                Preverba ni mogoča — zaključi z izrecnim override (razlog se revizira) →
              </button>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setQcTarget(null)}>Prekliči</Button>
            <Button
              type="button"
              onClick={() => void handleQcSubmit()}
              disabled={qcBusy || !qcValid}
              className="bg-roksal-navy hover:bg-roksal-navy/90 text-white focus-visible:ring-roksal-navy/40"
            >
              {qcBusy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {qcPassed ? 'Preverba + zaključi' : 'Shrani preverbo (z napakami)'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: montažno dokazilo (R147 §28) — pred/po fotke, lokacija, GPS
          po policyju (samo s soglasjem, koordinate iz naprave), verzirani
          checklist (iev-v1), napake, dokaz predaje (predaja zakleni). */}
      <Dialog open={evTarget !== null} onOpenChange={(open) => !open && setEvTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-roksal-ink">
              <FileCheck2 className="h-4.5 w-4.5 text-roksal-ink" />
              Montažno dokazilo
            </DialogTitle>
          </DialogHeader>
          {evTarget && (
            <p className="text-[11px] text-muted-foreground">
              {evTarget.project}
              {evExisting ? ` · verzija ${evExisting.templateVersion} · ustvaril ${evExisting.createdBy ?? '—'}` : ' · še ni shranjeno'}
            </p>
          )}
          <div className="space-y-3">
            {evExisting?.locked ? (
              <div className="flex items-center gap-2 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40/60 p-2 text-[11px] font-semibold text-green-700 dark:text-green-300">
                <Lock className="h-3.5 w-3.5" /> Zaklenjeno s predajo ({evExisting.handoverName ?? '—'})
              </div>
            ) : null}
            <div>
              <Label className="text-xs font-semibold">Lokacija montaže *</Label>
              <Input
                value={evLokacija}
                onChange={(e) => setEvLokacija(e.target.value)}
                placeholder="Naslov / objekt (obvezno)"
                className="mt-1 h-8 text-xs"
                aria-label="Lokacija montaže"
              />
            </div>
            {/* Fotke PRED/PO (§28 before/after): samo obstoječe fotke projekta. */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Fotka PRED</Label>
                <Select value={evBeforeId || undefined} onValueChange={setEvBeforeId}>
                  <SelectTrigger className="mt-1 h-8 text-xs" aria-label="Izberi fotografijo PRED">
                    <SelectValue placeholder={evPhotos.pred.length === 0 ? 'Ni PRED fotk' : 'Izberi'} />
                  </SelectTrigger>
                  <SelectContent>
                    {evPhotos.pred.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.opomba || `Fotka (${p.createdAt.slice(0, 10)})`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Fotka PO</Label>
                <Select value={evAfterId || undefined} onValueChange={setEvAfterId}>
                  <SelectTrigger className="mt-1 h-8 text-xs" aria-label="Izberi fotografijo PO">
                    <SelectValue placeholder={evPhotos.po.length === 0 ? 'Ni PO fotk' : 'Izberi'} />
                  </SelectTrigger>
                  <SelectContent>
                    {evPhotos.po.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.opomba || `Fotka (${p.createdAt.slice(0, 10)})`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* GPS po policyju: koordinate pridejo IZ naprave, samo z izrecnim
                soglasjem — brez soglasja se nič ne zapiše (fail-closed). */}
            <label className="flex cursor-pointer items-start gap-2 text-xs">
              <input
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5 accent-[#1d2b3e] focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
                checked={evGpsConsent}
                aria-label="Z dovoljenjem zabeleži GPS lokacijo"
                onChange={(e) => handleEvGpsConsent(e.target.checked)}
              />
              <span className="flex-1">
                Zabeleži GPS lokacijo <span className="text-muted-foreground">(samo z vašim dovoljenjem)</span>
                {evGpsConsent && evGps && (
                  <span className="ml-1 tabular-nums">· {evGps.lat.toFixed(5)}, {evGps.lng.toFixed(5)}</span>
                )}
              </span>
            </label>
            <div>
              <Label className="text-xs font-semibold">Checklist dokazila *</Label>
              <div className="mt-1 max-h-44 space-y-1.5 overflow-y-auto rounded-md border p-2">
                {IEV_TEMPLATE.map((t) => (
                  <div key={t.key}>
                    <label className="flex cursor-pointer items-start gap-2 text-xs">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-3.5 w-3.5 accent-[#1d2b3e] focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
                        checked={evChecked[t.key] === true}
                        aria-label={t.label}
                        onChange={(e) => setEvChecked((prev) => ({ ...prev, [t.key]: e.target.checked }))}
                      />
                      <span className="flex-1">{t.label}</span>
                    </label>
                    {evChecked[t.key] !== true && (
                      <Input
                        value={evNotes[t.key] || ''}
                        onChange={(e) => setEvNotes((prev) => ({ ...prev, [t.key]: e.target.value }))}
                        placeholder="Razlog / korektivni ukrep (obvezno)"
                        className="mt-1 ml-6 h-7 text-[11px]"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">Napake / defekti</Label>
              <textarea
                value={evDefects}
                onChange={(e) => setEvDefects(e.target.value)}
                placeholder="Ena napaka na vrstico (prazno = brez napak)"
                rows={2}
                aria-label="Napake in defekti (ena na vrstico)"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
              />
            </div>
            {/* Dokaz predaje — strežnik zavrača brez PRED+PO fotk (fail-closed 409). */}
            {evExisting && !evExisting.locked && (
              <div className="rounded-md border border-roksal-navy/20 dark:border-roksal-ink/20 bg-roksal-navy/5 p-2">
                <Label className="text-xs font-semibold">Potrditev predaje</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    value={evHandoverName}
                    onChange={(e) => setEvHandoverName(e.target.value)}
                    placeholder="Predal / predajnik (ime)"
                    className="h-8 flex-1 text-xs"
                    aria-label="Ime predajnika"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={evBusy || !evHandoverName.trim() || !evExisting.hasBefore || !evExisting.hasAfter}
                    className="h-8 bg-roksal-navy text-[11px] text-white hover:bg-roksal-navy/90 focus-visible:ring-roksal-navy/40"
                    onClick={() => void handleEvidenceHandover()}
                  >
                    {evBusy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    Potrdi predajo
                  </Button>
                </div>
                {(!evExisting.hasBefore || !evExisting.hasAfter) && (
                  <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">
                    Predaja zahteva PRED in PO fotografijo — {(!evExisting.hasBefore && !evExisting.hasAfter) ? 'manjkata oba' : 'manjka ena'} (shranite dokazilo z izbranimi fotkami).
                  </p>
                )}
              </div>
            )}
            <div className="flex items-center justify-between text-[11px] tabular-nums">
              {evValid ? (
                <span className="inline-flex items-center gap-1 font-semibold text-green-700 dark:text-green-300">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {evAllChecked ? 'Checklist polno' : `Checklist: ${IEV_TEMPLATE.filter((t) => evChecked[t.key] === true).length}/${IEV_TEMPLATE.length}`} · napake: {evDefectsList.length}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5" /> Neizpolnjene postavke potrebujejo opombo
                </span>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEvTarget(null)}>Zapri</Button>
            <Button
              type="button"
              onClick={() => void handleEvidenceSave()}
              disabled={evBusy || evExisting?.locked === true || !evValid || !evLokacija.trim()}
              className="bg-roksal-navy hover:bg-roksal-navy/90 text-white focus-visible:ring-roksal-navy/40"
            >
              {evBusy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {evExisting ? 'Posodobi dokazilo' : 'Shrani dokazilo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
