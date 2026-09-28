#!/bin/bash
# R234 — build needleji: Zaloga PDF izvoz (gumb + fail-closed toast + ENA
# resnica lib) + nevtralne veje žetoni (P1-f) + negativni + regresije
# R228–R233. Lekcije r229/r230: scope SAMO .next/static + .next/server;
# needle oblike KOMPIRIRANE (string literali preživijo minifikacijo);
# single quotes obvezni (backticki = command substitution).
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

echo "--- R234 pozitivni (Zaloga PDF) ---"
need 'Izvozi vidno zalogo kot PDF' "R234 PDF gumb aria-label"
need 'Izvozi vidno zalogo (upošteva filter) kot PDF poročilo' "R234 PDF gumb title"
need 'STANJE ZALOGE' "R234 PDF dokument naslov"
need 'Povzetek vidnih artiklov' "R234 PDF KPI sekcija"
need 'Brez dobavitelja' "R234 KPI/tabela stolpec"
need 'Izvoz PDF ni uspel:' "R234 fail-verbose catch toast"

echo "--- R234 pozitivni (stil — nevtralne veje žetoni; KOMPIRIRANE oblike — lekcija r229: navedki v čankih so dvojni, ne enojni) ---"
need 'NEAKTIVEN:"bg-muted text-muted-foreground border-border"' "R234 crm NEAKTIVEN žetoni (kompilirana oblika)"
need 'UPOKOJENO:"bg-muted text-muted-foreground border-border"' "R234 logistics UPOKOJENO žetoni (kompilirana oblika)"
need 'bg-muted text-muted-foreground border-border' "R234 material-intelligence neznana veja (class niz)"
need 'cls:"bg-muted text-muted-foreground"' "R234 catalog fallback žetoni (kompilirana oblika)"
need 'color:"bg-muted-foreground",textColor:"text-muted-foreground"' "R234 dashboard Načrtovano palica (kompilirana oblika)"
need 'bg-muted text-muted-foreground border-border line-through' "R234 measurements ARHIVIRANA žeton + line-through semantika"

echo "--- R234 negativni (gray unikati izginili; BARE class nizi — lekcija r229) ---"
must_miss "bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-800" "logistics UPOKOJENO gray (unikatna oblika)"
must_miss "bg-gray-50 dark:bg-gray-950/40 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-800" "material-intelligence neznana veja gray (unikatna oblika)"
must_miss "bg-gray-300 dark:bg-gray-500" "dashboard Načrtovano palica gray (unikatna oblika)"
must_miss "bg-gray-100 dark:bg-gray-500/15 text-gray-800 dark:text-gray-200" "catalog MATERIAL_BADGE fallback gray (unikatna oblika)"
must_miss "bg-gray-600 text-white border-gray-600" "measurements OSNUTEK čip aktiven gray (unikatna oblika)"
must_miss "bg-gray-400 text-white border-gray-400" "measurements ARHIVIRANA čip aktiven gray (unikatna oblika)"

echo "--- Regresije (R228-R233) ---"
need 'Izvozi dobavitelje kot CSV' "R233 Dobavitelji CSV gumb"
need 'Ni dobaviteljev za izvoz' "R233 fail-closed toast"
need 'Izvozi naročila kot CSV' "R231/R232 naročila CSV gumb"
need 'Ni naročil za izvoz' "R232 fail-closed toast (0 naročil)"
need '"Opombe","Pretekel rok"]' "R231 CSV glava stolpec ZADNJI"
need 'Zamujena dobava (' "R230 Domov kartica aria (delci)"
need 'Pretekel rok' "R229 badge tekst"
need '"Opozorila","Zamujena dobava"' "R228 vodja CSV vrstica"
need 'prices===0?"DA":"NE"' "R226 Zaloga CSV stolpec"
need '— brez vpisane nabavne cene' "R227 naročilnica oznaka"
need 'from-muted' "R230 deal-pipeline žeton"
need 'bg-roksal-navy text-white hover:bg-roksal-navy/90' "R232 cv-studio bbox aktivni žeton"
need 'bg-muted text-roksal-ink' "R229 Inox chip žeton"

if [ "$FAIL" = "1" ]; then
  echo "R234 NEEDLEJI: NEUSPEH"; exit 1
fi
echo "R234 NEEDLEJI: VSI OK"
