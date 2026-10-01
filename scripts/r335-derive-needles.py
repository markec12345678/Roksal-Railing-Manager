#!/usr/bin/env python3
# R335 — derive r335-build-needles.sh iz r334 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Glava: R335 zapis (62. člen mesečno poročilo vodje CSV brat PDF rundi M
#      — EN VIR mesecniPregledData)
#   2. OUT pot: /tmp/r334-build-chunks → /tmp/r335-build-chunks
#   3. R335 needle blok (CSV aria + testid + must_miss) — PO R334 bloku
#   4. Regresije echo: +R334 v seznamu; footer R334 → R335
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r334-build-needles.sh')
DOL = Path('/home/z/my-project/scripts/r335-build-needles.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava (R334 opis → R335 opis; dedovina/lekacija rep ostane) ──
zam('''# R334 — build needleji: 61. ČLEN issue #1 «IZVOZI» — KONČNA VERIFIKACIJA
# CSV (CSV brat JSON R316 + PDF R320 — izvozna TRIADA na vodja blok glavi:
# NOVI lib koncna-verifikacija-csv — vzorec R317 audit-csv, ČISTA projekcija
# EN VIR graditelja koncnaVerifikacija R315 — ISTA validacija fail-closed
# brezplačno, NIČ podvojenih pravil; glavi VERBATIM PDF autoTable head T1/T2
# [anti-divergenca — testi pinajo PROTI PDF VIRU]; celice = ISTI izpisi kot
# PDF body — plasti pipe-joined + opomba dokaza iz vezave; meta = KPI ×4
# ISTI izpisi kot PDF kpiBox + Sklep VERBATIM [ŠESTI potrošnik ENEGA niza] +
# Vir niz; BREZ časa — kanon determinizma 46./47. člen [isti HEAD = bajtno
# identična datoteka]; filename koncna-verifikacija.csv — bratska simetrija
# z JSON/PDF imenoma; format kanon R136 toCsv [BOM + podpičje + CRLF + RFC
# 4180]; izvozna TRIADA na vodja blok glavi — amber/50 ring + offset-2 +
# press-scale, ISTI žeton kot brata, val 8 register 66 → 67 + vodja amber
# ×8 → ×9; STIL val 21) +
# DEDOVINA 60. člena (R333 pozicija dobaviteljev CSV needleji ostajajo v
# verigi) +''',
'''# R335 — build needleji: 62. ČLEN issue #1 «IZVOZI» — MESEČNO POROČILO
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
# ostajajo v verigi) +''')

# ── 2. OUT pot ──
zam('OUT=/tmp/r334-build-chunks', 'OUT=/tmp/r335-build-chunks')

# ── 3. R335 needle blok PO R334 bloku + 4. regresije echo ──
zam('''echo "R334 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r324-build-needles.sh [R333 pozicija dobaviteljev CSV + R332 potekli opomniki CSV + R331 ponudbe-spomniki CSV + R330 projekti-termini CSV + R329 primerjava dobaviteljev PDF + R328 primerjava dobaviteljev CSV + R327 zgodovina cen PDF + R326 zgodovina cen CSV + R325 dekompozicija + R324 dnevni PDF + r323 CSV + R322 + … + R227] ==="''',
'''echo "R334 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "--- R335 MANDATORY — 62. člen: mesečno poročilo vodje CSV izvoz (IZVOZI družina — CSV brat Poročilo PDF rundi M, EN VIR mesecniPregledData) ---"
need_static "Izvozi mesečno poročilo vodje kot CSV" "R335 mesečno poročilo CSV gumb aria (vodja chunk)"
need_static "vodja-mesecni-csv-pill" "R335 mesečno poročilo CSV gumb testid (vodja chunk)"
echo "--- R335 must_miss (negativni) ---"
must_miss "TODO-R335" "R335 — brez razvojnih ostankov"
echo "R335 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r324-build-needles.sh [R334 končna verifikacija CSV + R333 pozicija dobaviteljev CSV + R332 potekli opomniki CSV + R331 ponudbe-spomniki CSV + R330 projekti-termini CSV + R329 primerjava dobaviteljev PDF + R328 primerjava dobaviteljev CSV + R327 zgodovina cen PDF + R326 zgodovina cen CSV + R325 dekompozicija + R324 dnevni PDF + r323 CSV + R322 + … + R227] ==="''')

# ── 4. Footer ──
zam('echo "R334 NEEDLEJI FAIL"; exit 1', 'echo "R335 NEEDLEJI FAIL"; exit 1')
zam('echo "=== R334 BUILD NEEDLES VSE OK ==="', 'echo "=== R335 BUILD NEEDLES VSE OK ==="')

DOL.write_text(text, encoding='utf-8')
print('r335-build-needles.sh: OK (derive iz r334)')
