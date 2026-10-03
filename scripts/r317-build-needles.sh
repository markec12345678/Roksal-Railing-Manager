#!/bin/bash
# R317 — build needleji: 47. člen issue #1 «IZVOZ AVTOMATIZACIJSKEGA AUDITA
# KOT CSV» (IZVOZI družina: NOV lib izvoz avtomatizacijaAuditCsv = ČISTA
# projekcija AVTOMATIZACIJA_AUDIT prek avtomatizacijaPregled validacije —
# deterministični CSV (BOM + CRLF + RFC 4180, brez metapodatkov časa/hash);
# gumb v avtomatizacija-dokaz bloku na vodji z a11y družino aria-label +
# title; vitest r317-avtomatizacija-audit-csv ×7; E2E Z0ao DETERMINIZEM ŽIVO:
# dva izvoza bajtno enaka)
# + MANDATORY STIL val 8 (izrecni focus-visible ring žetoni po IZVOZNI
# družini — 53 gumbov: 1 harmonizacija site-survey + 2 popravka ring-2
# širine deal-pipeline/rate-limit + NOV audit CSV gumb vodja amber/50;
# registri r317-stil-val8 STRAŽAR — GLOBALNI sken kanon).
#   POZITIVNI needleji (build): CSV izvoz aria + title fragment + filename
#   (vodja chunk) + STIL žetoni (amber/50+offset vodja par, navy/40 družina,
#   site-survey harmonizirana vrstica).
#   MUST_MISS (build): SAMO enolično pripisljivi stari brez-ring-2 vzorci
#   (deal-pipeline 'px-2 text-xs …' brez ring-2; rate-limit 'h-8 px-2 …'
#   brez ring-2; site-survey stara vrstica brez ringa).
#   + (1) regresije: r316-build-needles.sh (R316 + R315 + … polna veriga do
#   R227 — DELEGACIJA; red: r316 → r315 → …).
# LEKCIJA R289/R299-R316 (ASCII kanon): needleji = ASCII/UTF-8 string
# literali; komentarji odstranjeni v buildu. Build PREJ pred needleji.
set -u
cd /home/z/my-project
OUT=/tmp/r317-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# --- AWK strukturna preverba (r270 lekcija 2; r296-r316 vzorec) ---
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

echo "--- R317 MANDATORY — 47. člen: izvoz avtomatizacijskega audita kot CSV (IZVOZI družina) ---"
need_static "Izvozi avtomatizacijski audit kot CSV" "R317 CSV izvoz gumb aria (vodja chunk)"
need_static "kot deterministični CSV" "R317 CSV izvoz title fragment (vodja chunk)"
need_static "avtomatizacija-audit.csv" "R317 CSV izvoz filename (vodja handler)"
echo "--- R317 MANDATORY STIL — val 8: izvozna družina — izrecni focus-visible ring žetoni ---"
need_static "focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2" "R317 vodja amber ring par (blok glave ×3)"
# EVOLVED R383 val 61: site-survey L535 je dobil O2+FB+dark (A/offset + C/border zaključek) —
# žeton razširjen na končno obliko; SEMANTIKA ostaja (harmoniziran ring na PDF gumbu).
need_static "focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40 dark:focus-visible:border-roksal-ink/40 focus-visible:outline-hidden" "R317 site-survey PDF gumb harmoniziran ring (žeton) [EVOLVED R394 val 70: outline-none→outline-hidden — forced-colors fokus pariteta]"
need_static "focus-visible:ring-2 focus-visible:ring-roksal-navy/40" "R317 družinski navy ring (širina ring-2)"
echo "--- R317 must_miss (negativni — SAMO enolično pripisljivi stari brez-ring-2 vzorci) ---"
must_miss "px-2 text-xs focus-visible:ring-roksal-navy/40" "R317 deal-pipeline stari ring brez širine (izginil — unikaten px-2 rep)"
must_miss "h-8 px-2 transition-colors hover:text-roksal-ink focus-visible:ring-roksal-navy/40" "R317 rate-limit stari ring brez širine (izginil — unikaten h-8 px-2 rep)"
must_miss "px-2.5 text-[11px] font-bold text-roksal-ink hover:bg-roksal-amber/10" "R317 site-survey stara vrstica brez ringa (izginil — unikaten rep)"
must_miss "TODO-R317" "R317 — brez razvojnih ostankov"
echo "R317 lastni needleji: FAIL=$FAIL (3 izvoz + 3 STIL + 4 must_miss)"
echo "=== REGRESIJE: polna veriga prek r316-build-needles.sh (R316+R315+…+R227) ==="
REG=0
bash scripts/r316-build-needles.sh || REG=1
if [ "$REG" = "1" ]; then echo "REGRESIJA FAIL"; exit 1; fi
if [ "$FAIL" = "1" ]; then echo "R317 NEEDLEJI FAIL"; exit 1; fi
echo "=== R317 BUILD NEEDLES VSE OK ==="
