// R319 — dekompozicija measurements-tab (faza 1): izluščeno iz measurements-tab.tsx BREZ spremembe obnašanja (čist premik).

import { useState, useRef } from 'react'
import { Label } from '@/components/ui/label'
import { Camera } from 'lucide-react'

// ============================================
// KOMPONENTA: CalibrationPhotoPicker
// Naloži sliko in omogoči tap dveh točk za izračun piksel razdalje
// ============================================

export function CalibrationPhotoPicker({ onPixelDistance }: { onPixelDistance: (px: number) => void }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [points, setPoints] = useState<{ x: number; y: number }[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    setPoints([])
  }

  function handleImageClick(e: React.MouseEvent<HTMLImageElement>) {
    if (!imageUrl) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setPoints((prev) => {
      const next = [...prev, { x, y }]
      if (next.length > 2) return [next[next.length - 1]]
      if (next.length === 2) {
        const dx = next[1].x - next[0].x
        const dy = next[1].y - next[0].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        onPixelDistance(dist)
      }
      return next
    })
  }

  function clearPoints() {
    setPoints([])
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        <Camera aria-hidden="true" className="inline h-3 w-3 mr-1" />
        Ali izberi 2 točki na sliki
      </Label>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />
      {!imageUrl ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-lg border border-dashed border-border bg-secondary/30 py-3 text-[11px] text-muted-foreground hover:bg-secondary/50 transition-colors"
        >
          <Camera aria-hidden="true" className="mx-auto h-4 w-4 mb-1" />
          Naloži ali slikaj referenco
        </button>
      ) : (
        <div className="space-y-1">
          <div
            ref={containerRef}
            className="relative w-full overflow-hidden rounded-lg border border-border/50 bg-secondary/20"
          >
            <img
              src={imageUrl}
              alt="Referenca"
              onClick={handleImageClick}
              className="w-full max-h-48 object-contain cursor-crosshair"
            />
            {points.map((p, i) => (
              <div
                key={i}
                className="absolute pointer-events-none"
                style={{
                  left: `${p.x}px`,
                  top: `${p.y}px`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div
                  className={`h-3 w-3 rounded-full border-2 border-white ${
                    i === 0 ? 'bg-roksal-navy' : 'bg-roksal-amber'
                  } shadow-md`}
                />
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-white bg-roksal-navy rounded px-1">
                  {String.fromCharCode(65 + i)}
                </span>
              </div>
            ))}
            {points.length === 2 && (
              <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
                <line
                  x1={points[0].x}
                  y1={points[0].y}
                  x2={points[1].x}
                  y2={points[1].y}
                  stroke="#f59e0b"
                  strokeWidth="2"
                  strokeDasharray="4,2"
                />
              </svg>
            )}
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={clearPoints}
              className="flex-1 rounded-md border border-border bg-secondary/30 py-1 text-2xs text-muted-foreground hover:bg-secondary/50"
            >
              Počisti točke
            </button>
            <button
              type="button"
              onClick={() => {
                setImageUrl(null)
                setPoints([])
              }}
              className="flex-1 rounded-md border border-border bg-secondary/30 py-1 text-2xs text-muted-foreground hover:bg-secondary/50"
            >
              Zamenjaj sliko
            </button>
          </div>
          {points.length === 2 && (
            <p className="text-2xs text-roksal-amber text-center">
              ✓ Izbrani 2 točki — piksel razdalja izračunana
            </p>
          )}
          {points.length === 1 && (
            <p className="text-2xs text-muted-foreground text-center">
              Izberi še drugo točko...
            </p>
          )}
        </div>
      )}
    </div>
  )
}
