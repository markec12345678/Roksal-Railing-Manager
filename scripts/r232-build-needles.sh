#!/bin/bash
# R232 — build needleji: CSV gumb VEDNO viden + fail-closed toast + cv-studio
# žetoni + negativni (cv-studio stone dvojčki izginili — UNIKATNE oblike,
# r230 lekcija št. 3) + regresije R228–R231.
# Lekcije r229/r230: scope SAMO .next/static + .next/server; needle oblike
# KOMPIRIRANE (string literali preživijo minifikacijo; simbolna imena NE);
# backticki v double quotes = bash substitution — single quotes obvezni.
set -u
cd /home/z/my-project
FAIL=0

need() { # $1 = needle, $2 = opis
  if grep -rqF -- "$1" .next/static .next/server 2>/dev/null; then
    echo "OK   : $2"
  else
    echo "MISS : $2  (needle: $1)"
    FAIL=1
  fi
}

must_miss() { # negativni — UNIKATNA oblika konvertirane komponente
  if grep -rqF -- "$1" .next/static 2>/dev/null; then
    echo "MISS : $2  ŠE VEDNO v static čankih (needle: $1)"; FAIL=1
  else
    echo "OK   : $2 (izginil — pravilno)"
  fi
}

echo "--- R232 pozitivni (gumb vedno viden + fail-closed toast + cv-studio žetoni) ---"
need 'Izvozi naročila kot CSV' "R231/R232 CSV gumb aria-label"
need 'Ni naročil za izvoz' "R232 fail-closed toast title (0 naročil)"
need 'CSV se izvozi, ko je dodano prvo naročilo.' "R232 fail-closed toast opis"
need 'bg-roksal-navy text-white hover:bg-roksal-navy/90' "R232 cv-studio bbox aktivni žeton"
need 'ml-auto border-border bg-muted text-[9px] text-muted-foreground' "R232 cv-studio Analiza badge žeton"
need 'min-h-[36px] border-border text-[11px] text-muted-foreground hover:bg-muted' "R232 cv-studio Briši gumb žeton"
need "PROPOSED" "R232 cv-studio STATE_BADGE ključ (kontekst badge)"

echo "--- R232 negativni (cv-studio stone dvojčki izginili; portali ostanejo) ---"
must_miss 'bg-stone-600 text-white hover:bg-stone-700' "cv-studio bbox stone aktivni (unikatna oblika)"
must_miss 'min-h-[36px] border-stone-300 text-[11px] text-stone-600 hover:bg-stone-50' "cv-studio Briši stone (unikatna oblika)"
must_miss 'border-stone-300 bg-stone-100 text-stone-700' "cv-studio PREDLOG stone dvojček"

echo "--- Regresije (R228-R231) ---"
need '"Opombe","Pretekel rok"]' "R231 CSV glava stolpec ZADNJI (kompilirana oblika)"
need 'Izvozi vsa naročila (neodvisno od statusnega filtra) kot CSV za Excel' "R231 CSV gumb title"
need 'Zamujena dobava (' "R230 Domov kartica aria (delci)"
need 'izterjaj dobavo pri dobavitelju. Klik odpre Naročila.' "R230 Domov kartica opis"
need 'Pretekel rok' "R229 badge tekst (zaslon)"
need 'Izterjaj dobavo pri dobavitelju' "R229 zvonček meta dejanje"
need 'R228: orders mora biti seznam naročil' "R228 lib (kompilirana oblika)"
need '"Opozorila","Zamujena dobava"' "R228 vodja CSV vrstica (kompilirana oblika)"
need 'prices===0?"DA":"NE"' "R226 Zaloga CSV stolpec (kompilirana oblika)"
need '— brez vpisane nabavne cene' "R227 naročilnica oznaka"
need 'border-roksal-red/30 bg-roksal-red/10' "R229 badge zamujena družina"
need 'bg-muted text-roksal-ink' "R229 Inox chip žeton"
need 'from-muted' "R230 deal-pipeline NACRTOVANO head žeton"
need 'ring-muted-foreground/70' "R230 deal-pipeline NACRTOVANO over žeton"
need 'border-border sm:h-[340px]' "R231 map-measure zemljevid žeton"
need 'bg-muted text-muted-foreground border-border' "R231 measurements verdict žeton"

if [ "$FAIL" = "1" ]; then
  echo "R232 NEEDLEJI: NEUSPEH"; exit 1
fi
echo "R232 NEEDLEJI: VSI OK"
