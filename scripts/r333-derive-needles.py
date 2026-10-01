#!/usr/bin/env python3
# R333 — derive r333-build-needles.sh iz r332 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Glava: R333 zapis (60. člen pozicija dobaviteljev CSV brat)
#   2. OUT pot: /tmp/r332-build-chunks → /tmp/r333-build-chunks
#   3. R333 needle blok (CSV aria + testid + must_miss) — PO R332 bloku
#   4. Footer R332 → R333 (veriga na r324-build-needles trunk ostaja)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r332-build-needles.sh')
DOL = Path('/home/z/my-project/scripts/r333-build-needles.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('''# R332 — build needleji: 59. ČLEN issue #1 «IZVOZI» — POTEKLI OPOMNIKI
# CSV (CSV brat PDF R252: NOVI lib potekli-opomniki-csv — vzorec R330/R331/
# R297, LOČEN lib ki UVAŽA projekcijo PDF brata — EN VIR preverba + sort +
# agregat [preveriPotekliVnos + sortirajPotekle + potekliPovzetek +
# potekelDniPrek — ISTA sekvenca kot buildPotekliOpomnikiPdfDoc], NIČ
# podvojenih pravil; glava VERBATIM PDF autoTable head ×6; Sklep VERBATIM
# PDF sklepu; meta kanon R172→R296 — KPI trio ISTI izpisi; filename
# Potekli-opomniki-YYYY-MM-DD.csv — bratska simetrija; izvozna PAR na CRM
# tab izvozni coni — navy/40 ring + press-scale, val 8 register 65; ENA
# izpeljava izbora potekliVnosiIzCustomers ×3 [definicija + OBA brata];
# STIL val 19) +
# DEDOVINA 58. člena (R331 ponudbe-spomniki CSV needleji ostajajo v verigi) +''',
'''# R333 — build needleji: 60. ČLEN issue #1 «IZVOZI» — DOBAVITELJI —
# POZICIJA CEN CSV (CSV brat PDF R264: NOVI lib dobavitelji-pozicija-csv —
# vzorec R330/R331/R332/R297, LOČEN lib ki UVAŽA projekcijo PDF brata — EN
# VIR preverba + JOIN + min-invarianta + agregat + sort
# [dobaviteljiPozicijaCen — ISTA sekvenca kot buildDobaviteljiPozicijaPdfDoc]
# + odstotekNiz IZVOŽEN iz PDF brata [R333 — ISTI odstotek izpis], NIČ
# podvojenih pravil; glava VERBATIM PDF autoTable head ×6; Sklep VERBATIM
# PDF sklepu; meta kanon R172→R296 — KPI peterica ISTI izpisi; filename
# Pozicija-dobaviteljev-YYYY-MM-DD.csv — bratska simetrija; izvozna PAR na
# Material pregled izvozni coni — navy/40 ring + press-scale +
# ring-offset-1, val 8 register 66; ENA izpeljava preseka pridobiPozicijo
# [definicija ×1 + OBA brata ×2]; STIL val 20) +
# DEDOVINA 59. člena (R332 potekli opomniki CSV needleji ostajajo v verigi) +''', 1)

# ── 2. OUT pot ──
zam('OUT=/tmp/r332-build-chunks', 'OUT=/tmp/r333-build-chunks', 1)

# ── 3. R333 needle blok (PO R332 lastni vrstici, PRED REGRESIJAMI) ──
zam('''must_miss "TODO-R332" "R332 — brez razvojnih ostankov"
echo "R332 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"''',
'''must_miss "TODO-R332" "R332 — brez razvojnih ostankov"
echo "R332 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "--- R333 MANDATORY — 60. člen: pozicija dobaviteljev CSV izvoz (IZVOZI družina — CSV brat PDF R264) ---"
need_static "Izvozi pozicijo dobaviteljev kot CSV" "R333 pozicija dobaviteljev CSV gumb aria (material chunk)"
need_static "pozicija-dobaviteljev-csv-pill" "R333 pozicija dobaviteljev CSV gumb testid (material chunk)"
echo "--- R333 must_miss (negativni) ---"
must_miss "TODO-R333" "R333 — brez razvojnih ostankov"
echo "R333 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"''', 1)

# ── 4. Footer ──
zam('echo "=== REGRESIJE: polna veriga prek r324-build-needles.sh [R331 ponudbe-spomniki CSV + R330 projekti-termini CSV + R329 primerjava dobaviteljev PDF + R328 primerjava dobaviteljev CSV + R327 zgodovina cen PDF + R326 zgodovina cen CSV + R325 dekompozicija + R324 dnevni PDF + r323 CSV + R322 + … + R227] ==="',
    'echo "=== REGRESIJE: polna veriga prek r324-build-needles.sh [R332 potekli opomniki CSV + R331 ponudbe-spomniki CSV + R330 projekti-termini CSV + R329 primerjava dobaviteljev PDF + R328 primerjava dobaviteljev CSV + R327 zgodovina cen PDF + R326 zgodovina cen CSV + R325 dekompozicija + R324 dnevni PDF + r323 CSV + R322 + … + R227] ==="', 1)
zam('echo "R332 NEEDLEJI FAIL"; exit 1; fi', 'echo "R333 NEEDLEJI FAIL"; exit 1; fi', 1)
zam('=== R332 BUILD NEEDLES VSE OK ===', '=== R333 BUILD NEEDLES VSE OK ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r333-build-needles.sh zapisan ({len(text)} znakov)')
