#!/bin/bash
# R216 build-needle preverjanje (vzorec r214): javni chunki v .next/static
# morajo vsebovati R215 needleje (regresija) + R216 passthrough znaki
# ('· minimum' podnapis z roksal-red span ne spreminja besedila — needleji so
# besedilni: 'Nizka zaloga', 'Shrani kot osnutek', 'Naroči material'); stari
# pallete-only klik (brez osnutka) je GONE iz palette vira.
set -u
cd /home/z/my-project

echo "=== A) R216/R215 needleji ==="
for needle in 'Nizka zaloga' 'Shrani kot osnutek' 'Naročilnica kot osnutek naročila' 'Naroči material'; do
  n=$(rg -l --fixed-strings "$needle" .next/static/chunks/ 2>/dev/null | wc -l)
  echo "$needle: $n datotek"
done

echo "=== B) regresije (R214/R213/R212/R211) ==="
for needle in 'Material — Naročila (V5)' 'Odpri naročila' 'aria-current' 'Prikaži Vse' 'orders-active' 'Naročila, ki čakajo na dejanje' 'Meritev ni bilo mogoče naložiti' 'Preklic naročila' 'Osveženo ob'; do
  n=$(rg -l --fixed-strings "$needle" .next/static/chunks/ 2>/dev/null | wc -l)
  echo "$needle: $n datotek"
done

echo "=== C) GONE preverjanja (naj ne obstajati v viru) ==="
# Nizka zaloga veja MORA imeti passthrough (4 argumente); search Material
# veja ZAKONITO ostane pri navadni navigaciji (iskanje ≠ nizka zaloga).
rg -n -U "value=\{\`nizka zaloga \\\$\{i\.naziv\}\`\}[\s\S]{0,400}?onNavigate\('inventory'\)\s*\n\s*close" src/components/roksal/command-palette.tsx 2>/dev/null | head -1 || true
rg -n -U "value=\{\`nizka zaloga \\\$\{i\.naziv\}\`\}[\s\S]{0,400}?onNavigate\('inventory', null, null, \{" src/components/roksal/command-palette.tsx 2>/dev/null | head -1 && echo "nizka zaloga deep-link: PRISOPTEN ✓" || echo "⚠️ nizka zaloga deep-link MANJKA"
# stari zvonček stock dispatch brez fail-safe veje:
stari=$(rg -n "detail: \{ tab: 'inventory' \}\}\)\)" src/components/roksal/notification-center.tsx 2>/dev/null | head -1)
if [ -n "$stari" ]; then echo "⚠️ stari dispatch še prisoten: $stari"; else echo "zvonček stari dispatch: GONE (fail-safe veja zdaj) ✓"; fi
echo "=== KONEC r216-build-needles ==="
