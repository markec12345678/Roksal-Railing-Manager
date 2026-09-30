#!/usr/bin/env python3
# R327 — derive r327-build-needles.sh iz r326 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Glava: R327 zapis (54. člen zgodovina cen PDF brat)
#   2. OUT pot: /tmp/r326-build-chunks → /tmp/r327-build-chunks
#   3. R327 needle blok (PDF aria + filename ×2 + must_miss) — PO R326 bloku
#   4. Footer R326 → R327 (veriga na r326-build-needles ostaja — nosi R326
#      zgodovina cen + R325 dekompozicija + R324 dnevni PDF + verigo do R227)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r326-build-needles.sh')
DOL = Path('/home/z/my-project/scripts/r327-build-needles.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('''# R326 — build needleji: 53. ČLEN issue #1 §5 «ZGODOVINA CEN MATERIALA»
# (price history — NOVI lib cena-zgodovina: ČISTA projekcija MaterialPrice
# vključno z ZAPRTO zgodovino; NOVI GET route material-prices/zgodovina
# [r308 81→82]; NOVI panel CenaZgodovinaPanel na inventory tabu — par =
# material × dobavitelj časovnica + iskrene smeri + CSV gumb izvozne
# družine; EN VIR glave + CENA_SMER_NIZ + sklep + VIR_NIZ) +''',
'''# R327 — build needleji: 54. ČLEN issue #1 «IZVOZI» — ZGODOVINA CEN PDF
# (deterministični PDF BRAT CSV-ju R326: NOVI lib cena-zgodovina-pdf —
# LOČEN od podatkovnega brata, vzorec vodja-csv/vodja-dnevni-pdf R324;
# EN VIR cenaParVrstice = skupni potrošnik CSV+PDF tabel — ne moreta
# divergirati po konstrukciji; FNV soli 0xd1–0xd4; panel izvozni PAR
# CSV+PDF na isti blok glavi — navy/40, amber/50 register ostane v vodji
# ×8; iskrena ničelna veja — OBA gumba skrita brez podatkov) +
# DEDOVINA 53. člena (R326 zgodovina cen CSV needleji ostajajo v verigi) +''', 1)

# ── 2. OUT pot ──
zam('OUT=/tmp/r326-build-chunks', 'OUT=/tmp/r327-build-chunks', 1)

# ── 3. R327 needle blok (PO R326 lastni vrstici, PRED REGRESIJAMI) ──
zam('''must_miss "TODO-R326" "R326 — brez razvojnih ostankov"
echo "R326 lastni needleji: FAIL=$FAIL (3 izvoz + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r324-build-needles.sh [vzporedna r324 = dekompozicija FAZA 2 + r323 CSV + R322 + … + R227; R324 dnevni PDF blok OBNOVLJEN zgoraj] ==="''',
'''must_miss "TODO-R326" "R326 — brez razvojnih ostankov"
echo "R326 lastni needleji: FAIL=$FAIL (3 izvoz + 1 must_miss)"
echo "--- R327 MANDATORY — 54. člen: zgodovina cen materiala PDF izvoz (IZVOZI družina — PDF brat CSV-ju) ---"
need_static "Izvozi zgodovino cen materiala kot PDF" "R327 PDF izvoz gumb aria (panel chunk)"
need_static "zgodovina-cen.pdf" "R327 PDF izvoz filename (cena-zgodovina-pdf lib)"
echo "--- R327 must_miss (negativni) ---"
must_miss "TODO-R327" "R327 — brez razvojnih ostankov"
echo "R327 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r326-build-needles.sh [R326 zgodovina cen CSV + R325 dekompozicija + R324 dnevni PDF + r323 CSV + R322 + … + R227] ==="''', 1)

# ── 4. Footer ──
zam('echo "R326 NEEDLEJI FAIL"; exit 1; fi', 'echo "R327 NEEDLEJI FAIL"; exit 1; fi', 1)
zam('=== R326 BUILD NEEDLES VSE OK ===', '=== R327 BUILD NEEDLES VSE OK ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r327-build-needles.sh zapisan ({len(text)} znakov)')
