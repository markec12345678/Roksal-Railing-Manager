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
