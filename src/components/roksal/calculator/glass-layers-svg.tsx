// R321 — dekompozicija calculator-tab (faza 1): izluščeno iz calculator-tab.tsx BREZ spremembe obnašanja (čist premik).
// Samostojen SVG diagram (ročno risana shema, ne lucide ikona);
// edina sprememba je izrecni `export`. Brez use client — samo iz
// client drevesa (kanon R319 measurements faza 1).

// ============================================
// SVG: Plasti laminiranega stekla (VSG)
// ============================================
export function GlassLayersSvg({ totalMm, baseMm }: { totalMm: number; baseMm: number }) {
  const vbW = 500
  const vbH = 230
  const startX = 100
  const endX = 380
  const layerW = endX - startX
  const paneH = 50
  const pvbH = 8
  const startY = 60
  const totalH = 2 * paneH + pvbH

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Laminirano steklo: 2× ${baseMm}mm + PVB folija = ${totalMm}mm`}
    >
      {/* Title */}
      <text x={vbW / 2} y={26} textAnchor="middle" fontSize="13" fill="#1d2b3e" fontWeight="bold">
        Laminirano steklo (VSG) — 2× {baseMm}mm + PVB = {totalMm}mm
      </text>

      {/* Pane 1 */}
      <rect x={startX} y={startY} width={layerW} height={paneH} fill="#bae6fd" stroke="#1d2b3e" strokeWidth="1.5" />
      <text x={startX + layerW / 2} y={startY + paneH / 2 + 4} textAnchor="middle" fontSize="12" fill="#1d2b3e" fontWeight="bold">
        Steklo {baseMm}mm
      </text>

      {/* PVB interlayer */}
      <rect x={startX} y={startY + paneH} width={layerW} height={pvbH} fill="#fde68a" stroke="#1d2b3e" strokeWidth="1" />

      {/* Pane 2 */}
      <rect x={startX} y={startY + paneH + pvbH} width={layerW} height={paneH} fill="#bae6fd" stroke="#1d2b3e" strokeWidth="1.5" />
      <text x={startX + layerW / 2} y={startY + paneH + pvbH + paneH / 2 + 4} textAnchor="middle" fontSize="12" fill="#1d2b3e" fontWeight="bold">
        Steklo {baseMm}mm
      </text>

      {/* Right side labels */}
      <text x={endX + 14} y={startY + paneH / 2 + 4} fontSize="11" fill="#1d2b3e" fontWeight="bold">
        {baseMm}mm
      </text>
      <text x={endX + 14} y={startY + paneH + pvbH / 2 + 3} fontSize="9" fill="#666666">
        PVB 0,76mm
      </text>
      <text x={endX + 14} y={startY + paneH + pvbH + paneH / 2 + 4} fontSize="11" fill="#1d2b3e" fontWeight="bold">
        {baseMm}mm
      </text>

      {/* Total dimension (left) */}
      <line x1={startX - 35} y1={startY} x2={startX - 35} y2={startY + totalH} stroke="#1d2b3e" strokeWidth="1.5" />
      <line x1={startX - 39} y1={startY} x2={startX - 31} y2={startY} stroke="#1d2b3e" strokeWidth="1.5" />
      <line x1={startX - 39} y1={startY + totalH} x2={startX - 31} y2={startY + totalH} stroke="#1d2b3e" strokeWidth="1.5" />
      <text
        x={startX - 50}
        y={startY + totalH / 2}
        textAnchor="middle"
        fontSize="11"
        fill="#1d2b3e"
        fontWeight="bold"
        transform={`rotate(-90 ${startX - 50} ${startY + totalH / 2})`}
      >
        Skupaj {totalMm}mm
      </text>

      {/* Legend */}
      <g transform="translate(30, 185)">
        <rect x="0" y="0" width="11" height="11" fill="#bae6fd" stroke="#1d2b3e" strokeWidth="1" />
        <text x="16" y="9" fontSize="9" fill="#1d2b3e">
          Steklo (float/kaljeno)
        </text>
        <rect x="130" y="0" width="11" height="11" fill="#fde68a" stroke="#1d2b3e" strokeWidth="1" />
        <text x="146" y="9" fontSize="9" fill="#1d2b3e">
          PVB folija (varnostna)
        </text>
      </g>
    </svg>
  )
}
