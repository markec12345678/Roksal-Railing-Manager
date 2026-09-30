#!/usr/bin/env python3
# R325 — kirurška dekompozicija calculator-tab.tsx FAZA 2 (PDF izvozi).
# Fail-closed: vsak korak preveri marker pred spremembo; napaka = izstop 1.
import sys

PATH = '/home/z/repo-analysis/src/components/roksal/calculator-tab.tsx'
src = open(PATH, encoding='utf-8').read()
lines = src.split('\n')
orig_count = len(lines)

def odstrani_prvo(niz, opis):
    global src
    if src.count(niz) != 1:
        print(f'FAIL-CLOSED: marker ni unikaten ali manjka — {opis} (najdenov: {src.count(niz)})')
        sys.exit(1)
    src = src.replace(niz, '', 1)
    print(f'OK: odstranjeno — {opis}')

def zamenjaj_unikat(star, nov, opis):
    global src
    if src.count(star) != 1:
        print(f'FAIL-CLOSED: marker ni unikaten — {opis} (najdenov: {src.count(star)})')
        sys.exit(1)
    src = src.replace(star, nov, 1)
    print(f'OK: zamenjano — {opis}')

# 1) odstrani jsPDF + autoTable uvoza (osirotela po premiku)
odstrani_prvo("import jsPDF from 'jspdf'\nimport autoTable from 'jspdf-autotable'\n", 'jsPDF+autoTable uvoza')

# 2) dodaj pdf-exports uvoz za GlassLayersSvg uvozom
zamenjaj_unikat(
    "import { GlassLayersSvg } from './calculator/glass-layers-svg'\n",
    "import { GlassLayersSvg } from './calculator/glass-layers-svg'\n"
    "// R323 — dekompozicija calculator-tab FAZA 2: PDF izvozi (5 funkcij —\n"
    "// predloga vrtanja / materialni list / razrezni list CNC / vetrno\n"
    "// poročilo / steklena balustrada) izluščeni v ./calculator/pdf-exports\n"
    "// (telesa VERBATIM; closure dostop do stanja → eksplicitni args objekti).\n"
    "import {\n"
    "  exportBalusterPdf,\n"
    "  exportMaterialPdf,\n"
    "  exportCncPdf,\n"
    "  exportWindLocPdf,\n"
    "  exportGlassPdf,\n"
    "  type CncSegment,\n"
    "  type GlassType,\n"
    "} from './calculator/pdf-exports'\n",
    'pdf-exports uvoz')

# 3) odstrani tip CncSegment iz telesa komponente (preseljen v pdf-exports)
zamenjaj_unikat(
    "  type CncSegment = { lengthMm: string; count: string; label: string }\n",
    "  // R323 — tip CncSegment preseljen v calculator/pdf-exports.ts (stanje + PDF + JSX).\n",
    'CncSegment tip')

# 4) odstrani tip GlassType iz telesa komponente (preseljen v pdf-exports)
zamenjaj_unikat(
    "  type GlassType = 'single' | 'laminated' | 'tempered'\n",
    "  // R323 — tip GlassType preseljen v calculator/pdf-exports.ts (stanje + PDF + JSX).\n",
    'GlassType tip')

# 5) odstrani blok 5 PDF funkcij — od začetnega markerja do končnega markerja
start_marker = "  // ===== PDF: Baluster drilling template =====\n"
end_marker = "  // Generate cut list positions\n"
si = src.find(start_marker)
ei = src.find(end_marker)
if si == -1 or ei == -1 or ei <= si:
    print(f'FAIL-CLOSED: PDF blok markerji (start={si}, end={ei})')
    sys.exit(1)
blok = src[si:ei]
# varnostna preverba: blok mora vsebovati VSEH 5 funkcij in NIČ drugega velikega
for fn in ['exportBalusterPdf', 'exportMaterialPdf', 'exportCncPdf', 'exportWindLocPdf', 'exportGlassPdf']:
    if f'function {fn}()' not in blok:
        print(f'FAIL-CLOSED: v PDF bloku manjka {fn}')
        sys.exit(1)
if 'function getCutList' in blok or 'calculateRailingClientSide' in blok:
    print('FAIL-CLOSED: PDF blok zajema preveč (getCutList/kalkulatorji)')
    sys.exit(1)
src = src[:si] + src[ei:]
print(f'OK: odstranjenih {blok.count(chr(10))} vrstic PDF bloka (5 funkcij)')

# 6) posodobi 5 klicnih mest (args objekti namesto closure)
zamenjaj_unikat(
    "onClick={exportBalusterPdf}",
    "onClick={() => exportBalusterPdf({ balusterResult, balTotalLength, balWidth, balMaxGap, rezervaPctBaluster })}",
    'klicno mesto exportBalusterPdf')

zamenjaj_unikat(
    "onClick={exportMaterialPdf}",
    "onClick={() => exportMaterialPdf({ materialResult, projectName, rezervaPctMaterial, urnaPostavka, stUr, stMonterjev, transport, ddvPct, akontacijaPct, importedFromMeasurement })}",
    'klicno mesto exportMaterialPdf')

zamenjaj_unikat(
    "onClick={exportCncPdf}",
    "onClick={() => exportCncPdf({ cncResult, cncStockLength, cncSawBlade, cncSegments, projectName })}",
    'klicno mesto exportCncPdf')

zamenjaj_unikat(
    "onClick={exportWindLocPdf}",
    "onClick={() => exportWindLocPdf({ windLocResult, windLocLat, windLocLon, windLocHeight, windLocTerrain, windLocArea, windLocType, projectName })}",
    'klicno mesto exportWindLocPdf')

zamenjaj_unikat(
    "onClick={exportGlassPdf}",
    "onClick={() => exportGlassPdf({ glassResult, glassInput, projectName })}",
    'klicno mesto exportGlassPdf')

open(PATH, 'w', encoding='utf-8').write(src)
new_count = len(src.split('\n'))
print(f'\nVRSTICE: {orig_count} → {new_count} (−{orig_count - new_count})')
print('USPEH — calculator-tab.tsx FAZA 2 dekompozicija zaključena')
