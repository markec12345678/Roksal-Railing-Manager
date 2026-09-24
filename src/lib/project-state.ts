// Roksal — enoten Project State Machine (issue #4, §14)
// ---------------------------------------------------------------------------
// Vsak prehod statusa projekta:
//   - ima dovoljenega predhodnika (ALLOWED_TRANSITIONS),
//   - ima dovoljeno vlogo (role gating),
//   - je auditiran (klicatelj piše AuditLog v isti transakciji),
//   - preprečuje neveljavne preskoke (npr. NACRTOVANO → MONTIRANO).
//
// Posebno pravilo: zaklenjen dogovor (dealLocked) ne dovoljuje spremembe
// statusa iz ZA_MONTAZO skozi običajni PATCH — nadaljnji tok (V_IZDELAVI,
// MONTIRANO) gre skozi vodstvo (ADMIN/VODJA), monter ne more ven.
//
// Življenjski cikel (Issue #4 §14 pomanjšan na obstoječe statuse):
//   NACRTOVANO → V_TEKU → ZA_MONTAZO → V_IZDELAVI → MONTIRANO → ZAKLJUCENO
//   s stranskimi izhodi: USTAVLJENO (iz vseh aktivnih) in
//   V_IZDELAVI (material v izdelavi) → ZA_MONTAZO (vrnitev v čakanje).

import type { AuthContext } from '@/lib/auth'
import { hasRole, MANAGER_ROLES } from '@/lib/auth'

export type ProjectStatusValue =
  | 'NACRTOVANO'
  | 'V_TEKU'
  | 'ZA_MONTAZO'
  | 'V_IZDELAVI'
  | 'MONTIRANO'
  | 'ZAKLJUCENO'
  | 'USTAVLJENO'

export class InvalidTransitionError extends Error {
  readonly status = 409
  constructor(message: string) {
    super(message)
  }
}

export const ALLOWED_TRANSITIONS: Record<ProjectStatusValue, ProjectStatusValue[]> = {
  NACRTOVANO: ['V_TEKU', 'USTAVLJENO'],
  V_TEKU: ['ZA_MONTAZO', 'V_IZDELAVI', 'USTAVLJENO'],
  ZA_MONTAZO: ['V_IZDELAVI', 'MONTIRANO', 'USTAVLJENO'],
  V_IZDELAVI: ['ZA_MONTAZO', 'MONTIRANO', 'USTAVLJENO'],
  MONTIRANO: ['ZAKLJUCENO'],
  ZAKLJUCENO: [], // končno stanje — samo vodstvo lahko ročno odpre ponovno (glej spodaj)
  USTAVLJENO: ['V_TEKU'], // reaktivacija ustavljenega projekta = vodstvo
}

export function isProjectStatus(v: string): v is ProjectStatusValue {
  return v in ALLOWED_TRANSITIONS
}

/**
 * Dovoljeni ZAČETNI statusi (R120 — Problem 3): nov projekt se rodi IZKLJUČNO
 * na vhodu življenjskega cikla. Mobilni payload ne sme ustvariti projekt
 * neposredno v MONTIRANO/ZAKLJUCENO — to bi bil obhod statusnega stroja.
 */
export const INITIAL_PROJECT_STATUSES: readonly ProjectStatusValue[] = ['NACRTOVANO']

export function isInitialProjectStatus(v: string): v is ProjectStatusValue {
  return (INITIAL_PROJECT_STATUSES as readonly string[]).includes(v)
}

/**
 * Razreši zahtevani začetni status za NOV projekt.
 * - dovoljen začetni status → uporabljen,
 * - karkoli drugega (neznan ali nedovoljen začetek) → NACRTOVANO + `clampedFrom`
 *   (klicatelj MORA javiti korekcijo — nič tiho, glej zakon "brez tihe degradacije").
 */
export function initialStatusFor(requested: string | null | undefined): {
  status: ProjectStatusValue
  clampedFrom: string | null
} {
  if (requested && isInitialProjectStatus(requested)) {
    return { status: requested, clampedFrom: null }
  }
  return { status: 'NACRTOVANO', clampedFrom: requested ?? null }
}

export type TransitionContext = {
  from: string
  to: string
  principal: AuthContext
  dealLocked?: boolean
}

/**
 * Validiraj prehod statusa. Vrne true (ali vrže InvalidTransitionError).
 * - neznani status → napaka (shema že zod-validira, tu je obramba v globino)
 * - neveljaven prehod → 409
 * - ZAKLJUCENO → karkoli in USTAVLJENO → V_TEKU = samo ADMIN/VODJA
 * - dealLocked projekt iz ZA_MONTAZO = samo ADMIN/VODJA
 *
 * R120: servisni principal (API ključ, MOBILE_SYNC) NI več manager — mobilni
 * klient sme premikati status SAMO po dovoljenih prehodih (nikoli preskok,
 * nikoli iz končnih stanj, nikoli čez deal-lock). Vodstveni obhod ima samo
 * uporabnik ADMIN/VODJA.
 */
export function assertTransition(ctx: TransitionContext): void {
  const { from, to, principal, dealLocked } = ctx
  if (!isProjectStatus(from) || !isProjectStatus(to)) {
    throw new InvalidTransitionError(`Neznan status: ${!isProjectStatus(from) ? from : to}`)
  }
  const isManager =
    principal.kind === 'user' && hasRole(principal.session, MANAGER_ROLES)
  const role = principal.kind === 'user' ? principal.session.vloga : null

  // Vodstvo sme vse (tudi iz končnih stanj — korekcija napake z auditom).
  if (isManager) return

  if (role === 'SKLADISCE') {
    throw new InvalidTransitionError(
      'Skladišče ne sme spreminjati statusa projekta'
    )
  }

  if (dealLocked && (from === 'ZA_MONTAZO' || from === 'V_IZDELAVI')) {
    throw new InvalidTransitionError(
      'Zaklenjen dogovor — sprememba statusa je možna samo preko vodstva'
    )
  }

  if (from === 'ZAKLJUCENO' || from === 'USTAVLJENO') {
    throw new InvalidTransitionError(
      'Iz končnega stanja premika samo vodstvo'
    )
  }

  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new InvalidTransitionError(
      `Neveljaven prehod statusa: ${from} → ${to} (dovoljeni: ${ALLOWED_TRANSITIONS[from].join(', ') || '—'})`
    )
  }
}

/** Ne-metajoča različica za preverjanje v UI logiki. */
export function transitionAllowed(ctx: TransitionContext): boolean {
  try {
    assertTransition(ctx)
    return true
  } catch {
    return false
  }
}
