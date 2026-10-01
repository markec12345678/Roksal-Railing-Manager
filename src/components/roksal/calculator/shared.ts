// R321 — dekompozicija calculator-tab (faza 1): izluščeno iz calculator-tab.tsx BREZ spremembe obnašanja (čist premik).
// Skupni tipi, konstante in ikonski registri za calculator-tab.tsx IN
// pod-komponente izluščene v tej mapi (faza 1). Vse definicije so
// premaknjene VERBATIM z originalnimi komentarji (R-številke =
// institucionalni spomin); edini spremembi sta izrecni `export`
// in dvig import vrstic na vrh datoteke (struktura, ne vsebina).

import type { CalculatorImportData } from '@/app/page'
import { Calculator, Anchor, Wind, AlignJustify, Triangle, Package, ShieldCheck, Scissors, MapPin, Square } from 'lucide-react'

export type CalcMode = 'railing' | 'anchoring' | 'wind' | 'baluster' | 'angled' | 'material' | 'compliance' | 'cnc' | 'windLocation' | 'glass'
export type ProfileType = 'classic' | 'z-line' | 'vertical'
export type AnchorType = 'hilti-hit' | 'fischer-fis' | 'generic'
export type TerrainCategory = 'I' | 'II' | 'III' | 'IV'
export type RailingType = 'solid' | 'slatted' | 'z-line'

export interface CalcResult {
  slatCount: number
  actualGapMm: number
  totalSlatsLengthMm: number
  totalGapsLengthMm: number
  isCompliant: boolean
  warnings: string[]
}

export interface AnchoringResult {
  resinVolumeMl: number
  totalResinMl: number
  curingTimeMin: number
  cartridgesNeeded: number
  warnings: string[]
}

export interface WindResult {
  windPressureKpa: number
  totalForceKn: number
  forcePerMeterNm: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  recommendations: string[]
}

export const modeTabs: { id: CalcMode; label: string; icon: React.ElementType }[] = [
  { id: 'railing', label: 'Razmiki letev', icon: Calculator },
  { id: 'anchoring', label: 'Kemično sidranje', icon: Anchor },
  { id: 'wind', label: 'Vetrna obremenitev', icon: Wind },
  { id: 'baluster', label: 'Razmak palic', icon: AlignJustify },
  { id: 'angled', label: 'Kotni izračun', icon: Triangle },
  { id: 'material', label: 'Skupni material', icon: Package },
  { id: 'compliance', label: 'Predpisi', icon: ShieldCheck },
  { id: 'cnc', label: 'CNC rez', icon: Scissors },
  { id: 'windLocation', label: 'Veter po lokaciji', icon: MapPin },
  { id: 'glass', label: 'Steklena balustrada', icon: Square },
]

// R341 — dekompozicija calculator-tab FAZA 3: EN VIR oznake načinov (prej
// 3× podvojen inline Record<CalcMode, string> v calculator-tab:
// getCurrentKeyResult, addToHistory in Save-Calculation onClick — vsi trije
// bloki bajtno identični; kanon čist premik VERBATIM, vzorec R339
// auditActionTitles). Poravnava z modeTabs oznakami (isti niz parov, brez
// ikon) — test r341-calc-faza3 dokazuje bijekcijo in dogovor.
export const modeLabels: Record<CalcMode, string> = {
  railing: 'Razmiki letev',
  anchoring: 'Kemično sidranje',
  wind: 'Vetrna obremenitev',
  baluster: 'Razmak palic',
  angled: 'Kotni izračun',
  material: 'Skupni material',
  compliance: 'Predpisi',
  cnc: 'CNC rez',
  windLocation: 'Veter po lokaciji',
  glass: 'Steklena balustrada',
}

export const anchorTypeLabels: Record<AnchorType, string> = {
  'hilti-hit': 'Hilti HIT-RE 500',
  'fischer-fis': 'Fischer FIS V',
  'generic': 'Splošno',
}

// R340 — dekompozicija calculator-tab FAZA 4 (KOLIZIJA #14: delta prenesena
// s R339): profileLabels izluščen VERBATIM iz calculator-tab.tsx (čist
// premik — zbirka oznakov kot anchorTypeLabels zgoraj; edina sprememba je
// izrecni export).
export const profileLabels: Record<ProfileType, string> = {
  classic: 'Classic',
  'z-line': 'Z-line',
  vertical: 'Vertical',
}

