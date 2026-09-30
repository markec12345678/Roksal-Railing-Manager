#!/usr/bin/env python3
# R325 — derive r325-build-needles.sh iz r322-build-needles.sh (nadaljevanje
# prirojene runde po vzorcu R319/R322 — dekompozicija FAZA 2; KOLIZIJA #5:
# vzporedna seja je vzela R323 [8857d6e CSV] — runda preimenovana R323→R324,
# artefakti r323-*→r324-*, DELEGACIJA preklopljena na NJIHOV r323-build-needles
# [pokriva R323 CSV + R322 inline + verigo r321→…→R227]).
# NATANKO ena-n-točkovne zamenjave — fail-closed; štetje na POJAVITVE.
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r322-build-needles.sh')
DOL = Path('/home/z/my-project/scripts/r325-build-needles.sh')

s = VIR.read_text(encoding='utf-8')

def zam(staro: str, novo: str, pricakuj: int) -> None:
    global s
    n = s.count(staro)
    if n != pricakuj:
        print(f'FAIL: vzorec {n}× (pričakovano {pricakuj}): {staro[:70]!r}')
        raise SystemExit(1)
    s = s.replace(staro, novo)
    print(f'  OK {pricakuj}× {staro[:56]}')

zam('# R322 — build needleji: DEKOMPOZICIJA calculator-tab FAZA 1 + R254 SLEPA\n# PEGA ZAPRTA (KOLIZIJA: vzporedna seja je vzela R321 [43f3f7e, 50. člen\n# zmogljivost PDF] — moja runda preimenovana R321→R322 po kanonu LEKCIJA 1\n# vzporednih sej; RE-DERIVIRANA QA družina iz vzporedne r321 — delegacija\n# podeduje njihove needleje + verigo).',
    '# R324 — build needleji: DEKOMPOZICIJA FAZA 2 (measurements + calculator —\n# nadaljevanje odobrene Roadmap "razbitje monsterskih komponent", vzorec\n# R319 faza 1 / R322 calculator faza 1; KOLIZIJA #5: vzporedna seja je\n# vzela R323 [8857d6e, 51. člen zmogljivost CSV] — runda preimenovana\n# R323→R324 po kanonu LEKCIJA 1; RE-DERIVIRANA delegacija iz vzporedne\n# r323 generacije — podeduje njihove CSV needleje + verigo):', 1)
zam('#   (a) DEKOMPOZICIJA calculator-tab (faza 1, kanon R319 measurements faza\n#       1): 6.074 → 5.372 vrstic (−702); NOV mapa src/components/roksal/\n#       calculator/ ×5 datotek/762 vrstic: shared.ts (tipi CalcMode/\n#       ProfileType/AnchorType/TerrainCategory/RailingType + 7 interfejsov +\n#       15 konstant VERBATIM + export; dvig importov na vrh = struktura, ne\n#       vsebina) + 4 SVG diagrami (BalusterSvg/AngledSvg/SloveniaWindMapSvg/\n#       GlassLayersSvg — ČIST PREMIK bajtno identično, edina sprememba\n#       export; brez use client — client drevo). lucide uvozi ostajajo\n#       (vseh 10 ikon v rabi TUDI v glavni komponenti).',
    '#   (a) MEASUREMENTS-TAB FAZA 2 (lastniška prioriteta #1 laserski BT blok +\n#       #2 template localStorage blok): 7.604 → 7.153 vrstic (−451); NOV\n#       v src/components/roksal/measurements/ ×4 datotek/594 vrstic:\n#       laser-bt.ts (Web Bluetooth tipi + LASER konstante + 3 pomožne —\n#       ČIST PREMIK bajtno identično, edina sprememba export) +\n#       use-laser.ts (stanje + GATT povezava + odklop + auto-reconnect —\n#       REFAKTOR: edina semantična sprememba = polnjenje forme prek\n#       onMeasurement povratnega klica namesto neposrednih setState;\n#       + mikrotask vzorec PwaStatus za začetna branja — omejitev pravila\n#       react-hooks/set-state-in-effect, prej skrito z bailoutom compiler\n#       analize na 7,6k vrstični datoteki) + laser-panel.tsx (UI blok — ČIST\n#       PREMIK s props) + templates.ts (PREDLOGE + StairTemplate/StairCalc +\n#       WPC konstante + loadStairTemplates/saveStairTemplates — ČIST PREMIK).\n#       Osiroteli lucide uvozi odstranjeni (Bluetooth/Radio/Unplug — preverjeno\n#       s štetjem POJAVITVE, kanon R322).', 1)
