'use client'

// R134 (§9): pas prisilne zamenjave gesla — admin je resetiral geslo in
// uporabnik MORA nastaviti svoje. Pas se prikaže na vseh zavihkih, dokler
// uporabnik gesla ne zamenja (/api/auth/password počisti zastavico).
import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Loader2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function PasswordChangeBanner() {
  const [visible, setVisible] = useState(false)
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)

  const check = useCallback(async () => {
    try {
      const res = await fetch('/api/auth')
      if (!res.ok) return
      const data = (await res.json()) as { mustChangePassword?: boolean }
      setVisible(data.mustChangePassword === true)
    } catch {
      // pas je samo UX — brez omrežja se ne prikaže (napaka ostane v logu)
    }
  }, [])

  useEffect(() => {
    void check()
  }, [check])

  async function submit() {
    if (next.length < 8) {
      toast.error('Novo geslo mora imeti vsaj 8 znakov.')
      return
    }
    if (next !== repeat) {
      toast.error('Novi gesli se ne ujemata.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        toast.error(data?.error || 'Zamenjava ni uspela.')
        return
      }
      // Menjava gesla revoke-a VSE seje (fail-closed §2) → prijava znova.
      toast.success('Geslo zamenjano — prijavite se z novim geslom.')
      window.location.href = '/login'
    } catch {
      toast.error('Napaka pri povezavi s strežnikom')
    } finally {
      setBusy(false)
    }
  }

  if (!visible) return null

  return (
    <div role="alert" className="border-b border-roksal-amber/30 bg-roksal-amber/10 px-4 py-2">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
        <p className="min-w-0 flex-1 text-[12px] font-medium text-amber-800">
          Vaše geslo je bilo ponastavljeno s strani administratorja — nastavite svoje novo geslo.
        </p>
        <Button
          type="button"
          size="sm"
          onClick={() => setOpen(!open)}
          className="h-7 bg-amber-600 text-[11px] text-white hover:bg-amber-700"
        >
          <KeyRound className="mr-1 h-3 w-3" />
          Zamenjaj geslo
        </Button>
      </div>

      {open && (
        <div className="mx-auto mt-2 max-w-sm space-y-2 rounded-xl border border-roksal-amber/40 bg-white p-3 shadow-sm">
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="Začasno geslo (od admina)"
            autoComplete="current-password"
            className="h-9 w-full rounded-lg border border-stone-300 px-3 text-xs outline-none focus:border-roksal-amber"
          />
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="Novo geslo (vsaj 8 znakov)"
            autoComplete="new-password"
            className="h-9 w-full rounded-lg border border-stone-300 px-3 text-xs outline-none focus:border-roksal-amber"
          />
          <input
            type="password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            placeholder="Ponovite novo geslo"
            autoComplete="new-password"
            className="h-9 w-full rounded-lg border border-stone-300 px-3 text-xs outline-none focus:border-roksal-amber"
          />
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !current || next.length < 8 || !repeat}
            className="h-9 w-full bg-roksal-navy text-xs text-white hover:bg-roksal-navy/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <KeyRound className="mr-1.5 h-3.5 w-3.5" />}
            Shrani novo geslo
          </Button>
        </div>
      )}
    </div>
  )
}
