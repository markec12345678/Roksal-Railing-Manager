// Roksal — resource-level avtorizacija (issue #4, §3; R120 — security pass)
// ---------------------------------------------------------------------------
// authenticate() pove SAMO, kdo si. Ta modul pove, ali smeš do KONKRETNEGA
// vira (projekt, stranka, račun, …). Vsak business API mora poleg
// authenticate() preveriti tudi dostop do vira — glej docs/SECURITY-POLICY.md.
//
// MATRIKA PRINCIPALOV (R120):
//
//   USER (seja) — vloge: ADMIN, VODJA, MONTER, SKLADISCE
//   | Vloga     | Project                      | Customer            | Invoice/Račun         | Zaloga/naročila        |
//   |-----------|------------------------------|---------------------|-----------------------|------------------------|
//   | ADMIN     | vse (read/write/lock/delete) | vse                 | vse                   | vse                    |
//   | VODJA     | vse (read/write/lock/delete) | vse                 | vse                   | vse                    |
//   | MONTER    | svoje: read/write (brez lock)| read + ustvari/uredi| read svojih projektov | read                   |
//   | SKLADISCE | read vseh (material kontekst)| read                | read                  | vse (prejem, premiki)  |
//
//   SERVICE (API ključ `rkm_…`) — servisni principal MOBILE_SYNC (mobilni
//   klient), IZRAZNO omejene pravice. Od R126 (issue #5 §3) vsak ključ nosi
//   SCOPE listo iz baze (katalog: src/lib/api-keys.ts); privzeta lista novega
//   ključa = spodnja pogodba. Ključ brez scope-a ne dela ničesar od tega:
//   | Dovoljeno (scope)                         | Nedovoljeno                        |
//   |--------------------------------------------|------------------------------------|
//   | read projektov — projects:read             | brisanje/ustvarjanje strank        |
//   | update projektov (sync polja + status SAMO | zaklep/odklep projekta (lock)      |
//   | prek statusnega stroja) — projects:write   | brisanje projektov                 |
//   | ustvarjanje meritev — measurements:create  | urejanje cen / dobaviteljev        |
//   | nalaganje fotodokumentacije — photos:write | administracija zaloge / naročil    |
//   | branje fotodokumentacije — photos:read     | računi (uradni dokumenti)          |
//   | omejitev na projekte: projectScope         | obhod deal-lock statusnega stroja  |
//
//   Razlika do prej (R120): apikey NI več avtomatsko "manager" — prej je
//   `isManager()` vrnil `true` in je en ključ lahko brisal stranke, urejal
//   zaloge in preskakoval statusni stroj. Zdaj velja načelo najmanjših
//   pravic; servis je namenski, ne vseveden. Ključi so pepper+SHA-256,
//   ustvari jih admin orodje (`bun run apikey`), posamezen ključ se da
//   preklicati (revokedAt).
//
// POLITIKA ODGOVOROV (dokumentirana, konsistentna):
//   - vir NE obstaja → 404 (ne razkrivamo obstoja),
//   - vir obstaja, dostop NI dovoljen → 403,
//   - to velja za VSE business API-je.

import { hasRole, MANAGER_ROLES } from '@/lib/auth'
import type { AuthContext } from '@/lib/auth'
import type { ApiKeyScope } from '@/lib/api-keys'

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

/**
 * Vodstvene pravice ima SAMO uporabnik z vlogo ADMIN/VODJA.
 * API ključ (MOBILE_SYNC) NI manager — glej matriko zgoraj (R120).
 */
function isManager(principal: AuthContext): boolean {
  return principal.kind === 'user' && hasRole(principal.session, MANAGER_ROLES)
}

/** Servisni principal MOBILE_SYNC (API ključ). */
export function isServicePrincipal(principal: AuthContext): boolean {
  return principal.kind === 'apikey'
}

/** Zaloga/naročila: SKLADISCE in vodstvo imajo pisni dostop; servis NE (R120). */
export function canManageInventory(principal: AuthContext): boolean {
  return isManager(principal) ||
    (principal.kind === 'user' && hasRole(principal.session, ['SKLADISCE']))
}

