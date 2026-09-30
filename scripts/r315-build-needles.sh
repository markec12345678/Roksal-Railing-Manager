#!/bin/bash
# R315 — build needleji: 45. člen issue #1 «KONČNA VERIFIKACIJA PROTI HEAD»
# (Deliverable 7 NA ZASLONU + DOKUMENTIRANO: NOV lib koncna-verifikacija =
# ČISTA projekcija EN VIR resnic — vsako območje audita §1–§11 z IZRECNO
# vezavo na verifikacijske plasti (vitest · build-needleji · E2E ŽIVO ·
# prod-qa · smoke) + 8 sprejemnih kriterijev z mehanično izpeljavo in
# konkretnim dokazom; totalen fail-closed join; blok na vodji:
# koncna-verifikacija-dokaz/vrstica/kriterij/sklep testidi; dokumentirano v
# docs/koncna-verifikacija-head.md)
# + MANDATORY STIL val 6 (inclinometer-tab ×5 + site-survey-tab ×4 +
# ar-scanner ×3 + pwa-status ×3 + password-change-banner ×3 = 19 dotikov —
# surove amber → roksal žetoni, 0 novih hex; 2 izrecni izjemi ZAKLENJENI na
# SOURCE nivoju: inclinometer senzorjska lestvica denied=red/unsupported=amber
# + site-survey PODLAGA kategorija barv — R308/R311 precedens; r315 STRAŽAR
# r315-stil-val6.test.ts).
#   POZITIVNI needleji (build): lib sklep template fragmenti (string
#   literali preživijo minifikacijo) + testidi + STIL žetoni (estrih
#   opomba, lowLight značka, accent, zaupanje značka, pwa baner/značka,
#   password gumb).
#   MUST_MISS (build): SAMO enolično pripisljivi surovi vzorci
#   (bg-amber-50/40 estrih par; bg-amber-100 dark:bg-amber-500/15 px-2.5
#   stari opomba; accent-amber-500 stari zoom; bg-amber-100 text-amber-700
#   stara zaupanje; hover:bg-amber-700 stari gumb; deljene surove sekvene
#   (npr. text-center text-2xs text-amber-600 — signature-quote še ima
#   lasten) → SOURCE nivo r315 STRAŽAR).
#   + (1) regresije: r314-build-needles.sh (R314 + R313 + … polna veriga do
#   R227 — DELEGACIJA; red: r314 → r313 → …).
# LEKCIJA R289/R299-R314 (ASCII kanon): needleji = ASCII/UTF-8 string
# literali; komentarji odstranjeni v buildu. Build PREJ pred needleji.
set -u
cd /home/z/my-project
OUT=/tmp/r315-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# --- AWK strukturna preverba (r270 lekcija 2; r296-r314 vzorec) ---
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

echo "--- R315 MANDATORY — 45. člen: končna verifikacija proti HEAD (Deliverable 7) ---"
need_static "koncna-verifikacija-dokaz" "R315 blok testid (vodja chunk)"
need_static "koncna-verifikacija-vrstica" "R315 vrstica testid"
need_static "koncna-verifikacija-kriterij" "R315 kriterij testid"
need_static "koncna-verifikacija-sklep" "R315 sklep testid"
need_static "Končna verifikacija — dokazne plasti" "R315 naslov (aria + glava)"
need_static "Končna verifikacija: " "R315 sklep glava (lib template)"
need_static "območij z dokaznimi plastmi" "R315 sklep števec fragment (izračunan iz EN VIR)"
need_static "plasti v dokazih: " "R315 sklep plasti fragment"
need_static "Sprejemni kriteriji (issue #1):" "R315 kriteriji podnaslov (JSX literal)"
need_static "Plast: " "R315 plast chip title (WYSIWYG)"
echo "--- R315 MANDATORY STIL — val 6: inclinometer/site-survey/ar-scanner/pwa/password surove amber → žetoni ---"
need_static "border-roksal-amber/40 bg-roksal-amber/10 px-3 py-2.5" "R315 inclinometer NAPAKA vsebnik (žeton)"
need_static "mt-0.5 h-4 w-4 shrink-0 text-roksal-amber" "R315 inclinometer ikona (žeton na ikoni — r162)"
need_static "bg-roksal-amber/10 px-2.5 py-2 text-2xs font-medium leading-relaxed text-roksal-ink" "R315 site-survey estrih opomba (vsebnik + ink)"
need_static "mt-0.5 h-3 w-3 shrink-0 text-roksal-amber" "R315 site-survey opomba ikona (žeton na ikoni)"
need_static "bg-roksal-amber/90 text-white border-transparent shadow-md animate-pulse" "R315 ar-scanner lowLight značka (solid žeton + belo)"
need_static "flex-1 accent-roksal-amber" "R315 ar-scanner zoom accent (accent žeton)"
need_static "bg-roksal-amber/15 text-roksal-ink" "R315 ar-scanner zaupanje značka (vsebnik + ink)"
need_static "bg-roksal-amber/10 px-3 py-2 text-roksal-ink shadow-sm" "R315 pwa-status offline baner (vsebnik + ink)"
need_static "bg-roksal-amber px-1.5 text-2xs font-bold text-white" "R315 pwa-status čakalna značka (solid žeton + belo)"
need_static "h-7 bg-roksal-amber text-[11px] text-white hover:bg-roksal-amber/90" "R315 password gumb (solid žeton + hover /90)"
need_static "border-roksal-navy/20 bg-roksal-navy/[0.04] px-1 py-px text-[9px] font-semibold" "R315 plast chip (navy žeton + dark: obrata — r166)"
echo "--- R315 must_miss (negativni — SAMO enolično pripisljivi; deljene surove sekvene → SOURCE nivo r315 STRAŽAR) ---"
must_miss "bg-amber-50/40" "R315 site-survey estrih surovi par (izginil — unikaten /40 fragment)"
must_miss "bg-amber-100 dark:bg-amber-500/15 px-2.5" "R315 site-survey stari opomba vsebnik (izginil — unikaten px-2.5 rep)"
must_miss "accent-amber-500" "R315 ar-scanner stari zoom accent (izginil)"
must_miss "bg-amber-100 text-amber-700" "R315 ar-scanner stara zaupanje značka (izginil — unikatna sekvenca)"
must_miss "hover:bg-amber-700" "R315 password stari gumb hover (izginil)"
must_miss "TODO-R315" "R315 — brez razvojnih ostankov"
echo "R315 lastni needleji: FAIL=$FAIL (10 verifikacija + 11 STIL + 6 must_miss)"
echo "=== REGRESIJE: polna veriga prek r314-build-needles.sh (R314+R313+…+R227) ==="
REG=0
bash scripts/r314-build-needles.sh || REG=1
if [ "$REG" = "1" ]; then echo "REGRESIJA FAIL"; exit 1; fi
if [ "$FAIL" = "1" ]; then echo "R315 NEEDLEJI FAIL"; exit 1; fi
echo "=== R315 BUILD NEEDLES VSE OK ==="
