'use client'

// Prodajna plošča (deal pipeline) — drag & drop med stopnjami projekta.
// Vir ideje: raziskava forumov — kanban plošča je standard prodajnih CRM
// orodij (Pipedrive/HubSpot vzorec); vodja takoj vidi, kje je katera ponudba,
// in s povleci-spusti premika projekt skozi delovni tok.
// Vsaka sprememba statusa gre prek PATCH /api/projects; strežnik zabeleži
// STATUS_SPREMENJEN v AuditLog (revija sprememb za Post-Signature layer).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToastAction } from '@/components/ui/toast'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  CircleSlash2,
  ClipboardList,
  Euro,
  Factory,
  Hammer,
  Lock,
  MoreVertical,
  Trello,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

type PipeStatus =
  | 'NACRTOVANO'
  | 'V_TEKU'
  | 'ZA_MONTAZO'
  | 'V_IZDELAVI'
  | 'MONTIRANO'
  | 'ZAKLJUCENO'
  | 'USTAVLJENO'

interface PipeProject {
  id: string
  nazivProjekta: string
  status: string
  estimatedPrice: number | null
  followUpDate: string | null
  dealLocked: boolean
  datumMontaze: string | null
  customer?: { ime: string } | null
}

interface PipeColumn {
  id: PipeStatus
  label: string
  icon: LucideIcon
  dot: string
  bar: string
  head: string
  over: string
}

const PIPELINE: PipeColumn[] = [
  { id: 'NACRTOVANO', label: 'Načrtovano', icon: ClipboardList, dot: 'bg-stone-400', bar: 'border-l-stone-400', head: 'from-stone-100', over: 'ring-stone-400/70' },
  { id: 'V_TEKU', label: 'V teku', icon: Hammer, dot: 'bg-amber-500', bar: 'border-l-amber-500', head: 'from-amber-100', over: 'ring-amber-400/70' },
  { id: 'ZA_MONTAZO', label: 'Za montažo', icon: CalendarClock, dot: 'bg-orange-500', bar: 'border-l-orange-500', head: 'from-orange-100', over: 'ring-orange-400/70' },
  { id: 'V_IZDELAVI', label: 'V izdelavi', icon: Factory, dot: 'bg-violet-500', bar: 'border-l-violet-500', head: 'from-violet-100', over: 'ring-violet-400/70' },
  { id: 'MONTIRANO', label: 'Montirano', icon: Wrench, dot: 'bg-teal-500', bar: 'border-l-teal-500', head: 'from-teal-100', over: 'ring-teal-400/70' },
  { id: 'ZAKLJUCENO', label: 'Zaključeno', icon: BadgeCheck, dot: 'bg-emerald-600', bar: 'border-l-emerald-600', head: 'from-emerald-100', over: 'ring-emerald-400/70' },
  { id: 'USTAVLJENO', label: 'Ustavljeno', icon: CircleSlash2, dot: 'bg-rose-400', bar: 'border-l-rose-400', head: 'from-rose-100', over: 'ring-rose-400/70' },
]

function fmtEur(n: number): string {
  return n.toLocaleString('sl-SI', { maximumFractionDigits: 0 }) + ' €'
}

function fmtDate(d: string | null): string | null {
  if (!d) return null
  return new Date(d).toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit' })
}

