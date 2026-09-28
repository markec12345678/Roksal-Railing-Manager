#!/bin/bash
# R262 — build needleji: (18) ZALOGA — OSNUTEK POKRITOST PDF (material-
# intelligence-tab orders subTab — presek zaloge IN OSNUTEK naročil iz ISTIH
# virov kot pregled; route NIČ) + R261/R260/R259/…/R227 regresije (parent:
# r261-build-needles.sh viri).
set -u
cd /home/z/my-project
OUT=/tmp/r262-build-chunks
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

echo "--- R262 zaloga-osnutek pokritost PDF (klient) ---"
need_static "Izvozi pokritost zaloge in osnutkov kot PDF" "R262 pill aria"
need_static "Pokritost kot pravi PDF — kaj osnutki že pokrivajo in kaj pod minimumom še manjka" "R262 pill title"
need_static "ZALOGA — OSNUTEK POKRITOST" "R262 PDF glava"
need_static "Pokritost prenešena v PDF" "R262 toast title"
need_static "Ni podatkov za pokritost" "R262 fail-closed toast"
need_static "PDF se izvozi, ko je vpisan prvi artikel ali osnutek naročila." "R262 fail-closed toast opis"
need_static "Zaloga-osnutek-pokritost-" "R262 filename prefix"
need_static "zalogaOsnutekPokritost" "R262 ENA izpeljava (KPI + tabela + sklep + mini-vrstica + toast)"
need_static "nad minimumom brez osnutka" "R262 sklep resnica (brez vrstice)"
need_static "postavk osnutkov brez artikla" "R262 sklep resnica (brez zapisa)"
need_static "prazen presek ne nastaja dokumenta" "R262 fail-closed: prazen presek"
need_static "Pokritost = zaloga × osnutki (OSNUTEK) po identiteti artikla" "R262 legenda append"
need_static "Pokritost osnutka:" "R262 F2 mini-vrstica"
need_static "nepokritih pod minimumom" "R262 F2 kondicionalni žig"
echo "--- R261 računi po projektih PDF (regresija — R261 ŽIVO na produ dokazan) ---"
need_static "Izvozi račune po projektih kot PDF" "R261 pill aria"
need_static "RAČUNI PO PROJEKTIH" "R261 PDF glava"
need_static "Računi po projektih prenešeni v PDF" "R261 toast title"
need_static "Ni podatkov za račune po projektih" "R261 fail-closed toast"
need_static "Racuni-po-projektih-" "R261 filename prefix"
need_static "racuniProjektiPoProjektih" "R261 ENA izpeljava"
need_static "Ponudbe v izvedbi" "R261 F2 mini-vrstica"
need_static "Odstopanje = realizirano − ponudba" "R261 legenda append"
echo "--- R260 dobavitelji CSV segmentacija (regresija) ---"
need_static "\"Najhitrejši rok\",\"Največji popust\"" "R260 CSV glava (minified)"
need_static "children:\"najhitrejši rok\"" "R260 žig najhitrejši rok (minified)"
need_static "children:\"največji popust\"" "R260 žig največji popust (minified)"
need_static "· CSV nosi segmentacijo (najhitrejši rok · največji popust)" "R260 legenda append"
echo "--- R259/R258/R257/R256/R255 regresije ---"
need_static "Povprečni rok" "R259 KPI 4 label"
need_static "povprečni dobavni rok" "R259 sklep + toast agregat"
need_static "Izvozi dobičkonosnost projektov kot PDF" "R258 pill aria"
need_static "DOBIČKONOST PO PROJEKTIH" "R258 PDF glava"
need_static "Prihodki = izdani + plačani računi · Stroški = ne-preklicana naročila · Marža = prihodki − stroški · Marža (%) = marža / prihodki · Brez projekta = izključeni iz preseka" "R258 legenda (stara resnica dobesedno)"
need_static "Izvozi naročila kot PDF" "R257 pill aria"
need_static "NAROČILA — PREGLED" "R257 PDF glava"
need_static "CSV = vrstica per postavka · PDF = vrstica per naročilo · Pretekel rok = pretekljena obljuba, status še odprt" "R257 legenda (stara resnica dobesedno — substring-parna nadgradna)"
need_static "Izvozi tedenski pregled montaž kot PDF" "R256 pill aria"
need_static "TEDENSKI VOZNI RED MONTAŽ" "R256 PDF glava"
need_static "Izvozi vozni red montaž kot PDF" "R255 pill aria"
need_static "VOZNI RED MONTAŽ" "R255 PDF glava"
need_static "to-roksal-navy-soft" "R255 F2 gradient žeton (EXACT #2a3f5f)"
echo "--- R254/R253/R252/R250/R244/R227 regresije ---"
need_static "accent-roksal-amber" "R254 accent-roksal-amber žeton"
need_static "bg-roksal-bg" "R254 bg-roksal-bg žeton"
must_miss "accent-[#f59e0b]" "R254 must_miss accent-[#f59e0b]"
must_miss "bg-[#f7f9ff]" "R254 must_miss bg-[#f7f9ff]"
need_static "Izvozi koledar pregledov kot PDF" "R253 pill aria"
need_static "Izvozi potekle opomnike kot PDF" "R252 bulk pill aria"
need_static "Izvozi prihodke kot PDF" "R250 pill aria"
need_static "CENIK MATERIALA" "R244 PDF glava"
need_static "Brez dobavitelja (" "R227 žig aria"
must_miss "to-[#2a3f5f]" "must_miss to-[#2a3f5f]"

echo "NEEDLE FAIL=$FAIL"
exit $FAIL
