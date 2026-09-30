#!/bin/bash
# R308 — build needleji: (0) API I/O MEJA («stena ura») — MANDATORY STIL
# harmonizacija opozorilnih površin: 4 površine (punch-list, site-survey-tab,
# invoice-manager, weather-card) preusmerjene s surovih amber-* razredov na
# roksal žetone (0 novih hex) — POZITIVNI needleji dokazujejo harmonizirane
# razrede v čankih, MUST_MISS dokazuje izginotje surovih vzorcev;
# + (1) regresije: r307-build-needles.sh (R307 x11 + R306 x11 + ... polna
# veriga do R227 — DELEGACIJA).
# LEKCIJA R289/R299-R307 (ASCII kanon): needleji = ASCII literali + testidi +
# CSS razredi; komentarji odstranjeni v buildu — needleji zivijo v
# atributih/besedilu. Build PREJ pred needleji (R300 lekcija 3).
set -u
cd /home/z/my-project
OUT=/tmp/r308-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# --- AWK strukturna preverba (r270 lekcija 2; r296-r307 vzorec) ---
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

echo "--- R308 MANDATORY — API I/O MEJA: harmonizirane opozorilne površine (37+1. clen, STIL) ---"
need_static "border-roksal-amber/60 text-roksal-ink hover:bg-roksal-amber/10" "R308 punch-list Ponovni poskus gumb (nov žetonski razred)"
need_static "bg-roksal-amber/10 px-3 py-2 ring-1 ring-roksal-amber/30" "R308 site-survey opozorila povzetek (nov žetonski razred)"
need_static "rounded-lg border border-roksal-amber/40 bg-roksal-amber/10 p-2 text-2xs text-roksal-ink" "R308 invoice-manager mesečna napaka (nov žetonski razred)"
need_static "px-2.5 py-2 text-[11px] font-medium text-roksal-ink" "R308 weather-card demo opozorilo (nov žetonski razred)"
need_static "Zapisnika ni bilo mogoče naložiti" "R308 regresa: napaka nalaganja zapisnika (2 površini — besedilo ohranjeno)"
need_static "Prihodki po mesecih iz teh podatkov ni mogoče razčleniti" "R308 regresa: fail-verbose razčlenitvena napaka (besedilo ohranjeno)"
need_static "Demo podatki — živi vremenski servis trenutno ni dosegljiv." "R308 regresa: demo vreme opozorilo (iskrena resnica ohranjena)"
echo "--- R308 must_miss (negativni — surovi amber vzorci izginili iz čankov) ---"
must_miss "flex items-start gap-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3" "R308 punch-list + site-survey surovi alert vsebnik (izginil — NATANČNO polni vsebnik; krajši vzorec bi ujel druga, ne-opozorilne površine — lekcija R308)"
must_miss "border-amber-300/60 bg-amber-50" "R308 invoice-manager surov alert vsebnik (izginil)"
must_miss "bg-amber-50 dark:bg-amber-950/40 px-3 py-2 ring-1 ring-amber-200" "R308 site-survey surov opozorila vsebnik (izginil)"

echo "R308 lastni needleji: FAIL=$FAIL (7 novih + 3 must_miss)"
echo "=== REGRESIJE: polna veriga prek r307-build-needles.sh (R307+R306+…+R227) ==="
REG=0
bash scripts/r307-build-needles.sh || REG=1
echo "=== R308 SKUPNA RESNICA: R308 FAIL=$FAIL, regresije FAIL=$REG ==="
[ "$FAIL" = "0" ] && [ "$REG" = "0" ] || exit 1
echo "R308 NEEDLES VSE ZELENE (R308 ×7+3 + regresije)"
exit 0
