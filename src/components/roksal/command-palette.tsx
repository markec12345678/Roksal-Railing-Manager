'use client'

// Roksal — ukazna paleta (⌘K / Ctrl+K)
// ---------------------------------------------------------------------------
// Hiter skok kamorkoli v aplikaciji: zavihki, "Več" moduli, projekti in
// akcije. Zgrajena na obstoječih shadcn primitivih (cmdk + Dialog), brez
// novih odvisnosti. Na terenu monter drži telefon — paleta je predvsem za
// pisarno/desktipo, ampak dela tudi na mobilnem (dolg prst na iskalnik).
//
// R138 (izboljšave iskanja):
//   • Nedavna iskanja (localStorage, max 5, dosledno počisčena ob izbiri)
//   • Označba ujemanja (match highlight) v rezultatih iskanja
//   • Stanje "Iščem …" med debounce/fetch (deterministično, brez mehurčkov)
//   • Števci zadetkov v naslovih skupin (tabular-nums)
//   • Noga s tipkami (↑↓ · ↵ · esc) — namig za nove uporabnike

import { useEffect, useState, useSyncExternalStore } from 'react'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command'
import type { MoreTabId, TabId } from '@/components/roksal/bottom-nav'
import type { MaterialSubTab } from '@/lib/material-sub-tab'
import type { Project } from '@/lib/types'
// R216 — tip artikla za deep-link osnutek (samo TIP; lib ostaja nedotaknjen).
import type { ZalogaArtikelZaNarocilo } from '@/lib/zaloga-povzetek'
// R217 — EN VIR presojanja iskalnega zadetka kot nizke zaloge (fail-closed:
// brez popolnih polj NE trdi nizke zaloge in NE ponudi deep-linka).
// R218 — EN VIR zgodovine z opcijskim žigom (4. signalec konvergence;
// fail-closed: goli niz iz sheme pred R218 = brez žiga, NIKOLI lažni).
import {
  osnutekIzIskanja,
  preberiZgodovinoVnose,
  zdruziZgodovino,
  type IskalniMaterial,
  type RecentSearchVnos,
} from '@/lib/search-osnutek'
import {
  Boxes,
  ClipboardList,
  Compass,
  FileText,
  FolderOpen,
  History,
  Home,
  LayoutDashboard,
  Loader2,
  Package,
  PencilRuler,
  RefreshCw,
  Ruler,
  ScanLine,
  ShieldCheck,
  ShoppingCart,
  Signature,
  Sun,
  Truck,
  Users,
  X,
} from 'lucide-react'
import { useTheme } from 'next-themes'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Skok na glavni zavihek in/ali "Več" modul. R214 — tretji argument
   * subTab: namig za podzavihek Material (isti protokol kot zvonček —
   * MaterialSubTabHint whitelist + monotonski n v page.tsx). R216 —
   * četrti argument osnutek: deep-link artikel (Nizka zaloga klik →
   * Osnutek dialog v Zalogi; page.tsx počisti hint ob drugih navigacijah). */
  onNavigate: (tab: TabId, more?: MoreTabId | null, subTab?: MaterialSubTab | null, osnutek?: ZalogaArtikelZaNarocilo | null) => void
  onSync: () => void
}

interface NavItem {
  label: string
  icon: React.ComponentType<{ className?: string }>
  tab: TabId
  more?: MoreTabId | null
  subTab?: MaterialSubTab
}

const MAIN_NAV: NavItem[] = [
  { label: 'Domov (projekti)', icon: Home, tab: 'dashboard' },
  { label: 'AR kamera', icon: ScanLine, tab: 'ar' },
  { label: 'Slike', icon: Boxes, tab: 'photos' },
  { label: 'Kalkulator', icon: Ruler, tab: 'calculator' },
  { label: 'Meritve', icon: PencilRuler, tab: 'measurements' },
  { label: 'Nagib (libela)', icon: Compass, tab: 'inclinometer' },
  { label: 'Zaloga', icon: Package, tab: 'inventory' },
]

