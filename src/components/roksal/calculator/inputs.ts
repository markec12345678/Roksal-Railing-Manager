// R346 — dekompozicija calculator-tab FAZA 6: zbiranje in nalaganje vhodov
// (collectCurrentInputs / applyInputs) izluščeno VERBATIM iz calculator-tab.tsx
// v calculator/inputs.ts (vzorec R325 pdf-exports + R345 calculations:
// closure dostop do stanja → eksplicitni args objekti; čist premik BREZ
// spremembe obnašanja — zapisi predlog in zgodovine ter nalaganje nazaj
// uporabljajo iste vrste, iste guard pogoje in iste setterje).
//
// DVE FUNKCIJI:
//  • collectCurrentInputs(mode, v) — čisto zbiranje: iz args objekta stanj
//    zbere Record<string, string> za AKTIVNI način (isti ključi, isti
//    String()/JSON.stringify pretvorbi kot prej v tabu).
//  • applyInputs(targetMode, inputs, s) — čisto nalaganje: iz zabeleženih
//    vhodov nastavi state prek eksplicitnih nastavljalcev (isti vrstni red,
//    isti if-guardi, isti parseFloat/isFinite in JSON.parse guardi).
//
// Determinizem: čista funkcija nad vhodnimi vrednostmi, NIČ časa, NIČ I/O,
// NIČ React notranjosti (nastavljalci so podani od zunaj kot preproste
// funkcije — Dispatch<SetStateAction<T>> je združljiv). Stanja in setterji
// ostanejo LASTNINA komponente (hard rule: jedro nič AI sprememb).

import type {
  ProfileType,
  AnchorType,
  TerrainCategory,
  RailingType,
  CalcMode,
} from './shared'
// R325 — tip CncSegment/GlassType sta EN VIR v calculator/pdf-exports.ts
// (stanje + PDF + dispatch + vhodi delijo isti tip).
import { type CncSegment, type GlassType } from './pdf-exports'
import type { MaterialSegment } from '@/lib/calculator'

/** R346 FAZA 6: vhod steklenega balustrada (EN VIR — isti tip kot useState v tabu). */
export interface GlassVhod {
  spanMm: number
  heightMm: number
  loadKnPerM: number
  glassType: GlassType
}

/**
 * R346 FAZA 6: vsa stanja, ki jih collectCurrentInputs bere (eksplicitni
 * args objekt namesto closure dostopa — vzorec R325/R345).
 */
export interface VhodnaStanja {
  // railing
  profileType: ProfileType
  effectiveTotalLength: string
  slatWidth: string
  maxGap: string
  postCount: string
  // anchoring
  holeCount: string
  holeDepthMm: string
  holeDiameterMm: string
  temperature: string
  anchorType: AnchorType
  // wind
  heightAboveGround: string
  terrainCategory: TerrainCategory
  windSpeedMs: string
  railingAreaM2: string
  railingType: RailingType
  // baluster
  balTotalLength: string
  balWidth: string
  balMaxGap: string
  balPostSpacing: string
  rezervaPctBaluster: number
  // angled
  angHorizontalLength: string
  angRakeAngle: string
  angWidth: string
  angMaxGap: string
  // material
  selectedProfileSifra: string
  segments: MaterialSegment[]
  urnaPostavka: string
  stUr: string
  stMonterjev: string
  transport: string
  rezervaPctMaterial: number
  ddvPct: number
  akontacijaPct: number
  // compliance
  compGap: string
  compHeight: string
  compPostSpacing: string
  compLoadCategory: 'A' | 'B' | 'C'
  compDropHeight: string
  // cnc
  cncStockLength: string
  cncSawBlade: string
  cncSegments: CncSegment[]
  // windLocation
  windLocLat: string
  windLocLon: string
  windLocHeight: string
  windLocTerrain: TerrainCategory
  windLocArea: string
  windLocType: RailingType
  // glass
  glassInput: GlassVhod
}

/**
 * R346 FAZA 6: zbere vhodne podatke trenutnega načina (za predloge in
 * zgodovino). Telo VERBATIM iz calculator-tab collectCurrentInputs —
 * samostojna imena → polja args objekta `v`.
 */
