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
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileDown,
  History,
} from 'lucide-react'
import { toast } from 'sonner'
import { downloadCsv, todayStamp } from '@/lib/csv-export'
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
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 ${
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
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 ${
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
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 ${
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
          className="h-8 shrink-0 gap-1.5 text-[11px] font-medium tabular-nums press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
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
          className="h-8 shrink-0 gap-1.5 text-[11px] font-medium tabular-nums press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
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
          className="h-8 shrink-0 gap-1.5 text-[11px] font-medium tabular-nums press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
          aria-label="Izvozi vidno zalogo kot CSV"
          title="Izvozi vidno zalogo (upošteva filter) kot CSV za Excel"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          CSV
        </Button>
      </div>

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
                            /* R217 (P1-f) — dostopnost je RESNICA: gumb ne
                               odpre naročila, ampak KPIRA naročilnico
                               (besedilo za e-pošto/SMS). Vidni napis 'Naroči'
                               ostaja, zaslonski bralnik pa dobi točen
                               dejanje + artikel (brez ugibanja). */
                            aria-label={`Kopiraj naročilnico za artikel ${item.naziv} — besedilo za e-pošto/SMS`}
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
                    className="h-8 gap-1.5 text-[11px] press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
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
                className="focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={prenesiNarocilnicoCsv}
              disabled={osnutekArtikli.length === 0}
              className="gap-1.5 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 disabled:opacity-50"
              aria-label="Prenesi naročilnico vidnih artiklov kot CSV"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => setOsnutekOpen(false)}
              className="focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
            >
              Prekliči
            </Button>
            <Button
              onClick={handleShraniOsnutek}
              disabled={osnutekSubmitting || !osnutekDobavitelj || dobaviteljiStanje !== 'ok' || dobavitelji.length === 0}
              className="bg-roksal-navy hover:bg-roksal-navy/90 text-white shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-roksal-navy/40 disabled:opacity-50"
            >
              {osnutekSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Shrani osnutek
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// R152: demoInventory IZBRISAN — napaka/prazna zaloga ni več prikazala
// izmišljenih artiklov (fail-open). Zdaj: prazno + vidna napaka.

