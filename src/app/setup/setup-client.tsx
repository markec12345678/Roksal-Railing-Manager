'use client'

// Nastavitvena konzola — interaktivna forma (R137).
// Vizualni jezik = /aktivacija + /login (kamnita podlaga, bela kartica,
// navy naslovi, jantar CTA, focus ringi za tipkovnico).
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, KeyRound, Loader2, Settings2, ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SetupClientProps {
  initialToken: string
}

export function SetupClient({ initialToken }: SetupClientProps) {
  const [status, setStatus] = useState<'loading' | 'on' | 'off'>('loading')
  const [token, setToken] = useState(initialToken)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState<null | { mode: string }>(null)
  const [error, setError] = useState<string | null>(null)

  // Ali je konzola sploh vklopljena? (GET ne zahteva žetona in ne razkriva
  // ničesar — samo vklop/izklop. Izklop = iskreno mnenje, ne slepa forma.)
  useEffect(() => {
    let alive = true
    fetch('/api/setup')
      .then((r) => r.json())
      .then((d: { enabled?: boolean }) => {
        if (alive) setStatus(d?.enabled ? 'on' : 'off')
      })
      .catch(() => {
        if (alive) setStatus('off')
      })
    return () => {
      alive = false
    }
  }, [])

  async function submit() {
    if (!token.trim()) {
      setError('Žeton je obvezen.')
      return
    }
    if (password.length < 8) {
      setError('Geslo mora imeti vsaj 8 znakov.')
      return
    }
    if (password !== repeat) {
      setError('Gesli se ne ujemata.')
      return
    }
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-setup-token': token.trim() },
        body: JSON.stringify({
          email: email.trim(),
          password,
          ...(name.trim() ? { name: name.trim() } : {}),
        }),
      })
      const data = (await res.json().catch(() => null)) as
        | { error?: string; detail?: string; mode?: string }
        | null
      if (!res.ok) {
        setError(data?.detail || data?.error || 'Nastavitev ni uspela.')
        return
      }
      setDone({ mode: data?.mode ?? 'BOOTSTRAP' })
    } catch {
      setError('Napaka pri povezavi s strežnikom. Poskusite znova.')
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-100 p-6 dark:bg-background">
        <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm dark:border-emerald-800 dark:bg-card">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40">
            <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold text-roksal-ink">
            {done.mode === 'RECOVER' ? 'Račun je obnovljen!' : 'Račun je ustvarjen!'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {done.mode === 'RECOVER'
              ? 'Geslo je nastavljeno, račun je ADMIN, vse prejšnje seje so preklicane.'
              : 'ADMIN račun je pripravljen. Prijavite se z vašim e-naslovom in geslom.'}
          </p>
          <Link
            href="/login"
            className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-roksal-amber px-5 text-sm font-bold text-white shadow-md hover:bg-roksal-amber/90"
          >
            <KeyRound className="h-4 w-4" />
            Na prijavo
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100 p-6 dark:bg-background">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-card">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-roksal-amber/15">
            <Settings2 className="h-6 w-6 text-roksal-amber" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-roksal-ink">Nastavitvena konzola</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Za lastnika sistema: ustvarjanje ADMIN računa ali obnova izgubljenega gesla.
          </p>
        </div>

        {status === 'loading' && (
          <p className="py-6 text-center text-sm text-muted-foreground">Preverjam razpoložljivost…</p>
        )}

        {status === 'off' && (
          <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-stone-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-stone-300">
            <p className="mb-2 flex items-center gap-2 font-semibold text-roksal-ink">
              <ShieldOff className="h-4 w-4 text-roksal-amber" aria-hidden="true" />
              Konzola je izklopljena
            </p>
            <p>
              Žeton <code className="rounded bg-white px-1 py-0.5 text-[11px] dark:bg-stone-800">ROKSAL_SETUP_TOKEN</code> ni
              nastavljen v okolju strežnika. Nastavite ga v upravni plošči gostovanja (Vercel/Render),
              po potrebi tudi <code className="rounded bg-white px-1 py-0.5 text-[11px] dark:bg-stone-800">ROKSAL_SETUP_EMAIL</code>,
              in ponovno razmajnite aplikacijo.
            </p>
          </div>
        )}

        {status === 'on' && (
          <div className="space-y-3">
            <div>
              <label htmlFor="setup-token" className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">
                Žeton iz okolja (ROKSAL_SETUP_TOKEN)
              </label>
              <input
                id="setup-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
                className="h-11 w-full rounded-xl border border-stone-300 bg-transparent px-3 font-mono text-sm outline-none focus:border-roksal-amber focus:ring-2 focus:ring-roksal-amber/30 dark:border-stone-700"
              />
            </div>
            <div>
              <label htmlFor="setup-email" className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">
                E-naslov računa
              </label>
              <input
                id="setup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="robertpezdirc@gmail.com"
                className="h-11 w-full rounded-xl border border-stone-300 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-roksal-amber focus:ring-2 focus:ring-roksal-amber/30 dark:border-stone-700"
              />
            </div>
            <div>
              <label htmlFor="setup-name" className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">
                Ime in priimek <span className="text-stone-400 dark:text-stone-500">(obvezno pri novem računu)</span>
              </label>
              <input
                id="setup-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className="h-11 w-full rounded-xl border border-stone-300 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-roksal-amber focus:ring-2 focus:ring-roksal-amber/30 dark:border-stone-700"
              />
            </div>
            <div>
              <label htmlFor="setup-pass" className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">
                Novo geslo (vsaj 8 znakov)
              </label>
              <input
                id="setup-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="h-11 w-full rounded-xl border border-stone-300 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-roksal-amber focus:ring-2 focus:ring-roksal-amber/30 dark:border-stone-700"
              />
            </div>
            <div>
              <label htmlFor="setup-repeat" className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">
                Ponovite geslo
              </label>
              <input
                id="setup-repeat"
                type="password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                autoComplete="new-password"
                className="h-11 w-full rounded-xl border border-stone-300 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-roksal-amber focus:ring-2 focus:ring-roksal-amber/30 dark:border-stone-700"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-roksal-red dark:bg-red-950/40">
                {error}
              </p>
            )}

            <Button
              type="button"
              onClick={() => void submit()}
              disabled={sending || !email.trim() || password.length < 8 || !repeat || !token.trim()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-roksal-amber text-sm font-bold text-white shadow-md hover:bg-roksal-amber/90 disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {sending ? 'Nastavljam…' : 'Nastavi račun'}
            </Button>

            <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
              Vsak poskus je dnevniško sledljiv. Pri obnovi obstoječega računa se VSE seje
              prekličejo. Žeton se po uporabi priporočljivo odstrani iz okolja.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
