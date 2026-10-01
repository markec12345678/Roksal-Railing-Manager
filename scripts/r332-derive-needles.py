#!/usr/bin/env python3
# R332 — derive r332-build-needles.sh iz r331 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Glava: R332 zapis (59. člen potekli opomniki CSV brat)
#   2. OUT pot: /tmp/r331-build-chunks → /tmp/r332-build-chunks
#   3. R332 needle blok (CSV aria + testid + must_miss) — PO R331 bloku
#   4. Footer R331 → R332 (veriga na r324-build-needles ostaja)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r331-build-needles.sh')
DOL = Path('/home/z/my-project/scripts/r332-build-needles.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('''# R331 — build needleji: 58. ČLEN issue #1 «IZVOZI» — PONUDBE — SPOMNIKI
# CSV (CSV brat PDF R267: NOVI lib ponudbe-spomniki-csv — vzorec R330/R297,
# LOČEN lib ki UVAŽA projekcijo PDF brata — EN VIR ponudbeSpomnikiPregled,
# NIČ podvojenih pravil; glava VERBATIM PDF autoTable head ×8; Sklep
# VERBATIM PDF sklepu [stanjeSklep oznake + statusi R161]; meta kanon
# R172→R296; filename Ponudbe-spomniki-YYYY-MM-DD.csv — bratska simetrija;
# izvozna PAR na CRM kartici Ponudbe — sledenje [quote-followup] — navy/40
# ring + press-scale, val 8 register 64; TROJICA press-scale pariteta
# [R161 gumb dobi press-scale]; ENA izpeljava vira pridobiPonudbeSpomnikiVnosi
# ×2 — oba brata; STIL val 18) +
# DEDOVINA 57. člena (R330 projekti-termini CSV needleji ostajajo v verigi) +''',
'''# R332 — build needleji: 59. ČLEN issue #1 «IZVOZI» — POTEKLI OPOMNIKI
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
# DEDOVINA 58. člena (R331 ponudbe-spomniki CSV needleji ostajajo v verigi) +''', 1)

# ── 2. OUT pot ──
zam('OUT=/tmp/r331-build-chunks', 'OUT=/tmp/r332-build-chunks', 1)

# ── 3. R332 needle blok (PO R331 lastni vrstici, PRED REGRESIJAMI) ──
zam('''must_miss "TODO-R331" "R331 — brez razvojnih ostankov"
echo "R331 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"''',
'''must_miss "TODO-R331" "R331 — brez razvojnih ostankov"
echo "R331 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "--- R332 MANDATORY — 59. člen: potekli opomniki CSV izvoz (IZVOZI družina — CSV brat PDF R252) ---"
need_static "Izvozi potekle opomnike kot CSV" "R332 potekli opomniki CSV gumb aria (crm-tab chunk)"
need_static "potekli-opomniki-csv-pill" "R332 potekli opomniki CSV gumb testid (crm-tab chunk)"
echo "--- R332 must_miss (negativni) ---"
must_miss "TODO-R332" "R332 — brez razvojnih ostankov"
echo "R332 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"''', 1)

# ── 4. Footer ──
zam('echo "=== REGRESIJE: polna veriga prek r330-build-needles.sh [R330 projekti-termini CSV + R329 primerjava dobaviteljev PDF + R328 primerjava dobaviteljev CSV + R327 zgodovina cen PDF + R326 zgodovina cen CSV + R325 dekompozicija + R324 dnevni PDF + r323 CSV + R322 + … + R227] ==="',
    'echo "=== REGRESIJE: polna veriga prek r324-build-needles.sh [R331 ponudbe-spomniki CSV + R330 projekti-termini CSV + R329 primerjava dobaviteljev PDF + R328 primerjava dobaviteljev CSV + R327 zgodovina cen PDF + R326 zgodovina cen CSV + R325 dekompozicija + R324 dnevni PDF + r323 CSV + R322 + … + R227] ==="', 1)
zam('echo "R331 NEEDLEJI FAIL"; exit 1; fi', 'echo "R332 NEEDLEJI FAIL"; exit 1; fi', 1)
zam('=== R331 BUILD NEEDLES VSE OK ===', '=== R332 BUILD NEEDLES VSE OK ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r332-build-needles.sh zapisan ({len(text)} znakov)')
