#!/bin/bash
# R320 — build needleji: 49. člen issue #1 «IZVOZ POROČILA KONČNE
# VERIFIKACIJE KOT PDF» (IZVOZI družina: PDF brat JSON R316 — vzorec R318
# audit-pdf: LOČEN lib; NOV lib buildKoncnaVerifikacijaPdfDoc = ČISTA
# projekcija koncnaVerifikacija validacije — EN VIR: sklep = PETI potrošnik
# ENEGA niza; kriteriji verbatim; determinističen PDF [fiksni formatni žig
# KONCNA_PDF_ZIG_FIKSNI + FNV soli 0xc5–0xc8; brez časa v vsebini — isti
# HEAD = bajtno identična datoteka, kanon 46./47./48. člen]; vodja
# končna-verifikacija blok dobi gumb PDF [a11y izvozne družine R291/R293;
# amber/50 register ×4→×5; press-scale val9 register 11→12; fail-verbose
# toast]; vitest r320-koncna-verifikacija-pdf ×9; E2E Z0aq DETERMINIZEM ŽIVO
# NA BAJTIH: dva izvoza bajtno enaka + %PDF- magija + MIME application/pdf)
#   POZITIVNI needleji (build): PDF izvoz aria + filename (vodja chunk).
#   MUST_MISS (build): TODO-R320 + stari brez-PDF-gumba ni pripisljiv
#   (dodajanje gumba je aditivno — NI must_miss kandidata za gumb; stari
#   r318 vzorci ostanejo ŽIVO — regresijski pokritost prek delegacije).
#   + (1) regresije: r318-build-needles.sh (R318 + R317 + … polna veriga do
#   R227 — DELEGACIJA; red: r318 → r317 → …).
# LEKCIJA R289/R299-R318 (ASCII kanon): needleji = ASCII/UTF-8 string
# literali; komentarji odstranjeni v buildu. Build PREJ pred needleji.
set -u
cd /home/z/my-project
OUT=/tmp/r320-build-chunks
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

echo "--- R320 MANDATORY — 49. člen: izvoz poročila končne verifikacije kot PDF (IZVOZI družina) ---"
need_static "Izvozi poročilo končne verifikacije kot PDF" "R320 PDF izvoz gumb aria (vodja chunk)"
need_static "koncna-verifikacija.pdf" "R320 PDF izvoz filename (vodja handler)"
echo "--- R320 must_miss (negativni) ---"
must_miss "TODO-R320" "R320 — brez razvojnih ostankov"
echo "R320 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r318-build-needles.sh (R318+R317+…+R227) ==="
REG=0
bash scripts/r318-build-needles.sh || REG=1
if [ "$REG" = "1" ]; then echo "REGRESIJA FAIL"; exit 1; fi
if [ "$FAIL" = "1" ]; then echo "R320 NEEDLEJI FAIL"; exit 1; fi
echo "=== R320 BUILD NEEDLES VSE OK ==="
