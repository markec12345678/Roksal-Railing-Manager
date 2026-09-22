// Roksal Field - Zod validacijske sheme za API rute
import { z } from 'zod'

// ============================================
// PROJEKTI
// ============================================

export const createProjectSchema = z.object({
  nazivProjekta: z.string().min(3, 'Naziv projekta mora imeti vsaj 3 znake'),
  customerId: z.string().min(1, 'ID stranke je obvezen'),
  monterId: z.string().optional(),
  vodjaId: z.string().optional(),
  ekipaId: z.string().optional(),
  datumMontaze: z.string().datetime().optional(),
  opombe: z.string().optional(),
})

export const updateProjectSchema = z.object({
  status: z.enum(['NACRTOVANO', 'V_TEKU', 'ZAKLJUCENO', 'USTAVLJENO']).optional(),
  opombe: z.string().optional(),
  monterId: z.string().optional(),
  // FOLLOW-UP PONUDBE — ISO datum ali null za brisanje spomnika
  followUpDate: z.string().optional().nullable(),
  followUpOpomba: z.string().max(300).optional().nullable(),
})

// ============================================
// STRANKE
// ============================================

export const createCustomerSchema = z.object({
  ime: z.string().min(2, 'Ime je obvezno (min 2 znaka)'),
  naslov: z.string().min(3, 'Naslov je obvezen (min 3 znaki)'),
  telefon: z.string().optional().nullable(),
  email: z.string().email('Neveljaven email format').optional().nullable().or(z.literal('')),
})

// ============================================
// MERITVE
// ============================================

export const createMeasurementSchema = z.object({
  projectId: z.string().min(1, 'ID projekta je obvezen'),
  dolzinaMm: z.number().int().positive({ message: 'Dolžina mora biti pozitivno število' }),
  visinaMm: z.number().int().positive({ message: 'Višina mora biti pozitivno število' }),
  lidarScanUrl: z.string().optional(),
  arMetadata: z.record(z.string(), z.unknown()).optional(),
  gpsLokacija: z.object({ lat: z.number(), lng: z.number() }).optional(),
})

// ============================================
// DOKUMENTI
// ============================================

export const createDocumentSchema = z.object({
  projectId: z.string().min(1, 'ID projekta je obvezen'),
  tipDokumenta: z.enum(['TEHNICNI_LIST', 'PRIMOPREDAJA', 'E_RACUN', 'ZAPISNIK_NAVORA']),
})

// ============================================
// ZALOGA
// ============================================

export const createInventorySchema = z.object({
  sifraMateriala: z.string().min(1, 'Šifra materiala je obvezna'),
  naziv: z.string().min(1, 'Naziv materiala je obvezen'),
  tip: z.enum(['WPC_deska', 'Inox_vijak', 'Kemicno_sidro', 'Alu_profil']),
  kolicinaZaloga: z.number().min(0, 'Količina ne more biti negativna'),
  enota: z.enum(['kos', 'm', 'kg']),
  minimalnaZaloga: z.number().min(0).default(5),
})

export const inventoryMovementSchema = z.object({
  inventoryId: z.string().min(1),
  projectId: z.string().optional(),
  kolicina: z.number().positive('Količina mora biti pozitivna'),
  tipPremika: z.enum(['PORABA', 'DOPOLNITEV', 'ODPIS']),
})

// ============================================
// KALKULATOR
// ============================================

export const railingCalcSchema = z.object({
  totalLengthMm: z.number().positive(),
  slatWidthMm: z.number().positive(),
  maxGapMm: z.number().positive().max(200, 'Maksimalni razmik ne sme presegati 200mm'),
  profileType: z.enum(['classic', 'z-line', 'vertical']),
})

export const anchoringCalcSchema = z.object({
  holeCount: z.number().int().positive(),
  holeDepthMm: z.number().positive(),
  holeDiameterMm: z.number().positive(),
  temperature: z.number().min(-20).max(50),
  anchorType: z.enum(['hilti-hit', 'fischer-fis', 'generic']),
})

export const windLoadCalcSchema = z.object({
  heightAboveGround: z.number().positive(),
  terrainCategory: z.enum(['I', 'II', 'III', 'IV']),
  windSpeedMs: z.number().positive(),
  railingAreaM2: z.number().positive(),
  railingType: z.enum(['solid', 'slatted', 'z-line']),
})

