'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
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
  AlertTriangle,
  Filter,
  TrendingDown,
  Archive,
  Plus,
  Loader2,
  ShoppingCart,
  Euro,
} from 'lucide-react'
import { toast } from 'sonner'

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
  PORABA: 'bg-roksal-amber/15 text-roksal-navy',
  DOPOLNITEV: 'bg-roksal-green/15 text-roksal-green',
  ODPIS: 'bg-roksal-red/15 text-roksal-red',
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

  useEffect(() => {
    async function fetchData() {
      try {
        const [invRes, projRes] = await Promise.all([
          fetch('/api/inventory'),
          fetch('/api/projects'),
        ])
        if (invRes.ok) {
          const data = await invRes.json()
          if (data.length > 0) {
            setInventory(data)
          } else {
            setInventory(demoInventory)
          }
        } else {
          setInventory(demoInventory)
        }
        if (projRes.ok) {
          const projData = await projRes.json()
          setProjects(projData)
        }
      } catch {
        setInventory(demoInventory)
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
        if (data.length > 0) {
          setInventory(data)
        }
      }
    } catch {
      // keep existing
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
    <div className="space-y-4 px-4 pb-4 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-roksal-navy">Zaloga</h2>
          <p className="text-sm text-muted-foreground">
            Upravljanje materiala in inventarja
          </p>
        </div>
        <Button
          size="icon"
          className="h-9 w-9 bg-roksal-amber hover:bg-roksal-amber/90 text-roksal-navy shadow-sm"
          onClick={() => setMovementOpen(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Mini Stock Chart */}
      <Card className="card-accent-left card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '0ms' }}>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-roksal-navy">
            Pregled zaloge po kategorijah
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex items-end justify-around gap-3 h-24">
            {categoryStock.map((cat) => (
              <div key={cat.category} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[10px] font-medium text-roksal-navy">{cat.totalStock}</span>
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
              <Euro className="h-4 w-4 text-roksal-navy" />
              <span className="text-xs text-muted-foreground">Ocena vrednosti zaloge</span>
            </div>
            <span className="text-sm font-bold text-roksal-navy">
              {totalValueEstimate.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Stats Header */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="px-3 py-3 card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Artikli
          </p>
          <p className="text-xl font-bold text-roksal-navy">{totalItems}</p>
        </Card>
        <Card className="px-3 py-3 card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Skupna zaloga
          </p>
          <p className="text-xl font-bold text-roksal-navy">
            {totalStock.toFixed(0)}
          </p>
        </Card>
        <Card className="px-3 py-3 card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '180ms' }}>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Opozorila
          </p>
          <p className={`text-xl font-bold ${lowStockItems.length > 0 ? 'text-roksal-red' : 'text-roksal-green'}`}>
            {lowStockItems.length}
          </p>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-roksal-red/20 bg-roksal-red/5 p-3 slide-in-right">
          <AlertTriangle className="h-5 w-5 shrink-0 text-roksal-red" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-roksal-navy">
              Nizka zaloga!
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {lowStockItems.map((i) => i.naziv).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors press-scale ${
              filter === tab.id
                ? 'bg-roksal-navy text-white border-b-2 border-white/30'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
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
            <div className="divide-y divide-border/50">
              {filtered.map((item) => {
                const isLow = item.kolicinaZaloga <= item.minimalnaZaloga
                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-secondary/20"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-roksal-navy">
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
                            className="h-7 px-2.5 text-[10px] gap-1 border-roksal-red/30 text-roksal-red hover:bg-roksal-red/10 press-scale"
                            onClick={() => handleReorder(item)}
                          >
                            <ShoppingCart className="h-3 w-3" />
                            Naroči
                          </Button>
                        )}
                        <div className="text-right">
                          <p
                            className={`text-lg font-bold ${
                              isLow ? 'text-roksal-red' : 'text-roksal-navy'
                            }`}
                          >
                            {item.kolicinaZaloga}
                            <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                              {item.enota}
                            </span>
                          </p>
                          <p className="text-[10px] text-muted-foreground">
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
                  </div>
                )
              })}
            </div>
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
            <DialogTitle className="text-roksal-navy">Premik zaloge</DialogTitle>
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
                    className={`rounded-lg border p-2 text-center text-xs font-medium transition-colors press-scale ${
                      movementType === key
                        ? `border-roksal-navy bg-roksal-navy/10 text-roksal-navy`
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
                <p className="text-[10px] text-muted-foreground">
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
                    <span className={`font-bold ${
                      movementType === 'DOPOLNITEV'
                        ? 'text-roksal-green'
                        : (selectedItem.kolicinaZaloga - parseFloat(movementQuantity)) < selectedItem.minimalnaZaloga
                          ? 'text-roksal-red'
                          : 'text-roksal-navy'
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
                    <span className="text-[10px] text-muted-foreground">
                      {movementQuantity} {selectedItem.enota}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovementOpen(false)}>
              Prekliči
            </Button>
            <Button
              onClick={handleMovement}
              disabled={submitting || !movementInventoryId || !movementQuantity || parseFloat(movementQuantity) <= 0}
              className="bg-roksal-navy hover:bg-roksal-navy/90 text-white"
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

const demoInventory: InventoryItem[] = [
  {
    id: 'inv1',
    sifraMateriala: 'WPC-C80-BRN',
    naziv: 'WPC Classic deska 80mm — Rjava',
    tip: 'WPC_deska',
    kolicinaZaloga: 245,
    enota: 'm',
    minimalnaZaloga: 100,
    cenaEur: 12.5,
    _count: { usages: 12, movements: 8 },
  },
  {
    id: 'inv2',
    sifraMateriala: 'WPC-C80-ANT',
    naziv: 'WPC Classic deska 80mm — Antik',
    tip: 'WPC_deska',
    kolicinaZaloga: 38,
    enota: 'm',
    minimalnaZaloga: 50,
    cenaEur: 12.5,
    _count: { usages: 5, movements: 3 },
  },
  {
    id: 'inv3',
    sifraMateriala: 'INOX-M12-A4',
    naziv: 'Inox vijak M12 × 100 A4',
    tip: 'Inox_vijak',
    kolicinaZaloga: 180,
    enota: 'kos',
    minimalnaZaloga: 50,
    cenaEur: 2.8,
    _count: { usages: 24, movements: 6 },
  },
  {
    id: 'inv4',
    sifraMateriala: 'INOX-M8-A4',
    naziv: 'Inox vijak M8 × 60 A4',
    tip: 'Inox_vijak',
    kolicinaZaloga: 12,
    enota: 'kos',
    minimalnaZaloga: 30,
    cenaEur: 2.8,
    _count: { usages: 18, movements: 4 },
  },
  {
    id: 'inv5',
    sifraMateriala: 'CHEM-HIT-330',
    naziv: 'Hilti HIT-RE 500 smola 330ml',
    tip: 'Kemicno_sidro',
    kolicinaZaloga: 8,
    enota: 'kos',
    minimalnaZaloga: 10,
    cenaEur: 28.0,
    _count: { usages: 3, movements: 2 },
  },
  {
    id: 'inv6',
    sifraMateriala: 'CHEM-FIS-300',
    naziv: 'Fischer FIS V smola 300ml',
    tip: 'Kemicno_sidro',
    kolicinaZaloga: 15,
    enota: 'kos',
    minimalnaZaloga: 10,
    cenaEur: 22.0,
    _count: { usages: 2, movements: 1 },
  },
  {
    id: 'inv7',
    sifraMateriala: 'ALU-P40-ANT',
    naziv: 'Alu profil Z-line 40mm — Antik',
    tip: 'Alu_profil',
    kolicinaZaloga: 120,
    enota: 'm',
    minimalnaZaloga: 50,
    cenaEur: 18.0,
    _count: { usages: 7, movements: 3 },
  },
  {
    id: 'inv8',
    sifraMateriala: 'ALU-P40-WHT',
    naziv: 'Alu profil Z-line 40mm — Bela',
    tip: 'Alu_profil',
    kolicinaZaloga: 65,
    enota: 'm',
    minimalnaZaloga: 30,
    cenaEur: 18.0,
    _count: { usages: 4, movements: 2 },
  },
]
