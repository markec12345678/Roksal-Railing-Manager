'use client'

// Sledenje ponudbam — follow-up spomniki (runda F, F-1).
// Iz raziskave: ServiceTrade/Jobber — ponudniki, ki sistematično sledijo ponudbam,
// imajo višjo stopnjo odobritve. Vsaka nepodpisana ponudba dobi datum spomnika;
// zapadle so izpostavljene rdeče, hitri gumbi +3/+7 dni.
//
// R161:
//  • FAIL-VERBOSE (prej fail-open!): neuspel GET /api/projects je tiho pokazal
//    "Ni aktivnih ponudb … 🎉" — laž, ker seznam sploh ni bil naložen. Zdaj je
//    viden error state z razlogom + gumb "Poskusi znova" (vzorec sessions-dialog).
//  • 🆕 IZVOZ CSV (ponudbe-csv.ts): gumb izvozi TOČNO to, kar je videti na
//    kartici (prvih 12 vrst, isti statusi/stanja spomnika) — pisarniška raba.
//  • STIL pass: trdo kodirane svetle barve (bg-red-50, bg-amber-50, bg-white,
//    text-stone-*) so v temni temi bile neberljive → semantični žetoni
//    (roksal-red/10, roksal-amber/10, bg-card, text-roksal-ink); focus-visible
//    ringi barvno skladni z okolico; dekorativne ikone aria-hidden; datumi
//    tabular-nums.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { buildPonudbeCsv, ponudbeCsvFilename, ponudbeLabel, PONUDBE_STATUS_LABELS } from '@/lib/ponudbe-csv'
import { todayStamp } from '@/lib/csv-export'
import {
  Download,
  FileClock,
  Loader2,
  Phone,
  X,
  CalendarClock,
  AlertTriangle,
} from 'lucide-react'

interface FollowProject {
  id: string
  nazivProjekta: string
  status: string
  dealLocked: boolean
  datumMontaze: string | null
  followUpDate: string | null
  followUpOpomba: string | null
  customer?: { ime: string } | null
}

/** UI črpa besedila iz ISTEGA vira kot izvoz (ponudbe-csv.ts) — R161 refactor. */
const STATUS_LABEL = PONUDBE_STATUS_LABELS

function fmt(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit' })
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86400000)
}

