'use client'

// R166 — kartica "Termini — naslednjih 7 dni" (dashboard).
// ---------------------------------------------------------------------------
// Monter na terenu po prijavi TAKOJ vidi, kam gre danes/ta teden — doslej je
// moral odkleniti Več → Logistika → Koledar. Kartica je bralni agregat nad
// obstoječim GET /api/schedules (isti dostop, ki ga MONTER že ima v
// Logistiki — nič nove izpostavljenosti podatkov).
//
// Načela:
//  • FAIL-VERBOSE (vzorec R161–R163): padec APIja NI tiho prazno stanje —
//    viden role=alert panel z razlogom (401/5xx/neveljaven JSON/omrežje) +
//    "Poskusi znova". Statistika se ne pokaže, dokler niso podatki zares tu.
//  • FAIL-CLOSED prikaz: neveljavni vnosi se NE prikažejo izmišljeni —
//    štejejo se v vidno "preskočeno" opombo (lib/termini-prikaz).
//  • Temna tema od začetka: samo semantični žetoni (bg-card, roksal-ink,
//    roksal-amber …) z dark: variantami — nauček R162–R165.
//  • IZVOŽENO = ZASLON tu ne velja (ni izvoza); kartica pokaže točno tisto,
//    kar vrne API v oknu [danes, +6 dni], razvrščeno po času.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  Copy,
  Filter,
  MapPin,
  RefreshCw,
  User,
  Users,
  Wrench,
} from 'lucide-react'
import {
  buildTerminShareText,
  filtrirajTermini,
  groupTermini,
  scheduleTerminiStatusColor,
  scheduleTerminiStatusLabel,
  terminCasLabel,
  terminDatumLabel,
  terminiOkno,
  terminUrPovzetek,
  vsotaPredvidenihUr,
  type TerminPrikazVnos,
} from '@/lib/termini-prikaz'

interface TerminiCardProps {
  /** Profile.id prijavljenega (GET /api/auth → user.id). null → brez
   *  "moja montaža" poudarka (nikoli ugibanj, least privilege). */
  myUserId: string | null
  /** Odprtje podrobnosti projekta (dashboard poišče Projekt po id; če
   *  projekta ni v naloženem seznamu, klik mirno ne naredi nič — fail-closed,
   *  brez lažnih podrobnosti iz sintetiziranega objekta). */
  onOpenProjectId?: (projectId: string) => void
}

interface NapakaNalaganja {
  razlog: string
}

function razlogIzOdgovora(status: number): string {
  if (status === 401) return 'Seja je potekla ali nimate dostopa (401).'
  if (status === 403) return 'Dostop zavrnjen (403).'
  if (status >= 500) return `Strežniška napaka (${status}).`
  return `Neznana napaka strežnika (${status}).`
}

