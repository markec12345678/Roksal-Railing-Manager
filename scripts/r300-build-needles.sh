#!/bin/bash
# R300 — build needleji: (0) TEDENSKI KONFLIKTNI PREGLED (30. člen, issue #1
# §7 branje): mini-vrstica testid/žig, EN VIR lib graditelj, zrcalni statusi,
# definicijski naslov (izrečena pravila) + (1) regresije: r299-build-needles.sh
# (R299 ×16 + R298 ×17 + … polna veriga do R227 — DELEGACIJA).
# LEKCIJA R289/R299 (ASCII kanon): needleji = ASCII literali + import imena;
# '·' in '—' minifier pretvori (R299 lekcija 1) — mini besedilo needle
# 'Konflikti: ' (ASCII prepona obeh vej).
set -u
cd /home/z/my-project
OUT=/tmp/r300-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# --- AWK strukturna preverba (r270 lekcija 2; r296-r299 vzorec) ---
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

echo "--- R300 MANDATORY — TEDENSKI KONFLIKTNI PREGLED (30. člen, issue #1 §7 branje) ---"
need_static "tedenskiKonflikti" "R300 lib EN VIR graditelj (import)"
need_static "tedenski-konflikti-mini" "R300 mini-vrstica testid"
need_static '["NAVRTENO","V_TEKU","PRELOZENO"]' "R300 aktivni statusi (zrcalo R142 — minifier brez presledkov; lekcija R299)"
need_static "Konflikti: " "R300 mini resnica (ASCII prepona obeh vej)"
need_static "Konflikti: 0" "R300 čistost veja (null = iskrena čistost)"
need_static "dvojne rezervacije v okviru" "R300 konflikt veja (viden odpad)"
need_static "Pregled dvojnih rezervacij ekipe v 7-dnevnem okviru" "R300 definicijski naslov (izrečena pravila)"
need_static " isti poli-odprto pravilo kot API 409" "R300 pravilo v naslovu (nazaj-na-nazaj dovoljen)"
need_static "text-roksal-green" "R300 čistost žig (zelen)"
need_static "text-roksal-red" "R300 konflikt žig (rdeč)"
need_static "Preklicano/Zaključeno ne zasede" "R300 statusi v naslovu (zgodovina ne blokira)"
echo "--- R300 must_miss (negativni) ---"
must_miss "TODO-R300" "R300 — brez razvojnih ostankov"

echo "R300 lastni needleji: FAIL=$FAIL (11 novih + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r299-build-needles.sh (R299+R298+…+R227) ==="
REG=0
bash scripts/r299-build-needles.sh || REG=1
echo "=== R300 SKUPNA RESNICA: R300 FAIL=$FAIL, regresije FAIL=$REG ==="
[ "$FAIL" = "0" ] && [ "$REG" = "0" ] || exit 1
echo "R300 NEEDLES VSE ZELENE (R300 ×11 + regresije)"
exit 0