export function collectCurrentInputs(mode: CalcMode, v: VhodnaStanja): Record<string, string> {
  if (mode === 'railing') {
    return { profileType: v.profileType, totalLength: v.effectiveTotalLength, slatWidth: v.slatWidth, maxGap: v.maxGap, postCount: v.postCount }
  } else if (mode === 'anchoring') {
    return { holeCount: v.holeCount, holeDepthMm: v.holeDepthMm, holeDiameterMm: v.holeDiameterMm, temperature: v.temperature, anchorType: v.anchorType }
  } else if (mode === 'wind') {
    return { heightAboveGround: v.heightAboveGround, terrainCategory: v.terrainCategory, windSpeedMs: v.windSpeedMs, railingAreaM2: v.railingAreaM2, railingType: v.railingType }
  } else if (mode === 'baluster') {
    return {
      balTotalLength: v.balTotalLength, balWidth: v.balWidth, balMaxGap: v.balMaxGap, balPostSpacing: v.balPostSpacing,
      rezervaPctBaluster: String(v.rezervaPctBaluster),
    }
  } else if (mode === 'angled') {
    return { angHorizontalLength: v.angHorizontalLength, angRakeAngle: v.angRakeAngle, angWidth: v.angWidth, angMaxGap: v.angMaxGap }
  } else if (mode === 'material') {
    return {
      profileSifra: v.selectedProfileSifra,
      segments: JSON.stringify(v.segments),
      urnaPostavka: v.urnaPostavka, stUr: v.stUr, stMonterjev: v.stMonterjev, transport: v.transport,
      rezervaPctMaterial: String(v.rezervaPctMaterial),
      ddvPct: String(v.ddvPct),
      akontacijaPct: String(v.akontacijaPct),
    }
  } else if (mode === 'compliance') {
    return { compGap: v.compGap, compHeight: v.compHeight, compPostSpacing: v.compPostSpacing, compLoadCategory: v.compLoadCategory, compDropHeight: v.compDropHeight }
  } else if (mode === 'cnc') {
    return {
      cncStockLength: v.cncStockLength, cncSawBlade: v.cncSawBlade,
      cncSegments: JSON.stringify(v.cncSegments),
    }
  } else if (mode === 'windLocation') {
    return {
      windLocLat: v.windLocLat, windLocLon: v.windLocLon, windLocHeight: v.windLocHeight,
      windLocTerrain: v.windLocTerrain, windLocArea: v.windLocArea, windLocType: v.windLocType,
    }
  } else {
    return {
      glassSpan: String(v.glassInput.spanMm),
      glassHeight: String(v.glassInput.heightMm),
      glassLoad: String(v.glassInput.loadKnPerM),
      glassType: v.glassInput.glassType,
    }
  }
}

/**
 * R346 FAZA 6: eksplicitni nastavljalci za applyInputs (49 setterjev —
 * vsak state, ki ga nalaganje predlog/zgodovine lahko spremeni).
 * Tip preproste funkcije (value: T) => void — React Dispatch je
 * združljiv (širša parameterka, kontravarianca).
 */
export interface NastavljalciVhodov {
  // railing
  setProfileType: (value: ProfileType) => void
  setTotalLength: (value: string) => void
  setSlatWidth: (value: string) => void
  setMaxGap: (value: string) => void
  setPostCount: (value: string) => void
  // anchoring
  setHoleCount: (value: string) => void
  setHoleDepthMm: (value: string) => void
  setHoleDiameterMm: (value: string) => void
  setTemperature: (value: string) => void
  setAnchorType: (value: AnchorType) => void
  // wind
  setHeightAboveGround: (value: string) => void
  setTerrainCategory: (value: TerrainCategory) => void
  setWindSpeedMs: (value: string) => void
  setRailingAreaM2: (value: string) => void
  setRailingType: (value: RailingType) => void
  // baluster
  setBalTotalLength: (value: string) => void
  setBalWidth: (value: string) => void
  setBalMaxGap: (value: string) => void
  setBalPostSpacing: (value: string) => void
  setRezervaPctBaluster: (value: number) => void
  // angled
  setAngHorizontalLength: (value: string) => void
  setAngRakeAngle: (value: string) => void
  setAngWidth: (value: string) => void
  setAngMaxGap: (value: string) => void
  // material
  setSelectedProfileSifra: (value: string) => void
  setSegments: (value: MaterialSegment[]) => void
  setUrnaPostavka: (value: string) => void
  setStUr: (value: string) => void
  setStMonterjev: (value: string) => void
  setTransport: (value: string) => void
  setRezervaPctMaterial: (value: number) => void
  setDdvPct: (value: number) => void
  setAkontacijaPct: (value: number) => void
  // compliance
  setCompGap: (value: string) => void
  setCompHeight: (value: string) => void
  setCompPostSpacing: (value: string) => void
  setCompLoadCategory: (value: 'A' | 'B' | 'C') => void
  setCompDropHeight: (value: string) => void
  // cnc
  setCncStockLength: (value: string) => void
  setCncStockPreset: (value: string) => void
  setCncSawBlade: (value: string) => void
  setCncSegments: (value: CncSegment[]) => void
  // windLocation
  setWindLocLat: (value: string) => void
  setWindLocLon: (value: string) => void
  setWindLocHeight: (value: string) => void
  setWindLocTerrain: (value: TerrainCategory) => void
  setWindLocArea: (value: string) => void
  setWindLocType: (value: RailingType) => void
  // glass
  setGlassInput: (value: GlassVhod) => void
}

