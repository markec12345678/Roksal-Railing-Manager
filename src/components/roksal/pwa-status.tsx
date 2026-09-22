'use client'

/**
 * PWA status — dva samodejna pasova pod TopBar:
 *  1. OFFLINE: "Ni povezave" + števec čakajočih zapisov (offline vrsta),
 *     samodejno izgine ob vrnitvi povezave (flush se sproži takrat).
 *  2. INSTALL: "Namesti Roksal app" (beforeinstallprompt) — en klik na
 *     domači zaslon; skrij se za vedno obdismissan (localStorage).
 */

import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { WifiOff, CheckCircle2, Download, X, Loader2 } from 'lucide-react'
import { getQueueLength, flushQueue, QUEUE_EVENT } from '@/lib/offline-queue'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'roksal-install-dismissed'

export function PwaStatus() {
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [flushing, setFlushing] = useState(false)
  const [justSynced, setJustSynced] = useState(false)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installDismissed, setInstallDismissed] = useState(true)

  useEffect(() => {
    // Začetno stanje preberemo v mikrotasku (omejitev pravila set-state-in-effect)
    queueMicrotask(() => {
      setOnline(navigator.onLine)
      setPending(getQueueLength())
      setInstallDismissed(window.localStorage.getItem(DISMISS_KEY) === '1')
    })

    const goOffline = () => setOnline(false)
    const goOnline = () => {
      setOnline(true)
      // Povezava nazaj → pošlji vrsto
      if (getQueueLength() > 0) {
        setFlushing(true)
        void flushQueue().finally(() => {
          setFlushing(false)
          setJustSynced(true)
          setTimeout(() => setJustSynced(false), 2500)
        })
      }
    }
    const queueChange = () => setPending(getQueueLength())

    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    window.addEventListener(QUEUE_EVENT, queueChange)
    const onInstallPrompt = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
      setInstallDismissed(window.localStorage.getItem(DISMISS_KEY) === '1')
    }
    window.addEventListener('beforeinstallprompt', onInstallPrompt)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
      window.removeEventListener(QUEUE_EVENT, queueChange)
      window.removeEventListener('beforeinstallprompt', onInstallPrompt)
    }
  }, [])

  const dismissInstall = useCallback(() => {
    setInstallDismissed(true)
    try { window.localStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
  }, [])

  const doInstall = useCallback(async () => {
    if (!installEvent) return
    try {
      await installEvent.prompt()
      await installEvent.userChoice
    } catch { /* ignore */ }
    setInstallEvent(null)
  }, [installEvent])

  const showOffline = !online
  const showInstall = online && !!installEvent && !installDismissed
  const showSynced = justSynced && online

  return (
    <div className="mx-auto w-full max-w-lg px-3 md:max-w-3xl lg:max-w-5xl" aria-live="polite">
      <AnimatePresence mode="wait">
        {showOffline && (
          <motion.div
            key="offline"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="mb-1.5 flex items-center gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 shadow-sm"
            role="status"
          >
            <WifiOff className="h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold leading-tight">Ni povezave — aplikacija deluje naprej</p>
              <p className="truncate text-[10px] leading-tight text-amber-800">
                {pending > 0
                  ? `${pending} ${pending === 1 ? 'zapis čaka' : 'zapisov čaka'} na pošiljanje (samodejno ob povezavi)`
                  : 'Zapisi se vrstijo in pošljejo samodejno ob povezavi'}
              </p>
            </div>
            {pending > 0 && (
              <span className="flex h-6 min-w-[24px] shrink-0 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                {pending}
              </span>
            )}
          </motion.div>
        )}

        {showSynced && (
          <motion.div
            key="synced"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mb-1.5 flex items-center gap-2 rounded-xl border border-green-300 bg-green-50 px-3 py-2 text-green-800 shadow-sm"
            role="status"
          >
            {flushing ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
            <p className="text-[12px] font-semibold">Povezava vzpostavljena — zapisov poslani</p>
          </motion.div>
        )}

        {showInstall && (
          <motion.div
            key="install"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="mb-1.5 flex items-center gap-2.5 rounded-xl border border-roksal-navy/15 bg-white px-3 py-2 shadow-sm"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-roksal-amber/15">
              <Download className="h-4 w-4 text-roksal-amber" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold leading-tight text-roksal-navy">Namesti Roksal kot aplikacijo</p>
              <p className="text-[10px] leading-tight text-muted-foreground">Ikona na domačem zaslonu, deluje tudi offline</p>
            </div>
            <button
              type="button"
              onClick={() => void doInstall()}
              className="min-h-[36px] rounded-lg bg-roksal-navy px-3 text-[11px] font-bold text-white transition-colors hover:bg-roksal-navy/90 active:scale-95"
            >
              Namesti
            </button>
            <button
              type="button"
              onClick={dismissInstall}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
              aria-label="Zapri namig za namestitev"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
