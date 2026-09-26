'use client'

// R187 — SISTEM — ZDRAVJE kartica (vodja-dashboard; 21. površina živostne
// družine — prva nova po R186 konsolidaciji: ENA vrstica v kanonu
// zivostna-druzina.test.ts + per-površinski opis v rundi).
// ---------------------------------------------------------------------------
// Motiv: /api/public/health (R186) je javna sonda za ZUNANJE monitore, a
// vodja v aplikaciji ni videl stanja baze do trenutka, ko je posamezen seznam
// javil napako. Kartica pokaže ISTI javni odgovor (brez novega API-ja, brez
// sheme): ali baza odgovarja, koliko je trajala preverba (realen odzivni čas
// brskalnika — meritev, ne ugibanje) in kdaj je build narejen ('Zgrajeno' —
// EN VIR zigIzpis, vzorec R185 banner).
//
// Družinska načela (R170-R186, vsaka odstopitev = bug):
//  1. Refetch-on-focus prek družinskega hooka useRefetchOnFocus (30 s vrata)
//     — EN VIR loaderja (mount + 'Poskusi znova' + 'online' dogodek: ko se
//     povezava vrne, se zdravje samodejno preveri — terenski izpad → vrnitev
//     = sveže stanje brez ročnega osveževanja).
//  2. Pečat 'Osveženo ob' = čas zadnjega USPEŠNEGA preverjanja; napaka /
//     omrežje → null (fail-closed — NIČ lažnega zdravja nad napako).
//  3. EN VIR RESNICE: casOznaka() za pečat, zigIzpis() za 'Zgrajeno' —
//     komponenta NE formatiraja časa sama.
//  4. Fail-verbose: neuspešna preverba = viden role=alert panel z razlogom +
//     'Poskusi znova' (hover družina) — nič tihega praznega stanja.
import { useCallback, useEffect, useState } from 'react'
import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'
import { casOznaka } from '@/lib/osvezitev-fokus'
import { zigIzpis } from '@/lib/posodobitev-jedro'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Activity, History, RefreshCw, AlertTriangle } from 'lucide-react'

/** Izsek javnega odgovora /api/public/health (R186) — nič PII. */
interface ZdravjeOdgovor {
  ok: boolean
  db: 'ok' | 'fail'
  build: string | null
  generatedAt?: string
  error?: string
}

export function SistemZdravjeCard() {
  const [data, setData] = useState<ZdravjeOdgovor | null>(null)
  const [napaka, setNapaka] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [odzivMs, setOdzivMs] = useState<number | null>(null)
  const [zgrajeno, setZgrajeno] = useState<string | null>(null)
  const [zdravjeOsvezitev, setZdravjeOsvezitev] = useState<Date | null>(null)

  const load = useCallback(async () => {
    const zacetek = performance.now()
    try {
      const res = await fetch('/api/public/health')
      const json = (await res.json().catch(() => null)) as ZdravjeOdgovor | null
      if (res.ok && json && typeof json === 'object' && json.db === 'ok') {
        setData(json)
        setNapaka(null)
        // R185 banner vzorec: 'Zgrajeno' je NASVETNA podrobnost — pokvaren
        // žig NE razbije pasu (fail-soft izris, fail-closed jedro).
        try {
          setZgrajeno(json.build ? zigIzpis(json.build) : null)
        } catch {
          setZgrajeno(null)
        }
        setOdzivMs(Math.round(performance.now() - zacetek))
        setZdravjeOsvezitev(new Date())
      } else {
        setData(null)
        setZgrajeno(null)
        setNapaka(
          json && typeof json === 'object' && json.error
            ? `Zdravje sistema: ${json.error}`
            : `Zdravja sistema ni bilo mogoče preveriti (napaka ${res.status}).`,
        )
        setZdravjeOsvezitev(null)
      }
    } catch {
      setData(null)
      setZgrajeno(null)
      setNapaka('Zdravja sistema ni bilo mogoče preveriti — preverite povezavo.')
      setZdravjeOsvezitev(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useRefetchOnFocus(load)

  // R187: vrnitev povezave → samodejna preverba (terenski izpad → vrnitev).
  useEffect(() => {
    const onOnline = () => void load()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [load])

  return (
    <Card className="card-hover animate-fade-in-up" style={{ animationDelay: '340ms' }}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-roksal-ink">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Activity className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Sistem — zdravje
            {zdravjeOsvezitev && (
              <span
                className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"
                title="Čas zadnje uspešne osvežitve podatkov"
              >
                <History className="h-3 w-3 shrink-0" aria-hidden="true" />
                Osveženo ob <span className="tabular-nums">{casOznaka(zdravjeOsvezitev)}</span>
              </span>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {napaka && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-2 rounded-lg border border-roksal-red/30 bg-roksal-red/5 px-3 py-2 text-[11px] font-semibold text-roksal-red"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{napaka}</span>
            <button
              type="button"
              onClick={() => void load()}
              aria-label="Ponovno preveri zdravje sistema"
              className="flex items-center gap-1 transition-colors hover:text-roksal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-red/40"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Poskusi znova
            </button>
          </div>
        )}
        {!napaka && loading && (
          <div className="flex items-center gap-2" aria-busy="true">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-36" />
          </div>
        )}
        {!napaka && data && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className="inline-flex items-center gap-1 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:text-green-300"
            >
              Baza odgovarja
            </span>
            {odzivMs != null && (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                Odziv: {odzivMs} ms
              </span>
            )}
            {zgrajeno && (
              <span className="text-[11px] text-muted-foreground">{zgrajeno}</span>
            )}
            <span className="text-[10px] text-muted-foreground/70">
              Javna sonda /api/public/health — pinguje bazo (3 s vrata).
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
