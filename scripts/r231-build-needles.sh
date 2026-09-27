#!/bin/bash
# R231 — build needleji: Naročila CSV stolpec 'Pretekel rok' (ENA resnica z
# zaslonom) + CSV gumb a11y + stil (map-measure/measurements neutralne veje →
# žetoni) + negativni (konvertirani stone dvojčki izginili) + regresije.
# Lekcije r229/r230: scope SAMO .next/static + .next/server (standalone =
# kopije virov — lažno pozitivno; cache = ostanki); needle oblike
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

echo "--- R231 pozitivni (CSV stolpec + gumb + žetoni) ---"
need '"Opombe","Pretekel rok"]' "R231 CSV glava — stolpec ZADNJI (kompilirana oblika)"
need 'Izvozi naročila kot CSV' "R231 CSV gumb aria-label (a11y družina izvozov)"
need 'Izvozi vsa naročila (neodvisno od statusnega filtra) kot CSV za Excel' "R231 CSV gumb title"
need 'border-border sm:h-[340px]' "R231 map-measure zemljevid obroba žeton"
need 'break-all rounded-lg border border-border bg-muted p-3 text-xs text-roksal-ink' "R231 map-measure share polje žetoni (unikatna kombinacija)"
need 'bg-muted text-muted-foreground border-border' "R231 measurements neutralna veja verdicta žeton (družinski razred)"
need 'bg-muted text-muted-foreground' "R231 measurements n/a pill žeton"

echo "--- R231 negativni (konvertirani stone dvojčki izginili; semantične izjeme ostanejo) ---"
must_miss 'border-stone-200 sm:h-[340px]' "map-measure zemljevid stone obroba"
must_miss 'border-stone-200 bg-stone-50 p-3 text-xs text-stone-700' "map-measure share polje stone dvojček"
must_miss 'bg-stone-100 dark:bg-stone-500/15 text-stone-600 dark:text-stone-400' "measurements n/a pill stone dvojček"
must_miss "bg-stone-100 dark:bg-stone-500/15 text-stone-700 dark:text-stone-300 border-stone-300 dark:border-stone-800" "measurements verdict stone dvojček"

echo "--- Regresije (R219-R230) ---"
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
need 'bg-muted text-muted-foreground' "R229/R230 žetoni (OSNUTEK chip, punch)"
need 'from-muted' "R230 deal-pipeline NACRTOVANO head žeton"
need 'ring-muted-foreground/70' "R230 deal-pipeline NACRTOVANO over žeton"

if [ "$FAIL" = "1" ]; then
  echo "R231 NEEDLEJI: NEUSPEH"; exit 1
fi
echo "R231 NEEDLEJI: VSI OK"
