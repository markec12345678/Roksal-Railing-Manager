#!/usr/bin/env bash
# r347-era-harvest.sh — R347 era preverba: r346.tsv val 29 needleja ×2 na produkcijskih čankih.
# Kanon R345/R346 (r346-era-harvest.sh): URL-ji iz prod-qa teka (/tmp/r339-chunkurls.txt) → curl vse →
# grep -rqF po TSV registru (need_static ŽIV / must_miss čisto).
# Fail-closed: če žetev ali grep ne uspe → EXIT 1 z glasnim sporočilom.
set -u

BASE="https://roksal-railing-manager.vercel.app"
URLS="/tmp/r339-chunkurls.txt"
OUT="/tmp/r347-prod-chunks"
REG="scripts/qa-needles/r346.tsv"

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

# 2) need_static — oba val 29 niza MORA biti ŽIVO
#    (beremo needleje iz REGISTRA r346.tsv — 3. stolpec = need_static, 1. = needle)
NEED_OK=1; need_n=0
while IFS=$'\t' read -r needle opis vrsta; do
  case "$needle" in \#*|"") continue ;; esac
  [ "$vrsta" != "need_static" ] && continue
  need_n=$((need_n+1))
  if grep -rlqF -- "$needle" "$OUT" 2>/dev/null; then
    hit=$(grep -rlF -- "$needle" "$OUT" | head -1)
    echo "R346 val 29 need_static: ŽIV [$hit] — $opis"
  else
    echo "R346 val 29 need_static: MISS — $opis"
    NEED_OK=0
  fi
done < "$REG"
[ "$need_n" -eq 0 ] && { echo "FAILOVEDANO: register $REG ima 0 need_static needlejev"; exit 1; }

# 3) must_miss — TODO-R346 NE SME biti prisoten
if grep -rlqF -- 'TODO-R346' "$OUT" 2>/dev/null; then
  echo "R346 must_miss TODO-R346: PRISOTEN — FAILOVEDANO"
  MISS_OK=0
else
  echo "R346 must_miss TODO-R346: čisto"
  MISS_OK=1
fi

# 4) Era kontrole: znani ŽIVI needleji prejšnjih er (regresija — morajo ostati ŽIVI)
for pair in 'letvev × 80mm = razmik|R340' 'Prstni odtis izračuna — verzija formule in hash vhodov za reproducibilnost (R150)|R341 val 26' 'Predloga shranjenega izračuna — nalaganje zapolni vsa vnosna polja načina|R343 val 27' 'Shrani predlogo ni povezan needle|R345 val 28 — uporabi: Počisti vse predloge'; do
  needle="${pair%%|*}"; tag="${pair##*|}"
  if [ "$tag" = "R345 val 28 — uporabi: Počisti vse predloge" ]; then needle='Počisti vse predloge'; fi
  if grep -rlqF -- "$needle" "$OUT" 2>/dev/null; then echo "era kontrola $tag: ŽIV"; else echo "era kontrola $tag: MISS"; fi
done

if [ "$NEED_OK" = "1" ] && [ "$MISS_OK" = "1" ]; then
  echo "=== R347 ERA PREVERBA — R346 val 29 ŽIVO NA PRODU (deploy zelen, TODO čisto) ==="
  exit 0
elif [ "$NEED_OK" = "0" ] && [ "$MISS_OK" = "1" ]; then
  echo "=== R347 ERA PREVERBA — R346 val 29 ŠE NI NA PRODU (deploy pending — pričakovana veja) ==="
  exit 2
else
  echo "=== R347 ERA PREVERBA — FAILOVEDANO (must_miss ali žeteva) ==="
  exit 1
fi
