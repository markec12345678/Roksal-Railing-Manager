#!/bin/bash
# R310 — build needleji: 3. VAL UNIFIKACIJE I/O MEJE (issue #1 — «stena ura»
# zaključek) + STIL harmonizacija punch-list/team-tab.
#   VAL 3: 22 handlerjev s surovim .catch(() => null) → EN VIR preberiJsonTelo
#   (vzorec R309; R308 calculator izviren). IZJEME z razlogom (r310 val3 test):
#   sync (kontrakt NIČ), auth/logout (zahtevana toleranca), vision/scene +
#   measurement/detect + public/measure (bespoke 413 size-guardi).
#   POZITIVNI needleji (build): STIL žetoni punch-list (značka + krog) +
#   team-tab (chips + baner + inline) + širina stene (≥49 datotek s
#   preberiJsonTelo vezavo v BUILT artefaktu — 26 val-1 + calculator + 22 val-3).
#   MUST_MISS (build): SAMO enolično pripisljivi surovi vzorci (lekcija R308 3
#   — deljena surova sekvenca značke/banerja živi še v measurements-tab, ki je
#   izrecno izven R310 obsega → pripisljivost na SOURCE nivoju: r310 val3 test).
#   + (1) regresije: r309-build-needles.sh (R309 + R308 + … polna veriga do
#   R227 — DELEGACIJA).
# LEKCIJA R289/R299-R309 (ASCII kanon): needleji = ASCII literali + imena
# lastnosti + string literali; komentarji odstranjeni v buildu. Build PREJ
# pred needleji (R300 lekcija 3; R308 lekcija 1).
set -u
cd /home/z/my-project
OUT=/tmp/r310-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# --- AWK strukturna preverba (r270 lekcija 2; r296-r309 vzorec) ---
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

echo "--- R310 MANDATORY — 3. VAL I/O MEJE: širina stene v buildu ---"
VEZAVE=$(grep -rl 'preberiJsonTelo' "$OUT" 2>/dev/null | wc -l)
echo "  info: datotek s preberiJsonTelo vezavo = $VEZAVE (pričakovano ≥49 — 26 val-1 + calculator + 22 val-3 ± dvojniki čankov)"
if [ "$VEZAVE" -ge 49 ]; then echo "OK   : R310 širina stene (≥49) — val 3 v buildu"; else echo "MISS : R310 širina stene ($VEZAVE < 49)"; FAIL=1; fi
need_static "Neveljavno telo zahteve — pričakovan JSON objekt" "R310 EN VIR sporočilo še vedno ENO (string literal — regresija r309)"

echo "--- R310 MANDATORY STIL — punch-list + team-tab surove amber → žetoni (0 novih hex) ---"
need_static "bg-roksal-amber/10 text-roksal-ink border-roksal-amber/40" "R310 punch Napaka značka (žeton + ink — PLACAN R309 oblika; deljena z invoice-manager — pozitivna)"
need_static "border-roksal-amber bg-roksal-amber text-roksal-navy" "R310 punch Napaka krog (žeton par — unikaten)"
need_static "bg-roksal-amber/10 text-roksal-amber" "R310 team chips (žeton — družina Zaklenjen/Aktiven oblika)"
need_static "rounded-xl border border-roksal-amber/40 bg-roksal-amber/10 px-3.5 py-3" "R310 team baner (žetoni — unikaten)"
need_static "inline-flex items-center gap-1 font-medium text-roksal-ink" "R310 team mora-zamenjati-geslo inline (ink + žeton ikona — r162 lekcija)"
echo "--- R310 must_miss (negativni — SAMO enolično pripisljivi; deljene surove sekvene → SOURCE nivo r310 val3 test) ---"
must_miss "border-amber-500 bg-amber-100 dark:bg-amber-500/15 text-amber-600" "R310 punch surov krog par (izginil — unikatna sekvenca)"
echo "R310 lastni needleji: FAIL=$FAIL (6 pozitivnih [širina + EN VIR regresija + 4 STIL] + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r309-build-needles.sh (R309+R308+…+R227) ==="
REG=0
bash scripts/r309-build-needles.sh || REG=1
if [ "$REG" = "1" ]; then echo "REGRESIJA FAIL"; exit 1; fi
if [ "$FAIL" = "1" ]; then echo "R310 NEEDLEJI FAIL"; exit 1; fi
echo "=== R310 BUILD NEEDLES VSE OK ==="
