'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Calculator, AlertTriangle, CheckCircle2, Info, Thermometer, Wind, Anchor, Package, Save, Trash2, Clock, RotateCcw, Ruler, Scissors, ArrowLeft, ArrowDownToLine, Euro, AlignJustify, Triangle, ShieldCheck, Plus, X, FileDown, Hammer, Drill, History, BookmarkPlus, FileSpreadsheet, ChevronDown, ChevronUp, Calendar, Percent, Wallet, Truck, Users, Timer, Layers, MapPin, Square, Navigation, Crosshair, Mountain, Palette } from 'lucide-react'
import {
  calculateHoleTemplate,
  calculateLaborCost,
  calculateDDV,
  calculateAkontacija,
  applyReserve,
  formatEUR,
  formatSI,
  type EqualSpacingResult,
  type AngledSpacingResult,
  type MaterialTotalResult,
  type ComplianceResult,
  type CncCutResult,
  type WindLocationResult,
  type GlassCalcResult,
  type Profil as LibProfil,
  type MaterialSegment,
} from '@/lib/calculator'
import { slDatumKratko, formatSlDecimalno, slMesecevaOkrajsava, slMesecevaOkrajsavaLeto, slMesecevaOkrajsavaUra, toCsv, downloadCsvText } from '@/lib/csv-export'

// R321 — skupni tipi/konstante za calculator-tab + pod-komponente (faza 1).
import {
  modeTabs,
  modeLabels,
  anchorTypeLabels,
  podlagaLabels,
  podlagaAnchorAdvice,
  podlagaSidraLabel,
  ralNarociloNames,
  terrainLabels,
  railingTypeLabels,
  riskColors,
  riskLabels,
  templateModeLabels,
  historyModeIcon,
  reserveOptions,
  ddvOptions,
  akontacijaOptions,
  type CalcMode,
  type ProfileType,
  type AnchorType,
  type TerrainCategory,
  type RailingType,
  type CalcResult,
  type AnchoringResult,
  type WindResult,
  type SavedCalculation,
  type TemplateMode,
  type CalcTemplate,
  type HistoryEntry,
  type CalculatorTabProps,
  // R340 — dekompozicija FAZA 4 (KOLIZIJA #14: prenesena delta s R339):
  // profileLabels (čista zbirka oznak) + getCutList/getPostPositions (čisti
  // izračun, closure → eksplicitni args vzorec R325) izluščeni v ./calculator/.
  profileLabels,
} from './calculator/shared'
import { getCutList, getPostPositions } from './calculator/cut-list'
// R342 — dekompozicija FAZA 4: skladišče zgodovine/predlog EN VIR (ključi,
// zmogljivostne omejitve, fail-closed nalagalnik, čiste CSV vrstice).
import {
  SKLADISCE_PREDLOGE,
  SKLADISCE_ZGODOVINA,
  MAX_ZGODOVINA,
  MAX_PREDLOG,
  naloziIzSkladisca,
  shraniVSkladisce,
  odstraniIzSkladisca,
  ZGODOVINA_CSV_GLAVE,
  zgodovinaCsvVrstice,
  getCurrentKeyResult,
  type RezultatiNacinov,
} from './calculator/history'
import { BalusterSvg } from './calculator/baluster-svg'
import { AngledSvg } from './calculator/angled-svg'
import { SloveniaWindMapSvg } from './calculator/wind-map-svg'
import { GlassLayersSvg } from './calculator/glass-layers-svg'
// R325 — dekompozicija calculator-tab FAZA 2: PDF izvozi (5 funkcij —
// predloga vrtanja / materialni list / razrezni list CNC / vetrno
// poročilo / steklena balustrada) izluščeni v ./calculator/pdf-exports
// (telesa VERBATIM; closure dostop do stanja → eksplicitni args objekti).
import {
  exportBalusterPdf,
  exportMaterialPdf,
  exportCncPdf,
  exportWindLocPdf,
  exportGlassPdf,
  type CncSegment,
  type GlassType,
} from './calculator/pdf-exports'
// R345 — dekompozicija FAZA 5: dispatch logika 10 načinov (parsanje + guard
// + ovonjice R150) izluščena v ./calculator/calculations (args objekti —
// vzorec R325 pdf-exports); komponenta samo zapiše rezultat v state.
import {
  dispatchRailing,
  dispatchAnchoring,
  dispatchWind,
  dispatchBaluster,
  dispatchAngled,
  dispatchMaterial,
  dispatchCompliance,
  dispatchCnc,
  dispatchWindLocation,
  dispatchGlass,
} from './calculator/calculations'
// R346 FAZA 6: zbiranje/nalaganje vhodov = EN VIR calculator/inputs.ts
// (args objekti — vzorec R325/R345: closure dostop do stanja → eksplicitni
// args objekti; komponenta podaja stanja in nastavljalce, modul čisto logiko).
import {
  collectCurrentInputs,
  applyInputs,
  type VhodnaStanja,
  type NastavljalciVhodov,
} from './calculator/inputs'

