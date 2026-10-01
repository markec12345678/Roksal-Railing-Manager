#!/usr/bin/env python3
# R328 — derive r328-build-needles.sh iz r327 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Glava: R328 zapis (55. člen primerjava dobaviteljev)
#   2. OUT pot: /tmp/r327-build-chunks → /tmp/r328-build-chunks
#   3. R328 needle blok (CSV aria + VIR niz + must_miss) — PO R327 bloku
#   4. Footer R327 → R328 (veriga na r327-build-needles ostaja)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r327-build-needles.sh')
DOL = Path('/home/z/my-project/scripts/r328-build-needles.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('''# R327 — build needleji: 54. ČLEN issue #1 «IZVOZI» — ZGODOVINA CEN PDF
# (deterministični PDF BRAT CSV-ju R326: NOVI lib cena-zgodovina-pdf —
# LOČEN od podatkovnega brata, vzorec vodja-csv/vodja-dnevni-pdf R324;
# EN VIR cenaParVrstice = skupni potrošnik CSV+PDF tabel — ne moreta
# divergirati po konstrukciji; FNV soli 0xd1–0xd4; panel izvozni PAR
# CSV+PDF na isti blok glavi — navy/40, amber/50 register ostane v vodji
# ×8; iskrena ničelna veja — OBA gumba skrita brez podatkov) +
# DEDOVINA 53. člena (R326 zgodovina cen CSV needleji ostajajo v verigi) +''',
'''# R328 — build needleji: 55. ČLEN issue #1 §5 «SUPPLIER COMPARISON» —
# PRIMERJAVA DOBAVITELJEV (NOVI lib cena-dobavitelji: drugo grupiranje
# ISTEGA pregleda zgodovine R326 — EN VIR, pregled kot PROP, nič drugega
# fetcha; iskren agregat ŠTEVCEV smeri, nič izmišljenega povprečja; razpon
# trenutnih cen min/max; sort naziv+supplierId UTF-16; NOVI pod panel
# CenaDobaviteljiPanel — LOČEN datoteka, LEKCIJA R325 5; CSV gumb izvozne
# družine — navy/40, amber/50 register ostane v vodji ×8; filename
# primerjava-dobaviteljev.csv brez datuma) +
# DEDOVINA 54. člena (R327 zgodovina cen PDF needleji ostajajo v verigi) +''', 1)

# ── 2. OUT pot ──
zam('OUT=/tmp/r327-build-chunks', 'OUT=/tmp/r328-build-chunks', 1)

# ── 3. R328 needle blok (PO R327 lastni vrstici, PRED REGRESIJAMI) ──
zam('''must_miss "TODO-R327" "R327 — brez razvojnih ostankov"
echo "R327 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r326-build-needles.sh [R326 zgodovina cen CSV + R325 dekompozicija + R324 dnevni PDF + r323 CSV + R322 + … + R227] ==="''',
'''must_miss "TODO-R327" "R327 — brez razvojnih ostankov"
echo "R327 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "--- R328 MANDATORY — 55. člen: primerjava dobaviteljev (§5 supplier comparison — IZVOZI družina) ---"
need_static "Izvozi primerjavo dobaviteljev kot CSV" "R328 primerjava dobaviteljev CSV gumb aria (panel chunk)"
need_static "PRIMERJAVA_DOBAVITELJEV" "R328 primerjava dobaviteljev VIR niz (cena-dobavitelji lib)"
echo "--- R328 must_miss (negativni) ---"
must_miss "TODO-R328" "R328 — brez razvojnih ostankov"
echo "R328 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r327-build-needles.sh [R327 zgodovina cen PDF + R326 zgodovina cen CSV + R325 dekompozicija + R324 dnevni PDF + r323 CSV + R322 + … + R227] ==="''', 1)

# ── 4. Footer ──
zam('echo "R327 NEEDLEJI FAIL"; exit 1; fi', 'echo "R328 NEEDLEJI FAIL"; exit 1; fi', 1)
zam('=== R327 BUILD NEEDLES VSE OK ===', '=== R328 BUILD NEEDLES VSE OK ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r328-build-needles.sh zapisan ({len(text)} znakov)')
