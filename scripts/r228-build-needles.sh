#!/bin/bash
# R228 — build needleji: nova tema 'Zamujena dobava' (lib + vodja kartica +
# CSV + PDF + iskreno vse-v-redu) + stil (team-tab žetoni) + regresije.
set -u
cd /home/z/my-project
FAIL=0

need() { # $1 = needle, $2 = opis — R229 lekcija: SAMO odposlani čanki
  # (.next/static + .next/server); .next/standalone vsebuje KOPIJE virov
  # (E2E setup), .next/cache ostanke prejšnjih gradnj — oboje da LAŽNO
  # pozitivne needleje (R229 ujela: dve r228 needleji sta hitili standalone
  # src kopije, ne kompiliranega rezultata).
  if grep -rqF -- "$1" .next/static .next/server 2>/dev/null; then
    echo "OK   : $2"
  else
    echo "MISS : $2  (needle: $1)"
    FAIL=1
  fi
}

echo "--- R228 needleji (nova tema: zamujena dobava + team-tab žetoni) ---"
need "Zamujena dobava — " "R228 vodja kartica naslov"
need "odpre Material → Naročila" "R228 kartica aria dejanje"
need "Obljubljeni datum dobave je pretekel, naročilo pa še ni prejeto" "R228 kartica title"
need "(\"calendar-x\"," "R228 CalendarX ikona (lucide registrska oblika — pripona 'lucide-' se doklepa med izvajanjem)"
# R229 popavek: simbolno ime steviloZamujenihDobav se v kompiliranih
# čankih minificira (prejšnja oblika je lažno pozitivno hitila standalone
# src kopijo) — zanesljiva R228-specifična oblika je TypeError sporočilo
# iz liba (preživi minifikacijo). CSV vrstica: minificirana oblika brez
# presledkov, dvojni navedki (kompiliran JS, ne vira).
need "R228: orders mora biti seznam naročil" "R228 lib števec (kompilirana oblika)"
need '"Opozorila","Zamujena dobava"' "R228 CSV vrstica (kompilirana oblika, IZVOŽENO = ZASLON)"
need "z pretečenim rokom dobave — izterjaj dobavo pri dobavitelju" "R228 PDF opozorila vrstica"
need "bg-muted text-muted-foreground" "R228 team-tab žetoni (avatar + chip)"

echo "--- Negativni needleji (odposlani čanki brez stone v team-tab) ---"
if grep -rqlF -- "border-stone-200 dark:border-stone-700" .next/static .next/server/charts .next/server/app 2>/dev/null; then
  # iskanje samo po odposlanih čankih — .next/cache vsebuje ostanke (R226 lekcija 3)
  if grep -rqlF -- "border-stone-200 dark:border-stone-700" .next/static 2>/dev/null; then
    echo "MISS : team-tab stone dvojček ŠE VEDNO v static čankih"
    FAIL=1
  else
    echo "OK   : team-tab stone dvojček izginil iz static čankov"
  fi
else
  echo "OK   : team-tab stone dvojček izginil (static/server čanki)"
fi

echo "--- Regresije (R219-R227) ---"
need "a._count?.prices === 0" "R227 naročilnica dobesedna === 0"
need "— brez vpisane nabavne cene" "R227 naročilnica oznaka"
need "prices===0?\"DA\":\"NE\"" "R226 CSV dobesedna === 0 (DA/NE, kompilirana oblika)"
need "bg-muted-foreground" "R226 Zapadlo pika → žeton"
need "Brez dobavitelja — pokaži v Zalogi" "R221 paleta vrstica"
need "border-roksal-amber/30 bg-roksal-amber/10" "R225 badge na vrstici"
need "Brez dobavitelja (" "R224 vodja kartica aria (števec)"
need "Brez vpisane cene pri katerem koli dobavitelju" "R223 Domov opis"
need "Na minimumu — pokaži v Zalogi" "R220 paleta vrstica"
need "Pod minimumom" "R219 čip"
need "Naročilnica kot osnutek naročila" "R218 osnutek"
need "Nizka zaloga materiala" "Domov rdeča kartica"
need "Vsi artikli so nad minimalno zalogo." "Domov zelena veja"
need "border-roksal-navy/20 bg-roksal-navy/5" "R225 odprta naročila → navy žeton"
need "border-roksal-green/20 bg-roksal-green/5" "R225 vse v redu → green žeton"
need "border border-border px-3" "R227 geselni vnosi → žeton border"

if [ "$FAIL" = "0" ]; then echo "R228 NEEDLEJI: VSI OK"; else echo "R228 NEEDLEJI: NEUSPEH"; exit 1; fi
