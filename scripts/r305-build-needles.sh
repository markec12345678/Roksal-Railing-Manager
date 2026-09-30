#!/bin/bash
# R305 — build needleji: (0) TEDENSKI PREGLED PO DNEVIH Z EKIPAMI (35. člen
# 'izvozi' družine, bralni ZASLONSKI): zaslon brat PDF po ekipah R303 + CSV
# R304 — zaslon blok (testidi + aria + definicijski naslov pravila + prazna/
# sklep veja + preklicani rdeči), memo EN VIR (izpeljan iz memo ekipaPregled)
# + (1) regresije: r304-build-needles.sh (R304 ×11 + R303 ×11 + … polna
# veriga do R227 — DELEGACIJA).
# LEKCIJA R289/R299-R304 (ASCII kanon): needleji = ASCII literali + testidi;
# '·' in '—' minifier pretvori; narekovaji stisnejo; IDENTIFIKATOR-needleji
# MISS (minificirani) → testidi/string-literal kanon. Komentarji so odstranjeni
# v buildu — needleji morajo živeti v atributih/besedilu, NE komentarjih.
# Negativni needle (must_miss) zahteva, da komentar NE vsebuje literal-needleja
# (lekcija R304 1). Build PREJ pred needleji (R300 lekcija 3).
set -u
cd /home/z/my-project
OUT=/tmp/r305-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# --- AWK strukturna preverba (r270 lekcija 2; r296-r304 vzorec) ---
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

echo "--- R305 MANDATORY — TEDENSKI PREGLED PO DNEVIH Z EKIPAMI (35. člen, ZASLON) ---"
need_static "tedenski-ekipa-dnevi-prazno" "R305 prazna veja testid (iskrena praznina — particija dokaz)"
need_static "tedenski-ekipa-dnevi-sklep" "R305 sklep veja testid (PETI potrošnik ENEGA niza)"
need_static "Teden po dnevih in ekipah" "R305 naslov (vidno besedilo + aria)"
need_static "Brez ekip z termini v okviru" "R305 prazna veja iskren tekst (0 ekip NI vrstica)"
need_static "ISTI pregled in vrstni red kot Ekipe PDF in Ekipe CSV" "R305 definicijski naslov — EN VIR pravilo"
need_static "prazni dnevi vidni" "R305 definicijski naslov — kanon R292"
need_static "ZASLON = takoj na pogled" "R305 definicijski naslov — vidna razlika medija (tisk/Excel → takoj)"
need_static "Brez terminov na ta dan" "R305 prazen dan vrstica (iskrena praznina — nikoli skrita)"
need_static "vsi vidni termini v okviru" "R305 particija dokaz tekst (iskren brez-ekipe števec)"
need_static "Dodeli ekipo v terminu" "R305 prazna veja dejanje (uporabniška pot)"
need_static "preklicanih " "R305 preklicani stpec per dan (iskren odpad — pariteta PDF R303)"
echo "--- R305 must_miss (negativni) ---"
must_miss "TODO-R305" "R305 — brez razvojnih ostankov"

echo "R305 lastni needleji: FAIL=$FAIL (11 novih + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r304-build-needles.sh (R304+R303+…+R227) ==="
REG=0
bash scripts/r304-build-needles.sh || REG=1
echo "=== R305 SKUPNA RESNICA: R305 FAIL=$FAIL, regresije FAIL=$REG ==="
[ "$FAIL" = "0" ] && [ "$REG" = "0" ] || exit 1
echo "R305 NEEDLES VSE ZELENE (R305 ×11 + regresije)"
exit 0
