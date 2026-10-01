#!/usr/bin/env python3
# R336 — derive r336-build-needles.sh iz r335 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Glava: R336 zapis (63. člen sistem zdravje CSV)
#   2. OUT pot: /tmp/r335-build-chunks → /tmp/r336-build-chunks
#   3. R336 needle blok (aria + testid + must_miss) — PO R335 bloku
#   4. Regresije echo: +R335 v seznamu; footer R335 → R336
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r335-build-needles.sh')
DOL = Path('/home/z/my-project/scripts/r336-build-needles.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava (R335 opis → R336 opis; dedovina/lekcija rep ostane) ──
zam('''# R335 — build needleji: 62. ČLEN issue #1 «IZVOZI» — MESEČNO POROČILO
# VODJE CSV (CSV brat Poročilo PDF rundi M [boss-report-pdf]: NOVI lib
# vodja-mesecni-csv — vzorec R330–R334, LOČEN lib ki UVAŽA resnico PDF
# brata — EN VIR: ISTI ReportData vhod prek komponentne izpeljave
# mesecniPregledData [DVA potrošnika: generateMonthlyReport +
# vodjaMesecniCsv — divergenca nemogoča, vzorec vodjaIzvozVhod R293];
# mesecIme + STATUS_SL UVOŽENA iz PDF brata — anti-divergenca po
# konstrukciji; celice = ISTI izpisi kot PDF body — eur/eur0 EN VIR
# csv-export, zapadli 'Dni zapadlo' = ISTA izpeljava kot PDF; glave
# VERBATIM PDF autoTable head ×3 + predstavitvena prihodki glava [PDF
# riše graf]; sklep = VERBATIM PDF sklepna vrstica; 'Izvoženo ob' =
# PODATKOVNI izvoz z referenčnim mesecem [kanon R330–R333 — zapadli dni
# je odvisen od dneva]; filename porocilo-YYYY-MM.csv — bratska simetrija
# z PDF imenom [mesec IZ VHODA, nikoli iz ure]; format kanon R136 toCsv
# [BOM + podpičje + CRLF + RFC 4180]; izvozna PAR na vodja blok glavi —
# amber/50 ring + offset-2 + press-scale, ISTI žeton kot PDF brat, val 8
# register 67 → 68 + vodja amber ×9 → ×10 + val 9 taktilni 16 → 17;
# STIL val 22) +
# DEDOVINA 61. člena (R334 končna verifikacija CSV needleji ostajajo v
# verigi) + DEDOVINA 60. člena (R333 pozicija dobaviteljev CSV needleji
# ostajajo v verigi) +''',
'''# R336 — build needleji: 63. ČLEN issue #1 «IZVOZI» — SISTEM ZDRAVJE CSV
# (CSV brat zaslona SistemZdravjeCard R187/R188/R189 — ZADNJA vodja kartica
# brez izvoza: NOVI lib sistem-zdravje-csv — EN VIR: ISTA seja zgodovina
# [zdravje-zgodovina] + ISTI odziviStatistika izračun [divergenca nemogoča]
# + ISTI zigIzpis klic kot kartica + BAZA_NIZ kartica UVAŽA [precedens R335
# STATUS_SL: const → export, zero-behavior]; BREZ časa — kanon R334
# brez-časa [statičen izvoz te seje: isti zgodovina + build = bajtno
# identična datoteka, nič 'Izvoženo ob']; filename sistem-zdravje.csv —
# brez datuma, bratska simetrija z koncna-verifikacija.csv; format kanon
# R136 toCsv [BOM + podpičje + CRLF + RFC 4180]; fail-closed kanon R299;
# pill navy/40 družina [val20 Material precedens — gumb v SESTAVLJENI
# kartici sistem-zdravje-card.tsx, izven vodja datoteke → amber/50 register
# OSTANE ×10, val8 drevo 68 → 69, val9 taktilni ×17 NEPREMIKNJEN — file-
# scoped]; STIL val 23) +
# DEDOVINA 62. člena (R335 mesečno poročilo vodje CSV needleji ostajajo v
# verigi) + DEDOVINA 61. člena (R334 končna verifikacija CSV needleji
# ostajajo v verigi) + DEDOVINA 60. člena (R333 pozicija dobaviteljev CSV
# needleji ostajajo v verigi) +''')

# ── 2. OUT pot ──
zam('OUT=/tmp/r335-build-chunks', 'OUT=/tmp/r336-build-chunks')

# ── 3. R336 needle blok PO R335 bloku + 4. regresije echo ──
zam('''echo "--- R335 MANDATORY — 62. člen: mesečno poročilo vodje CSV izvoz (IZVOZI družina — CSV brat Poročilo PDF rundi M, EN VIR mesecniPregledData) ---"
need_static "Izvozi mesečno poročilo vodje kot CSV" "R335 mesečno poročilo CSV gumb aria (vodja chunk)"
need_static "vodja-mesecni-csv-pill" "R335 mesečno poročilo CSV gumb testid (vodja chunk)"
echo "--- R335 must_miss (negativni) ---"
must_miss "TODO-R335" "R335 — brez razvojnih ostankov"
echo "R335 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r324-build-needles.sh [R334 končna verifikacija CSV + R333 pozicija dobaviteljev CSV + R332 potekli opomniki CSV + R331 ponudbe-spomniki CSV + R330 projekti-termini CSV + R329 primerjava dobaviteljev PDF + R328 primerjava dobaviteljev CSV + R327 zgodovina cen PDF + R326 zgodovina cen CSV + R325 dekompozicija + R324 dnevni PDF + r323 CSV + R322 + … + R227] ==="''',
'''echo "--- R335 MANDATORY — 62. člen: mesečno poročilo vodje CSV izvoz (IZVOZI družina — CSV brat Poročilo PDF rundi M, EN VIR mesecniPregledData) ---"
need_static "Izvozi mesečno poročilo vodje kot CSV" "R335 mesečno poročilo CSV gumb aria (vodja chunk)"
need_static "vodja-mesecni-csv-pill" "R335 mesečno poročilo CSV gumb testid (vodja chunk)"
echo "--- R335 must_miss (negativni) ---"
must_miss "TODO-R335" "R335 — brez razvojnih ostankov"
echo "--- R336 MANDATORY — 63. člen: sistem zdravje CSV izvoz (IZVOZI družina — CSV brat zaslona SistemZdravjeCard, EN VIR seja zgodovina + odziviStatistika) ---"
need_static "Izvozi sistem zdravje kot CSV" "R336 sistem zdravje CSV gumb aria (sistem-zdravje-card chunk)"
need_static "sistem-zdravje-csv-pill" "R336 sistem zdravje CSV gumb testid (sistem-zdravje-card chunk)"
echo "--- R336 must_miss (negativni) ---"
must_miss "TODO-R336" "R336 — brez razvojnih ostankov"
echo "=== REGRESIJE: polna veriga prek r324-build-needles.sh [R335 mesečno poročilo vodje CSV + R334 končna verifikacija CSV + R333 pozicija dobaviteljev CSV + R332 potekli opomniki CSV + R331 ponudbe-spomniki CSV + R330 projekti-termini CSV + R329 primerjava dobaviteljev PDF + R328 primerjava dobaviteljev CSV + R327 zgodovina cen PDF + R326 zgodovina cen CSV + R325 dekompozicija + R324 dnevni PDF + r323 CSV + R322 + … + R227] ==="''')

# ── 4. Footer ──
zam('echo "R335 NEEDLEJI FAIL"; exit 1', 'echo "R336 NEEDLEJI FAIL"; exit 1')
zam('echo "=== R335 BUILD NEEDLES VSE OK ==="', 'echo "=== R336 BUILD NEEDLES VSE OK ==="')

DOL.write_text(text, encoding='utf-8')
print('r336-build-needles.sh: OK (derive iz r335)')
