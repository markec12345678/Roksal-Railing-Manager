'use client'

// Sledenje ponudbam — follow-up spomniki (runda F, F-1).
// Iz raziskave: ServiceTrade/Jobber — ponudniki, ki sistematično sledijo ponudbam,
// imajo višjo stopnjo odobritve. Vsaka nepodpisana ponudba dobi datum spomnika;
// zapadle so izpostavljene rdeče, hitri gumbi +3/+7 dni.
//
// R161:
//  • FAIL-VERBOSE (prej fail-open!): neuspel GET /api/projects je tiho pokazal
//    "Ni aktivnih ponudb … 🎉" — laž, ker seznam sploh ni bil naložen. Zdaj je
//    viden error state z razlogom + gumb "Poskusi znova" (vzorec sessions-dialog).
//  • 🆕 IZVOZ CSV (ponudbe-csv.ts): gumb izvozi TOČNO to, kar je videti na
//    kartici (prvih 12 vrst, isti statusi/stanja spomnika) — pisarniška raba.
//  • STIL pass: trdo kodirane svetle barve (bg-red-50, bg-amber-50, bg-white,
//    text-stone-*) so v temni temi bile neberljive → semantični žetoni
//    (roksal-red/10, roksal-amber/10, bg-card, text-roksal-ink); focus-visible
//    ringi barvno skladni z okolico; dekorativne ikone aria-hidden; datumi
//    tabular-nums.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'
import { casOznaka } from '@/lib/osvezitev-fokus'
import { buildPonudbeCsv, ponudbeCsvFilename, ponudbeLabel, PONUDBE_STATUS_LABELS, stanjeSpomnika } from '@/lib/ponudbe-csv'
import { todayStamp } from '@/lib/csv-export'
import {
  Download,
  FileClock,
  FileDown,
  History,
  Loader2,
  Phone,
  X,
  CalendarClock,
  AlertTriangle,
} from 'lucide-react'
import {
  generatePonudbeSpomnikiPdf,
  ponudbeSpomnikiPregled,
  type PonudbaSpomnikiVnos,
} from '@/lib/ponudbe-spomniki-pdf'

interface FollowProject {
  id: string
  nazivProjekta: string
  status: string
  dealLocked: boolean
  datumMontaze: string | null
  followUpDate: string | null
  followUpOpomba: string | null
  customer?: { ime: string } | null
}

/** UI črpa besedila iz ISTEGA vira kot izvoz (ponudbe-csv.ts) — R161 refactor. */
const STATUS_LABEL = PONUDBE_STATUS_LABELS

function fmt(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit' })
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86400000)
}

