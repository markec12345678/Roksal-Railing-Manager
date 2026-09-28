#!/bin/bash
# R260 — build needleji: DOBAVITELJI CSV SEGMENTACIJA (16. člen 'izvozi'
# družine — stolpca 10/11 DA/NE + toast agregat + zaslonski žigi + legenda
# append — parent: r259-build-needles.sh viri) + R259/…/R227 regresije.
# LEKCIJA R255: dispatch tabov pred zbiranjem; needleji morajo biti enolični.
set -u
cd /home/z/my-project
OUT=/tmp/r260-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

find .next/static/chunks -name '*.js' -type f | while read -r f; do
  cp "$f" "$OUT/$(echo "$f" | md5sum | cut -c1-12)-$(basename "$f")"
done
echo "  čankov: $(ls "$OUT"/*.js 2>/dev/null | wc -l)"

FAIL=0
need_static() {
  if grep -rqF -- "$1" "$OUT" 2>/dev/null; then echo "OK   : $2"; else echo "MISS : $2  (needle: $1)"; FAIL=1; fi
}
must_miss() {
  if grep -rqF -- "$1" "$OUT" 2>/dev/null; then echo "HIT  : $2  (needle: $1 — NE SME BITI!)"; FAIL=1; else echo "OK   : $2 (odsoten)"; fi
}

echo "--- R260 dobavitelji CSV segmentacija (klient) ---"
need_static '"Najhitrejši rok","Največji popust"' "R260 CSV glava 10/11 (minifier dvojni navedki — R256 lekcija)"
need_static "Dobavitelji-…csv — najhitrejši rok" "R260 toast agregat opis"
need_static "CSV prenesen — " "R260 toast title (sklanjatev)"
need_static "dobaviteljiSegmentacija" "R260 ENA izpeljava (minified ime ostane v exportu)"
need_static 'children:"najhitrejši rok"' "R260 žig zaslon (najhitrejši — minified children)"
need_static 'children:"največji popust"' "R260 žig zaslon (največji popust — minified children)"
need_static "· CSV nosi segmentacijo (najhitrejši rok · največji popust)" "R260 legenda append"
need_static "CSV nosi segmentacijo" "R260 legenda (kratek rez)"
echo "--- R259 dobavitelji PDF nadgradna (regresija) ---"
need_static "Povprečni rok" "R259 KPI 4 label"
need_static "povprečni dobavni rok" "R259 sklep + toast agregat"
need_static "CSV = vrstica per dobavitelj · PDF = arhivski pregled z povprečnim in najhitrejšim dobavnim rokom" "R259 legenda (stara resnica dobesedno)"
need_static "dobaviteljiRokPovzetek" "R259 ENA izpeljava"
echo "--- R258 dobičkonost po projektih PDF (regresija) ---"
need_static "Izvozi dobičkonosnost projektov kot PDF" "R258 pill aria"
need_static "DOBIČKONOST PO PROJEKTIH" "R258 PDF glava"
need_static "dobicikonostPoProjektih" "R258 ENA izpeljava"
echo "--- R257 naročila pregled PDF (regresija) ---"
need_static "Izvozi naročila kot PDF" "R257 pill aria"
need_static "NAROČILA — PREGLED" "R257 PDF glava"
echo "--- R256 tedenski vozni red PDF (regresija) ---"
need_static "Izvozi tedenski pregled montaž kot PDF" "R256 pill aria"
need_static "TEDENSKI VOZNI RED MONTAŽ" "R256 PDF glava"
need_static "to-roksal-navy-soft" "R255 F2 gradient žeton (EXACT #2a3f5f)"
echo "--- R253/R252/R250/R244/R240 regresije ---"
need_static "Izvozi koledar pregledov kot PDF" "R253 pill aria"
need_static "Izvozi potekle opomnike kot PDF" "R252 bulk pill aria"
need_static "Izvozi prihodke kot PDF" "R250 pill aria"
need_static "CENIK MATERIALA" "R244 PDF glava"
need_static "Moja vloga in dovoljenja" "R240 meni + dialog"
echo "--- R227 + must_miss ---"
need_static "Brez dobavitelja (" "R227 žig aria"
must_miss "to-[#2a3f5f]" "must_miss to-[#2a3f5f]"
must_miss "accent-[#f59e0b]" "must_miss accent-[#f59e0b]"
must_miss "bg-[#f7f9ff]" "must_miss bg-[#f7f9ff]"
echo "NEEDLE FAIL=$FAIL"
exit $FAIL
