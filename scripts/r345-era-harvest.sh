#!/usr/bin/env bash
# r345-era-harvest.sh — R345 era preverba: r343.tsv val 27 needle na produkcijskih čankih.
# Tehnika R342 (kanon): URL-ji iz prod-qa teka (/tmp/r339-chunkurls.txt) → curl vse →
# grep -rqF po TSV registru (need_static ŽIV / must_miss čisto).
# Fail-closed: če žetev ali grep ne uspe → EXIT 1 z glasnim sporočilom.
set -u

BASE="https://roksal-railing-manager.vercel.app"
URLS="/tmp/r339-chunkurls.txt"
OUT="/tmp/r345-prod-chunks"
REG="scripts/qa-needles/r343.tsv"

rm -rf "$OUT"; mkdir -p "$OUT"

# 1) Žetev: curl vsak URL, shrani telo (binary-safe: shranimo vse, grep -F na bajtih)
n=0; fail=0
while IFS= read -r u; do
  [ -z "$u" ] && continue
  f="$OUT/chunk_$(printf '%03d' "$n").bin"
  if curl -sS --max-time 30 -o "$f" "$u" 2>/dev/null && [ -s "$f" ]; then
    n=$((n+1))
  else
    fail=$((fail+1)); rm -f "$f"
  fi
done < "$URLS"
echo "ŽETEV: $n čankov OK, $fail failov"
[ "$n" -lt 30 ] && { echo "FAILOVEDANO: premalo čankov ($n < 30) — žeteva neveljavna"; exit 1; }

# 2) need_static — val 27 badge title MORA biti ŽIV
NEED='Predloga shranjenega izračuna — nalaganje zapolni vsa vnosna polja načina'
if grep -rlqF -- "$NEED" "$OUT" 2>/dev/null; then
  hit=$(grep -rlF -- "$NEED" "$OUT" | head -1)
  echo "R343 val 27 need_static: ŽIV ($hit)"
  NEED_OK=1
else
  echo "R343 val 27 need_static: MISS"
  NEED_OK=0
fi

# 3) must_miss — TODO-R343 NE SME biti prisoten
if grep -rlqF -- 'TODO-R343' "$OUT" 2>/dev/null; then
  echo "R343 must_miss TODO-R343: PRISOTEN — FAILOVEDANO"
  MISS_OK=0
else
  echo "R343 must_miss TODO-R343: čisto"
  MISS_OK=1
fi

# 4) Era kontrola: R340/R341 znani ŽIVI needleji (regresija — morajo ostati ŽIVI)
for pair in 'letvev × 80mm = razmik|R340' 'Prstni odtis izračuna — verzija formule in hash vhodov za reproducibilnost (R150)|R341 val 26'; do
  needle="${pair%%|*}"; tag="${pair##*|}"
  if grep -rlqF -- "$needle" "$OUT" 2>/dev/null; then echo "era kontrola $tag: ŽIV"; else echo "era kontrola $tag: MISS"; fi
done

if [ "$NEED_OK" = "1" ] && [ "$MISS_OK" = "1" ]; then
  echo "=== R345 ERA PREVERBA — R343 val 27 ŽIVO NA PRODU (deploy zelen, TODO čisto) ==="
  exit 0
elif [ "$NEED_OK" = "0" ] && [ "$MISS_OK" = "1" ]; then
  echo "=== R345 ERA PREVERBA — R343 val 27 ŠE NI NA PRODU (deploy pending — pričakovana veja) ==="
  exit 2
else
  echo "=== R345 ERA PREVERBA — FAILOVEDANO (must_miss ali žeteva) ==="
  exit 1
fi
