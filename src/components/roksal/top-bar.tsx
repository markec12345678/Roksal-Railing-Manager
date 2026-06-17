'use client'

import { RefreshCw, Moon, Sun, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from 'next-themes'
import { useSyncExternalStore, useCallback, useState, useEffect } from 'react'

interface TopBarProps {
  onSync?: () => void
  syncing?: boolean
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

export function TopBar({ onSync, syncing }: TopBarProps) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const hydrated = useHydrated()
  const liveClock = useLiveClock()
  const [lastSynced, setLastSynced] = useState<number>(0)

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }, [setTheme, resolvedTheme])

  const handleSync = useCallback(() => {
    if (onSync) {
      onSync()
    }
    setLastSynced(Date.now())
  }, [onSync])

  // Check if synced recently (within 5 minutes)
  const needsSyncPulse = Date.now() - lastSynced > 300000 && !syncing

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-roksal-navy to-[#2a3f5f] text-white shine-effect">
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-roksal-amber font-bold text-roksal-navy text-sm shadow-md">
            R
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight tracking-tight">
              ROKSAL
            </h1>
            <p className="text-[11px] text-white/60 leading-tight">
              Field Manager v2.5
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Live Clock */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 text-white/70">
            <Clock className="h-3 w-3" />
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
        </div>
      </div>
    </header>
  )
}
