#!/usr/bin/env python3
# r345-faza5-apply.py — FAZA 5: dispatch logika 10 načinov → calculator/calculations.ts
# Exact-match replacements; vsak pričakovani števec mori proces, če ni točen (kanon R310).
import sys

TAB = "src/components/roksal/calculator-tab.tsx"

with open(TAB, "r", encoding="utf-8") as f:
    src = f.read()

def rep(s, old, new, expected):
    n = s.count(old)
    if n != expected:
        print(f"FAIL: pričakovano {expected}, najdeno {n} za: {old[:90]!r}")
        sys.exit(1)
    return s.replace(old, new)

# ── 1) Import: odstrani calc-engineering blok (run*V1 gre v calculations.ts)
src = rep(src,
"""import {
  runRailingCalcV1,
  runAnchoringCalcV1,
  runWindCalcV1,
} from '@/lib/calc-engineering'
""",
"", 1)

# ── 2) Import: odstrani 7 izračunskih funkcij iz lib/calculator bloka (tipi OSTANEJO)
# (vrstice so razpršene med druge uvoze — odstranjujem posamezno, vsaka natanko 1×)
for _line in [
    "  calculateEqualSpacing,\n",
    "  calculateAngledSpacing,\n",
    "  calculateMaterialTotal,\n",
    "  checkCompliance,\n",
    "  calculateCncCutting,\n",
    "  calculateWindByLocation,\n",
    "  calculateGlassBalustrade,\n",
]:
    src = rep(src, _line, "", 1)

# ── 3) Import: nov blok za calculations.ts (za pdf-exports blokom)
src = rep(src,
"""  type CncSegment,
  type GlassType,
} from './calculator/pdf-exports'
""",
"""  type CncSegment,
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
""",
1)

# ── 4) Veriga dispatchev ×2 → EN VIR klic (najprej oba telesa zamenjaj,
#      ŠELE nato vstavi pomožno funkcijo — vrstni red je pogodba)
CHAIN = """    if (mode === 'railing') {
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
"""
if src.count(CHAIN) != 2:
    print(f"FAIL: veriga = {src.count(CHAIN)} (pričakovano 2)"); sys.exit(1)
src = src.replace(CHAIN, "    izvediIzracunZaAktivniNacin()\n", 1)  # handleCalculate (1. pojavitev)
if src.count(CHAIN) != 1:
    print("FAIL: po 1. zamenjavi veriga ni 1"); sys.exit(1)
src = src.replace(CHAIN, "    izvediIzracunZaAktivniNacin()\n", 1)  # auto-calc useEffect (2.)
if CHAIN in src:
    print("FAIL: veriga še vedno prisotna po 2 zamenjavah"); sys.exit(1)

HELPER = """  // R345 FAZA 5: EN VIR veriga dispatchev — prej 2× podvojen if/else blok
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
"""
src = rep(src,
"""  function handleCalculate() {
""",
HELPER, 1)

# ── 5) Dispatch telesa → tanke ovojnice (state zapisi ostanejo v komponenti)

src = rep(src,
"""  function calculateRailingClientSide() {
    // R150: inženirska ovojnica — fail-closed validacija (izven območja
    // umerjenosti → eksplicitne napake, NIČ rezultata) + prstni odtis.
    const L = parseFloat(effectiveTotalLength) * 1000
    const W = parseFloat(slatWidth)
    const G = parseFloat(maxGap)
    const envelope = runRailingCalcV1({
      totalLengthMm: L,
      slatWidthMm: W,
      maxGapMm: G,
      profileType,
    })
    if (!envelope.ok) {
      setEngineeringErrors(envelope.errors)
      return
    }
    setLastFingerprint({ formulaVersion: envelope.formulaVersion, inputHash: envelope.inputHash })
    setRailingResult(envelope.result)
  }
""",
"""  function calculateRailingClientSide() {
    // R345 FAZA 5: parsanje + ovonjica R150 v calculator/calculations.ts (args objekti).
    const envelope = dispatchRailing({ totalLength: effectiveTotalLength, slatWidth, maxGap, profileType })
    if (!envelope.ok) {
      setEngineeringErrors(envelope.errors)
      return
    }
    setLastFingerprint({ formulaVersion: envelope.formulaVersion, inputHash: envelope.inputHash })
    setRailingResult(envelope.result)
  }
""", 1)

src = rep(src,
"""  function calculateAnchoringClientSide() {
    // R150: inženirska ovojnica — fail-closed validacija + prstni odtis.
    const hc = parseInt(holeCount)
    const depth = parseFloat(holeDepthMm)
    const dia = parseFloat(holeDiameterMm)
    const temp = parseFloat(temperature)
    const envelope = runAnchoringCalcV1({
      holeCount: hc,
      holeDepthMm: depth,
      holeDiameterMm: dia,
      temperature: temp,
      anchorType,
    })
    if (!envelope.ok) {
      setEngineeringErrors(envelope.errors)
      return
    }
    setLastFingerprint({ formulaVersion: envelope.formulaVersion, inputHash: envelope.inputHash })
    setAnchoringResult(envelope.result)
  }
""",
"""  function calculateAnchoringClientSide() {
    // R345 FAZA 5: parsanje + ovonjica R150 v calculator/calculations.ts (args objekti).
    const envelope = dispatchAnchoring({ holeCount, holeDepthMm, holeDiameterMm, temperature, anchorType })
    if (!envelope.ok) {
      setEngineeringErrors(envelope.errors)
      return
    }
    setLastFingerprint({ formulaVersion: envelope.formulaVersion, inputHash: envelope.inputHash })
    setAnchoringResult(envelope.result)
  }
""", 1)

