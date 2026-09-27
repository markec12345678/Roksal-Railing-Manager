#!/bin/bash
# R224 — build needleji: sedmi signalec 'Brez dobavitelja' v vodjinem pregledu
# (zaslon + CSV + PDF) + regresije R219-R223.
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

echo "--- R224 needleji (vodja sedmi signalec) ---"
need "Brez dobavitelja (" "vodja kartica aria (števec)"
need "odpre Zalogo s filtrom brez dobavitelja" "vodja kartica aria dejanje"
need "Naročilni tok postavke ne more oceniti — klik odpre Zalogo s filtrom" "vodja kartica opis"
need "artiklov brez vpisane cene" "vodja kartica glavna vrstica"
need "Brez vpisane cene pri katerem koli dobavitelju" "regresija: R223 Domov opis"
need "Artikli brez vpisane nabavne cene" "vodja title"

echo "--- Regresije (R219-R223) ---"
need "Brez dobavitelja — pokaži v Zalogi" "R221 paleta vrstica"
need "Na minimumu — pokaži v Zalogi" "R220 paleta vrstica"
need "Pod minimumom" "R219 čip"
need "Preveri nabavne cene" "R221 paleta iskreno prazno"
need "Naročilnica kot osnutek naročila" "R218 osnutek"
need "Nizka zaloga materiala" "Domov rdeča kartica"
need "Vsi artikli so nad minimalno zalogo." "Domov zelena veja"

if [ "$FAIL" = "0" ]; then echo "R224 NEEDLEJI: VSI OK"; else echo "R224 NEEDLEJI: NAPAKA"; exit 1; fi
