#!/usr/bin/env bash
# r358-era-harvest.sh — R358 ENEAJSTIJNA era preverba: r347.tsv val 30 ×4 IN
# r348.tsv val 31 ×5 IN r349.tsv val 32 ×8 IN r350.tsv val 33 ×9 IN r351.tsv
# val 34 ×3 IN r352.tsv val 35 ×8 IN r353.tsv val 36 ×4 IN r354.tsv val 37 ×3
# IN r355.tsv val 38 ×3 IN r356.tsv val 39 ×3 IN r357.tsv val 40 ×3 na
# produkcijskih čankih (R357 pride na produ SAM — R347–R356 so ŽE ŽIVI od
# desetijne preverbe R357, del prek hash rezolucije). Kanon R345–R357
# (r357-era-harvest.sh): URL-ji iz prod-qa teka (/tmp/r339-chunkurls.txt) →
# curl vse → grep -rqF po TSV registru (need_static ŽIV / must_miss čisto) +
# HASH REZOLUCIJA (LEKCIJA R354, inverz R351): needle MISS ≠ deploy pending —
# lahko je POKRITOSTNA VRZEL (leno naloženi čanki izven statičnega URL
# seznama); rezolucija = lokalni .next content-hash čanek → prod CDN (200 +
# niz = era ŽIVO; enako ime = enaka vsebina). Fail-closed: brez lokalnega
# builda → EXIT=2 z glasnim dvoumjem; žeteva/grep fail → EXIT 1 z glasnim
# sporočilom.
set -u

BASE="https://roksal-railing-manager.vercel.app"
URLS="/tmp/r339-chunkurls.txt"
OUT="/tmp/r358-prod-chunks"
REG_A="scripts/qa-needles/r347.tsv"
REG_B="scripts/qa-needles/r348.tsv"
REG_C="scripts/qa-needles/r349.tsv"
REG_D="scripts/qa-needles/r350.tsv"
REG_E="scripts/qa-needles/r351.tsv"
REG_F="scripts/qa-needles/r352.tsv"
REG_G="scripts/qa-needles/r353.tsv"
REG_H="scripts/qa-needles/r354.tsv"
REG_I="scripts/qa-needles/r355.tsv"
REG_J="scripts/qa-needles/r356.tsv"
REG_K="scripts/qa-needles/r357.tsv"

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

# 2) need_static po VSEH ENEAJSTIH registrih — vsi needleji MORAJO biti ŽIVO
#    (3. stolpec = need_static, 1. = needle; TSV TAB ločilo — kanon R340–R357)
NEED_OK=1; need_n=0
MISS_NEEDLES=()
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
      echo "$oznaka need_static: MISS (poskušam rezolucijo prek lokalnega hash čanka) — $opis"
      MISS_NEEDLES+=("$needle")
    fi
  done < "$reg"
}
preberi_register "$REG_A" "R347 val 30"
preberi_register "$REG_B" "R348 val 31"
preberi_register "$REG_C" "R349 val 32"
preberi_register "$REG_D" "R350 val 33"
preberi_register "$REG_E" "R351 val 34"
preberi_register "$REG_F" "R352 val 35"
preberi_register "$REG_G" "R353 val 36"
preberi_register "$REG_H" "R354 val 37"
preberi_register "$REG_I" "R355 val 38"
preberi_register "$REG_J" "R356 val 39"
preberi_register "$REG_K" "R357 val 40"
[ "$need_n" -lt 53 ] && { echo "FAILOVEDANO: VSI enajst registr SKUPAJ imajo $need_n need_static needlejev (pričakovano ≥ 53 = 4 + 5 + 8 + 9 + 3 + 8 + 4 + 3 + 3 + 3 + 3)"; exit 1; }

# 2b) REZOLUCIJA MISS needlejev prek lokalnega content-hash čanka (LEKCIJA R354)
if [ "${#MISS_NEEDLES[@]}" -gt 0 ]; then
  if [ ! -d ".next/static/chunks" ]; then
    echo "REZOLUCIJA NEMOŽNA: lokalni .next/static/chunks ne obstaja — MISS ostaja dvoumen (deploy pending ALI pokritostna vrzel)"
    NEED_OK=0
  else
    for needle in "${MISS_NEEDLES[@]}"; do
      lokalni=$(grep -rlF -- "$needle" .next/static/chunks/ 2>/dev/null | head -1)
      if [ -z "$lokalni" ]; then
        echo "REZOLUCIJA: needle NI v lokalnem buildu — to je PRAVI MISS (koda manjka)"
        NEED_OK=0
        continue
      fi
      ime=$(basename "$lokalni")
      koda=$(curl -sS --max-time 30 -o "/tmp/r358-resolucija-$ime" -w "%{http_code}" "$BASE/_next/static/chunks/$ime" 2>/dev/null || echo 000)
      if [ "$koda" = "200" ] && grep -qF -- "$needle" "/tmp/r358-resolucija-$ime" 2>/dev/null; then
        echo "REZOLUCIJA ŽIV [hash dokaz $ime na prod CDN: HTTP 200 + niz prisoten] — $needle"
      else
        echo "REZOLUCIJA MISS [lokalni čanek $ime, prod HTTP $koda / niz odsoten] — $needle"
        NEED_OK=0
      fi
    done
  fi
fi

# 3) must_miss — TODO-R347 … TODO-R357 NE SMEJO biti prisotni
MISS_OK=1
for pair in 'TODO-R347|R347' 'TODO-R348|R348' 'TODO-R349|R349' 'TODO-R350|R350' 'TODO-R351|R351' 'TODO-R352|R352' 'TODO-R353|R353' 'TODO-R354|R354' 'TODO-R355|R355' 'TODO-R356|R356' 'TODO-R357|R357'; do
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
  echo "=== R358 ENEAJSTIJNA ERA PREVERBA — R347 val 30 (×4) IN R348 val 31 (×5) IN R349 val 32 (×8) IN R350 val 33 (×9) IN R351 val 34 (×3) IN R352 val 35 (×8) IN R353 val 36 (×4) IN R354 val 37 (×3) IN R355 val 38 (×3) IN R356 val 39 (×3) IN R357 val 40 (×3) ŽIVO NA PRODU (deploy zelen, TODO čisto; morebiti delno prek hash rezolucije — LEKCIJA R354) ==="
  exit 0
elif [ "$NEED_OK" = "0" ] && [ "$MISS_OK" = "1" ]; then
  echo "=== R358 ENEAJSTIJNA ERA PREVERBA — needleji MISS neuspešno razrešeni (deploy pending ALI pokritostna vrzel brez lokalnega builda) ==="
  exit 2
else
  echo "=== R358 ENEAJSTIJNA ERA PREVERBA — FAILOVEDANO (must_miss ali žeteva) ==="
  exit 1
fi
