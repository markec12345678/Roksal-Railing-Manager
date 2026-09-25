/**
 * R145 (issue #5 §31 — Equipment lifecycle): deterministično jedro
 * življenjskega cikla opreme.
 *
 * Čisto izračunsko jedro (ni baze, ni ure — `now` je vedno VHOD) — isti
 * vzorec kot schedule-conflicts (R142) in lots (R144). Vsi pravili so
 * eksplicitni in dokumentirani; ni tihe degradacije:
 *
 *   • Statusne tranzicije: matrika EQUIPMENT_TRANSITIONS — UPOKOJENO je
 *     TERMINALNO stanje (upokojena oprema se nikoli ne vrne v uporabo;
 *     revizijska sled ostane). Neveljavna tranzicija → 409 z dovoljenimi
 *     cilji (UI prikaže zakaj).
 *   • Kalibracija: merska oprema (calibrationRequired) brez roka
 *     (calibrationDueDate) = "manjka potrdilo" (NEZNANO stanje — iskreno,
 *     ne izmišljen datum); rok v preteklosti = POTEČENA. Oboje pokaže UI.
 *   • Pregledi: interval + zadnji pregled → naslednji rok; če interval
 *     obstaja, zadnji pregled pa ni zabeležen → "pregled ni zabeležen"
 *     (NEZNANO — ne računamo od pridobitve, ker je tudi ta lahko null).
 *
 * §31 zahteve pokrite tu: status transitions (lifecycle), inspection
 * (due), calibration (date/due/certificate). Serial/acquisition sta čista
 * podatka (brez logike). Assignment je v schedule-conflicts (vir "oprema").
 */

export const EQUIPMENT_STATUSES = [
  'NA_VOLJO',
  'V_UPORABI',
  'V_SERVISU',
  'IZGUBLJENO',
  'UPOKOJENO',
] as const

export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number]

/**
 * Legalne tranzicije statusa. NA_VOLJO ↔ V_UPORABI/V_SERVISU (vsakdanji
 * krog); IZGUBLJENO → NA_VOLJO (najdena) ali UPOKOJENO (odpisana);
 * UPOKOJENO: PRAZNA lista — terminalno (deterministično fail-closed).
 */
export const EQUIPMENT_TRANSITIONS: Record<EquipmentStatus, readonly EquipmentStatus[]> = {
  NA_VOLJO: ['V_UPORABI', 'V_SERVISU', 'IZGUBLJENO', 'UPOKOJENO'],
  V_UPORABI: ['NA_VOLJO', 'V_SERVISU', 'IZGUBLJENO', 'UPOKOJENO'],
  V_SERVISU: ['NA_VOLJO', 'V_UPORABI', 'UPOKOJENO'],
  IZGUBLJENO: ['NA_VOLJO', 'UPOKOJENO'],
  UPOKOJENO: [],
}

/** Dovoljeni cilji iz trenutnega statusa (prazno = terminalno). */
export function allowedTransitions(from: string): readonly EquipmentStatus[] {
  return EQUIPMENT_TRANSITIONS[from as EquipmentStatus] ?? []
}

export interface TransitionVerdict {
  ok: boolean
  /** Dovoljeni cilji (tudi ko je tranzicija neveljavna — za 409 odgovor). */
  allowed: readonly EquipmentStatus[]
}

/** Ali je prehod from → to dovoljen? Deterministično, brez stranskih učinkov. */
export function checkTransition(from: string, to: string): TransitionVerdict {
  const allowed = allowedTransitions(from)
  return { ok: (allowed as readonly string[]).includes(to), allowed }
}

/** Podatki, ki jih potrebujejo kalibracijske/prgledivske funkcije (DTO nivo). */
export interface CalibrationInfo {
  calibrationRequired: boolean
  calibrationDueDate: Date | null
  calibrationCertificate?: string | null
}

export interface InspectionInfo {
  lastInspectionAt: Date | null
  inspectionIntervalDays: number | null
}

/**
 * Kalibracija POTEČENA: merska oprema + znan rok + rok < now.
 * Deterministično: isti vhodi → isti rezultat (ni " skoraj potečeno").
 */
export function isCalibrationOverdue(e: CalibrationInfo, now: Date): boolean {
  return e.calibrationRequired && e.calibrationDueDate !== null && e.calibrationDueDate < now
}

/**
 * Merska oprema brez ZNaNega roka = "manjka potrdilo/rok" (iskreno
 * NEZNANO stanje; ne izmišljamo datuma). Nemerska oprema → vedno false.
 */
export function isCalibrationMissing(e: CalibrationInfo): boolean {
  return e.calibrationRequired && e.calibrationDueDate === null
}

/**
 * Periodični pregled ZADELJU: znan interval + zabeležen zadnji pregled +
 * last + interval < now. (Ročno izračunan rok = ista deterministika kot
 * nextInspectionAt.)
 */
export function isInspectionDue(e: InspectionInfo, now: Date): boolean {
  if (e.inspectionIntervalDays === null || e.lastInspectionAt === null) return false
  const next = nextInspectionAt(e)
  return next !== null && next < now
}

/**
 * Interval nastavljen, zadnji pregled pa NI zabeležen → "pregled ni
 * zabeležen" (NEZNANO; ne računamo od pridobitve — ta je lahko prav tako
 * neznan, izmišljevanje je prepovedano).
 */
export function isInspectionUnknown(e: InspectionInfo): boolean {
  return e.inspectionIntervalDays !== null && e.lastInspectionAt === null
}

/** Naslednji pričakovani pregled (deterministično: last + interval dni). */
export function nextInspectionAt(e: InspectionInfo): Date | null {
  if (e.inspectionIntervalDays === null || e.lastInspectionAt === null) return null
  return new Date(e.lastInspectionAt.getTime() + e.inspectionIntervalDays * 24 * 60 * 60 * 1000)
}

/** Veljaven event type (fail-closed v ruti pred zapisom). */
export const EQUIPMENT_EVENT_TYPES = ['PREGLED', 'KALIBRACIJA', 'SERVIS', 'POPRAVILO'] as const
export type EquipmentEventType = (typeof EQUIPMENT_EVENT_TYPES)[number]

export const EQUIPMENT_EVENT_RESULTS = ['V_REDU', 'NAPAKA'] as const
export type EquipmentEventResult = (typeof EQUIPMENT_EVENT_RESULTS)[number]

/**
 * Ali event tip posodablja lastInspectionAt (PREGLED) / kalibracijo
 * (KALIBRACIJA) / zadnjiServis (SERVIS in POPRAVILO)? ENO mesto resnice
 * za traso v ruti — deterministično povezovanje eventa s poljem opreme.
 */
export function eventUpdatesField(type: EquipmentEventType): 'lastInspectionAt' | 'calibration' | 'zadnjiServis' {
  switch (type) {
    case 'PREGLED':
      return 'lastInspectionAt'
    case 'KALIBRACIJA':
      return 'calibration'
    case 'SERVIS':
    case 'POPRAVILO':
      return 'zadnjiServis'
  }
}