// runda S — podlaga z terena (Terenski pregled): oznake + priporočilo pritrditve
export const podlagaLabels: Record<string, string> = {
  beton: 'Beton', estrih: 'Estrih + folija', les: 'Les', kovina: 'Kovina', plocice: 'Ploščice', neznan: 'Neznana',
}
export const podlagaAnchorAdvice: Record<string, string> = {
  beton: 'Ekspanzija ali kemija — oba delujeta. Kemija priporočena blizu roba plošče (< 100 mm).',
  estrih: 'KEMIJA OBVEZNO + tesnilna masa! Ekspanzijski moznik vdre folijo → vlaga uniči ploščo (reklamacija).',
  les: 'Vijaki za les — kemija ni potrebna. Preveri podkonstrukcijo (nosilnost).',
  kovina: 'Bimetal self-drilling vijaki — kemija ni potrebna.',
  plocice: 'Karbid vrti za ploščice + kemija. Zaščiti ploščice s trakom pri vrtanju.',
  neznan: 'Podlaga ni zabeležena — vzameš vzorec obojega (ekspanzija + kemija) in odločiš na terenu.',
}
// runda S — pravi tip sidra v BOM po podlagi (materialni način): "Sidra: kos (...)"
export const podlagaSidraLabel: Record<string, string> = {
  beton: 'ekspanzija ali kemija',
  estrih: 'KEMIJA obvezno!',
  les: 'vijaki za les',
  kovina: 'bimetal self-drilling',
  plocice: 'karbid + kemija',
  neznan: 'kemična (vzorec obojega)',
}
// runda S — RAL imena za naročilo profila (prašna barva)
export const ralNarociloNames: Record<string, string> = {
  '7016': 'Antracit', '9005': 'Črna', '9016': 'Bela', '6005': 'Zelena', '8017': 'Rjava',
}

export const terrainLabels: Record<TerrainCategory, string> = {
  I: 'I — Odprto morje',
  II: 'II — Ravninsko',
  III: 'III — Primestno',
  IV: 'IV — Urbano',
}

export const railingTypeLabels: Record<RailingType, string> = {
  solid: 'Polna ograja',
  slatted: 'Lamelna ograja',
  'z-line': 'Z-line profil',
}

export const riskColors: Record<string, string> = {
  LOW: 'bg-roksal-green/15 text-roksal-green border-roksal-green/30',
  MEDIUM: 'bg-roksal-amber/15 text-roksal-ink border-roksal-amber/30',
  HIGH: 'bg-roksal-red/15 text-roksal-red border-roksal-red/30',
  CRITICAL: 'bg-roksal-red/25 text-roksal-red border-roksal-red/50',
}

export const riskLabels: Record<string, string> = {
  LOW: 'Nizko tveganje',
  MEDIUM: 'Srednje tveganje',
  HIGH: 'Visoko tveganje',
  CRITICAL: 'KRITIČNO',
}

export interface SavedCalculation {
  id: string
  date: string
  mode: CalcMode
  modeLabel: string
  keyResult: string
  inputs: Record<string, string>
}

// ===== P2: Predloge & Zgodovina tipi =====
export type TemplateMode = 'baluster' | 'angled' | 'material' | 'compliance'

export interface CalcTemplate {
  id: string
  naziv: string
  mode: TemplateMode
  inputs: Record<string, string>
  createdAt: string
}

export interface HistoryEntry {
  id: string
  timestamp: string
  mode: CalcMode
  modeLabel: string
  keyResult: string
  inputs: Record<string, string>
  projectName?: string
  // R150: prstni odtis (verzija formule + hash vhodov) — samo railing/
  // anchoring/wind prek inženirske ovojnice; starejši vnoski ga nimajo
  // (iskreno prikazano brez odtisa, ni izmišljenega).
  formulaVersion?: string
  inputHash?: string
}

export const templateModeLabels: Record<TemplateMode, string> = {
  baluster: 'Razmak palic',
  angled: 'Kotni izračun',
  material: 'Skupni material',
  compliance: 'Predpisi',
}

export const historyModeIcon: Record<CalcMode, React.ElementType> = {
  railing: Calculator,
  anchoring: Anchor,
  wind: Wind,
  baluster: AlignJustify,
  angled: Triangle,
  material: Package,
  compliance: ShieldCheck,
  cnc: Scissors,
  windLocation: MapPin,
  glass: Square,
}

export const reserveOptions = [0, 5, 10, 15, 20]
export const ddvOptions = [
  { value: 22, label: '22% (standard)' },
  { value: 9.5, label: '9,5% (gradbene storitve)' },
  { value: 0, label: '0% (izvoz)' },
]
export const akontacijaOptions = [0, 30, 50, 70]


export interface CalculatorTabProps {
  importedFromMeasurement?: CalculatorImportData | null
  onClearImport?: () => void
  onBackToMeasurements?: () => void
}
