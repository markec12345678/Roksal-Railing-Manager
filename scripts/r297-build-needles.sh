#!/bin/bash
# R297 — build needleji: (0) OPREMA CIKEL CSV (27. člen 'izvozi' družine —
# CSV brat PDF R266): pill aria/title, lib EN VIR graditelj, meta Obseg
# resnica, fail-closed toasta + R297 STIL (F2 ciklov definicijski naslovi —
# izrečena resnica)
#       + (1) regresije: r296-build-needles.sh (R296 ×13 + R295 ×13 + R294 ×8
# + R293/R292/R291/R290 + … polna veriga do R227 — DELEGACIJA: isti chunk
# vzorec, dva teka, ENA kombinirana FAIL resnica).
# LEKCIJA R289 (ASCII kanon) + R295/R296 (delegacija): needleji = JSX/title
# literali + lib export imena (dokazano preživetja) + meta stringi. LEKCIJA
# R297: lokalna imena funkcij (pridobiOpremoVnosi) NE preživijo minifierja —
# needleji samo na importih/literalih.
set -u
cd /home/z/my-project
OUT=/tmp/r297-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# --- AWK strukturna preverba (r270 lekcija 2; r296 vzorec) ---
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

echo "--- R297 MANDATORY — OPREMA CIKEL CSV (27. člen 'izvozi' družine) ---"
need_static "Izvozi pregled življenjskega cikla opreme kot CSV" "R297 gumb aria-label"
need_static "Življenjski cikl opreme kot CSV (isti stolpci kot PDF — za Excel/revizijo)" "R297 gumb hover title (press-scale pariteta)"
need_static "opremaCikelCsvVrstice" "R297 lib EN VIR graditelj (vzorec R295/R296)"
need_static "opremaCikelCsvFilename" "R297 ime datoteke (brat PDF R266)"
need_static "Oprema-cikel-" "R297 predpona imena (družinski vzorec)"
need_static "prazen seznam opreme ne nastaja datoteke" "R297 lib fail-closed (družinsko pravilo R266)"
need_static "Vsa oprema iz /api/equipment (polna resnica — tudi upokojena/izgubljena; NAZIV ASC referenčni red)" "R297 meta Obseg resnica (VERBATIM)"
need_static "CSV se izvozi, ko je vpisan prvi kos opreme." "R297 iskren toast opis (fail-closed vrata)"
need_static "Pregled opreme prenešen v CSV" "R297 uspeh toast (WYSIWYG)"
need_static "Cikel CSV" "R297 pill oznaka"
echo "--- R297 MANDATORY STIL — F2 ciklov definicijski naslovi (izrečena resnica) ---"
need_static "Cikl videnega seznama opreme — polna resnica prihaja s FRESH fetch izvozom (PDF/CSV — VSA oprema)" "R297 F2 mini title (viden seznam definicija)"
need_static "Interval + zadnji pregled znana in rok je pretekel (R145 jedro) — akcija" "R297 F2 zapadel žig title"
need_static "Merska oprema z kalibracijskim rokom, ki je že pretekel — akcija" "R297 F2 kalibracija žig title"
echo "--- R297 must_miss (negativni) ---"
must_miss "TODO-R297" "R297 — brez razvojnih ostankov"

echo "R297 lastni needleji: FAIL=$FAIL (13 novih + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r296-build-needles.sh (R296+R295+R294+R293+R292+R291+R290+…) ==="
REG=0
bash scripts/r296-build-needles.sh || REG=1
echo "=== R297 SKUPNA RESNICA: R297 FAIL=$FAIL, regresije FAIL=$REG ==="
[ "$FAIL" = "0" ] && [ "$REG" = "0" ] || exit 1
echo "R297 NEEDLES VSE ZELENE (R297 ×13 + regresije)"
exit 0
