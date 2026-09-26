'use client'

// R179 — banner "na voljo je nova verzija" (vzorec PwaStatus pasov):
// ---------------------------------------------------------------------------
// Long-lived tab / PWA okno je med deployi STARE JS (API branja so network-only
// §5 — podatki sveži, a UI koda zastarel). Po vsakem deployu ta komponenta
// (preverba ob mountu + ob vrnitvi v zavihek prek družinskega hooka
// useRefetchOnFocus — 30 s vrata, vzorec R170) primerja vgrajeni build žig
// (NEXT_PUBLIC_BUILD_STAMP) z žigom trenutnega deploya (/api/version) in pokaže
// diskreten pas z gumbom Osveži.
//
// Načela:
//  • Odločitev je ČISTA funkcija (src/lib/posodobitev-jedro.ts) — fail-closed:
//    neznan žig (nastavitvena napaka) → banner ostane SKRIT, nikoli lažnega
//    "nova verzija".
//  • Omrežna napaka → tiho (offline pas PwaStatus že pokriva povezavo);
//    preverba je NASVETNA, ni vir resnice o podatkih.
//  • Skrij na deploy: ključ v localStorage VSEBUJE strežnikov žig —
//    naslednji deploy dobi NOV ključ → pas spet pokrpa. Deterministično.
import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'
import { aliJeNovaVerzijaNaVoljo } from '@/lib/posodobitev-jedro'

/** Build žig TEKUČE seje — vgrajen ob gradnji (next.config env). */
const MOJ_ZIG: string | null = process.env.NEXT_PUBLIC_BUILD_STAMP ?? null

const DISMISS_KEY = 'roksal-update-dismissed-zig'

interface VersionResponse {
  build?: string | null
}

export function UpdateBanner() {
  // streznikovZig != null IN različen od mojega IN ni skrit → pas VIDEN
  const [streznikovZig, setStreznikovZig] = useState<string | null>(null)
  // SSR-varen začetni preber skritega žiga (client komponenta se renda tudi na strežniku)
  const [skritZig, setSkritZig] = useState<string | null>(null)

  // R179 — EN VIR preverbe (ob mountu + ob fokusu prek družinskega hooka).
  // Odločitev je v čistem jedru; tukaj je samo žičenje (vzorec osvezitev-fokus).
  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch('/api/version')
      if (!res.ok) return
      const json = (await res.json().catch(() => null)) as VersionResponse | null
      const zig = typeof json?.build === 'string' && json.build ? json.build : null
      setStreznikovZig(zig)
    } catch {
      // brez mreže — banner tiho ostane skrit; naslednja vrnitev poskusi znova
    }
  }, [])

  useEffect(() => {
    // Začetna preverba + začetni preber skritega žiga v mikrotasku (omejitev
    // pravila set-state-in-effect — vzorec PwaStatus).
    queueMicrotask(() => {
      void checkVersion()
      try {
        setSkritZig(window.localStorage.getItem(DISMISS_KEY))
      } catch {
        // brez dostopa do localStorage (privatni način) — pas ostane viden po zasnovi
      }
    })
  }, [checkVersion])

  useRefetchOnFocus(checkVersion)

  const vidn =
    aliJeNovaVerzijaNaVoljo({ mojZig: MOJ_ZIG, streznikovZig }) &&
    skritZig !== streznikovZig

  if (!vidn) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-1.5 flex items-center gap-2.5 rounded-xl border border-roksal-navy/15 dark:border-roksal-ink/15 bg-card px-3 py-2 shadow-sm"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-roksal-amber/15">
        <RefreshCw className="h-4 w-4 text-roksal-amber" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-roksal-ink leading-tight">
          Na voljo je nova verzija aplikacije.
        </p>
        <p className="text-[10px] text-muted-foreground leading-tight">
          Osvežite za najnovejše funkcije in popravke.
        </p>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="min-h-[32px] shrink-0 rounded-lg bg-roksal-navy px-2.5 text-[11px] font-bold text-white transition-colors hover:bg-roksal-navy/90 active:scale-95 dark:bg-roksal-amber dark:text-roksal-navy dark:hover:bg-roksal-amber/90"
        aria-label="Ponovno naloži aplikacijo za novo verzijo"
      >
        Osveži
      </button>
      <button
        type="button"
        onClick={() => {
          if (!streznikovZig) return
          try {
            window.localStorage.setItem(DISMISS_KEY, streznikovZig)
          } catch {
            // brez localStorage — pas bo ostal viden do osvežitve (izkazano stanje)
          }
          setStreznikovZig(null)
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-roksal-ink"
        aria-label="Skrij obvestilo o novi verziji"
        title="Skrij do naslednje verzije"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
