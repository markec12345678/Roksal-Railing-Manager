'use client'

// R137 — "Aktivne seje" (issue #5 §2/§9 samostojna uprava naprav).
// ---------------------------------------------------------------------------
// Zakaj: GET/DELETE /api/auth/sessions obstajata od R134, ampak SAMO prek
// API-ja — uporabnik ni imel načina, da vidi, na katerih napravah je njegov
// račun živ, ali da tujo napravo odjavi. Pri ukradenem žetonu je to prva
// samooskrbna poteza (poleg menjave gesla, ki jo je R137 prej prinesel prek
// PasswordDialog).
//
// R195 — gumb 'Odjavi ostale naprave' (DELETE /api/auth/sessions): en klik
// umakne vse druge žive seje, TRENUTNA ostane prijavljena ('počisti druge,
// jaz ostam'). Dvojna potrditev (prvi klik le oboroži gumb) — množičen
// dejanje ne sme slediti zamikanci. Uspeh → sonner toast + osvežitev seznama;
// napaka → viden error state (fail-verbose, NIČ tihega).
//
// Kontraktno:
//   • Vrne SAMO svoje seje (strežnik filtrira po profileId) — UI ne more
//     prikazati tujega. Tuj id na DELETE → 404, UI pokaže sporočilo in
//     osveži seznam (ni česa prikazati).
//   • Trenutne seje NI dovoljeno preklicati tukaj — za to je "Odjava" v
//     meniju (fantaske: odjava počisti še SW cache/sezjske ključe, §5).
//   • Fail-closed: napaka omrežja/401/404 → viden error state z možnostjo
//     ponovitve; NIČ tihega izgleda "prazno = vse urejeno".
//   • Datum/ura: Intl 'sl-SI' (določeno okolje oblike); UA opis prek
//     device-label (čisto deterministično, testirano).
import { useCallback, useEffect, useState } from 'react'
import {
  HelpCircle,
  History,
  Loader2,
  LogOut,
  Monitor,
  ShieldCheck,
  Smartphone,
  Tablet,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { deviceLabelLine, describeDevice } from '@/lib/device-label'
import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'
import { casOznaka } from '@/lib/osvezitev-fokus'

interface SessionRow {
  id: string
  current: boolean
  createdAt: string
  expiresAt: string
  userAgent: string | null
  ip: string | null
}

interface SessionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const dtf = new Intl.DateTimeFormat('sl-SI', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function fmt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return dtf.format(d)
}

function DeviceIcon({ ua, className }: { ua: string | null; className?: string }) {
  const kind = describeDevice(ua).device
  if (kind === 'Telefon') return <Smartphone className={className} aria-hidden="true" />
  if (kind === 'Tablica') return <Tablet className={className} aria-hidden="true" />
  if (kind === 'Računalnik') return <Monitor className={className} aria-hidden="true" />
  return <HelpCircle className={className} aria-hidden="true" />
}

export function SessionsDialog({ open, onOpenChange }: SessionsDialogProps) {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  // R195 — oboroženost masovnega gumba (prvi klik = potrditev, ne dejanje)
  const [ostaliArmed, setOstaliArmed] = useState(false)
  // R184 — pečat svežine (20. površina družine R170–R183): čas zadnjega
  // USPEŠNEGA branja /api/auth/sessions. Napaka/omrežje/401/404 → null
  // (fail-closed — NIČ lažne svežine; napaka ostane vidna, BREZ pečata).
  const [sejeOsvezitev, setSejeOsvezitev] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/sessions', { credentials: 'same-origin' })
      if (!res.ok) {
        // 401 → seja je medtem padla; 5xx → strežnik. Oboje viden state.
        setError(
          res.status === 401
            ? 'Prijava je potekla. Ponovno se prijavite.'
            : `Strežnik ni vrnil sej (napaka ${res.status}).`,
        )
        setSessions(null)
        // R184: fail-closed pečat — napaka → BREZ pečata (v paru s čiščenjem)
        setSejeOsvezitev(null)
        return
      }
      const data = (await res.json().catch(() => null)) as { sessions?: SessionRow[] } | null
      if (!data || !Array.isArray(data.sessions)) {
        setError('Neveljaven odgovor strežnika.')
        setSessions(null)
        setSejeOsvezitev(null)
        return
      }
      setSessions(data.sessions)
      // R184: pečat SAMO ob uspešnem branju (1×)
      setSejeOsvezitev(new Date())
    } catch {
      setError('Ni povezave s strežnikom. Preverite omrežje in poskusite znova.')
      setSessions(null)
      // R184: omrežje → BREZ pečata (v paru z napako)
      setSejeOsvezitev(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Vsako odpirje = sveža poizvedba (stanje sej se lahko spremeni zunaj).
    if (open) void load()
    // R195: zaprtje dialoga razoroži masovni gumb (stanje ne preživi odpirja).
    else setOstaliArmed(false)
  }, [open, load])

  // R184 — ponovni bris ob vrnitvi v ospredje, MEDTEM KO je dialog odprt
  // (družinski hook, 30 s vrata R170; wrapper `open` = precedens R181
  // punch-list — zaprt dialog ne sme fetchati v ozadju brez razloga).
  // EN VIR: load = odpirje + Znova + preklic + fokus.
  useRefetchOnFocus(() => {
    if (open) void load()
  })

  async function revoke(id: string) {
    setRevokingId(id)
    try {
      await fetch(`/api/auth/sessions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      // Ne glede na izid (200 ali 404 "že ne obstaja") — osveži seznam.
      await load()
    } catch {
      setError('Preklic seje ni uspel. Poskusite znova.')
    } finally {
      setRevokingId(null)
    }
  }

  // R195 — masovna odjava ostalih naprav. Prvi klik SAMO oboroži (potrditev),
  // šele drugi izvede. Uspeh → toast z številom + osvežitev; napaka → error
  // state (fail-verbose). Med izvedbo je sentinel '__ostali__' v revokingId,
  // tako da so tudi posamezni gumbi onemogočeni (en vir zaklepa).
  const ostaliCount = sessions ? sessions.filter((s) => !s.current).length : 0

  async function revokeOstale() {
    if (!ostaliArmed) {
      setOstaliArmed(true)
      return
    }
    setOstaliArmed(false)
    setRevokingId('__ostali__')
    try {
      const res = await fetch('/api/auth/sessions', {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setError(
          data?.error
            ? `Odjava ostalih naprav ni uspela: ${data.error}`
            : `Odjava ostalih naprav ni uspela (napaka ${res.status}).`,
        )
        return
      }
      const data = (await res.json().catch(() => null)) as { revoked?: number } | null
      const n = typeof data?.revoked === 'number' ? data.revoked : 0
      toast.success('Ostale naprave so odjavljene', {
        description: n === 1 ? 'Odjavljena je 1 seja.' : `Odjavljenih sej: ${n}.`,
      })
      await load()
    } catch {
      setError('Odjava ostalih naprav ni uspela. Preverite omrežje in poskusite znova.')
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-roksal-ink">
            <ShieldCheck className="h-5 w-5 text-roksal-green" aria-hidden="true" />
            Aktivne seje
          </DialogTitle>
          <DialogDescription>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span>
                Naprave, ki so prijavljene v vaš račun. Tujim sejam lahko dostop
                prekličete — veljajo za odjavo te naprave.
              </span>
              {sejeOsvezitev && (
                <span
                  className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"
                  title="Čas zadnje uspešne osvežitve podatkov"
                >
                  <History className="h-3 w-3 shrink-0" aria-hidden="true" />
                  Osveženo ob{' '}
                  <span className="tabular-nums">{casOznaka(sejeOsvezitev)}</span>
                </span>
              )}
            </span>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2 py-1" aria-busy="true" aria-live="polite">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex items-center gap-3 rounded-xl border border-border/50 p-3">
                <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-roksal-red/20 bg-roksal-red/5 p-3"
          >
            <div className="min-w-0 flex-1 text-sm text-roksal-ink">{error}</div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              className="h-8 shrink-0 press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
            >
              Znova
            </Button>
          </div>
        ) : sessions && sessions.length > 0 ? (
          <ul className="max-h-80 space-y-0 divide-y divide-border/50 overflow-y-auto rounded-xl border border-border/50 scrollbar-thin" aria-live="polite">
            {sessions.map((s, i) => {
              const label = describeDevice(s.userAgent)
              const revoking = revokingId === s.id
              return (
                <li
                  key={s.id}
                  className="flex items-start gap-3 p-3 transition-colors duration-150 animate-fade-in-up hover:bg-secondary/20"
                  style={{ animationDelay: `${Math.min(i * 60, 240)}ms` }}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      s.current
                        ? 'bg-roksal-green/10 text-roksal-green'
                        : 'bg-roksal-navy/5 text-roksal-ink'
                    }`}
                  >
                    <DeviceIcon ua={s.userAgent} className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-roksal-ink">
                        {label.device}
                      </p>
                      {s.current && (
                        <Badge className="h-5 shrink-0 bg-roksal-green/15 px-1.5 text-2xs text-roksal-green hover:bg-roksal-green/15">
                          Ta naprava
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {label.os} · {label.browser}
                    </p>
                    <p className="mt-1 text-2xs tabular-nums text-muted-foreground">
                      Prijava: {fmt(s.createdAt)}
                    </p>
                    <p className="text-2xs tabular-nums text-muted-foreground">
                      Velja do: {fmt(s.expiresAt)}
                      {s.ip ? ` · IP ${s.ip}` : ''}
                    </p>
                    <p className="sr-only">{deviceLabelLine(s.userAgent)}</p>
                  </div>
                  {!s.current && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void revoke(s.id)}
                      disabled={revokingId !== null}
                      aria-label={`Prekliči sejo na napravi: ${label.device}, ${label.os}`}
                      className="h-7 shrink-0 gap-1 border-roksal-red/30 px-2 text-2xs text-roksal-red hover:bg-roksal-red/10 press-scale focus-visible:ring-2 focus-visible:ring-roksal-red/40"
                    >
                      {revoking ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                      ) : (
                        <X className="h-3 w-3" aria-hidden="true" />
                      )}
                      Prekliči
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Ni aktivnih sej — to se ne sme zgoditi med prijavo (fail-closed).
          </p>
        )}

        <DialogFooter className="items-center justify-between gap-2 sm:justify-between">
          <p className="text-2xs text-muted-foreground tabular-nums">
            {sessions ? `${sessions.length} ${sessions.length === 1 ? 'aktivna seja' : 'aktivnih sej'}` : ''}
          </p>
          <div className="flex items-center gap-2">
            {ostaliCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void revokeOstale()}
                disabled={revokingId !== null}
                aria-label={`Odjavi vse ostale naprave (${ostaliCount}) — ta naprava ostaja prijavljena`}
                className="h-8 gap-1.5 border-roksal-red/30 px-2.5 text-xs text-roksal-red hover:bg-roksal-red/10 press-scale focus-visible:ring-2 focus-visible:ring-roksal-red/40"
              >
                {revokingId === '__ostali__' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {ostaliArmed
                  ? `Potrdi — odjavi ${ostaliCount} ${ostaliCount === 1 ? 'napravo' : 'naprav'}?`
                  : `Odjavi ostale naprave (${ostaliCount})`}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
            >
              Zapri
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
