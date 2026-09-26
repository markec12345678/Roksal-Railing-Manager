#!/usr/bin/env bash
# R190 — session byte probe: prijava (ADMIN E2E konto) → dashboard HTML → chunki → needleji
set -u
BASE="https://roksal-railing-manager.vercel.app"
TMP="/tmp/r190-sess"
rm -rf "$TMP"; mkdir -p "$TMP"
EMAIL="ci@roksal.si"; PASS='DimniSmoke139!'

echo "=== [1] prijava ==="
code=$(curl -sS -m 20 -o "$TMP/auth.json" -w '%{http_code}' -c "$TMP/cookies.txt" \
  -H 'Content-Type: application/json' -H "Origin: $BASE" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
  "$BASE/api/auth")
echo "auth: $code"; head -c 300 "$TMP/auth.json"; echo
[ "$code" != "200" ] && { echo "prijava ni uspela — prekinjam (brez ponovnih poskusov, rate-limit higiena)"; exit 1; }

echo "=== [2] dashboard HTML ==="
curl -sS -m 20 -b "$TMP/cookies.txt" "$BASE/" -o "$TMP/dash.html"
echo "dash.html bytes: $(wc -c < "$TMP/dash.html")"
grep -oE '/_next/static/chunks/[a-zA-Z0-9._-]+\.js' "$TMP/dash.html" | sort -u > "$TMP/chunks.txt"
wc -l < "$TMP/chunks.txt" | xargs echo "chunkov v dashboard HTML:"

echo "=== [3] prenesi chunkje ==="
while read -r p; do curl -sS -m 20 -o "$TMP/$(basename "$p")" "$BASE$p"; done < "$TMP/chunks.txt"

echo "=== [4] 16-hex lazy kandidati iz teh chunkov ==="
grep -ohE '[0-9a-f]{16}' "$TMP"/*.js 2>/dev/null | sort -u > "$TMP/hexids.txt"
while read -r h; do
  code2=$(curl -sS -m 10 -o "$TMP/lazy-$h.js" -w '%{http_code}' "$BASE/_next/static/chunks/$h.js" 2>/dev/null)
  [ "$code2" != "200" ] && rm -f "$TMP/lazy-$h.js"
done < "$TMP/hexids.txt"
ls "$TMP"/*.js | wc -l | xargs echo "skupaj js:"

echo "=== [5] needleji R187/R188/R189 (client chunki) ==="
for needle in 'Sistem — zdravje' 'Baza odgovarja' 'Odzivni časi — ' 'Odzivni časi (' 'povp.' 'Izvozi telemetrijo omejevanja hitrosti kot CSV' 'Ni povezave' 'Preveč poskusov prijave.'; do
  files=$(grep -l -F "$needle" "$TMP"/*.js 2>/dev/null | xargs -r -n1 basename | tr '\n' ' ')
  n=$(echo $files | wc -w)
  echo "needle [$needle]: datotek=$n → $files"
done

echo "=== [6] html needle check (SSR vsebina) ==="
for needle in 'Sistem — zdravje' 'Baza odgovarja'; do
  grep -c -F "$needle" "$TMP/dash.html" | xargs echo "dash.html [$needle]:"
done
