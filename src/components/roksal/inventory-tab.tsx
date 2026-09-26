'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Progress } from '@/components/ui/progress'
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
  Package,
  PackageSearch,
  AlertTriangle,
  Filter,
  TrendingDown,
  Archive,
  Plus,
  Loader2,
  ShoppingCart,
  Euro,
  Download,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { downloadCsv, todayStamp } from '@/lib/csv-export'

type InventoryType = 'ALL' | 'WPC_deska' | 'Inox_vijak' | 'Kemicno_sidro' | 'Alu_profil'
type MovementType = 'PORABA' | 'DOPOLNITEV' | 'ODPIS'

interface InventoryItem {
  id: string
  sifraMateriala: string
  naziv: string
  tip: string
  kolicinaZaloga: number
  enota: string
  minimalnaZaloga: number
  cenaEur?: number | null
  _count?: { usages: number; movements: number }
}

interface Project {
  id: string
  nazivProjekta: string
}

// R144 (§24) — šarže
interface LotAllocationDto {
  id: string
  eventType: string
  kolicina: number
  projekt: string | null
  createdAt: string
}
interface LotDto {
  id: string
  lotNumber: string
  dobavitelj: string | null
  orderId: string | null
  deliveryDate: string
  purchasePrice: number | null
  quantityInitial: number
  quantityRemaining: number
  status: string
  note: string | null
  allocations: LotAllocationDto[]
}
interface LotsResponse {
  inventory: { id: string; naziv: string; enota: string }
  lots: LotDto[]
  activeLots: number
  exhaustedLots: number
}

const typeLabels: Record<string, string> = {
  WPC_deska: 'WPC',
  Inox_vijak: 'Inox',
  Kemicno_sidro: 'Kemično',
  Alu_profil: 'Aluminij',
}

const filterTabs: { id: InventoryType; label: string }[] = [
  { id: 'ALL', label: 'Vse' },
  { id: 'WPC_deska', label: 'WPC' },
  { id: 'Inox_vijak', label: 'Inox' },
  { id: 'Kemicno_sidro', label: 'Kemično' },
  { id: 'Alu_profil', label: 'Aluminij' },
]

const movementLabels: Record<MovementType, string> = {
  PORABA: 'Poraba',
  DOPOLNITEV: 'Dopolnitev',
  ODPIS: 'Odpis',
}

const movementColors: Record<MovementType, string> = {
  PORABA: 'bg-roksal-amber/15 text-roksal-ink',
  DOPOLNITEV: 'bg-roksal-green/15 text-roksal-green',
  ODPIS: 'bg-roksal-red/15 text-roksal-red',
}

// R144 (§24) — življenjski status šarže (pika + oznaka, jezik pozivi/dostava).
const lotStatusStyle: Record<string, { dot: string; text: string; label: string }> = {
  ACTIVE: { dot: 'bg-roksal-green', text: 'text-roksal-green', label: 'Aktivna' },
  EXHAUSTED: { dot: 'bg-roksal-amber', text: 'text-roksal-amber', label: 'Izčrpana' },
  CLOSED: { dot: 'bg-muted-foreground', text: 'text-muted-foreground', label: 'Zaprta' },
}

