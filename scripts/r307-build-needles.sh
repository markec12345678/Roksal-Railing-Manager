#!/bin/bash
# R307 — build needleji: (0) KONFLIKTNI DOKAZ NA ZASLONU (37. clen 'izvozi'
# druzine, bralni ZASLONSKI): zaslon brat Konflikti CSV R301 + PDF R302 —
# dokaz blok parov (testid + aria + definicijski naslov pravil + Pregledanih/
# Parov stevci), mini rdec ziga = konfliktiSklep EN VIR (NIC dvojnega
# besedila — R307 cistota) + (1) regresije: r306-build-needles.sh (R306 x11 +
# R305 x11 + ... polna veriga do R227 — DELEGACIJA).
# LEKCIJA R289/R299-R305 (ASCII kanon): needleji = ASCII literali + testidi +
# CSS razredi; '.' in diakritiki v stringih prezrti ('zigi' namesto 'zigi');
# komentarji odstranjeni v buildu — needleji zivijo v atributih/besedilu.
# Negativni needle (must_miss) zahteva, da komentar NE vsebuje literal-needleja
# (lekcija R304 1). Build PREJ pred needleji (R300 lekcija 3).
set -u
cd /home/z/my-project
OUT=/tmp/r307-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# --- AWK strukturna preverba (r270 lekcija 2; r296-r305 vzorec) ---
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

echo "--- R307 MANDATORY — KONFLIKTNI DOKAZ NA ZASLONU (37. clen, ZASLON) ---"
need_static "konflikti-dokaz" "R307 blok testid (dokaz parov)"
need_static "konfliktiDokaz: " "R307 lib graditelj prek TypeError STRING kanona (R302 lekcija 1)"
need_static "Dokazani pari prekrivanj ekipe" "R307 aria-label (blok)"
need_static "Dokazani pari prekrivanj" "R307 naslov (vidno besedilo)"
need_static "Pregledanih " "R307 sklep stevec (resnica obsega — WYSIWYG s CSV meta/PDF KPI)"
need_static "ISTI pari in ISTI vrstni red kot Konflikti CSV in Konflikti PDF" "R307 definicijski naslov — EN VIR pravilo (WYSIWYG)"
need_static "ZASLON = takoj na pogled" "R307 definicijski naslov — vidna razlika medija (Excel/tisk → takoj)"
need_static "poli-odprto pravilo" "R307 definicijski naslov — pravilo (nazaj-na-nazaj dovoljen)"
need_static "nazaj-na-nazaj" "R307 definicijski naslov — konkretno pravilo"
need_static "Pregledanih = aktivni termini" "R307 sklep title — iskrena obsega resnica"
need_static "font-medium text-roksal-red" "R307 ekipa RED zig (dokazna resnica — pariteta CSV/PDF)"
echo "--- R307 must_miss (negativni) ---"
must_miss "TODO-R307" "R307 — brez razvojnih ostankov"

echo "R307 lastni needleji: FAIL=$FAIL (11 novih + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r306-build-needles.sh (R306+R305+…+R227) ==="
REG=0
bash scripts/r306-build-needles.sh || REG=1
echo "=== R307 SKUPNA RESNICA: R307 FAIL=$FAIL, regresije FAIL=$REG ==="
[ "$FAIL" = "0" ] && [ "$REG" = "0" ] || exit 1
echo "R307 NEEDLES VSE ZELENE (R307 ×11 + regresije)"
exit 0
