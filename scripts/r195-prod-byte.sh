#!/usr/bin/env bash
# R195 — produkcijski byte dokaz R194 fingerprintov (CSRF dvojni žeton):
#   (a) 'x-csrf-token' ≥1 v JAVNIH client chunkih (ovoj csrf-client javno pakiran; R194 lokalni build: ×2)
#   (b) 'roksal_csrf' ≥1 v JAVNIH client chunkih (R194 lokalni build: ×2)
#   (c) 'dvojni podpis' ×0 v JAVNIH chunkih (server-route string — pričakovano šele prek seje)
#   (d) regresije: 'Preveč zahtev.' ×0 client; 'Build žig te namestitve' ×1;
#       'Ni povezave — aplikacija deluje naprej' ×1; EXIF politika ×1
# Vzorec: r194-prod-byte.sh — 4 nivoji raziritve iz / in /login HTML.
set -u
BASE="https://roksal-railing-manager.vercel.app"
TMP="/tmp/r195-rec"
rm -rf "$TMP"; mkdir -p "$TMP"

echo "=== [1] seed: / + /login HTML chunki ==="
curl -sS -m 20 "$BASE/" -o "$TMP/root.html"
curl -sS -m 20 "$BASE/login" -o "$TMP/login.html"
cat "$TMP/root.html" "$TMP/login.html" | grep -oE '/_next/static/chunks/[a-zA-Z0-9._-]+\.js' | sort -u | sed 's|/_next/static/chunks/||' > "$TMP/obdelani.txt"
echo "seed chunkov: $(wc -l < "$TMP/obdelani.txt")"

prenesi() {
  local f="$TMP/c-$1"
  [ -f "$f" ] && return 0
  local code=$(curl -sS -m 15 -o "$f" -w '%{http_code}' "$BASE/_next/static/chunks/$1" 2>/dev/null)
  [ "$code" != "200" ] && { rm -f "$f"; return 1; }
  return 0
}

for nivo in 1 2 3 4; do
  echo "--- nivo $nivo ---"
  NOVI=0
  while read -r ime; do prenesi "$ime" || true; done < "$TMP/obdelani.txt"
  cat "$TMP"/c-*.js 2>/dev/null | grep -ohE '"[0-9a-f]{16}"|[0-9a-f]{16}\.js' | tr -d '"' | sed 's/\.js$//' | sort -u > "$TMP/hexall.txt"
  while read -r h; do
    grep -qxF "$h.js" "$TMP/obdelani.txt" && continue
    if prenesi "$h.js"; then echo "$h.js" >> "$TMP/obdelani.txt"; NOVI=$((NOVI+1)); fi
  done < "$TMP/hexall.txt"
  echo "novih chunkov: $NOVI"
  [ "$NOVI" = "0" ] && break
done

SKUPAJ=$(ls "$TMP"/c-*.js 2>/dev/null | wc -l)
echo "SKUPAJ prenesenih chunkov: $SKUPAJ ($(du -sh "$TMP" | cut -f1))"

echo "=== [2] R195 needleji (R194 fingerprinti) ==="
SLOG=0
for needle in 'x-csrf-token' 'roksal_csrf' 'dvojni podpis' 'Preveč zahtev.' 'Build žig te namestitve' 'Ni povezave — aplikacija deluje naprej' 'EXIF/GPS metapodatki se pri nalaganju samodejno odstranijo'; do
  hits=$(grep -l -F "$needle" "$TMP"/c-*.js 2>/dev/null | wc -l)
  files=$(grep -l -F "$needle" "$TMP"/c-*.js 2>/dev/null | xargs -r -n1 basename | sed 's/^c-//' | tr '\n' ' ')
  echo "[$needle]: $hits → $files"
done
echo "=== [3] verdikti ==="
CSRF_H=$(grep -l -F 'x-csrf-token' "$TMP"/c-*.js 2>/dev/null | wc -l)
COOKIE_H=$(grep -l -F 'roksal_csrf' "$TMP"/c-*.js 2>/dev/null | wc -l)
DVOJNI_H=$(grep -l -F 'dvojni podpis' "$TMP"/c-*.js 2>/dev/null | wc -l)
PREVEC_H=$(grep -l -F 'Preveč zahtev.' "$TMP"/c-*.js 2>/dev/null | wc -l)
echo "VERDIKT x-csrf-token client=$CSRF_H (pričakovano >=1) | roksal_csrf client=$COOKIE_H (>=1) | dvojni podpis javni=$DVOJNI_H (pričakovano 0) | Preveč zahtev. client=$PREVEC_H (pričakovano 0)"
