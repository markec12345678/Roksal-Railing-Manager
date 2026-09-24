/**
 * MEASUREMENT SDK (issue #2) — merilo (scale) BREZ izmišljevanja.
 *
 * Zakon: absolutne mm vrednosti nastanejo IZKLJUČNO iz veljavnega
 * referenčnega vira (uporabnikova znana mera / Roksal marker / znan objekt /
 * depth senzor). Brez reference NI merila in NI dimenzij (SCALE_REQUIRED).
 *
 * Model v1: izotropno merilo v ravnini slike (fronto-parallel predpostavka,
 * dokumentirana omejitev) — s = knownMm / dolžina_reference_v_enotah.
 * Perspektivna korekcija je prihodnja razširitev prek zaznanih kotnikov
 * (docs/MEASUREMENT-QUALITY.md → uncertainty).
 */
import type { ScaleReference, ResolvedScale } from './types'

export interface ScaleResult {
  scale: ResolvedScale | null
  /** človeku razumljiv razlog, če je scale null */
  reason: string | null
}

/** Validiraj referenco in razreši merilo (normalizirani prostor 0..1). */
export function resolveScale(reference: ScaleReference | null | undefined): ScaleResult {
  if (!reference) {
    return {
      scale: null,
      reason:
        'Ni referenčne mere. Označite znano dolžino (npr. 2 točki na letvici in dolžino v mm).',
    }
  }
  const { p1, p2, knownMm, kind } = reference
  if (
    !Number.isFinite(p1.x) || !Number.isFinite(p1.y) ||
    !Number.isFinite(p2.x) || !Number.isFinite(p2.y) ||
    !Number.isFinite(knownMm)
  ) {
    return { scale: null, reason: 'Referenca ni veljavna (ne-finite vrednosti).' }
  }
  if (knownMm <= 0 || knownMm > 100000) {
    return { scale: null, reason: 'Znana dolžina mora biti pozitivna in realistična (0 < mm ≤ 100 000).' }
  }
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.hypot(dx, dy)
  // minimalna dolžina reference: sicer je merilo nestabilno (malo pikslov)
  if (len < 0.02) {
    return {
      scale: null,
      reason:
        'Referenčni točki sta preveč blizu — označite daljšo znano dolžino (≥ 2 % slike).',
    }
  }
  if (len > 1.5) {
    return { scale: null, reason: 'Referenčni točki sta izven slike.' }
  }
  const s = knownMm / len
  return {
    scale: {
      // izotropno v ravnini slike; Y z manjšo zaupanja vrednostjo pri
      // horizontalni referenci (dokumentirano v QUALITY → uncertaintyMm)
      mmPerUnitX: s,
      mmPerUnitY: s,
      reference: { p1, p2, knownMm, kind },
      referenceLengthUnits: len,
    },
    reason: null,
  }
}
