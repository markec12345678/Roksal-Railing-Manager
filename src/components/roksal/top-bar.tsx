'use client'

import { RefreshCw, Moon, Sun, Clock, Search, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NotificationCenter } from '@/components/roksal/notification-center'
import { useTheme } from 'next-themes'
import { useSyncExternalStore, useCallback, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  const handleLogout = useCallback(
    async (all: boolean) => {
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
              className="text-white/70 hover:text-white hover:bg-white/10 h-9 w-9"
              onClick={toggleTheme}
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={`text-white/70 hover:text-white hover:bg-white/10 h-9 w-9 ${
              needsSyncPulse ? 'animate-pulse-soft' : ''
            }`}
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
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
              <DropdownMenuLabel>Odjava</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void handleLogout(false)}>
                <LogOut className="h-4 w-4" />
                Ta naprava
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleLogout(true)}>
                <LogOut className="h-4 w-4" />
                Vse naprave (tudi ta)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
