// R319 — dekompozicija measurements-tab (faza 1): izluščeno iz measurements-tab.tsx BREZ spremembe obnašanja (čist premik).

import { useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Columns3, Download, AlertCircle } from 'lucide-react'
import {
  materialStebraColors,
  materialStebraLabels,
  tipStebraColors,
  tipStebraLabels,
  type MaterialStebra,
  type Measurement,
} from './shared'

// ============================================
// P3 — KOMPONENTA: SteberTable (preglednica stebrov)
// ============================================

export function SteberTable({
  measurements,
  segmentId,
  onExportCsv,
}: {
  measurements: Measurement[]
  segmentId: string
  onExportCsv: () => void
}) {
  const stebri = useMemo(() => {
    return measurements
      .filter((m) => m.tipMeritve === 'STEBR' && m.segmentId === segmentId)
      .sort((a, b) => (a.pozicijaMm || 0) - (b.pozicijaMm || 0))
  }, [measurements, segmentId])

  if (stebri.length === 0) return null

  // summary
  const total = stebri.length
  const razmiki = stebri
    .map((s) => s.razmikMm)
    .filter((r): r is number => r != null && r > 0)
  const maxRazmik = razmiki.length > 0 ? Math.max(...razmiki) : 0
  const avgRazmik =
    razmiki.length > 0 ? razmiki.reduce((s, r) => s + r, 0) / razmiki.length : 0
  const materialCounts: Record<string, number> = {}
  stebri.forEach((s) => {
    const m = s.materialStebra || 'DRUGO'
    materialCounts[m] = (materialCounts[m] || 0) + 1
  })

  return (
    <div className="rounded-lg border border-roksal-navy/15 dark:border-roksal-ink/15 bg-background overflow-hidden slide-in-right">
      <div className="flex items-center justify-between p-2 border-b border-border/40 bg-roksal-navy/5">
        <div className="flex items-center gap-1.5">
          <Columns3 aria-hidden="true" className="h-3.5 w-3.5 text-roksal-ink" />
          <span className="text-[11px] font-semibold text-roksal-ink">
            Preglednica stebrov ({total})
          </span>
        </div>
        <button
          type="button"
          onClick={onExportCsv}
          className="flex items-center gap-1 rounded-md border border-roksal-navy/20 dark:border-roksal-ink/20 bg-background px-1.5 py-0.5 text-[9px] font-medium text-roksal-ink hover:bg-roksal-navy/10 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
          aria-label="Izvozi preglednico stebrov kot CSV"
          title="Izvozi stebre tega segmenta kot CSV za Excel"
        >
          <Download aria-hidden="true" className="h-2.5 w-2.5" />
          CSV
        </button>
      </div>
      <div className="max-h-64 overflow-x-auto overflow-y-auto scrollbar-thin">
        <Table className="text-2xs">
          <TableHeader>
            <TableRow className="bg-secondary/40 hover:bg-secondary/40">
              <TableHead className="h-6 px-1.5 text-[9px] font-semibold">Oznaka</TableHead>
              <TableHead className="h-6 px-1.5 text-[9px] font-semibold">Tip</TableHead>
              <TableHead className="h-6 px-1.5 text-[9px] font-semibold text-right">Pozicija</TableHead>
              <TableHead className="h-6 px-1.5 text-[9px] font-semibold text-right">Razmik</TableHead>
              <TableHead className="h-6 px-1.5 text-[9px] font-semibold text-right">Višina</TableHead>
              <TableHead className="h-6 px-1.5 text-[9px] font-semibold">Material</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stebri.map((s, i) => {
              const razmik = s.razmikMm
              const razmikPrevelik = razmik != null && razmik > 1500
              return (
                <TableRow key={s.id} className={i % 2 === 0 ? 'bg-transparent' : 'bg-secondary/10'}>
                  <TableCell className="py-1 px-1.5 font-mono font-bold text-roksal-ink">
                    {s.steberOznaka || s.oznaka || `S${i + 1}`}
                  </TableCell>
                  <TableCell className="py-1 px-1.5">
                    {s.tipStebra && (
                      <span
                        className={`inline-flex rounded px-1 py-0 text-3xs font-medium border ${tipStebraColors[s.tipStebra]}`}
                      >
                        {tipStebraLabels[s.tipStebra]}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-1 px-1.5 text-right font-mono">
                    {s.pozicijaMm != null ? Math.round(s.pozicijaMm) : '—'}
                  </TableCell>
                  <TableCell
                    className={`py-1 px-1.5 text-right font-mono ${
                      razmikPrevelik ? 'text-red-600 dark:text-red-400 font-bold' : ''
                    }`}
                  >
                    {razmik != null ? Math.round(razmik) : '—'}
                  </TableCell>
                  <TableCell className="py-1 px-1.5 text-right font-mono">
                    {s.visinaStebraMm != null ? Math.round(s.visinaStebraMm) : '—'}
                  </TableCell>
                  <TableCell className="py-1 px-1.5">
                    {s.materialStebra && (
                      <span
                        className={`inline-flex rounded px-1 py-0 text-3xs font-medium border ${materialStebraColors[s.materialStebra]}`}
                      >
                        {materialStebraLabels[s.materialStebra]}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      {/* Warnings */}
      {maxRazmik > 1500 && (
        <div className="border-t border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-1.5 text-[9px] text-red-700 dark:text-red-300 flex items-center gap-1">
          <AlertCircle aria-hidden="true" className="h-3 w-3 shrink-0" />
          Razmik {Math.round(maxRazmik)}mm presega 1500mm — preveri statiko!
        </div>
      )}
      {/* Summary */}
      <div className="border-t border-border/40 p-2 grid grid-cols-2 gap-1.5 text-[9px]">
        <div className="rounded bg-secondary/30 p-1.5">
          <p className="text-muted-foreground">Skupno</p>
          <p className="font-bold text-roksal-ink">{total} stebrov</p>
        </div>
        <div className="rounded bg-secondary/30 p-1.5">
          <p className="text-muted-foreground">Povpr. razmik</p>
          <p className="font-bold text-roksal-ink">{Math.round(avgRazmik)}mm</p>
        </div>
        <div className="rounded bg-secondary/30 p-1.5">
          <p className="text-muted-foreground">Max razmik</p>
          <p className={`font-bold ${maxRazmik > 1500 ? 'text-red-600 dark:text-red-400' : 'text-roksal-ink'}`}>
            {Math.round(maxRazmik)}mm
          </p>
        </div>
        <div className="rounded bg-secondary/30 p-1.5">
          <p className="text-muted-foreground">Materiali</p>
          <p className="font-bold text-roksal-ink text-[9px]">
            {Object.entries(materialCounts)
              .map(([k, v]) => `${materialStebraLabels[k as MaterialStebra] || k}: ${v}`)
              .join(', ')}
          </p>
        </div>
      </div>
    </div>
  )
}
