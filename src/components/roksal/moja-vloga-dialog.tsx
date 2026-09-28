'use client'

// R240 — "Moja vloga in dovoljenja" (TopBar → Račun meni)
// ---------------------------------------------------------------------------
// Zakaj: R239 je postavil RBAC vrata na POST /api/projects in UI ogledalo
// (gumb 'Nov projekt' viden samo vodstvu). Iskrenost zahteva tudi OBRATNO
// smer: uporabnik, ki gumba ne vidi, mora lahko V SAMA App ugotoviti ZAKAJ —
// brez vprašanja pisarni, brez ugibanja. GET /api/auth od R135 vrača
// `permissions: permissionsForRole(vloga)` — ta dialog ga PRVIČ prikaže
// človeku berljivo.
//
// Kontraktno (sessions-dialog vzorec):
//   • Podatki se naložijo ŠELE ob odprtju (fetch on open — ni dodatnega
//     klica ob vsakem mountu TopBar); ponovni odprtje = sveži podatki.
//   • Fail-closed/iskrenost: neznana vloga → permissionsForRole() = prazen
//     seznam → vsa dovoljenja prikazana kot "nima" (NIKOLI lažni "ima");
//     manjkajoča dovoljenja = manjkajocaDovoljenja() iz permissions-core
//     (isti katalog kot strežnik — EN VIR RESNICE).
//   • Fail-verbose: omrežna/HTTP napaka → viden error state z razlogom in
//     gumbom Poskusi znova (NIČ tihega "prazno = vse urejeno").
//   • Vizualni jezik chipa = ISTI kot v ekipi (ROLE_CHIP iz team-tab —
//     en vir stila); vloga oznaka = EKIPA_VLOGE iz ekipa-csv (en vir
//     resnice za izvoz in UI, R160 precedens).
//   • Vrstni red dovoljenj = deterministični vrstni red kataloga (frozen).
//   • Zero mutacija: samo GET /api/auth (bralni tok, brez pisanja).
import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Lock, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ALL_PERMISSIONS, PERMISSION_CATALOG, manjkajocaDovoljenja } from '@/lib/permissions-core'
import { ROLE_CHIP, isManagerRole } from '@/lib/status-options'
import { EKIPA_VLOGE } from '@/lib/ekipa-csv'

interface MojaVlogaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Vsebina GET /api/auth, ki jo dialog rabi (ostala polja ignorirana). */
interface MojaVlogaPodatki {
  ime: string | null
  email: string
  vloga: string
  permissions: string[]
  /** Manjkajoča = katalog − permissions (izračun ENKRAT ob nalaganju). */
  manjkajoca: string[]
}

const PRAZEN_CHIP = 'bg-secondary text-muted-foreground ring-1 ring-inset ring-border'

export function MojaVlogaDialog({ open, onOpenChange }: MojaVlogaDialogProps) {
  const [podatki, setPodatki] = useState<MojaVlogaPodatki | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nalozi = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth')
      const data = (await res.json().catch(() => null)) as
        | { user?: { ime?: string | null; email?: string; vloga?: string }; permissions?: string[]; error?: string }
        | null
      if (!res.ok || !data?.user?.vloga) {
        // Fail-verbose: razlog pride do uporabnika (401/500/…).
        setError(data?.error || `Nalaganje vloge ni uspelo (HTTP ${res.status}).`)
        setPodatki(null)
        return
      }
      const permissions = Array.isArray(data.permissions) ? data.permissions : []
      setPodatki({
        ime: data.user.ime ?? null,
        email: data.user.email ?? '',
        vloga: data.user.vloga,
        permissions,
        // ENA resnica za "nima": ISTI katalog kot strežnik (permissions-core).
        manjkajoca: manjkajocaDovoljenja(permissions),
      })
    } catch {
      setError('Napaka pri povezavi s strežnikom. Poskusite znova.')
      setPodatki(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch on open — vsako odprtje = sveži podatki (sessions-dialog vzorec).
  useEffect(() => {
    if (open) void nalozi()
  }, [open, nalozi])

  const ima = podatki ? ALL_PERMISSIONS.length - podatki.manjkajoca.length : 0
  const skupaj = ALL_PERMISSIONS.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-roksal-ink">
            <ShieldCheck className="h-5 w-5 text-roksal-green" aria-hidden="true" />
            Moja vloga in dovoljenja
          </DialogTitle>
          <DialogDescription>
            Kaj vaš račun sme v aplikaciji — isti matrika, ki jo preverja strežnik.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-roksal-red/30 bg-roksal-red/5 p-3 text-sm text-roksal-red" role="alert">
            {error}
            <Button
              variant="outline"
              size="sm"
              className="ml-3 h-7 px-2 text-xs focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
              onClick={() => void nalozi()}
              disabled={loading}
            >
              Poskusi znova
            </Button>
          </div>
        )}

        {loading && !podatki && (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span className="text-sm">Nalaganje …</span>
          </div>
        )}

        {podatki && (
          <>
            {/* Identiteta + vloga — chip = ISTI vizualni jezik kot ekipa */}
            <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-roksal-ink">
                  {podatki.ime || podatki.email}
                </p>
                <p className="truncate text-2xs text-muted-foreground">{podatki.email}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-2xs font-medium ${ROLE_CHIP[podatki.vloga] ?? PRAZEN_CHIP}`}
                title={`Vloga: ${EKIPA_VLOGE[podatki.vloga] ?? podatki.vloga}`}
              >
                {EKIPA_VLOGE[podatki.vloga] ?? podatki.vloga}
              </span>
            </div>
            {isManagerRole(podatki.vloga) && (
              <p className="text-2xs text-muted-foreground">
                Vodstvena vloga — ustvarjanje projektov, upravljanje ekipe in kataloga.
              </p>
            )}

            <div>
              <p className="mb-2 text-xs font-medium text-roksal-ink">
                Imate {ima} od {skupaj} dovoljenj
              </p>
              <ul className="space-y-1.5">
                {ALL_PERMISSIONS.map((dovoljenje) => {
                  const lastno = !podatki.manjkajoca.includes(dovoljenje)
                  const katalog = PERMISSION_CATALOG[dovoljenje]
                  return (
                    <li key={dovoljenje} className="flex items-start gap-2">
                      {lastno ? (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-roksal-green" aria-hidden="true" />
                      ) : (
                        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                      )}
                      <div className="min-w-0">
                        <p
                          className={`text-xs leading-tight ${lastno ? 'text-roksal-ink' : 'text-muted-foreground'}`}
                          title={`${dovoljenje} — ${katalog?.opis ?? dovoljenje}`}
                        >
                          {katalog?.label ?? dovoljenje}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          </>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
          >
            Zapri
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
