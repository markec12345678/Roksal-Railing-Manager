// R321 — dekompozicija calculator-tab (faza 1): izluščeno iz calculator-tab.tsx BREZ spremembe obnašanja (čist premik).
// Samostojen SVG diagram (ročno risana shema, ne lucide ikona);
// edina sprememba je izrecni `export`. Brez use client — samo iz
// client drevesa (kanon R319 measurements faza 1).

// ============================================
// SVG: Karta vetrnih con Slovenije
// ============================================
export function SloveniaWindMapSvg({
  lat,
  lon,
  windZone,
}: {
  lat: number
  lon: number
  windZone: 1 | 2 | 3
}) {
  // Slovenia bounds: lat 45.42-46.88, lon 13.38-16.61
  const minLat = 45.42
  const maxLat = 46.88
  const minLon = 13.38
  const maxLon = 16.61
  const vbW = 600
  const vbH = 400
  const projX = (lon: number) => ((lon - minLon) / (maxLon - minLon)) * vbW
  const projY = (lat: number) => ((maxLat - lat) / (maxLat - minLat)) * vbH

  // Rough Slovenia outline
  const sloPath =
    'M 110,90 L 200,40 L 290,30 L 410,55 L 520,75 L 580,110 L 575,180 L 530,260 L 470,320 L 380,375 L 290,370 L 220,335 L 110,310 L 65,250 L 50,180 L 75,130 Z'

  // Clamp pin within Slovenia
  const pinX = Math.max(30, Math.min(vbW - 30, projX(lon)))
  const pinY = Math.max(20, Math.min(vbH - 90, projY(lat)))

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Karta vetrnih con Slovenije — lokacija cona ${windZone}`}
    >
      <defs>
        <clipPath id="sloClip">
          <path d={sloPath} />
        </clipPath>
      </defs>

      {/* Background Slovenia (zone 1 — celina, light green) */}
      <path d={sloPath} fill="#dcfce7" stroke="#1d2b3e" strokeWidth="2" />

      {/* Zone 3 (gore) — top portion, lat > 46.5 */}
      <rect
        x="0"
        y="0"
        width={vbW}
        height={projY(46.5)}
        fill="#fef3c7"
        clipPath="url(#sloClip)"
      />

      {/* Zone 2 (obala) — bottom-left, lat < 45.7 AND lon > 13.5 */}
      <rect
        x={projX(13.5)}
        y={projY(45.7)}
        width={vbW - projX(13.5)}
        height={vbH - projY(45.7)}
        fill="#fed7aa"
        clipPath="url(#sloClip)"
      />

      {/* Slovenia outline on top */}
      <path d={sloPath} fill="none" stroke="#1d2b3e" strokeWidth="2.5" />

      {/* City labels */}
      <text x={projX(14.3556)} y={projY(46.2389) - 6} fontSize="9" fill="#1d2b3e" fontWeight="bold" textAnchor="middle">
        Kranj
      </text>
      <circle cx={projX(14.3556)} cy={projY(46.2389)} r="2" fill="#1d2b3e" />

      <text x={projX(14.5050)} y={projY(46.0569) - 6} fontSize="9" fill="#1d2b3e" textAnchor="middle">
        Ljubljana
      </text>
      <circle cx={projX(14.5050)} cy={projY(46.0569)} r="2" fill="#1d2b3e" />

      <text x={projX(15.6467)} y={projY(46.5547) - 6} fontSize="9" fill="#1d2b3e" textAnchor="middle">
        Maribor
      </text>
      <circle cx={projX(15.6467)} cy={projY(46.5547)} r="2" fill="#1d2b3e" />

      <text x={projX(13.7297)} y={projY(45.5481) - 6} fontSize="9" fill="#1d2b3e" textAnchor="middle">
        Koper
      </text>
      <circle cx={projX(13.7297)} cy={projY(45.5481)} r="2" fill="#1d2b3e" />

      {/* Location pin (amber with white center) */}
      <circle cx={pinX} cy={pinY} r="10" fill="#f59e0b" stroke="#1d2b3e" strokeWidth="2" />
      <circle cx={pinX} cy={pinY} r="3.5" fill="#ffffff" />
      <text x={pinX} y={pinY - 16} fontSize="10" fill="#1d2b3e" fontWeight="bold" textAnchor="middle">
        Tukaj
      </text>

      {/* Highlighted zone label */}
      <g>
        <rect x={vbW - 110} y={10} width={100} height={26} fill="#1d2b3e" rx="4" />
        <text x={vbW - 60} y={28} fontSize="13" fill="#ffffff" fontWeight="bold" textAnchor="middle">
          CONA {windZone}
        </text>
      </g>

      {/* Legend */}
      <g>
        <rect x="14" y={vbH - 78} width="13" height="13" fill="#dcfce7" stroke="#1d2b3e" strokeWidth="1" />
        <text x="32" y={vbH - 67} fontSize="9" fill="#1d2b3e">
          Cona 1 — celina (22 m/s)
        </text>
        <rect x="14" y={vbH - 60} width="13" height="13" fill="#fed7aa" stroke="#1d2b3e" strokeWidth="1" />
        <text x="32" y={vbH - 49} fontSize="9" fill="#1d2b3e">
          Cona 2 — obala (24 m/s)
        </text>
        <rect x="14" y={vbH - 42} width="13" height="13" fill="#fef3c7" stroke="#1d2b3e" strokeWidth="1" />
        <text x="32" y={vbH - 31} fontSize="9" fill="#1d2b3e">
          Cona 3 — gore (28 m/s)
        </text>
      </g>
    </svg>
  )
}
