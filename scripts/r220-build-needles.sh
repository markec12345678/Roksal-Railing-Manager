#!/bin/bash
# R220 build-needle preverjanje (vzorec r219): javni chunki v .next/static
# morajo vsebovati R220 needleje ('na minimumu' čip + vrstica + whitelist
# vrednost) + R219/R218/R217/R216/R215 regresije.
set -u
cd /home/z/my-project

echo "=== A) R220 needleji ==="
for needle in 'Na minimumu' 'Na minimumu — pokaži v Zalogi' 'na-minimumu' 'Pokaži samo artikle na minimalni zalogi' 'točno na minimumu' 'nizka zaloga na minimumu' 'Ni artiklov točno na minimalni zalogi v izbranem tipu'; do
  n=$(rg -l --fixed-strings "$needle" .next/static/chunks/ 2>/dev/null | wc -l)
  echo "$needle: $n datotek"
done

echo "=== B) regresije (R219/R218/R217/R216/R215/R214) ==="
for needle in 'Pod minimumom' 'Pokaži samo artikle pod minimalno zalogo' 'pod-minimumom' 'klik za izklop' 'nizka zaloga pokaži vse' 'Pokaži vse s nizko zalogo v Zalogi' 'Počisti nedavna iskanja' 'nizka zaloga, odpre naročilni tok' 'Kopiraj naročilnico za artikel' 'odpre Zalogo in naročilni tok' 'Naročilnica kot osnutek naročila' 'Shrani kot osnutek' 'Naroči material' 'Nizka zaloga' 'Material — Naročila (V5)' 'Osveženo ob'; do
  n=$(rg -l --fixed-strings "$needle" .next/static/chunks/ 2>/dev/null | wc -l)
  echo "$needle: $n datotek"
done

echo "=== KONEC r220-build-needles ==="
