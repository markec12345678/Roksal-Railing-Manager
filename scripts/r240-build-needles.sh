#!/bin/bash
# R240 — build needleji: "Moja vloga in dovoljenja" (TopBar meni + dialog:
# fetch on open, fail-verbose, EN VIR katalog, chip iz status-options) +
# P1-g fence (testi na disku, v buildu samo klient) + negativni (team-tab
# ne definira chipa več) + regresije R223–R239.
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

echo "--- R240 pozitivni (Moja vloga in dovoljenja — klient) ---"
need_static "Moja vloga in dovoljenja" "R240 TopBar meni item + dialog naslov"
need_static "Imate " "R240 povzetek dovoljenj (začetek)"
need_static " dovoljenj" "R240 povzetek (končnica — JSX otrok)"
need_static "Poskusi znova" "R240 fail-verbose retry gumb"
need_static "Nalaganje vloge ni uspelo (HTTP " "R240 fail-verbose HTTP status v razlogu"
need_static "Kaj vaš račun sme v aplikaciji" "R240 dialog opis"
need_static "Vodstvena vloga — ustvarjanje projektov" "R240 vodstvena veja opomba"
echo "--- R240 en-vir (katalog dovoljenj v klientu — permissions-core) ---"
need_static "Branje projektov" "R240 katalog label 1 (projects.read)"
need_static "Upravljanje uporabnikov" "R240 katalog label 2 (users.manage)"
need_static "Storniranje računov" "R240 katalog label 3 (invoices.cancel)"
echo "--- R239 regresije (RBAC vrata + ogledalo) ---"
need "Za to dejanje je potrebna vloga " "R239 denyUnless 403 razlog (server bundle)"
need_static "Projekt pripravi vodstvo — ko je objavljen, se pojavi na tem seznamu." "R239 ne-vodstveni vodič"
need_static "Ustvari projekt z gumbom Nov projekt (zgoraj)." "R239 vodstvena veja vodiča"
need_static "Projekt ni bil ustvarjen: " "R239 fail-verbose 403 razlog v toastu"
need_static "Projekt se ustvari v zavihku Domov (gumb »Nov projekt« — viden vodstvu)." "R239 measurements vodič resnica"
must_miss_static "Projekt ustvariš v zavihku Domov (gumb »Nov projekt«)." "stara measurements resnica izginila"
echo "--- R238 regresije (prodajna plošča + P1-e žetoni) ---"
need_static "Izvozi prodajno ploščo kot CSV" "R238 gumb aria"
need_static "Ni projektov na plošči za izvoz" "R238 fail-closed toast"
need_static "plosca_" "R238 filename prefix"
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