export function InventoryTab() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<InventoryType>('ALL')

  // Movement dialog
  const [movementOpen, setMovementOpen] = useState(false)
  const [movementType, setMovementType] = useState<MovementType>('PORABA')
  const [movementInventoryId, setMovementInventoryId] = useState('')
  const [movementQuantity, setMovementQuantity] = useState('')
  const [movementProjectId, setMovementProjectId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // R144 (§24) — šarže (lot/batch) na artikel: expand/collapse + živi podatki
  const [lotsOpenId, setLotsOpenId] = useState<string | null>(null)
  const [lotsData, setLotsData] = useState<LotsResponse | null>(null)
  const [lotsLoading, setLotsLoading] = useState(false)
  const [lotsError, setLotsError] = useState<string | null>(null)
  // R152: napaka nalaganja zaloge je EKSPlicitna (nič izmišljenih artiklov).
  const [invError, setInvError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [invRes, projRes] = await Promise.all([
          fetch('/api/inventory'),
          fetch('/api/projects'),
        ])
        if (invRes.ok) {
          const data = await invRes.json()
          // R152: prazna zaloga ostane PRAZNA (iskreno stanje) — ni demo artiklov.
          setInventory(data)
          setInvError(null)
        } else {
          setInventory([])
          setInvError(`Zaloge ni bilo mogoče naložiti (napaka ${invRes.status}).`)
          toast.error(`Zaloge ni bilo mogoče naložiti (napaka ${invRes.status})`)
        }
        if (projRes.ok) {
          const projData = await projRes.json()
          setProjects(projData)
        }
      } catch {
        setInventory([])
        setInvError('Zaloge ni bilo mogoče naložiti — preverite povezavo.')
        toast.error('Zaloge ni bilo mogoče naložiti — preverite povezavo.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  async function fetchInventory() {
    try {
      const res = await fetch('/api/inventory')
      if (res.ok) {
        const data = await res.json()
        setInventory(data)
        setInvError(null)
      } else {
        setInvError(`Zaloge ni bilo mogoče osvežiti (napaka ${res.status}).`)
        toast.error(`Zaloge ni bilo mogoče osvežiti (napaka ${res.status})`)
      }
    } catch {
      setInvError('Zaloge ni bilo mogoče osvežiti — preverite povezavo.')
      toast.error('Zaloge ni bilo mogoče osvežiti — preverite povezavo.')
    }
  }

  async function handleMovement() {
    if (!movementInventoryId || !movementQuantity || parseFloat(movementQuantity) <= 0) {
      toast.error('Izpolnite vsa obvezna polja')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventoryId: movementInventoryId,
          kolicina: parseFloat(movementQuantity),
          tipPremika: movementType,
          projectId: movementProjectId || undefined,
        }),
      })
      if (res.ok) {
        toast.success(
          `${movementLabels[movementType]} uspešno zabeležen: ${movementQuantity} kos`
        )
        setMovementOpen(false)
        setMovementInventoryId('')
        setMovementQuantity('')
        setMovementProjectId('')
        setMovementType('PORABA')
        await fetchInventory()
      } else {
        toast.error('Napaka pri zapisovanju premika')
      }
    } catch {
      toast.error('Napaka pri povezavi s strežnikom')
    } finally {
      setSubmitting(false)
    }
  }

  function handleReorder(item: InventoryItem) {
    const deficit = item.minimalnaZaloga - item.kolicinaZaloga
    toast.info(`Naročilo za "${item.naziv}" — priporočeno: ${Math.max(deficit, item.minimalnaZaloga)} ${item.enota}`, {
      description: 'Naročilo bo poslano dobavitelju.',
      action: {
        label: 'V redu',
        onClick: () => {},
      },
    })
  }

  // R144 (§24) — odpri/zapri šarže artikla (živi GET /api/inventory/lots).
  async function toggleLots(item: InventoryItem) {
    if (lotsOpenId === item.id) {
      setLotsOpenId(null)
      setLotsData(null)
      setLotsError(null)
      return
    }
    setLotsOpenId(item.id)
    setLotsData(null)
    setLotsError(null)
    setLotsLoading(true)
    try {
      const res = await fetch(`/api/inventory/lots?inventoryId=${encodeURIComponent(item.id)}`)
      if (!res.ok) {
        // Fail-verbose: napaka se pokaže (brez tihe degradacije).
        setLotsError(`Napaka ${res.status} pri branju šarž.`)
        return
      }
      setLotsData((await res.json()) as LotsResponse)
    } catch {
      setLotsError('Omrežna napaka pri branju šarž.')
    } finally {
      setLotsLoading(false)
    }
  }

  /** R136 — CSV izvoz vidnih artiklov (upošteva aktiven filter; SI oblika). */
  function exportZalogaCsv() {
    if (filtered.length === 0) {
      toast.error('Ni artiklov za izvoz.')
      return
    }
    downloadCsv(
      `zaloga-${todayStamp()}.csv`,
      ['Šifra', 'Naziv', 'Tip', 'Enota', 'Zaloga', 'Min. zaloga', 'Nizka'],
      filtered.map((item) => [
        item.sifraMateriala,
        item.naziv,
        typeLabels[item.tip] || item.tip,
        item.enota,
        item.kolicinaZaloga,
        item.minimalnaZaloga,
        item.kolicinaZaloga <= item.minimalnaZaloga ? 'DA' : 'NE',
      ]),
    )
    toast.success(`Izvoženih ${filtered.length} artiklov v CSV.`)
  }

  const filtered = filter === 'ALL'
    ? inventory
    : inventory.filter((item) => item.tip === filter)

  const totalItems = inventory.length
  const totalStock = inventory.reduce((s, i) => s + i.kolicinaZaloga, 0)
  const lowStockItems = inventory.filter(
    (i) => i.kolicinaZaloga <= i.minimalnaZaloga
  )

  function getStockPercent(item: InventoryItem): number {
    const max = Math.max(item.minimalnaZaloga * 3, item.kolicinaZaloga)
    return Math.min((item.kolicinaZaloga / max) * 100, 100)
  }

  function getStockColor(item: InventoryItem): string {
    if (item.kolicinaZaloga <= item.minimalnaZaloga) return 'bg-roksal-red'
    if (item.kolicinaZaloga <= item.minimalnaZaloga * 1.5) return 'bg-roksal-amber'
    return 'bg-roksal-green'
  }

  const selectedItem = inventory.find((i) => i.id === movementInventoryId)

  // Category stock summary for mini chart
  const categoryStock = useMemo(() => {
    const categories = ['WPC_deska', 'Inox_vijak', 'Kemicno_sidro', 'Alu_profil'] as const
    return categories.map((cat) => {
      const items = inventory.filter((i) => i.tip === cat)
      const totalStock = items.reduce((s, i) => s + i.kolicinaZaloga, 0)
      const totalMin = items.reduce((s, i) => s + i.minimalnaZaloga, 0)
      const hasLowStock = items.some((i) => i.kolicinaZaloga <= i.minimalnaZaloga)
      return {
        category: cat,
        label: typeLabels[cat],
        totalStock,
        totalMin,
        hasLowStock,
        pct: totalMin > 0 ? Math.min((totalStock / (totalMin * 3)) * 100, 100) : 0,
      }
    })
  }, [inventory])

  // Total value estimate (based on estimated unit prices)
  const totalValueEstimate = useMemo(() => {
    return inventory.reduce((sum, item) => {
      const estimatedPrice = (item.cenaEur || getEstimatedPrice(item)) * item.kolicinaZaloga
      return sum + estimatedPrice
    }, 0)
  }, [inventory])

  function getEstimatedPrice(item: InventoryItem): number {
    // Estimate price based on item type for demo purposes
    const basePrices: Record<string, number> = {
      WPC_deska: 12.5,
      Inox_vijak: 2.8,
      Kemicno_sidro: 28.0,
      Alu_profil: 18.0,
    }
    return basePrices[item.tip] || 5.0
  }

  return (
    <div className="space-y-4 px-4 pb-4 pt-2 md:space-y-5 md:px-6 md:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-roksal-ink">Zaloga</h2>
          <p className="text-sm text-muted-foreground">
            Upravljanje materiala in inventarja
          </p>
        </div>
        <Button
          size="icon"
          className="h-9 w-9 bg-roksal-amber hover:bg-roksal-amber/90 text-roksal-navy shadow-sm focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-1"
          onClick={() => setMovementOpen(true)}
          aria-label="Dodaj gibanje zaloge"
          title="Dodaj gibanje zaloge"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {/* Mini Stock Chart */}
      <Card className="card-accent-left card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '0ms' }}>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-roksal-ink">
            Pregled zaloge po kategorijah
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex items-end justify-around gap-3 h-24">
            {categoryStock.map((cat) => (
              <div key={cat.category} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[10px] font-medium tabular-nums text-roksal-ink">{cat.totalStock}</span>
                <div className="relative w-full flex justify-center">
                  <div className="w-10 bg-secondary/50 rounded-t-sm relative overflow-hidden" style={{ height: '80px' }}>
                    <div
                      className={`absolute bottom-0 left-0 right-0 rounded-t-sm transition-all duration-500 ${
                        cat.hasLowStock ? 'bg-roksal-red/70' : 'bg-roksal-green/70'
                      }`}
                      style={{ height: `${Math.max(cat.pct, 5)}%` }}
                    />
                    {/* Min stock line indicator */}
                    <div
                      className="absolute left-0 right-0 h-px bg-roksal-amber opacity-60"
                      style={{ bottom: `${Math.min((cat.totalMin > 0 ? cat.totalMin / (cat.totalMin * 3) : 0.33) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-[9px] text-muted-foreground text-center leading-tight">{cat.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-4 justify-center">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-sm bg-roksal-green/70" />
              <span className="text-[9px] text-muted-foreground">Zaloga v redu</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-sm bg-roksal-red/70" />
              <span className="text-[9px] text-muted-foreground">Nizka zaloga</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-0.5 bg-roksal-amber" />
              <span className="text-[9px] text-muted-foreground">Min. zaloga</span>
            </div>
          </div>

          {/* Total Value Estimate Row */}
          <div className="mt-3 flex items-center justify-between rounded-lg bg-secondary/50 p-3">
            <div className="flex items-center gap-2">
              <Euro className="h-4 w-4 text-roksal-ink" />
              <span className="text-xs text-muted-foreground">Ocena vrednosti zaloge</span>
            </div>
            <span className="text-sm font-bold tabular-nums text-roksal-ink">
              {totalValueEstimate.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Stats Header */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <Card className="px-3 py-3 card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Artikli
          </p>
          <p className="text-xl font-bold tabular-nums text-roksal-ink">{totalItems}</p>
        </Card>
        <Card className="px-3 py-3 card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Skupna zaloga
          </p>
          <p className="text-xl font-bold tabular-nums text-roksal-ink">
            {totalStock.toFixed(0)}
          </p>
        </Card>
        <Card className="px-3 py-3 card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '180ms' }}>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Opozorila
          </p>
          <p className={`text-xl font-bold tabular-nums ${lowStockItems.length > 0 ? 'text-roksal-red' : 'text-roksal-green'}`}>
            {lowStockItems.length}
          </p>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-roksal-red/20 bg-roksal-red/5 p-3 slide-in-right">
          <AlertTriangle className="h-5 w-5 shrink-0 text-roksal-red" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-roksal-ink">
              Nizka zaloga!
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {lowStockItems.map((i) => i.naziv).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Filter Tabs + CSV izvoz (R136) */}
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 ${
                filter === tab.id
                  ? 'bg-roksal-navy text-white border-b-2 border-white/30'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={exportZalogaCsv}
          className="h-8 shrink-0 gap-1.5 text-[11px] font-medium tabular-nums press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
          aria-label="Izvozi vidno zalogo kot CSV"
          title="Izvozi vidno zalogo (upošteva filter) kot CSV za Excel"
        >
          <Download className="h-3.5 w-3.5" />
          CSV
        </Button>
      </div>

      {/* Inventory List */}
      <Card className="animate-fade-in-up transition-all duration-200" style={{ animationDelay: '240ms' }}>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-0 p-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-full mb-2" />
              ))}
            </div>
          ) : filtered.length > 0 ? (
            <div className="divide-y divide-border/50 md:grid md:grid-cols-2 md:gap-3 md:divide-y-0 md:p-3">
              {filtered.map((item) => {
                const isLow = item.kolicinaZaloga <= item.minimalnaZaloga
                return (
                  <div
                    key={item.id}
                    className="group flex flex-col gap-2 px-4 py-3 transition-all duration-200 hover:bg-secondary/20 md:rounded-lg md:border md:border-border/50 md:hover:border-roksal-navy/20 md:hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-roksal-ink">
                            {item.naziv}
                          </p>
                          {isLow && (
                            <TrendingDown className="h-3.5 w-3.5 shrink-0 text-roksal-red" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {item.sifraMateriala}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Reorder button for low stock items */}
                        {isLow && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 text-[10px] gap-1 border-roksal-red/30 text-roksal-red hover:bg-roksal-red/10 press-scale focus-visible:ring-2 focus-visible:ring-roksal-red/40"
                            onClick={() => handleReorder(item)}
                          >
                            <ShoppingCart className="h-3 w-3" />
                            Naroči
                          </Button>
                        )}
                        <div className="text-right">
                          <p
                            className={`text-lg font-bold tabular-nums ${
                              isLow ? 'text-roksal-red' : 'text-roksal-ink'
                            }`}
                          >
                            {item.kolicinaZaloga}
                            <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                              {item.enota}
                            </span>
                          </p>
                          <p className="text-[10px] tabular-nums text-muted-foreground">
                            Min: {item.minimalnaZaloga} {item.enota}
                          </p>
                        </div>
                      </div>
                    </div>
                    {/* Stock Level Bar */}
                    <div className="space-y-0.5">
                      <Progress
                        value={getStockPercent(item)}
                        className={`h-1.5 ${isLow ? '[&>div]:bg-roksal-red' : getStockPercent(item) <= 50 ? '[&>div]:bg-roksal-amber' : '[&>div]:bg-roksal-green'}`}
                      />
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                          <Archive className="mr-1 h-2.5 w-2.5" />
                          {typeLabels[item.tip] || item.tip}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {item._count?.usages || 0} uporab
                        </span>
                      </div>
                    </div>

                    {/* R144 (§24) — Šarže (lot/batch): sledljivost porekla */}
                    <div>
                      <button
                        type="button"
                        onClick={() => void toggleLots(item)}
                        aria-expanded={lotsOpenId === item.id}
                        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[10px] font-semibold text-roksal-ink/70 transition-colors hover:bg-secondary hover:text-roksal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
                        title="Od kod je ta material? Šarže, dobavitelji in poraba"
                      >
                        <PackageSearch className="h-3 w-3" aria-hidden="true" />
                        Šarže
                        {lotsOpenId === item.id ? (
                          <ChevronUp className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="h-3 w-3" aria-hidden="true" />
                        )}
                      </button>

                      {lotsOpenId === item.id && (
                        <div className="mt-1.5 rounded-lg border border-border/60 bg-secondary/30 p-2 animate-fade-in-up">
                          {lotsLoading && (
                            <div className="flex items-center justify-center gap-2 py-3 text-[11px] text-muted-foreground">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                              Branje šarž …
                            </div>
                          )}
                          {!lotsLoading && lotsError && (
                            <p
                              role="alert"
                              className="flex items-start gap-1.5 rounded-md border border-roksal-red/30 bg-roksal-red/5 px-2 py-1.5 text-[11px] font-semibold text-roksal-red"
                            >
                              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                              {lotsError}
                            </p>
                          )}
                          {!lotsLoading && !lotsError && lotsData && lotsData.lots.length === 0 && (
                            <p className="py-2 text-center text-[11px] text-muted-foreground">
                              Ta artikel še nima šarž — prvi prihod jih ustvari.
                            </p>
                          )}
                          {!lotsLoading && !lotsError && lotsData && lotsData.lots.length > 0 && (
                            <ul className="space-y-1.5" role="list">
                              {lotsData.lots.map((lot) => {
                                const st = lotStatusStyle[lot.status] ?? lotStatusStyle.ACTIVE
                                const pct =
                                  lot.quantityInitial > 0
                                    ? Math.max((lot.quantityRemaining / lot.quantityInitial) * 100, 0)
                                    : 0
                                return (
                                  <li
                                    key={lot.id}
                                    className="rounded-md border border-border/50 bg-card p-2 transition-all hover:border-roksal-navy/25 dark:hover:border-roksal-ink/25 hover:shadow-sm"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex min-w-0 items-center gap-1.5">
                                        <span
                                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.dot}`}
                                          aria-hidden="true"
                                        />
                                        <p className="truncate font-mono text-[10px] font-semibold text-roksal-ink">
                                          {lot.lotNumber}
                                        </p>
                                      </div>
                                      <span
                                        className={`shrink-0 text-[9px] font-bold tabular-nums ${st.text}`}
                                      >
                                        {st.label}
                                      </span>
                                    </div>
                                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                                      <span className="truncate">
                                        {lot.dobavitelj ? (
                                          lot.dobavitelj
                                        ) : (
                                          <span className="italic">poreklo neznano</span>
                                        )}
                                        {lot.purchasePrice != null && (
                                          <span className="ml-1 tabular-nums text-roksal-ink/70">
                                            · {lot.purchasePrice.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/{lotsData.inventory.enota}
                                          </span>
                                        )}
                                      </span>
                                      <span className="shrink-0 tabular-nums">
                                        {new Date(lot.deliveryDate).toLocaleDateString('sl-SI')}
                                      </span>
                                    </div>
                                    <div className="mt-1 flex items-center justify-between gap-2">
                                      <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
                                        <div
                                          className={`h-full rounded-full transition-all duration-300 ${
                                            pct <= 0 ? 'bg-roksal-amber' : pct <= 25 ? 'bg-roksal-red' : 'bg-roksal-green'
                                          }`}
                                          style={{ width: `${Math.min(pct, 100)}%` }}
                                        />
                                      </div>
                                      <span className="shrink-0 text-[10px] font-semibold tabular-nums text-roksal-ink">
                                        {lot.quantityRemaining}/{lot.quantityInitial} {lotsData.inventory.enota}
                                      </span>
                                    </div>
                                    {lot.allocations.length > 0 && (
                                      <div className="mt-1.5 space-y-0.5 border-t border-border/50 pt-1.5">
                                        {lot.allocations.slice(0, 3).map((a) => (
                                          <p key={a.id} className="flex items-center justify-between text-[9px] text-muted-foreground">
                                            <span>
                                              {a.eventType}
                                              {a.projekt ? ` · ${a.projekt}` : ''}
                                            </span>
                                            <span className="font-semibold tabular-nums">
                                              {a.kolicina > 0 ? '+' : ''}
                                              {a.kolicina}
                                            </span>
                                          </p>
                                        ))}
                                        {lot.allocations.length > 3 && (
                                          <p className="text-[9px] text-muted-foreground/70">
                                            + {lot.allocations.length - 3} starejših alokacij
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </li>
                                )
                              })}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : inventory.length === 0 && invError ? (
            <div
              role="alert"
              className="flex flex-col gap-2 rounded-lg border border-roksal-amber/40 bg-roksal-amber/10 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-roksal-amber" aria-hidden="true" />
                <p className="text-xs text-roksal-ink">
                  {invError} Stanja zaloge ni izmišljeno — brez strežnika ni podatka.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setInvError(null); void fetchInventory() }}
                className="shrink-0 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                aria-label="Ponovno naloži zalogo"
              >
                Poskusi znova
              </Button>
            </div>
          ) : inventory.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Zaloga je prazna"
              description="Dodaj material v zalogo."
            />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Ni artiklov za ta filter
            </p>
          )}
        </CardContent>
      </Card>

      {/* Inventory Movement Dialog */}
      <Dialog open={movementOpen} onOpenChange={setMovementOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-roksal-ink">Premik zaloge</DialogTitle>
            <DialogDescription>
              Zabeležite premik inventarja — porabo, dopolnitev ali odpis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Movement Type */}
            <div className="space-y-1.5">
              <Label className="text-xs">Tip premika</Label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(movementLabels) as [MovementType, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setMovementType(key)}
                    className={`rounded-lg border p-2 text-center text-xs font-medium transition-all press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 ${
                      movementType === key
                        ? `border-roksal-navy bg-roksal-navy/10 text-roksal-ink shadow-sm`
                        : 'border-border bg-background text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Inventory Item */}
            <div className="space-y-1.5">
              <Label className="text-xs">Artikel</Label>
              <Select value={movementInventoryId} onValueChange={setMovementInventoryId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Izberite artikel" />
                </SelectTrigger>
                <SelectContent>
                  {inventory.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.naziv} ({item.kolicinaZaloga} {item.enota})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedItem && (
                <p className="text-[10px] tabular-nums text-muted-foreground">
                  Trenutna zaloga: {selectedItem.kolicinaZaloga} {selectedItem.enota} · Min: {selectedItem.minimalnaZaloga} {selectedItem.enota}
                </p>
              )}
            </div>

            {/* Quantity */}
            <div className="space-y-1.5">
              <Label htmlFor="mov-qty" className="text-xs">
                Količina ({selectedItem?.enota || 'kos'})
              </Label>
              <Input
                id="mov-qty"
                type="number"
                value={movementQuantity}
                onChange={(e) => setMovementQuantity(e.target.value)}
                placeholder="1"
                min="0.1"
                step="0.5"
                className="tabular-nums focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
              />
            </div>

            {/* Project (optional) */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                Projekt <span className="text-muted-foreground">(neobvezno)</span>
              </Label>
              <Select value={movementProjectId} onValueChange={setMovementProjectId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Brez projekta" />
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

            {/* Summary */}
            {movementInventoryId && movementQuantity && parseFloat(movementQuantity) > 0 && selectedItem && (
              <Card className="bg-secondary/50">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Novo stanje:</span>
                    <span className={`font-bold tabular-nums ${
                      movementType === 'DOPOLNITEV'
                        ? 'text-roksal-green'
                        : (selectedItem.kolicinaZaloga - parseFloat(movementQuantity)) < selectedItem.minimalnaZaloga
                          ? 'text-roksal-red'
                          : 'text-roksal-ink'
                    }`}>
                      {movementType === 'DOPOLNITEV'
                        ? (selectedItem.kolicinaZaloga + parseFloat(movementQuantity)).toFixed(1)
                        : (selectedItem.kolicinaZaloga - parseFloat(movementQuantity)).toFixed(1)
                      } {selectedItem.enota}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge className={`text-[10px] h-5 px-1.5 ${movementColors[movementType]}`}>
                      {movementLabels[movementType]}
                    </Badge>
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {movementQuantity} {selectedItem.enota}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMovementOpen(false)}
              className="focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
            >
              Prekliči
            </Button>
            <Button
              onClick={handleMovement}
              disabled={submitting || !movementInventoryId || !movementQuantity || parseFloat(movementQuantity) <= 0}
              className="bg-roksal-navy hover:bg-roksal-navy/90 text-white shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-roksal-navy/40 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Package className="mr-2 h-4 w-4" />
              )}
              Potrdi premik
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// R152: demoInventory IZBRISAN — napaka/prazna zaloga ni več prikazala
// izmišljenih artiklov (fail-open). Zdaj: prazno + vidna napaka.

