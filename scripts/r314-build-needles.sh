#!/bin/bash
# R314 — build needleji: 44. člen issue #1 «AUDIT TABELA NA ZASLONU»
# (Deliverable 4: feature-by-feature audit — vsako območje §1–§11 izrecno
# klasificirano DETERMINISTICNO/SDK/SKRIPTA/AI_OPCIJSKO/AI_ZAHTEVANO s potmi
# implementacije + dokaza; NOV lib avtomatizacija-pregled = ČISTA projekcija
# EN VIR audita AVTOMATIZACIJA_AUDIT — števec izračunani, sklep verbatim,
# fail-closed ×6; blok na vodji: avtomatizacija-dokaz/vrstica/sklep testidi)
# + MANDATORY STIL val 5 (calculator-tab ×8 + post-signature-panel ×7 +
# photo-tab ×5 = 20 mest — surove amber → roksal žetoni, 0 novih hex;
# 2 izrecni izjemi ZAKLENJENI na SOURCE nivoju: photo-tab KATEGORIJE MED
# značka + stats.med KPI števec — barvno kodirana kategorija faze
# PRED blue / MED amber / PO green, R308/R312 precedens).
#   POZITIVNI needleji (build): lib sklep template fragmenti (string
#   literali preživijo minifikacijo) + testidi + STIL žetoni (estrih
#   kartica, sidra gumb, camera error, značke iz žetonov).
#   MUST_MISS (build): SAMO enolično pripisljivi surovi vzorci
#   (bg-amber-50/60 estrih par; border-amber-300 bg-white … stari čip;
#   border-amber-300 bg-amber-50 p-3 stari photo warn; deljene surove
#   sekvene → SOURCE nivo r314 STRAŽAR blok).
#   + (1) regresije: r312-build-needles.sh → r313-build-needles.sh (R313 +
#   R312 + … polna veriga do R227 — DELEGACIJA; red: r313 → r312 → …).
# LEKCIJA R289/R299-R313 (ASCII kanon): needleji = ASCII/UTF-8 string
# literali; komentarji odstranjeni v buildu. Build PREJ pred needleji.
set -u
cd /home/z/my-project
OUT=/tmp/r314-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# --- AWK strukturna preverba (r270 lekcija 2; r296-r313 vzorec) ---
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

echo "--- R314 MANDATORY — 44. člen: audit tabela na zaslonu (Deliverable 4) ---"
need_static "avtomatizacija-dokaz" "R314 blok testid (vodja chunk)"
need_static "avtomatizacija-vrstica" "R314 vrstica testid"
need_static "avtomatizacija-sklep" "R314 sklep testid"
need_static "Avtomatizacija — audit po območjih" "R314 naslov (aria + glava)"
need_static "Audit območij: " "R314 sklep glava (lib template)"
need_static " — jedro deluje brez AI" "R314 sklep ničelna veja (lib ternara literal)"
need_static " — vsako AI-obvezno območje zahteva izrecno utemeljitev" "R314 sklep niečelna veja (lib ternara literal)"
need_static " impl · " "R314 vrstica števec fragment (izračunan iz EN VIR)"
need_static " dokazov" "R314 vrstica dokazi fragment"
need_static "strazar R294" "R314 title referenca (poti morajo obstajati)"
echo "--- R314 MANDATORY STIL — val 5: calculator/post-signature/photo surove amber → žetoni ---"
need_static "mt-0.5 h-3.5 w-3.5 shrink-0 text-roksal-amber" "R314 calculator zamrzovalna ikona (žeton na ikoni — r162)"
need_static "border-roksal-amber/40 bg-background text-roksal-ink hover:border-roksal-amber" "R314 calculator sidra gumb (žeton + bg-background)"
need_static "border-roksal-amber/40 bg-roksal-amber/10 p-2 text-2xs text-roksal-ink" "R314 post-signature disclaimer (žeton vsebnik + ink)"
need_static "border-roksal-amber/40 bg-roksal-amber/10 p-3 text-xs text-roksal-ink" "R314 photo projekt warn (žeton vsebnik + ink)"
need_static "h-10 w-10 text-roksal-amber" "R314 photo camera error ikona (žeton na ikoni)"
need_static "border-roksal-amber/40 bg-roksal-amber/10 px-2 py-1.5 text-2xs text-roksal-ink" "R314 photo navodila (žeton vsebnik)"
need_static "border-roksal-amber/40 bg-roksal-amber/10 px-3 py-2 text-[11px] text-roksal-ink" "R314 photo priporočilo (žeton vsebnik)"
need_static "hover:bg-roksal-amber/25" "R314 photo zapri hover (R312 Badge vzorec)"
need_static "border-roksal-green/40 bg-roksal-green/10 text-roksal-green" "R314 DETERMINISTICNO značka (roksal žeton — R225/R226 čisto)"
need_static "border-roksal-red/40 bg-roksal-red/10 text-roksal-red" "R314 AI_ZAHTEVANO značka (roksal žeton)"
need_static "border-roksal-navy/25 bg-roksal-navy/5 text-roksal-ink dark:border-roksal-ink/20" "R314 SKRIPTA značka (navy + dark: obrata — r166 pravilo)"
echo "--- R314 must_miss (negativni — SAMO enolično pripisljivi; deljene surove sekvene → SOURCE nivo r314 STRAŽAR) ---"
must_miss "bg-amber-50/60" "R314 calculator estrih surovi par (izginil — unikaten /60 fragment)"
must_miss "border-amber-300 bg-white text-amber-800" "R314 calculator stari surovi čip (izginil — unikaten bg-white rep)"
must_miss "border-amber-300 bg-amber-50 p-3" "R314 photo stari warn vsebnik (izginil — unikatna sekvenca)"
must_miss "h-8 w-8 mx-auto text-amber-500" "R314 post-signature stara Lock ikona (izginil — unikaten mx-auto rep)"
must_miss "hover:bg-amber-100" "R314 photo stari zapri hover (izginil)"
must_miss "TODO-R314" "R314 — brez razvojnih ostankov"
echo "R314 lastni needleji: FAIL=$FAIL (10 audit + 11 STIL + 6 must_miss)"
echo "=== REGRESIJE: polna veriga prek r313-build-needles.sh (R313+R312+…+R227) ==="
REG=0
bash scripts/r313-build-needles.sh || REG=1
if [ "$REG" = "1" ]; then echo "REGRESIJA FAIL"; exit 1; fi
if [ "$FAIL" = "1" ]; then echo "R314 NEEDLEJI FAIL"; exit 1; fi
echo "=== R314 BUILD NEEDLES VSE OK ==="
