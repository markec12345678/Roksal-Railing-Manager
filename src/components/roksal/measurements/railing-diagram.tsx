// R340 — dekompozicija measurements-tab FAZA 4 (KOLIZIJA #14: delta prenesena s R339): izluščeno iz
// measurements-tab.tsx BREZ spremembe obnašanja (čist premik, vzorec
// R319/R325/R338 — PrimerjavaDiagram/PredogledIzmerjenih vzorca).
// Telo funkcije je premaknjeno VERBATIM; edina sprememba je izrecni
// `export` + dvig import vrstic na vrh datoteke. Brez 'use client' —
// datoteka živi samo znotraj client drevesa (uvozi jo measurements-tab).

import { formatDimension } from './format'
import { getQuickSpacing } from './normalize'

// ============================================
// RENDERS — RAILING DIAGRAM (obstoječa logika)
// ============================================

export function renderRailingDiagram(dolzina: number, visina: number) {
  const maxDim = Math.max(dolzina, visina)
  const heightPct = Math.min((visina / maxDim) * 40, 40)
  const calc = getQuickSpacing(dolzina, visina)
  const numSlats = Math.min(calc.slatCount, 15)
  const gapWidth = numSlats > 0 ? (dolzina - numSlats * 80) / (numSlats + 1) : 0
  const gapPct = (gapWidth / dolzina) * 100

  return (
    <div className="w-full">
      <div className="relative rounded-lg border border-roksal-navy/20 dark:border-roksal-ink/20 bg-gradient-to-b from-roksal-navy/3 to-roksal-navy/8 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-mono text-muted-foreground">0</span>
            <span className="text-[9px] font-mono text-muted-foreground">{formatDimension(dolzina)}</span>
          </div>
          <div className="relative flex items-end gap-0" style={{ height: `${Math.max(heightPct, 20)}px` }}>
            <div className="w-[4px] h-full bg-roksal-navy rounded-full" />
            <div className="flex-1 flex items-end h-full gap-0">
              {numSlats > 0 ? (
                <div className="flex-1 h-full flex items-end gap-0">
                  <div className="h-full bg-transparent" style={{ width: `${gapPct}%` }} />
                  {Array.from({ length: numSlats }).map((_, i) => (
                    <div key={i} className="flex h-full">
                      <div
                        className="h-[85%] bg-roksal-navy/70 rounded-[1px]"
                        style={{ width: `${(80 / dolzina) * 100}%`, minWidth: '2px' }}
                      />
                      {i < numSlats - 1 && (
                        <div
                          className="h-full bg-roksal-amber/30"
                          style={{ width: `${gapPct}%`, minWidth: '1px' }}
                        />
                      )}
                    </div>
                  ))}
                  <div className="h-full bg-transparent" style={{ width: `${gapPct}%` }} />
                </div>
              ) : (
                <div className="flex-1 h-full border-t-2 border-dashed border-roksal-navy/30 dark:border-roksal-ink/30" />
              )}
            </div>
            <div className="w-[4px] h-full bg-roksal-navy rounded-full" />
          </div>
          <div className="mt-0.5 flex">
            <div className="w-[4px] bg-roksal-navy rounded-full" />
            <div className="flex-1 h-[3px] bg-roksal-navy/40 rounded" />
            <div className="w-[4px] bg-roksal-navy rounded-full" />
          </div>
          <div className="absolute -right-1 top-2 flex items-center gap-0.5">
            <div className="w-[1px] h-4 border-l border-dashed border-muted-foreground/40" />
            <span className="text-3xs font-mono text-muted-foreground">{formatDimension(visina)}</span>
          </div>
        </div>

        {numSlats > 0 && (
          <div
            className={`mt-1.5 flex items-center justify-between rounded-lg px-2.5 py-1.5 text-2xs border ${
              calc.compliant
                ? 'bg-roksal-green/8 border-roksal-green/20 text-roksal-green'
                : 'bg-roksal-red/8 border-roksal-red/20 text-roksal-red'
            }`}
          >
            <span className="font-medium">
              {calc.slatCount} letvev × 80mm = razmik {calc.gap}mm
            </span>
            <span className="font-bold">{calc.compliant ? '✓ SKLADNO' : '✗ NESKLADNO'}</span>
          </div>
        )}
      </div>
    )
  }
