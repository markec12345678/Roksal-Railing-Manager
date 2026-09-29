#!/bin/bash
# R295 — build needleji: (0) KOLEDAR PREGLEDOV CSV (25. člen 'izvozi'
# družine — CSV brat PDF R253): pill aria/title, lib EN VIR graditelj,
# fail-closed toasta, meta Obseg resnica + F2 koledarska mini-vrstica
# (WYSIWYG ISTA izpeljava koledarPovzetek)
#       + (1) regresije: r294-build-needles.sh (R294 ×8 + R293 ×8 + R292/R291/
# R290 + … polna veriga do R227 — DELEGACIJA: isti chunk vzorec, dva teka,
# ENA kombinirana FAIL resnica).
# LEKCIJA R289 (ASCII kanon): needleji = JSX/title literali + lib export imena
# (dokazano preživetja: inventuraPregledCsvVrstice R286 vzorec) + meta stringi.
set -u
cd /home/z/my-project
OUT=/tmp/r295-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# --- AWK strukturna preverba (r270 lekcija 2; r294 vzorec) ---
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
echo "  čankov: $(ls "$OUT"/*.js 2>/dev/null | wc -l)"

FAIL=0
need_static() {
  if grep -rqF -- "$1" "$OUT" 2>/dev/null; then echo "OK   : $2"; else echo "MISS : $2  (needle: $1)"; FAIL=1; fi
}
must_miss() {
  if grep -rqF -- "$1" "$OUT" 2>/dev/null; then echo "HIT  : $2 (needle: $1 — NE SME BITI!)"; FAIL=1; else echo "OK   : $2 (odsoten)"; fi
}

echo "--- R295 MANDATORY — KOLEDAR PREGLEDOV CSV (25. člen 'izvozi' družine) ---"
need_static "Izvozi koledar pregledov kot CSV" "R295 gumb aria-label"
need_static "Koledar pregledov kot CSV (isti stolpci kot PDF — za Excel/računovodstvo)" "R295 gumb hover title (press-scale pariteta)"
need_static "koledarPregledovCsvVrstice" "R295 lib EN VIR graditelj (vzorec R286)"
need_static "koledarPregledovCsvFilename" "R295 ime datoteke (brat PDF R253)"
need_static "Koledar-pregledov-" "R295 predpona imena (družinski vzorec)"
need_static "Vse stranke z vpisanim datumom pregleda (AKTIVEN + POTEKEL) — koledarski red" "R295 meta Obseg resnica (VERBATIM)"
need_static "prazen koledar ne nastaja datoteke" "R295 lib fail-closed (družinsko pravilo R253)"
need_static "CSV se izvozi, ko je vpisan prvi datum pregleda." "R295 iskren toast opis (fail-closed vrata)"
need_static "Koledar pregledov prenešen v CSV" "R295 uspeh toast (WYSIWYG)"
echo "--- R295 MANDATORY STIL — F2 koledarska mini-vrstica (WYSIWYG ENA izpeljava) ---"
need_static "Pregledi: " "R295 mini-vrstica besedilo (isto izpeljava kot PDF KPI + CSV meta + toast)"
need_static " vpisanih · " "R295 mini-vrstica trikot ločila"
need_static " v tem tednu · " "R295 mini-vrstica trikot ločila (AKTIVEN)"
need_static " poteklih" "R295 mini-vrstica trikot konec (POTEKEL)"
echo "--- R295 must_miss (negativni) ---"
must_miss "TODO-R295" "R295 — brez razvojnih ostankov"

echo "R295 lastni needleji: FAIL=$FAIL (13 novih + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r294-build-needles.sh (R294+R293+R292+R291+R290+…) ==="
REG=0
bash scripts/r294-build-needles.sh || REG=1
echo "=== R295 SKUPNA RESNICA: R295 FAIL=$FAIL, regresije FAIL=$REG ==="
[ "$FAIL" = "0" ] && [ "$REG" = "0" ] || exit 1
echo "R295 NEEDLES VSE ZELENE (R295 ×13 + regresije)"
exit 0
