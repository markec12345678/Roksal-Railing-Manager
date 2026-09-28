// Roksal — matrika dovoljenj (issue #5 §10, R135)
// ---------------------------------------------------------------------------
// Vloga (role-only) ni dovolj: vsak endpoint preverja KONKRETNO dovoljenje.
// Ta datoteka je EDEDINI vir resnice:
//
//   • katalog dovoljenj (§10 spec: 30 + 2 read-dodatka za natančen izraz
//     obstoječe matrike — users.read in invoices.read, označena kot r135);
//   • vloga → dovoljenja (deterministično, frozen — brez naključja);
//   • API ključ (MOBILE_SYNC) → dovoljenja prek scope-ov (projects:*);
//   • pomožniki: permissionsForPrincipal, hasPermission, describePermission.
//
// R240 — ločitev jedra (isti vzorec kot csrf-core/csrf): ČISTO jedro
// (katalog, vloga→dovoljenja, permissionsForRole, describePermission,
// isManagerRole, manjkajocaDovoljenja) je prestavljeno v permissions-core.ts,
// ki je varen za brskalniški paket (površina "Moja vloga in dovoljenja" v
// TopBar ga uvaža). Ta datoteka ostane EDINI strežniški vhod: VSE re-eksporta
// iz jedra (noben obstoječi uvoz se ne spremeni — r240 test zaklene pariteto)
// + principal-pomožniki, ki rabis AuthContext. Od R240 ta datoteka auth.ts
// NE value-importa več (samo type) — enoten varnostni izvor je tako varen
// na OBEH straneh.
//
// NAČELA:
//   • fail-closed — neznano dovoljenje/neznana vloga = brez pravic;
//   • brez tihe inflacije/deflacije — mapa dovoljenj zrcali obnašanje
//     pred R135, kjer je to mogoče; izrecne izjeme so dokumentirane
//     (PORTAL: MONTER izgubi upravljanje portalov — pisarna; apikey izgubi
//     generiranje uradnih dokumentov — glej docs/SECURITY-POLICY.md);
//   • rezervirana dovoljenja (brez rute še) so del kataloga, da UI in
//     dokumenacija govorita isti jezik, ko pride površina.

import type { AuthContext } from './auth'
import type { ApiKeyScope } from './api-keys'

// Čisto jedro — re-eksporta (EN VIR: definicije živijo v permissions-core.ts).
// `permissionsForRole` je tu tudi LOKALNO uvožen — export-from imena NE vnese
// v modul (raba v permissionsForPrincipal spodaj).
export {
  ALL_PERMISSIONS,
  PERMISSION_CATALOG,
  ROLE_PERMISSIONS,
  describePermission,
  isManagerRole,
  manjkajocaDovoljenja,
  permissionsForRole,
} from './permissions-core'
export type { Permission, Role } from './permissions-core'

import { permissionsForRole } from './permissions-core'
import type { Permission } from './permissions-core'

/**
 * API ključ (MOBILE_SYNC) → dovoljenja prek scope-ov. Scope-i, ki nimajo
 * ustreznika v katalogu (measurements:*, photos:*), ostanejo na scope
 * preverbah (apiKeyScopeDenied) — katalog pokriva poslovne površine.
 */
const APIKEY_SCOPE_PERMISSION_MAP: Readonly<Record<ApiKeyScope, readonly Permission[]>> =
  Object.freeze({
    'projects:read': ['projects.read'],
    'projects:write': ['projects.write'],
    'measurements:create': [],
    'photos:read': [],
    'photos:write': [],
  })

/** Dovoljenja principalca: seja prek vloge, API ključ prek scope-ov. */
export function permissionsForPrincipal(principal: AuthContext): readonly Permission[] {
  if (principal.kind === 'user') return permissionsForRole(principal.session.vloga)
  const mapped = principal.scopes.flatMap((s) => APIKEY_SCOPE_PERMISSION_MAP[s] ?? [])
  return Object.freeze([...new Set(mapped)])
}

/** Ali principal nosi konkretno dovoljenje? */
export function hasPermission(principal: AuthContext, permission: Permission): boolean {
  return permissionsForPrincipal(principal).includes(permission)
}

/**
 * Manjkajoča dovoljenja seznama (za UI: kaj točno uporabniku manjka).
 * Vrne samo tista, ki jih principal NIMA — vrstni red iz argumenta.
 */
export function missingPermissions(
  principal: AuthContext,
  permissions: readonly Permission[]
): Permission[] {
  const owned = new Set<string>(permissionsForPrincipal(principal))
  return permissions.filter((p) => !owned.has(p))
}
