/**
 * PRODUCT SDK — SKUPNA ENGINE KONVERZIJA (runda S+8.1 §9 — P0).
 *
 * render IN maska morata prihajati iz ISTE deterministične geometrije:
 *
 *   FenceLayout (EDINI vir)
 *       ↓ engineLayoutOf (čista preslikava podatkov, NI izračuna)
 *       ↓                ↓
 *     render           maska      (isti engine rasterizacijski sloj)
 *
 * Prej je maska REKONSTRUIRALA FenceRequest in engine je geometrijo PONOVNO
 * izračunal — to je divergenčna pot (audit F7). Zdaj oba konsumerja dobita
 * ekspliciten layout — NI podvojenega geometrijskega izračuna.
 */
import type { FenceLayout } from './types'

/**
 * Konverzija SDK FenceLayout → engine layout (podmnožina polj).
 * KRITIČNO: engine `productId` je KATALOG id (woodcore-*) — renderer po njem
 * prepozna profil (ROMB rebro). Podatki so identični (isti katalog).
 */
export function engineLayoutOf(layout: FenceLayout) {
  return {
    productId: layout.catalogProductId,
    profile: layout.profile,
    orientation: layout.orientation,
    faceWidthMm: layout.faceWidthMm,
    gapMm: layout.gapMm,
    pitchMm: layout.pitchMm,
    fenceWidthMm: layout.fenceWidthMm,
    fenceHeightMm: layout.fenceHeightMm,
    fieldHeightMm: layout.fieldHeightMm,
    fieldSpanMm: layout.fieldSpanMm,
    boardCount: layout.boardCount,
    boards: layout.boards,
    handleHeightMm: layout.handleHeightMm,
    handlePresent: layout.handlePresent,
    warnings: layout.warnings,
  }
}
