/**
 * PRODUCT SDK — MATERIAL ENGINE (runda S+8 §7, §13).
 *
 * Material je LOČEN od geometrije: Geometry + Material = Rendered Product.
 * Material vsebuje: barvo, teksturo, površino, orientacijo.
 *
 * PRAVILA (spec §7/§13):
 *  - NE uporabljaj generativnega modela za osnovno barvo — barva je IZBRANI
 *    material (katalog), ne "matching" scene;
 *  - approxHex je null, če uradni podatek NE obstaja (ni izmišljen);
 *  - izmerjen RGB je dovoljen SAMO z odkrito provenanco "measured"
 *    (neuradno, interno za development/evalvacijo);
 *  - lighting adjustment (npr. A-pipeline harmonizacija) SPREMINJA SAMO
 *    luminanco z omejenim razponom — geometrija in barvna identiteta
 *    ostajata nespremenjena (to zagotavlja A-pipeline: L-only, ±15 %).
 */
import type { ProductDefinition, ProductColor } from './types'

export interface ResolvedMaterial {
  kind: 'color' | 'texture'
  /** RGB 0–255 — IZBRANI material (ni izid barvnega ujemanja). */
  rgb: [number, number, number] | null
  /** RGBA ImageBuffer teksture (samo rights granted; deterministično vzorčenje). */
  texture: { data: Uint8ClampedArray; w: number; h: number } | null
  mode: 'scan' | 'tile'
  colorId: string | null
  /** Sledljivost: od kje je prišla barva (spec §13 "vsak večji shift merljiv"). */
  provenance: string
}

export interface MaterialInput {
  colorId?: string
  /**
   * Izmerjen RGB (neuradno) — dovoljeno SAMO, ker katalog NIMA uradnega hexa.
   * Odkrito zabeleženo v provenance (NI trditev o uradni barvi).
   */
  measuredRgb?: [number, number, number]
  /** Tekstura (server-side naložena, rights gated). */
  texture?: { data: Uint8ClampedArray; w: number; h: number } | null
  mode?: 'scan' | 'tile'
}

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '')
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]
}

/** Najdi barvo v definiciji (deterministično — brez "najbolj podobne" ugibanja). */
export function findColor(def: ProductDefinition, colorId: string): ProductColor | null {
  return def.material.colors.find((c) => c.id === colorId) ?? null
}

/**
 * Razreži material za render. Deterministično: enak vhod → enak izhod.
 * Prioriteta: tekstura (samo rights: granted) > izmerjen RGB (odkrito)
 * > katalog approxHex (uradno, če obstaja). Barva NIKOLI ni izmišljena.
 */
export function resolveMaterial(def: ProductDefinition, input: MaterialInput): ResolvedMaterial {
  if (def.rights === 'granted' && def.material.textureImage && input.texture) {
    return {
      kind: 'texture',
      rgb: null,
      texture: input.texture,
      mode: input.mode ?? 'scan',
      colorId: input.colorId ?? null,
      provenance: `texture:${def.material.textureImage} (rights granted)`,
    }
  }
  if (input.measuredRgb) {
    const [r, g, b] = input.measuredRgb
    if (![r, g, b].every((v) => Number.isFinite(v) && v >= 0 && v <= 255)) {
      throw new Error('product-sdk: measuredRgb mora biti RGB 0–255')
    }
    return {
      kind: 'color',
      rgb: [r, g, b],
      texture: null,
      mode: 'scan',
      colorId: input.colorId ?? null,
      provenance: `measured:${input.colorId ?? 'unknown'} (NEURADNO — interno za development/evalvacijo; uradni hex v katalogu ne obstaja)`,
    }
  }
  if (input.colorId) {
    const color = findColor(def, input.colorId)
    if (!color) {
      throw new Error(`product-sdk: barva "${input.colorId}" ni v paleti produkta "${def.id}"`)
    }
    if (color.approxHex) {
      return {
        kind: 'color',
        rgb: hexToRgb(color.approxHex),
        texture: null,
        mode: 'scan',
        colorId: color.id,
        provenance: `catalog:${color.id} (${color.approxHex})`,
      }
    }
    throw new Error(
      `product-sdk: barva "${color.id}" NIMA uradnega hex (approxHex=null) — podaj measuredRgb z odkrito provenanco ali drugo barvo`,
    )
  }
  throw new Error('product-sdk: material ni razrešen — podaj colorId ali measuredRgb')
}