export function QuoteFollowUp() {
  const [projects, setProjects] = useState<FollowProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/projects', { credentials: 'same-origin' })
      if (!res.ok) {
        // Fail-verbose: 401 → seja padla; 5xx → strežnik. NIČ lažnega "vse urejeno".
        setError(
          res.status === 401
            ? 'Prijava je potekla. Ponovno se prijavite.'
            : `Strežnik ni vrnil ponudb (napaka ${res.status}).`,
        )
        setProjects([])
        return
      }
      const all = (await res.json().catch(() => null)) as FollowProject[] | null
      if (!Array.isArray(all)) {
        setError('Neveljaven odgovor strežnika.')
        setProjects([])
        return
      }
      setProjects(all.filter((p) => !p.dealLocked))
    } catch {
      setError('Ni povezave s strežnikom. Preverite omrežje in poskusite znova.')
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const today = useMemo(() => new Date(), [])
  const nowMs = today.getTime()

  const pending = useMemo(() => {
    return projects
      .filter((p) => p.status !== 'ZAKLJUCENO')
      .sort((a, b) => {
        if (a.followUpDate && b.followUpDate) return a.followUpDate.localeCompare(b.followUpDate)
        if (a.followUpDate) return -1
        if (b.followUpDate) return 1
        return a.nazivProjekta.localeCompare(b.nazivProjekta)
      })
      .slice(0, 12)
  }, [projects])

  const overdueCount = useMemo(
    () =>
      pending.filter(
        (p) => p.followUpDate && new Date(p.followUpDate).getTime() <= nowMs,
      ).length,
    [pending, nowMs],
  )
  const waitingCount = useMemo(
    () => pending.filter((p) => !p.followUpDate).length,
    [pending],
  )

  async function setFollowUp(id: string, date: Date | null, opomba?: string) {
    setBusyId(id)
    try {
      const res = await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          id,
          followUpDate: date ? date.toISOString() : null,
          ...(opomba !== undefined ? { followUpOpomba: opomba } : {}),
        }),
      })
      if (!res.ok) throw new Error(`Shranjevanje spomnika ni uspelo (napaka ${res.status}).`)
      setProjects((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, followUpDate: date ? date.toISOString() : null, ...(opomba !== undefined ? { followUpOpomba: opomba } : {}) }
            : p,
        ),
      )
      window.dispatchEvent(new CustomEvent('roksal:refresh'))
      toast({
        title: date ? `Spomnik: ${date.toLocaleDateString('sl-SI')}` : 'Spomnik odstranjen',
      })
    } catch (err) {
      // Fail-verbose: razlog gre v toast, ne tiho spodleteti.
      toast({
        title: 'Napaka',
        description:
          err instanceof Error && err.message !== 'Failed to fetch'
            ? err.message
            : 'Spomnika ni bilo mogoče shraniti. Preverite povezavo in poskusite znova.',
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
    }
  }

  function plusDays(id: string, days: number) {
    const d = new Date(nowMs + days * 86400000)
    void setFollowUp(id, d, `Pokliči stranko — sledenje ponudbe (+${days} dni)`)
  }

  const handleExportCsv = () => {
    if (pending.length === 0) return
    setExporting(true)
    try {
      // Izvozi TOČNO to, kar uporabnik vidi na kartici (prvih 12 vrst).
      const { csv, vrstic } = buildPonudbeCsv(
        pending.map((p) => ({
          nazivProjekta: p.nazivProjekta,
          stranka: p.customer?.ime ?? null,
          status: p.status,
          followUpDate: p.followUpDate,
          followUpOpomba: p.followUpOpomba,
          datumMontaze: p.datumMontaze,
        })),
        todayStamp(today),
      )
      const filename = ponudbeCsvFilename(todayStamp(today))
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast({ title: 'CSV izvožen', description: `Izvožen seznam (${ponudbeLabel(vrstic)}) v datoteko ${filename}.` })
    } catch (err) {
      // Fail-verbose: izvoz ne sme tiho spodleteti — razlog gre v toast.
      toast({
        title: 'Izvoz ni uspel',
        description: err instanceof Error ? err.message : `Neznana napaka (${String(err)}).`,
        variant: 'destructive',
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <Card className={overdueCount > 0 ? 'border-roksal-red/40' : undefined}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-roksal-ink">
          <FileClock className="h-5 w-5 text-roksal-amber" aria-hidden="true" />
          Ponudbe — sledenje
          <span className="ml-auto flex items-center gap-2">
            {overdueCount > 0 && (
              <Badge className="border border-roksal-red/40 bg-roksal-red/15 text-roksal-red hover:bg-roksal-red/15">
                <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
                {overdueCount} zapadel{overdueCount === 1 ? '' : 'i'}
              </Badge>
            )}
            {overdueCount === 0 && waitingCount > 0 && (
              <Badge variant="outline">
                {waitingCount} brez spomnika
              </Badge>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 shrink-0 gap-1.5 text-[11px] focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
              onClick={handleExportCsv}
              disabled={pending.length === 0 || exporting || loading || error !== null}
              aria-label={`Izvozi prikazani seznam ponudb v CSV (${ponudbeLabel(pending.length)})`}
              title="Izvozi prikazani seznam ponudb v CSV"
            >
              {exporting ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-3 w-3" aria-hidden="true" />
              )}
              Izvozi CSV
            </Button>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-5 text-sm text-muted-foreground" aria-busy="true" aria-live="polite">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Nalagam ponudbe…
          </div>
        ) : error ? (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-xl border border-roksal-amber/40 bg-roksal-amber/10 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-roksal-amber" aria-hidden="true" />
              <p className="text-sm text-roksal-ink">{error}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void load()}
              className="shrink-0 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
              aria-label="Ponovno naloži seznam ponudb"
            >
              Poskusi znova
            </Button>
          </div>
        ) : pending.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground" role="status">
            Ni aktivnih ponudb za sledenje — vse zaključene ali podpisane. 🎉
          </p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {pending.map((p) => {
              const due = p.followUpDate ? new Date(p.followUpDate) : null
              const diff = due ? daysBetween(due, today) : null
              const isOverdue = diff !== null && diff <= 0
              const isSoon = diff !== null && diff > 0 && diff <= 3
              return (
                <li
                  key={p.id}
                  className={`rounded-lg border p-2.5 transition-colors ${
                    isOverdue
                      ? 'border-roksal-red/40 bg-roksal-red/10'
                      : isSoon
                        ? 'border-roksal-amber/40 bg-roksal-amber/10'
                        : 'border-border bg-card hover:border-roksal-navy/30 dark:hover:border-roksal-ink/30'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-roksal-ink">
                        {p.nazivProjekta}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.customer?.ime ?? 'Stranka ni določena'} · {STATUS_LABEL[p.status as keyof typeof STATUS_LABEL] ?? p.status}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {due ? (
                        <Badge
                          variant="outline"
                          className={
                            isOverdue
                              ? 'border-roksal-red/40 bg-roksal-red/15 text-roksal-red'
                              : isSoon
                                ? 'border-roksal-amber/40 bg-roksal-amber/15 text-roksal-amber'
                                : undefined
                          }
                        >
                          <CalendarClock className="mr-1 h-3 w-3" aria-hidden="true" />
                          {isOverdue ? `zapadlo ${fmt(p.followUpDate)}` : `${fmt(p.followUpDate)}`}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          brez spomnika
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={isOverdue ? 'default' : 'outline'}
                      className={`h-8 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 ${
                        isOverdue ? 'bg-roksal-navy hover:bg-roksal-navy/90' : ''
                      }`}
                      disabled={busyId === p.id}
                      onClick={() => plusDays(p.id, 0)}
                      title="Spomnik danes"
                    >
                      {busyId === p.id ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Phone className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      Pokliči {isOverdue ? 'zdaj' : ''}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
                      disabled={busyId === p.id}
                      onClick={() => plusDays(p.id, 3)}
                    >
                      +3 dni
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
                      disabled={busyId === p.id}
                      onClick={() => plusDays(p.id, 7)}
                    >
                      +7 dni
                    </Button>
                    <Input
                      type="date"
                      aria-label={`Datum spomnika: ${p.nazivProjekta}`}
                      className="h-8 w-[130px] text-xs tabular-nums"
                      value={p.followUpDate ? p.followUpDate.slice(0, 10) : ''}
                      onChange={(e) => {
                        const v = e.target.value
                        if (!v) {
                          void setFollowUp(p.id, null)
                        } else {
                          const d = new Date(v + 'T09:00:00')
                          if (!isNaN(d.getTime())) void setFollowUp(p.id, d)
                        }
                      }}
                    />
                    {p.followUpDate && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-roksal-red focus-visible:ring-2 focus-visible:ring-roksal-red/40"
                        aria-label={`Odstrani spomnik: ${p.nazivProjekta}`}
                        disabled={busyId === p.id}
                        onClick={() => void setFollowUp(p.id, null)}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
