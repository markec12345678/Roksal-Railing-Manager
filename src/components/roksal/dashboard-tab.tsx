'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
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
    clientNotes: string | null
    estimatedPrice: number | null
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

  async function portalAction(action: 'enable' | 'disable' | 'regenerate') {
    if (!detailProject) return
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
        if (action === 'enable') toast.success('Portal stranke omogočen')
        else if (action === 'disable') toast.success('Portal stranke onemogočen')
        else if (action === 'regenerate') toast.success('Povezava ponovno generirana')
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
    <div className="space-y-4 px-4 pb-4 pt-2">
      {/* Greeting */}
      <div className="animate-fade-in-up">
        <h2 className="text-xl font-bold text-roksal-navy">
          {getGreeting()}, Monter!
        </h2>
        <p className="text-sm text-muted-foreground">{getTodayString()}</p>
      </div>

      {/* Quick Stats Row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-thin animate-fade-in-up" style={{ animationDelay: '30ms' }}>
        <Badge className="shrink-0 bg-roksal-navy/10 text-roksal-navy hover:bg-roksal-navy/15 text-[11px] px-2.5 py-1">
          <span className="font-bold mr-0.5">{activeCount}</span> aktivnih
        </Badge>
        <Badge className="shrink-0 bg-roksal-amber/15 text-roksal-navy hover:bg-roksal-amber/20 text-[11px] px-2.5 py-1">
          <span className="font-bold mr-0.5">{pendingCount}</span> načrtovanih
        </Badge>
        <Badge className="shrink-0 bg-roksal-green/15 text-roksal-green hover:bg-roksal-green/20 text-[11px] px-2.5 py-1">
          <span className="font-bold mr-0.5">{completedCount}</span> končanih
        </Badge>
        {!invLoading && totalInventoryItems > 0 && (
          <Badge className={`shrink-0 text-[11px] px-2.5 py-1 ${
            lowStockCount > 0
              ? 'bg-roksal-red/15 text-roksal-red hover:bg-roksal-red/20'
              : 'bg-roksal-green/15 text-roksal-green hover:bg-roksal-green/20'
          }`}>
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

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
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

      {/* Project Overview — horizontal bar chart */}
      {totalProjects > 0 && (
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
      )}

      {/* New Project Button */}
      <Button
        type="button"
        onClick={() => setNewProjectOpen(true)}
        className="w-full bg-roksal-amber hover:bg-roksal-amber/90 text-roksal-navy h-11 shadow-sm transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] btn-shine"
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
          <div className="grid grid-cols-2 gap-3">
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
            <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
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
                        <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-border">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => portalAction('regenerate')}
                            disabled={portalActionLoading}
                            className="h-8 text-[11px] text-roksal-navy hover:bg-roksal-navy/10"
                          >
                            <RefreshCw className="mr-1 h-3 w-3" />
                            Nova povezava
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => portalAction('disable')}
                            disabled={portalActionLoading}
                            className="h-8 text-[11px] text-roksal-red hover:bg-roksal-red/10"
                          >
                            <X className="mr-1 h-3 w-3" />
                            Onemogoči
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
