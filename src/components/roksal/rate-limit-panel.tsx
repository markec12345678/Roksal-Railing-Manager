'use client'

/**
 * R184 (issue #5 — telemetrija omejevanja hitrosti, R181 kandidat d):
 * Vzdrževanje — omejevanje hitrosti.
 *
 * ADMIN površina (Ekipa zavihek, samo pri vlogi ADMIN — isti vzorec kot
 * JobsPanel zraven katerega živi): pokaže števec brute-force zaščite
 * (drseče okno v pomnilniku) na trenutnem primerku strežnika — koliko
 * ključev je aktivnih, koliko zadetkov je v oknih in KOLIKO KRAT je bila
 * zahteva ZAVRJENA (trip = 429). Do zdaj je bila blokada vidna samo
 * napadalcu (429 odgovor) — lastnik je bil slep.
 *
 * Pošteno poročanje (brez lažnih trditev): števeci so v pomnilniku
 * TRENUTNEGA primerka (Vercel serverless = zaščita na primerek) — panel
 * to izrecno pove; prikazuje VZOREC, ne globalnih absolutnih vrednosti.
 * Ključi (IP + e-naslov) se NE prikazujejo — samo kategorija (`login`,
 * `portal`, …) + deterministični krajšani prstni odtis (SHA-256, API).
 *
 * Fail-verbose (vzorec R140/R174/R182/R183): napaka branja se POKAŽE
 * (viden error panel + Poskusi znova), ne tiho prazno stanje — prazno
 * stanje je POGOJENO z !napaka (R182: nikoli lažnega miru nad napako).
 * Pečat svežine (R184 — 19. površina družine R170–R183): čas zadnjega
 * USPEŠNEGA branja /api/security/rate-limit; napaka/omrežje/403 → null
 * (fail-closed — NIČ lažne svežine). EN VIR: casOznaka + družinski hook
 * useRefetchOnFocus (30 s vrata R170) — mount + Osveži + fokus.
 */