export function CalculatorTab({ importedFromMeasurement, onClearImport, onBackToMeasurements }: CalculatorTabProps) {
  const [mode, setMode] = useState<CalcMode>('railing')

  // Railing state
  const [profileType, setProfileType] = useState<ProfileType>('classic')
  const [totalLength, setTotalLength] = useState('3.0')
  const [slatWidth, setSlatWidth] = useState('80')
  const [maxGap, setMaxGap] = useState('100')
  const [postCount, setPostCount] = useState('')
  const [railingResult, setRailingResult] = useState<CalcResult | null>(null)

  // Anchoring state
  const [holeCount, setHoleCount] = useState('8')
  const [holeDepthMm, setHoleDepthMm] = useState('120')
  const [holeDiameterMm, setHoleDiameterMm] = useState('14')
  // F-3: betoniranje stebrov (zmrzovalna globina v SI je cca. 80 cm)
  const [concreteHoleDiaMm, setConcreteHoleDiaMm] = useState('300')
  const [concreteHoleDepthMm, setConcreteHoleDepthMm] = useState('800')
  const [temperature, setTemperature] = useState('20')
  const [anchorType, setAnchorType] = useState<AnchorType>('hilti-hit')
  const [anchoringResult, setAnchoringResult] = useState<AnchoringResult | null>(null)

  // Wind state
  const [heightAboveGround, setHeightAboveGround] = useState('10')
  const [terrainCategory, setTerrainCategory] = useState<TerrainCategory>('II')
  const [windSpeedMs, setWindSpeedMs] = useState('25')
  const [railingAreaM2, setRailingAreaM2] = useState('6')
  const [railingType, setRailingType] = useState<RailingType>('slatted')
  const [windResult, setWindResult] = useState<WindResult | null>(null)

  // ===== Baluster (Razmak palic) state =====
  const [balTotalLength, setBalTotalLength] = useState('3.0')
  const [balWidth, setBalWidth] = useState('40')
  const [balMaxGap, setBalMaxGap] = useState('110')
  const [balPostSpacing, setBalPostSpacing] = useState('1500')
  const [balusterResult, setBalusterResult] = useState<EqualSpacingResult | null>(null)

  // ===== Angled (Kotni izračun) state =====
  const [angHorizontalLength, setAngHorizontalLength] = useState('2.5')
  const [angRakeAngle, setAngRakeAngle] = useState('35')
  const [angWidth, setAngWidth] = useState('40')
  const [angMaxGap, setAngMaxGap] = useState('110')
  const [angledResult, setAngledResult] = useState<AngledSpacingResult | null>(null)

  // ===== Material (Skupni material) state =====
  const [segments, setSegments] = useState<MaterialSegment[]>([
    { lengthMm: 3000, heightMm: 1100, type: 'level' },
  ])
  const [profili, setProfili] = useState<LibProfil[]>([])
  const [selectedProfileSifra, setSelectedProfileSifra] = useState<string>('')
  const [materialResult, setMaterialResult] = useState<MaterialTotalResult | null>(null)

  // ===== Compliance (Predpisi) state =====
  const [compGap, setCompGap] = useState('90')
  const [compHeight, setCompHeight] = useState('1100')
  const [compPostSpacing, setCompPostSpacing] = useState('1500')
  const [compLoadCategory, setCompLoadCategory] = useState<'A' | 'B' | 'C'>('A')
  const [compDropHeight, setCompDropHeight] = useState('0')
  const [complianceResult, setComplianceResult] = useState<ComplianceResult | null>(null)

  // ===== CNC REZ state =====
  // R325 — tip CncSegment preseljen v calculator/pdf-exports.ts (stanje + PDF + JSX).
  const [cncStockLength, setCncStockLength] = useState('6000')
  const [cncStockPreset, setCncStockPreset] = useState('6000')
  const [cncSawBlade, setCncSawBlade] = useState('3')
  const [cncSegments, setCncSegments] = useState<CncSegment[]>([
    { lengthMm: '2500', count: '2', label: 'Zgornja letev' },
    { lengthMm: '800', count: '3', label: 'Stranski' },
  ])
  const [cncResult, setCncResult] = useState<CncCutResult | null>(null)

  // ===== VETER PO LOKACIJI state =====
  const [windLocLat, setWindLocLat] = useState('46.2389') // Kranj
  const [windLocLon, setWindLocLon] = useState('14.3556')
  const [windLocHeight, setWindLocHeight] = useState('10')
  const [windLocTerrain, setWindLocTerrain] = useState<TerrainCategory>('II')
  const [windLocArea, setWindLocArea] = useState('6')
  const [windLocType, setWindLocType] = useState<RailingType>('slatted')
  const [windLocResult, setWindLocResult] = useState<WindLocationResult | null>(null)
  const [windLocLoading, setWindLocLoading] = useState(false)

  // ===== STEKLENA BALUSTRADA state =====
  // R325 — tip GlassType preseljen v calculator/pdf-exports.ts (stanje + PDF + JSX).
  const [glassInput, setGlassInput] = useState<{
    spanMm: number
    heightMm: number
    loadKnPerM: number
    glassType: GlassType
  }>({
    spanMm: 1200,
    heightMm: 1100,
    loadKnPerM: 1.0,
    glassType: 'laminated',
  })
  const [glassResult, setGlassResult] = useState<GlassCalcResult | null>(null)

  // Compute imported length for display
  const importedLength = useMemo(() => {
    if (!importedFromMeasurement) return null
    return (importedFromMeasurement.dolzinaMm / 1000).toFixed(1)
  }, [importedFromMeasurement])

  // Effective total length uses import when available, otherwise manual input
  const effectiveTotalLength = importedLength ?? totalLength

  // Clear import ONLY when the user manually changes totalLength (runda S fix:
  // prej se je uvoz počistil TUDI ob mountu, ker je default '3.0' ≠ uvoženi
  // '8.6' — AR in terenski uvoz sta izginila v prvem renderju). Ref si zapomni
  // zadnji uvoz; brisanje se sproži samo, ko uporabnik ročno spremeni dolžino.
  const prevImportedRef = useRef<string | null>(null)
  useEffect(() => {
    if (importedLength !== prevImportedRef.current) {
      prevImportedRef.current = importedLength
      return // nov uvoz (ali prvi mount) — ne počisti
    }
    if (importedLength && totalLength && totalLength !== importedLength) {
      onClearImport?.()
    }
  }, [totalLength, importedLength, onClearImport])

  // Saved calculations
  const [savedCalculations, setSavedCalculations] = useState<SavedCalculation[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('roksal-saved-calculations')
        if (stored) return JSON.parse(stored)
      } catch {
        // ignore
      }
    }
    return []
  })

  // ===== P2: Predloge (templates) =====
  const [templates, setTemplates] = useState<CalcTemplate[]>(() =>
    naloziIzSkladisca<CalcTemplate[]>(SKLADISCE_PREDLOGE, []),
  )
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)

  // ===== P2: Zgodovina izračunov =====
  const [history, setHistory] = useState<HistoryEntry[]>(() =>
    naloziIzSkladisca<HistoryEntry[]>(SKLADISCE_ZGODOVINA, []),
  )
  const [historyOpen, setHistoryOpen] = useState(false)
  const [projectName, setProjectName] = useState('')

  // ===== P2: Strošek dela (material mode) =====
  const [urnaPostavka, setUrnaPostavka] = useState('35')
  const [stUr, setStUr] = useState('8')
  const [stMonterjev, setStMonterjev] = useState('2')
  const [transport, setTransport] = useState('50')

  // ===== P2: Rezerva materiala (baluster + material) =====
  const [rezervaPctBaluster, setRezervaPctBaluster] = useState(10)
  const [rezervaPctMaterial, setRezervaPctMaterial] = useState(10)

  // ===== P2: DDV =====
  const [ddvPct, setDdvPct] = useState(22)

  // ===== P2: Akontacija (material) =====
  const [akontacijaPct, setAkontacijaPct] = useState(0)

  // ===== P2: calcNonce — vsakič ko uporabnik klikne "Izračunaj" se poveča,
  // effect ga opazuje in zapiše v zgodovino (po tem, ko so se rezultati posodobili). =====
  const [calcNonce, setCalcNonce] = useState(0)
  const skipHistoryRef = useRef(false)

  // ===== R150 (§32–34): inženirska validacija — fail-closed napake (vnos
  // izven območja umerjenosti → eksplicitne napake, NIČ rezultata) in
  // prstni odtis (verzija formule + hash vhodov) za reproducibilnost. =====
  const [engineeringErrors, setEngineeringErrors] = useState<string[]>([])
  const [lastFingerprint, setLastFingerprint] = useState<{ formulaVersion: string; inputHash: string } | null>(null)

  // R340 — dekompozicija FAZA 4: profileLabels izluščen VERBATIM v
  // calculator/shared.ts (čist premik zbirke oznak).

  // R345 FAZA 5: EN VIR veriga dispatchev — prej 2× podvojen if/else blok
  // (handleCalculate + auto-calc useEffect); isti vrstni red, isti klici.
  function izvediIzracunZaAktivniNacin() {
    if (mode === 'railing') {
      calculateRailingClientSide()
    } else if (mode === 'anchoring') {
      calculateAnchoringClientSide()
    } else if (mode === 'wind') {
      calculateWindClientSide()
    } else if (mode === 'baluster') {
      calculateBalusterClientSide()
    } else if (mode === 'angled') {
      calculateAngledClientSide()
    } else if (mode === 'material') {
      calculateMaterialClientSide()
    } else if (mode === 'compliance') {
      calculateComplianceClientSide()
    } else if (mode === 'cnc') {
      calculateCncClientSide()
    } else if (mode === 'windLocation') {
      calculateWindLocClientSide()
    } else if (mode === 'glass') {
      calculateGlassClientSide()
    }
  }

  function handleCalculate() {
    // R150: vsak izračun počisti prejšnje inženirske napake in odtis.
    setEngineeringErrors([])
    setLastFingerprint(null)
    izvediIzracunZaAktivniNacin()
    // P2: Povečaj nonce — effect ga opazuje in zapiše v zgodovino,
    // ko se bodo rezultati posodobili (re-render).
    setCalcNonce((n) => n + 1)
  }

  // P2: Effect za pisanje v zgodovino je definiran za addToHistory (glej spodaj).

  // R346 FAZA 6: args objekta za calculator/inputs.ts — stanja in nastavljalci
  // so LASTNINA komponente, modul je čista funkcija nad njima (vzorec
  // R325 pdf-exports / R345 calculations). Klicni mesti: saveTemplate +
  // zgodovina (collect) ter loadTemplate + loadSaved (apply).
  const vhodnaStanja = (): VhodnaStanja => ({
    profileType, effectiveTotalLength, slatWidth, maxGap, postCount,
    holeCount, holeDepthMm, holeDiameterMm, temperature, anchorType,
    heightAboveGround, terrainCategory, windSpeedMs, railingAreaM2, railingType,
    balTotalLength, balWidth, balMaxGap, balPostSpacing, rezervaPctBaluster,
    angHorizontalLength, angRakeAngle, angWidth, angMaxGap,
    selectedProfileSifra, segments, urnaPostavka, stUr, stMonterjev, transport,
    rezervaPctMaterial, ddvPct, akontacijaPct,
    compGap, compHeight, compPostSpacing, compLoadCategory, compDropHeight,
    cncStockLength, cncSawBlade, cncSegments,
    windLocLat, windLocLon, windLocHeight, windLocTerrain, windLocArea, windLocType,
    glassInput,
  })

  // R347 FAZA 7: ključni rezultat = EN VIR calculator/history.ts (prej
  // function v tabu + stale inline kopija v "Shrani izračun" gumbu).
  const rezultatiNacinov = (): RezultatiNacinov => ({
    railingResult, anchoringResult, windResult, balusterResult, angledResult, materialResult,
    complianceResult, cncResult, windLocResult, glassResult,
    rezervaPctBaluster, rezervaPctMaterial, glassInput,
  })

  const nastavljalci = (): NastavljalciVhodov => ({
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
  })

  /** Shrani trenutne inpute kot predlogo (samo za 4 podprte načine). */
  function saveTemplate() {
    const supported: TemplateMode[] = ['baluster', 'angled', 'material', 'compliance']
    if (!supported.includes(mode as TemplateMode)) {
      toast.error('Predloge so na voljo samo za: Razmak palic, Kotni, Skupni material, Predpisi')
      return
    }
    const naziv = window.prompt('Ime predloge:', `Predloga ${templateModeLabels[mode as TemplateMode]} ${slDatumKratko(new Date())}`)
    if (!naziv || !naziv.trim()) return
    const tpl: CalcTemplate = {
      id: `tpl_${Date.now()}`,
      naziv: naziv.trim(),
      mode: mode as TemplateMode,
      inputs: collectCurrentInputs(mode, vhodnaStanja()),
      createdAt: new Date().toISOString(),
    }
    const updated = [tpl, ...templates].slice(0, MAX_PREDLOG)
    setTemplates(updated)
    shraniVSkladisce(SKLADISCE_PREDLOGE, updated)
    setActiveTemplateId(tpl.id)
    toast.success(`Predloga "${tpl.naziv}" shranjena`)
  }

  /** Naloži predlogo v ustrezni način. */
  function loadTemplate(tpl: CalcTemplate) {
    setMode(tpl.mode)
    applyInputs(tpl.mode, tpl.inputs, nastavljalci())
    setActiveTemplateId(tpl.id)
    toast.info(`Predloga "${tpl.naziv}" naložena`)
  }

  /** Izbriše predlogo. */
  function deleteTemplate(id: string) {
    const updated = templates.filter((t) => t.id !== id)
    setTemplates(updated)
    if (activeTemplateId === id) setActiveTemplateId(null)
    shraniVSkladisce(SKLADISCE_PREDLOGE, updated)
    toast.success('Predloga izbrisana')
  }

  /** Doda trenutni izračun v zgodovino (max MAX_ZGODOVINA). */
  function addToHistory() {
    const hasResult =
      (mode === 'railing' && railingResult) ||
      (mode === 'anchoring' && anchoringResult) ||
      (mode === 'wind' && windResult) ||
      (mode === 'baluster' && balusterResult) ||
      (mode === 'angled' && angledResult) ||
      (mode === 'material' && materialResult) ||
      (mode === 'compliance' && complianceResult) ||
      (mode === 'cnc' && cncResult) ||
      (mode === 'windLocation' && windLocResult) ||
      (mode === 'glass' && glassResult)
    if (!hasResult) return

    const entry: HistoryEntry = {
      id: `hist_${Date.now()}`,
      timestamp: new Date().toISOString(),
      mode,
      modeLabel: modeLabels[mode],
      keyResult: getCurrentKeyResult(mode, rezultatiNacinov()),
      inputs: collectCurrentInputs(mode, vhodnaStanja()),
      projectName: projectName.trim() || undefined,
      // R150: prstni odtis samo če obstaja (railing/anchoring/wind prek
      // ovojnice); brez izmišljanja za ostale načine.
      ...(lastFingerprint ?? {}),
    }
    const updated = [entry, ...history].slice(0, MAX_ZGODOVINA)
    setHistory(updated)
    shraniVSkladisce(SKLADISCE_ZGODOVINA, updated)
  }

  // P2: Effect — ko se calcNonce spremeni (uporabnik je kliknil "Izračunaj"),
  // zapiše trenutni izračun v zgodovino. Re-render je takrat že opravljen,
  // zato so rezultati na voljo.
  useEffect(() => {
    if (calcNonce === 0) return
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false
      return
    }
    addToHistory()
  }, [calcNonce])

  /** Počisti zgodovino. */
  function clearHistory() {
    setHistory([])
    odstraniIzSkladisca(SKLADISCE_ZGODOVINA)
    toast.success('Zgodovina počiščena')
  }

  /** Izvozi zgodovino v CSV. */
  function exportHistoryCsv() {
    if (history.length === 0) {
      toast.error('Zgodovina je prazna')
      return
    }
    // R341 65. člen + R342 FAZA 4: podatki (glave + vrstice) EN VIR iz
    // calculator/history.ts; mehanika ostaja kanon toCsv (R136) +
    // downloadCsvText (R296). Vsebina NESPREMENJENA (VERBATIM vrstice).
    downloadCsvText(
      `roksal-zgodovina-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv([...ZGODOVINA_CSV_GLAVE], zgodovinaCsvVrstice(history)),
    )
    toast.success('Zgodovina izvožena v CSV')
  }

  /** Naloži vnos iz zgodovine in ponovno izračuna. */
  function loadFromHistory(entry: HistoryEntry) {
    setMode(entry.mode)
    applyInputs(entry.mode, entry.inputs, nastavljalci())
    if (entry.projectName) setProjectName(entry.projectName)
    // Pri loadu iz zgodovine NE želimo ponovno zapisati v zgodovino.
    skipHistoryRef.current = true
    toast.info(`Naloženo iz zgodovine: ${entry.modeLabel}`)
    // Sproži ponovni izračun
    setTimeout(() => handleCalculate(), 50)
  }

  function calculateRailingClientSide() {
    // R345 FAZA 5: parsanje + ovonjica R150 v calculator/calculations.ts (args objekti).
    const envelope = dispatchRailing({ totalLength: effectiveTotalLength, slatWidth, maxGap, profileType })
    if (!envelope.ok) {
      setEngineeringErrors(envelope.errors)
      return
    }
    setLastFingerprint({ formulaVersion: envelope.formulaVersion, inputHash: envelope.inputHash })
    setRailingResult(envelope.result)
  }

  function calculateAnchoringClientSide() {
    // R345 FAZA 5: parsanje + ovonjica R150 v calculator/calculations.ts (args objekti).
    const envelope = dispatchAnchoring({ holeCount, holeDepthMm, holeDiameterMm, temperature, anchorType })
    if (!envelope.ok) {
      setEngineeringErrors(envelope.errors)
      return
    }
    setLastFingerprint({ formulaVersion: envelope.formulaVersion, inputHash: envelope.inputHash })
    setAnchoringResult(envelope.result)
  }

  function calculateWindClientSide() {
    // R345 FAZA 5: parsanje + ovonjica R150 v calculator/calculations.ts (args objekti).
    const envelope = dispatchWind({ heightAboveGround, terrainCategory, windSpeedMs, railingAreaM2, railingType })
    if (!envelope.ok) {
      setEngineeringErrors(envelope.errors)
      return
    }
    setLastFingerprint({ formulaVersion: envelope.formulaVersion, inputHash: envelope.inputHash })
    setWindResult(envelope.result)
  }

  // ===== Baluster calculation =====
  function calculateBalusterClientSide() {
    // R345 FAZA 5: parsanje + guard v calculator/calculations.ts (args objekti).
    setBalusterResult(dispatchBaluster({ balTotalLength, balWidth, balMaxGap }))
  }

  // ===== Angled calculation =====
  function calculateAngledClientSide() {
    // R345 FAZA 5: parsanje + guard v calculator/calculations.ts (args objekti).
    setAngledResult(dispatchAngled({ angHorizontalLength, angRakeAngle, angWidth, angMaxGap }))
  }

  // ===== Material calculation =====
  function calculateMaterialClientSide() {
    // R345 FAZA 5: guard + izračun v calculator/calculations.ts (args objekti).
    setMaterialResult(dispatchMaterial({ segments, profileSifra: selectedProfileSifra, profili }))
  }

  // ===== Compliance calculation =====
  function calculateComplianceClientSide() {
    // R345 FAZA 5: parsanje + guard v calculator/calculations.ts (args objekti).
    setComplianceResult(dispatchCompliance({ compGap, compHeight, compPostSpacing, compLoadCategory, compDropHeight }))
  }

  // ===== CNC cutting calculation =====
  function calculateCncClientSide() {
    // R345 FAZA 5: parsanje + guard + preslikava segmentov v calculator/calculations.ts (args objekti).
    setCncResult(dispatchCnc({ cncStockLength, cncSawBlade, cncSegments }))
  }

  // ===== Wind by location calculation =====
  function calculateWindLocClientSide() {
    // R345 FAZA 5: parsanje + guard v calculator/calculations.ts (args objekti).
    setWindLocResult(dispatchWindLocation({ windLocLat, windLocLon, windLocHeight, windLocTerrain, windLocArea, windLocType }))
  }

  // ===== Glass balustrade calculation =====
  function calculateGlassClientSide() {
    // R345 FAZA 5: guard + izračun v calculator/calculations.ts (args objekti).
    setGlassResult(dispatchGlass(glassInput))
  }

  // Auto-calculate on input change
  useEffect(() => {
    izvediIzracunZaAktivniNacin()
  }, [mode, profileType, effectiveTotalLength, slatWidth, maxGap, postCount, holeCount, holeDepthMm, holeDiameterMm, temperature, anchorType, heightAboveGround, terrainCategory, windSpeedMs, railingAreaM2, railingType, balTotalLength, balWidth, balMaxGap, balPostSpacing, angHorizontalLength, angRakeAngle, angWidth, angMaxGap, segments, selectedProfileSifra, compGap, compHeight, compPostSpacing, compLoadCategory, compDropHeight, cncStockLength, cncSawBlade, cncSegments, windLocLat, windLocLon, windLocHeight, windLocTerrain, windLocArea, windLocType, glassInput])

  // Fetch profili when material mode is selected
  useEffect(() => {
    if (mode === 'material' && profili.length === 0) {
      fetch('/api/profili')
        .then((r) => r.json())
        .then((data: LibProfil[]) => {
          if (Array.isArray(data)) {
            setProfili(data)
            if (data.length > 0 && !selectedProfileSifra) {
              setSelectedProfileSifra(data[0].sifra)
            }
          }
        })
        .catch(() => {
          toast.error('Napaka pri nalaganju profilov')
        })
    }
  }, [mode, profili.length, selectedProfileSifra])

  // Generate cut list positions — R340 dekompozicija FAZA 4: getCutList +
  // getPostPositions izluščena v calculator/cut-list.ts (telesa VERBATIM,
  // closure dostop do stanja → eksplicitni args — vzorec R325 pdf-exports).

  function renderRailingVisual() {
    if (!railingResult) return null
    const L = parseFloat(effectiveTotalLength) * 1000
    const W = parseFloat(slatWidth)
    const gap = railingResult.actualGapMm
    const totalSlatWidth = railingResult.totalSlatsLengthMm
    const totalGapWidth = railingResult.totalGapsLengthMm
    const total = totalSlatWidth + totalGapWidth
    const slatPct = (totalSlatWidth / total) * 100
    const gapPct = (totalGapWidth / total) * 100
    const postPositions = getPostPositions({ railingResult, effectiveTotalLength, postCount })
    const displayCount = Math.min(railingResult.slatCount, 20)

    return (
      <div className="space-y-3">
        {/* Main visual with dimension arrows */}
        <div className="relative">
          {/* Top dimension line with total length */}
          <div className="flex items-center justify-between mb-1 px-0.5">
            <span className="text-[9px] font-mono text-roksal-ink font-semibold">0mm</span>
            <div className="flex-1 mx-1">
              <div className="border-t border-dashed border-roksal-navy/40 dark:border-roksal-ink/40 relative">
                <span className="absolute left-1/2 -top-2.5 -translate-x-1/2 text-[9px] font-mono font-bold text-roksal-ink bg-background px-1">
                  {L}mm = {(L / 1000).toFixed(2)}m
                </span>
              </div>
            </div>
            <span className="text-[9px] font-mono text-roksal-ink font-semibold">{L}mm</span>
          </div>

          {/* Railing cross-section */}
          <div className="relative flex items-end overflow-hidden rounded-lg border border-roksal-navy/20 dark:border-roksal-ink/20 bg-gradient-to-b from-roksal-navy/3 to-roksal-navy/8 p-3 pt-4 pb-2" style={{ minHeight: '52px' }}>
            {/* Posts (background layer) */}
            {postPositions.length > 0 && (
              <div className="absolute inset-0 flex items-end pointer-events-none">
                {postPositions.map((pos, i) => {
                  const pct = (pos / L) * 100
                  return (
                    <div
                      key={i}
                      className="absolute bottom-0 w-[6px] rounded-full bg-roksal-amber/60"
                      style={{ left: `${pct}%`, height: '90%' }}
                    />
                  )
                })}
              </div>
            )}
            {/* Slats and gaps */}
            <div className="flex-1 flex h-10 items-center w-full relative z-10">
              <div className="h-full bg-roksal-amber/15 border border-dashed border-roksal-amber/30 rounded" style={{ width: `${(gap / L) * 100}%`, minWidth: gap > 0 ? '2px' : '0' }} />
              {Array.from({ length: displayCount }).map((_, i) => (
                <div key={i} className="flex h-full">
                  <div
                    className={`h-[85%] rounded-[2px] ${profileType === 'z-line' ? 'bg-roksal-navy/80 border-r border-roksal-navy/20 dark:bg-roksal-ink/85 dark:border-roksal-ink/20' : 'bg-roksal-navy dark:bg-roksal-ink'}`}
                    style={{ width: `${(W / L) * 100}%`, minWidth: '2px' }}
                  />
                  {i < displayCount - 1 && (
                    <div
                      className="h-full bg-roksal-amber/15 border border-dashed border-roksal-amber/30 rounded"
                      style={{ width: `${(gap / L) * 100}%`, minWidth: '1px' }}
                    />
                  )}
                </div>
              ))}
              {railingResult.slatCount > 20 && (
                <div className="flex items-center justify-center bg-gradient-to-l from-white/80 to-transparent px-2 h-full">
                  <span className="text-2xs font-medium text-muted-foreground">
                    +{railingResult.slatCount - 20} letvev
                  </span>
                </div>
              )}
              <div className="h-full bg-roksal-amber/15 border border-dashed border-roksal-amber/30 rounded" style={{ width: `${(gap / L) * 100}%`, minWidth: gap > 0 ? '2px' : '0' }} />
            </div>
          </div>

          {/* Bottom dimension: individual gap annotation */}
          <div className="flex items-center justify-center mt-1.5">
            <div className="flex items-center gap-0.5">
              <Ruler aria-hidden="true" className="h-3 w-3 text-roksal-amber" />
              <span className="text-[9px] font-mono font-medium text-roksal-amber">
                Razmik: {gap.toFixed(1)}mm med letvami
              </span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 text-2xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-[2px] bg-roksal-navy" />
            Letva ({W}mm)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-[2px] bg-roksal-amber/15 border border-dashed border-roksal-amber/30" />
            Razmik ({gap.toFixed(1)}mm)
          </span>
          {postPositions.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-[6px] rounded-full bg-roksal-amber/60" />
              Steber
            </span>
          )}
        </div>
      </div>
    )
  }

  function renderCutList() {
    if (!railingResult) return null
    const cutList = getCutList({ railingResult, effectiveTotalLength, slatWidth })
    const W = parseFloat(slatWidth)
    const gap = railingResult.actualGapMm
    const L = parseFloat(effectiveTotalLength) * 1000

    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
            <Scissors aria-hidden="true" className="h-4 w-4" />
            Seznam rezov — pozicije letvev
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="overflow-x-auto scrollbar-thin">
            {/* Header */}
            <div className="grid grid-cols-12 gap-0 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider pb-1.5 border-b border-border/50 mb-1">
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-2 text-center">Tip</div>
              <div className="col-span-3 text-center">Začetek</div>
              <div className="col-span-3 text-center">Širina</div>
              <div className="col-span-3 text-center">Konec</div>
            </div>
            {/* First gap row */}
            <div className="grid grid-cols-12 gap-0 text-2xs font-mono py-1 border-b border-border/20 bg-roksal-amber/5">
              <div className="col-span-1 text-center text-muted-foreground">—</div>
              <div className="col-span-2 text-center"><Badge variant="outline" className="text-3xs h-4 px-1 bg-roksal-amber/10 border-roksal-amber/30 text-roksal-amber">razmik</Badge></div>
              <div className="col-span-3 text-center">0</div>
              <div className="col-span-3 text-center font-medium">{gap.toFixed(1)}</div>
              <div className="col-span-3 text-center">{gap.toFixed(1)}</div>
            </div>
            {/* Slat + gap rows */}
            {cutList.map((item, i) => {
              const endPos = item.startPosMm + item.widthMm
              return (
                <div key={i}>
                  {/* Slat row */}
                  <div className="grid grid-cols-12 gap-0 text-2xs font-mono py-1 border-b border-border/20">
                    <div className="col-span-1 text-center font-semibold text-roksal-ink">{item.num}</div>
                    <div className="col-span-2 text-center"><Badge variant="outline" className="text-3xs h-4 px-1 bg-roksal-navy/10 border-roksal-navy/30 dark:border-roksal-ink/30 text-roksal-ink">letva</Badge></div>
                    <div className="col-span-3 text-center text-roksal-ink font-medium">{item.startPosMm}</div>
                    <div className="col-span-3 text-center font-medium">{item.widthMm}</div>
                    <div className="col-span-3 text-center text-roksal-ink font-medium">{endPos}</div>
                  </div>
                  {/* Gap row after slat (not after last) */}
                  {i < cutList.length - 1 && (
                    <div className="grid grid-cols-12 gap-0 text-2xs font-mono py-1 border-b border-border/20 bg-roksal-amber/5">
                      <div className="col-span-1 text-center text-muted-foreground">—</div>
                      <div className="col-span-2 text-center"><Badge variant="outline" className="text-3xs h-4 px-1 bg-roksal-amber/10 border-roksal-amber/30 text-roksal-amber">razmik</Badge></div>
                      <div className="col-span-3 text-center">{endPos}</div>
                      <div className="col-span-3 text-center font-medium">{gap.toFixed(1)}</div>
                      <div className="col-span-3 text-center">{(endPos + gap).toFixed(1)}</div>
                    </div>
                  )}
                </div>
              )
            })}
            {/* Last gap row */}
            <div className="grid grid-cols-12 gap-0 text-2xs font-mono py-1 bg-roksal-amber/5 rounded-b-lg">
              <div className="col-span-1 text-center text-muted-foreground">—</div>
              <div className="col-span-2 text-center"><Badge variant="outline" className="text-3xs h-4 px-1 bg-roksal-amber/10 border-roksal-amber/30 text-roksal-amber">razmik</Badge></div>
              <div className="col-span-3 text-center">{cutList.length > 0 ? cutList[cutList.length - 1].startPosMm + W : gap.toFixed(1)}</div>
              <div className="col-span-3 text-center font-medium">{gap.toFixed(1)}</div>
              <div className="col-span-3 text-center font-semibold">{L}</div>
            </div>
          </div>
          {/* Summary */}
          <div className="mt-2 flex items-center justify-between text-2xs text-muted-foreground border-t border-border/30 pt-2">
            <span>Skupaj {railingResult.slatCount} letvev × {W}mm</span>
            <span className="font-mono font-medium">Skupna dolžina: {(railingResult.totalSlatsLengthMm / 1000).toFixed(2)}m</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4 px-4 pb-4 pt-2 md:space-y-5 md:px-6 md:pb-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-roksal-ink">Kalkulator ograj</h2>
          <p className="text-sm text-muted-foreground">
            Izračuni za ograje, sidranje in vetrno obremenitev
          </p>
        </div>
        {importedFromMeasurement && (
          <button
            type="button"
            onClick={onBackToMeasurements}
            className="flex items-center gap-1.5 rounded-lg border border-roksal-amber/30 bg-roksal-amber/10 px-2.5 py-1.5 text-[11px] font-medium text-roksal-ink hover:bg-roksal-amber/20 active:scale-[0.96] transition-all duration-150 press-scale shrink-0"
          >
            <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
            <span>Nazaj na meritve</span>
          </button>
        )}
      </div>

      {/* Import from measurement indicator */}
      {importedFromMeasurement && (
        <div className="flex items-center gap-2.5 rounded-xl border border-roksal-amber/30 bg-roksal-amber/5 px-3.5 py-2.5 animate-fade-in-up">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-roksal-amber/15">
            <ArrowDownToLine aria-hidden="true" className="h-4 w-4 text-roksal-amber" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-roksal-ink">Uvoženo iz meritev</span>
              <span className="rounded-full bg-roksal-amber/20 px-1.5 py-0.5 text-[9px] font-bold text-roksal-amber">MERITEV</span>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {importedFromMeasurement.locationName} — {importedFromMeasurement.dolzinaMm}mm × {importedFromMeasurement.visinaMm}mm
            </p>
            {(importedFromMeasurement.podlaga || importedFromMeasurement.ralCode) && (
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {importedFromMeasurement.podlaga && (
                  <span className="rounded-full bg-roksal-navy/10 px-2 py-0.5 text-[9px] font-bold text-roksal-ink">
                    Podlaga: {podlagaLabels[importedFromMeasurement.podlaga] ?? importedFromMeasurement.podlaga}
                  </span>
                )}
                {importedFromMeasurement.ralCode && (
                  <span className="rounded-full bg-roksal-amber/20 px-2 py-0.5 text-[9px] font-bold text-roksal-amber">
                    RAL {importedFromMeasurement.ralCode}
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClearImport}
            className="p-1 rounded-md hover:bg-secondary/60 transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
            title="Počisti uvoz"
            aria-label="Počisti uvoz meritve"
          >
            <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* P2: Prihranjene predloge (Saved templates) */}
      {templates.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                <Layers aria-hidden="true" className="h-4 w-4 text-roksal-amber" />
                Prihranjene predloge
                <Badge variant="secondary" className="text-2xs h-5 px-1.5">{templates.length}</Badge>
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-2xs text-roksal-red hover:text-roksal-red hover:bg-roksal-red/10"
                onClick={() => {
                  setTemplates([])
                  setActiveTemplateId(null)
                  odstraniIzSkladisca(SKLADISCE_PREDLOGE)
                  toast.success('Vse predloge počiščene')
                }}
                aria-label="Počisti vse predloge"
                title="Pobriši vse shranjene predloge"
              >
                <Trash2 aria-hidden="true" className="mr-1 h-3 w-3" />
                Počisti vse
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto scrollbar-thin">
              {templates.map((tpl) => {
                const isActive = tpl.id === activeTemplateId
                return (
                  <div
                    key={tpl.id}
                    className={`rounded-lg border p-2.5 transition-all ${
                      isActive
                        ? 'border-roksal-amber bg-roksal-amber/10 ring-1 ring-roksal-amber/30'
                        : 'border-border/60 hover:border-roksal-navy/30 dark:hover:border-roksal-ink/30 hover:bg-secondary/30'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => loadTemplate(tpl)}
                      aria-label={`Naloži predlogo: ${tpl.naziv} (${templateModeLabels[tpl.mode]})`}
                      title={`${tpl.naziv} — ${templateModeLabels[tpl.mode]}`}
                      className="flex w-full items-start gap-2 text-left"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-roksal-navy/10">
                        <Layers aria-hidden="true" className="h-3.5 w-3.5 text-roksal-ink" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-roksal-ink truncate">{tpl.naziv}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge
                            variant="outline"
                            title="Predloga shranjenega izračuna — nalaganje zapolni vsa vnosna polja načina"
                            className="text-[9px] h-4 px-1.5 bg-roksal-navy/5 border-roksal-navy/20 dark:border-roksal-ink/20 text-roksal-ink"
                          >
                            {templateModeLabels[tpl.mode]}
                          </Badge>
                          <span className="text-[9px] text-muted-foreground">
                            {slMesecevaOkrajsavaLeto(new Date(tpl.createdAt))}
                          </span>
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center justify-end mt-1.5 pt-1.5 border-t border-border/30">
                      <button
                        type="button"
                        onClick={() => deleteTemplate(tpl.id)}
                        className="flex items-center gap-1 text-[9px] text-roksal-red hover:text-roksal-red/80 transition-colors"
                        aria-label="Izbriši predlogo"
                        title="Izbriši predlogo"
                      >
                        <Trash2 aria-hidden="true" className="h-3 w-3" />
                        Izbriši
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            {activeTemplateId && (
              <p className="mt-2 text-2xs text-roksal-amber flex items-center gap-1">
                <CheckCircle2 aria-hidden="true" className="h-3 w-3" />
                Aktivna predloga je naložena v trenutnem načinu.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* P2: Naziv projekta (za zgodovino) */}
      <Card>
        <CardContent className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="projectName" className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
              Naziv projekta:
            </Label>
            <Input
              id="projectName"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="npr. Stanovanjska hiša Kranj — balkon"
              className="h-8 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* Calculator Mode Selector */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {modeTabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setMode(tab.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === tab.id
                  ? 'bg-roksal-navy text-white'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* RAILING CALCULATOR */}
      {mode === 'railing' && (
        <>
          {/* Profile Type Selector */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-roksal-ink">
                Tip profila
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Select
                value={profileType}
                onValueChange={(v) => setProfileType(v as ProfileType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic">Classic — Navaden profil</SelectItem>
                  <SelectItem value="z-line">Z-line — Prekrivni profil</SelectItem>
                  <SelectItem value="vertical">Vertical — Vertikalne letve</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Input Fields */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-roksal-ink">
                Meritve
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
              <div className="space-y-1.5">
                <Label htmlFor="totalLength" className="text-xs">
                  Skupna dolžina (m)
                </Label>
                <Input
                  id="totalLength"
                  type="number"
                  value={effectiveTotalLength}
                  onChange={(e) => setTotalLength(e.target.value)}
                  placeholder="3.0"
                  step="0.1"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slatWidth" className="text-xs">
                  Širina letve (mm)
                </Label>
                <Input
                  id="slatWidth"
                  type="number"
                  value={slatWidth}
                  onChange={(e) => setSlatWidth(e.target.value)}
                  placeholder="80"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxGap" className="text-xs">
                  Maksimalni razmik (mm)
                </Label>
                <Input
                  id="maxGap"
                  type="number"
                  value={maxGap}
                  onChange={(e) => setMaxGap(e.target.value)}
                  placeholder="100"
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="postCount" className="text-xs">
                  Število stebrov (izbirno)
                </Label>
                <Input
                  id="postCount"
                  type="number"
                  value={postCount}
                  onChange={(e) => setPostCount(e.target.value)}
                  placeholder="3"
                  className="tabular-nums"
                />
              </div>
            </CardContent>
          </Card>

          {/* Calculate Button */}
          <Button
            onClick={handleCalculate}
            className="w-full bg-roksal-navy hover:bg-roksal-navy/90 text-white h-11"
          >
            <Calculator aria-hidden="true" className="mr-2 h-4 w-4" />
            Izračunaj razmike
          </Button>

          {/* R150: inženirske validacijske napake (fail-closed — brez tihega nonsensa) */}
          {engineeringErrors.length > 0 && mode === 'railing' && (
            <div
              role="alert"
              className="rounded-lg border border-roksal-amber/30 bg-roksal-amber/10 p-3 animate-in fade-in slide-in-from-bottom-2 duration-200"
            >
              <p className="flex items-center gap-1.5 text-xs font-semibold text-roksal-amber">
                <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
                Izračun zavrnjen — vnos izven območja umerjenosti formule:
              </p>
              <ul className="mt-1.5 space-y-1">
                {engineeringErrors.map((e, i) => (
                  <li key={i} className="text-xs text-roksal-ink">• {e}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Results */}
          {railingResult && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* R150: prstni odtis — deterministična vezava vhodov na verzijo formule */}
              {lastFingerprint && (
                <p
                  className="text-center text-2xs text-muted-foreground font-mono tabular-nums"
                  title="Deterministični prstni odtis: isti vhod + ista verzija formule = isti rezultat"
                >
                  Formula {lastFingerprint.formulaVersion} · vhod {lastFingerprint.inputHash}
                </p>
              )}
              {/* Visual Representation */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold text-roksal-ink">
                    Vizualizacija — {profileLabels[profileType]}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {renderRailingVisual()}
                </CardContent>
              </Card>

              {/* Compliance Status */}
              <Card
                className={`overflow-hidden border-l-4 ${
                  railingResult.isCompliant
                    ? 'border-l-roksal-green bg-roksal-green/5'
                    : 'border-l-roksal-red bg-roksal-red/5'
                }`}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  {railingResult.isCompliant ? (
                    <CheckCircle2 aria-hidden="true" className="h-6 w-6 shrink-0 text-roksal-green" />
                  ) : (
                    <AlertTriangle aria-hidden="true" className="h-6 w-6 shrink-0 text-roksal-red" />
                  )}
                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        railingResult.isCompliant ? 'text-roksal-green' : 'text-roksal-red'
                      }`}
                    >
                      {railingResult.isCompliant
                        ? 'SKLADNO s standardom'
                        : 'NESKLADNO — Presežen razmik!'}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      Razmik {railingResult.actualGapMm.toFixed(1)}mm{' '}
                      {railingResult.isCompliant ? '≤' : '>'} 100mm
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Results Grid */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                <Card className="px-3 py-3 transition-shadow hover:shadow-sm">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">
                    Število letvev
                  </p>
                  <p className="text-2xl font-bold text-roksal-ink tabular-nums">
                    {railingResult.slatCount}
                  </p>
                  <p className="text-2xs text-muted-foreground tabular-nums">
                    kos × {parseFloat(slatWidth)}mm
                  </p>
                </Card>
                <Card className="px-3 py-3 transition-shadow hover:shadow-sm">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">
                    Dejanski razmik
                  </p>
                  <p className="text-2xl font-bold text-roksal-ink tabular-nums">
                    {railingResult.actualGapMm.toFixed(1)}
                  </p>
                  <p className="text-2xs text-muted-foreground">mm</p>
                </Card>
                <Card className="px-3 py-3 transition-shadow hover:shadow-sm">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">
                    Skupna širina letvev
                  </p>
                  <p className="text-lg font-bold text-roksal-ink tabular-nums">
                    {(railingResult.totalSlatsLengthMm / 1000).toFixed(2)}m
                  </p>
                </Card>
                <Card className="px-3 py-3 transition-shadow hover:shadow-sm">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">
                    Skupna širina razmikov
                  </p>
                  <p className="text-lg font-bold text-roksal-ink tabular-nums">
                    {(railingResult.totalGapsLengthMm / 1000).toFixed(2)}m
                  </p>
                </Card>
              </div>

              {/* Warnings */}
              {railingResult.warnings.length > 0 && (
                <Card className="border-roksal-amber/30">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-amber">
                      <Info aria-hidden="true" className="h-4 w-4" />
                      Opozorila
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <ul className="space-y-1.5">
                      {railingResult.warnings.map((w, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-xs text-muted-foreground"
                        >
                          <AlertTriangle aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 text-roksal-amber" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Cut List */}
              {renderCutList()}

              {/* Skupaj material + Ocena stroškov (md+: stransko po sebi) */}
              <div className="grid gap-4 md:grid-cols-2 md:items-start">
              <Card className="overflow-hidden border-l-4 border-l-roksal-navy">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                    <Package aria-hidden="true" className="h-4 w-4" />
                    Skupaj material
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-roksal-navy/5 p-3">
                      <p className="text-2xs text-muted-foreground uppercase tracking-wide">
                        Skupaj tekoče metre letvev
                      </p>
                      <p className="text-2xl font-bold text-roksal-ink">
                        {(railingResult.totalSlatsLengthMm / 1000).toFixed(2)}<span className="text-sm font-normal ml-0.5">m</span>
                      </p>
                    </div>
                    <div className="rounded-lg bg-roksal-amber/10 p-3">
                      <p className="text-2xs text-muted-foreground uppercase tracking-wide">
                        Število letvev
                      </p>
                      <p className="text-2xl font-bold text-roksal-amber">
                        {railingResult.slatCount}<span className="text-sm font-normal ml-0.5">kos</span>
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Za dolžino {parseFloat(effectiveTotalLength)}m s širino letve {parseFloat(slatWidth)}mm je potrebnih{' '}
                    <span className="font-semibold text-roksal-ink">{railingResult.totalSlatsLengthMm / 1000} tekočih metrov</span> materiala.
                  </p>
                </CardContent>
              </Card>

              {/* Ocena stroškov */}
              <Card className="overflow-hidden border-l-4 border-l-roksal-amber">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                    <Euro aria-hidden="true" className="h-4 w-4" />
                    Ocena stroškov
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {(() => {
                    const slatPricePerM = profileType === 'z-line' ? 8.5 : 6.2
                    const slatTotalM = railingResult.totalSlatsLengthMm / 1000
                    const slatCost = slatTotalM * slatPricePerM
                    const postsCount = postCount ? parseInt(postCount) : 0
                    const postsCost = postsCount > 0 ? postsCount * 25 : 0
                    const anchoringCost = anchoringResult ? anchoringResult.cartridgesNeeded * 12 : 0
                    const totalCost = slatCost + postsCost + anchoringCost
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/30">
                          <div className="flex items-center gap-2">
                            <Euro aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Letve ({slatTotalM.toFixed(2)}m × {slatPricePerM.toFixed(1)} €/m)</span>
                          </div>
                          <span className="font-medium text-roksal-ink">{slatCost.toFixed(2)} €</span>
                        </div>
                        {postsCount > 0 && (
                          <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/30">
                            <div className="flex items-center gap-2">
                              <Euro aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">Stebri ({postsCount} × 25 €)</span>
                            </div>
                            <span className="font-medium text-roksal-ink">{postsCost.toFixed(2)} €</span>
                          </div>
                        )}
                        {anchoringCost > 0 && (
                          <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/30">
                            <div className="flex items-center gap-2">
                              <Euro aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">Smola/čepi ({anchoringResult!.cartridgesNeeded} × 12 €)</span>
                            </div>
                            <span className="font-medium text-roksal-ink">{anchoringCost.toFixed(2)} €</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-sm pt-1.5">
                          <span className="font-bold text-roksal-ink">Skupaj</span>
                          <span className="font-bold text-roksal-ink text-base">{totalCost.toFixed(2)} €</span>
                        </div>
                      </div>
                    )
                  })()}
                </CardContent>
              </Card>
              </div>

              {/* Safety Info Box */}
              <Card className="bg-roksal-navy/5">
                <CardContent className="flex gap-3 p-4">
                  <Info aria-hidden="true" className="h-5 w-5 shrink-0 text-roksal-ink" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-roksal-ink">
                      Pravilnik o varstvu otrok (SIST EN 13485)
                    </p>
                    <p className="mt-1">
                      Maksimalni razmik med letvami za ograje na stopniščih in balkonih
                      je <span className="font-bold text-roksal-ink">100mm</span>. Večji
                      razmiki predstavljajo nevarnost zapletanja (lestveni učinek).
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* ANCHORING CALCULATOR */}
      {mode === 'anchoring' && (
        <>
          {/* runda S — priporočilo pritrditve iz terenskega pregleda */}
          {importedFromMeasurement?.podlaga && (
            <Card className={importedFromMeasurement.podlaga === 'estrih' ? 'border-roksal-amber/40 bg-roksal-amber/10' : 'border-roksal-navy/15 dark:border-roksal-ink/15'}>
              <CardContent className="p-4">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 ${importedFromMeasurement.podlaga === 'estrih' ? 'text-roksal-amber' : 'text-roksal-ink/50'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-roksal-ink">
                      Podlaga z terena: {podlagaLabels[importedFromMeasurement.podlaga] ?? importedFromMeasurement.podlaga}
                    </p>
                    <p className={`mt-0.5 text-2xs leading-relaxed ${importedFromMeasurement.podlaga === 'estrih' ? 'font-medium text-roksal-ink' : 'text-muted-foreground'}`}>
                      {podlagaAnchorAdvice[importedFromMeasurement.podlaga] ?? 'Preveri podlago na terenu.'}
                    </p>
                    {importedFromMeasurement.podlaga === 'estrih' && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(['hilti-hit', 'fischer-fis'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setAnchorType(t)}
                            aria-pressed={anchorType === t}
                            className={`min-h-[32px] rounded-full border px-3 text-2xs font-bold transition-all ${
                              anchorType === t
                                ? 'border-roksal-amber bg-roksal-amber/15 text-roksal-amber'
                                : 'border-roksal-amber/40 bg-background text-roksal-ink hover:border-roksal-amber'
                            }`}
                          >
                            {anchorTypeLabels[t]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Anchor Type */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                <Anchor aria-hidden="true" className="h-4 w-4" />
                Tip sidra
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Select
                value={anchorType}
                onValueChange={(v) => setAnchorType(v as AnchorType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(anchorTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Input Fields */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-roksal-ink">
                Parametri sidranja
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="holeCount" className="text-xs">
                    Število lukenj
                  </Label>
                  <Input
                    id="holeCount"
                    type="number"
                    value={holeCount}
                    onChange={(e) => setHoleCount(e.target.value)}
                    placeholder="8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="holeDepth" className="text-xs">
                    Globina luknje (mm)
                  </Label>
                  <Input
                    id="holeDepth"
                    type="number"
                    value={holeDepthMm}
                    onChange={(e) => setHoleDepthMm(e.target.value)}
                    placeholder="120"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="holeDiameter" className="text-xs">
                    Premer luknje (mm)
                  </Label>
                  <Input
                    id="holeDiameter"
                    type="number"
                    value={holeDiameterMm}
                    onChange={(e) => setHoleDiameterMm(e.target.value)}
                    placeholder="14"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="temperature" className="text-xs">
                    Temperatura (°C)
                  </Label>
                  <Input
                    id="temperature"
                    type="number"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    placeholder="20"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Temperature Warning */}
          {parseFloat(temperature) < 10 && (
            <div className="flex items-center gap-3 rounded-xl border border-roksal-amber/30 bg-roksal-amber/5 p-3">
              <Thermometer aria-hidden="true" className="h-5 w-5 shrink-0 text-roksal-amber" />
              <p className="text-xs text-muted-foreground">
                {parseFloat(temperature) < 5
                  ? 'POZOR: Temperatura < 5°C. Kemično sidranje ni priporočljivo!'
                  : 'Opozorilo: Nizka temperatura — podaljšan čas strjevanja smole.'}
              </p>
            </div>
          )}

          {/* Calculate Button */}
          <Button
            onClick={handleCalculate}
            className="w-full bg-roksal-navy hover:bg-roksal-navy/90 text-white h-11"
          >
            <Anchor aria-hidden="true" className="mr-2 h-4 w-4" />
            Izračunaj sidranje
          </Button>

          {/* R150: inženirske validacijske napake (fail-closed) */}
          {engineeringErrors.length > 0 && mode === 'anchoring' && (
            <div
              role="alert"
              className="rounded-lg border border-roksal-amber/30 bg-roksal-amber/10 p-3 animate-in fade-in slide-in-from-bottom-2 duration-200"
            >
              <p className="flex items-center gap-1.5 text-xs font-semibold text-roksal-amber">
                <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
                Izračun zavrnjen — vnos izven območja umerjenosti formule:
              </p>
              <ul className="mt-1.5 space-y-1">
                {engineeringErrors.map((e, i) => (
                  <li key={i} className="text-xs text-roksal-ink">• {e}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Results */}
          {anchoringResult && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* R150: prstni odtis — deterministična vezava vhodov na verzijo formule */}
              {lastFingerprint && (
                <p
                  className="text-center text-2xs text-muted-foreground font-mono tabular-nums"
                  title="Deterministični prstni odtis: isti vhod + ista verzija formule = isti rezultat"
                >
                  Formula {lastFingerprint.formulaVersion} · vhod {lastFingerprint.inputHash}
                </p>
              )}
              {/* Main Results */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                <Card className="px-3 py-3">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">
                    Smola na luknjo
                  </p>
                  <p className="text-2xl font-bold text-roksal-ink">
                    {anchoringResult.resinVolumeMl}
                  </p>
                  <p className="text-2xs text-muted-foreground">ml</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">
                    Skupaj smola
                  </p>
                  <p className="text-2xl font-bold text-roksal-ink">
                    {anchoringResult.totalResinMl}
                  </p>
                  <p className="text-2xs text-muted-foreground">ml</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">
                    Čas strjevanja
                  </p>
                  <p className="text-2xl font-bold text-roksal-ink">
                    {anchoringResult.curingTimeMin}
                  </p>
                  <p className="text-2xs text-muted-foreground">min</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">
                    Patronov
                  </p>
                  <p className="text-2xl font-bold text-roksal-amber">
                    {anchoringResult.cartridgesNeeded}
                  </p>
                  <p className="text-2xs text-muted-foreground">
                    × {anchorType === 'hilti-hit' ? '330' : '300'}ml
                  </p>
                </Card>
              </div>

              {/* Warnings */}
              {anchoringResult.warnings.length > 0 && (
                <Card className="border-roksal-amber/30">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-amber">
                      <AlertTriangle aria-hidden="true" className="h-4 w-4" />
                      Opozorila
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <ul className="space-y-1.5">
                      {anchoringResult.warnings.map((w, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-xs text-muted-foreground"
                        >
                          <AlertTriangle aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 text-roksal-amber" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Info */}
              <Card className="bg-roksal-navy/5">
                <CardContent className="flex gap-3 p-4">
                  <Info aria-hidden="true" className="h-5 w-5 shrink-0 text-roksal-ink" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-roksal-ink">
                      Navodila za sidranje
                    </p>
                    <p className="mt-1">
                      Pri uporabi kemičnega sidranja je obvezno predhodno vrtanje in
                      čiščenje lukenj. Uporabite samo originalne smole proizvajalca.
                      Čas strjevanja je odvisen od temperature okolja.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* WIND LOAD CALCULATOR */}
      {mode === 'wind' && (
        <>
          {/* Railing Type */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                <Wind aria-hidden="true" className="h-4 w-4" />
                Tip ograje
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Select
                value={railingType}
                onValueChange={(v) => setRailingType(v as RailingType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(railingTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Input Fields */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-roksal-ink">
                Parametri vetra
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="windHeight" className="text-xs">
                    Višina nad tlemi (m)
                  </Label>
                  <Input
                    id="windHeight"
                    type="number"
                    value={heightAboveGround}
                    onChange={(e) => setHeightAboveGround(e.target.value)}
                    placeholder="10"
                    step="0.5"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Kategorija terena</Label>
                  <Select
                    value={terrainCategory}
                    onValueChange={(v) => setTerrainCategory(v as TerrainCategory)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(terrainLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="windSpeed" className="text-xs">
                    Hitrost vetra (m/s)
                  </Label>
                  <Input
                    id="windSpeed"
                    type="number"
                    value={windSpeedMs}
                    onChange={(e) => setWindSpeedMs(e.target.value)}
                    placeholder="25"
                    step="0.5"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="railingArea" className="text-xs">
                    Površina ograje (m²)
                  </Label>
                  <Input
                    id="railingArea"
                    type="number"
                    value={railingAreaM2}
                    onChange={(e) => setRailingAreaM2(e.target.value)}
                    placeholder="6"
                    step="0.5"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Calculate Button */}
          <Button
            onClick={handleCalculate}
            className="w-full bg-roksal-navy hover:bg-roksal-navy/90 text-white h-11"
          >
            <Wind aria-hidden="true" className="mr-2 h-4 w-4" />
            Izračunaj vetrno obremenitev
          </Button>

          {/* R150: inženirske validacijske napake (fail-closed) */}
          {engineeringErrors.length > 0 && mode === 'wind' && (
            <div
              role="alert"
              className="rounded-lg border border-roksal-amber/30 bg-roksal-amber/10 p-3 animate-in fade-in slide-in-from-bottom-2 duration-200"
            >
              <p className="flex items-center gap-1.5 text-xs font-semibold text-roksal-amber">
                <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
                Izračun zavrnjen — vnos izven območja umerjenosti formule:
              </p>
              <ul className="mt-1.5 space-y-1">
                {engineeringErrors.map((e, i) => (
                  <li key={i} className="text-xs text-roksal-ink">• {e}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Results */}
          {windResult && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* R150: prstni odtis — deterministična vezava vhodov na verzijo formule */}
              {lastFingerprint && (
                <p
                  className="text-center text-2xs text-muted-foreground font-mono tabular-nums"
                  title="Deterministični prstni odtis: isti vhod + ista verzija formule = isti rezultat"
                >
                  Formula {lastFingerprint.formulaVersion} · vhod {lastFingerprint.inputHash}
                </p>
              )}
              {/* Risk Level */}
              <Card className={`overflow-hidden border ${riskColors[windResult.riskLevel]}`}>
                <CardContent className="flex items-center gap-3 p-4">
                  {windResult.riskLevel === 'LOW' || windResult.riskLevel === 'MEDIUM' ? (
                    <CheckCircle2 aria-hidden="true" className="h-6 w-6 shrink-0" />
                  ) : (
                    <AlertTriangle aria-hidden="true" className="h-6 w-6 shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-semibold">
                      {riskLabels[windResult.riskLevel]}
                    </p>
                    <p className="text-xs opacity-75">
                      {windResult.windPressureKpa.toFixed(2)} kPa vetrni tlak
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Main Results */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="px-3 py-3 transition-shadow hover:shadow-sm">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">
                    Tlak
                  </p>
                  <p className="text-xl font-bold text-roksal-ink tabular-nums">
                    {windResult.windPressureKpa.toFixed(2)}
                  </p>
                  <p className="text-2xs text-muted-foreground">kPa</p>
                </Card>
                <Card className="px-3 py-3 transition-shadow hover:shadow-sm">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">
                    Skupna sila
                  </p>
                  <p className="text-xl font-bold text-roksal-ink tabular-nums">
                    {windResult.totalForceKn.toFixed(2)}
                  </p>
                  <p className="text-2xs text-muted-foreground">kN</p>
                </Card>
                <Card className="px-3 py-3 transition-shadow hover:shadow-sm">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">
                    Sila/m
                  </p>
                  <p className="text-xl font-bold text-roksal-ink tabular-nums">
                    {windResult.forcePerMeterNm.toFixed(1)}
                  </p>
                  <p className="text-2xs text-muted-foreground">N/m</p>
                </Card>
              </div>

              {/* Recommendations */}
              {windResult.recommendations.length > 0 && (
                <Card className="border-roksal-amber/30">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-amber">
                      <Info aria-hidden="true" className="h-4 w-4" />
                      Priporočila
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <ul className="space-y-1.5">
                      {windResult.recommendations.map((r, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-xs text-muted-foreground"
                        >
                          <AlertTriangle aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 text-roksal-amber" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Info */}
              <Card className="bg-roksal-navy/5">
                <CardContent className="flex gap-3 p-4">
                  <Info aria-hidden="true" className="h-5 w-5 shrink-0 text-roksal-ink" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-roksal-ink">
                      Vetrna obremenitev (EVS EN 1991-1-4)
                    </p>
                    <p className="mt-1">
                      Izračun vključuje osnovni vetrni tlak, terenski faktor, višinski faktor
                      in aerodinamični koeficient. Za kritične primere je potrebna statična analiza.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* ===== BALUSTER (RAZMAK PALIC) CALCULATOR ===== */}
      {mode === 'baluster' && (
        <>
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                <AlignJustify aria-hidden="true" className="h-4 w-4" />
                Razmak palic — enakomerna porazdelitev
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <div className="space-y-1.5">
                <Label htmlFor="balTotalLength" className="text-xs">
                  Skupna dolžina (m)
                </Label>
                <Input
                  id="balTotalLength"
                  type="number"
                  value={balTotalLength}
                  onChange={(e) => setBalTotalLength(e.target.value)}
                  placeholder="3.0"
                  step="0.1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="balWidth" className="text-xs">
                    Širina palice (mm)
                  </Label>
                  <Input
                    id="balWidth"
                    type="number"
                    value={balWidth}
                    onChange={(e) => setBalWidth(e.target.value)}
                    placeholder="40"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="balMaxGap" className="text-xs">
                    Max razmik (mm)
                  </Label>
                  <Input
                    id="balMaxGap"
                    type="number"
                    value={balMaxGap}
                    onChange={(e) => setBalMaxGap(e.target.value)}
                    placeholder="110"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="balPostSpacing" className="text-xs">
                  Razmik stebrov (mm, max 1500)
                </Label>
                <Input
                  id="balPostSpacing"
                  type="number"
                  value={balPostSpacing}
                  onChange={(e) => setBalPostSpacing(e.target.value)}
                  placeholder="1500"
                />
              </div>
            </CardContent>
          </Card>

          {/* P2: Rezerva materiala + DDV */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                <Percent aria-hidden="true" className="h-4 w-4 text-roksal-amber" />
                Rezerva materiala
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Select
                value={String(rezervaPctBaluster)}
                onValueChange={(v) => setRezervaPctBaluster(parseFloat(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reserveOptions.map((r) => (
                    <SelectItem key={r} value={String(r)}>
                      {r}%{r === 10 ? ' (priporočeno)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-2xs text-muted-foreground">
                Pri izračunu se vse količine (palice, stebri, vijaki, sidra) pomnožijo z (1 + rezerva/100).
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={handleCalculate}
              className="w-full bg-roksal-navy hover:bg-roksal-navy/90 text-white h-11"
            >
              <AlignJustify aria-hidden="true" className="mr-2 h-4 w-4" />
              Izračunaj razmak palic
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={saveTemplate}
              aria-label="Shrani trenutne vnose kot predlogo"
              title="Shrani trenutne vnose kot predlogo"
              className="w-full h-11 border-roksal-amber/40 text-roksal-ink hover:bg-roksal-amber/10"
            >
              <BookmarkPlus aria-hidden="true" className="mr-2 h-4 w-4" />
              Shrani predlogo
            </Button>
          </div>

          {balusterResult && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Compliance */}
              <Card
                className={`overflow-hidden border-l-4 ${
                  balusterResult.isCompliant
                    ? 'border-l-roksal-green bg-roksal-green/5'
                    : 'border-l-roksal-red bg-roksal-red/5'
                }`}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  {balusterResult.isCompliant ? (
                    <CheckCircle2 aria-hidden="true" className="h-6 w-6 shrink-0 text-roksal-green" />
                  ) : (
                    <AlertTriangle aria-hidden="true" className="h-6 w-6 shrink-0 text-roksal-red" />
                  )}
                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        balusterResult.isCompliant ? 'text-roksal-green' : 'text-roksal-red'
                      }`}
                    >
                      {balusterResult.isCompliant
                        ? 'SKLADNO s predpisi'
                        : 'NESKLADNO — presežen razmik!'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Razmik {balusterResult.actualGapMm.toFixed(1)}mm{' '}
                      {balusterResult.isCompliant ? '≤' : '>'} {balMaxGap}mm
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Result cards */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="px-3 py-3">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">
                    Število palic
                  </p>
                  <p className="text-2xl font-bold text-roksal-ink">
                    {applyReserve(balusterResult.balusterCount, rezervaPctBaluster)}
                  </p>
                  <p className="text-2xs text-muted-foreground">kos × {balWidth}mm</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">
                    Dejanski razmik
                  </p>
                  <p className="text-2xl font-bold text-roksal-ink">
                    {balusterResult.actualGapMm.toFixed(1)}
                  </p>
                  <p className="text-2xs text-muted-foreground">mm</p>
                </Card>
              </div>

              {/* P2: Rezerva materiala info */}
              {rezervaPctBaluster > 0 && (
                <Card className="border-roksal-amber/30 bg-roksal-amber/5">
                  <CardContent className="flex items-center gap-3 p-3">
                    <Percent aria-hidden="true" className="h-5 w-5 shrink-0 text-roksal-amber" />
                    <div className="text-xs">
                      <p className="font-semibold text-roksal-ink">Rezerva materiala: {rezervaPctBaluster}%</p>
                      <p className="text-muted-foreground">
                        Brez rezerve: <span className="font-medium text-foreground">{balusterResult.balusterCount} kos</span>
                        {' → '}z rezervo: <span className="font-medium text-roksal-amber">{applyReserve(balusterResult.balusterCount, rezervaPctBaluster)} kos</span>
                        {' '}<span className="text-muted-foreground">(+{rezervaPctBaluster}%)</span>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* SVG diagram */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold text-roksal-ink">
                    Vizualizacija — tehnična skica
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <BalusterSvg
                    totalLengthMm={parseFloat(balTotalLength) * 1000}
                    balusterWidthMm={parseFloat(balWidth)}
                    positions={balusterResult.positions}
                    gapMm={balusterResult.actualGapMm}
                    count={balusterResult.balusterCount}
                  />
                </CardContent>
              </Card>

              {/* Positions table */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                      <Drill aria-hidden="true" className="h-4 w-4" />
                      Pozicije od prve točke
                    </CardTitle>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-2xs border-roksal-amber/30 text-roksal-ink hover:bg-roksal-amber/10"
                      onClick={() => exportBalusterPdf({ balusterResult, balTotalLength, balWidth, balMaxGap, rezervaPctBaluster })}
                    >
                      <FileDown aria-hidden="true" className="mr-1 h-3 w-3" />
                      Izvozi PDF
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="max-h-80 overflow-y-auto scrollbar-thin rounded-lg border border-border/40">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead className="w-10 text-center">#</TableHead>
                          <TableHead className="text-right">mm</TableHead>
                          <TableHead className="text-right">cm</TableHead>
                          <TableHead className="text-right">m</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {balusterResult.centers.map((c, i) => (
                          <TableRow key={i} className="even:bg-roksal-navy/5">
                            <TableCell className="text-center font-semibold text-roksal-ink">
                              {i + 1}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {c.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {(c / 10).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {(c / 1000).toFixed(3)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="mt-2 text-2xs text-muted-foreground">
                    Pozicije so centri palic — kjer vrtate luknje za pritrditev.
                  </p>
                </CardContent>
              </Card>

              {/* Warnings */}
              {balusterResult.warnings.length > 0 && (
                <Card className="border-roksal-amber/30">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-amber">
                      <Info aria-hidden="true" className="h-4 w-4" />
                      Opozorila
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <ul className="space-y-1.5">
                      {balusterResult.warnings.map((w, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-xs text-muted-foreground"
                        >
                          <AlertTriangle aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 text-roksal-amber" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {/* ===== ANGLED (KOTNI IZRAČUN) CALCULATOR ===== */}
      {mode === 'angled' && (
        <>
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                <Triangle aria-hidden="true" className="h-4 w-4" />
                Kotni / stopniščni izračun
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="angHorizontalLength" className="text-xs">
                    Horizontalna dolžina (m)
                  </Label>
                  <Input
                    id="angHorizontalLength"
                    type="number"
                    value={angHorizontalLength}
                    onChange={(e) => setAngHorizontalLength(e.target.value)}
                    placeholder="2.5"
                    step="0.1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="angRakeAngle" className="text-xs">
                    Kot stopnice (°)
                  </Label>
                  <Input
                    id="angRakeAngle"
                    type="number"
                    value={angRakeAngle}
                    onChange={(e) => setAngRakeAngle(e.target.value)}
                    placeholder="35"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="angWidth" className="text-xs">
                    Širina palice (mm)
                  </Label>
                  <Input
                    id="angWidth"
                    type="number"
                    value={angWidth}
                    onChange={(e) => setAngWidth(e.target.value)}
                    placeholder="40"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="angMaxGap" className="text-xs">
                    Max razmik (mm)
                  </Label>
                  <Input
                    id="angMaxGap"
                    type="number"
                    value={angMaxGap}
                    onChange={(e) => setAngMaxGap(e.target.value)}
                    placeholder="110"
                  />
                </div>
              </div>
              <div className="rounded-lg bg-roksal-navy/5 p-3 text-[11px] text-muted-foreground">
                <p>
                  <span className="font-medium text-roksal-ink">Tipični koti:</span>{' '}
                  30–35° (standardno stopnišče), 38–42° (strmo), 45°+ (zelo strmo, preverite statiko).
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={handleCalculate}
              className="w-full bg-roksal-navy hover:bg-roksal-navy/90 text-white h-11"
            >
              <Triangle aria-hidden="true" className="mr-2 h-4 w-4" />
              Izračunaj kotni izračun
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={saveTemplate}
              aria-label="Shrani trenutne vnose kot predlogo"
              title="Shrani trenutne vnose kot predlogo"
              className="w-full h-11 border-roksal-amber/40 text-roksal-ink hover:bg-roksal-amber/10"
            >
              <BookmarkPlus aria-hidden="true" className="mr-2 h-4 w-4" />
              Shrani predlogo
            </Button>
          </div>

          {angledResult && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Result cards */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="px-3 py-3">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">
                    Rake dolžina
                  </p>
                  <p className="text-2xl font-bold text-roksal-ink">
                    {(angledResult.rakeLengthMm / 1000).toFixed(2)}
                  </p>
                  <p className="text-2xs text-muted-foreground">m (poševno)</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">
                    Kot stopnice
                  </p>
                  <p className="text-2xl font-bold text-roksal-ink">
                    {angledResult.rakeAngleDeg.toFixed(1)}°
                  </p>
                  <p className="text-2xs text-muted-foreground">
                    horiz. razmik: {angledResult.horizontalGapMm.toFixed(0)}mm
                  </p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">
                    Število palic
                  </p>
                  <p className="text-2xl font-bold text-roksal-ink">
                    {angledResult.balusterCount}
                  </p>
                  <p className="text-2xs text-muted-foreground">kos</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">
                    Dejanski razmik (po rake)
                  </p>
                  <p className="text-2xl font-bold text-roksal-ink">
                    {angledResult.actualGapMm.toFixed(1)}
                  </p>
                  <p className="text-2xs text-muted-foreground">mm</p>
                </Card>
              </div>

              {/* Compliance */}
              <Card
                className={`overflow-hidden border-l-4 ${
                  angledResult.isCompliant
                    ? 'border-l-roksal-green bg-roksal-green/5'
                    : 'border-l-roksal-red bg-roksal-red/5'
                }`}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  {angledResult.isCompliant ? (
                    <CheckCircle2 aria-hidden="true" className="h-6 w-6 shrink-0 text-roksal-green" />
                  ) : (
                    <AlertTriangle aria-hidden="true" className="h-6 w-6 shrink-0 text-roksal-red" />
                  )}
                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        angledResult.isCompliant ? 'text-roksal-green' : 'text-roksal-red'
                      }`}
                    >
                      {angledResult.isCompliant
                        ? 'SKLADNO s predpisi'
                        : 'NESKLADNO — presežen razmik!'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Razmik {angledResult.actualGapMm.toFixed(1)}mm po rake {' '}
                      {angledResult.isCompliant ? '≤' : '>'} {angMaxGap}mm
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Angled SVG */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold text-roksal-ink">
                    Vizualizacija — kose ograje
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <AngledSvg
                    horizontalLengthMm={parseFloat(angHorizontalLength) * 1000}
                    rakeAngleDeg={parseFloat(angRakeAngle)}
                    positions={angledResult.positions}
                    balusterWidthMm={parseFloat(angWidth)}
                    gapMm={angledResult.actualGapMm}
                  />
                </CardContent>
              </Card>

              {/* Positions table */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                    <Drill aria-hidden="true" className="h-4 w-4" />
                    Pozicije palic (po rake)
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="max-h-64 overflow-y-auto scrollbar-thin rounded-lg border border-border/40">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead className="w-10 text-center">#</TableHead>
                          <TableHead className="text-right">mm</TableHead>
                          <TableHead className="text-right">cm</TableHead>
                          <TableHead className="text-right">m</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {angledResult.centers.map((c, i) => (
                          <TableRow key={i} className="even:bg-roksal-navy/5">
                            <TableCell className="text-center font-semibold text-roksal-ink">
                              {i + 1}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {c.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {(c / 10).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {(c / 1000).toFixed(3)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Warnings */}
              {angledResult.warnings.length > 0 && (
                <Card className="border-roksal-amber/30">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-amber">
                      <Info aria-hidden="true" className="h-4 w-4" />
                      Opozorila
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <ul className="space-y-1.5">
                      {angledResult.warnings.map((w, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-xs text-muted-foreground"
                        >
                          <AlertTriangle aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 text-roksal-amber" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {/* ===== MATERIAL (SKUPNI MATERIAL) CALCULATOR ===== */}
      {mode === 'material' && (
        <>
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                <Package aria-hidden="true" className="h-4 w-4" />
                Segmenti projekta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              {segments.map((seg, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border/60 bg-background p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-roksal-ink">
                      Segment {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSegments(segments.filter((_, idx) => idx !== i))
                      }}
                      className="p-1 rounded-md hover:bg-roksal-red/10 text-roksal-red transition-colors"
                      aria-label="Odstrani segment"
                    >
                      <X aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-2xs text-muted-foreground">Dolžina (m)</Label>
                      <Input
                        type="number"
                        value={seg.lengthMm / 1000}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) * 1000
                          setSegments(
                            segments.map((s, idx) =>
                              idx === i ? { ...s, lengthMm: isFinite(v) ? v : 0 } : s,
                            ),
                          )
                        }}
                        step="0.1"
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-2xs text-muted-foreground">Višina (mm)</Label>
                      <Input
                        type="number"
                        value={seg.heightMm}
                        onChange={(e) => {
                          const v = parseInt(e.target.value)
                          setSegments(
                            segments.map((s, idx) =>
                              idx === i ? { ...s, heightMm: isFinite(v) ? v : 0 } : s,
                            ),
                          )
                        }}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-2xs text-muted-foreground">Tip</Label>
                      <Select
                        value={seg.type}
                        onValueChange={(v: 'level' | 'angled' | 'stair') => {
                          setSegments(
                            segments.map((s, idx) =>
                              idx === i
                                ? {
                                    ...s,
                                    type: v,
                                    rakeAngleDeg: v === 'level' ? undefined : s.rakeAngleDeg ?? 35,
                                  }
                                : s,
                            ),
                          )
                        }}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="level">Ravno</SelectItem>
                          <SelectItem value="angled">Koso</SelectItem>
                          <SelectItem value="stair">Stopnišče</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {(seg.type === 'angled' || seg.type === 'stair') && (
                    <div className="space-y-1">
                      <Label className="text-2xs text-muted-foreground">Kot stopnice (°)</Label>
                      <Input
                        type="number"
                        value={seg.rakeAngleDeg ?? 35}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value)
                          setSegments(
                            segments.map((s, idx) =>
                              idx === i ? { ...s, rakeAngleDeg: isFinite(v) ? v : 0 } : s,
                            ),
                          )
                        }}
                        className="h-9 text-xs"
                      />
                    </div>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-9 border-dashed border-roksal-navy/30 dark:border-roksal-ink/30 text-roksal-ink hover:bg-roksal-navy/5"
                onClick={() => {
                  setSegments([
                    ...segments,
                    { lengthMm: 3000, heightMm: 1100, type: 'level' },
                  ])
                }}
              >
                <Plus aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                Dodaj segment
              </Button>
            </CardContent>
          </Card>

          {/* Profile selector */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-roksal-ink">
                Profil materiala
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {profili.length === 0 ? (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  Nalagam profile...
                </div>
              ) : (
                <Select
                  value={selectedProfileSifra}
                  onValueChange={setSelectedProfileSifra}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {profili.map((p) => (
                      <SelectItem key={p.sifra} value={p.sifra}>
                        {p.naziv} — {p.sifra} ({p.cenaM.toFixed(2)} €/m)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedProfileSifra && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Cena profila:{' '}
                  <span className="font-medium text-roksal-ink">
                    {profili.find((p) => p.sifra === selectedProfileSifra)?.cenaM.toFixed(2)} €/m
                  </span>
                </p>
              )}
              {/* runda S — barva naročila z terena (pračni lak) */}
              {importedFromMeasurement?.ralCode && (
                <div className="mt-2 flex items-center gap-2 rounded-md bg-roksal-amber/10 px-2 py-1.5">
                  <Palette aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-roksal-amber" />
                  <p className="text-2xs font-medium text-roksal-ink">
                    Naročilo: profil prašno lakiran v{' '}
                    <span className="font-bold">RAL {importedFromMeasurement.ralCode}</span>
                    {' '}
                    ({ralNarociloNames[importedFromMeasurement.ralCode] ?? 'po meri'})
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* P2: Strošek dela */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                <Users aria-hidden="true" className="h-4 w-4 text-roksal-amber" />
                Strošek dela
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="urnaPostavka" className="text-xs">Urna postavka (EUR/h)</Label>
                  <Input
                    id="urnaPostavka"
                    type="number"
                    value={urnaPostavka}
                    onChange={(e) => setUrnaPostavka(e.target.value)}
                    placeholder="35"
                    step="0.5"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="stUr" className="text-xs">Število ur</Label>
                  <Input
                    id="stUr"
                    type="number"
                    value={stUr}
                    onChange={(e) => setStUr(e.target.value)}
                    placeholder="8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="stMonterjev" className="text-xs">Število monterjev</Label>
                  <Input
                    id="stMonterjev"
                    type="number"
                    value={stMonterjev}
                    onChange={(e) => setStMonterjev(e.target.value)}
                    placeholder="2"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="transport" className="text-xs">Transport (EUR)</Label>
                  <Input
                    id="transport"
                    type="number"
                    value={transport}
                    onChange={(e) => setTransport(e.target.value)}
                    placeholder="50"
                  />
                </div>
              </div>
              <div className="rounded-lg bg-roksal-navy/5 p-2.5 text-[11px] text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Timer aria-hidden="true" className="h-3 w-3 text-roksal-ink" />
                    Predvideni čas montaže
                  </span>
                  <span className="font-medium text-roksal-ink">
                    {(parseFloat(stUr) || 0) * (parseFloat(stMonterjev) || 0)} ur ({(parseFloat(stUr) || 0)}h × {(parseFloat(stMonterjev) || 0)} monterjev)
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* P2: Rezerva + DDV + Akontacija */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                <Wallet aria-hidden="true" className="h-4 w-4 text-roksal-amber" />
                Rezerva, DDV in akontacija
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Percent aria-hidden="true" className="h-3 w-3 text-roksal-amber" />
                  Rezerva materiala
                </Label>
                <Select
                  value={String(rezervaPctMaterial)}
                  onValueChange={(v) => setRezervaPctMaterial(parseFloat(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {reserveOptions.map((r) => (
                      <SelectItem key={r} value={String(r)}>
                        {r}%{r === 10 ? ' (priporočeno)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Stopnja DDV</Label>
                <Select
                  value={String(ddvPct)}
                  onValueChange={(v) => setDdvPct(parseFloat(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ddvOptions.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Wallet aria-hidden="true" className="h-3 w-3 text-roksal-amber" />
                  Akontacija (ob naročilu)
                </Label>
                <Select
                  value={String(akontacijaPct)}
                  onValueChange={(v) => setAkontacijaPct(parseFloat(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {akontacijaOptions.map((a) => (
                      <SelectItem key={a} value={String(a)}>
                        {a}%{a === 0 ? ' (brez akontacije)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={handleCalculate}
              className="w-full bg-roksal-navy hover:bg-roksal-navy/90 text-white h-11"
              disabled={segments.length === 0 || !selectedProfileSifra}
            >
              <Package aria-hidden="true" className="mr-2 h-4 w-4" />
              Izračunaj skupni material
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={saveTemplate}
              aria-label="Shrani trenutne vnose kot predlogo"
              title="Shrani trenutne vnose kot predlogo"
              className="w-full h-11 border-roksal-amber/40 text-roksal-ink hover:bg-roksal-amber/10"
            >
              <BookmarkPlus aria-hidden="true" className="mr-2 h-4 w-4" />
              Shrani predlogo
            </Button>
          </div>

          {materialResult && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Main totals */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="px-3 py-3 col-span-2">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">
                    Skupno tekoči metri profila
                  </p>
                  <p className="text-3xl font-bold text-roksal-ink">
                    {materialResult.totalLinearMeters.toFixed(2)}
                    <span className="text-sm font-normal ml-1">m</span>
                  </p>
                  <p className="text-2xs text-muted-foreground">
                    letve {materialResult.railLinearMeters.toFixed(2)}m + palice {materialResult.balusterLinearMeters.toFixed(2)}m
                  </p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">
                    Palice {rezervaPctMaterial > 0 ? '(z rezervo)' : ''}
                  </p>
                  <p className="text-2xl font-bold text-roksal-ink">
                    {applyReserve(materialResult.balusterCount, rezervaPctMaterial)}
                  </p>
                  <p className="text-2xs text-muted-foreground">
                    {rezervaPctMaterial > 0
                      ? `brez: ${materialResult.balusterCount} (+${rezervaPctMaterial}%)`
                      : 'kos'}
                  </p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">
                    Stebri {rezervaPctMaterial > 0 ? '(z rezervo)' : ''}
                  </p>
                  <p className="text-2xl font-bold text-roksal-ink">
                    {applyReserve(materialResult.postCount, rezervaPctMaterial)}
                  </p>
                  <p className="text-2xs text-muted-foreground">kos (×2 sidra)</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">
                    Vijaki {rezervaPctMaterial > 0 ? '(z rezervo)' : ''}
                  </p>
                  <p className="text-2xl font-bold text-roksal-ink">
                    {applyReserve(materialResult.screwCount, rezervaPctMaterial)}
                  </p>
                  <p className="text-2xs text-muted-foreground">kos (A4 Inox)</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">
                    Sidra {rezervaPctMaterial > 0 ? '(z rezervo)' : ''}
                  </p>
                  <p className="text-2xl font-bold text-roksal-ink">
                    {applyReserve(materialResult.anchorCount, rezervaPctMaterial)}
                  </p>
                  {/* runda S — pravi tip sidra po podlagi z terena */}
                  <p className="text-2xs text-muted-foreground">
                    kos ({importedFromMeasurement?.podlaga
                      ? podlagaSidraLabel[importedFromMeasurement.podlaga] ?? 'kemična'
                      : 'kemična'})
                  </p>
                </Card>
              </div>

              {/* runda S — pritrditev + barva z terena v BOM pogledu */}
              {importedFromMeasurement?.podlaga && (
                <Card className={importedFromMeasurement.podlaga === 'estrih' ? 'border-roksal-amber/40 bg-roksal-amber/10' : 'border-roksal-navy/15 dark:border-roksal-ink/15'}>
                  <CardContent className="flex items-start gap-2.5 p-3">
                    <Drill aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 ${importedFromMeasurement.podlaga === 'estrih' ? 'text-roksal-amber' : 'text-roksal-ink/50'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-roksal-ink">
                        Pritrditev: {podlagaSidraLabel[importedFromMeasurement.podlaga] ?? 'po meri'}
                        <span className="ml-1 font-normal text-muted-foreground">
                          (podlaga: {podlagaLabels[importedFromMeasurement.podlaga] ?? importedFromMeasurement.podlaga})
                        </span>
                      </p>
                      <p className={`mt-0.5 text-2xs leading-relaxed ${importedFromMeasurement.podlaga === 'estrih' ? 'font-medium text-roksal-ink' : 'text-muted-foreground'}`}>
                        {podlagaAnchorAdvice[importedFromMeasurement.podlaga] ?? 'Preveri podlago na terenu.'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* P2: Rezerva materiala info */}
              {rezervaPctMaterial > 0 && (
                <Card className="border-roksal-amber/30 bg-roksal-amber/5">
                  <CardContent className="flex items-center gap-3 p-3">
                    <Percent aria-hidden="true" className="h-5 w-5 shrink-0 text-roksal-amber" />
                    <div className="text-xs flex-1">
                      <p className="font-semibold text-roksal-ink">Rezerva materiala: {rezervaPctMaterial}%</p>
                      <div className="text-muted-foreground grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-1">
                        <span>Palice: {materialResult.balusterCount} → <span className="font-medium text-roksal-amber">{applyReserve(materialResult.balusterCount, rezervaPctMaterial)}</span></span>
                        <span>Stebri: {materialResult.postCount} → <span className="font-medium text-roksal-amber">{applyReserve(materialResult.postCount, rezervaPctMaterial)}</span></span>
                        <span>Vijaki: {materialResult.screwCount} → <span className="font-medium text-roksal-amber">{applyReserve(materialResult.screwCount, rezervaPctMaterial)}</span></span>
                        <span>Sidra: {materialResult.anchorCount} → <span className="font-medium text-roksal-amber">{applyReserve(materialResult.anchorCount, rezervaPctMaterial)}</span></span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* F-3: Betoniranje stebrov — količine betona (raziskava: ToolGrit/Hoover
                  fence kalkulatorji; zmrzovalna globina SI ≈ 80 cm) */}
              {(() => {
                const posts = applyReserve(materialResult.postCount, rezervaPctMaterial)
                const dia = parseFloat(concreteHoleDiaMm) / 1000
                const depth = parseFloat(concreteHoleDepthMm) / 1000
                if (!isFinite(dia) || !isFinite(depth) || dia <= 0 || depth <= 0 || posts <= 0) return null
                const holeL = Math.PI * (dia / 2) ** 2 * depth * 1000
                const postL = 0.06 * 0.06 * depth * 1000 // profil 60×60 mm v luknji
                const perPostL = Math.max(holeL - postL, 0)
                const totalL = Math.round(perPostL * posts)
                const bags25 = Math.ceil(totalL / 12) // 25 kg vreča suhe zmesi ≈ 12 L betona
                // R230 — žetoni (border-border + bg-muted/40 — R229 Zapadlo
                // nevtralna veja vzorec; stone dvojček izbrisan)
                return (
                  <Card className="border-border bg-muted/40">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                        <Hammer aria-hidden="true" className="h-4 w-4 text-roksal-amber" />
                        Betoniranje stebrov
                        <Badge variant="outline" className="ml-auto text-2xs">
                          {posts} stebrov
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="concreteDia" className="text-xs text-muted-foreground">
                            Premer luknje (mm)
                          </Label>
                          <Select value={concreteHoleDiaMm} onValueChange={setConcreteHoleDiaMm}>
                            <SelectTrigger id="concreteDia" className="mt-1 h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {['200', '250', '300', '350', '400'].map((v) => (
                                <SelectItem key={v} value={v}>{v} mm</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="concreteDepth" className="text-xs text-muted-foreground">
                            Globina luknje (mm)
                          </Label>
                          <Input
                            id="concreteDepth"
                            type="number"
                            inputMode="numeric"
                            min={400}
                            max={1500}
                            step={50}
                            className="mt-1 h-9"
                            value={concreteHoleDepthMm}
                            onChange={(e) => setConcreteHoleDepthMm(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Card className="px-3 py-2.5 bg-card">
                          <p className="text-2xs text-muted-foreground uppercase tracking-wide">Betona skupaj</p>
                          <p className="text-xl font-bold text-roksal-ink">
                            {formatSlDecimalno(totalL, 0, 3)} <span className="text-sm font-medium">L</span>
                          </p>
                          <p className="text-2xs text-muted-foreground">{Math.round(perPostL)} L / steber</p>
                        </Card>
                        <Card className="px-3 py-2.5 bg-card">
                          <p className="text-2xs text-muted-foreground uppercase tracking-wide">Vreče 25 kg</p>
                          <p className="text-xl font-bold text-roksal-amber">{bags25}</p>
                          <p className="text-2xs text-muted-foreground">≈ 12 L / vreča</p>
                        </Card>
                      </div>
                      {parseInt(concreteHoleDepthMm) < 800 && (
                        <p className="flex items-start gap-1.5 text-[11px] leading-snug text-roksal-ink">
                          <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-roksal-amber" />
                          Globina pod 800 mm — v Sloveniji je priporočena zmrzovalna globina ≈ 80 cm,
                          sicer lahko zmrzal dviguje stebre.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )
              })()}

              {/* Per-segment breakdown */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                    <Hammer aria-hidden="true" className="h-4 w-4" />
                    Razdelitev po segmentih
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="rounded-lg border border-border/40 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">#</TableHead>
                          <TableHead className="text-xs">Tip</TableHead>
                          <TableHead className="text-xs text-right">Dolžina</TableHead>
                          <TableHead className="text-xs text-right">Palice</TableHead>
                          <TableHead className="text-xs text-right">Stebri</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {materialResult.perSegment.map((s, i) => (
                          <TableRow key={i} className="even:bg-roksal-navy/5">
                            <TableCell className="text-xs font-semibold text-roksal-ink">{i + 1}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                                {s.type === 'level' ? 'Ravno' : s.type === 'angled' ? 'Koso' : 'Stopnišče'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono">{s.lengthM.toFixed(2)}m</TableCell>
                            <TableCell className="text-xs text-right font-mono">{s.balusterCount}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{s.postCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Cost breakdown */}
              <Card className="overflow-hidden border-l-4 border-l-roksal-amber">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                    <Euro aria-hidden="true" className="h-4 w-4" />
                    Stroški materiala
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/30">
                      <span className="text-muted-foreground">
                        Profil ({materialResult.totalLinearMeters.toFixed(2)}m ×{' '}
                        {materialResult.selectedProfile?.cenaM.toFixed(2) ?? '0.00'} €/m)
                      </span>
                      <span className="font-medium text-roksal-ink">
                        {materialResult.profileCost.toFixed(2)} €
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/30">
                      <span className="text-muted-foreground">
                        Stebri ({materialResult.postCount} × 25 €)
                      </span>
                      <span className="font-medium text-roksal-ink">
                        {materialResult.postsCost.toFixed(2)} €
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/30">
                      <span className="text-muted-foreground">
                        Vijaki ({materialResult.screwCount} × 0,10 €)
                      </span>
                      <span className="font-medium text-roksal-ink">
                        {materialResult.screwsCost.toFixed(2)} €
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/30">
                      <span className="text-muted-foreground">
                        Sidra ({materialResult.anchorCount} × 1,50 €)
                      </span>
                      <span className="font-medium text-roksal-ink">
                        {materialResult.anchorsCost.toFixed(2)} €
                      </span>
                    </div>
                    <Separator className="my-1" />
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-bold text-roksal-ink text-sm">SKUPAJ MATERIAL</span>
                      <span className="font-bold text-roksal-amber text-lg">
                        {materialResult.totalCost.toFixed(2)} €
                      </span>
                    </div>
                  </div>

                  {/* P2: Strošek dela */}
                  {(() => {
                    const labor = calculateLaborCost({
                      urnaPostavka: parseFloat(urnaPostavka) || 0,
                      stUr: parseFloat(stUr) || 0,
                      stMonterjev: parseFloat(stMonterjev) || 0,
                      transport: parseFloat(transport) || 0,
                    })
                    const skupajBrezDdv = materialResult.totalCost + labor.delaSkupaj
                    const ddv = calculateDDV(skupajBrezDdv, ddvPct)
                    const akon = calculateAkontacija(ddv.total, akontacijaPct)
                    return (
                      <>
                        <Separator className="my-3" />
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold text-roksal-ink uppercase tracking-wide flex items-center gap-1.5">
                            <Users aria-hidden="true" className="h-3 w-3 text-roksal-amber" />
                            Strošek dela
                          </p>
                          <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/30">
                            <span className="text-muted-foreground">
                              Delo ({labor.urnaPostavka.toFixed(2)} €/h × {labor.stUr}h × {labor.stMonterjev} monterjev)
                            </span>
                            <span className="font-medium text-roksal-ink">
                              {labor.cistaDela.toFixed(2)} €
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/30">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <Truck aria-hidden="true" className="h-3 w-3" />
                              Transport
                            </span>
                            <span className="font-medium text-roksal-ink">
                              {labor.transport.toFixed(2)} €
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/30">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <Timer aria-hidden="true" className="h-3 w-3" />
                              Predvideni čas montaže
                            </span>
                            <span className="font-medium text-roksal-ink">
                              {labor.predvideniCas} ur
                            </span>
                          </div>
                          <Separator className="my-1" />
                          <div className="flex items-center justify-between pt-1">
                            <span className="font-bold text-roksal-ink text-sm">SKUPAJ BREZ DDV</span>
                            <span className="font-bold text-roksal-ink text-base">
                              {skupajBrezDdv.toFixed(2)} €
                            </span>
                          </div>
                          {/* P2: DDV */}
                          <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/30">
                            <span className="text-muted-foreground">
                              DDV ({formatSI(ddvPct, 1)}%)
                            </span>
                            <span className="font-medium text-roksal-ink">
                              {ddv.ddvAmount.toFixed(2)} €
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-1 pb-1 bg-roksal-navy/5 -mx-1 px-3 rounded">
                            <span className="font-bold text-roksal-ink text-sm">SKUPAJ Z DDV</span>
                            <span className="font-bold text-roksal-amber text-xl">
                              {ddv.total.toFixed(2)} €
                            </span>
                          </div>
                        </div>

                        {/* P2: Akontacija */}
                        {akontacijaPct > 0 && (
                          <>
                            <Separator className="my-3" />
                            <div className="space-y-2">
                              <p className="text-[11px] font-semibold text-roksal-ink uppercase tracking-wide flex items-center gap-1.5">
                                <Wallet aria-hidden="true" className="h-3 w-3 text-roksal-amber" />
                                Akontacija
                              </p>
                              <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/30">
                                <span className="text-muted-foreground">
                                  Akontacija ({akontacijaPct}%) — ob naročilu
                                </span>
                                <span className="font-medium text-roksal-amber">
                                  {akon.akontacija.toFixed(2)} €
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/30">
                                <span className="text-muted-foreground">
                                  Preostanek ({100 - akontacijaPct}%) — ob prevzemu
                                </span>
                                <span className="font-medium text-roksal-ink">
                                  {akon.preostanek.toFixed(2)} €
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-xs py-1.5 text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                  <Calendar aria-hidden="true" className="h-3 w-3" />
                                  Predvideni datum plačila akontacije
                                </span>
                                <span className="font-medium text-roksal-ink">
                                  {slDatumKratko(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))}
                                </span>
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )
                  })()}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full mt-3 h-9 border-roksal-navy/30 dark:border-roksal-ink/30 text-roksal-ink hover:bg-roksal-navy/5"
                    onClick={() => exportMaterialPdf({ materialResult, projectName, rezervaPctMaterial, urnaPostavka, stUr, stMonterjev, transport, ddvPct, akontacijaPct, importedFromMeasurement })}
                  >
                    <FileDown aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                    Izvozi materialni list PDF
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* ===== COMPLIANCE (PREDPISI) CALCULATOR ===== */}
      {mode === 'compliance' && (
        <>
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                Preverjanje skladnosti s predpisi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="compGap" className="text-xs">
                    Razmik med palicami (mm)
                  </Label>
                  <Input
                    id="compGap"
                    type="number"
                    value={compGap}
                    onChange={(e) => setCompGap(e.target.value)}
                    placeholder="90"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="compHeight" className="text-xs">
                    Višina ograje (mm)
                  </Label>
                  <Input
                    id="compHeight"
                    type="number"
                    value={compHeight}
                    onChange={(e) => setCompHeight(e.target.value)}
                    placeholder="1100"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="compPostSpacing" className="text-xs">
                    Razmik stebrov (mm)
                  </Label>
                  <Input
                    id="compPostSpacing"
                    type="number"
                    value={compPostSpacing}
                    onChange={(e) => setCompPostSpacing(e.target.value)}
                    placeholder="1500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="compDropHeight" className="text-xs">
                    Padec pod ograjo (mm)
                  </Label>
                  <Input
                    id="compDropHeight"
                    type="number"
                    value={compDropHeight}
                    onChange={(e) => setCompDropHeight(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Kategorija obremenitve</Label>
                <Select
                  value={compLoadCategory}
                  onValueChange={(v: 'A' | 'B' | 'C') => setCompLoadCategory(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A — Stanovanjsko (0,74 kN/m)</SelectItem>
                    <SelectItem value="B">B — Javno (1,0 kN/m)</SelectItem>
                    <SelectItem value="C">C — Intenzivno javno (1,5 kN/m)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={handleCalculate}
              className="w-full bg-roksal-navy hover:bg-roksal-navy/90 text-white h-11"
            >
              <ShieldCheck aria-hidden="true" className="mr-2 h-4 w-4" />
              Preveri skladnost
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={saveTemplate}
              aria-label="Shrani trenutne vnose kot predlogo"
              title="Shrani trenutne vnose kot predlogo"
              className="w-full h-11 border-roksal-amber/40 text-roksal-ink hover:bg-roksal-amber/10"
            >
              <BookmarkPlus aria-hidden="true" className="mr-2 h-4 w-4" />
              Shrani predlogo
            </Button>
          </div>

          {complianceResult && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <Card
                className={`overflow-hidden border-l-4 ${
                  complianceResult.passed
                    ? 'border-l-roksal-green bg-roksal-green/5'
                    : 'border-l-roksal-red bg-roksal-red/5'
                }`}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  {complianceResult.passed ? (
                    <CheckCircle2 aria-hidden="true" className="h-6 w-6 shrink-0 text-roksal-green" />
                  ) : (
                    <AlertTriangle aria-hidden="true" className="h-6 w-6 shrink-0 text-roksal-red" />
                  )}
                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        complianceResult.passed ? 'text-roksal-green' : 'text-roksal-red'
                      }`}
                    >
                      {complianceResult.passed
                        ? 'VSE PREVERBE USPEŠNE'
                        : 'NESKLADNO — potrebne popravke!'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {complianceResult.checks.filter((c) => c.passed).length}/
                      {complianceResult.checks.length} preverb uspešnih
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold text-roksal-ink">
                    Podrobne preverbe
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {complianceResult.checks.map((check, i) => (
                    <div
                      key={i}
                      className={`rounded-lg border p-3 ${
                        check.passed
                          ? 'border-roksal-green/30 bg-roksal-green/5'
                          : 'border-roksal-red/30 bg-roksal-red/5'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {check.passed ? (
                          <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-roksal-green mt-0.5" />
                        ) : (
                          <X aria-hidden="true" className="h-5 w-5 shrink-0 text-roksal-red mt-0.5" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-roksal-ink">{check.name}</p>
                          <div className="mt-1 grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-muted-foreground">Zahtevano: </span>
                              <span className="font-medium text-foreground">{check.required}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Dejansko: </span>
                              <span className="font-medium text-foreground">{check.actual}</span>
                            </div>
                          </div>
                          <p className="mt-1.5 text-[11px] text-muted-foreground">{check.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-roksal-navy/5">
                <CardContent className="flex gap-3 p-4">
                  <Info aria-hidden="true" className="h-5 w-5 shrink-0 text-roksal-ink" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-roksal-ink">
                      Sklic predpisov
                    </p>
                    <p className="mt-1">
                      SIST EN 1264 (razmik ≤ 110mm), SIST EN 13485 (višina ograj),
                      EVS EN 1991-1-1 (horizontalna obremenitev). Za objekte z javnim
                      dostopom veljajo strožji kriteriji — obvezno posvetovanje s statikom.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* ===== CNC REZ CALCULATOR ===== */}
      {mode === 'cnc' && (
        <>
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                <Scissors aria-hidden="true" className="h-4 w-4" />
                CNC razrezni načrt — 1D bin packing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Dolžina profila</Label>
                  <Select
                    value={cncStockPreset}
                    onValueChange={(v) => {
                      setCncStockPreset(v)
                      if (v !== 'custom') setCncStockLength(v)
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6000">6000mm (aluminij)</SelectItem>
                      <SelectItem value="4000">4000mm (WPC dolg)</SelectItem>
                      <SelectItem value="2200">2200mm (WPC standard)</SelectItem>
                      <SelectItem value="custom">Po meri</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cncStockLength" className="text-xs">Dolžina (mm)</Label>
                  <Input
                    id="cncStockLength"
                    type="number"
                    value={cncStockLength}
                    onChange={(e) => {
                      setCncStockLength(e.target.value)
                      setCncStockPreset('custom')
                    }}
                    placeholder="6000"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cncSawBlade" className="text-xs">Širina reza (mm) — žagin disk</Label>
                <Input
                  id="cncSawBlade"
                  type="number"
                  value={cncSawBlade}
                  onChange={(e) => setCncSawBlade(e.target.value)}
                  placeholder="3"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                  <AlignJustify aria-hidden="true" className="h-4 w-4" />
                  Zahtevani odseki
                  <Badge variant="secondary" className="text-2xs h-5 px-1.5">{cncSegments.length}</Badge>
                </CardTitle>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-2xs border-roksal-amber/40 text-roksal-ink hover:bg-roksal-amber/10"
                    onClick={() => {
                      // Uvozi iz materiala — uporabi trenutne segments iz material mode
                      if (segments.length === 0) {
                        toast.error('V načinu "Skupni material" najprej dodajte segmente.')
                        return
                      }
                      const newSegs: CncSegment[] = segments.map((s) => ({
                        lengthMm: String(s.lengthMm),
                        count: '1',
                        label: s.type === 'angled' ? `Kos (kot ${s.rakeAngleDeg ?? 0}°)` : s.type === 'stair' ? 'Stopnišče' : 'Letev',
                      }))
                      setCncSegments(newSegs)
                      toast.success(`Uvoženo ${newSegs.length} odsekov iz materiala`)
                    }}
                  >
                    <ArrowDownToLine aria-hidden="true" className="mr-1 h-3 w-3" />
                    Uvozi iz materiala
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-2xs"
                    onClick={() => setCncSegments([...cncSegments, { lengthMm: '', count: '1', label: '' }])}
                  >
                    <Plus aria-hidden="true" className="mr-1 h-3 w-3" />
                    Dodaj
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
                {cncSegments.map((seg, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-1.5 items-end rounded-lg border border-border/50 p-2">
                    <div className="col-span-4 space-y-1">
                      <Label className="text-[9px] text-muted-foreground">Labela</Label>
                      <Input
                        type="text"
                        value={seg.label}
                        onChange={(e) => {
                          const copy = [...cncSegments]
                          copy[idx] = { ...copy[idx], label: e.target.value }
                          setCncSegments(copy)
                        }}
                        placeholder="npr. Zgornja letev"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-[9px] text-muted-foreground">Dolžina (mm)</Label>
                      <Input
                        type="number"
                        value={seg.lengthMm}
                        onChange={(e) => {
                          const copy = [...cncSegments]
                          copy[idx] = { ...copy[idx], lengthMm: e.target.value }
                          setCncSegments(copy)
                        }}
                        placeholder="2500"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-[9px] text-muted-foreground">Število</Label>
                      <Input
                        type="number"
                        value={seg.count}
                        onChange={(e) => {
                          const copy = [...cncSegments]
                          copy[idx] = { ...copy[idx], count: e.target.value }
                          setCncSegments(copy)
                        }}
                        placeholder="2"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setCncSegments(cncSegments.filter((_, i) => i !== idx))}
                        className="p-1.5 rounded-md text-roksal-red hover:bg-roksal-red/10 transition-colors"
                        aria-label="Odstrani odsek"
                      >
                        <X aria-hidden="true" className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {cncSegments.length === 0 && (
                  <div className="text-center py-4 text-xs text-muted-foreground">
                    Dodajte odseke za rezanje ali uvozite iz materiala.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={handleCalculate}
              className="w-full bg-roksal-navy hover:bg-roksal-navy/90 text-white h-11"
            >
              <Scissors aria-hidden="true" className="mr-2 h-4 w-4" />
              Izračunaj razrez
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => exportCncPdf({ cncResult, cncStockLength, cncSawBlade, cncSegments, projectName })}
              disabled={!cncResult}
              className="w-full h-11 border-roksal-amber/40 text-roksal-ink hover:bg-roksal-amber/10 disabled:opacity-40"
            >
              <FileDown aria-hidden="true" className="mr-2 h-4 w-4" />
              Izvozi PDF
            </Button>
          </div>

          {cncResult && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="px-3 py-3">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">Profilov</p>
                  <p className="text-2xl font-bold text-roksal-ink">{cncResult.stockCount}</p>
                  <p className="text-2xs text-muted-foreground">kos × {cncStockLength}mm</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">Izkoristek</p>
                  <p className="text-2xl font-bold text-roksal-green">{cncResult.overallUtilizationPct.toFixed(1)}<span className="text-sm font-normal ml-0.5">%</span></p>
                  <p className="text-2xs text-muted-foreground">{(cncResult.totalRequiredMm / 1000).toFixed(2)}m / {(cncResult.totalStockMm / 1000).toFixed(2)}m</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">Ostanek</p>
                  <p className="text-2xl font-bold text-roksal-amber">{cncResult.totalWasteMm}<span className="text-sm font-normal ml-0.5">mm</span></p>
                  <p className="text-2xs text-muted-foreground">{(cncResult.totalWasteMm / 1000).toFixed(2)}m</p>
                </Card>
              </div>

              {/* Warnings */}
              {cncResult.warnings.length > 0 && (
                <Card className="border-roksal-amber/30">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-amber">
                      <AlertTriangle aria-hidden="true" className="h-4 w-4" />
                      Opozorila
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <ul className="space-y-1.5">
                      {cncResult.warnings.map((w, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <AlertTriangle aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 text-roksal-amber" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Razrezni načrt — visual */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                    <Scissors aria-hidden="true" className="h-4 w-4" />
                    Razrezni načrt (vizualno)
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  {cncResult.plans.map((plan) => {
                    const stockLen = parseFloat(cncStockLength) || 1
                    const colors = ['#1d2b3e', '#f59e0b', '#22c55e', '#0ea5e9', '#a855f7', '#ef4444', '#14b8a6', '#f97316']
                    let cursor = 0
                    return (
                      <div key={plan.stockIndex} className="space-y-1">
                        <div className="flex items-center justify-between text-2xs">
                          <span className="font-mono font-semibold text-roksal-ink">Profil #{plan.stockIndex}</span>
                          <span className="text-muted-foreground">
                            {plan.cuts.length} rezov · ostanek {plan.remainingMm}mm · izkoristek {plan.utilizationPct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex h-6 rounded-md overflow-hidden border border-border">
                          {plan.cuts.map((c, ci) => {
                            const widthPct = (c.lengthMm / stockLen) * 100
                            cursor += c.lengthMm + (parseFloat(cncSawBlade) || 3)
                            const color = colors[c.fromSegmentIndex % colors.length]
                            return (
                              <div
                                key={ci}
                                className="h-full flex items-center justify-center text-3xs font-mono text-white"
                                style={{ width: `${widthPct}%`, backgroundColor: color }}
                                title={`${c.label || 'Odsek'}: ${c.lengthMm}mm`}
                              >
                                {widthPct > 8 ? c.lengthMm : ''}
                              </div>
                            )
                          })}
                          {plan.remainingMm > 0 && (
                            <div
                              className="h-full bg-muted border-l border-dashed border-border flex items-center justify-center text-3xs text-muted-foreground"
                              style={{ width: `${(plan.remainingMm / stockLen) * 100}%` }}
                            >
                              {plan.remainingMm > 50 ? `${plan.remainingMm}` : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/30">
                    {Array.from(new Set(cncResult.plans.flatMap(p => p.cuts.map(c => c.fromSegmentIndex)))).map((idx) => {
                      const seg = cncSegments[idx]
                      const colors = ['#1d2b3e', '#f59e0b', '#22c55e', '#0ea5e9', '#a855f7', '#ef4444', '#14b8a6', '#f97316']
                      return (
                        <span key={idx} className="flex items-center gap-1 text-2xs text-muted-foreground">
                          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colors[idx % colors.length] }} />
                          {seg?.label || `Odsek ${idx + 1}`} ({seg?.lengthMm}mm × {seg?.count})
                        </span>
                      )
                    })}
                    <span className="flex items-center gap-1 text-2xs text-muted-foreground">
                      <span className="inline-block h-2.5 w-3 rounded-sm bg-muted border border-dashed border-border" />
                      Ostanek
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Tabela razreza */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                    <AlignJustify aria-hidden="true" className="h-4 w-4" />
                    Tabela razreza
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="overflow-x-auto scrollbar-thin">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-2xs">Profil</TableHead>
                          <TableHead className="text-2xs">Rezi</TableHead>
                          <TableHead className="text-2xs text-right">Ostanek</TableHead>
                          <TableHead className="text-2xs text-right">Izkoristek</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cncResult.plans.map((plan) => (
                          <TableRow key={plan.stockIndex}>
                            <TableCell className="text-xs font-mono font-semibold text-roksal-ink">#{plan.stockIndex}</TableCell>
                            <TableCell className="text-xs">
                              {plan.cuts.map((c, i) => (
                                <span key={i} className="inline-block mr-1 mb-0.5 px-1.5 py-0.5 rounded bg-secondary text-2xs font-mono">
                                  {c.lengthMm}mm{c.label ? ` · ${c.label}` : ''}
                                </span>
                              ))}
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono text-roksal-amber">{plan.remainingMm}mm</TableCell>
                            <TableCell className="text-xs text-right font-mono font-semibold">{plan.utilizationPct.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* ===== VETER PO LOKACIJI CALCULATOR ===== */}
      {mode === 'windLocation' && (
        <>
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                <MapPin aria-hidden="true" className="h-4 w-4" />
                Lokacija
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="windLocLat" className="text-xs">Latitude (°N)</Label>
                  <Input
                    id="windLocLat"
                    type="number"
                    value={windLocLat}
                    onChange={(e) => setWindLocLat(e.target.value)}
                    placeholder="46.2389"
                    step="0.0001"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="windLocLon" className="text-xs">Longitude (°E)</Label>
                  <Input
                    id="windLocLon"
                    type="number"
                    value={windLocLon}
                    onChange={(e) => setWindLocLon(e.target.value)}
                    placeholder="14.3556"
                    step="0.0001"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full border-roksal-amber/40 text-roksal-ink hover:bg-roksal-amber/10 h-10"
                onClick={() => {
                  if (typeof navigator === 'undefined' || !navigator.geolocation) {
                    toast.error('Geolokacija ni podprta v tem brskalniku.')
                    return
                  }
                  setWindLocLoading(true)
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      setWindLocLat(pos.coords.latitude.toFixed(4))
                      setWindLocLon(pos.coords.longitude.toFixed(4))
                      setWindLocLoading(false)
                      toast.success(`Lokacija pridobljena: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`)
                    },
                    (err) => {
                      setWindLocLoading(false)
                      const msg = err.code === err.PERMISSION_DENIED
                        ? 'Dostop do lokacije zavrnjen. Vnesite GPS ročno.'
                        : err.code === err.POSITION_UNAVAILABLE
                        ? 'Lokacija ni na voljo.'
                        : err.code === err.TIMEOUT
                        ? 'Časovna omejitev za lokacijo potekla.'
                        : 'Napaka pri pridobivanju lokacije.'
                      toast.error(msg)
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
                  )
                }}
                disabled={windLocLoading}
              >
                {windLocLoading ? (
                  <>
                    <Crosshair aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                    Pridobivanje...
                  </>
                ) : (
                  <>
                    <Navigation aria-hidden="true" className="mr-2 h-4 w-4" />
                    Uporabi mojo lokacijo
                  </>
                )}
              </Button>
              <p className="text-2xs text-muted-foreground text-center">
                Privzeto: Kranj (46,2389°N, 14,3556°E)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-roksal-ink">
                Parametri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="windLocHeight" className="text-xs">Višina nad tlemi (m)</Label>
                  <Input
                    id="windLocHeight"
                    type="number"
                    value={windLocHeight}
                    onChange={(e) => setWindLocHeight(e.target.value)}
                    placeholder="10"
                    step="0.5"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="windLocArea" className="text-xs">Površina ograje (m²)</Label>
                  <Input
                    id="windLocArea"
                    type="number"
                    value={windLocArea}
                    onChange={(e) => setWindLocArea(e.target.value)}
                    placeholder="6"
                    step="0.5"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Kategorija terena</Label>
                <Select
                  value={windLocTerrain}
                  onValueChange={(v) => setWindLocTerrain(v as TerrainCategory)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="I">I — Odprto morje, jezera</SelectItem>
                    <SelectItem value="II">II — Ravninsko, nizka vegetacija</SelectItem>
                    <SelectItem value="III">III — Primestno, gozdovi</SelectItem>
                    <SelectItem value="IV">IV — Urbano, visoke stavbe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tip ograje</Label>
                <Select
                  value={windLocType}
                  onValueChange={(v) => setWindLocType(v as RailingType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(railingTypeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={handleCalculate}
              className="w-full bg-roksal-navy hover:bg-roksal-navy/90 text-white h-11"
            >
              <Wind aria-hidden="true" className="mr-2 h-4 w-4" />
              Izračunaj vetrno obremenitev
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => exportWindLocPdf({ windLocResult, windLocLat, windLocLon, windLocHeight, windLocTerrain, windLocArea, windLocType, projectName })}
              disabled={!windLocResult}
              className="w-full h-11 border-roksal-amber/40 text-roksal-ink hover:bg-roksal-amber/10 disabled:opacity-40"
            >
              <FileDown aria-hidden="true" className="mr-2 h-4 w-4" />
              Izvozi PDF
            </Button>
          </div>

          {windLocResult && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Location & Risk badge */}
              <Card className={`overflow-hidden border ${riskColors[windLocResult.riskLevel]}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-2xs text-muted-foreground uppercase tracking-wide">Lokacija</p>
                      <p className="text-sm font-bold text-roksal-ink truncate">{windLocResult.locationDescription}</p>
                      <p className="text-2xs text-muted-foreground font-mono">
                        {windLocLat}°N, {windLocLon}°E
                      </p>
                    </div>
                    <Badge className={`${riskColors[windLocResult.riskLevel]} border`}>
                      {riskLabels[windLocResult.riskLevel]}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Wind zone visual + key stats */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="px-3 py-3 flex items-center gap-3">
                  {windLocResult.windZone === 3 ? (
                    <Mountain aria-hidden="true" className="h-8 w-8 text-roksal-amber shrink-0" />
                  ) : windLocResult.windZone === 2 ? (
                    <Wind aria-hidden="true" className="h-8 w-8 text-roksal-amber shrink-0" />
                  ) : (
                    <MapPin aria-hidden="true" className="h-8 w-8 text-roksal-green shrink-0" />
                  )}
                  <div>
                    <p className="text-2xs text-muted-foreground uppercase tracking-wide">Vetrna cona</p>
                    <p className="text-2xl font-bold text-roksal-ink">{windLocResult.windZone}</p>
                    <p className="text-2xs text-muted-foreground">
                      {windLocResult.windZone === 3 ? 'gore' : windLocResult.windZone === 2 ? 'obala' : 'celina'}
                    </p>
                  </div>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">Osnovna hitrost</p>
                  <p className="text-2xl font-bold text-roksal-ink">{windLocResult.basicWindSpeedMs}<span className="text-sm font-normal ml-0.5">m/s</span></p>
                  <p className="text-2xs text-muted-foreground">{windLocResult.basicPressureKpa.toFixed(3)} kPa</p>
                </Card>
              </div>

              {/* Main results */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="px-3 py-3">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">Vrhnji tlak</p>
                  <p className="text-xl font-bold text-roksal-ink">{windLocResult.designPressureKpa.toFixed(2)}</p>
                  <p className="text-2xs text-muted-foreground">kPa</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">Skupna sila</p>
                  <p className="text-xl font-bold text-roksal-ink">{windLocResult.totalForceKn.toFixed(2)}</p>
                  <p className="text-2xs text-muted-foreground">kN</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">Sila/m</p>
                  <p className="text-xl font-bold text-roksal-ink">{windLocResult.forcePerMeterNm.toFixed(0)}</p>
                  <p className="text-2xs text-muted-foreground">N/m</p>
                </Card>
              </div>

              {/* Slovenia map SVG */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                    <MapPin aria-hidden="true" className="h-4 w-4" />
                    Karta vetrnih con Slovenije
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <SloveniaWindMapSvg
                    lat={parseFloat(windLocLat) || 46.2}
                    lon={parseFloat(windLocLon) || 14.5}
                    windZone={windLocResult.windZone}
                  />
                </CardContent>
              </Card>

              {/* Recommendations */}
              {windLocResult.recommendations.length > 0 && (
                <Card className="border-roksal-amber/30">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-amber">
                      <Info aria-hidden="true" className="h-4 w-4" />
                      Priporočila
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <ul className="space-y-1.5">
                      {windLocResult.recommendations.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <AlertTriangle aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 text-roksal-amber" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-roksal-navy/5">
                <CardContent className="flex gap-3 p-4">
                  <Info aria-hidden="true" className="h-5 w-5 shrink-0 text-roksal-ink" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-roksal-ink">
                      SIST EN 1991-1-4 NA (Slovenija)
                    </p>
                    <p className="mt-1">
                      Vetrne cone Slovenije: cona 1 (celina — 22 m/s), cona 2 (obala — 24 m/s),
                      cona 3 (gore &gt; 1000 m — 28 m/s). Izračun vključuje terenski faktor,
                      višinski faktor in aerodinamični koeficient. Za natančno določitev cone
                      uporabite uradno kartno podlago ZGS.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* ===== STEKLENA BALUSTRADA CALCULATOR ===== */}
      {mode === 'glass' && (
        <>
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                <Square aria-hidden="true" className="h-4 w-4" />
                Steklena balustrada — poenostavljena metoda
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="glassSpan" className="text-xs">Razpon med stebri (mm)</Label>
                  <Input
                    id="glassSpan"
                    type="number"
                    value={String(glassInput.spanMm)}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      setGlassInput({ ...glassInput, spanMm: isFinite(v) ? v : 0 })
                    }}
                    placeholder="1200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="glassHeight" className="text-xs">Višina stekla (mm)</Label>
                  <Input
                    id="glassHeight"
                    type="number"
                    value={String(glassInput.heightMm)}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      setGlassInput({ ...glassInput, heightMm: isFinite(v) ? v : 0 })
                    }}
                    placeholder="1100"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Horizontalna obremenitev (kN/m)</Label>
                <Select
                  value={String(glassInput.loadKnPerM)}
                  onValueChange={(v) => setGlassInput({ ...glassInput, loadKnPerM: parseFloat(v) })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1.0">1,0 kN/m — Stanovanjske</SelectItem>
                    <SelectItem value="1.5">1,5 kN/m — Javne</SelectItem>
                    <SelectItem value="2.0">2,0 kN/m — Balkon &gt; 1m padec</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tip stekla</Label>
                <Select
                  value={glassInput.glassType}
                  onValueChange={(v) => setGlassInput({ ...glassInput, glassType: v as GlassType })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Enojno (float) — 40 MPa</SelectItem>
                    <SelectItem value="laminated">Laminirano (VSG) — 50 MPa</SelectItem>
                    <SelectItem value="tempered">Kaljeno (ESG) — 120 MPa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={handleCalculate}
              className="w-full bg-roksal-navy hover:bg-roksal-navy/90 text-white h-11"
            >
              <Square aria-hidden="true" className="mr-2 h-4 w-4" />
              Izračunaj steklo
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => exportGlassPdf({ glassResult, glassInput, projectName })}
              disabled={!glassResult}
              className="w-full h-11 border-roksal-amber/40 text-roksal-ink hover:bg-roksal-amber/10 disabled:opacity-40"
            >
              <FileDown aria-hidden="true" className="mr-2 h-4 w-4" />
              Izvozi PDF
            </Button>
          </div>

          {glassResult && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Recommended thickness */}
              <Card className={`overflow-hidden border-l-4 ${glassResult.isSafe ? 'border-l-roksal-green bg-roksal-green/5' : 'border-l-roksal-red bg-roksal-red/5'}`}>
                <CardContent className="flex items-center gap-3 p-4">
                  {glassResult.isSafe ? (
                    <CheckCircle2 aria-hidden="true" className="h-8 w-8 shrink-0 text-roksal-green" />
                  ) : (
                    <AlertTriangle aria-hidden="true" className="h-8 w-8 shrink-0 text-roksal-red" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-2xs text-muted-foreground uppercase tracking-wide">Priporočena debelina</p>
                    <p className="text-3xl font-bold text-roksal-ink">
                      {glassResult.recommendedThicknessMm}<span className="text-base font-normal ml-1">mm</span>
                    </p>
                    <p className="text-2xs text-muted-foreground">
                      {glassResult.layers
                        ? `Laminirano: 2× ${glassResult.recommendedThicknessMm / 2}mm + PVB`
                        : glassInput.glassType === 'tempered'
                        ? 'Kaljeno steklo (ESG)'
                        : 'Enojno steklo (float)'}
                    </p>
                  </div>
                  <Badge className={`${glassResult.isSafe ? 'bg-roksal-green/15 text-roksal-green border-roksal-green/30' : 'bg-roksal-red/15 text-roksal-red border-roksal-red/30'} border`}>
                    {glassResult.isSafe ? 'VARNO' : 'NEVARNO'}
                  </Badge>
                </CardContent>
              </Card>

              {/* Stress stats */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="px-3 py-3">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">Napetost</p>
                  <p className="text-xl font-bold text-roksal-ink">{glassResult.stressMpa.toFixed(1)}</p>
                  <p className="text-2xs text-muted-foreground">MPa</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">Dovoljena</p>
                  <p className="text-xl font-bold text-roksal-ink">{glassResult.allowableStressMpa}</p>
                  <p className="text-2xs text-muted-foreground">MPa</p>
                </Card>
                <Card className="px-3 py-3">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">Max razpon</p>
                  <p className="text-xl font-bold text-roksal-ink">{glassResult.maxSpanForThicknessMm}</p>
                  <p className="text-2xs text-muted-foreground">mm</p>
                </Card>
              </div>

              {/* Glass layers SVG (only for laminated) */}
              {glassResult.layers === 2 && (
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                      <Layers aria-hidden="true" className="h-4 w-4" />
                      Plasti laminiranega stekla
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <GlassLayersSvg
                      totalMm={glassResult.recommendedThicknessMm}
                      baseMm={glassResult.recommendedThicknessMm / 2}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Alternative thicknesses table */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                    <AlignJustify aria-hidden="true" className="h-4 w-4" />
                    Alternativne debeline
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="overflow-x-auto scrollbar-thin">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-2xs">Debelina</TableHead>
                          <TableHead className="text-2xs">Status</TableHead>
                          <TableHead className="text-2xs">Razlog</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {glassResult.alternativeThicknesses.map((a) => (
                          <TableRow key={a.mm}>
                            <TableCell className="text-xs font-mono font-semibold">{a.mm}mm</TableCell>
                            <TableCell>
                              {a.safe ? (
                                <Badge className="bg-roksal-green/15 text-roksal-green border-roksal-green/30 border text-[9px]">VARNO</Badge>
                              ) : (
                                <Badge className="bg-roksal-amber/15 text-roksal-ink border-roksal-amber/30 border text-[9px]">Tveganje</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-2xs text-muted-foreground">{a.reason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Warnings */}
              {glassResult.warnings.length > 0 && (
                <Card className="border-roksal-amber/30">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-amber">
                      <AlertTriangle aria-hidden="true" className="h-4 w-4" />
                      Opozorila
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <ul className="space-y-1.5">
                      {glassResult.warnings.map((w, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <AlertTriangle aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 text-roksal-amber" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Recommendations */}
              {glassResult.recommendations.length > 0 && (
                <Card className="border-roksal-navy/20 dark:border-roksal-ink/20">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                      <Info aria-hidden="true" className="h-4 w-4" />
                      Priporočila
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <ul className="space-y-1.5">
                      {glassResult.recommendations.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 text-roksal-green" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-roksal-navy/5">
                <CardContent className="flex gap-3 p-4">
                  <Info aria-hidden="true" className="h-5 w-5 shrink-0 text-roksal-ink" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-roksal-ink">
                      Poenostavljena metoda (SIST EN)
                    </p>
                    <p className="mt-1">
                      Napetost ≈ (obremenitev × razpon² × 6) / (debelina² × 8). Dovoljene napetosti:
                      enojno 40 MPa, laminirano (VSG) 50 MPa, kaljeno (ESG) 120 MPa. Za končno
                      dimenzioniranje je obvezna statična analiza z certifikatom proizvajalca stekla.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Save Calculation Button */}
      {(railingResult || anchoringResult || windResult || balusterResult || angledResult || materialResult || complianceResult || cncResult || windLocResult || glassResult) && (
        <Button
          type="button"
          onClick={() => {
            // R347 FAZA 7: EN VIR — prej stale inline kopija (starejši formati:
            // baluster brez rezerve, material z toFixed(2)€, cnc brez ostanka;
            // zdaj ISTA resnica kot zgodovina prek modulov).
            const keyResult = getCurrentKeyResult(mode, rezultatiNacinov())
            const inputs = collectCurrentInputs(mode, vhodnaStanja())
            const newCalc: SavedCalculation = {
              id: `calc_${Date.now()}`,
              date: new Date().toISOString(),
              mode,
              modeLabel: modeLabels[mode],
              keyResult,
              inputs,
            }
            const updated = [newCalc, ...savedCalculations]
            setSavedCalculations(updated)
            try {
              localStorage.setItem('roksal-saved-calculations', JSON.stringify(updated))
            } catch {
              // ignore
            }
            toast.success('Izračun shranjen')
          }}
          className="w-full bg-roksal-navy hover:bg-roksal-navy/90 text-white h-11 transition-all duration-200"
          aria-label="Shrani trenutni izračun v shranjene izračune"
          title="Shrani trenutni izračun z vsemi vnosi načina"
        >
          <Save aria-hidden="true" className="mr-2 h-4 w-4" />
          Shrani izračun
        </Button>
      )}

      {/* Saved Calculations Section */}
      {savedCalculations.length > 0 && (
        <Card className="card-hover transition-all duration-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-roksal-ink">
                <Clock aria-hidden="true" className="h-4 w-4" />
                Shranjeni izračuni
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-2xs text-roksal-red hover:text-roksal-red hover:bg-roksal-red/10"
                onClick={() => {
                  setSavedCalculations([])
                  try { localStorage.removeItem('roksal-saved-calculations') } catch { /* ignore */ }
                  toast.success('Vsi izračuni počiščeni')
                }}
                aria-label="Počisti vse shranjene izračune"
                title="Pobriši celoten seznam shranjenih izračunov"
              >
                <Trash2 aria-hidden="true" className="mr-1 h-3 w-3" />
                Počisti vse
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
              {savedCalculations.map((calc) => (
                <button
                  key={calc.id}
                  onClick={() => {
                    // R347 FAZA 7: EN VIR applyInputs — prej stale inline blok
                    // SAMO za railing/anchoring/wind (ostalih 7 načinov = tih
                    // no-op z toastom, brez nalaganja!); zdaj vsi 10 načinov,
                    // konsistentno z nalaganjem zgodovine.
                    setMode(calc.mode)
                    applyInputs(calc.mode, calc.inputs, nastavljalci())
                    toast.info(`Izračun "${calc.modeLabel}" naložen`)
                  }}
                  aria-label={`Naloži shranjeni izračun: ${calc.modeLabel}, ${calc.keyResult}`}
                  className="flex w-full items-center justify-between rounded-lg border border-border/50 p-3 transition-colors hover:bg-secondary/30 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-2xs h-5 px-1.5 shrink-0">
                        {calc.modeLabel}
                      </Badge>
                      <span className="text-2xs text-muted-foreground">
                        {slMesecevaOkrajsava(new Date(calc.date))}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs font-medium text-roksal-ink">
                      {calc.keyResult}
                    </p>
                  </div>
                  <RotateCcw aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground ml-2" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* P2: Zgodovina izračunov (collapsible) */}
      <Card>
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  aria-expanded={historyOpen}
                  className="flex items-center gap-2 rounded-lg text-sm font-semibold text-roksal-ink hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1"
                >
                  <History aria-hidden="true" className="h-4 w-4 text-roksal-amber" />
                  Zgodovina izračunov
                  <Badge variant="secondary" className="text-2xs h-5 px-1.5 tabular-nums">{history.length}</Badge>
                  {historyOpen ? <ChevronUp aria-hidden="true" className="h-3.5 w-3.5" /> : <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />}
                </button>
              </CollapsibleTrigger>
              {history.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-2xs text-roksal-ink hover:text-roksal-ink hover:bg-roksal-navy/5 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:border-roksal-navy/40 dark:focus-visible:border-roksal-ink/40"
                    onClick={exportHistoryCsv}
                    aria-label="Izvozi zgodovino izračunov kot CSV datoteka"
                    title="Izvoz zgodovine izračunov kot CSV datoteka"
                  >
                    <FileSpreadsheet aria-hidden="true" className="mr-1 h-3 w-3" />
                    Izvozi CSV
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-2xs text-roksal-red hover:text-roksal-red hover:bg-roksal-red/10"
                    onClick={clearHistory}
                    aria-label="Počisti zgodovino izračunov"
                    title="Pobriši celotno zgodovino izračunov"
                  >
                    <Trash2 aria-hidden="true" className="mr-1 h-3 w-3" />
                    Počisti
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="px-4 pb-4">
              {history.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  <History aria-hidden="true" className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>Zgodovina je prazna.</p>
                  <p className="text-2xs mt-1">Kliknite "Izračunaj" v kateremkoli načinu, da se izračun samodejno shrani.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
                  {history.map((entry) => {
                    const Icon = historyModeIcon[entry.mode]
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => loadFromHistory(entry)}
                        aria-label={`Naloži izračun: ${entry.modeLabel}, ${entry.keyResult}`}
                        title={`${entry.modeLabel} — ${entry.keyResult}`}
                        className="flex w-full items-start gap-3 rounded-lg border border-border/50 p-3 transition-colors hover:bg-secondary/30 hover:border-roksal-navy/30 dark:hover:border-roksal-ink/30 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:border-roksal-navy/40 dark:focus-visible:border-roksal-ink/40"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-roksal-navy/10">
                          <Icon className="h-4 w-4 text-roksal-ink" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-roksal-navy/5 border-roksal-navy/20 dark:border-roksal-ink/20 text-roksal-ink">
                              {entry.modeLabel}
                            </Badge>
                            <span className="text-[9px] text-muted-foreground tabular-nums">
                              {slMesecevaOkrajsavaUra(new Date(entry.timestamp))}
                            </span>
                            {entry.projectName && (
                              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-roksal-amber/10 text-roksal-amber border-roksal-amber/20">
                                {entry.projectName}
                              </Badge>
                            )}
                            {/* R150: prstni odtis izračuna (samo novejši vnoski — starejši ostanejo brez, iskreno) */}
                            {entry.formulaVersion && entry.inputHash && (
                              <Badge
                                variant="outline"
                                title="Prstni odtis izračuna — verzija formule in hash vhodov za reproducibilnost (R150)"
                                className="text-[9px] h-4 px-1.5 font-mono tabular-nums bg-secondary/50 text-muted-foreground border-border cursor-help"
                              >
                                {entry.formulaVersion}·{entry.inputHash}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-xs font-medium text-roksal-ink">
                            {entry.keyResult}
                          </p>
                        </div>
                        <RotateCcw aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground ml-2 mt-1" />
                      </button>
                    )
                  })}
                </div>
              )}
              {history.length > 0 && (
                <p className="mt-2 text-2xs text-muted-foreground text-center">
                  Prikaže se zadnjih {history.length} {history.length === 1 ? 'izračun' : history.length < 5 ? 'izračune' : 'izračunov'} (max {MAX_ZGODOVINA}).
                </p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  )
}
