// ---------------------------------------------------------------------------
// R154 — Status meritev: čisto jedro (stroga validacija + deterministični
// števec). Vir resnice za vrednosti statusa, ki jih piše PATCH
// /api/measurements/[id] (R153) in jih bere GET /api/measurements?status=
// (R154). Nič ne ugiba: neznana vrednost → false (fail-closed), ne tiho
// normaliziranje na katerokoli raven.
// ---------------------------------------------------------------------------
// Števec (measurementStatusCounts) je namenoma RAZLIČNE narave kot validacija:
// vhod je seznam vrstic IZ BAZE (strežnik piše le veljavne vrednosti), vrstice
// brez statusa pa so legitimne (starejši vnosi pred migracijo R153 so iskreno
// OSNUTEK — backfill brez izmišljene zgodovine). Zato neznana/null vrednost v
// števcu spade v vedro OSNUTEK — enako kot doslej v UI (m.status || 'OSNUTEK').
// Brez Math.random, brez časa — 100 % deterministično.

export const MEASUREMENT_STATUS_VALUES = ['OSNUTEK', 'POTRJENA', 'ARHIVIRANA'] as const

export type MeasurementStatusValue = (typeof MEASUREMENT_STATUS_VALUES)[number]

/**
 * Stroga preverba vrednosti statusa (npr. za ?status= query parameter).
 * Nič pretvarjanja: 'osnutek' (mala črka), ' OSNUTEK ' (presledki), '' in
 * vse drugo → false. Fail-closed klicatelj iz tega naredi 400 z izrecno
 * napako, ne tihega praznega rezultata.
 */
export function isValidMeasurementStatus(v: unknown): v is MeasurementStatusValue {
  return (
    typeof v === 'string' &&
    (MEASUREMENT_STATUS_VALUES as readonly string[]).includes(v)
  )
}

/**
 * Deterministični števec po statusih. Vrstice brez statusa (null/undefined/
 * neznan niz — starejši vnosi pred R153) štejejo pod OSNUTEK (iskren privzetek
 * migracijskega backfilla). Vrstni red vnosa ne vpliva na rezultat; ista
 * množica vrstic → isti rezultat (100× ponovitev brez odmika).
 */
export function measurementStatusCounts<T extends { status?: string | null }>(
  items: readonly T[],
): Record<MeasurementStatusValue, number> {
  const counts: Record<MeasurementStatusValue, number> = {
    OSNUTEK: 0,
    POTRJENA: 0,
    ARHIVIRANA: 0,
  }
  for (const item of items) {
    const s = item?.status
    if (isValidMeasurementStatus(s)) {
      counts[s]++
    } else {
      counts.OSNUTEK++
    }
  }
  return counts
}
