'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { CenaZgodovinaPanel } from '@/components/roksal/cena-zgodovina-panel'
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
  PackageX,
  AlertTriangle,
  Filter,
  TrendingDown,
  Archive,
  Plus,
  Loader2,
  ShoppingCart,
  Euro,
  Download,
  FileText,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileDown,
  FileSpreadsheet,
  History,
} from 'lucide-react'
import { toast } from 'sonner'
import { downloadCsv, downloadCsvText, todayStamp } from '@/lib/csv-export'
// R234 (P1-c) — Stanje zaloge PDF izvoz ('izvozi' družina PDF dimenzija —
// boss-report vzorec; ENA resnica s CSV R136/R226).
import { generateZalogaPdf } from '@/lib/zaloga-pdf'
// R270 (P1-f) — inventurni pregled premoženja PDF (26. člen 'izvozi'
// družine — druga rezina ISTEGA vira: premoženje, ne pokritost R262).
import {
  inventuraPregled,
  artikelBeseda,
  generateInventuraPregledPdf,
  type InventuraArtikel,
} from '@/lib/inventura-pregled-pdf'
// R286 (P1-f) — inventurni pregled premoženja CSV (30. člen 'izvozi'
// družine — ISTA resnica kot R270 PDF, drug medij: Excel/računovodski
// uvoz; EN VIR inventuraPregled — pariteta po konstrukciji, F1/F2).
import {
  inventuraPregledCsv,
  inventuraPregledCsvFilename,
} from '@/lib/inventura-pregled-csv'
// R273 — 29. člen 'izvozi' družine: pregled vrednosti zaloge PDF (glava =
// lib resnica; dve okni ENA matemtika — mini state + FRESH export prek
// ISTEGA liba).
import {
  zalogaVrednostPregled,
  generateZalogaVrednostPdf,
  type ZalogaVrednostArtikel,
  type ZalogaVrednostBest,
} from '@/lib/zaloga-vrednost-pdf'
// R270 — EN VIR formata količin (IMPORT, NI zasegane kopije — R262 → R270).
import { kolicinaNiz } from '@/lib/zaloga-osnutek-pdf'
// R237 (P1-c) — NAROČILNICA OSNUTEK PDF (pravi PDF brat CSV priloge R205 —
// isti vir artiklov + narociloKolicina ENA formula, fail-closed delegacija,
// bajtni determinizem; INTERNI dokument za potrditev osnutka).
import {
  buildOsnutekPdfDoc,
  osnutekPdfFilename,
} from '@/lib/osnutek-pdf'
import { casOznaka } from '@/lib/osvezitev-fokus'
import {
  buildZalogaPovzetek,
  narocilnicaCsvVrstice,
  narociloKolicina,
  zalogaPovzetekBeseda,
  type ZalogaArtikelZaNarocilo,
} from '@/lib/zaloga-povzetek'
// R219 — tip filtra 'pod minimumom' (EN VIR lib inventory-filter — samo TIP;
// whitelist guard je del page.tsx centralNavigate, ne komponente).
import type { InventoryFilterNamig } from '@/lib/inventory-filter'
// R225 — OSMI signalec konvergence: badge 'Brez dobavitelja' na vrstici
// Zaloge (definicija TOČNO ENKRAT — badge-brez-dobavitelja.tsx R222, ISTA
// komponenta kot paleta ⌘K + zvonček; en vizual en pomen).
import { BadgeBrezDobavitelja } from './badge-brez-dobavitelja'

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
  _count?: { usages: number; movements: number; prices?: number }
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

// R216 — props za deep-link hint (P1-d/e): paleta ⌘K 'Nizka zaloga' in
// zvonček 'stock' klik pošljeta artikel prek page.tsx centralNavigate
// (roksal:navigate osnutek polje); InventoryTab ga ob mountu/novem hintu
// odpre kot Osnutek dialog z TOČNO TIM artikelom. EN VIR passthrough —
// brez ponovnega filtra (WYSIWYG, R215 vzorec), brez izmišljenih artiklov.
export interface InventoryTabProps {
  /** Deep-link hint iz page.tsx (monotonski n — R213 družina). */
  osnutekHint?: { artikel: ZalogaArtikelZaNarocilo; n: number } | null
  /** R219 (P1-f) — filter hint 'pod minimumom' (paleta ⌘K 'Vse' vrstica →
   * Zaloga z AKTIVNIM čipom; ISTI protokol monotonskega n kot osnutekHint). */
  filterHint?: InventoryFilterNamig | null
}

