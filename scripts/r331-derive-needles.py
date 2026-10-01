#!/usr/bin/env python3
# R331 — derive r331-build-needles.sh iz r330 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Glava: R331 zapis (58. člen ponudbe-spomniki CSV brat)
#   2. OUT pot: /tmp/r330-build-chunks → /tmp/r331-build-chunks
#   3. R331 needle blok (CSV aria + testid + must_miss) — PO R330 bloku
#   4. Footer R330 → R331 (veriga na r330-build-needles ostaja)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r330-build-needles.sh')
DOL = Path('/home/z/my-project/scripts/r331-build-needles.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('''# R330 — build needleji: 57. ČLEN issue #1 «IZVOZI» — PROJEKTI — TERMINI
# CSV (CSV brat PDF R265: NOVI lib projekti-termini-csv — vzorec R297
# oprema-cikel-csv, LOČEN lib ki UVAŽA projekcijo PDF brata — EN VIR
# projektiTerminiPregled, NIČ podvojenih pravil; glava VERBATIM PDF
# autoTable head; Sklep VERBATIM PDF sklepu; meta kanon R172→R296; filename
# Projekti-termini-YYYY-MM-DD.csv — bratska simetrija; izvozna PAR na
# logistics-tab — navy/40 ring + press-scale, val 8 register 63; ENA
# izpeljava vira pridobiProjektiTerminiVnosi ×2 — oba brata) +
# DEDOVINA 56. člena (R329 primerjava dobaviteljev PDF needleji ostajajo v
# verigi) +''',
'''# R331 — build needleji: 58. ČLEN issue #1 «IZVOZI» — PONUDBE — SPOMNIKI
# CSV (CSV brat PDF R267: NOVI lib ponudbe-spomniki-csv — vzorec R330/R297,
# LOČEN lib ki UVAŽA projekcijo PDF brata — EN VIR ponudbeSpomnikiPregled,
# NIČ podvojenih pravil; glava VERBATIM PDF autoTable head ×8; Sklep
# VERBATIM PDF sklepu [stanjeSklep oznake + statusi R161]; meta kanon
# R172→R296; filename Ponudbe-spomniki-YYYY-MM-DD.csv — bratska simetrija;
# izvozna PAR na CRM kartici Ponudbe — sledenje [quote-followup] — navy/40
# ring + press-scale, val 8 register 64; TROJICA press-scale pariteta
# [R161 gumb dobi press-scale]; ENA izpeljava vira pridobiPonudbeSpomnikiVnosi
# ×2 — oba brata; STIL val 18) +
# DEDOVINA 57. člena (R330 projekti-termini CSV needleji ostajajo v verigi) +''', 1)

# ── 2. OUT pot ──
zam('OUT=/tmp/r330-build-chunks', 'OUT=/tmp/r331-build-chunks', 1)

# ── 3. R331 needle blok (PO R330 lastni vrstici, PRED REGRESIJAMI) ──
zam('''must_miss "TODO-R330" "R330 — brez razvojnih ostankov"
echo "R330 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"''',
'''must_miss "TODO-R330" "R330 — brez razvojnih ostankov"
echo "R330 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "--- R331 MANDATORY — 58. člen: pregled spomnikov ponudb CSV izvoz (IZVOZI družina — CSV brat PDF R267) ---"
need_static "Izvozi pregled spomnikov ponudb kot CSV" "R331 ponudbe-spomniki CSV gumb aria (quote-followup chunk)"
need_static "ponudbe-spomniki-csv-pill" "R331 ponudbe-spomniki CSV gumb testid (quote-followup chunk)"
echo "--- R331 must_miss (negativni) ---"
must_miss "TODO-R331" "R331 — brez razvojnih ostankov"
echo "R331 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"''', 1)

# ── 4. Footer ──
zam('echo "=== REGRESIJE: polna veriga prek r329-build-needles.sh [R329 primerjava dobaviteljev PDF + R328 primerjava dobaviteljev CSV + R327 zgodovina cen PDF + R326 zgodovina cen CSV + R325 dekompozicija + R324 dnevni PDF + r323 CSV + R322 + … + R227] ==="',
    'echo "=== REGRESIJE: polna veriga prek r330-build-needles.sh [R330 projekti-termini CSV + R329 primerjava dobaviteljev PDF + R328 primerjava dobaviteljev CSV + R327 zgodovina cen PDF + R326 zgodovina cen CSV + R325 dekompozicija + R324 dnevni PDF + r323 CSV + R322 + … + R227] ==="', 1)
zam('echo "R330 NEEDLEJI FAIL"; exit 1; fi', 'echo "R331 NEEDLEJI FAIL"; exit 1; fi', 1)
zam('=== R330 BUILD NEEDLES VSE OK ===', '=== R331 BUILD NEEDLES VSE OK ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r331-build-needles.sh zapisan ({len(text)} znakov)')
