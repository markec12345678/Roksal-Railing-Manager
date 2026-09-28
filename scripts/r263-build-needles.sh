#!/bin/bash
# R263 — build needleji: (19) STRANKE — OPOMNIŠKA POKRITOST PDF (crm-tab —
# presek strank × opomniški status iz ISTEGA /api/crm odgovora; route NIČ) +
# R262/R261/R260/R259/…/R227 regresije (parent: r262-build-needles.sh viri).
set -u
cd /home/z/my-project
OUT=/tmp/r263-build-chunks
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

echo "--- R263 stranke-pokritost PDF (klient) ---"
need_static "Izvozi pokritost opomnikov kot PDF" "R263 pill aria"
need_static "Pokritost opomnikov kot PDF (slepe pike — najvrednejše prve)" "R263 pill title"
need_static "STRANKE — OPOMNIŠKA POKRITOST" "R263 PDF glava"
need_static "Pokritost opomnikov prenešena v PDF" "R263 toast title"
need_static "Ni strank v CRM" "R263 fail-closed toast 1"
need_static "PDF se izvozi, ko je dodana prva stranka." "R263 fail-closed toast 1 opis"
need_static "Vse stranke imajo vpisan opomnik" "R263 fail-closed toast 2"
need_static "PDF se izvozi, ko ostane kaka stranka brez vpisanega pregleda." "R263 fail-closed toast 2 opis"
need_static "Stranke-opomniska-pokritost-" "R263 filename prefix"
need_static "strankeOpomnikiPokritost" "R263 ENA izpeljava (KPI + tabela + sklep + mini-vrstica + toast)"
need_static "arhiviranih brez opomnika" "R263 sklep resnica (iskren odpad)"
need_static "brez vrstice — zaprt primer" "R263 sklep resnica (izključitev)"
need_static "akcijski red: najvrednejše prve" "R263 sklep resnica (sort)"
need_static "prazen seznam strank ne nastaja dokumenta" "R263 fail-closed: prazen seznam"
need_static "brez slepih pik ne nastaja dokumenta" "R263 fail-closed: 0 slepih pik"
need_static "· Pokritost = stranke × opomnikStatus (slepe pike = brez datuma)" "R263 legenda append"
need_static "Pokritost opomnikov:" "R263 F2 mini-vrstica"
echo "--- R262 zaloga-osnutek pokritost PDF (regresija — R262 ŽIVO na produ dokazan) ---"
need_static "Izvozi pokritost zaloge in osnutkov kot PDF" "R262 pill aria"
need_static "ZALOGA — OSNUTEK POKRITOST" "R262 PDF glava"
need_static "Pokritost prenešena v PDF" "R262 toast title"
need_static "Ni podatkov za pokritost" "R262 fail-closed toast"
need_static "Zaloga-osnutek-pokritost-" "R262 filename prefix"
need_static "zalogaOsnutekPokritost" "R262 ENA izpeljava"
need_static "nad minimumom brez osnutka" "R262 sklep resnica"
need_static "postavk osnutkov brez artikla" "R262 sklep resnica (brez zapisa)"
need_static "Pokritost osnutka:" "R262 F2 mini-vrstica"
need_static "Pokritost = zaloga × osnutki (OSNUTEK) po identiteti artikla" "R262 legenda append"
echo "--- R261 računi po projektih PDF (regresija) ---"
need_static "Izvozi račune po projektih kot PDF" "R261 pill aria"
need_static "RAČUNI PO PROJEKTIH" "R261 PDF glava"
need_static "Racuni-po-projektih-" "R261 filename prefix"
need_static "racuniProjektiPoProjektih" "R261 ENA izpeljava"
need_static "Ponudbe v izvedbi" "R261 F2 mini-vrstica"
echo "--- R260/R259/R258/R257/R256/R255 regresije ---"
need_static "\"Najhitrejši rok\",\"Največji popust\"" "R260 CSV glava (minified)"
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
