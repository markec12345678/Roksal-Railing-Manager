#!/bin/bash
# R265 — build needleji: (21) PROJEKTI — TERMINI PREGLED PDF (logistics-tab —
# presek /api/schedules × /api/projects, oba vira ŽE fetchana; route NIČ) +
# R264/R263/R262/R261/…/R227 regresije (parent: r264-build-needles.sh viri).
set -u
cd /home/z/my-project
OUT=/tmp/r265-build-chunks
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

echo "--- R265 projekti-termini PDF (klient) ---"
need_static "Izvozi pregled projektov in terminov kot PDF" "R265 pill aria"
need_static "Pregled projektov in terminov kot pravi PDF — kateri projekti imajo termine in koliko dela je še pred nami" "R265 pill title"
need_static "PROJEKTI — TERMINI PREGLED" "R265 PDF glava"
need_static "Pregled projektov in terminov prenešen v PDF" "R265 toast title"
need_static "Ni vpisanih terminov" "R265 fail-closed toast"
need_static "Pregled projektov in terminov se izvozi, ko je vpisan prvi termin montaže." "R265 fail-closed toast opis"
need_static "Projekti-termini-" "R265 filename prefix"
need_static "projektiTerminiPregled" "R265 ENA izpeljava (KPI + tabela + sklep + toast)"
need_static "GET /api/schedules → HTTP" "R265 FRESH fetch ISTEGA endpointa (R264 precedens)"
need_static "Odgovora /api/schedules ni mogoče prebrati" "R265 fail-verbose DTO pruning"
need_static "projektBeseda" "R265 sklanjatev projektov"
need_static "terminBeseda" "R265 sklanjatev terminov (EN VIR termini-prikaz)"
need_static "Plan. brez termina" "R265 KPI planska luknja"
need_static "od tega s planirano montažo" "R265 sklep resnica (planska luknja)"
need_static "(ure preklicanih izključene iz vsote)" "R265 sklep resnica (preklicani — R257 vzorec)"
need_static "vsi termini tujci" "R265 fail-closed: vsi tujci"
need_static "podvojen projekt id" "R265 fail-closed: dup identiteta"
need_static "· Projekti = projekti × termini (pokritost po projektih)" "R265 legenda append"
echo "--- R264 dobavitelji-pozicija PDF (regresija — R264 ŽIVO na produ dokazan) ---"
need_static "Izvozi pozicijo dobaviteljev kot PDF" "R264 pill aria"
need_static "Pozicija dobaviteljev kot pravi PDF — kdo je najcenejši in kje je prostor za pogajanja" "R264 pill title"
need_static "DOBAVITELJI — POZICIJA CEN" "R264 PDF glava"
need_static "Pozicija dobaviteljev prenešena v PDF" "R264 toast title"
need_static "Ni vpisanih cen" "R264 fail-closed toast"
need_static "Pozicija dobaviteljev se izvozi, ko je vpisana prva nabavna cena." "R264 fail-closed toast opis"
need_static "Pozicija-dobaviteljev-" "R264 filename prefix"
need_static "dobaviteljiPozicijaCen" "R264 ENA izpeljava"
need_static "ponudbaBeseda" "R264 sklanjatev EN VIR"
need_static "samo ena ponudba — ni primerjave" "R264 sklep resnica"
need_static "bestPrice je MIN po konstrukciji" "R264 fail-closed: min-invarianta"
need_static "razlika % ne obstaja" "R264 fail-closed: bestPrice 0"
need_static "· Pozicija = dobavitelji × najnižja per artikel · Brez alternative = samo ena ponudba" "R264 legenda append"
echo "--- R263 stranke-pokritost PDF (regresija) ---"
need_static "Izvozi pokritost opomnikov kot PDF" "R263 pill aria"
need_static "STRANKE — OPOMNIŠKA POKRITOST" "R263 PDF glava"
need_static "Pokritost opomnikov:" "R263 F2 mini-vrstica"
need_static "· Pokritost = stranke × opomnikStatus (slepe pike = brez datuma)" "R263 legenda append"
need_static "arhiviranih brez opomnika" "R263 sklep resnica"
echo "--- R262/R261/R260/R259/R258/R257/R256/R255 + starejše regresije ---"
need_static "Izvozi pokritost zaloge in osnutkov kot PDF" "R262 pill aria"
need_static "ZALOGA — OSNUTEK POKRITOST" "R262 PDF glava"
need_static "Pokritost osnutka:" "R262 F2 mini-vrstica"
need_static "Izvozi račune po projektih kot PDF" "R261 pill aria"
need_static "RAČUNI PO PROJEKTIH" "R261 PDF glava"
need_static "\"Najhitrejši rok\",\"Največji popust\"" "R260 CSV glava (minified)"
need_static "children:\"najhitrejši rok\"" "R260 žig najhitrejši rok"
need_static "children:\"največji popust\"" "R260 žig največji popust"
need_static "· CSV nosi segmentacijo (najhitrejši rok · največji popust)" "R260 legenda append"
need_static "Povprečni rok" "R259 KPI 4 label"
need_static "povprečni dobavni rok" "R259 sklep + toast agregat"
need_static "Izvozi dobičkonosnost projektov kot PDF" "R258 pill aria"
need_static "DOBIČKONOST PO PROJEKTIH" "R258 PDF glava"
need_static "Izvozi naročila kot PDF" "R257 pill aria"
need_static "NAROČILA — PREGLED" "R257 PDF glava"
need_static "Izvozi tedenski pregled montaž kot PDF" "R256 pill aria"
need_static "TEDENSKI VOZNI RED MONTAŽ" "R256 PDF glava"
need_static "Izvozi vozni red montaž kot PDF" "R255 pill aria"
need_static "VOZNI RED MONTAŽ" "R255 PDF glava"
need_static "Ni vidnih terminov montaže" "R255 fail-closed toast"
need_static "to-roksal-navy-soft" "R255 navy-soft žeton"
need_static "Izvozi koledar pregledov kot PDF" "R253 pill aria"
need_static "Izvozi potekle opomnike kot PDF" "R252 bulk pill aria"
need_static "Izvozi prihodke kot PDF" "R250 pill aria"
need_static "Moja vloga in dovoljenja" "R240 meni + dialog"
need_static "CENIK MATERIALA" "R244 PDF glava"
need_static "Brez dobavitelja (" "R227 žig aria"
must_miss "to-[#2a3f5f]" "must_miss to-[#2a3f5f]"
must_miss "accent-[#f59e0b]" "must_miss accent-[#f59e0b]"
must_miss "bg-[#f7f9ff]" "must_miss bg-[#f7f9ff]"
echo "NEEDLE FAIL=$FAIL (R265 ×18 novih + R264 ×13 + regresije)"
exit $FAIL
