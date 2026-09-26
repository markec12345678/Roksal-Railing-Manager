#!/usr/bin/env bash
# R190 — produkcija byte QA: R187+R188+R189 needleji na novem buildu 21:56:44.655Z
set -u
BASE="https://roksal-railing-manager.vercel.app"
TMP="/tmp/r190-byte"
rm -rf "$TMP"; mkdir -p "$TMP"

echo "=== [1] /login HTML → chunk seznam ==="
curl -sS -m 20 "$BASE/login" -o "$TMP/login.html"
echo "login.html bytes: $(wc -c < "$TMP/login.html")"
grep -oE '/_next/static/chunks/[a-zA-Z0-9._-]+\.js' "$TMP/login.html" | sort -u > "$TMP/chunks.txt"
wc -l < "$TMP/chunks.txt" | xargs echo "chunkov v HTML:"

echo "=== [2] prenesi vse chunkje iz HTML ==="
while read -r p; do
  f="$TMP/$(basename "$p")"
  curl -sS -m 20 "$BASE$p" -o "$f"
done < "$TMP/chunks.txt"
ls "$TMP"/*.js 2>/dev/null | wc -l | xargs echo "prenesenih js:"

echo "=== [3] 16-hex lazy chunki (vzorec R185/R186: iz znanih chunkov izlušči id-je) ==="
grep -ohE '[0-9a-f]{16}' "$TMP"/*.js 2>/dev/null | sort -u > "$TMP/hexids.txt"
wc -l < "$TMP/hexids.txt" | xargs echo "16-hex kandidatov:"
# sprobaj vsak kot chunk ime (vzorec: /_next/static/chunks/<id>.js)
cnt=0
while read -r h; do
  url="$BASE/_next/static/chunks/$h.js"
  code=$(curl -sS -m 10 -o "$TMP/lazy-$h.js" -w '%{http_code}' "$url" 2>/dev/null)
  if [ "$code" = "200" ]; then cnt=$((cnt+1)); else rm -f "$TMP/lazy-$h.js"; fi
done < "$TMP/hexids.txt"
echo "lazy chunkov 200 OK: $cnt"

echo "=== [4] needleji R187/R188/R189 ==="
for needle in 'Baza odgovarja' 'Odzivni časi — ' 'Odzivni časi (' 'povp.' 'Build žig te namestitve' 'Izvozi telemetrijo omejevanja hitrosti kot CSV' 'Sistem — zdravje' 'Zgrajeno'; do
  n=$(grep -l -F "$needle" "$TMP"/*.js 2>/dev/null | wc -l)
  files=$(grep -l -F "$needle" "$TMP"/*.js 2>/dev/null | xargs -r -n1 basename | tr '\n' ' ')
  echo "needle [$needle]: datotek=$n → $files"
done

echo "=== [5] regresija: R186 CSV needle ==="
grep -l -F 'Izvozi vidne meritve kot CSV' "$TMP"/*.js 2>/dev/null | xargs -r -n1 basename
