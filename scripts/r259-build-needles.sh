#!/bin/bash
# R259 — build needleji: DOBAVITELJI PDF NADGRADNA (KPI 5 škatel + ENA
# izpeljava dobaviteljiRokPovzetek + WYSIWYG najhitrejši + legenda F2 —
# parent: r258-build-needles.sh viri) + R258/…/R227 regresije.
# LEKCIJA R255: dispatch tabov pred zbiranjem; needleji morajo biti enolični.
set -u
cd /home/z/my-project
OUT=/tmp/r259-build-chunks
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

echo "--- R259 dobavitelji PDF nadgradna (klient) ---"
need_static "Povprečni rok" "R259 KPI 4 label"
need_static "Najhitrejši" "R259 KPI 5 label"
need_static "povprečni dobavni rok" "R259 sklep + toast agregat"
need_static "CSV = vrstica per dobavitelj · PDF = arhivski pregled z povprečnim in najhitrejšim dobavnim rokom" "R259 legenda F2"
need_static "Legenda izvoza dobaviteljev" "R259 legenda aria"
need_static "najhitrejši " "R259 WYSIWYG KPI vrednost (najhitrejši dni)"
need_static "dobaviteljiRokPovzetek" "R259 ENA izpeljava (minified ime ostane v exportu)"
need_static "Dobavitelji-…pdf — arhivski pregled kontaktnih in sodelovalnih podatkov, povprečni dobavni rok" "R259 toast description"
echo "--- R258 dobičkonost po projektih PDF (regresija) ---"
need_static "Izvozi dobičkonosnost projektov kot PDF" "R258 pill aria"
need_static "DOBIČKONOST PO PROJEKTIH" "R258 PDF glava"
need_static "Dobičkonost prenešena v PDF" "R258 toast title"
need_static "dobicikonostPoProjektih" "R258 ENA izpeljava"
echo "--- R257 naročila pregled PDF (regresija) ---"
need_static "Izvozi naročila kot PDF" "R257 pill aria"
need_static "NAROČILA — PREGLED" "R257 PDF glava"
need_static "Ni naročil za izvoz" "R257 fail-closed toast"
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
