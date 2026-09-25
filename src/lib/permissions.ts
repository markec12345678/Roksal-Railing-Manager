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
// NAČELA:
//   • fail-closed — neznano dovoljenje/neznana vloga = brez pravic;
//   • brez tihe inflacije/deflacije — mapa dovoljenj zrcali obnašanje
//     pred R135, kjer je to mogoče; izrecne izjeme so dokumentirane
//     (PORTAL: MONTER izgubi upravljanje portalov — pisarna; apikey izgubi
//     generiranje uradnih dokumentov — glej docs/SECURITY-POLICY.md);
//   • rezervirana dovoljenja (brez rute še) so del kataloga, da UI in
//     dokumenacija govorita isti jezik, ko pride površina.

import type { AuthContext } from './auth'
import { hasRole, MANAGER_ROLES } from './auth'
import type { ApiKeyScope } from './api-keys'

/** Vsi dovoljeni roli uporabnikov (session žeton nosi vlogo snapshot). */
export type Role = 'ADMIN' | 'VODJA' | 'MONTER' | 'SKLADISCE'

export type Permission =
  // §10 spec — projekti in stranke
  | 'projects.read'
  | 'projects.write'
  | 'customers.read'
  | 'customers.write'
  // §10 spec — meritve, ponudbe, cene, zaklep
  | 'measurements.approve'
  | 'quotes.create'
  | 'quotes.approve'
  | 'price.override'
  | 'deal.lock'
  // §10 spec — zaloga in nabava
  | 'inventory.read'
  | 'inventory.write'
  | 'inventory.adjust'
  | 'procurement.create'
  | 'procurement.approve'
  | 'procurement.receive'
  // §10 spec — računi in dokumenti
  | 'invoices.create'
  | 'invoices.issue'
  | 'invoices.cancel'
  | 'documents.read'
  | 'documents.generate'
  | 'documents.sign'
  // §10 spec — upravljavska površina
  | 'portal.manage'
  | 'users.manage'
  | 'catalog.manage'
  | 'production.manage'
  | 'warranty.manage'
  // r135 dodatka za natančen izraz obstoječe matrike branja
  | 'users.read'
  | 'invoices.read'

/**
 * Katalog vseh dovoljenj z slovenskimi oznakami (za sporočila 403 in UI).
 * `spec: false` = r135 dodatek (read-pariteta), ostali so iz §10 spec.
 */
export const PERMISSION_CATALOG: Readonly<
  Record<Permission, { label: string; opis: string; spec: boolean }>
> = Object.freeze({
  'projects.read': { label: 'Branje projektov', opis: 'Pregled projektov (resource-plast dodatno oža na svoje)', spec: true },
  'projects.write': { label: 'Pisanje projektov', opis: 'Urejanje sync polj in statusov prek statusnega stroja', spec: true },
  'customers.read': { label: 'Branje strank', opis: 'Pregled CRM strank', spec: true },
  'customers.write': { label: 'Pisanje strank', opis: 'Ustvarjanje in urejanje strank (brisanje = vodstvo)', spec: true },
  'measurements.approve': { label: 'Potrjevanje meritev', opis: 'Rezervirano: formalno potrjevanje terenskih meritev', spec: true },
  'quotes.create': { label: 'Izdelava ponudb', opis: 'Izračun ponudbe (kalkulator/BOM)', spec: true },
  'quotes.approve': { label: 'Potrjevanje ponudb', opis: 'Rezervirano: odobritev ponudbe pred izdajo', spec: true },
  'price.override': { label: 'Spreminjanje cen', opis: 'Urejanje cenikov materialov (cenik = vir resnice)', spec: true },
  'deal.lock': { label: 'Zaklep posla', opis: 'Deal-lock s podpisoma stranke in monterja na terenu', spec: true },
  'inventory.read': { label: 'Branje zaloge', opis: 'Pregled zaloge in kartic materiala', spec: true },
  'inventory.write': { label: 'Premiki zaloge', opis: 'Poraba, dopolnitev, odpis — premiki z ledger transakcijo', spec: true },
  'inventory.adjust': { label: 'Popravki zaloge', opis: 'Rezervirano: inventura in korekcije stanj', spec: true },
  'procurement.create': { label: 'Ustvarjanje naročil', opis: 'Naročilo materiala dobavitelju (iz BOM ali ročno)', spec: true },
  'procurement.approve': { label: 'Upravljanje naročil', opis: 'Potrditev/pošiljanje/preklic naročila (statusni stroj)', spec: true },
  'procurement.receive': { label: 'Prejem naročil', opis: 'Prejem materiala v skladišče (idempotenten prejem)', spec: true },
  'invoices.create': { label: 'Izdelava računov', opis: 'Ustvarjanje osnutka računa (uradni dokument)', spec: true },
  'invoices.issue': { label: 'Izdaja računov', opis: 'Izdaja (IZDAN) in označitev plačila (PLAČAN)', spec: true },
  'invoices.cancel': { label: 'Storniranje računov', opis: 'Storno izdanega računa (STORNIRAN)', spec: true },
  'documents.read': { label: 'Branje dokumentov', opis: 'Pregled dokumentov projekta', spec: true },
  'documents.generate': { label: 'Generiranje dokumentov', opis: 'Izdelava PDF dokumentov projekta', spec: true },
  'documents.sign': { label: 'Podpisovanje dokumentov', opis: 'Podpis dokumenta s sledljivostjo (signature audit)', spec: true },
  'portal.manage': { label: 'Upravljanje portalov', opis: 'Povezave za stranke: izdaja, izklop, preklic (pisarna)', spec: true },
  'users.manage': { label: 'Upravljanje uporabnikov', opis: 'Povabila, deaktivacija, zaklep, vloge, reset gesla (ADMIN)', spec: true },
  'catalog.manage': { label: 'Upravljanje kataloga', opis: 'Profili, dobavitelji, novi artikli zaloge', spec: true },
  'production.manage': { label: 'Upravljanje proizvodnje', opis: 'Razpored montaž in ekipe', spec: true },
  'warranty.manage': { label: 'Upravljanje garancij', opis: 'Rezervirano: garancijski spisi in reclamacije', spec: true },
  'users.read': { label: 'Pregled ekipe', opis: 'Seznam uporabnikov in njihovih statusov (r135 dodatek)', spec: false },
  'invoices.read': { label: 'Branje računov', opis: 'Pregled računov (monter: svojih projektov) (r135 dodatek)', spec: false },
})

