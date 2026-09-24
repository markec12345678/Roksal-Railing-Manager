/**
 * PRODUCT SDK — KATALOG (runda S+8 §5, §21 — SERVER-AUTHORITATIVE).
 *
 * ProductDefinition je IZKLJUČNO sestavljen s strani strežnika iz
 * data/roksal-catalog.json (validiran z zod v @/lib/product-catalog).
 * Klient NE sme poslati definition JSON-a — to bi obšlo katalog in pravila
 * (spec §21). Funkcija `productDefinitionChecksum` zagotavlja sledljivost
 * (isti katalog → isti hash → reproducibilni render).
 */
import { getProduct, getCatalog, type CatalogProfile, type Orientation } from '@/lib/product-catalog'
import { createHash } from 'node:crypto'
import type { PostSpacingQualifier, ProductDefinition, ProfileShape } from './types'

/**
 * woodcore-romb-67 → roksal.woodcore.romb-67 (deterministično).
 * "woodcore" predpona = family (WoodCore); kanonični id loči family segment.
 */
export function canonicalProductId(catalogProductId: string): string {
  const family = getCatalog().family.toLowerCase()
  if (catalogProductId.startsWith(`${family}-`)) {
    return `roksal.${family}.${catalogProductId.slice(family.length + 1)}`
  }
  return `roksal.${catalogProductId}`
}

/**
 * Sprejme kanonični SDK id ALI katalog productId — normalizacija brez ugibanja.
 * "roksal.woodcore.romb-67" → "woodcore-romb-67"; "woodcore-romb-67" → isto.
 */
export function normalizeProductId(id: string): string {
  if (!id.startsWith('roksal.')) return id
  const rest = id.slice('roksal.'.length)
  return rest.replace('.', '-')
}

/** Oblika profila je PODATEK, izpeljan iz uradnega imena — zapisana preslikava. */
function shapeOf(p: CatalogProfile): ProfileShape {
  if (p.profile.startsWith('KUBO')) return 'kubo'
  if (p.profile.startsWith('ROMB')) return 'rhombus'
  if (p.profile.startsWith('DESKA-150')) return 'board'
  return 'solid' // POLNA DESKA-*
}

/** Zaključki (čepi/letvica) iz posebnosti profila — besedilo IZ kataloga. */
function capRuleOf(p: CatalogProfile): string {
  if (p.profile.startsWith('ROMB')) return 'levi/desni čep ALI zaključna letvica (katalog accessories)'
  if (p.profile.startsWith('DESKA-150')) return 'zaključni pokrovček (katalog accessories)'
  return 'ni dokumentirano v katalogu'
}

/**
 * S+8.1 §2 (P0): kvalifikatorji 1:1 iz katalogovih ključev — NIČ izgubljenega,
 * NIČ izmišljenega. Samodejno se uporabi SAMO verticalOver150Cm (edini pravilo
 * s popolnoma strukturiranim pogojem: višina polja > 1500 mm). Ostali
 * (horizontalWithMidConnection, horizontalUpperBound, …) ostanejo PODATKI.
 */
const AUTO_APPLIED_QUALIFIERS: Record<string, { thresholdMm: number; condition: string }> = {
  verticalOver150Cm: { thresholdMm: 1500, condition: 'velja za višino ograje nad 150 cm (katalog FAQ)' },
}

function qualifiersOf(p: CatalogProfile): PostSpacingQualifier[] {
  const out: PostSpacingQualifier[] = []
  for (const [key, value] of Object.entries(p.maxPostSpacingMm)) {
    if (key === 'horizontal' || key === 'vertical') continue
    if (value === null) continue // katalog: ključ obstaja, vrednost ni dokumentirana
    const auto = AUTO_APPLIED_QUALIFIERS[key]
    out.push({
      key,
      orientation: key.startsWith('vertical') ? 'vertical' : 'horizontal',
      maxSpacingMm: value,
      condition: auto ? auto.condition : `katalog ključ "${key}" — pogoj NI strukturiran v konfiguraciji, NI samodejno uporabljen`,
      autoApplied: Boolean(auto),
      appliesWhenFieldHeightAboveMm: auto ? auto.thresholdMm : undefined,
    })
  }
  // Determinističen vrstni red (isti katalog → ista definicija → isti hash).
  out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  return out
}

