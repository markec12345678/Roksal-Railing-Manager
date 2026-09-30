#!/bin/bash
# R318 — build needleji: 48. člen issue #1 «IZVOZ AVTOMATIZACIJSKEGA AUDITA
# KOT PDF» (IZVOZI družina: PDF brat CSV R317 — vzorec R302; NOV lib
# buildAvtomatizacijaAuditPdfDoc = ČISTA projekcija AVTOMATIZACIJA_AUDIT prek
# avtomatizacijaPregled validacije — EN VIR: AUDIT_CSV_GLAVE + AUDIT_VIR_NIZ
# UVOŽENA iz CSV brata; determinističen PDF [fiksni formatni žig
# AUDIT_PDF_ZIG_FIKSNI + FNV soli 0xc1–0xc4; brez časa v vsebini — isti HEAD
# = bajtno identična datoteka, kanon 46./47. člen]; vodja avtomatizacija-dokaz
# blok dobi gumb PDF [a11y izvozne družine R291/R293; amber/50 ring — register
# val8 ×3 → ×4; fail-verbose toast]; vitest r318-avtomatizacija-audit-pdf ×9;
# E2E Z0ap DETERMINIZEM ŽIVO NA BAJTIH: dva izvoza bajtno enaka + %PDF- magija)
# + MANDATORY STIL val 9 (press-scale mikrointerakcija ×5 na vodja izvoznih
# gumbov — taktilna pariteta s pill bratje R258/R261/R293 v ISTI datoteki;
# r318-stil-val9 STRAŽAR ×4: vseh 5 gumbov + obrnjena regresija pill + utility
# anti-stale + register pojavitev 11).
#   POZITIVNI needleji (build): PDF izvoz aria + title fragment + filename
#   (vodja chunk) + STIL press-scale v amber-hover gumbi (×5, R318-nov
#   unikaten sekvenca — HEAD: 0).
#   MUST_MISS (build): TODO-R318 + stari brez-press-scale vzorec vodja glavnih
#   gumbov (unikaten text-2xs rep — izginil).
#   + (1) regresije: r317-build-needles.sh (R317 + R316 + … polna veriga do
#   R227 — DELEGACIJA; red: r317 → r316 → …).
# LEKCIJA R289/R299-R317 (ASCII kanon): needleji = ASCII/UTF-8 string
# literali; komentarji odstranjeni v buildu. Build PREJ pred needleji.
set -u
cd /home/z/my-project
OUT=/tmp/r318-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# --- AWK strukturna preverba (r270 lekcija 2; r296-r317 vzorec) ---
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

echo "--- R318 MANDATORY — 48. člen: izvoz avtomatizacijskega audita kot PDF (IZVOZI družina) ---"
need_static "Izvozi avtomatizacijski audit kot PDF" "R318 PDF izvoz gumb aria (vodja chunk)"
need_static "kot deterministični PDF" "R318 PDF izvoz title fragment (vodja chunk)"
need_static "avtomatizacija-audit.pdf" "R318 PDF izvoz filename (vodja handler)"
echo "--- R318 MANDATORY STIL — val 9: press-scale taktilna pariteta vodja izvozne družine ---"
need_static "press-scale transition-all hover:border-roksal-amber hover:bg-roksal-amber/10" "R318 vodja amber-hover gumbi z press-scale (×5 — R318-nov sekvenca)"
echo "--- R318 must_miss (negativni — SAMO enolično pripisljivi stari vzorci) ---"
must_miss "text-2xs text-roksal-ink transition-all hover:border-roksal-amber" "R318 stari vodja glavni gumbi brez press-scale (izginil — unikaten text-2xs rep)"
must_miss "TODO-R318" "R318 — brez razvojnih ostankov"
echo "R318 lastni needleji: FAIL=$FAIL (3 izvoz + 1 STIL + 2 must_miss)"
echo "=== REGRESIJE: polna veriga prek r317-build-needles.sh (R317+R316+…+R227) ==="
REG=0
bash scripts/r317-build-needles.sh || REG=1
if [ "$REG" = "1" ]; then echo "REGRESIJA FAIL"; exit 1; fi
if [ "$FAIL" = "1" ]; then echo "R318 NEEDLEJI FAIL"; exit 1; fi
echo "=== R318 BUILD NEEDLES VSE OK ==="
