#!/bin/bash
# R225 — build needleji: OSMI signalec (badge 'Brez dobavitelja' na vrstici
# Zaloge) + token harmonizacija vodjinega pregleda + regresije R219-R224.
set -u
cd /home/z/my-project
FAIL=0

need() { # $1 = needle, $2 = opis
  if grep -rqF -- "$1" .next 2>/dev/null; then
    echo "OK   : $2"
  else
    echo "MISS : $2  (needle: $1)"
    FAIL=1
  fi
}

echo "--- R225 needleji (osmi signalec + harmonizacija) ---"
need "Brez dobavitelja — pokaži v Zalogi" "R221 paleta vrstica (regresija)"
need "border-roksal-amber/30 bg-roksal-amber/10" "R225 badge na vrstici (ISTI razredi kot paleta/zvonček)"
need "border-roksal-navy/20 bg-roksal-navy/5" "R225 odprta naročila → navy žeton"
need "border-roksal-green/20 bg-roksal-green/5" "R225 vse v redu → green žeton"
need "border-roksal-red/20 bg-roksal-red/5" "R225 potekli opomniki + nizka zaloga → red žeton"
need "bg-roksal-green/15 text-roksal-green border-roksal-green/30" "R225 žetoni terminov (green)"
need "bg-roksal-navy/10 text-roksal-ink border-roksal-navy/25" "R225 žetoni terminov (navy)"

echo "--- Regresije (R219-R224) ---"
need "Brez dobavitelja (" "R224 vodja kartica aria (števec)"
need "odpre Zalogo s filtrom brez dobavitelja" "R224 vodja kartica aria dejanje"
need "Naročilni tok postavke ne more oceniti — klik odpre Zalogo s filtrom" "R224 vodja kartica opis"
need "Brez vpisane cene pri katerem koli dobavitelju" "R223 Domov opis"
need "Artikli brez vpisane nabavne cene" "R224 vodja title"
need "Na minimumu — pokaži v Zalogi" "R220 paleta vrstica"
need "Pod minimumom" "R219 čip"
need "Preveri nabavne cene" "R221 paleta iskreno prazno"
need "Naročilnica kot osnutek naročila" "R218 osnutek"
need "Nizka zaloga materiala" "Domov rdeča kartica"
need "Vsi artikli so nad minimalno zalogo." "Domov zelena veja"

if [ "$FAIL" = "0" ]; then echo "R225 NEEDLEJI: VSI OK"; else echo "R225 NEEDLEJI: NAPAKA"; exit 1; fi
