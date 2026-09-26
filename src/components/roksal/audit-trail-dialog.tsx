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
import { buildAuditCsv, auditCsvFilename, revizijaLabel } from '@/lib/audit-csv'
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

/** Barvne kategorije po pomenu akcije — prva beseda določi razred.
 * R162 stil pass — dark: variante (svetla tema NESPREMENJENA, temna dobi
 * berljive polprosojne značke namesto svetlih 100-barv). */
function akcijaBadge(akcija: string): { label: string; className: string } {
  const upper = akcija.toUpperCase()
  if (upper.includes('LOGIN')) {
    return { label: akcija, className: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30' }
  }
  if (upper.includes('DELETE') || upper.includes('REVOKE') || upper.includes('STORNO')) {
    return { label: akcija, className: 'bg-red-100 text-red-700 border-red-300 dark:bg-roksal-red/15 dark:text-roksal-red dark:border-roksal-red/30' }
  }
  if (upper.includes('CREATE') || upper.includes('ISSUE') || upper.includes('BOOTSTRAP')) {
    return { label: akcija, className: 'bg-green-100 text-green-800 border-green-300 dark:bg-roksal-green/15 dark:text-roksal-green dark:border-roksal-green/30' }
  }
  if (upper.includes('DEAL') || upper.includes('SIGN') || upper.includes('LOCK')) {
    return { label: akcija, className: 'bg-roksal-amber/20 text-roksal-navy border-roksal-amber/50 dark:bg-roksal-amber/15 dark:text-roksal-amber dark:border-roksal-amber/30' }
  }
  return { label: akcija, className: 'bg-muted text-muted-foreground border-border' }
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
              className="ml-auto h-7 shrink-0 gap-1.5 text-[11px] focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
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

        {loading ? (
          <div className="py-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-roksal-amber" aria-label="Nalagam sled" />
          </div>
        ) : error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
            {error}
          </div>
        ) : !entries || entries.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <ShieldCheck className="h-10 w-10 mx-auto mb-2 opacity-30" aria-hidden />
            <p className="text-sm">Ni še revizijskih vpisov za ta projekt.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[360px] pr-2">
            <ol className="space-y-2" aria-label="Seznam revizijskih vpisov">
              {entries.map((e) => {
                const badge = akcijaBadge(e.akcija)
                const isOpen = expanded.has(e.id)
                const hasDetail = Boolean(e.oldValue || e.newValue)
                return (
                  <li key={e.id} className="rounded-md border border-roksal-navy/10 bg-white px-2.5 py-2 transition-colors hover:border-roksal-navy/25">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className={`text-[9px] shrink-0 ${badge.className}`}>
                        {badge.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground tabular-nums">{formatCas(e.timestamp)}</span>
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
                          className="mt-1 inline-flex items-center gap-0.5 rounded text-[10px] text-muted-foreground hover:text-roksal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
                        >
                          {isOpen ? (
                            <ChevronDown className="h-3 w-3" aria-hidden />
                          ) : (
                            <ChevronRight className="h-3 w-3" aria-hidden />
                          )}
                          {isOpen ? 'Skrij podrobnosti' : 'Podrobnosti'}
                        </button>
                        {isOpen ? (
                          <div className="mt-1.5 space-y-1 rounded bg-muted/60 px-2 py-1.5">
                            {e.oldValue ? (
                              <p className="break-all font-mono text-[10px] text-muted-foreground">
                                <span className="font-semibold text-red-700">−</span> {e.oldValue}
                              </p>
                            ) : null}
                            {e.newValue ? (
                              <p className="break-all font-mono text-[10px] text-roksal-ink">
                                <span className="font-semibold text-green-700">+</span> {e.newValue}
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
