'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'
import { casOznaka } from '@/lib/osvezitev-fokus'
// R213 — EN VIR podzavihkov (tip-only uvoz: komponenta ostane LAZY dynamic
// import, r212 lekcija).
import type { MaterialSubTab, MaterialSubTabHint } from '@/lib/material-sub-tab'
import { downloadCsv, todayStamp, type CsvValue } from '@/lib/csv-export'
import {
  buildNarocilnicaIzNarocila,
  narociloPostavkaBeseda,
} from '@/lib/zaloga-povzetek'
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
  ClipboardList,
  XCircle,
  History,
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

// R209 — zgodovina prehodov naročila: dogodek iz /api/material-orders/history
// (statusPrej/statusPotem odloči strežnik po TOČNI enakosti orderId — UI samo
// prikaže; brez razčlenjevanja v odjemalcu, EN vir resnice na strežniku).
interface ZgodovinaVnos {
  id: string
  timestamp: string
  akcija: string
  statusPrej: string | null
  statusPotem: string | null
  uporabnik: { ime: string; email: string; vloga: string } | null
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

// R209 — človeška oznaka audit akcije (neznan akcija → surovi string,
// iskreno — brez ugibanja).
function akcijaOznaka(akcija: string): string {
  const zemljevid: Record<string, string> = {
    MATERIAL_ORDER_CREATED: 'Ustvarjeno',
    MATERIAL_ORDER_STATUS: 'Sprememba statusa',
    MATERIAL_RECEIPT: 'Prejem v zalogo',
    MATERIAL_RECEIPT_DUPLICATE: 'Podvojen prejem zavrnjen (idempotentno)',
  }
  return zemljevid[akcija] ?? akcija
}

// R209 — barvna družina statusnih značk (ISTA ogledala kot značka na kartici
// — vsi dark: na isti vrstici, 0 novih hex, r166/r172 družina).
function statusZnackaCls(status: string | null): string {
  if (status === 'PREKlicANO') return 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800'
  if (status === 'DOBLJENO') return 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800'
  if (status === 'POSLANO') return 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800'
  if (status === 'POTRJENO') return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
  return 'bg-gray-50 dark:bg-gray-950/40 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-800'
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

// R207 — stil statusnega filtra (pill družina R136/R204/R206; 0 novih hex,
// tokeni + focus ring; aria-pressed namesto aria-selected — pravi toggle).
function chipCls(aktiven: boolean): string {
  return `h-7 rounded-full border px-3 text-[11px] font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1 ${
    aktiven
      ? 'border-roksal-navy bg-roksal-navy text-white'
      : 'border-border bg-background text-muted-foreground hover:border-roksal-navy/40 dark:hover:border-roksal-ink/40 hover:text-roksal-ink'
  }`
}

export function MaterialIntelligenceTab({
  projectId,
  initialSubTab,
}: {
  projectId: string | null
  /** R213 — namig iz centralne navigacije (zvonček digest → Naročila):
   * začetni podzavihek + monotonski n (glej MaterialSubTabHint). */
  initialSubTab?: MaterialSubTabHint | null
}) {
  const [tab, setTab] = useState<MaterialSubTab>(initialSubTab?.tab ?? 'bom')
  const [bomRefine, setBomRefine] = useState<BomRefineData | null>(null)
  const [orders, setOrders] = useState<MaterialOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [converting, setConverting] = useState(false)
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false)
  const [priceDialogOpen, setPriceDialogOpen] = useState(false)
  const [selectedInventory, setSelectedInventory] = useState<Inventory | null>(null)
  const [inventories, setInventories] = useState<Inventory[]>([])
  // R182 — pečat svežine (družina R170) + fail-verbose agregacije: prej je
  // tihi izpad /api/suppliers pomenil PRAZEN seznam (lažno 'Ni dobaviteljev —
  // dodaj prvega') isti vzorec R162/R174; 403 = meja vloge (R175, tiho).
  const [materialOsvezitev, setMaterialOsvezitev] = useState<Date | null>(null)
  const [viriNapaka, setViriNapaka] = useState<string | null>(null)
  // R140: razprta postavka naročila (en hkrati — preglednost na telefonu).
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  // R207 — statusni filter (pill družina) + potrditveni dialog prejema
  // (družina R198): DOBLJENO je EDINI prehod z resnično stransko resnico
  // (receiveOrder res popravi zalogo, idempotentno) → potrditev PRED
  // dejanjem, postavke so vidne.
  const [statusFilter, setStatusFilter] = useState<'VSI' | 'OSNUTEK' | 'POSLANO' | 'POTRJENO' | 'DOBLJENO' | 'PREKlicANO'>('VSI')
  const [receiveDialogOrderId, setReceiveDialogOrderId] = useState<string | null>(null)
  const [receiveSending, setReceiveSending] = useState(false)
  // R208 — preklic naročila (končno stanje): potrditveni dialog (družina
  // R198/R207) + dvoklik zaščita (cancelSending) + fail-verbose.
  const [cancelDialogOrderId, setCancelDialogOrderId] = useState<string | null>(null)
  const [cancelSending, setCancelSending] = useState(false)
  // R209 — zgodovina prehodov: lenar odpiranje na kartico; vsako odpiranje
  // prinese SVEŽE dogodke (brez predpomnilnika — sled pravno pomembna,
  // zastarela bi lažala, R182 pečat semantika).
  const [zgodovinaOrderId, setZgodovinaOrderId] = useState<string | null>(null)
  const [zgodovina, setZgodovina] = useState<Record<string, ZgodovinaVnos[]>>({})
  const [zgodovinaNalaganje, setZgodovinaNalaganje] = useState(false)
  const [zgodovinaNapaka, setZgodovinaNapaka] = useState<string | null>(null)
  const { toast } = useToast()

  // Nov dobavitelj form
  const [newSupplier, setNewSupplier] = useState({ naziv: '', kontakt: '', email: '', telefon: '', dobavniRok: 7, popust: 0 })
  // Nova cena form
  const [newPrice, setNewPrice] = useState({ supplierId: '', cena: '', opomba: '' })

  // R207 — izpeljanke statusnega filtra (EN vir resnice, izpeljanka R201 vzorec):
  // števci iz REALNIH naročil; chipi samo za statuse, ki obstajajo.
  // R208 — PREKlicANO v filtru/chipih (preklicano naročilo mora ostati vidno).
  const statusStevci = (['OSNUTEK', 'POSLANO', 'POTRJENO', 'DOBLJENO', 'PREKlicANO'] as const)
    .map((s) => ({ status: s, n: orders.filter((o) => o.status === s).length }))
    .filter(({ n }) => n > 0)
  const vidnaNarocila = statusFilter === 'VSI' ? orders : orders.filter((o) => o.status === statusFilter)
  const receiveDialogOrder = orders.find((o) => o.id === receiveDialogOrderId) ?? null
  const cancelDialogOrder = orders.find((o) => o.id === cancelDialogOrderId) ?? null
  // R208 — F2: števec AKTIVNIH naročil (čakajo na dejanje: OSNUTEK/POSLANO/
  // POTRJENO; DOBLJENO/PREKlicANO so zaključena) — izpeljanka iz realnih
  // naročil (EN vir resnice, R207 vzorec), prikazana LE ko > 0 (brez lažnega 0
  // — naročila se naložijo ob prvem obisku zavihka, pečat pokaže svežino).
  const aktivnaNarocila = orders.filter(
    (o) => o.status === 'OSNUTEK' || o.status === 'POSLANO' || o.status === 'POTRJENO',
  ).length

  const loadData = useCallback(async () => {
    setLoading(true)
    // R182 — zbiranje NEUSPELIH virov (non-403; 403 = pravična meja R175)
    const neuspeliViri: string[] = []
    try {
      const [supRes, invRes] = await Promise.all([
        fetch('/api/suppliers'),
        fetch('/api/inventory'),
      ])
      if (supRes.ok) setSuppliers(await supRes.json())
      else if (supRes.status !== 403) neuspeliViri.push('dobavitelji')
      if (invRes.ok) setInventories(await invRes.json())
      else if (invRes.status !== 403) neuspeliViri.push('zaloga')

      if (projectId && tab === 'bom') {
        const bomRes = await fetch(`/api/bom-refine?projectId=${projectId}`)
        if (bomRes.ok) setBomRefine(await bomRes.json())
        else if (bomRes.status !== 403) neuspeliViri.push('BOM')
      }
      if (tab === 'orders') {
        const ordRes = await fetch('/api/material-orders')
        if (ordRes.ok) setOrders(await ordRes.json())
        else if (ordRes.status !== 403) neuspeliViri.push('naročila')
      }

      // R182 — pečat = zadnje USPEŠNO branje VSEH poskušanih virov
      // (vsaj EN non-403 neuspešen → BREZ pečata + viden warning)
      if (neuspeliViri.length > 0) {
        setViriNapaka(`Nekateri viri niso bilo naloženi (${neuspeliViri.join(', ')}) — prikaz je lahko nepopoln.`)
        setMaterialOsvezitev(null)
      } else {
        setViriNapaka(null)
        setMaterialOsvezitev(new Date())
      }
    } catch {
      // R182 — (prej tiho /* ignore */) omrežna napaka je VIDNA; podatki
      // ostanejo, a BREZ lažnega pečata
      setViriNapaka('Podatki niso bili osveženi (omrežje) — prikaz je lahko zastarel.')
      setMaterialOsvezitev(null)
    } finally {
      setLoading(false)
    }
  }, [projectId, tab])

  useEffect(() => {
    loadData()
  }, [loadData])

  // R182 — vrnitev v zavihek → ponovno naloži (pisarna spreminja cene, naročila
  // in dobavitelje v drugi seji). loadData je fail-verbose — hook ne požira napak.
  useRefetchOnFocus(loadData)

  // R213 — zvonček digest → direktno Naročila podzavihek (P1-h): page.tsx pošlje
  // namig { tab, n } prek roksal:navigate subTab; n se monotono poveča na vsak
  // namig, zato preklop deluje TUDI, ko je komponenta že montirana (enak tab
  // dvakrat = vseeno nov dogodek). Brez namiga (initialSubTab null — navadna
  // navigacija prek Več/FAB) se ročno izbrani podzavihek NE pregazi.
  const subTabNamig = initialSubTab?.tab
  const subTabNonce = initialSubTab?.n ?? 0
  useEffect(() => {
    if (subTabNamig) setTab(subTabNamig)
  }, [subTabNamig, subTabNonce])

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

  // R203 — fail-verbose (vzorec R140): 409/401/500 se POKAŽEJO z razlogom
  // iz odgovora — prej tiho: dialog ostane odprt brez razlage.
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
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        toast({ title: 'Ustvarjanje dobavitelja ni uspelo', description: data?.error?.trim() || `Napaka ${res.status}`, variant: 'destructive' })
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
      } else {
        // R203 — fail-verbose: npr. 400 (neveljavna cena) / 403 / 409 se vidijo.
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        toast({ title: 'Dodajanje cene ni uspelo', description: data?.error?.trim() || `Napaka ${res.status}`, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Napaka', variant: 'destructive' })
    }
  }

  const handleOrderStatus = async (orderId: string, status: string) => {
    if (status === 'DOBLJENO') setReceiveSending(true)
    // R208 — preklic: dvoklik zaščita (drugi PATCH bi bil 409 — prehod je
    // enkraten; vrata zaklenemo kot pri prejemu, dialog ostane odprt).
    if (status === 'PREKlicANO') setCancelSending(true)
    try {
      const res = await fetch('/api/material-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, status }),
      })
      if (res.ok) {
        // R206 — iskrni naslovi prehodov: aplikacija NE pošilja dokumentov
        // dobavitelju (integracije ni) — POSLANO je OZNAČBA človeškega dejanja
        // ('označi kot poslano'), ne obljuba aplikacije (družina R204/R205).
        // R207 — PATCH odgovor nosi alreadyReceived (idempotenten prejem,
        // src/lib/inventory.ts): konkurenca/dvojni klik NE sme lažno trditi
        // 'material v zalogi' (družina R204 — brez izmišljenih uspehov).
        const data = (await res.json().catch(() => null)) as
          | { alreadyReceived?: boolean }
          | null
        const naslovi: Record<string, string> = {
          POSLANO: 'Označeno kot poslano (status POSLANO)',
          POTRJENO: 'Status → POTRJENO',
          DOBLJENO: 'Dobljeno — material v zalogi',
          PREKlicANO: 'Označeno kot preklicano (status PREKlicANO)',
        }
        if (status === 'DOBLJENO' && data?.alreadyReceived) {
          toast({
            title: 'Naročilo je bilo že prejeto',
            description: 'Zaloga ni bila podvojena (idempotenten prejem).',
          })
        } else {
          toast({
            title: naslovi[status] ?? `Status → ${status}`,
            description:
              status === 'POSLANO'
                ? 'Aplikacija ne pošilja dokumentov — naročilnico dostaviš sam (gumb »Naročilnica« na naročilu).'
                : status === 'DOBLJENO'
                  ? 'Zaloga je posodobljena.'
                  : status === 'PREKlicANO'
                    ? 'Brez stranskih učinkov — zaloga ni spremenjena, dobavitelj ni obveščen (sporoči sam).'
                    : undefined,
          })
        }
        if (status === 'DOBLJENO') setReceiveDialogOrderId(null)
        if (status === 'PREKlicANO') setCancelDialogOrderId(null)
        loadData()
        // R209 — če je panel zgodovine tega naročila odprt, ga sveže pridobi
        // (nov prehod NI v predpomnjenem odzivu — panel ostane iskren).
        if (zgodovinaOrderId === orderId) void prinesiZgodovino(orderId)
      } else {
        // R140: fail-verbose — 403/409 napake se POKAŽEJO (prej tiho ugasil
        // gumb brez razlage; npr. MONTER ni videl zakaj "Dobljeno" ne dela).
        // R207 — dialog prejema OSTANE odprt: razlog je viden, Prekliči možen.
        const data = await res.json().catch(() => null)
        toast({ title: 'Napaka', description: data?.error ?? `HTTP ${res.status}`, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Omrežna napaka', variant: 'destructive' })
    } finally {
      if (status === 'DOBLJENO') setReceiveSending(false)
      if (status === 'PREKlicANO') setCancelSending(false)
    }
  }

  // R209 — zgodovina prehodov: prinese SVEŽE dogodke naročila (vedno nov
  // fetch — brez predpomnilnika). Fail-verbose: napaka viden razlog, ponoven
  // poskus = zapri/odpri ali nov prehod (panel se sam sveži).
  const prinesiZgodovino = async (orderId: string) => {
    setZgodovinaNalaganje(true)
    setZgodovinaNapaka(null)
    try {
      const res = await fetch(`/api/material-orders/history?orderId=${encodeURIComponent(orderId)}`)
      if (res.ok) {
        const data = (await res.json().catch(() => null)) as { dogodki?: ZgodovinaVnos[] } | null
        const dogodki = data?.dogodki
        setZgodovina((prej) => ({ ...prej, [orderId]: Array.isArray(dogodki) ? dogodki : [] }))
      } else {
        // R140 družina — 4xx/5xx se vidijo (prej tiho prazno bi lažalo).
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setZgodovinaNapaka(data?.error?.trim() || `Napaka ${res.status}`)
      }
    } catch {
      setZgodovinaNapaka('Omrežna napaka')
    } finally {
      setZgodovinaNalaganje(false)
    }
  }

  // R209 — toggle zgodovine na kartici (pravi aria-expanded preklopnik).
  const odpriZgodovino = (orderId: string) => {
    if (zgodovinaOrderId === orderId) {
      setZgodovinaOrderId(null)
      return
    }
    setZgodovinaOrderId(orderId)
    void prinesiZgodovino(orderId)
  }

  // R206 — naročilnica iz naročila: regeneracija dokumenta iz SLEDLJIVIH
  // postavk naročila (lib zaloga-povzetek — ista družina kot odložišče R204 /
  // CSV priloga R205; brez vrednosti iz UI). Fail-verbose odložišče (vzorec
  // R167/R203/R204/R205). Aplikacija trdi LE 'kopirana v odložišče'.
  const kopirajNarocilnicoIzNarocila = async (order: MaterialOrder) => {
    try {
      const besedilo = buildNarocilnicaIzNarocila(order, { now: new Date() })
      await navigator.clipboard.writeText(besedilo)
      toast({
        title: `Naročilnica (${order.supplier.naziv}) kopirana v odložišče`,
        description: `${order.items.length} ${narociloPostavkaBeseda(order.items.length)} — prilepi v e-pošto/SMS dobavitelju.`,
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        toast({ title: 'Brskalnik je zavrnil dostop do odložišča (dovoljenje).', variant: 'destructive' })
      } else if (err instanceof TypeError) {
        // fail-closed jedro: pokvareno naročilo → viden razlog (nič izmišljenega dokumenta)
        toast({ title: 'Naročilnice ni mogoče sestaviti iz tega naročila', description: err.message, variant: 'destructive' })
      } else {
        toast({ title: 'Kopiranje ni uspelo', variant: 'destructive' })
      }
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
        <Button type="button" variant={tab === 'bom' ? 'default' : 'ghost'} size="sm" aria-pressed={tab === 'bom'} onClick={() => setTab('bom')} className={tab === 'bom' ? 'bg-roksal-navy text-white' : ''}>
          <Sparkles className="h-3.5 w-3.5 mr-1" /> BOM Refine
        </Button>
        <Button type="button" variant={tab === 'orders' ? 'default' : 'ghost'} size="sm" aria-pressed={tab === 'orders'} onClick={() => setTab('orders')} className={tab === 'orders' ? 'bg-roksal-navy text-white' : ''}>
          <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Naročila
          {/* R208 — F2: števec aktivnih naročil (OSNUTEK/POSLANO/POTRJENO) na
              zavihku — opozorilo pred dejanjem; izpeljanka iz realnih naročil
              (R207 vzorec), viden LE ko > 0 (brez lažnega 0). */}
          {aktivnaNarocila > 0 && (
            <span
              className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-roksal-amber px-1 text-[9px] font-semibold leading-none text-roksal-ink tabular-nums"
              title="Naročila, ki čakajo na dejanje (OSNUTEK/POSLANO/POTRJENO) — iz zadnjega nalaganja"
            >
              {aktivnaNarocila}
            </span>
          )}
        </Button>
        <Button type="button" variant={tab === 'suppliers' ? 'default' : 'ghost'} size="sm" aria-pressed={tab === 'suppliers'} onClick={() => setTab('suppliers')} className={tab === 'suppliers' ? 'bg-roksal-navy text-white' : ''}>
          <Truck className="h-3.5 w-3.5 mr-1" /> Dobavitelji
        </Button>
      </div>

      {/* R182 — pečat svežine + fail-verbose agregacije (družina R170) */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
        <span>Dobavitelji, zaloge, naročila in BOM optimizacija.</span>
        {materialOsvezitev && (
          <span
            className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"
            title="Čas zadnje uspešne osvežitve podatkov"
          >
            <History className="h-3 w-3 shrink-0" aria-hidden="true" />
            Osveženo ob{' '}
            <span className="tabular-nums">{casOznaka(materialOsvezitev)}</span>
          </span>
        )}
      </div>
      {viriNapaka && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-roksal-red/30 bg-roksal-red/5 px-3 py-2 text-[11px] font-semibold text-roksal-red"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">{viriNapaka}</span>
          <button
            type="button"
            onClick={() => void loadData()}
            aria-label="Ponovno naloži materialno inteligenco"
            className="rounded px-1 py-0.5 font-bold transition-colors hover:text-roksal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-red/40"
          >
            Poskusi znova
          </button>
        </div>
      )}

      {/* BOM Refine tab */}
      {tab === 'bom' && (
        <div className="space-y-3">
          {!projectId ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Izberi projekt v Domov za BOM optimizacijo.</p>
            </CardContent></Card>
          ) : loading && !bomRefine ? (
            <Card><CardContent className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-roksal-amber" /></CardContent></Card>
          ) : !bomRefine && viriNapaka ? null : !bomRefine?.dealLocked ? (
            // R182 — BOM vir ni naložen (napaka vidna zgoraj) → brez lažnega
            // 'Deal ni zaklenjen' (R174: error panel je PREDNOST pred praznim stanjem)
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
                      <div key={opt.supplierId} className={`rounded-lg border p-2.5 transition-colors ${i === 0 ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/40' : 'border-border hover:border-roksal-navy/25 dark:hover:border-roksal-ink/25'}`}>
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
          {loading && orders.length === 0 ? (
            <Card><CardContent className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-roksal-amber" /></CardContent></Card>
          ) : orders.length === 0 ? (
            // R182 — naročila niso naložena (napaka zgoraj) → brez lažnega 'Ni naročil'
            viriNapaka ? null : (
              <Card><CardContent className="py-8 text-center text-muted-foreground">
                <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Ni naročil. Pretvori BOM draft v naročilo.</p>
              </CardContent></Card>
            )
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
              {/* R207 — statusni filter (pill družina R136/R204/R206): števci iz
                  realnih naročil; CSV ostaja VSA naročila (kontrakt R140
                  nespremenjen — brez prikrite vezave na filter). */}
              {statusStevci.length > 0 && (
                <div className="flex flex-wrap gap-1" role="group" aria-label="Filter naročil po statusu">
                  <button
                    type="button"
                    aria-pressed={statusFilter === 'VSI'}
                    onClick={() => setStatusFilter('VSI')}
                    className={chipCls(statusFilter === 'VSI')}
                  >
                    Vsi ({orders.length})
                  </button>
                  {statusStevci.map(({ status, n }) => (
                    <button
                      key={status}
                      type="button"
                      aria-pressed={statusFilter === status}
                      onClick={() => setStatusFilter(status)}
                      className={chipCls(statusFilter === status)}
                    >
                      {status} ({n})
                    </button>
                  ))}
                </div>
              )}
              {vidnaNarocila.length === 0 && statusFilter !== 'VSI' ? (
                // R202 družina — prazno ZARADI filtra ≠ res prazno: iskren razlog
                // + izhod (brez lažnega 'Ni naročil', ki bi lagal o bazi).
                <Card><CardContent className="py-8 text-center text-muted-foreground">
                  <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Ni naročil s statusom {statusFilter}.</p>
                  <p className="mt-1 text-xs">Izberi drug status ali prikaži Vse.</p>
                  {/* R213 — besedilni izhod je dobil DEJANSKI gumb: EN klik
                      nazaj na Vsi (družina CSV/Poskusi znova focus ringov). */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setStatusFilter('VSI')}
                    className="mt-3 h-8 text-xs focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1"
                  >
                    Prikaži Vse
                  </Button>
                </CardContent></Card>
              ) : vidnaNarocila.map((order) => {
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
                              order.status === 'PREKlicANO' ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800' :
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
                      {/* Status actions — R206: iskren gumb prehoda POSLANO
                          (aplikacija NE pošilja dokumentov; uporabnik OZNAČI,
                          da jih je poslal sam — družina R204/R205) + gumb
                          'Naročilnica' (regeneracija dokumenta iz postavk). */}
                      <div className="flex flex-wrap gap-1 pt-2 border-t border-border">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 gap-1 text-[10px] focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1"
                          onClick={() => void kopirajNarocilnicoIzNarocila(order)}
                          aria-label={`Kopiraj naročilnico naročila pri ${order.supplier.naziv} v odložišče`}
                          title="Naročilnica za dobavitelja iz postavk tega naročila — prilepi v e-pošto/SMS"
                        >
                          <ClipboardList className="h-3 w-3" aria-hidden="true" />
                          Naročilnica
                        </Button>
                        {/* R209 — zgodovina prehodov: pravi aria-expanded
                            preklopnik; odpiranje vedno prinese sveže dogodke
                            (brez predpomnilnika — sled pravno pomembna). */}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          aria-expanded={zgodovinaOrderId === order.id}
                          className="h-6 gap-1 text-[10px] focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1"
                          onClick={() => odpriZgodovino(order.id)}
                          aria-label={`Zgodovina prehodov naročila pri ${order.supplier.naziv}`}
                          title="Sled prehodov statusa (kdo, kdaj) — sveže pridobljena ob vsakem odpiranju"
                        >
                          <History className="h-3 w-3" aria-hidden="true" />
                          Zgodovina
                        </Button>
                        {order.status === 'OSNUTEK' && (
                          <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1" onClick={() => handleOrderStatus(order.id, 'POSLANO')} title="Označi, da si naročilo poslal sam (aplikacija ne pošilja dokumentov)">
                            Označi kot poslano
                          </Button>
                        )}
                        {order.status === 'POSLANO' && (
                          <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1" onClick={() => handleOrderStatus(order.id, 'POTRJENO')}>
                            Potrdi
                          </Button>
                        )}
                        {order.status === 'POTRJENO' && (
                          <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] bg-green-50 dark:bg-green-950/40 focus-visible:ring-2 focus-visible:ring-green-600/40 focus-visible:ring-offset-1" onClick={() => setReceiveDialogOrderId(order.id)} title="Prejem v zalogo — potrditev s prikazom postavk">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Dobljeno (v zalogo)
                          </Button>
                        )}
                        {/* R208 — preklic (končno stanje, brez stranskih učinkov):
                            potrditveni dialog (družina R198/R207) — odpre se,
                            PATCH gre šele prek 'Potrdi preklic'. */}
                        {(order.status === 'OSNUTEK' || order.status === 'POSLANO' || order.status === 'POTRJENO') && (
                          <Button type="button" size="sm" variant="outline" className="h-6 gap-1 text-[10px] focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1" onClick={() => setCancelDialogOrderId(order.id)} title="Preklic naročila — KONČNO stanje, ni razveljavljivo (dobavitelja obvestiš sam)">
                            <XCircle className="h-3 w-3" aria-hidden="true" />
                            Prekliči
                          </Button>
                        )}
                      </div>
                      {/* R209 — zgodovina prehodov (timeline): nalaganje /
                          fail-verbose napaka / iskreno prazno (starejši zapisi
                          brez orderId jih NE izmišljujemo) / dogodki z
                          statusno značko (ista barvna družina kot kartica). */}
                      {zgodovinaOrderId === order.id && (
                        <div
                          role="region"
                          aria-label={`Zgodovina prehodov naročila pri ${order.supplier.naziv}`}
                          className="mt-2 border-t border-border pt-2"
                        >
                          {zgodovinaNalaganje ? (
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                              Nalaganje zgodovine …
                            </div>
                          ) : zgodovinaNapaka ? (
                            <div role="alert" className="text-[11px] text-red-700 dark:text-red-300">
                              Zgodovine ni mogoče prikazati: {zgodovinaNapaka}
                            </div>
                          ) : (zgodovina[order.id]?.length ?? 0) === 0 ? (
                            <div className="text-[11px] text-muted-foreground">
                              <p>Še ni zapisanih prehodov za to naročilo.</p>
                              <p className="mt-0.5 text-[10px]">
                                Sledenje prehodov beleži dogodke od uvedbe — starejši zapisi nimajo povezave na naročilo in jih ne izmišljujemo.
                              </p>
                            </div>
                          ) : (
                            <ol className="space-y-1.5">
                              {zgodovina[order.id].map((d) => (
                                <li
                                  key={d.id}
                                  className="flex items-start justify-between gap-2 rounded border border-border/60 bg-muted/40 px-2 py-1"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1">
                                      <span className="text-[11px] font-medium text-roksal-ink">{akcijaOznaka(d.akcija)}</span>
                                      {d.statusPotem && (
                                        <Badge variant="outline" className={`text-[8px] ${statusZnackaCls(d.statusPotem)}`}>
                                          {d.statusPotem}
                                        </Badge>
                                      )}
                                      {d.statusPrej && d.statusPotem && (
                                        <span className="text-[9px] text-muted-foreground tabular-nums">iz {d.statusPrej}</span>
                                      )}
                                    </div>
                                    <div className="text-[9px] text-muted-foreground tabular-nums">
                                      {/* R209 + r182 EN VIR: čas dogodka prek
                                          casOznaka (ne lokalni formatter). */}
                                      {fmtDate(d.timestamp)} ob {casOznaka(new Date(d.timestamp))}
                                      {d.uporabnik && ` · ${d.uporabnik.ime || d.uporabnik.email}`}
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                      )}
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
          {loading && suppliers.length === 0 ? (
            <Card><CardContent className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-roksal-amber" /></CardContent></Card>
          ) : suppliers.length === 0 ? (
            // R182 — dobavitelji niso naloženi (napaka zgoraj) → brez lažnega 'Ni dobaviteljev'
            viriNapaka ? null : (
              <Card><CardContent className="py-8 text-center text-muted-foreground">
                <Truck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Ni dobaviteljev. Dodaj prvega.</p>
              </CardContent></Card>
            )
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

      {/* R207 — potrditveni dialog prejema (družina R198, password-dialog
          vzorec): DOBLJENO je edini prehod, ki RES popravi zalogo (receiveOrder,
          idempotentno — atomic guard NOT status DOBLJENO) → postavke so vidne
          PRED potrditvijo; Prekliči NE pošlje nič; fail-verbose: napaka
          pusti dialog odprt (razlog viden). */}
      <Dialog
        open={receiveDialogOrderId !== null}
        onOpenChange={(o) => {
          if (!receiveSending && !o) setReceiveDialogOrderId(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-roksal-ink">
              <Package className="h-4 w-4 text-roksal-amber" aria-hidden="true" />
              Prejem materiala v zalogo
            </DialogTitle>
            <DialogDescription>
              {receiveDialogOrder
                ? `Naročilo pri ${receiveDialogOrder.supplier.naziv} bo označeno kot DOBLJENO.`
                : 'Naročilo bo označeno kot DOBLJENO.'}
            </DialogDescription>
            <div className="flex items-start gap-2 rounded-lg bg-roksal-amber/10 px-3 py-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-roksal-amber" aria-hidden="true" />
              <p className="text-[11px] font-medium leading-snug text-stone-700 dark:text-stone-300">
                Zaloga se bo povečala za prikazane količine. Prejem je idempotenten — če je bilo naročilo že prejeto, se zaloga ne podvoji.
              </p>
            </div>
          </DialogHeader>
          {receiveDialogOrder && (
            <div className="max-h-40 space-y-1 overflow-y-auto scrollbar-thin" aria-label="Postavke za prejem v zalogo">
              {receiveDialogOrder.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded border border-border/60 bg-muted/40 px-2 py-1">
                  <span className="min-w-0 flex-1 truncate text-[11px] text-roksal-ink">{item.naziv}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                    {item.kolicina} {item.enota}
                  </span>
                </div>
              ))}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReceiveDialogOrderId(null)}
              disabled={receiveSending}
              className="focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1"
            >
              Prekliči
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={receiveSending || !receiveDialogOrder}
              onClick={() => {
                if (receiveDialogOrder) void handleOrderStatus(receiveDialogOrder.id, 'DOBLJENO')
              }}
              className="bg-roksal-navy text-white focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1"
            >
              {receiveSending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" />
              )}
              Potrdi prejem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* R208 — potrditveni dialog preklica (družina R198/R207): PREKlicANO je
          KONČNO stanje (ORDER_TRANSITIONS: brez izhodnih prehodov) brez
          stranskih učinkov (zaloga NI spremenjena, dobavitelj NI obveščen —
          sporočiš sam). Prekliči (dialog) NE pošlje nič; fail-verbose: napaka
          pusti dialog odprt (razlog viden); dvoklik zaščita prek cancelSending. */}
      <Dialog
        open={cancelDialogOrderId !== null}
        onOpenChange={(o) => {
          if (!cancelSending && !o) setCancelDialogOrderId(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-roksal-ink">
              <XCircle className="h-4 w-4 text-roksal-red" aria-hidden="true" />
              Preklic naročila
            </DialogTitle>
            <DialogDescription>
              {cancelDialogOrder
                ? `Naročilo pri ${cancelDialogOrder.supplier.naziv} bo označeno kot PREKlicANO.`
                : 'Naročilo bo označeno kot PREKlicANO.'}
            </DialogDescription>
            <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 dark:bg-red-950/40">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-roksal-red" aria-hidden="true" />
              <p className="text-[11px] font-medium leading-snug text-stone-700 dark:text-stone-300">
                Preklic je končno stanje — nazaj v OSNUTEK, POSLANO ali POTRJENO ni mogoče. Aplikacija ne obvesti dobavitelja — preklic sporoči sam (telefon/e-pošta).
              </p>
            </div>
          </DialogHeader>
          {cancelDialogOrder && (
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {cancelDialogOrder.items.length} artiklov · {cancelDialogOrder.skupajCena.toFixed(0)} € — brez stranskih učinkov (zaloga ostane nespremenjena).
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCancelDialogOrderId(null)}
              disabled={cancelSending}
              className="focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1"
            >
              Prekliči
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={cancelSending || !cancelDialogOrder}
              onClick={() => {
                if (cancelDialogOrder) void handleOrderStatus(cancelDialogOrder.id, 'PREKlicANO')
              }}
              className="focus-visible:ring-2 focus-visible:ring-red-600/40 focus-visible:ring-offset-1"
            >
              {cancelSending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <XCircle className="mr-1 h-3 w-3" aria-hidden="true" />
              )}
              Potrdi preklic
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
