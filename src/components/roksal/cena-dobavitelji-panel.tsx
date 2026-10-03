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
// premika, 0 novih hex). Ring izvoznih gumbov = družinski navy/40 (val 8:
// amber/50 ring je zaklenjen v vodja-dashboard register — ta panel NI član)
// + press-scale (vzorec izvoznega PARA R327 — CSV + PDF brat).
//
// STIL val 16 (R329 — 56. člen: PDF brat + iskren alarm na zaslonu):
//  • izvozni PAR dobi DRUGI gumb (PDF — bratska simetrija z zgodovina PAR
//    R327; ISTI navy/40 ring + press-scale — pariteta, nič drugega občutka);
//  • WYSIWYG iskren alarm: števec Narašča > 0 = text-roksal-red + font-
//    medium (ISTI rdeči pomen kot TrendingUp ikona v zgodovina panelu IN
//    kot RED KPI/celica v PDF bratu), Pada > 0 = text-roksal-green +
//    font-medium (ISTI zeleni pomen kot TrendingDown ikona — zaslonska
//    družina rdeč/zelen, PDF družina rdeč/navy — DATA WYSIWYG, barvne
//    palete so družinske po površini);
//  • tabelska glava dobi `border-b border-border/60` (struktura stolpcev —
//    vzorec zgodovina časovna tabela);
//  • roksal žetoni SAMO (text-roksal-red/green = roksal tokena — NIČ surovih
//    barv, kanon val 15 0-hex).
// ---------------------------------------------------------------------------

import { useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileDown, FileText, Truck } from 'lucide-react'
import {
  buildCenaDobaviteljeCsv,
  cenaDobaviteljiCsvFilename,
  buildCenaDobavitelje,
  cenaDobaviteljiSklep,
  CENA_DOBAVITELJI_CSV_GLAVE,
} from '@/lib/cena-dobavitelji'
import {
  generateCenaDobaviteljePdf,
  cenaDobaviteljiPdfFilename,
} from '@/lib/cena-dobavitelji-pdf'
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

  const izvoziPdf = useCallback(function izvoziPdf() {
    try {
      // projekcija + PDF v ENEM try — pokvaren vhod odklonjen PREJ pošiljanja
      // (buildCenaDobavitelje ×6 skupin teče ZNOTRAJ buildCenaDobaviteljePdfDoc)
      generateCenaDobaviteljePdf(pregled)
      toast({ title: 'Primerjava dobaviteljev izvožena ✓', description: cenaDobaviteljiPdfFilename() })
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
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={izvoziCsv}
              className="press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40 dark:focus-visible:border-roksal-ink/40 focus-visible:outline-hidden"
              aria-label="Izvozi primerjavo dobaviteljev kot CSV"
              title="Izvozi primerjavo dobaviteljev kot CSV"
            >
              <FileDown className="mr-2 h-4 w-4" aria-hidden="true" />
              CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={izvoziPdf}
              className="press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40 dark:focus-visible:border-roksal-ink/40 focus-visible:outline-hidden"
              aria-label="Izvozi primerjavo dobaviteljev kot PDF"
              title="Izvozi primerjavo dobaviteljev kot deterministični PDF"
            >
              <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
              PDF
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {cenaDobaviteljiSklep(prikaz)}
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/60 text-left text-muted-foreground">
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
                  {/* val 16: iskren alarm WYSIWYG — narašča rdeče (TrendingUp
                      ikona + PDF KPI kanon), pada zeleno (TrendingDown
                      ikona — zaslonska družina) */}
                  <td className={d.narasca > 0 ? 'py-1 pr-3 font-medium tabular-nums text-roksal-red' : 'py-1 pr-3 tabular-nums'}>
                    {d.narasca}
                  </td>
                  <td className={d.pada > 0 ? 'py-1 pr-3 font-medium tabular-nums text-roksal-green' : 'py-1 pr-3 tabular-nums'}>
                    {d.pada}
                  </td>
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