// ============================================
// RAZPORED OGRAJE IN PONUDBA (railing-layout, quote)
// ============================================
//
// API ne sme sprejeti poljubnega JSON kot konfiguracijo ograje ali cenik:
// `{ heightMm: "visoko" }` ali `{ total: 1 }` bi sicer prišla do računanja.
// Zato so sheme tu eksplicitne, z mejami, ki jih je mogoče preveriti
// (`zod` v4 zahteva dvoparametrski `z.record`).

const postShapeSchema = z.enum(['ROUND', 'SQUARE', 'RECT', 'FLAT'])

/** Delna konfiguracija — klient pošlje samo tisto, kar je spremenil. */
export const railingSpecSchema = z.object({
  system: z
    .enum(['GLASS_CHANNEL', 'GLASS_POSTS', 'POST_BARS', 'POST_MESH', 'POST_WOOD', 'FRENCH', 'CUSTOM'])
    .optional(),
  heightMm: z.number().min(300).max(3000).optional(),
  mounting: z.enum(['SLAB_TOP', 'SLAB_SIDE', 'PARAPET_TOP']).optional(),
  baseOffsetMm: z.number().min(0).max(500).optional(),
  postSpacingMaxMm: z.number().min(200).max(4000).optional(),
  postSection: z
    .object({
      shape: postShapeSchema.optional(),
      widthMm: z.number().positive().max(500).optional(),
      depthMm: z.number().positive().max(500).optional(),
    })
    .optional(),
  postFixing: z.enum(['BASE_PLATE', 'SIDE_BRACKET', 'CORE_DRILLED']).optional(),
  cornerPosts: z.boolean().optional(),
  glass: z
    .object({
      type: z.enum(['ESG', 'VSG', 'ESG_VSG']).optional(),
      thicknessMm: z.number().positive().max(60).optional(),
      maxPanelWidthMm: z.number().positive().max(6000).optional(),
      sideGapMm: z.number().min(0).max(50).optional(),
      bottomGapMm: z.number().min(0).max(200).optional(),
    })
    .optional(),
  baseProfile: z
    .object({
      enabled: z.boolean().optional(),
      widthMm: z.number().positive().max(400).optional(),
      heightMm: z.number().positive().max(600).optional(),
      embedMm: z.number().min(0).max(300).optional(),
      drainageSpacingMm: z.number().min(0).max(5000).optional(),
    })
    .optional(),
  handrail: z
    .object({
      type: z.enum(['NONE', 'U_COVER_ALU', 'ROUND_42', 'ROUND_48', 'RECT', 'WOOD']).optional(),
      widthMm: z.number().positive().max(300).optional(),
      heightMm: z.number().positive().max(300).optional(),
      returnsAtEnds: z.boolean().optional(),
    })
    .optional(),
  bars: z
    .object({
      count: z.number().int().min(0).max(30).optional(),
      diameterMm: z.number().positive().max(100).optional(),
      shape: postShapeSchema.optional(),
    })
    .optional(),
  mesh: z
    .object({
      openingMm: z.number().min(0).max(500).optional(),
      heightMm: z.number().positive().max(3000).optional(),
    })
    .optional(),
  custom: z
    .object({
      spacingMm: z.number().positive().max(5000).optional(),
      heightMm: z.number().positive().max(3000).optional(),
      repeatAsPost: z.boolean().optional(),
      assetName: z.string().max(200).optional(),
    })
    .optional(),
  wastePercent: z.number().min(0).max(50).optional(),
  metalFinishLabel: z.string().max(120).optional(),
  demolition: z.boolean().optional(),
  mountingIncluded: z.boolean().optional(),
})

/** Točka obsega v metrih (lokalni koordinatni okvir: prva točka v izhodišču). */
export const perimeterPointSchema = z.object({
  xM: z.number().min(-1000).max(1000),
  yM: z.number().min(-1000).max(1000).optional(),
  zM: z.number().min(-1000).max(1000),
})

/** Popravki s trakom, po indeksu roba. Ključi so indeksi, zato number → number. */
export const overridesSchema = z.record(
  z.coerce.number().int().min(0).max(100),
  z.coerce.number().positive().max(200000),
)

export const railingLayoutSchema = z.object({
  points: z.array(perimeterPointSchema).min(2, 'Potrebni sta vsaj dve točki roba.').max(200),
  closed: z.boolean().default(false),
  overridesMm: overridesSchema.optional(),
  spec: railingSpecSchema.optional(),
})

export const quoteSchema = railingLayoutSchema.extend({
  /** Delni cenik — neznani ključi se ignorirajo, vrednosti morajo biti števila. */
  prices: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
  projectId: z.string().max(64).optional(),
})
