#!/bin/bash
# R226 — build needleji: DEVETI signalec (CSV stolpec 'Brez dobavitelja'
# DA/NE) + vodja pika na žetonu bg-muted-foreground + regresije R219-R225.
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

echo "--- R226 needleji (deveti signalec + pika žeton) ---"
need "'Nizka', 'Brez dobavitelja'" "R226 CSV glava z novim stolpcem"
need "item._count?.prices === 0 ? 'DA' : 'NE'" "R226 CSV dobesedna === 0 (DA/NE)"
need "bg-muted-foreground" "R226 Zapadlo pika → žeton (en razred, obe temi)"

echo "--- Regresije (R219-R225) ---"
need "Brez dobavitelja — pokaži v Zalogi" "R221 paleta vrstica"
need "border-roksal-amber/30 bg-roksal-amber/10" "R225 badge na vrstici (ISTI razredi kot paleta/zvonček)"
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
need "border-roksal-navy/20 bg-roksal-navy/5" "R225 odprta naročila → navy žeton"
need "border-roksal-green/20 bg-roksal-green/5" "R225 vse v redu → green žeton"
need "bg-roksal-navy/10 text-roksal-ink border-roksal-navy/25" "R225 žetoni terminov (navy)"

echo "--- Negativni needle (stone pika ne sme obstajati v odposlanem kodu) ---"
# pozor: .next/cache je ostanek prejšnjih gradnj (webpack cache) — preiskujemo
# SAMO odposlane čanke (static + server), kot v prod prod probe.
if grep -rqF -- "bg-stone-400 dark:bg-stone-600" .next/static .next/server 2>/dev/null; then
  echo "MISS : vodja stone pika ŠE VEDNO v odposlanem kodu (morala izginiti)"
  FAIL=1
else
  echo "OK   : stone pika izginila iz odposlanih čankov"
fi

if [ "$FAIL" = "0" ]; then echo "R226 NEEDLEJI: VSI OK"; else echo "R226 NEEDLEJI: NAPAKA"; exit 1; fi
