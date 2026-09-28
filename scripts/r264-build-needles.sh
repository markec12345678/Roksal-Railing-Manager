#!/bin/bash
# R264 — build needleji: (20) DOBAVITELJI — POZICIJA CEN PDF (material-
# intelligence-tab suppliers subtab — presek prices × bestPerMaterial iz
# ISTEGA /api/material-prices odgovora; route NIČ) + R263/R262/R261/…/R227
# regresije (parent: r263-build-needles.sh viri).
set -u
cd /home/z/my-project
OUT=/tmp/r264-build-chunks
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

echo "--- R264 dobavitelji-pozicija PDF (klient) ---"
need_static "Izvozi pozicijo dobaviteljev kot PDF" "R264 pill aria"
need_static "Pozicija dobaviteljev kot pravi PDF — kdo je najcenejši in kje je prostor za pogajanja" "R264 pill title"
need_static "DOBAVITELJI — POZICIJA CEN" "R264 PDF glava"
need_static "Pozicija dobaviteljev prenešena v PDF" "R264 toast title"
need_static "Ni vpisanih cen" "R264 fail-closed toast"
need_static "Pozicija dobaviteljev se izvozi, ko je vpisana prva nabavna cena." "R264 fail-closed toast opis"
need_static "Pozicija-dobaviteljev-" "R264 filename prefix"
need_static "dobaviteljiPozicijaCen" "R264 ENA izpeljava (KPI + tabela + sklep + toast)"
need_static "ponudbaBeseda" "R264 sklanjatev EN VIR"
need_static "brez alternative" "R264 sklep resnica (cenitveno tveganje)"
need_static "samo ena ponudba — ni primerjave" "R264 sklep resnica (izključitev)"
need_static "bestPrice je MIN po konstrukciji" "R264 fail-closed: min-invarianta"
need_static "razlika % ne obstaja" "R264 fail-closed: bestPrice 0 (NIKOLI Infinity)"
need_static "prazen seznam cen ne nastaja dokumenta" "R264 fail-closed: prazen seznam"
need_static "· Pozicija = dobavitelji × najnižja per artikel · Brez alternative = samo ena ponudba" "R264 legenda append"
echo "--- R263 stranke-pokritost PDF (regresija — R263 ŽIVO na produ dokazan) ---"
need_static "Izvozi pokritost opomnikov kot PDF" "R263 pill aria"
need_static "STRANKE — OPOMNIŠKA POKRITOST" "R263 PDF glava"
need_static "Pokritost opomnikov prenešena v PDF" "R263 toast title"
need_static "Ni strank v CRM" "R263 fail-closed toast 1"
need_static "Vse stranke imajo vpisan opomnik" "R263 fail-closed toast 2"
need_static "Stranke-opomniska-pokritost-" "R263 filename prefix"
need_static "strankeOpomnikiPokritost" "R263 ENA izpeljava"
need_static "arhiviranih brez opomnika" "R263 sklep resnica"
need_static "Pokritost opomnikov:" "R263 F2 mini-vrstica"
need_static "Pokritost = stranke × opomnikStatus (slepe pike = brez datuma)" "R263 legenda append"
echo "--- R262 zaloga-osnutek pokritost PDF (regresija) ---"
need_static "Izvozi pokritost zaloge in osnutkov kot PDF" "R262 pill aria"
need_static "ZALOGA — OSNUTEK POKRITOST" "R262 PDF glava"
need_static "Zaloga-osnutek-pokritost-" "R262 filename prefix"
need_static "zalogaOsnutekPokritost" "R262 ENA izpeljava"
need_static "nad minimumom brez osnutka" "R262 sklep resnica"
need_static "Pokritost osnutka:" "R262 F2 mini-vrstica"
echo "--- R261/R260/R259/R258/R257/R256/R255 regresije ---"
need_static "Izvozi račune po projektih kot PDF" "R261 pill aria"
need_static "RAČUNI PO PROJEKTIH" "R261 PDF glava"
need_static "Ponudbe v izvedbi" "R261 F2 mini-vrstica"
need_static "racuniProjektiPoProjektih" "R261 ENA izpeljava"
need_static "\"Najhitrejši rok\",\"Največji popust\"" "R260 CSV glava (minified)"
need_static "children:\"najhitrejši rok\"" "R260 žig najhitrejši rok (minified)"
need_static "children:\"največji popust\"" "R260 žig največji popust (minified)"
need_static "· CSV nosi segmentacijo (najhitrejši rok · največji popust)" "R260 legenda append"
need_static "Povprečni rok" "R259 KPI 4 label"
need_static "Izvozi dobičkonosnost projektov kot PDF" "R258 pill aria"
need_static "DOBIČKONOST PO PROJEKTIH" "R258 PDF glava"
need_static "Izvozi naročila kot PDF" "R257 pill aria"
need_static "NAROČILA — PREGLED" "R257 PDF glava"
need_static "Izvozi tedenski pregled montaž kot PDF" "R256 pill aria"
need_static "TEDENSKI VOZNI RED MONTAŽ" "R256 PDF glava"
need_static "Izvozi vozni red montaž kot PDF" "R255 pill aria"
need_static "VOZNI RED MONTAŽ" "R255 PDF glava"
need_static "to-roksal-navy-soft" "R255 F2 gradient žeton"
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
