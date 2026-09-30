#!/bin/bash
# R321 — build needleji: 50. člen issue #1 «IZVOZ MERITEV ZMOGLJIVOSTI KOT
# PDF» (IZVOZI družina: brat zaslona R312 — vzorec R318/R320: LOČEN lib; NOV
# lib buildZmogljivostPdfDoc = ČISTA projekcija POSREDOVANEGA pregleda —
# meritev se izvede ENKRAT v brskalniku, PDF NE meri znova; EN VIR:
# formatirajMs zaslon + PDF iz brata; sklep = TRETJI potrošnik ENEGA niza;
# determinističen PDF [fiksni formatni žig ZMOGLJIVOST_PDF_ZIG_FIKSNI + FNV
# soli 0xc9–0xcc; brez časa v vsebini — isti HEAD + ista meritev = bajtno
# identična datoteka, kanon 46.–49. člen]; vodja zmogljivost-dokaz blok dobi
# gumb PDF [a11y izvozne družine R291/R293; amber/50 register ×5→×6;
# press-scale val9 register 12→13; fail-verbose toast + iskrena ničelna
# veja]; vitest r321-zmogljivost-pregled-pdf ×10; E2E Z0ar DETERMINIZEM ŽIVO
# NA BAJTIH: dva izvoza bajtno enaka + %PDF- magija + MIME application/pdf;
# STIL val 10: dokazni bloki vrstični hover ×3 — r321-stil-val10 STRAŽAR)
#   POZITIVNI needleji (build): PDF izvoz aria + filename (vodja chunk).
#   MUST_MISS (build): TODO-R321 + stari brez-PDF-gumba ni pripisljiv
#   (dodajanje gumba je aditivno — NI must_miss kandidata za gumb; stari
#   r320 vzorci ostanejo ŽIVO — regresijska pokritost prek delegacije).
#   + (1) regresije: r320-build-needles.sh (R320 + R318 + R317 + … polna
#   veriga do R227 — DELEGACIJA; r319 generacije ni — vzporedna seja je
#   ustvarila teste, ne verige; red: r320 → r318 → r317 → …).
# LEKCIJA R289/R299-R318 (ASCII kanon): needleji = ASCII/UTF-8 string
# literali; komentarji odstranjeni v buildu. Build PREJ pred needleji.
set -u
cd /home/z/my-project
OUT=/tmp/r321-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# --- AWK strukturna preverba (r270 lekcija 2; r296-r318 vzorec) ---
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

echo "--- R321 MANDATORY — 50. člen: izvoz meritev zmogljivosti kot PDF (IZVOZI družina) ---"
need_static "Izvozi meritve zmogljivosti kot PDF" "R321 PDF izvoz gumb aria (vodja chunk)"
need_static "zmogljivost-pregled.pdf" "R321 PDF izvoz filename (vodja handler)"
echo "--- R321 must_miss (negativni) ---"
must_miss "TODO-R321" "R321 — brez razvojnih ostankov"
echo "R321 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r320-build-needles.sh (R320+R318+R317+…+R227) ==="
REG=0
bash scripts/r320-build-needles.sh || REG=1
if [ "$REG" = "1" ]; then echo "REGRESIJA FAIL"; exit 1; fi
if [ "$FAIL" = "1" ]; then echo "R320 NEEDLEJI FAIL"; exit 1; fi
echo "=== R321 BUILD NEEDLES VSE OK ==="
