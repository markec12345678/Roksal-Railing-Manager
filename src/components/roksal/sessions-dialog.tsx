'use client'

// R137 — "Aktivne seje" (issue #5 §2/§9 samostojna uprava naprav).
// ---------------------------------------------------------------------------
// Zakaj: GET/DELETE /api/auth/sessions obstajata od R134, ampak SAMO prek
// API-ja — uporabnik ni imel načina, da vidi, na katerih napravah je njegov
// račun živ, ali da tujo napravo odjavi. Pri ukradenem žetonu je to prva
// samooskrbna poteza (poleg menjave gesla, ki jo je R137 prej prinesel prek
// PasswordDialog).
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
  Loader2,
  Monitor,
  ShieldCheck,
  Smartphone,
  Tablet,
  X,
} from 'lucide-react'
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
        return
      }
      const data = (await res.json().catch(() => null)) as { sessions?: SessionRow[] } | null
      if (!data || !Array.isArray(data.sessions)) {
        setError('Neveljaven odgovor strežnika.')
        setSessions(null)
        return
      }
      setSessions(data.sessions)
    } catch {
      setError('Ni povezave s strežnikom. Preverite omrežje in poskusite znova.')
      setSessions(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Vsako odpirje = sveža poizvedba (stanje sej se lahko spremeni zunaj).
    if (open) void load()
  }, [open, load])

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-roksal-navy">
            <ShieldCheck className="h-5 w-5 text-roksal-green" aria-hidden="true" />
            Aktivne seje
          </DialogTitle>
          <DialogDescription>
            Naprave, ki so prijavljene v vaš račun. Tujim sejam lahko dostop
            prekličete — veljajo za odjavo te naprave.
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
            <div className="min-w-0 flex-1 text-sm text-roksal-navy">{error}</div>
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
                        : 'bg-roksal-navy/5 text-roksal-navy'
                    }`}
                  >
                    <DeviceIcon ua={s.userAgent} className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-roksal-navy">
                        {label.device}
                      </p>
                      {s.current && (
                        <Badge className="h-5 shrink-0 bg-roksal-green/15 px-1.5 text-[10px] text-roksal-green hover:bg-roksal-green/15">
                          Ta naprava
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {label.os} · {label.browser}
                    </p>
                    <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                      Prijava: {fmt(s.createdAt)}
                    </p>
                    <p className="text-[10px] tabular-nums text-muted-foreground">
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
                      className="h-7 shrink-0 gap-1 border-roksal-red/30 px-2 text-[10px] text-roksal-red hover:bg-roksal-red/10 press-scale focus-visible:ring-2 focus-visible:ring-roksal-red/40"
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
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {sessions ? `${sessions.length} ${sessions.length === 1 ? 'aktivna seja' : 'aktivnih sej'}` : ''}
          </p>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
          >
            Zapri
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
