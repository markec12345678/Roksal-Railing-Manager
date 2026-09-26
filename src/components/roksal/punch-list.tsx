'use client'

// Prejemni zapisnik (punch list / closeout) — kontrolni seznam pred predajo.
// Pokritje iz raziskave forumov: Kraaft / GoAudits / SnaggingTrack — foto + snags
// + e-podpis → takojšnji PDF. Plus slovenska specifika: ureditev meje z sosedom
// (geodetski zaznam), soglasje sosede, dostop do parcele (vir: moj-geodet.si, allgea.si).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/hooks/use-toast'
import {
  ClipboardCheck,
  Plus,
  Trash2,
  FileDown,
  Loader2,
  AlertTriangle,
  ListChecks,
  Sparkles,
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from '@/lib/pdf-sl-font'
import type { Project } from '@/lib/types'

interface PunchItem {
  id: string
  projectId: string
  naslov: string
  opomba: string | null
  status: 'open' | 'done' | 'issue'
  createdAt: string
}

const STANDARDNE_TOCKE = [
  { naslov: 'Urejena meja z sosedom (geodetski zaznam)', opomba: 'Preveri zaznamovanje meje pred izkopom — vir: ureditev meje, geodet' },
  { naslov: 'Soglasje sosede za montažo ob meji', opomba: 'Po potrebi pisno soglasje, shrani foto' },
  { naslov: 'Preverjena lokacija inštalacij (komunale)', opomba: 'Elektrika, voda, plin, optika — podzemne instalacije' },
  { naslov: 'Dostop do parcele urejen (vrata/ključ)', opomba: 'Dogovor za dostop z opremo' },
  { naslov: 'Montaža zaključena po priklopu', opomba: 'Vse paneli/elementi pravilno prikljenjeni' },
  { naslov: 'Kontrola mer in vodnosti', opomba: 'Vodnost po dolžini, višine po projektu' },
  { naslov: 'Čiščenje terena in odvoz odpadkov', opomba: 'Tereno pospravljeno, embalaža odvozena' },
  { naslov: 'Predaja ključev in dokumentacije', opomba: 'Garancija, navodila, račun' },
]

const STATUS_META: Record<PunchItem['status'], { label: string; className: string }> = {
  open: { label: 'Odprto', className: 'bg-stone-100 text-stone-700 border-stone-300' },
  done: { label: 'Rešeno', className: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
  issue: { label: 'Napaka', className: 'bg-amber-50 text-amber-700 border-amber-300' },
}

export function PunchList({ project }: { project: Project | null }) {
  const [items, setItems] = useState<PunchItem[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [generating, setGenerating] = useState(false)
  const { toast } = useToast()
  const projectIdRef = useRef<string | null>(null)

  const fetchItems = useCallback(async (projectId: string) => {
    projectIdRef.current = projectId
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/punch?projectId=${projectId}`)
      // R155: neuspeh je VIDEN (prej je tiho padel na prazen seznam = utvara
      // "ni točk"; 403 tuj projekt / 404 neznan zdaj od strežnika z razlogom).
      if (!res.ok) {
        const reason = await res.json().catch(() => null)
        setLoadError(
          reason && typeof reason.error === 'string'
            ? reason.error
            : `Nalaganje zapisnika ni uspelo (HTTP ${res.status}).`,
        )
        setItems([])
        return
      }
      setItems((await res.json()) as PunchItem[])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Nalaganje zapisnika ni uspelo.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (project?.id && project.id !== projectIdRef.current) {
      setItems([])
      void fetchItems(project.id)
    }
  }, [project?.id, fetchItems])

  const doneCount = useMemo(() => items.filter((i) => i.status === 'done').length, [items])
  const issueCount = useMemo(() => items.filter((i) => i.status === 'issue').length, [items])
  const progress = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0

  async function addItem(naslov: string, opomba?: string) {
    if (!project) {
      toast({ title: 'Brez projekta', description: 'Izberite projekt v zavihku Domov.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, naslov, opomba: opomba ?? null }),
      })
      // R155: fail-verbose — razlog iz odgovora (403 dostop, 400 validacija).
      if (!res.ok) {
        const reason = await res.json().catch(() => null)
        throw new Error(
          reason && typeof reason.error === 'string'
            ? reason.error
            : `Shranjevanje ni uspelo (HTTP ${res.status}).`,
        )
      }
      const created = (await res.json()) as PunchItem
      setItems((prev) => [...prev, created])
      setNewTitle('')
      toast({ title: 'Točka dodana' })
    } catch (err) {
      toast({
        title: 'Napaka',
        description: err instanceof Error ? err.message : 'Točke ni bilo mogoče dodati.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  async function addStandardPoints() {
    if (!project) return
    setSaving(true)
    try {
      const created: PunchItem[] = []
      let failed = 0
      let firstError: string | null = null
      for (const tocka of STANDARDNE_TOCKE) {
        const res = await fetch('/api/punch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: project.id, naslov: tocka.naslov, opomba: tocka.opomba }),
        })
        // R155: iskren povzetek — nič tiho preskočenih točk.
        if (res.ok) {
          created.push((await res.json()) as PunchItem)
        } else {
          failed += 1
          if (!firstError) {
            const reason = await res.json().catch(() => null)
            firstError =
              reason && typeof reason.error === 'string'
                ? reason.error
                : `HTTP ${res.status}`
          }
        }
      }
      setItems((prev) => [...prev, ...created])
      if (failed === 0) {
        toast({ title: `${created.length} standardnih točk dodanih` })
      } else if (created.length > 0) {
        toast({
          title: `Delno: ${created.length} dodanih, ${failed} ni uspelo`,
          description: firstError ?? undefined,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Napaka',
          description: firstError ?? 'Standardnih točk ni bilo mogoče dodati.',
          variant: 'destructive',
        })
      }
    } catch (err) {
      toast({
        title: 'Napaka',
        description: err instanceof Error ? err.message : 'Standardnih točk ni bilo mogoče dodati.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  async function cycleStatus(item: PunchItem) {
    const next: PunchItem['status'] = item.status === 'open' ? 'done' : item.status === 'done' ? 'issue' : 'open'
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: next } : i)))
    try {
      const res = await fetch('/api/punch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, status: next }),
      })
      if (!res.ok) {
        const reason = await res.json().catch(() => null)
        throw new Error(reason && typeof reason.error === 'string' ? reason.error : `HTTP ${res.status}`)
      }
    } catch (err) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: item.status } : i)))
      toast({
        title: 'Napaka',
        description: err instanceof Error && err.message !== 'Failed to fetch'
          ? `Statusa ni bilo mogoče shraniti — ${err.message}`
          : 'Statusa ni bilo mogoče shraniti.',
        variant: 'destructive',
      })
    }
  }

  async function removeItem(item: PunchItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    try {
      const res = await fetch(`/api/punch?id=${item.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const reason = await res.json().catch(() => null)
        throw new Error(reason && typeof reason.error === 'string' ? reason.error : `HTTP ${res.status}`)
      }
    } catch (err) {
      setItems((prev) => [...prev, item].sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
      toast({
        title: 'Napaka',
        description: err instanceof Error && err.message !== 'Failed to fetch'
          ? `Točke ni bilo mogoče izbrisati — ${err.message}`
          : 'Točke ni bilo mogoče izbrisati.',
        variant: 'destructive',
      })
    }
  }

  function generatePdf() {
    if (!project || items.length === 0) {
      toast({ title: 'Zapisnik je prazen', description: 'Najprej dodajte točke kontrole.', variant: 'destructive' })
      return
    }
    setGenerating(true)
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      registerSloPdfFonts(doc)
      const pageWidth = doc.internal.pageSize.getWidth()

      // Glava
      doc.setFillColor(29, 43, 62)
      doc.rect(0, 0, pageWidth, 26, 'F')
      doc.setTextColor(245, 158, 11)
      doc.setFontSize(16)
      doc.setFont('Roboto', 'bold')
      doc.text('ROKSAL d.o.o.', 14, 11)
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(10)
      doc.setFont('Roboto', 'normal')
      doc.text('Prejemni zapisnik — kontrola pred predajo', 14, 19)
      doc.text(new Date().toLocaleDateString('sl-SI'), pageWidth - 14, 19, { align: 'right' })

      // Podatki o projektu
      doc.setTextColor(17, 24, 39)
      doc.setFontSize(12)
      doc.setFont('Roboto', 'bold')
      doc.text(project.nazivProjekta, 14, 36)
      doc.setFontSize(9)
      doc.setFont('Roboto', 'normal')
      doc.setTextColor(107, 114, 128)
      const customerName = project.customer?.ime ?? '—'
      const monterName = project.monter?.ime ?? '—'
      doc.text(`Naročnik: ${customerName}    Montér: ${monterName}    Status projekta: ${project.status}`, 14, 42)

      const rows = items.map((item, idx) => [
        String(idx + 1),
        item.naslov,
        STATUS_META[item.status].label,
        item.opomba ?? '',
      ])

      autoTable(doc, {
        startY: 48,
        head: [['#', 'Točka kontrole', 'Status', 'Opomba']],
        body: rows,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 2.2, textColor: [17, 24, 39], font: "Roboto" },
        headStyles: { fillColor: [29, 43, 62], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 24 }, 3: { cellWidth: 60 } },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 2) {
            const raw = items[data.row.index]?.status
            if (raw === 'done') data.cell.styles.textColor = [16, 122, 87]
            if (raw === 'issue') {
              data.cell.styles.textColor = [180, 83, 9]
              data.cell.styles.fontStyle = 'bold'
            }
          }
        },
      })

      // Povzetek + podpisni blok
      type WithAuto = jsPDF & { lastAutoTable?: { finalY: number } }
      const finalY = (doc as WithAuto).lastAutoTable?.finalY ?? 120
      let y = Math.min(finalY + 12, 235)
      doc.setFontSize(9)
      doc.setTextColor(17, 24, 39)
      doc.setFont('Roboto', 'normal')
      doc.text(
        `Povzetek: ${doneCount}/${items.length} rešenih, ${issueCount} odprtih napak. Progress: ${progress} %.`,
        14,
        y,
      )

      y += 18
      doc.setDrawColor(120, 120, 120)
      doc.line(14, y, 85, y)
      doc.line(pageWidth - 85, y, pageWidth - 14, y)
      doc.setFontSize(8)
      doc.setTextColor(107, 114, 128)
      doc.text('Izvajalec (datum, podpis)', 14, y + 5)
      doc.text('Naročnik (datum, podpis)', pageWidth - 85, y + 5)

      doc.setFontSize(7)
      doc.text(
        `Zapisnik generiran z aplikacijo Roksal Field — ${new Date().toLocaleString('sl-SI')}`,
        14,
        288,
      )

      doc.save(`zapisnik-${project.nazivProjekta.replace(/\s+/g, '-').toLowerCase()}.pdf`)
      toast({ title: 'Zapisnik pripravljen', description: 'PDF je prenesen.' })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-roksal-navy">
          <ClipboardCheck className="h-5 w-5 text-roksal-amber" />
          Prejemni zapisnik
          {items.length > 0 && (
            <Badge variant="outline" className="ml-auto">
              {doneCount}/{items.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* R155: vidna napaka nalaganja (fail-verbose; vzorec R152/R154). */}
        {loadError && !loading && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-amber-900">Zapisnika ni bilo mogoče naložiti</p>
              <p className="mt-0.5 break-words text-xs text-amber-800">{loadError}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 border-amber-400 text-amber-900 hover:bg-amber-100"
              onClick={() => {
                if (project?.id) void fetchItems(project.id)
              }}
              aria-label="Poskusi znova naložiti zapisnik"
            >
              Poskusi znova
            </Button>
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Nalagam zapisnik…
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="Zapisnik še nima točk"
            description="Dodajte standardne točke kontrole (meja, soglasja, montaža, čiščenje, predaja) ali vnesite lastne."
            tone="amber"
            action={{ label: 'Dodaj standardne točke', onClick: () => void addStandardPoints() }}
          />
        ) : (
          <>
            <div className="space-y-1.5">
              <Progress value={progress} className="h-2" />
              <p className="text-xs tabular-nums text-muted-foreground">
                {doneCount} rešenih · {issueCount} napak · {progress} %
              </p>
            </div>
            <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-2 rounded-lg border border-stone-200 bg-white p-2.5"
                >
                  <button
                    type="button"
                    onClick={() => void cycleStatus(item)}
                    aria-label={`Spremeni status: ${item.naslov}`}
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 outline-none transition-all focus-visible:ring-2 focus-visible:ring-roksal-amber focus-visible:ring-offset-2 ${
                      item.status === 'done'
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : item.status === 'issue'
                          ? 'border-amber-500 bg-amber-100 text-amber-600'
                          : 'border-stone-300 bg-white text-transparent hover:border-roksal-amber'
                    }`}
                  >
                    {item.status === 'done' ? (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : item.status === 'issue' ? (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    ) : null}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-medium ${
                        item.status === 'done' ? 'text-stone-400 line-through' : 'text-stone-800'
                      }`}
                    >
                      {item.naslov}
                    </p>
                    {item.opomba && (
                      <p className="truncate text-xs text-muted-foreground">{item.opomba}</p>
                    )}
                  </div>
                  <Badge variant="outline" className={`hidden sm:inline-flex ${STATUS_META[item.status].className}`}>
                    {STATUS_META[item.status].label}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => void removeItem(item)}
                    aria-label={`Izbriši: ${item.naslov}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-stone-400 outline-none transition-colors hover:bg-red-50 hover:text-red-500 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Nova točka */}
        <div className="flex gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTitle.trim()) void addItem(newTitle.trim())
            }}
            placeholder="Nova točka kontrole…"
            aria-label="Nova točka kontrole"
            maxLength={200}
            className="h-10"
          />
          <Button
            type="button"
            size="icon"
            className="h-10 w-10 shrink-0 bg-roksal-navy hover:bg-roksal-navy/90"
            disabled={!newTitle.trim() || saving}
            onClick={() => void addItem(newTitle.trim())}
            aria-label="Dodaj točko"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {items.length === 0 && !loading && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 border-roksal-amber text-roksal-amber hover:bg-amber-50"
              disabled={saving || !project}
              onClick={() => void addStandardPoints()}
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              Standardne točke
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={items.length === 0 || generating}
            onClick={generatePdf}
          >
            {generating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileDown className="mr-1.5 h-4 w-4" />}
            PDF zapisnik
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
