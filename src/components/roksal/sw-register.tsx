'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    // Registriraj samo v produkciji (dev ima drugačno cachanje)
    if (process.env.NODE_ENV !== 'production') return

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // tiha napaka — SW ni kritičen
      })
    }
    window.addEventListener('load', register)
    return () => window.removeEventListener('load', register)
  }, [])

  return null
}
