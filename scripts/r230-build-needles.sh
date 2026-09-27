#!/bin/bash
# R230 — build needleji: Domov kartica 'Zamujena dobava' (sorojenica vodje
# R228) + stil (punch-list/deal-pipeline/calculator/material žetoni) + regresije.
# Lekcija R229: scope SAMO .next/static + .next/server (standalone = kopije
# virov — lažno pozitivno; cache = ostanki — R226 l.3).
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

echo "--- R230 needleji (Domov zamujena + žetoni operativnega jedra) ---"
need "Zamujena dobava (" "R230 Domov kartica aria (kompilirana oblika — delci template literalja)"
need ") — odpre Material → Naročila" "R230 Domov kartica aria repilo (kompilirana oblika)"
need "Obljubljeni datum dobave je pretekel, naročilo pa še ni prejeto — klik odpre Naročila" "R230 Domov kartica title"
need "izterjaj dobavo pri dobavitelju. Klik odpre Naročila." "R230 Domov kartica opis"
need "Naročila s pretečenim obljubljenim datumom dobave" "R230 Domov kartica števec title (unikatna oblika — minifikacija preživi; simbolna imena se minificirajo — R229 lekcija)"
need "text-[11px] font-medium leading-snug text-roksal-ink" "R230 material advisory tekst žeton (kompilirana oblika)"
need "bg-muted text-muted-foreground border-border" "R230 punch-list Odprto chip žeton"
need "from-muted" "R230 deal-pipeline NACRTOVANO head žeton"
need "ring-muted-foreground/70" "R230 deal-pipeline NACRTOVANO over žeton"
need "border-border bg-muted/40" "R230 calculator betoniranje Card žeton (kompilirana oblika)"

echo "--- Negativni needleji (stone dvojčki KONVERTIRANIH komponent izbrisani;" 
echo "     namerne izjeme — measurements/map-measure/reference-gallery/cv-studio/portali — ostajajo) ---"
if grep -rqF -- "ring-stone-400/70" .next/static 2>/dev/null; then
  echo "MISS : deal-pipeline NACRTOVANO over stone ŠE VEDNO v static čankih"; FAIL=1
else
  echo "OK   : deal-pipeline NACRTOVANO stone over izginil (unikatna oblika)"
fi
if grep -rqF -- "border-stone-200 dark:border-stone-800 bg-white dark:bg-card p-2.5" .next/static 2>/dev/null; then
  echo "MISS : punch-list vrstica stone dvojček ŠE VEDNO v static čankih"; FAIL=1
else
  echo "OK   : punch-list vrstica stone dvojček izginil (unikatna oblika)"
fi
if grep -rqF -- "border-stone-300 dark:border-stone-800 bg-stone-50 dark:bg-stone-950/40" .next/static 2>/dev/null; then
  echo "MISS : calculator betoniranje stone dvojček ŠE VEDNO v static čankih"; FAIL=1
else
  echo "OK   : calculator betoniranje stone dvojček izginil (unikatna oblika)"
fi

echo "--- Regresije (R218-R229) ---"
need "R228: orders mora biti seznam naročil" "R228 lib (kompilirana oblika)"
need '"Opozorila","Zamujena dobava"' "R228 CSV vrstica (kompilirana oblika)"
need "Pretekel rok" "R229 badge tekst"
need "Izterjaj dobavo pri dobavitelju" "R229 zvonček meta dejanje"
need "je pretekel — naročilo še ni prejeto" "R229 zvonček podnaslov"
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
  echo "R230 NEEDLEJI: NEUSPEH"; exit 1
fi
echo "R230 NEEDLEJI: VSI OK"
