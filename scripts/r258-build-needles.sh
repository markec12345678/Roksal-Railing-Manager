#!/bin/bash
# R258 — build needleji: (14) DOBIČKONOST PO PROJEKTIH PDF (vodja-dashboard —
# presek prihodkov računov IN stroškov materiala naročil iz ISTIH virov kot
# vodjin pregled; route NIČ) + R257/R256/R255/…/R227 regresije (parent:
# r257-build-needles.sh viri). LEKCIJA R255: dispatch tabov pred zbiranjem.
set -u
cd /home/z/my-project
OUT=/tmp/r258-build-chunks
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

echo "--- R258 dobičkonost po projektih PDF (klient) ---"
need_static "Izvozi dobičkonosnost projektov kot PDF" "R258 pill aria"
need_static "Dobičkonosnost po projektih kot pravi PDF — prihodki (računi) vs stroški materiala (naročila) z maržo in akcijskim redom" "R258 pill title"
need_static "DOBIČKONOST PO PROJEKTIH" "R258 PDF glava"
need_static "Dobičkonost prenešena v PDF" "R258 toast title"
need_static "Ni podatkov za dobičkonost" "R258 fail-closed toast"
need_static "PDF se izvozi, ko je vpisan prvi račun ali naročilo." "R258 fail-closed toast opis"
need_static "Prihodki = izdani + plačani računi · Stroški = ne-preklicana naročila · Marža = prihodki − stroški · Marža (%) = marža / prihodki · Brez projekta = izključeni iz preseka" "R258 legenda"
need_static "Dobicikonost-projektov-" "R258 filename prefix"
need_static "izključeni iz preseka" "R258 sklep resnica (brez projekta)"
need_static "(izključeni iz prihodkov)" "R258 sklep resnica (stornirani/osnutki)"
need_static "dobicikonostPoProjektih" "R258 ENA izpeljava (KPI + tabela + sklep + toast)"
need_static "negativnih marž" "R258 alarm v sklepu"
need_static "prazen presek ne nastaja dokumenta" "R258 fail-closed: prazen presek"
echo "--- R257 naročila pregled PDF (regresija) ---"
need_static "Izvozi naročila kot PDF" "R257 pill aria"
need_static "NAROČILA — PREGLED" "R257 PDF glava"
need_static "Ni naročil za izvoz" "R257 fail-closed toast"
need_static "CSV = vrstica per postavka · PDF = vrstica per naročilo · Pretekel rok = pretekljena obljuba, status še odprt" "R257 legenda"
need_static "jeZamujenaDobava)(" "R257 pretekel rok EN VIR klic (minified)"
echo "--- R256 tedenski vozni red PDF (regresija) ---"
need_static "Izvozi tedenski pregled montaž kot PDF" "R256 pill aria"
need_static "TEDENSKI VOZNI RED MONTAŽ" "R256 PDF glava"
need_static "Ni terminov v naslednjih 7 dneh" "R256 fail-closed toast"
need_static "CSV = prikazani termini · ICS = koledar v telefonu · PDF = vozni red (kronološki) · Tedenski = naslednjih 7 dni (po dnevih)" "R256 legenda"
need_static "tedenskiDanIme" "R256 weekday fiksni seznam"
need_static "to-roksal-navy-soft" "R255 F2 gradient žeton (EXACT #2a3f5f)"
echo "--- R255 vozni red montaž PDF (regresija) ---"
need_static "Izvozi vozni red montaž kot PDF" "R255 pill aria"
need_static "VOZNI RED MONTAŽ" "R255 PDF glava"
need_static "Ni vidnih terminov montaže" "R255 fail-closed toast"
need_static "Vozni red prenešen v PDF" "R255 toast title"
echo "--- R254 aria + žetoni (regresija) ---"
need_static "accent-roksal-amber" "R254 accent-roksal-amber žeton"
need_static "bg-roksal-bg" "R254 bg-roksal-bg žeton"
must_miss "accent-[#f59e0b]" "R254 must_miss accent-[#f59e0b]"
must_miss "bg-[#f7f9ff]" "R254 must_miss bg-[#f7f9ff]"
echo "--- R253/R252/R251/R250/R249/R244 regresije ---"
need_static "Izvozi koledar pregledov kot PDF" "R253 pill aria"
need_static "Ni vpisanih pregledov" "R253 fail-closed toast"
need_static "Izvozi potekle opomnike kot PDF" "R252 bulk pill aria"
need_static "Ni poteklih opomnikov" "R252 fail-closed toast"
need_static "Pripravi opomnik kot PDF" "R251 pill aria"
need_static "Izvozi prihodke kot PDF" "R250 prihodki pill aria"
need_static "Ni računov za prihodke" "R250 fail-closed toast"
need_static "Največji razpon" "R249 KPI box label"
need_static "CENIK MATERIALA" "R244 PDF glava"
echo "--- R243/R242/R240/R238/R237/R227 regresije ---"
need_static "Pregled zaloge je samo za branje" "R243 vodič premikov"
need_static "Pregled naročil je samo za branje" "R242 vodič"
need_static "Moja vloga in dovoljenja" "R240 meni + dialog"
need_static "Izvozi prodajno ploščo kot CSV" "R238 CSV aria"
need_static "Prenesi naročilnico vidnih artiklov kot PDF" "R237 Osnutek PDF pill"
need_static "Brez dobavitelja (" "R227 žig aria"
need_static "text-2xs" "P1-e žeton 2xs"
echo "NEEDLE FAIL=$FAIL"
exit $FAIL
