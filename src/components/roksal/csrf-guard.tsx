'use client'

// Roksal — montažni člen dvojnega žetona (R194 — issue #5 §6).
// Namesti fetch ovoj ENKRAT ob zagonu aplikacije (tudi prek /login, ker so
// prijava/demo prav tako mutacije). Vrne nič — nima UI. Namestitev na nivoju
// modula (ne šele v učinku), da pokrije tudi mutacije, ki bi lahko stale pred
// prvim useEffect; namestitev je idempotentna, zato dvojni klic ne škodi.

import { useEffect } from 'react'
import { installCsrfFetch } from '@/lib/csrf-client'

if (typeof window !== 'undefined') installCsrfFetch(window)

export function CsrfFetchGuard() {
  useEffect(() => {
    installCsrfFetch(window)
  }, [])
  return null
}
