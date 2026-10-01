'use client'

// ---------------------------------------------------------------------------
// R328 — 55. člen issue #1 (§5 'supplier comparison'): PANEL PRIMERJAVE
// DOBAVITELJEV — drugo grupiranje ISTEGA pregleda zgodovine cen (R326).
//
// LOČEN datoteka (kanon LEKCIJE R325 5 / vzorec cena-zgodovina-panel R326):
// vodja registri se NE premaknejo; panel je čisti BRALEC posredovane
// resnice — pregled PRIDE IZ ISTEGA odziva /api/material-prices/zgodovina,
// ki ga že hrani CenaZgodovinaPanel (EN VIR — NIČ drugega fetcha, nič
// dvojne resnice, ZERO-MUTACIJA GET samo).
//
// Fail-closed kanon: izvoz = fail-verbose toast (nič tihe prazne resnice,
// R152); iskrena ničelna veja je skupna z zgodovinskim panelom — brez parov
// NI primerjave IN NI izvoza (panel se sploh ne montira).
//
// STIL val 15 (r162/…/R327 vzorec — MANDATORY): dvonivojska hierarhija
// odgovora (val 11/12/13/14 kanon) na NOVI površini — Card kontejner nosi
// MEKŠI žeton `transition-colors hover:border-roksal-amber/30`, tabelska
// vrstica IZRAZITEJŠI `transition-colors hover:border-roksal-amber/40`
// (hierarhija /40 > /30 ŽIVA; transition-colors NE transform — brez layout
// premika, 0 novih hex). Ring izvoznega gumba = družinski navy/40 (val 8:
// amber/50 ring je zaklenjen v vodja-dashboard register — ta panel NI član)
// + press-scale (vzorec izvoznega PARA R327).
// ---------------------------------------------------------------------------

import { useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileDown, Truck } from 'lucide-react'
import {
  buildCenaDobaviteljeCsv,
  cenaDobaviteljiCsvFilename,
  buildCenaDobavitelje,
  cenaDobaviteljiSklep,
  CENA_DOBAVITELJI_CSV_GLAVE,
} from '@/lib/cena-dobavitelji'
import type { CenaZgodovinaPregled } from '@/lib/cena-zgodovina'

export function CenaDobaviteljiPanel({ pregled }: { pregled: CenaZgodovinaPregled }) {
  const { toast } = useToast()

  const izvoziCsv = useCallback(function izvoziCsv() {
    try {
      // projekcija iz ISTEGA pregleda — fail-closed preveri vsako plast
      const dobavitelji = buildCenaDobavitelje(pregled, 'CenaDobaviteljiPanel.izvoziCsv')
      const { csv } = buildCenaDobaviteljeCsv(dobavitelji, 'CenaDobaviteljiPanel.izvoziCsv')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = cenaDobaviteljiCsvFilename()
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast({ title: 'Primerjava dobaviteljev izvožena ✓', description: cenaDobaviteljiCsvFilename() })
    } catch (e) {
      // fail-verbose: razlog vidno, ne tiho (kanon izvozne družine)
      toast({
        title: 'Izvoz ni uspel',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      })
    }
  }, [pregled, toast])

  const prikaz = buildCenaDobavitelje(pregled, 'CenaDobaviteljiPanel.render')

  return (
    <Card
      data-testid="cena-dobavitelji-dokaz"
      className="transition-colors hover:border-roksal-amber/30"
      aria-label="Primerjava dobaviteljev"
    >
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-roksal-ink">
            <Truck className="h-4 w-4 shrink-0" aria-hidden="true" />
            Primerjava dobaviteljev
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={izvoziCsv}
            className="press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:outline-none"
            aria-label="Izvozi primerjavo dobaviteljev kot CSV"
            title="Izvozi primerjavo dobaviteljev kot CSV"
          >
            <FileDown className="mr-2 h-4 w-4" aria-hidden="true" />
            CSV
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {cenaDobaviteljiSklep(prikaz)}
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                {CENA_DOBAVITELJI_CSV_GLAVE.map((glava) => (
                  <th key={glava} scope="col" className="whitespace-nowrap py-1 pr-3 font-medium">
                    {glava}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prikaz.dobavitelji.map((d) => (
                <tr
                  key={d.supplierId}
                  className="border-t border-border/40 transition-colors hover:border-roksal-amber/40"
                >
                  <td className="whitespace-nowrap py-1 pr-3 font-medium text-roksal-ink">{d.dobavitelj}</td>
                  <td className="py-1 pr-3 tabular-nums">{d.materialov}</td>
                  <td className="py-1 pr-3 tabular-nums">{d.vpisov}</td>
                  <td className="py-1 pr-3 tabular-nums">{d.narasca}</td>
                  <td className="py-1 pr-3 tabular-nums">{d.pada}</td>
                  <td className="py-1 pr-3 tabular-nums">{d.stabilna}</td>
                  <td className="py-1 pr-3 tabular-nums">{d.prvihVpisov}</td>
                  <td className="py-1 pr-3 tabular-nums">{d.najnizja.toFixed(2)}</td>
                  <td className="py-1 pr-3 tabular-nums">{d.najvisja.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
