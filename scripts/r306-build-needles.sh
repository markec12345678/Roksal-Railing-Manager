#!/bin/bash
# R306 — build needleji: (0) OPREMA CIKEL DOKAZ NA ZASLONU (36. clen 'izvozi'
# druzine, bralni ZASLONSKI): zaslon brat Cikel PDF R266 + Cikel CSV R297 —
# dokaz blok (testidi + aria + definicijski naslov pravil + sklep dvojni
# stetje / zelen ziga veja + 4 zigi pariteta), memo EN VIR refactor (ENA
# izpeljava pregleda R266) + (1) regresije: r305-build-needles.sh (R305 x11 +
# R304 x11 + ... polna veriga do R227 — DELEGACIJA).
# LEKCIJA R289/R299-R305 (ASCII kanon): needleji = ASCII literali + testidi +
# CSS razredi; '.' in diakritiki v stringih prezrti ('zigi' namesto 'zigi');
# komentarji odstranjeni v buildu — needleji zivijo v atributih/besedilu.
# Negativni needle (must_miss) zahteva, da komentar NE vsebuje literal-needleja
# (lekcija R304 1). Build PREJ pred needleji (R300 lekcija 3).
set -u
cd /home/z/my-project
OUT=/tmp/r306-build-chunks
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

echo "--- R306 MANDATORY — OPREMA CIKEL DOKAZ NA ZASLONU (36. clen, ZASLON) ---"
need_static "opremaCikelDokaz: " "R306 lib graditelj prek TypeError STRING kanona (R302 lekcija 1)"
need_static "oprema-cikel-dokaz-prazno" "R306 prazna veja testid (zelen ziga — iskrena praznina)"
need_static "oprema-cikel-dokaz-sklep" "R306 sklep veja testid (iskren dvojni stevec vrstic/zigov)"
need_static "Oprema za poskrbeti" "R306 naslov (vidno besedilo)"
need_static "Oprema, ki potrebuje akcijo" "R306 aria-label (blok)"
need_static "ZASLON = takoj na pogled" "R306 definicijski naslov — vidna razlika medija (tisk/Excel → takoj)"
need_static "kot Cikel PDF in Cikel CSV" "R306 definicijski naslov — EN VIR pravilo (WYSIWYG)"
need_static "Nemerska oprema" "R306 sivi zig naslov (kalNeZahteva NI alarm)"
need_static "border-roksal-amber/40" "R306 AMBER zigi (nezabelezen pregled + kalibracija brez roka)"
need_static "Vrstic " "R306 sklep tekst (dvojni stevec — N ≤ M)"
need_static "je brez zapadlih pregledov in potečenih kalibracij" "R306 zelen ziga tekst (nikoli skrit — kanon R292)"
need_static "pregled nezabeležen" "R306 AMBER zig label"
echo "--- R306 must_miss (negativni) ---"
must_miss "TODO-R306" "R306 — brez razvojnih ostankov"

echo "R306 lastni needleji: FAIL=$FAIL (11 novih + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r305-build-needles.sh (R305+R304+…+R227) ==="
REG=0
bash scripts/r305-build-needles.sh || REG=1
echo "=== R306 SKUPNA RESNICA: R306 FAIL=$FAIL, regresije FAIL=$REG ==="
[ "$FAIL" = "0" ] && [ "$REG" = "0" ] || exit 1
echo "R306 NEEDLES VSE ZELENE (R306 ×11 + regresije)"
exit 0
