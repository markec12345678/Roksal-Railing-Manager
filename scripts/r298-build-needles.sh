#!/bin/bash
# R298 — build needleji: (0) TEDENSKI VOZNI RED ICS (28. člen 'izvozi'
# družine — ICS brat PDF R256 + CSV R292): pill aria/title, lib EN VIR
# graditelj, X-ROKSAL-OBSEG resnica, fail-closed toast, legenda + R298 STIL
# (razgled definicijski naslovi — izrečena resnica)
#       + (1) regresije: r297-build-needles.sh (R297 ×13 + R296 ×13 + R295 ×13
# + R294 ×8 + R293/R292/R291/R290 + … polna veriga do R227 — DELEGACIJA: isti
# chunk vzorec, dva teka, ENA kombinirana FAIL resnica).
# LEKCIJA R289 (ASCII kanon) + R295/R296/R297 (delegacija + minifier): needleji
# = JSX/title literali + lib export imena (dokazano preživetja) + meta stringi.
# LOKALNA imena funkcij (icsKonecUtc/icsStatus) NE preživijo minifierja.
set -u
cd /home/z/my-project
OUT=/tmp/r298-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# --- AWK strukturna preverba (r270 lekcija 2; r296/r297 vzorec) ---
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

echo "--- R298 MANDATORY — TEDENSKI VOZNI RED ICS (28. člen 'izvozi' družine) ---"
need_static "Izvozi tedenski pregled montaž kot ICS koledar" "R298 gumb aria-label"
need_static "Tedenski pregled montaž kot ICS — naslednjih 7 dni v telefonov koledar (ekipa uvozi razpored; ure in statusi iz iste resnice kot PDF/CSV)" "R298 gumb hover title (definicijski naslov)"
need_static "tedenskiVozniRedIcsVrstice" "R298 lib EN VIR graditelj (vzorec R295/R296)"
need_static "tedenskiVozniRedIcsFilename" "R298 ime datoteke (bratje PDF R256 / CSV R292)"
need_static "Tedenski-vozni-red-" "R298 predpona imena (družinski vzorec)"
need_static "-//Roksal//Tedenski vozni red//SL" "R298 PRODID literal (RFC 5545 §3.7.3)"
need_static "X-ROKSAL-OBSEG:" "R298 obseg meta (ICS analog CSV 'Obseg' — RFC X- prostor)"
need_static "Naslednjih 7 dni: " "R298 obseg vsebina (ISTI izpis kot CSV meta / PDF naslov)"
need_static "ICS se izvozi, ko je vpisan termin v prihajajočem tednu." "R298 iskren toast opis (fail-closed vrata)"
need_static "Tedenski vozni red prenešen v ICS" "R298 uspeh toast (WYSIWYG)"
need_static "Izvoz ICS ni uspel" "R298 fail-verbose catch (R291/R292 vzorec)"
need_static "Tedenski ICS" "R298 pill oznaka"
echo "--- R298 legenda + STIL — definicijski naslovi razgleda (izrečena resnica) ---"
need_static "Tedenski ICS = naslednjih 7 dni v telefonov koledar" "R298 legenda (poimenovana razlika)"
need_static "Brez terminov — iskreno prazen dan" "R298 definicijski naslov števca (prazen dan)"
need_static "Vsi vidni termini dneva (preklicani ŠTETI — viden odpad)" "R298 definicijski naslov števca (zapolnjen dan)"
need_static "(danes + " "R298 definicijski naslov datuma (okno izpeljava izrečena)"
echo "--- R298 must_miss (negativni) ---"
must_miss "TODO-R298" "R298 — brez razvojnih ostankov"

echo "R298 lastni needleji: FAIL=$FAIL (17 novih + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r297-build-needles.sh (R297+R296+R295+…+R227) ==="
REG=0
bash scripts/r297-build-needles.sh || REG=1
echo "=== R298 SKUPNA RESNICA: R298 FAIL=$FAIL, regresije FAIL=$REG ==="
[ "$FAIL" = "0" ] && [ "$REG" = "0" ] || exit 1
echo "R298 NEEDLES VSE ZELENE (R298 ×17 + regresije)"
exit 0
