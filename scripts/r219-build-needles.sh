#!/bin/bash
# R219 build-needle preverjanje (vzorec r218): javni chunki v .next/static
# morajo vsebovati R219 needleje ('pod minimumom' čip + filter hint protokol)
# + R218/R217/R216/R215 regresije.
set -u
cd /home/z/my-project

echo "=== A) R219 needleji ==="
for needle in 'Pod minimumom' 'Pokaži samo artikle pod minimalno zalogo' 'pod-minimumom' 'klik za izklop'; do
  n=$(rg -l --fixed-strings "$needle" .next/static/chunks/ 2>/dev/null | wc -l)
  echo "$needle: $n datotek"
done

echo "=== B) regresije (R218/R217/R216/R215/R214) ==="
for needle in 'nizka zaloga pokaži vse' 'Pokaži vse s nizko zalogo v Zalogi' 'Počisti nedavna iskanja' 'nizka zaloga, odpre naročilni tok' 'Kopiraj naročilnico za artikel' 'odpre Zalogo in naročilni tok' 'Naročilnica kot osnutek naročila' 'Shrani kot osnutek' 'Naroči material' 'Nizka zaloga' 'Material — Naročila (V5)' 'Osveženo ob'; do
  n=$(rg -l --fixed-strings "$needle" .next/static/chunks/ 2>/dev/null | wc -l)
  echo "$needle: $n datotek"
done

echo "=== KONEC r219-build-needles ==="
