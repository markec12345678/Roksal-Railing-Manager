'use client'

// Aktivacija računa — interaktivna forma (R134, §9).
// Nastavi geslo za povabljen račun. Uspeh → povezava na prijavo.
import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, KeyRound, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ActivationClientProps {
  token: string
  ime: string
}

export function ActivationClient({ token, ime }: ActivationClientProps) {
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
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
      const res = await fetch('/api/users/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string; detail?: string } | null
      if (!res.ok) {
        setError(data?.detail || data?.error || 'Aktivacija ni uspela.')
        return
      }
      setDone(true)
    } catch {
      setError('Napaka pri povezavi s strežnikom. Poskusite znova.')
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-100 p-6">
        <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-roksal-navy">Račun je aktiven!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Geslo je nastavljeno. Prijavite se z vašim e-naslovom in novim geslom.
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
    <main className="flex min-h-screen items-center justify-center bg-stone-100 p-6">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-roksal-amber/15">
            <KeyRound className="h-6 w-6 text-roksal-amber" />
          </div>
          <h1 className="text-xl font-bold text-roksal-navy">Dobrodošli, {ime.split(' ')[0]}!</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Nastavite geslo za vaš račun — po njem se boste prijavljali v aplikacijo.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="act-pass" className="mb-1 block text-xs font-medium text-stone-600">
              Novo geslo (vsaj 8 znakov)
            </label>
            <input
              id="act-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="h-11 w-full rounded-xl border border-stone-300 px-3 text-sm outline-none focus:border-roksal-amber focus:ring-2 focus:ring-roksal-amber/30"
            />
          </div>
          <div>
            <label htmlFor="act-repeat" className="mb-1 block text-xs font-medium text-stone-600">
              Ponovite geslo
            </label>
            <input
              id="act-repeat"
              type="password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              autoComplete="new-password"
              className="h-11 w-full rounded-xl border border-stone-300 px-3 text-sm outline-none focus:border-roksal-amber focus:ring-2 focus:ring-roksal-amber/30"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-roksal-red">
              {error}
            </p>
          )}

          <Button
            type="button"
            onClick={() => void submit()}
            disabled={sending || password.length < 8 || !repeat}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-roksal-amber text-sm font-bold text-white shadow-md hover:bg-roksal-amber/90 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? 'Aktiviram…' : 'Aktiviraj račun'}
          </Button>

          <p className="text-center text-[11px] text-muted-foreground">
            Težave? Pokličite Roksal d.o.o. Kranj, tel. +386 4 237 05 50.
          </p>
        </div>
      </div>
    </main>
  )
}
