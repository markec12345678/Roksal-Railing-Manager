'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { WeatherCard } from '@/components/roksal/weather-card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MapPin,
  CalendarDays,
  BatteryMedium,
  Wifi,
  TrendingUp,
  Clock,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Plus,
  FileText,
  Ruler,
  Package,
  Loader2,
  X,
  Search,
  Activity,
  PackageX,
  Filter,
  Phone,
  Pencil,
  Archive,
  Mail,
  Calculator,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Globe,
  Copy,
  MessageSquare,
  RefreshCw,
  Link2,
  Eye,
  EyeOff,
  ShieldCheck,
  KeyRound,
  History,
  CalendarClock,
} from 'lucide-react'
import { toast } from 'sonner'

interface Project {
  id: string
  nazivProjekta: string
  status: string
  datumMontaze: string | null
  customer?: { id?: string; ime: string; naslov: string; telefon?: string; email?: string }
  monter?: { id: string; ime: string; vloga: string }
  _count?: { documents: number; auditLogs: number; measurements?: number }
  opombe?: string | null
  createdAt?: string
  updatedAt?: string
  // GPS (API ju vrača iz Prisme; uporablja jih vremenska kartica za montažo)
  latitude?: number | null
  longitude?: number | null
}

interface InventoryItem {
  id: string
  naziv: string
  sifraMateriala: string
  kolicinaZaloga: number
  minimalnaZaloga: number
  enota: string
  tip: string
}

interface Customer {
  id: string
  ime: string
  naslov: string
  telefon?: string | null
  email?: string | null
  createdAt?: string
  _count?: { projects: number }
}

const statusLabels: Record<string, string> = {
  NACRTOVANO: 'Načrtovano',
  V_TEKU: 'V teku',
  ZAKLJUCENO: 'Zaključeno',
  USTAVLJENO: 'Ustavljeno',
}

const statusColors: Record<string, string> = {
  NACRTOVANO: 'bg-blue-100 text-blue-800',
  V_TEKU: 'bg-roksal-amber/20 text-roksal-navy',
  ZAKLJUCENO: 'bg-roksal-green/20 text-roksal-green',
  USTAVLJENO: 'bg-roksal-red/20 text-roksal-red',
}

const statusFilterTabs = [
  { id: 'ALL', label: 'Vsi' },
  { id: 'V_TEKU', label: 'V teku' },
  { id: 'NACRTOVANO', label: 'Načrtovano' },
  { id: 'ZAKLJUCENO', label: 'Zaključeni' },
]

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('sl-SI', {
    day: 'numeric',
    month: 'short',
  })
}

function formatDateNice(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((today.getTime() - date.getTime()) / 86400000)

  if (diffDays === 0) return 'danes'
  if (diffDays === 1) return 'včeraj'
  if (diffDays === -1) return 'jutri'
  if (diffDays === -2) return 'pjutri'
  if (diffDays > 1 && diffDays <= 7) return `pred ${diffDays} dnevi`
  if (diffDays > 7 && diffDays <= 30) return `pred ${Math.floor(diffDays / 7)} tedni`
  if (diffDays < -2 && diffDays >= -7) return `čez ${Math.abs(diffDays)} dni`
  return formatDate(dateStr)
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMs / 3600000)
  const diffD = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'Pravkar'
  if (diffMin < 60) return `pred ${diffMin} min`
  if (diffH < 24) return `pred ${diffH} ur`
  if (diffD < 7) return `pred ${diffD} dni`
  return formatDate(dateStr)
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 6) return 'Dobro jutro'
  if (h < 12) return 'Dobro jutro'
  if (h < 18) return 'Dober dan'
  return 'Dobro večer'
}

