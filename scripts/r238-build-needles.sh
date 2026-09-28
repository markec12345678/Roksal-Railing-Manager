#!/bin/bash
# R238 — build needleji: PRODAJNA PLOŠČA CSV (zaključek 'izvozi' družine
# P1-c — lib plosca-csv + gumb + fail-closed + fail-verbose) + P1-e mikro
# tipografija (žetona 2xs/3xs v @theme + migrirani razredi) + negativni
# (0 ostankov arbitrary text-[10px]/text-[8px]) + regresije R227–R237.
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
    echo "MISS : $2 ŠE VEDNO v static čankih (needle: $1)"; FAIL=1
  else
    echo "OK   : $2 (izginil — pravilno)"
  fi
}

echo "--- R238 pozitivni (prodajna plošča CSV — gumb/handler) ---"
need "Izvozi prodajno ploščo kot CSV" "R238 gumb aria"
need "Izvozi vidne projekte z vrednostjo, spomnikom in podpisom kot CSV za Excel" "R238 gumb title"
need "Ni projektov na plošči za izvoz" "R238 fail-closed toast"
need "CSV se izvozi, ko je na plošči prvi projekt." "R238 fail-closed toast opis"
need "Izvožena prodajna plošča" "R238 uspeh toast"
need "Izvoz ni uspel" "R238 fail-verbose toast naslov"
echo "--- R238 pozitivni (lib plosca-csv — dokument/dialekt) ---"
need "buildPloscaCsv" "R238 lib funkcija"
need "ploscaCsvFilename" "R238 filename funkcija"
need "plosca_" "R238 filename prefix (ločen od projekti_)"
need "Vrednost (€)" "R238 glava finančni stolpec"
need "Neznan status projekta" "R238 fail-closed status (kompilirana oblika — statusi besedila)"
echo "--- R238 pozitivni (P1-e mikro tipografija) ---"
need "text-2xs" "R238 žeton 2xs v uporabi (migrirani razredi)"
need "text-3xs" "R238 žeton 3xs v uporabi (migrirani razredi)"
echo "--- R238 negativni (arbitrary mikro velikosti izginili) ---"
must_miss "text-[10px]" "arbitrary 10px razred v JS čankih (migriran na text-2xs)"
must_miss "text-[8px]" "arbitrary 8px razred v JS čankih (migriran na text-3xs)"
must_miss 'text-\[10px\]' "ESCAPIRANA CSS oblika 10px (r238 lekcija: literal grep ne vidi escape — utility iz testnih pinov odstranjen z @source not)"
must_miss 'text-\[8px\]' "ESCAPIRANA CSS oblika 8px"
echo "--- regresije R227-R237 ---"
need "Prenesi naročilnico vidnih artiklov kot PDF" "R237 dialog PDF gumb aria"
need "NAROČILNICA OSNUTEK" "R237 PDF dokument naslov"
need "osnutek-narocilnica-" "R237 filename prefix"
need "Izvozi dobavitelje kot PDF" "R236 Dobavitelji PDF pill aria"
need "Dobavitelji PDF ni mogoče sestaviti iz tega seznama" "R236 fail-closed toast"
need "Izvozi vidno zalogo kot PDF" "R234 Zaloga PDF gumb aria"
need "Izvozi dobavitelje kot CSV" "R233 Dobavitelji CSV gumb"
need "Ni dobaviteljev za izvoz" "R233 fail-closed toast"
need "Izvozi naročila kot CSV" "R231/R232 naročila CSV gumb"
need "Ni naročil za izvoz" "R232 fail-closed toast"
need "focus-visible:ring-2 focus-visible:ring-roksal-navy/40" "R236/R237 navy/40 fokus družina (+ nov R238 gumb)"
need "Zamujena dobava (" "R230 Domov kartica aria (delci)"
need "— brez vpisane nabavne cene" "R227 naročilnica oznaka"
need "bg-muted text-muted-foreground border-border line-through" "R234 measurements ARHIVIRANA žeton"

echo "NEEDLE FAIL=$FAIL"
exit "$FAIL"
