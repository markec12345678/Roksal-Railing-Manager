#!/bin/bash
# R312 — build needleji: 42. člen issue #1 «MERITVE ZMOGLJIVOSTI» (Deliverable
# 6 — lib zmogljivost-pregled: realne meritve pomembnih determinističnih
# operacij jedra na fiksni vhodih, vsak izhod preverjen, fail-closed; DI ura
# za determinizem; vodja-dashboard blok WYSIWYG, izris ŠELE v brskalniku) +
# MANDATORY STIL val 3 (dashboard-tab ×16 + logistics-tab ×7 + webxr-scanner
# ×8 — surove amber → roksal žetoni, 0 novih hex; 2 izrecni izjemi
# [STATUS_COLORS.V_TEKU + EQUIPMENT_STATUS_COLORS.V_SERVISU — kategorije barv
# med sorodniki, R308 lekcija + R234 komentar] zaklenjeni na SOURCE nivoju:
# r312 STRAŽAR test).
#   POZITIVNI needleji (build): testidi + naslov + vrstica literal + sklep
#   fragmenti (lib template literali preživijo kot string literali) + iskren
#   SSR stan + STIL žetoni (baner / pilona / Badge žeton besedilo).
#   MUST_MISS (build): SAMO enolično pripisljivi surovi vzorci (lekcija R308 3
#   — bg-amber-50/70 + text-amber-700/90 sta bila UNIKATNA za dashboard-tab
#   banerja; deljene surove sekvene [cv-studio border-amber-300, …] → SOURCE
#   nivo r312 STRAŽAR test).
#   + (1) regresije: r311-build-needles.sh (R311 + R310 + … polna veriga do
#   R227 — DELEGACIJA).
# LEKCIJA R289/R299-R311 (ASCII kanon): needleji = ASCII literali + imena
# lastnosti + string literali; komentarji odstranjeni v buildu. Build PREJ
# pred needleji (R300 lekcija 3; R308 lekcija 1).
set -u
cd /home/z/my-project
OUT=/tmp/r312-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# --- AWK strukturna preverba (r270 lekcija 2; r296-r311 vzorec) ---
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

echo "--- R312 MANDATORY — 42. člen: meritve zmogljivosti jedra (lib + vodja blok) ---"
need_static "zmogljivost-dokaz" "R312 blok testid (vodja chunk)"
need_static "zmogljivost-vrstica" "R312 vrstica testid (8 meritev)"
need_static "zmogljivost-sklep" "R312 sklep testid"
need_static "Meritve zmogljivosti jedra" "R312 naslov (aria + glava — EN VIR literals)"
need_static "Merjeno na tej napravi: " "R312 sklep fragment (lib template literal — WYSIWYG)"
need_static "vsi izhodi preverjeni — časi so resnična meritev" "R312 sklep iskrenost fragment (lib)"
need_static "struktura in izhodi deterministični" "R312 sklep determinizem fragment (lib)"
need_static "· vsi izhodi preverjeni" "R312 vrstica literal (zaslon nosi preverbo)"
need_static "merjenje teče …" "R312 iskren SSR stan (nič hydration laži)"
need_static "brez izvedene meritve ni izmišljenih števil" "R312 fail-closed izris (nič izmišljenih)"
need_static "najmanj / mediana / največ (ms)" "R312 tooltip merila (iskrena resnica obsega)"
echo "--- R312 MANDATORY STIL — val 3: dashboard/logistics/webxr surove amber → žetoni ---"
need_static "border border-roksal-amber/40 bg-roksal-amber/10 px-2.5 py-2" "R312 dashboard baner žeton vsebnik (×2 — OBE temi)"
need_static "bg-roksal-amber/15 text-roksal-amber hover:bg-roksal-amber/25" "R312 Badge žeton besedilo (vzorec rdečega sorojenca)"
need_static "border-roksal-amber/40 bg-roksal-amber/10 px-1.5 py-0.5 text-roksal-ink" "R312 logistics kalibracijska pilona (žeton + ink)"
need_static "border-roksal-amber/40 bg-roksal-amber/10 text-roksal-amber" "R312 webxr opozorilna pila (žetoni temna površina)"
echo "--- R312 must_miss (negativni — SAMO enolično pripisljivi; deljene surove sekvene → SOURCE nivo r312 STRAŽAR) ---"
must_miss "bg-amber-50/70" "R312 dashboard surovi baner (izginil — unikatni /70 fragment)"
must_miss "text-amber-700/90" "R312 dashboard surovo baner telo (izginilo — unikatni fragment)"
must_miss "TODO-R312" "R312 — brez razvojnih ostankov"
echo "R312 lastni needleji: FAIL=$FAIL (11 zmogljivost + 4 STIL + 3 must_miss)"
echo "=== REGRESIJE: polna veriga prek r311-build-needles.sh (R311+R310+…+R227) ==="
REG=0
bash scripts/r311-build-needles.sh || REG=1
if [ "$REG" = "1" ]; then echo "REGRESIJA FAIL"; exit 1; fi
if [ "$FAIL" = "1" ]; then echo "R312 NEEDLEJI FAIL"; exit 1; fi
echo "=== R312 BUILD NEEDLES VSE OK ==="
