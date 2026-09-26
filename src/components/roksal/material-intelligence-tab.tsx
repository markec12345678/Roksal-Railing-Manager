'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { downloadCsv, todayStamp, type CsvValue } from '@/lib/csv-export'
import {
  Package,
  TrendingUp,
  ShoppingCart,
  Plus,
  Truck,
  Euro,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  ArrowRight,
  Download,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

interface Supplier {
  id: string
  naziv: string
  kontakt: string | null
  email: string | null
  telefon: string | null
  dobavniRok: number
  popust: number
  aktivna: boolean
  _count?: { materialPrices: number; orders: number }
}

interface Inventory {
  id: string
  sifraMateriala: string
  naziv: string
  tip: string
  kolicinaZaloga: number
  enota: string
  minimalnaZaloga: number
}

interface RefinedItem {
  bomItem: { kategorija: string; naziv: string; kolicina: number; enota: string; opomba?: string }
  inventory: Inventory | null
  bestPrice: { cena: number; supplier: string; supplierId: string } | null
  allPrices: Array<{ cena: number; supplier: string; supplierId: string }>
  razlikaCen: number
  skupajCena: number
}

interface BomRefineData {
  projectId: string
  projectName: string
  dealLocked: boolean
  refinedItems: RefinedItem[]
  optimizacija: Array<{ supplierId: string; supplier: string; items: RefinedItem[]; skupaj: number }>
  skupajCena: number
  skupajPrihranek: number
  matchedCount: number
  totalCount: number
}

interface MaterialOrder {
  id: string
  status: string
  skupajCena: number
  datumNarocila: string
  datumDobave: string | null
  opombe: string | null
  supplier: { naziv: string }
  items: Array<{ naziv: string; kolicina: number; enota: string; cena: number }>
}

// ---------------------------------------------------------------------------
// R140 — pomožniki prikaza + izvoza (Material Intelligence).
//   • fmtDate: sl-SI datum (dd.mm.llll) — isti prikaz kot logistics.
//   • downloadOrdersCsv: deterministični kontrakt kot Zaloga/Računi/Termini
//     (BOM, podpičje, decimalna vejica, CRLF — src/lib/csv-export.ts).
//     ENA VRSTICA NA POSTAVKO (detail nivo) — pisarna filtrira po
//     dobavitelju/statusu v Excelu; skupajCena se ponovi za vsako vrstico,
//     da vrstica stoji sama (brez VLOOKUP).
// ---------------------------------------------------------------------------
function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function downloadOrdersCsv(orders: MaterialOrder[]): number {
  const rows: CsvValue[][] = []
  for (const o of orders) {
    for (const item of o.items) {
      rows.push([
        fmtDate(o.datumNarocila),
        o.supplier.naziv,
        o.status,
        item.naziv,
        item.kolicina,
        item.enota,
        item.cena,
        item.cena * item.kolicina,
        o.skupajCena,
        o.opombe ?? '',
      ])
    }
  }
  downloadCsv(
    `Narocila-${todayStamp()}.csv`,
    ['Datum', 'Dobavitelj', 'Status', 'Artikel', 'Količina', 'Enota', 'Cena', 'Vrednost', 'Naročilo skupaj', 'Opombe'],
    rows,
  )
  return rows.length
}

export function MaterialIntelligenceTab({ projectId }: { projectId: string | null }) {
  const [tab, setTab] = useState<'bom' | 'orders' | 'suppliers'>('bom')
  const [bomRefine, setBomRefine] = useState<BomRefineData | null>(null)
  const [orders, setOrders] = useState<MaterialOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [converting, setConverting] = useState(false)
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false)
  const [priceDialogOpen, setPriceDialogOpen] = useState(false)
  const [selectedInventory, setSelectedInventory] = useState<Inventory | null>(null)
  const [inventories, setInventories] = useState<Inventory[]>([])
  // R140: razprta postavka naročila (en hkrati — preglednost na telefonu).
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const { toast } = useToast()

  // Nov dobavitelj form
  const [newSupplier, setNewSupplier] = useState({ naziv: '', kontakt: '', email: '', telefon: '', dobavniRok: 7, popust: 0 })
  // Nova cena form
  const [newPrice, setNewPrice] = useState({ supplierId: '', cena: '', opomba: '' })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [supRes, invRes] = await Promise.all([
        fetch('/api/suppliers'),
        fetch('/api/inventory'),
      ])
      if (supRes.ok) setSuppliers(await supRes.json())
      if (invRes.ok) setInventories(await invRes.json())

      if (projectId && tab === 'bom') {
        const bomRes = await fetch(`/api/bom-refine?projectId=${projectId}`)
        if (bomRes.ok) setBomRefine(await bomRes.json())
      }
      if (tab === 'orders') {
        const ordRes = await fetch('/api/material-orders')
        if (ordRes.ok) setOrders(await ordRes.json())
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [projectId, tab])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleConvertToOrder = async (supplierId?: string) => {
    if (!projectId) return
    setConverting(true)
    try {
      const res = await fetch('/api/bom-refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, supplierId }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: '✓ Naročilo ustvarjeno', description: data.message })
        setTab('orders')
        loadData()
      } else {
        toast({ title: 'Napaka', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Omrežna napaka', variant: 'destructive' })
    } finally {
      setConverting(false)
    }
  }

  const handleCreateSupplier = async () => {
    if (!newSupplier.naziv) return
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSupplier),
      })
      if (res.ok) {
        toast({ title: 'Dobavitelj ustvarjen' })
        setSupplierDialogOpen(false)
        setNewSupplier({ naziv: '', kontakt: '', email: '', telefon: '', dobavniRok: 7, popust: 0 })
        loadData()
      }
    } catch {
      toast({ title: 'Napaka', variant: 'destructive' })
    }
  }

  const handleAddPrice = async () => {
    if (!selectedInventory || !newPrice.supplierId || !newPrice.cena) return
    try {
      const res = await fetch('/api/material-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventoryId: selectedInventory.id,
          supplierId: newPrice.supplierId,
          cena: parseFloat(newPrice.cena),
          opomba: newPrice.opomba,
        }),
      })
      if (res.ok) {
        toast({ title: 'Cena dodana' })
        setPriceDialogOpen(false)
        setNewPrice({ supplierId: '', cena: '', opomba: '' })
        loadData()
      }
    } catch {
      toast({ title: 'Napaka', variant: 'destructive' })
    }
  }

  const handleOrderStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetch('/api/material-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, status }),
      })
      if (res.ok) {
        toast({ title: `Status → ${status}` })
        loadData()
      } else {
        // R140: fail-verbose — 403/409 napake se POKAŽEJO (prej tiho ugasil
        // gumb brez razlage; npr. MONTER ni videl zakaj "Dobljeno" ne dela).
        const data = await res.json().catch(() => null)
        toast({ title: 'Napaka', description: data?.error ?? `HTTP ${res.status}`, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Omrežna napaka', variant: 'destructive' })
    }
  }

  // R140: izvoz vidnih naročil v CSV (pisarniški pregled).
  const handleOrdersCsv = () => {
    if (orders.length === 0) return
    const count = downloadOrdersCsv(orders)
    toast({ title: 'CSV prenesen', description: `${count} postavk v Narocila-${todayStamp()}.csv` })
  }

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        <Button type="button" variant={tab === 'bom' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('bom')} className={tab === 'bom' ? 'bg-roksal-navy text-white' : ''}>
          <Sparkles className="h-3.5 w-3.5 mr-1" /> BOM Refine
        </Button>
        <Button type="button" variant={tab === 'orders' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('orders')} className={tab === 'orders' ? 'bg-roksal-navy text-white' : ''}>
          <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Naročila
        </Button>
        <Button type="button" variant={tab === 'suppliers' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('suppliers')} className={tab === 'suppliers' ? 'bg-roksal-navy text-white' : ''}>
          <Truck className="h-3.5 w-3.5 mr-1" /> Dobavitelji
        </Button>
      </div>

      {/* BOM Refine tab */}
      {tab === 'bom' && (
        <div className="space-y-3">
          {!projectId ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Izberi projekt v Domov za BOM optimizacijo.</p>
            </CardContent></Card>
          ) : loading ? (
            <Card><CardContent className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-roksal-amber" /></CardContent></Card>
          ) : !bomRefine?.dealLocked ? (
            <Card className="border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40">
              <CardContent className="py-6 text-center">
                <AlertTriangle className="h-8 w-8 mx-auto text-amber-500 dark:text-amber-400 mb-2" />
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Deal ni zaklenjen</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">Zakleni deal po podpisu (V4.1) za BOM optimizacijo.</p>
              </CardContent>
            </Card>
          ) : bomRefine ? (
            <>
              {/* Skupne statistike */}
              <div className="grid grid-cols-3 gap-2">
                <Card className="border-green-200 dark:border-green-800"><CardContent className="p-3">
                  <div className="flex items-center gap-1 mb-1"><CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" /><span className="text-[10px] text-muted-foreground">Skupaj</span></div>
                  <div className="text-lg font-bold text-roksal-ink tabular-nums">{bomRefine.skupajCena.toFixed(0)} €</div>
                </CardContent></Card>
                <Card className="border-amber-200 dark:border-amber-800"><CardContent className="p-3">
                  <div className="flex items-center gap-1 mb-1"><TrendingUp className="h-3 w-3 text-amber-600 dark:text-amber-400" /><span className="text-[10px] text-muted-foreground">Prihranek</span></div>
                  <div className="text-lg font-bold text-amber-700 dark:text-amber-300 tabular-nums">{bomRefine.skupajPrihranek.toFixed(0)} €</div>
                </CardContent></Card>
                <Card className="border-blue-200 dark:border-blue-800"><CardContent className="p-3">
                  <div className="flex items-center gap-1 mb-1"><Package className="h-3 w-3 text-blue-600 dark:text-blue-400" /><span className="text-[10px] text-muted-foreground">Artikli</span></div>
                  <div className="text-lg font-bold text-roksal-ink tabular-nums">{bomRefine.matchedCount}/{bomRefine.totalCount}</div>
                </CardContent></Card>
              </div>

              {/* Optimizacija po dobaviteljih */}
              {bomRefine.optimizacija.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Sparkles className="h-4 w-4 text-roksal-amber" /> Optimalni dobavitelji
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {bomRefine.optimizacija.map((opt, i) => (
                      <div key={opt.supplierId} className={`rounded-lg border p-2.5 transition-colors ${i === 0 ? 'border-green-300 bg-green-50' : 'border-border hover:border-roksal-navy/25 dark:hover:border-roksal-ink/25'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {i === 0 && <Badge className="bg-green-600 text-white text-[8px]">NAJBOLJŠI</Badge>}
                            <span className="text-sm font-medium text-roksal-ink">{opt.supplier}</span>
                          </div>
                          <span className="text-sm font-bold text-roksal-amber tabular-nums">{opt.skupaj.toFixed(0)} €</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">{opt.items.length} artiklov</div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Refined items */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">BOM Draft → Optimiziran</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {bomRefine.refinedItems.map((item, i) => (
                    <div key={i} className="rounded-lg border border-border p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Badge variant="outline" className="text-[8px] bg-muted/50">{item.bomItem.kategorija}</Badge>
                            <span className="text-xs font-medium text-roksal-ink truncate">{item.bomItem.naziv}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground">{item.bomItem.kolicina} {item.bomItem.enota}</div>
                        </div>
                        <div className="text-right shrink-0">
                          {item.bestPrice ? (
                            <>
                              <div className="text-sm font-bold text-roksal-amber tabular-nums">{item.skupajCena.toFixed(0)} €</div>
                              <div className="text-[9px] text-muted-foreground">{item.bestPrice.supplier}</div>
                              {item.razlikaCen > 0 && (
                                <div className="text-[9px] text-green-600 dark:text-green-400 tabular-nums">−{item.razlikaCen.toFixed(2)} €/en</div>
                              )}
                            </>
                          ) : (
                            <Badge variant="outline" className="text-[8px] bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800">Ni cene</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Convert to order */}
              <Button
                type="button"
                onClick={() => handleConvertToOrder()}
                disabled={converting || bomRefine.matchedCount === 0}
                className="w-full bg-roksal-amber text-white hover:bg-roksal-amber/90"
              >
                {converting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                Pretvori v naročilo (najboljši dobavitelj)
              </Button>
            </>
          ) : null}
        </div>
      )}

      {/* Orders tab */}
      {tab === 'orders' && (
        <div className="space-y-2">
          {loading ? (
            <Card><CardContent className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-roksal-amber" /></CardContent></Card>
          ) : orders.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Ni naročil. Pretvori BOM draft v naročilo.</p>
            </CardContent></Card>
          ) : (
            <>
              {/* R140: CSV izvoz — isti kontrakt kot Zaloga/Računi/Termini. */}
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleOrdersCsv}
                  className="h-8 text-xs focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1"
                >
                  <Download className="h-3.5 w-3.5 mr-1 text-roksal-amber" /> CSV
                </Button>
              </div>
              {orders.map((order) => {
                const expanded = expandedOrder === order.id
                return (
                  <Card
                    key={order.id}
                    className="transition-colors hover:border-roksal-navy/25 dark:hover:border-roksal-ink/25 hover:shadow-sm"
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-roksal-ink">{order.supplier.naziv}</span>
                            <Badge variant="outline" className={`text-[8px] ${
                              order.status === 'DOBLJENO' ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800' :
                              order.status === 'POSLANO' ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800' :
                              order.status === 'POTRJENO' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800' :
                              'bg-gray-50 dark:bg-gray-950/40 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-800'
                            }`}>{order.status}</Badge>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                            {fmtDate(order.datumNarocila)}
                            {order.datumDobave && ` → dobava ${fmtDate(order.datumDobave)}`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-roksal-amber tabular-nums">{order.skupajCena.toFixed(0)} €</div>
                          <div className="text-[10px] text-muted-foreground tabular-nums">{order.items.length} artiklov</div>
                        </div>
                      </div>
                      {/* R140: razprta postavka naročila — artikli s količino/ceno
                          (tabular-nums); toggle gumb je pravi button z aria. */}
                      <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => setExpandedOrder(expanded ? null : order.id)}
                        className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-[10px] text-muted-foreground transition-colors hover:text-roksal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1"
                      >
                        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        {expanded ? 'Skrij postavke' : 'Pokaži postavke'}
                      </button>
                      {expanded && (
                        <div className="mt-1 space-y-1">
                          {order.items.map((item, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 rounded border border-border/60 bg-muted/40 px-2 py-1">
                              <span className="min-w-0 flex-1 truncate text-[11px] text-roksal-ink">{item.naziv}</span>
                              <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                                {item.kolicina} {item.enota}
                              </span>
                              <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">{item.cena.toFixed(2)} €/en</span>
                              <span className="shrink-0 text-[11px] font-semibold text-roksal-ink tabular-nums">
                                {(item.cena * item.kolicina).toFixed(2)} €
                              </span>
                            </div>
                          ))}
                          {order.opombe && (
                            <div className="px-2 text-[10px] italic text-muted-foreground">Opomba: {order.opombe}</div>
                          )}
                        </div>
                      )}
                      {/* Status actions */}
                      <div className="flex gap-1 pt-2 border-t border-border">
                        {order.status === 'OSNUTEK' && (
                          <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1" onClick={() => handleOrderStatus(order.id, 'POSLANO')}>
                            Pošlji
                          </Button>
                        )}
                        {order.status === 'POSLANO' && (
                          <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1" onClick={() => handleOrderStatus(order.id, 'POTRJENO')}>
                            Potrdi
                          </Button>
                        )}
                        {order.status === 'POTRJENO' && (
                          <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] bg-green-50 dark:bg-green-950/40 focus-visible:ring-2 focus-visible:ring-green-600/40 focus-visible:ring-offset-1" onClick={() => handleOrderStatus(order.id, 'DOBLJENO')}>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Dobljeno (v zalogo)
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </>
          )}
        </div>
      )}

      {/* Suppliers tab */}
      {tab === 'suppliers' && (
        <div className="space-y-3">
          <Button type="button" onClick={() => setSupplierDialogOpen(true)} className="w-full bg-roksal-navy text-white shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-roksal-navy/40">
            <Plus className="h-4 w-4 mr-2" /> Nov dobavitelj
          </Button>
          {loading ? (
            <Card><CardContent className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-roksal-amber" /></CardContent></Card>
          ) : suppliers.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              <Truck className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Ni dobaviteljev. Dodaj prvega.</p>
            </CardContent></Card>
          ) : (
            suppliers.map((sup) => (
              <Card key={sup.id} className="transition-colors hover:border-roksal-navy/25 dark:hover:border-roksal-ink/25 hover:shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {/* R144 stil: živa pika aktivnosti dobavitelja */}
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${sup.aktivna ? 'bg-roksal-green ring-2 ring-roksal-green/20' : 'bg-muted-foreground/40'}`}
                          aria-hidden="true"
                          title={sup.aktivna ? 'Aktiven dobavitelj' : 'Neaktiven dobavitelj'}
                        />
                        <span className="text-sm font-semibold text-roksal-ink truncate">{sup.naziv}</span>
                        {sup.popust > 0 && <Badge variant="outline" className="text-[8px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">-{sup.popust}%</Badge>}
                      </div>
                      <div className="text-[10px] text-muted-foreground space-y-0.5 tabular-nums">
                        {sup.kontakt && <div>{sup.kontakt}</div>}
                        {sup.telefon && <div>{sup.telefon}</div>}
                        <div>Dobavni rok: {sup.dobavniRok} dni</div>
                        {sup._count && <div>{sup._count.materialPrices} cen · {sup._count.orders} naročil</div>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}

          {/* Dodaj ceno materiala */}
          <Separator />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Euro className="h-4 w-4 text-roksal-amber" /> Cene materiala</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label className="text-xs">Izberi material za dodajanje cene</Label>
              <Select onValueChange={(val) => {
                const inv = inventories.find((i) => i.id === val)
                if (inv) { setSelectedInventory(inv); setPriceDialogOpen(true) }
              }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Izberi material..." /></SelectTrigger>
                <SelectContent>
                  {inventories.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>{inv.naziv} ({inv.sifraMateriala})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialog: nov dobavitelj */}
      <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-roksal-ink">Nov dobavitelj</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div><Label className="text-xs">Naziv *</Label><Input value={newSupplier.naziv} onChange={(e) => setNewSupplier({ ...newSupplier, naziv: e.target.value })} className="h-9" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Kontakt</Label><Input value={newSupplier.kontakt} onChange={(e) => setNewSupplier({ ...newSupplier, kontakt: e.target.value })} className="h-9" /></div>
              <div><Label className="text-xs">Telefon</Label><Input value={newSupplier.telefon} onChange={(e) => setNewSupplier({ ...newSupplier, telefon: e.target.value })} className="h-9" /></div>
            </div>
            <div><Label className="text-xs">Email</Label><Input value={newSupplier.email} onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })} className="h-9" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Dobavni rok (dni)</Label><Input type="number" value={newSupplier.dobavniRok} onChange={(e) => setNewSupplier({ ...newSupplier, dobavniRok: parseInt(e.target.value) || 7 })} className="h-9" /></div>
              <div><Label className="text-xs">Popust (%)</Label><Input type="number" value={newSupplier.popust} onChange={(e) => setNewSupplier({ ...newSupplier, popust: parseFloat(e.target.value) || 0 })} className="h-9" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSupplierDialogOpen(false)}>Prekliči</Button>
            <Button type="button" onClick={handleCreateSupplier} className="bg-roksal-navy text-white">Shrani</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: nova cena */}
      <Dialog open={priceDialogOpen} onOpenChange={setPriceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-roksal-ink">Cena za {selectedInventory?.naziv}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Dobavitelj</Label>
            <Select value={newPrice.supplierId} onValueChange={(v) => setNewPrice({ ...newPrice, supplierId: v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Izberi..." /></SelectTrigger>
              <SelectContent>
                {suppliers.filter((s) => s.aktivna).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.naziv}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div><Label className="text-xs">Cena (EUR / {selectedInventory?.enota || 'enoto'})</Label><Input type="number" step="0.01" value={newPrice.cena} onChange={(e) => setNewPrice({ ...newPrice, cena: e.target.value })} className="h-9" /></div>
            <div><Label className="text-xs">Opomba (opcijsko)</Label><Input value={newPrice.opomba} onChange={(e) => setNewPrice({ ...newPrice, opomba: e.target.value })} placeholder="npr. akcijska cena" className="h-9" /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPriceDialogOpen(false)}>Prekliči</Button>
            <Button type="button" onClick={handleAddPrice} className="bg-roksal-navy text-white">Shrani ceno</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
