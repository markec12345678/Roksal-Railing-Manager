// R338 — dekompozicija measurements-tab FAZA 3: parse/format pomožne
// (ArMetadata tip + 13 čistih funkcij) izluščene iz measurements-tab.tsx
// (čist premik — kanon R319 faza 1 / R325 faza 2). Vse definicije so
// premaknjene VERBATIM z originalnimi komentarji (R-številke =
// institucionalni spomin); edina sprememba je izrecni `export`. Brez
// 'use client' — čiste funkcije + localStorage bralci (del client drevesa).

import type {
  ArSyncMeta,
  EnotaTip,
  Measurement,
  MeasurementStatus,
  TipMeritve,
} from './shared'
import type { StairCalc } from './templates'
import type { AuditEntry } from './labels'

export interface ArMetadata {
  tipMeritve?: TipMeritve
  oznaka?: string
  segmentId?: string
  opomba?: string
  status?: MeasurementStatus
  // starejše polje (združljivost)
  lokacija?: string
  steviloStebrov?: number
  tipPodlage?: string
  kot?: number
  opombe?: string
  // kalibracija
  pixelsPerMm?: number
  calibrationNote?: string
  // inclinometer
  kotStopinje?: number
  smer?: string
  // P3 — enote (mm/cm/m)
  enota?: 'mm' | 'cm' | 'm'
  originalnaVrednost?: number
  // P3 — kotomer (vogal: notranji + zunanji kot)
  notranjiKot?: number
  zunanjiKot?: number
  // P3 — štebricki (STEBR)
  tipStebra?: 'KONCNI' | 'VMESNI' | 'VOGALNI'
  materialStebra?: 'ALU' | 'INOX' | 'WPC' | 'DRUGO'
  visinaStebraMm?: number
  pozicijaMm?: number
  razmikMm?: number
  steberOznaka?: string
  // P3 — WPC palice
  orientacijaPalic?: 'WPC_POKOCNE' | 'WPC_VODORAVNE' | 'WPC_POSEVNE'
  sirinaPalice?: number
  debelinaPalice?: number
  razmikPalic?: number
  kotPosevnih?: number
  stPalic?: number
  // MERITVE-PRO — vir meritve (photo / ar_snapshot / laser / manual)
  source?: 'photo' | 'ar_snapshot' | 'laser' | 'manual' | string
  photoId?: string
  snapshotId?: string
  // MERITVE-PRO — AR točke (x, y) za AR-sourced mere
  x?: number
  y?: number
  // R281 (issue #16 §10, V1–V6) — sync metadata iz kontrakta: OPAZOVANO
  // stanje klienta (provenance), NIKOLI sync resnica (ta ostane v
  // obstoječem /api/sync — 'strežnik ne zaupa klientu', R148).
  sync?: ArSyncMeta
}

export function parseArMetadata(raw: string | null | undefined): ArMetadata {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as ArMetadata
  } catch {
    return {}
  }
}

export function parseGPS(gpsStr: string | null): { lat: number; lng: number } | null {
  if (!gpsStr) return null
  try {
    return JSON.parse(gpsStr)
  } catch {
    return null
  }
}

export function formatDimension(mm: number): string {
  if (mm >= 1000) return `${(mm / 1000).toFixed(2)}m`
  return `${mm}mm`
}

export function formatM2(mm2: number): string {
  return `${(mm2 / 1_000_000).toFixed(2)}m²`
}

// P1 — multi-unit prikaz mer
export function formatMultiUnit(mm: number): string {
  return `${mm}mm · ${Math.round(mm / 10)}cm · ${(mm / 1000).toFixed(2)}m`
}

export function formatAngleMulti(deg: number): string {
  const rad = (deg * Math.PI) / 180
  return `${deg}° · ${rad.toFixed(2)}rad`
}

export function formatSlopeMulti(deg: number): string {
  const pct = Math.tan((deg * Math.PI) / 180) * 100
  return `${deg.toFixed(1)}° · ${pct.toFixed(1)}%`
}

