'use client'

// Sledenje ponudbam — follow-up spomniki (runda F, F-1).
// Iz raziskave: ServiceTrade/Jobber — ponudniki, ki sistematično sledijo ponudbam,
// imajo višjo stopnjo odobritve. Vsaka nepodpisana ponudba dobi datum spomnika;
// zapadle so izpostavljene rdeče, hitri gumbi +3/+7 dni.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import {
  FileClock,
  Phone,
  Loader2,
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

const STATUS_LABEL: Record<string, string> = {
  NACRTOVANO: 'Načrtovano',
  V_TEKU: 'V teku',
  ZAKLJUCENO: 'Zaključeno',
  USTAVLJENO: 'Ustavljeno',
}

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
  const [busyId, setBusyId] = useState<string | null>(null)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/projects')
      if (res.ok) {
        const all = (await res.json()) as FollowProject[]
        setProjects(all.filter((p) => !p.dealLocked))
      }
    } catch {
      /* offline */
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
        body: JSON.stringify({
          id,
          followUpDate: date ? date.toISOString() : null,
          ...(opomba !== undefined ? { followUpOpomba: opomba } : {}),
        }),
      })
      if (!res.ok) throw new Error()
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
    } catch {
      toast({ title: 'Napaka', description: 'Spomnika ni bilo mogoče shraniti.', variant: 'destructive' })
    } finally {
      setBusyId(null)
    }
  }

  function plusDays(id: string, days: number) {
    const d = new Date(nowMs + days * 86400000)
    void setFollowUp(id, d, `Pokliči stranko — sledenje ponudbe (+${days} dni)`)
  }

  return (
    <Card className={overdueCount > 0 ? 'border-red-300' : undefined}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-roksal-navy">
          <FileClock className="h-5 w-5 text-roksal-amber" />
          Ponudbe — sledenje
          {overdueCount > 0 && (
            <Badge className="ml-auto bg-red-100 text-red-700 border border-red-300 hover:bg-red-100">
              <AlertTriangle className="mr-1 h-3 w-3" />
              {overdueCount} zapadel{overdueCount === 1 ? '' : 'i'}
            </Badge>
          )}
          {overdueCount === 0 && waitingCount > 0 && (
            <Badge variant="outline" className="ml-auto">
              {waitingCount} brez spomnika
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-5 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Nalagam ponudbe…
          </div>
        ) : pending.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
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
                      ? 'border-red-300 bg-red-50/60'
                      : isSoon
                        ? 'border-amber-300 bg-amber-50/50'
                        : 'border-stone-200 bg-white hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-stone-800">
                        {p.nazivProjekta}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.customer?.ime ?? 'Stranka ni določena'} · {STATUS_LABEL[p.status] ?? p.status}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {due ? (
                        <Badge
                          variant="outline"
                          className={
                            isOverdue
                              ? 'border-red-300 bg-red-100 text-red-700'
                              : isSoon
                                ? 'border-amber-300 bg-amber-100 text-amber-700'
                                : undefined
                          }
                        >
                          <CalendarClock className="mr-1 h-3 w-3" />
                          {isOverdue ? `zapadlo ${fmt(p.followUpDate)}` : `${fmt(p.followUpDate)}`}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-stone-400">
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
                      className={`h-8 ${isOverdue ? 'bg-roksal-navy hover:bg-roksal-navy/90' : ''}`}
                      disabled={busyId === p.id}
                      onClick={() => plusDays(p.id, 0)}
                      title="Spomnik danes"
                    >
                      {busyId === p.id ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Phone className="mr-1 h-3.5 w-3.5" />
                      )}
                      Pokliči {isOverdue ? 'zdaj' : ''}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      disabled={busyId === p.id}
                      onClick={() => plusDays(p.id, 3)}
                    >
                      +3 dni
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      disabled={busyId === p.id}
                      onClick={() => plusDays(p.id, 7)}
                    >
                      +7 dni
                    </Button>
                    <Input
                      type="date"
                      aria-label={`Datum spomnika: ${p.nazivProjekta}`}
                      className="h-8 w-[130px] text-xs"
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
                        className="h-8 w-8 text-stone-400 hover:text-red-500"
                        aria-label={`Odstrani spomnik: ${p.nazivProjekta}`}
                        disabled={busyId === p.id}
                        onClick={() => void setFollowUp(p.id, null)}
                      >
                        <X className="h-4 w-4" />
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
