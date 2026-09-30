#!/bin/bash
# R311 — build needleji: 41. člen issue #1 «AI raba — iskrena resnica»
# (Deliverable 5 NA ZASLONU — lib ai-raba-pregled ČISTA projekcija katalog ×
# AI_KANDIDATI; vodja-dashboard blok WYSIWYG) + STIL harmonizacija val 2
# (measurements-tab ×13 mest + material-intelligence-tab ×10 + deal-pipeline
# spomnik ×2 — surove amber → roksal žetoni, 0 novih hex; 6 izrecnih izjem
# [kategorije barv / gola-text lestvice — R308 lekcija] zaklenjene na SOURCE
# nivoju: r311 STRAŽAR test).
#   POZITIVNI needleji (build): testidi + naslov + nadomestek-literal + sklep
#   fragmenti (lib template literali preživijo kot string literali) + kandidat
#   status + STIL žetoni (dashed /50 unikatna sekvenca + ikona vsebnik).
#   MUST_MISS (build): SAMO enolično pripisljivi surovi vzorci (lekcija R308 3
#   — deljene surove sekvene [spomnik bg-amber-100 ×4 datotek] → SOURCE nivo
#   r311 STRAŽAR test).
#   + (1) regresije: r310-build-needles.sh (R310 + R309 + … polna veriga do
#   R227 — DELEGACIJA).
# LEKCIJA R289/R299-R310 (ASCII kanon): needleji = ASCII literali + imena
# lastnosti + string literali; komentarji odstranjeni v buildu. Build PREJ
# pred needleji (R300 lekcija 3; R308 lekcija 1).
set -u
cd /home/z/my-project
OUT=/tmp/r311-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# --- AWK strukturna preverba (r270 lekcija 2; r296-r310 vzorec) ---
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

echo "--- R311 MANDATORY — 41. člen: AI raba dokaz na zaslonu (lib + vodja blok) ---"
need_static "ai-raba-dokaz" "R311 blok testid (vodja chunk)"
need_static "ai-raba-sklep" "R311 sklep testid"
need_static "AI raba — iskrena resnica" "R311 naslov (aria + glava — EN VIR literals)"
need_static "→ nadomestek (brez AI): " "R311 nadomestek literal (razrešena deterministična pot)"
need_static "NE-IMPLEMENTIRANO — kandidat (nič povezano)" "R311 kandidati status (avtomatizacija-audit verbatim — klient nosi EN VIR)"
need_static "(ne-implementirani, nič povezano)" "R311 sklep fragment (lib template literal — WYSIWYG)"
need_static "AI-obveznih: 0 — jedro deluje brez AI" "R311 sklep ničla (lib template literal)"

echo "--- R311 MANDATORY STIL — val 2: measurements/material-intelligence/deal spomnik surove amber → žetoni ---"
need_static "border-dashed border-roksal-amber/50" "R311 measurements dashed WPC zona (unikatna sekvenca — žetoni)"
need_static "bg-roksal-amber text-roksal-navy" "R311 WPC ikona vsebnik (žeton par — r162 lekcija)"
need_static "bg-roksal-amber/10 text-roksal-ink border-roksal-amber/40" "R311 žeton značka oblika (deal spomnik + POTRJENO + verdicti — družina punch R310)"
echo "--- R311 must_miss (negativni — SAMO enolično pripisljivi; deljene surove sekvene → SOURCE nivo r311 STRAŽAR) ---"
must_miss "border-amber-400/50 dark:border-amber-700/50" "R311 measurements surova dashed zona (izginila — unikatna sekvenca)"
must_miss "TODO-R311" "R311 — brez razvojnih ostankov"
echo "R311 lastni needleji: FAIL=$FAIL (7 AI raba + 3 STIL + 2 must_miss)"
echo "=== REGRESIJE: polna veriga prek r310-build-needles.sh (R310+R309+…+R227) ==="
REG=0
bash scripts/r310-build-needles.sh || REG=1
if [ "$REG" = "1" ]; then echo "REGRESIJA FAIL"; exit 1; fi
if [ "$FAIL" = "1" ]; then echo "R311 NEEDLEJI FAIL"; exit 1; fi
echo "=== R311 BUILD NEEDLES VSE OK ==="
