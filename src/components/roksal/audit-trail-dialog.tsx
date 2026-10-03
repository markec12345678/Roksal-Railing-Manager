'use client'

// Roksal — Revizijska sled (audit trail) dialog, R139
// ---------------------------------------------------------------------------
// /api/audit je obstajal od R120 (pravno pomembna sled: kdo, kaj, kdaj, iz
// katerega IP), a JESELNIŠKEGA vmesnika NI IMEL — sled je bila vidna samo
// prek API klicev. Ta dialog jo odpre za pisarno in monterja (server sam
// uveljavi dostop: monter samo za svoje projekte, VODJA/ADMIN vse).
//
// Načela:
//   • fail-verbose: 403/napaka se POKAŽE uporabniku (ne tiho prazno stanje),
//   • deterministično: brez naključij, format časa prek Intl sl-SI,
//   • razlike (oldValue → newValue) so zložljive — privzeto skrite, ker so
//     lahko dolge (odrezane na 4000 znakov s strani lib/audit.ts),
//   • stil: blagovni jeziki (navy/jantar), tabular-nums na časih,
//     focus-visible ringi.

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { buildAuditCsv, auditCsvFilename, revizijaLabel, akcijaDruzina, AKCIJA_DRUZINA_OMEJKE, type AkcijaDruzina } from '@/lib/audit-csv'
import { History, Loader2, ShieldCheck, ChevronDown, ChevronRight, Download } from 'lucide-react'

interface AuditEntry {
  id: string
  akcija: string
  oldValue: string | null
  newValue: string | null
  ipAddress: string | null
  userAgent: string | null
  timestamp: string
  user: { id: string; ime: string; email: string; vloga: string } | null
}

/** Barvne kategorije po pomenu akcije — EN VIR RESNICE je akcijaDruzina()
 * (src/lib/audit-csv.ts, R192): isti razred uporabita značka IN družinski chip
 * (filter), da barvna semantika ostane vrstično enaka.
 * R162 stil pass — dark: variante (svetla tema NESPREMENJENA, temna dobi
 * berljive polprosojne značke namesto svetlih 100-barv). */
const druzinaRazred: Record<AkcijaDruzina, string> = {
  prijava: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
  brisanje: 'bg-red-100 text-red-700 border-red-300 dark:bg-roksal-red/15 dark:text-roksal-red dark:border-roksal-red/30',
  ustvarjanje: 'bg-green-100 text-green-800 border-green-300 dark:bg-roksal-green/15 dark:text-roksal-green dark:border-roksal-green/30',
  zaklep: 'bg-roksal-amber/20 text-roksal-navy border-roksal-amber/50 dark:bg-roksal-amber/15 dark:text-roksal-amber dark:border-roksal-amber/30',
  ostalo: 'bg-muted text-muted-foreground border-border',
}

function akcijaBadge(akcija: string): { label: string; className: string } {
  const druzina = akcijaDruzina(akcija)
  return { label: akcija, className: druzinaRazred[druzina] }
}

function formatCas(ts: string): string {
  const d = new Date(ts)
  return (
    d.toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
  )
}

/** Kratek opis razlike za enovrstični prikaz (podrobnosti zložljive). */
function kratkoPovzetje(entry: AuditEntry): string {
  const nov = entry.newValue
  const star = entry.oldValue
  if (nov && star) return 'sprememba'
  if (nov) return 'nova vrednost'
  if (star) return 'prejšnja vrednost'
  return 'brez podrobnosti'
}

