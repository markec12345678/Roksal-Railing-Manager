#!/bin/bash
# R222 build-needle preverjanje (vzorec r221): javni chunki v .next/static
# morajo vsebovati R222 needleje (zvonček 'brez' vrstice + badge zgodovine/
# Material zadetka + iskreno prazno stanje z drugo dimenzijo) + R221 regresije.
set -u
cd /home/z/my-project

echo "=== A) R222 needleji ==="
for needle in 'Brez vpisane cene pri katerem koli dobavitelju' 'Preveri nabavne cene' 'odpre Zalogo s filtrom brez dobavitelja' 'Ni nizke zaloge, ni artiklov brez dobavitelja' 'brez-dobavitelja' 'Brez dobavitelja'; do
  n=$(rg -l --fixed-strings "$needle" .next/static/chunks/ 2>/dev/null | wc -l)
  echo "$needle: $n datotek"
done

echo "=== B) regresije (R221/R220/R219/R218/R217/R216) ==="
for needle in 'Brez dobavitelja — pokaži v Zalogi' 'brez dobavitelja pokaži v Zalogi' 'Pokaži samo artikle brez vpisane dobaviteljske cene' 'Ni artiklov brez vpisane dobaviteljske cene v izbranem tipu' 'Na minimumu — pokaži v Zalogi' 'na-minimumu' 'Pod minimumom' 'pod-minimumom' 'klik za izklop' 'nizka zaloga pokaži vse' 'Počisti nedavna iskanja' 'nizka zaloga, odpre naročilni tok' 'odpre Zalogo in naročilni tok' 'Naročilnica kot osnutek naročila' 'Shrani kot osnutek' 'Naroči material' 'Nizka zaloga' 'Material — Naročila (V5)' 'Osveženo ob'; do
  n=$(rg -l --fixed-strings "$needle" .next/static/chunks/ 2>/dev/null | wc -l)
  echo "$needle: $n datotek"
done

echo "=== KONEC r222-build-needles ==="
