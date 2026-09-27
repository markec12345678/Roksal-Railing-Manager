#!/bin/bash
# R218 build-needle preverjanje (vzorec r217): javni chunki v .next/static
# morajo vsebovati R218 needleje ('Vse' vrstica + zgodovina žiga EN VIR) +
# R217/R216/R215 regresije.
set -u
cd /home/z/my-project

echo "=== A) R218 needleji ==="
for needle in 'nizka zaloga pokaži vse' 'Pokaži vse s nizko zalogo v Zalogi' 'Pokaži vseh ' 'Nizka zaloga' 'Počisti nedavna iskanja'; do
  n=$(rg -l --fixed-strings "$needle" .next/static/chunks/ 2>/dev/null | wc -l)
  echo "$needle: $n datotek"
done

echo "=== B) regresije (R217/R216/R215/R214) ==="
for needle in 'nizka zaloga, odpre naročilni tok' 'Kopiraj naročilnico za artikel' 'odpre Zalogo in naročilni tok' 'Naročilnica kot osnutek naročila' 'Shrani kot osnutek' 'Naroči material' 'Material — Naročila (V5)' 'Odpri naročila' 'aria-current' 'Prikaži Vse' 'Osveženo ob'; do
  n=$(rg -l --fixed-strings "$needle" .next/static/chunks/ 2>/dev/null | wc -l)
  echo "$needle: $n datotek"
done

echo "=== KONEC r218-build-needles ==="
