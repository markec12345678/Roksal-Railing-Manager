// R319 — dekompozicija measurements-tab (faza 1): izluščeno iz measurements-tab.tsx BREZ spremembe obnašanja (čist premik).

// ============================================
// P3 — KOMPONENTA: StairDiagram (SVG)
// ============================================

export function StairDiagram({
  stStopnic,
  visinaPosamezne,
  globinaStopnice,
  kotStopinje,
}: {
  stStopnic: number
  visinaPosamezne: number
  globinaStopnice: number
  kotStopinje: number
}) {
  // omejimo število narisanih stopnic za berljivost
  const maxDraw = Math.min(stStopnic, 12)
  const w = 320
  const h = 180
  const margin = 16
  const usableW = w - margin * 2
  const usableH = h - margin * 2 - 24 // prostor za oznake
  const stepW = usableW / maxDraw
  const stepH = (visinaPosamezne / globinaStopnice) * stepW
  const totalH = stepH * maxDraw
  const scaleY = Math.min(1, usableH / totalH) // če preveliko, skrčimo
  const drawStepH = stepH * scaleY
  const drawTotalH = drawStepH * maxDraw
  const baseY = margin + usableH // spodaj
  // Ograja ob strani (navy line)
  const railX1 = margin
  const railY1 = baseY - drawTotalH - 8
  const railX2 = w - margin
  const railY2 = baseY

  return (
    <div className="rounded-lg border border-border/50 bg-gradient-to-br from-roksal-navy/5 to-roksal-amber/5 p-2">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto"
        role="img"
        aria-label="Diagram stopnišča"
      >
        {/* Ograja (poševna) */}
        <line
          x1={railX1}
          y1={railY1}
          x2={railX2}
          y2={railY2}
          stroke="#1d2b3e"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <line
          x1={railX1}
          y1={railY1 - 4}
          x2={railX2}
          y2={railY2 - 4}
          stroke="#1d2b3e"
          strokeWidth="1.5"
          strokeDasharray="3,2"
          opacity={0.5}
        />
        {/* Stopnice (pravokotniki) */}
        {Array.from({ length: maxDraw }).map((_, i) => {
          const x = margin + i * stepW
          const yTop = baseY - (i + 1) * drawStepH
          return (
            <g key={i}>
              <rect
                x={x}
                y={yTop}
                width={stepW}
                height={drawStepH}
                fill="#1d2b3e"
                fillOpacity={0.12 + (i / maxDraw) * 0.15}
                stroke="#1d2b3e"
                strokeWidth="0.8"
              />
              {/* horizontalna površina stopnice */}
              <line
                x1={x}
                y1={yTop}
                x2={x + stepW}
                y2={yTop}
                stroke="#1d2b3e"
                strokeWidth="1.2"
              />
              {/* navpičnica stopnice */}
              <line
                x1={x + stepW}
                y1={yTop}
                x2={x + stepW}
                y2={yTop + drawStepH}
                stroke="#1d2b3e"
                strokeWidth="1.2"
              />
            </g>
          )
        })}
        {/* Vertikala (višina) — levo */}
        <line
          x1={margin - 6}
          y1={baseY}
          x2={margin - 6}
          y2={baseY - drawTotalH}
          stroke="#f59e0b"
          strokeWidth="1.5"
          markerEnd="url(#arrAmberU)"
          markerStart="url(#arrAmberD)"
        />
        <text
          x={margin - 10}
          y={baseY - drawTotalH / 2}
          fill="#f59e0b"
          fontSize="9"
          fontWeight="bold"
          textAnchor="end"
          transform={`rotate(-90 ${margin - 10} ${baseY - drawTotalH / 2})`}
        >
          {Math.round(visinaPosamezne * stStopnic)}mm
        </text>
        {/* Horizontala (globina skupna) — spodaj */}
        <line
          x1={margin}
          y1={baseY + 6}
          x2={margin + maxDraw * stepW}
          y2={baseY + 6}
          stroke="#f59e0b"
          strokeWidth="1.5"
          markerEnd="url(#arrAmberR)"
          markerStart="url(#arrAmberL)"
        />
        <text
          x={margin + (maxDraw * stepW) / 2}
          y={baseY + 18}
          fill="#f59e0b"
          fontSize="9"
          fontWeight="bold"
          textAnchor="middle"
        >
          {Math.round(globinaStopnice * stStopnic)}mm
        </text>
        {/* Kot (lok) — na prvi stopnici */}
        <path
          d={`M ${margin + stepW * 0.4} ${baseY} A ${stepW * 0.4} ${stepW * 0.4} 0 0 0 ${margin + stepW * 0.4} ${baseY - drawStepH * 0.4}`}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="1.2"
        />
        <text
          x={margin + stepW * 0.45}
          y={baseY - drawStepH * 0.5}
          fill="#f59e0b"
          fontSize="9"
          fontWeight="bold"
        >
          {kotStopinje.toFixed(0)}°
        </text>
        {/* markers */}
        <defs>
          <marker
            id="arrAmberR"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill="#f59e0b" />
          </marker>
          <marker
            id="arrAmberL"
            markerWidth="6"
            markerHeight="6"
            refX="1"
            refY="3"
            orient="auto"
          >
            <path d="M6,0 L0,3 L6,6 Z" fill="#f59e0b" />
          </marker>
          <marker
            id="arrAmberU"
            markerWidth="6"
            markerHeight="6"
            refX="3"
            refY="1"
            orient="auto"
          >
            <path d="M0,6 L3,0 L6,6 Z" fill="#f59e0b" />
          </marker>
          <marker
            id="arrAmberD"
            markerWidth="6"
            markerHeight="6"
            refX="3"
            refY="5"
            orient="auto"
          >
            <path d="M0,0 L3,6 L6,0 Z" fill="#f59e0b" />
          </marker>
        </defs>
      </svg>
      <div className="mt-1 flex items-center justify-between text-[9px] text-muted-foreground">
        <span>↕ {Math.round(visinaPosamezne)}mm/stopnico</span>
        <span>↔ {Math.round(globinaStopnice)}mm globina</span>
        <span className="font-bold text-roksal-amber">{kotStopinje.toFixed(1)}° kot</span>
      </div>
      {stStopnic > maxDraw && (
        <p className="text-[9px] text-muted-foreground text-center mt-0.5">
          (prikazanih prvih {maxDraw} od {stStopnic} stopnic)
        </p>
      )}
    </div>
  )
}
