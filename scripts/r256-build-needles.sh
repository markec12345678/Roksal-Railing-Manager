#!/bin/bash
# R256 — build needleji: (12) TEDENSKI VOZNI RED MONTAŽ PDF (logistika —
# 7-dnevni razgled po dnevih iz ISTEGA DTO kot vozni red R255; route NIČ) +
# R255/R254/…/R227 regresije (parent: r255-build-needles.sh viri).
# LEKCIJA R255: needle probe za žetone v dynamic-import tabih zahteva dispatch
# TISTEGA taba PRED zbiranjem čankov (logistika tab vključen).
set -u
cd /home/z/my-project
OUT=/tmp/r256-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# Vsi client chunki iz build manifestov (statična analiza — brez brskalnika).
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

echo "--- R255 F2 žeton navy-soft (regresija) ---"
need_static "to-roksal-navy-soft" "R255 gradient žeton (EXACT #2a3f5f)"
echo "--- R256 tedenski vozni red PDF (klient) ---"
need_static "Izvozi tedenski pregled montaž kot PDF" "R256 pill aria"
need_static "Tedenski pregled montaž — naslednjih 7 dni (razgled po dnevih)" "R256 pill title"
need_static "TEDENSKI VOZNI RED MONTAŽ" "R256 PDF glava"
need_static "prazno okno (naslednjih 7 dni) ne nastaja dokumenta" "R256 fail-closed: prazno okno"
need_static "CSV = prikazani termini · ICS = koledar v telefonu · PDF = vozni red (kronološki) · Tedenski = naslednjih 7 dni (po dnevih)" "R256 legenda (R255 predpona + pripona)"
need_static "Tedenski pregled prenešen v PDF" "R256 toast title"
need_static "Ni terminov v naslednjih 7 dneh" "R256 fail-closed toast"
need_static "Tedenski pregled se izvozi, ko je vpisan termin v prihajajočem tednu." "R256 fail-closed toast opis"
need_static "Tedenski-vozni-red-" "R256 filename prefix"
need_static "okno = danes + 6 dni (UTC)" "R256 sklep okno resnica"
need_static "po dnevih (razgled)" "R256 sklep podpis"
need_static "vir = vidni termini logistike." "R256 sklep vir resnica"
need_static "\"Dni z delom\"" "R256 KPI label (minifier dvojni navedki — R253 lekcija 2)"
need_static "tedenskiDanIme" "R256 weekday fiksni seznam"
need_static "tedenskiOknoDnevi" "R256 okno 7 dni"
echo "--- R255 vozni red montaž PDF (regresija) ---"
need_static "Izvozi vozni red montaž kot PDF" "R255 pill aria"
need_static "VOZNI RED MONTAŽ" "R255 PDF glava"
need_static "Ni vidnih terminov montaže" "R255 fail-closed toast"
need_static "Vozni red prenešen v PDF" "R255 toast title"
need_static "Vozni-red-montaz-" "R255 filename prefix"
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