export function InventoryTab({ osnutekHint, filterHint }: InventoryTabProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<InventoryType>('ALL')
  // R219 (P1-f) — čip 'pod minimumom': drugostopenjski filter, ki se ZLOŽI
  // z obstoječim filtrom tipa (vidno = tip AND pod-minimum). Priženjen LE
  // prek namiga (paleta 'Vse') ali ročno (klik na čip); ugasi ga uporabnik
  // (klik) — stale namig nikoli ne preseneti (effect samo PRIŽIGA, ne
  // ugaša — R216 vzorec: hint je namig, ne lastništvo nad stanjem).
  const [podMinOnly, setPodMinOnly] = useState(false)
  // R220 — čip 'na minimumu' (zaloga === minimum): ožji sorojeni pogled
  // ISTEGA vprašanja (=== je podmnožica <= — artikli TOČNO na tleh; naslednja
  // poraba jih spusti pod). MEDSEBOJNO IZKLJUČEN s 'pod minimumom': dva
  // sorojena pogleda, ne dveh neodvisnih stikal — vsak čipov števec pove
  // TOČNO kar prikaže (iskren števec R219 brez intersekcijske zmede),
  // deep-link iz palete obljubi TOČNO ta pogled. Whitelist vrednost:
  // 'na-minimumu' (EN VIR lib inventory-filter).
  const [naMinOnly, setNaMinOnly] = useState(false)
  // R221 (P1-f) — čip 'brez dobavitelja' (TRETJI whitelist vnos 'brez-
  // dobavitelja' — EN VIR lib inventory-filter; DRUGA dimenzija: nabavna
  // pripravljenost, NE nizka zaloga). Artikel je 'brez dobavitelja', ko mu
  // NIKDO ni vpisan kot vir cene (MaterialPrice števec === 0) — naročilni
  // tok potem ne more ceniti postavke (osnutek bi nesel ceno 0). Isti
  // medsebojno-izključni vzorec kot sorojenca: klik poniža oba sorojena
  // čipa — vsak čipov iskren števec pove TOČNO kar prikaže.
  const [brezDobaviteljaOnly, setBrezDobaviteljaOnly] = useState(false)

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
  // R270 — dvoklik/ponovni klik guard za FRESH fetch inventurnega pregleda
  // (družinski kontrakt R264–R269: disabled={pdfVteku} + guard v handlerju).
  const [invPdfVteku, setInvPdfVteku] = useState(false)
  // R286 (30. člen) — dvoklik guard CSV izvoza (pariteta invPdfVteku).
  const [invCsvVteku, setInvCsvVteku] = useState(false)
  // R273 — dvoklik/ponovni klik guard za FRESH fetch vrednostnega pregleda
  // (družinski kontrakt R264–R272: disabled={valPdfVteku} + guard v handlerju).
  const [valPdfVteku, setValPdfVteku] = useState(false)
  // R273 — best cene (API bestPerMaterial — SAMO trenutno veljavne, API
  // resnica veljavnostDo null) za mini-vrstico ENA matemtika: null = cena-vir
  // še ni naložen ALI je pokvaren — mini pokaže ISKRENO odsotnost (NIKOLI
  // lažnega Σ/pretečenega žiga brez dokazanega cen-vira).
  const [bestCene, setBestCene] = useState<ZalogaVrednostBest[] | null>(null)
  // R177 — pečat 'Osveženo ob' = čas zadnjega USPEŠNEGA branja zaloge (primarni
  // vir te površine, vzorec R170/R171). Napaka/omrežje → null (pečat brez
  // podatkov bi lažno trdil svežino).
  const [zalogaOsvezitev, setZalogaOsvezitev] = useState<Date | null>(null)
  // R205 — osnutek naročila: naročilnica vidnih artiklov pod minimumom se
  // shrani kot SLEDLJIV MaterialOrder (status OSNUTEK) — dobavitelja izbere
  // uporabnik (nič izmišljenega), aplikacija trdi LE 'shranjen osnutek',
  // NIKOLI 'poslano'. Dobavitelje nalagamo ob odpiranju (R182 fail-verbose
  // trojna veja: napaka/iskreno prazno/seznam).
  const [osnutekOpen, setOsnutekOpen] = useState(false)
  const [osnutekArtikli, setOsnutekArtikli] = useState<ZalogaArtikelZaNarocilo[]>([])
  const [dobavitelji, setDobavitelji] = useState<Array<{ id: string; naziv: string }>>([])
  const [dobaviteljiStanje, setDobaviteljiStanje] = useState<'prazno' | 'nalagam' | 'napaka' | 'ok'>('prazno')
  const [dobaviteljiNapaka, setDobaviteljiNapaka] = useState<string | null>(null)
  const [osnutekDobavitelj, setOsnutekDobavitelj] = useState('')
  const [osnutekOpombe, setOsnutekOpombe] = useState('')
  const [osnutekSubmitting, setOsnutekSubmitting] = useState(false)

  // R175 — stabilen fail-verbose loader (EN VIR napak, žičen tudi na
  // useRefetchOnFocus): zaloga (R152 že fail-verbose) + projekti (prej TIHA
  // veja `if (projRes.ok)` brez else — dropdown premikov bi ostal prazen brez
  // signala; zdaj viden toast + čiščenje starega stanja).
  const loadAll = useCallback(async () => {
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
        setZalogaOsvezitev(new Date())
      } else {
        setInventory([])
        setInvError(`Zaloge ni bilo mogoče naložiti (napaka ${invRes.status}).`)
        toast.error(`Zaloge ni bilo mogoče naložiti (napaka ${invRes.status})`)
        setZalogaOsvezitev(null)
      }
      if (projRes.ok) {
        const projData = await projRes.json()
        setProjects(projData)
      } else {
        setProjects([])
        toast.error(`Seznam projektov ni bil naložen (napaka ${projRes.status}).`)
      }
    } catch {
      setInventory([])
      setProjects([])
      setInvError('Zaloge ni bilo mogoče naložiti — preverite povezavo.')
      toast.error('Zaloge ni bilo mogoče naložiti — preverite povezavo.')
      setZalogaOsvezitev(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  // R175 (iz R174 kandidatov) — vrnitev v zavihek/okno → ponovno naloži zalogo
  // (skladišče/pisarna beleži premike v drugi seji; pregled razpoložljivosti
  // ostane zastarel do remonta). loadAll je fail-verbose — hook ne požira napak.
  useRefetchOnFocus(loadAll)

  // R175: fetchInventory izbrisana — EN VIR RESNICE je loadAll (žičen tudi na
  // refetch-on-focus); premik artikla osveži ZALOGO + PROJEKTE z enim klicem.

  // R205 — naloziDobavitelje: fail-verbose trojna veja (vzorec R182 material-
  // intelligence): napaka → role=alert + Poskusi znova; iskreno prazno →
  // 'Ni dobaviteljev' (brez lažnega seznama); seznam → Select. 403 ne more
  // nastopati (GET /api/suppliers = vsaka prijavljena seja).
  const naloziDobavitelje = useCallback(async () => {
    setDobaviteljiStanje('nalagam')
    setDobaviteljiNapaka(null)
    try {
      const res = await fetch('/api/suppliers')
      if (!res.ok) {
        setDobavitelji([])
        setDobaviteljiNapaka(`Dobavitelje ni bilo mogoče naložiti (napaka ${res.status}).`)
        setDobaviteljiStanje('napaka')
        return
      }
      const data = (await res.json()) as Array<{ id: string; naziv: string }>
      setDobavitelji(data)
      setDobaviteljiStanje('ok')
    } catch {
      setDobavitelji([])
      setDobaviteljiNapaka('Dobavitelje ni bilo mogoče naložiti — preverite povezavo.')
      setDobaviteljiStanje('napaka')
    }
  }, [])

  useEffect(() => {
    if (osnutekOpen) void naloziDobavitelje()
  }, [osnutekOpen, naloziDobavitelje])

  // R243 — wave 5 RBAC ogledalo (TOČNO R239/R241/R242 vzorec): pravice prebere z
  // GET /api/auth (R135 EN VIR RESNICE; fetch on mount z alive guardom,
  // napaka → []) in skrije akcije, ki bi končale s 403. API matrika (TOČNO
  // iz route datotek): POST /api/inventory s tipPremika → inventory.write
  // (§10/R135 — 'Premike zaloge beležita vodstvo ali skladišče'); POST
  // /api/material-orders (osnutek) → procurement.create.
  const [myPermissions, setMyPermissions] = useState<readonly string[] | null>(null)
  useEffect(() => {
    let alive = true
    fetch('/api/auth')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data?.permissions) setMyPermissions(data.permissions as readonly string[])
        else if (alive) setMyPermissions([])
      })
      .catch(() => {
        if (alive) setMyPermissions([])
      })
    return () => {
      alive = false
    }
  }, [])
  // Fail-closed izpeljava (R242 vzorec — izrecno na false, NIKOLI tiha
  // inflacija pravic): med nalaganjem (null) in ob napaki sta VSE pisalni
  // akciji skriti — least privilege, nikoli lažni gumb, ki bi končal s 403.
  const lahkoZapisujePremike = myPermissions?.includes('inventory.write') ?? false
  const lahkoUstvariNarocila = myPermissions?.includes('procurement.create') ?? false

  async function handleMovement() {
    // R243 — obrambni AND (R242 vzorec: vrata v vratah): gumb je skrit, ta
    // AND je druga plast (naključni klic ne zažene upehanske toke).
    if (!lahkoZapisujePremike) return
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
        await loadAll()
      } else {
        // R204 — fail-verbose z razlogom iz odgovora (vzorec R140/R163/R203):
        // 409/400/500 pokažejo SVET razlog, ne generične sporočilo brez konteksta.
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        toast.error(data?.error?.trim() || `Napaka pri zapisovanju premika (${res.status})`)
      }
    } catch {
      toast.error('Napaka pri povezavi s strežnikom')
    } finally {
      setSubmitting(false)
    }
  }

  // R204 — naročilnica = PRAVI izhod namesto izmišljenega toasta. Prej je
  // 'Naroči' pokazal LAŽNI uspeh (obljuba o pošiljanju dobavitelju, ki se
  // NI zgodila — integracije ni). Zdaj: besedilo naročilnice (šifra/naziv/enota/zaloga/
  // min. + EN VIR priporočena količina po isti formuli kot prej, lib
  // zaloga-povzetek) v odložišče — uporabnik jo SAM prilepi v e-pošto/SMS/
  // WhatsApp. Aplikacija trdi LE 'kopirana v odložišče'. Fail-verbose
  // odložišče (vzorec kopiraj termina R167 / povzetka meritev R203).
  const kopirajNarocilnico = useCallback(
    async (artikli: readonly ZalogaArtikelZaNarocilo[], opis: string) => {
      if (artikli.length === 0) {
        toast.error('Ni artiklov pod minimalno zalogo — nič za naročilo.')
        return
      }
      try {
        const besedilo = buildZalogaPovzetek(artikli, {
          now: new Date(),
          // Kategorija LE, če je dejansko aktiven filter (brez izmišljenega
          // konteksta; 'Vse' → brez omembe).
          kategorija: filter === 'ALL' ? null : (typeLabels[filter] ?? filter),
        })
        await navigator.clipboard.writeText(besedilo)
        // R215 — deep-link akcija v toastu (družina R214 'Odpri naročila'):
        // kopiranje za e-pošto/SMS NE ustvari sledi — akcija 'Shrani kot
        // osnutek' ponudi ista posta kot sledljiv MaterialOrder OSNUTEK
        // (R205 dialog, TOČNO isti artikli — WYSIWYG).
        toast.success(`Naročilnica (${opis}) kopirana v odložišče`, {
          description: `${artikli.length} ${zalogaPovzetekBeseda(artikli.length)} — prilepi v e-pošto/SMS dobavitelju.`,
          action: {
            label: 'Shrani kot osnutek',
            onClick: () => openOsnutekDialog(artikli),
          },
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
    },
    [filter],
  )

  function handleReorder(item: InventoryItem) {
    void kopirajNarocilnico([item], item.naziv)
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
      ['Šifra', 'Naziv', 'Tip', 'Enota', 'Zaloga', 'Min. zaloga', 'Nizka', 'Brez dobavitelja'],
      filtered.map((item) => [
        item.sifraMateriala,
        item.naziv,
        typeLabels[item.tip] || item.tip,
        item.enota,
        item.kolicinaZaloga,
        item.minimalnaZaloga,
        item.kolicinaZaloga <= item.minimalnaZaloga ? 'DA' : 'NE',
        // R226 (P1-c) — deveti signalec konvergence: stolpec 'Brez
        // dobavitelja' (DA/NE) — arhivska resnica v polnem izvozu (analogija
        // R224 vodja CSV vrstici; WYSIWYG: stolpec VEDNO prisoten, vrednost
        // iz dobesedne === 0 — ISTA strogost kot čip R221 / zvonček R222 /
        // Domov R223 / vodja R224 / vrstica R225; manjkajoči števec NIKOLI
        // ni 'DA' — fail-closed, brez ?? 0 / <= 0).
        item._count?.prices === 0 ? 'DA' : 'NE',
      ]),
    )
    toast.success(`Izvoženih ${filtered.length} artiklov v CSV.`)
  }

  /** R234 (P1-c 'izvozi' družina — PDF dimenzija) — Stanje zaloge PDF izvoz
   *  vidnih artiklov (upošteva filter — ISTO množico kot CSV R136; boss-report
   *  vzorec). Fail-closed: 0 vidnih → iskren toast (NI prazne datoteke —
   *  R232/R233 družina); pokvarena generacija → fail-verbose toast (NIČ
   *  tihe degradacije). */
  function exportZalogaPdf() {
    if (filtered.length === 0) {
      toast.error('Ni artiklov za izvoz.')
      return
    }
    try {
      generateZalogaPdf(
        filtered.map((item) => ({
          sifraMateriala: item.sifraMateriala,
          naziv: item.naziv,
          // ISTA preslikava tipa kot CSV R136 (WYSIWYG — tip label).
          tip: typeLabels[item.tip] || item.tip,
          enota: item.enota,
          kolicinaZaloga: item.kolicinaZaloga,
          minimalnaZaloga: item.minimalnaZaloga,
          _count: item._count,
        })),
        {
          now: new Date(),
          // R227 pravilo: kontekst LE če dejansko aktiven ('Vse' → brez omembe).
          kategorija: filter === 'ALL' ? null : (filterTabs.find((f) => f.id === filter)?.label ?? null),
          cip: podMinOnly ? 'pod' : naMinOnly ? 'na' : brezDobaviteljaOnly ? 'brez' : null,
        },
      )
      toast.success(`Izvoženih ${filtered.length} artiklov v PDF.`)
    } catch (err) {
      toast.error(`Izvoz PDF ni uspel: ${err instanceof Error ? err.message : 'neznana napaka'}`)
    }
  }

  /** R286 — DTO preslikava EN VIR na UI nivoju: odgovor /api/inventory →
   *  InventuraArtikel[] (fail-verbose — R227 strogost: manjkajoč/pokvaren
   *  premik NIČ tiho '0'; tip = ISTA preslikava typeLabels kot CSV R136 /
   *  PDF R234 — WYSIWYG; neznana koda verbatim — iskren fallback).
   *  Uporablja jo PDF (R270) IN CSV (R286, 30. člen) izvoz — dva medija,
   *  ENA preslikava vira (F1 EN VIR na komponentnem nivoju). */
  const mapInventoryOdgovor = (data: unknown): InventuraArtikel[] => {
    if (!Array.isArray(data)) {
      throw new TypeError('Odgovora /api/inventory ni mogoče prebrati (ni polja).')
    }
    const vrstice = data as Array<Record<string, unknown>>
    return vrstice.map((item, i) => {
      if (typeof item.id !== 'string' || item.id === '') {
        throw new TypeError(`artikel vrstica ${i}: manjkajoč id v odgovoru API-ja`)
      }
      for (const [ime, v] of [
        ['sifraMateriala', item.sifraMateriala],
        ['naziv', item.naziv],
        ['tip', item.tip],
        ['enota', item.enota],
      ] as const) {
        if (typeof v !== 'string' || v.trim() === '') {
          throw new TypeError(`artikel vrstica ${i} (${item.id}): ${ime} mora biti ne-prazen niz, ne ${String(v)}`)
        }
      }
      for (const [ime, v] of [
        ['kolicinaZaloga', item.kolicinaZaloga],
        ['minimalnaZaloga', item.minimalnaZaloga],
      ] as const) {
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
          throw new TypeError(`artikel vrstica ${i} (${item.id}): ${ime} mora biti končno ne-negativno število, ne ${String(v)}`)
        }
      }
      // Fail-verbose DTO pruning (R269 vzorec): števec premikov je del
      // vira — manjkajoč/pokvaren NIČ tiho ni '0' (R227 strogost).
      const cnt = item._count as { movements?: unknown } | undefined
      if (!cnt || typeof cnt.movements !== 'number' || !Number.isInteger(cnt.movements) || cnt.movements < 0) {
        throw new TypeError(`artikel vrstica ${i} (${item.id}): premiki (_count.movements) morajo biti ne-negativno celo število, ne ${String(cnt?.movements)}`)
      }
      return {
        id: item.id as string,
        sifraMateriala: item.sifraMateriala as string,
        naziv: item.naziv as string,
        tip: typeLabels[item.tip as string] || (item.tip as string),
        enota: item.enota as string,
        kolicinaZaloga: item.kolicinaZaloga as number,
        minimalnaZaloga: item.minimalnaZaloga as number,
        premiki: cnt.movements,
      }
    })
  }

  /** R270 (P1-f 'izvozi' družina — 26. člen) — INVENTURA — PREMOŽENJSKI
   *  PREGLED PDF: FRESH GET /api/inventory ob kliku — polna resnica VSEH
   *  premoženj (R234 PDF je namenoma viden seznam po filtrih; R270 je druga
   *  vrata: premoženje, ne pokritost R262). Fail-closed: prazen vir → iskren
   *  toast (NI prazne datoteke); pokvaren vir → fail-verbose toast (NIČ
   *  tihe degradacije). ENA izpeljava inventuraPregled = toast = PDF
   *  (WYSIWYG). */
  const handleInventuraPdf = async () => {
    if (invPdfVteku) return
    setInvPdfVteku(true)
    try {
      const res = await fetch('/api/inventory', { credentials: 'same-origin' })
      if (!res.ok) {
        throw new Error(`GET /api/inventory → HTTP ${res.status}`)
      }
      const data: unknown = await res.json()
      const vnosi = mapInventoryOdgovor(data)
      if (vnosi.length === 0) {
        // Fail-closed jedro: prazen seznam ne nastaja dokumenta — iskren toast.
        toast.error('Ni vpisanih artiklov', {
          description: 'Inventurni pregled se izvozi, ko je vpisan prvi artikel zaloge.',
        })
        return
      }
      // ENA izpeljava: povzetek za toast = ISTA resnica kot KPI IN sklep na
      // listu (WYSIWYG).
      const { povzetek } = inventuraPregled(vnosi)
      generateInventuraPregledPdf(vnosi, { now: new Date() })
      toast.success('Inventurni pregled premoženja prenešen v PDF', {
        description: `Inventura-pregled-…pdf — ${artikelBeseda(povzetek.artiklov)}, pod minimumom ${povzetek.podMinimumom}, na meji ${povzetek.naMeji}.`,
      })
    } catch (err) {
      // Fail-verbose: izvoz ne sme tiho spodleteti — razlog gre v toast.
      // Fail-closed jedro (TypeError iz liba) = pokvaren vnos → viden razlog
      // (NIČ izmišljenega dokumenta).
      toast.error('Izvoz ni uspel', {
        description: err instanceof Error ? err.message : `Neznana napaka (${String(err)}).`,
      })
    } finally {
      setInvPdfVteku(false)
    }
  }

  /** R286 (P1-f 'izvozi' družina — 30. člen) — INVENTURA — PREMOŽENJSKI
   *  PREGLED CSV: ISTA resnica kot R270 PDF, drug medij (Excel/
   *  računovodski uvoz — F1). FRESH GET /api/inventory ob kliku + ISTA
   *  DTO preslikava mapInventoryOdgovor (EN VIR na UI nivoju); EN VIR
   *  inventuraPregled znotraj liba (isti vrsti, isti sort — WYSIWYG po
   *  konstrukciji, F2). Fail-closed: prazen vir → iskren toast (NI
   *  prazne datoteke, F3); pokvaren vir → fail-verbose toast (NIČ tihe
   *  degradacije). now = nov Date() LE tukaj (UI trenutek klika — F4). */
  const handleInventuraCsv = async () => {
    if (invCsvVteku) return
    setInvCsvVteku(true)
    try {
      const res = await fetch('/api/inventory', { credentials: 'same-origin' })
      if (!res.ok) {
        throw new Error(`GET /api/inventory → HTTP ${res.status}`)
      }
      const data: unknown = await res.json()
      const vnosi = mapInventoryOdgovor(data)
      if (vnosi.length === 0) {
        // Fail-closed jedro: prazen seznam ne nastaja datoteke — iskren toast.
        toast.error('Ni vpisanih artiklov', {
          description: 'Inventurni pregled (CSV) se izvozi, ko je vpisan prvi artikel zaloge.',
        })
        return
      }
      // ENA izpeljava: inventuraPregled znotraj liba = ISTA resnica kot
      // PDF KPI/tabela/sklep IN toast (WYSIWYG); izvozeno = kanonični ISO.
      const now = new Date()
      const { povzetek } = inventuraPregled(vnosi)
      const { csv, vrstic } = inventuraPregledCsv(vnosi, now)
      downloadCsvText(inventuraPregledCsvFilename(now), csv)
      toast.success('Inventurni pregled premoženja prenešen v CSV', {
        description: `Inventura-pregled-…csv — ${vrstic - 1} ${artikelBeseda(povzetek.artiklov).toLowerCase()}, pod minimumom ${povzetek.podMinimumom}, na meji ${povzetek.naMeji}.`,
      })
    } catch (err) {
      // Fail-verbose: izvoz ne sme tiho spodleteti — razlog gre v toast.
      toast.error('Izvoz ni uspel', {
        description: err instanceof Error ? err.message : `Neznana napaka (${String(err)}).`,
      })
    } finally {
      setInvCsvVteku(false)
    }
  }

  /* R273 — 29. člen 'izvozi' družine: pregled vrednosti zaloge PDF (glava =
   * lib resnica). FRESH GET /api/inventory + /api/material-prices ob kliku
   * (dva vira ENA
   * resnica: zaloge + trenutno veljavne cene — API resnica veljavnostDo
   * null). Fail-closed: prazen vir → iskren toast (NI prazne datoteke);
   * pokvaren vir → fail-verbose toast (NIČ tihe degradacije). ENA izpeljava
   * zalogaVrednostPregled = toast = PDF (WYSIWYG). */
  const handleVrednostPdf = async () => {
    if (valPdfVteku) return
    setValPdfVteku(true)
    try {
      const [resInv, resCene] = await Promise.all([
        fetch('/api/inventory', { credentials: 'same-origin' }),
        fetch('/api/material-prices', { credentials: 'same-origin' }),
      ])
      if (!resInv.ok) {
        throw new Error(`GET /api/inventory → HTTP ${resInv.status}`)
      }
      if (!resCene.ok) {
        throw new Error(`GET /api/material-prices → HTTP ${resCene.status}`)
      }
      const dataInv: unknown = await resInv.json()
      const dataCene: unknown = await resCene.json()
      if (!Array.isArray(dataInv)) {
        throw new TypeError('Odgovora /api/inventory ni mogoče prebrati (ni polja).')
      }
      if (!dataCene || typeof dataCene !== 'object' || Array.isArray(dataCene)) {
        throw new TypeError('Odgovora /api/material-prices ni mogoče prebrati (ni objekt).')
      }
      const bestArr = (dataCene as { bestPerMaterial?: unknown }).bestPerMaterial
      if (!Array.isArray(bestArr)) {
        throw new TypeError('Odgovora /api/material-prices ni mogoče prebrati (bestPerMaterial ni polje).')
      }
      const vrstice = dataInv as Array<Record<string, unknown>>
      const vnosi: ZalogaVrednostArtikel[] = vrstice.map((item, i) => {
        if (typeof item.id !== 'string' || item.id === '') {
          throw new TypeError(`artikel vrstica ${i}: manjkajoč id v odgovoru API-ja`)
        }
        for (const [ime, v] of [
          ['sifraMateriala', item.sifraMateriala],
          ['naziv', item.naziv],
          ['enota', item.enota],
        ] as const) {
          if (typeof v !== 'string' || v.trim() === '') {
            throw new TypeError(`artikel vrstica ${i} (${item.id}): ${ime} mora biti ne-prazen niz, ne ${String(v)}`)
          }
        }
        if (typeof item.kolicinaZaloga !== 'number' || !Number.isFinite(item.kolicinaZaloga) || item.kolicinaZaloga < 0) {
          throw new TypeError(`artikel vrstica ${i} (${item.id}): kolicinaZaloga mora biti končno ne-negativno število, ne ${String(item.kolicinaZaloga)}`)
        }
        // Fail-verbose DTO pruning (R269/R270 vzorec): števec cen je del
        // vira — manjkajoč/pokvaren NIKOLI tiho 0 (R227 strogost).
        const cnt = item._count as { prices?: unknown } | undefined
        if (!cnt || typeof cnt.prices !== 'number' || !Number.isInteger(cnt.prices) || cnt.prices < 0) {
          throw new TypeError(`artikel vrstica ${i} (${item.id}): števec cen (_count.prices) mora biti ne-negativno celo število, ne ${String(cnt?.prices)}`)
        }
        return {
          id: item.id as string,
          sifraMateriala: item.sifraMateriala as string,
          naziv: item.naziv as string,
          kolicinaZaloga: item.kolicinaZaloga as number,
          enota: item.enota as string,
          stevecCen: cnt.prices,
        }
      })
      const best: ZalogaVrednostBest[] = (bestArr as Array<Record<string, unknown>>).map((b, i) => {
        if (typeof b.inventoryId !== 'string' || b.inventoryId === '') {
          throw new TypeError(`best vrstica ${i}: manjkajoč inventoryId v odgovoru API-ja`)
        }
        if (typeof b.bestPrice !== 'number' || !Number.isFinite(b.bestPrice) || b.bestPrice < 0) {
          throw new TypeError(`best vrstica ${i} (${b.inventoryId}): bestPrice mora biti končno ne-negativno število, ne ${String(b.bestPrice)}`)
        }
        if (typeof b.bestSupplier !== 'string' || b.bestSupplier.trim() === '') {
          throw new TypeError(`best vrstica ${i} (${b.inventoryId}): bestSupplier mora biti ne-prazen niz, ne ${String(b.bestSupplier)}`)
        }
        return { inventoryId: b.inventoryId, bestPrice: b.bestPrice, bestSupplier: b.bestSupplier }
      })
      if (vnosi.length === 0) {
        // Fail-closed jedro: prazen seznam ne nastaja dokumenta — iskren toast.
        toast.error('Ni vpisanih artiklov', {
          description: 'Pregled vrednosti zaloge se izvozi, ko je vpisan prvi artikel zaloge.',
        })
        return
      }
      // ENA izpeljava: povzetek za toast = ISTA resnica kot KPI IN sklep na
      // listu (WYSIWYG).
      const { povzetek } = zalogaVrednostPregled(vnosi, best)
      generateZalogaVrednostPdf(vnosi, best, { now: new Date() })
      toast.success('Pregled vrednosti zaloge prenešen v PDF', {
        description: `Zaloga-vrednost-…pdf — ${artikelBeseda(povzetek.artiklov)}, Σ ${povzetek.zCeno > 0 ? `${povzetek.vsotaEur.toFixed(2)} EUR` : '—'}, pretečena ${povzetek.pretecenih}, brez cene ${povzetek.brezCene}.`,
      })
    } catch (err) {
      // Fail-verbose: izvoz ne sme tiho spodleteti — razlog gre v toast.
      // Fail-closed jedro (TypeError iz liba) = pokvaren vnos → viden razlog
      // (NIČ izmišljenega dokumenta).
      toast.error('Izvoz ni uspel', {
        description: err instanceof Error ? err.message : `Neznana napaka (${String(err)}).`,
      })
    } finally {
      setValPdfVteku(false)
    }
  }

  // R219 (P1-f) — dvostopenjsko filtriranje: PRVA stopnja = tip (kot pred
  // R219), DRUGA = čip 'pod minimumom'. Ime 'filtered' ostane KONČNO vidna
  // množica — vsi porabniki (CSV R136, Naročilnica R204, Osnutek R205,
  // seznam, prazno stanje) SAMODEJNO spoštujejo čip (WYSIWYG — 'vidni
  // artikli' so resnično vidni; čip ne laže).
  const typeFiltered = filter === 'ALL'
    ? inventory
    : inventory.filter((item) => item.tip === filter)

  // R221 — STIRI vejice: čip 'pod' (<=) ima prednost, čip 'na' (===) je ožja
  // rezerva, čip 'brez dobavitelja' (MaterialPrice števec === 0 — DRUGA
  // dimenzija: nabavna pripravljenost), brez čipov = ves tip. Medsebojna
  // izključnost zagotavlja, da je izračun determinističen (nikoli več kot
  // en čip hkrati). Ime 'filtered' ostane KONČNO vidna množica — vsi
  // porabniki (CSV R136, Naročilnica R204, Osnutek R205, seznam, prazno
  // stanje) SAMODEJNO spoštujejo vse čipe (WYSIWYG — 'vidni artikli' so
  // resnično vidni; čip ne laže).
  const filtered = podMinOnly
    ? typeFiltered.filter((item) => item.kolicinaZaloga <= item.minimalnaZaloga)
    : naMinOnly
      ? typeFiltered.filter((item) => item.kolicinaZaloga === item.minimalnaZaloga)
      : brezDobaviteljaOnly
        ? typeFiltered.filter((item) => item._count?.prices === 0)
        : typeFiltered

  // R219 — števec na čipu: koliko artiklov je pod minimumom ZNOTRAJ aktivnega
  // filtra tipa (iskreno število — pove, koliko jih čip POKAŽE, ne koliko jih
  // je v celotni zalogi; tabular-nums, ISTI vzorec kot R218 countHeading).
  const podMinCount = typeFiltered.filter(
    (item) => item.kolicinaZaloga <= item.minimalnaZaloga,
  ).length

  // R220 — iskren števec za 'na minimumu' čip (ZNOTRAJ filtra tipa — ISTI
  // vzorec; ob medsebojni izključnosti = TOČNO koliko vrstic čip pokaže).
  const naMinCount = typeFiltered.filter(
    (item) => item.kolicinaZaloga === item.minimalnaZaloga,
  ).length

  // R221 — iskren števec za 'brez dobavitelja' čip (ZNOTRAJ filtra tipa —
  // ISTI vzorec). STROGOST brez izmišljevanja: manjkajoči števec (stari
  // predpomnjeni odgovor brez polja) NIKOLI ni 'brez dobavitelja' — le
  // izrecna 0 pomeni 'nihče vpisan' (fail-closed konservativno).
  const brezDobaviteljaCount = typeFiltered.filter(
    (item) => item._count?.prices === 0,
  ).length

  const totalItems = inventory.length
  const totalStock = inventory.reduce((s, i) => s + i.kolicinaZaloga, 0)
  const lowStockItems = inventory.filter(
    (i) => i.kolicinaZaloga <= i.minimalnaZaloga
  )

  // R270 — F2 mini-vrstica 'Inventura (viden seznam):' — ENA izpeljava
  // inventuraPregled čez ISTI prune kot PDF KPI + sklep + toast (WYSIWYG):
  // viden seznam po čipih/tipu = kar uporabnik vidi; FRESH ob kliku = polna
  // resnica skladišča (dve okni, ENA matemtika). R227 strogost: manjkajoči
  // števec premikov NIKOLI ni '0' — mini brez resnice o obratu = brez mini
  // (iskrena praznina, NIKOLI lažna številka).
  const inventuraVidenPregled = useMemo(() => {
    if (filtered.length === 0) return null
    const vnosi: InventuraArtikel[] = []
    for (const item of filtered) {
      const cnt = item._count
      // R227 strogost: manjkajoči/pokvaren števec premikov = brez mini
      // (iskrena praznina — NIKOLI lažna številka '0').
      if (
        !cnt ||
        typeof cnt.movements !== 'number' ||
        !Number.isInteger(cnt.movements) ||
        cnt.movements < 0
      ) {
        return null
      }
      vnosi.push({
        id: item.id,
        sifraMateriala: item.sifraMateriala,
        naziv: item.naziv,
        tip: typeLabels[item.tip] || item.tip,
        enota: item.enota,
        kolicinaZaloga: item.kolicinaZaloga,
        minimalnaZaloga: item.minimalnaZaloga,
        premiki: cnt.movements,
      })
    }
    return inventuraPregled(vnosi).povzetek
  }, [filtered])

  // R273 — FRESH best cene (API bestPerMaterial — SAMO trenutno veljavne,
  // API resnica veljavnostDo null) za mini-vrstico ENA matemtika. Bralni
  // GET; pokvaren odgovor = null (mini iskreno odsotna — NIKOLI lažni žig;
  // FRESH export path ima polno fail-verbose preverbo ob kliku).
  useEffect(() => {
    let ziv = true
    fetch('/api/material-prices', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: unknown) => {
        if (!ziv) return
        if (!d || typeof d !== 'object' || Array.isArray(d)) {
          setBestCene(null)
          return
        }
        const arr = (d as { bestPerMaterial?: unknown }).bestPerMaterial
        if (!Array.isArray(arr)) {
          setBestCene(null)
          return
        }
        const best: ZalogaVrednostBest[] = []
        for (const b of arr) {
          const e = b as Record<string, unknown>
          if (
            typeof e.inventoryId !== 'string' || e.inventoryId === '' ||
            typeof e.bestPrice !== 'number' || !Number.isFinite(e.bestPrice) || e.bestPrice < 0 ||
            typeof e.bestSupplier !== 'string' || e.bestSupplier.trim() === ''
          ) {
            setBestCene(null)
            return
          }
          best.push({ inventoryId: e.inventoryId, bestPrice: e.bestPrice, bestSupplier: e.bestSupplier })
        }
        setBestCene(best)
      })
      .catch(() => {
        if (ziv) setBestCene(null)
      })
    return () => {
      ziv = false
    }
  }, [])

  // R273 — F2 mini-vrstica 'Vrednost (viden seznam):' — ENA izpeljava
  // zalogaVrednostPregled čez ISTI prune + bestCene kot PDF KPI + sklep +
  // toast (WYSIWYG): dve okni (state vs FRESH), ENA matemtika. bestCene
  // null → mini iskreno odsotna (cena-vir ni dokazan — NIKOLI lažnega Σ).
  // R227 strogost: manjkajoč/pokvaren števec cen = brez mini.
  const vrednostVidenPregled = useMemo(() => {
    if (filtered.length === 0 || bestCene === null) return null
    const vnosi: ZalogaVrednostArtikel[] = []
    for (const item of filtered) {
      const cnt = item._count
      if (
        !cnt ||
        typeof cnt.prices !== 'number' ||
        !Number.isInteger(cnt.prices) ||
        cnt.prices < 0
      ) {
        return null
      }
      vnosi.push({
        id: item.id,
        sifraMateriala: item.sifraMateriala,
        naziv: item.naziv,
        kolicinaZaloga: item.kolicinaZaloga,
        enota: item.enota,
        stevecCen: cnt.prices,
      })
    }
    try {
      return zalogaVrednostPregled(vnosi, bestCene).povzetek
    } catch {
      // Pokvaren best-vir (orphan/podvojen id) = brez mini — iskrena praznina.
      return null
    }
  }, [filtered, bestCene])

  function getStockPercent(item: InventoryItem): number {
    const max = Math.max(item.minimalnaZaloga * 3, item.kolicinaZaloga)
    return Math.min((item.kolicinaZaloga / max) * 100, 100)
  }

  function getStockColor(item: InventoryItem): string {
    if (item.kolicinaZaloga <= item.minimalnaZaloga) return 'bg-roksal-red'
    if (item.kolicinaZaloga <= item.minimalnaZaloga * 1.5) return 'bg-roksal-amber'
    return 'bg-roksal-green'
  }

  // R205 — odpri dialog osnutka: isti WYSIWYG seznam vidnih artiklov pod
  // minimumom kot naročilnica R204. Iskren prazen seznam → dialog se NE odpre
  // (nič izmišljenega naročila). R215 — opcijski argument: toast akcija 'Shrani
  // kot osnutek' (R204 kopiranje) pošlje TOČNO iste artikle, ki so bili
  // kopirani (WYSIWYG EN VIR — brez ponovnega izvajanja filtra, ki bi med
  // tem lahko zdrsel; determinizem).
  function openOsnutekDialog(artikli?: readonly ZalogaArtikelZaNarocilo[]) {
    const podMin = artikli
      ? [...artikli]
      : filtered.filter((i) => i.kolicinaZaloga <= i.minimalnaZaloga)
    if (podMin.length === 0) {
      toast.error('Ni artiklov pod minimalno zalogo — nič za naročilo.')
      return
    }
    setOsnutekArtikli(podMin)
    setOsnutekOpen(true)
  }

  // R216 — deep-link hint (P1-d/e): paleto ⌘K 'Nizka zaloga' in zvonček
  // 'stock' klik → Osnutek dialog z TOČNO TIM enim artiklom (EN VIR
  // passthrough iz page.tsx centralNavigate). Monotonski n (R213 družina):
  // nov n = nov hint (zadnji klik zmaga — deterministično); enak hint
  // (isti objekt) ne ponovno odpre dialoga. Počistitev (null) dialoga NE
  // zapira — samo stale hint ne sme biti porabljen.
  const hintArtikel = osnutekHint?.artikel ?? null
  const hintNonce = osnutekHint?.n ?? 0
  useEffect(() => {
    if (hintArtikel) openOsnutekDialog([hintArtikel])
  }, [hintArtikel, hintNonce])

  // R219 (P1-f) — filter hint: namig 'pod minimumom' PRIŽGE čip (tudi, ko
  // je komponenta že montirana — monotonski n; zadnji klik zmaga). Počistitev
  // namiga (null) čipa NE ugasne — uporabnik ga ugasi sam (namig je namig,
  // ne lastništvo nad stanjem; R216 vzorec: počistitev dialoga NE zapira);
  // stale namig je vseeno nemogčen: page.tsx počisti hint ob vsaki drugi
  // navigaciji, komponenta pa se ob preklopu zavihka odmontira (čip =
  // stanje seje v Zalogi, kot filter tipa).
  // R220 — namig 'na-minimumu' prižge drugi čip in ugasne 'pod' (medsebojna
  // izključnost — deep-link iz palete obljubi TOČNO ta pogled, zato ta veja
  // namerno vsebuje izklop sorojenega čipa; to NI počistitev namiga —
  // počistitev (null) še VEDNO ne ugasne ničesar).
  // R221 — namig 'brez-dobavitelja' prižge tretji čip in ugasne OBA
  // sorojena (ENA leča na enkrat — deep-link obljubi TOČNO ta pogled);
  // veji 'pod'/'na' pač ugasnejo tudi tretjega. null še VEDNO ne ugasne
  // ničesar (R216 vzorec ostaja nespremenjen).
  const hintFilter = filterHint?.filter ?? null
  const hintFilterNonce = filterHint?.n ?? 0
  useEffect(() => {
    if (hintFilter === 'na-minimumu') {
      setNaMinOnly(true)
      setPodMinOnly(false) // medsebojna izključnost — NE počistitev namiga
      setBrezDobaviteljaOnly(false)
    } else if (hintFilter === 'brez-dobavitelja') {
      setBrezDobaviteljaOnly(true)
      setPodMinOnly(false) // medsebojna izključnost — NE počistitev namiga
      setNaMinOnly(false)
    } else if (hintFilter) {
      setPodMinOnly(true)
      setNaMinOnly(false)
      setBrezDobaviteljaOnly(false)
    }
  }, [hintFilter, hintFilterNonce])

  // R205 — shrani osnutek: POST /api/material-orders ustvari MaterialOrder s
  // statusom OSNUTEK (strežnik ga vsili). Količine = narociloKolicina (EN VIR
  // RESNICE, lib zaloga-povzetek — ista formula kot odložišče R204). Pošiljamo
  // LE id + količino (brez vrednosti iz UI): strežnik vzame realno vrednost
  // dobavitelja iz MaterialPrice, če obstaja, sicer 0 — brez izmišljenih
  // vrednosti. Fail-verbose z razlogom iz odgovora (vzorec R140/R163/R203/R204):
  // 403 pokaže manjkajočo pravico + vlogo, 400/409/500 svet razlog.
  async function handleShraniOsnutek() {
    // R243 — obrambni AND (R242 vzorec: vrata v vratah) — ISTA disjunkcija
    // kot API vrata na POST /api/material-orders (procurement.create).
    if (!lahkoUstvariNarocila) return
    if (!osnutekDobavitelj || osnutekArtikli.length === 0) {
      toast.error('Izberite dobavitelja za osnutek naročila.')
      return
    }
    setOsnutekSubmitting(true)
    try {
      const res = await fetch('/api/material-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: osnutekDobavitelj,
          items: osnutekArtikli.map((a) => ({
            inventoryId: a.id,
            kolicina: narociloKolicina(a),
          })),
          ...(osnutekOpombe.trim() ? { opombe: osnutekOpombe.trim() } : {}),
        }),
      })
      if (res.ok) {
        // R214 — deep-link akcija v toastu (P1-družina R213 subTab protokol):
        // prej je opis LE povedal 'najdeš ga v Material → Naročila' — uporabnik
        // je moral sam klikniti Več → Material → Naročila. Zdaj gumb 'Odpri
        // naročila' pošlje isti roksal:navigate { subTab: 'orders' } kot
        // zvonček digest (whitelist + monotonski n v page.tsx centralNavigate).
        toast.success('Osnutek naročila shranjen (status OSNUTEK)', {
          description: `${osnutekArtikli.length} ${zalogaPovzetekBeseda(osnutekArtikli.length)} — najdeš ga v Material → Naročila. Nič še ni poslano dobavitelju.`,
          action: {
            label: 'Odpri naročila',
            onClick: () => {
              window.dispatchEvent(
                new CustomEvent('roksal:navigate', { detail: { tab: 'more', more: 'material', subTab: 'orders' } }),
              )
            },
          },
        })
        setOsnutekOpen(false)
        setOsnutekDobavitelj('')
        setOsnutekOpombe('')
        setOsnutekArtikli([])
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        toast.error(data?.error?.trim() || `Napaka pri shranjevanju osnutka (${res.status})`)
      }
    } catch {
      toast.error('Napaka pri povezavi s strežnikom')
    } finally {
      setOsnutekSubmitting(false)
    }
  }

  // R205 — CSV priloga: ista vsebina kot odložišče R204 v tabelarni obliki
  // (narocilnicaCsvVrstice, EN VIR RESNICE; glavo poda downloadCsv).
  function prenesiNarocilnicoCsv() {
    if (osnutekArtikli.length === 0) {
      toast.error('Ni artiklov pod minimalno zalogo — nič za naročilo.')
      return
    }
    downloadCsv(
      `narocilnica-${todayStamp()}.csv`,
      ['Šifra', 'Naziv', 'Enota', 'Zaloga', 'Min. zaloga', 'Naroči'],
      narocilnicaCsvVrstice(osnutekArtikli),
    )
    toast.success(
      `Naročilnica CSV prenesena — ${osnutekArtikli.length} ${zalogaPovzetekBeseda(osnutekArtikli.length)}.`,
    )
  }

  // R237 (P1-c) — NAROČILNICA OSNUTEK PDF (pravi dokument za interno potrditev
  // osnutka PRED pošiljanjem; brat CSV priloge R205 — ISTI vir artikli +
  // narociloKolicina ENA formula). Determinizem: EN `now` za dokument IN ime
  // (dva klica new Date() bi razdala žig in ime — lekcija R121/R235).
  // Fail-verbose: TypeError (pokvaren artikel / nad minimumom — delegirana
  // validacija narociloKolicina) → viden razlog; ostalo → 'Izvoz PDF ni uspel:'
  // (R234/R235/R236 družina). Gumb je disabled na 0 (ISTO semantiko kot CSV
  // sorojec — prazna datoteka ne nastane).
  function prenesiOsnutekPdf() {
    if (osnutekArtikli.length === 0) {
      toast.error('Ni artiklov pod minimalno zalogo — nič za naročilo.')
      return
    }
    try {
      const now = new Date()
      const doc = buildOsnutekPdfDoc(osnutekArtikli, {
        now,
        opombe: osnutekOpombe,
      })
      doc.save(osnutekPdfFilename(now))
      toast.success(
        `Osnutek prenesen v PDF — ${osnutekArtikli.length} ${zalogaPovzetekBeseda(osnutekArtikli.length)}`,
        { description: 'osnutek-narocilnica-…pdf — interni pregled pred pošiljanjem.' },
      )
    } catch (err) {
      if (err instanceof TypeError) {
        // fail-closed jedro: pokvaren artikel / nad minimumom → viden razlog
        toast.error('Osnutka PDF ni mogoče sestaviti iz teh artiklov', { description: err.message })
      } else {
        toast.error(`Izvoz PDF ni uspel: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
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
          {/* R177 — pečat 'Osveženo ob HH:MM:SS' = čas zadnjega uspešnega
              branja zaloge (vzorec R170/R171; skrit na ozkih zaslonih;
              flex-wrap — pri sm širini se lepo prilega ob podnaslov). */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="text-sm text-muted-foreground">
              Upravljanje materiala in inventarja
            </p>
            {zalogaOsvezitev && (
              <span
                className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"
                title="Čas zadnje uspešne osvežitve podatkov"
              >
                <History className="h-3 w-3 shrink-0" aria-hidden="true" />
                Osveženo ob <span className="tabular-nums">{casOznaka(zalogaOsvezitev)}</span>
              </span>
            )}
          </div>
        </div>
        {/* R243 — wave 5 RBAC ogledalo: gumb 'Dodaj gibanje zaloge' je VIDEN
            samo vlogi s pravico inventory.write (API POST /api/inventory s
            tipPremika — §10/R135). Med nalaganjem pravic in ob napaki skrit
            (fail-closed, R242 vzorec). */}
        {lahkoZapisujePremike && (
          <Button
            size="icon"
            className="h-9 w-9 bg-roksal-amber hover:bg-roksal-amber/90 text-roksal-navy shadow-sm focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2 press-scale"
            onClick={() => setMovementOpen(true)}
            aria-label="Dodaj gibanje zaloge"
            title="Dodaj gibanje zaloge"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
      {/* R243 — vlogo-osveščen vodič (R241/R242 precedens — nikoli kazalec na
          gumb, ki ga uporabnik ne vidi): viden SAMO, ko uporabnik nima
          inventory.write IN je seznam pravic znan (tišina med nalaganjem je
          iskrena). Navaja TOČNO ime pravice iz API vrat — uporabnik, ki
          gumba ne vidi, razume ZAKAJ; izključno žetoni (0 novih hex). */}
      {myPermissions !== null && !lahkoZapisujePremike && (
        <div
          className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-2xs text-muted-foreground"
          role="note"
          aria-label="Premiki zaloge so za branje — beleženje zahteva pravico"
        >
          Pregled zaloge je samo za branje. Premike (poraba / dopolnitev /
          odpis) beležita vloga s pravico{' '}
          <span className="font-semibold text-roksal-ink">inventory.write</span> —
          vodstvo ali skladišče.
        </div>
      )}

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
                <span className="text-2xs font-medium tabular-nums text-roksal-ink">{cat.totalStock}</span>
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
              <Euro aria-hidden="true" className="h-4 w-4 text-roksal-ink" />
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
          <p className="text-2xs text-muted-foreground uppercase tracking-wide">
            Artikli
          </p>
          <p className="text-xl font-bold tabular-nums text-roksal-ink">{totalItems}</p>
        </Card>
        <Card className="px-3 py-3 card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
          <p className="text-2xs text-muted-foreground uppercase tracking-wide">
            Skupna zaloga
          </p>
          <p className="text-xl font-bold tabular-nums text-roksal-ink">
            {totalStock.toFixed(0)}
          </p>
        </Card>
        <Card className="px-3 py-3 card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '180ms' }}>
          <p className="text-2xs text-muted-foreground uppercase tracking-wide">
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
          <AlertTriangle aria-hidden="true" className="h-5 w-5 shrink-0 text-roksal-red" />
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
          <Filter aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 ${
                filter === tab.id
                  ? 'bg-roksal-navy text-white border-b-2 border-white/30'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
          {/* R219 (P1-f) — čip 'pod minimumom': drugostopenjski filter, vedno
              na voljo (ročni klik) IN samodejno prižgan prek namiga (paleta
              'Vse'). aria-pressed = pravi toggle (struktura, ne samo izgled —
              R215 družina); ko je aktiven, nosi ISKREN števec (koliko jih
              res pokaže znotraj filtra tipa, tabular-nums R138) in roksal-red
              družino (isti semantični pomen kot barvni stolpci in badge —
              barva ni edini nosilec, števec + dobeseden tekst sta nosilca).
              Aktiven čip spreminja VSE porabnike 'vidnih artiklov' (CSV /
              Naročilnica / Osnutek / seznam) — WYSIWYG. */}
          <button
            type="button"
            onClick={() => { setPodMinOnly((v) => !v); setNaMinOnly(false); setBrezDobaviteljaOnly(false) }}
            /* R220 — medsebojna izključnost: prižig 'pod' ugasne sorojeni
               'na' čip (in obratno spodaj) — vsak čipov iskren števec pove
               TOČNO koliko vrstic prikaže; nobena kombinacija ne zmede.
               R221 — izključnost se raztegne na TRETJI čip 'brez
               dobavitelja' (ENA leča na enkrat — isti determinizem). */
            aria-pressed={podMinOnly}
            aria-label={
              podMinOnly
                ? `Pokaži samo artikle pod minimalno zalogo — aktiven (${podMinCount}); klik za izklop`
                : 'Pokaži samo artikle pod minimalno zalogo'
            }
            title="Pokaži samo artikle, katerih zaloga je pod ali na minimumu"
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 ${
              podMinOnly
                ? 'border-roksal-red/30 bg-roksal-red/10 text-roksal-red'
                : 'border-transparent bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            Pod minimumom
            {podMinOnly && (
              <span className="ml-1 tabular-nums font-semibold">{podMinCount}</span>
            )}
          </button>
          {/* R220 — čip 'na minimumu' (===): ožji sorojeni pogled ISTEGA
              vprašanja nizke zaloge (=== je podmnožica <= — artikli TOČNO na
              tleh; naslednja poraba jih spusti pod). MEDSEBOJNO IZKLJUČEN s
              čipom 'pod' (klik poniža sorojenega — vsak čipov iskren števec
              pove TOČNO koliko vrstic prikaže; deep-link iz palete obljubi
              TOČNO ta pogled). ISTA roksal-red družina (artikli na minimumu
              SO del pod-minimum množice — ista semantika; razliko nosita
              dobeseden tekst + števec, ne drugačna barva — R219 pravilo).
              Tudi ta čip spreminja VSE porabnike 'vidnih artiklov'
              (CSV / Naročilnica / Osnutek / seznam) — WYSIWYG. */}
          <button
            type="button"
            onClick={() => { setNaMinOnly((v) => !v); setPodMinOnly(false); setBrezDobaviteljaOnly(false) }}
            aria-pressed={naMinOnly}
            aria-label={
              naMinOnly
                ? `Pokaži samo artikle na minimalni zalogi — aktiven (${naMinCount}); klik za izklop`
                : 'Pokaži samo artikle na minimalni zalogi'
            }
            title="Pokaži samo artikle, katerih zaloga je točno na minimumu"
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 ${
              naMinOnly
                ? 'border-roksal-red/30 bg-roksal-red/10 text-roksal-red'
                : 'border-transparent bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            Na minimumu
            {naMinOnly && (
              <span className="ml-1 tabular-nums font-semibold">{naMinCount}</span>
            )}
          </button>
          {/* R221 — čip 'brez dobavitelja' (TRETJI whitelist vnos 'brez-
              dobavitelja'; DRUGA dimenzija — nabavna pripravljenost):
              artikel brez VPISANE cene pri katerem koli dobavitelju
              (MaterialPrice števec === 0 — EN VIR podatkov, /api/inventory
              _count) — naročilni tok ne more ceniti postavke. Drugačna
              semantika kot nizka zaloga → AKTIVNO stanje v roksal-amber
              družini (pozornost, ne alarm; rdeča ostane rezervirana za
              nizko zalogo — barva NI edini nosilec: dobeseden tekst +
              iskren števec + aria-pressed + title). ISTI strogi vzorec:
              manjkajoči števec NIKOLI ni 'brez' (fail-closed). Tudi ta
              čip spreminja VSE porabnike 'vidnih artiklov' (CSV /
              Naročilnica / Osnutek / seznam) — WYSIWYG. */}
          <button
            type="button"
            onClick={() => { setBrezDobaviteljaOnly((v) => !v); setPodMinOnly(false); setNaMinOnly(false) }}
            aria-pressed={brezDobaviteljaOnly}
            aria-label={
              brezDobaviteljaOnly
                ? `Pokaži samo artikle brez vpisane dobaviteljske cene — aktiven (${brezDobaviteljaCount}); klik za izklop`
                : 'Pokaži samo artikle brez vpisane dobaviteljske cene'
            }
            title="Pokaži samo artikle, za katere ni vpisana cena pri nobenem dobavitelju"
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 ${
              brezDobaviteljaOnly
                ? 'border-roksal-amber/40 bg-roksal-amber/10 text-roksal-amber'
                : 'border-transparent bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            Brez dobavitelja
            {brezDobaviteljaOnly && (
              <span className="ml-1 tabular-nums font-semibold">{brezDobaviteljaCount}</span>
            )}
          </button>
        </div>
        {/* R204 — naročilnica vidnih artiklov pod minimumom (istá pill
            družina kot CSV R136 / Povzetek R203; iskren prazen seznam =
            viden toast, nič izmišljenega). */}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            void kopirajNarocilnico(
              filtered.filter((i) => i.kolicinaZaloga <= i.minimalnaZaloga),
              'vidni artikli pod minimumom',
            )
          }
          className="h-8 shrink-0 gap-1.5 text-[11px] font-medium tabular-nums press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
          aria-label="Kopiraj naročilnico vidnih artiklov pod minimalno zalogo"
          title="Naročilnica za dobavitelja (vidni artikli pod minimumom) — prilepi v e-pošto/SMS"
        >
          <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
          Naročilnica
        </Button>
        {/* R205 — osnutek naročila: naročilnica vidnih artiklov pod minimumom
            se shrani kot SLEDLJIV MaterialOrder OSNUTEK (dobavitelja izbere
            uporabnik; aplikacija trdi LE 'shranjen', NIKOLI 'poslano'). Isti
            pill družina kot Naročilnica R204 / CSV R136. */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => openOsnutekDialog()}
          className="h-8 shrink-0 gap-1.5 text-[11px] font-medium tabular-nums press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
          aria-label="Shrani naročilnico vidnih artiklov kot osnutek naročila"
          title="Shrani naročilnico (vidni artikli pod minimumom) kot osnutek naročila — Material → Naročila"
        >
          <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
          Osnutek
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={exportZalogaCsv}
          className="h-8 shrink-0 gap-1.5 text-[11px] font-medium tabular-nums press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
          aria-label="Izvozi vidno zalogo kot CSV"
          title="Izvozi vidno zalogo (upošteva filter) kot CSV za Excel"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          CSV
        </Button>
        {/* R234 (P1-c) — Stanje zaloge PDF ('izvozi' družina PDF dimenzija):
            ISTI pill družina kot CSV R136 / Naročilnica R204 / Osnutek R205;
            fail-closed klik (0 vidnih → toast, NI prazne datoteke — R232). */}
        <Button
          variant="outline"
          size="sm"
          onClick={exportZalogaPdf}
          className="h-8 shrink-0 gap-1.5 text-[11px] font-medium tabular-nums press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
          aria-label="Izvozi vidno zalogo kot PDF"
          title="Izvozi vidno zalogo (upošteva filter) kot PDF poročilo"
        >
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          PDF
        </Button>
        {/* R270 — inventurni pregled PDF (26. člen 'izvozi' družine): VEDNO
            viden (NI gated na filtered.length — pariteta R263–R269; podatkovni
            scope inventory.read, ne pišoča pravica); press-scale + dvoklik
            guard + FileDown/Loader2 aria-hidden (družinski kontrakt). */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleInventuraPdf()}
          disabled={invPdfVteku}
          className="h-8 shrink-0 gap-1.5 text-[11px] font-medium tabular-nums press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
          aria-label="Izvozi inventurni pregled premoženja kot PDF"
          title="Inventurni pregled premoženja kot pravi PDF — VSA zalogovna premoženja (FRESH ob kliku)"
        >
          {invPdfVteku ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Inventura
        </Button>
        {/* R286 — inventurni pregled CSV (30. člen 'izvozi' družine): ISTA
            resnica kot R270 PDF, drug medij (Excel/računovodski uvoz, F1);
            VEDNO viden (pariteta R270/R273); press-scale + dvoklik guard
            + FileSpreadsheet/Loader2 aria-hidden (družinski kontrakt,
            pariteta R285 zapisni list CSV gumba; 0 novih hex). */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleInventuraCsv()}
          disabled={invCsvVteku}
          className="h-8 shrink-0 gap-1.5 text-[11px] font-medium tabular-nums press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 active:scale-[0.96]"
          aria-label="Izvozi inventurni pregled premoženja kot CSV"
          title="Inventurni pregled premoženja kot CSV (30. člen izvozne družine) — ista zapisana resnica kot PDF v Excelu: 8 tabelnih stolpcev + id/Premiki/Izvoženo za računovodski uvoz"
        >
          {invCsvVteku ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Inventura CSV
        </Button>
        {/* R273 — pregled vrednosti zaloge PDF (29. člen 'izvozi' družine):
            VEDNO viden (NI gated na filtered.length — pariteta R263–R272;
            podatkovni scope inventory.read, ne pišoča pravica); press-scale
            + dvoklik guard + FileDown/Loader2 aria-hidden (družinski
            kontrakt). */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleVrednostPdf()}
          disabled={valPdfVteku}
          className="h-8 shrink-0 gap-1.5 text-[11px] font-medium tabular-nums press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
          aria-label="Izvozi pregled vrednosti zaloge kot PDF"
          title="Pregled vrednosti zaloge kot pravi PDF — VSA zalogovna premoženja s trenutno veljavnimi cenami (FRESH ob kliku)"
        >
          {valPdfVteku ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Vrednost
        </Button>
      </div>

      {/* R270 — legenda pill pariteta (družina R263–R269): poimenuje kaj
          nosi dokument — VSA premoženja FRESH ob kliku (R234 PDF je namenoma
          viden seznam po filtrih — dve vrati, dve različni vprašanji); VEDNO
          vidna (pariteta s pillom). */}
      <p className="text-2xs text-muted-foreground">
        PDF = VSA zalogovna premoženja (tudi artikli brez premikov — polna resnica, ne samo viden seznam filtrov)
      </p>

      {/* R273 — legenda pill pariteta (družina R263–R272): poimenuje kaj
          nosi dokument — polna denarna resnica skladišča FRESH ob kliku
          (oba vira); VEDNO vidna (pariteta s pillom). */}
      <p className="text-2xs text-muted-foreground">
        PDF = polna denarna resnica skladišča (FRESH /api/inventory + /api/material-prices ob kliku — samo trenutno veljavne cene; ne zastarel state)
      </p>

      {/* R286 — legenda CSV pill pariteta (30. člen; pariteta R285 legenda
          1:1): poimenuje kaj nosi CSV — ISTA resnica kot R270 PDF v Excelu
          + strojno-berljivi dodatki; VEDNO vidna (pariteta s pillom). */}
      <p className="text-2xs text-muted-foreground">
        Inventura CSV = ista resnica kot PDF v Excelu — 8 tabelnih stolpcev + id/Premiki/Izvoženo (kanonični ISO) za računovodski uvoz
      </p>

      {/* R270 — F2 mini-vrstica 'Inventura (viden seznam):' (WYSIWYG ISTA
          izpeljava inventuraPregled kot PDF KPI + sklep + toast — ENA
          izpeljava): viden seznam po čipih/tipu = kar uporabnik vidi, FRESH =
          polna resnica skladišča (dve okni, ENA matemtika); dot
          roksal-red/amber/green — RED kadar akcija (pod minimumom), AMBER
          kadar samo na meji; kondicionalna žetona ŽIVO samo kadar > 0 —
          R256 lekcija 4; tabular-nums; 0 novih hex. R274 a11y detail:
          role="status" (implicitno aria-live="polite") — async resnica po
          mount fetchu se oznanji bralniku; pariteta R263–R273 družine. */}
        {/* R275 — hover razložljivost iskrene resnice: title + cursor-help
            poimenujeta WYSIWYG pomen mini-vrstice (brez vizualnega šuma).
            0 novih hex. */}
      {inventuraVidenPregled !== null && (
        <div
          role="status"
          title="Inventura (viden seznam) = kar uporabnik vidi po čipih/tipu; FRESH PDF = VSA zalogovna premoženja. pod minimumom = akcija naročila, na meji = pozor."
          className="flex flex-wrap cursor-help items-center gap-2 text-xs text-muted-foreground"
        >
          <span
            aria-hidden="true"
            className={`h-2 w-2 shrink-0 rounded-full ${
              inventuraVidenPregled.podMinimumom > 0
                ? 'bg-roksal-red'
                : inventuraVidenPregled.naMeji > 0
                  ? 'bg-roksal-amber'
                  : 'bg-roksal-green'
            }`}
          />
          <span className="tabular-nums">
            Inventura (viden seznam): {artikelBeseda(inventuraVidenPregled.artiklov)} · pod minimumom {inventuraVidenPregled.podMinimumom} · na meji {inventuraVidenPregled.naMeji} · premiki {inventuraVidenPregled.premikiSkupaj}
          </span>
          {inventuraVidenPregled.podMinimumom > 0 && inventuraVidenPregled.najvecjiManjka !== null && (
            <span className="rounded-full border border-roksal-red/40 bg-roksal-red/10 px-2 py-0.5 text-2xs font-medium text-roksal-red tabular-nums">
              manjka {kolicinaNiz(inventuraVidenPregled.najvecjiManjka.vrednost)} {inventuraVidenPregled.najvecjiManjka.enota}
            </span>
          )}
          {inventuraVidenPregled.naMeji > 0 && (
            <span className="rounded-full border border-roksal-amber/40 bg-roksal-amber/10 px-2 py-0.5 text-2xs font-medium text-roksal-amber tabular-nums">
              na meji {inventuraVidenPregled.naMeji}
            </span>
          )}
        </div>
      )}

      {/* R273 — F2 mini-vrstica 'Vrednost (viden seznam):' (WYSIWYG ISTA
          izpeljava zalogaVrednostPregled kot PDF KPI + sklep + toast — ENA
          izpeljava): dot RED (brez cene — nič ne more oceniti) / AMBER
          (pretečena — akcija re-price) / GREEN; kondicionalna žetona ŽIVO
          samo kadar > 0 — R256 lekcija 4; tabular-nums; 0 novih hex. R274
          a11y detail: role="status" — async resnica oznanjena bralniku. */}
      {vrednostVidenPregled !== null && (
        <div
          role="status"
          title="Vrednost (viden seznam) = ISTI izračun kot PDF KPI + toast (WYSIWYG). Σ — pomeni: nič artiklov nima trenutno veljavne cene — nič ni ocenjeno (brez demo cene)."
          className="flex flex-wrap cursor-help items-center gap-2 text-xs text-muted-foreground"
        >
          <span
            aria-hidden="true"
            className={`h-2 w-2 shrink-0 rounded-full ${
              vrednostVidenPregled.brezCene > 0
                ? 'bg-roksal-red'
                : vrednostVidenPregled.pretecenih > 0
                  ? 'bg-roksal-amber'
                  : 'bg-roksal-green'
            }`}
          />
          <span className="tabular-nums">
            Vrednost (viden seznam): {artikelBeseda(vrednostVidenPregled.artiklov)} · Σ {vrednostVidenPregled.zCeno > 0 ? `${vrednostVidenPregled.vsotaEur.toFixed(2)} EUR` : '—'}
          </span>
          {vrednostVidenPregled.pretecenih > 0 && (
            <span className="rounded-full border border-roksal-amber/40 bg-roksal-amber/10 px-2 py-0.5 text-2xs font-medium text-roksal-amber tabular-nums">
              pretečena {vrednostVidenPregled.pretecenih}
            </span>
          )}
          {vrednostVidenPregled.brezCene > 0 && (
            <span className="rounded-full border border-roksal-red/40 bg-roksal-red/10 px-2 py-0.5 text-2xs font-medium text-roksal-red tabular-nums">
              brez cene {vrednostVidenPregled.brezCene}
            </span>
          )}
        </div>
      )}

      {/* Inventory List */}
      <Card className="animate-fade-in-up transition-all duration-200" style={{ animationDelay: '240ms' }}>
        {/* R175 render vrata: skelet SAMO na prvem loadu (loading && prazno,
            vzorec termini-card R170) — osvežitev ob fokusu ne utripa. */}
        <CardContent className="p-0" aria-busy={loading || undefined}>
          {loading && inventory.length === 0 ? (
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
                    className="group flex flex-col gap-2 px-4 py-3 transition-all duration-200 hover:bg-secondary/20 md:rounded-lg md:border md:border-border/50 md:hover:border-roksal-navy/20 dark:md:hover:border-roksal-ink/20 md:hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-roksal-ink">
                            {item.naziv}
                          </p>
                          {isLow && (
                            <TrendingDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-roksal-red" />
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
                            className="h-7 px-2.5 text-2xs gap-1 border-roksal-red/30 text-roksal-red hover:bg-roksal-red/10 press-scale focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2"
                            onClick={() => handleReorder(item)}
                            /* R217 (P1-f) — dostopnost je RESNICA: gumb ne
                               odpre naročila, ampak KPIRA naročilnico
                               (besedilo za e-pošto/SMS). Vidni napis 'Naroči'
                               ostaja, zaslonski bralnik pa dobi točen
                               dejanje + artikel (brez ugibanja). */
                            aria-label={`Kopiraj naročilnico za artikel ${item.naziv} — besedilo za e-pošto/SMS`}
                          >
                            <ShoppingCart aria-hidden="true" className="h-3 w-3" />
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
                          <p className="text-2xs tabular-nums text-muted-foreground">
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
                        <Badge variant="secondary" className="text-2xs h-5 px-1.5">
                          <Archive aria-hidden="true" className="mr-1 h-2.5 w-2.5" />
                          {typeLabels[item.tip] || item.tip}
                        </Badge>
                        {/* R225 — OSMI signalec konvergence: per-vrstica
                            resnica o nabavni pripravljenosti (EN VIR —
                            _count.prices je na ISTEMU /api/inventory
                            odgovoru od R221, nič nove zahteve). STROGOST
                            dobesedna === 0 — manjkajoči števec NIKOLI ni
                            'brez' (ISTA enačba kot čip R221, zvonček R222,
                            Domov R223, vodja R224). Badge je informativen
                            (sorojeni čip zgoraj počne filtriranje) — dobeseden
                            tekst je hkrati iskren aria-tekst. */}
                        {item._count?.prices === 0 && <BadgeBrezDobavitelja />}
                        <span className="text-2xs text-muted-foreground">
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
                        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-2xs font-semibold text-roksal-ink/70 transition-colors hover:bg-secondary hover:text-roksal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
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
                                        <p className="truncate font-mono text-2xs font-semibold text-roksal-ink">
                                          {lot.lotNumber}
                                        </p>
                                      </div>
                                      <span
                                        className={`shrink-0 text-[9px] font-bold tabular-nums ${st.text}`}
                                      >
                                        {st.label}
                                      </span>
                                    </div>
                                    <div className="mt-1 flex items-center justify-between gap-2 text-2xs text-muted-foreground">
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
                                      <span className="shrink-0 text-2xs font-semibold tabular-nums text-roksal-ink">
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
                onClick={() => { setInvError(null); void loadAll() }}
                className="shrink-0 transition-colors hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
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
          ) : podMinOnly ? (
            /* R220 — iskreno prazno stanje PER čip: pove, KATERI filter je
               prazen (ne generično 'za ta filter' — uporabnik ve, da je
               prazno stanje rezultat čipa, ne manjkajočih podatkov).
               R221 [stil] — ISTA EmptyState družina kot ostali prazni
               seznami (črtkani rob + mehak krog z ikono; teksti NESPREMENJENI
               — le predstavitev se povzdigne na družinski standard). */
            <EmptyState
              icon={Package}
              title="Ni artiklov pod minimalno zalogo v izbranem tipu"
              description="Čip pokaže le artikle, katerih zaloga je pod ali na minimumu."
            />
          ) : naMinOnly ? (
            <EmptyState
              icon={Package}
              title="Ni artiklov točno na minimalni zalogi v izbranem tipu"
              description="Čip pokaže le artikle, katerih zaloga je točno na minimumu."
            />
          ) : brezDobaviteljaOnly ? (
            /* R221 — iskreno prazno stanje tudi za tretji čip + amber ton
               (ISTA družina kot čip — pozornost, ne alarm). */
            <EmptyState
              icon={PackageX}
              tone="amber"
              title="Ni artiklov brez vpisane dobaviteljske cene v izbranem tipu"
              description="Čip pokaže le artikle, za katere ni vpisana cena pri nobenem dobavitelju."
            />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Ni artiklov za ta filter
            </p>
          )}
        </CardContent>
      </Card>

      {/* R325 — 53. člen issue #1 (§5 price history): zgodovina cen
          materiala — čisti bralec /api/material-prices/zgodovina; par =
          material × dobavitelj časovnica + iskrene smeri (narašča/pada/
          stabilna/prvi vpis); CSV gumb = brat izvozne družine. ZERO-MUTACIJA
          (GET samo) — zapis ostane pri POST material-prices (R136 §19). */}
      <CenaZgodovinaPanel />

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
                    className={`rounded-lg border p-2 text-center text-xs font-medium transition-all press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 ${
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
                <p className="text-2xs tabular-nums text-muted-foreground">
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
                className="tabular-nums focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
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
                    <Badge className={`text-2xs h-5 px-1.5 ${movementColors[movementType]}`}>
                      {movementLabels[movementType]}
                    </Badge>
                    <span className="text-2xs tabular-nums text-muted-foreground">
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
              className="focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
            >
              Prekliči
            </Button>
            <Button
              onClick={handleMovement}
              disabled={submitting || !movementInventoryId || !movementQuantity || parseFloat(movementQuantity) <= 0}
              className="bg-roksal-navy hover:bg-roksal-navy/90 text-white shadow-sm transition-all press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Package aria-hidden="true" className="mr-2 h-4 w-4" />
              )}
              Potrdi premik
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* R205 — osnutek naročila dialog (družina premik-dialoga: tokeni, 0 novih
          hex; pregled artiklov = WYSIWYG isti seznam kot odložišče R204;
          dobavitelji R182 fail-verbose trojna veja). */}
      <Dialog open={osnutekOpen} onOpenChange={setOsnutekOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-roksal-ink">Naročilnica kot osnutek naročila</DialogTitle>
            <DialogDescription>
              {osnutekArtikli.length} {zalogaPovzetekBeseda(osnutekArtikli.length)} pod minimumom se shrani med naročila (status OSNUTEK) — sledljivo v Material → Naročila. Nič še ni poslano dobavitelju.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Pregled artiklov (EN VIR količin: narociloKolicina, lib).
                R227 — deseti signalec: vrstica brez VPISANE nabavne cene
                (`_count?.prices === 0` dobesedno — ISTA strogost kot čip
                R221 / zvonček R222 / Domov R223 / vodja R224 / vrstica R225 /
                CSV R226 / naročilnica R227) nosi ISTI badge kot vrstica
                Zaloge (ena definicija BadgeBrezDobavitelja) — pri izbiri
                dobavitelja je vidno, katere postavke naročilni tok ne more
                oceniti. Fail-closed: manjkajoči števec (starejši hint,
                sekanc med deployema) = brez badgea, NIKOLI lažnega. */}
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-border/60 bg-secondary/30 p-2.5 scrollbar-thin">
              {osnutekArtikli.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-roksal-ink">
                    {a.naziv}
                    {a._count?.prices === 0 && <BadgeBrezDobavitelja />}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    naroči {narociloKolicina(a)} {a.enota}
                  </span>
                </div>
              ))}
            </div>

            {/* Dobavitelj — R182 fail-verbose trojna veja */}
            <div className="space-y-1.5">
              <Label className="text-xs">Dobavitelj</Label>
              {dobaviteljiStanje === 'nalagam' ? (
                <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Nalagam dobavitelje…
                </div>
              ) : dobaviteljiStanje === 'napaka' ? (
                <div role="alert" className="space-y-2">
                  <p className="text-xs text-roksal-red">{dobaviteljiNapaka}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void naloziDobavitelje()}
                    className="h-8 gap-1.5 text-[11px] press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                  >
                    Poskusi znova
                  </Button>
                </div>
              ) : dobavitelji.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Ni dobaviteljev — najprej dodaj dobavitelja (Material → Dobavitelji).
                </p>
              ) : (
                <Select value={osnutekDobavitelj} onValueChange={setOsnutekDobavitelj}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Izberite dobavitelja" />
                  </SelectTrigger>
                  <SelectContent>
                    {dobavitelji.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.naziv}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Opombe (neobvezno) */}
            <div className="space-y-1.5">
              <Label htmlFor="osnutek-opombe" className="text-xs">
                Opombe <span className="text-muted-foreground">(neobvezno)</span>
              </Label>
              <Input
                id="osnutek-opombe"
                value={osnutekOpombe}
                onChange={(e) => setOsnutekOpombe(e.target.value)}
                placeholder="npr. dostava do petka"
                className="focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
              />
            </div>

            {/* R243 — vlogo-osveščen vodič v Osnutku (R242 Naročila precedens):
                viden SAMO, ko uporabnik nima procurement.create IN je seznam
                pravic znan. CSV/PDF naročilnica ostajata (odjemalski dokumenti,
                brez vrata — P1-k precedens); pisalna akcija 'Shrani osnutek'
                pa je skrita. */}
            {myPermissions !== null && !lahkoUstvariNarocila && (
              <div
                className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-2xs text-muted-foreground"
                role="note"
                aria-label="Shranjevanje osnutka naročila zahteva pravico"
              >
                Shranjevanje osnutka naročila je pravica{' '}
                <span className="font-semibold text-roksal-ink">procurement.create</span>.
                Naročilnico lahko še vedno prenesete kot CSV ali PDF.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={prenesiNarocilnicoCsv}
              disabled={osnutekArtikli.length === 0}
              className="gap-1.5 press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 disabled:opacity-50"
              aria-label="Prenesi naročilnico vidnih artiklov kot CSV"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              CSV
            </Button>
            <Button
              variant="outline"
              onClick={prenesiOsnutekPdf}
              disabled={osnutekArtikli.length === 0}
              className="gap-1.5 press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 disabled:opacity-50"
              aria-label="Prenesi naročilnico vidnih artiklov kot PDF"
              title="Naročilnica osnutka kot pravi PDF — interni pregled pred pošiljanjem"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => setOsnutekOpen(false)}
              className="focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
            >
              Prekliči
            </Button>
            {lahkoUstvariNarocila && (
              <Button
                onClick={handleShraniOsnutek}
                disabled={osnutekSubmitting || !osnutekDobavitelj || dobaviteljiStanje !== 'ok' || dobavitelji.length === 0}
                className="bg-roksal-navy hover:bg-roksal-navy/90 text-white shadow-sm transition-all press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {osnutekSubmitting ? (
                  <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Shrani osnutek
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// R152: demoInventory IZBRISAN — napaka/prazna zaloga ni več prikazala
// izmišljenih artiklov (fail-open). Zdaj: prazno + vidna napaka.

