#!/usr/bin/env python3
# R330 — derive r330-build-needles.sh iz r329 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Glava: R330 zapis (57. člen projekti-termini CSV brat)
#   2. OUT pot: /tmp/r329-build-chunks → /tmp/r330-build-chunks
#   3. R330 needle blok (CSV aria + testid + must_miss) — PO R329 bloku
#   4. Footer R329 → R330 (veriga na r329-build-needles ostaja)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r329-build-needles.sh')
DOL = Path('/home/z/my-project/scripts/r330-build-needles.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('''# R329 — build needleji: 56. ČLEN issue #1 «IZVOZI» — PRIMERJAVA
# DOBAVITELJEV PDF (deterministični PDF BRAT CSV-ju R328: NOVI lib
# cena-dobavitelji-pdf — LOČEN od podatkovnega brata, vzorec vodja-csv/
# vodja-dnevni-pdf R324 / zgodovina-cen-pdf R327; EN VIR
# cenaDobaviteljiVrstice = skupni potrošnik CSV+PDF tabel — ne moreta
# divergirati po konstrukciji; FNV soli 0xd5–0xd8; panel izvozni PAR
# CSV+PDF na isti blok glavi — navy/40, amber/50 register ostane v vodji
# ×8; val 16 iskren alarm WYSIWYG — narašča roksal-red / pada roksal-green
# na zaslonu; iskrena ničelna veja — OBA gumba skrita brez podatkov) +
# DEDOVINA 55. člena (R328 primerjava dobaviteljev CSV needleji ostajajo v
# verigi) +''',
'''# R330 — build needleji: 57. ČLEN issue #1 «IZVOZI» — PROJEKTI — TERMINI
# CSV (CSV brat PDF R265: NOVI lib projekti-termini-csv — vzorec R297
# oprema-cikel-csv, LOČEN lib ki UVAŽA projekcijo PDF brata — EN VIR
# projektiTerminiPregled, NIČ podvojenih pravil; glava VERBATIM PDF
# autoTable head; Sklep VERBATIM PDF sklepu; meta kanon R172→R296; filename
# Projekti-termini-YYYY-MM-DD.csv — bratska simetrija; izvozna PAR na
# logistics-tab — navy/40 ring + press-scale, val 8 register 63; ENA
# izpeljava vira pridobiProjektiTerminiVnosi ×2 — oba brata) +
# DEDOVINA 56. člena (R329 primerjava dobaviteljev PDF needleji ostajajo v
# verigi) +''', 1)

# ── 2. OUT pot ──
zam('OUT=/tmp/r329-build-chunks', 'OUT=/tmp/r330-build-chunks', 1)

# ── 3. R330 needle blok (PO R329 lastni vrstici, PRED REGRESIJAMI) ──
zam('''must_miss "TODO-R329" "R329 — brez razvojnih ostankov"
echo "R329 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"''',
'''must_miss "TODO-R329" "R329 — brez razvojnih ostankov"
echo "R329 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "--- R330 MANDATORY — 57. člen: pregled projektov in terminov CSV izvoz (IZVOZI družina — CSV brat PDF R265) ---"
need_static "Izvozi pregled projektov in terminov kot CSV" "R330 projekti-termini CSV gumb aria (logistics chunk)"
need_static "projekti-termini-csv-pill" "R330 projekti-termini CSV gumb testid (logistics chunk)"
echo "--- R330 must_miss (negativni) ---"
must_miss "TODO-R330" "R330 — brez razvojnih ostankov"
echo "R330 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"''', 1)

# ── 4. Footer ──
zam('echo "=== REGRESIJE: polna veriga prek r328-build-needles.sh [R328 primerjava dobaviteljev CSV + R327 zgodovina cen PDF + R326 zgodovina cen CSV + R325 dekompozicija + R324 dnevni PDF + r323 CSV + R322 + … + R227] ==="',
    'echo "=== REGRESIJE: polna veriga prek r329-build-needles.sh [R329 primerjava dobaviteljev PDF + R328 primerjava dobaviteljev CSV + R327 zgodovina cen PDF + R326 zgodovina cen CSV + R325 dekompozicija + R324 dnevni PDF + r323 CSV + R322 + … + R227] ==="', 1)
zam('echo "R329 NEEDLEJI FAIL"; exit 1; fi', 'echo "R330 NEEDLEJI FAIL"; exit 1; fi', 1)
zam('=== R329 BUILD NEEDLES VSE OK ===', '=== R330 BUILD NEEDLES VSE OK ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r330-build-needles.sh zapisan ({len(text)} znakov)')
