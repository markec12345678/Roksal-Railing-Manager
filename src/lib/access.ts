// Roksal — resource-level avtorizacija (issue #4, §3)
// ---------------------------------------------------------------------------
// authenticate() pove SAMO, kdo si. Ta modul pove, ali smeš do KONKRETNEGA
// vira (projekt, stranka, račun, …). Vsak business API mora poleg
// authenticate() preveriti tudi dostop do vira — glej docs/SECURITY-POLICY.md.
//
// MATRIKA (prilagojena dejanskim rolam: ADMIN, VODJA, MONTER, SKLADISCE):
//
// | Vloga     | Project                      | Customer            | Invoice/Račun         | Zaloga/naročila        |
// |-----------|------------------------------|---------------------|-----------------------|------------------------|
// | ADMIN     | vse (read/write/lock/delete) | vse                 | vse                   | vse                    |
// | VODJA     | vse (read/write/lock/delete) | vse                 | vse                   | vse                    |
// | MONTER    | svoje: read/write (brez lock)| read + ustvari/uredi| read svojih projektov | read                   |
// | SKLADISCE | read vseh (material kontekst)| read                | read                  | vse (prejem, premiki)  |
//
// API ključ (`kind: 'apikey'`) = servisni račun (mobilni klient/BalkonAR):
// strojni dostop na ravni VODJA, a dejanja NE nosijo uporabniške pripisnosti
// (audit userId = null). Ključi so pepper+SHA-256, ustvari jih admin orodje.
//
// POLITIKA ODGOVOROV (dokumentirana, konsistentna):
//   - vir NE obstaja → 404 (ne razkrivamo obstoja),
//   - vir obstaja, dostop NI dovoljen → 403,
//   - to velja za VSE business API-je.

import { hasRole, MANAGER_ROLES } from '@/lib/auth'
import type { AuthContext } from '@/lib/auth'

export type AccessError = { status: 403 | 404; message: string }

export class AccessDeniedError extends Error {
  readonly status: 403 | 404
  constructor(status: 403 | 404, message: string) {
    super(message)
    this.status = status
  }
}

/** Projekti, katerih lastnik/izvajalec je uporabnik. */
export type ProjectRef = {
  id: string
  monterId: string | null
  vodjaId: string | null
  status?: string
  dealLocked?: boolean
}

export type ProjectAccess = 'read' | 'update' | 'delete' | 'lock' | 'changeStatus'

function isManager(principal: AuthContext): boolean {
  return principal.kind === 'apikey' || hasRole(principal.session, MANAGER_ROLES)
}

/** Zaloga/naročila: SKLADISCE in vodstvo imajo pisni dostop. */
export function canManageInventory(principal: AuthContext): boolean {
  if (principal.kind === 'apikey') return true
  return hasRole(principal.session, [...MANAGER_ROLES, 'SKLADISCE'])
}

/** Stranke: ustvarjanje/urejanje = vsa uporabniška vloga (teren), brisanje = vodstvo. */
export function canManageCustomers(principal: AuthContext): boolean {
  return principal.kind === 'user'
}

export function canDeleteCustomer(principal: AuthContext): boolean {
  return isManager(principal)
}

/**
 * Ali sme principal dostopati do projekta z dano pravico?
 * Vrne true/false — za branje pri filtriranju seznamov (brez metanja).
 */
export function projectAccessAllowed(
  principal: AuthContext,
  project: ProjectRef,
  access: ProjectAccess
): boolean {
  if (isManager(principal)) return true

  const uid = principal.kind === 'user' ? principal.session.sub : null
  const isMine = uid !== null && (project.monterId === uid || project.vodjaId === uid)

  if (principal.kind === 'user' && hasRole(principal.session, ['SKLADISCE'])) {
    // Skladišče lahko bere vse projekte (material kontekst), a jih ne spreminja.
    return access === 'read'
  }

  if (!isMine) return false

  switch (access) {
    case 'read':
      return true
    case 'update':
    case 'changeStatus':
      // Zaklenjen dogovor (deal-lock) ne dovoljuje več monterjevih sprememb.
      return !project.dealLocked
    case 'delete':
    case 'lock':
      return false // zaklep in brisanje = vodstvo
    default:
      return false
  }
}

/**
 * Trdi preverbi dostopa — vrže AccessDeniedError(403|404).
 * `exists=false` pomeni: vir ne obstaja → 404.
 */
export function assertProjectAccess(
  principal: AuthContext,
  project: ProjectRef | null,
  access: ProjectAccess
): void {
  if (!project) throw new AccessDeniedError(404, 'Projekt ne obstaja')
  if (!projectAccessAllowed(principal, project, access)) {
    throw new AccessDeniedError(403, 'Dostop do projekta ni dovoljen')
  }
}

/** Filter WHERE pogoja za sezname projektov po vlogi. */
export function projectWhereForPrincipal(principal: AuthContext) {
  if (isManager(principal)) return {}
  if (principal.kind === 'user' && hasRole(principal.session, ['SKLADISCE'])) return {}
  const uid = principal.kind === 'user' ? principal.session.sub : null
  if (!uid) return {}
  return { OR: [{ monterId: uid }, { vodjaId: uid }] }
}

/**
 * Generični guard za "lastnik vira" vzorec (npr. Measurement.projectId → Project).
 * `resource` je resolvana lastniška referenca ali null.
 */
export function assertOwnsProject(
  principal: AuthContext,
  project: ProjectRef | null,
  access: ProjectAccess = 'read'
): void {
  assertProjectAccess(principal, project, access)
}

/** Uporabniški id za audit; API ključi nimajo uporabniške pripisnosti (null). */
export function actorIdOf(principal: AuthContext): string | null {
  return principal.kind === 'user' ? principal.session.sub : null
}
