#!/bin/bash
# R309 — build needleji: MIGRACIJSKI VAL I/O MEJE — 26 throw-style json()
# handlerjev (32 klicnih mest) + calculator → EN VIR guard src/lib/api-telo
# (vzorec calculator R308, dvignjen v EN VIR). Pokvarjen JSON = 400 NAPAKA
# ODJEMALCA, nikoli 500 — na VSEH mutirajočih rutah (razen /api/sync —
# kontrakt NIČ, izrecno izvzet).
# POZITIVNI needleji: EN VIR sporočilo (string literal) + uvožena funkcija
# preberiJsonTelo (vezava uvoza preživi minifikacijo — ×38 čankov = dokaz,
# da VSI 27 potrošnikov res konzumirajo helper v BUILT artefaktu, ne samo
# v viru). API_TELO_NAPAKA kot ime lastnosti NE preživi (webpack vstavi
# vrednost inline — konstanto uvozi samo test) — njena obstoj na virov
# nivoju pokriva r309-api-telo.test.ts. MUST_MISS: 4 surovi STIL vzorci
# (vsi 4 dokazano prisotni v R308 buildu — izginili z harmonizacijo);
# negativne I/O-MEJA trditve (nič surovega
# await request.json() v 26 handlerjih; sync izvzet) živijo na VIROV
# nivoju v r309-api-telo.test.ts STRAŽAR-ih; 'Neveljaven JSON.' /
# INVALID_JSON legitimno ostanejo v vision/scene + measurement/detect
# (lastne iskrene garde, izven migracijskega seznama) in sync (izvzet).
# + (1) regresije: r308-build-needles.sh (R308 + R307 + ... polna veriga
# do R227 — DELEGACIJA).
# LEKCIJA R289/R299-R308 (ASCII kanon): needleji = ASCII literali + imena
# lastnosti + string literali; komentarji odstranjeni v buildu. Build PREJ
# pred needleji (R300 lekcija 3; R308 lekcija 1).
set -u
cd /home/z/my-project
OUT=/tmp/r309-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# --- AWK strukturna preverba (r270 lekcija 2; r296-r308 vzorec) ---
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

echo "--- R309 MANDATORY — MIGRACIJSKI VAL I/O MEJE (EN VIR api-telo, 38+1. clen nadaljevanje) ---"
need_static "Neveljavno telo zahteve — pričakovan JSON objekt" "R309 EN VIR sporočilo (string literal preživi — izključno v lib čanku)"
need_static "preberiJsonTelo" "R309 uvožena funkcija (vezava uvoza preživi — dokaz potrošnikov v buildu)"
echo "  info: čankov s preberiJsonTelo vezavo = $(grep -rl 'preberiJsonTelo' "$OUT" 2>/dev/null | wc -l) (pričakovano ≥27 — 27 potrošnikov ± dvojniki čankov)"
echo "--- R309 MANDATORY STIL — invoice-manager surove palete harmonizirane (0 novih hex) ---"
need_static "bg-roksal-green/10 text-roksal-ink border-roksal-green/40" "R309 PLACAN značka (žeton + ink tekst — r162 lekcija)"
need_static "border-roksal-green/30 bg-roksal-green/10" "R309 Plačano KPI kartica (žeton)"
need_static "bg-roksal-amber text-roksal-navy hover:bg-roksal-amber/90 press-scale" "R309 Nov račun CTA (žetona namesto surovega para)"
need_static "border-l-roksal-green" "R309 vrstična letvica PLACAN (žeton)"
echo "--- R309 must_miss (negativni — SAMO enolično pripisljivi invoice-manager vzorci; surova značka bg-amber-50+text-amber-700 je deljena s 5 drugimi tabs [punch-list, team, deal-pipeline, measurements, material-intelligence] → na build nivoju NE pripisljiva — lekcija R308 3 na pravi plasti; njena odsotnost v invoice-manager SOURCE dokazuje r309 STIL must_miss) ---"
must_miss "bg-amber-500 text-navy-900" "R309 surov CTA par (izginil — žetona roksal-amber/roksal-navy)"
must_miss "border-l-emerald-500" "R309 surova letvica (izginila — roksal-green/amber/red letvice)"
must_miss "border-emerald-200 dark:border-emerald-800 bg-emerald-50" "R309 surova KPI kartica (izginila — žetoni)"
echo "R309 lastni needleji: FAIL=$FAIL (6 pozitivnih [2 meja + 4 STIL] + 3 must_miss [enolično pripisljivi surovi vzorci izginili])"
echo "=== REGRESIJE: polna veriga prek r308-build-needles.sh (R308+R307+…+R227) ==="
REG=0
bash scripts/r308-build-needles.sh || REG=1
echo "=== R309 SKUPNA RESNICA: R309 FAIL=$FAIL, regresije FAIL=$REG ==="
[ "$FAIL" = "0" ] && [ "$REG" = "0" ] || exit 1
echo "R309 NEEDLES VSE ZELENE (R309 ×6+3 + regresije)"
exit 0
