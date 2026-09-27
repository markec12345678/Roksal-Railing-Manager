#!/bin/bash
# R215 reprobe — R214 needleji v ŽIVO serving buildu (javni /login chunki).
set -u
PROD="https://roksal-railing-manager.vercel.app"
TMP=$(mktemp -d)
curl -s --max-time 20 "$PROD/login" -o "$TMP/login.html"
rg -o '/_next/static/chunks/[a-z0-9]+\.js' "$TMP/login.html" | sort -u | head -20 > "$TMP/chunks.txt"
echo "chunkov na /login: $(wc -l < $TMP/chunks.txt)"
: > "$TMP/zadetki.txt"
while read -r c; do
  curl -s --max-time 20 "$PROD$c" >> "$TMP/all.js" 2>/dev/null || true
done < "$TMP/chunks.txt"
for needle in 'Material — Naročila (V5)' 'Material — Dobavitelji (V5)' 'Odpri naročila' 'aria-current' 'Nizka zaloga' 'Prikaži Vse' 'orders-active' 'Preklic naročila'; do
  n=$(rg -c --fixed-strings "$needle" "$TMP/all.js" 2>/dev/null || echo 0)
  echo "$needle: $n"
done
rm -rf "$TMP"
echo "=== KONEC r215-reprobe-prod ==="
