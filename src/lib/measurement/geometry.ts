/**
 * MEASUREMENT SDK (issue #2) — geometrijsko mapiranje (§6).
 *
 * Meritve → FenceRequest → OBSTOJEČI fence-engine (computeFenceLayout).
 * NE podvaja postavitvene logike: fence-engine/Product SDK ostajata edini
 * vir geometrijske resnice. Izmerjena geometrija je SAMO vhod.
 */
import type { MeasurementSession } from './types'
import { computeFenceLayout } from '../procedural/fence-engine'
import type { FenceLayout, FenceRequest } from '../procedural/fence-engine'
import { getProductDefinition } from '../product-sdk'

export interface GeometryMappingInput {
  session: MeasurementSession
  /** katalog izdelek (server-authoritative id — validira klicatelj) */
  productId: string
  orientation: 'horizontal' | 'vertical'
  /** razmak med deskami (mm) — izberi uporabnik/profil, NE ugibaj */
  gapMm: number
  /** širina stebra (mm) — izberi uporabnik/profil, NE ugibaj */
  postWidthMm: number
  /** material za render (barva RGB) — opcijsko, samo za predogled */
  colorRgb?: [number, number, number]
}

export class GeometryMappingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GeometryMappingError'
  }
}

export interface GeometryMappingResult {
  fenceRequest: FenceRequest
  layout: FenceLayout
  /** materialni povzetek IZ layouta (brez cen — cena je ločena plast) */
  takeoffPreview: {
    boardCount: number
    boardsTotalLinearM: number
    postCount: number
    fieldSpanMm: number
    fenceHeightMm: number
    cutList: Array<{ index: number; cutMm: number }>
  }
}

/** Zgradi FenceRequest iz potrjene meritve in izračunaj layout prek fence-engine. */
export function mapToGeometry(input: GeometryMappingInput): GeometryMappingResult {
  const { session } = input
  if (!session.geometry) {
    throw new GeometryMappingError(
      'Meritev nima izmerjene geometrije (stanje: ' + session.quality.state + ') — merilo je obvezno.',
    )
  }
  const g = session.geometry
  if (!(input.gapMm >= 0 && input.gapMm <= 200)) {
    throw new GeometryMappingError('gapMm mora biti v [0, 200].')
  }
  if (!(input.postWidthMm >= 10 && input.postWidthMm <= 200)) {
    throw new GeometryMappingError('postWidthMm mora biti v [10, 200].')
  }
  const fenceWidthMm = Math.round(g.totalLengthMm.valueMm)
  const fenceHeightMm = Math.round(g.heightMm.valueMm)
  if (fenceWidthMm < 300 || fenceWidthMm > 20000) {
    throw new GeometryMappingError('Izmerjena dolžina je izven proizvodnega območja (300..20000 mm).')
  }
  if (fenceHeightMm < 300 || fenceHeightMm > 3000) {
    throw new GeometryMappingError('Izmerjena višina je izven proizvodnega območja (300..3000 mm).')
  }

  // Produkt: server-authoritative definicija iz Product SDK (issue #2 §7 —
  // profil se NE ugiba; klicatelj ga izbere, SDK validira orientacijo + razmak).
  const def = getProductDefinition(input.productId)
  if (!def) {
    throw new GeometryMappingError(`Neznan produkt "${input.productId}".`)
  }
  if (!def.orientations.includes(input.orientation)) {
    throw new GeometryMappingError(
      `Produkt "${def.id}" ne podpira orientaciji "${input.orientation}" (dovoljeno: ${def.orientations.join(', ')}).`,
    )
  }
  if (input.gapMm < def.board.minGapMm || input.gapMm > def.board.maxGapMm) {
    throw new GeometryMappingError(
      `Razmak ${input.gapMm} mm je izven dovoljenega območja produkta (${def.board.minGapMm}..${def.board.maxGapMm} mm).`,
    )
  }

  const fenceRequest: FenceRequest = {
    // fence-engine dela z kataloškim ključem (stara pot) — SDK definicija je
    // že validirala id/orientacijo/razmak zgoraj
    productId: def.catalogProductId,
    orientation: input.orientation,
    fenceWidthMm,
    fenceHeightMm,
    gapMm: input.gapMm,
    material:
      input.colorRgb !== undefined
        ? { kind: 'color', rgb: input.colorRgb }
        : { kind: 'color', rgb: [120, 120, 120] }, // nevtralna siva za layout-only uporabo
    outWidthPx: 200,
    outHeightPx: 150,
    posts:
      g.postPositionsMm.length > 0
        ? { widthMm: input.postWidthMm, positionsMm: [...g.postPositionsMm] }
        : null,
  }

  // layout iz obstoječega engine (EN viro resnice) — render ne potrebujemo
  const layout = computeFenceLayout(fenceRequest)

  const cutList = layout.boards
    .filter((b) => b.cut)
    .map((b) => ({ index: b.index, cutMm: Math.round(b.visibleMm) }))
  const boardsTotalLinearM =
    layout.boards.reduce((sum, b) => sum + b.visibleMm, 0) / 1000

  return {
    fenceRequest,
    layout,
    takeoffPreview: {
      boardCount: layout.boardCount,
      boardsTotalLinearM: Math.round(boardsTotalLinearM * 100) / 100,
      postCount: g.postCount,
      fieldSpanMm: layout.fieldSpanMm,
      fenceHeightMm,
      cutList,
    },
  }
}