function getTodayString(): string {
  return new Date().toLocaleDateString('sl-SI', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

interface ActivityItem {
  id: string
  type: 'project_created' | 'status_change' | 'completed' | 'low_stock' | 'measurement'
  icon: React.ElementType
  iconColor: string
  title: string
  description: string
  time: string
}

function estimateSlats(measurements: Array<{ dolzinaMm: number }>, slatWidth: number = 80, maxGap: number = 100): number {
  return measurements.reduce((total, m) => {
    const n = Math.ceil((m.dolzinaMm - maxGap) / (maxGap + slatWidth))
    return total + n
  }, 0)
}

function MiniRailingDiagram({ dolzina, visina }: { dolzina: number; visina: number }) {
  const maxDim = Math.max(dolzina, visina)
  const heightPct = Math.min((visina / maxDim) * 30, 30)
  const n = Math.ceil((dolzina - 100) / (100 + 80))
  const actualGap = (dolzina - n * 80) / (n + 1)
  const numSlats = Math.min(n, 12)
  const gapPct = actualGap / dolzina * 100

  return (
    <div className="relative rounded-md border border-roksal-navy/15 bg-gradient-to-b from-roksal-navy/3 to-roksal-navy/6 p-2" style={{ minHeight: `${Math.max(heightPct, 14)}px` }}>
      <div className="flex items-end h-full gap-0" style={{ height: `${Math.max(heightPct, 14)}px` }}>
        <div className="w-[3px] h-full bg-roksal-navy rounded-full" />
        <div className="flex-1 flex items-end h-full gap-0">
          <div className="h-full bg-transparent" style={{ width: `${gapPct}%` }} />
          {Array.from({ length: numSlats }).map((_, i) => (
            <div key={i} className="flex h-full">
              <div className="h-[85%] bg-roksal-navy/70 rounded-[1px]" style={{ width: `${(80 / dolzina) * 100}%`, minWidth: '1px' }} />
              {i < numSlats - 1 && (
                <div className="h-full bg-roksal-amber/25" style={{ width: `${gapPct}%`, minWidth: '1px' }} />
              )}
            </div>
          ))}
          <div className="h-full bg-transparent" style={{ width: `${gapPct}%` }} />
        </div>
        <div className="w-[3px] h-full bg-roksal-navy rounded-full" />
      </div>
      <div className="mt-0.5 flex">
        <div className="w-[3px] bg-roksal-navy rounded-full" />
        <div className="flex-1 h-[2px] bg-roksal-navy/30 rounded" />
        <div className="w-[3px] bg-roksal-navy rounded-full" />
      </div>
    </div>
  )
}

interface DashboardTabProps {
  selectedProjectId?: string | null
  onSelectProject?: (id: string) => void
}

export function DashboardTab({ selectedProjectId, onSelectProject }: DashboardTabProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [invLoading, setInvLoading] = useState(true)

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // New project dialog
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectCustomer, setNewProjectCustomer] = useState('')
  const [newProjectDate, setNewProjectDate] = useState('')
  const [newProjectNotes, setNewProjectNotes] = useState('')
  const [creating, setCreating] = useState(false)

  // New customer dialog
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false)
  const [newCustomerIme, setNewCustomerIme] = useState('')
  const [newCustomerNaslov, setNewCustomerNaslov] = useState('')
  const [newCustomerTelefon, setNewCustomerTelefon] = useState('')
  const [newCustomerEmail, setNewCustomerEmail] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [creatingCustomer, setCreatingCustomer] = useState(false)

  // Project detail dialog
  const [detailProject, setDetailProject] = useState<Project | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)

  // Status change dropdown
  const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null)

  // Project detail measurements
  const [detailMeasurements, setDetailMeasurements] = useState<Array<{
    id: string; dolzinaMm: number; visinaMm: number; lokacija?: string | null; createdAt: string; tipPodlage?: string | null
  }>>([])
  const [detailMeasurementsLoading, setDetailMeasurementsLoading] = useState(false)
  const [detailMeasurementsExpanded, setDetailMeasurementsExpanded] = useState(false)

  // Portal stranke (client portal management)
  interface PortalInfo {
    enabled: boolean
    token: string | null
    url: string | null
    /** R132 (§7): življenjski cikl žetona — potek, revokacija, zadnji dostop. */
    expiresAt: string | null
    revokedAt: string | null
    lastUsedAt: string | null
    clientNotes: string | null
    estimatedPrice: number | null
    /** R133 (§8): scoped merilna povezava — LOČEN žeton, ločen cikl. */
    measure: {
      enabled: boolean
      token: string | null
      url: string | null
      expiresAt: string | null
      revokedAt: string | null
      lastUsedAt: string | null
    } | null
  }
  const [portalInfo, setPortalInfo] = useState<PortalInfo | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalActionLoading, setPortalActionLoading] = useState(false)
  const [portalNotesInput, setPortalNotesInput] = useState('')
  const [portalPriceInput, setPortalPriceInput] = useState('')
  const [portalShowPrice, setPortalShowPrice] = useState(false)

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects')
      if (res.ok) {
        const data = await res.json()
        setProjects(data)
      }
    } catch {
      setProjects(demoProjects)
    }
  }, [])

  const fetchInventory = useCallback(async () => {
    setInvLoading(true)
    try {
      const res = await fetch('/api/inventory')
      if (res.ok) {
        const data = await res.json()
        setInventory(data)
      }
    } catch {
      // keep empty
    } finally {
      setInvLoading(false)
    }
  }, [])

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch('/api/customers')
      if (res.ok) {
        const data = await res.json()
        setCustomers(data)
      }
    } catch {
      setCustomers([])
    }
  }, [])

  useEffect(() => {
    async function fetchAll() {
      try {
        await Promise.all([fetchProjects(), fetchInventory(), fetchCustomers()])
      } catch {
        setProjects(demoProjects)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [fetchProjects, fetchInventory, fetchCustomers])

  // Filtered & searched projects
  const filteredProjects = useMemo(() => {
    let result = projects
    if (statusFilter !== 'ALL') {
      result = result.filter((p) => p.status === statusFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (p) =>
          p.nazivProjekta.toLowerCase().includes(q) ||
          p.customer?.ime.toLowerCase().includes(q) ||
          p.customer?.naslov?.toLowerCase().includes(q)
      )
    }
    return result
  }, [projects, statusFilter, searchQuery])

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers
    const q = customerSearch.trim().toLowerCase()
    return customers.filter(
      (c) =>
        c.ime.toLowerCase().includes(q) ||
        c.naslov.toLowerCase().includes(q) ||
        (c.telefon ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q)
    )
  }, [customers, customerSearch])

  const activeProjects = filteredProjects.filter((p) => p.status === 'V_TEKU')
  const activeCount = projects.filter((p) => p.status === 'V_TEKU').length
  const pendingCount = projects.filter((p) => p.status === 'NACRTOVANO').length
  const completedCount = projects.filter((p) => p.status === 'ZAKLJUCENO').length
  const totalProjects = projects.length
  const totalInventoryItems = inventory.length

  const nextInstallation = projects.find((p) => p.status === 'V_TEKU') || projects.find((p) => p.status === 'NACRTOVANO')

  const lowStockItems = inventory.filter(
    (i) => i.kolicinaZaloga <= i.minimalnaZaloga
  )
  const lowStockCount = lowStockItems.length

  // ── Danes & opozorila ────────────────────────────────────────────────────
  // Termini z montažo danes + zapadli projekti (datum montaže je mimo,
  // projekt pa še ni zaključen). Vodja/monter tako vidi takoj, kaj mora
  // biti rešeno še danes — "Naslednja montaža" prikaže samo prvo.
  const todayInstallations = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    return projects
      .filter((p) => {
        if (!p.datumMontaze || p.status === 'ZAKLJUCENO') return false
        const d = new Date(p.datumMontaze)
        return d >= start && d < end
      })
      .sort((a, b) => a.nazivProjekta.localeCompare(b.nazivProjekta))
  }, [projects])

  const overdueProjects = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    return projects
      .filter((p) => {
        if (!p.datumMontaze || p.status === 'ZAKLJUCENO' || p.status === 'USTAVLJENO') return false
        return new Date(p.datumMontaze) < start
      })
      .sort((a, b) => new Date(a.datumMontaze ?? 0).getTime() - new Date(b.datumMontaze ?? 0).getTime())
  }, [projects])

  // Najstarejši zapadli dan (za oznako "X dni čez termin")
  const overdueDays = (p: Project): number => {
    if (!p.datumMontaze) return 0
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    return Math.max(1, Math.round((start.getTime() - new Date(p.datumMontaze).getTime()) / 86400000))
  }

  // Projekti z enakim imenom (in isto stranko) se v seznamu združijo v eno
  // vrstico z značko ×N — enak vzorec kot dedup obvestil. Klik odpre prvi
  // (najstarejši) zadetek; xN opozori vodjo, da je zapisa več.
  const groupedToday = useMemo(() => {
    const map = new Map<string, { p: Project; n: number }>()
    for (const p of todayInstallations) {
      const key = `${p.nazivProjekta}|${p.customer?.ime ?? ''}`
      const e = map.get(key)
      if (e) e.n++
      else map.set(key, { p, n: 1 })
    }
    return [...map.values()]
  }, [todayInstallations])

  const groupedOverdue = useMemo(() => {
    const map = new Map<string, { p: Project; n: number }>()
    for (const p of overdueProjects) {
      const key = `${p.nazivProjekta}|${p.customer?.ime ?? ''}`
      const e = map.get(key)
      if (e) e.n++
      else map.set(key, { p, n: 1 })
    }
    return [...map.values()]
  }, [overdueProjects])

  // ── Trend aktivnosti (zadnjih 6 mesecev) ─────────────────────────────────
  // Novi projekti po mesecu nastanka (createdAt) in zaključeni po mesecu
  // posodobitve (updatedAt) — čist SVG/DOM, brez odvisnosti od graf knjižnic.
  const monthlyTrend = useMemo(() => {
    const now = new Date()
    const months: { key: string; label: string; newCount: number; doneCount: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString('sl-SI', { month: 'short' }).replace('.', ''),
        newCount: 0,
        doneCount: 0,
      })
    }
    const idx = new Map(months.map((m, i) => [m.key, i]))
    for (const p of projects) {
      if (p.createdAt) {
        const d = new Date(p.createdAt)
        const i = idx.get(`${d.getFullYear()}-${d.getMonth()}`)
        if (i !== undefined) months[i].newCount++
      }
      if (p.status === 'ZAKLJUCENO' && p.updatedAt) {
        const d = new Date(p.updatedAt)
        const i = idx.get(`${d.getFullYear()}-${d.getMonth()}`)
        if (i !== undefined) months[i].doneCount++
      }
    }
    return months
  }, [projects])

  // Generate activity timeline
  const activities: ActivityItem[] = useMemo(() => {
    const items: ActivityItem[] = []

    // Low stock alerts
    for (const item of lowStockItems.slice(0, 2)) {
      items.push({
        id: `low_${item.id}`,
        type: 'low_stock',
        icon: PackageX,
        iconColor: 'text-roksal-red',
        title: 'Nizka zaloga',
        description: `${item.naziv} — ${item.kolicinaZaloga} ${item.enota} (min: ${item.minimalnaZaloga})`,
        time: 'Aktualno',
      })
    }

    // Recent projects (use updatedAt or createdAt)
    const sortedProjects = [...projects].sort((a, b) => {
      const dateA = a.updatedAt || a.createdAt || ''
      const dateB = b.updatedAt || b.createdAt || ''
      return new Date(dateB).getTime() - new Date(dateA).getTime()
    })

    for (const p of sortedProjects.slice(0, 4)) {
      const dateStr = p.updatedAt || p.createdAt || new Date().toISOString()
      if (p.status === 'ZAKLJUCENO') {
        items.push({
          id: `done_${p.id}`,
          type: 'completed',
          icon: CheckCircle2,
          iconColor: 'text-roksal-green',
          title: 'Projekt zaključen',
          description: p.nazivProjekta,
          time: formatRelativeTime(dateStr),
        })
      } else if (p.status === 'V_TEKU') {
        items.push({
          id: `active_${p.id}`,
          type: 'status_change',
          icon: Activity,
          iconColor: 'text-roksal-amber',
          title: 'Projekt v teku',
          description: p.nazivProjekta,
          time: formatRelativeTime(dateStr),
        })
      } else {
        items.push({
          id: `plan_${p.id}`,
          type: 'project_created',
          icon: Wrench,
          iconColor: 'text-roksal-navy',
          title: 'Nov projekt načrtovan',
          description: p.nazivProjekta,
          time: formatRelativeTime(dateStr),
        })
      }
    }

    return items.slice(0, 6)
  }, [projects, lowStockItems])

  async function handleCreateProject() {
    if (!newProjectName.trim() || !newProjectCustomer) {
      toast.error('Izpolnite naziv projekta in izberite stranko')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nazivProjekta: newProjectName,
          customerId: newProjectCustomer,
          datumMontaze: newProjectDate ? new Date(newProjectDate).toISOString() : undefined,
          opombe: newProjectNotes || undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setProjects((prev) => [data, ...prev])
        toast.success('Projekt ustvarjen')
        setNewProjectOpen(false)
        setNewProjectName('')
        setNewProjectCustomer('')
        setNewProjectDate('')
        setNewProjectNotes('')
      } else {
        toast.error('Napaka pri ustvarjanju projekta')
      }
    } catch {
      toast.error('Napaka pri povezavi s strežnikom')
    } finally {
      setCreating(false)
    }
  }

  async function handleCreateCustomer() {
    if (!newCustomerIme.trim() || newCustomerIme.trim().length < 2) {
      toast.error('Ime je obvezno (min 2 znaka)')
      return
    }
    if (!newCustomerNaslov.trim() || newCustomerNaslov.trim().length < 3) {
      toast.error('Naslov je obvezen (min 3 znaki)')
      return
    }
    if (newCustomerEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newCustomerEmail.trim())) {
      toast.error('Neveljaven email format')
      return
    }
    setCreatingCustomer(true)
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ime: newCustomerIme.trim(),
          naslov: newCustomerNaslov.trim(),
          telefon: newCustomerTelefon.trim() || undefined,
          email: newCustomerEmail.trim() || undefined,
        }),
      })
      if (res.ok) {
        const created = await res.json()
        await fetchCustomers()
        setNewProjectCustomer(created.id)
        setCustomerDialogOpen(false)
        setNewCustomerIme('')
        setNewCustomerNaslov('')
        setNewCustomerTelefon('')
        setNewCustomerEmail('')
        toast.success('Stranka ustvarjena')
      } else {
        const err = await res.json().catch(() => null)
        toast.error(err?.error || 'Napaka pri ustvarjanju stranke')
      }
    } catch {
      toast.error('Napaka pri povezavi s strežnikom')
    } finally {
      setCreatingCustomer(false)
    }
  }

  function resetCustomerDialog() {
    setNewCustomerIme('')
    setNewCustomerNaslov('')
    setNewCustomerTelefon('')
    setNewCustomerEmail('')
  }

  function openProjectDetail(project: Project) {
    setDetailProject(project)
    setDetailOpen(true)
    setDetailMeasurementsExpanded(false)
    setStatusDropdownId(null)
    // Reset portal state
    setPortalInfo(null)
    setPortalNotesInput('')
    setPortalPriceInput('')
    setPortalShowPrice(false)
    // Fetch measurements for this project
    setDetailMeasurementsLoading(true)
    setDetailMeasurements([])
    fetch(`/api/measurements?projectId=${project.id}`)
      .then(res => {
        if (res.ok) return res.json()
        return []
      })
      .then(data => setDetailMeasurements(Array.isArray(data) ? data : []))
      .catch(() => setDetailMeasurements([]))
      .finally(() => setDetailMeasurementsLoading(false))
    // Fetch portal info
    setPortalLoading(true)
    fetch(`/api/portal?projectId=${project.id}`)
      .then(res => {
        if (res.ok) return res.json()
        return null
      })
      .then(data => {
        if (data) {
          setPortalInfo(data)
          setPortalNotesInput(data.clientNotes ?? '')
          setPortalPriceInput(data.estimatedPrice != null ? String(data.estimatedPrice) : '')
          setPortalShowPrice(data.estimatedPrice != null)
        }
      })
      .catch(() => setPortalInfo(null))
      .finally(() => setPortalLoading(false))
  }

  async function portalAction(
    action: 'enable' | 'disable' | 'regenerate' | 'revoke' | 'measureEnable' | 'measureDisable' | 'measureRegenerate' | 'measureRevoke',
  ) {
    if (!detailProject) return
    // R132 (§7): revokacija je TRAJNA — stari URL takoj mrtav. Vedno potrditev.
    if (action === 'revoke') {
      const ok = window.confirm(
        'Preklic povezave: stranka z obstoječim URL-jem TAKOJ izgubi dostop (stran postane nedosegljiva).\n\nNova povezava nastane šele z obnovo (regenerate). Prekliči povezavo?',
      )
      if (!ok) return
    }
    // R133 (§8): isti varovalnik za merilno povezavo.
    if (action === 'measureRevoke') {
      const ok = window.confirm(
        'Preklic merilne povezave: stranka z obstoječo merilno povezavo TAKOJ izgubi dostop (ne more več poslati meritve).\n\nNova povezava nastane šele z »Nova povezava«. Prekliči?',
      )
      if (!ok) return
    }
    setPortalActionLoading(true)
    try {
      const res = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: detailProject.id, action }),
      })
      if (res.ok) {
        const data = await res.json()
        setPortalInfo(data)
        if (action === 'enable') toast.success('Portal stranke omogočen (velja 90 dni)')
        else if (action === 'disable') toast.success('Portal stranke onemogočen')
        else if (action === 'regenerate') toast.success('Nova povezava (stara je mrtva, velja 90 dni)')
        else if (action === 'revoke') toast.success('Povezava preklicana — stari URL je nedosegljiv')
        else if (action === 'measureEnable') toast.success('Merilna povezava izdana (velja 90 dni)')
        else if (action === 'measureDisable') toast.success('Merilna povezava začasno izklopljena')
        else if (action === 'measureRegenerate') toast.success('Nova merilna povezava (stara je mrtva, velja 90 dni)')
        else if (action === 'measureRevoke') toast.success('Merilna povezava preklicana — stari URL je nedosegljiv')
      } else {
        const err = await res.json().catch(() => null)
        toast.error(err?.error || 'Napaka pri upravljanju portala')
      }
    } catch {
      toast.error('Napaka pri povezavi s strežnikom')
    } finally {
      setPortalActionLoading(false)
    }
  }

  async function savePortalSettings() {
    if (!detailProject) return
    setPortalActionLoading(true)
    try {
      const priceValue = portalShowPrice
        ? portalPriceInput.trim()
          ? Number(portalPriceInput.replace(',', '.'))
          : null
        : null
      const res = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: detailProject.id,
          action: 'update',
          clientNotes: portalNotesInput.trim() || null,
          estimatedPrice: priceValue,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setPortalInfo(data)
        toast.success('Nastavitve portala shranjene')
      } else {
        const err = await res.json().catch(() => null)
        toast.error(err?.error || 'Napaka pri shranjevanju')
      }
    } catch {
      toast.error('Napaka pri povezavi s strežnikom')
    } finally {
      setPortalActionLoading(false)
    }
  }

  function getPortalUrl(): string {
    if (!portalInfo?.token) return ''
    return `${window.location.origin}/portal/${portalInfo.token}`
  }

  async function copyPortalUrl() {
    const url = getPortalUrl()
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Povezava kopirana')
    } catch {
      // Fallback
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
        toast.success('Povezava kopirana')
      } catch {
        toast.error('Kopiranje ni uspelo')
      }
      document.body.removeChild(ta)
    }
  }

  function sendSmsPortal() {
    const url = getPortalUrl()
    if (!url || !detailProject?.customer?.telefon) {
      toast.error('Stranka nima telefonske številke')
      return
    }
    const phone = detailProject.customer.telefon.replace(/\s+/g, '')
    const body = `Pozdravljeni, sledite napredku vašega projekta: ${url}`
    window.location.href = `sms:${phone}?body=${encodeURIComponent(body)}`
  }

  function sendEmailPortal() {
    const url = getPortalUrl()
    if (!url || !detailProject?.customer?.email) {
      toast.error('Stranka nima e-pošte')
      return
    }
    const subject = `Napredek vašega projekta: ${detailProject?.nazivProjekta ?? ''}`
    const body = `Pozdravljeni,\n\nSledite napredku vašega projekta preko portala stranke:\n${url}\n\nLep pozdrav,\nRoksal d.o.o.`
    window.location.href = `mailto:${detailProject.customer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  // R133 (§8): merilna povezava — lastni URL pomočniki (scoped measureToken).
  function getMeasureUrl(): string {
    if (!portalInfo?.measure?.token) return ''
    return `${window.location.origin}/m/${portalInfo.measure.token}`
  }

  async function copyMeasureUrl() {
    const url = getMeasureUrl()
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Merilna povezava kopirana')
    } catch {
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
        toast.success('Merilna povezava kopirana')
      } finally {
        document.body.removeChild(ta)
      }
    }
  }

  function sendSmsMeasure() {
    const url = getMeasureUrl()
    if (!url || !detailProject?.customer?.telefon) {
      toast.error('Stranka nima telefonske številke')
      return
    }
    const phone = detailProject.customer.telefon.replace(/\s+/g, '')
    const body = 'Pozdravljeni, na povezavi lahko sami izmerite svojo ograjo na karti (2 min): '
    window.location.href = `sms:${phone}?body=${encodeURIComponent(body + url)}`
  }

  function sendEmailMeasure() {
    const url = getMeasureUrl()
    if (!url || !detailProject?.customer?.email) {
      toast.error('Stranka nima e-pošte')
      return
    }
    const subject = 'Samomeritev vaše ograje — Roksal'
    const body = `Pozdravljeni,\n\nNa spodnji povezavi lahko v 2 minutah sami narišete črto vaše ograje na satelitski karti in nam jo pošljete:\n${url}\n\nLep pozdrav,\nRoksal d.o.o.`
    window.location.href = `mailto:${detailProject.customer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  async function handleStatusChange(projectId: string, newStatus: string) {
    setStatusUpdating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: projectId, status: newStatus }),
      })
      if (res.ok) {
        const updated = await res.json()
        setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)))
        if (detailProject?.id === projectId) {
          setDetailProject(updated)
        }
        if (newStatus === 'ZAKLJUCENO') {
          toast.success('Projekt zaključen! 🎉')
        } else {
          toast.success(`Status posodobljen: ${statusLabels[newStatus]}`)
        }
        setStatusDropdownId(null)
      }
    } catch {
      toast.error('Napaka pri posodabljanju statusa')
    } finally {
      setStatusUpdating(false)
    }
  }

  return (
    <div className="space-y-4 px-4 pb-4 pt-2 md:space-y-5 md:px-6 md:pb-6">
      {/* Greeting */}
      <div className="animate-fade-in-up">
        <div className="flex items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-roksal-navy">
              {getGreeting()}, Monter!
            </h2>
            <p className="text-sm text-muted-foreground">{getTodayString()}</p>
          </div>
          {/* Amber poudarek — vizualna povezava z znamko v TopBar */}
          <div className="mb-1.5 h-1.5 w-12 rounded-full bg-gradient-to-r from-roksal-amber via-roksal-amber/60 to-transparent" aria-hidden="true" />
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-thin animate-fade-in-up" style={{ animationDelay: '30ms' }}>
        <Badge className="shrink-0 bg-roksal-navy/10 text-roksal-navy hover:bg-roksal-navy/15 text-[11px] px-2.5 py-1">
          <TrendingUp className="mr-1 h-3 w-3" aria-hidden="true" />
          <span className="font-bold mr-0.5">{activeCount}</span> aktivnih
        </Badge>
        <Badge className="shrink-0 bg-roksal-amber/15 text-roksal-navy hover:bg-roksal-amber/20 text-[11px] px-2.5 py-1">
          <Clock className="mr-1 h-3 w-3 text-roksal-amber" aria-hidden="true" />
          <span className="font-bold mr-0.5">{pendingCount}</span> načrtovanih
        </Badge>
        <Badge className="shrink-0 bg-roksal-green/15 text-roksal-green hover:bg-roksal-green/20 text-[11px] px-2.5 py-1">
          <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" />
          <span className="font-bold mr-0.5">{completedCount}</span> končanih
        </Badge>
        {!invLoading && totalInventoryItems > 0 && (
          <Badge className={`shrink-0 text-[11px] px-2.5 py-1 ${
            lowStockCount > 0
              ? 'bg-roksal-red/15 text-roksal-red hover:bg-roksal-red/20'
              : 'bg-roksal-green/15 text-roksal-green hover:bg-roksal-green/20'
          }`}>
            <Package className="mr-1 h-3 w-3" aria-hidden="true" />
            <span className="font-bold mr-0.5">{totalInventoryItems}</span> artiklov
          </Badge>
        )}
      </div>

      {/* Next Installation Card */}
      <Card className="card-accent-top overflow-hidden border-l-4 border-l-roksal-amber card-hover transition-all duration-200">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-roksal-navy">
              Naslednja montaža
            </CardTitle>
            <Badge className={statusColors[nextInstallation?.status || 'NACRTOVANO']}>
              {statusLabels[nextInstallation?.status || 'NACRTOVANO']}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {loading ? (
            <Skeleton className="h-20 w-full" />
          ) : nextInstallation ? (
            <div className="space-y-2">
              <h3 className="font-bold text-base text-roksal-navy">
                {nextInstallation.nazivProjekta}
              </h3>
              <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-roksal-amber" />
                  <span>{nextInstallation.customer?.naslov || 'Ni naslova'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-3.5 w-3.5 text-roksal-amber" />
                  <span>
                    {nextInstallation.datumMontaze
                      ? formatDateNice(nextInstallation.datumMontaze)
                      : 'Ni datuma'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Wrench className="h-3.5 w-3.5 text-roksal-amber" />
                  <span>
                    {nextInstallation.customer?.ime || 'Ni stranke'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 py-4 text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-roksal-green" />
              <span className="text-sm">Ni načrtovanih montaž</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danes & opozorila — montaže danes + zapadli projekti.
          Klik na vrstico odpre podrobnosti projekta. Kartica se izriše
          samo, kadar kaj obstaja — nič nepotrebne šume na dashboardu. */}
      {(todayInstallations.length > 0 || overdueProjects.length > 0) && (
        <Card
          className={`overflow-hidden border-l-4 card-hover transition-all duration-200 ${
            overdueProjects.length > 0 ? 'border-l-roksal-red' : 'border-l-roksal-amber'
          }`}
        >
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                <CalendarDays className="h-4 w-4 text-roksal-amber" />
                Danes & opozorila
              </CardTitle>
              {(todayInstallations.length + overdueProjects.length) > 0 && (
                <Badge className="bg-roksal-navy/10 text-roksal-navy hover:bg-roksal-navy/15">
                  {todayInstallations.length + overdueProjects.length}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-4">
            {groupedToday.map(({ p, n }) => (
              <button
                key={p.id}
                type="button"
                onClick={() => openProjectDetail(p)}
                className="flex w-full items-center gap-2.5 rounded-lg bg-roksal-amber/10 px-3 py-2.5 text-left transition-all duration-150 hover:bg-roksal-amber/15 active:scale-[0.99]"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-roksal-amber/20">
                  <Wrench className="h-4 w-4 text-roksal-amber" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-roksal-navy">
                    <span className="truncate">{p.nazivProjekta}</span>
                    {n > 1 && (
                      <Badge variant="secondary" className="h-4 shrink-0 rounded-full px-1.5 text-[9px] font-bold">
                        ×{n}
                      </Badge>
                    )}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    Montaža danes · {p.customer?.ime || 'Ni stranke'}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-roksal-amber" />
              </button>
            ))}
            {groupedOverdue.map(({ p, n }) => (
              <button
                key={p.id}
                type="button"
                onClick={() => openProjectDetail(p)}
                className="flex w-full items-center gap-2.5 rounded-lg bg-roksal-red/10 px-3 py-2.5 text-left transition-all duration-150 hover:bg-roksal-red/15 active:scale-[0.99]"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-roksal-red/20">
                  <AlertTriangle className="h-4 w-4 text-roksal-red" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-roksal-navy">
                    <span className="truncate">{p.nazivProjekta}</span>
                    {n > 1 && (
                      <Badge variant="secondary" className="h-4 shrink-0 rounded-full px-1.5 text-[9px] font-bold">
                        ×{n}
                      </Badge>
                    )}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    Zapadlo: {formatDate(p.datumMontaze ?? '')} · {overdueDays(p)} dni čez termin
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-roksal-red" />
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pogoji za montažo — veter, temperatura, ocena tveganja.
          Koordinate vzamemo iz naslednje montaže, sicer Kranj (privzeto v API). */}
      <WeatherCard
        lat={nextInstallation?.latitude ?? null}
        lon={nextInstallation?.longitude ?? null}
        locationLabel={
          nextInstallation?.latitude
            ? nextInstallation.nazivProjekta
            : 'Privzeto: Kranj'
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 animate-fade-in-up md:gap-4" style={{ animationDelay: '50ms' }}>
        <Card className="px-3 py-3 card-hover transition-all duration-200">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-roksal-navy/10">
              <TrendingUp className="h-4 w-4 text-roksal-navy" />
            </div>
            <div>
              <p className="text-lg font-bold text-roksal-navy">{totalProjects}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">Projekti</p>
            </div>
          </div>
        </Card>
        <Card className="px-3 py-3 card-hover transition-all duration-200">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-roksal-amber/10">
              <Clock className="h-4 w-4 text-roksal-amber" />
            </div>
            <div>
              <p className="text-lg font-bold text-roksal-navy">{projects.filter(p => p.status === 'V_TEKU').length}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">V teku</p>
            </div>
          </div>
        </Card>
        <Card className="px-3 py-3 card-hover transition-all duration-200">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-roksal-green/10">
              <CheckCircle2 className="h-4 w-4 text-roksal-green" />
            </div>
            <div>
              <p className="text-lg font-bold text-roksal-navy">{completedCount}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">Končani</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Project Overview — horizontalni graf + trend (md+: dva stolpca) */}
      {totalProjects > 0 && (
        <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <Card className="card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '70ms' }}>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-roksal-navy">
              Pregled projekta
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {(() => {
              const vTeku = projects.filter(p => p.status === 'V_TEKU').length
              const nacrtovano = projects.filter(p => p.status === 'NACRTOVANO').length
              const zakljuceno = projects.filter(p => p.status === 'ZAKLJUCENO').length
              const ustavljeno = projects.filter(p => p.status === 'USTAVLJENO').length
              const total = totalProjects
              const bars = [
                { label: 'V teku', count: vTeku, color: 'bg-roksal-amber', textColor: 'text-roksal-amber' },
                { label: 'Načrtovano', count: nacrtovano, color: 'bg-gray-300 dark:bg-gray-500', textColor: 'text-muted-foreground' },
                { label: 'Zaključeno', count: zakljuceno, color: 'bg-roksal-green', textColor: 'text-roksal-green' },
                { label: 'Ustavljeno', count: ustavljeno, color: 'bg-roksal-red', textColor: 'text-roksal-red' },
              ].filter(b => b.count > 0)
              return (
                <div className="space-y-2.5">
                  {/* Bar row */}
                  <div className="flex rounded-lg overflow-hidden h-5 bg-secondary/60">
                    {bars.map((bar) => (
                      <div
                        key={bar.label}
                        className={`${bar.color} transition-all duration-500 flex items-center justify-center`}
                        style={{ width: `${(bar.count / total) * 100}%`, minWidth: bar.count > 0 ? '18px' : '0' }}
                        title={`${bar.label}: ${bar.count}`}
                      />
                    ))}
                  </div>
                  {/* Labels row */}
                  <div className="flex items-center justify-between gap-1">
                    {bars.map((bar) => (
                      <div key={bar.label} className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
                        <span className={`text-xs font-bold ${bar.textColor}`}>{bar.count}</span>
                        <span className="text-[9px] text-muted-foreground leading-tight text-center truncate w-full">{bar.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </CardContent>
        </Card>

        {/* Trend aktivnosti — novi in zaključeni projekti, zadnjih 6 mesecev.
            Čisti DOM stolpci (brez graf knjižnice); višina relativna na max. */}
        <Card
          className="card-hover transition-all duration-200 animate-fade-in-up"
          style={{ animationDelay: '80ms' }}
        >
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                <TrendingUp className="h-4 w-4 text-roksal-navy" />
                Aktivnost (6 mesecev)
              </CardTitle>
              {/* Legenda */}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-gradient-to-t from-roksal-amber/70 to-roksal-amber" />
                  novi
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-roksal-green" />
                  zaključeni
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {(() => {
              const max = Math.max(1, ...monthlyTrend.map((m) => Math.max(m.newCount, m.doneCount)))
              return (
                <div className="flex items-end justify-between gap-2" aria-hidden="false" role="img" aria-label="Stolpčni graf: novi in zaključeni projekti po mesecih">
                  {monthlyTrend.map((m, i) => {
                    const isCurrent = i === monthlyTrend.length - 1
                    return (
                      <div key={m.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                        <span className={`text-[10px] font-bold tabular-nums ${m.newCount > 0 ? 'text-roksal-navy' : 'text-muted-foreground/50'}`}>
                          {m.newCount}
                        </span>
                        <div className="flex h-20 w-full items-end justify-center gap-1" title={`${m.label}: ${m.newCount} novih, ${m.doneCount} zaključenih`}>
                          {/* Novi projekti */}
                          <div
                            className={`w-2.5 rounded-t-md transition-all duration-500 ${
                              m.newCount > 0
                                ? 'bg-gradient-to-t from-roksal-amber/70 to-roksal-amber'
                                : 'bg-roksal-amber/20'
                            } ${isCurrent ? 'ring-1 ring-roksal-amber/40' : ''}`}
                            style={{ height: `${Math.max(6, (m.newCount / max) * 100)}%` }}
                          />
                          {/* Zaključeni projekti */}
                          <div
                            className={`w-2.5 rounded-t-md transition-all duration-500 ${
                              m.doneCount > 0 ? 'bg-roksal-green' : 'bg-roksal-green/15'
                            }`}
                            style={{ height: `${Math.max(6, (m.doneCount / max) * 100)}%` }}
                          />
                        </div>
                        <span className={`text-[9px] leading-none ${isCurrent ? 'font-bold text-roksal-amber' : 'text-muted-foreground'}`}>
                          {m.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </CardContent>
        </Card>
        </div>
      )}

      {/* New Project Button */}
      <Button
        type="button"
        onClick={() => setNewProjectOpen(true)}
        className="w-full bg-roksal-amber hover:bg-roksal-amber/90 text-roksal-navy h-11 shadow-sm transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] btn-shine md:w-auto md:px-8"
      >
        <Plus className="mr-2 h-4 w-4" />
        Nov projekt
      </Button>

      {/* Equipment Status */}
      <Card className="card-hover transition-all duration-200">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-roksal-navy">
            Stanje opreme
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <div className="flex items-center gap-2.5 rounded-lg bg-secondary/50 p-2.5">
              <BatteryMedium className="h-5 w-5 text-roksal-green" />
              <div>
                <p className="text-xs font-medium text-roksal-navy">Baterija</p>
                <p className="text-[11px] text-muted-foreground">87% — polna</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg bg-secondary/50 p-2.5">
              <Wifi className="h-5 w-5 text-roksal-green animate-pulse-soft" />
              <div>
                <p className="text-xs font-medium text-roksal-navy">Povezava</p>
                <p className="text-[11px] text-muted-foreground">Online — sinhron.</p>
              </div>
            </div>
          </div>
          {inventory.length > 0 && (
            <div className="mt-3 rounded-lg bg-secondary/30 p-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Skupna zaloga: {inventory.length} artiklov
                </span>
                <span className={lowStockCount > 0 ? 'text-roksal-red font-medium' : 'text-roksal-green font-medium'}>
                  {lowStockCount > 0
                    ? `${lowStockCount} pod min. zalogo`
                    : 'Zaloga v redu'}
                </span>
              </div>
              {lowStockCount > 0 && (
                <p className="mt-1 text-[10px] text-muted-foreground truncate">
                  {lowStockItems.slice(0, 3).map((i) => i.naziv).join(', ')}
                  {lowStockItems.length > 3 && ` +${lowStockItems.length - 3}`}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search & Filter Bar */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Išči projekte, stranke..."
            className="pl-9 h-10 bg-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {statusFilterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                statusFilter === tab.id
                  ? 'bg-roksal-navy text-white border-b-2 border-white/30'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Projects List */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-roksal-navy">
              Projekti
            </CardTitle>
            <Badge variant="secondary">{filteredProjects.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filteredProjects.length > 0 ? (
            <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin md:max-h-[32rem]">
              {filteredProjects.map((project) => {
                const daysRemaining = project.datumMontaze
                  ? Math.ceil((new Date(project.datumMontaze).getTime() - new Date().getTime()) / 86400000)
                  : null
                return (
                <div
                  key={project.id}
                  className={`relative flex items-center justify-between rounded-lg border p-3 transition-all duration-200 hover:bg-secondary/30 cursor-pointer card-hover ${selectedProjectId === project.id ? 'border-roksal-amber bg-roksal-amber/5 ring-1 ring-roksal-amber/30' : 'border-border/50'}`}
                  onClick={() => {
                    onSelectProject?.(project.id)
                    openProjectDetail(project)
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-roksal-navy">
                        {project.nazivProjekta}
                      </p>
                      {daysRemaining !== null && (
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          daysRemaining < 0
                            ? 'bg-roksal-red/15 text-roksal-red'
                            : daysRemaining === 0
                              ? 'bg-roksal-amber/15 text-roksal-navy'
                              : daysRemaining <= 3
                                ? 'bg-roksal-amber/15 text-roksal-navy'
                                : 'bg-roksal-green/15 text-roksal-green'
                        }`}>
                          {daysRemaining < 0
                            ? `Preteklo ${Math.abs(daysRemaining)} ${Math.abs(daysRemaining) === 1 ? 'dan' : Math.abs(daysRemaining) < 5 ? 'dni' : 'dni'}`
                            : daysRemaining === 0
                              ? 'Danes'
                              : `${daysRemaining} ${daysRemaining === 1 ? 'dan' : daysRemaining < 5 ? 'dni' : 'dni'}`}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {project.customer?.ime || '—'} · {project.customer?.naslov || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 ml-2">
                    {/* Swipe action icons */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toast.info(`Klic stranke: ${project.customer?.ime || '—'}`) }}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-roksal-green hover:bg-roksal-green/10 transition-colors"
                      aria-label="Pokliči stranko"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); toast.info(`Urejanje: ${project.nazivProjekta}`) }}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-roksal-amber hover:bg-roksal-amber/10 transition-colors"
                      aria-label="Uredi projekt"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); toast.info(`Arhiviranje: ${project.nazivProjekta}`) }}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-roksal-navy hover:bg-roksal-navy/10 transition-colors"
                      aria-label="Arhiviraj projekt"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                    <div
                      onClick={(e) => {
                        e.stopPropagation()
                        setStatusDropdownId(statusDropdownId === project.id ? null : project.id)
                      }}
                    >
                      <Badge className={`cursor-pointer text-[10px] h-6 px-2 ${statusColors[project.status]}`}>
                        {statusLabels[project.status]}
                      </Badge>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  {statusDropdownId === project.id && (
                    <div
                      className="absolute right-3 top-12 z-20 rounded-lg border border-border bg-white shadow-lg p-1 min-w-[140px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {Object.entries(statusLabels).map(([key, label]) => (
                        <button
                          key={key}
                          disabled={key === project.status || statusUpdating}
                          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs hover:bg-secondary transition-colors disabled:opacity-50"
                          onClick={() => handleStatusChange(project.id, key)}
                        >
                          <span className={`inline-block h-2 w-2 rounded-full ${statusColors[key]?.split(' ')[0]}`} />
                          {label}
                          {key === project.status && <X className="ml-auto h-3 w-3 text-muted-foreground" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                )
              })}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {searchQuery ? 'Ni rezultatov za "' + searchQuery + '"' : 'Ni aktivnih projektov'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Low Stock Alert */}
      {lowStockCount > 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-roksal-red/20 bg-roksal-red/5 p-3 animate-fade-in-up">
          <AlertTriangle className="h-5 w-5 shrink-0 text-roksal-red badge-pulse" />
          <div>
            <p className="text-sm font-medium text-roksal-navy">
              Nizka zaloga materiala
            </p>
            <p className="text-xs text-muted-foreground">
              {lowStockCount} {lowStockCount === 1 ? 'artikel je' : lowStockCount < 5 ? 'artikli so' : 'artiklov je'} pod minimalno zalogo. Preverite zalogo.
            </p>
          </div>
        </div>
      ) : !invLoading && inventory.length > 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-roksal-green/20 bg-roksal-green/5 p-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-roksal-green" />
          <div>
            <p className="text-sm font-medium text-roksal-navy">
              Zaloga v redu
            </p>
            <p className="text-xs text-muted-foreground">
              Vsi artikli so nad minimalno zalogo.
            </p>
          </div>
        </div>
      ) : null}

      {/* Activity Timeline */}
      {activities.length > 0 && (
        <Card className="card-hover transition-all duration-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-navy">
                <Activity className="h-4 w-4" />
                Aktivnosti
              </CardTitle>
              <Badge variant="secondary" className="text-[10px]">{activities.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="relative space-y-0">
              {/* Timeline line */}
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
              {activities.map((activity, i) => {
                const Icon = activity.icon
                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 py-2 animate-fade-in-up"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div className="relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-secondary">
                      <Icon className={`h-3.5 w-3.5 ${activity.iconColor}`} />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-roksal-navy">{activity.title}</p>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{activity.time}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{activity.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Project Dialog */}
      <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-roksal-navy">Nov projekt</DialogTitle>
            <DialogDescription>
              Ustvarite nov projekt montaže ograje.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="proj-name" className="text-xs">
                Naziv projekta
              </Label>
              <Input
                id="proj-name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="npr. Ograja Ljubljana - WPC"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Stranka</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-roksal-navy hover:text-roksal-navy hover:bg-roksal-amber/15"
                  onClick={() => {
                    resetCustomerDialog()
                    setCustomerSearch('')
                    setCustomerDialogOpen(true)
                  }}
                >
                  <UserPlus className="mr-1 h-3.5 w-3.5" />
                  Nova
                </Button>
              </div>
              {customers.length > 6 && (
                <Input
                  type="text"
                  placeholder="Iskanje strank..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="h-8 text-xs"
                />
              )}
              <Select value={newProjectCustomer} onValueChange={setNewProjectCustomer}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Izberi stranko" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCustomers.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Ni najdenih strank.
                    </div>
                  ) : (
                    filteredCustomers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.ime} — {c.naslov}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {customers.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Še ni strank. Kliknite »Nova« za dodajanje.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-date" className="text-xs">
                Datum montaže
              </Label>
              <Input
                id="proj-date"
                type="date"
                value={newProjectDate}
                onChange={(e) => setNewProjectDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-notes" className="text-xs">
                Opombe
              </Label>
              <Textarea
                id="proj-notes"
                value={newProjectNotes}
                onChange={(e) => setNewProjectNotes(e.target.value)}
                placeholder="Dodatne opombe o projektu..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewProjectOpen(false)}
            >
              Prekliči
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={creating || !newProjectName.trim() || !newProjectCustomer}
              className="bg-roksal-navy hover:bg-roksal-navy/90 text-white"
            >
              {creating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Ustvari
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Customer Dialog */}
      <Dialog
        open={customerDialogOpen}
        onOpenChange={(open) => {
          setCustomerDialogOpen(open)
          if (!open) resetCustomerDialog()
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-roksal-navy">Nova stranka</DialogTitle>
            <DialogDescription>
              Ustvarite novo stranko. Po shranjevanju bo samodejno izbrana v projektu.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cust-ime" className="text-xs">
                Ime in priimek / Naziv podjetja <span className="text-roksal-red">*</span>
              </Label>
              <Input
                id="cust-ime"
                value={newCustomerIme}
                onChange={(e) => setNewCustomerIme(e.target.value)}
                placeholder="npr. Janez Novak"
                disabled={creatingCustomer}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-naslov" className="text-xs">
                Naslov <span className="text-roksal-red">*</span>
              </Label>
              <Input
                id="cust-naslov"
                value={newCustomerNaslov}
                onChange={(e) => setNewCustomerNaslov(e.target.value)}
                placeholder="npr. Trubarjeva 5, 4000 Kranj"
                disabled={creatingCustomer}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cust-telefon" className="text-xs">
                  Telefon
                </Label>
                <Input
                  id="cust-telefon"
                  value={newCustomerTelefon}
                  onChange={(e) => setNewCustomerTelefon(e.target.value)}
                  placeholder="031 234 567"
                  disabled={creatingCustomer}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cust-email" className="text-xs">
                  Email
                </Label>
                <Input
                  id="cust-email"
                  type="email"
                  value={newCustomerEmail}
                  onChange={(e) => setNewCustomerEmail(e.target.value)}
                  placeholder="ime@primer.si"
                  disabled={creatingCustomer}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCustomerDialogOpen(false)}
              disabled={creatingCustomer}
            >
              Prekliči
            </Button>
            <Button
              type="button"
              onClick={handleCreateCustomer}
              disabled={
                creatingCustomer ||
                !newCustomerIme.trim() ||
                newCustomerIme.trim().length < 2 ||
                !newCustomerNaslov.trim() ||
                newCustomerNaslov.trim().length < 3
              }
              className="bg-roksal-navy hover:bg-roksal-navy/90 text-white"
            >
              {creatingCustomer ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Shrani stranko
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[425px]">
          {detailProject && (
            <>
              <DialogHeader>
                <DialogTitle className="text-roksal-navy">
                  {detailProject.nazivProjekta}
                </DialogTitle>
                <DialogDescription>
                  Podrobnosti projekta
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={detailProject.status}
                    onValueChange={(v) => handleStatusChange(detailProject.id, v)}
                    disabled={statusUpdating}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Card className="px-3 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench className="h-3.5 w-3.5 text-roksal-amber" />
                    <span className="text-xs font-medium text-roksal-navy">Stranka</span>
                  </div>
                  <p className="text-sm font-medium text-roksal-navy">
                    {detailProject.customer?.ime || 'Ni stranke'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {detailProject.customer?.naslov || '—'}
                  </p>
                  {/* Contact buttons */}
                  <div className="flex items-center gap-2 mt-2.5">
                    {detailProject.customer?.telefon && (
                      <a
                        href={`tel:${detailProject.customer.telefon}`}
                        className="flex items-center gap-1.5 rounded-lg bg-roksal-green/10 border border-roksal-green/20 px-2.5 py-1.5 text-[11px] font-medium text-roksal-green hover:bg-roksal-green/20 active:scale-[0.96] transition-all duration-150 press-scale"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        <span>Kliči</span>
                      </a>
                    )}
                    {detailProject.customer?.email && (
                      <a
                        href={`mailto:${detailProject.customer.email}`}
                        className="flex items-center gap-1.5 rounded-lg bg-roksal-navy/10 border border-roksal-navy/20 px-2.5 py-1.5 text-[11px] font-medium text-roksal-navy hover:bg-roksal-navy/15 active:scale-[0.96] transition-all duration-150 press-scale"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        <span>E-pošta</span>
                      </a>
                    )}
                    {!detailProject.customer?.telefon && !detailProject.customer?.email && (
                      <span className="text-[11px] text-muted-foreground italic">Ni kontaktnih podatkov</span>
                    )}
                  </div>
                </Card>

                {/* Measurements section */}
                <Card className="overflow-hidden">
                  <div
                    className="flex w-full items-center justify-between p-3 cursor-pointer select-none hover:bg-secondary/30 transition-colors"
                    onClick={() => setDetailMeasurementsExpanded(!detailMeasurementsExpanded)}
                  >
                    <div className="flex items-center gap-2">
                      <Ruler className="h-4 w-4 text-roksal-navy" />
                      <span className="text-xs font-medium text-roksal-navy">Meritve tega projekta</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[11px]">{detailMeasurements.length}</Badge>
                      {detailMeasurementsExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {detailMeasurementsExpanded && (
                    <div className="border-t border-border/50 px-3 pb-3 pt-2 space-y-2.5 max-h-[260px] overflow-y-auto scrollbar-thin">
                      {detailMeasurementsLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : detailMeasurements.length > 0 ? (
                        detailMeasurements.map((m) => (
                          <div key={m.id} className="rounded-lg border border-border/40 overflow-hidden">
                            <div className="flex items-center justify-between px-2.5 py-1.5">
                              <span className="text-[11px] font-medium text-roksal-navy truncate">
                                {m.lokacija || ("Meritev #" + m.id.slice(-4))}
                              </span>
                              <span className="text-[11px] font-mono text-muted-foreground shrink-0 ml-2">
                                {(m.dolzinaMm >= 1000 ? (m.dolzinaMm / 1000).toFixed(2) + "m" : m.dolzinaMm + "mm")} x {(m.visinaMm >= 1000 ? (m.visinaMm / 1000).toFixed(2) + "m" : m.visinaMm + "mm")}
                              </span>
                            </div>
                            <div className="px-2.5 pb-2">
                              <MiniRailingDiagram dolzina={m.dolzinaMm} visina={m.visinaMm} />
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-muted-foreground text-center py-3">Ni meritev za ta projekt</p>
                      )}
                    </div>
                  )}

                  {detailMeasurements.length > 0 && (
                    <div className="border-t border-border/30 px-3 py-2.5 bg-secondary/10 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span>Skupna dolzina:</span>
                        <span className="font-semibold text-roksal-navy">
                          {(detailMeasurements.reduce((s, m) => s + m.dolzinaMm, 0) / 1000).toFixed(1)}m
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calculator className="h-3 w-3 text-roksal-amber" />
                        <span className="text-[11px] text-muted-foreground">
                          ~{estimateSlats(detailMeasurements)} letvev
                        </span>
                      </div>
                    </div>
                  )}
                </Card>

                <div className="grid grid-cols-3 gap-3">
                  <Card className="px-3 py-3 text-center">
                    <Ruler className="mx-auto mb-1 h-4 w-4 text-roksal-navy" />
                    <p className="text-lg font-bold text-roksal-navy">
                      {detailProject._count?.measurements || 0}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Meritve</p>
                  </Card>
                  <Card className="px-3 py-3 text-center">
                    <FileText className="mx-auto mb-1 h-4 w-4 text-roksal-navy" />
                    <p className="text-lg font-bold text-roksal-navy">
                      {detailProject._count?.documents || 0}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Dokumenti</p>
                  </Card>
                  <Card className="px-3 py-3 text-center">
                    <Package className="mx-auto mb-1 h-4 w-4 text-roksal-navy" />
                    <p className="text-lg font-bold text-roksal-navy">
                      {detailProject._count?.auditLogs || 0}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Dnevniki</p>
                  </Card>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Datum montaže:</span>
                  <span className="font-medium text-roksal-navy">
                    {detailProject.datumMontaze
                      ? new Date(detailProject.datumMontaze).toLocaleDateString('sl-SI', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : 'Ni določen'}
                  </span>
                </div>

                {detailProject.monter && (
                  <div className="flex items-center gap-2 text-sm">
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Monter:</span>
                    <span className="font-medium text-roksal-navy">
                      {detailProject.monter.ime}
                    </span>
                  </div>
                )}

                {detailProject.opombe && (
                  <div className="rounded-lg bg-secondary/50 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Opombe</p>
                    <p className="text-sm text-roksal-navy">{detailProject.opombe}</p>
                  </div>
                )}

                {/* Portal stranke */}
                <Card className="overflow-hidden border-l-4 border-l-roksal-navy/40">
                  <div className="flex w-full items-center justify-between p-3 bg-roksal-navy/5">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-roksal-navy" />
                      <span className="text-xs font-semibold text-roksal-navy">Portal stranke</span>
                    </div>
                    {portalLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : portalInfo?.enabled ? (
                      <Badge className="bg-roksal-green/15 text-roksal-green hover:bg-roksal-green/20 text-[10px]">
                        <ShieldCheck className="mr-1 h-3 w-3" />
                        Omogočen
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Onemogočen</Badge>
                    )}
                  </div>

                  <div className="px-3 pb-3 pt-2 space-y-3">
                    {!portalLoading && !portalInfo?.enabled && (
                      <div className="space-y-2">
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Omogočite javno stran, kjer stranka v realnem času spremlja status, slike
                          in sporočila monterja. Dobiva manj klicev &laquo;kdaj boste prišli?&raquo;.
                        </p>
                        <Button
                          type="button"
                          onClick={() => portalAction('enable')}
                          disabled={portalActionLoading}
                          className="w-full bg-roksal-navy hover:bg-roksal-navy/90 text-white h-9"
                          size="sm"
                        >
                          {portalActionLoading ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Globe className="mr-2 h-3.5 w-3.5" />
                          )}
                          Omogoči portal stranke
                        </Button>
                      </div>
                    )}

                    {portalInfo?.enabled && portalInfo.token && (
                      <>
                        {/* URL with copy */}
                        <div className="space-y-1.5">
                          <Label className="text-[11px] text-muted-foreground">Povezava portala</Label>
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 min-w-0 flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-2 py-1.5">
                              <Link2 className="h-3 w-3 shrink-0 text-roksal-amber" />
                              <span className="text-[11px] font-mono text-roksal-navy truncate">
                                /portal/{portalInfo.token.slice(0, 12)}…
                              </span>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={copyPortalUrl}
                              className="h-8 px-2.5 shrink-0"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* R132 (§7): življenjski cikl žetona — potek, zadnji obisk, revokacija */}
                        {(() => {
                          const exp = portalInfo.expiresAt ? new Date(portalInfo.expiresAt) : null
                          const dni = exp ? Math.ceil((exp.getTime() - Date.now()) / 86400000) : null
                          const expCritical = dni !== null && dni <= 7
                          return (
                            <div className="grid grid-cols-2 gap-1.5 rounded-md border border-border bg-secondary/30 px-2 py-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <CalendarClock
                                  className={`h-3.5 w-3.5 shrink-0 ${expCritical ? 'text-amber-600' : 'text-muted-foreground'}`}
                                />
                                <div className="min-w-0">
                                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground leading-tight">
                                    Velja do
                                  </p>
                                  <p
                                    className={`text-[10px] font-semibold leading-tight truncate ${
                                      expCritical ? 'text-amber-600' : 'text-roksal-navy'
                                    }`}
                                    title={portalInfo.revokedAt ? 'Povezava je preklicana' : exp ? exp.toLocaleDateString('sl-SI') : 'Brez poteka'}
                                  >
                                    {portalInfo.revokedAt
                                      ? 'Preklicana'
                                      : exp
                                        ? exp.toLocaleDateString('sl-SI') + (expCritical && dni !== null ? ` (${dni} dni)` : '')
                                        : 'Brez poteka'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <History className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <div className="min-w-0">
                                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground leading-tight">
                                    Zadnji obisk
                                  </p>
                                  <p className="text-[10px] font-semibold leading-tight text-roksal-navy truncate">
                                    {portalInfo.lastUsedAt
                                      ? new Date(portalInfo.lastUsedAt).toLocaleString('sl-SI', {
                                          day: '2-digit',
                                          month: '2-digit',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })
                                      : 'nikoli'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        })()}

                        {/* Share buttons */}
                        <div className="grid grid-cols-3 gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={sendSmsPortal}
                            disabled={!detailProject?.customer?.telefon}
                            className="h-8 text-[11px]"
                          >
                            <MessageSquare className="mr-1 h-3.5 w-3.5" />
                            SMS
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={sendEmailPortal}
                            disabled={!detailProject?.customer?.email}
                            className="h-8 text-[11px]"
                          >
                            <Mail className="mr-1 h-3.5 w-3.5" />
                            Email
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={copyPortalUrl}
                            className="h-8 text-[11px]"
                          >
                            <Copy className="mr-1 h-3.5 w-3.5" />
                            Kopiraj
                          </Button>
                        </div>
                        {(!detailProject?.customer?.telefon || !detailProject?.customer?.email) && (
                          <p className="text-[10px] text-amber-600 leading-tight">
                            {!detailProject?.customer?.telefon && 'Stranka nima telefona. '}
                            {!detailProject?.customer?.email && 'Stranka nima e-pošte.'}
                          </p>
                        )}

                        {/* Sporočilo stranki */}
                        <div className="space-y-1.5">
                          <Label htmlFor="portal-notes" className="text-[11px]">
                            Sporočilo stranki
                          </Label>
                          <Textarea
                            id="portal-notes"
                            value={portalNotesInput}
                            onChange={(e) => setPortalNotesInput(e.target.value)}
                            placeholder="npr. Prihajamo v ponedeljek ob 8h"
                            rows={2}
                            className="text-xs resize-none"
                          />
                        </div>

                        {/* Cena */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="portal-price" className="text-[11px]">
                              Predvidena cena
                            </Label>
                            <button
                              type="button"
                              onClick={() => setPortalShowPrice(!portalShowPrice)}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                                portalShowPrice
                                  ? 'bg-roksal-green/15 text-roksal-green'
                                  : 'bg-secondary text-muted-foreground'
                              }`}
                            >
                              {portalShowPrice ? (
                                <Eye className="h-3 w-3" />
                              ) : (
                                <EyeOff className="h-3 w-3" />
                              )}
                              {portalShowPrice ? 'Pokaži stranki' : 'Skrito'}
                            </button>
                          </div>
                          {portalShowPrice && (
                            <div className="relative">
                              <Input
                                id="portal-price"
                                type="text"
                                inputMode="decimal"
                                value={portalPriceInput}
                                onChange={(e) => setPortalPriceInput(e.target.value)}
                                placeholder="npr. 2500"
                                className="pr-8 text-xs h-8"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                €
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Save settings */}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={savePortalSettings}
                          disabled={portalActionLoading}
                          className="w-full h-8 text-[11px] border-roksal-amber/40 text-roksal-navy hover:bg-roksal-amber/10"
                        >
                          {portalActionLoading ? (
                            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-1.5 h-3 w-3" />
                          )}
                          Shrani sporočilo in ceno
                        </Button>

                        {/* Admin actions */}
                        <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-border">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => portalAction('regenerate')}
                            disabled={portalActionLoading}
                            className="h-8 text-[11px] text-roksal-navy hover:bg-roksal-navy/10"
                            title="Ustvari novo povezavo — stara postane trajno nedosegljiva"
                          >
                            <RefreshCw className="mr-1 h-3 w-3" />
                            Nova
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => portalAction('disable')}
                            disabled={portalActionLoading}
                            className="h-8 text-[11px] text-roksal-red hover:bg-roksal-red/10"
                            title="Začasno izklopi stran — povezava ostane veljavna"
                          >
                            <X className="mr-1 h-3 w-3" />
                            Izklopi
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => portalAction('revoke')}
                            disabled={portalActionLoading}
                            className="h-8 text-[11px] text-roksal-red hover:bg-roksal-red/10 border border-roksal-red/30"
                            title="Trajno prekliči povezavo (žeton mrtev) — potrebna Nova povezava"
                          >
                            <KeyRound className="mr-1 h-3 w-3" />
                            Prekliči
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </Card>

                {/* R133 (§8): Merilna povezava — scoped žeton za samomeritev stranke.
                    Vizualno sorojena s Portal kartico, a ambrov akcent (ločena zmožnost). */}
                <Card className="overflow-hidden border-l-4 border-l-roksal-amber/60">
                  <div className="flex w-full items-center justify-between p-3 bg-roksal-amber/5">
                    <div className="flex items-center gap-2">
                      <Ruler className="h-4 w-4 text-roksal-navy" />
                      <span className="text-xs font-semibold text-roksal-navy">Merilna povezava (samomeritev)</span>
                    </div>
                    {portalLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : portalInfo?.measure?.enabled ? (
                      <Badge className="bg-roksal-amber/15 text-amber-700 hover:bg-roksal-amber/25 text-[10px]">
                        <ShieldCheck className="mr-1 h-3 w-3" />
                        Izdana
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Ni izdana</Badge>
                    )}
                  </div>

                  <div className="px-3 pb-3 pt-2 space-y-3">
                    {!portalLoading && !portalInfo?.measure?.enabled && (
                      <div className="space-y-2">
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Stranka dobi povezavo, na kateri sama nariše črto ograje na satelitski karti in
                          pošlje meritev — brez odhoda monterja. Ločena povezava od portala: lasten potek,
                          lasten preklic, lasten dnevnik.
                        </p>
                        <Button
                          type="button"
                          onClick={() => portalAction('measureEnable')}
                          disabled={portalActionLoading}
                          className="w-full bg-roksal-amber hover:bg-roksal-amber/90 text-white h-9"
                          size="sm"
                        >
                          {portalActionLoading ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Ruler className="mr-2 h-3.5 w-3.5" />
                          )}
                          Izdaj merilno povezavo
                        </Button>
                      </div>
                    )}

                    {portalInfo?.measure?.enabled && portalInfo.measure.token && (
                      <>
                        {/* URL with copy */}
                        <div className="space-y-1.5">
                          <Label className="text-[11px] text-muted-foreground">Merilna povezava</Label>
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 min-w-0 flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-2 py-1.5">
                              <Link2 className="h-3 w-3 shrink-0 text-roksal-amber" />
                              <span className="text-[11px] font-mono text-roksal-navy truncate">
                                /m/{portalInfo.measure.token.slice(0, 12)}…
                              </span>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={copyMeasureUrl}
                              className="h-8 px-2.5 shrink-0"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* R133 (§8): življenjski cikl — potek + zadnja oddana meritev */}
                        {(() => {
                          const m = portalInfo.measure
                          if (!m) return null
                          const mexp = m.expiresAt ? new Date(m.expiresAt) : null
                          const mDni = mexp ? Math.ceil((mexp.getTime() - Date.now()) / 86400000) : null
                          const mCritical = mDni !== null && mDni <= 7
                          return (
                            <div className="grid grid-cols-2 gap-1.5 rounded-md border border-border bg-secondary/30 px-2 py-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <CalendarClock
                                  className={`h-3.5 w-3.5 shrink-0 ${mCritical ? 'text-amber-600' : 'text-muted-foreground'}`}
                                />
                                <div className="min-w-0">
                                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground leading-tight">
                                    Velja do
                                  </p>
                                  <p
                                    className={`text-[10px] font-semibold leading-tight truncate ${
                                      mCritical ? 'text-amber-600' : 'text-roksal-navy'
                                    }`}
                                    title={m.revokedAt ? 'Povezava je preklicana' : mexp ? mexp.toLocaleDateString('sl-SI') : 'Brez poteka'}
                                  >
                                    {m.revokedAt
                                      ? 'Preklicana'
                                      : mexp
                                        ? mexp.toLocaleDateString('sl-SI') + (mCritical && mDni !== null ? ` (${mDni} dni)` : '')
                                        : 'Brez poteka'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <History className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <div className="min-w-0">
                                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground leading-tight">
                                    Zadnja meritev
                                  </p>
                                  <p className="text-[10px] font-semibold leading-tight text-roksal-navy truncate">
                                    {m.lastUsedAt
                                      ? new Date(m.lastUsedAt).toLocaleString('sl-SI', {
                                          day: '2-digit',
                                          month: '2-digit',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })
                                      : 'nikoli'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        })()}

                        {/* Share buttons */}
                        <div className="grid grid-cols-3 gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={sendSmsMeasure}
                            disabled={!detailProject?.customer?.telefon}
                            className="h-8 text-[11px]"
                          >
                            <MessageSquare className="mr-1 h-3.5 w-3.5" />
                            SMS
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={sendEmailMeasure}
                            disabled={!detailProject?.customer?.email}
                            className="h-8 text-[11px]"
                          >
                            <Mail className="mr-1 h-3.5 w-3.5" />
                            Email
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={copyMeasureUrl}
                            className="h-8 text-[11px]"
                          >
                            <Copy className="mr-1 h-3.5 w-3.5" />
                            Kopiraj
                          </Button>
                        </div>

                        {/* Admin actions */}
                        <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-border">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => portalAction('measureRegenerate')}
                            disabled={portalActionLoading}
                            className="h-8 text-[11px] text-roksal-navy hover:bg-roksal-navy/10"
                            title="Ustvari novo merilno povezavo — stara postane trajno nedosegljiva"
                          >
                            <RefreshCw className="mr-1 h-3 w-3" />
                            Nova
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => portalAction('measureDisable')}
                            disabled={portalActionLoading}
                            className="h-8 text-[11px] text-roksal-red hover:bg-roksal-red/10"
                            title="Začasno izklopi sprejemanje meritev — povezava ostane veljavna"
                          >
                            <X className="mr-1 h-3 w-3" />
                            Izklopi
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => portalAction('measureRevoke')}
                            disabled={portalActionLoading}
                            className="h-8 text-[11px] text-roksal-red hover:bg-roksal-red/10 border border-roksal-red/30"
                            title="Trajno prekliči merilno povezavo (žeton mrtev) — potrebna Nova povezava"
                          >
                            <KeyRound className="mr-1 h-3 w-3" />
                            Prekliči
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </Card>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailOpen(false)}>
                  Zapri
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Demo data for when API is not available
const demoProjects: Project[] = [
  {
    id: 'demo1',
    nazivProjekta: 'Ograja Horjul - WPC Classic',
    status: 'V_TEKU',
    datumMontaze: new Date().toISOString(),
    customer: { id: 'cust1', ime: 'Janez Novak', naslov: 'Horjul 12, 4224 Horjul' },
    monter: { id: 'm1', ime: 'Marko Horvat', vloga: 'MONTER' },
    _count: { documents: 2, auditLogs: 5 },
  },
  {
    id: 'demo2',
    nazivProjekta: 'Terasa Kranj - Inox Z-line',
    status: 'V_TEKU',
    datumMontaze: new Date(Date.now() + 86400000).toISOString(),
    customer: { id: 'cust2', ime: 'Ana Kovačič', naslov: 'Slovenski trg 5, 4000 Kranj' },
    monter: { id: 'm2', ime: 'Luka Bizjak', vloga: 'MONTER' },
    _count: { documents: 1, auditLogs: 3 },
  },
  {
    id: 'demo3',
    nazivProjekta: 'Balkon Železniki - WPC Vertical',
    status: 'NACRTOVANO',
    datumMontaze: new Date(Date.now() + 172800000).toISOString(),
    customer: { id: 'cust3', ime: 'Petra Zupan', naslov: 'Cankarjeva 8, 4227 Železniki' },
    monter: { id: 'm1', ime: 'Marko Horvat', vloga: 'MONTER' },
    _count: { documents: 0, auditLogs: 1 },
  },
]
