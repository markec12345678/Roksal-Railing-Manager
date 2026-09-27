#!/usr/bin/env bash
# R194 — produkcijski byte dokaz R193 fingerprintov:
#   (a) 'EXIF/GPS metapodatki se pri nalaganju samodejno odstranijo' (photo-tab §37 UI politika)
#   (b) 'EXIF/GPS odstranjeno na strežniku' (toast + reference-gallery)
#   (c) 'Preveč zahtev.' ×0 v CLIENT chunkih (server-route string — R191 pravilo)
#   (d) regresija: 'Build žig te namestitve' (R189 F2)
# Vzorec: r190-recursive-byte.sh — 4 nivoji raziritve iz / in /login HTML.
set -u
BASE="https://roksal-railing-manager.vercel.app"
TMP="/tmp/r194-rec"
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

echo "=== [2] R194 needleji ==="
for needle in 'EXIF/GPS metapodatki se pri nalaganju samodejno odstranijo' 'EXIF/GPS odstranjeno na strežniku' 'Preveč zahtev.' 'Build žig te namestitve' 'Ni povezave — aplikacija deluje naprej'; do
  hits=$(grep -l -F "$needle" "$TMP"/c-*.js 2>/dev/null | wc -l)
  files=$(grep -l -F "$needle" "$TMP"/c-*.js 2>/dev/null | xargs -r -n1 basename | sed 's/^c-//' | tr '\n' ' ')
  echo "[$needle]: $hits → $files"
done