export function AuditTrailDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)
  // R192 — družinski filter (chips): privzeto 'vse', reset ob vsakem odpiranju.
  const [filter, setFilter] = useState<AkcijaDruzina | 'vse'>('vse')
  const { toast } = useToast()

  useEffect(() => {
    if (!open || !projectId) return
    let cancelled = false
    // R139: vse setState v async zanki (react-hooks/set-state-in-effect —
    // isti vzorec kot R138 pri paleti: brez sinhronih setState klicev v efektu).
    const run = async () => {
      setLoading(true)
      setError(null)
      setEntries(null)
      setExpanded(new Set())
      setFilter('vse')
      try {
        const res = await fetch(`/api/audit?projectId=${encodeURIComponent(projectId)}&limit=100`)
        const data = await res.json().catch(() => null)
        if (cancelled) return
        if (!res.ok) {
          setError(data?.error ?? `Napaka ${res.status}`)
          return
        }
        setEntries(Array.isArray(data?.entries) ? data.entries : [])
      } catch {
        if (!cancelled) setError('Napaka pri povezavi s strežnikom')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [open, projectId])

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // R162 — CSV izvoz revizijske sledi (arhiv/skladnost/pisarniška obdelava;
  // logika v src/lib/audit-csv.ts — deterministično, fail-closed, RFC 4180).
  // Izvozi TOČNO to, kar je naloženo v dialogu (zadnjih 100 vpisov).
  const handleExportCsv = () => {
    if (!entries || entries.length === 0 || !projectId) return
    setExporting(true)
    try {
      const { csv, vrstic } = buildAuditCsv(
        entries.map((e) => ({
          id: e.id,
          akcija: e.akcija,
          oldValue: e.oldValue,
          newValue: e.newValue,
          ipAddress: e.ipAddress,
          timestamp: e.timestamp,
          user: e.user ? { ime: e.user.ime, email: e.user.email, vloga: e.user.vloga } : null,
        })),
      )
      const danes = new Date().toISOString().slice(0, 10)
      const filename = auditCsvFilename(projectId, danes)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast({ title: 'CSV izvožen', description: `Izvožen seznam (${revizijaLabel(vrstic)}) v datoteko ${filename}.` })
    } catch (err) {
      // Fail-verbose: izvoz ne sme tiho spodleteti — razlog gre v toast.
      toast({
        title: 'Izvoz ni uspel',
        description: err instanceof Error ? err.message : `Neznana napaka (${String(err)}).`,
        variant: 'destructive',
      })
    } finally {
      setExporting(false)
    }
  }

  // R192 — števeci po družinah (deterministični vrstni red: vse, prijava,
  // ustvarjanje, brisanje, zaklep, ostalo) + filtriran seznam za izris.
  const druzine: Array<{ key: AkcijaDruzina | 'vse'; stevilo: number }> = []
  if (entries && entries.length > 0) {
    const stevci = new Map<AkcijaDruzina, number>()
    for (const e of entries) {
      const d = akcijaDruzina(e.akcija)
      stevci.set(d, (stevci.get(d) ?? 0) + 1)
    }
    const vrstniRed: AkcijaDruzina[] = ['prijava', 'ustvarjanje', 'brisanje', 'zaklep', 'ostalo']
    druzine.push({ key: 'vse', stevilo: entries.length })
    for (const k of vrstniRed) {
      const n = stevci.get(k) ?? 0
      if (n > 0) druzine.push({ key: k, stevilo: n })
    }
  }
  const prikazani: AuditEntry[] = !entries
    ? []
    : filter === 'vse'
      ? entries
      : entries.filter((e) => akcijaDruzina(e.akcija) === filter)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-roksal-ink flex items-center gap-2">
              <History className="h-4 w-4 text-roksal-amber" aria-hidden="true" />
              Revizijska sled
            </DialogTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleExportCsv}
              disabled={!entries || entries.length === 0 || exporting || loading || error !== null}
              className="ml-auto h-7 shrink-0 gap-1.5 text-[11px] focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40 dark:focus-visible:border-roksal-ink/40"
              aria-label={`Izvozi prikazani seznam revizijskih vpisov v CSV (${revizijaLabel(entries?.length ?? 0)})`}
              title="Izvozi prikazani seznam revizijskih vpisov v CSV"
            >
              {exporting ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-3 w-3" aria-hidden="true" />
              )}
              Izvozi CSV
            </Button>
          </div>
          <DialogDescription>
            Kdo, kaj, kdaj — pravno pomembna sled projekta (zadnjih 100 vpisov).
          </DialogDescription>
        </DialogHeader>

        {/* R192 — družinski filtri (chips): isti barvni razredi kot značke;
            aria-pressed = stanje filtra, tabular-nums na števcih. */}
        {druzine.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter revizijskih vpisov po družini akcije">
            {druzine.map(({ key, stevilo }) => {
              const aktiv = filter === key
              const razred = key === 'vse' ? 'bg-muted text-muted-foreground border-border' : druzinaRazred[key as AkcijaDruzina]
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  aria-pressed={aktiv}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40 dark:focus-visible:border-roksal-ink/40 ${
                    aktiv ? razred : 'bg-muted text-muted-foreground border-border opacity-70 hover:opacity-100'
                  }`}
                >
                  {AKCIJA_DRUZINA_OMEJKE[key]}
                  <span className="tabular-nums font-medium">{stevilo}</span>
                </button>
              )
            })}
          </div>
        ) : null}

        {loading ? (
          <div className="py-10 text-center">
            <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin mx-auto text-roksal-amber" aria-label="Nalagam sled" />
          </div>
        ) : error ? (
          <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-3 py-2.5 text-sm text-red-700 dark:text-red-300" role="alert">
            {error}
          </div>
        ) : !entries || entries.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="h-10 w-10 mx-auto mb-2 opacity-30"  />
            <p className="text-sm">Ni še revizijskih vpisov za ta projekt.</p>
          </div>
        ) : prikazani.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p className="text-sm">Ni vpisov v družini „{AKCIJA_DRUZINA_OMEJKE[filter]}”. Izberi drug chip ali „Vse”.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[360px] pr-2">
            <ol className="space-y-2" aria-label="Seznam revizijskih vpisov">
              {prikazani.map((e) => {
                const badge = akcijaBadge(e.akcija)
                const isOpen = expanded.has(e.id)
                const hasDetail = Boolean(e.oldValue || e.newValue)
                return (
                  <li key={e.id} className="rounded-md border border-roksal-navy/10 bg-card dark:border-roksal-ink/15 px-2.5 py-2 transition-colors hover:border-roksal-navy/25 dark:hover:border-roksal-ink/25">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className={`text-[9px] shrink-0 ${badge.className}`}>
                        {badge.label}
                      </Badge>
                      <span className="text-2xs text-muted-foreground tabular-nums">{formatCas(e.timestamp)}</span>
                    </div>
                    <div className="mt-1 text-xs text-roksal-ink">
                      {e.user ? (
                        <span className="font-medium">{e.user.ime}</span>
                      ) : (
                        <span className="italic text-muted-foreground">sistemski dogodek</span>
                      )}
                      {e.user ? <span className="text-muted-foreground"> · {e.user.vloga}</span> : null}
                      {hasDetail ? (
                        <span className="text-muted-foreground"> · {kratkoPovzetje(e)}</span>
                      ) : null}
                    </div>
                    {hasDetail ? (
                      <>
                        <button
                          type="button"
                          onClick={() => toggle(e.id)}
                          aria-expanded={isOpen}
                          className="mt-1 inline-flex items-center gap-0.5 rounded text-2xs text-muted-foreground hover:text-roksal-ink focus-visible:outline-none transition-colors focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                        >
                          {isOpen ? (
                            <ChevronDown aria-hidden="true" className="h-3 w-3"  />
                          ) : (
                            <ChevronRight aria-hidden="true" className="h-3 w-3"  />
                          )}
                          {isOpen ? 'Skrij podrobnosti' : 'Podrobnosti'}
                        </button>
                        {isOpen ? (
                          <div className="mt-1.5 space-y-1 rounded bg-muted/60 px-2 py-1.5">
                            {e.oldValue ? (
                              <p className="break-all font-mono text-2xs text-muted-foreground">
                                <span className="font-semibold text-red-700 dark:text-red-300">−</span> {e.oldValue}
                              </p>
                            ) : null}
                            {e.newValue ? (
                              <p className="break-all font-mono text-2xs text-roksal-ink">
                                <span className="font-semibold text-green-700 dark:text-green-300">+</span> {e.newValue}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </li>
                )
              })}
            </ol>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
