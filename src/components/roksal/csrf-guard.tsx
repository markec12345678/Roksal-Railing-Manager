'use client'

// Roksal — montažni člen dvojnega žetona (R194 — issue #5 §6).
// Namesti fetch ovoj ENKRAT ob zagonu aplikacije (tudi prek /login, ker so
// prijava/demo prav tako mutacije). Vrne nič — nima UI. Namestitev na nivoju
// modula (ne šele v učinku), da pokrije tudi mutacije, ki bi lahko stale pred
// prvim useEffect; namestitev je idempotentna, zato dvojni klic ne škodi.
//
// R195 — poleg namestitve ovoja komponenta POSLUŠA dogodek
// `roksal:csrf-zavrnjen` (sproži ga ovoj ob 403 'dvojni podpis') in pokaže
// viden toast z vabilom k osvežitvi: brez tega je edini znak zastarele seje
// spodletela mutacija z générično napako — uporabnik ne ve, da je rešitev
// 'Osveži' (osvežitev konvergira žeton prek GET /api/auth BOOTSTRAP, R194).
//   • Fiksni sonner id → več vzporednih 403 = EN toast (brez metlice).
//   • 'Osveži' dejanje → location.reload() — uporabnik ostane na strani.
//   • Toast se NASLONI samo na CSRF zavrnitev — RBAC 403 (npr. Ekipa meja)
//     ima drugačno telo in sproži lastno, kontekstno sporočilo.

import { useEffect } from 'react'
import { toast } from 'sonner'
import { installCsrfFetch } from '@/lib/csrf-client'
import { CSRF_REJECTION_EVENT } from '@/lib/csrf-core'

if (typeof window !== 'undefined') installCsrfFetch(window)

export function CsrfFetchGuard() {
  useEffect(() => {
    installCsrfFetch(window)
    const onZavrnitev = () => {
      toast.warning('Dejanje je zavrnjeno — seja ni usklajena.', {
        id: 'csrf-zavrnjen',
        description:
          'Vaša seja nima veljavnega žetona za ta dejan. Osvežite stran in se po potrebi znova prijavite.',
        action: { label: 'Osveži', onClick: () => window.location.reload() },
      })
    }
    window.addEventListener(CSRF_REJECTION_EVENT, onZavrnitev)
    return () => window.removeEventListener(CSRF_REJECTION_EVENT, onZavrnitev)
  }, [])
  return null
}
