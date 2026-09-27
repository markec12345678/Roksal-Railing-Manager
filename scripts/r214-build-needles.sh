#!/bin/bash
# R214 build-needle preverjanje (vzorec r211): javni chunki v .next/static
# morajo vsebovati R214 needleje + R213/R211 regresije; stari inline palette
# protokol je GONE iz page.tsx builda (vir testira to že — tukaj chunk scan).
set -u
cd /home/z/my-project

echo "=== A) R214 needleji ==="
for needle in 'Material — Naročila (V5)' 'Material — Dobavitelji (V5)' 'Material — BOM Refine (V5)' 'Odpri naročila' 'aria-current'; do
  n=$(rg -l --fixed-strings "$needle" .next/static/chunks/ 2>/dev/null | wc -l)
  echo "$needle: $n datotek"
done

echo "=== B) regresije (R213/R211/R210) ==="
for needle in 'Prikaži Vse' 'Nizka zaloga, današnje montaže, naročila' 'orders-active' 'Naročila, ki čakajo na dejanje' 'Meritev ni bilo mogoče naložiti' 'Preklic naročila' 'Osveženo ob'; do
  n=$(rg -l --fixed-strings "$needle" .next/static/chunks/ 2>/dev/null | wc -l)
  echo "$needle: $n datotek"
done

echo "=== C) GONE preverjanja (naj ne obstajati v viru) ==="
rg -c "onNavigate=\{\(tab, more\) => \{" src/app/page.tsx 2>/dev/null || echo "stari inline palette protokol: GONE ✓"
rg -n "setMoreTab\(more\)\n            setActiveTab" src/app/page.tsx 2>/dev/null | head -1 || echo "setMoreTab+setActiveTab inline: GONE ✓"
echo "=== KONEC r214-build-needles ==="
