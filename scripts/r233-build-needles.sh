#!/bin/bash
# R233 — build needleji: Dobavitelji CSV izvoz (gumb vedno viden + fail-closed
# toast + ENA resnica glava) + negativni + regresije R228–R232.
# Lekcije r229/r230: scope SAMO .next/static + .next/server; needle oblike
# KOMPIRIRANE (string literali preživijo minifikacijo); single quotes obvezni.
set -u
cd /home/z/my-project
FAIL=0

need() {
  if grep -rqF -- "$1" .next/static .next/server 2>/dev/null; then
    echo "OK   : $2"
  else
    echo "MISS : $2  (needle: $1)"
    FAIL=1
  fi
}

must_miss() {
  if grep -rqF -- "$1" .next/static 2>/dev/null; then
    echo "MISS : $2  ŠE VEDNO v static čankih (needle: $1)"; FAIL=1
  else
    echo "OK   : $2 (izginil — pravilno)"
  fi
}

echo "--- R233 pozitivni (Dobavitelji CSV) ---"
need 'Izvozi dobavitelje kot CSV' "R233 CSV gumb aria-label"
need 'Izvozi vse dobavitelje kot CSV za Excel' "R233 CSV gumb title"
need 'Ni dobaviteljev za izvoz' "R233 fail-closed toast title (0 dobaviteljev)"
need 'CSV se izvozi, ko je dodan prvi dobavitelj.' "R233 fail-closed toast opis"
need 'Aktiven":"Neaktiven' "R233 ENA resnica status (kompilirana oblika)"
need 'Št. naročil' "R233 CSV glava zadnji stolpec"

echo "--- R233 negativni (regresija konvergenc) ---"
must_miss 'bg-stone-600 text-white hover:bg-stone-700' "cv-studio bbox stone (R232)"
must_miss 'border-stone-200 sm:h-[340px]' "map-measure stone obroba (R231)"

echo "--- Regresije (R228-R232) ---"
need 'Izvozi naročila kot CSV' "R231/R232 naročila CSV gumb"
need 'Ni naročil za izvoz' "R232 fail-closed toast (0 naročil)"
need '"Opombe","Pretekel rok"]' "R231 CSV glava stolpec ZADNJI"
need 'Zamujena dobava (' "R230 Domov kartica aria (delci)"
need 'Pretekel rok' "R229 badge tekst"
need 'R228: orders mora biti seznam naročil' "R228 lib (kompilirana oblika)"
need '"Opozorila","Zamujena dobava"' "R228 vodja CSV vrstica"
need 'prices===0?"DA":"NE"' "R226 Zaloga CSV stolpec"
need '— brez vpisane nabavne cene' "R227 naročilnica oznaka"
need 'from-muted' "R230 deal-pipeline žeton"
need 'bg-roksal-navy text-white hover:bg-roksal-navy/90' "R232 cv-studio bbox aktivni žeton"
need 'bg-muted text-roksal-ink' "R229 Inox chip žeton"

if [ "$FAIL" = "1" ]; then
  echo "R233 NEEDLEJI: NEUSPEH"; exit 1
fi
echo "R233 NEEDLEJI: VSI OK"