/** Vsi dovoljenja kot readonly lista (deterministični vrstni red kataloga). */
export const ALL_PERMISSIONS: readonly Permission[] = Object.freeze(
  Object.keys(PERMISSION_CATALOG) as Permission[]
)

/**
 * Vloga → dovoljenja. Zrcali obnašanje pred R135:
 *   ADMIN     = vse;
 *   VODJA     = vse razen users.manage (R134: upravljanje računov samo ADMIN);
 *   MONTER    = terenski set: svoji projekti, stranke, ponudbe, deal-lock na
 *               terenu, dokumenti + branje zaloge/računov (svoji);
 *   SKLADISCE = zaloga (premiki + prejemi), branje projektov/strank/računov.
 * Izjeme pri migraciji (izrecno dokumentirane, ne tihe):
 *   portal.manage NIMA MONTER (prej: lastnik projekta je lahko omogočil
 *   portal — zdaj izključno pisarna; UI pokaže stanje "Ureja pisarna");
 *   apikey NIMA documents.generate (uradni dokumenti — isto kot računi).
 */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = Object.freeze({
  ADMIN: ALL_PERMISSIONS,
  VODJA: Object.freeze(ALL_PERMISSIONS.filter((p) => p !== 'users.manage')),
  MONTER: Object.freeze([
    'projects.read',
    'projects.write',
    'customers.read',
    'customers.write',
    'quotes.create',
    'deal.lock',
    'inventory.read',
    'invoices.read',
    'documents.read',
    'documents.generate',
    'documents.sign',
  ] satisfies Permission[]),
  SKLADISCE: Object.freeze([
    'projects.read',
    'customers.read',
    'inventory.read',
    'inventory.write',
    'procurement.receive',
    'invoices.read',
    'documents.read',
  ] satisfies Permission[]),
})

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

/** Dovoljenja za vlogo (neznana vloga → prazen seznam, fail-closed). */
export function permissionsForRole(role: string): readonly Permission[] {
  return (ROLE_PERMISSIONS as Record<string, readonly Permission[] | undefined>)[role] ?? []
}

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

/** Slovenska oznaka dovoljenja (za sporočila 403 in UI chip-e). */
export function describePermission(permission: Permission): string {
  return PERMISSION_CATALOG[permission]?.label ?? permission
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

/**
 * Ali je vloga vodstvena (isti set kot MANAGER_ROLES)? — most za stare
 * klice, ki se migrirajo na dovoljenja. NOVA koda naj uporablja
 * hasPermission/denyWithoutPermission.
 */
export function isManagerRole(role: string): boolean {
  return MANAGER_ROLES.includes(role)
}
