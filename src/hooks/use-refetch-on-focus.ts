import * as React from 'react'
import { biOsvjezitiObFokusu, FOKUS_MIN_INTERVAL_MS } from '@/lib/osvezitev-fokus'

/**
 * R170 — ponovno naloži podatke, ko se okno/dokument VRNE v ospredje.
 * ---------------------------------------------------------------------------
 * Problem: okno, odprto medtem ko druga seja (pisarna) spremeni status
 * termina/projekta, ostane zastarel do remonta komponente. Klicatelj poda svoj
 * fail-verbose loader (nalozi/loadData) — ta huk pa ta hook pokliče.
 *
 * Načela:
 *  • ODLOČITEV je čista lib funkcija (biOsvjezitiObFokusu): skrit dokument
 *    nikoli ne fetcha; prvi dogodek vedno osveži; nato rate-limit
 *    FOKUS_MIN_INTERVAL_MS — oba dogodka (visibilitychange + focus) gresta
 *    skozi ISTO odločitev, tako da je dedup brezplačen (nič ročnega štetja).
 *  • VEDNO zadnji callback: osveziRef se posodobi na vsakem renderju —
 *    sprememba identitete loadera (npr. loadData odvisen od projectId) NE
 *    registrira listenerjev znova in ne ujame starega zaprtja.
 *  • FAIL-VERBOSE: hook NIKOLI ne požira napak (brez tihega pogrstnega
 *    zajema) — loader sam pokaže viden error panel (vzorec R161–R163).
 *    Napaka pokvarjenega callbacka ostane vidna v konzoli/window.__err.
 *  • Brez initial fetcha: ob mountu se dogodek ne sproži — prvi load je
 *    klicateljev useEffect; hook poganja SAMO vračanja v ospredje.
 */
export function useRefetchOnFocus(osvezi: () => void | Promise<void>): void {
  const osveziRef = React.useRef(osvezi)

  React.useEffect(() => {
    osveziRef.current = osvezi
  })

  React.useEffect(() => {
    let zadnjaOsvezitev: number | null = null
    const poskusi = () => {
      const now = Date.now()
      const viden =
        typeof document === 'undefined' || document.visibilityState === 'visible'
      if (
        !biOsvjezitiObFokusu({
          now,
          zadnjaOsvezitev,
          minIntervalMs: FOKUS_MIN_INTERVAL_MS,
          dokumentViden: viden,
        })
      ) {
        return
      }
      zadnjaOsvezitev = now
      void osveziRef.current()
    }
    document.addEventListener('visibilitychange', poskusi)
    window.addEventListener('focus', poskusi)
    return () => {
      document.removeEventListener('visibilitychange', poskusi)
      window.removeEventListener('focus', poskusi)
    }
  }, [])
}
