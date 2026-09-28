#!/bin/bash
# R241 — build needleji: RBAC UI ogledalo na Računi (vlogo-osveščen vodič +
# permission-imeni pariteta v klientu) + negativni (arbitrary tekst ostane
# migriran) + regresije R223–R240.
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

need_static() {
  if grep -rqF -- "$1" .next/static 2>/dev/null; then
    echo "OK   : $2"
  else
    echo "MISS : $2  (needle: $1)"
    FAIL=1
  fi
}

must_miss_static() {
  if grep -rqF -- "$1" .next/static 2>/dev/null; then
    echo "STAL : $2 ŠE VEDNO v static čankih (needle: $1)"; FAIL=1
  else
    echo "OK   : $2 (izginil — pravilno)"
  fi
}

echo "--- R241 pozitivni (RBAC ogledalo Računov — klient) ---"
need_static "Pregled računov je samo za branje" "R241 vlogo-osveščen vodič (samoBranje)"
need_static "invoices.create / invoices.issue / invoices.cancel" "R241 vodič navaja TOČNO imena pravic iz API vrat"
need_static "izvaja vodstvo." "R241 vodič končnica (nevtralna resnica)"
echo "--- R240 regresije (Moja vloga in dovoljenja) ---"
need_static "Moja vloga in dovoljenja" "R240 TopBar meni item + dialog naslov"
need_static "Poskusi znova" "R240 fail-verbose retry gumb"
need_static "Kaj vaš račun sme v aplikaciji" "R240 dialog opis"
need_static "Branje projektov" "R240 katalog label (projects.read) v klientu"
need_static "Storniranje računov" "R240 katalog label (invoices.cancel) v klientu"
echo "--- R239 regresije (RBAC vrata + ogledalo projektov) ---"
need "Za to dejanje je potrebna vloga " "R239 denyUnless 403 razlog (server bundle)"
need_static "Projekt ni bil ustvarjen: " "R239 fail-verbose 403 razlog v toastu"
need_static "Projekt se ustvari v zavihku Domov (gumb »Nov projekt« — viden vodstvu)." "R239 measurements vodič resnica"
echo "--- R238 regresije (prodajna plošča + P1-e žetoni) ---"
need_static "Izvozi prodajno ploščo kot CSV" "R238 gumb aria"
need_static "Ni projektov na plošči za izvoz" "R238 fail-closed toast"
need_static "text-2xs" "P1-e žeton 2xs"
need_static "text-3xs" "P1-e žeton 3xs"
must_miss_static "text-[10px]" "arbitrary 10px ostane migriran"
must_miss_static "text-[8px]" "arbitrary 8px ostane migriran"
echo "--- Regresije R223–R237 (izvozi družina + geselni žetoni + domov) ---"
need_static "Prenesi naročilnico vidnih artiklov kot PDF" "R237 Osnutek PDF pill"
need_static "osnutek-narocilnica-" "R237 filename prefix"
need_static "Izvozi dobavitelje kot PDF" "R236 Dobavitelji PDF"
need_static "Prenesi naročilnico naročila pri " "R235 Naročilnica pill"
need_static "Izvozi vidno zalogo kot PDF" "R234 Zaloga PDF"
need_static "Ni artiklov za izvoz." "R234 fail-closed toast"
need_static "Ni dobaviteljev za izvoz" "R233 fail-closed toast"
need_static "Brez dobavitelja (" "R227 žig aria"
echo "NEEDLE FAIL=$FAIL"
exit $FAIL
