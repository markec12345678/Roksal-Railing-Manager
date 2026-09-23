/**
 * PRODUCT ASSET CATALOG — data-driven loader (S+7 §5).
 *
 * Katalog je PODATEK (data/roksal-catalog.json), ne koda. Ta modul ga samo
 * tipizira, validira in indeksira. Produkti NISMO hardcodirani v React
 * komponentah (spec §5). A-pipeline (src/lib/viz/*) NI dotaknjen.
 *
 * Viri: roksal.com (page_reader), pravice: pending — glej
 * evaluation/ROKSAL-ASSET-RIGHTS.md.
 */
import rawCatalog from '../../../data/roksal-catalog.json'
import { z } from 'zod'

// ---------- Schema (zod) ----------

const colorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  nameSl: z.string(),
  approxHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  evidence: z.string(),
})

const handleSchema = z.object({
  available: z.boolean(),
  dimensionMm: z.array(z.number()).optional(),
  innerMm: z.array(z.number()).optional(),
  screwsEveryMm: z.number().optional(),
  screwsVisible: z.boolean().optional(),
  maxSpliceMm: z.number().optional(),
  note: z.string().optional(),
})

const profileSchema = z.object({
  productId: z.string().min(1),
  profile: z.string().min(1),
  category: z.enum(['precna', 'pokoncna', 'precna+pokoncna']),
  orientation: z.array(z.enum(['horizontal', 'vertical'])).min(1),
  faceWidthMm: z.number().positive(),
  thicknessMm: z.number().positive(),
  standardLengthsMm: z.array(z.number().positive()).min(1),
  fixing: z.string(),
  screwsVisible: z.boolean(),
  specialFeatures: z.array(z.string()),
  maxPostSpacingMm: z.record(z.string(), z.number().nullable()),
  maxRailSpacingMm: z.record(z.string(), z.number().nullable()).nullable(),
  recommendedGapMm: z.object({ min: z.number(), max: z.number() }),
  colorsCount: z.record(z.string(), z.number()),
  colorsEvidence: z.string(),
  handle: handleSchema,
  sourceUrls: z.array(z.string().url()).min(1),
  rights: z.enum(['pending', 'granted', 'rejected']),
  // S+7 dopolnjeno ob modeliranju produkta (ali prazno, če asset še ni na voljo)
  assets: z
    .object({
      productImage: z.string().nullable().default(null),
      profileImage: z.string().nullable().default(null),
      textureImage: z.string().nullable().default(null),
      referenceImage: z.string().nullable().default(null),
    })
    .optional(),
  assetQuality: z.enum(['sufficient', 'insufficient', 'unassessed']).optional(),
})

export const catalogSchema = z.object({
  schemaVersion: z.number(),
  round: z.string(),
  brand: z.string(),
  manufacturer: z.string(),
  family: z.string(),
  material: z.string(),
  warranty: z.string(),
  officialSite: z.string().url(),
  retrievedAt: z.string(),
  rightsPolicy: z.string(),
  colorPalette: z.object({ note: z.string(), colors: z.array(colorSchema) }),
  profiles: z.array(profileSchema).min(1),
  accessories: z.array(z.object({ id: z.string(), name: z.string(), note: z.string().optional() })),
  generalMountingRules: z.array(z.string()),
  assetLibrary: z.object({ note: z.string(), assets: z.array(z.unknown()) }),
})

export type CatalogColor = z.infer<typeof colorSchema>
export type CatalogProfile = z.infer<typeof profileSchema>
export type RoksalCatalog = z.infer<typeof catalogSchema>

export type Orientation = 'horizontal' | 'vertical'

// ---------- Parse once ----------

const parsed = catalogSchema.safeParse(rawCatalog)
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
  throw new Error(`roksal-catalog.json NI veljaven: ${issues}`)
}
const catalog: RoksalCatalog = parsed.data

// ---------- Public API ----------

export function getCatalog(): RoksalCatalog {
  return catalog
}

export function listProfiles(): CatalogProfile[] {
  return catalog.profiles
}

export function getProduct(productId: string): CatalogProfile | null {
  return catalog.profiles.find((p) => p.productId === productId) ?? null
}

/** Profili, ki podpirajo dano orientacijo (npr. pokončna ograja = vertical). */
export function profilesForOrientation(o: Orientation): CatalogProfile[] {
  return catalog.profiles.filter((p) => p.orientation.includes(o))
}

export function getColor(colorId: string): CatalogColor | null {
  return catalog.colorPalette.colors.find((c) => c.id === colorId) ?? null
}

export function listColors(): CatalogColor[] {
  return catalog.colorPalette.colors
}

/**
 * Max razmak nosilcev (stebrov pri prečni / vodoravnih cevi pri pokončni)
 * za orientacijo, mm — spec §2 "maksimalni razmak konstrukcije".
 */
export function maxSupportSpacingMm(p: CatalogProfile, o: Orientation): number | null {
  if (o === 'horizontal') {
    return p.maxPostSpacingMm.horizontal ?? null
  }
  return p.maxRailSpacingMm?.vertical ?? null
}

/** Ali je podani razmak znotraj priporočila proizvajalca (spec §10 identiteta). */
export function isGapWithinRecommendation(p: CatalogProfile, gapMm: number): boolean {
  return gapMm >= p.recommendedGapMm.min && gapMm <= p.recommendedGapMm.max
}

/** Pravice + kakovost za en profil — za poročila (spec §3, §4). */
export function assetStatus(p: CatalogProfile): {
  rights: string
  assetQuality: string
  productImage: string | null
  profileImage: string | null
  textureImage: string | null
  referenceImage: string | null
} {
  return {
    rights: p.rights,
    assetQuality: p.assetQuality ?? 'unassessed',
    productImage: p.assets?.productImage ?? null,
    profileImage: p.assets?.profileImage ?? null,
    textureImage: p.assets?.textureImage ?? null,
    referenceImage: p.assets?.referenceImage ?? null,
  }
}
