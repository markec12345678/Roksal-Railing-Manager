#!/bin/bash
# R223 build-needle preverjanje (vzorec r222): javni chunki v .next/static
# morajo vsebovati R223 needleje (Domov kartica 'Brez dobavitelja' — iskren
# aria + opis o naročilnem toku) + R222/R221 regresije.
set -u
cd /home/z/my-project

echo "=== A) R223 needleji (Domov kartica) ==="
for needle in 'naročilni tok postavke ne more oceniti' 'odpre Zalogo s filtrom brez dobavitelja' 'Artikli brez vpisane cene pri katerem koli dobavitelju' 'brez-dobavitelja' 'Brez dobavitelja'; do
  n=$(rg -l --fixed-strings "$needle" .next/static/chunks/ 2>/dev/null | wc -l)
  echo "$needle: $n datotek"
done

echo "=== B) regresije (R222/R221/R220/R219/R218/R217/R216) ==="
for needle in 'Brez vpisane cene pri katerem koli dobavitelju' 'Preveri nabavne cene' 'Ni nizke zaloge, ni artiklov brez dobavitelja' 'Brez dobavitelja — pokaži v Zalogi' 'Pokaži samo artikle brez vpisane dobaviteljske cene' 'Na minimumu — pokaži v Zalogi' 'na-minimumu' 'Pod minimumom' 'pod-minimumom' 'klik za izklop' 'nizka zaloga pokaži vse' 'Počisti nedavna iskanja' 'Naročilnica kot osnutek naročila' 'Shrani kot osnutek' 'Naroči material' 'Nizka zaloga' 'Osveženo ob'; do
  n=$(rg -l --fixed-strings "$needle" .next/static/chunks/ 2>/dev/null | wc -l)
  echo "$needle: $n datotek"
done

echo "=== KONEC r223-build-needles ==="
