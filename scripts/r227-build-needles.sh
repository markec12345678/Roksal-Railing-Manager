#!/bin/bash
# R227 — build needleji: DESETI signalec (naročilnica oznaka '— brez vpisane
# nabavne cene' + Osnutek dialog badge per vrstica + passthrough) + stil
# (geselne površine na žetonih) + regresije R219-R226.
set -u
cd /home/z/my-project
FAIL=0

need() { # $1 = needle, $2 = opis
  if grep -rqF -- "$1" .next 2>/dev/null; then
    echo "OK   : $2"
  else
    echo "MISS : $2  (needle: $1)"
    FAIL=1
  fi
}

echo "--- R227 needleji (deseti signalec + geselni žetoni) ---"
need "— brez vpisane nabavne cene" "R227 naročilnica oznaka per vrstica (lib)"
need "a._count?.prices === 0 && <BadgeBrezDobavitelja />" "R227 Osnutek dialog badge per vrstica"
need "typeof m.cenaVrstic === 'number'" "R227 osnutekIzIskanja passthrough (cenaVrstic → _count)"
need "border border-border px-3" "R227 geselni vnosi → žeton border (dialog+banner)"
need "'bg-muted'" "R227 jakostna vrstica prazni segmenti → žeton (en razred obe temi)"

echo "--- Regresije (R219-R226) ---"
need "item._count?.prices === 0 ? 'DA' : 'NE'" "R226 CSV dobesedna === 0 (DA/NE)"
need "bg-muted-foreground" "R226 Zapadlo pika → žeton"
need "Brez dobavitelja — pokaži v Zalogi" "R221 paleta vrstica"
need "border-roksal-amber/30 bg-roksal-amber/10" "R225 badge na vrstici (ISTI razredi kot paleta/zvonček)"
need "Brez dobavitelja (" "R224 vodja kartica aria (števec)"
need "odpre Zalogo s filtrom brez dobavitelja" "R224 vodja kartica aria dejanje"
need "Brez vpisane cene pri katerem koli dobavitelju" "R223 Domov opis"
need "Na minimumu — pokaži v Zalogi" "R220 paleta vrstica"
need "Pod minimumom" "R219 čip"
need "Preveri nabavne cene" "R221 paleta iskreno prazno"
need "Naročilnica kot osnutek naročila" "R218 osnutek"
need "Nizka zaloga materiala" "Domov rdeča kartica"
need "Vsi artikli so nad minimalno zalogo." "Domov zelena veja"
need "border-roksal-navy/20 bg-roksal-navy/5" "R225 odprta naročila → navy žeton"
need "border-roksal-green/20 bg-roksal-green/5" "R225 vse v redu → green žeton"
need "bg-roksal-navy/10 text-roksal-ink border-roksal-navy/25" "R225 žetoni terminov (navy)"

echo "--- Negativni needleji (geselne površine — vir brez stone, žetoni prisotni) ---"
# R227 obseg = password-dialog + password-change-banner. Ostali prostori
# (punch-list, measurements-tab, invoice-manager, calculator-tab) uporabljajo
# ISTE generične klase in so NAMERNO izven obsega (invoice-manager stone
# površino PINa r168) — zato je negativna preverba na VIRU geselnih datotek,
# ne na celem bundleju.
if grep -qF -- "stone-" src/components/roksal/password-dialog.tsx src/components/roksal/password-change-banner.tsx 2>/dev/null; then
  echo "MISS : geselne površine ŠE VEDNO vsebujejo stone klase ( morale bi biti žetoni)"
  FAIL=1
else
  echo "OK   : geselne površine brez stone klas (žetoni)"
fi
if ! grep -qF -- "border border-border px-3" src/components/roksal/password-dialog.tsx src/components/roksal/password-change-banner.tsx 2>/dev/null; then
  echo "MISS : geselni vnosi nimajo žetona border (regresija?)"
  FAIL=1
else
  echo "OK   : geselni vnosi na žetonu border"
fi

if [ "$FAIL" = "0" ]; then echo "R227 NEEDLEJI: VSI OK"; else echo "R227 NEEDLEJI: NAPAKA"; exit 1; fi