/** Značka stanja spomnika — poteke/kanča se poudari, prihodnost do 3 dni z merjam. */
function followUpBadge(d: string | null): { label: string; cls: string } | null {
  if (!d) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  if (diff < 0) return { label: `Spomnik zapadel ${Math.abs(diff)} dni`, cls: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800' }
  if (diff === 0) return { label: 'Spomnik DANES', cls: 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800' }
  if (diff <= 3) return { label: `Spomnik čez ${diff} dne`, cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' }
  return null
}

// ---------------------------------------------------------------------------
// Vizual kartice (uporabljen v stolpcu IN v DragOverlay)
// ---------------------------------------------------------------------------

function PipelineCardVisual({
  p,
  col,
  flash,
  menu,
}: {
  p: PipeProject
  col: PipeColumn
  flash?: boolean
  menu?: React.ReactNode
}) {
  const fu = followUpBadge(p.followUpDate)
  const montaza = fmtDate(p.datumMontaze)
  return (
    <div
      className={cn(
        'relative rounded-lg border border-border/70 border-l-4 bg-card p-2.5 pr-6 text-left shadow-sm transition-all duration-200',
        'hover:-translate-y-px hover:shadow-md hover:border-border',
        col.bar,
        flash && 'ring-2 ring-emerald-400 ring-offset-1',
      )}
    >
      <p className="text-[13px] font-semibold leading-tight text-foreground">{p.nazivProjekta}</p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{p.customer?.ime ?? '—'}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        {p.estimatedPrice != null && (
          <span className="text-xs font-bold text-roksal-ink dark:text-roksal-amber">
            {fmtEur(p.estimatedPrice)}
          </span>
        )}
        {p.dealLocked && (
          <span title="Podpis — deal lock" className="inline-flex items-center gap-0.5 text-[10px] font-medium text-roksal-ink dark:text-roksal-amber">
            <Lock className="h-3 w-3" /> podpis
          </span>
        )}
        {montaza && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <CalendarDays className="h-3 w-3" /> {montaza}
          </span>
        )}
      </div>
      {fu && (
        <Badge variant="outline" className={cn('mt-1.5 px-1.5 py-0 text-[10px] font-medium', fu.cls)}>
          {fu.label}
        </Badge>
      )}
      {menu}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Draggable kartica z dropdovnim menijem (dostopna alternativa vlečenju)
// ---------------------------------------------------------------------------

function DraggableCard({
  p,
  col,
  flash,
  busy,
  onStatusChange,
}: {
  p: PipeProject
  col: PipeColumn
  flash: boolean
  busy: boolean
  onStatusChange: (id: string, next: PipeStatus) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: p.id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-label={`Projekt ${p.nazivProjekta}, stopnja ${col.label}. Za premik povlecite kartico ali odprite meni.`}
      className={cn(
        'touch-none select-none rounded-lg transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-amber/70',
        isDragging && 'opacity-35',
        busy && 'animate-pulse',
      )}
    >
      <PipelineCardVisual
        p={p}
        col={col}
        flash={flash}
        menu={
          // Meni mora ustaviti razširjanje pointer dogodka, sicer dnd-kit
          // prične vleči namesto da se odpre meni.
          <div className="absolute right-1 top-1" onPointerDown={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={`Spremeni status projekta ${p.nazivProjekta}`}
                className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-amber/70"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="text-[11px]">Premakni v …</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {PIPELINE.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    disabled={c.id === p.status}
                    onSelect={() => onStatusChange(p.id, c.id)}
                    className="gap-2 text-xs"
                  >
                    <span className={cn('h-2 w-2 rounded-full', c.dot)} />
                    {c.label}
                    {c.id === p.status && <Check className="ml-auto h-3 w-3" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Droppable stolpec
// ---------------------------------------------------------------------------

function PipelineColumn({
  col,
  projects,
  children,
}: {
  col: PipeColumn
  projects: PipeProject[]
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })
  const vsota = useMemo(
    () => projects.reduce((s, p) => s + (p.estimatedPrice ?? 0), 0),
    [projects],
  )
  const Icon = col.icon
  return (
    <div
      ref={setNodeRef}
      aria-label={`Stopnja ${col.label}, ${projects.length} projektov`}
      className={cn(
        'flex w-[228px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border bg-muted/30 transition-all duration-200',
        isOver && cn('ring-2 ring-offset-1 shadow-md', col.over),
      )}
    >
      <div className={cn('flex items-center gap-1.5 bg-gradient-to-r to-transparent px-2.5 py-2', col.head)}>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <span className="text-xs font-semibold">{col.label}</span>
        <Badge variant="secondary" className="ml-auto h-5 min-w-5 rounded-full px-1.5 text-[10px]">
          {projects.length}
        </Badge>
      </div>
      {vsota > 0 && (
        <div className="flex items-center gap-1 px-2.5 pt-1 text-[10px] font-medium text-muted-foreground">
          <Euro className="h-3 w-3" aria-hidden />
          {fmtEur(vsota)}
        </div>
      )}
      <div className="scrollbar-thin flex min-h-[104px] max-h-[300px] flex-1 flex-col gap-2 overflow-y-auto p-2">
        {children}
        {projects.length === 0 && (
          <p
            className={cn(
              'flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/60 py-4 text-center text-[11px] text-muted-foreground/60 transition-colors',
              isOver && 'border-roksal-amber/60 text-roksal-amber',
            )}
          >
            {isOver ? 'Spusti tukaj' : 'Povlecite sem'}
          </p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Glavna komponenta
// ---------------------------------------------------------------------------

export function DealPipeline() {
  const [items, setItems] = useState<PipeProject[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)
  const [customerFilter, setCustomerFilter] = useState<string>('ALL')
  const itemsRef = useRef<PipeProject[]>([])
  const { toast } = useToast()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const loadProjects = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/projects')
      if (res.ok) {
        const data = (await res.json()) as PipeProject[]
        setItems(data)
        itemsRef.current = data
      }
    } catch {
      /* omrežna napaka — pustimo prazno ploščo */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  const handleMove = useCallback(
    async (projectId: string, next: PipeStatus) => {
      const prev = itemsRef.current
      const current = prev.find((x) => x.id === projectId)
      if (!current || current.status === next) return

      // Optimistični premik — takojšen odziv plošče
      const optimistic = prev.map((p) => (p.id === projectId ? { ...p, status: next } : p))
      setItems(optimistic)
      itemsRef.current = optimistic
      setBusyId(projectId)

      try {
        const res = await fetch('/api/projects', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: projectId, status: next }),
        })
        if (!res.ok) throw new Error('strežnik')
        const col = PIPELINE.find((c) => c.id === next)
        const prevCol = PIPELINE.find((c) => c.id === current.status)
        toast({
          title: `Premaknjeno: ${col?.label ?? next}`,
          description: 'Sprememba zabeležena v revijo sprememb.',
          action: (
            <ToastAction
              altText={`Razveljavi premik nazaj na ${prevCol?.label ?? current.status}`}
              onClick={() => void handleMove(projectId, current.status as PipeStatus)}
            >
              Razveljaví
            </ToastAction>
          ),
        })
        setFlashId(projectId)
        setTimeout(() => setFlashId(null), 1800)
      } catch {
        setItems(prev)
        itemsRef.current = prev
        toast({ title: 'Napaka pri premikanju', description: 'Status je povrnjen na prejšnjo vrednost.', variant: 'destructive' })
      } finally {
        setBusyId(null)
      }
    },
    [toast],
  )

  const onDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id))
  }, [])

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveId(null)
      const { active, over } = e
      if (!over) return
      const id = String(active.id)
      const target = String(over.id) as PipeStatus
      const project = itemsRef.current.find((x) => x.id === id)
      if (!project || project.status === target || !PIPELINE.some((c) => c.id === target)) return
      void handleMove(id, target)
    },
    [handleMove],
  )

  const activeProject = activeId ? items.find((p) => p.id === activeId) : null
  const activeCol = activeProject ? PIPELINE.find((c) => c.id === activeProject.status) : null

  // Unikatne stranke za filter plošče (urejeno po imenu, brez duplikatov)
  const stranke = useMemo(
    () =>
      Array.from(
        new Set(items.map((p) => p.customer?.ime).filter((x): x is string => !!x)),
      ).sort((a, b) => a.localeCompare(b, 'sl')),
    [items],
  )

  const vidni = useMemo(
    () =>
      customerFilter === 'ALL' ? items : items.filter((p) => (p.customer?.ime ?? '') === customerFilter),
    [items, customerFilter],
  )

  const grouped = useMemo(() => {
    const map = new Map<PipeStatus, PipeProject[]>()
    for (const col of PIPELINE) map.set(col.id, [])
    for (const p of vidni) {
      const list = map.get(p.status as PipeStatus)
      if (list) list.push(p)
    }
    return map
  }, [vidni])

  const vrednostPonudb = useMemo(
    () =>
      vidni
        .filter((p) => p.status !== 'ZAKLJUCENO' && p.status !== 'USTAVLJENO')
        .reduce((s, p) => s + (p.estimatedPrice ?? 0), 0),
    [vidni],
  )

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trello className="h-4 w-4 shrink-0 text-roksal-amber" aria-hidden />
              Prodajna plošča
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Povlecite projekt na novo stopnjo — sprememba se zabeleži v revijo. Nespremišnjen premik lahko takoj razveljavite.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
            {vrednostPonudb > 0 && (
              <Badge variant="outline" className="gap-1 border-roksal-navy/30 dark:border-roksal-ink/30 text-[11px] text-roksal-ink dark:text-roksal-amber">
                <Euro className="h-3 w-3" aria-hidden />
                {fmtEur(vrednostPonudb)} v obdelavi
              </Badge>
            )}
            {stranke.length > 1 && (
              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger
                  aria-label="Filtriraj ploščo po stranki"
                  className="h-8 w-full min-w-0 text-xs sm:w-[170px] sm:flex-none"
                >
                  <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Vse stranke</SelectItem>
                  {stranke.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={open ? 'Skrči prodajno ploščo' : 'Razpri prodajno ploščo'}
            >
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-roksal-amber border-t-transparent" aria-hidden />
              Nalaganje projektov …
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragCancel={() => setActiveId(null)}
            >
              <div className="scrollbar-thin -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2">
                {PIPELINE.map((col) => (
                  <PipelineColumn key={col.id} col={col} projects={grouped.get(col.id) ?? []}>
                    {(grouped.get(col.id) ?? []).map((p) => (
                      <DraggableCard
                        key={p.id}
                        p={p}
                        col={col}
                        flash={flashId === p.id}
                        busy={busyId === p.id}
                        onStatusChange={(id, next) => void handleMove(id, next)}
                      />
                    ))}
                  </PipelineColumn>
                ))}
              </div>
              <DragOverlay dropAnimation={{ duration: 180 }}>
                {activeProject && activeCol ? (
                  <div className="w-[216px] rotate-2 scale-[1.03] cursor-grabbing opacity-95 shadow-2xl">
                    <PipelineCardVisual p={activeProject} col={activeCol} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </CardContent>
      )}
    </Card>
  )
}
