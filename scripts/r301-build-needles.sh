#!/bin/bash
# R301 — build needleji: (0) TEDENSKI KONFLIKTI CSV (31. člen 'izvozi'
# družine): CSV brat pregledu R300 — pill (testid + definicijski naslov),
# EN VIR lib import, handler, legenda + (1) regresije: r300-build-needles.sh
# (R300 ×11 + R299 ×16 + … polna veriga do R227 — DELEGACIJA).
# LEKCIJA R289/R299/R300 (ASCII kanon): needleji = ASCII literali + import
# imena; '·' in '—' minifier pretvori; narekovaji stisne enojni→dvojni;
# polja brez presledkov. Build PRVERJ pred needleji (R300 lekcija 3).
set -u
cd /home/z/my-project
OUT=/tmp/r301-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# --- AWK strukturna preverba (r270 lekcija 2; r296-r300 vzorec) ---
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

echo "--- R301 MANDATORY — TEDENSKI KONFLIKTI CSV (31. člen 'izvozi' družine) ---"
need_static "konfliktiCsvFilename" "R301 lib import (EN VIR graditelj)"
need_static "konflikti-csv-pill" "R301 pill testid"
need_static "Konflikti CSV" "R301 pill label"
need_static "Dan prekrivanja" "R301 glava stolpec (EN VIR KONFLIKTI_CSV_GLAVA)"
need_static "Ekip z konflikti" "R301 meta stevec (pari po ekipah)"
need_static "Pregledanih terminov" "R301 meta obseg pregleda"
need_static "dokazani pari prekrivanj ekipe" "R301 legenda (isti pregled kot žig)"
need_static "Ni dokazanih konfliktov v okviru" "R301 zelen žig fail-closed toast"
need_static "Žig je zelen" "R301 iskrena čistost razlaga"
need_static "isti poli-odprto pregled kot žig" "R301 definicijski naslov (izrečena pravila)"
need_static "Konflikti prenešeni v CSV" "R301 WYSIWYG toast naslov"
echo "--- R301 must_miss (negativni) ---"
must_miss "TODO-R301" "R301 — brez razvojnih ostankov"

echo "R301 lastni needleji: FAIL=$FAIL (11 novih + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r300-build-needles.sh (R300+R299+…+R227) ==="
REG=0
bash scripts/r300-build-needles.sh || REG=1
echo "=== R301 SKUPNA RESNICA: R301 FAIL=$FAIL, regresije FAIL=$REG ==="
[ "$FAIL" = "0" ] && [ "$REG" = "0" ] || exit 1
echo "R301 NEEDLES VSE ZELENE (R301 ×11 + regresije)"
exit 0
