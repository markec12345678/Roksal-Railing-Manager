'use client'

import { RefreshCw, Moon, Sun, Clock, Search, LogOut, KeyRound, MonitorSmartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NotificationCenter } from '@/components/roksal/notification-center'
import { SessionsDialog } from '@/components/roksal/sessions-dialog'
import { useTheme } from 'next-themes'
import { useSyncExternalStore, useCallback, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getQueueLength, setQueueIdentity } from '@/lib/offline-queue'
import { PasswordDialog } from '@/components/roksal/password-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface TopBarProps {
  onSync?: () => void
  syncing?: boolean
  onOpenPalette?: () => void
  /** S+5: v produktnem načinu (viz) je TopBar skrit — produkt ima lastno minimalno navigacijo. */
  hidden?: boolean
}

const emptySubscribe = () => () => {}

function useHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
}

function useLiveClock() {
  const [time, setTime] = useState('--:--')
  const mounted = useHydrated()

  useEffect(() => {
    function update() {
      const now = new Date()
      setTime(
        now.toLocaleTimeString('sl-SI', {
          hour: '2-digit',
          minute: '2-digit',
        })
      )
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  if (!mounted) return '--:--'
  return time
}

export function TopBar({ onSync, syncing, onOpenPalette, hidden = false }: TopBarProps) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const hydrated = useHydrated()
  const liveClock = useLiveClock()
  const router = useRouter()
  const [lastSynced, setLastSynced] = useState<number>(0)
  const [loggingOut, setLoggingOut] = useState(false)
  // R137: samostojna menjava gesla (runda S ruta /api/auth/password je do zdaj
  // bila dosegljiva le prisilno prek PasswordChangeBanner).
  const [pwdOpen, setPwdOpen] = useState(false)
  // R137: "Aktivne seje" — samostojni pregled živih sej + preklic tujih
  // naprav (GET/DELETE /api/auth/sessions sta obstajala od R134 brez UI).
  const [sessionsOpen, setSessionsOpen] = useState(false)

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }, [setTheme, resolvedTheme])

  const handleSync = useCallback(() => {
    if (onSync) {
      onSync()
    }
    setLastSynced(Date.now())
  }, [onSync])

  // #5 §2: odjava prekliče sejo v registru (UserSession) — ukraden žeton
  // ne preživi odjave. `all` odjavi tudi ostale naprave.
  // #5 §5 (R131): odjava počisti tudi občutljivo brskalniško stanje — SW
  // cache-i, sessionStorage, sejski localStorage ključi, identiteta vrste.
  // NE počisti: offline vrste (zapisi ostanejo — §4: brez tihe izgube) in
  // napravnih nastavitev kalkulatorja (roksal_calc_*, enote, laser, RAL —
  // naprava ni osebna omarica, ampak delovno orodje ekipe).
  const handleLogout = useCallback(
    async (all: boolean) => {
      // Varovalka: neposlana zapisi ne izginejo, a uporabnik mora vedeti,
      // da se pošljejo šele po ponovni prijavi (svoji ali prevzemom).
      let queueCount = 0
      try { queueCount = await getQueueLength() } catch { /* vrsta ni dostopna */ }
      if (queueCount > 0) {
        const ok = window.confirm(
          `Imate ${queueCount} ${queueCount === 1 ? 'neposlan zapis' : 'neposlanih zapisov'} v offline vrsti.\n\n` +
            'Zapisi ostanejo ohranjeni na tej napravi — pošljejo se po ponovni prijavi (ali ko jih drug uporabnik eksplicitno prevzame).\n\nOdjava?',
        )
        if (!ok) return
      }
      setLoggingOut(true)
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(all ? { all: true, current: true } : {}),
        })
      } catch {
        // Omrežna napaka: piškotek počistimo z vseeno — seja poteče,
        // uporabnik gre na prijavo (fail-closed počutje je ohranjeno).
      } finally {
        // §5: čiščenje občutljivega stanja — PIŠKOTEK je sicer počiščen na
        // strežniku, a SW cache-i in sejski ključi bi preživeli odjavo.
        try {
          if ('caches' in window) {
            const keys = await caches.keys()
            await Promise.all(
              keys.filter((k) => k.startsWith('roksal-')).map((k) => caches.delete(k)),
            )
          }
        } catch { /* cache storage ni dosegljiv — SW purge ni kritičen */ }
        try { window.sessionStorage.clear() } catch { /* ignore */ }
        try { window.localStorage.removeItem('roksal_open_photo_id') } catch { /* ignore */ }
        setQueueIdentity(null)
        router.replace('/login')
        router.refresh()
      }
    },
    [router],
  )

  // Check if synced recently (within 5 minutes)
  const needsSyncPulse = Date.now() - lastSynced > 300000 && !syncing

  return (
    <header
      className="sticky top-0 z-50 bg-gradient-to-r from-roksal-navy to-[#2a3f5f] text-white shine-effect"
      hidden={hidden}
      aria-hidden={hidden || undefined}
    >
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3 md:max-w-3xl md:px-6 md:py-4 lg:max-w-5xl">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-roksal-amber font-bold text-roksal-navy text-sm shadow-md md:h-10 md:w-10 md:text-base">
            R
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight tracking-tight md:text-lg">
              ROKSAL
            </h1>
            <p className="text-[11px] text-white/60 leading-tight">
              Field Manager v2.5
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          {/* Obvestilni center — nizka zaloga, današnje montaže, vreme */}
          <NotificationCenter />
          {/* Ukazna paleta (⌘K) — iskanje zavihkov, modulov in projektov */}
          <Button
            variant="ghost"
            className="h-9 gap-1.5 rounded-md bg-white/10 px-2.5 text-white/70 hover:bg-white/15 hover:text-white md:h-10 md:px-3"
            onClick={onOpenPalette}
            aria-label="Odpri iskalnik (Ctrl+K)"
            title="Iskalnik — Ctrl+K"
          >
            <Search className="h-4 w-4" />
            <kbd className="hidden rounded border border-white/20 bg-white/10 px-1 font-sans text-[10px] font-medium sm:inline-block">
              Ctrl K
            </kbd>
          </Button>
          {/* Live Clock */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 text-white/70 md:px-2.5">
            <Clock className="h-3 w-3 md:h-3.5 md:w-3.5" />
            <span className="text-xs font-mono font-medium tabular-nums">
              {liveClock}
            </span>
          </div>
          {hydrated && (
            <Button
              variant="ghost"
              size="icon"
              className="text-white/70 hover:text-white hover:bg-white/10 h-9 w-9 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-0"
              onClick={toggleTheme}
              aria-label={resolvedTheme === 'dark' ? 'Preklopi na svetlo temo' : 'Preklopi na temno temo'}
              title={resolvedTheme === 'dark' ? 'Svetla tema' : 'Temna tema'}
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={`text-white/70 hover:text-white hover:bg-white/10 h-9 w-9 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-0 ${
              needsSyncPulse ? 'animate-pulse-soft' : ''
            }`}
            onClick={handleSync}
            disabled={syncing}
            aria-label="Sinhroniziraj podatke"
            aria-busy={syncing}
            title="Sinhronizacija podatkov"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} aria-hidden="true" />
          </Button>
          {/* Odjava (#5 §2) — seja se prekliče v registru, ne le piškotek */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Odjava"
                title="Odjava"
                disabled={loggingOut}
              >
                <LogOut className={`h-4 w-4 ${loggingOut ? 'animate-pulse' : ''}`} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Račun
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setPwdOpen(true)}
                className="gap-2 focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
              >
                <KeyRound className="h-4 w-4 text-roksal-ink/70" aria-hidden="true" />
                Zamenjaj geslo
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSessionsOpen(true)}
                className="gap-2 focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
              >
                <MonitorSmartphone className="h-4 w-4 text-roksal-ink/70" aria-hidden="true" />
                Aktivne seje
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => void handleLogout(false)}
                className="gap-2 focus-visible:ring-2 focus-visible:ring-roksal-red/40"
              >
                <LogOut className="h-4 w-4 text-roksal-ink/70" aria-hidden="true" />
                Ta naprava
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => void handleLogout(true)}
                className="gap-2 focus-visible:ring-2 focus-visible:ring-roksal-red/40"
              >
                <LogOut className="h-4 w-4 text-roksal-ink/70" aria-hidden="true" />
                Vse naprave (tudi ta)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <PasswordDialog open={pwdOpen} onOpenChange={setPwdOpen} />
          <SessionsDialog open={sessionsOpen} onOpenChange={setSessionsOpen} />
        </div>
      </div>
    </header>
  )
}
