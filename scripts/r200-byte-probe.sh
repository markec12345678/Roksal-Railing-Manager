#!/usr/bin/env bash
# R200 — produkcija byte QA: R199 fingerprinti na buildu 2026-09-27T02:13:35.560Z
# Ključna invarianta: 'Pregled neuspešnih prijav' je SERVER-ONLY → ×0 v vseh javnih chunkih.
set -u
BASE="https://roksal-railing-manager.vercel.app"
TMP="/tmp/r200-byte"
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

echo "=== [3] 16-hex lazy chunki (vzorec R190) ==="
grep -ohE '[0-9a-f]{16}' "$TMP"/*.js 2>/dev/null | sort -u > "$TMP/hexids.txt"
wc -l < "$TMP/hexids.txt" | xargs echo "16-hex kandidatov:"
cnt=0
while read -r h; do
  url="$BASE/_next/static/chunks/$h.js"
  code=$(curl -sS -m 10 -o "$TMP/lazy-$h.js" -w '%{http_code}' "$url" 2>/dev/null)
  if [ "$code" = "200" ]; then cnt=$((cnt+1)); else rm -f "$TMP/lazy-$h.js"; fi
done < "$TMP/hexids.txt"
echo "lazy chunkov 200 OK: $cnt"

echo "=== [4] R199 server-only invarianta (MORA biti ×0) ==="
for needle in 'Pregled neuspešnih prijav' 'napačno geslo po celotni ekipi' 'FAILED_LOGINS_OVERVIEW'; do
  n=$(grep -l -F "$needle" "$TMP"/*.js 2>/dev/null | wc -l)
  files=$(grep -l -F "$needle" "$TMP"/*.js 2>/dev/null | xargs -r -n1 basename | tr '\n' ' ')
  echo "needle [$needle]: datotek=$n → $files"
done

echo "=== [5] R199 client needleji (informativno — auth chunki morda niso v /login) ==="
for needle in 'Označi vse' 'Močno' 'Šibko' 'PASSWORD_CHANGED' 'NEW_LOGIN' 'ACCOUNT_ACTIVATED'; do
  n=$(grep -l -F "$needle" "$TMP"/*.js 2>/dev/null | wc -l)
  files=$(grep -l -F "$needle" "$TMP"/*.js 2>/dev/null | xargs -r -n1 basename | tr '\n' ' ')
  echo "needle [$needle]: datotek=$n → $files"
done

echo "=== [6] regresije (R189 žig noga, R186 CSV, R197/198 zvonček) ==="
for needle in 'Build žig te namestitve' 'Zgrajeno' 'Izvozi vidne meritve kot CSV'; do
  n=$(grep -l -F "$needle" "$TMP"/*.js 2>/dev/null | wc -l)
  files=$(grep -l -F "$needle" "$TMP"/*.js 2>/dev/null | xargs -r -n1 basename | tr '\n' ' ')
  echo "needle [$needle]: datotek=$n → $files"
done