const MORE_NAV: NavItem[] = [
  { label: 'Pregled za vodjo', icon: LayoutDashboard, tab: 'more', more: 'vodja' },
  { label: 'Terenski pregled', icon: ClipboardList, tab: 'more', more: 'teren' },
  { label: 'Merilni studio (brez AI)', icon: Ruler, tab: 'more', more: 'measurement' },
  { label: 'Ponudba s podpisom', icon: Signature, tab: 'more', more: 'signature' },
  { label: 'Post-Signature (V4.1)', icon: ClipboardList, tab: 'more', more: 'postsig' },
  { label: 'CRM stranke (V4.2)', icon: Users, tab: 'more', more: 'crm' },
  { label: 'Material Intelligence (V5)', icon: Truck, tab: 'more', more: 'material' },
  // R214 (P1-f) — direktni podzavihki Materiala (isti MaterialSubTab protokol
  // kot zvonček digest): hijerarhija z zamikom, palette ostane EN vir za skok.
  { label: 'Material — Naročila (V5)', icon: ShoppingCart, tab: 'more', more: 'material', subTab: 'orders' },
  { label: 'Material — Dobavitelji (V5)', icon: Truck, tab: 'more', more: 'material', subTab: 'suppliers' },
  { label: 'Material — BOM Refine (V5)', icon: Boxes, tab: 'more', more: 'material', subTab: 'bom' },
  { label: 'Logistika (V6)', icon: Truck, tab: 'more', more: 'logistics' },
  { label: 'Izvoz PDF', icon: FileText, tab: 'more', more: 'pdf' },
  { label: 'Galerija realizacij', icon: FolderOpen, tab: 'more', more: 'gallery' },
  { label: 'Katalog profilov', icon: Boxes, tab: 'more', more: 'catalog' },
  { label: 'Dokumenti', icon: FileText, tab: 'more', more: 'documents' },
  { label: 'Tloris', icon: PencilRuler, tab: 'more', more: 'floorplan' },
  { label: 'Varnost', icon: ShieldCheck, tab: 'more', more: 'safety' },
  { label: 'Skice', icon: PencilRuler, tab: 'more', more: 'sketches' },
]

// Zadetki globalnega iskanja (/api/search) — po 5 na vrsto. R217 —
// inventory zadetki nosijo opcijska zaloga polja (od R217 API vrača; prejšnji
// odgovori brez njih → fail-closed brez badgea/deep-linka, brez laži).
interface SearchResults {
  customers: { id: string; ime: string; naslov: string }[]
  inventory: IskalniMaterial[]
  projects: { id: string; nazivProjekta: string; customerIme: string }[]
}

const EMPTY_SEARCH: SearchResults = { customers: [], inventory: [], projects: [] }

// Nedavna iskanja — localStorage kot zunanji store (max 5, najnovejše prej).
// Deterministično: dedup po malih črkah, urejeno po vstavitvi. R218 — vnosi
// so {q, nizkaZaloga?} (žig zabeležen ob izboru Material zadetka z osnutkom);
// razčlenjevanje/združevanje gre prek EN VIR lib (fail-closed — shema pred
// R218 in pokvarjen JSON = brez žiga, nič ne pade). Branje gre prek
// useSyncExternalStore (pravilno SSR snapshot = prazno, brez hydration
// razlik); pisanje obvesti naročnike.
const RECENT_KEY = 'roksal:recent-searches'
const RECENT_MAX = 5

let recentCache: RecentSearchVnos[] | null = null
const recentListeners = new Set<() => void>()

function readRecentFromStorage(): RecentSearchVnos[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return preberiZgodovinoVnose(parsed, RECENT_MAX)
  } catch {
    return [] // pokvarjen/nezazen localStorage — nič ne fali, samo brez zgodovine
  }
}

