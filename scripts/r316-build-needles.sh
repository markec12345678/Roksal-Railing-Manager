#!/bin/bash
# R316 — build needleji: 46. člen issue #1 «IZVOZ POROČILA KONČNE VERIFIKACIJE
# KOT JSON» (IZVOZI družina: NOV lib izvoz koncnaVerifikacijaJson = ČISTA
# projekcija koncnaVerifikacija — deterministični JSON brez metapodatkov
# časa/hash; gumb v končna-verifikacija bloku na vodji z a11y družino
# aria-label + title; vitest r316-koncna-verifikacija-json ×6; E2E Z0an
# DETERMINIZEM ŽIVO: dva izvoza bajtno enaka)
# + MANDATORY STIL val 7 — ZAKLJUČNI (fence-3d-viewer ×2 ikoni +
# notification-center ×1 ikona + signature-quote ×1 hint + photo-measure ×1
# hint = 5 dotikov — surove amber → roksal žetoni, 0 novih hex; GLOBALNI
# zaklenjeni register: vsaka preostala surova amber vrstica v
# src/components/roksal + src/app je IZRECNO v r316-stil-val7.test.ts
# registru (30 vrstic — semantični barvno kodirani sistemi, R308 lekcija)).
#   POZITIVNI needleji (build): JSON izvoz aria + title fragment (vodja
#   chunk) + STIL žetoni (fence ikoni ×2, notification ikona, signature
#   hint besedilo, photo-measure hint besedilo).
#   MUST_MISS (build): SAMO enolično pripisljivi stari surovi vzorci
#   (h-8 w-8 text-amber-400 fence; mt-0.5 h-3.5 … text-amber-500 fence;
#   h-3 w-3 … text-amber-500 dark:text-amber-400 notification;
#   text-2xs text-amber-600 … signature; text-[9px] text-amber-600 …
#   photo-measure).
#   + (1) regresije: r315-build-needles.sh (R315 + R314 + … polna veriga do
#   R227 — DELEGACIJA; red: r315 → r314 → …).
# LEKCIJA R289/R299-R315 (ASCII kanon): needleji = ASCII/UTF-8 string
# literali; komentarji odstranjeni v buildu. Build PREJ pred needleji.
set -u
cd /home/z/my-project
OUT=/tmp/r316-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# --- AWK strukturna preverba (r270 lekcija 2; r296-r315 vzorec) ---
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

echo "--- R316 MANDATORY — 46. člen: izvoz poročila končne verifikacije kot JSON (IZVOZI družina) ---"
need_static "Izvozi poročilo končne verifikacije kot JSON" "R316 JSON izvoz gumb aria (vodja chunk)"
need_static "kot deterministični JSON" "R316 JSON izvoz title fragment (vodja chunk)"
echo "--- R316 MANDATORY STIL — val 7 ZAKLJUČNI: fence/notification/signature/photo-measure surove amber → žetoni ---"
need_static "h-8 w-8 text-roksal-amber" "R316 fence loadError ikona (žeton; ar chunk)"
need_static "mt-0.5 h-3.5 w-3.5 shrink-0 text-roksal-amber" "R316 fence AR hint ikona (žeton; ar chunk)"
need_static "h-3 w-3 shrink-0 text-roksal-amber" "R316 notification weather ikona (žeton; shell chunk)"
need_static "Oba podpisa (stranka + monter) sta potrebna" "R316 signature hint besedilo (ink)"
need_static "Za shranjevanje izberi projekt." "R316 photo-measure hint besedilo (ink)"
echo "--- R316 must_miss (negativni — SAMO enolično pripisljivi; GLOBALNI register → SOURCE nivo r316 STRAŽAR) ---"
must_miss "h-8 w-8 text-amber-400" "R316 fence stara ikona (izginil — unikaten h-8 par)"
must_miss "mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" "R316 fence stara AR hint ikona (izginil — unikaten h-3.5 rep)"
must_miss "h-3 w-3 shrink-0 text-amber-500 dark:text-amber-400" "R316 notification stara ikona (izginil — unikaten dark-par)"
must_miss "text-2xs text-amber-600 dark:text-amber-400" "R316 signature stari hint (izginil — unikaten text-2xs rep)"
must_miss "text-[9px] text-amber-600 dark:text-amber-400" "R316 photo-measure stari hint (izginil — unikaten text-[9px] rep)"
must_miss "TODO-R316" "R316 — brez razvojnih ostankov"
echo "R316 lastni needleji: FAIL=$FAIL (2 izvoz + 5 STIL + 6 must_miss)"
echo "=== REGRESIJE: polna veriga prek r315-build-needles.sh (R315+R314+…+R227) ==="
REG=0
bash scripts/r315-build-needles.sh || REG=1
if [ "$REG" = "1" ]; then echo "REGRESIJA FAIL"; exit 1; fi
if [ "$FAIL" = "1" ]; then echo "R316 NEEDLEJI FAIL"; exit 1; fi
echo "=== R316 BUILD NEEDLES VSE OK ==="