/**
 * R346 FAZA 6: naloži inpute iz predloge ali zgodovine v ustrezen način.
 * Telo VERBATIM iz calculator-tab applyInputs — klici setterjev prek args
 * objekta `s` (isti vrstni red, isti if-guardi, isti parsanji).
 */
export function applyInputs(
  targetMode: CalcMode,
  inputs: Record<string, string>,
  s: NastavljalciVhodov,
): void {
  const {
    setProfileType, setTotalLength, setSlatWidth, setMaxGap, setPostCount,
    setHoleCount, setHoleDepthMm, setHoleDiameterMm, setTemperature, setAnchorType,
    setHeightAboveGround, setTerrainCategory, setWindSpeedMs, setRailingAreaM2, setRailingType,
    setBalTotalLength, setBalWidth, setBalMaxGap, setBalPostSpacing, setRezervaPctBaluster,
    setAngHorizontalLength, setAngRakeAngle, setAngWidth, setAngMaxGap,
    setSelectedProfileSifra, setSegments, setUrnaPostavka, setStUr, setStMonterjev, setTransport,
    setRezervaPctMaterial, setDdvPct, setAkontacijaPct,
    setCompGap, setCompHeight, setCompPostSpacing, setCompLoadCategory, setCompDropHeight,
    setCncStockLength, setCncStockPreset, setCncSawBlade, setCncSegments,
    setWindLocLat, setWindLocLon, setWindLocHeight, setWindLocTerrain, setWindLocArea, setWindLocType,
    setGlassInput,
  } = s
  if (targetMode === 'railing') {
    if (inputs.profileType) setProfileType(inputs.profileType as ProfileType)
    if (inputs.totalLength) setTotalLength(inputs.totalLength)
    if (inputs.slatWidth) setSlatWidth(inputs.slatWidth)
    if (inputs.maxGap) setMaxGap(inputs.maxGap)
    if (inputs.postCount !== undefined) setPostCount(inputs.postCount)
  } else if (targetMode === 'anchoring') {
    if (inputs.holeCount) setHoleCount(inputs.holeCount)
    if (inputs.holeDepthMm) setHoleDepthMm(inputs.holeDepthMm)
    if (inputs.holeDiameterMm) setHoleDiameterMm(inputs.holeDiameterMm)
    if (inputs.temperature) setTemperature(inputs.temperature)
    if (inputs.anchorType) setAnchorType(inputs.anchorType as AnchorType)
  } else if (targetMode === 'wind') {
    if (inputs.heightAboveGround) setHeightAboveGround(inputs.heightAboveGround)
    if (inputs.terrainCategory) setTerrainCategory(inputs.terrainCategory as TerrainCategory)
    if (inputs.windSpeedMs) setWindSpeedMs(inputs.windSpeedMs)
    if (inputs.railingAreaM2) setRailingAreaM2(inputs.railingAreaM2)
    if (inputs.railingType) setRailingType(inputs.railingType as RailingType)
  } else if (targetMode === 'baluster') {
    if (inputs.balTotalLength) setBalTotalLength(inputs.balTotalLength)
    if (inputs.balWidth) setBalWidth(inputs.balWidth)
    if (inputs.balMaxGap) setBalMaxGap(inputs.balMaxGap)
    if (inputs.balPostSpacing) setBalPostSpacing(inputs.balPostSpacing)
    if (inputs.rezervaPctBaluster) {
      const r = parseFloat(inputs.rezervaPctBaluster)
      if (isFinite(r)) setRezervaPctBaluster(r)
    }
  } else if (targetMode === 'angled') {
    if (inputs.angHorizontalLength) setAngHorizontalLength(inputs.angHorizontalLength)
    if (inputs.angRakeAngle) setAngRakeAngle(inputs.angRakeAngle)
    if (inputs.angWidth) setAngWidth(inputs.angWidth)
    if (inputs.angMaxGap) setAngMaxGap(inputs.angMaxGap)
  } else if (targetMode === 'material') {
    if (inputs.profileSifra) setSelectedProfileSifra(inputs.profileSifra)
    if (inputs.segments) {
      try {
        const parsed = JSON.parse(inputs.segments)
        if (Array.isArray(parsed) && parsed.length > 0) setSegments(parsed)
      } catch { /* ignore */ }
    }
    if (inputs.urnaPostavka) setUrnaPostavka(inputs.urnaPostavka)
    if (inputs.stUr) setStUr(inputs.stUr)
    if (inputs.stMonterjev) setStMonterjev(inputs.stMonterjev)
    if (inputs.transport) setTransport(inputs.transport)
    if (inputs.rezervaPctMaterial) {
      const r = parseFloat(inputs.rezervaPctMaterial)
      if (isFinite(r)) setRezervaPctMaterial(r)
    }
    if (inputs.ddvPct) {
      const d = parseFloat(inputs.ddvPct)
      if (isFinite(d)) setDdvPct(d)
    }
    if (inputs.akontacijaPct) {
      const a = parseFloat(inputs.akontacijaPct)
      if (isFinite(a)) setAkontacijaPct(a)
    }
  } else if (targetMode === 'compliance') {
    if (inputs.compGap) setCompGap(inputs.compGap)
    if (inputs.compHeight) setCompHeight(inputs.compHeight)
    if (inputs.compPostSpacing) setCompPostSpacing(inputs.compPostSpacing)
    if (inputs.compLoadCategory) setCompLoadCategory(inputs.compLoadCategory as 'A' | 'B' | 'C')
    if (inputs.compDropHeight) setCompDropHeight(inputs.compDropHeight)
  } else if (targetMode === 'cnc') {
    if (inputs.cncStockLength) {
      setCncStockLength(inputs.cncStockLength)
      setCncStockPreset(['6000', '4000', '2200'].includes(inputs.cncStockLength) ? inputs.cncStockLength : 'custom')
    }
    if (inputs.cncSawBlade) setCncSawBlade(inputs.cncSawBlade)
    if (inputs.cncSegments) {
      try {
        const parsed = JSON.parse(inputs.cncSegments)
        if (Array.isArray(parsed) && parsed.length > 0) setCncSegments(parsed)
      } catch { /* ignore */ }
    }
  } else if (targetMode === 'windLocation') {
    if (inputs.windLocLat) setWindLocLat(inputs.windLocLat)
    if (inputs.windLocLon) setWindLocLon(inputs.windLocLon)
    if (inputs.windLocHeight) setWindLocHeight(inputs.windLocHeight)
    if (inputs.windLocTerrain) setWindLocTerrain(inputs.windLocTerrain as TerrainCategory)
    if (inputs.windLocArea) setWindLocArea(inputs.windLocArea)
    if (inputs.windLocType) setWindLocType(inputs.windLocType as RailingType)
  } else if (targetMode === 'glass') {
    const span = parseFloat(inputs.glassSpan)
    const height = parseFloat(inputs.glassHeight)
    const load = parseFloat(inputs.glassLoad)
    const gType = inputs.glassType as GlassType
    setGlassInput({
      spanMm: isFinite(span) ? span : 1200,
      heightMm: isFinite(height) ? height : 1100,
      loadKnPerM: isFinite(load) ? load : 1.0,
      glassType: gType || 'laminated',
    })
  }
}
