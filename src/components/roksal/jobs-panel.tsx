'use client'

/**
 * R141 (issue #5 §23 — Background jobs): Vzdrževanje — register poslov.
 *
 * ADMIN površina (Ekipa zavihek, samo pri vlogi ADMIN): pokaže registrirane
 * posle (opis pragov), zadnjih N zagonov iz JobRun ledgerja (status, attempts,
 * trajanje, lastnik, correlation ID) in omogoči ročni zagon ("Zaženi zdaj")
 * prek POST /api/jobs/run. Idempotenco drži strežnik (okno = UTC dan):
 * drugi klik istega dne NE dela dvojnega dela — odgovor jasno označi replay.
 *
 * Fail-verbose (R140 vzorec): napaka strežnika se POKAŽE (toast z data.error),
 * ne tiho prazno stanje. Časi številke v tabular-nums, fokus ringi, hover
 * elevation — enoten blagovni jezik (R136–R140 stil pass).
 */

import { useCallback, useEffect, useState } from 'react'
import { Loader2, PlayCircle, RefreshCw, Timer, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface JobRunRow {
  id: string
  type: string
  owner: string
  status: string
  attempts: number
  maxAttempts: number
  lastError: string | null
  correlationId: string
  durationMs: number | null
  createdAt: string
  finishedAt: string | null
  result: Record<string, unknown> | null
}

interface JobsPayload {
  jobs: JobRunRow[]
  registry: { type: string; opis: string }[]
  retryPolicy: { maxAttempts: number; window: string }
}

// R162 stil pass — dark: variante na STATUS chips/napaki/kartici (svetla
// tema NESPREMENJENA; prej je v temni temi kartica ostala bela, FAILED
// chip svetlo rdeč — neberljivo).
const STATUS_CHIP: Record<string, string> = {
  SUCCEEDED: 'bg-roksal-green/10 text-roksal-green ring-1 ring-inset ring-roksal-green/25',
  FAILED: 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-roksal-red/15 dark:text-roksal-red dark:ring-roksal-red/30',
  RUNNING: 'bg-roksal-amber/15 text-amber-700 ring-1 ring-inset ring-roksal-amber/30 dark:text-roksal-amber',
}

const dtFmt = new Intl.DateTimeFormat('sl-SI', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function durationText(ms: number | null): string {
  if (ms === null || Number.isNaN(ms)) return '—'
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}

export function JobsPanel() {
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [data, setData] = useState<JobsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/jobs')
      const json = (await res.json().catch(() => null)) as (JobsPayload & { error?: string }) | null
      if (!res.ok) {
        setData(null)
        setError(json?.error ?? `Napaka ${res.status}`)
        return
      }
      setData({ jobs: json?.jobs ?? [], registry: json?.registry ?? [], retryPolicy: json?.retryPolicy ?? { maxAttempts: 3, window: 'dan' } })
    } catch {
      setError('Napaka pri povezavi s strežnikom')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function runNow() {
    setRunning(true)
    try {
      const res = await fetch('/api/jobs/run', { method: 'POST' })
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; outcomes?: { type: string; status: string; attempts: number }[]; error?: string }
        | null
      if (!res.ok || !json?.ok) {
        // Fail-verbose: pokaži razlog (403/500 s correlationId …), ne ugibaj.
        toast.error(json?.error ?? `Zagon ni uspel (HTTP ${res.status})`)
        return
      }
      const replay = json.outcomes?.filter((o) => o.status === 'REPLAYED' || o.status === 'EXHAUSTED').length ?? 0
      const okCount = json.outcomes?.filter((o) => o.status === 'SUCCEEDED').length ?? 0
      if (replay > 0 && okCount === 0) {
        toast.info(`Posli so ta dan že tekli — replay (ni dvojnega dela)`)
      } else {
        toast.success(`Zagnanih poslov: ${okCount}${replay > 0 ? ` · replay: ${replay}` : ''}`)
      }
      await load()
    } catch {
      toast.error('Napaka pri povezavi s strežnikom')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm transition-all hover:shadow-md">
      {/* Glava kartice */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-roksal-navy/10">
            <Wrench className="h-4 w-4 text-roksal-ink" />
          </div>
          <div>
            <h3 className="text-[13px] font-bold text-roksal-ink">Vzdrževanje — posli v ozadju</h3>
            <p className="text-[11px] text-muted-foreground">
              Čiščenje idempotenčnih ključev, dostopov portala in starih sej. Samodejno dnevno ob 03:30 UTC.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void load()}
            className="h-8 px-2 focus-visible:ring-roksal-navy/40"
            aria-label="Osveži register poslov"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void runNow()}
            disabled={running || loading}
            className="h-8 bg-roksal-navy hover:bg-roksal-navy/90 text-white focus-visible:ring-roksal-navy/40"
          >
            {running ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
            )}
            Zaženi zdaj
          </Button>
        </div>
      </div>

      {/* Register — opisi pragov (isti vir resnice kot strežnik) */}
      {data && data.registry.length > 0 && (
        <ul className="mt-2.5 space-y-1">
          {data.registry.map((j) => (
            <li key={j.type} className="flex items-start gap-1.5 text-[11px] leading-relaxed">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-roksal-amber" aria-hidden="true" />
              <span className="text-muted-foreground">
                <code className="rounded bg-secondary/60 px-1 py-0.5 font-mono text-[10px] text-roksal-ink">{j.type}</code>{' '}
                — {j.opis}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Stanja */}
      {loading ? (
        <div className="mt-3 flex items-center justify-center rounded-lg border border-border bg-secondary/30 p-6">
          <Loader2 className="h-5 w-5 animate-spin text-roksal-amber" />
        </div>
      ) : error ? (
        <div className="mt-3 rounded-lg border border-roksal-red/40 bg-roksal-red/10 px-3 py-2.5 text-[11px] text-roksal-red" role="alert">
          {error} — poskusite osvežiti ali se prijavite kot administrator.
        </div>
      ) : !data || data.jobs.length === 0 ? (
        <div className="mt-3 rounded-lg border border-border bg-secondary/30 p-6 text-center text-[11px] text-muted-foreground">
          Ni še zagonov — prvi zagon ob dnevem cronu (03:30 UTC) ali z gumbom "Zaženi zdaj".
        </div>
      ) : (
        <div className="mt-3 space-y-1.5">
          {data.jobs.slice(0, 8).map((j) => (
            <div
              key={j.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-card px-2.5 py-2 transition-colors hover:border-roksal-navy/25 dark:hover:border-roksal-ink/25"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Badge className={`shrink-0 border-0 text-[10px] font-semibold ${STATUS_CHIP[j.status] ?? 'bg-secondary text-muted-foreground'}`}>
                  {j.status === 'SUCCEEDED' ? 'uspešno' : j.status === 'FAILED' ? 'napaka' : j.status === 'RUNNING' ? 'teče' : j.status}
                </Badge>
                <code className="truncate font-mono text-[11px] text-roksal-ink">{j.type}</code>
                {j.attempts > 1 && (
                  <span className="shrink-0 text-[10px] tabular-nums text-amber-700 dark:text-roksal-amber">
                    poskus {j.attempts}/{j.maxAttempts}
                  </span>
                )}
                {j.lastError && (
                  <span className="hidden truncate text-[10px] text-red-600 dark:text-red-400 sm:inline" title={j.lastError}>
                    {j.lastError}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2.5 text-[10px] tabular-nums text-muted-foreground">
                <span className="hidden items-center gap-1 md:inline-flex" title={`Lastnik: ${j.owner}`}>
                  <Timer className="h-3 w-3" aria-hidden="true" />
                  {durationText(j.durationMs)}
                </span>
                <span>{dtFmt.format(new Date(j.createdAt))}</span>
              </div>
            </div>
          ))}
          <p className="pt-0.5 text-right text-[10px] text-muted-foreground">
            Zadnjih {Math.min(data.jobs.length, 8)} zagonov · retry: {data.retryPolicy.maxAttempts} poskusa na {data.retryPolicy.window}
          </p>
        </div>
      )}
    </div>
  )
}
