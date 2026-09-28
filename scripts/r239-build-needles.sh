#!/bin/bash
# R239 — build needleji: RBAC vrata na POST /api/projects (P1-a: denyUnless
# MANAGER_ROLES — server bundle) + UI ogledalo (vlogo-osveščen gumb/dialog/
# vodič) + fail-verbose 403 razlog + P1-e zaklep (vlogo-nevtralna resnica v
# measurements) + negativni (stara 'ustvariš' resnica izginila) + regresije
# R223–R238.
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

echo "--- R239 pozitivni (RBAC vrata — server bundle) ---"
need "Za to dejanje je potrebna vloga " "R239 denyUnless 403 razlog (auth.ts kompilirano)"
need "API ključ nima dostopa do te poti" "R239 API-ključ vrata (denyUnless del)"
echo "--- R239 pozitivni (UI ogledalo — dashboard) ---"
need_static "Projekt pripravi vodstvo — ko je objavljen, se pojavi na tem seznamu." "R239 iskren ne-vodstveni vodič korak"
need_static "Ustvari projekt z gumbom Nov projekt (zgoraj)." "R239 vodstvena veja vodiča (ostaja)"
need_static "Projekt ni bil ustvarjen: " "R239 fail-verbose 403 razlog v toastu"
need_static "Napaka pri ustvarjanju projekta" "R239 splošna napaka (regresija ostaja)"
echo "--- R239 pozitivni (vlogo-nevtralna resnica — measurements) ---"
need_static "Projekt se ustvari v zavihku Domov (gumb »Nov projekt« — viden vodstvu)." "R239 measurements vodič resnica"
echo "--- R239 negativni ---"
must_miss_static "Projekt ustvariš v zavihku Domov (gumb »Nov projekt«)." "stara measurements resnica izginila (R201/R202 pini posodobljeni)"
echo "--- R238 regresije (prodajna plošča + P1-e žetoni) ---"
need_static "Izvozi prodajno ploščo kot CSV" "R238 gumb aria"
need_static "Ni projektov na plošči za izvoz" "R238 fail-closed toast"
need_static "plosca_" "R238 filename prefix"
need_static "text-2xs" "P1-e žeton 2xs v čankih"
need_static "text-3xs" "P1-e žeton 3xs v čankih"
must_miss_static "text-[10px]" "arbitrary 10px ostane migriran (R238)"
must_miss_static "text-[8px]" "arbitrary 8px ostane migriran (R238)"
echo "--- Regresije R223–R237 (izvozi družina + geselni žetoni + domov) ---"
need_static "Prenesi naročilnico vidnih artiklov kot PDF" "R237 Osnutek PDF pill"
need_static "Naročilnica osnutka kot pravi PDF" "R237 PDF pill title"
need_static "osnutek-narocilnica-" "R237 filename prefix"
need_static "Izvozi dobavitelje kot PDF" "R236 Dobavitelji PDF"
need_static "dobavitelji-" "R236 filename prefix"
need_static "Prenesi naročilnico naročila pri " "R235 Naročilnica pill"
need_static "narocilnica-" "R235 filename prefix"
need_static "Izvozi vidno zalogo kot PDF" "R234 Zaloga PDF"
need_static "Ni artiklov za izvoz." "R234 fail-closed toast"
need_static "Ni dobaviteljev za izvoz" "R233 fail-closed toast"
need_static "Brez dobavitelja (" "R227 žig aria"
echo "NEEDLE FAIL=$FAIL"
exit $FAIL