export function QuoteFollowUp() {
  const [projects, setProjects] = useState<FollowProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  // R267 — dvoklik zaščita PDF izvoza (družinski vzorec disabled={ocVTeku} R266).
  const [pdfVteku, setPdfVteku] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  // R181 — pečat svežine: čas zadnjega USPEŠNEGA branja /api/projects (vzorec
  // R170/R177/R178/R180). Napaka/omrežje → null (fail-closed — NIČ lažne
  // svežine; zastarel seznam ostane viden, a BREZ pečata).
  const [ponudbeOsvezitev, setPonudbeOsvezitev] = useState<Date | null>(null)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/projects', { credentials: 'same-origin' })
      if (!res.ok) {
        // Fail-verbose: 401 → seja padla; 5xx → strežnik. NIČ lažnega "vse urejeno".
        setError(
          res.status === 401
            ? 'Prijava je potekla. Ponovno se prijavite.'
            : `Strežnik ni vrnil ponudb (napaka ${res.status}).`,
        )
        setProjects([])
        // R181: fail-closed pečat — napaka → BREZ pečata (v paru s čiščenjem)
        setPonudbeOsvezitev(null)
        return
      }
      const all = (await res.json().catch(() => null)) as FollowProject[] | null
      if (!Array.isArray(all)) {
        setError('Neveljaven odgovor strežnika.')
        setProjects([])
        // R181: fail-closed pečat — neveljaven odgovor → BREZ pečata
        setPonudbeOsvezitev(null)
        return
      }
      setProjects(all.filter((p) => !p.dealLocked))
      // R181: pečat SAMO ob uspešnem branju (1×)
      setPonudbeOsvezitev(new Date())
    } catch {
      setError('Ni povezave s strežnikom. Preverite omrežje in poskusite znova.')
      setProjects([])
      // R181: omrežje → BREZ pečata (v paru s čiščenjem)
      setPonudbeOsvezitev(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // R181 — ponovni bris ob vrnitvi v zavihek (družinski hook, 30 s vrata R170):
  // spomniki follow-upa so časovno kritični (zapadli klic stranke) — vrnitev v
  // CRM pomeni svež seznam. EN VIR: load = mount + "Poskusi znova" + fokus.
  useRefetchOnFocus(load)

  const today = useMemo(() => new Date(), [])
  const nowMs = today.getTime()

  const pending = useMemo(() => {
    return projects
      .filter((p) => p.status !== 'ZAKLJUCENO')
      .sort((a, b) => {
        if (a.followUpDate && b.followUpDate) return a.followUpDate.localeCompare(b.followUpDate)
        if (a.followUpDate) return -1
        if (b.followUpDate) return 1
        return a.nazivProjekta.localeCompare(b.nazivProjekta)
      })
      .slice(0, 12)
  }, [projects])

  const overdueCount = useMemo(
    () =>
      pending.filter(
        (p) => p.followUpDate && new Date(p.followUpDate).getTime() <= nowMs,
      ).length,
    [pending, nowMs],
  )
  const waitingCount = useMemo(
    () => pending.filter((p) => !p.followUpDate).length,
    [pending],
  )

  // R267 — F2 mini-vrstica (WYSIWYG ISTA izpeljava ponudbeSpomnikiPregled kot
  // PDF KPI + sklep + toast — ENA izpeljava): state = kar uporabnik vidi
  // (viden seznam — prvih 12 vrst kartice), FRESH fetch ob kliku = polna
  // resnica (dve okni, ENA matemtika — obe poimenovani po viru); stanje
  // spomnika EN VIR stanjeSpomnika (R161) — NIKOLI zasegana kopija.
  const spomnikiPovzetek = useMemo(() => {
    const danesIso = todayStamp(today)
    const stanja = pending.map((p) => stanjeSpomnika(p.followUpDate, danesIso))
    return {
      viden: pending.length,
      zapadel: stanja.filter((s) => s === 'Zapadel').length,
      danes: stanja.filter((s) => s === 'Danes').length,
      brez: stanja.filter((s) => s === 'Brez spomnika').length,
    }
  }, [pending, today])

  async function setFollowUp(id: string, date: Date | null, opomba?: string) {
    setBusyId(id)
    try {
      const res = await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          id,
          followUpDate: date ? date.toISOString() : null,
          ...(opomba !== undefined ? { followUpOpomba: opomba } : {}),
        }),
      })
      if (!res.ok) throw new Error(`Shranjevanje spomnika ni uspelo (napaka ${res.status}).`)
      setProjects((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, followUpDate: date ? date.toISOString() : null, ...(opomba !== undefined ? { followUpOpomba: opomba } : {}) }
            : p,
        ),
      )
      window.dispatchEvent(new CustomEvent('roksal:refresh'))
      toast({
        title: date ? `Spomnik: ${date.toLocaleDateString('sl-SI')}` : 'Spomnik odstranjen',
      })
    } catch (err) {
      // Fail-verbose: razlog gre v toast, ne tiho spodleteti.
      toast({
        title: 'Napaka',
        description:
          err instanceof Error && err.message !== 'Failed to fetch'
            ? err.message
            : 'Spomnika ni bilo mogoče shraniti. Preverite povezavo in poskusite znova.',
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
    }
  }

  function plusDays(id: string, days: number) {
    const d = new Date(nowMs + days * 86400000)
    void setFollowUp(id, d, `Pokliči stranko — sledenje ponudbe (+${days} dni)`)
  }

  // R267 — PONUDBE — SPOMNIŠKI PREGLED PDF (23. člen 'izvozi' družine):
  // FRESH fetch ISTEGA endpointa ob kliku (R244/R245/R264/R265/R266 precedens
  // — nič state-a, nič nove mreže) — DOKUMENT = POLNA resnica: VSE ponudbe,
  // TUDI podpisane (viden seznam kartice = samo odprte, prvih 12; PDF je
  // referenčni pregled cevi ponudb). HTTP napaka ALI ne-polje odgovora →
  // viden razlog (nič tihe degradacije); resnice (status 4 znanih,
  // dealLocked boolean, ISO, identitete) preverja LIB fail-closed z indeksom
  // krivca.
  const handleSpomnikiPdf = async () => {
    if (pdfVteku) return
    setPdfVteku(true)
    try {
      const res = await fetch('/api/projects', { credentials: 'same-origin' })
      if (!res.ok) {
        throw new Error(`GET /api/projects → HTTP ${res.status}`)
      }
      const data: unknown = await res.json()
      if (!Array.isArray(data)) {
        throw new TypeError('Odgovora /api/projects ni mogoče prebrati (ni polja).')
      }
      const vrstice = data as Array<Record<string, unknown>>
      // Fail-verbose DTO pruning (R264/R265/R266 vzorec): identitete tu
      // (imenovan razlog), ostalo VERBATIM — lib preveri z indeksom krivca.
      const vnosi: PonudbaSpomnikiVnos[] = vrstice.map((p, i) => {
        if (typeof p.id !== 'string' || p.id === '' || typeof p.nazivProjekta !== 'string' || p.nazivProjekta === '') {
          throw new TypeError(`ponudba vrstica ${i}: manjkajoč id/nazivProjekta v odgovoru API-ja`)
        }
        const strankaRaw = p.customer
        const stranka =
          strankaRaw !== null && typeof strankaRaw === 'object' && typeof (strankaRaw as { ime?: unknown }).ime === 'string'
            ? (strankaRaw as { ime: string }).ime
            : null
        return {
          id: p.id,
          nazivProjekta: p.nazivProjekta,
          stranka,
          status: p.status as PonudbaSpomnikiVnos['status'],
          dealLocked: p.dealLocked as boolean,
          followUpDate: typeof p.followUpDate === 'string' ? p.followUpDate : null,
          followUpOpomba: typeof p.followUpOpomba === 'string' ? p.followUpOpomba : null,
          datumMontaze: typeof p.datumMontaze === 'string' ? p.datumMontaze : null,
        }
      })
      if (vnosi.length === 0) {
        // Fail-closed jedro: prazen seznam ne nastaja dokumenta — iskren toast.
        toast({ title: 'Ni vpisanih ponudb', description: 'Pregled spomnikov se izvozi, ko je vpisana prva ponudba.' })
        return
      }
      // ENA izpeljava: povzetek za toast = ISTA resnica kot KPI IN sklep na
      // listu (WYSIWYG).
      const { povzetek } = ponudbeSpomnikiPregled(vnosi, new Date())
      generatePonudbeSpomnikiPdf(vnosi, { now: new Date() })
      toast({
        title: 'Pregled ponudb prenešen v PDF',
        description: `Ponudbe-spomniki-…pdf — ${ponudbeLabel(povzetek.ponudb)}, zapadel spomnik ${povzetek.zapadelOprtih}, podpisanih ${povzetek.podpisanih}.`,
      })
    } catch (err) {
      // Fail-verbose: izvoz ne sme tiho spodleteti — razlog gre v toast.
      // Fail-closed jedro (TypeError iz liba) = pokvaren vnos → viden razlog
      // (NIČ izmišljenega dokumenta).
      toast({
        title: 'Izvoz ni uspel',
        description: err instanceof Error && err.message !== 'Failed to fetch' ? err.message : `Neznana napaka (${String(err)}).`,
        variant: 'destructive',
      })
    } finally {
      setPdfVteku(false)
    }
  }

  const handleExportCsv = () => {
    if (pending.length === 0) return
    setExporting(true)
    try {
      // Izvozi TOČNO to, kar uporabnik vidi na kartici (prvih 12 vrst).
      const { csv, vrstic } = buildPonudbeCsv(
        pending.map((p) => ({
          nazivProjekta: p.nazivProjekta,
          stranka: p.customer?.ime ?? null,
          status: p.status,
          followUpDate: p.followUpDate,
          followUpOpomba: p.followUpOpomba,
          datumMontaze: p.datumMontaze,
        })),
        todayStamp(today),
      )
      const filename = ponudbeCsvFilename(todayStamp(today))
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast({ title: 'CSV izvožen', description: `Izvožen seznam (${ponudbeLabel(vrstic)}) v datoteko ${filename}.` })
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
    <Card className={overdueCount > 0 ? 'border-roksal-red/40' : undefined}>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base text-roksal-ink">
          <FileClock className="h-5 w-5 text-roksal-amber" aria-hidden="true" />
          Ponudbe — sledenje
          {ponudbeOsvezitev && (
            <span
              className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"
              title="Čas zadnje uspešne osvežitve podatkov"
            >
              <History className="h-3 w-3 shrink-0" aria-hidden="true" />
              Osveženo ob{' '}
              <span className="tabular-nums">{casOznaka(ponudbeOsvezitev)}</span>
            </span>
          )}
          <span className="ml-auto flex items-center gap-2">
            {overdueCount > 0 && (
              <Badge className="border border-roksal-red/40 bg-roksal-red/15 text-roksal-red hover:bg-roksal-red/15">
                <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
                {overdueCount} zapadel{overdueCount === 1 ? '' : 'i'}
              </Badge>
            )}
            {overdueCount === 0 && waitingCount > 0 && (
              <Badge variant="outline">
                {waitingCount} brez spomnika
              </Badge>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 shrink-0 gap-1.5 text-[11px] press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
              onClick={() => void handleSpomnikiPdf()}
              disabled={pdfVteku}
              aria-label="Izvozi pregled spomnikov ponudb kot PDF"
              title="Spomniški pregled ponudb kot pravi PDF — stanja spomnikov, podpisi (vse ponudbe, tudi podpisane)"
            >
              {pdfVteku ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <FileDown className="h-3 w-3" aria-hidden="true" />
              )}
              PDF
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 shrink-0 gap-1.5 text-[11px] focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
              onClick={handleExportCsv}
              disabled={pending.length === 0 || exporting || loading || error !== null}
              aria-label={`Izvozi prikazani seznam ponudb v CSV (${ponudbeLabel(pending.length)})`}
              title="Izvozi prikazani seznam ponudb v CSV"
            >
              {exporting ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-3 w-3" aria-hidden="true" />
              )}
              Izvozi CSV
            </Button>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* R267 — legenda pill pariteta (družina R263–R266): poimenuje kaj nosi
            dokument — VSE ponudbe, tudi podpisane (polna resnica, ne samo viden
            seznam); VEDNO vidna (tudi pri praznem seznamu — pariteta z pillom). */}
        <p className="text-2xs text-muted-foreground">
          PDF = VSE ponudbe (tudi podpisane — polna resnica, ne samo viden seznam)
        </p>
        {loading ? (
          <div className="flex items-center justify-center py-5 text-sm text-muted-foreground" aria-busy="true" aria-live="polite">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Nalagam ponudbe…
          </div>
        ) : error ? (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-xl border border-roksal-amber/40 bg-roksal-amber/10 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-roksal-amber" aria-hidden="true" />
              <p className="text-sm text-roksal-ink">{error}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void load()}
              className="shrink-0 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
              aria-label="Ponovno naloži seznam ponudb"
            >
              Poskusi znova
            </Button>
          </div>
        ) : pending.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground" role="status">
            Ni aktivnih ponudb za sledenje — vse zaključene ali podpisane. 🎉
          </p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {pending.map((p) => {
              const due = p.followUpDate ? new Date(p.followUpDate) : null
              const diff = due ? daysBetween(due, today) : null
              const isOverdue = diff !== null && diff <= 0
              const isSoon = diff !== null && diff > 0 && diff <= 3
              return (
                <li
                  key={p.id}
                  className={`rounded-lg border p-2.5 transition-colors ${
                    isOverdue
                      ? 'border-roksal-red/40 bg-roksal-red/10'
                      : isSoon
                        ? 'border-roksal-amber/40 bg-roksal-amber/10'
                        : 'border-border bg-card hover:border-roksal-navy/30 dark:hover:border-roksal-ink/30'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-roksal-ink">
                        {p.nazivProjekta}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.customer?.ime ?? 'Stranka ni določena'} · {STATUS_LABEL[p.status as keyof typeof STATUS_LABEL] ?? p.status}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {due ? (
                        <Badge
                          variant="outline"
                          className={
                            isOverdue
                              ? 'border-roksal-red/40 bg-roksal-red/15 text-roksal-red'
                              : isSoon
                                ? 'border-roksal-amber/40 bg-roksal-amber/15 text-roksal-amber'
                                : undefined
                          }
                        >
                          <CalendarClock className="mr-1 h-3 w-3" aria-hidden="true" />
                          {isOverdue ? `zapadlo ${fmt(p.followUpDate)}` : `${fmt(p.followUpDate)}`}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          brez spomnika
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={isOverdue ? 'default' : 'outline'}
                      className={`h-8 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 ${
                        isOverdue ? 'bg-roksal-navy hover:bg-roksal-navy/90' : ''
                      }`}
                      disabled={busyId === p.id}
                      onClick={() => plusDays(p.id, 0)}
                      title="Spomnik danes"
                    >
                      {busyId === p.id ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Phone className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      Pokliči {isOverdue ? 'zdaj' : ''}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
                      disabled={busyId === p.id}
                      onClick={() => plusDays(p.id, 3)}
                    >
                      +3 dni
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
                      disabled={busyId === p.id}
                      onClick={() => plusDays(p.id, 7)}
                    >
                      +7 dni
                    </Button>
                    <Input
                      type="date"
                      aria-label={`Datum spomnika: ${p.nazivProjekta}`}
                      className="h-8 w-[130px] text-xs tabular-nums"
                      value={p.followUpDate ? p.followUpDate.slice(0, 10) : ''}
                      onChange={(e) => {
                        const v = e.target.value
                        if (!v) {
                          void setFollowUp(p.id, null)
                        } else {
                          const d = new Date(v + 'T09:00:00')
                          if (!isNaN(d.getTime())) void setFollowUp(p.id, d)
                        }
                      }}
                    />
                    {p.followUpDate && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-roksal-red focus-visible:ring-2 focus-visible:ring-roksal-red/40"
                        aria-label={`Odstrani spomnik: ${p.nazivProjekta}`}
                        disabled={busyId === p.id}
                        onClick={() => void setFollowUp(p.id, null)}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {/* R267 — F2 spomniška mini-vrstica (WYSIWYG ISTA izpeljava
            stanjeSpomnika kot PDF KPI + sklep + toast — ENA izpeljava):
            state = kar uporabnik vidi (viden seznam), FRESH = polna resnica
            (dve okni, ENA matemtika); dot roksal-red/green — RED kadar
            zapadla akcija; kondicionalna žetona ŽIVO samo kadar > 0 — R256
            lekcija 4; tabular-nums; 0 novih hex. */}
        {!loading && !error && pending.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${spomnikiPovzetek.zapadel > 0 ? 'bg-roksal-red' : 'bg-roksal-green'}`} />
            <span className="tabular-nums">
              Spomniki (viden seznam): {ponudbeLabel(spomnikiPovzetek.viden)} · zapadel {spomnikiPovzetek.zapadel} · spomnik danes {spomnikiPovzetek.danes} · brez spomnika {spomnikiPovzetek.brez}
            </span>
            {spomnikiPovzetek.zapadel > 0 && (
              <span className="rounded-full border border-roksal-red/40 bg-roksal-red/10 px-2 py-0.5 text-2xs font-medium text-roksal-red">
                {spomnikiPovzetek.zapadel} zapadel spomnik
              </span>
            )}
            {spomnikiPovzetek.brez > 0 && (
              <span className="rounded-full border border-roksal-amber/40 bg-roksal-amber/10 px-2 py-0.5 text-2xs font-medium text-roksal-amber">
                {spomnikiPovzetek.brez} brez spomnika
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
