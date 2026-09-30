#!/bin/bash
# R324 — build needleji: DEKOMPOZICIJA FAZA 2 (measurements + calculator —
# nadaljevanje odobrene Roadmap "razbitje monsterskih komponent", vzorec
# R319 faza 1 / R322 calculator faza 1; KOLIZIJA #5: vzporedna seja je
# vzela R323 [8857d6e, 51. člen zmogljivost CSV] — runda preimenovana
# R323→R324 po kanonu LEKCIJA 1; RE-DERIVIRANA delegacija iz vzporedne
# r323 generacije — podeduje njihove CSV needleje + verigo):
#   (a) MEASUREMENTS-TAB FAZA 2 (lastniška prioriteta #1 laserski BT blok +
#       #2 template localStorage blok): 7.604 → 7.153 vrstic (−451); NOV
#       v src/components/roksal/measurements/ ×4 datotek/594 vrstic:
#       laser-bt.ts (Web Bluetooth tipi + LASER konstante + 3 pomožne —
#       ČIST PREMIK bajtno identično, edina sprememba export) +
#       use-laser.ts (stanje + GATT povezava + odklop + auto-reconnect —
#       REFAKTOR: edina semantična sprememba = polnjenje forme prek
#       onMeasurement povratnega klica namesto neposrednih setState;
#       + mikrotask vzorec PwaStatus za začetna branja — omejitev pravila
#       react-hooks/set-state-in-effect, prej skrito z bailoutom compiler
#       analize na 7,6k vrstični datoteki) + laser-panel.tsx (UI blok — ČIST
#       PREMIK s props) + templates.ts (PREDLOGE + StairTemplate/StairCalc +
#       WPC konstante + loadStairTemplates/saveStairTemplates — ČIST PREMIK).
#       Osiroteli lucide uvozi odstranjeni (Bluetooth/Radio/Unplug — preverjeno
#       s štetjem POJAVITVE, kanon R322).
#   (b) CALCULATOR-TAB FAZA 2 (PDF izvozi): 5.372 → 4.846 vrstic (−526);
#       NOV src/components/roksal/calculator/pdf-exports.ts/647 vrstic —
#       5 PDF funkcij (predloga vrtanja / materialni list / razrezni list
#       CNC / vetrno poročilo / steklena balustrada) REFAKTOR: telesa
#       VERBATIM, closure dostop do stanja → eksplicitni args objekti
#       (čiste projekcije posredovanega stanja); tipa CncSegment +
#       GlassType preseljena iz telesa komponente; osirotela jsPDF/autoTable
#       uvoza odstranjena iz glavne datoteke.
#   POZITIVNI needleji (build): premaknjena vsebina ŽIVA v čankih kljub
#   spremembi bivališča (regresijska zaščita dekompozicije — vsebina bajtno
#   identična/refaktorirana, mapa nova; string literali preživijo
#   minifikacijo).
#   MUST_MISS (build): TODO-R323 (brez razvojnih ostankov).
#   + (1) regresije: r323-build-needles.sh [VZPOREDNA runda — 51. člen CSV
#   zmogljivost ×2+1 + delegirana veriga r322→r321[vzporedna]→R320→…→R227 —
#   DELEGACIJA; red: r323 → r322 → r321 → …].
# LEKCIJA R289/R299-R321 (ASCII kanon): needleji = ASCII/UTF-8 string
# literali; komentarji odstranjeni v buildu. Build PREJ pred needleji.
set -u
cd /home/z/my-project
OUT=/tmp/r325-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# --- AWK strukturna preverba (r270 lekcija 2; r296-r322 vzorec) ---
STRUCT=$(awk '
  /^need_static\(\)/      { infn=1; needdef=1; next }
  /^must_miss\(\)/        { infn=1; next }
  infn && /^\}/           { infn=0; next }
  infn                    { next }
  infn==0 && /^find /     { loop=1; next }
  infn==0 && loop==1 && /^done$/ { loop=0; next }
  infn==0 && loop==1 && (/^need_static / || /^must_miss /) { c1++; next }
  infn==0 && !needdef && (/^need_static / || /^must_miss /) { c2++; next }
  END { print (c1+0) "/" (c2+0) }
' "$0")
echo "=== Z-STRUCT: needleji v loopu / pred definicijo = $STRUCT (mora biti 0/0) ==="
[ "$STRUCT" = "0/0" ] || { echo "STRUKTURNA NAPAKA — abort"; exit 1; }

find .next/static/chunks .next/server -name '*.js' -type f | while read -r f; do
  cp "$f" "$OUT/$(echo "$f" | md5sum | cut -c1-12)-$(basename "$f")"
done
echo "  cankov: $(ls "$OUT"/*.js 2>/dev/null | wc -l)"

FAIL=0
need_static() {
  if grep -rqF -- "$1" "$OUT" 2>/dev/null; then echo "OK   : $2"; else echo "MISS : $2  (needle: $1)"; FAIL=1; fi
}
must_miss() {
  if grep -rqF -- "$1" "$OUT" 2>/dev/null; then echo "HIT  : $2 (needle: $1 — NE SME BITI!)"; FAIL=1; else echo "OK   : $2 (odsoten)"; fi
}

echo "--- R325 MANDATORY — dekompozicija faza 2: premaknjena vsebina ŽIVA v čankih ---"
echo "--- (a) measurements: laserski BT blok + template localStorage blok ---"
need_static "0000feff-0000-1000-8000-00805f9b34fb" "R325 laser-bt.ts Leica DISTO service UUID (premik živ)"
need_static "Poveži laserski daljinec preko Web Bluetooth" "R325 laser-panel.tsx tooltip besedilo (premik živ)"
need_static "Poslušam meritve... Pošlji mero z gumbom na daljincu" "R325 laser-panel.tsx statusno besedilo (premik živ)"
need_static "Mera iz laserja: " "R325 use-laser.ts toast ob prejeti meri (premik živ)"
need_static "Standardni balkon 3m" "R325 templates.ts PREDLOGE naziv (premik živ)"
need_static "L-oblika 4+2m" "R325 templates.ts PREDLOGE naziv (premik živ)"
echo "--- (b) calculator: PDF izvozi (5 funkcij → pdf-exports.ts) ---"
need_static "ROKSAL — Predloga vrtanja" "R325 pdf-exports.ts naslov baluster PDF (premik živ)"
need_static "ROKSAL — Razrezni list CNC" "R325 pdf-exports.ts naslov CNC PDF (premik živ)"
need_static "ROKSAL — Steklena balustrada specifikacija" "R325 pdf-exports.ts naslov steklo PDF (premik živ)"
echo "--- R325 must_miss (negativni) ---"
must_miss "TODO-R325" "R325 — brez razvojnih ostankov"
echo "R325 lastni needleji: FAIL=$FAIL (9 premik + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r324-build-needles.sh [VZPOREDNA R324 dnevni PDF + R323 CSV + R322 + … + R227] ==="
REG=0
bash scripts/r324-build-needles.sh || REG=1
if [ "$REG" = "1" ]; then echo "REGRESIJA FAIL"; exit 1; fi
if [ "$FAIL" = "1" ]; then echo "R325 NEEDLEJI FAIL"; exit 1; fi
echo "=== R325 BUILD NEEDLES VSE OK ==="
