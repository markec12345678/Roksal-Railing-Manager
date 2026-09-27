#!/bin/bash
# R229 — build needleji: ZAMUJENA tema nadaljevanje (zvonček vrstice +
# Naročila per-vrstična oznaka + BadgeZamujenaDobava ENA definicija) +
# stil (invoice-manager + roksal-catalog žetoni) + regresije.
# Lekcija R229: scope SAMO .next/static + .next/server (.next/standalone
# vsebuje KOPIJE virov — lažno pozitivno; .next/cache ostanki — R226 l.3).
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

echo "--- R229 needleji (zvonček zamujena + Naročila oznaka + žetoni) ---"
need "Pretekel rok" "R229 badge tekst (barva ni edini nosilec)"
need "Izterjaj dobavo pri dobavitelju" "R229 zvonček meta dejanje"
need "je pretekel — naročilo še ni prejeto" "R229 zvonček podnaslov (iskrena vrstica)"
need "Naročilo brez dobavitelja" "R229 fail-closed naslov (brez dobavitelja)"
need '("calendar-x",' "R229 CalendarX v zvončku (lucide registrska oblika)"
need "zamujena-" "R229 vrstica id prefix"
need "R228: orders mora biti seznam naročil" "R228 lib (regresija — kompilirana oblika)"
need '"Opozorila","Zamujena dobava"' "R228 CSV vrstica (regresija — kompilirana oblika)"

echo "--- Negativni needleji (stone/slate dvojčki izbrisani) ---"
if grep -rqF -- "bg-stone-200 dark:bg-stone-800" .next/static 2>/dev/null; then
  echo "MISS : invoice-manager cashflow stone dvojček ŠE VEDNO v static čankih"; FAIL=1
else
  echo "OK   : invoice-manager cashflow stone dvojček izginil"
fi
if grep -rqF -- "bg-slate-200 dark:bg-slate-500/15" .next/static 2>/dev/null; then
  echo "MISS : roksal-catalog Inox slate dvojček ŠE VEDNO v static čankih"; FAIL=1
else
  echo "OK   : roksal-catalog Inox slate dvojček izginil"
fi

echo "--- Regresije (R218-R228) ---"
need "a._count?.prices === 0" "R227 naročilnica dobesedna === 0"
need "— brez vpisane nabavne cene" "R227 naročilnica oznaka"
need "prices===0?\"DA\":\"NE\"" "R226 CSV dobesedna === 0 (kompilirana oblika)"
need "bg-muted-foreground" "R226 Zapadlo pika → žeton"
need "Brez dobavitelja — pokaži v Zalogi" "R221 paleta vrstica"
need "border-roksal-amber/30 bg-roksal-amber/10" "R225 badge na vrstici"
need "Brez dobavitelja (" "R224 vodja kartica aria (števec)"
need "Zamujena dobava — " "R228 vodja kartica naslov"
need "odpre Material → Naročila" "R228 kartica aria dejanje"
need "Obljubljeni datum dobave je pretekel, naročilo pa še ni prejeto" "R228 kartica title"
need "bg-muted text-muted-foreground" "R228 team-tab žetoni"
need "border-roksal-red/40 dark:border-roksal-red/50" "R228 team-tab zaklenjen (rdeča ostaja)"
need "Brez vpisane cene pri katerem koli dobavitelju" "R223 Domov opis"
need "Na minimumu — pokaži v Zalogi" "R220 paleta vrstica"
need "Pod minimumom" "R219 čip"

if [ "$FAIL" = "1" ]; then
  echo "R229 NEEDLEJI: NEUSPEH"; exit 1
fi
echo "R229 NEEDLEJI: VSI OK"
