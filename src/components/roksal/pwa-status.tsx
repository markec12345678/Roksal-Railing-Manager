'use client'

/**
 * PWA status — pasovi pod TopBar (R128 — issue #5 §4):
 *  1. OFFLINE: "Ni povezave" + števec čakajočih zapisov (offline vrsta),
 *     samodejno izgine ob vrnitvi povezave (flush se sproži takrat).
 *  2. PROBLEMI (nov): failed/conflict zapisi z offline vrste — 4xx NI tiho
 *     izgubljen: seznam z napako, ročni retry posameznega/vseh, izbris
 *     (eksplicitna uporabnikova odločitev s potrditvijo).
 *  3. SYNCED: "Povezava vzpostavljena" (ob uspešnem flushu).
 *  4. INSTALL: "Namesti Roksal app" (beforeinstallprompt).
 *
 * Vrsta živi v IndexedDB (src/lib/offline-queue.ts) — vsi števci so asinhroni
 * in se osvežijo prek QUEUE_EVENT.
 */

import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  WifiOff,
  CheckCircle2,
  Download,
  X,
  Loader2,
  AlertTriangle,
  RotateCcw,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import {
  getQueueItems,
  getQueueLength,
  flushQueue,
  retryItem,
  retryFailed,
  deleteItem,
  QUEUE_EVENT,
  type QueueItem,
} from '@/lib/offline-queue'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'roksal-install-dismissed'

const timeFmt = new Intl.DateTimeFormat('sl-SI', { hour: '2-digit', minute: '2-digit' })

export function PwaStatus() {
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [problems, setProblems] = useState<QueueItem[]>([])
  const [expanded, setExpanded] = useState(false)
  const [flushing, setFlushing] = useState(false)
  const [justSynced, setJustSynced] = useState(false)
  const [justSyncedCount, setJustSyncedCount] = useState(0)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installDismissed, setInstallDismissed] = useState(true)

  const refresh = useCallback(() => {
    void getQueueItems().then((items) => {
      setPending(items.filter((i) => i.status === 'pending' || i.status === 'sending').length)
      setProblems(items.filter((i) => i.status === 'failed' || i.status === 'conflict'))
    })
  }, [])

  useEffect(() => {
    // Začetno stanje preberemo v mikrotasku (omejitev pravila set-state-in-effect)
    queueMicrotask(() => {
      setOnline(navigator.onLine)
      // R128: ob zagonu app pošlji čakajoče zapise (app se odpre zjutraj
      // s signalom → vrsta iz terena odide, brez ročnega posega).
      void getQueueLength().then((n) => {
        if (n > 0 && navigator.onLine) {
          void flushQueue()
        }
        refresh()
      })
      setInstallDismissed(window.localStorage.getItem(DISMISS_KEY) === '1')
    })

    const goOffline = () => setOnline(false)
    const goOnline = () => {
      setOnline(true)
      // Povezava nazaj → pošlji vrsto
      void getQueueLength().then((n) => {
        if (n > 0) {
          setFlushing(true)
          void flushQueue().then((sent) => {
            setFlushing(false)
            setJustSyncedCount(sent)
            setJustSynced(true)
            setTimeout(() => setJustSynced(false), 2500)
            refresh()
          })
        }
      })
    }
    const queueChange = () => refresh()

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
  }, [refresh])

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

  const onRetryOne = useCallback((id: string) => {
    void retryItem(id)
  }, [])

  const onRetryAll = useCallback(() => {
    void retryFailed()
  }, [])

  const onDelete = useCallback((item: QueueItem) => {
    // Izbris = EKSPlicitna izguba zapisa — vedno potrditev (§4: brez tihe izgube).
    const ok = window.confirm(
      `Ali res želiš trajno odstraniti "${item.label ?? item.url}" iz offline vrste? Zapisa ne bo več mogoče poslati.`,
    )
    if (ok) void deleteItem(item.id)
  }, [])

  const showOffline = !online
  const showProblems = problems.length > 0
  const showSynced = justSynced && online
  const showInstall = online && !!installEvent && !installDismissed

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

        {showProblems && (
          <motion.div
            key="problems"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="mb-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-rose-900 shadow-sm"
            role="alert"
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold leading-tight">
                  {problems.length} {problems.length === 1 ? 'zapis NI bil poslan' : 'zapisov NI bilo poslanih'} — zahteva odločitev
                </p>
                <p className="truncate text-[10px] leading-tight text-rose-800">
                  Zapisi ostanejo ohranjeni; pošlji znova ali jih odstrani.
                </p>
              </div>
              <button
                type="button"
                onClick={onRetryAll}
                className="flex min-h-[32px] items-center gap-1 rounded-lg bg-rose-600 px-2.5 text-[11px] font-bold text-white transition-colors hover:bg-rose-700 active:scale-95"
                aria-label="Ponovno pošlji vse zapise iz vrste"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Vse znova
              </button>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-rose-700 hover:bg-rose-100"
                aria-expanded={expanded}
                aria-label={expanded ? 'Skrči seznam neuspelih zapisov' : 'Razširi seznam neuspelih zapisov'}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
            {expanded && (
              <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto border-t border-rose-200 pt-2" aria-label="Seznam neuspelih zapisov">
                {problems.map((item) => (
                  <li key={item.id} className="flex items-start gap-2 rounded-lg bg-white/70 px-2 py-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold leading-tight">
                        {item.label ?? item.url}
                        <span className="ml-1.5 rounded bg-rose-100 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-700">
                          {item.status === 'conflict' ? 'Spor' : 'Napaka'}{item.statusCode ? ` ${item.statusCode}` : ''}
                        </span>
                      </p>
                      <p className="truncate text-[10px] leading-tight text-rose-700/90" title={item.lastError}>
                        {item.lastError ?? 'Neznana napaka'} · {timeFmt.format(new Date(item.createdAt))}
                        {item.attempts > 1 ? ` · ${item.attempts} poizkusov` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRetryOne(item.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-rose-700 hover:bg-rose-100"
                      aria-label={`Pošlji znova: ${item.label ?? item.url}`}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-rose-700 hover:bg-rose-100"
                      aria-label={`Odstrani: ${item.label ?? item.url}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
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
            <p className="text-[12px] font-semibold">
              Povezava vzpostavljena{justSyncedCount > 0 ? ` — ${justSyncedCount} ${justSyncedCount === 1 ? 'zapis poslan' : 'zapisov poslanih'}` : ''}
            </p>
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