export function loadAudit(projectId: string): AuditEntry[] {
  try {
    const raw = localStorage.getItem(`roksal_audit_${projectId}`)
    return raw ? (JSON.parse(raw) as AuditEntry[]) : []
  } catch {
    return []
  }
}

// P3 — pretvorba enot (mm/cm/m) v mm
export function convertToMm(value: number, unit: EnotaTip): number {
  if (!Number.isFinite(value)) return 0
  switch (unit) {
    case 'mm':
      return value
    case 'cm':
      return value * 10
    case 'm':
      return value * 1000
  }
}

// P3 — prikaz v primarni enoti (default mm)
export function formatInPrimaryUnit(mm: number, primary: EnotaTip): string {
  if (!Number.isFinite(mm)) return '—'
  switch (primary) {
    case 'mm':
      return `${Math.round(mm)}mm`
    case 'cm':
      return `${(mm / 10).toFixed(1)}cm`
    case 'm':
      return `${(mm / 1000).toFixed(2)}m`
  }
}

// P3 — izračun stopniščnih dimenzij
export function calculateStairDimensions(
  skupnaVisinaMm: number,
  stStopnic: number,
  globinaStopniceMm: number,
  sirinaStopniceMm?: number
): StairCalc {
  if (
    skupnaVisinaMm <= 0 ||
    stStopnic <= 0 ||
    globinaStopniceMm <= 0 ||
    !Number.isFinite(skupnaVisinaMm) ||
    !Number.isFinite(stStopnic) ||
    !Number.isFinite(globinaStopniceMm)
  ) {
    return {
      visinaPosamezne: 0,
      kotStopinje: 0,
      dolzinaKosa: 0,
      skupnaDolzina: 0,
      priporocilo: 'Vnesite veljavne vhodne podatke',
      priporociloColor: 'text-muted-foreground',
      valid: false,
    }
  }
  const visinaPosamezne = skupnaVisinaMm / stStopnic
  const kotRad = Math.atan(visinaPosamezne / globinaStopniceMm)
  const kotStopinje = (kotRad * 180) / Math.PI
  const dolzinaKosa = Math.sqrt(visinaPosamezne ** 2 + globinaStopniceMm ** 2) * stStopnic
  const rezerva = sirinaStopniceMm ? sirinaStopniceMm * 0.5 : 200 // dodaten rob
  const skupnaDolzina = dolzinaKosa + rezerva
  let priporocilo = 'Standardni kot 30–35°'
  let priporociloColor = 'text-green-700 dark:text-green-300'
  if (kotStopinje > 40) {
    priporocilo = 'Nevarno: >40° (prestrmo!)'
    priporociloColor = 'text-red-600 dark:text-red-400'
  } else if (kotStopinje > 37) {
    priporocilo = 'Prestrmo: >37°'
    priporociloColor = 'text-orange-600 dark:text-orange-400'
  } else if (kotStopinje < 25) {
    priporocilo = 'Ploščato: <25°'
    priporociloColor = 'text-amber-600 dark:text-amber-400'
  }
  return {
    visinaPosamezne,
    kotStopinje,
    dolzinaKosa,
    skupnaDolzina,
    priporocilo,
    priporociloColor,
    valid: true,
  }
}

// P3 — avto-številčenje stebrov v segmentu (S1, S2, ...)
export function getNextStebriNumber(measurements: Measurement[], segmentId?: string): number {
  const stebri = measurements.filter(
    (m) => m.tipMeritve === 'STEBR' && (!segmentId || m.segmentId === segmentId)
  )
  return stebri.length + 1
}

// P3 — nalaganje primarne enote
export function loadPrimaryUnit(): EnotaTip {
  try {
    const raw = localStorage.getItem('roksal_primary_unit')
    if (raw === 'mm' || raw === 'cm' || raw === 'm') return raw
  } catch {
    // ignore
  }
  return 'mm'
}
