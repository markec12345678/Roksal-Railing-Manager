#!/bin/bash
# R303 — build needleji: (0) VODJA TEDENSKI PDF PO EKIPAH (33. člen 'izvozi'
# družine): PDF brat ICS po ekipah R299 — pill (testid + definicijski
# naslov), EN VIR lib import, handler, legenda + (1) regresije:
# r302-build-needles.sh (R302 ×11 + R301 ×11 + … polna veriga do R227 —
# DELEGACIJA).
# LEKCIJA R289/R299/R300/R301/R302 (ASCII kanon): needleji = ASCII literali +
# import imena; '·' in '—' minifier pretvori; narekovaji stisnejo enojni→dvojni;
# polja brez presledkov; IDENTIFIKATOR-needleji MISS (minificirani na kratka
# imena — R302 lekcija 1) → graditelj prek TypeError STRING kanona.
# Build PREJ pred needleji (R300 lekcija 3).
set -u
cd /home/z/my-project
OUT=/tmp/r303-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# --- AWK strukturna preverba (r270 lekcija 2; r296-r302 vzorec) ---
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

echo "--- R303 MANDATORY — VODJA TEDENSKI PDF PO EKIPAH (33. člen 'izvozi' družine) ---"
need_static "buildTedenskiEkipaPdfDoc" "R303 lib graditelj (EN VIR — LIVE prek TypeError kanona)"
need_static "tedenskiEkipaPdfFilename" "R303 ime datoteke (EN VIR graditelj)"
need_static "ekipe-pdf-pill" "R303 pill testid"
need_static "Ekipe PDF" "R303 pill label"
need_static "TEDENSKI VOZNI RED PO EKIPAH" "R303 PDF naslov"
need_static "Tedenski vozni red po ekipah prenešen" "R303 WYSIWYG toast naslov"
need_static "Tedenski vozni red po ekipah kot PDF" "R303 definicijski naslov (izrečena pravila)"
need_static "Izvoz PDF po ekipah ni uspel" "R303 fail-verbose catch (guard resnica)"
need_static "Ni ekip z termini v naslednjih 7 dneh" "R303 fail-closed toast (0 ekip — mirror R299)"
need_static "ENA sekcija na ekipo" "R303 legenda + definicijski naslov"
need_static "Tedenski-po-ekipah-" "R303 ime datoteke kanon (string literal)"
echo "--- R303 must_miss (negativni) ---"
must_miss "TODO-R303" "R303 — brez razvojnih ostankov"

echo "R303 lastni needleji: FAIL=$FAIL (11 novih + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r302-build-needles.sh (R302+R301+…+R227) ==="
REG=0
bash scripts/r302-build-needles.sh || REG=1
echo "=== R303 SKUPNA RESNICA: R303 FAIL=$FAIL, regresije FAIL=$REG ==="
[ "$FAIL" = "0" ] && [ "$REG" = "0" ] || exit 1
echo "R303 NEEDLES VSE ZELENE (R303 ×11 + regresije)"
exit 0
