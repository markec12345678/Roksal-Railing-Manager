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
import { Loader2, Lock, ShieldAlert } from 'lucide-react'

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

  return (
    <main className="min-h-dvh flex items-center justify-center bg-roksal-navy/5 p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-roksal-navy text-white">
            <Lock className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">Roksal Railing Manager</CardTitle>
          <CardDescription>Prijava za monterje in pisarno</CardDescription>
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
              <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {busy ? 'Prijavljam…' : 'Prijava'}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
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
        <main className="min-h-dvh flex items-center justify-center bg-roksal-navy/5 p-4">
          <div className="text-sm text-muted-foreground">Nalagam prijavo…</div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
