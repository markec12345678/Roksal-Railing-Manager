// R321 — dekompozicija calculator-tab (faza 1): izluščeno iz calculator-tab.tsx BREZ spremembe obnašanja (čist premik).
// Samostojen SVG diagram (ročno risana shema, ne lucide ikona);
// edina sprememba je izrecni `export`. Brez use client — samo iz
// client drevesa (kanon R319 measurements faza 1).

// ============================================
// SVG: Baluster diagram (enakomeren razmak)
// ============================================
export function BalusterSvg({
  totalLengthMm,
  balusterWidthMm,
  positions,
  gapMm,
  count,
}: {
  totalLengthMm: number
  balusterWidthMm: number
  positions: number[]
  gapMm: number
  count: number
}) {
  if (totalLengthMm <= 0 || positions.length === 0) {
    return (
      <div className="text-center py-4 text-xs text-muted-foreground">
        Ni podatkov za vizualizacijo.
      </div>
    )
  }

  // SVG dimensions
  const vbW = 1000
  const vbH = 180
  const railTopY = 40
  const railBotY = 130
  const railHeight = 8
  const scale = vbW / totalLengthMm

  // Limit display to avoid overdraw
  const maxDisplay = 60
  const displayPositions = positions.slice(0, maxDisplay)
  const truncated = positions.length > maxDisplay

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Vizualizacija ograje: ${count} palic, razmik ${gapMm.toFixed(1)}mm`}
      >
        {/* Background grid */}
        <defs>
          <pattern id="balGrid" width="50" height="20" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={vbW} height={vbH} fill="url(#balGrid)" />

        {/* Top rail */}
        <rect x="0" y={railTopY - railHeight / 2} width={vbW} height={railHeight} fill="#1d2b3e" />
        {/* Bottom rail */}
        <rect x="0" y={railBotY - railHeight / 2} width={vbW} height={railHeight} fill="#1d2b3e" />

        {/* Left post */}
        <rect x="0" y={railTopY - 12} width="10" height={railBotY - railTopY + 24} fill="#f59e0b" rx="2" />
        {/* Right post */}
        <rect
          x={vbW - 10}
          y={railTopY - 12}
          width="10"
          height={railBotY - railTopY + 24}
          fill="#f59e0b"
          rx="2"
        />

        {/* Balusters */}
        {displayPositions.map((pos, i) => {
          const x = pos * scale
          const w = Math.max(balusterWidthMm * scale, 1.5)
          return (
            <rect
              key={i}
              x={x}
              y={railTopY + railHeight / 2}
              width={w}
              height={railBotY - railTopY - railHeight}
              fill="#1d2b3e"
              opacity="0.85"
            />
          )
        })}

        {/* Gap measurement label */}
        <text
          x={vbW / 2}
          y={vbH - 8}
          textAnchor="middle"
          fontSize="14"
          fill="#1d2b3e"
          fontWeight="bold"
          fontFamily="monospace"
        >
          Razmik: {gapMm.toFixed(1)}mm — {count} palic — skupaj {(totalLengthMm / 1000).toFixed(2)}m
        </text>

        {/* Total length arrow */}
        <line x1="0" y1={railTopY - 18} x2={vbW} y2={railTopY - 18} stroke="#1d2b3e" strokeWidth="0.8" />
        <line x1="0" y1={railTopY - 22} x2="0" y2={railTopY - 14} stroke="#1d2b3e" strokeWidth="0.8" />
        <line
          x1={vbW}
          y1={railTopY - 22}
          x2={vbW}
          y2={railTopY - 14}
          stroke="#1d2b3e"
          strokeWidth="0.8"
        />
        <text
          x={vbW / 2}
          y={railTopY - 24}
          textAnchor="middle"
          fontSize="11"
          fill="#1d2b3e"
          fontFamily="monospace"
        >
          {totalLengthMm.toFixed(0)}mm
        </text>

        {truncated && (
          <text x={vbW - 5} y={vbH - 25} textAnchor="end" fontSize="9" fill="#6b7280">
            (prikazanih prvih {maxDisplay} od {count})
          </text>
        )}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-2xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-[2px] bg-roksal-navy" />
          Palica ({balusterWidthMm}mm)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-2.5 rounded-[2px] bg-roksal-amber" />
          Steber
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-4 bg-roksal-navy" />
          Letev (zgoraj + spodaj)
        </span>
      </div>
    </div>
  )
}
