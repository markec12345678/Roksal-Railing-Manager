#!/usr/bin/env bash
# R190 — rekurzivni public chunk discovery (brez seje): runtime mape se širijo
# nivo za nivojem; vse.assets so javni CDN. Potem needleji R187/R188/R189.
set -u
BASE="https://roksal-railing-manager.vercel.app"
TMP="/tmp/r190-rec"
rm -rf "$TMP"; mkdir -p "$TMP"

echo "=== [1] seed: /login HTML chunki ==="
curl -sS -m 20 "$BASE/login" -o "$TMP/login.html"
grep -oE '/_next/static/chunks/[a-zA-Z0-9._-]+\.js' "$TMP/login.html" | sort -u | sed 's|/_next/static/chunks/||' > "$TMP/obdelani.txt"

prenesi() { # $1 = ime chunka
  local f="$TMP/c-$1"
  [ -f "$f" ] && return 0
  local code=$(curl -sS -m 15 -o "$f" -w '%{http_code}' "$BASE/_next/static/chunks/$1" 2>/dev/null)
  [ "$code" != "200" ] && { rm -f "$f"; return 1; }
  return 0
}

for nivo in 1 2 3 4; do
  echo "--- nivo $nivo ---"
  NOVI=0
  # prenesi še ne-prenesene iz obdelanih
  while read -r ime; do prenesi "$ime" || true; done < "$TMP/obdelani.txt"
  # iz vseh prenesenih izlušči nove 16-hex imena kandidatov
  cat "$TMP"/c-*.js 2>/dev/null | grep -ohE '"[0-9a-f]{16}"|[0-9a-f]{16}\.js' | tr -d '"' | sed 's/\.js$//' | sort -u > "$TMP/hexall.txt"
  while read -r h; do
    grep -qxF "$h" "$TMP/obdelani.txt" && continue
    if prenesi "$h.js"; then echo "$h.js" >> "$TMP/obdelani.txt"; NOVI=$((NOVI+1)); fi
  done < "$TMP/hexall.txt"
  echo "novih chunkov: $NOVI"
  [ "$NOVI" = "0" ] && break
done

SKUPAJ=$(ls "$TMP"/c-*.js 2>/dev/null | wc -l)
echo "SKUPAJ prenesenih chunkov: $SKUPAJ ($(du -sh "$TMP" | cut -f1))"

echo "=== [2] needleji R187/R188/R189/R186 ==="
for needle in 'Sistem — zdravje' 'Baza odgovarja' 'Odzivni časi — ' 'Odzivni časi (' 'povp.' 'Build žig te namestitve' 'Izvozi vidne meritve kot CSV' 'Izvozi telemetrijo omejevanja hitrosti kot CSV' 'Ni povezave' 'Poskusi znova čez' 'Preveč poskusov prijave.'; do
  hits=$(grep -l -F "$needle" "$TMP"/c-*.js 2>/dev/null | wc -l)
  files=$(grep -l -F "$needle" "$TMP"/c-*.js 2>/dev/null | xargs -r -n1 basename | sed 's/^c-//' | tr '\n' ' ')
  echo "[$needle]: $hits → $files"
done
