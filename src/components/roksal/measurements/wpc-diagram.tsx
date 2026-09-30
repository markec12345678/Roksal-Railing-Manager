// R319 — dekompozicija measurements-tab (faza 1): izluščeno iz measurements-tab.tsx BREZ spremembe obnašanja (čist premik).

import { Badge } from '@/components/ui/badge'
import { Fence, AlertCircle } from 'lucide-react'
import { calcWpcPalice, type Segment } from './shared'

// ============================================
// P3 — KOMPONENTA: WpcDiagram (SVG orientacije)
// ============================================

export function WpcDiagram({
  orientacija,
  dolzinaMm,
  visinaMm,
  sirinaPalice,
  debelinaPalice,
  razmikPalic,
  kotPosevnih,
}: {
  orientacija: Segment['type']
  dolzinaMm: number
  visinaMm: number
  sirinaPalice: number
  debelinaPalice: number
  razmikPalic: number
  kotPosevnih: number
}) {
  const stPalic = calcWpcPalice(
    orientacija,
    dolzinaMm,
    visinaMm,
    sirinaPalice,
    razmikPalic
  )
  const w = 280
  const h = 160
  const margin = 12
  const innerW = w - margin * 2
  const innerH = h - margin * 2 - 18

  // koliko palic narišemo
  const maxDraw = Math.min(stPalic, 14)
  const korak = sirinaPalice + razmikPalic
  // dimenzije v px
  let paliceCoords: Array<{ x: number; y: number; w: number; h: number }> = []
  if (orientacija === 'WPC_POKOCNE') {
    // navpične palice
    for (let i = 0; i < maxDraw; i++) {
      const x = margin + (i * korak / korak) * (innerW / Math.max(maxDraw, 1))
      paliceCoords.push({
        x: margin + (innerW / Math.max(maxDraw, 1)) * i + 2,
        y: margin,
        w: Math.max(3, sirinaPalice / korak * (innerW / Math.max(maxDraw, 1)) - 4),
        h: innerH,
      })
    }
  } else if (orientacija === 'WPC_VODORAVNE') {
    for (let i = 0; i < maxDraw; i++) {
      paliceCoords.push({
        x: margin,
        y: margin + (innerH / Math.max(maxDraw, 1)) * i + 2,
        w: innerW,
        h: Math.max(2, sirinaPalice / korak * (innerH / Math.max(maxDraw, 1)) - 4),
      })
    }
  } else if (orientacija === 'WPC_POSEVNE') {
    // poševne pod kotom — nariši kot mrežo diagonal
    const angle = (kotPosevnih * Math.PI) / 180
    const numX = Math.min(Math.ceil(Math.sqrt(maxDraw)), 7)
    const numY = Math.min(Math.ceil(maxDraw / numX), 7)
    for (let j = 0; j < numY; j++) {
      for (let i = 0; i < numX; i++) {
        const idx = j * numX + i
        if (idx >= maxDraw) break
        const cx = margin + (innerW / numX) * (i + 0.5)
        const cy = margin + (innerH / numY) * (j + 0.5)
        const len = Math.min(innerW / numX, innerH / numY) * 0.6
        // palica kot rotirani pravokotnik (prikazana kot črta z debelino)
        paliceCoords.push({ x: cx, y: cy, w: len, h: Math.max(3, debelinaPalice / 23 * 4) })
      }
    }
  }

  const orientacijaLabel =
    orientacija === 'WPC_POKOCNE'
      ? 'Pokončne (vertikalne)'
      : orientacija === 'WPC_VODORAVNE'
        ? 'Vodoravne (horizontalne)'
        : `Poševne (${kotPosevnih}°)`

  return (
    <div className="rounded-lg border border-roksal-amber/40 bg-roksal-amber/10 p-2 slide-in-right">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Fence aria-hidden="true" className="h-3.5 w-3.5 text-roksal-amber" />
          <span className="text-[11px] font-semibold text-roksal-ink">{orientacijaLabel}</span>
        </div>
        <Badge variant="outline" className="text-[9px] h-4 px-1 border-roksal-amber/40 text-roksal-ink">
          {stPalic} palic
        </Badge>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto"
        role="img"
        aria-label={`WPC diagram — ${orientacijaLabel}`}
      >
        {/* okvir (ograjje) — navy */}
        <rect
          x={margin}
          y={margin}
          width={innerW}
          height={innerH}
          fill="none"
          stroke="#1d2b3e"
          strokeWidth="2"
          rx="2"
        />
        {/* Palice */}
        {orientacija === 'WPC_POSEVNE'
          ? paliceCoords.map((p, i) => {
              // rotirana palica kot debela črta
              const angle = (kotPosevnih * Math.PI) / 180
              const dx = (p.w / 2) * Math.cos(angle)
              const dy = (p.w / 2) * Math.sin(angle)
              return (
                <line
                  key={i}
                  x1={p.x - dx}
                  y1={p.y - dy}
                  x2={p.x + dx}
                  y2={p.y + dy}
                  stroke="#f59e0b"
                  strokeWidth={Math.max(3, p.h)}
                  strokeLinecap="round"
                  opacity={0.8}
                />
              )
            })
          : paliceCoords.map((p, i) => (
              <rect
                key={i}
                x={p.x}
                y={p.y}
                width={p.w}
                height={p.h}
                fill="#1d2b3e"
                fillOpacity={0.7}
                rx="0.5"
              />
            ))}
        {/* dimenzije (amber) */}
        <text x={margin} y={h - 4} fill="#f59e0b" fontSize="9" fontWeight="bold">
          ↔ {Math.round(dolzinaMm)}mm
        </text>
        <text x={w - margin} y={h - 4} fill="#f59e0b" fontSize="9" fontWeight="bold" textAnchor="end">
          ↕ {Math.round(visinaMm)}mm
        </text>
      </svg>
      <div className="mt-1 flex items-center justify-between text-[9px] text-muted-foreground">
        <span>Št. palic: {stPalic} kos</span>
        <span className="font-mono">
          WPC {sirinaPalice}×{debelinaPalice}mm, razmak {razmikPalic}mm
        </span>
      </div>
      {stPalic > maxDraw && (
        <p className="text-[9px] text-muted-foreground text-center mt-0.5">
          (prikazanih prvih {maxDraw} palic)
        </p>
      )}
      {razmikPalic > 110 && (
        <p className="text-[9px] text-roksal-ink mt-0.5 text-center">
          <AlertCircle aria-hidden="true" className="inline h-2.5 w-2.5 mr-0.5 text-roksal-amber" />
          Razmik {razmikPalic}mm presega 110mm — preveri predpise!
        </p>
      )}
    </div>
  )
}