import { useCallback, useEffect, useState } from 'react'
import { Download, Gauge, History, Loader2, RefreshCw, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'
import { casOznaka } from '@/lib/osvezitev-fokus'
import { izvozImeDatoteke, telemetrijaCsv } from '@/lib/telemetrija-csv'

// R185 — IZVOZ CSV: panel ponudi MAŠINETNO BERLJIV izvoz TRENUTNEGA stanja
// (ista podatkovna oblika, samo drug izris — brez dodatnega API klica).
// Jedro je čisto (src/lib/telemetrija-csv.ts — determinizem + fail-closed +
// PII zaščita: odtis MORA biti 10-hex, sicer jedro vrže TypeError). Gumb je
// onemogočen, dokler ni uspešno brano stanje (fail-closed: pokvaren/ničen
// odgovor → NI izvoza). Arhiv/poročilo o napadu za lastnika — do zdaj je
// bila telemetrija vidna samo živo na zaslonu.

/** Prenesi CSV lokano (blob + a.download) — brez strežniške poti. */
function prenesiCsv(vsebina: string, ime: string): void {
  const blob = new Blob([vsebina], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = ime
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

interface TripRow {
  kind: string
  keyHash: string
  count: number
  lastAt: number
}

interface TelemetrijaPayload {
  stats: { keys: number; hits: number }
  tripsTotal: number
  trips: TripRow[]
  note: string
  generatedAt: string
}

const dtFmt = new Intl.DateTimeFormat('sl-SI', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/** Kategorija blokade → značka (auth družina = jantar — pozornost; ostalo = nevtralno). */
function kindBadge(kind: string): { label: string; className: string } {
  const authDruzina = ['login', 'demo', 'register', 'setup', 'activate']
  if (authDruzina.includes(kind)) {
    return {
      label: kind,
      className:
        'bg-roksal-amber/15 text-amber-700 ring-1 ring-inset ring-roksal-amber/30 dark:text-roksal-amber',
    }
  }
  // R190 — `write` družina (val 1 omejevanja pisanja): modra = zankasti
  // klient na pisanju (tehnična blokada), ne napad na prijavo (jantar).
  if (kind === 'write') {
    return {
      label: kind,
      className:
        'bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/30',
    }
  }
  return { label: kind, className: 'bg-secondary text-muted-foreground ring-1 ring-inset ring-border' }
}

export function RateLimitPanel() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<TelemetrijaPayload | null>(null)
  const [napaka, setNapaka] = useState<string | null>(null)
  // R184 — pečat svežine: čas zadnjega USPEŠNEGA branja telemetrije (vzorec
  // R170/R177/R178/R180/R181/R182/R183). Napaka/omrežje/403 → null (fail-closed).
  const [omejitveOsvezitev, setOmejitveOsvezitev] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setNapaka(null)
    try {
      const res = await fetch('/api/security/rate-limit')
      const json = (await res.json().catch(() => null)) as (TelemetrijaPayload & { error?: string }) | null
      if (!res.ok) {
        setData(null)
        setNapaka(json?.error ?? `Telemetrije omejevanja hitrosti ni bilo mogoče naložiti (napaka ${res.status})`)
        // R184: fail-closed pečat — napaka → BREZ pečata (v paru s čiščenjem)
        setOmejitveOsvezitev(null)
        return
      }
      if (!json || typeof json.stats?.keys !== 'number' || !Array.isArray(json.trips)) {
        setData(null)
        setNapaka('Neveljaven odgovor strežnika (telemetrija).')
        setOmejitveOsvezitev(null)
        return
      }
      setData({
        stats: { keys: json.stats.keys, hits: json.stats.hits ?? 0 },
        tripsTotal: json.tripsTotal ?? 0,
        trips: json.trips,
        note: json.note ?? '',
        generatedAt: json.generatedAt ?? '',
      })
      // R184: pečat SAMO ob uspešnem branju (1×)
      setOmejitveOsvezitev(new Date())
    } catch {
      setNapaka('Telemetrije omejevanja hitrosti ni bilo mogoče naložiti — preverite povezavo.')
      // R184: omrežje → BREZ pečata (v paru z napako)
      setOmejitveOsvezitev(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // R184 — ponovni bris ob vrnitvi v zavihek (družinski hook, 30 s vrata R170):
  // telemetrija blokad je odvisna od časa — vrnitev v Ekipa zavihek pomeni
  // sveže števce. EN VIR: load = mount + Osveži + fokus.
  useRefetchOnFocus(load)

  const StatCips = () => (
    <div className="mt-2.5 grid grid-cols-3 gap-1.5">
      <div className="rounded-lg border border-border/80 bg-secondary/30 px-2 py-1.5 text-center">
        <p className="text-[15px] font-bold leading-none tabular-nums text-roksal-ink">{data?.stats.keys ?? '—'}</p>
        <p className="mt-1 text-2xs leading-none text-muted-foreground">aktivnih ključev</p>
      </div>
      <div className="rounded-lg border border-border/80 bg-secondary/30 px-2 py-1.5 text-center">
        <p className="text-[15px] font-bold leading-none tabular-nums text-roksal-ink">{data?.stats.hits ?? '—'}</p>
        <p className="mt-1 text-2xs leading-none text-muted-foreground">zadetkov v oknih</p>
      </div>
      <div
        className={`rounded-lg border px-2 py-1.5 text-center ${
          (data?.tripsTotal ?? 0) > 0
            ? 'border-roksal-red/30 bg-roksal-red/5'
            : 'border-border/80 bg-secondary/30'
        }`}
      >
        <p
          className={`text-[15px] font-bold leading-none tabular-nums ${
            (data?.tripsTotal ?? 0) > 0 ? 'text-roksal-red' : 'text-roksal-ink'
          }`}
        >
          {data?.tripsTotal ?? '—'}
        </p>
        <p className="mt-1 text-2xs leading-none text-muted-foreground">blokad skupaj</p>
      </div>
    </div>
  )

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm transition-all hover:shadow-md">
      {/* Glava kartice */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-roksal-navy/10">
            <Gauge className="h-4 w-4 text-roksal-ink" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-[13px] font-bold text-roksal-ink">Vzdrževanje — omejevanje hitrosti</h3>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              <span>Blokade brute-force zaščite — prijava in pisanje po API-ju.</span>
              {omejitveOsvezitev && (
                <span
                  className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"
                  title="Čas zadnje uspešne osvežitve podatkov"
                >
                  <History className="h-3 w-3 shrink-0" aria-hidden="true" />
                  Osveženo ob{' '}
                  <span className="tabular-nums">{casOznaka(omejitveOsvezitev)}</span>
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              // Fail-closed: izvoz SAMO iz uspešno branega stanja (data != null).
              if (!data) return
              try {
                prenesiCsv(telemetrijaCsv(data), izvozImeDatoteke(new Date()))
              } catch {
                // pokvaren odgovor te oblike ne sme ustaviti UI — brez izvoza
                // (stanje na zaslonu je že pokazalo napako prek load)
              }
            }}
            disabled={loading || napaka !== null || !data}
            className="h-8 px-2 transition-colors hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
            aria-label="Izvozi telemetrijo omejevanja hitrosti kot CSV"
            title="Prenesi trenutno telemetrijo (CSV, ločilo ;)"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void load()}
            className="h-8 px-2 focus-visible:ring-roksal-navy/40"
            aria-label="Osveži telemetrijo omejevanja hitrosti"
          >
            <RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Stanja */}
      {loading && !data ? (
        <div className="mt-3 flex items-center justify-center rounded-lg border border-border bg-secondary/30 p-6">
          <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-roksal-amber" />
        </div>
      ) : napaka ? (
        <div
          className="mt-3 flex items-start gap-2 rounded-lg border border-roksal-red/30 bg-roksal-red/5 px-3 py-2.5"
          role="alert"
        >
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-roksal-red" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-roksal-ink">{napaka}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void load()}
            className="h-7 shrink-0 text-2xs transition-colors hover:text-roksal-ink focus-visible:ring-roksal-navy/40"
            aria-label="Ponovno naloži telemetrijo omejevanja hitrosti"
          >
            Poskusi znova
          </Button>
        </div>
      ) : (
        <>
          <StatCips />
          {data && data.trips.length > 0 ? (
            <ul className="mt-2.5 space-y-1" aria-label="Seznam blokadiranih ključev">
              {data.trips.slice(0, 5).map((t) => {
                const badge = kindBadge(t.kind)
                return (
                  <li
                    key={t.keyHash}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-card px-2.5 py-2 transition-colors hover:border-roksal-navy/25 dark:hover:border-roksal-ink/25"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge className={`shrink-0 border-0 font-mono text-2xs font-semibold ${badge.className}`}>
                        {badge.label}
                      </Badge>
                      <code className="truncate font-mono text-2xs text-muted-foreground" title="Prstni odtis ključa (SHA-256, 10 znakov) — ključ ni prikazan">
                        {t.keyHash}
                      </code>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5 text-2xs tabular-nums text-muted-foreground">
                      <span className="font-semibold text-roksal-red">{t.count}×</span>
                      <span>{dtFmt.format(new Date(t.lastAt))}</span>
                    </div>
                  </li>
                )
              })}
              {data.trips.length > 5 && (
                <li className="pt-0.5 text-right text-2xs text-muted-foreground">
                  … in še {data.trips.length - 5} v API-ju (GET /api/security/rate-limit)
                </li>
              )}
            </ul>
          ) : (
            <div className="mt-2.5 rounded-lg border border-border bg-secondary/30 p-4 text-center text-[11px] text-muted-foreground">
              Ni zabeleženih blokad na tem primerku — mirno obdobje.
            </div>
          )}
          {data?.note && (
            <p className="mt-2 text-2xs leading-relaxed text-muted-foreground" title={data.generatedAt}>
              {data.note}
            </p>
          )}
        </>
      )}
    </div>
  )
}