src = rep(src,
"""  function calculateWindClientSide() {
    // R150: inženirska ovojnica — višina 0 m (prej tiho LOW tveganje!),
    // negativna/neskončna hitrost in nesmiselna površina so ZDAJ eksplicitne
    // napake, ne tihi rezultat.
    const h = parseFloat(heightAboveGround)
    const ws = parseFloat(windSpeedMs)
    const area = parseFloat(railingAreaM2)
    const envelope = runWindCalcV1({
      heightAboveGround: h,
      terrainCategory,
      windSpeedMs: ws,
      railingAreaM2: area,
      railingType,
    })
    if (!envelope.ok) {
      setEngineeringErrors(envelope.errors)
      return
    }
    setLastFingerprint({ formulaVersion: envelope.formulaVersion, inputHash: envelope.inputHash })
    setWindResult(envelope.result)
  }
""",
"""  function calculateWindClientSide() {
    // R345 FAZA 5: parsanje + ovonjica R150 v calculator/calculations.ts (args objekti).
    const envelope = dispatchWind({ heightAboveGround, terrainCategory, windSpeedMs, railingAreaM2, railingType })
    if (!envelope.ok) {
      setEngineeringErrors(envelope.errors)
      return
    }
    setLastFingerprint({ formulaVersion: envelope.formulaVersion, inputHash: envelope.inputHash })
    setWindResult(envelope.result)
  }
""", 1)

src = rep(src,
"""  function calculateBalusterClientSide() {
    const L = parseFloat(balTotalLength) * 1000
    const W = parseFloat(balWidth)
    const G = parseFloat(balMaxGap)
    if (!isFinite(L) || !isFinite(W) || !isFinite(G) || L <= 0 || W <= 0 || G <= 0) {
      setBalusterResult(null)
      return
    }
    const result = calculateEqualSpacing({
      totalLengthMm: L,
      balusterWidthMm: W,
      maxGapMm: G,
    })
    setBalusterResult(result)
  }
""",
"""  function calculateBalusterClientSide() {
    // R345 FAZA 5: parsanje + guard v calculator/calculations.ts (args objekti).
    setBalusterResult(dispatchBaluster({ balTotalLength, balWidth, balMaxGap }))
  }
""", 1)

src = rep(src,
"""  function calculateAngledClientSide() {
    const L = parseFloat(angHorizontalLength) * 1000
    const angle = parseFloat(angRakeAngle)
    const W = parseFloat(angWidth)
    const G = parseFloat(angMaxGap)
    if (!isFinite(L) || !isFinite(angle) || !isFinite(W) || !isFinite(G) || L <= 0 || W <= 0 || G <= 0) {
      setAngledResult(null)
      return
    }
    const result = calculateAngledSpacing({
      horizontalLengthMm: L,
      rakeAngleDeg: angle,
      balusterWidthMm: W,
      maxGapMm: G,
    })
    setAngledResult(result)
  }
""",
"""  function calculateAngledClientSide() {
    // R345 FAZA 5: parsanje + guard v calculator/calculations.ts (args objekti).
    setAngledResult(dispatchAngled({ angHorizontalLength, angRakeAngle, angWidth, angMaxGap }))
  }
""", 1)

src = rep(src,
"""  function calculateMaterialClientSide() {
    if (segments.length === 0) {
      setMaterialResult(null)
      return
    }
    const result = calculateMaterialTotal({
      segments,
      profileSifra: selectedProfileSifra,
      profili,
    })
    setMaterialResult(result)
  }
""",
"""  function calculateMaterialClientSide() {
    // R345 FAZA 5: guard + izračun v calculator/calculations.ts (args objekti).
    setMaterialResult(dispatchMaterial({ segments, profileSifra: selectedProfileSifra, profili }))
  }
""", 1)

src = rep(src,
"""  function calculateComplianceClientSide() {
    const gap = parseFloat(compGap)
    const height = parseFloat(compHeight)
    const spacing = parseFloat(compPostSpacing)
    const drop = parseFloat(compDropHeight) || 0
    if (!isFinite(gap) || !isFinite(height) || !isFinite(spacing)) {
      setComplianceResult(null)
      return
    }
    const result = checkCompliance({
      gapMm: gap,
      heightMm: height,
      postSpacingMm: spacing,
      loadCategory: compLoadCategory,
      dropHeightMm: drop,
    })
    setComplianceResult(result)
  }
""",
"""  function calculateComplianceClientSide() {
    // R345 FAZA 5: parsanje + guard v calculator/calculations.ts (args objekti).
    setComplianceResult(dispatchCompliance({ compGap, compHeight, compPostSpacing, compLoadCategory, compDropHeight }))
  }
""", 1)

