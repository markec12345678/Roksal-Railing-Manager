// R321 — dekompozicija calculator-tab (faza 1): izluščeno iz calculator-tab.tsx BREZ spremembe obnašanja (čist premik).
// Samostojen SVG diagram (ročno risana shema, ne lucide ikona);
// edina sprememba je izrecni `export`. Brez use client — samo iz
// client drevesa (kanon R319 measurements faza 1).

// ============================================
// SVG: Angled railing diagram (kose / stopnišče)
// ============================================
export function AngledSvg({
  horizontalLengthMm,
  rakeAngleDeg,
  positions,
  balusterWidthMm,
  gapMm,
}: {
  horizontalLengthMm: number
  rakeAngleDeg: number
  positions: number[]
  balusterWidthMm: number
  gapMm: number
}) {
  if (horizontalLengthMm <= 0 || positions.length === 0) {
    return (
      <div className="text-center py-4 text-xs text-muted-foreground">
        Ni podatkov za vizualizacijo.
      </div>
    )
  }

  const rad = (rakeAngleDeg * Math.PI) / 180
  const cosA = Math.cos(rad)
  const sinA = Math.sin(rad)
  const rakeLengthMm = horizontalLengthMm / cosA

  // SVG dimensions
  const vbW = 1000
  const vbH = 220
  // Map horizontal length to viewBox width with padding
  const padX = 60
  const padTop = 30
  const usableW = vbW - 2 * padX
  const usableH = vbH - padTop - 40
  const scale = usableW / horizontalLengthMm

  // Top rail endpoints (horizontal projection)
  const x1 = padX
  const y1 = padTop
  const x2 = padX + horizontalLengthMm * scale
  const y2 = padTop + (horizontalLengthMm * Math.tan(rad)) * scale
  // Clamp y2 to usableH
  const y2Clamped = Math.min(y2, padTop + usableH)
  const y2Actual = y2Clamped

  // Bottom rail (offset by railing height ~1100mm, scaled)
  const railHeightVb = 90
  const x1b = x1
  const y1b = y1 + railHeightVb
  const x2b = x2
  const y2b = y2Actual + railHeightVb

  // Limit display
  const maxDisplay = 60
  const displayPositions = positions.slice(0, maxDisplay)

  // Vector along the rake (unit)
  const rakeVecX = cosA
  const rakeVecY = sinA
  // Perpendicular vector (downward from rake)
  const perpX = -sinA
  const perpY = cosA

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Kose ograja: kot ${rakeAngleDeg.toFixed(1)}°, rake dolžina ${(rakeLengthMm / 1000).toFixed(2)}m`}
      >
        {/* Background grid */}
        <defs>
          <pattern id="angGrid" width="50" height="20" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={vbW} height={vbH} fill="url(#angGrid)" />

        {/* Horizontal projection reference (dashed) */}
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y1}
          stroke="#9ca3af"
          strokeWidth="0.8"
          strokeDasharray="4 3"
        />
        <text x={(x1 + x2) / 2} y={y1 - 6} textAnchor="middle" fontSize="10" fill="#6b7280" fontFamily="monospace">
          horizontal: {(horizontalLengthMm / 1000).toFixed(2)}m
        </text>

        {/* Angle arc */}
        <path
          d={`M ${x1 + 30} ${y1} A 30 30 0 0 1 ${x1 + 30 * cosA} ${y1 + 30 * sinA}`}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="1.2"
        />
        <text
          x={x1 + 42}
          y={y1 + 18}
          fontSize="11"
          fill="#f59e0b"
          fontWeight="bold"
          fontFamily="monospace"
        >
          {rakeAngleDeg.toFixed(1)}°
        </text>

        {/* Top rail (along rake) */}
        <line x1={x1} y1={y1} x2={x2} y2={y2Actual} stroke="#1d2b3e" strokeWidth="6" strokeLinecap="round" />
        {/* Bottom rail */}
        <line x1={x1b} y1={y1b} x2={x2b} y2={y2b} stroke="#1d2b3e" strokeWidth="6" strokeLinecap="round" />

        {/* Left post */}
        <line
          x1={x1}
          y1={y1}
          x2={x1b}
          y2={y1b}
          stroke="#f59e0b"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Right post */}
        <line
          x1={x2}
          y1={y2Actual}
          x2={x2b}
          y2={y2b}
          stroke="#f59e0b"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Balusters (perpendicular to rake) */}
        {displayPositions.map((pos, i) => {
          // Position along rake (in mm), mapped to vb units
          const t = pos / rakeLengthMm
          // Position along the top rail
          const topX = x1 + (x2 - x1) * t
          const topY = y1 + (y2Actual - y1) * t
          // Bottom rail at same t
          const botX = x1b + (x2b - x1b) * t
          const botY = y1b + (y2b - y1b) * t
          return (
            <line
              key={i}
              x1={topX}
              y1={topY}
              x2={botX}
              y2={botY}
              stroke="#1d2b3e"
              strokeWidth={Math.max(balusterWidthMm * scale * 0.6, 1)}
              opacity="0.8"
            />
          )
        })}

        {/* Rake length label */}
        <text
          x={(x1 + x2) / 2 + 20}
          y={(y1 + y2Actual) / 2 + 30}
          textAnchor="middle"
          fontSize="11"
          fill="#1d2b3e"
          fontWeight="bold"
          fontFamily="monospace"
        >
          rake: {(rakeLengthMm / 1000).toFixed(2)}m — razmik {gapMm.toFixed(1)}mm
        </text>

        {/* Reference vectors (small annotation) */}
        <text x="10" y={vbH - 8} fontSize="9" fill="#6b7280" fontFamily="monospace">
          rakeVec = ({rakeVecX.toFixed(2)}, {rakeVecY.toFixed(2)}) — perp = ({perpX.toFixed(2)}, {perpY.toFixed(2)})
        </text>
      </svg>

      <div className="flex flex-wrap items-center justify-center gap-3 text-2xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-[2px] bg-roksal-navy" />
          Palica
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-2.5 rounded-[2px] bg-roksal-amber" />
          Steber
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-4 bg-roksal-navy" />
          Letev (zgoraj + spodaj)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 border-t border-dashed border-roksal-amber" />
          Horizontalna projekcija
        </span>
      </div>
    </div>
  )
}
