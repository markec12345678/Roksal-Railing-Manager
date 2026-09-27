#!/bin/bash
# R221 build-needle preverjanje (vzorec r220): javni chunki v .next/static
# morajo vsebovati R221 needleje ('brez dobavitelja' čip + vrstica + whitelist
# vrednost + EmptyState prazna stanja) + R220/R219/R218/R217/R216/R215 regresije.
set -u
cd /home/z/my-project

echo "=== A) R221 needleji ==="
for needle in 'Brez dobavitelja' 'Brez dobavitelja — pokaži v Zalogi' 'brez-dobavitelja' 'brez dobavitelja pokaži v Zalogi' 'Pokaži samo artikle brez vpisane dobaviteljske cene' 'za katere ni vpisana cena pri nobenem dobavitelju' 'Ni artiklov brez vpisane dobaviteljske cene v izbranem tipu'; do
  n=$(rg -l --fixed-strings "$needle" .next/static/chunks/ 2>/dev/null | wc -l)
  echo "$needle: $n datotek"
done

echo "=== B) regresije (R220/R219/R218/R217/R216/R215/R214) ==="
for needle in 'Na minimumu' 'Na minimumu — pokaži v Zalogi' 'na-minimumu' 'Pokaži samo artikle na minimalni zalogi' 'Ni artiklov točno na minimalni zalogi v izbranem tipu' 'Pod minimumom' 'Pokaži samo artikle pod minimalno zalogo' 'pod-minimumom' 'klik za izklop' 'nizka zaloga pokaži vse' 'Počisti nedavna iskanja' 'nizka zaloga, odpre naročilni tok' 'Kopiraj naročilnico za artikel' 'odpre Zalogo in naročilni tok' 'Naročilnica kot osnutek naročila' 'Shrani kot osnutek' 'Naroči material' 'Nizka zaloga' 'Material — Naročila (V5)' 'Osveženo ob'; do
  n=$(rg -l --fixed-strings "$needle" .next/static/chunks/ 2>/dev/null | wc -l)
  echo "$needle: $n datotek"
done

echo "=== KONEC r221-build-needles ==="
