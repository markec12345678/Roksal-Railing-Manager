// R319 — dekompozicija measurements-tab (faza 1): izluščeno iz measurements-tab.tsx BREZ spremembe obnašanja (čist premik).
// Skupni tipi, konstante in čisti helper za measurements-tab.tsx IN
// pod-komponente izluščene v tej mapi (faza 1). Vse definicije so
// premaknjene VERBATIM z originalnimi komentarji (R-številke =
// institucionalni spomin); edina sprememba je izrecni `export`.

export type TipMeritve =
  | 'RAZDALJA'
  | 'VISINA'
  | 'KOT'
  | 'NAGIB'
  | 'GLOBINA'
  | 'PREMER'
  | 'SEGMENT'
  // P3 — novi tipi meritev
  | 'KOT_VOGAL'
  | 'KOT_STOPNISCE'
  | 'STEBR'

/** R281 (issue #16 §10) — sync blok kontrakta (session-level); polja
 *  1:1 z shemo /api/sync (V5 — ENA resnica o mejah). */
export interface ArSyncMeta {
  mutationId?: string
  deviceId?: string
  baseRevision?: number
  baseUpdatedAt?: string
  syncRevision?: number
  syncState?: 'synced' | 'pending' | 'conflict' | 'error'
  tombstone?: boolean
}

export interface Measurement {
  id: string
  dolzinaMm: number
  visinaMm: number
  lidarScanUrl?: string | null
  gpsLokacija?: string | null
  createdAt: string
  projectId: string
  // odjemanje iz arMetadata (za prikaz)
  lokacija?: string | null
  steviloStebrov?: number | null
  tipPodlage?: string | null
  kot?: number | null
  opombe?: string | null
  arMetadata?: string | null
  // razčlenjena polja (za prikaz)
  tipMeritve?: TipMeritve
  oznaka?: string
  segmentId?: string
  opomba?: string
  status?: MeasurementStatus
  // R153 (§19) — revizijski kontekst statusa (PATCH /api/measurements/[id])
  statusNote?: string | null
  statusUpdatedAt?: string | null
  kotStopinje?: number | null
  // P3 — enote
  enota?: 'mm' | 'cm' | 'm'
  originalnaVrednost?: number
  // P3 — kotomer
  notranjiKot?: number | null
  zunanjiKot?: number | null
  // P3 — štebricki
  tipStebra?: 'KONCNI' | 'VMESNI' | 'VOGALNI'
  materialStebra?: 'ALU' | 'INOX' | 'WPC' | 'DRUGO'
  visinaStebraMm?: number | null
  pozicijaMm?: number | null
  razmikMm?: number | null
  steberOznaka?: string
  // P3 — WPC palice
  orientacijaPalic?: 'WPC_POKOCNE' | 'WPC_VODORAVNE' | 'WPC_POSEVNE'
  sirinaPalice?: number
  debelinaPalice?: number
  razmikPalic?: number
  kotPosevnih?: number
  stPalic?: number
  // MERITVE-PRO — vir meritve + povezave (foto / AR / laser)
  source?: string
  photoId?: string
  snapshotId?: string
  // R281 (issue #16 §10, V1–V6) — sync metadata (provenance; prikaz
  // samo, kadar je klient poročal sync stanje — iskrena praznina)
  sync?: ArSyncMeta
  // R276 (issue #16 §6) — zgodovina verzij: verzija 1, 2, 3 … znotraj
  // verige korekcij (null = nastalo pred verzioniranjem — iskrena
  // praznina); predhodnikId = prejšnja verzija; korenId = prva vrstica
  // verige; vir = strežniško izpeljan izvor (MANUAL/PHOTO_CV/ARCORE_DEPTH).
  verzija?: number | null
  predhodnikId?: string | null
  korenId?: string | null
  vir?: string | null
}

export interface Segment {
  id: string
  name: string
  type:
    | 'ravni'
    | 'kotni'
    | 'stopniscje'
    | 'lokan'
    // P3 — WPC orientacije
    | 'WPC_POKOCNE'
    | 'WPC_VODORAVNE'
    | 'WPC_POSEVNE'
}

export interface SlopeReading {
  beta: number
  gamma: number
}

export type MeasurementStatus = 'OSNUTEK' | 'POTRJENA' | 'ARHIVIRANA'

export const LOKACIJE_INCLINOMETER = [
  'Talna plošča balkona',
  'Podkonstrukcija',
  'Rob balkona',
  'Stopnišče',
  'Terasa',
  'Drugo',
]

// P3 — konstante za stopniščni čarovnik
export type EnotaTip = 'mm' | 'cm' | 'm'

// P3 — konstante za štebricki
export type TipStebra = 'KONCNI' | 'VMESNI' | 'VOGALNI'
export type MaterialStebra = 'ALU' | 'INOX' | 'WPC' | 'DRUGO'

export const tipStebraLabels: Record<TipStebra, string> = {
  KONCNI: 'Končni',
  VMESNI: 'Vmesni',
  VOGALNI: 'Vogalni',
}

export const tipStebraColors: Record<TipStebra, string> = {
  KONCNI: 'bg-roksal-amber/10 text-roksal-amber border-roksal-amber/30',
  VMESNI: 'bg-roksal-navy/10 text-roksal-ink border-roksal-navy/20 dark:border-roksal-ink/20',
  VOGALNI: 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
}

export const materialStebraLabels: Record<MaterialStebra, string> = {
  ALU: 'ALU',
  INOX: 'INOX',
  WPC: 'WPC',
  DRUGO: 'Drugo',
}

export const materialStebraColors: Record<MaterialStebra, string> = {
  ALU: 'bg-slate-100 dark:bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-800',
  INOX: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
  WPC: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  DRUGO: 'bg-gray-50 dark:bg-gray-950/40 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800',
}

// P3 — izračun števila WPC palic za dano orientacijo
export function calcWpcPalice(
  orientacija: Segment['type'],
  dolzinaMm: number,
  visinaMm: number,
  sirinaPalice: number,
  razmikPalic: number
): number {
  if (sirinaPalice <= 0 || razmikPalic <= 0) return 0
  const korak = sirinaPalice + razmikPalic
  if (
    orientacija === 'WPC_POKOCNE' ||
    orientacija === 'WPC_VODORAVNE'
  ) {
    const relevantnaDim = orientacija === 'WPC_POKOCNE' ? dolzinaMm : visinaMm
    if (relevantnaDim <= 0) return 0
    return Math.max(0, Math.floor((relevantnaDim - sirinaPalice) / korak) + 1)
  }
  if (orientacija === 'WPC_POSEVNE') {
    // mreža: (dolžina / korak) × (višina / korak) — približno
    if (dolzinaMm <= 0 || visinaMm <= 0) return 0
    const nDolzina = Math.max(0, Math.floor((dolzinaMm - sirinaPalice) / korak) + 1)
    const nVisina = Math.max(0, Math.floor((visinaMm - sirinaPalice) / korak) + 1)
    return nDolzina * nVisina
  }
  return 0
}