export function TerminiCard({ myUserId, onOpenProjectId }: TerminiCardProps) {
  // R166 E2E nauček: Surove vrstice shranimo, skupine izračunamo v useMemo
  // ([vrstice, zdaj, myUserId]) — prihod Profile.id (myUserId: null → id)
  // tako NE sproži novega fetcha in NE abortira tekočega (prej: dvojni fetch
  // + abort sredi json() → lažno "Neveljaven odgovor" utripnil med nalaganjem).
  const [vrstice, setVrstice] = useState<unknown[] | null>(null)
  /** Referenčni trenutek branja — IZRAČUNAN ENKRAT na fetch, skupna baza za
   *  razvrstitev (groupTermini) in oznake ("Danes"/"Jutri") — brez milisekund
   *  neskladja ob polnoči. */
  const [zdaj, setZdaj] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [napaka, setNapaka] = useState<NapakaNalaganja | null>(null)
  const [osvezujem, setOsvezujem] = useState(false)
  // R167 — "samo moje termine" filter (client-side, brez novega fetcha).
  // Stikalo se sploh ne izriše brez znane identitete (myUserId) — least
  // privilege; lib je tudi brez identitete fail-closed (prazen seznam).
  const [samoMoje, setSamoMoje] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const skupine = useMemo(
    () => (vrstice && zdaj ? groupTermini(vrstice, zdaj, myUserId) : null),
    [vrstice, zdaj, myUserId]
  )

  // R167 — filtrirani prikaz: skupine (in preskočeni števec) ostanejo
  // RAWSKI (podatkovna resnica), prikazane vrstice pa filtrirane. Filter je
  // čista funkcija iz lib (fail-closed, testirana) — brez nove logike tu.
  const prikazane = useMemo(() => {
    if (!skupine) return null
    return {
      danes: filtrirajTermini(skupine.danes, samoMoje, myUserId),
      kasneje: filtrirajTermini(skupine.kasneje, samoMoje, myUserId),
    }
  }, [skupine, samoMoje, myUserId])

  // R168 — agregat predvidenih ur nad FILTRIRANIM pogledom ("kar vidiš, to
  // se sešteje"): stikalo 'Samo moje' samodejno prešteje vsoto. Čista lib
  // funkcija (PREKlicANO izključen + vidno preštet; brez ure → '≥' meja).
  const urAgregat = useMemo(() => {
    if (!prikazane) return null
    return vsotaPredvidenihUr([...prikazane.danes, ...prikazane.kasneje])
  }, [prikazane])

  // Fetch je NEODVISEN od myUserId (branje terminov ne zahteva identitete;
  // "moja montaža" je izračun pri izrisu — least privilege, brez ponovnega branja).
  const nalozi = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setOsvezujem(true)
    setNapaka(null)
    try {
      const okno = terminiOkno(new Date())
      const res = await fetch(
        `/api/schedules?od=${encodeURIComponent(okno.od)}&do=${encodeURIComponent(okno.do)}&limit=50`,
        { credentials: 'same-origin', signal: controller.signal }
      )
      if (!res.ok) {
        // FAIL-VERBOSE: pokazemo točen razlog, ne lažnega "ni terminov".
        setNapaka({ razlog: razlogIzOdgovora(res.status) })
        setVrstice(null)
        setZdaj(null)
        return
      }
      // Abort sredi branja telesa NE sme postati "neveljaven odgovor" —
      // preverimo signal eksplicitno (nauček E2E R166).
      let data: unknown = null
      try {
        data = await res.json()
      } catch (err) {
        if (controller.signal.aborted) return
        data = null
      }
      if (!Array.isArray(data)) {
        setNapaka({ razlog: 'Neveljaven odgovor strežnika (ni seznam terminov).' })
        setVrstice(null)
        setZdaj(null)
        return
      }
      setZdaj(new Date())
      setVrstice(data)
    } catch (err) {
      if (controller.signal.aborted) return // prekinjeno s strani novega klica
      setNapaka({
        razlog:
          err instanceof Error
            ? `Ni povezave — termini niso naloženi (${err.name}).`
            : 'Ni povezave — termini niso naloženi.',
      })
      setVrstice(null)
      setZdaj(null)
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
        setOsvezujem(false)
      }
    }
  }, [])

  useEffect(() => {
    void nalozi()
    return () => abortRef.current?.abort()
  }, [nalozi])

  const skupnoSkupin =
    (prikazane?.danes.length ?? 0) + (prikazane?.kasneje.length ?? 0)
  const preskoceni =
    (skupine?.preskoceniNeveljaven ?? 0) + (skupine?.preskoceniNeznanStatus ?? 0)

  // R167 — kopiraj podrobnosti termina v odložišče (delitev SMS/WhatsApp).
  // Fail-verbose: napaka odložišča je viden toast, ne tihi uspeh/neuspeh.
  const kopiraj = useCallback(
    async (t: TerminPrikazVnos) => {
      try {
        const besedilo = buildTerminShareText(t, zdaj ?? new Date())
        await navigator.clipboard.writeText(besedilo)
        toast.success('Termin kopiran v odložišče')
      } catch (err) {
        toast.error(
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Brskalnik je zavrnil dostop do odložišča (dovoljenje).'
            : `Kopiranje ni uspelo (${err instanceof Error ? err.name : 'neznana napaka'}).`
        )
      }
    },
    [zdaj]
  )

  const vrstica = (t: TerminPrikazVnos) => {
    // R167 — a11y: label izračunan IZVEN JSX (nauček R165: skener prepozna
    // samo {ident}/{ident[key]} oblike) — isti fallback besedilo kot vidna
    // vrstica ('Ni imena projekta'), nikoli sintetiziranih podatkov.
    const kopirajLabel = `Kopiraj podrobnosti termina: ${t.projektIme ?? 'Ni imena projekta'}`
    const vsebina = (
      <>
        <div className="flex w-16 shrink-0 flex-col items-start">
          <span className="text-[11px] font-medium text-muted-foreground">
            {terminDatumLabel(t.datumZacetka, zdaj ?? new Date())}
          </span>
          <span className="flex items-center gap-1 text-sm font-bold tabular-nums text-roksal-ink">
            <Clock className="h-3 w-3 text-roksal-amber" aria-hidden="true" />
            {terminCasLabel(t.datumZacetka)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-roksal-ink">
            {t.projektIme ?? 'Ni imena projekta'}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {t.strankaIme ?? 'Ni stranke'}
            {t.strankaNaslov ? ` · ${t.strankaNaslov}` : ''}
          </p>
          {(t.lokacija || t.ekipaIme || t.monterIme) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              {t.lokacija && (
                <span className="flex min-w-0 items-center gap-1">
                  <MapPin className="h-3 w-3 text-roksal-amber" aria-hidden="true" />
                  <span className="truncate">{t.lokacija}</span>
                </span>
              )}
              {t.ekipaIme && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" aria-hidden="true" />
                  {t.ekipaIme}
                </span>
              )}
              {t.monterIme && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" aria-hidden="true" />
                  {t.monterIme}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge
            className={`${scheduleTerminiStatusColor(t.status)} text-[10px] px-2 py-0.5`}
          >
            {scheduleTerminiStatusLabel(t.status)}
          </Badge>
          {t.moja && (
            <Badge className="bg-roksal-amber/20 text-roksal-ink dark:text-roksal-amber text-[10px] px-2 py-0.5">
              <Wrench className="mr-1 h-2.5 w-2.5" aria-hidden="true" />
              Moja montaža
            </Badge>
          )}
        </div>
      </>
    )
    const obrobe = t.moja
      ? 'border-l-2 border-l-roksal-amber bg-roksal-amber/10 hover:bg-roksal-amber/15 dark:bg-roksal-amber/15 dark:hover:bg-roksal-amber/20'
      : 'border-l-2 border-l-transparent hover:bg-accent/50'

    // R167 — vrstica = ovojnica (relative) + vrstica-button + KOPIRAJ gumb kot
    // SIBLING (ne otrok) — gnezdeni gumbi so neveljavni HTML in hidracijsko
    // tveganje; klik na kopiraj ne sproži odprtja projekta (ločena elementa).
    return (
      <div key={t.id} className="relative">
        {onOpenProjectId && t.projectId ? (
          <button
            type="button"
            onClick={() => onOpenProjectId(t.projectId)}
            className={`flex w-full items-start gap-3 rounded-lg py-2.5 pl-3 pr-12 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 dark:focus-visible:ring-roksal-ink/40 active:scale-[0.99] ${obrobe}`}
          >
            {vsebina}
          </button>
        ) : (
          <div
            className={`flex items-start gap-3 rounded-lg py-2.5 pl-3 pr-12 transition-colors ${obrobe}`}
          >
            {vsebina}
          </div>
        )}
        <button
          type="button"
          onClick={() => void kopiraj(t)}
          aria-label={kopirajLabel}
          title="Kopiraj v odložišče (za SMS/WhatsApp)"
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-roksal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 dark:focus-visible:ring-roksal-ink/40 dark:hover:text-roksal-ink"
        >
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <Card
      className="card-accent-top overflow-hidden border-l-4 border-l-roksal-navy transition-all duration-200"
      aria-busy={loading}
    >
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
            <CalendarDays className="h-4 w-4 text-roksal-amber" aria-hidden="true" />
            Termini — naslednjih 7 dni
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {skupnoSkupin > 0 && (
              <Badge className="bg-roksal-navy/10 text-roksal-ink hover:bg-roksal-navy/15 tabular-nums">
                {skupnoSkupin}
              </Badge>
            )}
            {/* R167 — "Samo moje" filter: samo z znano identiteto (least
                privilege); aria-pressed = pravo stikalo, ne skriti meni. */}
            {myUserId && (
              <Button
                variant={samoMoje ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-[11px] font-medium focus-visible:ring-2 focus-visible:ring-roksal-navy/40 dark:focus-visible:ring-roksal-ink/40"
                onClick={() => setSamoMoje((v) => !v)}
                aria-pressed={samoMoje}
                aria-label="Samo moje termine"
                title="Pokaže samo termine, kjer sem določen za monterja"
              >
                <Filter
                  className={`h-3.5 w-3.5 ${samoMoje ? 'text-roksal-amber' : 'text-muted-foreground'}`}
                  aria-hidden="true"
                />
                Samo moje
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 dark:focus-visible:ring-roksal-ink/40"
              onClick={() => void nalozi()}
              aria-label="Osveži termine"
              title="Osveži termine"
              disabled={osvezujem}
            >
              <RefreshCw
                className={`h-4 w-4 text-muted-foreground ${osvezujem ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {loading && vrstice === null ? (
          <div className="space-y-2" role="status" aria-live="polite">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <span className="sr-only">Nalagam termine …</span>
          </div>
        ) : napaka ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-roksal-red/30 bg-roksal-red/10 px-3 py-2.5"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-roksal-red" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-roksal-red">{napaka.razlog}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 h-7 border-roksal-red/40 text-roksal-red hover:bg-roksal-red/10 hover:text-roksal-red focus-visible:ring-2 focus-visible:ring-roksal-red/40"
                onClick={() => void nalozi()}
              >
                <RefreshCw className="mr-1.5 h-3 w-3" aria-hidden="true" />
                Poskusi znova
              </Button>
            </div>
          </div>
        ) : skupnoSkupin === 0 ? (
          <div className="flex items-center gap-2 py-4 text-muted-foreground">
            <CalendarDays className="h-5 w-5 text-roksal-green" aria-hidden="true" />
            <span className="text-sm">
              {samoMoje
                ? 'Ni vaših terminov v naslednjih 7 dneh.'
                : 'Ni terminov v naslednjih 7 dneh.'}
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            {/* R168 — povzetek predvidenih ur nad prikazanimi (filtriranimi)
                termini. Izračunan iz ISTIH vrstic, ki so prikazane spodaj —
                vsota odraža stikalo 'Samo moje' (kar vidiš, to se sešteje).
                PREKlicANO izključen + vidno omenjen; brez znane ure → '≥'
                (matematično resnična spodnja meja, nikoli izmišljene ure). */}
            {urAgregat && (
              <p
                className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md bg-muted/60 px-2.5 py-1.5 text-[11px] text-muted-foreground"
                title="Vsota predvidenih ur prikazanih terminov (preklicani so izključeni)"
              >
                <Clock className="h-3 w-3 shrink-0 text-roksal-amber" aria-hidden="true" />
                <span className="tabular-nums font-medium">{terminUrPovzetek(urAgregat)}</span>
              </p>
            )}
            {prikazane && prikazane.danes.length > 0 && (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Danes
                  <span className="tabular-nums">{prikazane.danes.length}</span>
                </p>
                <div className="space-y-1.5">{prikazane.danes.map(vrstica)}</div>
              </div>
            )}
            {prikazane && prikazane.kasneje.length > 0 && (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Naslednjih 6 dni
                  <span className="tabular-nums">{prikazane.kasneje.length}</span>
                </p>
                <div className="space-y-1.5">{prikazane.kasneje.map(vrstica)}</div>
              </div>
            )}
            {preskoceni > 0 && (
              <p
                role="note"
                className="rounded-md border border-roksal-amber/40 bg-roksal-amber/10 px-2.5 py-1.5 text-[11px] text-roksal-ink dark:text-roksal-amber"
              >
                {preskoceni} {preskoceni === 1 ? 'vnos preskočen' : 'vnosov preskočenih'}{' '}
                (neveljaven datum/status) — prikazani so samo veljavni termini.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