zam('#   (b) R254 SLEPA PEGA ZAPRTA (odkrita v R319 pri dekompoziciji\n#       measurements, izboljšava odložena kot kandidat — R322 izvedena):\n#       vejica v uvoznem komentarju je razdelila import blok pri split(\',\')\n#       → ikona NEVIDNA detektorju. Trojni popravek (detektor + codemod +\n#       vitest stražar — enaka logika v treh virih, kanon ENA resnica):\n#       strip // komentarjev PRED split. NOVO VIDNE ikone: 8 (5 measurements\n#       + 3 dashboard); 5 PRAVIH a11y vrzeli odkritih in popravljenih\n#       IN-PLACE (Bluetooth ×2 + Mic ×3 v measurements-tab — aria-hidden\n#       dodan na obstoječi vrstici, BREZ novih vrstic → r172 vrstični pin\n#       7427 NEPREMAKNJEN; vzrok dokumentiran v detektorju + worklogu);\n#       ostale novo-vidne (FileDown/FolderX×2/CalendarX/ShoppingCart) so\n#       imele aria-hidden ŽE od prej — pokritost 1430 → 1435, 0 manjkajočih.',
    '#   (b) CALCULATOR-TAB FAZA 2 (PDF izvozi): 5.372 → 4.846 vrstic (−526);\n#       NOV src/components/roksal/calculator/pdf-exports.ts/647 vrstic —\n#       5 PDF funkcij (predloga vrtanja / materialni list / razrezni list\n#       CNC / vetrno poročilo / steklena balustrada) REFAKTOR: telesa\n#       VERBATIM, closure dostop do stanja → eksplicitni args objekti\n#       (čiste projekcije posredovanega stanja); tipa CncSegment +\n#       GlassType preseljena iz telesa komponente; osirotela jsPDF/autoTable\n#       uvoza odstranjena iz glavne datoteke.', 1)
zam('#   + (1) regresije: r321-build-needles.sh (vzporedna R321: 50. člen\n#   zmogljivost PDF ×2+1 + delegirana veriga R320→R318→…→R227 — DELEGACIJA;\n#   red: r321 → r320 → …).',
    '#   + (1) regresije: r323-build-needles.sh [VZPOREDNA runda — 51. člen CSV\n#   zmogljivost ×2+1 + delegirana veriga r322→r321[vzporedna]→R320→…→R227 —\n#   DELEGACIJA; red: r323 → r322 → r321 → …].', 1)
zam('# LEKCIJA R289/R299-R321 (ASCII kanon)', '# LEKCIJA R289/R299-R321 (ASCII kanon)', 1)
zam('#   POZITIVNI needleji (build): premaknjena calculator vsebina ŽIVA v čankih\n#   kljub spremembi bivališča (regresijska zaščita dekompozicije — vsebina\n#   bajtno identična, mapa nova; string literali preživijo minifikacijo).\n#   MUST_MISS (build): TODO-R322 (brez razvojnih ostankov).',
    '#   POZITIVNI needleji (build): premaknjena vsebina ŽIVA v čankih kljub\n#   spremembi bivališča (regresijska zaščita dekompozicije — vsebina bajtno\n#   identična/refaktorirana, mapa nova; string literali preživijo\n#   minifikacijo).\n#   MUST_MISS (build): TODO-R323 (brez razvojnih ostankov).', 1)
zam('OUT=/tmp/r322-build-chunks', 'OUT=/tmp/r325-build-chunks', 1)
zam('# --- AWK strukturna preverba (r270 lekcija 2; r296-r321 vzorec) ---',
    '# --- AWK strukturna preverba (r270 lekcija 2; r296-r322 vzorec) ---', 1)