export function toProductDefinition(p: CatalogProfile): ProductDefinition {
  return {
    id: canonicalProductId(p.productId),
    catalogProductId: p.productId,
    manufacturer: getCatalog().manufacturer,
    family: getCatalog().family,
    profile: {
      name: p.profile,
      shape: shapeOf(p),
      faceWidthMm: p.faceWidthMm,
      thicknessMm: p.thicknessMm,
      standardLengthsMm: p.standardLengthsMm,
    },
    orientations: p.orientation as Orientation[],
    mounting: {
      screwVisibility: p.screwsVisible ? 'visible' : 'hidden',
      fixing: p.fixing,
      // S+8.1 §2 (P0): orientacijsko-specifična pravila — NI fallbacka
      // (prej: horizontal ?? vertical = izguba podatkov + izmišljen H→V fallback).
      maxPostSpacingByOrientation: {
        horizontal: { orientation: 'horizontal', maxSpacingMm: p.maxPostSpacingMm.horizontal ?? null },
        vertical: { orientation: 'vertical', maxSpacingMm: p.maxPostSpacingMm.vertical ?? null },
      },
      postSpacingQualifiers: qualifiersOf(p),
      maxRailSpacingMm: p.maxRailSpacingMm?.vertical ?? null,
      capRule: capRuleOf(p),
      handle: {
        available: p.handle.available,
        dimensionMm: p.handle.dimensionMm,
        screwsEveryMm: p.handle.screwsEveryMm,
        screwsVisible: p.handle.screwsVisible,
        maxSpliceMm: p.handle.maxSpliceMm,
      },
    },
    board: {
      minGapMm: p.recommendedGapMm.min,
      maxGapMm: p.recommendedGapMm.max,
      canOverlap: true, // katalog: "možno prekrivanje desk — montaža iz obeh strani"
    },
    material: {
      colors: getCatalog().colorPalette.colors.map((c) => ({
        id: c.id,
        name: c.name,
        nameSl: c.nameSl,
        approxHex: c.approxHex,
        evidence: c.evidence,
      })),
      // Površinska izvedba — samo kaj katalog DEJANSKO navaja (ni izmišljeno).
      surface: p.profile.startsWith('DESKA-150')
        ? 'KLASIK (gosto rebro) / RUSTIK (gladka ali gosto rebričena, staran les) — 3 površine'
        : getCatalog().material,
      textureImage: p.assets?.textureImage ?? null,
    },
    assets: {
      productImage: p.assets?.productImage ?? null,
      profileImage: p.assets?.profileImage ?? null,
      textureImage: p.assets?.textureImage ?? null,
      referenceImage: p.assets?.referenceImage ?? null,
    },
    rights: p.rights,
    sourceUrls: p.sourceUrls,
  }
}

/**
 * Server-authoritative lookup (spec §21). Vrne definicijo ALI null
 * (neznan productId — API mora vrniti 400, ne izmišlji profil).
 */
export function getProductDefinition(productId: string): ProductDefinition | null {
  const catalogId = normalizeProductId(productId)
  const profile = getProduct(catalogId)
  return profile ? toProductDefinition(profile) : null
}

/** Vsi kanonični definiciji (za katalogizacijo/testi). */
export function listProductDefinitions(): ProductDefinition[] {
  return getCatalog().profiles.map(toProductDefinition)
}

/**
 * Kanonični hash definicije — sledljivost renderja (isti katalog = isti hash).
 * Definicija je deterministično sestavljena iz istega JSON-a, zato je
 * JSON.stringify stabilen (isti vrstni red polj ob vsaki sestavi).
 */
export function productDefinitionChecksum(def: ProductDefinition): string {
  return createHash('sha256').update(JSON.stringify(def)).digest('hex').slice(0, 16)
}