function subscribeRecent(onChange: () => void): () => void {
  recentListeners.add(onChange)
  return () => {
    recentListeners.delete(onChange)
  }
}

function getRecentSnapshot(): RecentSearchVnos[] {
  if (recentCache === null) recentCache = readRecentFromStorage()
  return recentCache
}

const EMPTY_RECENT: RecentSearchVnos[] = []
function getRecentServerSnapshot(): RecentSearchVnos[] {
  return EMPTY_RECENT
}

function writeRecent(next: RecentSearchVnos[]): void {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // ni prostora / private mode — zgodovina samo v seji, ni napaka
  }
  recentCache = next
  recentListeners.forEach((l) => l())
}

/** R218 — žig je opcijski 2. argument (Material zadetek z osnutkom ga
 * zabeleži; stranke/navadni izbori ne). Logika združevanja = EN VIR lib. */
function saveRecentSearch(q: string, nizkaZaloga?: boolean): void {
  writeRecent(zdruziZgodovino(readRecentFromStorage(), q, nizkaZaloga, RECENT_MAX))
}

function clearRecentSearches(): void {
  try {
    window.localStorage.removeItem(RECENT_KEY)
  } catch {
    // ignore — čistilni tok, ni pomembno
  }
  recentCache = []
  recentListeners.forEach((l) => l())
}

/**
 * Razdeli besedilo na [pred, ujemanje, za] glede na poizvedbo (case-insensitive,
 * PRVO ujemanje) — za označbo ujemanja v rezultatih. Brez ujemanja vrne null,
 * kar pomeni "pokaži original".
 */
function splitMatch(
  text: string,
  q: string
): { before: string; hit: string; after: string } | null {
  const t = text.toLowerCase()
  const idx = t.indexOf(q.toLowerCase())
  if (idx === -1) return null
  return {
    before: text.slice(0, idx),
    hit: text.slice(idx, idx + q.length),
    after: text.slice(idx + q.length),
  }
}

/** R218 — EN VIR badgea 'Nizka zaloga' (iskalni Material zadetek + zgodovina
 * iskanj — ISTI vizualni pomen, ENA definicija; roksal-red + obroba = isti
 * družinski stil, brez novih tokenov). */
function BadgeNizkaZaloga() {
  return (
    <span className="ml-1.5 shrink-0 rounded border border-roksal-red/30 bg-roksal-red/10 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-roksal-red">
      Nizka zaloga
    </span>
  )
}

/** Primarni napis z označenim ujemanjem (React text node = XSS varno). */
function MatchedText({ text, q }: { text: string; q: string }) {
  const parts = splitMatch(text, q)
  if (!parts) return <span className="truncate">{text}</span>
  return (
    <span className="truncate">
      {parts.before}
      <mark className="rounded-sm bg-roksal-amber/25 px-0.5 font-medium text-inherit">
        {parts.hit}
      </mark>
      {parts.after}
    </span>
  )
}

