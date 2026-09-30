#!/bin/bash
# R326 — build needleji: 53. ČLEN issue #1 §5 «ZGODOVINA CEN MATERIALA»
# (price history — NOVI lib cena-zgodovina: ČISTA projekcija MaterialPrice
# vključno z ZAPRTO zgodovino veljavnostDo != null; NOVI GET route
# material-prices/zgodovina = edini bralec zgodovine; NOVI panel
# CenaZgodovinaPanel na inventory tabu — par = material × dobavitelj
# časovnica + iskrene smeri [narašča/pada/stabilna/prvi vpis] + CSV gumb
# izvozne družine; EN VIR: CENA_ZGODOVINA_CSV_GLAVE + TIMELINE_GLAVE +
# CENA_SMER_NIZ + cenaZgoSklep + CENA_ZGO_VIR_NIZ; EXCLUDE ogledalo
# NATANKO ena odprta cena per par; Date.parse razvrščanje — '39Z' past) +
# STIL val 13 (dvonivojska hierarhija val 11/12 na NOVI površini panela —
# par-Card amber/30 + časovna vrstica amber/40; PIN SHIFTI: val8 anti-stale
# 58→59 [NOVI CSV gumb, ring navy/40 — amber register ostane vodja ×8],
# r308 route obseg 81→82, r324 HEAD pre-existing /s flag popravljen).
#   (a) DEKOMPOZICIJA calculator-tab (faza 1, kanon R319 measurements faza
#       1): 6.074 → 5.372 vrstic (−702); NOV mapa src/components/roksal/
#       calculator/ ×5 datotek/762 vrstic: shared.ts (tipi CalcMode/
#       ProfileType/AnchorType/TerrainCategory/RailingType + 7 interfejsov +
#       15 konstant VERBATIM + export; dvig importov na vrh = struktura, ne
#       vsebina) + 4 SVG diagrami (BalusterSvg/AngledSvg/SloveniaWindMapSvg/
#       GlassLayersSvg — ČIST PREMIK bajtno identično, edina sprememba
#       export; brez use client — client drevo). lucide uvozi ostajajo
#       (vseh 10 ikon v rabi TUDI v glavni komponenti).
#   (b) R254 SLEPA PEGA ZAPRTA (odkrita v R319 pri dekompoziciji
#       measurements, izboljšava odložena kot kandidat — R322 izvedena):
#       vejica v uvoznem komentarju je razdelila import blok pri split(',')
#       → ikona NEVIDNA detektorju. Trojni popravek (detektor + codemod +
#       vitest stražar — enaka logika v treh virih, kanon ENA resnica):
#       strip // komentarjev PRED split. NOVO VIDNE ikone: 8 (5 measurements
#       + 3 dashboard); 5 PRAVIH a11y vrzeli odkritih in popravljenih
#       IN-PLACE (Bluetooth ×2 + Mic ×3 v measurements-tab — aria-hidden
#       dodan na obstoječi vrstici, BREZ novih vrstic → r172 vrstični pin
#       7427 NEPREMAKNJEN; vzrok dokumentiran v detektorju + worklogu);
#       ostale novo-vidne (FileDown/FolderX×2/CalendarX/ShoppingCart) so
#       imele aria-hidden ŽE od prej — pokritost 1430 → 1435, 0 manjkajočih.
#   POZITIVNI needleji (build): premaknjena calculator vsebina ŽIVA v čankih
#   kljub spremembi bivališča (regresijska zaščita dekompozicije — vsebina
#   bajtno identična, mapa nova; string literali preživijo minifikacijo).
#   MUST_MISS (build): TODO-R322 (brez razvojnih ostankov).
#   + (1) regresije: r323-build-needles.sh (vzporedna R321: 50. člen
#   zmogljivost PDF ×2+1 + delegirana veriga R320→R318→…→R227 — DELEGACIJA;
#   red: r321 → r320 → …).
# LEKCIJA R289/R299-R321 (ASCII kanon): needleji = ASCII/UTF-8 string
# literali; komentarji odstranjeni v buildu. Build PREJ pred needleji.
set -u
cd /home/z/my-project
OUT=/tmp/r326-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# --- AWK strukturna preverba (r270 lekcija 2; r296-r321 vzorec) ---
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

echo "--- R322 MANDATORY — dekompozicija calculator faza 1: premaknjena vsebina ŽIVA v čankih ---"
need_static "Steklo (float/kaljeno)" "R322 GlassLayersSvg legenda — plasti stekla (premik živ)"
need_static "PVB folija (varnostna)" "R322 GlassLayersSvg legenda — PVB folija (premik živ)"
need_static "Cona 1 — celina (22 m/s)" "R322 SloveniaWindMapSvg cona oznaka (premik živ)"
need_static "Ni podatkov za vizualizacijo." "R322 AngledSvg/BalusterSvg fallback besedilo (premik živ)"
need_static "Hilti HIT-RE 500" "R322 shared.ts anchorTypeLabels konstanta (premik živ)"
echo "--- R322 must_miss (negativni) ---"
must_miss "TODO-R322" "R322 — brez razvojnih ostankov"
echo "R322 lastni needleji: FAIL=$FAIL (5 premik + 1 must_miss)"
echo "--- R323 MANDATORY — 51. člen: izvoz meritev zmogljivosti kot CSV (IZVOZI družina) ---"
need_static "Izvozi meritve zmogljivosti kot CSV" "R323 CSV izvoz gumb aria (vodja chunk)"
need_static "zmogljivost-pregled.csv" "R323 CSV izvoz filename (vodja handler)"
echo "--- R323 must_miss (negativni) ---"
must_miss "TODO-R323" "R323 — brez razvojnih ostankov"
echo "R323 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "--- R324 MANDATORY — 52. člen: izvoz dnevnega pregleda vodje kot PDF (IZVOZI družina) ---"
need_static "Izvozi dnevni pregled vodje kot PDF" "R324 dnevni PDF izvoz gumb aria (vodja chunk)"
need_static "pregled-vodje_" "R324 dnevni PDF izvoz filename prefix (vodja-dnevni-pdf lib)"
echo "--- R324 must_miss (negativni) ---"
must_miss "TODO-R324" "R324 — brez razvojnih ostankov"
echo "R324 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "--- R326 MANDATORY — 53. člen: zgodovina cen materiala (issue #1 §5 price history) ---"
need_static "Zgodovina cen materiala" "R326 panel naslov (cena-zgodovina chunk)"
need_static "Izvozi zgodovino cen materiala kot CSV" "R326 CSV izvoz gumb aria (panel chunk)"
need_static "zgodovina-cen.csv" "R326 CSV izvoz filename (panel handler)"
echo "--- R326 must_miss (negativni) ---"
must_miss "TODO-R326" "R326 — brez razvojnih ostankov"
echo "R326 lastni needleji: FAIL=$FAIL (3 izvoz + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r324-build-needles.sh (52. člen dnevni PDF + 51. člen CSV + R322 + R321 + … + R227) ==="
REG=0
bash scripts/r324-build-needles.sh || REG=1
if [ "$REG" = "1" ]; then echo "REGRESIJA FAIL"; exit 1; fi
if [ "$FAIL" = "1" ]; then echo "R324 NEEDLEJI FAIL"; exit 1; fi
echo "=== R326 BUILD NEEDLES VSE OK ==="