src = rep(src,
"""  function calculateCncClientSide() {
    const stock = parseFloat(cncStockLength)
    const blade = parseFloat(cncSawBlade)
    if (!isFinite(stock) || stock <= 0) {
      setCncResult(null)
      return
    }
    const segments = cncSegments
      .filter((s) => s.lengthMm && s.count)
      .map((s) => ({
        lengthMm: parseFloat(s.lengthMm) || 0,
        count: parseInt(s.count) || 0,
        label: s.label || undefined,
      }))
      .filter((s) => s.lengthMm > 0 && s.count > 0)
    if (segments.length === 0) {
      setCncResult(null)
      return
    }
    const result = calculateCncCutting({
      segments,
      stockLengthMm: stock,
      sawBladeWidthMm: isFinite(blade) ? blade : 3,
    })
    setCncResult(result)
  }
""",
"""  function calculateCncClientSide() {
    // R345 FAZA 5: parsanje + guard + preslikava segmentov v calculator/calculations.ts (args objekti).
    setCncResult(dispatchCnc({ cncStockLength, cncSawBlade, cncSegments }))
  }
""", 1)

src = rep(src,
"""  function calculateWindLocClientSide() {
    const lat = parseFloat(windLocLat)
    const lon = parseFloat(windLocLon)
    const h = parseFloat(windLocHeight)
    const area = parseFloat(windLocArea)
    if (!isFinite(lat) || !isFinite(lon) || !isFinite(h) || !isFinite(area)) {
      setWindLocResult(null)
      return
    }
    const result = calculateWindByLocation({
      latitude: lat,
      longitude: lon,
      heightAboveGround: h,
      terrainCategory: windLocTerrain,
      railingAreaM2: area,
      railingType: windLocType,
    })
    setWindLocResult(result)
  }
""",
"""  function calculateWindLocClientSide() {
    // R345 FAZA 5: parsanje + guard v calculator/calculations.ts (args objekti).
    setWindLocResult(dispatchWindLocation({ windLocLat, windLocLon, windLocHeight, windLocTerrain, windLocArea, windLocType }))
  }
""", 1)

src = rep(src,
"""  function calculateGlassClientSide() {
    if (
      !isFinite(glassInput.spanMm) ||
      !isFinite(glassInput.heightMm) ||
      !isFinite(glassInput.loadKnPerM) ||
      glassInput.spanMm <= 0
    ) {
      setGlassResult(null)
      return
    }
    const result = calculateGlassBalustrade(glassInput)
    setGlassResult(result)
  }
""",
"""  function calculateGlassClientSide() {
    // R345 FAZA 5: guard + izračun v calculator/calculations.ts (args objekti).
    setGlassResult(dispatchGlass(glassInput))
  }
""", 1)

# ── 6) Struktura: pomožnica natanko 1× definacija + 2× klic; dispatchi = uvoz 1× + klic 1×
if src.count("function izvediIzracunZaAktivniNacin()") != 1:
    print("FAIL: pomožnica ni natanko 1×"); sys.exit(1)
if src.count("izvediIzracunZaAktivniNacin()") != 3:  # 1 definicija + 2 klica
    print(f"FAIL: pomožnica pojavitvij = {src.count('izvediIzracunZaAktivniNacin()')} (pričakovano 3)"); sys.exit(1)
for d in ["dispatchRailing", "dispatchAnchoring", "dispatchWind,", "dispatchBaluster", "dispatchAngled",
          "dispatchMaterial,", "dispatchCompliance", "dispatchCnc,", "dispatchWindLocation", "dispatchGlass"]:
    ime = d.rstrip(",")
    if src.count(f"  {ime},\n") != 1:
        print(f"FAIL: uvoz vrstica {ime} = {src.count(f'  {ime},\\n')} (pričakovano 1)"); sys.exit(1)
for d in ["dispatchRailing(", "dispatchAnchoring(", "dispatchWind(", "dispatchBaluster(",
          "dispatchAngled(", "dispatchMaterial(", "dispatchCompliance(", "dispatchCnc(",
          "dispatchWindLocation(", "dispatchGlass("]:
    if src.count(d) != 1:
        print(f"FAIL: klic {d} = {src.count(d)} (pričakovano 1)"); sys.exit(1)
if "runRailingCalcV1" in src or "runAnchoringCalcV1" in src or "runWindCalcV1" in src:
    print("FAIL: run*V1 še v tabu"); sys.exit(1)
if "calculateEqualSpacing" in src or "calculateCncCutting" in src or "calculateGlassBalustrade" in src:
    print("FAIL: izračunska jedra še v tabu"); sys.exit(1)

with open(TAB, "w", encoding="utf-8") as f:
    f.write(src)

lines = src.count("\n") + 1
print(f"OK: FAZA 5 aplicirana — tab zdaj {lines} vrstic")
