#!/bin/bash
# R302 — build needleji: (0) TEDENSKI KONFLIKTI PDF (32. člen 'izvozi'
# družine): PDF brat pregledu R300 + CSV R301 — pill (testid + definicijski
# naslov), EN VIR lib import, handler, legenda + (1) regresije:
# r301-build-needles.sh (R301 ×11 + R300 ×11 + … polna veriga do R227 —
# DELEGACIJA).
# LEKCIJA R289/R299/R300/R301 (ASCII kanon): needleji = ASCII literali +
# import imena; '·' in '—' minifier pretvori; narekovaji stisne enojni→dvojni;
# polja brez presledkov. Build PRVERJ pred needleji (R300 lekcija 3).
set -u
cd /home/z/my-project
OUT=/tmp/r302-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# --- AWK strukturna preverba (r270 lekcija 2; r296-r301 vzorec) ---
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

echo "--- R302 MANDATORY — TEDENSKI KONFLIKTI PDF (32. člen 'izvozi' družine) ---"
need_static "buildKonfliktiPdfDoc" "R302 lib graditelj (EN VIR — LIVE prek TypeError kanona)"
need_static "konfliktiPdfFilename" "R302 ime datoteke (EN VIR graditelj)"
need_static "konflikti-pdf-pill" "R302 pill testid"
need_static "Konflikti PDF" "R302 pill label"
need_static "TEDENSKI KONFLIKTI EKIP" "R302 PDF naslov"
need_static "Konflikti prenešeni v PDF" "R302 WYSIWYG toast naslov"
need_static "Konflikti tedenskega pregleda kot PDF" "R302 definicijski naslov (izrečena pravila)"
need_static "Izvoz konfliktov PDF ni uspel" "R302 fail-verbose catch (guard resnica)"
need_static "Dokazani pari prekrivanj" "R302 PDF sekcija dokaza"
need_static "Konflikti PDF se izvozi, ko je vpisan termin" "R302 prazno okno fail-closed toast"
need_static "tisk za pisarno" "R302 legenda (vidna razlika medija CSV/tisk)"
echo "--- R302 must_miss (negativni) ---"
must_miss "TODO-R302" "R302 — brez razvojnih ostankov"

echo "R302 lastni needleji: FAIL=$FAIL (11 novih + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r301-build-needles.sh (R301+R300+…+R227) ==="
REG=0
bash scripts/r301-build-needles.sh || REG=1
echo "=== R302 SKUPNA RESNICA: R302 FAIL=$FAIL, regresije FAIL=$REG ==="
[ "$FAIL" = "0" ] && [ "$REG" = "0" ] || exit 1
echo "R302 NEEDLES VSE ZELENE (R302 ×11 + regresije)"
exit 0
