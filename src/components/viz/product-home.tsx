'use client'

/**
 * S+5 — PRODUKTNA DOMAČA STRAN.
 * Prvi ekran takoj razloži produkt in pokaže DEJANSKO funkcijo:
 * hero z realno PREJ/POTEM fotografijo (dokazan A-pipeline primer,
 * public/viz-demo/hero-preview.jpg, 13 = 13 letvic — NI stock fotografije).
 *
 * Načrtovanje (spec §3–§5): čisto, premium, arhitekturno, minimalistično —
 * fotografija je glavni element, brez odvečnih gradientov/badge-ov/ikon.
 */

import { Button } from '@/components/ui/button'
import { Camera, ChevronDown, CircleHelp, FlaskConical, Loader2 } from 'lucide-react'
import { BeforeAfter } from './before-after'
import { heroMetrics } from './hero-metrics'
import { useVizStore } from './viz-store'
import { loadDemoProject } from './demo-loader'

const HOW_IT_WORKS = [
  { n: 1, title: 'Fotografirajte balkon', text: 'Naravnost, pri dobri svetlobi.' },
  { n: 2, title: 'Izberite svojo ograjo', text: 'Fotografija vašega izdelka — vzorec in barva ostajata.' },
  { n: 3, title: 'Označite staro ograjo', text: 'Z vlečenjem prsta čez območje stare ograje.' },
  { n: 4, title: 'Oglejte si rezultat', text: 'Takojšen predogled PREJ / POTEM — brez čakanja.' },
] as const

export function ProductHome() {
  const setStep = useVizStore((s) => s.setStep)
  const resetAll = useVizStore((s) => s.resetAll)
  const demoLoading = useVizStore((s) => s.loading.demo)

  function startWizard() {
    resetAll()
    setStep(1)
  }

  function scrollToHow() {
    document.getElementById('kako-deluje')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="pb-6">
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-lg px-4 pt-8 sm:max-w-2xl md:pt-12" aria-labelledby="hero-title">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-roksal-amber">
          Roksal · Vizualizacija ograje
        </p>
        <h1
          id="hero-title"
          className="mt-2 text-[1.65rem] font-bold leading-[1.15] tracking-tight text-roksal-navy sm:text-4xl"
        >
          Preverite, kako bo vaša nova ograja izgledala na vašem domu.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Fotografirajte balkon, izberite svojo ograjo in si oglejte realističen predogled.
        </p>

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <Button
            type="button"
            className="h-12 bg-roksal-amber px-6 text-[15px] font-bold text-white hover:bg-roksal-amber/90"
            onClick={startWizard}
          >
            <Camera className="mr-2 h-5 w-5" aria-hidden="true" />
            Začni z vizualizacijo
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 border-roksal-navy/25 px-5 font-semibold text-roksal-navy hover:bg-roksal-navy/5"
            onClick={scrollToHow}
          >
            <CircleHelp className="mr-2 h-5 w-5" aria-hidden="true" />
            Kako deluje?
          </Button>
        </div>
      </section>

      {/* ── HERO DEMO — realna PREJ/POTEM fotografija ─────────────────────── */}
      <section className="mx-auto mt-8 w-full max-w-lg px-4 sm:max-w-2xl" aria-label="Primer pred in po">
        <div className="rounded-2xl border border-roksal-navy/10 bg-white p-2 shadow-sm">
          <BeforeAfter
            beforeUrl="/viz-demo/balcony.jpg"
            afterUrl="/viz-demo/hero-preview.jpg"
            altBefore="Balkon pred zamenjavo ograje"
            altAfter="Balkon z novoodbrano Roksal ograjo (dejanski rezultat aplikacije)"
            className="h-72 sm:h-[24rem]"
          />
          <p className="px-2 pb-1 pt-2.5 text-center text-[11px] leading-snug text-muted-foreground">
            Dejanski rezultat aplikacije — povlecite, da primerjate{' '}
            <span className="font-semibold text-roksal-navy">PREJ</span> in{' '}
            <span className="font-semibold text-roksal-amber">POTEM</span>.
          </p>
        </div>
        {/* Iskren dokaz (numerika, ne mnenje) — diskretno */}
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Dokazano na tem primeru: {heroMetrics.letviceProduct} = {heroMetrics.letviceResult} letvic ·
          barva ΔE {heroMetrics.chromaDE.toFixed(2)} · deterministična geometrija, brez AI
        </p>
      </section>

      {/* ── KAKO DELUJE ──────────────────────────────────────────────────── */}
      <section
        id="kako-deluje"
        className="mx-auto mt-10 w-full max-w-lg scroll-mt-20 px-4 sm:max-w-2xl"
        aria-labelledby="kako-title"
      >
        <h2 id="kako-title" className="text-lg font-bold text-roksal-navy">
          Kako deluje?
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Štiri korake — manj kot dve minuti.
        </p>
        <ol className="mt-4 divide-y divide-border/70 overflow-hidden rounded-2xl border border-roksal-navy/10 bg-white">
          {HOW_IT_WORKS.map((s) => (
            <li key={s.n} className="flex items-start gap-3 px-4 py-3.5">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-roksal-navy text-xs font-bold text-white"
              >
                {s.n}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-roksal-navy">{s.title}</span>
                <span className="block text-xs leading-snug text-muted-foreground">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>

        {/* Sekundarne akcije */}
        <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="h-11 text-sm font-semibold text-roksal-amber hover:bg-roksal-amber/10 hover:text-roksal-amber"
            onClick={() => void loadDemoProject()}
            disabled={demoLoading}
          >
            {demoLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" aria-hidden="true" />}
            Preizkusite na primeru (brez lastne fotografije)
          </Button>
          <button
            type="button"
            onClick={scrollToHow}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-roksal-navy sm:hidden"
            aria-label="Nazaj na zgornji del strani"
          >
            <ChevronDown className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
            Na vrh
          </button>
        </div>
      </section>
    </div>
  )
}