zam('echo "--- R322 MANDATORY — dekompozicija calculator faza 1: premaknjena vsebina ŽIVA v čankih ---"\nneed_static "Steklo (float/kaljeno)" "R322 GlassLayersSvg legenda — plasti stekla (premik živ)"\nneed_static "PVB folija (varnostna)" "R322 GlassLayersSvg legenda — PVB folija (premik živ)"\nneed_static "Cona 1 — celina (22 m/s)" "R322 SloveniaWindMapSvg cona oznaka (premik živ)"\nneed_static "Ni podatkov za vizualizacijo." "R322 AngledSvg/BalusterSvg fallback besedilo (premik živ)"\nneed_static "Hilti HIT-RE 500" "R322 shared.ts anchorTypeLabels konstanta (premik živ)"\necho "--- R322 must_miss (negativni) ---"\nmust_miss "TODO-R322" "R322 — brez razvojnih ostankov"\necho "R322 lastni needleji: FAIL=$FAIL (5 premik + 1 must_miss)"\necho "=== REGRESIJE: polna veriga prek r321-build-needles.sh (vzporedna R321 + R320 + … + R227) ==="\nREG=0\nbash scripts/r321-build-needles.sh || REG=1',
    'echo "--- R325 MANDATORY — dekompozicija faza 2: premaknjena vsebina ŽIVA v čankih ---"\necho "--- (a) measurements: laserski BT blok + template localStorage blok ---"\nneed_static "0000feff-0000-1000-8000-00805f9b34fb" "R325 laser-bt.ts Leica DISTO service UUID (premik živ)"\nneed_static "Poveži laserski daljinec preko Web Bluetooth" "R325 laser-panel.tsx tooltip besedilo (premik živ)"\nneed_static "Poslušam meritve... Pošlji mero z gumbom na daljincu" "R325 laser-panel.tsx statusno besedilo (premik živ)"\nneed_static "Mera iz laserja: " "R325 use-laser.ts toast ob prejeti meri (premik živ)"\nneed_static "Standardni balkon 3m" "R325 templates.ts PREDLOGE naziv (premik živ)"\nneed_static "L-oblika 4+2m" "R325 templates.ts PREDLOGE naziv (premik živ)"\necho "--- (b) calculator: PDF izvozi (5 funkcij → pdf-exports.ts) ---"\nneed_static "ROKSAL — Predloga vrtanja" "R325 pdf-exports.ts naslov baluster PDF (premik živ)"\nneed_static "ROKSAL — Razrezni list CNC" "R325 pdf-exports.ts naslov CNC PDF (premik živ)"\nneed_static "ROKSAL — Steklena balustrada specifikacija" "R325 pdf-exports.ts naslov steklo PDF (premik živ)"\necho "--- R325 must_miss (negativni) ---"\nmust_miss "TODO-R325" "R325 — brez razvojnih ostankov"\necho "R325 lastni needleji: FAIL=$FAIL (9 premik + 1 must_miss)"\necho "=== REGRESIJE: polna veriga prek r324-build-needles.sh [VZPOREDNA R324 dnevni PDF + R323 CSV + R322 + … + R227] ==="\nREG=0\nbash scripts/r324-build-needles.sh || REG=1', 1)
zam('if [ "$REG" = "1" ]; then echo "REGRESIJA FAIL"; exit 1; fi\nif [ "$FAIL" = "1" ]; then echo "R322 NEEDLEJI FAIL"; exit 1; fi\necho "=== R322 BUILD NEEDLES VSE OK ==="',
    'if [ "$REG" = "1" ]; then echo "REGRESIJA FAIL"; exit 1; fi\nif [ "$FAIL" = "1" ]; then echo "R325 NEEDLEJI FAIL"; exit 1; fi\necho "=== R325 BUILD NEEDLES VSE OK ==="', 1)

# izhodna asercija (LEKCIJA R310 5/6)
assert '/tmp/r322-build-chunks' not in s, 'ostanki r322 chunks'
assert '/tmp/r323-build-chunks' not in s, 'ostanki r323 chunks'
assert 'TODO-R324' in s, 'must_miss manjka'
assert 'r323-build-needles.sh' in s, 'delegacija manjka'

DOL.write_text(s, encoding='utf-8')
print(f'OK — {DOL.name} zapisan ({len(s.splitlines())} vrstic)')
