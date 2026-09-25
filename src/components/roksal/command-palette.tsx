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
import type { Project } from '@/lib/types'
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
  /** Skok na glavni zavihek in/ali "Več" modul. */
  onNavigate: (tab: TabId, more?: MoreTabId | null) => void
  onSync: () => void
}

interface NavItem {
  label: string
  icon: React.ComponentType<{ className?: string }>
  tab: TabId
  more?: MoreTabId | null
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
  { label: 'Logistika (V6)', icon: Truck, tab: 'more', more: 'logistics' },
  { label: 'Izvoz PDF', icon: FileText, tab: 'more', more: 'pdf' },
  { label: 'Galerija realizacij', icon: FolderOpen, tab: 'more', more: 'gallery' },
  { label: 'Katalog profilov', icon: Boxes, tab: 'more', more: 'catalog' },
  { label: 'Dokumenti', icon: FileText, tab: 'more', more: 'documents' },
  { label: 'Tloris', icon: PencilRuler, tab: 'more', more: 'floorplan' },
  { label: 'Varnost', icon: ShieldCheck, tab: 'more', more: 'safety' },
  { label: 'Skice', icon: PencilRuler, tab: 'more', more: 'sketches' },
]

// Zadetki globalnega iskanja (/api/search) — po 5 na vrsto.
interface SearchResults {
  customers: { id: string; ime: string; naslov: string }[]
  inventory: { id: string; naziv: string; sifra: string }[]
  projects: { id: string; nazivProjekta: string; customerIme: string }[]
}

const EMPTY_SEARCH: SearchResults = { customers: [], inventory: [], projects: [] }

// Nedavna iskanja — localStorage kot zunanji store (max 5, najnovejše prej).
// Deterministično: dedup po malih črkah, urejeno po vstavitvi, brez meta
// podatkov. Branje gre prek useSyncExternalStore (pravilno SSR snapshot =
// prazno, brez hydration razlik); pisanje obvesti naročnike.
const RECENT_KEY = 'roksal:recent-searches'
const RECENT_MAX = 5

let recentCache: string[] | null = null
const recentListeners = new Set<() => void>()

function readRecentFromStorage(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((v): v is string => typeof v === 'string' && v.trim().length >= 2)
      .slice(0, RECENT_MAX)
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

function getRecentSnapshot(): string[] {
  if (recentCache === null) recentCache = readRecentFromStorage()
  return recentCache
}

const EMPTY_RECENT: string[] = []
function getRecentServerSnapshot(): string[] {
  return EMPTY_RECENT
}

function writeRecent(next: string[]): void {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // ni prostora / private mode — zgodovina samo v seji, ni napaka
  }
  recentCache = next
  recentListeners.forEach((l) => l())
}

function saveRecentSearch(q: string): void {
  const trimmed = q.trim()
  if (trimmed.length < 2) return
  writeRecent([
    trimmed,
    ...readRecentFromStorage().filter((v) => v.toLowerCase() !== trimmed.toLowerCase()),
  ].slice(0, RECENT_MAX))
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
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<SearchResults>(EMPTY_SEARCH)
  const [searching, setSearching] = useState(false)
  // Nedavna iskanja: localStorage kot zunanji store (brez setState v efektu).
  const recent = useSyncExternalStore(
    subscribeRecent,
    getRecentSnapshot,
    getRecentServerSnapshot
  )

  // Projekte pobere šele ob prvem odprtju — nič nepotreznih zahtev.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetch('/api/projects')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Project[]) => {
        if (!cancelled) setProjects(Array.isArray(data) ? data.slice(0, 25) : [])
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
    onNavigate(item.tab, item.more ?? null)
    close()
  }

  /** Izbor rezultata iskanja = zapiši poizvedbo v zgodovino. */
  function rememberSearch(q: string) {
    saveRecentSearch(q)
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

        {/* R138: nedavna iskanja — samo ob odprti paleti in PRAZNI poizvedbi. */}
        {open && query.trim().length === 0 && recent.length > 0 && (
          <>
            <CommandGroup heading="Nedavna iskanja">
              {recent.map((r) => (
                <CommandItem
                  key={r}
                  value={`nedavno ${r}`}
                  onSelect={() => setQuery(r)}
                >
                  <History className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{r}</span>
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
            <CommandItem key={item.label} onSelect={() => run(item)}>
              <item.icon className="mr-2 h-4 w-4 text-roksal-amber" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>

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

        {searchActive && search.inventory.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={countHeading('Material', search.inventory.length)}>
              {search.inventory.map((m) => (
                <CommandItem
                  key={m.id}
                  value={`${m.naziv} ${m.sifra}`}
                  onSelect={() => {
                    rememberSearch(q)
                    onNavigate('inventory')
                    close()
                  }}
                >
                  <Package className="mr-2 h-4 w-4 text-roksal-amber" />
                  <MatchedText text={m.naziv} q={q} />
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">{m.sifra}</span>
                </CommandItem>
              ))}
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
