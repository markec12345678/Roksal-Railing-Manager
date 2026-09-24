/**
 * PRODUCT SDK — JAVNI API (runda S+8 §20; S+8.1 hardening).
 *
 * Konceptualni API (adaptiran obstoječi arhitekturi — definicija gre vedno
 * eksplicitno kot server-authoritative podatkovna struktura iz kataloga):
 *
 *   const definition = sdk.catalog.get("roksal.woodcore.romb-67")   // strežnik
 *   const layout    = sdk.layout({ ...config, productId }, { definition })
 *   const mask      = sdk.mask(layout, { outWidthPx, outHeightPx })
 *   const render    = sdk.render({ definition, config, material, ... })
 *
 * KLJUČNA ODLOČITEV (spec — KOMPLETNA):
 *   DATA → PROCEDURAL GEOMETRY → REAL MATERIAL → DETERMINISTIC RENDER
 *   AI/Qwen NI source-of-truth za produkt.
 */
export * from './types'
export {
  getProductDefinition,
  listProductDefinitions,
  canonicalProductId,
  normalizeProductId,
  productDefinitionChecksum,
} from './catalog'
export { buildFenceLayout } from './geometry'
export { layoutMask } from './mask'
export { resolveMaterial, findColor } from './material'
export { renderProductFence, renderWithMask, engineLayoutOf } from './render'
export { verifyProductIdentity } from './invariants'
export {
  SdkValidationError,
  resolveMaxPostSpacingMm,
  resolveMaxRailSpacingMm,
  orientationSpacingRule,
  assertOrientationSupported,
  assertHandleAllowed,
  validatePostPositions,
  validateRails,
  assertLayoutConsistentWithConfig,
  evaluateRightsGate,
  resolveRightsMode,
} from './rules'
export type { RightsMode, RightsDecision } from './rules'

import { getProductDefinition, listProductDefinitions } from './catalog'
import { buildFenceLayout } from './geometry'
import { layoutMask } from './mask'
import { renderProductFence, renderWithMask } from './render'
import { verifyProductIdentity } from './invariants'
import { resolveMaterial } from './material'
import { evaluateRightsGate, resolveRightsMode } from './rules'
import type { ProductDefinition } from './types'

export const productSdk = {
  catalog: {
    get: getProductDefinition,
    list: listProductDefinitions,
  },
  layout: (config: Parameters<typeof buildFenceLayout>[0], options?: Parameters<typeof buildFenceLayout>[1]) =>
    buildFenceLayout(config, options),
  mask: layoutMask,
  render: renderProductFence,
  renderWithMask,
  verify: verifyProductIdentity,
  material: resolveMaterial,
  /** S+8.1 §11: eksplicitna pravicna vrata (production/evaluation način). */
  rights: {
    gate: evaluateRightsGate,
    mode: resolveRightsMode,
    of: (def: ProductDefinition, mode?: string | null) => evaluateRightsGate(def, resolveRightsMode(mode)),
  },
}
