#!/bin/bash
# R296 — build needleji: (0) KOLEDAR PREGLEDOV ICS (26. člen 'izvozi'
# družine — ICS brat PDF R253 + CSV R295): pill aria/title, lib EN VIR
# graditelj (PRODID/glava/X- resnica), MIME resnica, fail-closed toasta,
# uspešni toast + R296 STIL (F2 definicijski naslovi — izrečena resnica)
#       + (1) regresije: r295-build-needles.sh (R295 ×13 + R294 ×8 + R293/R292/
# R291/R290 + … polna veriga do R227 — DELEGACIJA: isti chunk vzorec, dva teka,
# ENA kombinirana FAIL resnica).
# LEKCIJA R289 (ASCII kanon) + R295 (delegacija): needleji = JSX/title
# literali + lib export imena (dokazano preživetja) + meta stringi.
set -u
cd /home/z/my-project
OUT=/tmp/r296-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# --- AWK strukturna preverba (r270 lekcija 2; r295 vzorec) ---
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

echo "--- R296 MANDATORY — KOLEDAR PREGLEDOV ICS (26. člen 'izvozi' družine) ---"
need_static "Izvozi koledar pregledov kot ICS" "R296 gumb aria-label"
need_static "Koledar pregledov kot ICS (uvoz v koledarsko aplikacijo — Google/Outlook/telefon)" "R296 gumb hover title (press-scale pariteta)"
need_static "koledarPregledovIcsFilename" "R296 lib ime datoteke (vzorec R295 brat)"
need_static "-//Roksal//Koledar pregledov//SL" "R296 PRODID konstanta (lib čanek)"
need_static "BEGIN:VCALENDAR" "R296 ICS glava (lib čanek)"
need_static "CALSCALE:GREGORIAN" "R296 ICS kalendarska skala (lib čanek)"
need_static "X-ROKSAL-STATUS:" "R296 X- status resnica VERBATIM (lib čanek)"
need_static "@roksal.local" "R296 UID domena (lib čanek)"
need_static "ICS se izvozi, ko je vpisan prvi datum pregleda." "R296 iskren toast opis (fail-closed vrata)"
need_static "Koledar pregledov prenešen v ICS" "R296 uspeh toast (WYSIWYG)"
need_static "text/calendar;charset=utf-8" "R296 MIME resnica (downloadTextFile čanek)"
echo "--- R296 MANDATORY STIL — F2 definicijski naslovi (izrečena resnica) ---"
need_static "Pregledi v naslednjih 7 dneh (kanon opomnika — isto okno kot ruta izračuna AKTIVEN)" "R296 F2 title 2 (v tem tednu definicija)"
need_static "opomnikDatum < danes" "R296 F2 title 3 (potekli definicija)"
echo "--- R296 must_miss (negativni) ---"
must_miss "TODO-R296" "R296 — brez razvojnih ostankov"

echo "R296 lastni needleji: FAIL=$FAIL (13 novih + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r295-build-needles.sh (R295+R294+R293+R292+R291+R290+…) ==="
REG=0
bash scripts/r295-build-needles.sh || REG=1
echo "=== R296 SKUPNA RESNICA: R296 FAIL=$FAIL, regresije FAIL=$REG ==="
[ "$FAIL" = "0" ] && [ "$REG" = "0" ] || exit 1
echo "R296 NEEDLES VSE ZELENE (R296 ×13 + regresije)"
exit 0
