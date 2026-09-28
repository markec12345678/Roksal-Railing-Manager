#!/bin/bash
# R261 — build needleji: (17) RAČUNI PO PROJEKTIH PDF (vodja-dashboard —
# presek ponudbe (shranjen estimatedPrice) IN realizacije (računi) iz ISTIH
# virov kot vodjin pregled; route NIČ) + R260/R259/R258/R257/R256/R255/…/R227
# regresije (parent: r260-build-needles.sh viri).
set -u
cd /home/z/my-project
OUT=/tmp/r261-build-chunks
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

echo "--- R261 računi po projektih PDF (klient) ---"
need_static "Izvozi račune po projektih kot PDF" "R261 pill aria"
need_static "Računi po projektih kot pravi PDF — ponudba (vpisana ocena) vs realizacija (izdani + plačani računi) z odstopanjem" "R261 pill title"
need_static "RAČUNI PO PROJEKTIH" "R261 PDF glava"
need_static "Računi po projektih prenešeni v PDF" "R261 toast title"
need_static "Ni podatkov za račune po projektih" "R261 fail-closed toast"
need_static "PDF se izvozi, ko je vpisan prvi račun ali projektna ponudba." "R261 fail-closed toast opis"
need_static "Racuni-po-projektih-" "R261 filename prefix"
need_static "racuniProjektiPoProjektih" "R261 ENA izpeljava (KPI + tabela + sklep + mini-vrstica + toast)"
need_static "brez vpisane ponudbe" "R261 sklep + F2 žig resnica"
need_static "Ponudbe v izvedbi" "R261 F2 mini-vrstica"
need_static "izključeni iz realizacije" "R261 sklep resnica (stornirani/osnutki)"
need_static "brez projektnega zapisa" "R261 sklep resnica (brez zapisa)"
need_static "prazen presek ne nastaja dokumenta" "R261 fail-closed: prazen presek"
need_static "Odstopanje = realizirano − ponudba" "R261 legenda append"
echo "--- R260 dobavitelji CSV segmentacija (regresija) ---"
need_static "\"Najhitrejši rok\",\"Največji popust\"" "R260 CSV glava (minified)"
need_static "children:\"najhitrejši rok\"" "R260 žig najhitrejši rok (minified)"
need_static "children:\"največji popust\"" "R260 žig največji popust (minified)"
need_static "· CSV nosi segmentacijo (najhitrejši rok · največji popust)" "R260 legenda append"
need_static "dobaviteljiSegmentacija" "R260 ENA izpeljava segmentov"
echo "--- R259/R258 dobavitelji PDF + dobičkonost (regresija) ---"
need_static "Povprečni rok" "R259 KPI 4 label"
need_static "povprečni dobavni rok" "R259 sklep + toast agregat"
need_static "CSV = vrstica per dobavitelj · PDF = arhivski pregled z povprečnim in najhitrejšim dobavnim rokom" "R259 legenda"
need_static "Izvozi dobičkonosnost projektov kot PDF" "R258 pill aria"
need_static "DOBIČKONOST PO PROJEKTIH" "R258 PDF glava"
need_static "Dobičkonost prenešena v PDF" "R258 toast title"
need_static "Ni podatkov za dobičkonost" "R258 fail-closed toast"
need_static "Prihodki = izdani + plačani računi · Stroški = ne-preklicana naročila · Marža = prihodki − stroški · Marža (%) = marža / prihodki · Brez projekta = izključeni iz preseka" "R258 legenda (stara resnica dobesedno — substring-parna nadgradna)"
need_static "Dobicikonost-projektov-" "R258 filename prefix"
need_static "dobicikonostPoProjektih" "R258 ENA izpeljava"
echo "--- R257 naročila pregled PDF (regresija) ---"
need_static "Izvozi naročila kot PDF" "R257 pill aria"
need_static "NAROČILA — PREGLED" "R257 PDF glava"
need_static "Ni naročil za izvoz" "R257 fail-closed toast"
need_static "CSV = vrstica per postavka · PDF = vrstica per naročilo · Pretekel rok = pretekljena obljuba, status še odprt" "R257 legenda"
echo "--- R256/R255 vozni red + tedenski (regresija) ---"
need_static "Izvozi tedenski pregled montaž kot PDF" "R256 pill aria"
need_static "TEDENSKI VOZNI RED MONTAŽ" "R256 PDF glava"
need_static "Ni terminov v naslednjih 7 dneh" "R256 fail-closed toast"
need_static "Izvozi vozni red montaž kot PDF" "R255 pill aria"
need_static "VOZNI RED MONTAŽ" "R255 PDF glava"
need_static "Ni vidnih terminov montaže" "R255 fail-closed toast"
need_static "to-roksal-navy-soft" "R255 F2 gradient žeton (EXACT #2a3f5f)"
echo "--- R254/R253/R252/R250/R244/R227 regresije ---"
need_static "accent-roksal-amber" "R254 accent-roksal-amber žeton"
need_static "bg-roksal-bg" "R254 bg-roksal-bg žeton"
must_miss "accent-[#f59e0b]" "R254 must_miss accent-[#f59e0b]"
must_miss "bg-[#f7f9ff]" "R254 must_miss bg-[#f7f9ff]"
need_static "Izvozi koledar pregledov kot PDF" "R253 pill aria"
need_static "Ni vpisanih pregledov" "R253 fail-closed toast"
need_static "Izvozi potekle opomnike kot PDF" "R252 bulk pill aria"
need_static "Ni poteklih opomnikov" "R252 fail-closed toast"
need_static "Izvozi prihodke kot PDF" "R250 prihodki pill aria"
need_static "Ni računov za prihodke" "R250 fail-closed toast"
need_static "CENIK MATERIALA" "R244 PDF glava"
need_static "Brez dobavitelja (" "R227 žig aria"
must_miss "to-[#2a3f5f]" "must_miss to-[#2a3f5f]"

echo "NEEDLE FAIL=$FAIL"
exit $FAIL
