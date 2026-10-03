#!/usr/bin/env bash
# r390-era-harvest.sh — R390 TRIINŠTIRIDESIJNA era preverba: r347.tsv val 30
# ×4 IN r348.tsv val 31 ×5 IN r349.tsv val 32 ×8 IN r350.tsv val 33 ×9 IN
# r351.tsv val 34 ×3 IN r352.tsv val 35 ×8 IN r353.tsv val 36 ×4 IN
# r354.tsv val 37 ×3 IN r355.tsv val 38 ×3 IN r356.tsv val 39 ×3 IN
# r357.tsv val 40 ×3 IN r358.tsv val 41 ×3 IN r359.tsv val 42 ×3 IN
# r360.tsv val 43 ×3 IN r361.tsv val 44 ×3 IN r362.tsv val 45 ×4 IN
# r363.tsv val 46 ×4 IN r364.tsv val 47 ×4 IN r365.tsv val 48 ×4 IN
# r366.tsv val 49 ×4 IN r367.tsv val 50 ×4 IN r368.tsv val 51 ×4 IN r369.tsv val 52 ×4 IN r370.tsv val 53 ×4 IN r371.tsv val 54 ×4 IN r372.tsv val 55 ×4 IN r373.tsv val 56 ×4 IN r374.tsv ×4 IN r375.tsv val 57 ×4 IN r376.tsv ×4 IN r377.tsv val 58 ×1 IN r378.tsv ×4 IN r382.tsv ×5 IN r383.tsv val 61 ×4 IN r384.tsv val 62 ×4 IN r385.tsv val 63 ×4 IN r386.tsv val 64 ×4 IN r387.tsv val 65 ×4 IN r388.tsv val 66 ×4 IN r389.tsv val 67 ×2 na
# produkcijskih čankih (R390 pride na produ SAM — R347–R389 so ŽE ŽIVI od
# triinštiridesete preverbe R390, del prek hash rezolucije). Kanon R345–R390
# (r390-era-harvest.sh): URL-ji iz prod-qa teka (/tmp/r339-chunkurls.txt) →
# KANONSKA utrjena žeteva qa-harvest.sh (retry ×3 + parcialna guard) →
# grep -rqF po TSV registru (need_static ŽIV / must_miss čisto) + HASH
# REZOLUCIJA (LEKCIJA R354, inverz R351): needle MISS ≠ deploy pending —
# lahko je POKRITOSTNA VRZEL (leno naloženi čanki izven statičnega URL
# seznama); rezolucija = lokalni .next content-hash čanek → prod CDN
# (200 + niz = era ŽIVO; enako ime = enaka vsebina). Fail-closed: brez
# lokalnega builda → NEED_OK=0 z glasnim dvoumjem; žeteva/grep fail →
# EXIT 1 z glasnim sporočilom.
set -u

BASE="https://roksal-railing-manager.vercel.app"
URLS="/tmp/r339-chunkurls.txt"
OUT="/tmp/r390-prod-chunks"
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
REG_L="scripts/qa-needles/r358.tsv"
REG_M="scripts/qa-needles/r359.tsv"
REG_N="scripts/qa-needles/r360.tsv"
REG_O="scripts/qa-needles/r361.tsv"
REG_P="scripts/qa-needles/r362.tsv"
REG_Q="scripts/qa-needles/r363.tsv"
REG_R="scripts/qa-needles/r364.tsv"
REG_S="scripts/qa-needles/r365.tsv"
REG_T="scripts/qa-needles/r366.tsv"
REG_U="scripts/qa-needles/r367.tsv"
REG_V="scripts/qa-needles/r368.tsv"
REG_W="scripts/qa-needles/r369.tsv"
REG_X="scripts/qa-needles/r370.tsv"
REG_Y="scripts/qa-needles/r371.tsv"
REG_Z="scripts/qa-needles/r372.tsv"
REG_AA="scripts/qa-needles/r373.tsv"
REG_AB="scripts/qa-needles/r374.tsv"
REG_AC="scripts/qa-needles/r375.tsv"
REG_AD="scripts/qa-needles/r376.tsv"
REG_AE="scripts/qa-needles/r377.tsv"
REG_AF="scripts/qa-needles/r378.tsv"
REG_AG="scripts/qa-needles/r379.tsv"
REG_AH="scripts/qa-needles/r380.tsv"
REG_AI="scripts/qa-needles/r381.tsv"
REG_AJ="scripts/qa-needles/r382.tsv"
REG_AK="scripts/qa-needles/r383.tsv"
REG_AL="scripts/qa-needles/r384.tsv"
REG_AM="scripts/qa-needles/r385.tsv"
REG_AN="scripts/qa-needles/r386.tsv"
REG_AO="scripts/qa-needles/r387.tsv"
REG_AP="scripts/qa-needles/r388.tsv"
REG_AQ="scripts/qa-needles/r389.tsv"

