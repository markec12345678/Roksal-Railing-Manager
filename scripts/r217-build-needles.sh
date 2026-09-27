#!/bin/bash
# R217 build-needle preverjanje (vzorec r216): javni chunki v .next/static
# morajo vsebovati R217 needleje (iskalni badge 'Nizka zaloga', EN VIR lib)
# + R216/R215 regresije; fail-closed veja ostaja.
set -u
cd /home/z/my-project

echo "=== A) R217 needleji ==="
for needle in 'osnutekIzIskanja' 'nizka zaloga, odpre naročilni tok' 'Nizka zaloga' 'Kopiraj naročilnico za artikel' 'odpre Zalogo in naročilni tok'; do
  n=$(rg -l --fixed-strings "$needle" .next/static/chunks/ 2>/dev/null | wc -l)
  echo "$needle: $n datotek"
done

echo "=== B) regresije (R216/R215/R214/R213/R212) ==="
for needle in 'Naročilnica kot osnutek naročila' 'Shrani kot osnutek' 'Naroči material' 'Material — Naročila (V5)' 'Odpri naročila' 'aria-current' 'Prikaži Vse' 'orders-active' 'Naročila, ki čakajo na dejanje' 'Osveženo ob'; do
  n=$(rg -l --fixed-strings "$needle" .next/static/chunks/ 2>/dev/null | wc -l)
  echo "$needle: $n datotek"
done

echo "=== KONEC r217-build-needles ==="