/** Stranke: ustvarjanje/urejanje = vsa uporabniška vloga (teren), brisanje = vodstvo. */
export function canManageCustomers(principal: AuthContext): boolean {
  return principal.kind === 'user'
}

export function canDeleteCustomer(principal: AuthContext): boolean {
  return isManager(principal)
}

/**
 * R126 (issue #5 §3) — scope vrata za servisni principal.
 *
 * Rute, kjer sme apikey delovati, preverijo KONKRETEN scope, ne le "ali je
 * apikey". Vrne `NextResponse` 403, kadar ključ scope-a nima, sicer `null`:
 *
 *     const denied = apiKeyScopeDenied(auth, 'projects:read')
 *     if (denied) return denied
 *
 * Uporabniška seja tu VEDNO gre skozi (skopiranje vloge je zgornja plast,
 * denyUnless/hasRole) — ta vrata veljajo samo za API ključe.
 */
export function apiKeyScopeDenied(principal: AuthContext, scope: ApiKeyScope): boolean {
  return principal.kind === 'apikey' && !principal.scopes.includes(scope)
}

/**
 * Ali sme principal dostopati do projekta z dano pravico?
 * Vrne true/false — za branje pri filtriranju seznamov (brez metanja).
 *
 * MOBILE_SYNC (apikey), R126 §3:
 *   • read           → zahteva scope `projects:read`,
 *   • update/status  → zahteva scope `projects:write`,
 *   • delete/lock    → NIKOLI (isto kot prej),
 *   • projectScope   → ključ, omejen na projekte [A], NE dostopa do projekta B
 *     (nobena pravica — tudi read ne; 404/403 politika se ohrani).
 */
export function projectAccessAllowed(
  principal: AuthContext,
  project: ProjectRef,
  access: ProjectAccess
): boolean {
  if (isManager(principal)) return true

  if (principal.kind === 'apikey') {
    // Projektni obseg (R126 §3): null = vsi; sicer samo izpisani ID-ji.
    if (principal.projectScope !== null && !principal.projectScope.includes(project.id)) {
      return false
    }
    switch (access) {
      case 'read':
        return principal.scopes.includes('projects:read')
      case 'update':
      case 'changeStatus':
        return !project.dealLocked && principal.scopes.includes('projects:write')
      case 'delete':
      case 'lock':
        return false
      default:
        return false
    }
  }

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

/**
 * Filter WHERE pogoja za sezname projektov po vlogi.
 *
 * MOBILE_SYNC (apikey) → brez projektnega obsega `{}` je NAMERNO in je del
 * servisne pogodbe (R120): mobilni klient podjetja zrcali projekte podjetja
 * za terensko delo. Z R126 pa ključ z `projectScope` vidi SAMO izpisane
 * projekte — omejitev se uveljavi tu, v vsakem seznamu, ne le v assertih.
 */
export function projectWhereForPrincipal(principal: AuthContext) {
  if (principal.kind === 'apikey') {
    return principal.projectScope ? { id: { in: [...principal.projectScope] } } : {}
  }
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

/** Uporabniški id za audit; servisni principal nima uporabniške pripisnosti (null). */
export function actorIdOf(principal: AuthContext): string | null {
  return principal.kind === 'user' ? principal.session.sub : null
}

/** Oznaka akterja za audit dnevnik (user sub ali servisno ime ključa). */
export function actorLabelOf(principal: AuthContext): string {
  return principal.kind === 'user' ? principal.session.sub : `service:${principal.name}`
}

/**
 * R128 (issue #5 §4) — vezava idempotence ključa na principal.
 * Nikoli null: seja → profileId, API ključ → "service:<name>". Dva različna
 * servisa z istim ključem si NE podelita replaya (profileId=null kolizija).
 */
export function principalBindingOf(principal: AuthContext): string {
  return principal.kind === 'user' ? principal.session.sub : `service:${principal.name}`
}
