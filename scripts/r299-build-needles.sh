#!/bin/bash
# R299 — build needleji: (0) TEDENSKI ICS PO EKIPAH (29. člen 'izvozi'
# družine — izpeljani brat ICS R298): čipi aria/title, EN VIR lib graditelji,
# X-ROKSAL-EKIPA resnica, fail-closed toasta, legenda + MANDATORY STIL
# (definicijski naslovi čipov — izrečena resnica filtra)
#       + (1) regresije: r298-build-needles.sh (R298 ×17 + R297 ×13 + R296 ×13
# + R295 ×13 + R294 ×8 + … polna veriga do R227 — DELEGACIJA).
# LEKCIJA R289 (ASCII kanon) + R295-R298 (delegacija + minifier): needleji
# = JSX/title literali + lib export imena (dokazano preživetja) + meta stringi.
# LOKALNA imena (razvij/filtrirajEkipa) NE preživijo minifierja.
set -u
cd /home/z/my-project
OUT=/tmp/r299-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# --- AWK strukturna preverba (r270 lekcija 2; r296-r298 vzorec) ---
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

echo "--- R299 MANDATORY — TEDENSKI ICS PO EKIPAH (29. člen 'izvozi' družine) ---"
need_static "Tedenski ICS po ekipah" "R299 skupina aria (role=group)"
need_static "ICS po ekipi:" "R299 skupina oznaka (span)"
need_static "Ekipa z vsaj enim terminom v naslednjih 7 dneh (danes + 6 dni, UTC)" "R299 definicijski naslov oznake (iskrena pravila čipov)"
need_static "Izvozi tedenski ICS samo za ekipo " "R299 čip aria (per ekipa)"
need_static "Samo termini ekipe " "R299 definicijski naslov čipa (izrečen filter)"
need_static "tedenskiEkipaImena" "R299 lib EN VIR ekip seznam"
need_static "tedenskiEkipaIcs" "R299 lib EN VIR filtriran izvoz"
need_static "tedenskiEkipaIcsFilename" "R299 ime datoteke (družinski vzorec + slug)"
need_static "-//Roksal//Tedenski vozni red po ekipah//SL" "R299 PRODID literal (RFC 5545 §3.7.3)"
need_static "X-ROKSAL-EKIPA:" "R299 ekipa meta (VERBATIM vir — RFC X- prostor)"
need_static "vozni-red-ekipa-" "R299 UID predpona (ni trkov ob sočasnem uvozu — ASCII kanon R289: minifier · kot \xb7)"
need_static "Ni ekip z termini v naslednjih 7 dneh" "R299 fail-closed toast (0 ekip)"
need_static "ICS po ekipi se izvozi, ko ima ekipa vpisan termin v prihajajočem tednu." "R299 iskren toast opis (fail-closed vrata)"
need_static "Tedenski ICS za ekipo " "R299 uspeh toast (WYSIWYG)"
need_static "Izvoz ICS za ekipo " "R299 fail-verbose catch (pariteta brata R298)"
need_static " · ICS po ekipi = samo termini te ekipe (isti 7-dnevni okvir)" "R299 legenda (poimenovana razlika)"
echo "--- R299 must_miss (negativni) ---"
must_miss "TODO-R299" "R299 — brez razvojnih ostankov"

echo "R299 lastni needleji: FAIL=$FAIL (16 novih + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r298-build-needles.sh (R298+R297+…+R227) ==="
REG=0
bash scripts/r298-build-needles.sh || REG=1
echo "=== R299 SKUPNA RESNICA: R299 FAIL=$FAIL, regresije FAIL=$REG ==="
[ "$FAIL" = "0" ] && [ "$REG" = "0" ] || exit 1
echo "R299 NEEDLES VSE ZELENE (R299 ×16 + regresije)"
exit 0
