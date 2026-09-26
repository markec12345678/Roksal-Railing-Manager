// Roksal — statusne možnosti za UI (R165)
// ---------------------------------------------------------------------------
// Strežnik veljavnost prehodov izvede v src/lib/project-state.ts
// (assertTransition → 409) — ta knjižnica je njegov ODESEL na odjemalcu:
// statusni dropdown na dashboardu sme ponuditi SAMO prehode, ki jih strežnik
// dejansko sprejme za prijavljeno vlogo. Prej je dropdown ponudil VSE 7
// statusov — ilegalna izbira je končala v 409, ki ga UI tiho pogoltnil
// (dvojni bug: dezinformacija + tišina).
//
// POMENBNO — zakaj MIRROR in ne direkten import project-state.ts:
// project-state.ts VALUE-importa iz auth.ts (hasRole, MANAGER_ROLES), auth.ts
// pa vleče NextResponse/session/audit/rate-limit (strežniško). Client komponenta
// tega NE sme uvoziti v bundle. Pariteto mirror ↔ server zagotavljata testi
// (r165-status-options-dark.test.ts): globoka enakost matrice in vloge.
//
// Fail-closed: neznan status → prazne možnosti (nikoli vse). Neznana vloga →
// pot ne-vodstva (least privilege — nikoli izmišljeni vodstveni obhodi).

/** Vsi statusi prisma enum ProjectStatus (pariteta s project-state.ts). */
export const PROJECT_STATUS_OPTIONS = [
  'NACRTOVANO',
  'V_TEKU',
  'ZA_MONTAZO',
  'V_IZDELAVI',
  'MONTIRANO',
  'ZAKLJUCENO',
  'USTAVLJENO',
] as const

export type ProjectStatusOption = (typeof PROJECT_STATUS_OPTIONS)[number]

/**
 * Mirror ALLOWED_TRANSITIONS (project-state.ts) — pariteta testirana globoko.
 * Življenjski cikel: NACRTOVANO → V_TEKU → ZA_MONTAZO → V_IZDELAVI →
 * MONTIRANO → ZAKLJUCENO; stranski izhodi USTAVLJENO; V_IZDELAVI → ZA_MONTAZO.
 */
export const ALLOWED_TRANSITIONS_UI: Record<ProjectStatusOption, ProjectStatusOption[]> = {
  NACRTOVANO: ['V_TEKU', 'USTAVLJENO'],
  V_TEKU: ['ZA_MONTAZO', 'V_IZDELAVI', 'USTAVLJENO'],
  ZA_MONTAZO: ['V_IZDELAVI', 'MONTIRANO', 'USTAVLJENO'],
  V_IZDELAVI: ['ZA_MONTAZO', 'MONTIRANO', 'USTAVLJENO'],
  MONTIRANO: ['ZAKLJUCENO'],
  ZAKLJUCENO: [], // končno stanje — ponovno odpre samo vodstvo (assertTransition)
  USTAVLJENO: ['V_TEKU'], // reaktivacija = vodstvo
}

/** Vodstveni obhod (assertTransition: isManager → karkoli). Pariteta z MANAGER_ROLES. */
const MANAGER_ROLES_UI = ['ADMIN', 'VODJA'] as const

export function isManagerRole(vloga: string | null | undefined): boolean {
  return vloga != null && (MANAGER_ROLES_UI as readonly string[]).includes(vloga)
}

export type StatusOptionsContext = {
  /** Vloga prijavljenega (iz GET /api/auth → user.vloga); null/undefined = neznana. */
  vloga: string | null | undefined
  /** Zaklenjen dogovor ( projekt.dealLocked — strežnik blokira izhod iz ZA_MONTAZO/V_IZDELAVI). */
  dealLocked?: boolean
}

/**
 * Dovoljeni ciljni statusi za dropdown iz stanja `from` za dano vlogo.
 * Vrača tudi `from` samo, če ga strežnik dejansko sprejme (vodstvo sme vse;
 * UI disable-a trenutni status). Neznani status → [] (fail-closed).
 */
export function statusOptionsFor(from: string, ctx: StatusOptionsContext): string[] {
  if (!(from in ALLOWED_TRANSITIONS_UI)) return [] // neznan status — nič ne ponujamo

  if (isManagerRole(ctx.vloga)) {
    // Vodstvo: assertTransition vrne true za VSAK prehod → vse možnosti.
    return [...PROJECT_STATUS_OPTIONS]
  }

  if (ctx.vloga === 'SKLADISCE') return [] // "Skladišče ne sme spreminjati statusa projekta"

  if (ctx.dealLocked && (from === 'ZA_MONTAZO' || from === 'V_IZDELAVI')) {
    return [] // "Zaklenjen dogovor — sprememba statusa je možna samo preko vodstva"
  }

  if (from === 'ZAKLJUCENO' || from === 'USTAVLJENO') {
    return [] // "Iz končnega stanja premika samo vodstvo"
  }

  return [...ALLOWED_TRANSITIONS_UI[from as ProjectStatusOption]]
}

/**
 * Razlog, zakaj možnosti NISO na voljo (ali null, če so) — besedila so DOBESEDNO
 * ista kot sporočila InvalidTransitionError na strežniku (en vir resnice:
 * UI pove uporabniku točno to, kar bi strežnik javil v 409).
 */
export function statusOptionsHint(from: string, ctx: StatusOptionsContext): string | null {
  if (!(from in ALLOWED_TRANSITIONS_UI)) return 'Neznan status projekta.'
  if (isManagerRole(ctx.vloga)) return null
  if (ctx.vloga === 'SKLADISCE') return 'Skladišče ne sme spreminjati statusa projekta'
  if (ctx.dealLocked && (from === 'ZA_MONTAZO' || from === 'V_IZDELAVI')) {
    return 'Zaklenjen dogovor — sprememba statusa je možna samo preko vodstva'
  }
  if (from === 'ZAKLJUCENO' || from === 'USTAVLJENO') {
    return 'Iz končnega stanja premika samo vodstvo'
  }
  return null
}
