'use client'

// Roksal — ukazna paleta (⌘K / Ctrl+K)
// ---------------------------------------------------------------------------
// Hiter skok kamorkoli v aplikaciji: zavihki, "Več" moduli, projekti in
// akcije. Zgrajena na obstoječih shadcn primitivih (cmdk + Dialog), brez
// novih odvisnosti. Na terenu monter drži telefon — paleta je predvsem za
// pisarno/desktipo, ampak dela tudi na mobilnem (dolg prst na iskalnik).

import { useEffect, useState } from 'react'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command'
import type { MoreTabId, TabId } from '@/components/roksal/bottom-nav'
import type { Project } from '@/lib/types'
import {
  Boxes,
  ClipboardList,
  Compass,
  FileText,
  FolderOpen,
  Handshake,
  Home,
  LayoutDashboard,
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

export function CommandPalette({ open, onOpenChange, onNavigate, onSync }: CommandPaletteProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [projects, setProjects] = useState<Project[]>([])
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<SearchResults>(EMPTY_SEARCH)

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
  useEffect(() => {
    if (!open || query.trim().length < 2) return
    const q = query.trim()
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : EMPTY_SEARCH))
        .then((data: Partial<SearchResults>) => {
          setSearch({
            customers: Array.isArray(data.customers) ? data.customers : [],
            inventory: Array.isArray(data.inventory) ? data.inventory : [],
            projects: Array.isArray(data.projects) ? data.projects : [],
          })
        })
        .catch(() => undefined) // prekinjena zahteva / omrežna napaka — obdrži prejšnje
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, open])

  const searchActive = open && query.trim().length >= 2

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
    onOpenChange(false)
  }

  function run(item: NavItem) {
    onNavigate(item.tab, item.more ?? null)
    close()
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
      <CommandList className="max-h-[60vh] scrollbar-thin">
        <CommandEmpty>Ničesar ni bilo najdenega.</CommandEmpty>

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
            <CommandGroup heading="Projekti">
              {projects.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.nazivProjekta} ${p.customer?.ime ?? ''} ${p.customer?.naslov ?? ''}`}
                  onSelect={() => selectProject(p.id)}
                >
                  <FolderOpen className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{p.nazivProjekta}</span>
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
                  <span className="truncate">{p.nazivProjekta}</span>
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
            <CommandGroup heading="Stranke">
              {search.customers.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.ime} ${c.naslov}`}
                  onSelect={() => run({ label: c.ime, icon: Users, tab: 'more', more: 'crm' })}
                >
                  <Users className="mr-2 h-4 w-4 text-roksal-amber" />
                  <span className="truncate">{c.ime}</span>
                  <span className="ml-2 shrink-0 truncate text-xs text-muted-foreground">{c.naslov}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {searchActive && search.inventory.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Material">
              {search.inventory.map((m) => (
                <CommandItem
                  key={m.id}
                  value={`${m.naziv} ${m.sifra}`}
                  onSelect={() => { onNavigate('inventory'); close() }}
                >
                  <Package className="mr-2 h-4 w-4 text-roksal-amber" />
                  <span className="truncate">{m.naziv}</span>
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
    </CommandDialog>
  )
}
