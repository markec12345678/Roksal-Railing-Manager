#!/bin/bash
# R313 — build needleji: 43. člen issue #1 «MERITVE ZMOGLJIVOSTI — PDF
# RAZŠIRITEV» (Deliverable 6 dopolnitev: 2 realni PDF meritvi v bench —
# konflikti.pdf [fonts + autoTable + bajti] + racuni-projekti.pdf
# [12 računov × 4 projekti]; vsak izhod preverjen z %PDF- magijo; ops 8 →
# 10, 1800 → 1810 iteracij) + MANDATORY STIL val 4 (cv-studio ×26 +
# measurement-studio ×5 + crm-tab ×7 = 38 mest — surove amber → roksal
# žetoni, 0 novih hex; 5 izrecnih izjem [legend beseda, barvno kodirani
# stanji kakovosti ×3, POTENCIALEN status — R308/R234 lekcije] zaklenjenih
# na SOURCE nivoju: r313 STRAŽAR blok v r312 testu).
#   POZITIVNI needleji (build): PDF op id-ji + opisi (string literali
#   preživijo minifikacijo) + STIL žetoni (Alert družina, POTRDITEV značka,
#   crm KPI žeton kartica, solid amber hover).
#   MUST_MISS (build): SAMO enolično pripisljivi surovi vzorci
#   (border-amber-300 bg-amber-50 py-2 — unikatna cv-studio Alert sekvenca;
#   deljene surove sekvene → SOURCE nivo r313 STRAŽAR blok).
#   + (1) regresije: r312-build-needles.sh (R312 + R311 + … polna veriga do
#   R227 — DELEGACIJA).
# LEKCIJA R289/R299-R312 (ASCII kanon): needleji = ASCII literali + imena
# lastnosti + string literali; komentarji odstranjeni v buildu. Build PREJ
# pred needleji (R300 lekcija 3; R308 lekcija 1).
set -u
cd /home/z/my-project
OUT=/tmp/r313-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# --- AWK strukturna preverba (r270 lekcija 2; r296-r312 vzorec) ---
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

echo "--- R313 MANDATORY — 43. člen: PDF meritve (Deliverable 6 razširitev) ---"
need_static "konflikti.pdf" "R313 konflikti.pdf op id (lib string literal)"
need_static "Konflikti PDF dokument (fonts + autoTable + bajti)" "R313 konflikti.pdf opis — LIVE"
need_static "racuni-projekti.pdf" "R313 racuni-projekti.pdf op id"
need_static "Računi po projektih PDF (12 računov × 4 projekti)" "R313 racuni-projekti.pdf opis — LIVE"
echo "--- R313 MANDATORY STIL — val 4: cv-studio/measurement-studio/crm surove amber → žetoni ---"
need_static "border-roksal-amber/40 bg-roksal-amber/10 py-2" "R313 cv-studio Alert vsebniki (×3) — LIVE"
need_static "border-roksal-amber/40 bg-roksal-amber/10 text-roksal-ink" "R313 cv-studio POTRDITEV značka cls žeton (R311 POTRJENO vzorec; objektna struktura minificirana — lekcija) — LIVE"
need_static "border-roksal-amber/40 bg-roksal-amber/10 p-2 text-[11px] text-roksal-ink" "R313 measurement-studio vsebniki (p-2) — LIVE"
need_static "border-roksal-amber/30" "R313 crm Opomniki KPI kartica žeton (družinska resnica — R225/R311 vzorec; JSX sintaksa ne preživi — lekcija) — LIVE"
need_static "text-lg font-bold text-roksal-amber tabular-nums" "R313 crm KPI števec žeton (R225 precedens) — LIVE"
need_static "hover:bg-roksal-amber hover:text-roksal-navy" "R313 crm hover Uredi (solid amber + navy — R311 družina, r162 onLight) — LIVE"
echo "--- R313 must_miss (negativni — SAMO enolično pripisljivi; deljene surove sekvene → SOURCE nivo r313 STRAŽAR) ---"
must_miss "border-amber-300 bg-amber-50 py-2" "R313 cv-studio surovi Alert (izginil — unikatna sekvenca)"
must_miss "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30 shrink-0" "R313 crm surovi Opomnik Badge (izginil — unikaten shrink-0 rep)"
must_miss "TODO-R313" "R313 — brez razvojnih ostankov"
echo "R313 lastni needleji: FAIL=$FAIL (4 PDF + 6 STIL + 3 must_miss)"
echo "=== REGRESIJE: polna veriga prek r312-build-needles.sh (R312+R311+…+R227) ==="
REG=0
bash scripts/r312-build-needles.sh || REG=1
if [ "$REG" = "1" ]; then echo "REGRESIJA FAIL"; exit 1; fi
if [ "$FAIL" = "1" ]; then echo "R313 NEEDLEJI FAIL"; exit 1; fi
echo "=== R313 BUILD NEEDLES VSE OK ==="