export function CommandPalette({ open, onOpenChange, onNavigate, onSync }: CommandPaletteProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [projects, setProjects] = useState<Project[]>([])
  // R215 — nizka zaloga (⌘K kot center ukazov): isti vzorec kot projekti —
  // fetch ob prvem odprtju, izpeljanka iz REALNIH podatkov, skupina vidna LE
  // ko obstajajo artikli pod minimumom (brez lažne prazne skupine).
  // R216 — tip razširjen s sifraMateriala (passthrough za osnutek deep-link:
  // /api/inventory ga vrača že danes — brez novega fetcha, EN VIR).
  const [nizkaZaloga, setNizkaZaloga] = useState<{
    id: string; sifraMateriala: string; naziv: string; kolicinaZaloga: number; minimalnaZaloga: number; enota: string
  }[]>([])
  // R218 (P1-f) — SKUPNO število artiklov pod minimumom (izpeljanka iz
  // ISTIH realnih podatkov kot seznam; seznam ostane top 5, števec pa je
  // ISKREN — pove koliko jih JE, ne koliko jih paleta pokaže).
  const [nizkaZalogaSkupaj, setNizkaZalogaSkupaj] = useState(0)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<SearchResults>(EMPTY_SEARCH)
  const [searching, setSearching] = useState(false)
  // Nedavna iskanja: localStorage kot zunanji store (brez setState v efektu).
  // R218 — vnosi {q, nizkaZaloga?} (glej lib — fail-closed razčlenjevalnik).
  const recent = useSyncExternalStore(
    subscribeRecent,
    getRecentSnapshot,
    getRecentServerSnapshot
  )

  // Projekte in nizko zalogo pobere šele ob prvem odprtju — nič nepotreznih
  // zahtev. R215: OBA fetcha vzporedno (Promise.all — ENA runda).
  useEffect(() => {
    if (!open) return
    let cancelled = false
    Promise.all([
      fetch('/api/projects').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/inventory').then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([projekti, zaloga]: [Project[], { id: string; sifraMateriala: string; naziv: string; kolicinaZaloga: number; minimalnaZaloga: number; enota: string }[]]) => {
        if (cancelled) return
        setProjects(Array.isArray(projekti) ? projekti.slice(0, 25) : [])
        const zalogaArr = Array.isArray(zaloga) ? zaloga : []
        // R218 — ENA izpeljanka, DVA izhoda: seznam top 5 (paleta ne preraste)
        // + skupni števec (iskren heading + 'Vse' povezava ob > 5).
        const pod = zalogaArr.filter((i) => i.kolicinaZaloga <= i.minimalnaZaloga)
        setNizkaZaloga(pod.slice(0, 5))
        setNizkaZalogaSkupaj(pod.length)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [open])

  // Debounced globalno iskanje (250 ms) — strelja šele ob ≥2 znakih.
  // AbortController prekliče prejšnjo zahtevo, če uporabnik še tipa.
  // R138: stanje `searching` = viden indikator "Iščem …" (brez preskakovanja).
  // setState samo znotraj async callbackov (timer/fetch) — efekt telo je čisto.
  useEffect(() => {
    if (!open || query.trim().length < 2) return
    const q = query.trim()
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setSearching(true)
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : EMPTY_SEARCH))
        .then((data: Partial<SearchResults>) => {
          setSearch({
            customers: Array.isArray(data.customers) ? data.customers : [],
            inventory: Array.isArray(data.inventory) ? data.inventory : [],
            projects: Array.isArray(data.projects) ? data.projects : [],
          })
          setSearching(false)
        })
        .catch(() => undefined) // prekinjena zahteva / omrežna napaka — obdrži prejšnje
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, open])

  const searchActive = open && query.trim().length >= 2
  const q = query.trim()
  // Indikator je viden SAMO ob aktivnem iskanju (short-query/close poti ne
  // puščajo zataknjenega stanja — iskanje se res prikaže med fetchem).
  const searchVisible = searchActive && searching

  const totalHits =
    search.customers.length +
    search.inventory.length +
    search.projects.length

  // Naslov skupine s števcem zadetkov (tabular-nums — številke ne preskakujejo).
  const countHeading = (label: string, count: number) => (
    <span className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <span className="tabular-nums text-[10px] font-medium text-muted-foreground/70">
        {count}
      </span>
    </span>
  )

  // Zadetki iskanja projektove razširijo obstoječi "Projekti" seznam —
  // brez duplikatov (primerjava po id).
  const searchProjectHits = searchActive
    ? search.projects.filter((sp) => !projects.some((p) => p.id === sp.id))
    : []

  // Vsa zapiranja gredo skozi close() — s tem počistimo iskanje in se
  // naslednjič odpremo "čisti" (brez setState v efektu).
  function close() {
    setQuery('')
    setSearch(EMPTY_SEARCH)
    setSearching(false)
    onOpenChange(false)
  }

  function run(item: NavItem) {
    onNavigate(item.tab, item.more ?? null, item.subTab ?? null)
    close()
  }

  /** Izbor rezultata iskanja = zapiši poizvedbo v zgodovino. R218 —
   * opcijski žig (Material zadetek z osnutkom ga zabeleži). */
  function rememberSearch(q: string, nizkaZaloga?: boolean) {
    saveRecentSearch(q, nizkaZaloga)
  }

  function selectProject(id: string) {
    onNavigate('dashboard')
    close()
    // Izbor projekta posredujemo prek dogodka — page.tsx posluša.
    window.dispatchEvent(new CustomEvent('roksal:select-project', { detail: id }))
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(o) : close())}
      className="max-w-lg"
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Poišči zavihek, modul, stranko, material ali projekt…"
      />
      {/* R138: indikator iskanja — tanek trak pod iskalnikom, deterministično
          prižgan med debounce/fetch, brez lažnih "ni zadetkov" utripov. */}
      {searchVisible && (
        <div
          className="flex items-center gap-2 border-b px-3 py-1.5 text-xs text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Iščem po projektih, strankah in zalogi …
        </div>
      )}
      <CommandList className="max-h-[60vh] scrollbar-thin">
        <CommandEmpty>
          {searchActive && !searchVisible && totalHits === 0 ? (
            <span>
              Za <span className="font-medium">“{q}”</span> ni zadetkov. Preveri
              črkovanje ali poišči po imenu stranke, materialu ali šifri.
            </span>
          ) : (
            'Ničesar ni bilo najdenega.'
          )}
        </CommandEmpty>

        {/* R138: nedavna iskanja — samo ob odprti paleti in PRAZNI poizvedbi.
            R218 (P1-e): vnos z zabeleženim žigom nosi EN VIR badgea (ISTI
            vizual kot Material zadetek) — ZGODOVINA je 4. signalec, ki poveže
            poizvedbo z naročilnim tokom. Žig je namig: klik zgodovine ponovno
            požene iskanje → badgei iz SVEŽIH podatkov (zgodovina nikoli ne
            trdi stanja zaloge, ki ga ne more vedeti). */}
        {open && query.trim().length === 0 && recent.length > 0 && (
          <>
            <CommandGroup heading="Nedavna iskanja">
              {recent.map((r) => (
                <CommandItem
                  key={r.q}
                  value={`nedavno ${r.q}`}
                  onSelect={() => setQuery(r.q)}
                >
                  <History className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{r.q}</span>
                  {r.nizkaZaloga === true && <BadgeNizkaZaloga />}
                </CommandItem>
              ))}
              <CommandItem
                value="počisti nedavna iskanja"
                onSelect={() => clearRecentSearches()}
                className="text-muted-foreground"
              >
                <X className="mr-2 h-4 w-4" />
                <span className="text-xs">Počisti nedavna iskanja</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Navigacija">
          {MAIN_NAV.map((item) => (
            <CommandItem key={item.label} onSelect={() => run(item)}>
              <item.icon className="mr-2 h-4 w-4 text-roksal-amber" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Več modulov">
          {MORE_NAV.map((item) => (
            <CommandItem
              key={item.label}
              onSelect={() => run(item)}
              className={item.subTab ? 'pl-8' : undefined}
            >
              <item.icon className={item.subTab ? 'mr-2 h-4 w-4 text-roksal-amber/70' : 'mr-2 h-4 w-4 text-roksal-amber'} />
              <span className={item.subTab ? 'text-[13px] text-muted-foreground' : undefined}>
                {item.label}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        {/* R215 — nizka zaloga: skupina vidna LE ko obstajajo artikli pod
            minimumom (izpeljanka iz realnih podatkov — brez lažne prazne
            skupine). R216 — klik → DEEP-LINK: Zaloga + Osnutek dialog z
            TOČNO TIM artikelom (osnutek passthrough — page.tsx centralNavigate;
            monotonski n, stale hint počiščen ob drugih navigacijah).
            R218 (P1-f) — ISKREN heading: števec pove SKUPNO število pod
            minimumom (seznam ostane top 5), ob > 5 pa 'Vse' vrstica →
            navadna navigacija v Zalogo (kjer je vidna celotna slika s
            barvnimi stolpci; dialog je za EN artikel — ne lažemo z
            'vse v enem dialogu').
            Stil: dejanska zaloga v roksal-red (≤ minimum — isti semantični
            pomen kot barvni stolpci v Zalogi, barva ni edini nosilec —
            tudi podnapis pove 'minimum'), številke tabular-nums. */}
        {nizkaZaloga.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={countHeading('Nizka zaloga', nizkaZalogaSkupaj)}>
              {nizkaZaloga.map((i) => (
                <CommandItem
                  key={i.id}
                  value={`nizka zaloga ${i.naziv}`}
                  onSelect={() => {
                    onNavigate('inventory', null, null, {
                      id: i.id,
                      sifraMateriala: i.sifraMateriala,
                      naziv: i.naziv,
                      kolicinaZaloga: i.kolicinaZaloga,
                      enota: i.enota,
                      minimalnaZaloga: i.minimalnaZaloga,
                    })
                    close()
                  }}
                >
                  <Package className="mr-2 h-4 w-4 text-roksal-amber" />
                  <span className="truncate">{i.naziv}</span>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                    Zaloga <span className="font-medium tabular-nums text-roksal-red">{i.kolicinaZaloga}</span> {i.enota} · minimum <span className="tabular-nums">{i.minimalnaZaloga}</span>
                  </span>
                </CommandItem>
              ))}
              {/* R218 (P1-f) — 'Vse' vrstica: samo ko skupno število preseže
                  prikazanih 5 (drugače je vrstica šum). Hijerarhija = R214
                  družina (pl-8 + utišan napis), števec tabular-nums. Klik →
                  navadna navigacija v Zalogo (EN VIR onNavigate — brez
                  osnutka, dialog je za EN artikel). */}
              {nizkaZalogaSkupaj > nizkaZaloga.length && (
                <CommandItem
                  value="nizka zaloga pokaži vse"
                  aria-label={`Pokaži vseh ${nizkaZalogaSkupaj} artiklov s nizko zalogo v Zalogi`}
                  onSelect={() => {
                    onNavigate('inventory')
                    close()
                  }}
                  className="pl-8"
                >
                  <Package className="mr-2 h-4 w-4 text-roksal-amber/70" />
                  <span className="text-[13px] text-muted-foreground">
                    Pokaži vse s nizko zalogo v Zalogi
                  </span>
                  <span className="ml-2 shrink-0 text-xs tabular-nums text-muted-foreground">
                    {nizkaZalogaSkupaj}
                  </span>
                </CommandItem>
              )}
            </CommandGroup>
          </>
        )}

        {(projects.length > 0 || searchProjectHits.length > 0) && (
          <>
            <CommandSeparator />
            <CommandGroup heading={searchActive ? countHeading('Projekti', search.projects.length) : 'Projekti'}>
              {projects.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.nazivProjekta} ${p.customer?.ime ?? ''} ${p.customer?.naslov ?? ''}`}
                  onSelect={() => selectProject(p.id)}
                >
                  <FolderOpen className="mr-2 h-4 w-4 text-muted-foreground" />
                  {searchActive ? <MatchedText text={p.nazivProjekta} q={q} /> : <span className="truncate">{p.nazivProjekta}</span>}
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                    {p.customer?.ime ?? ''}
                  </span>
                </CommandItem>
              ))}
              {searchProjectHits.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.nazivProjekta} ${p.customerIme}`}
                  onSelect={() => selectProject(p.id)}
                >
                  <FolderOpen className="mr-2 h-4 w-4 text-muted-foreground" />
                  <MatchedText text={p.nazivProjekta} q={q} />
                  {p.customerIme && (
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">{p.customerIme}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {searchActive && search.customers.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={countHeading('Stranke', search.customers.length)}>
              {search.customers.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.ime} ${c.naslov}`}
                  onSelect={() => {
                    rememberSearch(q)
                    run({ label: c.ime, icon: Users, tab: 'more', more: 'crm' })
                  }}
                >
                  <Users className="mr-2 h-4 w-4 text-roksal-amber" />
                  <MatchedText text={c.ime} q={q} />
                  <span className="ml-2 shrink-0 truncate text-xs text-muted-foreground">{c.naslov}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* R217 (P1-d) — TRETJI signalec konvergence: Material zadetek pod
            minimumom nosi iskren badge 'Nizka zaloga' + podnapis (ista
            semantika kot R215/R216 skupina: roksal-red na dejanski zalogi,
            barva ni edini nosilec — podnapis pove 'minimum'; številke
            tabular-nums) in klik → deep-link v naročilni tok (Osnutek
            dialog z TOČNO TIM artikelom — centralNavigate 4. argument:
            monotonski n + počistitev v page.tsx). Fail-closed: starejši
            odgovor brez zaloga polj → osnutekIzIskanja vrne null → navadna
            navigacija (obnašanje pred R217, brez lažnega badgea). */}
        {searchActive && search.inventory.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={countHeading('Material', search.inventory.length)}>
              {search.inventory.map((m) => {
                const osnutek = osnutekIzIskanja(m)
                return (
                  <CommandItem
                    key={m.id}
                    value={`${m.naziv} ${m.sifra}`}
                    onSelect={() => {
                      rememberSearch(q, osnutek !== null)
                      if (osnutek) onNavigate('inventory', null, null, osnutek)
                      else onNavigate('inventory')
                      close()
                    }}
                    aria-label={osnutek
                      ? `${m.naziv} — nizka zaloga, odpre naročilni tok`
                      : undefined}
                  >
                    <Package className="mr-2 h-4 w-4 text-roksal-amber" />
                    <MatchedText text={m.naziv} q={q} />
                    {osnutek && <BadgeNizkaZaloga />}
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">{m.sifra}</span>
                    {osnutek && (
                      <span className="ml-2 hidden shrink-0 text-xs text-muted-foreground sm:inline">
                        Zaloga <span className="font-medium tabular-nums text-roksal-red">{osnutek.kolicinaZaloga}</span> {osnutek.enota} · minimum <span className="tabular-nums">{osnutek.minimalnaZaloga}</span>
                      </span>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />

        <CommandGroup heading="Akcije">
          <CommandItem onSelect={() => { onSync(); close() }}>
            <RefreshCw className="mr-2 h-4 w-4 text-roksal-amber" />
            Sinhroniziraj podatke
          </CommandItem>
          <CommandItem onSelect={() => { setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'); close() }}>
            <Sun className="mr-2 h-4 w-4 text-roksal-amber" />
            Preklopi svetlo/temno temo
          </CommandItem>
        </CommandGroup>
      </CommandList>

      {/* R138: noga z namigi tipk — uči brez bralca dokumentacije. */}
      <div
        className="flex items-center justify-between gap-2 border-t px-3 py-2 text-[11px] text-muted-foreground"
        aria-hidden="true"
      >
        <span className="flex items-center gap-1.5">
          <kbd className="rounded border bg-muted px-1 font-sans text-[10px]">↑↓</kbd>
          krmarjenje
          <kbd className="ml-1.5 rounded border bg-muted px-1 font-sans text-[10px]">↵</kbd>
          izbira
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="rounded border bg-muted px-1 font-sans text-[10px]">esc</kbd>
          zapri
        </span>
      </div>
    </CommandDialog>
  )
}
