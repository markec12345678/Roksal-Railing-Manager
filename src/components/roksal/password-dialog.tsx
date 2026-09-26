'use client'

// Samostojna menjava gesla (R137) — prej je bila menjava gesla dosegljiva
// le prisilno (PasswordChangeBanner po admin resetu), čeprav ruta
// /api/auth/password obstaja od rund S. Lastnikovo geslo pride prek
// nastavitvene konzole/pisma — uporabnik ga želi zamenjati SAM.
// Zahteva trenutno geslo (ukradena seja ne zadošča); uspeh revoke-a vse
// seje (tudi to) → klient preusmeri na prijavo (relogin: true).
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface PasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PasswordDialog({ open, onOpenChange }: PasswordDialogProps) {
  const router = useRouter()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setCurrent('')
    setNext('')
    setRepeat('')
    setError(null)
  }

  async function submit() {
    if (next.length < 8) {
      setError('Novo geslo mora imeti vsaj 8 znakov.')
      return
    }
    if (next !== repeat) {
      setError('Novi gesli se ne ujemata.')
      return
    }
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const data = (await res.json().catch(() => null)) as
        | { error?: string; detail?: string; relogin?: boolean }
        | null
      if (!res.ok) {
        setError(data?.error || data?.detail || 'Menjava gesla ni uspela.')
        return
      }
      onOpenChange(false)
      reset()
      // Ruta revoke-a VSE seje (tudi trenutno) → čist ponovni vstop.
      router.replace('/login')
      router.refresh()
    } catch {
      setError('Napaka pri povezavi s strežnikom. Poskusite znova.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!sending) {
          if (!o) reset()
          onOpenChange(o)
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-roksal-ink">
            <KeyRound className="h-4.5 w-4.5 text-roksal-amber" aria-hidden="true" />
            Zamenjaj geslo
          </DialogTitle>
          <DialogDescription>
            Po uspešni menjavi se odjavite na vseh napravah in se prijavite z novim geslom.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label htmlFor="pwd-current" className="mb-1 block text-xs font-medium text-stone-600">
              Trenutno geslo
            </label>
            <input
              id="pwd-current"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              className="h-11 w-full rounded-xl border border-stone-300 px-3 text-sm outline-none focus:border-roksal-amber focus:ring-2 focus:ring-roksal-amber/30"
            />
          </div>
          <div>
            <label htmlFor="pwd-next" className="mb-1 block text-xs font-medium text-stone-600">
              Novo geslo (vsaj 8 znakov)
            </label>
            <input
              id="pwd-next"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              className="h-11 w-full rounded-xl border border-stone-300 px-3 text-sm outline-none focus:border-roksal-amber focus:ring-2 focus:ring-roksal-amber/30"
            />
          </div>
          <div>
            <label htmlFor="pwd-repeat" className="mb-1 block text-xs font-medium text-stone-600">
              Ponovite novo geslo
            </label>
            <input
              id="pwd-repeat"
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
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset()
              onOpenChange(false)
            }}
            disabled={sending}
            className="h-10 rounded-xl"
          >
            Prekliči
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={sending || !current || next.length < 8 || !repeat}
            className="h-10 rounded-xl bg-roksal-amber text-white hover:bg-roksal-amber/90"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {sending ? 'Menjujem…' : 'Zamenjaj geslo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
