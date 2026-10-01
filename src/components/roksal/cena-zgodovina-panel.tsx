'use client'

// ---------------------------------------------------------------------------
// R326 — 53. člen issue #1 (§5 price history): PANEL ZGODOVINE CEN MATERIALA.
//
// R327 — 54. člen (IZVOZI družina): PDF BRAT CSV-ju — gumb na isti blok
// glavi (bratska simetrija; vzorec vodja CSV+PDF parov R324): EN pregled =
// ENA preslikava, DVA potrošnika (izvoziCsv + izvoziPdf); generate-
// CenaZgodovinaPdf je determinističen (isti HEAD + isti pregled = bajtno
// identičen dokument — vzorec vodja-dnevni-pdf R324); fail-verbose toast +
// ista iskrena ničelna veja (brez podatkov NI izvoza — OBA gumba skrita).
//
// R328 — 55. člen (§5 'supplier comparison'): POD panel Primerjave
// dobaviteljev (CenaDobaviteljiPanel — LOČEN datoteka, LEKCIJA R325 5:
// vodja registri se NE premaknejo) dobi ISTI pregled kot PROP (EN VIR —
// nič drugega fetcha, nič dvojne resnice); iskrena ničelna veja je SKUPNA
// (brez parov NI zgodovine, NI primerjave, NI izvoza).
//
// Vzorec družine (vodja-dokazni bloki R316–R324): panel je čisti BRALEC
// /api/material-prices/zgodovina (GET — ZERO-MUTACIJA), pregled je
// POSREDOVANA resnica liba cena-zgodovina (NIČ prerunavanja, NIČ ugibanja),
// izvozna gumba pa sta brata izvozne družine (a11y aria + title, fail-verbose
// toast, iskrena ničelna veja — vzorec vodja gumbov R318/R320/R321/R323/R324).
//
// STIL val 13 (r162/…/R324 vzorec — MANDATORY): dvonivojska hierarhija
// odgovora (val 11/12 kanon) razširjena na NOVO površino — par-Card
// kontejner nosi MEKŠI žeton `transition-colors hover:border-roksal-amber/30`,
// časovna vrstica IZRAZITEJŠI `transition-colors hover:border-roksal-amber/40`
// (transition-colors NE transform — brez layout premika, 0 novih hex).
// Ring izvoznega gumba = družinski navy/40 (val 8: amber/50 ring je
// zaklenjen v vodja-dashboard register — cena panel NI član).
//
// Fail-closed kanon: nalaganje → iskren stanj; napaka → VIDNA (nič tihe
// prazne resnice, R152); prazna zgodovina → iskreno 'prvi vpis' sporočilo.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { FileDown, FileText, History, Loader2, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import {
  buildCenaZgodovinaCsv,
  cenaZgoSklep,
  cenaZgodovinaCsvFilename,
  CENA_SMER_NIZ,
  CENA_ZGODOVINA_TIMELINE_GLAVE,
} from '@/lib/cena-zgodovina'
import type { CenaParZgodovina, CenaZgodovinaPregled } from '@/lib/cena-zgodovina'
import { generateCenaZgodovinaPdf, cenaZgodovinaPdfFilename } from '@/lib/cena-zgodovina-pdf'
import { CenaDobaviteljiPanel } from '@/components/roksal/cena-dobavitelji-panel'

/** Iskren prevedek smeri (EN VIR — delta iz liba, besedilo = CENA_SMER_NIZ). */
function smerNiz(p: CenaParZgodovina): string {
  if (!p.smer) return 'prvi vpis'
  return CENA_SMER_NIZ[p.smer]
}

