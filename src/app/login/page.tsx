'use client'

// Roksal — prijava
// ---------------------------------------------------------------------------
// Pred tem zaslon ni obstajal: aplikacija ni imela prijave, `/api/auth` pa je
// za poljuben e-mail ustvaril ADMIN račun. Middleware zdaj preusmeri vsakogar
// brez veljavne seje sem.

import * as React from 'react'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ShieldAlert, Zap } from 'lucide-react'

// `useSearchParams()` brez <Suspense> pade samo v produkcijski gradnji:
//   ⨯ useSearchParams() should be wrapped in a suspense boundary at page "/login"
//   Error occurred prerendering page "/login"
// Next med `next build` statično predizriše /login, dostop do iskalnih parametrov
// pa je CSR-bailout, ki mora biti razmejen. Zato je obrazec v notranji komponenti,
// privzeti izvoz pa ga ovije v Suspense. V `next dev` te napake ni — ujame jo
// šele gradnja, kar je razlog, da je CI korak 'Gradnja' obvezen.
function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [demoBusy, setDemoBusy] = React.useState(false)
  // R127 (#5 §1): demo dostop je na produkciji privzeto IZKLOPLJEN. Prijavna
  // stran vpraša javno zastavico GET /api/auth/demo in gumb pokaže samo,
  // kadar je dostop res omogočen (null = še ne vemo → ne prikaži, da ne
  // utripa in da izklopljeni demo ne obljublja nemogočega).
  const [demoEnabled, setDemoEnabled] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    let cancelled = false
    fetch('/api/auth/demo')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { enabled?: boolean } | null) => {
        if (!cancelled) setDemoEnabled(data?.enabled === true)
      })
      .catch(() => {
        if (!cancelled) setDemoEnabled(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // `/next` je lahko samo relativna pot — sicer bi `?next=https://zlobna.stran`
  // postal odprta preusmeritev takoj po prijavi.
  const next = React.useMemo(() => {
    const raw = searchParams.get('next') ?? '/'
    return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
  }, [searchParams])

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        setError(data?.error ?? 'Prijava ni uspela.')
        return
      }
      router.replace(next)
      router.refresh()
    } catch {
      setError('Omrežna napaka. Preveri povezavo.')
    } finally {
      setBusy(false)
    }
  }

  // Vstop brez prijave: en klik ustvari/uporabi demo sejo. Gesla ni treba
  // poznati — uporabno za lastnika na svežem deployu in za hitro demonstracijo.
  async function onDemoAccess() {
    setError(null)
    setDemoBusy(true)
    try {
      const response = await fetch('/api/auth/demo', { method: 'POST' })
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        setError(data?.error ?? 'Demo dostop ni uspel.')
        return
      }
      router.replace(next)
      router.refresh()
    } catch {
      setError('Omrežna napaka. Preveri povezavo.')
    } finally {
      setDemoBusy(false)
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#0f1a2b] p-4 md:p-8">
      {/* Ozadje: navy gradient + roksal vzorec + amber svetlobe */}
      <div className="roksal-bg-pattern pointer-events-none absolute inset-0 opacity-40" aria-hidden />
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-roksal-amber/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-56 w-56 rounded-full bg-sky-500/10 blur-3xl"
        aria-hidden
      />

      <Card className="relative w-full max-w-sm animate-fade-in-up rounded-xl border-white/10 bg-white/95 shadow-2xl backdrop-blur md:max-w-md">
        <CardHeader className="space-y-3 text-center">
          {/* Znamka — isti amber znak kot v aplikaciji */}
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-roksal-amber text-lg font-bold text-roksal-navy shadow-md md:h-14 md:w-14 md:text-xl">
            R
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl tracking-tight md:text-2xl">Roksal Railing Manager</CardTitle>
            <CardDescription>Prijava za monterje in pisarno</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-pošta</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="marko@roksal.si"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Geslo</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="animate-shake flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200"
              >
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-roksal-navy text-white transition-all hover:bg-roksal-navy/90 hover:shadow-md active:scale-[0.99]"
              disabled={busy || demoBusy}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {busy ? 'Prijavljam…' : 'Prijava'}
            </Button>

            {/* Ločilna črta + vstop brez prijave — samo kadar je demo omogočen
                (R127: produkcija je privzeto izklopljena, gumb se tedaj ne
                prikaže sploh, da ne vabi v slepo ulico). */}
            {demoEnabled && (
              <>
                <div className="flex items-center gap-3 pt-1" aria-hidden>
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">ali</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-roksal-amber/60 bg-roksal-amber/10 text-roksal-navy transition-all hover:bg-roksal-amber/20 hover:shadow-md active:scale-[0.99]"
                  disabled={busy || demoBusy}
                  onClick={onDemoAccess}
                >
                  {demoBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                  {demoBusy ? 'Pripravljam demo…' : 'Vstop brez prijave (Demo)'}
                </Button>
              </>
            )}

            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              Račun ustvari administrator na strežniku:
              <code className="ml-1 rounded bg-muted px-1 py-0.5">
                bunx tsx tools/create-admin.ts
              </code>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-[#0f1a2b] p-4">
          <div className="text-sm text-white/60">Nalagam prijavo…</div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
