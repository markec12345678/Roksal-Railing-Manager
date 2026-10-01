#!/usr/bin/env bash
# r350-era-harvest.sh — R350 TROJNA era preverba: r347.tsv val 30 needleja ×4
# IN r348.tsv val 31 needleja ×5 IN r349.tsv val 32 needleja ×8 na
# produkcijskih čankih (R347+R348+R349 pristajo SKUPAJ — en deploy glave
# repa; glej R348/R349 worklog: deploy anomalija od R346 ere).
# Kanon R345–R349 (r349-era-harvest.sh): URL-ji iz prod-qa teka
# (/tmp/r339-chunkurls.txt) → curl vse → grep -rqF po TSV registru
# (need_static ŽIV / must_miss čisto).
# Fail-closed: če žeteva ali grep ne uspe → EXIT 1 z glasnim sporočilom.
set -u

BASE="https://roksal-railing-manager.vercel.app"
URLS="/tmp/r339-chunkurls.txt"
OUT="/tmp/r350-prod-chunks"
REG_A="scripts/qa-needles/r347.tsv"
REG_B="scripts/qa-needles/r348.tsv"
REG_C="scripts/qa-needles/r349.tsv"

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

# 2) need_static po VSEH TREH registrih — vsi needleji MORAJO biti ŽIVO
#    (3. stolpec = need_static, 1. = needle; TSV TAB ločilo — kanon R340–R349)
NEED_OK=1; need_n=0
preberi_register() {
  local reg="$1" oznaka="$2"
  while IFS=$'\t' read -r needle opis vrsta; do
    case "$needle" in \#*|"") continue ;; esac
    [ "$vrsta" != "need_static" ] && continue
    need_n=$((need_n+1))
    if grep -rlqF -- "$needle" "$OUT" 2>/dev/null; then
      hit=$(grep -rlF -- "$needle" "$OUT" | head -1)
      echo "$oznaka need_static: ŽIV [$hit] — $opis"
    else
      echo "$oznaka need_static: MISS — $opis"
      NEED_OK=0
    fi
  done < "$reg"
}
preberi_register "$REG_A" "R347 val 30"
preberi_register "$REG_B" "R348 val 31"
preberi_register "$REG_C" "R349 val 32"
[ "$need_n" -lt 17 ] && { echo "FAILOVEDANO: VSI trije registri skupaj imajo $need_n need_static needlejev (pričakovano ≥ 17 = 4 + 5 + 8)"; exit 1; }

# 3) must_miss — TODO-R347, TODO-R348 IN TODO-R349 NE SMEJO biti prisotni
MISS_OK=1
for pair in 'TODO-R347|R347' 'TODO-R348|R348' 'TODO-R349|R349'; do
  needle="${pair%%|*}"; tag="${pair##*|}"
  if grep -rlqF -- "$needle" "$OUT" 2>/dev/null; then
    echo "$tag must_miss $needle: PRISOTEN — FAILOVEDANO"
    MISS_OK=0
  else
    echo "$tag must_miss $needle: čisto"
  fi
done

# 4) Era kontrole: znani ŽIVI needleji prejšnjih er (regresija — morajo ostati ŽIVI)
for pair in 'letvev × 80mm = razmik|R340' 'Prstni odtis izračuna — verzija formule in hash vhodov za reproducibilnost (R150)|R341 val 26' 'Predloga shranjenega izračuna — nalaganje zapolni vsa vnosna polja načina|R343 val 27' 'Počisti vse predloge|R345 val 28'; do
  needle="${pair%%|*}"; tag="${pair##*|}"
  if grep -rlqF -- "$needle" "$OUT" 2>/dev/null; then echo "era kontrola $tag: ŽIV"; else echo "era kontrola $tag: MISS"; fi
done

if [ "$NEED_OK" = "1" ] && [ "$MISS_OK" = "1" ]; then
  echo "=== R350 TROJNA ERA PREVERBA — R347 val 30 (×4) IN R348 val 31 (×5) IN R349 val 32 (×8) ŽIVO NA PRODU (deploy zelen, TODO čisto) ==="
  exit 0
elif [ "$NEED_OK" = "0" ] && [ "$MISS_OK" = "1" ]; then
  echo "=== R350 TROJNA ERA PREVERBA — R347+R348+R349 ŠE NI NA PRODU (deploy pending — pričakovana veja po anomaliji R346 ere) ==="
  exit 2
else
  echo "=== R350 TROJNA ERA PREVERBA — FAILOVEDANO (must_miss ali žeteva) ==="
  exit 1
fi