export function CenaZgodovinaPanel() {
  const { toast } = useToast()
  const [pregled, setPregled] = useState<CenaZgodovinaPregled | null>(null)
  const [napaka, setNapaka] = useState<string | null>(null)
  const [nalaga, setNalaga] = useState(true)

  useEffect(() => {
    let ziv = true
    async function nalozi() {
      try {
        const res = await fetch('/api/material-prices/zgodovina')
        if (!res.ok) {
          const telo: unknown = await res.json().catch(() => null)
          const sporocilo =
            telo && typeof telo === 'object' && 'error' in telo && typeof (telo as { error: unknown }).error === 'string'
              ? (telo as { error: string }).error
              : `GET /api/material-prices/zgodovina → HTTP ${res.status}`
          throw new Error(sporocilo)
        }
        const data: unknown = await res.json()
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          throw new Error('Odziv zgodovine cen ni objekt.')
        }
        const ovojnica = data as { pregled?: unknown }
        if (!ovojnica.pregled || typeof ovojnica.pregled !== 'object') {
          throw new Error('Odziv zgodovine cen brez pregleda.')
        }
        if (ziv) {
          setPregled(ovojnica.pregled as CenaZgodovinaPregled)
          setNapaka(null)
        }
      } catch (e) {
        if (ziv) setNapaka(e instanceof Error ? e.message : String(e))
      } finally {
        if (ziv) setNalaga(false)
      }
    }
    void nalozi()
    return () => {
      ziv = false
    }
  }, [])

  const izvoziCsv = useCallback(function izvoziCsv() {
    if (!pregled) return
    try {
      const { csv } = buildCenaZgodovinaCsv(
        pregled,
        'CenaZgodovinaPanel.izvoziCsv',
      )
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = cenaZgodovinaCsvFilename()
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast({ title: 'Zgodovina cen izvožena ✓', description: cenaZgodovinaCsvFilename() })
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
    if (!pregled) return
    try {
      // determinističen dokument — isti HEAD + isti pregled = bajtno identičen PDF
      generateCenaZgodovinaPdf(pregled)
      toast({ title: 'Zgodovina cen izvožena ✓', description: cenaZgodovinaPdfFilename() })
    } catch (e) {
      // fail-verbose: razlog vidno, ne tiho (kanon izvozne družine)
      toast({
        title: 'Izvoz ni uspel',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      })
    }
  }, [pregled, toast])

  return (
    <>
    <Card
      data-testid="cena-zgodovina-dokaz"
      className="transition-colors hover:border-roksal-amber/30"
      aria-label="Zgodovina cen materiala"
    >
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-roksal-ink">
            <History className="h-4 w-4 shrink-0" aria-hidden="true" />
            Zgodovina cen materiala
          </CardTitle>
          {pregled && pregled.pari.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={izvoziCsv}
                className="press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:outline-none"
                aria-label="Izvozi zgodovino cen materiala kot CSV"
                title="Izvozi zgodovino cen materiala kot CSV"
              >
                <FileDown className="mr-2 h-4 w-4" aria-hidden="true" />
                CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={izvoziPdf}
                className="press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:outline-none"
                aria-label="Izvozi zgodovino cen materiala kot PDF"
                title="Izvozi zgodovino cen materiala kot deterministični PDF"
              >
                <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
                PDF
              </Button>
            </div>
          )}
        </div>
        {pregled && pregled.pari.length > 0 && (
          <p className="text-xs text-muted-foreground">{cenaZgoSklep(pregled)}</p>
        )}
      </CardHeader>
      <CardContent>
        {nalaga && (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            Zgodovina se nalaga …
          </p>
        )}
        {!nalaga && napaka && (
          <EmptyState
            icon={History}
            tone="amber"
            title="Zgodovina cen ni na voljo"
            description={napaka}
          />
        )}
        {!nalaga && !napaka && pregled && pregled.pari.length === 0 && (
          <EmptyState
            icon={History}
            title="Ni še zabeleženih cen"
            description="Zgodovina se zgradi ob vsaki spremembi cene materiala pri dobavitelju."
          />
        )}
        {!nalaga && !napaka && pregled && pregled.pari.length > 0 && (
          <div className="space-y-3">
            {pregled.pari.map((p) => (
              <div
                key={`${p.inventoryId}-${p.supplierId}`}
                className="rounded-lg border border-border/60 p-3 transition-colors hover:border-roksal-amber/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-roksal-ink">{p.artikel}</p>
                    <p className="text-xs text-muted-foreground">{p.dobavitelj}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums text-roksal-ink">
                      {p.trenutna.cena.toFixed(2)} EUR
                    </p>
                    <p
                      className="flex items-center justify-end gap-1 text-xs tabular-nums"
                      title={smerNiz(p)}
                    >
                      {p.smer === 'narasca' && <TrendingUp aria-hidden="true" className="h-3 w-3 text-roksal-red" />}
                      {p.smer === 'pada' && <TrendingDown aria-hidden="true" className="h-3 w-3 text-roksal-green" />}
                      {p.smer === 'stabilna' && <Minus aria-hidden="true" className="h-3 w-3 text-muted-foreground" />}
                      {p.deltaEur === null ? (
                        <span className="text-muted-foreground">prvi vpis</span>
                      ) : (
                        <span>
                          {p.deltaEur > 0 ? '+' : ''}
                          {p.deltaEur.toFixed(2)} EUR
                          {p.deltaOdstotek !== null &&
                            ` (${p.deltaOdstotek > 0 ? '+' : ''}${p.deltaOdstotek.toFixed(2)} %)`}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <table className="mt-2 w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      {CENA_ZGODOVINA_TIMELINE_GLAVE.map((glava) => (
                        <th key={glava} scope="col" className="py-1 pr-2 font-medium">
                          {glava}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {p.casovnica.map((v, i) => (
                      <tr key={`${v.veljavnostOd}-${i}`} className="border-t border-border/40">
                        <td className="py-1 pr-2 tabular-nums">{v.cena.toFixed(2)}</td>
                        <td className="py-1 pr-2 tabular-nums">{v.veljavnostOd.slice(0, 10)}</td>
                        <td className="py-1 pr-2 tabular-nums">
                          {v.veljavnostDo ? v.veljavnostDo.slice(0, 10) : '—'}
                        </td>
                        <td className="py-1 pr-2">{v.opomba ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
    {pregled && pregled.pari.length > 0 && !napaka && (
      <CenaDobaviteljiPanel pregled={pregled} />
    )}
    </>
  )
}
