#!/bin/bash
# R242 — build needleji: RBAC ogledalo Naročil (vlogo-osveščen vodič +
# procurement imena v klientu) + press-scale pariteta + negativni (0 hex v
# material tabu = strukturni test) + regresije R223–R241.
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

echo "--- R242 pozitivni (RBAC ogledalo Naročil — klient) ---"
need_static "Pregled naročil je samo za branje" "R242 vlogo-osveščen vodič (samoBranjeNarocil)"
need_static "procurement.approve" "R242 vodič/API matrika ime pravice 1 v klientu"
need_static "procurement.receive" "R242 vodič/API matrika ime pravice 2 v klientu"
need_static "Naročila so za branje — upravljanje zahteva pravice" "R242 vodič aria-label (role=note)"
need "Sprememba naročil je pravica vodstva" "R242 API 403 razlog (server bundle, fail-verbose vir)"
need "Skladišče lahko naročilo samo prejme" "R242 API 403 razlog 2 (server bundle)"
echo "--- R242 stil (press-scale pariteta) ---"
need_static "w-full bg-roksal-navy text-white shadow-sm press-scale" "R242 Nov dobavitelj CTA mikro-pritisk"
need_static "h-8 text-xs press-scale" "R242 izvozne pilule mikro-pritisk (naročila+dobavitelji)"
need_static "h-6 gap-1 text-2xs press-scale" "R242 dobavitelji PDF pilula mikro-pritisk"
echo "--- R241 regresije (RBAC ogledalo Računov) ---"
need_static "Pregled računov je samo za branje" "R241 vlogo-osveščen vodič (samoBranje)"
need_static "invoices.create / invoices.issue / invoices.cancel" "R241 vodič navaja TOČNO imena pravic iz API vrat"
echo "--- R240 regresije (Moja vloga in dovoljenja) ---"
need_static "Moja vloga in dovoljenja" "R240 TopBar meni item + dialog naslov"
need_static "Poskusi znova" "R240 fail-verbose retry gumb"
need_static "Kaj vaš račun sme v aplikaciji" "R240 dialog opis"
need_static "Branje projektov" "R240 katalog label (projects.read) v klientu"
echo "--- R239/R238 regresije ---"
need "Za to dejanje je potrebna vloga " "R239 denyUnless 403 razlog (server bundle)"
need_static "Projekt ni bil ustvarjen: " "R239 fail-verbose 403 razlog v toastu"
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