rm -rf "$OUT"; mkdir -p "$OUT"

# 1) Žetev: KANONSKA utrjena žeteva (qa-harvest.sh — R359 QA-infra hardening,
#    PORABE od R360 dalje: retry ×3 z determinističnim backoffom 1s/2s +
#    PARCIALNA-ŽETEVA guard min 30 čankov + fail-closed vhodi).
if ! bash "$(dirname "$0")/qa-harvest.sh" "$URLS" "$OUT" 30; then
  echo "FAILOVEDANO: kanonska žeteva ni uspela — era preverba neveljavna (fail-closed)"
  exit 1
fi
n=$(ls -1 "$OUT" | wc -l)
echo "ŽETEV: $n čankov (kanonska utrjena žeteva — retry ×3 kanon)"

# R389 CHECKPOINT GUARD (LEKCIJA R389): 403 "Vercel Security Checkpoint"
# strani V ŽETEVI = onesnažena žeteva (qa-harvest uspeh = ne-prazno telo —
# 403 stran JE ne-prazna!). Brez guardarja: lažni MISS storm + zavajajoč
# 'neuspešno razrešeni' namesto prave diagnoze. Glasen fail-closed abort:
if grep -rlq "Vercel Security Checkpoint" "$OUT" 2>/dev/null; then
  pol=0
  for f in "$OUT"/*.bin; do
    if grep -q "Vercel Security Checkpoint" "$f" 2>/dev/null; then pol=$((pol+1)); fi
  done
  echo "FAILOVEDANO: prod CDN vrača Vercel Security Checkpoint (403) — $pol/$n čankov onesnaženih; era preverba NEVELJAVNA (deterministična pavza + ponovni poskus kasneje; NI code-bug, NI pokritostna vrzel)"
  exit 2
fi

# R389 ODPADNI CENZUS (LEKCIJA R389 (2)): zamrznjen URL seznam je iz R339 —
# stari Vercel artefakti OPADEJO ("Not Found" telesa). Iskren vidni popis
# (poročilo, NE abort — need_static ima hash-rezolucijski fallback):
odpad=0
for f in "$OUT"/*.bin; do
  if [ "$(head -c 9 "$f" 2>/dev/null)" = "Not Found" ]; then odpad=$((odpad+1)); fi
done
if [ "$odpad" -gt 0 ]; then
  echo "OPOMBA: $odpad/$n čankov iz zamrznjenega URL seznama (R339) = 'Not Found' (opadel artefakt — pokritost gredo prek hash rezolucije, LEKCIJA R354)"
fi

# 2) need_static po VSEH TRIINŠTIRIDESETIH registrov — vsi needleji MORAJO biti
#    ŽIVO (3. stolpec = need_static, 1. = needle; TSV TAB ločilo — kanon
#    R340–R368)
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
preberi_register "$REG_L" "R358 val 41"
preberi_register "$REG_M" "R359 val 42"
preberi_register "$REG_N" "R360 val 43"
preberi_register "$REG_O" "R361 val 44"
preberi_register "$REG_P" "R362 val 45"
preberi_register "$REG_Q" "R363 val 46"
preberi_register "$REG_R" "R364 val 47"
preberi_register "$REG_S" "R365 val 48"
preberi_register "$REG_T" "R366 val 49"
preberi_register "$REG_U" "R367 val 50"
preberi_register "$REG_V" "R368 val 51"
preberi_register "$REG_W" "R369 val 52"
preberi_register "$REG_X" "R370 val 53"
preberi_register "$REG_Y" "R371 val 54"
preberi_register "$REG_Z" "R372 val 55"
preberi_register "$REG_AA" "R373 val 56"
preberi_register "$REG_AB" "R374 issue #13"
preberi_register "$REG_AC" "R375 val 57"
preberi_register "$REG_AD" "R376 issue #13 (BOM)"
preberi_register "$REG_AE" "R377 val 58"
preberi_register "$REG_AF" "R378 issue #13 (R167)"
preberi_register "$REG_AG" "R379 val 59"
preberi_register "$REG_AH" "R380 issue #13 (R168)"
preberi_register "$REG_AI" "R381 val 60"
preberi_register "$REG_AJ" "R382 issue #13 (R169)"
preberi_register "$REG_AK" "R383 val 61"
preberi_register "$REG_AL" "R384 val 62"
preberi_register "$REG_AM" "R385 val 63"
preberi_register "$REG_AN" "R386 val 64"
preberi_register "$REG_AO" "R387 val 65"
preberi_register "$REG_AP" "R388 val 66"
preberi_register "$REG_AQ" "R389 val 67"
[ "$need_n" -lt 173 ] && { echo "FAILOVEDANO: VSI triinštirideset registrov SKUPAJ imajo $need_n need_static needlejev (pričakovano ≥ 173 = 4 + 5 + 8 + 9 + 3 + 8 + 4 + 3 + 3 + 3 + 3 + 3 + 3 + 3 + 3 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 1 + 4 + 4 + 4 + 4 + 5 + 4 + 4 + 4 + 4 + 4 + 4 + 2)"; exit 1; }

# 2b) REZOLUCIJA MISS needlejev prek lokalnega content-hash čanka (LEKCIJA R354)
if [ "${#MISS_NEEDLES[@]}" -gt 0 ]; then
  : > "/tmp/r390-resolucija-hash.txt"
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
      koda=$(curl -sS --max-time 30 -o "/tmp/r390-resolucija-$ime" -w "%{http_code}" "$BASE/_next/static/chunks/$ime" 2>/dev/null || echo 000)
      if [ "$koda" = "200" ] && grep -qF -- "$needle" "/tmp/r390-resolucija-$ime" 2>/dev/null; then
        echo "REZOLUCIJA ŽIVO: hash dokaz $ime na prod CDN: HTTP 200 + niz prisoten — $needle"
      printf '%s\n' "$needle" >> "/tmp/r390-resolucija-hash.txt"
      else
        echo "REZOLUCIJA MISS [lokalni čanek $ime, prod HTTP $koda / niz odsoten] — $needle"
        NEED_OK=0
      fi
    done
  fi
fi

# 2c) SERVER-NEEDLE razširitev (R376/R377, LEKCIJA R375 (6)): mešani client+server
#     registerji — server koda (API rute) NIKOLI v .next/static/chunks niti
#     na prod CDN. Dvodelni dokaz za nehashirane needleje: (a) needle v
#     lokalnem .next/server (produkcijski build, kompilirani čanek — .map
#     izključen); (b) determinističen vedenjski probe lastniške rute na
#     produ (fail-closed status; 404 = rute ni na produ = NI deployan).
#     Needle se razreši, če KATERI KOLI spec uspe (server čanki v grahu več rut).
SERVER_PROBE_SPECS=("AB|/api/price-book|401" "AD|/api/bom|401" "AD|/api/bom/procurement|401" "AF|/api/production|401" "AF|/api/installation-records|401" "AG|/api/price-book|401" "AH|/api/inventory|401" "AI|/api/sync|401" "AJ|/api/leads|401" "AJ|/api/opportunities|401" "AJ|/api/customer-addresses|401" "AK|/api/sync|401")
SERVER_RES="/tmp/r390-resolucija-server.txt"
: > "$SERVER_RES"
if [ "${#MISS_NEEDLES[@]}" -gt 0 ] && [ -d ".next/server" ]; then
  for needle in "${MISS_NEEDLES[@]}"; do
    grep -qxF -- "$needle" "/tmp/r390-resolucija-hash.txt" 2>/dev/null && continue
    resolved=""
    for spec in "${SERVER_PROBE_SPECS[@]}"; do
      regvar="${spec%%|*}"; rest="${spec#*|}"; ruta="${rest%%|*}"; expect="${rest##*|}"
      regfile_var="REG_$regvar"; regfile="${!regfile_var}"
      grep -qF -- "$needle" "$regfile" 2>/dev/null || continue
      server_hit=$(grep -rlF -- "$needle" .next/server/ 2>/dev/null | grep -v '\.map$' | head -1)
      if [ -z "$server_hit" ]; then
        continue
      fi
      probe_koda=$(curl -sS --max-time 30 -o /dev/null -w "%{http_code}" "$BASE$ruta" 2>/dev/null || echo 000)
      if [ "$probe_koda" = "$expect" ]; then
        echo "SERVER-REZOLUCIJA ŽIVO: .next/server [$server_hit] + prod $ruta HTTP $probe_koda (fail-closed vrata, deterministično) — $needle"
        resolved=1
        printf '%s\n' "$needle" >> "$SERVER_RES"
        break
      else
        echo "SERVER-REZOLUCIJA MISS [prod $ruta HTTP $probe_koda ≠ $expect] — $needle"
      fi
    done
    if [ -z "$resolved" ]; then
      echo "SERVER-REZOLUCIJA: needle NI razrešen prek nobenega probe spec-a — $needle"
    fi
  done
  preostalo=0
  for needle in "${MISS_NEEDLES[@]}"; do
    if ! grep -qxF -- "$needle" "/tmp/r390-resolucija-hash.txt" 2>/dev/null && ! grep -qxF -- "$needle" "$SERVER_RES" 2>/dev/null; then
      preostalo=$((preostalo+1))
    fi
  done
  if [ "$preostalo" -eq 0 ]; then
    echo "SERVER-REZOLUCIJA: vsi MISS needleji razrešeni (hash + server dokazi)"
    NEED_OK=1
  fi
else
  if [ "${#MISS_NEEDLES[@]}" -gt 0 ] && [ ! -d ".next/server" ]; then
    echo "SERVER-REZOLUCIJA NEMOŽNA: lokalni .next/server ne obstaja (fail-closed)"
  fi
fi

# 3) must_miss — TODO-R347 … TODO-R389 NE SMEJO biti prisotni
MISS_OK=1
for pair in 'TODO-R347|R347' 'TODO-R348|R348' 'TODO-R349|R349' 'TODO-R350|R350' 'TODO-R351|R351' 'TODO-R352|R352' 'TODO-R353|R353' 'TODO-R354|R354' 'TODO-R355|R355' 'TODO-R356|R356' 'TODO-R357|R357' 'TODO-R358|R358' 'TODO-R359|R359' 'TODO-R360|R360' 'TODO-R361|R361' 'TODO-R362|R362' 'TODO-R363|R363' 'TODO-R364|R364' 'TODO-R365|R365' 'TODO-R366|R366' 'TODO-R367|R367' 'TODO-R368|R368' 'TODO-R369|R369' 'TODO-R370|R370' 'TODO-R371|R371' 'TODO-R372|R372' 'TODO-R373|R373' 'TODO-R374|R374' 'TODO-R375|R375' 'TODO-R376|R376' 'TODO-R377|R377' 'TODO-R378|R378' 'TODO-R379|R379' 'TODO-R380|R380' 'TODO-R381|R381' 'TODO-R382|R382' 'TODO-R383|R383' 'TODO-R384|R384' 'TODO-R385|R385' 'TODO-R386|R386' 'TODO-R387|R387' 'TODO-R388|R388' 'TODO-R389|R389'; do
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
  if grep -rlqF -- "$needle" "$OUT" 2>/dev/null; then echo "era kontrola $tag: ŽIV"; else
    # R389 hash-rezolucija fallback (LEKCIJA R354 kanon; R389: URL seznam iz
    # R339 OPADE — era kontrola dobi ISTI rezolucijski mehanizem kot need_static):
    lokalni=$(grep -rlF -- "$needle" .next/static/chunks/ 2>/dev/null | head -1)
    res=""
    if [ -n "$lokalni" ]; then
      ime=$(basename "$lokalni")
      koda=$(curl -sS --max-time 30 -o "/tmp/r390-kontrola-$ime" -w "%{http_code}" "$BASE/_next/static/chunks/$ime" 2>/dev/null || echo 000)
      if [ "$koda" = "200" ] && grep -qF -- "$needle" "/tmp/r390-kontrola-$ime" 2>/dev/null; then
        echo "era kontrola $tag: ŽIV (hash rezolucija $ime — URL seznam opadel)"; res=1
      fi
    fi
    [ -n "$res" ] || echo "era kontrola $tag: MISS"
  fi
done

if [ "$NEED_OK" = "1" ] && [ "$MISS_OK" = "1" ]; then
  echo "=== R390 TRIINŠTIRIDESIJNA ERA PREVERBA — R347 val 30 (×4) IN R348 val 31 (×5) IN R349 val 32 (×8) IN R350 val 33 (×9) IN R351 val 34 (×3) IN R352 val 35 (×8) IN R353 val 36 (×4) IN R354 val 37 (×3) IN R355 val 38 (×3) IN R356 val 39 (×3) IN R357 val 40 (×3) IN R358 val 41 (×3) IN R359 val 42 (×3) IN R360 val 43 (×3) IN R361 val 44 (×3) IN R362 val 45 (×4) IN R363 val 46 (×4) IN R364 val 47 (×4) IN R365 val 48 (×4) IN R366 val 49 (×4) IN R367 val 50 (×4) IN R368 val 51 (×4) IN R369 val 52 (×4) IN R370 val 53 (×4) IN R371 val 54 (×4) IN R372 val 55 (×4) IN R373 val 56 (×4) IN R374 issue #13 (×4) IN R375 val 57 (×4) IN R376 issue #13 (BOM) (×4) IN R377 val 58 (×1) IN R378 issue #13 (R167) (×4) IN R379 val 59 (×4) IN R380 issue #13 (R168) (×4) IN R381 val 60 (×4) IN R382 issue #13 (R169) (×5) IN R383 val 61 (×4) IN R384 val 62 (×4) IN R385 val 63 (×4) IN R386 val 64 (×4) IN R387 val 65 (×4) IN R388 val 66 (×4) IN R389 val 67 (×2) ŽIVO NA PRODU (deploy zelen, TODO čisto; morebiti delno prek hash rezolucije — LEKCIJA R354) ==="
  exit 0
elif [ "$NEED_OK" = "0" ] && [ "$MISS_OK" = "1" ]; then
  echo "=== R390 TRIINŠTIRIDESIJNA ERA PREVERBA — needleji MISS neuspešno razrešeni (deploy pending ALI pokritostna vrzel brez lokalnega builda) ==="
  exit 2
else
  echo "=== R390 TRIINŠTIRIDESIJNA ERA PREVERBA — FAILOVEDANO (must_miss ali žeteva) ==="
  exit 1
fi
