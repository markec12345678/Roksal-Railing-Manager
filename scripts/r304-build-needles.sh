#!/bin/bash
# R304 — build needleji: (0) VODJA TEDENSKI CSV PO EKIPAH (34. člen 'izvozi'
# družine): CSV brat PDF po ekipah R303 — pill (testid + definicijski
# naslov), EN VIR meta dokazi, handler, legenda + (1) regresije:
# r303-build-needles.sh (R303 ×11 + R302 ×11 + … polna veriga do R227 —
# DELEGACIJA).
# LEKCIJA R289/R299/R300/R301/R302/R303 (ASCII kanon): needleji = ASCII
# literali + import imena; '·' in '—' minifier pretvori; narekovaji stisnejo
# enojni→dvojni; polja brez presledkov; IDENTIFIKATOR-needleji MISS
# (minificirani na kratka imena — R302 lekcija 1) → graditelj prek TypeError
# STRING kanona. Build PREJ pred needleji (R300 lekcija 3).
set -u
cd /home/z/my-project
OUT=/tmp/r304-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# --- AWK strukturna preverba (r270 lekcija 2; r296-r303 vzorec) ---
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

echo "--- R304 MANDATORY — VODJA TEDENSKI CSV PO EKIPAH (34. člen 'izvozi' družine) ---"
need_static "ekipe-csv-pill" "R304 pill testid"
need_static "Ekipe CSV" "R304 pill label"
need_static "Izvozi tedenski vozni red po ekipah kot CSV" "R304 aria-label"
need_static "Tedenski vozni red po ekipah kot CSV" "R304 definicijski naslov (izrečena pravila)"
need_static "Tedenski vozni red po ekipah prenešen v CSV" "R304 WYSIWYG toast naslov"
need_static "Izvoz CSV po ekipah ni uspel" "R304 fail-verbose catch (guard resnica)"
need_static "CSV po ekipah se izvozi, ko je vpisan termin" "R304 fail-closed toast (prazno okno)"
need_static "CSV po ekipah se izvozi, ko ima ekipa vpisan termin" "R304 fail-closed toast (0 ekip — mirror R299/R303)"
need_static "vir = ISTI pregled kot Ekipe PDF" "R304 meta Obseg EN VIR dokaz"
need_static "Brez ekipe (brez sekcije" "R304 meta iskren brez-ekipe števec (pogojna vrstica)"
need_static "Terminov po ekipah" "R304 meta števec (capital T — EN VIR pregleda)"
echo "--- R304 must_miss (negativni) ---"
must_miss "TODO-R304" "R304 — brez razvojnih ostankov"

echo "R304 lastni needleji: FAIL=$FAIL (11 novih + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r303-build-needles.sh (R303+R302+…+R227) ==="
REG=0
bash scripts/r303-build-needles.sh || REG=1
echo "=== R304 SKUPNA RESNICA: R304 FAIL=$FAIL, regresije FAIL=$REG ==="
[ "$FAIL" = "0" ] && [ "$REG" = "0" ] || exit 1
echo "R304 NEEDLES VSE ZELENE (R304 ×11 + regresije)"
exit 0
